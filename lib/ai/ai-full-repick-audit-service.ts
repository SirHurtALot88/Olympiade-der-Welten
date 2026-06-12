import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

import { isAiPickResettableSource, type AiPickResettableSource } from "@/lib/ai/ai-pick-audit-reset-contract";

type AuditSource = "sqlite";

type ArtifactStatus = "missing" | "usable" | "stale";
type BudgetSourceStatus =
  | "season_budget_only"
  | "setup_validation_cash_scaled_from_seed_roster_value"
  | "budget_source_below_team_budget"
  | "full_repick_budget_source_suspect";
type BudgetScaleStatus = "ready" | "too_high" | "too_low" | "suspect";
type MinimumFailureReason =
  | "minimum_ok"
  | "minimum_unreachable_no_cash"
  | "minimum_unreachable_no_legal_candidates"
  | "minimum_unreachable_buy_rule"
  | "minimum_unreachable_salary"
  | "minimum_unreachable_unknown"
  | "planner_bug_missing_reason";
type AuditRoleLabel = "Superstar" | "Star" | "Core" | "Specialist" | "Depth" | "Fill" | "Backup";
type PlannerTraceStatus = "run_artifact" | "stale_execute_artifact" | "reconstructed_from_save" | "missing_source";
type AuditDecision = "exportproblem" | "budgetproblem" | "plannerproblem" | "mischung";

type SaveContext = {
  source: AuditSource;
  requestedSaveId: string;
  resolvedSaveId: string | null;
  requestedSeasonId: string;
  resolvedSeasonId: string | null;
  saveName: string | null;
  saveStatus: string | null;
  scopeWarning: string | null;
};

type ArtifactPick = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  lane: string | null;
  pickLane: string | null;
  aiScore: number | null;
  needLabel: string | null;
  reasons: string[];
  marketValue: number | null;
  salary: number | null;
  transferHistoryId: string | null;
};

type TeamArtifactSummary = {
  teamCode: string;
  teamName: string;
  currentCash: number | null;
  cashAfter: number | null;
  currentRoster: number | null;
  rosterAfter: number | null;
  minimumRoster: number | null;
  optimumRoster: number | null;
  financePosture: string | null;
  spendFactor: number | null;
  allowedBudgetForSearch: number | null;
  attackPressure: number | null;
  savingsBias: number | null;
  minCashBuffer: number | null;
  rosterPressure: number | null;
  needPressure: number | null;
  expectedPrizeSignal: {
    expectedPrizeCurrentSeason: number | null;
    expectedPrizeNextSeason1: number | null;
    expectedPrizeNextSeason2: number | null;
    expectedPrizeNextSeason3: number | null;
    expectedPrizeNextSeason4: number | null;
    expectedPrizeFiveSeasonSum: number | null;
    expectedPrizeTrend: string | null;
    prizeConfidence: string | null;
    prizeSourceStatus: string | null;
    flowPolicy: string | null;
    warnings: string[];
  } | null;
  executedPickCount: number;
  picks: ArtifactPick[];
};

type RunArtifact = {
  status: ArtifactStatus;
  artifactPath: string | null;
  saveId: string | null;
  saveName: string | null;
  appliedPickCount: number | null;
  teamSummaries: TeamArtifactSummary[];
  qualityGateWarnings: string[];
};

type MarketAnchors = {
  q20Price: number;
  q35Price: number;
  q50Price: number;
  q65Price: number;
  q80Price: number;
  q85Price: number;
  q95Price: number;
  q50Salary: number;
  q80Salary: number;
  q95Salary: number;
  q65Ovr: number;
  q80Ovr: number;
  q90Ovr: number;
  q95Ovr: number;
};

export type AiFullRepickAuditPickRow = {
  transferId: string | null;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  purchasePrice: number | null;
  salary: number | null;
  marketValue: number | null;
  plannerTraceStatus: PlannerTraceStatus;
  legacyRoleTag: string | null;
  exportedRoleBug: boolean;
  pickLane: string | null;
  rosterRole: string | null;
  pickPhase: string;
  auditRole: AuditRoleLabel;
  isStar: boolean;
  isSuperstar: boolean;
  isCore: boolean;
  isDepth: boolean;
  budgetStretchApplied: boolean | null;
  pickedForFormColor: boolean | null;
  strategicExceptionReason: string | null;
  pickScore: number | null;
  needLabel: string | null;
  reasons: string[];
  teamFit: number | null;
  warnings: string[];
};

export type AiFullRepickAuditTeamRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  startRosterBeforeFullRepick: number;
  finalRosterAfterFullRepick: number;
  minimumRoster: number;
  optimumRoster: number | null;
  targetRoster: number | null;
  missingMinimumSlots: number;
  missingOptimumSlots: number;
  minimumStatusReason: MinimumFailureReason;
  startingCash: number | null;
  validationBudgetSource: BudgetSourceStatus;
  expectedCostForMinimum: number | null;
  expectedCostForTarget: number | null;
  actualSpend: number;
  remainingCash: number | null;
  spendRatio: number | null;
  averagePickMW: number | null;
  averagePickSalary: number | null;
  budgetScaleStatus: BudgetScaleStatus;
  financePosture: string | null;
  spendFactor: number | null;
  allowedBudgetForSearch: number | null;
  expectedPrizeFiveSeasonSum: number | null;
  expectedPrizeSourceStatus: string | null;
  plannerTraceStatus: PlannerTraceStatus;
  offThemePickCount: number;
  classSpamPickCount: number;
  teamIdentityStatus: {
    coreIdentityFulfilled: boolean;
    primaryAxisCoverage: number;
    formColorCoverage: number;
    offThemePicks: string[];
    strategicExceptions: string[];
    retoolNearness: "high" | "medium" | "low";
  };
  laneDistribution: Array<{ label: AuditRoleLabel; count: number }>;
  picks: AiFullRepickAuditPickRow[];
  warnings: string[];
};

