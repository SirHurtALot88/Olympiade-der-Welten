import { createHash, randomUUID } from "node:crypto";

import type {
  ContractEventRecord,
  ContractShape,
  ContractStatus,
  GameState,
  Player,
  PlayerRelationshipEventRecord,
  RosterEntry,
  Team,
  TeamStrategyProfile,
  TransferHistoryEntry,
} from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  buildContractNegotiationPreview,
  buildContractSalarySchedule,
  buildPlayerContractPreference,
  type ContractNegotiationPreview,
} from "@/lib/market/contract-negotiation-preview";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { MARKET_BRACKET_DEFINITIONS } from "@/lib/ai/market-pick-engine/market-brackets";
import { applyMoraleToSalary, assessPlayerMorale, type PlayerMoraleAssessment } from "@/lib/morale/player-morale-service";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type ContractRenewalAction = "renew" | "release";

export type ContractRenewalPreviewRow = {
  rowId: string;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  controlMode: "manual" | "ai" | "passive";
  currentSalary: number;
  currentLength: number;
  statusBeforeTick: ContractStatus;
  statusAfterTick: ContractStatus;
  lengthAfterTick: number;
  renewalSalaryPreview: number | null;
  renewalSalaryBeforeMorale: number | null;
  morale: {
    morale: number;
    visibleMood: PlayerMoraleAssessment["visibleMood"];
    smiley: string;
    contractIntent: PlayerMoraleAssessment["contractIntent"];
    salaryModifier: number;
    contractLengthLimit: number | null;
    renewalRisk: number;
    reasons: string[];
    suggestedActions: string[];
    warnings: string[];
  } | null;
  exitValue: number | null;
  saleFactor: number | null;
  marketValueAtExit: number | null;
  purchasePrice: number | null;
  profitLoss: number | null;
  recommendedLength: number;
  recommendedContractShape: ContractShape;
  recommendedAction: "renew" | "sell_or_replace" | "release" | "manual_decision" | "no_action";
  renewalBlockReason: "none" | "cash_gate" | "heuristic" | "morale" | "bad_value" | "manual" | null;
  canRenewEffective: boolean;
  decisionReason: string | null;
  marketValue: number | null;
  ovr: number | null;
  mvs: number | null;
  pps: number | null;
  xpAvailable: number | null;
  teamFit: number | null;
  warnings: string[];
  blockingReasons: string[];
};

export type ContractSeasonEndPreview = {
  ok: boolean;
  saveId: string;
  seasonId: string;
  confirmToken: string;
  rows: ContractRenewalPreviewRow[];
  expiringCount: number;
  outOfContractAfterTickCount: number;
  manualDecisionCount: number;
  aiRenewalCandidates: number;
  aiReleaseCandidates: number;
  warnings: string[];
  blockingReasons: string[];
};

export type ContractSeasonEndApplyResult = ContractSeasonEndPreview & {
  dryRun: false;
  productiveWrites: true;
  applied: boolean;
  releasedPlayers: number;
  renewedPlayers: number;
  contractEventsWritten: number;
};

export type ContractActionPreview = {
  ok: boolean;
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  action: ContractRenewalAction;
  confirmToken: string;
  negotiationPreview: ContractNegotiationPreview | null;
  morale: ContractRenewalPreviewRow["morale"];
  moraleAdjustedExpectedSalary: number | null;
  warnings: string[];
  blockingReasons: string[];
};

type ContractExitValue = {
  exitValue: number | null;
  saleFactor: number | null;
  marketValueAtExit: number | null;
  purchasePrice: number | null;
  profitLoss: number | null;
};

function roundMoney(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function getSeasonLabel(gameState: GameState) {
  return gameState.season.name || gameState.season.id;
}

function normalizeLength(value: number | null | undefined) {
  return Math.max(0, Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0));
}

export function normalizeRosterContractStatus(entry: Pick<RosterEntry, "contractLength" | "contractStatus">): ContractStatus {
  if (entry.contractStatus === "released" || entry.contractStatus === "out_of_contract" || entry.contractStatus === "renewal_pending") {
    return entry.contractStatus;
  }
  if (entry.contractStatus === "free_agent") {
    return "out_of_contract";
  }

  const length = normalizeLength(entry.contractLength);
  if (length <= 0) return "out_of_contract";
  if (length === 1) return "expiring";
  return "active";
}

function statusAfterSeasonTick(entry: RosterEntry): { nextLength: number; nextStatus: ContractStatus } {
  const nextLength = Math.max(0, normalizeLength(entry.contractLength) - 1);
  if (nextLength <= 0) {
    return { nextLength, nextStatus: "out_of_contract" };
  }
  if (nextLength === 1) {
    return { nextLength, nextStatus: "expiring" };
  }
  return { nextLength, nextStatus: "active" };
}

function advanceRosterContractSchedule(entry: RosterEntry, nextLength: number): Pick<RosterEntry, "salary" | "upkeep" | "yearlySalarySchedule"> {
  const existingSchedule = entry.yearlySalarySchedule ?? [];
  if (existingSchedule.length <= 1 || nextLength <= 0) {
    return {
      salary: entry.salary,
      upkeep: entry.upkeep,
      yearlySalarySchedule: nextLength > 0 ? existingSchedule.slice(0, nextLength) : [],
    };
  }

  const nextSchedule = existingSchedule.slice(1, nextLength + 1);
  const nextSalary = roundMoney(nextSchedule[0]?.salary) ?? entry.salary;
  return {
    salary: nextSalary,
    upkeep: nextSalary,
    yearlySalarySchedule: nextSchedule,
  };
}

// Root-cause fix (2026-07-04, contract-length synchronized-expiry-wave — see
// outputs/real-engine-s1s5-final/progress-log.md, second contributor after the "fill" deal-role
// mislabeling fixed in transfermarkt-local-service.ts): this used to return one single, fixed
// number per (roleTag, highValue, conservativeTeam) bucket — every "bench" player on a
// cash-tight team got exactly 1, every other "bench" player got exactly 2, with zero variety
// within a bucket. Since a large fraction of any roster shares the same bucket in the same
// season (most players are "bench", most teams are cash-tight right after season-end payouts),
// that turned every renewal cycle into another wave of identically-timed re-expirations,
// perpetuating the same synchronization the "fill" fix addresses for new signings. The fix reuses
// the existing, already-organic (trait+seed based) idealLength from buildPlayerContractPreference
// — the same mechanism new signings already get — as the baseline, and only uses the
// role/value/cash context to bound it (min/max) rather than to hard-override it. This keeps every
// existing guarantee (starters/high-value get longer, cash-tight teams get shorter) while letting
// otherwise-identical players spread naturally across 1-5 seasons instead of collapsing onto one
// number.
function getRecommendedLength(
  entry: RosterEntry,
  player: Player | null,
  rating: PlayerRatingContractRow | null,
  team: Team | null,
  teamStrategyProfile: TeamStrategyProfile | null,
) {
  const role = entry.roleTag;
  const highValue =
    (rating?.ovrRank != null && rating.ovrRank <= 40) ||
    (rating?.ppsSeasonRank != null && rating.ppsSeasonRank <= 40) ||
    (rating?.mvsRank != null && rating.mvsRank <= 40);
  const conservativeTeam = (team?.cash ?? 0) < 40;

  // Anti-Churn (Phase A): kurze Verträge sparen KEIN Geld (Gehalt läuft pro Jahr eh), sie erzwingen nur,
  // dass Spieler auslaufen und teuer neu gekauft werden müssen (64% 1-Jahres-Verträge → 40–80 Exits/Season
  // → Rebuild-Churn → Kreditbedarf). Deshalb: (a) MIN überall ≥ 2 — keine 1-Jahres-Verträge mehr, jeder
  // Behaltens-Spieler wird mindestens 2 Jahre gebunden; (b) gute Spieler (starter/prospect/highValue)
  // länger; (c) der conservativeTeam-Malus verkürzt NICHT mehr die Untergrenze (er war kontraproduktiv —
  // cash-knappe Teams zahlten sich über den Rebuild ärmer), er deckelt nur noch die Obergrenze etwas.
  let min = 2;
  let max = 5;
  if (role === "starter" && highValue) {
    min = 3;
    max = 5;
  } else if (role === "starter") {
    min = 3;
    max = conservativeTeam ? 4 : 5;
  } else if (role === "prospect") {
    min = highValue ? 3 : 2;
    max = highValue ? 5 : 4;
  } else {
    // Bench/Depth: mindestens 2 Jahre (kein 1-Jahres-Durchlauf), aber Obergrenze niedriger, damit
    // schwache Spieler nicht über-gebunden werden und der Kader über Verkäufe erneuerbar bleibt.
    min = 2;
    max = conservativeTeam ? 3 : 4;
  }

  const organicBaseline = buildPlayerContractPreference(player, teamStrategyProfile)?.idealLength ?? 2;
  return Math.max(min, Math.min(max, organicBaseline));
}

