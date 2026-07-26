import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearPlayerSavePatches,
  clearPlayerSavePatchesForAllSaves,
  createSaveRepository,
} from "@/lib/persistence/save-repository";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-clear-patches-test-"));
  process.env.OLY_APP_SQLITE_PATH = path.join(tempDirectory, "data", "oly-app.sqlite");
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

function playerRow(saveId: string, playerId: string) {
  return getDatabase()
    .prepare("SELECT payload_json FROM players WHERE save_id = ? AND player_id = ?")
    .get(saveId, playerId) as { payload_json: string } | undefined;
}

describe("clearPlayerSavePatches (Bug S3: darf nur den Ziel-Save treffen)", () => {
  it("löscht den Save-Patch nur für den angegebenen Save, nicht für andere Saves", () => {
    const repository = createSaveRepository();
    const base = createSingleplayerGameState();
    const playerId = base.players[0]!.id;

    // Save A: individuelle Anpassung an genau diesem Spieler (erzeugt eine Delta-Zeile).
    repository.saveGameState({
      saveId: "save-a",
      gameState: {
        ...base,
        players: base.players.map((player) =>
          player.id === playerId ? { ...player, name: `${player.name} (Save A Edit)` } : player,
        ),
      },
    });

    // Save B: eine ANDERE individuelle Anpassung am selben Spieler.
    repository.saveGameState({
      saveId: "save-b",
      gameState: {
        ...base,
        players: base.players.map((player) =>
          player.id === playerId ? { ...player, name: `${player.name} (Save B Edit)` } : player,
        ),
      },
    });

    // Vorbedingung: beide Saves haben tatsächlich eine Save-spezifische Patch-Zeile.
    expect(playerRow("save-a", playerId)).toBeTruthy();
    expect(playerRow("save-b", playerId)).toBeTruthy();

    const saveABefore = repository.getSaveById("save-a");
    const saveBBefore = repository.getSaveById("save-b");
    const saveAUpdatedAtBefore = saveABefore!.updatedAt;
    const saveBUpdatedAtBefore = saveBBefore!.updatedAt;

    // Re-Import/Reset für Save A darf Save B NICHT anfassen.
    const explicitUpdatedAt = new Date(new Date(saveAUpdatedAtBefore).getTime() + 1000).toISOString();
    clearPlayerSavePatches(playerId, "save-a", explicitUpdatedAt);

    expect(playerRow("save-a", playerId)).toBeUndefined();

    const saveBAfter = repository.getSaveById("save-b");
    const savedBPatchRow = playerRow("save-b", playerId);
    expect(savedBPatchRow).toBeTruthy();
    const expectedNameB = `${base.players.find((p) => p.id === playerId)!.name} (Save B Edit)`;
    expect(savedBPatchRow!.payload_json).toContain(expectedNameB);
    // Direkter Nachweis über den Repository-Read: Save B hat weiterhin seine eigene Anpassung.
    const saveBGameState = repository.getSaveById("save-b")!.gameState;
    expect(saveBGameState.players.find((p) => p.id === playerId)?.name).toBe(expectedNameB);
    // Save B's eigener updated_at darf durch den Save-A-Clear nicht verändert werden.
    expect(saveBAfter!.updatedAt).toBe(saveBUpdatedAtBefore);

    // Save A selbst wurde angefasst -> updated_at muss sich bewegt haben (Cache-Invalidierung).
    const saveAAfter = repository.getSaveById("save-a");
    expect(saveAAfter!.updatedAt).toBe(explicitUpdatedAt);
    expect(saveAAfter!.updatedAt).not.toBe(saveAUpdatedAtBefore);
  }, 20_000);

  it("clearPlayerSavePatchesForAllSaves (expliziter Opt-in) löscht Patches in JEDEM Save", () => {
    const repository = createSaveRepository();
    const base = createSingleplayerGameState();
    const playerId = base.players[0]!.id;

    repository.saveGameState({
      saveId: "save-a",
      gameState: {
        ...base,
        players: base.players.map((player) =>
          player.id === playerId ? { ...player, name: `${player.name} (Save A Edit)` } : player,
        ),
      },
    });
    repository.saveGameState({
      saveId: "save-b",
      gameState: {
        ...base,
        players: base.players.map((player) =>
          player.id === playerId ? { ...player, name: `${player.name} (Save B Edit)` } : player,
        ),
      },
    });

    expect(playerRow("save-a", playerId)).toBeTruthy();
    expect(playerRow("save-b", playerId)).toBeTruthy();

    clearPlayerSavePatchesForAllSaves(playerId);

    expect(playerRow("save-a", playerId)).toBeUndefined();
    expect(playerRow("save-b", playerId)).toBeUndefined();
  }, 20_000);
});
