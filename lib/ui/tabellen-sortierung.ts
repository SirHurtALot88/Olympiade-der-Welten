"use client";

/**
 * Gemeinsame Sortierung für alle Tabellen im neuen Stil (Designregel Chris, 21.11.: „alle Tabellen sortierbar“).
 *
 * Muster, wie es Training und Transfermarkt schon zeigen: der erste Klick auf einen Spaltenkopf sortiert in der
 * Standardrichtung der Spalte (Namen aufsteigend, Zahlen absteigend, bei Kosten aufsteigend — günstig ist besser),
 * ein zweiter Klick auf dieselbe Spalte dreht die Richtung. Fehlende Werte stehen immer am Ende, egal in welche
 * Richtung sortiert wird. Gleichstand behält die Ausgangsreihenfolge (stabil).
 */
import { useCallback, useMemo, useState } from "react";

export type SortRichtung = "auf" | "ab";
export type SortZustand<K extends string> = { key: K; richtung: SortRichtung };

export type SortWert = number | string | null | undefined;

export type SortSpalte<T> = {
  /** Wert, nach dem sortiert wird. `null`/`undefined` landet am Ende. */
  wert: (zeile: T) => SortWert;
  /** Erste Richtung beim ersten Klick. Standard: absteigend (Zahlen), Texte werden meist `auf` gesetzt. */
  standard?: SortRichtung;
};

export function sortiereZeilen<T>(zeilen: readonly T[], spalte: SortSpalte<T>, richtung: SortRichtung): T[] {
  const faktor = richtung === "auf" ? 1 : -1;
  return zeilen
    .map((zeile, index) => ({ zeile, index, wert: spalte.wert(zeile) }))
    .sort((a, b) => {
      const ax = a.wert == null || (typeof a.wert === "number" && !Number.isFinite(a.wert));
      const bx = b.wert == null || (typeof b.wert === "number" && !Number.isFinite(b.wert));
      if (ax && bx) return a.index - b.index;
      if (ax) return 1;
      if (bx) return -1;
      const x = a.wert as number | string;
      const y = b.wert as number | string;
      const d = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y), "de") : x - y;
      return d !== 0 ? d * faktor : a.index - b.index;
    })
    .map((e) => e.zeile);
}

export function useTabellenSortierung<T, K extends string>(
  zeilen: readonly T[],
  spalten: Record<K, SortSpalte<T>>,
  start: SortZustand<NoInfer<K>> | null,
) {
  const [zustand, setZustand] = useState<SortZustand<K> | null>(start);
  const sortiert = useMemo(() => {
    if (!zustand) return [...zeilen];
    const spalte = spalten[zustand.key];
    return spalte ? sortiereZeilen(zeilen, spalte, zustand.richtung) : [...zeilen];
    // `spalten` ist je Render neu, die Zeilen und der Zustand genügen als Auslöser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeilen, zustand]);
  const klick = useCallback(
    (key: K) =>
      setZustand((alt) => {
        if (alt && alt.key === key) return { key, richtung: alt.richtung === "auf" ? "ab" : "auf" };
        return { key, richtung: spalten[key]?.standard ?? "ab" };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  /** Eigenschaften für einen Spaltenkopf: `aktiv`, Pfeil und `aria-sort`. */
  const kopf = useCallback(
    (key: K) => {
      const aktiv = zustand?.key === key;
      return {
        aktiv,
        richtung: aktiv ? zustand!.richtung : null,
        pfeil: aktiv ? (zustand!.richtung === "auf" ? " ▴" : " ▾") : "",
        ariaSort: (aktiv ? (zustand!.richtung === "auf" ? "ascending" : "descending") : "none") as "ascending" | "descending" | "none",
        onKlick: () => klick(key),
      };
    },
    [zustand, klick],
  );
  return { sortiert, zustand, klick, kopf };
}
