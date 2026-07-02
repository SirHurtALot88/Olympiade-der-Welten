import { describe, expect, it } from "vitest";

import {
  FOUNDATION_NAVIGATION_QUIET_MS,
  isFoundationNavigationQuiet,
  markFoundationNavigationQuiet,
  pauseFoundationNavigationSideEffects,
} from "@/lib/foundation/navigation-coalescing";

describe("navigation-coalescing", () => {
  it("marks and detects quiet navigation window", () => {
    const untilRef = { current: 0 };
    markFoundationNavigationQuiet(untilRef, 5000);
    expect(isFoundationNavigationQuiet(untilRef)).toBe(true);
    untilRef.current = Date.now() - 1;
    expect(isFoundationNavigationQuiet(untilRef)).toBe(false);
  });

  it("pauses auto-persist during navigation", () => {
    const autoPersistPausedRef = { current: false };
    const foundationViewTransitionUntilRef = { current: 0 };
    pauseFoundationNavigationSideEffects({
      autoPersistPausedRef,
      foundationViewTransitionUntilRef,
      durationMs: FOUNDATION_NAVIGATION_QUIET_MS,
    });
    expect(autoPersistPausedRef.current).toBe(true);
    expect(isFoundationNavigationQuiet(foundationViewTransitionUntilRef)).toBe(true);
  });
});
