/**
 * FESTNAGELN DES SPIELTAGS — gegen das Nachbessern zwischen zwei Arena-Blicken.
 *
 * GEMELDET AUS DEM SPIEL: "man geht ohne Formkarten in die Arena, schaut sich das Ergebnis an,
 * geht wieder raus, macht sich Formkarten rein, bis man genug Plaetze aufgestiegen ist, und
 * beendet dann den Spieltag."
 *
 * Das funktionierte, weil der Spieltag reproduzierbar gerechnet wird: dieselben Aufstellungen
 * ergeben immer dasselbe Ergebnis (die Jitter sind Hashes ueber Spieler|Disziplin|Spieltag, kein
 * Wurf pro Lauf). Wer das Ergebnis einmal gesehen hat, kann also gezielt so lange nachbessern,
 * bis es passt — die Vorschau wird bei jeder Aenderung der Aufstellung neu gerechnet
 * (`buildMatchdayResolveSignature` deckt Eintraege UND `modifiers` ab).
 *
 * Der Riegel dagegen existierte bereits: `saveLocalLegacyLineupDraft` weigert sich, einen Draft
 * im Status `locked` oder `resolved` zu ueberschreiben. Nur hat ihn nie jemand scharf gestellt —
 * jedes Speichern schrieb `submitted`, und das steht nicht auf der Sperrliste.
 *
 * WARUM DIE SPERRE MEHR ALS DIE FORMKARTEN UMFASST: gemeldet war "Formkarten nicht mehr
 * anpassbar". Das allein schliesst die Luecke nicht — nach dem Arena-Blick einen starken Spieler
 * nachzuschieben oder den Kapitaen (x1,5) umzusetzen wirkt genauso. Der Kapitaen steckt ohnehin
 * in den Eintraegen, nicht in den Modifikatoren; eine Sperre nur auf `modifiers` waere also schon
 * technisch halb. Festgenagelt wird deshalb die ganze Abgabe.
 */
import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";

export type LineupCommitmentSummary = {
  /** Mindestens eine Formkarte auf einer der beiden Disziplin-Seiten. */
  hasFormCards: boolean;
  /** Mindestens ein Kapitaen gesetzt (steckt im Eintrag, nicht in den Modifikatoren). */
  hasCaptain: boolean;
  /**
   * Weder Formkarte noch Kapitaen. Das ist erlaubt — aber fast nie Absicht, und nach dem
   * Festnageln nicht mehr korrigierbar. Genau hier fragt die Oberflaeche nach.
   */
  isEmptyCommitment: boolean;
};

/**
 * Was der Manager mit dieser Abgabe tatsaechlich einsetzt.
 *
 * Bewusst tolerant gegenueber fehlenden Feldern: ein unvollstaendiger Modifikator-Block ist kein
 * Fehlerfall, sondern der Normalzustand einer Aufstellung ohne Karten.
 */
export function describeLineupCommitment(
  entries: readonly LegacyLineupEntryInput[] | null | undefined,
  modifiers: LineupDraftModifiers | null | undefined,
): LineupCommitmentSummary {
  const cardIds = (["d1", "d2"] as const).flatMap((side) => [
    modifiers?.[side]?.primaryFormCardId ?? null,
    modifiers?.[side]?.secondaryFormCardId ?? null,
  ]);
  const hasFormCards = cardIds.some((id) => Boolean(id));
  const hasCaptain = (entries ?? []).some((entry) => Boolean(entry?.isCaptain));
  return {
    hasFormCards,
    hasCaptain,
    isEmptyCommitment: !hasFormCards && !hasCaptain,
  };
}
