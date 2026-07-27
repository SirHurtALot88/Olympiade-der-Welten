/**
 * SCHATTENTEST — Kernmodul (kein Produktionscode, nur additiv).
 *
 * Dieses Modul enthaelt die REINE Rechenmaschinerie, mit der das neue Sponsor-Modell
 * (scripts/sponsor-model-params.ts) NEBEN der echten Engine mitlaufen kann: es liest realisierte
 * Endstaende und Zustaende und rechnet aus, was das Modell GEZAHLT HAETTE. Es fasst nichts an,
 * was die Engine besitzt.
 *
 * DREI DINGE, DIE HIER ANDERS SIND ALS IN DEN BISHERIGEN PRUEFSKRIPTEN:
 *
 *  1. EX-ANTE-K. scripts/sponsor-5season-model.ts loest K gegen die REALISIERTEN Ziehungen
 *     (Zeile 66-90: `cards` enthaelt bereits `finalRank`, dann wird K auf `targetSum` iteriert).
 *     Damit ist "Deckung 100 %" eine Tautologie — K ist per Konstruktion die Zahl, die 100 %
 *     erzeugt. Hier wird K aus dem ERWARTUNGSWERT VOR der Saison geloest: nur Erwartungsrang,
 *     Kartenzug und die angenommenen P gehen ein, kein realisierter Endrang. Die Deckung ist danach
 *     eine echte Messgroesse, die auch danebenliegen darf.
 *
 *  2. KEIN KORRIDOR bei der Auszahlung. Die Engine kennt keinen +-11-Korridor; ein Team kann von
 *     Erwartungsrang 30 den Titel holen. Ausgezahlt wird deshalb ueber alle 32 Raenge.
 *
 *  3. GEMESSENE statt gesetzter sigma/P. sigma und die Klausel-P sind Parameter dieser Funktionen,
 *     keine Konstanten — genau damit der Schattentest die gemessenen Werte einsetzen kann.
 */
import {
  TIERS, tierOf, LIGA, floorAt, RARITY_DRAW, RARITY_ORDER,
  TARGET_EV_SHAPE, rel as relRepr, CURVE_BASE, CURVE_UP, CURVE_BETA, CURVE_DOWN,
  clauseBonus, clauseMalus, dist, PROFILES, cardTargets, formShape, goalPayout,
  P_GOAL as P_GOAL_DESIGN, SIGMA as SIGMA_DESIGN, type Profile,
} from "./sponsor-model-params";

// ── Kurvenkatalog (identisch zu scripts/sponsor-model-proposal.ts, dort nicht separat exportiert) ──
export type ShadowCurve = { name: string; rel: (d: number) => number };
export const SHADOW_CURVES: ShadowCurve[] = [
  { name: "Sockel", rel: (d) => (d <= 0 ? 6 : 6 + d) },
  { name: "Halten", rel: (d) => (d === 0 ? 12 : d > 0 ? 12 - 3 * d : 12 + 6 * d) },
  { name: "Linear", rel: relRepr },
  { name: "Gipfel", rel: (d) => (d >= 2 ? 14 + 10 * (d - 2) : d === 1 ? 2 : -6 + 3 * d) },
  { name: "Steil", rel: (d) => (d < 0 ? 5 * d : 7 * d) },
  { name: "Flach", rel: (d) => (d <= 0 ? 2 : 2 + 2 * d) },
];
export const curveByName = (name: string): ShadowCurve =>
  SHADOW_CURVES.find((c) => c.name === name) ?? SHADOW_CURVES[2]!;

/** Nur fuer den Monotonie-Nachweis: die Parameter der reprasentativen Kurve. */
export const CURVE_CONSTANTS = { CURVE_BASE, CURVE_UP, CURVE_BETA, CURVE_DOWN };

/**
 * KLAUSELKATALOG — 1:1 die 20 Klauseln aus scripts/sponsor-model-proposal.ts (dort exportiert,
 * aber das Skript ist ein Report mit Top-Level-Ausgaben; es zu importieren wuerde den ganzen
 * Report ausfuehren). Deshalb hier als reine Daten gespiegelt. `p` ist das DESIGN-P — der Wert,
 * gegen den die Messung geprueft wird.
 */
