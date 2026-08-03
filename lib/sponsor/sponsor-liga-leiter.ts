/**
 * SPONSOR-LIGALEITER — der Sockel nach Startrang plus der Wertungstopf nach Endrang.
 *
 * Bis hierher kam die Sponsorauszahlung aus `sponsorV3BenchmarkLadder()` — also woertlich aus der
 * PREISGELDKURVE der Saison. Zwei Systeme (Sponsoren, Preisgeld) haben damit auf denselben Topf
 * gezogen, und die 11 Kurvenformen in `sponsor-curve-shapes.ts` waren nur noch ein Anzeige-Etikett
 * (`curveShape` stand am Vertrag, aber nichts las es fuer die Abrechnung).
 *
 * DIESE DATEI ERSETZT DAS: eine EIGENE, kleinere Leiter, aus zwei Teilen:
 *   - dem SOCKEL, fix nach dem STARTRANG des Teams (nicht dem Endrang!) — er steht damit fest,
 *     BEVOR die Saison beginnt und bevor Gehaelter zugesagt werden. Ein Sockel nach Endrang waere
 *     keine Absicherung, sondern eine Ueberraschung: das Team wuesste beim Kaderplanen gar nicht,
 *     was es hat.
 *   - dem WERTUNGSTOPF, verteilt nach dem ENDRANG — das ist der Teil, der Leistung honoriert.
 *
 * Die 11 Kurvenformen bestimmen NUR NOCH, WO auf dieser Leiter das Geld liegt (Ankernormierung,
 * siehe `sponsorKurvenLeiter`), nicht mehr WIE VIEL es insgesamt ist — jede Form liefert bei
 * Unterschrift denselben Erwartungswert `A`. Damit ist die Kartenwahl wieder eine PASSUNGSFRAGE
 * (welche Form passt zur eigenen Ambition?) statt einer Staerkefrage (welche Form zahlt am meisten?).
 *
 * Reine Arithmetik: kein `GameState`-Zugriff ausser dem uebergebenen `salaryFactor`, keine
 * Zufallsquelle, keine IO. Einzeln testbar, siehe tests/sponsor-liga-leiter.test.ts.
 */
import type { SponsorCurveShape } from "@/lib/data/olyDataTypes";
import { SPONSOR_CURVE_SHAPES } from "@/lib/sponsor/sponsor-curve-shapes";
import { sponsorV3AnchorWeights } from "@/lib/sponsor/sponsor-v3-model";

/** Ligagroesse, ueber die die Leiter laeuft — dieselbe 32er-Tabelle wie im V3-Modell. */
const SPONSOR_LIGA_RANKS = 32;

/** Sockel fuer Startrang 1 (Titelverteidiger) — er muss sich alles erspielen. */
export const SPONSOR_SOCKEL_MIN = 18;
/** Sockel fuer Startrang 32 (Schlusslicht) — die Absicherung nach unten. */
export const SPONSOR_SOCKEL_MAX = 48;
/** Wertungstopf der Liga bei Salary Factor 1,0. */
export const SPONSOR_WERTUNGSTOPF = 1030;
/**
 * Kruemmung der Rangverteilung des Wertungstopfs. > 1 heisst: die Spitze bekommt ueberproportional
 * mehr als eine lineare Verteilung, das Mittelfeld entsprechend weniger — passend zu einer Liga, in
 * der der Titel das seltene, teure Ereignis ist und Plaetze 15 bis 20 kaum jemanden ueberraschen.
 */
export const SPONSOR_WERTUNG_KURVE = 1.35;
/**
 * Absolute Untergrenze der Auszahlung, UNABHAENGIG von allem — auch vom Sockel. Der neue Sockel
 * reicht bei Startrang 1 bis hinunter auf 18, deutlich unter dem alten `SPONSOR_V3_FLOOR_C` (32):
 * ein Titelfavorit, der auf Rang 32 abstuerzt, braeuchte sonst kein Netz mehr. `SPONSOR_BODEN`
 * greift ausschliesslich ueber den bestehenden Mechanismus in `sponsorV3LadderValue` (Vertrags-Feld
 * `floor`) — er steht NICHT in den Formeln unten, damit die Ankerarithmetik von `sponsorKurvenLeiter`
 * linear und exakt bleibt (ein Clamp in der Leiter selbst wuerde die Ankernormierung verfaelschen).
 */
export const SPONSOR_BODEN = 43;

const clampRank = (rank: number): number =>
  Math.max(1, Math.min(SPONSOR_LIGA_RANKS, Math.round(Number.isFinite(rank) ? rank : SPONSOR_LIGA_RANKS)));

/**
 * Der Sockel eines Teams — linear ueber den STARTRANG, NICHT den Salary Factor. Das ist Absicht: der
 * Sockel ist die planbare Absicherung, gegen die ein Team seine Gehaelter zusagt, bevor die Saison
 * anfaengt. Haenge er am Salary Factor, wuesste ein Team seinen Sockel erst, wenn die Konjunktur der
 * Saison schon feststeht — zu spaet fuer die Kaderplanung.
 */
export function sponsorSockelFuerStartrang(startRank: number): number {
  const rank = clampRank(startRank);
  return SPONSOR_SOCKEL_MIN + ((SPONSOR_SOCKEL_MAX - SPONSOR_SOCKEL_MIN) * (rank - 1)) / (SPONSOR_LIGA_RANKS - 1);
}

