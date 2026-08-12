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
  MATCHDAY_FATIGUE_LOAD,
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
    // Schutzzone bis 25 (Chris): darunter 0 %, und „kein Risiko" heißt dasselbe.
    expect(getInjuryRiskPercent(24)).toBe(0);
    expect(getInjuryRiskBand(24).label).toBe("none");
    expect(getInjuryRiskPercent(29)).toBe(0.48);
    expect(getInjuryRiskBand(29).label).toBe("minimal");
    expect(getInjuryRiskPercent(30)).toBe(0.6);
    expect(getInjuryRiskBand(30).label).toBe("minimal");
    // Anker 50 liegt seit der Nachschaerfung bei 3 % (vorher 10). Das Band heisst dort weiter
    // "mittel" — die Baender haengen an FATIGUE-Grenzen, nicht an Prozenten.
    expect(getInjuryRiskPercent(50)).toBe(3);
    expect(getInjuryRiskBand(50).label).toBe("mittel");
    expect(getInjuryRiskPercent(70)).toBe(17.67);
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

  it("sperrt den Verletzten fuer die Folgedisziplin desselben Spieltags", () => {
    // Ein Spieltag hat zwei Disziplinen. Verletzt sich der Spieler in D1, war er bisher
    // in D2 weiter aufstellbar: die Sperre begann erst am NAECHSTEN Spieltag. Der Fixture
    // hat kein gebuchtes Ergebnis, der Spieltag laeuft also noch — genau die Lage
    // zwischen D1-Commit und D2.
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
    expect(injuryDayAvailability.isUnavailable).toBe(true);
    expect(injuryDayAvailability.blocker).toBe("player_injured_unavailable");
    expect(injuryDayAvailability.injuryStatus).toBe("injured");
  });

  it("zaehlt den Verletzten fuer die Fatigue-Verrechnung weiter als Einsatz an seinem Spieltag", () => {
    // Gegenprobe zur Sperre: Wer sich an Spieltag N verletzt, ist an N GELAUFEN. Die
    // Buchhaltungssicht muss ihm deshalb Belastung statt Erholung zuschreiben — sonst
    // rechnet ein forceReplace-Re-Apply desselben Spieltags einen anderen Ausgangsstand.
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

    const bookkeeping = getPlayerAvailabilityView(result.gameState, playerId, "A-A", "md-1", {
      matchdayBookkeeping: true,
    });
    expect(bookkeeping.isUnavailable).toBe(false);
    expect(bookkeeping.injuryStatus).toBe("injured");
    // Einsatz-Zweig: +Load. Waere er als "nicht verfuegbar" eingestuft worden, stuende
    // hier stattdessen der abgezogene Erholungswert.
    //
    // GEKLEMMT gerechnet, nicht roh: der Startwert 83 stammt aus einer Zeit mit Last 10, und
    // Fatigue ist bei 100 gedeckelt. Mit der auf 19,5 angehobenen Last liefe `83 + Load` auf
    // 102,5 und damit ueber den Deckel — die Zusicherung wuerde an der Balance-Zahl scheitern
    // statt an dem, was sie prueft (Einsatz-Zweig statt Erholungs-Zweig).
    expect(bookkeeping.fatigue).toBe(Math.min(100, 83 + MATCHDAY_FATIGUE_LOAD));
  });

  it("nimmt die Sperre zurueck, sobald beide Disziplinen des Spieltags gebucht sind", () => {
    // Die Sperre gilt der noch OFFENEN Disziplin. Ist der Spieltag komplett gewertet,
    // gibt es keine mehr — ein Rueckblick auf denselben Spieltag (Arena-Tabelle,
    // Bereitschaft) soll nicht nachtraeglich behaupten, er haette nicht antreten duerfen.
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

    const bookedState: GameState = {
      ...result.gameState,
      seasonState: {
        ...result.gameState.seasonState,
        matchdayResults: [
          { id: "result-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", status: "preview_applied" },
        ] as GameState["seasonState"]["matchdayResults"],
        disciplineResults: [
          { id: "dr-d1", matchdayResultId: "result-1", teamId: "A-A", disciplineId: "tdm", disciplineSide: "d1" },
          { id: "dr-d2", matchdayResultId: "result-1", teamId: "A-A", disciplineId: "spurt", disciplineSide: "d2" },
        ] as GameState["seasonState"]["disciplineResults"],
      },
    };

    expect(getPlayerAvailabilityView(bookedState, playerId, "A-A", "md-1").isUnavailable).toBe(false);
    // Der naechste Spieltag bleibt gesperrt — daran aendert die Buchung nichts.
    expect(getPlayerAvailabilityView(bookedState, playerId, "A-A", "md-2").isUnavailable).toBe(true);
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

    expect(usedPlayer?.fatigue).toBe(20 + MATCHDAY_FATIGUE_LOAD);
    expect(benchPlayer?.fatigue).toBe(Math.max(0, Number((48 - recovery.normalRecovery).toFixed(2))));
    expect(benchAvailability.fatigue).toBe(benchPlayer?.fatigue);
    expect(benchAvailability.blocker).toBeNull();
  });

  /**
   * DIE STAFFEL-BUCHUNG DER ARENA (erst D1, dann D2) DARF DEN D2-SPIELER NICHT VERJUENGEN.
   *
   * Der D1-Commit schreibt NUR den D1-Spielern Belastung auf; wer erst in D2 laeuft, gilt
   * fuer ihn als „nicht im Einsatz" und bekommt Erholung abgezogen. Der D2-Commit setzt
   * danach auf den Vor-Spieltags-Stand zurueck — nahm diese Ruecknahme aber den GANZEN
   * Spieltag als Einsatz an, zog sie dem D2-Spieler zusaetzlich eine Last ab, die ihm nie
   * gutgeschrieben worden war. Er ging mit `F - Erholung - Last + Last = F - Erholung` in
   * seinen Verletzungswurf statt mit `F + Last`.
   *
   * Was der Spieler davon merkt: Der Wurf findet auf einem viel zu frischen Wert statt
   * (hier: 42 statt 96), faellt deshalb „gesund" aus, und der Same-Day-Malus
   * (INJURY_PERFORMANCE_MULTIPLIER) landet nie in der gebuchten Wertung — D2-Spieler
   * konnten sich faktisch nicht verletzen und liefen mit vollen Punkten durch.
   */
  it("bucht D1 und D2 nacheinander mit demselben Ausdauer- und Verletzungsergebnis wie ein Komplett-Commit", () => {
    const injuredCandidate = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-1" });

    function createStagedGameState(): GameState {
      // d1-runner laeuft in D1, der Verletzungskandidat NUR in D2 — beide mit fatigue 80.
      const gameState = createGameState("d1-runner", 80);
      gameState.players.push({
        id: injuredCandidate,
        name: "D2 Runner",
        className: "Runner",
        race: "Human",
        marketValue: 10,
        salary: 2,
        fatigue: 80,
        attributes: {},
        disciplineRatings: {},
      } as never);
      gameState.rosters.push({
        teamId: "A-A",
        playerId: injuredCandidate,
        role: "core",
        joinedSeasonId: "season-1",
      } as never);
      gameState.seasonState.lineupDrafts?.[0]?.entries.push({
        disciplineId: "spurt",
        disciplineSide: "d2",
        slotIndex: 1,
        playerId: injuredCandidate,
        activePlayerId: `active-${injuredCandidate}`,
      });
      // Ein FRISCHER D2-Starter (Ausdauer 0) und ein Bankspieler: der frische deckt die
      // Klemmung an der Null ab (eine abgezogene Erholung liesse sich dort nie wieder
      // zurueckrechnen), der Bankspieler die unveraenderte Erholungsrechnung.
      for (const [id, fatigueValue, side] of [
        ["d2-fresh", 0, "d2"],
        ["bench-0", 60, null],
      ] as const) {
        gameState.players.push({
          id,
          name: id,
          className: "Runner",
          race: "Human",
          marketValue: 10,
          salary: 2,
          fatigue: fatigueValue,
          attributes: {},
          disciplineRatings: {},
        } as never);
        gameState.rosters.push({ teamId: "A-A", playerId: id, role: "bench", joinedSeasonId: "season-1" } as never);
        if (side) {
          gameState.seasonState.lineupDrafts?.[0]?.entries.push({
            disciplineId: "spurt",
            disciplineSide: side,
            slotIndex: 2,
            playerId: id,
            activePlayerId: `active-${id}`,
          });
        }
      }
      // Wie im echten Spielstand: jeder Spieler traegt bereits einen Verfuegbarkeitssatz.
      // Ohne ihn liefe die Ruecknahme ins Leere und der Fehler bliebe im Test unsichtbar.
      gameState.seasonState.playerAvailabilityState = gameState.rosters.map((roster) => ({
        playerId: roster.playerId,
        teamId: roster.teamId,
        fatigue: gameState.players.find((player) => player.id === roster.playerId)?.fatigue ?? 0,
        injuryStatus: "healthy" as const,
      }));
      return gameState;
    }

    const applyParams = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-md-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    };
    const load = MATCHDAY_FATIGUE_LOAD;

    // (1) Komplett-Commit in einem Rutsch — der Massstab.
    const full = applyFatigueAndInjuryAfterMatchday({ gameState: createStagedGameState(), ...applyParams });
    const fullD2Event = full.injuryEvents.find((event) => event.playerId === injuredCandidate);
    expect(fullD2Event?.fatigueBefore).toBe(80 + load);
    expect(fullD2Event?.result).toBe("injured");

    // (2) Dieselbe Buchung in zwei Schritten, wie die Arena sie ausfuehrt.
    const stagedD1 = applyFatigueAndInjuryAfterMatchday({
      gameState: createStagedGameState(),
      ...applyParams,
      commitThroughSide: "d1",
    });
    // Nach D1 steht der D2-Spieler unveraendert da: sein Spieltag hat noch nicht stattgefunden,
    // also weder Last noch Erholung. (Vorher bekam er hier Erholung gutgeschrieben — genau die
    // liess ihn spaeter zu frisch in seinen Verletzungswurf gehen.)
    const d2AfterD1 = getPlayerAvailabilityView(stagedD1.gameState, injuredCandidate, "A-A", "md-1", {
      matchdayBookkeeping: true,
    }).fatigue;
    expect(d2AfterD1).toBe(80);
    // Der D1-Spieler dagegen traegt seine Last bereits.
    expect(
      getPlayerAvailabilityView(stagedD1.gameState, "d1-runner", "A-A", "md-1", { matchdayBookkeeping: true }).fatigue,
    ).toBe(Math.min(100, 80 + load));

    const stagedD2 = applyFatigueAndInjuryAfterMatchday({
      gameState: stagedD1.gameState,
      ...applyParams,
      commitThroughSide: "d2",
      isMatchdayReplay: true,
    });

    // Der Wurf des D2-Spielers steht auf dem Vor-Spieltags-Stand PLUS Last — nicht auf dem
    // um die Erholung gesenkten Zwischenstand.
    const stagedD2Event = stagedD2.injuryEvents.find((event) => event.playerId === injuredCandidate);
    expect(stagedD2Event?.fatigueBefore).toBe(80 + load);
    expect(stagedD2Event?.riskPercent).toBe(fullD2Event?.riskPercent);
    expect(stagedD2Event?.roll).toBe(fullD2Event?.roll);
    // ... und damit faellt er genauso aus wie im Komplett-Commit: verletzt, also mit Malus.
    expect(stagedD2Event?.result).toBe("injured");

    // Die Roll-Map, aus der die Wertung ihren Same-Day-Malus zieht, sagt dasselbe.
    const stagedRollMap = buildMatchdayInjuryRollMap({
      gameState: stagedD1.gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      isMatchdayReplay: true,
    });
    expect(stagedRollMap.get(`A-A::${injuredCandidate}`)?.fatigueBefore).toBe(80 + load);
    expect(stagedRollMap.get(`A-A::${injuredCandidate}`)?.result).toBe("injured");

    // Endstand der Ausdauer: gestaffelt wie am Stueck (kein F - Erholung, kein F + 2*Last).
    for (const playerId of ["d1-runner", injuredCandidate, "d2-fresh", "bench-0"]) {
      const staged = getPlayerAvailabilityView(stagedD2.gameState, playerId, "A-A", "md-1", {
        matchdayBookkeeping: true,
      }).fatigue;
      const complete = getPlayerAvailabilityView(full.gameState, playerId, "A-A", "md-1", {
        matchdayBookkeeping: true,
      }).fatigue;
      expect(staged, playerId).toBe(complete);
    }
    for (const playerId of ["d1-runner", injuredCandidate]) {
      expect(
        getPlayerAvailabilityView(stagedD2.gameState, playerId, "A-A", "md-1", { matchdayBookkeeping: true }).fatigue,
      ).toBe(Math.min(100, 80 + load));
    }
    // Der frische D2-Starter kommt auf genau seine Spieltagslast — nicht auf „Last minus
    // Erholung" und auch nicht auf einen aus der Null herbeigerechneten Wert.
    expect(
      getPlayerAvailabilityView(stagedD2.gameState, "d2-fresh", "A-A", "md-1", { matchdayBookkeeping: true }).fatigue,
    ).toBe(load);
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
    const load = MATCHDAY_FATIGUE_LOAD;

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
    expect(getPlayerAvailabilityView(first.gameState, "used-0", "A-A", "md-1").fatigue).toBe(20 + MATCHDAY_FATIGUE_LOAD);

    // Normales Vorrücken md-1 -> md-2 (isMatchdayReplay weggelassen -> false): akkumuliert weiter.
    const second = applyFatigueAndInjuryAfterMatchday({
      gameState: first.gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      matchdayResultId: "result-md-2",
      timestamp: "2026-06-13T00:00:00.000Z",
    });
    expect(getPlayerAvailabilityView(second.gameState, "used-0", "A-A", "md-2").fatigue).toBe(20 + MATCHDAY_FATIGUE_LOAD * 2);
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
