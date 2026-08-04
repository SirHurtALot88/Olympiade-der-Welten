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
    // WICHTIG (Single Source of Truth): `modifierPct` ist der REAL angewandte Base-Training-XP-Bonus.
    // Die organische Saison-Progression (organic-season-progression.ts) liest den Modifier über
    // getFacilityLevelDefinition() aus GENAU diesen Werten — es gibt kein zweites hartkodiertes Array
    // mehr, damit Anzeige (Trainingspanel/Forecasts/Facility-Cards) und angewandter Wert niemals
    // divergieren können. Werte = [14,28,42,56,70] % (L1..L5), L5 = +70 %.
    levels: [
      { level: 1, effectDescription: "+14% Base Training XP", upgradeCost: 8, seasonUpkeep: 0.8, modifierPct: 14 },
      { level: 2, effectDescription: "+28% Base Training XP", upgradeCost: 15, seasonUpkeep: 1.4, modifierPct: 28 },
      { level: 3, effectDescription: "+42% Base Training XP", upgradeCost: 25, seasonUpkeep: 2.4, modifierPct: 42 },
      { level: 4, effectDescription: "+56% Base Training XP", upgradeCost: 40, seasonUpkeep: 3.8, modifierPct: 56 },
      { level: 5, effectDescription: "+70% Base Training XP", upgradeCost: 62, seasonUpkeep: 5.5, modifierPct: 70 },
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
    /**
     * WAS HIER VORHER STAND UND WARUM ES WEG MUSSTE. Der Katalog bewarb bis hierher eine
     * „Forecast Quality" mit fuenf Stufen („bessere XP-Prognose", „bessere Slot-Fit-Prognose",
     * „bessere Salary-/MW-Warnings", „sehr genaue Season-Forecasts"). Nichts davon wurde irgendwo
     * gemessen: die einzige Auswertefunktion (`getAnalyticsForecastQuality`) gab genau diese Texte
     * als Label zurueck, und die Prognose-Pipeline kennt gar keinen Konfidenzbegriff, an dem sich
     * eine Qualitaet haette aendern koennen. Ein Gebaeude, das etwas anderes verspricht als es tut,
     * war der Ausloeser des Gebaeude-Berichts — deshalb beschreiben die Stufentexte jetzt exakt das,
     * was `lib/facilities/analytics-live-progress.ts` tatsaechlich freischaltet, Stufe fuer Stufe.
     *
     * Bau- und Unterhaltskosten sind UNVERAENDERT. Es ist keine Balance-Aenderung, sondern eine
     * Beschriftung, die zur Wirkung passt.
     */
    description: "Zeigt den Live-Fortschritt auf Sponsor-Achse und Board-Zielen — Auskunft, keine Leistung.",
    maxLevel: 5,
    effectType: "analytics",
    effectDescription: "Live-Fortschritt",
    levels: [
      { level: 1, effectDescription: "Sponsor-Achse: grobe Einordnung", upgradeCost: 5, seasonUpkeep: 0.5 },
      { level: 2, effectDescription: "Sponsor-Achse: exakter Erfüllungsgrad", upgradeCost: 10, seasonUpkeep: 0.9 },
      { level: 3, effectDescription: "Sponsor-Achse: Ist/Ziel + Restbedarf", upgradeCost: 17, seasonUpkeep: 1.5 },
      { level: 4, effectDescription: "Board-Ziele: Zwischenstand", upgradeCost: 27, seasonUpkeep: 2.4 },
      { level: 5, effectDescription: "Board-Ziele: Abstand zum Ziel", upgradeCost: 42, seasonUpkeep: 3.6 },
    ],
  },
  {
    facilityId: "fan_shop",
    label: "Fan Shop",
    description: "Erzeugt langsames saisonales Cash-Income (flach, verlässlich — nicht beliebtheitsskaliert).",
    maxLevel: 5,
    effectType: "season_income",
    effectDescription: "Season Cash Income",
    // BALANCE (tunable): seasonIncome erneut angehoben (3.25/6.5/9.75/14.3/20.8 →
    // 3.9/7.8/11.7/17.2/25.0), damit sich der Fan-Shop schneller amortisiert (marginale Amortisation
    // jetzt ~3–8.5 Saisons statt bis ~8.3, kumuliert ~3–7). Der Fan-Shop ist die SICHERE Cash-Quelle
    // (flach, nicht beliebtheitsskaliert) und wirkt dem Transfer-Cash-Drain der Liga entgegen.
    // Ausbaukosten/Upkeep unverändert.
    levels: [
      { level: 1, effectDescription: "+3.9 Cash/Saison", upgradeCost: 10, seasonUpkeep: 0.4, seasonIncome: 3.9 },
      { level: 2, effectDescription: "+7.8 Cash/Saison", upgradeCost: 19, seasonUpkeep: 0.8, seasonIncome: 7.8 },
      { level: 3, effectDescription: "+11.7 Cash/Saison", upgradeCost: 23, seasonUpkeep: 1.4, seasonIncome: 11.7 },
      { level: 4, effectDescription: "+17.2 Cash/Saison", upgradeCost: 36, seasonUpkeep: 2.2, seasonIncome: 17.2 },
      { level: 5, effectDescription: "+25.0 Cash/Saison", upgradeCost: 56, seasonUpkeep: 3.4, seasonIncome: 25.0 },
    ],
  },
  {
    facilityId: "arena_upgrade",
    label: "Arena Upgrade",
    description: "Erzeugt saisonales Arena-Cash. Basis × Beliebtheit — starke/beliebte Teams verdienen mehr.",
    maxLevel: 5,
    effectType: "season_income",
    effectDescription: "Season Arena Income (Basis × Beliebtheit)",
    // BALANCE (tunable): Arena-Basis-Einnahmen deutlich angehoben (2.28/4.55/7.15/10.4/15.6 →
    // 2.4/6.0/10.8/17.7/28.5), damit sich JEDES Arena-Upgrade in ~8 Saisons amortisiert (marginale
    // Amortisation vorher 9–22 Saisons — die Arena war praktisch nie ein rationaler Bau). Bei
    // Beliebtheit 1.0 liegt die marginale Amortisation je Level konstant bei ~8 Saisons; die Arena
    // ist die BELIEBTHEITS-gekoppelte High-Ceiling-Einnahme (bis ×1.5) und ergänzt den flachen
    // Fan-Shop. Der frühere Deckel „unter SPONSOR_BASE_FLOOR_C=32 halten" ist bewusst aufgegeben —
    // Einnahmegebäude SOLLEN sich lohnen, um dem Transfer-Cash-Drain entgegenzuwirken. Ausbaukosten/
    // Upkeep unverändert. Alles frei tunbar.
    levels: [
      { level: 1, effectDescription: "+2.4 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 13, seasonUpkeep: 0.8, seasonIncome: 2.4 },
      { level: 2, effectDescription: "+6.0 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 24, seasonUpkeep: 1.4, seasonIncome: 6.0 },
      { level: 3, effectDescription: "+10.8 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 30, seasonUpkeep: 2.4, seasonIncome: 10.8 },
      { level: 4, effectDescription: "+17.7 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 46, seasonUpkeep: 3.6, seasonIncome: 17.7 },
      { level: 5, effectDescription: "+28.5 Cash/Saison (Basis × Beliebtheit)", upgradeCost: 72, seasonUpkeep: 5.4, seasonIncome: 28.5 },
    ],
  },
  {
    facilityId: "academy",
    label: "Academy",
    description: "Beschleunigt die organische Entwicklung junger/Low-Tier-Spieler (F/E/D).",
    maxLevel: 5,
    effectType: "low_tier_upgrade_discount",
    effectDescription: "F/E/D Youth Development Boost",
    // EFFEKT-REPURPOSE: Der alte Upgrade-Kosten-Rabatt (`discountPct`) war tot — das XP-Kostensystem
    // ist abgeschafft, der reale Season-End-Apply läuft über die organische Progression zu Kosten 0.
    // NEU: `modifierPct` beschleunigt das organische Trainingsbudget berechtigter F/E/D-Spieler
    // (skaliert mit Academy-Level × Effizienz, siehe getAcademyDevelopmentBoostPct). `discountPct`
    // bleibt aus Kompatibilitätsgründen für die (tote) Preview-/Upgrade-Kosten-Pfad-Anzeige erhalten,
    // hat aber keinen realen Gameplay-Effekt mehr. Ökonomie (upgradeCost/seasonUpkeep) unverändert.
    levels: [
      { level: 1, effectDescription: "Junge/F-E-D-Spieler +6% Entwicklung", upgradeCost: 7, seasonUpkeep: 0.7, modifierPct: 6, discountPct: 3 },
      { level: 2, effectDescription: "Junge/F-E-D-Spieler +12% Entwicklung", upgradeCost: 13, seasonUpkeep: 1.2, modifierPct: 12, discountPct: 6 },
      { level: 3, effectDescription: "Junge/F-E-D-Spieler +18% Entwicklung + Prospect-Info", upgradeCost: 22, seasonUpkeep: 2, modifierPct: 18, discountPct: 9 },
      { level: 4, effectDescription: "Junge/F-E-D-Spieler +24% Entwicklung", upgradeCost: 35, seasonUpkeep: 3.1, modifierPct: 24, discountPct: 12 },
      { level: 5, effectDescription: "Junge/F-E-D-Spieler +30% Entwicklung", upgradeCost: 55, seasonUpkeep: 4.8, modifierPct: 30, discountPct: 15 },
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
