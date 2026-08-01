/**
 * SPONSOR-MODELL V3 — "Preisgeld-Sockel + EV-neutrale Aufsaetze". REINE RECHENSCHICHT.
 *
 * Umsetzung von docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md, Abschnitt 2 und 4. Die eine Formel:
 *
 *     Auszahlung(f) = M(f) + beta * (M(f) − A)  −  p*G  +  erreicht*G
 *     mit  M(f) = Preisgeld(f) + Platzierungsbonus(Startrang − f)
 *
 * `M` ist die PREISGELD-BENCHMARK-LEITER selbst — nicht eine daran angenaeherte Kurve. Damit ist der
 * Basis-Sponsor per KONSTRUKTION exakt der Benchmark (RMSE 0), und jede Sponsorentscheidung ist eine
 * erwartungswert-neutrale Transformation um den bei Unterschrift eingefrorenen Anker `A`.
 *
 * WAS DAS ERSETZT (ersatzlos entfallen, siehe Abschnitt 4 des Entwurfs): der ex-ante geloeste Liga-K
 * samt Referenzliga, die Kalibrierungs-Fixpunkte, die Korridor-Kappung, die Meilenstein-Leiter, die
 * Rarity-Etat-Faktoren, die `teamQualityRank`-Rebalance und die gesamte Klausel-Maschinerie. Der
 * heutige Hauptfehler — "welchen Vertrag du zufaellig unterschrieben hast, zaehlt mehr als deine
 * Leistung" — ist damit STRUKTURELL unmoeglich: Rarity skaliert nur noch die GROESSE des Hebels
 * (beta, G), nie den Erwartungswert.
 *
 * Diese Datei enthaelt ausschliesslich pure Funktionen — kein GameState, kein IO, keine Zufallsquelle.
 * Sie ist damit einzeln testbar und wird von Angebotserzeugung, Anzeige, KI-Bewertung und Settlement
 * GEMEINSAM benutzt: eine Rechenstelle, deshalb kann die Projekt-Invariante "Anzeige == Settlement"
 * nicht durch eine zweite Variante brechen.
 */

// ── Die Stellschrauben ─────────────────────────────────────────────────────────────────────────

export const SPONSOR_V3_RARITIES = ["gewöhnlich", "magisch", "selten", "legendär"] as const;
export type SponsorV3Rarity = (typeof SPONSOR_V3_RARITIES)[number];

/**
 * Kurven-Tilt je Rarity. RARITY IST DIE GROESSE DES HEBELS, NIEMALS DER ERWARTUNGSWERT — eine
 * legendaere Karte laesst mehr Ausschlag zu als eine gewoehnliche, bringt aber im Erwartungswert
 * exakt dasselbe. Sensitivitaet gemessen (Entwurf, Abschnitt 3A): Tilt x0,6 → RMSE 4,79 · x1,0 →
 * 5,26 · x1,4 → 5,80. Die Stellschraube ist gutmuetig.
 */
export const SPONSOR_V3_TILT_BY_RARITY: Readonly<Record<SponsorV3Rarity, number>> = {
  "gewöhnlich": 0.15, magisch: 0.2, selten: 0.25, "legendär": 0.3,
};

/**
 * Auszahlung des Sonderziels bei voller Erfuellung, je Rarity — gedeckelt bei 10 C.
 * Warum nicht groesser: damit Sonderziele allein die Sponsoren differenzieren, muesste G >= 20-25 C
 * sein; dann schlaegt jeder Fehler in den `GOAL_PROBABILITY`-SCHAETZWERTEN als SYSTEMATISCHER
 * Etat-Fehler durch (dp = 0,15 bei G = 25 sind 3,75 C Dauerverzerrung je Team — die naechste
 * Vertragslotterie, nur mit anderem Wuerfel). Bei G <= 10 ist derselbe Schaetzfehler <= 1,5 C.
 */
export const SPONSOR_V3_GOAL_BY_RARITY: Readonly<Record<SponsorV3Rarity, number>> = {
  "gewöhnlich": 6, magisch: 7.5, selten: 9, "legendär": 10,
};

/**
 * Band, in dem ein Sonderziel ueberhaupt bepreisbar ist: darueber trivial, darunter Frust.
 * ANDERS ALS IN V2 WIRD HIER GEFILTERT STATT GEKLAMMERT: "Top 8" fuer den Tabellenletzten hat
 * p ~ 0 und faellt aus dem KATALOG, statt mit hochgeklammertem p wertlos herumzuliegen. Genau das
 * ist die Staerkeklassen-Fairness per Konstruktion (Entwurf, Abschnitt 3B).
 */
