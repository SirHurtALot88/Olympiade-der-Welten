import { createHash, randomUUID } from "node:crypto";

import {
  getContractShapeTeamContext,
  wendeLiquiditaetUndMixAn,
  type ContractShapeTeamContext,
} from "@/lib/market/contract-shape-context";
import type {
  ContractEventRecord,
  ContractShape,
  ContractStatus,
  GameState,
  Player,
  PlayerRelationshipEventRecord,
  PreSeasonWorkflowLogRecord,
  RosterEntry,
  Team,
  TeamStrategyProfile,
  TransferHistoryEntry,
} from "@/lib/data/olyDataTypes";
import { resolveContractExitRenewBias } from "@/lib/contracts/contract-exit-renew-bias";
import {
  normalizeContractLength,
  normalizeRosterContractStatus,
} from "@/lib/contracts/roster-contract-status";
import {
  applyAiContractDissolutions,
  type AiDissolutionDecision,
  type AiDissolutionRenewalSignal,
} from "@/lib/morale/ai-contract-dissolution-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { zieheSaisonstandGuvNachImSaisonendfenster } from "@/lib/finance/season-guv-nachbuchung";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import {
  getSeasonEconomyFactorWindow,
  isBeforeSeasonEconomyFactorAdvance,
} from "@/lib/season/season-economy-factors";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  buildContractNegotiationPreview,
  buildContractSalarySchedule,
  buildPlayerContractPreference,
  type ContractNegotiationPreview,
} from "@/lib/market/contract-negotiation-preview";
import { applySellPricingPolicyToBreakdown } from "@/lib/market/transfermarkt-sell-pricing-policy";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { MARKET_BRACKET_DEFINITIONS } from "@/lib/ai/market-pick-engine/market-brackets";
import {
  applyMoraleToSalary,
  assessPlayerMorale,
  evaluatePromisedRoleAttendanceOutcome,
  type PlayerMoraleAssessment,
} from "@/lib/morale/player-morale-service";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

// Weiterexport: die Abwaegung „Verlust realisieren oder ueberbruecken" ist in eine eigene Datei
// gewandert (siehe dort), damit die KI-Aufloesung sie nutzen kann, ohne einen Import-Zyklus mit
// diesem Dienst zu bauen. Aufrufer und Tests behalten ihren bisherigen Importpfad.
export { resolveContractExitRenewBias } from "@/lib/contracts/contract-exit-renew-bias";

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

// Die Regel selbst liegt in `roster-contract-status.ts` — der Aufloesungs-Dienst braucht sie
// ebenfalls und duerfte sie hier nicht importieren (Kreis ueber die KI-Aufloesung).
const normalizeLength = normalizeContractLength;
export { normalizeRosterContractStatus };

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

/**
 * EIN SAISONWECHSEL FUER EINEN VERTRAG: die Schedule rueckt um ein Jahr vor, `salary` wird mit der
 * neuen Jahr-1-Rate UEBERSCHRIEBEN.
 *
 * Genau dieses Ueberschreiben ist die Falle, die die Apron-Bemessung nicht beruehren darf: bei
 * einem front_loaded-Vertrag ist `salary` nach dem ersten Saisonwechsel kleiner als das verhandelte
 * Jahresgehalt. `negotiatedAnnualSalary` steht NICHT im Rueckgabetyp und wird deshalb vom Spread
 * `{ ...entry, ...scheduleUpdate }` nicht angefasst — das ist beabsichtigt und der Grund, warum das
 * Feld ueberhaupt existiert.
 *
 * Exportiert, damit der Waechter-Test einen Saisonwechsel simulieren kann, ohne die ganze
 * Saisonende-Kette zu fahren — ohne ihn bliebe die Falle unsichtbar.
 */
