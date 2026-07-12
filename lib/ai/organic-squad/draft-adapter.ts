/**
 * Organic squad builder — gameState adapter (Master-Plan P2 wiring layer).
 *
 * Maps the live domain model (Player, TeamIdentity, GM bias, team economy, disciplines) into the pure
 * utility inputs and runs buildOrganicSquadPlan. Kept separate from the pure engine so the engine stays
 * gameState-free and testable. This module reads gameState but MUTATES NOTHING — callers apply the
 * returned decisions. Flag-gated at the call site (OLY_ORGANIC_SQUAD_BUILDER); default OFF.
 *
 * Forecast economy inputs (expected prize / sponsor / facility / transfer) are conservative at draft
 * time and are refined in P3 — the P2 goal is the emergent buy/stop/coverage behaviour, not exact cash.
 */

import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import { computeDisciplineNeeds, deriveNeedAxisWeights } from "@/lib/ai/organic-squad/discipline-need";
import {
  buildOrganicSquadPlan,
  type OrganicBuyDecision,
  type OrganicTradeDownDecision,
} from "@/lib/ai/organic-squad/draft-builder";
import {
  CATEGORY_TO_AXIS,
  ROSTER_MAX,
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicGmBiasInput,
  type OrganicIdentityInput,
  type OrganicPlayerView,
  type OrganicTeamState,
  type OrganicUtilityWeights,
} from "@/lib/ai/organic-squad/types";
import { sellUtility } from "@/lib/ai/organic-squad/utility";
import { deriveUtilityWeights, resolveRenewalContractLength } from "@/lib/ai/organic-squad/weights";
import { draftUnit } from "@/lib/ai/market-pick-engine/slot-sequence";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import {
  buildTeamThemeCompositionRuntimeContext,
  derivePlayerThemeTags,
  type TeamThemeCompositionRuntimeContext,
} from "@/lib/ai/team-theme-composition-service";

/** Small flat solvency buffer (MW) — the floor of the cash hard blocker; spend above it is emergent. */
const ORGANIC_CASH_BUFFER = 5;
/**
 * The cash buffer scales with the club's WAGE BILL ("auch Top-/Aggro-Teams sollen was auf die Seite legen,
 * z.B. 0.25–0.5× Salary"): a club must keep roughly this fraction of its recurring salary as reserve, so a
 * high-wage aggressive club can't spend down to ~0 and then be unable to refill next window. It also feeds
 * the SELL distress factor (cashHealth = cash / buffer): a bigger wage bill raises the buffer, so an
 * over-salaried club reads as more cash-strapped and sheds expensive/high-wage players harder.
 */
const RESERVE_SALARY_FACTOR = 0.35;

/** Sum the team's current roster salaries (same salary source as toOrganicPlayerView). */
function resolveRosterSalaryTotal(gameState: GameState, teamId: string): number {
  let total = 0;
  const players = gameState.players ?? [];
  for (const entry of gameState.rosters ?? []) {
    if (entry.teamId !== teamId) continue;
    const player = players.find((candidate) => candidate.id === entry.playerId);
    if (player) total += Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0);
  }
  return total;
}

/** 0..100 (or 0..10 legacy) management value → 0..1, matching normalizeManagementValue. */
function normId(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  const scaled = value <= 10 ? value / 10 : value / 100;
  return Math.min(1, Math.max(0, scaled));
}

/**
 * Build the utility player view from a domain Player (quality from stats; marketValue = price only).
 * `purchasePrice` (the roster entry's cost basis) is threaded only for SELL views — it feeds the
 * profit-flip term in sellUtility. Buy/draft views omit it (undefined ⇒ no profit signal).
 */
export function toOrganicPlayerView(
  player: Player,
  themeFit?: number,
  purchasePrice?: number | null,
): OrganicPlayerView {
  return {
    playerId: player.id,
    pow: player.coreStats?.pow ?? 0,
    spe: player.coreStats?.spe ?? 0,
    men: player.coreStats?.men ?? 0,
    soc: player.coreStats?.soc ?? 0,
    disciplineRatings: player.disciplineRatings ?? {},
    marketValue: Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0),
    salary: Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0),
    purchasePrice:
      typeof purchasePrice === "number" && Number.isFinite(purchasePrice) ? Math.max(0, purchasePrice) : undefined,
    potential: player.potential ?? null,
    themeFit,
  };
}

