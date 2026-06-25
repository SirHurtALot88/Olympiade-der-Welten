import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import type { DisciplineCategory, GameState, Player, RosterEntry, Team, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import {
  assessPlayerBoardTrust,
  type PlayerBoardTrustMood,
  type PlayerBoardTrustRenewalPolicy,
} from "@/lib/ai/player-board-trust-service";
import type { PlayerEconomyCompareRow } from "@/lib/foundation/player-economy-compare-service";
import { buildPlayerEconomyCompareMap } from "@/lib/foundation/player-economy-compare-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { calculateTeamRecovery, getInjuryRiskBand, getInjuryRiskPercent, getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import {
  buildPlayerRatingContractMap,
  buildPlayerRatingContractRows,
  type PlayerRatingContractRow,
} from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformance, buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { buildSeasonDisciplinePlayerCountMap } from "@/lib/season/season-discipline-schedule";
import { getPlayerBaselineEconomyReference } from "@/lib/players/player-baseline-service";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import {
  buildScoutedDisciplineTiers,
  getScoutedTraitView,
  type TransfermarktScoutingDisclosure,
} from "@/lib/market/transfermarkt-scouting";
import type { TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";
import { buildPlayerDemands } from "@/lib/morale/player-demands-service";
import { assessPlayerMorale, type PlayerMoraleAssessment } from "@/lib/morale/player-morale-service";
import {
  buildPlayerDevelopmentInsight,
  type PlayerDevelopmentInsight,
  type PlayerScoutPotential,
} from "@/lib/progression/player-potential-service";
import { getEffectiveScoutingLevel } from "@/lib/scouting/facility-scout-pipeline-service";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import {
  buildPlayerDevelopmentLevelupModel,
  type PlayerDevelopmentLevelupModel,
} from "@/lib/training/training-levelup-service";
import type { PlayerProgressionForecast } from "@/lib/training/training-plan-types";

type PlayerDrawerAxisCard = {
  id: "pow" | "spe" | "men" | "soc";
  label: "POW" | "SPE" | "MEN" | "SOC";
  tone: "power" | "speed" | "mental" | "social";
  value: number | null;
  valueRank: number | null;
  seasonPoints: number | null;
  seasonPointsRank: number | null;
  previousSeasonPointsRank: number | null;
};

type PlayerDisciplineDrawerDetail = {
  mutatorPps: number;
  slotLabels: string[];
};

type AttributeVisibility = "exact" | "scouted";

type DisciplineGlobalRankMaps = {
  valueRanksByDiscipline: Map<string, Map<string, number | null>>;
  seasonPointsRanksByDiscipline: Map<string, Map<string, number | null>>;
  allTimePointsRanksByDiscipline: Map<string, Map<string, number | null>>;
};

type PlayerDrawerHistoryRow = {
  seasonId: string | null;
  seasonName: string;
  isActiveSeason: boolean;
  sourceLabel: string;
  teamName: string | null;
  teamCode: string | null;
  appearances: number | null;
  totalPoints: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  ovr: number | null;
  ovrRank: number | null;
  pps: number | null;
  ppsRank: number | null;
  mvs: number | null;
  mvsRank: number | null;
  marketValue: number | null;
  marketValueBaselineDelta: number | null;
  transferType: "buy" | "sell" | "contract_exit" | null;
  transferFee: number | null;
  transferMarketValue: number | null;
  transferDeltaToMarketValue: number | null;
  transferMarketValueFactor: number | null;
  projectedSellValue: number | null;
  projectedSellFactor: number | null;
  projectedSellSourceLabel: string | null;
  salary: number | null;
  contractLength: number | null;
  averageContribution: number | null;
  averageFinalScore: number | null;
  bestDisciplineLabel: string | null;
  warnings: string[];
};

export type PlayerDetailDrawerData = {
  playerId: string;
  activePlayerId: string | null;
  source: "sqlite" | "prisma";
  sourceLabel: string;
  name: string;
  portraitUrl: string | null;
  teamName: string | null;
  teamCode: string | null;
  teamHumanControlled: boolean | null;
  transferStatus: string;
  className: string | null;
  race: string | null;
  subclasses: string[];
  traitsPositive: string[];
  traitsNegative: string[];
  scoutingLevel: number | null;
  effectiveScoutingLevel: number | null;
  axisStarsDisplay: string | null;
  potentialStarsDisplay: string | null;
  potentialGapStars: number | null;
  scoutingDisclosure: TransfermarktScoutingDisclosure | null;
  hiddenPositiveTraitCount: number;
  hiddenNegativeTraitCount: number;
  preferredDisciplineIdsVisible: boolean;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  ovr: number | null;
  ovrRank: number | null;
  ovrDelta: number | null;
  ovrDeltaSourceLabel: string | null;
  ovrSourceLabel: string;
  pps: number | null;
  ppsRank: number | null;
  ppsDelta: number | null;
  ppsDeltaSourceLabel: string | null;
  ppsRating: number | null;
  ppsSourceLabel: string;
  mvs: number | null;
  mvsRank: number | null;
  mvsDelta: number | null;
  mvsDeltaSourceLabel: string | null;
  mvsSourceLabel: string;
  marketValue: number | null;
  marketValueSource: string;
  salary: number | null;
  salarySource: string;
  normalSalary: number | null;
  normalSalarySource: string;
  purchasePrice: number | null;
  purchasePriceSource: string;
  contractLength: number | null;
  contractLengthSource: string;
  isImportedEconomy: boolean;
  economyStatus: string;
  economyCompare: PlayerEconomyCompareRow | null;
  boardTrust: {
    trustScore: number;
    mood: PlayerBoardTrustMood;
    smiley: string;
    renewalPolicy: PlayerBoardTrustRenewalPolicy;
    salaryCapMultiplier: number | null;
    reasons: string[];
    warnings: string[];
    sourceLabel: string;
  } | null;
  morale: {
    morale: number;
    visibleMood: PlayerMoraleAssessment["visibleMood"];
    smiley: string;
    moodLabel: string;
    contractIntent: PlayerMoraleAssessment["contractIntent"];
    salaryModifier: number;
    contractLengthLimit: number | null;
    renewalRisk: number;
    reasons: Array<{
      reasonId: string;
      label: string;
      valueDelta: number;
      source: string;
    }>;
    suggestedActions: string[];
    warnings: string[];
    source: PlayerMoraleAssessment["source"];
  } | null;
  demands: Array<{
    demandId: string;
    label: string;
    detail: string;
    type: string;
    targetDisciplineName?: string | null;
    status: "open" | "fulfilled" | "at_risk" | "failed";
    priority: "low" | "medium" | "high";
    moraleReward: number;
    moralePenalty: number;
  }>;
  fatigue: number | null;
  availability: {
    injuryStatus: "healthy" | "injured" | "recovering";
    injuryUntilMatchday: string | null;
    injuryRiskPercent: number;
    injuryRiskBand: string;
    injuryRiskLabel: string;
    isUnavailable: boolean;
    blocker: "player_injured_unavailable" | null;
    lastRoll: {
      fatigueBefore: number;
      riskPercent: number;
      roll: number;
      result: "healthy" | "injured";
      source: string;
    } | null;
    normalRecovery: number | null;
    injuryRecovery: number | null;
    injuryHistory: Array<{
      eventId: string;
      seasonId: string;
      matchdayId: string;
      fatigueBefore: number;
      riskPercent: number;
      roll: number;
      result: "healthy" | "injured";
      unavailableUntil: string | null;
      timestamp: string;
    }>;
  };
  form: number | null;
  potential: number | null;
  scoutPotential: PlayerScoutPotential | null;
  developmentInsight: PlayerDevelopmentInsight | null;
  organicProgression: Player["lastOrganicProgression"] | null;
  classHistory: NonNullable<Player["classHistory"]>;
  attributeVisibility: AttributeVisibility;
  attributeStats: Array<{
    key: string;
    label: string;
    revealed: boolean;
    revealLevel: number;
    value: number | null;
    ratingLabel: string | null;
    rangeLabel: string | null;
  }>;
  baselineAttributeDeltas: Array<{
    key: string;
    label: string;
    baselineValue: number | null;
    currentValue: number | null;
    delta: number | null;
    source: string | null;
  }>;
  axisCards: PlayerDrawerAxisCard[];
  disciplineValues: Array<{
    id: string;
    label: string;
    category: DisciplineCategory;
    value: number | null;
    seasonPoints: number | null;
    seasonPointsRank: number | null;
    seasonAppearances: number | null;
    allTimePoints: number | null;
    allTimePointsRank: number | null;
    allTimeAppearances: number | null;
    currentSeasonMutatorPps: number | null;
    slotLabels: string[];
    lastSeasonPoints: number | null;
    lastSeasonAppearances: number | null;
    lastSeasonId: string | null;
    upgradeDelta: number | null;
    lastSeasonDisciplineValues: number | null;
    currentDisciplineValues: number | null;
    disciplineDelta: number | null;
    rank: number | null;
    playerCount: number | null;
    scoutedTier?: TransfermarktRatingTier | null;
  }>;
  progressionForecast: PlayerProgressionForecast | null;
  developmentLevelup: PlayerDevelopmentLevelupModel | null;
  progressionEvents: Array<{
    eventId: string;
    seasonId: string;
    xpSpent: number;
    timestamp: string;
    upgrades: Array<{
      attribute: string;
      fromValue: number;
      toValue: number;
      cost: number;
    }>;
  }>;
  progressionEconomyPreview: {
    marketValuePreview: number | null;
    currentContractSalary: number | null;
    renewalSalaryPreview: number | null;
    salaryExpectation: number | null;
    ovrPreview: number | null;
    mvsUnchanged: number | null;
    warningLevel: "none" | "gt_25_pct" | "gt_50_pct" | "gt_90_pct" | null;
    marketValueWarnings: string[];
    salaryWarnings: string[];
    updatedAt: string | null;
  } | null;
  seasonPerformance: {
    seasonId: string | null;
    seasonName: string | null;
    sourceLabel: string;
    appearances: number;
    totalPoints: number | null;
    pointsByArea: {
      pow: number | null;
      spe: number | null;
      men: number | null;
      soc: number | null;
    };
    averageContribution: number | null;
    averageFinalScore: number | null;
    top10Count: number;
    mvpCount: number;
    bestDisciplineLabel: string | null;
    bestDisciplineScore: number | null;
    weakestDisciplineLabel: string | null;
    weakestDisciplineScore: number | null;
    latestDisciplineLabel: string | null;
    latestFinalScore: number | null;
    latestContribution: number | null;
    latestRankInDiscipline: number | null;
    latestMatchdayId: string | null;
    topDisciplineRows: Array<{
      disciplineId: string;
      disciplineName: string;
      totalContribution: number | null;
      averageContribution: number | null;
      averageFinalScore: number | null;
    }>;
    matchdayBreakdown: Array<{
      matchdayId: string;
      appearances: number;
      totalContribution: number | null;
      averageFinalScore: number | null;
      bestDisciplineLabel: string | null;
      bestContribution: number | null;
    }>;
    disciplineBreakdown: Array<{
      disciplineId: string;
      disciplineName: string;
      appearances: number;
      totalContribution: number | null;
      averageContribution: number | null;
      averageFinalScore: number | null;
    }>;
    warnings: string[];
  } | null;
  transferContext: {
    roleTag: RosterEntry["roleTag"] | null;
    promisedRole: RosterEntry["promisedRole"] | null;
    joinedSeasonId: string | null;
    purchasePrice: number | null;
    currentValue: number | null;
    expectedSellValue: number | null;
    lastTransfer: {
      transferType: "buy" | "sell" | "contract_exit";
      seasonLabel: string;
      matchdayId: string | null;
      phase: string | null;
      fee: number | null;
      salary: number | null;
      happenedAt: string;
      fromTeamId: string | null;
      toTeamId: string | null;
    } | null;
  };
  transferHistory: Array<{
    id: string;
    transferType: "buy" | "sell" | "contract_exit";
    seasonLabel: string;
    matchdayId: string | null;
    phase: string | null;
    happenedAt: string;
    fromTeamName: string | null;
    toTeamName: string | null;
    fee: number | null;
    salary: number | null;
    marketValue: number | null;
    remainingContractLength: number | null;
  }>;
  seasonHistory: Array<{
    seasonId: string;
    seasonName: string;
    teamName: string | null;
    teamCode: string | null;
    appearances: number;
    totalPoints: number | null;
    averageContribution: number | null;
    averageFinalScore: number | null;
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
    ovr: number | null;
    ovrRank: number | null;
    pps: number | null;
    ppsRank: number | null;
    mvs: number | null;
    mvsRank: number | null;
    marketValue: number | null;
    marketValueBaselineDelta: number | null;
    transferType: "buy" | "sell" | "contract_exit" | null;
    transferFee: number | null;
    transferMarketValue: number | null;
    transferDeltaToMarketValue: number | null;
    transferMarketValueFactor: number | null;
    projectedSellValue: number | null;
    projectedSellFactor: number | null;
    projectedSellSourceLabel: string | null;
    salary: number | null;
    contractLength: number | null;
    top10Count: number;
    mvpCount: number;
    bestDisciplineLabel: string | null;
    bestDisciplineScore: number | null;
    warnings: string[];
  }>;
  historyRows: PlayerDrawerHistoryRow[];
  ratingWarnings: string[];
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function calculateMoneyDelta(value: number | null | undefined, reference: number | null | undefined, digits = 2) {
  if (!isFiniteNumber(value) || !isFiniteNumber(reference)) {
    return null;
  }
  return roundValue(value - reference, digits);
}

function calculateMoneyFactor(value: number | null | undefined, reference: number | null | undefined) {
  if (!isFiniteNumber(value) || !isFiniteNumber(reference) || reference <= 0) {
    return null;
  }
  return roundValue(value / reference, 3);
}

function buildSharedRankMap(values: Array<{ playerId: string; value: number | null }>) {
  const sorted = [...values].sort((left, right) => {
    const leftValue = left.value ?? Number.NEGATIVE_INFINITY;
    const rightValue = right.value ?? Number.NEGATIVE_INFINITY;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.playerId.localeCompare(right.playerId, "de");
  });

  const rankMap = new Map<string, number | null>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sorted.forEach((entry, index) => {
    if (entry.value == null) {
      rankMap.set(entry.playerId, null);
      return;
    }

    if (previousValue != null && entry.value === previousValue) {
      rankMap.set(entry.playerId, previousRank);
      return;
    }

    previousValue = entry.value;
    previousRank = index + 1;
    rankMap.set(entry.playerId, previousRank);
  });

  return rankMap;
}

function addDisciplinePoints(
  totalsByDiscipline: Map<string, Map<string, number>>,
  disciplineId: string | null | undefined,
  playerId: string | null | undefined,
  value: number | null | undefined,
) {
  if (!disciplineId || !playerId || value == null || !Number.isFinite(value)) {
    return;
  }
  const byPlayerId = totalsByDiscipline.get(disciplineId) ?? new Map<string, number>();
  byPlayerId.set(playerId, roundValue((byPlayerId.get(playerId) ?? 0) + value, 1));
  totalsByDiscipline.set(disciplineId, byPlayerId);
}

function mergeDisciplinePointTotals(
  target: Map<string, Map<string, number>>,
  source: Map<string, Map<string, number>>,
) {
  for (const [disciplineId, byPlayerId] of source.entries()) {
    const targetByPlayerId = target.get(disciplineId) ?? new Map<string, number>();
    for (const [playerId, value] of byPlayerId.entries()) {
      targetByPlayerId.set(playerId, roundValue((targetByPlayerId.get(playerId) ?? 0) + value, 1));
    }
    target.set(disciplineId, targetByPlayerId);
  }
}

function buildDisciplineGlobalRankMaps(
  gameState: GameState,
  disciplines: Array<{ id: string; name: string; category: DisciplineCategory; playerCount?: number | null }>,
): DisciplineGlobalRankMaps {
  const valueRanksByDiscipline = new Map<string, Map<string, number | null>>();
  const seasonPointsRanksByDiscipline = new Map<string, Map<string, number | null>>();
  const allTimePointsRanksByDiscipline = new Map<string, Map<string, number | null>>();
  const currentSeasonId = gameState.season.id ?? null;
  const currentSeasonTotalsByDiscipline = new Map<string, Map<string, number>>();
  const allTimeTotalsByDiscipline = new Map<string, Map<string, number>>();
  const currentSeasonLedger = buildSeasonPointsLedger(gameState);

  for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) {
    for (const playerPerformance of snapshot.playerPerformances ?? []) {
      for (const entry of playerPerformance.disciplineBreakdown ?? []) {
        addDisciplinePoints(allTimeTotalsByDiscipline, entry.disciplineId, playerPerformance.playerId, entry.totalContribution ?? null);
      }
    }
  }

  for (const entry of currentSeasonLedger.pointEntries) {
    const seasonId = entry.seasonId ?? currentSeasonId;
    if (currentSeasonId && seasonId !== currentSeasonId) {
      continue;
    }
    addDisciplinePoints(currentSeasonTotalsByDiscipline, entry.disciplineId, entry.playerId, entry.points ?? null);
  }

  const hasCurrentSeasonSnapshot = Boolean(
    currentSeasonId &&
      (gameState.seasonState.seasonSnapshots ?? []).some((snapshot) => snapshot.seasonId === currentSeasonId),
  );
  if (!hasCurrentSeasonSnapshot) {
    mergeDisciplinePointTotals(allTimeTotalsByDiscipline, currentSeasonTotalsByDiscipline);
  }

  for (const discipline of disciplines) {
    valueRanksByDiscipline.set(
      discipline.id,
      buildSharedRankMap(
        gameState.players.map((player) => ({
          playerId: player.id,
          value: player.currentDisciplineValues?.[discipline.id] ?? player.disciplineRatings?.[discipline.id] ?? null,
        })),
      ),
    );
    seasonPointsRanksByDiscipline.set(
      discipline.id,
      buildSharedRankMap(
        gameState.players.map((player) => ({
          playerId: player.id,
          value: currentSeasonTotalsByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        })),
      ),
    );
    allTimePointsRanksByDiscipline.set(
      discipline.id,
      buildSharedRankMap(
        gameState.players.map((player) => ({
          playerId: player.id,
          value: allTimeTotalsByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        })),
      ),
    );
  }

  return {
    valueRanksByDiscipline,
    seasonPointsRanksByDiscipline,
    allTimePointsRanksByDiscipline,
  };
}

function deriveAttributeRatingLabel(value: number | null | undefined): TransfermarktRatingTier | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 90) return "S+";
  if (value >= 80) return "S";
  if (value >= 70) return "A";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  if (value >= 40) return "D";
  if (value >= 25) return "E";
  return "F";
}

