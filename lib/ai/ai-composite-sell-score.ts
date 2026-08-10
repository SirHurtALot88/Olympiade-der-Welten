import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTransfermarktBracket, getTransfermarktBracketRange } from "@/lib/market/transfermarkt-fit";
import {
  buildTransfermarktSaleFactorBreakdown,
  getSaleFactorRankContext,
  hasCurrentSeasonSaleFactorRanking,
  isBracketRankPoolEligible,
} from "@/lib/market/transfermarkt-sale-factor";
import { teamHasCashBufferRebuildFocus } from "@/lib/ai/ai-team-cash-reserve-service";
import { apronReliefFuerGehalt, type ApronAbbauZiel } from "@/lib/ai/apron-abbau-ziel";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeManagementValue(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0.5;
  const normalized = Number(value);
  if (normalized <= 10) return clamp(normalized / 10, 0, 1);
  return clamp(normalized / 100, 0, 1);
}

export type CompositeSellTeamProfile = "default" | "flip_shop" | "harmony" | "development";

const WEIGHTS: Record<
  CompositeSellTeamProfile,
  {
    profit: number;
    financial: number;
    bracketLag: number;
    depthReplace: number;
    contract: number;
    mwDecline: number;
    performanceKeep: number;
    lossResistance: number;
    /**
     * Ersparnis an Apron-Abgabe, gemessen am ERLOES (siehe `computeCompositeSellScore`). In allen
     * vier Profilen gleich gewichtet: die Steuer haengt an der Lage des TEAMS zur Linie, nicht an
     * seiner Verkaufsphilosophie — ein Flip-Shop ueber der Decke spart genauso viel wie ein
     * Harmony-Team ueber derselben Decke. Groessenordnung wie `mwDecline`/`performanceKeep`: genug,
     * um Grenzkandidaten ueber die Schwelle zu heben, zu wenig, um die Kalibrierung umzuwerfen.
     */
    apronRelief: number;
  }
> = {
  default: {
    profit: 38,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 10,
    performanceKeep: 12,
    lossResistance: 12,
    apronRelief: 12,
  },
  flip_shop: {
    profit: 48,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 4,
    performanceKeep: 4.2,
    lossResistance: 12,
    apronRelief: 12,
  },
  harmony: {
    profit: 30,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 10,
    performanceKeep: 13.8,
    lossResistance: 12,
    apronRelief: 12,
  },
  development: {
    profit: 28,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 12,
    performanceKeep: 12,
    lossResistance: 12,
    apronRelief: 12,
  },
};

/**
 * Tiefster Boden, auf den die Schulden-Frühwarnung die Verkaufsschwelle senken darf. KEINE neue
 * Zahl: es ist der Boden, den das `flip_shop`-Profil unten ohnehin schon hat — tiefer als die
 * aggressivste Verkaufsrolle des Systems geht auch ein hoch verschuldetes Team nicht.
 */
const FRUEHWARNUNG_MIN_SCHWELLE = 18;

const BASE_THRESHOLD: Record<CompositeSellTeamProfile, number> = {
  default: 30,
  flip_shop: 22,
  harmony: 30,
  development: 30,
};

export function resolveCompositeSellTeamProfile(
  teamId: string,
  sellForProfitAggression: number | null | undefined,
  gmArchetype?: string | null,
): CompositeSellTeamProfile {
  // Direct archetype hook: a bargain_hunter GM must reliably run the flip-shop profile (buy-low →
  // sell-high) instead of relying on the diluted, blended sellForProfitAggression bias ever reaching 8.
  if (teamId === "C-C" || gmArchetype === "bargain_hunter" || (sellForProfitAggression ?? 0) >= 8) {
    return "flip_shop";
  }
  if (teamId === "T-T") return "development";
  if (teamId === "M-S") return "harmony";
  return "default";
}

export function getBracketMedianMarketValue(gameState: GameState, bracket: number, saveId?: string | null) {
  const rankContext = getSaleFactorRankContext(gameState, saveId);
  const group = rankContext.groupedCandidates.get(bracket) ?? [];
  if (isBracketRankPoolEligible(group.length)) {
    const values = group.map((entry) => entry.baseMarketValue).sort((left, right) => left - right);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
  }
  const range = getTransfermarktBracketRange(bracket);
  return range.max != null ? (range.min + range.max) / 2 : range.min + 5;
}

