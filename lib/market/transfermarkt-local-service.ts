import { randomUUID } from "node:crypto";

import type { ContractShape, ContractYearSalary, GameState, Player, RosterEntry, RosterPromisedRole, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { resolveTeamRosterMarketValue } from "@/lib/ai/planner-cash-buffer-policy";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildGameStateContentSignature, getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { getTeamPlayerMax, deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { applyDefaultTrainingFieldsToRosteredPlayers } from "@/lib/training/player-training-backfill";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getEffectiveScoutingLevel } from "@/lib/scouting/facility-scout-pipeline-service";
import { buildPlayerStarScoutingSnapshot, type PlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { buildPlayerScoutPotentialFromGameState } from "@/lib/progression/player-potential-service";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withIncrementalSeasonDerivationsAfterTransfer } from "@/lib/foundation/incremental-season-derivations";
import type { PersistenceService, PersistedSaveGame } from "@/lib/persistence/types";
import { calculateTransfermarktFit, getTransfermarktBracket, hasMercenaryTrait } from "@/lib/market/transfermarkt-fit";
import { buildContractNegotiationPreview, recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import {
  buildRecentlySoldByTeam,
  getRecentlySoldBySameTeam,
  RECENTLY_SOLD_SAME_PRESEASON_BLOCKER,
  RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING,
} from "@/lib/market/anti-rebuy-guard";
import { assessFreeAgentDispositionTowardTeam } from "@/lib/morale/player-morale-service";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { buildTransfermarktSellCoachingView } from "@/lib/market/transfermarkt-sell-coaching-service";
import { applySellBoardReactionToGameState } from "@/lib/market/transfermarkt-sell-board-reaction";
import { applySellPricingPolicyToBreakdown } from "@/lib/market/transfermarkt-sell-pricing-policy";
import { resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";
import {
  isPlayerTransferBuyBlocked,
  buildSoldPlayerSeasonBans,
  SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER,
  SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING,
} from "@/lib/market/transfer-sold-cooldown";
import { isTransferSellPhaseOpen, LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { buildTransfermarktPoolAudit } from "@/lib/market/transfermarkt-pool-audit";
import { buildTransfermarktDoubleLoadWarnings } from "@/lib/market/transfermarkt-double-load";
import {
  buildScoutedDisciplineTiers,
  getScoutedNumericEstimate,
  getScoutedTraitView,
  getTransfermarktScoutingDisclosure,
} from "@/lib/market/transfermarkt-scouting";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { resolveSeasonOneMarketBuyBlocker, isSeasonOneDraftBuySource } from "@/lib/season/transfer-season-policy";
import { recordFreeAgentFeed } from "@/lib/ai/transfer-window-profiler";
import {
  applyTransferBudgetSpend,
  resolveMarketSpendableCashForPlanner,
} from "@/lib/ai/ai-manager-apply-service";
import { buildSeasonDisciplinePlayerCountMap } from "@/lib/season/season-discipline-schedule";
import { getTransfermarktTierFromPoints, type TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";
import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import { computeTeamDisciplineRanks } from "@/lib/lineups/team-discipline-ranks";
import type { AiNeedSummary } from "@/lib/ai/types";
import type {
  TransfermarktBuyExecuteResult,
  TransfermarktBuyParams,
  TransfermarktBuyPreview,
} from "@/lib/market/transfermarkt-buy-service";
import type {
  TransfermarktSellExecuteResult,
  TransfermarktSellParams,
  TransfermarktSellPreview,
} from "@/lib/market/transfermarkt-sell-service";
import type {
  TransferHistoryReadParams,
  TransferHistoryReadResult,
} from "@/lib/market/transfer-history-read-service";
import type {
  TransfermarktFreeAgentItem,
  TransfermarktReadParams,
  TransfermarktReadResult,
} from "@/lib/market/transfermarkt-read-service";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

const LOCAL_SELL_WINDOW_PHASES = new Set<NonNullable<GameState["gamePhase"]>>([
  "season_completed",
  "season_review",
  "season_rewards",
  "player_development",
  "preseason_management",
  "transfer_sell_phase",
]);

const LOCAL_SYSTEM_SELL_SOURCES = new Set([
  "ai_preseason_market_sell",
  // Organic-squad-builder season-end sell cycle (flag OLY_ORGANIC_SQUAD_BUILDER). Like the other
  // AI-driven batch sell sources it runs inside the season_end transfer-window session, so it must
  // bypass the interactive sell-window gate — otherwise every organic sell is blocked with
  // "sell_only_at_season_end" and no trader/surplus flip ever executes across seasons.
  "ai_organic_squad_sell",
  // Weak-team upgrade swap (flag OLY_WEAK_TEAM_UPGRADE_SWAP): a distinct source for the season-end
  // hoarder churn-out so it is countable/auditable separately from ordinary surplus/profit sells.
  "ai_organic_squad_upgrade_sell",
  "emergency_negative_cash_liquidation",
  "preseason_proactive_cash_recovery_sell",
  "full_churn_roster_sell",
  "identity_vd_women_only_repair",
  "season1_autoprep_topup",
]);

function isLocalTransferSellWindowOpen(gameState: GameState) {
  if (isTransferSellPhaseOpen(gameState)) {
    return true;
  }
  const phase = gameState.gamePhase ?? "season_active";
  if (phase !== "season_active") {
    return false;
  }

  const matchdayIds = gameState.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1] ?? gameState.matchdayState.matchdayId;
  const lastFixtures = gameState.seasonState.schedule.filter((fixture) => fixture.matchdayId === lastMatchdayId);
  const lastFixturesResolved = lastFixtures.length === 0 || lastFixtures.every((fixture) => fixture.status === "resolved");
  const hasLastMatchdayResult = (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandingsApply = (gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === gameState.season.id && log.matchdayId === lastMatchdayId,
  );
  const activeMatchdayIsLast =
    gameState.matchdayState.matchdayId === lastMatchdayId || gameState.season.currentMatchday >= matchdayIds.length;

  return activeMatchdayIsLast &&
    gameState.matchdayState.status === "resolved" &&
    (lastFixturesResolved || (hasLastMatchdayResult && hasLastStandingsApply));
}

function isSystemTransferSellSource(source: string | null | undefined) {
  return typeof source === "string" && LOCAL_SYSTEM_SELL_SOURCES.has(source);
}

function buildDiverseFreeAgentSlice(items: TransfermarktFreeAgentItem[], limit: number) {
  const bySportProfile = [...items].sort((left, right) => {
    const priceDelta = (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY);
    if (priceDelta !== 0) {
      return priceDelta;
    }
    const leftAxisAverage = ((left.pow ?? 0) + (left.spe ?? 0) + (left.men ?? 0) + (left.soc ?? 0)) / 4;
    const rightAxisAverage = ((right.pow ?? 0) + (right.spe ?? 0) + (right.men ?? 0) + (right.soc ?? 0)) / 4;
    const axisDelta = rightAxisAverage - leftAxisAverage;
    if (axisDelta !== 0) {
      return axisDelta;
    }
    return left.name.localeCompare(right.name, "de", { numeric: true, sensitivity: "base" });
  });

  const classBuckets = new Map<string, TransfermarktFreeAgentItem[]>();
  for (const item of bySportProfile) {
    const key = item.className.trim().toLowerCase() || "unknown";
    const bucket = classBuckets.get(key) ?? [];
    bucket.push(item);
    classBuckets.set(key, bucket);
  }

  const orderedBuckets = [...classBuckets.entries()]
    .sort((left, right) => right[1].length - left[1].length)
    .map(([, bucket]) => bucket);

  const selected: TransfermarktFreeAgentItem[] = [];
  const seen = new Set<string>();
  const add = (item: TransfermarktFreeAgentItem | undefined) => {
    if (!item || seen.has(item.playerId) || selected.length >= limit) {
      return;
    }
    selected.push(item);
    seen.add(item.playerId);
  };

  const sportProfileTarget = Math.min(limit, Math.ceil(limit * 0.55));
  for (const item of bySportProfile) {
    add(item);
    if (selected.length >= sportProfileTarget) {
      break;
    }
  }

  let didAdd = true;

  while (selected.length < limit && didAdd) {
    didAdd = false;
    for (const bucket of orderedBuckets) {
      const next = bucket.shift();
      if (!next) {
        continue;
      }
      const before = selected.length;
      add(next);
      didAdd = didAdd || selected.length > before;
      if (selected.length >= limit) {
        break;
      }
    }
  }

  for (const item of bySportProfile) {
    add(item);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function buildAiPreviewFreeAgentSlice(items: TransfermarktFreeAgentItem[], limit: number) {
  const selected: TransfermarktFreeAgentItem[] = [];
  const seen = new Set<string>();
  const add = (item: TransfermarktFreeAgentItem | undefined) => {
    if (!item || seen.has(item.playerId) || selected.length >= limit) {
      return;
    }
    selected.push(item);
    seen.add(item.playerId);
  };

  const affordableCoverageTarget = Math.min(limit, Math.max(40, Math.ceil(limit * 0.35)));
  const affordableByValue = [...items]
    .filter((item) => item.marketValue != null && item.marketValue <= 35)
    .sort((left, right) => {
      const priceDelta = (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY);
      if (priceDelta !== 0) return priceDelta;
      const leftAxisAverage = ((left.pow ?? 0) + (left.spe ?? 0) + (left.men ?? 0) + (left.soc ?? 0)) / 4;
      const rightAxisAverage = ((right.pow ?? 0) + (right.spe ?? 0) + (right.men ?? 0) + (right.soc ?? 0)) / 4;
      return rightAxisAverage - leftAxisAverage;
    });

  for (const item of affordableByValue) {
    add(item);
    if (selected.length >= affordableCoverageTarget) {
      break;
    }
  }

  for (const item of buildDiverseFreeAgentSlice(items, limit)) {
    add(item);
  }

  for (const item of affordableByValue) {
    add(item);
  }

  return selected;
}

const localFreeAgentBaseCache = new Map<string, TransfermarktFreeAgentItem[]>();

type TransfermarktFreeAgentBrowseIndexEntry = Pick<
  TransfermarktFreeAgentItem,
  | "playerId"
  | "name"
  | "className"
  | "race"
  | "alignment"
  | "gender"
  | "subclasses"
  | "traitsPositive"
  | "traitsNegative"
  | "marketValue"
  | "salary"
  | "bracket"
  | "mercenary"
  | "pow"
  | "spe"
  | "men"
  | "soc"
>;

const localFreeAgentBrowseIndexCache = new Map<string, TransfermarktFreeAgentBrowseIndexEntry[]>();
const localMarketContextCache = new Map<string, LocalMarketContext>();
const localMarketContextKeyCache = new WeakMap<GameState, string>();
const localNegotiationPreviewCache = new Map<string, ReturnType<typeof buildContractNegotiationPreview>>();

const getPlayerMarketValue = (player: Player) => resolvePlayerEconomyContract({ player }).marketValue;
const getPlayerSalary = (player: Player) => resolvePlayerEconomyContract({ player }).salary;

function getQuickPotentialBand(score: number | null | undefined) {
  const value = typeof score === "number" && Number.isFinite(score) ? score : 0;
  if (value >= 88) return "elite" as const;
  if (value >= 72) return "high" as const;
  if (value >= 50) return "medium" as const;
  return "low" as const;
}

function mapStarScoutingFields(snapshot: PlayerStarScoutingSnapshot) {
  return {
    axisStarsDisplay: snapshot.revealedCurrentStars.displayLabel,
    axisStarsOverall: snapshot.revealedCurrentStars.overall,
    axisStarsPow: snapshot.revealedCurrentStars.pow,
    axisStarsSpe: snapshot.revealedCurrentStars.spe,
    axisStarsMen: snapshot.revealedCurrentStars.men,
    axisStarsSoc: snapshot.revealedCurrentStars.soc,
    potentialStarsDisplay: snapshot.revealedPotentialStars.displayLabel,
    potentialStarsMin: snapshot.revealedPotentialStars.overallMin,
    potentialStarsMax: snapshot.revealedPotentialStars.overallMax,
    potentialGapStars: snapshot.potentialGap,
  };
}

function buildStarFieldsForPlayer(input: {
  gameState: GameState;
  player: Player;
  saveId: string;
  scoutingLevel: number;
}) {
  if (input.scoutingLevel <= 0) {
    return {
      axisStarsDisplay: "Scouting nötig",
      axisStarsOverall: null,
      axisStarsPow: null,
      axisStarsSpe: null,
      axisStarsMen: null,
      axisStarsSoc: null,
      potentialStarsDisplay: "Potenzial unbekannt",
      potentialStarsMin: null,
      potentialStarsMax: null,
      potentialGapStars: null,
    };
  }
  return mapStarScoutingFields(
    buildPlayerStarScoutingSnapshot({
      gameState: input.gameState,
      player: input.player,
      saveId: input.saveId,
      scoutingLevel: input.scoutingLevel,
    }),
  );
}

function getQuickProgressionTier(score: number | null | undefined): TransfermarktFreeAgentItem["currentAbilityTier"] {
  const value = typeof score === "number" && Number.isFinite(score) ? score : 0;
  if (value >= 99) return "99";
  return getTransfermarktTierFromPoints(value) as TransfermarktFreeAgentItem["currentAbilityTier"];
}

export type LocalTransfermarktRunContext = {
  persistence: PersistenceService;
  save: PersistedSaveGame;
  deferredWrites: number;
  pendingDerivationPlayerIds: string[];
};

function trackDerivationPlayerId(context: LocalTransfermarktRunContext, playerId: string) {
  if (!context.pendingDerivationPlayerIds.includes(playerId)) {
    context.pendingDerivationPlayerIds.push(playerId);
  }
}

function persistTransfermarktGameState(
  persistence: PersistenceService,
  saveId: string,
  gameState: GameState,
  affectedPlayerIds: string[] = [],
) {
  const materialized = withIncrementalSeasonDerivationsAfterTransfer(gameState, affectedPlayerIds);
  return persistence.saveSingleplayerState(saveId, materialized);
}

function getPlayerPotentialCacheSignature(gameState: GameState) {
  return (gameState.playerPotential ?? [])
    .map((entry) => `${entry.playerId}:${entry.hiddenPotentialScore ?? "-"}:${entry.confidence ?? 0}:${entry.source}`)
    .sort()
    .join("|");
}

function getPlayerMarketCacheSignature(gameState: GameState) {
  return gameState.players
    .map((player) =>
      [
        player.id,
        player.name,
        player.className,
        player.race,
        getPlayerMarketValue(player) ?? "-",
        getPlayerSalary(player) ?? "-",
        player.coreStats.pow,
        player.coreStats.spe,
        player.coreStats.men,
        player.coreStats.soc,
      ].join(":"),
    )
    .sort()
    .join("|");
}

function normalizeTransfermarktTier(value: string | null | undefined): TransfermarktRatingTier | null {
  if (!value) {
    return null;
  }

  return ["S+", "S", "A", "B", "C", "D", "E", "F"].includes(value)
    ? (value as TransfermarktRatingTier)
    : null;
}

type NeedAxis = "pow" | "spe" | "men" | "soc";

function getNeedMatchLabel(score: number | null) {
  if (score == null) {
    return null;
  }
  if (score >= 72) return "Top-Bedarf";
  if (score >= 48) return "guter Bedarf";
  if (score >= 26) return "situativ";
  return "kaum Bedarf";
}

function getNeedMatchTone(score: number | null): TransfermarktFreeAgentItem["needMatchTone"] {
  if (score == null) {
    return null;
  }
  if (score >= 72) return "strong";
  if (score >= 48) return "good";
  if (score >= 26) return "thin";
  return "none";
}

function buildNeedMatchSignal(input: {
  item: Pick<TransfermarktFreeAgentItem, "pow" | "spe" | "men" | "soc" | "preferredDisciplineIds" | "bracket" | "marketValueSalaryRatio">;
  needs: AiNeedSummary | null;
  rosterCount: number;
  playerMin: number | null;
  playerOpt: number | null;
}) {
  if (!input.needs) {
    return {
      needMatchScore: null,
      needMatchLabel: null,
      needMatchTone: null,
      needMatchAxes: [],
      needMatchReasons: [],
      needMatchBreakdown: null,
    };
  }

  const axisValues: Record<NeedAxis, number> = {
    pow: input.item.pow ?? 0,
    spe: input.item.spe ?? 0,
    men: input.item.men ?? 0,
    soc: input.item.soc ?? 0,
  };
  const identityAxisEntries = (Object.entries(input.needs.identityAxisWeights) as Array<[NeedAxis, number]>)
    .sort((left, right) => right[1] - left[1]);
  const axisNeedEntries = (Object.entries(input.needs.axisDeficits) as Array<[NeedAxis, number]>)
    .filter(([, deficit]) => deficit > 0.04)
    .sort((left, right) => right[1] - left[1]);
  const identityFitScore = identityAxisEntries.reduce((sum, [axis, weight], index) => {
    const axisValue = axisValues[axis];
    const normalized = Math.max(0, Math.min(1, (axisValue - 35) / 30));
    const priorityMultiplier = index === 0 ? 1.18 : index === 1 ? 1.02 : 0.76;
    return sum + weight * normalized * 38 * priorityMultiplier;
  }, 0);
  const weightedAxisScore = axisNeedEntries.reduce((sum, [axis, deficit], index) => {
    const axisValue = axisValues[axis];
    const normalized = Math.max(0, Math.min(1, (axisValue - 38) / 34));
    const specialistLift = Math.max(0, axisValue - 58) / 26;
    const priorityMultiplier = index === 0 ? 1.24 : index === 1 ? 1.08 : 0.92;
    return sum + deficit * normalized * 34 * priorityMultiplier + specialistLift * deficit * 10;
  }, 0);
  const bestAxisValue = Math.max(axisValues.pow, axisValues.spe, axisValues.men, axisValues.soc);
  const averageAxisValue = (axisValues.pow + axisValues.spe + axisValues.men + axisValues.soc) / 4;
  const rosterGapScore = input.needs.rosterGap * Math.max(0, Math.min(15, (averageAxisValue - 34) / 4.5));
  const belowMinimumPressure =
    input.playerMin != null && input.rosterCount < input.playerMin
      ? Math.max(0, Math.min(1, (input.playerMin - input.rosterCount) / Math.max(input.playerMin, 1)))
      : 0;
  const depthQualityScore =
    belowMinimumPressure > 0
      ? (3 + Math.max(0, Math.min(5, (bestAxisValue - 42) / 8)) + Math.max(0, Math.min(4, (input.item.marketValueSalaryRatio ?? 0) * 0.8))) *
        belowMinimumPressure
      : 0;
  const preferredDisciplineScore = input.item.preferredDisciplineIds.some((disciplineId) => input.needs?.topNeedDisciplineIds.includes(disciplineId))
    ? 10
    : 0;
  const valueReliefScore = input.item.marketValueSalaryRatio != null ? Math.min(8, input.item.marketValueSalaryRatio * 1.1) : 0;
  const premiumOverfillPenalty =
    input.playerOpt != null &&
    input.rosterCount >= input.playerOpt &&
    input.item.bracket != null &&
    input.item.bracket <= 2
      ? 10
      : 0;
  const score = roundValue(
    Math.max(
      0,
      Math.min(
        100,
        identityFitScore +
          weightedAxisScore +
          rosterGapScore +
          depthQualityScore +
          preferredDisciplineScore +
          valueReliefScore -
          premiumOverfillPenalty,
      ),
    ),
    1,
  );
  const axes = input.needs.uncoveredNeedAxes
    .filter((axis) => axisValues[axis] >= 45)
    .sort((left, right) => (input.needs?.axisDeficits[right] ?? 0) * axisValues[right] - (input.needs?.axisDeficits[left] ?? 0) * axisValues[left])
    .slice(0, 3);
  const reasons: string[] = [];
  if (axes.length > 0) {
    reasons.push(`deckt ${axes.map((axis) => axis.toUpperCase()).join("/")}`);
  }
  if (rosterGapScore >= 3 || depthQualityScore >= 4) {
    reasons.push("gute Kader-Tiefe");
  }
  if (preferredDisciplineScore > 0) {
    reasons.push("trifft Top-Diszi-Bedarf");
  }
  if (valueReliefScore >= 4) {
    reasons.push("gutes MW/Gehalt");
  }
  if (premiumOverfillPenalty > 0) {
    reasons.push("Premium bei vollem Kader");
  }

  return {
    needMatchScore: score,
    needMatchLabel: getNeedMatchLabel(score),
    needMatchTone: getNeedMatchTone(score),
    needMatchAxes: axes,
    needMatchReasons: reasons,
    needMatchBreakdown: {
      identityFitScore: roundValue(identityFitScore, 1),
      axisScore: roundValue(weightedAxisScore, 1),
      rosterGapScore: roundValue(rosterGapScore, 1),
      depthQualityScore: roundValue(depthQualityScore, 1),
      preferredDisciplineScore: roundValue(preferredDisciplineScore, 1),
      valueReliefScore: roundValue(valueReliefScore, 1),
      premiumOverfillPenalty: roundValue(premiumOverfillPenalty, 1),
      totalScore: score,
    },
  };
}

function getTeamRosterCacheSignature(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => `${entry.id}:${entry.playerId}:${entry.salary}:${entry.currentValue ?? "-"}:${entry.contractLength}:${entry.contractShape ?? "-"}:${entry.yearlySalarySchedule?.map((row) => row.salary).join(",") ?? "-"}`)
    .sort()
    .join("|");
}

function getRosterPlayers(playersById: Map<string, Player>, rosterEntries: RosterEntry[]) {
  return rosterEntries
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
}

function getVisibleRosterSalaryTotal(rosterPlayers: Array<{ entry: RosterEntry; player: Player }>) {
  return roundValue(
    rosterPlayers.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
      0,
    ),
    2,
  );
}

function getVisibleRosterMarketValueTotal(rosterPlayers: Array<{ entry: RosterEntry; player: Player }>) {
  return roundValue(
    rosterPlayers.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
      0,
    ),
    2,
  );
}

function getTopDisciplineScores(input: {
  saveId: string;
  disciplinesById: Map<string, string>;
  disciplinePlayerCountById?: Map<string, number | null>;
  teamDisciplineRankById?: Map<string, number | null>;
  player: Player;
  scoutingLevel?: number | null;
}) {
  return buildScoutedDisciplineTiers({
    saveId: input.saveId,
    playerId: input.player.id,
    scoutingLevel: input.scoutingLevel,
    disciplines: Object.entries(input.player.disciplineRatings).map(([disciplineId, score]) => ({
      disciplineId,
      disciplineName: input.disciplinesById.get(disciplineId) ?? disciplineId,
      score,
    })),
    topN: 5,
  }).map((entry) => ({
    disciplineId: entry.disciplineId,
    disciplineName: entry.disciplineName,
    scoreTier: entry.scoreTier,
    displayedScore: entry.displayedScore,
    ppsLastSeason: null,
    playerCount: input.disciplinePlayerCountById?.get(entry.disciplineId) ?? null,
    teamRank: input.teamDisciplineRankById?.get(entry.disciplineId) ?? null,
  }));
}

function buildLocalTeamDisciplineRankMap(gameState: GameState, teamId: string) {
  const disciplineIds = gameState.disciplines.map((discipline) => discipline.id);
  const scoreByPlayerAndDiscipline = new Map<string, number>();
  for (const player of gameState.players) {
    Object.entries(player.disciplineRatings ?? {}).forEach(([disciplineId, score]) => {
      if (typeof score === "number" && Number.isFinite(score)) {
        scoreByPlayerAndDiscipline.set(`${player.id}::${disciplineId}`, score);
      }
    });
  }
  const ranks = computeTeamDisciplineRanks({
    teamId,
    teamIds: gameState.teams.map((team) => team.teamId),
    disciplineIds,
    rosterAssignments: gameState.rosters.map((entry) => ({
      teamId: entry.teamId,
      playerId: entry.playerId,
    })),
    scoreByPlayerAndDiscipline,
  });
  return new Map(Object.entries(ranks).map(([disciplineId, rankEntry]) => [disciplineId, rankEntry.rank ?? null] as const));
}

function derivePromisedRoleForBuy(input: {
  explicitRole?: RosterPromisedRole | null;
  contractLength: number;
  purchasePrice: number | null;
  rosterBefore: number;
}): RosterPromisedRole {
  if (input.explicitRole) {
    return input.explicitRole;
  }

  if (input.contractLength >= 4 || (input.purchasePrice ?? 0) >= 35 || input.rosterBefore < 6) {
    return "starter";
  }
  if (input.contractLength >= 2 || (input.purchasePrice ?? 0) >= 18) {
    return "rotation";
  }
  return "prospect";
}

function resolveLocalSave(saveId?: string) {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = saveId ? persistence.getSaveById(saveId) : null;
  if (saveId && !requestedSave) {
    throw new Error(`SQLite save ${saveId} could not be resolved.`);
  }
  const save =
    requestedSave ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return { persistence, save };
}

function getLocalRunContext(params: { localRunContext?: unknown }): LocalTransfermarktRunContext | null {
  const candidate = params.localRunContext as LocalTransfermarktRunContext | null | undefined;
  if (!candidate || typeof candidate !== "object" || !candidate.save || !candidate.persistence) {
    return null;
  }
  return candidate;
}

export function createLocalTransfermarktRunContext(input: {
  save: PersistedSaveGame;
  persistence?: PersistenceService;
}): LocalTransfermarktRunContext {
  return {
    persistence: input.persistence ?? createPersistenceService(),
    save: input.save,
    deferredWrites: 0,
    pendingDerivationPlayerIds: [],
  };
}

export function flushLocalTransfermarktRunContext(context: LocalTransfermarktRunContext) {
  context.save = persistTransfermarktGameState(
    context.persistence,
    context.save.saveId,
    context.save.gameState,
    context.pendingDerivationPlayerIds,
  );
  context.deferredWrites = 0;
  context.pendingDerivationPlayerIds = [];
  return context.save;
}

type LocalTransfermarktBuyContext = {
  marketContext: LocalMarketContext;
  save: ReturnType<typeof resolveLocalSave>["save"];
  gameState: GameState;
  team: GameState["teams"][number] | null;
  player: Player | null;
  teamIdentity: GameState["teamIdentities"][number] | null;
  teamStrategyProfile: ReturnType<typeof getTeamStrategyProfile> | null;
  teamRoster: RosterEntry[];
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
  playerAlreadyOwned: boolean;
  recentlySoldBySameTeam: ReturnType<typeof getRecentlySoldBySameTeam>;
  purchasePrice: number | null;
  marketValueReference: number | null;
  salary: number | null;
  cashBefore: number | null;
  salaryBefore: number | null;
  marketValueBefore: number | null;
  rosterBefore: number;
  contractLength: number;
  contractShape: ContractShape;
  priorRejectedNegotiation: boolean;
  promisedRole: RosterPromisedRole;
  blockingReasons: string[];
  warnings: string[];
};

type LocalTeamMarketContext = {
  team: GameState["teams"][number];
  teamIdentity: GameState["teamIdentities"][number] | null;
  teamStrategyProfile: ReturnType<typeof getTeamStrategyProfile>;
  rosterEntries: RosterEntry[];
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
  visiblePlayers: Player[];
  rosterCount: number;
  salaryTotal: number;
  marketValueTotal: number;
  playerMin: number | null;
  playerOpt: number | null;
  cash: number;
  rosterCacheSignature: string;
};

type LocalMarketContext = {
  save: ReturnType<typeof resolveLocalSave>["save"];
  gameState: GameState;
  playersById: Map<string, Player>;
  teamsById: Map<string, GameState["teams"][number]>;
  teamIdentityById: Map<string, GameState["teamIdentities"][number]>;
  disciplinesById: Map<string, string>;
  rosterPlayerIds: Set<string>;
  rostersByTeamId: Map<string, RosterEntry[]>;
  teamContextsById: Map<string, LocalTeamMarketContext>;
  cacheKey: string;
};

function getLocalMarketContextKey(save: ReturnType<typeof resolveLocalSave>["save"]) {
  const gameState = save.gameState;
  const cached = localMarketContextKeyCache.get(gameState);
  if (cached) {
    return cached;
  }

  const cacheKey = [
    save.saveId,
    buildGameStateContentSignature(gameState),
    gameState.season.id,
    gameState.players.length,
    gameState.rosters.length,
    gameState.transferHistory.length,
    getPlayerPotentialCacheSignature(gameState),
    getPlayerMarketCacheSignature(gameState),
  ].join(":");
  localMarketContextKeyCache.set(gameState, cacheKey);
  return cacheKey;
}

function buildLocalMarketContext(save: ReturnType<typeof resolveLocalSave>["save"]): LocalMarketContext {
  const gameState = save.gameState;
  const cacheKey = getLocalMarketContextKey(save);
  const cached = localMarketContextCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const teamIdentityById = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  const disciplinesById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.name] as const));
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of gameState.rosters) {
    const roster = rostersByTeamId.get(rosterEntry.teamId);
    if (roster) {
      roster.push(rosterEntry);
    } else {
      rostersByTeamId.set(rosterEntry.teamId, [rosterEntry]);
    }
  }

  const teamContextsById = new Map<string, LocalTeamMarketContext>();
  for (const team of gameState.teams) {
    const rosterEntries = rostersByTeamId.get(team.teamId) ?? [];
    const rosterPlayers = getRosterPlayers(playersById, rosterEntries);
    const teamIdentity = teamIdentityById.get(team.teamId) ?? null;
    teamContextsById.set(team.teamId, {
      team,
      teamIdentity,
      teamStrategyProfile: getTeamStrategyProfile(gameState, team.teamId),
      rosterEntries,
      rosterPlayers,
      visiblePlayers: rosterPlayers.map((item) => item.player),
      rosterCount: rosterEntries.length,
      salaryTotal: getVisibleRosterSalaryTotal(rosterPlayers),
      marketValueTotal: getVisibleRosterMarketValueTotal(rosterPlayers),
      playerMin: teamIdentity?.playerMin ?? null,
      playerOpt: teamIdentity?.playerOpt ?? null,
      cash: team.cash,
      rosterCacheSignature: getTeamRosterCacheSignature(gameState, team.teamId),
    });
  }

  const context: LocalMarketContext = {
    save,
    gameState,
    playersById,
    teamsById,
    teamIdentityById,
    disciplinesById,
    rosterPlayerIds,
    rostersByTeamId,
    teamContextsById,
    cacheKey,
  };
  localMarketContextCache.set(cacheKey, context);
  return context;
}