function maskAttributeStatsForVisibility(
  rows: ReturnType<typeof buildRawAttributeStats>,
  visibility: AttributeVisibility,
) {
  return rows.map((row) => ({
    ...row,
    revealed: true,
    revealLevel: 1,
    value: visibility === "exact" ? row.value : null,
    ratingLabel: row.ratingLabel ?? deriveAttributeRatingLabel(row.value),
    rangeLabel: null,
  }));
}

function maskForeignAttributeStats(rows: ReturnType<typeof buildRawAttributeStats>) {
  return rows.map((row) => ({
    ...row,
    revealed: false,
    revealLevel: 99,
    value: null,
    ratingLabel: null,
    rangeLabel: null,
  }));
}

function buildRawAttributeStats(
  player: Pick<Player, "attributeSheetStats" | "attributeSheetRatings"> | null,
) {
  const stats = player?.attributeSheetStats;
  const ratings = player?.attributeSheetRatings;
  return [
    { key: "power", label: "Power", value: stats?.power ?? null, ratingLabel: ratings?.powerRating ?? null },
    { key: "health", label: "Health", value: stats?.health ?? null, ratingLabel: ratings?.healthRating ?? null },
    { key: "stamina", label: "Stamina", value: stats?.stamina ?? null, ratingLabel: ratings?.staminaRating ?? null },
    { key: "intelligence", label: "Intelligence", value: stats?.intelligence ?? null, ratingLabel: ratings?.intelligenceRating ?? null },
    { key: "awareness", label: "Awareness", value: stats?.awareness ?? null, ratingLabel: ratings?.awarenessRating ?? null },
    { key: "determination", label: "Determination", value: stats?.determination ?? null, ratingLabel: ratings?.determinationRating ?? null },
    { key: "speed", label: "Speed", value: stats?.speed ?? null, ratingLabel: ratings?.speedRating ?? null },
    { key: "dexterity", label: "Dexterity", value: stats?.dexterity ?? null, ratingLabel: ratings?.dexterityRating ?? null },
    { key: "charisma", label: "Charisma", value: stats?.charisma ?? null, ratingLabel: ratings?.charismaRating ?? null },
    { key: "will", label: "Will", value: stats?.will ?? null, ratingLabel: ratings?.willRating ?? null },
    { key: "spirit", label: "Spirit", value: stats?.spirit ?? null, ratingLabel: ratings?.spiritRating ?? null },
    { key: "torment", label: "Torment", value: stats?.torment ?? null, ratingLabel: ratings?.tormentRating ?? null },
  ];
}

function buildAttributeStats(
  player: Pick<Player, "attributeSheetStats" | "attributeSheetRatings"> | null,
  visibility: AttributeVisibility = "exact",
  scoutingLevel?: number | null,
  scoutingSeed?: { saveId: string; playerId: string } | null,
) {
  if (visibility === "scouted") {
    return maskForeignAttributeStats(buildRawAttributeStats(player));
  }
  return maskAttributeStatsForVisibility(buildRawAttributeStats(player), visibility);
}

function maskAxisCardsForVisibility(cards: PlayerDrawerAxisCard[], visibility: AttributeVisibility): PlayerDrawerAxisCard[] {
  if (visibility === "exact") {
    return cards;
  }
  return cards.map((card) => ({
    ...card,
    value: null,
    valueRank: null,
    seasonPoints: null,
    seasonPointsRank: null,
    previousSeasonPointsRank: null,
  }));
}

function getGameStateScoutingSeed(gameState: GameState) {
  return [
    gameState.scenarioMeta?.sourceSaveId,
    gameState.scenarioMeta?.createdAt,
    gameState.mappingReport?.generatedAt,
    gameState.season.id,
  ].find((value) => typeof value === "string" && value.trim().length > 0) ?? "player-drawer-scouting";
}

