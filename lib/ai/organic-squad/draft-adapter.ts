/**
 * Organic squad builder — gameState adapter (Master-Plan P2 wiring layer).
 *
 * Maps the live domain model (Player, TeamIdentity, GM bias, team economy, disciplines) into the pure
 * utility inputs and runs buildOrganicSquadPlan. Kept separate from the pure engine so the engine stays
 * gameState-free and testable. This module reads gameState but MUTATES NOTHING — callers apply the
 * returned decisions. Flag-gated at the call site (OLY_ORGANIC_SQUAD_BUILDER); default OFF.
 *
 * Forecast economy inputs (expected prize / sponsor / facility / transfer) are conservative at draft
 * time and are refined in P3 — the P2 goal is the emergent buy/stop/coverage behaviour, not exact cash.
 */

import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import { classifyCompositionLane, deriveCompositionCounts } from "@/lib/ai/organic-squad/composition-plan";
import { computeDisciplineNeeds, deriveNeedAxisWeights } from "@/lib/ai/organic-squad/discipline-need";
import {
  deriveLeagueSuperstarLicenses,
  MARQUEE_TARGET_MW_FLOOR,
  type MarqueeLicenseTeamInput,
} from "@/lib/ai/organic-squad/marquee-eligibility";
import {
  buildOrganicSquadPlan,
  createOrganicPlanStepState,
  istKaderplanSchalterAn,
  kaderplanRahmen,
  type KaderplanProtokoll,
  type OrganicBuyDecision,
  type OrganicSquadPlanInput,
} from "@/lib/ai/organic-squad/draft-builder";
import { computeTeamSalaryCeiling } from "@/lib/ai/organic-squad/salary-ceiling";
import {
  ROSTER_MAX,
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicGmBiasInput,
  type OrganicIdentityInput,
  type OrganicPlayerView,
  type OrganicTeamState,
  type OrganicUtilityWeights,
} from "@/lib/ai/organic-squad/types";
import { DEPTH_REF_COST, sellUtility } from "@/lib/ai/organic-squad/utility";
import { deriveUtilityWeights, resolveRenewalContractLength } from "@/lib/ai/organic-squad/weights";
import { draftUnit } from "@/lib/ai/market-pick-engine/slot-sequence";
import { buildLeagueMarketBrackets, quantilePrice, type MarketBracketLane } from "@/lib/ai/market-pick-engine/market-brackets";
import type { GameState, Player, PlayerPotentialRecord, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { GM_OPT_SENKUNG_MAX, getTeamGeneralManager, gmKaderOptAnpassung } from "@/lib/foundation/team-general-managers";
import { istFensterAufOpt } from "@/lib/market/transferfenster-gemeinsam";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import {
  istKiRuecklageV2Aktiv,
  resolveKiRuecklageFuerTeam,
  type KiRuecklageErgebnis,
} from "@/lib/finance/ki-ruecklage";
import { erwarteterSponsorFuerPlanung, istSponsorForecastAktiv } from "@/lib/finance/sponsor-erwartung";
import { berechneVorstandBudgetStand, kaufRahmen, type VorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import {
  applyGmBiasToLaneAppetite,
  computeIdentityLaneAppetite,
} from "@/lib/ai/ai-needs-picks-compare-service";
import {
  buildTeamThemeCompositionRuntimeContext,
  classifyIdentityQuotaRole,
  derivePlayerThemeTagsCached,
  themeTagSet,
  isQuotaScopedTarget,
  type TeamThemeCompositionRuntimeContext,
} from "@/lib/ai/team-theme-composition-service";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { resolveOpenBuyoutCostForRoster } from "@/lib/market/transfermarkt-sell-proceeds";
import {
  applySellPricingPolicyToBreakdown,
  isBigHaircut,
  isSellerDistressed,
} from "@/lib/market/transfermarkt-sell-pricing-policy";

/** Small flat solvency buffer (MW) — the floor of the cash hard blocker; spend above it is emergent. */
const ORGANIC_CASH_BUFFER = 5;

/**
 * Env flag for ANPASSUNG B (cash-scaled opt-trim). optTarget is otherwise cash-blind (weights.ts derives
 * it purely from identity playerOpt + GM depth/elite bias), so a cash-thin club spreads its small budget
 * over too many slots → budget-per-slot collapses → the last slots become Backup/Reserve scraps. When a
 * club can't fund Depth-grade bodies across all its open slots, trim the target by up to 2 slots so the
 * budget-per-slot rises enough to afford Depth — fewer but better bodies. Rich clubs (strain 0) untouched;
 * below-opt is measured against the trimmed target so it does NOT rise. Default OFF.
 */
const FILLQ_B_ENABLED = process.env.OLY_DRAFT_FILLQB === "1";

/**
 * Env flag for the EXPLICIT role-composition planner (see composition-plan.ts deriveCompositionCounts +
 * utility.ts compositionValue term). Default OFF ("0"/unset) — when off, planOrganicDraftForTeam never
 * builds a `composition` input, so OrganicTeamState.composition stays undefined and the draft is
 * bit-identical to before this flag existed (same pattern as IDFIT_ENABLED in utility.ts:38/FILLQ_B_ENABLED
 * above). This is a SOFT utility nudge only — no hard band filter, no slot sequence, no stopUtility change.
 */
/**
 * STANDARD AN, seit am Spielstand gemessen wurde, was er bringt.
 *
 * CHRIS: „ich will nicht dass die teams nur mit füllspielern aufgefüllt werden sondern eine gute
 * mischung aus stars, guten spielern und ergaenzungsspielern"
 *
 * Der Schalter lag seit dem Einbau auf AUS und war nirgends im Repo oder im Deploy gesetzt — die
 * Qualitaets-Pyramide existierte also, lief aber nie. Am Klon von Chris' Spielstand gemessen, ab
 * demselben Zustand nach dem Saisonwechsel und auf dem bereits reparierten Kaderziel:
 *
 *   aus                     Kader 337, Kaeufe 103, geliehen 161.3, liegengeblieben 37.2, stark 47
 *   COMPOSE+FILLQA an       Kader 337, Kaeufe 103, geliehen  79.2, liegengeblieben 20.7, stark 49
 *   zusaetzlich FILLQB      Kader 332, Kaeufe  98, geliehen 147.2, liegengeblieben 61.3, stark 56
 *
 * Die mittlere Zeile ist auf fast jeder Achse besser: gleiche Kadergroesse, gleiche Kaufzahl, halb
 * so viel Kredit, 17 Mio weniger totes Geld, zwei starke Zugaenge mehr. FILLQB bleibt deshalb AUS —
 * es kauft zwar die staerksten Kader (56 starke Zugaenge), erkauft das aber mit fuenf Spielern
 * weniger und doppelt so viel liegengebliebenem Geld, weil es das Kaderziel zusaetzlich trimmt.
 *
 * Mit "0" laesst sich der Schalter weiterhin ausschalten.
 */
const COMPOSE_ENABLED = process.env.OLY_DRAFT_COMPOSE !== "0";

/**
 * Env flag for the sponsor-forecast + team-value SALARY CEILING (salary-ceiling.ts computeTeamSalaryCeiling).
 * Default ON ("0" is the only way to disable) — unlike COMPOSE_ENABLED/FILLQ_B_ENABLED above (opt-in,
 * default OFF), this is a REPLACEMENT for the cash-only budgeting's blind spot (sponsor-rich teams
 * under-building because the plan never looked at income/team-value, only cash), so it ships live. Set to
 * "0" to get the exact pre-existing cash-only path (byte-identical: economy.salaryCeiling stays undefined,
 * see draft-builder.ts's "undefined ⇒ no salary gating" contract) for A/B comparison.
 */
// Default AUS: ein sauberer same-seed A/B (Flag AN vs AUS ab identischem S1-Stand) zeigte, dass das
// Limit die Kader SCHRUMPFT (unter Opt 23 vs 18 von 32; A-A 12→8 Spieler) und dadurch die Injuries
// ERHÖHT (+8%, mehr Fatigue), ohne den gedachten Nutzen (Runaway-Gehälter kappen — Max-Gehalt war in
// beiden identisch). Ursache: das "tragbare Gehalt" (Sponsor − Fixkosten) liegt unter dem, was Teams
// cash-finanziert profitabel fahren, also pinnt es sie zu klein. Nur explizit mit "1" aktivierbar,
// bis das Modell überarbeitet ist (nur echte Über-Extender kappen statt Kader-Aufbau zu bremsen).
const SALARY_CEILING_V2_ENABLED = process.env.OLY_SALARY_CEILING_V2 === "1";
/**
 * The cash buffer scales with the club's WAGE BILL ("auch Top-/Aggro-Teams sollen was auf die Seite legen,
 * z.B. 0.25–0.5× Salary"): a club must keep roughly this fraction of its recurring salary as reserve, so a
 * high-wage aggressive club can't spend down to ~0 and then be unable to refill next window. It also feeds
 * the SELL distress factor (cashHealth = cash / buffer): a bigger wage bill raises the buffer, so an
 * over-salaried club reads as more cash-strapped and sheds expensive/high-wage players harder.
 */
const RESERVE_SALARY_FACTOR = 0.35;

/** Sum the team's current roster salaries (same salary source as toOrganicPlayerView). */
function resolveRosterSalaryTotal(gameState: GameState, teamId: string): number {
  let total = 0;
  const players = gameState.players ?? [];
  for (const entry of gameState.rosters ?? []) {
    if (entry.teamId !== teamId) continue;
    const player = players.find((candidate) => candidate.id === entry.playerId);
    if (player) total += Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0);
  }
  return total;
}

/** Market values of an arbitrary team's current roster (same value source as toOrganicPlayerView). Used
 *  by the MARQUEE league-input builder below to count each team's existing Superstar-tier holdings — a
 *  live gameState lookup, unlike the current-team startingSquad view already built in the caller. */
function resolveRosterMarketValues(gameState: GameState, teamId: string): number[] {
  const values: number[] = [];
  const players = gameState.players ?? [];
  for (const entry of gameState.rosters ?? []) {
    if (entry.teamId !== teamId) continue;
    const player = players.find((candidate) => candidate.id === entry.playerId);
    if (player) values.push(Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0));
  }
  return values;
}

