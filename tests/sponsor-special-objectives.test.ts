import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  computeTransferWindowNet,
  getTeamAxisRank,
  parseAxisTargetValue,
  resolveChallengeSlotIndex,
} from "@/lib/sponsor/sponsor-special-objectives";
import { mapSponsorCardToArchetype } from "@/lib/sponsor/sponsor-tier-pool";
import { SPONSOR_V4_AXIS_KEYS } from "@/lib/sponsor/sponsor-v3-model";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
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

/**
 * DIE ERZEUGUNGSSEITE DER 27 BONUS- UND 6 GOLDEN-ZIELE IST ENTFERNT (2026-08, siehe Kopf-Kommentar in
 * sponsor-special-objectives.ts) — Kein Test hier baut also mehr ueber `buildBonusObjectiveComponent`
 * o.ae. Was von dieser Datei bleibt, testet die AUSWERTUNGSSEITE (`sponsor-objective-evaluator.ts`,
 * bleibt vollstaendig fuer bestehende Vertraege) und die weiterhin gebrauchten Achsen-Bausteine. Wo ein
 * Test vorher eine Komponente ueber die entfernte Erzeugung baute, baut er sie jetzt direkt als Literal
 * — exakt in der Form, die die Erzeugung frueher lieferte, damit die Evaluator-Zusicherung unveraendert
 * bleibt.
 */

