/**
 * PP-SKALA C2 (18.11., docs/design/pp-skala-18-11.md) -- SCHARF ab der naechsten Saison.
 *
 * Chris 18.11., woertlich: "Die PPs sollen weiterhin eine Darstellung der Leistung der Spieler sein,
 * Top-Spieler sollen in einer Diszi um die 5 PPs bekommen als Maximum." Entscheidung 18.11.: Variante C2.
 *
 * Heute laufen alle Spieler-PP eines Battle-Saves ueber dieselbe Impact-Kurve
 * (`ppsAusArenaImpact()` / `ppAusSpielerScore()`: `MAX * min(1, (s/S_krass)^gamma)`, MAX 5,5), aber
 * gegen Referenzen (`S_mittel`/`S_krass`), die je Disziplin zu verschiedenen Zeitpunkten gegen
 * verschiedene Motorstaende gezogen wurden. Gemessen (Dokument Abschnitt 2) liegt der Tagesbeste je
 * Disziplin deshalb nicht einheitlich bei ~5: Tennis/Spurt um 3,3, Climbing/Time-Trial mit 7-8
 * Spielern gleichauf am Deckel, Hockey ungedeckelt bis ~14; der Median-Einsatz streut 0,6..1,5.
 *
 * C2 ("Zwei-Anker-Nachkalibrierung") rechnet dieselbe Kurve OHNE den alten Deckel
 * (`roh = 5,5 * (max(0,s)/S_krass)^gamma`) und legt sie je Disziplin UND Feldgroesse neu auf zwei
 * GEMESSENE Anker (`data/generated/pp-skala-kalibrierung.json`, gezogen mit scripts/miss-pp-skala.ts):
 *
 *     R_top = Median der ungedeckelten Tagesbesten   -> 5      (Chris: "Top-Spieler um die 5")
 *     R_med = Median aller Einsaetze                  -> 1,25   (25 % von 5, wie die alte Kurve)
 *     PP_neu = min(5, 5 * (roh / R_top)^e),  e = ln(0,25) / ln(R_med / R_top)
 *
 * Weil `roh` selbst ein Potenzgesetz in `s` ist, bleibt auch `PP_neu` eins: streng monoton, Boden 0,
 * Reihenfolge der Spieler unveraendert.
 *
 * WELCHE SKALA GILT, entscheidet der Spielstand, nicht der Serverstart: `ppSkalaModus(gameState)`
 * liest den Saison-Stempel `seasonState.wertungsSkalen.pp` (lib/resolve/wertungs-skalen.ts, gesetzt
 * beim Anlegen und beim Saisonwechsel). "c2" -> "an", fehlend/"alt" -> "aus" (bestehende Saves rechnen
 * ihre laufende Saison unveraendert zu Ende). Der Messmodus `OLY_PP_SKALA=roh` (alte Skala ohne Deckel,
 * nur scripts/miss-pp-skala.ts) und die Notbremse `OLY_PP_SKALA=aus-sofort` stehen ueber dem Stempel.
 */
import kalibrierungJson from "@/data/generated/pp-skala-kalibrierung.json";
import { gueltigerStempel, istBattleSpielstand, ppSkalaVersionFuer } from "@/lib/resolve/wertungs-skalen";

/** Neues Maximum je Disziplin-Einsatz (Chris 18.11.: "um die 5 PPs ... als Maximum"). */
export const PP_SKALA_MAX = 5;

/** Die alten Kurvenregler (`*_INDIVIDUAL_PPS_MAX` / `*_PPS_ANTEIL_MITTE`), fuer alle Disziplinen gleich. */
export const PP_SKALA_ALT_MAX = 5.5;
export const PP_SKALA_ALT_ANTEIL_MITTE = 0.25;

export type PpSkalaModus = "aus" | "an" | "roh";

/** Anteil des Maximums fuer den Median-Einsatz (wie `*_PPS_ANTEIL_MITTE` der alten Kurve). */
export const PP_SKALA_ANTEIL_MITTE = 0.25;