/** 0..100 (or 0..10 legacy) management value → 0..1, matching normalizeManagementValue. */
function normId(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  const scaled = value <= 10 ? value / 10 : value / 100;
  return Math.min(1, Math.max(0, scaled));
}

/**
 * Build the utility player view from a domain Player (quality from stats; marketValue = price only).
 * `purchasePrice` (the roster entry's cost basis) is threaded only for SELL views — it feeds the
 * profit-flip term in sellUtility. Buy/draft views omit it (undefined ⇒ no profit signal).
 * `openBuyoutCost` (the remaining open buyout/release clause the club owes on a sale) is likewise SELL-only:
 * it converts marketValue into the NET proceeds the club actually banks (netSaleProceeds = marketValue −
 * openBuyoutCost), the same net figure resolveTransfermarktSellProceeds credits to cash at execution time.
 * Omitted / ≤ 0 ⇒ no clause ⇒ netSaleProceeds stays undefined (net == marketValue), so buy/draft views and
 * clause-free players are bit-identical to before.
 */
export function toOrganicPlayerView(
  player: Player,
  themeFit?: number,
  purchasePrice?: number | null,
  openBuyoutCost?: number | null,
  gameState?: { playerPotential?: PlayerPotentialRecord[] } | null,
): OrganicPlayerView {
  const marketValue = Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0);
  const buyoutCost =
    typeof openBuyoutCost === "number" && Number.isFinite(openBuyoutCost) ? Math.max(0, openBuyoutCost) : 0;
  return {
    playerId: player.id,
    pow: player.coreStats?.pow ?? 0,
    spe: player.coreStats?.spe ?? 0,
    men: player.coreStats?.men ?? 0,
    soc: player.coreStats?.soc ?? 0,
    disciplineRatings: player.disciplineRatings ?? {},
    marketValue,
    salary: Math.max(0, player.salaryDemand ?? player.displaySalary ?? 0),
    purchasePrice:
      typeof purchasePrice === "number" && Number.isFinite(purchasePrice) ? Math.max(0, purchasePrice) : undefined,
    // Only a real clause (> 0) sets netSaleProceeds — otherwise leave it undefined so sellUtility keeps
    // using marketValue unchanged (net == marketValue when nothing is owed). Net may be negative when the
    // clause exceeds the price; sellUtility clamps that to 0.
    netSaleProceeds: buyoutCost > 0 ? marketValue - buyoutCost : undefined,
    // Eine Quelle: Potenzial aus dem Record (hiddenPotentialScore), nicht aus dem
    // Import-Altfeld player.potential — das wich am Live-Spielstand ligaweit vom
    // Modell ab (Median +16,1) und haette den wAsset-Term der Buy-Utility mit einer
    // anderen Zahl gefuettert, als Training/Anzeige fuehren. Ohne gameState (bzw.
    // ohne Record) bleibt das Signal null = unbekannt.
    potential: gameState ? resolvePlayerPotentialScoreFromGameState({ gameState, playerId: player.id }) : null,
    themeFit,
  };
}

/**
 * Maps a team-theme-composition-service `themeTier` to a 0..1 fit signal for the organic model.
 * Ordered by how central the tier is to the club's IDENTITY (not its market-value/quality override
 * eligibility). GRADED tag overlap so identity shows through the FLAVOUR, not just a gender flag:
 * a themed dark-fantasy player (e.g. a succubus with Succubus/Temptress/SexyDemon tags) scores far
 * above a plain primary-tag match (e.g. any female), and an avoid-tag player (e.g. a Construct on a
 * dark team) is pushed out — while a strongly-themed off-primary player (e.g. a male incubus) can
 * still rank above a plain primary match, so the roster leans ~primary but carries real theme flavour.
 */
const THEME_PRIMARY_WEIGHT = 0.7;
const THEME_SECONDARY_WEIGHT = 0.3;
const THEME_SECONDARY_CAP = 2;
const THEME_SOFT_WEIGHT = 0.1;
const THEME_SOFT_CAP = 2;
/** An allowed-outsider tag (e.g. V-D's male animal "pets") makes an off-primary player acceptable. */
const THEME_OUTSIDER_WEIGHT = 0.3;
const THEME_AVOID_PENALTY = 0.6;

/**
 * The configured team strictness scales how hard the theme bites: a "hard" 95%-quota club (e.g. V-D)
 * must land nearly all themed picks, a "soft" club only leans. Multiplies the raw fit (which may go
 * negative via avoid tags), so hard clubs get a strong positive pull for themed players and a strong
 * negative push against avoid-tag players, while soft clubs get a gentle nudge.
 */
const THEME_STRICTNESS_MULT: Record<string, number> = { hard: 8.0, strong: 2.4, medium: 1.2, soft: 0.7 };

/**
 * Push (in rawFit units) applied to a QUOTA VIOLATOR while the roster is still below its hard quota
 * floor (e.g. a non-Construct for S-S's ~50% Bot quota, a non-Pirate for P-C's ~50% Crew quota). Same
 * magnitude as an avoid-tag hit, so a below-quota club actively prefers quota-fit bodies until the floor
 * is met — then it vanishes and non-quota depth flows normally. Bounded, never a hard block (a much
 * stronger off-quota player can still win), so the squad stays organic.
 */
const THEME_QUOTA_VIOLATE_PENALTY = 0.6;

/**
 * Graded per-(team, player) theme-fit signal (0..1) from actual tag overlap between the player's
 * derived theme tags and the team's target tag sets. Reuses derivePlayerThemeTags (race/class/
 * subclass/gender/trait/alignment) — no reinvented theme rules. Callers build `runtimeContext` ONCE
 * per team and pass it in per candidate. Returns undefined when the team has no theme target.
 */
/**
 * Treffer einer Tag-Liste in der (gemeinsam genutzten) Tag-Menge eines Spielers, je Menge und Liste gemerkt: die Ziel-Listen
 * der Teams sind feste Arrays, der Draft fragt dieselbe Paarung je KI-Pick und Kandidat erneut (Draft-Tempo 21.11.).
 */
const THEME_TREFFER_CACHE = new WeakMap<Set<string>, WeakMap<string[], number>>();
function zaehleThemeTreffer(tags: Set<string>, list: string[]): number {
  let jeListe = THEME_TREFFER_CACHE.get(tags);
  if (!jeListe) {
    jeListe = new WeakMap();
    THEME_TREFFER_CACHE.set(tags, jeListe);
  }
  let n = jeListe.get(list);
  if (n == null) {
    n = list.reduce((summe, tag) => (tags.has(tag) ? summe + 1 : summe), 0);
    jeListe.set(list, n);
  }
  return n;
}