export const SPONSOR_V3_GOAL_P_MIN = 0.15;
export const SPONSOR_V3_GOAL_P_MAX = 0.72;

/**
 * Streuung der Endrang-Erwartung fuer den eingefrorenen Anker. GEMESSEN am Live-Save:
 * sd(Startrang − Endrang) ~ 3,3; auf 4 aufgerundet und an 1..32 gestutzt. Offener Punkt des
 * Entwurfs: nach 2-3 Saisons nachziehen — die Kennzahlen sind gegen diese Schraube robust.
 */
export const SPONSOR_V3_ANCHOR_SIGMA = 4;

/**
 * HARTE KLAMMER des Tilts (Guardrail aus Abschnitt 4). Bei |beta| <= 0,3 bleibt die Leiter fuer
 * jede Karte streng monoton im Endrang — sie kippt nie, ein besserer Rang zahlt nie weniger.
 */
export const SPONSOR_V3_TILT_CLAMP = 0.3;

/** Ligagroesse, ueber die die Leiter laeuft. Der Benchmark ist eine 32er-Tabelle. */
export const SPONSOR_V3_RANKS = 32;

// ── Der Karten-Slate ───────────────────────────────────────────────────────────────────────────

export type SponsorV3CardKey = "sicherheit" | "basis" | "ambition" | "sonderziel" | "ambition_ziel";

export type SponsorV3Card = {
  key: SponsorV3CardKey;
  name: string;
  /** Vielfaches von beta: −1 daempft, 0 = Benchmark, +1 verstaerkt. */
  tiltFactor: number;
  goal: boolean;
  note: string;
};

/**
 * DIE ENTSCHEIDUNG: fuenf echte Karten, alle mit IDENTISCHEM Erwartungswert, unterschieden
 * ausschliesslich im Risikoprofil. Am Erwartungsrang liegen sie fast gleich — genau dort trennt
 * sich nichts; verdient wird die Differenz ueber die Saisonleistung.
 */
export const SPONSOR_V3_CARDS: readonly SponsorV3Card[] = [
  { key: "sicherheit", name: "Sicherheit", tiltFactor: -1, goal: false,
    note: "Abweichungen vom Erwartungsanker gedaempft — weniger Absturzrisiko, weniger Upside" },
  { key: "basis", name: "Basis", tiltFactor: 0, goal: false,
    note: "exakt die Liga-Benchmark: Preisgeldkurve plus Platzierungsbonus" },
  { key: "ambition", name: "Ambition", tiltFactor: 1, goal: false,
    note: "Abweichungen verstaerkt — Ueberperformance zahlt mehr, Unterperformance kostet" },
  { key: "sonderziel", name: "Sonderziel", tiltFactor: 0, goal: true,
    note: "Benchmark plus fair bepreiste Zielpraemie (Sockelabzug −p·G, EV-Beitrag exakt 0)" },
  { key: "ambition_ziel", name: "Ambition + Ziel", tiltFactor: 1, goal: true,
    note: "beide Hebel zugleich — groesste Spannweite des Slates" },
];

export function sponsorV3CardByKey(key: string): SponsorV3Card {
  return SPONSOR_V3_CARDS.find((card) => card.key === key) ?? SPONSOR_V3_CARDS[1]!;
}

/** Tilt-Staerke dieser Rarity, hart auf [−0,3, +0,3] geklammert. */
export function sponsorV3TiltFor(rarity: string): number {
  const beta = SPONSOR_V3_TILT_BY_RARITY[rarity as SponsorV3Rarity] ?? SPONSOR_V3_TILT_BY_RARITY.magisch;
  return Math.min(SPONSOR_V3_TILT_CLAMP, Math.max(0, beta));
}

/** Zielpraemie dieser Rarity bei voller Erfuellung. */
export function sponsorV3GoalSizeFor(rarity: string): number {
  return SPONSOR_V3_GOAL_BY_RARITY[rarity as SponsorV3Rarity] ?? SPONSOR_V3_GOAL_BY_RARITY.magisch;
}

// ── Staerkeklassen und Sonderziel-Wahrscheinlichkeiten ─────────────────────────────────────────

export type SponsorV3StrengthClass = 0 | 1 | 2;