export type ShadowClause = { name: string; label: string; p: number; s: number; lever: string };
export const SHADOW_CLAUSES: ShadowClause[] = [
  { name: "Einsatzlast", label: "Saison-Fatigue-Schnitt >= X (auspowern)", p: 0.55, s: 24, lever: "trainingMode + Rotation" },
  { name: "Schonung", label: "Saison-Fatigue-Schnitt <= X (rotieren)", p: 0.5, s: 17, lever: "Rotation" },
  { name: "Hartes Training", label: "Anteil Spieltage mit Modus 'hart' >= X %", p: 0.6, s: 20, lever: "trainingMode je Spieltag" },
  { name: "Talentschmiede", label: "X Spieler steigen eine Klasse auf", p: 0.4, s: 24, lever: "Trainingsfokus" },
  { name: "Wertaufbau", label: "Kaderwert +X % ueber die Saison", p: 0.5, s: 20, lever: "Training + Transfers" },
  { name: "Achsenprofil", label: "eine Achse in die Top-N der Klasse", p: 0.45, s: 22, lever: "Trainingsklasse" },
  { name: "Disziplinen", label: "X Disziplinen mit positivem Saison-Delta", p: 0.5, s: 19, lever: "preferredDisciplines" },
  { name: "Schuldenfrei", label: "kein neuer Kredit (oder einen getilgt)", p: 0.85, s: 8, lever: "Finanzplanung" },
  { name: "Gehaltseffizienz", label: "Gehaltssumme unter der Schwelle deiner Klasse", p: 0.5, s: 18, lever: "Verhandlung" },
  { name: "Kaderruhe", label: "hoechstens X Transfers", p: 0.6, s: 15, lever: "Transferdisziplin" },
  { name: "Ausbau", label: "Fan-Shop-/Arena-Stufen erhoehen", p: 0.45, s: 25, lever: "Bauinvestition" },
  { name: "Prophylaxe", label: "hoechstens X Verletzungen ueber die Saison", p: 0.45, s: 20, lever: "Belastungssteuerung" },
  { name: "Moral", label: "OE-Moral am Saisonende ueber der Schwelle", p: 0.55, s: 17, lever: "Rollen, Einsatzzeiten" },
  { name: "Beliebtheit", label: "Beliebtheit um X steigern", p: 0.45, s: 17, lever: "Erfolg + Fan-Infrastruktur" },
  { name: "XP-Disziplin", label: ">= X % der verdienten XP investiert", p: 0.65, s: 17, lever: "currentXP/spentXP" },
  { name: "Charakterarbeit", label: "X negative Traits aus dem Kader entfernen", p: 0.4, s: 20, lever: "traitsNegative" },
  { name: "Vielseitigkeit", label: ">= X verschiedene Subklassen im Kader", p: 0.6, s: 16, lever: "Kaderkomposition" },
  { name: "Fokusschule", label: ">= X Spieler auf derselben Trainingsklasse", p: 0.55, s: 19, lever: "trainingClass buendeln" },
  { name: "Kapitaenstreue", label: "derselbe Kapitaen ueber die ganze Saison", p: 0.75, s: 14, lever: "appoint_captain" },
  { name: "Wortlaut", label: "alle Spielerversprechen eingehalten", p: 0.45, s: 22, lever: "Versprechen" },
];
export const clauseByName = (name: string): ShadowClause =>
  SHADOW_CLAUSES.find((c) => c.name === name) ?? SHADOW_CLAUSES[2]!;

// ── Die Karte ──────────────────────────────────────────────────────────────────────────────────
export type ShadowCard = {
  /** Herkunft: aus welchem echten Angebot diese Karte abgeleitet wurde (leer bei Zufallszug). */
  sourceOfferId?: string;
  rarity: string;
  profile: Profile;
  curve: ShadowCurve;
  clause: ShadowClause;
};

/** Bonus/Malus der Klausel unter dem P, mit dem gerechnet wird (Design-P oder gemessenes P). */
export const clauseArms = (clause: ShadowClause, p: number) => ({
  bonus: clauseBonus(clause.s, p),
  malus: clauseMalus(clause.s, p),
});

/**
 * Rangteil der Karte bei gegebenem Endrang. Kein Korridor, kein Klemmen — die Engine kennt
 * beides nicht.
 */
export function rankPartOfCard(card: ShadowCard, expectedRank: number, finalRank: number, cal: number): number {
  const finTier = tierOf(finalRank);
  return LIGA[finTier]! + card.curve.rel(tierOf(expectedRank) - finTier) + formShape(card.profile, expectedRank, finTier) + cal;
}

