/**
 * FORMKARTEN-WIRKUNG FUER DIE ANZEIGE (18.11.) — "gezeigt = gebucht".
 *
 * Die Zahlen kommen aus `calculateFormModifierForSide` (dieselbe Funktion wie Wertung, Arena-
 * Aufstellungsadapter und KI), nur mit einer Kartenauswahl, die der Aufrufer vorgibt. Zusaetzlich sagt
 * `formkartenBuchung`, ob die Punkte in dieser Disziplin ueberhaupt gebucht werden:
 *
 *  - Manager-Modus (Legacy-Wertung): ueberall.
 *  - Battle-Modus, Disziplin arena-aufgeloest: nur wenn der Motor die echte Karte liest
 *    (`FORMKARTEN_ECHT_DISCIPLINE_IDS`, heute time-trial und spurt). In den uebrigen arena-aufgeloesten
 *    Disziplinen zieht der Motor eine Ersatzkarte; die gespielte Karte zaehlt dort nicht — die
 *    Vorschau darf dann keine Punkte versprechen.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { nutztEchteFormkarten } from "@/lib/battle/formkarten-echt-disziplinen";
import {
  buildFormkartenPlayers,
  calculateFormModifierForSide,
  getFormCardColorForDisciplineCategory,
  getPlayerClassColor,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import {
  isFormkartenFarbregelEnabled,
  kartenZerlegungFuerSpieler,
  resolveFormkartenFarbregel,
  type FormkartenFarbregel,
  type FormkartenZerlegung,
} from "@/lib/lineups/formkarten-farbregel";
import type { LegacyFormCardOption, LegacyRosterPlayerRef } from "@/lib/lineups/legacy-lineup-types";
import { farbregelAusRegeln, type FormMoralRegeln } from "@/lib/morale/form-moral-regeln";
import { isBattleModeSave } from "@/lib/season/game-mode";

/** Hoechstausschlag des deterministischen Tagesform-Zufalls je Spieler (`distributePerPlayerFormShares`, jitterMax 4). */
export const FORM_TAGESFORM_SPANNE = 4;

export type FormkartenBuchung = { gebucht: boolean; grund: string | null };

export function formkartenBuchung(gameState: GameState | null | undefined, disciplineId: string | null | undefined): FormkartenBuchung {
  if (!gameState || !disciplineId) return { gebucht: true, grund: null };
  if (isBattleModeSave(gameState) && ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId) && !nutztEchteFormkarten(disciplineId)) {
    return {
      gebucht: false,
      grund: "In dieser Arena-Disziplin zählt die gespielte Karte noch nicht — der Motor nimmt eine Ersatzkarte. Die Punkte hier sind kein Versprechen.",
    };
  }
  return { gebucht: true, grund: null };
}

export type KartenWirkung = {
  regelNeu: boolean;
  karten: Array<{ id: string; wert: number; farbe: string; passt: boolean; spielerName: string }>;
  /** "Alle Karten im Vergleich": jede freie/gewaehlte Karte, was sie in DIESER Disziplin fuer diese Aufstellung braechte (Schaetzung je Karte allein). */
  vergleich: Array<{ id: string; wert: number; farbe: string; passt: boolean; spielerName: string; alle: number; traegerZusatz: number; teamSumme: number; gewaehlt: boolean }>;
  spieler: Array<{ playerId: string; zerlegung: FormkartenZerlegung; vorzeichenOffen: boolean }>;
  /** Tagesform-Zufall, der bei der Wertung je Spieler dazukommt (+-, `seededFormJitter`); die Anzeige zeigt den flachen Kartenwert. */
  tagesformSpanne: number;
  teamSumme: number;
  alleAnteil: number;
  traegerAnzahl: number;
  buchung: FormkartenBuchung;
};