export type AiFullRepickAuditResult = {
  source: AuditSource;
  readOnly: true;
  saveContext: SaveContext;
  runArtifact: {
    status: ArtifactStatus;
    artifactPath: string | null;
    artifactSaveId: string | null;
    artifactSaveName: string | null;
    artifactAppliedPickCount: number | null;
    currentResettableTransferCount: number;
  };
  summary: {
    saveStartedEmpty: boolean;
    saveStartedEmptySource: "active_roster_vs_resettable_transfers" | "run_artifact" | "unknown";
    comparedTeams: number;
    teamsBelowMinimum: number;
    totalResettableTransfers: number;
    totalFinalRosterPlayers: number;
    totalSpend: number;
    totalRemainingCash: number | null;
    totalBerserker: number;
    totalWarlord: number;
    berserkerWarlordSharePct: number | null;
    roleDistribution: Array<{ label: AuditRoleLabel; count: number }>;
    laneExportDiagnosis:
      | "planner_lane_available"
      | "planner_lane_missing_export_used_legacy_role_tag"
      | "planner_lane_artifact_stale_export_used_legacy_role_tag";
    decision: AuditDecision;
  };
  globalBudgetAudit: {
    averageSpendRatio: number | null;
    highestSpendTeams: Array<{ teamCode: string; spend: number; spendRatio: number | null }>;
    suspectBudgetTeams: Array<{ teamCode: string; status: BudgetSourceStatus; startingCash: number | null; budget: number | null }>;
  };
  focusTeams: Array<{
    teamCode: string;
    teamName: string;
    coreIdentityFulfilled: boolean;
    primaryAxisCoverage: number;
    formColorCoverage: number;
    offThemePicks: string[];
    strategicExceptions: string[];
    retoolNearness: "high" | "medium" | "low";
  }>;
  teams: AiFullRepickAuditTeamRow[];
  warnings: string[];
};

export type AiFullRepickAuditParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
};

const LEGAL_MINIMUM_ROSTER_SIZE = 7;
const FOCUS_TEAMS = new Set(["W-W", "C-C", "T-T", "N-W", "C-S", "R-R", "G-G", "H-R", "M-M"]);

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTeamCode(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function quantile(values: Array<number | null | undefined>, q: number) {
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (normalized.length === 0) {
    return 0;
  }
  if (normalized.length === 1) {
    return normalized[0]!;
  }
  const position = clamp(q, 0, 1) * (normalized.length - 1);
  const base = Math.floor(position);
  const rest = position - base;
  const current = normalized[base]!;
  const next = normalized[Math.min(base + 1, normalized.length - 1)]!;
  return current + (next - current) * rest;
}

function sortCountEntries(map: Map<string, number>) {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0], "de");
    })
    .map(([label, count]) => ({ label, count }));
}

function buildMarketAnchors(players: Player[]): MarketAnchors {
  return {
    q20Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.2),
    q35Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.35),
    q50Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.5),
    q65Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.65),
    q80Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.8),
    q85Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.85),
    q95Price: quantile(players.map((player) => player.displayMarketValue ?? player.marketValue ?? null), 0.95),
    q50Salary: quantile(players.map((player) => player.displaySalary ?? player.salaryDemand ?? null), 0.5),
    q80Salary: quantile(players.map((player) => player.displaySalary ?? player.salaryDemand ?? null), 0.8),
    q95Salary: quantile(players.map((player) => player.displaySalary ?? player.salaryDemand ?? null), 0.95),
    q65Ovr: quantile(players.map((player) => player.ovr ?? player.rating ?? null), 0.65),
    q80Ovr: quantile(players.map((player) => player.ovr ?? player.rating ?? null), 0.8),
    q90Ovr: quantile(players.map((player) => player.ovr ?? player.rating ?? null), 0.9),
    q95Ovr: quantile(players.map((player) => player.ovr ?? player.rating ?? null), 0.95),
  };
}

function classifyAuditRole(input: {
  price: number | null;
  salary: number | null;
  ovr: number | null;
  bestDiscipline: number | null;
  anchors: MarketAnchors;
}): AuditRoleLabel {
  const price = input.price ?? 0;
  const salary = input.salary ?? 0;
  const ovr = input.ovr ?? 0;
  const bestDiscipline = input.bestDiscipline ?? 0;
  if (price >= input.anchors.q95Price || ovr >= input.anchors.q95Ovr) {
    return "Superstar";
  }
  if (price >= input.anchors.q85Price || ovr >= input.anchors.q90Ovr) {
    return "Star";
  }
  if (bestDiscipline >= 85 && price >= input.anchors.q50Price) {
    return "Specialist";
  }
  if (price >= input.anchors.q65Price || ovr >= input.anchors.q80Ovr) {
    return "Core";
  }
  if (price >= input.anchors.q50Price || salary >= input.anchors.q50Salary || ovr >= input.anchors.q65Ovr) {
    return "Depth";
  }
  if (price >= input.anchors.q35Price) {
    return "Fill";
  }
  return "Backup";
}

