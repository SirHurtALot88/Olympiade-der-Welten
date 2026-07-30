import { describe, expect, it } from "vitest";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return { save, createdFromSeed: false };
    },
    getActiveSave() {
      return save;
    },
    getSaveById(saveId) {
      return save.saveId === saveId ? save : null;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      save = {
        ...save,
        updatedAt: "2026-06-06T00:00:01.000Z",
        gameState: structuredClone(nextGameState),
      };
      return save;
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(saveId) {
      return save.saveId === saveId ? save : null;
    },
    getSaveVersionMetadata() {
      throw new Error("Not implemented in test persistence.");
    },
    createScenarioSnapshot() {
      throw new Error("Not implemented in test persistence.");
    },
    deleteSave() {
      throw new Error("Not implemented in test persistence.");
    },
    deleteSaves() {
      throw new Error("Not implemented in test persistence.");
    },
    listSaves() {
      return [
        {
          saveId: save.saveId,
          name: save.name,
          status: save.status,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
        },
      ];
    },
  };
}

function topUpRostersForLineupMinimum(gameState: GameState, saveId = "test-save") {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext(
    {
      saveId,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      teamId: gameState.teams[0]!.teamId,
    },
    persistence,
  );
  if (!contextResult.ok) {
    throw new Error(contextResult.errors.join(" | "));
  }

  const requiredUniquePlayers =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up lineup test rosters.");
      }
      poolIndex += 1;
      gameState.rosters.push({
        id: `test-partial-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
      rosterCounter += 1;
    }
  }

  return requiredUniquePlayers;
}

describe("AI batch apply saves partial lineups for thin rosters", () => {
  // Chris' Meldung: Teams ohne genug Spieler für die großen Disziplinen wurden als
  // `skipped_warning` übersprungen und gingen KOMPLETT ohne Aufstellung (0 Punkte) in den
  // Spieltag. Vorgabe: "wenn das teams sind die keine 6 spieler zur verfügung haben für die
  // 6er diszi müssen sie wenigstens alle spieler einsetzen die möglich sind".
  it("deploys every available player instead of skipping the team entirely", () => {
    const gameState = createFreshSeasonOneGameState();
    const requiredUniquePlayers = topUpRostersForLineupMinimum(gameState);
    expect(requiredUniquePlayers).toBeGreaterThan(4);

    // Ein Team auf 4 Kaderspieler eindampfen — zu wenig für beide Disziplinseiten zusammen.
    const thinTeamId = gameState.teams[1]!.teamId;
    const thinTeamRoster = gameState.rosters.filter((entry) => entry.teamId === thinTeamId);
    const keptPlayerIds = new Set(thinTeamRoster.slice(0, 4).map((entry) => entry.playerId));
    gameState.rosters = gameState.rosters.filter(
      (entry) => entry.teamId !== thinTeamId || keptPlayerIds.has(entry.playerId),
    );

    const persistence = createInMemoryPersistence(gameState);
    const result = applyAiLegacyLineupBatchLocally(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        includeWarningTeams: false,
        overwriteExisting: false,
        dryRun: false,
      },
      persistence,
    );

    const thinTeamResult = result.results.find((entry) => entry.teamId === thinTeamId);
    expect(thinTeamResult).toBeDefined();
    // Ohne den Fix: result "skipped_warning", saved false — Team ohne Aufstellung.
    expect(thinTeamResult!.previewStatus).toBe("incomplete_roster");
    expect(thinTeamResult!.result).toBe("saved");
    expect(thinTeamResult!.saved).toBe(true);
    expect(thinTeamResult!.warnings).toContain("partial_lineup_saved_max_available_players");

    // Die gespeicherte Teilaufstellung setzt ALLE 4 verfügbaren Spieler ein.
    const persistedState = persistence.getSaveById("test-save")!.gameState;
    const draft = (persistedState.seasonState.lineupDrafts ?? []).find(
      (entry) => entry.teamId === thinTeamId && entry.matchdayId === gameState.matchdayState.matchdayId,
    );
    expect(draft).toBeDefined();
    expect(draft!.entries.length).toBe(4);
    expect(new Set(draft!.entries.map((entry) => entry.playerId)).size).toBe(4);
    for (const entry of draft!.entries) {
      expect(keptPlayerIds.has(entry.playerId)).toBe(true);
    }
  });

  it("never saves an empty lineup for a team without any roster players", () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);

    // Extremfall: gar kein Kader. Die Teilaufstellungs-Ausnahme greift nur, wenn wirklich
    // Spieler eingesetzt werden können — ein leerer Draft bleibt weiterhin ausgeschlossen.
    const emptyTeamId = gameState.teams[3]!.teamId;
    gameState.rosters = gameState.rosters.filter((entry) => entry.teamId !== emptyTeamId);

    const persistence = createInMemoryPersistence(gameState);
    const result = applyAiLegacyLineupBatchLocally(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        includeWarningTeams: false,
        overwriteExisting: false,
        dryRun: false,
      },
      persistence,
    );

    const emptyTeamResult = result.results.find((entry) => entry.teamId === emptyTeamId);
    expect(emptyTeamResult).toBeDefined();
    expect(emptyTeamResult!.saved).toBe(false);

    const persistedState = persistence.getSaveById("test-save")!.gameState;
    const draft = (persistedState.seasonState.lineupDrafts ?? []).find(
      (entry) => entry.teamId === emptyTeamId && entry.matchdayId === gameState.matchdayState.matchdayId,
    );
    expect(draft?.entries?.length ?? 0).toBe(0);
  });
});