export type CompositeSellScoreInput = {
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  player: Player;
  roster: RosterEntry;
  gameState: GameState;
  saveId?: string | null;
  expectedSellValue: number | null;
  marketValue: number | null;
  salary: number | null;
  teamCash: number;
  teamSalaryTotal: number;
  cashPressureScore: number;
  /**
   * Geglaettetes Gehalt DIESES Spielers (`resolvePlayerEconomyContract(...).expectedSalary`) — die
   * Groesse, in der der Apron rechnet. NICHT `salary` daneben verwechseln: das ist die echte,
   * front-/back-loadete Rate dieser Saison.
   */
  expectedSalary?: number | null;
  /** Abbau-Ziel des TEAMS (einmal je Team gebaut, siehe `apron-abbau-ziel.ts`). Fehlt es, ist die Komponente 0. */
  apronZiel?: ApronAbbauZiel | null;
  /** Bereits verplanter Abbau: die Basis, ab der DIESER Verkauf noch etwas spart. */
  apronRestBasis?: number | null;
  /** Schulden-Gehalts-Frühwarnung des Teams (0–1). Fehlt sie, bleibt die Schwelle unverändert. */
  schuldenlastScore?: number | null;
  explanation?: string;
  sellForProfitAggression?: number | null;
  /** GM archetype for direct identity hooks (e.g. bargain_hunter → flip_shop + stronger loss resistance). */
  gmArchetype?: string | null;
};

export type CompositeSellScoreResult = {
  total: number;
  threshold: number;
  teamProfile: CompositeSellTeamProfile;
  components: {
    profit: number;
    financial: number;
    bracketLag: number;
    depthReplace: number;
    contract: number;
    mwDecline: number;
    performanceKeep: number;
    boardCohesionKeep: number;
    lossResistance: number;
    apronRelief: number;
  };
};

export function resolveEffectiveSellThreshold(input: {
  teamProfile: CompositeSellTeamProfile;
  cashPressureScore: number;
  /**
   * Schulden-Gehalts-Frühwarnung (0–1, siehe `schuldenlast-fruehwarnung.ts`). Senkt die Schwelle
   * ZUSÄTZLICH zum Cash-Druck und mit demselben Hebel (×8) — UND den Boden mit ihr.
   *
   * DEN BODEN MITZUSENKEN IST DER GANZE PUNKT, nicht eine Zugabe. Nur die Schwelle darüber zu
   * senken war nachweislich wirkungslos: der Cash-Druck zieht bereits −8 ab, und 30 − 8 = 22 IST
   * der Boden. Jedes Team mit leerer Kasse steht damit schon dort — und das sind exakt die Teams,
   * um die es hier geht. Am Spielstand gemessen standen ALLE ACHT gewarnten Teams bei Cash-Druck
   * ≥ 0,95, also alle am Boden; die Senkung fiel bei allen achten restlos hinein. Mayhem Mavericks
   * verkaufte mit Warnung exakt dasselbe wie ohne (ein Spieler, Lücke −0,4).
   *
   * MIT MITGESENKTEM BODEN greift es dort, wo es klemmt, und nur dort: Mayhem Mavericks 1 → 3
   * Verkäufe (Lücke −0,4 → +33,5), Lost Kingdom 0 → 1 (−17,2 → +7,5, es verkaufte vorher gar
   * nichts). Die fünf übrigen gewarnten Teams ändern sich nicht — sie waren nach ihrem ersten
   * Verkauf ohnehin gedeckt.
   *
   * DIE UNTERGRENZE IST KEINE NEUE ZAHL: gesenkt wird höchstens bis 18, der Boden, den das
   * `flip_shop`-Profil ohnehin schon hat. Tiefer als die aggressivste Verkaufsrolle des Systems
   * geht auch ein hoch verschuldetes Team nicht. Und es bleibt eine BEREITSCHAFT: der
   * `hardMin`-Kaderschutz und die Star-Protection liegen woanders und bleiben unberührt.
   */
  schuldenlastScore?: number;
}) {
  const base = BASE_THRESHOLD[input.teamProfile];
  const floor = input.teamProfile === "flip_shop" ? 18 : 22;
  const senkung = Math.round((input.schuldenlastScore ?? 0) * 8);
  const effektiverBoden = Math.max(FRUEHWARNUNG_MIN_SCHWELLE, floor - senkung);
  return Math.max(effektiverBoden, base - Math.round(input.cashPressureScore * 8) - senkung);
}

