/**
 * SPONSORSYSTEM V2: Angebotserzeugung, eingefrorene Konditionen und Abrechnung.
 *
 * Jedes fuer einen V2-Spielstand erzeugte Angebot bekommt einen
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

import { buildSponsorOfferModuleIds } from "@/lib/sponsor/sponsor-modules";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  SPONSOR_V2_CURVES, SPONSOR_V2_PROFILES, SPONSOR_V2_RARITIES,
  SPONSOR_V2_GOAL_MAX_SHARE, SPONSOR_V2_MIN_CLAUSE_EFFECT, SPONSOR_V2_MIN_GOAL_PAYOUT,
  SPONSOR_V2_MIN_LADDER_SPREAD,
  sponsorV2Calibrate, sponsorV2CardTargets, sponsorV2ClauseArms, sponsorV2EffectiveCard,
  sponsorV2ExpectedValue,
  sponsorV2FloorAt, sponsorV2GoalPayout, sponsorV2RankPart, sponsorV2RankDistribution, sponsorV2ScaleWithK,
  sponsorV2SolveLeagueK, sponsorV2TierOf, sponsorV2ProfileByName,
  type SponsorV2Card, type SponsorV2Curve, type SponsorV2CurveName, type SponsorV2Params, type SponsorV2Rarity,
} from "@/lib/sponsor/sponsor-v2-model";
import {
  SPONSOR_V2_EVALUABLE_CLAUSES, sponsorV2StrengthClassOf, sponsorV2ThresholdFor,
} from "@/lib/sponsor/sponsor-v2-clause-evaluator";

// ── Welches Sponsorsystem gilt? ────────────────────────────────────────────────────────────────
export type SponsorSystemVersion = 1 | 2;

/**
 * DIE VERSION, DIE JEDES NEU ANGELEGTE SPIEL BEKOMMT.
 *
 * Frueher stand hier ein Feature-Flag (`OLY_SPONSOR_V2`), das nur im Moment der Angebotserzeugung
 * zaehlte. Es ist ersatzlos entfallen: das neue Modell ist DAS Sponsorsystem. Wer im Browser auf
 * "Neues Spiel" klickt, bekommt es — ohne Umgebungsvariable, ohne Skript.
 *
 * Der Wert wird beim Anlegen EINMAL in den Spielstand geschrieben
 * (`seasonState.sponsorSystemVersion`) und ab da nur noch von dort gelesen. Diese Konstante ist
 * damit die Vorgabe fuer Neugeburten, nicht der Schalter fuer laufende Spielstaende.
 */
export const SPONSOR_SYSTEM_VERSION_FOR_NEW_GAMES: SponsorSystemVersion = 2;

/**
 * Welches Sponsorsystem gilt fuer DIESEN Spielstand?
 *
 * Einzige Quelle ist der Spielstand selbst. Fehlt der Vermerk, ist es ein vor der Umstellung
 * angelegter Save: der laeuft nach ALTEM Recht weiter und wird nie nachtraeglich umgestellt.
 * Deshalb steht hier `1` und nicht `SPONSOR_SYSTEM_VERSION_FOR_NEW_GAMES` — genau diese
 * Unterscheidung ist der Unterschied zwischen "abwaertskompatibel" und "kippt still".
 */
export function resolveSponsorSystemVersion(gameState: GameState): SponsorSystemVersion {
  return gameState.seasonState?.sponsorSystemVersion === 2 ? 2 : 1;
}

/**
 * Setzt den Versionsvermerk beim ANLEGEN eines Spielstands. Idempotent und nicht ueberschreibend:
 * traegt der Save schon einen Vermerk, bleibt er stehen — ein bestehendes V1-Spiel darf durch
 * keinen spaeteren Aufruf auf V2 rutschen.
 */
