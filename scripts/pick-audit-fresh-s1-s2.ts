import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { runMarketPlanConvergence } from "@/lib/ai/ai-market-plan-convergence-service";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import {
  isCashHoardingTeam,
  syncPreseasonTransferBudgets,
  teamNeedsCashRecoveryMarketAction,
} from "@/lib/ai/ai-budget-deploy-service";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";
import {
  buildQualityAwareSlotPlan,
  resolveMarketQualityProfile,
} from "@/lib/ai/ai-market-quality-profile-service";
import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";
import {
  buildLeagueMarketAnchors,
  classifyMarketTier,
  resolvePlannerSpendableCash,
} from "@/lib/ai/ai-market-slot-plan-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
} from "@/lib/ai/market-pick-engine/market-brackets";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { bootstrapSaveToSeasonStart } from "@/lib/debug/bootstrap-save-to-season-start";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[pick-audit-fresh-s1-s2] ${message}`);
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

function parseS1StepsFromArgv(argv: string[]) {
  const flagIndex = argv.indexOf("--s1-steps");
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    const parsed = Number(argv[flagIndex + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const fromEnv = Number(process.env.OLY_S1_STEPS ?? "10");
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 10;
}

function resolveSellBlockedReason(input: {
  gameState: GameState;
  teamId: string;
  sellCount: number;
  convergenceStatus?: string;
  convergenceWarnings?: string[];
}) {
  if (input.sellCount > 0) return "";
  if (!teamNeedsCashRecoveryMarketAction(input.gameState, input.teamId)) return "";
  if (input.convergenceWarnings?.some((entry) => entry.includes("sell"))) {
    return input.convergenceWarnings.filter((entry) => entry.includes("sell")).join("|");
  }
  if (input.convergenceStatus === "converged") return "convergence_converged_no_sell_candidate";
  return "cash_recovery_no_sell_attempt";
}

function getTeamSalaryTotal(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
}

function getTeamMarketValueTotal(gameState: GameState, teamId: string) {
  const playerIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  return gameState.players
    .filter((player) => playerIds.has(player.id))
    .reduce((sum, player) => sum + (player.marketValue ?? player.displayMarketValue ?? 0), 0);
}

function buildTeamAnalysisRows(input: {
  gameState: GameState;
  seasonId: string;
  pickRows: Array<{ teamId: string; price: number | null; bracketTier: string }>;
  sellCountByTeam?: Map<string, number>;
  convergenceByTeam?: Map<string, { status: string; warnings: string[] }>;
}) {
  const strategies = buildSeasonStrategyState(input.gameState);
  return input.gameState.teams.map((team) => {
    const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const rosterAfter = input.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const salary = getTeamSalaryTotal(input.gameState, team.teamId);
    const marketValueTotal = round(getTeamMarketValueTotal(input.gameState, team.teamId));
    const cash = round(team.cash ?? 0);
    const spendable = round(resolvePlannerSpendableCash(input.gameState, team.teamId, team.cash));
    const reserve = round(resolveTeamCashRunwayReserve(input.gameState, team.teamId));
    const strategyProfile = getTeamStrategyProfile(input.gameState, team.teamId);
    const bias = strategyProfile?.bias;
    const doctrine = strategies[team.teamId];
    const gm = getTeamGeneralManager(input.gameState, team.teamId);
    const teamBuys = input.pickRows.filter((row) => row.teamId === team.teamId);
    const s2SellCount = input.sellCountByTeam?.get(team.teamId) ?? 0;
    const convergence = input.convergenceByTeam?.get(team.teamId);
    const sellBlockedReason = resolveSellBlockedReason({
      gameState: input.gameState,
      teamId: team.teamId,
      sellCount: s2SellCount,
      convergenceStatus: convergence?.status,
      convergenceWarnings: convergence?.warnings,
    });
    const buySpend = round(teamBuys.reduce((sum, row) => sum + Number(row.price ?? 0), 0));
    const starBuys = teamBuys.filter((row) => row.bracketTier === "star" || row.bracketTier === "superstar").length;
    const cashSalaryRatio = salary > 0 ? round(cash / salary, 3) : null;
    const identityAxis = identity
      ? `pow:${identity.pow ?? 0}|spe:${identity.spe ?? 0}|men:${identity.men ?? 0}|soc:${identity.soc ?? 0}`
      : "";
    const financeProfile =
      cashSalaryRatio != null && cashSalaryRatio >= 0.75
        ? "cash_rich"
        : cashSalaryRatio != null && cashSalaryRatio <= 0.25
          ? "cash_tight"
          : "balanced_cash";
    const strategyCluster = doctrine?.seasonStrategy ?? "balanced_growth";
    return {
      teamId: team.teamId,
      teamCode: team.shortCode ?? team.teamId,
      seasonStrategy: strategyCluster,
      tacticalMode: doctrine?.tacticalMode ?? "",
      starPriority: bias?.starPriority ?? null,
      rosterDepthPreference: bias?.rosterDepthPreference ?? null,
      eliteSmallRosterPreference: bias?.eliteSmallRosterPreference ?? null,
      riskTolerance: bias?.riskTolerance ?? null,
      ambition: identity?.ambition ?? null,
      finances: identity?.finances ?? null,
      harmony: identity?.harmony ?? null,
      boardConfidence: identity?.boardConfidence ?? null,
      identityAxis,
      gmProfile: gm?.profile?.archetype ?? "",
      gmInfluencePct: gm?.assignment.influencePct ?? null,
      cash,
      budget: round(team.budget ?? 0),
      spendable,
      cashReserve: reserve,
      salaryTotal: round(salary),
      marketValueTotal,
      cashSalaryRatio,
      financeProfile,
      rosterAfter,
      playerMin,
      playerOpt,
      reachedMin: rosterAfter >= playerMin,
      reachedOpt: rosterAfter >= playerOpt,
      s2BuyCount: teamBuys.length,
      s2BuySpend: buySpend,
      s2StarBuys: starBuys,
      s2SellCount,
      sellBlockedReason,
      hoarding: isCashHoardingTeam(input.gameState, team.teamId, input.seasonId),
    };
  });
}

function buildTeamAnalysisMarkdown(rows: Array<ReturnType<typeof buildTeamAnalysisRows>[number]>) {
  const hoarders = rows.filter((row) => row.hoarding);
  const cashRich = rows.filter((row) => row.financeProfile === "cash_rich").sort((a, b) => (b.cashSalaryRatio ?? 0) - (a.cashSalaryRatio ?? 0));
  const cashTight = rows.filter((row) => row.financeProfile === "cash_tight").sort((a, b) => (a.cashSalaryRatio ?? 0) - (b.cashSalaryRatio ?? 0));
  const winNow = rows.filter((row) => row.seasonStrategy === "win_now_push");
  const rebuild = rows.filter((row) => row.seasonStrategy === "rebuild_prospect" || row.seasonStrategy === "eco_round");
  const starChasers = rows
    .filter((row) => (row.starPriority ?? 0) >= 7 || row.s2StarBuys > 0)
    .sort((a, b) => b.s2StarBuys - a.s2StarBuys || (b.starPriority ?? 0) - (a.starPriority ?? 0));

  const line = (row: (typeof rows)[number]) =>
    `- **${row.teamCode}**: cash=${row.cash} · cash/salary=${row.cashSalaryRatio ?? "n/a"} · strategy=${row.seasonStrategy} · ambition=${row.ambition} · finances=${row.finances} · buys=${row.s2BuyCount} (★${row.s2StarBuys}) · ${row.identityAxis}`;

  return [
    "# Team Analysis — Finanzen, Strategie, Identität (S2 nach Convergence)",
    "",
    "## Cash reich (≥0.75 cash/salary)",
    "",
    ...(cashRich.length > 0 ? cashRich.map(line) : ["- (keine)"]),
    "",
    "## Cash knapp (≤0.25 cash/salary)",
    "",
    ...(cashTight.length > 0 ? cashTight.map(line) : ["- (keine)"]),
    "",
    "## Win-Now / Star-Chaser",
    "",
    ...(winNow.length > 0 ? winNow.map(line) : ["- (keine win_now_push)"]),
    "",
    ...(starChasers.slice(0, 10).map(line)),
    "",
    "## Rebuild / Eco",
    "",
    ...(rebuild.length > 0 ? rebuild.map(line) : ["- (keine rebuild/eco)"]),
    "",
    "## Hoarder",
    "",
    ...(hoarders.length > 0 ? hoarders.map(line) : ["- (keine)"]),
    "",
    "## Identitäts-Achsen (Top pow/spe)",
    "",
    ...rows
      .slice()
      .sort((left, right) => ((right.ambition ?? 0) + (right.finances ?? 0)) - ((left.ambition ?? 0) + (left.finances ?? 0)))
      .slice(0, 8)
      .map(line),
  ].join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const outputDir =
    process.env.OLY_PICK_AUDIT_OUTPUT_DIR ??
    path.join(PROJECT_ROOT, "outputs", `pick-audit-fresh-s1-s2-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
  const s2SourceSaveId = process.env.OLY_S2_SOURCE_SAVE ?? null;
  const buyPasses = Number(process.env.OLY_PICK_AUDIT_PASSES ?? "3");
  const buyRounds = Number(process.env.OLY_PICK_AUDIT_ROUNDS ?? "5");
  const s1StepsPerTeam = parseS1StepsFromArgv(process.argv.slice(2));

  await mkdir(outputDir, { recursive: true });
  log(`Output → ${outputDir}`);

  const fresh = persistence.createFreshSeasonOneSave({
    name: `Fresh S1-S2 Audit ${new Date().toISOString()}`,
  });
  log(`Fresh S1 save: ${fresh.saveId}`);

  log(`S1 steps per team: ${s1StepsPerTeam}`);

  const s1Preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId: fresh.gameState.season.id,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: s1StepsPerTeam,
      runMode: "season1_optimum_execute",
      draftSeed: `fresh-s1-s2-audit:${fresh.saveId}`,
    },
    persistence,
  );
  log(`S1 draft: planned=${s1Preview.globalExecution.plannedPickCount} applied=${s1Preview.globalExecution.appliedPickCount} gate=${s1Preview.qualityGate.passed ? "pass" : "fail"}`);

  let save = persistence.getSaveById(fresh.saveId);
  if (!save) throw new Error("Save missing after S1 draft");

  const s1TeamRows = save.gameState.teams.map((team) => {
    const identity = save!.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const rosterAfter = save!.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    return {
      teamCode: team.shortCode ?? team.teamId,
      rosterAfter,
      playerMin,
      playerOpt,
      reachedMin: rosterAfter >= playerMin,
      reachedOpt: rosterAfter >= playerOpt,
    };
  });
  const s1TeamsAtMin = s1TeamRows.filter((row) => row.reachedMin).length;
  const s1TeamsAtOpt = s1TeamRows.filter((row) => row.reachedOpt).length;
  log(`S1 roster: min=${s1TeamsAtMin}/32 opt=${s1TeamsAtOpt}/32`);

  const bootstrap = await bootstrapSaveToSeasonStart({
    saveId: save.saveId,
    targetSeasonId: "season-2",
    persistence,
    ensureAllTeamsAi: true,
    progressLog: true,
  });
  log(`Bootstrap S2: ok=${bootstrap.ok} seasons=${bootstrap.seasonsAdvanced} blockers=${bootstrap.blockers.join("|") || "none"}`);

  save = persistence.getSaveById(save.saveId);
  if (!save) throw new Error("Save missing after bootstrap");

  if (!bootstrap.ok && s2SourceSaveId) {
    log(`Bootstrap incomplete — cloning S2 source ${s2SourceSaveId}`);
    const cloned = persistence.cloneSave(s2SourceSaveId, `Fresh S1-S2 Audit S2 ${Date.now()}`);
    save = persistence.getSaveById(cloned.saveId);
    if (!save) throw new Error("S2 source clone failed");
  } else if (!bootstrap.ok) {
    log(`Bootstrap incomplete — continuing with reachable state (${save.gameState.season.id})`);
  }

  if (save.gameState.season.id !== "season-2") {
    const partialKpi = {
      saveId: save.saveId,
      s1SaveId: fresh.saveId,
      seasonId: save.gameState.season.id,
      s1DraftApplied: s1Preview.globalExecution.appliedPickCount,
      s1TeamsAtMin,
      s1TeamsAtOpt,
      bootstrapOk: bootstrap.ok,
      bootstrapBlockers: bootstrap.blockers,
      s2Skipped: true,
      checks: {
        s1AllTeamsAtMin: s1TeamsAtMin === 32,
        s1OptRate80: s1TeamsAtOpt >= 26,
      },
    };
    const partialSummary = [
      "# Fresh S1 → S2 Pick Audit (partial)",
      "",
      `- S1 save: \`${fresh.saveId}\` (draft applied: ${s1Preview.globalExecution.appliedPickCount})`,
      `- S1 roster after draft: min=${s1TeamsAtMin}/32 (${partialKpi.checks.s1AllTeamsAtMin ? "PASS" : "FAIL"}), opt=${s1TeamsAtOpt}/32 (${partialKpi.checks.s1OptRate80 ? "PASS" : "FAIL"})`,
      `- Bootstrap S2: FAILED (${bootstrap.blockers.join(" | ") || "unknown"})`,
      `- S2 convergence skipped — set \`OLY_S2_SOURCE_SAVE\` to clone a season-2 save for market KPIs.`,
    ].join("\n");
    await writeFile(path.join(outputDir, "pick-audit-kpi.json"), JSON.stringify(partialKpi, null, 2));
    await writeFile(path.join(outputDir, "pick-audit-summary.md"), partialSummary);
    log(`Partial audit written (S1 only). KPI → ${outputDir}`);
    return;
  }

  save = persistence.saveSingleplayerState(save.saveId, syncPreseasonTransferBudgets(save.gameState, save.gameState.season.id));
  const seasonId = save.gameState.season.id;
  const transferHistoryIdsBefore = new Set(save.gameState.transferHistory.map((entry) => entry.id));

  const convergence = await runMarketPlanConvergence({
    saveId: save.saveId,
    seasonId,
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxPasses: buyPasses,
    maxRoundsPerPass: buyRounds,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  log(`S2 convergence: buys=${convergence.appliedBuys} sells=${convergence.appliedSells}`);

  save = persistence.getSaveById(save.saveId);
  if (!save) throw new Error("Save missing after convergence");

  const preview = await buildAiTransfermarktPreview({
    source: "sqlite",
    saveId: save.saveId,
    seasonId,
    teamScope: "all",
    transferPhase: "manual_transfer_window",
  });
  const faPrices = preview.teams.flatMap((team) =>
    (team.legalCandidatePool ?? team.recommendedBuys ?? []).map((entry) => entry.price ?? entry.marketValue ?? null),
  );
  const leagueAnchors = buildLeagueMarketAnchors(faPrices);
  const leagueBrackets = buildLeagueMarketBrackets(faPrices);

  const buyTransfers = save.gameState.transferHistory.filter(
    (entry): entry is TransferHistoryEntry =>
      !transferHistoryIdsBefore.has(entry.id) && entry.transferType === "buy" && entry.seasonId === seasonId,
  );
  const sellTransfers = save.gameState.transferHistory.filter(
    (entry): entry is TransferHistoryEntry =>
      !transferHistoryIdsBefore.has(entry.id) && entry.transferType === "sell" && entry.seasonId === seasonId,
  );
  const sellCountByTeam = new Map<string, number>();
  for (const entry of sellTransfers) {
    const fromTeamId = entry.fromTeamId ?? "";
    if (!fromTeamId) continue;
    sellCountByTeam.set(fromTeamId, (sellCountByTeam.get(fromTeamId) ?? 0) + 1);
  }
  const convergenceByTeam = new Map(
    convergence.perTeam.map((team) => [team.teamId, { status: team.status, warnings: team.warnings }]),
  );

  const teamPlannedLanes = new Map<string, string[]>();
  for (const teamPreview of preview.teams) {
    const teamId = teamPreview.teamId;
    const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
    if (!team) continue;
    const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    const rosterGap = Math.max(playerOpt - rosterCount, 0);
    const missingToMin = Math.max(playerMin - rosterCount, 0);
    const spendable = resolvePlannerSpendableCash(save.gameState, teamId, team.cash);
    const profile = resolveMarketQualityProfile({
      gameState: save.gameState,
      teamId,
      rosterCount,
      spendable,
      anchors: leagueAnchors,
    });
    const buyCount = buyTransfers.filter((entry) => entry.toTeamId === teamId).length;
    if (buyCount <= 0) continue;
    const planned = buildQualityAwareSlotPlan({
      profile,
      spendable,
      rosterCount,
      steps: buyCount,
      missingToMin,
      rosterGap,
      anchors: leagueAnchors,
      faPrices,
    });
    teamPlannedLanes.set(teamId, planned);
  }

  const teamBuyOrder = new Map<string, number>();
  const pickRows = buyTransfers.map((entry) => {
    const price = entry.fee ?? entry.marketValue ?? null;
    const team = save!.gameState.teams.find((row) => row.teamId === entry.toTeamId);
    const player = save!.gameState.players.find((row) => row.id === entry.playerId);
    const buyIndex = teamBuyOrder.get(entry.toTeamId) ?? 0;
    teamBuyOrder.set(entry.toTeamId, buyIndex + 1);
    const plannedLanes = teamPlannedLanes.get(entry.toTeamId) ?? [];
    const plannedLane = plannedLanes[buyIndex] ?? "";
    const bracketTier = classifyMarketBracket(price, leagueBrackets);
    return {
      teamId: entry.toTeamId,
      teamCode: team?.shortCode ?? entry.toTeamId,
      playerId: entry.playerId,
      playerName: player?.name ?? "",
      price,
      plannedLane,
      plannedLanes: plannedLanes.join("|"),
      bracketTier,
      bracketMatchesLane:
        plannedLane === "superstar" || plannedLane === "star" || plannedLane === "core" || plannedLane === "depth" || plannedLane === "backup"
          ? Number(price ?? 0) >= leagueBrackets[plannedLane === "superstar" ? "superstar" : plannedLane === "star" ? "star" : plannedLane === "core" ? "core" : plannedLane === "depth" ? "depth" : "backup"].floorMw
          : null,
      legacyTier: classifyMarketTier(price, leagueAnchors),
      source: entry.source ?? "",
    };
  });

  const teamRows = save.gameState.teams.map((team) => {
    const identity = save!.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const rosterAfter = save!.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const salary = getTeamSalaryTotal(save!.gameState, team.teamId);
    const teamBuys = pickRows.filter((row) => row.teamId === team.teamId);
    const prices = teamBuys.map((row) => Number(row.price ?? 0)).filter((value) => value > 0);
    const plannedLanes = teamPlannedLanes.get(team.teamId) ?? [];
    return {
      teamId: team.teamId,
      teamCode: team.shortCode ?? team.teamId,
      rosterAfter,
      playerMin,
      playerOpt,
      reachedMin: rosterAfter >= playerMin,
      reachedOpt: rosterAfter >= playerOpt,
      cashAfter: round(team.cash ?? 0),
      cashSalaryAfter: salary > 0 ? round((team.cash ?? 0) / salary, 3) : null,
      buyCount: teamBuys.length,
      plannedLanes: plannedLanes.join("|"),
      avgPickMW: prices.length > 0 ? round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : null,
      maxPickMW: prices.length > 0 ? round(Math.max(...prices)) : null,
      hoardingAfter: isCashHoardingTeam(save!.gameState, team.teamId, seasonId),
    };
  });

  const teamsAtMin = teamRows.filter((row) => row.reachedMin).length;
  const teamsAtOpt = teamRows.filter((row) => row.reachedOpt).length;
  const hoardersAfter = teamRows.filter((row) => row.hoardingAfter).length;
  const cashRatios = teamRows.map((row) => row.cashSalaryAfter).filter((value): value is number => value != null);
  const medianCashSalary = median(cashRatios);
  const starPlusBuys = pickRows.filter((row) => Number(row.price ?? 0) >= leagueBrackets.star.floorMw).length;
  const bracketLabelMatches = pickRows.filter((row) => row.bracketMatchesLane === true).length;
  const bracketLabelChecks = pickRows.filter((row) => row.plannedLane && row.bracketMatchesLane != null).length;
  const avgPickMw =
    pickRows.length > 0
      ? round(
          pickRows.reduce((sum, row) => sum + Number(row.price ?? 0), 0) / pickRows.length,
        )
      : null;

  const teamsWithNegativeCash = teamRows.filter((row) => row.cashAfter < 0).length;
  const s2SellCount = sellTransfers.length;

  const teamAnalysisRows = buildTeamAnalysisRows({
    gameState: save.gameState,
    seasonId,
    pickRows,
    sellCountByTeam,
    convergenceByTeam,
  });
  const cashRecoveryTeamsWithSells = teamAnalysisRows.filter(
    (row) => row.seasonStrategy === "cash_recovery" && row.s2SellCount > 0,
  ).length;

  const kpi = {
    saveId: save.saveId,
    s1SaveId: fresh.saveId,
    seasonId,
    s1StepsPerTeam,
    s1DraftApplied: s1Preview.globalExecution.appliedPickCount,
    s1TeamsAtMin,
    s1TeamsAtOpt,
    bootstrapOk: bootstrap.ok,
    bootstrapBlockers: bootstrap.blockers,
    teamsAtMin,
    teamsAtOpt,
    hoardersAfter,
    medianCashSalary,
    starPlusBuys,
    avgPickMw,
    buyCount: pickRows.length,
    s2SellCount,
    teamsWithNegativeCash,
    cashRecoveryTeamsWithSells,
    convergenceAppliedSells: convergence.appliedSells,
    convergenceAppliedBuys: convergence.appliedBuys,
    bracketLabelMatches,
    bracketLabelChecks,
    bracketFloors: {
      superstar: leagueBrackets.superstar.floorMw,
      star: leagueBrackets.star.floorMw,
      core: leagueBrackets.core.floorMw,
      depth: leagueBrackets.depth.floorMw,
      backup: leagueBrackets.backup.floorMw,
    },
    checks: {
      allTeamsAtMin: teamsAtMin === 32,
      optRate80: teamsAtOpt >= 26,
      hoardersLe2: hoardersAfter <= 2,
      starPlusBuysGte3: starPlusBuys >= 3,
      medianCashSalaryBand:
        medianCashSalary != null && medianCashSalary >= 0.25 && medianCashSalary <= 0.75,
      bracketLabelsOk: bracketLabelChecks === 0 || bracketLabelMatches / bracketLabelChecks >= 0.8,
      cashRecoveryTeamsWithSellsGte1: cashRecoveryTeamsWithSells >= 1,
      s2SellCountGte1: s2SellCount >= 1,
    },
  };

  const teamAnalysisMd = buildTeamAnalysisMarkdown(teamAnalysisRows);

  const summary = [
    "# Fresh S1 → S2 Pick Audit",
    "",
    `- S1 save: \`${fresh.saveId}\` (draft applied: ${s1Preview.globalExecution.appliedPickCount}, steps/team=${s1StepsPerTeam})`,
    `- S1 roster after draft: min=${s1TeamsAtMin}/32, opt=${s1TeamsAtOpt}/32`,
    `- Bootstrap S2: ${bootstrap.ok ? "ok" : "partial"} (${bootstrap.blockers.join(" | ") || "no blockers"})`,
    `- S2 audit save: \`${save.saveId}\` (${seasonId})`,
    `- S2 convergence: buys=${convergence.appliedBuys} sells=${convergence.appliedSells} (${kpi.checks.s2SellCountGte1 ? "PASS" : "FAIL"} sell activity)`,
    `- Teams negative cash: ${teamsWithNegativeCash} · cash_recovery with sells: ${cashRecoveryTeamsWithSells}`,
    `- Teams ≥ Min: ${teamsAtMin}/32 (${kpi.checks.allTeamsAtMin ? "PASS" : "FAIL"})`,
    `- Teams ≥ Opt: ${teamsAtOpt}/32 (${kpi.checks.optRate80 ? "PASS" : "FAIL"}, target ≥26)`,
    `- Hoarders: ${hoardersAfter} (${kpi.checks.hoardersLe2 ? "PASS" : "FAIL"})`,
    `- Star+ buys (≥${leagueBrackets.star.floorMw} MW): ${starPlusBuys} (${kpi.checks.starPlusBuysGte3 ? "PASS" : "FAIL"})`,
    `- Median cash/salary: ${medianCashSalary ?? "n/a"} (${kpi.checks.medianCashSalaryBand ? "PASS" : "FAIL"})`,
    `- Bracket label match: ${bracketLabelMatches}/${bracketLabelChecks} (${kpi.checks.bracketLabelsOk ? "PASS" : "FAIL"})`,
    `- Bracket floors: superstar≥${leagueBrackets.superstar.floorMw}, star≥${leagueBrackets.star.floorMw}, core≥${leagueBrackets.core.floorMw}, depth≥${leagueBrackets.depth.floorMw}, backup≥${leagueBrackets.backup.floorMw}`,
    "",
    "## Run-5 baseline (market KPIs only)",
    "",
    "- Reference: `outputs/pick-audit-loop/run-5/pick-audit-kpi.json`",
    "",
    "## Picks",
    "",
    ...pickRows.slice(0, 20).map((row) => `- ${row.teamCode}: ${row.playerName} ${row.price} MW (${row.bracketTier}, planned=${row.plannedLane})`),
    "",
    "## Team analysis",
    "",
    "See `pick-audit-team-analysis.md` for finances/strategy/identity clusters.",
  ].join("\n");

  await writeFile(path.join(outputDir, "pick-audit-picks.csv"), toCsv(
    ["teamId", "teamCode", "playerId", "playerName", "price", "plannedLane", "plannedLanes", "bracketTier", "bracketMatchesLane", "legacyTier", "source"],
    pickRows,
  ));
  await writeFile(path.join(outputDir, "pick-audit-teams.csv"), toCsv(
    ["teamId", "teamCode", "rosterAfter", "playerMin", "playerOpt", "reachedMin", "reachedOpt", "cashAfter", "cashSalaryAfter", "buyCount", "plannedLanes", "avgPickMW", "maxPickMW", "hoardingAfter"],
    teamRows,
  ));
  await writeFile(path.join(outputDir, "pick-audit-kpi.json"), JSON.stringify(kpi, null, 2));
  await writeFile(path.join(outputDir, "pick-audit-summary.md"), summary);
  await writeFile(
    path.join(outputDir, "pick-audit-team-analysis.csv"),
    toCsv(
      [
        "teamId",
        "teamCode",
        "seasonStrategy",
        "tacticalMode",
        "starPriority",
        "rosterDepthPreference",
        "eliteSmallRosterPreference",
        "riskTolerance",
        "ambition",
        "finances",
        "harmony",
        "boardConfidence",
        "identityAxis",
        "gmProfile",
        "gmInfluencePct",
        "cash",
        "budget",
        "spendable",
        "cashReserve",
        "salaryTotal",
        "marketValueTotal",
        "cashSalaryRatio",
        "financeProfile",
        "rosterAfter",
        "playerMin",
        "playerOpt",
        "reachedMin",
        "reachedOpt",
        "s2BuyCount",
        "s2BuySpend",
        "s2StarBuys",
        "s2SellCount",
        "sellBlockedReason",
        "hoarding",
      ],
      teamAnalysisRows,
    ),
  );
  await writeFile(path.join(outputDir, "pick-audit-team-analysis.md"), teamAnalysisMd);

  log(`Done. KPI written to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