/**
 * Maps a team-theme-composition-service `themeTier` to a 0..1 fit signal for the organic model.
 * Ordered by how central the tier is to the club's IDENTITY (not its market-value/quality override
 * eligibility). GRADED tag overlap so identity shows through the FLAVOUR, not just a gender flag:
 * a themed dark-fantasy player (e.g. a succubus with Succubus/Temptress/SexyDemon tags) scores far
 * above a plain primary-tag match (e.g. any female), and an avoid-tag player (e.g. a Construct on a
 * dark team) is pushed out — while a strongly-themed off-primary player (e.g. a male incubus) can
 * still rank above a plain primary match, so the roster leans ~primary but carries real theme flavour.
 */
const THEME_PRIMARY_WEIGHT = 0.7;
const THEME_SECONDARY_WEIGHT = 0.3;
const THEME_SECONDARY_CAP = 2;
const THEME_SOFT_WEIGHT = 0.1;
const THEME_SOFT_CAP = 2;
/** An allowed-outsider tag (e.g. V-D's male animal "pets") makes an off-primary player acceptable. */
const THEME_OUTSIDER_WEIGHT = 0.3;
const THEME_AVOID_PENALTY = 0.6;

/**
 * The configured team strictness scales how hard the theme bites: a "hard" 95%-quota club (e.g. V-D)
 * must land nearly all themed picks, a "soft" club only leans. Multiplies the raw fit (which may go
 * negative via avoid tags), so hard clubs get a strong positive pull for themed players and a strong
 * negative push against avoid-tag players, while soft clubs get a gentle nudge.
 */
const THEME_STRICTNESS_MULT: Record<string, number> = { hard: 8.0, strong: 2.4, medium: 1.2, soft: 0.7 };

/**
 * Graded per-(team, player) theme-fit signal (0..1) from actual tag overlap between the player's
 * derived theme tags and the team's target tag sets. Reuses derivePlayerThemeTags (race/class/
 * subclass/gender/trait/alignment) — no reinvented theme rules. Callers build `runtimeContext` ONCE
 * per team and pass it in per candidate. Returns undefined when the team has no theme target.
 */
export function computeThemeFit(
  gameState: GameState,
  team: Pick<Team, "teamId" | "name">,
  player: Player,
  runtimeContext: TeamThemeCompositionRuntimeContext,
): number | undefined {
  const target = runtimeContext.target;
  if (!target) return undefined;
  const tags = new Set(derivePlayerThemeTags(player).playerThemeTags);
  const countMatches = (list: string[]) => list.reduce((n, tag) => (tags.has(tag) ? n + 1 : n), 0);

  const primaryMatch = countMatches(target.primaryThemeTags) > 0 ? 1 : 0;
  const secondaryMatches = Math.min(countMatches(target.secondaryThemeTags), THEME_SECONDARY_CAP);
  const softMatches = Math.min(countMatches(target.softPreferredTags), THEME_SOFT_CAP);
  const avoidMatches = countMatches(target.avoidTags);
  // Off-primary but explicitly allowed (e.g. a female-Amazon team's male animal pets): acceptable,
  // not preferred over themed primary players.
  const outsiderMatch = !primaryMatch && countMatches(target.allowedOutsiderTags) > 0 ? 1 : 0;

  // For a HARD-strictness QUOTA club, secondary/soft tags are FLAVOUR ON TOP OF the primary tag, not
  // standalone credit: an off-primary player must not earn theme pull just for sharing a secondary tag
  // (e.g. a non-Viking Berserker on a ~75%-Viking club). Otherwise, when the primary tag is RARE
  // (few cheap Vikings), strong off-primary secondary-sharers out-compete and drain the budget before
  // the quota is met. So off-primary players on a hard club get only the (small) allowed-outsider
  // credit minus avoid — reserving preference + budget for genuine primary-tag players. Softer clubs
  // keep the graded "leans toward flavour" behaviour where secondary tags count on their own.
  const hardQuota = target.strictness === "hard";
  const flavourCounts = hardQuota && !primaryMatch ? 0 : 1;
  const rawFit =
    THEME_PRIMARY_WEIGHT * primaryMatch +
    THEME_SECONDARY_WEIGHT * secondaryMatches * flavourCounts +
    THEME_SOFT_WEIGHT * softMatches * flavourCounts +
    THEME_OUTSIDER_WEIGHT * outsiderMatch -
    THEME_AVOID_PENALTY * avoidMatches;
  const strictnessMult = THEME_STRICTNESS_MULT[target.strictness] ?? 1;
  // May be negative (avoid) for hard clubs, so buyUtility actively pushes those players out. Ceiling
  // is generous (×THEME_FIT_VALUE downstream) so a HARD-strictness quota club (V-V ~75% Viking, V-D
  // ~95% female) pulls themed players strongly enough to act quota-like — a themed candidate then out-
  // scores a moderately-stronger off-theme one — while medium/soft clubs (low mult) stay a gentle tilt.
  return Math.min(6, Math.max(-2, strictnessMult * rawFit));
}