export type CardParams = {
  /** Streuung der Endraenge um den Erwartungsrang — GEMESSEN einzusetzen. */
  sigma: number;
  /** Erfuellungswahrscheinlichkeit der Klausel — GEMESSEN einzusetzen. */
  pClause: number;
  /** Erfuellungswahrscheinlichkeit des Sonderziels. */
  pGoal: number;
};

/** Die vier Auszahlungsecken (Klausel x Sonderziel) bei einem festen Endrang, VOR K. */
export function cornersOfCard(
  card: ShadowCard, expectedRank: number, finalRank: number, cal: number, params: CardParams,
): Array<{ v: number; p: number }> {
  const tier = tierOf(expectedRank);
  const { special } = cardTargets(card.rarity, card.profile, tier);
  const gp = goalPayout(special, params.pGoal);
  const fl = floorAt(card.rarity, 1.0);
  const { bonus, malus } = clauseArms(card.clause, params.pClause);
  const base = rankPartOfCard(card, expectedRank, finalRank, cal);
  const wf = (v: number) => Math.max(fl, v);
  return [
    { v: wf(base + bonus + gp), p: params.pClause * params.pGoal },
    { v: wf(base + bonus), p: params.pClause * (1 - params.pGoal) },
    { v: wf(base - malus + gp), p: (1 - params.pClause) * params.pGoal },
    { v: wf(base - malus), p: (1 - params.pClause) * (1 - params.pGoal) },
  ];
}

/** Erwartungswert der ganzen Karte ueber ALLE 32 Endraenge (kein Korridor). */
export function evOfCard(card: ShadowCard, expectedRank: number, cal: number, params: CardParams): number {
  const w = dist(expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    acc += w[r - 1]! * cornersOfCard(card, expectedRank, r, cal, params).reduce((a, c) => a + c.p * c.v, 0);
  }
  return acc;
}

/** Kalibrierziel der Karte: volle Ziel-EV (Leiter + Klausel + Sonderziel) der Erwartungsstufe. */
export const cardTargetEv = (card: ShadowCard, expectedRank: number): number =>
  cardTargets(card.rarity, card.profile, tierOf(expectedRank)).total;

