/**
 * FORMKARTEN-WIRKUNG FUER DIE ANZEIGE (18.11.) — "gezeigt = gebucht".
 *
 * Die Zahlen kommen aus `calculateFormModifierForSide` (dieselbe Funktion wie Wertung, Arena-
 * Aufstellungsadapter und KI), nur mit einer Kartenauswahl, die der Aufrufer vorgibt. Zusaetzlich sagt
 * `formkartenBuchung`, ob die Punkte in dieser Disziplin ueberhaupt gebucht werden:
 *
 *  - Manager-Modus (Legacy-Wertung): ueberall.
 *  - Battle-Modus, Disziplin aus dem Motor gebucht (arena-aufgeloest oder Vierer-Pod Battlefield/Mini-DM):
 *    nur wenn der Motor die echte Karte liest (`FORMKARTEN_ECHT_DISCIPLINE_IDS`, seit 18.11. jede
 *    motor-gebuchte Disziplin). Fehlt eine dort, zieht der Motor eine Ersatzkarte; die gespielte Karte
 *    zaehlt dann nicht — die Vorschau darf keine Punkte versprechen. Der Waechter-Test
 *    `tests/formkarten-alle-disziplinen.test.ts` haelt fest, dass keine motor-gebuchte Disziplin fehlt.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  ARENA_RESOLVED_DISCIPLINE_IDS,
  BATTLEFIELD_POD_VORLAUF_AKTIV,
  MINI_DM_FFA_VORLAUF_AKTIV,
} from "@/lib/battle/arena-resolved-disciplines";
import { nutztEchteFormkarten } from "@/lib/battle/formkarten-echt-disziplinen";
import {
  buildFormkartenPlayers,
  calculateFormModifierForSide,
  getClassNamesForFormCardColor,
  getFormCardColorForDisciplineCategory,
  getPlayerClassColor,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import {
  isFormkartenFarbregelEnabled,
  kartenZerlegungFuerSpieler,
  resolveFormkartenFarbregel,
  GEGENFARBE,
  type FormkartenFarbregel,
  type FormkartenZerlegung,
} from "@/lib/lineups/formkarten-farbregel";
import type { LegacyFormCardOption, LegacyRosterPlayerRef } from "@/lib/lineups/legacy-lineup-types";
import { farbregelAusRegeln, type FormMoralRegeln } from "@/lib/morale/form-moral-regeln";
import { isBattleModeSave } from "@/lib/season/game-mode";

/** Hoechstausschlag des deterministischen Tagesform-Zufalls je Spieler (`distributePerPlayerFormShares`, jitterMax 4). */
export const FORM_TAGESFORM_SPANNE = 4;

export type FormkartenBuchung = { gebucht: boolean; grund: string | null };

/**
 * Wird das Ergebnis dieser Disziplin im Battle-Modus aus dem Motor gebucht? Die Duelle aus
 * `ARENA_RESOLVED_DISCIPLINE_IDS` und die beiden Vierer-Pods mit eigenem Vorlauf (Battlefield, Mini-DM-FFA),
 * die nie in jener Menge stehen. Alles andere bucht die Legacy-/PPS-Wertung, in der die Karte ohnehin zaehlt.
 */
export function wirdAusMotorGebucht(disciplineId: string): boolean {
  if (ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)) return true;
  if (disciplineId === "battlefield") return BATTLEFIELD_POD_VORLAUF_AKTIV;
  if (disciplineId === "mini-dm") return MINI_DM_FFA_VORLAUF_AKTIV;
  return false;
}

export function formkartenBuchung(gameState: GameState | null | undefined, disciplineId: string | null | undefined): FormkartenBuchung {
  if (!gameState || !disciplineId) return { gebucht: true, grund: null };
  if (isBattleModeSave(gameState) && wirdAusMotorGebucht(disciplineId) && !nutztEchteFormkarten(disciplineId)) {
    return {
      gebucht: false,
      grund: "In dieser Arena-Disziplin zählt die gespielte Karte noch nicht — der Motor nimmt eine Ersatzkarte. Die Punkte hier sind kein Versprechen.",
    };
  }
  return { gebucht: true, grund: null };
}

/** Kurzname der Kartenfarbe, wie Dropdown und Disziplin-Kategorie ihn zeigen (POW/SPE/MEN/SOC). */
export const FARB_KURZ: Record<string, string> = { red: "POW", green: "SPE", blue: "MEN", yellow: "SOC" };
const farbKurz = (farbe: string | null | undefined) => (farbe ? FARB_KURZ[farbe] ?? farbe : "ohne Farbe");