function buildScoutedDisciplineValuesFromPlayer(input: {
  gameState: GameState;
  player: Player;
  scoutingLevel: number | null;
  topN?: number;
}): PlayerDetailDrawerData["disciplineValues"] {
  const disciplineById = new Map(input.gameState.disciplines.map((discipline) => [discipline.id, discipline] as const));
  const seasonPlayerCountByDisciplineId = buildSeasonDisciplinePlayerCountMap(input.gameState);
  return buildScoutedDisciplineTiers({
    saveId: getGameStateScoutingSeed(input.gameState),
    playerId: input.player.id,
    scoutingLevel: input.scoutingLevel,
    topN: input.topN ?? 5,
    disciplines: Object.entries(input.player.disciplineRatings ?? {})
      .filter(([, score]) => typeof score === "number" && Number.isFinite(score))
      .map(([disciplineId, score]) => {
        const discipline = disciplineById.get(disciplineId) ?? null;
        return {
          disciplineId,
          disciplineName: discipline?.name ?? disciplineId,
          score,
        };
      }),
  }).map((entry, index) => {
    const discipline = disciplineById.get(entry.disciplineId) ?? null;
    return {
      id: entry.disciplineId,
      label: discipline?.name ?? entry.disciplineName,
      category: discipline?.category ?? "power",
      value: entry.displayedScore,
      seasonPoints: null,
      seasonPointsRank: null,
      seasonAppearances: null,
      allTimePoints: null,
      allTimePointsRank: null,
      allTimeAppearances: null,
      currentSeasonMutatorPps: null,
      slotLabels: [],
      lastSeasonPoints: null,
      lastSeasonAppearances: null,
      lastSeasonId: null,
      upgradeDelta: null,
      lastSeasonDisciplineValues: null,
      currentDisciplineValues: null,
      disciplineDelta: null,
      rank: index + 1,
      playerCount: seasonPlayerCountByDisciplineId.get(entry.disciplineId) ?? discipline?.playerCount ?? null,
      scoutedTier: entry.scoreTier,
    };
  });
}

function resolveAttributeVisibility(input: {
  teamId: string | null | undefined;
  teamHumanControlled: boolean | null | undefined;
  manageableTeamIds?: string[] | null;
  scoutingLevel?: number | null;
}): AttributeVisibility {
  if (input.manageableTeamIds) {
    if (input.teamId && input.manageableTeamIds.includes(input.teamId)) {
      return "exact";
    }
    return "scouted";
  }
  if (input.teamHumanControlled === false) {
    return "scouted";
  }
  return "exact";
}

function buildBaselineAttributeDeltas(
  player: Pick<Player, "id" | "attributeSheetStats"> | null,
  gameState: GameState,
  progressionEvents: PlayerDetailDrawerData["progressionEvents"],
): PlayerDetailDrawerData["baselineAttributeDeltas"] {
  if (!player) return [];
  const baseline = gameState.playerBaselines?.find((entry) => entry.playerId === player.id) ?? null;
  if (!baseline) return [];
  const latestEvent = progressionEvents[0] ?? null;
  return buildAttributeStats(player).map((entry) => {
    const key = entry.key as keyof NonNullable<Player["attributeSheetStats"]>;
    const baselineValue = Object.prototype.hasOwnProperty.call(baseline.attributes, key)
      ? baseline.attributes[key as keyof typeof baseline.attributes] ?? null
      : null;
    const currentValue = player.attributeSheetStats?.[key] ?? null;
    const delta =
      typeof baselineValue === "number" && typeof currentValue === "number"
        ? currentValue - baselineValue
        : null;
    return {
      key: entry.key,
      label: entry.label,
      baselineValue,
      currentValue,
      delta,
      source: delta && delta !== 0 ? latestEvent?.eventId ?? "progression_event_source_missing" : null,
    };
  });
}

function buildDisciplineValuesFromPlayer(
  player: Pick<Player, "id" | "disciplineRatings" | "previousDisciplineRatings" | "lastSeasonDisciplineValues" | "currentDisciplineValues" | "disciplineDelta"> | null,
  disciplines: Array<{ id: string; name: string; category: DisciplineCategory; playerCount?: number | null }>,
  performance?: {
    seasonId: string | null;
    disciplineBreakdown: Array<{
      disciplineId: string;
      appearances: number;
      totalContribution: number | null;
    }>;
  } | null,
  latestArchivedPerformance?: {
    seasonId: string | null;
    disciplineBreakdown?: Array<{
      disciplineId: string;
      appearances?: number | null;
      totalContribution?: number | null;
    }>;
  } | null,
  gameState?: GameState | null,
  globalRankMaps?: DisciplineGlobalRankMaps | null,
) {
  if (!player) {
    return [];
  }
  const seasonByDisciplineId = new Map((performance?.disciplineBreakdown ?? []).map((entry) => [entry.disciplineId, entry] as const));
  const lastSeasonByDisciplineId = new Map((latestArchivedPerformance?.disciplineBreakdown ?? []).map((entry) => [entry.disciplineId, entry] as const));
  const allTimeByDisciplineId = new Map<string, { points: number; appearances: number }>();
  const currentDetailsByDisciplineId = new Map<string, PlayerDisciplineDrawerDetail>();
  const currentSeasonId = gameState?.season.id ?? performance?.seasonId ?? null;
  const seasonPlayerCountByDisciplineId = gameState ? buildSeasonDisciplinePlayerCountMap(gameState) : null;

  for (const snapshot of gameState?.seasonState.seasonSnapshots ?? []) {
    const snapshotPerformance = snapshot.playerPerformances?.find((entry) => entry.playerId === player.id) ?? null;
    if (!snapshotPerformance) continue;
    for (const entry of snapshotPerformance.disciplineBreakdown ?? []) {
      const current = allTimeByDisciplineId.get(entry.disciplineId) ?? { points: 0, appearances: 0 };
      current.points += entry.totalContribution ?? 0;
      current.appearances += entry.appearances ?? 0;
      allTimeByDisciplineId.set(entry.disciplineId, current);
    }
  }

  const hasCurrentSeasonSnapshot = Boolean(
    currentSeasonId &&
      (gameState?.seasonState.seasonSnapshots ?? []).some((snapshot) => snapshot.seasonId === currentSeasonId),
  );
  if (!hasCurrentSeasonSnapshot) {
    for (const entry of performance?.disciplineBreakdown ?? []) {
      const current = allTimeByDisciplineId.get(entry.disciplineId) ?? { points: 0, appearances: 0 };
      current.points += entry.totalContribution ?? 0;
      current.appearances += entry.appearances ?? 0;
      allTimeByDisciplineId.set(entry.disciplineId, current);
    }
  }

  const resultById = new Map((gameState?.seasonState.matchdayResults ?? []).map((entry) => [entry.id, entry] as const));
  for (const entry of gameState?.seasonState.playerDisciplinePerformances ?? []) {
    if (entry.playerId !== player.id) continue;
    const result = resultById.get(entry.matchdayResultId) ?? null;
    if (currentSeasonId && (result?.seasonId ?? currentSeasonId) !== currentSeasonId) continue;
    const detail = currentDetailsByDisciplineId.get(entry.disciplineId) ?? { mutatorPps: 0, slotLabels: [] };
    detail.mutatorPps += entry.mutatorPpsBonus ?? 0;
    const matchdayLabel = result?.matchdayId?.match(/matchday-(\d+)/i)?.[1] ?? result?.matchdayId ?? "MD";
    const slotLabel = `MD ${matchdayLabel} ${entry.disciplineSide.toUpperCase()}-${entry.slotIndex + 1}`;
    if (!detail.slotLabels.includes(slotLabel)) {
      detail.slotLabels.push(slotLabel);
    }
    currentDetailsByDisciplineId.set(entry.disciplineId, detail);
  }

  return disciplines
    .map((discipline) => {
      const seasonRow = seasonByDisciplineId.get(discipline.id) ?? null;
      const lastSeasonRow = lastSeasonByDisciplineId.get(discipline.id) ?? null;
      const allTimeRow = allTimeByDisciplineId.get(discipline.id) ?? null;
      const currentDetail = currentDetailsByDisciplineId.get(discipline.id) ?? null;
      const previous =
        player.lastSeasonDisciplineValues?.[discipline.id] != null && player.currentDisciplineValues?.[discipline.id] != null
          ? player.lastSeasonDisciplineValues[discipline.id]
          : player.previousDisciplineRatings?.[discipline.id] != null && player.disciplineRatings?.[discipline.id] != null
            ? player.previousDisciplineRatings[discipline.id]
            : null;
      const current =
        player.currentDisciplineValues?.[discipline.id] != null
          ? player.currentDisciplineValues[discipline.id]
          : player.disciplineRatings?.[discipline.id] ?? null;
      const delta =
        player.disciplineDelta?.[discipline.id] != null
          ? player.disciplineDelta[discipline.id]
          : previous != null && current != null
            ? roundValue(current - previous, 0)
            : null;
      return {
        id: discipline.id,
        label: discipline.name,
        category: discipline.category,
        value: current,
        seasonPoints: seasonRow?.totalContribution ?? null,
        seasonPointsRank: globalRankMaps?.seasonPointsRanksByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        seasonAppearances: seasonRow?.appearances ?? null,
        allTimePoints: allTimeRow ? roundValue(allTimeRow.points, 1) : null,
        allTimePointsRank: globalRankMaps?.allTimePointsRanksByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        allTimeAppearances: allTimeRow?.appearances ?? null,
        currentSeasonMutatorPps: currentDetail ? roundValue(currentDetail.mutatorPps, 1) : null,
        slotLabels: currentDetail?.slotLabels.slice(0, 8) ?? [],
        lastSeasonPoints: lastSeasonRow?.totalContribution ?? null,
        lastSeasonAppearances: lastSeasonRow?.appearances ?? null,
        lastSeasonId: latestArchivedPerformance?.seasonId ?? null,
        upgradeDelta: delta,
        lastSeasonDisciplineValues: previous,
        currentDisciplineValues: current,
        disciplineDelta: delta,
        playerCount: seasonPlayerCountByDisciplineId?.get(discipline.id) ?? discipline.playerCount ?? null,
      };
    })
    .sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY))
    .map((entry, index) => ({
      ...entry,
      rank: globalRankMaps?.valueRanksByDiscipline.get(entry.id)?.get(player.id) ?? (entry.value == null ? null : index + 1),
    }));
}

function buildCoreAxisRankMaps(players: Player[], rankPoolPlayerIds?: string[] | null) {
  const rankPoolSet = rankPoolPlayerIds != null ? new Set(rankPoolPlayerIds.filter(Boolean)) : null;
  const rankedPlayers = rankPoolSet ? players.filter((player) => rankPoolSet.has(player.id)) : players;
  return {
    pow: buildSharedRankMap(rankedPlayers.map((player) => ({ playerId: player.id, value: player.coreStats.pow ?? null }))),
    spe: buildSharedRankMap(rankedPlayers.map((player) => ({ playerId: player.id, value: player.coreStats.spe ?? null }))),
    men: buildSharedRankMap(rankedPlayers.map((player) => ({ playerId: player.id, value: player.coreStats.men ?? null }))),
    soc: buildSharedRankMap(rankedPlayers.map((player) => ({ playerId: player.id, value: player.coreStats.soc ?? null }))),
  };
}

type AxisId = PlayerDrawerAxisCard["id"];
type AxisRankMap = Partial<Record<AxisId, number | null>>;
type SeasonSnapshotRecord = NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number];

const AXIS_POINT_FIELDS: Record<AxisId, "powPoints" | "spePoints" | "menPoints" | "socPoints"> = {
  pow: "powPoints",
  spe: "spePoints",
  men: "menPoints",
  soc: "socPoints",
};

const AXIS_DISCIPLINE_CATEGORIES: Record<AxisId, DisciplineCategory> = {
  pow: "power",
  spe: "speed",
  men: "mental",
  soc: "social",
};