function buildLocalTransfermarktBuyPreviewFromContext(
  params: TransfermarktBuyParams,
  context: LocalTransfermarktBuyContext,
): TransfermarktBuyPreview {
  const {
    marketContext,
    gameState,
    team,
    player,
    teamIdentity,
    teamStrategyProfile,
    rosterPlayers,
    purchasePrice,
    marketValueReference,
    salary,
    cashBefore,
    salaryBefore,
    marketValueBefore,
    rosterBefore,
    contractLength,
    contractShape,
    promisedRole,
    blockingReasons,
    warnings,
    priorRejectedNegotiation,
  } = context;
  const canBuy = blockingReasons.length === 0;
  const scoutingLevel = team ? getFacilityLevel(getTeamFacilityState(gameState, team.teamId), "scouting_office") : 0;
  const negotiationCacheKey = [
    marketContext.cacheKey,
    params.teamId,
    params.playerId,
    contractLength,
    contractShape,
    params.offeredSalary ?? salary ?? "-",
    scoutingLevel,
    priorRejectedNegotiation ? "prior_rejected" : "fresh",
    params.saveId ?? marketContext.save.saveId,
  ].join(":");
  let negotiationPreview = localNegotiationPreviewCache.get(negotiationCacheKey);
  if (!negotiationPreview) {
    negotiationPreview = buildContractNegotiationPreview({
      saveId: params.saveId,
      seasonId: gameState.season.id,
      teamId: params.teamId,
      team,
      teamIdentity,
      teamStrategyProfile,
      player,
      rosterPlayers: rosterPlayers.map((item) => item.player),
      contractLength,
      contractShape,
      offeredSalary: params.offeredSalary ?? null,
      scoutingLevel,
      priorBadExperience: priorRejectedNegotiation,
      seasonIdBase: gameState.season.id,
      seasonLabelBase: gameState.season.name,
    });
    localNegotiationPreviewCache.set(negotiationCacheKey, negotiationPreview);
  }
  const contractSalary = negotiationPreview.offeredSalary ?? salary;

  return {
    canBuy,
    blockingReasons,
    warnings,
    player: player
      ? {
          id: player.id,
          name: player.name,
          className: player.className,
          race: player.race,
        }
      : null,
    team: team
      ? {
          id: team.teamId,
          name: team.name,
          shortCode: team.shortCode,
        }
      : null,
    cashBefore,
    cashAfter: canBuy && cashBefore != null && purchasePrice != null ? cashBefore - purchasePrice : cashBefore,
    salaryBefore,
    salaryAfter: canBuy && salaryBefore != null && contractSalary != null ? salaryBefore + contractSalary : salaryBefore,
    marketValueBefore,
    marketValueAfter: canBuy && marketValueBefore != null && marketValueReference != null ? marketValueBefore + marketValueReference : marketValueBefore,
    rosterBefore,
    rosterAfter: canBuy ? rosterBefore + 1 : rosterBefore,
    purchasePrice,
    salary,
    contractLength,
    contractShape,
    promisedRole,
    currentValue: marketValueReference ?? purchasePrice,
    joinedSeasonId: gameState.season.id,
    expectedSalary: negotiationPreview.expectedSalary,
    baseExpectedSalary: negotiationPreview.baseExpectedSalary,
    demandMultiplier: negotiationPreview.demandMultiplier,
    offeredSalary: negotiationPreview.offeredSalary,
    offerRatio: negotiationPreview.offerRatio,
    yearlySalarySchedule: negotiationPreview.yearlySalarySchedule,
    totalSalary: negotiationPreview.totalSalary,
    roundingAdjustment: negotiationPreview.roundingAdjustment,
    buyoutCost: negotiationPreview.buyoutCost,
    bracket: negotiationPreview.bracket,
    teamFit: negotiationPreview.teamFit,
    acceptanceScore: negotiationPreview.acceptanceScore,
    acceptChance: negotiationPreview.acceptChance,
    counterChance: negotiationPreview.counterChance,
    rejectChance: negotiationPreview.rejectChance,
    contractPreference: negotiationPreview.contractPreference,
    demandBreakdown: negotiationPreview.demandBreakdown,
    negotiationScoreBreakdown: negotiationPreview.scoreBreakdown,
    negotiationReasons: negotiationPreview.reasons,
    negotiationWarnings: negotiationPreview.warnings,
    negotiationBlockingReasons: negotiationPreview.blockingReasons,
    dealPressure: buildDealPressureSignal({
      offerRatio: negotiationPreview.offerRatio,
      teamFit: negotiationPreview.teamFit,
      contractLength,
      promisedRole,
      priorRejectedNegotiation,
      acceptChance: negotiationPreview.acceptChance,
      counterChance: negotiationPreview.counterChance,
      rejectChance: negotiationPreview.rejectChance,
    }),
  };
}

