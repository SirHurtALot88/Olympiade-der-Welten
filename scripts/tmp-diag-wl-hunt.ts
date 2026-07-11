import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { runCanonicalSeasonOneDraftPhase } from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RUNS = Number(process.argv[2] ?? "10");

function setAllTeamsAi(save: PersistedSaveGame, persistence: ReturnType<typeof createPersistenceService>) {
  const settings = Object.fromEntries(
    save.gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: `AI · ${team.shortCode}`,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
        notes: "wl_hunt",
        strategyLock: null,
      } satisfies TeamControlSettings,
    ]),
  );
  const gameState = withScenarioMeta(
    {
      ...save.gameState,
      teams: save.gameState.teams.map((team) => ({ ...team, humanControlled: false })),
      seasonState: {
        ...save.gameState.seasonState,
        teamControlSettings: settings,
      },
    },
    {
      scenarioType: "sandbox_multiseason_test",
      label: "W-L hunt",
      description: "W-L failure hunt",
      sourceSaveId: save.saveId,
      isStableTestPoint: true,
      allowTestWrites: true,
      containsSeasonHistory: false,
      containsFinalStandings: false,
    },
  );
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

async function runOnce(runIndex: number) {
  const outputDir = path.join(PROJECT_ROOT, "outputs", `diag-wl-hunt-${Date.now()}-r${runIndex}`);
  ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  const persistence = createPersistenceService();
  const created = persistence.createFreshSeasonOneSave({ name: `wl-hunt-${runIndex}` });
  await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  let save = persistence.getSaveById(created.saveId)!;
  save = setAllTeamsAi(save, persistence);
  const draft = await runCanonicalSeasonOneDraftPhase(save, persistence);
  const gameState = (persistence.getSaveById(save.saveId) ?? save).gameState;
  const wlTeam = gameState.teams.find((team) => team.shortCode === "W-L")!;
  const wlIdentity = gameState.teamIdentities.find((entry) => entry.teamId === wlTeam.teamId);
  const wlRoster = gameState.rosters.filter((entry) => entry.teamId === wlTeam.teamId).length;
  const { playerMin } = deriveRosterTargets(wlTeam, wlIdentity);
  const wlPreview = draft.picksRun.teams.find((team) => team.teamCode === "W-L")!;
  const result = {
    runIndex,
    wlRoster,
    playerMin,
    wlCash: wlTeam.cash,
    failed: wlRoster < playerMin,
    wlPreviewPlanned: wlPreview.plannedPicks.filter((pick) => pick.status !== "blocked").length,
    wlPreviewApplied: wlPreview.plannedPicks.filter((pick) => pick.status === "applied").length,
    wlTeamBlocking: wlPreview.blockingReasons,
    wlWarnings: wlPreview.warnings.filter(
      (warning) =>
        warning.includes("partial") ||
        warning.includes("fallback") ||
        warning.includes("excluded") ||
        warning.includes("broadened"),
    ),
    globalWlBlockers: draft.picksRun.blockingReasons.filter((reason) => reason.includes("W-L")),
    blockers: draft.blockers.filter((entry) => entry.includes("W-L")),
    picks: wlPreview.plannedPicks.map((pick) => ({
      status: pick.status,
      mv: pick.marketValue,
      minReach: pick.minimumReachableAfterPick,
    })),
  };
  if (result.failed) {
    fs.writeFileSync(path.join(outputDir, "wl-failure.json"), JSON.stringify(result, null, 2));
  }
  return result;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const results = [];
  for (let index = 0; index < RUNS; index += 1) {
    const result = await runOnce(index + 1);
    results.push(result);
    console.error(
      `Run ${index + 1}: W-L ${result.wlRoster}/${result.playerMin} planned=${result.wlPreviewPlanned} applied=${result.wlPreviewApplied} failed=${result.failed}`,
    );
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
