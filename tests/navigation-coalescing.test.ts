import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    const autoPersistUnpauseTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    pauseFoundationNavigationSideEffects({
      autoPersistPausedRef,
      autoPersistUnpauseTimeoutRef,
      foundationViewTransitionUntilRef,
      durationMs: FOUNDATION_NAVIGATION_QUIET_MS,
    });
    expect(autoPersistPausedRef.current).toBe(true);
    expect(isFoundationNavigationQuiet(foundationViewTransitionUntilRef)).toBe(true);
  });

  describe("auto-persist unpause scheduling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {
        setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
        clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it("unpauses auto-persist when the quiet window ends", () => {
      const autoPersistPausedRef = { current: false };
      const foundationViewTransitionUntilRef = { current: 0 };
      const autoPersistUnpauseTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
      const autoPersistRefs = { autoPersistPausedRef, autoPersistUnpauseTimeoutRef };

      pauseFoundationNavigationSideEffects({
        autoPersistPausedRef,
        autoPersistUnpauseTimeoutRef,
        foundationViewTransitionUntilRef,
        durationMs: 1000,
      });

      expect(autoPersistPausedRef.current).toBe(true);
      vi.advanceTimersByTime(1000);
      expect(autoPersistPausedRef.current).toBe(false);
    });

    it("does not pause auto-persist when only extending the quiet window", () => {
      const autoPersistPausedRef = { current: false };
      const foundationViewTransitionUntilRef = { current: 0 };
      const autoPersistUnpauseTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

      markFoundationNavigationQuiet(foundationViewTransitionUntilRef, 1000, {
        autoPersistPausedRef,
        autoPersistUnpauseTimeoutRef,
      });

      expect(autoPersistPausedRef.current).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(autoPersistPausedRef.current).toBe(false);
    });

    it("reschedules unpause when the quiet window is extended", () => {
      const autoPersistPausedRef = { current: false };
      const foundationViewTransitionUntilRef = { current: 0 };
      const autoPersistUnpauseTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
      const autoPersistRefs = { autoPersistPausedRef, autoPersistUnpauseTimeoutRef };

      pauseFoundationNavigationSideEffects({
        autoPersistPausedRef,
        autoPersistUnpauseTimeoutRef,
        foundationViewTransitionUntilRef,
        durationMs: 1000,
      });

      vi.advanceTimersByTime(500);
      markFoundationNavigationQuiet(foundationViewTransitionUntilRef, 1000, autoPersistRefs);

      vi.advanceTimersByTime(500);
      expect(autoPersistPausedRef.current).toBe(true);
      expect(isFoundationNavigationQuiet(foundationViewTransitionUntilRef)).toBe(true);

      vi.advanceTimersByTime(500);
      expect(autoPersistPausedRef.current).toBe(false);
    });
  });
});
