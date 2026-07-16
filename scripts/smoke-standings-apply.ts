import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  executeStandingsApply,
  previewStandingsApply,
  STANDINGS_APPLY_CONFIRM_TOKEN,
} from "@/lib/standings/standings-apply-service";

async function main() {
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave()?.saveId ?? null;
  const smokeSave = persistence.createFreshSeasonOneSave({
    name: `Standings Apply Smoke ${new Date().toLocaleString("de-DE")}`,
  });

  try {
    const save = persistence.getSaveById(smokeSave.saveId) ?? smokeSave;
    const [teamA, teamB] = save.gameState.teams.slice(0, 2);
    if (!teamA || !teamB) {
      throw new Error("Smoke save did not contain enough teams.");
    }

    const matchdayResultId = `smoke-matchday-result__${save.saveId}`;
    persistence.saveSingleplayerState(save.saveId, {
      ...save.gameState,
      teams: [teamA, teamB],
      teamIdentities: save.gameState.teamIdentities.filter(
        (identity) => identity.teamId === teamA.teamId || identity.teamId === teamB.teamId,
      ),
      rosters: save.gameState.rosters.filter(
        (entry) => entry.teamId === teamA.teamId || entry.teamId === teamB.teamId,
      ),
      seasonState: {
        ...save.gameState.seasonState,
        standings: {
          [teamA.teamId]: { points: 12, rank: 2 },
          [teamB.teamId]: { points: 14, rank: 1 },
        },
        standingsApplyLogs: [],
        matchdayResults: [
          {
            id: matchdayResultId,
            saveId: save.saveId,
            seasonId: save.gameState.season.id,
            matchdayId: save.gameState.matchdayState.matchdayId,
            status: "preview_applied",
            sourceVersion: "standings-smoke-fixture-v1",
            teamsTotal: 2,
            teamsReady: 2,
            teamsUnderfilled: 0,
            teamsMissingLineup: 0,
            teamsInvalidLineup: 0,
            teamsMissingScoreCoverage: 0,
            warningsCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        disciplineResults: [
          {
            id: "smoke-dr-1",
            matchdayResultId,
            teamId: teamA.teamId,
            disciplineId: "mini-dm",
            disciplineSide: "d1",
            rank: 1,
            baseScore: 55,
            totalScore: 55,
            readinessStatus: "ready",
            warnings: [],
            createdAt: new Date().toISOString(),
          },
          {
            id: "smoke-dr-2",
            matchdayResultId,
            teamId: teamA.teamId,
            disciplineId: "fechten",
            disciplineSide: "d2",
            rank: 1,
            baseScore: 44,
            totalScore: 44,
            readinessStatus: "ready",
            warnings: [],
            createdAt: new Date().toISOString(),
          },
          {
            id: "smoke-dr-3",
            matchdayResultId,
            teamId: teamB.teamId,
            disciplineId: "mini-dm",
            disciplineSide: "d1",
            rank: 2,
            baseScore: 35,
            totalScore: 35,
            readinessStatus: "ready",
            warnings: [],
            createdAt: new Date().toISOString(),
          },
          {
            id: "smoke-dr-4",
            matchdayResultId,
            teamId: teamB.teamId,
            disciplineId: "fechten",
            disciplineSide: "d2",
            rank: 2,
            baseScore: 27,
            totalScore: 27,
            readinessStatus: "ready",
            warnings: [],
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      source: "sqlite" as const,
    };

    const dryRun = await previewStandingsApply(params);
    if (!dryRun.ok) {
      throw new Error(`Standings dry run blocked: ${dryRun.blockingReasons.join(" | ")}`);
    }

    const execute = await executeStandingsApply({
      ...params,
      execute: true,
      confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
    });
    if (!execute.ok || !execute.applied) {
      throw new Error(`Standings execute blocked: ${execute.blockingReasons.join(" | ")}`);
    }

    const duplicate = await previewStandingsApply(params);
    if (duplicate.ok) {
      throw new Error("Duplicate apply preview should have been blocked after execute.");
    }

    const updatedSave = persistence.getSaveById(save.saveId);
    const standings = updatedSave?.gameState.seasonState.standings ?? {};

    console.log(
      JSON.stringify(
        {
          saveId: save.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          dryRun: {
            canApply: dryRun.canApply,
            plannedChanges: dryRun.plannedChanges.map((row) => ({
              teamId: row.teamId,
              oldPoints: row.oldPoints,
              delta: row.delta,
              newPoints: row.newPoints,
              oldRank: row.oldRank,
              newRank: row.newRank,
            })),
          },
          execute: {
            applied: execute.applied,
            auditLogId: execute.auditLogId,
          },
          duplicateBlocked: duplicate.blockingReasons.includes("duplicate_apply_for_save_season_matchday"),
          persistedStandings: {
            [teamA.teamId]: standings[teamA.teamId],
            [teamB.teamId]: standings[teamB.teamId],
          },
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
