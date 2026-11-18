"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Icon-Schiene der App-Navigation: standardmäßig kompakt (nur Symbole), bei Hover als Überlagerung
 * ausgeklappt — oder per „Beschriftung immer zeigen“ dauerhaft ausgeklappt. Der Zustand gilt pro
 * Browser (localStorage). Muster wie `view-width-preference.ts`: der erste Render liefert immer den
 * Default (kein Hydration-Unterschied), der gespeicherte Wert wird erst im Effekt gelesen.
 */
export const NAV_RAIL_PINNED_STORAGE_KEY = "oly-nav-rail-pinned-v1";
export const NAV_RAIL_PINNED_DEFAULT = false;
export const NAV_RAIL_CHANGE_EVENT = "oly-nav-rail-change";

export function loadNavRailPinned(): boolean {
  if (typeof window === "undefined") return NAV_RAIL_PINNED_DEFAULT;
  try {
    return window.localStorage.getItem(NAV_RAIL_PINNED_STORAGE_KEY) === "1";
  } catch {
    return NAV_RAIL_PINNED_DEFAULT;
  }
}

export function saveNavRailPinned(pinned: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAV_RAIL_PINNED_STORAGE_KEY, pinned ? "1" : "0");
  } catch {
    // Persistenz ist best-effort; der UI-Zustand bleibt trotzdem aktuell.
  }
  window.dispatchEvent(new CustomEvent<boolean>(NAV_RAIL_CHANGE_EVENT, { detail: pinned }));
}

export function useNavRailPinned(): [boolean, (pinned: boolean) => void] {
  const [pinned, setPinnedState] = useState<boolean>(NAV_RAIL_PINNED_DEFAULT);

  useEffect(() => {
    setPinnedState(loadNavRailPinned());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setPinnedState(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === NAV_RAIL_PINNED_STORAGE_KEY) setPinnedState(loadNavRailPinned());
    };
    window.addEventListener(NAV_RAIL_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NAV_RAIL_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setPinned = useCallback((next: boolean) => {
    setPinnedState(next);
    saveNavRailPinned(next);
  }, []);

  return [pinned, setPinned];
}