/** Team playstyle axis emphasis from identity.pow/spe/men/soc, normalized to sum 1 (fallback equal). */
export function buildIdentityAxisWeights(identity: TeamIdentity | null | undefined): Record<CoreAxis, number> {
  const raw: Record<CoreAxis, number> = {
    pow: Math.max(0, identity?.pow ?? 0),
    spe: Math.max(0, identity?.spe ?? 0),
    men: Math.max(0, identity?.men ?? 0),
    soc: Math.max(0, identity?.soc ?? 0),
  };
  const sum = raw.pow + raw.spe + raw.men + raw.soc;
  if (sum <= 0) return { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };
  return { pow: raw.pow / sum, spe: raw.spe / sum, men: raw.men / sum, soc: raw.soc / sum };
}

/** gameState disciplines → the minimal {id, category} the engine needs. */
export function resolveOrganicDisciplines(gameState: GameState): OrganicDiscipline[] {
  return (gameState.disciplines ?? []).map((d) => ({ id: d.id, category: d.category }));
}

function resolveGmBias(gameState: GameState, teamId: string): OrganicGmBiasInput {
  const bias = getTeamGeneralManager(gameState, teamId)?.profile?.bias;
  if (!bias) return {};
  return {
    starPriority: bias.starPriority,
    valuePriority: bias.valuePriority,
    cashPriority: bias.cashPriority,
    riskTolerance: bias.riskTolerance,
    rosterDepthPreference: bias.rosterDepthPreference,
    eliteSmallRosterPreference: bias.eliteSmallRosterPreference,
    loyaltyBias: bias.loyaltyBias,
    wageSensitivity: bias.wageSensitivity,
    sellForProfitAggression: bias.sellForProfitAggression,
    shortContractPreference: bias.shortContractPreference,
    longContractPreference: bias.longContractPreference,
  };
}

/** Identity → the minimal management-scale inputs the weight/contract-length derivations read. */
function buildOrganicIdentityInput(identity: TeamIdentity | null | undefined): OrganicIdentityInput {
  return {
    ambition: identity?.ambition ?? 50,
    finances: identity?.finances ?? 55,
    boardConfidence: identity?.boardConfidence ?? 50,
    harmony: identity?.harmony ?? 50,
    playerOpt: identity?.playerOpt ?? 10,
  };
}

export type OrganicDraftPlanInput = {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
  /** Players already on the roster (their disciplines count toward coverage). */
  startingSquad: Player[];
  /** Available free agents to choose from. */
  candidates: Player[];
  /** Conservative forecast planning inputs (refined in P3). */
  forecast?: {
    expectedPrize?: number;
    sponsorIncome?: number;
    facilityNet?: number;
    netTransfer?: number;
  };
  /** Optional per-(save, team) seed for the reproducible buy-utility jitter (see draft-builder.ts). */
  draftSeed?: string | null;
};

