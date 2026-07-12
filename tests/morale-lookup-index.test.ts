import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assessPlayerMorale, buildMoraleLookupIndex } from "@/lib/morale/player-morale-service";
import type { RosterEntry } from "@/lib/data/olyDataTypes";

/**
 * Der Morale-Lookup-Index (O(1) statt linearer .find-Scans) muss byte-identische
 * Ergebnisse liefern wie der Non-Index-Pfad — reine Perf-Optimierung, kein
 * Balancing-Effekt.
 */
describe("morale lookup index equivalence", () => {
  it("assessPlayerMorale returns identical results with and without the index", () => {
    const persistence = createPersistenceService();
    const gameState = persistence.createFreshSeasonOneSave({ activate: true }).gameState;

    // Frischer Save hat noch keine Kader — synthetische Eintraege, damit der
    // volle Lookup-Pfad (players/rosters/teams/identities/moraleState) laeuft.
    const rosters: RosterEntry[] = [];
    let cursor = 0;
    for (const team of gameState.teams) {
      for (let slot = 0; slot < 6 && cursor < gameState.players.length; slot += 1, cursor += 1) {
        rosters.push({
          id: `test-roster-${cursor}`,
          teamId: team.teamId,
          playerId: gameState.players[cursor].id,
          contractLength: 3,
          salary: 1000,
          upkeep: 0,
          roleTag: "starter",
          joinedSeasonId: gameState.season.id,
        });
      }
    }
    gameState.rosters = rosters;
    expect(rosters.length).toBeGreaterThan(0);

    const index = buildMoraleLookupIndex(gameState);
    for (const roster of rosters) {
      const withoutIndex = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId });
      const withIndex = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId, index });
      expect(withIndex).toEqual(withoutIndex);
    }
  }, 60000);

  it("index lookups keep .find first-match semantics (players/teams by first occurrence)", () => {
    const persistence = createPersistenceService();
    const gameState = persistence.createFreshSeasonOneSave({ activate: true }).gameState;
    const index = buildMoraleLookupIndex(gameState);
    const firstPlayer = gameState.players[0];
    expect(index.playersById.get(firstPlayer.id)).toBe(firstPlayer);
    const firstTeam = gameState.teams[0];
    expect(index.teamsById.get(firstTeam.teamId)).toBe(firstTeam);
  }, 60000);
});