function resolveTeamMarketBuySpendableCash(input: {
  gameState: GameState;
  teamId: string;
  teamCash: number;
  rosterBefore: number;
  playerMin: number | null;
}) {
  return resolveMarketSpendableCashForPlanner({
    gameState: input.gameState,
    teamId: input.teamId,
    teamCash: input.teamCash,
    rosterBelowMin: input.playerMin != null && input.rosterBefore < input.playerMin,
  });
}

/** Shared buy affordability ceiling for planner preview, live execute, and buy gate. */
export function resolveTransferBuyAffordabilityCash(input: {
  gameState: GameState;
  teamId: string;
  teamCash: number;
  rosterBefore: number;
  playerMin: number | null;
  seasonId: string;
  transferSource: string | null | undefined;
}) {
  if (input.gameState.season.id === "season-1" && isSeasonOneDraftBuySource(input.transferSource)) {
    return input.teamCash;
  }
  return resolveTeamMarketBuySpendableCash({
    gameState: input.gameState,
    teamId: input.teamId,
    teamCash: input.teamCash,
    rosterBefore: input.rosterBefore,
    playerMin: input.playerMin,
  });
}

function resolveLocalTransfermarktBuyContext(params: TransfermarktBuyParams): LocalTransfermarktBuyContext {
  const runContext = getLocalRunContext(params);
  const save = runContext?.save ?? resolveLocalSave(params.saveId).save;
  const marketContext = buildLocalMarketContext(save);
  const { gameState } = marketContext;
  const teamContext = marketContext.teamContextsById.get(params.teamId) ?? null;
  const team = teamContext?.team ?? null;
  const player = marketContext.playersById.get(params.playerId) ?? null;
  const teamIdentity = teamContext?.teamIdentity ?? null;
  const teamStrategyProfile = teamContext?.teamStrategyProfile ?? null;
  const teamRoster = teamContext?.rosterEntries ?? [];
  const rosterPlayers = teamContext?.rosterPlayers ?? [];
  const playerAlreadyOwned = marketContext.rosterPlayerIds.has(params.playerId);
  const recentlySoldBySameTeam = getRecentlySoldBySameTeam({
    gameState,
    seasonId: gameState.season.id,
    teamId: params.teamId,
    playerId: params.playerId,
  });
  const marketValueReference = player ? getPlayerMarketValue(player) : null;
  const purchasePriceOverride =
    typeof params.purchasePriceOverride === "number" && Number.isFinite(params.purchasePriceOverride)
      ? Math.max(0, roundValue(params.purchasePriceOverride))
      : null;
  const purchasePrice = purchasePriceOverride ?? marketValueReference;
  const baseSalary = player ? getPlayerSalary(player) : null;
  const formerTeamDisposition =
    player && team && !playerAlreadyOwned
      ? assessFreeAgentDispositionTowardTeam({
          gameState,
          playerId: player.id,
          teamId: params.teamId,
        })
      : null;
  const salary =
    baseSalary != null && formerTeamDisposition?.applies
      ? roundValue(baseSalary * formerTeamDisposition.salaryMultiplier, 2)
      : baseSalary;
  const cashBefore = teamContext?.cash ?? null;
  const salaryBefore = teamContext?.salaryTotal ?? 0;
  const marketValueBefore = teamContext?.marketValueTotal ?? 0;
  const rosterBefore = teamContext?.rosterCount ?? 0;
  const recommendedTeamFit =
    team && player
      ? calculateTransfermarktFit(player, teamContext?.visiblePlayers ?? [], { teamId: team.teamId }).teamFit
      : null;
  const recommendedDealRole =
    rosterBefore < (teamContext?.playerMin ?? 0)
      ? "fill"
      : (marketValueReference ?? 0) >= 70
        ? "star"
        : (marketValueReference ?? 0) >= 45
          ? "core"
          : (marketValueReference ?? 0) <= 25
            ? "depth"
            : "rotation";
  const recommendedGmArchetype = getTeamGeneralManager(gameState, params.teamId)?.profile?.archetype ?? null;
  const recommendedContract = recommendContractOfferForPlayer({
    player,
    teamStrategyProfile,
    teamIdentity,
    teamCash: cashBefore,
    marketValue: marketValueReference,
    teamFit: recommendedTeamFit,
    currentTeamSalary: salaryBefore,
    dealRole: recommendedDealRole,
    rosterCountBefore: rosterBefore,
    teamRosterMin: teamContext?.playerMin ?? null,
    teamRosterOpt: teamContext?.playerOpt ?? null,
    isFirstSeason: gameState.season.id === "season-1",
    gmArchetype: recommendedGmArchetype,
    highValue: (marketValueReference ?? 0) >= 35,
  });
  const contractLength =
    typeof params.contractLength === "number" && Number.isFinite(params.contractLength)
      ? Math.max(1, Math.round(params.contractLength))
      : recommendedContract.contractLength;
  const promisedRole = derivePromisedRoleForBuy({
    explicitRole: params.promisedRole ?? null,
    contractLength,
    purchasePrice: marketValueReference ?? purchasePrice,
    rosterBefore,
  });
  const contractShape =
    params.contractShape != null
      ? normalizeContractShape(params.contractShape)
      : recommendedContract.contractShape;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!team) blockingReasons.push("team_not_found");
  if (!player) blockingReasons.push("player_not_found");
  if (playerAlreadyOwned) blockingReasons.push("player_not_free_agent_in_scope");
  const soldThisSeasonCooldownHit = isPlayerTransferBuyBlocked({
    gameState,
    playerId: params.playerId,
  });
  if (soldThisSeasonCooldownHit && !params.bypassSoldThisSeasonCooldown) {
    blockingReasons.push(SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER);
  }
  if (soldThisSeasonCooldownHit && params.bypassSoldThisSeasonCooldown) {
    warnings.push(SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING);
  }
  if (purchasePrice == null || purchasePrice <= 0) blockingReasons.push("market_value_missing");
  if (salary == null || salary <= 0) blockingReasons.push("salary_demand_missing");
  if (team && rosterBefore >= getTeamPlayerMax(team, teamIdentity)) blockingReasons.push("roster_limit_reached");
  if (
    team &&
    purchasePrice != null &&
    resolveTransferBuyAffordabilityCash({
      gameState,
      teamId: params.teamId,
      teamCash: team.cash,
      rosterBefore,
      playerMin: teamContext?.playerMin ?? null,
      seasonId: gameState.season.id,
      transferSource: params.transferSource,
    }) < purchasePrice
  ) {
    blockingReasons.push("insufficient_cash");
  }
  if (recentlySoldBySameTeam && !params.allowRecentlySoldRebuyOverride) {
    blockingReasons.push(RECENTLY_SOLD_SAME_PRESEASON_BLOCKER);
  }
  if (typeof params.contractLength === "number" && contractLength !== recommendedContract.contractLength) {
    warnings.push("contract_length_override_in_effect");
  }
  if (purchasePriceOverride != null) {
    warnings.push(params.purchasePriceOverrideReason ?? "purchase_price_override_in_effect");
  }
  if (recentlySoldBySameTeam && params.allowRecentlySoldRebuyOverride) {
    warnings.push(RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING);
  }
  if (formerTeamDisposition?.blockingReason) {
    blockingReasons.push(formerTeamDisposition.blockingReason);
  }
  if (formerTeamDisposition?.warnings.length) {
    warnings.push(...formerTeamDisposition.warnings);
  }
  const seasonOneMarketBlocker = resolveSeasonOneMarketBuyBlocker(gameState.season.id, params.transferSource);
  if (seasonOneMarketBlocker) {
    blockingReasons.push(seasonOneMarketBlocker);
  }

  const priorRejectedNegotiation = (gameState.seasonState.contractNegotiationDrafts ?? []).some(
    (draft) =>
      draft.teamId === params.teamId &&
      draft.playerId === params.playerId &&
      draft.status === "rejected_bad_experience",
  );

  return {
    marketContext,
    save,
    gameState,
    team,
    player,
    teamIdentity,
    teamStrategyProfile,
    teamRoster,
    rosterPlayers,
    playerAlreadyOwned,
    recentlySoldBySameTeam,
    purchasePrice,
    marketValueReference,
    salary,
    cashBefore,
    salaryBefore,
    marketValueBefore,
    rosterBefore,
    contractLength,
    contractShape,
    promisedRole,
    priorRejectedNegotiation,
    blockingReasons,
    warnings,
  };
}

function normalizeContractShape(value: ContractShape | null | undefined): ContractShape {
  return value === "front_loaded" || value === "back_loaded" ? value : "balanced";
}

