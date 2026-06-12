import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function topUpRostersForLineups(saveId: string, seasonId: string, matchdayId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} could not be loaded for matchday auto-run smoke.`);
  }

  const sampleContext = loadLocalLegacyLineupContext({
    saveId,
    seasonId,
    matchdayId,
    teamId: save.gameState.teams[0]!.teamId,
  });
  if (!sampleContext.ok) {
    throw new Error(`Smoke base context failed: ${sampleContext.errors.join(" | ")}`);
  }

  const requiredUniquePlayers =
    (sampleContext.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (sampleContext.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);

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
        throw new Error("Not enough free players to top up auto-run smoke rosters.");
      }
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `matchday-auto-roster-${rosterCounter}`,
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
    name: `Auto Run Smoke ${new Date().toISOString()}`,
  });
  const saveId = createdSave.saveId;
  const seasonId = createdSave.gameState.season.id;
  const matchdayId = createdSave.gameState.matchdayState.matchdayId;

  try {
    topUpRostersForLineups(saveId, seasonId, matchdayId);

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

    const prismaBefore = await loadFoundationSnapshotFromPrisma("save-initial");

    const dryRun = await runLocalMatchdayAutoRun({
      saveId,
      seasonId,
      matchdayId,
      source: "sqlite",
      dryRun: true,
      options: {
        includeWarningLineups: true,
        overwriteExistingLineups: true,
        stopOnTie: true,
      },
    });

    if (!dryRun.ok && dryRun.blockingReasons.length > 0) {
      throw new Error(`Auto-run dryRun blocked: ${dryRun.blockingReasons.join(" | ")}`);
    }

    const execute = await runLocalMatchdayAutoRun({
      saveId,
      seasonId,
      matchdayId,
      source: "sqlite",
      execute: true,
      dryRun: false,
      confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: {
        includeWarningLineups: true,
        overwriteExistingLineups: true,
        stopOnTie: true,
      },
    });

    if (!execute.ok || execute.status !== "applied") {
      throw new Error(`Auto-run execute blocked: ${execute.blockingReasons.join(" | ") || "unknown blocker"}`);
    }

    const afterSave = requireValue(persistence.getSaveById(saveId), "Smoke save missing after execute.");
    const prismaAfter = await loadFoundationSnapshotFromPrisma("save-initial");

    const prismaUnchanged =
      prismaBefore == null && prismaAfter == null
        ? true
        : prismaBefore != null &&
            prismaAfter != null &&
            prismaBefore.teamSeasonStates.length === prismaAfter.teamSeasonStates.length &&
            prismaBefore.activePlayers.length === prismaAfter.activePlayers.length &&
            prismaBefore.players.length === prismaAfter.players.length;

    if (!prismaUnchanged) {
      throw new Error("Prisma reference snapshot changed during local matchday auto-run smoke.");
    }

    console.log(
      JSON.stringify(
        {
          saveId,
          seasonId,
          dryRun: {
            status: dryRun.status,
            lineupsReady: dryRun.summary.lineupsReady,
            warningTeams: dryRun.summary.warningTeams,
            plannedWrites: dryRun.summary.plannedWrites,
          },
          execute: {
            status: execute.status,
            aiLineupTeamsSaved: execute.appliedAudits.aiLineupTeamsSaved,
            resultApply: execute.appliedAudits.resultApply,
            standingsApply: execute.appliedAudits.standingsApply,
          },
          nextMatchday: {
            currentMatchday: afterSave.gameState.season.currentMatchday,
            activeMatchdayId: afterSave.gameState.matchdayState.matchdayId,
            pendingTeams: afterSave.gameState.matchdayState.pendingTeamIds.length,
          },
          prismaUnchanged,
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