function getPlayerBestDiscipline(player: Player) {
  const top = Object.values(player.disciplineRatings ?? {})
    .map((value) => Number(value ?? 0))
    .sort((left, right) => right - left)[0];
  return Number.isFinite(top) ? top : null;
}

function roleFromPlannerLane(value: string | null | undefined): AuditRoleLabel | null {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }
  if (normalized.includes("superstar")) return "Superstar";
  if (normalized.includes("star")) return "Star";
  if (normalized.includes("core")) return "Core";
  if (normalized.includes("specialist")) return "Specialist";
  if (normalized.includes("depth")) return "Depth";
  if (normalized.includes("fill")) return "Fill";
  if (normalized.includes("backup")) return "Backup";
  return null;
}

async function canRead(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists<T>(filePath: string) {
  if (!(await canRead(filePath))) {
    return null;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadRunArtifact(saveId: string): Promise<RunArtifact> {
  const artifactPath = path.join(process.cwd(), "tmp", "ai-validation", saveId, "execute-summary.json");
  const json = await readJsonIfExists<{
    saveId?: string;
    saveName?: string;
    globalExecution?: { appliedPickCount?: number | null };
    qualityGate?: { warnings?: string[] };
    perTeam?: Array<{
      teamCode: string;
      teamName: string;
      currentCash: number | null;
      cashAfter: number | null;
      currentRoster: number | null;
      rosterAfter: number | null;
      minimumRoster: number | null;
      optimumRoster: number | null;
      financePosture: string | null;
      spendFactor: number | null;
      allowed_budget_for_search: number | null;
      attackPressure: number | null;
      savingsBias: number | null;
      minCashBuffer: number | null;
      rosterPressure: number | null;
      needPressure: number | null;
      expectedPrizeSignal?: TeamArtifactSummary["expectedPrizeSignal"];
      executedPickCount?: number | null;
      picks?: Array<{
        step?: number;
        playerId?: string;
        playerName?: string;
        className?: string;
        race?: string;
        lane?: string;
        pickLane?: string;
        aiScore?: number | null;
        marketValue?: number | null;
        salary?: number | null;
        needLabel?: string | null;
        reasons?: string[];
        status?: string;
        transferHistoryId?: string | null;
      }>;
    }>;
  }>(artifactPath);

  if (!json) {
    return {
      status: "missing",
      artifactPath: null,
      saveId: null,
      saveName: null,
      appliedPickCount: null,
      teamSummaries: [],
      qualityGateWarnings: [],
    };
  }

  return {
    status: "usable",
    artifactPath,
    saveId: json.saveId ?? null,
    saveName: json.saveName ?? null,
    appliedPickCount: json.globalExecution?.appliedPickCount ?? null,
    teamSummaries: (json.perTeam ?? []).map((entry) => ({
      teamCode: entry.teamCode,
      teamName: entry.teamName,
      currentCash: entry.currentCash ?? null,
      cashAfter: entry.cashAfter ?? null,
      currentRoster: entry.currentRoster ?? null,
      rosterAfter: entry.rosterAfter ?? null,
      minimumRoster: entry.minimumRoster ?? null,
      optimumRoster: entry.optimumRoster ?? null,
      financePosture: entry.financePosture ?? null,
      spendFactor: entry.spendFactor ?? null,
      allowedBudgetForSearch: entry.allowed_budget_for_search ?? null,
      attackPressure: entry.attackPressure ?? null,
      savingsBias: entry.savingsBias ?? null,
      minCashBuffer: entry.minCashBuffer ?? null,
      rosterPressure: entry.rosterPressure ?? null,
      needPressure: entry.needPressure ?? null,
      expectedPrizeSignal: entry.expectedPrizeSignal
        ? {
            expectedPrizeCurrentSeason: entry.expectedPrizeSignal.expectedPrizeCurrentSeason ?? null,
            expectedPrizeNextSeason1: entry.expectedPrizeSignal.expectedPrizeNextSeason1 ?? null,
            expectedPrizeNextSeason2: entry.expectedPrizeSignal.expectedPrizeNextSeason2 ?? null,
            expectedPrizeNextSeason3: entry.expectedPrizeSignal.expectedPrizeNextSeason3 ?? null,
            expectedPrizeNextSeason4: entry.expectedPrizeSignal.expectedPrizeNextSeason4 ?? null,
            expectedPrizeFiveSeasonSum: entry.expectedPrizeSignal.expectedPrizeFiveSeasonSum ?? null,
            expectedPrizeTrend: entry.expectedPrizeSignal.expectedPrizeTrend ?? null,
            prizeConfidence: entry.expectedPrizeSignal.prizeConfidence ?? null,
            prizeSourceStatus: entry.expectedPrizeSignal.prizeSourceStatus ?? null,
            flowPolicy: entry.expectedPrizeSignal.flowPolicy ?? null,
            warnings: [...(entry.expectedPrizeSignal.warnings ?? [])],
          }
        : null,
      executedPickCount: Math.max(0, Math.round(entry.executedPickCount ?? 0)),
      picks: (entry.picks ?? []).map((pick) => ({
        playerId: pick.playerId ?? "",
        playerName: pick.playerName ?? "",
        className: pick.className ?? "",
        race: pick.race ?? "",
        lane: pick.lane ?? null,
        pickLane: pick.pickLane ?? null,
        aiScore: pick.aiScore ?? null,
        needLabel: pick.needLabel ?? null,
        reasons: [...(pick.reasons ?? [])],
        marketValue: pick.marketValue ?? null,
        salary: pick.salary ?? null,
        transferHistoryId: pick.transferHistoryId ?? null,
      })),
    })),
    qualityGateWarnings: [...(json.qualityGate?.warnings ?? [])],
  };
}

function buildSaveContext(input: { saveId: string; seasonId: string }) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) {
    return {
      persistence,
      save: null,
      saveContext: {
        source: "sqlite" as const,
        requestedSaveId: input.saveId,
        resolvedSaveId: null,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: `Requested save ${input.saveId} could not be resolved.`,
      } satisfies SaveContext,
    };
  }
  if (save.gameState.season.id !== input.seasonId) {
    return {
      persistence,
      save: null,
      saveContext: {
        source: "sqlite" as const,
        requestedSaveId: input.saveId,
        resolvedSaveId: save.saveId,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: null,
        saveName: save.name ?? null,
        saveStatus: save.status ?? null,
        scopeWarning: `Requested season ${input.seasonId} is not available in save ${save.saveId}.`,
      } satisfies SaveContext,
    };
  }
  return {
    persistence,
    save,
    saveContext: {
      source: "sqlite" as const,
      requestedSaveId: input.saveId,
      resolvedSaveId: save.saveId,
      requestedSeasonId: input.seasonId,
      resolvedSeasonId: save.gameState.season.id,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    } satisfies SaveContext,
  };
}

function getTeamIdentity(gameState: GameState, teamId: string) {
  return gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
}

function getTeamRosterEntries(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId);
}

