/**
 * ERGEBNISSKALA E1 (18.11., docs/design/ergebnisskala-18-11.md): EIN vergleichbares Team-Ergebnis je
 * Disziplin und Begegnung, 0..10 je Seite.
 *
 * Chris 18.11., woertlich: "denk dran, das muss auch fuer die Ergebnisse der Diszis passieren.
 * Top-Ergebnis ist quasi ein 10-0, wo der Gegner plattgemacht wurde, kann aber auch 2-3 oder so sein,
 * wenn beide Teams schwach performen. [...] Damit das Punkteverhaeltnis, das die Teams holen,
 * vergleichbar ist und nicht durch eine Diszi kaputtgerissen wird."
 *
 * BEFUND (Dokument Abschnitt 1): die Skala vom 19.10. ("Niveau + Marge") hatte die richtige Form, aber
 * Anker, die nicht zum heutigen Motor passen. Fuer acht Arena-Disziplinen fehlte die Marge-Referenz
 * (jeder Sieg = 5), Breaking/Tennis hatten M90 = 1 (jeder Sieg = 10), das Niveau kam bei
 * Arena-Disziplinen aus dem PPS-Team-Score (Aufstellungsstaerke, nicht Leistung).
 *
 * E1 behaelt die Form und legt beide Groessen auf gemessene Anker je Disziplin und Feldgroesse
 * (`data/generated/ergebnis-skala-kalibrierung.json`, gezogen mit scripts/werte-ergebnisskala-aus.ts):
 *
 *   MARGE -> ABSTAND D (0..10). m = nativer Abstand im Motor (Punkte, Treffer, kg, Ueberlebende, ...).
 *       u = Lage von m in der gemessenen Verteilung der Siegmargen dieser Disziplin (0..1; bei
 *       ganzzahligen Margen die Mitte der Stufe), dann eine fuer ALLE Disziplinen gleiche Kurve:
 *         u = 0 -> 1,  u = 0,5 (Median-Sieg) -> 3,  u >= 0,975 (Kantersieg, oberste 2,5 %) -> 10,
 *       dazwischen linear, gerundet. Remis: D = 0. Damit hat jede Disziplin dieselbe Verteilung von D,
 *       egal ob ihr Motor 87:79, 3:0 oder 412 kg zu 398 kg liefert.
 *       Disziplinen, deren Motor im Duell keine Marge liefert (Zeitfahren 1:0, Klettern/Staffel als
 *       Platzpunkte mit nur zwei, drei Stufen), nehmen statt der Marge den Leistungsabstand der Seiten
 *       (mittlere Spieler-PP Sieger minus Verlierer, `margeQuelle: "leistung"`), ebenfalls aus dem Motor.
 *   LEISTUNG -> NIVEAU mu (0,05..0,95). L = mittlere Spieler-PP der Seite (PP-Skala C2, also schon ueber
 *       alle Disziplinen gleich geeicht). F = stueckweise lineare Verteilungsfunktion durch die
 *       gemessenen Anker p5/p50/p95 von L; mu = (F(L_eigen) + F(L_gegner)) / 2.
 *   ERGEBNIS: c = 10 * mu;  V = round(clamp(c - D/2, 0, 10 - D));  W = V + D;  Remis: W = V = round(c).
 *       Kantersieg zweier mittlerer Teams 10:0, Median-Sieg 7:4, knapper Sieg zweier schwacher Teams 3:2.
 *
 * GARANTIEN (by construction, unabhaengig von den Ankern):
 *   - Wer im Motor gewinnt, gewinnt auf der Skala (W - V = D >= 1), ein Remis bleibt ein Remis (D = 0).
 *   - Monoton: groessere Marge -> groesserer Abstand (bei gleichem Niveau).
 *   - Jede Seite liegt in 0..10; |Punkteverhaeltnis je Begegnung| <= 10, also kann keine Disziplin das
 *     Saison-Verhaeltnis dominieren, und weil die Anker je Disziplin aus derselben Messung stammen, hat
 *     jede Disziplin dieselbe Verteilung von D (Median 3, Kantersieg 10 fuer die obersten rund 2,5 bis 4 % der Siege).
 *
 * VIERERGRUPPEN / FFA (Mini-DM, Battlefield, Takeshi's Castle, Staffel, Bahn-Pods): Regel "Leiter":
 *   - Spanne T (Platz 1 bis Platz 4) aus der Lage der rohen Spanne des Pods in ihrer gemessenen
 *     Verteilung (u = 0 -> 3, Median -> 7, oberste 2,5 % -> 10); T wird auf die drei Luecken verteilt (anteilig zum rohen Abstand,
 *     jede Luecke mindestens 1: ein besserer Platz hat IMMER den hoeheren Wert); um das Pod-Niveau
 *     zentriert wie beim Duell.
 *   - Punkteverhaeltnis je Team = eigener Wert minus Mittel der drei Gegner ("drei virtuelle Duelle,
 *     gemittelt"): Platz 1 bei 10/2/1/0 bekommt +9, wie ein 10:1-Duellsieg. Ganzzahlig gerundet, die
 *     Reihenfolge der Plaetze bleibt streng, die Summe je Pod ist 0 (Restfehler s. `podVerhaeltnisse`).
 *
 * Gezeigt = gebucht: die Engine (legacy-matchday-resolve-engine.ts) schreibt `ergebnisNormiert`,
 * `verhaeltnis` und `miniDmPod.wert` mit genau diesen Funktionen; Tabelle, Saisonstand, Startseite,
 * Nach dem Spieltag und die Arena-Zeile lesen die gebuchten Werte. Die Arena zeigt daneben ihre native
 * Zahl ("87:79 -> 7:4"). Der Motor bleibt unberuehrt (Fingerabdruck unveraendert): E1 bildet nur ab.
 *
 * Rein, synchron, ohne node:-Importe (laeuft auch im Browser).
 */
