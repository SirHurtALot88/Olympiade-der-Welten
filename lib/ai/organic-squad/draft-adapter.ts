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

import { buildOrganicSquadPlan, type OrganicBuyDecision } from "@/lib/ai/organic-squad/draft-builder";
import {
  CATEGORY_TO_AXIS,
  ROSTER_MAX,
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicGmBiasInput,
  type OrganicIdentityInput,
  type OrganicPlayerView,
} from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import {
  buildTeamThemeCompositionRuntimeContext,
  calculateThemeCompositionScore,
  type TeamThemeCompositionRuntimeContext,
} from "@/lib/ai/team-theme-composition-service";

/** Small flat solvency buffer (MW) — the only cash hard blocker; spend above it is emergent. */
const ORGANIC_CASH_BUFFER = 5;

/** 0..100 (or 0..10 legacy) management value → 0..1, matching normalizeManagementValue. */
function normId(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  const scaled = value <= 10 ? value / 10 : value / 100;
  return Math.min(1, Math.max(0, scaled));
}

/** Build the utility player view from a domain Player (quality from stats; marketValue = price only). */
export function toOrganicPlayerView(player: Player, themeFit?: number): OrganicPlayerView {
  return {
    playerId: player.id,
    pow: player.coreStats?.pow ?? 0,
    spe: player.coreStats?.spe ?? 0,
    men: player.coreStats?.men ?? 0,
    soc: player.coreStats?.soc ?? 0,
    disciplineRatings: player.disciplineRatings ?? {},
    marketValue: Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0),
    salary: Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0),
    potential: player.potential ?? null,
    themeFit,
  };
}

/**
 * Maps a team-theme-composition-service `themeTier` to a 0..1 fit signal for the organic model.
 * Ordered by how central the tier is to the club's IDENTITY (not its market-value/quality override
 * eligibility) — core theme match is a full "1", plain outsiders/avoid-tag players are "0".
 */
const THEME_TIER_FIT: Record<string, number> = {
  core_theme: 1,
  secondary_theme: 0.6,
  soft_theme: 0.3,
  outsider_exception: 0.1,
  outsider: 0,
  avoid: 0,
};

/**
 * Cheap per-(team, player) theme-fit signal (0..1), reusing calculateThemeCompositionScore from
 * lib/ai/team-theme-composition-service.ts instead of reinventing theme rules. Callers MUST build
 * `runtimeContext` ONCE per team (buildTeamThemeCompositionRuntimeContext) and pass it in here per
 * candidate, so the roster-share/themed-pool-count lookups are not repeated per player. Returns
 * undefined when the team has no theme target (no signal, treated as 0 downstream).
 */
export function computeThemeFit(
  gameState: GameState,
  team: Pick<Team, "teamId" | "name">,
  player: Player,
  runtimeContext: TeamThemeCompositionRuntimeContext,
): number | undefined {
  if (!runtimeContext.target) return undefined;
  const score = calculateThemeCompositionScore({
    gameState,
    team,
    player,
    // Quality/role-fit are irrelevant to "does this player match the team's identity" — the pure
    // theme signal we want lives in themeTier, which is tag-derived (race/class/subclass/gender/
    // trait), not in the quality-override escape hatch.
    candidateQuality: 0,
    candidateRoleFit: 0,
    runtimeContext,
  });
  return THEME_TIER_FIT[score.themeTier] ?? 0;
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
};

export type OrganicDraftPlanResult = {
  decisions: OrganicBuyDecision[];
  finalCash: number;
  finalSalaryTotal: number;
  finalRosterSize: number;
  stoppedBelowMin: boolean;
  optTarget: number;
};

/** Assemble utility inputs from gameState and run the greedy organic plan for one team. */
export function planOrganicDraftForTeam(input: OrganicDraftPlanInput): OrganicDraftPlanResult {
  const identityInput: OrganicIdentityInput = {
    ambition: input.identity?.ambition ?? 50,
    finances: input.identity?.finances ?? 55,
    boardConfidence: input.identity?.boardConfidence ?? 50,
    harmony: input.identity?.harmony ?? 50,
    playerOpt: input.identity?.playerOpt ?? 10,
  };
  const weights = deriveUtilityWeights(identityInput, resolveGmBias(input.gameState, input.team.teamId));
  const identityAxisWeights = buildIdentityAxisWeights(input.identity);
  const disciplines = resolveOrganicDisciplines(input.gameState);

  // Build the team's theme runtime context ONCE (cached rosterShare/themedPoolCount), then reuse it
  // for every candidate's themeFit lookup below — never recomputed per player.
  const themeRuntimeContext = buildTeamThemeCompositionRuntimeContext(input.gameState, input.team);
  const startingSquad = input.startingSquad.map((player) => toOrganicPlayerView(player));
  const candidates = input.candidates
    .map((player) => toOrganicPlayerView(player, computeThemeFit(input.gameState, input.team, player, themeRuntimeContext)))
    .filter((view) => view.marketValue > 0);

  const cash = input.team.cash ?? 0;
  // Small flat solvency buffer (the only cash hard blocker). How much a club keeps ABOVE this is
  // emergent: aggressive clubs spend down toward it (~0-10 left), savers keep more via wPatience.
  const cashBuffer = ORGANIC_CASH_BUFFER;
  const salaryTotal = startingSquad.reduce((sum, view) => sum + view.salary, 0);
  const boardRisk = 1 - normId(input.identity?.boardConfidence);
  const rosterMax = Math.min(ROSTER_MAX, input.team.rosterLimit ?? ROSTER_MAX);

  const result = buildOrganicSquadPlan({
    startingSquad,
    candidates,
    identityAxisWeights,
    disciplines,
    economy: {
      cash,
      cashBuffer,
      salaryTotal,
      boardRisk,
      expectedPrize: input.forecast?.expectedPrize ?? 0,
      sponsorIncome: input.forecast?.sponsorIncome ?? 0,
      facilityNet: input.forecast?.facilityNet ?? 0,
      netTransfer: input.forecast?.netTransfer ?? 0,
      weights,
      rosterMax,
      rosterMin: ROSTER_MIN,
    },
  });

  return {
    decisions: result.decisions,
    finalCash: result.finalCash,
    finalSalaryTotal: result.finalSalaryTotal,
    finalRosterSize: result.finalSquad.length,
    stoppedBelowMin: result.stoppedBelowMin,
    optTarget: weights.optTarget,
  };
}