export function stampSponsorSystemVersion(
  gameState: GameState,
  version: SponsorSystemVersion = SPONSOR_SYSTEM_VERSION_FOR_NEW_GAMES,
): GameState {
  if (gameState.seasonState?.sponsorSystemVersion === 1 || gameState.seasonState?.sponsorSystemVersion === 2) {
    return gameState;
  }
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, sponsorSystemVersion: version },
  };
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
  /**
   * DIE UNTERGRENZE DIESER KARTE, eingefroren wie alles andere.
   *
   * Frueher rechnete das Settlement sie bei jedem Aufruf neu aus `rarity` aus — eine reine
   * Rarity-Konstante (35..42 C). Bei Karten, deren Ziel-Erwartungswert selbst nur bei 45 C lag,
   * verschluckte diese Konstante die gesamte Rangleiter. Sie ist jetzt kartenindividuell und wird
   * beim Bau so weit gesenkt, wie es braucht, damit Rangleiter, Klausel und Sonderziel sichtbar
   * bleiben. Fehlt das Feld (Vertraege aus der Zeit davor), gilt die alte Rarity-Untergrenze.
   */
  floor?: number;
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
  // NACHGETRAGEN nach dem ersten Live-Lauf: die Tabelle stammte aus einem Entwurfsdokument und
  // deckte nur 22 Schluessel ab, die Engine vergibt aber 26 Bonus- und 6 Golden-Ziele. Alle nicht
  // gelisteten liefen auf den Default 0.45 — die Zusage "Sonderziel nach Schwierigkeit" waere fuer
  // sie stillschweigend nicht eingeloest gewesen. Die folgenden Werte sind DESIGN-SCHAETZUNGEN in
  // derselben Groessenordnung wie die Nachbarziele derselben Familie, nicht gemessen.
  fan_cult_player: [0.50, 0.48, 0.45],
  rival_humiliation: [0.42, 0.40, 0.35],
  sustainability_architect: [0.45, 0.48, 0.50],
  discipline_specialist: [0.50, 0.48, 0.44],
  facility_condition: [0.60, 0.52, 0.40],
  golden_fairytale: [0.20, 0.15, 0.10],
  golden_crowd_favorites: [0.30, 0.28, 0.25],
  golden_discipline_monopoly: [0.22, 0.15, 0.10],
  golden_rival_deluxe: [0.25, 0.22, 0.18],
  // CHALLENGE-SPEZIALE (genau ein Slot je Team traegt eines davon). Im Entwurfsdokument fehlten sie
  // ganz; der Live-Lauf hat sie sichtbar gemacht — 48 von 160 Angeboten liefen auf den Default.
  // Geschaetzt jeweils in der Groessenordnung des thematisch naechsten Standardziels.
  axis_rank_top: [0.49, 0.45, 0.41],
  salary_pressure_max: [0.385, 0.52, 0.625],
  form_color_cover: [0.50, 0.50, 0.465],
  transfer_profit_min: [0.50, 0.48, 0.435],
  discipline_top3_count: [0.485, 0.30, 0.15],
};
/** Alle Schluessel, fuer die eine Schwierigkeits-Schaetzung vorliegt — fuer die Abdeckungsmessung. */
export const SPONSOR_V2_PRICED_GOAL_KEYS: readonly string[] = Object.keys(GOAL_PROBABILITY);
/** Default fuer Ziele ohne Eintrag. Wer diesen Wert sieht, sieht KEINE Schwierigkeits-Bepreisung. */
export const SPONSOR_V2_GOAL_P_DEFAULT = 0.45;
/** Band, in dem ein Ziel ueberhaupt bepreisbar ist: darueber trivial, darunter Frust. */
const GOAL_P_MIN = 0.15;
const GOAL_P_MAX = 0.72;
export function sponsorV2GoalProbability(specialKey: string | null | undefined, expectedRank: number): number {
  const row = specialKey ? GOAL_PROBABILITY[specialKey] : undefined;
  const raw = row ? row[sponsorV2StrengthClassOf(expectedRank)]! : SPONSOR_V2_GOAL_P_DEFAULT;
  return Math.min(GOAL_P_MAX, Math.max(GOAL_P_MIN, raw));
}

// ── Liga-K ─────────────────────────────────────────────────────────────────────────────────────
const kCache = new Map<string, number>();

