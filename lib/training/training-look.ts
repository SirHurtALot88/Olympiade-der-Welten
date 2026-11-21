"use client";

/**
 * WELCHES TRAINING: modern (Bereich Entwicklung, Standard seit 21.11.) oder klassisch (`TrainingCompactNewLook`).
 * Gleiches Muster wie `lib/lineups/einsatzliste-look.ts`: Adresse `?training=klassisch` bzw. `=modern`,
 * sonst die Wahl aus dem localStorage dieses Browsers, bei kaputtem Speicher „modern".
 */
import { useCallback, useSyncExternalStore } from "react";

export const TRAINING_LOOK_STORAGE_KEY = "oly-training-look";
const EREIGNIS = "oly-training-look-change";

export type TrainingLook = "modern" | "klassisch";

function leseAdresse(): TrainingLook | null {
  try {
    const wert = new URLSearchParams(window.location.search).get("training");
    return wert === "klassisch" || wert === "modern" ? wert : null;
  } catch {
    return null;
  }
}

export function leseTrainingLook(): TrainingLook {
  if (typeof window === "undefined") return "modern";
  const ausAdresse = leseAdresse();
  if (ausAdresse) return ausAdresse;
  try {
    return window.localStorage.getItem(TRAINING_LOOK_STORAGE_KEY) === "klassisch" ? "klassisch" : "modern";
  } catch {
    return "modern";
  }
}

export function setzeTrainingLook(look: TrainingLook): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRAINING_LOOK_STORAGE_KEY, look);
  } catch {
    // Speicher gesperrt: die Wahl gilt dann nur über die Adresse.
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("training")) {
      url.searchParams.set("training", look);
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
export function useTrainingLook(): [TrainingLook, (look: TrainingLook) => void] {
  const look = useSyncExternalStore(abonniere, leseTrainingLook, () => "modern" as TrainingLook);
  const setze = useCallback((naechster: TrainingLook) => setzeTrainingLook(naechster), []);
  return [look, setze];
}
