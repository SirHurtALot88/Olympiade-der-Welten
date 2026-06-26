import { randomUUID } from "@/lib/utils/random-id";

import type {
  GameState,
  SponsorArchetype,
  SponsorNegotiationProfile,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorStarTier,
  SponsorTermSeasons,
  Team,
  TeamIdentity,
  TeamSponsorContract,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import { pickSponsorBrandForOffer, buildGlobalParentUsageFromOffers } from "@/lib/sponsor/sponsor-brand-catalog";
import { appendSponsorBrandHistory, getRecentSponsorParentIds } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";
import {
  applySponsorNegotiationToContract,
  defaultAiSponsorNegotiation,
} from "@/lib/sponsor/sponsor-negotiation";
import {
  estimateExpectedPayout,
  getEconomyMultiplier,
  getPrizeMoneyReference,
  scaleSponsorComponentValue,
  sumWeightedBlueprintComponentValue,
} from "@/lib/sponsor/sponsor-economy-calibration";
import {
  getDemandMultiplier,
  getDemandProfile,
  getRewardMultiplier,
  rollSponsorStarTiers,
} from "@/lib/sponsor/sponsor-tier-pool";

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

function getCurrentSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function getSportTargetRank(
  team: Team,
  identity: TeamIdentity | null,
  profile: TeamStrategyProfile | null,
  currentRank: number | null,
  starTier: SponsorStarTier,
) {
  const ambition = identity?.ambition ?? profile?.bias.starPriority ?? 5;
  const code = team.shortCode;
  let base = 14;
  if (code === "M-M") {
    base = currentRank != null && currentRank > 6 ? 6 : 3;
  } else if (code === "C-C") {
    base = 16;
  } else if (currentRank == null) {
    base = ambition >= 8 ? 12 : 18;
  } else if (currentRank >= 25) base = 22;
  else if (currentRank >= 17) base = 16;
  else if (currentRank >= 13) base = 12;
  else if (ambition >= 8) base = 10;

  const demandMult = getDemandMultiplier(starTier);
  return Math.max(3, Math.round(base / demandMult));
}

function buildOffer(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  archetype: SponsorArchetype;
  rankTarget: number;
  startRank: number | null;
  starTier: SponsorStarTier;
  commercialRating: number;
  slotIndex: number;
  salaryFactor: number;
  referenceRank: number;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
}): SponsorOffer {
  const { team, identity, profile, archetype, rankTarget, startRank, gameState, starTier, commercialRating, slotIndex, salaryFactor, referenceRank } = input;
  const demandMult = getDemandMultiplier(starTier);
  const rewardMult = getRewardMultiplier(starTier);
  const improvementBase = startRank != null ? Math.min(4, Math.max(2, Math.round((startRank - rankTarget) / 2) || 2)) : 2;
  const improvementTarget = improvementBase + (starTier >= 4 ? 1 : 0) + (starTier >= 5 ? 1 : 0);
  const { brand, parent, special } = pickSponsorBrandForOffer({
    seasonId: gameState.season.id,
    teamId: team.teamId,
    team,
    identity,
    profile,
    archetype,
    starTier,
    slotIndex,
    usedParentBrandIds: input.usedParentBrandIds,
    recentParentBrandIds: input.recentParentBrandIds,
    globalParentUsage: input.globalParentUsage,
  });
  const economyMult = getEconomyMultiplier({
    rank: referenceRank,
    salaryFactor,
    starTier,
    blueprintComponentSum: sumWeightedBlueprintComponentValue(brand),
    rewardMult,
  });

  const scale = (kind: SponsorOfferComponent["kind"], value: number) =>
    scaleSponsorComponentValue(kind, value, rewardMult, economyMult);
  const components: SponsorOfferComponent[] = [
    {
      componentId: "base-cash",
      kind: "base",
      label: "Basis-Saisonzahlung",
      targetValue: scale("base", brand.baseCash),
      rewardCash: scale("base", brand.baseCash),
    },
    {
      componentId: "rank-target",
      kind: "rank",
      label: `Platzierung Top ${rankTarget}`,
      targetValue: rankTarget,
      rewardCash: scale("rank", brand.rankCash),
      penaltyCash: Math.max(1, roundCash(scale("rank", brand.rankCash) / 3 * demandMult)),
    },
    {
      componentId: "improvement-target",
      kind: "improvement",
      label: `≥ ${improvementTarget} Plätze verbessern`,
      targetValue: improvementTarget,
      rewardCash: scale("improvement", brand.improvementCash),
    },
    {
      ...special,
      rewardCash: scale("special", special.rewardCash),
      penaltyCash: special.penaltyCash != null ? roundCash(scale("special", special.penaltyCash) / demandMult) : undefined,
    },
  ];

  return {
    offerId: `${gameState.season.id}:${team.teamId}:${archetype}:${starTier}:${slotIndex}`,
    seasonId: gameState.season.id,
    teamId: team.teamId,
    archetype,
    name: parent.name,
    flavor: brand.flavor,
    components,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
    starTier,
    commercialRating,
    sponsorBrandId: brand.id,
    sponsorParentBrandId: brand.parentBrandId,
    variantKey: brand.variantKey,
    demandProfile: getDemandProfile(starTier),
  };
}

