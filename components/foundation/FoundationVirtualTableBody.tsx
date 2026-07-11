"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";

type FoundationVirtualTableBodyProps<T> = {
  rows: T[];
  estimateRowHeight?: number;
  overscan?: number;
  getRowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  maxHeight?: number;
};

export default function FoundationVirtualTableBody<T>({
  rows,
  estimateRowHeight = 56,
  overscan = 8,
  getRowKey,
  renderRow,
  maxHeight = 720,
}: FoundationVirtualTableBodyProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  return (
    <div ref={parentRef} className="foundation-virtual-table-scroll" style={{ maxHeight, overflow: "auto" }}>
      <table className="team-table foundation-virtual-table">
        <tbody
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
            display: "block",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <tr
                key={getRowKey(row, virtualRow.index)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  display: "table",
                  tableLayout: "fixed",
                }}
              >
                {renderRow(row, virtualRow.index)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