type AnkerRoh = { rTop?: number; rMed?: number };
type KalibrierungJson = {
  ziel?: number;
  disziplinen?: Record<string, AnkerRoh & { feldgroessen?: Record<string, AnkerRoh & { zellen?: number }> }>;
  umrechnung?: { einsatz?: number; spielerSaison?: number; teamSaison?: number };
};

export type PpSkalaAnker = { rTop: number; rMed: number; exponent: number };

function baueAnker(e: AnkerRoh | undefined): PpSkalaAnker | null {
  if (!e || typeof e.rTop !== "number" || typeof e.rMed !== "number") return null;
  if (!Number.isFinite(e.rTop) || !Number.isFinite(e.rMed) || !(e.rMed > 0) || !(e.rTop > e.rMed)) return null;
  return { rTop: e.rTop, rMed: e.rMed, exponent: Math.log(PP_SKALA_ANTEIL_MITTE) / Math.log(e.rMed / e.rTop) };
}

type AnkerEintrag = { gesamt: PpSkalaAnker | null; jeFeld: ReadonlyArray<readonly [number, PpSkalaAnker]> };

const ANKER_JE_DISZIPLIN: ReadonlyMap<string, AnkerEintrag> = new Map(
  Object.entries((kalibrierungJson as KalibrierungJson).disziplinen ?? {}).map(([disziplinId, e]) => {
    const jeFeld = Object.entries(e.feldgroessen ?? {})
      .map(([n, f]) => [Number(n), baueAnker(f)] as const)
      .filter((x): x is readonly [number, PpSkalaAnker] => Number.isFinite(x[0]) && x[1] !== null)
      .sort((a, b) => a[0] - b[0]);
    return [disziplinId, { gesamt: baueAnker(e), jeFeld }] as const;
  }),
);

/**
 * "aus" | "an" | "roh" fuer DIESEN Spielstand (Saison-Stempel, s. Kopfkommentar). Ohne Spielstand
 * (reine Rechentests) entscheidet nur der Schalter: "roh"/"aus-sofort" wie dort, sonst "aus".
 */
export function ppSkalaModus(gameState?: Parameters<typeof ppSkalaVersionFuer>[0], matchdayId?: string | null): PpSkalaModus {
  const version = ppSkalaVersionFuer(gameState, matchdayId);
  return version === "roh" ? "roh" : version === "c2" ? "an" : "aus";
}

export function ppSkalaAktiv(gameState?: Parameters<typeof ppSkalaVersionFuer>[0]): boolean {
  return ppSkalaModus(gameState) !== "aus";
}

/**
 * Die Anker einer Disziplin fuer eine Feldgroesse: exakt gezogene Feldgroesse, sonst die
 * Disziplin-weiten Anker (`null`, wenn die Disziplin gar nicht kalibriert ist -- dann nur alter Wert,
 * Deckel 5). Bewusst KEIN Sprung auf eine benachbarte Feldgroesse: die Spitze haengt an der Zahl der
 * Einsaetze je Zelle, die Disziplin-weiten Anker mitteln ueber alle Feldgroessen.
 */
