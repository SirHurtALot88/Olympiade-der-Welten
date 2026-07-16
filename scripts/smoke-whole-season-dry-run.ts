import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { runWholeSeasonDryRun } from "@/lib/season/whole-season-dryrun-service";

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function resolveMaxRequiredSeasonRosterSize(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for whole season dryrun smoke.`);
  }

  let maxRequiredUniquePlayers = 0;

  for (const currentMatchdayId of save.gameState.season.matchdayIds) {
    const contextResult = loadLocalLegacyLineupContext({
      saveId,
      seasonId,
      matchdayId: currentMatchdayId,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!contextResult.ok) {
      throw new Error(`Whole season smoke base context failed for ${currentMatchdayId}: ${contextResult.errors.join(" | ")}`);
    }

    const requiredUniquePlayers =
      (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
      (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
    maxRequiredUniquePlayers = Math.max(maxRequiredUniquePlayers, requiredUniquePlayers);
  }

  return maxRequiredUniquePlayers;
}

function topUpRostersForLineups(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for whole season dryrun smoke.`);
  }

  const requiredUniquePlayers = resolveMaxRequiredSeasonRosterSize(saveId, seasonId);

  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const teamRoster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);

    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up whole season dryrun smoke rosters.");
      }
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `whole-season-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: seasonId,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) {
    persistence.saveSingleplayerState(save.saveId, save.gameState);
  }
}

async function main() {
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const createdSave = persistence.createFreshSeasonOneSave({
    name: `Whole Season DryRun Smoke ${new Date().toISOString()}`,
  });
  const saveId = createdSave.saveId;
  const seasonId = createdSave.gameState.season.id;

  try {
    topUpRostersForLineups(saveId, seasonId);

    const save = requireValue(persistence.getSaveById(saveId), "Smoke save missing after setup.");
    save.gameState.seasonState.teamControlSettings = Object.fromEntries(
      save.gameState.teams.map((team) => [
        team.teamId,
        {
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    persistence.saveSingleplayerState(saveId, save.gameState);

    const before = structuredClone(requireValue(persistence.getSaveById(saveId), "Smoke save missing before dryrun."));
    const result = await runWholeSeasonDryRun(
      {
        source: "sqlite",
        saveId,
        seasonId,
        maxMatchdays: 2,
        dryRun: true,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: true,
          stopOnMissingManualLineups: true,
          advanceAfterEachMatchday: true,
          includeMarketPhase: false,
        },
      },
      persistence,
    );

    const after = requireValue(persistence.getSaveById(saveId), "Smoke save missing after dryrun.");
    if (JSON.stringify(before.gameState) !== JSON.stringify(after.gameState)) {
      throw new Error("Whole season dryrun changed the persisted local save.");
    }

    if (result.blockedAtMatchday && result.blockingReasons.length > 0) {
      console.log(
        JSON.stringify(
        {
          saveId,
          seasonId,
          status: result.status,
          simulatedMatchdays: result.simulatedMatchdays,
          blockedAtMatchday: result.blockedAtMatchday,
          blockingReasons: result.blockingReasons,
          missingManualLineups: result.missingManualLineups,
          missingAiLineups: result.missingAiLineups,
          snapshotReadiness: result.snapshotReadiness,
          playerPPsReconciliation: result.playerPPsReconciliation,
          teamPPsReconciliation: result.teamPPsReconciliation,
          readOnly: result.readOnly,
          unchangedSave: true,
          testStatus: "blocked_as_expected",
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!result.ok) {
      throw new Error(`Whole season dryrun blocked unexpectedly: ${result.blockingReasons.join(" | ")}`);
    }

    console.log(
      JSON.stringify(
        {
          saveId,
          seasonId,
          status: result.status,
          simulationMode: result.simulationMode,
          simulatedMatchdays: result.simulatedMatchdays,
          totalMatchdays: result.scope.totalMatchdays,
          maxMatchdays: result.scope.maxMatchdays,
          projectedFinalStandingsTop3: result.projectedFinalStandings.slice(0, 3),
          projectedCashTop3: result.projectedCashTable.slice(0, 3),
          missingManualLineups: result.missingManualLineups,
          missingAiLineups: result.missingAiLineups,
          snapshotReadiness: result.snapshotReadiness,
          playerPPsReconciliation: result.playerPPsReconciliation,
          teamPPsReconciliation: result.teamPPsReconciliation,
          warnings: result.warnings,
          unchangedSave: true,
          testStatus: "passed",
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousActiveSave?.saveId && previousActiveSave.saveId !== saveId) {
      persistence.activateSave(previousActiveSave.saveId);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
