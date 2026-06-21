import fs from "node:fs";
import path from "node:path";

import type {
  GameState,
  Player,
  PlayerGeneratorAttributeName,
  PlayerProgressionSpendEventRecord,
  RosterEntry,
  SeasonSnapshotRecord,
} from "@/lib/data/olyDataTypes";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiency, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildPlayerDevelopmentLevelupModel } from "@/lib/training/training-levelup-service";

type AuditPlayerRow = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamCode: string;
  promisedRole: string;
  roleStatus: string;
  appearances: number;
  pps: number | null;
  mvs: number | null;
  ovr: number | null;
  earnedXP: number;
  maintenanceXP: number;
  regressionPressure: number;
  netDevelopmentXP: number;
  spendableXP: number;
  materializedXpEarned: number;
  xpSpent: number;
  levelUps: number;
  trainingPoints: number;
  attributeDeltaTotal: number;
  disciplineDeltaTotal: number;
  projectedRegression: boolean;
  powDelta: number | null;
  speDelta: number | null;
  menDelta: number | null;
  socDelta: number | null;
  caPoGap: number | null;
  trainingTier: string;
  devRoute: string;
  regressionRisk: string;
  realRegression: boolean;
  statusBucket: "positive" | "strong_positive" | "stagnation" | "regression_risk" | "real_regression";
  warnings: string[];
};

const DEFAULT_DRY_RUN_SAVE = path.join(
  process.cwd(),
  "outputs",
  "admin-season-simulation",
  "runs",
  "admin-season-sim-1781701467405-535415ed.dryrun-save.json",
);

const ATTRIBUTE_KEYS: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

