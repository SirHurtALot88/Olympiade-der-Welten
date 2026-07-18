import prizeMoneyNormalized from "@/references/sheets/prize-money-table.normalized.json";
import type { GameState, SponsorArchetype, SponsorCurveShape, SponsorOffer, SponsorOfferComponent, SponsorRarity, SponsorStarTier } from "@/lib/data/olyDataTypes";
import {
  getSponsorCurveShapeRankMultiplier,
  getSponsorRarityEtatFactor,
  mapArchetypeToCurveShape,
  mapStarTierToRarity,
} from "@/lib/sponsor/sponsor-curve-shapes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamDisplaySalaryTotal, getTeamSponsorBaseReferenceTotal } from "@/lib/sponsor/sponsor-team-salary-display";

const PRIZE_MONEY_NORMALIZED = prizeMoneyNormalized as {
  rows: Array<{ rank: number | null; prizeMoney: number | null }>;
};

export const SPONSOR_BASE_FLOOR_C = 32;

/**
 * Flat Gebäude-Kosten-Ausgleich auf den Sponsor-Sockel PRO TEAM. Die Gebäude verbrauchen liga-weit
 * ~300/Season (~9–10/Team, überwiegend Upgrade-CapEx), was die Mehrsaison-Ökonomie deflationär macht.
 * Deshalb (User-Vorgabe): Sponsor = gehaltsbasierter Sockel + flat ~500/Liga on top → pro Team
 * 500/32 ≈ 15.6 (angehoben von 300→500, um Gebäude-Unterhalt breiter zu decken und den Kreditbedarf
 * an der Quelle zu senken). Flach (NICHT salaryFactor-skaliert), sodass der Ausgleich bei fortschreitender
 * Deflation relativ sogar mehr hilft. ENV-tunebar. Fließt über effectiveBaseFloor konsistent in Angebot
 * UND Settlement (getSponsorPayoutForFinalRankAndTier nutzt denselben Anker).
 */
export const SPONSOR_BUILDING_COST_OFFSET_C = Number(process.env.OLY_SPONSOR_BUILDING_OFFSET_C ?? 4) || 4;

/**
 * Offset vom Referenz-Gehalt für den Rang-32-Basis-Anker (4.-niedrigstes Gehalt − Buffer). POSITIV ⇒ der
 * Anker liegt UNTER dem 4.-niedrigsten Gehalt; die Deckung der Schwächsten kommt dann über
 * SPONSOR_BUILDING_COST_OFFSET_C + Archetyp-Base-Mult (security 1.07) + Bottom-Schutz (baseScale 1.2),
 * nicht mehr über den rohen Anker. Auf +11 kalibriert, damit der effektive Sockel (Anker + Offset) den
 * Rang-32-Boden ins Zielband 38-44 legt statt bei ~54 zu kleben (die Sponsor-Kurve war viel zu flach
 * gegenüber der Preisgeld-Referenz). Nebeneffekt: Anker-Elevation < Threshold ⇒ Meilenstein-Kompression
 * aus (msScale 1.0), die Leiter wird ~11 % steiler ohne LADDER_SCALE anzufassen.
 */
export const SPONSOR_BASE_SALARY_BUFFER_C = Number(process.env.OLY_SPONSOR_BASE_SALARY_BUFFER_C ?? 11) || 11;

/**
 * Globale Stauchung der kumulativen Rang-Meilenstein-Leiter im Sponsor-Payout. <1 ⇒ die Spitze (die alle
 * Meilensteine stapelt) zahlt nicht mehr komplett über: sie kappt den Top-Bonus, ohne den Sockel (der die
 * Kleinen absichert) anzutasten. So sinkt die Rang-Spreizung Richtung der funktionierenden Preisgeld-Kurve.
 */
export const SPONSOR_MILESTONE_LADDER_SCALE = Number(process.env.OLY_SPONSOR_MILESTONE_LADDER ?? 0.82) || 0.82;

/** Meilenstein-Kompression erst ab dieser Basis-Erhöhung über statischer Kalibrierung. */
export const SPONSOR_BASE_ELEVATION_COMPRESSION_THRESHOLD_C = 8;

export const SPONSOR_RANK_MILESTONES = [
  { maxRank: 28, bonusC: 7, label: "Top 28" },
  { maxRank: 24, bonusC: 5, label: "Top 24" },
  { maxRank: 20, bonusC: 6, label: "Top 20" },
  { maxRank: 16, bonusC: 8, label: "Top 16" },
  { maxRank: 12, bonusC: 6, label: "Top 12" },
  { maxRank: 8, bonusC: 12, label: "Top 8" },
  { maxRank: 4, bonusC: 10, label: "Top 4" },
  { maxRank: 1, bonusC: 9, label: "Meister" },
] as const;

export type SponsorRankMilestone = (typeof SPONSOR_RANK_MILESTONES)[number];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

let prizeMoneyByRankCache: Map<number, number> | null = null;

