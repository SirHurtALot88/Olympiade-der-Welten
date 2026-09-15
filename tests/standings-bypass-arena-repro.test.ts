import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { mapLegacyMatchdayResolvePreviewToResultPayload } from "@/lib/resolve/legacy-matchday-result-mapper";
import { ARENA_TEAM_POINTS } from "@/lib/resolve/battle-mode-arena-team-points";

/**
 * REGRESSIONSTEST FUER DEN STANDINGS-BYPASS-FUND (PR #935 Reviews, Plan-Dokument 15.09.:
 * docs/design/standings-bypass-fix-plan-15-09.md, Umsetzung derselben Runde).
 *
 * VOR DEM FIX (empirisch nachgewiesen im Recherche-Worktree, s. Plan Abschnitt 1.4): ein
 * Arena-Sieg (teamPoints: 2) kam in der Live-Preview korrekt an, wurde vom Persistenz-Mapper aber
 * verworfen (nur `rank` blieb uebrig), und BEIDE Lesepfade der gebuchten Saisontabelle
 * (`standings-preview-engine.ts` UND, direkt danach, die Nachbuchung in
 * `lib/foundation/season-points-ledger.ts` ueber `saisonstand-punkte-nachbuchung.ts`) leiteten die
 * gebuchten Punkte stattdessen aus dem PPS-Rang her. Ergebnis: `SeasonState.standings[team].points`
 * unterschied sich zwischen Arena-Sieger und -Verlierer um eine score-abhaengige Zufallszahl statt
 * um die vorgeschriebenen 2 Punkte (Chris' 2/1/0-Vorgabe vom 30.08., "das ist gesetzt").
 *
 * NACH DEM FIX (dieser Commit): `teamPoints`/`pointSource`/`resolutionSource`/`arenaMatchSeed`
 * laufen additiv durch `DisciplineResultWritePayload`/`DisciplineResultRecord` bis in die
 * Persistenz durch, und beide Lesepfade buchen bei `resolutionSource === "arena"` den
 * persistierten `teamPoints`-Wert direkt, statt ihn aus `rank` neu herzuleiten.
 *
 * Testkader bewusst minimal (2 Spieler je Seite Basketball als arena-aufgeloeste D1, "football"
 * als arena-fremde PPS-Kontroll-D2, deren Rohscores fuer beide Teams IDENTISCH sind) --
 * Fixture-Aufbau uebernommen aus tests/battle-mode-arena-resolve-engine.test.ts (`createContext`).
 * Football bekommt bewusst KEINE Spieler (`d2Scores: []`): beide Teams landen dadurch bei
 * Rohscore 0 und `rankDescendingSharedTies()` gibt beiden denselben (geteilten) Rang 1, also
 * denselben (PPS-)Punktewert -- das isoliert den Arena-Effekt (Differenz muss exakt 2 sein) von
 * jeder PPS-Differenz der Kontrolldisziplin. (Ein Versuch mit IDENTISCHEN, aber von Null
 * verschiedenen Rohscores schlug fehl: das Engine-interne Formkarten-/Intensitaets-Jitter ist pro
 * Team seed-abhaengig und liefert selbst bei gleichem Rohscore leicht unterschiedliche
 * `finalPreviewScore`-Werte -- z.B. 40,9 vs. 40,5 -- die dann doch zu unterschiedlichen Raengen
 * fuehren. Bei Rohscore 0 gibt es nichts, worauf ein Jitter wirken koennte.)
 */

vi.mock("@/lib/standings/season-standings-sheet", () => ({
  inspectSeasonStandingsSheet: vi.fn(async () => ({
    sourceKind: "season_standings",
    access: "local_csv",
    status: "ok",
    reason: null,
    sheetUrl: null,
    headers: [],
    sampleRows: [],
    mappedRows: [],
    expectedExportPaths: [],
    detectedTabKind: "season_standings",
  })),
  // PPS-Rang-Tabelle bei playerCount 2 (Basketball-Feldgroesse in diesem Test): Rang 1 = 6,6,
  // Rang 2 = 6,2 -- absichtlich NAHE beieinander und WEIT weg von 2/0, damit ein etwaiger
  // Rueckfall auf den alten Pfad sofort auffiele.
  inspectRankToPointsSheet: vi.fn(async () => ({
    sourceKind: "rank_to_points",
    access: "local_csv",
    status: "ok",
    reason: null,
    sheetUrl: null,
    headers: ["Spieleranzahl", "1.", "2."],
    sampleRows: [],
    mappedRows: [
      { raw: {}, playerCount: 2, pointsByRank: { "1.": 6.6, "2.": 6.2 } },
      { raw: {}, playerCount: 1, pointsByRank: { "1.": 6.6, "2.": 6.2 } },
    ],
    expectedExportPaths: [],
    detectedTabKind: "rank_to_points",
  })),
  mapSeasonStandingsRowsToTeams: vi.fn((rows: unknown[]) => ({
    mappedTeamsCount: rows.length,
    missingInSheet: [],
    missingInDb: [],
    duplicateSheetTeams: [],
    ambiguousMappings: [],
    mappingWarnings: [],
    rows,
  })),
}));