/**
 * Die Rang-Gewichte des Wertungstopfs, EINMAL berechnet (Modul-Konstante): Rang 1 bekommt das volle
 * Gewicht 1, Rang 32 exakt 0 — der Letzte der Liga bekommt aus dem Wertungstopf nichts, nur seinen
 * Sockel. Dazwischen faellt das Gewicht mit `SPONSOR_WERTUNG_KURVE`.
 */
const WERTUNGS_GEWICHTE: readonly number[] = Array.from({ length: SPONSOR_LIGA_RANKS }, (_, index) => {
  const rank = index + 1;
  return ((SPONSOR_LIGA_RANKS - rank) / (SPONSOR_LIGA_RANKS - 1)) ** SPONSOR_WERTUNG_KURVE;
});
const WERTUNGS_GEWICHTE_SUMME = WERTUNGS_GEWICHTE.reduce((sum, value) => sum + value, 0);

export function sponsorWertungsGewichte(): readonly number[] {
  return WERTUNGS_GEWICHTE;
}

/**
 * Die NEUTRALE Ligaleiter: 32 Sprossen, Sockel (konstant ueber den Endrang, haengt nur am Startrang)
 * plus der anteilige Wertungstopf (haengt nur am Endrang). OHNE Boden — der wird erst spaeter, ueber
 * das eingefrorene `terms.floor`, angewandt (siehe `sponsor-v3-model.ts`), damit diese Funktion pure,
 * ungeklammerte Arithmetik bleibt und der Anker in `sponsorKurvenLeiter` exakt trifft.
 */
export function sponsorLigaLeiter(input: { startRank: number; salaryFactor: number }): number[] {
  const sockel = sponsorSockelFuerStartrang(input.startRank);
  const topf = SPONSOR_WERTUNGSTOPF * input.salaryFactor;
  return WERTUNGS_GEWICHTE.map((gewicht) => sockel + (topf * gewicht) / WERTUNGS_GEWICHTE_SUMME);
}

/**
 * Die GESHAPETE Ligaleiter — dort, wo die 11 Kurvenformen wieder etwas bedeuten.
 *
 * Ankernormierung, exakt und ohne Naeherung: die 11 `reference`-Arrays in `sponsor-curve-shapes.ts`
 * sind auf gleiche FLAECHE normiert (jede zahlt denselben Gesamt-Etat), nicht auf gleichen
 * ERWARTUNGSWERT fuer ein bestimmtes Team. Ohne Renormierung waere derselbe `titeljaeger` fuer ein
 * Spitzenteam (das seinen Titel-Peak oft trifft) mehr wert als fuer ein Kellerteam — die Kartenwahl
 * waere wieder eine Staerkefrage statt einer Passungsfrage, genau der Fehler, den dieser Umbau beheben
 * soll. Die Rechnung:
 *
 *   sockel     = sponsorSockelFuerStartrang(startRank)
 *   neutral    = sponsorLigaLeiter({ startRank, salaryFactor })
 *   gewichte   = sponsorV3AnchorWeights(startRank)          // Endrang-Erwartung dieses Teams
 *   A          = Σ gewichte[i] * neutral[i]                  // der Anspruch DIESES Teams
 *   ref        = SPONSOR_CURVE_SHAPES[shape].reference
 *   refAnker   = Σ gewichte[i] * ref[i]
 *   c          = (A − sockel) / refAnker
 *   leiter[i]  = sockel + c * ref[i]
 *
 * Weil `sockel` ueber alle Raenge konstant ist, gilt `Σ gewichte·leiter = sockel + c·refAnker = A` —
 * EXAKT, fuer jede der 11 Formen. Gleiche Erwartung, andere Verteilung: der Sockel selbst wird nie
 * geshaped (er ist die Absicherung, keine Wahl), nur der Wertungsanteil obendrauf.
 */
export function sponsorKurvenLeiter(input: {
  shape: SponsorCurveShape;
  startRank: number;
  salaryFactor: number;
}): number[] {
  const sockel = sponsorSockelFuerStartrang(input.startRank);
  const neutral = sponsorLigaLeiter({ startRank: input.startRank, salaryFactor: input.salaryFactor });
  const gewichte = sponsorV3AnchorWeights(input.startRank);
  const anspruch = neutral.reduce((sum, value, index) => sum + value * (gewichte[index] ?? 0), 0);
  const referenz = SPONSOR_CURVE_SHAPES[input.shape].reference;
  const referenzAnker = referenz.reduce((sum, value, index) => sum + value * (gewichte[index] ?? 0), 0);
  // Guardrail, kann bei den heutigen Referenzwerten (alle > 30) nicht vorkommen: ohne einen
  // positiven Nenner waere `c` nicht definiert — dann lieber die neutrale Leiter als eine
  // Kurvenform, die rechnerisch zusammenbricht.
  if (!(referenzAnker > 0)) return neutral;
  // Guardrail: `c` nie negativ. Der Anspruch `A` ist immer >= Sockel (er ist der gewichtete
  // Mittelwert einer Leiter, die nirgends unter den Sockel faellt) — der Clamp greift also in der
  // Praxis nie, schuetzt aber davor, dass eine kuenftige Aenderung der Gewichte still eine
  // gespiegelte (invertierte) Kurve erzeugt.
  const c = Math.max(0, (anspruch - sockel) / referenzAnker);
  return referenz.map((value) => sockel + c * value);
}
