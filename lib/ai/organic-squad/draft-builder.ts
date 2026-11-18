/**
 * Organic marginal-utility squad builder — the greedy loop (Master-Plan P2 core).
 *
 * See docs/design/draft-composition-organic-masterplan.md §3. PURE function: given a team's economic
 * state + weights + a pool of available free agents, it greedily picks the highest-utility action
 * (buy best affordable / stop) each step, RE-COMPUTING discipline coverage after every buy so the
 * coverage curve damps further buys in an already-covered discipline. Composition emerges here — no
 * slot quotas. The only hard blockers: roster ∈ [ROSTER_MIN, ROSTER_MAX] and cash ≥ cashBuffer.
 *
 * Nothing here reads gameState or mutates anything — the adapter/wiring (separate, flag-gated) builds
 * the inputs and applies the returned decisions.
 */

import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import { classifyCompositionLane } from "@/lib/ai/organic-squad/composition-plan";
import { computeDisciplineNeeds, deriveNeedAxisWeights } from "@/lib/ai/organic-squad/discipline-need";
import {
  ROSTER_MAX,
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicPlayerView,
  type OrganicTeamState,
  type OrganicUtilityWeights,
} from "@/lib/ai/organic-squad/types";
import { buyUtility, computeCoreAxisPeakQuality, stopUtility } from "@/lib/ai/organic-squad/utility";
import { draftUnit } from "@/lib/ai/market-pick-engine/slot-sequence";
import type { LeagueMarketBrackets, MarketBracketLane } from "@/lib/ai/market-pick-engine/market-brackets";

/**
 * Small additive jitter (in buyUtility units) applied ONLY inside the greedy buy comparison, keyed by
 * `${draftSeed}:${playerId}` (hash-based, reproducible — no Math.random). It exists SOLELY to break
 * near-ties between similarly-attractive candidates so different save/team seeds can land on different
 * (but comparably good) picks — composition variance across saves, not randomness overriding the
 * model. It must never be large enough to flip a clear preference: a genuinely better candidate always
 * wins regardless of jitter amplitude choice by the caller. Default 15 (calibrated): a draft-run sweep
 * showed ~80% roster-slot variance across seeds at amplitude 20 while every team's IDENTITY held (same
 * roster sizes, MW tiers, GM character) and the draft audit stayed PASS — 15 keeps that strong
 * different-players-same-team-character variety with a touch more headroom for genuinely-better picks.
 * The jitter only ever engages when a `draftSeed` is passed (real runs, keyed `saveId:teamId`); pure
 * unit tests pass no seed, so they stay deterministic regardless of this amplitude. ENV-tunable (set 0
 * to disable, higher for more spread).
 */
const ORGANIC_DRAFT_JITTER = Number(process.env.OLY_ORGANIC_DRAFT_JITTER ?? 15) || 0;

/**
 * KADERPLAN (KI-Pick-Analyse 18.11., docs/design/ki-pick-analyse-18-11.md). Im Saison-1-Setup-Draft STANDARD AN;
 * `OLY_KI_KADERPLAN=0` schaltet ab. Ob ein Plan mit Kaderplan laeuft, entscheidet NICHT dieser reine Builder, sondern der Adapter
 * (`istKaderplanAktiv(gameState)` in draft-adapter.ts: Schalter UND Saison 1) und setzt dafuer `input.kaderplan`. Ab Saison 2 ist
 * er aus, weil der Gehaltstopf (`salaryCap`) ueber dem Minimum die Gehaltsseite der Plaetze bis Opt noch nicht reserviert
 * (Review-Befund S3, kommt mit der S2-Umstellung). Ohne `input.kaderplan` ist der Builder bit-gleich zum Stand vor dem Kaderplan.
 * Drei Aenderungen am Kaufschritt, sonst dieselbe Bewertung:
 *
 *  1. PLATZ-RESERVE BIS ZUM ZIELKADER. Gemessen (32 KI-Teams, frisches Spiel): 29 von 32 Teams endeten 1 bis 3 Spieler
 *     UNTER ihrem Zielkader (Opt), fast alle mit `nothing_affordable` — die Kasse war an der Ruecklage angekommen, bevor
 *     alle geplanten Plaetze besetzt waren. Die Schleife reservierte nur fuer das Minimum 8, nicht fuer die geplanten
 *     Plaetze darueber. Jetzt reserviert jeder Kauf unter Opt die restlichen geplanten Plaetze zu einem Platzpreis
 *     (die billigsten Spieler ab `KADERPLAN_PLATZ_MIN_MW`, also keine Fueller), soweit die Kasse das traegt; Plaetze, die sie
 *     so nicht traegt, zum Preis der billigsten Spieler; und traegt sie auch das nicht, nur so viele Plaetze, wie sie traegt
 *     (Review S1: nie weniger kaufen als ohne Kaderplan). Die Wahl bleibt die beste Bewertung aus dem GANZEN Pool.
 *     Fueller unter dem Platzpreis kommen nur, wenn kein Spieler ab Platzpreis durch alle Schranken passt.
 *  2. KEIN BILLIGSTER-SPIELER-NOTWEG. Wo die Schleife bisher unter dem Pflichtkader den billigsten Spieler nahm
 *     (Auffangnetz #1618), nimmt sie jetzt den BESTBEWERTETEN bezahlbaren — dieselbe Bewertung wie jeder Kauf, nur mit
 *     gelockerter Schranke (Topf darf ueberzogen werden, Kasse nicht).
 *  3. UEBER DEM ZIELKADER keine Fueller unter dem Platzpreis (Review S5); hat der GM den Zielkader bewusst gesenkt
 *     („weniger, dafuer staerker"), hoert das Team am gesenkten Zielkader auf, statt die Senkung ueber Opt wieder aufzuheben.
 */
export function istKaderplanSchalterAn(): boolean {
  return process.env.OLY_KI_KADERPLAN !== "0";
}
/** Kaderplan-Einstellung eines Plans (nur der Adapter setzt sie; fehlt sie, laeuft der Plan ohne Kaderplan). */
export type KaderplanEinstellung = {
  /** Der GM hat den Zielkader bewusst gesenkt: am (gesenkten) Opt aufhoeren statt darueber weiterzukaufen (Review S5). */
  gmOptGesenkt?: boolean;
};
function kaderplanAn(input: OrganicSquadPlanInput): boolean {
  return input.kaderplan != null;
}
/**
 * Messschalter: Platzpreis aus dem STARTPOOL des Drafts (`OLY_KI_KADERPLAN_STARTPOOL=1`) statt aus dem aktuellen Pool (Standard).
 * Gemessen 18.11. (Doku 5.2): der Startpool macht Block und Einzelschritt gleich, aber beide mit 56–66 Fuellern, weil die Reserve
 * mit 12er-Preisen rechnet, die andere Teams laengst gekauft haben — die letzten Plaetze passen dann nur noch mit Fuellern.
 * Der aktuelle Pool ist die ehrliche (immer hoehere) Rechnung; seit die Fueller-Sperre „immer" gilt und die nicht zum Platzpreis
 * getragenen Plaetze billig reserviert werden, braucht der Einzelschritt den Startpool nicht mehr.
 */
