import type { GameState, PlayerGeneratorAttributeName, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  FACILITY_CATALOG,
  FACILITY_CATALOG_BY_ID,
  getFacilityLevelDefinition,
  SPECIALIST_WING_VARIANTS,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import { clampFacilityCondition, getFacilityEfficiencyPct } from "@/lib/facilities/facility-condition";
import { legeLeihgabenUeberBestand, type SponsorLeihgabe } from "@/lib/sponsor/sponsor-leih-overlay";
import {
  DEVELOPMENT_ROUTE_BONUS_BASE_PCT,
  DEVELOPMENT_ROUTE_BONUS_MAX_PCT,
  type TrainingFocusAxis,
} from "@/lib/training/development-route-bonus";
import type { PlayerProgressionRatingTier } from "@/lib/training/training-plan-types";

export type FacilityStateSource = GameState | { gameState: GameState };

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clampLevel(level: number | null | undefined) {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return 0;
  }
  return Math.max(0, Math.min(5, Math.round(level)));
}

function resolveGameState(source: FacilityStateSource) {
  return "gameState" in source ? source.gameState : source;
}

export function getTeamFacilityState(source: FacilityStateSource, teamId: string): TeamFacilityCollection {
  const gameState = resolveGameState(source);
  const stored = gameState.seasonState.teamFacilities?.[teamId]?.facilities ?? {};
  const facilities = Object.fromEntries(
    FACILITY_CATALOG.map((catalogEntry) => {
      const existing = stored[catalogEntry.facilityId];
      const level = clampLevel(existing?.level);
      return [
          catalogEntry.facilityId,
          {
            level,
            enabled: existing?.enabled ?? level > 0,
            conditionPct: clampFacilityCondition(existing?.conditionPct),
            activeVariant: existing?.activeVariant,
            lastPaidSeasonId: existing?.lastPaidSeasonId,
            disabledReason: existing?.disabledReason ?? (level > 0 ? undefined : "not_built"),
          },
      ];
    }),
  ) as TeamFacilityCollection["facilities"];

  /**
   * GELIEHENE GEBÄUDE LIEGEN OBENAUF, nicht im Bestand.
   *
   * Jede Wirkungsrechnung im Spiel — Training, Erholung, Einnahmen, Scouting — liest ihre Stufe
   * ueber diese Funktion. Wird die Leihe hier eingerechnet, muss keine dieser Rechnungen von
   * Sponsoren wissen, und es entsteht kein zweiter Pfad, der auseinanderdriften koennte.
   *
   * Geschrieben wird sie NIE in `teamFacilities`: endet der Vertrag oder reisst die Rangmarke,
   * faellt das Team auf seinen eigenen Bestand zurueck. Stuende die Leihe im Bestand, waere dieser
   * Rueckfall ein Loeschvorgang — und ein vergessener oder halb ausgefuehrter Loeschvorgang
   * verschenkt ein Gebaeude auf Dauer.
   */
  const leihgaben = gameState.seasonState.sponsorLeihgabenByTeamId?.[teamId] ?? [];
  if (leihgaben.length === 0) {
    return { facilities };
  }

  return legeLeihgabenUeberBestand({ facilities }, leihgaben as SponsorLeihgabe[]);
}

export function getFacilityLevel(teamFacilities: TeamFacilityCollection | null | undefined, facilityId: FacilityId) {
  const entry = teamFacilities?.facilities?.[facilityId];
  if (!entry?.enabled || clampFacilityCondition(entry.conditionPct) <= 0) {
    return 0;
  }
  return clampLevel(entry?.level);
}

export function getFacilityEfficiency(teamFacilities: TeamFacilityCollection | null | undefined, facilityId: FacilityId) {
  const entry = teamFacilities?.facilities?.[facilityId];
  const conditionPct = clampFacilityCondition(entry?.conditionPct);
  if (!entry?.enabled || clampLevel(entry?.level) <= 0) {
    return { conditionPct, efficiencyPct: 0 };
  }
  return {
    conditionPct,
    efficiencyPct: getFacilityEfficiencyPct(conditionPct),
  };
}

