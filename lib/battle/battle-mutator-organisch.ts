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

/**
 * MUTATOR = FORM, KEINE PUNKTE (Chris 18.11.): "Mutator-Punkte zählen nicht mehr für Team-Punkte, also
 * keine 2,3 für einen Sieg oder so, das gibt es in dem Modus nicht mehr! Mutatoren sorgen nur noch für
 * eine bessere Form der Spieler, wo es triggert."
 *
 * Im Battle-Modus bucht ein Mutator-Treffer deshalb NIE mehr Score (+6) oder Spieler-PP (+0,3) — auf
 * keinem Pfad, auch nicht auf der PPS-Duell-Bruecke oder in der Einsatzlisten-Vorschau. Stattdessen
 * bekommt der getroffene Spieler einen Formschub in dieser Disziplin:
 *   - Motor-gebuchte Seiten (Duelle, Pods): wie seit 29.09. im Motor selbst, +3,5 auf jedes Attribut je
 *     Treffer = +3,5 Eignungspunkte (Matrixgewichte summieren sich auf 100). Unveraendert, darum bleiben
 *     Fingerabdruck, rho und Pp dort gleich.
 *   - Legacy-gewertete Seiten (PPS-Duell-Bruecke, Rueckfall ohne Arena-Ergebnis) und die Vorschau: ueber
 *     DENSELBEN Kanal wie die Formkarten (`formByPlayerId[...].summe`, Feld `mutator`), dieselbe Hoehe
 *     `MUTATOR_FORM_JE_TREFFER` = 3,5 je Treffer statt +6 Score und +0,3 PP.
 * Manager-Modus: unveraendert (+6 Score / +0,3 PP).
 *
 * Schalter: `OLY_MUTATOR_ALS_FORM=0` (bzw. aus/off/false/alt) stellt den alten Battle-Weg wieder her.
 * Bereits gebuchte Spieltage bleiben, wie sie gebucht sind: Score und PP stehen in den Ergebnis- und
 * Leistungsdatensaetzen und werden nie neu gerechnet; die Regel greift ab dem naechsten gewerteten Spieltag.
 */
export const MUTATOR_FORM_JE_TREFFER = BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER;

export function isMutatorAlsFormAktiv(env: Record<string, string | undefined> = lieseUmgebung()): boolean {
  const roh = (env.OLY_MUTATOR_ALS_FORM ?? "").trim().toLowerCase();
  return !(roh === "0" || roh === "alt" || roh === "aus" || roh === "off" || roh === "false");
}

function lieseUmgebung(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

/** Formschub je Spieler aus den Mutator-Treffern (0/1/2 je Spieler), eine Dezimale. */
export function mutatorFormJeSpieler(trefferJeSpieler: Record<string, number> | null | undefined): Record<string, number> {
  const aus: Record<string, number> = {};
  for (const [playerId, treffer] of Object.entries(trefferJeSpieler ?? {})) {
    if (Number.isFinite(treffer) && treffer > 0) aus[playerId] = Number((treffer * MUTATOR_FORM_JE_TREFFER).toFixed(1));
  }
  return aus;
}
