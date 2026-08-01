import { describe, expect, it, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import { useFoundationCrossTabTeamsRoster } from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import { invalidateTeamProfileSessionCache } from "@/lib/foundation/team-profile-session-cache";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { TeamDetailDrawerData } from "@/lib/foundation/team-detail-drawer-types";

/**
 * Bug #298 ("eigene Team-Ansicht zeigt unten keine Historie"): Chris' Save
 * zeigte in einer laufenden Season 1 (noch keine Saison abgeschlossen) auf
 * der EIGENEN Team-Profilseite (`TeamProfileNewLook`, scope "full") keine
 * aktuellen Werte in der Live-Zeile der Historie, während dieselbe Zeile in
 * der Teams-Detailansicht (`FoundationTeamsDetailPanel`, scope
 * "history-summary") stets frisch war.
 *
 * Befund (verifiziert gegen die Builder-Logik in
 * `use-foundation-cross-tab-teams-roster.ts` UND gegen den echten
 * archivierten Save `data/online-saves/fresh-season-1-*.json.gz`): Die
 * Live-Zeile selbst fehlt in `history` nie — sie wird unconditional gebaut.
 * Die eigentliche Ursache ist der Session-Cache
 * (`lib/foundation/team-profile-session-cache.ts`), der NUR beim scope
 * "full" greift. `buildTeamProfileContentSignature` kennt weder Spieltag
 * noch Ligastand (Rang/Punkte/PPs) — bleiben Cash, Kadergröße,
 * Transferzahl und Rating-Slice-Größe zwischen zwei Aufrufen gleich (in
 * einer ruhigen Phase der Saison durchaus üblich), liefert ein Cache-Treffer
 * die Live-Zeile vom ERSTEN Aufruf aus, komplett unabhängig vom aktuellen
 * Spieltag. Die Teams-Detailansicht nutzt diesen Cache gar nicht (scope
 * "history-summary" baut immer frisch) — daher der Unterschied.
 */

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: "T-T",
    shortCode: "T-T",
    name: "Test Team",
    budget: 500000,
    cash: 120000,
    identityId: "T-T",
    humanControlled: true,
    rosterLimit: 12,
    logoPath: null,
    ...partial,
  };
}

function createSeasonOneGameState(): GameState {
  const team = createTeam();
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 10,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: { "T-T": { points: 0, rank: null } },
      seasonSnapshots: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team],
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

function createSeasonStandRow(overrides: Partial<TeamManagementSnapshotRow>): TeamManagementSnapshotRow {
  return {
    team: createTeam(),
    teamId: "T-T",
    teamCode: "T-T",
    teamName: "Test Team",
    generalManagerName: null,
    generalManagerTitle: null,
    generalManagerInfluencePct: null,
    rank: null,
    points: null,
    rosterCount: 0,
    salaryTotal: 0,
    avgContractLength: null,
    marketValueTotal: null,
    cash: 120000,
    cashFc: null,
    budget: 500000,
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
    ...overrides,
  } as unknown as TeamManagementSnapshotRow;
}

let captured: TeamDetailDrawerData | null = null;

function Harness({
  scope,
  seasonStandRows,
}: {
  scope: "full" | "history-summary";
  seasonStandRows: TeamManagementSnapshotRow[];
}) {
  const result = useFoundationCrossTabTeamsRoster({
    shouldBuildTeamsView: false,
    shouldBuildHomeV2Overview: false,
    shouldBuildMarketView: false,
    teamProfileTeamId: "T-T",
    canonicalSeasonLabel: "Season 1",
    gameState: createSeasonOneGameState(),
    rosterPlayers: [],
    playerRatingsById: new Map(),
    seasonStandRows,
    seasonStandRowsSeasonId: "season-1",
    activeSaveId: "save-1",
    currentAreaRanksByTeamId: new Map(),
    seasonPointsLedger: null,
    playerDirectorySlice: { payload: null, error: null, disciplinePointsByPlayerId: {} },
    teamObjectiveOverview: { objectives: [], boardConfidence: {} } as never,
    currentMatchdayDisciplineSchedule: null,
    manageableTeamIds: ["T-T"],
  });
  captured = result.buildTeamDetailDrawerData("T-T", scope);
  return null;
}

// Läuft `renderToString` und liefert das Ergebnis über einen Funktionsaufruf
// zurück, statt `captured` direkt zwischen den Assertions zu lesen — sonst
// engt TS' Kontrollfluss-Analyse den modulweiten `let`-Typ zwischen der
// Zuweisung `captured = null` und dem nächsten Read fälschlich auf `null` ein
// (die eigentliche Zuweisung passiert unsichtbar für TS innerhalb von
// `Harness`, über `renderToString`).
function buildViaHarness(scope: "full" | "history-summary", seasonStandRows: TeamManagementSnapshotRow[]) {
  captured = null;
  renderToString(<Harness scope={scope} seasonStandRows={seasonStandRows} />);
  return captured as TeamDetailDrawerData | null;
}

describe("eigene Team-Historie bleibt in einer laufenden Season 1 sichtbar und aktuell (#298)", () => {
  beforeEach(() => {
    invalidateTeamProfileSessionCache();
  });

  it("full scope (eigene Team-Ansicht) liefert nie eine leere Historie", () => {
    const data = buildViaHarness("full", []);
    expect(data?.history.length).toBeGreaterThan(0);
    expect(data?.history[0]?.isLive).toBe(true);
  });

  it("full scope zeigt den AKTUELLEN Ligastand der Live-Zeile, nicht den Stand des ersten Aufrufs", () => {
    // 1. Aufruf: früh in der Saison, noch kein Ligastand für das Team (wie beim
    //    allerersten Öffnen der eigenen Team-Ansicht) — dieser Build landet im
    //    Session-Cache (nur "full" cacht).
    const first = buildViaHarness("full", []);
    expect(first?.history[0]?.rank).toBeNull();

    // 2. Aufruf: gleiches Save/gleiche Season/gleiches Team — Cash, Kadergröße,
    //    Snapshot- und Transferzahl (die einzigen Zutaten der Content-Signatur)
    //    bleiben unverändert, ABER der Ligastand hat sich inzwischen weiterentwickelt
    //    (Rang 4, 55.2 Punkte). Ohne Fix würde ein Cache-Treffer weiterhin die
    //    eingefrorene Live-Zeile vom ersten Aufruf ausliefern.
    const second = buildViaHarness("full", [createSeasonStandRow({ rank: 4, points: 55.2, ppsTotal: 61.4 })]);
    expect(second?.history[0]?.isLive).toBe(true);
    expect(second?.history[0]?.rank).toBe(4);
    expect(second?.history[0]?.points).toBe(55.2);
  });

  it("full und history-summary zeigen für denselben Spieltag dieselbe Live-Zeile", () => {
    const rows = [createSeasonStandRow({ rank: 7, points: 41.9, ppsTotal: 44.0 })];

    const full = buildViaHarness("full", rows);
    const fullLive = full?.history[0];

    const summary = buildViaHarness("history-summary", rows);
    const summaryLive = summary?.history[0];

    expect(fullLive?.isLive).toBe(true);
    expect(summaryLive?.isLive).toBe(true);
    expect(fullLive?.rank).toBe(summaryLive?.rank);
    expect(fullLive?.points).toBe(summaryLive?.points);
  });
});