/**
 * Phase B — Sicherheits-Rabatt fürs Gehalt bei LÄNGEREN Verträgen. Ein zufriedener (hohe Morale),
 * loyaler Spieler gibt für die Sicherheit einer längeren Bindung Gehalt ab; je länger der Vertrag und je
 * zufriedener/loyaler, desto größer der Rabatt (gedeckelt). Greift erst ab 3 Jahren — kurze Verträge
 * bekommen keinen Rabatt (da ist keine „Sicherheit" zu vergüten).
 */
function resolveLengthSecurityDiscount(
  morale: PlayerMoraleAssessment | null | undefined,
  recommendedLength: number,
  profile: TeamStrategyProfile | null,
): number {
  if (recommendedLength <= 2) return 0;
  const moraleScore = morale?.morale ?? 50; // 0..100
  const contentment = clamp01((moraleScore - 50) / 50); // 0 bei neutral, 1 bei Top-Morale
  if (contentment <= 0) return 0;
  const extraYears = recommendedLength - 2; // 1 bei 3y … 3 bei 5y
  const loyalty = clamp01((profile?.bias.loyaltyBias ?? 5) / 10);
  // Max ~12 % bei Top-Morale + 5-Jahres-Vertrag + loyaler Kultur.
  return Math.min(0.15, contentment * extraYears * 0.04 * (0.6 + 0.4 * loyalty));
}

function getTeamRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

function getTeamPlayerMin(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  return Math.max(identity?.playerMin ?? 7, 7);
}

