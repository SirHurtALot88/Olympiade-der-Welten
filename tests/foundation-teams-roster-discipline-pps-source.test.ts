import { describe, expect, it } from "vitest";

import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { buildPlayerDirectorySlice } from "@/lib/foundation/player-directory-slice";
import type { PlayerDirectorySliceResponse } from "@/lib/foundation/player-directory-slice";
import {
  buildRosterDisciplinePpsByAxis,
  resolveRosterDisciplinePointsSource,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Quelle der Disziplin-PPs in der Kader-/Verträge-Rostertabelle (Teams-Tab,
 * ausklappbares PPs-Panel mit der Disziplin-Liste je Achse).
 *
 * Gleiche Ursache wie in der Spielerliste (siehe
 * `tests/foundation-players-discipline-pps-source.test.ts`): Der
 * Foundation-Client lädt per Default den KOMPAKTEN Payload
 * (`compactFoundationInitialGameState`). Der beschneidet
 * `matchdayResults`/`disciplineResults` auf den AKTIVEN Spieltag und wirft
 * `persistedSeasonDerivations` weg. Ein clientseitig gebauter Saison-Ledger
 * sieht davon nur den aktiven Spieltag — und ist, solange dieser noch nicht
 * ausgewertet ist, KOMPLETT leer. Genau daran hing das PPs-Panel: überall
 * "—", während die PPS-Spalte derselben Zeile (Server-Ratings-Slice) echte
 * Saisonwerte zeigte.
 */

/** Spieltag 1 ausgewertet, aktiver Spieltag ist 2 — der Normalfall beim Blättern im Kader. */
function buildGameStateWithPlayedMatchday() {
  const gameState = createFreshSeasonOneGameState();
  const teamA = gameState.teams[0]!;
  const teamB = gameState.teams[1]!;
  const [playerA1, playerA2, playerB1] = gameState.players.slice(0, 3);

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
      scoreContribution: 1,
      rankInTeam: 1,
      rankInDiscipline: 7,
      isTop10: true,
      isMvpCandidate: false,
      storyWeight: 0.5,
      createdAt: "2026-06-06T12:05:00.000Z",
    },
  ] as GameState["seasonState"]["playerDisciplinePerformances"];

  gameState.matchdayState = { ...gameState.matchdayState, matchdayId: "matchday-2" };

  return { gameState, playerId: playerA1!.id };
}

/**
 * Liest die PPs einer Disziplin so aus, wie es das aufgeklappte PPs-Panel in
 * `FoundationTeamsDetailPanel.tsx` tut: über die Achsen-Gruppen der Zeile.
 * `null` = die Disziplin gehört gar nicht zur Zeile.
 */
function readDisciplinePpsFromRow(
  axisGroups: ReturnType<typeof buildRosterDisciplinePpsByAxis>,
  disciplineId: string,
): number | null {
  for (const axis of axisGroups) {
    const hit = axis.disciplines.find((discipline) => discipline.id === disciplineId);
    if (hit) {
      return hit.pps;
    }
  }
  return null;
}

/** Eine Zelle der Rostertabelle nachbauen — exakt der Weg, den der Teams-Roster-Hook geht. */
function buildRosterRowDisciplinePps(input: {
  gameState: GameState;
  playerId: string;
  playerDirectorySlice: {
    payload: unknown;
    error: string | null;
    disciplinePointsByPlayerId: Record<string, Record<string, number>>;
  };
  ledgerPointsByDiscipline: Record<string, number> | null | undefined;
}) {
  return buildRosterDisciplinePpsByAxis({
    disciplines: input.gameState.disciplines,
    pointsByDiscipline: resolveRosterDisciplinePointsSource({
      playerId: input.playerId,
      playerDirectorySlice: input.playerDirectorySlice,
      ledgerPointsByDiscipline: input.ledgerPointsByDiscipline,
    }),
    pointsByArea: null,
    axisTotals: { pow: null, spe: null, men: null, soc: null },
  });
}

/** Der Zustand vor dem Fix: kein Slice, nur der (beschnittene) Client-Ledger. */
const SLICE_ABSENT = {
  payload: null,
  error: null,
  disciplinePointsByPlayerId: {} as Record<string, Record<string, number>>,
};

