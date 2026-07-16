"use client";

import { useCallback, useRef, useState } from "react";

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
