import type { ContractShape } from "@/lib/data/olyDataTypes";

/**
 * Die kanonischen Labels der Vertragsform — eine Quelle fuer alle Ansichten.
 *
 * Warum englisch: FL und BL sind die im Spiel und in den Tabellen benutzten Abkuerzungen.
 * Eine deutsche Beschriftung ("vorne schwer") wuerde die Abkuerzung von ihrem Wort trennen,
 * und der Spieler muesste sich zwei Begriffe fuer dieselbe Sache merken.
 *
 * Vorher standen hier drei verschiedene Saetze nebeneinander: "vorne schwer" im Markt-Kauf,
 * "Front-loaded" in der Teams-Ansicht und der Vertragsverhandlung, "Vorne schwer" in der
 * Spieler-Tabelle. Wer etwas ergaenzt, ergaenzt es hier.
 */
export const CONTRACT_SHAPE_LABELS: Record<ContractShape, string> = {
  balanced: "Balanced",
  front_loaded: "Front-loaded",
  back_loaded: "Back-loaded",
};

/**
 * Beschriftet eine Vertragsform. Der Rueckfall bleibt Sache der aufrufenden Ansicht: die
 * Tabellen zeigen einen Gedankenstrich, der Markt-Kauf zeigt "offen", weil dort ein noch
 * nicht verhandelter Vertrag gemeint ist und nicht ein fehlender Wert.
 */
export function contractShapeLabel(shape: ContractShape | null | undefined, fallback: string): string {
  if (shape === "balanced" || shape === "front_loaded" || shape === "back_loaded") {
    return CONTRACT_SHAPE_LABELS[shape];
  }
  return fallback;
}
