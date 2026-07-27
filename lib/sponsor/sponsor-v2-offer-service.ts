/**
 * P4/P5 — OLY_SPONSOR_V2: Angebotserzeugung, eingefrorene Konditionen und Abrechnung.
 *
 * Das Flag ist per Default AUS. Ist es an, bekommt jedes erzeugte Angebot zusaetzlich einen
 * `sponsorV2`-Block: die vollstaendigen, VOR der Saison eingefrorenen Konditionen aus
 * `lib/sponsor/sponsor-v2-model.ts`. Ab da rechnen Anzeige, Finanzprognose, KI-Bewertung und
 * Settlement ausschliesslich aus diesem Block — eine Rechenstelle, deshalb kann die harte
 * Projekt-Invariante "Anzeige == Settlement" nicht durch eine zweite Variante brechen.
 *
 * WAS BEWUSST WIEDERVERWENDET WIRD statt neu gebaut:
 *  - Marke, Name, Flavour, Rarity, Kurvenform-Wurf und das SONDERZIEL kommen weiter aus dem
 *    bestehenden Angebotspfad. V2 preist das Sonderziel nur NEU (nach Schwierigkeit) und ersetzt
 *    die Rang-/Basis-Betraege. Das Sonderziel wird weiterhin vom vorhandenen
 *    `evaluateSpecialComponentStage` ausgewertet — 22 fertige, getestete Ziele, die niemand
 *    nachbauen muss.
 *  - `lockedRankPayoutLadder` bleibt der Traeger der Rangleiter. V2 fuellt sie nur mit anderen
 *    Zahlen. Bestandsvertraege haben keinen `sponsorV2`-Block und laufen unveraendert weiter.
 *
 * DIE EINE VEREINFACHUNG, DIE HIER DRINSTECKT UND OFFENGELEGT GEHOERT:
 * Das Modell skaliert die Liga-Summe mit einem ex-ante geloesten K. Exakt waere K erst bestimmbar,
 * wenn feststeht, WELCHE Karte jedes der 32 Teams unterschreibt — das ist beim Erzeugen der
 * Angebote noch offen. K wird deshalb gegen eine REPRAESENTATIVE Liga geloest (32 Teams auf den
 * Erwartungsraengen 1..32, je eine magische Karte mit ausgewogenem Profil und linearer Kurve) und
 * die tatsaechliche Gehaltssumme der Liga mal Ligajahr-Faktor. Die Abweichung dieser Naeherung ist
 * kleiner als die Eigenstreuung des Entwurfs (+-5.6 bis +-6.8 Pp, siehe Schattentest), aber sie ist
 * eine Naeherung und keine exakte Loesung.
 */
import type { GameState, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";

import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  SPONSOR_V2_CURVES, SPONSOR_V2_PROFILES, SPONSOR_V2_RARITIES,
  sponsorV2Calibrate, sponsorV2CardTargets, sponsorV2ClauseArms, sponsorV2ExpectedValue,
  sponsorV2FloorAt, sponsorV2GoalPayout, sponsorV2RankPart, sponsorV2ScaleWithK,
  sponsorV2SolveLeagueK, sponsorV2TierOf, sponsorV2ProfileByName,
  type SponsorV2Card, type SponsorV2Curve, type SponsorV2Params, type SponsorV2Rarity,
} from "@/lib/sponsor/sponsor-v2-model";
import {
  SPONSOR_V2_EVALUABLE_CLAUSES, sponsorV2StrengthClassOf, sponsorV2ThresholdFor,
} from "@/lib/sponsor/sponsor-v2-clause-evaluator";

/**
 * FEATURE-FLAG. Default AUS — der alte Pfad bleibt unveraendert lauffaehig, bis der Cutover
 * bewusst entschieden ist. Als Funktion statt Modulkonstante, damit Tests sie zur Laufzeit
 * umschalten koennen (Repo-Muster, vgl. lib/board/board-objectives-config.ts).
 */
