"use client";

import { createElement, useEffect, useRef, useState } from "react";

import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";

export type UseCountUpOptions = {
  /** Animations-Dauer in ms (Standard: 900). */
  durationMs?: number;
  /** Sofort mit der Ziel-Animation starten (Standard: true). */
  startOnMount?: boolean;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Zähler-Animation 0 → target mit Ease-out (rAF), für Hero-/KPI-Zahlen im
 * "Neuen Look" (Home, Spieltagsergebnis, Preisgeld, …).
 *
 * - Respektiert `prefers-reduced-motion`: dann Sprung direkt auf den
 *   Zielwert, keine Animation.
 * - SSR-sicher: kein `window`-Zugriff während des Renders, nur in Effects.
 *   Der initiale State ist der Zielwert selbst (kein "—"-Flackern vor der
 *   Hydration); der Effect setzt danach auf 0 zurück und animiert hoch.
 */
export function useCountUp(target: number | null | undefined, opts?: UseCountUpOptions): number | null {
  const durationMs = opts?.durationMs ?? 900;
  const startOnMount = opts?.startOnMount ?? true;
  const safeTarget = target != null && Number.isFinite(target) ? target : null;

  const [display, setDisplay] = useState<number | null>(safeTarget);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (safeTarget == null) {
      setDisplay(null);
      return;
    }

    if (!startOnMount || prefersReducedMotion()) {
      setDisplay(safeTarget);
      return;
    }

    let cancelled = false;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(safeTarget * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(safeTarget);
      }
    };

    setDisplay(0);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
    // `startOnMount` ist als Verhaltens-Flag gedacht (nicht als reaktiver
    // Trigger) — bewusst aus den Deps ausgeschlossen, sonst würde jede
    // Elternkomponente, die es inline übergibt, die Animation neu starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTarget, durationMs]);

  return display;
}

export type NlCountUpValueProps = {
  value: number | null | undefined;
  opts?: UseCountUpOptions;
  /** Standard: `formatNlNumber(value)`. */
  format?: (value: number) => string;
  className?: string;
};

/**
 * Kleiner Komponenten-Wrapper um `useCountUp` für Listen/Karten, in denen
 * mehrere Headline-Zahlen unabhängig animieren sollen (jede Instanz trägt
 * ihren eigenen Hook-State — kein Verstoß gegen die Rules of Hooks, wenn
 * `useCountUp` selbst innerhalb einer `.map()` aufgerufen werden müsste).
 */
export function NlCountUpValue({ value, opts, format, className }: NlCountUpValueProps) {
  const display = useCountUp(value, opts);
  const formatter = format ?? ((v: number) => formatNlNumber(v));
  // `.ts`-Datei (keine JSX-Transform-Extension) — `createElement` statt JSX.
  return createElement("span", { className }, display != null ? formatter(display) : "—");
}

export default useCountUp;