export type OrganicDraftPlanResult = {
  decisions: OrganicBuyDecision[];
  /** Trade-down sells the executor must apply BEFORE the buys (they fund the fills). */
  sellDecisions: OrganicTradeDownDecision[];
  finalCash: number;
  finalSalaryTotal: number;
  finalRosterSize: number;
  stoppedBelowMin: boolean;
  optTarget: number;
};

/**
 * Team-level scalar context shared by the draft (buy) planner and the in-season sell planner: the
 * derived utility weights, identity axis weights, discipline catalog, theme runtime context, and the
 * team economy scalars (cash / cash buffer / board risk / roster max). Squad-specific inputs
 * (starting squad views, salary total, candidate views) are built per planner from their own player
 * lists; only this identity/economy assembly is common, so it is factored out here rather than
 * duplicated between the two planners.
 */
type OrganicPlanContext = {
  weights: OrganicUtilityWeights;
  identityAxisWeights: Record<CoreAxis, number>;
  disciplines: OrganicDiscipline[];
  themeRuntimeContext: TeamThemeCompositionRuntimeContext;
  cash: number;
  /** Small flat solvency buffer (the only cash hard blocker). */
  cashBuffer: number;
  boardRisk: number;
  rosterMax: number;
};

function buildOrganicPlanContext(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
  /** Optional per-(save, team) seed for the reproducible strategy-weight jitter (see weights.ts). */
  draftSeed?: string | null;
}): OrganicPlanContext {
  const identityInput = buildOrganicIdentityInput(input.identity);
  // Per-save/season strategy variance: same team identity + GM handwriting, but a slightly different
  // "budget feel" across saves/seasons (see STRATEGY_WEIGHT_JITTER/STRATEGY_OPT_JITTER in weights.ts).
  const variationSeed = input.draftSeed ? `${input.draftSeed}:${input.gameState.season.id}` : null;
  const weights = deriveUtilityWeights(
    identityInput,
    resolveGmBias(input.gameState, input.team.teamId),
    variationSeed,
  );
  return {
    weights,
    identityAxisWeights: buildIdentityAxisWeights(input.identity),
    disciplines: resolveOrganicDisciplines(input.gameState),
    // Build the team's theme runtime context ONCE (cached rosterShare/themedPoolCount), then reuse it
    // for every candidate's themeFit lookup — never recomputed per player.
    themeRuntimeContext: buildTeamThemeCompositionRuntimeContext(input.gameState, input.team),
    cash: input.team.cash ?? 0,
    // Solvency buffer = max(flat floor, 0.35× wage bill). The salary-scaled part makes even aggressive
    // clubs keep a reserve proportional to what they must pay each season, instead of spending to ~0 and
    // stranding themselves below min next window; it also sharpens the sell distress factor for
    // over-salaried clubs. How much a club keeps ABOVE the buffer stays emergent (wPatience).
    cashBuffer: Math.max(
      ORGANIC_CASH_BUFFER,
      RESERVE_SALARY_FACTOR * resolveRosterSalaryTotal(input.gameState, input.team.teamId),
    ),
    boardRisk: 1 - normId(input.identity?.boardConfidence),
    rosterMax: Math.min(ROSTER_MAX, input.team.rosterLimit ?? ROSTER_MAX),
  };
}

/** Assemble utility inputs from gameState and run the greedy organic plan for one team. */
export function planOrganicDraftForTeam(input: OrganicDraftPlanInput): OrganicDraftPlanResult {
  const ctx = buildOrganicPlanContext({
    gameState: input.gameState,
    team: input.team,
    identity: input.identity,
    draftSeed: input.draftSeed ?? null,
  });
  const startingSquad = input.startingSquad.map((player) => toOrganicPlayerView(player));
  const candidates = input.candidates
    .map((player) => toOrganicPlayerView(player, computeThemeFit(input.gameState, input.team, player, ctx.themeRuntimeContext)))
    .filter((view) => view.marketValue > 0);
  const salaryTotal = startingSquad.reduce((sum, view) => sum + view.salary, 0);

  const result = buildOrganicSquadPlan({
    startingSquad,
    candidates,
    identityAxisWeights: ctx.identityAxisWeights,
    disciplines: ctx.disciplines,
    economy: {
      cash: ctx.cash,
      cashBuffer: ctx.cashBuffer,
      salaryTotal,
      boardRisk: ctx.boardRisk,
      expectedPrize: input.forecast?.expectedPrize ?? 0,
      sponsorIncome: input.forecast?.sponsorIncome ?? 0,
      facilityNet: input.forecast?.facilityNet ?? 0,
      netTransfer: input.forecast?.netTransfer ?? 0,
      weights: ctx.weights,
      rosterMax: ctx.rosterMax,
      rosterMin: ROSTER_MIN,
    },
    draftSeed: input.draftSeed ?? null,
  });

  return {
    decisions: result.decisions,
    sellDecisions: result.sellDecisions,
    finalCash: result.finalCash,
    finalSalaryTotal: result.finalSalaryTotal,
    finalRosterSize: result.finalSquad.length,
    stoppedBelowMin: result.stoppedBelowMin,
    optTarget: ctx.weights.optTarget,
  };
}