function isForceReleaseCase(input: {
  morale?: PlayerMoraleAssessment | null;
  badValueContract: boolean;
}) {
  return (
    input.badValueContract ||
    input.morale?.contractIntent === "refuses_extension"
  );
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const DEFAULT_REPLACEMENT_FEE_MW = 15;
const TCO_RENEW_MARGIN = 0.08;

function resolveExpectedReplacementFeeMw(input?: { leagueDepthFloorMw?: number | null }) {
  const depthFloor =
    input?.leagueDepthFloorMw ??
    MARKET_BRACKET_DEFINITIONS.find((definition) => definition.lane === "backup")?.defaultTargetMw ??
    DEFAULT_REPLACEMENT_FEE_MW;
  return roundMoney(Math.max(DEFAULT_REPLACEMENT_FEE_MW, depthFloor)) ?? DEFAULT_REPLACEMENT_FEE_MW;
}

/**
 * Total cost of ownership: exit path (fee + replacement + P/L + min risk) vs renew path (salary × years).
 */
export function resolveContractRenewalTco(input: {
  exitProfitLoss: number | null;
  exitPurchasePrice: number | null;
  exitValue: number | null;
  renewalSalary: number | null;
  currentSalary: number | null;
  renewLength: number;
  ratingValue: number;
  badValueContract: boolean;
  rosterAfterRelease?: number;
  playerMin?: number;
  expectedReplacementFee?: number | null;
}): {
  exitTco: number;
  renewTco: number;
  shouldBiasRenew: boolean;
  preferRenewOverExit: boolean;
  exitLossAbs: number;
  renewalYearCost: number;
  minRiskPremium: number;
  score: number;
} {
  const exitBias = resolveContractExitRenewBias({
    exitProfitLoss: input.exitProfitLoss,
    exitPurchasePrice: input.exitPurchasePrice,
    exitValue: input.exitValue,
    renewalSalary: input.renewalSalary,
    currentSalary: input.currentSalary,
    ratingValue: input.ratingValue,
    badValueContract: input.badValueContract,
  });
  const exitValue = input.exitValue ?? 0;
  const replacementFee = resolveExpectedReplacementFeeMw({
    leagueDepthFloorMw: input.expectedReplacementFee,
  });
  const profitLossAbs = Math.max(0, -(input.exitProfitLoss ?? 0));
  const underMin =
    input.playerMin != null &&
    input.rosterAfterRelease != null &&
    input.rosterAfterRelease < input.playerMin;
  const minRiskPremium = underMin ? replacementFee * 0.35 : 0;
  const exitTco = roundMoney(exitValue + replacementFee + profitLossAbs + minRiskPremium) ?? 0;
  const renewLength = Math.max(1, Math.min(5, input.renewLength));
  const renewalYearCost = exitBias.renewalYearCost;
  const renewTco = roundMoney(renewalYearCost * renewLength) ?? renewalYearCost;
  const renewCheaper = renewTco < exitTco * (1 - TCO_RENEW_MARGIN);
  const shouldBiasRenew =
    underMin ||
    exitBias.shouldBiasRenew ||
    renewCheaper ||
    (exitBias.preferRenewOverExit && !input.badValueContract);
  const preferRenewOverExit =
    underMin || exitBias.preferRenewOverExit || (renewCheaper && input.ratingValue >= 28);
  return {
    exitTco,
    renewTco,
    shouldBiasRenew,
    preferRenewOverExit,
    exitLossAbs: exitBias.exitLossAbs,
    renewalYearCost,
    minRiskPremium,
    score: exitBias.score + (renewCheaper ? 0.15 : 0) + (underMin ? 0.35 : 0),
  };
}

/**
 * Sell-parity for contract exits: exit cash (MW × factor) below purchase price is a realized cash loss
 * (e.g. bought for 20, exit fee 15 → −5). Bias toward a short renewal when eating that loss is
 * worse than bridging one more season — same spirit as lossResistance on market sells, no hard gate.
 */
export function resolveContractExitRenewBias(input: {
  exitProfitLoss: number | null;
  exitPurchasePrice: number | null;
  exitValue: number | null;
  renewalSalary: number | null;
  currentSalary: number | null;
  ratingValue: number;
  badValueContract: boolean;
}): {
  score: number;
  shouldBiasRenew: boolean;
  preferRenewOverExit: boolean;
  exitLossAbs: number;
  renewalYearCost: number;
} {
  const empty = {
    score: 0,
    shouldBiasRenew: false,
    preferRenewOverExit: false,
    exitLossAbs: 0,
    renewalYearCost: 0,
  };
  if (input.badValueContract) {
    return empty;
  }
  const purchasePrice = input.exitPurchasePrice;
  const exitValue = input.exitValue;
  if (purchasePrice == null || purchasePrice <= 0 || exitValue == null) {
    return empty;
  }
  if (exitValue + 0.005 >= purchasePrice) {
    return empty;
  }
  const exitLossAbs = Math.max(0, purchasePrice - exitValue);
  const renewalYearCost = roundMoney(input.renewalSalary ?? input.currentSalary ?? 0) ?? 0;
  const lossRatio = exitLossAbs / purchasePrice;
  const bracketScale = Math.max(6, purchasePrice * 0.15);
  const relativePart = clamp01(lossRatio / 0.35);
  const absolutePart = clamp01(exitLossAbs / bracketScale);
  const combined = 0.3 * relativePart + 0.7 * absolutePart;
  const ratingScale = input.ratingValue < 22 ? 0.35 : input.ratingValue < 30 ? 0.65 : 1;
  // Bridge TCO: one season salary is cheaper than realizing the exit write-down → renew and hope.
  const tcoFavorsRenew =
    renewalYearCost > 0 &&
    exitLossAbs >= renewalYearCost * 0.9 &&
    input.ratingValue >= 28;
  const score = Math.min(1, combined * ratingScale + (tcoFavorsRenew ? 0.28 : 0));
  const shouldBiasRenew = score >= 0.22 || tcoFavorsRenew;
  return {
    score,
    shouldBiasRenew,
    preferRenewOverExit: tcoFavorsRenew,
    exitLossAbs,
    renewalYearCost,
  };
}

/**
 * Quality proxy on the OVR ~0–100 scale for players WITHOUT a computed OVR. The organic squad builder
 * deliberately leaves mvs/ovr null and scores from stats, so `rawOvrScore`/`player.rating` are 0/null
 * for its players — which made EVERY renewal signal below fail and `badValueContract` fire for the
 * whole league (ratingValue < 65 is always true at 0), so no keeper was ever renewed and rosters
 * collapsed season over season. Fall back to a core-stat average plus a small "solide discipline"
 * breadth bonus so the OVR-based signals + badValueContract behave sensibly for stats-only players.
 */
function resolveStatsQualityScore(player: Player | null): number {
  const cs = player?.coreStats;
  if (!cs) return 0;
  const core = ((cs.pow ?? 0) + (cs.spe ?? 0) + (cs.men ?? 0) + (cs.soc ?? 0)) / 4;
  let solide = 0;
  for (const value of Object.values(player?.disciplineRatings ?? {})) {
    if (typeof value === "number" && value > 60) solide += 1;
  }
  return core + Math.min(solide, 6) * 2;
}

/** OVR when present, otherwise the stats-based quality proxy (organic players carry no OVR). */
function resolveContractRatingValue(
  rating: { rawOvrScore?: number | null } | null,
  player: Player | null,
): number {
  const ovr = rating?.rawOvrScore ?? player?.rating ?? null;
  if (typeof ovr === "number" && ovr > 0) return ovr;
  return resolveStatsQualityScore(player);
}

function shouldAiRenewContract(input: {
  entry: RosterEntry;
  player: Player | null;
  rating: PlayerRatingContractRow | null;
  renewalSalaryPreview: number | null;
  morale?: PlayerMoraleAssessment | null;
  contractStrategy?: string | null;
  rosterAfterRelease?: number;
  playerMin?: number;
  playerOpt?: number;
  /** Realized profit/loss (vs. purchase price) if the player were released now instead of renewed. */
  exitProfitLoss?: number | null;
  exitPurchasePrice?: number | null;
  exitValue?: number | null;
  currentSalary?: number | null;
  renewLength?: number;
}) {
  const {
    entry,
    player,
    rating,
    renewalSalaryPreview,
    morale,
    contractStrategy,
    rosterAfterRelease,
    playerMin,
    playerOpt,
    exitProfitLoss,
    exitPurchasePrice,
    exitValue,
    currentSalary,
    renewLength,
  } = input;
  if (contractStrategy === "do_not_renew") {
    return false;
  }
  const marketValue =
    rating?.marketValue ??
    player?.displayMarketValue ??
    player?.marketValue ??
    entry.currentValue ??
    entry.purchasePrice ??
    0;
  const ratingValue = resolveContractRatingValue(rating, player);
  const salaryAfterRenewal = renewalSalaryPreview ?? entry.salary ?? 0;
  const salaryToMarketRatio = marketValue > 0 ? salaryAfterRenewal / marketValue : 1;
  const badValueContract = marketValue > 0 && salaryToMarketRatio > 0.42 && ratingValue < 65;
  const salaryRisk =
    renewalSalaryPreview != null && entry.salary > 0 && renewalSalaryPreview > entry.salary * 1.6;
  const moraleBlocksLongRenewal =
    morale != null && (morale.contractIntent === "refuses_extension" || morale.contractIntent === "considering_exit");
  if (
    contractStrategy === "extend_core" &&
    !isForceReleaseCase({ morale, badValueContract }) &&
    !salaryRisk &&
    !moraleBlocksLongRenewal
  ) {
    return true;
  }
  const hasStrongSeasonSignal =
    (rating?.ppsSeason != null && rating.ppsSeason > 0 && rating.ppsSeasonRank != null && rating.ppsSeasonRank <= 80) ||
    (rating?.mvs != null && rating.mvs > 0 && rating.mvsRank != null && rating.mvsRank <= 80);
  const hasStrongRosterSignal =
    (rating?.ovrRank != null && rating.ovrRank <= 80 && (rating?.rawOvrScore ?? 0) >= 55) ||
    (rating?.rawOvrScore != null && rating.rawOvrScore >= 70) ||
    (player?.rating != null && player.rating >= 70);
  const hasMarketValueSignal =
    (rating?.marketValue != null && rating.marketValue >= 30) ||
    (player?.displayMarketValue != null && player.displayMarketValue >= 30) ||
    (player?.marketValue != null && player.marketValue >= 30);
  const moraleSalaryRisk = morale != null && morale.moraleSalaryModifier >= 1.22;
  const usefulRoleSignal =
    (entry.roleTag === "starter" || entry.roleTag === "prospect") &&
    ratingValue >= 48 &&
    marketValue >= 14 &&
    salaryToMarketRatio <= 0.38;
  const cheapBridgeSignal = marketValue >= 18 && salaryToMarketRatio <= 0.28;
  const hasRotationSignal =
    (rating?.ovrRank != null && rating.ovrRank <= 100) &&
    (entry.roleTag === "starter" || entry.roleTag === "prospect") &&
    !badValueContract;
  const moraleBridgeRenew =
    morale?.contractIntent === "considering_exit" &&
    rating?.ovrRank != null &&
    rating.ovrRank <= 19;
  const rosterRetentionSignal =
    playerOpt != null &&
    rosterAfterRelease != null &&
    rosterAfterRelease < playerOpt &&
    ratingValue >= 42 &&
    !badValueContract;
  const hardMinRetentionSignal =
    playerMin != null &&
    rosterAfterRelease != null &&
    rosterAfterRelease < playerMin &&
    !(badValueContract && ratingValue < 38) &&
    !isForceReleaseCase({ morale, badValueContract });

  const renewalTco = resolveContractRenewalTco({
    exitProfitLoss: exitProfitLoss ?? null,
    exitPurchasePrice: exitPurchasePrice ?? null,
    exitValue: exitValue ?? null,
    renewalSalary: renewalSalaryPreview,
    currentSalary: currentSalary ?? entry.salary ?? null,
    renewLength: renewLength ?? 1,
    ratingValue,
    badValueContract,
    rosterAfterRelease,
    playerMin,
  });

  if (contractStrategy === "market_test" || contractStrategy === "salary_cap") {
    return renewalTco.shouldBiasRenew && !badValueContract && !salaryRisk;
  }

  const exitLossRenewBias = {
    shouldBiasRenew: renewalTco.shouldBiasRenew,
    preferRenewOverExit: renewalTco.preferRenewOverExit,
    score: renewalTco.score,
    exitLossAbs: renewalTco.exitLossAbs,
    renewalYearCost: renewalTco.renewalYearCost,
  };

  const strategyRenewBias =
    contractStrategy === "extend_core" ||
    contractStrategy === "prospect_hold" ||
    contractStrategy === "wait_and_see";

  return (
    strategyRenewBias ||
    hasStrongSeasonSignal ||
    hasStrongRosterSignal ||
    hasMarketValueSignal ||
    usefulRoleSignal ||
    cheapBridgeSignal ||
    hasRotationSignal ||
    moraleBridgeRenew ||
    rosterRetentionSignal ||
    hardMinRetentionSignal ||
    exitLossRenewBias.shouldBiasRenew
  ) && !salaryRisk && !badValueContract && !moraleBlocksLongRenewal && !moraleSalaryRisk;
}

function getTeamRosterSalaryTotal(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => sum + (entry.salary ?? 0), 0);
}