import kalibrierungJson from "@/data/generated/ergebnis-skala-kalibrierung.json";

export const ERGEBNIS_SKALA_MAX = 10;
/** Median-Sieg -> Abstand 3 (bei mittlerem Niveau 7:4). */
export const ERGEBNIS_D_MITTE = 3;
/**
 * Median-Spanne eines Vierer-Pods (Platz 1 bis 4) -> 7. So wiegt ein Pod-Spieltag im Verhaeltnis so viel
 * wie ein Duell-Spieltag (Median |Verh.| um 3 wie beim Median-Sieg; gemessen, Dokument Abschnitt 4).
 */
export const ERGEBNIS_POD_SPANNE_MITTE = 7;
/** Ab dieser Lage in der Margen-Verteilung ist es ein Kantersieg (10). */
export const ERGEBNIS_LAGE_TOP = 0.975;
/** Rueckfall ohne Anker: ein Sieg zaehlt wie der Median-Sieg. */
export const ERGEBNIS_D_RUECKFALL = ERGEBNIS_D_MITTE;
/** Die Lagen, an denen die Kalibrierung die Margen-Verteilung als Knoten ablegt. */
export const ERGEBNIS_LAGEN: readonly number[] = [0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.975];

export type ErgebnisSkalaFormat = "duell" | "pod";
export type MargeQuelle = "marge" | "relativ" | "leistung";

type AnkerRoh = { knoten?: number[]; margeQuelle?: MargeQuelle; lP5?: number; lP50?: number; lP95?: number; n?: number };
type KalibrierungJson = {
  disziplinen?: Record<string, Partial<Record<ErgebnisSkalaFormat, AnkerRoh & { feldgroessen?: Record<string, AnkerRoh> }>>>;
};

export type ErgebnisSkalaAnker = {
  /** Margen (bzw. Pod-Spannen) an den Lagen `ERGEBNIS_LAGEN`, nicht fallend. */
  knoten: readonly number[];
  margeQuelle: MargeQuelle;
  /** Leistungs-Anker p5/p50/p95 der mittleren Spieler-PP einer Seite (`null` = neutrales Niveau 0,5). */
  leistung: readonly [number, number, number] | null;
};

const KALIBRIERUNG = kalibrierungJson as unknown as KalibrierungJson;

