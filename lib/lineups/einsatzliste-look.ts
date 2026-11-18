"use client";

/**
 * WELCHE EINSATZLISTE: modern (Broadcast-Stil, Standard seit 17.11.) oder klassisch (`LineupNewLook`).
 *
 * Plan `docs/design/oly-seiten-modern-17-11.md`: neue Ansicht neben der alten, bis Chris sie
 * freigibt. Die klassische bleibt deshalb erreichbar — per Knopf in der neuen Ansicht oder per
 * Adresse `?einsatzliste=klassisch` (und `?einsatzliste=modern` zurück). Die Wahl steht im
 * localStorage dieses Browsers; kaputter oder gesperrter Speicher fällt auf „modern" zurück.
 *
 * Dieselbe Quelle liest die Shell (Icon-Schiene nur bei der modernen Ansicht) und der Client
 * (welche Komponente gemountet wird), deshalb ein kleiner Store statt zweier eigener Lesestellen.
 */
import { useCallback, useSyncExternalStore } from "react";

export const EINSATZLISTE_LOOK_STORAGE_KEY = "oly-einsatzliste-look";
const EREIGNIS = "oly-einsatzliste-look-change";

export type EinsatzlisteLook = "modern" | "klassisch";

function leseAdresse(): EinsatzlisteLook | null {
  try {
    const wert = new URLSearchParams(window.location.search).get("einsatzliste");
    return wert === "klassisch" || wert === "modern" ? wert : null;
  } catch {
    return null;
  }
}

export function leseEinsatzlisteLook(): EinsatzlisteLook {
  if (typeof window === "undefined") return "modern";
  const ausAdresse = leseAdresse();
  if (ausAdresse) return ausAdresse;
  try {
    return window.localStorage.getItem(EINSATZLISTE_LOOK_STORAGE_KEY) === "klassisch" ? "klassisch" : "modern";
  } catch {
    return "modern";
  }
}

export function setzeEinsatzlisteLook(look: EinsatzlisteLook): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EINSATZLISTE_LOOK_STORAGE_KEY, look);
  } catch {
    // Speicher gesperrt: die Wahl gilt dann nur bis zum Neuladen über die Adresse.
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("einsatzliste")) {
      url.searchParams.set("einsatzliste", look);
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
export function useEinsatzlisteLook(): [EinsatzlisteLook, (look: EinsatzlisteLook) => void] {
  const look = useSyncExternalStore(abonniere, leseEinsatzlisteLook, () => "modern" as EinsatzlisteLook);
  const setze = useCallback((naechster: EinsatzlisteLook) => setzeEinsatzlisteLook(naechster), []);
  return [look, setze];
}
