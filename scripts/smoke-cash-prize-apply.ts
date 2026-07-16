import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  CASH_PRIZE_APPLY_CONFIRM_TOKEN,
  executeCashPrizeApply,
  previewCashPrizeApply,
} from "@/lib/season/cash-prize-apply-service";

async function main() {
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave()?.saveId ?? null;
  const smokeSave = persistence.createFreshSeasonOneSave({
    name: `Cash Prize Smoke ${new Date().toLocaleString("de-DE")}`,
  });

  try {
    const save = persistence.getSaveById(smokeSave.saveId) ?? smokeSave;
    const [teamA, teamB] = save.gameState.teams.slice(0, 2);
    if (!teamA || !teamB) {
      throw new Error("Smoke save did not contain enough teams.");
    }

    persistence.saveSingleplayerState(save.saveId, {
      ...save.gameState,
      teams: [
        { ...teamA, cash: 37.9 },
        { ...teamB, cash: 49.8 },
      ],
      teamIdentities: save.gameState.teamIdentities.filter(
        (identity) => identity.teamId === teamA.teamId || identity.teamId === teamB.teamId,
      ),
      rosters: save.gameState.rosters.filter(
        (entry) => entry.teamId === teamA.teamId || entry.teamId === teamB.teamId,
      ),
      seasonState: {
        ...save.gameState.seasonState,
        standings: {
          [teamA.teamId]: { points: 22, rank: 1 },
          [teamB.teamId]: { points: 19, rank: 2 },
        },
        cashPrizeApplyLogs: [],
      },
    });

    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      source: "sqlite" as const,
    };

    const dryRun = await previewCashPrizeApply(params);
    if (!dryRun.ok) {
      throw new Error(`Cash dry run blocked: ${dryRun.blockingReasons.join(" | ")}`);
    }

    const executed = await executeCashPrizeApply({
      ...params,
      execute: true,
      confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
    });
    if (!executed.ok || !executed.applied) {
      throw new Error(`Cash execute blocked: ${executed.blockingReasons.join(" | ")}`);
    }

    const duplicate = await previewCashPrizeApply(params);
    if (duplicate.ok) {
      throw new Error("Duplicate cash apply preview should have been blocked after execute.");
    }

    const updatedSave = persistence.getSaveById(save.saveId);
    const updatedTeams = updatedSave?.gameState.teams ?? [];

    console.log(
      JSON.stringify(
        {
          saveId: save.saveId,
          seasonId: params.seasonId,
          dryRun: {
            canApply: dryRun.canApply,
            plannedChanges: dryRun.plannedChanges.map((row) => ({
              teamCode: row.teamCode,
              oldCash: row.oldCash,
              prizeMoney: row.prizeMoney,
              newCash: row.newCash,
            })),
          },
          execute: {
            applied: executed.applied,
            auditLogId: executed.auditLogId,
          },
          duplicateBlocked: duplicate.blockingReasons.includes("duplicate_apply_for_save_season_block"),
          persistedCash: updatedTeams.map((team) => ({
            teamId: team.teamId,
            cash: team.cash,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousActiveSave) {
      persistence.activateSave(previousActiveSave);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
