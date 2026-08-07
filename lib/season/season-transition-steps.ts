/**
 * Die Schrittfolge des Saisonende-Assistenten.
 *
 * Steht bewusst in einer EIGENEN Datei und nicht im `season-transition-service`: die Kette
 * (`season-transition-chain.ts`) braucht die Reihenfolge, und der Service braucht die Kette —
 * lebte die Liste weiter im Service, waere das ein Import-Zyklus.
 */
export const SEASON_TRANSITION_STEPS = [
  "season_check",
  "season_review",
  "season_rewards",
  "player_development",
  "season_end_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
] as const;

export type SeasonTransitionStepId = (typeof SEASON_TRANSITION_STEPS)[number];
