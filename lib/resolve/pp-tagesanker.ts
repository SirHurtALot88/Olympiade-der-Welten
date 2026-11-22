/**
 * PP-TAGESANKER (Prototyp 21.11., scharf 22.11.; docs/design/pp-analyse-21-11.md).
 *
 * Chris 21.11. zu "Top-Spieler · Player-Points des Spieltags": Eiskunst Platz 1-9 alle glatt 5 PP
 * (Scores 140,9 ... 66,9), Hockey und Spurt erreicht niemand 5. Grundsatz: "PP werden je Spieltag ueber
 * ALLE Spieler beider Ligen verteilt"; Top-Spieler einer Disziplin um 5, kein Klumpen am Deckel, PP folgen
 * der Leistung in der Simulation (Impact), nicht 1:1 dem Score.
 *
 * Gemessen (Abschnitt 2/3 des Dokuments): C2 legt die Kurve auf zwei FESTE Anker je Disziplin und
 * Feldgroesse und deckelt hart bei 5. An einem Spieltag mit staerkerem Feld als in der Kalibrierung
 * stehen deshalb mehrere Spieler gleichauf bei 5,0 (Live-Save Eiskunst Spieltag 1: neun), an einem
 * schwaecheren erreicht niemand 5 (Hockey 4,39, Spurt 3,59). Beides ist kein Motorfehler, sondern die
 * Grenze eines festen Ankers (pp-skala-18-11.md Abschnitt 0 Punkt 7).
 *
 * DER VORSCHLAG, in zwei Schritten auf den UNGEDECKELTEN C2-Wert `u` (dieselbe Impact-Kurve wie heute,
 * nur ohne `min(5, ...)`), je Disziplin und Spieltag ueber ALLE Spieler BEIDER Ligen:
 *
 *   1. Tagesanker:  A = Mittel der besten drei `u` des Spieltags (OLY-weit),  x = u * (Z / A)
 *   2. Weiche Kappe: PP = x                                   fuer x <= K
 *                    PP = K + (M - K) * (1 - exp(-(x - K) / (M - K)))   fuer x > K
 *
 * mit Z = 5,5, K = 4, M = 5. Die Kappe ist stetig und glatt (Steigung 1 am Knie), streng monoton und
 * bleibt unter 5: kein Klumpen, die Reihenfolge der Spieler (= Reihenfolge ihres Impacts) bleibt exakt
 * erhalten. Der Tagesbeste landet bei ~4,8-5,0, egal ob das Feld an diesem Tag stark oder schwach war.
 * Ein Faktor je Spieltag ist ein reiner Massstab -- Rangtreue (rho) und Pp-Abweichung sind Eigenschaften
 * des Motors und bleiben unberuehrt; der Wertungs-Fingerabdruck laeuft nur ueber den Motor.
 *
 * SCHARF seit 22.11. (docs/design/pp-tagesanker-live-22-11.md): die Schaltung liegt im Spielstand-Stempel
 * `seasonState.wertungsSkalen.ppTagesanker` (lib/resolve/wertungs-skalen.ts), nicht im Serverstart. Neues Spiel:
 * an ab Saison 1; bestehender Spielstand: ab dem naechsten Saisonwechsel (die laufende Saison rechnet zu Ende,
 * gebuchte Spieltage bleiben). Rueckweg `OLY_PP_TAGESANKER=aus` (neue Saisons), Notbremse `=aus-sofort`.
 * Jeder Rechenweg fragt `ppTagesankerFuer(gameState, matchdayId)`.
 */

import { ppSkalaModus } from "@/lib/resolve/pp-skala";
import { gueltigerStempel, ppTagesankerSchalter } from "@/lib/resolve/wertungs-skalen";

/** Ziel fuer das Mittel der besten drei des Spieltags, VOR der weichen Kappe. */
export const PP_TAGESANKER_ZIEL = 5.5;
/** Wie viele Tagesbeste den Anker bilden (robust gegen einen einzelnen Ausreisser). */
export const PP_TAGESANKER_TOP_K = 3;
/** Ab hier beginnt die weiche Kappe. */
export const PP_TAGESANKER_KNIE = 4;
/** Asymptote der weichen Kappe -- wird nie erreicht. */
export const PP_TAGESANKER_MAX = 5;

/**
 * Rechnet DIESER Spieltag mit dem Tagesanker? Ja nur, wenn (1) die PP-Skala C2 fuer ihn gilt
 * (`ppSkalaModus === "an"`: nie Manager-Modus, nie ein Spieltag vor einer Umstellung mitten in der Saison,
 * nie Messmodus "roh"), (2) der Saison-Stempel `ppTagesanker: true` traegt und (3) die Notbremse
 * `OLY_PP_TAGESANKER=aus-sofort` nicht steht. Die Antwort kommt IMMER aus dem Spielstand, nie aus dem
 * Prozess: Server und Browser lesen denselben Stempel (gezeigt = gebucht).
 */
export function ppTagesankerFuer(gameState: Parameters<typeof ppSkalaModus>[0], matchdayId?: string | null): boolean {
  if (ppTagesankerSchalter() === "aus-sofort") return false;
  if (ppSkalaModus(gameState, matchdayId) !== "an") return false;
  return gueltigerStempel(gameState)?.ppTagesanker === true;
}

/** Die weiche Kappe (s. Kopfkommentar). Unter dem Knie unveraendert, darueber gegen `max` gestaucht. */
export function weicheKappe(x: number, knie: number = PP_TAGESANKER_KNIE, max: number = PP_TAGESANKER_MAX): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x <= knie) return x;
  const spanne = max - knie;
  return knie + spanne * (1 - Math.exp(-(x - knie) / spanne));
}

function runde2(wert: number): number {
  return Math.round(wert * 100) / 100;
}

export type PpTagesankerOptionen = { ziel?: number; topK?: number; knie?: number; max?: number };

/** Der Tagesanker `A` (Mittel der besten `topK` Werte > 0), `null` ohne positiven Wert. */
export function ppTagesankerWert(werte: Iterable<number>, topK: number = PP_TAGESANKER_TOP_K): number | null {
  const positiv = [...werte].filter((w) => Number.isFinite(w) && w > 0).sort((a, b) => b - a);
  if (positiv.length === 0) return null;
  const k = Math.max(1, Math.min(Math.floor(topK), positiv.length));
  return positiv.slice(0, k).reduce((summe, w) => summe + w, 0) / k;
}

/**
 * Verteilt die PP EINER Disziplin an EINEM Spieltag ueber alle Spieler beider Ligen neu.
 * `ungedeckelt`: Spieler-ID -> ungedeckelter C2-Wert (`ppAusKurveSkaliert({..., deckel: false})`).
 * Rein und deterministisch; die Reihenfolge der Eingabe spielt keine Rolle.
 */
export function verteilePpNachTagesanker(
  ungedeckelt: ReadonlyMap<string, number>,
  optionen: PpTagesankerOptionen = {},
): Map<string, number> {
  const ziel = optionen.ziel ?? PP_TAGESANKER_ZIEL;
  const knie = optionen.knie ?? PP_TAGESANKER_KNIE;
  const max = optionen.max ?? PP_TAGESANKER_MAX;
  const anker = ppTagesankerWert(ungedeckelt.values(), optionen.topK ?? PP_TAGESANKER_TOP_K);
  const faktor = anker == null ? 0 : ziel / anker;
  const ergebnis = new Map<string, number>();
  for (const [spielerId, wert] of ungedeckelt) {
    ergebnis.set(spielerId, runde2(weicheKappe(Math.max(0, wert) * faktor, knie, max)));
  }
  return ergebnis;
}