function round(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return /[,"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(outputDir: string, fileName: string, rows: Array<Record<string, unknown>>) {
  const headers = rows.length ? Array.from(new Set(rows.flatMap((row) => Object.keys(row)))) : ["empty"];
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))];
  fs.writeFileSync(path.join(outputDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

function writeMarkdown(outputDir: string, fileName: string, lines: string[]) {
  fs.writeFileSync(path.join(outputDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

function readSave(): PersistedSaveGame {
  const fileArgIndex = process.argv.indexOf("--save-file");
  const saveIdArgIndex = process.argv.indexOf("--save-id");
  const saveFile = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : process.env.OLY_AUDIT_SAVE_FILE;
  const saveId = saveIdArgIndex >= 0 ? process.argv[saveIdArgIndex + 1] : process.env.OLY_AUDIT_SAVE_ID;

  if (saveFile) {
    return JSON.parse(fs.readFileSync(path.resolve(saveFile), "utf8")) as PersistedSaveGame;
  }
  if (fs.existsSync(DEFAULT_DRY_RUN_SAVE)) {
    return JSON.parse(fs.readFileSync(DEFAULT_DRY_RUN_SAVE, "utf8")) as PersistedSaveGame;
  }

  const persistence = createPersistenceService();
  return saveId ? persistence.getSaveById(saveId) ?? persistence.bootstrapSingleplayerSave().save : persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
}

function getLatestCompletedSnapshot(gameState: GameState) {
  const snapshots = gameState.seasonState.seasonSnapshots ?? [];
  return [...snapshots].reverse().find((snapshot) => snapshot.status === "completed") ?? snapshots.at(-1) ?? null;
}

function buildSnapshotStandings(snapshot: SeasonSnapshotRecord | null): Record<string, { rank: number | null; points: number | null; cash: number | null; salaryTotal: number | null; marketValueTotal: number | null; transferNet: number | null; transferCount: number | null }> {
  if (!snapshot) return {};
  return Object.fromEntries(
    snapshot.finalStandings.map((team) => [
      team.teamId,
      {
        rank: team.rank,
        points: team.points,
        cash: team.cashEnd,
        salaryTotal: team.salaryEnd,
        marketValueTotal: team.marketValueEnd,
        transferNet: team.transferNet,
        transferCount: team.transferCount,
      },
    ]),
  );
}

function buildSeasonContext(save: PersistedSaveGame, snapshot: SeasonSnapshotRecord | null): GameState {
  if (!snapshot) return save.gameState;
  const standings = Object.fromEntries(
    snapshot.finalStandings.map((team) => [
      team.teamId,
      {
        points: team.points ?? 0,
        rank: team.rank,
        cashFc: team.cashFc,
        startplatz: team.startplatz,
        rankDiff: team.rankDiff,
        sponsorBasis: team.sponsorBasis,
        sponsorRank: team.sponsorRank,
        sponsorSeason: team.sponsorSeason,
        sponsorTotal: team.sponsorTotal,
        guv: team.guv,
        cashTotal: team.cashTotal,
      },
    ]),
  );
  return {
    ...save.gameState,
    gamePhase: "season_completed",
    season: {
      ...save.gameState.season,
      id: snapshot.seasonId,
      name: snapshot.seasonName,
      currentMatchday: 10,
      totalMatchdays: 10,
      isCompleted: true,
    },
    matchdayState: {
      matchdayId: `${snapshot.seasonId}-matchday-10`,
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    seasonState: {
      ...save.gameState.seasonState,
      seasonId: snapshot.seasonId,
      standings,
      matchdayResults: snapshot.matchdayResults ?? [],
      disciplineResults: snapshot.disciplineResults ?? [],
      playerDisciplinePerformances: snapshot.playerDisciplinePerformances ?? [],
      disciplineHighlights: snapshot.disciplineHighlights ?? [],
      seasonSnapshots: save.gameState.seasonState.seasonSnapshots ?? [],
    },
  };
}

function getRoleExpectedAppearances(role: string | null | undefined) {
  if (role === "starter") return 7;
  if (role === "rotation") return 4;
  if (role === "bench") return 2;
  if (role === "prospect") return 2;
  return 4;
}

function getPromisedRoleStatus(promisedRole: string | null | undefined, appearances: number) {
  const expected = getRoleExpectedAppearances(promisedRole);
  if (!promisedRole) return "missing";
  if (appearances >= expected + 2) return "overdelivered";
  if (appearances >= expected) return "fulfilled";
  if (appearances >= Math.max(1, expected - 2)) return "soft_miss";
  return "broken";
}

function sumAttributeDelta(event: PlayerProgressionSpendEventRecord | null) {
  if (!event?.progressionSnapshotBefore || !event.progressionSnapshotAfter) return 0;
  return ATTRIBUTE_KEYS.reduce((sum, key) => {
    const before = event.progressionSnapshotBefore?.attributes?.[key];
    const after = event.progressionSnapshotAfter?.attributes?.[key];
    if (typeof before !== "number" || typeof after !== "number") return sum;
    return sum + (after - before);
  }, 0);
}

function sumDisciplineDelta(event: PlayerProgressionSpendEventRecord | null) {
  if (!event?.progressionSnapshotBefore || !event.progressionSnapshotAfter) return 0;
  const ids = new Set([
    ...Object.keys(event.progressionSnapshotBefore.disciplineRatings ?? {}),
    ...Object.keys(event.progressionSnapshotAfter.disciplineRatings ?? {}),
  ]);
  let total = 0;
  for (const id of ids) {
    const before = event.progressionSnapshotBefore.disciplineRatings[id];
    const after = event.progressionSnapshotAfter.disciplineRatings[id];
    if (typeof before === "number" && typeof after === "number") total += after - before;
  }
  return total;
}

function getCoreDelta(event: PlayerProgressionSpendEventRecord | null, key: "pow" | "spe" | "men" | "soc") {
  if (!event?.progressionSnapshotBefore || !event.progressionSnapshotAfter) return null;
  const before = (event.progressionSnapshotBefore as { [key: string]: unknown })[key];
  const after = (event.progressionSnapshotAfter as { [key: string]: unknown })[key];
  if (typeof before !== "number" || typeof after !== "number") return null;
  return round(after - before, 2);
}

function classifyPlayer(row: Omit<AuditPlayerRow, "statusBucket">): AuditPlayerRow["statusBucket"] {
  if (row.realRegression) return "real_regression";
  if (row.regressionRisk === "medium" || row.regressionRisk === "high") return "regression_risk";
  if (row.levelUps >= 1 || row.attributeDeltaTotal >= 1 || row.netDevelopmentXP >= 160) return "strong_positive";
  if (row.materializedXpEarned > 0 || row.netDevelopmentXP >= 30) return "positive";
  return "stagnation";
}

function getPlayerRows(save: PersistedSaveGame, seasonContext: GameState, snapshot: SeasonSnapshotRecord | null): AuditPlayerRow[] {
  const ratings = buildPlayerRatingContractMap(seasonContext);
  const rosterByPlayerId = new Map(seasonContext.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamById = new Map(seasonContext.teams.map((team) => [team.teamId, team] as const));
  const snapshotByPlayerId = new Map((snapshot?.playerPerformances ?? []).map((entry) => [entry.playerId, entry] as const));
  const progressionByPlayerId = new Map(
    (save.gameState.playerProgressionEvents ?? [])
      .filter((event) => event.seasonId === (snapshot?.seasonId ?? seasonContext.season.id))
      .map((event) => [event.playerId, event] as const),
  );

  return (snapshot?.playerPerformances ?? seasonContext.rosters.map((entry) => ({ playerId: entry.playerId } as const))).map((snapshotRow) => {
    const player = seasonContext.players.find((entry) => entry.id === snapshotRow.playerId) ?? save.gameState.players.find((entry) => entry.id === snapshotRow.playerId) ?? null;
    if (!player) return null;
    const roster = rosterByPlayerId.get(player.id) ?? null;
    const team = roster ? teamById.get(roster.teamId) ?? null : null;
    const rating = ratings.get(player.id) ?? null;
    const performance = buildPlayerSeasonPerformance(seasonContext, player.id);
    const forecast = buildPlayerProgressionForecast({
      gameState: seasonContext,
      player,
      playerRating: rating,
      seasonPerformance: performance,
      trainingModeByPlayerId: player.trainingMode ? { [player.id]: player.trainingMode } : null,
      currentXP: player.currentXP ?? 0,
      spentXP: player.spentXP ?? 0,
      lifetimeXP: player.lifetimeXP ?? null,
    });
    const model = buildPlayerDevelopmentLevelupModel({
      gameState: seasonContext,
      player,
      forecast,
      teamId: roster?.teamId ?? null,
      profile: null,
    });
    const event = progressionByPlayerId.get(player.id) ?? null;
    const snap = snapshotByPlayerId.get(player.id) ?? null;
    const roleStatus = getPromisedRoleStatus(roster?.promisedRole ?? snap?.promisedRole ?? null, snap?.appearances ?? performance.appearances);
    const attributeDeltaTotal = round(sumAttributeDelta(event), 2) ?? 0;
    const disciplineDeltaTotal = round(sumDisciplineDelta(event), 2) ?? 0;
    const projectedRegression = model.regressionEvent.delta < 0;
    const realRegression = attributeDeltaTotal < 0 || disciplineDeltaTotal < 0;
    const base = {
      playerId: player.id,
      playerName: player.name,
      teamId: roster?.teamId ?? snap?.teamId ?? "",
      teamCode: team?.shortCode ?? snap?.teamCode ?? "",
      promisedRole: roster?.promisedRole ?? snap?.promisedRole ?? "",
      roleStatus,
      appearances: snap?.appearances ?? performance.appearances,
      pps: round(snap?.pps ?? rating?.ppsSeason ?? performance.totalPoints),
      mvs: round(snap?.mvs ?? rating?.mvs),
      ovr: round(snap?.ovr ?? rating?.ovrNormalized ?? player.ovr ?? player.rating),
      earnedXP: forecast.earnedXP,
      maintenanceXP: forecast.maintenanceXP,
      regressionPressure: forecast.regressionPressure,
      netDevelopmentXP: forecast.netDevelopmentXP,
      spendableXP: forecast.seasonProjectedXP,
      materializedXpEarned: event?.xpEarned ?? 0,
      xpSpent: event?.xpSpent ?? 0,
      levelUps: model.level.levelUpsAvailable,
      trainingPoints: model.level.trainingPointsAvailable,
      attributeDeltaTotal,
      disciplineDeltaTotal,
      projectedRegression,
      powDelta: getCoreDelta(event, "pow"),
      speDelta: getCoreDelta(event, "spe"),
      menDelta: getCoreDelta(event, "men"),
      socDelta: getCoreDelta(event, "soc"),
      caPoGap: round((forecast.potentialRating ?? 0) - (forecast.currentAbilityRating ?? 0), 1),
      trainingTier: forecast.trainingFormTier,
      devRoute: forecast.developmentRoute,
      regressionRisk: forecast.regressionRisk,
      realRegression,
      warnings: [...forecast.audit.warnings, ...(event?.economyWarnings ?? [])],
    };
    return { ...base, statusBucket: classifyPlayer(base) };
  }).filter((entry): entry is AuditPlayerRow => Boolean(entry));
}

function buildBoardRows(seasonContext: GameState, snapshot: SeasonSnapshotRecord | null) {
  const overview = buildTeamObjectiveOverview(seasonContext);
  const rows = buildTeamSeasonOverviewRows({ gameState: seasonContext, standingsByTeamId: buildSnapshotStandings(snapshot) });
  const rowsByTeamId = new Map(rows.map((row) => [row.teamId, row] as const));
  return seasonContext.teams.map((team) => {
    const identity = seasonContext.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const board = overview.boardConfidence[team.teamId] ?? null;
    const row = rowsByTeamId.get(team.teamId) ?? null;
    const objectives = overview.objectives.filter((objective) => objective.teamId === team.teamId);
    const sportObjective = objectives.find((objective) => objective.objectiveId.startsWith("sport-rank-")) ?? null;
    const targetRank = typeof sportObjective?.targetValue === "number" ? sportObjective.targetValue : null;
    const actualRank = row?.rank ?? null;
    const deltaToExpectation = actualRank != null && targetRank != null ? actualRank - targetRank : null;
    const failed = objectives.filter((objective) => objective.status === "failed").length;
    const atRisk = objectives.filter((objective) => objective.status === "at_risk").length;
    const boardBefore = identity?.boardConfidence ?? 5;
    const boardAfter = board?.value ?? boardBefore;
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      boardExpectation: sportObjective?.label ?? "",
      targetRank,
      actualSeasonRank: actualRank,
      deltaToExpectation,
      boardConfidenceBefore: boardBefore,
      boardConfidenceAfter: boardAfter,
      boardTrustBefore: round(boardBefore * 10, 1),
      boardTrustAfter: round(boardAfter * 10, 1),
      boardPressure: board?.pressure ?? null,
      fanPressure: null,
      managerRisk: (board?.pressure ?? 0) >= 8 ? "high" : (board?.pressure ?? 0) >= 6 ? "medium" : "low",
      boardWarningReason: board?.warnings.join(" | ") ?? "",
      nextSeasonMandate: objectives
        .filter((objective) => objective.status === "failed" || objective.status === "at_risk")
        .slice(0, 2)
        .map((objective) => objective.label)
        .join(" + "),
      objectiveCount: objectives.length,
      failedObjectives: failed,
      atRiskObjectives: atRisk,
      cash: row?.cash ?? null,
      guv: row?.guv ?? null,
      transferNet: row?.transferNet ?? null,
      salaryTotal: row?.salaryTotal ?? null,
      marketValueTotal: row?.marketValueTotal ?? null,
    };
  });
}

function buildMoraleRows(seasonContext: GameState, playerRows: AuditPlayerRow[]) {
  return playerRows.map((row) => {
    const morale = assessPlayerMorale({ gameState: seasonContext, playerId: row.playerId, teamId: row.teamId });
    return {
      playerId: row.playerId,
      playerName: row.playerName,
      teamId: row.teamId,
      teamCode: row.teamCode,
      promisedRole: row.promisedRole,
      appearances: row.appearances,
      promisedRoleStatus: row.roleStatus,
      relationshipEventGenerated: false,
      relationshipEventReason: "relationship_events_not_persisted_v1",
      morale: morale?.morale ?? null,
      moraleDelta: morale?.reasons.reduce((sum, reason) => sum + reason.valueDelta, 0) ?? null,
      mood: morale?.visibleMood ?? null,
      contractIntent: morale?.contractIntent ?? null,
      warnings: morale?.warnings.join(" | ") ?? "",
      reasons: morale?.reasons.map((reason) => `${reason.reasonId}:${reason.valueDelta}`).join(" | ") ?? "",
    };
  });
}

function buildPromisedRoleRows(seasonContext: GameState, playerRows: AuditPlayerRow[]) {
  const ratings = buildPlayerRatingContractMap(seasonContext);
  const byTeam = new Map<string, AuditPlayerRow[]>();
  for (const row of playerRows) byTeam.set(row.teamId, [...(byTeam.get(row.teamId) ?? []), row]);
  return playerRows.map((row) => {
    const rating = ratings.get(row.playerId);
    const betterPlayersAhead = (byTeam.get(row.teamId) ?? []).filter((candidate) => (candidate.ovr ?? 0) > (row.ovr ?? 0)).length;
    return {
      playerId: row.playerId,
      playerName: row.playerName,
      teamId: row.teamId,
      teamCode: row.teamCode,
      promisedRole: row.promisedRole,
      roleTag: seasonContext.rosters.find((entry) => entry.playerId === row.playerId)?.roleTag ?? "",
      appearances: row.appearances,
      expectedAppearances: getRoleExpectedAppearances(row.promisedRole),
      promisedRoleStatus: row.roleStatus,
      ovr: row.ovr,
      ovrRank: rating?.ovrRank ?? null,
      betterPlayersAhead,
      starPromiseBlockedByRoster: row.promisedRole === "starter" && betterPlayersAhead >= 3,
      traitSensitivity: seasonContext.players.find((player) => player.id === row.playerId)?.traitsNegative.some((trait) => ["Mercenary", "Diva", "Ambitious", "Egomaniac"].includes(trait)) ? "strong" : "normal",
    };
  });
}

function buildTrainingFacilityRows(seasonContext: GameState) {
  return seasonContext.teams.map((team) => {
    const settings = seasonContext.seasonState.aiManagerTrainingSettings?.[team.teamId] ?? null;
    const facilities = getTeamFacilityState(seasonContext, team.teamId);
    const roster = seasonContext.rosters.filter((entry) => entry.teamId === team.teamId);
    const players = roster.map((entry) => seasonContext.players.find((player) => player.id === entry.playerId)).filter((player): player is Player => Boolean(player));
    const modes = players.reduce<Record<string, number>>((acc, player) => {
      acc[player.trainingMode ?? "missing"] = (acc[player.trainingMode ?? "missing"] ?? 0) + 1;
      return acc;
    }, {});
    const facilitySummaries = Object.entries(facilities.facilities).map(([facilityId, facility]) => {
      const efficiency = getFacilityEfficiency(facilities, facilityId as FacilityId);
      return `${facilityId}:L${facility.level}/cond${efficiency.conditionPct}/eff${efficiency.efficiencyPct}${facility.lastPaidSeasonId ? `/paid:${facility.lastPaidSeasonId}` : ""}${facility.disabledReason ? `/disabled:${facility.disabledReason}` : ""}`;
    });
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      trainingFocus: settings?.trainingFocus ?? "",
      trainingIntensity: settings?.trainingIntensity ?? "",
      playerTrainingMode: settings?.playerTrainingMode ?? "",
      modeLeicht: modes.leicht ?? 0,
      modeMittel: modes.mittel ?? 0,
      modeHart: modes.hart ?? 0,
      modeMissing: modes.missing ?? 0,
      facilitySummary: facilitySummaries.join(" | "),
      maintenanceEvents: (seasonContext.seasonState.facilityEvents ?? []).filter((event) => event.teamId === team.teamId && event.source.includes("upkeep")).length,
      facilityEvents: (seasonContext.seasonState.facilityEvents ?? []).filter((event) => event.teamId === team.teamId).length,
    };
  });
}

function buildContractRows(seasonContext: GameState, playerRows: AuditPlayerRow[]) {
  const playerById = new Map(seasonContext.players.map((player) => [player.id, player] as const));
  const rosterByPlayerId = new Map(seasonContext.rosters.map((entry) => [entry.playerId, entry] as const));
  return playerRows.map((row) => {
    const roster = rosterByPlayerId.get(row.playerId) as RosterEntry | undefined;
    const morale = assessPlayerMorale({ gameState: seasonContext, playerId: row.playerId, teamId: row.teamId });
    return {
      playerId: row.playerId,
      playerName: row.playerName,
      teamCode: row.teamCode,
      contractLength: roster?.contractLength ?? null,
      salary: roster?.salary ?? null,
      purchasePrice: roster?.purchasePrice ?? null,
      currentValue: roster?.currentValue ?? playerById.get(row.playerId)?.marketValue ?? null,
      morale: morale?.morale ?? null,
      contractIntent: morale?.contractIntent ?? null,
      renewalRisk: morale?.moraleRenewalRisk ?? null,
      sellCandidate: (morale?.contractIntent === "considering_exit" || morale?.contractIntent === "refuses_extension" || (row.regressionRisk === "high" && (roster?.contractLength ?? 9) <= 1)),
      renewalCandidate: (roster?.contractLength ?? 0) <= 1 && row.regressionRisk !== "high",
      warnings: [...row.warnings, ...(morale?.warnings ?? [])].join(" | "),
    };
  });
}

function pct(count: number, total: number) {
  return total > 0 ? round((count / total) * 100, 1) : 0;
}

function buildRedFlags(input: {
  playerRows: AuditPlayerRow[];
  boardRows: Array<Record<string, unknown>>;
  moraleRows: Array<Record<string, unknown>>;
  trainingRows: Array<Record<string, unknown>>;
  snapshot: SeasonSnapshotRecord | null;
  save: PersistedSaveGame;
}) {
  const total = input.playerRows.length;
    const positive = input.playerRows.filter((row) => row.statusBucket === "positive" || row.statusBucket === "strong_positive").length;
  const strong = input.playerRows.filter((row) => row.statusBucket === "strong_positive").length;
  const stagnation = input.playerRows.filter((row) => row.statusBucket === "stagnation").length;
  const risk = input.playerRows.filter((row) => row.statusBucket === "regression_risk" || row.statusBucket === "real_regression").length;
  const realRegression = input.playerRows.filter((row) => row.statusBucket === "real_regression").length;
  const projectedRegression = input.playerRows.filter((row) => row.projectedRegression).length;
  const materialized = input.playerRows.filter((row) => row.materializedXpEarned > 0).length;
  const relationshipEvents = input.moraleRows.filter((row) => row.relationshipEventGenerated === true).length;
  const facilityEvents = input.save.gameState.seasonState.facilityEvents?.length ?? 0;
  const builtFacilities = input.trainingRows.filter((row) => /:L[1-9]/.test(String(row.facilitySummary ?? ""))).length;
  return [
    {
      severity: positive < total * 0.15 ? "RED" : positive > total * 0.3 ? "YELLOW" : "INFO",
      area: "xp_distribution",
      metric: "forecast_positive_development_pct",
      value: pct(positive, total),
      target: "15-25%",
      message: positive < total * 0.15 ? "Forecast positive Entwicklung ist zu sparsam." : "Forecast positive Entwicklung im/nah am Zielkorridor.",
    },
    {
      severity: materialized < total * 0.15 ? "RED" : "INFO",
      area: "xp_apply",
      metric: "materialized_positive_xp_pct",
      value: pct(materialized, total),
      target: "15-25%",
      message: materialized < total * 0.15 ? "Tatsaechlich materialisierte XP-Events sind deutlich zu niedrig." : "Tatsaechlich materialisierte XP-Events liegen im Zielkorridor.",
    },
    {
      severity: strong < total * 0.03 ? "YELLOW" : strong > total * 0.08 ? "YELLOW" : "INFO",
      area: "xp_distribution",
      metric: "strong_development_pct",
      value: pct(strong, total),
      target: "3-8%",
      message: "Starke Entwicklung gemessen an LevelUps/hohem NetXP.",
    },
    {
      severity: stagnation < total * 0.5 || stagnation > total * 0.65 ? "YELLOW" : "INFO",
      area: "xp_distribution",
      metric: "stagnation_pct",
      value: pct(stagnation, total),
      target: "50-65%",
      message: "Stagnation sollte den Mittelbau bilden.",
    },
    {
      severity: risk < total * 0.1 || risk > total * 0.25 ? "YELLOW" : "INFO",
      area: "regression",
      metric: "regression_risk_pct",
      value: pct(risk, total),
      target: "10-25%",
      message: "Regression Risk Verteilung.",
    },
    {
      severity: realRegression < total * 0.02 ? "YELLOW" : realRegression > total * 0.08 ? "YELLOW" : "INFO",
      area: "regression",
      metric: "real_regression_pct",
      value: pct(realRegression, total),
      target: "2-8%",
      message: "Echte gespeicherte Attribut-/Diszi-Regression fehlt oder ist zu stark.",
    },
    {
      severity: projectedRegression > total * 0.3 ? "YELLOW" : "INFO",
      area: "regression",
      metric: "projected_regression_pct",
      value: pct(projectedRegression, total),
      target: "<= 30%",
      message: "Nur prognostizierte Regression aus dem Development-Modell.",
    },
    {
      severity: relationshipEvents === 0 ? "YELLOW" : "INFO",
      area: "morale_relationship",
      metric: "persisted_relationship_events",
      value: relationshipEvents,
      target: "> 0 bei Rollenbruch/Morale-Events",
      message: "Relationship Events werden aktuell nur berechnet, nicht persistiert.",
    },
    {
      severity: builtFacilities === 0 ? "INFO" : facilityEvents === 0 ? "YELLOW" : "INFO",
      area: "facilities",
      metric: "facility_events",
      value: facilityEvents,
      target: "Maintenance/Income Events bei Season-End",
      message: builtFacilities === 0 ? "Keine gebauten Facilities im geprüften Save; 0 Events ist erwartbar." : "Im geprüften Dry-Run wurden keine Facility Events geschrieben.",
    },
  ];
}

function main() {
  assertOlyProjectRoot();
  const save = readSave();
  const snapshot = getLatestCompletedSnapshot(save.gameState);
  const seasonContext = buildSeasonContext(save, snapshot);
  const outputDir = path.join(process.cwd(), "outputs", "xp-board-season-end-balance-audit");
  fs.mkdirSync(outputDir, { recursive: true });

  const playerRows = getPlayerRows(save, seasonContext, snapshot);
  const boardRows = buildBoardRows(seasonContext, snapshot);
  const moraleRows = buildMoraleRows(seasonContext, playerRows);
  const promisedRoleRows = buildPromisedRoleRows(seasonContext, playerRows);
  const trainingRows = buildTrainingFacilityRows(seasonContext);
  const contractRows = buildContractRows(seasonContext, playerRows);
  const redFlags = buildRedFlags({ playerRows, boardRows, moraleRows, trainingRows, snapshot, save });
  const total = playerRows.length;
  const positive = playerRows.filter((row) => row.statusBucket === "positive" || row.statusBucket === "strong_positive").length;
  const strong = playerRows.filter((row) => row.statusBucket === "strong_positive").length;
  const stagnation = playerRows.filter((row) => row.statusBucket === "stagnation").length;
  const risk = playerRows.filter((row) => row.statusBucket === "regression_risk" || row.statusBucket === "real_regression").length;
  const realRegression = playerRows.filter((row) => row.statusBucket === "real_regression").length;
  const projectedRegression = playerRows.filter((row) => row.projectedRegression).length;
  const materialized = playerRows.filter((row) => row.materializedXpEarned > 0).length;

  writeCsv(outputDir, "xp-development-distribution.csv", playerRows);
  writeCsv(outputDir, "board-confidence-delta.csv", boardRows);
  writeCsv(outputDir, "morale-relationship-events.csv", moraleRows);
  writeCsv(outputDir, "promised-role-audit.csv", promisedRoleRows);
  writeCsv(outputDir, "training-facility-balance.csv", trainingRows);
  writeCsv(outputDir, "contract-renewal-sell-candidates.csv", contractRows);
  writeCsv(outputDir, "season-end-balance-redflags.csv", redFlags);

  writeMarkdown(outputDir, "xp-board-balance-summary.md", [
    "# XP, Board Confidence & Season-End Balance Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Save: ${save.saveId} (${save.name ?? "unnamed"})`,
    `Audit season: ${snapshot?.seasonId ?? seasonContext.season.id}`,
    `Source: ${snapshot ? "completed season snapshot + dry-run save" : "active save"}`,
    "",
    "## XP Distribution",
    "",
    `- Players audited: ${total}`,
    `- Forecast positive development: ${positive} (${pct(positive, total)}%) target 15-25%`,
    `- Forecast strong development: ${strong} (${pct(strong, total)}%) target 3-8%`,
    `- Forecast stagnation: ${stagnation} (${pct(stagnation, total)}%) target 50-65%`,
    `- Forecast regression risk: ${risk} (${pct(risk, total)}%) target 10-25%`,
    `- Projected regression events: ${projectedRegression} (${pct(projectedRegression, total)}%) target <=30%`,
    `- Real stored regression: ${realRegression} (${pct(realRegression, total)}%) target 2-8%`,
    `- Materialized positive XP events: ${materialized} (${pct(materialized, total)}%)`,
    `- Progression events in save: ${(save.gameState.playerProgressionEvents ?? []).filter((event) => event.seasonId === (snapshot?.seasonId ?? seasonContext.season.id)).length}`,
    "",
    "## Board / Morale / Facilities",
    "",
    `- Board rows: ${boardRows.length}`,
    `- Morale rows: ${moraleRows.length}`,
    `- Stored morale states: ${save.gameState.playerMoraleState?.length ?? 0}`,
    `- Relationship events persisted: 0`,
    `- Facility events: ${save.gameState.seasonState.facilityEvents?.length ?? 0}`,
    "",
    "## Red Flags",
    "",
    ...redFlags.map((flag) => `- ${flag.severity} ${flag.area}/${flag.metric}: ${flag.value} (${flag.message})`),
  ]);

  writeMarkdown(outputDir, "recommended-balance-adjustments.md", [
    "# Recommended Balance Adjustments",
    "",
    "## Befund",
    "",
    materialized < total * 0.15
      ? "- RED: Der Apply-Pfad materialisiert zu wenig Season-XP. Erst diesen Pfad fixen, bevor XP-Konstanten pauschal erhöht werden."
      : "- Materialisierte XP-Events liegen nicht im RED-Bereich.",
    positive < total * 0.15
      ? "- RED: Forecast-positive Entwicklung liegt unter Ziel. Maintenance/Regression/Performance-Faktoren datenbasiert senken bzw. Performance-XP erhöhen."
      : positive > total * 0.25
        ? "- YELLOW: Forecast-positive Entwicklung liegt über Ziel. Nicht weiter buffen."
        : "- Forecast-positive Entwicklung liegt im Zielkorridor.",
    realRegression < total * 0.02
      ? "- YELLOW: Echte kleine Regression fehlt. Regression Debt wird sichtbar, aber nicht oft genug als kleiner Attributverlust materialisiert."
      : "- Echte Regression liegt nicht unter Mindestkorridor.",
    (save.gameState.playerMoraleState?.length ?? 0) === 0
      ? "- YELLOW: Morale wird berechnet, aber nicht als Season-End-State persistiert."
      : "- Morale State ist persistiert.",
    trainingRows.some((row) => /:L[1-9]/.test(String(row.facilitySummary ?? "")))
      ? (save.gameState.seasonState.facilityEvents?.length ?? 0) === 0
        ? "- YELLOW: Es gibt gebaute Facilities, aber keine Facility Events im geprüften Run."
        : "- Facility Events sind vorhanden."
      : "- Facilities: keine gebauten Facilities im geprüften Run, daher sind 0 Maintenance/Income-Events erwartbar.",
    "",
    "## Gesetzte Balance-Aenderungen",
    "",
    "- Development-Potential wirkt jetzt als weicher Cap statt als 0-Level-Hard-Gate bei `potentialGap <= 0`.",
    "- Erhaltungsdruck wurde gegen die echte Season-1-Verteilung rekalibriert: Ziel ist ca. 15-25% positive Entwicklung, 50-65% Stagnation und 10-25% Regression-Risk.",
    "- Admin-Season-Simulation nutzt jetzt den bestehenden AI-XP-Spend-Planner, damit Season-End nicht nur XP materialisiert, sondern auch sinnvolle Upgrades schreibt.",
    "- Admin-Dryrun-Harness klont den Save nicht mehr bei jedem Zugriff und laeuft dadurch ohne Heap-OOM durch.",
    "- AI-TrainingSettings und Player-Morale-State werden im Admin-Season-End-Flow persistiert.",
    "",
    "## Weiter offen",
    "",
    "- Relationship Events sind weiterhin nicht als eigene Event-Historie persistiert.",
    "- Echte kleine Regression wird noch zu selten als gespeicherter Attribut-/Diszi-Verlust materialisiert.",
  ]);

  console.log(`Wrote ${outputDir}`);
  console.log(`players=${total} positive=${positive} strong=${strong} stagnation=${stagnation} risk=${risk} realRegression=${realRegression} materialized=${materialized}`);
}

main();