function loadPrizeMoneyByRank(): Map<number, number> {
  if (prizeMoneyByRankCache) {
    return prizeMoneyByRankCache;
  }
  prizeMoneyByRankCache = new Map(
    PRIZE_MONEY_NORMALIZED.rows
      .filter((row) => row.rank != null && row.prizeMoney != null)
      .map((row) => [row.rank as number, row.prizeMoney as number]),
  );
  return prizeMoneyByRankCache;
}

export function getPrizeMoneyReference(rank: number, salaryFactor = 1): number {
  const boundedRank = Math.min(32, Math.max(1, Math.round(rank)));
  const prize = loadPrizeMoneyByRank().get(boundedRank) ?? 0;
  return round1(prize * salaryFactor);
}

/**
 * Archetyp-Kreuzungs-Tabellen (WAVE 1). Security ist "sicher": hoher garantierter Sockel (base > 1),
 * aber gedämpfte Rang-Upside (milestone < performance). Performance ist das Gegenteil: schlanker Sockel
 * (base < 1), dafür die steilste Meilenstein-Leiter (milestone ≫ 1). Identity liegt neutral in der Mitte.
 * Diese ZWEI Tabellen sind die EINZIGE Quelle der Archetyp-Differenzierung und werden IDENTISCH von
 * getSponsorPayoutForFinalRankAndTier (Settlement) UND buildOfferCashAmounts (Anzeige) genutzt — dadurch
 * ist die Anzeige exakt das Settlement. ENV-tunebar analog zu den übrigen OLY_SPONSOR_*-Knobs.
 *
 * Kalibrierung (an die Preisgeld-Referenzkurve angenähert): Boden R32 aller Archetypen liegt eng im
 * Survival-Band 38-44, die Kreuzung wandert KOMPLETT in die Upside (Meilenstein-Mults), NICHT in die Basis.
 * Deshalb liegen die BASE_MULT eng beieinander (security 1.07 / identity 1.0 / performance 0.96 → Böden
 * ~43 / 41 / 39), während die MILESTONE_MULT die Spitze auffächern (security 0.85 flach → id 1.0 → perf 1.14
 * steil; ★5-Meister ~85 / 90 / 95). security-BASE_MULT bleibt bei 1.07, weil die Anzeige==Settlement-Bindung
 * security × Tier-Base(2) > 1 verlangt (1.07 × 0.98 = 1.049). Hinweis: der früher hier zitierte Spread-Test
 * "> 1.65" existiert nicht mehr; die realen Constraints stehen in tests/sponsor-economy-balance.test.ts.
 * ENV: OLY_SPONSOR_ARCH_BASE_* / OLY_SPONSOR_ARCH_MS_*.
 */
export const SPONSOR_ARCHETYPE_BASE_MULT: Record<SponsorArchetype, number> = {
  security: Number(process.env.OLY_SPONSOR_ARCH_BASE_SECURITY ?? 1.07) || 1.07,
  identity: Number(process.env.OLY_SPONSOR_ARCH_BASE_IDENTITY ?? 1.0) || 1.0,
  performance: Number(process.env.OLY_SPONSOR_ARCH_BASE_PERFORMANCE ?? 0.96) || 0.96,
};

export const SPONSOR_ARCHETYPE_MILESTONE_MULT: Record<SponsorArchetype, number> = {
  security: Number(process.env.OLY_SPONSOR_ARCH_MS_SECURITY ?? 0.85) || 0.85,
  identity: Number(process.env.OLY_SPONSOR_ARCH_MS_IDENTITY ?? 1.0) || 1.0,
  performance: Number(process.env.OLY_SPONSOR_ARCH_MS_PERFORMANCE ?? 1.14) || 1.14,
};

export function getArchetypeBaseMultiplier(archetype: SponsorArchetype): number {
  return SPONSOR_ARCHETYPE_BASE_MULT[archetype] ?? 1;
}

export function getArchetypeMilestoneMultiplier(archetype: SponsorArchetype): number {
  return SPONSOR_ARCHETYPE_MILESTONE_MULT[archetype] ?? 1;
}

/** @deprecated WAVE 1: Archetyp-Split läuft jetzt über SPONSOR_ARCHETYPE_BASE_MULT / getArchetypeBaseMultiplier. */
export function getArchetypeBaseShare(archetype: SponsorArchetype): number {
  if (archetype === "security") return 0.65;
  if (archetype === "identity") return 0.55;
  return 0.35;
}

export function getTotalMilestoneBonusC(salaryFactor = 1): number {
  return round1(SPONSOR_RANK_MILESTONES.reduce((sum, milestone) => sum + milestone.bonusC, 0) * salaryFactor);
}

export function getRankMilestoneBonus(finalRank: number | null | undefined, salaryFactor = 1): number {
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return 0;
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  let total = 0;
  for (const milestone of SPONSOR_RANK_MILESTONES) {
    if (boundedRank <= milestone.maxRank) {
      total += milestone.bonusC;
    }
  }
  return round1(total * salaryFactor);
}

export function getUnlockedMilestones(finalRank: number | null | undefined): SponsorRankMilestone[] {
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return [];
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  return SPONSOR_RANK_MILESTONES.filter((milestone) => boundedRank <= milestone.maxRank);
}

