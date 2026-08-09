/**
 * RÜCKABWICKLUNG DER TRANSFERHISTORIE — die Grundlage der S1-Snapshot-Reparatur.
 *
 * Die Umkehrung der Transfers ist genau die Stelle, an der ein Vorzeichenfehler unbemerkt bliebe:
 * ein vertauschtes from/to würde Verkäufer und Käufer verwechseln und plausible, aber falsche
 * Kader liefern. Deshalb spielt dieser Test eine bekannte Bewegung VORWÄRTS und RÜCKWÄRTS durch
 * und verlangt, dass exakt der Ausgangszustand zurückkommt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Player, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  applyMovementForward,
  buildSeasonEndReconstructedGameState,
  resolvePreviousSeasonDisciplineRatings,
  revertMovement,
  revertMovements,
  type RosterMembershipMap,
} from "@/lib/season/team-strength-rank-reconstruction";

function movement(overrides: Partial<TransferHistoryEntry>): TransferHistoryEntry {
  return {
    id: "m-1",
    playerId: "p-1",
    seasonId: "season-1",
    seasonLabel: "Season 1",
    transferType: "sell",
    fromTeamId: null,
    toTeamId: null,
    fee: 0,
    salary: 0,
    marketValue: 0,
    remainingContractLength: 0,
    happenedAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("Rückabwicklung von Kaderbewegungen", () => {
  it("vorwärts und rückwärts ergibt exakt den Ausgangszustand (Verkauf)", () => {
    const start: RosterMembershipMap = new Map([["p-1", "N-N"]]);
    const sell = movement({ transferType: "sell", fromTeamId: "N-N", toTeamId: null });

    const forward = applyMovementForward(start, sell);
    expect(forward.memberships.has("p-1")).toBe(false);
    expect(forward.warnings).toEqual([]);

    const back = revertMovement(forward.memberships, sell);
    expect(back.memberships.get("p-1")).toBe("N-N");
    expect(back.warnings).toEqual([]);
    expect([...back.memberships.entries()]).toEqual([...start.entries()]);
  });

  it("vorwärts und rückwärts ergibt exakt den Ausgangszustand (Kauf aus dem Pool)", () => {
    const start: RosterMembershipMap = new Map();
    const buy = movement({ id: "m-2", transferType: "buy", fromTeamId: null, toTeamId: "A-A" });

    const forward = applyMovementForward(start, buy);
    expect(forward.memberships.get("p-1")).toBe("A-A");

    const back = revertMovement(forward.memberships, buy);
    expect(back.memberships.has("p-1")).toBe(false);
  });

  it("ein Vertragsende rückwärts setzt den Spieler zurück in seinen Kader", () => {
    const nachExit: RosterMembershipMap = new Map();
    const exit = movement({ id: "m-3", transferType: "contract_exit", fromTeamId: "A-A", toTeamId: null });

    const back = revertMovement(nachExit, exit);
    expect(back.memberships.get("p-1")).toBe("A-A");
  });

  it("eine Kette (S1-Verkauf, dann S2-Kauf durch anderes Team) wird jüngste zuerst aufgelöst", () => {
    // Heute: p-1 steht bei B-B (in Season 2 gekauft). Damals: verkauft von N-N.
    const heute: RosterMembershipMap = new Map([["p-1", "B-B"]]);
    const sell = movement({ id: "m-sell", transferType: "sell", fromTeamId: "N-N", toTeamId: null, happenedAt: "2026-08-05T00:00:00.000Z" });
    const buy = movement({ id: "m-buy", transferType: "buy", fromTeamId: null, toTeamId: "B-B", happenedAt: "2026-08-08T00:00:00.000Z" });

    // Reihenfolge im Input absichtlich falsch herum — revertMovements muss selbst sortieren.
    const back = revertMovements(heute, [sell, buy]);
    expect(back.memberships.get("p-1")).toBe("N-N");
    expect(back.warnings).toEqual([]);
  });

  it("meldet eine Warnung, wenn die Rückabwicklung den Spieler nicht dort findet, wo er sein müsste", () => {
    const heute: RosterMembershipMap = new Map([["p-1", "C-C"]]);
    const buy = movement({ id: "m-4", transferType: "buy", fromTeamId: null, toTeamId: "B-B" });

    const back = revertMovement(heute, buy);
    expect(back.warnings).toHaveLength(1);
    expect(back.warnings[0]).toContain("B-B");
    // Der falsche Stand wird nicht angerührt — keine stillen Korrekturen.
    expect(back.memberships.get("p-1")).toBe("C-C");
  });
});

describe("Vorsaison-Disziplinwerte", () => {
  const basePlayer = {
    id: "p-1",
    name: "Test",
    rating: 50,
    marketValue: 10,
    salaryDemand: 1,
    className: "Mage",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    preferredDisciplineIds: [],
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
  } satisfies Partial<Player>;

  it("bevorzugt lastSeasonDisciplineValues (übersteht beide Entwicklungspfade)", () => {
    const player = {
      ...basePlayer,
      disciplineRatings: { "pow-1": 30 },
      previousDisciplineRatings: { "pow-1": 28 },
      lastSeasonDisciplineValues: { "pow-1": 25 },
    } as Player;
    expect(resolvePreviousSeasonDisciplineRatings(player)).toEqual({ "pow-1": 25 });
  });

  it("fällt auf previousDisciplineRatings zurück, wenn nur der organische Pfad lief", () => {
    const player = {
      ...basePlayer,
      disciplineRatings: { "pow-1": 30 },
      previousDisciplineRatings: { "pow-1": 28 },
    } as Player;
    expect(resolvePreviousSeasonDisciplineRatings(player)).toEqual({ "pow-1": 28 });
  });

  it("nimmt die aktuellen Werte, wenn keine Entwicklung lief", () => {
    const player = { ...basePlayer, disciplineRatings: { "pow-1": 30 } } as Player;
    expect(resolvePreviousSeasonDisciplineRatings(player)).toEqual({ "pow-1": 30 });
  });
});

describe("buildSeasonEndReconstructedGameState", () => {
  function createGameState(): GameState {
    return {
      season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-matchday-1"] },
      seasonState: { seasonId: "season-2", schedule: [], standings: {} },
      matchdayState: { matchdayId: "season-2-matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [
        { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "id-a", humanControlled: true, rosterLimit: 12 },
        { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "id-b", humanControlled: false, rosterLimit: 12 },
      ],
      teamIdentities: [],
      players: [
        {
          id: "p-verkauft",
          name: "Verkauft",
          rating: 60,
          marketValue: 50,
          salaryDemand: 5,
          className: "Mage",
          race: "Human",
          alignment: "N",
          gender: "m",
          subclasses: [],
          traitsPositive: [],
          traitsNegative: [],
          coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
          preferredDisciplineIds: [],
          disciplineRatings: { "pow-1": 66 },
          lastSeasonDisciplineValues: { "pow-1": 60 },
          disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
          flavorEn: "",
          flavorDe: "",
          fatigue: 0,
          form: 0,
          potential: 0,
        },
        {
          id: "p-gekauft",
          name: "Gekauft",
          rating: 40,
          marketValue: 20,
          salaryDemand: 3,
          className: "Mage",
          race: "Human",
          alignment: "N",
          gender: "f",
          subclasses: [],
          traitsPositive: [],
          traitsNegative: [],
          coreStats: { pow: 8, spe: 8, men: 8, soc: 8 },
          preferredDisciplineIds: [],
          disciplineRatings: { "pow-1": 40 },
          disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
          flavorEn: "",
          flavorDe: "",
          fatigue: 0,
          form: 0,
          potential: 0,
        },
      ],
      disciplines: [{ id: "pow-1", name: "Power Test", category: "power", weight: 1, playerCount: 6 }],
      rosters: [
        // Heute: nur der S2-Zukauf steht bei B-B; der verkaufte Spieler ist weg.
        {
          id: "r-gekauft",
          teamId: "B-B",
          playerId: "p-gekauft",
          contractLength: 1,
          salary: 3,
          upkeep: 3,
          purchasePrice: 20,
          currentValue: 20,
          roleTag: "bench",
          promisedRole: null,
          joinedSeasonId: "season-2",
        },
      ],
      contracts: [],
      transferListings: [],
      transferHistory: [
        // Vor der Stichzeit: der ursprüngliche Kauf — darf NICHT angefasst werden.
        movementEntry({ id: "h-0", playerId: "p-verkauft", transferType: "buy", fromTeamId: null, toTeamId: "A-A", happenedAt: "2026-08-01T00:00:00.000Z" }),
        // Nach der Stichzeit: Ausverkauf + Folgesaison-Kauf.
        movementEntry({ id: "h-1", playerId: "p-verkauft", transferType: "sell", fromTeamId: "A-A", toTeamId: null, happenedAt: "2026-08-06T00:00:00.000Z" }),
        movementEntry({ id: "h-2", playerId: "p-gekauft", seasonId: "season-2", transferType: "buy", fromTeamId: null, toTeamId: "B-B", happenedAt: "2026-08-08T00:00:00.000Z" }),
      ],
      logs: [],
      mappingReport: {
        mappingSource: "test",
        teamSource: "test",
        generatedAt: "2026-06-04T00:00:00.000Z",
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
    } as GameState;
  }

  function movementEntry(overrides: Partial<TransferHistoryEntry>): TransferHistoryEntry {
    return {
      id: "h-x",
      playerId: "p-x",
      seasonId: "season-1",
      seasonLabel: "Season 1",
      transferType: "sell",
      fromTeamId: null,
      toTeamId: null,
      fee: 0,
      salary: 0,
      marketValue: 0,
      remainingContractLength: 0,
      happenedAt: "2026-08-05T00:00:00.000Z",
      ...overrides,
    };
  }

  const stichzeit = "2026-08-04T18:00:00.000Z";

  it("stellt den Kaderstand zur Stichzeit wieder her und setzt die Vorsaison-Werte", () => {
    const result = buildSeasonEndReconstructedGameState(createGameState(), stichzeit);

    expect(result.movementsReverted).toBe(2);
    expect(result.playersMissing).toEqual([]);
    expect(result.warnings).toEqual([]);

    // Zur Stichzeit: p-verkauft bei A-A, p-gekauft noch nicht in der Liga.
    const membership = new Map(result.gameState.rosters.map((entry) => [entry.playerId, entry.teamId] as const));
    expect(membership.get("p-verkauft")).toBe("A-A");
    expect(membership.has("p-gekauft")).toBe(false);

    // Werte: der festgehaltene Saisonstand, nicht der weiterentwickelte.
    const verkauft = result.gameState.players.find((player) => player.id === "p-verkauft");
    expect(verkauft?.disciplineRatings).toEqual({ "pow-1": 60 });
    expect(result.membersWithPreviousSeasonValues).toBe(1);
    expect(result.membersTotal).toBe(1);
  });

  it("Messsonden-Modus lässt die heutigen Werte unangetastet", () => {
    const result = buildSeasonEndReconstructedGameState(createGameState(), stichzeit, { ratingsSource: "current" });
    const verkauft = result.gameState.players.find((player) => player.id === "p-verkauft");
    expect(verkauft?.disciplineRatings).toEqual({ "pow-1": 66 });
  });

  it("weist einen Spieler ohne Datensatz aus, statt ihn still zu ersetzen", () => {
    const gameState = createGameState();
    gameState.transferHistory.push(
      movementEntry({ id: "h-3", playerId: "p-unbekannt", transferType: "sell", fromTeamId: "A-A", toTeamId: null, happenedAt: "2026-08-06T01:00:00.000Z" }),
    );

    const result = buildSeasonEndReconstructedGameState(gameState, stichzeit);
    expect(result.playersMissing).toEqual(["p-unbekannt"]);
  });
});
