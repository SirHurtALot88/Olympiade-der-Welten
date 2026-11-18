/**
 * Kleiner Speicher: die Abgabe der Einsatzliste als Hauptaktion des Taktgebers (Regieband).
 * Die Einsatzliste meldet sich hier an, solange sie offen ist; das Regieband zeigt dann „Abgeben“ (bzw. „Zur Arena“)
 * statt „Weiter: Einsatzliste setzen“. So gibt es genau EINEN Knopf für die Hauptaktion, nicht zwei.
 */
export type EinsatzlisteAbgabe = {
  label: string;
  title: string;
  /** `is-ready` | `is-warning` | `is-blocked` — gleiche Klassen wie der globale Weiter-Knopf. */
  statusClass: string;
  onClick: () => void;
};

let aktuell: EinsatzlisteAbgabe | null = null;
const hoerer = new Set<() => void>();

export function getEinsatzlisteAbgabe(): EinsatzlisteAbgabe | null {
  return aktuell;
}

export function setEinsatzlisteAbgabe(wert: EinsatzlisteAbgabe | null): void {
  aktuell = wert;
  hoerer.forEach((fn) => fn());
}

export function abonniereEinsatzlisteAbgabe(fn: () => void): () => void {
  hoerer.add(fn);
  return () => {
    hoerer.delete(fn);
  };
}
