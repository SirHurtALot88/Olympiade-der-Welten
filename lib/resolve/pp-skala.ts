/**
 * PP-SKALA-PROTOTYP (18.11., docs/design/pp-skala-18-11.md, Variante C2) — STANDARD AUS.
 *
 * Chris 18.11., woertlich: "Die PPs sollen weiterhin eine Darstellung der Leistung der Spieler sein,
 * Top-Spieler sollen in einer Diszi um die 5 PPs bekommen als Maximum."
 *
 * Heute laufen alle Spieler-PP eines Battle-Saves ueber dieselbe Impact-Kurve
 * (`ppsAusArenaImpact()` / `ppAusSpielerScore()`: `MAX * min(1, (s/S_krass)^gamma)`, MAX 5,5), aber
 * gegen Referenzen (`S_mittel`/`S_krass`), die je Disziplin zu verschiedenen Zeitpunkten gegen
 * verschiedene Motorstaende gezogen wurden. Gemessen (Dokument Abschnitt 2) liegt der Tagesbeste je
 * Disziplin deshalb nicht einheitlich bei ~5: Tennis/Spurt um 3,3, Climbing/Time-Trial mit 7-8
 * Spielern gleichauf am Deckel, Hockey ungedeckelt bis ~14; der Median-Einsatz streut 0,6..1,5.
 *
 * DER SCHALTER (Variante C2, "Zwei-Anker-Nachkalibrierung") rechnet dieselbe Kurve OHNE den alten
 * Deckel (`roh = 5,5 * (max(0,s)/S_krass)^gamma`) und legt sie je Disziplin neu auf zwei GEMESSENE Anker
 * (`data/generated/pp-skala-kalibrierung.json`, gezogen mit scripts/miss-pp-skala.ts):
 *
 *     R_top = Median der ungedeckelten Tagesbesten   -> 5      (Chris: "Top-Spieler um die 5")
 *     R_med = Median aller Einsaetze der Disziplin    -> 1,25   (25 % von 5, wie die alte Kurve)
 *     PP_neu = min(5, 5 * (roh / R_top)^e),  e = ln(0,25) / ln(R_med / R_top)
 *
 * Das ist exakt die Konstruktion der bestehenden Impact-Kurve (Mitte -> 25 % des Maximums, Spitze ->
 * Maximum), nur mit Ankern, die fuer alle Disziplinen gleich definiert und am selben Motorstand
 * gemessen sind -- statt p50/p99,5 einer je Disziplin zu anderer Zeit gezogenen Einzelwert-Referenz.
 * Weil `roh` selbst ein Potenzgesetz in `s` ist, bleibt auch `PP_neu` eins: streng monoton, Boden 0,
 * Reihenfolge der Spieler unveraendert. Wer heute nur wegen des alten Deckels mit anderen gleichauf
 * bei 5,5 stand, wird wieder unterscheidbar (ausser der Motor liefert selbst gleiche Rohwerte).
 *
 *   OLY_PP_SKALA=an   neue Skala (Server). Fuer den Browser zusaetzlich NEXT_PUBLIC_OLY_PP_SKALA=an
 *                     beim Build: der Saisonstand rechnet die PPS-Duell-PP im Browser nach.
 *   OLY_PP_SKALA=roh  NUR fuer Messungen (scripts/miss-pp-skala.ts): alte Skala ohne Deckel, Faktor 1 --
 *                     liefert die ungedeckelten Werte, aus denen `R_top`/`R_med` gezogen werden. Nie im Spiel.
 *   alles andere      AUS: kein Aufrufer betritt diesen Pfad, alles bit-identisch zum Stand vorher.
 */
import kalibrierungJson from "@/data/generated/pp-skala-kalibrierung.json";

/** Neues Maximum je Disziplin-Einsatz (Chris 18.11.: "um die 5 PPs ... als Maximum"). */
export const PP_SKALA_MAX = 5;

/** Die alten Kurvenregler (`*_INDIVIDUAL_PPS_MAX` / `*_PPS_ANTEIL_MITTE`), fuer alle Disziplinen gleich. */
export const PP_SKALA_ALT_MAX = 5.5;
export const PP_SKALA_ALT_ANTEIL_MITTE = 0.25;

export type PpSkalaModus = "aus" | "an" | "roh";

/** Anteil des Maximums fuer den Median-Einsatz (wie `*_PPS_ANTEIL_MITTE` der alten Kurve). */
export const PP_SKALA_ANTEIL_MITTE = 0.25;

type KalibrierungJson = {
  ziel?: number;
  disziplinen?: Record<string, { rTop?: number; rMed?: number }>;
};

export type PpSkalaAnker = { rTop: number; rMed: number; exponent: number };

