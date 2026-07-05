import type {
  GameState,
  Player,
  PlayerGeneratorAttributes,
  RosterEntry,
  Team,
} from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import {
  calculateAllrounderBonus,
  calculateMarketValueBonuses,
  calculateMarketValueFromRankTable,
  deriveBaseMarketValueFromFinal,
} from "@/lib/player-formulas/market-value-engine";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { buildMarketValueDisciplineInputsFromPlayers } from "@/lib/player-formulas/market-value-apply";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";

export type PlayerEconomyMode = "legacy" | "compare" | "calculated";

export type PlayerEconomyComparisonStatus =
  | "ready"
  | "market_value_missing_source"
  | "salary_missing_source"
  | "partial_compare";

export type PlayerEconomyCompareBreakdown = {
  baseQualityScore: number | null;
  topDisciplineScore: number | null;
  versatilityScore: number | null;
  peakScore: number | null;
  weaknessScore: number | null;
  rawDisciplineMarketValueSum: number | null;
  mwChangeFix: number | null;
  adjustedRaw: number | null;
  protectedRaw: number | null;
  marketValueBaseOffset: number | null;
  calcWithoutBaseOffset: number | null;
  attributeModifier: number | null;
  traitModifier: number | null;
  classModifier: number | null;
  baseMarketValue: number | null;
  salaryMarketValue: number | null;
  allrounderBonus: number | null;
  specialistBonus: number | null;
  finalMarketValue: number | null;
  finalMarketValueDifferenceToBenchmark: number | null;
  totalAttributes: number | null;
  attributeWeightedTerm: number | null;
  salaryMarketValueTerm: number | null;
  traitPercentSum: number | null;
  salaryBase: number | null;
  salaryModifier: number | null;
  finalSalary: number | null;
};

export type PlayerEconomyCompareRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  className: string | null;
  race: string | null;
  ovr: number | null;
  topDisciplines: string[];
  comparisonStatus: PlayerEconomyComparisonStatus;
  legacyMarketValue: number | null;
  calculatedMarketValue: number | null;
  marketValueDelta: number | null;
  marketValueDeltaPct: number | null;
  legacySalary: number | null;
  calculatedSalary: number | null;
  salaryDelta: number | null;
  salaryDeltaPct: number | null;
  salaryFloorApplied: boolean;
  outlierFlags: string[];
  economyWarnings: string[];
  missingSources: string[];
  calculationBreakdown: PlayerEconomyCompareBreakdown;
};

export type PlayerEconomyCompareLeaderboardEntry = {
  playerId: string;
  name: string;
  teamCode: string | null;
  teamName: string | null;
  className: string | null;
  race: string | null;
  ovr: number | null;
  legacyValue: number | null;
  calculatedValue: number | null;
  delta: number;
  deltaPct: number | null;
  legacyMarketValue: number | null;
  calculatedMarketValue: number | null;
  legacySalary: number | null;
  calculatedSalary: number | null;
  salaryDelta: number | null;
  salaryDeltaPct: number | null;
  topDisciplines: string[];
  salaryFloorApplied: boolean;
  outlierFlags: string[];
  missingSources: string[];
  economyWarnings: string[];
  calculationBreakdown: PlayerEconomyCompareBreakdown;
};

export type PlayerEconomyCompareDistributionEntry = {
  key: string;
  count: number;
  averageMarketValueDelta: number | null;
  averageSalaryDelta: number | null;
};