export function computeThemeFit(
  gameState: GameState,
  team: Pick<Team, "teamId" | "name">,
  player: Player,
  runtimeContext: TeamThemeCompositionRuntimeContext,
): number | undefined {
  const target = runtimeContext.target;
  if (!target) return undefined;
  const tags = themeTagSet(derivePlayerThemeTagsCached(player));
  const countMatches = (list: string[]) => zaehleThemeTreffer(tags, list);

  // Harte Rassen-/Tag-Quote (S-S ~50% Construct, P-C ~50% Pirate): eine "counts"-Rolle zaehlt wie ein
  // Primary-Treffer (so wird der Top-/Bestpick garantiert quota-fit), ein "violates"-Kandidat wird
  // unterhalb der Mindestquote wie ein Avoid-Tag nach hinten gedraengt. Oberhalb der Quote neutral.
  const quotaScoped = isQuotaScopedTarget(target);
  let quotaPrimary = 0;
  let quotaViolatePenalty = 0;
  if (quotaScoped) {
    const role = classifyIdentityQuotaRole(player, target);
    const currentShare = runtimeContext.rosterShare?.primaryShare ?? 0;
    const belowMinimum = currentShare + 1e-9 < target.minimumShare;
    if (role === "counts") quotaPrimary = 1;
    else if (role === "violates" && belowMinimum) quotaViolatePenalty = 1;
  }

  const primaryMatch = countMatches(target.primaryThemeTags) > 0 || quotaPrimary > 0 ? 1 : 0;
  const secondaryMatches = Math.min(countMatches(target.secondaryThemeTags), THEME_SECONDARY_CAP);
  const softMatches = Math.min(countMatches(target.softPreferredTags), THEME_SOFT_CAP);
  // Quoten-Kern-Spieler (role="counts", z.B. ein menschlicher Pirat, der ueber die "Royal"-Sammelregel
  // zufaellig einen Avoid-Tag traegt) duerfen NICHT durch Avoid entwertet werden — sonst kanzelt der
  // Kollateral-Avoid die Quote. Spiegelt hardIdentityOverride aus calculateThemeCompositionScore.
  const avoidMatches = quotaPrimary > 0 ? 0 : countMatches(target.avoidTags);
  // Off-primary but explicitly allowed (e.g. a female-Amazon team's male animal pets): acceptable,
  // not preferred over themed primary players.
  const outsiderMatch = !primaryMatch && countMatches(target.allowedOutsiderTags) > 0 ? 1 : 0;

  // For a HARD-strictness QUOTA club, secondary/soft tags are FLAVOUR ON TOP OF the primary tag, not
  // standalone credit: an off-primary player must not earn theme pull just for sharing a secondary tag
  // (e.g. a non-Viking Berserker on a ~75%-Viking club). Otherwise, when the primary tag is RARE
  // (few cheap Vikings), strong off-primary secondary-sharers out-compete and drain the budget before
  // the quota is met. So off-primary players on a hard club get only the (small) allowed-outsider
  // credit minus avoid — reserving preference + budget for genuine primary-tag players. Softer clubs
  // keep the graded "leans toward flavour" behaviour where secondary tags count on their own.
  const hardQuota = target.strictness === "hard";
  const flavourCounts = hardQuota && !primaryMatch ? 0 : 1;
  const rawFit =
    THEME_PRIMARY_WEIGHT * primaryMatch +
    THEME_SECONDARY_WEIGHT * secondaryMatches * flavourCounts +
    THEME_SOFT_WEIGHT * softMatches * flavourCounts +
    THEME_OUTSIDER_WEIGHT * outsiderMatch -
    THEME_AVOID_PENALTY * avoidMatches -
    THEME_QUOTA_VIOLATE_PENALTY * quotaViolatePenalty;
  const strictnessMult = THEME_STRICTNESS_MULT[target.strictness] ?? 1;
  // May be negative (avoid) for hard clubs, so buyUtility actively pushes those players out. Ceiling
  // is generous (×THEME_FIT_VALUE downstream) so a HARD-strictness quota club (V-V ~75% Viking, V-D
  // ~95% female) pulls themed players strongly enough to act quota-like — a themed candidate then out-
  // scores a moderately-stronger off-theme one — while medium/soft clubs (low mult) stay a gentle tilt.
  return Math.min(6, Math.max(-2, strictnessMult * rawFit));
}

/** Team playstyle axis emphasis from identity.pow/spe/men/soc, normalized to sum 1 (fallback equal). */
export function buildIdentityAxisWeights(identity: TeamIdentity | null | undefined): Record<CoreAxis, number> {
  const raw: Record<CoreAxis, number> = {
    pow: Math.max(0, identity?.pow ?? 0),
    spe: Math.max(0, identity?.spe ?? 0),
    men: Math.max(0, identity?.men ?? 0),
    soc: Math.max(0, identity?.soc ?? 0),
  };
  const sum = raw.pow + raw.spe + raw.men + raw.soc;
  if (sum <= 0) return { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };
  return { pow: raw.pow / sum, spe: raw.spe / sum, men: raw.men / sum, soc: raw.soc / sum };
}

/** gameState disciplines → the minimal {id, category} the engine needs. */
export function resolveOrganicDisciplines(gameState: GameState): OrganicDiscipline[] {
  return (gameState.disciplines ?? []).map((d) => ({ id: d.id, category: d.category }));
}

function resolveGmBias(gameState: GameState, teamId: string): OrganicGmBiasInput {
  const bias = getTeamGeneralManager(gameState, teamId)?.profile?.bias;
  if (!bias) return {};
  return {
    starPriority: bias.starPriority,
    valuePriority: bias.valuePriority,
    cashPriority: bias.cashPriority,
    riskTolerance: bias.riskTolerance,
    rosterDepthPreference: bias.rosterDepthPreference,
    eliteSmallRosterPreference: bias.eliteSmallRosterPreference,
    loyaltyBias: bias.loyaltyBias,
    wageSensitivity: bias.wageSensitivity,
    sellForProfitAggression: bias.sellForProfitAggression,
    shortContractPreference: bias.shortContractPreference,
    longContractPreference: bias.longContractPreference,
  };
}

/** Identity → the minimal management-scale inputs the weight/contract-length derivations read. */
function buildOrganicIdentityInput(identity: TeamIdentity | null | undefined): OrganicIdentityInput {
  return {
    ambition: identity?.ambition ?? 50,
    finances: identity?.finances ?? 55,
    boardConfidence: identity?.boardConfidence ?? 50,
    harmony: identity?.harmony ?? 50,
    playerOpt: identity?.playerOpt ?? 10,
  };
}

export type OrganicDraftPlanInput = {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
  /** Players already on the roster (their disciplines count toward coverage). */
  startingSquad: Player[];
  /** Available free agents to choose from. */
  candidates: Player[];
  /** Conservative forecast planning inputs (refined in P3). */
  forecast?: {
    expectedPrize?: number;
    sponsorIncome?: number;
    facilityNet?: number;
    netTransfer?: number;
  };
  /** Optional per-(save, team) seed for the reproducible buy-utility jitter (see draft-builder.ts). */
  draftSeed?: string | null;
  /**
   * Liga-Draft im Einzelschritt (lib/draft/liga-draft-ki.ts): die Superstar-Lizenz wird EINMAL zu Draft-Beginn
   * vergeben und dann festgehalten. Sonst würde sie mit jedem Pick neu ausgewürfelt (die Lizenzrechnung liest Kasse und
   * Kader ALLER Teams), und ein Team könnte seine Lizenz mitten im Draft verlieren. `undefined` = wie bisher rechnen.
   */
  superstarLizenz?: boolean;
  /**
   * KADERPLAN (s. `istKaderplanAktiv`): Preise des Pools zu DRAFT-BEGINN (aufsteigend, s. `kaderplanPlatzPreise`),
   * damit Block und Einzelschritt mit demselben Platzpreis planen. Fehlt sie, gilt der aktuelle Pool.
   */
  platzPreise?: number[];
  /** KADERPLAN: Teams, die im Einzelschritt-Draft noch reihum picken (s. `economy.platzWettbewerb`). */
  platzWettbewerb?: number;
};

/**
 * KADERPLAN: Platzpreis-Liste aus einem Pool (Marktwert > 0, aufsteigend). Aufrufer reichen den Pool zu Beginn des
 * Drafts bzw. des Kauffensters herein, nicht den Restpool.
 */
export function kaderplanPlatzPreise(pool: readonly Player[]): number[] {
  return pool
    .map((player) => Math.max(0, player.marketValue ?? player.displayMarketValue ?? 0))
    .filter((wert) => wert > 0)
    .sort((left, right) => left - right);
}

export type OrganicDraftPlanResult = {
  decisions: OrganicBuyDecision[];
  finalCash: number;
  finalSalaryTotal: number;
  finalRosterSize: number;
  stoppedBelowMin: boolean;
  optTarget: number;
  /**
   * Debug/diagnostics snapshot of the SALCEIL computation actually applied this call (undefined when
   * OLY_SALARY_CEILING_V2="0") — see salary-ceiling.ts computeTeamSalaryCeiling. Exposed so callers (e.g.
   * scripts/long-run-sandbox-s1-s6.ts's per-team economy rows) can print salaryCeiling vs actual salary
   * without recomputing it.
   */
  salaryCeilingDebug?: ReturnType<typeof computeTeamSalaryCeiling>;
  /** Finanzkonzept V2 Stufe 1: die Finanzwert-Ruecklage dieses Aufrufs (undefined bei `OLY_KI_RUECKLAGE_V2=0`). */
  ruecklageDebug?: KiRuecklageErgebnis;
  /** Finanzkonzept V2 Stufe 3: Vorstand-Freigabe dieses Aufrufs und das gesperrte Geld (C). */
  vorstandDebug?: VorstandBudgetStand;
  /** Finanzkonzept V2 Stufe 2: der in den Forecast eingespeiste erwartete Sponsor (C). */
  sponsorForecast?: number;
  /** KADERPLAN: Grund der Kadergroesse (nur mit Kaderplan, s. `istKaderplanAktiv`), mit der GM-Entscheidung zum Opt. */
  kaderplan?: KaderplanProtokoll & { optEntscheidung?: KaderplanOptEntscheidung };
};

/**
 * Team-level scalar context shared by the draft (buy) planner and the in-season sell planner: the
 * derived utility weights, identity axis weights, discipline catalog, theme runtime context, and the
 * team economy scalars (cash / cash buffer / board risk / roster max). Squad-specific inputs
 * (starting squad views, salary total, candidate views) are built per planner from their own player
 * lists; only this identity/economy assembly is common, so it is factored out here rather than
 * duplicated between the two planners.
 */
