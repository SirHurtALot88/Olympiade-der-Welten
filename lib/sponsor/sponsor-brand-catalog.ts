import type { SponsorArchetype, SponsorOfferComponent, SponsorStarTier, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

export type SponsorSpecialTemplateId =
  | "transfer_profit_min"
  | "discipline_top3_count"
  | "form_color_cover";

export type SponsorBrandTemplate = {
  id: string;
  name: string;
  flavor: string;
  archetype: SponsorArchetype;
  tierRange: [SponsorStarTier, SponsorStarTier];
  specialTemplates: SponsorSpecialTemplateId[];
  baseCash: number;
  rankCash: number;
  improvementCash: number;
  specialCash: number;
};

const BRANDS: SponsorBrandTemplate[] = [
  {
    id: "security-solid",
    name: "Sicherheitspartner AG",
    flavor: "Fixe Zahlung, wenig Risiko — solide Saisonfinanzierung.",
    archetype: "security",
    tierRange: [1, 3],
    specialTemplates: ["form_color_cover"],
    baseCash: 10,
    rankCash: 3,
    improvementCash: 2,
    specialCash: 3,
  },
  {
    id: "security-premium",
    name: "Stabilitaetsbank Olympia",
    flavor: "Premium-Sicherheitspartner mit moderaten Leistungszusatz.",
    archetype: "security",
    tierRange: [3, 5],
    specialTemplates: ["form_color_cover", "transfer_profit_min"],
    baseCash: 12,
    rankCash: 4,
    improvementCash: 2,
    specialCash: 4,
  },
  {
    id: "performance-fund",
    name: "Leistungsfonds Olympia",
    flavor: "Wenig Basis, hohe Boni bei Platzierung und Fortschritt.",
    archetype: "performance",
    tierRange: [2, 5],
    specialTemplates: ["discipline_top3_count"],
    baseCash: 4,
    rankCash: 8,
    improvementCash: 5,
    specialCash: 5,
  },
  {
    id: "performance-elite",
    name: "Elite Performance Capital",
    flavor: "Top-Sponsor fuer ambitionierte Rang- und Entwicklungsziele.",
    archetype: "performance",
    tierRange: [4, 5],
    specialTemplates: ["discipline_top3_count", "transfer_profit_min"],
    baseCash: 5,
    rankCash: 10,
    improvementCash: 6,
    specialCash: 6,
  },
  {
    id: "identity-culture",
    name: "Identitaets-Sponsor",
    flavor: "Passend zum Teamprofil — Sonderziel bringt Extra-Cash.",
    archetype: "identity",
    tierRange: [2, 4],
    specialTemplates: ["form_color_cover", "discipline_top3_count"],
    baseCash: 6,
    rankCash: 5,
    improvementCash: 3,
    specialCash: 6,
  },
  {
    id: "identity-trade",
    name: "Handelskammer Sponsoring",
    flavor: "Wirtschaftlicher Partner mit Fokus auf Transferprofit.",
    archetype: "identity",
    tierRange: [2, 5],
    specialTemplates: ["transfer_profit_min", "form_color_cover"],
    baseCash: 5,
    rankCash: 4,
    improvementCash: 4,
    specialCash: 7,
  },
  {
    id: "identity-rivalry",
    name: "Rivalen Challenge Partner",
    flavor: "Sponsor mit klarer Leistungsstory und Disziplin-Fokus.",
    archetype: "identity",
    tierRange: [3, 5],
    specialTemplates: ["discipline_top3_count"],
    baseCash: 6,
    rankCash: 6,
    improvementCash: 4,
    specialCash: 7,
  },
  {
    id: "security-northwind",
    name: "Northwind Assurance",
    flavor: "Inspired by classic insurer partners — steady cash, low drama.",
    archetype: "security",
    tierRange: [2, 4],
    specialTemplates: ["form_color_cover"],
    baseCash: 11,
    rankCash: 3,
    improvementCash: 2,
    specialCash: 3,
  },
  {
    id: "security-vaultline",
    name: "Vaultline Holdings",
    flavor: "Conservative treasury partner for rebuild seasons.",
    archetype: "security",
    tierRange: [1, 3],
    specialTemplates: ["form_color_cover", "transfer_profit_min"],
    baseCash: 9,
    rankCash: 2,
    improvementCash: 2,
    specialCash: 2,
  },
  {
    id: "performance-velocity",
    name: "Velocity Sports Capital",
    flavor: "Inspired by energy-drink performance deals — rank upside heavy.",
    archetype: "performance",
    tierRange: [3, 5],
    specialTemplates: ["discipline_top3_count"],
    baseCash: 3,
    rankCash: 9,
    improvementCash: 6,
    specialCash: 5,
  },
  {
    id: "performance-apex",
    name: "Apex Results Group",
    flavor: "Bonus-driven partner for podium-chasing teams.",
    archetype: "performance",
    tierRange: [2, 4],
    specialTemplates: ["discipline_top3_count", "transfer_profit_min"],
    baseCash: 5,
    rankCash: 7,
    improvementCash: 4,
    specialCash: 4,
  },
  {
    id: "performance-momentum",
    name: "Momentum Athletics",
    flavor: "Mid-tier performance brand with improvement sweet spot.",
    archetype: "performance",
    tierRange: [2, 3],
    specialTemplates: ["discipline_top3_count"],
    baseCash: 4,
    rankCash: 6,
    improvementCash: 5,
    specialCash: 4,
  },
  {
    id: "identity-heritage",
    name: "Heritage Guild Sponsoring",
    flavor: "Culture-first partner rewarding identity and form coverage.",
    archetype: "identity",
    tierRange: [2, 4],
    specialTemplates: ["form_color_cover"],
    baseCash: 7,
    rankCash: 4,
    improvementCash: 3,
    specialCash: 5,
  },
  {
    id: "identity-academy",
    name: "Academy Alliance",
    flavor: "Development-minded sponsor — inspired by youth-education brands.",
    archetype: "identity",
    tierRange: [1, 3],
    specialTemplates: ["form_color_cover", "discipline_top3_count"],
    baseCash: 6,
    rankCash: 3,
    improvementCash: 4,
    specialCash: 4,
  },
  {
    id: "identity-urban",
    name: "Urban Pulse Media",
    flavor: "Street-culture partner with flexible special targets.",
    archetype: "identity",
    tierRange: [3, 5],
    specialTemplates: ["form_color_cover", "transfer_profit_min"],
    baseCash: 5,
    rankCash: 5,
    improvementCash: 4,
    specialCash: 6,
  },
  {
    id: "security-crown",
    name: "Crown Reserve Bank",
    flavor: "Elite security tier for championship-caliber commercial ratings.",
    archetype: "security",
    tierRange: [4, 5],
    specialTemplates: ["form_color_cover", "transfer_profit_min"],
    baseCash: 14,
    rankCash: 5,
    improvementCash: 3,
    specialCash: 5,
  },
  {
    id: "performance-titan",
    name: "Titan Performance Labs",
    flavor: "Top-end performance package with demanding rank clauses.",
    archetype: "performance",
    tierRange: [4, 5],
    specialTemplates: ["discipline_top3_count", "transfer_profit_min"],
    baseCash: 4,
    rankCash: 11,
    improvementCash: 7,
    specialCash: 7,
  },
  {
    id: "identity-legacy",
    name: "Legacy House Partners",
    flavor: "Prestige identity sponsor for long-horizon club building.",
    archetype: "identity",
    tierRange: [4, 5],
    specialTemplates: ["discipline_top3_count", "form_color_cover"],
    baseCash: 7,
    rankCash: 6,
    improvementCash: 5,
    specialCash: 8,
  },
];

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function pickBrandForSlot(input: {
  seasonId: string;
  teamId: string;
  slotIndex: number;
  archetype: SponsorArchetype;
  starTier: SponsorStarTier;
  usedBrandIds?: string[];
}) {
  const usedBrandIds = new Set(input.usedBrandIds ?? []);
  const candidates = BRANDS.filter(
    (brand) =>
      brand.archetype === input.archetype &&
      input.starTier >= brand.tierRange[0] &&
      input.starTier <= brand.tierRange[1] &&
      !usedBrandIds.has(brand.id),
  );
  const pool =
    candidates.length > 0
      ? candidates
      : BRANDS.filter((brand) => brand.archetype === input.archetype && !usedBrandIds.has(brand.id));
  const fallbackPool = pool.length > 0 ? pool : BRANDS.filter((brand) => brand.archetype === input.archetype);
  const index = Math.floor(
    getStableUnitHash(`${input.seasonId}:${input.teamId}:${input.archetype}:${input.slotIndex}:brand`) * fallbackPool.length,
  );
  return fallbackPool[index] ?? fallbackPool[0]!;
}

function pickSpecialTemplate(input: {
  brand: SponsorBrandTemplate;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  starTier: SponsorStarTier;
  slotIndex: number;
  seasonId: string;
}) {
  const preferred: SponsorSpecialTemplateId[] = [];
  if ((input.profile?.bias?.sellForProfitAggression ?? 0) >= 8) {
    preferred.push("transfer_profit_min");
  }
  if ((input.identity?.ambition ?? 0) >= 9 || (input.profile?.bias?.starPriority ?? 0) >= 9) {
    preferred.push("discipline_top3_count");
  }
  preferred.push("form_color_cover");

  for (const templateId of preferred) {
    if (input.brand.specialTemplates.includes(templateId)) {
      return templateId;
    }
  }
  const fallbackIndex = Math.floor(
    getStableUnitHash(`${input.seasonId}:${input.team.teamId}:${input.slotIndex}:special`) * input.brand.specialTemplates.length,
  );
  return input.brand.specialTemplates[fallbackIndex] ?? "form_color_cover";
}

function buildSpecialComponent(input: {
  templateId: SponsorSpecialTemplateId;
  starTier: SponsorStarTier;
  rewardCash: number;
}): SponsorOfferComponent {
  const demandBoost = input.starTier >= 4 ? 1 : input.starTier >= 3 ? 0 : -1;
  if (input.templateId === "transfer_profit_min") {
    const target = Math.max(3, 5 + demandBoost + (input.starTier >= 5 ? 2 : 0));
    return {
      componentId: "special-transfer-profit",
      kind: "special",
      label: `Transfergewinn ≥ ${target}`,
      targetValue: target,
      rewardCash: input.rewardCash,
      penaltyCash: Math.max(1, Math.round(input.rewardCash / 3)),
      specialKey: "transfer_profit_min",
    };
  }
  if (input.templateId === "discipline_top3_count") {
    const target = Math.max(1, 2 + demandBoost + (input.starTier >= 5 ? 1 : 0));
    return {
      componentId: "special-discipline-top3",
      kind: "special",
      label: `≥ ${target} Disziplin-Top-3`,
      targetValue: target,
      rewardCash: input.rewardCash,
      penaltyCash: Math.max(1, Math.round(input.rewardCash / 4)),
      specialKey: "discipline_top3_count",
    };
  }
  const colors = input.starTier >= 4 ? 5 : 4;
  return {
    componentId: "special-roster-form",
    kind: "special",
    label: `Kader-Form ${colors} Farben`,
    targetValue: `${colors} Farben`,
    rewardCash: input.rewardCash,
    specialKey: "form_color_cover",
  };
}

export function pickSponsorBrandForOffer(input: {
  seasonId: string;
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  archetype: SponsorArchetype;
  starTier: SponsorStarTier;
  slotIndex: number;
  usedBrandIds?: string[];
}) {
  const brand = pickBrandForSlot(input);
  const specialTemplate = pickSpecialTemplate({
    brand,
    team: input.team,
    identity: input.identity,
    profile: input.profile,
    starTier: input.starTier,
    slotIndex: input.slotIndex,
    seasonId: input.seasonId,
  });
  return {
    brand,
    special: buildSpecialComponent({
      templateId: specialTemplate,
      starTier: input.starTier,
      rewardCash: brand.specialCash,
    }),
  };
}

export function listSponsorBrandTemplates() {
  return BRANDS;
}
