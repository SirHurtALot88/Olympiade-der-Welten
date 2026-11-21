/**
 * PP-TAGESANKER (Prototyp 21.11., docs/design/pp-analyse-21-11.md) -- STANDARD AUS.
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
 * SCHALTER: `OLY_PP_TAGESANKER=an` (Server) bzw. `NEXT_PUBLIC_OLY_PP_TAGESANKER=an` (Browser-Build).
 * Wirkt nur, wo die PP-Skala C2 aktiv ist (`ppSkalaModus === "an"`), also nie im Manager-Modus, nie in
 * einer alten Saison und nie im Messmodus "roh". Ohne Schalter ist jeder Pfad bit-identisch zu vorher.
 * Fuer eine Scharfschaltung waere -- wie bei C2 -- ein Saison-Stempel statt des Serverschalters der
 * richtige Weg (gezeigt == gebucht, keine rueckwirkende Umrechnung), s. Dokument Abschnitt 5.
 */

/** Ziel fuer das Mittel der besten drei des Spieltags, VOR der weichen Kappe. */
export const PP_TAGESANKER_ZIEL = 5.5;
/** Wie viele Tagesbeste den Anker bilden (robust gegen einen einzelnen Ausreisser). */
export const PP_TAGESANKER_TOP_K = 3;
/** Ab hier beginnt die weiche Kappe. */
export const PP_TAGESANKER_KNIE = 4;
/** Asymptote der weichen Kappe -- wird nie erreicht. */
export const PP_TAGESANKER_MAX = 5;

export type PpTagesankerModus = "aus" | "an";

function leseSchalter(wert: string | undefined): PpTagesankerModus | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  return w === "an" || w === "1" || w === "true" || w === "ja" || w === "on" ? "an" : "aus";
}

/** Browser-Variante zuerst (Next.js ersetzt nur den woertlichen Zugriff), dann Server. Standard: aus. */
export function ppTagesankerSchalter(): PpTagesankerModus {
  return leseSchalter(process.env.NEXT_PUBLIC_OLY_PP_TAGESANKER) ?? leseSchalter(process.env.OLY_PP_TAGESANKER) ?? "aus";
}

/** Aktiv nur mit Schalter UND aktiver PP-Skala C2 ("an"); "aus"/"roh" bleiben immer unberuehrt. */
export function ppTagesankerAktiv(ppSkala: string | null | undefined): boolean {
  return ppSkala === "an" && ppTagesankerSchalter() === "an";
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

/**
 * Bequeme Weiche fuer die vier PP-Rechenstellen (Arena-Boxscore, Bahn-Pod, Battlefield-Pod, Mini-DM-FFA):
 * aktiv -> Tagesanker auf die ungedeckelte Map, sonst die Map unveraendert zurueck.
 */
export function wendePpTagesankerAn(ppSkala: string | null | undefined, pps: Map<string, number>): Map<string, number> {
  return ppTagesankerAktiv(ppSkala) ? verteilePpNachTagesanker(pps) : pps;
}
