import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildPlayerAllTimeDisciplineStats } from "@/lib/foundation/player-all-time-discipline-stats";
import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

/**
 * All-Time-Bestenliste je Disziplin/Bereich — Chris, 19.10.: Gesamtpunkte UND Punkte pro Einsatz
 * müssen über mehrere Saisons hinweg unterscheidbar bleiben ("10 Punkte mit einem Einsatz" vs.
 * "10 Punkte mit 5 Einsätzen").
 */

function buildArchivedSnapshot(partial: Partial<SeasonSnapshotRecord>): SeasonSnapshotRecord {
  return {
    snapshotId: "snap",
    seasonId: "season-1",
    seasonName: "Season 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    archivedAt: "2026-01-01T00:00:00.000Z",
    source: "local",
    status: "completed",
    sourceStatus: "mapped",
    finalStandings: [],
    teamSnapshots: [],
    matchdayResults: [],
    disciplineResults: [],
    playerDisciplinePerformances: [],
    disciplineHighlights: [],
    playerPerformances: [],
    transferSnapshots: [],
    warnings: [],
    ...partial,
  } as SeasonSnapshotRecord;
}

describe("player-all-time-discipline-stats", () => {
  it("aggregates a single archived season's discipline breakdown into discipline/area/overall cells", () => {
    const gameState = createFreshSeasonOneGameState();
    const player = gameState.players[0]!;
    const team = gameState.teams.find((candidate) => candidate.teamId === gameState.rosters.find((r) => r.playerId === player.id)?.teamId) ?? gameState.teams[0]!;

    gameState.seasonState.seasonSnapshots = [
      buildArchivedSnapshot({
        seasonId: "season-1",
        seasonName: "Season 1",
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: team.teamId,
            teamCode: team.shortCode,
            teamName: team.name,
            appearances: 5,
            totalContribution: 50,
            totalFinalScore: 0,
            averageContribution: 10,
            averageFinalScore: 0,
            top10Count: 0,
            mvpCount: 0,
            bestDisciplineId: null,
            bestDisciplineScore: null,
            disciplineBreakdown: [
              {
                disciplineId: "fechten",
                disciplineName: "Fechten",
                appearances: 5,
                totalContribution: 50,
                averageContribution: 10,
                averageFinalScore: 0,
              },
            ],
          },
        ],
      }),
    ];

    const rows = buildPlayerAllTimeDisciplineStats(gameState);
    const row = rows.find((candidate) => candidate.playerId === player.id);
    expect(row).toBeTruthy();
    expect(row!.byDiscipline.fechten).toEqual({
      points: 50,
      appearances: 5,
      pointsPerAppearance: 10,
      seasonsPlayed: 1,
    });
    // "fechten" liegt im SPE-Bereich — die Bereichs-Summe muss exakt der Einzeldisziplin folgen,
    // solange keine zweite SPE-Disziplin beigetragen hat.
    expect(row!.byArea.spe).toEqual({
      points: 50,
      appearances: 5,
      pointsPerAppearance: 10,
      seasonsPlayed: 1,
    });
    expect(row!.overall.points).toBe(50);
    expect(row!.overall.appearances).toBe(5);
    expect(row!.overall.pointsPerAppearance).toBe(10);
    expect(row!.seasonsPlayed).toBe(1);
  });

  it("tells apart few-appearance high-rate players from many-appearance low-rate players (Chris' core point)", () => {
    const gameState = createFreshSeasonOneGameState();
    const [sprinter, grinder] = gameState.players;

    gameState.seasonState.seasonSnapshots = [
      buildArchivedSnapshot({
        seasonId: "season-1",
        playerPerformances: [
          {
            playerId: sprinter!.id,
            playerName: sprinter!.name,
            teamId: null,
            teamCode: null,
            teamName: null,
            appearances: 1,
            totalContribution: 10,
            totalFinalScore: 0,
            averageContribution: 10,
            averageFinalScore: 0,
            top10Count: 0,
            mvpCount: 0,
            bestDisciplineId: null,
            bestDisciplineScore: null,
            disciplineBreakdown: [
              { disciplineId: "fechten", disciplineName: "Fechten", appearances: 1, totalContribution: 10, averageContribution: 10, averageFinalScore: 0 },
            ],
          },
          {
            playerId: grinder!.id,
            playerName: grinder!.name,
            teamId: null,
            teamCode: null,
            teamName: null,
            appearances: 5,
            totalContribution: 10,
            totalFinalScore: 0,
            averageContribution: 2,
            averageFinalScore: 0,
            top10Count: 0,
            mvpCount: 0,
            bestDisciplineId: null,
            bestDisciplineScore: null,
            disciplineBreakdown: [
              { disciplineId: "fechten", disciplineName: "Fechten", appearances: 5, totalContribution: 10, averageContribution: 2, averageFinalScore: 0 },
            ],
          },
        ],
      }),
    ];

    const rows = buildPlayerAllTimeDisciplineStats(gameState);
    const sprinterRow = rows.find((row) => row.playerId === sprinter!.id)!;
    const grinderRow = rows.find((row) => row.playerId === grinder!.id)!;

    // Gleiche Gesamtpunkte ...
    expect(sprinterRow.byDiscipline.fechten!.points).toBe(10);
    expect(grinderRow.byDiscipline.fechten!.points).toBe(10);
    // ... aber eine ganz andere Rate — genau der Unterschied, den Chris sehen will.
    expect(sprinterRow.byDiscipline.fechten!.pointsPerAppearance).toBe(10);
    expect(grinderRow.byDiscipline.fechten!.pointsPerAppearance).toBe(2);
    expect(sprinterRow.byDiscipline.fechten!.appearances).toBe(1);
    expect(grinderRow.byDiscipline.fechten!.appearances).toBe(5);
  });

  it("falls back to the live season ledger when the current season has no snapshot yet, without double-counting an already-archived one", () => {
    const gameState = createFreshSeasonOneGameState();
    const teamA = gameState.teams[0]!;
    const [playerA1] = gameState.players;

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
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
        disciplineId: "fechten",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 40,
        totalScore: 47,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-1",
        matchdayResultId: "result-1",
        teamId: teamA.teamId,
        playerId: playerA1!.id,
        activePlayerId: playerA1!.id,
        disciplineId: "fechten",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 30,
        finalPlayerScore: 33,
        mutatorPpsBonus: 0.3,
        scoreContribution: 7,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.7,
        createdAt: "2026-06-06T12:03:00.000Z",
      },
    ] as GameState["seasonState"]["playerDisciplinePerformances"];

    const liveRows = buildPlayerAllTimeDisciplineStats(gameState);
    const liveRow = liveRows.find((row) => row.playerId === playerA1!.id);
    expect(liveRow).toBeTruthy();
    expect(liveRow!.byDiscipline.fechten?.appearances).toBe(1);
    expect(liveRow!.byDiscipline.fechten?.points).toBeGreaterThan(0);

    // Dieselbe Saison jetzt ZUSÄTZLICH archiviert (Snapshot existiert) — die Ledger-Quelle darf
    // nicht mehr mitzählen, sonst stünde der Live-Spieltag doppelt in der All-Time-Summe.
    const archivedPoints = liveRow!.byDiscipline.fechten!.points;
    gameState.seasonState.seasonSnapshots = [
      buildArchivedSnapshot({
        seasonId: gameState.season.id,
        seasonName: gameState.season.name,
        playerPerformances: [
          {
            playerId: playerA1!.id,
            playerName: playerA1!.name,
            teamId: teamA.teamId,
            teamCode: teamA.shortCode,
            teamName: teamA.name,
            appearances: 1,
            totalContribution: archivedPoints,
            totalFinalScore: 33,
            averageContribution: archivedPoints,
            averageFinalScore: 33,
            top10Count: 1,
            mvpCount: 1,
            bestDisciplineId: "fechten",
            bestDisciplineScore: 33,
            disciplineBreakdown: [
              {
                disciplineId: "fechten",
                disciplineName: "Fechten",
                appearances: 1,
                totalContribution: archivedPoints,
                averageContribution: archivedPoints,
                averageFinalScore: 33,
              },
            ],
          },
        ],
      }),
    ];

    const archivedRows = buildPlayerAllTimeDisciplineStats(gameState);
    const archivedRow = archivedRows.find((row) => row.playerId === playerA1!.id)!;
    expect(archivedRow.byDiscipline.fechten!.appearances).toBe(1);
    expect(archivedRow.byDiscipline.fechten!.points).toBe(archivedPoints);
  });

  it("sums multiple disciplines of the same area into the area cell and keeps unrelated areas apart", () => {
    const gameState = createFreshSeasonOneGameState();
    const player = gameState.players[0]!;

    gameState.seasonState.seasonSnapshots = [
      buildArchivedSnapshot({
        seasonId: "season-1",
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: null,
            teamCode: null,
            teamName: null,
            appearances: 8,
            totalContribution: 30,
            totalFinalScore: 0,
            averageContribution: 0,
            averageFinalScore: 0,
            top10Count: 0,
            mvpCount: 0,
            bestDisciplineId: null,
            bestDisciplineScore: null,
            disciplineBreakdown: [
              // SPE-Bereich: fechten + staffel
              { disciplineId: "fechten", disciplineName: "Fechten", appearances: 5, totalContribution: 20, averageContribution: 4, averageFinalScore: 0 },
              { disciplineId: "staffel", disciplineName: "Staffel", appearances: 3, totalContribution: 10, averageContribution: 3.3, averageFinalScore: 0 },
              // POW-Bereich: bleibt davon unberührt
              { disciplineId: "hockey", disciplineName: "Hockey", appearances: 2, totalContribution: 6, averageContribution: 3, averageFinalScore: 0 },
            ],
          },
        ],
      }),
    ];

    const rows = buildPlayerAllTimeDisciplineStats(gameState);
    const row = rows.find((candidate) => candidate.playerId === player.id)!;

    expect(row.byArea.spe.points).toBe(30);
    expect(row.byArea.spe.appearances).toBe(8);
    expect(row.byArea.spe.pointsPerAppearance).toBe(3.75);
    expect(row.byArea.pow.points).toBe(6);
    expect(row.byArea.pow.appearances).toBe(2);
    expect(row.overall.points).toBe(36);
    expect(row.overall.appearances).toBe(10);
  });

  it("excludes players with zero appearances entirely (no fabricated rows)", () => {
    const gameState = createFreshSeasonOneGameState();
    const rows = buildPlayerAllTimeDisciplineStats(gameState);
    expect(rows.length).toBe(0);
  });
});