export function istKaderplanStartpoolAktiv(): boolean {
  return process.env.OLY_KI_KADERPLAN_STARTPOOL === "1";
}
/**
 * Messschalter Fueller-Sperre: `immer` (Standard) = unter Opt zuerst nur Spieler ab Platzpreis, Fueller nur, wenn kein
 * solcher durch alle Schranken passt; `rahmen` = Sperre nur, solange der Rahmen alle Plaetze bis Opt zum Platzpreis traegt.
 */
function fuellerSperreImmer(): boolean {
  return process.env.OLY_KI_KADERPLAN_FUELLER !== "rahmen";
}
/** Platzpreis-Untergrenze der Reserve: Backup-Stufe der Liga (12). Darunter liegen die Fueller (Reserve-Stufe). */
export const KADERPLAN_PLATZ_MIN_MW = 12;

/**
 * Reserve fuer `count` weitere geplante Plaetze: Summe der billigsten Preise ab `KADERPLAN_PLATZ_MIN_MW` (gibt es zu wenige,
 * zaehlen die billigsten uebrigen). `sortiertePreise` aufsteigend.
 */
function platzReserve(sortiertePreise: number[], count: number, wettbewerb = 1): number {
  if (count <= 0) return 0;
  let sum = 0;
  let n = 0;
  // Mit Wettbewerb (Einzelschritt: T Teams picken reihum) ist der i-te eigene Platz erst nach i x T fremden Picks dran; im
  // schlechtesten Fall sind die billigsten davor weg. Deshalb jeder T-te Preis ab Platzpreis statt der n billigsten.
  // Review K2: `Math.max(1, NaN)` ist NaN — ein ungueltiger Wettbewerb zaehlt wie 1.
  const schritt = Number.isFinite(wettbewerb) ? Math.max(1, Math.floor(wettbewerb)) : 1;
  let index = 0;
  for (const p of sortiertePreise) {
    if (p < KADERPLAN_PLATZ_MIN_MW) continue;
    index += 1;
    if (index % schritt !== 0) continue;
    sum += p;
    n += 1;
    if (n >= count) return sum;
  }
  for (const p of sortiertePreise) {
    if (p >= KADERPLAN_PLATZ_MIN_MW) break;
    if (n >= count) break;
    sum += p;
    n += 1;
  }
  return sum;
}

export type OrganicBuyDecision = {
  playerId: string;
  /** 0-based order in which this buy was chosen. */
  step: number;
  /** The buy utility at the moment it was chosen (for the decision log / diagnostics). */
  utility: number;
};

export type OrganicSquadPlanInput = {
  /** Players already on the roster at the start (their disciplines count toward coverage). */
  startingSquad: OrganicPlayerView[];
  /** Available free agents to choose from. */
  candidates: OrganicPlayerView[];
  /** Team playstyle axis emphasis (from identity.pow/spe/men/soc), any scale — normalized internally. */
  identityAxisWeights: Record<CoreAxis, number>;
  /** Discipline catalog (id + category) for coverage/need recomputation. */
  disciplines: OrganicDiscipline[];
  economy: {
    cash: number;
    cashBuffer: number;
    salaryTotal: number;
    /** 0..1 board pressure (cash is more precious when high). */
    boardRisk: number;
    /** Forecast planning inputs held constant across the plan (per-season, not per-pick). */
    expectedPrize: number;
    sponsorIncome: number;
    facilityNet: number;
    netTransfer: number;
    weights: OrganicUtilityWeights;
    /** Hard upper roster bound, defaults to ROSTER_MAX (14); pass a team-specific max if smaller. */
    rosterMax?: number;
    /** Hard lower roster bound, defaults to ROSTER_MIN (8). */
    rosterMin?: number;
    /**
     * Small flat solvency floor kept while filling the squad from min UP TO opt. Below this the reserve
     * (cashBuffer) is treated as SPENDABLE toward the opt target rather than a hard hold — the club
     * spends its salary-scaled reserve to build the squad it wants and refills it from income over later
     * seasons (user model: "die Reserve muss auch mal ausgegeben werden, kann später aufgefüllt werden").
     * Only ABOVE opt does the full cashBuffer hold again. Defaults to cashBuffer (i.e. the old behaviour:
     * reserve held from min onward) when not provided, so callers that don't opt in are unchanged.
     */
    solvencyFloor?: number;
    /**
     * FINANZKONZEPT V2 (Stufe 1): Untergrenze der Kasse auch UNTER dem Kader-Minimum. Fehlt sie (Standard),
     * gilt wie bisher 0 — wer das Minimum erreichen muss, gibt alles aus. Gesetzt (Finanzwert-Ruecklage des
     * Teams) haelt der Builder diese Kasse auch beim Auffuellen bis zum Minimum, solange das Minimum dabei
     * noch erreichbar bleibt (`reserveForMin`); gelingt das nicht, faellt er auf die alte Regel (Floor 0)
     * zurueck, Mindestkader vor Ruecklage.
     */
    minFillFloor?: number;
    /**
     * FINANZKONZEPT V2 Stufe 3: harte Freigabe des Vorstands — hoechstens so viel Abloese darf
     * ueber alle Kaeufe dieses Plans ausgegeben werden (Investitionstopf). Gilt erst ab dem Kader-Minimum. undefined => keine Grenze.
     */
    feeCap?: number;
    /** Stufe 3: wie viel ZUSAETZLICHES Jahresgehalt der Gehaltstopf noch zulaesst (undefined => keine Grenze). */
    salaryCap?: number;
    /**
     * Kaderpflicht-Freigabe (Chris 18.11.): die laufende Grenze fuer den naechsten Kauf aus `kaufRahmen().grenzeFuer` — dieselbe
     * Funktion wie die Sperre. Gesetzt, ersetzt sie `feeCap`/`salaryCap` (Rahmen nach Quote ODER Kosten der fehlenden Plaetze).
     */
    kaufGrenze?: (rosterBefore: number, spentFee: number, spentSalary: number) => { fee: number; salary: number };
    /**
     * ANPASSUNG SALCEIL (flag-gated OLY_SALARY_CEILING_V2 — see draft-adapter.ts wiring / salary-ceiling.ts
     * computeTeamSalaryCeiling doc). Soft cap on TOTAL salary (existing roster + planned additions),
     * anchored on expected sponsor income and team value rather than the volatile cash snapshot. Enforced
     * ONLY once the roster is at/above rosterMin — reaching the hard minimum always wins over the ceiling
     * (see the belowMin check at the call site). Undefined ⇒ no salary gating at all ⇒ this builder is
     * bit-identical to before this field existed (same "undefined ⇒ untouched" contract as `composition`).
     */
    salaryCeiling?: number;
    /**
     * KADERPLAN: Preise (aufsteigend) des Pools zu DRAFT-BEGINN, aus denen der Platzpreis der Reserve gerechnet wird.
     * Fehlt die Liste, gilt der aktuelle Pool. Im Einzelschritt nehmen sich 32 Teams die billigen 12er-Spieler gleichzeitig weg;
     * mit dem Restpool stieg der Platzpreis, die Fueller-Sperre fiel und es kamen 54 Fueller statt 1 (Messung 18.11.). Mit dem
     * Startpool planen Block und Einzelschritt mit derselben Zahl. Ohne Kaderplan ungelesen.
     */
    platzPreise?: number[];
    /**
     * KADERPLAN: wie viele Teams im Einzelschritt-Draft noch reihum picken. Die Platz-Reserve rechnet dann mit jedem
     * T-ten Preis ab Platzpreis (die billigen 12er nehmen sich die anderen zwischen den eigenen Picks weg). Fehlt der Wert
     * (Blocklauf: ein Team plant gegen einen festen Pool), gilt 1.
     */
    platzWettbewerb?: number;
  };
  /**
   * Optional per-(save, team) seed for the reproducible buy-utility jitter (see ORGANIC_DRAFT_JITTER).
   * Null/undefined ⇒ no jitter regardless of the env amplitude — the builder stays fully deterministic.
   */
  draftSeed?: string | null;
  /**
   * Optional EXPLICIT role-composition plan (flag-gated OLY_DRAFT_COMPOSE — see draft-adapter.ts /
   * composition-plan.ts deriveCompositionCounts). When set, this PURE builder tracks `boughtTiers`
   * (initialized from startingSquad's tier counts, incremented after every buy) and feeds
   * `{ counts, brackets, boughtTiers }` into OrganicTeamState.composition each iteration, which
   * buyUtility reads for its soft compositionValue term. Undefined ⇒ state.composition stays undefined
   * ⇒ that term is 0 ⇒ this builder is bit-identical to before this field existed.
   */
  composition?: {
    counts: Record<MarketBracketLane, number>;
    brackets: LeagueMarketBrackets;
  };
  /**
   * KADERPLAN (s. `istKaderplanSchalterAn`): gesetzt = dieser Plan laeuft mit Kaderplan. Der Adapter setzt es nur im
   * Saison-1-Setup-Draft mit Schalter an. Fehlt es, ist der Builder bit-gleich zum Stand vor dem Kaderplan.
   */
  kaderplan?: KaderplanEinstellung | null;
};

