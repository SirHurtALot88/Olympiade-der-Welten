/**
 * BREAKING: WAFFENFOLGE IM AUFSTELLUNGSEINTRAG (22.11., lib/lineups/breaking-waffen.ts, docs/design/breaking-tagteam-22-11.md).
 *
 * Der Manager setzt in der Einsatzliste je Spieler eine Waffe je eigenem Gang (`modifiers.dX.breakingWaffen[activePlayerId]`);
 * der Adapter reicht sie als `waffen` im Aufstellungseintrag zur Arena (Host, Vorlauf, Buchung und Eingabe-Hash lesen dieselbe
 * Funktion). Was nicht gesetzt ist, bleibt ein Eintrag ohne Feld: die KI waehlt, und der Umschlag aller anderen Disziplinen
 * bleibt Zeichen fuer Zeichen der alte.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";

function spieler(id: string) {
  const wert = 60;
  return {
    id, name: id, className: "Tank", race: "Human", subclasses: [], traitsPositive: [], traitsNegative: [],
    marketValue: 10, salary: 2, fatigue: 20, attributes: {}, disciplineRatings: { breaking: wert, tdm: wert },
    attributeSheetStats: { power: wert, health: wert, stamina: wert, intelligence: wert, awareness: wert, determination: wert, speed: wert, dexterity: wert, charisma: wert, will: wert, spirit: wert, torment: wert },
  };
}

function stand(modifiers: unknown): GameState {
  const teamId = "A-A";
  const ids = ["b1", "b2", "t1"];
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1", schedule: [], standings: {},
      lineupDrafts: [{
        lineupId: "lineup-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", teamId, status: "submitted",
        entries: [
          { disciplineId: "breaking", disciplineSide: "d1", slotIndex: 0, playerId: "b1", activePlayerId: "roster-b1" },
          { disciplineId: "breaking", disciplineSide: "d1", slotIndex: 1, playerId: "b2", activePlayerId: "roster-b2" },
          { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "t1", activePlayerId: "roster-t1" },
        ],
        ...(modifiers ? { modifiers } : {}),
        createdAt: "2026-11-22T00:00:00.000Z", updatedAt: "2026-11-22T00:00:00.000Z",
      }],
      matchdayResults: [], disciplineResults: [], playerDisciplinePerformances: [], disciplineHighlights: [], resultAuditLogs: [],
      playerAvailabilityState: ids.map((playerId) => ({ playerId, teamId, fatigue: 10, injuryStatus: "healthy" as const })),
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, shortCode: teamId, name: teamId, budget: 100, cash: 100, identityId: "id", humanControlled: false, rosterLimit: 12 }],
    teamIdentities: [], players: ids.map(spieler), disciplines: [],
    rosters: ids.map((playerId) => ({ id: `roster-${playerId}`, teamId, playerId, role: "core", joinedSeasonId: "season-1" })),
    contracts: [], transferListings: [], transferHistory: [], logs: [],
  } as unknown as GameState;
}

describe("Breaking-Waffenfolge im Aufstellungseintrag", () => {
  it("ohne Plan: der Eintrag ist exakt der alte, kein Feld `waffen`", () => {
    const a = buildArenaAufstellung(stand(null), "A-A", "md-1");
    expect(a.b1?.d).toBe("breaking");
    expect(a.b1).not.toHaveProperty("waffen");
    expect(a.b2).not.toHaveProperty("waffen");
  });

  it("mit Plan: nur der gesetzte Spieler traegt die Folge, ungueltige Kennungen werden zu null (die KI waehlt)", () => {
    const m = { d1: { breakingWaffen: { "roster-b1": ["hieb", "unsinn", "wucht"] } }, d2: {} };
    const a = buildArenaAufstellung(stand(m), "A-A", "md-1");
    expect(a.b1?.waffen).toEqual(["hieb", null, "wucht"]);
    expect(a.b2).not.toHaveProperty("waffen");
  });

  it("ein Plan ohne einen einzigen gueltigen Eintrag setzt kein Feld", () => {
    const a = buildArenaAufstellung(stand({ d1: { breakingWaffen: { "roster-b1": [null, "x"] } }, d2: {} }), "A-A", "md-1");
    expect(a.b1).not.toHaveProperty("waffen");
  });

  it("andere Disziplinen tragen nie eine Waffenfolge, auch wenn jemand sie in die Seite schreibt", () => {
    const m = { d1: {}, d2: { breakingWaffen: { "roster-t1": ["hieb"] } } };
    const a = buildArenaAufstellung(stand(m), "A-A", "md-1");
    expect(a.t1?.d).toBe("tdm");
    expect(a.t1).not.toHaveProperty("waffen");
  });

  it("Schluessel ist die Spieler-Id, wenn keine Kader-Zeilen-Id passt", () => {
    const a = buildArenaAufstellung(stand({ d1: { breakingWaffen: { b2: ["zermuerbung"] } }, d2: {} }), "A-A", "md-1");
    expect(a.b2?.waffen).toEqual(["zermuerbung"]);
  });
});
