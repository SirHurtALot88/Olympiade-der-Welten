"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ColumnDef<Id extends string = string> {
  id: Id;
  label: string;
  def: number;
  min: number;
  align?: "r";
}

export interface UseColumnWidthsResult<Id extends string> {
  widths: Record<Id, number>;
  total: number;
  startResize: (e: React.PointerEvent, colId: Id, minW: number) => void;
  resetWidths: () => void;
}

/**
 * Wiederverwendbare Resize-Logik fuer Tabellen mit anpassbaren Spaltenbreiten
 * (Pointer-Griff, localStorage-Persistenz), extrahiert aus der urspruenglichen
 * SortimentTable-Implementierung (docs/enterich-cards/PAGES_CONCEPT.md §A.1).
 * `storageKey` sollte pro Tabelle eindeutig sein (z. B. "lec.sortiment.colWidths.v1").
 */
export function useColumnWidths<Id extends string>(
  cols: ColumnDef<Id>[],
  storageKey: string
): UseColumnWidthsResult<Id> {
  const defaultWidths = useCallback(
    (): Record<Id, number> => Object.fromEntries(cols.map((c) => [c.id, c.def])) as Record<Id, number>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  );

  const [widths, setWidths] = useState<Record<Id, number>>(defaultWidths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved === "object") {
        setWidths((w) => ({ ...w, ...saved }));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: Record<Id, number>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  const startResize = useCallback(
    (e: React.PointerEvent, colId: Id, minW: number) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widthsRef.current[colId];
      const handle = e.currentTarget as HTMLElement;
      handle.classList.add("active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const w = Math.max(minW, Math.round(startW + (ev.clientX - startX)));
        setWidths((prev) => ({ ...prev, [colId]: w }));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        handle.classList.remove("active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        persist(widthsRef.current);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [persist]
  );

  const resetWidths = useCallback(() => {
    const d = defaultWidths();
    setWidths(d);
    persist(d);
  }, [defaultWidths, persist]);

  const total = cols.reduce((sum, c) => sum + widths[c.id], 0);

  return { widths, total, startResize, resetWidths };
}