function buildAiRenewalCashGate(input: {
  gameState: GameState;
  team: Team | null;
  teamId: string;
  currentSalary: number;
  renewalSalary: number | null;
  profile: TeamStrategyProfile | null;
}) {
  const cash = input.team?.cash ?? 0;
  const salaryTotal = getTeamRosterSalaryTotal(input.gameState, input.teamId);
  const rosterCount = getTeamRosterCount(input.gameState, input.teamId);
  const playerMin = getTeamPlayerMin(input.gameState, input.teamId);
  const rosterUnderMin = rosterCount < playerMin;
  const bias = input.profile?.bias ?? null;
  const longContractPreference = bias?.longContractPreference ?? (input.profile?.longContractsBias === "high" ? 8 : input.profile?.longContractsBias === "low" ? 3 : 5);
  const riskTolerance = bias?.riskTolerance ?? (input.profile?.riskToleranceLevel === "high" ? 8 : input.profile?.riskToleranceLevel === "low" ? 3 : 5);
  const wageSensitivity = bias?.wageSensitivity ?? 5;
  const cashPriority = bias?.cashPriority ?? 5;
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const identityFinances = identity?.finances ?? 5;
  const salaryFactorCurrent =
    getSeasonEconomyFactorWindow({
      saveId: input.gameState.season.id,
      seasonId: input.gameState.season.id,
      seasonState: input.gameState.seasonState,
    })[0]?.factor ?? 1;
  const salaryIncrease = Math.max(0, (input.renewalSalary ?? input.currentSalary) - input.currentSalary);
  const baseReserve = 3 + salaryTotal * 0.08;
  const strategyReserve =
    longContractPreference * 0.9 +
    wageSensitivity * 0.55 +
    cashPriority * 0.6 +
    Math.max(0, 6 - riskTolerance) * 0.9 +
    Math.max(0, identityFinances - 5) * 0.45 +
    (salaryFactorCurrent < 1 ? (1 - salaryFactorCurrent) * 8 : 0);
  const requiredReserve = roundMoney(baseReserve + strategyReserve + salaryIncrease * 2) ?? 0;
  const effectiveReserve = rosterUnderMin ? Math.min(requiredReserve, Math.max(1, cash * 0.15)) : requiredReserve;
  const canRenew = cash > 0 && cash >= effectiveReserve;
  return {
    canRenew,
    cash,
    requiredReserve: effectiveReserve,
    salaryTotal: roundMoney(salaryTotal) ?? salaryTotal,
    warning: canRenew ? null : `ai_cash_buffer_required:${effectiveReserve.toFixed(1)}`,
    rosterUnderMin,
  };
}

function chooseAiRenewalContractShape(input: {
  team: Team | null;
  entry: RosterEntry;
  recommendedLength: number;
  renewalSalary: number | null;
  cashGate: ReturnType<typeof buildAiRenewalCashGate>;
  profile: TeamStrategyProfile | null;
}): ContractShape {
  if (input.recommendedLength <= 1) return "balanced";

  const bias = input.profile?.bias ?? null;
  const cash = input.team?.cash ?? 0;
  const salaryIncrease = Math.max(0, (input.renewalSalary ?? input.entry.salary ?? 0) - (input.entry.salary ?? 0));
  const cashPriority = bias?.cashPriority ?? 5;
  const wageSensitivity = bias?.wageSensitivity ?? 5;
  const longContractPreference =
    bias?.longContractPreference ??
    (input.profile?.longContractsBias === "high" ? 8 : input.profile?.longContractsBias === "low" ? 3 : 5);
  const shortContractPreference =
    bias?.shortContractPreference ??
    (input.profile?.shortContractsBias === "high" ? 8 : input.profile?.shortContractsBias === "low" ? 3 : 5);
  const sellForProfitAggression = bias?.sellForProfitAggression ?? 5;

  const tightNow = cash < input.cashGate.requiredReserve + Math.max(6, salaryIncrease * 2);
  const strongCashBuffer = cash >= input.cashGate.requiredReserve + Math.max(18, (input.cashGate.salaryTotal ?? 0) * 0.35);
  const futureReliefProfile = wageSensitivity >= 7 || longContractPreference >= 7 || sellForProfitAggression >= 7;
  const cashPreservationProfile = cashPriority >= 7 || shortContractPreference >= 7;

  if (tightNow && cashPreservationProfile) return "back_loaded";
  if (strongCashBuffer && futureReliefProfile) return "front_loaded";
  if (cashPriority >= 8 && !strongCashBuffer) return "back_loaded";
  if (wageSensitivity >= 8 && cash >= input.cashGate.requiredReserve + 10) return "front_loaded";
  return "balanced";
}

function buildToken(input: {
  saveId: string;
  seasonId: string;
  scope: string;
  payload: string;
}) {
  return createHash("sha256")
    .update([input.saveId, input.seasonId, input.scope, input.payload].join(":"))
    .digest("hex");
}

function buildSeasonEndContractToken(save: PersistedSaveGame) {
  const payload = save.gameState.rosters
    .map((entry) => `${entry.id}:${entry.teamId}:${entry.playerId}:${entry.contractLength}:${entry.salary}`)
    .sort()
    .join("|");
  return buildToken({
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    scope: "season_end_contract_tick",
    payload,
  });
}

function getTeamRosterPlayers(gameState: GameState, teamId: string) {
  const playerIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  return gameState.players.filter((player) => playerIds.has(player.id));
}

function buildContractExitValue(gameState: GameState, player: Player | null, entry: RosterEntry | null): ContractExitValue {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
  const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, entry);
  const exitValue = roundMoney(saleFactorBreakdown.salePrice ?? economy.marketValue);
  const marketValueAtExit = roundMoney(saleFactorBreakdown.baseMarketValue ?? economy.marketValue);
  const purchasePrice = roundMoney(normalizeVisibleRosterMoney(entry?.purchasePrice, economy.purchasePrice));
  const profitLoss =
    exitValue != null && purchasePrice != null
      ? roundMoney(Math.abs(exitValue - purchasePrice) < 0.005 ? 0 : exitValue - purchasePrice)
      : null;
  return {
    exitValue,
    saleFactor: saleFactorBreakdown.saleFactor,
    marketValueAtExit,
    purchasePrice,
    profitLoss,
  };
}

function buildContractExitTransferHistory(input: {
  gameState: GameState;
  entry: RosterEntry;
  player: Player | null;
  exit: ContractExitValue;
  source: ContractEventRecord["source"];
}): TransferHistoryEntry {
  return {
    id: `contract-exit:${input.gameState.season.id}:${input.entry.teamId}:${input.entry.playerId}:${randomUUID()}`,
    playerId: input.entry.playerId,
    playerName: input.player?.name,
    seasonId: input.gameState.season.id,
    seasonLabel: getCanonicalSeasonLabel({
      seasonId: input.gameState.season.id,
      seasonName: input.gameState.season.name,
    }),
    matchdayId: input.gameState.matchdayState.matchdayId ?? null,
    phase: "contract_renewal",
    source: input.source,
    transferType: "contract_exit",
    fromTeamId: input.entry.teamId,
    toTeamId: null,
    fee: input.exit.exitValue ?? 0,
    salary: roundMoney(input.entry.salary) ?? 0,
    marketValue: input.exit.marketValueAtExit ?? input.exit.exitValue ?? 0,
    remainingContractLength: 0,
    happenedAt: new Date().toISOString(),
  };
}

function buildNegotiationPreviewForRoster(input: {
  save: PersistedSaveGame;
  team: Team | null;
  player: Player | null;
  rosterEntry: RosterEntry;
  contractLength: number;
  offeredSalary: number | null;
  contractShape?: ContractShape;
}) {
  const gameState = input.save.gameState;
  const teamIdentity = gameState.teamIdentities.find((identity) => identity.teamId === input.rosterEntry.teamId) ?? null;
  const teamStrategyProfile = getTeamStrategyProfile(gameState, input.rosterEntry.teamId);
  return buildContractNegotiationPreview({
    saveId: input.save.saveId,
    seasonId: gameState.season.id,
    teamId: input.rosterEntry.teamId,
    team: input.team,
    teamIdentity,
    teamStrategyProfile,
    player: input.player,
    rosterEntry: input.rosterEntry,
    rosterPlayers: getTeamRosterPlayers(gameState, input.rosterEntry.teamId),
    contractLength: input.contractLength,
    contractShape: input.contractShape ?? "balanced",
    offeredSalary: input.offeredSalary,
    seasonIdBase: gameState.season.id,
    seasonLabelBase: getSeasonLabel(gameState),
  });
}

