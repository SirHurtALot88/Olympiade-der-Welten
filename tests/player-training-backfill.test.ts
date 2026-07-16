import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  applyDefaultTrainingFieldsToPlayer,
  applyDefaultTrainingFieldsToRosteredPlayers,
} from "@/lib/training/player-training-backfill";

function player(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "p-1",
    name: partial.name ?? "Test",
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 5,
    className: partial.className ?? "Hero",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "m",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { d1: 50 },
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 1, above40: 0, above60: 0, above80: 0 },
    flavorEn: partial.flavorEn ?? "",
    flavorDe: partial.flavorDe ?? "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 60,
    trainingMode: partial.trainingMode,
    trainingClass: partial.trainingClass,
  };
}

describe("player-training-backfill", () => {
  it("defaults missing training mode and class from className", () => {
    const next = applyDefaultTrainingFieldsToPlayer(player({ trainingMode: undefined, trainingClass: undefined }));
    expect(next.trainingMode).toBe("mittel");
    expect(next.trainingClass).toBe("Hero");
  });

  it("applies defaults only to rostered players", () => {
    const gameState = {
      players: [player({ id: "p-1" }), player({ id: "p-2" })],
      rosters: [{ id: "r-1", teamId: "t-1", playerId: "p-1", contractLength: 2, salary: 5, upkeep: 5, roleTag: "starter", joinedSeasonId: "season-1" }],
    } as GameState;
    const next = applyDefaultTrainingFieldsToRosteredPlayers(gameState);
    expect(next.players.find((entry) => entry.id === "p-1")?.trainingMode).toBe("mittel");
    expect(next.players.find((entry) => entry.id === "p-2")?.trainingMode).toBeUndefined();
  });
});