export function buildSponsorOffersForTeam(input: {
  gameState: GameState;
  teamId: string;
}): SponsorOffer[] {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  if (!team) {
    return [];
  }
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.teamId) ?? null;
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const profile = getTeamStrategyProfile(input.gameState, input.teamId);
  const startRank = row?.startplatz ?? row?.rank ?? null;
  const commercialRating = buildSponsorCommercialRating({ gameState: input.gameState, teamId: input.teamId });
  const standingRank = row?.startplatz ?? row?.rank ?? null;
  const starTiers = rollSponsorStarTiers({
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    commercialRating: commercialRating.score,
    standingRank,
  });
  const archetypes: SponsorArchetype[] = ["security", "performance", "identity"];
  const usedParentBrandIds: string[] = [];
  const recentParentBrandIds = getRecentSponsorParentIds(input.gameState, input.teamId);
  const globalParentUsage = buildGlobalParentUsageFromOffers(input.gameState.seasonState.sponsorOffersByTeamId);
  const salaryFactor = getCurrentSalaryFactor(input.gameState);
  const referenceRank = row?.rank ?? row?.startplatz ?? 16;

  return archetypes.map((archetype, slotIndex) => {
    const starTier = starTiers[slotIndex] ?? 2;
    const rankTarget = getSportTargetRank(team, identity, profile, row?.rank ?? null, starTier);
    const offer = buildOffer({
      gameState: input.gameState,
      team,
      identity,
      profile,
      archetype,
      rankTarget,
      startRank,
      starTier,
      commercialRating: commercialRating.score,
      slotIndex,
      salaryFactor,
      referenceRank,
      usedParentBrandIds,
      recentParentBrandIds,
      globalParentUsage,
    });
    if (offer.sponsorParentBrandId) {
      usedParentBrandIds.push(offer.sponsorParentBrandId);
    }
    return offer;
  });
}

function scaleOfferComponents(offer: SponsorOffer, scale: number): SponsorOffer {
  if (scale === 1) {
    return offer;
  }
  const components = offer.components.map((component) => ({
    ...component,
    targetValue:
      typeof component.targetValue === "number" ? roundCash(component.targetValue * scale) : component.targetValue,
    rewardCash: roundCash(component.rewardCash * scale),
    penaltyCash: component.penaltyCash != null ? roundCash(component.penaltyCash * scale) : undefined,
  }));
  return {
    ...offer,
    components,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
  };
}

