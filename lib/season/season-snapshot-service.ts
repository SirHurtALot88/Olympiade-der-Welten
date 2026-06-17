import type {
  DisciplineCategory,
  GameState,
  SeasonSnapshotPlayerPerformanceRecord,
  SeasonSnapshotRecord,
  SeasonSnapshotTeamRecord,
  SeasonSnapshotTransferRecord,
} from "@/lib/data/olyDataTypes";
import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  buildAllTimeTableFromSnapshots,
  type SeasonSnapshotAllTimeRow,
} from "@/lib/season/season-snapshot-helpers";
export { buildAllTimeTableFromSnapshots } from "@/lib/season/season-snapshot-helpers";

export const SEASON_SNAPSHOT_CONFIRM_TOKEN = "CREATE_LOCAL_SEASON_SNAPSHOT";

export type SeasonSnapshotSource = "sqlite" | "prisma";

export type SeasonSnapshotCoverage = {
  totalMatchdays: number;
  resultAppliedMatchdays: number;
  standingsAppliedMatchdays: number;
  cashAppliedMatchdays: number;
  completedMatchdayIds: string[];
  missingResultMatchdayIds: string[];
  missingStandingsMatchdayIds: string[];
  missingCashMatchdayIds: string[];
};

export type SeasonSnapshotBuildResult = {
  ok: boolean;
  readOnly: true;
  source: SeasonSnapshotSource;
  dryRun: true;
  canCreate: boolean;
  seasonCompleted: boolean;
  duplicateDetected: boolean;
  sourceStatus: "mapped" | "partial" | "missing_source";
  saveId: string | null;
  seasonId: string;
  snapshot: SeasonSnapshotRecord;
  existingSnapshot: SeasonSnapshotRecord | null;
  allTimeTable: SeasonSnapshotAllTimeRow[];
  coverage: SeasonSnapshotCoverage;
  warnings: string[];
  blockingReasons: string[];
};

export type CreateSeasonSnapshotParams = {
  saveId: string;
  seasonId?: string;
  source?: SeasonSnapshotSource;
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceCreate?: boolean;
  replaceExisting?: boolean;
};

export type CreateSeasonSnapshotResult = SeasonSnapshotBuildResult & {
  applied: boolean;
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeSource(source?: string): SeasonSnapshotSource {
  return source === "prisma" ? "prisma" : "sqlite";
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    persistence.getSaveById(saveId) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error(`Local save ${saveId} could not be loaded for season snapshots.`);
  }

  return save;
}

function getRosterMarketValue(
  gameState: GameState,
  playerId: string,
  currentValue?: number | null,
  purchasePrice?: number | null,
) {
  if (currentValue != null && Number.isFinite(currentValue)) {
    return currentValue;
  }
  if (purchasePrice != null && Number.isFinite(purchasePrice)) {
    return purchasePrice;
  }
  const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
  if (!player) {
    return null;
  }
  return getImportedPlayerDisplayMarketValue(player);
}

function buildDisciplineCategoryMap(gameState: GameState) {
  return new Map<string, DisciplineCategory>(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );
}

function buildSeasonCoverage(gameState: GameState, seasonId: string): SeasonSnapshotCoverage {
  const matchdayIds = gameState.season.id === seasonId ? gameState.season.matchdayIds : [];
  const resultApplied = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === seasonId && result.status === "preview_applied")
      .map((result) => result.matchdayId),
  );
  const standingsApplied = new Set(
    (gameState.seasonState.standingsApplyLogs ?? [])
      .filter((log) => log.seasonId === seasonId)
      .map((log) => log.matchdayId),
  );
  const cashApplied = new Set(
    (gameState.seasonState.cashPrizeApplyLogs ?? [])
      .filter((log) => log.seasonId === seasonId)
      .map((log) => log.matchdayId),
  );
  const hasSeasonEndCashApply = cashApplied.size > 0;

  return {
    totalMatchdays: matchdayIds.length,
    resultAppliedMatchdays: matchdayIds.filter((matchdayId) => resultApplied.has(matchdayId)).length,
    standingsAppliedMatchdays: matchdayIds.filter((matchdayId) => standingsApplied.has(matchdayId)).length,
    cashAppliedMatchdays: hasSeasonEndCashApply
      ? matchdayIds.length
      : matchdayIds.filter((matchdayId) => cashApplied.has(matchdayId)).length,
    completedMatchdayIds: matchdayIds.filter(
      (matchdayId) =>
        resultApplied.has(matchdayId) && standingsApplied.has(matchdayId),
    ),
    missingResultMatchdayIds: matchdayIds.filter((matchdayId) => !resultApplied.has(matchdayId)),
    missingStandingsMatchdayIds: matchdayIds.filter((matchdayId) => !standingsApplied.has(matchdayId)),
    missingCashMatchdayIds: hasSeasonEndCashApply ? [] : matchdayIds.filter((matchdayId) => !cashApplied.has(matchdayId)),
  };
}