type OrganicPlanContext = {
  weights: OrganicUtilityWeights;
  identityAxisWeights: Record<CoreAxis, number>;
  disciplines: OrganicDiscipline[];
  themeRuntimeContext: TeamThemeCompositionRuntimeContext;
  cash: number;
  /** Small flat solvency buffer (the only cash hard blocker). */
  cashBuffer: number;
  boardRisk: number;
  rosterMax: number;
};

function buildOrganicPlanContext(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
  /** Optional per-(save, team) seed for the reproducible strategy-weight jitter (see weights.ts). */
  draftSeed?: string | null;
}): OrganicPlanContext {
  const identityInput = buildOrganicIdentityInput(input.identity);
  // Per-save/season strategy variance: same team identity + GM handwriting, but a slightly different
  // "budget feel" across saves/seasons (see STRATEGY_WEIGHT_JITTER/STRATEGY_OPT_JITTER in weights.ts).
  const variationSeed = input.draftSeed ? `${input.draftSeed}:${input.gameState.season.id}` : null;
  const weights = deriveUtilityWeights(
    identityInput,
    resolveGmBias(input.gameState, input.team.teamId),
    variationSeed,
  );
  return {
    weights,
    identityAxisWeights: buildIdentityAxisWeights(input.identity),
    disciplines: resolveOrganicDisciplines(input.gameState),
    // Build the team's theme runtime context ONCE (cached rosterShare/themedPoolCount), then reuse it
    // for every candidate's themeFit lookup — never recomputed per player.
    themeRuntimeContext: buildTeamThemeCompositionRuntimeContext(input.gameState, input.team),
    cash: input.team.cash ?? 0,
    // Solvency buffer = max(flat floor, 0.35× wage bill). The salary-scaled part makes even aggressive
    // clubs keep a reserve proportional to what they must pay each season, instead of spending to ~0 and
    // stranding themselves below min next window; it also sharpens the sell distress factor for
    // over-salaried clubs. How much a club keeps ABOVE the buffer stays emergent (wPatience).
    cashBuffer: Math.max(
      ORGANIC_CASH_BUFFER,
      RESERVE_SALARY_FACTOR * resolveRosterSalaryTotal(input.gameState, input.team.teamId),
    ),
    boardRisk: 1 - normId(input.identity?.boardConfidence),
    rosterMax: Math.min(ROSTER_MAX, input.team.rosterLimit ?? ROSTER_MAX),
  };
}

/**
 * Der eingefrorene Planrahmen eines Teams: alles, was `buildOrganicSquadPlan` als Eingabe bekommt (Kandidaten als
 * Sichten, Startkader, Gewichte, Ökonomie, Komposition), plus die Diagnosewerte. `planOrganicDraftForTeam` baut ihn und
 * lässt die Schleife darauf laufen; der Liga-Draft im Einzelschritt (lib/draft/liga-draft-ki.ts) baut ihn je Pick neu
 * und macht nur EINEN Schritt (`organicBuyStep`). Eine Quelle für beide Wege.
 */
/** KADERPLAN: Ziel-Kader aus Identitaet (Blatt + GM-Tiefe) und die bewusste GM-Senkung (s. gmKaderOptAnpassung). */
export type KaderplanOptEntscheidung = { identitaetsOpt: number; optTarget: number; gmDelta: number; grund: string | null };

export type OrganicDraftFrame = {
  optEntscheidung?: KaderplanOptEntscheidung;
  planInput: OrganicSquadPlanInput;
  optTarget: number;
  /** Die Ruecklage, mit der geplant wird (in Saison 1 halbiert, s. unten). */
  ruecklage: number;
  /** Superstar-Lizenz dieses Aufrufs (`null`, wenn die Komposition aus ist). */
  superstarLizenz: boolean | null;
  salaryCeilingDebug?: ReturnType<typeof computeTeamSalaryCeiling>;
  ruecklageDebug?: KiRuecklageErgebnis;
  vorstandDebug: VorstandBudgetStand;
  sponsorForecast?: number;
};

/**
 * SAISON 1: DRAFT-RUECKLAGE UND GEHALTSPUFFER HALB (Chris, 18.11., zwei Entscheidungen: Finanzkonzept V2 „Draft-
 * Ruecklage halb“ und Draft-Mockup Frage 9 „auch den Gehaltspuffer halbieren“). Die Ruecklage ist
 * max(q × Budget, 0,35 × Zielgehalt) — der zweite Term IST der Gehaltspuffer. Der Faktor wirkt auf das Maximum, also auf
 * beide Terme zugleich: welcher auch bindet, er zählt in Saison 1 nur halb. Ab Saison 2 voll.
 */
export const SAISON_EINS_RUECKLAGE_FAKTOR = 0.5;

export function istSaisonEins(gameState: Pick<GameState, "season">): boolean {
  return /(\d+)\s*$/.exec(gameState.season?.id ?? "")?.[1] === "1";
}

/**
 * KADERPLAN (docs/design/ki-pick-analyse-18-11.md): im Saison-1-Setup-Draft Standard AN (`OLY_KI_KADERPLAN=0` schaltet ab).
 *
 * Ab Saison 2 im gemeinsamen Transferfenster ebenfalls AN (`docs/design/fenster-auf-opt-18-11.md`, Schalter `istFensterAufOpt`,
 * `OLY_FENSTER_AUF_OPT=0` stellt „nur Saison 1" her). Die fruehere Begrenzung auf Saison 1 (Review S3: die Gehaltsseite der
 * Plaetze bis Opt war im Gehaltstopf nicht reserviert) ist aufgehoben: `kaderplanRahmen` reserviert seit dem 18.11. Ablose UND
 * Gehalt der Plaetze bis Opt gegen die Kaderpflicht-Grenze (`kaufRahmen().grenzeFuer`) bzw. die Toepfe.
 * Ab Saison 2 kauft die KI nur im Fenster; jeder Aufruf des Planers ab Saison 2 ist ein Fenster-Kauf (Kaufrunde, Nachrunde,
 * Kreditprobe, „KI picken").
 */
export function istKaderplanAktiv(gameState: Pick<GameState, "season">): boolean {
  if (!istKaderplanSchalterAn()) return false;
  return istSaisonEins(gameState) || istFensterAufOpt();
}

/** Assemble utility inputs from gameState and run the greedy organic plan for one team. */
export function planOrganicDraftForTeam(input: OrganicDraftPlanInput): OrganicDraftPlanResult {
  const frame = buildOrganicDraftFrame(input);
  const result = buildOrganicSquadPlan(frame.planInput);
  return {
    decisions: result.decisions,
    finalCash: result.finalCash,
    finalSalaryTotal: result.finalSalaryTotal,
    finalRosterSize: result.finalSquad.length,
    stoppedBelowMin: result.stoppedBelowMin,
    optTarget: frame.optTarget,
    salaryCeilingDebug: frame.salaryCeilingDebug,
    ruecklageDebug: frame.ruecklageDebug,
    vorstandDebug: frame.vorstandDebug,
    sponsorForecast: frame.sponsorForecast,
    kaderplan: result.kaderplan ? { ...result.kaderplan, optEntscheidung: frame.optEntscheidung } : undefined,
  };
}

