import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";

export type FacilityId =
  | "training_center"
  | "recovery_center"
  | "scouting_office"
  | "analytics_room"
  | "fan_shop"
  | "arena_upgrade"
  | "academy"
  | "specialist_wing";

export type FacilityEffectType =
  | "training_xp"
  | "recovery"
  | "scouting"
  | "analytics"
  | "season_income"
  | "low_tier_upgrade_discount"
  | "specialist_upgrade_discount";

export type SpecialistWingVariant = "power_gym" | "agility_track" | "mind_lab" | "social_studio";

export type FacilityLevelDefinition = {
  level: number;
  effectDescription: string;
  upgradeCost: number;
  seasonUpkeep: number;
  seasonIncome?: number;
  modifierPct?: number;
  discountPct?: number;
};

export type FacilityCatalogEntry = {
  facilityId: FacilityId;
  label: string;
  description: string;
  maxLevel: 5;
  effectType: FacilityEffectType;
  effectDescription: string;
  levels: FacilityLevelDefinition[];
  disabledReason?: string;
};

export const SPECIALIST_WING_VARIANTS: Record<
  SpecialistWingVariant,
  { label: string; attributes: PlayerGeneratorAttributeName[] }
> = {
  power_gym: {
    label: "Power Gym",
    attributes: ["power", "health", "stamina", "torment"],
  },
  agility_track: {
    label: "Agility Track",
    attributes: ["speed", "dexterity", "awareness"],
  },
  mind_lab: {
    label: "Mind Lab",
    attributes: ["intelligence", "will", "determination"],
  },
  social_studio: {
    label: "Social Studio",
    attributes: ["charisma", "spirit", "awareness"],
  },
};