function baueAnker(e: AnkerRoh | undefined, erbe?: AnkerRoh): ErgebnisSkalaAnker | null {
  const knoten = e?.knoten;
  if (!knoten || knoten.length !== ERGEBNIS_LAGEN.length || !knoten.every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  for (let i = 1; i < knoten.length; i += 1) if (knoten[i]! < knoten[i - 1]!) return null;
  const quelle = e.margeQuelle ?? erbe?.margeQuelle ?? "marge";
  const l = [e.lP5 ?? erbe?.lP5, e.lP50 ?? erbe?.lP50, e.lP95 ?? erbe?.lP95];
  const leistung =
    l.every((x) => typeof x === "number" && Number.isFinite(x)) && (l[2] as number) > (l[0] as number)
      ? ([l[0], l[1], l[2]] as [number, number, number])
      : null;
  return { knoten, margeQuelle: quelle, leistung };
}

/**
 * Die Anker fuer (Disziplin, Format, Feldgroesse): exakte Feldgroesse, sonst Disziplin-weit
 * (`null` -> Rueckfall-D bzw. neutrales Niveau). Eine Feldgroesse erbt die Margen-Quelle der Disziplin.
 */
export function ergebnisSkalaAnker(
  disciplineId: string,
  format: ErgebnisSkalaFormat,
  playerCount: number | null | undefined,
): ErgebnisSkalaAnker | null {
  const eintrag = KALIBRIERUNG.disziplinen?.[disciplineId]?.[format];
  if (!eintrag) return null;
  if (typeof playerCount === "number" && Number.isFinite(playerCount)) {
    const exakt = baueAnker(eintrag.feldgroessen?.[String(Math.round(playerCount))], eintrag);
    if (exakt) return exakt;
  }
  return baueAnker(eintrag);
}

function clamp(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, wert));
}

/**
 * Lage u (0..1) einer Marge in der gemessenen Verteilung: zwischen zwei Knoten linear; liegt die Marge
 * genau auf einer Stufe, die mehrere Knoten belegt (ganzzahlige Margen), die Mitte dieser Stufe. Unter
 * dem ersten Knoten linear von 0 (Marge 0) bis zur ersten Lage, ueber dem letzten Knoten 1.
 */
export function lageInVerteilung(marge: number, knoten: readonly number[]): number {
  const lagen = ERGEBNIS_LAGEN;
  const n = knoten.length;
  if (!Number.isFinite(marge)) return 0.5;
  const erster = knoten[0]!;
  if (marge < erster) return erster > 0 && marge > 0 ? (lagen[0]! * marge) / erster : 0;
  const letzter = knoten[n - 1]!;
  if (marge > letzter) return 1;
  let von = -1;
  let bis = -1;
  for (let i = 0; i < n; i += 1) {
    if (knoten[i] === marge) {
      if (von < 0) von = i;
      bis = i;
    }
  }
  if (von >= 0) {
    // Genau auf einem Knoten: seine Lage. Auf einer Stufe (mehrere Knoten gleich, ganzzahlige Margen):
    // die Mitte der Lagen, die die Stufe belegt -- bleibt zwischen den Nachbarn, also monoton.
    return (lagen[von]! + lagen[bis]!) / 2;
  }
  for (let i = 1; i < n; i += 1) {
    if (marge < knoten[i]!) {
      const a = knoten[i - 1]!;
      const b = knoten[i]!;
      return lagen[i - 1]! + ((lagen[i]! - lagen[i - 1]!) * (marge - a)) / (b - a);
    }
  }
  return lagen[n - 1]!;
}

/** Die fuer alle Disziplinen gleiche Kurve: Lage u -> Wert (u = 0 -> unten, 0,5 -> mitte, >= 0,975 -> 10). */
function wertAusLage(u: number, unten: number, mitte: number): number {
  if (u <= 0.5) return unten + ((mitte - unten) * Math.max(0, u)) / 0.5;
  return Math.min(ERGEBNIS_SKALA_MAX, mitte + ((ERGEBNIS_SKALA_MAX - mitte) * (u - 0.5)) / (ERGEBNIS_LAGE_TOP - 0.5));
}

/** Abstand D (0..10, ganzzahlig) eines Duells. Ein Sieg ist nie 0, ein Remis immer 0. */
export function abstandAusMarge(input: { remis: boolean; marge: number; anker: ErgebnisSkalaAnker | null }): number {
  if (input.remis) return 0;
  if (!input.anker) return ERGEBNIS_D_RUECKFALL;
  const u = lageInVerteilung(input.marge, input.anker.knoten);
  return clamp(Math.round(wertAusLage(u, 1, ERGEBNIS_D_MITTE)), 1, ERGEBNIS_SKALA_MAX);
}

