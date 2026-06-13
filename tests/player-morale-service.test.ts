import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 160,
    cash: partial?.cash ?? 120,
    identityId: partial?.identityId ?? partial?.teamId ?? "M-M",
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 72,
    marketValue: partial?.marketValue ?? 42,
    salaryDemand: partial?.salaryDemand ?? 7,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 42,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 7,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 70, spe: 50, men: 45, soc: 40 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { climb: 75 },
    disciplineTierCounts: partial?.disciplineTierCounts ?? { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
    currentXP: partial?.currentXP,
    spentXP: partial?.spentXP,
    lifetimeXP: partial?.lifetimeXP,
    trainingMode: partial?.trainingMode,
  };
}

function createRosterEntry(playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id: partial?.id ?? `roster:${partial?.teamId ?? "M-M"}:${playerId}`,
    teamId: partial?.teamId ?? "M-M",
    playerId,
    contractLength: partial?.contractLength ?? 1,
    contractStatus: partial?.contractStatus,
    salary: partial?.salary ?? 7,
    upkeep: partial?.upkeep ?? partial?.salary ?? 7,
    purchasePrice: partial?.purchasePrice ?? 42,
    currentValue: partial?.currentValue ?? 42,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input: {
  team?: Team;
  player?: Player;
  roster?: RosterEntry;
  rank?: number;
  appearances?: number;
  averageContribution?: number;
  teammate?: Player;
} = {}): GameState {
  const team = input.team ?? createTeam();
  const player = input.player ?? createPlayer("p1");
  const roster = input.roster ?? createRosterEntry(player.id, { teamId: team.teamId });
  const teammate = input.teammate ?? createPlayer("mate", { className: player.className, race: player.race, traitsPositive: player.traitsPositive });
  const teammateRoster = createRosterEntry(teammate.id, { teamId: team.teamId, roleTag: "bench" });
  const performances = Array.from({ length: input.appearances ?? 0 }, (_, index) => ({
    id: `perf-${index}`,
    matchdayResultId: "result-1",
    teamId: team.teamId,
    playerId: player.id,
    activePlayerId: roster.id,
    disciplineId: "climb",
    disciplineSide: "d1",
    slotIndex: index,
    baseValue: 70,
    finalPlayerScore: input.averageContribution ?? 10,
    scoreContribution: input.averageContribution ?? 10,
    rankInTeam: 1,
    rankInDiscipline: 5,
    isTop10: true,
    isMvpCandidate: false,
    storyWeight: null,
    createdAt: "2026-06-13T00:00:00.000Z",
  }));

  return {
    gamePhase: "preseason_management",
    season: { id: "season-2", name: "Season 2", year: 2026, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: { [team.teamId]: { points: 0, rank: input.rank ?? 12 } },
      matchdayResults: [{ id: "result-1", saveId: "save", seasonId: "season-2", matchdayId: "matchday-1", status: "preview_applied", sourceVersion: "test", teamsTotal: 1, teamsReady: 1, teamsUnderfilled: 0, teamsMissingLineup: 0, teamsInvalidLineup: 0, teamsMissingScoreCoverage: 0, warningsCount: 0, createdAt: "", updatedAt: "" }],
      playerDisciplinePerformances: performances,
    },
    matchdayState: { matchdayId: "matchday-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team],
    teamIdentities: [{
      teamId: team.teamId,
      pow: 8,
      spe: 5,
      men: 5,
      soc: 4,
      ambition: 5,
      finances: 5,
      boardConfidence: 50,
      harmony: 5,
      manners: 5,
      popularity: 5,
      cooperation: 5,
      playerMin: 7,
      playerOpt: 10,
    }],
    players: [player, teammate],
    disciplines: [{ id: "climb", name: "Climbing", category: "power", weight: 1, playerCount: 6 }],
    rosters: [roster, teammateRoster],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

describe("player morale service", () => {
  it("penalizes ambitious players in weak teams more than loyal players", () => {
    const ambitious = createPlayer("ambitious", { traitsPositive: ["Ambitious"] });
    const loyal = createPlayer("loyal", { traitsPositive: ["Loyal"] });

    const ambitiousMorale = assessPlayerMorale({
      gameState: createGameState({ player: ambitious, roster: createRosterEntry(ambitious.id), rank: 30 }),
      playerId: ambitious.id,
      teamId: "M-M",
    });
    const loyalMorale = assessPlayerMorale({
      gameState: createGameState({ player: loyal, roster: createRosterEntry(loyal.id), rank: 30 }),
      playerId: loyal.id,
      teamId: "M-M",
    });

    expect(ambitiousMorale?.morale).toBeLessThan(loyalMorale?.morale ?? 0);
    expect(ambitiousMorale?.reasons.map((reason) => reason.reasonId)).toContain("team_underperforming");
  });

  it("raises morale with high usage and lowers starter morale with no usage", () => {
    const used = createPlayer("used");
    const unused = createPlayer("unused");

    const usedMorale = assessPlayerMorale({
      gameState: createGameState({ player: used, roster: createRosterEntry(used.id, { roleTag: "starter" }), appearances: 9, averageContribution: 13 }),
      playerId: used.id,
      teamId: "M-M",
    });
    const unusedMorale = assessPlayerMorale({
      gameState: createGameState({ player: unused, roster: createRosterEntry(unused.id, { roleTag: "starter" }), appearances: 0 }),
      playerId: unused.id,
      teamId: "M-M",
    });

    expect(usedMorale?.morale).toBeGreaterThan(unusedMorale?.morale ?? 100);
    expect(unusedMorale?.reasons.map((reason) => reason.reasonId)).toContain("star_not_used");
  });

  it("makes mercenary players more salary-sensitive", () => {
    const mercenary = createPlayer("merc", { traitsNegative: ["Mercenary"] });
    const normal = createPlayer("normal");

    const mercMorale = assessPlayerMorale({
      gameState: createGameState({ player: mercenary, roster: createRosterEntry(mercenary.id, { salary: 4 }) }),
      playerId: mercenary.id,
      teamId: "M-M",
      renewalSalaryPreview: 8,
    });
    const normalMorale = assessPlayerMorale({
      gameState: createGameState({ player: normal, roster: createRosterEntry(normal.id, { salary: 4 }) }),
      playerId: normal.id,
      teamId: "M-M",
      renewalSalaryPreview: 8,
    });

    expect(mercMorale?.morale).toBeLessThan(normalMorale?.morale ?? 100);
    expect(mercMorale?.moraleSalaryModifier).toBeGreaterThan(normalMorale?.moraleSalaryModifier ?? 0);
    expect(mercMorale?.reasons.map((reason) => reason.reasonId)).toContain("underpaid_vs_expectation");
  });

  it("limits very low morale to short renewal offers and suggests countermeasures", () => {
    const player = createPlayer("angry", {
      traitsNegative: ["Lazy", "Diva", "Mercenary", "Renegade"],
      trainingMode: "hart",
    });
    const morale = assessPlayerMorale({
      gameState: createGameState({
        team: createTeam({ teamId: "C-C", shortCode: "C-C" }),
        player,
        roster: createRosterEntry(player.id, { teamId: "C-C", salary: 3, roleTag: "starter" }),
        rank: 32,
        appearances: 0,
        teammate: createPlayer("bad-fit", { className: "Mage", race: "Elf", traitsPositive: ["Saintly"] }),
      }),
      playerId: player.id,
      teamId: "C-C",
      renewalSalaryPreview: 10,
    });

    expect(morale?.moraleContractLengthLimit).toBe(1);
    expect(morale?.contractIntent).toBe("refuses_extension");
    expect(morale?.suggestedActions).toContain("1-Jahres-Bridge-Deal anbieten");
  });
});