function buildPreviewRow(input: {
  save: PersistedSaveGame;
  entry: RosterEntry;
  player: Player | null;
  team: Team | null;
  rating: PlayerRatingContractRow | null;
}): ContractRenewalPreviewRow {
  const { save, entry, player, team, rating } = input;
  const controlMode = getTeamControlSettings(save.gameState, entry.teamId)?.controlMode ?? (team?.humanControlled ? "manual" : "ai");
  const tick = statusAfterSeasonTick(entry);
  const statusBeforeTick = normalizeRosterContractStatus(entry);
  const teamStrategyProfile = getTeamStrategyProfile(save.gameState, entry.teamId);
  const recommendedLength = getRecommendedLength(entry, player, rating, team, teamStrategyProfile);
  if (tick.nextStatus !== "out_of_contract") {
    const marketValue = player ? resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue : null;
    return {
      rowId: entry.id,
      teamId: entry.teamId,
      teamName: team?.name ?? entry.teamId,
      playerId: entry.playerId,
      playerName: player?.name ?? entry.playerId,
      controlMode,
      currentSalary: roundMoney(entry.salary) ?? 0,
      currentLength: normalizeLength(entry.contractLength),
      statusBeforeTick,
      statusAfterTick: tick.nextStatus,
      lengthAfterTick: tick.nextLength,
      renewalSalaryPreview: null,
      renewalSalaryBeforeMorale: null,
      morale: null,
      exitValue: null,
      saleFactor: null,
      marketValueAtExit: null,
      purchasePrice: null,
      profitLoss: null,
      recommendedLength,
      recommendedContractShape: "balanced",
      recommendedAction: "no_action",
      renewalBlockReason: null,
      canRenewEffective: true,
      decisionReason: null,
      marketValue: roundMoney(marketValue),
      ovr: rating?.ovrNormalized ?? null,
      mvs: rating?.mvs ?? null,
      pps: rating?.ppsSeason ?? null,
      xpAvailable: typeof player?.currentXP === "number" ? player.currentXP : null,
      teamFit: null,
      warnings: [],
      blockingReasons: [],
    };
  }
  const negotiationPreview = buildNegotiationPreviewForRoster({
    save,
    team,
    player,
    rosterEntry: entry,
    contractLength: recommendedLength,
    offeredSalary: null,
  });
  const morale = player
    ? assessPlayerMorale({
        gameState: save.gameState,
        playerId: player.id,
        teamId: entry.teamId,
        renewalSalaryPreview: negotiationPreview.expectedSalary,
      })
    : null;
  // Phase B: a motivated (high-morale) / loyal player accepts a further discount for the SECURITY of a
  // longer commitment — the longer the offered contract, the more salary they'll give up, scaled by how
  // content they are and the club's loyalty culture. Gives teams a real lever: bind willing players LONG
  // AND cheaper (deine „motivierte Spieler akzeptieren weniger Gehalt für Sicherheit"-Idee). Only kicks in
  // above 2 years and is capped, so it never turns into a fire-sale of wages.
  const moraleSalaryBase = applyMoraleToSalary(negotiationPreview.expectedSalary, morale);
  const lengthSecurityDiscount = resolveLengthSecurityDiscount(morale, recommendedLength, teamStrategyProfile);
  const moraleAdjustedRenewalSalary =
    moraleSalaryBase != null && lengthSecurityDiscount > 0
      ? roundMoney(moraleSalaryBase * (1 - lengthSecurityDiscount)) ?? moraleSalaryBase
      : moraleSalaryBase;
  const marketValue = player ? resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue : null;
  const exit = buildContractExitValue(save.gameState, player, entry);
  const renewalCashGate = buildAiRenewalCashGate({
    gameState: save.gameState,
    team,
    teamId: entry.teamId,
    currentSalary: entry.salary,
    renewalSalary: moraleAdjustedRenewalSalary,
    profile: teamStrategyProfile,
  });
  const recommendedContractShape =
    controlMode === "ai"
      ? chooseAiRenewalContractShape({
          team,
          entry,
          recommendedLength,
          renewalSalary: moraleAdjustedRenewalSalary,
          cashGate: renewalCashGate,
          profile: teamStrategyProfile,
        })
      : "balanced";
  const marketValueForBad =
    rating?.marketValue ??
    player?.displayMarketValue ??
    player?.marketValue ??
    entry.currentValue ??
    0;
  const ratingValueForBad = resolveContractRatingValue(rating, player);
  const salaryAfterRenewalForBad = moraleAdjustedRenewalSalary ?? entry.salary ?? 0;
  const salaryToMarketRatioForBad = marketValueForBad > 0 ? salaryAfterRenewalForBad / marketValueForBad : 1;
  const badValueContract =
    marketValueForBad > 0 && salaryToMarketRatioForBad > 0.42 && ratingValueForBad < 65;
  const rosterTargets = deriveRosterTargets(team, save.gameState.teamIdentities.find((row) => row.teamId === entry.teamId));
  const rosterAfterRelease = save.gameState.rosters.filter(
    (roster) => roster.teamId === entry.teamId && roster.playerId !== entry.playerId,
  ).length;
  const renewalTco = resolveContractRenewalTco({
    exitProfitLoss: exit.profitLoss,
    exitPurchasePrice: exit.purchasePrice,
    exitValue: exit.exitValue,
    renewalSalary: moraleAdjustedRenewalSalary,
    currentSalary: entry.salary ?? null,
    renewLength: recommendedLength,
    ratingValue: ratingValueForBad,
    badValueContract,
    rosterAfterRelease,
    playerMin: rosterTargets.playerMin,
  });
  const bridgeRenewalCost = renewalTco.renewalYearCost;
  const exitEconomicsAllowRenew =
    renewalTco.preferRenewOverExit && renewalCashGate.cash >= bridgeRenewalCost && bridgeRenewalCost > 0;
  const canRenewEffective = renewalCashGate.canRenew || exitEconomicsAllowRenew;
  const warnings = [
    ...negotiationPreview.warnings.filter((warning) => warning !== "preview_only_contract_negotiation"),
    statusBeforeTick === "expiring" ? "contract_expiring" : null,
    tick.nextStatus === "out_of_contract" ? "free_agent_return_if_not_renewed" : null,
    moraleAdjustedRenewalSalary != null && moraleAdjustedRenewalSalary > entry.salary * 1.25 ? "salary_expectation_high" : null,
    controlMode === "ai" && !canRenewEffective ? renewalCashGate.warning : null,
    morale?.contractIntent === "refuses_extension" ? "morale_refuses_extension_risk" : null,
    morale?.contractIntent === "considering_exit" ? "morale_exit_risk" : null,
    renewalTco.shouldBiasRenew
      ? `contract_exit_loss_renew_bias:${renewalTco.score.toFixed(2)}`
      : null,
    renewalTco.preferRenewOverExit
      ? `contract_exit_tco_prefers_renew:exit=${renewalTco.exitTco.toFixed(1)}:renew=${renewalTco.renewTco.toFixed(1)}`
      : null,
    morale?.moraleContractLengthLimit != null ? "morale_limits_contract_length" : null,
    controlMode === "ai" && recommendedContractShape !== "balanced" ? `ai_contract_shape:${recommendedContractShape}` : null,
    controlMode === "manual" && tick.nextStatus === "out_of_contract" ? "manual_confirm_required" : null,
    ...(morale?.warnings ?? []),
  ].filter((warning): warning is string => Boolean(warning));

  const contractStrategy =
    save.gameState.seasonState.aiManagerContractStrategies?.[`${entry.teamId}:${entry.playerId}`]?.strategy ?? null;
  const wouldRenewHeuristic = shouldAiRenewContract({
    entry,
    player,
    rating,
    renewalSalaryPreview: moraleAdjustedRenewalSalary,
    morale,
    contractStrategy,
    rosterAfterRelease,
    playerMin: rosterTargets.playerMin,
    playerOpt: rosterTargets.playerOpt,
    exitProfitLoss: exit.profitLoss,
    exitPurchasePrice: exit.purchasePrice,
    exitValue: exit.exitValue,
    currentSalary: entry.salary ?? null,
    renewLength: recommendedLength,
  });

  const recommendedAction =
    tick.nextStatus !== "out_of_contract"
      ? "no_action"
      : controlMode === "manual"
        ? "manual_decision"
        : canRenewEffective && wouldRenewHeuristic
          ? "renew"
          : "release";

  const renewalBlockReason: ContractRenewalPreviewRow["renewalBlockReason"] =
    tick.nextStatus !== "out_of_contract"
      ? null
      : controlMode === "manual"
        ? "manual"
        : recommendedAction === "renew"
          ? "none"
          : !canRenewEffective
            ? "cash_gate"
            : badValueContract
              ? "bad_value"
              : morale?.contractIntent === "refuses_extension" || morale?.contractIntent === "considering_exit"
                ? "morale"
                : "heuristic";

  const decisionReason =
    tick.nextStatus !== "out_of_contract" || controlMode !== "ai"
      ? null
      : recommendedAction === "renew"
        ? rosterAfterRelease < (rosterTargets.playerMin ?? Number.MAX_SAFE_INTEGER)
          ? "hard_min_retention"
          : renewalTco.preferRenewOverExit
            ? "tco_prefers_renew"
            : contractStrategy === "extend_core"
              ? "extend_core_strategy"
              : "heuristic_renew"
        : !canRenewEffective
          ? "cash_gate"
          : badValueContract
            ? "bad_value_contract"
            : renewalTco.exitTco <= renewalTco.renewTco
              ? "exit_cheaper_than_renew"
              : "heuristic_release";

  return {
    rowId: entry.id,
    teamId: entry.teamId,
    teamName: team?.name ?? entry.teamId,
    playerId: entry.playerId,
    playerName: player?.name ?? entry.playerId,
    controlMode,
    currentSalary: roundMoney(entry.salary) ?? 0,
    currentLength: normalizeLength(entry.contractLength),
    statusBeforeTick,
    statusAfterTick: tick.nextStatus,
    lengthAfterTick: tick.nextLength,
    renewalSalaryPreview: moraleAdjustedRenewalSalary,
    renewalSalaryBeforeMorale: negotiationPreview.expectedSalary,
    morale: morale
      ? {
          morale: morale.morale,
          visibleMood: morale.visibleMood,
          smiley: morale.smiley,
          contractIntent: morale.contractIntent,
          salaryModifier: morale.moraleSalaryModifier,
          contractLengthLimit: morale.moraleContractLengthLimit,
          renewalRisk: morale.moraleRenewalRisk,
          reasons: morale.reasons.map((reason) => reason.reasonId),
          suggestedActions: morale.suggestedActions,
          warnings: morale.warnings,
        }
      : null,
    exitValue: exit.exitValue,
    saleFactor: exit.saleFactor,
    marketValueAtExit: exit.marketValueAtExit,
    purchasePrice: exit.purchasePrice,
    profitLoss: exit.profitLoss,
    recommendedLength,
    recommendedContractShape,
    recommendedAction,
    renewalBlockReason,
    canRenewEffective,
    decisionReason,
    marketValue: roundMoney(marketValue),
    ovr: rating?.ovrNormalized ?? null,
    mvs: rating?.mvs ?? null,
    pps: rating?.ppsSeason ?? null,
    xpAvailable: typeof player?.currentXP === "number" ? player.currentXP : null,
    teamFit: negotiationPreview.teamFit,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: negotiationPreview.blockingReasons,
  };
}