describe("sponsor special objectives", () => {
  it("offers exactly one challenge sponsor among the slate", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((entry) => entry.shortCode === "R-R")?.teamId ?? gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const challengeOffers = offers.filter((offer) => offer.isChallengeOffer === true);
    // DREI statt fuenf seit dem Gebäude-Schalter (SLOT_COUNT in sponsor-offer-service.ts). Der
    // Challenge-Slot rechnet ohnehin relativ — er wird unter den ZIELKARTEN gezogen, nicht unter
    // allen Plaetzen —, deshalb bleibt „genau einer" die Zusage, die hier zaehlt.
    expect(offers).toHaveLength(3);
    expect(challengeOffers).toHaveLength(1);
    const slot = resolveChallengeSlotIndex(gameState.season.id, teamId, offers.length);
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThan(offers.length);
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

  it("achse-Karten bedienen alle drei Archetyp-Eimer (performance/identity/security)", () => {
    // Frueher ein Nebenbefund im Golden-Picker-Test (entfernt); die Zusicherung selbst haengt nicht an
    // der entfernten Golden-Auswahl, sondern an `mapSponsorCardToArchetype` (sponsor-tier-pool.ts,
    // unveraendert) — seit V4 unterscheiden sich die Karten ueber die ACHSE statt ueber ein
    // Risikoprofil, und alle drei Eimer muessen ueber die vier Achsen weiterhin erreichbar bleiben.
    const buckets = new Set(SPONSOR_V4_AXIS_KEYS.map((key) => mapSponsorCardToArchetype("achse", key)));
    expect([...buckets].sort()).toEqual(["identity", "performance", "security"]);
  });

  it("parses an encoded axis target value back into axis + top rank", () => {
    expect(parseAxisTargetValue("men:7")).toEqual({ axis: "men", topRank: 7 });
    expect(parseAxisTargetValue("nonsense")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TEIL B — Auswertung bestehender Alt-Ziel-Vertraege (staged / spotlightBonus-Framework).
//
// Die Komponenten unten sind Literale, keine Erzeugnisse eines Katalogs — der Katalog ist entfernt
// (siehe Datei-Kopf). Sie spiegeln exakt die Form, die die frueheren Bauer-Funktionen lieferten, weil
// genau diese Form in bestehenden Spielstaenden liegt und `evaluateSpecialComponentStage` sie lesen
// koennen muss.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

function setRank(gs: GameState, teamId: string, rank: number) {
  gs.seasonState.standings = {
    ...(gs.seasonState.standings ?? {}),
    [teamId]: { ...((gs.seasonState.standings ?? {})[teamId] ?? {}), rank, startplatz: rank, points: 100 - rank },
  } as GameState["seasonState"]["standings"];
}

describe("sponsor bonus objectives — Auswertung bestehender Alt-Vertraege", () => {
  it("returns null for debt_payoff when no debt exists (kein Gratis-Fortschritt)", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    // Kein Kredit → eingefrorene Baseline 0 (so baute buildBonusObjectiveComponent sie frueher auch:
    // die Summe der aktiven Kredite beim Signing, hier 0).
    const debt: SponsorOfferComponent = {
      componentId: "special-debt-payoff",
      kind: "special",
      label: "Schuldenfrei (Kredite tilgen)",
      targetValue: "debtbase:0",
      rewardCash: 5,
      specialKey: "debt_payoff",
    };
    expect(computeObjectiveProgressMetric(gs, teamId, debt)).toBeNull();
  }, 60000);

  it("evaluates the underdog-story ladder as achieved stage fraction", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const rows = buildTeamSeasonOverviewRows({ gameState: gs });
    const rowsByTeamId = new Map(rows.map((r) => [r.teamId, r] as const));
    const expected = computeTeamExpectation({ row: rowsByTeamId.get(teamId)!, rowsByTeamId, identity: null }).expectedRank;
    setRank(gs, teamId, Math.max(1, expected - 6));
    const comp: SponsorOfferComponent = {
      componentId: "special-underdog-story",
      kind: "special",
      label: "Underdog-Story (über Erwartung abschneiden)",
      targetValue: "underdog",
      rewardCash: 5,
      specialKey: "underdog_story",
      stages: [
        { threshold: 3, fraction: 0.4, label: "+3" },
        { threshold: 6, fraction: 0.7, label: "+6" },
        { threshold: 9, fraction: 1.0, label: "+9" },
      ],
    };
    const res = evaluateSpecialComponentStage(gs, teamId, comp);
    expect(res.metric).toBe(expected - Math.max(1, expected - 6));
    expect(res.fraction).toBeCloseTo(0.7, 5); // +6 → mittlere Stufe
  }, 60000);

  it("cellar_escape: invertierter Endrang, erste Stufe = raus aus Bottom-5", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const teamCount = gs.teams.length;
    const inv = (rank: number) => teamCount - rank + 1;
    setRank(gs, teamId, teamCount - 5); // Endrang: gerade aus der Kellerzone heraus
    gs.seasonState.standings![teamId]!.startplatz = teamCount; // Start im Keller (Bottom-5) → echter Aufstieg
    const comp: SponsorOfferComponent = {
      componentId: "special-cellar-escape",
      kind: "special",
      label: "Kellerkind-Aufstieg",
      targetValue: "cellar",
      rewardCash: 5,
      specialKey: "cellar_escape",
      stages: [
        { threshold: inv(teamCount - 5), fraction: 0.4, label: "raus aus Bottom-5" },
        { threshold: inv(teamCount - 11), fraction: 0.7, label: `≤ Rang ${teamCount - 11}` },
        { threshold: inv(teamCount - 16), fraction: 1.0, label: `≤ Rang ${teamCount - 16}` },
      ],
    };
    const res = evaluateSpecialComponentStage(gs, teamId, comp);
    expect(res.metric).toBe(teamCount - (teamCount - 5) + 1); // = 6 (invertierter Rang)
    expect(res.fraction).toBeCloseTo(0.4, 5); // erste Stufe
  }, 60000);

  it("cellar_escape: kein Bonus, wenn das Team nie im Keller startete", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const teamCount = gs.teams.length;
    const inv = (rank: number) => teamCount - rank + 1;
    setRank(gs, teamId, teamCount - 5); // guter Endrang (raus aus Bottom-5) …
    gs.seasonState.standings![teamId]!.startplatz = teamCount - 10; // … aber Start deutlich über der Kellerzone
    const comp: SponsorOfferComponent = {
      componentId: "special-cellar-escape",
      kind: "special",
      label: "Kellerkind-Aufstieg",
      targetValue: "cellar",
      rewardCash: 5,
      specialKey: "cellar_escape",
      stages: [
        { threshold: inv(teamCount - 5), fraction: 0.4, label: "raus aus Bottom-5" },
        { threshold: inv(teamCount - 11), fraction: 0.7, label: `≤ Rang ${teamCount - 11}` },
        { threshold: inv(teamCount - 16), fraction: 1.0, label: `≤ Rang ${teamCount - 16}` },
      ],
    };
    const res = evaluateSpecialComponentStage(gs, teamId, comp);
    expect(res.metric).toBe(0); // Kellerkind-Bedingung nicht erfüllt → keine Auszahlung
    expect(res.fraction).toBeCloseTo(0, 5);
  }, 60000);

  it("budget_overachiever: zahlt nur unter dem Kaderwert-Deckel", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const teamCount = gs.teams.length;
    setRank(gs, teamId, 8);
    const base: SponsorOfferComponent = {
      componentId: "special-budget-overachiever",
      kind: "special",
      label: "Über Verhältnisse",
      targetValue: "mwcap:0",
      rewardCash: 5,
      specialKey: "budget_overachiever",
    };
    // Deckel sehr hoch → unter Deckel → invertierter Endrang zählt.
    const under: SponsorOfferComponent = { ...base, targetValue: "mwcap:9999999" };
    expect(computeObjectiveProgressMetric(gs, teamId, under)).toBe(teamCount - 8 + 1);
    // Deckel praktisch 0 → Kaderwert sprengt Deckel → kein Bonus.
    const over: SponsorOfferComponent = { ...base, targetValue: "mwcap:0.01" };
    expect(computeObjectiveProgressMetric(gs, teamId, over)).toBe(0);
  }, 60000);

  it("windows transfer-trader net to the season", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const seasonId = gs.season.id;
    gs.transferHistory = [
      { id: "s1", playerId: "p1", seasonId, transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 30, netCashImpact: 25 },
      { id: "b1", playerId: "p2", seasonId, transferType: "buy", fromTeamId: null, toTeamId: teamId, fee: 10, netCashImpact: 10 },
      { id: "x", playerId: "p3", seasonId: "season-99", transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 999 },
    ] as never;
    expect(computeTransferWindowNet(gs, teamId, seasonId)).toBe(15);
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

    // Neufassung "Selbsttragend": Metrik = Deckungsgrad Einnahmen/Unterhalt in % (beliebtheits-skaliert).
    const expectedCoverage = upkeep > 0 ? (100 * incomeWithPopularity) / upkeep : incomeWithPopularity > 0 ? 100 : 0;
    expect(metric).toBeCloseTo(expectedCoverage, 5);
    // Der Beliebtheitsfaktor wirkt: 1.5 > 1.0 hebt die Einnahme und damit den Deckungsgrad über den naiven Wert.
    expect(incomeWithPopularity).toBeGreaterThan(incomeNaive);
    const naiveCoverage = upkeep > 0 ? (100 * incomeNaive) / upkeep : incomeNaive > 0 ? 100 : 0;
    expect(metric).not.toBeCloseTo(naiveCoverage, 5);
  }, 60000);

  it("returns null for sustainability_architect when no income buildings are built (no free payout)", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    gs.seasonState.teamFacilities = { ...(gs.seasonState.teamFacilities ?? {}), [teamId]: { facilities: {} } } as never;
    const comp: SponsorOfferComponent = {
      componentId: "special-sustainability",
      kind: "special",
      label: "Sustainability Architect",
      targetValue: "self_supporting",
      rewardCash: 5,
      specialKey: "sustainability_architect",
    };
    expect(computeObjectiveProgressMetric(gs, teamId, comp)).toBeNull();
  }, 60000);

  it("gates golden title-shock to weak teams only", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    setRank(gs, teamId, 1);
    const goldenTitleShock = (teamQualityRank: number): SponsorOfferComponent => ({
      componentId: "special-golden-title-shock",
      kind: "special",
      label: "Der Titel-Schock (schwaches Team, ganz nach oben)",
      targetValue: `title_shock:${Math.round(teamQualityRank)}`,
      rewardCash: 5,
      specialKey: "golden_title_shock",
      stages: [
        { threshold: 1, fraction: 0.5, label: "Top-3" },
        { threshold: 2, fraction: 0.75, label: "Top-2" },
        { threshold: 3, fraction: 1.0, label: "Meister" },
      ],
    });
    const weak = evaluateSpecialComponentStage(gs, teamId, goldenTitleShock(30));
    const strong = evaluateSpecialComponentStage(gs, teamId, goldenTitleShock(3));
    expect(weak.fraction).toBeCloseTo(1, 5); // schwaches Team, Meister
    expect(strong.fraction).toBe(0); // starkes Team nicht eignungsberechtigt
  }, 60000);
});
