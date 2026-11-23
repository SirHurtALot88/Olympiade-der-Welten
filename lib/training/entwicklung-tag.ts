/**
 * ENTWICKLUNG NEU, RUNDE 2 (22.11.): die Rechnung JE SPIELTAG (docs/design/entwicklung-balance-22-11.md, Abschnitt 8).
 *
 * Je Spieltag und Attribut: Delta = T (Training) + L (Leistung, mit Vorzeichen) - A (Abbau). Dieses Modul rechnet L und
 * fuehrt die drei Teile zusammen; T und A liefert die Engine (`buildOrganicSeasonProgression`, Modus `nurTraining`).
 *
 * LEISTUNG (L): PP des Spielers an diesem Spieltag gegen den Median derselben Liga (nur wer an dem Spieltag antrat), in
 * Einheiten (`ppEinheit`), ueber dem Median `z^gamma`, darunter `beta * z`; verteilt auf die Attribute nach dem Matrixgewicht
 * der gespielten Disziplin(en) (Matrix nur gelesen). Wer nicht eingesetzt war: L = 0, keine zusaetzliche Strafe. Der Schwung
 * (`schwungFaktor`: geht die Saison bisher in die Richtung der heutigen Leistung, zaehlt sie mehr) verstaerkt -- die wenigen starken
 * Entwicklungen und Einbrueche entstehen hier, je Spieltag, nicht als Rueckbuchung am Saisonende.
 *
 * Der PP-Index (Spieltag -> Spieler -> PP, Median je Liga) wird EINMAL je Ergebnisbestand gebaut (WeakMap am `seasonState`),
 * nicht je Spieler und nicht je abgeschnittenem Spielstand.
 */