export function previewSeasonEndContracts(save: PersistedSaveGame): ContractSeasonEndPreview {
  const ratingMap = getSeasonDerivations({ gameState: save.gameState, saveId: save.saveId }).ratingsById;
  const playersById = new Map(save.gameState.players.map((player) => [player.id, player] as const));
  const teamsById = new Map(save.gameState.teams.map((team) => [team.teamId, team] as const));
  const rows = save.gameState.rosters.map((entry) =>
    buildPreviewRow({
      save,
      entry,
      player: playersById.get(entry.playerId) ?? null,
      team: teamsById.get(entry.teamId) ?? null,
      rating: ratingMap.get(entry.playerId) ?? null,
    }),
  );
  const expiringCount = rows.filter((row) => row.statusBeforeTick === "expiring").length;
  const outOfContractAfterTickCount = rows.filter((row) => row.statusAfterTick === "out_of_contract").length;
  const manualDecisionCount = rows.filter((row) => row.controlMode === "manual" && row.statusAfterTick === "out_of_contract").length;
  const aiRenewalCandidates = rows.filter((row) => row.controlMode === "ai" && row.recommendedAction === "renew").length;
  const aiReleaseCandidates = rows.filter((row) => row.controlMode === "ai" && row.recommendedAction === "release").length;
  const warnings = [
    expiringCount > 0 ? "contracts_expiring_this_season_end" : null,
    manualDecisionCount > 0 ? "manual_renewal_decisions_required" : null,
    aiReleaseCandidates > 0 ? "ai_release_candidates_detected" : null,
    ...rows.flatMap((row) => row.warnings.map((warning) => `${row.teamId}:${row.playerName}:${warning}`)),
  ].filter((warning): warning is string => Boolean(warning));
  const blockingReasons = rows.flatMap((row) => row.blockingReasons.map((blocker) => `${row.teamId}:${row.playerName}:${blocker}`));

  return {
    ok: blockingReasons.length === 0,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    confirmToken: buildSeasonEndContractToken(save),
    rows,
    expiringCount,
    outOfContractAfterTickCount,
    manualDecisionCount,
    aiRenewalCandidates,
    aiReleaseCandidates,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: Array.from(new Set(blockingReasons)),
  };
}

function buildContractEvent(input: Omit<ContractEventRecord, "eventId" | "timestamp">): ContractEventRecord {
  return {
    ...input,
    eventId: `contract-event:${input.seasonId}:${input.teamId}:${input.playerId}:${input.eventType}:${randomUUID()}`,
    timestamp: new Date().toISOString(),
  };
}

function saveGameStateWithContractEvents(
  save: PersistedSaveGame,
  gameState: GameState,
  persistence: PersistenceService,
) {
  persistGameStateWithMaterializedDerivations(persistence, save.saveId, {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      contractEvents: gameState.seasonState.contractEvents ?? [],
    },
  });
}

function buildPromisedRoleRelationshipEvents(gameState: GameState): PlayerRelationshipEventRecord[] {
  const timestamp = new Date().toISOString();
  return gameState.rosters.flatMap((entry) => {
    if (!entry.promisedRole) return [];
    const morale = assessPlayerMorale({ gameState, playerId: entry.playerId, teamId: entry.teamId });
    const reason = morale?.reasons.find((candidate) =>
      ["good_playtime", "relative_role_fulfilled", "low_playtime", "star_not_used"].includes(candidate.reasonId),
    );
    if (!reason) return [];
    const result =
      reason.reasonId === "star_not_used" || reason.reasonId === "low_playtime"
        ? "promised_role_broken"
        : reason.valueDelta >= 5
          ? "promised_role_exceeded"
          : "promised_role_fulfilled";
    return [{
      eventId: `relationship__${gameState.season.id}__${entry.teamId}__${entry.playerId}__${result}`,
      seasonId: gameState.season.id,
      teamId: entry.teamId,
      playerId: entry.playerId,
      reason: `${result}:${entry.promisedRole}`,
      delta: reason.valueDelta,
      severity: reason.valueDelta < 0 ? "negative" : reason.valueDelta > 0 ? "positive" : "neutral",
      createdAt: timestamp,
      source: "promised_role_morale",
    } satisfies PlayerRelationshipEventRecord];
  });
}

