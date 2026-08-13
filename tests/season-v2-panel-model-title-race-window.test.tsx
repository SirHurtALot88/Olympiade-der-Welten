import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import {
  useSeasonV2PanelModel,
  type UseSeasonV2PanelModelInput,
} from "@/lib/foundation/tabs/use-season-v2-panel-model";
import type { TitleRaceResult } from "@/lib/season/title-race";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";

/**
 * Zeitfenster-Verdrahtung des Meisterschaftskampfs (`buildTitleRace`) im Season-V2-Panel-Modell.
 *
 * `buildTitleRace` selbst kennt keinen Kalender — dieser Test deckt GENAU die Verantwortung des
 * Hooks ab: er darf nur rechnen, wenn der letzte Spieltag aktiv UND noch nicht durchgespielt ist,
 * und er muss bei einer archivierten Saison auf `null` gehen, selbst wenn die Live-Saison zufällig
 * gerade im Fenster steckt.
 *
 * GEGENPROBE (ausgeführt): mit `git stash` die Hook-Änderung zurückgenommen — `titleRace` existierte
 * dann nicht mehr am Rückgabewert, jeder Test hier schlug mit
 * `TypeError: Cannot read properties of undefined (reading 'leaderId')` bzw. `.toEqual` gegen
 * `undefined` fehl. Nach `git stash pop` wieder grün.
 */

const MATCHDAY_IDS = ["season-1-md-1", "season-1-md-2"];
const LAST_MATCHDAY_ID = "season-1-md-2";

function team(teamId: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `Team ${teamId}`,
    budget: 500,
    cash: 300,
    identityId: teamId,
    humanControlled: true,
    rosterLimit: 12,
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
  /** Auf welchem Spieltag steht der Spielstand (1-basiert)? */
  currentMatchday?: number;
  activeMatchdayId?: string;
  matchdayStatus?: "planning" | "resolved";
  resultsFor?: string[];
  standingsFor?: string[];
};

