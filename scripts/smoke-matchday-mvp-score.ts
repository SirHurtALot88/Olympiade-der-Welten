import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  runMatchdayMvpScoring,
} from "@/lib/season/matchday-mvp-scoring-service";

function parseArgs(argv: string[]) {
  const flags = new Set(argv);
  return {
    execute: flags.has("--execute"),
    forceReplace: !flags.has("--no-force"),
  };
}

async function main() {
  const { execute, forceReplace } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();

  if (!activeSave) {
    throw new Error("No active local save is available for the matchday MVP smoke.");
  }

  const scope = {
    saveId: activeSave.saveId,
    seasonId: activeSave.gameState.season.id,
    matchdayId: activeSave.gameState.matchdayState.matchdayId,
  };

  const dryRun = await runMatchdayMvpScoring(
    {
      ...scope,
      dryRun: true,
      forceReplace,
    },
    persistence,
  );

  if (dryRun.d1Scoreboard.length !== 32) {
    throw new Error(`Expected 32 D1 rows, received ${dryRun.d1Scoreboard.length}.`);
  }
  if (dryRun.d2Scoreboard.length !== 32) {
    throw new Error(`Expected 32 D2 rows, received ${dryRun.d2Scoreboard.length}.`);
  }
  if (dryRun.d1Scoreboard.some((row) => row.rank == null || row.score == null || row.points == null)) {
    throw new Error("D1 scoreboard contains missing rank, score or points.");
  }
  if (dryRun.d2Scoreboard.some((row) => row.rank == null || row.score == null || row.points == null)) {
    throw new Error("D2 scoreboard contains missing rank, score or points.");
  }
  if (dryRun.mutatorMode !== "mvp_forced_mutators") {
    throw new Error(`Expected MVP mutator mode, received ${dryRun.mutatorMode}.`);
  }
  if (dryRun.d1Scoreboard.some((row) => row.mutator1Modifier !== 6 || row.mutator2Modifier !== 6)) {
    throw new Error("D1 scoreboard does not expose two visible +6 mutators per team.");
  }
  if (dryRun.d2Scoreboard.some((row) => row.mutator1Modifier !== 6 || row.mutator2Modifier !== 6)) {
    throw new Error("D2 scoreboard does not expose two visible +6 mutators per team.");
  }
  if (!dryRun.ppWinners.some((row) => (row.mutatorPpsBonus ?? 0) >= 0.3)) {
    throw new Error("No visible +0.3 player PP winner was produced by the MVP mutator path.");
  }

  let executeSummary:
    | {
        status: string;
        resultApplied: boolean;
        standingsApplied: boolean;
      }
    | null = null;

  if (execute) {
    const applied = await runMatchdayMvpScoring(
      {
        ...scope,
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
        forceReplace,
      },
      persistence,
    );

    if (!applied.resultApply.applied) {
      throw new Error(`Matchday result apply failed: ${applied.blockingReasons.join(" | ")}`);
    }
    if (!applied.standingsApply.applied) {
      throw new Error(`Standings apply failed: ${applied.blockingReasons.join(" | ")}`);
    }

    const updatedSave = persistence.getSaveById(scope.saveId);
    const seasonState = updatedSave?.gameState.seasonState;
    const disciplineResults = seasonState?.disciplineResults ?? [];
    const matchdayResults = seasonState?.matchdayResults ?? [];
    const standingsTeamCount = Object.keys(seasonState?.standings ?? {}).length;

    if (matchdayResults.length < 1) {
      throw new Error("No stored matchday result found after MVP execute.");
    }
    if (disciplineResults.length < 64) {
      throw new Error(`Expected at least 64 stored discipline rows, received ${disciplineResults.length}.`);
    }
    if (standingsTeamCount !== 32) {
      throw new Error(`Expected 32 teams in standings, received ${standingsTeamCount}.`);
    }

    executeSummary = {
      status: applied.status,
      resultApplied: applied.resultApply.applied,
      standingsApplied: applied.standingsApply.applied,
    };
  }

  const resultDump = {
    scope,
    dryRun: {
      status: dryRun.status,
      d1Discipline: dryRun.targetMatchday.d1DisciplineName,
      d2Discipline: dryRun.targetMatchday.d2DisciplineName,
      mutatorMode: dryRun.mutatorMode,
      resolveSources: dryRun.resolveSources,
      d1Rows: dryRun.d1Scoreboard.length,
      d2Rows: dryRun.d2Scoreboard.length,
      totalTeamsScored: dryRun.totalTeamsScored,
      warnings: dryRun.warnings.slice(0, 10),
      d1ScoreboardTop10: dryRun.d1Scoreboard.slice(0, 10),
      d2ScoreboardTop10: dryRun.d2Scoreboard.slice(0, 10),
      topPlayersD1: dryRun.d1TopPlayers.slice(0, 10),
      topPlayersD2: dryRun.d2TopPlayers.slice(0, 10),
      ppWinners: dryRun.ppWinners.slice(0, 10),
    },
    execute: executeSummary,
    matchdayFlow: {
      includesPrizePreview: false,
      includesCashApply: false,
      includesTransferPhase: false,
    },
  };

  const outputPath = path.resolve(process.cwd(), "test-results/matchday-mvp-v2-result.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(resultDump, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ...resultDump,
        artifacts: {
          resultDumpPath: outputPath,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