function buildSeasonResultIdSet(gameState: GameState, seasonId: string) {
  return new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === seasonId && result.status === "preview_applied")
      .map((result) => result.id),
  );
}

function buildSnapshotId(seasonId: string) {
  return `season-snapshot__${seasonId}`;
}

function buildSeasonSnapshotRecord(gameState: GameState, seasonId: string = gameState.season.id): SeasonSnapshotRecord {
  const disciplineCategoryById = buildDisciplineCategoryMap(gameState);
  const seasonPointsLedger = buildSeasonPointsLedger(gameState, seasonId);
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const seasonResultIds = buildSeasonResultIdSet(gameState, seasonId);
  const coverage = buildSeasonCoverage(gameState, seasonId);
  const seasonMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.seasonId === seasonId && result.status === "preview_applied",
  );
  const seasonDisciplineResults = (gameState.seasonState.disciplineResults ?? []).filter((result) =>
    seasonResultIds.has(result.matchdayResultId),
  );
  const seasonPlayerPerformances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((result) =>
    seasonResultIds.has(result.matchdayResultId),
  );
  const seasonDisciplineHighlights = (gameState.seasonState.disciplineHighlights ?? []).filter((highlight) =>
    seasonResultIds.has(highlight.matchdayResultId),
  );
  const seasonTransfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const warnings: string[] = [];

  if (coverage.totalMatchdays === 0) {
    warnings.push("No matchdays are configured for this season.");
  }
  if (coverage.missingResultMatchdayIds.length > 0) {
    warnings.push(`Missing result snapshots for: ${coverage.missingResultMatchdayIds.join(", ")}.`);
  }
  if (coverage.missingStandingsMatchdayIds.length > 0) {
    warnings.push(`Missing standings apply logs for: ${coverage.missingStandingsMatchdayIds.join(", ")}.`);
  }
  if (coverage.missingCashMatchdayIds.length > 0) {
    warnings.push(`Missing cash apply logs for: ${coverage.missingCashMatchdayIds.join(", ")}.`);
  }

  const finalStandings: SeasonSnapshotTeamRecord[] = [...gameState.teams]
    .map((team) => {
      const standing = gameState.seasonState.standings[team.teamId] ?? null;
      const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const teamResults = seasonDisciplineResults.filter((entry) => entry.teamId === team.teamId);
      const teamTransfers = seasonTransfers.filter(
        (entry) => entry.fromTeamId === team.teamId || entry.toTeamId === team.teamId,
      );
      const teamPointSummary = seasonPointsLedger.teamSummariesByTeamId.get(team.teamId) ?? null;
      const transferBuyCount = teamTransfers.filter(
        (entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId,
      ).length;
      const transferSellCount = teamTransfers.filter(
        (entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId,
      ).length;
      const rawScoreByArea = teamResults.reduce(
        (totals, entry) => {
          const category = disciplineCategoryById.get(entry.disciplineId);
          if (category === "power") totals.pow += entry.totalScore;
          if (category === "speed") totals.spe += entry.totalScore;
          if (category === "mental") totals.men += entry.totalScore;
          if (category === "social") totals.soc += entry.totalScore;
          return totals;
        },
        { pow: 0, spe: 0, men: 0, soc: 0 },
      );
      const disciplinePointsByArea = teamPointSummary
        ? {
            pow: teamPointSummary.pointsByArea.power,
            spe: teamPointSummary.pointsByArea.speed,
            men: teamPointSummary.pointsByArea.mental,
            soc: teamPointSummary.pointsByArea.social,
          }
        : rawScoreByArea;
      const disciplinePoints =
        teamResults.length > 0
          ? roundValue(
              teamPointSummary?.totalPoints ??
                teamResults.reduce((sum, entry) => sum + entry.totalScore, 0),
              1,
            )
          : null;
      const salaryEnd =
        roster.length > 0 ? roundValue(roster.reduce((sum, entry) => sum + entry.salary, 0), 2) : 0;
      const marketValueEnd =
        roster.length > 0
          ? roundValue(
              roster.reduce(
                (sum, entry) =>
                  sum + (getRosterMarketValue(gameState, entry.playerId, entry.currentValue, entry.purchasePrice) ?? 0),
                0,
              ),
              2,
            )
          : 0;
      const transferBuyTotal = teamTransfers
        .filter((entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId)
        .reduce((sum, entry) => sum + entry.fee, 0);
      const transferSellTotal = teamTransfers
        .filter((entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId)
        .reduce((sum, entry) => sum + entry.fee, 0);
      const rank = standing?.rank ?? null;

      return {
        teamId: team.teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        rank,
        points: standing?.points ?? null,
        disciplinePoints,
        disciplinePointsByArea: {
          pow: teamResults.length > 0 ? roundValue(disciplinePointsByArea.pow, 1) : null,
          spe: teamResults.length > 0 ? roundValue(disciplinePointsByArea.spe, 1) : null,
          men: teamResults.length > 0 ? roundValue(disciplinePointsByArea.men, 1) : null,
          soc: teamResults.length > 0 ? roundValue(disciplinePointsByArea.soc, 1) : null,
        },
        cashEnd: team.cash ?? null,
        rosterEnd: roster.length,
        rosterCountEnd: roster.length,
        salaryEnd,
        salaryTotalEnd: salaryEnd,
        marketValueEnd,
        marketValueTotalEnd: marketValueEnd,
        transferCount: teamTransfers.length,
        transferBuyCount,
        transferSellCount,
        transferNet: roundValue(transferSellTotal - transferBuyTotal, 2),
        isGold: rank === 1,
        isSilver: rank === 2,
        isBronze: rank === 3,
        isTop5: rank != null ? rank <= 5 : false,
        isTop10: rank != null ? rank <= 10 : false,
        avgRankContribution: rank,
      };
    })
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
    });

  const rosterByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  const playerPerformances: SeasonSnapshotPlayerPerformanceRecord[] = Array.from(
    seasonPlayerPerformances.reduce((map, entry) => {
      const player = gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      const team = gameState.teams.find((candidate) => candidate.teamId === entry.teamId) ?? null;
      const disciplineLabel =
        gameState.disciplines.find((discipline) => discipline.id === entry.disciplineId)?.name ?? entry.disciplineId;
      const current = map.get(entry.playerId) ?? {
        playerId: entry.playerId,
        playerName: player?.name ?? entry.playerId,
        teamId: team?.teamId ?? null,
        teamCode: team?.shortCode ?? null,
        teamName: team?.name ?? null,
        appearances: 0,
        totalContribution: 0,
        totalFinalScore: 0,
        totalPoints: 0,
        top10Count: 0,
        mvpCount: 0,
        bestDisciplineId: null as string | null,
        bestDisciplineLabel: null as string | null,
        bestDisciplineScore: null as number | null,
        teamBreakdown: new Map<string, { teamId: string | null; teamCode: string | null; teamName: string | null; appearances: number; totalPoints: number }>(),
        disciplineBreakdown: new Map<string, { disciplineId: string; disciplineName: string; appearances: number; totalContribution: number; totalFinalScore: number }>(),
      };
      const normalizedPoints = seasonPointsLedger.pointEntriesByPerformanceId.get(entry.id)?.points ?? entry.scoreContribution;

      current.appearances += 1;
      current.totalContribution += normalizedPoints;
      current.totalFinalScore += entry.finalPlayerScore;
      current.totalPoints += normalizedPoints;
      current.top10Count += entry.isTop10 ? 1 : 0;
      current.mvpCount += entry.isMvpCandidate ? 1 : 0;
      if ((current.bestDisciplineScore ?? Number.NEGATIVE_INFINITY) < entry.finalPlayerScore) {
        current.bestDisciplineScore = entry.finalPlayerScore;
        current.bestDisciplineId = entry.disciplineId;
        current.bestDisciplineLabel = disciplineLabel;
      }

      const breakdown = current.disciplineBreakdown.get(entry.disciplineId) ?? {
        disciplineId: entry.disciplineId,
        disciplineName: disciplineLabel,
        appearances: 0,
        totalContribution: 0,
        totalFinalScore: 0,
      };
      breakdown.appearances += 1;
      breakdown.totalContribution += normalizedPoints;
      breakdown.totalFinalScore += entry.finalPlayerScore;
      current.disciplineBreakdown.set(entry.disciplineId, breakdown);

      const teamBreakdownKey = entry.teamId ?? "unknown-team";
      const teamBreakdown = current.teamBreakdown.get(teamBreakdownKey) ?? {
        teamId: team?.teamId ?? entry.teamId ?? null,
        teamCode: team?.shortCode ?? null,
        teamName: team?.name ?? null,
        appearances: 0,
        totalPoints: 0,
      };
      teamBreakdown.appearances += 1;
      teamBreakdown.totalPoints += normalizedPoints;
      current.teamBreakdown.set(teamBreakdownKey, teamBreakdown);

      current.teamId = team?.teamId ?? current.teamId;
      current.teamCode = team?.shortCode ?? current.teamCode;
      current.teamName = team?.name ?? current.teamName;
      map.set(entry.playerId, current);
      return map;
    }, new Map<string, {
      playerId: string;
      playerName: string;
      teamId: string | null;
      teamCode: string | null;
      teamName: string | null;
      appearances: number;
      totalContribution: number;
      totalFinalScore: number;
      totalPoints: number;
      top10Count: number;
      mvpCount: number;
      bestDisciplineId: string | null;
      bestDisciplineLabel: string | null;
      bestDisciplineScore: number | null;
      teamBreakdown: Map<string, { teamId: string | null; teamCode: string | null; teamName: string | null; appearances: number; totalPoints: number }>;
      disciplineBreakdown: Map<string, { disciplineId: string; disciplineName: string; appearances: number; totalContribution: number; totalFinalScore: number }>;
    }>()).values(),
  )
    .map((entry) => {
      const player = gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      const rosterEntry = rosterByPlayerId.get(entry.playerId) ?? null;
      const rating = playerRatingsById.get(entry.playerId) ?? null;
      const economy = player
        ? resolvePlayerEconomyContract({ playerId: player.id, player, rosterEntry })
        : null;

      return {
        playerId: entry.playerId,
        playerName: entry.playerName,
        teamId: entry.teamId,
        teamCode: entry.teamCode,
        teamName: entry.teamName,
        seasonId,
        appearances: entry.appearances,
        totalContribution: roundValue(entry.totalContribution, 1),
        totalPoints: roundValue(entry.totalPoints, 1),
        averageContribution: roundValue(entry.totalContribution / entry.appearances, 1),
        averageFinalScore: roundValue(entry.totalFinalScore / entry.appearances, 1),
        powPoints: rating?.ppPow ?? null,
        spePoints: rating?.ppSpe ?? null,
        menPoints: rating?.ppMen ?? null,
        socPoints: rating?.ppSoc ?? null,
        ovr: rating?.ovrNormalized ?? null,
        ovrRank: rating?.ovrRank ?? null,
        pps: rating?.ppsSeason ?? roundValue(entry.totalPoints, 1),
        ppsRank: rating?.ppsSeasonRank ?? null,
        mvs: rating?.mvs ?? null,
        mvsRank: rating?.mvsRank ?? null,
        marketValue: economy?.marketValue ?? rosterEntry?.currentValue ?? rosterEntry?.purchasePrice ?? null,
        salary: economy?.salary ?? rosterEntry?.salary ?? null,
        contractLength: economy?.contractLength ?? rosterEntry?.contractLength ?? null,
        top10Count: entry.top10Count,
        mvpCount: entry.mvpCount,
        bestDisciplineId: entry.bestDisciplineId,
        bestDisciplineLabel: entry.bestDisciplineLabel,
        bestDisciplineScore: entry.bestDisciplineScore != null ? roundValue(entry.bestDisciplineScore, 1) : null,
        teamBreakdown: Array.from(entry.teamBreakdown.values())
          .map((teamEntry) => ({
            teamId: teamEntry.teamId,
            teamCode: teamEntry.teamCode,
            teamName: teamEntry.teamName,
            appearances: teamEntry.appearances,
            totalPoints: roundValue(teamEntry.totalPoints, 1),
          }))
          .sort((left, right) => (right.totalPoints ?? Number.NEGATIVE_INFINITY) - (left.totalPoints ?? Number.NEGATIVE_INFINITY)),
        disciplineBreakdown: Array.from(entry.disciplineBreakdown.values())
          .map((discipline) => ({
            disciplineId: discipline.disciplineId,
            disciplineName: discipline.disciplineName,
            appearances: discipline.appearances,
            totalContribution: roundValue(discipline.totalContribution, 1),
            averageContribution: roundValue(discipline.totalContribution / discipline.appearances, 1),
            averageFinalScore: roundValue(discipline.totalFinalScore / discipline.appearances, 1),
          }))
          .sort((left, right) => (right.totalContribution ?? Number.NEGATIVE_INFINITY) - (left.totalContribution ?? Number.NEGATIVE_INFINITY)),
        warnings: entry.teamId == null ? ["player_team_missing_in_snapshot"] : [],
      };
    })
    .sort((left, right) => {
      if ((right.totalContribution ?? Number.NEGATIVE_INFINITY) !== (left.totalContribution ?? Number.NEGATIVE_INFINITY)) {
        return (right.totalContribution ?? Number.NEGATIVE_INFINITY) - (left.totalContribution ?? Number.NEGATIVE_INFINITY);
      }
      return left.playerName.localeCompare(right.playerName, "de");
    });

  const transferSnapshots: SeasonSnapshotTransferRecord[] = seasonTransfers
    .map((entry) => ({
      transferId: entry.id,
      seasonId: entry.seasonId,
      matchdayId: entry.matchdayId ?? null,
      phase: entry.phase ?? null,
      playerId: entry.playerId,
      playerName: gameState.players.find((player) => player.id === entry.playerId)?.name ?? entry.playerId,
      fromTeamId: entry.fromTeamId,
      fromTeamName: gameState.teams.find((team) => team.teamId === entry.fromTeamId)?.name ?? null,
      toTeamId: entry.toTeamId,
      toTeamName: gameState.teams.find((team) => team.teamId === entry.toTeamId)?.name ?? null,
      type: entry.transferType,
      amount: entry.fee,
      salary: entry.salary,
      marketValue: entry.marketValue,
      contractLength: entry.remainingContractLength,
      source: "local_transfer_history",
    }))
    .sort((left, right) => left.transferId.localeCompare(right.transferId, "de"));

  const seasonCompleted =
    coverage.totalMatchdays > 0 &&
    coverage.resultAppliedMatchdays === coverage.totalMatchdays &&
    coverage.standingsAppliedMatchdays === coverage.totalMatchdays;
  const sourceStatus: SeasonSnapshotRecord["sourceStatus"] = seasonCompleted
    ? "mapped"
    : coverage.completedMatchdayIds.length > 0
      ? "partial"
      : "missing_source";
  const archivedAt = new Date().toISOString();

  return {
    snapshotId: buildSnapshotId(seasonId),
    seasonId,
    seasonName: gameState.season.name,
    createdAt: archivedAt,
    archivedAt,
    source: "local",
    status: seasonCompleted ? "completed" : coverage.completedMatchdayIds.length > 0 ? "partial" : "dry_run",
    sourceStatus,
    finalStandings,
    teamSnapshots: finalStandings,
    matchdayResults: structuredClone(seasonMatchdayResults),
    disciplineResults: structuredClone(seasonDisciplineResults),
    playerDisciplinePerformances: structuredClone(seasonPlayerPerformances),
    disciplineHighlights: structuredClone(seasonDisciplineHighlights),
    playerPerformances,
    playerPerformanceSnapshots: playerPerformances,
    transferSnapshots,
    warnings,
  };
}

export function buildSeasonSnapshot(gameState: GameState, seasonId: string = gameState.season.id): SeasonSnapshotRecord {
  return buildSeasonSnapshotRecord(gameState, seasonId);
}

export function upsertSeasonSnapshotRecord(
  snapshots: SeasonSnapshotRecord[] | undefined,
  snapshot: SeasonSnapshotRecord,
): SeasonSnapshotRecord[] {
  const existing = snapshots ?? [];
  const next = existing.filter((entry) => entry.seasonId !== snapshot.seasonId);
  next.push(snapshot);
  return next.sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de"));
}

export function getSeasonSnapshots(gameState: GameState) {
  return [...(gameState.seasonState.seasonSnapshots ?? [])].sort((left, right) =>
    right.seasonId.localeCompare(left.seasonId, "de"),
  );
}

export function getLatestSeasonSnapshot(gameState: GameState) {
  return getSeasonSnapshots(gameState)[0] ?? null;
}

export function buildSeasonSnapshotDryRun(
  gameState: GameState,
  input?: {
    saveId?: string | null;
    seasonId?: string;
  },
): SeasonSnapshotBuildResult {
  const seasonId = input?.seasonId ?? gameState.season.id;
  const coverage = buildSeasonCoverage(gameState, seasonId);
  const snapshot = buildSeasonSnapshotRecord(gameState, seasonId);
  const existingSnapshot =
    (gameState.seasonState.seasonSnapshots ?? []).find((entry) => entry.seasonId === seasonId) ?? null;
  const seasonCompleted =
    coverage.totalMatchdays > 0 &&
    coverage.resultAppliedMatchdays === coverage.totalMatchdays &&
    coverage.standingsAppliedMatchdays === coverage.totalMatchdays;
  const warnings = Array.from(new Set(snapshot.warnings));
  const blockingReasons: string[] = [];

  if (!seasonCompleted) {
    blockingReasons.push("season_not_completed_for_snapshot");
  }
  if (existingSnapshot) {
    blockingReasons.push("duplicate_season_snapshot");
  }

  return {
    ok: blockingReasons.length === 0,
    readOnly: true,
    source: "sqlite",
    dryRun: true,
    canCreate: blockingReasons.length === 0,
    seasonCompleted,
    duplicateDetected: existingSnapshot != null,
    sourceStatus: snapshot.sourceStatus ?? "missing_source",
    saveId: input?.saveId ?? null,
    seasonId,
    snapshot: {
      ...snapshot,
      status: seasonCompleted ? "completed" : "dry_run",
    },
    existingSnapshot,
    allTimeTable: buildAllTimeTableFromSnapshots(
      existingSnapshot
        ? upsertSeasonSnapshotRecord(gameState.seasonState.seasonSnapshots, snapshot)
        : [...(gameState.seasonState.seasonSnapshots ?? []), snapshot],
      gameState.teams,
    ),
    coverage,
    warnings,
    blockingReasons,
  };
}

export function createSeasonSnapshot(
  params: CreateSeasonSnapshotParams,
  persistence: PersistenceService = createPersistenceService(),
): CreateSeasonSnapshotResult {
  const source = normalizeSource(params.source);
  if (source === "prisma") {
    return {
      ok: false,
      readOnly: true,
      source,
      dryRun: true,
      canCreate: false,
      seasonCompleted: false,
      duplicateDetected: false,
      sourceStatus: "missing_source",
      saveId: params.saveId,
      seasonId: params.seasonId ?? "season-1",
      snapshot: {
        snapshotId: buildSnapshotId(params.seasonId ?? "season-1"),
        seasonId: params.seasonId ?? "season-1",
        seasonName: params.seasonId ?? "season-1",
        createdAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
        source: "local",
        status: "dry_run",
        sourceStatus: "missing_source",
        finalStandings: [],
        teamSnapshots: [],
        matchdayResults: [],
        disciplineResults: [],
        playerDisciplinePerformances: [],
        disciplineHighlights: [],
        playerPerformances: [],
        playerPerformanceSnapshots: [],
        transferSnapshots: [],
        warnings: [],
      },
      existingSnapshot: null,
      allTimeTable: [],
      coverage: {
        totalMatchdays: 0,
        resultAppliedMatchdays: 0,
        standingsAppliedMatchdays: 0,
        cashAppliedMatchdays: 0,
        completedMatchdayIds: [],
        missingResultMatchdayIds: [],
        missingStandingsMatchdayIds: [],
        missingCashMatchdayIds: [],
      },
      warnings: [],
      blockingReasons: ["Prisma/Supabase mode is read-only. Season snapshots are only available on the local SQLite save."],
      applied: false,
    };
  }

  const dryRun = params.execute ? false : params.dryRun ?? true;
  const save = resolveLocalSave(persistence, params.saveId);
  const preview = buildSeasonSnapshotDryRun(save.gameState, {
    saveId: save.saveId,
    seasonId: params.seasonId ?? save.gameState.season.id,
  });
  const blockingReasons = [...preview.blockingReasons];
  const forceCreate = params.forceCreate === true;
  const replaceExisting = params.replaceExisting === true;

  if (preview.duplicateDetected && replaceExisting) {
    const duplicateIndex = blockingReasons.indexOf("duplicate_season_snapshot");
    if (duplicateIndex >= 0) {
      blockingReasons.splice(duplicateIndex, 1);
    }
  }
  if (!preview.seasonCompleted && forceCreate) {
    const seasonIncompleteIndex = blockingReasons.indexOf("season_not_completed_for_snapshot");
    if (seasonIncompleteIndex >= 0) {
      blockingReasons.splice(seasonIncompleteIndex, 1);
    }
  }

  if (dryRun) {
    return {
      ...preview,
      ok: blockingReasons.length === 0,
      canCreate: blockingReasons.length === 0,
      blockingReasons,
      applied: false,
    };
  }

  if (params.confirm !== SEASON_SNAPSHOT_CONFIRM_TOKEN) {
    return {
      ...preview,
      ok: false,
      canCreate: false,
      blockingReasons: ["Missing explicit confirm token for season snapshot execute."],
      applied: false,
      readOnly: true,
      dryRun: true,
    };
  }

  if (blockingReasons.length > 0) {
    return {
      ...preview,
      ok: false,
      canCreate: false,
      blockingReasons,
      applied: false,
    };
  }

  const nextSnapshots = upsertSeasonSnapshotRecord(save.gameState.seasonState.seasonSnapshots, {
    ...preview.snapshot,
    status: preview.seasonCompleted ? "completed" : "partial",
  });

  persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      seasonSnapshots: nextSnapshots,
    },
  });

  const refreshed = resolveLocalSave(persistence, save.saveId);
  const latest = (refreshed.gameState.seasonState.seasonSnapshots ?? []).find(
    (entry) => entry.seasonId === preview.seasonId,
  ) ?? preview.snapshot;

  return {
    ...preview,
    ok: true,
    canCreate: true,
    blockingReasons: [],
    applied: true,
    existingSnapshot: latest,
    allTimeTable: buildAllTimeTableFromSnapshots(refreshed.gameState.seasonState.seasonSnapshots, refreshed.gameState.teams),
    snapshot: latest,
  };
}