function makeGameState(options: StateOptions = {}): GameState {
  const teams = [team("A-A"), team("B-B")];
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: options.currentMatchday ?? 2,
      matchdayIds: MATCHDAY_IDS,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: (options.resultsFor ?? []).map(matchdayResult),
      standingsApplyLogs: (options.standingsFor ?? []).map(standingsApplyLog),
      seasonSnapshots: [],
    },
    matchdayState: {
      matchdayId: options.activeMatchdayId ?? LAST_MATCHDAY_ID,
      status: options.matchdayStatus ?? "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players: [],
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
      teamCount: teams.length,
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

function makeStandRow(teamId: string, points: number | null): TeamManagementSnapshotRow {
  return {
    team: team(teamId),
    teamId,
    teamCode: teamId,
    teamName: `Team ${teamId}`,
    generalManagerName: null,
    generalManagerTitle: null,
    generalManagerInfluencePct: null,
    rank: null,
    points,
    rosterCount: 0,
    salaryTotal: 0,
    avgContractLength: null,
    marketValueTotal: null,
    cash: 0,
    cashFc: null,
    budget: 0,
    formAvg: null,
    financeForm: null,
    needScore: null,
    avgMarketValue: null,
    avgPps: null,
    avgOvr: null,
    ppsTotal: 0,
    ppsPow: 0,
    ppsSpe: 0,
    ppsMen: 0,
    ppsSoc: 0,
    playerMin: null,
    playerOpt: null,
    rosterTarget: null,
    transferCount: 0,
    transferBuyTotal: 0,
    transferSellTotal: 0,
    transferNet: 0,
    transfersSeasonValue: null,
    cashDelta: null,
    startplatz: null,
    rankDiff: null,
    sponsorBasis: null,
    sponsorRank: null,
    sponsorTotal: null,
    sponsorSeason: null,
    guv: null,
    cashTotal: null,
    historicalPow: null,
    historicalSpe: null,
    historicalMen: null,
    historicalSoc: null,
    historicalGoldCount: 0,
    historicalSilverCount: 0,
    historicalBronzeCount: 0,
    historicalTop5Count: 0,
    historicalTop10Count: 0,
    historicalAvgRank: null,
    historicalAvgPoints: null,
    historicalPointsTotal: null,
    historicalPointsBySeason: [],
    historicalSeasonsPlayed: 0,
    historicalBestRank: null,
    historicalLastSeasonRank: null,
    historicalLastSeasonPoints: null,
    historicalHasData: false,
    disciplineValues: {},
    roster: [],
    rosterPlayers: [],
  } as unknown as TeamManagementSnapshotRow;
}

let captured: TitleRaceResult | null | undefined = "not-set" as unknown as TitleRaceResult | null;

function Harness(input: Partial<UseSeasonV2PanelModelInput> & { gameState: GameState }) {
  const result = useSeasonV2PanelModel({
    selectedTeamId: null,
    sortedSeasonStandRows: [],
    selectedStandingRow: null,
    sortedSeasonTopPlayerRows: [],
    seasonHistorySnapshots: [],
    archivedSeasonDisciplineLeaderboards: [],
    boardConfidence: {},
    ...input,
  });
  captured = result.titleRace;
  return null;
}

function buildViaHarness(input: Partial<UseSeasonV2PanelModelInput> & { gameState: GameState }) {
  captured = "not-set" as unknown as TitleRaceResult | null;
  renderToString(<Harness {...input} />);
  return captured;
}

describe("useSeasonV2PanelModel — Zeitfenster des Meisterschaftskampfs", () => {
  const contenderStandRows = [makeStandRow("A-A", 144.3), makeStandRow("B-B", 133.7)];

  it("rechnet NICHT, solange der letzte Spieltag noch nicht aktiv ist", () => {
    const gameState = makeGameState({ currentMatchday: 1, activeMatchdayId: "season-1-md-1" });
    const race = buildViaHarness({ gameState, sortedSeasonStandRows: contenderStandRows });
    expect(race).toBeNull();
  });

  it("rechnet, wenn der letzte Spieltag aktiv und noch nicht durchgespielt ist", () => {
    // matchdayStatus "planning": der letzte Spieltag läuft (Aufstellungen/Ergebnis noch offen) —
    // `hasFinalMatchdayBeenPlayed` verlangt u. a. `matchdayState.status === "resolved"`, das fehlt
    // hier absichtlich (season-completion-state.ts:48).
    const gameState = makeGameState({
      currentMatchday: 2,
      activeMatchdayId: LAST_MATCHDAY_ID,
      matchdayStatus: "planning",
    });
    const race = buildViaHarness({ gameState, sortedSeasonStandRows: contenderStandRows });
    expect(race).not.toBeNull();
    expect(race?.leaderId).toBe("A-A");
    expect([...(race?.contenderIds ?? [])].sort()).toEqual(["A-A", "B-B"]);
  });

  it("rechnet NICHT mehr, sobald der letzte Spieltag durchgespielt ist (Titel entschieden oder nicht)", () => {
    const gameState = makeGameState({
      currentMatchday: 2,
      activeMatchdayId: LAST_MATCHDAY_ID,
      matchdayStatus: "resolved",
      resultsFor: MATCHDAY_IDS,
      standingsFor: MATCHDAY_IDS,
    });
    const race = buildViaHarness({ gameState, sortedSeasonStandRows: contenderStandRows });
    expect(race).toBeNull();
  });

  it("bleibt bei null in der Archiv-Ansicht, selbst wenn die LIVE-Saison gerade im Fenster steckt", () => {
    const gameState = makeGameState({
      currentMatchday: 2,
      activeMatchdayId: LAST_MATCHDAY_ID,
      matchdayStatus: "planning",
    });
    const race = buildViaHarness({
      gameState,
      sortedSeasonStandRows: contenderStandRows,
      isViewingArchivedSeason: true,
    });
    expect(race).toBeNull();
  });

  it("benutzt GENAU die Punkte aus den Stand-Zeilen — Rechnung und Anzeige laufen nie auseinander", () => {
    const gameState = makeGameState({
      currentMatchday: 2,
      activeMatchdayId: LAST_MATCHDAY_ID,
      matchdayStatus: "planning",
    });
    // B-B liegt hier so weit zurück (mehr als die Obergrenze), dass es rausfällt.
    const decidedRows = [makeStandRow("A-A", 144.3), makeStandRow("B-B", 100)];
    const race = buildViaHarness({ gameState, sortedSeasonStandRows: decidedRows });
    expect(race?.contenderIds.has("B-B")).toBe(false);
    expect(race?.contenderIds.has("A-A")).toBe(true);
    expect(race?.contenderIds.size).toBe(1);
  });

  it("ohne jede gewertete Mannschaft bleibt leaderId null (UI behandelt das wie 'kein Fenster')", () => {
    const gameState = makeGameState({
      currentMatchday: 2,
      activeMatchdayId: LAST_MATCHDAY_ID,
      matchdayStatus: "planning",
    });
    const emptyRows = [makeStandRow("A-A", null), makeStandRow("B-B", null)];
    const race = buildViaHarness({ gameState, sortedSeasonStandRows: emptyRows });
    expect(race).not.toBeNull();
    expect(race?.leaderId).toBeNull();
  });
});