/**
 * REFERENZ-GEHALT JE TEAM, wenn die Liga noch keine echten Gehaelter fuehrt.
 *
 * GEMESSENER BEFUND aus dem ersten Live-Lauf, und ein echter Fehler: in einem FRISCH erzeugten
 * Spiel ist die Gehaltssumme der Liga 0 — die Sponsorangebote entstehen beim Anlegen des Spiels,
 * die Spielervertraege bekommen ihre Gehaelter aber erst im Draft danach. K wurde dadurch gegen
 * eine Zielsumme von 0 geloest, fiel auf ~0, und JEDE Karte kollabierte in die Untergrenze: die
 * Auszahlungsleiter war ueber alle 32 Raenge flach 37 C, Tabellenplatz und Sonderziel zahlten
 * nichts. Das Spiel waere spielbar gewesen und wirtschaftlich tot.
 *
 * Der alte Pfad hat dieses Problem nicht, weil sein Anker `getSponsorRank32BaseAnchorSalary` mit
 * `Math.max(SPONSOR_BASE_FLOOR_C, ...)` nach unten abgesichert ist. V2 bekommt dieselbe
 * Absicherung: liegt die gemessene Gehaltssumme unter einem Viertel der Referenz, ist die
 * Kader-Oekonomie noch nicht initialisiert und die Referenz wird benutzt.
 *
 * 64.9 C je Team ist der gemessene S1-Schnitt aus einem echten Save (Summe 2078 bei 32 Teams,
 * `SALARY_SUM_S1` in scripts/sponsor-model-params.ts).
 */
export const SPONSOR_V2_REFERENCE_SALARY_PER_TEAM = 64.9;

/**
 * Gehaltssumme, gegen die K geloest wird — mit Plausibilitaetsschranke.
 * Gibt zusaetzlich zurueck, ob die Referenz gegriffen hat, damit der Live-Check das ausweisen kann
 * statt es zu verschlucken.
 */
export function sponsorV2LeagueSalaryBasis(gameState: GameState): { salarySum: number; usedReference: boolean } {
  const measured = gameState.teams.reduce((a, t) => a + getTeamDisplaySalaryTotal(gameState, t.teamId), 0);
  const reference = Math.max(1, gameState.teams.length) * SPONSOR_V2_REFERENCE_SALARY_PER_TEAM;
  if (measured >= reference * 0.25) return { salarySum: measured, usedReference: false };
  return { salarySum: reference, usedReference: true };
}

/**
 * Ex-ante geloestes K der laufenden Saison. Siehe Kopfkommentar zur Naeherung.
 * Gecacht je (Saison, Ligajahr-Faktor, gerundete Gehaltssumme) — sonst laeuft die Bisektion bei
 * jedem der 160 erzeugten Angebote neu.
 */
