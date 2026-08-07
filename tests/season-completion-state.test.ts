import { describe, expect, it } from "vitest";

import type { GamePhase, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import {
  hasFinalMatchdayBeenPlayed,
  hasFinalMatchdayResult,
  hasSeasonLeftActivePhase,
  isLegacySeasonCompletedFlagSet,
  isSeasonComplete,
  isSeasonCoverageComplete,
} from "@/lib/season/season-completion-state";

const MATCHDAY_IDS = ["season-1-md-1", "season-1-md-2"];
const LAST_MATCHDAY_ID = "season-1-md-2";

function team(): Team {
  return {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    budget: 500,
    cash: 300,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 12,
  };
}

function player(): Player {
  return {
    id: "p-1",
    name: "Player 1",
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: "mittel",
  };
}

function matchdayResult(matchdayId: string) {
  return {
    id: `r-${matchdayId}`,
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId,
    status: "preview_applied" as const,
    sourceVersion: "test",
    teamsTotal: 1,
    teamsReady: 1,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
  };
}

function standingsApplyLog(matchdayId: string) {
  return {
    id: `s-${matchdayId}`,
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId,
    createdAt: "2026-06-21T00:00:00.000Z",
  };
}

type StateOptions = {
  phase?: GamePhase | undefined;
  /** Auf welchem Spieltag steht der Spielstand — und ist der aufgeloest? */
  activeMatchdayId?: string;
  matchdayStatus?: "planning" | "resolved";
  currentMatchday?: number;
  /** Fuer welche Spieltage liegen Ergebnis- bzw. Tabellenbuchung vor? */
  resultsFor?: string[];
  standingsFor?: string[];
  legacyCompletedFlag?: boolean;
  /**
   * Setzt eine noch offene Partie auf den letzten Spieltag. Ohne sie ist der Spielplan leer, und
   * `hasFinalMatchdayBeenPlayed` nimmt den Kurzschluss „keine Partien = alles aufgeloest" — die
   * Ergebnis-und-Tabelle-Bedingung wird dann gar nicht erst geprueft.
   */
  openFixtureOnFinalMatchday?: boolean;
};

function gameState(options: StateOptions = {}): GameState {
  const season: Record<string, unknown> = {
    id: "season-1",
    name: "Season 1",
    year: 2026,
    currentMatchday: options.currentMatchday ?? 2,
    matchdayIds: MATCHDAY_IDS,
  };
  if (options.legacyCompletedFlag !== undefined) {
    season.isCompleted = options.legacyCompletedFlag;
  }

  return {
    gamePhase: options.phase,
    season,
    seasonState: {
      seasonId: "season-1",
      schedule: options.openFixtureOnFinalMatchday
        ? [{ id: "f-1", homeTeamId: "M-M", awayTeamId: "M-M", matchdayId: LAST_MATCHDAY_ID, status: "scheduled" }]
        : [],
      standings: {},
      matchdayResults: (options.resultsFor ?? []).map(matchdayResult),
      standingsApplyLogs: (options.standingsFor ?? []).map(standingsApplyLog),
    },
    matchdayState: {
      matchdayId: options.activeMatchdayId ?? LAST_MATCHDAY_ID,
      status: options.matchdayStatus ?? "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team()],
    teamIdentities: [],
    players: [player()],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
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

describe("season completion state — die Phasen-Lesart", () => {
  it("meldet jede Phase ausser season_active als 'nicht mehr aktiv'", () => {
    expect(hasSeasonLeftActivePhase(gameState({ phase: "season_completed" }))).toBe(true);
    expect(hasSeasonLeftActivePhase(gameState({ phase: "preseason_management" }))).toBe(true);
    expect(hasSeasonLeftActivePhase(gameState({ phase: "next_season_ready" }))).toBe(true);
  });

  it("behandelt season_active und einen Altstand ohne Phase als laufend", () => {
    expect(hasSeasonLeftActivePhase(gameState({ phase: "season_active" }))).toBe(false);
    expect(hasSeasonLeftActivePhase(gameState({ phase: undefined }))).toBe(false);
  });
});

describe("season completion state — die Daten-Lesart", () => {
  it("verlangt den letzten Spieltag, aufgeloest, mit Ergebnis UND Tabelle", () => {
    const state = gameState({
      phase: "season_active",
      resultsFor: MATCHDAY_IDS,
      standingsFor: MATCHDAY_IDS,
    });
    expect(hasFinalMatchdayBeenPlayed(state)).toBe(true);
  });

  it("bleibt negativ, solange der aktive Spieltag nicht aufgeloest ist", () => {
    const state = gameState({
      phase: "season_active",
      matchdayStatus: "planning",
      resultsFor: MATCHDAY_IDS,
      standingsFor: MATCHDAY_IDS,
    });
    expect(hasFinalMatchdayBeenPlayed(state)).toBe(false);
  });

  it("bleibt negativ, wenn der Spielstand noch auf einem frueheren Spieltag steht", () => {
    const state = gameState({
      phase: "season_active",
      activeMatchdayId: "season-1-md-1",
      currentMatchday: 1,
      resultsFor: ["season-1-md-1"],
      standingsFor: ["season-1-md-1"],
    });
    expect(hasFinalMatchdayBeenPlayed(state)).toBe(false);
  });

  it("laesst ein Ergebnis ohne Tabellenbuchung nicht durchgehen, solange eine Partie offen ist", () => {
    const state = gameState({
      phase: "season_active",
      openFixtureOnFinalMatchday: true,
      resultsFor: MATCHDAY_IDS,
      standingsFor: [],
    });
    expect(hasFinalMatchdayBeenPlayed(state)).toBe(false);
  });

  it("akzeptiert Ergebnis UND Tabelle als Ersatz fuer eine noch offene Partie", () => {
    const state = gameState({
      phase: "season_active",
      openFixtureOnFinalMatchday: true,
      resultsFor: MATCHDAY_IDS,
      standingsFor: MATCHDAY_IDS,
    });
    expect(hasFinalMatchdayBeenPlayed(state)).toBe(true);
  });
});

describe("season completion state — die schwache Lesart", () => {
  it("fragt nur nach dem Ergebnis des letzten Spieltags", () => {
    const state = gameState({
      phase: "season_active",
      openFixtureOnFinalMatchday: true,
      resultsFor: [LAST_MATCHDAY_ID],
      standingsFor: [],
    });
    // Streng betrachtet ist die Saison nicht sauber abgeschlossen — die schwache Lesart genuegt aber,
    // um den Saisonabschluss ueberhaupt starten zu duerfen.
    expect(hasFinalMatchdayBeenPlayed(state)).toBe(false);
    expect(hasFinalMatchdayResult(state)).toBe(true);
  });

  it("bleibt negativ, wenn nur fruehere Spieltage gebucht sind", () => {
    const state = gameState({ phase: "season_active", resultsFor: ["season-1-md-1"] });
    expect(hasFinalMatchdayResult(state)).toBe(false);
  });
});

describe("season completion state — die Uebergangs-Lesart", () => {
  it("vereinigt Phase und Spieldaten", () => {
    // Nur ueber die Phase.
    expect(isSeasonComplete(gameState({ phase: "season_review", matchdayStatus: "planning" }))).toBe(true);
    // Nur ueber die Daten.
    expect(
      isSeasonComplete(gameState({ phase: "season_active", resultsFor: MATCHDAY_IDS, standingsFor: MATCHDAY_IDS })),
    ).toBe(true);
    // Weder noch.
    expect(isSeasonComplete(gameState({ phase: "season_active", matchdayStatus: "planning" }))).toBe(false);
  });
});

describe("season completion state — die Archiv-Lesart", () => {
  it("verlangt jeden Spieltag mit Ergebnis und Tabelle", () => {
    expect(
      isSeasonCoverageComplete({ totalMatchdays: 2, resultAppliedMatchdays: 2, standingsAppliedMatchdays: 2 }),
    ).toBe(true);
  });

  it("blockiert eine Luecke in der Mitte, die die anderen Lesarten nicht sehen", () => {
    expect(
      isSeasonCoverageComplete({ totalMatchdays: 2, resultAppliedMatchdays: 1, standingsAppliedMatchdays: 1 }),
    ).toBe(false);
  });

  it("haelt eine Saison ohne Spieltage nicht fuer abgeschlossen", () => {
    expect(
      isSeasonCoverageComplete({ totalMatchdays: 0, resultAppliedMatchdays: 0, standingsAppliedMatchdays: 0 }),
    ).toBe(false);
  });
});

describe("season completion state — das Altlast-Flag", () => {
  it("liest season.isCompleted nur, wenn es wirklich gesetzt ist", () => {
    expect(isLegacySeasonCompletedFlagSet(gameState({ legacyCompletedFlag: true }))).toBe(true);
    expect(isLegacySeasonCompletedFlagSet(gameState({ legacyCompletedFlag: false }))).toBe(false);
    expect(isLegacySeasonCompletedFlagSet(gameState())).toBe(false);
  });
});

describe("season completion state — warum die Phasen-Policy die schwache Lesart braucht", () => {
  it("laesst den Saisonabschluss NICHT in der Vorsaison der Folge-Saison zu", () => {
    // Der Kern der Zusammenfuehrung: in `preseason_management` sagt die Uebergangs-Lesart „fertig",
    // weil die Phase nicht mehr `season_active` ist — die alte Saison ist da aber laengst
    // abgerechnet. Wuerde die Policy `isSeasonComplete` benutzen, liefe der Saisonabschluss dort ein
    // zweites Mal. Dieser Test faellt genau dann, wenn jemand die beiden Lesarten vertauscht.
    const preseason = gameState({ phase: "preseason_management", resultsFor: [], standingsFor: [] });

    expect(isSeasonComplete(preseason)).toBe(true);
    expect(hasFinalMatchdayResult(preseason)).toBe(false);

    const gate = evaluateGamePhaseAction(preseason, "complete_season");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("phase_blocked:complete_season:preseason_management");
  });

  it("erlaubt den Saisonabschluss, wenn die Phase noch auf season_active haengt", () => {
    const stuck = gameState({ phase: "season_active", resultsFor: [LAST_MATCHDAY_ID] });
    const gate = evaluateGamePhaseAction(stuck, "complete_season");
    expect(gate.allowed).toBe(true);
  });
});