/** Offset per Bisektion — ev ist streng monoton in cal. */
export function calibrateCard(card: ShadowCard, expectedRank: number, params: CardParams): number {
  const target = cardTargetEv(card, expectedRank);
  let lo = -400, hi = 400;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (evOfCard(card, expectedRank, mid, params) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Realisierte Auszahlung VOR K: konkreter Endrang, konkreter Klausel- und Zielzustand. */
export function rawPayout(
  card: ShadowCard, expectedRank: number, finalRank: number, cal: number, params: CardParams,
  clauseMet: boolean, goalMet: boolean,
): number {
  const tier = tierOf(expectedRank);
  const { special } = cardTargets(card.rarity, card.profile, tier);
  const gp = goalPayout(special, params.pGoal);
  const { bonus, malus } = clauseArms(card.clause, params.pClause);
  const fl = floorAt(card.rarity, 1.0);
  const v = rankPartOfCard(card, expectedRank, finalRank, cal)
    + (clauseMet ? bonus : -malus)
    + (goalMet ? gp : 0);
  return Math.max(fl, v);
}

/**
 * K-Skalierung wie in scripts/sponsor-5season-model.ts Zeile 93:
 *   gezahlt = max(fl, fl + (roh - fl) * K)
 * `fl` haengt am Ligajahr (floorAt(rarity, sf)).
 */
export const scaleWithK = (raw: number, rarity: string, sf: number, k: number): number => {
  const fl = floorAt(rarity, sf);
  return Math.max(fl, fl + (raw - fl) * k);
};

/** Traf die Untergrenze zu (also Rohwert unterhalb des Bodens)? */
export const hitFloor = (raw: number, rarity: string, sf: number, k: number): boolean => {
  const fl = floorAt(rarity, sf);
  return fl + (raw - fl) * k <= fl + 1e-9;
};

// ── EX-ANTE-K ──────────────────────────────────────────────────────────────────────────────────
export type ExAnteTeam = {
  teamId: string;
  /** Erwartungsrang VOR der Saison (qualityRank der echten Engine). */
  expectedRank: number;
  card: ShadowCard;
  cal: number;
};

/**
 * Erwartete Auszahlung EINER Karte vor der Saison bei gegebenem K — Erwartung ueber die
 * sigma-Verteilung der Endraenge UND ueber Klausel/Ziel. Enthaelt keine realisierte Information.
 */
export function expectedPaidAtK(team: ExAnteTeam, params: CardParams, sf: number, k: number): number {
  const w = dist(team.expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    const corners = cornersOfCard(team.card, team.expectedRank, r, team.cal, params);
    for (const c of corners) acc += w[r - 1]! * c.p * scaleWithK(c.v, team.card.rarity, sf, k);
  }
  return acc;
}

/**
 * K SO LOESEN, DASS DIE ERWARTETE LIGA-SUMME die Zielsumme trifft. Nur Vor-Saison-Information.
 * Monoton steigend in K, deshalb Bisektion.
 */
export function solveExAnteK(teams: ExAnteTeam[], params: CardParams, sf: number, targetSum: number): number {
  let lo = 0, hi = 12;
  const sumAt = (k: number) => teams.reduce((a, t) => a + expectedPaidAtK(t, params, sf, k), 0);
  if (sumAt(hi) < targetSum) return hi;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (sumAt(mid) < targetSum) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── FOSD ───────────────────────────────────────────────────────────────────────────────────────
export type Lottery = { outcomes: Array<{ v: number; p: number }> };
const cdfAt = (l: Lottery, x: number) => l.outcomes.reduce((a, o) => a + (o.v <= x + 1e-9 ? o.p : 0), 0);
const support = (a: Lottery, b: Lottery) => [...a.outcomes.map((o) => o.v), ...b.outcomes.map((o) => o.v)];
export function fosdAtLeast(a: Lottery, b: Lottery): boolean {
  for (const x of support(a, b)) if (cdfAt(a, x) > cdfAt(b, x) + 1e-9) return false;
  return true;
}
export function fosdStrictly(a: Lottery, b: Lottery): boolean {
  for (const x of support(a, b)) if (cdfAt(a, x) < cdfAt(b, x) - 1e-9) return true;
  return false;
}
/** Lotterien einer Karte ueber die tatsaechlich betrachteten Endraenge. */
export function lotteriesOfCard(
  card: ShadowCard, expectedRank: number, cal: number, params: CardParams, ranks: number[],
): Lottery[] {
  return ranks.map((r) => ({ outcomes: cornersOfCard(card, expectedRank, r, cal, params) }));
}
/** Kollabiert = ueber den gesamten Bereich derselbe Betrag; kann weder dominieren noch dominiert werden. */
export function isCollapsed(lot: Lottery[]): boolean {
  const vals = lot.flatMap((l) => l.outcomes.map((o) => o.v));
  return Math.max(...vals) - Math.min(...vals) < 1e-6;
}

// ── Zufallszug einer Karte (nur fuer den Fall, dass kein echtes Angebot vorliegt) ──────────────
export function drawCard(rnd: () => number): ShadowCard {
  let u = rnd(), rIdx = 0, acc = 0;
  for (let i = 0; i < RARITY_ORDER.length; i += 1) {
    acc += RARITY_DRAW[RARITY_ORDER[i]!]!;
    if (u <= acc) { rIdx = i; break; }
  }
  return {
    rarity: RARITY_ORDER[rIdx]!,
    profile: PROFILES[Math.floor(rnd() * PROFILES.length)]!,
    curve: SHADOW_CURVES[Math.floor(rnd() * SHADOW_CURVES.length)]!,
    clause: SHADOW_CLAUSES[Math.floor(rnd() * SHADOW_CLAUSES.length)]!,
  };
}

// ── Statistik ──────────────────────────────────────────────────────────────────────────────────
export const median = (xs: number[]): number => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
export const quantile = (xs: number[], q: number): number => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
};
export const iqr = (xs: number[]): [number, number] => [quantile(xs, 0.25), quantile(xs, 0.75)];
export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
export const sd = (xs: number[]): number => {
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

export const DESIGN_SIGMA = SIGMA_DESIGN;
export const DESIGN_P_GOAL = P_GOAL_DESIGN;
export { TIERS, tierOf, TARGET_EV_SHAPE, PROFILES, floorAt };