export function computeCompositeSellScore(input: CompositeSellScoreInput): CompositeSellScoreResult {
  const teamProfile = resolveCompositeSellTeamProfile(input.teamId, input.sellForProfitAggression, input.gmArchetype);
  const weights = WEIGHTS[teamProfile];
  const purchasePrice = input.roster.purchasePrice ?? null;
  const currentMw = input.marketValue;
  const expectedSell = input.expectedSellValue;

  const profitAbsolute =
    expectedSell != null && purchasePrice != null
      ? expectedSell - purchasePrice
      : expectedSell != null && currentMw != null
        ? expectedSell - currentMw
        : null;
  const profitRatio =
    profitAbsolute != null && purchasePrice != null && purchasePrice > 0
      ? profitAbsolute / purchasePrice
      : profitAbsolute != null && currentMw != null && currentMw > 0
        ? profitAbsolute / currentMw
        : null;
  const ratioPart = profitRatio != null && profitRatio > 0 ? clamp01(profitRatio / 0.35) : 0;
  const absPart =
    profitAbsolute != null && profitAbsolute > 0
      ? clamp01(profitAbsolute / Math.max(6, input.teamCash * 0.55))
      : 0;
  const profit = round(
    clamp01(ratioPart * 0.55 + absPart * 0.45) * (1 + input.cashPressureScore * 0.35) * weights.profit +
      (teamHasCashBufferRebuildFocus(input.gameState, input.teamId) ? 8 : 0),
  );

  const cashPressure = clamp01(
    input.teamCash < 0 ? 1 : input.teamSalaryTotal > 0 ? input.teamSalaryTotal / Math.max(input.teamCash, 1) / 3 : 0,
  );
  const wageShare = input.salary != null && input.teamSalaryTotal > 0 ? input.salary / input.teamSalaryTotal : 0;
  const financial = round(clamp01(cashPressure * 0.7 + wageShare * 0.3) * weights.financial);

  const breakdown = buildTransfermarktSaleFactorBreakdown(input.gameState, input.player, input.roster, {
    saveId: input.saveId,
  });
  const pool = breakdown.bracketGroupSize;
  const poolEligible = isBracketRankPoolEligible(pool) && hasCurrentSeasonSaleFactorRanking(input.gameState, input.saveId);
  const rank = breakdown.rankInBracket;
  const bracketLag =
    poolEligible && rank != null && pool > 1 ? clamp01((rank - 1) / (pool - 1)) * weights.bracketLag : 0;

  const bracket = breakdown.bracket ?? getTransfermarktBracket(currentMw);
  const depthReplace = round((bracket <= 3 ? 1 : bracket === 4 ? 0.5 : 0) * weights.depthReplace);

  const contractYears = input.roster.contractLength;
  const contractBase = contractYears <= 1 ? 0.8 : contractYears === 2 ? 0.45 : 0.12;
  const contract = round(contractBase * weights.contract + (teamProfile === "flip_shop" && contractYears <= 1 ? 8 : 0));

  const absoluteLoss =
    purchasePrice != null && currentMw != null ? Math.max(0, purchasePrice - currentMw) : 0;
  const relativeLoss = purchasePrice != null && purchasePrice > 0 ? absoluteLoss / purchasePrice : 0;
  const bracketScale = Math.max(6, getBracketMedianMarketValue(input.gameState, bracket, input.saveId) * 0.15);
  const absolutePart = clamp01(absoluteLoss / bracketScale);
  const relativePart = clamp01(relativeLoss / 0.35);
  const mwDeclineSell = clamp01(0.3 * relativePart + 0.7 * absolutePart);
  const mwDecline = round(mwDeclineSell * weights.mwDecline);

  const harmonyScore = normalizeManagementValue(input.identity?.harmony);
  const explanation = input.explanation ?? "";
  const identityLoyalty = ["Bindet", "Loyal", "Mentor"].some((token) => explanation.includes(token)) ? 0.85 : 0.35;
  const topQuartile = poolEligible && rank != null && pool >= 4 && rank <= Math.ceil(pool * 0.25);
  const keepMultiplier = teamProfile === "flip_shop" ? 0.35 : teamProfile === "harmony" ? 1.15 : 1;
  const performanceKeep = topQuartile
    ? -round(0.6 * (0.4 + harmonyScore * 0.35 + identityLoyalty * 0.25) * weights.performanceKeep * keepMultiplier)
    : 0;

  const boardConfidence = normalizeManagementValue(input.identity?.boardConfidence);
  const boardCohesionKeep =
    boardConfidence >= 0.65
      ? -round((boardConfidence - 0.55) * weights.performanceKeep * 1.35 * keepMultiplier)
      : 0;

  // Realized net loss vs purchase (expectedSell is net after buyout). Scale resistance with loss size;
  // extra penalty when the player was bought in the current season (avoids buy-then-dump spirals).
  const sellBelowPurchase =
    purchasePrice != null && expectedSell != null && expectedSell < purchasePrice;
  const realizedLossAbs = profitAbsolute != null && profitAbsolute < 0 ? -profitAbsolute : 0;
  const realizedLossRatio = profitRatio != null && profitRatio < 0 ? -profitRatio : 0;
  const lossMagnitude = clamp01(realizedLossRatio);
  const baseLossResistance = sellBelowPurchase ? -(0.3 + lossMagnitude * 1.7) * weights.lossResistance : 0;
  const isFreshPurchase =
    input.roster.joinedSeasonId != null && input.roster.joinedSeasonId === input.gameState.season.id;
  const freshBuyLossResistance =
    isFreshPurchase && sellBelowPurchase
      ? -round((0.25 + lossMagnitude * 2.4) * weights.lossResistance * (1 + clamp01(realizedLossAbs / 20)))
      : 0;
  // bargain_hunter: a not-yet-upgraded fresh buy must NOT be dumped below its purchase price — that is
  // exactly the buy-high/sell-low spiral that produces the negative average profitDelta. Strengthen the
  // (already negative) loss resistance so such sells fall below the sell threshold.
  const lossResistanceScale = input.gmArchetype === "bargain_hunter" ? 1.6 : 1;
  const lossResistance = round((baseLossResistance + freshBuyLossResistance) * lossResistanceScale);

  /**
   * APRON-ERSPARNIS — gemessen am ERLÖS, nicht am Gehalt.
   *
   * Wer 4 Abgabe spart und dafür 40 Verkaufserlös aufgibt, hat kaum etwas gewonnen; wer 4 spart und
   * nur 8 bekommt, ist einen Steuerposten losgeworden. Das trifft genau den Spieler, den ein Team
   * über seiner Decke abgeben SOLL — teuer im Gehalt, mager im Marktwert. Am Gehalt gemessen wäre
   * es der teuerste Spieler, also oft der beste.
   *
   * Ohne Erlös (`0`) läuft das Verhältnis auf 1: eine Steuerersparnis, die nichts kostet, ist der
   * klarste Fall überhaupt. `clamp01` hält den Ausschlag trotzdem im Rahmen.
   *
   * FEHLT DAS ZIEL, IST DIE KOMPONENTE 0 — Vorschauen ohne Ligakontext und alle Bestandstests
   * verhalten sich damit unverändert.
   */
  const apronReliefBetrag = input.apronZiel
    ? apronReliefFuerGehalt(input.apronZiel, input.expectedSalary, input.apronRestBasis ?? undefined)
    : 0;
  const apronErloes = expectedSell ?? currentMw ?? 0;
  const apronRelief =
    apronReliefBetrag > 0
      ? round(clamp01(apronReliefBetrag / Math.max(apronErloes, 1)) * weights.apronRelief)
      : 0;

  const total = round(
    clamp(
      profit +
        financial +
        bracketLag +
        depthReplace +
        contract +
        mwDecline +
        performanceKeep +
        boardCohesionKeep +
        lossResistance +
        apronRelief,
      0,
      100,
    ),
  );

  return {
    total,
    threshold: resolveEffectiveSellThreshold({
      teamProfile,
      cashPressureScore: input.cashPressureScore,
      schuldenlastScore: input.schuldenlastScore ?? 0,
    }),
    teamProfile,
    components: {
      profit,
      financial,
      bracketLag: round(bracketLag),
      depthReplace,
      contract,
      mwDecline,
      performanceKeep,
      boardCohesionKeep: round(boardCohesionKeep),
      lossResistance,
      apronRelief,
    },
  };
}