function getSeasonSortValue(seasonId: string) {
  const numericMatch = seasonId.match(/(\d+)$/);
  return numericMatch ? Number(numericMatch[1]) : Number.NEGATIVE_INFINITY;
}

function compareSeasonSnapshotsDesc(left: SeasonSnapshotRecord, right: SeasonSnapshotRecord) {
  const leftValue = getSeasonSortValue(left.seasonId);
  const rightValue = getSeasonSortValue(right.seasonId);
  if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue) {
    return rightValue - leftValue;
  }
  return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
}

function resolveSnapshotAxisPoints(
  gameState: GameState,
  row: SeasonSnapshotRecord["playerPerformances"][number],
  axisId: AxisId,
) {
  const directValue = row[AXIS_POINT_FIELDS[axisId]];
  if (isFiniteNumber(directValue)) {
    return directValue;
  }

  const category = AXIS_DISCIPLINE_CATEGORIES[axisId];
  const disciplineCategoryById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const));
  const values = (row.disciplineBreakdown ?? [])
    .filter((entry) => disciplineCategoryById.get(entry.disciplineId) === category && isFiniteNumber(entry.totalContribution))
    .map((entry) => entry.totalContribution ?? 0);
  if (values.length === 0) {
    return null;
  }

  return roundValue(values.reduce((total, value) => total + value, 0), 1);
}

function buildSnapshotAxisRanks(gameState: GameState, snapshot: SeasonSnapshotRecord, playerId: string): AxisRankMap {
  return {
    pow: buildSharedRankMap(
      snapshot.playerPerformances.map((row) => ({ playerId: row.playerId, value: resolveSnapshotAxisPoints(gameState, row, "pow") })),
    ).get(playerId) ?? null,
    spe: buildSharedRankMap(
      snapshot.playerPerformances.map((row) => ({ playerId: row.playerId, value: resolveSnapshotAxisPoints(gameState, row, "spe") })),
    ).get(playerId) ?? null,
    men: buildSharedRankMap(
      snapshot.playerPerformances.map((row) => ({ playerId: row.playerId, value: resolveSnapshotAxisPoints(gameState, row, "men") })),
    ).get(playerId) ?? null,
    soc: buildSharedRankMap(
      snapshot.playerPerformances.map((row) => ({ playerId: row.playerId, value: resolveSnapshotAxisPoints(gameState, row, "soc") })),
    ).get(playerId) ?? null,
  };
}

function buildAxisRankContext(input: {
  gameState: GameState;
  playerId: string;
  referenceSeasonId: string | null | undefined;
}) {
  const snapshots = [...(input.gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.playerPerformances.some((row) => row.playerId === input.playerId))
    .sort(compareSeasonSnapshotsDesc);
  const currentSnapshot = input.referenceSeasonId
    ? snapshots.find((snapshot) => snapshot.seasonId === input.referenceSeasonId) ?? null
    : null;
  const previousSnapshot =
    snapshots.find((snapshot) => snapshot.seasonId !== input.referenceSeasonId) ?? null;

  return {
    current: currentSnapshot ? buildSnapshotAxisRanks(input.gameState, currentSnapshot, input.playerId) : {},
    previous: previousSnapshot ? buildSnapshotAxisRanks(input.gameState, previousSnapshot, input.playerId) : {},
  };
}

function buildAxisCards(input: {
  player: Pick<Player, "id" | "coreStats">;
  playerRating: PlayerRatingContractRow | null;
  coreAxisRankMaps: ReturnType<typeof buildCoreAxisRankMaps>;
  axisRankContext?: {
    current?: AxisRankMap;
    previous?: AxisRankMap;
  } | null;
}): PlayerDrawerAxisCard[] {
  return [
    {
      id: "pow",
      label: "POW",
      tone: "power",
      value: input.player.coreStats.pow ?? null,
      valueRank: input.coreAxisRankMaps.pow.get(input.player.id) ?? null,
      seasonPoints: input.playerRating?.ppPow ?? null,
      seasonPointsRank: input.playerRating?.ppPowRank ?? input.axisRankContext?.current?.pow ?? null,
      previousSeasonPointsRank: input.axisRankContext?.previous?.pow ?? null,
    },
    {
      id: "spe",
      label: "SPE",
      tone: "speed",
      value: input.player.coreStats.spe ?? null,
      valueRank: input.coreAxisRankMaps.spe.get(input.player.id) ?? null,
      seasonPoints: input.playerRating?.ppSpe ?? null,
      seasonPointsRank: input.playerRating?.ppSpeRank ?? input.axisRankContext?.current?.spe ?? null,
      previousSeasonPointsRank: input.axisRankContext?.previous?.spe ?? null,
    },
    {
      id: "men",
      label: "MEN",
      tone: "mental",
      value: input.player.coreStats.men ?? null,
      valueRank: input.coreAxisRankMaps.men.get(input.player.id) ?? null,
      seasonPoints: input.playerRating?.ppMen ?? null,
      seasonPointsRank: input.playerRating?.ppMenRank ?? input.axisRankContext?.current?.men ?? null,
      previousSeasonPointsRank: input.axisRankContext?.previous?.men ?? null,
    },
    {
      id: "soc",
      label: "SOC",
      tone: "social",
      value: input.player.coreStats.soc ?? null,
      valueRank: input.coreAxisRankMaps.soc.get(input.player.id) ?? null,
      seasonPoints: input.playerRating?.ppSoc ?? null,
      seasonPointsRank: input.playerRating?.ppSocRank ?? input.axisRankContext?.current?.soc ?? null,
      previousSeasonPointsRank: input.axisRankContext?.previous?.soc ?? null,
    },
  ];
}

function buildPlayerRatingWithSeasonFallback(
  gameState: GameState,
  playerRating: PlayerRatingContractRow | null,
  playerId: string,
): PlayerRatingContractRow | null {
  if (!playerRating) return null;
  if (playerRating.ppsSeason != null) return playerRating;

  const performanceMap = buildPlayerSeasonPerformanceMap(gameState);
  const activePlayerIds = Array.from(new Set((gameState.rosters ?? []).map((entry) => entry.playerId).filter(Boolean)));
  const activePlayerIdSet = new Set(activePlayerIds);
  const activeSummaries = activePlayerIds
    .map((candidateId) => ({ playerId: candidateId, summary: performanceMap.get(candidateId) ?? null }))
    .filter((entry) => entry.summary?.totalPoints != null);
  const summary = performanceMap.get(playerId) ?? null;
  if (!summary || summary.totalPoints == null) return playerRating;

  const ppsRankMap = buildSharedRankMap(activeSummaries.map((entry) => ({ playerId: entry.playerId, value: entry.summary?.totalPoints ?? null })));
  const powRankMap = buildSharedRankMap(activeSummaries.map((entry) => ({ playerId: entry.playerId, value: entry.summary?.pointsByArea.pow ?? null })));
  const speRankMap = buildSharedRankMap(activeSummaries.map((entry) => ({ playerId: entry.playerId, value: entry.summary?.pointsByArea.spe ?? null })));
  const menRankMap = buildSharedRankMap(activeSummaries.map((entry) => ({ playerId: entry.playerId, value: entry.summary?.pointsByArea.men ?? null })));
  const socRankMap = buildSharedRankMap(activeSummaries.map((entry) => ({ playerId: entry.playerId, value: entry.summary?.pointsByArea.soc ?? null })));

  return {
    ...playerRating,
    ppsSeason: summary.totalPoints,
    ppsSeasonRank: activePlayerIdSet.has(playerId) ? ppsRankMap.get(playerId) ?? null : null,
    ppPow: summary.pointsByArea.pow,
    ppPowRank: activePlayerIdSet.has(playerId) ? powRankMap.get(playerId) ?? null : null,
    ppSpe: summary.pointsByArea.spe,
    ppSpeRank: activePlayerIdSet.has(playerId) ? speRankMap.get(playerId) ?? null : null,
    ppMen: summary.pointsByArea.men,
    ppMenRank: activePlayerIdSet.has(playerId) ? menRankMap.get(playerId) ?? null : null,
    ppSoc: summary.pointsByArea.soc,
    ppSocRank: activePlayerIdSet.has(playerId) ? socRankMap.get(playerId) ?? null : null,
    sourceStatus: {
      ...playerRating.sourceStatus,
      ppsSeason: "ready",
    },
  };
}

function resolveRosterEntry(
  rosters: RosterEntry[],
  playerId: string,
  activePlayerId?: string | null,
) {
  if (activePlayerId) {
    return rosters.find((entry) => entry.id === activePlayerId) ?? null;
  }

  return rosters.find((entry) => entry.playerId === playerId) ?? null;
}

function resolveTeam(
  teams: Team[],
  rosterEntry: Pick<RosterEntry, "teamId"> | null,
) {
  if (!rosterEntry) {
    return null;
  }

  return teams.find((team) => team.teamId === rosterEntry.teamId) ?? null;
}

function getSourceLabel(source: "sqlite" | "prisma") {
  return source === "prisma" ? "Prisma / Referenz read-only" : "SQLite / lokal";
}

function getSeasonZeroEconomyForPlayer(gameState: GameState, playerId: string) {
  const baseline = gameState.playerBaselines?.find((entry) => entry.playerId === playerId) ?? null;
  return getPlayerBaselineEconomyReference(baseline);
}

function buildSeasonHistory(gameState: GameState, playerId: string) {
  const disciplineCategoryById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const));
  const seasonZeroEconomy = getSeasonZeroEconomyForPlayer(gameState, playerId);
  const baselineMarketValue = seasonZeroEconomy?.marketValue ?? null;
  return [...(gameState.seasonState.seasonSnapshots ?? [])]
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de"))
    .map((snapshot) => {
      const row = snapshot.playerPerformances.find((entry) => entry.playerId === playerId) ?? null;
      if (!row) {
        return null;
      }
      const seasonTransfer = [...(snapshot.transferSnapshots ?? [])]
        .filter((entry) => entry.playerId === playerId)
        .sort((left, right) => {
          const leftTime = Date.parse(left.happenedAt ?? "");
          const rightTime = Date.parse(right.happenedAt ?? "");
          if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
            return rightTime - leftTime;
          }
          return right.transferId.localeCompare(left.transferId, "de", { numeric: true });
        })[0] ?? null;
      const transferFee = seasonTransfer?.amount ?? null;
      const transferMarketValue = row.marketValue ?? seasonTransfer?.marketValue ?? null;
      const ppsRankMap = buildSharedRankMap(
        snapshot.playerPerformances.map((entry) => ({
          playerId: entry.playerId,
          value: entry.pps ?? entry.totalPoints ?? entry.totalContribution ?? null,
        })),
      );
      const pointsByArea = (row.disciplineBreakdown ?? []).reduce(
        (totals, discipline) => {
          const category = disciplineCategoryById.get(discipline.disciplineId);
          if (category === "power") totals.pow += discipline.totalContribution ?? 0;
          if (category === "speed") totals.spe += discipline.totalContribution ?? 0;
          if (category === "mental") totals.men += discipline.totalContribution ?? 0;
          if (category === "social") totals.soc += discipline.totalContribution ?? 0;
          return totals;
        },
        { pow: 0, spe: 0, men: 0, soc: 0 },
      );
      const hasDisciplineBreakdown = (row.disciplineBreakdown?.length ?? 0) > 0;
      return {
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        teamName: row.teamName ?? null,
        teamCode: row.teamCode ?? null,
        appearances: row.appearances,
        totalPoints: row.totalPoints ?? row.totalContribution ?? null,
        averageContribution: row.averageContribution,
        averageFinalScore: row.averageFinalScore,
        top10Count: row.top10Count,
        mvpCount: row.mvpCount,
        pow: row.powPoints ?? (hasDisciplineBreakdown ? roundValue(pointsByArea.pow, 1) : null),
        spe: row.spePoints ?? (hasDisciplineBreakdown ? roundValue(pointsByArea.spe, 1) : null),
        men: row.menPoints ?? (hasDisciplineBreakdown ? roundValue(pointsByArea.men, 1) : null),
        soc: row.socPoints ?? (hasDisciplineBreakdown ? roundValue(pointsByArea.soc, 1) : null),
        ovr: row.ovr ?? null,
        ovrRank: row.ovrRank ?? null,
        pps: row.pps ?? row.totalPoints ?? row.totalContribution ?? null,
        ppsRank: row.ppsRank ?? ppsRankMap.get(row.playerId) ?? null,
        mvs: row.mvs ?? null,
        mvsRank: row.mvsRank ?? null,
        marketValue: row.marketValue ?? null,
        marketValueBaselineDelta: calculateMoneyDelta(row.marketValue, baselineMarketValue),
        transferType: seasonTransfer?.type ?? null,
        transferFee,
        transferMarketValue,
        transferDeltaToMarketValue: seasonTransfer?.amountDeltaToMarketValue ?? calculateMoneyDelta(transferFee, transferMarketValue),
        transferMarketValueFactor: seasonTransfer?.amountMarketValueFactor ?? calculateMoneyFactor(transferFee, transferMarketValue),
        projectedSellValue: seasonTransfer?.type === "sell" ? transferFee : null,
        projectedSellFactor: seasonTransfer?.type === "sell"
          ? seasonTransfer?.amountMarketValueFactor ?? calculateMoneyFactor(transferFee, transferMarketValue)
          : null,
        projectedSellSourceLabel: seasonTransfer?.type === "sell" ? "Archivierter Verkauf" : null,
        salary: row.salary ?? null,
        contractLength: row.contractLength ?? null,
        bestDisciplineLabel: row.bestDisciplineLabel ?? null,
        bestDisciplineScore: row.bestDisciplineScore ?? null,
        warnings: row.warnings ?? [],
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function findLatestArchivedPlayerPerformance(gameState: GameState, playerId: string) {
  return [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.seasonId !== gameState.season.id)
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de"))
    .map((snapshot) => {
      const row = snapshot.playerPerformances.find((entry) => entry.playerId === playerId) ?? null;
      return row ? { ...row, seasonId: snapshot.seasonId } : null;
    })
    .find((entry): entry is NonNullable<typeof entry> => Boolean(entry)) ?? null;
}

function buildMetricDelta(currentValue: number | null, previousValue: number | null) {
  if (!isFiniteNumber(currentValue) || !isFiniteNumber(previousValue)) {
    return null;
  }
  return roundValue(currentValue - previousValue, 1);
}

function buildHistoryRows(input: {
  gameState: GameState;
  player: Player;
  rosterEntry: RosterEntry | null;
  teamName: string | null;
  teamCode: string | null;
  seasonPerformance: PlayerDetailDrawerData["seasonPerformance"];
  playerRating: PlayerRatingContractRow | null;
  marketValue: number | null;
  salary: number | null;
  contractLength: number | null;
  seasonHistory: PlayerDetailDrawerData["seasonHistory"];
}) {
  const hasActiveSeasonPerformance =
    input.seasonPerformance?.seasonId === input.gameState.season.id &&
    input.seasonPerformance.sourceLabel !== "Season Snapshot";
  const activeSeasonTransfer = [...input.gameState.transferHistory]
    .filter((entry) => entry.playerId === input.player.id && entry.seasonId === input.gameState.season.id)
    .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt, "de"))[0] ?? null;
  const activeTransferFee = activeSeasonTransfer?.fee ?? null;
  const activeTransferMarketValue = input.marketValue ?? activeSeasonTransfer?.marketValue ?? null;
  const seasonZeroEconomy = getSeasonZeroEconomyForPlayer(input.gameState, input.player.id);
  const baselineMarketValue = seasonZeroEconomy?.marketValue ?? getImportedPlayerDisplayMarketValue(input.player);
  const activeSaleBreakdown = input.rosterEntry
    ? buildTransfermarktSaleFactorBreakdown(input.gameState, input.player, input.rosterEntry)
    : null;
  const activeSeasonRow: PlayerDrawerHistoryRow = {
    seasonId: input.gameState.season.id,
    seasonName: input.gameState.season.name,
    isActiveSeason: true,
    sourceLabel: hasActiveSeasonPerformance ? input.seasonPerformance?.sourceLabel ?? "Aktive Season / Live-State" : "Aktive Season / noch keine Results",
    teamName: input.teamName,
    teamCode: input.teamCode,
    appearances: hasActiveSeasonPerformance ? input.seasonPerformance?.appearances ?? null : null,
    totalPoints: hasActiveSeasonPerformance ? input.seasonPerformance?.totalPoints ?? null : null,
    pow: hasActiveSeasonPerformance ? input.playerRating?.ppPow ?? null : null,
    spe: hasActiveSeasonPerformance ? input.playerRating?.ppSpe ?? null : null,
    men: hasActiveSeasonPerformance ? input.playerRating?.ppMen ?? null : null,
    soc: hasActiveSeasonPerformance ? input.playerRating?.ppSoc ?? null : null,
    ovr: input.playerRating?.ovrNormalized ?? null,
    ovrRank: input.playerRating?.ovrRank ?? null,
    pps: hasActiveSeasonPerformance ? input.playerRating?.ppsSeason ?? null : null,
    ppsRank: hasActiveSeasonPerformance ? input.playerRating?.ppsSeasonRank ?? null : null,
    mvs: input.playerRating?.mvs ?? null,
    mvsRank: input.playerRating?.mvsRank ?? null,
    marketValue: input.marketValue,
    marketValueBaselineDelta: calculateMoneyDelta(input.marketValue, baselineMarketValue),
    transferType: activeSeasonTransfer?.transferType ?? null,
    transferFee: activeTransferFee,
    transferMarketValue: activeTransferMarketValue,
    transferDeltaToMarketValue: calculateMoneyDelta(activeTransferFee, activeTransferMarketValue),
    transferMarketValueFactor: calculateMoneyFactor(activeTransferFee, activeTransferMarketValue),
    projectedSellValue: activeSaleBreakdown?.salePrice ?? null,
    projectedSellFactor: activeSaleBreakdown?.saleFactor ?? null,
    projectedSellSourceLabel: activeSaleBreakdown ? activeSaleBreakdown.factorSource : null,
    salary: input.salary,
    contractLength: input.contractLength,
    averageContribution: hasActiveSeasonPerformance ? input.seasonPerformance?.averageContribution ?? null : null,
    averageFinalScore: hasActiveSeasonPerformance ? input.seasonPerformance?.averageFinalScore ?? null : null,
    bestDisciplineLabel: hasActiveSeasonPerformance ? input.seasonPerformance?.bestDisciplineLabel ?? null : null,
    warnings: hasActiveSeasonPerformance ? input.seasonPerformance?.warnings ?? [] : [],
  };

  const archivedRows: PlayerDrawerHistoryRow[] = input.seasonHistory
    .filter((entry) => entry.seasonId !== input.gameState.season.id)
    .map((entry) => ({
      seasonId: entry.seasonId,
      seasonName: entry.seasonName,
      isActiveSeason: false,
      sourceLabel: "Season Snapshot",
      teamName: entry.teamName,
      teamCode: entry.teamCode,
      appearances: entry.appearances,
      totalPoints: entry.totalPoints,
      pow: entry.pow,
      spe: entry.spe,
      men: entry.men,
      soc: entry.soc,
      ovr: entry.ovr,
      ovrRank: entry.ovrRank,
      pps: entry.pps,
      ppsRank: entry.ppsRank,
      mvs: entry.mvs,
      mvsRank: entry.mvsRank,
      marketValue: entry.marketValue,
      marketValueBaselineDelta: entry.marketValueBaselineDelta,
      transferType: entry.transferType,
      transferFee: entry.transferFee,
      transferMarketValue: entry.transferMarketValue,
      transferDeltaToMarketValue: entry.transferDeltaToMarketValue,
      transferMarketValueFactor: entry.transferMarketValueFactor,
      projectedSellValue: entry.projectedSellValue,
      projectedSellFactor: entry.projectedSellFactor,
      projectedSellSourceLabel: entry.projectedSellSourceLabel,
      salary: entry.salary,
      contractLength: entry.contractLength,
      averageContribution: entry.averageContribution,
      averageFinalScore: entry.averageFinalScore,
      bestDisciplineLabel: entry.bestDisciplineLabel,
      warnings: entry.warnings,
    }));

  return [activeSeasonRow, ...archivedRows];
}