/** Baut den Planrahmen (Eingabe der Greedy-Schleife) aus dem Spielstand, ohne zu planen. */
export function buildOrganicDraftFrame(input: OrganicDraftPlanInput): OrganicDraftFrame {
  const ctx = buildOrganicPlanContext({
    gameState: input.gameState,
    team: input.team,
    identity: input.identity,
    draftSeed: input.draftSeed ?? null,
  });
  const startingSquad = input.startingSquad.map((player) => toOrganicPlayerView(player, undefined, undefined, undefined, input.gameState));
  const candidates = input.candidates
    .map((player) =>
      toOrganicPlayerView(
        player,
        computeThemeFit(input.gameState, input.team, player, ctx.themeRuntimeContext),
        undefined,
        undefined,
        input.gameState,
      ),
    )
    .filter((view) => view.marketValue > 0);
  const salaryTotal = startingSquad.reduce((sum, view) => sum + view.salary, 0);

  // FINANZKONZEPT V2 (Stufe 1 bis 3), alles per Env einzeln abschaltbar fuer den A/B-Vergleich.
  //  Stufe 1: Ruecklage nach Finanzwert (Budget = Kasse + Kaderwert, Zielgehalt statt Gehalt des leeren Kaders).
  //  Stufe 3: der Vorstand sperrt vom Geld UEBER der Ruecklage den Anteil (1 - Freigabe); das Team plant mit
  //           der Kasse abzueglich der Sperre, der Rest-Betrag wird am Ende wieder aufgeschlagen.
  let ruecklageDebug: KiRuecklageErgebnis | undefined;
  if (istKiRuecklageV2Aktiv()) {
    ruecklageDebug = resolveKiRuecklageFuerTeam(input.gameState, input.team.teamId, {
      cash: ctx.cash,
      rosterSalaryTotal: resolveRosterSalaryTotal(input.gameState, input.team.teamId),
      rosterMarketValue: startingSquad.reduce((sum, view) => sum + view.marketValue, 0),
      finances: input.identity?.finances,
    });
  }
  // Chris 18.11. (Zwei-Budget-Entscheid): in Saison 1 ist die Draft-Ruecklage um 50 % geringer, ab Saison 2 gilt sie voll.
  const ruecklageRoh = (ruecklageDebug?.ruecklage ?? 0) * (istSaisonEins(input.gameState) ? SAISON_EINS_RUECKLAGE_FAKTOR : 1);
  // Stufe 3 (hart): der Vorstand gibt nur `nochFrei` zum Ausgeben (Ablosen + Jahresgehaelter) frei; das Geld bleibt auf dem Konto.
  const vorstand = berechneVorstandBudgetStand(input.gameState, input.team.teamId);
  // Ab Saison 2 steckt die Ruecklage schon im Transfertopf des Vorstands (Kasse - Ruecklage - Gehaltspuffer); die KI haelt sie nicht
  // ein zweites Mal als eigenen Puffer (Messung 18.11.: doppelt gezaehlt kostete -6 % Kaderstaerke).
  const ruecklage = vorstand.gedeckelt ? 0 : ruecklageRoh;
  const kaufRahmenFuerPlan = kaufRahmen(input.gameState, input.team.teamId);
  const feeCap = vorstand.gedeckelt ? vorstand.investition.frei : undefined;
  const salaryCap = vorstand.gedeckelt ? vorstand.gehalt.frei : undefined;
  const planCash = ctx.cash;
  const planCashBuffer = Math.max(ctx.cashBuffer, ruecklage);
  const sponsorForecast =
    istSponsorForecastAktiv() && input.forecast?.sponsorIncome === undefined
      ? erwarteterSponsorFuerPlanung(input.gameState, input.team.teamId)
      : undefined;

  // ANPASSUNG B: cash-scaled opt-trim. If the club can't fund Depth-grade bodies across every open slot,
  // trim optTarget by up to 2 (never below ROSTER_MIN) so per-slot budget rises and Depth becomes
  // affordable — fewer, better bodies instead of a Reserve tail. Rich clubs get strain 0 (untouched).
  let planWeights = ctx.weights;
  const kaderplan = istKaderplanAktiv(input.gameState);
  if (FILLQ_B_ENABLED) {
    const slotsToFill = Math.max(1, ctx.weights.optTarget - startingSquad.length);
    const budgetPerSlot = (planCash - ORGANIC_CASH_BUFFER) / slotsToFill;
    const strain = Math.min(1, Math.max(0, 1 - budgetPerSlot / DEPTH_REF_COST));
    // Review K5: mit Kaderplan nie unter Minimum + 1 (Chris: „es wird nie nur bis zum Minimum gepickt"); ohne wie bisher.
    const untergrenze = kaderplan ? Math.min(ctx.weights.optTarget, ROSTER_MIN + 1) : ROSTER_MIN;
    const trimmedOpt = Math.max(untergrenze, ctx.weights.optTarget - Math.round(2 * strain));
    if (trimmedOpt !== ctx.weights.optTarget) {
      planWeights = { ...ctx.weights, optTarget: trimmedOpt };
    }
  }

  // KADERPLAN: bewusste GM-Entscheidung „weniger, dafuer staerker" (hoechstens −2, nie unter Minimum + 1), protokolliert.
  // Mit der (standardmaessig abgeschalteten) Geld-Senkung FILLQB davor gilt die Grenze fuer BEIDE zusammen: hoechstens −2 gegen
  // den Identitaets-Opt, nie unter Minimum + 1 (Review K5).
  // Oekonomie des Plans fuer ein gegebenes Ziel (`weights`). Eine Funktion, damit die Rahmen-Probe der Fenster-Senkung (unten)
  // mit genau derselben Kasse, denselben Toepfen und derselben Kaderpflicht-Grenze rechnet wie der Plan selbst.
  const economyFuer = (weights: typeof planWeights, salaryCeiling: number | undefined): OrganicSquadPlanInput["economy"] => ({
    cash: planCash,
    cashBuffer: planCashBuffer,
    salaryTotal,
    boardRisk: ctx.boardRisk,
    expectedPrize: input.forecast?.expectedPrize ?? 0,
    sponsorIncome: input.forecast?.sponsorIncome ?? sponsorForecast ?? 0,
    facilityNet: input.forecast?.facilityNet ?? 0,
    netTransfer: input.forecast?.netTransfer ?? 0,
    weights,
    rosterMax: ctx.rosterMax,
    rosterMin: ROSTER_MIN,
    salaryCeiling,
    // Reserve is spendable while building from min→opt: keep only the flat solvency floor here so a
    // team actually reaches its target squad, then holds the full salary-scaled reserve above opt.
    solvencyFloor: Math.max(ORGANIC_CASH_BUFFER, ruecklage),
    // Ruecklage gilt auch beim Auffuellen bis zum Kader-Minimum (faellt auf Floor 0 zurueck, wenn das Minimum sonst
    // nicht erreichbar waere). Ohne Stufe 1 undefined => bit-gleich zu vorher.
    minFillFloor: ruecklage > 0 ? ruecklage : undefined,
    feeCap,
    salaryCap,
    platzPreise: input.platzPreise,
    platzWettbewerb: input.platzWettbewerb,
    kaufGrenze: kaufRahmenFuerPlan.gedeckelt ? kaufRahmenFuerPlan.grenzeFuer : undefined,
    // Feinschliff (19.11.): Notruecklage nur, wenn der Vorstand deckelt (ab Saison 2); der Builder liest sie nur mit Kaderplan.
    notruecklage: vorstand.gedeckelt ? vorstand.kaderpflicht?.notruecklage : undefined,
  });

  let optEntscheidung: KaderplanOptEntscheidung | undefined;
  let gmOptGesenkt = false;
  if (kaderplan) {
    const anpassung = gmKaderOptAnpassung({
      bias: getTeamGeneralManager(input.gameState, input.team.teamId)?.profile?.bias ?? null,
      opt: planWeights.optTarget,
      rosterMin: ROSTER_MIN,
    });
    const identitaetsOpt = ctx.weights.optTarget;
    const opt = Math.max(anpassung.opt, identitaetsOpt - GM_OPT_SENKUNG_MAX, Math.min(identitaetsOpt, ROSTER_MIN + 1));
    gmOptGesenkt = anpassung.delta < 0 && opt < identitaetsOpt;
    optEntscheidung = { identitaetsOpt, optTarget: opt, gmDelta: opt - identitaetsOpt, grund: anpassung.grund };
    if (opt !== planWeights.optTarget) planWeights = { ...planWeights, optTarget: opt };
  }

  // FENSTER AUF OPT, Hebel (b) (PM-Entscheidung 19.11. im Rahmen von Chris' Regel „GM darf Opt um bis zu 2 senken, bewusst einen
  // weniger dafuer staerker; aber nie nur bis Minimum"): traegt der Rahmen die Plaetze bis Opt nur zu Fuellerpreisen (< Platzpreis
  // 12), senkt der GM das Ziel — hoechstens bis zur bestehenden Grenze (Identitaets-Opt − 2, nie unter Minimum + 1) — auf das groesste
  // Ziel, das der Rahmen ganz zum Platzpreis traegt, und kauft dafuer staerkere Spieler. Nur im Fenster ab Saison 2: der
  // Saison-1-Draft plant aus dem vollen Startbudget und bleibt unveraendert. `docs/design/fenster-auf-opt-18-11.md` Abschnitt 3a.
  if (kaderplan && optEntscheidung && !istSaisonEins(input.gameState) && startingSquad.length < planWeights.optTarget) {
    const identitaetsOpt = optEntscheidung.identitaetsOpt;
    const boden = Math.max(identitaetsOpt - GM_OPT_SENKUNG_MAX, Math.min(identitaetsOpt, ROSTER_MIN + 1));
    // Feinschliff (19.11.): mit EINEM Platz Luft — das Ziel gilt nur als getragen, wenn der Rahmen auch noch einen weiteren Platz
    // zum Platzpreis traegt. Der Planer kauft vor dem letzten Platz staerkere (teurere) Spieler als die reservierten billigsten
    // 12er; auf Kante gerechnet reichte es fuer den letzten Platz dann nur fuer einen Fueller (gemessen 3 / 5 `fueller_rueckfall`).
    const rosterMax = ctx.rosterMax ?? ROSTER_MAX;
    const traegtZumPlatzpreis = (opt: number): boolean => {
      if (startingSquad.length >= opt) return true;
      const mitLuft = Math.min(opt + 1, rosterMax);
      const probe: OrganicSquadPlanInput = {
        startingSquad,
        candidates,
        identityAxisWeights: ctx.identityAxisWeights,
        disciplines: ctx.disciplines,
        economy: economyFuer({ ...planWeights, optTarget: mitLuft }, undefined),
        draftSeed: null,
        kaderplan: { gmOptGesenkt: true },
      };
      return kaderplanRahmen(probe, createOrganicPlanStepState(probe)).plaetze >= mitLuft;
    };
    const vorher = planWeights.optTarget;
    let opt = vorher;
    while (opt > boden && !traegtZumPlatzpreis(opt)) opt -= 1;
    if (opt < vorher) {
      gmOptGesenkt = true;
      planWeights = { ...planWeights, optTarget: opt };
      const rahmenText = `Rahmen traegt Opt ${vorher} nur mit Fuellern: Opt ${vorher} -> ${opt}, weniger Spieler, dafuer staerker`;
      optEntscheidung = {
        identitaetsOpt,
        optTarget: opt,
        gmDelta: opt - identitaetsOpt,
        grund: optEntscheidung.grund ? `${optEntscheidung.grund}; ${rahmenText}` : `GM ${rahmenText}`,
      };
    }
  }

  // ANPASSUNG COMPOSE (flag-gated): derive an EXPLICIT target role pyramid for this team and hand it to
  // buildOrganicSquadPlan as a soft utility nudge (see composition-plan.ts + utility.ts compositionValue).
  // Reuses the SAME premium-appetite/cap derivation the S1/S2 market-pick planner already uses — no new
  // magic numbers here. Deliberately built AFTER the FILLQ_B opt-trim above so the plan targets the final
  // (possibly trimmed) optTarget, not the pre-trim one.
  let composition: { counts: Record<MarketBracketLane, number>; brackets: ReturnType<typeof buildLeagueMarketBrackets> } | undefined;
  let superstarLizenz: boolean | null = null;
  if (COMPOSE_ENABLED) {
    const brackets = buildLeagueMarketBrackets(candidates.map((view) => view.marketValue));
    const existingTiers: Record<MarketBracketLane, number> = {
      superstar: 0,
      star: 0,
      core: 0,
      depth: 0,
      backup: 0,
      reserve: 0,
    };
    for (const view of startingSquad) {
      existingTiers[classifyCompositionLane(view.marketValue, brackets)] += 1;
    }
    // computeIdentityLaneAppetite + applyGmBiasToLaneAppetite already derive premiumCap/superstarCap
    // internally via deriveLaneCapsFromAppetite (ai-needs-picks-compare-service.ts:2063,2090,2141) — the
    // returned lanePhilosophy.premiumCap/premiumAppetite ARE that function's output for the final (post-GM-
    // tilt) premiumAppetite, so reading them off lanePhilosophy directly avoids a redundant second call.
    // superstarCap, however, is NOT taken from lanePhilosophy any more (see MARQUEE license derivation
    // below) — the identity-only premiumAppetite formula folds `(1 − financesN)` in, so it systematically
    // under-scores exactly the richest star-chasing clubs for the Superstar slot; premiumCap/Star stay on
    // the original appetite path (that balancing knob is unaffected, only Superstar moves to the league
    // license).
    const gmProfile = getTeamGeneralManager(input.gameState, input.team.teamId)?.profile ?? null;
    const lanePhilosophy = applyGmBiasToLaneAppetite(computeIdentityLaneAppetite(input.identity ?? null), gmProfile);

    // League-scaled marquee target price: MARQUEE_TARGET_MW_FLOOR (~75) is only a LOWER bound — the actual
    // price rides the league's own top-end candidate pricing (98th percentile), so a late-season inflated
    // league naturally prices its marquee at ~85-90 MW instead of staying pinned at the S1 floor forever.
    // Computed once per call from THIS team's candidate pool and reused for every team below (a league-wide
    // scalar this draft pass, not a per-team one — matches how `brackets` itself is reused).
    const marqueeTargetMw = Math.max(
      MARQUEE_TARGET_MW_FLOOR,
      quantilePrice(candidates.map((view) => view.marketValue), 0.98),
    );

    // MARQUEE league license derivation (marquee-eligibility.ts): built fresh from gameState on every call,
    // over ALL teams, so — being a pure function of gameState — it returns the SAME license set for every
    // team call that sees the same gameState snapshot (a scarce league-wide resource, not a per-team roll).
    // Because this runs once per team INSIDE a sequential draft pass, gameState (rosters/cash) shifts a
    // little call to call as earlier teams' picks land, so the license set can drift slightly over the
    // course of one pass — acceptable here (same tradeoff `brackets` above already makes) since the goal is
    // "the league licenses ~2-3 teams this pass", not perfect single-snapshot simultaneity.
    const leagueInput: MarqueeLicenseTeamInput[] = (input.gameState.teams ?? []).map((leagueTeam) => {
      const leagueIdentity = (input.gameState.teamIdentities ?? []).find((i) => i.teamId === leagueTeam.teamId) ?? null;
      const leagueGmProfile = getTeamGeneralManager(input.gameState, leagueTeam.teamId)?.profile ?? null;
      const rosterMarketValues = resolveRosterMarketValues(input.gameState, leagueTeam.teamId);
      const rosterSize = rosterMarketValues.length;
      const leagueSlotsToFill = Math.max(1, (leagueIdentity?.playerOpt ?? ROSTER_MIN) - rosterSize);
      const ssPlanCost = marqueeTargetMw + Math.max(0, leagueSlotsToFill - 1) * brackets.depth.floorMw;
      return {
        teamId: leagueTeam.teamId,
        ambitionN: normId(leagueIdentity?.ambition),
        starPriority: leagueGmProfile?.bias?.starPriority ?? 5,
        archetype: leagueGmProfile?.archetype ?? "",
        spendableNet: (leagueTeam.cash ?? 0) - ORGANIC_CASH_BUFFER,
        ssPlanCost,
        existingSuperstarCount: rosterMarketValues.filter((mv) => mv >= brackets.superstar.floorMw).length,
      };
    });
    const licenses = deriveLeagueSuperstarLicenses(leagueInput);
    superstarLizenz = input.superstarLizenz ?? licenses.has(input.team.teamId);

    const counts = deriveCompositionCounts({
      optTarget: planWeights.optTarget,
      existingTiers,
      spendableNet: planCash - Math.max(ORGANIC_CASH_BUFFER, ruecklage),
      brackets,
      premiumAppetite: lanePhilosophy.premiumAppetite,
      premiumCap: lanePhilosophy.premiumCap,
      superstarCap: superstarLizenz ? 1 : 0,
      rosterMin: ROSTER_MIN,
      marqueeTargetMw,
    });
    composition = { counts, brackets };
  }

  // ANPASSUNG SALCEIL (flag-gated OLY_SALARY_CEILING_V2, default AUS nach A/B — see salary-ceiling.ts and the flag
  // doc above). Computed AFTER composition (order doesn't matter between them — independent inputs) but
  // before the plan call since buildOrganicSquadPlan needs it on economy. An ADDITIONAL cap on top of the
  // existing cash/fee budgeting (never a replacement) — see draft-builder.ts's salaryCeilingActive gate.
  const salaryCeilingDebug = SALARY_CEILING_V2_ENABLED
    ? computeTeamSalaryCeiling(input.gameState, input.team.teamId, { teamCash: planCash })
    : undefined;

  const planInput: OrganicSquadPlanInput = {
    startingSquad,
    candidates,
    identityAxisWeights: ctx.identityAxisWeights,
    disciplines: ctx.disciplines,
    composition,
    economy: economyFuer(planWeights, salaryCeilingDebug?.salaryCeiling),
    draftSeed: input.draftSeed ?? null,
    // Nur gesetzt, wenn der Kaderplan laeuft (sonst fehlt das Feld: Builder bit-gleich zum Stand davor).
    ...(kaderplan ? { kaderplan: { gmOptGesenkt } } : {}),
  };

  return {
    planInput,
    optTarget: planWeights.optTarget,
    ruecklage,
    superstarLizenz,
    optEntscheidung,
    salaryCeilingDebug,
    ruecklageDebug,
    vorstandDebug: vorstand,
    sponsorForecast,
  };
}

