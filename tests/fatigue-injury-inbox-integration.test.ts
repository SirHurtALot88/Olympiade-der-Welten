import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameInboxItems, isGameInboxDecisionItem } from "@/lib/foundation/game-inbox-service";
import { getInjuryRiskPercent } from "@/lib/fatigue/fatigue-injury-service";

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
    fatigue: partial?.fatigue ?? 85,
    form: 0,
    potential: 0,
    trainingMode: partial?.trainingMode ?? "hart",
    currentXP: 0,
    injuryStatus: partial?.injuryStatus ?? "healthy",
    ...partial,
  };
}

function makeGameState(players: Player[]): GameState {
  return {
    gamePhase: "season_active",
    season: {
      id: "season-3",
      name: "Season 3",
      year: 2028,
      currentMatchday: 2,
      matchdayIds: ["season-3-matchday-1", "season-3-matchday-2"],
    },
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
    },
    matchdayState: { matchdayId: "season-3-matchday-2", status: "open", resolvedFixtureIds: ["season-3-matchday-1"] },
    teams: [makeTeam()],
    players,
    rosters: players.map((player) => ({ teamId: "M-M", playerId: player.id, contractLength: 2, salary: 2 })),
    disciplines: [],
    transferHistory: [],
    teamIdentities: [],
  } as GameState;
}

describe("fatigue injury inbox integration", () => {
  it("surfaces fatigue risk and injury as decision inbox items for manual teams", () => {
    const fatiguedPlayer = makePlayer("p-fatigue", { fatigue: 82, trainingMode: "hart" });
    expect(getInjuryRiskPercent(fatiguedPlayer.fatigue ?? 0)).toBeGreaterThanOrEqual(15);

    const injuredPlayer = makePlayer("p-injured", {
      fatigue: 20,
    });

    const gameState = makeGameState([fatiguedPlayer, injuredPlayer]);
    gameState.seasonState = {
      ...gameState.seasonState,
      playerAvailabilityState: [
        {
          playerId: "p-injured",
          teamId: "M-M",
          fatigue: 20,
          injuryStatus: "injured",
          injuryUntilMatchday: "season-3-matchday-2",
          injuredAtSeasonId: "season-3",
          injuredAtMatchdayId: "season-3-matchday-1",
          injuryReason: "fatigue_over_30_after_matchday_use",
        },
      ],
    };
    const items = buildGameInboxItems({
      saveId: "save-1",
      gameState,
      activeTeamId: "M-M",
      activeOwnerId: "user_local",
      hostMode: false,
      createdAt: new Date().toISOString(),
    }).filter((item) => item.teamId === "M-M");

    const fatigueItem = items.find((item) => item.source === "player_health_fatigue_risk" && item.playerId === "p-fatigue");
    const injuryItem = items.find((item) => item.source === "player_health_injury" && item.playerId === "p-injured");

    expect(fatigueItem).toBeTruthy();
    expect(injuryItem).toBeTruthy();
    expect(isGameInboxDecisionItem(fatigueItem!)).toBe(true);
    expect(isGameInboxDecisionItem(injuryItem!)).toBe(true);
    expect(fatigueItem?.severity === "critical" || fatigueItem?.severity === "warning").toBe(true);
    expect(injuryItem?.severity).toBe("critical");
  });
});
