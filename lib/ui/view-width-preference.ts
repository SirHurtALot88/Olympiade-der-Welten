"use client";

import { useEffect, useState } from "react";

/**
 * "View-Breite"-Präferenz: erlaubt es, die Renderbreite der App zu wählen —
 * Standard (komfortabel schmaler, ~15"-MacBook-Gefühl), Breit (mehr Inhalt)
 * oder Cinema (volle Breite eines großen 32"-16:9-Monitors).
 *
 * Ersetzt funktional den entfernten kosmetischen Neuer-Look-Toggle. Das Muster
 * spiegelt den früheren `new-look-preference`-Hook: localStorage-Persistenz,
 * SSR-sicherer Default (kein Hydration-Flash — der erste Render nutzt immer den
 * Default, der gespeicherte Wert wird erst in einem Effekt gelesen) und ein
 * kleines CustomEvent-Broadcast, damit mehrere Consumer (Switch in der Sidebar
 * + `<main data-view-width>` in der Router-Body) synchron bleiben.
 */
export type ViewWidthMode = "standard" | "wide" | "cinema";

export const VIEW_WIDTH_STORAGE_KEY = "oly-view-width-v1";
export const VIEW_WIDTH_DEFAULT: ViewWidthMode = "standard";
export const VIEW_WIDTH_CHANGE_EVENT = "oly-view-width-change";

const VALID_MODES: readonly ViewWidthMode[] = ["standard", "wide", "cinema"];

function isViewWidthMode(value: unknown): value is ViewWidthMode {
  return typeof value === "string" && (VALID_MODES as readonly string[]).includes(value);
}

/** Liest die gespeicherte Präferenz. SSR-/Fehler-sicher → Default. */
export function loadViewWidthMode(): ViewWidthMode {
  if (typeof window === "undefined") {
    return VIEW_WIDTH_DEFAULT;
  }
  try {
    const stored = window.localStorage.getItem(VIEW_WIDTH_STORAGE_KEY);
    return isViewWidthMode(stored) ? stored : VIEW_WIDTH_DEFAULT;
  } catch {
    return VIEW_WIDTH_DEFAULT;
  }
}

/** Speichert die Präferenz und broadcastet die Änderung an andere Consumer. */
export function saveViewWidthMode(mode: ViewWidthMode): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(VIEW_WIDTH_STORAGE_KEY, mode);
  } catch {
    // Persistenz ist best-effort; UI-State bleibt trotzdem aktuell.
  }
  window.dispatchEvent(new CustomEvent<ViewWidthMode>(VIEW_WIDTH_CHANGE_EVENT, { detail: mode }));
}

/**
 * React-Hook: `[mode, setMode]`. Der erste Render liefert immer den Default
 * (SSR-sicher), ein Effekt liest den gespeicherten Wert nach und abonniert das
 * Change-Event + `storage`, damit alle Instanzen synchron bleiben.
 */
export function useViewWidth(): [ViewWidthMode, (mode: ViewWidthMode) => void] {
  const [mode, setModeState] = useState<ViewWidthMode>(VIEW_WIDTH_DEFAULT);

  useEffect(() => {
    setModeState(loadViewWidthMode());

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<ViewWidthMode>).detail;
      if (isViewWidthMode(detail)) {
        setModeState(detail);
      } else {
        setModeState(loadViewWidthMode());
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === VIEW_WIDTH_STORAGE_KEY) {
        setModeState(loadViewWidthMode());
      }
    };

    window.addEventListener(VIEW_WIDTH_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(VIEW_WIDTH_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setMode = (next: ViewWidthMode) => {
    setModeState(next);
    saveViewWidthMode(next);
  };

  return [mode, setMode];
}