export function advanceRosterContractSchedule(entry: RosterEntry, nextLength: number): Pick<RosterEntry, "salary" | "upkeep" | "yearlySalarySchedule"> {
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
  gmArchetype?: string | null,
) {
  const role = entry.roleTag;
  const highValue =
    (rating?.ovrRank != null && rating.ovrRank <= 40) ||
    (rating?.ppsSeasonRank != null && rating.ppsSeasonRank <= 40) ||
    (rating?.mvsRank != null && rating.mvsRank <= 40);
  const conservativeTeam = (team?.cash ?? 0) < 40;

  // 1-Jahres-Verträge sind bewusst ERLAUBT: ein auslaufender Vertrag erzeugt einen sauberen Exit
  // (Erlös ~MW, OHNE Buyout-Restgehalt) und ist damit ein legitimes Cash-Generierungs-Werkzeug — lange
  // Verträge würden Teams beim Verkauf in den Buyout zwingen. Länge bleibt deshalb rollen-/wert-/cash-
  // abhängig gebunden (kein Hardcode-Floor), die tatsächliche Länge kommt aus der organischen Präferenz.
  let min = 1;
  let max = 5;
  if (role === "starter" && highValue && !conservativeTeam) {
    min = 3;
    max = 5;
  } else if (role === "starter") {
    min = 2;
    max = 4;
  } else if (role === "prospect") {
    min = highValue ? 2 : 1;
    max = highValue ? 4 : 3;
  } else {
    min = 1;
    max = conservativeTeam ? 2 : 3;
  }

  // Culture keeper binds good players longer: a direct archetype floor of 3-4 seasons for high-value
  // players, independent of the diluted blended long/loyalty bias which rarely clears its own gates.
  if (gmArchetype === "culture_keeper" && highValue) {
    min = Math.max(min, 3);
    max = Math.max(max, 4);
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
  gmArchetype?: string | null;
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
    gmArchetype,
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

  // Culture keeper actively renews its good/core players (rank <= 40) instead of letting them run
  // toward a market exit — the same strategy-level renew bias the extend_core strategy already grants.
  const cultureKeeperHighValue =
    gmArchetype === "culture_keeper" &&
    ((rating?.ovrRank != null && rating.ovrRank <= 40) ||
      (rating?.ppsSeasonRank != null && rating.ppsSeasonRank <= 40) ||
      (rating?.mvsRank != null && rating.mvsRank <= 40));
  const strategyRenewBias =
    contractStrategy === "extend_core" ||
    contractStrategy === "prospect_hold" ||
    contractStrategy === "wait_and_see" ||
    cultureKeeperHighValue;

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
  const salaryFactorCurrent = readSeasonSalaryFactors(input.gameState)[0] ?? 1;
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

/**
 * DAS SALARY-FACTOR-FENSTER — ein Leser fuer diese Datei, eine Quelle fuer den ganzen Baum.
 *
 * `getSeasonEconomyFactorWindow` ist die einzige Stelle, die das Fenster kennt; hier wird es nur
 * auf die nackten Faktoren (horizonIndex 0..4) heruntergebrochen. Kein zweiter Nachbau, kein
 * direkter Griff in `seasonState.seasonEconomyFactors`.
 */
function readSeasonSalaryFactors(gameState: GameState): number[] {
  return getSeasonEconomyFactorWindow({
    saveId: gameState.season.id,
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  })
    .slice()
    .sort((left, right) => left.horizonIndex - right.horizonIndex)
    .map((entry) => entry.factor);
}

/**
 * DIE FAKTOREN DER SAISONS, DIE DIESER VERTRAG BEZAHLT — Jahr 1 zuerst.
 *
 * Verlaengert wird in der Saisonende-Kette; das Faktor-Fenster rueckt erst in deren letztem Schritt
 * vor (`next_season_setup`). Jahr 1 des neuen Vertrags ist dann `horizonIndex 1`, nicht 0 — genau
 * dieselbe Verschiebung wie beim Apron (siehe `resolveApronDecisionSalaryFactor`). Laeuft die
 * Bewertung dagegen in einer bereits gestarteten Saison, ist Jahr 1 der Horizont 0.
 *
 * JAHRE JENSEITS DES FENSTERS bekommen das MITTEL DER BEKANNTEN Jahre — nicht den letzten Wert
 * fortgeschrieben und nicht abgeschnitten. Das Fenster traegt 5 Saisons, betroffen sind also nur
 * Laufzeiten ab 5 (am Abbild 9 von 262 mehrjaehrigen Vertraegen, 3,4 %). Das Mittel ist die
 * neutrale Fuellung: es verschiebt keine der beiden Haelften gegenueber der anderen und erfindet
 * damit kein Gefaelle. Den letzten Faktor fortzuschreiben waere die Behauptung, der Trend halte an
 * — genau das Raten, das `docs/APRON_UND_VERTRAGSFORMEN.md` (Abschnitt 5 B) ausschliesst.
 */
export function resolveContractTermSalaryFactors(gameState: GameState, contractLength: number): number[] {
  const window = readSeasonSalaryFactors(gameState);
  const offset = isBeforeSeasonEconomyFactorAdvance(gameState.gamePhase) ? 1 : 0;
  const laufzeit = Math.max(0, Math.round(contractLength));
  const bekannt = window.slice(offset, offset + laufzeit);
  if (bekannt.length === 0 || bekannt.length >= laufzeit) return bekannt;
  const mittel = bekannt.reduce((sum, value) => sum + value, 0) / bekannt.length;
  return [...bekannt, ...Array.from({ length: laufzeit - bekannt.length }, () => mittel)];
}

/**
 * SCHWELLE DER FORMWAHL — 0,15, hergeleitet in `docs/APRON_UND_VERTRAGSFORMEN.md` Abschnitt 5 A,
 * nicht geschaetzt. Drei gemessene Anker:
 *
 * 1. SIGNAL > VERSCHOBENES: der Wertungsanteil ist linear in f (Rang 1 = 82,7 · Rang 16 = 33,9 ·
 *    Rang 24 = 13,3 bei f=1). Bei |Δ|=0,15 betraegt die Einnahmendifferenz zwischen den
 *    Vertragsjahren 12,4 / 5,1 / 2,0 — die Form verschiebt dagegen nur 0,49–1,99 je Vertrag
 *    (mittleres Jahresgehalt mehrjaehriger Vertraege 6,65 bzw. 4,87 × 10/20/30 %). Bei 0,10 faellt
 *    der Swing eines Rang-24-Teams (1,3) UNTER das Verschobene — dort dreht man Vertraege fuer
 *    einen Effekt, der kleiner ist als die Drehung.
 * 2. AUSLOESEHAEUFIGKEIT (500 000 Ziehungen aus der echten Roll-Spanne 0,82–1,24):
 *    P(|Δ| ≥ T) = 58/59/43 % bei T=0,10 · 41/42/23 % bei T=0,15 · 28/28/11 % bei T=0,20
 *    (2/3/4 Jahre). Das Fenster ist LIGA-GLOBAL: feuert die Regel, feuert sie fuer alle 32 Teams
 *    zugleich. 0,10 uebersteuerte die Profile in der Mehrzahl aller Fenster (Monokultur), 0,20
 *    machte ausgerechnet die Laufzeit mit dem groessten Hebel (4 Jahre, ±30 %) fast taub (11 %).
 * 3. KOSTENSEITE: frueh gebundenes Geld kostet schlimmstenfalls den Kreditzins (7–20 %/Saison) auf
 *    die verschobene Summe, also ≤ 0,27/Saison — die Schwelle braucht keine Kostenmarge, nur
 *    Rauschabstand. Das echte Kostenrisiko faengt die Cash-Wache in `chooseAiRenewalContractShape`.
 *
 * Benannte Konstante, damit die Kontrollmessung nachjustieren kann, ohne den Code zu verstehen.
 * NICHT vertretbar sind < 0,10 (Anker 1 kippt fuer die halbe Liga) und > 0,20 (Anker 2).
 * Nachjustiert wird am Langlauf-A/B (Kreditzinsen, `ai_cash_buffer_required`-Blockaden), NICHT an
 * der Flip-Quote.
 */
export const AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE = 0.15;

/**
 * DAS GEFAELLE Δ = Mittel(ENDHAELFTE der Vertragsjahre) − Mittel(ANFANGSHAELFTE).
 * Positiv = die Einnahmen STEIGEN ueber die Laufzeit (→ spaeter zahlen), negativ = sie fallen
 * (→ frueh zahlen). Alle Vertragsjahre zaehlen VOLL, spaete Jahre werden NICHT abgewertet: die
 * Faktoren sind deterministisch vorausgewuerfelt, es gibt keine Unsicherheit, die eine Abwertung
 * rechtfertigte (anders als bei den Apron-LINIEN, die wirklich unbekannt sind).
 *
 * WARUM DIE HAELFTEN-STATISTIK UND NICHT „naechste Saison gegen den Rest": die naive Variante
 * verduennt einen spaeten Ausreisser. Am Messkoerper `1hf25q` (Vertragsjahre [0,87, 0,83, 0,91,
 * 1,24]) liefert sie Δ = −0,12 und damit das FALSCHE VORZEICHEN; die Haelften-Statistik zeigt den
 * 1,24-Jahrgang korrekt mit Δ = +0,22. Die Haelften passen ausserdem exakt zur Gewichtsrampe von
 * `buildShapeWeights` (linear, symmetrisch um die Laufzeitmitte).
 *
 * Bei ungerader Laufzeit gehoert das Mitteljahr zu KEINER Haelfte — die Rampe bewegt es kaum
 * (Gewicht ≈ 1), und es wuerde beide Mittelwerte nur gleichsinnig verschieben.
 */
function resolveSalaryFactorGefaelle(factors: readonly number[]): number {
  if (factors.length < 2) return 0;
  const half = Math.floor(factors.length / 2);
  const anfang = factors.slice(0, half);
  const ende = factors.slice(factors.length - half);
  const mittel = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  // Auf 6 Stellen runden: die Faktoren tragen zwei Nachkommastellen, alles darunter ist
  // Binaerbruch-Rauschen. Ohne das Runden entscheidet an der Schwelle die Reihenfolge der
  // Subtraktion (1 − 1,15 = −0,14999999999999991) darueber, ob die Regel greift.
  return Math.round((mittel(ende) - mittel(anfang)) * 1e6) / 1e6;
}

/**
 * DIE VERTRAGSFORM EINER KI-VERLAENGERUNG.
 *
 * DIE APRON HAT HIER NICHTS ZU SUCHEN — nachgemessen, nicht vermutet: die Apron bemisst das
 * GEGLAETTETE Formel-Gehalt (`contract.expectedSalary`, siehe Kopfkommentar von
 * `lib/season/apron-service.ts`), nicht die Jahreszahlung. Ein Experiment am Spielstand hat die
 * zehn mehrjaehrigen Vertraege des groessten Zahlers auf `front_loaded` gestellt: die echte
 * Jahr-1-Gehaltssumme stieg um 10,5, die Apron-Abgabe aenderte sich um EXAKT 0,00. Wer hier eine
 * Regel „Form gegen die Apron" einbaut, baut eine Regel ohne Wirkung — und bricht die
 * Anti-Gaming-Entscheidung, die genau das verhindern soll. Ein Waechter-Test haelt die 0,00 fest.
 *
 * WAS DIE FORM WIRKLICH BEWEGT, IST CASH-TIMING. Gehaltszahlungen skalieren NICHT mit dem Salary
 * Factor (es gibt keinen `salaryFactor` in `lib/player-formulas/`, abgebucht wird die nominale
 * Schedule-Summe), die EINNAHMEN aber schon (Wertungstopf = 1133 × f, im Ligamittel rund ±12 je
 * Team zwischen f=0,83 und f=1,19). Faellt das Fenster ueber die Laufzeit, ist frueh zahlen
 * guenstiger; steigt es, spaeter. Die Form verschiebt real 10/20/30 % des Jahresgehalts bei 2/3/4
 * Jahren Laufzeit.
 *
 * RANGFOLGE: KASSENKLEMME > FAKTOR > PROFIL — entschieden und begruendet in
 * `docs/APRON_UND_VERTRAGSFORMEN.md` Abschnitt 5 C, nicht nach Gefuehl gereiht.
 *   1. `tightNow && cashPreservationProfile → back_loaded` bleibt die ERSTE Regel: eine erzwungene
 *      Kreditaufnahme kostet 7–20 %/Saison auf die GESAMTE Luecke und ein gerissenes Cash-Gate
 *      blockiert die Verlaengerung ganz (`ai_cash_buffer_required`) — das schlaegt jeden
 *      Ausrichtungsgewinn von ≤ ~2 je Vertrag.
 *   2. DANN der Faktor — und der UEBERSTIMMT die Profil-Neigungen. `cashPriority`,
 *      `wageSensitivity`, `long-`/`shortContractPreference` und `sellForProfitAggression` sind
 *      Geschmack ohne Informationsgehalt ueber die Zukunft; das Faktor-Fenster ist bekannte
 *      Arithmetik. `front_loaded` nur mit der BESTEHENDEN Cash-Wache `cash ≥ requiredReserve + 10`
 *      (dieselbe Schwelle wie die `wageSensitivity ≥ 8`-Regel darunter — bewusst keine zweite
 *      erfundene Zahl); `back_loaded` braucht keine, es entlastet das erste Jahr.
 *   3. Erst danach die vier Profil-Regeln, dann `balanced`.
 *
 * DASS DARAUS KEINE MONOKULTUR WIRD, sichern drei gemessene Dinge: die Schwelle schweigt in rund
 * 60 % der Fenster (Anker 2 an der Konstante oben), die Cash-Wache trennt die Teams nach ihrer
 * echten Kassenlage, und Einjahresvertraege (124/340 bzw. 297/343 am Abbild) haben nie eine Form.
 * GRENZE DER REGEL, offen benannt: sie richtet sich nach dem LIGA-Wetter; der teamindividuelle
 * Rangverlauf (Wertungsanteil Rang 1 = 82,7 gegen Rang 24 = 13,3) bleibt aussen vor — ihn
 * vorherzusagen waere Raterei.
 *
 * Exportiert, weil die Regel sonst nur beim Saisonwechsel liefe und von keinem Test beruehrt wuerde
 * — genau die Fehlerklasse, die im Apron-Horizont schon einmal zugeschlagen hat.
 *
 * NACHGETRAGEN (PR #508): DER MIX-RIEGEL ALS LETZTE INSTANZ — und NUR er.
 * Chris' Vorgabe: „es sollen ja nicht alle top teams dann nur back loaded nehmen […] dann hast du
 * irgendwann nen sehr teuren gehaltspeak das muss auch vermieden werden, der mix machts." Der
 * Kopfkommentar oben argumentiert, dass keine Monokultur ENTSTEHT (Schwelle schweigt in ~60 % der
 * Fenster, Cash-Wache trennt, Einjahresvertraege formlos) — das ist eine Begruendung, kein Riegel.
 * Chris hat ausdruecklich einen Riegel verlangt, also steht hier einer: hat ein Team schon die
 * Haelfte seiner mindestens vier Mehrjahresvertraege back-loaded, wird der naechste ausgeglichen.
 *
 * DIE APRON-REGEL AUS #508 LAEUFT HIER BEWUSST NICHT MIT. Der Kopfkommentar oben entscheidet
 * begruendet und gemessen, dass die Apron in dieser Wahl nichts zu suchen hat; diese Entscheidung
 * ist juenger als #508 und wird hier nicht still ueberstimmt. Auf den KAUFWEGEN greift sie weiter
 * (`contract-negotiation-preview.ts`), dort spricht der Kommentar oben nicht. Ob sie auch bei
 * Verlaengerungen gelten soll, ist eine Entscheidung fuer Chris und in der Triage-Quittung notiert.
 */
export function chooseAiRenewalContractShape(input: {
  team: Team | null;
  entry: RosterEntry;
  recommendedLength: number;
  renewalSalary: number | null;
  cashGate: ReturnType<typeof buildAiRenewalCashGate>;
  profile: TeamStrategyProfile | null;
  /** Faktoren der Saisons, die dieser Vertrag bezahlt (Jahr 1 zuerst). Fehlt/zu kurz = keine Vorausschau. */
  termSalaryFactors?: readonly number[];
  /** Bisheriger Vertragsmix des Teams. Fehlt = kein Riegel, Verhalten unveraendert. */
  shapeContext?: ContractShapeTeamContext | null;
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

  // 1. Kassenklemme — unveraendert die erste Regel.
  if (tightNow && cashPreservationProfile) return "back_loaded";

  // 2. Konjunktur-Vorausschau. Steht VOR den Profil-Regeln und uebersteuert sie (Kopfkommentar,
  //    Rangfolge 2). Ohne nennenswertes Gefaelle schweigt sie und laesst die Profile entscheiden.
  const gefaelle = resolveSalaryFactorGefaelle(input.termSalaryFactors ?? []);
  if (gefaelle >= AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE) {
    // Auch die Faktor-Regel laeuft durch den Mix-Riegel: die Abnahme von #507 stellte 14 von 216
    // Vertraegen auf back_loaded — genau die Haeufung, die Chris begrenzt sehen wollte.
    return wendeLiquiditaetUndMixAn({
      form: "back_loaded",
      laufzeit: input.recommendedLength,
      // Der Kassen-Riegel greift hier nicht (er bremst nur front_loaded), steht aber der
      // Vollstaendigkeit halber mit dabei: alle drei Formwaehler geben dieselben Angaben.
      kassenstand: cash,
      gehaltsbergQuote: input.shapeContext?.gehaltsbergQuote,
    }).form;
  }
  if (gefaelle <= -AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE && cash >= input.cashGate.requiredReserve + 10) {
    return "front_loaded";
  }

  // 3. Profil-Neigungen.
  const ausRangfolge: ContractShape =
    strongCashBuffer && futureReliefProfile
      ? "front_loaded"
      : cashPriority >= 8 && !strongCashBuffer
        ? "back_loaded"
        : wageSensitivity >= 8 && cash >= input.cashGate.requiredReserve + 10
          ? "front_loaded"
          : "balanced";

  // 4. Mix-Riegel als letzte Instanz. Er VERSCHIEBT nur nach `balanced` und erzeugt nie
  //    `back_loaded` — die Rangfolge oben bleibt in jeder anderen Hinsicht unangetastet.
  return wendeLiquiditaetUndMixAn({
    form: ausRangfolge,
    laufzeit: input.recommendedLength,
    // NEU mit der Umstellung auf den Kassenstand: die Verlaengerung kannte den Riegel bisher gar
    // nicht (sie uebergab nur den Gehaltsberg) und konnte deshalb front_loaded verlaengern,
    // waehrend das Konto leer war. Der groesste Vertragsstrom ueberhaupt — 121 von 176
    // KI-Verlaengerungen in Saison 2 sind mehrjaehrig.
    kassenstand: cash,
    gehaltsbergQuote: input.shapeContext?.gehaltsbergQuote,
  }).form;
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

/**
 * EIN VERTRAGSENDE IST EIN VERKAUF — und wird deshalb genauso bepreist.
 *
 * CHRIS' ENTSCHEIDUNG: „ja gleicher abschlag wie beim verkauf -> du musst es so sehen dass
 * contract exits im grunde nichts anderes als ein verkauf sind bei uns im spiel."
 *
 * WAS VORHER WAR: diese Funktion nahm den ROHEN Breakdown. Der Verkaufsweg schickt ihn dagegen
 * durch `applySellPricingPolicyToBreakdown` — Saisonstart-Abschlag x Timing x Kaderdruck x
 * Team-Fit. Damit buchte ein auslaufender oder aufgeloester Vertrag dem Team einen Erloes gut, den
 * derselbe Spieler ueber den Transfermarkt nie gebracht haette. Nicht nur eine Anzeige daneben:
 * `buildContractExitValue` speist die tatsaechliche Gutschrift (Aufrufer in dieser Datei) UND den
 * Eintrag in der Transferhistorie.
 *
 * DER BELEG STAMMT AUS DER GEGENRICHTUNG: Lava Golem wurde am Live-Spielstand zwoelf Minuten nach
 * Chris' Meldung ueber den Markt verkauft, die Historie zeigt `fee 28.09` — waehrend der rohe
 * Breakdown 29,48 sagt. Verhaeltnis 0,9528, exakt die Policy. Ueber den ganzen Kader desselben
 * Spielstands gemessen wichen ROH und BEREINIGT bei 336 von 336 Vertraegen voneinander ab, im
 * Mittel 1,78, groesste Differenz 11,52 — durchweg zugunsten des Teams.
 *
 * DIE ANZEIGE WAR DIE ERSTE HAELFTE, das hier ist die zweite. `contract-negotiation-preview.ts`
 * hat die Auslauf-TABELLE bereits auf die Policy gezogen; blieb die BUCHUNG roh, zeigte die
 * Oberflaeche ab sofort die richtige Zahl und schriebe die falsche gut. Beide Seiten rufen jetzt
 * dieselbe Stufe mit derselben Kaderdruck-Regel.
 *
 * `marketValueAtExit` BLEIBT ROH — bewusst, und aus demselben Grund wie in der Anzeige: das ist
 * der Vergleichsmassstab. Verschoebe er sich mit, waere die ausgewiesene Differenz wieder eine
 * andere Zahl als die, die der Spieler sieht.
 */
function buildContractExitValue(gameState: GameState, player: Player | null, entry: RosterEntry | null): ContractExitValue {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
  const rohBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, entry);
  const rosterCount = entry
    ? gameState.rosters.filter((kadereintrag) => kadereintrag.teamId === entry.teamId).length
    : 0;
  const saleFactorBreakdown = entry
    ? applySellPricingPolicyToBreakdown({
        gameState,
        teamId: entry.teamId,
        player,
        rosterEntry: entry,
        baseBreakdown: rohBreakdown,
        // Wie im Verkaufsweg: der Kaderdruck-Malus liest die Groesse NACH diesem Abgang, sonst
        // bewertete er einen Kader, den es danach nicht mehr gibt.
        rosterAfter: Math.max(0, rosterCount - 1),
      }).breakdown
    : rohBreakdown;
  const exitValue = roundMoney(saleFactorBreakdown.salePrice ?? economy.marketValue);
  // AUSDRUECKLICH vom ROHEN Breakdown: der Vergleichsmassstab darf sich nicht mitverschieben.
  // Die Policy laesst `baseMarketValue` heute ohnehin unberuehrt — hier steht es trotzdem
  // explizit, damit die Absicht im Code steht und nicht in einer Annahme ueber fremden Code.
  const marketValueAtExit = roundMoney(rohBreakdown.baseMarketValue ?? economy.marketValue);
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
  const gmArchetype = getTeamGeneralManager(save.gameState, entry.teamId)?.profile?.archetype ?? null;
  const recommendedLength = getRecommendedLength(entry, player, rating, team, teamStrategyProfile, gmArchetype);
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
      xpAvailable: null, // XP-System abgeschafft: kein currentXP-Read mehr (Feld deprecated, immer null).
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
          termSalaryFactors: resolveContractTermSalaryFactors(save.gameState, recommendedLength),
          shapeContext: getContractShapeTeamContext(save.gameState, entry.teamId),
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
    gmArchetype,
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
              : // No economic trigger forced this exit (cash was fine, value/TCO were fine) — the player simply
                // wouldn't stay. Surface morale as the visible reason instead of a generic "heuristic_release",
                // matching what renewalBlockReason already reports. (Cash-gated/bad-value exits keep their
                // economic reason as the proximate cause; the player's morale disposition is still on the row.)
                morale?.contractIntent === "refuses_extension" || morale?.contractIntent === "considering_exit"
                ? "morale_release"
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
    xpAvailable: null, // XP-System abgeschafft: kein currentXP-Read mehr (Feld deprecated, immer null).
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
  /**
   * Verlängerung, Auflösung und der Saisonende-Vertragstick ändern Gehälter — und damit die GuV,
   * die der Finanzen-Reiter aus dem Spielstand liest. Wie im Transfermarkt zieht die gespeicherte
   * Zeile hier nach, sonst veraltet sie ab der ersten Vertragsentscheidung im Saisonende-Fenster
   * gegenüber dem live rechnenden Saisonstand (Meldung `1rh8lx`).
   *
   * Auch hier am gemeinsamen Schreibpunkt und nicht an den Aufrufern: `applyContractRenewalAction`
   * (Spieler wie KI) und `applySeasonEndContractTick` laufen beide hier durch. Außerhalb des
   * Saisonende-Fensters ist der Aufruf ein Nichtstun.
   */
  persistGameStateWithMaterializedDerivations(
    persistence,
    save.saveId,
    zieheSaisonstandGuvNachImSaisonendfenster({
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        contractEvents: gameState.seasonState.contractEvents ?? [],
      },
    }),
  );
}

function buildPromisedRoleRelationshipEvents(gameState: GameState): PlayerRelationshipEventRecord[] {
  const timestamp = new Date().toISOString();
  return gameState.rosters.flatMap((entry) => {
    if (!entry.promisedRole) return [];
    // Liest die Einsatzzeit-vs-Rollenerwartung direkt aus (siehe `evaluatePromisedRoleAttendanceOutcome`),
    // statt wie frueher ueber Moral-Reasons ("good_playtime"/"low_playtime") -- die wirken seit der
    // Behebung der Doppelzaehlung (`appearances` trieb zusaetzlich zur "Einsätze"-Forderung noch einen
    // zweiten, direkten Moral-Ausschlag) nicht mehr auf die Moral und tauchen dort nicht mehr auf.
    const outcome = evaluatePromisedRoleAttendanceOutcome(gameState, entry.playerId, entry.promisedRole);
    if (!outcome) return [];
    const result =
      outcome.outcome === "broken"
        ? "promised_role_broken"
        : outcome.outcome === "exceeded"
          ? "promised_role_exceeded"
          : "promised_role_fulfilled";
    return [{
      eventId: `relationship__${gameState.season.id}__${entry.teamId}__${entry.playerId}__${result}`,
      seasonId: gameState.season.id,
      teamId: entry.teamId,
      playerId: entry.playerId,
      reason: `${result}:${entry.promisedRole}`,
      delta: outcome.delta,
      severity: outcome.delta < 0 ? "negative" : outcome.delta > 0 ? "positive" : "neutral",
      createdAt: timestamp,
      source: "promised_role_morale",
    } satisfies PlayerRelationshipEventRecord];
  });
}

// Idempotenz-Marker der Saison-Vertragsalterung. Wird als preSeasonWorkflowLogs-Eintrag je
// fromSeasonId geführt, damit die Alterung pro echtem Saisonübergang GENAU EINMAL läuft — egal ob
// sie über den (Vorschau-)Schritt contract_renewal, den Sim-Apply oder den interaktiven
// Saisonübergang (buildNextSeasonGameState) angestoßen wird. Der stepId ist ein freier String im
// PreSeasonWorkflowLogRecord-Typ, deshalb keine Änderung an gemeinsamen Typen nötig.
export const SEASON_END_CONTRACT_TICK_STEP_ID = "season_end_contract_tick";

/** Wurde die Vertragsalterung für die AKTUELLE (auslaufende) Saison bereits angewandt? */
export function hasSeasonEndContractTickApplied(gameState: GameState): boolean {
  const seasonId = gameState.season.id;
  return (gameState.seasonState.preSeasonWorkflowLogs ?? []).some(
    (log) =>
      log.stepId === SEASON_END_CONTRACT_TICK_STEP_ID &&
      log.fromSeasonId === seasonId &&
      log.status === "applied",
  );
}

function buildSeasonEndContractTickLog(input: {
  save: PersistedSaveGame;
  renewedPlayers: number;
  releasedPlayers: number;
  contractEventsWritten: number;
}): PreSeasonWorkflowLogRecord {
  return {
    logId: `season-end-contract-tick__${input.save.saveId}__${input.save.gameState.season.id}__${randomUUID()}`,
    saveId: input.save.saveId,
    fromSeasonId: input.save.gameState.season.id,
    toSeasonId: input.save.gameState.season.id,
    stepId: SEASON_END_CONTRACT_TICK_STEP_ID,
    status: "applied",
    errors: [],
    warnings: [
      `contract_tick_renewed:${input.renewedPlayers}`,
      `contract_tick_released:${input.releasedPlayers}`,
      `contract_tick_events:${input.contractEventsWritten}`,
    ],
    affectedEntities: [
      "rosters.contractLength",
      "rosters.contractStatus",
      "rosters.yearlySalarySchedule",
      "teams.cash",
      "seasonState.contractEvents",
      "transferHistory",
    ],
    timestamp: new Date().toISOString(),
  };
}

export type SeasonEndContractTickComputation = {
  /** Fortgeschriebener GameState (rosters/teams.cash/contractEvents/transferHistory + Marker) — NICHT persistiert. */
  gameState: GameState;
  preview: ContractSeasonEndPreview;
  /** true, wenn in DIESEM Aufruf tatsächlich gealtert wurde. */
  applied: boolean;
  /** true, wenn die Alterung für diese Saison bereits vorher lief (No-Op, kein Doppel-Tick). */
  alreadyApplied: boolean;
  releasedPlayers: number;
  renewedPlayers: number;
  contractEventsWritten: number;
  /** Entscheidungen der KI ueber Vertragsaufloesungen auf Spielerwunsch (leer, wenn keine anlagen). */
  dissolutions: AiDissolutionDecision[];
};

/**
 * Reine (persistenzfreie) Saison-Vertragsalterung. Schreibt contractLength/Status/Gehaltsplan fort,
 * lässt 0-Jahres-Verträge auslaufen (Free-Agent-Exit-Cash fließt in team.cash), fährt KI-Verlängern/
 * -Freigeben und liefert den fortgeschriebenen GameState zurück — OHNE zu persistieren. Idempotent
 * über hasSeasonEndContractTickApplied: ist der Tick für die auslaufende Saison schon gelaufen, wird
 * der GameState unverändert zurückgegeben (alreadyApplied=true). Diese Funktion wird sowohl vom
 * token-geprüften Apply (applySeasonEndContractTick, Route/Sim) als auch vom echten Saisonübergang
 * (buildNextSeasonGameState) genutzt, damit Verträge im echten Spiel wirklich altern — GENAU EINMAL.
 */
export function computeSeasonEndContractTick(
  save: PersistedSaveGame,
  previewOverride?: ContractSeasonEndPreview,
): SeasonEndContractTickComputation {
  if (hasSeasonEndContractTickApplied(save.gameState)) {
    return {
      gameState: save.gameState,
      preview: previewOverride ?? previewSeasonEndContracts(save),
      applied: false,
      alreadyApplied: true,
      releasedPlayers: 0,
      renewedPlayers: 0,
      contractEventsWritten: 0,
      dissolutions: [],
    };
  }

  const preview = previewOverride ?? previewSeasonEndContracts(save);
  const rowsByRosterId = new Map(preview.rows.map((row) => [row.rowId, row] as const));

  /**
   * VERTRAGSAUFLOESUNGEN DER KI — VOR der Alterung, aus demselben Dienst wie beim Menschen.
   *
   * Der Preis eines Angebots rechnet mit `contractLength - 1` (das laufende Vertragsjahr ist zum
   * Saisonende gespielt). Liefe die Entscheidung NACH der Alterung, waere der Vertrag bereits
   * fortgeschrieben und der Rest-Buyout um ein Jahr zu klein. Sie steht deshalb hier — und nicht
   * in `buildNextSeasonGameState`, wo der Tick im Sim-Pfad schon gelaufen waere.
   *
   * Die Angebote sind an dieser Stelle einmalig: `buildContractDissolutionOffers` sperrt einen
   * Spieler nach der Entscheidung fuer die laufende Saison, und dieser Tick laeuft je Saison genau
   * einmal (`hasSeasonEndContractTickApplied`, oben).
   *
   * Was die KI von der Vertrags-Vorschau uebernimmt, ist die Frage „wollte das Team ihn ueberhaupt
   * behalten?" — bei einem auslaufenden Vertrag ist genau das der Unterschied zwischen Ablehnen
   * (er bleibt und wird verlaengert) und Ablehnen ohne Wirkung (er geht ein paar Zeilen weiter
   * unten mit demselben Erloes durch `buildContractExitValue`).
   */
  const renewalSignals = new Map<string, AiDissolutionRenewalSignal>(
    preview.rows.map((row) => [
      `${row.teamId}:${row.playerId}`,
      {
        wouldRenew: row.recommendedAction === "renew" && row.canRenewEffective,
        renewalSalary: row.renewalSalaryPreview,
        renewalLength: row.recommendedLength,
      },
    ]),
  );
  const dissolutionRun = applyAiContractDissolutions({
    gameState: save.gameState,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    decidedAt: new Date().toISOString(),
    renewalSignals,
  });
  const sourceState = dissolutionRun.gameState;
  const playersById = new Map(sourceState.players.map((player) => [player.id, player] as const));
  const nextRosters: RosterEntry[] = [];
  const contractEvents: ContractEventRecord[] = [];
  const transferHistory: TransferHistoryEntry[] = [];
  const cashDeltaByTeamId = new Map<string, number>();
  const teamReleaseCounts = new Map<string, number>();
  const MAX_RELEASES_PER_TEAM_PER_TICK = 3;

  /**
   * HIER STAND EIN SCHUTZ FUER „FRISCH UNTERSCHRIEBENE" VERTRAEGE — er ist weg, und das ist die
   * Korrektur eines Fehlers, den ich selbst eingebaut habe.
   *
   * Er kam mit der Freigabe der Verlaengerung in der letzten Vertragssaison und sollte verhindern,
   * dass ein VOR dem Tick unterschriebener Vertrag hier noch ein Jahr verliert. Die Annahme
   * dahinter war, dass verlaengert werden kann, bevor die Alterung laeuft.
   *
   * Genau diese Annahme ist inzwischen falsch: die Alterung laeuft beim Betreten der
   * Saisonende-Phase (`season-transition-service.ts`) und wird fuer Altstaende an der
   * Vertragsroute nachgezogen (`vertragsalterung-nachziehen.ts`). Eine Verlaengerung liegt damit
   * IMMER hinter dem Tick — es gibt nichts mehr zu schuetzen.
   *
   * Stehen bleiben durfte er trotzdem nicht. Am gemeldeten Spielstand gemessen: Xelara trug zwei
   * `manual_contract_renewal`-Ereignisse aus der kaputten Zwischenzeit und wurde deshalb von der
   * Alterung ausgenommen — sie blieb als EINZIGE des Teams auf Laufzeit 1 „auslaufend" stehen,
   * waehrend die anderen drei sauber alterten. Der Schutz zementierte genau den Zustand, aus dem
   * Chris nicht herauskam („er sagt zwar verlängert aber sie steht einfach immernoch auf
   * auslaufendem vertrag").
   */
  for (const entry of sourceState.rosters) {
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
          seasonIdBase: sourceState.season.id,
          seasonLabelBase: getSeasonLabel(sourceState),
        }).yearlySalarySchedule;
        nextRosters.push({
          ...entry,
          salary: newSalary,
          upkeep: newSalary,
          // UNTERSCHRIFTSPFAD: KI-Verlaengerung. Das Verhandlungs-Benchmark ist das JAHRESGEHALT
          // des neuen Vertrags, nicht dessen erste Rate — `newSalary` ist genau die Zahl, aus der
          // `buildContractSalarySchedule` die Raten formt.
          negotiatedAnnualSalary: newSalary,
          contractLength: renewLength,
          contractStatus: renewLength === 1 ? "expiring" : "active",
          contractShape,
          yearlySalarySchedule: nextContractSchedule,
        });
        contractEvents.push(
          buildContractEvent({
            seasonId: sourceState.season.id,
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
          // UNTERSCHRIFTSPFAD: Brueckenverlaengerung ueber ein Jahr. Auch sie ist eine Unterschrift.
          negotiatedAnnualSalary: bridgeSalary,
          contractLength: 1,
          contractStatus: "expiring",
          contractShape: "balanced",
        });
        contractEvents.push(
          buildContractEvent({
            seasonId: sourceState.season.id,
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

      const exit = buildContractExitValue(sourceState, playerForExit, entry);
      const source: ContractEventRecord["source"] = row?.controlMode === "ai" ? "ai_contract_expiry" : "manual_contract_expiry";
      if (exit.exitValue != null) {
        cashDeltaByTeamId.set(entry.teamId, (cashDeltaByTeamId.get(entry.teamId) ?? 0) + exit.exitValue);
      }
      transferHistory.push(
        buildContractExitTransferHistory({
          gameState: sourceState,
          entry,
          player: playerForExit,
          exit,
          source,
        }),
      );
      contractEvents.push(
        buildContractEvent({
          seasonId: sourceState.season.id,
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

  const releasedPlayers = contractEvents.filter(
    (event) => event.eventType === "contract_expired" || event.eventType === "player_released" || event.eventType === "contract_expired_exit",
  ).length;
  const renewedPlayers = contractEvents.filter((event) => event.eventType === "contract_renewed").length;
  const contractEventsWritten = contractEvents.length;

  // Idempotenz-Marker der auslaufenden Saison in die Workflow-Logs schreiben. Er wandert beim
  // Saisonübergang über den seasonState-Spread in die neue Saison mit und verhindert dort einen
  // zweiten Tick auf denselben (fromSeasonId-)Übergang. Ein SPÄTERER Übergang (neue Saison) hat eine
  // andere fromSeasonId und altert korrekt erneut.
  const tickLog = buildSeasonEndContractTickLog({ save, renewedPlayers, releasedPlayers, contractEventsWritten });

  const gameState: GameState = {
    ...sourceState,
    teams: sourceState.teams.map((team) => {
      const cashDelta = cashDeltaByTeamId.get(team.teamId) ?? 0;
      return cashDelta === 0
        ? team
        : {
            ...team,
            cash: roundMoney(team.cash + cashDelta) ?? team.cash + cashDelta,
          };
    }),
    rosters: nextRosters,
    transferHistory: [...transferHistory, ...sourceState.transferHistory],
    seasonState: {
      ...sourceState.seasonState,
      contractEvents: [...contractEvents, ...(sourceState.seasonState.contractEvents ?? [])],
      preSeasonWorkflowLogs: [tickLog, ...(sourceState.seasonState.preSeasonWorkflowLogs ?? [])],
    },
    logs: [
      {
        id: `contract-season-end:${sourceState.season.id}:${randomUUID()}`,
        type: "season",
        message: `Vertragslaufzeiten fuer ${sourceState.season.name} fortgeschrieben.`,
        createdAt: new Date().toISOString(),
      },
      ...sourceState.logs,
    ],
  };
  const relationshipEvents = buildPromisedRoleRelationshipEvents(sourceState);
  const relationshipEventIds = new Set(relationshipEvents.map((event) => event.eventId));
  const gameStateWithRelationshipEvents: GameState = {
    ...gameState,
    playerRelationshipEvents: [
      ...relationshipEvents,
      ...(sourceState.playerRelationshipEvents ?? []).filter((event) => !relationshipEventIds.has(event.eventId)),
    ],
  };

  return {
    gameState: gameStateWithRelationshipEvents,
    preview,
    applied: true,
    alreadyApplied: false,
    releasedPlayers,
    renewedPlayers,
    contractEventsWritten,
    dissolutions: dissolutionRun.decisions,
  };
}

/**
 * Token-geprüfter, PERSISTIERENDER Season-End-Vertrags-Tick (Route/Sim-Pfad). Prüft den Confirm-Token,
 * ruft die reine computeSeasonEndContractTick und schreibt das Ergebnis über
 * saveGameStateWithContractEvents. Ist die Alterung für diese Saison bereits gelaufen (z. B. schon über
 * den echten Saisonübergang), ist der Aufruf ein idempotenter No-Op (applied=false, kein Doppel-Tick).
 */
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

  const computation = computeSeasonEndContractTick(save, preview);
  if (computation.alreadyApplied) {
    // Bereits in dieser Saison gealtert (z. B. über den interaktiven Saisonübergang). Kein zweiter
    // Tick, keine doppelte Cash-Buchung — sauberer No-Op mit Hinweis-Warnung.
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      releasedPlayers: 0,
      renewedPlayers: 0,
      contractEventsWritten: 0,
      warnings: Array.from(new Set([...preview.warnings, "season_end_contract_tick_already_applied"])),
    };
  }

  saveGameStateWithContractEvents(save, computation.gameState, persistence);

  const dissolutionsAccepted = computation.dissolutions.filter((entry) => entry.decision === "accepted").length;
  return {
    ...preview,
    dryRun: false,
    productiveWrites: true,
    applied: true,
    releasedPlayers: computation.releasedPlayers,
    renewedPlayers: computation.renewedPlayers,
    contractEventsWritten: computation.contractEventsWritten,
    warnings:
      computation.dissolutions.length > 0
        ? Array.from(
            new Set([
              ...preview.warnings,
              `ai_contract_dissolutions:${dissolutionsAccepted}/${computation.dissolutions.length}`,
            ]),
          )
        : preview.warnings,
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
  /**
   * GEMELDET VON CHRIS: „ich kann die verträge im aktuellen save nicht verlängern obwohl wir in
   * der vertrags phase sind!"
   *
   * Die Regel war um genau ein Jahr daneben. Sie verlangte `contractLength <= 0` — einen Vertrag,
   * der bereits abgelaufen IST. `contractLength` zaehlt aber die Saisons EINSCHLIESSLICH der
   * laufenden: eine 1 heisst „das hier ist seine letzte Saison", und genau dieser Spieler ist der,
   * ueber den am Saisonende entschieden wird. Auf 0 faellt er erst durch die Vertragsalterung,
   * und die laeuft im Saisonuebergang — also NACH dem Fenster, in dem verlaengert werden soll.
   *
   * Am gemeldeten Spielstand (Saison 1, Spieltag 10, Phase `season_end_management`) gemessen:
   * 288 von 339 Vertraegen standen auf Laufzeit 1, kein einziger auf 0. Verlaengerbar war damit
   * NIEMAND — nicht ein Spieler in der ganzen Liga.
   *
   * Der Rest des Spiels rechnete laengst mit der richtigen Bedeutung: die Inbox meldet
   * `contractLength <= 1` als auslaufend, das Auslauf-Board schreibt „Letzte Vertragssaison —
   * endet nach MD10. Verlaengern", und der Knopf in der Kaderansicht traegt im Code den Hinweis,
   * dass „LZ > 1 (noch) blockiert" sei — also LZ 1 ausdruecklich nicht. Nur diese eine Zeile
   * hielt dagegen.
   *
   * WANN es trotzdem nicht beliebig geht, bleibt unveraendert: der Phasen-Riegel
   * (`evaluateGamePhaseAction`) laesst `renew_contract` nur im Saisonende-Fenster und im
   * Saisonstart-Setup zu. Diese Zeile sagt WER, nicht WANN.
   */
  const renewalEligible =
    input.action !== "renew" ||
    currentContractLength <= 1 ||
    rosterEntry?.contractStatus === "renewal_pending" ||
    rosterEntry?.contractStatus === "out_of_contract";
  // Audit R2/V3: Release NUR bei ausgelaufenem Vertrag zulässig. Ein laufender Vertrag (contractLength > 0)
  // hat einen offenen Buyout — Release würde den vollen salePrice ohne Buyout-Abzug auszahlen und damit den
  // regulären Verkauf (netProceeds = salePrice − buyoutCost) unterbieten (Buyout-Umgehung). Unter Vertrag
  // stehende Spieler müssen über den Transfermarkt verkauft werden; nur ausgelaufene Verträge sind releasebar
  // (dann ist der Buyout ohnehin 0, keine Lücke).
  const releaseEligible =
    input.action !== "release" ||
    currentContractLength <= 0 ||
    rosterEntry?.contractStatus === "renewal_pending" ||
    rosterEntry?.contractStatus === "out_of_contract" ||
    rosterEntry?.contractStatus === "released";
  const blockingReasons = [
    !team ? "team_not_found" : null,
    !player ? "player_not_found" : null,
    !rosterEntry ? "player_not_on_team_roster" : null,
    !renewalEligible ? "renewal_only_allowed_at_contract_end" : null,
    !releaseEligible ? "release_only_allowed_at_expired_contract" : null,
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
                // UNTERSCHRIFTSPFAD: Verlaengerung ueber die Vertragsaktion (Mensch wie KI).
                negotiatedAnnualSalary: newSalary ?? entry.negotiatedAnnualSalary ?? entry.salary,
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