export type OrganicSquadPlanResult = {
  decisions: OrganicBuyDecision[];
  finalSquad: OrganicPlayerView[];
  finalCash: number;
  finalSalaryTotal: number;
  /** Set when the loop broke below rosterMin because nothing was affordable (edge to log, not repair). */
  stoppedBelowMin: boolean;
  /** KADERPLAN: warum der Kader so gross ist, wie er ist (nur mit `input.kaderplan`). */
  kaderplan?: KaderplanProtokoll;
};

/**
 * KADERPLAN — Protokoll je Team (Chris 18.11.: „weniger als Opt nur als bewusste, begruendete Entscheidung, nie weil
 * das Geld aus war"). Gruende:
 *  - `opt_erreicht`: Zielkader erreicht, der Rahmen trug alle Plaetze zum Platzpreis (ab 12).
 *  - `opt_erreicht_tiefe_vor_qualitaet`: Zielkader erreicht, aber der Rahmen trug zu Beginn nur `rahmenPlaetze` Plaetze zum
 *    Platzpreis; das Team hat die restlichen Plaetze bewusst mit billigeren Spielern besetzt (Tiefe vor Qualitaet — die heutige
 *    Regel fuer alle Identitaeten; „kompakt, dafuer staerker" ist Stufe 2, s. Doku 5.3).
 *  - `unter_opt_rahmen_erschoepft`: unter dem Zielkader, weil auch der billigste Spieler nicht mehr in Kasse/Topf passte.
 *    Das darf mit dem Kaderplan praktisch nicht vorkommen und ist deshalb das Warnsignal im Protokoll.
 * `notwege` zaehlt zusaetzlich (Review S2/S4): einen Fueller unter Opt, obwohl der Rahmen alle Plaetze zum Platzpreis trug
 * (`fueller_rueckfall`), und einen Kader unter dem Minimum (`unter_minimum`).
 */
export type KaderplanGrund = "opt_erreicht" | "opt_erreicht_tiefe_vor_qualitaet" | "unter_opt_rahmen_erschoepft";
export type KaderplanProtokoll = {
  grund: KaderplanGrund;
  optTarget: number;
  kader: number;
  /** Wie viele Plaetze der Rahmen ZU BEGINN zum Platzpreis trug (Kader + Plaetze, die Kasse und Topf decken). */
  rahmenPlaetze: number;
  /** Rueckfaelle, die einen Kauf geliefert haben (soll leer sein). */
  notwege: KaderplanNotweg[];
  text: string;
};

function price(player: OrganicPlayerView): number {
  return Math.max(0, player.marketValue);
}

/**
 * Minimum spend still needed to reach the roster MINIMUM: the sum of the `count` cheapest available
 * prices. Reserving this keeps the hard min-roster rule FEASIBLE, so the builder can't blow its whole
 * budget on a few stars and end below min. This reserves feasibility of a hard rule, NOT composition.
 */
function cheapestPriceSum(pool: OrganicPlayerView[], count: number): number {
  if (count <= 0) return 0;
  const prices = pool.map(price).sort((left, right) => left - right);
  let sum = 0;
  for (let i = 0; i < count && i < prices.length; i += 1) sum += prices[i];
  return sum;
}

