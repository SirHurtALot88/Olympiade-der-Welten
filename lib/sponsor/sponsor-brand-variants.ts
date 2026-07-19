import type { SponsorArchetype, SponsorCurveShape, SponsorRarity } from "@/lib/data/olyDataTypes";

import type { SponsorBrandIndustry, SponsorBrandParent } from "@/lib/sponsor/sponsor-brand-parents";
import { SPONSOR_BRAND_PARENTS } from "@/lib/sponsor/sponsor-brand-parents";
import { SPONSOR_RARITIES, mapStarTierToRarity } from "@/lib/sponsor/sponsor-curve-shapes";
import { mapCurveShapeToArchetype } from "@/lib/sponsor/sponsor-tier-pool";

export type SponsorSpecialTemplateId =
  | "transfer_profit_min"
  | "discipline_top3_count"
  | "form_color_cover"
  | "axis_rank_top"
  | "salary_pressure_max";

export type SponsorVariantKey =
  | "security_standard"
  | "performance_rank"
  | "identity_special"
  | "premium_elite"
  | "regional_fan";

export type SponsorBrandTemplate = {
  id: string;
  parentBrandId: string;
  variantKey: SponsorVariantKey;
  flavorSuffix: string;
  name: string;
  flavor: string;
  archetype: SponsorArchetype;
  /** Legacy 1..5 star-range this variant was tuned for; only ever consumed via tierRangeToRarityOrder(). */
  tierRange: [number, number];
  specialTemplates: SponsorSpecialTemplateId[];
  baseCash: number;
  rankCash: number;
  improvementCash: number;
  specialCash: number;
};

type VariantBlueprint = {
  key: SponsorVariantKey;
  archetype: SponsorArchetype;
  tierRange: [number, number];
  flavorSuffix: string;
  baseCash: number;
  rankCash: number;
  improvementCash: number;
  specialCash: number;
};

const CORE_BLUEPRINTS: VariantBlueprint[] = [
  {
    key: "security_standard",
    archetype: "security",
    tierRange: [1, 3],
    flavorSuffix: "Sicherheits-Paket — hohe Basis, moderate Gewinnstufen",
    baseCash: 0,
    rankCash: 0,
    improvementCash: 0,
    specialCash: 0,
  },
  {
    key: "performance_rank",
    archetype: "performance",
    tierRange: [2, 5],
    flavorSuffix: "Leistungs-Paket — wenig Basis, hohe Gewinnstufen",
    baseCash: 0,
    rankCash: 0,
    improvementCash: 0,
    specialCash: 0,
  },
  {
    key: "identity_special",
    archetype: "identity",
    tierRange: [1, 4],
    flavorSuffix: "Identitäts-Paket — ausgewogene Stufen plus Sonderziel",
    baseCash: 0,
    rankCash: 0,
    improvementCash: 0,
    specialCash: 0,
  },
  {
    key: "premium_elite",
    archetype: "performance",
    tierRange: [4, 5],
    flavorSuffix: "Premium-Elite — anspruchsvolle Stufen, Top-Cash",
    baseCash: 0,
    rankCash: 0,
    improvementCash: 0,
    specialCash: 0,
  },
  {
    key: "regional_fan",
    archetype: "security",
    tierRange: [1, 2],
    flavorSuffix: "Fan-Paket — solide Basis für aufbauende Teams",
    baseCash: 0,
    rankCash: 0,
    improvementCash: 0,
    specialCash: 0,
  },
];

function industrySpecialTemplates(industry: SponsorBrandIndustry): SponsorSpecialTemplateId[] {
  if (industry === "logistics" || industry === "finance" || industry === "retail") {
    return ["transfer_profit_min", "salary_pressure_max", "form_color_cover", "discipline_top3_count"];
  }
  if (industry === "sport" || industry === "auto" || industry === "airline") {
    return ["discipline_top3_count", "axis_rank_top", "form_color_cover", "transfer_profit_min"];
  }
  if (industry === "media" || industry === "telecom" || industry === "food") {
    return ["form_color_cover", "axis_rank_top", "discipline_top3_count", "transfer_profit_min"];
  }
  return ["form_color_cover", "axis_rank_top", "discipline_top3_count", "transfer_profit_min"];
}

function blueprintsForParent(parent: SponsorBrandParent): VariantBlueprint[] {
  const core = CORE_BLUEPRINTS.filter((blueprint) => {
    if (blueprint.key === "premium_elite") {
      return parent.region === "global" || parent.industry === "auto" || parent.industry === "sport";
    }
    if (blueprint.key === "regional_fan") {
      return parent.region === "dach";
    }
    return true;
  });
  return core.length >= 3 ? core : CORE_BLUEPRINTS.slice(0, 3);
}

