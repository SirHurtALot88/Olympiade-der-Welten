/**
 * WELCHE AKTION HAT DER TAKTGEBER JETZT? (21.11.) Die Auswahl stand als verschachtelter Ausdruck im JSX der Shell und war nicht
 * prüfbar. Hier steht sie als reine Funktion, Reihenfolge = Vorrang:
 *
 *   1. Draft-Seite offen und meldet einen Takt          -> `draft`   (Pick, „Vor zu meinem Pick“, „Weiter“ nach dem Draft …)
 *   2. Draft wartet (Startwahl/Office-Hinweis)          -> `draft-hinweis` („Zum Draft“, öffnet die Seite)
 *   3. Einsatzliste offen und meldet Abgabe             -> `einsatzliste`
 *   4. sonst                                            -> `global` (nächster Schritt des Spielablaufs)
 *
 * Die Tabelle je Phase steht in docs/design/navigation-flow-21-11/weiter-flow.md.
 */
export type TaktQuelle = "draft" | "draft-hinweis" | "einsatzliste" | "global";

export function waehleTaktQuelle(input: {
  draftSeiteOffen: boolean;
  draftMeldetTakt: boolean;
  draftHinweis: boolean;
  einsatzlisteAnsicht: boolean;
  einsatzlisteMeldetAbgabe: boolean;
}): TaktQuelle {
  if (input.draftSeiteOffen && input.draftMeldetTakt) return "draft";
  if (input.draftHinweis) return "draft-hinweis";
  if (input.einsatzlisteAnsicht && input.einsatzlisteMeldetAbgabe) return "einsatzliste";
  return "global";
}

/**
 * Ein Draft dieser Saison trägt den Aufbau der Liga selbst (Seite bzw. Hinweis). Das Schild „Liga wird erstellt“ samt Aktivität
 * „Aktion läuft“ gehört nur zum alten Blocklauf OHNE Draft-Zustand. Mit Draft-Zustand blieb `in_progress` stehen, solange der
 * Mensch noch pickte oder wählte, und der Knopf oben rechts zeigte „AKTION LÄUFT · Liga wird erstellt“, obwohl er dran war.
 */
export function ligaAufbauAktivitaetStatus(
  leagueSetupStatus: "in_progress" | "ready" | "failed" | null | undefined,
  ligaDraftDieserSaison: boolean,
): "in_progress" | "ready" | "failed" | null {
  if (!leagueSetupStatus) return null;
  if (ligaDraftDieserSaison && leagueSetupStatus === "in_progress") return null;
  return leagueSetupStatus;
}
