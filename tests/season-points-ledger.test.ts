import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

describe("season points ledger", () => {
  it("uses the real rank-to-points table and distributes team points by final-score share", () => {
    const gameState = createFreshSeasonOneGameState();
    const teamA = gameState.teams[0];
    const teamB = gameState.teams[1];
    const [playerA1, playerA2, playerB1, playerB2] = gameState.players.slice(0, 4);

    expect(teamA).toBeTruthy();
    expect(teamB).toBeTruthy();
    expect(playerA1).toBeTruthy();
    expect(playerA2).toBeTruthy();
    expect(playerB1).toBeTruthy();
    expect(playerB2).toBeTruthy();

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-a",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 40,
        totalScore: 47,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
      },
      {
        id: "discipline-b",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 25,
        totalScore: 31,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:02:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-1",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        playerId: playerA1!.id,
        activePlayerId: playerA1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 30,
        finalPlayerScore: 33,
        mutatorPpsBonus: 0.3,
        scoreContribution: 0.7,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.7,
        createdAt: "2026-06-06T12:03:00.000Z",
      },
      {
        id: "perf-a-2",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        playerId: playerA2!.id,
        activePlayerId: playerA2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 10,
        finalPlayerScore: 14,
        scoreContribution: 0.3,
        rankInTeam: 2,
        rankInDiscipline: 5,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.3,
        createdAt: "2026-06-06T12:04:00.000Z",
      },
      {
        id: "perf-b-1",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        playerId: playerB1!.id,
        activePlayerId: playerB1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 20,
        finalPlayerScore: 18,
        scoreContribution: 0.5,
        rankInTeam: 1,
        rankInDiscipline: 7,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:05:00.000Z",
      },
      {
        id: "perf-b-2",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        playerId: playerB2!.id,
        activePlayerId: playerB2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 20,
        finalPlayerScore: 13,
        scoreContribution: 0.5,
        rankInTeam: 2,
        rankInDiscipline: 9,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:06:00.000Z",
      },
    ];

    const ledger = buildSeasonPointsLedger(gameState);
    const teamASummary = ledger.teamSummariesByTeamId.get(teamA!.teamId);
    const teamBSummary = ledger.teamSummariesByTeamId.get(teamB!.teamId);
    const perfA1 = ledger.pointEntriesByPerformanceId.get("perf-a-1");
    const perfA2 = ledger.pointEntriesByPerformanceId.get("perf-a-2");
    const perfB1 = ledger.pointEntriesByPerformanceId.get("perf-b-1");
    const perfB2 = ledger.pointEntriesByPerformanceId.get("perf-b-2");

    expect(teamASummary?.totalPoints).toBe(6.9);
    expect(teamBSummary?.totalPoints).toBe(6.2);
    expect(teamASummary?.reconciliationStatus).toBe("reconciled");
    expect(teamBSummary?.reconciliationStatus).toBe("reconciled");
    expect(teamASummary?.playerDerivedTotal).toBe(6.9);
    expect(teamASummary?.mutatorPpsBonus).toBe(0.3);
    // PP jetzt nach ENDSCORE (finalPlayerScore) verteilt statt nach baseValue:
    // Team A 6,6 auf 33/14 → 4,634 / 1,966; Team B 6,2 auf 18/13 → 3,6 / 2,6.
    // Team-Summe bleibt erhalten (6,9), nur die Aufteilung folgt dem Endscore.
    expect(perfA1?.basePoints).toBe(4.634);
    expect(perfA1?.mutatorPpsBonus).toBe(0.3);
    expect(perfA1?.points).toBe(4.934);
    expect(perfA2?.points).toBe(1.966);
    expect(perfB1?.points).toBe(3.6);
    expect(perfB2?.points).toBe(2.6);
    expect(perfA1?.pointSource).toBe("rank_to_points_final_score_share");
  });

  it("keeps a team's earned season points after a contributing player is sold (#180)", () => {
    // #180: Verkaufte Spieler dürfen bereits erspielte Saison-Punkte NICHT aus
    // der Team-Wertung ziehen. Der Ledger attribuiert Punkte über die beim
    // Scoring eingefrorene `performance.teamId` — nicht über das aktuelle
    // Roster. Dieser Test friert dieses Verhalten fest.
    const gameState = createFreshSeasonOneGameState();
    const teamA = gameState.teams[0]!;
    const teamB = gameState.teams[1]!;
    const [playerA1, playerA2, playerB1, playerB2] = gameState.players.slice(0, 4);

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-a",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 40,
        totalScore: 47,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
      },
      {
        id: "discipline-b",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 25,
        totalScore: 31,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:02:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-1",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA1!.id,
        activePlayerId: playerA1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 30,
        finalPlayerScore: 33,
        mutatorPpsBonus: 0.3,
        scoreContribution: 0.7,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.7,
        createdAt: "2026-06-06T12:03:00.000Z",
      },
      {
        id: "perf-a-2",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA2!.id,
        activePlayerId: playerA2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 10,
        finalPlayerScore: 14,
        scoreContribution: 0.3,
        rankInTeam: 2,
        rankInDiscipline: 5,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.3,
        createdAt: "2026-06-06T12:04:00.000Z",
      },
      {
        id: "perf-b-1",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        playerId: playerB1!.id,
        activePlayerId: playerB1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 20,
        finalPlayerScore: 18,
        scoreContribution: 0.5,
        rankInTeam: 1,
        rankInDiscipline: 7,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:05:00.000Z",
      },
      {
        id: "perf-b-2",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        playerId: playerB2!.id,
        activePlayerId: playerB2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 20,
        finalPlayerScore: 13,
        scoreContribution: 0.5,
        rankInTeam: 2,
        rankInDiscipline: 9,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:06:00.000Z",
      },
    ];

    const before = buildSeasonPointsLedger(gameState);
    const teamAPointsBefore = before.teamSummariesByTeamId.get(teamA.teamId)?.totalPoints ?? null;
    expect(teamAPointsBefore).toBe(6.9);

    // Verkauf simulieren: der Top-Scorer playerA1 verlässt Team A vollständig —
    // raus aus Roster UND Spielerliste (freier Markt / anderes Team). Die beim
    // Matchday eingefrorenen Performances bleiben unangetastet, so wie im echten
    // Verkaufspfad.
    gameState.rosters = (gameState.rosters ?? []).filter((entry) => entry.playerId !== playerA1!.id);
    gameState.players = gameState.players.filter((player) => player.id !== playerA1!.id);

    const after = buildSeasonPointsLedger(gameState);
    const teamAPointsAfter = after.teamSummariesByTeamId.get(teamA.teamId)?.totalPoints ?? null;

    // Kernaussage #180: die erspielten Punkte bleiben Team A erhalten.
    expect(teamAPointsAfter).toBe(teamAPointsBefore);
    // Die eingefrorene Performance des verkauften Spielers zählt weiter für Team A.
    expect(after.pointEntriesByPerformanceId.get("perf-a-1")?.points).toBe(4.934);
    expect(after.pointEntriesByPerformanceId.get("perf-a-1")?.teamId).toBe(teamA.teamId);
  });

  it("PP-BUDGET, REIN LEISTUNGSBASIERT (19.10.): `tableGroupContributions` einer Duell-Zeile " +
    "traegt das 2/1/0-Team-Budget, NICHT die (jetzt leistungsbasierte) Spieler-PP-Summe -- " +
    "`teamSummary.totalPoints` und der Spieltagsrang (`season-matchday-points.ts`, " +
    "`build-field-race-ledger.ts`) muessen dieselbe Waehrung lesen wie die Saisontabelle, sonst " +
    "entsteht fuer Battle-Saves genau die Inkonsistenz, die diese Datei fuer den Mutator-Bonus " +
    "schon einmal behoben hat (\"Platz 1 im Spieltag, aber nur 2. in der Saison\").", () => {
    const gameState = createFreshSeasonOneGameState();
    const teamA = gameState.teams[0]!;
    const teamB = gameState.teams[1]!;
    const [playerA1, playerA2, playerB1, playerB2] = gameState.players.slice(0, 4);

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    // Team A verliert sein Duell (0 von 2 Punkten), hat aber die beiden staerkeren Spieler
    // (finalPlayerScore 80/60) -- genau der Fall, den Chris' Entscheidung adressiert ("ein guter
    // Spieler im schlechten Verlierer-Team kann trotzdem viele Punkte sammeln").
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-a",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        disciplineId: "basketball",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 70,
        totalScore: 140,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
        resolutionSource: "pps_duell",
        pointSource: "battle_mode_pps_duell_win_draw_loss",
        teamPoints: 0,
        opponentTeamId: teamB.teamId,
      },
      {
        id: "discipline-b",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        disciplineId: "basketball",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 20,
        totalScore: 40,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:02:00.000Z",
        resolutionSource: "pps_duell",
        pointSource: "battle_mode_pps_duell_win_draw_loss",
        teamPoints: 2,
        opponentTeamId: teamA.teamId,
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-1",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA1!.id,
        activePlayerId: playerA1!.id,
        disciplineId: "basketball",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 80,
        finalPlayerScore: 80,
        scoreContribution: 0.57,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.57,
        createdAt: "2026-06-06T12:03:00.000Z",
      },
      {
        id: "perf-a-2",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA2!.id,
        activePlayerId: playerA2!.id,
        disciplineId: "basketball",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 60,
        finalPlayerScore: 60,
        scoreContribution: 0.43,
        rankInTeam: 2,
        rankInDiscipline: 3,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.43,
        createdAt: "2026-06-06T12:04:00.000Z",
      },
      {
        id: "perf-b-1",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        playerId: playerB1!.id,
        activePlayerId: playerB1!.id,
        disciplineId: "basketball",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 10,
        finalPlayerScore: 10,
        scoreContribution: 0.5,
        rankInTeam: 1,
        rankInDiscipline: 7,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:05:00.000Z",
      },
      {
        id: "perf-b-2",
        matchdayResultId: "result-1",
        teamId: teamB.teamId,
        playerId: playerB2!.id,
        activePlayerId: playerB2!.id,
        disciplineId: "basketball",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 10,
        finalPlayerScore: 10,
        scoreContribution: 0.5,
        rankInTeam: 2,
        rankInDiscipline: 8,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:06:00.000Z",
      },
    ];

    const ledger = buildSeasonPointsLedger(gameState);
    const teamASummary = ledger.teamSummariesByTeamId.get(teamA.teamId)!;
    const teamBSummary = ledger.teamSummariesByTeamId.get(teamB.teamId)!;

    // Tabellenpunkte bleiben exakt Σ 2/1/0 -- Team A verlor, Team B gewann.
    expect(teamASummary.totalPoints).toBe(0);
    expect(teamBSummary.totalPoints).toBe(2);
    expect(teamASummary.reconciliationStatus).toBe("reconciled");
    expect(teamBSummary.reconciliationStatus).toBe("reconciled");

    // ABER: Team A (der Verlierer) hat die weitaus hoehere leistungsbasierte Spieler-PP-Summe,
    // weil seine Spieler absolut staerker waren -- genau die Entkopplung, die Teil A will.
    expect(teamASummary.playerDerivedTotal).toBeGreaterThan(teamBSummary.playerDerivedTotal);
    expect(teamASummary.playerDerivedTotal).toBeGreaterThan(0);

    // DIE REGRESSION, DIE DIESER TEST SPERRT: `tableGroupContributions` (Spieltagsrang/Feld-Rennen)
    // liest das 2/1/0-Team-Budget, NICHT die Spieler-PP-Summe -- sonst wuerde "wer hat an diesem
    // Spieltag mehr Punkte geholt" (Tagessieger) der leistungsbasierten PP-Summe folgen und
    // Team A (den Verlierer) als Tagessieger zeigen, waehrend die Saisontabelle Team B fuehrt.
    const beitragA = ledger.tableGroupContributions.find((b) => b.teamId === teamA.teamId && b.disciplineId === "basketball");
    const beitragB = ledger.tableGroupContributions.find((b) => b.teamId === teamB.teamId && b.disciplineId === "basketball");
    expect(beitragA?.points).toBe(0);
    expect(beitragB?.points).toBe(2);
    expect(beitragA?.matchdayId).toBe("matchday-1");
    // Σ `tableGroupContributions` je Team == `teamSummary.totalPoints` -- dieselbe Waehrung.
    expect(beitragA?.points).toBe(teamASummary.totalPoints);
    expect(beitragB?.points).toBe(teamBSummary.totalPoints);

    // OPUS-REVIEW PR #1296: eine Duell-Zeile OHNE erfasste Leistungen (leere Aufstellung) bucht ihr
    // 2/1/0 in `totalPoints` UND in `tableGroupContributions` -- sonst liefen Saisontabelle und
    // Spieltagsrang genau in diesem Rand-Fall auseinander.
    gameState.seasonState.playerDisciplinePerformances = gameState.seasonState.playerDisciplinePerformances.filter(
      (performance) => performance.teamId !== teamB.teamId,
    );
    const ohneLeistungen = buildSeasonPointsLedger(gameState);
    expect(ohneLeistungen.teamSummariesByTeamId.get(teamB.teamId)!.totalPoints).toBe(2);
    const beitragOhneLeistungen = ohneLeistungen.tableGroupContributions.filter((b) => b.teamId === teamB.teamId);
    expect(beitragOhneLeistungen).toEqual([
      { matchdayId: "matchday-1", teamId: teamB.teamId, disciplineId: "basketball", points: 2 },
    ]);
  });

  it("MINI-DM-POD-RESOLVE (19.10., Review-Fund 20.10.): eine Mini-DM-Pod-Zeile (`resolutionSource: " +
    "\"mini_dm_pod\"`) darf ihre Spieler-PP-Summe NICHT zusaetzlich zum schon gebuchten 2-1-0-0-" +
    "Budget in `teamSummary.totalPoints` aufaddieren -- genau die Doppelzaehlung, die die " +
    "Season-Sum-Probe (scripts/miss-mini-dm-pod-saisonsumme.ts) an einem echten 20-Spieltage-" +
    "Battle-Save gefunden hat (`totalPoints` lag dort fuer JEDES Team ueber dem gebuchten Wert).", () => {
    const gameState = createFreshSeasonOneGameState();
    const [teamA, teamB, teamC, teamD] = gameState.teams;
    const [playerA, playerB, playerC, playerD] = gameState.players;

    gameState.seasonState.matchdayResults = [
      {
        id: "result-pod-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 4,
        teamsReady: 4,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    const podTeamIds = [teamA!.teamId, teamB!.teamId, teamC!.teamId, teamD!.teamId] as const;
    const platzByTeamId = new Map(podTeamIds.map((teamId, index) => [teamId, (index + 1) as 1 | 2 | 3 | 4]));
    const teamPointsByPlatz = [2, 1, 0, 0];
    gameState.seasonState.disciplineResults = podTeamIds.map((teamId, index) => ({
      id: `discipline-pod-${index}`,
      matchdayResultId: "result-pod-1",
      teamId,
      disciplineId: "mini-dm",
      disciplineSide: "d1" as const,
      rank: index + 1,
      baseScore: 50 - index * 10,
      totalScore: 50 - index * 10,
      readinessStatus: "ready" as const,
      warnings: [],
      createdAt: "2026-06-06T12:01:00.000Z",
      resolutionSource: "mini_dm_pod" as const,
      pointSource: "battle_mode_mini_dm_pod_platz",
      teamPoints: teamPointsByPlatz[index],
      miniDmPod: { podId: "pod-test", platz: platzByTeamId.get(teamId)!, teamIds: podTeamIds, wert: 10 - index * 2 },
    }));
    // Team D (letzter Platz, 0 Liga-Punkte) hat den mit Abstand STAERKSTEN Einzelspieler -- Chris'
    // "Impact Rating"-Beispiel ("ein guter Spieler im schlechten Verlierer-Team"). Waere die
    // Doppelzaehlung noch da, wuerde Team D trotz Platz 4 die hoechste Tabellenpunktzahl zeigen.
    const scoreByTeamId = new Map([
      [teamA!.teamId, 10],
      [teamB!.teamId, 10],
      [teamC!.teamId, 10],
      [teamD!.teamId, 200],
    ]);
    gameState.seasonState.playerDisciplinePerformances = podTeamIds.map((teamId, index) => ({
      id: `perf-pod-${index}`,
      matchdayResultId: "result-pod-1",
      teamId,
      playerId: [playerA, playerB, playerC, playerD][index]!.id,
      activePlayerId: [playerA, playerB, playerC, playerD][index]!.id,
      disciplineId: "mini-dm",
      disciplineSide: "d1" as const,
      slotIndex: 0,
      baseValue: scoreByTeamId.get(teamId)!,
      finalPlayerScore: scoreByTeamId.get(teamId)!,
      scoreContribution: 1,
      rankInTeam: 1,
      rankInDiscipline: index + 1,
      isTop10: true,
      isMvpCandidate: false,
      storyWeight: 1,
      createdAt: "2026-06-06T12:02:00.000Z",
    }));

    const ledger = buildSeasonPointsLedger(gameState);
    for (const teamId of podTeamIds) {
      const erwartet = teamPointsByPlatz[platzByTeamId.get(teamId)! - 1];
      expect(ledger.teamSummariesByTeamId.get(teamId)!.totalPoints, `Team ${teamId}`).toBe(erwartet);
      const beitrag = ledger.tableGroupContributions.find((b) => b.teamId === teamId && b.disciplineId === "mini-dm");
      expect(beitrag?.points).toBe(erwartet);
    }
    // Trotz des staerksten Einzelspielers bleibt Team D (Platz 4) bei 0 Tabellenpunkten -- seine
    // hohe Spieler-PP (`playerDerivedTotal`) ist eine SEPARATE Groesse, fliesst NICHT in `totalPoints`.
    expect(ledger.teamSummariesByTeamId.get(teamD!.teamId)!.totalPoints).toBe(0);
    expect(ledger.teamSummariesByTeamId.get(teamD!.teamId)!.playerDerivedTotal).toBeGreaterThan(
      ledger.teamSummariesByTeamId.get(teamA!.teamId)!.playerDerivedTotal,
    );
  });
});