/** Drei Staerkeklassen: 0 = stark/elite (1..11), 1 = mittel (12..21), 2 = schwach/aufbau (22..32). */
export function sponsorV3StrengthClassOf(expectedRank: number): SponsorV3StrengthClass {
  if (!Number.isFinite(expectedRank)) return 1;
  if (expectedRank <= 11) return 0;
  if (expectedRank <= 21) return 1;
  return 2;
}

/**
 * ERFOLGSWAHRSCHEINLICHKEIT JE SONDERZIEL UND STAERKEKLASSE — uebernommen aus dem V2-Modell, wo sie
 * aus scripts/sponsor-objective-pricing.ts stammte. Die Werte sind DESIGN-SCHAETZUNGEN und der
 * groesste ungemessene Parameter des Systems. Genau deshalb ist die Zielpraemie bei 10 C gedeckelt:
 * ein Schaetzfehler von dp = 0,15 kostet damit hoechstens 1,5 C je Team und ist vom Deckel
 * eingefangen (Entwurf, Abschnitt 3B).
 *
 * Reihenfolge je Eintrag: [stark, mittel, schwach].
 */
const GOAL_PROBABILITY: Record<string, [number, number, number]> = {
  underdog_story: [0.00, 0.30, 0.185],
  cellar_escape: [0.00, 0.00, 0.475],
  giant_killer: [0.00, 0.35, 0.25],
  budget_overachiever: [0.00, 0.40, 0.325],
  momentum_series: [0.65, 0.45, 0.26],
  discipline_dominance: [0.485, 0.30, 0.15],
  axis_ascension: [0.49, 0.45, 0.41],
  market_value_growth: [0.475, 0.55, 0.575],
  homegrown_elevation: [0.425, 0.50, 0.55],
  fan_infrastructure: [0.625, 0.50, 0.34],
  solvency_series: [0.715, 0.55, 0.36],
  salary_discipline: [0.385, 0.52, 0.625],
  debt_payoff: [0.65, 0.45, 0.275],
  transfer_trader: [0.50, 0.48, 0.435],
  fatigue_management: [0.465, 0.50, 0.535],
  injury_prevention: [0.43, 0.46, 0.49],
  contract_stability: [0.55, 0.52, 0.425],
  captain_era: [0.59, 0.55, 0.51],
  beliebtheit_climb: [0.49, 0.45, 0.375],
  roster_diversity: [0.50, 0.50, 0.465],
  golden_title_shock: [0.16, 0.05, 0.00],
  golden_talent_forge: [0.265, 0.30, 0.31],
  fan_cult_player: [0.50, 0.48, 0.45],
  rival_humiliation: [0.42, 0.40, 0.35],
  sustainability_architect: [0.45, 0.48, 0.50],
  discipline_specialist: [0.50, 0.48, 0.44],
  facility_condition: [0.60, 0.52, 0.40],
  golden_fairytale: [0.20, 0.15, 0.10],
  golden_crowd_favorites: [0.30, 0.28, 0.25],
  golden_discipline_monopoly: [0.22, 0.15, 0.10],
  golden_rival_deluxe: [0.25, 0.22, 0.18],
  axis_rank_top: [0.49, 0.45, 0.41],
  salary_pressure_max: [0.385, 0.52, 0.625],
  form_color_cover: [0.50, 0.50, 0.465],
  transfer_profit_min: [0.50, 0.48, 0.435],
  discipline_top3_count: [0.485, 0.30, 0.15],
};

/** Alle Schluessel mit Schwierigkeits-Schaetzung — fuer die Abdeckungsmessung. */
export const SPONSOR_V3_PRICED_GOAL_KEYS: readonly string[] = Object.keys(GOAL_PROBABILITY);

/** Default fuer Ziele ohne Eintrag. Wer diesen Wert sieht, sieht KEINE Schwierigkeits-Bepreisung. */
export const SPONSOR_V3_GOAL_P_DEFAULT = 0.45;

/** Rohe Schaetzung OHNE Band — Grundlage der Katalog-Filterung. */
export function sponsorV3GoalProbabilityRaw(specialKey: string | null | undefined, expectedRank: number): number {
  const row = specialKey ? GOAL_PROBABILITY[specialKey] : undefined;
  return row ? row[sponsorV3StrengthClassOf(expectedRank)]! : SPONSOR_V3_GOAL_P_DEFAULT;
}

/**
 * DER KATALOG-FILTER (Entwurf, Abschnitt 3B). Angeboten wird ein Ziel nur, wenn seine geschaetzte
 * Erfolgswahrscheinlichkeit fuer die STAERKEKLASSE DIESES TEAMS im bepreisbaren Band liegt. Ein
 * unerreichbares Ziel wird damit gar nicht erst erzeugt — statt es mit hochgeklammertem p als
 * wertlose Karte anzubieten.
 */
