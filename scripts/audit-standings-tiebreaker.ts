import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { DEFAULT_STANDINGS_TIEBREAKER_MODE } from "@/lib/standings/standings-tiebreaker-policy";

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));

  const preview = await buildStandingsPreview({
    saveId: "save-initial",
    seasonId: "season-1",
    matchdayId: "matchday-1",
  });

  const requiresConfirmedTieBreaker = preview.tieGroups.some((group) => group.requiresConfirmedTieBreaker);
  const affectedTeams = Array.from(
    new Set(preview.tieGroups.flatMap((group) => group.affectedTeams.map((team) => `${team.teamId}:${team.teamName}`))),
  );

  const tieFieldsAvailable = [
    "totalScore",
    "matchdayRank",
    "currentRank",
    "currentPoints",
    "projectedPoints",
    "cash",
    "teamName (technical only)",
  ];

  const recommendation = requiresConfirmedTieBreaker
    ? "apply_block_until_confirmed_tiebreaker"
    : "no_apply_tiebreaker_blocker";

  console.log(
    JSON.stringify(
      {
        scope: preview.scope,
        policyMode: DEFAULT_STANDINGS_TIEBREAKER_MODE,
        tieGroups: preview.tieGroups,
        affectedTeams,
        tieFieldsAvailable,
        requiresConfirmedTieBreaker,
        recommendation,
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