export function applySeasonEndContractTick(
  save: PersistedSaveGame,
  confirmToken: string | null | undefined,
  persistence: PersistenceService,
  previewOverride?: ContractSeasonEndPreview,
): ContractSeasonEndApplyResult {
  const preview = previewOverride ?? previewSeasonEndContracts(save);
  if (!confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      releasedPlayers: 0,
      renewedPlayers: 0,
      contractEventsWritten: 0,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "contract_preview_stale" : "confirm_token_required"],
    };
  }

  const rowsByRosterId = new Map(preview.rows.map((row) => [row.rowId, row] as const));
  const teamsById = new Map(save.gameState.teams.map((team) => [team.teamId, team] as const));
  const playersById = new Map(save.gameState.players.map((player) => [player.id, player] as const));
  const nextRosters: RosterEntry[] = [];
  const contractEvents: ContractEventRecord[] = [];
  const transferHistory: TransferHistoryEntry[] = [];
  const cashDeltaByTeamId = new Map<string, number>();
  const teamReleaseCounts = new Map<string, number>();
  const MAX_RELEASES_PER_TEAM_PER_TICK = 3;

  for (const entry of save.gameState.rosters) {
    const tick = statusAfterSeasonTick(entry);
    if (tick.nextStatus === "out_of_contract") {
      const row = rowsByRosterId.get(entry.id);
      if (row?.controlMode === "manual") {
        nextRosters.push({
          ...entry,
          contractLength: 0,
          contractStatus: "renewal_pending",
        });
        continue;
      }

      const team = teamsById.get(entry.teamId) ?? null;
      const canRenewEffective = row?.canRenewEffective ?? false;
      if (row?.controlMode === "ai" && row.recommendedAction === "renew" && canRenewEffective) {
        const newSalary = roundMoney(row.renewalSalaryPreview ?? entry.salary) ?? entry.salary;
        const contractShape = row.recommendedContractShape ?? "balanced";
        const bridgeRenew =
          row.renewalBlockReason === "heuristic" &&
          (teamReleaseCounts.get(entry.teamId) ?? 0) >= MAX_RELEASES_PER_TEAM_PER_TICK;
        const renewLength = bridgeRenew ? 1 : row.recommendedLength;
        const nextContractSchedule = buildContractSalarySchedule({
          annualSalary: newSalary,
          contractLength: renewLength,
          shape: contractShape,
          seasonIdBase: save.gameState.season.id,
          seasonLabelBase: getSeasonLabel(save.gameState),
        }).yearlySalarySchedule;
        nextRosters.push({
          ...entry,
          salary: newSalary,
          upkeep: newSalary,
          contractLength: renewLength,
          contractStatus: renewLength === 1 ? "expiring" : "active",
          contractShape,
          yearlySalarySchedule: nextContractSchedule,
        });
        contractEvents.push(
          buildContractEvent({
            seasonId: save.gameState.season.id,
            teamId: entry.teamId,
            playerId: entry.playerId,
            eventType: "contract_renewed",
            oldSalary: roundMoney(entry.salary),
            newSalary,
            oldLength: normalizeLength(entry.contractLength),
            newLength: renewLength,
            source: "ai_contract_renewal",
            decisionReason: row.decisionReason,
          }),
        );
        continue;
      }

      const releaseCount = teamReleaseCounts.get(entry.teamId) ?? 0;
      const playerForExit = playersById.get(entry.playerId) ?? null;
      const badValue =
        row?.renewalBlockReason === "bad_value" || row?.renewalBlockReason === "morale";
      if (
        row?.controlMode === "ai" &&
        releaseCount >= MAX_RELEASES_PER_TEAM_PER_TICK &&
        !badValue &&
        row.recommendedAction === "release"
      ) {
        const bridgeSalary = roundMoney(row.renewalSalaryPreview ?? entry.salary) ?? entry.salary;
        nextRosters.push({
          ...entry,
          salary: bridgeSalary,
          upkeep: bridgeSalary,
          contractLength: 1,
          contractStatus: "expiring",
          contractShape: "balanced",
        });
        contractEvents.push(
          buildContractEvent({
            seasonId: save.gameState.season.id,
            teamId: entry.teamId,
            playerId: entry.playerId,
            eventType: "contract_renewed",
            oldSalary: roundMoney(entry.salary),
            newSalary: bridgeSalary,
            oldLength: normalizeLength(entry.contractLength),
            newLength: 1,
            source: "ai_contract_renewal",
          }),
        );
        continue;
      }

      teamReleaseCounts.set(entry.teamId, releaseCount + 1);

      const exit = buildContractExitValue(save.gameState, playerForExit, entry);
      const source: ContractEventRecord["source"] = row?.controlMode === "ai" ? "ai_contract_expiry" : "manual_contract_expiry";
      if (exit.exitValue != null) {
        cashDeltaByTeamId.set(entry.teamId, (cashDeltaByTeamId.get(entry.teamId) ?? 0) + exit.exitValue);
      }
      transferHistory.push(
        buildContractExitTransferHistory({
          gameState: save.gameState,
          entry,
          player: playerForExit,
          exit,
          source,
        }),
      );
      contractEvents.push(
        buildContractEvent({
          seasonId: save.gameState.season.id,
          teamId: entry.teamId,
          playerId: entry.playerId,
          eventType: "contract_expired_exit",
          exitValue: exit.exitValue,
          saleFactor: exit.saleFactor,
          marketValueAtExit: exit.marketValueAtExit,
          purchasePrice: exit.purchasePrice,
          profitLoss: exit.profitLoss,
          oldSalary: roundMoney(entry.salary),
          newSalary: null,
          oldLength: normalizeLength(entry.contractLength),
          newLength: 0,
          source,
          decisionReason: row?.decisionReason ?? "contract_expired_exit",
        }),
      );
      continue;
    }

    const scheduleUpdate = advanceRosterContractSchedule(entry, tick.nextLength);
    nextRosters.push({
      ...entry,
      ...scheduleUpdate,
      contractLength: tick.nextLength,
      contractStatus: tick.nextStatus,
    });
  }

  const gameState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) => {
      const cashDelta = cashDeltaByTeamId.get(team.teamId) ?? 0;
      return cashDelta === 0
        ? team
        : {
            ...team,
            cash: roundMoney(team.cash + cashDelta) ?? team.cash + cashDelta,
          };
    }),
    rosters: nextRosters,
    transferHistory: [...transferHistory, ...save.gameState.transferHistory],
    seasonState: {
      ...save.gameState.seasonState,
      contractEvents: [...contractEvents, ...(save.gameState.seasonState.contractEvents ?? [])],
    },
    logs: [
      {
        id: `contract-season-end:${save.gameState.season.id}:${randomUUID()}`,
        type: "season",
        message: `Vertragslaufzeiten fuer ${save.gameState.season.name} fortgeschrieben.`,
        createdAt: new Date().toISOString(),
      },
      ...save.gameState.logs,
    ],
  };
  const relationshipEvents = buildPromisedRoleRelationshipEvents(save.gameState);
  const relationshipEventIds = new Set(relationshipEvents.map((event) => event.eventId));
  const gameStateWithRelationshipEvents: GameState = {
    ...gameState,
    playerRelationshipEvents: [
      ...relationshipEvents,
      ...(save.gameState.playerRelationshipEvents ?? []).filter((event) => !relationshipEventIds.has(event.eventId)),
    ],
  };

  saveGameStateWithContractEvents(save, gameStateWithRelationshipEvents, persistence);

  return {
    ...preview,
    dryRun: false,
    productiveWrites: true,
    applied: true,
    releasedPlayers: contractEvents.filter(
      (event) => event.eventType === "contract_expired" || event.eventType === "player_released" || event.eventType === "contract_expired_exit",
    ).length,
    renewedPlayers: contractEvents.filter((event) => event.eventType === "contract_renewed").length,
    contractEventsWritten: contractEvents.length,
  };
}

function buildContractActionToken(input: {
  save: PersistedSaveGame;
  action: ContractRenewalAction;
  teamId: string;
  playerId: string;
  contractLength?: number | null;
  offeredSalary?: number | null;
}) {
  const entry = input.save.gameState.rosters.find((candidate) => candidate.teamId === input.teamId && candidate.playerId === input.playerId);
  return buildToken({
    saveId: input.save.saveId,
    seasonId: input.save.gameState.season.id,
    scope: `contract_action:${input.action}`,
    payload: [
      input.teamId,
      input.playerId,
      entry?.id ?? "missing",
      entry?.contractLength ?? "missing",
      entry?.salary ?? "missing",
      input.contractLength ?? "-",
      input.offeredSalary ?? "-",
    ].join(":"),
  });
}