/**
 * Summe von `count` billigen Preisen einer aufsteigend sortierten Preisliste. Mit Wettbewerb (Einzelschritt, T Teams picken reihum)
 * jeder T-te Preis statt der `count` billigsten: dieselbe Rechnung wie `platzReserve`, nur fuer die guenstigen Plaetze. Gemessen
 * 18.11. (Review-Fixes): mit den nackten billigsten Preisen endeten im Einzelschritt 3 Teams einen Platz unter Opt, weil die wenigen
 * Spieler unter 4 laengst weg waren, als ihr letzter Platz dran war. Ohne Wettbewerb (Block) die `count` billigsten wie bisher.
 */
function billigeReserve(sortiert: readonly number[], count: number, wettbewerb = 1): number {
  if (count <= 0) return 0;
  const schritt = Number.isFinite(wettbewerb) ? Math.max(1, Math.floor(wettbewerb)) : 1;
  let sum = 0;
  let n = 0;
  for (let i = schritt - 1; i < sortiert.length && n < count; i += schritt) {
    sum += sortiert[i]!;
    n += 1;
  }
  // Zu wenige Preise fuer den Abstand: die teuersten uebrigen (vorsichtig) bis `count`.
  for (let i = sortiert.length - 1; i >= 0 && n < count; i -= 1) {
    if ((i + 1) % schritt === 0) continue;
    sum += sortiert[i]!;
    n += 1;
  }
  return sum;
}

/** Gehalt der `count` billigsten (nach Preis) Spieler: die Gehalts-Seite der Pflichtplatz-Reserve. */
function cheapestSalarySum(pool: OrganicPlayerView[], count: number): number {
  if (count <= 0) return 0;
  return [...pool]
    .sort((left, right) => price(left) - price(right))
    .slice(0, count)
    .reduce((sum, p) => sum + Math.max(0, p.salary), 0);
}

/**
 * EINZELSCHRITT DES GREEDY-LOOPS (Draft-Neubau, 18.11.).
 *
 * Bis hierher lief `buildOrganicSquadPlan` als eine geschlossene Schleife: ein Team plante seinen ganzen Kader am
 * Stück. Der neue Liga-Draft (docs/design/draft-modern-18-11.md) pickt Pick für Pick über alle Teams; dafür braucht er
 * genau EINEN Schritt dieser Schleife — mit demselben Zustand, den die Schleife zwischen zwei Käufen mitführt (Kader,
 * Pool, Kasse, Gehalt, bisherige Ablösen/Gehälter des Plans, gekaufte Stufen). Die Schleife selbst ist jetzt nur noch
 * „Schritt, Kauf anwenden, wiederholen“ — dieselben Zeilen, nicht eine zweite Kopie. Damit kann der Einzelschritt nicht
 * anders entscheiden als der Blocklauf, wenn er denselben Zustand sieht.
 */
export type OrganicPlanStepState = {
  squad: OrganicPlayerView[];
  pool: OrganicPlayerView[];
  cash: number;
  salaryTotal: number;
  /** Summe der Ablösen, die DIESER Plan schon ausgegeben hat (gegen `economy.feeCap`). */
  spentFee: number;
  /** Summe der Gehälter, die DIESER Plan schon gebunden hat (gegen `economy.salaryCap`). */
  spentSalary: number;
  /** Gekaufte Stufen (nur bei `composition`), sonst `null`. */
  boughtTiers: Record<MarketBracketLane, number> | null;
};

export type OrganicBuyStepCandidate = {
  playerId: string;
  /** Buy-Utility inklusive des Saat-Jitters — dieselbe Zahl, nach der der Schritt sortiert. */
  utility: number;
  player: OrganicPlayerView;
};

/**
 * KADERPLAN: welcher Rueckfall den Kauf dieses Schritts geliefert hat. Mit dem Kaderplan duerfen sie nicht greifen
 * (gezaehlt in der Messung); ohne Kaderplan sind sie die bisherigen Wege und werden nur mitgeschrieben.
 */
export type KaderplanNotweg =
  | "fueller_rueckfall"
  | "ruecklage_angetastet"
  | "ohne_mindestreserve"
  | "topf_ueberzogen"
  /** Kader endet unter dem Minimum (Protokoll; Einzelschritt auch, wenn der Kauf selbst scheiterte, Review S4). */
  | "unter_minimum";

export type OrganicBuyStepResult = {
  /** Rueckfall, der den Kauf geliefert hat (s. KaderplanNotweg); `undefined` = regulaerer Kauf nach Plan. */
  notweg?: KaderplanNotweg;
  /** KADERPLAN: die Rahmen-Rechnung dieses Schritts (nur unter Opt mit Schalter). */
  kaderplan?: KaderplanRahmen;
  /**
   * `buy`: `best` kaufen. `stop`: das Team hört auf (Stop-Nutzen schlägt den besten Kauf, Kader ≥ Minimum).
   * `roster_full`: Kader-Maximum erreicht. `nothing_affordable`: kein Kandidat passt in die Kasse.
   */
  kind: "buy" | "stop" | "roster_full" | "nothing_affordable";
  best: OrganicPlayerView | null;
  bestUtility: number;
  /** Stop-Nutzen dieses Schritts (nur ab dem Kader-Minimum gerechnet, sonst `null`). */
  stopUtility: number | null;
  /**
   * Die besten Kandidaten dieses Schritts, absteigend (nur mit `topN > 1` gefüllt, sonst nur `best`). `top[0]` ist
   * immer `best`: gleiche Bewertung, gleiche Reihenfolge bei Gleichstand (Pool-Reihenfolge, stabil sortiert).
   */
  top: OrganicBuyStepCandidate[];
  stoppedBelowMin: boolean;
};

/** Startzustand eines Plans — exakt das, womit `buildOrganicSquadPlan` seine Schleife beginnt. */
export function createOrganicPlanStepState(input: OrganicSquadPlanInput): OrganicPlanStepState {
  // ANPASSUNG COMPOSE (flag-gated via input.composition, see OrganicSquadPlanInput doc above). boughtTiers
  // starts at the starting squad's own tier counts and is incremented after every buy below, so the
  // compositionValue term in buyUtility always sees "how much of the plan is filled so far".
  const boughtTiers: Record<MarketBracketLane, number> | null = input.composition
    ? { superstar: 0, star: 0, core: 0, depth: 0, backup: 0, reserve: 0 }
    : null;
  if (boughtTiers && input.composition) {
    for (const player of input.startingSquad) {
      const lane = classifyCompositionLane(player.marketValue, input.composition.brackets);
      boughtTiers[lane] += 1;
    }
  }
  return {
    squad: [...input.startingSquad],
    pool: [...input.candidates],
    cash: input.economy.cash,
    salaryTotal: input.economy.salaryTotal,
    spentFee: 0,
    spentSalary: 0,
    boughtTiers,
  };
}

