"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Drosselt einen Aufruf auf hoechstens einen pro Animationsbild.
 *
 * Gedacht fuer Ereignisse, die der Browser schneller feuert als er zeichnet — Scrollen,
 * Mausbewegung, Groessenaenderung. Ohne Drosselung loest jedes Rohereignis ein `setState`
 * und damit ein Neuzeichnen der (grossen) Client-Komponente aus; gebuendelt bleibt genau
 * ein Aufruf je Bild uebrig, mehr braucht die Darstellung nicht.
 *
 * Genutzt von den Portrait-Vorschauen (Team und Spieler).
 *
 * Hier stand bis zum Dead-Code-Durchgang am 2026-08-09 zusaetzlich
 * `useRafThrottledScrollTop`, das `[scrollTop, onScroll]` lieferte. Sein letzter Nutzer war
 * der Expertenpool der Einsatzliste, der mit dem Expertenmodus entfallen ist — die Funktion
 * hatte danach keinen Aufrufer mehr und ist entfernt.
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
