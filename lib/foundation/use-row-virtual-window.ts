import { useMemo } from "react";

const VIRTUALIZE_THRESHOLD = 20;

export function useRowVirtualWindow(input: {
  count: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight?: number;
}) {
  return useMemo(() => {
    const rowHeight = input.rowHeight ?? 42;
    if (input.count <= VIRTUALIZE_THRESHOLD) {
      return {
        start: 0,
        end: input.count,
        offsetY: 0,
        totalHeight: input.count * rowHeight,
        enabled: false,
      };
    }
    const overscan = 6;
    const visibleCount = Math.ceil(input.viewportHeight / rowHeight) + overscan * 2;
    const start = Math.max(0, Math.floor(input.scrollTop / rowHeight) - overscan);
    const end = Math.min(input.count, start + visibleCount);
    return {
      start,
      end,
      offsetY: start * rowHeight,
      totalHeight: input.count * rowHeight,
      enabled: true,
    };
  }, [input.count, input.rowHeight, input.scrollTop, input.viewportHeight]);
}