function normalizeLeagueSponsorOffers(gameState: GameState, offersByTeamId: Record<string, SponsorOffer[]>) {
  const salaryFactor = getCurrentSalaryFactor(gameState);
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const prizeTotal = gameState.teams.reduce((sum, team) => {
    const row = rows.find((entry) => entry.teamId === team.teamId) ?? null;
    const rank = row?.rank ?? row?.startplatz ?? 16;
    return sum + getPrizeMoneyReference(rank, salaryFactor);
  }, 0);
  const expectedTotal = gameState.teams.reduce((sum, team) => {
    const row = rows.find((entry) => entry.teamId === team.teamId) ?? null;
    const rank = row?.rank ?? row?.startplatz ?? 16;
    const offers = offersByTeamId[team.teamId] ?? [];
    const best = offers.reduce(
      (max, offer) => Math.max(max, estimateExpectedPayout(offer, rank)),
      0,
    );
    return sum + best;
  }, 0);

  if (prizeTotal <= 0 || expectedTotal <= 0) {
    return offersByTeamId;
  }

  const ratio = expectedTotal / prizeTotal;
  if (ratio >= 0.92 && ratio <= 1.08) {
    return offersByTeamId;
  }

  const scale = prizeTotal / expectedTotal;
  const nextOffers: Record<string, SponsorOffer[]> = {};
  for (const team of gameState.teams) {
    nextOffers[team.teamId] = (offersByTeamId[team.teamId] ?? []).map((offer) => scaleOfferComponents(offer, scale));
  }
  return nextOffers;
}

export function regenerateSponsorOffersForSeason(gameState: GameState, teamIds?: string[]): GameState {
  const seasonId = gameState.season.id;
  const targetTeamIds = teamIds ?? gameState.teams.map((team) => team.teamId);
  const nextOffers = { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}) };

  for (const teamId of targetTeamIds) {
    if (getTeamSponsorContract(gameState, teamId)) {
      continue;
    }
    nextOffers[teamId] = buildSponsorOffersForTeam({ gameState, teamId });
  }

  const normalizedOffers = normalizeLeagueSponsorOffers(gameState, nextOffers);

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: normalizedOffers,
    },
  };
}

export function ensureSeasonSponsorOffers(gameState: GameState): GameState {
  const seasonId = gameState.season.id;
  const existingOffers = gameState.seasonState.sponsorOffersByTeamId ?? {};
  const nextOffers: Record<string, SponsorOffer[]> = {};
  let changed = false;

  for (const team of gameState.teams) {
    if (getTeamSponsorContract(gameState, team.teamId)) {
      nextOffers[team.teamId] = existingOffers[team.teamId] ?? [];
      continue;
    }
    const currentOffers = existingOffers[team.teamId] ?? [];
    const hasCurrentSeasonOffers =
      currentOffers.length === 3 && currentOffers.every((offer) => offer.seasonId === seasonId);
    if (!hasCurrentSeasonOffers) {
      nextOffers[team.teamId] = buildSponsorOffersForTeam({ gameState, teamId: team.teamId });
      changed = true;
    } else {
      nextOffers[team.teamId] = currentOffers;
    }
  }

  const normalizedOffers = normalizeLeagueSponsorOffers(gameState, nextOffers);

  if (!changed && normalizedOffers === nextOffers) {
    return gameState;
  }

  const offersChanged =
    changed ||
    Object.keys(normalizedOffers).some(
      (teamId) => normalizedOffers[teamId] !== (gameState.seasonState.sponsorOffersByTeamId ?? {})[teamId],
    );

  if (!offersChanged) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: normalizedOffers,
    },
  };
}

export { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";

function payBaseFirstInstallment(gameState: GameState, contract: TeamSponsorContract, saveId?: string): GameState {
  if (contract.payouts.baseFirstPaid) {
    return gameState;
  }
  const baseComponent = contract.components.find((component) => component.kind === "base");
  if (!baseComponent) {
    return gameState;
  }
  const payout = roundCash(baseComponent.rewardCash / 2);
  const teams = gameState.teams.map((team) =>
    team.teamId === contract.teamId ? { ...team, cash: roundCash(team.cash + payout) } : team,
  );
  const log: NonNullable<GameState["seasonState"]["sponsorPayoutLogs"]>[number] = {
    id: `sponsor-payout:${contract.seasonId}:${contract.teamId}:base_first:${Date.now()}`,
    saveId: saveId ?? gameState.seasonState.seasonId,
    seasonId: contract.seasonId,
    teamId: contract.teamId,
    phase: "base_first",
    componentId: baseComponent.componentId,
    cashDelta: payout,
    action: "apply",
    createdAt: new Date().toISOString(),
  };

  return {
    ...gameState,
    teams,
    seasonState: {
      ...gameState.seasonState,
      sponsorContractsByTeamId: {
        ...(gameState.seasonState.sponsorContractsByTeamId ?? {}),
        [contract.teamId]: {
          ...contract,
          payouts: { ...contract.payouts, baseFirstPaid: true },
        },
      },
      sponsorPayoutLogs: [log, ...(gameState.seasonState.sponsorPayoutLogs ?? [])],
    },
  };
}

export function chooseSponsorOffer(input: {
  gameState: GameState;
  teamId: string;
  offerId: string;
  saveId?: string;
  termSeasons?: SponsorTermSeasons;
  negotiationProfile?: SponsorNegotiationProfile;
}): { gameState: GameState; contract: TeamSponsorContract | null; error?: string } {
  const offers = getTeamSponsorOffers(input.gameState, input.teamId);
  const offer = offers.find((entry) => entry.offerId === input.offerId) ?? null;
  if (!offer) {
    return { gameState: input.gameState, contract: null, error: "sponsor_offer_not_found" };
  }

  const termSeasons: SponsorTermSeasons = 1;
  const negotiationProfile = input.negotiationProfile ?? "balanced";

  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.teamId) ?? null;
  let contract: TeamSponsorContract = {
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    offerId: offer.offerId,
    archetype: offer.archetype,
    name: offer.name,
    chosenAt: new Date().toISOString(),
    startRank: row?.startplatz ?? row?.rank ?? null,
    components: offer.components,
    payouts: {},
    starTier: offer.starTier,
    commercialRating: offer.commercialRating,
    sponsorBrandId: offer.sponsorBrandId,
    sponsorParentBrandId: offer.sponsorParentBrandId,
    variantKey: offer.variantKey,
    termSeasons,
    seasonsRemaining: termSeasons,
    negotiationProfile,
    demandProfile: offer.demandProfile,
  };
  contract = applySponsorNegotiationToContract(contract, { termSeasons, negotiationProfile });

  let nextGameState: GameState = {
    ...input.gameState,
    seasonState: {
      ...input.gameState.seasonState,
      sponsorContractsByTeamId: {
        ...(input.gameState.seasonState.sponsorContractsByTeamId ?? {}),
        [input.teamId]: contract,
      },
    },
  };
  nextGameState = appendSponsorBrandHistory(nextGameState, input.teamId, offer.sponsorParentBrandId);
  nextGameState = payBaseFirstInstallment(nextGameState, contract, input.saveId);
  const updatedContract = getTeamSponsorContract(nextGameState, input.teamId);
  return { gameState: nextGameState, contract: updatedContract };
}

function resolveAiSponsorArchetypePreference(input: {
  teamId: string;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cashPressure: number;
  powerRank: number | null;
}): SponsorArchetype | "balanced" {
  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const starPriority = input.profile?.bias.starPriority ?? input.identity?.ambition ?? 5;
  const valuePriority = input.profile?.bias.valuePriority ?? 5;
  const rank = input.powerRank;

  if (input.cashPressure >= 7 || cashPriority >= 8 || input.teamId === "R-R" || input.teamId === "C-C") {
    return "security";
  }
  if (starPriority >= 9 && rank != null && rank <= 6) {
    return "performance";
  }
  if (starPriority >= 8 && rank != null && rank <= 10) {
    return "performance";
  }
  if (valuePriority >= 8 && (rank ?? 20) >= 14) {
    return "security";
  }
  if ((input.profile?.preferredArchetypes.length ?? 0) >= 4 || input.profile?.fantasyTheme) {
    return "identity";
  }
  if ((input.identity?.ambition ?? 5) <= 4 && (rank ?? 20) >= 18) {
    return "security";
  }
  return "balanced";
}