/** Spanne T (Platz 1 bis n, ganzzahlig, mindestens n - 1) einer Vierergruppe. */
export function spanneAusRohspanne(input: { rohSpanne: number; teams: number; anker: ErgebnisSkalaAnker | null }): number {
  const minimum = Math.max(0, input.teams - 1);
  if (!input.anker) return Math.max(minimum, ERGEBNIS_POD_SPANNE_MITTE);
  const u = lageInVerteilung(input.rohSpanne, input.anker.knoten);
  return clamp(Math.round(wertAusLage(u, Math.max(minimum, 3), ERGEBNIS_POD_SPANNE_MITTE)), minimum, ERGEBNIS_SKALA_MAX);
}

/** F(L): stueckweise linear durch p5 -> 0,05, p50 -> 0,5, p95 -> 0,95, aussen geklemmt. */
export function niveauAusLeistung(leistung: number | null | undefined, anker: ErgebnisSkalaAnker | null): number {
  const w = anker?.leistung;
  if (!w || typeof leistung !== "number" || !Number.isFinite(leistung)) return 0.5;
  if (leistung <= w[0]) return 0.05;
  if (leistung >= w[2]) return 0.95;
  if (leistung <= w[1]) return w[1] > w[0] ? 0.05 + (0.45 * (leistung - w[0])) / (w[1] - w[0]) : 0.5;
  return w[2] > w[1] ? 0.5 + (0.45 * (leistung - w[1])) / (w[2] - w[1]) : 0.5;
}

export type DuellErgebnisE1 = {
  /** [eigenes Ergebnis, gegnerisches Ergebnis], 0..10 ganzzahlig. */
  ergebnis: [number, number];
  /** ±D aus Sicht DIESES Teams (= eigenes - gegnerisches Ergebnis). */
  verhaeltnis: number;
  /** Die verwendete Bezugsgroesse (Marge an der Lage 0,975, ab der es 10 gibt), `null` ohne Anker. */
  bezug: number | null;
};

/**
 * Die Groesse, die die Knoten der Disziplin beschreiben:
 *   "marge"    nativer Abstand |a - b| (Treffer, Runden, kg, ...)
 *   "relativ"  Abstand im Verhaeltnis zur Summe beider Seiten, |a - b| / (a + b): fuer Disziplinen, deren
 *              Seitenstand eine Summe mit stark wechselnder Groessenordnung ist (Wettessen, Showcase,
 *              Eiskunstlauf, I-Spy: je nach Format und Kulisse 100 oder 2.000 Punkte Abstand) -- so
 *              zaehlt "doppelt so viel wie der Gegner" an jedem Spieltag gleich.
 *   "leistung" Leistungsabstand aus Sicht des Siegers (mittlere C2-PP, kann negativ sein -> D = 1), wo der
 *              Motor im Duell keine Marge liefert (Zeitfahren 1:0).
 */
export function margeFuerAnker(
  anker: Pick<ErgebnisSkalaAnker, "margeQuelle"> | null,
  input: { outcome: "win" | "draw" | "loss"; marge: number; seiten?: readonly [number, number] | null; leistungEigen?: number | null; leistungGegner?: number | null },
): number {
  if (anker?.margeQuelle === "leistung") {
    return (input.outcome === "loss" ? -1 : 1) * ((input.leistungEigen ?? 0) - (input.leistungGegner ?? 0));
  }
  if (anker?.margeQuelle === "relativ") {
    const [a, b] = input.seiten ?? [NaN, NaN];
    const summe = Math.abs(a) + Math.abs(b);
    return Number.isFinite(summe) && summe > 0 ? Math.abs(a - b) / summe : 0;
  }
  return input.marge;
}

function bezugAus(anker: ErgebnisSkalaAnker | null): number | null {
  return anker ? anker.knoten[anker.knoten.length - 1]! : null;
}

/**
 * Ein Duell auf der Ergebnisskala, aus Sicht EINES Teams. `outcome` kommt aus der gebuchten Wertung
 * (2/1/0), NICHT aus der Marge: ein Tiebreak-Sieg bei gleichem Seitenstand (Gewichtheben) ist D = 1.
 * `leistungEigen`/`leistungGegner` = mittlere Spieler-PP der beiden Seiten in dieser Disziplin.
 */
