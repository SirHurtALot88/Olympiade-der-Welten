/** Quiet window after Foundation tab navigation — blocks auto-persist and version-poll reloads. */
export const FOUNDATION_NAVIGATION_QUIET_MS = 4000;

export function markFoundationNavigationQuiet(untilRef: { current: number }, durationMs = FOUNDATION_NAVIGATION_QUIET_MS) {
  untilRef.current = Date.now() + durationMs;
}

export function isFoundationNavigationQuiet(untilRef: { current: number }, now = Date.now()) {
  return now < untilRef.current;
}

export function pauseFoundationNavigationSideEffects(input: {
  autoPersistPausedRef: { current: boolean };
  foundationViewTransitionUntilRef: { current: number };
  durationMs?: number;
}) {
  const durationMs = input.durationMs ?? FOUNDATION_NAVIGATION_QUIET_MS;
  markFoundationNavigationQuiet(input.foundationViewTransitionUntilRef, durationMs);
  input.autoPersistPausedRef.current = true;
  if (typeof window === "undefined") {
    return;
  }
  window.setTimeout(() => {
    if (!isFoundationNavigationQuiet(input.foundationViewTransitionUntilRef)) {
      input.autoPersistPausedRef.current = false;
    }
  }, durationMs);
}