function getPlayer(gameState: GameState, playerId: string) {
  return gameState.players.find((entry) => entry.id === playerId) ?? null;
}

function isAiFullRepickAuditPickRow(row: AiFullRepickAuditPickRow | null): row is AiFullRepickAuditPickRow {
  return row != null;
}

function getResettableTransfersForTeam(gameState: GameState, seasonId: string, teamId: string) {
  return gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      entry.transferType === "buy" &&
      entry.toTeamId === teamId &&
      isAiPickResettableSource(entry.source),
  );
}

function getActiveAiPickedPlayerIds(gameState: GameState, seasonId: string, teamId: string) {
  const activeRosterIds = new Set(getTeamRosterEntries(gameState, teamId).map((entry) => entry.playerId));
  return new Set(
    getResettableTransfersForTeam(gameState, seasonId, teamId)
      .map((entry) => entry.playerId)
      .filter((playerId) => activeRosterIds.has(playerId)),
  );
}

function sum(values: Array<number | null | undefined>) {
  return roundValue(
    values.reduce<number>((acc, value) => acc + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0),
    2,
  );
}

function average(values: Array<number | null | undefined>) {
  const normalized = values.filter((value): value is number => Number.isFinite(value as number));
  if (normalized.length === 0) {
    return null;
  }
  return roundValue(sum(normalized) / normalized.length, 2);
}

function buildBudgetSourceStatus(input: {
  team: Team;
  startingCash: number | null;
}): { validationBudgetSource: BudgetSourceStatus; budgetScaleStatus: BudgetScaleStatus } {
  if (input.startingCash == null || !Number.isFinite(input.team.budget)) {
    return {
      validationBudgetSource: "full_repick_budget_source_suspect" as const,
      budgetScaleStatus: "suspect" as const,
    };
  }
  const delta = roundValue(input.startingCash - input.team.budget, 2);
  if (Math.abs(delta) <= 1) {
    return {
      validationBudgetSource: "season_budget_only" as const,
      budgetScaleStatus: "ready" as const,
    };
  }
  if (delta > 1) {
    return {
      validationBudgetSource: "setup_validation_cash_scaled_from_seed_roster_value" as const,
      budgetScaleStatus: delta > input.team.budget * 0.5 ? "too_high" : "ready",
    };
  }
  return {
    validationBudgetSource: "budget_source_below_team_budget" as const,
    budgetScaleStatus: "too_low" as const,
  };
}

function buildMinimumFailureReason(input: {
  finalRoster: number;
  minimumRoster: number;
  currentCash: number | null;
  freeAgentPrices: number[];
}) {
  if (input.finalRoster >= input.minimumRoster) {
    return "minimum_ok" as const;
  }
  if (input.freeAgentPrices.length === 0) {
    return "minimum_unreachable_no_legal_candidates" as const;
  }
  const cheapest = input.freeAgentPrices[0]!;
  if ((input.currentCash ?? 0) < cheapest) {
    return "minimum_unreachable_no_cash" as const;
  }
  return "planner_bug_missing_reason" as const;
}

function getPlayerRoleTag(player: Player, gameState: GameState, teamId: string) {
  const rosterEntry = getTeamRosterEntries(gameState, teamId).find((entry) => entry.playerId === player.id) ?? null;
  return rosterEntry?.roleTag ?? null;
}