export type PlayerEconomyCompareSummary = {
  comparedPlayers: number;
  missingMarketValueSources: number;
  missingSalarySources: number;
  missingSourceCount: number;
  salaryFloorAppliedCount: number;
  averageMarketValueDelta: number | null;
  medianMarketValueDelta: number | null;
  averageSalaryDelta: number | null;
  medianSalaryDelta: number | null;
  topLegacyOvervaluedPlayers: PlayerEconomyCompareLeaderboardEntry[];
  topLegacyUndervaluedPlayers: PlayerEconomyCompareLeaderboardEntry[];
  topSalaryOutliers: PlayerEconomyCompareLeaderboardEntry[];
  salaryFloorAppliedPlayers: PlayerEconomyCompareLeaderboardEntry[];
  playersWithMissingSources: PlayerEconomyCompareLeaderboardEntry[];
  byTeam: PlayerEconomyCompareDistributionEntry[];
  byClass: PlayerEconomyCompareDistributionEntry[];
  byRace: PlayerEconomyCompareDistributionEntry[];
  marketValueOutliersByTeam: PlayerEconomyCompareDistributionEntry[];
  marketValueOutliersByClass: PlayerEconomyCompareDistributionEntry[];
  salaryOutliersByTeam: PlayerEconomyCompareDistributionEntry[];
  salaryOutliersByClass: PlayerEconomyCompareDistributionEntry[];
};

export type PlayerEconomyCompareReport = {
  economyMode: PlayerEconomyMode;
  activeTransferEconomyMode: "legacy";
  benchmarkSource: "legacy_imported_display";
  players: PlayerEconomyCompareRow[];
  summary: PlayerEconomyCompareSummary;
  warnings: string[];
  formulaStatus: {
    marketValueEngine: string;
    salaryEngine: string;
    rankToDisciplineMarketValue: string;
    attributeSalaryModifiers: string;
    traitSalaryFactors: string;
  };
};

const playerFormulaSources = loadPlayerFormulaSources();

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function resolveRankTableMarketValueFromCompareRow(
  row: Pick<PlayerEconomyCompareRow, "calculatedMarketValue" | "calculationBreakdown"> | null | undefined,
): number | null {
  if (!row) {
    return null;
  }
  const protectedRaw = row.calculationBreakdown?.protectedRaw;
  const offset = row.calculationBreakdown?.marketValueBaseOffset;
  if (typeof protectedRaw === "number" && Number.isFinite(protectedRaw) && typeof offset === "number" && Number.isFinite(offset)) {
    return roundValue(protectedRaw + offset, 2);
  }
  return row.calculatedMarketValue ?? null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundValue(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return roundValue(sorted[midpoint] ?? 0, 2);
  }

  return roundValue(((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2, 2);
}

function calculateDelta(current: number | null, legacy: number | null) {
  if (!isFiniteNumber(current) || !isFiniteNumber(legacy)) {
    return null;
  }

  return roundValue(current - legacy, 2);
}

function calculateDeltaPct(delta: number | null, legacy: number | null) {
  if (!isFiniteNumber(delta) || !isFiniteNumber(legacy) || legacy === 0) {
    return null;
  }

  return roundValue((delta / legacy) * 100, 2);
}

function getRosterEntry(rosters: RosterEntry[], playerId: string) {
  return rosters.find((entry) => entry.playerId === playerId) ?? null;
}

function getTeam(teams: Team[], rosterEntry: RosterEntry | null) {
  if (!rosterEntry) {
    return null;
  }

  return teams.find((team) => team.teamId === rosterEntry.teamId) ?? null;
}

function toGeneratorAttributes(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) {
    return null;
  }

  const values = {
    power: stats.power,
    health: stats.health,
    stamina: stats.stamina,
    intelligence: stats.intelligence,
    awareness: stats.awareness,
    determination: stats.determination,
    speed: stats.speed,
    dexterity: stats.dexterity,
    charisma: stats.charisma,
    will: stats.will,
    spirit: stats.spirit,
    torment: stats.torment,
  };

  if (!Object.values(values).every((value) => isFiniteNumber(value))) {
    return null;
  }

  return values as PlayerGeneratorAttributes;
}

function buildDistribution(
  rows: PlayerEconomyCompareRow[],
  getKey: (row: PlayerEconomyCompareRow) => string | null,
) {
  const bucketMap = new Map<string, PlayerEconomyCompareRow[]>();

  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) {
      return;
    }
    const existing = bucketMap.get(key) ?? [];
    existing.push(row);
    bucketMap.set(key, existing);
  });

  return [...bucketMap.entries()]
    .map(([key, bucket]) => ({
      key,
      count: bucket.length,
      averageMarketValueDelta: average(
        bucket
          .map((row) => row.marketValueDelta)
          .filter((value): value is number => isFiniteNumber(value)),
      ),
      averageSalaryDelta: average(
        bucket
          .map((row) => row.salaryDelta)
          .filter((value): value is number => isFiniteNumber(value)),
      ),
    }))
    .sort((left, right) => left.key.localeCompare(right.key, "de"));
}