/**
 * Small positive sell-utility floor: a player is only sold when its sellUtility STRICTLY exceeds this.
 * sellUtility already goes negative for a key starter (high wWin·ΔStrength loss beats its wThrift·sale
 * value), so this floor mainly stops churning out ~break-even bodies; the real "keep vs. sell" line is
 * the utility sign, not this constant.
 */
const SELL_THRESHOLD = 0;

/**
 * Small additive jitter (in sellUtility units) applied ONLY inside the greedy sell comparison, keyed by
 * `${draftSeed}:${playerId}` (hash-based, reproducible — no Math.random). Mirrors ORGANIC_DRAFT_JITTER
 * in draft-builder.ts but for the sell path, with its OWN env knob so buy/sell variance can be tuned
 * independently. Default 8 — deliberately WEAKER than the buy default (15): selling is more consequential
 * (shedding a real body), so the jitter only nudges WHICH near-equal surplus/flip gets shed, never flips
 * a clear keep-vs-sell call. Only engages when a draftSeed is passed (real runs); pure unit tests pass no
 * seed and stay deterministic. ENV-overridable (OLY_ORGANIC_SELL_JITTER, 0 disables).
 */
const ORGANIC_SELL_JITTER = Number(process.env.OLY_ORGANIC_SELL_JITTER ?? 8) || 0;

export type OrganicSellDecision = {
  /** Domain player id (matches OrganicPlayerView.playerId / Player.id). */
  playerId: string;
  /** 0-based order in which this sell was chosen. */
  step: number;
  /** The sell utility at the moment it was chosen (for the decision log / diagnostics). */
  utility: number;
};

export type OrganicSellPlanInput = {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
  /** Players currently on the roster (domain Players; their disciplines drive coverage). */
  roster: Player[];
  /**
   * Optional cost basis per playerId (the roster entry's `purchasePrice`). Feeds the profit-flip term
   * in sellUtility so a trader club sheds players it can flip at a gain. Absent ⇒ no profit signal.
   */
  purchasePriceByPlayerId?: Record<string, number>;
  /**
   * At SEASON END the roster may shed below ROSTER_MIN (empty is fine — preseason rebuilds). Pass true
   * there so profit/surplus sells fire even when the draft left the team exactly at min. In-season
   * mid-window contexts leave it false to keep a fieldable squad.
   */
  allowBelowMin?: boolean;
  /** Conservative forecast planning inputs (mirrors the draft planner; optional). */
  forecast?: {
    expectedPrize?: number;
    sponsorIncome?: number;
    facilityNet?: number;
    netTransfer?: number;
  };
  /** Optional per-(save, team) seed for the reproducible sell-utility jitter (see ORGANIC_SELL_JITTER). */
  draftSeed?: string | null;
};

export type OrganicSellPlanResult = {
  /** Ordered list of players to sell (highest sell-utility first). */
  decisions: OrganicSellDecision[];
  finalCash: number;
  finalRosterSize: number;
  optTarget: number;
};