describe("Teams-Kadertabelle: Herkunft der Disziplin-PPs", () => {
  it("belegt die Ursache: der kompakte Client-Payload leert den Saison-Ledger", () => {
    const { gameState, playerId } = buildGameStateWithPlayedMatchday();

    const fullLedger = buildSeasonPointsLedger(gameState);
    // Gegenprobe zur Schlüssel-Mismatch-Vermutung: der Ledger-Schlüssel IST die Katalog-ID.
    expect(gameState.disciplines.map((discipline) => discipline.id)).toContain("mini-dm");
    const fullPoints = fullLedger.playerSummariesByPlayerId.get(playerId)?.pointsByDiscipline;
    expect(fullPoints?.["mini-dm"]).toBeGreaterThan(0);

    const compactGameState = compactFoundationInitialGameState(gameState);
    // Der Kompakt-Payload behält nur den AKTIVEN Spieltag (matchday-2, unausgewertet).
    expect(compactGameState.seasonState.matchdayResults).toHaveLength(0);
    expect(compactGameState.seasonState.disciplineResults).toHaveLength(0);
    expect(compactGameState.seasonState.persistedSeasonDerivations).toBeUndefined();

    const compactLedger = buildSeasonPointsLedger(compactGameState);
    expect(compactLedger.playerSummariesByPlayerId.get(playerId)).toBeUndefined();

    // Genau so entstand das Bild aus dem Bugreport: das PPs-Panel zeigte für
    // jede Disziplin 0 PPs — und die Zelle rendert dafür "—".
    const brokenAxisGroups = buildRosterRowDisciplinePps({
      gameState: compactGameState,
      playerId,
      playerDirectorySlice: SLICE_ABSENT,
      ledgerPointsByDiscipline:
        compactLedger.playerSummariesByPlayerId.get(playerId)?.pointsByDiscipline ?? null,
    });
    expect(readDisciplinePpsFromRow(brokenAxisGroups, "mini-dm")).toBe(0);
    expect(
      brokenAxisGroups.every((axis) => axis.disciplines.every((discipline) => discipline.pps === 0)),
    ).toBe(true);
  });

  it("liefert der Directory-Slice die Disziplin-PPs, die der Client-Ledger nicht mehr kennt", () => {
    const { gameState, playerId } = buildGameStateWithPlayedMatchday();

    // Der Slice läuft SERVERSEITIG auf dem vollständigen Save.
    const slice = buildPlayerDirectorySlice({
      gameState,
      saveId: "save-teams-roster-discipline-pps-test",
      seasonId: gameState.season.id,
      contentSignature: "test-signature-teams-roster-discipline-pps",
    });
    const ledgerPoints = buildSeasonPointsLedger(gameState).playerSummariesByPlayerId.get(playerId)
      ?.pointsByDiscipline;
    // Eine Quelle pro Größe: der Slice trägt exakt die Ledger-Werte weiter.
    expect(slice.disciplinePointsByPlayerId[playerId]?.["mini-dm"]).toBeCloseTo(
      ledgerPoints!["mini-dm"]!,
      5,
    );

    // Der Client hat weiterhin nur den kompakten GameState — die Zeile zieht
    // ihre Werte trotzdem aus dem Slice.
    const compactGameState = compactFoundationInitialGameState(gameState);
    const compactLedger = buildSeasonPointsLedger(compactGameState);
    const axisGroups = buildRosterRowDisciplinePps({
      gameState: compactGameState,
      playerId,
      playerDirectorySlice: {
        payload: slice as PlayerDirectorySliceResponse,
        error: null,
        disciplinePointsByPlayerId: slice.disciplinePointsByPlayerId,
      },
      ledgerPointsByDiscipline:
        compactLedger.playerSummariesByPlayerId.get(playerId)?.pointsByDiscipline ?? null,
    });
    expect(readDisciplinePpsFromRow(axisGroups, "mini-dm")).toBeCloseTo(ledgerPoints!["mini-dm"]!, 1);
    // Nicht gespielte Disziplinen bleiben 0 — es wird nichts erfunden.
    expect(readDisciplinePpsFromRow(axisGroups, "hockey")).toBe(0);
    // Fremde Disziplin gehört weiterhin nicht zur Zeile.
    expect(readDisciplinePpsFromRow(axisGroups, "gibt-es-nicht")).toBeNull();
  });

  it("hält die Quellenwahl eindeutig: Slice schlägt Ledger, Ledger nur ohne Slice", () => {
    const sliceRow = { "mini-dm": 7.5 };
    const ledgerRow = { "mini-dm": 1.1 };

    // Slice da → Slice gewinnt, auch wenn der Ledger etwas anderes behauptet.
    expect(
      resolveRosterDisciplinePointsSource({
        playerId: "player-1",
        playerDirectorySlice: {
          payload: {},
          error: null,
          disciplinePointsByPlayerId: { "player-1": sliceRow },
        },
        ledgerPointsByDiscipline: ledgerRow,
      }),
    ).toBe(sliceRow);

    // Slice da, Spieler fehlt darin → er hat keine PPs geholt. Kein Rückfall auf
    // den beschnittenen Ledger, sonst hinge die Zeile wieder an der kaputten Quelle.
    expect(
      resolveRosterDisciplinePointsSource({
        playerId: "player-2",
        playerDirectorySlice: {
          payload: {},
          error: null,
          disciplinePointsByPlayerId: { "player-1": sliceRow },
        },
        ledgerPointsByDiscipline: ledgerRow,
      }),
    ).toBeNull();

    // Slice-Fehler → Ledger als Fallback (Vollzustand-Pfade bleiben bedient).
    expect(
      resolveRosterDisciplinePointsSource({
        playerId: "player-1",
        playerDirectorySlice: {
          payload: {},
          error: "player_directory_slice_failed",
          disciplinePointsByPlayerId: { "player-1": sliceRow },
        },
        ledgerPointsByDiscipline: ledgerRow,
      }),
    ).toBe(ledgerRow);

    // Kein Slice geladen (Home-V2-/Markt-Kacheln) → Ledger als Fallback.
    expect(
      resolveRosterDisciplinePointsSource({
        playerId: "player-1",
        playerDirectorySlice: SLICE_ABSENT,
        ledgerPointsByDiscipline: ledgerRow,
      }),
    ).toBe(ledgerRow);
  });
});
