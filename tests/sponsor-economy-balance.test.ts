import { describe, expect, it } from "vitest";

import type { GameState, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import type { SponsorCurveShape, SponsorRarity } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  buildSponsorOffersForTeam,
  chooseSponsorOffer,
} from "@/lib/sponsor/sponsor-offer-service";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  buildLockedRankPayoutLadder,
  getLeagueFourthFromLowestSalaryTotal,
  getRankMilestoneBonus,
  getSponsorCurveShapePayout,
  getSponsorPayoutForFinalRank,
  getSponsorRank32BaseAnchorSalary,
  resolveSponsorEconomyAnchors,
  SPONSOR_BASE_FLOOR_C,
  SPONSOR_BASE_SALARY_BUFFER_C,
  SPONSOR_GOLDEN_MS_ABS_CAP_C,
} from "@/lib/sponsor/sponsor-economy-calibration";
import {
  getSponsorRarityEtatFactor,
  SPONSOR_CURVE_SHAPE_KEYS,
  SPONSOR_CURVE_SHAPES,
  SPONSOR_RARITIES,
  SPONSOR_RARITY_KEYS,
  SPONSOR_REFERENCE_BASE_FLOOR,
} from "@/lib/sponsor/sponsor-curve-shapes";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import type { SponsorOfferComponent } from "@/lib/data/olyDataTypes";

function createTeam(index: number): Team {
  const code = `T-${String(index + 1).padStart(2, "0")}`;
  return {
    teamId: code,
    shortCode: code,
    name: `Team ${index + 1}`,
    budget: 120,
    cash: 80,
    identityId: code,
    humanControlled: index === 0,
    rosterLimit: 12,
  };
}

function createRoster(teamId: string, playerId: string, salary = 5): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary,
    upkeep: salary,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    joinedSeasonId: "season-2",
  };
}

function buildLeagueGameState(salaryFactor: number): GameState {
  const teams = Array.from({ length: 32 }, (_, index) => createTeam(index));
  const rosters = teams.flatMap((team) =>
    Array.from({ length: 8 }, (_, playerIndex) =>
      createRoster(team.teamId, `${team.teamId}-p${playerIndex + 1}`),
    ),
  );

  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: Object.fromEntries(teams.map((team, index) => [team.teamId, { points: 100 - index, rank: index + 1 }])),
      seasonEconomyFactors: [
        {
          seasonId: "season-2",
          seasonLabel: "Aktuell",
          horizonIndex: 0,
          factor: salaryFactor,
          source: "sheet_seed",
        },
      ],
    },
    matchdayState: { matchdayId: "season-2-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: teams.map((team, index) => ({
      teamId: team.teamId,
      playerType: null,
      pow: 5,
      spe: 5,
      men: 5,
      soc: 5,
      ambition: index < 8 ? 8 : 5,
      finances: 5,
      boardConfidence: 6,
      harmony: 5,
      manners: 5,
      popularity: 5,
      cooperation: 5,
      playerMin: 7,
      playerOpt: 10,
    })),
    players: rosters.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      rating: 60,
      marketValue: 20,
      salaryDemand: 5,
      displayMarketValue: 20,
      displaySalary: 5,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "f",
      referenceClass: null,
      imageSource: null,
      bracketLabel: null,
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
      coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
      preferredDisciplineIds: [],
      disciplineRatings: { d1: 50 },
      disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
      flavorEn: "",
      flavorDe: "",
      fatigue: 0,
      form: 0,
      potential: 0,
      portraitPath: null,
      portraitUrl: null,
    })),
    disciplines: [],
    rosters,
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
      teamCount: 32,
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

function teamSeasonSponsorPayout(gameState: GameState, seasonId: string, teamId: string) {
  return (gameState.seasonState.sponsorPayoutLogs ?? [])
    .filter((log) => log.seasonId === seasonId && log.teamId === teamId)
    .reduce((sum, log) => sum + log.cashDelta, 0);
}

function runSingleTeamSettlement(gameState: GameState, teamId: string) {
  const offers = buildSponsorOffersForTeam({ gameState, teamId });
  const securityOffer = offers.find((offer) => offer.archetype === "security") ?? offers[0]!;
  const signed = chooseSponsorOffer({
    gameState: {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { [teamId]: offers },
      },
    },
    teamId,
    offerId: securityOffer.offerId,
  }).gameState;

  return applySponsorSettlement({
    gameState: signed,
    saveId: "sponsor-balance-test",
    phase: "season_end",
    execute: true,
  }).gameState;
}

