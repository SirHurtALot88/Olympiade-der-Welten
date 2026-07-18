import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildBonusObjectiveComponent,
  buildChallengeSpecialComponent,
  buildGoldenObjectiveComponent,
  buildStandardSpecialComponent,
  computeTransferWindowNet,
  getAvailableBonusObjectiveKeys,
  getTeamAxisRank,
  isTransferTraderAvailableForSeason,
  parseAxisTargetValue,
  pickGoldenObjective,
  resolveChallengeSlotIndex,
  resolveRealisticAxisTargetRank,
  SPONSOR_BONUS_OBJECTIVE_ARCHETYPE,
  SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE,
  type SponsorGoldenObjectiveKey,
} from "@/lib/sponsor/sponsor-special-objectives";
import { mapCurveShapeToArchetype } from "@/lib/sponsor/sponsor-tier-pool";
import type { SponsorArchetype, SponsorCurveShape } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  computeLeagueSpotlightDeltas,
  type TeamSpotlightSignals,
} from "@/lib/economy/team-beliebtheit";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import {
  computeObjectiveProgressMetric,
  evaluateSpecialComponentForObjective,
  evaluateSpecialComponentStage,
} from "@/lib/sponsor/sponsor-objective-evaluator";
import {
  calculateFacilityIncome,
  calculateFacilityUpkeep,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import { SPONSOR_OBJ_FATIGUE_CAP } from "@/lib/sponsor/sponsor-special-objectives";
import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";

describe("sponsor special objectives", () => {
  it("never asks weak teams for unrealistic axis top-10 targets", () => {
    expect(resolveRealisticAxisTargetRank(28, 32)).toBeGreaterThanOrEqual(14);
    expect(resolveRealisticAxisTargetRank(28, 32)).toBeLessThanOrEqual(24);
    expect(resolveRealisticAxisTargetRank(15, 32)).toBeGreaterThan(10);
    expect(resolveRealisticAxisTargetRank(32, 32)).toBeGreaterThanOrEqual(24);
  }, 60000);

  it("builds W-W challenge on MEN with reachable target", () => {
    const gameState = createSingleplayerGameState();
    const team = gameState.teams.find((entry) => entry.shortCode === "W-W")!;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const profile = getTeamStrategyProfile(gameState, team.teamId);
    const rows = buildTeamSeasonOverviewRows({ gameState });
    const menRank = getTeamAxisRank(rows, team.teamId, "men", gameState);

    const component = buildChallengeSpecialComponent({
      gameState,
      team,
      identity,
      profile,
      rarity: "gewöhnlich",
      rewardCash: 4,
      seasonId: gameState.season.id,
    });

    if (component.specialKey === "axis_rank_top") {
      const parsed = parseAxisTargetValue(component.targetValue);
      expect(parsed?.axis).toBe("men");
      expect(parsed?.topRank ?? 99).toBeGreaterThan(10);
      if (menRank.rank != null) {
        expect(parsed?.topRank ?? 99).toBeLessThan(menRank.rank);
      }
    }
  }, 60000);

  it("offers exactly one challenge sponsor among five choices", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((entry) => entry.shortCode === "R-R")?.teamId ?? gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const challengeOffers = offers.filter((offer) => offer.isChallengeOffer === true);
    expect(offers).toHaveLength(5);
    expect(challengeOffers).toHaveLength(1);
    expect(resolveChallengeSlotIndex(gameState.season.id, teamId, offers.length)).toBeGreaterThanOrEqual(0);
    expect(resolveChallengeSlotIndex(gameState.season.id, teamId, offers.length)).toBeLessThanOrEqual(4);
  }, 180000);

  it("evaluates axis rank special against league axis ranks", () => {
    const gameState = createSingleplayerGameState();
    const team = gameState.teams.find((entry) => entry.shortCode === "M-M")!;
    const rows = buildTeamSeasonOverviewRows({ gameState });
    const powRank = getTeamAxisRank(rows, team.teamId, "pow", gameState).rank ?? 99;
    const status = evaluateSpecialComponentForObjective(gameState, team.teamId, {
      componentId: "special-axis-pow",
      kind: "special",
      label: "POW Top 3",
      targetValue: "pow:3",
      rewardCash: 4,
      specialKey: "axis_rank_top",
    });
    expect(status).toBe(powRank <= 3 ? "completed" : powRank <= 5 ? "at_risk" : "open");
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TEIL B — Sponsor-Bonusziele (staged / spotlightBonus-Framework)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

function setRank(gs: GameState, teamId: string, rank: number) {
  gs.seasonState.standings = {
    ...(gs.seasonState.standings ?? {}),
    [teamId]: { ...((gs.seasonState.standings ?? {})[teamId] ?? {}), rank, startplatz: rank, points: 100 - rank },
  } as GameState["seasonState"]["standings"];
}

function bonusInput(gs: GameState, teamId: string, overrides: Record<string, unknown> = {}) {
  const team = gs.teams.find((entry) => entry.teamId === teamId)!;
  return {
    gameState: gs,
    team,
    identity: gs.teamIdentities.find((entry) => entry.teamId === teamId) ?? null,
    profile: null,
    rewardCash: 5,
    rarity: "magisch" as const,
    seasonId: gs.season.id,
    ...overrides,
  };
}

describe("sponsor bonus objectives (Teil B)", () => {
  it("evaluates the underdog-story ladder as achieved stage fraction", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const rows = buildTeamSeasonOverviewRows({ gameState: gs });
    const rowsByTeamId = new Map(rows.map((r) => [r.teamId, r] as const));
    const expected = computeTeamExpectation({ row: rowsByTeamId.get(teamId)!, rowsByTeamId, identity: null }).expectedRank;
    setRank(gs, teamId, Math.max(1, expected - 6));
    const comp = buildBonusObjectiveComponent("underdog_story", bonusInput(gs, teamId) as never);
    const res = evaluateSpecialComponentStage(gs, teamId, comp);
    expect(res.metric).toBe(expected - Math.max(1, expected - 6));
    expect(res.fraction).toBeCloseTo(0.7, 5); // +6 → mittlere Stufe
  }, 60000);

  it("windows transfer-trader net to the season and excludes it in season 1", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const seasonId = gs.season.id;
    gs.transferHistory = [
      { id: "s1", playerId: "p1", seasonId, transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 30, netCashImpact: 25 },
      { id: "b1", playerId: "p2", seasonId, transferType: "buy", fromTeamId: null, toTeamId: teamId, fee: 10, netCashImpact: 10 },
      { id: "x", playerId: "p3", seasonId: "season-99", transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 999 },
    ] as never;
    expect(computeTransferWindowNet(gs, teamId, seasonId)).toBe(15);
    expect(isTransferTraderAvailableForSeason("season-1")).toBe(false);
    expect(isTransferTraderAvailableForSeason("season-2")).toBe(true);
    // Bucketing läuft über die Kurvenform-Familie: "sicherheit" → Familie sicherheit → security-Pool.
    expect(getAvailableBonusObjectiveKeys("sicherheit", "season-1")).not.toContain("transfer_trader");
    expect(getAvailableBonusObjectiveKeys("sicherheit", "season-2")).toContain("transfer_trader");
  }, 60000);

  it("keeps the objective spotlight league-centered (Σ ≈ 0)", () => {
    const teamCount = 12;
    const signals: TeamSpotlightSignals[] = Array.from({ length: teamCount }, (_, index) => ({
      teamId: `T${index}`,
      rosterSize: 8,
      finalRank: index + 1,
      expectedRank: index + 1,
      bracketHeroShare: 0,
      upsetRate: 0,
      historicalAvgRank: null,
      disciplineTop3Share: 0,
      fanFavoriteTerm: 0,
      objectiveSpotlight: index % 3 === 0 ? 1 : index % 3 === 1 ? 0.5 : 0,
    }));
    const deltas = computeLeagueSpotlightDeltas(signals);
    let sumObjective = 0;
    for (const result of deltas.values()) sumObjective += result.components.objective ?? 0;
    // Zentrierung exakt 0 vor Rundung; nur Rundungsdrift (≤ teamCount × 0.5e-4) bleibt.
    expect(Math.abs(sumObjective)).toBeLessThan(teamCount * 0.5e-4 + 1e-9);
  });

  it("separates golden objectives from the standard pool and picks them curve-family-consistently", () => {
    const goldenKeys = Object.keys(SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE) as SponsorGoldenObjectiveKey[];
    const stdKeys = Object.keys(SPONSOR_BONUS_OBJECTIVE_ARCHETYPE);
    expect(goldenKeys.some((k) => stdKeys.includes(k))).toBe(false);
    // Repräsentative Kurvenform je (Legacy-)Archetyp-Bucket: titel→performance, aufstieg→identity, sicherheit→security.
    const shapeByArchetype: Record<SponsorArchetype, SponsorCurveShape> = {
      performance: "titeljaeger",
      identity: "aufsteiger",
      security: "sicherheit",
    };
    for (const archetype of ["performance", "identity", "security"] as const) {
      const curveShape = shapeByArchetype[archetype];
      expect(mapCurveShapeToArchetype(curveShape)).toBe(archetype);
      const pick = pickGoldenObjective("season-4", "T-1", curveShape);
      expect(SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE[pick]).toBe(archetype);
      expect(pickGoldenObjective("season-4", "T-1", curveShape)).toBe(pick); // deterministisch
      expect(getAvailableBonusObjectiveKeys(curveShape, "season-4")).not.toContain(pick as never);
    }
  });

  it("scales standard special difficulty with rarity order and buckets bonus keys by curve family", () => {
    // Schwierigkeit skaliert mit der Rarity-Ordnung: gewöhnlich (order 0) fordert weniger als legendär (order 3).
    const easy = buildStandardSpecialComponent({ templateId: "transfer_profit_min", rarity: "gewöhnlich", rewardCash: 5 });
    const hard = buildStandardSpecialComponent({ templateId: "transfer_profit_min", rarity: "legendär", rewardCash: 5 });
    expect(Number(hard.targetValue)).toBeGreaterThan(Number(easy.targetValue));

    const discEasy = buildStandardSpecialComponent({ templateId: "discipline_top3_count", rarity: "gewöhnlich", rewardCash: 5 });
    const discHard = buildStandardSpecialComponent({ templateId: "discipline_top3_count", rarity: "legendär", rewardCash: 5 });
    expect(Number(discHard.targetValue)).toBeGreaterThan(Number(discEasy.targetValue));

    // Bucketing folgt der Kurvenform-Familie: zwei Formen derselben Familie ziehen den identischen Bonus-Pool,
    // eine Form einer anderen Familie einen disjunkten.
    const security1 = getAvailableBonusObjectiveKeys("sicherheit", "season-4"); // Familie sicherheit
    const security2 = getAvailableBonusObjectiveKeys("klassenerhalt", "season-4"); // gleiche Familie
    const performance = getAvailableBonusObjectiveKeys("titeljaeger", "season-4"); // Familie titel → performance
    expect([...security1].sort()).toEqual([...security2].sort());
    expect(security1.some((key) => performance.includes(key))).toBe(false);
    expect(performance.length).toBeGreaterThan(0);
  });

  it("measures fatigue_management against pure availability fatigue, not the training layer", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const rosterPlayerIds = gs.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
    expect(rosterPlayerIds.length).toBeGreaterThan(1);

    const comp: SponsorOfferComponent = {
      componentId: "special-fatigue",
      kind: "special",
      label: "Fatigue-Management",
      targetValue: SPONSOR_OBJ_FATIGUE_CAP,
      rewardCash: 5,
      specialKey: "fatigue_management",
    };

    // Fall 1: EIN Spieler trägt eine hohe Trainings-Fatigue-Schicht (player.fatigue weit über Cap),
    // aber seine reine Match-Fatigue (availability) liegt unter dem Cap. Er MUSS als frisch zählen.
    const highTrainingId = rosterPlayerIds[0]!;
    gs.seasonState.playerAvailabilityState = rosterPlayerIds.map((playerId) => ({
      playerId,
      teamId,
      fatigue: 5,
      injuryStatus: "healthy" as const,
    }));
    gs.players = gs.players.map((player) =>
      player.id === highTrainingId ? { ...player, fatigue: SPONSOR_OBJ_FATIGUE_CAP + 50 } : player,
    );
    const metricFresh = computeObjectiveProgressMetric(gs, teamId, comp);
    expect(metricFresh).toBe(100); // reine Match-Fatigue → gesamter Kader frisch

    // Fall 2: Umgekehrt — reine Match-Fatigue über Cap zählt NICHT als frisch, auch wenn
    // player.fatigue (Trainingsschicht) niedrig ist.
    gs.seasonState.playerAvailabilityState = rosterPlayerIds.map((playerId) => ({
      playerId,
      teamId,
      fatigue: playerId === highTrainingId ? SPONSOR_OBJ_FATIGUE_CAP + 10 : 5,
      injuryStatus: "healthy" as const,
    }));
    gs.players = gs.players.map((player) => (player.id === highTrainingId ? { ...player, fatigue: 0 } : player));
    const metricTired = computeObjectiveProgressMetric(gs, teamId, comp);
    expect(metricTired).toBeCloseTo((100 * (rosterPlayerIds.length - 1)) / rosterPlayerIds.length, 5);
  }, 60000);

  it("measures sustainability_architect income with the arena popularity factor", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;

    // Arena gebaut (Beliebtheit skaliert nur die Arena-Einnahme); Beliebtheit = 1.5 (Max).
    gs.seasonState.teamFacilities = {
      ...(gs.seasonState.teamFacilities ?? {}),
      [teamId]: {
        facilities: {
          arena_upgrade: { level: 5, enabled: true, conditionPct: 100 },
        },
      },
    } as never;
    gs.seasonState.beliebtheitByTeamId = {
      ...(gs.seasonState.beliebtheitByTeamId ?? {}),
      [teamId]: { value: 1.5 } as never,
    };

    const comp: SponsorOfferComponent = {
      componentId: "special-sustainability",
      kind: "special",
      label: "Sustainability Architect",
      targetValue: 5,
      rewardCash: 5,
      specialKey: "sustainability_architect",
    };

    const facilities = getTeamFacilityState(gs, teamId);
    const upkeep = calculateFacilityUpkeep(facilities);
    const incomeWithPopularity = calculateFacilityIncome(facilities, { arenaPopularityFactor: 1.5 });
    const incomeNaive = calculateFacilityIncome(facilities); // ohne Beliebtheitsfaktor (der alte Bug)

    const metric = computeObjectiveProgressMetric(gs, teamId, comp);

    // Ziel spiegelt exakt die tatsächlich gutgeschriebene, beliebtheits-skalierte Einnahme.
    expect(metric).toBeCloseTo(incomeWithPopularity - upkeep, 5);
    // Der Faktor wirkt wirklich: die Arena ist gebaut und 1.5 > 1.0 hebt die Einnahme über den naiven Wert.
    expect(incomeWithPopularity).toBeGreaterThan(incomeNaive);
    expect(metric).not.toBeCloseTo(incomeNaive - upkeep, 5);
  }, 60000);

  it("gates golden title-shock to weak teams only", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    setRank(gs, teamId, 1);
    const weak = evaluateSpecialComponentStage(
      gs,
      teamId,
      buildGoldenObjectiveComponent("golden_title_shock", bonusInput(gs, teamId, { teamQualityRank: 30 }) as never),
    );
    const strong = evaluateSpecialComponentStage(
      gs,
      teamId,
      buildGoldenObjectiveComponent("golden_title_shock", bonusInput(gs, teamId, { teamQualityRank: 3 }) as never),
    );
    expect(weak.fraction).toBeCloseTo(1, 5); // schwaches Team, Meister
    expect(strong.fraction).toBe(0); // starkes Team nicht eignungsberechtigt
  }, 60000);
});
