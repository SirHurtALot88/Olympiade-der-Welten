import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";

/**
 * Eigenschafts-Tests zur Potenzial-Vereinheitlichung (gemeldet von Chris, am
 * Live-Spielstand nachgemessen): `player.potential` (Import-Altfeld) und
 * `playerPotential[].hiddenPotentialScore` (Modell) wichen bei allen 2984 Spielern
 * voneinander ab (Median +16,1; Lyraeth Vael 65,74 vs. 77). Seitdem gilt: der
 * Record ist die EINZIGE Quelle. Diese Tests sichern genau das — sie fallen,
 * sobald ein Leser wieder auf das Altfeld zurückfällt.
 */

const attrs: PlayerGeneratorAttributes = {
  power: 55,
  health: 55,
  stamina: 55,
  intelligence: 55,
  awareness: 55,
  determination: 55,
  speed: 55,
  dexterity: 55,
  charisma: 55,
  will: 55,
  spirit: 55,
  torment: 55,
};

function buildPlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "p-1",
    name: partial.name ?? "Test Player",
    rating: partial.rating ?? 61.74,
    marketValue: 20,
    salaryDemand: 5,
    className: "Charger",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 55, spe: 55, men: 55, soc: 55 },
    attributeSheetStats: attrs,
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: partial.potential ?? 65.74,
    trainingMode: "mittel",
    trainingClass: null,
    ...partial,
  } as Player;
}

function buildGameState(sourcePlayer: Player, hiddenPotentialScore: number | null): GameState {
  return {
    gamePhase: "player_development",
    season: { id: "season-1", name: "Season 1", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team", shortCode: "T", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players: [sourcePlayer],
    disciplines: [],
    rosters: [
      { id: "r-1", teamId: "team-1", playerId: sourcePlayer.id, salary: 5, marketValue: sourcePlayer.marketValue, contractLength: 2 },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    ...(hiddenPotentialScore != null
      ? {
          playerPotential: [
            {
              playerId: sourcePlayer.id,
              potentialBand: "medium" as const,
              hiddenPotentialScore,
              confidence: 0,
              source: "generated" as const,
              modelVersion: 8,
            },
          ],
        }
      : {}),
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      warnings: [],
    },
  } as unknown as GameState;
}

describe("Potenzial: eine Quelle (hiddenPotentialScore)", () => {
  it("Resolver liefert den Record-Score und ohne Record null — nie das Import-Altfeld", () => {
    const player = buildPlayer({ potential: 65.74 });
    const withRecord = buildGameState(player, 77);
    const withoutRecord = buildGameState(player, null);

    expect(resolvePlayerPotentialScoreFromGameState({ gameState: withRecord, playerId: player.id })).toBe(77);
    // Ohne Record: null („unbekannt"), NICHT 65,74 aus player.potential.
    expect(resolvePlayerPotentialScoreFromGameState({ gameState: withoutRecord, playerId: player.id })).toBeNull();
  });

  it("Trainings-Beschleuniger folgt dem Record, nicht dem widersprechenden Altfeld (Lyraeth-Fall)", () => {
    // Live-Befund: rating 61,74 · player.potential 65,74 (Lücke 4,0 → wäre neutral 1,0)
    // · hiddenPotentialScore 77 (Lücke 15,26 → Beschleuniger 1,231).
    const player = buildPlayer({ rating: 61.74, potential: 65.74 });
    const state = buildGameState(player, 77);

    const result = buildOrganicSeasonProgression({ gameState: state, player });

    expect(result.potentialRating).toBe(77);
    expect(result.potentialTrainingMultiplier).toBeCloseTo(1.231, 3);
  });

  it("ohne Record bleibt der Beschleuniger neutral 1,0 — auch wenn das Altfeld eine große Lücke suggeriert", () => {
    // Vor der Vereinheitlichung fiel der Trainings-Multiplikator auf player.potential
    // zurück (hier: Lücke 40 → ~2,25-fach) und rechnete damit mit einer Zahl, die kein
    // anderes System führt. Jetzt gilt: kein Record → keine erfundene Ersatzzahl → 1,0.
    const player = buildPlayer({ rating: 50, potential: 90 });
    const state = buildGameState(player, null);

    const result = buildOrganicSeasonProgression({ gameState: state, player });

    expect(result.potentialRating).toBeNull();
    expect(result.potentialTrainingMultiplier).toBe(1);
  });
});