// Σ über alle 32 Ränge des Kurven-Payouts (Etat unter der Rang→Payout-Kurve) für eine (rarity, curveShape).
function sumCurvePayout(rarity: SponsorRarity, shape: SponsorCurveShape, salaryFactor = 1, leagueMin = SPONSOR_BASE_FLOOR_C) {
  let total = 0;
  for (let rank = 1; rank <= 32; rank += 1) {
    total += getSponsorCurveShapePayout(rank, salaryFactor, rarity, shape, leagueMin);
  }
  return total;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// NEUES Rarity + Kurvenform-Sponsoren-Modell (ersetzt Stern-Tier + 3 Archetypen).
// payout(rank) = effectiveBaseFloor(gehaltsgeankert) × rarity-Etat-Faktor × shape-Rang-Mult × qualityRebalance.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe("sponsor curve-shape + rarity economy", () => {
  // ── Punkt 1: Referenz-Reproduktion ──────────────────────────────────────────────────────────────
  // Bei magisch (×1.0), salaryFactor 1.0, leagueMin 32 (⇒ effectiveBaseFloor 36 == SPONSOR_REFERENCE_BASE_FLOOR)
  // gibt getSponsorCurveShapePayout exakt die kalibrierten Referenz-Arrays zurück.
  it("reproduces each shape's reference array at magisch / sf 1.0 / leagueMin 32", () => {
    expect(resolveSponsorEconomyAnchors(1, SPONSOR_BASE_FLOOR_C).effectiveBaseFloor).toBe(SPONSOR_REFERENCE_BASE_FLOOR);

    const sampleShapes: SponsorCurveShape[] = ["titeljaeger", "europapokal", "konsolidierung", "sicherheit", "klassenerhalt"];
    const sampleRanks = [1, 5, 9, 16, 20, 28, 32];
    for (const shape of sampleShapes) {
      for (const rank of sampleRanks) {
        const payout = getSponsorCurveShapePayout(rank, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C);
        const reference = SPONSOR_CURVE_SHAPES[shape].reference[rank - 1]!;
        expect(Math.abs(payout - reference)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  // ── Punkt 2: gleiches Etat pro Rarity + Skalierung über die Rarities ────────────────────────────
  it("keeps the total Etat equal across shapes at a fixed rarity (shapes only redistribute)", () => {
    for (const rarity of SPONSOR_RARITY_KEYS) {
      const sums = SPONSOR_CURVE_SHAPE_KEYS.map((shape) => sumCurvePayout(rarity, shape));
      const mean = sums.reduce((sum, value) => sum + value, 0) / sums.length;
      const spreadPct = (Math.max(...sums) - Math.min(...sums)) / mean;
      // Alle 11 Kurvenformen zahlen bei gleicher Rarity dasselbe Gesamt-Etat (±~1 %) — sie verschieben es nur.
      expect(spreadPct).toBeLessThan(0.01);
    }
  });

  it("scales the total Etat by the rarity factor (gewöhnlich < magisch < selten < legendär)", () => {
    const magischSum = sumCurvePayout("magisch", "sicherheit");
    for (const rarity of SPONSOR_RARITY_KEYS) {
      const ratio = sumCurvePayout(rarity, "sicherheit") / magischSum;
      // Σ skaliert mit dem Etat-Faktor der Rarity (≈ 0.90 / 1.0 / 1.07 / 1.15).
      expect(ratio).toBeCloseTo(getSponsorRarityEtatFactor(rarity), 1);
    }
    // strikt monoton in der Rarity-Ordnung
    const ordered = [...SPONSOR_RARITY_KEYS].sort((a, b) => SPONSOR_RARITIES[a].order - SPONSOR_RARITIES[b].order);
    const orderedSums = ordered.map((rarity) => sumCurvePayout(rarity, "titeljaeger"));
    for (let i = 1; i < orderedSums.length; i += 1) {
      expect(orderedSums[i]!).toBeGreaterThan(orderedSums[i - 1]!);
    }
  });

  // ── Punkt 3: monoton-nicht-steigend für jede Kurvenform × jede Rarity ───────────────────────────
  it("is monotone non-increasing for every shape and every rarity (no tanking incentive)", () => {
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      for (const rarity of SPONSOR_RARITY_KEYS) {
        for (let rank = 1; rank < 32; rank += 1) {
          const better = getSponsorCurveShapePayout(rank, 1, rarity, shape, SPONSOR_BASE_FLOOR_C);
          const worse = getSponsorCurveShapePayout(rank + 1, 1, rarity, shape, SPONSOR_BASE_FLOOR_C);
          expect(better).toBeGreaterThanOrEqual(worse);
        }
      }
    }
  });

  // ── Punkt 4: Envelope-Grenze (keine Inflation) ──────────────────────────────────────────────────
  it("caps the max Platz-1 payout so the top is not inflated (no runaway ceiling)", () => {
    const maxP1Legendary = Math.max(
      ...SPONSOR_CURVE_SHAPE_KEYS.map((shape) => getSponsorCurveShapePayout(1, 1, "legendär", shape, SPONSOR_BASE_FLOOR_C)),
    );
    const maxP1Common = Math.max(
      ...SPONSOR_CURVE_SHAPE_KEYS.map((shape) => getSponsorCurveShapePayout(1, 1, "gewöhnlich", shape, SPONSOR_BASE_FLOOR_C)),
    );
    // legendär Platz 1 bleibt ≤ ~100 C (bestehende globale Decke ~94.8; ≤ ~1.06× bei diesen Faktoren).
    expect(maxP1Legendary).toBeLessThanOrEqual(100);
    expect(maxP1Legendary).toBeLessThanOrEqual(94.8 * 1.15);
    // gewöhnlich Platz 1 bleibt ≤ ~80 C.
    expect(maxP1Common).toBeLessThanOrEqual(80);
  });

  // ── Punkt 5: gehaltsgeankert (salaryFactor bleibt der dominante Skalierer) ───────────────────────
  it("stays salary-anchored: the salary factor is the dominant scaler, never an absurd multiple", () => {
    for (const shape of ["titeljaeger", "sicherheit"] as SponsorCurveShape[]) {
      const full = getSponsorCurveShapePayout(1, 1.0, "legendär", shape, SPONSOR_BASE_FLOOR_C);
      const half = getSponsorCurveShapePayout(1, 0.5, "legendär", shape, SPONSOR_BASE_FLOOR_C);
      const quarter = getSponsorCurveShapePayout(1, 0.25, "legendär", shape, SPONSOR_BASE_FLOOR_C);

      expect(half).toBeLessThan(full);
      expect(quarter).toBeLessThan(half);
      // sf 0.5 → grob die Hälfte, sf 0.25 → grob ein Viertel (der flache Gebäude-Offset hebt die Böden leicht an).
      expect(half / full).toBeGreaterThan(0.5);
      expect(half / full).toBeLessThan(0.62);
      expect(quarter / full).toBeGreaterThan(0.3);
      expect(quarter / full).toBeLessThan(0.42);
      // Ein legendärer Sponsor bei sf 0.25 zahlt an Platz 1 eine kleine Zahl — nie ein absurdes Vielfaches.
      expect(quarter).toBeLessThanOrEqual(35);
    }

    // Der Gehalts-Faktor-Schwung (full vs quarter ≈ 3×) dominiert den Rarity-Schwung (legendär vs gewöhnlich).
    const shape: SponsorCurveShape = "titeljaeger";
    const salarySwing =
      getSponsorCurveShapePayout(1, 1.0, "legendär", shape, SPONSOR_BASE_FLOOR_C) /
      getSponsorCurveShapePayout(1, 0.25, "legendär", shape, SPONSOR_BASE_FLOOR_C);
    const raritySwing =
      getSponsorCurveShapePayout(1, 1.0, "legendär", shape, SPONSOR_BASE_FLOOR_C) /
      getSponsorCurveShapePayout(1, 1.0, "gewöhnlich", shape, SPONSOR_BASE_FLOOR_C);
    expect(salarySwing).toBeGreaterThan(raritySwing);
  });

  // ── Punkt 6: keine strikte Pareto-Dominanz ──────────────────────────────────────────────────────
  it("has no shape that Pareto-dominates another at all 32 ranks (each owns a unique win-band)", () => {
    const payoutTable = new Map<SponsorCurveShape, number[]>();
    for (const shape of SPONSOR_CURVE_SHAPE_KEYS) {
      payoutTable.set(
        shape,
        Array.from({ length: 32 }, (_, i) => getSponsorCurveShapePayout(i + 1, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C)),
      );
    }
    for (const a of SPONSOR_CURVE_SHAPE_KEYS) {
      for (const b of SPONSOR_CURVE_SHAPE_KEYS) {
        if (a === b) {
          continue;
        }
        const rowA = payoutTable.get(a)!;
        const rowB = payoutTable.get(b)!;
        const aDominatesB = rowA.every((value, i) => value >= rowB[i]! - 1e-9);
        // Keine Kurvenform ist an ALLEN 32 Rängen ≥ einer anderen — jede hat ein eigenes Schwäche-Band.
        expect(aDominatesB).toBe(false);
      }
    }
  });

  // ── Punkt 7: Golden hebt nur den Rang-Anteil, senkt nie den Sockel, gedeckelt ────────────────────
  it("golden raises only the above-floor rank portion, never lowers the floor, and is capped", () => {
    for (const shape of ["titeljaeger", "europapokal", "sicherheit"] as SponsorCurveShape[]) {
      const base1 = getSponsorCurveShapePayout(1, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C, undefined, false);
      const gold1 = getSponsorCurveShapePayout(1, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C, undefined, true);
      const base32 = getSponsorCurveShapePayout(32, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C, undefined, false);
      const gold32 = getSponsorCurveShapePayout(32, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C, undefined, true);

      // Rang-Anteil steigt (Platz 1 hat Upside über dem Sockel).
      expect(gold1).toBeGreaterThan(base1);
      // Der garantierte Sockel (Platz 32 = reiner Boden) bleibt unangetastet.
      expect(gold32).toBe(base32);
      // Golden senkt an keinem Rang die Auszahlung.
      for (let rank = 1; rank <= 32; rank += 1) {
        const plain = getSponsorCurveShapePayout(rank, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C, undefined, false);
        const golden = getSponsorCurveShapePayout(rank, 1, "magisch", shape, SPONSOR_BASE_FLOOR_C, undefined, true);
        expect(golden).toBeGreaterThanOrEqual(plain);
      }
      // Gedeckelt: der Golden-Zuschlag übersteigt nie SPONSOR_GOLDEN_MS_ABS_CAP_C × salaryFactor.
      expect(gold1 - base1).toBeLessThanOrEqual(SPONSOR_GOLDEN_MS_ABS_CAP_C + 0.05);
    }
  });

  // ── Punkt 8 (Ausschnitt): der neue LOCKED-Ladder-Builder nutzt bei rarity+curveShape den Kurven-Pfad ──
  it("builds the locked rank-payout ladder from the curve path when rarity + curveShape are given", () => {
    const ladder = buildLockedRankPayoutLadder({
      salaryFactor: 1,
      leagueMinSalary: SPONSOR_BASE_FLOOR_C,
      rarity: "magisch",
      curveShape: "sicherheit",
    });
    expect(ladder).toHaveLength(32);
    // == direkter Kurven-Payout (kein Legacy-Stern-Pfad)
    for (const rank of [1, 8, 16, 28, 32]) {
      expect(ladder[rank - 1]).toBe(getSponsorCurveShapePayout(rank, 1, "magisch", "sicherheit", SPONSOR_BASE_FLOOR_C));
    }
    // monoton, Platz 1 > Platz 32
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i - 1]!).toBeGreaterThanOrEqual(ladder[i]!);
    }
    expect(ladder[0]!).toBeGreaterThan(ladder[31]!);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Punkt 8: WEITERHIN GÜLTIGES Verhalten — portiert, nicht gelöscht.
// Gehalts-Anker, gelockte Leiter (Freeze am Abschluss), Back-Compat, Vertragslaufzeit, Monotonie,
// exakt 0 ohne Meilenstein/am Sockel, Verhandlungsprofile.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe("sponsor economy balance (preserved invariants)", () => {
  it("scales sponsor economy anchors with salary factor", () => {
    const leagueMin = 38;
    const low = resolveSponsorEconomyAnchors(0.9, leagueMin);
    const high = resolveSponsorEconomyAnchors(1.21, leagueMin);

    expect(high.effectiveBaseFloor / low.effectiveBaseFloor).toBeGreaterThan(1.15);
    expect(high.effectiveBaseFloor / low.effectiveBaseFloor).toBeLessThan(1.55);
    expect(high.milestonePool).toBeGreaterThanOrEqual(low.milestonePool);
  });

  it("anchors rank-32 base to fourth-lowest salary minus buffer", () => {
    const gameState = createSingleplayerGameState();
    const fourthLowest = getLeagueFourthFromLowestSalaryTotal(gameState);
    const anchor = getSponsorRank32BaseAnchorSalary(gameState);
    // Der gehaltsgeankerte Rang-32-Sockel bleibt der Gehalts-basierte Anker (4.-niedrigstes Gehalt − Buffer),
    // mindestens der statische Floor.
    expect(anchor).toBeGreaterThanOrEqual(fourthLowest - SPONSOR_BASE_SALARY_BUFFER_C - 0.1);
    expect(anchor).toBeGreaterThanOrEqual(SPONSOR_BASE_FLOOR_C);
  }, 180000);

  it("applies Gewinnstufen milestone bonuses cumulatively", () => {
    expect(getRankMilestoneBonus(32, 1)).toBe(0);
    expect(getRankMilestoneBonus(28, 1)).toBe(7);
    expect(getRankMilestoneBonus(24, 1)).toBe(12);
    expect(getRankMilestoneBonus(1, 1)).toBe(63);
    expect(getSponsorPayoutForFinalRank(32, 1)).toBe(SPONSOR_BASE_FLOOR_C);
    expect(getSponsorPayoutForFinalRank(28, 1)).toBe(SPONSOR_BASE_FLOOR_C + 7);
    expect(getSponsorPayoutForFinalRank(1, 1)).toBe(SPONSOR_BASE_FLOOR_C + 63);
  });

  it("supports bottom-budget teams with meaningful sponsor income in singleplayer seed", () => {
    let gameState = createSingleplayerGameState();
    const bottomTeam = [...gameState.teams].sort((left, right) => left.budget - right.budget)[0]!;
    const rank = 20;
    gameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        standings: {
          ...gameState.seasonState.standings,
          [bottomTeam.teamId]: { points: 40, rank, startplatz: rank },
        },
        seasonEconomyFactors: [
          {
            seasonId: gameState.season.id,
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: 1,
            source: "sheet_seed",
          },
        ],
      },
    };

    const settled = runSingleTeamSettlement(gameState, bottomTeam.teamId);
    const payout = teamSeasonSponsorPayout(settled, gameState.season.id, bottomTeam.teamId);
    const leagueMin = getSponsorRank32BaseAnchorSalary(gameState);

    expect(payout).toBeGreaterThanOrEqual(leagueMin * 0.95);
  }, 60000);

  it("always signs single-season contracts even when a longer term is requested", () => {
    const gameState = buildLeagueGameState(1.0);
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const withOffers: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { [teamId]: offers },
      },
    };

    const result = chooseSponsorOffer({
      gameState: withOffers,
      teamId,
      offerId: offers[0]!.offerId,
      termSeasons: 3,
    });

    expect(result.contract?.termSeasons).toBe(1);
    expect(result.contract?.seasonsRemaining).toBe(1);
  }, 15000);

  it("expires sponsor contracts after one season", () => {
    const gameState = buildLeagueGameState(1.0);
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const signed = chooseSponsorOffer({
      gameState: {
        ...gameState,
        seasonState: {
          ...gameState.seasonState,
          sponsorOffersByTeamId: { [teamId]: offers },
        },
      },
      teamId,
      offerId: offers[0]!.offerId,
    }).gameState;

    const advanced = advanceSponsorContractsForNewSeason(
      {
        ...signed,
        season: { ...signed.season, id: "season-3" },
      },
      "season-3",
    );

    expect(getTeamSponsorContract(advanced, teamId)).toBeNull();
  }, 15000);

  // ── Payouts FIXED AT SIGNING: gelockte Rang-Leiter (Sponsor-Settlement-Korrektheit) ────────────
  //
  // Owner-Vorgabe: die Auszahlungen werden BEIM ABSCHLUSS eingefroren und am Saisonende sauber ausgezahlt —
  // sie dürfen sich über die Saison nicht mehr ändern. Die Leiter wird jetzt aus rarity + curveShape (neuer
  // Kurven-Payout) gebaut; das Settlement liest sie am erreichten Endrang ab, statt die Kurve aus den
  // (gedrifteten) Season-End-Ankern + salaryFactor neu abzuleiten.

  function signContract(signFactor: number, teamId: string): GameState {
    const gs = buildLeagueGameState(signFactor);
    const offers = buildSponsorOffersForTeam({ gameState: gs, teamId });
    const chosen = offers.find((offer) => offer.archetype === "security") ?? offers[0]!;
    return chooseSponsorOffer({
      gameState: {
        ...gs,
        seasonState: { ...gs.seasonState, sponsorOffersByTeamId: { [teamId]: offers } },
      },
      teamId,
      offerId: chosen.offerId,
    }).gameState;
  }

  // Ersetzt die im Vertrag gespeicherte gelockte Leiter durch eine kontrolliert aus (rarity, curveShape)
  // gebaute — so sind die shape-abhängigen Assertions deterministisch (unabhängig vom Angebots-Slate-Wurf).
  function withLockedLadder(
    signedGs: GameState,
    teamId: string,
    ladder: number[],
    salaryFactorAtSign = 1,
  ): GameState {
    const contract = getTeamSponsorContract(signedGs, teamId)!;
    return {
      ...signedGs,
      seasonState: {
        ...signedGs.seasonState,
        sponsorContractsByTeamId: {
          ...signedGs.seasonState.sponsorContractsByTeamId,
          [teamId]: { ...contract, lockedRankPayoutLadder: ladder, salaryFactorAtSign },
        },
      },
    };
  }

  function rankRowAt(signedGs: GameState, teamId: string, finalRank: number, settlementFactor: number) {
    const gs: GameState = {
      ...signedGs,
      seasonState: {
        ...signedGs.seasonState,
        standings: {
          ...signedGs.seasonState.standings,
          [teamId]: { points: 50, rank: finalRank, startplatz: 16 },
        },
        seasonEconomyFactors: [
          {
            seasonId: signedGs.season.id,
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: settlementFactor,
            source: "sheet_seed",
          },
        ],
      },
    };
    const preview = previewSponsorSettlement(gs, "season_end");
    return preview.rows.find((row) => row.teamId === teamId && row.kind === "rank") ?? null;
  }

  it("stores a locked rank-payout ladder at signing (built via the curve path)", () => {
    const teamId = "T-05";
    const signed = signContract(1.0, teamId);
    const contract = getTeamSponsorContract(signed, teamId)!;
    expect(contract.lockedRankPayoutLadder).toBeDefined();
    expect(contract.lockedRankPayoutLadder).toHaveLength(32);
    expect(contract.salaryFactorAtSign).toBe(1.0);
    // Monoton: besserer Endrang ⇒ nie weniger Gesamt-Payout. Rang 32 (Index 31) = reiner Sockel.
    const ladder = contract.lockedRankPayoutLadder!;
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i - 1]).toBeGreaterThanOrEqual(ladder[i]!);
    }
    expect(ladder[0]).toBeGreaterThan(ladder[31]!); // Rang 1 > Rang 32
  }, 15000);

  it("pays the LOCKED schedule even when the settlement-time salary factor drifts", () => {
    const teamId = "T-05";
    const signed = signContract(1.0, teamId);

    // Gleicher Endrang, aber der Settlement-Faktor driftet von 1.0 (Sign) auf 1.3 hoch bzw. 0.8 runter.
    for (const finalRank of [4, 8, 16, 24]) {
      const atSignFactor = rankRowAt(signed, teamId, finalRank, 1.0);
      const atDriftedUp = rankRowAt(signed, teamId, finalRank, 1.3);
      const atDriftedDown = rankRowAt(signed, teamId, finalRank, 0.8);
      // Der gelockte Payout ist unabhängig vom Season-End-Faktor: byte-identisch.
      expect(atDriftedUp?.cashDelta).toBe(atSignFactor?.cashDelta);
      expect(atDriftedDown?.cashDelta).toBe(atSignFactor?.cashDelta);
    }

    // Und er entspricht exakt der gespeicherten Leiter: Payout(Rang) = ladder[rank] − ladder[32-Sockel].
    const ladder = getTeamSponsorContract(signed, teamId)!.lockedRankPayoutLadder!;
    for (const finalRank of [4, 8, 16, 24]) {
      const expected = Number(Math.max(0, ladder[finalRank - 1]! - ladder[31]!).toFixed(1));
      expect(rankRowAt(signed, teamId, finalRank, 1.0)?.cashDelta).toBe(expected);
    }
  }, 20000);

  it("keeps rank payouts monotone and pays exactly 0 when no milestone is unlocked", () => {
    const teamId = "T-05";
    // Deterministische Kurvenform mit klarer Sockel-Zone (Rang 29–32 gleich) UND einem Sprung an Rang 28.
    const ladder = buildLockedRankPayoutLadder({
      salaryFactor: 1,
      leagueMinSalary: SPONSOR_BASE_FLOOR_C,
      rarity: "magisch",
      curveShape: "sicherheit",
    });
    const signed = withLockedLadder(signContract(1.0, teamId), teamId, ladder, 1.0);

    const ranks = [1, 4, 8, 12, 16, 20, 24, 28, 29, 30, 31, 32];
    const payouts = ranks.map((rank) => rankRowAt(signed, teamId, rank, 1.0)?.cashDelta ?? 0);

    // Monoton: ein besserer Endrang zahlt nie weniger als ein schlechterer.
    for (let i = 1; i < payouts.length; i += 1) {
      expect(payouts[i - 1]!).toBeGreaterThanOrEqual(payouts[i]!);
    }

    // Rang 29-32 schalten keine Gewinnstufe frei (Sockel-Zone) ⇒ 0 Cash, kein Selbstwiderspruch.
    for (const finalRank of [29, 30, 31, 32]) {
      const row = rankRowAt(signed, teamId, finalRank, 1.0);
      expect(row?.cashDelta).toBe(0);
      expect(row?.status).not.toBe("paid");
      expect(row?.reason).not.toMatch(/\+[1-9]/); // kein "(+N C Stufen)" bei 0 freigeschalteten Stufen
    }
    // Rang 28 (erste freigeschaltete Stufe / erster Sprung über dem Sockel) zahlt bereits > 0.
    expect(rankRowAt(signed, teamId, 28, 1.0)?.cashDelta).toBeGreaterThan(0);
  }, 20000);

  it("pays from the STORED ladder, so later curve-constant changes never touch a signed contract", () => {
    const teamId = "T-05";
    const signed = signContract(1.0, teamId);

    // Simuliert eine SPÄTERE Kurven-Konstanten-Änderung, indem die im Vertrag GESPEICHERTE Leiter durch
    // kontrollierte Sentinel-Werte ersetzt wird. Zahlt das Settlement daraus (statt aus einer Neuableitung),
    // ist der Vertrag gegen Kurvenänderungen immun.
    const sentinelLadder = Array.from({ length: 32 }, (_, index) => 40 + (32 - (index + 1))); // Rang 1 = 71 … Rang 32 = 40
    const withSentinel = withLockedLadder(signed, teamId, sentinelLadder, 1.0);

    // ladder[rank] − ladder[32-Sockel=40]: Rang 8 → (40 + 24) − 40 = 24.
    expect(rankRowAt(withSentinel, teamId, 8, 1.0)?.cashDelta).toBe(24);
    expect(rankRowAt(withSentinel, teamId, 1, 1.0)?.cashDelta).toBe(31);
    expect(rankRowAt(withSentinel, teamId, 32, 1.0)?.cashDelta).toBe(0);
  }, 15000);

  it("falls back to the season-end derivation for legacy contracts without a locked ladder (back-compat)", () => {
    const teamId = "T-05";
    const signed = signContract(1.0, teamId);
    const contract = getTeamSponsorContract(signed, teamId)!;
    // Echte Altsave-Simulation: Vertrag OHNE gelockte Leiter UND ohne rarity/curveShape ⇒ das Settlement fällt
    // auf die Legacy-Season-End-Ableitung (Stern/Archetyp) zurück.
    const {
      lockedRankPayoutLadder: _dropped,
      salaryFactorAtSign: _dropped2,
      rarity: _dropped3,
      curveShape: _dropped4,
      ...legacyContract
    } = contract;
    const legacy: GameState = {
      ...signed,
      seasonState: {
        ...signed.seasonState,
        sponsorContractsByTeamId: {
          ...signed.seasonState.sponsorContractsByTeamId,
          [teamId]: legacyContract,
        },
      },
    };
    // Kein Throw, Payout bleibt plausibel und monoton (guter Endrang ≥ Sockelrang ≥ 0).
    const top = rankRowAt(legacy, teamId, 8, 1.0)?.cashDelta ?? -1;
    const floor = rankRowAt(legacy, teamId, 32, 1.0)?.cashDelta ?? -1;
    expect(top).toBeGreaterThan(0);
    expect(floor).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(floor);
  }, 15000);

});