function buildPlannerTraceStatus(input: { artifactStatus: ArtifactStatus; hasArtifactPick: boolean }) {
  if (input.artifactStatus === "usable" && input.hasArtifactPick) {
    return "run_artifact" as const;
  }
  if (input.artifactStatus === "stale") {
    return "stale_execute_artifact" as const;
  }
  return "reconstructed_from_save" as const;
}

function roleFlags(role: AuditRoleLabel) {
  return {
    isSuperstar: role === "Superstar",
    isStar: role === "Superstar" || role === "Star",
    isCore: role === "Superstar" || role === "Star" || role === "Core",
    isDepth: role === "Depth" || role === "Fill" || role === "Backup",
  };
}

function computeTeamIdentityStatus(input: {
  team: Team;
  teamPlayers: Player[];
  pickedRows: AiFullRepickAuditPickRow[];
}) {
  const axisTotals = { pow: 0, spe: 0, men: 0, soc: 0 };
  for (const player of input.teamPlayers) {
    axisTotals.pow += Number(player.coreStats.pow ?? 0);
    axisTotals.spe += Number(player.coreStats.spe ?? 0);
    axisTotals.men += Number(player.coreStats.men ?? 0);
    axisTotals.soc += Number(player.coreStats.soc ?? 0);
  }
  const axisEntries = Object.entries(axisTotals) as Array<[keyof typeof axisTotals, number]>;
  const topAxis = axisEntries.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "pow";
  const primaryAxisCoverage =
    input.teamPlayers.length > 0
      ? roundValue(
          input.teamPlayers.filter((player) => {
            const top = Object.entries(player.coreStats)
              .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0))[0]?.[0];
            return top === topAxis;
          }).length / input.teamPlayers.length,
          2,
        )
      : 0;
  const formColorCoverage = roundValue(
    input.teamPlayers.length > 0
      ? input.teamPlayers.filter((player) => ["berserker", "warlord", "tank", "sprinter", "rogue", "charger", "mage", "overseer", "templar", "bard", "hero", "badass", "tactician"].includes(normalizeToken(player.className))).length /
          input.teamPlayers.length
      : 0,
    2,
  );
  const offThemePicks = input.pickedRows
    .filter((pick) => pick.warnings.some((warning) => warning.startsWith("off_theme")))
    .map((pick) => `${pick.playerName} (${pick.className})`)
    .slice(0, 5);
  const strategicExceptions = input.pickedRows
    .map((pick) => pick.strategicExceptionReason)
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const retoolNearness =
    offThemePicks.length === 0 && primaryAxisCoverage >= 0.35
      ? "high"
      : offThemePicks.length <= 2 && primaryAxisCoverage >= 0.22
        ? "medium"
        : "low";
  return {
    coreIdentityFulfilled: retoolNearness !== "low",
    primaryAxisCoverage,
    formColorCoverage,
    offThemePicks,
    strategicExceptions,
    retoolNearness,
  } as const;
}

function buildArtifactPickMap(artifact: RunArtifact, currentResettableTransferCount: number) {
  const artifactStatus: ArtifactStatus =
    artifact.status === "usable" && artifact.appliedPickCount != null && artifact.appliedPickCount === currentResettableTransferCount
      ? "usable"
      : artifact.status === "usable"
        ? "stale"
        : "missing";

  const byTeamAndPlayer = new Map<string, ArtifactPick>();
  for (const team of artifact.teamSummaries) {
    for (const pick of team.picks) {
      byTeamAndPlayer.set(`${normalizeTeamCode(team.teamCode)}::${pick.playerId}`, pick);
    }
  }

  return {
    artifactStatus,
    byTeamAndPlayer,
    byTeam: new Map(artifact.teamSummaries.map((entry) => [normalizeTeamCode(entry.teamCode), entry])),
  };
}