export function isSponsorV2Enabled(): boolean {
  return process.env.OLY_SPONSOR_V2 === "1";
}

// ── Eingefrorene Konditionen ───────────────────────────────────────────────────────────────────
export type SponsorV2ContractTerms = {
  version: 2;
  /** Rangteil je Endrang 1..32 — VOR Klausel, Sonderziel, Untergrenze und K. */
  rankLadder: number[];
  curveName: string;
  profileName: string;
  rarity: string;
  expectedRank: number;
  clauseName: string;
  clauseLabel: string;
  clauseDirection: "up" | "down";
  clauseThreshold: number | null;
  clauseBonus: number;
  clauseMalus: number;
  /** Auszahlung des Sonderziels bei voller Erfuellung. */
  goalPayout: number;
  /** Erfolgswahrscheinlichkeit, mit der das Ziel bepreist wurde (nach Schwierigkeit). */
  goalProbability: number;
  goalKey: string | null;
  salaryFactor: number;
  k: number;
};

/**
 * ERFOLGSWAHRSCHEINLICHKEIT JE SONDERZIEL UND STAERKEKLASSE.
 *
 * Damit wird das Sonderziel NACH SCHWIERIGKEIT bepreist: Auszahlung = ZielEV / p (gedeckelt bei
 * 4x). Bisher hing `specialCash` ausschliesslich an der Rarity — ein 22-%-Ziel brachte exakt so
 * viel wie ein 65-%-Ziel.
 *
 * Die Werte sind DESIGN-SCHAETZUNGEN aus scripts/sponsor-objective-pricing.ts und der groesste
 * ungemessene Parameter des Entwurfs. Die fuenf Staerkeklassen dort sind hier auf die drei des
 * Evaluators zusammengezogen (elite+stark -> 0, mittel -> 1, schwach+aufbau -> 2), jeweils als
 * Mittel der zusammengelegten Klassen.
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
};
/** Band, in dem ein Ziel ueberhaupt bepreisbar ist: darueber trivial, darunter Frust. */
const GOAL_P_MIN = 0.15;
const GOAL_P_MAX = 0.72;
export function sponsorV2GoalProbability(specialKey: string | null | undefined, expectedRank: number): number {
  const row = specialKey ? GOAL_PROBABILITY[specialKey] : undefined;
  const raw = row ? row[sponsorV2StrengthClassOf(expectedRank)]! : 0.45;
  return Math.min(GOAL_P_MAX, Math.max(GOAL_P_MIN, raw));
}

// ── Liga-K ─────────────────────────────────────────────────────────────────────────────────────
const kCache = new Map<string, number>();
/**
 * Ex-ante geloestes K der laufenden Saison. Siehe Kopfkommentar zur Naeherung.
 * Gecacht je (Saison, Ligajahr-Faktor, gerundete Gehaltssumme) — sonst laeuft die Bisektion bei
 * jedem der 160 erzeugten Angebote neu.
 */
export function sponsorV2SeasonK(gameState: GameState): number {
  const salaryFactor = getSalaryFactor(gameState);
  const salarySum = gameState.teams.reduce((a, t) => a + getTeamDisplaySalaryTotal(gameState, t.teamId), 0);
  const key = `${gameState.season.id}:${salaryFactor.toFixed(3)}:${salarySum.toFixed(1)}`;
  const hit = kCache.get(key);
  if (hit !== undefined) return hit;
  const profile = sponsorV2ProfileByName("ausgewogen");
  const curve = SPONSOR_V2_CURVES.find((c) => c.name === "Linear")!;
  const clause = SPONSOR_V2_EVALUABLE_CLAUSES[0] ?? null;
  const entries = Array.from({ length: Math.max(1, gameState.teams.length) }, (_, i) => {
    const card: SponsorV2Card = {
      rarity: "magisch", profile, curve,
      clause: clause ?? { name: "—", label: "—", p: 0.5, s: 11, lever: "", evaluable: false, direction: "up" },
    };
    const expectedRank = Math.min(32, i + 1);
    return { card, expectedRank, cal: sponsorV2Calibrate(card, expectedRank, paramsFor(card, 0.45)) };
  });
  const k = sponsorV2SolveLeagueK(entries, salaryFactor, Math.max(1, salarySum * salaryFactor));
  kCache.set(key, k);
  return k;
}
/** Nur fuer Tests: der Cache haelt K je Saison fest und wuerde sonst ueber Testfaelle lecken. */
export function resetSponsorV2KCache(): void {
  kCache.clear();
}

function getSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}
function paramsFor(card: SponsorV2Card, pGoal: number): SponsorV2Params {
  return { sigma: 6.6, pClause: card.clause.p, pGoal };
}

// ── Angebot -> V2-Karte ────────────────────────────────────────────────────────────────────────
/**
 * Kurvenform der Engine -> Modellkurve. Die Engine kennt 11 Formen, das Modell 6; die Abbildung
 * ist fest und offengelegt (identisch zu der im Schattentest benutzten).
 */
const CURVE_MAP: Record<string, string> = {
  titeljaeger: "Gipfel", meisterschale: "Gipfel",
  koenigsklasse: "Steil", europapokal: "Steil",
  conference: "Linear", stetig: "Linear",
  mittelfeld: "Halten", aufsteiger: "Halten",
  konsolidierung: "Flach",
  sicherheit: "Sockel", klassenerhalt: "Sockel",
};

/** Deterministischer Hash-RNG — reproduzierbar, ohne Math.random. */
function hashRnd(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

const RARITY_LABEL: Record<string, SponsorV2Rarity> = {
  "gewöhnlich": "gewöhnlich", "magisch": "magisch", "selten": "selten", "legendär": "legendär",
};
const rarityOf = (offer: SponsorOffer): SponsorV2Rarity => RARITY_LABEL[offer.rarity ?? "magisch"] ?? "magisch";

/**
 * ANGEBOTSREGEL: keine zwei gleichen Kurvenformen in einer Liste.
 *
 * Der Wurf der Engine liefert 11 verschiedene Formen, die Abbildung faltet sie auf 6 — dabei
 * entstehen Doppel. Genau bei Paaren mit DERSELBEN Kurve sind frueher Fallen aufgetreten (gleiche
 * Kurve, gleiches P, kleineres s: am Tabellenende schneidet die Untergrenze den Malus beider ab,
 * und der schmaleren Spannweite bleibt nur der kleinere Bonus). Doppel werden deshalb
 * deterministisch auf eine noch freie Kurve umgelenkt.
 */
function assignCurves(offers: SponsorOffer[]): SponsorV2Curve[] {
  const used = new Set<string>();
  return offers.map((offer) => {
    const wanted = CURVE_MAP[offer.curveShape ?? ""] ?? "Linear";
    if (!used.has(wanted)) { used.add(wanted); return curve(wanted); }
    const free = SPONSOR_V2_CURVES.filter((c) => !used.has(c.name));
    if (free.length === 0) { return curve(wanted); } // mehr Angebote als Kurven — dann eben doppelt
    const pick = free[Math.floor(hashRnd(offer.offerId)() * free.length) % free.length]!;
    used.add(pick.name);
    return pick;
  });
}
const curve = (name: string): SponsorV2Curve =>
  SPONSOR_V2_CURVES.find((c) => c.name === name) ?? SPONSOR_V2_CURVES[2]!;

/** Profil und Klausel deterministisch aus der offerId — reproduzierbar ohne Zufallsquelle. */
function pickProfileAndClause(offerId: string) {
  const rnd = hashRnd(`${offerId}:v2`);
  const profile = SPONSOR_V2_PROFILES[Math.floor(rnd() * SPONSOR_V2_PROFILES.length)]!;
  const pool = SPONSOR_V2_EVALUABLE_CLAUSES;
  const clause = pool[Math.floor(rnd() * pool.length)]!;
  return { profile, clause };
}

// ── Konditionen bauen ──────────────────────────────────────────────────────────────────────────
export function buildSponsorV2Terms(input: {
  gameState: GameState;
  offer: SponsorOffer;
  expectedRank: number;
  curve: SponsorV2Curve;
}): SponsorV2ContractTerms {
  const { profile, clause } = pickProfileAndClause(input.offer.offerId);
  const rarity = rarityOf(input.offer);
  const card: SponsorV2Card = { rarity, profile, curve: input.curve, clause };
  const goalKey = input.offer.components.find((c) => c.kind === "special")?.specialKey ?? null;
  const goalProbability = sponsorV2GoalProbability(goalKey, input.expectedRank);
  const params = paramsFor(card, goalProbability);
  const cal = sponsorV2Calibrate(card, input.expectedRank, params);
  const arms = sponsorV2ClauseArms(clause, clause.p);
  const { special } = sponsorV2CardTargets(rarity, profile, sponsorV2TierOf(input.expectedRank));
  return {
    version: 2,
    rankLadder: Array.from({ length: 32 }, (_, i) => sponsorV2RankPart(card, input.expectedRank, i + 1, cal)),
    curveName: input.curve.name,
    profileName: profile.name,
    rarity,
    expectedRank: input.expectedRank,
    clauseName: clause.name,
    clauseLabel: clause.label,
    clauseDirection: clause.direction,
    clauseThreshold: sponsorV2ThresholdFor(clause.name, input.expectedRank),
    clauseBonus: arms.bonus,
    clauseMalus: arms.malus,
    goalPayout: sponsorV2GoalPayout(special, goalProbability),
    goalProbability,
    goalKey,
    salaryFactor: getSalaryFactor(input.gameState),
    k: sponsorV2SeasonK(input.gameState),
  };
}

// ── Auszahlung aus den Konditionen — DIE eine Rechenstelle ─────────────────────────────────────
/**
 * `goalFraction` erlaubt die mehrstufigen Sonderziele der bestehenden Engine (0 … 1). Das Modell
 * fuehrt das Ziel als Bernoulli-Lotterie; eine Teilerfuellung zahlt hier den entsprechenden Anteil.
 * Das ist eine Verallgemeinerung, keine Abweichung: bei 0/1 ist sie mit dem Modell identisch.
 */
export function sponsorV2Settle(
  terms: SponsorV2ContractTerms, finalRank: number | null | undefined, clauseMet: boolean, goalFraction: number,
): number {
  const idx = Math.max(1, Math.min(32, Math.round(Number.isFinite(Number(finalRank)) ? Number(finalRank) : 32))) - 1;
  const rarity = (RARITY_LABEL[terms.rarity] ?? "magisch") as SponsorV2Rarity;
  const fl = sponsorV2FloorAt(rarity, 1.0);
  const raw = Math.max(fl, (terms.rankLadder[idx] ?? 0)
    + (clauseMet ? terms.clauseBonus : -terms.clauseMalus)
    + Math.max(0, Math.min(1, goalFraction)) * terms.goalPayout);
  return sponsorV2ScaleWithK(raw, rarity, terms.salaryFactor, terms.k);
}

/**
 * Die GARANTIERTE Rangleiter: Klausel verletzt, Sonderziel verfehlt. Genau diese Zahlen zeigt die
 * Karte als Gewinnstufen und genau aus ihnen zahlt das Settlement die Zeilen "Saisonbasis" und
 * "Tabellenplatz". Deshalb kann Anzeige und Settlement nicht auseinanderlaufen.
 */
export function sponsorV2GuaranteedLadder(terms: SponsorV2ContractTerms): number[] {
  return Array.from({ length: 32 }, (_, i) => sponsorV2Settle(terms, i + 1, false, 0));
}

/** Erwartungswert der Karte fuer die KI-Bewertung — inklusive Untergrenze, Klausel und Ziel. */
export function sponsorV2ExpectedPayout(terms: SponsorV2ContractTerms): number {
  const rarity = (RARITY_LABEL[terms.rarity] ?? "magisch") as SponsorV2Rarity;
  const card: SponsorV2Card = {
    rarity,
    profile: sponsorV2ProfileByName(terms.profileName),
    curve: curve(terms.curveName),
    clause: SPONSOR_V2_EVALUABLE_CLAUSES.find((c) => c.name === terms.clauseName)
      ?? { name: terms.clauseName, label: terms.clauseLabel, p: 0.5, s: 11, lever: "", evaluable: false, direction: "up" },
  };
  // Der EV wird direkt aus der eingefrorenen Leiter genommen statt neu kalibriert: die Leiter IST
  // das Ergebnis der Kalibrierung, und ein zweiter Rechenweg waere genau die Doppelquelle, die die
  // Invariante bricht.
  const params = paramsFor(card, terms.goalProbability);
  const w = sponsorV2ExpectedValueFromLadder(terms, params);
  return w;
}
function sponsorV2ExpectedValueFromLadder(terms: SponsorV2ContractTerms, params: SponsorV2Params): number {
  const center = 16.5 + (1 - 0.255) * (terms.expectedRank - 16.5);
  const weights: number[] = [];
  for (let r = 1; r <= 32; r += 1) weights.push(Math.exp(-((r - center) ** 2) / (2 * params.sigma * params.sigma)));
  const sum = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    const w = weights[r - 1]! / sum;
    for (const clauseMet of [true, false]) {
      for (const goalMet of [true, false]) {
        const p = (clauseMet ? params.pClause : 1 - params.pClause) * (goalMet ? params.pGoal : 1 - params.pGoal);
        acc += w * p * sponsorV2Settle(terms, r, clauseMet, goalMet ? 1 : 0);
      }
    }
  }
  return acc;
}

