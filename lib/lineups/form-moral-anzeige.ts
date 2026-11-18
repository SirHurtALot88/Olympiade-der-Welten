/**
 * FORM + MORAL FUER DIE ANZEIGE (18.11., Vorlage: public/mockups/form-moral-modern-17-11.html).
 *
 * Alles hier liest NUR gespeicherte Zahlen (`playerFormState`, `playerMoraleState`, `Player.fatigue`,
 * `playerDisciplinePerformances`) und rechnet die Wirkung mit denselben Funktionen, die auch die
 * Wertung benutzt (`calculateFormMoralSignal`, `formkartenZerlegungFuerSpieler`). Es erfindet nichts:
 * fehlt ein Wert (Spielstand ohne Form-Verlauf, Schalter aus), kommt `null` bzw. eine leere Liste
 * zurueck und die Oberflaeche blendet den Teil aus.
 */
import type { GameState, PlayerFormHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  FORM_ERSCHOEPFUNG_SCHWELLE,
  calculateFormMoralSignal,
  formToStufe,
  isFormMoralEnabled,
  resolveFormMoralDosisPct,
} from "@/lib/morale/form-moral-modifikator";
import { moralStufe } from "@/lib/morale/moral-anzeige";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";

export const FORM_STUFEN_WORT: Record<number, string> = { [-2]: "eiskalt", [-1]: "kalt", 0: "normal", 1: "gut drauf", 2: "heiß" };

export type FormMoralAnzeige = {
  playerId: string;
  /** Gibt es einen gespeicherten Form-Wert? Sonst blendet die Oberflaeche den Pfeil aus. */
  formVerfuegbar: boolean;
  form: number | null;
  formStufe: number;
  formWort: string;
  formPct: number;
  moral: number | null;
  moralWort: string | null;
  moralPct: number;
  /** Form + Moral zusammen, Prozent auf die Eignung (gedeckelt). */
  gesamtPct: number;
  erschoepfung: number | null;
  /** Abzug am Form-Ziel durch Erschoepfung (0 unter der Schwelle). */
  bremsePunkte: number;
  verlauf: PlayerFormHistoryEntry[];
  /** Die letzten bis zu drei Einsaetze (Perzentil Erwartung -> Leistung). */
  letzteEinsaetze: PlayerFormHistoryEntry[];
};

export function baueFormMoralAnzeige(gameState: GameState | null | undefined, playerId: string): FormMoralAnzeige {
  const aus: FormMoralAnzeige = {
    playerId,
    formVerfuegbar: false,
    form: null,
    formStufe: 0,
    formWort: FORM_STUFEN_WORT[0],
    formPct: 0,
    moral: null,
    moralWort: null,
    moralPct: 0,
    gesamtPct: 0,
    erschoepfung: null,
    bremsePunkte: 0,
    verlauf: [],
    letzteEinsaetze: [],
  };
  if (!gameState) return aus;
  const formZeile = isFormMoralEnabled() ? (gameState.playerFormState ?? []).find((z) => z.playerId === playerId) : undefined;
  const moralZeile = (gameState.playerMoraleState ?? []).find((z) => z.playerId === playerId);
  const spieler = gameState.players.find((p) => p.id === playerId);
  const dosis = resolveFormMoralDosisPct();
  const signal = calculateFormMoralSignal({ form: formZeile?.form, morale: moralZeile?.morale, dosisPct: dosis });
  const erschoepfung = spieler ? spieler.fatigue : null;
  const bremsePunkte =
    erschoepfung != null && erschoepfung > FORM_ERSCHOEPFUNG_SCHWELLE
      ? Number((((erschoepfung - FORM_ERSCHOEPFUNG_SCHWELLE) / (100 - FORM_ERSCHOEPFUNG_SCHWELLE)) * 15).toFixed(1))
      : 0;
  const verlauf = (formZeile?.verlauf ?? []).filter((v) => v.seasonId === gameState.season.id);
  const form = formZeile ? signal.form : null;
  const stufe = formZeile ? formToStufe(formZeile.form) : 0;
  return {
    playerId,
    formVerfuegbar: Boolean(formZeile),
    form,
    formStufe: stufe,
    formWort: FORM_STUFEN_WORT[stufe],
    formPct: formZeile ? signal.formPct : 0,
    moral: moralZeile ? signal.morale : null,
    moralWort: moralZeile ? moralStufe(moralZeile.morale).wort : null,
    moralPct: moralZeile ? signal.moralePct : 0,
    gesamtPct: formZeile || moralZeile ? signal.modifierPct : 0,
    erschoepfung,
    bremsePunkte,
    verlauf,
    letzteEinsaetze: verlauf.filter((v) => v.eingesetzt).slice(-3),
  };
}