export async function buildAiFullRepickAudit(params: AiFullRepickAuditParams): Promise<AiFullRepickAuditResult> {
  if ((params.source ?? "sqlite") !== "sqlite") {
    throw new Error("AI full repick audit supports local sqlite saves only.");
  }

  const { save, saveContext } = buildSaveContext({ saveId: params.saveId, seasonId: params.seasonId });
  if (!save) {
    return {
      source: "sqlite",
      readOnly: true,
      saveContext,
      runArtifact: {
        status: "missing",
        artifactPath: null,
        artifactSaveId: null,
        artifactSaveName: null,
        artifactAppliedPickCount: null,
        currentResettableTransferCount: 0,
      },
      summary: {
        saveStartedEmpty: false,
        saveStartedEmptySource: "unknown",
        comparedTeams: 0,
        teamsBelowMinimum: 0,
        totalResettableTransfers: 0,
        totalFinalRosterPlayers: 0,
        totalSpend: 0,
        totalRemainingCash: null,
        totalBerserker: 0,
        totalWarlord: 0,
        berserkerWarlordSharePct: null,
        roleDistribution: [],
        laneExportDiagnosis: "planner_lane_missing_export_used_legacy_role_tag",
        decision: "plannerproblem",
      },
      globalBudgetAudit: {
        averageSpendRatio: null,
        highestSpendTeams: [],
        suspectBudgetTeams: [],
      },
      focusTeams: [],
      teams: [],
      warnings: [saveContext.scopeWarning ?? "scope_missing"],
    };
  }

  const gameState = save.gameState;
  const freeAgentPrices = gameState.players
    .filter((player) => !gameState.rosters.some((entry) => entry.playerId === player.id))
    .map((player) => Number(player.displayMarketValue ?? player.marketValue ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const allPlayers = gameState.players;
  const anchors = buildMarketAnchors(allPlayers);
  const resettableTransfers = gameState.transferHistory.filter(
    (entry) => entry.seasonId === params.seasonId && entry.transferType === "buy" && isAiPickResettableSource(entry.source),
  );
  const artifact = await loadRunArtifact(params.saveId);
  const artifactMap = buildArtifactPickMap(artifact, resettableTransfers.length);
  const warnings: string[] = [];
  if (artifactMap.artifactStatus === "stale") {
    warnings.push("execute_artifact_stale_for_current_save_state");
  } else if (artifactMap.artifactStatus === "missing") {
    warnings.push("execute_artifact_missing_for_current_save_state");
  }

  const teamRows: AiFullRepickAuditTeamRow[] = [];
  const roleCounts = new Map<AuditRoleLabel, number>();
  let totalSpend = 0;
  let totalRemainingCash = 0;
  let totalBerserker = 0;
  let totalWarlord = 0;
  let teamsBelowMinimum = 0;
  let totalOffTheme = 0;
  let totalClassSpam = 0;

  for (const team of gameState.teams) {
    const teamCode = normalizeTeamCode(team.shortCode || team.teamId);
    const teamArtifact = artifactMap.byTeam.get(teamCode) ?? null;
    const teamRosterEntries = getTeamRosterEntries(gameState, team.teamId);
    const teamRosterPlayers = teamRosterEntries
      .map((entry) => getPlayer(gameState, entry.playerId))
      .filter((player): player is Player => player != null);
    const teamTransfers = getResettableTransfersForTeam(gameState, params.seasonId, team.teamId);
    const activeAiPickedPlayerIds = getActiveAiPickedPlayerIds(gameState, params.seasonId, team.teamId);
    const activeAiPickedCount = activeAiPickedPlayerIds.size;
    const startRosterBeforeFullRepick = Math.max(0, teamRosterEntries.length - activeAiPickedCount);
    const identity = getTeamIdentity(gameState, team.teamId);
    const minimumRoster = Math.max(LEGAL_MINIMUM_ROSTER_SIZE, Math.round(identity?.playerMin ?? LEGAL_MINIMUM_ROSTER_SIZE));
    const optimumRoster = Number.isFinite(identity?.playerOpt) ? Math.max(minimumRoster, Math.round(identity?.playerOpt ?? minimumRoster)) : null;
    const targetRoster = optimumRoster;
    const missingMinimumSlots = Math.max(0, minimumRoster - teamRosterEntries.length);
    const missingOptimumSlots = Math.max(0, (optimumRoster ?? teamRosterEntries.length) - teamRosterEntries.length);
    const actualSpend = sum(teamTransfers.map((entry) => entry.fee ?? entry.marketValue ?? 0));
    const remainingCash = Number.isFinite(team.cash) ? roundValue(team.cash, 2) : null;
    const startingCash = remainingCash != null ? roundValue(remainingCash + actualSpend, 2) : null;
    const budgetStatus = buildBudgetSourceStatus({ team, startingCash });
    const minimumFailureReason = buildMinimumFailureReason({
      finalRoster: teamRosterEntries.length,
      minimumRoster,
      currentCash: team.cash ?? null,
      freeAgentPrices,
    });

    if (teamRosterEntries.length < minimumRoster) {
      teamsBelowMinimum += 1;
    }

    const sortedTransferPrices = teamTransfers
      .map((entry) => Number(entry.fee ?? entry.marketValue ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    const minimumGapFromStart = Math.max(0, minimumRoster - startRosterBeforeFullRepick);
    const targetGapFromStart = Math.max(0, (targetRoster ?? minimumRoster) - startRosterBeforeFullRepick);
    const expectedCostForMinimum =
      sortedTransferPrices.length >= minimumGapFromStart ? sum(sortedTransferPrices.slice(0, minimumGapFromStart)) : null;
    const expectedCostForTarget =
      sortedTransferPrices.length >= targetGapFromStart ? sum(sortedTransferPrices.slice(0, targetGapFromStart)) : null;

    const pickedRows = teamTransfers
      .map((transfer): AiFullRepickAuditPickRow | null => {
        const player = getPlayer(gameState, transfer.playerId);
        if (!player) {
          return null;
        }
        const artifactPick = artifactMap.byTeamAndPlayer.get(`${teamCode}::${player.id}`) ?? null;
        const plannerTraceStatus = buildPlannerTraceStatus({
          artifactStatus: artifactMap.artifactStatus,
          hasArtifactPick: Boolean(artifactPick),
        });
        const roleTag = getPlayerRoleTag(player, gameState, team.teamId);
        const artifactRole = roleFromPlannerLane(artifactPick?.lane ?? artifactPick?.pickLane);
        const auditRole =
          artifactRole ??
          classifyAuditRole({
            price: transfer.fee ?? transfer.marketValue ?? player.displayMarketValue ?? player.marketValue ?? null,
            salary: transfer.salary ?? player.displaySalary ?? player.salaryDemand ?? null,
            ovr: player.ovr ?? player.rating ?? null,
            bestDiscipline: getPlayerBestDiscipline(player),
            anchors,
          });
        const fit = calculateTransfermarktFit(
          {
            race: player.race,
            alignment: player.alignment,
            subclasses: player.subclasses,
            traitsPositive: player.traitsPositive,
            traitsNegative: player.traitsNegative,
          },
          teamRosterPlayers
            .filter((rosterPlayer) => rosterPlayer.id !== player.id)
            .map((rosterPlayer) => ({
              race: rosterPlayer.race,
              alignment: rosterPlayer.alignment,
              subclasses: rosterPlayer.subclasses,
              traitsPositive: rosterPlayer.traitsPositive,
              traitsNegative: rosterPlayer.traitsNegative,
            })),
          { teamId: transfer.toTeamId ?? null },
        );
        const warnings = [
          ...((fit.teamFit ?? 0) < 5 ? ["off_theme_low_team_fit"] : []),
          ...(artifactPick?.reasons.some((reason) => normalizeToken(reason).includes("passt")) ? [] : []),
          ...(roleTag === "prospect" && auditRole !== "Backup" && auditRole !== "Fill" ? ["legacy_role_tag_prospect_export_bug"] : []),
        ];
        const flags = roleFlags(auditRole);
        return {
          transferId: transfer.id,
          playerId: player.id,
          playerName: player.name,
          className: player.className,
          race: player.race,
          purchasePrice: roundValue(transfer.fee ?? transfer.marketValue ?? player.displayMarketValue ?? player.marketValue ?? 0, 2),
          salary: roundValue(transfer.salary ?? player.displaySalary ?? player.salaryDemand ?? 0, 2),
          marketValue: roundValue(player.displayMarketValue ?? player.marketValue ?? transfer.marketValue ?? 0, 2),
          plannerTraceStatus,
          legacyRoleTag: roleTag,
          exportedRoleBug: roleTag === "prospect" && auditRole !== "Backup" && auditRole !== "Fill",
          pickLane: artifactPick?.pickLane ?? null,
          rosterRole: artifactPick?.lane ?? null,
          pickPhase: "manual_transfer_window",
          auditRole,
          isStar: flags.isStar,
          isSuperstar: flags.isSuperstar,
          isCore: flags.isCore,
          isDepth: flags.isDepth,
          budgetStretchApplied: null,
          pickedForFormColor: null,
          strategicExceptionReason: null,
          pickScore: artifactPick?.aiScore ?? null,
          needLabel: artifactPick?.needLabel ?? null,
          reasons: artifactPick?.reasons ?? [],
          teamFit: fit.teamFit != null ? roundValue(fit.teamFit, 2) : null,
          warnings,
        } satisfies AiFullRepickAuditPickRow;
      })
      .filter(isAiFullRepickAuditPickRow);

    const teamRoleCounts = new Map<AuditRoleLabel, number>();
    for (const row of pickedRows) {
      teamRoleCounts.set(row.auditRole, (teamRoleCounts.get(row.auditRole) ?? 0) + 1);
      roleCounts.set(row.auditRole, (roleCounts.get(row.auditRole) ?? 0) + 1);
      if (normalizeToken(row.className) === "berserker") totalBerserker += 1;
      if (normalizeToken(row.className) === "warlord") totalWarlord += 1;
      if (row.warnings.some((warning) => warning.startsWith("off_theme"))) totalOffTheme += 1;
      if (row.reasons.some((reason) => normalizeToken(reason).includes("class spam"))) totalClassSpam += 1;
    }

    const teamIdentityStatus = computeTeamIdentityStatus({
      team,
      teamPlayers: teamRosterPlayers,
      pickedRows,
    });
    totalSpend += actualSpend;
    totalRemainingCash += remainingCash ?? 0;

    const artifactExpectedPrizeFiveSeasonSum = teamArtifact?.expectedPrizeSignal?.expectedPrizeFiveSeasonSum ?? null;
    const artifactPrizeSourceStatus = teamArtifact?.expectedPrizeSignal?.prizeSourceStatus ?? null;
    const plannerTraceStatus =
      pickedRows.length > 0
        ? pickedRows[0]!.plannerTraceStatus
        : artifactMap.artifactStatus === "stale"
          ? "stale_execute_artifact"
          : artifactMap.artifactStatus === "usable"
            ? "run_artifact"
            : "missing_source";

    teamRows.push({
      teamId: team.teamId,
      teamCode,
      teamName: team.name,
      startRosterBeforeFullRepick,
      finalRosterAfterFullRepick: teamRosterEntries.length,
      minimumRoster,
      optimumRoster,
      targetRoster,
      missingMinimumSlots,
      missingOptimumSlots,
      minimumStatusReason: minimumFailureReason,
      startingCash,
      validationBudgetSource: budgetStatus.validationBudgetSource,
      expectedCostForMinimum,
      expectedCostForTarget,
      actualSpend,
      remainingCash,
      spendRatio: startingCash && startingCash > 0 ? roundValue(actualSpend / startingCash, 3) : null,
      averagePickMW: average(pickedRows.map((row) => row.marketValue)),
      averagePickSalary: average(pickedRows.map((row) => row.salary)),
      budgetScaleStatus: budgetStatus.budgetScaleStatus,
      financePosture: teamArtifact?.financePosture ?? null,
      spendFactor: teamArtifact?.spendFactor ?? null,
      allowedBudgetForSearch: teamArtifact?.allowedBudgetForSearch ?? null,
      expectedPrizeFiveSeasonSum: artifactExpectedPrizeFiveSeasonSum,
      expectedPrizeSourceStatus: artifactPrizeSourceStatus,
      plannerTraceStatus,
      offThemePickCount: pickedRows.filter((row) => row.warnings.some((warning) => warning.startsWith("off_theme"))).length,
      classSpamPickCount: pickedRows.filter((row) => row.warnings.includes("legacy_role_tag_prospect_export_bug")).length,
      teamIdentityStatus,
      laneDistribution: sortCountEntries(new Map(teamRoleCounts)) as Array<{ label: AuditRoleLabel; count: number }>,
      picks: pickedRows,
      warnings: [
        ...(plannerTraceStatus === "stale_execute_artifact" ? ["exact_pick_scores_missing_for_current_save_state"] : []),
        ...(artifactPrizeSourceStatus === "missing_source" ? ["full_repick_budget_source_suspect"] : []),
      ],
    });
  }

  const suspectBudgetTeams = teamRows
    .filter((team) => team.validationBudgetSource !== "season_budget_only")
    .map((team) => ({
      teamCode: team.teamCode,
      status: team.validationBudgetSource,
      startingCash: team.startingCash,
      budget: gameState.teams.find((entry) => entry.teamId === team.teamId)?.budget ?? null,
    }));
  const highestSpendTeams = [...teamRows]
    .sort((left, right) => right.actualSpend - left.actualSpend)
    .slice(0, 8)
    .map((team) => ({
      teamCode: team.teamCode,
      spend: team.actualSpend,
      spendRatio: team.spendRatio,
    }));

  const decision: AuditDecision =
    artifactMap.artifactStatus === "stale" && suspectBudgetTeams.length > 0
      ? "mischung"
      : artifactMap.artifactStatus === "stale"
        ? "exportproblem"
        : suspectBudgetTeams.length > 0
          ? "budgetproblem"
          : teamsBelowMinimum > 0
            ? "plannerproblem"
            : "mischung";

  return {
    source: "sqlite",
    readOnly: true,
    saveContext,
    runArtifact: {
      status: artifactMap.artifactStatus,
      artifactPath: artifact.artifactPath,
      artifactSaveId: artifact.saveId,
      artifactSaveName: artifact.saveName,
      artifactAppliedPickCount: artifact.appliedPickCount,
      currentResettableTransferCount: resettableTransfers.length,
    },
    summary: {
      saveStartedEmpty: teamRows.every((team) => team.startRosterBeforeFullRepick === 0),
      saveStartedEmptySource: "active_roster_vs_resettable_transfers",
      comparedTeams: teamRows.length,
      teamsBelowMinimum,
      totalResettableTransfers: resettableTransfers.length,
      totalFinalRosterPlayers: gameState.rosters.length,
      totalSpend: roundValue(totalSpend, 2),
      totalRemainingCash: roundValue(totalRemainingCash, 2),
      totalBerserker,
      totalWarlord,
      berserkerWarlordSharePct:
        resettableTransfers.length > 0 ? roundValue(((totalBerserker + totalWarlord) / resettableTransfers.length) * 100, 2) : null,
      roleDistribution: sortCountEntries(roleCounts) as Array<{ label: AuditRoleLabel; count: number }>,
      laneExportDiagnosis:
        artifactMap.artifactStatus === "usable"
          ? "planner_lane_available"
          : artifactMap.artifactStatus === "stale"
            ? "planner_lane_artifact_stale_export_used_legacy_role_tag"
            : "planner_lane_missing_export_used_legacy_role_tag",
      decision,
    },
    globalBudgetAudit: {
      averageSpendRatio: average(teamRows.map((team) => team.spendRatio)),
      highestSpendTeams,
      suspectBudgetTeams,
    },
    focusTeams: teamRows
      .filter((team) => FOCUS_TEAMS.has(team.teamCode))
      .map((team) => ({
        teamCode: team.teamCode,
        teamName: team.teamName,
        coreIdentityFulfilled: team.teamIdentityStatus.coreIdentityFulfilled,
        primaryAxisCoverage: team.teamIdentityStatus.primaryAxisCoverage,
        formColorCoverage: team.teamIdentityStatus.formColorCoverage,
        offThemePicks: team.teamIdentityStatus.offThemePicks,
        strategicExceptions: team.teamIdentityStatus.strategicExceptions,
        retoolNearness: team.teamIdentityStatus.retoolNearness,
      })),
    teams: teamRows,
    warnings: uniqueWarnings([
      ...warnings,
      ...(teamsBelowMinimum > 0 ? ["minimum_not_reached_for_some_teams"] : []),
      ...(suspectBudgetTeams.length > 0 ? ["full_repick_budget_source_suspect"] : []),
      ...(totalOffTheme > 0 ? ["off_theme_picks_present"] : []),
      ...(totalClassSpam > 0 ? ["legacy_role_tag_export_bug_present"] : []),
    ]),
  };
}

function uniqueWarnings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
