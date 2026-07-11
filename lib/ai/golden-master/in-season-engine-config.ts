/**
 * Frozen configuration for the in-season transfer engine (sell -> rebuy) that runs in the
 * `preseason` and `season_end` transfer-window phases.
 *
 * These constants are lifted verbatim from the legacy driver
 * (`lib/ai/ai-transfer-window-session-service.ts`) and the apply-layer options it passes, so the
 * new clean engine (`lib/ai/in-season-engine/*`) reads IDENTICAL values to the legacy path. Keeping
 * them here — mirroring the draft engine's `golden-master/` split of tunables from logic — lets the
 * parity tests treat any behavioural difference as a logic difference, never a constant drift.
 *
 * Do not tune these while the clean rebuild is behaviour-preserving; changing a number here is a
 * deliberate re-balancing, out of scope for the cutover.
 */
export const IN_SEASON_ENGINE_CONFIG = {
  version: "inSeasonEngine.v1",

  /** League-wide main loop (per phase). */
  loop: {
    /** Default cap on per-team cycles within one league round. */
    defaultMaxTeamCycles: 5,
    /** Default cap on league-wide rounds. */
    defaultMaxLeagueRounds: 3,
    /** Buy cycles cannot exceed roster headroom — hard ceiling per team per session. */
    maxPreseasonBuyCyclesPerTeam: 14,
  },

  /** season_end sell pass — options fed to `applyAiMarketPlanLocally` (sell-only). */
  sellPass: {
    previewSellLimit: 12,
    previewBuyLimit: 4,
    maxBuysPerTeam: 0,
  },

  /** preseason buy pass — options fed to `applyAiMarketPlanLocally` (buy-only). */
  buyPass: {
    previewSellLimit: 4,
    /** Preview breadth widens on later league rounds. */
    previewBuyLimitFirstRound: 112,
    previewBuyLimitLaterRounds: 144,
    /** How many buy steps to apply per batch (widens on later rounds). */
    applyBuyStepsInBatchFirstRound: 2,
    applyBuyStepsInBatchLaterRounds: 3,
  },

  /** preseason S1-draft-batch buy path (`runPreseasonBatchPickRebuild`). */
  preseasonBatch: {
    stepsPerTeam: 14,
    draftSeedSuffix: "preseason-batch",
  },

  /** Opt-gap rescue pass (preseason only, buy-only) for teams stuck below Opt. */
  optGapRescue: {
    /** Fire the rescue when Opt - roster >= this. */
    threshold: 1,
    maxCycles: 2,
  },
} as const;

export type InSeasonEngineConfig = typeof IN_SEASON_ENGINE_CONFIG;
