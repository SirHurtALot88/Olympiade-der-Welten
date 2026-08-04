import { describe, expect, it } from "vitest";

import type {
  GameState,
  MatchdayResultRecord,
  Player,
  PlayerDisciplinePerformanceRecord,
  RosterEntry,
  Team,
} from "@/lib/data/olyDataTypes";
import { buildPlayerDirectorySlice } from "@/lib/foundation/player-directory-slice";
import { buildExpectedSellValueByPlayerId } from "@/lib/market/transfermarkt-expected-sell-value";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { SALE_FACTOR_MIN_RANK_POOL } from "@/lib/market/transfermarkt-sale-factor";

/**
 * GEMELDET (Chris, Spielerliste): „warum haben die spieler keinen +/- im
 * verkaufswert obwohl 17 spieler in dem bracket sind???" — direkt danach
 * „scheint nun ueberall kaputt zu sein egal welches bracket".
 *
 * URSACHE. Der Verkaufspreis ist Marktwert x Verkaufsfaktor; der Faktor haengt
 * am Rang in der eigenen Preisklasse. Ob dieses Ranking ueberhaupt greift,
 * entscheidet `hasCurrentSeasonSaleFactorRanking` an den gewerteten
 * `matchdayResults` der laufenden Saison. Der Client haelt aber den KOMPAKTEN
 * Payload (`compactFoundationInitialGameState`), der `matchdayResults` auf den
 * AKTIVEN Spieltag beschneidet. Solange der noch nicht ausgewertet ist, sieht
 * der Client NULL gewertete Ergebnisse — kein Ranking, Faktor 1,0 fuer jeden,
 * VK-Wert == Marktwert in jeder Zeile und in jedem Bracket.
 *
 * Am gemeldeten Spielstand (new-game-1785823388048-1hf25q, Saison 1, MD7)
 * nachgemessen: voller Save 328 von 339 Kaderspielern mit Abweichung vom
 * Marktwert, kompakter Payload 0 von 339.
 */

const SEASON_ID = "season-1";
const SAVE_ID = "save-sell-value-slice";
const MATCHDAY_ID = "matchday-1";
const RESULT_ID = "result-md1";
/** Ein Bracket wird erst ab dieser Pool-Groesse geranked — sonst greift Faktor 1,0. */
const POOL_SIZE = SALE_FACTOR_MIN_RANK_POOL + 2;

function createTeam(): Team {
  return {
    teamId: "A-A",
    shortCode: "A-A",
    name: "Armageddon Aftermath",
    budget: 500,
    cash: 500,
    identityId: "A-A",
    humanControlled: true,
    rosterLimit: 40,
    logoPath: null,
  };
}

