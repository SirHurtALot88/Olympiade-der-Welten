/**
 * ENTWICKLUNG NEU, RUNDE 2 (22.11.): die Rechnung JE SPIELTAG (docs/design/entwicklung-balance-22-11.md, Abschnitt 8).
 *
 * Je Spieltag und Attribut: Delta = T (Training) + L (Leistung, mit Vorzeichen) - A (Abbau). Dieses Modul rechnet L und
 * fuehrt die drei Teile zusammen; T und A liefert die Engine (`buildOrganicSeasonProgression`, Modus `nurTraining`).
 *
 * LEISTUNG (L): JE EINSATZ -- die PP des Spielers in einer Disziplin an diesem Spieltag gegen den Median derselben Liga UND derselben
 * Disziplin (nur wer in ihr antrat), in Einheiten (`ppEinheit`), ueber dem Median `z^gamma`, darunter `beta * z`; die Einheiten der
 * Einsaetze eines Tages werden summiert und je Disziplin nach deren Matrixgewicht auf die Attribute verteilt (Matrix nur gelesen).
 * Wer nur eine Disziplin spielt, steht nicht schlechter da als wer zwei spielt (Review 22.11.: vorher Summe ueber D1+D2 gegen den
 * Median der Tagessummen). Wer nicht eingesetzt war: L = 0, keine zusaetzliche Strafe. Der Schwung
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
import {
  ertragsFaktor,
  entwicklungsParameter,
  leistungsEinheit,
  leistungsFaktor,
  schwungFaktor,
  type EntwicklungsParameter,
} from "@/lib/training/entwicklung-neu";

export type AttributWerte = Partial<Record<PlayerGeneratorAttributeName, number>>;

const ATTRIBUTE = playerGeneratorAttributeKeys as readonly PlayerGeneratorAttributeName[];

export function istDiligent(player: Pick<Player, "traitsPositive">): boolean {
  const alle = player.traitsPositive ?? [];
  return alle.some((trait) => typeof trait === "string" && trait.trim().toLowerCase() === "diligent");
}

/** Ein Spieler an einem Spieltag: Liga und PP je Disziplin (ein Einsatz je Disziplin). */
type TagesSpieler = { liga: string; jeDisziplin: Map<string, number> };
type TagesEintrag = { median: Map<string, number>; spieler: Map<string, TagesSpieler> };
export type PpTagesIndex = { seasonId: string; tage: Map<string, TagesEintrag> };

const indexCache = new WeakMap<object, PpTagesIndex>();

function median(werte: number[]): number {
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = sortiert.length >> 1;
  return sortiert.length % 2 ? sortiert[mitte]! : (sortiert[mitte - 1]! + sortiert[mitte]!) / 2;
}

/** Schluessel des Medians: Liga und Disziplin (am selben Spieltag). */
export function medianSchluessel(liga: string, disziplinId: string): string {
  return `${liga}|${disziplinId}`;
}

/** PP je Spieler, Disziplin und Spieltag der laufenden Saison, dazu der Median je (Liga, Disziplin, Spieltag). Einmal je `seasonState`. */
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
    const z = tag.spieler.get(e.playerId) ?? { liga, jeDisziplin: new Map<string, number>() };
    z.jeDisziplin.set(e.disciplineId, (z.jeDisziplin.get(e.disciplineId) ?? 0) + e.points);
    tag.spieler.set(e.playerId, z);
  }
  for (const tag of tage.values()) {
    const jeGruppe = new Map<string, number[]>();
    for (const z of tag.spieler.values()) {
      for (const [disziplinId, pp] of z.jeDisziplin) {
        const key = medianSchluessel(z.liga, disziplinId);
        const liste = jeGruppe.get(key) ?? [];
        liste.push(pp);
        jeGruppe.set(key, liste);
      }
    }
    for (const [key, liste] of jeGruppe) tag.median.set(key, median(liste));
  }
  const index = { seasonId: gameState.season.id, tage };
  indexCache.set(schluessel, index);
  return index;
}

/** Spieltag mit gewerteten Ergebnissen im Index? */
export function istSpieltagGewertet(index: PpTagesIndex, matchdayId: string): boolean {
  return index.tage.has(matchdayId);
}