function buildDealPressureSignal(input: {
  offerRatio: number | null | undefined;
  teamFit: number | null | undefined;
  contractLength: number;
  promisedRole: RosterPromisedRole;
  priorRejectedNegotiation: boolean;
  acceptChance: number | null | undefined;
  counterChance: number | null | undefined;
  rejectChance: number | null | undefined;
}) {
  const offerRatio = input.offerRatio ?? 1;
  const teamFit = input.teamFit ?? 0;
  const lowOfferPressure = Math.max(0, 1 - offerRatio) * 95;
  const highOfferRelief = Math.max(0, offerRatio - 1) * 45;
  const fitPressure = teamFit < 0 ? Math.min(28, Math.abs(teamFit) * 1.2) : teamFit >= 20 ? -8 : 0;
  const rolePressure = input.promisedRole === "prospect" && input.contractLength >= 3 ? 12 : input.promisedRole === "starter" ? -6 : 0;
  const lengthPressure = input.contractLength >= 4 && teamFit < 18 ? 12 + (input.contractLength - 4) * 6 : 0;
  const trustRisk = Math.max(
    0,
    Math.min(
      100,
      (input.priorRejectedNegotiation ? 36 : 0) +
        lowOfferPressure * 0.45 +
        (input.rejectChance ?? 0) * 0.35 +
        (teamFit < 0 ? Math.abs(teamFit) * 0.8 : 0),
    ),
  );
  const happinessPressure = Math.max(
    0,
    Math.min(100, 26 + lowOfferPressure + fitPressure + rolePressure + lengthPressure - highOfferRelief - (input.acceptChance ?? 0) * 0.2),
  );
  const pushPressure = Math.max(
    0,
    Math.min(100, (input.counterChance ?? 0) * 0.55 + lowOfferPressure * 0.8 + lengthPressure + (input.promisedRole === "starter" ? 4 : 10)),
  );
  const signals: string[] = [];
  if (offerRatio < 1) signals.push("Angebot unter Erwartung");
  if (teamFit < 0) signals.push("negativer Teamfit");
  if (input.priorRejectedNegotiation) signals.push("Trust durch fruehere Absage belastet");
  if (input.contractLength >= 4 && teamFit < 18) signals.push("lange Laufzeit braucht Sicherheit");
  if (input.promisedRole === "prospect" && input.contractLength >= 3) signals.push("Rolle wirkt fuer lange Bindung klein");
  if (signals.length === 0) signals.push("kein auffaelliger Zusatzdruck");

  return {
    happinessPressure: roundValue(happinessPressure, 0),
    trustRisk: roundValue(trustRisk, 0),
    pushPressure: roundValue(pushPressure, 0),
    signals,
  };
}

function buildFreeAgentBrowseIndex(input: {
  gameState: GameState;
  rosterPlayerIds: Set<string>;
  soldPlayerBanIds: Set<string>;
}): TransfermarktFreeAgentBrowseIndexEntry[] {
  return input.gameState.players
    .filter((player) => !input.rosterPlayerIds.has(player.id))
    .filter((player) => !input.soldPlayerBanIds.has(player.id))
    .map((player) => {
      const marketValue = getPlayerMarketValue(player);
      const salary = getPlayerSalary(player);
      const baseTraitView = getScoutedTraitView({
        traitsPositive: player.traitsPositive,
        traitsNegative: player.traitsNegative,
        scoutingLevel: 0,
      });
      return {
        playerId: player.id,
        name: player.name,
        className: player.className,
        race: player.race,
        alignment: player.alignment,
        gender: player.gender,
        subclasses: player.subclasses,
        traitsPositive: baseTraitView.visiblePositiveTraits,
        traitsNegative: baseTraitView.visibleNegativeTraits,
        marketValue,
        salary,
        bracket: getTransfermarktBracket(marketValue),
        mercenary: hasMercenaryTrait({
          traitsPositive: player.traitsPositive,
          traitsNegative: player.traitsNegative,
        }),
        pow: player.coreStats.pow,
        spe: player.coreStats.spe,
        men: player.coreStats.men,
        soc: player.coreStats.soc,
      };
    });
}

function buildCompactFreeAgentItem(input: {
  gameState: GameState;
  player: Player;
  playerPotentialById: Map<string, NonNullable<GameState["playerPotential"]>[number]>;
  browseEntry?: TransfermarktFreeAgentBrowseIndexEntry;
}): TransfermarktFreeAgentItem {
  const { gameState, player, playerPotentialById, browseEntry } = input;
  const marketValue = browseEntry?.marketValue ?? getPlayerMarketValue(player);
  const salary = browseEntry?.salary ?? getPlayerSalary(player);
  const baseTraitView = browseEntry
    ? {
        visiblePositiveTraits: browseEntry.traitsPositive,
        visibleNegativeTraits: browseEntry.traitsNegative,
        // Browse mode shows every trait, so report full (level-5) scouting disclosure
        // instead of the ad-hoc partial object this used to build (which mismatched
        // TransfermarktScoutingDisclosure's shape: negativeTraitsVisible is a boolean
        // gate, not a trait count, and `level`/`exactAttributeValuesVisible` were missing).
        disclosure: getTransfermarktScoutingDisclosure(5),
        hiddenPositiveTraitCount: 0,
        hiddenNegativeTraitCount: 0,
      }
    : getScoutedTraitView({
        traitsPositive: player.traitsPositive,
        traitsNegative: player.traitsNegative,
        scoutingLevel: 0,
      });
  const potentialRecord = playerPotentialById.get(player.id) ?? null;
  const quickPotentialScore = potentialRecord?.hiddenPotentialScore ?? player.potential ?? player.rating;

  return {
    playerId: player.id,
    name: player.name,
    className: player.className,
    race: player.race,
    alignment: player.alignment,
    gender: player.gender,
    subclasses: player.subclasses,
    traitsPositive: baseTraitView.visiblePositiveTraits,
    traitsNegative: baseTraitView.visibleNegativeTraits,
    preferredDisciplineIds: [],
    scoutingLevel: 0,
    scoutingDisclosure: baseTraitView.disclosure,
    hiddenPositiveTraitCount: baseTraitView.hiddenPositiveTraitCount,
    hiddenNegativeTraitCount: baseTraitView.hiddenNegativeTraitCount,
    preferredDisciplineIdsVisible: false,
    subclass1: player.subclasses[0] ?? null,
    subclass2: player.subclasses[1] ?? null,
    subclass3: player.subclasses[2] ?? null,
    traitPos1: baseTraitView.visiblePositiveTraits[0] ?? null,
    traitPos2: baseTraitView.visiblePositiveTraits[1] ?? null,
    traitPos3: baseTraitView.visiblePositiveTraits[2] ?? null,
    traitNeg1: baseTraitView.visibleNegativeTraits[0] ?? null,
    traitNeg2: baseTraitView.visibleNegativeTraits[1] ?? null,
    traitNeg3: baseTraitView.visibleNegativeTraits[2] ?? null,
    marketValue,
    ovr: player.rating ?? null,
    mvs: null,
    salary,
    marketValueSalaryRatio:
      marketValue != null && salary != null && salary > 0 ? roundValue(marketValue / salary, 2) : null,
    bracket: getTransfermarktBracket(marketValue),
    salaryStatus: salary != null ? "known" : "missing",
    pow: browseEntry?.pow ?? player.coreStats.pow,
    spe: browseEntry?.spe ?? player.coreStats.spe,
    men: browseEntry?.men ?? player.coreStats.men,
    soc: browseEntry?.soc ?? player.coreStats.soc,
    powTier: getTransfermarktTierFromPoints(player.coreStats.pow),
    speTier: getTransfermarktTierFromPoints(player.coreStats.spe),
    menTier: getTransfermarktTierFromPoints(player.coreStats.men),
    socTier: getTransfermarktTierFromPoints(player.coreStats.soc),
    above20: player.disciplineTierCounts.above20,
    above40: player.disciplineTierCounts.above40,
    above60: player.disciplineTierCounts.above60,
    above80: player.disciplineTierCounts.above80,
    powerRating: normalizeTransfermarktTier(player.attributeSheetRatings?.powerRating),
    healthRating: normalizeTransfermarktTier(player.attributeSheetRatings?.healthRating),
    staminaRating: normalizeTransfermarktTier(player.attributeSheetRatings?.staminaRating),
    intelligenceRating: normalizeTransfermarktTier(player.attributeSheetRatings?.intelligenceRating),
    determinationRating: normalizeTransfermarktTier(player.attributeSheetRatings?.determinationRating),
    awarenessRating: normalizeTransfermarktTier(player.attributeSheetRatings?.awarenessRating),
    speedRating: normalizeTransfermarktTier(player.attributeSheetRatings?.speedRating),
    dexterityRating: normalizeTransfermarktTier(player.attributeSheetRatings?.dexterityRating),
    charismaRating: normalizeTransfermarktTier(player.attributeSheetRatings?.charismaRating),
    willRating: normalizeTransfermarktTier(player.attributeSheetRatings?.willRating),
    spiritRating: normalizeTransfermarktTier(player.attributeSheetRatings?.spiritRating),
    tormentRating: normalizeTransfermarktTier(player.attributeSheetRatings?.tormentRating),
    attributeStatValues: null,
    topDisciplineScores: [],
    currentAbilityTier: getQuickProgressionTier(player.rating),
    potentialTier: getQuickProgressionTier(quickPotentialScore),
    potentialBand: potentialRecord?.potentialBand ?? getQuickPotentialBand(quickPotentialScore),
    potentialRange: potentialRecord?.revealedPotentialRange ?? null,
    axisStarsDisplay: "Scouting nötig",
    axisStarsOverall: null,
    axisStarsPow: null,
    axisStarsSpe: null,
    axisStarsMen: null,
    axisStarsSoc: null,
    potentialStarsDisplay: "Potenzial unbekannt",
    potentialStarsMin: null,
    potentialStarsMax: null,
    potentialGapStars: null,
    scoutingConfidence: potentialRecord?.confidence ?? null,
    scoutingSource: potentialRecord?.source ?? "generated",
    scoutingWarnings: [],
    marketValuePotentialPremiumPct: null,
    trainingFormTier: null,
    developmentTrend: null,
    developmentRoute: null,
    regressionRisk: null,
    portraitPath: player.portraitPath ?? null,
    portraitUrl: player.portraitUrl ?? null,
    imageUrl: null,
    availabilityReason: "free_agent",
    teamContextAvailable: false,
    teamCash: null,
    teamSalary: null,
    rosterCount: null,
    playerMin: null,
    playerOpt: null,
    readinessStatus: "unknown",
    affordabilityStatus: null,
    rosterPressureStatus: null,
    fitRace: null,
    fitSubclasses: null,
    fitTraits: null,
    fitAlignment: null,
    mercenary: hasMercenaryTrait({
      traitsPositive: player.traitsPositive,
      traitsNegative: player.traitsNegative,
    }),
    fit: null,
    fitDisplay: "Team waehlen",
    fitSource: "select_team_for_fit",
    needMatchScore: null,
    needMatchLabel: null,
    needMatchTone: null,
    needMatchAxes: [],
    needMatchReasons: [],
  };
}

