"use client";

/**
 * "Neuer Look" ist ab sofort der EINZIGE Look. Der frühere Opt-out-Toggle
 * (klassischer Look) wurde entfernt; das Flag ist permanent an. Die Exporte
 * bleiben bestehen, damit die ~50 `useNewLook()`-Aufrufstellen unverändert
 * weiterlaufen — sie bekommen jetzt konstant `true` und einen No-op-Setter.
 */
export const NEW_LOOK_STORAGE_KEY = "oly-new-look-v1";
export const NEW_LOOK_DEFAULT = true;

export function loadNewLookEnabled(): boolean {
  return true;
}

export function saveNewLookEnabled(_enabled: boolean): void {
  // Kein Opt-out mehr — Präferenz wird nicht mehr gespeichert.
}

/**
 * Runtime-Flag als React-Hook. Liefert konstant `true` (Neuer Look) und einen
 * No-op-Setter, damit bestehende `const [enabled, setEnabled] = useNewLook()`
 * Aufrufe kompilieren. Kein Storage-Read, kein Effekt → kein Hydration-Flash.
 */
export function useNewLook(): [boolean, (value: boolean) => void] {
  return [true, () => {}];
}
