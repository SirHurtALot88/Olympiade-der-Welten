"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * rAF-throttled scroll position.
 *
 * Heavy tables (Einsatzliste-Expertenpool, Saisonstand) drive virtualization
 * off `scrollTop`. Calling `setState` on every raw scroll event re-renders the
 * whole (large) client component per scroll frame → jank. This batches updates
 * to at most one per animation frame, which is all the render needs.
 *
 * Returns `[scrollTop, onScroll]` — drop `onScroll` onto the scroll container.
 */
export function useRafThrottledScrollTop(): [
  number,
  (event: { currentTarget: { scrollTop: number } }) => void,
] {
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number | null>(null);

  const onScroll = useCallback((event: { currentTarget: { scrollTop: number } }) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    if (rafRef.current != null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(nextScrollTop);
    });
  }, []);

  return [scrollTop, onScroll];
}

/**
 * rAF-throttled generic callback — same gating pattern as
 * `useRafThrottledScrollTop` above, but for `window`-level `scroll`/`resize`
 * listeners that call an arbitrary handler instead of tracking `scrollTop`.
 *
 * At most one call per animation frame; a call that arrives while a frame is
 * already pending is dropped (trailing calls are not queued — the next event
 * within the same pending frame still wins once it fires, since the ref
 * always reads the latest `callback`). Any frame still pending is cancelled
 * on unmount so it can never fire against an unmounted component.
 *
 * Returns a stable function reference — safe to pass directly into
 * `addEventListener`/`removeEventListener` without re-subscribing on every
 * render.
 */
export function useRafThrottledCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  return useCallback((...args: Args) => {
    if (rafRef.current != null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      callbackRef.current(...args);
    });
  }, []);
}