/**
 * Greedy organic SELL plan for one team (in-season / season-end sell-only path). Mirror of
 * planOrganicDraftForTeam but for shedding: repeatedly scores sellUtility for every still-held roster
 * player, sells the highest-utility one while it clears SELL_THRESHOLD and the roster stays >=
 * ROSTER_MIN, RE-COMPUTING coverage + cash after each sell (so shedding a covered-discipline body
 * raises the need of the remaining ones and eventually stops the loop). A player in an already-covered
 * discipline / with an attractive sale value scores high; a key starter (high ΔStrength loss) scores
 * negative and is kept. PURE: reads nothing from the live save beyond the passed inputs and mutates
 * nothing — the caller applies the returned decisions via the market sell primitive.
 */
export function planOrganicSellsForTeam(input: OrganicSellPlanInput): OrganicSellPlanResult {
  const ctx = buildOrganicPlanContext({
    gameState: input.gameState,
    team: input.team,
    identity: input.identity,
    draftSeed: input.draftSeed ?? null,
  });
  const held = input.roster.map((player) =>
    toOrganicPlayerView(player, undefined, input.purchasePriceByPlayerId?.[player.id]),
  );
  // Season-end may empty the roster (rebuild in preseason); in-season keeps a fieldable floor.
  const rosterMin = input.allowBelowMin ? 0 : ROSTER_MIN;

  let cash = ctx.cash;
  let salaryTotal = held.reduce((sum, view) => sum + Math.max(0, view.salary), 0);
  const decisions: OrganicSellDecision[] = [];

  const buildState = (): OrganicTeamState => {
    const disciplineNeeds = computeDisciplineNeeds(held, ctx.identityAxisWeights, ctx.disciplines);
    const needAxisWeights = deriveNeedAxisWeights(disciplineNeeds);
    const forecast = projectCashFlow({
      cash,
      salaryTotal,
      expectedPrize: input.forecast?.expectedPrize ?? 0,
      sponsorIncome: input.forecast?.sponsorIncome ?? 0,
      facilityNet: input.forecast?.facilityNet ?? 0,
      netTransfer: input.forecast?.netTransfer ?? 0,
      cashBuffer: ctx.cashBuffer,
    });
    return {
      cash,
      cashBuffer: ctx.cashBuffer,
      salaryTotal,
      rosterSize: held.length,
      boardRisk: ctx.boardRisk,
      forecast,
      weights: ctx.weights,
      disciplineNeeds,
      needAxisWeights,
    };
  };

  // Floor is ROSTER_MIN in-season, 0 at season end (allowBelowMin). Only players clearing
  // SELL_THRESHOLD are shed, highest-sellUtility first — keepers (negative sellUtility) never sell.
  while (held.length > rosterMin) {
    const state = buildState();
    let best: OrganicPlayerView | null = null;
    let bestUtility = -Infinity;
    for (const view of held) {
      const jitter =
        input.draftSeed && ORGANIC_SELL_JITTER > 0
          ? ORGANIC_SELL_JITTER * (draftUnit(`${input.draftSeed}:${view.playerId}`) - 0.5)
          : 0;
      const utility = sellUtility(view, state) + jitter;
      if (utility > bestUtility) {
        bestUtility = utility;
        best = view;
      }
    }
    if (!best || bestUtility <= SELL_THRESHOLD) break;

    held.splice(held.indexOf(best), 1);
    cash += Math.max(0, best.marketValue);
    salaryTotal = Math.max(0, salaryTotal - Math.max(0, best.salary));
    decisions.push({ playerId: best.playerId, step: decisions.length, utility: bestUtility });
  }

  return {
    decisions,
    finalCash: cash,
    finalRosterSize: held.length,
    optTarget: ctx.weights.optTarget,
  };
}

/**
 * Season-end RENEWAL contract length (seasons, ∈ [1,5]) for one team, from its identity + GM bias —
 * the gameState-facing wrapper around the pure `resolveRenewalContractLength`. Used by the organic
 * season-end renew→sell cycle to decide how long a kept player's renewed contract runs (short for a
 * flexible trader, long for a stable/high-harmony club).
 */
export function resolveOrganicRenewalContractLength(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
}): number {
  return resolveRenewalContractLength(
    buildOrganicIdentityInput(input.identity),
    resolveGmBias(input.gameState, input.team.teamId),
  );
}
