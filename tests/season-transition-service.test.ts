import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { isTransferMarketPhaseOpen } from "@/lib/market/transfer-window-policy";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  advanceSeasonTransitionStep,
  advanceSeasonTransitionToTransferWindow,
  buildSeasonTransitionPreview,
  resolveGamePhase,
  SEASON_TRANSITION_STEPS,
  startSeasonTransition,
} from "@/lib/season/season-transition-service";

// `node:crypto` ist ESM — `vi.spyOn` scheitert dort an "Module namespace is not configurable"
// (die Exporte sind read-only). `vi.mock` ersetzt das Modul stattdessen komplett; `uuidCounter`
// lebt auf Modulebene, damit der Gleichheitstest unten ihn zwischen den beiden Laeufen (alter Weg
// vs. neuer, gebatchter Weg) gezielt auf denselben Startwert zuruecksetzen kann — nur so ziehen
// beide Laeufe dieselbe UUID-Sequenz und landen im selben GameState.
let uuidCounter = 0;
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomUUID: () => `test-uuid-${uuidCounter++}` as ReturnType<typeof actual.randomUUID>,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

function gameState(input?: { completed?: boolean; gamePhase?: GameState["gamePhase"] }): GameState {
  const completed = input?.completed ?? false;
  return {
    ...(input?.gamePhase ? { gamePhase: input.gamePhase } : {}),
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: completed ? 2 : 1, matchdayIds: ["md-1", "md-2"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [
        { id: "fixture-1", homeTeamId: "team-1", awayTeamId: "team-2", matchdayId: "md-1", status: "resolved" },
        { id: "fixture-2", homeTeamId: "team-1", awayTeamId: "team-2", matchdayId: "md-2", status: completed ? "resolved" : "scheduled" },
      ],
      standings: { "team-1": { points: 3, rank: 1 }, "team-2": { points: 0, rank: 2 } },
      lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2", teamId: "team-1", status: "submitted", entries: [], createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" }],
      formCards: [{ cardId: "form-1", seasonId: "season-1", teamId: "team-1", playerId: "player-1", type: "buff", value: 1 } as never],
    },
    matchdayState: { matchdayId: completed ? "md-2" : "md-1", status: completed ? "resolved" : "planning", pendingTeamIds: completed ? [] : ["team-1"], resolvedFixtureIds: completed ? ["fixture-2"] : [] },
    teams: [
      { teamId: "team-1", shortCode: "T-1", name: "Team One", budget: 100, cash: 50, identityId: "identity-1", humanControlled: true, rosterLimit: 12 },
      { teamId: "team-2", shortCode: "T-2", name: "Team Two", budget: 100, cash: 40, identityId: "identity-2", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [{ id: "r-1", teamId: "team-1", playerId: "player-1", salary: 1, upkeep: 1, currentValue: 10, contractLength: 1, roleTag: "starter", joinedSeasonId: "season-1" }],
    contracts: [],
    transferListings: [],
    transferHistory: [{ transferId: "t-1", playerId: "player-x", transferType: "buy", toTeamId: "team-1", fromTeamId: null, fee: 10, seasonId: "season-1", createdAt: "2026-06-11T00:00:00.000Z", source: "test" } as never],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
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
  };
}

function save(input?: { completed?: boolean; gamePhase?: GameState["gamePhase"] }): PersistedSaveGame {
  return {
    saveId: "save-1",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    gameState: gameState(input),
  };
}

function persistenceMock(sourceSave: PersistedSaveGame) {
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => ({
    ...sourceSave,
    saveId,
    gameState: nextGameState,
  }));
  return {
    persistence: { saveSingleplayerState } as unknown as PersistenceService,
    saveSingleplayerState,
  };
}

/**
 * Wie `persistenceMock`, aber mit Gedaechtnis: `advanceSeasonTransitionToTransferWindow` laeuft
 * mehrere Stationen und liest den Spielstand zwischen den Schritten neu ein. Ein Mock, der nur
 * schreibt, liesse die Schleife auf der Startphase stehen.
 */
function statefulPersistenceMock(sourceSave: PersistedSaveGame) {
  let current = sourceSave;
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => {
    current = { ...current, saveId, gameState: nextGameState };
    return current;
  });
  return {
    persistence: {
      saveSingleplayerState,
      getSaveById: (saveId: string) => (saveId === current.saveId ? current : null),
    } as unknown as PersistenceService,
    saveSingleplayerState,
    gespeichertePhasen: () => saveSingleplayerState.mock.calls.map((call) => call[1].gamePhase),
  };
}

