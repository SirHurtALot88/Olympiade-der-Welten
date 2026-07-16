import type { PersistedSaveGame, SaveSummary } from "@/lib/persistence/types";
import { loadSeedData } from "@/lib/data/dataAdapter";
import { enrichPlayerDerivedStats } from "@/lib/data/playerStatsAdapter";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type {
  Contract,
  Fixture,
  GameLogEntry,
  GameState,
  MappingReport,
  MatchdayState,
  OlySeedData,
  Player,
  RosterEntry,
  SeasonState,
  TeamIdentity,
  TransferListing,
} from "@/lib/data/olyDataTypes";

import type { PrismaFoundationReadSnapshot } from "./foundation-read-repository";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function createLog(message: string, type: GameLogEntry["type"] = "system"): GameLogEntry {
  return {
    id: `db-read-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}

function createSeasonState(fixtures: Fixture[], teamIds: string[], seasonId: string): SeasonState {
  return {
    seasonId,
    schedule: fixtures,
    standings: Object.fromEntries(
      teamIds.map((teamId) => [
        teamId,
        {
          points: 0,
        },
      ]),
    ),
  };
}

function createMatchdayState(
  seasonId: string,
  currentMatchdayIndex: number,
  matchdays: Array<{ id: string; index: number }>,
): MatchdayState {
  const current = matchdays.find((matchday) => matchday.index === currentMatchdayIndex) ?? matchdays[0];

  return {
    matchdayId: current?.id ?? `${seasonId}-matchday-1`,
    status: "planning",
    pendingTeamIds: [],
    resolvedFixtureIds: [],
  };
}

function buildMappingReport(input: {
  seed: OlySeedData;
  players: Player[];
  rosters: RosterEntry[];
  teams: Array<{ teamId: string }>;
}): MappingReport {
  const { seed, players, rosters, teams } = input;
  const mappedPlayerIds = new Set(rosters.map((roster) => roster.playerId));
  const teamsWithPlayers = new Set(rosters.map((roster) => roster.teamId));

  return {
    ...seed.mappingReport,
    generatedAt: new Date().toISOString(),
    importedPlayerCount: players.length,
    matchedRosterCount: rosters.length,
    teamCount: teams.length,
    unmappedPlayers: players.filter((player) => !mappedPlayerIds.has(player.id)).map((player) => player.name),
    teamsWithoutPlayers: teams.filter((team) => !teamsWithPlayers.has(team.teamId)).map((team) => team.teamId),
  };
}

function buildTransferListings(players: Player[], rosters: RosterEntry[]): TransferListing[] {
  const mappedPlayerIds = new Set(rosters.map((roster) => roster.playerId));

  return players
    .filter((player) => !mappedPlayerIds.has(player.id))
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 120)
    .map((player, index) => ({
      id: `listing-prisma-${index + 1}`,
      playerId: player.id,
      sellerTeamId: null,
      askingPrice: player.marketValue,
      minimumSalary: player.salaryDemand,
      status: "open",
      createdAt: new Date().toISOString(),
    }));
}

export function projectFoundationStateFromPrisma(snapshot: PrismaFoundationReadSnapshot): {
  save: PersistedSaveGame;
  saves: SaveSummary[];
  source: "prisma";
} {
  const seed = loadSeedData();
  const seedDisciplineById = new Map(seed.disciplines.map((discipline) => [discipline.id, discipline]));

  const teams = snapshot.teamSeasonStates.map((state) => ({
    teamId: state.teamId,
    shortCode: state.team.shortCode,
    name: state.team.name,
    logoPath: state.team.logoPath,
    budget: state.budget,
    cash: state.cash,
    identityId: state.teamId,
    humanControlled: state.humanControlled,
    rosterLimit: state.rosterLimit,
  }));

  const teamIdentities: TeamIdentity[] = snapshot.teamSeasonStates.map((state) => ({
    teamId: state.teamId,
    pow: state.pow,
    spe: state.spe,
    men: state.men,
    soc: state.soc,
    ambition: state.ambition,
    finances: state.finances,
    boardConfidence: state.boardConfidence,
    harmony: state.harmony,
    manners: state.manners,
    popularity: state.popularity,
    cooperation: state.cooperation,
    playerMin: state.playerMin,
    playerOpt: state.playerOpt,
    sourceNote: state.sourceNote ?? undefined,
  }));

  const players: Player[] = snapshot.players.map((player) => {
    const attributes = player.attributes;
    const disciplineRatings = Object.fromEntries(
      player.disciplineScores.map((score) => [
        score.disciplineId,
        Number(score.score.toFixed(2)),
      ]),
    );

    return enrichPlayerDerivedStats({
      id: player.id,
      name: player.name,
      portraitPath: player.portraitPath,
      portraitUrl: getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath),
      rating: attributes?.rating ?? 0,
      marketValue: attributes?.marketValue ?? 0,
      salaryDemand: attributes?.salaryDemand ?? 0,
      className: player.className,
      race: player.race,
      alignment: player.alignment,
      gender: player.gender,
      referenceClass: player.referenceClass,
      imageSource: player.imageSource,
      bracketLabel: player.bracketLabel,
      displayMarketValue: attributes?.displayMarketValue ?? attributes?.marketValue ?? 0,
      displaySalary: attributes?.displaySalary ?? attributes?.salaryDemand ?? 0,
      cost: attributes?.cost ?? attributes?.marketValue ?? 0,
      upkeepBase: attributes?.upkeepBase ?? attributes?.salaryDemand ?? 0,
      subclasses: toStringArray(player.subclasses),
      traitsPositive: toStringArray(player.traitsPositive),
      traitsNegative: toStringArray(player.traitsNegative),
      coreStats: {
        pow: attributes?.pow ?? 0,
        spe: attributes?.spe ?? 0,
        men: attributes?.men ?? 0,
        soc: attributes?.soc ?? 0,
      },
      preferredDisciplineIds: toStringArray(player.preferredDisciplineIds),
      disciplineRatings,
      disciplineTierCounts: {
        above20: attributes?.above20 ?? 0,
        above40: attributes?.above40 ?? 0,
        above60: attributes?.above60 ?? 0,
        above80: attributes?.above80 ?? 0,
      },
      flavorEn: player.flavorEn,
      flavorDe: player.flavorDe,
      fatigue: attributes?.fatigue ?? 0,
      form: attributes?.form ?? 0,
      potential: attributes?.potential ?? 0,
    });
  });

  const disciplines = snapshot.disciplines.map((discipline) => {
    const seasonConfig = discipline.seasonConfigs[0];
    const fallbackDiscipline = seedDisciplineById.get(discipline.id);

    return {
      id: discipline.id,
      name: discipline.name,
      category: discipline.category,
      weight: fallbackDiscipline?.weight ?? 1,
      originalOrder: seasonConfig?.originalOrder ?? fallbackDiscipline?.originalOrder,
      displayOrder: seasonConfig?.displayOrder ?? fallbackDiscipline?.displayOrder,
      playerCount: seasonConfig?.playerCount ?? fallbackDiscipline?.playerCount,
      mutator1: seasonConfig?.mutator1 ?? fallbackDiscipline?.mutator1 ?? null,
      mutator2: seasonConfig?.mutator2 ?? fallbackDiscipline?.mutator2 ?? null,
    };
  });

  const rosters: RosterEntry[] = snapshot.activePlayers.map((activePlayer) => ({
    id: activePlayer.id,
    teamId: activePlayer.teamId,
    playerId: activePlayer.playerId,
    contractLength: activePlayer.contractLength,
    salary: activePlayer.salary,
    upkeep: activePlayer.upkeep,
    purchasePrice: activePlayer.purchasePrice,
    currentValue: activePlayer.currentValue,
    roleTag: activePlayer.roleTag,
    joinedSeasonId: activePlayer.joinedSeasonId,
  }));

  const contracts: Contract[] = snapshot.activePlayers.map((activePlayer) => ({
    id: `contract:${activePlayer.id}`,
    playerId: activePlayer.playerId,
    teamId: activePlayer.teamId,
    salary: activePlayer.salary,
    expiresAtMatchday: snapshot.season.currentMatchday + activePlayer.contractLength,
    status: "active",
  }));

  const fixtures: Fixture[] = snapshot.matchdays
    .filter((matchday) => matchday.homeTeamId && matchday.awayTeamId)
    .map((matchday) => ({
      id: `fixture:${matchday.id}`,
      homeTeamId: matchday.homeTeamId as string,
      awayTeamId: matchday.awayTeamId as string,
      matchdayId: matchday.id,
      status: matchday.status === "resolved" ? "resolved" : "scheduled",
    }));

  const gameState: GameState = {
    season: {
      id: snapshot.season.id,
      name: snapshot.season.name,
      year: snapshot.season.year,
      currentMatchday: snapshot.season.currentMatchday,
      matchdayIds: snapshot.matchdays.map((matchday) => matchday.id),
    },
    seasonState: createSeasonState(fixtures, teams.map((team) => team.teamId), snapshot.season.id),
    matchdayState: createMatchdayState(
      snapshot.season.id,
      snapshot.season.currentMatchday,
      snapshot.matchdays.map((matchday) => ({ id: matchday.id, index: matchday.index })),
    ),
    teams,
    teamIdentities,
    players,
    disciplines,
    rosters,
    contracts,
    transferListings: buildTransferListings(players, rosters),
    transferHistory: [],
    logs: [createLog(`Foundation-Read-Modell aus Prisma fuer ${snapshot.season.name} geladen.`)],
    mappingReport: buildMappingReport({
      seed,
      players,
      rosters,
      teams,
    }),
  };

  return {
    save: {
      saveId: snapshot.save.id,
      name: snapshot.save.name,
      status: snapshot.save.status,
      createdAt: snapshot.save.createdAt.toISOString(),
      updatedAt: snapshot.save.updatedAt.toISOString(),
      gameState,
    },
    saves: snapshot.saves.map((save) => ({
      saveId: save.id,
      name: save.name,
      status: save.status,
      createdAt: save.createdAt.toISOString(),
      updatedAt: save.updatedAt.toISOString(),
    })),
    source: "prisma",
  };
}
