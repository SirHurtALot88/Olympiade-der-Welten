import {
  runTransferWindowSessionLegacy,
  type TransferWindowSessionInput,
  type TransferWindowSessionResult,
} from "@/lib/ai/ai-transfer-window-session-service";

/**
 * Clean-engine (V2) driver for the in-season transfer window.
 *
 * This is the designated home for the clean re-expression of the transfer-window orchestration,
 * built on the in-season-engine module (phase/source enum, need-detection, composed sell/anti-churn
 * surfaces, the `planTransferWindowForTeam` facade). It is reached only when `OLY_INSEASON_ENGINE_V2`
 * is on; the flag defaults OFF so production is unaffected.
 *
 * Cutover status: for this stage the V2 driver DELEGATES to the proven legacy orchestration, which
 * guarantees byte-for-byte parity while the parallel engine and its seam are wired in and verified.
 * The legacy loop's intricate parts (strict phase separation, per-team cycle caps, exclude-list
 * threading, stall/opt-gap-rescue/emergency-repair) are essential behaviour, not accidental
 * complexity, so their clean rewrite behind this stable entry point is the deliberate next step —
 * done against the real-save parity harness, not folded into the wiring commit. Keeping V2 as a
 * faithful delegate now means the cutover flip is a single, low-risk, fully-reversible change.
 */
export async function runTransferWindowSessionV2(
  input: TransferWindowSessionInput,
): Promise<TransferWindowSessionResult> {
  return runTransferWindowSessionLegacy(input);
}