const ANKER_JE_DISZIPLIN: ReadonlyMap<string, PpSkalaAnker> = new Map(
  Object.entries((kalibrierungJson as KalibrierungJson).disziplinen ?? {})
    .filter(
      ([, e]) =>
        typeof e.rTop === "number" && typeof e.rMed === "number" && Number.isFinite(e.rTop) && Number.isFinite(e.rMed) && e.rMed > 0 && e.rTop > e.rMed,
    )
    .map(([disziplinId, e]) => [
      disziplinId,
      { rTop: e.rTop as number, rMed: e.rMed as number, exponent: Math.log(PP_SKALA_ANTEIL_MITTE) / Math.log((e.rMed as number) / (e.rTop as number)) },
    ] as const),
);

function modusAus(wert: string | undefined): PpSkalaModus {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "roh") return "roh";
  if (w === "an" || w === "1" || w === "true" || w === "ja" || w === "on") return "an";
  return "aus";
}

/** Liest den Schalter bei jedem Aufruf neu (Tests/Sonden setzen ihn zur Laufzeit). */
export function ppSkalaModus(): PpSkalaModus {
  // NEXT_PUBLIC_ muss als woertlicher Zugriff dastehen, damit Next.js ihn im Browser-Bundle ersetzt.
  const browser = modusAus(process.env.NEXT_PUBLIC_OLY_PP_SKALA);
  return browser !== "aus" ? browser : modusAus(process.env.OLY_PP_SKALA);
}

export function ppSkalaAktiv(): boolean {
  return ppSkalaModus() !== "aus";
}

/** Die Anker einer Disziplin (`null`, wenn sie nicht kalibriert ist -- dann nur alter Wert, Deckel 5). */
export function ppSkalaAnker(disciplineId: string | null | undefined): PpSkalaAnker | null {
  if (!disciplineId) return null;
  return ANKER_JE_DISZIPLIN.get(disciplineId) ?? null;
}

function runde2(wert: number): number {
  return Math.round(wert * 100) / 100;
}

/**
 * Den UNGEDECKELTEN alten Kurvenwert `roh = MAX_alt * (s/S_krass)^gamma` auf die neue Skala bringen
 * (Modus "an": `min(5, 5 * (roh/R_top)^e)`, ohne Anker nur `min(5, roh)`; Modus "roh": unveraendert,
 * ohne Deckel). Ein zusaetzlicher, schon auf der alten Skala gerechneter Zuschlag (Spurt-Stationsduelle,
 * hoechstens 0,5) wird danach addiert und faellt unter denselben Deckel.
 */
export function skaliereUngedeckelt(disciplineId: string, ungedeckelt: number, zuschlag = 0): number {
  const modus = ppSkalaModus();
  const basis = Math.max(0, ungedeckelt);
  if (modus === "roh") return runde2(basis + zuschlag);
  const anker = ppSkalaAnker(disciplineId);
  const neu = anker ? (basis <= 0 ? 0 : PP_SKALA_MAX * Math.pow(basis / anker.rTop, anker.exponent)) : basis;
  return runde2(Math.min(PP_SKALA_MAX, neu + zuschlag));
}

/**
 * Die Impact-Kurve (`ppsAusArenaImpact()` / `ppAusSpielerScore()`) OHNE Deckel, danach
 * `skaliereUngedeckelt()`. Gleiche Entartungsregeln wie dort: kaputte Referenz, nicht-endlicher oder
 * nicht-positiver Wert -> 0.
 */
export function ppAusKurveSkaliert(input: {
  disciplineId: string;
  wert: number | null | undefined;
  referenz: { p50: number; p995: number } | null;
  max?: number;
  anteilMitte?: number;
  zuschlag?: number;
}): number {
  const { referenz } = input;
  const zuschlag = input.zuschlag ?? 0;
  const max = input.max ?? PP_SKALA_ALT_MAX;
  const anteilMitte = input.anteilMitte ?? PP_SKALA_ALT_ANTEIL_MITTE;
  if (!referenz || typeof input.wert !== "number" || !Number.isFinite(input.wert)) {
    return skaliereUngedeckelt(input.disciplineId, 0, zuschlag);
  }
  const { p50, p995 } = referenz;
  if (!(p995 > 0) || !(p50 > 0) || p50 >= p995) return skaliereUngedeckelt(input.disciplineId, 0, zuschlag);
  const gamma = Math.log(anteilMitte) / Math.log(p50 / p995);
  const basis = Math.max(0, input.wert) / p995;
  const ungedeckelt = basis <= 0 ? 0 : max * Math.pow(basis, gamma);
  return skaliereUngedeckelt(input.disciplineId, ungedeckelt, zuschlag);
}