function scoreOfferForAi(input: {
  offer: SponsorOffer;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cashPressure: number;
  powerRank?: number | null;
  teamId: string;
}): number {
  const { offer, profile, identity, cashPressure, powerRank, teamId } = input;
  const rank = powerRank ?? null;
  const preferredArchetype = resolveAiSponsorArchetypePreference({
    teamId,
    profile,
    identity,
    cashPressure,
    powerRank: rank,
  });

  let score = estimateExpectedPayout(offer, rank) * 3;
  score += (offer.starTier ?? 2) * 4;

  if (preferredArchetype === offer.archetype) {
    score += 22;
  } else if (preferredArchetype === "balanced") {
    if (offer.archetype === "identity") score += 12;
    if (offer.archetype === "security") score += 10;
    if (offer.archetype === "performance" && rank != null && rank <= 14) score += 8;
  } else if (preferredArchetype === "security" && offer.archetype === "performance") {
    score -= 18;
  } else if (preferredArchetype === "performance" && offer.archetype === "security") {
    score -= 8;
  }

  if (rank != null && rank >= 22 && offer.archetype === "performance") {
    score -= 25;
  }
  if (rank != null && rank <= 5 && offer.archetype === "security" && (profile?.bias.starPriority ?? 0) >= 8) {
    score -= 6;
  }

  return score;
}

export function chooseSponsorOfferForAiTeams(gameState: GameState, settingsMap?: Record<string, TeamControlSettings>): GameState {
  const controlSettings = settingsMap ?? buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let nextGameState = ensureSeasonSponsorOffers(gameState);

  // Build overview rows once — reused for all teams instead of O(n²) per-team calls.
  const overviewRows = buildTeamSeasonOverviewRows({ gameState: nextGameState });
  const rowByTeamId = new Map(overviewRows.map((row) => [row.teamId, row]));

  for (const team of nextGameState.teams) {
    if (getTeamSponsorContract(nextGameState, team.teamId)) {
      continue;
    }
    const control = controlSettings[team.teamId];
    if (control?.controlMode === "manual" || control?.controlMode === "passive") {
      continue;
    }
    const offers = getTeamSponsorOffers(nextGameState, team.teamId);
    if (offers.length === 0) {
      continue;
    }
    const identity = nextGameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const profile = getTeamStrategyProfile(nextGameState, team.teamId);
    const row = rowByTeamId.get(team.teamId) ?? null;
    const cashPressure = row?.cash != null && row.cash < 0 ? 10 : row?.cash != null && row.cash < 20 ? 7 : 3;
    const powerRank = row?.rank ?? null;
    const ambition = identity?.ambition ?? profile?.bias.starPriority ?? 5;
    const negotiation = defaultAiSponsorNegotiation({ cashPressure, ambition });
    const bestOffer = [...offers].sort(
      (left, right) =>
        scoreOfferForAi({ offer: right, profile, identity, cashPressure, powerRank, teamId: team.teamId }) -
        scoreOfferForAi({ offer: left, profile, identity, cashPressure, powerRank, teamId: team.teamId }),
    )[0];
    if (!bestOffer) {
      continue;
    }
    const result = chooseSponsorOffer({
      gameState: nextGameState,
      teamId: team.teamId,
      offerId: bestOffer.offerId,
      termSeasons: negotiation.termSeasons,
      negotiationProfile: negotiation.negotiationProfile,
    });
    nextGameState = result.gameState;
  }

  return nextGameState;
}

export function buildSponsorChoiceSummary(gameState: GameState) {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const controlSettings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  return gameState.teams.map((team) => {
    const contract = getTeamSponsorContract(gameState, team.teamId);
    const offers = getTeamSponsorOffers(gameState, team.teamId);
    const control = controlSettings[team.teamId];
    const row = rows.find((entry) => entry.teamId === team.teamId) ?? null;
    const commercialRating = buildSponsorCommercialRating({ gameState, teamId: team.teamId });
    return {
      teamId: team.teamId,
      teamName: team.name,
      shortCode: team.shortCode,
      controlMode: control?.controlMode ?? "ai",
      hasContract: contract != null,
      contract,
      offers,
      commercialRating,
      requiresManualChoice: control?.controlMode === "manual" && !contract,
      cash: row?.cash ?? team.cash,
    };
  });
}

export function createSponsorChoiceConfirmToken(teamId: string, offerId: string) {
  return `SPONSOR_CHOICE:${teamId}:${offerId}:${randomUUID()}`;
}

export { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";