export function berechneKartenWirkung(input: {
  gameState?: GameState | null;
  side: "d1" | "d2";
  disciplineId: string | null;
  disciplineCategory: string | null | undefined;
  formCards: LegacyFormCardOption[];
  primaryCardId: string | null;
  secondaryCardId: string | null;
  playerIds: string[];
  rosterPlayers?: LegacyRosterPlayerRef[] | null;
  /** Regelstand aus dem Lineup-Kontext (Review-Befund 3). */
  regeln?: FormMoralRegeln | null;
}): KartenWirkung {
  const farbe = getFormCardColorForDisciplineCategory(input.disciplineCategory);
  const modifiers = normalizeLineupDraftModifiers({
    [input.side]: { primaryFormCardId: input.primaryCardId, secondaryFormCardId: input.secondaryCardId },
  } as never);
  const ergebnis = calculateFormModifierForSide({
    modifiers,
    disciplineSide: input.side,
    disciplineColor: farbe,
    playerCount: input.playerIds.length,
    formCards: input.formCards,
    players: buildFormkartenPlayers({ playerIds: input.playerIds, rosterPlayers: input.rosterPlayers, gameState: input.gameState, formMoral: input.regeln?.formMoral }),
    farbregel: farbregelAusRegeln(input.regeln),
  });
  const gewaehlt = [input.primaryCardId, input.secondaryCardId]
    .map((id) => (id ? input.formCards.find((c) => c.id === id && !c.isUsed) ?? null : null))
    .filter((c): c is LegacyFormCardOption => c != null);
  const spielerKlassen = buildFormkartenPlayers({ playerIds: input.playerIds, rosterPlayers: input.rosterPlayers, gameState: input.gameState, formMoral: input.regeln?.formMoral }).map((p) =>
    p.className ? getPlayerClassColor({ className: p.className } as never) : null,
  );
  const spieler = Object.entries(ergebnis.formByPlayerId ?? {}).map(([playerId, zerlegung]) => ({
    playerId,
    zerlegung,
    // Die Wertung addiert +-4 Tagesform: bei |Kartenwert| < 4 kann das Vorzeichen kippen.
    vorzeichenOffen: Math.abs(zerlegung.summe) < FORM_TAGESFORM_SPANNE,
  }));
  return {
    regelNeu: ergebnis.formByPlayerId != null,
    tagesformSpanne: FORM_TAGESFORM_SPANNE,
    karten: gewaehlt.map((c) => ({ id: c.id, wert: c.value, farbe: c.color, passt: farbe != null && c.color === farbe, spielerName: c.playerName })),
    vergleich: input.formCards
      .filter((c) => !c.isUsed || gewaehlt.some((g) => g.id === c.id))
      .map((c) => {
        const e = kartenEffekt(c, farbe, input.regeln);
        const traeger = spielerKlassen.filter((k) => k === c.color).length;
        return {
          id: c.id,
          wert: c.value,
          farbe: c.color,
          passt: e.passt,
          spielerName: c.playerName,
          alle: e.alle,
          traegerZusatz: e.traegerZusatz,
          teamSumme: Number((e.alle * input.playerIds.length + e.traegerZusatz * traeger).toFixed(1)),
          gewaehlt: gewaehlt.some((g) => g.id === c.id),
        };
      })
      .sort((a, b) => b.teamSumme - a.teamSumme),
    spieler,
    teamSumme: ergebnis.formModifier,
    alleAnteil: spieler.length ? Math.min(...spieler.map((s) => s.zerlegung.alle)) : 0,
    traegerAnzahl: spieler.filter((s) => s.zerlegung.istTraeger).length,
    buchung: formkartenBuchung(input.gameState, input.disciplineId),
  };
}

/**
 * Welche Wertung diese Disziplin bucht: Battle-Modus + arena-aufgeloest = `arena` (Form + Moral skalieren die
 * Arena-Eignung), sonst `legacy` (Legacy-Wertung, Moral +8 %/-10 %). Bestimmt die Moral-Skala der Anzeige.
 */
export function wertungsPfad(gameState: GameState | null | undefined, disciplineId: string | null | undefined): "legacy" | "arena" {
  return gameState && disciplineId && isBattleModeSave(gameState) && ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId) ? "arena" : "legacy";
}

/** Die gueltige Farbregel (`null` = alte "x2 fuer alle"): Lineup-Kontext schlaegt Umgebung. */
export function geltendeFarbregel(regeln?: FormMoralRegeln | null): FormkartenFarbregel | null {
  const aus = farbregelAusRegeln(regeln);
  if (aus !== undefined) return aus;
  return isFormkartenFarbregelEnabled() ? resolveFormkartenFarbregel() : null;
}

/**
 * Wirkung einer Karte fuer Dropdown, Formboard und Plan-Summe (Review-Befund 2): neue Regel = "alle" und
 * "Farbtraeger zusaetzlich" aus `kartenZerlegungFuerSpieler`, alte Regel = x2 bei Farbgleichheit fuer alle.
 */
export function kartenEffekt(
  card: { value: number; color: string } | null,
  disziplinFarbe: string | null | undefined,
  regeln?: FormMoralRegeln | null,
): { alle: number; traegerZusatz: number; passt: boolean; regelNeu: boolean } {
  if (!card) return { alle: 0, traegerZusatz: 0, passt: false, regelNeu: geltendeFarbregel(regeln) != null };
  const regel = geltendeFarbregel(regeln);
  const passt = Boolean(disziplinFarbe) && card.color === disziplinFarbe;
  if (!regel) return { alle: card.value * (passt ? 2 : 1), traegerZusatz: 0, passt, regelNeu: false };
  const k = { wert: card.value, farbe: card.color };
  const alle = kartenZerlegungFuerSpieler({ karte: k, disziplinFarbe, spielerFarbe: null, regel }).summe;
  const mitFarbe = kartenZerlegungFuerSpieler({ karte: k, disziplinFarbe, spielerFarbe: card.color, regel }).summe;
  return { alle, traegerZusatz: Number((mitFarbe - alle).toFixed(2)), passt, regelNeu: true };
}

/** Kurztext fuer Label/Tooltip: " · x2" nur bei der alten Regel, sonst "passt: +8 alle, +4 Farbe". */
export function kartenEffektText(
  card: { value: number; color: string } | null,
  disziplinFarbe: string | null | undefined,
  regeln?: FormMoralRegeln | null,
): string {
  const e = kartenEffekt(card, disziplinFarbe, regeln);
  const vz = (x: number) => `${x > 0 ? "+" : ""}${Number(x.toFixed(1))}`;
  if (!e.regelNeu) return e.passt ? " · x2" : "";
  return ` · ${e.passt ? "passt" : "fremd"}: ${vz(e.alle)} alle, ${vz(e.traegerZusatz)} Farbe`;
}
