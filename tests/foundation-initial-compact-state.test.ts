import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";

function createGameState(): GameState {
  return {
    saveVersion: 3,
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds: ["md-1", "md-2"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      seasonSnapshots: [{ id: "snap-1" } as never],
      standingsApplyLogs: [{ id: "standings-log-1" } as never],
      matchdayResults: [
        { id: "result-md-1", matchdayId: "md-1" } as never,
        { id: "result-md-2", matchdayId: "md-2" } as never,
      ],
      disciplineResults: [
        { id: "disc-md-1", matchdayResultId: "result-md-1" } as never,
        { id: "disc-md-2", matchdayResultId: "result-md-2" } as never,
      ],
      lineupDrafts: [
        { lineupId: "lineup-md-1", matchdayId: "md-1", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
        { lineupId: "lineup-md-2", matchdayId: "md-2", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
      ],
    },
    matchdayState: { matchdayId: "md-2", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    transferHistory: [{ id: "transfer-1" } as never],
    logs: [{ id: "log-1", message: "hello" } as never],
    playerBaselines: [{ playerId: "p-1", attributes: { power: 50 } } as never],
    baselineWriteGuardEvents: [{ id: "guard-1" } as never],
    players: [
      {
        id: "p-1",
        name: "Hero",
        rating: 60,
        marketValue: 10,
        salaryDemand: 2,
        className: "Hero",
        race: "Human",
        alignment: "N",
        gender: "x",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "Lore EN",
        flavorDe: "Lore DE",
        attributeSheetStats: { power: 70 },
        fatigue: 0,
        form: 0,
        potential: 70,
      },
    ],
    teams: [],
    teamIdentities: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-26T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("foundation initial compact state", () => {
  it("keeps transfer history on compact initial load", () => {
    const existing = createGameState();
    const compact = compactFoundationInitialGameState(existing);
    expect(compact.transferHistory).toEqual(existing.transferHistory);
  });

  it("keeps attribute sheets on compact initial load while admin unlock is enabled", () => {
    const existing = createGameState();
    const compact = compactFoundationInitialGameState(existing);
    expect(compact.players[0]?.attributeSheetStats).toEqual({ power: 70 });
  });

  it("strips persisted season derivations from compact payloads", () => {
    const existing = createGameState();
    existing.seasonState.persistedSeasonDerivations = {
      seasonId: existing.season.id,
      contentSignature: "sig-test",
      updatedAt: new Date().toISOString(),
      ledger: {
        hasResultSource: false,
        pointEntries: [],
        warnings: [],
        teamSummariesByTeamId: {},
        playerSummariesByPlayerId: {},
      },
      ratingsByPlayerId: {},
      performanceByPlayerId: {},
    };
    const compact = compactFoundationInitialGameState(existing);
    expect(compact.seasonState.persistedSeasonDerivations).toBeUndefined();

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compact);
    expect(rehydrated.seasonState.persistedSeasonDerivations).toEqual(existing.seasonState.persistedSeasonDerivations);
  });

  it("rehydrates compact PUT payloads without wiping archived save slices", () => {
    const existing = createGameState();
    const compactClientState = compactFoundationInitialGameState(existing);
    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compactClientState);

    expect(rehydrated.transferHistory).toEqual(existing.transferHistory);
    expect(rehydrated.logs).toEqual(existing.logs);
    expect(rehydrated.playerBaselines).toEqual(existing.playerBaselines);
    expect(rehydrated.baselineWriteGuardEvents).toEqual(existing.baselineWriteGuardEvents);
    expect(rehydrated.seasonState.seasonSnapshots).toEqual(existing.seasonState.seasonSnapshots);
    expect(rehydrated.seasonState.standingsApplyLogs).toEqual(existing.seasonState.standingsApplyLogs);
    expect(rehydrated.seasonState.matchdayResults).toEqual(existing.seasonState.matchdayResults);
    expect(rehydrated.seasonState.disciplineResults).toEqual(existing.seasonState.disciplineResults);
    expect(rehydrated.seasonState.lineupDrafts).toEqual(existing.seasonState.lineupDrafts);
    expect(rehydrated.players[0]?.flavorDe).toBe("Lore DE");
    expect(rehydrated.players[0]?.attributeSheetStats).toEqual({ power: 70 });
  });

  it("keeps intentional client edits to compact-visible slices", () => {
    const existing = createGameState();
    const compactClientState = compactFoundationInitialGameState(existing);
    const editedClientState = {
      ...compactClientState,
      logs: [{ id: "log-new", message: "edited" } as never],
      players: compactClientState.players.map((player) =>
        player.id === "p-1" ? { ...player, name: "Edited Hero" } : player,
      ),
      seasonState: {
        ...compactClientState.seasonState,
        lineupDrafts: [
          {
            ...(compactClientState.seasonState.lineupDrafts?.[0] ?? {
              lineupId: "lineup-md-2",
              matchdayId: "md-2",
              teamId: "H-R",
              saveId: "save-1",
              seasonId: "season-1",
              status: "draft",
            }),
            status: "submitted",
          } as never,
        ],
      },
    };

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, editedClientState);

    expect(rehydrated.logs).toEqual(editedClientState.logs);
    expect(rehydrated.players.find((player) => player.id === "p-1")?.name).toBe("Edited Hero");
    expect(rehydrated.players.find((player) => player.id === "p-1")?.attributeSheetStats).toEqual({ power: 70 });
    expect(rehydrated.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual(["lineup-md-1", "lineup-md-2"]);
    expect(rehydrated.seasonState.lineupDrafts?.find((draft) => draft.lineupId === "lineup-md-2")?.status).toBe("submitted");
  });

  it("preserves lineup drafts for other teams on the same matchday during compact PUT", () => {
    const existing = createGameState();
    existing.seasonState.lineupDrafts = [
      { lineupId: "lineup-md-1", matchdayId: "md-1", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
      { lineupId: "lineup-md-2-hr", matchdayId: "md-2", teamId: "H-R", saveId: "save-1", seasonId: "season-1" } as never,
      { lineupId: "lineup-md-2-aa", matchdayId: "md-2", teamId: "A-A", saveId: "save-1", seasonId: "season-1" } as never,
    ];

    const compactClientState = compactFoundationInitialGameState(existing);
    expect(compactClientState.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual([
      "lineup-md-2-hr",
      "lineup-md-2-aa",
    ]);

    const rehydrated = rehydrateGameStateAfterCompactPut(existing, compactClientState);

    expect(rehydrated.seasonState.lineupDrafts?.map((draft) => draft.lineupId)).toEqual([
      "lineup-md-1",
      "lineup-md-2-hr",
      "lineup-md-2-aa",
    ]);
  });
});
