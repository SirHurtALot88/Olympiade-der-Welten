import { executeLocalTransfermarktBuy, listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame } from "@/lib/persistence/types";

const WRITE_ENABLED = process.argv.includes("--write");
const ALLOW_NON_SEASON1 = process.argv.includes("--allow-non-season1");

function getTargetRoster(save: PersistedSaveGame, teamId: string) {
  const team = save.gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const playerMin = Number.isFinite(identity?.playerMin) ? Math.round(identity?.playerMin ?? 7) : 7;
  const playerOpt = Number.isFinite(identity?.playerOpt) ? Math.round(identity?.playerOpt ?? playerMin) : playerMin;
  const rosterLimit = Number.isFinite(team?.rosterLimit) ? Math.round(team?.rosterLimit ?? 12) : 12;
  return Math.min(Math.max(playerOpt, playerMin), rosterLimit, 12);
}

function main() {
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  if (!save) throw new Error("No active local save available.");
  if (save.gameState.season.id !== "season-1" && !ALLOW_NON_SEASON1) {
    throw new Error(
      `season1-autoprep-topup is limited to season-1 saves. Active season is ${save.gameState.season.id}; pass --allow-non-season1 only for an explicit sandbox repair.`,
    );
  }

  const purchases: Array<{
    teamId: string;
    playerId: string;
    playerName: string;
    fee: number | null;
    rosterAfter: number;
    cashAfter: number | null;
  }> = [];
  const blockers: string[] = [];

  for (const team of save.gameState.teams) {
    let currentSave = persistence.getSaveById(save.saveId) ?? save;
    let rosterCount = currentSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const targetRoster = getTargetRoster(currentSave, team.teamId);
    while (rosterCount < targetRoster) {
      currentSave = persistence.getSaveById(save.saveId) ?? currentSave;
      const feed = listLocalTransfermarktFreeAgents({
        saveId: save.saveId,
        seasonId: currentSave.gameState.season.id,
        teamId: team.teamId,
        limit: 5000,
      });
      const candidate = [...feed.items]
        .filter((item) => item.marketValue != null && item.marketValue > 0)
        .filter((item) => {
          const freshTeam = currentSave.gameState.teams.find((entry) => entry.teamId === team.teamId);
          return freshTeam && item.marketValue != null && freshTeam.cash >= item.marketValue;
        })
        .sort((left, right) => {
          const valueDelta = (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY);
          if (valueDelta !== 0) return valueDelta;
          return (right.ovr ?? 0) - (left.ovr ?? 0);
        })[0];

      if (!candidate) {
        blockers.push(`topup_no_affordable_candidate:${team.teamId}:roster_${rosterCount}:target_${targetRoster}`);
        break;
      }

      if (!WRITE_ENABLED) {
        purchases.push({
          teamId: team.teamId,
          playerId: candidate.playerId,
          playerName: candidate.name,
          fee: candidate.marketValue,
          rosterAfter: rosterCount + 1,
          cashAfter: (currentSave.gameState.teams.find((entry) => entry.teamId === team.teamId)?.cash ?? 0) - (candidate.marketValue ?? 0),
        });
        break;
      }

      const result = executeLocalTransfermarktBuy({
        saveId: save.saveId,
        seasonId: currentSave.gameState.season.id,
        teamId: team.teamId,
        playerId: candidate.playerId,
        contractLength: 1,
        transferSource: "season1_autoprep_topup",
      });
      if (!result.canBuy) {
        blockers.push(`topup_buy_blocked:${team.teamId}:${candidate.playerId}:${result.blockingReasons.join("|")}`);
        break;
      }
      purchases.push({
        teamId: team.teamId,
        playerId: candidate.playerId,
        playerName: candidate.name,
        fee: result.purchasePrice,
        rosterAfter: result.rosterAfter ?? rosterCount + 1,
        cashAfter: result.cashAfter,
      });
      rosterCount = result.rosterAfter ?? rosterCount + 1;
    }
  }

  console.log(JSON.stringify({
    saveId: save.saveId,
    dryRun: !WRITE_ENABLED,
    purchases,
    purchaseCount: purchases.length,
    blockers,
  }, null, 2));

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main();