export function selectCompositeSellCandidates<
  T extends {
    expectedSellValue?: number | null;
    salary?: number | null;
    purchasePrice?: number | null;
    /** Geglaettetes Gehalt — die Apron-Groesse. Getrennt von `salary` (echte Saisonrate) gefuehrt. */
    expectedSalary?: number | null;
  },
>(
  input: {
    candidates: Array<{ candidate: T; score: number }>;
    teamCash: number;
    teamSalaryTotal: number;
    cashPressureScore: number;
    teamProfile: CompositeSellTeamProfile;
    /** When true (season_end sell pass), keep taking profit-sell candidates even after cash pressure is resolved. */
    allowProfitSellsBelowMin?: boolean;
    /** Block sells that would drop the roster below hardMin unless cash emergency. */
    hardMin?: number;
    rosterCount?: number;
    /**
     * Abbau-Ziel des Teams. Ist es gesetzt und noch nicht erreicht, laeuft die Auswahl weiter, auch
     * wenn der Cash-Druck schon geloest waere.
     */
    apronZiel?: ApronAbbauZiel | null;
    /**
     * Schulden-Gehalts-Frühwarnung des Teams (siehe `schuldenlast-fruehwarnung.ts`). Ist sie aktiv
     * (score > 0), läuft die Auswahl weiter, bis die kommende Saisonend-Abbuchung gedeckt ist —
     * dieselbe Mechanik wie beim `apronZiel`, nur mit der Kreditrate statt der Apron-Linie als Ziel.
     */
    schuldenlast?: { score: number; kreditrate: number; umsatz: number; kreditrahmen?: number } | null;
  },
): T[] {
  const sorted = [...input.candidates].sort((left, right) => right.score - left.score);
  if (sorted.length === 0) return [];
  if (input.teamProfile === "flip_shop") {
    // Only real profit flips: when a purchase price is known, require a positive realized delta
    // (expectedSell − purchasePrice). Missing purchase info (e.g. draft-origin players) keeps the
    // prior permissive behaviour. Prevents the profile from becoming a wholesale roster sell-off.
    return sorted
      .filter((entry) => {
        const sell = entry.candidate.expectedSellValue ?? null;
        const buy = entry.candidate.purchasePrice ?? null;
        if (sell != null && buy != null) return sell - buy > 0;
        return true;
      })
      .map((entry) => entry.candidate);
  }

  let projectedCash = input.teamCash;
  let projectedSalary = input.teamSalaryTotal;
  /**
   * ZWEITER ZAEHLER, UND ZWAR ZWINGEND — nicht Bequemlichkeit.
   *
   * `projectedSalary` fuehrt die ECHTE Gehaltssumme: `team.salaryTotal` wird in
   * `ai-transfermarkt-sell-preview-service.ts` aus `resolvePlayerEconomyContract(...).salary`
   * summiert (also front-/back-loaded), und das Dekrement unten nimmt dasselbe Feld. Der Apron
   * bemisst aber die GEGLAETTETE Summe. Ein Vergleich `projectedSalary > decke` waere derselbe
   * Aepfel-Birnen-Fehler, der schon in `isTeamOverApronSalaryCeiling` steckte — und er ist hier
   * nicht theoretisch: am Spielstand gemessen kippt er bei 3 von 5 Abbau-Teams das Vorzeichen (Cold
   * Steel echt 63,6 gegen Decke 81,0 spraenge nie an, obwohl geglaettet 81,6 darueber liegt; Mayhem
   * Mavericks bekaeme scheinbaren Ueberschuss 20,4 statt 6,8 und wuerde um rund 13,6 ueberverkaufen).
   *
   * Deshalb laeuft die Apron-Basis getrennt mit und sinkt um `expectedSalary` statt um `salary`.
   */
  let projectedApronBase = input.apronZiel?.basis ?? 0;
  let projectedRoster = input.rosterCount ?? Number.POSITIVE_INFINITY;
  const hardMin = input.hardMin;
  const selected: T[] = [];

  /**
   * Erreicht, sobald die Apron-Basis unter der Zielbasis liegt. `<=` waere hier falsch: bei einem
   * Team, dessen Decke die 1. Linie IST, bedeutet „genau auf der Linie" zahlt nichts UND bekommt
   * nichts — die Zielbasis traegt deshalb schon den Feinabstand (siehe `apron-abbau-ziel.ts`).
   */
  const istApronZielErreicht = () =>
    input.apronZiel == null || input.apronZiel.ueberschuss <= 0 || projectedApronBase <= input.apronZiel.zielBasis;

  const isCashPressureResolved = () => {
    if (projectedCash < 0) return false;
    if (input.cashPressureScore >= 0.45) {
      return projectedCash >= Math.max(8, projectedSalary * 0.18);
    }
    if (input.cashPressureScore >= 0.35) {
      return projectedCash >= projectedSalary * 0.25;
    }
    return true;
  };

  /**
   * DER NOTFALL WIRD NACH JEDEM VERKAUF NEU BEWERTET — vorher stand er als `const` fest, berechnet
   * aus dem Cash-Druck von VOR dem ersten Verkauf, und galt danach für den ganzen Lauf.
   *
   * Er setzt den `hardMin`-Kaderschutz aus, und das ist für ein Team, dem HEUTE das Geld fehlt,
   * auch richtig. Falsch war nur, dass die Ausnahme bestehen blieb, nachdem die Verkäufe den
   * Notfall längst behoben hatten. Gemessen bei Mayhem Mavericks (Kader 10, Mindestgröße 8): nach
   * zwei Verkäufen stehen 51,6 in der Kasse — der Notfall ist vorbei, die Ausnahme galt aber
   * weiter und liess einen dritten Verkauf auf sieben Spieler durch. Dieselbe eingefrorene
   * Ausnahme lässt Pirate Crew 5 seiner 11 Spieler abgeben.
   *
   * `isCashPressureResolved` rechnete schon immer auf `projectedCash`, war also von Anfang an
   * dynamisch. Nur diese eine Zeile war es nicht.
   */
  const isCashEmergency = () => input.cashPressureScore >= 0.45 && !isCashPressureResolved();

  /**
   * FRÜHWARNUNGS-ZIEL: Cash + Umsatz muss die kommende Abbuchung (Gehalt + Kreditrate) decken.
   * Gerechnet wird BEWUSST auf `projectedSalary` (der echten, front-/back-loadeten Summe) und nicht
   * auf der Apron-Basis: abgebucht wird am Saisonende die echte Summe — dieselbe Trennung wie bei
   * den Cash-Zielen (`ai-cash-salary-target-service.ts`). Beide Zähler laufen mit, jeder Verkauf
   * hilft doppelt (Erlös rein, Gehalt raus), die Schleife konvergiert deshalb schnell: Mayhem
   * Mavericks (Fehlbetrag 51,8 am gemessenen Spielstand) ist nach einem Verkauf mehr gedeckt, statt
   * bei „Cash wieder positiv plus kleine Reserve" stehen zu bleiben und mit ungedeckter Kreditrate
   * in die nächste Saison zu gehen. KEIN Zwangsverkauf: die Schleife wählt nur aus Kandidaten, die
   * die Schwelle ohnehin gerissen haben, und der `hardMin`-Schutz oben bleibt unberührt — reichen
   * die Kandidaten nicht, endet sie einfach.
   */
  const istSchuldenlastGedeckt = () =>
    input.schuldenlast == null ||
    input.schuldenlast.score <= 0 ||
    projectedCash + input.schuldenlast.umsatz >= projectedSalary + input.schuldenlast.kreditrate;

  for (const entry of sorted) {
    if (
      hardMin != null &&
      Number.isFinite(projectedRoster) &&
      projectedRoster - 1 < hardMin &&
      !isCashEmergency()
    ) {
      continue;
    }
    if (
      selected.length > 0 &&
      isCashPressureResolved() &&
      istApronZielErreicht() &&
      istSchuldenlastGedeckt() &&
      !input.allowProfitSellsBelowMin
    ) {
      break;
    }
    selected.push(entry.candidate);
    projectedCash += entry.candidate.expectedSellValue ?? 0;
    projectedSalary = Math.max(0, projectedSalary - (entry.candidate.salary ?? 0));
    projectedApronBase = Math.max(0, projectedApronBase - (entry.candidate.expectedSalary ?? 0));
    if (Number.isFinite(projectedRoster)) {
      projectedRoster -= 1;
    }
  }

  return selected;
}