function buildTransferContext(gameState: GameState, playerId: string, rosterEntry: RosterEntry | null) {
  const lastTransfer = [...gameState.transferHistory]
    .filter((entry) => entry.playerId === playerId)
    .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt, "de"))[0] ?? null;

  return {
    roleTag: rosterEntry?.roleTag ?? null,
    promisedRole: rosterEntry?.promisedRole ?? null,
    joinedSeasonId: rosterEntry?.joinedSeasonId ?? null,
    purchasePrice: rosterEntry?.purchasePrice ?? null,
    currentValue: rosterEntry?.currentValue ?? null,
    expectedSellValue: rosterEntry?.currentValue ?? rosterEntry?.purchasePrice ?? null,
    lastTransfer: lastTransfer
      ? {
          transferType: lastTransfer.transferType,
          seasonLabel: lastTransfer.seasonLabel,
          matchdayId: lastTransfer.matchdayId ?? null,
          phase: lastTransfer.phase ?? null,
          fee: lastTransfer.fee ?? null,
          salary: lastTransfer.salary ?? null,
          happenedAt: lastTransfer.happenedAt,
          fromTeamId: lastTransfer.fromTeamId ?? null,
          toTeamId: lastTransfer.toTeamId ?? null,
        }
      : null,
  };
}

function buildTransferHistory(gameState: GameState, playerId: string) {
  const teamNamesById = new Map(gameState.teams.map((team) => [team.teamId, team.name] as const));

  return [...gameState.transferHistory]
    .filter((entry) => entry.playerId === playerId)
    .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt, "de"))
    .map((entry) => ({
      id: entry.id,
      transferType: entry.transferType,
      seasonLabel: entry.seasonLabel,
      matchdayId: entry.matchdayId ?? null,
      phase: entry.phase ?? null,
      happenedAt: entry.happenedAt,
      fromTeamName: entry.fromTeamId ? (teamNamesById.get(entry.fromTeamId) ?? entry.fromTeamId) : null,
      toTeamName: entry.toTeamId ? (teamNamesById.get(entry.toTeamId) ?? entry.toTeamId) : null,
      fee: entry.fee ?? null,
      salary: entry.salary ?? null,
      marketValue: entry.marketValue ?? null,
      remainingContractLength: entry.remainingContractLength ?? null,
    }));
}

function getPlayerStrategyTokens(player: Player) {
  return [
    player.className,
    player.race,
    ...(player.subclasses ?? []),
    ...(player.traitsPositive ?? []),
    ...(player.traitsNegative ?? []),
  ]
    .map(normalizeTransfermarktToken)
    .filter(Boolean);
}