export function sponsorV3IsGoalOfferable(specialKey: string | null | undefined, expectedRank: number): boolean {
  const raw = sponsorV3GoalProbabilityRaw(specialKey, expectedRank);
  return raw >= SPONSOR_V3_GOAL_P_MIN && raw <= SPONSOR_V3_GOAL_P_MAX;
}

/**
 * Wahrscheinlichkeit, mit der ein Ziel BEPREIST wird. Fuer angebotene Ziele ist sie identisch mit
 * der rohen Schaetzung (der Filter oben laesst nur Ziele im Band durch); die Klammer bleibt als
 * Sicherheitsnetz fuer Altvertraege und fuer Ziele, die ausserhalb des Angebotspfads gesetzt werden.
 */
export function sponsorV3GoalProbability(specialKey: string | null | undefined, expectedRank: number): number {
  const raw = sponsorV3GoalProbabilityRaw(specialKey, expectedRank);
  return Math.min(SPONSOR_V3_GOAL_P_MAX, Math.max(SPONSOR_V3_GOAL_P_MIN, raw));
}

// ── Die eingefrorene Leiter ────────────────────────────────────────────────────────────────────

const clampRank = (rank: number): number =>
  Math.max(1, Math.min(SPONSOR_V3_RANKS, Math.round(Number.isFinite(rank) ? rank : SPONSOR_V3_RANKS)));

/**
 * DIE BENCHMARK-LEITER `M(f) = Preisgeld(f) + Platzierungsbonus(Startrang − f)` fuer alle Endraenge
 * 1..32. `prizeCurve` ist die Preisgeldtabelle der Saison (`buildPrizeMoneyTable` aus den ECHTEN
 * Liga-Gehaeltern mal Ligajahr-Faktor), `placementBonus` die Sheet-Platzierungstabelle.
 *
 * Genau diese Leiter ist die Referenzkurve, gegen die im Entwurf gemessen wird. Sie wird NICHT
 * angenaehert, sondern woertlich eingefroren — daher RMSE 0 bei reiner Basiswahl.
 */