function buildStepTeamState(input: OrganicSquadPlanInput, step: OrganicPlanStepState): OrganicTeamState {
  const cashBuffer = input.economy.cashBuffer;
  const disciplineNeeds = computeDisciplineNeeds(step.squad, input.identityAxisWeights, input.disciplines);
  const needAxisWeights = deriveNeedAxisWeights(disciplineNeeds);
  const forecast = projectCashFlow({
    cash: step.cash,
    salaryTotal: step.salaryTotal,
    expectedPrize: input.economy.expectedPrize,
    sponsorIncome: input.economy.sponsorIncome,
    facilityNet: input.economy.facilityNet,
    netTransfer: input.economy.netTransfer,
    cashBuffer,
  });
  return {
    cash: step.cash,
    cashBuffer,
    salaryTotal: step.salaryTotal,
    rosterSize: step.squad.length,
    boardRisk: input.economy.boardRisk,
    forecast,
    weights: input.economy.weights,
    disciplineNeeds,
    needAxisWeights,
    identityAxisWeights: input.identityAxisWeights,
    // Self-limiting signal for the flag-gated PEAK front-load: the best on-identity quality already on
    // the roster. Once this crosses the star line the front-load stops (see peakFrontLoadFactor).
    coreAxisPeakQuality: computeCoreAxisPeakQuality(step.squad, input.identityAxisWeights, needAxisWeights),
    composition:
      input.composition && step.boughtTiers
        ? { counts: input.composition.counts, brackets: input.composition.brackets, boughtTiers: step.boughtTiers }
        : undefined,
  };
}

export type KaderplanRahmen = {
  /** Kadergroesse, die der Rahmen nach diesem Kauf zum Platzpreis traegt (Kader + dieser Kauf + reservierte Plaetze). */
  plaetze: number;
  /** Reservierter Betrag fuer die restlichen Plaetze. */
  reserve: number;
  /** Fueller (< Platzpreis-Untergrenze) gesperrt, weil der Rahmen alle Plaetze bis Opt zum Platzpreis traegt. */
  fuellerSperre: boolean;
};

/**
 * KADERPLAN: welche Plaetze bis Opt reserviert der naechste Kauf, und sind Fueller gesperrt? Rechnet gegen die Kasse
 * (minus Untergrenze) UND den Transfertopf des Vorstands (Chris: „mit dem freigegebenen Rahmen rechnen und trotzdem die Slots
 * fuellen"). Platzpreis aus `economy.platzPreise` (Startpool des Drafts), sonst aus dem aktuellen Pool.
 */
export function kaderplanRahmen(input: OrganicSquadPlanInput, step: OrganicPlanStepState): KaderplanRahmen {
  const rosterMin = input.economy.rosterMin ?? ROSTER_MIN;
  const optTarget = input.economy.weights.optTarget;
  const cashBuffer = input.economy.cashBuffer;
  const optFillFloor = Math.min(cashBuffer, input.economy.solvencyFloor ?? cashBuffer);
  const minFillFloor = Math.max(0, input.economy.minFillFloor ?? 0);
  const feeCap = input.economy.feeCap;
  const { squad, pool, cash, spentFee } = step;
  const belowMin = squad.length < rosterMin;
  const belowOpt = squad.length < optTarget;
  const affordFloor = belowMin ? Math.min(minFillFloor, cashBuffer) : belowOpt ? optFillFloor : cashBuffer;
  const remainingToMinAfterBuy = Math.max(0, rosterMin - (squad.length + 1));
  const reserveForMin = cheapestPriceSum(pool, remainingToMinAfterBuy);
  const sortiertePreise = input.economy.platzPreise ?? pool.map(price).sort((left, right) => left - right);
  let billigster = Infinity;
  for (const candidate of pool) billigster = Math.min(billigster, price(candidate));
  if (!Number.isFinite(billigster)) billigster = 0;
  const voll = Math.max(0, optTarget - (squad.length + 1));
  const aktuellePreise = pool.map(price).sort((left, right) => left - right);
  // Billigster Spieler ab Platzpreis, der JETZT im Pool liegt (nicht die nackte 12): im Einzelschritt sind die 12,0er spaet
  // laengst vergeben, und eine Rechnung gegen einen Preis, den es nicht mehr gibt, verspricht etwas Unmoegliches.
  const billigsterPlatz = aktuellePreise.find((wert) => wert >= KADERPLAN_PLATZ_MIN_MW) ?? Infinity;
  // Reserve fuer `m` weitere Plaetze, davon `n` zum Platzpreis und `m - n` zum Preis der billigsten Spieler im aktuellen Pool.
  const reserveFuer = (n: number, m: number) =>
    Math.max(
      reserveForMin,
      platzReserve(sortiertePreise, n, input.economy.platzWettbewerb) +
        billigeReserve(aktuellePreise, m - n, input.economy.platzWettbewerb),
    );
  const traegt = (n: number, m: number, kauf: number) => {
    const reserve = reserveFuer(n, m);
    return cash - kauf - reserve >= affordFloor && (feeCap == null || spentFee + kauf + reserve <= feeCap + 1e-9);
  };
  // (1) Wie viele weitere Plaetze traegt der Rahmen ueberhaupt (dieser Kauf zum billigsten Preis, die uebrigen billigst)? Review S1:
  // frueher blieben hier immer ALLE `voll` Plaetze reserviert; trug die Kasse sie nicht, bestand kein Kandidat, und ueber dem
  // Minimum endete das Team mit `nothing_affordable` KLEINER als ohne Kaderplan. Jetzt schrittweise bis zum groessten tragbaren m
  // (m = 0 ist genau die Schranke ohne Kaderplan).
  let plaetzeGesamt = voll;
  while (plaetzeGesamt > 0 && !traegt(0, plaetzeGesamt, billigster)) plaetzeGesamt -= 1;
  // (2) Davon zum Platzpreis: gerechnet mit dem aktuellen Kauf ZUM PLATZPREIS (Review S2: mit dem absolut billigsten, oft einem
  // Fueller, war die Zaehlung um bis zu 1 zu hoch, die Fueller-Sperre fiel spaeter, und ein Fueller kam unter Opt).
  const kaufZumPlatzpreis = Number.isFinite(billigsterPlatz) && traegt(0, plaetzeGesamt, billigsterPlatz);
  let rest = 0;
  if (kaufZumPlatzpreis) {
    rest = plaetzeGesamt;
    while (rest > 0 && !traegt(rest, plaetzeGesamt, billigsterPlatz)) rest -= 1;
  }
  const reserve = reserveFuer(rest, plaetzeGesamt);
  // Traegt der Rahmen ALLE geplanten Plaetze zum Platzpreis, gibt es keinen Grund fuer einen Fueller unter dem Platzpreis
  // (Chris: „keine filler mehr"); ein Fueller in diesem Fall ist ein Notweg (`fueller_rueckfall`).
  const fuellerSperre = kaufZumPlatzpreis && plaetzeGesamt === voll && rest === voll;
  return { plaetze: kaufZumPlatzpreis ? squad.length + 1 + rest : squad.length, reserve, fuellerSperre };
}