export function calculateFacilityUpkeep(teamFacilities: TeamFacilityCollection | null | undefined) {
  return roundValue(
    FACILITY_CATALOG.reduce((sum, facility) => {
      return sum + calculateFacilitySeasonUpkeep(facility.facilityId, teamFacilities);
    }, 0),
  );
}

/**
 * Summiert die effektiven Saison-Einnahmen aller Gebäude (effizienzgewichtet).
 *
 * `arenaPopularityFactor` (Beliebtheit, Default 1.0 = Liga-Durchschnitt) skaliert
 * NUR die Arena (`arena_upgrade`) — der Fan-Shop bleibt bewusst flach. Der Default
 * 1.0 hält Aufrufer ohne Liga-Kontext (und Alt-Tests) auf der reinen Basis.
 * Reales Cash wird an der echten Season-End-Resolution (facility-season-end-service)
 * mit dem team-spezifischen Faktor gutgeschrieben.
 */
export function calculateFacilityIncome(
  teamFacilities: TeamFacilityCollection | null | undefined,
  options?: { arenaPopularityFactor?: number },
) {
  const arenaPopularityFactor =
    typeof options?.arenaPopularityFactor === "number" && Number.isFinite(options.arenaPopularityFactor)
      ? options.arenaPopularityFactor
      : 1;
  return roundValue(
    FACILITY_CATALOG.reduce((sum, facility) => {
      const level = getFacilityLevel(teamFacilities, facility.facilityId);
      const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
      const popularityFactor = facility.facilityId === "arena_upgrade" ? arenaPopularityFactor : 1;
      return (
        sum +
        ((getFacilityLevelDefinition(facility.facilityId, level)?.seasonIncome ?? 0) * efficiencyPct * popularityFactor) /
          100
      );
    }, 0),
  );
}