export function listLocalTransfermarktFreeAgents(input: TransfermarktReadParams = {}): TransfermarktReadResult {
  const runContext = getLocalRunContext(input);
  const save = runContext?.save ?? resolveLocalSave(input.saveId ?? undefined).save;
  const marketContext = buildLocalMarketContext(save);
  const { gameState, playersById, disciplinesById, rosterPlayerIds, cacheKey } = marketContext;
  const aiPreviewMode = input.mode === "ai_preview";
  const compactListMode = input.compactList !== false && input.mode !== "full";
  const skipHeavyBaseFields = aiPreviewMode || compactListMode;
  const selectedTeamContext = input.teamId ? marketContext.teamContextsById.get(input.teamId) ?? null : null;
  const selectedTeam = selectedTeamContext?.team ?? null;
  const teamSalary = selectedTeamContext?.salaryTotal ?? 0;
  const rosterCount = selectedTeamContext?.rosterCount ?? 0;
  const playerMin = selectedTeamContext?.playerMin ?? null;
  const playerOpt = selectedTeamContext?.playerOpt ?? null;
  const seasonDisciplinePlayerCountById = buildSeasonDisciplinePlayerCountMap(gameState);
  const soldPlayerBanIds = new Set(buildSoldPlayerSeasonBans(gameState, gameState.season.id).keys());

  const browseIndexCacheKey = `${cacheKey}:browse_index`;
  const baseCacheKey = aiPreviewMode ? `${cacheKey}:ai_preview` : compactListMode ? `${cacheKey}:compact_list` : cacheKey;
  let baseItems: TransfermarktFreeAgentItem[] | null = localFreeAgentBaseCache.get(baseCacheKey) ?? null;
  const baseFeedBuildStartedAt = baseItems ? 0 : Date.now();
  if (!baseItems) {
    const playerRatingsById = skipHeavyBaseFields
      ? null
      : getSeasonDerivations({ gameState, saveId: save.saveId }).ratingsById;
    const playerPotentialById = new Map((gameState.playerPotential ?? []).map((entry) => [entry.playerId, entry] as const));
    if (compactListMode && !aiPreviewMode) {
      let browseIndex = localFreeAgentBrowseIndexCache.get(browseIndexCacheKey) ?? null;
      if (!browseIndex) {
        browseIndex = buildFreeAgentBrowseIndex({ gameState, rosterPlayerIds, soldPlayerBanIds });
        localFreeAgentBrowseIndexCache.set(browseIndexCacheKey, browseIndex);
      }
      baseItems = browseIndex.map((entry) => {
        const player = playersById.get(entry.playerId);
        if (!player) {
          return entry as unknown as TransfermarktFreeAgentItem;
        }
        return buildCompactFreeAgentItem({
          gameState,
          player,
          playerPotentialById,
          browseEntry: entry,
        });
      });
    } else {
    baseItems = gameState.players
      .filter((player) => !rosterPlayerIds.has(player.id))
      .filter((player) => !soldPlayerBanIds.has(player.id))
      .map<TransfermarktFreeAgentItem>((player) => {
        const marketValue = getPlayerMarketValue(player);
        const salary = getPlayerSalary(player);
        const playerRating = playerRatingsById?.get(player.id) ?? null;
        const progressionForecast = skipHeavyBaseFields
          ? null
          : buildPlayerProgressionForecast({
              gameState,
              player,
              playerRating,
              seasonPerformance: null,
              trainingModeByPlayerId: player.trainingMode ? { [player.id]: player.trainingMode } : null,
              currentXP: player.currentXP ?? 0,
              spentXP: player.spentXP ?? 0,
              lifetimeXP: player.lifetimeXP ?? null,
            });
        const scoutPotential = skipHeavyBaseFields
          ? null
          : buildPlayerScoutPotentialFromGameState({
              gameState,
              player,
              saveId: save.saveId,
              scoutingLevel: 0,
            });
        const baseTraitView = getScoutedTraitView({
          traitsPositive: player.traitsPositive,
          traitsNegative: player.traitsNegative,
          scoutingLevel: 0,
        });
        const potentialRecord = playerPotentialById.get(player.id) ?? null;
        const quickPotentialScore = potentialRecord?.hiddenPotentialScore ?? player.potential ?? player.rating;

        return {
        playerId: player.id,
        name: player.name,
        className: player.className,
        race: player.race,
        alignment: player.alignment,
        gender: player.gender,
        subclasses: player.subclasses,
        traitsPositive: baseTraitView.visiblePositiveTraits,
        traitsNegative: baseTraitView.visibleNegativeTraits,
        preferredDisciplineIds: [],
        scoutingLevel: 0,
        scoutingDisclosure: baseTraitView.disclosure,
        hiddenPositiveTraitCount: baseTraitView.hiddenPositiveTraitCount,
        hiddenNegativeTraitCount: baseTraitView.hiddenNegativeTraitCount,
        preferredDisciplineIdsVisible: false,
        subclass1: player.subclasses[0] ?? null,
        subclass2: player.subclasses[1] ?? null,
        subclass3: player.subclasses[2] ?? null,
        traitPos1: baseTraitView.visiblePositiveTraits[0] ?? null,
        traitPos2: baseTraitView.visiblePositiveTraits[1] ?? null,
        traitPos3: baseTraitView.visiblePositiveTraits[2] ?? null,
        traitNeg1: baseTraitView.visibleNegativeTraits[0] ?? null,
        traitNeg2: baseTraitView.visibleNegativeTraits[1] ?? null,
        traitNeg3: baseTraitView.visibleNegativeTraits[2] ?? null,
        marketValue,
        ovr: playerRating?.ovrNormalized ?? player.rating ?? null,
        mvs: playerRating?.mvs ?? null,
        salary,
        marketValueSalaryRatio:
          marketValue != null && salary != null && salary > 0 ? roundValue(marketValue / salary, 2) : null,
        bracket: getTransfermarktBracket(marketValue),
        salaryStatus: salary != null ? "known" : "missing",
        pow: player.coreStats.pow,
        spe: player.coreStats.spe,
        men: player.coreStats.men,
        soc: player.coreStats.soc,
        powTier: getTransfermarktTierFromPoints(player.coreStats.pow),
        speTier: getTransfermarktTierFromPoints(player.coreStats.spe),
        menTier: getTransfermarktTierFromPoints(player.coreStats.men),
        socTier: getTransfermarktTierFromPoints(player.coreStats.soc),
        above20: player.disciplineTierCounts.above20,
        above40: player.disciplineTierCounts.above40,
        above60: player.disciplineTierCounts.above60,
        above80: player.disciplineTierCounts.above80,
        powerRating: normalizeTransfermarktTier(player.attributeSheetRatings?.powerRating),
        healthRating: normalizeTransfermarktTier(player.attributeSheetRatings?.healthRating),
        staminaRating: normalizeTransfermarktTier(player.attributeSheetRatings?.staminaRating),
        intelligenceRating: normalizeTransfermarktTier(player.attributeSheetRatings?.intelligenceRating),
        determinationRating: normalizeTransfermarktTier(player.attributeSheetRatings?.determinationRating),
        awarenessRating: normalizeTransfermarktTier(player.attributeSheetRatings?.awarenessRating),
        speedRating: normalizeTransfermarktTier(player.attributeSheetRatings?.speedRating),
        dexterityRating: normalizeTransfermarktTier(player.attributeSheetRatings?.dexterityRating),
        charismaRating: normalizeTransfermarktTier(player.attributeSheetRatings?.charismaRating),
        willRating: normalizeTransfermarktTier(player.attributeSheetRatings?.willRating),
        spiritRating: normalizeTransfermarktTier(player.attributeSheetRatings?.spiritRating),
        tormentRating: normalizeTransfermarktTier(player.attributeSheetRatings?.tormentRating),
        attributeStatValues: skipHeavyBaseFields
          ? null
          : {
          power: player.attributeSheetStats?.power ?? null,
          health: player.attributeSheetStats?.health ?? null,
          stamina: player.attributeSheetStats?.stamina ?? null,
          intelligence: player.attributeSheetStats?.intelligence ?? null,
          awareness: player.attributeSheetStats?.awareness ?? null,
          determination: player.attributeSheetStats?.determination ?? null,
          speed: player.attributeSheetStats?.speed ?? null,
          dexterity: player.attributeSheetStats?.dexterity ?? null,
          charisma: player.attributeSheetStats?.charisma ?? null,
          will: player.attributeSheetStats?.will ?? null,
          spirit: player.attributeSheetStats?.spirit ?? null,
          torment: player.attributeSheetStats?.torment ?? null,
        },
        topDisciplineScores: skipHeavyBaseFields
          ? []
          : getTopDisciplineScores({
          saveId: save.saveId,
          disciplinesById,
          disciplinePlayerCountById: seasonDisciplinePlayerCountById,
          player,
          scoutingLevel: 0,
        }),
        currentAbilityTier: progressionForecast?.currentAbilityTier ?? getQuickProgressionTier(player.rating),
        potentialTier:
          scoutPotential?.scoutRating == null
            ? progressionForecast?.potentialTier ?? getQuickProgressionTier(quickPotentialScore)
            : getTransfermarktTierFromPoints(scoutPotential.scoutRating),
        potentialBand: scoutPotential?.band ?? potentialRecord?.potentialBand ?? getQuickPotentialBand(quickPotentialScore),
        potentialRange: scoutPotential?.potentialRange ?? potentialRecord?.revealedPotentialRange ?? null,
        ...(skipHeavyBaseFields
          ? {
              axisStarsDisplay: "Scouting nötig",
              axisStarsOverall: null,
              axisStarsPow: null,
              axisStarsSpe: null,
              axisStarsMen: null,
              axisStarsSoc: null,
              potentialStarsDisplay: "Potenzial unbekannt",
              potentialStarsMin: null,
              potentialStarsMax: null,
              potentialGapStars: null,
            }
          : buildStarFieldsForPlayer({
              gameState,
              player,
              saveId: save.saveId,
              scoutingLevel: 0,
            })),
        scoutingConfidence: scoutPotential?.confidence ?? potentialRecord?.confidence ?? null,
        scoutingSource: scoutPotential?.source ?? potentialRecord?.source ?? "generated",
        scoutingWarnings: scoutPotential?.warnings ?? [],
        marketValuePotentialPremiumPct: scoutPotential?.marketValuePotentialPremiumPct ?? null,
        trainingFormTier: progressionForecast?.trainingFormTier ?? null,
        developmentTrend: progressionForecast?.xpTrend ?? null,
        developmentRoute: progressionForecast?.developmentRoute ?? null,
        regressionRisk: progressionForecast?.regressionRisk ?? null,
        portraitPath: player.portraitPath ?? null,
        portraitUrl: player.portraitUrl ?? null,
        imageUrl: null,
        availabilityReason: "free_agent",
        teamContextAvailable: false,
        teamCash: null,
        teamSalary: null,
        rosterCount: null,
        playerMin: null,
        playerOpt: null,
        readinessStatus: "unknown",
        affordabilityStatus: null,
        rosterPressureStatus: null,
        fitRace: null,
        fitSubclasses: null,
        fitTraits: null,
        fitAlignment: null,
        mercenary: hasMercenaryTrait({
          traitsPositive: player.traitsPositive,
          traitsNegative: player.traitsNegative,
        }),
        fit: null,
        fitDisplay: "Team waehlen",
        fitSource: "select_team_for_fit",
        needMatchScore: null,
        needMatchLabel: null,
        needMatchTone: null,
        needMatchAxes: [],
        needMatchReasons: [],
      };
    });
    }
    localFreeAgentBaseCache.set(baseCacheKey, baseItems);
    recordFreeAgentFeed({ hit: false, buildMs: Date.now() - baseFeedBuildStartedAt, itemsBuilt: baseItems.length });
  } else {
    recordFreeAgentFeed({ hit: true });
  }

  const selectedRosterPlayers = selectedTeamContext?.visiblePlayers ?? [];
  const selectedScoutingLevel = selectedTeam
    ? getFacilityLevel(getTeamFacilityState(gameState, selectedTeam.teamId), "scouting_office")
    : 0;
  const selectedNeeds = selectedTeam ? evaluateAiNeeds(gameState, selectedTeam.teamId) : null;
  const disciplinePlayerCountById = seasonDisciplinePlayerCountById;
  const teamDisciplineRankById = selectedTeam ? buildLocalTeamDisciplineRankMap(gameState, selectedTeam.teamId) : new Map<string, number | null>();
  const selectedAxisAverages = selectedRosterPlayers.length
    ? {
        pow: roundValue(selectedRosterPlayers.reduce((sum, player) => sum + (player.coreStats.pow ?? 0), 0) / selectedRosterPlayers.length, 1),
        spe: roundValue(selectedRosterPlayers.reduce((sum, player) => sum + (player.coreStats.spe ?? 0), 0) / selectedRosterPlayers.length, 1),
        men: roundValue(selectedRosterPlayers.reduce((sum, player) => sum + (player.coreStats.men ?? 0), 0) / selectedRosterPlayers.length, 1),
        soc: roundValue(selectedRosterPlayers.reduce((sum, player) => sum + (player.coreStats.soc ?? 0), 0) / selectedRosterPlayers.length, 1),
      }
    : null;
  const selectedWishlistDisciplines = selectedNeeds
    ? selectedNeeds.topNeedDisciplineIds
        .map((disciplineId) => disciplinesById.get(disciplineId) ?? disciplineId)
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const applyTeamOverlay = (baseItem: TransfermarktFreeAgentItem): TransfermarktFreeAgentItem => {
    if (!selectedTeam) {
      return baseItem;
    }

    if (compactListMode) {
      const player = playersById.get(baseItem.playerId) ?? null;
      const playerScoutingLevel = getEffectiveScoutingLevel(gameState, selectedTeam.teamId, baseItem.playerId);
      const compactFitPlayer = {
        race: baseItem.race,
        alignment: baseItem.alignment,
        subclasses: baseItem.subclasses,
        traitsPositive: baseItem.traitsPositive,
        traitsNegative: baseItem.traitsNegative,
      };
      const fitBreakdown = calculateTransfermarktFit(compactFitPlayer, selectedRosterPlayers, {
        teamId: selectedTeam.teamId,
      });
      const topDisciplineScores = player
        ? getTopDisciplineScores({
            saveId: save.saveId,
            disciplinesById,
            disciplinePlayerCountById,
            teamDisciplineRankById,
            player,
            scoutingLevel: playerScoutingLevel,
          })
        : baseItem.topDisciplineScores;
      return {
        ...baseItem,
        scoutingLevel: playerScoutingLevel,
        topDisciplineScores,
        teamContextAvailable: true,
        teamCash: selectedTeam.cash,
        teamSalary,
        rosterCount,
        playerMin,
        playerOpt,
        affordabilityStatus:
          baseItem.marketValue == null
            ? null
            : selectedTeam.cash >= baseItem.marketValue
              ? "affordable"
              : "too_expensive",
        rosterPressureStatus:
          playerMin == null || playerOpt == null
            ? null
            : rosterCount < playerMin
              ? "under_min"
              : rosterCount < playerOpt
                ? "under_opt"
                : "at_or_above_opt",
        fitRace: fitBreakdown.fitRace,
        fitSubclasses: fitBreakdown.fitSubclasses,
        fitTraits: fitBreakdown.fitTraits,
        fitAlignment: fitBreakdown.fitAlignment,
        fit: fitBreakdown.teamFit,
        fitDisplay: baseItem.mercenary ? `${fitBreakdown.teamFit ?? 0} · Mercenary` : `${fitBreakdown.teamFit ?? 0}`,
        // Team context (selectedTeam) is available here, matching the
        // "local_approximation_not_golden_master" branch used elsewhere in this file.
        fitSource: "local_approximation_not_golden_master",
      };
    }

    const playerScoutingLevel = getEffectiveScoutingLevel(gameState, selectedTeam.teamId, baseItem.playerId);
    const player = playersById.get(baseItem.playerId) ?? null;
    const scoutPotential =
      compactListMode || !player
        ? null
        : buildPlayerScoutPotentialFromGameState({
            gameState,
            player,
            saveId: save.saveId,
            scoutingLevel: playerScoutingLevel,
          });
    const traitView = player
      ? getScoutedTraitView({
          traitsPositive: player.traitsPositive,
          traitsNegative: player.traitsNegative,
          scoutingLevel: playerScoutingLevel,
        })
      : getScoutedTraitView({
          traitsPositive: baseItem.traitsPositive,
          traitsNegative: baseItem.traitsNegative,
          scoutingLevel: playerScoutingLevel,
        });
    const visiblePreferredDisciplineIds =
      player && traitView.disclosure.preferredDisciplinesVisible ? player.preferredDisciplineIds : [];
    const scoutedFitPlayer = player
      ? {
          race: player.race,
          alignment: player.alignment,
          subclasses: player.subclasses,
          traitsPositive: traitView.visiblePositiveTraits,
          traitsNegative: traitView.visibleNegativeTraits,
        }
      : null;
    const fitBreakdown =
      scoutedFitPlayer
        ? calculateTransfermarktFit(scoutedFitPlayer, selectedRosterPlayers, { teamId: selectedTeam.teamId })
        : {
            fitRace: 0,
            fitSubclasses: 0,
            fitTraits: 0,
            fitAlignment: 0,
            teamFit: 0,
          };
    const scoutedPow = player
      ? getScoutedNumericEstimate({
          saveId: save.saveId,
          playerId: player.id,
          field: "pow",
          value: player.coreStats.pow,
          scoutingLevel: playerScoutingLevel,
        })
      : baseItem.pow;
    const scoutedSpe = player
      ? getScoutedNumericEstimate({
          saveId: save.saveId,
          playerId: player.id,
          field: "spe",
          value: player.coreStats.spe,
          scoutingLevel: playerScoutingLevel,
        })
      : baseItem.spe;
    const scoutedMen = player
      ? getScoutedNumericEstimate({
          saveId: save.saveId,
          playerId: player.id,
          field: "men",
          value: player.coreStats.men,
          scoutingLevel: playerScoutingLevel,
        })
      : baseItem.men;
    const scoutedSoc = player
      ? getScoutedNumericEstimate({
          saveId: save.saveId,
          playerId: player.id,
          field: "soc",
          value: player.coreStats.soc,
          scoutingLevel: playerScoutingLevel,
        })
      : baseItem.soc;
    const needMatch = buildNeedMatchSignal({
      item: {
        ...baseItem,
        pow: scoutedPow,
        spe: scoutedSpe,
        men: scoutedMen,
        soc: scoutedSoc,
        preferredDisciplineIds: visiblePreferredDisciplineIds,
      },
      needs: selectedNeeds,
      rosterCount,
      playerMin,
      playerOpt,
    });
    const topDisciplineScores =
      compactListMode || !player
        ? baseItem.topDisciplineScores
        : getTopDisciplineScores({
            saveId: save.saveId,
            disciplinesById,
            disciplinePlayerCountById,
            teamDisciplineRankById,
            player,
            scoutingLevel: playerScoutingLevel,
          });
    const doubleLoadWarnings =
      compactListMode || !player
        ? []
        : buildTransfermarktDoubleLoadWarnings({
            gameState,
            scoutingLevel: playerScoutingLevel,
            topDisciplines: topDisciplineScores,
          });

    return {
      ...baseItem,
      traitsPositive: traitView.visiblePositiveTraits,
      traitsNegative: traitView.visibleNegativeTraits,
      preferredDisciplineIds: visiblePreferredDisciplineIds,
      scoutingLevel: selectedScoutingLevel,
      scoutingDisclosure: traitView.disclosure,
      hiddenPositiveTraitCount: traitView.hiddenPositiveTraitCount,
      hiddenNegativeTraitCount: traitView.hiddenNegativeTraitCount,
      preferredDisciplineIdsVisible: traitView.disclosure.preferredDisciplinesVisible,
      traitPos1: traitView.visiblePositiveTraits[0] ?? null,
      traitPos2: traitView.visiblePositiveTraits[1] ?? null,
      traitPos3: traitView.visiblePositiveTraits[2] ?? null,
      traitNeg1: traitView.visibleNegativeTraits[0] ?? null,
      traitNeg2: traitView.visibleNegativeTraits[1] ?? null,
      traitNeg3: traitView.visibleNegativeTraits[2] ?? null,
      pow: scoutedPow,
      spe: scoutedSpe,
      men: scoutedMen,
      soc: scoutedSoc,
      powTier: getTransfermarktTierFromPoints(scoutedPow),
      speTier: getTransfermarktTierFromPoints(scoutedSpe),
      menTier: getTransfermarktTierFromPoints(scoutedMen),
      socTier: getTransfermarktTierFromPoints(scoutedSoc),
      mercenary: hasMercenaryTrait({
        traitsPositive: player?.traitsPositive ?? baseItem.traitsPositive,
        traitsNegative: player?.traitsNegative ?? baseItem.traitsNegative,
      }),
      topDisciplineScores,
      potentialTier:
        scoutPotential?.scoutRating == null
          ? baseItem.potentialTier
          : getTransfermarktTierFromPoints(scoutPotential.scoutRating),
      potentialBand: scoutPotential?.band ?? baseItem.potentialBand,
      potentialRange: scoutPotential?.potentialRange ?? baseItem.potentialRange,
      ...(player && !compactListMode
        ? buildStarFieldsForPlayer({
            gameState,
            player,
            saveId: save.saveId,
            scoutingLevel: playerScoutingLevel,
          })
        : {
            axisStarsDisplay: baseItem.axisStarsDisplay,
            axisStarsOverall: baseItem.axisStarsOverall,
            axisStarsPow: baseItem.axisStarsPow,
            axisStarsSpe: baseItem.axisStarsSpe,
            axisStarsMen: baseItem.axisStarsMen,
            axisStarsSoc: baseItem.axisStarsSoc,
            potentialStarsDisplay: baseItem.potentialStarsDisplay,
            potentialStarsMin: baseItem.potentialStarsMin,
            potentialStarsMax: baseItem.potentialStarsMax,
            potentialGapStars: baseItem.potentialGapStars,
          }),
      scoutingConfidence: scoutPotential?.confidence ?? baseItem.scoutingConfidence,
      scoutingSource: scoutPotential?.source ?? baseItem.scoutingSource,
      scoutingWarnings: [
        ...(scoutPotential?.warnings ?? baseItem.scoutingWarnings),
        ...doubleLoadWarnings.map((warning) => warning.tooltip),
      ],
      doubleLoadWarnings,
      marketValuePotentialPremiumPct:
        scoutPotential?.marketValuePotentialPremiumPct ?? baseItem.marketValuePotentialPremiumPct,
      teamContextAvailable: true,
      teamCash: selectedTeam.cash,
      teamSalary,
      rosterCount,
      playerMin,
      playerOpt,
      affordabilityStatus:
        baseItem.marketValue == null
          ? null
          : selectedTeam.cash >= baseItem.marketValue
            ? "affordable"
            : "too_expensive",
      rosterPressureStatus:
        playerMin == null || playerOpt == null
          ? null
          : rosterCount < playerMin
            ? "under_min"
            : rosterCount < playerOpt
              ? "under_opt"
              : "at_or_above_opt",
      fitRace: fitBreakdown.fitRace,
      fitSubclasses: fitBreakdown.fitSubclasses,
      fitTraits: fitBreakdown.fitTraits,
      fitAlignment: fitBreakdown.fitAlignment,
      fit: fitBreakdown.teamFit,
      fitDisplay: baseItem.mercenary ? `${fitBreakdown.teamFit ?? 0} · Mercenary` : `${fitBreakdown.teamFit ?? 0}`,
      fitSource: "local_approximation_not_golden_master",
      ...needMatch,
    };
  };

  const search = input.search?.trim().toLowerCase() ?? "";
  const minMarketValue = input.minMarketValue ?? null;
  const maxMarketValue = input.maxMarketValue ?? null;
  const minSalary = input.minSalary ?? null;
  const maxSalary = input.maxSalary ?? null;
  const recentlySoldBySelectedTeam = selectedTeam
    ? buildRecentlySoldByTeam(gameState, gameState.season.id).get(selectedTeam.teamId) ?? null
    : null;

  const matchesFreeAgentFilters = (item: TransfermarktFreeAgentBrowseIndexEntry) => {
    const searchHaystack = [
      item.name,
      item.className,
      item.race,
      item.alignment,
      item.gender,
      ...item.subclasses,
      ...item.traitsPositive,
      ...item.traitsNegative,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search || searchHaystack.includes(search);
    const matchesMin = minMarketValue == null || (item.marketValue ?? Number.NEGATIVE_INFINITY) >= minMarketValue;
    const matchesMax = maxMarketValue == null || (item.marketValue ?? Number.POSITIVE_INFINITY) <= maxMarketValue;
    const matchesSalaryMin = minSalary == null || (item.salary ?? Number.NEGATIVE_INFINITY) >= minSalary;
    const matchesSalaryMax = maxSalary == null || (item.salary ?? Number.POSITIVE_INFINITY) <= maxSalary;
    const wasRecentlySoldBySelectedTeam = recentlySoldBySelectedTeam?.has(item.playerId) ?? false;
    return matchesSearch && matchesMin && matchesMax && matchesSalaryMin && matchesSalaryMax && !wasRecentlySoldBySelectedTeam;
  };

  if (!baseItems) {
    throw new Error("Transfermarkt free-agent base cache miss.");
  }

  const useFullPool = input.fullPool === true;
  const hasMwBandFilter = input.minMarketValue != null || input.maxMarketValue != null;
  const filtered = baseItems.filter((item) => matchesFreeAgentFilters(item));
  const useUnboundedFilteredPool = useFullPool || (aiPreviewMode && hasMwBandFilter);
  const itemLimit = useUnboundedFilteredPool ? filtered.length : (input.limit ?? 250);
  const offset = input.offset != null ? Math.max(0, Math.floor(input.offset)) : 0;
  const boundedLimit = useUnboundedFilteredPool
    ? Math.max(filtered.length, 1)
    : Math.max(1, Math.min(itemLimit, 5000));

  const teamAvailableTotal = selectedTeam
    ? baseItems.filter((item) => !(recentlySoldBySelectedTeam?.has(item.playerId) ?? false)).length
    : baseItems.length;

  // Identity-fit ranking (opt-in via rankByTeamFit): rank the FULL filtered pool by how well each
  // free agent matches the selected team's identity axes (pow/spe/men/soc) plus cheap trait/subclass
  // synergy, then take the top-K — instead of the team-agnostic diversity slice. This is what makes a
  // POW+MEN team draw its candidates from POW/MEN players rather than a generic cross-section. Only the
  // top-K get the heavy team overlay below, so the full-pool scan stays cheap (axis math + trait fit).
  const identityFitRankEnabled = Boolean(input.rankByTeamFit) && selectedTeam != null;
  const identityAxisWeights = (() => {
    if (!identityFitRankEnabled) return null;
    const identity = gameState.teamIdentities?.find((entry) => entry.teamId === selectedTeam!.teamId) ?? null;
    if (!identity) return null;
    const raw = {
      pow: Math.max(0, identity.pow ?? 0),
      spe: Math.max(0, identity.spe ?? 0),
      men: Math.max(0, identity.men ?? 0),
      soc: Math.max(0, identity.soc ?? 0),
    };
    const sum = raw.pow + raw.spe + raw.men + raw.soc;
    if (sum <= 0) return null;
    return { pow: raw.pow / sum, spe: raw.spe / sum, men: raw.men / sum, soc: raw.soc / sum };
  })();
  const identityFitScore = (item: TransfermarktFreeAgentItem): number => {
    const axisScore = identityAxisWeights
      ? ((item.pow ?? 0) * identityAxisWeights.pow +
          (item.spe ?? 0) * identityAxisWeights.spe +
          (item.men ?? 0) * identityAxisWeights.men +
          (item.soc ?? 0) * identityAxisWeights.soc) /
        100
      : ((item.pow ?? 0) + (item.spe ?? 0) + (item.men ?? 0) + (item.soc ?? 0)) / 400;
    const synergyRaw = calculateTransfermarktFit(
      {
        race: item.race,
        alignment: item.alignment,
        subclasses: item.subclasses,
        traitsPositive: item.traitsPositive,
        traitsNegative: item.traitsNegative,
      },
      selectedRosterPlayers,
      { teamId: selectedTeam!.teamId },
    ).teamFit;
    const synergyScore = Math.max(-1, Math.min(1, (synergyRaw ?? 0) / 20));
    // Affordability: reward cheaper on-axis players so the slice is dominated by AFFORDABLE identity fits.
    // Without this the ranking front-loads the strongest (= most expensive) identity players and teams
    // blow their budget on a few stars before reaching their minimum roster. ~cheap(<=8) -> ~1, ~40+ -> 0.
    const priceScore = item.marketValue == null ? 0.5 : Math.max(0, Math.min(1, 1 - item.marketValue / 40));
    // Axis identity leads (the meaningful signal at draft time when the roster is still empty); affordability
    // is weighted heavily so the slice stays fillable within budget; synergy is a light tiebreak.
    return axisScore * 0.45 + priceScore * 0.4 + synergyScore * 0.15;
  };
  const buildIdentityFitRankedSlice = (items: TransfermarktFreeAgentItem[], limit: number) => {
    const byIdentity = items
      .map((item) => ({ item, score: identityFitScore(item) }))
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.item);
    if (byIdentity.length <= limit) {
      return byIdentity;
    }
    const selected: TransfermarktFreeAgentItem[] = [];
    const seen = new Set<string>();
    const add = (item: TransfermarktFreeAgentItem | undefined) => {
      if (!item || seen.has(item.playerId) || selected.length >= limit) return;
      selected.push(item);
      seen.add(item.playerId);
    };
    // Affordable coverage FROM the identity-fit top pool: the pure identity ranking front-loads premium
    // stars, which would strand teams below their minimum on budget. Reserve part of the slice for the
    // CHEAPEST identity-relevant players so every team can always fill, then keep the full identity
    // ordering for the premium fits.
    const identityTopPool = byIdentity.slice(0, Math.min(byIdentity.length, Math.max(limit * 3, 120)));
    const affordableTarget = Math.min(limit, Math.max(12, Math.ceil(limit * 0.55)));
    const cheapestIdentity = [...identityTopPool].sort(
      (a, b) => (a.marketValue ?? Number.POSITIVE_INFINITY) - (b.marketValue ?? Number.POSITIVE_INFINITY),
    );
    for (const item of cheapestIdentity) {
      add(item);
      if (selected.length >= affordableTarget) break;
    }
    for (const item of byIdentity) {
      add(item);
      if (selected.length >= limit) break;
    }
    return selected;
  };

  const orderedItems =
    useUnboundedFilteredPool || (aiPreviewMode && boundedLimit + offset >= filtered.length)
      ? filtered
      : identityFitRankEnabled
        ? buildIdentityFitRankedSlice(filtered, Math.min(filtered.length, boundedLimit + offset))
        : aiPreviewMode
          ? buildAiPreviewFreeAgentSlice(filtered, Math.min(filtered.length, boundedLimit + offset))
          : buildDiverseFreeAgentSlice(filtered, Math.min(filtered.length, boundedLimit + offset));
  const visibleItems = orderedItems.slice(offset, offset + boundedLimit).map((item) => applyTeamOverlay(item));

  return {
    items: visibleItems,
    total: filtered.length,
    teamAvailableTotal,
    offset,
    limit: boundedLimit,
    returned: visibleItems.length,
    hasMore: offset + visibleItems.length < filtered.length,
    scope: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      teamId: selectedTeam?.teamId ?? null,
    },
    teamContext: selectedTeam
      ? {
          teamId: selectedTeam.teamId,
          teamCash: selectedTeam.cash,
          teamSalary,
          marketValueTotal: selectedTeamContext?.marketValueTotal ?? null,
          rosterCount,
          playerMin: playerMin ?? 0,
          playerOpt: playerOpt ?? 0,
          readinessStatus: "unknown",
          affordabilityStatus: "affordable",
          rosterPressureStatus:
            playerMin != null && rosterCount < playerMin
              ? "under_min"
              : playerOpt != null && rosterCount < playerOpt
                ? "under_opt"
                : "at_or_above_opt",
          axisAverages: selectedAxisAverages,
          wishlistAxes: selectedNeeds?.uncoveredNeedAxes.slice(0, 3) ?? [],
          wishlistDisciplines: selectedWishlistDisciplines,
          rosterGap: selectedNeeds?.rosterGap ?? null,
        }
      : null,
    source: "derived_free_agents",
    notes: ["SQLite/local free agents derived directly from the active singleplayer save."],
    warnings: [],
    poolAudit: buildTransfermarktPoolAudit({
      activeFreeAgents: filtered,
      visibleFeed: visibleItems,
      candidatePool: null,
    }),
  };
}

