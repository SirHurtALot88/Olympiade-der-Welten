import type { Player, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import type { LeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { TeamThemeCompositionTarget } from "@/lib/ai/team-theme-composition-service";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

/**
 * Clean S1 draft pick engine — shared types (see SPEC-clean-draft-engine.md).
 *
 * Default S1 draft path. Set OLY_CLEAN_DRAFT=0 to fall back to the legacy engine (see run-clean-draft.ts).
 * The lane vocabulary mirrors the intact market-brackets primitive so the two agree on tiers.
 */
export type CleanLane = "superstar" | "star" | "core" | "depth" | "backup" | "reserve";

/** Premium-first ordering — used both for planning and for lane comparison. */
export const CLEAN_LANE_ORDER: readonly CleanLane[] = [
  "superstar",
  "star",
  "core",
  "depth",
  "backup",
  "reserve",
] as const;

export type CleanLanePlanSlot = {
  lane: CleanLane;
  /** Lowest market value that still counts as this lane (bracket floor). */
  priceFloor: number;
  /** Highest market value this slot's allocation should pay (spread-aware). */
  priceCap: number;
};

export type CleanLanePlan = {
  /** Cash the plan is allowed to deploy (team cash minus trait-driven retention). */
  spendable: number;
  /** spendable / openSlots at plan time. */
  perSlotBudget: number;
  /** Roster size the draft aims for: OPT as a soft target, budget-flexed within the roster min/max. */
  targetRosterSize: number;
  /** Exactly (targetRosterSize - currentRosterCount) entries, premium-first order. */
  slots: CleanLanePlanSlot[];
};

export type PlanTeamLanesInput = {
  teamId: string;
  identity: TeamIdentity | null;
  strategy: TeamStrategyProfile | null;
  spendableCash: number;
  currentRosterCount: number;
  brackets: LeagueMarketBrackets;
};

/**
 * The team's full theme model (primary/secondary/soft tags, gender/race quota, strictness). The clean
 * scorer evaluates every candidate against this via the canonical tag derivation (see theme-match.ts),
 * so ALL themed teams get an identity signal — not just the two with a raw race quota. Null = the team
 * has no configured theme (strategy + quality drive it).
 */
export type CleanThemeTarget = TeamThemeCompositionTarget | null;

export type ScoreCandidateInput = {
  candidate: TransfermarktFreeAgentItem;
  identity: TeamIdentity | null;
  strategy: TeamStrategyProfile | null;
  slot: CleanLanePlanSlot;
  themeTarget: CleanThemeTarget;
  onThemeCountSoFar: number;
  rosterCountSoFar: number;
  currentRosterPlayers: Player[];
};

export type ScoreCandidateResult = { score: number; onTheme: boolean };

export type CleanDraftPick = {
  playerId: string;
  fee: number;
  salary: number;
  lane: CleanLane;
  onTheme: boolean;
};

export type DraftTeamRosterInput = {
  teamId: string;
  identity: TeamIdentity | null;
  strategy: TeamStrategyProfile | null;
  spendableCash: number;
  currentRoster: Player[];
  freeAgents: TransfermarktFreeAgentItem[];
  brackets: LeagueMarketBrackets;
  themeTarget: CleanThemeTarget;
  /** Hard roster minimum (default 8) — the executor never stops below this while it can still buy. */
  playerMin?: number;
};
