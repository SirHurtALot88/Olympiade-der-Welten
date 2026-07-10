/** Quiet window after Foundation tab navigation — blocks auto-persist and version-poll reloads. */
export const FOUNDATION_NAVIGATION_QUIET_MS = 4000;

export type FoundationNavigationAutoPersistRefs = {
  autoPersistPausedRef: { current: boolean };
  autoPersistUnpauseTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
};

function scheduleAutoPersistUnpause(
  foundationViewTransitionUntilRef: { current: number },
  refs: FoundationNavigationAutoPersistRefs,
) {
  if (typeof window === "undefined") {
    return;
  }
  const { autoPersistPausedRef, autoPersistUnpauseTimeoutRef } = refs;
  if (autoPersistUnpauseTimeoutRef.current != null) {
    window.clearTimeout(autoPersistUnpauseTimeoutRef.current);
    autoPersistUnpauseTimeoutRef.current = null;
  }
  const delayMs = Math.max(0, foundationViewTransitionUntilRef.current - Date.now());
  autoPersistUnpauseTimeoutRef.current = setTimeout(() => {
    autoPersistUnpauseTimeoutRef.current = null;
    if (!isFoundationNavigationQuiet(foundationViewTransitionUntilRef)) {
      autoPersistPausedRef.current = false;
      return;
    }
    scheduleAutoPersistUnpause(foundationViewTransitionUntilRef, refs);
  }, delayMs);
}

export function markFoundationNavigationQuiet(
  untilRef: { current: number },
  durationMs = FOUNDATION_NAVIGATION_QUIET_MS,
  autoPersistRefs?: FoundationNavigationAutoPersistRefs,
) {
  untilRef.current = Date.now() + durationMs;
  if (autoPersistRefs?.autoPersistPausedRef.current) {
    scheduleAutoPersistUnpause(untilRef, autoPersistRefs);
  }
}

export function isFoundationNavigationQuiet(untilRef: { current: number }, now = Date.now()) {
  return now < untilRef.current;
}

export function pauseFoundationNavigationSideEffects(input: {
  autoPersistPausedRef: { current: boolean };
  foundationViewTransitionUntilRef: { current: number };
  autoPersistUnpauseTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
  durationMs?: number;
}) {
  const autoPersistRefs = {
    autoPersistPausedRef: input.autoPersistPausedRef,
    autoPersistUnpauseTimeoutRef: input.autoPersistUnpauseTimeoutRef,
  };
  input.autoPersistPausedRef.current = true;
  markFoundationNavigationQuiet(
    input.foundationViewTransitionUntilRef,
    input.durationMs ?? FOUNDATION_NAVIGATION_QUIET_MS,
    autoPersistRefs,
  );
}