export function applyTrainingXpFacilityModifiers(
  baseTrainingXp: number,
  facilities: TeamFacilityCollection | null | undefined,
  options?: { developmentTrainingBonusPct?: number },
) {
  const level = getFacilityLevel(facilities, "training_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "training_center").efficiencyPct;
  const modifierPct = roundValue(((getFacilityLevelDefinition("training_center", level)?.modifierPct ?? 0) * efficiencyPct) / 100);
  const developmentBonusPct = options?.developmentTrainingBonusPct ?? 0;
  const totalModifierPct = modifierPct + developmentBonusPct;
  return {
    before: baseTrainingXp,
    modifierPct: totalModifierPct,
    after: roundValue(baseTrainingXp * (1 + totalModifierPct / 100), 0),
  };
}

/**
 * Beschreibt den Facility-Trainingseffekt für die UI, OHNE den Modifier erneut anzuwenden.
 * `boostedTrainingXp` ist der bereits facility-geboostete Wert (Summe der organischen
 * Trainings-Setpoints, die intern in `buildOrganicSeasonProgression` schon
 * `× (1 + facilityModifierPct/100)` enthalten). Der Chip zeigt diesen echten Wert als `after`
 * und rechnet `before` als facility-freie Roh-Basis zurück. Die frühere Version rief
 * `applyTrainingXpFacilityModifiers` auf den bereits geboosteten Wert auf und zählte damit den
 * Bonus doppelt (~1,7× bei Level-5-Center).
 */
export function describeTrainingXpFacilityEffect(
  boostedTrainingXp: number,
  facilities: TeamFacilityCollection | null | undefined,
  options?: { developmentTrainingBonusPct?: number },
) {
  const { modifierPct } = applyTrainingXpFacilityModifiers(0, facilities, options);
  const after = roundValue(boostedTrainingXp, 0);
  const before = modifierPct > -100 ? roundValue(after / (1 + modifierPct / 100), 0) : after;
  return { before, modifierPct, after };
}

/**
 * REHA/recovery-center = FLACHER, absoluter Recovery-Bonus (kein %-Bonus): Basis 20 →
 * DIE LEITER WAR NACH IHRER EIGENEN EICHUNG VERALTET. Hier stand: „exakt auf
 * `BASE_MATCHDAY_RECOVERY = 20` abgestimmt (L5 = 20 + 12 = 32 absolut)" — L5 gab also das
 * 1,6-fache der Basis. Im August 2026 wurde die Basis auf 28 angehoben, die Leiter nicht: L5
 * brachte damit nur noch das 1,43-fache, und der Ausbau lohnte sich immer weniger, je besser die
 * Grunderholung wurde.
 *
 * ENTSCHEIDUNG VON CHRIS: „aber ja die leiter muss angehoben werden". Und zur Frage, ob das
 * Reha-Zentrum in Saison 1 ueberhaupt gebaut werden kann: „recovery center erst ab season 2 bauen
 * ist auch nicht so verkehrt weil gebaeude ja auch teuer sind" — das Bau-Signal bleibt also, wie
 * es ist.
 *
 * NEU: L1=32, L2=36, L3=41, L4=46, L5=52 pro Spieltag bei 100 % Zustand (Basis 28 + Bonus).
 *
 * WARUM DIESE HOEHE UND NICHT NUR DIE ALTE EICHUNG NACHGEZOGEN: gemessen an einer echten Saison
 * bringt die alte Leiter, wenn ALLE Teams sie auf Stufe 5 haetten, ganze 1,09 verhinderte
 * Verletzungen je Team — bei 131 Baukosten und 4,8 Unterhalt je Saison, gegen Teamkassen von 5 bis
 * 18. Das war kein schwacher Zweig, das war ein toter. Mit der neuen Leiter sind es 1,63.
 *
 * WARUM DAS DEN VERLETZUNGSKORRIDOR NICHT REISST (150–200, Untergrenze 140): dieser Bonus gilt
 * nur fuer Teams, die GEBAUT haben. Der Korridor ist ausdruecklich fuer den gebaeudelosen Fall
 * gesetzt („ohne gebaeude frische boosts etc 150-200 ok"). Eine Anhebung der GRUNDerholung haette
 * dieselbe Entlastung gratis an alle 32 Teams verschenkt und den Korridor gerissen.
 *
 * DIE OBERGRENZE, an der es kippen wuerde: bei L5 = 52 gegen eine Spieltagslast von 16,9 liegt der
 * Gleichgewichts-Kader bei rund 10,4 Spielern — ein voll ausgebauter Elferkader laeuft flach, ein
 * Neunerkader steigt weiter. Genau dort soll die Grenze liegen: Investition hilft, sie ersetzt den
 * Kader nicht.
 */
export const RECOVERY_FLAT_BONUS_BY_LEVEL = [0, 2, 4, 6, 9, 12] as const;

export function getRecoveryFlatBonusAtLevel(level: number) {
  return RECOVERY_FLAT_BONUS_BY_LEVEL[clampLevel(level)] ?? 0;
}

export function getRecoveryFlatBonus(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "recovery_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "recovery_center").efficiencyPct;
  return roundValue(getRecoveryFlatBonusAtLevel(level) * (efficiencyPct / 100));
}

export function applyRecoveryFacilityModifiers(baseRecovery: number, facilities: TeamFacilityCollection | null | undefined) {
  const flatBonus = getRecoveryFlatBonus(facilities);
  const modifierPct =
    baseRecovery > 0 ? roundValue((flatBonus / baseRecovery) * 100) : flatBonus > 0 ? flatBonus * 5 : 0;
  return {
    before: baseRecovery,
    modifierPct,
    flatBonus,
    after: roundValue(baseRecovery + flatBonus, 2),
  };
}

/**
 * Trainings-Fatigue-Reduktion durch REHA (Balancing: Double-Dip entschärft). Der Divisor ist /40
 * (vorher /20), damit dieselbe flatBonus-Leiter NICHT zweimal voll zählt — einmal als flacher
 * Recovery-Bonus (Match-Fatigue) und einmal als Trainings-Cut. L5 = 12/40 = 30% statt 65%.
 */
export function getRecoveryTrainingFatigueReductionPct(facilities: TeamFacilityCollection | null | undefined) {
  const flatBonus = getRecoveryFlatBonus(facilities);
  return roundValue((flatBonus / 40) * 100);
}

function getAcademyDiscountPct(ratingTier: PlayerProgressionRatingTier, facilities: TeamFacilityCollection | null | undefined) {
  if (ratingTier !== "F" && ratingTier !== "E" && ratingTier !== "D") {
    return 0;
  }
  const level = getFacilityLevel(facilities, "academy");
  const efficiencyPct = getFacilityEfficiency(facilities, "academy").efficiencyPct;
  return roundValue(((getFacilityLevelDefinition("academy", level)?.discountPct ?? 0) * efficiencyPct) / 100);
}

/**
 * Academy-Effekt (repurposed): realer organischer Entwicklungs-Boost für junge/Low-Tier-Spieler
 * (F/E/D). Ersetzt den toten Upgrade-Kosten-Rabatt (XP-Kostensystem abgeschafft). Gibt den
 * Prozent-Boost auf das organische Trainingsbudget berechtigter Spieler zurück, skaliert mit
 * Academy-Level (`modifierPct` aus dem Katalog) × Facility-Effizienz. Für nicht-berechtigte Tiers
 * (C und besser) 0. Analog zu `getRecoveryTrainingFatigueReductionPct` gehalten — Katalog ist die
 * einzige Zahlenquelle.
 */
export function getAcademyDevelopmentBoostPct(
  ratingTier: PlayerProgressionRatingTier,
  facilities: TeamFacilityCollection | null | undefined,
) {
  if (ratingTier !== "F" && ratingTier !== "E" && ratingTier !== "D") {
    return 0;
  }
  const level = getFacilityLevel(facilities, "academy");
  const efficiencyPct = getFacilityEfficiency(facilities, "academy").efficiencyPct;
  return roundValue(((getFacilityLevelDefinition("academy", level)?.modifierPct ?? 0) * efficiencyPct) / 100);
}

function normalizeSpecialistVariant(value: string | null | undefined): SpecialistWingVariant {
  return value && Object.prototype.hasOwnProperty.call(SPECIALIST_WING_VARIANTS, value)
    ? (value as SpecialistWingVariant)
    : "power_gym";
}

function getSpecialistDiscountPct(attribute: PlayerGeneratorAttributeName, facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "specialist_wing");
  const efficiencyPct = getFacilityEfficiency(facilities, "specialist_wing").efficiencyPct;
  const variant = normalizeSpecialistVariant(facilities?.facilities?.specialist_wing?.activeVariant);
  const matchesVariant = SPECIALIST_WING_VARIANTS[variant].attributes.includes(attribute);
  return matchesVariant ? roundValue(((getFacilityLevelDefinition("specialist_wing", level)?.discountPct ?? 0) * efficiencyPct) / 100) : 0;
}

