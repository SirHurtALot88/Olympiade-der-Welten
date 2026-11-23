import { describe, expect, it } from "vitest";

import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { berechneAusbauKosten, berechneAusbauLeiter } from "@/lib/facilities/facility-upgrade-kosten";
import { previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

function stand(): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", shortCode: "T-O", name: "Team One", budget: 500, cash: 500, identityId: "identity-1", humanControlled: true, rosterLimit: 12 }],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

describe("Ausbaukosten: gezeigt = gebucht", () => {
  it("die Leiter nennt je Gebaeude denselben Preis wie die Vorschau des Upgrades (Stufe 0 -> 1)", () => {
    const gameState = stand();
    const save = { saveId: "s", name: "t", status: "active", createdAt: "x", updatedAt: "x", gameState } as unknown as PersistedSaveGame;
    for (const facility of FACILITY_CATALOG) {
      const leiter = berechneAusbauLeiter(gameState, "team-1", facility.facilityId);
      expect(leiter).toHaveLength(facility.maxLevel);
      const vorschau = previewFacilityUpgrade(save, "team-1", facility.facilityId, "specialist");
      if (vorschau.upgradeCost != null) expect(leiter[0]).toBeCloseTo(vorschau.upgradeCost, 6);
      expect(berechneAusbauKosten(gameState, "team-1", facility.facilityId, 1)).toBe(leiter[0]);
    }
  });
});
