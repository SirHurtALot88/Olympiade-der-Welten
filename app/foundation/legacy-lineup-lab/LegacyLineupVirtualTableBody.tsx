"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";

import { useRowVirtualWindow } from "@/lib/foundation/use-row-virtual-window";

export { useRowVirtualWindow };

const VIRTUALIZE_THRESHOLD = 20;

export function LegacyLineupVirtualCardGrid<T>({
  items,
  estimateHeight = 168,
  className,
  renderItem,
}: {
  items: T[];
  estimateHeight?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateHeight,
    overscan: 4,
  });

  if (items.length <= VIRTUALIZE_THRESHOLD) {
    return <div className={className}>{items.map((item, index) => renderItem(item, index))}</div>;
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`${className ?? ""} is-virtualized`.trim()}
      data-virtualized="true"
      style={{ maxHeight: 640, overflow: "auto" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            display: "grid",
            gap: "inherit",
          }}
        >
          {virtualItems.map((virtualRow) => renderItem(items[virtualRow.index]!, virtualRow.index))}
        </div>
      </div>
    </div>
  );
}
