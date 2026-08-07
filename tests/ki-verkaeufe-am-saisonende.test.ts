/**
 * DIE STATION „VERKAEUFE" VERKAUFT JETZT WIRKLICH.
 *
 * Sie trug bisher nur eine Ankuendigung: „AI-Verkaeufe werden spaeter ueber Sell-Service
 * vorbereitet". Der Sell-Service (`runTransferWindowSession`, `phase: "season_end"`) existierte
 * laengst und war getestet — die Saisonende-Kette rief ihn nur nie auf. Die KI-Teams gingen also mit
 * unveraendertem Kader und ohne frisches Geld in die neue Saison, und auf dem Markt lag nichts, was
 * der Spieler haette kaufen koennen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, SeasonTransitionState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

const runTransferWindowSession = vi.fn();
vi.mock("@/lib/ai/ai-transfer-window-session-service", () => ({
  runTransferWindowSession: (...args: unknown[]) => runTransferWindowSession(...args),
}));

const { advanceSeasonTransitionStep } = await import("@/lib/season/season-transition-service");

function sitzungsergebnis(input?: { appliedSells?: number; warnings?: string[] }) {
  return {
    phase: "season_end" as const,
    leagueRounds: 1,
    teamCycles: 1,
    passes: 1,
    rounds: 1,
    perTeam: [],
    emergencyRepairTeams: [],
    appliedBuys: 0,
    appliedSells: input?.appliedSells ?? 3,
    warnings: input?.warnings ?? [],
    blockingReasons: [],
    skipped: false,
    roundHistory: [],
  };
}

function gameState(input?: { transition?: Partial<SeasonTransitionState> }): GameState {
  return {
    gamePhase: "transfer_sell_phase",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds: ["md-1", "md-2"] },
    seasonTransition: {
      transitionId: "t-1",
      fromSeasonId: "season-1",
      toSeasonId: "season-2",
      currentStep: "transfer_sell_phase",
      status: "preview",
      completedSteps: ["season_check", "season_review", "season_rewards", "player_development", "season_end_management"],
      warnings: [],
      errors: [],
      createdAt: "2026-06-11T00:00:00.000Z",
      ...input?.transition,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [
        { id: "f-1", homeTeamId: "team-1", awayTeamId: "team-2", matchdayId: "md-1", status: "resolved" },
        { id: "f-2", homeTeamId: "team-1", awayTeamId: "team-2", matchdayId: "md-2", status: "resolved" },
      ],
      standings: {},
      matchdayResults: [],
      standingsApplyLogs: [],
    },
    matchdayState: { matchdayId: "md-2", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: ["f-2"] },
    teams: [
      { teamId: "team-1", shortCode: "T-1", name: "Team One", budget: 100, cash: 50, identityId: "i-1", humanControlled: true, rosterLimit: 12 },
      { teamId: "team-2", shortCode: "T-2", name: "Team Two", budget: 100, cash: 40, identityId: "i-2", humanControlled: false, rosterLimit: 12 },
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
      mappingSource: "", teamSource: "", generatedAt: "", processedMappingRows: 0, importedPlayerCount: 0,
      matchedRosterCount: 0, teamCount: 2, unmappedPlayers: [], teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [], duplicateMappedPlayers: [], unknownTeamCodes: [],
      duplicateTeamCodes: [], warnings: [],
    },
  } as unknown as GameState;
}

function stand(state: GameState): PersistedSaveGame {
  return { saveId: "save-1", name: "Test", status: "active", createdAt: "", updatedAt: "", gameState: state } as unknown as PersistedSaveGame;
}

function persistenzMock(quelle: PersistedSaveGame) {
  let aktuell = quelle;
  const saveSingleplayerState = vi.fn((saveId: string, next: GameState) => {
    aktuell = { ...aktuell, saveId, gameState: next };
    return aktuell;
  });
  return {
    persistence: {
      saveSingleplayerState,
      getSaveById: (saveId: string) => (saveId === aktuell.saveId ? aktuell : null),
    } as unknown as PersistenceService,
    saveSingleplayerState,
    jetzt: () => aktuell,
  };
}

beforeEach(() => {
  runTransferWindowSession.mockReset();
  runTransferWindowSession.mockResolvedValue(sitzungsergebnis());
});

describe("Saisonende: der Schritt Verkaeufe laesst die KI wirklich verkaufen", () => {
  it("startet die Transferfenster-Sitzung mit phase season_end und OHNE Kaeufe", async () => {
    const mock = persistenzMock(stand(gameState()));

    await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    expect(runTransferWindowSession).toHaveBeenCalledTimes(1);
    const argumente = runTransferWindowSession.mock.calls[0]?.[0];
    expect(argumente.phase).toBe("season_end");
    // Am Saisonende wird nur verkauft — gekauft wird in der neuen Saison.
    expect(argumente.allowBuys).toBe(false);
    expect(argumente.seasonId).toBe("season-1");
    expect(argumente.dryRun).toBe(false);
  });

  it("merkt sich die erledigte Saison, damit ein zweiter Durchlauf keine Kader leerraeumt", async () => {
    const mock = persistenzMock(stand(gameState()));

    const ergebnis = await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);
    expect(ergebnis.transition.aiSeasonEndSellsAppliedForSeasonId).toBe("season-1");

    // Zweiter Aufruf mit bereits gesetztem Marker: die Sitzung darf NICHT erneut laufen.
    runTransferWindowSession.mockClear();
    const schonGelaufen = persistenzMock(
      stand(gameState({ transition: { aiSeasonEndSellsAppliedForSeasonId: "season-1" } })),
    );
    await advanceSeasonTransitionStep(schonGelaufen.jetzt(), schonGelaufen.persistence);
    expect(runTransferWindowSession).not.toHaveBeenCalled();
  });

  it("laeuft an jeder anderen Station der Kette NICHT", async () => {
    const anStation = gameState({
      transition: { currentStep: "season_rewards", completedSteps: ["season_check", "season_review"] },
    });
    // Phase UND Schritt gehoeren zusammen — die Vorschau leitet den Schritt aus der Phase ab.
    anStation.gamePhase = "season_rewards";
    const mock = persistenzMock(stand(anStation));

    await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    expect(runTransferWindowSession).not.toHaveBeenCalled();
  });

  it("schreibt die Zahl der Verkaeufe als Warnung mit, damit der Durchlauf nachvollziehbar ist", async () => {
    runTransferWindowSession.mockResolvedValue(sitzungsergebnis({ appliedSells: 7 }));
    const mock = persistenzMock(stand(gameState()));

    const ergebnis = await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    expect(ergebnis.transition.warnings).toContain("ai_season_end_sells_applied:7");
  });

  it("sperrt die Kette NICHT, wenn die Sitzung scheitert — und laesst den Marker offen", async () => {
    runTransferWindowSession.mockRejectedValue(new Error("Markt nicht erreichbar"));
    const mock = persistenzMock(stand(gameState()));

    const ergebnis = await advanceSeasonTransitionStep(mock.jetzt(), mock.persistence);

    // Die Phase ist trotzdem weitergeschaltet: ein blockierter Saisonuebergang sperrt Verkaeufe
    // und Vertragsverlaengerungen des Spielers gleich mit aus.
    expect(ergebnis.applied).toBe(true);
    expect(ergebnis.transition.warnings.some((warnung) => warnung.startsWith("ai_season_end_sells_failed:"))).toBe(true);
    // Ohne Marker holt ein spaeterer Durchlauf die Verkaeufe nach, statt sie still zu verlieren.
    expect(ergebnis.transition.aiSeasonEndSellsAppliedForSeasonId).toBeNull();
  });
});
