"use client";

import { useCallback, useEffect, useState } from "react";

export const NEW_LOOK_STORAGE_KEY = "oly-new-look-v1";

/**
 * "Neuer Look" ist der Standard-Look. Ohne gespeicherte Präferenz ist er an;
 * wer ihn abwählt, bekommt weiterhin den klassischen Look (Opt-out bleibt bestehen).
 */
export const NEW_LOOK_DEFAULT = true;

export function loadNewLookEnabled(): boolean {
  if (typeof window === "undefined") {
    return NEW_LOOK_DEFAULT;
  }

  try {
    const raw = window.localStorage.getItem(NEW_LOOK_STORAGE_KEY);
    if (!raw) {
      // Keine gespeicherte Wahl → Standard (Neuer Look an).
      return NEW_LOOK_DEFAULT;
    }

    const parsed = JSON.parse(raw) as unknown;
    return parsed === true;
  } catch {
    return NEW_LOOK_DEFAULT;
  }
}

export function saveNewLookEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(NEW_LOOK_STORAGE_KEY, JSON.stringify(enabled === true));
  } catch {
    // localStorage voll oder blockiert — Preference wird still verworfen.
  }
}

/**
 * "Neuer Look" runtime flag as a React hook.
 *
 * The New Look is the default. Both SSR and the first client render start from
 * `NEW_LOOK_DEFAULT`, so the initial render is deterministic (no hydration
 * mismatch) and there is no default-look flash. After hydration the effect reads
 * the stored preference: only a user who explicitly opted out flips to the
 * classic look. Changes are persisted to localStorage and broadcast within the
 * tab so multiple consumers stay in sync.
 */
export function useNewLook(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(NEW_LOOK_DEFAULT);

  useEffect(() => {
    setEnabled(loadNewLookEnabled());

    function handleNewLookChange(event: Event) {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setEnabled(detail.enabled);
      }
    }

    window.addEventListener("oly-new-look-change", handleNewLookChange);
    return () => window.removeEventListener("oly-new-look-change", handleNewLookChange);
  }, []);

  const update = useCallback((value: boolean) => {
    setEnabled(value);
    saveNewLookEnabled(value);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("oly-new-look-change", { detail: { enabled: value } }));
    }
  }, []);

  return [enabled, update];
}
