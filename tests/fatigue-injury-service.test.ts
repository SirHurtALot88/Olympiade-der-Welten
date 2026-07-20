import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import {
  applyFatigueAndInjuryAfterMatchday,
  BASE_MATCHDAY_RECOVERY,
  buildMatchdayInjuryRollMap,
  calculatePlayerRecovery,
  calculateTeamRecovery,
  getInjuryRiskBand,
  getInjuryRiskPercent,
  getPlayerAvailabilityView,
  injuryRiskBands,
  normalizeAvailabilityForNewSeason,
  rollInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import type { LegacyLineupContext } from "@/lib/lineups/legacy-lineup-types";

function findInjuredPlayerId(input: { saveId: string; seasonId: string; matchdayId: string }) {
  for (let index = 0; index < 1_000; index += 1) {
    const playerId = `injury-candidate-${index}`;
    const roll = rollInjuryRisk({ ...input, playerId, fatigueBefore: 95 });
    if (roll.result === "injured") {
      return playerId;
    }
  }
  throw new Error("No deterministic injury candidate found for test seed.");
}

function createGameState(playerId = "player-1", fatigue = 83): GameState {
  const draft: LineupDraft = {
    lineupId: "lineup-1",
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-1",
    teamId: "A-A",
    status: "submitted",
    entries: [
      {
        disciplineId: "tdm",
        disciplineSide: "d1",
        slotIndex: 1,
        playerId,
        activePlayerId: `active-${playerId}`,
      },
    ],
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
  };

  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      matchdayIds: ["md-1", "md-2", "md-3"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      lineupDrafts: [draft],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      teamFacilities: {
        "A-A": {
          facilities: {
            recovery_center: {
              level: 2,
              enabled: true,
            },
          },
        },
      },
    },
    matchdayState: {
      matchdayId: "md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      {
        teamId: "A-A",
        shortCode: "A-A",
        name: "Alpha",
        budget: 100,
        cash: 100,
        identityId: "identity-A",
        humanControlled: true,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [],
    players: [
      {
        id: playerId,
        name: "Risk Runner",
        className: "Runner",
        race: "Human",
        marketValue: 10,
        salary: 2,
        fatigue,
        attributes: {},
        disciplineRatings: {},
      },
    ],
    disciplines: [],
    rosters: [
      {
        teamId: "A-A",
        playerId,
        role: "core",
        joinedSeasonId: "season-1",
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-13T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("fatigue injury service", () => {
  it("uses the requested fatigue risk curve", () => {
    expect(injuryRiskBands.map((band) => band.label)).toEqual([
      "none",
      "minimal",
      "mittel",
      "stark",
      "sehr_stark",
    ]);
    expect(getInjuryRiskPercent(29)).toBe(4.83);
    expect(getInjuryRiskBand(29).label).toBe("none");
    expect(getInjuryRiskPercent(30)).toBe(5);
    expect(getInjuryRiskBand(30).label).toBe("minimal");
    expect(getInjuryRiskPercent(50)).toBe(10);
    expect(getInjuryRiskBand(50).label).toBe("mittel");
    expect(getInjuryRiskPercent(70)).toBe(20);
    expect(getInjuryRiskBand(70).label).toBe("stark");
    expect(getInjuryRiskPercent(85)).toBe(28.75);
    expect(getInjuryRiskBand(85).label).toBe("sehr_stark");
    expect(getInjuryRiskPercent(100)).toBe(40);
  });

  it("rolls injury risk deterministically from save, season, matchday and player", () => {
    const input = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      playerId: "player-1",
      fatigueBefore: 82,
    };

    expect(rollInjuryRisk(input)).toEqual(rollInjuryRisk(input));
    expect(rollInjuryRisk({ ...input, playerId: "player-2" }).roll).not.toBe(rollInjuryRisk(input).roll);
  });

  it("creates an injury event after real matchday apply, keeps the player rostered and blocks the next matchday", () => {
    const playerId = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-1" });
    const gameState = createGameState(playerId, 83);
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    expect(result.injuryEvents).toHaveLength(1);
    expect(result.injuryEvents[0]?.result).toBe("injured");
    expect(result.injuryEvents[0]?.unavailableUntil).toBe("md-2");
    expect(result.gameState.rosters.some((entry) => entry.playerId === playerId && entry.teamId === "A-A")).toBe(true);

    const nextMatchdayAvailability = getPlayerAvailabilityView(result.gameState, playerId, "A-A", "md-2");
    expect(nextMatchdayAvailability.isUnavailable).toBe(true);
    expect(nextMatchdayAvailability.blocker).toBe("player_injured_unavailable");

    const laterAvailability = getPlayerAvailabilityView(result.gameState, playerId, "A-A", "md-3");
    expect(laterAvailability.isUnavailable).toBe(false);
    expect(laterAvailability.injuryStatus).toBe("recovering");
  });

  it("keeps injured players available on the injury matchday but blocks the next matchday", () => {
    const playerId = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-1" });
    const gameState = createGameState(playerId, 83);
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    const injuryDayAvailability = getPlayerAvailabilityView(result.gameState, playerId, "A-A", "md-1");
    expect(injuryDayAvailability.isUnavailable).toBe(false);
    expect(injuryDayAvailability.injuryStatus).toBe("injured");
  });

  it("uses the same deterministic injury rolls for pre-match scoring and post-match state", () => {
    const playerId = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-1" });
    const gameState = createGameState(playerId, 83);
    const rollMap = buildMatchdayInjuryRollMap({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
    });
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
      precomputedInjuryRolls: rollMap,
    });

    expect(rollMap.get("A-A::" + playerId)?.result).toBe("injured");
    expect(result.injuryEvents[0]?.result).toBe("injured");
    expect(result.injuryEvents[0]?.roll).toBe(rollMap.get("A-A::" + playerId)?.roll);
  });

  it("supports an explicitly marked deterministic injury rehearsal mode without changing normal rates", () => {
    const gameState = createGameState("player-1", 83);
    const draft = gameState.seasonState.lineupDrafts?.[0];
    gameState.players.push({
      id: "player-2",
      name: "Second Risk Runner",
      className: "Runner",
      race: "Human",
      marketValue: 10,
      salary: 2,
      fatigue: 83,
      attributes: {},
      disciplineRatings: {},
    } as never);
    gameState.rosters.push({
      teamId: "A-A",
      playerId: "player-2",
      role: "bench",
      joinedSeasonId: "season-1",
    } as never);
    draft?.entries.push({
      disciplineId: "tdm",
      disciplineSide: "d1",
      slotIndex: 2,
      playerId: "player-2",
      activePlayerId: "active-player-2",
    });

    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
      injuryRehearsal: {
        enabled: true,
        seed: "rehearsal-seed",
        maxInjuries: 1,
        riskPercentOverride: 100,
      },
    });

    const injuredEvents = result.injuryEvents.filter((event) => event.result === "injured");
    expect(injuredEvents).toHaveLength(1);
    expect(result.injuryEvents.every((event) => event.source === "fatigue_injury_rehearsal_v1")).toBe(true);
    expect(result.gameState.seasonState.injuryEvents?.filter((event) => event.result === "injured")).toHaveLength(1);
  });

  it("treats sold and transfer-market players as healthy with zero fatigue", () => {
    const gameState = createGameState("player-1", 88);
    gameState.rosters = [];
    gameState.seasonState.playerAvailabilityState = [
      {
        playerId: "player-1",
        teamId: "A-A",
        fatigue: 95,
        injuryStatus: "injured",
        injuryUntilMatchday: "md-2",
        injuredAtSeasonId: "season-1",
        injuredAtMatchdayId: "md-1",
        injuryReason: "stale_after_sale",
      },
    ];

    const availability = getPlayerAvailabilityView(gameState, "player-1", "A-A", "md-2");

    expect(availability.fatigue).toBe(0);
    expect(availability.injuryStatus).toBe("healthy");
    expect(availability.isUnavailable).toBe(false);
    expect(availability.blocker).toBeNull();
  });

  it("drops stale availability entries once a player is no longer rostered", () => {
    const gameState = createGameState("player-1", 88);
    gameState.rosters = [];
    gameState.seasonState.playerAvailabilityState = [
      {
        playerId: "player-1",
        teamId: "A-A",
        fatigue: 95,
        injuryStatus: "injured",
        injuryUntilMatchday: "md-2",
        injuredAtSeasonId: "season-1",
        injuredAtMatchdayId: "md-1",
        injuryReason: "stale_after_sale",
      },
    ];

    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    expect(result.injuryEvents).toHaveLength(0);
    expect(result.gameState.seasonState.playerAvailabilityState).toEqual([]);
  });

  it("uses recovery facilities but halves the final recovery while injured", () => {
    const gameState = createGameState("player-1", 80);
    const recovery = calculateTeamRecovery(gameState, "A-A");

    expect(recovery.normalRecovery).toBeGreaterThan(BASE_MATCHDAY_RECOVERY);
    expect(recovery.injuryRecovery).toBe(recovery.normalRecovery * 0.5);
  });

  it("reduces inactive player recovery when training mode is hard", () => {
    const gameState = createGameState("player-1", 20);
    gameState.players.push({
      id: "hard-bench-player",
      name: "Hard Bench Runner",
      className: "Runner",
      race: "Human",
      marketValue: 10,
      salary: 2,
      fatigue: 60,
      trainingMode: "hart",
      attributes: {},
      disciplineRatings: {},
    } as never);
    gameState.rosters.push({
      teamId: "A-A",
      playerId: "hard-bench-player",
      role: "bench",
      joinedSeasonId: "season-1",
    } as never);
    const teamRecovery = calculateTeamRecovery(gameState, "A-A");
    const hardRecovery = calculatePlayerRecovery(gameState, "A-A", "hart");

    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    const benchPlayer = result.gameState.players.find((player) => player.id === "hard-bench-player");

    expect(hardRecovery.normalRecovery).toBeLessThan(teamRecovery.normalRecovery);
    expect(benchPlayer?.fatigue).toBe(Math.max(0, Number((60 - hardRecovery.normalRecovery).toFixed(2))));
  });

  it("applies normal recovery with facility bonus to active roster players who sit out the matchday", () => {
    const gameState = createGameState("player-1", 20);
    gameState.players.push({
      id: "bench-player",
      name: "Bench Runner",
      className: "Runner",
      race: "Human",
      marketValue: 10,
      salary: 2,
      fatigue: 48,
      attributes: {},
      disciplineRatings: {},
    } as never);
    gameState.rosters.push({
      teamId: "A-A",
      playerId: "bench-player",
      role: "bench",
      joinedSeasonId: "season-1",
    } as never);
    const recovery = calculateTeamRecovery(gameState, "A-A");

    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    const usedPlayer = result.gameState.players.find((player) => player.id === "player-1");
    const benchPlayer = result.gameState.players.find((player) => player.id === "bench-player");
    const benchAvailability = getPlayerAvailabilityView(result.gameState, "bench-player", "A-A", "md-2");

    expect(usedPlayer?.fatigue).toBe(32);
    expect(benchPlayer?.fatigue).toBe(Math.max(0, Number((48 - recovery.normalRecovery).toFixed(2))));
    expect(benchAvailability.fatigue).toBe(benchPlayer?.fatigue);
    expect(benchAvailability.blocker).toBeNull();
  });

  it("is idempotent under a forceReplace re-apply of the same matchday for used and benched players", () => {
    // Vor-Spieltags-Stand: used-0 (Einsatz, fatigue 20), bench-0 (Bank, fatigue 60).
    const gameState = createGameState("used-0", 20);
    gameState.players.push({
      id: "bench-0",
      name: "Bench Runner",
      className: "Runner",
      race: "Human",
      marketValue: 10,
      salary: 2,
      fatigue: 60,
      attributes: {},
      disciplineRatings: {},
    } as never);
    gameState.rosters.push({
      teamId: "A-A",
      playerId: "bench-0",
      role: "bench",
      joinedSeasonId: "season-1",
    } as never);
    const recovery = calculateTeamRecovery(gameState, "A-A");
    const load = 12;

    const applyParams = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-md-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    };

    const first = applyFatigueAndInjuryAfterMatchday({ gameState, ...applyParams });
    const usedFirst = getPlayerAvailabilityView(first.gameState, "used-0", "A-A", "md-1").fatigue;
    const benchFirst = getPlayerAvailabilityView(first.gameState, "bench-0", "A-A", "md-1").fatigue;
    const usedEventFirst = first.injuryEvents.find((event) => event.playerId === "used-0");

    expect(usedFirst).toBe(20 + load);
    expect(benchFirst).toBe(Math.max(0, Number((60 - recovery.normalRecovery).toFixed(2))));

    // forceReplace: denselben Spieltag erneut auf dem bereits fortgeschriebenen State anwenden.
    const second = applyFatigueAndInjuryAfterMatchday({
      gameState: first.gameState,
      ...applyParams,
      isMatchdayReplay: true,
    });
    const usedSecond = getPlayerAvailabilityView(second.gameState, "used-0", "A-A", "md-1").fatigue;
    const benchSecond = getPlayerAvailabilityView(second.gameState, "bench-0", "A-A", "md-1").fatigue;
    const usedEventSecond = second.injuryEvents.find((event) => event.playerId === "used-0");

    // Idempotent: identisch zum ersten Apply, NICHT verdoppelt (kein F + 2*Load / doppelte Erholung).
    expect(usedSecond).toBe(usedFirst);
    expect(usedSecond).not.toBe(20 + 2 * load);
    expect(benchSecond).toBe(benchFirst);
    expect(benchSecond).not.toBe(Math.max(0, Number((60 - 2 * recovery.normalRecovery).toFixed(2))));

    // event.fatigueBefore / riskPercent / roll bleiben ebenfalls identisch.
    expect(usedEventSecond?.fatigueBefore).toBe(usedEventFirst?.fatigueBefore);
    expect(usedEventSecond?.fatigueBefore).toBe(20 + load);
    expect(usedEventSecond?.riskPercent).toBe(usedEventFirst?.riskPercent);
    expect(usedEventSecond?.result).toBe(usedEventFirst?.result);

    // Re-Apply darf keine doppelten Injury-Events für den Spieltag hinterlassen.
    expect(
      second.gameState.seasonState.injuryEvents?.filter(
        (event) => event.seasonId === "season-1" && event.matchdayId === "md-1",
      ).length,
    ).toBe(
      first.gameState.seasonState.injuryEvents?.filter(
        (event) => event.seasonId === "season-1" && event.matchdayId === "md-1",
      ).length,
    );
  });

  it("still accumulates fatigue on a normal advance to the next distinct matchday", () => {
    const gameState = createGameState("used-0", 20);
    // md-2-Aufstellung: used-0 wird erneut eingesetzt.
    gameState.seasonState.lineupDrafts?.push({
      lineupId: "lineup-2",
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      teamId: "A-A",
      status: "submitted",
      entries: [
        {
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 1,
          playerId: "used-0",
          activePlayerId: "active-used-0-md2",
        },
      ],
      createdAt: "2026-06-13T00:00:00.000Z",
      updatedAt: "2026-06-13T00:00:00.000Z",
    } as never);

    const first = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-md-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });
    expect(getPlayerAvailabilityView(first.gameState, "used-0", "A-A", "md-1").fatigue).toBe(32);

    // Normales Vorrücken md-1 -> md-2 (isMatchdayReplay weggelassen -> false): akkumuliert weiter.
    const second = applyFatigueAndInjuryAfterMatchday({
      gameState: first.gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      matchdayResultId: "result-md-2",
      timestamp: "2026-06-13T00:00:00.000Z",
    });
    expect(getPlayerAvailabilityView(second.gameState, "used-0", "A-A", "md-2").fatigue).toBe(44);
  });

  it("returns a recovering player to healthy once the recovery window has elapsed within the season", () => {
    const gameState = createGameState("player-1", 40);
    // Saison mit genügend Spieltagen, damit das Erholungsfenster innerhalb der Saison abläuft.
    (gameState.season as { matchdayIds: string[] }).matchdayIds = ["md-1", "md-2", "md-3", "md-4", "md-5"];
    gameState.seasonState.playerAvailabilityState = [
      {
        playerId: "player-1",
        teamId: "A-A",
        fatigue: 40,
        injuryStatus: "recovering",
        injuryUntilMatchday: "md-2",
        injuredAtSeasonId: "season-1",
        injuredAtMatchdayId: "md-1",
        injuryReason: "fatigue_over_30_after_matchday_use",
      },
    ];

    // md-3: Ausfallzeit (md-2) vorbei, aber noch im Erholungsfenster -> recovering, verfügbar.
    const recoveringView = getPlayerAvailabilityView(gameState, "player-1", "A-A", "md-3");
    expect(recoveringView.injuryStatus).toBe("recovering");
    expect(recoveringView.isUnavailable).toBe(false);

    // md-4: Erholungsfenster abgelaufen -> zurück auf healthy statt dauerhaft recovering.
    const healedView = getPlayerAvailabilityView(gameState, "player-1", "A-A", "md-4");
    expect(healedView.injuryStatus).toBe("healthy");
    expect(healedView.isUnavailable).toBe(false);
    expect(healedView.blocker).toBeNull();
  });

  it("does not freeze a final-matchday injury as permanently injured and heals it at season start", () => {
    const playerId = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-3" });
    const gameState = createGameState(playerId, 83);
    // Aufstellung auf den LETZTEN Spieltag der Saison legen (md-3 -> kein Folge-Spieltag).
    const draft = gameState.seasonState.lineupDrafts?.[0];
    if (draft) {
      draft.matchdayId = "md-3";
    }

    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-3",
      matchdayResultId: "result-3",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    expect(result.injuryEvents[0]?.result).toBe("injured");
    // Kein Folge-Spieltag -> unavailableUntil ist null, injuryUntilMatchday bleibt unbestimmt.
    expect(result.injuryEvents[0]?.unavailableUntil).toBeNull();
    const stored = result.gameState.seasonState.playerAvailabilityState?.find(
      (entry) => entry.playerId === playerId && entry.teamId === "A-A",
    );
    expect(stored?.injuryStatus).toBe("injured");
    expect(stored?.injuryUntilMatchday).toBeUndefined();

    // Der Spieler darf nicht mit eingefrorenem injured-Status in die neue Saison übernommen werden:
    // die Saisonwechsel-Normalisierung heilt ihn deterministisch aus (Fatigue bleibt erhalten).
    const normalized = normalizeAvailabilityForNewSeason(result.gameState.seasonState.playerAvailabilityState);
    const healed = normalized.find((entry) => entry.playerId === playerId && entry.teamId === "A-A");
    expect(healed?.injuryStatus).toBe("healthy");
    expect(healed?.injuryUntilMatchday).toBeUndefined();
    expect(healed?.injuredAtMatchdayId).toBeUndefined();
    expect(healed?.fatigue).toBe(stored?.fatigue);
  });

  it("blocks human lineups that still reference an injured player", () => {
    const context: LegacyLineupContext = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      teamId: "A-A",
      entries: [
        {
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 1,
          playerId: "player-1",
          activePlayerId: "active-player-1",
        },
      ],
      disciplinePlayerCounts: { tdm: 1 },
      disciplineSidePlayerCounts: { "tdm::d1": 1 },
      activePlayers: [],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Risk Runner",
          coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
          injuryStatus: "injured",
          injuryUntilMatchday: "md-2",
          availabilityBlocker: "player_injured_unavailable",
        },
      ],
      disciplineScores: [],
    };

    const validation = validateLegacyLineupContext(context);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((error) => error.includes("player_injured_unavailable"))).toBe(true);
  });

  it("blocks injured players even if a stale activePlayerId is still present", () => {
    const context: LegacyLineupContext = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      teamId: "A-A",
      entries: [
        {
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 1,
          playerId: "player-1",
          activePlayerId: "active-player-1",
          isCaptain: true,
        },
      ],
      disciplinePlayerCounts: { tdm: 1 },
      disciplineSidePlayerCounts: { "tdm::d1": 1 },
      disciplineSideCaptainCounts: { "tdm::d1": 1 },
      activePlayers: [
        {
          id: "active-player-1",
          saveId: "save-1",
          seasonId: "season-1",
          teamId: "A-A",
          playerId: "player-1",
        },
      ],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Risk Runner",
          coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
          injuryStatus: "injured",
          injuryUntilMatchday: "md-2",
          availabilityBlocker: "player_injured_unavailable",
        },
      ],
      disciplineScores: [{ playerId: "player-1", disciplineId: "tdm", score: 88 }],
    };

    const validation = validateLegacyLineupContext(context);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain("player_injured_unavailable: Player player-1 is injured and unavailable until md-2.");
  });
});
