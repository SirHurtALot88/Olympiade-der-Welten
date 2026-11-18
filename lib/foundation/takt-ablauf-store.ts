/**
 * Kleiner Speicher: ist der Ablauf-Aufklapper des Taktgebers offen? Die Leertaste (Scope-Hook) und der
 * Taktgeber (Regieband) teilen sich diesen Zustand, ohne dass einer den anderen kennt.
 */
let offen = false;
const hoerer = new Set<() => void>();

export function getTaktAblaufOffen(): boolean {
  return offen;
}

export function setTaktAblaufOffen(wert: boolean): void {
  if (offen === wert) return;
  offen = wert;
  hoerer.forEach((fn) => fn());
}

export function abonniereTaktAblauf(fn: () => void): () => void {
  hoerer.add(fn);
  return () => {
    hoerer.delete(fn);
  };
}