export function getSponsorPayoutForFinalRank(finalRank: number | null | undefined, salaryFactor = 1): number {
  const base = round1(SPONSOR_BASE_FLOOR_C * salaryFactor);
  const milestoneBonus = getRankMilestoneBonus(finalRank, salaryFactor);
  return round1(base + milestoneBonus);
}

export function getNextMilestoneRank(startRank: number | null | undefined): number {
  const rank = startRank ?? 32;
  const next = SPONSOR_RANK_MILESTONES.find((milestone) => milestone.maxRank < rank);
  return next?.maxRank ?? 1;
}

export function buildMilestoneRankLabel(): string {
  return SPONSOR_RANK_MILESTONES.map((milestone) => `${milestone.label} (+${milestone.bonusC} C)`).join(" · ");
}

/** @deprecated WAVE 1: Archetyp-Split läuft jetzt über SPONSOR_ARCHETYPE_MILESTONE_MULT / getArchetypeMilestoneMultiplier. */
export function getArchetypeRankShare(archetype: SponsorArchetype): number {
  return round1(1 - getArchetypeBaseShare(archetype));
}

/**
 * Stern-Tier-Skalierung des BASIS-Sockels — bewusst eng komprimiert (0.96..1.0). Die Basis ist "tier-nah",
 * damit der Boden aller Tiers im 38-44-Band bleibt (perf-★2-Boden ≥ 38 ist mit dem alten 0.94 unlösbar).
 * Die volle Stern-Differenzierung lebt in SPONSOR_TIER_MILESTONE_MULT (0.28..1.0) — schwache Sterne schalten
 * die Rang-Upside kaum frei, nicht den Sockel.
 */
export const SPONSOR_TIER_BASE_MULT: Record<SponsorStarTier, number> = {
  1: Number(process.env.OLY_SPONSOR_TIER_BASE_1 ?? 0.97) || 0.97,
  2: Number(process.env.OLY_SPONSOR_TIER_BASE_2 ?? 0.98) || 0.98,
  3: Number(process.env.OLY_SPONSOR_TIER_BASE_3 ?? 1.0) || 1.0,
  4: Number(process.env.OLY_SPONSOR_TIER_BASE_4 ?? 1.02) || 1.02,
  5: Number(process.env.OLY_SPONSOR_TIER_BASE_5 ?? 1.04) || 1.04,
};

/** Low-star sponsors unlock far less of the Gewinnstufen ladder (big jumps 1★→5★). */
// Gedämpft (früher 0.28..1.0 → ★1-★5-Spitzen-Spread ~43 C, zu krass): ★1 schaltet jetzt gut die Hälfte der
// Rang-Leiter frei statt nur ~28 %. Star-Tier differenziert die Spitze weiterhin klar, aber ein ★1-Sponsor
// ist auch bei Erfolg "nicht zu schlecht" (Spitzen-Spread ~20-25 C). ENV-tunebar.
export const SPONSOR_TIER_MILESTONE_MULT: Record<SponsorStarTier, number> = {
  1: Number(process.env.OLY_SPONSOR_TIER_MS_1 ?? 0.6) || 0.6,
  2: Number(process.env.OLY_SPONSOR_TIER_MS_2 ?? 0.72) || 0.72,
  3: Number(process.env.OLY_SPONSOR_TIER_MS_3 ?? 0.82) || 0.82,
  4: Number(process.env.OLY_SPONSOR_TIER_MS_4 ?? 0.91) || 0.91,
  5: Number(process.env.OLY_SPONSOR_TIER_MS_5 ?? 1) || 1,
};

export function getStarTierBaseMultiplier(starTier: SponsorStarTier): number {
  return SPONSOR_TIER_BASE_MULT[starTier] ?? 1;
}

export function getStarTierMilestoneMultiplier(starTier: SponsorStarTier): number {
  return SPONSOR_TIER_MILESTONE_MULT[starTier] ?? 1;
}

export function getRewardMultiplierForTier(starTier: SponsorStarTier): number {
  return getStarTierMilestoneMultiplier(starTier);
}

export { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";

export function getLeagueMinimumSalaryTotal(gameState: GameState): number {
  const overviewSalaries = buildTeamSeasonOverviewRows({ gameState })
    .map((row) => getTeamDisplaySalaryTotal(gameState, row.teamId))
    .filter((value) => value > 0);
  if (overviewSalaries.length === 0) {
    return SPONSOR_BASE_FLOOR_C;
  }
  return round1(Math.min(...overviewSalaries));
}

/**
 * Viertniedrigste Team-Referenz (4. von unten), Basis = Gehalt + Gebäude-Unterhalt.
 * Gebäude-Kosten schlagen so 1:1 auf die Sponsoren-Basis durch (salary factor 1.0 Anker).
 */
export function getLeagueFourthFromLowestSalaryTotal(gameState: GameState): number {
  const salaries = buildTeamSeasonOverviewRows({ gameState })
    .map((row) => getTeamSponsorBaseReferenceTotal(gameState, row.teamId))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  if (salaries.length === 0) {
    return SPONSOR_BASE_FLOOR_C;
  }
  const index = Math.min(3, salaries.length - 1);
  return round1(salaries[index] ?? salaries[0]!);
}

/** Mindest-Basis für Rang 32: Gehalt des 4.-niedrigsten Teams − Buffer, mind. statischer Floor (unskaliert). */
export function getSponsorRank32BaseAnchorSalary(gameState: GameState): number {
  const referenceSalary = getLeagueFourthFromLowestSalaryTotal(gameState);
  return round1(Math.max(SPONSOR_BASE_FLOOR_C, referenceSalary - SPONSOR_BASE_SALARY_BUFFER_C));
}

export type SponsorEconomyAnchors = {
  effectiveBaseFloor: number;
  milestonePool: number;
  milestoneScale: number;
};

export function resolveSponsorEconomyAnchors(salaryFactor: number, baseAnchorSalary: number): SponsorEconomyAnchors {
  const scaledStaticFloor = round1(SPONSOR_BASE_FLOOR_C * salaryFactor);
  const scaledAnchor = round1(baseAnchorSalary * salaryFactor);
  const salaryBasedFloor = round1(Math.max(scaledStaticFloor, scaledAnchor));
  const fullMilestoneBonus = getTotalMilestoneBonusC(salaryFactor);
  // baseElevation/Kompression aus dem gehaltsbasierten Sockel berechnen (VOR dem Gebäude-Offset), damit
  // der flache Offset nicht die Milestone-Kompression verzerrt.
  const baseElevation = Math.max(0, salaryBasedFloor - scaledStaticFloor);
  const elevationAboveThreshold = Math.max(0, baseElevation - SPONSOR_BASE_ELEVATION_COMPRESSION_THRESHOLD_C);
  const compressionFactor =
    elevationAboveThreshold <= 0 || fullMilestoneBonus <= 0
      ? 1
      : Math.max(0.12, 1 - elevationAboveThreshold / (fullMilestoneBonus + elevationAboveThreshold));
  const milestonePool = round1(fullMilestoneBonus * compressionFactor);
  const milestoneScale = fullMilestoneBonus > 0 ? milestonePool / fullMilestoneBonus : 0;
  // Flat Gebäude-Kosten-Ausgleich zuletzt auf den Sockel — deckt den ~300/Liga-Gebäude-Drain (User-Vorgabe).
  const effectiveBaseFloor = round1(salaryBasedFloor + SPONSOR_BUILDING_COST_OFFSET_C);
  return { effectiveBaseFloor, milestonePool, milestoneScale };
}

export function getScaledRankMilestoneBonus(
  finalRank: number | null | undefined,
  salaryFactor: number,
  leagueMinSalary: number,
): number {
  const { milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  return round1(getRankMilestoneBonus(finalRank, salaryFactor) * milestoneScale);
}

/**
 * Umverteilung nach Team-Stärke (quality rank) zum SCHUTZ der schwachen Teams — hält die Top5/Bottom5-
 * Schere (MW+Cash) unter ~2×. Zwei Hebel:
 *  - milestoneScale: schwache Teams etwas mehr Rang-Upside (klein, ±BALANCE_C), aber sie erreichen die
 *    Milestones ohnehin kaum → der eigentliche Schutz läuft über den Sockel.
 *  - baseScale: die WICHTIGE Größe — schwache Teams bekommen einen deutlich höheren GARANTIERTEN Sockel
 *    (bis +BASE_PROTECT_C), starke einen Abschlag. Da der Sockel unabhängig von der Platzierung fließt,
 *    stützt das die Bottom-5-Einnahmen jede Season und bremst ihre Erosion (Schere öffnet nicht auf 2.4×).
 * ENV-tunebar zum Kalibrieren gegen das Schere-Ziel.
 */
// Deutlich reduziert (0.2 → 0.06 / 0.1 → 0.03): die frühere starke Bottom-Protektion/Top-Dämpfung
// KOMPRIMIERTE die Rang→Payout-Kurve für typische Teams (Boden ×1.2 → ~52, Spitze ×0.8 → ~72) und war der
// eigentliche Flachheits-Verursacher. Der Boden-Schutz läuft jetzt über den gehaltsgeankerten Sockel, die
// Überperformance-Belohnung schwacher Teams über die erwartungs-relative performance-Leiter (Feed 2). Mit
// der milden Rebalance landen die Bänder bei 38-48 (Boden) / 85-95 (Spitze). ACHTUNG: reduziert die
// Schere-Stützung → im S1-S2-Messlauf gegen das Schere-Ziel (<2×) bestätigen. ENV-tunebar.
const SPONSOR_QUALITY_BASE_PROTECT_C = Number(process.env.OLY_SPONSOR_WEAK_BASE_PROTECT ?? 0.06) || 0.06;
const SPONSOR_QUALITY_MILESTONE_BALANCE_C = Number(process.env.OLY_SPONSOR_WEAK_MS_BALANCE ?? 0.03) || 0.03;
export function getQualityRebalanceProfile(teamQualityRank: number | null | undefined): {
  milestoneScale: number;
  baseScale: number;
} {
  if (teamQualityRank == null || !Number.isFinite(teamQualityRank)) {
    return { milestoneScale: 1, baseScale: 1 };
  }
  const t = (teamQualityRank - 16.5) / 15.5;
  const clamped = Math.max(-1, Math.min(1, t)); // rank 1 → -1 (stark), rank 32 → +1 (schwach)
  return {
    milestoneScale: round1(1 + clamped * SPONSOR_QUALITY_MILESTONE_BALANCE_C),
    baseScale: round1(1 + clamped * SPONSOR_QUALITY_BASE_PROTECT_C),
  };
}

function applyQualityRebalanceToPayout(input: {
  base: number;
  milestoneBonus: number;
  teamQualityRank?: number | null;
}) {
  const profile = getQualityRebalanceProfile(input.teamQualityRank);
  return {
    base: round1(input.base * profile.baseScale),
    milestoneBonus: round1(input.milestoneBonus * profile.milestoneScale),
  };
}

/**
 * Feed 2 — Anteil der GEWONNENEN Meilenstein-Schwierigkeit (absMile(final) − absMile(expected)), den der
 * performance-Archetyp als Überperformance-Bonus ZUSÄTZLICH zur absoluten Rang-Leiter bekommt. Da die
 * Belohnung an die (konkave) Meilenstein-Leiter gekoppelt ist, springt sie im gepackten unteren Bereich
 * bewusst wenig und die Gesamt-Auszahlung bleibt streng monoton im Endrang. ENV-tunebar.
 * (Ersetzt die frühere lineare erwartungs-relative Schritt-Leiter SPONSOR_EXPECT_STEP_C/MAX_STEPS, die die
 *  Monotonie brach und daher entfernt wurde.)
 */
export const SPONSOR_OVERPERFORMANCE_SHARE = Number(process.env.OLY_SPONSOR_OVERPERF_SHARE ?? 0.6) || 0.6;

/**
 * Golden-Sponsor Rang-Payout-Boost (Wave-1-schonend). Ein golden markierter Vertrag hebt NUR die
 * Rang-Meilenstein-Komponente um (MULT − 1), aber absolut gedeckelt bei GOLDEN_MS_ABS_CAP_C (salaryFactor-
 * skaliert). Der Sockel (Bottom-5-Schutz) bleibt unangetastet. IDENTISCH angewandt in
 * getSponsorPayoutForFinalRankAndTier (Settlement) UND buildOfferCashAmounts (Anzeige) → Anzeige==Settlement.
 * Default isGolden=false ⇒ byte-identisch zu vorher (Wave-1-Tests unberührt). ENV-tunebar.
 */
export const SPONSOR_GOLDEN_MILESTONE_MULT = Number(process.env.OLY_SPONSOR_GOLDEN_MS_MULT ?? 1.3) || 1.3;
export const SPONSOR_GOLDEN_MS_ABS_CAP_C = Number(process.env.OLY_SPONSOR_GOLDEN_MS_ABS_CAP_C ?? 8) || 8;

/** goldenBonus = min(rawMilestone*(MULT−1), CAP*sf). Nur der positive Rang-Anteil, gedeckelt. */
export function getGoldenMilestoneBonus(rawMilestone: number, salaryFactor = 1): number {
  if (!Number.isFinite(rawMilestone) || rawMilestone <= 0) {
    return 0;
  }
  return round1(
    Math.min(rawMilestone * (SPONSOR_GOLDEN_MILESTONE_MULT - 1), SPONSOR_GOLDEN_MS_ABS_CAP_C * salaryFactor),
  );
}

export function getSponsorPayoutForFinalRankAndTier(
  finalRank: number | null | undefined,
  salaryFactor: number,
  starTier: SponsorStarTier,
  leagueMinSalary = SPONSOR_BASE_FLOOR_C,
  archetype: SponsorArchetype = "security",
  teamQualityRank?: number | null,
  expectedRank?: number | null,
  isGolden = false,
): number {
  const { effectiveBaseFloor, milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  // Archetyp-Kreuzung: base UND milestone laufen über dieselben Tabellen. Security = hoher Sockel, flache
  // Upside; performance = schlanker Sockel, steile Upside. Die Kreuzung liegt komplett in der Milestone-Mult.
  const rawBase = round1(
    effectiveBaseFloor * getArchetypeBaseMultiplier(archetype) * getStarTierBaseMultiplier(starTier),
  );

  // Gemeinsame Skalierung der Meilenstein-Leiter (Anker-Pool × globale Stauchung × Stern × Archetyp).
  const milestoneCommonScale =
    milestoneScale *
    SPONSOR_MILESTONE_LADDER_SCALE *
    getStarTierMilestoneMultiplier(starTier) *
    getArchetypeMilestoneMultiplier(archetype);

  const rebalance = getQualityRebalanceProfile(teamQualityRank);
  const absoluteMilestoneRaw = getRankMilestoneBonus(finalRank, salaryFactor);

  // Feed 2: performance mit bekannter Erwartung (teamQualityRankAtSign) bekommt einen KONKAVEN
  // Überperformance-Bonus, gemessen in GEWONNENER MEILENSTEIN-SCHWIERIGKEIT
  // (absMile(finalRank) − absMile(expectedRank)), NICHT in flachen Rang-Schritten. Da die Meilenstein-Leiter
  // oben dicht und unten dünn ist, ist ein Aufstieg im gepackten Mittelfeld/unteren Bereich (leicht)
  // automatisch wenig wert, ein Aufstieg nahe der Spitze (schwer) viel. Der Bonus ist ein Anteil
  // (SPONSOR_OVERPERFORMANCE_SHARE) der gewonnenen Schwierigkeit → die Auszahlung bleibt STRIKT MONOTON im
  // Endrang: ein besserer Endrang zahlt IMMER mehr, ein Rang-24-Überperformer überholt NIE einen
  // Rang-16-Halter. Ohne expectedRank ist der Bonus 0 (byte-identisch zu vorher, Wave-1-Tests unberührt).
  const useExpectationLadder =
    archetype === "performance" && expectedRank != null && Number.isFinite(expectedRank);
  const overperformanceDifficulty = useExpectationLadder
    ? Math.max(0, absoluteMilestoneRaw - getRankMilestoneBonus(expectedRank, salaryFactor))
    : 0;
  const milestoneBonus = round1(
    (absoluteMilestoneRaw + SPONSOR_OVERPERFORMANCE_SHARE * overperformanceDifficulty) *
      milestoneCommonScale *
      rebalance.milestoneScale,
  );
  const base = round1(rawBase * rebalance.baseScale);
  // Golden hebt NUR die (bereits gewählte) Rang-Komponente, gedeckelt — der Sockel bleibt unberührt.
  const goldenBonus = isGolden ? getGoldenMilestoneBonus(milestoneBonus, salaryFactor) : 0;
  return round1(base + milestoneBonus + goldenBonus);
}

/**
 * NEW curve-shape + rarity payout. `payout(rank) = effectiveBaseFloor(salary-anchored) × rarityEtatFactor ×
 * shapeRankMultiplier × qualityRebalance`. The salary anchor stays the dominant driver (the whole curve scales
 * with it); rarity is a bounded 0.90..1.15 Etat dial; the shape only redistributes WHERE the Etat sits. Golden
 * lifts only the above-floor (rank) portion, capped — the guaranteed floor is untouched. At salaryFactor 1.0 /
 * leagueMin 32 / magisch / no quality rebalance this returns exactly the calibrated reference arrays.
 */
export function getSponsorCurveShapePayout(
  finalRank: number | null | undefined,
  salaryFactor: number,
  rarity: SponsorRarity,
  curveShape: SponsorCurveShape,
  leagueMinSalary = SPONSOR_BASE_FLOOR_C,
  teamQualityRank?: number | null,
  isGolden = false,
): number {
  const { effectiveBaseFloor, milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  const rarityFactor = getSponsorRarityEtatFactor(rarity);
  const rebalance = getQualityRebalanceProfile(teamQualityRank);
  // Shapes already encode floor-vs-upside, so the weak-team rebalance is applied as a single blended scale
  // (mean of the old base/milestone scales) instead of splitting base vs milestone.
  const rebalanceScale = (rebalance.baseScale + rebalance.milestoneScale) / 2;
  const anchor = effectiveBaseFloor * rarityFactor * rebalanceScale;
  const floorPayout = anchor * getSponsorCurveShapeRankMultiplier(curveShape, 32);
  const rawRankPayout = anchor * getSponsorCurveShapeRankMultiplier(curveShape, finalRank ?? 32);
  // Anker-Elevations-Kompression (wie im Legacy-Pfad): die Upside ÜBER dem garantierten Sockel wird gestaucht,
  // sobald der gehaltsgeankerte Sockel über die statische Kalibrierung steigt — verhindert Top-End-Inflation
  // bei mehrsaisonaler Gehaltsdrift. Bei kalibriertem Anker ist milestoneScale = 1 (byte-identisch). Der Sockel
  // selbst bleibt ungestaucht (Bottom-Schutz).
  const rankPayout = round1(floorPayout + (rawRankPayout - floorPayout) * milestoneScale);
  const floorRounded = round1(floorPayout);
  const goldenBonus = isGolden ? getGoldenMilestoneBonus(Math.max(0, rankPayout - floorRounded), salaryFactor) : 0;
  return round1(rankPayout + goldenBonus);
}

/**
 * LOCKED-AT-SIGNING Rang-Payout-Leiter. Für JEDEN erreichbaren Endrang (1..32) wird die volle Payout-Summe mit
 * dem Anker + salaryFactor ZUM ZEITPUNKT DER UNTERSCHRIFT berechnet und im Vertrag persistiert. Das Settlement
 * liest die Leiter am erreichten Endrang ab, statt die Kurve aus den (über die Saison gedrifteten) Season-End-
 * Ankern neu abzuleiten — dadurch kann eine Anker-/salaryFactor-Drift die Auszahlung eines bereits
 * unterschriebenen Vertrags NIE mehr ändern. Wenn `rarity` + `curveShape` gesetzt sind, wird die Leiter aus dem
 * neuen Kurven-Payout gebaut; sonst (Altverträge) über den Legacy-Stern-/Archetyp-Pfad.
 */
export function buildLockedRankPayoutLadder(input: {
  salaryFactor: number;
  leagueMinSalary: number;
  starTier?: SponsorStarTier;
  archetype?: SponsorArchetype;
  rarity?: SponsorRarity;
  curveShape?: SponsorCurveShape;
  teamQualityRank?: number | null;
  expectedRank?: number | null;
  isGolden?: boolean;
}): number[] {
  const ladder: number[] = [];
  const useShape = input.rarity != null && input.curveShape != null;
  for (let finalRank = 1; finalRank <= 32; finalRank += 1) {
    ladder.push(
      useShape
        ? getSponsorCurveShapePayout(
            finalRank,
            input.salaryFactor,
            input.rarity!,
            input.curveShape!,
            input.leagueMinSalary,
            input.teamQualityRank,
            input.isGolden ?? false,
          )
        : getSponsorPayoutForFinalRankAndTier(
            finalRank,
            input.salaryFactor,
            input.starTier ?? 2,
            input.leagueMinSalary,
            input.archetype ?? "identity",
            input.teamQualityRank,
            input.expectedRank,
            input.isGolden ?? false,
          ),
    );
  }
  return ladder;
}

/** Liest die gelockte Leiter am erreichten Endrang (geklammert 1..32); `null`/ungültig ⇒ Rang 32 (Sockel). */
export function readLockedRankPayout(ladder: number[], finalRank: number | null | undefined): number {
  if (ladder.length === 0) {
    return 0;
  }
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return ladder[ladder.length - 1] ?? 0;
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  return ladder[boundedRank - 1] ?? ladder[ladder.length - 1] ?? 0;
}

export function buildOfferCashAmounts(input: {
  archetype: SponsorArchetype;
  salaryFactor: number;
  starTier: SponsorStarTier;
  leagueMinSalary?: number;
  teamQualityRank?: number | null;
  isGolden?: boolean;
}): { baseCash: number; rankCash: number; specialCash: number; totalAtMaxRank: number } {
  const leagueMinSalary = input.leagueMinSalary ?? SPONSOR_BASE_FLOOR_C;
  const { effectiveBaseFloor, milestonePool } = resolveSponsorEconomyAnchors(input.salaryFactor, leagueMinSalary);
  const baseMult = getStarTierBaseMultiplier(input.starTier);
  const milestoneMult = getStarTierMilestoneMultiplier(input.starTier);
  // Anzeige==Settlement (WAVE 1): identische Archetyp-Tabellen wie getSponsorPayoutForFinalRankAndTier.
  // rawBase = Sockel-Anteil, rawRank = Meilenstein-Anteil bei Rang 1 (getRankMilestoneBonus(1)*milestoneScale
  // = milestonePool). Summe rawBase*baseScale + rawRank*milestoneScale == Settlement bei Rang 1.
  const rawBase = round1(effectiveBaseFloor * getArchetypeBaseMultiplier(input.archetype) * baseMult);
  const rawRank = round1(
    milestonePool * SPONSOR_MILESTONE_LADDER_SCALE * milestoneMult * getArchetypeMilestoneMultiplier(input.archetype),
  );

  const rebalance = getQualityRebalanceProfile(input.teamQualityRank);
  let rankCash = round1(rawRank * rebalance.milestoneScale);
  // Golden: identischer Rang-Boost wie im Settlement (getSponsorPayoutForFinalRankAndTier, static path).
  // Basis ist die rebalancierte Rang-Komponente (== settlement milestoneBonus bei Rang 1). Gedeckelt.
  if (input.isGolden) {
    rankCash = round1(rankCash + getGoldenMilestoneBonus(rankCash, input.salaryFactor));
  }
  // Schwachen-Schutz: der garantierte Sockel wird für schwache Teams angehoben (baseScale), für starke
  // gekürzt — hält die Bottom-5 wirtschaftlich oben und die Schere unter Ziel. Muss zur Settlement-Seite
  // (applyQualityRebalanceToPayout) passen, die denselben baseScale anwendet.
  let baseCash = round1(rawBase * rebalance.baseScale);

  if (input.archetype === "security") {
    // Bottom-Schutz: der GARANTIERTE Sockel-Floor (effectiveBaseFloor) bleibt eine harte Untergrenze für
    // den "sicheren" Typ. Da ARCHETYPE_BASE_MULT.security = 1.07 > 1 liegt, bindet dieser Floor faktisch
    // nie, sichert die schwächsten Teams aber archetyp-eindeutig ab (bewusst an security gekoppelt).
    baseCash = round1(Math.max(baseCash, effectiveBaseFloor * rebalance.baseScale));
  }

  const totalAtMaxRank = round1(
    getSponsorPayoutForFinalRankAndTier(
      1,
      input.salaryFactor,
      input.starTier,
      leagueMinSalary,
      input.archetype,
      input.teamQualityRank,
      undefined,
      input.isGolden ?? false,
    ),
  );
  const specialCash = round1(totalAtMaxRank * 0.04);
  return { baseCash, rankCash, specialCash, totalAtMaxRank };
}

/** @deprecated Use getRankMilestoneBonus for Gewinnstufen settlement */
export function getTieredRankPayoutFraction(currentRank: number, target: number): number {
  if (currentRank <= target) {
    return 1;
  }
  if (currentRank <= target + 3) {
    return 0.5;
  }
  if (currentRank <= target + 6) {
    return 0.25;
  }
  return 0;
}

export function estimateExpectedPayout(
  offer: SponsorOffer,
  powerRank: number | null,
  leagueMinSalary?: number,
): number {
  const baseComponent = offer.components.find((component) => component.kind === "base");
  const starTier = offer.starTier ?? 2;
  const baseMult = getStarTierBaseMultiplier(starTier);
  const baseCash = baseComponent?.rewardCash ?? 0;
  // WAVE 1: baseCash = effectiveBaseFloor * ARCHETYPE_BASE_MULT * starTierBaseMult (* baseScale). Dividiert
  // man durch (FLOOR * starTierBaseMult * ARCHETYPE_BASE_MULT), fällt der Sockel als ~einheitlicher Faktor
  // heraus — konsistent über alle Archetypen (löst die frühere share-basierte Sonderfall-Inferenz ab).
  const archetypeBaseMult = getArchetypeBaseMultiplier(offer.archetype);
  const inferredFactor =
    baseMult > 0 && archetypeBaseMult > 0
      ? baseCash / (SPONSOR_BASE_FLOOR_C * baseMult * archetypeBaseMult)
      : 1;
  const salaryFactor = inferredFactor > 0 ? inferredFactor : 1;
  const resolvedLeagueMin =
    leagueMinSalary ??
    (offer.archetype === "security"
      ? round1(baseCash / Math.max(0.01, getStarTierBaseMultiplier(starTier) * archetypeBaseMult))
      : SPONSOR_BASE_FLOOR_C * salaryFactor);

  // Neuer Kurven-Pfad: die AI bewertet das Angebot an ihrem ERWARTETEN Endrang (≈ teamQualityRank), sodass die
  // Kurvenform-Ökonomie tatsächlich in die Wahl einfließt — sonst liefern alle Formen einer Familie denselben
  // erwarteten Payout und die AI wählt beliebig. Ein Team, das ~3. wird, bewertet Titel-/Meisterschale-Formen am
  // höchsten; ein Team, das ~28. wird, die Sicherheits-/Klassenerhalt-Formen. Rarity-Etat + Golden-Bonus stecken
  // bereits in getSponsorCurveShapePayout. Fallback auf den Legacy-Stern-Pfad nur für Altangebote ohne curveShape.
  if (offer.curveShape != null || offer.rarity != null) {
    const expectedRank = offer.teamQualityRank ?? powerRank;
    const rarity = offer.rarity ?? mapStarTierToRarity(offer.starTier);
    const curveShape = offer.curveShape ?? mapArchetypeToCurveShape(offer.archetype);
    let expected = getSponsorCurveShapePayout(
      expectedRank,
      salaryFactor,
      rarity,
      curveShape,
      resolvedLeagueMin,
      offer.teamQualityRank,
      offer.isGolden ?? false,
    );
    for (const component of offer.components) {
      if (component.kind === "improvement") {
        expected += component.rewardCash * 0.2;
      } else if (component.kind === "special") {
        expected += component.rewardCash * 0.12;
      }
    }
    return round1(expected);
  }

  // Legacy-Fallback (Altangebote ohne curveShape/rarity): Stern-/Archetyp-Payout am powerRank.
  const targetTotal = getSponsorPayoutForFinalRankAndTier(
    powerRank,
    salaryFactor,
    starTier,
    resolvedLeagueMin,
    offer.archetype,
    offer.teamQualityRank,
  );
  let expected = round1(Math.max(baseCash, targetTotal));
  for (const component of offer.components) {
    if (component.kind === "improvement") {
      expected += component.rewardCash * 0.2;
    } else if (component.kind === "special") {
      expected += component.rewardCash * 0.12;
    }
  }
  return round1(expected);
}

export function estimateSettlementPayout(
  offer: SponsorOffer,
  finalRank: number | null,
  salaryFactor = 1,
): number {
  const baseComponent = offer.components.find((component) => component.kind === "base");
  const rankComponent = offer.components.find((component) => component.kind === "rank");
  const base = baseComponent?.rewardCash ?? 0;
  const rankCash = rankComponent?.rewardCash ?? 0;
  const totalMilestone = getTotalMilestoneBonusC(salaryFactor);
  const unlocked = getRankMilestoneBonus(finalRank, salaryFactor);
  const rankPayout = totalMilestone > 0 ? round1(rankCash * (unlocked / totalMilestone)) : 0;
  let extra = 0;
  for (const component of offer.components) {
    if (component.kind === "improvement" || component.kind === "special") {
      extra += component.rewardCash * (component.kind === "special" ? 0.12 : 0.2);
    }
  }
  return round1(base + rankPayout + extra);
}
