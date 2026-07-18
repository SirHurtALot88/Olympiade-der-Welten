import { describe, expect, it } from "vitest";

import { buildSponsorOffersForTeam, chooseSponsorOffer, getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-service";
import { rollSponsorOfferSlate, rollSponsorStarTiers } from "@/lib/sponsor/sponsor-tier-pool";
import { SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { SPONSOR_BRAND_PARENTS } from "@/lib/sponsor/sponsor-brand-parents";
import { SPONSOR_BRAND_VARIANTS, listSponsorBrandTemplates } from "@/lib/sponsor/sponsor-brand-variants";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { applySponsorNegotiationToComponents } from "@/lib/sponsor/sponsor-negotiation";
import type { GameState, Team } from "@/lib/data/olyDataTypes";

function team(): Team {
  return {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    budget: 500,
    cash: 300,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 12,
  };
}

function baseGameState(): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: { seasonId: "season-2", schedule: [], standings: {} },
    matchdayState: { matchdayId: "season-2-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team()],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

describe("sponsor catalog v2.6", () => {
  it("ships 100 parody parent brands", () => {
    expect(SPONSOR_BRAND_PARENTS).toHaveLength(100);
    expect(new Set(SPONSOR_BRAND_PARENTS.map((entry) => entry.id)).size).toBe(100);
  });

  it("generates 3-5 variants per parent brand", () => {
    const counts = new Map<string, number>();
    for (const variant of SPONSOR_BRAND_VARIANTS) {
      counts.set(variant.parentBrandId, (counts.get(variant.parentBrandId) ?? 0) + 1);
    }
    expect(counts.size).toBe(100);
    for (const parent of SPONSOR_BRAND_PARENTS) {
      const count = counts.get(parent.id) ?? 0;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(SPONSOR_BRAND_VARIANTS.length).toBeGreaterThanOrEqual(300);
    expect(listSponsorBrandTemplates().length).toBe(SPONSOR_BRAND_VARIANTS.length);
  });

  it("includes recognizable parody names", () => {
    const names = SPONSOR_BRAND_PARENTS.map((entry) => entry.name);
    expect(names).toContain("O.B.I. Baumarkt");
    expect(names).toContain("Teslara Motors");
    expect(names).toContain("Siemenswerk AG");
  });
});

describe("sponsor tier pool v2.6", () => {
  it("allows top-rarity (legendär) offers for elite commercial ratings via the slate roller", () => {
    const eliteQuality: SponsorTeamQualityRank = {
      teamId: "M-M",
      qualityRank: 1.2,
      components: [],
      maxStarTier: 5,
      targetStarTier: 5,
      maxRarity: "legendär",
      targetRarity: "legendär",
      leaguePosition: 1,
      leaguePercentile: 99,
    };
    // Neuer Slate-Wurf (ersetzt den Sterne-Wurf): ein Elite-Team (Decke legendär) sieht über mehrere Saisons
    // mindestens einmal ein legendäres Angebot. Legacy-Sternwurf bleibt als Kompatibilitäts-API bestehen.
    const slates = Array.from({ length: 24 }, (_, index) =>
      rollSponsorOfferSlate({
        seasonId: `season-luck-${index}`,
        teamId: "M-M",
        qualityRank: eliteQuality,
      }),
    );
    const maxOrderSeen = Math.max(
      ...slates.flatMap((slate) => slate.entries.map((entry) => SPONSOR_RARITIES[entry.rarity].order)),
    );
    expect(maxOrderSeen).toBe(SPONSOR_RARITIES.legendär.order);

    // Kompatibilität: der Legacy-Sternwurf liefert für dieselbe Elite-Decke weiterhin bis zu 5★.
    const starSamples = Array.from({ length: 24 }, (_, index) =>
      rollSponsorStarTiers({ seasonId: `season-luck-${index}`, teamId: "M-M", qualityRank: eliteQuality }),
    );
    expect(starSamples.some((roll) => roll.tiers.includes(5))).toBe(true);
  });

  it("deduplicates sponsor parent brands across the three offer slots", () => {
    const offers = buildSponsorOffersForTeam({ gameState: baseGameState(), teamId: "M-M" });
    const parentIds = offers.map((offer) => offer.sponsorParentBrandId).filter(Boolean);
    expect(new Set(parentIds).size).toBe(parentIds.length);
    expect(offers.every((offer) => offer.name.length > 0)).toBe(true);
    expect(offers.some((offer) => offer.variantKey != null)).toBe(true);
  });

  it("picks sponsor parents from SPONSOR_BRAND_PARENTS before selecting a variant", () => {
    const offers = buildSponsorOffersForTeam({ gameState: baseGameState(), teamId: "M-M" });
    for (const offer of offers) {
      expect(SPONSOR_BRAND_PARENTS.some((parent) => parent.id === offer.sponsorParentBrandId)).toBe(true);
      const parent = SPONSOR_BRAND_PARENTS.find((entry) => entry.id === offer.sponsorParentBrandId);
      expect(offer.name).toBe(parent?.name);
      expect(offer.flavor).toContain(parent?.flavorBase ?? "");
    }
  });

  it("applies term and profile multipliers when signing", () => {
    const base = baseGameState();
    const offers = buildSponsorOffersForTeam({ gameState: base, teamId: "M-M" });
    const withOffers: GameState = {
      ...base,
      seasonState: {
        ...base.seasonState,
        sponsorOffersByTeamId: { "M-M": offers },
      },
    };
    const offer = offers[0]!;
    const result = chooseSponsorOffer({
      gameState: withOffers,
      teamId: "M-M",
      offerId: offer.offerId,
      termSeasons: 1,
      negotiationProfile: "ambitious",
    });
    const contract = result.contract;
    expect(contract?.termSeasons).toBe(1);
    expect(contract?.seasonsRemaining).toBe(1);
    expect(contract?.negotiationProfile).toBe("ambitious");
    // WAVE 1: Der Profil-Effekt ist kein einzelner Skalar mehr (base/upside/penalty skalieren getrennt),
    // deshalb prüfen wir gegen die tatsächlich verhandlungs-adjustierten Komponenten statt gegen einen
    // uniformen Multiplikator. Kernaussage bleibt: das Signieren wendet die Verhandlungs-Mathematik an.
    const expectedComponents = applySponsorNegotiationToComponents({
      components: offer.components,
      termSeasons: 1,
      negotiationProfile: "ambitious",
    });
    const expectedTotal = expectedComponents.reduce((sum, component) => sum + component.rewardCash, 0);
    const contractTotal = contract?.components.reduce((sum, component) => sum + component.rewardCash, 0) ?? 0;
    expect(contractTotal).toBeCloseTo(expectedTotal, 1);
    // WAVE 1 Ambitioniert-Downside (archetyp-UNABHÄNGIG, die eigentliche Kernaussage): der garantierte
    // Sockel (base) SINKT (×0.88), die Upside (rank/special/improvement) STEIGT (×1.25). Die reine
    // Gesamtsumme kann dabei je nach Angebotsprofil steigen ODER fallen (bei einem flachen Sockel-Sponsor
    // fällt sie — genau der gewollte Trade-off), deshalb prüfen wir die Komponenten getrennt, nicht die Summe.
    const sumUpside = (components: typeof offer.components) =>
      components.filter((c) => c.kind !== "base").reduce((sum, c) => sum + c.rewardCash, 0);
    const origBase = offer.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
    const signedBase = contract?.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
    expect(signedBase).toBeLessThan(origBase); // Sockel-Abschlag
    expect(sumUpside(contract?.components ?? [])).toBeGreaterThan(sumUpside(offer.components)); // Upside-Hebel
  });

  it("carries single-season contracts only until season advance", () => {
    const base = baseGameState();
    const offers = buildSponsorOffersForTeam({ gameState: base, teamId: "M-M" });
    const withOffers: GameState = {
      ...base,
      seasonState: {
        ...base.seasonState,
        sponsorOffersByTeamId: { "M-M": offers },
      },
    };
    const signed = chooseSponsorOffer({
      gameState: withOffers,
      teamId: "M-M",
      offerId: offers[0]!.offerId,
      termSeasons: 3,
      negotiationProfile: "balanced",
    }).gameState;
    const advanced = advanceSponsorContractsForNewSeason(
      {
        ...signed,
        season: { ...signed.season, id: "season-3" },
      },
      "season-3",
    );
    const contract = getTeamSponsorContract(advanced, "M-M");
    expect(contract).toBeNull();
  });
});