function countStrategyMatches(values: string[] | undefined, candidateTokens: string[]) {
  const normalizedValues = (values ?? []).map(normalizeTransfermarktToken).filter(Boolean);
  return normalizedValues.filter((token) =>
    candidateTokens.some((candidate) => candidate === token || candidate.includes(token) || token.includes(candidate)),
  ).length;
}

function matchesTrustHardNoGo(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile || profile.hardNoGos.length === 0) {
    return false;
  }

  const tokens = getPlayerStrategyTokens(player);
  const normalizedRace = normalizeTransfermarktToken(player.race);
  return profile.hardNoGos.some((entry) => {
    const normalized = normalizeTransfermarktToken(entry);
    if (!normalized) {
      return false;
    }
    if (normalized.includes("nonhuman") && normalizedRace !== "human") {
      return true;
    }
    if (normalized.includes("human") && normalized.includes("anti") && normalizedRace === "human") {
      return true;
    }
    return tokens.some((token) => token === normalized || token.includes(normalized) || normalized.includes(token));
  });
}

function buildBoardTrust(input: {
  gameState: GameState;
  team: Team | null;
  player: Player;
  rosterEntry: RosterEntry | null;
  playerRating: PlayerRatingContractRow | null;
  economy: {
    marketValue: number | null;
    salary: number | null;
  };
  coreAxisRankMaps: ReturnType<typeof buildCoreAxisRankMaps>;
  rankPoolSize: number;
  seasonPerformance: ReturnType<typeof buildPlayerSeasonPerformance> | null;
}): PlayerDetailDrawerData["boardTrust"] {
  if (!input.team || !input.rosterEntry) {
    return null;
  }

  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.team?.teamId) ?? null;
  const profile = getTeamStrategyProfile(input.gameState, input.team.teamId);
  const tokens = getPlayerStrategyTokens(input.player);
  const preferredHits =
    countStrategyMatches(profile?.preferredRaces, [normalizeTransfermarktToken(input.player.race)]) +
    countStrategyMatches(profile?.preferredClasses, [normalizeTransfermarktToken(input.player.className)]) +
    countStrategyMatches(profile?.preferredTraits, tokens) +
    countStrategyMatches(profile?.preferredArchetypes, tokens);
  const avoidedHits =
    countStrategyMatches(profile?.avoidedRaces, [normalizeTransfermarktToken(input.player.race)]) +
    countStrategyMatches(profile?.avoidedClasses, [normalizeTransfermarktToken(input.player.className)]) +
    countStrategyMatches(profile?.dislikedTraits, tokens) +
    countStrategyMatches(profile?.avoidedArchetypes, tokens);
  const hardNoGoHit = matchesTrustHardNoGo(profile, input.player);
  const weakTeamFit = avoidedHits > preferredHits || hardNoGoHit;
  const axisCandidates = [
    {
      axis: "pow",
      value: input.player.coreStats.pow ?? null,
      expectedAxisRank: input.coreAxisRankMaps.pow.get(input.player.id) ?? null,
      actualAxisPpsRank: input.playerRating?.ppPowRank ?? null,
    },
    {
      axis: "spe",
      value: input.player.coreStats.spe ?? null,
      expectedAxisRank: input.coreAxisRankMaps.spe.get(input.player.id) ?? null,
      actualAxisPpsRank: input.playerRating?.ppSpeRank ?? null,
    },
    {
      axis: "men",
      value: input.player.coreStats.men ?? null,
      expectedAxisRank: input.coreAxisRankMaps.men.get(input.player.id) ?? null,
      actualAxisPpsRank: input.playerRating?.ppMenRank ?? null,
    },
    {
      axis: "soc",
      value: input.player.coreStats.soc ?? null,
      expectedAxisRank: input.coreAxisRankMaps.soc.get(input.player.id) ?? null,
      actualAxisPpsRank: input.playerRating?.ppSocRank ?? null,
    },
  ].sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY))[0] ?? null;
  const assessment = assessPlayerBoardTrust({
    boardConfidence: identity?.boardConfidence ?? null,
    appearances: input.seasonPerformance?.appearances ?? 0,
    averageContribution: input.seasonPerformance?.averageContribution ?? null,
    averageFinalScore: input.seasonPerformance?.averageFinalScore ?? null,
    expectedPerformanceValue: input.playerRating?.ovrNormalized ?? input.player.rating ?? null,
    contractLength: input.rosterEntry.contractLength ?? null,
    roleTag: input.rosterEntry.roleTag ?? null,
    salary: input.economy.salary,
    marketValue: input.economy.marketValue,
    purchasePrice: input.rosterEntry.purchasePrice ?? null,
    currentValue: input.rosterEntry.currentValue ?? null,
    ovrRank: input.playerRating?.ovrRank ?? null,
    actualPpsRank: input.playerRating?.ppsSeasonRank ?? null,
    actualMvsRank: input.playerRating?.mvsRank ?? null,
    expectedAxisRank: axisCandidates?.expectedAxisRank ?? null,
    actualAxisPpsRank: axisCandidates?.actualAxisPpsRank ?? null,
    rankPoolSize: input.rankPoolSize,
    weakTeamFit,
    hardNoGoHit,
  });

  return {
    ...assessment,
    sourceLabel:
      identity?.boardConfidence != null
        ? `Board Rating ${Math.round(identity.boardConfidence)}`
        : "Board Rating neutral",
  };
}