export function warmLocalTransfermarktFreeAgentBrowseIndex(input: { saveId?: string; seasonId?: string } = {}) {
  listLocalTransfermarktFreeAgents({
    ...input,
    limit: 1,
    offset: 0,
  });
}

export function invalidateLocalTransfermarktCachesForSave(saveId: string) {
  const prefix = `${saveId}:`;
  for (const key of [...localFreeAgentBaseCache.keys()]) {
    if (key.startsWith(prefix) || key.startsWith(saveId)) {
      localFreeAgentBaseCache.delete(key);
    }
  }
  for (const key of [...localFreeAgentBrowseIndexCache.keys()]) {
    if (key.startsWith(prefix) || key.startsWith(saveId)) {
      localFreeAgentBrowseIndexCache.delete(key);
    }
  }
  for (const key of [...localMarketContextCache.keys()]) {
    if (key.startsWith(prefix) || key.startsWith(saveId)) {
      localMarketContextCache.delete(key);
    }
  }
}

export function previewLocalTransfermarktBuy(params: TransfermarktBuyParams): TransfermarktBuyPreview {
  const context = resolveLocalTransfermarktBuyContext(params);
  return buildLocalTransfermarktBuyPreviewFromContext(params, context);
}

function buildFastLocalYearlySalarySchedule(input: {
  salary: number;
  contractLength: number;
  contractShape: ContractShape;
  seasonId: string;
}): ContractYearSalary[] {
  const length = Math.max(1, Math.round(input.contractLength));
  const base = roundValue(input.salary, 2);
  const weights =
    input.contractShape === "front_loaded"
      ? Array.from({ length }, (_, index) => length - index)
      : input.contractShape === "back_loaded"
        ? Array.from({ length }, (_, index) => index + 1)
        : Array.from({ length }, () => 1);
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
  const total = base * length;
  let assigned = 0;
  return weights.map((weight, index) => {
    const salary = index === weights.length - 1 ? roundValue(total - assigned, 2) : roundValue((total * weight) / weightSum, 2);
    assigned = roundValue(assigned + salary, 2);
    return {
      yearIndex: index + 1,
      seasonOffset: index,
      label: `${input.seasonId} +${index}`,
      salary,
    };
  });
}