/**
 * Small positive sell-utility floor: a player is only sold when its sellUtility STRICTLY exceeds this.
 * sellUtility already goes negative for a key starter (high wWin·ΔStrength loss beats its wThrift·sale
 * value), so this floor mainly stops churning out ~break-even bodies; the real "keep vs. sell" line is
 * the utility sign, not this constant.
 */
const SELL_THRESHOLD = 0;

/**
 * RELAXED sell floor used ONLY while the roster still sits ABOVE the team's own optTarget (see the sell
 * loop below). "Über-opt = Überschuss abschälen, Slot freimachen": a team above its opt is carrying
 * surplus it doesn't need for its own (GM/identity-derived) target size, so it should shed weak/redundant
 * bodies toward opt even when they don't clear the normal profit/coverage SELL_THRESHOLD — the freed slot
 * and cash are the point, not a break-even sale. optTarget already encodes the archetype (elite_curator
 * ~8, depth_spammer ~14), so shedding toward it is automatically identity-aware: a small-elite club sheds
 * hard down to its lean core, a broad club barely sheds at all once it's within its own (larger) opt.
 * Deliberately still a real floor, not -Infinity: a sole-coverage player or a key starter scores strongly
 * negative sellUtility (large wWin·ΔStrength loss), well below this line, so the core and discipline
 * coverage stay protected even under opt-surplus pressure — only genuinely weak/duplicated surplus clears
 * it. Tuned empirically against the lean-transition harness (see draft-adapter tests / balancing notes).
 */
const OPT_SURPLUS_SELL_THRESHOLD = -18;

