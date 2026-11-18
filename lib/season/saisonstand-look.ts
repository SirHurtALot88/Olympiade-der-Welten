"use client";

/**
 * WELCHER SAISONSTAND: modern (Broadcast-Stil, Standard seit 18.11.) oder klassisch (`SeasonStandingsNewLook`).
 * Gleiches Muster wie `lib/lineups/einsatzliste-look.ts`: Adresse `?saisonstand=klassisch` bzw. `=modern`,
 * sonst die Wahl aus dem localStorage dieses Browsers, bei kaputtem Speicher „modern".
 */
import { useCallback, useSyncExternalStore } from "react";

export const SAISONSTAND_LOOK_STORAGE_KEY = "oly-saisonstand-look";
const EREIGNIS = "oly-saisonstand-look-change";

export type SaisonstandLook = "modern" | "klassisch";

function leseAdresse(): SaisonstandLook | null {
  try {
    const wert = new URLSearchParams(window.location.search).get("saisonstand");
    return wert === "klassisch" || wert === "modern" ? wert : null;
  } catch {
    return null;
  }
}

export function leseSaisonstandLook(): SaisonstandLook {
  if (typeof window === "undefined") return "modern";
  const ausAdresse = leseAdresse();
  if (ausAdresse) return ausAdresse;
  try {
    return window.localStorage.getItem(SAISONSTAND_LOOK_STORAGE_KEY) === "klassisch" ? "klassisch" : "modern";
  } catch {
    return "modern";
  }
}

export function setzeSaisonstandLook(look: SaisonstandLook): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAISONSTAND_LOOK_STORAGE_KEY, look);
  } catch {
    // Speicher gesperrt: die Wahl gilt dann nur über die Adresse.
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("saisonstand")) {
      url.searchParams.set("saisonstand", look);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // Adresse nicht schreibbar: unkritisch.
  }
  window.dispatchEvent(new Event(EREIGNIS));
}

function abonniere(rueckruf: () => void): () => void {
  window.addEventListener(EREIGNIS, rueckruf);
  window.addEventListener("storage", rueckruf);
  window.addEventListener("popstate", rueckruf);
  return () => {
    window.removeEventListener(EREIGNIS, rueckruf);
    window.removeEventListener("storage", rueckruf);
    window.removeEventListener("popstate", rueckruf);
  };
}

/** Aktuelle Wahl; auf dem Server und beim ersten Hydrieren immer „modern". */
export function useSaisonstandLook(): [SaisonstandLook, (look: SaisonstandLook) => void] {
  const look = useSyncExternalStore(abonniere, leseSaisonstandLook, () => "modern" as SaisonstandLook);
  const setze = useCallback((naechster: SaisonstandLook) => setzeSaisonstandLook(naechster), []);
  return [look, setze];
}
