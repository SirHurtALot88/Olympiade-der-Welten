import type { Discipline, FormCardColor, GameState, Player, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

export type DraftAxis = "pow" | "spe" | "men" | "soc";

export type DraftRole = "reserve" | "backup" | "depth" | "value" | "prospect" | "theme" | "starter" | "core" | "star" | "superstar";

export type OpenDisciplineHole = {
  disciplineId: string;
  disciplineName: string;
  axis: DraftAxis;
  playerCount: number;
  importance: number;
  need01: number;
  holeSeverity: number;
  coverageCount60: number;
  coverageCount70: number;
  coverageCount90: number;
  top3avg: number;
  top6avg: number;
};

export type TeamNeedState = {
  teamId: string;
  rosterCount: number;
  targetRosterSize: number;
  plannedSteps: number;
  axisPriorityAbs: Record<DraftAxis, number>;
  axisShares01: Record<DraftAxis, number>;
  topAxis: DraftAxis;
  secondAxis: DraftAxis;
  thirdAxis: DraftAxis;
  focusRigidity01: number;
  extremeFocus01: number;
  openDisciplineHoles: OpenDisciplineHole[];
  weightedNeedPrimary: number;
  weightedNeedSecondary: number;
  weightedNeedSide: number;
  weightedNeedTotal: number;
  topAxisOpenHolePressure01: number;
  formColorCounts: Record<FormCardColor, number>;
  formColorTargetCounts: Record<FormCardColor, number>;
  formColorShares01: Record<FormCardColor, number>;
  formColorNeed01: Record<FormCardColor, number>;
  primaryFormColorNeed: FormCardColor;
  primaryFormColorAxis: DraftAxis;
  formColorDiversityNeed01: number;
};

export type MarginalNeedGain = {
  needImpactScore: number;
  needScoreApplied: number;
  matchedNeedCount: number;
  matchedNeedLabels: string[];
  bestDisciplineId: string;
  bestDisciplineName: string;
  bestAxis: DraftAxis;
  bestDisciplineScore: number;
  bestDisciplineGain: number;
  bestDisciplineGain01: number;
  bestDisciplineOverCut01: number;
  formColor: FormCardColor | null;
  formColorAxis: DraftAxis | null;
  formColorNeedScore: number;
  formColorNeed01: number;
  axisTop6Delta: number;
  disziTop6Delta: number;
};

export type RetoolAi2BudgetPlan = {
  cash: number;
  rosterSize: number;
  playerMin: number;
  optimum: number;
  missingToMin: number;
  missingToOptimum: number;
  ambition: number;
  finances: number;
  harmony: number;
  currentRank: number;
  previousRank: number;
  rankTrendRecent: number;
  salaryFactors5: number[];
  salaryFactorCurrent: number;
  sponsorSupport: number;
  sponsorSupportForecast5: number[];
  rosterSalaryKnown: number;
  rosterMarketValue: number;
  avgKnownSalaryPerPlayer: number;
  estimatedMissingSalary: number;
  marketBasedSalaryEstimate: number;
  fullRosterSalaryProjection: number;
  rosterSalaryFloor: number;
  expectedSalaryBase: number;
  salarySavingsShare: number;
  protectedSalaryReserve: number;
  salaryBurdenRatio: number;
  cashRunwayRatio: number;
  cashRunway01: number;
  financeSafetyReserve: number;
  cashRelief: number;
  salaryBurdenAdd: number;
  reserveTargetMin: number;
  reserveTargetBase: number;
  reserveTargetMax: number;
  reserveTarget: number;
  reservePolicy: "aggressive" | "balanced" | "conservative";
  aggression01: number;
  caution01: number;
  spendPostureScore: number;
  rawBudgetMax: number;
  allowedBudgetForSearch: number;
  spendWindowFloor: number;
  spendWindowBase: number;
  spendWindowCeiling: number;
  softSlotBudget: number;
};

const AXES: DraftAxis[] = ["pow", "spe", "men", "soc"];
const FORM_COLORS: FormCardColor[] = ["red", "green", "blue", "yellow"];
const COLOR_TO_AXIS: Record<FormCardColor, DraftAxis> = {
  red: "pow",
  green: "spe",
  blue: "men",
  yellow: "soc",
};
const AXIS_TO_COLOR: Record<DraftAxis, FormCardColor> = {
  pow: "red",
  spe: "green",
  men: "blue",
  soc: "yellow",
};
const CLASS_COLOR_BY_CLASS: Record<string, FormCardColor> = {
  berserker: "red",
  warlord: "red",
  tank: "red",
  sprinter: "green",
  rogue: "green",
  charger: "green",
  mage: "blue",
  overseer: "blue",
  templar: "blue",
  bard: "yellow",
  hero: "yellow",
  badass: "yellow",
  tactician: "yellow",
};

function round(value: number, digits = 4) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function levelToNumber(level: TeamStrategyProfile["saveDiscipline"] | undefined, low = 3, medium = 5, high = 8) {
  if (level === "high") return high;
  if (level === "medium") return medium;
  if (level === "low") return low;
  return 0;
}

function normalizeFactors(input: number[] | null | undefined) {
  const values = (Array.isArray(input) ? input : [])
    .map((value) => clamp(Number(value) || 1, 0.25, 2.5))
    .filter((value) => Number.isFinite(value) && value > 0);
  while (values.length < 5) values.push(values.at(-1) ?? 1);
  return values.slice(0, 5);
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function categoryToAxis(category: Discipline["category"] | DraftAxis | string | null | undefined): DraftAxis {
  const key = normalizeKey(category);
  if (key === "power" || key === "pow" || key === "red") return "pow";
  if (key === "speed" || key === "spe" || key === "green") return "spe";
  if (key === "mental" || key === "men" || key === "blue") return "men";
  if (key === "social" || key === "soc" || key === "yellow") return "soc";
  return "pow";
}

export function axisToFormColor(axis: DraftAxis): FormCardColor {
  return AXIS_TO_COLOR[axis];
}

export function getPlayerFormColor(player: Pick<Player, "className">): FormCardColor | null {
  const key = normalizeKey(player.className);
  return CLASS_COLOR_BY_CLASS[key] ?? null;
}

function getAxisValue(player: Player, axis: DraftAxis) {
  const core = Number(player.coreStats?.[axis]);
  if (Number.isFinite(core)) return core;
  return Number(player.rating) || 0;
}

function getDisciplineValue(
  player: Player,
  discipline: { id: string; name: string; category: Discipline["category"] | DraftAxis | string },
) {
  const candidates = [
    discipline.id,
    discipline.name,
    normalizeKey(discipline.id),
    normalizeKey(discipline.name),
    normalizeKey(discipline.id).replaceAll("_", "-"),
    normalizeKey(discipline.name).replaceAll("_", "-"),
  ].filter(Boolean);
  for (const key of candidates) {
    const value =
      player.disciplineRatings?.[key] ??
      player.currentDisciplineValues?.[key] ??
      player.lastSeasonDisciplineValues?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return getAxisValue(player, categoryToAxis(discipline.category)) * 0.88;
}

function topValues(values: number[], count: number) {
  return values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left)
    .slice(0, Math.max(0, Math.round(count)));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getAxisPriority(identity: TeamIdentity | null | undefined): Record<DraftAxis, number> {
  return {
    pow: clamp(Number(identity?.pow) || 0, 0, 20),
    spe: clamp(Number(identity?.spe) || 0, 0, 20),
    men: clamp(Number(identity?.men) || 0, 0, 20),
    soc: clamp(Number(identity?.soc) || 0, 0, 20),
  };
}

export function buildRetoolAi2BudgetPlan(input: {
  team: Pick<Team, "teamId" | "cash">;
  teamIdentity?: TeamIdentity | null;
  strategyProfile?: TeamStrategyProfile | null;
  rosterSize: number;
  rosterSalaryKnown: number;
  rosterMarketValue: number;
  playerMin?: number | null;
  optimum?: number | null;
  currentRank?: number | null;
  previousRank?: number | null;
  salaryFactors5?: number[] | null;
  sponsorSupport?: number | null;
}) {
  const cash = Math.max(0, Number(input.team.cash) || 0);
  const bias = input.strategyProfile?.bias;
  const ambition = clamp(
    Math.max(
      Number(input.teamIdentity?.ambition) || 5,
      Number(bias?.starPriority) || 0,
      levelToNumber(input.strategyProfile?.spendAggression, 2, 5, 8),
    ),
    1,
    10,
  );
  const finances = clamp(
    Math.max(
      Number(input.teamIdentity?.finances) || 5,
      Number(bias?.cashPriority) || 0,
      Number(bias?.wageSensitivity) || 0,
      levelToNumber(input.strategyProfile?.saveDiscipline, 3, 6, 9),
    ),
    1,
    10,
  );
  const harmony = clamp(
    Math.max(Number(input.teamIdentity?.harmony) || 5, Number(bias?.harmonyStrictness) || 0),
    1,
    10,
  );
  const rosterSize = Math.max(0, Math.round(input.rosterSize));
  const playerMin = clamp(Math.round(Number(input.playerMin ?? input.teamIdentity?.playerMin) || (finances >= 7 ? 10 : 9)), 8, 12);
  const optimum = clamp(Math.round(Number(input.optimum ?? input.teamIdentity?.playerOpt) || Math.max(playerMin, finances >= 6 ? 11 : 10)), playerMin, 12);
  const missingToMin = Math.max(0, playerMin - rosterSize);
  const missingToOptimum = Math.max(0, optimum - rosterSize);
  const currentRank = Number(input.currentRank) || 32;
  const previousRank = Number(input.previousRank) || currentRank;
  const rankTrendRecent = previousRank - currentRank;
  const trendUp01 = clamp(rankTrendRecent / 8, 0, 1);
  const trendDown01 = clamp(-rankTrendRecent / 8, 0, 1);
  const currentRank01 = clamp((currentRank - 1) / 31, 0, 1);
  const salaryFactors5 = normalizeFactors(input.salaryFactors5);
  const salaryFactorCurrent = salaryFactors5[0] ?? 1;
  const rosterSalaryKnown = Math.max(0, Number(input.rosterSalaryKnown) || 0);
  const rosterMarketValue = Math.max(0, Number(input.rosterMarketValue) || 0);
  const avgKnownSalaryPerPlayer = rosterSize > 0 ? rosterSalaryKnown / Math.max(1, rosterSize) : 0;
  const estimatedMissingSalary = avgKnownSalaryPerPlayer > 0 ? avgKnownSalaryPerPlayer * missingToOptimum * salaryFactorCurrent : 0;
  const marketBasedSalaryEstimate = rosterMarketValue > 0 ? rosterMarketValue * salaryFactorCurrent : 0;
  const rosterSalaryFloor = optimum * (3.6 + ambition * 0.25 + finances * 0.1);
  const fullRosterSalaryProjection = rosterSalaryKnown > 0 ? rosterSalaryKnown + estimatedMissingSalary : marketBasedSalaryEstimate;
  const expectedSalaryBase = Math.max(fullRosterSalaryProjection, rosterSalaryFloor);
  const sponsorSupportEstimated = Math.max(10, 14 + (32 - currentRank) * 0.9 + ambition * 0.8);
  const sponsorSupport = Math.max(0, Number(input.sponsorSupport) || sponsorSupportEstimated);
  const sponsorSupportForecast5 = salaryFactors5.map((factor) => round(sponsorSupport * (factor / Math.max(0.0001, salaryFactorCurrent)), 2));

  const salarySavingsShare = clamp(0.3 + (finances - 5) * 0.06 + (ambition - 5) * 0.025, 0.15, 0.85);
  const protectedSalaryReserve = Math.max(0, expectedSalaryBase * (1 - salarySavingsShare) - sponsorSupport * 0.7);
  const salaryBurdenRatio = cash > 0 ? expectedSalaryBase / Math.max(1, cash) : 1;
  const cashRunwayRatio = expectedSalaryBase > 0 ? cash / Math.max(1, expectedSalaryBase) : 0;
  const cashRunway01 = clamp((cashRunwayRatio - 1.2) / 3.8, 0, 1);
  const financeSafetyReserve = 10 + finances * 2.4 + harmony * 0.8 + (missingToMin > 0 ? 0 : 4) + (missingToOptimum <= 1 ? 4 : 0);
  const cashRelief = cashRunway01 * (6 + ambition * 0.4);
  const salaryBurdenAdd = clamp(salaryBurdenRatio, 0, 1.5) * 10;
  const reserveTargetMin = clamp(
    financeSafetyReserve * 0.68 + protectedSalaryReserve * 0.5 + salaryBurdenAdd * 0.4 - cashRelief * 0.55,
    12,
    Math.max(18, cash * 0.1),
  );
  const reserveTargetBase = clamp(
    financeSafetyReserve + protectedSalaryReserve + salaryBurdenAdd - cashRelief,
    16,
    Math.max(22, cash * 0.18),
  );
  const reserveTargetMax = clamp(
    financeSafetyReserve * 1.22 + protectedSalaryReserve * 1.18 + salaryBurdenAdd * 1.1 - cashRelief * 0.75,
    20,
    Math.max(28, cash * 0.32),
  );
  const aggression01 = clamp(
    0.26 * ((ambition - 1) / 9) +
      0.24 * currentRank01 +
      0.2 * trendDown01 +
      0.16 * clamp(missingToMin / 4, 0, 1) +
      0.1 * clamp(missingToOptimum / 4, 0, 1) +
      0.04 * cashRunway01,
    0,
    1,
  );
  const caution01 = clamp(
    0.36 * ((finances - 1) / 9) +
      0.14 * ((harmony - 1) / 9) +
      0.14 * trendUp01 +
      0.1 * (missingToMin <= 0 ? 1 : 0) +
      0.26 * clamp(salaryBurdenRatio / 0.45, 0, 1) -
      0.14 * cashRunway01,
    0,
    1,
  );
  const spendPostureScore = clamp(aggression01 - caution01, -1, 1);
  const reservePolicy = spendPostureScore >= 0.22 ? "aggressive" : spendPostureScore <= -0.18 ? "conservative" : "balanced";
  const reserveTarget = reservePolicy === "aggressive" ? reserveTargetMin : reservePolicy === "conservative" ? reserveTargetMax : reserveTargetBase;
  const rawBudgetMax = cash;
  const allowedBudgetForSearch = clamp(rawBudgetMax - reserveTarget, 0, cash);
  const spendWindowFloor = clamp(cash - reserveTargetMax, 0, cash);
  const spendWindowBase = clamp(cash - reserveTargetBase, 0, cash);
  const spendWindowCeiling = clamp(cash - reserveTargetMin, 0, cash);
  const plannedSlots = Math.max(1, missingToOptimum || missingToMin || 1);

  return {
    cash: round(cash, 2),
    rosterSize,
    playerMin,
    optimum,
    missingToMin,
    missingToOptimum,
    ambition: round(ambition, 3),
    finances: round(finances, 3),
    harmony: round(harmony, 3),
    currentRank: round(currentRank, 3),
    previousRank: round(previousRank, 3),
    rankTrendRecent: round(rankTrendRecent, 3),
    salaryFactors5,
    salaryFactorCurrent: round(salaryFactorCurrent, 4),
    sponsorSupport: round(sponsorSupport, 2),
    sponsorSupportForecast5,
    rosterSalaryKnown: round(rosterSalaryKnown, 2),
    rosterMarketValue: round(rosterMarketValue, 2),
    avgKnownSalaryPerPlayer: round(avgKnownSalaryPerPlayer, 2),
    estimatedMissingSalary: round(estimatedMissingSalary, 2),
    marketBasedSalaryEstimate: round(marketBasedSalaryEstimate, 2),
    fullRosterSalaryProjection: round(fullRosterSalaryProjection, 2),
    rosterSalaryFloor: round(rosterSalaryFloor, 2),
    expectedSalaryBase: round(expectedSalaryBase, 2),
    salarySavingsShare: round(salarySavingsShare, 3),
    protectedSalaryReserve: round(protectedSalaryReserve, 2),
    salaryBurdenRatio: round(salaryBurdenRatio, 3),
    cashRunwayRatio: round(cashRunwayRatio, 3),
    cashRunway01: round(cashRunway01, 3),
    financeSafetyReserve: round(financeSafetyReserve, 2),
    cashRelief: round(cashRelief, 2),
    salaryBurdenAdd: round(salaryBurdenAdd, 2),
    reserveTargetMin: round(reserveTargetMin, 2),
    reserveTargetBase: round(reserveTargetBase, 2),
    reserveTargetMax: round(reserveTargetMax, 2),
    reserveTarget: round(reserveTarget, 2),
    reservePolicy,
    aggression01: round(aggression01, 3),
    caution01: round(caution01, 3),
    spendPostureScore: round(spendPostureScore, 3),
    rawBudgetMax: round(rawBudgetMax, 2),
    allowedBudgetForSearch: round(allowedBudgetForSearch, 2),
    spendWindowFloor: round(spendWindowFloor, 2),
    spendWindowBase: round(spendWindowBase, 2),
    spendWindowCeiling: round(spendWindowCeiling, 2),
    softSlotBudget: round(allowedBudgetForSearch / plannedSlots, 2),
  } satisfies RetoolAi2BudgetPlan;
}

function getAxisRanks(axisPriorityAbs: Record<DraftAxis, number>) {
  return [...AXES].sort((left, right) => axisPriorityAbs[right] - axisPriorityAbs[left]);
}

function buildFormColorNeeds(input: {
  rosterPlayers: Player[];
  targetRosterSize: number;
  axisPriorityAbs: Record<DraftAxis, number>;
  axisShares01: Record<DraftAxis, number>;
}) {
  const formColorCounts = {
    red: 0,
    green: 0,
    blue: 0,
    yellow: 0,
  } satisfies Record<FormCardColor, number>;
  for (const player of input.rosterPlayers) {
    const color = getPlayerFormColor(player);
    if (color) formColorCounts[color] += 1;
  }
  const rosterSizeSafe = Math.max(1, input.rosterPlayers.length || 1);
  const formColorShares01 = {
    red: round(formColorCounts.red / rosterSizeSafe, 6),
    green: round(formColorCounts.green / rosterSizeSafe, 6),
    blue: round(formColorCounts.blue / rosterSizeSafe, 6),
    yellow: round(formColorCounts.yellow / rosterSizeSafe, 6),
  } satisfies Record<FormCardColor, number>;
  const axisRanks = getAxisRanks(input.axisPriorityAbs);
  const targetRosterSize = Math.max(1, Math.round(input.targetRosterSize || 10));
  const baseMinColorCount = targetRosterSize >= 9 ? 1 : 0;
  const formColorTargetCounts = Object.fromEntries(
    FORM_COLORS.map((color) => {
      const axis = COLOR_TO_AXIS[color];
      const axisRank = axisRanks.indexOf(axis);
      const identityShare = input.axisShares01[axis] ?? 0.25;
      const identityTarget =
        axisRank === 0
          ? Math.max(2, Math.round(targetRosterSize * 0.34))
          : axisRank === 1
            ? Math.max(2, Math.round(targetRosterSize * 0.2))
            : baseMinColorCount;
      const target = Math.max(baseMinColorCount, Math.min(targetRosterSize, Math.round(identityTarget * (0.72 + identityShare))));
      return [color, target] as const;
    }),
  ) as Record<FormCardColor, number>;
  const formColorNeed01 = Object.fromEntries(
    FORM_COLORS.map((color) => {
      const axis = COLOR_TO_AXIS[color];
      const priority01 = clamp((input.axisPriorityAbs[axis] ?? 0) / 20, 0, 1);
      const share = formColorShares01[color] ?? 0;
      const targetCount = formColorTargetCounts[color] ?? baseMinColorCount;
      const countGap01 = targetCount > 0 ? clamp((targetCount - formColorCounts[color]) / targetCount, 0, 1) : 0;
      const missingBonus = formColorCounts[color] === 0 ? 0.42 : formColorCounts[color] === 1 ? 0.18 : 0;
      const scarcity = share <= 0.18 ? clamp((0.18 - share) / 0.18, 0, 1) : 0;
      const stackPenalty = share >= 0.58 ? clamp((share - 0.58) / 0.42, 0, 1) : 0;
      const coverageFloor = targetCount > 0 && formColorCounts[color] < targetCount ? 0.18 : 0;
      const identityPriority = input.axisShares01[axis] ?? 0.25;
      const need = clamp(
        coverageFloor +
          0.34 * priority01 +
          0.16 * identityPriority +
          0.34 * scarcity +
          0.48 * countGap01 +
          missingBonus -
          0.68 * stackPenalty * (1 - countGap01),
        0,
        1,
      );
      return [color, round(need, 6)] as const;
    }),
  ) as Record<FormCardColor, number>;
  const primaryFormColorNeed = FORM_COLORS.sort((left, right) => formColorNeed01[right] - formColorNeed01[left])[0] ?? "red";
  const formColorDiversityNeed01 = clamp(
    FORM_COLORS.filter((color) => formColorCounts[color] === 0).length * 0.22 +
      FORM_COLORS.filter((color) => formColorCounts[color] <= 1).length * 0.08 +
      Math.max(0, Math.max(...FORM_COLORS.map((color) => formColorShares01[color])) - 0.55),
    0,
    1,
  );
  return {
    formColorCounts,
    formColorTargetCounts,
    formColorShares01,
    formColorNeed01,
    primaryFormColorNeed,
    primaryFormColorAxis: COLOR_TO_AXIS[primaryFormColorNeed],
    formColorDiversityNeed01: round(formColorDiversityNeed01, 6),
  };
}

function getUsefulFloor(axis: DraftAxis, needState: Pick<TeamNeedState, "topAxis" | "secondAxis">) {
  if (axis === needState.topAxis) return 60;
  if (axis === needState.secondAxis) return 62;
  return 65;
}

export function buildOpenDisciplineHoles(input: {
  disciplines: Discipline[];
  rosterPlayers: Player[];
  axisShares01: Record<DraftAxis, number>;
  topAxis: DraftAxis;
}) {
  return input.disciplines
    .map((discipline): OpenDisciplineHole => {
      const axis = categoryToAxis(discipline.category);
      const playerCount = Math.max(1, Math.round(discipline.playerCount ?? 6));
      const scores = input.rosterPlayers.map((player) => getDisciplineValue(player, discipline));
      const top3 = topValues(scores, Math.min(3, playerCount));
      const top6 = topValues(scores, playerCount);
      const top3avg = average(top3);
      const top6avg = average(top6);
      const coverageCount60 = scores.filter((score) => score >= 60).length;
      const coverageCount70 = scores.filter((score) => score >= 70).length;
      const coverageCount90 = scores.filter((score) => score >= 90).length;
      const axisShare = input.axisShares01[axis] ?? 0.25;
      const qualityDeficit01 = clamp((62 - top3avg) / 42, 0, 1);
      const coverageDeficit01 = clamp((playerCount - coverageCount60) / playerCount, 0, 1);
      const topAxisBoost01 = axis === input.topAxis ? 0.08 : 0;
      const need01 = clamp(0.42 * qualityDeficit01 + 0.32 * coverageDeficit01 + 0.26 * axisShare + topAxisBoost01, 0, 1);
      const importance = 18 + 58 * need01 + 18 * axisShare;
      return {
        disciplineId: discipline.id,
        disciplineName: discipline.name,
        axis,
        playerCount,
        importance: round(importance, 3),
        need01: round(need01, 6),
        holeSeverity: round(Math.max(qualityDeficit01, coverageDeficit01), 6),
        coverageCount60,
        coverageCount70,
        coverageCount90,
        top3avg: round(top3avg, 2),
        top6avg: round(top6avg, 2),
      };
    })
    .sort((left, right) => right.importance * right.need01 - left.importance * left.need01);
}

export function buildTeamNeedState(input: {
  gameState: Pick<GameState, "disciplines">;
  team: Pick<Team, "teamId" | "cash" | "rosterOptTarget" | "rosterMinTarget">;
  teamIdentity?: TeamIdentity | null;
  rosterPlayers: Player[];
  targetRosterSize?: number;
  plannedPicksRemaining?: number;
}): TeamNeedState {
  const axisPriorityAbs = getAxisPriority(input.teamIdentity);
  const prioritySum = Math.max(1, AXES.reduce((total, axis) => total + axisPriorityAbs[axis], 0));
  const axisShares01 = {
    pow: axisPriorityAbs.pow / prioritySum,
    spe: axisPriorityAbs.spe / prioritySum,
    men: axisPriorityAbs.men / prioritySum,
    soc: axisPriorityAbs.soc / prioritySum,
  };
  const [topAxis, secondAxis, thirdAxis] = getAxisRanks(axisPriorityAbs);
  const topLead01 = clamp((axisPriorityAbs[topAxis] - axisPriorityAbs[secondAxis]) / 10, 0, 1);
  const topShare = axisShares01[topAxis];
  const focusRigidity01 = clamp(0.65 * clamp((topLead01 - 0.25) / 0.75, 0, 1) + 0.35 * clamp((topShare - 0.45) / 0.45, 0, 1), 0, 1);
  const extremeFocus01 = clamp(0.55 * clamp((topLead01 - 0.7) / 0.3, 0, 1) + 0.45 * clamp((topShare - 0.75) / 0.2, 0, 1), 0, 1);
  const targetRosterSize = input.targetRosterSize ?? input.teamIdentity?.playerOpt ?? input.team.rosterOptTarget ?? 10;
  const openDisciplineHoles = buildOpenDisciplineHoles({
    disciplines: input.gameState.disciplines,
    rosterPlayers: input.rosterPlayers,
    axisShares01,
    topAxis,
  });
  const formColorNeeds = buildFormColorNeeds({
    rosterPlayers: input.rosterPlayers,
    targetRosterSize,
    axisPriorityAbs,
    axisShares01,
  });
  const primary = openDisciplineHoles.filter((hole) => hole.axis === topAxis && hole.need01 >= 0.35);
  const secondary = openDisciplineHoles.filter((hole) => hole.axis !== topAxis && hole.need01 >= 0.24);
  const side = openDisciplineHoles.filter((hole) => hole.need01 >= 0.1 && !primary.includes(hole) && !secondary.includes(hole));
  const weighted = (holes: OpenDisciplineHole[]) => round(holes.reduce((total, hole) => total + hole.importance * hole.need01, 0), 3);
  const topAxisOpenHolePressure01 = clamp(
    openDisciplineHoles.filter((hole) => hole.axis === topAxis && hole.need01 >= 0.35).reduce((total, hole) => total + hole.need01, 0) / 2.4,
    0,
    1,
  );

  return {
    teamId: input.team.teamId,
    rosterCount: input.rosterPlayers.length,
    targetRosterSize,
    plannedSteps: Math.max(0, input.plannedPicksRemaining ?? 0),
    axisPriorityAbs,
    axisShares01: {
      pow: round(axisShares01.pow, 6),
      spe: round(axisShares01.spe, 6),
      men: round(axisShares01.men, 6),
      soc: round(axisShares01.soc, 6),
    },
    topAxis,
    secondAxis,
    thirdAxis,
    focusRigidity01: round(focusRigidity01, 6),
    extremeFocus01: round(extremeFocus01, 6),
    openDisciplineHoles,
    weightedNeedPrimary: weighted(primary),
    weightedNeedSecondary: weighted(secondary),
    weightedNeedSide: weighted(side),
    weightedNeedTotal: round(weighted(primary) + weighted(secondary) + weighted(side), 3),
    topAxisOpenHolePressure01: round(topAxisOpenHolePressure01, 6),
    formColorCounts: formColorNeeds.formColorCounts,
    formColorTargetCounts: formColorNeeds.formColorTargetCounts,
    formColorShares01: formColorNeeds.formColorShares01,
    formColorNeed01: formColorNeeds.formColorNeed01,
    primaryFormColorNeed: formColorNeeds.primaryFormColorNeed,
    primaryFormColorAxis: formColorNeeds.primaryFormColorAxis,
    formColorDiversityNeed01: formColorNeeds.formColorDiversityNeed01,
  };
}

export function scoreMarginalNeedGain(input: { needState: TeamNeedState; candidate: Player }): MarginalNeedGain {
  let total = 0;
  let matchedNeedCount = 0;
  const matchedNeedLabels: string[] = [];
  let best = {
    disciplineId: "",
    disciplineName: "",
    axis: input.needState.topAxis,
    score: 0,
    gain: 0,
    gain01: 0,
    overCut01: 0,
  };
  const formColor = getPlayerFormColor(input.candidate);
  const formColorAxis = formColor ? COLOR_TO_AXIS[formColor] : null;
  const formColorNeed01 = formColor ? input.needState.formColorNeed01[formColor] ?? 0 : 0;
  const formColorAxisFit01 = formColorAxis
    ? clamp((input.needState.axisShares01[formColorAxis] ?? 0.25) * 1.2 + (formColorAxis === input.needState.topAxis ? 0.16 : 0), 0, 1)
    : 0;
  const candidateColorScore = formColorAxis ? clamp((getAxisValue(input.candidate, formColorAxis) - 46) / 28, 0, 1) : 0;
  const formColorNeedScore = formColor
    ? clamp(formColorNeed01 * (18 + input.needState.formColorDiversityNeed01 * 8) * (0.58 + formColorAxisFit01 * 0.42) * (0.45 + candidateColorScore * 0.55), 0, 28)
    : 0;

  for (const hole of input.needState.openDisciplineHoles) {
    const discipline = {
      id: hole.disciplineId,
      name: hole.disciplineName,
      category: hole.axis,
      weight: 1,
    };
    const candidateScore = getDisciplineValue(input.candidate, discipline);
    const usefulFloor = getUsefulFloor(hole.axis, input.needState);
    const beforeCut = hole.top6avg > 0 && hole.coverageCount60 >= hole.playerCount ? hole.top6avg : usefulFloor;
    const overCut = Math.max(0, candidateScore - beforeCut);
    const fillStrength01 = clamp((candidateScore - usefulFloor) / 16, 0, 1);
    const earlyFillMode = hole.coverageCount60 < hole.playerCount;
    const gain = earlyFillMode ? Math.max(0, candidateScore - usefulFloor) : overCut;
    const gain01 = earlyFillMode ? fillStrength01 : clamp(gain / 10, 0, 1);
    const overCut01 = earlyFillMode ? fillStrength01 : clamp(overCut / 12, 0, 1);
    const axisShare = input.needState.axisShares01[hole.axis] ?? 0.25;
    const compatibility =
      hole.axis === input.needState.topAxis
        ? 1
        : hole.axis === input.needState.secondAxis
          ? 0.9
          : clamp(0.46 + axisShare, 0.35, 0.78);
    const contribution = hole.importance * hole.need01 * compatibility * (0.56 * gain01 + 0.44 * overCut01);
    total += contribution;
    if (gain01 >= 0.18 || overCut01 >= 0.18) {
      matchedNeedCount += 1;
      matchedNeedLabels.push(`${hole.disciplineName}:${hole.axis}`);
    }
    if (contribution > best.gain) {
      best = {
        disciplineId: hole.disciplineId,
        disciplineName: hole.disciplineName,
        axis: hole.axis,
        score: candidateScore,
        gain: contribution,
        gain01,
        overCut01,
      };
    }
  }

  total += formColorNeedScore;
  if (formColorNeedScore >= 3 && formColor) {
    matchedNeedCount += 1;
    matchedNeedLabels.push(`Formfarbe:${formColor}:${formColorAxis}`);
  }

  const formColorCoverageScore =
    formColorNeedScore > 0 && formColorNeed01 >= 0.58
      ? formColorNeedScore * (0.22 + input.needState.formColorDiversityNeed01 * 0.12)
      : 0;
  const needScoreApplied = clamp(total / Math.max(1, input.needState.openDisciplineHoles.length) + formColorCoverageScore, 0, 100);
  return {
    needImpactScore: round(total, 4),
    needScoreApplied: round(needScoreApplied, 4),
    matchedNeedCount,
    matchedNeedLabels: matchedNeedLabels.slice(0, 6),
    bestDisciplineId: best.disciplineId,
    bestDisciplineName: best.disciplineName,
    bestAxis: best.axis,
    bestDisciplineScore: round(best.score, 2),
    bestDisciplineGain: round(best.gain, 4),
    bestDisciplineGain01: round(best.gain01, 6),
    bestDisciplineOverCut01: round(best.overCut01, 6),
    formColor,
    formColorAxis,
    formColorNeedScore: round(formColorNeedScore, 4),
    formColorNeed01: round(formColorNeed01, 6),
    axisTop6Delta: round(best.gain01 * 10, 4),
    disziTop6Delta: round(best.overCut01 * 10, 4),
  };
}

export function scoreFormColorStackPenalty(input: { needState: TeamNeedState; candidate: Player; marginalGain?: MarginalNeedGain | null }) {
  const formColor = getPlayerFormColor(input.candidate);
  if (!formColor) return 0;
  const targetCount = input.needState.formColorTargetCounts[formColor] ?? 0;
  const currentCount = input.needState.formColorCounts[formColor] ?? 0;
  const missingTargetColors = FORM_COLORS.filter((color) => (input.needState.formColorCounts[color] ?? 0) < (input.needState.formColorTargetCounts[color] ?? 0));
  if (currentCount < targetCount || missingTargetColors.length === 0) return 0;

  const afterShare = (currentCount + 1) / Math.max(1, input.needState.rosterCount + 1);
  const overTarget = currentCount - targetCount + 1;
  const formAxis = COLOR_TO_AXIS[formColor];
  const identityRelief = formAxis === input.needState.topAxis ? 0.78 : formAxis === input.needState.secondAxis ? 0.88 : 1;
  const realHoleRelief = clamp(Number(input.marginalGain?.bestDisciplineGain01 ?? 0) / 0.86, 0, 0.55);
  const diversityPressure = clamp(
    input.needState.formColorDiversityNeed01 + missingTargetColors.length * 0.23 + Math.max(0, afterShare - 0.42) * 1.82,
    0,
    1,
  );
  const overloadMultiplier = afterShare >= 0.65 ? 1.5 : 1.0;
  const penalty = (overTarget * 8.5 + afterShare * 24) * diversityPressure * identityRelief * (1 - realHoleRelief * 0.35) * overloadMultiplier;
  return round(clamp(penalty, 0, 72), 4);
}

export function scoreInAxisHoleCompletion(input: { needState: TeamNeedState; marginalGain: MarginalNeedGain }) {
  const axis = input.marginalGain.bestAxis;
  if (axis !== input.needState.topAxis && axis !== input.needState.secondAxis) return 0;
  const priority = axis === input.needState.topAxis ? 1 : 0.72;
  const pressure = axis === input.needState.topAxis ? input.needState.topAxisOpenHolePressure01 : 0.42;
  return round((input.marginalGain.bestDisciplineGain01 * 18 + input.marginalGain.bestDisciplineOverCut01 * 12) * priority * (0.75 + pressure), 4);
}

export function scoreOffAxisDetourPenalty(input: { needState: TeamNeedState; marginalGain: MarginalNeedGain }) {
  const axis = input.marginalGain.bestAxis;
  if (axis === input.needState.topAxis || axis === input.needState.secondAxis) return 0;
  const solvesRealHole = input.marginalGain.bestDisciplineGain01 >= 0.75 || input.marginalGain.needScoreApplied >= 12;
  const solvesFormColorHole =
    input.marginalGain.formColorNeedScore >= 6 &&
    input.marginalGain.formColorAxis === axis &&
    (input.needState.formColorDiversityNeed01 >= 0.35 || input.marginalGain.formColorNeed01 >= 0.55);
  const detourPressure = input.needState.focusRigidity01 * (0.65 + input.needState.topAxisOpenHolePressure01 * 0.55);
  const relief = solvesRealHole || solvesFormColorHole ? 0.45 : 1;
  return round(detourPressure * relief * 34, 4);
}

export function scoreOverpayPenalty(input: {
  candidateMarketValue: number;
  candidateSalary?: number | null;
  remainingBudget: number;
  plannedPicksRemaining: number;
  needScoreApplied: number;
  financePressure01?: number;
}) {
  const plannedSlots = Math.max(1, Math.round(input.plannedPicksRemaining));
  const softSlotBudget = input.remainingBudget / plannedSlots;
  const impactRelief01 = clamp(input.needScoreApplied / 26, 0, 1);
  const priceOverSoft = Math.max(0, input.candidateMarketValue - softSlotBudget * (1.15 + impactRelief01 * 0.75));
  const salaryDrag = Math.max(0, Number(input.candidateSalary ?? 0) - softSlotBudget * 0.18);
  const financePressure = clamp(input.financePressure01 ?? 0.45, 0, 1);
  return round(clamp(priceOverSoft * (0.55 + financePressure * 0.9) * (1 - impactRelief01 * 0.78) + salaryDrag * 0.65, 0, 64), 4);
}

export function scoreRoleMismatchPenalty(input: {
  plannedRole: DraftRole | string;
  candidateQuality?: number;
  needScoreApplied?: number;
  themeTier?: string;
  classFit?: number;
}) {
  const role = String(input.plannedRole || "depth").toLowerCase();
  const premiumRole = role === "star" || role === "superstar" || role === "core";
  const quality = Number(input.candidateQuality ?? 0);
  const need = Number(input.needScoreApplied ?? 0);
  const classFit = Number(input.classFit ?? 50);
  const avoidTheme = input.themeTier === "avoid" || input.themeTier === "outsider";
  if (premiumRole && avoidTheme) return 240;
  if (premiumRole && need < 5 && quality < 70) return 34;
  if ((role === "starter" || role === "core") && classFit < 28) return 18;
  if ((role === "depth" || role === "backup" || role === "reserve") && quality > 88 && need < 8) return 10;
  return 0;
}

export function scoreFitPenalty(input: { teamFit?: number | null; mercenary?: boolean }) {
  const teamFit = Number(input.teamFit ?? 0);
  if (teamFit >= 0) return 0;
  return input.mercenary ? round(Math.abs(teamFit) * 2.4, 4) : 1_000;
}

export function buildSequentialPickPlan(input: {
  needState: TeamNeedState;
  rosterCount: number;
  targetRosterSize: number;
  prefersStars?: boolean;
}) {
  const remaining = Math.max(0, input.targetRosterSize - input.rosterCount);
  return Array.from({ length: remaining }, (_, index) => {
    if (index === 0 && input.prefersStars) return "star";
    if (index <= 1) return "core";
    if (index <= 4) return "starter";
    return "depth";
  }) as DraftRole[];
}

export function updateNeedsAfterPick(input: {
  previousNeedState: TeamNeedState;
  gameState: Pick<GameState, "disciplines">;
  team: Pick<Team, "teamId" | "cash" | "rosterOptTarget" | "rosterMinTarget">;
  teamIdentity?: TeamIdentity | null;
  rosterPlayers: Player[];
  pickedPlayer: Player;
}) {
  return buildTeamNeedState({
    gameState: input.gameState,
    team: input.team,
    teamIdentity: input.teamIdentity,
    rosterPlayers: [...input.rosterPlayers, input.pickedPlayer],
    targetRosterSize: input.previousNeedState.targetRosterSize,
    plannedPicksRemaining: Math.max(0, input.previousNeedState.plannedSteps - 1),
  });
}
