import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildTeamPlayerDemandMap } from "@/lib/morale/player-demands-service";
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
    ovr: partial?.ovr,
    pps: partial?.pps,
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
    promisedRole: partial?.promisedRole ?? null,
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
  seasonId?: string;
  playerMoraleState?: GameState["playerMoraleState"];
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
    disciplineSide: "d1" as const,
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
    season: { id: input.seasonId ?? "season-2", name: "Season 2", year: 2026, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: input.seasonId ?? "season-2",
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
    playerMoraleState: input.playerMoraleState ?? [],
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
  it("keeps captain demands rare because only three season captains exist", () => {
    const players = [
      createPlayer("leader-1", {
        name: "Leader One",
        ovr: 100,
        pps: 30,
        traitsPositive: ["Eloquent", "Ambitious"],
        disciplineRatings: { climb: 99 },
      }),
      createPlayer("leader-2", {
        name: "Leader Two",
        ovr: 98,
        pps: 28,
        traitsPositive: ["Ambitious"],
        traitsNegative: ["Diva"],
        disciplineRatings: { climb: 94 },
      }),
      createPlayer("leader-3", {
        name: "Leader Three",
        ovr: 96,
        pps: 24,
        traitsPositive: ["Motivated"],
        traitsNegative: ["Egomaniac"],
        disciplineRatings: { climb: 91 },
      }),
    ];
    const gameState = createGameState({
      player: players[0],
      teammate: players[1],
    });
    gameState.players = players;
    gameState.rosters = players.map((player) => createRosterEntry(player.id));
    gameState.seasonState.disciplineSchedule = [
      {
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        matchdayIndex: 1,
        matchdayLabel: "MD 1",
        discipline1: { disciplineId: "climb", displayName: "Climbing", order: 1, playerCount: 6, category: "power" },
        discipline2: { disciplineId: "dummy", displayName: "Dummy", order: 2, playerCount: 2, category: "mental" },
        sourceStatus: "season_seed",
        sourceNote: null,
      },
    ];

    const captainDemands = Array.from(buildTeamPlayerDemandMap(gameState, "M-M").values())
      .flat()
      .filter((demand) => demand.type === "captaincy");

    expect(captainDemands).toHaveLength(1);
    expect(captainDemands[0]?.playerId).toBe("leader-1");
    expect(captainDemands[0]?.source).toBe("player_demands_v2_rare_star_window");
  });

  it("does not create captain demands for merely good players because season captain slots are scarce", () => {
    const players = [
      createPlayer("good-1", {
        name: "Good One",
        ovr: 96,
        pps: 25,
        traitsPositive: ["Eloquent", "Ambitious"],
        disciplineRatings: { climb: 88 },
      }),
      createPlayer("good-2", {
        name: "Good Two",
        ovr: 94,
        pps: 21,
        traitsPositive: ["Motivated"],
        traitsNegative: ["Diva"],
        disciplineRatings: { climb: 86 },
      }),
    ];
    const gameState = createGameState({
      player: players[0],
      teammate: players[1],
    });
    gameState.players = players;
    gameState.rosters = players.map((player) => createRosterEntry(player.id));
    gameState.seasonState.disciplineSchedule = [
      {
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        matchdayIndex: 1,
        matchdayLabel: "MD 1",
        discipline1: { disciplineId: "climb", displayName: "Climbing", order: 1, playerCount: 6, category: "power" },
        discipline2: { disciplineId: "dummy", displayName: "Dummy", order: 2, playerCount: 2, category: "mental" },
        sourceStatus: "season_seed",
        sourceNote: null,
      },
    ];

    const captainDemands = Array.from(buildTeamPlayerDemandMap(gameState, "M-M").values())
      .flat()
      .filter((demand) => demand.type === "captaincy");

    expect(captainDemands).toHaveLength(0);
  });

  it("allows a tiny-discipline captain demand only for an obvious star case", () => {
    const players = [
      createPlayer("small-star", {
        name: "Small Star",
        ovr: 93,
        pps: 24,
        traitsPositive: ["Ambitious"],
        disciplineRatings: { duel: 97 },
      }),
      createPlayer("small-gap", {
        name: "Small Gap",
        ovr: 90,
        pps: 18,
        traitsPositive: ["Motivated"],
        disciplineRatings: { duel: 82 },
      }),
    ];
    const gameState = createGameState({
      player: players[0],
      teammate: players[1],
    });
    gameState.players = players;
    gameState.disciplines = [{ id: "duel", name: "Duel", category: "power", weight: 1, playerCount: 2 }];
    gameState.rosters = players.map((player) => createRosterEntry(player.id));
    gameState.seasonState.disciplineSchedule = [
      {
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        matchdayIndex: 1,
        matchdayLabel: "MD 1",
        discipline1: { disciplineId: "duel", displayName: "Duel", order: 1, playerCount: 2, category: "power" },
        discipline2: { disciplineId: "dummy", displayName: "Dummy", order: 2, playerCount: 2, category: "mental" },
        sourceStatus: "season_seed",
        sourceNote: null,
      },
    ];

    const captainDemands = Array.from(buildTeamPlayerDemandMap(gameState, "M-M").values())
      .flat()
      .filter((demand) => demand.type === "captaincy");

    expect(captainDemands).toHaveLength(1);
    expect(captainDemands[0]?.playerId).toBe("small-star");
  });

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

  it("uses promisedRole as contract expectation separately from roster roleTag", () => {
    const promisedStarter = createPlayer("promised-starter");
    const prospectWithoutPromise = createPlayer("prospect-no-promise");

    const promisedMorale = assessPlayerMorale({
      gameState: createGameState({
        player: promisedStarter,
        roster: createRosterEntry(promisedStarter.id, { roleTag: "prospect", promisedRole: "starter" }),
        appearances: 0,
      }),
      playerId: promisedStarter.id,
      teamId: "M-M",
    });
    const prospectMorale = assessPlayerMorale({
      gameState: createGameState({
        player: prospectWithoutPromise,
        roster: createRosterEntry(prospectWithoutPromise.id, { roleTag: "prospect", promisedRole: null }),
        appearances: 0,
      }),
      playerId: prospectWithoutPromise.id,
      teamId: "M-M",
    });

    expect(promisedMorale?.morale).toBeLessThan(prospectMorale?.morale ?? 0);
    expect(promisedMorale?.reasons.map((reason) => reason.reasonId)).toContain("star_not_used");
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
    expect(mercMorale?.moraleSalaryModifier ?? 0).toBeGreaterThanOrEqual(normalMorale?.moraleSalaryModifier ?? 0);
    expect(mercMorale?.reasons.map((reason) => reason.reasonId)).toContain("underpaid_vs_expectation");
  });

  it("scales team-rank pressure by relative player role instead of punishing depth like stars", () => {
    const depth = createPlayer("depth", { rating: 35, marketValue: 8, displayMarketValue: 8, coreStats: { pow: 22, spe: 28, men: 24, soc: 20 } });
    const star = createPlayer("star", { rating: 95, marketValue: 80, displayMarketValue: 80, coreStats: { pow: 88, spe: 74, men: 62, soc: 58 } });
    const eliteTeammate = createPlayer("elite-mate", {
      rating: 96,
      marketValue: 90,
      displayMarketValue: 90,
      coreStats: { pow: 90, spe: 84, men: 70, soc: 62 },
    });

    const depthMorale = assessPlayerMorale({
      gameState: createGameState({
        player: depth,
        roster: createRosterEntry(depth.id, { roleTag: "depth" }),
        rank: 30,
        appearances: 2,
        teammate: eliteTeammate,
      }),
      playerId: depth.id,
      teamId: "M-M",
    });
    const starMorale = assessPlayerMorale({
      gameState: createGameState({
        player: star,
        roster: createRosterEntry(star.id, { roleTag: "starter" }),
        rank: 30,
        appearances: 2,
        teammate: eliteTeammate,
      }),
      playerId: star.id,
      teamId: "M-M",
    });

    expect(depthMorale?.morale).toBeGreaterThan(starMorale?.morale ?? 100);
    expect(depthMorale?.reasons.map((reason) => reason.reasonId)).toContain("relative_role_fulfilled");
    expect(starMorale?.reasons.map((reason) => reason.reasonId)).toContain("low_playtime");
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

  it("keeps more morale between seasons when the player stays on the same team", () => {
    const player = createPlayer("carry-same-team");
    const sameTeamMorale = assessPlayerMorale({
      gameState: createGameState({
        player,
        roster: createRosterEntry(player.id, { teamId: "M-M", roleTag: "starter" }),
        seasonId: "season-2",
        playerMoraleState: [
          {
            playerId: player.id,
            teamId: "M-M",
            morale: 90,
            visibleMood: "excellent",
            lastUpdatedSeasonId: "season-1",
            reasons: [],
            contractIntent: "willing_to_extend",
          },
        ],
      }),
      playerId: player.id,
      teamId: "M-M",
    });
    const freshMorale = assessPlayerMorale({
      gameState: createGameState({
        player,
        roster: createRosterEntry(player.id, { teamId: "M-M", roleTag: "starter" }),
        seasonId: "season-2",
      }),
      playerId: player.id,
      teamId: "M-M",
    });

    expect(sameTeamMorale?.morale ?? 0).toBeGreaterThan(freshMorale?.morale ?? 0);
  });

  it("pulls old morale back much harder when only an old non-matching team state exists", () => {
    const player = createPlayer("carry-other-team");
    const otherTeamMorale = assessPlayerMorale({
      gameState: createGameState({
        team: createTeam({ teamId: "N-N", shortCode: "N-N" }),
        player,
        roster: createRosterEntry(player.id, { teamId: "N-N", roleTag: "starter" }),
        seasonId: "season-2",
        playerMoraleState: [
          {
            playerId: player.id,
            teamId: "M-M",
            morale: 90,
            visibleMood: "excellent",
            lastUpdatedSeasonId: "season-1",
            reasons: [],
            contractIntent: "willing_to_extend",
          },
        ],
      }),
      playerId: player.id,
      teamId: "N-N",
    });
    const sameTeamMorale = assessPlayerMorale({
      gameState: createGameState({
        player,
        roster: createRosterEntry(player.id, { teamId: "M-M", roleTag: "starter" }),
        seasonId: "season-2",
        playerMoraleState: [
          {
            playerId: player.id,
            teamId: "M-M",
            morale: 90,
            visibleMood: "excellent",
            lastUpdatedSeasonId: "season-1",
            reasons: [],
            contractIntent: "willing_to_extend",
          },
        ],
      }),
      playerId: player.id,
      teamId: "M-M",
    });

    expect(otherTeamMorale?.morale ?? 0).toBeLessThan(sameTeamMorale?.morale ?? 100);
  });
});