export const FACILITY_CATALOG: FacilityCatalogEntry[] = [
  {
    facilityId: "training_center",
    label: "Trainingszentrum",
    description: "Verbessert nur Base Training XP, nicht Match-Performance.",
    maxLevel: 5,
    effectType: "training_xp",
    effectDescription: "Base Training XP Modifier",
    levels: [
      { level: 1, effectDescription: "+5% Base Training XP", upgradeCost: 8, seasonUpkeep: 0.8, modifierPct: 5 },
      { level: 2, effectDescription: "+9% Base Training XP", upgradeCost: 15, seasonUpkeep: 1.4, modifierPct: 9 },
      { level: 3, effectDescription: "+14% Base Training XP", upgradeCost: 25, seasonUpkeep: 2.4, modifierPct: 14 },
      { level: 4, effectDescription: "+18% Base Training XP", upgradeCost: 40, seasonUpkeep: 3.8, modifierPct: 18 },
      { level: 5, effectDescription: "+22% Base Training XP", upgradeCost: 62, seasonUpkeep: 5.5, modifierPct: 22 },
    ],
  },
  {
    facilityId: "recovery_center",
    label: "Recovery Center",
    description: "Verbessert Erholung und Fatigue-Signale, macht Push aber nicht kostenlos.",
    maxLevel: 5,
    effectType: "recovery",
    effectDescription: "Recovery Modifier",
    levels: [
      { level: 1, effectDescription: "+2 Recovery (Basis 20 → 22)", upgradeCost: 7, seasonUpkeep: 0.7, modifierPct: 5 },
      { level: 2, effectDescription: "+4 Recovery (Basis 20 → 24)", upgradeCost: 13, seasonUpkeep: 1.2, modifierPct: 10 },
      { level: 3, effectDescription: "+6 Recovery (Basis 20 → 26)", upgradeCost: 22, seasonUpkeep: 2.1, modifierPct: 15 },
      { level: 4, effectDescription: "+9 Recovery (Basis 20 → 29)", upgradeCost: 35, seasonUpkeep: 3.3, modifierPct: 20 },
      { level: 5, effectDescription: "+12 Recovery (Basis 20 → 32)", upgradeCost: 54, seasonUpkeep: 4.8, modifierPct: 25 },
    ],
  },
  {
    facilityId: "scouting_office",
    label: "Scouting Office",
    description: "Verbessert Potential-, Wishlist-, Fit- und Economy-Informationen.",
    maxLevel: 5,
    effectType: "scouting",
    effectDescription: "Scouting Confidence",
    levels: [
      { level: 1, effectDescription: "grobe Diszi-/Potential-Spannen", upgradeCost: 6, seasonUpkeep: 0.6 },
      { level: 2, effectDescription: "kleinere Scouting-Spannen", upgradeCost: 12, seasonUpkeep: 1.1 },
      { level: 3, effectDescription: "bessere Wishlist-Infos + leichter Signing-Boost", upgradeCost: 20, seasonUpkeep: 1.8 },
      { level: 4, effectDescription: "bessere MW-/Gehalt-/Diszi-Reads", upgradeCost: 32, seasonUpkeep: 2.8 },
      { level: 5, effectDescription: "reale Diszi-Werte + sehr genaue Prognosen", upgradeCost: 50, seasonUpkeep: 4.2 },
    ],
  },
  {
    facilityId: "analytics_room",
    label: "Analytics Room",
    description: "Verbessert Forecast-Qualitaet, nicht Leistung.",
    maxLevel: 5,
    effectType: "analytics",
    effectDescription: "Forecast Quality",
    levels: [
      { level: 1, effectDescription: "einfache Forecasts", upgradeCost: 5, seasonUpkeep: 0.5 },
      { level: 2, effectDescription: "bessere XP-Prognose", upgradeCost: 10, seasonUpkeep: 0.9 },
      { level: 3, effectDescription: "bessere Slot-Fit-Prognose", upgradeCost: 17, seasonUpkeep: 1.5 },
      { level: 4, effectDescription: "bessere Salary-/MW-Warnings", upgradeCost: 27, seasonUpkeep: 2.4 },
      { level: 5, effectDescription: "sehr genaue Season-Forecasts", upgradeCost: 42, seasonUpkeep: 3.6 },
    ],
  },
  {
    facilityId: "fan_shop",
    label: "Fan Shop",
    description: "Erzeugt langsames saisonales Cash-Income (flach, verlässlich — nicht beliebtheitsskaliert).",
    maxLevel: 5,
    effectType: "season_income",
    effectDescription: "Season Cash Income",
    // BALANCE (tunable): Frühe Ausbaukosten L1/L2 bewusst angehoben (Anti-No-Brainer),
    // damit L1-Payback ~3.5+ Saisons statt ~2.3 dauert. L1 7→10 (+43%), L2 14→19 (+36%).
    // L3–L5 unverändert. seasonUpkeep bleibt wie gehabt. seasonIncome war zuvor
    // toned down (3.5/7/11/16/24 → 2.5/5/7.5/11/16). Danach seasonIncome +30% angehoben
    // (2.5/5/7.5/11/16 → 3.25/6.5/9.75/14.3/20.8), damit der Fan-Shop mehr Cash abwirft;
    // bleibt weiterhin flach (nicht beliebtheitsskaliert) und moderat.
    levels: [
      { level: 1, effectDescription: "+3.25 Cash/Saison", upgradeCost: 10, seasonUpkeep: 0.4, seasonIncome: 3.25 },
      { level: 2, effectDescription: "+6.5 Cash/Saison", upgradeCost: 19, seasonUpkeep: 0.8, seasonIncome: 6.5 },
      { level: 3, effectDescription: "+9.75 Cash/Saison", upgradeCost: 23, seasonUpkeep: 1.4, seasonIncome: 9.75 },
      { level: 4, effectDescription: "+14.3 Cash/Saison", upgradeCost: 36, seasonUpkeep: 2.2, seasonIncome: 14.3 },
      { level: 5, effectDescription: "+20.8 Cash/Saison", upgradeCost: 56, seasonUpkeep: 3.4, seasonIncome: 20.8 },
    ],
  },
  {
    facilityId: "arena_upgrade",
    label: "Arena Upgrade",
    description: "Erzeugt saisonales Arena-Cash. Basis × Beliebtheit — starke/beliebte Teams verdienen mehr.",
    maxLevel: 5,
    effectType: "season_income",
    effectDescription: "Season Arena Income (Basis × Beliebtheit)",
    // BALANCE (tunable): Arena-Basis-Einnahmen waren zuvor 1.75/3.5/5.5/8/12. Danach
    // seasonIncome +30% angehoben (→ 2.28/4.55/7.15/10.4/15.6), damit die Arena mehr
    // Cash abwirft. Die Arena skaliert mit Beliebtheit (bis ×1.5, siehe
    // lib/economy/team-beliebtheit.ts + facility-season-end-service): selbst ein maximal
    // beliebtes Team (×1.5) bleibt bei L5 mit effektiv 23.4 unter SPONSOR_BASE_FLOOR_C=32
    // (lib/sponsor/sponsor-economy-calibration.ts). Upkeep/Ausbaukosten unverändert.
    // Alles hier weiterhin frei tunbar.
    levels: [
      { level: 1, effectDescription: "+2.28 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 13, seasonUpkeep: 0.8, seasonIncome: 2.28 },
      { level: 2, effectDescription: "+4.55 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 24, seasonUpkeep: 1.4, seasonIncome: 4.55 },
      { level: 3, effectDescription: "+7.15 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 30, seasonUpkeep: 2.4, seasonIncome: 7.15 },
      { level: 4, effectDescription: "+10.4 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 46, seasonUpkeep: 3.6, seasonIncome: 10.4 },
      { level: 5, effectDescription: "+15.6 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 72, seasonUpkeep: 5.4, seasonIncome: 15.6 },
    ],
  },
  {
    facilityId: "academy",
    label: "Academy",
    description: "Reduziert nur Low-Tier-Upgradekosten F/E/D.",
    maxLevel: 5,
    effectType: "low_tier_upgrade_discount",
    effectDescription: "F/E/D Upgrade Cost Discount",
    levels: [
      { level: 1, effectDescription: "F/E/D-Upgrades -3%", upgradeCost: 7, seasonUpkeep: 0.7, discountPct: 3 },
      { level: 2, effectDescription: "F/E/D-Upgrades -6%", upgradeCost: 13, seasonUpkeep: 1.2, discountPct: 6 },
      { level: 3, effectDescription: "F/E/D-Upgrades -9% + Prospect-Info", upgradeCost: 22, seasonUpkeep: 2, discountPct: 9 },
      { level: 4, effectDescription: "F/E/D-Upgrades -12%", upgradeCost: 35, seasonUpkeep: 3.1, discountPct: 12 },
      { level: 5, effectDescription: "F/E/D-Upgrades -15%", upgradeCost: 55, seasonUpkeep: 4.8, discountPct: 15 },
    ],
  },
  {
    facilityId: "specialist_wing",
    label: "Specialist Wing",
    description: "Reduziert nur Upgrade-Kosten der aktiven Spezialisten-Variante.",
    maxLevel: 5,
    effectType: "specialist_upgrade_discount",
    effectDescription: "Specialist Attribute Group Discount",
    levels: [
      { level: 1, effectDescription: "passende Upgrades -3%", upgradeCost: 6, seasonUpkeep: 0.6, discountPct: 3 },
      { level: 2, effectDescription: "passende Upgrades -5%", upgradeCost: 12, seasonUpkeep: 1.1, discountPct: 5 },
      { level: 3, effectDescription: "passende Upgrades -7%", upgradeCost: 20, seasonUpkeep: 1.8, discountPct: 7 },
      { level: 4, effectDescription: "passende Upgrades -9%", upgradeCost: 32, seasonUpkeep: 2.8, discountPct: 9 },
      { level: 5, effectDescription: "passende Upgrades -12%", upgradeCost: 50, seasonUpkeep: 4.2, discountPct: 12 },
    ],
  },
];

export const FACILITY_CATALOG_BY_ID = Object.fromEntries(
  FACILITY_CATALOG.map((facility) => [facility.facilityId, facility]),
) as Record<FacilityId, FacilityCatalogEntry>;

export function getFacilityLevelDefinition(facilityId: FacilityId, level: number) {
  return FACILITY_CATALOG_BY_ID[facilityId]?.levels.find((entry) => entry.level === level) ?? null;
}