function executeFastLocalTransfermarktBatchBuy(params: TransfermarktBuyParams, runContext: LocalTransfermarktRunContext): TransfermarktBuyExecuteResult | null {
  if (!params.fastLocalBatch || !params.deferPersist) return null;
  const save = runContext.save;
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === params.teamId) ?? null;
  const player = gameState.players.find((entry) => entry.id === params.playerId) ?? null;
  const teamIdentity = gameState.teamIdentities.find((entry) => entry.teamId === params.teamId) ?? null;
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === params.teamId);
  const playerAlreadyOwned = gameState.rosters.some((entry) => entry.playerId === params.playerId);
  const marketValueReference = player ? getPlayerMarketValue(player) : null;
  const purchasePriceOverride =
    typeof params.purchasePriceOverride === "number" && Number.isFinite(params.purchasePriceOverride)
      ? Math.max(0, roundValue(params.purchasePriceOverride))
      : null;
  const purchasePrice = purchasePriceOverride ?? marketValueReference;
  const salary = player ? getPlayerSalary(player) : null;
  const teamStrategyProfile = team ? getTeamStrategyProfile(gameState, team.teamId) : null;
  const rosterBefore = rosterEntries.length;
  const salaryBeforeFast = roundValue(
    rosterEntries.reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0),
    2,
  );
  const rosterPlayers = rosterEntries
    .map((entry) => gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null)
    .filter((candidate): candidate is Player => candidate != null);
  const rosterTargets = team && teamIdentity ? deriveRosterTargets(team, teamIdentity) : null;
  const recommendedTeamFit =
    team && player ? calculateTransfermarktFit(player, rosterPlayers, { teamId: team.teamId }).teamFit : null;
  const recommendedDealRole =
    rosterBefore < (rosterTargets?.playerMin ?? 8)
      ? "fill"
      : (marketValueReference ?? 0) >= 70
        ? "star"
        : (marketValueReference ?? 0) >= 45
          ? "core"
          : (marketValueReference ?? 0) <= 25
            ? "depth"
            : "rotation";
  const hasExplicitContractLength =
    typeof params.contractLength === "number" && Number.isFinite(params.contractLength);
  const recommendedContract =
    !hasExplicitContractLength && player
      ? recommendContractOfferForPlayer({
          player,
          teamStrategyProfile,
          teamIdentity,
          teamCash: team?.cash ?? null,
          marketValue: marketValueReference,
          teamFit: recommendedTeamFit,
          currentTeamSalary: salaryBeforeFast,
          dealRole: recommendedDealRole,
          rosterCountBefore: rosterBefore,
          teamRosterMin: rosterTargets?.playerMin ?? null,
          teamRosterOpt: rosterTargets?.playerOpt ?? null,
          isFirstSeason: gameState.season.id === "season-1",
          gmArchetype: getTeamGeneralManager(gameState, params.teamId)?.profile?.archetype ?? null,
          highValue: (marketValueReference ?? 0) >= 35,
        })
      : null;
  const contractLength = hasExplicitContractLength
    ? Math.max(1, Math.round(params.contractLength!))
    : recommendedContract?.contractLength ?? 1;
  const contractShape =
    params.contractShape != null
      ? normalizeContractShape(params.contractShape)
      : normalizeContractShape(recommendedContract?.contractShape);
  const promisedRole = derivePromisedRoleForBuy({
    explicitRole: params.promisedRole ?? null,
    contractLength,
    purchasePrice: marketValueReference ?? purchasePrice,
    rosterBefore,
  });
  const salaryBefore = salaryBeforeFast;
  const marketValueBefore = roundValue(resolveTeamRosterMarketValue(gameState, params.teamId), 2);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  if (!team) blockingReasons.push("team_not_found");
  if (!player) blockingReasons.push("player_not_found");
  if (playerAlreadyOwned) blockingReasons.push("player_not_free_agent_in_scope");
  const soldThisSeasonCooldownHit = isPlayerTransferBuyBlocked({
    gameState,
    playerId: params.playerId,
  });
  if (soldThisSeasonCooldownHit && !params.bypassSoldThisSeasonCooldown) {
    blockingReasons.push(SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER);
  }
  if (soldThisSeasonCooldownHit && params.bypassSoldThisSeasonCooldown) {
    warnings.push(SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING);
  }
  if (purchasePrice == null || purchasePrice <= 0) blockingReasons.push("market_value_missing");
  if (salary == null || salary <= 0) blockingReasons.push("salary_demand_missing");
  if (team && rosterEntries.length >= getTeamPlayerMax(team, teamIdentity)) blockingReasons.push("roster_limit_reached");
  if (
    team &&
    purchasePrice != null &&
    resolveTransferBuyAffordabilityCash({
      gameState,
      teamId: params.teamId,
      teamCash: team.cash,
      rosterBefore: rosterEntries.length,
      playerMin: teamIdentity?.playerMin ?? null,
      seasonId: gameState.season.id,
      transferSource: params.transferSource,
    }) < purchasePrice
  ) {
    blockingReasons.push("insufficient_cash");
  }
  if (purchasePriceOverride != null) {
    warnings.push(params.purchasePriceOverrideReason ?? "purchase_price_override_in_effect");
  }
  const seasonOneMarketBlocker = resolveSeasonOneMarketBuyBlocker(gameState.season.id, params.transferSource);
  if (seasonOneMarketBlocker) {
    blockingReasons.push(seasonOneMarketBlocker);
  }

  const canBuy = blockingReasons.length === 0;
  const offeredSalary = salary;
  const yearlySalarySchedule =
    salary != null
      ? buildFastLocalYearlySalarySchedule({
          salary,
          contractLength,
          contractShape,
          seasonId: gameState.season.id,
        })
      : [];
  const preview: TransfermarktBuyPreview = {
    canBuy,
    blockingReasons,
    warnings,
    player: player
      ? {
          id: player.id,
          name: player.name,
          className: player.className,
          race: player.race,
        }
      : null,
    team: team
      ? {
          id: team.teamId,
          name: team.name,
          shortCode: team.shortCode,
        }
      : null,
    cashBefore: team?.cash ?? null,
    cashAfter: canBuy && team && purchasePrice != null ? team.cash - purchasePrice : team?.cash ?? null,
    salaryBefore,
    salaryAfter: canBuy && salary != null ? salaryBefore + salary : salaryBefore,
    marketValueBefore,
    marketValueAfter: canBuy && marketValueReference != null ? marketValueBefore + marketValueReference : marketValueBefore,
    rosterBefore: rosterEntries.length,
    rosterAfter: canBuy ? rosterEntries.length + 1 : rosterEntries.length,
    purchasePrice,
    salary,
    contractLength,
    contractShape,
    promisedRole,
    currentValue: marketValueReference ?? purchasePrice,
    joinedSeasonId: gameState.season.id,
    expectedSalary: salary,
    baseExpectedSalary: salary,
    demandMultiplier: 1,
    offeredSalary,
    offerRatio: 1,
    yearlySalarySchedule,
    totalSalary: yearlySalarySchedule.reduce((sum, row) => sum + row.salary, 0),
    roundingAdjustment: 0,
    buyoutCost: yearlySalarySchedule.reduce((sum, row) => sum + row.salary, 0),
    bracket: marketValueReference != null ? getTransfermarktBracket(marketValueReference) : null,
    teamFit: null,
    acceptanceScore: 100,
    acceptChance: 100,
    counterChance: 0,
    rejectChance: 0,
    contractPreference: null,
    demandBreakdown: [],
    negotiationScoreBreakdown: [],
    negotiationReasons: ["fast_local_batch_buy"],
    negotiationWarnings: warnings,
    negotiationBlockingReasons: blockingReasons,
    dealPressure: {
      happinessPressure: 0,
      trustRisk: 0,
      pushPressure: 0,
      signals: ["AI Batch-Kauf"],
    },
  };

  if (!canBuy || !team || !player || purchasePrice == null || salary == null) {
    return {
      ...preview,
      activePlayerCreated: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      activePlayerId: null,
      transferId: null,
    };
  }

  const transferHistoryId = `history-${randomUUID()}`;
  const rosterId = `roster-${randomUUID()}`;
  const nextStateBase: GameState = {
    ...gameState,
    teams: gameState.teams.map((entry) =>
      entry.teamId === params.teamId
        ? {
            ...entry,
            cash: roundValue(entry.cash - purchasePrice, 2),
          }
        : entry,
    ),
    rosters: [
      ...gameState.rosters,
      {
        id: rosterId,
        teamId: params.teamId,
        playerId: params.playerId,
        contractLength,
        contractShape,
        yearlySalarySchedule,
        salary,
        upkeep: salary,
        purchasePrice,
        currentValue: marketValueReference,
        roleTag: "prospect",
        promisedRole,
        joinedSeasonId: gameState.season.id,
      },
    ],
    transferHistory: [
      {
        id: transferHistoryId,
        playerId: params.playerId,
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId ?? null,
        phase: LOCAL_TRANSFER_WINDOW_PHASE,
        source: params.transferSource ?? "manual_transfermarkt_buy",
        seasonLabel: getCanonicalSeasonLabel({
          seasonId: gameState.season.id,
          seasonName: gameState.season.name,
        }),
        transferType: "buy",
        fromTeamId: null,
        toTeamId: params.teamId,
        fee: purchasePrice,
        salary,
        marketValue: marketValueReference ?? purchasePrice,
        remainingContractLength: contractLength,
        happenedAt: new Date().toISOString(),
      } satisfies TransferHistoryEntry,
      ...gameState.transferHistory,
    ],
  };
  const nextState = applyDefaultTrainingFieldsToRosteredPlayers(
    applyTransferBudgetSpend(nextStateBase, params.teamId, purchasePrice),
  );

  runContext.save = {
    ...runContext.save,
    gameState: nextState,
  };
  trackDerivationPlayerId(runContext, params.playerId);
  runContext.deferredWrites += 1;

  return {
    ...preview,
    activePlayerCreated: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    activePlayerId: `local-roster:${save.saveId}:${params.playerId}`,
    transferId: transferHistoryId,
  };
}

export function executeLocalTransfermarktBuy(params: TransfermarktBuyParams): TransfermarktBuyExecuteResult {
  const runContext = getLocalRunContext(params);
  if (runContext) {
    const fastResult = executeFastLocalTransfermarktBatchBuy(params, runContext);
    if (fastResult) return fastResult;
  }
  const { persistence } = runContext ?? resolveLocalSave(params.saveId);
  const context = resolveLocalTransfermarktBuyContext(params);
  const { save } = context;
  const preview = buildLocalTransfermarktBuyPreviewFromContext(params, context);
  if (!preview.canBuy || !preview.player || !preview.team || preview.purchasePrice == null || preview.salary == null) {
    return {
      ...preview,
      activePlayerCreated: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      activePlayerId: null,
      transferId: null,
    };
  }

  const transferHistoryId = `history-${randomUUID()}`;
  const marketValueReference = context.marketValueReference ?? preview.currentValue ?? preview.purchasePrice;
  const nextStateBase: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === params.teamId
        ? {
            ...team,
            cash: team.cash - preview.purchasePrice!,
          }
        : team,
    ),
    rosters: [
      ...save.gameState.rosters,
      {
        id: `roster-${randomUUID()}`,
        teamId: params.teamId,
        playerId: params.playerId,
        contractLength: preview.contractLength,
        contractShape: preview.contractShape,
        yearlySalarySchedule: preview.yearlySalarySchedule,
        salary: preview.offeredSalary ?? preview.salary,
        upkeep: preview.offeredSalary ?? preview.salary,
        purchasePrice: preview.purchasePrice,
        currentValue: marketValueReference,
        roleTag: "prospect",
        promisedRole: preview.promisedRole ?? null,
        joinedSeasonId: save.gameState.season.id,
      },
    ],
    transferHistory: [
      {
        id: transferHistoryId,
        playerId: params.playerId,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId ?? null,
        phase: LOCAL_TRANSFER_WINDOW_PHASE,
        source: params.transferSource ?? "manual_transfermarkt_buy",
        seasonLabel: getCanonicalSeasonLabel({
          seasonId: save.gameState.season.id,
          seasonName: save.gameState.season.name,
        }),
        transferType: "buy",
        fromTeamId: null,
        toTeamId: params.teamId,
        fee: preview.purchasePrice,
        salary: preview.offeredSalary ?? preview.salary,
        marketValue: marketValueReference,
        remainingContractLength: preview.contractLength,
        happenedAt: new Date().toISOString(),
      } satisfies TransferHistoryEntry,
      ...save.gameState.transferHistory,
    ],
  };
  const nextState = applyTransferBudgetSpend(nextStateBase, params.teamId, preview.purchasePrice!);

  if (runContext) {
    runContext.save = {
      ...runContext.save,
      gameState: nextState,
    };
    trackDerivationPlayerId(runContext, params.playerId);
    runContext.deferredWrites += 1;
    if (!params.deferPersist) {
      flushLocalTransfermarktRunContext(runContext);
    }
  } else {
    persistTransfermarktGameState(persistence, save.saveId, nextState, [params.playerId]);
  }

  return {
    ...preview,
    activePlayerCreated: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    activePlayerId: `local-roster:${save.saveId}:${params.playerId}`,
    transferId: transferHistoryId,
  };
}

