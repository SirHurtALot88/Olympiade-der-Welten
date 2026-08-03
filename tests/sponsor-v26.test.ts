import { describe, expect, it } from "vitest";

import { buildSponsorOffersForTeam, chooseSponsorOffer, getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-service";
import { rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import { SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { SPONSOR_BRAND_PARENTS } from "@/lib/sponsor/sponsor-brand-parents";
import { SPONSOR_BRAND_VARIANTS, listSponsorBrandTemplates } from "@/lib/sponsor/sponsor-brand-variants";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
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
  it("ships 200 parody parent brands — enough for one distinct brand per offer league-wide", () => {
    // Von 100 auf 200 erhoeht: 32 Teams x 5 Angebote = 160 Angebote pro Saison. Erst ab >=160 Marken
    // kann jedes Angebot der Liga eine eigene Marke tragen (GLOBAL_PARENT_MAX_TEAMS = 1), sodass kein
    // Team denselben Sponsor bekommt wie ein anderes. Die 40 daruber sind Rotationspuffer.
    expect(SPONSOR_BRAND_PARENTS.length).toBeGreaterThanOrEqual(32 * 5);
    expect(SPONSOR_BRAND_PARENTS).toHaveLength(200);
    expect(new Set(SPONSOR_BRAND_PARENTS.map((entry) => entry.id)).size).toBe(200);
    // Namen muessen ebenfalls eindeutig sein — die Uebersicht zeigt den Markennamen, nicht die id.
    expect(new Set(SPONSOR_BRAND_PARENTS.map((entry) => entry.name)).size).toBe(200);
  });

  it("generates 3-5 variants per parent brand", () => {
    const counts = new Map<string, number>();
    for (const variant of SPONSOR_BRAND_VARIANTS) {
      counts.set(variant.parentBrandId, (counts.get(variant.parentBrandId) ?? 0) + 1);
    }
    expect(counts.size).toBe(SPONSOR_BRAND_PARENTS.length);
    for (const parent of SPONSOR_BRAND_PARENTS) {
      const count = counts.get(parent.id) ?? 0;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(SPONSOR_BRAND_VARIANTS.length).toBeGreaterThanOrEqual(SPONSOR_BRAND_PARENTS.length * 3);
    expect(listSponsorBrandTemplates().length).toBe(SPONSOR_BRAND_VARIANTS.length);
  });

  it("splits the catalog into 100 German and 100 international recognizable brands", () => {
    const names = SPONSOR_BRAND_PARENTS.map((entry) => entry.name);
    // Wiedererkennungswert vor Wortspiel: stark verfremdete Namen (frueher z. B. "Teslara Motors",
    // "AlphaSearch Global", "Golden Arches Fast") sind durch erkennbare ersetzt.
    expect(names).toContain("O.B.I. Baumarkt");
    expect(names).toContain("Siemenswerk AG");
    expect(names).toContain("Tesla Motors");
    expect(names).toContain("Chrysler Motors");
    expect(names).toContain("Samsung Electronics");
    expect(names).toContain("LG Electronics");
    expect(names).not.toContain("Teslara Motors");

    const byRegion = SPONSOR_BRAND_PARENTS.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.region] = (acc[entry.region] ?? 0) + 1;
      return acc;
    }, {});
    expect(byRegion.dach).toBe(100);
    expect(byRegion.global).toBe(100);
  });
});