export function previewContractRenewalAction(input: {
  save: PersistedSaveGame;
  teamId: string;
  playerId: string;
  action: ContractRenewalAction;
  contractLength?: number | null;
  offeredSalary?: number | null;
  contractShape?: ContractShape;
}): ContractActionPreview {
  const rosterEntry = input.save.gameState.rosters.find((entry) => entry.teamId === input.teamId && entry.playerId === input.playerId) ?? null;
  const team = input.save.gameState.teams.find((candidate) => candidate.teamId === input.teamId) ?? null;
  const player = input.save.gameState.players.find((candidate) => candidate.id === input.playerId) ?? null;
  const currentContractLength = normalizeLength(rosterEntry?.contractLength);
  const renewalEligible =
    input.action !== "renew" ||
    currentContractLength <= 0 ||
    rosterEntry?.contractStatus === "renewal_pending" ||
    rosterEntry?.contractStatus === "out_of_contract";
  const blockingReasons = [
    !team ? "team_not_found" : null,
    !player ? "player_not_found" : null,
    !rosterEntry ? "player_not_on_team_roster" : null,
    !renewalEligible ? "renewal_only_allowed_at_lz_0" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  const contractLength = Math.max(1, Math.min(5, normalizeLength(input.contractLength ?? rosterEntry?.contractLength ?? 2)));
  const negotiationPreview =
    input.action === "renew" && rosterEntry
      ? buildNegotiationPreviewForRoster({
          save: input.save,
          team,
          player,
          rosterEntry,
          contractLength,
          offeredSalary: input.offeredSalary ?? null,
          contractShape: input.contractShape ?? "balanced",
        })
      : null;
  const morale =
    input.action === "renew" && player && rosterEntry
      ? assessPlayerMorale({
          gameState: input.save.gameState,
          playerId: player.id,
          teamId: input.teamId,
          renewalSalaryPreview: negotiationPreview?.expectedSalary ?? null,
        })
      : null;
  const moraleAdjustedExpectedSalary = applyMoraleToSalary(negotiationPreview?.expectedSalary, morale);
  const moraleBlockingReasons = [
    morale?.moraleContractLengthLimit != null && contractLength > morale.moraleContractLengthLimit
      ? "morale_contract_length_limited"
      : null,
    morale?.contractIntent === "refuses_extension" ? "morale_refuses_extension" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  const warnings = [
    ...(negotiationPreview?.warnings.filter((warning) => warning !== "preview_only_contract_negotiation") ?? []),
    morale?.contractIntent === "refuses_extension" ? "morale_refuses_extension_risk" : null,
    morale?.contractIntent === "considering_exit" ? "morale_exit_risk" : null,
    morale?.moraleContractLengthLimit != null ? "morale_limits_contract_length" : null,
    ...(morale?.warnings ?? []),
    input.action === "release" ? "player_returns_to_free_agent_pool" : null,
    "confirm_required_before_contract_write",
  ].filter((warning): warning is string => Boolean(warning));

  return {
    ok: blockingReasons.length === 0 && (negotiationPreview?.blockingReasons.length ?? 0) === 0 && moraleBlockingReasons.length === 0,
    saveId: input.save.saveId,
    seasonId: input.save.gameState.season.id,
    teamId: input.teamId,
    playerId: input.playerId,
    action: input.action,
    confirmToken: buildContractActionToken(input),
    negotiationPreview,
    morale: morale
      ? {
          morale: morale.morale,
          visibleMood: morale.visibleMood,
          smiley: morale.smiley,
          contractIntent: morale.contractIntent,
          salaryModifier: morale.moraleSalaryModifier,
          contractLengthLimit: morale.moraleContractLengthLimit,
          renewalRisk: morale.moraleRenewalRisk,
          reasons: morale.reasons.map((reason) => reason.reasonId),
          suggestedActions: morale.suggestedActions,
          warnings: morale.warnings,
        }
      : null,
    moraleAdjustedExpectedSalary,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: Array.from(new Set([...blockingReasons, ...(negotiationPreview?.blockingReasons ?? []), ...moraleBlockingReasons])),
  };
}

export function applyContractRenewalAction(input: {
  save: PersistedSaveGame;
  teamId: string;
  playerId: string;
  action: ContractRenewalAction;
  confirmToken: string | null | undefined;
  persistence: PersistenceService;
  contractLength?: number | null;
  offeredSalary?: number | null;
  contractShape?: ContractShape;
  source: "manual_contract_renewal" | "ai_contract_renewal" | "manual_player_release" | "ai_player_release";
}) {
  const preview = previewContractRenewalAction(input);
  if (!input.confirmToken || input.confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      applied: false,
      blockingReasons: [...preview.blockingReasons, input.confirmToken ? "contract_action_preview_stale" : "confirm_token_required"],
    };
  }
  if (!preview.ok) {
    return {
      ...preview,
      applied: false,
    };
  }

  const rosterEntry = input.save.gameState.rosters.find((entry) => entry.teamId === input.teamId && entry.playerId === input.playerId);
  if (!rosterEntry) {
    return {
      ...preview,
      applied: false,
      blockingReasons: [...preview.blockingReasons, "player_not_on_team_roster"],
    };
  }

  const nextLength = Math.max(1, Math.min(5, normalizeLength(input.contractLength ?? rosterEntry.contractLength ?? 2)));
  const newSalary =
    input.action === "renew"
      ? roundMoney(input.offeredSalary ?? preview.moraleAdjustedExpectedSalary ?? preview.negotiationPreview?.expectedSalary ?? rosterEntry.salary) ?? rosterEntry.salary
      : null;
  const nextContractShape = input.contractShape ?? "balanced";
  const nextContractSchedule =
    input.action === "renew"
      ? buildContractSalarySchedule({
          annualSalary: newSalary,
          contractLength: nextLength,
          shape: nextContractShape,
          seasonIdBase: input.save.gameState.season.id,
          seasonLabelBase: getSeasonLabel(input.save.gameState),
        }).yearlySalarySchedule
      : [];
  const player = input.save.gameState.players.find((candidate) => candidate.id === input.playerId) ?? null;
  const exit = input.action === "release" ? buildContractExitValue(input.save.gameState, player, rosterEntry) : null;
  const event = buildContractEvent({
    seasonId: input.save.gameState.season.id,
    teamId: input.teamId,
    playerId: input.playerId,
    eventType: input.action === "renew" ? "contract_renewed" : "player_released",
    exitValue: exit?.exitValue,
    saleFactor: exit?.saleFactor,
    marketValueAtExit: exit?.marketValueAtExit,
    purchasePrice: exit?.purchasePrice,
    profitLoss: exit?.profitLoss,
    oldSalary: roundMoney(rosterEntry.salary),
    newSalary,
    oldLength: normalizeLength(rosterEntry.contractLength),
    newLength: input.action === "renew" ? nextLength : 0,
    source: input.source,
  });
  const nextRosters: RosterEntry[] =
    input.action === "renew"
      ? input.save.gameState.rosters.map((entry) =>
          entry.id === rosterEntry.id
            ? {
                ...entry,
                salary: newSalary ?? entry.salary,
                upkeep: newSalary ?? entry.upkeep,
                contractLength: nextLength,
                contractShape: nextContractShape,
                yearlySalarySchedule: nextContractSchedule,
                contractStatus: nextLength === 1 ? ("expiring" as const) : ("active" as const),
              }
            : entry,
        )
      : input.save.gameState.rosters.filter((entry) => entry.id !== rosterEntry.id);
  const gameState: GameState = {
    ...input.save.gameState,
    teams:
      input.action === "release" && exit?.exitValue != null
        ? input.save.gameState.teams.map((team) =>
            team.teamId === input.teamId
              ? {
                  ...team,
                  cash: roundMoney(team.cash + exit.exitValue!) ?? team.cash + exit.exitValue!,
                }
              : team,
          )
        : input.save.gameState.teams,
    rosters: nextRosters,
    transferHistory:
      input.action === "release" && exit
        ? [
            buildContractExitTransferHistory({
              gameState: input.save.gameState,
              entry: rosterEntry,
              player,
              exit,
              source: input.source,
            }),
            ...input.save.gameState.transferHistory,
          ]
        : input.save.gameState.transferHistory,
    seasonState: {
      ...input.save.gameState.seasonState,
      contractEvents: [event, ...(input.save.gameState.seasonState.contractEvents ?? [])],
    },
  };

  saveGameStateWithContractEvents(input.save, gameState, input.persistence);
  return {
    ...preview,
    applied: true,
    contractEvent: event,
  };
}