export function ppSkalaAnker(
  disciplineId: string | null | undefined,
  playerCount?: number | null,
  /** "orte3": Battlefield-Pod im alten Format (Anker unter `battlefieldOrte3`, 22.11.); sonst weglassen. */
  variante?: "orte3",
): PpSkalaAnker | null {
  if (!disciplineId) return null;
  const eintrag = (variante === "orte3" ? ANKER_JE_DISZIPLIN.get(`${disciplineId}Orte3`) : undefined) ?? ANKER_JE_DISZIPLIN.get(disciplineId);
  if (!eintrag) return null;
  if (typeof playerCount === "number" && Number.isFinite(playerCount)) {
    const exakt = eintrag.jeFeld.find(([n]) => n === Math.round(playerCount));
    if (exakt) return exakt[1];
  }
  return eintrag.gesamt;
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
export function skaliereUngedeckelt(
  disciplineId: string,
  ungedeckelt: number,
  zuschlag = 0,
  optionen: { modus?: PpSkalaModus; playerCount?: number | null; variante?: "orte3" } = {},
): number {
  const modus = optionen.modus ?? "an";
  const basis = Math.max(0, ungedeckelt);
  if (modus === "roh") return runde2(basis + zuschlag);
  const anker = ppSkalaAnker(disciplineId, optionen.playerCount, optionen.variante);
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
  /** "an" (Standard) oder "roh" -- vom Aufrufer aus `ppSkalaModus(gameState)`. */
  modus?: PpSkalaModus;
  /** Feldgroesse dieser Disziplin an diesem Spieltag (Anker je Feldgroesse). */
  playerCount?: number | null;
  /** Battlefield-Pod im alten Format "orte3": die Anker dieses Formats (gezeigt = gebucht, gebuchte Spieltage bleiben). */
  variante?: "orte3";
}): number {
  const { referenz } = input;
  const optionen = { modus: input.modus, playerCount: input.playerCount, variante: input.variante };
  const zuschlag = input.zuschlag ?? 0;
  const max = input.max ?? PP_SKALA_ALT_MAX;
  const anteilMitte = input.anteilMitte ?? PP_SKALA_ALT_ANTEIL_MITTE;
  if (!referenz || typeof input.wert !== "number" || !Number.isFinite(input.wert)) {
    return skaliereUngedeckelt(input.disciplineId, 0, zuschlag, optionen);
  }
  const { p50, p995 } = referenz;
  if (!(p995 > 0) || !(p50 > 0) || p50 >= p995) return skaliereUngedeckelt(input.disciplineId, 0, zuschlag, optionen);
  const gamma = Math.log(anteilMitte) / Math.log(p50 / p995);
  const basis = Math.max(0, input.wert) / p995;
  const ungedeckelt = basis <= 0 ? 0 : max * Math.pow(basis, gamma);
  return skaliereUngedeckelt(input.disciplineId, ungedeckelt, zuschlag, optionen);
}

/**
 * UMRECHNUNG FUER ABNEHMER MIT ABSOLUTEN PP-SCHWELLEN (docs/design/pp-skala-18-11.md Abschnitt 8.3).
 * Gemessen an denselben Saves wie die Anker (`werte-pp-skala-aus.mjs`): Verhaeltnis C2 / alt fuer den
 * mittleren Einsatz, die Spieler-Saisonsumme (Median) und die Team-Saisonsumme. Ein Abnehmer, der eine
 * feste PP-Zahl als Schwelle oder Multiplikator hat (organische Entwicklung `/30`, Trainings-XP `x 4`,
 * Vorstands-Sportziel `>= 95`), rechnet seine Zahl in einer C2-Saison mit diesem Faktor um, damit er
 * sich durch die neue Skala nicht verschiebt. In einer alten Saison sind alle Faktoren 1.
 */
export type PpSkalaUmrechnung = { einsatz: number; spielerSaison: number; teamSaison: number };

const KEINE_UMRECHNUNG: PpSkalaUmrechnung = { einsatz: 1, spielerSaison: 1, teamSaison: 1 };

function faktor(wert: number | undefined): number {
  return typeof wert === "number" && Number.isFinite(wert) && wert > 0.2 && wert < 5 ? wert : 1;
}

export function ppSkalaUmrechnung(gameState?: Parameters<typeof ppSkalaVersionFuer>[0]): PpSkalaUmrechnung {
  if (ppSkalaModus(gameState) !== "an") return KEINE_UMRECHNUNG;
  // Nur Battle-Saves: ein Manager-Save rechnet nie mit C2.
  if (!istBattleSpielstand(gameState)) return KEINE_UMRECHNUNG;
  // Gemischte Saison (Umstellung mitten drin, `ppAb`): Faktor 1. Die Faktoren sind auf eine ganze C2-Saison
  // gemessen; auf eine Saison, in der nur der Rest C2 ist, angewandt, waere die Skalierung falsch
  // gewichtet. Der Fehler der unskalierten Teilsaison ist klein (die Saison ist ohnehin zu Ende)
  // und nach dem Saisonwechsel gilt der volle Faktor.
  if (gueltigerStempel(gameState)?.ppAb) return KEINE_UMRECHNUNG;
  const u = (kalibrierungJson as KalibrierungJson).umrechnung;
  return { einsatz: faktor(u?.einsatz), spielerSaison: faktor(u?.spielerSaison), teamSaison: faktor(u?.teamSaison) };
}