/**
 * Small additive jitter (in sellUtility units) applied ONLY inside the greedy sell comparison, keyed by
 * `${draftSeed}:${playerId}` (hash-based, reproducible — no Math.random). Mirrors ORGANIC_DRAFT_JITTER
 * in draft-builder.ts but for the sell path, with its OWN env knob so buy/sell variance can be tuned
 * independently. Default 8 — deliberately WEAKER than the buy default (15): selling is more consequential
 * (shedding a real body), so the jitter only nudges WHICH near-equal surplus/flip gets shed, never flips
 * a clear keep-vs-sell call. Only engages when a draftSeed is passed (real runs); pure unit tests pass no
 * seed and stay deterministic. ENV-overridable (OLY_ORGANIC_SELL_JITTER, 0 disables).
 */
const ORGANIC_SELL_JITTER = Number(process.env.OLY_ORGANIC_SELL_JITTER ?? 8) || 0;

/**
 * WEAK-TEAM UPGRADE SWAP (flag OLY_WEAK_TEAM_UPGRADE_SWAP, default ON; =0 opts out).
 *
 * Multi-season measurement showed the "poor get poorer" driver behind a widening top/bottom wealth gap
 * (Schere > 2×): weak clubs bank sponsor income they never convert into squad value. Their cash/MW ran
 * ~0.8–1.1 (cash worth as much as the whole squad) vs ~0.5 for strong clubs, and their market value
 * stagnated season over season. Root cause: the sell loop below NEVER sheds at/below optTarget ("refilling
 * below opt is the buy side's job"), so a club sitting at opt with a weak, cheap core sells nobody, the
 * additive preseason buy has no free slot to upgrade into, and the club hoards cash forever.
 *
 * Fix: after the normal surplus/profit sells, a cash-rich HOARDER (high cash/MW) sitting at/below opt sheds
 * its single least-valuable KEEPER (highest sellUtility among the remaining held — the body whose removal
 * costs the least strength) to FREE a slot. The preseason organic buy cycle then refills that slot with the
 * best player the hoarded cash can afford → cash converts into market value, lifting the bottom of the table.
 *
 * Self-targeting + conservative: the cash/MW gate only fires for genuine hoarders, so strong clubs (low
 * cash/MW) are untouched; it only runs at SEASON END (allowBelowMin, so the freed slot is safely refilled in
 * preseason, never mid-window); it is bounded to 1–2 swaps/season; and it only fires when the hoarded cash
 * can actually fund a MEANINGFUL upgrade over the shed body (uplift gate), never a lateral churn.
 */
// DEFAULT OFF (opt-in via OLY_WEAK_TEAM_UPGRADE_SWAP=1). A same-seed A/B showed this swap is NET-NEGATIVE:
// bottom-5 clubs ended ~20 MW LOWER with it on than off. The "weakest keeper" it sheds has negative
// sellUtility (it still contributes strength), so selling it and rebuying from the picked-over free-agent
// pool — plus buy premium and a higher wage bill — DESTROYS value instead of converting cash into quality.
// Kept behind an opt-in flag (with its tests/instrumentation) pending a corrected matched-upgrade design
// that verifies the replacement actually beats the shed player before committing the sell.
function isWeakTeamUpgradeSwapEnabled(): boolean {
  return process.env.OLY_WEAK_TEAM_UPGRADE_SWAP === "1";
}
/**
 * cash/MW at/above which a club counts as a hoarder eligible for one upgrade swap. Strong clubs run ~0.5,
 * so 0.65 stays clear of them while catching more of the weak/mid hoarders each season (0.75 left the
 * just-under-threshold tier — bottom cash/MW ~0.65–0.75 — unconverted in S1/S3/S5). Because a swap lowers a
 * club's cash/MW next season, a lower gate keeps topping up the NEXT tier of hoarders instead of firing hard
 * once and then going quiet — the season-to-season consistency lever.
 */
const UPGRADE_SWAP_CASH_TO_MW = Number(process.env.OLY_UPGRADE_SWAP_CASH_TO_MW ?? 0.65) || 0.65;
/** cash/MW at/above which a deep hoarder (cash ≈ whole squad value) may make TWO swaps in one season. */
const UPGRADE_SWAP_CASH_TO_MW_STRONG = Number(process.env.OLY_UPGRADE_SWAP_CASH_TO_MW_STRONG ?? 0.85) || 0.85;
/** Replacement budget (cash + proceeds − buffer) must clear this multiple of the shed MW → a real upgrade. */
const UPGRADE_SWAP_UPLIFT = Number(process.env.OLY_UPGRADE_SWAP_UPLIFT ?? 1.5) || 1.5;
/** Absolute headroom (MW) the replacement budget must also clear, so tiny-MW swaps still need real cash. */
const UPGRADE_SWAP_MIN_HEADROOM = Number(process.env.OLY_UPGRADE_SWAP_MIN_HEADROOM ?? 10) || 10;

export type OrganicSellDecision = {
  /** Domain player id (matches OrganicPlayerView.playerId / Player.id). */
  playerId: string;
  /** 0-based order in which this sell was chosen. */
  step: number;
  /** The sell utility at the moment it was chosen (for the decision log / diagnostics). */
  utility: number;
  /** Optional tag: "upgrade_churn" for a weak-team hoarder swap-out (see UPGRADE_SWAP docs), else undefined. */
  reason?: "upgrade_churn";
};

export type OrganicSellPlanInput = {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
  /** Players currently on the roster (domain Players; their disciplines drive coverage). */
  roster: Player[];
  /**
   * Optional cost basis per playerId (the roster entry's `purchasePrice`). Feeds the profit-flip term
   * in sellUtility so a trader club sheds players it can flip at a gain. Absent ⇒ no profit signal.
   */
  purchasePriceByPlayerId?: Record<string, number>;
  /**
   * At SEASON END the roster may shed below ROSTER_MIN (empty is fine — preseason rebuilds). Pass true
   * there so profit/surplus sells fire even when the draft left the team exactly at min. In-season
   * mid-window contexts leave it false to keep a fieldable squad.
   */
  allowBelowMin?: boolean;
  /** Conservative forecast planning inputs (mirrors the draft planner; optional). */
  forecast?: {
    expectedPrize?: number;
    sponsorIncome?: number;
    facilityNet?: number;
    netTransfer?: number;
  };
  /** Optional per-(save, team) seed for the reproducible sell-utility jitter (see ORGANIC_SELL_JITTER). */
  draftSeed?: string | null;
};

export type OrganicSellPlanResult = {
  /** Ordered list of players to sell (highest sell-utility first). */
  decisions: OrganicSellDecision[];
  finalCash: number;
  finalRosterSize: number;
  optTarget: number;
};

/**
 * Estimate the REALIZED (Stage-B, pre-floor) sale price for one rostered player — the natural market
 * price including the sell-pricing multiplier (seasonStart × timing × liquidation × identityFit), NOT
 * the rosier base-only MW the greedy loop credits to cash. Used by the "think twice" floor gate to
 * detect a voluntary sale that would eat a big haircut (loss > max(25 % MW, 5 mio)).
 *
 * Reads only the passed gameState (no mutation). Returns null when the price cannot be estimated —
 * missing market value, no live roster entry (partial test fixtures), or any pricing error — so the
 * gate degrades to a no-op and prior behaviour is preserved rather than crashing the pure planner.
 */
function estimateRealizedSellPrice(
  gameState: GameState,
  teamId: string,
  player: Player | null,
  rosterEntry: RosterEntry | null,
  rosterAfter: number,
): number | null {
  if (!player || !rosterEntry) {
    return null;
  }
  try {
    const base = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry);
    if (base.baseMarketValue == null) {
      return null;
    }
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId,
      player,
      rosterEntry,
      baseBreakdown: base,
      rosterAfter,
    });
    const realized = priced.preFloorSalePrice ?? priced.breakdown.salePrice ?? null;
    return realized != null && Number.isFinite(realized) ? realized : null;
  } catch {
    return null;
  }
}

/**
 * Greedy organic SELL plan for one team (in-season / season-end sell-only path). Mirror of
 * planOrganicDraftForTeam but for shedding: repeatedly scores sellUtility for every still-held roster
 * player, sells the highest-utility one while it clears SELL_THRESHOLD and the roster stays >=
 * ROSTER_MIN, RE-COMPUTING coverage + cash after each sell (so shedding a covered-discipline body
 * raises the need of the remaining ones and eventually stops the loop). A player in an already-covered
 * discipline / with an attractive sale value scores high; a key starter (high ΔStrength loss) scores
 * negative and is kept. PURE: reads nothing from the live save beyond the passed inputs and mutates
 * nothing — the caller applies the returned decisions via the market sell primitive.
 */