/** PP-Abstand eines Einsatzes zum Median seiner (Liga, Disziplin, Spieltag); `null` ohne Einsatz in dieser Disziplin. */
export function ppAbstandFuerEinsatz(index: PpTagesIndex, matchdayId: string, playerId: string, disziplinId: string): number | null {
  const tag = index.tage.get(matchdayId);
  const z = tag?.spieler.get(playerId);
  const pp = z?.jeDisziplin.get(disziplinId);
  if (!tag || !z || pp == null) return null;
  return pp - (tag.median.get(medianSchluessel(z.liga, disziplinId)) ?? 0);
}

/**
 * Leistung des Spielers an einem Spieltag in Einheiten (mit Vorzeichen): `einheit` = Summe der Einsatz-Einheiten, `jeDisziplin` = die
 * Einheit je Disziplin (jeder Einsatz fuer sich gegen den Median seiner Disziplin). `null` ohne Einsatz.
 */
export function leistungsEinheitFuerTag(
  index: PpTagesIndex,
  matchdayId: string,
  playerId: string,
): { einheit: number; jeDisziplin: Map<string, number> } | null {
  const tag = index.tage.get(matchdayId);
  const z = tag?.spieler.get(playerId);
  if (!tag || !z) return null;
  const jeDisziplin = new Map<string, number>();
  let einheit = 0;
  for (const [disziplinId, pp] of z.jeDisziplin) {
    const e = leistungsEinheit(pp - (tag.median.get(medianSchluessel(z.liga, disziplinId)) ?? 0));
    jeDisziplin.set(disziplinId, e);
    einheit += e;
  }
  return { einheit, jeDisziplin };
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

/** Verteilt die Einheit je Disziplin (mit Vorzeichen) nach dem Matrixgewicht der jeweiligen Disziplin auf die zwoelf Attribute und summiert. */
export function verteileLeistung(jeDisziplinEinheit: ReadonlyMap<string, number>, faktor = 1): AttributWerte {
  const ergebnis: AttributWerte = {};
  for (const [disziplinId, einheit] of jeDisziplinEinheit) {
    if (einheit === 0) continue;
    const gesamt = matrixSumme(disziplinId);
    if (gesamt <= 0) continue;
    for (const attribute of ATTRIBUTE) {
      const gewicht = (officialDisciplineWeightTable[attribute] as Record<string, number>)[disziplinId] ?? 0;
      if (gewicht > 0) ergebnis[attribute] = (ergebnis[attribute] ?? 0) + einheit * faktor * (gewicht / gesamt);
    }
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

/** Bisher gebuchter NEGATIVER Leistungsanteil der Saison (Betrag, Summe ueber Attribute und Spieltage ohne `ohneSpieltag`). */
export function negativeLeistungBisher(verlauf: readonly VerlaufEintrag[] | undefined, ohneSpieltag?: string): number {
  let summe = 0;
  for (const e of verlauf ?? []) {
    if (e.m === ohneSpieltag || e.s !== "t") continue;
    for (const wert of Object.values(e.p ?? {})) if ((wert ?? 0) < 0) summe -= wert ?? 0;
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

/**
 * Leistung eines gewerteten Spieltags fuer einen Spieler, skaliert (Gewicht, Eichung, Schwung), noch ohne Ertrags-Kappung.
 * Der negative Teil hat eine Saisongrenze (`negativSaisonGrenze`): was die Saison an negativer Leistung schon gebucht hat, zaehlt davon ab.
 * `einheiten` (optional) bekommt die rohen Einheiten je Disziplin dieses Tages (fuer den Verlaufseintrag und die Erwartung der Folgesaison).
 */
export function leistungFuerTag(input: {
  index: PpTagesIndex;
  matchdayId: string;
  player: Player;
  verlauf: readonly VerlaufEintrag[] | undefined;
  einheiten?: Map<string, number>;
  /** Parameter der Saison (`entwicklungsParameterFuer(gameState)`); ohne Angabe der Stand vom 22.11. */
  parameter?: EntwicklungsParameter;
}): AttributWerte {
  const roh = leistungsEinheitFuerTag(input.index, input.matchdayId, input.player.id);
  if (!roh) return {};
  if (input.einheiten) for (const [disziplinId, einheit] of roh.jeDisziplin) input.einheiten.set(disziplinId, einheit);
  if (roh.einheit === 0) return {};
  const p = input.parameter ?? entwicklungsParameter();
  const faktor = leistungsFaktor(istDiligent(input.player), p) * schwungFaktor(nettoBisher(input.verlauf, input.matchdayId), roh.einheit, p);
  const verteilt = verteileLeistung(roh.jeDisziplin, faktor);
  // Saisongrenze fuer den negativen Anteil: nur die negativen Attributteile dieses Tages zaehlen gegen den Rest der Grenze.
  let negativHeute = 0;
  for (const wert of Object.values(verteilt)) if ((wert ?? 0) < 0) negativHeute -= wert ?? 0;
  if (negativHeute > 0) {
    const rest = Math.max(0, p.negativSaisonGrenze - negativeLeistungBisher(input.verlauf, input.matchdayId));
    if (negativHeute > rest) {
      const skala = rest / negativHeute;
      for (const attribute of ATTRIBUTE) {
        const wert = verteilt[attribute];
        if (typeof wert === "number" && wert < 0) verteilt[attribute] = wert * skala;
      }
    }
  }
  return verteilt;
}

const r3 = (wert: number) => Math.round(wert * 1000) / 1000;

/**
 * Fingerabdruck der PP-Grundlage eines Spielers an einem Spieltag (je Disziplin: PP und Median seiner Liga). Steht im Verlaufseintrag (`h`);
 * ein erneutes Buchen desselben Spieltags (`forceReplace`) rechnet L neu, wenn er sich geaendert hat (Review 22.11.).
 */
export function ppHashFuerTag(index: PpTagesIndex, matchdayId: string, playerId: string): string {
  const tag = index.tage.get(matchdayId);
  const z = tag?.spieler.get(playerId);
  if (!tag || !z) return "";
  return [...z.jeDisziplin.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([disziplinId, pp]) => `${disziplinId}:${r3(pp)}:${r3(tag.median.get(medianSchluessel(z.liga, disziplinId)) ?? 0)}`)
    .join("|");
}

type ErwartungsQuelle = NonNullable<Player["leistungsErwartung"]>;

/**
 * Die Leistungs-Erwartung fuer die FOLGESAISON aus dem Verlauf der ausgehenden: Spieltage mit Einsatz, Einsaetze und die Summe der
 * Einheiten je Disziplin (`y` im Eintrag). `null`, wenn die Saison keine Leistungsdaten hat (nichts gebucht, nie eingesetzt, alte Eintraege).
 */
export function baueLeistungsErwartung(
  accumulator: Player["seasonTrainingAccumulator"] | null | undefined,
): ErwartungsQuelle | null {
  if (!accumulator) return null;
  const trainiert = (accumulator.verlauf ?? []).filter((e) => e.s === "t");
  if (trainiert.length === 0) return null;
  const jeDisziplin: Record<string, { n: number; summe: number }> = {};
  for (const e of trainiert) {
    for (const [disziplinId, einheit] of Object.entries(e.y ?? {})) {
      const z = (jeDisziplin[disziplinId] ??= { n: 0, summe: 0 });
      z.n += 1;
      z.summe += einheit;
    }
  }
  if (Object.keys(jeDisziplin).length === 0) return null;
  for (const z of Object.values(jeDisziplin)) z.summe = r3(z.summe);
  return { seasonId: accumulator.seasonId, tage: trainiert.length, jeDisziplin };
}

/** Mittleres z (Leistungseinheit) je Einsatz aus der Vorsaison; `null` ohne Daten. */
export function mittleresZJeEinsatz(erwartung: Player["leistungsErwartung"] | null | undefined): number | null {
  if (!erwartung) return null;
  let n = 0;
  let summe = 0;
  for (const z of Object.values(erwartung.jeDisziplin)) {
    n += z.n;
    summe += z.summe;
  }
  return n > 0 ? summe / n : null;
}

/**
 * Erwartete Leistung (L, mit Vorzeichen, je Attribut) JE SPIELTAG aus der Vorsaison: das mittlere z je Einsatz, mit der Einsatzquote
 * (Einsaetze je Trainingstag) und dem Leistungsfaktor, nach Matrixgewicht der gespielten Disziplinen verteilt. Ohne Schwung (neutral).
 * `null` ohne Vorsaison-Daten (dann Erwartung 0).
 */
export function leistungsErwartungJeTag(
  player: Pick<Player, "leistungsErwartung" | "traitsPositive">,
  parameter: EntwicklungsParameter = entwicklungsParameter(),
): AttributWerte | null {
  const e = player.leistungsErwartung;
  if (!e || e.tage <= 0) return null;
  const jeDisziplin = new Map<string, number>();
  for (const [disziplinId, z] of Object.entries(e.jeDisziplin)) jeDisziplin.set(disziplinId, z.summe / e.tage);
  return verteileLeistung(jeDisziplin, leistungsFaktor(istDiligent(player), parameter));
}

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
  let abbauGebucht = 0;
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
      abbauGebucht += a;
      abbauBasis += a / (e.f && e.f > 0 ? e.f : 1);
    }
  }
  let wert = 1;
  if (tage.size >= 3 && abbauBasis > 0) {
    // Gleichgewicht der bisherigen Saison (Zuwaechse - negative Leistung) / Abbau ohne Faktor; auf die ganze Saison hochgerechnet muss die
    // Summe des gebuchten Abbaus dieses Gleichgewicht treffen. Was die bisherigen Spieltage ueber oder unter dem Gleichgewicht lagen,
    // holen die uebrigen Spieltage nach (fruehe Spieltage tragen anders als spaete, deshalb nicht nur das Verhaeltnis bis jetzt).
    const gleichgewicht = (zuwachs - negativ) / abbauBasis;
    const gesamtTage = Math.max(tage.size + 1, gameState.season.totalMatchdays ?? gameState.season.matchdayIds?.length ?? 20);
    const basisGesamt = (abbauBasis * gesamtTage) / tage.size;
    const rest = basisGesamt - abbauBasis;
    wert = Math.max(0.6, Math.min(1.6, rest > 0 ? (gleichgewicht * basisGesamt - abbauGebucht) / rest : gleichgewicht));
    // Der Faktor ist ein Thermostat, kein Sprung: gegenueber dem Faktor des zuletzt gebuchten Spieltags aendert er sich je Spieltag
    // um hoechstens `ligaFaktorSchritt` (Review 22.11.: sonst reisst eine Liga-Stichprobe den Abbau von einem Tag zum naechsten).
    const schritt = entwicklungsParameter().ligaFaktorSchritt;
    const vorher = letzterLigaFaktor(gameState, tage, ohneSpieltag);
    wert = Math.max(vorher - schritt, Math.min(vorher + schritt, wert));
  }
  jeSpieltag.set(merk, { seasonId: gameState.season.id, wert });
  return wert;
}

/** Der im Verlauf gebuchte Ligafaktor (`f`) des letzten gebuchten Spieltags vor `ohneSpieltag`; 1, wenn keiner gebucht ist. */
function letzterLigaFaktor(gameState: GameState, gebuchteTage: ReadonlySet<string>, ohneSpieltag?: string | null): number {
  let ids: readonly string[] = gameState.season.matchdayIds ?? [];
  if (ids.length === 0) {
    // Ohne Spieltagsliste: die Reihenfolge, in der der Verlauf eines Spielers gebucht wurde (chronologisch angehaengt).
    for (const player of gameState.players) {
      const akku = player.seasonTrainingAccumulator;
      if (akku && akku.seasonId === gameState.season.id && (akku.verlauf ?? []).length > 0) {
        ids = (akku.verlauf ?? []).map((e) => e.m);
        break;
      }
    }
  }
  const reihenfolge = new Map(ids.map((id, i) => [id, i] as const));
  const grenze = ohneSpieltag != null ? reihenfolge.get(ohneSpieltag) ?? Infinity : Infinity;
  let letzter: string | null = null;
  for (const id of gebuchteTage) {
    const pos = reihenfolge.get(id);
    if (pos == null || pos >= grenze) continue;
    if (letzter == null || pos > (reihenfolge.get(letzter) ?? -1)) letzter = id;
  }
  if (letzter == null) return 1;
  for (const player of gameState.players) {
    const akku = player.seasonTrainingAccumulator;
    if (!akku || akku.seasonId !== gameState.season.id) continue;
    const e = (akku.verlauf ?? []).find((x) => x.m === letzter && x.s === "t" && !x.o && x.a);
    if (e) return e.f && e.f > 0 ? e.f : 1;
  }
  return 1;
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