function getTopDisciplines(player: Player) {
  return Object.entries(player.disciplineRatings ?? {})
    .filter(([, value]) => isFiniteNumber(value))
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .slice(0, 3)
    .map(([disciplineId, value]) => `${disciplineId.toUpperCase()}: ${roundValue(value, 1)}`);
}

function getPlayerMwChangeFix(player: Player) {
  const value = (player as Player & { mwChangeFix?: number | null }).mwChangeFix;
  return isFiniteNumber(value) ? value : null;
}

function toLeaderboardEntry(row: PlayerEconomyCompareRow, kind: "market" | "salary"): PlayerEconomyCompareLeaderboardEntry {
  if (kind === "salary") {
    return {
      playerId: row.playerId,
      name: row.name,
      teamCode: row.teamCode,
      teamName: row.teamName,
      className: row.className,
      race: row.race,
      ovr: row.ovr,
      legacyValue: row.legacySalary,
      calculatedValue: row.calculatedSalary,
      delta: row.salaryDelta ?? 0,
      deltaPct: row.salaryDeltaPct,
      legacyMarketValue: row.legacyMarketValue,
      calculatedMarketValue: row.calculatedMarketValue,
      legacySalary: row.legacySalary,
      calculatedSalary: row.calculatedSalary,
      salaryDelta: row.salaryDelta,
      salaryDeltaPct: row.salaryDeltaPct,
      topDisciplines: row.topDisciplines,
      salaryFloorApplied: row.salaryFloorApplied,
      outlierFlags: row.outlierFlags,
      missingSources: row.missingSources,
      economyWarnings: row.economyWarnings,
      calculationBreakdown: row.calculationBreakdown,
    };
  }

  return {
    playerId: row.playerId,
    name: row.name,
    teamCode: row.teamCode,
    teamName: row.teamName,
    className: row.className,
    race: row.race,
    ovr: row.ovr,
    legacyValue: row.legacyMarketValue,
    calculatedValue: row.calculatedMarketValue,
    delta: row.marketValueDelta ?? 0,
    deltaPct: row.marketValueDeltaPct,
    legacyMarketValue: row.legacyMarketValue,
    calculatedMarketValue: row.calculatedMarketValue,
    legacySalary: row.legacySalary,
    calculatedSalary: row.calculatedSalary,
    salaryDelta: row.salaryDelta,
    salaryDeltaPct: row.salaryDeltaPct,
    topDisciplines: row.topDisciplines,
    salaryFloorApplied: row.salaryFloorApplied,
    outlierFlags: row.outlierFlags,
    missingSources: row.missingSources,
    economyWarnings: row.economyWarnings,
    calculationBreakdown: row.calculationBreakdown,
  };
}

