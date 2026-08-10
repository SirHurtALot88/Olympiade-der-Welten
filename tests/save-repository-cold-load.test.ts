import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameInboxItem, TeamCaptainRecord } from "@/lib/data/olyDataTypes";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { invalidateSaveSessionCache } from "@/lib/persistence/save-session-cache";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-cold-load-test-"));
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

/**
 * Simuliert ein Kaltladen aus der DB: Nach dem Speichern wird der flüchtige
 * In-Memory-Session-Cache verworfen, sodass der nächste Lesezugriff den Save
 * echt aus SQLite materialisiert (statt den gecachten GameState zurückzugeben).
 */
function loadFromCold(saveId: string) {
  const repository = createSaveRepository();
  invalidateSaveSessionCache(saveId);
  return repository.getSaveById(saveId);
}


/**
 * ZEITLIMIT: Diese Suite laedt dreimal einen kompletten Spielstand kalt aus SQLite. Nachgemessen
 * braucht jeder Fall rund 3,6 s — gegen das vitest-Standardlimit von 5 s sind das 72 % des
 * Budgets. Unter Last (Volllauf, mehrere Dateien parallel) riss es regelmaessig, und der Test
 * sah aus wie ein Flake, obwohl er inhaltlich nie etwas anderes gemessen hat.
 *
 * 30 s sind kein Freibrief, sondern Luft fuer den langsamsten Fall: Eine echte Verlangsamung
 * (Faktor 8) faellt weiterhin auf.
 */
const KALT_RELOAD_TIMEOUT_MS = 30_000;

describe("save-repository cold load", () => {
  it("#1: behält einen zugewiesenen Saison-Kapitän über einen Kalt-Reload", () => {
    const repository = createSaveRepository();
    const base = createSingleplayerGameState();
    const team = base.teams[0]!;
    const rosterPlayerId = base.rosters.find((entry) => entry.teamId === team.teamId)?.playerId ?? base.players[0]!.id;
    const playerName = base.players.find((player) => player.id === rosterPlayerId)?.name ?? rosterPlayerId;

    const captain: TeamCaptainRecord = {
      seasonId: base.season.id,
      teamId: team.teamId,
      playerId: rosterPlayerId,
      playerName,
      leadershipScore: 88,
      style: "leader",
      effects: {
        moraleBuffer: 5,
        rivalryPressureReductionPct: 10,
        teamPowerModifierPct: 2,
        conflictSoftenChancePct: 15,
      },
      traitSignals: ["captain_material"],
      source: "manual_assignment",
    };

    repository.saveGameState({
      saveId: "cold-captain",
      gameState: { ...base, teamCaptains: [captain] },
    });

    const loaded = loadFromCold("cold-captain");
    expect(loaded).not.toBeNull();
    expect(loaded!.gameState.teamCaptains).toBeDefined();
    const persistedCaptain = loaded!.gameState.teamCaptains?.find(
      (entry) => entry.teamId === team.teamId && entry.seasonId === base.season.id,
    );
    expect(persistedCaptain?.playerId).toBe(rosterPlayerId);
    expect(persistedCaptain?.source).toBe("manual_assignment");
  }, KALT_RELOAD_TIMEOUT_MS);

  it("#8: behält erledigt/verworfen-Status von Inbox-Items über einen Kalt-Reload", () => {
    const repository = createSaveRepository();
    const base = createSingleplayerGameState();
    const team = base.teams[0]!;
    const playerId = base.rosters.find((entry) => entry.teamId === team.teamId)?.playerId ?? base.players[0]!.id;

    // Non-auto-resolving Item (Prefix "transfer_candidate"): der Status wird NICHT
    // live abgeleitet, sondern muss aus dem Save-Override kommen.
    const dismissed: GameInboxItem = {
      itemId: `transfer_candidate:cold-inbox:${base.season.id}:${team.teamId}:${playerId}`,
      saveId: "cold-inbox",
      seasonId: base.season.id,
      teamId: team.teamId,
      playerId,
      category: "transfer",
      severity: "warning",
      title: "Spieler verkaufen",
      description: "Verworfen im Test.",
      ctaLabel: "Spieler prüfen",
      targetView: "teams",
      targetParams: { team: team.teamId, player: playerId, panel: "roster" },
      status: "dismissed",
      createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      source: "roster_value_contract_cash",
    };

    repository.saveGameState({
      saveId: "cold-inbox",
      gameState: { ...base, gameInboxItems: [dismissed] },
    });

    const loaded = loadFromCold("cold-inbox");
    expect(loaded).not.toBeNull();
    const override = loaded!.gameState.gameInboxItems?.find((item) => item.itemId === dismissed.itemId);
    expect(override).toBeDefined();
    expect(override!.status).toBe("dismissed");
  }, KALT_RELOAD_TIMEOUT_MS);

  it("bleibt rückwärtskompatibel: ein Save ohne die neuen Felder lädt weiterhin", () => {
    const repository = createSaveRepository();
    const base = createSingleplayerGameState();

    repository.saveGameState({ saveId: "cold-legacy", gameState: base });

    const loaded = loadFromCold("cold-legacy");
    expect(loaded).not.toBeNull();
    // Ohne persistierte Overrides bleibt das Verhalten wie bisher (undefined statt Fehler).
    expect(loaded!.gameState.teamCaptains ?? []).toEqual([]);
    expect(loaded!.gameState.gameInboxItems ?? []).toEqual([]);
  }, KALT_RELOAD_TIMEOUT_MS);
});