export function berechneDuellErgebnisE1(input: {
  disciplineId: string;
  playerCount: number | null | undefined;
  outcome: "win" | "draw" | "loss";
  marge: number;
  /** Nativer Seitenstand [eigen, gegner] -- fuer die Margen-Quelle "relativ". */
  seiten?: readonly [number, number] | null;
  leistungEigen: number | null | undefined;
  leistungGegner: number | null | undefined;
}): DuellErgebnisE1 {
  const anker = ergebnisSkalaAnker(input.disciplineId, "duell", input.playerCount);
  const marge = margeFuerAnker(anker, input);
  const d = abstandAusMarge({ remis: input.outcome === "draw", marge, anker });
  const mu = (niveauAusLeistung(input.leistungEigen, anker) + niveauAusLeistung(input.leistungGegner, anker)) / 2;
  const c = ERGEBNIS_SKALA_MAX * mu;
  if (input.outcome === "draw") {
    const gleich = Math.round(clamp(c, 0, ERGEBNIS_SKALA_MAX));
    return { ergebnis: [gleich, gleich], verhaeltnis: 0, bezug: bezugAus(anker) };
  }
  const verlierer = Math.round(clamp(c - d / 2, 0, ERGEBNIS_SKALA_MAX - d));
  const sieger = verlierer + d;
  return input.outcome === "win"
    ? { ergebnis: [sieger, verlierer], verhaeltnis: d, bezug: bezugAus(anker) }
    : { ergebnis: [verlierer, sieger], verhaeltnis: -d, bezug: bezugAus(anker) };
}

/**
 * Die Spanne T einer Vierergruppe auf die Luecken verteilen: jede Luecke mindestens 1 (ein besserer
 * Platz liegt immer hoeher), der Rest anteilig zum rohen Abstand (groesster Rest zuerst). Liefert die
 * ganzzahligen Luecken, Summe = max(T, Zahl der Luecken).
 */
function verteileSpanne(spanne: number, rohLuecken: readonly number[]): number[] {
  const k = rohLuecken.length;
  if (k === 0) return [];
  const t = clamp(Math.max(spanne, k), k, ERGEBNIS_SKALA_MAX);
  const rest = t - k;
  const summe = rohLuecken.reduce((a, b) => a + Math.max(0, b), 0);
  const anteile = rohLuecken.map((g) => (summe > 0 ? (rest * Math.max(0, g)) / summe : rest / k));
  const ganz = anteile.map((a) => Math.floor(a));
  let offen = rest - ganz.reduce((a, b) => a + b, 0);
  const reihenfolge = anteile
    .map((a, i) => ({ i, r: a - Math.floor(a) }))
    .sort((x, y) => y.r - x.r || x.i - y.i);
  for (const { i } of reihenfolge) {
    if (offen <= 0) break;
    ganz[i] = ganz[i]! + 1;
    offen -= 1;
  }
  return ganz.map((g) => g + 1);
}

/**
 * Punkteverhaeltnis je Pod-Team: eigener Wert minus Mittel der anderen, ganzzahlig. Jede Seite wird
 * einzeln gerundet (Abstand zweier Plaetze >= 4/3 -> die Reihenfolge bleibt streng). Weicht die Summe
 * danach von 0 ab, wird der Rest an den Teams mit dem groessten Rundungsfehler in Gegenrichtung
 * ausgeglichen, aber nur, wo das die strenge Reihenfolge nicht verletzt (Test: alle Leitern 0..10).
 */