const D2_KONTROLL_DISZIPLIN = "football";

function createContext(input: {
  teamId: string;
  teamName: string;
  d1Scores: number[];
  d2Scores: number[];
  gameState?: GameState;
}): LegacyLineupLoadedContext {
  const d1DisciplineId = "basketball";
  const entries = [
    ...input.d1Scores.map((_score, index) => ({
      disciplineId: d1DisciplineId,
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}`,
      activePlayerId: `active-${input.teamId}-d1-${index}`,
    })),
    ...input.d2Scores.map((_score, index) => ({
      disciplineId: D2_KONTROLL_DISZIPLIN,
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d2-${index}`,
      activePlayerId: `active-${input.teamId}-d2-${index}`,
    })),
  ];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    gameState: input.gameState,
    entries,
    disciplinePlayerCounts: {
      [d1DisciplineId]: input.d1Scores.length,
      [D2_KONTROLL_DISZIPLIN]: input.d2Scores.length,
    },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId ?? `missing-${entry.playerId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({
        playerId: `${input.teamId}-d1-${index}`,
        disciplineId: d1DisciplineId,
        score,
      })),
      ...input.d2Scores.map((score, index) => ({
        playerId: `${input.teamId}-d2-${index}`,
        disciplineId: D2_KONTROLL_DISZIPLIN,
        score,
      })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamName },
    teamSeasonState: {
      id: `tss-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      cash: 100,
      budget: 100,
      rosterLimit: 10,
      playerOpt: 10,
    },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    })),
    disciplines: [
      { id: d1DisciplineId, name: "Basketball", category: "tactics" },
      { id: D2_KONTROLL_DISZIPLIN, name: "Football", category: "power" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: d1DisciplineId, originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: D2_KONTROLL_DISZIPLIN, originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      d1DisciplineId,
      d2DisciplineId: D2_KONTROLL_DISZIPLIN,
    },
    fatigueByPlayerId: null,
    fatigueSourceStatus: "missing_source",
    injuryByPlayerId: null,
    injurySourceStatus: "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    mutatorSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    teamPowerSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    formCards: [],
  } as unknown as LegacyLineupLoadedContext;
}

function buildBattleModeGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    rosters: [],
    players: [],
    teams: [],
    seasonState: {},
  } as unknown as GameState;
}

function buildPreview() {
  const gameState = buildBattleModeGameState();
  const arenaTeamPointsByTeamId = new Map([
    ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "save-1:season-1:matchday-1:arena:A-A:B-B" }],
    ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "save-1:season-1:matchday-1:arena:A-A:B-B" }],
  ]);

  return buildLegacyMatchdayResolvePreview(
    [
      // d1 (Basketball): A-A hat den niedrigeren Rohscore, gewinnt aber das Arena-Duell 2:0 --
      // genau der Fall, in dem PPS-Rang und Arena-Ergebnis auseinanderfallen.
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [], gameState }),
      // d2 (Football, PPS-Kontrolle): keine Spieler -- beide Teams bei Rohscore 0, shared tie,
      // damit die Kontrolldisziplin die Arena-Messung nicht verzerrt (s. Kommentar oben).
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [], gameState }),
    ],
    { arenaTeamPointsByDisciplineId: new Map([["basketball", arenaTeamPointsByTeamId]]) },
  );
}

