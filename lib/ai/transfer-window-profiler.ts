/**
 * Lightweight, opt-in profiler for the AI transfer-window hot path.
 *
 * Enabled only when `OLY_TW_PROFILE=1` so it adds zero overhead in normal runs.
 * Used by scripts/profile-transfer-window.ts to locate the cost in
 * runTransferWindowSession -> applyAiMarketPlanLocally -> buildAiTransfermarktPreview.
 */

export type TransferWindowProfileSnapshot = {
  enabled: boolean;
  buyPreviewCalls: number;
  buyPreviewMs: number;
  sellPreviewCalls: number;
  sellPreviewMs: number;
  freeAgentFeedBuilds: number;
  freeAgentFeedHits: number;
  freeAgentFeedBuildMs: number;
  freeAgentFeedItemsBuilt: number;
  stageMs: Record<string, number>;
};

const enabled = process.env.OLY_TW_PROFILE === "1";

const state: TransferWindowProfileSnapshot = {
  enabled,
  buyPreviewCalls: 0,
  buyPreviewMs: 0,
  sellPreviewCalls: 0,
  sellPreviewMs: 0,
  freeAgentFeedBuilds: 0,
  freeAgentFeedHits: 0,
  freeAgentFeedBuildMs: 0,
  freeAgentFeedItemsBuilt: 0,
  stageMs: {},
};

export function isTransferWindowProfilingEnabled() {
  return enabled;
}

export function recordBuyPreview(elapsedMs: number, stages?: Record<string, number | undefined>) {
  if (!enabled) return;
  state.buyPreviewCalls += 1;
  state.buyPreviewMs += elapsedMs;
  if (stages) {
    for (const [key, value] of Object.entries(stages)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        state.stageMs[key] = (state.stageMs[key] ?? 0) + value;
      }
    }
  }
}

export function recordSellPreview(elapsedMs: number) {
  if (!enabled) return;
  state.sellPreviewCalls += 1;
  state.sellPreviewMs += elapsedMs;
}

export function recordFreeAgentFeed(input: { hit: boolean; buildMs?: number; itemsBuilt?: number }) {
  if (!enabled) return;
  if (input.hit) {
    state.freeAgentFeedHits += 1;
    return;
  }
  state.freeAgentFeedBuilds += 1;
  state.freeAgentFeedBuildMs += input.buildMs ?? 0;
  state.freeAgentFeedItemsBuilt += input.itemsBuilt ?? 0;
}

export function recordPhase(name: string, elapsedMs: number) {
  if (!enabled) return;
  state.stageMs[`apply:${name}`] = (state.stageMs[`apply:${name}`] ?? 0) + elapsedMs;
}

export function snapshotTransferWindowProfile(): TransferWindowProfileSnapshot {
  return {
    ...state,
    stageMs: { ...state.stageMs },
  };
}

export function resetTransferWindowProfile() {
  state.buyPreviewCalls = 0;
  state.buyPreviewMs = 0;
  state.sellPreviewCalls = 0;
  state.sellPreviewMs = 0;
  state.freeAgentFeedBuilds = 0;
  state.freeAgentFeedHits = 0;
  state.freeAgentFeedBuildMs = 0;
  state.freeAgentFeedItemsBuilt = 0;
  state.stageMs = {};
}