export function buildPlayerDrawerDataFromGameState(input: {
  gameState: GameState;
  playerId: string;
  source: "sqlite" | "prisma";
  activePlayerId?: string | null;
  manageableTeamIds?: string[] | null;
}): PlayerDetailDrawerData | null {
  const player = input.gameState.players.find((entry) => entry.id === input.playerId) ?? null;
  if (!player) {
    return null;
  }

  const rosterEntry = resolveRosterEntry(input.gameState.rosters, input.playerId, input.activePlayerId);
  const team = resolveTeam(input.gameState.teams, rosterEntry);
  const scoutingTeamId = input.manageableTeamIds?.[0] ?? null;
  const facilityScoutingLevel = scoutingTeamId
    ? getFacilityLevel(getTeamFacilityState(input.gameState, scoutingTeamId), "scouting_office")
    : 0;
  const effectiveScoutingLevel =
    scoutingTeamId != null
      ? getEffectiveScoutingLevel(input.gameState, scoutingTeamId, player.id)
      : facilityScoutingLevel;
  const scoutingLevel = effectiveScoutingLevel;
  const starSnapshot =
    scoutingLevel > 0
      ? buildPlayerStarScoutingSnapshot({
          gameState: input.gameState,
          player,
          saveId: input.gameState.season.id,
          scoutingLevel,
        })
      : null;
  const attributeVisibility = resolveAttributeVisibility({
    teamId: rosterEntry?.teamId ?? team?.teamId ?? null,
    teamHumanControlled: team ? team.humanControlled !== false : null,
    manageableTeamIds: input.manageableTeamIds ?? null,
    scoutingLevel,
  });
  const traitView =
    attributeVisibility === "exact"
      ? {
          disclosure: null,
          visiblePositiveTraits: player.traitsPositive ?? [],
          visibleNegativeTraits: player.traitsNegative ?? [],
          hiddenPositiveTraitCount: 0,
          hiddenNegativeTraitCount: 0,
        }
      : getScoutedTraitView({
          traitsPositive: player.traitsPositive ?? [],
          traitsNegative: player.traitsNegative ?? [],
          scoutingLevel,
        });
  const seasonPerformance = buildPlayerSeasonPerformance(input.gameState, player.id);
  const playerRatingsById = buildPlayerRatingContractMap(input.gameState);
  const playerRating = buildPlayerRatingWithSeasonFallback(input.gameState, playerRatingsById.get(player.id) ?? null, player.id);
  const activePlayerIds = Array.from(new Set((input.gameState.rosters ?? []).map((entry) => entry.playerId).filter(Boolean)));
  const coreAxisRankMaps = buildCoreAxisRankMaps(input.gameState.players, activePlayerIds);
  const disciplineGlobalRankMaps = buildDisciplineGlobalRankMaps(input.gameState, input.gameState.disciplines);
  const axisRankContext = buildAxisRankContext({
    gameState: input.gameState,
    playerId: player.id,
    referenceSeasonId: seasonPerformance?.seasonId ?? input.gameState.season.id,
  });
  const economyCompare = buildPlayerEconomyCompareMap({ gameState: input.gameState }).get(player.id) ?? null;
  const economy = resolvePlayerEconomyContract({
    playerId: player.id,
    player,
    rosterEntry,
  });
  const boardTrust = buildBoardTrust({
    gameState: input.gameState,
    team,
    player,
    rosterEntry,
    playerRating,
    economy: {
      marketValue: economy.marketValue,
      salary: economy.salary,
    },
    coreAxisRankMaps,
    rankPoolSize: playerRatingsById.size,
    seasonPerformance,
  });
  const moraleAssessment = team && rosterEntry
    ? assessPlayerMorale({
        gameState: input.gameState,
        playerId: player.id,
        teamId: team.teamId,
        renewalSalaryPreview: player.economyAfterUpgradePreview?.renewalSalaryPreview ?? null,
      })
    : null;
  const playerDemands = team && rosterEntry ? buildPlayerDemands(input.gameState, player.id, team.teamId) : [];
  const seasonHistory = buildSeasonHistory(input.gameState, player.id);
  const latestArchivedPerformance = findLatestArchivedPlayerPerformance(input.gameState, player.id);
  const historyRows = buildHistoryRows({
    gameState: input.gameState,
    player,
    rosterEntry,
    teamName: team?.name ?? null,
    teamCode: team?.shortCode ?? null,
    seasonPerformance,
    playerRating,
    marketValue: economy.marketValue,
    salary: economy.salary,
    contractLength: economy.contractLength,
    seasonHistory,
  });
  const previousHistoryRow = historyRows.find((entry) => !entry.isActiveSeason) ?? null;
  const progressionForecast = buildPlayerProgressionForecast({
    gameState: input.gameState,
    player,
    playerRating,
    seasonPerformance,
    trainingModeByPlayerId: player.trainingMode ? { [player.id]: player.trainingMode } : null,
    currentXP: player.currentXP ?? 0,
    spentXP: player.spentXP ?? 0,
    lifetimeXP: player.lifetimeXP ?? null,
  });
  const developmentLevelup = buildPlayerDevelopmentLevelupModel({
    gameState: input.gameState,
    player,
    forecast: progressionForecast,
    teamId: team?.teamId ?? null,
    profile: team?.teamId ? getTeamStrategyProfile(input.gameState, team.teamId) : null,
  });
  const progressionEvents = [...(input.gameState.playerProgressionEvents ?? [])]
    .filter((event) => event.playerId === player.id)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp, "de"))
    .slice(0, 5)
    .map((event) => ({
      eventId: event.eventId,
      seasonId: event.seasonId,
      xpSpent: event.xpSpent,
      timestamp: event.timestamp,
      upgrades: event.upgrades.map((upgrade) => ({
        attribute: upgrade.attribute,
        fromValue: upgrade.fromValue,
        toValue: upgrade.toValue,
        cost: upgrade.cost,
      })),
    }));
  const playerTeamId = rosterEntry?.teamId ?? team?.teamId ?? "";
  const availability = getPlayerAvailabilityView(
    input.gameState,
    player.id,
    playerTeamId,
    input.gameState.matchdayState.matchdayId,
  );
  const recovery = playerTeamId ? calculateTeamRecovery(input.gameState, playerTeamId) : null;
  const injuryRiskBand = getInjuryRiskBand(availability.fatigue ?? player.fatigue ?? 0);
  const injuryHistory = [...(input.gameState.seasonState.injuryEvents ?? [])]
    .filter((event) => event.playerId === player.id)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp, "de"))
    .slice(0, 5)
    .map((event) => ({
      eventId: event.eventId,
      seasonId: event.seasonId,
      matchdayId: event.matchdayId,
      fatigueBefore: event.fatigueBefore,
      riskPercent: event.riskPercent,
      roll: event.roll,
      result: event.result,
      unavailableUntil: event.unavailableUntil ?? null,
      timestamp: event.timestamp,
    }));

  return {
    playerId: player.id,
    activePlayerId: rosterEntry?.id ?? null,
    source: input.source,
    sourceLabel: getSourceLabel(input.source),
    name: player.name,
    portraitUrl: getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null),
    teamName: team?.name ?? null,
    teamCode: team?.shortCode ?? null,
    teamHumanControlled: team ? team.humanControlled !== false : null,
    transferStatus: rosterEntry ? "Active Player" : "Free Agent",
    className: player.className ?? null,
    race: player.race ?? null,
    subclasses: player.subclasses ?? [],
    traitsPositive: traitView.visiblePositiveTraits,
    traitsNegative: traitView.visibleNegativeTraits,
    scoutingLevel,
    effectiveScoutingLevel,
    axisStarsDisplay: starSnapshot?.revealedCurrentStars.displayLabel ?? null,
    potentialStarsDisplay: starSnapshot?.revealedPotentialStars.displayLabel ?? null,
    potentialGapStars: starSnapshot?.potentialGap ?? null,
    scoutingDisclosure: traitView.disclosure,
    hiddenPositiveTraitCount: traitView.hiddenPositiveTraitCount,
    hiddenNegativeTraitCount: traitView.hiddenNegativeTraitCount,
    preferredDisciplineIdsVisible: attributeVisibility === "exact" || Boolean(traitView.disclosure?.preferredDisciplinesVisible),
    pow: player.coreStats.pow ?? null,
    spe: player.coreStats.spe ?? null,
    men: player.coreStats.men ?? null,
    soc: player.coreStats.soc ?? null,
    ovr: playerRating?.ovrNormalized ?? null,
    ovrRank: playerRating?.ovrRank ?? null,
    ovrDelta: buildMetricDelta(playerRating?.ovrNormalized ?? null, previousHistoryRow?.ovr ?? null),
    ovrDeltaSourceLabel: previousHistoryRow?.ovr != null ? `Vergleich zu ${previousHistoryRow.seasonName}` : null,
    ovrSourceLabel:
      playerRating?.sourceStatus.normalizedOvr === "ready"
        ? "Pool-normalisiert aus rating"
        : playerRating?.sourceStatus.normalizedOvr === "pool_no_spread"
          ? "OVR blockiert: ovr_pool_no_spread"
          : "OVR blockiert: ovr_raw_source_missing",
    pps: playerRating?.ppsSeason ?? null,
    ppsRank: playerRating?.ppsSeasonRank ?? null,
    ppsDelta: buildMetricDelta(playerRating?.ppsSeason ?? null, previousHistoryRow?.pps ?? null),
    ppsDeltaSourceLabel: previousHistoryRow?.pps != null ? `Vergleich zu ${previousHistoryRow.seasonName}` : null,
    ppsRating: playerRating?.ratingPps ?? null,
    ppsSourceLabel:
      playerRating?.sourceStatus.ppsSeason === "ready"
        ? "Season PPs aus gespeicherten Results"
        : "Keine gespeicherten Season-PPs",
    mvs: playerRating?.mvs ?? null,
    mvsRank: playerRating?.mvsRank ?? null,
    mvsDelta: buildMetricDelta(playerRating?.mvs ?? null, previousHistoryRow?.mvs ?? null),
    mvsDeltaSourceLabel: previousHistoryRow?.mvs != null ? `Vergleich zu ${previousHistoryRow.seasonName}` : null,
    mvsSourceLabel:
      playerRating?.sourceStatus.mvs === "ready"
        ? "MVS aus Retool-Season-Rankpunkten, Clutch, Vielseitigkeit und Einsaetzen"
        : "Keine belegte MVS-Quelle",
    marketValue: economy.marketValue,
    marketValueSource: economy.marketValueSource,
    salary: economy.salary,
    salarySource: economy.salarySource,
    normalSalary: getSeasonZeroEconomyForPlayer(input.gameState, player.id)?.salary ?? economy.expectedSalary,
    normalSalarySource: getSeasonZeroEconomyForPlayer(input.gameState, player.id)?.salary != null ? "season_0_baseline" : "calculated_expected",
    purchasePrice: economy.purchasePrice,
    purchasePriceSource: economy.purchasePriceSource,
    contractLength: economy.contractLength,
    contractLengthSource: economy.contractLengthSource,
    isImportedEconomy: economy.isImportedEconomy,
    economyStatus: economy.economyStatus,
    economyCompare,
    boardTrust,
    morale: moraleAssessment
      ? {
          morale: moraleAssessment.morale,
          visibleMood: moraleAssessment.visibleMood,
          smiley: moraleAssessment.smiley,
          moodLabel: moraleAssessment.moodLabel,
          contractIntent: moraleAssessment.contractIntent,
          salaryModifier: moraleAssessment.moraleSalaryModifier,
          contractLengthLimit: moraleAssessment.moraleContractLengthLimit,
          renewalRisk: moraleAssessment.moraleRenewalRisk,
          reasons: moraleAssessment.reasons,
          suggestedActions: moraleAssessment.suggestedActions,
          warnings: moraleAssessment.warnings,
          source: moraleAssessment.source,
        }
      : null,
    demands: playerDemands.map((demand) => ({
      demandId: demand.demandId,
      label: demand.label,
      detail: demand.detail,
      type: demand.type,
      targetDisciplineName: demand.targetDisciplineName ?? null,
      status: demand.status,
      priority: demand.priority,
      moraleReward: demand.moraleReward,
      moralePenalty: demand.moralePenalty,
    })),
    progressionEconomyPreview: player.economyAfterUpgradePreview
      ? {
          marketValuePreview: player.economyAfterUpgradePreview.marketValuePreview,
          currentContractSalary: player.economyAfterUpgradePreview.currentContractSalary,
          renewalSalaryPreview: player.economyAfterUpgradePreview.renewalSalaryPreview,
          salaryExpectation: player.economyAfterUpgradePreview.salaryExpectation,
          ovrPreview: player.economyAfterUpgradePreview.ovrPreview,
          mvsUnchanged: player.economyAfterUpgradePreview.mvsUnchanged,
          warningLevel: player.economyAfterUpgradePreview.warningLevel ?? null,
          marketValueWarnings: player.economyAfterUpgradePreview.marketValueWarnings ?? [],
          salaryWarnings: player.economyAfterUpgradePreview.salaryWarnings ?? [],
          updatedAt: player.economyAfterUpgradePreview.updatedAt,
        }
      : null,
    fatigue: availability.fatigue ?? player.fatigue ?? null,
    availability: {
      injuryStatus: availability.injuryStatus,
      injuryUntilMatchday: availability.injuryUntilMatchday ?? null,
      injuryRiskPercent: injuryRiskBand.riskPercent,
      injuryRiskBand: injuryRiskBand.label,
      injuryRiskLabel: injuryRiskBand.uiLabel,
      isUnavailable: availability.isUnavailable,
      blocker: availability.blocker,
      lastRoll: availability.injuryRiskLastRoll
        ? {
            fatigueBefore: availability.injuryRiskLastRoll.fatigueBefore,
            riskPercent: availability.injuryRiskLastRoll.riskPercent,
            roll: availability.injuryRiskLastRoll.roll,
            result: availability.injuryRiskLastRoll.result,
            source: availability.injuryRiskLastRoll.source,
          }
        : null,
      normalRecovery: recovery?.normalRecovery ?? null,
      injuryRecovery: recovery?.injuryRecovery ?? null,
      injuryHistory,
    },
    form: player.form ?? null,
    potential: player.potential ?? null,
    scoutPotential: progressionForecast.scoutPotential,
    developmentInsight: buildPlayerDevelopmentInsight({
      gameState: input.gameState,
      player,
      currentRating: progressionForecast.currentAbilityRating,
      performanceRating: playerRating?.ratingPps ?? playerRating?.ppsSeason ?? null,
    scoutPotential: progressionForecast.scoutPotential,
    }),
    organicProgression: player.lastOrganicProgression ?? null,
    classHistory: player.classHistory ?? [],
    attributeVisibility,
    attributeStats: buildAttributeStats(player, attributeVisibility, scoutingLevel, {
      saveId: getGameStateScoutingSeed(input.gameState),
      playerId: player.id,
    }),
    baselineAttributeDeltas: buildBaselineAttributeDeltas(player, input.gameState, progressionEvents),
    axisCards: maskAxisCardsForVisibility(
      buildAxisCards({
        player,
        playerRating,
        coreAxisRankMaps,
        axisRankContext,
      }),
      attributeVisibility,
    ),
    disciplineValues:
      attributeVisibility === "scouted"
        ? buildScoutedDisciplineValuesFromPlayer({
            gameState: input.gameState,
            player,
            scoutingLevel,
            topN: 5,
          })
        : buildDisciplineValuesFromPlayer(
            player,
            input.gameState.disciplines,
            seasonPerformance,
            latestArchivedPerformance,
            input.gameState,
            disciplineGlobalRankMaps,
          ),
    progressionForecast,
    developmentLevelup,
    progressionEvents,
    seasonPerformance,
    transferContext: {
      ...buildTransferContext(input.gameState, player.id, rosterEntry),
      purchasePrice: economy.purchasePrice,
      currentValue: economy.marketValue,
      expectedSellValue: economy.marketValue,
    },
    transferHistory: buildTransferHistory(input.gameState, player.id),
    seasonHistory,
    historyRows,
    ratingWarnings: playerRating?.warnings ?? [],
  };
}

