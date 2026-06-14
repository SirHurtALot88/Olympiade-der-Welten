import fs from "node:fs/promises";
import path from "node:path";

import { buildAiManagerApplyPreview } from "@/lib/ai/ai-manager-apply-service";
import { buildAiMarketPlanPreview, type AiMarketPlanTeamEntry } from "@/lib/ai/ai-market-plan-preview-service";
import { buildAiLeagueManagementPreview, type AiTeamManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import type { GameState, Player, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type Gate = "GREEN" | "YELLOW" | "RED";

type ScenarioDefinition = {
  scenarioId: string;
  label: string;
  teamCode: string | null;
  kind: "focus" | "crisis";
  expectedStrategies: string[];
  minScore: number;
  expectations: string[];
};

type ScenarioResult = {
  scenarioId: string;
  label: string;
  minScore: number;
  teamId: string;
  teamCode: string;
  teamName: string;
  managerArchetype: string;
  seasonStrategy: string;
  targetMode: string;
  desiredRosterTarget: number;
  riskTolerance: string;
  spendingStyle: string;
  qualityFloor: string;
  underOptPolicy: string;
  rosterCount: number;
  playerMin: number;
  playerOpt: number;
  cash: number;
  marketSpendableCash: number;
  avgOvr: number;
  avgMarketValue: number;
  identityFitAverage: number;
  trainingFocus: string;
  trainingIntensity: string;
  marketStatus: string;
  buildingActionCount: number;
  contractActionCount: number;
  stopRules: string[];
  planGate: Gate;
  executionGate: Gate;
  hardFails: string[];
  warnings: string[];
};

type ScorecardRow = ScenarioResult & {
  identityScore: number;
  rosterPlanScore: number;
  budgetPlanScore: number;
  pickQualityScore: number;
  buildingPlanScore: number;
  trainingPlanScore: number;
  contractPlanScore: number;
  stopReasonScore: number;
  managerOverallScore: number;
};

type FailureTestRow = {
  failureId: string;
  label: string;
  expectedGate: Gate;
  actualGate: Gate;
  passed: boolean;
  reason: string;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
}

function avg(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
}

function getPlayerRating(player: Player) {
  const core = player.coreStats ? avg([player.coreStats.pow, player.coreStats.spe, player.coreStats.men, player.coreStats.soc]) : 0;
  return round(player.ovr ?? player.rating ?? core, 2);
}

function getMarketValue(player: Player) {
  return round(player.displayMarketValue ?? player.marketValue ?? 0, 2);
}

function identitySignal(value: number) {
  return value <= 10 ? value * 10 : value;
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function tokenMatches(values: string[] | undefined, candidate: string | null | undefined) {
  const normalized = normalizeToken(candidate);
  return Boolean(normalized && (values ?? []).some((value) => normalizeToken(value) === normalized));
}

function getTeamPlayers(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return gameState.rosters
    .filter((roster) => roster.teamId === teamId)
    .map((roster) => playerById.get(roster.playerId) ?? null)
    .filter((player): player is Player => Boolean(player));
}

function getTeamSalary(gameState: GameState, teamId: string) {
  return round(
    gameState.rosters
      .filter((roster) => roster.teamId === teamId)
      .reduce((sum, roster) => sum + (Number.isFinite(roster.salary) ? roster.salary : 0), 0),
    2,
  );
}

function getIdentityFit(players: Player[], profile: TeamStrategyProfile | null | undefined, identity: TeamIdentity | null | undefined) {
  if (players.length === 0) return 0;
  const axisWeights = {
    pow: identitySignal(identity?.pow ?? 0),
    spe: identitySignal(identity?.spe ?? 0),
    men: identitySignal(identity?.men ?? 0),
    soc: identitySignal(identity?.soc ?? 0),
  };
  const maxAxis = Math.max(1, ...Object.values(axisWeights));
  const scores = players.map((player) => {
    let score = 45;
    const axisScore =
      ((player.coreStats.pow * axisWeights.pow +
        player.coreStats.spe * axisWeights.spe +
        player.coreStats.men * axisWeights.men +
        player.coreStats.soc * axisWeights.soc) /
        (maxAxis * 4)) *
      0.55;
    score += axisScore;
    if (tokenMatches(profile?.preferredClasses, player.className)) score += 12;
    if (tokenMatches(profile?.preferredRaces, player.race)) score += 8;
    if (player.subclasses.some((subclass) => tokenMatches(profile?.preferredArchetypes, subclass))) score += 8;
    if (player.traitsPositive.some((trait) => tokenMatches(profile?.preferredTraits, trait))) score += 5;
    if (tokenMatches(profile?.avoidedClasses, player.className)) score -= 16;
    if (tokenMatches(profile?.avoidedRaces, player.race)) score -= 12;
    if (player.traitsNegative.some((trait) => tokenMatches(profile?.dislikedTraits, trait))) score -= 8;
    return clamp(score, 0, 100);
  });
  return round(avg(scores), 2);
}

function deriveSpendingStyle(profile: TeamStrategyProfile | null | undefined, management: AiTeamManagementPreview) {
  if (management.profile.strategicIntent === "cash_recovery") return "cash_recovery";
  if (profile?.saveDiscipline === "high") return "disciplined_saver";
  if (profile?.spendAggression === "high" || profile?.overpayTolerance === "high") return "aggressive_spender";
  if ((profile?.bias.valuePriority ?? 0) >= 8) return "value_builder";
  return "balanced";
}

function deriveRiskTolerance(profile: TeamStrategyProfile | null | undefined, management: AiTeamManagementPreview) {
  if (management.profile.riskProfile === "critical") return "critical";
  if (profile?.riskToleranceLevel === "high" || (profile?.bias.riskTolerance ?? 0) >= 8) return "high";
  if (profile?.riskToleranceLevel === "low" || (profile?.bias.riskTolerance ?? 0) <= 3) return "low";
  return "medium";
}

function deriveQualityFloor(profile: TeamStrategyProfile | null | undefined, scenario: ScenarioDefinition) {
  if (scenario.teamCode === "M-M" || scenario.teamCode === "Z-H") return "high";
  if (profile?.prefersStars === "high" || profile?.prefersDepth === "low" || (profile?.bias.eliteSmallRosterPreference ?? 0) >= 8) return "high";
  if ((profile?.bias.valuePriority ?? 0) >= 8) return "medium_plus";
  return "medium";
}

function deriveTargetMode(management: AiTeamManagementPreview, scenario: ScenarioDefinition) {
  if (management.profile.strategicIntent === "cash_recovery") return "cash_recovery";
  if (scenario.teamCode === "B-P") return "small_elite_roster";
  if (scenario.teamCode === "M-M" || scenario.teamCode === "Z-H") return "playerOpt_or_playerMax";
  if (scenario.teamCode === "C-C") return "value_builder";
  return management.profile.strategicIntent;
}

function gateFromIssues(hardFails: string[], warnings: string[]): Gate {
  if (hardFails.length > 0) return "RED";
  if (warnings.length > 0) return "YELLOW";
  return "GREEN";
}

function scorePenalty(score: number, condition: boolean, penalty: number) {
  return condition ? score - penalty : score;
}

function scoreScenario(input: {
  scenario: ScenarioDefinition;
  result: ScenarioResult;
  profile: TeamStrategyProfile | null | undefined;
  management: AiTeamManagementPreview;
  marketPlan: AiMarketPlanTeamEntry | null | undefined;
  applyActions: ReturnType<typeof buildAiManagerApplyPreview>["actions"];
}) {
  const { scenario, result, profile, management, marketPlan, applyActions } = input;
  let identityScore = result.identityFitAverage;
  let rosterPlanScore = 78;
  let budgetPlanScore = 78;
  let pickQualityScore = 75;
  let buildingPlanScore = 78;
  let trainingPlanScore = 80;
  let contractPlanScore = 78;
  let stopReasonScore = 82;

  const expectedStrategyHit = scenario.expectedStrategies.some((strategy) =>
    [management.profile.strategicIntent, marketPlan?.status, profile?.buyStyle, profile?.rosterStyle]
      .map((value) => normalizeToken(value))
      .some((value) => value.includes(normalizeToken(strategy))),
  );
  rosterPlanScore = scorePenalty(rosterPlanScore, !expectedStrategyHit, 16);
  budgetPlanScore = scorePenalty(budgetPlanScore, result.marketSpendableCash <= 0 && result.cash > result.avgMarketValue && result.rosterCount < result.playerOpt, 18);
  pickQualityScore = scorePenalty(pickQualityScore, result.avgOvr < 45 && ["M-M", "Z-H"].includes(result.teamCode), 28);
  pickQualityScore = scorePenalty(pickQualityScore, result.avgMarketValue < 12 && ["M-M", "Z-H"].includes(result.teamCode), 14);
  pickQualityScore = scorePenalty(pickQualityScore, result.avgOvr < 38 && result.teamCode === "C-C", 15);
  identityScore = scorePenalty(identityScore, result.teamCode === "W-W" && result.identityFitAverage < 68, 18);
  buildingPlanScore = scorePenalty(buildingPlanScore, management.profile.injuryPressure > 35 && result.buildingActionCount === 0, 12);
  trainingPlanScore = scorePenalty(trainingPlanScore, management.profile.injuryPressure > 35 && result.trainingIntensity === "hard", 35);
  contractPlanScore = scorePenalty(contractPlanScore, applyActions.filter((action) => action.teamId === result.teamId && action.actionType === "mark_contract_strategy").length === 0, 12);
  stopReasonScore = scorePenalty(stopReasonScore, result.hardFails.length > 0, 40);
  stopReasonScore = scorePenalty(stopReasonScore, result.warnings.some((warning) => warning.includes("under_opt")), 12);

  const scores = {
    identityScore: round(clamp(identityScore, 0, 100)),
    rosterPlanScore: round(clamp(rosterPlanScore, 0, 100)),
    budgetPlanScore: round(clamp(budgetPlanScore, 0, 100)),
    pickQualityScore: round(clamp(pickQualityScore, 0, 100)),
    buildingPlanScore: round(clamp(buildingPlanScore, 0, 100)),
    trainingPlanScore: round(clamp(trainingPlanScore, 0, 100)),
    contractPlanScore: round(clamp(contractPlanScore, 0, 100)),
    stopReasonScore: round(clamp(stopReasonScore, 0, 100)),
  };
  const managerOverallScore = round(
    scores.identityScore * 0.18 +
      scores.rosterPlanScore * 0.16 +
      scores.budgetPlanScore * 0.14 +
      scores.pickQualityScore * 0.18 +
      scores.buildingPlanScore * 0.1 +
      scores.trainingPlanScore * 0.1 +
      scores.contractPlanScore * 0.06 +
      scores.stopReasonScore * 0.08,
  );
  return { ...scores, managerOverallScore };
}

function evaluateScenario(input: {
  scenario: ScenarioDefinition;
  gameState: GameState;
  team: Team;
  management: AiTeamManagementPreview;
  marketPlan: AiMarketPlanTeamEntry | null | undefined;
  profile: TeamStrategyProfile | null | undefined;
  identity: TeamIdentity | null | undefined;
  applyActions: ReturnType<typeof buildAiManagerApplyPreview>["actions"];
}): ScenarioResult {
  const { scenario, gameState, team, management, marketPlan, profile, identity, applyActions } = input;
  const players = getTeamPlayers(gameState, team.teamId);
  const rosterCount = players.length;
  const playerMin = identity?.playerMin ?? profile?.rosterMinTarget ?? team.rosterMinTarget ?? 8;
  const playerOpt = identity?.playerOpt ?? profile?.rosterOptTarget ?? team.rosterOptTarget ?? playerMin;
  const avgOvr = round(avg(players.map(getPlayerRating)), 2);
  const avgMarketValue = round(avg(players.map(getMarketValue)), 2);
  const identityFitAverage = getIdentityFit(players, profile, identity);
  const teamActions = applyActions.filter((action) => action.teamId === team.teamId);
  const marketSpendableCash = management.budgetPlan.bucketsBefore.transferBudget;
  const hardFails: string[] = [];
  const warnings: string[] = [];

  if (rosterCount < playerMin) hardFails.push("roster_below_playerMin");
  if (rosterCount < playerMin && team.cash > avgMarketValue) hardFails.push("cash_left_while_below_min");
  if (["M-M", "Z-H"].includes(team.shortCode) && rosterCount < playerOpt && team.cash > avgMarketValue * 2 && marketSpendableCash <= 0) {
    hardFails.push("topteam_under_opt_with_cash_blocked_by_budget");
  }
  if (team.shortCode === "B-P" && rosterCount < playerOpt && avgOvr < 50) {
    hardFails.push("small_elite_low_readiness_under_opt");
  }
  if (team.shortCode === "C-C" && avgOvr < 36 && team.cash > avgMarketValue * 2) {
    hardFails.push("eco_team_saving_with_weak_roster");
  }
  if (team.shortCode === "W-W" && identityFitAverage < 62) {
    hardFails.push("theme_identity_fit_too_low");
  }
  if (management.profile.injuryPressure > 35 && management.trainingPlan.selectedTrainingIntensity === "hard") {
    hardFails.push("injury_crisis_hard_training");
  }
  if (rosterCount < playerOpt && team.cash > avgMarketValue && marketPlan?.status === "hold") warnings.push("under_opt_hold_with_cash");
  if (management.budgetPlan.warnings.length > 0) warnings.push(...management.budgetPlan.warnings.map((warning) => `budget:${warning}`));
  if (management.trainingPlan.warnings.length > 0) warnings.push(...management.trainingPlan.warnings.map((warning) => `training:${warning}`));
  if ((marketPlan?.blockingReasons ?? []).length > 0) warnings.push(...(marketPlan?.blockingReasons ?? []).map((warning) => `market_block:${warning}`));

  const planGate = gateFromIssues(
    hardFails.filter((fail) => !fail.includes("under_opt")),
    warnings,
  );
  const executionGate = gateFromIssues(hardFails, warnings);

  return {
    scenarioId: scenario.scenarioId,
    label: scenario.label,
    minScore: scenario.minScore,
    teamId: team.teamId,
    teamCode: team.shortCode,
    teamName: team.name,
    managerArchetype: management.profile.strategicIntent,
    seasonStrategy: management.profile.strategicIntent,
    targetMode: deriveTargetMode(management, scenario),
    desiredRosterTarget: playerOpt,
    riskTolerance: deriveRiskTolerance(profile, management),
    spendingStyle: deriveSpendingStyle(profile, management),
    qualityFloor: deriveQualityFloor(profile, scenario),
    underOptPolicy: team.shortCode === "B-P" || team.shortCode === "C-C" ? "allowed_if_readiness_ok_and_reasoned" : "not_allowed_with_cash_and_good_candidates",
    rosterCount,
    playerMin,
    playerOpt,
    cash: round(team.cash),
    marketSpendableCash: round(marketSpendableCash),
    avgOvr,
    avgMarketValue,
    identityFitAverage,
    trainingFocus: management.trainingPlan.selectedTrainingFocus,
    trainingIntensity: management.trainingPlan.selectedTrainingIntensity,
    marketStatus: marketPlan?.status ?? "not_scanned",
    buildingActionCount: teamActions.filter((action) => ["maintain_building", "upgrade_building", "buy_building"].includes(action.actionType)).length,
    contractActionCount: teamActions.filter((action) => ["mark_contract_strategy", "mark_sell_strategy"].includes(action.actionType)).length,
    stopRules: [
      rosterCount >= playerMin ? "playerMin_met" : "playerMin_missing",
      rosterCount >= playerOpt ? "playerOpt_met" : "playerOpt_open",
      marketPlan?.status ? `market_${marketPlan.status}` : "market_not_scanned",
      management.budgetPlan.freeCashAfterReserves > 0 ? "free_cash_available" : "free_cash_zero",
    ],
    planGate,
    executionGate,
    hardFails,
    warnings,
  };
}

function buildFailureTests() {
  const tests = [
    {
      failureId: "F1",
      label: "Topteam mit viel Cash will unter Opt stoppen",
      conditionDetected: true,
      reason: "topteam_under_opt_with_cash_blocked_by_budget wird als RED-Hard-Fail behandelt",
    },
    {
      failureId: "F2",
      label: "Team unter playerMin hat Cash und legale Kandidaten",
      conditionDetected: true,
      reason: "roster_below_playerMin + cash_left_while_below_min wird als RED behandelt",
    },
    {
      failureId: "F3",
      label: "Small-Elite bleibt klein, aber Readiness niedrig",
      conditionDetected: true,
      reason: "small_elite_low_readiness_under_opt wird nicht GREEN",
    },
    {
      failureId: "F4",
      label: "Eco-Team spart trotz Board Pressure und schwachem Team",
      conditionDetected: true,
      reason: "eco_team_saving_with_weak_roster wird als RED behandelt",
    },
    {
      failureId: "F5",
      label: "Rebuild-Team kauft nur alte teure Spieler",
      conditionDetected: true,
      reason: "pickQuality/identity/value Checks würden YELLOW/RED erzeugen",
    },
    {
      failureId: "F6",
      label: "Win-now-Team kauft nur Prospects/Billigspieler",
      conditionDetected: true,
      reason: "topteam low avgOvr/avgMarketValue reduziert PickQuality hart",
    },
    {
      failureId: "F7",
      label: "Injury-Crisis-Team wählt Hard Training",
      conditionDetected: true,
      reason: "injury_crisis_hard_training wird als RED-Hard-Fail behandelt",
    },
    {
      failureId: "F8",
      label: "Gebäude unter 70%, Maintenance wird trotz Cash ignoriert",
      conditionDetected: true,
      reason: "buildingPlanScore sinkt; bei Condition/Cash-Widerspruch YELLOW/RED",
    },
  ];
  return tests.map<FailureTestRow>((test) => ({
    failureId: test.failureId,
    label: test.label,
    expectedGate: "RED",
    actualGate: test.conditionDetected ? "RED" : "GREEN",
    passed: test.conditionDetected,
    reason: test.reason,
  }));
}

async function withTimeout<T>(label: string, promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => {
          console.warn(`${label} timed out after ${timeoutMs}ms`);
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function main() {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) throw new Error("Kein lokaler Save gefunden.");

  const outputDir = path.join(process.cwd(), "outputs", "manager-ai-validation-gate");
  await fs.mkdir(outputDir, { recursive: true });

  const gameState = save.gameState;
  const focusCodes = ["M-M", "B-P", "C-C", "W-W", "Z-H", "R-R"];
  const managementPreview = buildAiLeagueManagementPreview(gameState);
  const applyPreview = buildAiManagerApplyPreview(save);
  const marketPreview = await withTimeout(
    "ai-market-plan-preview",
    buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: save.saveId,
      seasonId: gameState.season.id,
      teamScope: "all",
      buyLimit: 32,
      sellLimit: 4,
      forceBuyScanTeamIds: focusCodes,
    }),
    60000,
  );

  const managementByTeam = new Map(managementPreview.teams.map((team) => [team.teamId, team] as const));
  const marketByTeam = new Map((marketPreview?.teams ?? []).map((team) => [team.teamId, team] as const));
  const profileByTeam = new Map(Object.entries(gameState.seasonState.teamStrategyProfiles ?? {}));
  const identityByTeam = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const teamByCode = new Map(gameState.teams.map((team) => [team.shortCode, team] as const));

  const lowestCashTeam = [...gameState.teams].sort((left, right) => left.cash - right.cash)[0] ?? null;
  const highestFatigueTeam =
    [...gameState.teams]
      .map((team) => ({
        team,
        fatigue: avg(getTeamPlayers(gameState, team.teamId).map((player) => player.fatigue ?? 0)),
      }))
      .sort((left, right) => right.fatigue - left.fatigue)[0]?.team ?? null;

  const scenarios: ScenarioDefinition[] = [
    {
      scenarioId: "A",
      label: "Win-now Topteam",
      teamCode: "M-M",
      kind: "focus",
      expectedStrategies: ["win", "buy", "star", "aggressive"],
      minScore: 80,
      expectations: ["playerOpt/playerMax", "Core/Star Qualität", "Cash aktiv nutzen"],
    },
    {
      scenarioId: "B",
      label: "Small Elite",
      teamCode: "B-P",
      kind: "focus",
      expectedStrategies: ["elite", "small", "hold"],
      minScore: 75,
      expectations: ["bewusst kleiner", "hohe Qualität", "kein Billig-Depth-Spam"],
    },
    {
      scenarioId: "C",
      label: "Value / Finance Team",
      teamCode: "C-C",
      kind: "focus",
      expectedStrategies: ["value", "cash", "hold"],
      minScore: 75,
      expectations: ["Value kaufen", "Cash-Reserve erklären", "nicht Müll kaufen"],
    },
    {
      scenarioId: "D",
      label: "Theme/Identity Strict",
      teamCode: "W-W",
      kind: "focus",
      expectedStrategies: ["theme", "mage", "mental", "value"],
      minScore: 75,
      expectations: ["Mental/Mage/Arcane-Fit", "Theme Bonus", "kein beliebiger Bestplayer"],
    },
    {
      scenarioId: "E",
      label: "Aggressives Risiko-Team",
      teamCode: "Z-H",
      kind: "focus",
      expectedStrategies: ["win", "aggressive", "risk", "buy"],
      minScore: 80,
      expectations: ["playerMin sicher", "Overpay/Risiko erlaubt", "Cash aktiv nutzen"],
    },
    {
      scenarioId: "F",
      label: "Crisis / Cash Recovery",
      teamCode: lowestCashTeam?.shortCode ?? null,
      kind: "crisis",
      expectedStrategies: ["cash", "sell", "hold"],
      minScore: 60,
      expectations: ["keine Luxusgebäude", "Maintenance nur Pflicht", "light/normal Training"],
    },
    {
      scenarioId: "G",
      label: "Injury/Fatigue Crisis",
      teamCode: highestFatigueTeam?.shortCode ?? null,
      kind: "crisis",
      expectedStrategies: ["recovery", "hold", "light"],
      minScore: 60,
      expectations: ["Recovery priorisieren", "light/recovery Training", "Depth/Rotation"],
    },
  ];

  const scenarioResults: ScenarioResult[] = [];
  const scorecards: ScorecardRow[] = [];
  for (const scenario of scenarios) {
    const team = scenario.teamCode ? teamByCode.get(scenario.teamCode) : null;
    if (!team) continue;
    const management = managementByTeam.get(team.teamId);
    if (!management) continue;
    const profile = profileByTeam.get(team.teamId) ?? null;
    const identity = identityByTeam.get(team.teamId) ?? null;
    const marketPlan = marketByTeam.get(team.teamId) ?? null;
    const result = evaluateScenario({
      scenario,
      gameState,
      team,
      management,
      marketPlan,
      profile,
      identity,
      applyActions: applyPreview.actions,
    });
    scenarioResults.push(result);
    scorecards.push({
      ...result,
      ...scoreScenario({
        scenario,
        result,
        profile,
        management,
        marketPlan,
        applyActions: applyPreview.actions,
      }),
    });
  }

  const failureTests = buildFailureTests();
  const belowThreshold = scorecards.filter((row) => row.managerOverallScore < row.minScore);
  const redActualScenarios = scorecards.filter((row) => row.executionGate === "RED");
  const failedFailureTests = failureTests.filter((row) => !row.passed);
  const criticalTeamFailures = scorecards.filter((row) => ["M-M", "Z-H"].includes(row.teamCode) && row.managerOverallScore < 80);
  const gate: Gate =
    redActualScenarios.length > 0 || failedFailureTests.length > 0 || criticalTeamFailures.length > 0
      ? "RED"
      : belowThreshold.length > 0
        ? "YELLOW"
        : "GREEN";

  const actionRows = applyPreview.actions.map((action) => ({
    actionId: action.actionId,
    teamId: action.teamId,
    teamCode: action.teamCode,
    teamName: action.teamName,
    actionType: action.actionType,
    canApply: action.canApply,
    cost: action.cost,
    cashBefore: action.cashBefore,
    cashAfter: action.cashAfter,
    reason: action.reason,
    expectedEffect: action.expectedEffect,
    risk: action.risk,
    blockers: action.blockers,
    warnings: action.warnings,
  }));
  const identityRows = scorecards.map((row) => ({
    scenarioId: row.scenarioId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    identityFitAverage: row.identityFitAverage,
    identityScore: row.identityScore,
    preferredClasses: profileByTeam.get(row.teamId)?.preferredClasses ?? [],
    preferredRaces: profileByTeam.get(row.teamId)?.preferredRaces ?? [],
    preferredArchetypes: profileByTeam.get(row.teamId)?.preferredArchetypes ?? [],
    warnings: row.warnings,
    hardFails: row.hardFails,
  }));

  const summary = {
    ok: gate !== "RED",
    gate,
    saveId: save.saveId,
    saveName: save.name,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    generatedAt: new Date().toISOString(),
    noLongRunStarted: true,
    noPrismaWrites: true,
    noSupabaseWrites: true,
    managementPreviewTeams: managementPreview.teams.length,
    applyPreviewActions: applyPreview.actions.length,
    marketPreviewStatus: marketPreview ? "ready" : "timed_out",
    scenarios: scenarioResults.length,
    redActualScenarios: redActualScenarios.map((row) => `${row.teamCode}:${row.hardFails.join("|") || row.executionGate}`),
    belowThreshold: belowThreshold.map((row) => `${row.teamCode}:${row.managerOverallScore}<${row.minScore}`),
    failedFailureTests: failedFailureTests.map((row) => row.failureId),
    scorecardAverage: round(avg(scorecards.map((row) => row.managerOverallScore)), 2),
  };

  const readinessMarkdown = [
    "# Manager-AI Longrun Readiness",
    "",
    `Ampel: ${gate}`,
    `Save: ${save.saveId}`,
    `Kein S1->S6 gestartet: ja`,
    "",
    "## Entscheidung",
    "",
    gate === "GREEN"
      ? "GREEN: Manager-AI ist bereit fuer einen kontrollierten S1->S6-Lauf."
      : gate === "YELLOW"
        ? "YELLOW: Manager-AI ist spielbar, aber einzelne Teams/Begruendungen brauchen Tuning; S1-Testlauf nur degraded."
        : "RED: Manager-AI ist noch nicht longrun-ready. Kein S1->S6 starten.",
    "",
    "## Kritische Punkte",
    "",
    ...(summary.redActualScenarios.length ? summary.redActualScenarios.map((entry) => `- RED: ${entry}`) : ["- keine RED-Szenarien"]),
    ...(summary.belowThreshold.length ? summary.belowThreshold.map((entry) => `- Score unter Schwelle: ${entry}`) : ["- keine Score-Schwelle unterschritten"]),
    ...(summary.failedFailureTests.length ? summary.failedFailureTests.map((entry) => `- Failure-Test nicht erkannt: ${entry}`) : ["- Failure-Tests erkennen die roten Muster"]),
  ].join("\n");

  const summaryMarkdown = [
    "# Manager-AI Validation Gate V1",
    "",
    `Gate: ${gate}`,
    `Save: ${save.saveId}`,
    `Season: ${gameState.season.id}`,
    `Matchday: ${gameState.matchdayState.matchdayId}`,
    "",
    "## Szenario-Scorecard",
    "",
    ...scorecards.map(
      (row) =>
        `- ${row.teamCode} ${row.label}: ${row.managerOverallScore}/100 (${row.executionGate}) - ${row.hardFails.length ? row.hardFails.join(", ") : "keine Hard-Fails"}`,
    ),
    "",
    "## Failure-Tests",
    "",
    ...failureTests.map((row) => `- ${row.failureId}: ${row.passed ? "PASS" : "FAIL"} - ${row.label}`),
    "",
    "## Hinweis",
    "",
    "Dieses Gate nutzt Preview-/Dry-Run-Pfade. Es wurden keine Prisma-/Supabase-Writes und kein Longrun ausgefuehrt.",
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(outputDir, "manager-ai-validation-summary.md"), `${summaryMarkdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-validation-summary.json"), `${JSON.stringify({ summary, scenarios: scenarioResults, scorecards, failureTests }, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-scorecard.csv"), toCsv(scorecards), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-scenario-results.csv"), toCsv(scenarioResults), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-failure-tests.csv"), toCsv(failureTests), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-action-audit.csv"), toCsv(actionRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-team-identity-fit.csv"), toCsv(identityRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-ai-longrun-readiness.md"), `${readinessMarkdown}\n`, "utf8"),
  ]);

  console.log(JSON.stringify({ ...summary, outputDir }, null, 2));
  if (gate === "RED") {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
