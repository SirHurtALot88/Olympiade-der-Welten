import type { ContractShape } from "@/lib/data/olyDataTypes";

/**
 * Die kanonischen Labels der Vertragsform — eine Quelle fuer alle Ansichten.
 *
 * Entscheidung: deutsch. Die Abkuerzungen FL/BL (siehe `formatContractShapeShortLabel` in
 * `player-economy-contract.ts`) bleiben davon unberuehrt — sie sind Kuerzel fuer Tabellenspalten,
 * kein zweites Vokabular, das gelernt werden muesste.
 *
 * Vorher standen hier drei verschiedene Saetze nebeneinander: "vorne schwer" im Markt-Kauf,
 * "Front-loaded" in der Teams-Ansicht und der Vertragsverhandlung, "Vorne schwer" in der
 * Spieler-Tabelle. Ein erster Anlauf, das zusammenzuziehen, landete bei Englisch (siehe Git-
 * Historie dieser Datei) und riss dabei die Teams-Ansicht und die Vertragsverhandlung aus ihrem
 * sonst durchgehend deutschen Text. Wer etwas ergaenzt, ergaenzt es hier — nicht an einer der
 * frueheren Stellen.
 */
export const CONTRACT_SHAPE_LABELS: Record<ContractShape, string> = {
  balanced: "Ausgeglichen",
  front_loaded: "Vorne schwer",
  back_loaded: "Hinten schwer",
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
