import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { applyAiManagerPlan } from "@/lib/ai/ai-manager-apply-service";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
import type { GameState, RosterEntry, TeamControlSettings, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager, withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { mapArchetypeToCurveShape, mapStarTierToRarity } from "@/lib/sponsor/sponsor-curve-shapes";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs", "season-prep");
const RETRY_ROUND_LIMITS = [16, 20, 24] as const;

type DraftQuality = "RED" | "YELLOW" | "GREEN";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[season-prep-draft-inspect] ${message}`);
}

function rosterCounts(gameState: GameState) {
  return gameState.teams.map((team) => ({
    team,
    identity: gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null,
    roster: gameState.rosters.filter((entry) => entry.teamId === team.teamId),
  }));
}

function classifyTeamDraftQuality(
  team: { rosterLimit?: number },
  identity: { playerMin?: number; playerOpt?: number } | null,
  cash: number,
  rosterCount: number,
): DraftQuality {
  const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
  if (rosterCount < playerMin || cash < 0) return "RED";
  if (rosterCount < playerOpt) return "YELLOW";
  return "GREEN";
}

function setAllTeamsAi(save: PersistedSaveGame, persistence: PersistenceService) {
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
        notes: "season_prep_draft_inspect_all_ai",
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
      label: save.name,
      description: "Fresh Season Draft Inspect save for realistic multi-season simulation.",
      sourceSaveId: save.saveId,
      isStableTestPoint: true,
      allowTestWrites: true,
      containsSeasonHistory: false,
      containsFinalStandings: false,
    },
  );
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

function rollbackTeamSeasonOneDraftPurchases(gameState: GameState, teamId: string, seasonId: string): GameState {
  const seasonBuys = gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      entry.transferType === "buy" &&
      entry.toTeamId === teamId &&
      (entry.source === "season1_autoprep_topup" || entry.source === "preseason_roster_repair_buy"),
  );
  const buyPlayerIds = new Set(seasonBuys.map((entry) => entry.playerId));
  const buyIds = new Set(seasonBuys.map((entry) => entry.id));
  const feeRefund = seasonBuys.reduce((sum, entry) => sum + entry.fee, 0);

  return {
    ...gameState,
    teams: gameState.teams.map((team) =>
      team.teamId === teamId ? { ...team, cash: round(team.cash + feeRefund) } : team,
    ),
    rosters: gameState.rosters.filter((entry) => !(entry.teamId === teamId && buyPlayerIds.has(entry.playerId))),
    transferHistory: gameState.transferHistory.filter((entry) => !buyIds.has(entry.id)),
  };
}

function classifyAllTeams(save: PersistedSaveGame) {
  return rosterCounts(save.gameState).map(({ team, identity, roster }) => ({
    teamId: team.teamId,
    shortCode: team.shortCode,
    rosterCount: roster.length,
    cash: team.cash,
    quality: classifyTeamDraftQuality(team, identity, team.cash, roster.length),
    targets: deriveRosterTargets(team, identity),
  }));
}

function buildTeamExportRow(save: PersistedSaveGame, teamId: string) {
  const { gameState } = save;
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const roster = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const gm = getTeamGeneralManager(gameState, teamId);
  const sponsor = getTeamSponsorContract(gameState, teamId);
  const salaryFactorWindow = getSeasonEconomyFactorWindow({
    saveId: save.saveId,
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  });
  const seasonTransfers = gameState.transferHistory.filter((entry) => entry.seasonId === gameState.season.id);
  const teamTransfers = seasonTransfers.filter(
    (entry) => entry.toTeamId === teamId || entry.fromTeamId === teamId,
  );

  return {
    teamId,
    shortCode: team?.shortCode ?? teamId,
    name: team?.name ?? teamId,
    cash: team?.cash ?? 0,
    rosterCount: roster.length,
    targets: deriveRosterTargets(team, identity),
    gm: gm
      ? {
          gmId: gm.profile.gmId,
          name: gm.profile.name,
          archetype: gm.profile.archetype,
          title: gm.profile.title,
        }
      : null,
    roster: roster.map((entry) => ({
      playerId: entry.playerId,
      contractLength: entry.contractLength,
      contractShape: entry.contractShape ?? "balanced",
      salary: entry.salary,
      purchasePrice: entry.purchasePrice,
      currentValue: entry.currentValue,
      yearlySalarySchedule: entry.yearlySalarySchedule ?? null,
    })),
    contractShapeDistribution: roster.reduce<Record<string, number>>((acc, entry) => {
      const shape = entry.contractShape ?? "balanced";
      acc[shape] = (acc[shape] ?? 0) + 1;
      return acc;
    }, {}),
    salaryFactorWindow,
    sponsor: sponsor
      ? {
          offerId: sponsor.offerId,
          name: sponsor.name,
          rarity: sponsor.rarity ?? mapStarTierToRarity(sponsor.starTier),
          curveShape: sponsor.curveShape ?? mapArchetypeToCurveShape(sponsor.archetype),
          termSeasons: sponsor.termSeasons ?? null,
        }
      : null,
    transfers: teamTransfers,
  };
}

function contractLengthDistribution(rosters: RosterEntry[]) {
  return rosters.reduce<Record<string, number>>((acc, entry) => {
    const key = String(entry.contractLength);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const startedAt = Date.now();
  loadEnvConfig(PROJECT_ROOT);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const persistence = createPersistenceService();
  const iso = new Date().toISOString();

  log("Creating fresh season-1 save…");
  const created = persistence.createFreshSeasonOneSave({
    name: `Draft Inspect ${iso}`,
    activate: false,
  });

  log(`Running season-start reset for ${created.saveId}…`);
  const reset = await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  if (reset.status !== "applied") {
    throw new Error(`Season-start reset blocked: ${reset.blockingReasons.join(" | ") || reset.warnings.join(" | ")}`);
  }

  let save = persistence.getSaveById(created.saveId) ?? created;
  const normalized = withNormalizedTeamGeneralManagers(save.gameState);
  save = persistence.saveSingleplayerState(save.saveId, normalized);
  save = setAllTeamsAi(save, persistence);

  const seasonId = save.gameState.season.id;
  log(`Running initial chunked redraft topup (playerOpt, roundLimit=${RETRY_ROUND_LIMITS[0]})…`);
  runChunkedRedraftTopup({
    persistence,
    saveId: save.saveId,
    seasonId,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "season1_initial_topup",
    target: "playerOpt",
    roundLimit: RETRY_ROUND_LIMITS[0],
    teamTimeLimitMs: 10_000,
    outputDir: OUTPUT_DIR,
  });

  let retryCount = 0;
  while (retryCount < 3) {
    save = persistence.getSaveById(save.saveId) ?? save;
    const classified = classifyAllTeams(save);
    const redTeams = classified.filter((row) => row.quality === "RED");
    if (redTeams.length === 0) break;

    log(`Quality gate retry ${retryCount + 1}/3 for ${redTeams.length} RED teams…`);
    let nextState = save.gameState;
    for (const row of redTeams) {
      nextState = rollbackTeamSeasonOneDraftPurchases(nextState, row.teamId, seasonId);
    }
    save = persistence.saveSingleplayerState(save.saveId, nextState);

    const roundLimit = RETRY_ROUND_LIMITS[retryCount] ?? 24;
    runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId,
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "season1_initial_topup",
      target: "playerOpt",
      roundLimit,
      targetTeamIds: redTeams.map((row) => row.teamId),
      teamTimeLimitMs: 10_000,
      outputDir: path.join(OUTPUT_DIR, `retry-${retryCount + 1}`),
    });
    retryCount += 1;
  }

  save = persistence.getSaveById(save.saveId) ?? save;
  const finalClassification = classifyAllTeams(save);
  const stillRed = finalClassification.filter((row) => row.quality === "RED");
  if (stillRed.length > 0) {
    throw new Error(
      `Draft quality gate failed after ${retryCount} retries: ${stillRed.map((row) => `${row.shortCode}:${row.rosterCount}/${row.targets.playerMin}:cash=${row.cash}`).join(" | ")}`,
    );
  }

  log("Applying AI market plan (buy-only)…");
  await applyAiMarketPlanLocally({
    source: "sqlite",
    saveId: save.saveId,
    seasonId,
    teamScope: "all",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: LOCAL_TRANSFER_WINDOW_PHASE,
    options: {
      applySellSteps: false,
      applyBuySteps: true,
      stopOnTeamFailure: false,
      includeWarningTeams: true,
    },
  });

  save = persistence.getSaveById(save.saveId) ?? save;
  log("Applying AI manager plan…");
  applyAiManagerPlan({ save, dryRun: false, persistence });

  save = persistence.getSaveById(save.saveId) ?? save;
  log("Choosing sponsor offers for AI teams…");
  const withSponsors = chooseSponsorOfferForAiTeams(save.gameState);
  save = persistence.saveSingleplayerState(save.saveId, withSponsors);

  log(`Activating save ${save.saveId}…`);
  persistence.activateSave(save.saveId);
  save = persistence.getSaveById(save.saveId) ?? save;

  const qualityCounts = finalClassification.reduce(
    (acc, row) => {
      acc[row.quality] += 1;
      return acc;
    },
    { RED: 0, YELLOW: 0, GREEN: 0 },
  );
  const cashValues = save.gameState.teams.map((team) => team.cash);
  const allRosters = save.gameState.rosters;
  const contractLengths = contractLengthDistribution(allRosters);

  const exportPayload = {
    generatedAt: iso,
    saveId: save.saveId,
    saveName: save.name,
    seasonId,
    timingMs: Date.now() - startedAt,
    draftQuality: {
      counts: qualityCounts,
      teams: finalClassification,
    },
    cashRange: {
      min: Math.min(...cashValues),
      max: Math.max(...cashValues),
      avg: round(cashValues.reduce((sum, value) => sum + value, 0) / Math.max(cashValues.length, 1)),
    },
    contractLengthDistribution: contractLengths,
    teams: save.gameState.teams.map((team) => buildTeamExportRow(save, team.teamId)),
  };

  const timestamp = Date.now();
  const exportPath = path.join(OUTPUT_DIR, `draft-inspect-${timestamp}.json`);
  fs.writeFileSync(exportPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");

  console.log("\n=== SEASON PREP DRAFT INSPECT ===");
  console.log(`saveId: ${save.saveId}`);
  console.log(`timing: ${round((Date.now() - startedAt) / 1000, 1)}s`);
  console.log(`draft quality: RED=${qualityCounts.RED} YELLOW=${qualityCounts.YELLOW} GREEN=${qualityCounts.GREEN}`);
  console.log(`cash range: ${exportPayload.cashRange.min} – ${exportPayload.cashRange.max} (avg ${exportPayload.cashRange.avg})`);
  console.log(`contract lengths: ${JSON.stringify(contractLengths)}`);
  console.log(`export: ${exportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