/** Satz zur Begruendung eines Spieltags (vier Bausteine: Erwartung, Bremse, kein Einsatz, verletzt). */
export function formBegruendung(eintrag: PlayerFormHistoryEntry, disziplinName?: string | null): string {
  if (eintrag.bremse?.art === "verletzung") return `Verletzt: ${eintrag.bremse.punkte} Punkte Abzug auf die Form.`;
  if (!eintrag.eingesetzt) return "Kein Einsatz: die Form nähert sich der Mitte.";
  const bremse =
    eintrag.bremse?.art === "erschoepfung" ? ` Die Erschöpfung bremst zusätzlich (−${eintrag.bremse.punkte.toLocaleString("de-DE")}).` : "";
  if (eintrag.leistungPerz == null || eintrag.erwartungPerz == null) {
    return `Eingesetzt, aber zu wenige Teilnehmer für einen Vergleich mit der Erwartung.${bremse}`;
  }
  const abstand = eintrag.leistungPerz - eintrag.erwartungPerz;
  const wo = disziplinName ? `${disziplinName}: ` : "";
  const art = abstand >= 10 ? "klar über" : abstand > 2 ? "leicht über" : abstand <= -10 ? "klar unter" : abstand < -2 ? "leicht unter" : "auf";
  // Auf Erwartung zieht die Form zur Mitte: wer heiß ist, muss klar darüber bleiben (und wer kalt ist, steigt).
  const mitte = art === "auf" && eintrag.form !== eintrag.vorher ? " Die Form nähert sich der Mitte." : "";
  return `${wo}Leistung ${eintrag.leistungPerz} gegen erwartete ${eintrag.erwartungPerz}, ${art} Erwartung.${mitte}${bremse}`;
}

export type FormMeldung = {
  playerId: string;
  name: string;
  teamId: string;
  vorher: number;
  nachher: number;
  stufeVorher: number;
  stufeNachher: number;
  delta: number;
  richtung: "gestiegen" | "gefallen" | "gleich";
  grund: string;
};

/**
 * Form-Meldungen eines Spieltags fuer EIN Team: aus dem gespeicherten Verlauf, groesste Bewegung zuerst.
 * Leer, wenn der Spieltag keinen Verlaufseintrag hat (aelterer Spielstand, Schalter aus).
 */
export function baueFormMeldungen(
  gameState: GameState | null | undefined,
  teamId: string,
  matchdayId: string,
  disziplinName: (id: string) => string | null = () => null,
): FormMeldung[] {
  if (!gameState || !isFormMoralEnabled()) return [];
  const namen = new Map(gameState.players.map((p) => [p.id, p.name]));
  const meldungen: FormMeldung[] = [];
  for (const zeile of gameState.playerFormState ?? []) {
    if (zeile.teamId !== teamId) continue;
    const eintrag = (zeile.verlauf ?? []).find((v) => v.matchdayId === matchdayId && v.seasonId === gameState.season.id);
    if (!eintrag) continue;
    const delta = Number((eintrag.form - eintrag.vorher).toFixed(1));
    meldungen.push({
      playerId: zeile.playerId,
      name: namen.get(zeile.playerId) ?? zeile.playerId,
      teamId,
      vorher: eintrag.vorher,
      nachher: eintrag.form,
      stufeVorher: formToStufe(eintrag.vorher),
      stufeNachher: formToStufe(eintrag.form),
      delta,
      richtung: delta > 0.05 ? "gestiegen" : delta < -0.05 ? "gefallen" : "gleich",
      grund: formBegruendung(eintrag, eintrag.disziplinId ? disziplinName(eintrag.disziplinId) : null),
    });
  }
  return meldungen.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Die staerksten Moral-Ursachen (nach Betrag), aus derselben Bewertung, die die Moral fortschreibt. */
export function moralUrsachen(
  gameState: GameState | null | undefined,
  playerId: string,
  teamId: string | null,
  anzahl = 3,
): Array<{ id: string; label: string; delta: number }> {
  if (!gameState) return [];
  try {
    const bewertung = assessPlayerMorale({ gameState, playerId, teamId });
    return (bewertung?.reasons ?? [])
      .filter((r) => Math.abs(r.valueDelta) >= 0.5)
      .sort((a, b) => Math.abs(b.valueDelta) - Math.abs(a.valueDelta))
      .slice(0, anzahl)
      .map((r) => ({ id: r.reasonId, label: r.label, delta: r.valueDelta }));
  } catch {
    return [];
  }
}