function createPlayer(id: string, marketValue: number): Player {
  return {
    id,
    name: id,
    rating: 70,
    marketValue,
    salaryDemand: 10,
    displayMarketValue: marketValue,
    displaySalary: 10,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 70 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createRosterEntry(playerId: string, marketValue: number): RosterEntry {
  return {
    id: `roster-${playerId}`,
    teamId: "A-A",
    playerId,
    contractLength: 1,
    salary: 10,
    upkeep: 10,
    purchasePrice: marketValue,
    currentValue: marketValue,
    roleTag: "starter",
    joinedSeasonId: SEASON_ID,
  };
}

function createPerformance(playerId: string, index: number): PlayerDisciplinePerformanceRecord {
  return {
    id: `perf-${playerId}`,
    matchdayResultId: RESULT_ID,
    teamId: "A-A",
    playerId,
    activePlayerId: `roster-${playerId}`,
    disciplineId: "d1",
    disciplineSide: "d1",
    slotIndex: index,
    baseValue: 70,
    finalPlayerScore: 70,
    // Verschiedene Beitraege => verschiedene Raenge im Bracket => verschiedene Faktoren.
    scoreContribution: POOL_SIZE - index,
    rankInTeam: index + 1,
    rankInDiscipline: index + 1,
    isTop10: index < 10,
    isMvpCandidate: index === 0,
    storyWeight: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function createAppliedResult(): MatchdayResultRecord {
  return {
    id: RESULT_ID,
    saveId: SAVE_ID,
    seasonId: SEASON_ID,
    matchdayId: MATCHDAY_ID,
    status: "preview_applied",
    sourceVersion: "test",
    teamsTotal: 1,
    teamsReady: 1,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Ein Kader, dessen Spieler alle im SELBEN Bracket liegen (Marktwerte dicht
 * beieinander) und die alle gewertete Punkte haben — damit greift das
 * Bracket-Ranking und der Verkaufsfaktor weicht von 1,0 ab.
 *
 * Der AKTIVE Spieltag ist bewusst ein anderer (`matchday-2`) als der gewertete
 * (`matchday-1`): genau die Lage aus der Meldung — gespielte Spieltage liegen
 * hinter einem, der aktive ist noch in Planung.
 */
function createGameState(): GameState {
  const marketValues = Array.from({ length: POOL_SIZE }, (_, index) => 20 + index * 0.1);
  const players = marketValues.map((value, index) => createPlayer(`p${index + 1}`, value));
  const rosters = marketValues.map((value, index) => createRosterEntry(`p${index + 1}`, value));

  return {
    gamePhase: "in_season",
    season: {
      id: SEASON_ID,
      name: "Season 1",
      year: 2026,
      currentMatchday: 2,
      matchdayIds: [MATCHDAY_ID, "matchday-2"],
    },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: {},
      playerDisciplinePerformances: players.map((player, index) => createPerformance(player.id, index)),
      seasonSnapshots: [],
      matchdayResults: [createAppliedResult()],
    },
    matchdayState: {
      matchdayId: "matchday-2",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [createTeam()],
    teamIdentities: [],
    players,
    disciplines: [
      {
        id: "d1",
        name: "Team Deathmatch",
        category: "power",
        playerCount: 5,
      },
    ],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
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

describe("Spielerliste: der Verkaufswert kommt vom Server", () => {
  it("belegt die Ursache — auf dem kompakten Client-Payload ist der Verkaufswert ueberall der Marktwert", () => {
    const gameState = createGameState();

    // Voller Save: das Bracket-Ranking greift, die Faktoren gehen auseinander.
    const onFullSave = buildExpectedSellValueByPlayerId(gameState, { saveId: SAVE_ID });
    const abweichendVoll = gameState.rosters.filter((roster) => {
      const player = gameState.players.find((entry) => entry.id === roster.playerId);
      const sell = onFullSave.get(roster.playerId);
      return sell != null && player != null && Math.abs(sell.grossSalePrice - (player.marketValue ?? 0)) >= 0.005;
    });
    expect(abweichendVoll.length).toBeGreaterThan(0);

    // Kompakter Client-Payload: `matchdayResults` auf den aktiven Spieltag
    // beschnitten, der noch nicht gewertet ist => kein Ranking => Faktor 1,0.
    const compact = compactFoundationInitialGameState(createGameState());
    expect(compact.seasonState.matchdayResults).toHaveLength(0);
    const onCompact = buildExpectedSellValueByPlayerId(compact);
    for (const roster of compact.rosters) {
      const player = compact.players.find((entry) => entry.id === roster.playerId);
      const sell = onCompact.get(roster.playerId);
      expect(sell).toBeTruthy();
      expect(sell!.grossSalePrice).toBeCloseTo(player!.marketValue ?? 0, 2);
    }
  });

  it("liefert der Directory-Slice den auf dem vollen Save gerechneten Verkaufswert mit", () => {
    const gameState = createGameState();

    const slice = buildPlayerDirectorySlice({ gameState, saveId: SAVE_ID, seasonId: SEASON_ID });

    expect(Object.keys(slice.sellValueByPlayerId).length).toBe(gameState.rosters.length);

    const referenz = buildExpectedSellValueByPlayerId(createGameState(), { saveId: SAVE_ID });
    let abweichendVomMarktwert = 0;
    for (const [playerId, entry] of Object.entries(slice.sellValueByPlayerId)) {
      const player = gameState.players.find((candidate) => candidate.id === playerId)!;
      // Der Slice-Wert ist exakt der Server-Wert — keine zweite Rechnung.
      expect(entry.grossSalePrice).toBeCloseTo(referenz.get(playerId)!.grossSalePrice, 4);
      if (Math.abs(entry.grossSalePrice - (player.marketValue ?? 0)) >= 0.005) {
        abweichendVomMarktwert += 1;
      }
    }
    // Der Kern der Meldung: es steht wieder ein Verkaufsfaktor in der Spalte,
    // statt in jeder Zeile stumpf der Marktwert.
    expect(abweichendVomMarktwert).toBeGreaterThan(0);
  });

  it("laesst der Projektions-Pfad das Feld leer, statt einen Wert zu erfinden", async () => {
    // Ohne GameState (nur Derivations + SeasonState) gibt es keine Vertraege und
    // damit keinen belastbaren Verkaufswert — der Client faellt dann auf seine
    // eigene Rechnung zurueck.
    const modul = await import("@/lib/foundation/player-directory-slice");
    const quelle = modul.buildPlayerDirectorySliceFromPersisted.toString();
    expect(quelle).toContain("sellValueByPlayerId: {}");
  });
});

describe("Spielerliste: die Zeile bevorzugt den Slice-Wert", () => {
  it("nimmt den Slice, sobald er da ist, und faellt sonst auf die lokale Rechnung zurueck", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const quelle = readFileSync(
      join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-player-directory.ts"),
      "utf8",
    );

    expect(quelle).toContain("const useSliceSellValues =");
    expect(quelle).toContain("sellPreview: useSliceSellValues");
    expect(quelle).toContain("sliceSellValues[player.id] ?? null");
    // Ein leeres Feld (Projektions-Pfad) darf die Spalte nicht auf "—" setzen.
    expect(quelle).toContain("Object.keys(sliceSellValues).length > 0");
    // Der Slice-Wert muss in den Deps stehen, sonst friert die Spalte auf dem
    // lokalen Marktwert ein, weil er erst nach dem ersten Rendern eintrifft.
    expect(quelle).toContain("input.playerDirectorySlice.sellValueByPlayerId,");
  });
});
