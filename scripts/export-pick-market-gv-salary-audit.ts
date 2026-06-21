import fs from "node:fs";
import path from "node:path";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  applyAiMarketPlanLocally,
  type AiMarketPlanApplyResult,
  type AiMarketPlanApplyTeamResult,
} from "@/lib/ai/ai-market-plan-apply-service";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
  type ChunkedRedraftPickRow,
} from "@/lib/ai/chunked-redraft-topup-service";
import type { GameState, RosterEntry, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { getTeamGeneralManager, withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import { previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import { getPrimaryTeamRivalry } from "@/lib/rivalries/team-rivalries";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";

const OUTPUT_ROOT = process.env.OLY_EXPORT_DIR ?? "outputs";
const OUTPUT_DIR =
  process.env.OLY_PICK_MARKET_GV_AUDIT_OUTPUT_DIR ??
  path.join(OUTPUT_ROOT, `pick-market-gv-salary-audit-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);

const RUNS = parsePositiveInt(process.env.OLY_PICK_MARKET_GV_AUDIT_RUNS, 5);
const ROUND_LIMIT = parsePositiveInt(process.env.OLY_PICK_MARKET_GV_AUDIT_ROUND_LIMIT, 18);
const TEAM_TIME_LIMIT_MS = parsePositiveInt(process.env.OLY_PICK_MARKET_GV_AUDIT_TEAM_TIME_LIMIT_MS, 10_000);
const WATCHDOG_MS = parsePositiveInt(process.env.OLY_PICK_MARKET_GV_AUDIT_WATCHDOG_MS, 30_000);
const SALARY_FACTOR = parseFiniteNumber(process.env.OLY_PICK_MARKET_AUDIT_SALARY_FACTOR, 0.9);
const POSITIVE_GUV_DELTA = parseFiniteNumber(process.env.OLY_PICK_MARKET_AUDIT_POSITIVE_GUV, 15);
const NEGATIVE_GUV_DELTA = parseFiniteNumber(process.env.OLY_PICK_MARKET_AUDIT_NEGATIVE_GUV, -15);

type GvGroup = "plus_15" | "minus_15";

type TeamSnapshot = {
  teamId: string;
  teamCode: string;
  teamName: string;
  cash: number;
  rosterCount: number;
  playerMin: number;
  playerOpt: number;
  playerMax: number;
  salaryTotal: number;
  marketValueTotal: number;
};

type TeamAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmId: string;
  gmName: string;
  gmArchetype: string;
  gmTitle: string;
  gmSource: string;
  gmCashPriority: number | null;
  gmWageSensitivity: number | null;
  gmRiskTolerance: number | null;
  gmStarPriority: number | null;
  gmRosterDepthPreference: number | null;
  gmEliteSmallRosterPreference: number | null;
  gvGroup: GvGroup;
  gvDelta: number;
  rosterAfterDraft: number;
  rosterAfterMarket: number;
  playerMin: number;
  playerOpt: number;
  playerMax: number;
  cashAfterDraft: number;
  cashAfterGv: number;
  cashAfterMarket: number;
  salaryAfterDraft: number;
  salaryAfterFactor: number;
  salaryAfterMarket: number;
  marketValueAfterDraft: number;
  marketValueAfterMarket: number;
  plannedSells: number;
  plannedBuys: number;
  executedSells: number;
  executedBuys: number;
  result: string;
  previewStatus: string;
  warnings: string;
  blockers: string;
};

type ActionAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmArchetype: string;
  gmName: string;
  gmSource: string;
  gvGroup: GvGroup;
  action: "buy" | "sell";
  playerId: string;
  playerName: string;
  amount: number | null;
  salaryImpact: number | null;
  status: string;
  reason: string;
};

type RunSummaryRow = {
  run: number;
  saveId: string;
  draftValid: boolean;
  draftPicks: number;
  draftTransferHistory: number;
  negativeCashAfterGv: number;
  negativeCashAfterMarket: number;
  plusTeams: number;
  plusExecutedBuys: number;
  plusExecutedSells: number;
  minusTeams: number;
  minusExecutedBuys: number;
  minusExecutedSells: number;
  marketStatus: string;
  marketAppliedBuys: number;
  marketAppliedSells: number;
  marketBlockedTeams: number;
  marketWarningTeams: number;
  durationMs: number;
};

type GmImpactRow = {
  gmArchetype: string;
  teams: number;
  buys: number;
  sells: number;
  avgCashAfterDraft: number;
  avgCashAfterGv: number;
  avgCashAfterMarket: number;
  avgRosterAfterMarket: number;
  negativeAfterMarket: number;
  passiveMinusPressure: number;
  highCashNoAction: number;
};

type CashSellPressureAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  gmSource: string;
  gvGroup: GvGroup;
  cashAfterDraft: number;
  cashAfterGv: number;
  cashAfterMarket: number;
  rosterAfterMarket: number;
  playerMin: number;
  playerOpt: number;
  salaryAfterMarket: number;
  salaryToMarketValuePct: number;
  plannedSells: number;
  plannedBuys: number;
  executedSells: number;
  executedBuys: number;
  negativeAfterMarket: boolean;
  thinRoster: boolean;
  expensiveRoster: boolean;
  passiveUnderPressure: boolean;
  diagnosis: string;
  blockers: string;
  warnings: string;
};

type DraftDiversityAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  rosterCount: number;
  playerOpt: number;
  cashAfterDraft: number;
  marketValueAfterDraft: number;
  salaryAfterDraft: number;
  avgPow: number;
  avgSpe: number;
  avgMen: number;
  avgSoc: number;
  dominantArea: string;
  dominantAreaSharePct: number;
  classCount: number;
  raceCount: number;
  areaCount: number;
  diversityStatus: "ok" | "watch" | "red";
  diagnosis: string;
};

type MwSalaryGuardRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  marketValue: number;
  salary: number;
  salaryToMarketValuePct: number;
  contractLength: number;
  contractShape: string;
  guardStatus: "ok" | "watch" | "red";
  diagnosis: string;
};

type ContractRenewalExitAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  controlMode: string;
  currentLength: number;
  lengthAfterTick: number;
  statusBeforeTick: string;
  statusAfterTick: string;
  currentSalary: number;
  renewalSalaryPreview: number | null;
  exitValue: number | null;
  marketValueAtExit: number | null;
  recommendedAction: string;
  renewalSalaryIncreasePct: number | null;
  guardStatus: "ok" | "watch" | "red";
  warnings: string;
  blockers: string;
};

type BoardObjectiveRealismAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamName: string;
  objectiveId: string;
  category: string;
  label: string;
  currentValue: string;
  targetValue: string;
  status: string;
  boardConfidence: number | null;
  boardPressure: number | null;
  realismStatus: "ok" | "watch" | "red";
  diagnosis: string;
  source: string;
};

type ManagerAiGmBehaviorAuditRow = {
  run: number;
  gmArchetype: string;
  teams: number;
  avgDraftPicks: number;
  avgPickScore: number;
  avgIdentityFit: number;
  avgBudgetFit: number;
  avgValueScore: number;
  avgCashAfterMarket: number;
  buys: number;
  sells: number;
  negativeAfterMarket: number;
  behaviorSignal: string;
};

type ManagerAiTeamIdentityFitAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  strategySummary: string;
  preferredClasses: string;
  preferredRaces: string;
  preferredTraits: string;
  rosterCount: number;
  avgIdentityFit: number;
  avgClassFit: number;
  avgThemeScore: number;
  preferredClassSharePct: number;
  preferredRaceSharePct: number;
  preferredTraitPlayerSharePct: number;
  avoidedClassPicks: number;
  avoidedRacePicks: number;
  loreMismatchPicks: number;
  status: "ok" | "watch" | "red";
  diagnosis: string;
};

type ManagerAiDraftPickReasoningAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmArchetype: string;
  pickRound: number;
  playerName: string;
  phase: string;
  roleFilled: string;
  marketBoardTier: string;
  selectedScore: number;
  identityFit: number;
  classFit: number;
  budgetFit: number;
  valueScore: number;
  candidateCount: number;
  whySelected: string;
  whyRejectedOthers: string;
  topRejectedCandidates: string;
  status: "ok" | "watch" | "red";
  diagnosis: string;
};

type ManagerAiTransferIntentAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  gvGroup: GvGroup;
  cashAfterGv: number;
  cashAfterMarket: number;
  salaryAfterMarket: number;
  marketValueAfterMarket: number;
  plannedBuys: number;
  plannedSells: number;
  executedBuys: number;
  executedSells: number;
  buySpend: number;
  sellIncome: number;
  intentStatus: "ok" | "watch" | "red";
  diagnosis: string;
  reasons: string;
};

type ManagerAiTrainingFacilityPriorityAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  facilityPriorities: string;
  inferredTrainingFocus: string;
  weakestRosterAxis: string;
  strongestRosterAxis: string;
  powBias: number | null;
  speBias: number | null;
  menBias: number | null;
  socBias: number | null;
  priorityStatus: "ok" | "watch";
  diagnosis: string;
};

type ManagerAiFormTraitBonusAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  rosterCount: number;
  gmPreferredTraits: string;
  strategyPreferredTraits: string;
  coveredPreferredTraits: string;
  preferredTraitPlayers: number;
  negativeTraitPlayers: number;
  riskyTraitPlayers: number;
  readinessStatus: "ok" | "watch" | "red";
  diagnosis: string;
};

type ManagerAiRivalryMoraleAuditRow = {
  run: number;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  gmArchetype: string;
  primaryRival: string;
  rivalryIntensity: number | null;
  avgMorale: number;
  unhappyPlayers: number;
  refusalRiskPlayers: number;
  moraleWarnings: number;
  rivalryObjectives: number;
  status: "ok" | "watch" | "red";
  diagnosis: string;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseFiniteNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number | null | undefined, decimals = 2) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Number(numeric.toFixed(decimals));
}

function csvCell(value: unknown) {
  if (value == null) {
    return "";
  }
  const text = String(value);
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function writeCsv(filePath: string, rows: Array<Record<string, unknown>>, columns: string[]) {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function assertAuditSaveIsNotActive(persistence: ReturnType<typeof createPersistenceService>, auditSaveId: string, stage: string) {
  const activeSaveId = persistence.getActiveSave()?.saveId ?? null;
  if (activeSaveId === auditSaveId) {
    throw new Error(`audit_save_became_active:${auditSaveId}:${stage}`);
  }
}

function saveArchivedAuditState(
  persistence: ReturnType<typeof createPersistenceService>,
  saveId: string,
  gameState: GameState,
) {
  return persistence.saveSingleplayerState(saveId, gameState, { status: "archived" });
}

function restorePreviousActiveSave(
  persistence: ReturnType<typeof createPersistenceService>,
  previousActiveSaveId: string | null,
  auditSaveId: string,
  stage: string,
) {
  const activeSaveId = persistence.getActiveSave()?.saveId ?? null;
  if (activeSaveId === auditSaveId && previousActiveSaveId && previousActiveSaveId !== auditSaveId) {
    persistence.activateSave(previousActiveSaveId);
  }
  assertAuditSaveIsNotActive(persistence, auditSaveId, stage);
}

function getTeamControlSettingsForAi(team: Team, current?: TeamControlSettings | null): TeamControlSettings {
  return {
    ...(current ?? {
      teamId: team.teamId,
      controlMode: "ai",
      ownerId: "ai",
      ownerSlot: "ai",
      displayLabel: team.shortCode,
      aiLineupPreviewEnabled: true,
      aiLineupApplyEnabled: true,
      aiLineupAutoApplyEnabled: true,
      aiTransferPreviewEnabled: true,
      aiTransferAutoApplyEnabled: true,
      aiSellPreviewEnabled: true,
      aiSellAutoApplyEnabled: true,
      notes: null,
      strategyLock: null,
    }),
    teamId: team.teamId,
    controlMode: "ai",
    ownerId: "ai",
    ownerSlot: "ai",
    displayLabel: team.shortCode,
    aiLineupPreviewEnabled: true,
    aiLineupApplyEnabled: true,
    aiLineupAutoApplyEnabled: true,
    aiTransferPreviewEnabled: true,
    aiTransferAutoApplyEnabled: true,
    aiSellPreviewEnabled: true,
    aiSellAutoApplyEnabled: true,
  };
}

function withAllTeamsAi(gameState: GameState): GameState {
  const teams = gameState.teams.map((team) => ({ ...team, humanControlled: false }));
  const normalized = buildTeamControlSettingsMap(teams, gameState.seasonState.teamControlSettings);
  const teamControlSettings = Object.fromEntries(
    teams.map((team) => [team.teamId, getTeamControlSettingsForAi(team, normalized[team.teamId])] as const),
  );

  return withNormalizedTeamGeneralManagers({
    ...gameState,
    teams,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings,
    },
  });
}

function getRostersByTeam(gameState: GameState) {
  const rostersByTeam = new Map<string, RosterEntry[]>();
  for (const entry of gameState.rosters) {
    rostersByTeam.set(entry.teamId, [...(rostersByTeam.get(entry.teamId) ?? []), entry]);
  }
  return rostersByTeam;
}

function snapshotTeams(gameState: GameState) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const identityByTeamId = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const rostersByTeam = getRostersByTeam(gameState);
  const snapshots = new Map<string, TeamSnapshot>();

  for (const team of gameState.teams) {
    const roster = rostersByTeam.get(team.teamId) ?? [];
    const targets = deriveRosterTargets(team, identityByTeamId.get(team.teamId));
    const salaryTotal = roster.reduce((sum, entry) => {
      const player = playersById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0);
    const marketValueTotal = roster.reduce((sum, entry) => {
      const player = playersById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue ?? 0);
    }, 0);
    snapshots.set(team.teamId, {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      cash: round(team.cash),
      rosterCount: roster.length,
      playerMin: targets.playerMin,
      playerOpt: targets.playerOpt,
      playerMax: targets.playerMax,
      salaryTotal: round(salaryTotal),
      marketValueTotal: round(marketValueTotal),
    });
  }

  return snapshots;
}

function applySalaryFactorAndGvSplit(gameState: GameState) {
  const sortedTeams = [...gameState.teams].sort((left, right) => left.shortCode.localeCompare(right.shortCode, "de"));
  const gvByTeamId = new Map<string, { gvGroup: GvGroup; gvDelta: number }>();
  sortedTeams.forEach((team, index) => {
    const gvGroup: GvGroup = index % 2 === 0 ? "plus_15" : "minus_15";
    gvByTeamId.set(team.teamId, {
      gvGroup,
      gvDelta: gvGroup === "plus_15" ? POSITIVE_GUV_DELTA : NEGATIVE_GUV_DELTA,
    });
  });

  const rosters = gameState.rosters.map((entry) => ({
    ...entry,
    salary: round(entry.salary * SALARY_FACTOR),
    upkeep: round(entry.upkeep * SALARY_FACTOR),
    yearlySalarySchedule: entry.yearlySalarySchedule?.map((item) => ({
      ...item,
      salary: round(item.salary * SALARY_FACTOR),
    })),
  }));
  const teams = gameState.teams.map((team) => ({
    ...team,
    cash: round(team.cash + (gvByTeamId.get(team.teamId)?.gvDelta ?? 0)),
  }));

  return {
    gameState: withScenarioMeta(
      {
        ...gameState,
        teams,
        rosters,
      },
      {
        scenarioType: "ai_redraft_test",
        label: gameState.scenarioMeta?.label ?? "Pick/Market GuV Audit",
        description: `Audit-Harness: Salary-Faktor ${SALARY_FACTOR} testweise auf aktive Gehaelter; Teams alphabetisch 50/50 mit ${POSITIVE_GUV_DELTA}/${NEGATIVE_GUV_DELTA} Cash-Guv-Delta.`,
        allowTestWrites: true,
        isStableTestPoint: false,
        gamePhase: "transfer_window",
      },
    ),
    gvByTeamId,
  };
}

function buildActionRows(input: {
  run: number;
  saveId: string;
  gvByTeamId: Map<string, { gvGroup: GvGroup; gvDelta: number }>;
  teams: AiMarketPlanApplyTeamResult[];
  gameState: GameState;
}): ActionAuditRow[] {
  const rows: ActionAuditRow[] = [];
  for (const team of input.teams) {
    const gv = input.gvByTeamId.get(team.teamId)?.gvGroup ?? "plus_15";
    const gm = getTeamGeneralManager(input.gameState, team.teamId);
    for (const step of team.appliedSellDetails) {
      rows.push({
        run: input.run,
        saveId: input.saveId,
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        gmArchetype: gm?.profile.archetype ?? "",
        gmName: gm?.profile.name ?? "",
        gmSource: gm?.assignment.source ?? "",
        gvGroup: gv,
        action: "sell",
        playerId: step.playerId,
        playerName: step.playerName,
        amount: step.amount,
        salaryImpact: step.salaryImpact,
        status: step.status,
        reason: step.reason,
      });
    }
    for (const step of team.appliedBuyDetails) {
      rows.push({
        run: input.run,
        saveId: input.saveId,
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        gmArchetype: gm?.profile.archetype ?? "",
        gmName: gm?.profile.name ?? "",
        gmSource: gm?.assignment.source ?? "",
        gvGroup: gv,
        action: "buy",
        playerId: step.playerId,
        playerName: step.playerName,
        amount: step.amount,
        salaryImpact: step.salaryImpact,
        status: step.status,
        reason: step.reason,
      });
    }
  }
  return rows;
}

function countNegativeCash(snapshots: Map<string, TeamSnapshot>) {
  return [...snapshots.values()].filter((entry) => entry.cash < 0).length;
}

function sumForGroup(
  teams: AiMarketPlanApplyTeamResult[],
  gvByTeamId: Map<string, { gvGroup: GvGroup; gvDelta: number }>,
  group: GvGroup,
  key: "executedBuys" | "executedSells",
) {
  return teams
    .filter((team) => gvByTeamId.get(team.teamId)?.gvGroup === group)
    .reduce((sum, team) => sum + team[key], 0);
}

function buildGmImpactRows(teamRows: TeamAuditRow[]): GmImpactRow[] {
  const byArchetype = new Map<string, {
    gmArchetype: string;
    teams: number;
    buys: number;
    sells: number;
    cashAfterDraft: number;
    cashAfterGv: number;
    cashAfterMarket: number;
    rosterAfterMarket: number;
    negativeAfterMarket: number;
    passiveMinusPressure: number;
    highCashNoAction: number;
  }>();
  for (const row of teamRows) {
    const gmArchetype = row.gmArchetype || "unknown";
    const current = byArchetype.get(gmArchetype) ?? {
      gmArchetype,
      teams: 0,
      buys: 0,
      sells: 0,
      cashAfterDraft: 0,
      cashAfterGv: 0,
      cashAfterMarket: 0,
      rosterAfterMarket: 0,
      negativeAfterMarket: 0,
      passiveMinusPressure: 0,
      highCashNoAction: 0,
    };
    current.teams += 1;
    current.buys += row.executedBuys;
    current.sells += row.executedSells;
    current.cashAfterDraft += row.cashAfterDraft;
    current.cashAfterGv += row.cashAfterGv;
    current.cashAfterMarket += row.cashAfterMarket;
    current.rosterAfterMarket += row.rosterAfterMarket;
    if (row.cashAfterMarket < 0) current.negativeAfterMarket += 1;
    if (row.gvGroup === "minus_15" && row.cashAfterGv < 8 && row.executedBuys === 0 && row.executedSells === 0) {
      current.passiveMinusPressure += 1;
    }
    if (row.gvGroup === "plus_15" && row.cashAfterGv > 20 && row.executedBuys === 0 && row.executedSells === 0) {
      current.highCashNoAction += 1;
    }
    byArchetype.set(gmArchetype, current);
  }
  return [...byArchetype.values()]
    .map((row) => ({
      gmArchetype: row.gmArchetype,
      teams: row.teams,
      buys: row.buys,
      sells: row.sells,
      avgCashAfterDraft: round(row.cashAfterDraft / Math.max(1, row.teams), 2),
      avgCashAfterGv: round(row.cashAfterGv / Math.max(1, row.teams), 2),
      avgCashAfterMarket: round(row.cashAfterMarket / Math.max(1, row.teams), 2),
      avgRosterAfterMarket: round(row.rosterAfterMarket / Math.max(1, row.teams), 2),
      negativeAfterMarket: row.negativeAfterMarket,
      passiveMinusPressure: row.passiveMinusPressure,
      highCashNoAction: row.highCashNoAction,
    }))
    .sort((left, right) => right.buys + right.sells - (left.buys + left.sells));
}

function areaFromCoreStats(coreStats: { pow: number; spe: number; men: number; soc: number }) {
  const entries = [
    ["POW", coreStats.pow],
    ["SPE", coreStats.spe],
    ["MEN", coreStats.men],
    ["SOC", coreStats.soc],
  ] as const;
  return entries.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "UNK";
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickAverage(picks: ChunkedRedraftPickRow[], key: keyof ChunkedRedraftPickRow) {
  const values = picks.map((pick) => pick[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : 0;
}

function getRosterPlayers(gameState: GameState, teamId: string) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => playersById.get(entry.playerId))
    .filter(Boolean);
}

function buildRosterAxisProfile(gameState: GameState, teamId: string) {
  const players = getRosterPlayers(gameState, teamId);
  const totals = players.reduce(
    (sum, player) => ({
      POW: sum.POW + (player?.coreStats.pow ?? 0),
      SPE: sum.SPE + (player?.coreStats.spe ?? 0),
      MEN: sum.MEN + (player?.coreStats.men ?? 0),
      SOC: sum.SOC + (player?.coreStats.soc ?? 0),
    }),
    { POW: 0, SPE: 0, MEN: 0, SOC: 0 },
  );
  const count = Math.max(1, players.length);
  const averages = {
    POW: round(totals.POW / count, 1),
    SPE: round(totals.SPE / count, 1),
    MEN: round(totals.MEN / count, 1),
    SOC: round(totals.SOC / count, 1),
  };
  const entries = Object.entries(averages) as Array<[keyof typeof averages, number]>;
  const weakest = [...entries].sort((left, right) => left[1] - right[1])[0]?.[0] ?? "POW";
  const strongest = [...entries].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "POW";
  return { players, averages, weakest, strongest };
}

function buildCashSellPressureAuditRows(teamRows: TeamAuditRow[]): CashSellPressureAuditRow[] {
  return teamRows.map((row) => {
    const salaryToMarketValuePct =
      row.marketValueAfterMarket > 0 ? round((row.salaryAfterMarket / row.marketValueAfterMarket) * 100, 1) : 0;
    const negativeAfterMarket = row.cashAfterMarket < 0;
    const thinRoster = row.rosterAfterMarket < row.playerMin || row.rosterAfterMarket < Math.max(row.playerMin, row.playerOpt - 2);
    const expensiveRoster = salaryToMarketValuePct >= 26 || row.salaryAfterMarket >= row.cashAfterMarket + row.salaryAfterMarket * 1.1;
    const passiveUnderPressure = row.cashAfterGv < 8 && row.executedBuys === 0 && row.executedSells === 0;
    const diagnosis = [
      negativeAfterMarket ? "cash_negative_after_market" : null,
      thinRoster ? "thin_roster" : null,
      expensiveRoster ? "salary_pressure_high" : null,
      passiveUnderPressure ? "cash_pressure_without_action" : null,
      row.gvGroup === "plus_15" && row.cashAfterMarket > 40 && row.executedBuys === 0 ? "high_cash_no_upgrade_buy" : null,
      row.blockers ? "market_blockers_present" : null,
    ].filter(Boolean).join("|") || "ok";

    return {
      run: row.run,
      saveId: row.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gmName: row.gmName,
      gmArchetype: row.gmArchetype,
      gmSource: row.gmSource,
      gvGroup: row.gvGroup,
      cashAfterDraft: row.cashAfterDraft,
      cashAfterGv: row.cashAfterGv,
      cashAfterMarket: row.cashAfterMarket,
      rosterAfterMarket: row.rosterAfterMarket,
      playerMin: row.playerMin,
      playerOpt: row.playerOpt,
      salaryAfterMarket: row.salaryAfterMarket,
      salaryToMarketValuePct,
      plannedSells: row.plannedSells,
      plannedBuys: row.plannedBuys,
      executedSells: row.executedSells,
      executedBuys: row.executedBuys,
      negativeAfterMarket,
      thinRoster,
      expensiveRoster,
      passiveUnderPressure,
      diagnosis,
      blockers: row.blockers,
      warnings: row.warnings,
    };
  });
}

function buildManagerAiGmBehaviorAuditRows(input: {
  run: number;
  teamRows: TeamAuditRow[];
  picks: ChunkedRedraftPickRow[];
}): ManagerAiGmBehaviorAuditRow[] {
  const byArchetype = new Map<string, {
    gmArchetype: string;
    teams: number;
    draftPicks: number;
    pickScore: number;
    identityFit: number;
    budgetFit: number;
    valueScore: number;
    cashAfterMarket: number;
    buys: number;
    sells: number;
    negativeAfterMarket: number;
  }>();
  const picksByTeam = new Map<string, ChunkedRedraftPickRow[]>();
  for (const pick of input.picks) {
    picksByTeam.set(pick.teamId, [...(picksByTeam.get(pick.teamId) ?? []), pick]);
  }

  for (const row of input.teamRows) {
    const gmArchetype = row.gmArchetype || "unknown";
    const teamPicks = picksByTeam.get(row.teamId) ?? [];
    const current = byArchetype.get(gmArchetype) ?? {
      gmArchetype,
      teams: 0,
      draftPicks: 0,
      pickScore: 0,
      identityFit: 0,
      budgetFit: 0,
      valueScore: 0,
      cashAfterMarket: 0,
      buys: 0,
      sells: 0,
      negativeAfterMarket: 0,
    };
    current.teams += 1;
    current.draftPicks += teamPicks.length;
    current.pickScore += pickAverage(teamPicks, "selectedScore") || pickAverage(teamPicks, "pickScore");
    current.identityFit += pickAverage(teamPicks, "identityFit");
    current.budgetFit += pickAverage(teamPicks, "budgetFit");
    current.valueScore += pickAverage(teamPicks, "valueScore");
    current.cashAfterMarket += row.cashAfterMarket;
    current.buys += row.executedBuys;
    current.sells += row.executedSells;
    if (row.cashAfterMarket < 0) current.negativeAfterMarket += 1;
    byArchetype.set(gmArchetype, current);
  }

  return [...byArchetype.values()].map((row) => {
    const avgCashAfterMarket = round(row.cashAfterMarket / Math.max(1, row.teams), 2);
    const behaviorSignal = [
      row.gmArchetype.includes("bargain") && row.buys > row.sells && avgCashAfterMarket < 5 ? "value_gm_spending_too_hard" : null,
      row.gmArchetype.includes("star") && row.buys === 0 ? "star_gm_no_buy_signal" : null,
      row.negativeAfterMarket > 0 ? "negative_cash_cases" : null,
      row.sells === 0 && row.negativeAfterMarket > 0 ? "pressure_without_sells" : null,
    ].filter(Boolean).join("|") || "ok";
    return {
      run: input.run,
      gmArchetype: row.gmArchetype,
      teams: row.teams,
      avgDraftPicks: round(row.draftPicks / Math.max(1, row.teams), 2),
      avgPickScore: round(row.pickScore / Math.max(1, row.teams), 2),
      avgIdentityFit: round(row.identityFit / Math.max(1, row.teams), 2),
      avgBudgetFit: round(row.budgetFit / Math.max(1, row.teams), 2),
      avgValueScore: round(row.valueScore / Math.max(1, row.teams), 2),
      avgCashAfterMarket,
      buys: row.buys,
      sells: row.sells,
      negativeAfterMarket: row.negativeAfterMarket,
      behaviorSignal,
    };
  }).sort((left, right) => right.teams - left.teams || left.gmArchetype.localeCompare(right.gmArchetype, "de"));
}

function buildManagerAiTeamIdentityFitAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
  teamRows: TeamAuditRow[];
  picks: ChunkedRedraftPickRow[];
}): ManagerAiTeamIdentityFitAuditRow[] {
  const picksByTeam = new Map<string, ChunkedRedraftPickRow[]>();
  for (const pick of input.picks) {
    picksByTeam.set(pick.teamId, [...(picksByTeam.get(pick.teamId) ?? []), pick]);
  }

  return input.teamRows.map((row) => {
    const strategy = getTeamStrategyProfile(input.gameState, row.teamId);
    const teamPicks = picksByTeam.get(row.teamId) ?? [];
    const players = getRosterPlayers(input.gameState, row.teamId);
    const preferredClasses = new Set((strategy?.preferredClasses ?? []).map(normalizeToken));
    const preferredRaces = new Set((strategy?.preferredRaces ?? []).map(normalizeToken));
    const preferredTraits = new Set([...(strategy?.preferredTraits ?? [])].map(normalizeToken));
    const avoidedClasses = new Set([...(strategy?.avoidedClasses ?? []), ...(strategy?.dislikedClasses ?? [])].map(normalizeToken));
    const avoidedRaces = new Set([...(strategy?.avoidedRaces ?? []), ...(strategy?.dislikedRaces ?? [])].map(normalizeToken));
    let preferredClassPlayers = 0;
    let preferredRacePlayers = 0;
    let preferredTraitPlayers = 0;
    let avoidedClassPicks = 0;
    let avoidedRacePicks = 0;
    for (const player of players) {
      if (!player) continue;
      const playerClass = normalizeToken(player.className);
      const playerRace = normalizeToken(player.race);
      const traits = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeToken);
      if (preferredClasses.size > 0 && preferredClasses.has(playerClass)) preferredClassPlayers += 1;
      if (preferredRaces.size > 0 && preferredRaces.has(playerRace)) preferredRacePlayers += 1;
      if (traits.some((trait) => preferredTraits.has(trait))) preferredTraitPlayers += 1;
      if (avoidedClasses.has(playerClass)) avoidedClassPicks += 1;
      if (avoidedRaces.has(playerRace)) avoidedRacePicks += 1;
    }
    const loreMismatchPicks = teamPicks.filter((pick) => (pick.identityFit ?? 0) < -20 || (pick.classFit ?? 0) < -20).length;
    const avgIdentityFit = pickAverage(teamPicks, "identityFit");
    const avgClassFit = pickAverage(teamPicks, "classFit");
    const avgThemeScore = pickAverage(teamPicks, "themeCompositionScore");
    const rosterCount = Math.max(1, players.length);
    const diagnosis = [
      avoidedClassPicks > 0 ? "avoided_class_picked" : null,
      avoidedRacePicks > 0 ? "avoided_race_picked" : null,
      loreMismatchPicks >= 4 ? "many_lore_mismatch_picks" : null,
      avgIdentityFit < -25 ? "identity_fit_low_but_not_hard_blocker" : null,
      preferredClasses.size > 0 && preferredClassPlayers === 0 ? "no_preferred_class_signal" : null,
      preferredRaces.size > 0 && preferredRacePlayers === 0 ? "no_preferred_race_signal" : null,
    ].filter(Boolean).join("|") || "ok";
    const status = avoidedClassPicks + avoidedRacePicks >= 4 || avgIdentityFit < -40
      ? "red"
      : diagnosis === "ok"
        ? "ok"
        : "watch";
    return {
      run: input.run,
      saveId: input.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gmName: row.gmName,
      gmArchetype: row.gmArchetype,
      strategySummary: strategy?.strategySummary ?? "",
      preferredClasses: (strategy?.preferredClasses ?? []).join("|"),
      preferredRaces: (strategy?.preferredRaces ?? []).join("|"),
      preferredTraits: (strategy?.preferredTraits ?? []).join("|"),
      rosterCount: players.length,
      avgIdentityFit,
      avgClassFit,
      avgThemeScore,
      preferredClassSharePct: round((preferredClassPlayers / rosterCount) * 100, 1),
      preferredRaceSharePct: round((preferredRacePlayers / rosterCount) * 100, 1),
      preferredTraitPlayerSharePct: round((preferredTraitPlayers / rosterCount) * 100, 1),
      avoidedClassPicks,
      avoidedRacePicks,
      loreMismatchPicks,
      status,
      diagnosis,
    };
  }).sort((left, right) => {
    const severity = { red: 2, watch: 1, ok: 0 };
    return severity[right.status] - severity[left.status] || left.teamCode.localeCompare(right.teamCode, "de");
  });
}

function buildManagerAiDraftPickReasoningAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
  teamRows: TeamAuditRow[];
  picks: ChunkedRedraftPickRow[];
}): ManagerAiDraftPickReasoningAuditRow[] {
  const teamById = new Map(input.teamRows.map((row) => [row.teamId, row] as const));
  return input.picks.map((pick) => {
    const team = teamById.get(pick.teamId);
    const identityFit = pick.identityFit ?? 0;
    const budgetFit = pick.budgetFit ?? 0;
    const classFit = pick.classFit ?? 0;
    const selectedScore = pick.selectedScore ?? pick.pickScore ?? 0;
    const diagnosis = [
      selectedScore < 0 ? "negative_selected_score" : null,
      budgetFit < -25 ? "budget_fit_bad" : null,
      identityFit < -35 ? "identity_lore_mismatch_review" : null,
      classFit < -35 ? "class_lore_mismatch_review" : null,
      (pick.candidateCount ?? 0) <= 2 ? "candidate_pool_too_thin" : null,
      !pick.whySelected ? "missing_why_selected" : null,
    ].filter(Boolean).join("|") || "ok";
    const status = selectedScore < 0 || budgetFit < -35 || (pick.candidateCount ?? 0) <= 1
      ? "red"
      : diagnosis === "ok"
        ? "ok"
        : "watch";
    return {
      run: input.run,
      saveId: input.saveId,
      teamId: pick.teamId,
      teamCode: team?.teamCode ?? pick.teamId,
      teamName: team?.teamName ?? pick.teamId,
      gmArchetype: team?.gmArchetype ?? pick.managerArchetype ?? "",
      pickRound: pick.round,
      playerName: pick.playerName,
      phase: pick.phase ?? "",
      roleFilled: pick.roleFilled ?? pick.role ?? "",
      marketBoardTier: pick.marketBoardTier ?? "",
      selectedScore: round(selectedScore, 2),
      identityFit: round(identityFit, 2),
      classFit: round(classFit, 2),
      budgetFit: round(budgetFit, 2),
      valueScore: round(pick.valueScore ?? 0, 2),
      candidateCount: pick.candidateCount ?? 0,
      whySelected: pick.whySelected ?? "",
      whyRejectedOthers: pick.whyRejectedOthers ?? "",
      topRejectedCandidates: pick.topRejectedCandidates ?? "",
      status,
      diagnosis,
    };
  }).filter((row) => row.status !== "ok" || row.pickRound <= 2)
    .sort((left, right) => {
      const severity = { red: 2, watch: 1, ok: 0 };
      return severity[right.status] - severity[left.status] || left.teamCode.localeCompare(right.teamCode, "de") || left.pickRound - right.pickRound;
    });
}

function buildManagerAiTransferIntentAuditRows(input: {
  teamRows: TeamAuditRow[];
  actionRows: ActionAuditRow[];
}): ManagerAiTransferIntentAuditRow[] {
  const actionsByTeam = new Map<string, ActionAuditRow[]>();
  for (const action of input.actionRows) {
    actionsByTeam.set(action.teamId, [...(actionsByTeam.get(action.teamId) ?? []), action]);
  }
  return input.teamRows.map((row) => {
    const actions = actionsByTeam.get(row.teamId) ?? [];
    const buySpend = round(actions.filter((action) => action.action === "buy").reduce((sum, action) => sum + (action.amount ?? 0), 0), 2);
    const sellIncome = round(actions.filter((action) => action.action === "sell").reduce((sum, action) => sum + (action.amount ?? 0), 0), 2);
    const diagnosis = [
      row.cashAfterMarket < 0 ? "cash_negative_after_market" : null,
      row.cashAfterGv < 0 && row.executedSells === 0 ? "negative_cash_without_sell" : null,
      row.cashAfterGv > 40 && row.executedBuys === 0 ? "large_cash_without_buy" : null,
      row.plannedBuys > row.executedBuys ? "planned_buys_not_executed" : null,
      row.plannedSells > row.executedSells ? "planned_sells_not_executed" : null,
      row.warnings ? "market_warnings" : null,
      row.blockers ? "market_blockers" : null,
    ].filter(Boolean).join("|") || "ok";
    const intentStatus = row.cashAfterMarket < 0 || (row.cashAfterGv < 0 && row.executedSells === 0) || row.blockers
      ? "red"
      : diagnosis === "ok"
        ? "ok"
        : "watch";
    return {
      run: row.run,
      saveId: row.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gmName: row.gmName,
      gmArchetype: row.gmArchetype,
      gvGroup: row.gvGroup,
      cashAfterGv: row.cashAfterGv,
      cashAfterMarket: row.cashAfterMarket,
      salaryAfterMarket: row.salaryAfterMarket,
      marketValueAfterMarket: row.marketValueAfterMarket,
      plannedBuys: row.plannedBuys,
      plannedSells: row.plannedSells,
      executedBuys: row.executedBuys,
      executedSells: row.executedSells,
      buySpend,
      sellIncome,
      intentStatus,
      diagnosis,
      reasons: actions.map((action) => `${action.action}:${action.playerName}:${action.reason}`).join("|"),
    };
  }).sort((left, right) => {
    const severity = { red: 2, watch: 1, ok: 0 };
    return severity[right.intentStatus] - severity[left.intentStatus] || left.teamCode.localeCompare(right.teamCode, "de");
  });
}

function buildManagerAiTrainingFacilityPriorityAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
  teamRows: TeamAuditRow[];
}): ManagerAiTrainingFacilityPriorityAuditRow[] {
  return input.teamRows.map((row) => {
    const gm = getTeamGeneralManager(input.gameState, row.teamId);
    const strategy = getTeamStrategyProfile(input.gameState, row.teamId);
    const rosterProfile = buildRosterAxisProfile(input.gameState, row.teamId);
    const biases = [
      ["POW", strategy?.powBias ?? 0],
      ["SPE", strategy?.speBias ?? 0],
      ["MEN", strategy?.menBias ?? 0],
      ["SOC", strategy?.socBias ?? 0],
    ] as const;
    const inferredTrainingFocus = [...biases].sort((left, right) => right[1] - left[1])[0]?.[0] ?? rosterProfile.weakest;
    const facilityPriorities = gm?.profile.facilityPriorities ?? [];
    const diagnosis = [
      facilityPriorities.length === 0 ? "no_facility_priority" : null,
      inferredTrainingFocus === rosterProfile.strongest && row.rosterAfterMarket < row.playerOpt ? "training_focus_ignores_roster_gap" : null,
      row.gmArchetype.includes("facility") && !facilityPriorities.includes("academy") ? "facility_gm_without_academy_priority" : null,
      row.gmArchetype.includes("star") && !facilityPriorities.includes("performance_lab") ? "star_gm_without_performance_priority" : null,
    ].filter(Boolean).join("|") || "ok";
    return {
      run: input.run,
      saveId: input.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gmName: row.gmName,
      gmArchetype: row.gmArchetype,
      facilityPriorities: facilityPriorities.join("|"),
      inferredTrainingFocus,
      weakestRosterAxis: rosterProfile.weakest,
      strongestRosterAxis: rosterProfile.strongest,
      powBias: strategy?.powBias ?? null,
      speBias: strategy?.speBias ?? null,
      menBias: strategy?.menBias ?? null,
      socBias: strategy?.socBias ?? null,
      priorityStatus: diagnosis === "ok" ? "ok" : "watch",
      diagnosis,
    };
  }).sort((left, right) => left.teamCode.localeCompare(right.teamCode, "de"));
}

function buildManagerAiFormTraitBonusAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
  teamRows: TeamAuditRow[];
}): ManagerAiFormTraitBonusAuditRow[] {
  const riskyTraits = new Set(["lazy", "diva", "timid", "paranoid", "mercenary", "gambler", "renegade", "fainthearted"]);
  return input.teamRows.map((row) => {
    const gm = getTeamGeneralManager(input.gameState, row.teamId);
    const strategy = getTeamStrategyProfile(input.gameState, row.teamId);
    const players = getRosterPlayers(input.gameState, row.teamId);
    const gmPreferred = new Set((gm?.profile.preferredTraits ?? []).map(normalizeToken));
    const strategyPreferred = new Set((strategy?.preferredTraits ?? []).map(normalizeToken));
    const covered = new Set<string>();
    let preferredTraitPlayers = 0;
    let negativeTraitPlayers = 0;
    let riskyTraitPlayers = 0;
    for (const player of players) {
      if (!player) continue;
      const traits = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeToken);
      const hasPreferred = traits.some((trait) => gmPreferred.has(trait) || strategyPreferred.has(trait));
      if (hasPreferred) preferredTraitPlayers += 1;
      for (const trait of traits) {
        if (gmPreferred.has(trait) || strategyPreferred.has(trait)) covered.add(trait);
        if (riskyTraits.has(trait)) riskyTraitPlayers += 1;
      }
      negativeTraitPlayers += player.traitsNegative?.length ?? 0;
    }
    const diagnosis = [
      preferredTraitPlayers === 0 ? "no_preferred_trait_carriers" : null,
      riskyTraitPlayers >= Math.max(4, players.length / 2) ? "many_risky_trait_carriers" : null,
      negativeTraitPlayers >= players.length ? "negative_traits_high" : null,
    ].filter(Boolean).join("|") || "ok";
    const readinessStatus = preferredTraitPlayers === 0
      ? "red"
      : diagnosis === "ok"
        ? "ok"
        : "watch";
    return {
      run: input.run,
      saveId: input.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gmName: row.gmName,
      gmArchetype: row.gmArchetype,
      rosterCount: players.length,
      gmPreferredTraits: (gm?.profile.preferredTraits ?? []).join("|"),
      strategyPreferredTraits: (strategy?.preferredTraits ?? []).join("|"),
      coveredPreferredTraits: [...covered].sort().join("|"),
      preferredTraitPlayers,
      negativeTraitPlayers,
      riskyTraitPlayers,
      readinessStatus,
      diagnosis,
    };
  }).sort((left, right) => {
    const severity = { red: 2, watch: 1, ok: 0 };
    return severity[right.readinessStatus] - severity[left.readinessStatus] || left.teamCode.localeCompare(right.teamCode, "de");
  });
}

function buildManagerAiRivalryMoraleAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
  teamRows: TeamAuditRow[];
}): ManagerAiRivalryMoraleAuditRow[] {
  const morale = buildPlayerMoraleAudit(input.gameState);
  const moraleRowsByTeam = new Map<string, typeof morale.rows>();
  for (const row of morale.rows) {
    moraleRowsByTeam.set(row.teamId, [...(moraleRowsByTeam.get(row.teamId) ?? []), row]);
  }
  const objectives = buildTeamObjectiveOverview(input.gameState).objectives;
  return input.teamRows.map((row) => {
    const teamMorale = moraleRowsByTeam.get(row.teamId) ?? [];
    const primaryRival = getPrimaryTeamRivalry(input.gameState, row.teamId);
    const avgMorale = teamMorale.length
      ? round(teamMorale.reduce((sum, entry) => sum + entry.morale, 0) / teamMorale.length, 1)
      : 0;
    const unhappyPlayers = teamMorale.filter((entry) => entry.visibleMood === "angry" || entry.visibleMood === "unhappy").length;
    const refusalRiskPlayers = teamMorale.filter((entry) => entry.contractIntent === "refuses_extension" || entry.contractIntent === "considering_exit").length;
    const moraleWarnings = teamMorale.filter((entry) => entry.warnings.length > 0).length;
    const rivalryObjectives = objectives.filter((objective) => objective.teamId === row.teamId && (objective.source ?? "").includes("rival")).length;
    const diagnosis = [
      teamMorale.length === 0 ? "morale_rows_missing" : null,
      primaryRival && rivalryObjectives === 0 ? "rivalry_exists_without_objective_signal" : null,
      avgMorale < 45 ? "team_morale_low" : null,
      refusalRiskPlayers >= 2 ? "multiple_contract_refusal_risks" : null,
      moraleWarnings >= 4 ? "many_morale_warnings" : null,
    ].filter(Boolean).join("|") || "ok";
    const status = teamMorale.length === 0 || avgMorale < 35 || refusalRiskPlayers >= 4
      ? "red"
      : diagnosis === "ok"
        ? "ok"
        : "watch";
    return {
      run: input.run,
      saveId: input.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gmName: row.gmName,
      gmArchetype: row.gmArchetype,
      primaryRival: primaryRival?.label ?? "",
      rivalryIntensity: primaryRival?.intensity ?? null,
      avgMorale,
      unhappyPlayers,
      refusalRiskPlayers,
      moraleWarnings,
      rivalryObjectives,
      status,
      diagnosis,
    };
  }).sort((left, right) => {
    const severity = { red: 2, watch: 1, ok: 0 };
    return severity[right.status] - severity[left.status] || left.teamCode.localeCompare(right.teamCode, "de");
  });
}

function buildDraftDiversityAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
  teamRows: TeamAuditRow[];
}): DraftDiversityAuditRow[] {
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const rosterByTeamId = getRostersByTeam(input.gameState);
  const teamRowById = new Map(input.teamRows.map((row) => [row.teamId, row] as const));

  return input.gameState.teams.map((team) => {
    const roster = rosterByTeamId.get(team.teamId) ?? [];
    const row = teamRowById.get(team.teamId);
    const gm = getTeamGeneralManager(input.gameState, team.teamId);
    const rosterPlayers = roster.map((entry) => playersById.get(entry.playerId)).filter(Boolean);
    const classCount = new Set(rosterPlayers.map((player) => player?.className ?? "")).size;
    const raceCount = new Set(rosterPlayers.map((player) => player?.race ?? "")).size;
    const areaCounts = new Map<string, number>();
    let pow = 0;
    let spe = 0;
    let men = 0;
    let soc = 0;
    for (const player of rosterPlayers) {
      if (!player) continue;
      pow += player.coreStats.pow;
      spe += player.coreStats.spe;
      men += player.coreStats.men;
      soc += player.coreStats.soc;
      const area = areaFromCoreStats(player.coreStats);
      areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    }
    const rosterCount = rosterPlayers.length;
    const dominant = [...areaCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? ["UNK", 0];
    const dominantAreaSharePct = rosterCount > 0 ? round((dominant[1] / rosterCount) * 100, 1) : 0;
    const areaCount = [...areaCounts.values()].filter((count) => count > 0).length;
    const diversityStatus =
      rosterCount < (row?.playerMin ?? 7) || dominantAreaSharePct >= 75 || classCount <= 2 || areaCount <= 1
        ? "red"
        : dominantAreaSharePct >= 60 || classCount <= 4 || raceCount <= 3
          ? "watch"
          : "ok";
    const diagnosis = [
      rosterCount < (row?.playerMin ?? 7) ? "below_min_roster" : null,
      dominantAreaSharePct >= 75 ? "one_area_overloaded" : null,
      classCount <= 2 ? "class_variety_too_low" : null,
      raceCount <= 3 ? "race_variety_low" : null,
      areaCount <= 1 ? "missing_area_mix" : null,
    ].filter(Boolean).join("|") || "ok";

    return {
      run: input.run,
      saveId: input.saveId,
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      gmName: gm?.profile.name ?? "",
      gmArchetype: gm?.profile.archetype ?? "",
      rosterCount,
      playerOpt: row?.playerOpt ?? 0,
      cashAfterDraft: row?.cashAfterDraft ?? 0,
      marketValueAfterDraft: row?.marketValueAfterDraft ?? 0,
      salaryAfterDraft: row?.salaryAfterDraft ?? 0,
      avgPow: round(pow / Math.max(1, rosterCount), 1),
      avgSpe: round(spe / Math.max(1, rosterCount), 1),
      avgMen: round(men / Math.max(1, rosterCount), 1),
      avgSoc: round(soc / Math.max(1, rosterCount), 1),
      dominantArea: dominant[0],
      dominantAreaSharePct,
      classCount,
      raceCount,
      areaCount,
      diversityStatus,
      diagnosis,
    };
  }).sort((left, right) => left.teamCode.localeCompare(right.teamCode, "de"));
}

function buildMwSalaryGuardRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
}): MwSalaryGuardRow[] {
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const teamsById = new Map(input.gameState.teams.map((team) => [team.teamId, team] as const));
  return input.gameState.rosters
    .map((entry) => {
      const player = playersById.get(entry.playerId);
      const team = teamsById.get(entry.teamId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const marketValue = round(economy.marketValue ?? 0, 2);
      const salary = round(economy.salary ?? entry.salary ?? 0, 2);
      const salaryToMarketValuePct = marketValue > 0 ? round((salary / marketValue) * 100, 1) : 0;
      const diagnosis = [
        marketValue > 120 ? "market_value_gt_120" : null,
        salary > 35 ? "salary_gt_35" : null,
        salaryToMarketValuePct > 42 ? "salary_to_mw_extreme" : null,
        salaryToMarketValuePct > 32 ? "salary_to_mw_high" : null,
        salary < 0 ? "salary_negative" : null,
        marketValue < 0 ? "market_value_negative" : null,
      ].filter(Boolean).join("|") || "ok";
      const guardStatus = diagnosis.includes("extreme") || diagnosis.includes("gt_120") || diagnosis.includes("negative")
        ? "red"
        : diagnosis === "ok"
          ? "ok"
          : "watch";
      return {
        run: input.run,
        saveId: input.saveId,
        teamId: entry.teamId,
        teamCode: team?.shortCode ?? entry.teamId,
        teamName: team?.name ?? entry.teamId,
        playerId: entry.playerId,
        playerName: player?.name ?? entry.playerId,
        className: player?.className ?? "",
        race: player?.race ?? "",
        marketValue,
        salary,
        salaryToMarketValuePct,
        contractLength: entry.contractLength,
        contractShape: entry.contractShape ?? "",
        guardStatus,
        diagnosis,
      };
    })
    .filter((row) => row.guardStatus !== "ok")
    .sort((left, right) => {
      const severity = { red: 2, watch: 1, ok: 0 };
      return severity[right.guardStatus] - severity[left.guardStatus] || right.marketValue - left.marketValue;
    });
}

function buildContractRenewalExitAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
}): ContractRenewalExitAuditRow[] {
  const preview = previewSeasonEndContracts({ saveId: input.saveId, status: "archived", gameState: input.gameState } as never);
  return preview.rows
    .map((row) => {
      const renewalSalaryIncreasePct =
        row.renewalSalaryPreview != null && row.currentSalary > 0
          ? round(((row.renewalSalaryPreview - row.currentSalary) / row.currentSalary) * 100, 1)
          : null;
      const guardStatus =
        row.statusAfterTick === "out_of_contract" && row.controlMode === "ai" && row.recommendedAction === "no_action"
          ? "red"
          : renewalSalaryIncreasePct != null && renewalSalaryIncreasePct > 80
            ? "red"
            : renewalSalaryIncreasePct != null && renewalSalaryIncreasePct > 35
              ? "watch"
              : row.warnings.length > 0
                ? "watch"
                : "ok";
      return {
        run: input.run,
        saveId: input.saveId,
        teamId: row.teamId,
        teamName: row.teamName,
        playerId: row.playerId,
        playerName: row.playerName,
        controlMode: row.controlMode,
        currentLength: row.currentLength,
        lengthAfterTick: row.lengthAfterTick,
        statusBeforeTick: row.statusBeforeTick,
        statusAfterTick: row.statusAfterTick,
        currentSalary: row.currentSalary,
        renewalSalaryPreview: row.renewalSalaryPreview,
        exitValue: row.exitValue,
        marketValueAtExit: row.marketValueAtExit,
        recommendedAction: row.recommendedAction,
        renewalSalaryIncreasePct,
        guardStatus,
        warnings: row.warnings.join("|"),
        blockers: row.blockingReasons.join("|"),
      };
    })
    .filter((row) => row.statusBeforeTick === "expiring" || row.statusAfterTick === "out_of_contract" || row.guardStatus !== "ok")
    .sort((left, right) => {
      const severity = { red: 2, watch: 1, ok: 0 };
      return severity[right.guardStatus] - severity[left.guardStatus] || left.teamName.localeCompare(right.teamName, "de");
    });
}

function buildBoardObjectiveRealismAuditRows(input: {
  run: number;
  saveId: string;
  gameState: GameState;
}): BoardObjectiveRealismAuditRow[] {
  const overview = buildTeamObjectiveOverview(input.gameState);
  const teamsById = new Map(input.gameState.teams.map((team) => [team.teamId, team] as const));
  return overview.objectives
    .map((objective) => {
      const currentRank = typeof objective.currentValue === "number" ? objective.currentValue : null;
      const targetRank = typeof objective.targetValue === "number" ? objective.targetValue : null;
      const board = overview.boardConfidence[objective.teamId] ?? null;
      const isSportRank = objective.objectiveId.startsWith("sport-rank-");
      const unrealisticTop10 = isSportRank && targetRank != null && targetRank <= 10 && currentRank != null && currentRank > 20;
      const unrealisticTop4 = isSportRank && targetRank != null && targetRank <= 4 && currentRank != null && currentRank > 10;
      const weakTeamMedalPush =
        objective.objectiveId === "sport-matchday-medals" &&
        typeof objective.currentValue === "number" &&
        objective.currentValue > 20;
      const sourceChain = (objective.source ?? "").split("+").filter(Boolean);
      const duplicateSource = new Set(sourceChain).size !== sourceChain.length;
      const realismStatus = unrealisticTop10 || unrealisticTop4 || weakTeamMedalPush || duplicateSource ? "red" : "ok";
      const diagnosis = [
        unrealisticTop10 ? "weak_team_top10_target" : null,
        unrealisticTop4 ? "mid_team_top4_target" : null,
        weakTeamMedalPush ? "weak_team_medal_target" : null,
        duplicateSource ? "duplicate_source_chain" : null,
      ].filter(Boolean).join("|") || "ok";
      return {
        run: input.run,
        saveId: input.saveId,
        teamId: objective.teamId,
        teamName: teamsById.get(objective.teamId)?.name ?? objective.teamId,
        objectiveId: objective.objectiveId,
        category: objective.category,
        label: objective.label,
        currentValue: String(objective.currentValue ?? ""),
        targetValue: String(objective.targetValue ?? ""),
        status: objective.status,
        boardConfidence: board?.value ?? null,
        boardPressure: board?.pressure ?? null,
        realismStatus,
        diagnosis,
        source: objective.source ?? "",
      };
    })
    .filter((row) => row.realismStatus !== "ok")
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "de"));
}

function buildMarkdown(input: {
  summaries: RunSummaryRow[];
  teamRows: TeamAuditRow[];
  actionRows: ActionAuditRow[];
  cashSellPressureRows?: CashSellPressureAuditRow[];
  draftDiversityRows?: DraftDiversityAuditRow[];
  mwSalaryGuardRows?: MwSalaryGuardRow[];
  contractRenewalExitRows?: ContractRenewalExitAuditRow[];
  boardObjectiveRealismRows?: BoardObjectiveRealismAuditRow[];
  managerAiGmBehaviorRows?: ManagerAiGmBehaviorAuditRow[];
  managerAiTeamIdentityFitRows?: ManagerAiTeamIdentityFitAuditRow[];
  managerAiDraftPickReasoningRows?: ManagerAiDraftPickReasoningAuditRow[];
  managerAiTransferIntentRows?: ManagerAiTransferIntentAuditRow[];
  managerAiTrainingFacilityPriorityRows?: ManagerAiTrainingFacilityPriorityAuditRow[];
  managerAiFormTraitBonusRows?: ManagerAiFormTraitBonusAuditRow[];
  managerAiRivalryMoraleRows?: ManagerAiRivalryMoraleAuditRow[];
  outputDir: string;
}) {
  const plusTeams = input.teamRows.filter((row) => row.gvGroup === "plus_15");
  const minusTeams = input.teamRows.filter((row) => row.gvGroup === "minus_15");
  const plusBuys = plusTeams.reduce((sum, row) => sum + row.executedBuys, 0);
  const minusBuys = minusTeams.reduce((sum, row) => sum + row.executedBuys, 0);
  const plusSells = plusTeams.reduce((sum, row) => sum + row.executedSells, 0);
  const minusSells = minusTeams.reduce((sum, row) => sum + row.executedSells, 0);
  const blockedTeams = input.teamRows.filter((row) => row.result.includes("blocked") || row.result.includes("failed"));
  const noReactionMinus = minusTeams.filter((row) => row.cashAfterGv < 8 && row.executedBuys === 0 && row.executedSells === 0);
  const noReactionPlus = plusTeams.filter((row) => row.cashAfterGv > 20 && row.executedBuys === 0 && row.executedSells === 0);
  const highestCashLeft = [...input.teamRows].sort((left, right) => right.cashAfterMarket - left.cashAfterMarket).slice(0, 10);
  const lowestCashLeft = [...input.teamRows].sort((left, right) => left.cashAfterMarket - right.cashAfterMarket).slice(0, 10);
  const gmRows = buildGmImpactRows(input.teamRows);
  const cashRows = input.cashSellPressureRows ?? [];
  const diversityRows = input.draftDiversityRows ?? [];
  const mwRows = input.mwSalaryGuardRows ?? [];
  const contractRows = input.contractRenewalExitRows ?? [];
  const boardRows = input.boardObjectiveRealismRows ?? [];
  const managerGmRows = input.managerAiGmBehaviorRows ?? [];
  const managerIdentityRows = input.managerAiTeamIdentityFitRows ?? [];
  const managerPickRows = input.managerAiDraftPickReasoningRows ?? [];
  const managerTransferRows = input.managerAiTransferIntentRows ?? [];
  const managerTrainingRows = input.managerAiTrainingFacilityPriorityRows ?? [];
  const managerTraitRows = input.managerAiFormTraitBonusRows ?? [];
  const managerMoraleRows = input.managerAiRivalryMoraleRows ?? [];
  const cashRed = cashRows.filter((row) => row.negativeAfterMarket || row.passiveUnderPressure).length;
  const diversityRed = diversityRows.filter((row) => row.diversityStatus === "red").length;
  const diversityWatch = diversityRows.filter((row) => row.diversityStatus === "watch").length;
  const mwRed = mwRows.filter((row) => row.guardStatus === "red").length;
  const mwWatch = mwRows.filter((row) => row.guardStatus === "watch").length;
  const contractRed = contractRows.filter((row) => row.guardStatus === "red").length;
  const contractWatch = contractRows.filter((row) => row.guardStatus === "watch").length;
  const boardRed = boardRows.filter((row) => row.realismStatus === "red").length;
  const managerIdentityRed = managerIdentityRows.filter((row) => row.status === "red").length;
  const managerIdentityWatch = managerIdentityRows.filter((row) => row.status === "watch").length;
  const managerPickRed = managerPickRows.filter((row) => row.status === "red").length;
  const managerPickWatch = managerPickRows.filter((row) => row.status === "watch").length;
  const managerTransferRed = managerTransferRows.filter((row) => row.intentStatus === "red").length;
  const managerTransferWatch = managerTransferRows.filter((row) => row.intentStatus === "watch").length;
  const managerTrainingWatch = managerTrainingRows.filter((row) => row.priorityStatus === "watch").length;
  const managerTraitRed = managerTraitRows.filter((row) => row.readinessStatus === "red").length;
  const managerTraitWatch = managerTraitRows.filter((row) => row.readinessStatus === "watch").length;
  const managerMoraleRed = managerMoraleRows.filter((row) => row.status === "red").length;
  const managerMoraleWatch = managerMoraleRows.filter((row) => row.status === "watch").length;

  return [
    "# Pick/Market GuV Salary Audit",
    "",
    "## Setup",
    `- Runs: ${RUNS}`,
    `- Engine: echte \`runChunkedRedraftTopup\` Pick-Engine, Modus \`full_clean_redraft\`, Ziel \`playerOpt\`.`,
    `- Danach: testweiser Salary-Faktor ${SALARY_FACTOR} auf aktive Roster-Gehaelter.`,
    `- Kuenstliche GuV: alphabetisch 50/50 Team-Split, plus ${POSITIVE_GUV_DELTA} Cash oder ${NEGATIVE_GUV_DELTA} Cash.`,
    "- Marktphase: echter lokaler AI-Market-Apply mit Kaufen/Verkaufen, keine Prisma/Supabase-Writes.",
    "",
    "## Kurzfazit",
    `- Draft-Picks gesamt: ${input.summaries.reduce((sum, row) => sum + row.draftPicks, 0)}`,
    `- Markt-Kaeufe gesamt: ${input.summaries.reduce((sum, row) => sum + row.marketAppliedBuys, 0)}`,
    `- Markt-Verkaeufe gesamt: ${input.summaries.reduce((sum, row) => sum + row.marketAppliedSells, 0)}`,
    `- +15 Teams: ${plusBuys} Kaeufe / ${plusSells} Verkaeufe.`,
    `- -15 Teams: ${minusBuys} Kaeufe / ${minusSells} Verkaeufe.`,
    `- Blockierte/fehlgeschlagene Teamlaeufe: ${blockedTeams.length}`,
    `- -15 Teams mit wenig Cash und ohne Reaktion: ${noReactionMinus.length}`,
    `- +15 Teams mit viel Restcash und ohne Kauf/Verkauf: ${noReactionPlus.length}`,
    "",
    "## Balancing Block 1 Ampel",
    `- Cash-/Sell-Pressure: ${cashRed} rote Signale.`,
    `- Draft-Qualitaet/Roster-Diversity: ${diversityRed} rot, ${diversityWatch} gelb.`,
    `- MW/Gehalt-Eskalations-Guard: ${mwRed} rot, ${mwWatch} gelb.`,
    `- Contract-Renewal-/Exit-Audit: ${contractRed} rot, ${contractWatch} gelb.`,
    `- Board-Ziele-Realismus: ${boardRed} rote Signale.`,
    "",
    "## Balancing Block 2: Manager-AI System Audit",
    `- GM-Wirkungs-Audit: ${managerGmRows.length} Archetyp-Zeilen.`,
    `- Team-Identity-Fit: ${managerIdentityRed} rot, ${managerIdentityWatch} gelb. Lore-Fit ist nur Diagnose, kein harter Pick-Blocker.`,
    `- Draft-Pick-Reasoning: ${managerPickRed} rot, ${managerPickWatch} gelb.`,
    `- Transfermarkt Buy/Sell Intent: ${managerTransferRed} rot, ${managerTransferWatch} gelb.`,
    `- Training-/Facility-Prioritaeten: ${managerTrainingWatch} gelbe Signale.`,
    `- Formkarten-/Trait-Bonus-Readiness: ${managerTraitRed} rot, ${managerTraitWatch} gelb.`,
    `- Rivalry-/Morale-Auswirkung: ${managerMoraleRed} rot, ${managerMoraleWatch} gelb.`,
    "",
    "## Interpretation",
    minusSells > plusSells
      ? "- Negativer Cash-Druck erzeugt mehr Verkaeufe als die +15-Gruppe. Das ist das gewuenschte Signal."
      : "- Negativer Cash-Druck erzeugt noch nicht mehr Verkaeufe als die +15-Gruppe. Hier braucht die Sell-Pressure-AI Nachschaerfung.",
    plusBuys > minusBuys
      ? "- Positive Teams kaufen mehr als negative Teams. Das ist als Entwicklungs-/Upgrade-Verhalten plausibel."
      : "- Positive Teams kaufen nicht klar mehr als negative Teams. Buy-AI nutzt Cash-Puffer vermutlich noch zu vorsichtig oder nicht stark genug.",
    noReactionMinus.length === 0
      ? "- Keine knappen -15 Teams blieben komplett passiv."
      : "- Es gibt knappe -15 Teams ohne Marktreaktion; diese Teams sind die naechsten Root-Cause-Kandidaten.",
    "",
    "## GM-Wirkung",
    ...gmRows.map((row) => `- ${row.gmArchetype}: Teams ${row.teams}, Kaeufe ${row.buys}, Verkaeufe ${row.sells}, Ø Cash nach Markt ${row.avgCashAfterMarket}, negativ ${row.negativeAfterMarket}, passive -15 ${row.passiveMinusPressure}.`),
    "",
    "## Top Restcash Nach Markt",
    ...highestCashLeft.map((row) => `- Run ${row.run} ${row.teamCode} ${row.teamName}: Cash ${row.cashAfterMarket}, Roster ${row.rosterAfterMarket}/${row.playerOpt}, Buys ${row.executedBuys}, Sells ${row.executedSells}`),
    "",
    "## Niedrigstes Cash Nach Markt",
    ...lowestCashLeft.map((row) => `- Run ${row.run} ${row.teamCode} ${row.teamName}: Cash ${row.cashAfterMarket}, Roster ${row.rosterAfterMarket}/${row.playerOpt}, Buys ${row.executedBuys}, Sells ${row.executedSells}`),
    "",
    "## Wichtige Dateien",
    `- \`${path.join(input.outputDir, "pick-market-gv-run-summary.csv")}\``,
    `- \`${path.join(input.outputDir, "pick-market-gv-team-outcomes.csv")}\``,
    `- \`${path.join(input.outputDir, "pick-market-gv-actions.csv")}\``,
    `- \`${path.join(input.outputDir, "pick-market-gv-gm-impact.csv")}\``,
    `- \`${path.join(input.outputDir, "finance-cash-sell-pressure-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "draft-quality-roster-diversity-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "mw-salary-escalation-guard.csv")}\``,
    `- \`${path.join(input.outputDir, "contract-renewal-exit-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "board-objectives-realism-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-gm-behavior-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-team-identity-fit-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-draft-pick-reasoning-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-transfer-intent-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-training-facility-priority-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-form-trait-bonus-audit.csv")}\``,
    `- \`${path.join(input.outputDir, "manager-ai-rivalry-morale-audit.csv")}\``,
  ].join("\n");
}

async function runSingleAudit(run: number) {
  const startedAt = Date.now();
  const persistence = createPersistenceService();
  const previousActiveSaveId = persistence.getActiveSave()?.saveId ?? null;
  const save = persistence.createFreshSeasonOneSave({
    name: `Pick/Market GuV Salary Audit R${run} ${new Date().toLocaleString("de-DE")}`,
    status: "archived",
    activate: false,
  });
  const prepared = saveArchivedAuditState(
    persistence,
    save.saveId,
    withScenarioMeta(withAllTeamsAi(save.gameState), {
      scenarioType: "ai_redraft_test",
      label: `Pick/Market GuV Salary Audit R${run}`,
      description: "Echter Full-Clean-Redraft mit anschliessendem AI-Market-Pressure-Test.",
      allowTestWrites: true,
      isStableTestPoint: false,
      gamePhase: "draft",
    }),
  );
  restorePreviousActiveSave(persistence, previousActiveSaveId, prepared.saveId, "prepared");

  const draftOutputDir = path.join(OUTPUT_DIR, `run-${String(run).padStart(2, "0")}-draft`);
  fs.mkdirSync(draftOutputDir, { recursive: true });
  const draft = runChunkedRedraftTopup({
    persistence,
    saveId: prepared.saveId,
    seasonId: "season-1",
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "full_clean_redraft",
    target: "playerOpt",
    roundLimit: ROUND_LIMIT,
    teamTimeLimitMs: TEAM_TIME_LIMIT_MS,
    watchdogMs: WATCHDOG_MS,
    reportMode: "light",
    outputDir: draftOutputDir,
  });
  const persistedDraftSave = persistence.getSaveById(prepared.saveId);
  if (persistedDraftSave) {
    saveArchivedAuditState(persistence, prepared.saveId, persistedDraftSave.gameState);
  }
  restorePreviousActiveSave(persistence, previousActiveSaveId, prepared.saveId, "after_draft");

  const afterDraftSave = persistence.getSaveById(prepared.saveId);
  if (!afterDraftSave) {
    throw new Error(`audit_save_missing_after_draft:${prepared.saveId}`);
  }
  const afterDraft = withAllTeamsAi(afterDraftSave.gameState);
  const afterDraftSnapshots = snapshotTeams(afterDraft);
  const salaryFactorState = applySalaryFactorAndGvSplit(afterDraft);
  saveArchivedAuditState(persistence, prepared.saveId, salaryFactorState.gameState);
  restorePreviousActiveSave(persistence, previousActiveSaveId, prepared.saveId, "after_gv");
  const afterGvSave = persistence.getSaveById(prepared.saveId);
  if (!afterGvSave) {
    throw new Error(`audit_save_missing_after_gv:${prepared.saveId}`);
  }
  const afterGvSnapshots = snapshotTeams(afterGvSave.gameState);

  const market: AiMarketPlanApplyResult = await applyAiMarketPlanLocally({
    source: "sqlite",
    saveId: prepared.saveId,
    seasonId: "season-1",
    teamScope: "all",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    options: {
      includeWarningTeams: true,
      applySellSteps: true,
      applyBuySteps: true,
      maxBuysPerTeam: null,
      maxSellsPerTeam: 5,
      previewBuyLimit: 160,
      previewSellLimit: 16,
      performanceBudgetMs: 15_000,
      maxApplyMs: 120_000,
      progressLog: false,
      stopOnTeamFailure: false,
    },
  });
  const postMarketSaveForStatus = persistence.getSaveById(prepared.saveId);
  if (postMarketSaveForStatus) {
    saveArchivedAuditState(persistence, prepared.saveId, postMarketSaveForStatus.gameState);
  }
  restorePreviousActiveSave(persistence, previousActiveSaveId, prepared.saveId, "after_market");

  const afterMarketSave = persistence.getSaveById(prepared.saveId);
  if (!afterMarketSave) {
    throw new Error(`audit_save_missing_after_market:${prepared.saveId}`);
  }
  const afterMarketSnapshots = snapshotTeams(afterMarketSave.gameState);
  const teamRows: TeamAuditRow[] = afterMarketSave.gameState.teams
    .map((team) => {
      const draftSnapshot = afterDraftSnapshots.get(team.teamId);
      const gvSnapshot = afterGvSnapshots.get(team.teamId);
      const marketSnapshot = afterMarketSnapshots.get(team.teamId);
      const marketTeam = market.teams.find((entry) => entry.teamId === team.teamId);
      const gv = salaryFactorState.gvByTeamId.get(team.teamId) ?? { gvGroup: "plus_15" as const, gvDelta: POSITIVE_GUV_DELTA };
      const gm = getTeamGeneralManager(afterMarketSave.gameState, team.teamId);
      if (!draftSnapshot || !gvSnapshot || !marketSnapshot) {
        throw new Error(`audit_snapshot_missing:${team.teamId}`);
      }
      return {
        run,
        saveId: prepared.saveId,
        teamId: team.teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        gmId: gm?.profile.gmId ?? "",
        gmName: gm?.profile.name ?? "",
        gmArchetype: gm?.profile.archetype ?? "",
        gmTitle: gm?.profile.title ?? "",
        gmSource: gm?.assignment.source ?? "",
        gmCashPriority: gm?.profile.bias.cashPriority ?? null,
        gmWageSensitivity: gm?.profile.bias.wageSensitivity ?? null,
        gmRiskTolerance: gm?.profile.bias.riskTolerance ?? null,
        gmStarPriority: gm?.profile.bias.starPriority ?? null,
        gmRosterDepthPreference: gm?.profile.bias.rosterDepthPreference ?? null,
        gmEliteSmallRosterPreference: gm?.profile.bias.eliteSmallRosterPreference ?? null,
        gvGroup: gv.gvGroup,
        gvDelta: gv.gvDelta,
        rosterAfterDraft: draftSnapshot.rosterCount,
        rosterAfterMarket: marketSnapshot.rosterCount,
        playerMin: marketSnapshot.playerMin,
        playerOpt: marketSnapshot.playerOpt,
        playerMax: marketSnapshot.playerMax,
        cashAfterDraft: draftSnapshot.cash,
        cashAfterGv: gvSnapshot.cash,
        cashAfterMarket: marketSnapshot.cash,
        salaryAfterDraft: draftSnapshot.salaryTotal,
        salaryAfterFactor: gvSnapshot.salaryTotal,
        salaryAfterMarket: marketSnapshot.salaryTotal,
        marketValueAfterDraft: draftSnapshot.marketValueTotal,
        marketValueAfterMarket: marketSnapshot.marketValueTotal,
        plannedSells: marketTeam?.plannedSells ?? 0,
        plannedBuys: marketTeam?.plannedBuys ?? 0,
        executedSells: marketTeam?.executedSells ?? 0,
        executedBuys: marketTeam?.executedBuys ?? 0,
        result: marketTeam?.result ?? "missing_market_team",
        previewStatus: marketTeam?.previewStatus ?? "missing",
        warnings: (marketTeam?.warnings ?? []).join("|"),
        blockers: (marketTeam?.blockingReasons ?? []).join("|"),
      };
    })
    .sort((left, right) => left.teamCode.localeCompare(right.teamCode, "de"));

  const actionRows = buildActionRows({
    run,
    saveId: prepared.saveId,
    gvByTeamId: salaryFactorState.gvByTeamId,
    teams: market.teams,
    gameState: afterMarketSave.gameState,
  });
  const cashSellPressureRows = buildCashSellPressureAuditRows(teamRows);
  const draftDiversityRows = buildDraftDiversityAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterDraft,
    teamRows,
  });
  const mwSalaryGuardRows = buildMwSalaryGuardRows({
    run,
    saveId: prepared.saveId,
    gameState: afterMarketSave.gameState,
  });
  const contractRenewalExitRows = buildContractRenewalExitAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterMarketSave.gameState,
  });
  const boardObjectiveRealismRows = buildBoardObjectiveRealismAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterMarketSave.gameState,
  });
  const managerAiGmBehaviorRows = buildManagerAiGmBehaviorAuditRows({
    run,
    teamRows,
    picks: draft.picks,
  });
  const managerAiTeamIdentityFitRows = buildManagerAiTeamIdentityFitAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterDraft,
    teamRows,
    picks: draft.picks,
  });
  const managerAiDraftPickReasoningRows = buildManagerAiDraftPickReasoningAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterDraft,
    teamRows,
    picks: draft.picks,
  });
  const managerAiTransferIntentRows = buildManagerAiTransferIntentAuditRows({
    teamRows,
    actionRows,
  });
  const managerAiTrainingFacilityPriorityRows = buildManagerAiTrainingFacilityPriorityAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterMarketSave.gameState,
    teamRows,
  });
  const managerAiFormTraitBonusRows = buildManagerAiFormTraitBonusAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterMarketSave.gameState,
    teamRows,
  });
  const managerAiRivalryMoraleRows = buildManagerAiRivalryMoraleAuditRows({
    run,
    saveId: prepared.saveId,
    gameState: afterMarketSave.gameState,
    teamRows,
  });
  const summary: RunSummaryRow = {
    run,
    saveId: prepared.saveId,
    draftValid: draft.summary.draftValid,
    draftPicks: draft.summary.picksTotal,
    draftTransferHistory: draft.summary.transferHistoryTotal,
    negativeCashAfterGv: countNegativeCash(afterGvSnapshots),
    negativeCashAfterMarket: countNegativeCash(afterMarketSnapshots),
    plusTeams: teamRows.filter((row) => row.gvGroup === "plus_15").length,
    plusExecutedBuys: sumForGroup(market.teams, salaryFactorState.gvByTeamId, "plus_15", "executedBuys"),
    plusExecutedSells: sumForGroup(market.teams, salaryFactorState.gvByTeamId, "plus_15", "executedSells"),
    minusTeams: teamRows.filter((row) => row.gvGroup === "minus_15").length,
    minusExecutedBuys: sumForGroup(market.teams, salaryFactorState.gvByTeamId, "minus_15", "executedBuys"),
    minusExecutedSells: sumForGroup(market.teams, salaryFactorState.gvByTeamId, "minus_15", "executedSells"),
    marketStatus: market.status,
    marketAppliedBuys: market.summary.appliedBuys,
    marketAppliedSells: market.summary.appliedSells,
    marketBlockedTeams: market.summary.blockedTeams,
    marketWarningTeams: market.summary.warningTeams,
    durationMs: Date.now() - startedAt,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `run-${String(run).padStart(2, "0")}-market-summary.json`),
    JSON.stringify({ summary, marketSummary: market.summary, warnings: market.warnings, blockers: market.blockingReasons }, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify({
      run,
      saveId: prepared.saveId,
      draftValid: summary.draftValid,
      draftPicks: summary.draftPicks,
      marketAppliedBuys: summary.marketAppliedBuys,
      marketAppliedSells: summary.marketAppliedSells,
      negativeCashAfterGv: summary.negativeCashAfterGv,
      negativeCashAfterMarket: summary.negativeCashAfterMarket,
      marketBlockedTeams: summary.marketBlockedTeams,
      cashPressureWarnings: cashSellPressureRows.filter((row) => row.diagnosis !== "ok").length,
      diversityWarnings: draftDiversityRows.filter((row) => row.diversityStatus !== "ok").length,
      mwSalaryGuardHits: mwSalaryGuardRows.length,
      contractRows: contractRenewalExitRows.length,
      boardRealismHits: boardObjectiveRealismRows.length,
      managerAiIdentitySignals: managerAiTeamIdentityFitRows.filter((row) => row.status !== "ok").length,
      managerAiPickReasoningSignals: managerAiDraftPickReasoningRows.filter((row) => row.status !== "ok").length,
      managerAiTransferIntentSignals: managerAiTransferIntentRows.filter((row) => row.intentStatus !== "ok").length,
      managerAiTraitSignals: managerAiFormTraitBonusRows.filter((row) => row.readinessStatus !== "ok").length,
      managerAiMoraleSignals: managerAiRivalryMoraleRows.filter((row) => row.status !== "ok").length,
      durationMs: summary.durationMs,
    }),
  );

  return {
    summary,
    teamRows,
    actionRows,
    cashSellPressureRows,
    draftDiversityRows,
    mwSalaryGuardRows,
    contractRenewalExitRows,
    boardObjectiveRealismRows,
    managerAiGmBehaviorRows,
    managerAiTeamIdentityFitRows,
    managerAiDraftPickReasoningRows,
    managerAiTransferIntentRows,
    managerAiTrainingFacilityPriorityRows,
    managerAiFormTraitBonusRows,
    managerAiRivalryMoraleRows,
  };
}