/**
 * S1 — Der Specialist Wing SETZT die Trainings-Fokusachse des Teams.
 *
 * Gibt die Achse der aktiven Variante zurück, sobald der Flügel real wirkt (Level >= 1, aktiviert,
 * Zustand > 0 — genau das prüft `getFacilityLevel`). Ohne Flügel `null`; dann gilt weiterhin die
 * Trainingseinstellung (`aiManagerTrainingSettings[teamId].trainingFocus`), siehe
 * `resolveTeamTrainingFocusAxis` in organic-season-progression.ts.
 *
 * Bewusst „ersetzt" statt „verstärkt nur bei Übereinstimmung": das Konzept nennt das ausdrücklich
 * robuster, weil der Effekt sonst still an einer zweiten Einstellung hängt, die man übersehen kann.
 */
export function getSpecialistWingFocusAxis(
  facilities: TeamFacilityCollection | null | undefined,
): TrainingFocusAxis | null {
  const level = getFacilityLevel(facilities, "specialist_wing");
  if (level <= 0) return null;
  const variant = normalizeSpecialistVariant(facilities?.facilities?.specialist_wing?.activeVariant);
  return SPECIALIST_WING_VARIANTS[variant].focusAxis;
}

/**
 * Routenbonus in Prozent für Spieler, deren Entwicklungsroute zur Fokusachse passt.
 *
 * Ohne Flügel bleibt es beim Basiswert (+8 %, `DEVELOPMENT_ROUTE_BONUS_BASE_PCT`) — das ist exakt das
 * heutige Verhalten. Mit Flügel kommt der Katalogwert (`modifierPct`) zum Tragen; der Anteil ÜBER der
 * Basis wird mit der Gebäude-Effizienz gewichtet, damit ein verfallener Flügel auf die Basis
 * zurückfällt statt unter sie. `DEVELOPMENT_ROUTE_BONUS_MAX_PCT` ist die harte Klammer nach oben.
 */
