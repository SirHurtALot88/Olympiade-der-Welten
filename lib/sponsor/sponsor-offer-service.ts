import { randomUUID } from "node:crypto";

import type {
  GameState,
  SponsorArchetype,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorStarTier,
  Team,
  TeamIdentity,
  TeamSponsorContract,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildTeamControlSettingsMap, type TeamControlSettings } from "@/lib/foundation/team-control-settings";
import { pickSponsorBrandForOffer } from "@/lib/sponsor/sponsor-brand-catalog";
import { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";
import {
  getDemandMultiplier,
  getDemandProfile,
  getRewardMultiplier,
  rollSponsorStarTiers,
} from "@/lib/sponsor/sponsor-tier-pool";

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  usedBrandIds?: string[];
}): SponsorOffer {
  const { team, identity, profile, archetype, rankTarget, startRank, gameState, starTier, commercialRating, slotIndex } = input;
  const demandMult = getDemandMultiplier(starTier);
  const rewardMult = getRewardMultiplier(starTier);
  const improvementBase = startRank != null ? Math.min(4, Math.max(2, Math.round((startRank - rankTarget) / 2) || 2)) : 2;
  const improvementTarget = improvementBase + (starTier >= 4 ? 1 : 0) + (starTier >= 5 ? 1 : 0);
  const { brand, special } = pickSponsorBrandForOffer({
    seasonId: gameState.season.id,
    teamId: team.teamId,
    team,
    identity,
    profile,
    archetype,
    starTier,
    slotIndex,
    usedBrandIds: input.usedBrandIds,
  });

  const scale = (value: number) => roundCash(value * rewardMult);
  const components: SponsorOfferComponent[] = [
    {
      componentId: "base-cash",
      kind: "base",
      label: "Basis-Saisonzahlung",
      targetValue: scale(brand.baseCash),
      rewardCash: scale(brand.baseCash),
    },
    {
      componentId: "rank-target",
      kind: "rank",
      label: `Platzierung Top ${rankTarget}`,
      targetValue: rankTarget,
      rewardCash: scale(brand.rankCash),
      penaltyCash: Math.max(1, roundCash(scale(brand.rankCash) / 3 * demandMult)),
    },
    {
      componentId: "improvement-target",
      kind: "improvement",
      label: `≥ ${improvementTarget} Plätze verbessern`,
      targetValue: improvementTarget,
      rewardCash: scale(brand.improvementCash),
    },
    {
      ...special,
      rewardCash: scale(special.rewardCash),
      penaltyCash: special.penaltyCash != null ? roundCash(special.penaltyCash * demandMult) : undefined,
    },
  ];

  return {
    offerId: `${gameState.season.id}:${team.teamId}:${archetype}:${starTier}:${slotIndex}`,
    seasonId: gameState.season.id,
    teamId: team.teamId,
    archetype,
    name: brand.name,
    flavor: brand.flavor,
    components,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
    starTier,
    commercialRating,
    sponsorBrandId: brand.id,
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
  const starTiers = rollSponsorStarTiers({
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    commercialRating: commercialRating.score,
  });
  const archetypes: SponsorArchetype[] = ["security", "performance", "identity"];
  const usedBrandIds: string[] = [];

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
      usedBrandIds,
    });
    if (offer.sponsorBrandId) {
      usedBrandIds.push(offer.sponsorBrandId);
    }
    return offer;
  });
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

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: nextOffers,
    },
  };
}

export function ensureSeasonSponsorOffers(gameState: GameState): GameState {
  const seasonId = gameState.season.id;
  const existingOffers = gameState.seasonState.sponsorOffersByTeamId ?? {};
  const nextOffers: Record<string, SponsorOffer[]> = {};
  let changed = false;

  for (const team of gameState.teams) {
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

  if (!changed) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: nextOffers,
    },
  };
}

export function getTeamSponsorContract(gameState: GameState, teamId: string): TeamSponsorContract | null {
  const contract = gameState.seasonState.sponsorContractsByTeamId?.[teamId] ?? null;
  if (!contract || contract.seasonId !== gameState.season.id) {
    return null;
  }
  return contract;
}

export function getTeamSponsorOffers(gameState: GameState, teamId: string): SponsorOffer[] {
  const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
  return offers.filter((offer) => offer.seasonId === gameState.season.id);
}

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
}): { gameState: GameState; contract: TeamSponsorContract | null; error?: string } {
  const offers = getTeamSponsorOffers(input.gameState, input.teamId);
  const offer = offers.find((entry) => entry.offerId === input.offerId) ?? null;
  if (!offer) {
    return { gameState: input.gameState, contract: null, error: "sponsor_offer_not_found" };
  }

  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.teamId) ?? null;
  const contract: TeamSponsorContract = {
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
    demandProfile: offer.demandProfile,
  };

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
  nextGameState = payBaseFirstInstallment(nextGameState, contract, input.saveId);
  const updatedContract = getTeamSponsorContract(nextGameState, input.teamId);
  return { gameState: nextGameState, contract: updatedContract };
}

function scoreOfferForAi(input: {
  offer: SponsorOffer;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cashPressure: number;
}): number {
  const { offer, profile, identity, cashPressure } = input;
  const ambition = identity?.ambition ?? profile?.bias.starPriority ?? 5;
  const cashPriority = profile?.bias.cashPriority ?? identity?.finances ?? 5;
  const tier = offer.starTier ?? 2;
  const upsidePerTier = (offer.totalUpsideEstimate ?? 0) / Math.max(1, tier);
  let score = upsidePerTier;
  if (cashPressure >= 7 || cashPriority >= 8) {
    score += offer.archetype === "security" ? 40 : offer.archetype === "identity" ? 10 : 0;
    score -= tier >= 4 ? 15 : 0;
  } else if (ambition >= 8) {
    score += offer.archetype === "performance" ? 25 : offer.archetype === "identity" ? 15 : 0;
    score += tier >= 4 ? 10 : 0;
  } else {
    score += offer.archetype === "identity" ? 20 : offer.archetype === "security" ? 15 : 5;
  }
  return score;
}

export function chooseSponsorOfferForAiTeams(gameState: GameState, settingsMap?: Record<string, TeamControlSettings>): GameState {
  const controlSettings = settingsMap ?? buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let nextGameState = ensureSeasonSponsorOffers(gameState);

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
    const rows = buildTeamSeasonOverviewRows({ gameState: nextGameState });
    const row = rows.find((entry) => entry.teamId === team.teamId) ?? null;
    const cashPressure = row?.cash != null && row.cash < 0 ? 10 : row?.cash != null && row.cash < 20 ? 7 : 3;
    const bestOffer = [...offers].sort(
      (left, right) =>
        scoreOfferForAi({ offer: right, profile, identity, cashPressure }) -
        scoreOfferForAi({ offer: left, profile, identity, cashPressure }),
    )[0];
    if (!bestOffer) {
      continue;
    }
    const result = chooseSponsorOffer({ gameState: nextGameState, teamId: team.teamId, offerId: bestOffer.offerId });
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