/**
 * WER BEKOMMT DEN FARBBONUS, UND WARUM (Chris 18.11.: "Ich würde vermuten Wildfire ist blau? Dann müsste sie
 * doch +4 und +4 bekommen?"). Der Farbanteil haengt NICHT an der Disziplinfarbe und nicht an der Rolle auf dem
 * Feld, sondern an der KLASSE des Spielers: Klassenfarbe = Kartenfarbe (`kartenZerlegungFuerSpieler`,
 * `istTraeger`). Die Disziplinfarbe entscheidet nur den "alle"-Anteil (passt: voller Wert, fremd: halber).
 * Dieser Text sagt es je Spieler in Klartext; die Zahl selbst kommt weiter aus `calculateFormModifierForSide`.
 */
export function farbGrundText(input: {
  klasse: string | null;
  klassenFarbe: string | null;
  kartenFarben: Array<string | null>;
  traeger: number;
}): string {
  const karten = [...new Set(input.kartenFarben.filter((f): f is string => Boolean(f)))];
  if (karten.length === 0) return "keine Karte gelegt";
  const vz = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Number(Math.abs(x).toFixed(1)).toLocaleString("de-DE")}`;
  const kartenText = karten.map(farbKurz).join("/");
  if (input.klassenFarbe && karten.includes(input.klassenFarbe)) {
    return `Farbbonus ${vz(input.traeger)}: ${input.klasse ?? "Klasse"} ist ${farbKurz(input.klassenFarbe)} wie die Karte`;
  }
  if (!input.klasse) return `kein Farbbonus: Klasse unbekannt, Karte ${kartenText}`;
  if (!input.klassenFarbe) return `kein Farbbonus: ${input.klasse} hat keine Kartenfarbe, Karte ${kartenText}`;
  return `kein Farbbonus: ${input.klasse} ist ${farbKurz(input.klassenFarbe)}, Karte ${kartenText}`;
}

export type KartenWirkung = {
  regelNeu: boolean;
  karten: Array<{ id: string; wert: number; farbe: string; passt: boolean; spielerName: string }>;
  /** "Alle Karten im Vergleich": jede freie/gewaehlte Karte, was sie in DIESER Disziplin fuer diese Aufstellung braechte (Schaetzung je Karte allein). */
  vergleich: Array<{ id: string; wert: number; farbe: string; passt: boolean; spielerName: string; alle: number; traegerZusatz: number; teamSumme: number; gewaehlt: boolean }>;
  spieler: Array<{
    playerId: string;
    zerlegung: FormkartenZerlegung;
    vorzeichenOffen: boolean;
    /** Klasse und deren Kartenfarbe (red/green/blue/yellow) — daran haengt der Farbbonus, nicht an Rolle oder Disziplin. */
    klasse: string | null;
    klassenFarbe: string | null;
    /** Klartext je Spieler: warum (k)ein Farbbonus, z. B. "kein Farbbonus: Tactician ist SOC, Karte MEN". */
    farbGrund: string;
  }>;
  /**
   * Ein Satz fuer die Team-Summe: wer den Farbbonus der gelegten Karte(n) bekommen KANN, und ob einer davon
   * aufgestellt ist, z. B. "Farbbonus MEN nur für Mage, Overseer, Templar — keiner aufgestellt". `null` ohne Karte
   * oder bei der alten Regel.
   */
  farbHinweis: string | null;
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
  const formkartenSpieler = buildFormkartenPlayers({ playerIds: input.playerIds, rosterPlayers: input.rosterPlayers, gameState: input.gameState, formMoral: input.regeln?.formMoral });
  const spielerKlassen = formkartenSpieler.map((p) => (p.className ? getPlayerClassColor({ className: p.className } as never) : null));
  const klasseVon = new Map(formkartenSpieler.map((p, i) => [p.playerId, { klasse: p.className, farbe: spielerKlassen[i] }]));
  const kartenFarben = gewaehlt.map((c) => c.color as string | null);
  const spieler = Object.entries(ergebnis.formByPlayerId ?? {}).map(([playerId, zerlegung]) => {
    const k = klasseVon.get(playerId) ?? { klasse: null, farbe: null };
    return {
      playerId,
      zerlegung,
      // Die Wertung addiert +-4 Tagesform: bei |Kartenwert| < 4 kann das Vorzeichen kippen.
      vorzeichenOffen: Math.abs(zerlegung.summe) < FORM_TAGESFORM_SPANNE,
      klasse: k.klasse,
      klassenFarbe: k.farbe,
      farbGrund:
        zerlegung.gegen != null && zerlegung.gegen !== 0
          ? `Gegenfarbe ${zerlegung.gegen > 0 ? "+" : "−"}${Number(Math.abs(zerlegung.gegen).toFixed(1)).toLocaleString("de-DE")}: ${k.klasse ?? "Klasse"} ist ${farbKurz(k.farbe)}, Karte ${kartenFarben.filter(Boolean).map(farbKurz).join("/")}`
          : farbGrundText({ klasse: k.klasse, klassenFarbe: k.farbe, kartenFarben, traeger: zerlegung.traeger + zerlegung.form }),
    };
  });
  const kartenFarbenEindeutig = [...new Set(kartenFarben.filter((f): f is string => Boolean(f)))];
  const farbHinweis =
    ergebnis.formByPlayerId == null || kartenFarbenEindeutig.length === 0
      ? null
      : kartenFarbenEindeutig
          .map((f) => {
            const anzahl = spieler.filter((s) => s.klassenFarbe === f).length;
            const klassen = getClassNamesForFormCardColor(f).join(", ");
            const gegenFarbe = GEGENFARBE[f];
            const gegenAnzahl = geltendeFarbregel(input.regeln)?.gegen ? spieler.filter((s) => s.klassenFarbe === gegenFarbe).length : 0;
            const gegenText = gegenAnzahl > 0 ? ` · Abzug für ${gegenAnzahl} ${farbKurz(gegenFarbe)}-Spieler (Gegenfarbe)` : "";
            return `Farbbonus ${farbKurz(f)} nur für ${klassen} — ${anzahl === 0 ? "keiner aufgestellt" : `${anzahl} aufgestellt`}${gegenText}`;
          })
          .join(" · ");
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
    farbHinweis,
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
): { alle: number; traegerZusatz: number; passt: boolean; regelNeu: boolean; gegenZusatz?: number } {
  return kartenEffektMitRegel(card, disziplinFarbe, geltendeFarbregel(regeln));
}

/** Wie `kartenEffekt`, mit schon aufgeloester Regel (`null` = alte "x2 fuer alle"), z. B. aus dem KI-Saisonplan. */
export function kartenEffektMitRegel(
  card: { value: number; color: string } | null,
  disziplinFarbe: string | null | undefined,
  regel: FormkartenFarbregel | null,
): { alle: number; traegerZusatz: number; passt: boolean; regelNeu: boolean; gegenZusatz?: number } {
  if (!card) return { alle: 0, traegerZusatz: 0, passt: false, regelNeu: regel != null };
  const passt = Boolean(disziplinFarbe) && card.color === disziplinFarbe;
  if (!regel) return { alle: card.value * (passt ? 2 : 1), traegerZusatz: 0, passt, regelNeu: false };
  const k = { wert: card.value, farbe: card.color };
  const alle = kartenZerlegungFuerSpieler({ karte: k, disziplinFarbe, spielerFarbe: null, regel }).summe;
  const mitFarbe = kartenZerlegungFuerSpieler({ karte: k, disziplinFarbe, spielerFarbe: card.color, regel }).summe;
  // Plus/Minus (22.11.): Spieler der Gegenfarbe tragen den spiegelbildlichen Anteil (Pluskarte kostet sie etwas).
  const gegenZusatz = regel.gegen && GEGENFARBE[card.color]
    ? Number((kartenZerlegungFuerSpieler({ karte: k, disziplinFarbe, spielerFarbe: GEGENFARBE[card.color], regel }).summe - alle).toFixed(2))
    : 0;
  return gegenZusatz !== 0
    ? { alle, traegerZusatz: Number((mitFarbe - alle).toFixed(2)), passt, regelNeu: true, gegenZusatz }
    : { alle, traegerZusatz: Number((mitFarbe - alle).toFixed(2)), passt, regelNeu: true };
}

/**
 * Kurztext fuer Label/Tooltip: " · x2" nur bei der alten Regel, sonst z. B. " · fremd: +4 alle, +4 extra für MEN-Spieler".
 * Der zweite Teil nennt die Kartenfarbe ausdruecklich: den Zusatz bekommen nur Spieler, deren KLASSE diese Farbe hat
 * (vorher stand dort nur "+4 Farbe", was wie "Disziplinfarbe" oder "fuer alle" gelesen wurde).
 */
export function kartenEffektText(
  card: { value: number; color: string } | null,
  disziplinFarbe: string | null | undefined,
  regeln?: FormMoralRegeln | null,
): string {
  const e = kartenEffekt(card, disziplinFarbe, regeln);
  const vz = (x: number) => `${x > 0 ? "+" : ""}${Number(x.toFixed(1))}`;
  if (!e.regelNeu) return e.passt ? " · x2" : "";
  const gegen = e.gegenZusatz ? `, ${vz(e.gegenZusatz)} für ${farbKurz(GEGENFARBE[card?.color ?? ""])}-Spieler` : "";
  return ` · ${e.passt ? "passt" : "fremd"}: ${vz(e.alle)} alle, ${vz(e.traegerZusatz)} extra für ${farbKurz(card?.color)}-Spieler${gegen}`;
}