async function main() {
  ensureOutputDir();
  const summaries: RunSummaryRow[] = [];
  const teamRows: TeamAuditRow[] = [];
  const actionRows: ActionAuditRow[] = [];
  const cashSellPressureRows: CashSellPressureAuditRow[] = [];
  const draftDiversityRows: DraftDiversityAuditRow[] = [];
  const mwSalaryGuardRows: MwSalaryGuardRow[] = [];
  const contractRenewalExitRows: ContractRenewalExitAuditRow[] = [];
  const boardObjectiveRealismRows: BoardObjectiveRealismAuditRow[] = [];
  const managerAiGmBehaviorRows: ManagerAiGmBehaviorAuditRow[] = [];
  const managerAiTeamIdentityFitRows: ManagerAiTeamIdentityFitAuditRow[] = [];
  const managerAiDraftPickReasoningRows: ManagerAiDraftPickReasoningAuditRow[] = [];
  const managerAiTransferIntentRows: ManagerAiTransferIntentAuditRow[] = [];
  const managerAiTrainingFacilityPriorityRows: ManagerAiTrainingFacilityPriorityAuditRow[] = [];
  const managerAiFormTraitBonusRows: ManagerAiFormTraitBonusAuditRow[] = [];
  const managerAiRivalryMoraleRows: ManagerAiRivalryMoraleAuditRow[] = [];

  for (let run = 1; run <= RUNS; run += 1) {
    const result = await runSingleAudit(run);
    summaries.push(result.summary);
    teamRows.push(...result.teamRows);
    actionRows.push(...result.actionRows);
    cashSellPressureRows.push(...result.cashSellPressureRows);
    draftDiversityRows.push(...result.draftDiversityRows);
    mwSalaryGuardRows.push(...result.mwSalaryGuardRows);
    contractRenewalExitRows.push(...result.contractRenewalExitRows);
    boardObjectiveRealismRows.push(...result.boardObjectiveRealismRows);
    managerAiGmBehaviorRows.push(...result.managerAiGmBehaviorRows);
    managerAiTeamIdentityFitRows.push(...result.managerAiTeamIdentityFitRows);
    managerAiDraftPickReasoningRows.push(...result.managerAiDraftPickReasoningRows);
    managerAiTransferIntentRows.push(...result.managerAiTransferIntentRows);
    managerAiTrainingFacilityPriorityRows.push(...result.managerAiTrainingFacilityPriorityRows);
    managerAiFormTraitBonusRows.push(...result.managerAiFormTraitBonusRows);
    managerAiRivalryMoraleRows.push(...result.managerAiRivalryMoraleRows);
  }

  writeCsv(path.join(OUTPUT_DIR, "pick-market-gv-run-summary.csv"), summaries, [
    "run",
    "saveId",
    "draftValid",
    "draftPicks",
    "draftTransferHistory",
    "negativeCashAfterGv",
    "negativeCashAfterMarket",
    "plusTeams",
    "plusExecutedBuys",
    "plusExecutedSells",
    "minusTeams",
    "minusExecutedBuys",
    "minusExecutedSells",
    "marketStatus",
    "marketAppliedBuys",
    "marketAppliedSells",
    "marketBlockedTeams",
    "marketWarningTeams",
    "durationMs",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "pick-market-gv-team-outcomes.csv"), teamRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmId",
    "gmName",
    "gmArchetype",
    "gmTitle",
    "gmSource",
    "gmCashPriority",
    "gmWageSensitivity",
    "gmRiskTolerance",
    "gmStarPriority",
    "gmRosterDepthPreference",
    "gmEliteSmallRosterPreference",
    "gvGroup",
    "gvDelta",
    "rosterAfterDraft",
    "rosterAfterMarket",
    "playerMin",
    "playerOpt",
    "playerMax",
    "cashAfterDraft",
    "cashAfterGv",
    "cashAfterMarket",
    "salaryAfterDraft",
    "salaryAfterFactor",
    "salaryAfterMarket",
    "marketValueAfterDraft",
    "marketValueAfterMarket",
    "plannedSells",
    "plannedBuys",
    "executedSells",
    "executedBuys",
    "result",
    "previewStatus",
    "warnings",
    "blockers",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "pick-market-gv-actions.csv"), actionRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmArchetype",
    "gmName",
    "gmSource",
    "gvGroup",
    "action",
    "playerId",
    "playerName",
    "amount",
    "salaryImpact",
    "status",
    "reason",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "pick-market-gv-gm-impact.csv"), buildGmImpactRows(teamRows), [
    "gmArchetype",
    "teams",
    "buys",
    "sells",
    "avgCashAfterDraft",
    "avgCashAfterGv",
    "avgCashAfterMarket",
    "avgRosterAfterMarket",
    "negativeAfterMarket",
    "passiveMinusPressure",
    "highCashNoAction",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "finance-cash-sell-pressure-audit.csv"), cashSellPressureRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "gmSource",
    "gvGroup",
    "cashAfterDraft",
    "cashAfterGv",
    "cashAfterMarket",
    "rosterAfterMarket",
    "playerMin",
    "playerOpt",
    "salaryAfterMarket",
    "salaryToMarketValuePct",
    "plannedSells",
    "plannedBuys",
    "executedSells",
    "executedBuys",
    "negativeAfterMarket",
    "thinRoster",
    "expensiveRoster",
    "passiveUnderPressure",
    "diagnosis",
    "blockers",
    "warnings",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "draft-quality-roster-diversity-audit.csv"), draftDiversityRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "rosterCount",
    "playerOpt",
    "cashAfterDraft",
    "marketValueAfterDraft",
    "salaryAfterDraft",
    "avgPow",
    "avgSpe",
    "avgMen",
    "avgSoc",
    "dominantArea",
    "dominantAreaSharePct",
    "classCount",
    "raceCount",
    "areaCount",
    "diversityStatus",
    "diagnosis",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "mw-salary-escalation-guard.csv"), mwSalaryGuardRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "playerId",
    "playerName",
    "className",
    "race",
    "marketValue",
    "salary",
    "salaryToMarketValuePct",
    "contractLength",
    "contractShape",
    "guardStatus",
    "diagnosis",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "contract-renewal-exit-audit.csv"), contractRenewalExitRows, [
    "run",
    "saveId",
    "teamId",
    "teamName",
    "playerId",
    "playerName",
    "controlMode",
    "currentLength",
    "lengthAfterTick",
    "statusBeforeTick",
    "statusAfterTick",
    "currentSalary",
    "renewalSalaryPreview",
    "exitValue",
    "marketValueAtExit",
    "recommendedAction",
    "renewalSalaryIncreasePct",
    "guardStatus",
    "warnings",
    "blockers",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "board-objectives-realism-audit.csv"), boardObjectiveRealismRows, [
    "run",
    "saveId",
    "teamId",
    "teamName",
    "objectiveId",
    "category",
    "label",
    "currentValue",
    "targetValue",
    "status",
    "boardConfidence",
    "boardPressure",
    "realismStatus",
    "diagnosis",
    "source",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-gm-behavior-audit.csv"), managerAiGmBehaviorRows, [
    "run",
    "gmArchetype",
    "teams",
    "avgDraftPicks",
    "avgPickScore",
    "avgIdentityFit",
    "avgBudgetFit",
    "avgValueScore",
    "avgCashAfterMarket",
    "buys",
    "sells",
    "negativeAfterMarket",
    "behaviorSignal",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-team-identity-fit-audit.csv"), managerAiTeamIdentityFitRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "strategySummary",
    "preferredClasses",
    "preferredRaces",
    "preferredTraits",
    "rosterCount",
    "avgIdentityFit",
    "avgClassFit",
    "avgThemeScore",
    "preferredClassSharePct",
    "preferredRaceSharePct",
    "preferredTraitPlayerSharePct",
    "avoidedClassPicks",
    "avoidedRacePicks",
    "loreMismatchPicks",
    "status",
    "diagnosis",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-draft-pick-reasoning-audit.csv"), managerAiDraftPickReasoningRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmArchetype",
    "pickRound",
    "playerName",
    "phase",
    "roleFilled",
    "marketBoardTier",
    "selectedScore",
    "identityFit",
    "classFit",
    "budgetFit",
    "valueScore",
    "candidateCount",
    "whySelected",
    "whyRejectedOthers",
    "topRejectedCandidates",
    "status",
    "diagnosis",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-transfer-intent-audit.csv"), managerAiTransferIntentRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "gvGroup",
    "cashAfterGv",
    "cashAfterMarket",
    "salaryAfterMarket",
    "marketValueAfterMarket",
    "plannedBuys",
    "plannedSells",
    "executedBuys",
    "executedSells",
    "buySpend",
    "sellIncome",
    "intentStatus",
    "diagnosis",
    "reasons",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-training-facility-priority-audit.csv"), managerAiTrainingFacilityPriorityRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "facilityPriorities",
    "inferredTrainingFocus",
    "weakestRosterAxis",
    "strongestRosterAxis",
    "powBias",
    "speBias",
    "menBias",
    "socBias",
    "priorityStatus",
    "diagnosis",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-form-trait-bonus-audit.csv"), managerAiFormTraitBonusRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "rosterCount",
    "gmPreferredTraits",
    "strategyPreferredTraits",
    "coveredPreferredTraits",
    "preferredTraitPlayers",
    "negativeTraitPlayers",
    "riskyTraitPlayers",
    "readinessStatus",
    "diagnosis",
  ]);
  writeCsv(path.join(OUTPUT_DIR, "manager-ai-rivalry-morale-audit.csv"), managerAiRivalryMoraleRows, [
    "run",
    "saveId",
    "teamId",
    "teamCode",
    "teamName",
    "gmName",
    "gmArchetype",
    "primaryRival",
    "rivalryIntensity",
    "avgMorale",
    "unhappyPlayers",
    "refusalRiskPlayers",
    "moraleWarnings",
    "rivalryObjectives",
    "status",
    "diagnosis",
  ]);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "pick-market-gv-salary-audit.md"),
    buildMarkdown({
      summaries,
      teamRows,
      actionRows,
      cashSellPressureRows,
      draftDiversityRows,
      mwSalaryGuardRows,
      contractRenewalExitRows,
      boardObjectiveRealismRows,
      managerAiGmBehaviorRows,
      managerAiTeamIdentityFitRows,
      managerAiDraftPickReasoningRows,
      managerAiTransferIntentRows,
      managerAiTrainingFacilityPriorityRows,
      managerAiFormTraitBonusRows,
      managerAiRivalryMoraleRows,
      outputDir: OUTPUT_DIR,
    }),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        outputDir: OUTPUT_DIR,
        runs: summaries.length,
        draftPicksTotal: summaries.reduce((sum, row) => sum + row.draftPicks, 0),
        marketAppliedBuysTotal: summaries.reduce((sum, row) => sum + row.marketAppliedBuys, 0),
        marketAppliedSellsTotal: summaries.reduce((sum, row) => sum + row.marketAppliedSells, 0),
        cashPressureSignals: cashSellPressureRows.filter((row) => row.diagnosis !== "ok").length,
        diversitySignals: draftDiversityRows.filter((row) => row.diversityStatus !== "ok").length,
        mwSalaryGuardHits: mwSalaryGuardRows.length,
        contractAuditRows: contractRenewalExitRows.length,
        boardObjectiveRealismHits: boardObjectiveRealismRows.length,
        managerAiIdentitySignals: managerAiTeamIdentityFitRows.filter((row) => row.status !== "ok").length,
        managerAiPickReasoningSignals: managerAiDraftPickReasoningRows.filter((row) => row.status !== "ok").length,
        managerAiTransferIntentSignals: managerAiTransferIntentRows.filter((row) => row.intentStatus !== "ok").length,
        managerAiTrainingFacilitySignals: managerAiTrainingFacilityPriorityRows.filter((row) => row.priorityStatus !== "ok").length,
        managerAiTraitSignals: managerAiFormTraitBonusRows.filter((row) => row.readinessStatus !== "ok").length,
        managerAiMoraleSignals: managerAiRivalryMoraleRows.filter((row) => row.status !== "ok").length,
        report: path.join(OUTPUT_DIR, "pick-market-gv-salary-audit.md"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
