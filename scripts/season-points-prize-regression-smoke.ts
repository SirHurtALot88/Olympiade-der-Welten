import { loadEnvConfig } from "@next/env";

import { runSeasonPointsPrizeRegressionSmoke } from "@/lib/season/season-points-prize-regression";

loadEnvConfig(process.cwd());

runSeasonPointsPrizeRegressionSmoke()
  .then((summary) => {
    console.log(
      JSON.stringify(
        {
          ok: summary.warnings.length === 0,
          champion: summary.champion,
          expectedTotalSeasonPoints: summary.expectedTotalSeasonPoints,
          actualTotalSeasonPoints: summary.actualTotalSeasonPoints,
          totalPrizeMoney: summary.totalPrizeMoney,
          totalRankChangeBonus: summary.totalRankChangeBonus,
          warnings: summary.warnings,
          exports: summary.exports,
        },
        null,
        2,
      ),
    );
    if (summary.warnings.length > 0) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