export function sponsorV3BenchmarkLadder(input: {
  prizeCurve: readonly number[];
  startRank: number;
  placementBonus: (rankDelta: number) => number;
}): number[] {
  const start = clampRank(input.startRank);
  const prizeAt = (rank: number): number => {
    const value = input.prizeCurve[clampRank(rank) - 1];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return Array.from({ length: SPONSOR_V3_RANKS }, (_, index) =>
    prizeAt(index + 1) + input.placementBonus(start - (index + 1)));
}

/**
 * Endrang-Gewichte des Erwartungsankers: diskretisierte Normalverteilung um den Startrang,
 * an 1..32 gestutzt und renormiert. `A` ist damit eine ZAHL IM VERTRAG — gegen sie ist jeder Tilt
 * EXAKT EV-neutral, ohne Naeherung und ohne Liga-K.
 */
export function sponsorV3AnchorWeights(startRank: number, sigma: number = SPONSOR_V3_ANCHOR_SIGMA): number[] {
  const center = clampRank(startRank);
  const spread = Math.max(0.5, sigma);
  const raw = Array.from({ length: SPONSOR_V3_RANKS }, (_, index) =>
    Math.exp(-((index + 1 - center) ** 2) / (2 * spread * spread)));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  return sum > 0 ? raw.map((value) => value / sum) : raw.map(() => 1 / SPONSOR_V3_RANKS);
}

/** Der eingefrorene Erwartungsanker `A` = erwarteter Benchmark-Wert bei Unterschrift. */
export function sponsorV3Anchor(baseLadder: readonly number[], weights: readonly number[]): number {
  return baseLadder.reduce((acc, value, index) => acc + value * (weights[index] ?? 0), 0);
}

/**
 * Die FERTIG GETILTETE Leiter `L(f) = M(f) + beta * (M(f) − A)`. Sie ist das, was im Vertrag steht;
 * das Settlement liest nur noch ab. `beta` wird hart geklammert (Guardrail).
 */
export function sponsorV3TiltedLadder(baseLadder: readonly number[], anchor: number, tilt: number): number[] {
  const beta = Math.max(-SPONSOR_V3_TILT_CLAMP, Math.min(SPONSOR_V3_TILT_CLAMP, Number.isFinite(tilt) ? tilt : 0));
  return baseLadder.map((value) => value + beta * (value - anchor));
}

// ── Die eingefrorenen Konditionen eines Vertrags ───────────────────────────────────────────────

/**
 * Alles, was eine unterschriebene V3-Karte fuer die Abrechnung braucht — bei Unterschrift eingefroren.
 * Danach ist die Abrechnung reine Arithmetik ohne Modellzugriff: Anzeige und Settlement koennen gar
 * nicht auseinanderlaufen. Traeger ist dieselbe 32er-Leiter-Infrastruktur wie in V2, nur anders
 * befuellt.
 */
export type SponsorV3ContractTerms = {
  version: 3;
  /** FERTIG getiltete Leiter L(f) je Endrang 1..32 — vor Untergrenze und Sonderziel. */
  rankLadder: number[];
  /** Die Benchmark-Leiter M(f) desselben Vertrags. Zeigt, wovon der Tilt abweicht. */
  baseLadder: number[];
  /** Eingefrorener Erwartungsanker A. */
  anchor: number;
  /** Wirksamer Tilt beta dieser Karte (negativ = Sicherheit, 0 = Basis, positiv = Ambition). */
  tilt: number;
  cardKey: SponsorV3CardKey;
  cardName: string;
  rarity: string;
  /** Startrang, gegen den der Platzierungsbonus der Leiter gerechnet ist. */
  startRank: number;
  goalKey: string | null;
  /** Erfolgswahrscheinlichkeit, mit der das Ziel bepreist wurde. 0 = Karte ohne Sonderziel. */
  goalP: number;
  /** Auszahlung des Ziels bei voller Erfuellung. 0 = Karte ohne Sonderziel. */
  goalSize: number;
  /** Ligajahr-Faktor zum Unterschriftszeitpunkt — dokumentarisch, die Leiter enthaelt ihn bereits. */
  salaryFactor: number;
  /** Absolute Untergrenze (Sicherheitsnetz), mit dem Vertrag eingefroren. */
  floor: number;
};

/**
 * DIE KARTE BAUEN. Alles, was danach passiert, liest nur noch aus dem Ergebnis.
 * `prizeCurve` und `placementBonus` sind die Liga-Groessen zum Unterschriftszeitpunkt.
 */
export function buildSponsorV3TermsCore(input: {
  prizeCurve: readonly number[];
  placementBonus: (rankDelta: number) => number;
  startRank: number;
  rarity: string;
  card: SponsorV3Card;
  goalKey: string | null;
  salaryFactor: number;
  floor: number;
  /** Nur fuer Sensitivitaets-Laeufe: skaliert die Rarity-Tilts global. Default 1. */
  tiltScale?: number;
  anchorSigma?: number;
}): SponsorV3ContractTerms {
  const baseLadder = sponsorV3BenchmarkLadder({
    prizeCurve: input.prizeCurve,
    startRank: input.startRank,
    placementBonus: input.placementBonus,
  });
  const weights = sponsorV3AnchorWeights(input.startRank, input.anchorSigma ?? SPONSOR_V3_ANCHOR_SIGMA);
  const anchor = sponsorV3Anchor(baseLadder, weights);
  const beta = sponsorV3TiltFor(input.rarity) * input.card.tiltFactor * (input.tiltScale ?? 1);
  const rankLadder = sponsorV3TiltedLadder(baseLadder, anchor, beta);
  const hasGoal = input.card.goal && input.goalKey != null;
  const goalP = hasGoal ? sponsorV3GoalProbability(input.goalKey, input.startRank) : 0;
  const goalSize = hasGoal ? sponsorV3GoalSizeFor(input.rarity) : 0;
  return {
    version: 3,
    rankLadder,
    baseLadder,
    anchor,
    tilt: Math.max(-SPONSOR_V3_TILT_CLAMP, Math.min(SPONSOR_V3_TILT_CLAMP, beta)),
    cardKey: input.card.key,
    cardName: input.card.name,
    rarity: input.rarity,
    startRank: clampRank(input.startRank),
    goalKey: input.goalKey,
    goalP,
    goalSize,
    salaryFactor: input.salaryFactor,
    floor: input.floor,
  };
}

// ── Abrechnung aus den Konditionen — DIE eine Rechenstelle ─────────────────────────────────────

/**
 * Auszahlung am Endrang `f`.
 *
 * `goalFraction` erlaubt die mehrstufigen Sonderziele der bestehenden Engine (0 … 1); bei 0/1 ist
 * das mit der Bernoulli-Lotterie des Modells identisch.
 *
 * DIE UNTERGRENZE SCHUETZT DIE LEITER, das Sonderziel rechnet OBENDRAUF — dieselbe Semantik wie in
 * V2. Sonst verschluckte die Untergrenze bei Kellerteams gerade die erreichten Ziele, fuer die das
 * Team die Saison gesteuert hat. Sie bindet praktisch nie (typische Kartenboeden 41-57 C gegen 32 C);
 * die schlechteste Konstellation des Live-Saves — Meister mit Ambition-Karte stuerzt auf Rang 32 —
 * landet knapp darauf.
 */
export function sponsorV3Settle(
  terms: SponsorV3ContractTerms, finalRank: number | null | undefined, goalFraction: number,
): number {
  const fraction = Math.max(0, Math.min(1, Number.isFinite(goalFraction) ? goalFraction : 0));
  const goalPart = terms.goalSize > 0 ? fraction * terms.goalSize - terms.goalP * terms.goalSize : 0;
  return sponsorV3LadderValue(terms, finalRank) + goalPart;
}

/**
 * Der REINE KURVENTEIL am Endrang — die getiltete Leiter unter der Untergrenze, OHNE jeden
 * Sonderziel-Anteil. Aus ihm zahlt das Settlement die Zeilen "Saisonbasis" und "Tabellenplatz";
 * der Sockelabzug −p·G steht ausschliesslich in der Sonderziel-Zeile, wo er hingehoert.
 */
export function sponsorV3LadderValue(
  terms: SponsorV3ContractTerms, finalRank: number | null | undefined,
): number {
  const index = clampRank(Number(finalRank ?? SPONSOR_V3_RANKS)) - 1;
  return Math.max(terms.floor, terms.rankLadder[index] ?? 0);
}

/**
 * Die GARANTIERTE Leiter der Karte: der Kurventeil je Endrang. Genau diese Zahlen zeigt die Karte
 * als Gewinnstufen und genau aus ihnen zahlt das Settlement Saisonbasis und Tabellenplatz.
 */
export function sponsorV3GuaranteedLadder(terms: SponsorV3ContractTerms): number[] {
  return Array.from({ length: SPONSOR_V3_RANKS }, (_, index) => sponsorV3LadderValue(terms, index + 1));
}

/**
 * Erwartungswert der Karte. Er ist per Konstruktion der eingefrorene Anker `A` — deshalb wird er
 * hier NICHT aus dem Anker abgeschrieben, sondern aus der eingefrorenen Leiter zurueckgerechnet:
 * so faellt auf, wenn eine Leiter je nicht mehr zu ihrem Anker passt (Migration, Altvertrag).
 */
export function sponsorV3ExpectedPayout(terms: SponsorV3ContractTerms): number {
  const weights = sponsorV3AnchorWeights(terms.startRank);
  let acc = 0;
  for (let rank = 1; rank <= SPONSOR_V3_RANKS; rank += 1) {
    const weight = weights[rank - 1] ?? 0;
    acc += weight * (terms.goalP * sponsorV3Settle(terms, rank, 1) + (1 - terms.goalP) * sponsorV3Settle(terms, rank, 0));
  }
  return acc;
}

/** Standardabweichung der Karte ueber die Anker-Verteilung — die Risikoachse fuer die Anzeige. */
export function sponsorV3StandardDeviation(terms: SponsorV3ContractTerms): number {
  const weights = sponsorV3AnchorWeights(terms.startRank);
  const mean = sponsorV3ExpectedPayout(terms);
  let acc = 0;
  for (let rank = 1; rank <= SPONSOR_V3_RANKS; rank += 1) {
    const weight = weights[rank - 1] ?? 0;
    for (const [probability, value] of [
      [terms.goalP, sponsorV3Settle(terms, rank, 1)] as const,
      [1 - terms.goalP, sponsorV3Settle(terms, rank, 0)] as const,
    ]) {
      acc += weight * probability * (value - mean) ** 2;
    }
  }
  return Math.sqrt(acc);
}

/** Ist die Leiter dieser Karte streng monoton im Endrang? (Guardrail, im Test asserted.) */
export function sponsorV3IsMonotone(terms: SponsorV3ContractTerms): boolean {
  const ladder = sponsorV3GuaranteedLadder(terms);
  for (let index = 1; index < ladder.length; index += 1) {
    if ((ladder[index] ?? 0) > (ladder[index - 1] ?? 0) + 1e-9) return false;
  }
  return true;
}
