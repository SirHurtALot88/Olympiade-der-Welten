import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  applySignatureCashGain,
  applySignatureFatigueDelta,
} from "@/lib/lineups/team-signature-abilities";
import { makePlayer, makeRosterEntry, makeTeam } from "./_fixtures/game-entity-fixtures";

// Machbarkeitsnachweis fuer docs/team-abilities-redesign.md: die beiden
// Nicht-Arena-Effekte (Cash-Gewinn, Fatigue-Angriff/-Erholung) sind pure
// GameState-Transformationen auf bestehenden Persistenzfeldern.
function createGameState(partial?: Partial<GameState>): GameState {
  return {
    teams: [makeTeam({ teamId: "C-C", cash: 500 }), makeTeam({ teamId: "H-R", cash: 300 })],
    players: [
      makePlayer({ id: "p1", name: "Star", ovr: 90, fatigue: 10 }),
      makePlayer({ id: "p2", name: "Mid", ovr: 70, fatigue: 95 }),
      makePlayer({ id: "p3", name: "Bench", ovr: 50, fatigue: 0 }),
    ],
    rosters: [
      makeRosterEntry({ id: "r1", teamId: "H-R", playerId: "p1" }),
      makeRosterEntry({ id: "r2", teamId: "H-R", playerId: "p2" }),
      makeRosterEntry({ id: "r3", teamId: "H-R", playerId: "p3" }),
    ],
    seasonState: {
      playerAvailabilityState: [
        { playerId: "p1", teamId: "H-R", fatigue: 20, injuryStatus: "healthy" },
      ],
    },
    ...partial,
  } as GameState;
}

describe("signature abilities prototype", () => {
  it("cash_gain schreibt den Betrag nur auf das Zielteam-Konto", () => {
    const result = applySignatureCashGain({ gameState: createGameState(), teamId: "C-C", amount: 120 });
    expect(result.appliedAmount).toBe(120);
    expect(result.gameState.teams.find((team) => team.teamId === "C-C")?.cash).toBe(620);
    expect(result.gameState.teams.find((team) => team.teamId === "H-R")?.cash).toBe(300);
  });

  it("cash_gain ignoriert negative Betraege statt Cash abzubuchen", () => {
    const gameState = createGameState();
    const result = applySignatureCashGain({ gameState, teamId: "C-C", amount: -50 });
    expect(result.appliedAmount).toBe(0);
    expect(result.gameState).toBe(gameState);
  });

  it("fatigue_attack trifft die N staerksten Spieler, clampt auf 100 und pflegt beide Persistenzstellen", () => {
    const result = applySignatureFatigueDelta({
      gameState: createGameState(),
      targetTeamId: "H-R",
      fatigueDelta: 12,
      targetPlayerLimit: 2,
    });
    // Top-2 nach OVR: p1 (90) und p2 (70); p3 bleibt unberuehrt.
    expect(result.affectedPlayerIds).toEqual(["p1", "p2"]);
    const availability = result.gameState.seasonState.playerAvailabilityState ?? [];
    // p1 hatte einen Availability-Record (20) -> 32; players[] wird mitgezogen.
    expect(availability.find((entry) => entry.playerId === "p1")?.fatigue).toBe(32);
    expect(result.gameState.players.find((player) => player.id === "p1")?.fatigue).toBe(32);
    // p2 ohne Record: neuer Eintrag auf Basis von player.fatigue (95), geclampt auf 100.
    expect(availability.find((entry) => entry.playerId === "p2")?.fatigue).toBe(100);
    expect(result.gameState.players.find((player) => player.id === "p2")?.fatigue).toBe(100);
    expect(result.gameState.players.find((player) => player.id === "p3")?.fatigue).toBe(0);
  });

  it("fatigue_relief senkt Fatigue im ganzen Kader und clampt auf 0", () => {
    const result = applySignatureFatigueDelta({
      gameState: createGameState(),
      targetTeamId: "H-R",
      fatigueDelta: -15,
      targetPlayerLimit: 0,
    });
    expect(result.affectedPlayerIds).toHaveLength(3);
    expect(result.gameState.players.find((player) => player.id === "p1")?.fatigue).toBe(5);
    expect(result.gameState.players.find((player) => player.id === "p2")?.fatigue).toBe(80);
    expect(result.gameState.players.find((player) => player.id === "p3")?.fatigue).toBe(0);
  });
});