function buildVariant(parent: SponsorBrandParent, blueprint: VariantBlueprint): SponsorBrandTemplate {
  const industryBoost =
    parent.industry === "finance" && blueprint.archetype === "security"
      ? { baseCash: 2, rankCash: 0, improvementCash: 0, specialCash: 0 }
      : parent.industry === "sport" && blueprint.archetype === "performance"
        ? { baseCash: 0, rankCash: 2, improvementCash: 1, specialCash: 0 }
        : parent.industry === "logistics" && blueprint.archetype === "identity"
          ? { baseCash: 0, rankCash: 0, improvementCash: 0, specialCash: 2 }
          : { baseCash: 0, rankCash: 0, improvementCash: 0, specialCash: 0 };

  return {
    id: `${parent.id}:${blueprint.key}`,
    parentBrandId: parent.id,
    variantKey: blueprint.key,
    flavorSuffix: blueprint.flavorSuffix,
    name: parent.name,
    flavor: `${blueprint.flavorSuffix} ${parent.flavorBase}`,
    archetype: blueprint.archetype,
    tierRange: blueprint.tierRange,
    specialTemplates: industrySpecialTemplates(parent.industry),
    baseCash: blueprint.baseCash + industryBoost.baseCash,
    rankCash: blueprint.rankCash + industryBoost.rankCash,
    improvementCash: blueprint.improvementCash + industryBoost.improvementCash,
    specialCash: blueprint.specialCash + industryBoost.specialCash,
  };
}

export function buildBrandVariantsForParent(parent: SponsorBrandParent): SponsorBrandTemplate[] {
  return blueprintsForParent(parent).map((blueprint) => buildVariant(parent, blueprint));
}

export function buildAllSponsorBrandVariants(parents: SponsorBrandParent[] = SPONSOR_BRAND_PARENTS): SponsorBrandTemplate[] {
  return parents.flatMap((parent) => buildBrandVariantsForParent(parent));
}

export const SPONSOR_BRAND_VARIANTS = buildAllSponsorBrandVariants();

export function getSponsorBrandVariantById(variantId: string): SponsorBrandTemplate | null {
  return SPONSOR_BRAND_VARIANTS.find((entry) => entry.id === variantId) ?? null;
}

export function listVariantsForParent(parentId: string): SponsorBrandTemplate[] {
  return SPONSOR_BRAND_VARIANTS.filter((entry) => entry.parentBrandId === parentId);
}

export function listSponsorBrandTemplates() {
  return SPONSOR_BRAND_VARIANTS;
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Der Legacy-Sternbereich einer Variante (`tierRange`, 1..5) in den Rarity-Ordnungsbereich (0..3) übersetzt.
 * Deckungsgleich mit dem alten Sternvergleich: mapStarTierToRarity faltet ★→Rarity, deren order bildet die
 * neue "Tier"-Achse. So filtert die Auswahl nach `SPONSOR_RARITIES[rarity].order` statt nach dem Sternrang,
 * ohne den bestehenden Kanon (Sternbereiche der Blueprints) zu verändern.
 */
function tierRangeToRarityOrder(tierRange: [number, number]): [number, number] {
  return [
    SPONSOR_RARITIES[mapStarTierToRarity(tierRange[0])].order,
    SPONSOR_RARITIES[mapStarTierToRarity(tierRange[1])].order,
  ];
}

export function pickVariantForParent(input: {
  parentId: string;
  /** Kurvenform statt Archetyp — die Familie bestimmt via mapCurveShapeToArchetype den Varianten-Archetyp. */
  curveShape: SponsorCurveShape;
  /** Rarität statt Sternrang — SPONSOR_RARITIES[rarity].order ist die neue Tier-Achse für das Range-Filter. */
  rarity: SponsorRarity;
  seasonId: string;
  teamId: string;
  slotIndex: number;
}): SponsorBrandTemplate | null {
  const variants = listVariantsForParent(input.parentId);
  const archetype = mapCurveShapeToArchetype(input.curveShape);
  const rarityOrder = SPONSOR_RARITIES[input.rarity].order;
  const matchesArchetypeAndTier = (variant: SponsorBrandTemplate) => {
    const [loOrder, hiOrder] = tierRangeToRarityOrder(variant.tierRange);
    return variant.archetype === archetype && rarityOrder >= loOrder && rarityOrder <= hiOrder;
  };

  let candidates = variants.filter((variant) => matchesArchetypeAndTier(variant));
  if (candidates.length === 0) {
    candidates = variants.filter((variant) => variant.archetype === archetype);
  }
  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(
    getStableUnitHash(`${input.seasonId}:${input.teamId}:${input.parentId}:${archetype}:${input.slotIndex}:variant`) *
      candidates.length,
  );
  return candidates[index] ?? candidates[0]!;
}

export function parentSupportsArchetype(parentId: string, archetype: SponsorArchetype) {
  return listVariantsForParent(parentId).some((variant) => variant.archetype === archetype);
}
