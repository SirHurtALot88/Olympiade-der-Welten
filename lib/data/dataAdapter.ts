import playerTeamMappingSource from "@/data/source/player-team-mapping.json";
import teamIdentitiesSource from "@/data/source/team-identities.json";
import teamsSource from "@/data/source/teams.json";
import { attachTeamLogoPath, getMediaMappingSummary, hydrateGameStateMedia } from "@/lib/data/mediaAssets";
import { loadImportedPlayerStats } from "@/lib/data/playerStatsAdapter";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
import { createPlayerBaselinesForPlayers } from "@/lib/players/player-baseline-service";
import { loadSeasonManagementReferenceRows, mapSeasonManagementRowsToTeams } from "@/lib/foundation/season-management-sheet";
import { buildLegacySeedSeasonDisciplineSchedule, buildMatchdaysFromSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import type {
  Contract,
  Discipline,
  Fixture,
  GameLogEntry,
  GameState,
  MappingReport,
  MappingWarning,
  Matchday,
  MatchdayState,
  OlySeedData,
  Player,
  RosterEntry,
  SaveGameState,
  Season,
  SeasonState,
  Team,
  TeamIdentity,
  TransferHistoryEntry,
  TransferListing,
} from "@/lib/data/olyDataTypes";

type MappingRow = {
  playerName: string;
  teamId: string;
  sourceNote?: string;
};

export const foundationSeedSeason: Season = {
  id: "season-1",
  name: "Season 1",
  year: 1,
  currentMatchday: 1,
  matchdayIds: Array.from({ length: 10 }, (_, index) => `matchday-${index + 1}`),
};

export const foundationSeedFixtures: Fixture[] = [
  { id: "fixture-1", homeTeamId: "C-C", awayTeamId: "B-B", matchdayId: "matchday-1", status: "scheduled" },
  { id: "fixture-2", homeTeamId: "R-C", awayTeamId: "T-G", matchdayId: "matchday-2", status: "scheduled" },
];

export const foundationSeedDisciplines: Discipline[] = [
  { id: "tennis", name: "Tennis", category: "mental", weight: 1.02, originalOrder: 13, displayOrder: 16, playerCount: 3, mutator1: null, mutator2: null },
  { id: "mini-dm", name: "Mini DM", category: "power", weight: 1.08, originalOrder: 2, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
  { id: "showcase", name: "Showcase", category: "social", weight: 0.95, originalOrder: 20, displayOrder: 9, playerCount: 5, mutator1: null, mutator2: null },
  { id: "time-trial", name: "Time Trial", category: "speed", weight: 1.06, originalOrder: 7, displayOrder: 6, playerCount: 4, mutator1: null, mutator2: null },
  { id: "spurt", name: "Spurt", category: "speed", weight: 1.08, originalOrder: 8, displayOrder: 20, playerCount: 2, mutator1: null, mutator2: null },
  { id: "basketball", name: "Basketball", category: "social", weight: 1.01, originalOrder: 16, displayOrder: 5, playerCount: 6, mutator1: null, mutator2: null },
  { id: "tdm", name: "TDM", category: "power", weight: 1.04, originalOrder: 1, displayOrder: 17, playerCount: 3, mutator1: null, mutator2: null },
  { id: "battlefield", name: "Battlefield", category: "social", weight: 1.03, originalOrder: 18, displayOrder: 15, playerCount: 2, mutator1: null, mutator2: null },
  { id: "staffel", name: "Staffel", category: "speed", weight: 1.12, originalOrder: 6, displayOrder: 14, playerCount: 3, mutator1: null, mutator2: null },
  { id: "football", name: "Football", category: "social", weight: 1.08, originalOrder: 17, displayOrder: 19, playerCount: 4, mutator1: null, mutator2: null },
  { id: "wettessen", name: "Wettessen", category: "mental", weight: 0.96, originalOrder: 15, displayOrder: 13, playerCount: 5, mutator1: null, mutator2: null },
  { id: "gewichtheben", name: "Gewichtheben", category: "power", weight: 1.14, originalOrder: 3, displayOrder: 7, playerCount: 6, mutator1: null, mutator2: null },
  { id: "speed-schach", name: "Schach", category: "mental", weight: 1.1, originalOrder: 11, displayOrder: 3, playerCount: 2, mutator1: null, mutator2: null },
  { id: "takeshis-castle", name: "Takeshi", category: "mental", weight: 1.07, originalOrder: 12, displayOrder: 11, playerCount: 4, mutator1: null, mutator2: null },
  { id: "hockey", name: "Hockey", category: "power", weight: 1.05, originalOrder: 4, displayOrder: 10, playerCount: 5, mutator1: null, mutator2: null },
  { id: "eiskunstlauf", name: "Eiskunst", category: "social", weight: 1.04, originalOrder: 19, displayOrder: 8, playerCount: 3, mutator1: null, mutator2: null },
  { id: "climbing", name: "Climbing", category: "speed", weight: 1.09, originalOrder: 9, displayOrder: 18, playerCount: 6, mutator1: null, mutator2: null },
  { id: "fechten", name: "Fechten", category: "speed", weight: 1.08, originalOrder: 10, displayOrder: 2, playerCount: 5, mutator1: null, mutator2: null },
  { id: "i-spy", name: "I Spy", category: "mental", weight: 1.01, originalOrder: 14, displayOrder: 4, playerCount: 6, mutator1: null, mutator2: null },
  { id: "breaking", name: "Breaking", category: "power", weight: 1.0, originalOrder: 5, displayOrder: 12, playerCount: 4, mutator1: null, mutator2: null },
];

const foundationSeedDisciplineSchedule = buildLegacySeedSeasonDisciplineSchedule({
  seasonId: foundationSeedSeason.id,
  disciplines: foundationSeedDisciplines,
  matchdayIds: foundationSeedSeason.matchdayIds,
});

export const foundationSeedMatchdays: Matchday[] = buildMatchdaysFromSeasonDisciplineSchedule(
  foundationSeedSeason.id,
  foundationSeedDisciplineSchedule,
  {
    "matchday-1": ["fixture-1"],
    "matchday-2": ["fixture-2"],
  },
);

function createLog(message: string, type: GameLogEntry["type"] = "system"): GameLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function createSeasonState(
  fixtures: Fixture[],
  teamIds: string[],
  seasonId: string,
  disciplines: Discipline[],
  matchdayIds: string[],
): SeasonState {
  return {
    seasonId,
    schedule: fixtures,
    disciplineSchedule: buildLegacySeedSeasonDisciplineSchedule({
      seasonId,
      disciplines,
      matchdayIds,
    }),
    lineupDrafts: [],
    playerGeneratorDrafts: [],
    contractNegotiationDrafts: [],
    transferWishlist: [],
    standings: Object.fromEntries(
      teamIds.map((teamId) => [
        teamId,
        {
          wins: 0,
          losses: 0,
          points: 0,
        },
      ]),
    ),
  };
}

function createMatchdayState(matchdays: Matchday[], currentMatchdayIndex: number): MatchdayState {
  const current = matchdays.find((matchday) => matchday.index === currentMatchdayIndex) ?? matchdays[0];
  return {
    matchdayId: current.id,
    status: "planning",
    pendingTeamIds: [],
    resolvedFixtureIds: [],
  };
}

function createTransferHistory(
  teams: Team[],
  players: Player[],
  rosters: RosterEntry[],
  transferListings: TransferListing[],
): TransferHistoryEntry[] {
  const teamIds = teams.map((team) => team.teamId);
  const playerById = new Map(players.map((player) => [player.id, player]));

  const rosterHistory = rosters.slice(0, 180).flatMap((roster, index) => {
    const player = playerById.get(roster.playerId);
    if (!player) {
      return [];
    }

    const targetTeamId = roster.teamId;
    const fromTeamId = teamIds[(index + 7) % teamIds.length] === targetTeamId ? null : teamIds[(index + 7) % teamIds.length];
    const seasonNumber = 2 + (index % 4);
    const fee = Math.max(1, Number((player.marketValue * (0.35 + (index % 6) * 0.11)).toFixed(2)));
    const salary = Number(player.salaryDemand.toFixed(2));
    const marketValue = Number(player.marketValue.toFixed(2));
    const remainingContractLength = Math.max(1, 4 - (index % 4));
    const happenedAt = new Date(Date.UTC(2023 + seasonNumber, index % 12, 2 + (index % 26), 12, 0, 0)).toISOString();

    return [
      {
        id: `transfer-buy-${index + 1}`,
        playerId: player.id,
        seasonId: `season-${seasonNumber}`,
        seasonLabel: `Season ${seasonNumber}`,
        transferType: "buy" as const,
        fromTeamId,
        toTeamId: targetTeamId,
        fee,
        salary,
        marketValue,
        remainingContractLength,
        happenedAt,
      },
      {
        id: `transfer-sell-${index + 1}`,
        playerId: player.id,
        seasonId: `season-${seasonNumber}`,
        seasonLabel: `Season ${seasonNumber}`,
        transferType: "sell" as const,
        fromTeamId: fromTeamId ?? targetTeamId,
        toTeamId: targetTeamId,
        fee,
        salary,
        marketValue,
        remainingContractLength,
        happenedAt,
      },
    ];
  });

  const listingHistory = transferListings.slice(0, 60).map((listing, index) => {
    const player = playerById.get(listing.playerId);
    if (!player) {
      return null;
    }

    const toTeamId = teamIds[index % teamIds.length] ?? null;
    const seasonNumber = 1 + (index % 5);
    return {
      id: `transfer-market-${index + 1}`,
      playerId: player.id,
      seasonId: `season-${seasonNumber}`,
      seasonLabel: `Season ${seasonNumber}`,
      transferType: "buy" as const,
      fromTeamId: null,
      toTeamId,
      fee: Number(listing.askingPrice.toFixed(2)),
      salary: Number(listing.minimumSalary.toFixed(2)),
      marketValue: Number(player.marketValue.toFixed(2)),
      remainingContractLength: 1 + (index % 3),
      happenedAt: new Date(Date.UTC(2021 + seasonNumber, (index + 3) % 12, 5 + (index % 20), 12, 0, 0)).toISOString(),
    };
  });

  const normalizedListingHistory = listingHistory.filter(
    (entry): entry is NonNullable<(typeof listingHistory)[number]> => entry !== null,
  );

  return [...rosterHistory, ...normalizedListingHistory].sort(
    (left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt),
  );
}

export function loadSourceTeams(): Team[] {
  const baseTeams = structuredClone(teamsSource as Team[]);
  const seasonManagement = mapSeasonManagementRowsToTeams(
    loadSeasonManagementReferenceRows(),
    baseTeams.map((team) => ({ teamId: team.teamId, teamName: team.name })),
  );
  const budgetByTeamId = new Map(
    seasonManagement.mappedRows
      .filter((row) => row.teamId && row.startBudget != null)
      .map((row) => [row.teamId as string, row.startBudget as number] as const),
  );

  return baseTeams.map((team) =>
    attachTeamLogoPath({
      ...team,
      budget: budgetByTeamId.get(team.teamId) ?? team.budget,
      cash: budgetByTeamId.get(team.teamId) ?? team.cash,
      identityId: team.teamId,
    }),
  );
}

export function loadSourceTeamIdentities(): TeamIdentity[] {
  return structuredClone(teamIdentitiesSource as TeamIdentity[]);
}

export function loadSourcePlayerTeamMapping(): MappingRow[] {
  return structuredClone((playerTeamMappingSource as { rows: MappingRow[] }).rows);
}

export function summarizeTeamRosterCoverage(teams: Team[], players: Player[], rosters: RosterEntry[]) {
  const mappedPlayerIds = new Set(rosters.map((roster) => roster.playerId));
  return {
    unmappedPlayers: players.filter((player) => !mappedPlayerIds.has(player.id)).map((player) => player.name),
    teamsWithoutPlayers: teams
      .filter((team) => !rosters.some((roster) => roster.teamId === team.teamId))
      .map((team) => team.teamId),
  };
}

export function buildRosterSeedData(): OlySeedData {
  const teams = loadSourceTeams();
  const teamIdentities = loadSourceTeamIdentities();
  const players = loadImportedPlayerStats();
  const mappingRows = loadSourcePlayerTeamMapping();

  const warnings: MappingWarning[] = [];
  const mediaSummary = getMediaMappingSummary();

  const playersByExactName = new Map(players.map((player) => [player.name, player]));
  const playersByNormalizedName = new Map<string, Player[]>();
  for (const player of players) {
    const key = normalizeName(player.name);
    const list = playersByNormalizedName.get(key) ?? [];
    list.push(player);
    playersByNormalizedName.set(key, list);
  }

  const teamIds = new Set<string>();
  const duplicateTeamCodes: string[] = [];
  for (const team of teams) {
    if (teamIds.has(team.teamId)) {
      duplicateTeamCodes.push(team.teamId);
    }
    teamIds.add(team.teamId);
  }

  const rosters: RosterEntry[] = [];
  const contracts: Contract[] = [];
  const duplicateMappedPlayers: string[] = [];
  const mappingRowsWithoutPlayerMatch: string[] = [];
  const unknownTeamCodes: string[] = [];
  const mappedPlayerIds = new Set<string>();

  mappingRows.forEach((row, index) => {
    if (!teamIds.has(row.teamId)) {
      unknownTeamCodes.push(row.teamId);
      warnings.push({
        type: "unknownTeamCode",
        message: `Mapping fuer ${row.playerName} verweist auf unbekannten Teamcode ${row.teamId}.`,
        playerName: row.playerName,
        teamId: row.teamId,
      });
      return;
    }

    let player = playersByExactName.get(row.playerName);
    if (!player) {
      const normalizedMatches = playersByNormalizedName.get(normalizeName(row.playerName)) ?? [];
      if (normalizedMatches.length === 1) {
        player = normalizedMatches[0];
      }
    }

    if (!player) {
      mappingRowsWithoutPlayerMatch.push(row.playerName);
      warnings.push({
        type: "mappingRowWithoutPlayerMatch",
        message: `Kein importierter Spieler passend zu ${row.playerName} gefunden.`,
        playerName: row.playerName,
        teamId: row.teamId,
      });
      return;
    }

    if (mappedPlayerIds.has(player.id)) {
      duplicateMappedPlayers.push(player.name);
      warnings.push({
        type: "duplicateMappedPlayer",
        message: `${player.name} wurde mehrfach in der Mapping-Quelle zugeordnet.`,
        playerName: player.name,
        teamId: row.teamId,
      });
      return;
    }

    mappedPlayerIds.add(player.id);
    const roleTag = index % 4 === 3 ? "bench" : "starter";
    rosters.push({
      id: `roster-${index + 1}`,
      teamId: row.teamId,
      playerId: player.id,
      contractLength: 2,
      salary: player.salaryDemand,
      upkeep: player.salaryDemand,
      purchasePrice: player.marketValue,
      currentValue: player.marketValue,
      roleTag,
      joinedSeasonId: foundationSeedSeason.id,
    });
    contracts.push({
      id: `contract-${index + 1}`,
      playerId: player.id,
      teamId: row.teamId,
      salary: player.salaryDemand,
      expiresAtMatchday: 8,
      status: "active",
    });
  });

  const transferListings: TransferListing[] = players
    .filter((player) => !mappedPlayerIds.has(player.id))
    .slice(0, 120)
    .map((player, index) => ({
      id: `listing-${index + 1}`,
      playerId: player.id,
      sellerTeamId: null,
      askingPrice: player.marketValue,
      minimumSalary: player.salaryDemand,
      status: "open",
      createdAt: "2026-06-01T10:00:00.000Z",
    }));

  const { unmappedPlayers, teamsWithoutPlayers } = summarizeTeamRosterCoverage(teams, players, rosters);
  const transferHistory = createTransferHistory(teams, players, rosters, transferListings);

  for (const playerName of unmappedPlayers.slice(0, 200)) {
    warnings.push({
      type: "playerWithoutTeam",
      message: `${playerName} hat aktuell keine Teamzuordnung.`,
      playerName,
    });
  }

  for (const teamId of teamsWithoutPlayers) {
    warnings.push({
      type: "teamWithoutPlayers",
      message: `Team ${teamId} hat aktuell kein Roster.`,
      teamId,
    });
  }

  const mappingReport: MappingReport = {
    mappingSource: `data/source/player-team-mapping.json + data/generated/oly-player-stats.json + ${mediaSummary.mappedPlayerPortraits} Spielerbilder`,
    teamSource: `data/source/teams.json + data/source/team-identities.json (season-management-sheet defaults) + ${mediaSummary.mappedTeamLogos} Teamlogos`,
    generatedAt: new Date().toISOString(),
    processedMappingRows: mappingRows.length,
    importedPlayerCount: players.length,
    matchedRosterCount: rosters.length,
    teamCount: teams.length,
    unmappedPlayers,
    teamsWithoutPlayers,
    mappingRowsWithoutPlayerMatch,
    duplicateMappedPlayers,
    unknownTeamCodes: [...new Set(unknownTeamCodes)],
    duplicateTeamCodes: [...new Set(duplicateTeamCodes)],
    warnings,
  };

  return {
    teamIdentities,
    teams,
    disciplines: foundationSeedDisciplines,
    players,
    rosters,
    contracts,
    transferListings,
    transferHistory,
    season: foundationSeedSeason,
    matchdays: foundationSeedMatchdays,
    fixtures: foundationSeedFixtures,
    mappingReport,
  };
}

export function loadSeedData(): OlySeedData {
  return structuredClone(buildRosterSeedData());
}

export function loadFreshSeasonOneSeedData(): OlySeedData {
  const seed = loadSeedData();
  const teamOptById = new Map(seed.teamIdentities.map((identity) => [identity.teamId, Math.round(identity.playerOpt)]));
  return {
    ...seed,
    teams: seed.teams.map((team) => ({
      ...team,
      rosterLimit: Math.max(team.rosterLimit, Math.min(teamOptById.get(team.teamId) ?? team.rosterLimit, 12)),
    })),
    transferHistory: [],
  };
}

export function createGameStateFromSeed(input: OlySeedData = loadSeedData()): GameState {
  const data = structuredClone(input);
  const hydrated = hydrateGameStateMedia({
    season: data.season,
    seasonState: {
      ...createSeasonState(
        data.fixtures,
        data.teams.map((team) => team.teamId),
        data.season.id,
        data.disciplines,
        data.season.matchdayIds,
      ),
      teamControlSettings: buildTeamControlSettingsMap(data.teams),
      teamStrategyProfiles: buildTeamStrategyProfileMap(data.teams, data.teamIdentities),
    },
    matchdayState: createMatchdayState(data.matchdays, data.season.currentMatchday),
    teams: data.teams,
    teamIdentities: data.teamIdentities,
    players: data.players,
    disciplines: data.disciplines,
    rosters: data.rosters,
    contracts: data.contracts,
    transferListings: data.transferListings,
    transferHistory: data.transferHistory,
    logs: [createLog(`Seed-GameState fuer ${data.season.name} erzeugt.`)],
    mappingReport: data.mappingReport,
  });
  return {
    ...hydrated,
    playerBaselines: createPlayerBaselinesForPlayers(hydrated.players, { source: "seed" }),
  };
}

export function createSaveGameState(saveId = "save-dev-1", input?: OlySeedData): SaveGameState {
  const now = new Date().toISOString();
  return {
    saveId,
    createdAt: now,
    updatedAt: now,
    gameState: createGameStateFromSeed(input),
  };
}