function buildSummary(rows: PlayerEconomyCompareRow[]): PlayerEconomyCompareSummary {
  const marketValueDeltas = rows
    .map((row) => row.marketValueDelta)
    .filter((value): value is number => isFiniteNumber(value));
  const salaryDeltas = rows
    .map((row) => row.salaryDelta)
    .filter((value): value is number => isFiniteNumber(value));

  const topLegacyOvervaluedPlayers = rows
    .filter((row) => isFiniteNumber(row.marketValueDelta) && row.marketValueDelta < 0)
    .sort((left, right) => (left.marketValueDelta ?? 0) - (right.marketValueDelta ?? 0))
    .slice(0, 20)
    .map((row) => toLeaderboardEntry(row, "market"));

  const topLegacyUndervaluedPlayers = rows
    .filter((row) => isFiniteNumber(row.marketValueDelta) && row.marketValueDelta > 0)
    .sort((left, right) => (right.marketValueDelta ?? 0) - (left.marketValueDelta ?? 0))
    .slice(0, 20)
    .map((row) => toLeaderboardEntry(row, "market"));

  const topSalaryOutliers = rows
    .filter((row) => isFiniteNumber(row.salaryDelta))
    .sort((left, right) => Math.abs(right.salaryDelta ?? 0) - Math.abs(left.salaryDelta ?? 0))
    .slice(0, 20)
    .map((row) => toLeaderboardEntry(row, "salary"));

  const marketValueOutlierRows = rows
    .filter((row) => isFiniteNumber(row.marketValueDelta))
    .sort((left, right) => Math.abs(right.marketValueDelta ?? 0) - Math.abs(left.marketValueDelta ?? 0))
    .slice(0, 20);

  const salaryOutlierRows = rows
    .filter((row) => isFiniteNumber(row.salaryDelta))
    .sort((left, right) => Math.abs(right.salaryDelta ?? 0) - Math.abs(left.salaryDelta ?? 0))
    .slice(0, 20);

  const salaryFloorAppliedPlayers = rows
    .filter((row) => row.salaryFloorApplied)
    .slice(0, 20)
    .map((row) => toLeaderboardEntry(row, "salary"));

  const playersWithMissingSources = rows
    .filter((row) => row.missingSources.length > 0)
    .slice(0, 20)
    .map((row) => toLeaderboardEntry(row, "market"));

  return {
    comparedPlayers: rows.length,
    missingMarketValueSources: rows.filter((row) => row.calculatedMarketValue == null).length,
    missingSalarySources: rows.filter((row) => row.calculatedSalary == null).length,
    missingSourceCount: rows.filter((row) => row.missingSources.length > 0).length,
    salaryFloorAppliedCount: rows.filter((row) => row.salaryFloorApplied).length,
    averageMarketValueDelta: average(marketValueDeltas),
    medianMarketValueDelta: median(marketValueDeltas),
    averageSalaryDelta: average(salaryDeltas),
    medianSalaryDelta: median(salaryDeltas),
    topLegacyOvervaluedPlayers,
    topLegacyUndervaluedPlayers,
    topSalaryOutliers,
    salaryFloorAppliedPlayers,
    playersWithMissingSources,
    byTeam: buildDistribution(rows, (row) => row.teamName),
    byClass: buildDistribution(rows, (row) => row.className),
    byRace: buildDistribution(rows, (row) => row.race),
    marketValueOutliersByTeam: buildDistribution(marketValueOutlierRows, (row) => row.teamName),
    marketValueOutliersByClass: buildDistribution(marketValueOutlierRows, (row) => row.className),
    salaryOutliersByTeam: buildDistribution(salaryOutlierRows, (row) => row.teamName),
    salaryOutliersByClass: buildDistribution(salaryOutlierRows, (row) => row.className),
  };
}

