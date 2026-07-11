import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildSeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";

function makeTeam(): Team {
  return {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    budget: 325,
    cash: 50,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 12,
    logoPath: null,
  };
}

function makePlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: id,
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: partial?.trainingMode ?? "mittel",
    currentXP: 0,
    ...partial,
  };
}

function makeGameState(partial?: Partial<GameState>): GameState {
  const players = partial?.players ?? [makePlayer("p-1"), makePlayer("p-2"), makePlayer("p-3"), makePlayer("p-4"), makePlayer("p-5"), makePlayer("p-6"), makePlayer("p-7")];
  return {
    gamePhase: partial?.gamePhase ?? "season_active",
    season: { id: "season-3", name: "Season 3", year: 2028, currentMatchday: 1, matchdayIds: ["season-3-matchday-1"] },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings: {},
      teamControlSettings: {
        "M-M": {
          teamId: "M-M",
          controlMode: "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: "Chris",
          aiLineupPreviewEnabled: false,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: { matchdayId: "season-3-matchday-1", status: "open", resolvedFixtureIds: [] },
    teams: [makeTeam()],
    players,
    rosters: players.map((player) => ({ teamId: "M-M", playerId: player.id, contractLength: 2, salary: 2 })),
    disciplines: [],
    transferHistory: [],
    teamIdentities: [],
    ...partial,
  } as GameState;
}

describe("season-readiness-checklist", () => {
  it("returns null without active team", () => {
    expect(buildSeasonReadinessChecklist({ gameState: makeGameState(), teamId: null })).toBeNull();
  });

  it("builds season-active checklist with training and lineup items", () => {
    const checklist = buildSeasonReadinessChecklist({ gameState: makeGameState(), teamId: "M-M" });
    expect(checklist?.phase).toBe("season_active");
    expect(checklist?.items.some((item) => item.id === "training")).toBe(true);
    expect(checklist?.items.some((item) => item.id === "lineup")).toBe(true);
  });

  it("builds season-end checklist when phase is season_review", () => {
    const checklist = buildSeasonReadinessChecklist({
      gameState: makeGameState({ gamePhase: "season_review" }),
      teamId: "M-M",
    });
    expect(checklist?.phase).toBe("season_end");
    expect(checklist?.title).toBe("Saisonende-Assistent");
  });
});