// ── Angebote mit V2-Konditionen bestuecken ─────────────────────────────────────────────────────
/**
 * Haengt jedem Angebot der Liste seine V2-Konditionen an und zieht die Cash-Komponenten nach, damit
 * die Karte und die Finanzprognose dieselben Zahlen sehen wie das Settlement.
 *
 * Die Komponentenliste bleibt in der bestehenden Form (base / rank / special), damit Anzeige,
 * Finanz-Sichten und die Modul-Ableitung unveraendert weiterlaufen. Nur die Betraege kommen jetzt
 * aus dem Modell. Die Klausel steckt in `sponsorV2` und nicht in den Komponenten — sie hat einen
 * MALUS, und dafuer gibt es in der Komponentenstruktur kein Feld.
 */
export function applySponsorV2ToOffers(input: {
  gameState: GameState; offers: SponsorOffer[]; expectedRank: number;
}): SponsorOffer[] {
  if (input.offers.length === 0) return input.offers;
  const curves = assignCurves(input.offers);
  return input.offers.map((offer, i) => {
    const terms = buildSponsorV2Terms({
      gameState: input.gameState, offer, expectedRank: input.expectedRank, curve: curves[i]!,
    });
    const ladder = sponsorV2GuaranteedLadder(terms);
    const floor = ladder[31]!;
    const topRank = ladder[0]!;
    const components = offer.components
      .filter((c) => c.kind === "base" || c.kind === "rank" || c.kind === "special")
      .map((c) => {
        if (c.kind === "base") return { ...c, rewardCash: round1(floor), penaltyCash: undefined };
        if (c.kind === "rank") return { ...c, rewardCash: round1(Math.max(0, topRank - floor)), targetValue: 1, penaltyCash: undefined };
        return { ...c, rewardCash: round1(terms.goalPayout) };
      });
    return { ...offer, components, sponsorV2: terms, totalUpsideEstimate: round1(topRank + terms.clauseBonus + terms.clauseMalus + terms.goalPayout) };
  });
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

// ── Settlement-Zerlegung ───────────────────────────────────────────────────────────────────────
export type SponsorV2SettlementPart = {
  key: "base" | "rank" | "clause" | "special";
  label: string;
  cashDelta: number;
  reason: string;
  met: boolean;
};

/**
 * Zerlegt die V2-Auszahlung in vier Zeilen, die sich per TELESKOPSUMME exakt auf den Modellwert
 * addieren. Jede Zeile ist eine Differenz echter Modellwerte — deshalb koennen Rundung, Untergrenze
 * und K-Skalierung die Summe nicht verfaelschen, egal an welcher Stelle sie greifen.
 */
export function sponsorV2SettlementParts(input: {
  terms: SponsorV2ContractTerms;
  finalRank: number | null;
  clauseMet: boolean;
  clauseAssumed: boolean;
  clauseMetric: number | null;
  goalFraction: number;
}): SponsorV2SettlementPart[] {
  const { terms, finalRank, clauseMet, goalFraction } = input;
  const atFloor = sponsorV2Settle(terms, 32, false, 0);
  const atRank = sponsorV2Settle(terms, finalRank, false, 0);
  const withClause = sponsorV2Settle(terms, finalRank, clauseMet, 0);
  const withGoal = sponsorV2Settle(terms, finalRank, clauseMet, goalFraction);
  const dir = terms.clauseDirection === "up" ? "≥" : "≤";
  return [
    {
      key: "base", label: "Saisonbasis (garantiert)", cashDelta: round1(atFloor), met: true,
      reason: `Sockel der Kurve ${terms.curveName} — zahlt auf jedem Endrang`,
    },
    {
      key: "rank", label: "Tabellenplatz", cashDelta: round1(atRank - atFloor), met: atRank > atFloor,
      reason: `Endrang ${finalRank ?? "—"} gegen Erwartung ${terms.expectedRank} (Kurve ${terms.curveName}, Profil ${terms.profileName})`,
    },
    {
      key: "clause", label: `Klausel: ${terms.clauseLabel}`, cashDelta: round1(withClause - atRank), met: clauseMet,
      reason: clauseMet
        ? `erfuellt${input.clauseAssumed ? " (angenommen — keine Datengrundlage)" : input.clauseMetric != null ? ` (${round1(input.clauseMetric)} ${dir} ${terms.clauseThreshold ?? "—"})` : ""}`
        : `verfehlt${input.clauseMetric != null ? ` (${round1(input.clauseMetric)} statt ${dir} ${terms.clauseThreshold ?? "—"})` : ""} — Malus ${round1(terms.clauseMalus)} C ist im Sockel bereits abgezogen`,
    },
    {
      key: "special", label: "Sonderziel", cashDelta: round1(withGoal - withClause), met: goalFraction > 0,
      reason: goalFraction >= 1
        ? `erreicht — Auszahlung ${round1(terms.goalPayout)} C bei Erfolgswahrscheinlichkeit ${Math.round(terms.goalProbability * 100)} %`
        : goalFraction > 0
          ? `teilweise erreicht (${Math.round(goalFraction * 100)} %)`
          : `verfehlt — ${round1(terms.goalPayout)} C nicht ausgezahlt`,
    },
  ];
}

/** Traegt ein Vertrag V2-Konditionen? Bestandsvertraege tun das nicht und werden nach altem Recht abgerechnet. */
export function getSponsorV2Terms(entry: SponsorOffer | TeamSponsorContract | null | undefined): SponsorV2ContractTerms | null {
  const terms = (entry as { sponsorV2?: SponsorV2ContractTerms } | null | undefined)?.sponsorV2;
  if (!terms || terms.version !== 2 || !Array.isArray(terms.rankLadder) || terms.rankLadder.length !== 32) return null;
  return terms;
}

export { SPONSOR_V2_RARITIES, sponsorV2ExpectedValue };