export function buildPlayerEconomyCompareReport(input: {
  gameState: GameState;
  saveId?: string | null;
  economyMode?: PlayerEconomyMode;
  salaryMarketValueOverridesByPlayerId?: Map<string, number>;
  baseMarketValueOverridesByPlayerId?: Map<string, number>;
  playerIds?: Iterable<string>;
  playerOverridesById?: Map<string, Player>;
  includeSummary?: boolean;
}): PlayerEconomyCompareReport {
  const economyMode = input.economyMode ?? "compare";
  const gameState = input.gameState;
  const effectivePlayers =
    input.playerOverridesById && input.playerOverridesById.size > 0
      ? gameState.players.map((player) => input.playerOverridesById?.get(player.id) ?? player)
      : gameState.players;
  const effectiveGameState =
    effectivePlayers === gameState.players
      ? gameState
      : ({
          ...gameState,
          players: effectivePlayers,
        } satisfies GameState);
  const ratingByPlayerId = getSeasonDerivations({
    gameState: effectiveGameState,
    saveId: input.saveId ?? `economy-compare:${effectiveGameState.season.id}`,
  }).ratingsById;
  const marketValueInputs = buildMarketValueDisciplineInputsFromPlayers(
    gameState.players.map((player) => input.playerOverridesById?.get(player.id) ?? player),
  );

  const marketValueResult = calculateMarketValueFromRankTable({
    players: marketValueInputs,
    rankToDisciplineMarketValue: playerFormulaSources.rankToDisciplineMarketValue,
  });
  const marketValueByPlayerId =
    marketValueResult.status === "ready"
      ? new Map(marketValueResult.players.map((entry) => [entry.playerId, entry] as const))
      : new Map<string, (typeof marketValueResult.players)[number]>();

  const selectedPlayerIds = input.playerIds ? new Set(input.playerIds) : null;
  const rowPlayers = selectedPlayerIds
    ? effectivePlayers.filter((player) => selectedPlayerIds.has(player.id))
    : effectivePlayers;

  const rows = rowPlayers.map((player) => {
    const rosterEntry = getRosterEntry(gameState.rosters, player.id);
    const team = getTeam(gameState.teams, rosterEntry);
    const legacyEconomy = resolvePlayerEconomyContract({
      playerId: player.id,
      player,
      rosterEntry,
      salaryMarketValueOverride: input.salaryMarketValueOverridesByPlayerId?.get(player.id) ?? null,
      baseMarketValueOverride: input.baseMarketValueOverridesByPlayerId?.get(player.id) ?? null,
    });
    const playerRating = ratingByPlayerId.get(player.id) ?? null;
    const topDisciplineScores = Object.values(player.disciplineRatings ?? {})
      .filter((value): value is number => isFiniteNumber(value))
      .sort((left, right) => right - left);
    const generatorAttributes = toGeneratorAttributes(player);
    const missingSources: string[] = [];
    const economyWarnings: string[] = [];

    const marketValueBreakdown = marketValueByPlayerId.get(player.id) ?? null;
    if (!marketValueBreakdown) {
      missingSources.push("market_value_compare_missing_discipline_pool");
    }

    let salaryBreakdown: ReturnType<typeof calculateSalaryFromMarketValue> | null = null;
    if (!generatorAttributes) {
      missingSources.push("attribute_sheet_stats_missing");
    }
    if (!playerFormulaSources.attributeSalaryModifiers || !playerFormulaSources.traitSalaryFactors) {
      missingSources.push("salary_formula_sources_missing");
    }

    if (
      generatorAttributes &&
      playerFormulaSources.attributeSalaryModifiers &&
      playerFormulaSources.traitSalaryFactors &&
      marketValueBreakdown
    ) {
      const baseMarketValue = legacyEconomy.baseMarketValue ?? deriveBaseMarketValueFromFinal({
        finalMarketValue: legacyEconomy.marketValue ?? 0,
        coreStats: player.coreStats,
        disciplineRatings: player.disciplineRatings,
      });
      const salaryMarketValue = legacyEconomy.salaryMarketValue ?? baseMarketValue;
      salaryBreakdown = calculateSalaryFromMarketValue({
        salaryMarketValue,
        attributes: generatorAttributes,
        traitsPositive: player.traitsPositive,
        traitsNegative: player.traitsNegative,
        attributeSalaryModifiers: playerFormulaSources.attributeSalaryModifiers,
        traitSalaryFactors: playerFormulaSources.traitSalaryFactors,
      });
      economyWarnings.push(...salaryBreakdown.warnings);
    }

    const calculatedMarketValue = legacyEconomy.marketValue ?? marketValueBreakdown?.marketValueNew ?? null;
    const calculatedSalary = legacyEconomy.expectedSalary ?? salaryBreakdown?.finalSalary ?? null;
    const salaryFloorApplied = salaryBreakdown?.warnings.includes("salary_floor_applied") ?? false;
    const marketValueDelta = calculateDelta(calculatedMarketValue, legacyEconomy.marketValue);
    const salaryDelta = calculateDelta(calculatedSalary, legacyEconomy.salary);
    const comparisonStatus: PlayerEconomyComparisonStatus =
      calculatedMarketValue != null && calculatedSalary != null
        ? "ready"
        : calculatedMarketValue != null
          ? "partial_compare"
          : calculatedSalary == null && calculatedMarketValue == null
            ? "market_value_missing_source"
            : "salary_missing_source";

    const averageAttributeValues = generatorAttributes
      ? Object.values(generatorAttributes).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [];
    const averageAttributes = averageAttributeValues.length > 0
      ? average(averageAttributeValues)
      : null;
    const salaryModifier =
      salaryBreakdown != null
        ? roundValue(salaryBreakdown.finalSalary - salaryBreakdown.basisSalary, 2)
        : null;
    const traitModifier =
      salaryBreakdown != null
        ? roundValue(
            salaryBreakdown.traitEffects.reduce((sum, effect) => sum + effect.effect, 0),
            2,
          )
        : null;
    const outlierFlags = [
      salaryFloorApplied ? "salary_floor_applied" : null,
      missingSources.includes("attribute_sheet_stats_missing") ? "attribute_sheet_stats_missing" : null,
      missingSources.length > 0 ? "missing_source" : null,
    ].filter((value): value is string => Boolean(value));

    const marketValueBonuses =
      legacyEconomy.baseMarketValue != null
        ? calculateMarketValueBonuses({
            baseMarketValue: legacyEconomy.baseMarketValue,
            coreStats: player.coreStats,
            disciplineRatings: player.disciplineRatings,
          })
        : null;

    return {
      playerId: player.id,
      name: player.name,
      teamId: team?.teamId ?? null,
      teamCode: team?.shortCode ?? null,
      teamName: team?.name ?? null,
      className: player.className ?? null,
      race: player.race ?? null,
      ovr: playerRating?.ovrNormalized ?? player.ovr ?? null,
      topDisciplines: getTopDisciplines(player),
      comparisonStatus,
      legacyMarketValue: legacyEconomy.marketValue,
      calculatedMarketValue,
      marketValueDelta,
      marketValueDeltaPct: calculateDeltaPct(marketValueDelta, legacyEconomy.marketValue),
      legacySalary: legacyEconomy.salary,
      calculatedSalary,
      salaryDelta,
      salaryDeltaPct: calculateDeltaPct(salaryDelta, legacyEconomy.salary),
      salaryFloorApplied,
      outlierFlags,
      economyWarnings: [...new Set(economyWarnings)],
      missingSources: [...new Set(missingSources)],
      calculationBreakdown: {
        baseQualityScore: playerRating?.ovrNormalized ?? null,
        topDisciplineScore: topDisciplineScores[0] ?? null,
        versatilityScore: topDisciplineScores.filter((value) => value >= 60).length,
        peakScore:
          topDisciplineScores.length > 0
            ? roundValue(
                topDisciplineScores.slice(0, 3).reduce((sum, value) => sum + value, 0) /
                  Math.min(topDisciplineScores.length, 3),
                2,
              )
            : null,
        weaknessScore:
          topDisciplineScores.length > 0
            ? roundValue(
                topDisciplineScores.slice(-3).reduce((sum, value) => sum + value, 0) /
                  Math.min(topDisciplineScores.length, 3),
                2,
              )
            : null,
        rawDisciplineMarketValueSum: marketValueBreakdown?.rawDisciplineMarketValueSum ?? null,
        mwChangeFix: getPlayerMwChangeFix(player),
        adjustedRaw: marketValueBreakdown?.adjustedRaw ?? null,
        protectedRaw: marketValueBreakdown?.protectedRaw ?? null,
        marketValueBaseOffset: marketValueBreakdown?.marketValueBaseOffset ?? null,
        calcWithoutBaseOffset: marketValueBreakdown?.calcWithoutBaseOffset ?? null,
        attributeModifier:
          averageAttributes != null ? roundValue((averageAttributes - 50) / 50, 3) : null,
        traitModifier,
        classModifier: null,
        baseMarketValue: legacyEconomy.baseMarketValue ?? null,
        salaryMarketValue: legacyEconomy.salaryMarketValue ?? null,
        allrounderBonus: marketValueBonuses?.allrounderBonus ?? calculateAllrounderBonus(player.coreStats),
        specialistBonus: marketValueBonuses?.specialistBonus ?? null,
        finalMarketValue: calculatedMarketValue,
        finalMarketValueDifferenceToBenchmark: calculateDelta(calculatedMarketValue, legacyEconomy.marketValue),
        totalAttributes: salaryBreakdown?.totalAttributes ?? null,
        attributeWeightedTerm: salaryBreakdown?.weightedAttributeTerm ?? null,
        salaryMarketValueTerm: salaryBreakdown?.salaryMarketValueTerm ?? null,
        traitPercentSum: salaryBreakdown?.traitPercentSum ?? null,
        salaryBase: salaryBreakdown?.basisSalary ?? null,
        salaryModifier,
        finalSalary: calculatedSalary,
      },
    } satisfies PlayerEconomyCompareRow;
  });

  const warnings = [...new Set([
    ...playerFormulaSources.warnings,
    ...(marketValueResult.status === "ready" ? marketValueResult.warnings : marketValueResult.warnings),
  ])];
  const summary = input.includeSummary === false
    ? {
        comparedPlayers: rows.length,
        missingMarketValueSources: rows.filter((row) => row.calculatedMarketValue == null).length,
        missingSalarySources: rows.filter((row) => row.calculatedSalary == null).length,
        missingSourceCount: rows.filter((row) => row.missingSources.length > 0).length,
        salaryFloorAppliedCount: rows.filter((row) => row.salaryFloorApplied).length,
        averageMarketValueDelta: average(rows.map((row) => row.marketValueDelta).filter((value): value is number => isFiniteNumber(value))),
        medianMarketValueDelta: median(rows.map((row) => row.marketValueDelta).filter((value): value is number => isFiniteNumber(value))),
        averageSalaryDelta: average(rows.map((row) => row.salaryDelta).filter((value): value is number => isFiniteNumber(value))),
        medianSalaryDelta: median(rows.map((row) => row.salaryDelta).filter((value): value is number => isFiniteNumber(value))),
        topLegacyOvervaluedPlayers: [],
        topLegacyUndervaluedPlayers: [],
        topSalaryOutliers: [],
        salaryFloorAppliedPlayers: [],
        playersWithMissingSources: [],
        byTeam: [],
        byClass: [],
        byRace: [],
        marketValueOutliersByTeam: [],
        marketValueOutliersByClass: [],
        salaryOutliersByTeam: [],
        salaryOutliersByClass: [],
      } satisfies PlayerEconomyCompareSummary
    : buildSummary(rows);

  return {
    economyMode,
    activeTransferEconomyMode: "legacy",
    benchmarkSource: "legacy_imported_display",
    players: rows,
    summary,
    warnings,
    formulaStatus: {
      marketValueEngine: playerFormulaSources.marketValueEngineStatus,
      salaryEngine: playerFormulaSources.salaryEngineStatus,
      rankToDisciplineMarketValue: playerFormulaSources.rankMarketValueStatus,
      attributeSalaryModifiers: playerFormulaSources.attributeSalaryModifiersStatus,
      traitSalaryFactors: playerFormulaSources.traitSalaryFactorsStatus,
    },
  };
}

export function buildPlayerEconomyCompareMap(input: {
  gameState: GameState;
  economyMode?: PlayerEconomyMode;
}) {
  return new Map(
    buildPlayerEconomyCompareReport(input).players.map((row) => [row.playerId, row] as const),
  );
}
