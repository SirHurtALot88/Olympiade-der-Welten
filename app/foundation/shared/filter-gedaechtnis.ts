"use client";

/**
 * Filter bleiben stehen (Chris, 21.11.): wer im Transfermarkt oder Draft-Brett oben einen anderen Reiter wählt und zurückkommt,
 * findet Suche, Mindestnoten, Weitere Filter, Sortierung und Fit-Schalter so vor, wie er sie gelassen hat. Die Seiten werden
 * beim Reiterwechsel (oder beim Weg über die Historie) abgebaut — der Zustand lebt deshalb je Liste in `sessionStorage`
 * (pro Browser-Tab, mit dem Tab weg; jeder Spielstand hat eigene Schlüssel). Fehler beim Lesen oder Schreiben fallen still auf
 * den Startwert zurück.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

const PRAEFIX = "oly-filter-v1";

export function filterSchluessel(liste: string, spielstand: string | null | undefined, feld: string): string {
  return `${PRAEFIX}:${liste}:${(spielstand ?? "").trim() || "ohne-save"}:${feld}`;
}

/** Liest einen gemerkten Wert; Objekte werden über den Startwert aufgefüllt, damit neue Felder nie fehlen. */
export function liesGemerkt<T>(schluessel: string, start: T, speicher?: Pick<Storage, "getItem"> | null): T {
  try {
    const ziel = speicher ?? (typeof window === "undefined" ? null : window.sessionStorage);
    const roh = ziel?.getItem(schluessel);
    if (roh == null) return start;
    const wert = JSON.parse(roh) as unknown;
    if (wert === null || typeof wert !== typeof start) return start;
    if (Array.isArray(start) !== Array.isArray(wert)) return start;
    if (start && typeof start === "object" && !Array.isArray(start)) return { ...start, ...(wert as object) } as T;
    return wert as T;
  } catch {
    return start;
  }
}

export function schreibeGemerkt<T>(schluessel: string, wert: T, start: T, speicher?: Pick<Storage, "setItem" | "removeItem"> | null): void {
  try {
    const ziel = speicher ?? (typeof window === "undefined" ? null : window.sessionStorage);
    if (!ziel) return;
    if (JSON.stringify(wert) === JSON.stringify(start)) ziel.removeItem(schluessel);
    else ziel.setItem(schluessel, JSON.stringify(wert));
  } catch {
    /* Speicher gesperrt: der Filter gilt dann nur, solange die Seite offen bleibt. */
  }
}

/** Wie `useState`, aber gemerkt über Reiterwechsel hinweg. `schluessel` = `filterSchluessel(liste, saveId, feld)`. */
export function useGemerkterFilter<T>(schluessel: string, start: T): [T, Dispatch<SetStateAction<T>>] {
  const [wert, setWert] = useState<T>(() => liesGemerkt(schluessel, start));
  const startRef = useRef(start);
  const letzterSchluessel = useRef(schluessel);
  useEffect(() => {
    if (letzterSchluessel.current === schluessel) {
      schreibeGemerkt(schluessel, wert, startRef.current);
    } else {
      // Spielstandwechsel: den Stand des neuen Schlüssels holen, nicht den alten Wert in den neuen Schlüssel schreiben.
      letzterSchluessel.current = schluessel;
      setWert(liesGemerkt(schluessel, startRef.current)); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [schluessel, wert]);
  const setze = useCallback<Dispatch<SetStateAction<T>>>((v) => setWert(v), []);
  return [wert, setze];
}
