import type { SponsorArchetype, SponsorRarity, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

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
} from "@/lib/sponsor/sponsor-brand-variants";

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

/**
 * Wie viele Teams dieselbe Dachmarke gleichzeitig im Angebots-Slate haben duerfen.
 *
 * Frueher 4 — daher tauchte z. B. "Webasto Comfort" bei vier Teams gleichzeitig auf und mehrere
 * Teams hatten am Ende denselben Sponsor unter Vertrag. Bei 100 Marken war das auch noetig:
 * 32 Teams x 5 Angebote = 160 Angebote passen nicht in 100 Marken.
 *
 * Mit 200 Marken (siehe sponsor-brand-parents.ts) geht 160 auf, also steht der Wert auf 1: jede
 * Marke erscheint ligaweit hoechstens EINMAL. Damit ist ausgeschlossen, dass zwei Teams denselben
 * Sponsor bekommen — schon auf Angebotsebene, nicht erst beim Abschluss.
 */
const GLOBAL_PARENT_MAX_TEAMS = 1;

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
  if ((input.globalParentUsage[input.parent.id] ?? 0) >= GLOBAL_PARENT_MAX_TEAMS) {
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
  const archetype = input.archetype;
  const usedParentBrandIds = new Set(input.usedParentBrandIds ?? []);
  const recentParentBrandIds = new Set(input.recentParentBrandIds ?? []);
  const globalParentUsage = input.globalParentUsage ?? {};
  const preferredIndustries = preferredIndustriesForTeam({
    teamShortCode: input.team.shortCode,
    ambition: input.identity?.ambition ?? input.profile?.bias.starPriority ?? 5,
    sellForProfitAggression: input.profile?.bias.sellForProfitAggression ?? 0,
    finances: input.identity?.finances ?? input.profile?.bias.cashPriority ?? 5,
  });

  const supportsSlot = (parent: SponsorBrandParent) => parentSupportsArchetype(parent.id, archetype);

  let candidates = SPONSOR_BRAND_PARENTS.filter(
    (parent) => supportsSlot(parent) && isParentAvailable({ parent, usedParentBrandIds, globalParentUsage }),
  );

  const preferFresh = (pool: SponsorBrandParent[]) => pool.filter((parent) => !recentParentBrandIds.has(parent.id));

  const freshCandidates = preferFresh(candidates);
  if (freshCandidates.length > 0) {
    candidates = freshCandidates;
  }

  // Notfall-Stufen, falls der Pool fuer diesen Archetyp leerlaeuft. Reihenfolge ist bewusst: zuerst
  // die WEICHEN Praeferenzen fallen lassen, die ligaweite Eindeutigkeit als Letztes — sonst haetten
  // wieder zwei Teams dieselbe Marke, und genau das soll ausgeschlossen bleiben.
  if (candidates.length === 0) {
    // Stufe 1: "zuletzt gehabte Marken meiden" aufgeben, Eindeutigkeit bleibt.
    candidates = SPONSOR_BRAND_PARENTS.filter(
      (parent) => supportsSlot(parent) && isParentAvailable({ parent, usedParentBrandIds, globalParentUsage }),
    );
  }

  if (candidates.length === 0) {
    // Stufe 2: ligaweite Eindeutigkeit aufgeben (nur noch teamintern eindeutig). Mit 200 Marken bei
    // 160 Angeboten wird diese Stufe nicht erreicht; sie existiert, damit ein kuenftig kleinerer
    // Pool oder ein zusaetzlicher Archetyp-Filter nicht in "kein Kandidat" laeuft.
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
    getStableUnitHash(`${input.seasonId}:${input.teamId}:${archetype}:${input.slotIndex}:parent`) * affinityPool.length,
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
  rarity: SponsorRarity;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
}): { parent: SponsorBrandParent; brand: SponsorBrandTemplate } {
  const archetype = input.archetype;
  const parent = pickParentForSlot(input);
  let brand =
    pickVariantForParent({
      parentId: parent.id,
      archetype: input.archetype,
      rarity: input.rarity,
      seasonId: input.seasonId,
      teamId: input.teamId,
      slotIndex: input.slotIndex,
    }) ??
    pickVariantForParent({
      parentId: parent.id,
      archetype: input.archetype,
      // Fallback-Rarität "magisch" entspricht dem alten starTier-3-Fallback (mittleres Tier).
      rarity: "magisch",
      seasonId: input.seasonId,
      teamId: input.teamId,
      slotIndex: input.slotIndex,
    });

  if (input.forcePremiumElite) {
    const premium = listVariantsForParent(parent.id).find(
      (variant) => variant.variantKey === "premium_elite" && variant.archetype === archetype,
    );
    if (premium) {
      brand = premium;
    }
  }

  if (!brand) {
    throw new Error(`missing_sponsor_variant:${parent.id}:${archetype}`);
  }

  return { parent, brand };
}

/**
 * WELCHE MARKE + WELCHER FLAVOURTEXT — das Sonderziel selbst baut diese Funktion nicht mehr.
 *
 * Frueher entschied hier zusaetzlich `pickSpecialTemplate`/`buildSpecialComponent`
 * (bzw. `buildChallengeSpecialComponent` im Challenge-Fall) ueber die Sonderziel-Komponente der
 * Karte. Das Ergebnis wurde in JEDEM Fall verworfen: `buildOfferSkeleton`
 * (sponsor-offer-service.ts) ersetzt die Sonderziel-Komponente einer Achsenkarte immer durch die
 * Achse selbst, und nur Achsenkarten tragen ueberhaupt ein Sonderziel (siehe
 * sponsor-special-objectives.ts, Datei-Kopf). Der `specialMode === "challenge"`-Zweig bleibt
 * trotzdem stehen — er entscheidet weiterhin den "Challenge-Sponsor · "-Flavourtext-Praefix und
 * `offer.isChallengeOffer`, beides sichtbare Angebotsfelder, unabhaengig vom (nicht mehr gebauten)
 * Sonderziel.
 */
export function pickSponsorBrandForOffer(input: {
  seasonId: string;
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  archetype: SponsorArchetype;
  rarity: SponsorRarity;
  slotIndex: number;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
  specialMode?: "standard" | "challenge";
}) {
  const { parent, brand } = pickBrandForSlot(input);
  const display = resolveSponsorBrandDisplay(parent, brand);
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
