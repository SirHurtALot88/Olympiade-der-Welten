import { describe, expect, it } from "vitest";

import type { GameInboxItem, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import {
  applyInboxQuickAction,
  getInboxQuickActions,
  mapInboxQuickActionsToChoices,
} from "@/lib/foundation/inbox-quick-action-service";

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
    name: partial?.name ?? id,
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
    fatigue: partial?.fatigue ?? 80,
    form: 0,
    potential: 0,
    trainingMode: partial?.trainingMode ?? "hart",
    currentXP: 0,
    ...partial,
  };
}

function makeGameState(players: Player[]): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-3", name: "Season 3", year: 2028, currentMatchday: 1, matchdayIds: ["season-3-matchday-1"] },
    seasonState: { seasonId: "season-3", schedule: [], standings: {} },
    matchdayState: { matchdayId: "season-3-matchday-1", status: "open", resolvedFixtureIds: [] },
    teams: [makeTeam()],
    players,
    rosters: [{ teamId: "M-M", playerId: players[0]!.id, contractLength: 2, salary: 2 }],
    disciplines: [],
    transferHistory: [],
  } as GameState;
}

function makeItem(partial: Partial<GameInboxItem>): GameInboxItem {
  return {
    itemId: partial.itemId ?? "test-item",
    saveId: "save-1",
    seasonId: "season-3",
    matchday: "season-3-matchday-1",
    teamId: "M-M",
    playerId: "p-1",
    category: "training",
    severity: "warning",
    title: "Test",
    description: "Test",
    targetView: "training",
    targetParams: { team: "M-M", player: "p-1" },
    ctaLabel: "Training prüfen",
    source: partial.source ?? "player_health_fatigue_risk",
    status: "open",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("inbox-quick-action-service", () => {
  it("offers training-light apply for fatigue risk items", () => {
    const actions = getInboxQuickActions(makeItem({ source: "player_health_fatigue_risk" }));
    expect(actions.some((action) => action.id === "apply-training-light")).toBe(true);
    expect(actions.some((action) => action.id === "dismiss-later")).toBe(true);
  });

  it("applies light training mode to the player", () => {
    const gameState = makeGameState([makePlayer("p-1", { trainingMode: "hart" })]);
    const item = makeItem({ source: "player_health_fatigue_risk", playerId: "p-1" });
    const result = applyInboxQuickAction(gameState, item, "apply-training-light");
    expect(result.applied).toBe(true);
    expect(result.gameState.players[0]?.trainingMode).toBe("leicht");
  });

  it("maps quick actions to inbox choices", () => {
    const choices = mapInboxQuickActionsToChoices(makeItem({ source: "player_health_lineup_rest" }));
    expect(choices.some((choice) => choice.id === "open-lineup")).toBe(true);
  });
});
