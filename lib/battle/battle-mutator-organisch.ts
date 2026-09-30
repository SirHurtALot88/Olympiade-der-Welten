/**
 * MUTATOR ORGANISCH IM BATTLE-MODUS (29.09., docs/design/mutator-trait-organische-performance-
 * konzept-29-09.md, Abschnitte "Chris' Entscheidungen" und "Finale Umsetzung").
 *
 * Chris' drei Antworten, woertlich:
 *   1. "ja genau das soll das ersetzen, deswegen soll der spieler quasi von seinen stats 5-8%
 *      besser werden wo ich mir erhoffe, dass das auf 0,3 PPs raus laufen könnte. [...] vllt
 *      müsste es auch ein flat stat boost sein, das sollst du prüfen und einbauen"
 *   2. "vom Skillwert bzw jedem Attribut"
 *   3. (gilt das auch im Manager-Modus?) "nein"
 *
 * Umgesetzt heisst das: in jeder Battle-Disziplin, die die Arena-Engine SIMULIERT
 * (`ARENA_RESOLVED_DISCIPLINE_IDS`), bekommt ein Spieler mit `h` Mutator-Treffern (0/1/2) fuer
 * diesen Spieltag auf JEDES seiner zwoelf Attribute `h * BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER`
 * Punkte — am Eingang der Simulation, vor Eignung, Slot-/Form-Aufschlag und Rezept. Der flache
 * `+6 Score`/`+0,3 PP`-Nachschlag aus `calculateMutatorModifierForSide()` entfaellt fuer genau
 * diese Seiten (`toBattleArenaOrganicMutatorResult()`, legacy-lineup-modifiers.ts), sonst waere es
 * eine Doppelbuchung. Manager-Modus und die fuenf nicht simulierten Battle-Disziplinen (TDM,
 * Mini-DM, Battlefield, Football, I-Spy) behalten das bisherige System unveraendert — dort gibt es
 * keine Simulation, in die der Bonus eingehen koennte.
 *
 * FLACH STATT PROZENTUAL — die Begruendung mit Zahlen steht im Konzeptdokument ("Finale
 * Umsetzung", Abschnitt F.1). Kurz: prozentual haette ein starker Spieler je Disziplin im Mittel
 * das 3,8-Fache an Eignungspunkten eines schwachen bekommen, gemessen an den echten Kadern des
 * Live-Abbilds; die abgeloesten 0,3 PP waren fuer jeden Spieler gleich viel wert.
 *
 * DIESE ZAHL STEHT ZWEIMAL: hier und als `MUTATOR_ORGANISCH` in
 * public/mockups/battle-mode.engine.js (die Engine ist reines Browser-JS und kann nichts
 * importieren). `tests/battle-mutator-organisch.test.ts` haelt beide gleich.
 */
export const BATTLE_MUTATOR_ORGANISCH_ART = "flach" as const;
export const BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER = 3.5;

/** Kurztext fuer Quellen-/Hinweiszeilen, dieselbe Zahl wie oben. */
export function describeBattleArenaOrganicMutatorEffect(): string {
  return (
    `Battle-Modus, simulierte Disziplinen: +${BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER} auf jedes Attribut je Treffer ` +
    "fuer diesen Spieltag, die Mehrleistung entsteht im Spiel selbst (kein +6 Score, keine +0,3 PP)."
  );
}