/**
 * KADERPLAN: Protokoll am Ende eines Plans (Block) bzw. beim Ausstieg (Einzelschritt). `start` ist der Planzustand zu
 * Beginn (vor dem ersten Kauf), `ende` der Zustand am Schluss.
 */
export function kaderplanProtokoll(
  input: OrganicSquadPlanInput,
  start: OrganicPlanStepState,
  ende: Pick<OrganicPlanStepState, "squad">,
  notwege: KaderplanNotweg[] = [],
): KaderplanProtokoll {
  const optTarget = input.economy.weights.optTarget;
  const rosterMin = input.economy.rosterMin ?? ROSTER_MIN;
  const kader = ende.squad.length;
  const rahmenPlaetze = start.squad.length < optTarget ? kaderplanRahmen(input, start).plaetze : start.squad.length;
  const grund: KaderplanGrund =
    kader < optTarget ? "unter_opt_rahmen_erschoepft" : rahmenPlaetze >= optTarget ? "opt_erreicht" : "opt_erreicht_tiefe_vor_qualitaet";
  const alleNotwege = [...notwege];
  if (grund === "opt_erreicht") {
    // Review S2: trug der Rahmen alle Plaetze zum Platzpreis, ist jeder Fueller unter Opt ein Notweg, auch wenn der Schritt selbst
    // ihn nicht als Rueckfall gemeldet hat (z. B. ueber den zweiten Durchgang ohne Sperre).
    const fuellerUnterOpt = ende.squad
      .slice(start.squad.length, optTarget)
      .filter((spieler) => price(spieler) < KADERPLAN_PLATZ_MIN_MW).length;
    const schonGezaehlt = alleNotwege.filter((weg) => weg === "fueller_rueckfall").length;
    for (let i = schonGezaehlt; i < fuellerUnterOpt; i += 1) alleNotwege.push("fueller_rueckfall");
  }
  if (kader < rosterMin && !alleNotwege.includes("unter_minimum")) alleNotwege.push("unter_minimum");
  const text =
    grund === "opt_erreicht"
      ? `Zielkader ${optTarget} erreicht, Rahmen trug alle Plaetze ab ${KADERPLAN_PLATZ_MIN_MW}`
      : grund === "opt_erreicht_tiefe_vor_qualitaet"
        ? `Zielkader ${optTarget} erreicht; der Rahmen trug zu Beginn nur ${rahmenPlaetze} Plaetze ab ${KADERPLAN_PLATZ_MIN_MW}, der Rest bewusst guenstiger besetzt (Tiefe vor Qualitaet)`
        : `nur ${kader} von ${optTarget}: Rahmen erschoepft (auch der billigste Spieler passte nicht mehr in Kasse/Topf)`;
  return { grund, optTarget, kader, rahmenPlaetze, notwege: alleNotwege, text };
}

/**
 * EIN Schritt des Greedy-Loops: welcher Kauf (oder Stop) gewinnt beim aktuellen Zustand? Liest den Zustand nur,
 * ändert ihn nicht — den Kauf wendet `applyOrganicBuyStep` an.
 */