export function podVerhaeltnisse(werte: readonly number[]): number[] {
  const n = werte.length;
  if (n < 2) return werte.map(() => 0);
  const summe = werte.reduce((a, b) => a + b, 0);
  const exakt = werte.map((w) => (n * w - summe) / (n - 1));
  const r = exakt.map((x) => Math.round(x));
  let rest = r.reduce((a, b) => a + b, 0);
  let schutz = 0;
  while (rest !== 0 && schutz < 8) {
    schutz += 1;
    const richtung = rest > 0 ? -1 : 1;
    let bester = -1;
    let besterFehler = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const neu = r[i]! + richtung;
      // Reihenfolge erhalten: werte sind absteigend sortiert, strenge Ordnung wo werte streng fallen.
      const davor = i > 0 ? r[i - 1]! : Infinity;
      const danach = i < n - 1 ? r[i + 1]! : -Infinity;
      const davorStreng = i > 0 && werte[i - 1]! > werte[i]!;
      const danachStreng = i < n - 1 && werte[i]! > werte[i + 1]!;
      const gleichDavor = i > 0 && werte[i - 1] === werte[i];
      const gleichDanach = i < n - 1 && werte[i] === werte[i + 1];
      if (gleichDavor || gleichDanach) continue;
      if (davorStreng ? neu >= davor : neu > davor) continue;
      if (danachStreng ? neu <= danach : neu < danach) continue;
      const fehler = (r[i]! - exakt[i]!) * -richtung; // wie weit r[i] in Gegenrichtung zu weit liegt
      if (fehler > besterFehler) {
        besterFehler = fehler;
        bester = i;
      }
    }
    if (bester < 0) break;
    r[bester] = r[bester]! + richtung;
    rest += richtung;
  }
  return r;
}

export type PodErgebnisE1 = {
  /** 0..10 je Team, in der Reihenfolge der Eingabe (Platz 1 zuerst), streng fallend. */
  werte: number[];
  /** Punkteverhaeltnis je Team (eigener Wert minus Mittel der Gegner), Summe 0. */
  verhaeltnisse: number[];
  bezug: number | null;
};

/**
 * Eine Vierergruppe (oder FFA) auf der Ergebnisskala. `sortiert` = Teams nach gebuchtem Platz (Platz 1
 * zuerst); `luecke` = roher Abstand zum naechstbesseren Platz (0 fuer Platz 1), `leistung` = mittlere
 * Spieler-PP des Teams.
 */
export function berechnePodErgebnisE1(input: {
  disciplineId: string;
  playerCount: number | null | undefined;
  sortiert: ReadonlyArray<{ luecke: number; leistung: number | null | undefined }>;
}): PodErgebnisE1 {
  const n = input.sortiert.length;
  if (n === 0) return { werte: [], verhaeltnisse: [], bezug: null };
  const anker = ergebnisSkalaAnker(input.disciplineId, "pod", input.playerCount);
  if (n === 1) return { werte: [5], verhaeltnisse: [0], bezug: bezugAus(anker) };
  const rohLuecken = input.sortiert.slice(1).map((t) => Math.max(0, t.luecke));
  const rohSpanne = rohLuecken.reduce((a, b) => a + b, 0);
  const spanne = spanneAusRohspanne({ rohSpanne, teams: n, anker });
  const luecken = verteileSpanne(spanne, rohLuecken);
  const leiter = new Array<number>(n).fill(0);
  for (let i = n - 2; i >= 0; i -= 1) leiter[i] = leiter[i + 1]! + luecken[i]!;
  const t = leiter[0]!;
  const mu = input.sortiert.reduce((s, team) => s + niveauAusLeistung(team.leistung, anker), 0) / n;
  const unten = Math.round(clamp(ERGEBNIS_SKALA_MAX * mu - t / 2, 0, ERGEBNIS_SKALA_MAX - t));
  const werte = leiter.map((w) => unten + w);
  return { werte, verhaeltnisse: podVerhaeltnisse(werte), bezug: bezugAus(anker) };
}

// ---------------------------------------------------------------------------------- Anzeige

function zahlText(wert: number): string {
  return Number.isInteger(wert) ? String(wert) : wert.toFixed(1).replace(".", ",");
}

/**
 * EINE Schreibweise fuer "native Zahl -> Skala" (Arena-Zeile, Nach dem Spieltag): "87 : 79 → 7 : 4".
 * Ohne Skala nur die native Zahl, ohne native Zahl nur die Skala. Beide Werte kommen aus der GEBUCHTEN
 * Zeile (`duellSeiten`, `ergebnisNormiert`), nie aus einer zweiten Rechnung.
 */
export function ergebnisMitSkalaText(input: {
  seiten: readonly [number, number] | null | undefined;
  skala: readonly [number, number] | null | undefined;
}): string {
  const nativ = input.seiten ? `${zahlText(input.seiten[0])} : ${zahlText(input.seiten[1])}` : "";
  const skala = input.skala ? `${input.skala[0]} : ${input.skala[1]}` : "";
  if (nativ && skala) return `${nativ} → ${skala}`;
  return nativ || skala;
}