export function listLocalTransferHistory(input: TransferHistoryReadParams = {}): TransferHistoryReadResult {
  const persistence = createPersistenceService();
  const requestedSaveId = input.saveId ?? null;
  const requestedSeasonId = input.seasonId ?? null;
  const requestedSave = requestedSaveId ? persistence.getSaveById(requestedSaveId) : null;
  if (requestedSaveId && !requestedSave) {
    return {
      items: [],
      total: 0,
      offset: 0,
      limit: 0,
      returned: 0,
      hasMore: false,
      scope: {
        saveId: requestedSaveId,
        seasonId: requestedSeasonId ?? "unknown-season",
        teamId: input.teamId ?? null,
        type: input.type ?? null,
      },
      saveContext: {
        source: "sqlite",
        requestedSaveId,
        resolvedSaveId: null,
        requestedSeasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: `Requested save ${requestedSaveId} could not be resolved for local transfer history.`,
      },
    };
  }
  const { save } = resolveLocalSave(input.saveId ?? undefined);
  const gameState = save.gameState;
  const availableSeasonIds = new Set([
    gameState.season.id,
    ...gameState.transferHistory.map((entry) => entry.seasonId),
    ...(gameState.seasonState.seasonSnapshots ?? []).map((snapshot) => snapshot.seasonId),
  ]);
  if (requestedSeasonId && !availableSeasonIds.has(requestedSeasonId)) {
    return {
      items: [],
      total: 0,
      offset: 0,
      limit: 0,
      returned: 0,
      hasMore: false,
      scope: {
        saveId: save.saveId,
        seasonId: requestedSeasonId,
        teamId: input.teamId ?? null,
        type: input.type ?? null,
      },
      saveContext: {
        source: "sqlite",
        requestedSaveId,
        resolvedSaveId: save.saveId,
        requestedSeasonId,
        resolvedSeasonId: null,
        saveName: save.name ?? null,
        saveStatus: save.status ?? null,
        scopeWarning: `Requested season ${requestedSeasonId} is not available in save ${save.saveId}.`,
      },
    };
  }
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));

  const localItems = gameState.transferHistory
    .filter((entry) => (input.seasonId ? entry.seasonId === input.seasonId : true))
    .filter((entry) => (input.type ? entry.transferType === input.type : true))
    .filter((entry) =>
      input.teamId ? entry.fromTeamId === input.teamId || entry.toTeamId === input.teamId : true,
    )
    .map((entry) => ({
      transferId: entry.id,
      type: entry.transferType,
      playerId: entry.playerId,
      playerName:
        gameState.players.find((player) => player.id === entry.playerId)?.name ?? entry.playerId,
      fromTeamId: entry.fromTeamId,
      fromTeamName: entry.fromTeamId ? (teamById.get(entry.fromTeamId)?.name ?? null) : null,
      toTeamId: entry.toTeamId,
      toTeamName: entry.toTeamId ? (teamById.get(entry.toTeamId)?.name ?? null) : null,
      fee: entry.fee,
      salary: entry.salary,
      marketValue: entry.marketValue,
      happenedAt: entry.happenedAt,
      saveId: save.saveId,
      seasonId: entry.seasonId,
      seasonLabel: getCanonicalSeasonLabel({
        seasonId: entry.seasonId,
        seasonName: entry.seasonLabel,
      }),
      matchdayId: entry.matchdayId ?? null,
      phase: entry.phase ?? null,
      source: entry.source ?? null,
      remainingContractLength: entry.remainingContractLength ?? null,
    }));

  const localTransferIds = new Set(localItems.map((entry) => entry.transferId));
  const snapshotItems = (gameState.seasonState.seasonSnapshots ?? [])
    .flatMap((snapshot) =>
      (snapshot.transferSnapshots ?? [])
        .filter((entry) => !localTransferIds.has(entry.transferId))
        .filter((entry) => (input.seasonId ? entry.seasonId === input.seasonId : true))
        .filter((entry) => (input.type ? entry.type === input.type : true))
        .filter((entry) =>
          input.teamId ? entry.fromTeamId === input.teamId || entry.toTeamId === input.teamId : true,
        )
        .filter((entry) => entry.amount != null && entry.salary != null && entry.marketValue != null)
        .map((entry) => ({
          transferId: entry.transferId,
          type: entry.type,
          playerId: entry.playerId,
          playerName: entry.playerName,
          fromTeamId: entry.fromTeamId,
          fromTeamName: entry.fromTeamName,
          toTeamId: entry.toTeamId,
          toTeamName: entry.toTeamName,
          fee: entry.amount as number,
          salary: entry.salary as number,
          marketValue: entry.marketValue as number,
          happenedAt: snapshot.archivedAt,
          saveId: save.saveId,
          seasonId: entry.seasonId,
          seasonLabel: getCanonicalSeasonLabel({
            seasonId: entry.seasonId,
            seasonName: snapshot.seasonName,
          }),
          matchdayId: entry.matchdayId ?? null,
          phase: entry.phase ?? "season_snapshot",
          source: entry.source ?? "season_snapshot_transfer",
          remainingContractLength: entry.contractLength ?? null,
        })),
    );
  const filteredItems = [...localItems, ...snapshotItems].sort(
    (left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt),
  );
  const limit = input.limit != null ? Math.max(1, Math.min(input.limit, 5000)) : 100;
  const offset = input.offset != null ? Math.max(0, Math.floor(input.offset)) : 0;
  const items = filteredItems.slice(offset, offset + limit);

  return {
    items,
    total: filteredItems.length,
    offset,
    limit,
    returned: items.length,
    hasMore: offset + items.length < filteredItems.length,
    scope: {
      saveId: save.saveId,
      seasonId: input.allSeasons ? "ALL" : input.seasonId ?? gameState.season.id,
      teamId: input.teamId ?? null,
      type: input.type ?? null,
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId,
      resolvedSaveId: save.saveId,
      requestedSeasonId,
      resolvedSeasonId: input.allSeasons ? null : input.seasonId ?? gameState.season.id,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
  };
}

export function previewLocalTransfermarktSell(params: TransfermarktSellParams): TransfermarktSellPreview {
  const runContext = getLocalRunContext(params);
  const save = runContext?.save ?? resolveLocalSave(params.saveId).save;
  const marketContext = buildLocalMarketContext(save);
  const { gameState, playersById } = marketContext;
  const teamContext = marketContext.teamContextsById.get(params.teamId) ?? null;
  const team = teamContext?.team ?? null;
  const activePlayer = gameState.rosters.find((entry) => entry.id === params.activePlayerId) ?? null;
  const player = activePlayer ? playersById.get(activePlayer.playerId) ?? null : null;
  const rosterPlayers = teamContext?.rosterPlayers ?? [];
  const cashBefore = teamContext?.cash ?? null;
  const salePlayer = activePlayer ? playersById.get(activePlayer.playerId) ?? null : null;
  const saleEconomy = resolvePlayerEconomyContract({ player: salePlayer, rosterEntry: activePlayer });
  const saleFactorBreakdownBase = buildTransfermarktSaleFactorBreakdown(gameState, salePlayer, activePlayer);
  const rosterBefore = teamContext?.rosterCount ?? 0;
  const rosterAfterPreview = Math.max(0, rosterBefore - 1);
  const priced = applySellPricingPolicyToBreakdown({
    gameState,
    teamId: params.teamId,
    player: salePlayer,
    rosterEntry: activePlayer,
    baseBreakdown: saleFactorBreakdownBase,
    rosterAfter: rosterAfterPreview,
  });
  const saleFactorBreakdown = priced.breakdown;
  const salePrice = saleFactorBreakdown.salePrice ?? saleEconomy.marketValue;
  const normalizedPurchasePrice = normalizeVisibleRosterMoney(
    activePlayer?.purchasePrice,
    saleEconomy.purchasePrice,
  );
  const sellProceeds =
    activePlayer && salePrice != null
      ? resolveTransfermarktSellProceeds({
          rosterEntry: activePlayer,
          grossSalePrice: salePrice,
          purchasePrice: normalizedPurchasePrice,
          gameState,
        })
      : null;
  const buyoutCost = sellProceeds?.buyoutCost ?? null;
  const netProceeds = sellProceeds?.netProceeds ?? salePrice;
  const marketValueReference = saleFactorBreakdown.baseMarketValue ?? saleEconomy.marketValue ?? null;
  const saleFactor = saleFactorBreakdown.saleFactor;
  const profit =
    netProceeds != null && normalizedPurchasePrice != null
      ? roundValue(Math.abs(netProceeds - normalizedPurchasePrice) < 0.005 ? 0 : netProceeds - normalizedPurchasePrice, 2)
      : sellProceeds?.netProfitVsPurchase ?? null;
  const salaryReduction = saleEconomy.salary;
  const teamSalaryBefore = teamContext?.salaryTotal ?? 0;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!team) blockingReasons.push("team_not_found");
  if (!activePlayer) blockingReasons.push("active_player_not_found");
  if (activePlayer && activePlayer.teamId !== params.teamId) blockingReasons.push("active_player_not_in_team");
  if (!player) blockingReasons.push("player_not_found");
  if (!isLocalTransferSellWindowOpen(gameState) && !isSystemTransferSellSource(params.transferSource)) {
    blockingReasons.push("sell_only_at_season_end");
  }

  const canSell = blockingReasons.length === 0;
  const coaching =
    player && team
      ? buildTransfermarktSellCoachingView({
          gameState,
          teamId: params.teamId,
          activePlayerId: params.activePlayerId,
          playerName: player.name,
          profit:
            netProceeds != null && normalizedPurchasePrice != null
              ? roundValue(Math.abs(netProceeds - normalizedPurchasePrice) < 0.005 ? 0 : netProceeds - normalizedPurchasePrice, 2)
              : null,
          pricingPolicy: priced.policy,
        })
      : null;

  if (netProceeds != null && netProceeds <= 0 && activePlayer && activePlayer.contractLength >= 2) {
    warnings.push("Netto-Verkaufserloes deckt den offenen Vertrags-Buyout nicht — Verkauf lohnt sich nicht.");
  }
  if (coaching?.gmSoftBlockStarSell && coaching.keepIntentScore != null && coaching.keepIntentScore >= 55) {
    warnings.push("GM warnt: Core-Verkauf unter Hot-Seat-Bedingungen belastet das Mandat.");
  }
  if (coaching?.boardReaction.requiresStrongAcknowledgment) {
    warnings.push(coaching.boardReaction.description);
  }
  for (const note of priced.policy.notes) {
    warnings.push(note);
  }

  return {
    canSell,
    blockingReasons,
    warnings,
    player: player
      ? { id: player.id, name: player.name, className: player.className, race: player.race }
      : null,
    team: team
      ? { id: team.teamId, name: team.name, shortCode: team.shortCode }
      : null,
    activePlayer: activePlayer
      ? {
          id: activePlayer.id,
          playerId: activePlayer.playerId,
          status: "active",
          roleTag: activePlayer.roleTag,
          contractLength: activePlayer.contractLength,
          salary: activePlayer.salary,
          purchasePrice: normalizedPurchasePrice,
          currentValue: saleEconomy.marketValue,
          joinedSeasonId: activePlayer.joinedSeasonId,
        }
      : null,
    cashBefore,
    cashAfter: canSell && cashBefore != null && netProceeds != null ? cashBefore + netProceeds : cashBefore,
    rosterBefore,
    rosterAfter: canSell ? Math.max(0, rosterBefore - 1) : rosterBefore,
    teamSalaryBefore,
    teamSalaryAfter: canSell && salaryReduction != null ? Math.max(0, teamSalaryBefore - salaryReduction) : teamSalaryBefore,
    marketValueReference,
    saleFactor,
    salePrice,
    buyoutCost,
    netProceeds,
    profit,
    salaryReduction,
    projectedReadinessAfterSell: "unknown",
    coaching,
    pricingPolicyMultiplier: priced.policy.combinedMultiplier,
  };
}

export function executeLocalTransfermarktSell(params: TransfermarktSellParams): TransfermarktSellExecuteResult {
  const runContext = getLocalRunContext(params);
  const { persistence, save } = runContext ?? resolveLocalSave(params.saveId);
  const preview = previewLocalTransfermarktSell(params);
  if (!preview.canSell || !preview.activePlayer || !preview.player || !preview.team) {
    return {
      ...preview,
      activePlayerRemoved: false,
      transferCreated: false,
      teamSeasonStateUpdated: false,
      transferId: null,
    };
  }

  const transferHistoryId = `history-${randomUUID()}`;
  const netProceeds = preview.netProceeds ?? preview.salePrice ?? 0;
  const salePrice = preview.salePrice ?? 0;
  let nextState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === params.teamId
        ? {
            ...team,
            cash: team.cash + netProceeds,
          }
        : team,
    ),
    rosters: save.gameState.rosters.filter((entry) => entry.id !== params.activePlayerId),
    transferHistory: [
      {
        id: transferHistoryId,
        playerId: preview.player.id,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId ?? null,
        phase: LOCAL_TRANSFER_WINDOW_PHASE,
        source: params.transferSource ?? "manual_transfermarkt_sell",
        seasonLabel: getCanonicalSeasonLabel({
          seasonId: save.gameState.season.id,
          seasonName: save.gameState.season.name,
        }),
        transferType: "sell",
        fromTeamId: params.teamId,
        toTeamId: null,
        fee: salePrice,
        buyoutCost: preview.buyoutCost ?? null,
        netCashImpact: netProceeds,
        salary: preview.salaryReduction ?? 0,
        marketValue: preview.marketValueReference ?? salePrice,
        remainingContractLength: preview.activePlayer.contractLength,
        happenedAt: new Date().toISOString(),
      } satisfies TransferHistoryEntry,
      ...save.gameState.transferHistory,
    ],
  };

  if (preview.coaching?.boardReaction) {
    nextState = applySellBoardReactionToGameState({
      gameState: nextState,
      teamId: params.teamId,
      playerId: preview.player.id,
      reaction: preview.coaching.boardReaction,
      saveId: params.saveId,
    });
  }

  if (runContext) {
    runContext.save = {
      ...runContext.save,
      gameState: nextState,
    };
    trackDerivationPlayerId(runContext, preview.player.id);
    runContext.deferredWrites += 1;
    if (!params.deferPersist) {
      flushLocalTransfermarktRunContext(runContext);
    }
  } else {
    persistTransfermarktGameState(persistence, save.saveId, nextState, [preview.player.id]);
  }

  return {
    ...preview,
    activePlayerRemoved: true,
    transferCreated: true,
    teamSeasonStateUpdated: true,
    transferId: transferHistoryId,
  };
}