export function getSpecialistWingFocusBonusPct(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "specialist_wing");
  if (level <= 0) return DEVELOPMENT_ROUTE_BONUS_BASE_PCT;
  const efficiencyPct = getFacilityEfficiency(facilities, "specialist_wing").efficiencyPct;
  const catalogPct = getFacilityLevelDefinition("specialist_wing", level)?.modifierPct ?? DEVELOPMENT_ROUTE_BONUS_BASE_PCT;
  const cappedPct = Math.min(catalogPct, DEVELOPMENT_ROUTE_BONUS_MAX_PCT);
  const surchargePct = Math.max(0, cappedPct - DEVELOPMENT_ROUTE_BONUS_BASE_PCT);
  return roundValue(DEVELOPMENT_ROUTE_BONUS_BASE_PCT + (surchargePct * efficiencyPct) / 100);
}

/**
 * Unterhalt einer einzelnen Facility.
 *
 * Der frühere Specialist-Wing-Rabatt auf DIESEN Wert ist mit S1 ersatzlos entfallen: er war nirgends
 * beworben, rechnete nicht monoton (Maximum bei L3, danach schlechter) und hätte dem Flügel neben der
 * Fokusachse einen zweiten, unabhängigen Effekt gelassen — womit das Gebäude nicht bepreisbar wäre.
 */
export function calculateFacilitySeasonUpkeep(
  facilityId: FacilityId,
  teamFacilities: TeamFacilityCollection | null | undefined,
) {
  const level = getFacilityLevel(teamFacilities, facilityId);
  const baseUpkeep = getFacilityLevelDefinition(facilityId, level)?.seasonUpkeep ?? 0;
  if (baseUpkeep <= 0) {
    return 0;
  }

  return roundValue(baseUpkeep);
}

export function applyUpgradeCostFacilityModifiers(
  attribute: PlayerGeneratorAttributeName,
  ratingTier: PlayerProgressionRatingTier,
  baseCost: number,
  facilities: TeamFacilityCollection | null | undefined,
) {
  const academyDiscountPct = getAcademyDiscountPct(ratingTier, facilities);
  const specialistDiscountPct = getSpecialistDiscountPct(attribute, facilities);
  const facilityDiscountPct = academyDiscountPct + specialistDiscountPct;
  return {
    costBeforeFacility: baseCost,
    academyDiscountPct,
    specialistDiscountPct,
    facilityDiscountPct,
    costAfterFacility: Math.max(1, Math.ceil(baseCost * (1 - facilityDiscountPct / 100))),
    appliedEffects: [
      academyDiscountPct > 0 ? `academy_low_tier_discount:${academyDiscountPct}pct` : null,
      specialistDiscountPct > 0 ? `specialist_wing_discount:${specialistDiscountPct}pct` : null,
    ].filter((entry): entry is string => Boolean(entry)),
  };
}

export function getScoutingConfidence(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "scouting_office");
  return {
    level,
    label: level === 0 ? "none" : FACILITY_CATALOG_BY_ID.scouting_office.levels[level - 1]?.effectDescription ?? "unknown",
  };
}

export function getAnalyticsForecastQuality(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "analytics_room");
  return {
    level,
    label: level === 0 ? "baseline" : FACILITY_CATALOG_BY_ID.analytics_room.levels[level - 1]?.effectDescription ?? "unknown",
  };
}