describe("Standings-Bypass-Fix (15.09.): Arena-Teampunkte erreichen SeasonState.standings jetzt korrekt", () => {
  it("Schritt 1: die Live-Preview rechnet den Arena-Override korrekt (2/0, nicht 6,6/6,2) -- unveraendert vom Fix", () => {
    const preview = buildPreview();

    const basketball = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");
    const alpha = basketball?.teamResults.find((team) => team.teamId === "A-A");
    const beta = basketball?.teamResults.find((team) => team.teamId === "B-B");

    expect(alpha?.teamPoints).toBe(2);
    expect(beta?.teamPoints).toBe(0);
    expect(alpha?.resolutionSource).toBe("arena");
    // Die Live-Preview kennt trotzdem einen (PPS-)Rang -- B-B hat den hoeheren Score (90 vs 15)
    // und bekommt trotzdem Rang 1, waehrend der Arena-Sieger A-A auf Rang 2 steht. Der FIX liest
    // fuer arena-aufgeloeste Zeilen `teamPoints` statt diesen Rang -- der Rang selbst bleibt
    // unveraendert bestehen (Ansatz (b), Rang faelschen, wurde im Plan verworfen).
    expect(alpha?.rank).toBe(2);
    expect(beta?.rank).toBe(1);

    const alphaTeamResult = preview.teamResults.find((team) => team.teamId === "A-A");
    const betaTeamResult = preview.teamResults.find((team) => team.teamId === "B-B");
    expect(alphaTeamResult?.d1Points).toBe(2);
    expect(betaTeamResult?.d1Points).toBe(0);
  });

  it("Schritt 2 (FIX): der Persistenz-Mapper reicht teamPoints/pointSource/resolutionSource/arenaMatchSeed jetzt durch", () => {
    const preview = buildPreview();

    const bundle = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview,
      sourceVersion: "test-v1",
    });

    const alphaBasketballRow = bundle.disciplineResultPayloads.find(
      (row) => row.teamId === "A-A" && row.disciplineId === "basketball",
    );
    const betaBasketballRow = bundle.disciplineResultPayloads.find(
      (row) => row.teamId === "B-B" && row.disciplineId === "basketball",
    );
    expect(alphaBasketballRow).toBeDefined();
    expect(betaBasketballRow).toBeDefined();

    // VORHER (Befund): diese vier Felder existierten am Zieltyp gar nicht (TypeScript liess den
    // Zugriff nur per `as any`-Cast zu) -- der korrekt gerechnete Arena-Wert ging hier verloren.
    // NACHHER (Fix): additiv durchgereicht, direkt typisiert.
    expect(alphaBasketballRow?.teamPoints).toBe(2);
    expect(betaBasketballRow?.teamPoints).toBe(0);
    expect(alphaBasketballRow?.resolutionSource).toBe("arena");
    expect(alphaBasketballRow?.pointSource).toBe("battle_mode_arena_win_draw_loss");
    expect(alphaBasketballRow?.arenaMatchSeed).toBe("save-1:season-1:matchday-1:arena:A-A:B-B");

    // Der PPS-Rang selbst bleibt unveraendert daneben stehen (additiv, kein Feld wurde ersetzt) --
    // der Arena-Verlierer B-B hat den hoeheren Rohscore und damit weiterhin Rang 1.
    expect(alphaBasketballRow?.rank).toBe(2);
    expect(betaBasketballRow?.rank).toBe(1);

    // Football (arena-fremd, PPS, absichtlich ohne Spieler -- s. Kommentar oben):
    // `resolutionSource` bleibt fuer eine PPS-Zeile "pps" -- der Fix darf die nicht-arena-
    // aufgeloesten Disziplinen nicht anders behandeln als vor dem Fix (kein Override-Zweig
    // greift hier, weil `resolutionSource !== "arena"`).
    const alphaFootballRow = bundle.disciplineResultPayloads.find(
      (row) => row.teamId === "A-A" && row.disciplineId === "football",
    );
    expect(alphaFootballRow?.resolutionSource).toBe("pps");
  });

  it("Schritt 3 (E2E, FIX): buildStandingsPreview UND executeStandingsApply (inkl. Nachbuchung) buchen jetzt exakt 2,0 statt einer PPS-Zufallszahl", async () => {
    const { buildStandingsPreview } = await import("@/lib/standings/standings-preview-engine");
    const { executeStandingsApply } = await import("@/lib/standings/standings-apply-service");

    const preview = buildPreview();
    const bundle = mapLegacyMatchdayResolvePreviewToResultPayload({ preview, sourceVersion: "test-v1" });

    const now = "2026-06-04T00:00:00.000Z";
    const save: PersistedSaveGame = {
      saveId: "save-1",
      name: "Local",
      status: "active",
      createdAt: now,
      updatedAt: now,
      gameState: {
        season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
        seasonState: {
          seasonId: "season-1",
          schedule: [],
          // Baseline VOR dem Spieltag: beide Teams bei 0. Ein korrekter 2:0-Arena-Sieg muss also
          // A-A auf "2 + Football-PPS-Anteil" heben und B-B auf "0 + Football-PPS-Anteil" --
          // dieselbe Football-Zahl fuer beide (shared tie), also Differenz exakt 2.
          standings: {
            "A-A": { points: 0, rank: null },
            "B-B": { points: 0, rank: null },
          },
          disciplineSchedule: [
            {
              seasonId: "season-1",
              matchdayId: "matchday-1",
              matchdayIndex: 1,
              matchdayLabel: "Spieltag 1",
              discipline1: { disciplineId: "basketball", displayName: "Basketball", order: 1, playerCount: 2, category: "tactics" },
              discipline2: { disciplineId: "football", displayName: "Football", order: 2, playerCount: 1, category: "power" },
              sourceStatus: "test",
              sourceNote: "test",
            },
          ],
          lineupDrafts: [],
          matchdayResults: [{ ...bundle.matchdayResultPayload, createdAt: now, updatedAt: now }],
          disciplineResults: bundle.disciplineResultPayloads.map((payload) => ({ ...payload, createdAt: now })),
          playerDisciplinePerformances: bundle.playerPerformancePayloads.map((payload) => ({ ...payload, createdAt: now })),
          disciplineHighlights: [],
          resultAuditLogs: [],
          standingsApplyLogs: [],
        },
        matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
        teams: [
          { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "id-a", humanControlled: true, rosterLimit: 12 },
          { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "id-b", humanControlled: true, rosterLimit: 12 },
        ],
        teamIdentities: [],
        players: [],
        disciplines: [],
        rosters: [],
        contracts: [],
        transferListings: [],
        transferHistory: [],
        logs: [],
        mappingReport: {
          mappingSource: "test",
          teamSource: "test",
          generatedAt: now,
          processedMappingRows: 0,
          importedPlayerCount: 0,
          matchedRosterCount: 0,
          teamCount: 2,
          unmappedPlayers: [],
          teamsWithoutPlayers: [],
          mappingRowsWithoutPlayerMatch: [],
          duplicateMappedPlayers: [],
          unknownTeamCodes: [],
          duplicateTeamCodes: [],
          warnings: [],
        },
      } as unknown as GameState,
    };

    const persistence = {
      bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
      getActiveSave: vi.fn(() => save),
      getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
      saveSingleplayerState: vi.fn((saveId: string, nextGameState: GameState) => {
        save.gameState = nextGameState;
        return save;
      }),
      createSave: vi.fn(),
      createFreshSeasonOneSave: vi.fn(),
      cloneSave: vi.fn(),
      activateSave: vi.fn(),
      listSaves: vi.fn(() => []),
    };

    const standingsPreview = await buildStandingsPreview(
      { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", source: "sqlite" },
      undefined,
      persistence as never,
    );

    const alphaItem = standingsPreview.items.find((item) => item.teamId === "A-A");
    const betaItem = standingsPreview.items.find((item) => item.teamId === "B-B");

    // DER FIX, ZAHLENFEST, DIREKT NACH DER PREVIEW (Pfad A, standings-preview-engine.ts): A-A
    // gewinnt sein Arena-Duell 2:0 gegen B-B. Football liefert (shared tie) fuer beide denselben
    // PPS-Anteil, faellt also aus der DIFFERENZ komplett heraus -- was uebrig bleibt, ist exakt der
    // Arena-Effekt.
    const previewDiff = roundToOneDecimal((alphaItem?.pointsDelta ?? 0) - (betaItem?.pointsDelta ?? 0));
    expect(previewDiff).toBeCloseTo(ARENA_TEAM_POINTS.win - ARENA_TEAM_POINTS.loss, 1);

    const applyResult = await executeStandingsApply(
      {
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        source: "sqlite",
        execute: true,
        confirm: "APPLY_LOCAL_STANDINGS",
      },
      persistence as never,
    );

    expect(applyResult.applied).toBe(true);
    const bookedStandings = save.gameState.seasonState.standings as Record<string, { points: number }>;

    // DER FIX, ZAHLENFEST, NACH DER NACHBUCHUNG (Pfad B, season-points-ledger.ts ueber
    // saisonstand-punkte-nachbuchung.ts -- laeuft in `executeStandingsApply` automatisch NACH der
    // Preview-Buchung und ist genau der Ort, an dem ein Fix, der nur Pfad A patcht, sofort wieder
    // ueberschrieben wuerde, s. Plan Abschnitt 1.3/1.4). Die tatsaechlich in
    // `SeasonState.standings` GEBUCHTE Differenz muss ebenfalls exakt 2 sein.
    const bookedDiff = roundToOneDecimal(bookedStandings["A-A"].points - bookedStandings["B-B"].points);
    expect(bookedDiff).toBeCloseTo(ARENA_TEAM_POINTS.win - ARENA_TEAM_POINTS.loss, 1);
  });
});

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
