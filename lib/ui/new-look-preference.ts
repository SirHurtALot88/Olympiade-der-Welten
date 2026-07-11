"use client";

import { useCallback, useEffect, useState } from "react";

export const NEW_LOOK_STORAGE_KEY = "oly-new-look-v1";

export function loadNewLookEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(NEW_LOOK_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as unknown;
    return parsed === true;
  } catch {
    return false;
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
 * SSR renders `false` (no visual change), then syncs to the stored preference
 * after hydration to avoid hydration mismatches. Changes are persisted to
 * localStorage and broadcast within the tab so multiple consumers stay in sync.
 */
export function useNewLook(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

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