export function planOrganicSellsForTeam(input: OrganicSellPlanInput): OrganicSellPlanResult {
  const ctx = buildOrganicPlanContext({
    gameState: input.gameState,
    team: input.team,
    identity: input.identity,
    draftSeed: input.draftSeed ?? null,
  });
  const rosterEntryByPlayerId = new Map(
    (input.gameState.rosters ?? [])
      .filter((entry) => entry.teamId === input.team.teamId)
      .map((entry) => [entry.playerId, entry] as const),
  );
  // SELL views carry NET-including-buyout proceeds: for each held player resolve the open buyout/release
  // clause from its live roster entry (same resolveOpenBuyoutCostForRoster the real sale uses — the
  // laufende Vertragsjahr faellt dort am Spielstand raus, siehe contract-buyout-season-window) so
  // sellUtility scores what the club actually banks.
  const held = input.roster.map((player) => {
    const rosterEntry = rosterEntryByPlayerId.get(player.id) ?? null;
    const openBuyoutCost = rosterEntry
      ? resolveOpenBuyoutCostForRoster({ rosterEntry, gameState: input.gameState })
      : 0;
    return toOrganicPlayerView(
      player,
      undefined,
      input.purchasePriceByPlayerId?.[player.id],
      openBuyoutCost,
      input.gameState,
    );
  });
  // Season-end may empty the roster (rebuild in preseason); in-season keeps a fieldable floor.
  const rosterMin = input.allowBelowMin ? 0 : ROSTER_MIN;

  let cash = ctx.cash;
  let salaryTotal = held.reduce((sum, view) => sum + Math.max(0, view.salary), 0);
  const decisions: OrganicSellDecision[] = [];

  // THINK-TWICE floor gate (Part 2): a NON-distressed club prefers to KEEP a surplus body rather than
  // realize a big haircut on a voluntary sale (loss > max(25 % MW, 5 mio)). Distressed clubs (cash < 0)
  // bypass the gate so genuine liquidity/wage-relief fire-sales still fire. Players the gate blocks are
  // parked here and excluded from further selection this run (they are kept, not sold).
  const teamDistressed = isSellerDistressed(input.gameState, input.team.teamId);
  const playerById = new Map(input.roster.map((player) => [player.id, player]));
  const blockedFloorPlayerIds = new Set<string>();

  const buildState = (): OrganicTeamState => {
    const disciplineNeeds = computeDisciplineNeeds(held, ctx.identityAxisWeights, ctx.disciplines);
    const needAxisWeights = deriveNeedAxisWeights(disciplineNeeds);
    const forecast = projectCashFlow({
      cash,
      salaryTotal,
      expectedPrize: input.forecast?.expectedPrize ?? 0,
      sponsorIncome: input.forecast?.sponsorIncome ?? 0,
      facilityNet: input.forecast?.facilityNet ?? 0,
      netTransfer: input.forecast?.netTransfer ?? 0,
      cashBuffer: ctx.cashBuffer,
    });
    return {
      cash,
      cashBuffer: ctx.cashBuffer,
      salaryTotal,
      rosterSize: held.length,
      boardRisk: ctx.boardRisk,
      forecast,
      weights: ctx.weights,
      disciplineNeeds,
      needAxisWeights,
      identityAxisWeights: ctx.identityAxisWeights,
    };
  };

  // Floor is ROSTER_MIN in-season, 0 at season end (allowBelowMin). Only players clearing
  // SELL_THRESHOLD are shed, highest-sellUtility first — keepers (negative sellUtility) never sell.
  while (held.length > rosterMin) {
    const state = buildState();
    let best: OrganicPlayerView | null = null;
    let bestUtility = -Infinity;
    for (const view of held) {
      if (blockedFloorPlayerIds.has(view.playerId)) continue; // kept by the think-twice floor gate
      const jitter =
        input.draftSeed && ORGANIC_SELL_JITTER > 0
          ? ORGANIC_SELL_JITTER * (draftUnit(`${input.draftSeed}:${view.playerId}`) - 0.5)
          : 0;
      const utility = sellUtility(view, state) + jitter;
      if (utility > bestUtility) {
        bestUtility = utility;
        best = view;
      }
    }
    // OPT-AWARE surplus shedding: while still ABOVE the team's own optTarget, use the relaxed
    // OPT_SURPLUS_SELL_THRESHOLD so weak/redundant surplus goes even if it wouldn't clear a normal
    // profit sell — this is what stops e.g. an elite_curator sitting at 11 with opt 8 from hoarding
    // cash instead of shedding down to its lean core. Once at/below opt this reverts to the normal
    // (stricter) SELL_THRESHOLD, so profit/coverage sells still work as before but nothing sheds BELOW
    // opt on this pressure — refilling below opt is the buy side's job, not this loop's.
    const threshold = held.length > ctx.weights.optTarget ? OPT_SURPLUS_SELL_THRESHOLD : SELL_THRESHOLD;
    if (!best || bestUtility <= threshold) break;

    // THINK-TWICE gate: for a non-distressed (voluntary) club, skip this sale when the market would only
    // pay a big haircut (loss > max(25 % MW, 5 mio)) — prefer to keep the body. Park it as blocked and
    // reconsider the rest of the roster (the loop re-scans excluding blocked players until none qualify).
    // Distressed clubs bypass this entirely so liquidity/wage-relief sells still clear.
    if (!teamDistressed) {
      const realized = estimateRealizedSellPrice(
        input.gameState,
        input.team.teamId,
        playerById.get(best.playerId) ?? null,
        rosterEntryByPlayerId.get(best.playerId) ?? null,
        Math.max(0, held.length - 1),
      );
      if (realized != null && isBigHaircut(best.marketValue, realized)) {
        blockedFloorPlayerIds.add(best.playerId);
        continue;
      }
    }

    held.splice(held.indexOf(best), 1);
    cash += Math.max(0, best.marketValue);
    salaryTotal = Math.max(0, salaryTotal - Math.max(0, best.salary));
    decisions.push({ playerId: best.playerId, step: decisions.length, utility: bestUtility });
  }

  // WEAK-TEAM UPGRADE SWAP (see UPGRADE_SWAP docs above). Season-end only (allowBelowMin) so the freed slot
  // is safely refilled in preseason. A cash-rich hoarder at/below its own opt sheds its least-valuable keeper
  // to open a slot for a real upgrade the preseason buy funds from the hoarded cash — converting banked cash
  // into market value and lifting the bottom of the table (Schere fix). Strong clubs (low cash/MW) never trip
  // the gate, so this only touches the stagnating weak clubs it is meant to.
  if (input.allowBelowMin && isWeakTeamUpgradeSwapEnabled()) {
    const teamMw = held.reduce((sum, view) => sum + Math.max(0, view.marketValue), 0);
    const cashToMw = teamMw > 0 ? cash / teamMw : 0;
    let swapsRemaining =
      cashToMw >= UPGRADE_SWAP_CASH_TO_MW_STRONG ? 2 : cashToMw >= UPGRADE_SWAP_CASH_TO_MW ? 1 : 0;
    // The hoarders that stagnate are typically SMALL clubs sitting at optTarget ≈ ROSTER_MIN (8) — the opt
    // floor. A `> ROSTER_MIN` guard would exclude exactly them, so the swap would never fire for the teams
    // it targets. Season-end explicitly permits shedding below ROSTER_MIN (the preseason buy + min-fill
    // topup restore hardMin), so the swap may dip below min TRANSIENTLY: the freed slot is refilled with a
    // better body next preseason. Keep a small absolute transient floor so it can't strip a club to nothing.
    const transientFloor = Math.max(1, ROSTER_MIN - 2);
    while (swapsRemaining > 0 && held.length > transientFloor && held.length <= ctx.weights.optTarget) {
      const state = buildState();
      // Least-valuable keeper = highest sellUtility remaining. The loop above already shed everything above
      // the keep line, so this is the body whose removal costs the least strength — the right one to upgrade.
      let weakest: OrganicPlayerView | null = null;
      let weakestUtility = -Infinity;
      for (const view of held) {
        const utility = sellUtility(view, state);
        if (utility > weakestUtility) {
          weakestUtility = utility;
          weakest = view;
        }
      }
      if (!weakest) break;
      // Only swap when the hoarded cash can fund a MEANINGFUL upgrade over the shed body: after banking the
      // sale proceeds and holding the solvency buffer, the free budget must clear an uplift over the sold MW.
      const proceeds = Math.max(0, weakest.marketValue);
      const replacementBudget = cash + proceeds - ctx.cashBuffer;
      if (replacementBudget < weakest.marketValue * UPGRADE_SWAP_UPLIFT + UPGRADE_SWAP_MIN_HEADROOM) break;
      held.splice(held.indexOf(weakest), 1);
      cash += proceeds;
      salaryTotal = Math.max(0, salaryTotal - Math.max(0, weakest.salary));
      decisions.push({
        playerId: weakest.playerId,
        step: decisions.length,
        utility: weakestUtility,
        reason: "upgrade_churn",
      });
      swapsRemaining -= 1;
    }
  }

  return {
    decisions,
    finalCash: cash,
    finalRosterSize: held.length,
    optTarget: ctx.weights.optTarget,
  };
}

/**
 * Season-end RENEWAL contract length (seasons, ∈ [1,5]) for one team, from its identity + GM bias —
 * the gameState-facing wrapper around the pure `resolveRenewalContractLength`. Used by the organic
 * season-end renew→sell cycle to decide how long a kept player's renewed contract runs (short for a
 * flexible trader, long for a stable/high-harmony club).
 */
export function resolveOrganicRenewalContractLength(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null | undefined;
}): number {
  return resolveRenewalContractLength(
    buildOrganicIdentityInput(input.identity),
    resolveGmBias(input.gameState, input.team.teamId),
  );
}