import type { GameState, Player, PlayerGeneratorAttributeName, TrainingsSpieltagEintrag } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { officialDisciplineWeightTable, playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import { getLeagueOf } from "@/lib/season/league-split";
import { ertragsFaktor, entwicklungsParameter, leistungsEinheit, leistungsFaktor, schwungFaktor } from "@/lib/training/entwicklung-neu";

export type AttributWerte = Partial<Record<PlayerGeneratorAttributeName, number>>;

const ATTRIBUTE = playerGeneratorAttributeKeys as readonly PlayerGeneratorAttributeName[];

export function istDiligent(player: Pick<Player, "traitsPositive">): boolean {
  const alle = player.traitsPositive ?? [];
  return alle.some((trait) => typeof trait === "string" && trait.trim().toLowerCase() === "diligent");
}

type TagesSpieler = { pp: number; jeDisziplin: Map<string, number>; liga: string };
type TagesEintrag = { median: Map<string, number>; spieler: Map<string, TagesSpieler> };
export type PpTagesIndex = { seasonId: string; tage: Map<string, TagesEintrag> };

const indexCache = new WeakMap<object, PpTagesIndex>();

function median(werte: number[]): number {
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = sortiert.length >> 1;
  return sortiert.length % 2 ? sortiert[mitte]! : (sortiert[mitte - 1]! + sortiert[mitte]!) / 2;
}

/** PP je Spieler und Spieltag der laufenden Saison, dazu der Median je Liga. Einmal je `seasonState`. */
export function ppTagesIndex(gameState: GameState): PpTagesIndex {
  const schluessel = gameState.seasonState as object;
  const gemerkt = indexCache.get(schluessel);
  if (gemerkt && gemerkt.seasonId === gameState.season.id) return gemerkt;
  const tage = new Map<string, TagesEintrag>();
  const ledger = buildSeasonPointsLedger(gameState, gameState.season.id);
  for (const e of ledger.pointEntries) {
    if (!e.matchdayId) continue;
    const tag = tage.get(e.matchdayId) ?? { median: new Map<string, number>(), spieler: new Map<string, TagesSpieler>() };
    tage.set(e.matchdayId, tag);
    const liga = getLeagueOf(gameState, e.teamId) ?? "all";
    const z = tag.spieler.get(e.playerId) ?? { pp: 0, jeDisziplin: new Map<string, number>(), liga };
    z.pp += e.points;
    z.jeDisziplin.set(e.disciplineId, (z.jeDisziplin.get(e.disciplineId) ?? 0) + e.points);
    tag.spieler.set(e.playerId, z);
  }
  for (const tag of tage.values()) {
    const jeLiga = new Map<string, number[]>();
    for (const z of tag.spieler.values()) {
      const liste = jeLiga.get(z.liga) ?? [];
      liste.push(z.pp);
      jeLiga.set(z.liga, liste);
    }
    for (const [liga, liste] of jeLiga) tag.median.set(liga, median(liste));
  }
  const index = { seasonId: gameState.season.id, tage };
  indexCache.set(schluessel, index);
  return index;
}

/** Spieltag mit gewerteten Ergebnissen im Index? */
export function istSpieltagGewertet(index: PpTagesIndex, matchdayId: string): boolean {
  return index.tage.has(matchdayId);
}

/** Leistung des Spielers an einem Spieltag in Einheiten (mit Vorzeichen), `null` ohne Einsatz. */
export function leistungsEinheitFuerTag(
  index: PpTagesIndex,
  matchdayId: string,
  playerId: string,
): { einheit: number; jeDisziplin: Map<string, number> } | null {
  const tag = index.tage.get(matchdayId);
  const z = tag?.spieler.get(playerId);
  if (!tag || !z) return null;
  const abstand = z.pp - (tag.median.get(z.liga) ?? 0);
  return { einheit: leistungsEinheit(abstand), jeDisziplin: z.jeDisziplin };
}

const matrixSummeCache = new Map<string, number>();

function matrixSumme(disziplinId: string): number {
  const gemerkt = matrixSummeCache.get(disziplinId);
  if (gemerkt != null) return gemerkt;
  let summe = 0;
  for (const attribute of ATTRIBUTE) summe += (officialDisciplineWeightTable[attribute] as Record<string, number>)[disziplinId] ?? 0;
  matrixSummeCache.set(disziplinId, summe);
  return summe;
}

/** Verteilt eine Leistungssumme auf die zwoelf Attribute nach dem Matrixgewicht der gespielten Disziplinen (nach PP-Anteil). */
export function verteileLeistung(summe: number, jeDisziplin: ReadonlyMap<string, number>): AttributWerte {
  const ergebnis: AttributWerte = {};
  if (summe === 0 || jeDisziplin.size === 0) return ergebnis;
  const ppSumme = [...jeDisziplin.values()].reduce((a, b) => a + Math.max(0, b), 0);
  for (const attribute of ATTRIBUTE) {
    let anteil = 0;
    for (const [disziplinId, pp] of jeDisziplin) {
      const anteilDisziplin = ppSumme > 0 ? Math.max(0, pp) / ppSumme : 1 / jeDisziplin.size;
      const gesamt = matrixSumme(disziplinId);
      const gewicht = (officialDisciplineWeightTable[attribute] as Record<string, number>)[disziplinId] ?? 0;
      if (gesamt > 0) anteil += anteilDisziplin * (gewicht / gesamt);
    }
    if (anteil > 0) ergebnis[attribute] = summe * anteil;
  }
  return ergebnis;
}

type VerlaufEintrag = Pick<TrainingsSpieltagEintrag, "m" | "s" | "d" | "z" | "p" | "a" | "o">;

/** Netto-Entwicklung der Saison bisher (Summe ueber die Attribute, Training + Leistung - Abbau der gebuchten Spieltage ohne `ohneSpieltag`). */
export function nettoBisher(verlauf: readonly VerlaufEintrag[] | undefined, ohneSpieltag?: string): number {
  let summe = 0;
  for (const e of verlauf ?? []) {
    if (e.m === ohneSpieltag || e.s !== "t") continue;
    for (const wert of Object.values(nettoDesEintrags(e))) summe += wert ?? 0;
  }
  return summe;
}

/**
 * Anteil des meistgewaehlten Trainingsziels an den Trainingstagen mit Ziel (ohne den eigenen Spieltag, dafuer mit dem
 * gerade gewaehlten Ziel); `null`, solange weniger als `fokusMinTage` Tage vorliegen (dann neutral).
 */
export function fokusDominanz(verlauf: readonly VerlaufEintrag[] | undefined, aktuellesZiel?: string | null, ohneSpieltag?: string): number | null {
  const jeZiel = new Map<string, number>();
  for (const e of verlauf ?? []) {
    if (e.m === ohneSpieltag || e.s !== "t" || !e.d) continue;
    jeZiel.set(e.d, (jeZiel.get(e.d) ?? 0) + 1);
  }
  if (aktuellesZiel) jeZiel.set(aktuellesZiel, (jeZiel.get(aktuellesZiel) ?? 0) + 1);
  const gesamt = [...jeZiel.values()].reduce((a, b) => a + b, 0);
  if (gesamt < entwicklungsParameter().fokusMinTage) return null;
  return Math.max(...jeZiel.values()) / gesamt;
}

/** Leistung eines gewerteten Spieltags fuer einen Spieler, skaliert (Gewicht, Eichung, Serie), noch ohne Ertrags-Kappung. */
export function leistungFuerTag(input: {
  index: PpTagesIndex;
  matchdayId: string;
  player: Player;
  verlauf: readonly VerlaufEintrag[] | undefined;
}): AttributWerte {
  const roh = leistungsEinheitFuerTag(input.index, input.matchdayId, input.player.id);
  if (!roh || roh.einheit === 0) return {};
  const skaliert =
    roh.einheit *
    leistungsFaktor(istDiligent(input.player)) *
    schwungFaktor(nettoBisher(input.verlauf, input.matchdayId), roh.einheit);
  return verteileLeistung(skaliert, roh.jeDisziplin);
}

const r3 = (wert: number) => Math.round(wert * 1000) / 1000;

const abbauFaktorCache = new WeakMap<object, Map<string, { seasonId: string; wert: number }>>();

/**
 * LIGAWEITER ABBAU-FAKTOR (Thermostat fuer das Liga-Mittel, Chris: "Liga-Mittel -1 bis +1 je Saison"; ligaweite Wirkung trifft alle Teams gleich).
 * Je Spieltag stellt die Regel den Abbau so, dass die bisherigen Zuwaechse der Liga (Training + positive Leistung) den Verlusten
 * (Abbau + negative Leistung) entsprechen: faktor = (Zuwaechse - negative Leistung) / Abbau ohne Faktor, aus den schon gebuchten
 * Spieltagen der Saison (ohne den gerade gebuchten), auf 0,6 bis 1,6 begrenzt; bis zum dritten Spieltag 1. Ohne ihn laeuft das Mittel ueber
 * Saisons weg (die Ertragskurve schliesst sich zur Decke, die positiven Teile schrumpfen, der Abbau bleibt). Gezeigt = gebucht: der Faktor steht
 * im Verlaufseintrag (`f`), Vorschau und Prognose rechnen mit demselben.
 */
export function ligaAbbauFaktor(gameState: GameState, ohneSpieltag?: string | null): number {
  const schluessel = gameState.players as object;
  const merk = ohneSpieltag ?? "";
  let jeSpieltag = abbauFaktorCache.get(schluessel);
  if (!jeSpieltag) {
    jeSpieltag = new Map();
    abbauFaktorCache.set(schluessel, jeSpieltag);
  }
  const gemerkt = jeSpieltag.get(merk);
  if (gemerkt && gemerkt.seasonId === gameState.season.id) return gemerkt.wert;
  let zuwachs = 0;
  let abbauBasis = 0;
  let negativ = 0;
  const tage = new Set<string>();
  for (const player of gameState.players) {
    const akku = player.seasonTrainingAccumulator;
    if (!akku || akku.seasonId !== gameState.season.id) continue;
    for (const e of akku.verlauf ?? []) {
      if (e.s !== "t" || e.o || e.m === ohneSpieltag) continue;
      tage.add(e.m);
      for (const w of Object.values(e.z ?? {})) zuwachs += w ?? 0;
      for (const w of Object.values(e.p ?? {})) {
        if ((w ?? 0) > 0) zuwachs += w ?? 0;
        else negativ -= w ?? 0;
      }
      let a = 0;
      for (const w of Object.values(e.a ?? {})) a += w ?? 0;
      abbauBasis += a / (e.f && e.f > 0 ? e.f : 1);
    }
  }
  const wert = tage.size < 3 || abbauBasis <= 0 ? 1 : Math.max(0.6, Math.min(1.6, (zuwachs - negativ) / abbauBasis));
  jeSpieltag.set(merk, { seasonId: gameState.season.id, wert });
  return wert;
}

/**
 * Fuehrt T, L und A eines Spieltags je Attribut zusammen und haelt die Grenzen ein: Zuwachs nie ueber die Decke (Leistung
 * folgt der Ertragskurve, wird zuerst gekappt, dann das Training), Wert nie unter 1. Rueckgabe: genau das, was gebucht wird
 * (`t` Training, `p` Leistung mit Vorzeichen, `a` Abbau >= 0); Netto je Attribut = t + p - a.
 */
export function fuehreTagZusammen(input: {
  vorher: AttributWerte;
  deckel: AttributWerte;
  t: AttributWerte;
  a: AttributWerte;
  l: AttributWerte;
}): { t: AttributWerte; p: AttributWerte; a: AttributWerte } {
  const t: AttributWerte = {};
  const p: AttributWerte = {};
  const a: AttributWerte = {};
  for (const attribute of ATTRIBUTE) {
    const vorher = input.vorher[attribute];
    if (typeof vorher !== "number") continue;
    const deckel = input.deckel[attribute] ?? 99;
    let tt = Math.max(0, input.t[attribute] ?? 0);
    let aa = Math.max(0, input.a[attribute] ?? 0);
    let pp = input.l[attribute] ?? 0;
    if (pp > 0) pp *= Math.max(0.3, ertragsFaktor(deckel - vorher));
    const platz = Math.max(0, deckel - vorher);
    let pPlus = Math.max(0, pp);
    let pMinus = Math.max(0, -pp);
    let ueber = tt + pPlus - (aa + pMinus) - platz;
    if (ueber > 0) {
      const vonP = Math.min(pPlus, ueber);
      pPlus -= vonP;
      ueber -= vonP;
      tt -= Math.min(tt, ueber);
    }
    const boden = Math.max(0, vorher - 1);
    let unter = aa + pMinus - (tt + pPlus) - boden;
    if (unter > 0) {
      const vonA = Math.min(aa, unter);
      aa -= vonA;
      unter -= vonA;
      pMinus -= Math.min(pMinus, unter);
    }
    const tR = r3(tt);
    const pR = r3(pPlus - pMinus);
    const aR = r3(aa);
    if (tR > 0) t[attribute] = tR;
    if (pR !== 0) p[attribute] = pR;
    if (aR > 0) a[attribute] = aR;
  }
  return { t, p, a };
}

/** Netto-Aenderung je Attribut aus einem Eintrag (t + p - a), gerundet wie gebucht. */
export function nettoDesEintrags(e: Pick<TrainingsSpieltagEintrag, "z" | "p" | "a">): AttributWerte {
  const netto: AttributWerte = {};
  for (const attribute of ATTRIBUTE) {
    const wert = r3((e.z?.[attribute] ?? 0) + (e.p?.[attribute] ?? 0) - (e.a?.[attribute] ?? 0));
    if (wert !== 0) netto[attribute] = wert;
  }
  return netto;
}