export function organicBuyStep(
  input: OrganicSquadPlanInput,
  step: OrganicPlanStepState,
  options?: { topN?: number },
): OrganicBuyStepResult {
  const rosterMax = input.economy.rosterMax ?? ROSTER_MAX;
  const rosterMin = input.economy.rosterMin ?? ROSTER_MIN;
  const cashBuffer = input.economy.cashBuffer;
  const optTarget = input.economy.weights.optTarget;
  // Floor kept while building from min→opt (see solvencyFloor doc). Defaults to cashBuffer = old behaviour.
  const optFillFloor = Math.min(cashBuffer, input.economy.solvencyFloor ?? cashBuffer);
  // FINANZKONZEPT V2: Ruecklage auch unter Min (undefined => 0 => bit-gleich zu vorher).
  const minFillFloor = Math.max(0, input.economy.minFillFloor ?? 0);
  // ANPASSUNG SALCEIL: undefined ⇒ no salary gating (flag off / caller opted out) ⇒ bit-identical to before.
  const salaryCeiling = input.economy.salaryCeiling;
  const feeCap = input.economy.feeCap;
  const salaryCap = input.economy.salaryCap;
  const kaufGrenze = input.economy.kaufGrenze;
  const topN = Math.max(1, Math.floor(options?.topN ?? 1));
  const { squad, pool, cash, salaryTotal, spentFee, spentSalary } = step;

  if (squad.length >= rosterMax) {
    return { kind: "roster_full", best: null, bestUtility: -Infinity, stopUtility: null, top: [], stoppedBelowMin: false };
  }

  const state = buildStepTeamState(input, step);
  // Budget pacing for the hard MIN rule: after this buy, keep enough to cheap-fill the remaining
  // mandatory slots. Reserving the cheapest such prices means a rich club can chase a star AND still
  // reach min, while nobody blows the whole budget on a few stars and ends below min. Once at/above
  // min this reserve is 0, so composition past min is fully emergent.
  const remainingToMinAfterBuy = Math.max(0, rosterMin - (squad.length + 1));
  const reserveForMin = cheapestPriceSum(pool, remainingToMinAfterBuy);
  // FINANZKONZEPT V2 (Chris 18.11.): erst die Pflichtplaetze reservieren, nur den Rest nach Wunsch verteilen. Auch unter dem
  // Minimum muss ein Wunschkauf samt Reserve der fehlenden Plaetze in den Rahmen passen; ueber den Rahmen darf nur der
  // billigste Pflichtkauf (Auffangnetz weiter unten), der den Topf ueberziehen darf.
  const reserveSalaryForMin = cheapestSalarySum(pool, remainingToMinAfterBuy);
  // Three-tier solvency floor. (1) Below the hard ROSTER_MIN: floor 0 — fielding a legal (≥ min) squad
  // outranks any buffer, so a cash-poor club spends down toward ~0 to reach min (else it stalls below
  // min and breaks autoprep "teams_under_7"). (2) From min UP TO opt: floor = optFillFloor (a small flat
  // solvency floor). Here the salary-scaled reserve is SPENDABLE — a club spends it to build its target
  // squad and refills it from income over later seasons, instead of hoarding it and stalling under opt
  // (user model: "die Reserve muss auch mal ausgegeben werden, kann später aufgefüllt werden"). (3) At or
  // above opt: floor = cashBuffer — the full reserve holds again, so cash beyond the target squad is kept
  // rather than blown on luxury depth. Affordability keeps cash ≥ floor AFTER the buy AND the min-fill.
  const belowMin = squad.length < rosterMin;
  const belowOpt = squad.length < optTarget;
  const grenze = kaufGrenze ? kaufGrenze(squad.length, spentFee, spentSalary) : null;
  const affordFloor = belowMin ? Math.min(minFillFloor, cashBuffer) : belowOpt ? optFillFloor : cashBuffer;
  // Affordability keeps cash ≥ affordFloor AFTER the buy AND after the reserved min-fill.
  // ANPASSUNG SALCEIL: once the roster is at/above the hard minimum, a candidate whose salary would push
  // the TOTAL wage bill past salaryCeiling is treated as unaffordable-by-salary, same as the cash checks
  // above — an ADDITIONAL cap, not a replacement (a buy must still separately clear the cash affordability
  // check). Below rosterMin this is skipped entirely: reaching the hard minimum (survival) always wins
  // over the ceiling, matching the belowMin-ignores-cashBuffer precedent already established above.
  const salaryCeilingActive = !belowMin && typeof salaryCeiling === "number" && Number.isFinite(salaryCeiling);
  // KADERPLAN (s. istKaderplanSchalterAn): Reserve fuer die restlichen geplanten Plaetze bis Opt (s. kaderplanRahmen).
  const kaderplan = kaderplanAn(input);
  const rahmen = kaderplan && belowOpt ? kaderplanRahmen(input, step) : null;
  const reserveForPlan = rahmen ? Math.max(reserveForMin, rahmen.reserve) : reserveForMin;
  const fuellerSperre = rahmen?.fuellerSperre ?? false;
  let best: OrganicPlayerView | null = null;
  let bestUtility = -Infinity;
  // Nur fuer den Einzelschritt-Draft (topN > 1): alle bewerteten Kandidaten des Durchgangs, der `best` liefert.
  let scored: OrganicBuyStepCandidate[] | null = topN > 1 ? [] : null;
  const score = (candidate: OrganicPlayerView) => {
    const jitter =
      input.draftSeed && ORGANIC_DRAFT_JITTER > 0
        ? ORGANIC_DRAFT_JITTER * (draftUnit(`${input.draftSeed}:${candidate.playerId}`) - 0.5)
        : 0;
    const utility = buyUtility(candidate, state) + jitter;
    if (scored) scored.push({ playerId: candidate.playerId, utility, player: candidate });
    if (utility > bestUtility) {
      bestUtility = utility;
      best = candidate;
    }
  };

  const hauptDurchgang = (mitFuellerSperre: boolean) => {
    for (const candidate of pool) {
      if (cash - price(candidate) - reserveForPlan < affordFloor) continue;
      if (mitFuellerSperre && price(candidate) < KADERPLAN_PLATZ_MIN_MW) continue;
      // Mit Kaderplan plant der Topf dieselben Plaetze wie die Kasse (Chris: gegen den echten Rahmen planen, nicht gegen die Kasse).
      const feeReserve = kaderplan ? reserveForPlan : reserveForMin;
      if (grenze) {
        // Kaderpflicht-Freigabe (#1618): die laufende Grenze ist schon „ab jetzt" (abzueglich des bisher Ausgegebenen).
        if (price(candidate) + feeReserve > grenze.fee + 1e-9) continue;
        if (Math.max(0, candidate.salary) + reserveSalaryForMin > grenze.salary + 1e-9) continue;
      } else {
        if (feeCap != null && spentFee + price(candidate) + feeReserve > feeCap + 1e-9) continue;
        if (salaryCap != null && spentSalary + Math.max(0, candidate.salary) + reserveSalaryForMin > salaryCap + 1e-9) continue;
      }
      if (salaryCeilingActive && salaryTotal + Math.max(0, candidate.salary) > salaryCeiling!) continue;
      score(candidate);
    }
  };
  // Review S5: ueber dem Zielkader mit Kaderplan nie ein Fueller unter dem Platzpreis (auch kein zweiter Durchgang ohne Sperre).
  const ueberOptSperre = kaderplan && !belowOpt;
  const sperreAktiv = rahmen ? (fuellerSperreImmer() ? true : fuellerSperre) : ueberOptSperre;
  hauptDurchgang(sperreAktiv);
  // Plaetze, die der Plan selbst als guenstige Plaetze vorsieht (Rahmen traegt nicht alle zum Platzpreis), duerfen mit dem
  // bestbewerteten guenstigeren Spieler besetzt werden — das ist Plan, kein Notweg. Sah der Plan ALLE Plaetze zum Platzpreis
  // vor und passt trotzdem keiner, ist das ein Planfehler: laut protokolliert (`notweg`), in der Messung gezaehlt.
  let notweg: KaderplanNotweg | undefined;
  if (!best && sperreAktiv && !ueberOptSperre) {
    hauptDurchgang(false);
    if (best && rahmen?.fuellerSperre) notweg = "fueller_rueckfall";
  }

  // FINANZKONZEPT V2: reicht die Kasse nicht fuer Ruecklage UND Mindestkader, gilt die alte Regel (Floor 0,
  // Mindestkader vor Ruecklage) — erst mit der Reserve fuers Minimum, dann ganz ohne (naechster Block).
  if (!best && belowMin && affordFloor > 0 && feeCap == null && salaryCap == null && !grenze) {
    if (scored) scored = [];
    for (const candidate of pool) {
      if (cash - price(candidate) - reserveForMin < 0) continue;
      if (salaryCeilingActive && salaryTotal + Math.max(0, candidate.salary) > salaryCeiling!) continue;
      score(candidate);
    }
    if (best) notweg = "ruecklage_angetastet";
  }

  // Broke-and-below-min fallback: if the min-reserve made the FULL min-fill unaffordable, a club that
  // can't reach min in one go must still make PARTIAL progress (6→7 beats staying at 6 and breaking
  // autoprep). Drop the reserve and buy the single best candidate it can actually pay for (cash ≥ 0).
  if (!best && belowMin && feeCap == null && salaryCap == null && !grenze) {
    if (scored) scored = [];
    for (const candidate of pool) {
      if (cash - price(candidate) < 0) continue;
      score(candidate);
    }
    if (best) notweg = "ohne_mindestreserve";
  }

  // Auffangnetz (#1618): unter dem Pflichtkader mit Toepfen der billigste bezahlbare Spieler (darf den Topf ueberziehen).
  if (!best && belowMin && (feeCap != null || salaryCap != null || grenze)) {
    if (scored) scored = [];
    if (kaderplan) {
      // Kein Notweg: dieselbe Bewertung ueber den ganzen Pool, nur die Topf-Schranke ist gelockert (Kasse bleibt hart).
      for (const candidate of pool) {
        if (cash - price(candidate) - reserveForMin < 0) continue;
        score(candidate);
      }
      if (!best) {
        for (const candidate of pool) {
          if (cash - price(candidate) < 0) continue;
          score(candidate);
        }
      }
      if (best) notweg = "topf_ueberzogen";
    } else {
      let billigster: OrganicPlayerView | null = null;
      for (const candidate of pool) {
        if (cash - price(candidate) < 0) continue;
        if (billigster == null || price(candidate) < price(billigster)) billigster = candidate;
      }
      if (billigster) score(billigster);
    }
  }

  // Review K3: ohne Kaderplan kein `notweg` im Ergebnis, damit AUS auch in den Daten bit-gleich bleibt.
  if (!kaderplan) notweg = undefined;
  if (notweg) {
    // Laut: mit dem Kaderplan darf keiner dieser Wege greifen (der Plan reserviert von Anfang an bis Opt).
    console.warn(`[kaderplan] NOTWEG ${notweg} bei Kader ${squad.length} (Opt ${optTarget}, Kasse ${Math.round(cash * 10) / 10})`);
  }

  const chosen = best as OrganicPlayerView | null;
  const top: OrganicBuyStepCandidate[] = scored
    ? [...scored].sort((left, right) => right.utility - left.utility).slice(0, topN)
    : chosen
      ? [{ playerId: chosen.playerId, utility: bestUtility, player: chosen }]
      : [];

  if (!chosen) {
    // Nothing affordable — the club is out of cash for even the cheapest remaining candidate. Stop the
    // build here. The preseason buy phase NEVER sells (clean two-phase model: all selling happens at
    // season end — see runOrganicSellCycle / .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc), so
    // a club that can't reach min with its available cash simply stops under-filled; that is logged
    // (stoppedBelowMin), not resolved by shedding a body here.
    return {
      kaderplan: rahmen ?? undefined,
      notweg,
      kind: "nothing_affordable",
      best: null,
      bestUtility,
      stopUtility: null,
      top,
      stoppedBelowMin: squad.length < rosterMin,
    };
  }

  // Review S5: hat der GM den Zielkader bewusst gesenkt („weniger, dafuer staerker"), hoert das Team an diesem Zielkader auf.
  // Sonst hob der Kauf ueber Opt (Stop-Nutzen gegen Kauf wie bisher) die Senkung wieder auf (gemessen R-L: Opt 10 -> 9, Endkader 10).
  if (kaderplan && input.kaderplan?.gmOptGesenkt && !belowOpt && squad.length >= rosterMin) {
    return { kaderplan: undefined, notweg, kind: "stop", best: chosen, bestUtility, stopUtility: stopUtility(state), top, stoppedBelowMin: false };
  }

  // STOP may only win once the roster minimum is met (min is hard; below it we always fill).
  // KADERPLAN: unter dem Zielkader gewinnt „aufhoeren" nicht nebenbei (Chris 18.11.: weniger als Opt nur als bewusste
  // Entscheidung, nie weil das Geld „aus war"). Der Zielkader selbst ist die Identitaets-Entscheidung (Blatt-Opt + GM-Tiefe).
  if (squad.length >= rosterMin && !(kaderplan && belowOpt)) {
    const stop = stopUtility(state);
    if (stop >= bestUtility) {
      return { kaderplan: rahmen ?? undefined, notweg, kind: "stop", best: chosen, bestUtility, stopUtility: stop, top, stoppedBelowMin: false };
    }
    return { kaderplan: rahmen ?? undefined, notweg, kind: "buy", best: chosen, bestUtility, stopUtility: stop, top, stoppedBelowMin: false };
  }
  return { kaderplan: rahmen ?? undefined, notweg, kind: "buy", best: chosen, bestUtility, stopUtility: null, top, stoppedBelowMin: false };
}

