/**
 * EINE Stelle, an der der Taktgeber seine Aktion hinterlegt (21.11., Chris: „Leertaste muss einen auch wirklich weiter bringen
 * und der Button IMMER zum nächsten wichtigen Screen“).
 *
 * Vorher rief die Leertaste im Scope-Hook immer `triggerGlobalNext()` auf, der Knopf aber je nach Ansicht die Aktion des Drafts,
 * der Einsatzliste oder des globalen Flows. Im Draft sprang die Leertaste deshalb in den globalen Flow, statt zu picken bzw. zu
 * erklären. Jetzt registriert der sichtbare Taktgeber seine EIGENE Aktion hier, und die Leertaste ruft exakt diese.
 */
export type TaktRegistrierung = {
  /** Dieselbe Funktion wie der Klick auf den Knopf. */
  ausloesen: () => void;
  /** Anzahl kritischer Punkte, die den Spieltag aufhalten (Leertaste zeigt dann den Ablauf statt weiterzugehen). */
  kritisch: number;
  /** Springt zum ersten kritischen Punkt. */
  springeZumKritischen: (() => void) | null;
  /** `laeuft` = der Knopf ist gesperrt; die Leertaste tut dann bewusst nichts. */
  gesperrt: boolean;
};

let aktuell: TaktRegistrierung | null = null;

export function setzeTaktRegistrierung(wert: TaktRegistrierung | null): void {
  aktuell = wert;
}

export function holeTaktRegistrierung(): TaktRegistrierung | null {
  return aktuell;
}
