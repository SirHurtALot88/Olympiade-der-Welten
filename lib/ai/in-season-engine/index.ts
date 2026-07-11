/**
 * In-season transfer engine (clean rebuild) — barrel re-export.
 *
 * Mirrors `lib/ai/market-pick-engine/index.ts`: one concern per file, composed behind a thin facade
 * (`plan-transfer-window-for-team`) and driven by a clean session driver, all gated behind the
 * `OLY_INSEASON_ENGINE_V2` feature flag until parity with the legacy path is proven.
 *
 * Files are added here phase by phase; this barrel grows as each lands.
 */
export {
  TRANSFER_WINDOW_PHASE,
  TRANSFER_SOURCE,
  resolveTransferSource,
  isTransferSource,
  isTransferWindowPhase,
  type TransferWindowPhase,
  type TransferSource,
  type TransferSide,
} from "@/lib/ai/in-season-engine/transfer-window-phase";

export {
  IN_SEASON_ENGINE_CONFIG,
  type InSeasonEngineConfig,
} from "@/lib/ai/golden-master/in-season-engine-config";