/** Wendet einen Kauf auf den Planzustand an — dieselben Fortschreibungen wie bisher im Loop. */
export function applyOrganicBuyStep(
  input: OrganicSquadPlanInput,
  step: OrganicPlanStepState,
  player: OrganicPlayerView,
): void {
  step.squad.push(player);
  step.cash -= price(player);
  step.spentFee += price(player);
  step.spentSalary += Math.max(0, player.salary);
  step.salaryTotal += Math.max(0, player.salary);
  const index = step.pool.indexOf(player);
  if (index >= 0) step.pool.splice(index, 1);
  if (step.boughtTiers && input.composition) {
    const lane = classifyCompositionLane(player.marketValue, input.composition.brackets);
    step.boughtTiers[lane] += 1;
  }
}

/** Greedy organic squad plan. Deterministic; ties broken by pool order (stable). */
export function buildOrganicSquadPlan(input: OrganicSquadPlanInput): OrganicSquadPlanResult {
  const step = createOrganicPlanStepState(input);
  const start = kaderplanAn(input) ? createOrganicPlanStepState(input) : null;
  const decisions: OrganicBuyDecision[] = [];
  const notwege: KaderplanNotweg[] = [];
  let stoppedBelowMin = false;

  for (;;) {
    const result = organicBuyStep(input, step);
    if (result.kind !== "buy" || !result.best) {
      if (result.kind === "nothing_affordable") stoppedBelowMin = result.stoppedBelowMin;
      break;
    }
    applyOrganicBuyStep(input, step, result.best);
    if (result.notweg) notwege.push(result.notweg);
    decisions.push({ playerId: result.best.playerId, step: decisions.length, utility: result.bestUtility });
  }

  return {
    decisions,
    finalSquad: step.squad,
    finalCash: step.cash,
    finalSalaryTotal: step.salaryTotal,
    stoppedBelowMin,
    kaderplan: start ? kaderplanProtokoll(input, start, step, notwege) : undefined,
  };
}
