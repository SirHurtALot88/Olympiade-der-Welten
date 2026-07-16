/**
 * season-balance-audit.ts
 *
 * Runs a full Season 1 playthrough (--skip-ui, local auto-run) and exports
 * a comprehensive balancing report to outputs/balance-audit/.
 *
 * Usage:
 *   npx tsx scripts/season-balance-audit.ts
 *   npm run season:balance-audit
 */

import fs from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { applyFacilityUpgrade, previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
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
import { previewSeasonEndXpAvailability } from "@/lib/progression/season-end-xp-apply-service";
import {
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  runLocalMatchdayAutoRun,
} from "@/lib/season/matchday-auto-run-service";
import {
  ADVANCE_MATCHDAY_CONFIRM_TOKEN,
  executeMatchdayAdvance,
} from "@/lib/season/matchday-progress-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";
import {
  SEASON_COMPLETION_CONFIRM_TOKEN,
  runLocalSeasonCompletion,
} from "@/lib/season/season-completion-service";
import {
  chooseSponsorOffer,
  ensureSeasonSponsorOffers,
  getTeamSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";
import {
  applyTeamTrainingSettings,
  previewTeamTrainingSettings,
} from "@/lib/training/training-settings-service";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "balance-audit");
const MAX_MATCHDAYS = 10;

function log(message: string) {
  console.error(`[balance-audit] ${message}`);
}

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

// ============================================================
// Save setup helpers (adapted from full-season-ui-playthrough)
// ============================================================

function resolveMaxRequiredSeasonRosterSize(save: PersistedSaveGame, seasonId: string) {
  let maxRequired = 0;
  for (const matchdayId of save.gameState.season.matchdayIds) {
    const ctx = loadLocalLegacyLineupContext({
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!ctx.ok) continue;
    maxRequired = Math.max(
      maxRequired,
      (ctx.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (ctx.context.matchdayContract?.discipline2?.requiredPlayers ?? 0),
    );
  }
  return maxRequired;
}

function topUpRostersForLineups(save: PersistedSaveGame, seasonId: string) {
  const persistence = createPersistenceService();
  const required = resolveMaxRequiredSeasonRosterSize(save, seasonId);
  const usedIds = new Set(save.gameState.rosters.map((r) => r.playerId));
  const free = save.gameState.players.filter((p) => !usedIds.has(p.id));
  let poolIndex = 0;
  let counter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const teamRoster = save.gameState.rosters.filter((r) => r.teamId === team.teamId);
    const shortfall = Math.max(0, required - teamRoster.length);
    for (let i = 0; i < shortfall; i++) {
      const player = free[poolIndex];
      if (!player) throw new Error("Not enough free players to top up rosters.");
      const economy = resolvePlayerEconomyContract({ player });
      const salary = economy.salary ?? player.displaySalary ?? player.salaryDemand;
      const marketValue =
        economy.purchasePrice ?? economy.marketValue ?? player.displayMarketValue ?? player.marketValue;
      save.gameState.rosters.push({
        id: `balance-audit-roster-${counter}`,
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
      poolIndex++;
      counter++;
      changed = true;
    }
  }
  if (changed) persistence.saveSingleplayerState(save.saveId, save.gameState);
}

function resolveManualTeamId(save: PersistedSaveGame) {
  const settings = save.gameState.seasonState.teamControlSettings ?? {};
  const manual = Object.entries(settings).find(([, e]) => e.controlMode === "manual");
  return manual?.[0] ?? save.gameState.teams[0]?.teamId ?? null;
}

function setupFreshSoloSave(persistence = createPersistenceService()) {
  const created = persistence.createFreshSeasonOneSave({
    name: `Balance Audit ${new Date().toISOString()}`,
    activate: true,
  });
  const seasonId = created.gameState.season.id;
  topUpRostersForLineups(created, seasonId);
  const chrisTeamId = created.gameState.teams[0]?.teamId ?? "A-A";
  const nextState = applyGameModeOwnership(created.gameState, {
    saveMode: "solo_1",
    chrisTeamIds: [chrisTeamId],
    frankyTeamIds: [],
  });
  const saved = persistence.saveSingleplayerState(created.saveId, nextState);
  const manualTeamId = resolveManualTeamId(saved);
  if (!manualTeamId) throw new Error("No manual team after solo_1 setup.");
  return { save: saved, manualTeamId, seasonId };
}

function prepManualLineup(params: LegacyLineupKeyParams) {
  const ctx = loadLocalLegacyLineupContext(params);
  if (!ctx.ok) throw new Error(`Lineup context failed: ${ctx.errors.join(" | ")}`);
  const preview = buildAiLegacyLineupPreview(ctx.context, "sqlite");
  if (preview.status === "blocked" || preview.entries.length === 0) {
    throw new Error(`Lineup preview blocked: ${preview.warnings.join(" | ") || preview.status}`);
  }
  const modifiers = buildAiLegacyLineupModifiers(ctx.context, preview.entries);
  const result = saveLocalLegacyLineupDraft(params, preview.entries, modifiers);
  if (!result.ok) throw new Error(`Lineup save failed: ${result.errors.join(" | ")}`);
  return result;
}

function previewTrainingToken(save: PersistedSaveGame, teamId: string) {
  return previewTeamTrainingSettings({
    save,
    teamId,
    trainingFocus: "BALANCED",
    trainingIntensity: "normal",
  }).confirmToken;
}

async function applyEconomyBeforeMd1(save: PersistedSaveGame, manualTeamId: string, seasonId: string): Promise<void> {
  const persistence = createPersistenceService();

  // Phase 1: AI sell pass — all 32 teams sell based on strategy/identity
  log("  Transfers: AI sell pass (all teams)…");
  const sellResult = await applyAiMarketPlanLocally({
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
  log(`  Transfers: sell pass done. Teams processed: ${sellResult.results.length}`);

  // Phase 2: AI buy pass — all 32 teams buy based on strategy/identity
  log("  Transfers: AI buy pass (all teams)…");
  const buyResult = await applyAiMarketPlanLocally({
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
  log(`  Transfers: buy pass done. Teams processed: ${buyResult.results.length}`);

  // Count total transfers executed
  const totalSells = sellResult.summary.appliedSells;
  const totalBuys = buyResult.summary.appliedBuys;
  log(`  Transfers complete: ${totalSells} sells + ${totalBuys} buys across all teams.`);

  // Manual team: sponsor, facility upgrade, training (AI teams don't have these auto-applied)
  let current = requireValue(persistence.getSaveById(save.saveId), "Save missing after transfers.");

  const withOffers = ensureSeasonSponsorOffers(current.gameState);
  persistence.saveSingleplayerState(current.saveId, withOffers);
  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after sponsor ensure.");
  const offers = getTeamSponsorOffers(current.gameState, manualTeamId);
  const sponsorOffer = offers[0];
  if (!sponsorOffer) throw new Error("No sponsor offers.");
  const sponsorResult = chooseSponsorOffer({
    gameState: current.gameState,
    teamId: manualTeamId,
    offerId: sponsorOffer.offerId,
    saveId: current.saveId,
  });
  if (!sponsorResult.contract) throw new Error(`Sponsor choose failed: ${sponsorResult.error ?? "unknown"}`);
  persistence.saveSingleplayerState(current.saveId, sponsorResult.gameState);
  log(`  Economy: sponsor ${sponsorOffer.offerId} chosen.`);

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after sponsor.");
  const facilityPreview = previewFacilityUpgrade(current, manualTeamId, "training_center");
  if (!facilityPreview.ok || !facilityPreview.confirmToken) {
    log(`  Economy: facility preview blocked (${facilityPreview.blockingReasons.join(" | ")}) — skipping.`);
  } else {
    const facilityResult = applyFacilityUpgrade(
      current,
      manualTeamId,
      "training_center",
      facilityPreview.confirmToken,
      undefined,
      persistence,
    );
    if (!facilityResult.applied) {
      log(`  Economy: facility upgrade blocked (${facilityResult.blockingReasons.join(" | ")}) — skipping.`);
    } else {
      log("  Economy: facility training_center upgraded.");
    }
  }

  current = requireValue(persistence.getSaveById(current.saveId), "Save missing after facility.");
  const trainingToken = previewTeamTrainingSettings({
    save: current,
    teamId: manualTeamId,
    trainingFocus: "BALANCED",
    trainingIntensity: "normal",
  }).confirmToken;
  const trainingResult = applyTeamTrainingSettings(
    current,
    manualTeamId,
    "BALANCED",
    "normal",
    trainingToken,
    "balance_audit_pre_md1",
    persistence,
  );
  if (!trainingResult.applied) {
    log(`  Economy: training blocked (${trainingResult.blockingReasons.join(" | ")}) — skipping.`);
  } else {
    log("  Economy: training BALANCED/normal applied.");
  }
}

// ============================================================
// Balance data helpers
// ============================================================

function buildSalaryTotalByTeamId(save: PersistedSaveGame) {
  const playerById = new Map(save.gameState.players.map((p) => [p.id, p]));
  return new Map(
    save.gameState.teams.map((team) => {
      const roster = save.gameState.rosters.filter((r) => r.teamId === team.teamId);
      const total = roster.reduce((sum, rEntry) => {
        const player = playerById.get(rEntry.playerId) ?? null;
        return sum + (resolvePlayerEconomyContract({ player, rosterEntry: rEntry }).salary ?? 0);
      }, 0);
      return [team.teamId, Math.round(total)] as const;
    }),
  );
}

function buildSponsorCashByTeamId(save: PersistedSaveGame, seasonId: string) {
  const result = new Map<string, number>();
  for (const log of save.gameState.seasonState.sponsorPayoutLogs ?? []) {
    if (log.seasonId === seasonId && log.cashDelta > 0) {
      result.set(log.teamId, (result.get(log.teamId) ?? 0) + log.cashDelta);
    }
  }
  return result;
}

function buildWinsLossesByTeamId(save: PersistedSaveGame) {
  const wins = new Map<string, number>();
  const appearances = new Map<string, number>();
  for (const dr of save.gameState.seasonState.disciplineResults ?? []) {
    const prev = appearances.get(dr.teamId) ?? 0;
    appearances.set(dr.teamId, prev + 1);
    if (dr.rank === 1) {
      wins.set(dr.teamId, (wins.get(dr.teamId) ?? 0) + 1);
    }
  }
  return { wins, appearances };
}

function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * (sorted[i] ?? 0);
  }
  return Math.round((numerator / (n * total)) * 1000) / 1000;
}

function pad(str: string, len: number) {
  return str.slice(0, len).padEnd(len);
}

function fmt(n: number) {
  return n.toLocaleString("de-DE");
}

// ============================================================
// Main
// ============================================================

async function main() {
  loadEnvConfig(path.resolve(process.cwd()));
  const startedAt = Date.now();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const persistence = createPersistenceService();

  // ── Step 1: Fresh save + solo_1 setup ──
  log("Step 1: Creating fresh Season 1 save (solo_1)…");
  const { save, manualTeamId, seasonId } = setupFreshSoloSave(persistence);
  log(`  saveId=${save.saveId}  manualTeam=${manualTeamId}  season=${seasonId}`);

  // Snapshot player attributes + XP BEFORE any matchdays
  const initialSave = requireValue(persistence.getSaveById(save.saveId), "Save missing after setup.");
  const xpBeforeByPlayerId = new Map(
    initialSave.gameState.players.map((p) => [p.id, p.currentXP ?? 0] as const),
  );
  const attributesBeforeByPlayerId = new Map(
    initialSave.gameState.players.map(
      (p) => [p.id, { ...(p.attributeSheetStats ?? {}) }] as const,
    ),
  );

  // ── Step 2: Economy setup before MD1 ──
  log("Step 2: Applying economy features before MD1…");
  await applyEconomyBeforeMd1(save, manualTeamId, seasonId);

  // Snapshot cash AFTER economy setup (this is the "before MD1" cash baseline)
  const afterEconomySave = requireValue(persistence.getSaveById(save.saveId), "Save missing after economy.");
  const cashBeforeByTeamId = new Map(
    afterEconomySave.gameState.teams.map((t) => [t.teamId, t.cash ?? 0] as const),
  );
  log(`  cash snapshot (${afterEconomySave.gameState.teams.length} teams)`);

  // ── Step 3: Run all 10 matchdays (local auto-run) ──
  log(`Step 3: Running ${MAX_MATCHDAYS} matchdays…`);
  const matchdayTimings: Array<{ matchdayId: string; durationMs: number }> = [];
  let matchdaysPlayed = 0;

  for (let idx = 0; idx < MAX_MATCHDAYS; idx++) {
    const current = requireValue(persistence.getSaveById(save.saveId), "Save missing in MD loop.");
    const matchdayId = current.gameState.matchdayState.matchdayId;
    const mdStart = Date.now();

    // Apply training for manual team each matchday
    const trainingApply = applyTeamTrainingSettings(
      current,
      manualTeamId,
      "BALANCED",
      "normal",
      previewTrainingToken(current, manualTeamId),
      `balance_audit_md_${idx + 1}`,
      persistence,
    );
    if (!trainingApply.applied) {
      log(`  MD${idx + 1}: training blocked: ${trainingApply.blockingReasons.join(" | ")}`);
      break;
    }

    // Prep AI-assisted lineup for manual team
    prepManualLineup({ saveId: save.saveId, seasonId, matchdayId, teamId: manualTeamId });

    // Local auto-run
    const autoRun = await runLocalMatchdayAutoRun(
      {
        saveId: save.saveId,
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
      log(`  MD${idx + 1}: auto-run blocked: ${autoRun.blockingReasons.join(" | ")}`);
      break;
    }

    // Advance to next matchday
    const advance = await executeMatchdayAdvance(
      {
        saveId: save.saveId,
        seasonId,
        source: "sqlite",
        execute: true,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      persistence,
    );
    if (!advance.ok || !advance.applied) {
      log(`  MD${idx + 1}: advance blocked: ${advance.blockingReasons.join(" | ")}`);
      break;
    }

    const durationMs = Date.now() - mdStart;
    matchdayTimings.push({ matchdayId, durationMs });
    matchdaysPlayed++;
    log(`  MD${idx + 1}/10 (${matchdayId}) done in ${durationMs}ms`);
  }

  // ── Step 4: Collect pre-completion data ──
  log("Step 4: Collecting pre-completion balance data…");
  const preSave = requireValue(persistence.getSaveById(save.saveId), "Save missing before completion.");

  const cashAfterByTeamId = new Map(
    preSave.gameState.teams.map((t) => [t.teamId, t.cash ?? 0] as const),
  );

  // Performance map from matchday results
  const perfMap = buildPlayerSeasonPerformanceMap(preSave.gameState);

  // XP preview per team (before season-end spend)
  const xpPreviewByPlayerId = new Map<string, { earnedSeasonXP: number; currentXPBefore: number; availableXP: number }>();
  for (const team of preSave.gameState.teams) {
    const preview = previewSeasonEndXpAvailability(preSave, team.teamId);
    for (const pp of preview.players) {
      xpPreviewByPlayerId.set(pp.playerId, {
        earnedSeasonXP: pp.earnedSeasonXP,
        currentXPBefore: pp.currentXPBefore,
        availableXP: pp.availableXP,
      });
    }
  }
  log(`  XP preview: ${xpPreviewByPlayerId.size} players`);

  // Prize money preview (standings are final after all matchdays)
  log("  Building prize money preview…");
  const prizePreview = await buildPrizeMoneyPreview(
    { saveId: save.saveId, seasonId, source: "sqlite" },
    persistence,
  );
  const prizeByTeamId = new Map(prizePreview.items.map((item) => [item.teamId, item.prizeMoney] as const));
  log(`  Prize money: ${prizePreview.items.length} teams, total=${fmt(prizePreview.summary.totalPrizeMoney)}`);

  // ── Step 5: Season completion ──
  log("Step 5: Running season completion…");
  const completion = await runLocalSeasonCompletion(
    {
      saveId: save.saveId,
      seasonId,
      source: "sqlite",
      execute: true,
      dryRun: false,
      confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
    },
    persistence,
  );
  if (!completion.ok || !completion.applied) {
    throw new Error(`Season completion blocked: ${completion.blockingReasons.join(" | ")}`);
  }
  log("  Season completion applied.");

  // Snapshot cash after season completion
  const postSave = requireValue(persistence.getSaveById(save.saveId), "Save missing after completion.");
  const cashFinalByTeamId = new Map(
    postSave.gameState.teams.map((t) => [t.teamId, t.cash ?? 0] as const),
  );

  // Sponsor cash from payout logs (all payouts applied after completion)
  const sponsorCashByTeamId = buildSponsorCashByTeamId(postSave, seasonId);

  // Progression events from season-end XP apply
  const progressionEventsByPlayerId = new Map<
    string,
    NonNullable<typeof postSave.gameState.playerProgressionEvents>[number]
  >();
  for (const event of postSave.gameState.playerProgressionEvents ?? []) {
    if (event.seasonId === seasonId) {
      const existing = progressionEventsByPlayerId.get(event.playerId);
      if (!existing || event.timestamp > existing.timestamp) {
        progressionEventsByPlayerId.set(event.playerId, event);
      }
    }
  }
  log(`  Progression events: ${progressionEventsByPlayerId.size}`);

  // ── Step 6: Preseason S2 setup ──
  log("Step 6: Setting up Season 2…");
  const reviewSave = requireValue(persistence.getSaveById(save.saveId), "Save missing for S2.");
  const nextToken = buildPreSeasonNextSeasonSetupToken(reviewSave).confirmToken;
  const s2Result = applyPreSeasonNextSeasonSetupLightweight(reviewSave, nextToken, persistence);
  if (!s2Result.applied) {
    log(`  S2 setup blocked: ${s2Result.blockingReasons.join(" | ")}`);
  } else {
    log("  Season 2 setup complete.");
  }

  // ── Step 7: Build the report ──
  log("Step 7: Building report…");

  const salaryByTeamId = buildSalaryTotalByTeamId(preSave);
  const { wins: disciplineWinsByTeamId, appearances: disciplineAppearancesByTeamId } =
    buildWinsLossesByTeamId(preSave);

  // Per-team financial snapshot
  const teamFinancials = preSave.gameState.teams.map((team) => {
    const facilityState = getTeamFacilityState(preSave.gameState, team.teamId);
    const facilityUpkeepTotal = Math.round(calculateFacilityUpkeep(facilityState));
    const totalApps = disciplineAppearancesByTeamId.get(team.teamId) ?? 0;
    const teamWins = disciplineWinsByTeamId.get(team.teamId) ?? 0;

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      cashBefore: cashBeforeByTeamId.get(team.teamId) ?? 0,
      cashAfter: cashAfterByTeamId.get(team.teamId) ?? 0,
      cashFinal: cashFinalByTeamId.get(team.teamId) ?? 0,
      salaryTotal: salaryByTeamId.get(team.teamId) ?? 0,
      facilityUpkeepTotal,
      prizeMoney: prizeByTeamId.get(team.teamId) ?? null,
      sponsorCash: sponsorCashByTeamId.get(team.teamId) ?? 0,
      disciplineWins: teamWins,
      disciplineAppearances: totalApps,
    };
  });

  // Per-player XP snapshot
  const rosterByPlayerId = new Map(
    preSave.gameState.rosters.map((r) => [r.playerId, r] as const),
  );
  const teamCodeByTeamId = new Map(
    preSave.gameState.teams.map((t) => [t.teamId, t.shortCode] as const),
  );
  const rosterTeamByPlayerId = new Map(
    preSave.gameState.rosters.map((r) => [r.playerId, r.teamId] as const),
  );

  const playerXpSnapshots = preSave.gameState.players
    .filter((p) => rosterByPlayerId.has(p.id))
    .map((player) => {
      const teamId = rosterTeamByPlayerId.get(player.id) ?? "";
      const teamCode = teamCodeByTeamId.get(teamId) ?? teamId;
      const xpPrev = xpPreviewByPlayerId.get(player.id);
      const event = progressionEventsByPlayerId.get(player.id);
      const perf = perfMap.get(player.id);

      const attributesBefore = attributesBeforeByPlayerId.get(player.id) ?? {};
      const attributesAfter =
        (event?.progressionSnapshotAfter?.attributes as Record<string, number> | undefined) ??
        (player.attributeSheetStats as Record<string, number> | undefined) ??
        {};

      return {
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamCode,
        xpBefore: xpBeforeByPlayerId.get(player.id) ?? 0,
        xpEarned: xpPrev?.earnedSeasonXP ?? 0,
        xpSpent: event?.xpSpent ?? 0,
        attributesBefore,
        attributesAfter,
        appearances: perf?.appearances ?? 0,
        finalScore: perf?.averageFinalScore ?? null,
      };
    });

  // Season standings (final, top 8)
  const standingsRaw = Object.entries(preSave.gameState.seasonState.standings ?? {});
  const seasonStandings = standingsRaw
    .map(([teamId, standing]) => ({
      teamId,
      teamCode: teamCodeByTeamId.get(teamId) ?? teamId,
      rank: standing.rank ?? null,
      points: standing.points ?? 0,
      disciplineWins: disciplineWinsByTeamId.get(teamId) ?? 0,
      disciplineAppearances: disciplineAppearancesByTeamId.get(teamId) ?? 0,
    }))
    .filter((s) => s.rank != null)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .slice(0, 8);

  // Matchday timing summary
  const avgMatchdayMs =
    matchdayTimings.length > 0
      ? Math.round(matchdayTimings.reduce((s, t) => s + t.durationMs, 0) / matchdayTimings.length)
      : 0;
  const slowestMatchday =
    matchdayTimings.reduce<{ matchdayId: string; durationMs: number } | null>(
      (max, t) => (!max || t.durationMs > max.durationMs ? t : max),
      null,
    );

  // Economy balance metrics
  const cashFinalValues = teamFinancials.map((t) => t.cashFinal);
  const avgTeamCash =
    cashFinalValues.length > 0
      ? Math.round(cashFinalValues.reduce((s, v) => s + v, 0) / cashFinalValues.length)
      : 0;
  const minTeamCash = cashFinalValues.length > 0 ? Math.min(...cashFinalValues) : 0;
  const maxTeamCash = cashFinalValues.length > 0 ? Math.max(...cashFinalValues) : 0;
  const cashGini = computeGini(cashFinalValues);
  const salaryRatios = teamFinancials
    .filter((t) => t.cashFinal > 0)
    .map((t) => t.salaryTotal / t.cashFinal);
  const avgSalaryBudgetUsed =
    salaryRatios.length > 0
      ? Math.round((salaryRatios.reduce((s, v) => s + v, 0) / salaryRatios.length) * 1000) / 1000
      : null;

  // XP balance metrics
  const xpEarnedArr = playerXpSnapshots.map((p) => p.xpEarned);
  const xpSpentArr = playerXpSnapshots.map((p) => p.xpSpent);
  const totalXpEarned = xpEarnedArr.reduce((s, v) => s + v, 0);
  const totalXpSpent = xpSpentArr.reduce((s, v) => s + v, 0);
  const avgXpEarned =
    xpEarnedArr.length > 0 ? Math.round(totalXpEarned / xpEarnedArr.length) : 0;
  const avgXpSpent =
    xpSpentArr.length > 0 ? Math.round(totalXpSpent / xpSpentArr.length) : 0;
  const xpRetentionRate =
    totalXpEarned > 0
      ? Math.round((totalXpSpent / totalXpEarned) * 1000) / 10
      : 0;

  const totalElapsedMs = Date.now() - startedAt;

  const report = {
    metadata: {
      saveId: save.saveId,
      seasonId,
      timestamp: new Date().toISOString(),
      totalElapsedMs,
      matchdaysPlayed,
      teamsCount: preSave.gameState.teams.length,
      playersTotal: playerXpSnapshots.length,
    },
    teamFinancials,
    playerXpSnapshots,
    seasonStandings,
    matchdayTiming: {
      avgMatchdayMs,
      slowestMatchday,
      timings: matchdayTimings,
    },
    economyBalance: {
      avgTeamCash,
      minTeamCash,
      maxTeamCash,
      cashGini,
      avgSalaryBudgetUsed,
    },
    xpBalance: {
      avgXpEarned,
      avgXpSpent,
      xpRetentionRate,
      totalXpEarned,
      totalXpSpent,
      playersWithProgressionEvents: progressionEventsByPlayerId.size,
    },
    prizeMoneyMeta: {
      totalPrizeMoney: prizePreview.summary.totalPrizeMoney,
      currentFactor: prizePreview.summary.currentFactor,
      blockedItems: prizePreview.summary.blockedItemsCount,
      warnings: prizePreview.globalWarnings,
    },
    transferActivity: (() => {
      const postSaveFinal = requireValue(persistence.getSaveById(save.saveId), "Save missing for transfer report.");
      const transfers = (postSaveFinal.gameState.transferHistory ?? [])
        .filter((t) => t.seasonId === seasonId)
        .map((t) => ({ transferType: t.transferType, fromTeamId: t.fromTeamId, toTeamId: t.toTeamId, fee: t.fee }));
      return {
        totalTransfers: transfers.length,
        totalBuys: transfers.filter((t) => t.transferType === "buy").length,
        totalSells: transfers.filter((t) => t.transferType === "sell").length,
        activity: transfers,
      };
    })(),
  };

  // ── Step 8: Write JSON report ──
  const timestamp = Date.now();
  const outputPath = path.join(OUTPUT_DIR, `season-${seasonId}-${timestamp}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  log(`Report written: ${outputPath}`);

  // ── Console summary ──
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              SEASON BALANCE AUDIT SUMMARY               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Save    : ${save.saveId}`);
  console.log(`  Season  : ${seasonId}`);
  console.log(`  Time    : ${new Date().toISOString()}`);
  console.log(`  Elapsed : ${(totalElapsedMs / 1000).toFixed(1)}s`);
  console.log(`  Matchdays: ${matchdaysPlayed}/${MAX_MATCHDAYS} played`);
  console.log("");

  console.log("── MATCHDAY TIMING ─────────────────────────────────────────");
  console.log(`  Avg per matchday : ${avgMatchdayMs} ms`);
  if (slowestMatchday) {
    console.log(`  Slowest          : ${slowestMatchday.matchdayId} (${slowestMatchday.durationMs} ms)`);
  }
  console.log("");

  console.log("── ECONOMY BALANCE ─────────────────────────────────────────");
  console.log(`  Avg team cash (final) : ${fmt(avgTeamCash)}`);
  console.log(`  Min team cash         : ${fmt(minTeamCash)}`);
  console.log(`  Max team cash         : ${fmt(maxTeamCash)}`);
  console.log(`  Cash Gini coefficient : ${cashGini}  (0=equal, 1=unequal)`);
  console.log(`  Avg salary/cash ratio : ${avgSalaryBudgetUsed ?? "N/A"}`);
  console.log(`  Total prize money     : ${fmt(prizePreview.summary.totalPrizeMoney)}`);
  console.log("");

  console.log("── XP BALANCE ──────────────────────────────────────────────");
  console.log(`  Players tracked        : ${playerXpSnapshots.length}`);
  console.log(`  Avg XP earned/player   : ${avgXpEarned}`);
  console.log(`  Avg XP spent/player    : ${avgXpSpent}`);
  console.log(`  XP retention rate      : ${xpRetentionRate}%`);
  console.log(`  Total XP earned        : ${fmt(totalXpEarned)}`);
  console.log(`  Total XP spent         : ${fmt(totalXpSpent)}`);
  console.log(`  Players w/ events      : ${progressionEventsByPlayerId.size}`);
  console.log("");

  console.log("── SEASON STANDINGS (Top 8) ────────────────────────────────");
  console.log(`  ${"Rk".padEnd(4)} ${"Code".padEnd(7)} ${"Pts".padEnd(6)} ${"D-Wins".padEnd(8)} ${"D-Apps"}`);
  for (const s of seasonStandings) {
    console.log(
      `  ${String(s.rank ?? "?").padEnd(4)} ${pad(s.teamCode, 7)} ${String(s.points).padEnd(6)} ${String(s.disciplineWins).padEnd(8)} ${s.disciplineAppearances}`,
    );
  }
  console.log("");

  console.log("── TRANSFER ACTIVITY ───────────────────────────────────────");
  console.log(`  Total transfers : ${report.transferActivity.totalTransfers}`);
  console.log(`  Buys            : ${report.transferActivity.totalBuys}`);
  console.log(`  Sells           : ${report.transferActivity.totalSells}`);
  console.log("");

  console.log("── TEAM FINANCIALS (top 8 by final cash) ───────────────────");
  const sortedTeams = [...teamFinancials].sort((a, b) => b.cashFinal - a.cashFinal).slice(0, 8);
  console.log(
    `  ${"Code".padEnd(7)} ${"Before".padStart(10)} ${"After".padStart(10)} ${"Final".padStart(10)} ${"Prize".padStart(10)} ${"Sponsor".padStart(9)}`,
  );
  for (const t of sortedTeams) {
    console.log(
      `  ${pad(t.teamCode, 7)} ${fmt(t.cashBefore).padStart(10)} ${fmt(t.cashAfter).padStart(10)} ${fmt(t.cashFinal).padStart(10)} ${(t.prizeMoney != null ? fmt(t.prizeMoney) : "N/A").padStart(10)} ${fmt(t.sponsorCash).padStart(9)}`,
    );
  }
  console.log("");

  console.log(`  Output JSON: ${outputPath}`);
  console.log("");

  return outputPath;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
