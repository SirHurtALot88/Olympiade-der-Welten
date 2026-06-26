import type { GameState, SponsorArchetype, SponsorStarTier, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

import {
  SPONSOR_BRAND_PARENTS,
  preferredIndustriesForTeam,
  resolveSponsorBrandDisplay,
  scoreParentTeamAffinity,
  type SponsorBrandParent,
} from "@/lib/sponsor/sponsor-brand-parents";
import {
  listVariantsForParent,
  parentSupportsArchetype,
  pickVariantForParent,
  type SponsorBrandTemplate,
  type SponsorSpecialTemplateId,
} from "@/lib/sponsor/sponsor-brand-variants";
import {
  buildChallengeSpecialComponent,
  buildStandardSpecialComponent,
} from "@/lib/sponsor/sponsor-special-objectives";

export type { SponsorBrandTemplate, SponsorSpecialTemplateId, SponsorVariantKey } from "@/lib/sponsor/sponsor-brand-variants";
export {
  listSponsorBrandTemplates,
  getSponsorBrandVariantById,
  listVariantsForParent,
  pickVariantForParent,
  parentSupportsArchetype,
} from "@/lib/sponsor/sponsor-brand-variants";
export {
  listSponsorBrandParents,
  getSponsorBrandParentById,
  resolveSponsorBrandDisplay,
  preferredIndustriesForTeam,
  SPONSOR_BRAND_PARENTS,
} from "@/lib/sponsor/sponsor-brand-parents";

const GLOBAL_PARENT_SOFT_CAP = 4;

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function isParentAvailable(input: {
  parent: SponsorBrandParent;
  usedParentBrandIds: Set<string>;
  globalParentUsage: Record<string, number>;
}) {
  if (input.usedParentBrandIds.has(input.parent.id)) {
    return false;
  }
  if ((input.globalParentUsage[input.parent.id] ?? 0) >= GLOBAL_PARENT_SOFT_CAP) {
    return false;
  }
  return true;
}

function pickParentForSlot(input: {
  seasonId: string;
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  slotIndex: number;
  archetype: SponsorArchetype;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
}): SponsorBrandParent {
  const usedParentBrandIds = new Set(input.usedParentBrandIds ?? []);
  const recentParentBrandIds = new Set(input.recentParentBrandIds ?? []);
  const globalParentUsage = input.globalParentUsage ?? {};
  const preferredIndustries = preferredIndustriesForTeam({
    teamShortCode: input.team.shortCode,
    ambition: input.identity?.ambition ?? input.profile?.bias.starPriority ?? 5,
    sellForProfitAggression: input.profile?.bias.sellForProfitAggression ?? 0,
    finances: input.identity?.finances ?? input.profile?.bias.cashPriority ?? 5,
  });

  const supportsSlot = (parent: SponsorBrandParent) => parentSupportsArchetype(parent.id, input.archetype);

  let candidates = SPONSOR_BRAND_PARENTS.filter(
    (parent) => supportsSlot(parent) && isParentAvailable({ parent, usedParentBrandIds, globalParentUsage }),
  );

  const preferFresh = (pool: SponsorBrandParent[]) => pool.filter((parent) => !recentParentBrandIds.has(parent.id));

  const freshCandidates = preferFresh(candidates);
  if (freshCandidates.length > 0) {
    candidates = freshCandidates;
  }

  if (candidates.length === 0) {
    candidates = SPONSOR_BRAND_PARENTS.filter(
      (parent) => supportsSlot(parent) && !usedParentBrandIds.has(parent.id),
    );
    const freshFallback = preferFresh(candidates);
    if (freshFallback.length > 0) {
      candidates = freshFallback;
    }
  }

  if (candidates.length === 0) {
    candidates = SPONSOR_BRAND_PARENTS.filter((parent) => supportsSlot(parent));
  }

  const maxAffinity = Math.max(...candidates.map((parent) => scoreParentTeamAffinity(parent, preferredIndustries)), 0);
  const affinityPool =
    maxAffinity > 0
      ? candidates.filter((parent) => scoreParentTeamAffinity(parent, preferredIndustries) === maxAffinity)
      : candidates;

  const index = Math.floor(
    getStableUnitHash(`${input.seasonId}:${input.teamId}:${input.archetype}:${input.slotIndex}:parent`) * affinityPool.length,
  );
  return affinityPool[index] ?? affinityPool[0] ?? SPONSOR_BRAND_PARENTS[0]!;
}

function pickBrandForSlot(input: {
  seasonId: string;
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  slotIndex: number;
  archetype: SponsorArchetype;
  starTier: SponsorStarTier;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
}): { parent: SponsorBrandParent; brand: SponsorBrandTemplate } {
  const parent = pickParentForSlot(input);
  let brand =
    pickVariantForParent({
      parentId: parent.id,
      archetype: input.archetype,
      starTier: input.starTier,
      seasonId: input.seasonId,
      teamId: input.teamId,
      slotIndex: input.slotIndex,
    }) ??
    pickVariantForParent({
      parentId: parent.id,
      archetype: input.archetype,
      starTier: 3,
      seasonId: input.seasonId,
      teamId: input.teamId,
      slotIndex: input.slotIndex,
    });

  if (input.forcePremiumElite) {
    const premium = listVariantsForParent(parent.id).find(
      (variant) => variant.variantKey === "premium_elite" && variant.archetype === input.archetype,
    );
    if (premium) {
      brand = premium;
    }
  }

  if (!brand) {
    throw new Error(`missing_sponsor_variant:${parent.id}:${input.archetype}`);
  }

  return { parent, brand };
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
}) {
  return buildStandardSpecialComponent(input);
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
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
  specialMode?: "standard" | "challenge";
  gameState?: GameState;
  specialRewardCash?: number;
}) {
  const { parent, brand } = pickBrandForSlot(input);
  const display = resolveSponsorBrandDisplay(parent, brand);
  const rewardCash = input.specialRewardCash ?? brand.specialCash;
  const special =
    input.specialMode === "challenge" && input.gameState
      ? buildChallengeSpecialComponent({
          gameState: input.gameState,
          team: input.team,
          identity: input.identity,
          profile: input.profile,
          starTier: input.starTier,
          rewardCash,
          seasonId: input.seasonId,
        })
      : buildSpecialComponent({
          templateId: pickSpecialTemplate({
            brand,
            team: input.team,
            identity: input.identity,
            profile: input.profile,
            starTier: input.starTier,
            slotIndex: input.slotIndex,
            seasonId: input.seasonId,
          }),
          starTier: input.starTier,
          rewardCash,
        });
  return {
    parent,
    brand: {
      ...brand,
      name: display.name,
      flavor:
        input.specialMode === "challenge"
          ? `Challenge-Sponsor · ${display.flavor}`
          : display.flavor,
    },
    special,
  };
}

export function buildGlobalParentUsageFromOffers(
  offersByTeamId: Record<string, Array<{ sponsorParentBrandId?: string | null }>> | undefined,
): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const offers of Object.values(offersByTeamId ?? {})) {
    for (const offer of offers) {
      const parentId = offer.sponsorParentBrandId;
      if (!parentId) {
        continue;
      }
      usage[parentId] = (usage[parentId] ?? 0) + 1;
    }
  }
  return usage;
}