describe("sponsor tier pool v2.6", () => {
  it("allows top-rarity (legendär) offers for elite commercial ratings via the slate roller", () => {
    const eliteQuality: SponsorTeamQualityRank = {
      teamId: "M-M",
      qualityRank: 1.2,
      components: [],
      maxRarity: "legendär",
      targetRarity: "legendär",
      leaguePosition: 1,
      leaguePercentile: 99,
    };
    // Ein Elite-Team (Decke legendär) sieht über mehrere Saisons mindestens einmal ein legendäres Angebot.
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

  it("signs a contract using the offer components unchanged (negotiation axis removed)", () => {
    const base = baseGameState();
    const offers = buildSponsorOffersForTeam({ gameState: base, teamId: "M-M" });
    // Umsetzungsplan D: `chooseSponsorOffer` liest die Laufzeit aus dem Angebot, nicht mehr aus dem
    // (jetzt ignorierten) `termSeasons`-Aufrufparameter — das Angebot wird hier auf 1 Saison gezwungen,
    // damit dieser Test unabhaengig vom Slate-Wurf bleibt (der ist Gegenstand von sponsor-tier-pool.test.ts).
    const offer = { ...offers[0]!, termSeasons: 1 as const };
    const withOffers: GameState = {
      ...base,
      seasonState: {
        ...base.seasonState,
        sponsorOffersByTeamId: { "M-M": [offer, ...offers.slice(1)] },
      },
    };
    const result = chooseSponsorOffer({
      gameState: withOffers,
      teamId: "M-M",
      offerId: offer.offerId,
    });
    const contract = result.contract;
    expect(contract?.termSeasons).toBe(1);
    expect(contract?.seasonsRemaining).toBe(1);
    // Verhandlungs-Achse (Sicher/Ausgewogen/Ambitioniert) entfernt: der Vertrag trägt KEIN Profil mehr, und
    // die Vertragskomponenten sind exakt die Angebotskomponenten — keine safe/ambitious-Adjustierung.
    expect(contract?.negotiationProfile).toBeUndefined();
    const contractTotal = contract?.components.reduce((sum, component) => sum + component.rewardCash, 0) ?? 0;
    const offerTotal = offer.components.reduce((sum, component) => sum + component.rewardCash, 0);
    expect(contractTotal).toBeCloseTo(offerTotal, 5);
    const origBase = offer.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
    const signedBase = contract?.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
    expect(signedBase).toBeCloseTo(origBase, 5); // Sockel unverändert (Identität)
  });

  it("carries single-season contracts only until season advance", () => {
    const base = baseGameState();
    const offers = buildSponsorOffersForTeam({ gameState: base, teamId: "M-M" });
    const offer = { ...offers[0]!, termSeasons: 1 as const };
    const withOffers: GameState = {
      ...base,
      seasonState: {
        ...base.seasonState,
        sponsorOffersByTeamId: { "M-M": [offer, ...offers.slice(1)] },
      },
    };
    const signed = chooseSponsorOffer({
      gameState: withOffers,
      teamId: "M-M",
      offerId: offer.offerId,
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

  it("carries multi-season contracts through season advance and rebuilds the ladder for the new salary factor", () => {
    // Umsetzungsplan D: die Laufzeit kommt aus dem Angebot (hier auf 3 Saisons gezwungen), und ein
    // Vertrag mit seasonsRemaining > 1 muss den Advance UEBERLEBEN (statt geloescht zu werden) UND
    // seine `sponsorV3`-Leiter mit dem SalaryFactor der neuen Saison neu bauen (Kopplung an die
    // Konjunktur, siehe sponsor-v3-offer-service.ts::rerollSponsorV3TermsForNewSeason).
    const base = baseGameState();
    const offers = buildSponsorOffersForTeam({ gameState: base, teamId: "M-M" });
    const offer = { ...offers[0]!, termSeasons: 3 as const };
    const withOffers: GameState = {
      ...base,
      seasonState: {
        ...base.seasonState,
        sponsorOffersByTeamId: { "M-M": [offer, ...offers.slice(1)] },
      },
    };
    const signed = chooseSponsorOffer({
      gameState: withOffers,
      teamId: "M-M",
      offerId: offer.offerId,
    }).gameState;
    const signedContract = getTeamSponsorContract(signed, "M-M");
    expect(signedContract?.termSeasons).toBe(3);
    expect(signedContract?.seasonsRemaining).toBe(3);

    // Ein neuer, DEUTLICH anderer Salary Factor fuer die Folgesaison — muss sich in der neu gebauten
    // Leiter niederschlagen, NICHT im eingefrorenen Sockel.
    const nextFactor = (signedContract?.salaryFactorAtSign ?? 1) > 1 ? 0.82 : 1.24;
    const advanced = advanceSponsorContractsForNewSeason(
      {
        ...signed,
        season: { ...signed.season, id: "season-3" },
        seasonState: {
          ...signed.seasonState,
          seasonEconomyFactors: [{
            seasonId: "season-3",
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: nextFactor,
            source: "rolled",
            rollSeed: null,
            carriedFromSeasonId: null,
            generatedAt: new Date().toISOString(),
          }],
        },
      },
      "season-3",
    );
    const rolled = getTeamSponsorContract(advanced, "M-M");
    expect(rolled).not.toBeNull();
    expect(rolled?.termSeasons).toBe(3);
    expect(rolled?.seasonsRemaining).toBe(2);
    expect(rolled?.startRank).toBe(signedContract?.startRank);
    // Der eingefrorene Startrang (und damit der daraus abgeleitete Sockel, siehe
    // tests/sponsor-laufzeit-rollover.test.ts fuer den direkten Sockel-Beweis) bleibt beim Rollen
    // unangetastet.
    expect(rolled?.sponsorV3?.startRank).toBe(signedContract?.sponsorV3?.startRank);
    // Salary Factor der neu gebauten Leiter ist der NEUE, nicht mehr der bei Unterschrift eingefrorene.
    expect(rolled?.sponsorV3?.salaryFactor).toBeCloseTo(nextFactor, 5);
    expect(rolled?.sponsorV3?.salaryFactor).not.toBeCloseTo(signedContract?.sponsorV3?.salaryFactor ?? -1, 5);
  });
});