describe("season transition service", () => {
  it("reads gamePhase and falls back to season_active for legacy saves", () => {
    expect(resolveGamePhase(gameState())).toBe("season_active");
    expect(resolveGamePhase(gameState({ gamePhase: "season_review" }))).toBe("season_review");
  });

  it("blocks the season close gate while the last matchday is not complete", () => {
    const preview = buildSeasonTransitionPreview(save({ completed: false }));

    expect(preview.canCompleteSeason).toBe(false);
    expect(preview.disabledReason).toBe("last_matchday_not_completed");
    expect(preview.steps[0]?.status).toBe("blocked");
  });

  it("enables the season close gate when all last-matchday data is resolved", () => {
    const preview = buildSeasonTransitionPreview(save({ completed: true }));

    expect(preview.canCompleteSeason).toBe(true);
    expect(preview.disabledReason).toBeNull();
    expect(preview.steps.map((step) => step.stepId)).toEqual([
      "season_check",
      "season_review",
      "season_rewards",
      "player_development",
      "preseason_management",
      "transfer_sell_phase",
      "transfer_buy_phase",
      "lineup_setup",
      "next_season_ready",
    ]);
  });

  it("keeps completed/review phases transition-ready after reload even if fixture flags are stale", () => {
    const sourceSave = save({ completed: false, gamePhase: "season_completed" });
    const preview = buildSeasonTransitionPreview(sourceSave);

    expect(preview.gamePhase).toBe("season_completed");
    expect(preview.canCompleteSeason).toBe(true);
    expect(preview.disabledReason).toBeNull();
  });

  it("stores transition currentStep without productive domain writes", () => {
    const sourceSave = save({ completed: true });
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    const result = startSeasonTransition(sourceSave, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    if (!savedState) throw new Error("Expected transition metadata to be saved.");
    expect(savedState.gamePhase).toBe("season_review");
    expect(savedState.seasonTransition?.currentStep).toBe("season_review");
    expect(savedState.seasonTransition?.fromSeasonId).toBe("season-1");
    expect(savedState.seasonTransition?.toSeasonId).toBe("season-2");
    expect(savedState.season.id).toBe(sourceSave.gameState.season.id);
    expect(savedState.rosters).toEqual(sourceSave.gameState.rosters);
    expect(savedState.transferHistory).toEqual(sourceSave.gameState.transferHistory);
    expect(savedState.teams).toEqual(sourceSave.gameState.teams);
  });

  /**
   * GEMELDET: „wenn hier gesagt wird sponsoren + preisgeld dann training und dann kader, würde
   * ich erwarten dass wenn ich da drauf gehe auch meine verträge verlängern und spieler
   * verkaufen kann! sonst ist das n fehler im system."
   *
   * Vom Saisonende bis zur ersten Phase mit offenem Transferfenster sind es VIER Stationen.
   * Einzeln anklicken ist der Weg des Cockpit-Assistenten; der Saisonabschluss-Bildschirm
   * stellt eine andere Frage („ich will jetzt meine Vertraege machen") und beantwortet sie in
   * einem Zug.
   */
  it("schaltet in einem Zug bis zum offenen Transferfenster durch — und schreibt dabei nur EINMAL", () => {
    const sourceSave = save({ completed: true });
    const { persistence, saveSingleplayerState, gespeichertePhasen } = statefulPersistenceMock(sourceSave);

    const result = advanceSeasonTransitionToTransferWindow(sourceSave, persistence);

    expect(result.applied).toBe(true);
    expect(result.gamePhase).toBe("preseason_management");
    // PERF: die vier Hops (season_review, season_rewards, player_development,
    // preseason_management) laufen komplett im Speicher durch — geschrieben wird der Spielstand
    // erst am Ende, EINMAL, nicht mehr nach jedem einzelnen Hop. Auf der Platte landet direkt die
    // Endphase, keine der Zwischenphasen ist je sichtbar (siehe `advanceSeasonTransitionToTransferWindow`,
    // PERF-Kommentar dort, fuer die Zeitmessung, die diesen Umbau ausgeloest hat).
    expect(gespeichertePhasen()).toEqual(["preseason_management"]);
    expect(saveSingleplayerState).toHaveBeenCalledTimes(1);
  });

  /**
   * DER BEWEIS, dass der Umbau auf Batch-Schreiben das FACHERGEBNIS nicht veraendert hat: derselbe
   * Ausgangs-Save, einmal ueber den alten Weg nachgebaut (`advanceSeasonTransitionStep` — schreibt
   * nach wie vor pro Aufruf einmal — Hop fuer Hop mit Schreiben + Neuladen dazwischen, genau das
   * Muster, das `advanceSeasonTransitionToTransferWindow` VOR diesem Umbau selbst gefahren ist),
   * einmal ueber die neue gebatchte Schleife. Beide muessen im BYTE-IDENTISCHEN GameState landen.
   *
   * `randomUUID` und die Systemzeit werden fuer beide Laeufe deterministisch gemacht (gleicher
   * Zaehler ab 0, gleiche fixe Zeit) — sonst wichen `transitionId` und die Progression-Event-IDs
   * allein durch den doppelten Aufruf voneinander ab, obwohl die Fachlogik identisch rechnet.
   */
  it("liefert exakt denselben Endzustand wie der alte, schrittweise persistierende Ablauf", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));

    try {
      // Alter Weg: Hop -> schreiben -> `getSaveById` neu laden -> naechster Hop. Die alte
      // `advanceSeasonTransitionToTransferWindow` rechnete VOR der Schleife bereits einmal
      // `buildSeasonTransitionPreview` (fuer den Rueckgabewert, falls das Fenster schon offen
      // ist) — dieser verworfene Aufruf zieht ebenfalls eine UUID und gehoert fuer eine
      // lueckenlose Nachbildung mit dazu, sonst laufen beide Seiten um eins versetzt.
      uuidCounter = 0;
      const manualRun = statefulPersistenceMock(save({ completed: true }));
      let manualCurrent: PersistedSaveGame = manualRun.persistence.getSaveById("save-1")!;
      buildSeasonTransitionPreview(manualCurrent);
      for (let hop = 0; hop < SEASON_TRANSITION_STEPS.length; hop += 1) {
        if (isTransferMarketPhaseOpen(manualCurrent.gameState)) break;
        const step = advanceSeasonTransitionStep(manualCurrent, manualRun.persistence);
        if (!("applied" in step) || !step.applied) break;
        const reloaded = manualRun.persistence.getSaveById(manualCurrent.saveId);
        if (!reloaded) break;
        manualCurrent = reloaded;
      }
      expect(manualCurrent.gameState.gamePhase).toBe("preseason_management");

      // Neuer Weg: dieselbe Ausgangslage, einmal gebatcht durchgereicht.
      uuidCounter = 0;
      const batchedRun = statefulPersistenceMock(save({ completed: true }));
      const batchedResult = advanceSeasonTransitionToTransferWindow(
        batchedRun.persistence.getSaveById("save-1")!,
        batchedRun.persistence,
      );
      expect(batchedResult.gamePhase).toBe("preseason_management");
      const batchedFinal = batchedRun.persistence.getSaveById("save-1");
      if (!batchedFinal) throw new Error("Batched run left no save behind.");

      // Der eigentliche Beweis: identischer GameState, nicht nur identische Endphase.
      expect(batchedFinal.gameState).toEqual(manualCurrent.gameState);
      // Und beide haben tatsaechlich dieselben vier Hops durchlaufen (kein Kurzschluss).
      // `season_check` selbst taucht hier NICHT auf — der schaltet ueber `startSeasonTransition`
      // (bzw. dessen In-Memory-Pendant `computeStartSeasonTransition`), das `completedSteps`
      // unangetastet laesst; das war schon vor diesem Umbau so.
      expect(batchedFinal.gameState.seasonTransition?.completedSteps).toEqual([
        "season_review",
        "season_rewards",
        "player_development",
      ]);
      expect(manualCurrent.gameState.seasonTransition?.completedSteps).toEqual(
        batchedFinal.gameState.seasonTransition?.completedSteps,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("bewegt sich nicht mehr, wenn das Fenster schon offen ist", () => {
    // Ein zweiter Klick darf nicht weiter in Richtung neue Saison rutschen — sonst schoebe
    // das versehentliche Doppeltippen den Spieler an seiner Transferrunde vorbei.
    const sourceSave = save({ completed: true, gamePhase: "preseason_management" });
    const { persistence, saveSingleplayerState } = statefulPersistenceMock(sourceSave);

    const result = advanceSeasonTransitionToTransferWindow(sourceSave, persistence);

    expect(result.gamePhase).toBe("preseason_management");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("bricht ab, solange der letzte Spieltag nicht durch ist", () => {
    // Mitten in der Saison, NICHT am Saisonstart: dort ist das Transferfenster ueber
    // `isEarlySeasonTransferSetup` legitim offen, und die Funktion haette schlicht nichts zu
    // tun. Der interessante Fall ist der andere — Spieltag 2 laeuft noch.
    const laufend = save({ completed: false });
    laufend.gameState.season.currentMatchday = 2;
    laufend.gameState.matchdayState = { matchdayId: "md-2", status: "planning", pendingTeamIds: ["team-1"], resolvedFixtureIds: [] };
    const sourceSave = laufend;
    const { persistence, saveSingleplayerState } = statefulPersistenceMock(sourceSave);

    const result = advanceSeasonTransitionToTransferWindow(sourceSave, persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("last_matchday_not_completed");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("keeps service source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        path.join(process.cwd(), "lib/season/season-transition-service.ts"),
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(source).toContain("productiveWrites: false");
  });
});
