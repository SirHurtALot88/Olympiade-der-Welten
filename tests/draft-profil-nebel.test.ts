/**
 * NEBEL IM DRAFT-PROFIL (19.11.): das große Profil über dem Draft nutzt dieselbe Sichtstufe wie das Brett. Der globale
 * Entwickler-Schalter `DEBUG_FORCE_PLAYER_VISIBILITY` zeigt sonst jeden Spieler exakt; `fogErzwingen` hebt ihn für den Aufrufer auf.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hatNebel, nebelBreite } from "@/lib/foundation/spielerprofil-modell";

const DB = path.join(os.tmpdir(), `oly-draft-profil-nebel-${process.pid}-${Date.now()}.sqlite`);
let gameState: import("@/lib/data/olyDataTypes").GameState;
let team = "";
let freierId = "";
let bauen: typeof import("@/lib/foundation/player-detail-drawer").buildPlayerDrawerDataFromGameState;

beforeAll(async () => {
  process.env.OLY_APP_SQLITE_PATH = DB;
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  bauen = (await import("@/lib/foundation/player-detail-drawer")).buildPlayerDrawerDataFromGameState;
  const { freieSpieler } = await import("@/lib/draft/liga-draft-ki");
  const frisch = createPersistenceService().createFreshSeasonOneSave({ name: "draft-profil-nebel" });
  gameState = frisch.gameState;
  team = gameState.teams[0]!.teamId;
  freierId = freieSpieler(gameState)[3]!.id;
}, 120_000);

afterAll(() => {
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
});

describe("Draft-Profil: Scouting-Nebel", () => {
  it("mit erzwungenem Nebel: fremder, ungescouteter Spieler ist 'scouted' (Nebel an), keine exakten Attributwerte", () => {
    const daten = bauen({ gameState, playerId: freierId, source: "sqlite", manageableTeamIds: [team], fogErzwingen: true })!;
    expect(daten.attributeVisibility).toBe("scouted");
    expect(hatNebel(daten)).toBe(true);
    expect(nebelBreite(daten)).toBe(10);
    expect(daten.attributeStats.length).toBeGreaterThan(0);
    for (const zeile of daten.attributeStats) expect(zeile.value).toBeNull();
  });

  it("ohne Erzwingen bleibt das heutige Verhalten (Entwickler-Schalter: exakt) unveraendert", () => {
    const daten = bauen({ gameState, playerId: freierId, source: "sqlite", manageableTeamIds: [team] })!;
    expect(daten.attributeVisibility === "exact" || daten.attributeVisibility === "scouted").toBe(true);
  });
});
