import fs from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { applyFacilityUpgrade, previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  loadLocalLegacyLineupContext,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  runLocalMatchdayAutoRun,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
} from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";
import { getTeamSponsorOffers, chooseSponsorOffer, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { applyTeamTrainingSettings, previewTeamTrainingSettings } from "@/lib/training/training-settings-service";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "balance-audit");
const DEFAULT_SEASONS = 5;
const DEFAULT_MATCHDAYS_PER_SEASON = 10;

function log(message: string) {
  console.error(`[multi-season-smoke] ${message}`);
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
      continue;
    }
    args.set(key, "true");
  }
  return {
    seasons: Number(args.get("seasons") ?? DEFAULT_SEASONS),
    matchdaysPerSeason: Number(args.get("matchdays-per-season") ?? DEFAULT_MATCHDAYS_PER_SEASON),
  };
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function resolveManualTeamId(save: PersistedSaveGame) {
  const settings = save.gameState.seasonState.teamControlSettings ?? {};
  const manual = Object.entries(settings).find(([, entry]) => entry.controlMode === "manual");
  return manual?.[0] ?? save.gameState.teams[0]?.teamId ?? null;
}

function resolveMaxRequiredSeasonRosterSize(save: PersistedSaveGame, seasonId: string) {
  let max = 0;
  for (const matchdayId of save.gameState.season.matchdayIds) {
    const contextResult = loadLocalLegacyLineupContext({
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!contextResult.ok) continue;
    max = Math.max(
      max,
      (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0),
    );
  }
  return max;
}

function topUpRostersForLineups(save: PersistedSaveGame, seasonId: string) {
  const persistence = createPersistenceService();
  const required = resolveMaxRequiredSeasonRosterSize(save, seasonId);
  const usedIds = new Set(save.gameState.rosters.map((r) => r.playerId));
  const freePlayers = save.gameState.players.filter((p) => !usedIds.has(p.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const teamRoster = save.gameState.rosters.filter((r) => r.teamId === team.teamId);
    const shortfall = Math.max(0, required - teamRoster.length);
    for (let i = 0; i < shortfall; i += 1) {
      const player = freePlayers[poolIndex];
      if (!player) throw new Error("Not enough free players to top up rosters.");
      const economy = resolvePlayerEconomyContract({ player });
      const salary = economy.salary ?? player.displaySalary ?? player.salaryDemand;
      const marketValue = economy.purchasePrice ?? economy.marketValue ?? player.displayMarketValue ?? player.marketValue;
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `multi-smoke-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(salary),
        upkeep: Math.round(salary),
        purchasePrice: Math.round(marketValue),
        currentValue: Math.round(marketValue),
        roleTag: "bench",
        joinedSeasonId: seasonId,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) persistence.saveSingleplayerState(save.saveId, save.gameState);
}

function setupFreshSoloSave(persistence = createPersistenceService()) {
  const created = persistence.createFreshSeasonOneSave({
    name: `Multi-Season Smoke ${new Date().toISOString()}`,
    activate: true,
  });
  const seasonId = created.gameState.season.id;
  topUpRostersForLineups(created, seasonId);

  const chrisTeamId = created.gameState.teams[0]?.teamId ?? "A-A";
  const nextGameState = applyGameModeOwnership(created.gameState, {
    saveMode: "solo_1",
    chrisTeamIds: [chrisTeamId],
    frankyTeamIds: [],
  });
  const saved = persistence.saveSingleplayerState(created.saveId, nextGameState);
  const manualTeamId = resolveManualTeamId(saved);
  if (!manualTeamId) throw new Error("No manual team after solo_1 setup.");
  return { save: saved, manualTeamId, seasonId };
}

function previewTrainingConfirmToken(save: PersistedSaveGame, teamId: string) {
  return previewTeamTrainingSettings({ save, teamId, trainingFocus: "BALANCED", trainingIntensity: "normal" }).confirmToken;
}

async function applyEconomy(
  save: PersistedSaveGame,
  manualTeamId: string,
  seasonId: string,
  persistence = createPersistenceService(),
): Promise<void> {
  // Phase 1: AI sell pass — all teams
  log("  Economy: AI sell pass (all teams)…");
  await applyAiMarketPlanLocally({
    source: "sqlite",
    saveId: save.saveId,
    seasonId,
    teamScope: "all",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: LOCAL_TRANSFER_WINDOW_PHASE,
    options: {
      applySellSteps: true,
      applyBuySteps: false,
      stopOnTeamFailure: false,
      includeWarningTeams: true,
    },
  });

  // Phase 2: AI buy pass — all teams
  log("  Economy: AI buy pass (all teams)…");
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
  log("  Economy: AI transfers done.");

  // Manual team: sponsor, facility, training
  let current = requireValue(persistence.getSaveById(save.saveId), "Save missing after AI transfers.");

  const withOffers = ensureSeasonSponsorOffers(current.gameState);
  persistence.saveSingleplayerState(current.saveId, withOffers);
  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after offer ensure.");
  const offers = getTeamSponsorOffers(current.gameState, manualTeamId);
  const sponsorOffer = offers[0];
  if (sponsorOffer) {
    const sponsorResult = chooseSponsorOffer({
      gameState: current.gameState,
      teamId: manualTeamId,
      offerId: sponsorOffer.offerId,
      saveId: current.saveId,
    });
    if (sponsorResult.contract) {
      persistence.saveSingleplayerState(current.saveId, sponsorResult.gameState);
      log(`  Economy: sponsor ${sponsorOffer.offerId} chosen.`);
    }
  }

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing before facility.");
  const facilityPreview = previewFacilityUpgrade(current, manualTeamId, "training_center");
  if (facilityPreview.ok && facilityPreview.confirmToken) {
    const facilityResult = applyFacilityUpgrade(
      current,
      manualTeamId,
      "training_center",
      facilityPreview.confirmToken,
      undefined,
      persistence,
    );
    if (facilityResult.applied) {
      log("  Economy: facility training_center upgrade OK.");
    }
  }

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing before training.");
  const trainingToken = previewTrainingConfirmToken(current, manualTeamId);
  applyTeamTrainingSettings(current, manualTeamId, "BALANCED", "normal", trainingToken, "multi_season_smoke", persistence);
  log("  Economy: training BALANCED/normal applied.");
}

function prepLineup(params: LegacyLineupKeyParams) {
  const contextResult = loadLocalLegacyLineupContext(params);
  if (!contextResult.ok) throw new Error(`Lineup context failed: ${contextResult.errors.join(" | ")}`);
  const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
  if (preview.status === "blocked" || preview.entries.length === 0) {
    throw new Error(`Lineup preview blocked: ${preview.warnings.join(" | ") || preview.status}`);
  }
  const modifiers = buildAiLegacyLineupModifiers(contextResult.context, preview.entries);
  const saveResult = saveLocalLegacyLineupDraft(params, preview.entries, modifiers);
  if (!saveResult.ok) throw new Error(`Lineup save failed: ${saveResult.errors.join(" | ")}`);
}

type SeasonMetrics = {
  seasonIndex: number;
  seasonId: string;
  teams: Array<{
    teamId: string;
    name: string;
    isManual: boolean;
    cash: number;
    budget: number;
    standingPoints: number | null;
    standingRank: number | null;
    standingCashTotal: number | null;
  }>;
  humanTeamPlayers: Array<{
    playerId: string;
    xpEarned: number;
    xpSpent: number;
  }>;
  transferActivity: Array<{
    transferType: string;
    fromTeamId: string | null;
    toTeamId: string | null;
    fee: number;
    seasonId: string;
  }>;
  matchdaysCompleted: number;
};

function collectSeasonMetrics(
  save: PersistedSaveGame,
  manualTeamId: string,
  seasonId: string,
  matchdaysCompleted: number,
  seasonIndex: number,
): SeasonMetrics {
  const standings = save.gameState.seasonState.standings;

  const teams = save.gameState.teams.map((team) => {
    const standing = standings[team.teamId] ?? null;
    return {
      teamId: team.teamId,
      name: team.name,
      isManual: team.teamId === manualTeamId,
      cash: team.cash,
      budget: team.budget,
      standingPoints: standing?.points ?? null,
      standingRank: standing?.rank ?? null,
      standingCashTotal: standing?.cashTotal ?? null,
    };
  });

  const progressionEvents = save.gameState.playerProgressionEvents ?? [];
  const humanRoster = save.gameState.rosters.filter((r) => r.teamId === manualTeamId);
  const humanPlayerIds = new Set(humanRoster.map((r) => r.playerId));
  const humanTeamPlayers = progressionEvents
    .filter((e) => e.seasonId === seasonId && humanPlayerIds.has(e.playerId))
    .map((e) => ({
      playerId: e.playerId,
      xpEarned: e.xpEarned ?? 0,
      xpSpent: e.xpSpent,
    }));

  const transferActivity = save.gameState.transferHistory
    .filter((t) => t.seasonId === seasonId)
    .map((t) => ({
      transferType: t.transferType,
      fromTeamId: t.fromTeamId,
      toTeamId: t.toTeamId,
      fee: t.fee,
      seasonId: t.seasonId,
    }));

  return { seasonIndex, seasonId, teams, humanTeamPlayers, transferActivity, matchdaysCompleted };
}

async function runOneSeason(
  saveId: string,
  manualTeamId: string,
  seasonId: string,
  seasonIndex: number,
  matchdaysTarget: number,
  persistence = createPersistenceService(),
): Promise<SeasonMetrics> {
  log(`Season ${seasonIndex + 1}: applying economy for ${seasonId}…`);
  const saveAtStart = requireValue(persistence.getSaveById(saveId), "Save missing at season start.");
  await applyEconomy(saveAtStart, manualTeamId, seasonId, persistence);

  let matchdaysCompleted = 0;
  for (let i = 0; i < matchdaysTarget; i += 1) {
    const current = requireValue(persistence.getSaveById(saveId), "Save missing in MD loop.");
    const matchdayId = current.gameState.matchdayState.matchdayId;

    prepLineup({ saveId, seasonId, matchdayId, teamId: manualTeamId });

    const autoRun = await runLocalMatchdayAutoRun(
      {
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
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    );

    if (!autoRun.ok) {
      log(`Season ${seasonIndex + 1} MD${i + 1} auto-run blocked: ${autoRun.blockingReasons.join(" | ")}`);
      break;
    }

    const advance = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );

    if (!advance.ok || !advance.applied) {
      log(`Season ${seasonIndex + 1} MD${i + 1} advance blocked: ${advance.blockingReasons.join(" | ")}`);
      break;
    }

    matchdaysCompleted += 1;
    log(`Season ${seasonIndex + 1}: MD${i + 1}/${matchdaysTarget} done (matchday ${matchdayId}).`);
  }

  log(`Season ${seasonIndex + 1}: running season completion…`);
  const beforeCompletion = requireValue(persistence.getSaveById(saveId), "Save missing before completion.");
  const completion = await runLocalSeasonCompletion(
    {
      saveId,
      seasonId,
      source: "sqlite",
      execute: true,
      dryRun: false,
      confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
    },
    persistence,
  );

  if (!completion.ok || !completion.applied) {
    log(`Season completion blocked: ${completion.blockingReasons.join(" | ")}`);
  }

  const afterCompletion = requireValue(persistence.getSaveById(saveId), "Save missing after completion.");
  const metrics = collectSeasonMetrics(afterCompletion, manualTeamId, seasonId, matchdaysCompleted, seasonIndex);

  const nextSeasonToken = buildPreSeasonNextSeasonSetupToken(afterCompletion).confirmToken;
  const nextSeason = applyPreSeasonNextSeasonSetupLightweight(afterCompletion, nextSeasonToken, persistence);
  if (!nextSeason.applied) {
    log(`Next season setup blocked: ${nextSeason.blockingReasons.join(" | ")}`);
  } else {
    log(`Season ${seasonIndex + 1}: pre-season setup for next season done.`);
  }

  return metrics;
}

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();

  log(`Starting ${args.seasons}-season multi-season smoke (${args.matchdaysPerSeason} matchdays/season)…`);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const { save, manualTeamId, seasonId: firstSeasonId } = setupFreshSoloSave(persistence);
  log(`Fresh save created: ${save.saveId}, manual team: ${manualTeamId}`);

  const allMetrics: SeasonMetrics[] = [];
  let currentSeasonId = firstSeasonId;

  for (let i = 0; i < args.seasons; i += 1) {
    log(`\n=== SEASON ${i + 1}/${args.seasons} (${currentSeasonId}) ===`);
    const metrics = await runOneSeason(save.saveId, manualTeamId, currentSeasonId, i, args.matchdaysPerSeason, persistence);
    allMetrics.push(metrics);

    const afterSave = requireValue(persistence.getSaveById(save.saveId), "Save missing after season.");
    currentSeasonId = afterSave.gameState.season.id;
    log(`Season ${i + 1} done. Next season: ${currentSeasonId}`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    saveId: save.saveId,
    manualTeamId,
    seasons: args.seasons,
    matchdaysPerSeason: args.matchdaysPerSeason,
    seasonMetrics: allMetrics,
    balanceTrend: allMetrics.map((m) => {
      const manualTeam = m.teams.find((t) => t.isManual);
      return {
        seasonIndex: m.seasonIndex,
        seasonId: m.seasonId,
        matchdaysCompleted: m.matchdaysCompleted,
        manualTeamCash: manualTeam?.cash ?? null,
        manualTeamBudget: manualTeam?.budget ?? null,
        manualTeamRank: manualTeam?.standingRank ?? null,
        manualTeamPoints: manualTeam?.standingPoints ?? null,
        totalXpEarned: m.humanTeamPlayers.reduce((sum, p) => sum + p.xpEarned, 0),
        totalXpSpent: m.humanTeamPlayers.reduce((sum, p) => sum + p.xpSpent, 0),
        transferBuys: m.transferActivity.filter((t) => t.transferType === "buy").length,
        transferSells: m.transferActivity.filter((t) => t.transferType === "sell").length,
      };
    }),
  };

  const timestamp = Date.now();
  const outPath = path.join(OUTPUT_DIR, `multi-season-${timestamp}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  log(`\nBalance audit written to ${outPath}`);

  console.log("\n=== MULTI-SEASON BALANCE SUMMARY ===");
  for (const row of summary.balanceTrend) {
    console.log(
      `S${row.seasonIndex + 1} (${row.seasonId}): ` +
        `MD=${row.matchdaysCompleted} · ` +
        `cash=${row.manualTeamCash} · ` +
        `budget=${row.manualTeamBudget} · ` +
        `rank=${row.manualTeamRank} · ` +
        `pts=${row.manualTeamPoints} · ` +
        `xp+${row.totalXpEarned}/-${row.totalXpSpent} · ` +
        `buys=${row.transferBuys} sells=${row.transferSells}`,
    );
  }
  console.log(`\nFull report: ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