export function sponsorV2SeasonK(gameState: GameState): number {
  const salaryFactor = getSalaryFactor(gameState);
  const { salarySum } = sponsorV2LeagueSalaryBasis(gameState);
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
    // Die Referenzliga rechnet mit DENSELBEN Regeln wie die echten Karten: vereinbarte
    // Rarity-Untergrenze und Sonderziel aus den Kartenzielen — sonst loest K gegen eine Liga,
    // die es so nicht gibt.
    const targets = sponsorV2CardTargets(card.rarity, profile, sponsorV2TierOf(expectedRank));
    const params: SponsorV2Params = {
      ...paramsFor(card, 0.45),
      floor: sponsorV2FloorAt(card.rarity, 1.0),
      goalPayout: sponsorV2GoalPayout(targets.special, 0.45),
    };
    return { card, expectedRank, cal: sponsorV2Calibrate(card, expectedRank, params), params };
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
  const { profile, clause: rawClause } = pickProfileAndClause(input.offer.offerId);
  const rarity = rarityOf(input.offer);
  const goalKey = input.offer.components.find((c) => c.kind === "special")?.specialKey ?? null;
  const goalProbability = sponsorV2GoalProbability(goalKey, input.expectedRank);

  // ── Modul-Budget kleiner Karten (Vorgabe des Auftraggebers: "auch wenn bei kleineren sponsoren
  // dann bonuszahlungen usw geringer ausfallen muss es eine flachere spreizung geben") ──────────
  // Klausel-Bonus und Sonderziel zahlen OBERHALB der Untergrenze; ihr Erwartungswert ist damit ein
  // Sockel, den KEINE Kalibrierung unterschreiten kann: kleinster Karten-EV = Untergrenze +
  // P*Bonus + P_Ziel*Zielgeld. Liegt der Ziel-EV der Karte darunter, laeuft die Bisektion an den
  // Rand und die Leiter klemmt flach auf der Untergrenze (gemessen: gewoehnlich/zielbetont
  // Stufe 8 = 41,2 C Ziel-EV gegen 35 + 7,6 C Modul-EV). Weil Untergrenze 35 und die
  // Ziel-EV-Leiter beide gesetzt sind, gibt hier das MODUL-BUDGET nach — offen, nicht still:
  // Klausel-Spannweite und Sonderziel-Anteil werden gemeinsam so skaliert, dass der Rangleiter
  // mindestens LADDER_AIR Erwartungswert ueber der Untergrenze bleibt.
  const effective = sponsorV2EffectiveCard(
    { rarity, profile, curve: input.curve, clause: rawClause }, input.expectedRank, goalProbability,
  );
  const card = effective.card;
  const clause = card.clause;
  const arms = sponsorV2ClauseArms(clause, clause.p);
  const salaryFactor = getSalaryFactor(input.gameState);
  const k = sponsorV2SeasonK(input.gameState);

  const base = {
    version: 2 as const,
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
    goalProbability,
    goalKey,
    salaryFactor,
    k,
  };

  // ── Kalibrierung unter der 15-%-Obergrenze, bei VEREINBARTER Untergrenze ─────────────────────
  // Die Untergrenze bleibt die Rarity-Konstante 35/37/39/42 — sie ist eine zugesagte Garantie und
  // wird nicht mehr je Karte abgesenkt (das loeste den Kollaps, garantierte aber nur noch
  // 10,0-34,5 C und liess Karten derselben Rarity um Faktor 2,2 auseinanderlaufen). Der Kollaps
  // ist stattdessen an der Wurzel behoben:
  //   1. der Ziel-EV haelt Mindest-Luft ueber der Untergrenze (SPONSOR_V2_TARGET_FLOOR_HEADROOM),
  //   2. Klausel-Bonus und Sonderziel zahlen OBERHALB der Untergrenze (sponsorV2RawPayout),
  //   3. zu flache Leitern werden EV-neutral in Richtung Spitze aufgekippt (unten).
  // Sonderziel und Leiter haengen zirkulaer voneinander ab (weniger Zielgeld -> Nachkalibrierung
  // hebt die Leiter -> der Deckel wird lockerer); der kurze Fixpunkt kappt immer gegen den
  // UNGEKAPPTEN Startwert, damit nichts nach unten ratscht, und kalibriert in jedem Durchgang mit
  // GENAU dem Zielgeld, das die Karte auszahlt — das gekappte Geld wandert in die Rangleiter,
  // der Karten-EV bleibt auf Paritaet.
  const floor = sponsorV2FloorAt(rarity, 1.0);
  const goalStart = effective.goalPayout;
  let goalPayout = goalStart;
  const kEff = Math.max(0.05, k);
  let cal = 0;

  const buildAt = (gp: number, ladder?: number[]): SponsorV2ContractTerms => ({
    ...base,
    rankLadder: ladder ?? Array.from({ length: 32 }, (_, i) => sponsorV2RankPart(card, input.expectedRank, i + 1, cal)),
    goalPayout: gp,
    // Die VEREINBARTE Untergrenze, mit dem Vertrag eingefroren: aendert sich die Regel je, rechnen
    // Anzeige und Abrechnung alter Vertraege trotzdem weiter mit der Zusage von damals.
    floor,
  });

  for (let pass = 0; pass < 4; pass += 1) {
    const params: SponsorV2Params = { sigma: 6.6, pClause: clause.p, pGoal: goalProbability, floor, goalPayout };
    cal = sponsorV2Calibrate(card, input.expectedRank, params);
    // Auszahlung auf dem Erwartungsrang, Klausel erfuellt, Ziel verfehlt — NACH K, wie angezeigt.
    const paidNoGoal = sponsorV2Settle(buildAt(0), input.expectedRank, true, 0);
    // g / (paidNoGoal + g) <= SHARE  <=>  g <= paidNoGoal * SHARE / (1 - SHARE); zurueck vor K.
    const capRaw = (paidNoGoal * SPONSOR_V2_GOAL_MAX_SHARE) / (1 - SPONSOR_V2_GOAL_MAX_SHARE) / kEff;
    const next = Math.min(goalStart, capRaw);
    if (Math.abs(next - goalPayout) < 0.05) { goalPayout = next; break; }
    goalPayout = next;
  }

  // ── Korridor-Leiter: Spreizung dort, wo das Team landen kann; darueber flach ─────────────────
  // Vorgabe des Auftraggebers, woertlich: "ein platz 32 team kann ja auch ne spreizung bis platz
  // 24 oder so haben und ab da flat nach oben". Das entspricht dem, was echte Sponsorvertraege
  // tun (Grundbetrag + Boni fuer die REALISTISCHEN Ziele des Klubs, kein Preis je Tabellenplatz
  // ueber die ganze Liga) und loest den arithmetischen Konflikt am Tabellenende: bei Untergrenze
  // 35 und Ziel-EV ~49 ist keine Spreizung ueber alle 32 Raenge finanzierbar — wohl aber eine
  // ueber den erreichbaren Korridor, weil das Budget dort konzentriert wird, wo es Wirkung hat.
  //
  // Umsetzung in drei Schritten, alle EV-erhaltend (die Paritaet ist die Geschaeftsgrundlage):
  //   1. KAPPEN: oberhalb von Erwartungsrang − 8 wird die Leiter flach auf den Korridor-Bestwert
  //      gesetzt. Der Titel aus dem Keller zahlt damit so viel wie der Korridor-Bestplatz — nicht
  //      weniger (Monotonie), aber auch kein Lotteriegewinn mehr.
  //   2. RUECKVERTEILEN: der erwartungsgewichtete EV, den das Kappen freisetzt, geht als
  //      konstanter Sockel auf alle Raenge zurueck — das Kappen finanziert die Korridor-Leiter.
  //   3. AUFKIPPEN: reicht die Spreizung im Korridor trotzdem nicht (dreifach flache Kombis wie
  //      Halten x sockellastig), wird INNERHALB des Korridors EV-neutral gekippt, bis die
  //      Mindestspreizung steht. Der Kipp ist monoton und oberhalb des Korridors konstant, die
  //      Leiter bleibt also flach-oben und nirgends fallend.
  const corridorIdx = Math.max(0, Math.round(input.expectedRank) - 8 - 1);
  let rankLadder = Array.from({ length: 32 }, (_, i) => sponsorV2RankPart(card, input.expectedRank, i + 1, cal));
  const weights = sponsorV2RankDistribution(input.expectedRank);
  if (corridorIdx > 0) {
    const top = rankLadder[corridorIdx]!;
    const clamped = rankLadder.map((v, i) => (i < corridorIdx ? top : v));
    const freed = rankLadder.reduce((a, v, i) => a + (v - clamped[i]!) * weights[i]!, 0);
    rankLadder = clamped.map((v) => v + freed);
  }
  // Anteil des Kipps, den die EV-Zentrierung gleich wieder abzieht — daraus folgt, wie stark
  // gekippt werden muss, damit netto die Mindestspreizung ankommt.
  const span = 31 - corridorIdx;
  const tiltShape = Array.from({ length: 32 }, (_, i) => (31 - Math.max(i, corridorIdx)) / span);
  const tiltMeanShare = weights.reduce((a, w, i) => a + w * tiltShape[i]!, 0);
  const guaranteedAt = (ladder: number[], idx: number): number =>
    sponsorV2ScaleWithK(Math.max(floor, ladder[idx]! - arms.malus), rarity, salaryFactor, k);
  for (let pass = 0; pass < 4; pass += 1) {
    const spread = guaranteedAt(rankLadder, corridorIdx) - guaranteedAt(rankLadder, 31);
    // Zielwert MIT Reserve: die Abnahme-Invariante fordert >= MIN, der Kipp muss also OBERHALB
    // landen, nicht in Rundungsnaehe darunter (gemessen: 3 Karten bei 11,95-11,99 C).
    if (spread >= SPONSOR_V2_MIN_LADDER_SPREAD + 0.2) break;
    const deficit = (SPONSOR_V2_MIN_LADDER_SPREAD + 0.5 - spread) / kEff / Math.max(0.25, 1 - tiltMeanShare);
    const tilt = tiltShape.map((t) => deficit * t);
    const tiltMean = tilt.reduce((a, t, i) => a + t * weights[i]!, 0);
    rankLadder = rankLadder.map((v, i) => v + tilt[i]! - tiltMean);
  }
  let terms = buildAt(goalPayout, rankLadder);

  // ── Die 15-%-Obergrenze, exakt statt geschaetzt ──────────────────────────────────────────────
  // Der Anteil wird an der FERTIGEN Karte gemessen und der Ziel-Betrag per Bisektion auf den
  // groessten Wert gezogen, der ihn noch einhaelt. Die Naeherung `Deckel / k` davor stimmt nur,
  // solange beide Vergleichspunkte ueber der Untergrenze liegen — genau daran ist sie bei
  // einzelnen Karten um Zehntel gerissen. Bisektion kennt diesen Sonderfall nicht.
  const shareOf = (gp: number): number => {
    const t = { ...terms, goalPayout: gp };
    const withGoal = sponsorV2Settle(t, input.expectedRank, true, 1);
    return withGoal > 0 ? (withGoal - sponsorV2Settle(t, input.expectedRank, true, 0)) / withGoal : 0;
  };
  if (shareOf(goalPayout) > SPONSOR_V2_GOAL_MAX_SHARE) {
    let lo = 0;
    let hi = goalPayout;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (shareOf(mid) <= SPONSOR_V2_GOAL_MAX_SHARE) lo = mid; else hi = mid;
    }
    goalPayout = lo;
    terms = { ...terms, goalPayout };
  }
  return terms;
}

