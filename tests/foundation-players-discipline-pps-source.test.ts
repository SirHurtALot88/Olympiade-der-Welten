import { describe, expect, it } from "vitest";

import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { buildPlayerDirectorySlice } from "@/lib/foundation/player-directory-slice";
import { getRowDisciplinePps } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";
import { buildRosterDisciplinePpsByAxis } from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Quelle der Disziplin-PPs in der Spielerliste (aufklappbare Achsen-Spalten).
 *
 * Hintergrund: Der Foundation-Client lädt per Default den KOMPAKTEN Payload
 * (`compactFoundationInitialGameState`). Der beschneidet
 * `matchdayResults`/`disciplineResults` auf den AKTIVEN Spieltag und wirft
 * `persistedSeasonDerivations` weg. Ein clientseitig gebauter Saison-Ledger
 * sieht davon nur den aktiven Spieltag — und ist, solange dieser noch nicht
 * ausgewertet ist, KOMPLETT leer. Genau daran hingen die aufgeklappten
 * Disziplin-Spalten: überall "—", während die PPS-Spalte (aus dem
 * Server-Slice) echte Saisonwerte zeigte.
 */

/** Spieltag 1 ausgewertet, aktiver Spieltag ist 2 — der Normalfall beim Blättern in der Liste. */
function buildGameStateWithPlayedMatchday() {
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
  ] as GameState["seasonState"]["matchdayResults"];

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
  ] as GameState["seasonState"]["disciplineResults"];

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
  ] as GameState["seasonState"]["playerDisciplinePerformances"];

  gameState.matchdayState = { ...gameState.matchdayState, matchdayId: "matchday-2" };

  return { gameState, playerId: playerA1!.id };
}

/** Eine Zeile der Spielerliste nachbauen — exakt der Weg, den der Verzeichnis-Hook geht. */
function buildRowFromPointsByDiscipline(
  gameState: GameState,
  pointsByDiscipline: Record<string, number> | null,
) {
  return {
    disciplinePpsByAxis: buildRosterDisciplinePpsByAxis({
      disciplines: gameState.disciplines,
      pointsByDiscipline,
      pointsByArea: null,
      axisTotals: { pow: null, spe: null, men: null, soc: null },
    }),
  };
}

describe("Spielerliste: Herkunft der Disziplin-PPs", () => {
  it("belegt die Ursache: der kompakte Client-Payload leert den Saison-Ledger", () => {
    const { gameState, playerId } = buildGameStateWithPlayedMatchday();

    const fullLedger = buildSeasonPointsLedger(gameState);
    const fullSummary = fullLedger.playerSummariesByPlayerId.get(playerId);
    // Gegenprobe zur Mismatch-Vermutung: der Ledger-Schlüssel IST die Katalog-ID.
    expect(gameState.disciplines.map((discipline) => discipline.id)).toContain("mini-dm");
    expect(fullSummary?.pointsByDiscipline["mini-dm"]).toBeCloseTo(4.9, 5);

    const compactGameState = compactFoundationInitialGameState(gameState);
    // Der Kompakt-Payload behält nur den AKTIVEN Spieltag (matchday-2, unausgewertet).
    expect(compactGameState.seasonState.matchdayResults).toHaveLength(0);
    expect(compactGameState.seasonState.disciplineResults).toHaveLength(0);
    expect(compactGameState.seasonState.persistedSeasonDerivations).toBeUndefined();

    const compactLedger = buildSeasonPointsLedger(compactGameState);
    expect(compactLedger.playerSummariesByPlayerId.get(playerId)).toBeUndefined();

    // Und genau so entstand das Bild aus dem Bugreport: überall "—" (= 0 PPs).
    const compactRow = buildRowFromPointsByDiscipline(compactGameState, null);
    expect(getRowDisciplinePps(compactRow, "mini-dm")).toBe(0);
  });

  it("liefert der Directory-Slice die Disziplin-PPs, die der Client-Ledger nicht mehr kennt", () => {
    const { gameState, playerId } = buildGameStateWithPlayedMatchday();

    // Der Slice läuft SERVERSEITIG auf dem vollständigen Save.
    const slice = buildPlayerDirectorySlice({
      gameState,
      saveId: "save-discipline-pps-test",
      seasonId: gameState.season.id,
      contentSignature: "test-signature-discipline-pps",
    });

    expect(slice.disciplinePointsByPlayerId[playerId]?.["mini-dm"]).toBeCloseTo(4.9, 5);
    // Dünn besetzt: Disziplinen ohne Punkte stehen nicht im Payload …
    expect(slice.disciplinePointsByPlayerId[playerId]).not.toHaveProperty("hockey");
    // … und Spieler ohne jede Punkte fehlen ganz (statt mit leerem Objekt dabei zu sein).
    const scorerIds = new Set(Object.keys(slice.disciplinePointsByPlayerId));
    expect(scorerIds.size).toBe(4);

    // Die Zeile der Spielerliste zieht ihre Werte aus dem Slice — auch wenn der
    // Client nur den kompakten GameState hat.
    const compactGameState = compactFoundationInitialGameState(gameState);
    const row = buildRowFromPointsByDiscipline(
      compactGameState,
      slice.disciplinePointsByPlayerId[playerId] ?? null,
    );
    expect(getRowDisciplinePps(row, "mini-dm")).toBeCloseTo(4.9, 5);
    // Nicht gespielte Disziplinen bleiben 0 — es wird nichts erfunden.
    expect(getRowDisciplinePps(row, "hockey")).toBe(0);
    // Fremde Disziplin gehört weiterhin nicht zur Zeile.
    expect(getRowDisciplinePps(row, "gibt-es-nicht")).toBeNull();
  });
});