export function buildPlayerDrawerDataFromLegacyContext(input: {
  context: LegacyLineupLoadedContext;
  playerId: string;
  source: "sqlite" | "prisma";
  activePlayerId?: string | null;
  playerCatalogById?: Map<string, Player>;
}): PlayerDetailDrawerData | null {
  const catalogPlayer = input.playerCatalogById?.get(input.playerId) ?? null;
  const rosterPlayer = input.context.rosterPlayers.find((entry) => entry.id === input.playerId) ?? null;
  if (!catalogPlayer && !rosterPlayer) {
    return null;
  }

  const activePlayer = input.context.activePlayers.find((entry) =>
    input.activePlayerId ? entry.id === input.activePlayerId : entry.playerId === input.playerId,
  ) ?? null;
  const attributeVisibility: AttributeVisibility =
    (input.context.team as { humanControlled?: boolean }).humanControlled === false ? "scouted" : "exact";
  const playerCatalog = input.playerCatalogById ? [...input.playerCatalogById.values()] : catalogPlayer ? [catalogPlayer] : [];
  const activePlayerIds = Array.from(new Set(input.context.activePlayers.map((entry) => entry.playerId).filter(Boolean)));
  const coreAxisRankMaps = buildCoreAxisRankMaps(playerCatalog, activePlayerIds);
  const playerRating = buildPlayerRatingContractRows({
    players: playerCatalog,
    normalizationPoolPlayerIds: activePlayerIds,
    rankPoolPlayerIds: activePlayerIds,
  }).find((entry) => entry.playerId === input.playerId) ?? null;
  const economy = resolvePlayerEconomyContract({
    playerId: input.playerId,
    player: catalogPlayer,
    rosterEntry: activePlayer
      ? {
          salary: activePlayer.salary ?? null,
          purchasePrice: null,
          currentValue: activePlayer.marketValue ?? null,
          contractLength: activePlayer.contractLength ?? null,
        }
      : null,
  });

  const disciplineValues = catalogPlayer
    ? buildDisciplineValuesFromPlayer(catalogPlayer, input.context.disciplines)
    : input.context.disciplineScores
        .filter((entry) => entry.playerId === input.playerId)
        .map((entry) => {
          const discipline = input.context.disciplines.find((candidate) => candidate.id === entry.disciplineId) ?? null;
          return {
            id: entry.disciplineId,
            label: discipline?.name ?? entry.disciplineId,
            category: discipline?.category ?? "power",
            value: entry.score,
            seasonPoints: null,
            seasonPointsRank: null,
            seasonAppearances: null,
            allTimePoints: null,
            allTimePointsRank: null,
            allTimeAppearances: null,
            currentSeasonMutatorPps: null,
            slotLabels: [],
            lastSeasonPoints: null,
            lastSeasonAppearances: null,
            lastSeasonId: null,
            upgradeDelta: null,
            lastSeasonDisciplineValues: null,
            currentDisciplineValues: entry.score,
            disciplineDelta: null,
            playerCount: (discipline as { playerCount?: number | null } | null)?.playerCount ?? null,
          };
        })
        .sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY))
        .map((entry, index) => ({
          ...entry,
          rank: entry.value == null ? null : index + 1,
        }));
  const axisCards =
    catalogPlayer && playerCatalog.length > 0
      ? buildAxisCards({
          player: catalogPlayer,
          playerRating,
          coreAxisRankMaps,
        })
      : [
          {
            id: "pow",
            label: "POW",
            tone: "power",
            value: rosterPlayer?.coreStats.pow ?? null,
            valueRank: null,
            seasonPoints: null,
            seasonPointsRank: null,
            previousSeasonPointsRank: null,
          },
          {
            id: "spe",
            label: "SPE",
            tone: "speed",
            value: rosterPlayer?.coreStats.spe ?? null,
            valueRank: null,
            seasonPoints: null,
            seasonPointsRank: null,
            previousSeasonPointsRank: null,
          },
          {
            id: "men",
            label: "MEN",
            tone: "mental",
            value: rosterPlayer?.coreStats.men ?? null,
            valueRank: null,
            seasonPoints: null,
            seasonPointsRank: null,
            previousSeasonPointsRank: null,
          },
          {
            id: "soc",
            label: "SOC",
            tone: "social",
            value: rosterPlayer?.coreStats.soc ?? null,
            valueRank: null,
            seasonPoints: null,
            seasonPointsRank: null,
            previousSeasonPointsRank: null,
          },
        ] satisfies PlayerDrawerAxisCard[];
  const historyRows: PlayerDrawerHistoryRow[] = [
    {
      seasonId: input.context.matchday.id ?? null,
      seasonName: input.context.matchday.id ?? "Kontext",
      isActiveSeason: true,
      sourceLabel: "Lineup-Kontext",
      teamName: input.context.team.name,
      teamCode: input.context.team.shortCode,
      appearances: null,
      totalPoints: null,
      pow: null,
      spe: null,
      men: null,
      soc: null,
      ovr: playerRating?.ovrNormalized ?? null,
      ovrRank: playerRating?.ovrRank ?? null,
      pps: null,
      ppsRank: null,
      mvs: playerRating?.mvs ?? null,
      mvsRank: playerRating?.mvsRank ?? null,
      marketValue: economy.marketValue,
      marketValueBaselineDelta: calculateMoneyDelta(economy.marketValue, catalogPlayer ? getImportedPlayerDisplayMarketValue(catalogPlayer) : null),
      transferType: null,
      transferFee: null,
      transferMarketValue: null,
      transferDeltaToMarketValue: null,
      transferMarketValueFactor: null,
      projectedSellValue: null,
      projectedSellFactor: null,
      projectedSellSourceLabel: null,
      salary: economy.salary,
      contractLength: economy.contractLength,
      averageContribution: null,
      averageFinalScore: null,
      bestDisciplineLabel: disciplineValues[0]?.label ?? null,
      warnings: [],
    },
  ];

  const detailPlayer = catalogPlayer;
  const legacyTraitView =
    attributeVisibility === "exact"
      ? {
          disclosure: null,
          visiblePositiveTraits: catalogPlayer?.traitsPositive ?? rosterPlayer?.traitsPositive ?? [],
          visibleNegativeTraits: catalogPlayer?.traitsNegative ?? rosterPlayer?.traitsNegative ?? [],
          hiddenPositiveTraitCount: 0,
          hiddenNegativeTraitCount: 0,
        }
      : getScoutedTraitView({
          traitsPositive: catalogPlayer?.traitsPositive ?? rosterPlayer?.traitsPositive ?? [],
          traitsNegative: catalogPlayer?.traitsNegative ?? rosterPlayer?.traitsNegative ?? [],
          scoutingLevel: 0,
        });

  return {
    playerId: input.playerId,
    activePlayerId: activePlayer?.id ?? null,
    source: input.source,
    sourceLabel: getSourceLabel(input.source),
    name: catalogPlayer?.name ?? rosterPlayer?.name ?? input.playerId,
    portraitUrl: catalogPlayer
      ? getPlayerPortraitBrowserUrl(
          catalogPlayer.id,
          catalogPlayer.portraitUrl ?? null,
          catalogPlayer.portraitPath ?? null,
        )
      : getPlayerPortraitBrowserUrl(input.playerId, rosterPlayer?.portraitUrl ?? null, null),
    teamName: input.context.team.name,
    teamCode: input.context.team.shortCode,
    teamHumanControlled: (input.context.team as { humanControlled?: boolean }).humanControlled === false ? false : true,
    transferStatus: activePlayer ? "Active Player" : "Preview / Kontextspieler",
    className: catalogPlayer?.className ?? rosterPlayer?.className ?? null,
    race: catalogPlayer?.race ?? null,
    subclasses: catalogPlayer?.subclasses ?? [],
    traitsPositive: legacyTraitView.visiblePositiveTraits,
    traitsNegative: legacyTraitView.visibleNegativeTraits,
    scoutingLevel: 0,
    scoutingDisclosure: legacyTraitView.disclosure,
    hiddenPositiveTraitCount: legacyTraitView.hiddenPositiveTraitCount,
    hiddenNegativeTraitCount: legacyTraitView.hiddenNegativeTraitCount,
    preferredDisciplineIdsVisible: attributeVisibility === "exact",
    pow: catalogPlayer?.coreStats.pow ?? rosterPlayer?.coreStats.pow ?? null,
    spe: catalogPlayer?.coreStats.spe ?? rosterPlayer?.coreStats.spe ?? null,
    men: catalogPlayer?.coreStats.men ?? rosterPlayer?.coreStats.men ?? null,
    soc: catalogPlayer?.coreStats.soc ?? rosterPlayer?.coreStats.soc ?? null,
    ovr: playerRating?.ovrNormalized ?? null,
    ovrRank: playerRating?.ovrRank ?? null,
    ovrDelta: null,
    ovrDeltaSourceLabel: null,
    ovrSourceLabel:
      playerRating?.sourceStatus.normalizedOvr === "ready"
        ? "Pool-normalisiert aus rating"
        : playerRating?.sourceStatus.normalizedOvr === "pool_no_spread"
          ? "OVR blockiert: ovr_pool_no_spread"
          : "OVR blockiert: ovr_raw_source_missing",
    pps: null,
    ppsRank: null,
    ppsDelta: null,
    ppsDeltaSourceLabel: null,
    ppsRating: playerRating?.ratingPps ?? catalogPlayer?.pps ?? rosterPlayer?.pps ?? null,
    ppsSourceLabel: "Kontextansicht ohne gespeicherte Season-PPs",
    mvs: playerRating?.mvs ?? null,
    mvsRank: playerRating?.mvsRank ?? null,
    mvsDelta: null,
    mvsDeltaSourceLabel: null,
    mvsSourceLabel:
      playerRating?.sourceStatus.mvs === "ready"
        ? "MVS aus Retool-Season-Rankpunkten, Clutch, Vielseitigkeit und Einsaetzen"
        : "Keine belegte MVS-Quelle",
    marketValue: economy.marketValue,
    marketValueSource: economy.marketValueSource,
    salary: economy.salary,
    salarySource: economy.salarySource,
    normalSalary: economy.expectedSalary,
    normalSalarySource: "calculated_expected",
    purchasePrice: economy.purchasePrice,
    purchasePriceSource: economy.purchasePriceSource,
    contractLength: economy.contractLength,
    contractLengthSource: economy.contractLengthSource,
    isImportedEconomy: economy.isImportedEconomy,
    economyStatus: economy.economyStatus,
    economyCompare: null,
    boardTrust: null,
    morale: null,
    demands: [],
    fatigue: rosterPlayer ? rosterPlayer.fatigue ?? catalogPlayer?.fatigue ?? 0 : 0,
    availability: {
      injuryStatus: rosterPlayer?.injuryStatus ?? "healthy",
      injuryUntilMatchday: rosterPlayer ? rosterPlayer.injuryUntilMatchday ?? null : null,
      injuryRiskPercent: rosterPlayer?.injuryRiskPercent ?? 0,
      injuryRiskBand: rosterPlayer ? getInjuryRiskBand(rosterPlayer.fatigue ?? catalogPlayer?.fatigue ?? 0).label : "none",
      injuryRiskLabel: rosterPlayer ? getInjuryRiskBand(rosterPlayer.fatigue ?? catalogPlayer?.fatigue ?? 0).uiLabel : "kein Risiko",
      isUnavailable: rosterPlayer?.availabilityBlocker === "player_injured_unavailable",
      blocker: rosterPlayer?.availabilityBlocker ?? null,
      lastRoll: null,
      normalRecovery: null,
      injuryRecovery: null,
      injuryHistory: [],
    },
    form: catalogPlayer?.form ?? rosterPlayer?.form ?? null,
    potential: catalogPlayer?.potential ?? rosterPlayer?.potential ?? null,
    scoutPotential: null,
    developmentInsight: null,
    organicProgression: detailPlayer?.lastOrganicProgression ?? null,
    classHistory: detailPlayer?.classHistory ?? [],
    attributeVisibility,
    attributeStats: detailPlayer ? buildAttributeStats(detailPlayer, attributeVisibility, 0, { saveId: "legacy-context", playerId: input.playerId }) : [],
    baselineAttributeDeltas: [],
    axisCards: maskAxisCardsForVisibility(axisCards, attributeVisibility),
    disciplineValues,
    progressionForecast: null,
    developmentLevelup: detailPlayer
      ? buildPlayerDevelopmentLevelupModel({
          player: detailPlayer,
          forecast: null,
          teamId: null,
          profile: null,
        })
      : null,
    progressionEvents: [],
    progressionEconomyPreview: null,
    seasonPerformance: null,
    transferContext: {
      roleTag: null,
      promisedRole: null,
      joinedSeasonId: null,
      purchasePrice: economy.purchasePrice,
      currentValue: economy.marketValue,
      expectedSellValue: economy.marketValue,
      lastTransfer: null,
    },
    transferHistory: [],
    seasonHistory: [],
    historyRows,
    ratingWarnings: playerRating?.warnings ?? [],
  };
}