/** Die vier harten Schranken einer fertigen Karte — GEMESSEN an den Betraegen, die sie auszahlt. */
export type SponsorV2CardInvariantReport = {
  /** Abstand Meister -> Platz 32 auf der garantierten Leiter. */
  ladderSpread: number;
  /** Wirkung der Klausel auf dem Erwartungsrang (Bonus + Malus, nach Untergrenze und K). */
  clauseEffect: number;
  /** Was das Sonderziel auf dem Erwartungsrang zusaetzlich einbringt. */
  goalPayout: number;
  /** Anteil des Sonderziels an der Gesamtauszahlung auf dem Erwartungsrang. */
  goalShare: number;
  /** Faellt die Auszahlung ueber die Raenge nirgends nach oben aus? */
  monotone: boolean;
  ok: boolean;
  violations: string[];
};

/**
 * DIE ABNAHMEBEDINGUNG, an EINER Stelle. Die Angebotserzeugung setzt sie durch, der Kartenraum-Test
 * prueft mit derselben Funktion nach — es gibt also keine zweite Lesart davon, was "in Ordnung" heisst.
 */
export function sponsorV2CardInvariants(terms: SponsorV2ContractTerms): SponsorV2CardInvariantReport {
  const ladder = sponsorV2GuaranteedLadder(terms);
  const ladderSpread = (ladder[0] ?? 0) - (ladder[31] ?? 0);
  const paidNoGoal = sponsorV2Settle(terms, terms.expectedRank, true, 0);
  const paidWithGoal = sponsorV2Settle(terms, terms.expectedRank, true, 1);
  const clauseEffect = paidNoGoal - sponsorV2Settle(terms, terms.expectedRank, false, 0);
  const goalPayout = paidWithGoal - paidNoGoal;
  const goalShare = paidWithGoal > 0 ? goalPayout / paidWithGoal : 0;
  let monotone = true;
  for (let i = 1; i < 32; i += 1) if ((ladder[i] ?? 0) > (ladder[i - 1] ?? 0) + 1e-6) monotone = false;
  const violations: string[] = [];
  if (ladderSpread < SPONSOR_V2_MIN_LADDER_SPREAD - 1e-6) violations.push(`Rangleiter zu flach (${ladderSpread.toFixed(1)} C)`);
  if (clauseEffect < SPONSOR_V2_MIN_CLAUSE_EFFECT - 1e-6) violations.push(`Klausel ohne Wirkung (${clauseEffect.toFixed(1)} C)`);
  if (goalPayout < SPONSOR_V2_MIN_GOAL_PAYOUT - 1e-6) violations.push(`Sonderziel ohne Wirkung (${goalPayout.toFixed(1)} C)`);
  if (goalShare > SPONSOR_V2_GOAL_MAX_SHARE + 1e-6) violations.push(`Sonderziel ${(goalShare * 100).toFixed(0)} % der Karte`);
  if (!monotone) violations.push("Auszahlung nicht monoton ueber die Raenge");
  return { ladderSpread, clauseEffect, goalPayout, goalShare, monotone, ok: violations.length === 0, violations };
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
  // Die EINGEFRORENE Untergrenze der Karte. Vertraege aus der Zeit vor der kartenindividuellen
  // Untergrenze tragen das Feld nicht und werden weiter nach der Rarity-Konstante abgerechnet —
  // sie wurden unter dieser Zusage unterschrieben.
  const fl = typeof terms.floor === "number" && Number.isFinite(terms.floor)
    ? terms.floor
    : sponsorV2FloorAt(rarity, 1.0);
  // Die Untergrenze schuetzt den RANGTEIL und frisst den Klausel-Malus (akzeptierter offener
  // Punkt 3: am Tabellenende kein Abwaertsrisiko). Klausel-BONUS und SONDERZIEL zahlen IMMER
  // obendrauf. Vorher lagen sie mit im max(): fuer Kellerteams mit spitzenlastigen Kurven
  // verschluckte die Untergrenze verdiente Boni — auf dem Settlement-Screen stand
  // "Klausel 0,0 · Sonderziel 0,0", obwohl Klausel erfuellt und Ziel erreicht waren (113 tote
  // Module in 480 echt erzeugten Karten). Identisch zu sponsorV2RawPayout im Modell. Das
  // eingefrorene `terms.floor` (Vertraege aus dem Zeitfenster der kartenindividuellen
  // Untergrenze) wird weiter honoriert.
  const raw = Math.max(fl, (terms.rankLadder[idx] ?? 0) - (clauseMet ? 0 : terms.clauseMalus))
    + (clauseMet ? terms.clauseBonus : 0)
    + Math.max(0, Math.min(1, goalFraction)) * terms.goalPayout;
  return sponsorV2ScaleWithK(raw, rarity, terms.salaryFactor, terms.k, fl);
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
  gameState: GameState;
  offers: SponsorOffer[];
  /** Modellkurve je Angebot, in derselben Reihenfolge. Kommt aus dem Slate-Wurf der Erzeugung. */
  curveNames: SponsorV2CurveName[];
  expectedRank: number;
}): SponsorOffer[] {
  if (input.offers.length === 0) return input.offers;
  return input.offers.map((offer, i) => {
    const terms = buildSponsorV2Terms({
      gameState: input.gameState,
      offer,
      expectedRank: input.expectedRank,
      curve: curve(input.curveNames[i] ?? "Linear"),
    });
    const ladder = sponsorV2GuaranteedLadder(terms);
    const floor = ladder[31]!;
    const topRank = ladder[0]!;
    // Die Komponenten kommen als GERUEST ohne Betraege herein (siehe buildOfferSkeleton). Hier — und
    // nur hier — bekommen sie ihre Zahlen. `penaltyCash` bleibt ueberall leer: den Malus traegt in V2
    // ausschliesslich die Klausel, und ein persistierter Komponenten-Malus waere eine Anzeige, die das
    // Settlement nie einloest.
    const components = offer.components.map((c) => {
      // `rewardCash` der Basis BEWUSST UNGERUNDET: die Gewinnstufen-Leiter der Karte rechnet
      // `baseCash + (Leiterwert − Leiterboden)`. Ist `baseCash` schon auf eine Nachkommastelle
      // gerundet, der Leiterboden aber nicht, weicht die angezeigte Sprosse um bis zu 0,1 C von dem
      // ab, was das Settlement zahlt — genau daran ist die Anzeige==Settlement-Pruefung gerissen
      // ("Top 28": 34,2 angezeigt, 34,1 gezahlt). Gerundet wird erst bei der Ausgabe. `targetValue`
      // ist reine Beschriftung und bleibt gerundet.
      if (c.kind === "base") return { ...c, targetValue: round1(floor), rewardCash: floor, penaltyCash: undefined };
      if (c.kind === "rank") {
        return {
          ...c,
          label: `Gewinnstufen nach Endrang · Kurve ${terms.curveName}`,
          rewardCash: round1(Math.max(0, topRank - floor)),
          targetValue: 1,
          penaltyCash: undefined,
        };
      }
      return { ...c, rewardCash: round1(terms.goalPayout), penaltyCash: undefined };
    });
    const next: SponsorOffer = {
      ...offer,
      components,
      sponsorV2: terms,
      totalUpsideEstimate: round1(topRank + terms.clauseBonus + terms.clauseMalus + terms.goalPayout),
    };
    return { ...next, moduleIds: buildSponsorOfferModuleIds(next) };
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
