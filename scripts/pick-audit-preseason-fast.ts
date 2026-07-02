import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";
import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";
import { runMarketPlanConvergence } from "@/lib/ai/ai-market-plan-convergence-service";
import {
  getSeasonHoardCashSalaryCap,
  getPreseasonTransferSpend,
  isCashHoardingTeam,
  syncPreseasonTransferBudgets,
} from "@/lib/ai/ai-budget-deploy-service";
import { getTeamCashSalarySoftTarget, isTeamOverCashSalarySoftTarget } from "@/lib/ai/ai-cash-salary-target-service";
import {
  buildLeagueMarketAnchors,
  classifyMarketTier,
  getMarketLaneBand,
  resolvePlannerSpendableCash,
} from "@/lib/ai/ai-market-slot-plan-service";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";
import { applyPickAuditScenarioSetup } from "@/lib/debug/pick-audit-scenario-setup";
import {
  buildTeamThemeCompositionRuntimeContext,
  calculateThemeCompositionScore,
  derivePlayerThemeTags,
  getTeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[pick-audit-preseason-fast] ${message}`);
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function getTeamSalaryTotal(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
}

function topPickPricesForTeam(buyTransfers: TransferHistoryEntry[], teamId: string, limit = 2) {
  return buyTransfers
    .filter((entry) => entry.toTeamId === teamId)
    .map((entry) => entry.fee ?? entry.marketValue ?? 0)
    .filter((value) => value > 0)
    .sort((left, right) => right - left)
    .slice(0, limit);
}

function spotTopPickSummary(buyTransfers: TransferHistoryEntry[], teamRows: Array<Record<string, unknown>>, code: string) {
  const row = teamRows.find((entry) => String(entry.teamCode).toUpperCase() === code);
  if (!row) return `${code}: n/a`;
  const tops = topPickPricesForTeam(buyTransfers, String(row.teamId), 2);
  if (tops.length === 0) return `${code}: no buys`;
  return `${code}: ${tops.map((value) => value.toFixed(2)).join(" / ")} MW`;
}

function laneMixFromTransfers(transfers: TransferHistoryEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of transfers) {
    counts.set(entry.source ?? "unknown", (counts.get(entry.source ?? "unknown") ?? 0) + 1);
  }
  return [...counts.entries()].map(([lane, count]) => `${lane}:${count}`).join("|");
}

function rosterMarketValues(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player) return 0;
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      return economy.marketValue ?? player.displayMarketValue ?? player.marketValue ?? 0;
    })
    .filter((value) => value > 0)
    .sort((left, right) => right - left);
}

function rosterMwTop5Avg(gameState: GameState, teamId: string) {
  const values = rosterMarketValues(gameState, teamId).slice(0, 5);
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function countRosterPlayersGte(gameState: GameState, teamId: string, floor: number) {
  return rosterMarketValues(gameState, teamId).filter((value) => value + 0.01 >= floor).length;
}

function scorePickIdentity(gameState: GameState, teamId: string, playerId: string, price: number | null) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const player = gameState.players.find((entry) => entry.id === playerId);
  if (!team || !player) {
    return { themeScore: null, themeTier: "", race: "", className: "", primaryMatch: false, themeTags: "" };
  }
  const ctx = buildTeamThemeCompositionRuntimeContext(gameState, team);
  const theme = calculateThemeCompositionScore({
    gameState,
    team,
    player,
    candidateQuality: price ?? player.marketValue ?? 0,
    runtimeContext: ctx,
  });
  const tags = derivePlayerThemeTags(player);
  const target = getTeamThemeCompositionTarget(team);
  const primaryMatch = target
    ? tags.playerThemeTags.some((tag) => target.primaryThemeTags.some((primary) => primary.toLowerCase() === tag.toLowerCase()))
    : false;
  return {
    themeScore: round(theme.themeCompositionScore, 2),
    themeTier: theme.themeTier,
    race: player.race ?? "",
    className: player.className ?? "",
    primaryMatch,
    themeTags: tags.playerThemeTags.slice(0, 6).join("|"),
  };
}

function teamStandingRank(gameState: GameState, teamId: string) {
  const standings = gameState.seasonState.standings?.[gameState.season.id] ?? [];
  const row = standings.find((entry) => entry.teamId === teamId);
  if (!row || row.rank == null) return null;
  return Number(row.rank);
}

async function main() {
  const auditStarted = performance.now();
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const cloneFrom = process.env.OLY_PICK_AUDIT_CLONE_FROM ?? "fresh-season-1-1782726659026";
  const outputDir =
    process.env.OLY_PICK_AUDIT_OUTPUT_DIR ??
    path.join(PROJECT_ROOT, "outputs", `pick-audit-preseason-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
  const buyPasses = Number(process.env.OLY_PICK_AUDIT_PASSES ?? "3");
  const buyRounds = Number(process.env.OLY_PICK_AUDIT_ROUNDS ?? "5");
  const runLabel = process.env.OLY_PICK_AUDIT_RUN_LABEL ?? "manual";
  const salaryFactor = Number(process.env.OLY_PICK_AUDIT_SALARY_FACTOR ?? "1");

  await mkdir(outputDir, { recursive: true });
  log(`Output → ${outputDir}`);
  log(`Run label: ${runLabel} | passes=${buyPasses} rounds=${buyRounds} salaryFactor=${salaryFactor}`);

  const clone = persistence.cloneSave(cloneFrom, `Pick Audit Preseason ${Date.now()}`);
  let save = persistence.getSaveById(clone.saveId);
  if (!save) throw new Error(`Clone failed from ${cloneFrom}`);

  if ((save.gameState.gamePhase ?? "") === "season_completed") {
    const setup = buildPreSeasonNextSeasonSetupToken(save);
    const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
    if (!next.applied) {
      throw new Error(`S2 setup blocked: ${next.blockingReasons.join(" | ")}`);
    }
    save = persistence.getSaveById(clone.saveId);
    if (!save) throw new Error("Save missing after preseason setup");
    log(`Preseason setup → ${save.gameState.season.id}`);
  }

  const scenario = applyPickAuditScenarioSetup(save.gameState, { salaryFactor });
  save = persistence.saveSingleplayerState(save.saveId, syncPreseasonTransferBudgets(scenario.gameState, save.gameState.season.id));
  log(`Scenario: medianCash=${scenario.medianCash} inject=${scenario.cashInjectedTeams} rankShuffle=${scenario.standingsPermutedTeams}`);
  if (scenario.gmOverrides.length > 0) {
    for (const override of scenario.gmOverrides) {
      log(
        `GM override ${override.teamCode}: ${override.fromArchetype ?? override.fromGmId ?? "none"} → ${override.toArchetype} (${override.toGmId})`,
      );
    }
  }

  const seasonId = save.gameState.season.id;
  const transferHistoryIdsBefore = new Set(save.gameState.transferHistory.map((entry) => entry.id));

  const previewStarted = performance.now();
  const preview = await buildAiTransfermarktPreview({
    source: "sqlite",
    saveId: save.saveId,
    seasonId,
    teamScope: "all",
    transferPhase: "manual_transfer_window",
  });
  const previewMs = round(performance.now() - previewStarted, 1);
  const faPrices = preview.teams.flatMap((team) =>
    (team.legalCandidatePool ?? team.recommendedBuys ?? []).map((entry) => entry.price ?? entry.marketValue ?? null),
  );
  const leagueAnchors = buildLeagueMarketAnchors(faPrices);
  const spotTeamCodes = ["C-S", "G-G", "M-M", "H-R"];
  const normalizeTeamCode = (code: string) => String(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const spotCodeSet = new Set(spotTeamCodes.map(normalizeTeamCode));
  const spotPreviewTeams = preview.teams.filter((team) =>
    spotCodeSet.has(normalizeTeamCode(team.shortCode ?? team.teamId)),
  );

  const compareStarted = performance.now();
  const slotRows: Array<Record<string, unknown>> = [];
  for (const previewTeam of spotPreviewTeams) {
    const compare = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: save.saveId,
      seasonId,
      teamId: previewTeam.teamId,
      teamScope: "all",
      steps: 8,
      runMode: "default",
    });
    const entry = compare.teams.find((team) => team.teamId === previewTeam.teamId);
    if (!entry?.planner?.slotPlan) continue;
    entry.planner.slotPlan.forEach((lane, index) => {
      const band = getMarketLaneBand(lane, leagueAnchors);
      slotRows.push({
        teamId: previewTeam.teamId,
        teamCode: previewTeam.shortCode,
        slotIndex: index + 1,
        lane,
        floorMW: band.floorMW,
        ceilingMW: band.ceilingMW,
        spendableBefore: resolvePlannerSpendableCash(save!.gameState, previewTeam.teamId, previewTeam.cash),
        affordable: resolvePlannerSpendableCash(save!.gameState, previewTeam.teamId, previewTeam.cash) >= band.floorMW,
      });
    });
  }
  const compareLoopMs = round(performance.now() - compareStarted, 1);

  const teamBefore = new Map(
    save.gameState.teams.map((team) => {
      const identity = save!.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
      const rosterCount = save!.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      return [
        team.teamId,
        {
          team,
          rosterCount,
          playerMin,
          playerOpt,
          cash: team.cash,
          salary: getTeamSalaryTotal(save!.gameState, team.teamId),
          reserve: resolveTeamCashRunwayReserve(save!.gameState, team.teamId),
          spendable: resolvePlannerSpendableCash(save!.gameState, team.teamId, team.cash),
        },
      ] as const;
    }),
  );

  log(`Convergence: ${buyPasses} passes × ${buyRounds} rounds (buys only, no repair)`);
  if (process.env.OLY_PICK_AUDIT_PROFILE === "1") {
    process.env.OLY_TW_PROFILE = "1";
  }
  const convergenceStarted = performance.now();
  const convergence = await runMarketPlanConvergence({
    saveId: save.saveId,
    seasonId,
    persistence,
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxPasses: buyPasses,
    maxRoundsPerPass: buyRounds,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  const convergenceMs = round(performance.now() - convergenceStarted, 1);
  const totalMs = round(performance.now() - auditStarted, 1);
  const timingMs = { total: totalMs, preview: previewMs, compareLoop: compareLoopMs, convergence: convergenceMs };

  save = persistence.getSaveById(save.saveId);
  if (!save) throw new Error("Save missing after convergence");

  const newTransfers = save.gameState.transferHistory.filter(
    (entry) => !transferHistoryIdsBefore.has(entry.id) && entry.seasonId === seasonId,
  );
  const buyTransfers = newTransfers.filter((entry) => entry.transferType === "buy");
  const sellTransfers = newTransfers.filter((entry) => entry.transferType === "sell");
  const repairBuys = buyTransfers.filter((entry) => String(entry.source ?? "").includes("repair"));
  const buySourceMix = Object.fromEntries(
    [...buyTransfers.reduce((map, entry) => {
      const source = entry.source ?? "unknown";
      map.set(source, (map.get(source) ?? 0) + 1);
      return map;
    }, new Map<string, number>())],
  );
  const marketEngineBuys = buyTransfers.filter((entry) => entry.source === "ai_preseason_market_buy").length;

  const pickRows: Array<Record<string, unknown>> = [];
  const rejectedRows: Array<Record<string, unknown>> = [];
  for (const transfer of buyTransfers) {
    const teamId = transfer.toTeamId ?? "";
    const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
    const price = transfer.fee ?? transfer.marketValue ?? null;
    const tier = classifyMarketTier(price, leagueAnchors);
    const starBand = getMarketLaneBand("star", leagueAnchors);
    const tierMatch = price != null && price >= starBand.floorMW ? "star_ok" : price != null && price >= leagueAnchors.q65Price ? "core_ok" : "below_core";
    const identity = scorePickIdentity(save.gameState, teamId, transfer.playerId ?? "", price);
    pickRows.push({
      teamId,
      teamCode: team?.shortCode ?? "",
      playerId: transfer.playerId,
      playerName: transfer.playerName ?? "",
      lane: transfer.source ?? "",
      price,
      marketTier: tier,
      tierMatch,
      source: transfer.source ?? "",
      race: identity.race,
      className: identity.className,
      themeScore: identity.themeScore,
      themeTier: identity.themeTier,
      primaryThemeMatch: identity.primaryMatch,
      themeTags: identity.themeTags,
    });
    if (String(transfer.source ?? "").includes("star") && price != null && price + 0.01 < leagueAnchors.q85Price) {
      rejectedRows.push({
        teamId,
        teamCode: team?.shortCode ?? "",
        playerId: transfer.playerId,
        reason: "below_floor_star_lane",
        price,
        q85: leagueAnchors.q85Price,
      });
    }
  }

  const teamRows: Array<Record<string, unknown>> = [];
  const spotTeams = ["C-S", "G-G", "M-M", "H-R"];
  for (const [teamId, before] of teamBefore) {
    const team = save.gameState.teams.find((entry) => entry.teamId === teamId)!;
    const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    const identityOpt = before.playerOpt;
    const teamBuys = buyTransfers.filter((entry) => entry.toTeamId === teamId);
    const pickPrices = teamBuys.map((entry) => entry.fee ?? entry.marketValue ?? 0).filter((value) => value > 0);
    const avgPickMW = pickPrices.length > 0 ? pickPrices.reduce((sum, value) => sum + value, 0) / pickPrices.length : null;
    const maxPickMW = pickPrices.length > 0 ? Math.max(...pickPrices) : null;
    const reachedOpt = rosterCount >= identityOpt;
    const themeTarget = getTeamThemeCompositionTarget(team);
    const themeCtx = buildTeamThemeCompositionRuntimeContext(save!.gameState, team);
    const themeShareAfter = themeCtx.rosterShare;
    const pickIdentityScores = teamBuys
      .map((entry) => scorePickIdentity(save!.gameState, teamId, entry.playerId ?? "", entry.fee ?? entry.marketValue ?? null).themeScore)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgPickThemeScore =
      pickIdentityScores.length > 0
        ? round(pickIdentityScores.reduce((sum, value) => sum + value, 0) / pickIdentityScores.length, 2)
        : null;
    const primaryPickMatches = teamBuys.filter((entry) =>
      scorePickIdentity(save!.gameState, teamId, entry.playerId ?? "", entry.fee ?? entry.marketValue ?? null).primaryMatch,
    ).length;
    const identity = save!.gameState.teamIdentities.find((entry) => entry.teamId === teamId);
    teamRows.push({
      teamId,
      teamCode: team.shortCode,
      rosterBefore: before.rosterCount,
      rosterAfter: rosterCount,
      playerOpt: identityOpt,
      reachedOpt,
      standingRank: teamStandingRank(save!.gameState, teamId),
      ambition: identity?.ambition ?? "",
      finances: identity?.finances ?? "",
      themePrimaryShareAfter: themeShareAfter ? round(themeShareAfter.primaryShare, 3) : "",
      themeTargetShare: themeTarget?.targetShare ?? "",
      avgPickThemeScore,
      primaryThemePickMatches: primaryPickMatches,
      cashBefore: before.cash,
      cashAfter: team.cash,
      cashSalaryBefore: before.cash && before.salary ? round(before.cash / before.salary, 2) : "",
      cashSalaryAfter: team.cash && getTeamSalaryTotal(save.gameState, teamId) ? round(team.cash / getTeamSalaryTotal(save.gameState, teamId), 2) : "",
      hoardingAfter: isCashHoardingTeam(save.gameState, teamId, seasonId),
      spendableBefore: before.spendable,
      reserveBefore: before.reserve,
      salaryBefore: before.salary,
      salaryAfter: getTeamSalaryTotal(save.gameState, teamId),
      buyCount: teamBuys.length,
      sellCount: sellTransfers.filter((entry) => entry.fromTeamId === teamId).length,
      avgPickMW: avgPickMW != null ? Number(avgPickMW.toFixed(2)) : "",
      maxPickMW: maxPickMW ?? "",
      laneMix: laneMixFromTransfers(teamBuys),
      convergenceStatus: convergence.perTeam.find((entry) => entry.teamId === teamId)?.status ?? "",
      spotTeam: spotTeams.includes(team.shortCode.toUpperCase()) ? "yes" : "",
    });
  }

  const hoardCapLabel = getSeasonHoardCashSalaryCap(seasonId);
  const hoardersAfter = teamRows.filter((row) => row.hoardingAfter === true).length;
  const teamsAtOpt = teamRows.filter((row) => row.reachedOpt === true).length;
  const teamsAtOptWithoutRepair = teamRows.filter((row) => {
    if (row.reachedOpt !== true) return false;
    const teamBuys = buyTransfers.filter((entry) => entry.toTeamId === row.teamId);
    return !teamBuys.some((entry) => String(entry.source ?? "").includes("repair"));
  }).length;
  const cashSalaryRatios = teamRows
    .map((row) => Number(row.cashSalaryAfter))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const medianCashSalary =
    cashSalaryRatios.length > 0
      ? cashSalaryRatios[Math.floor(cashSalaryRatios.length / 2)]
      : null;
  const p75CashSalary =
    cashSalaryRatios.length > 0
      ? cashSalaryRatios[Math.floor(cashSalaryRatios.length * 0.75)]
      : null;
  const teamsInTargetBand = teamRows.filter((row) => {
    const ratio = Number(row.cashSalaryAfter);
    return Number.isFinite(ratio) && ratio >= 0.25 && ratio <= 0.75;
  }).length;
  const teamsOverSoftTarget = save.gameState.teams.filter((team) =>
    isTeamOverCashSalarySoftTarget(save!.gameState, team.teamId, seasonId),
  ).length;
  const belowOptTeams = teamRows.filter((row) => row.reachedOpt !== true);
  const csRow = teamRows.find((row) => String(row.teamCode).toUpperCase() === "C-S");
  const ggRow = teamRows.find((row) => String(row.teamCode).toUpperCase() === "G-G");
  const ggTopPicks = ggRow ? topPickPricesForTeam(buyTransfers, String(ggRow.teamId), 2) : [];
  const csTopPicks = csRow ? topPickPricesForTeam(buyTransfers, String(csRow.teamId), 2) : [];
  const avgPickMw =
    pickRows.length > 0
      ? round(pickRows.reduce((sum, row) => sum + (Number(row.price) || 0), 0) / pickRows.length, 2)
      : null;
  const corePlusBuys = pickRows.filter((row) => Number(row.price) >= leagueAnchors.q65Price).length;
  const starPlusBuys = pickRows.filter((row) => Number(row.price) >= leagueAnchors.q85Price).length;
  const picksGte40 = pickRows.filter((row) => Number(row.price) >= 40).length;
  const picksGte50 = pickRows.filter((row) => Number(row.price) >= 50).length;
  const totalPickSpend = round(
    buyTransfers.reduce((sum, entry) => sum + (entry.fee ?? entry.marketValue ?? 0), 0),
    2,
  );
  const starChaserSpend = Object.fromEntries(
    ["C-S", "G-G"].map((code) => {
      const row = teamRows.find((entry) => String(entry.teamCode).toUpperCase() === code);
      if (!row) return [code, null] as const;
      const teamId = String(row.teamId);
      const spend = getPreseasonTransferSpend(save!.gameState, seasonId, teamId);
      const cashAfter = Number(row.cashAfter ?? 0);
      return [code, { transferSpend: spend, cashAfter }] as const;
    }),
  );
  const spotIdentityQuality = Object.fromEntries(
    ["C-S", "G-G"].map((code) => {
      const row = teamRows.find((entry) => String(entry.teamCode).toUpperCase() === code);
      if (!row) return [code, null] as const;
      const teamId = String(row.teamId);
      const teamPicks = pickRows.filter((entry) => String(entry.teamId) === teamId);
      return [
        code,
        {
          standingRank: row.standingRank,
          ambition: row.ambition,
          themePrimaryShareAfter: row.themePrimaryShareAfter,
          themeTargetShare: row.themeTargetShare,
          avgPickThemeScore: row.avgPickThemeScore,
          primaryThemePickMatches: row.primaryThemePickMatches,
          buyCount: row.buyCount,
          avgPickMW: row.avgPickMW,
          maxPickMW: row.maxPickMW,
          picks: teamPicks.map((pick) => ({
            name: pick.playerName,
            price: pick.price,
            race: pick.race,
            className: pick.className,
            themeScore: pick.themeScore,
            primaryThemeMatch: pick.primaryThemeMatch,
            themeTags: pick.themeTags,
          })),
        },
      ] as const;
    }),
  );
  const run5Baseline = {
    teamsAtOpt: 29,
    hoardersAfter: 2,
    avgPickMw: 20.6,
    corePlusBuys: 8,
    starPlusBuys: 1,
    ggMaxPick: 27.79,
    csMaxPick: 35.89,
  };
  const qualityVsRun5 = {
    teamsAtOpt: teamsAtOpt >= run5Baseline.teamsAtOpt,
    hoardersAfter: hoardersAfter <= run5Baseline.hoardersAfter,
    avgPickMw: (avgPickMw ?? 0) >= run5Baseline.avgPickMw,
    corePlusBuys: corePlusBuys >= run5Baseline.corePlusBuys,
    starPlusBuys: starPlusBuys >= run5Baseline.starPlusBuys,
    ggMaxPick: (Number(ggRow?.maxPickMW) || 0) >= run5Baseline.ggMaxPick,
    csMaxPick: (Number(csRow?.maxPickMW) || 0) >= run5Baseline.csMaxPick,
  };
  const summary = [
    "# Market-Slot Fast Audit",
    "",
    `- Run: **${runLabel}**`,
    `- Save: \`${save.saveId}\` (clone from \`${cloneFrom}\`)`,
    `- Season: ${seasonId}`,
    `- Convergence: ${convergence.appliedBuys} buys, ${convergence.appliedSells} sells`,
    `- Teams ≥ Opt: **${teamsAtOpt}/32**`,
    `- Teams ≥ Opt (ohne Repair): **${teamsAtOptWithoutRepair}/32**`,
    `- Horter (team-aware hard cap): **${hoardersAfter}/32**`,
    `- Über Soft-Target (Cash/Gehalt): **${teamsOverSoftTarget}/32**`,
    `- Teams unter Opt: **${belowOptTeams.length}/32**`,
    `- Median Cash/Gehalt: **${medianCashSalary ?? "n/a"}×**`,
    `- P75 Cash/Gehalt: ${p75CashSalary ?? "n/a"}×`,
    `- Teams in 0.25–0.75 band: **${teamsInTargetBand}/32**`,
    `- Repair buys: ${repairBuys.length}`,
    `- Buy sources: ${Object.entries(buySourceMix).map(([source, count]) => `${source}:${count}`).join(", ") || "none"}`,
    `- Market-engine buys (ai_preseason_market_buy): ${marketEngineBuys}/${buyTransfers.length}`,
    `- League anchors: q50=${leagueAnchors.q50Price} q65=${leagueAnchors.q65Price} q85=${leagueAnchors.q85Price}`,
    `- Label cap (median hard): ${hoardCapLabel}`,
    `- Avg pick MW: **${avgPickMw ?? "n/a"}** | Core+ (≥q65): **${corePlusBuys}** | Star+ (≥q85): **${starPlusBuys}**`,
    `- Pick spend total: **${totalPickSpend}** | Picks ≥40: **${picksGte40}** | Picks ≥50: **${picksGte50}**`,
    `- Star-chaser spend: C-S ${starChaserSpend["C-S"]?.transferSpend ?? "n/a"} / cash ${starChaserSpend["C-S"]?.cashAfter ?? "n/a"} | G-G ${starChaserSpend["G-G"]?.transferSpend ?? "n/a"} / cash ${starChaserSpend["G-G"]?.cashAfter ?? "n/a"}`,
    `- GM overrides: ${scenario.gmOverrides.length > 0 ? scenario.gmOverrides.map((entry) => `${entry.teamCode}→${entry.toArchetype}`).join(", ") : "none"}`,
    `- Timing (ms): total=${timingMs.total} preview=${timingMs.preview} compare=${timingMs.compareLoop} convergence=${timingMs.convergence}`,
    "",
    "## Identity Spot (C-S / G-G)",
    "",
    ...["C-S", "G-G"].flatMap((code) => {
      const spot = spotIdentityQuality[code];
      if (!spot) return [`- ${code}: n/a`];
      return [
        `- **${code}** rank #${spot.standingRank ?? "?"} | theme share ${spot.themePrimaryShareAfter}/${spot.themeTargetShare} | avg pick theme ${spot.avgPickThemeScore ?? "n/a"} | primary-match picks ${spot.primaryThemePickMatches}/${spot.buyCount}`,
        ...(spot.picks.length > 0
          ? spot.picks.map(
              (pick) =>
                `  - ${pick.name}: ${pick.price} MW | ${pick.race}/${pick.className} | theme=${pick.themeScore} primary=${pick.primaryThemeMatch ? "yes" : "no"} | ${pick.themeTags}`,
            )
          : [`  - (no market buys)`]),
      ];
    }),
    "",
    `- Teams ≥ Opt: ${qualityVsRun5.teamsAtOpt ? "PASS" : "FAIL"} (${teamsAtOpt} vs ${run5Baseline.teamsAtOpt})`,
    `- Horter: ${qualityVsRun5.hoardersAfter ? "PASS" : "FAIL"} (${hoardersAfter} vs ${run5Baseline.hoardersAfter})`,
    `- avgPickMw: ${qualityVsRun5.avgPickMw ? "PASS" : "FAIL"} (${avgPickMw ?? "n/a"} vs ${run5Baseline.avgPickMw})`,
    `- corePlusBuys: ${qualityVsRun5.corePlusBuys ? "PASS" : "FAIL"} (${corePlusBuys} vs ${run5Baseline.corePlusBuys})`,
    `- starPlusBuys: ${qualityVsRun5.starPlusBuys ? "PASS" : "FAIL"} (${starPlusBuys} vs ${run5Baseline.starPlusBuys})`,
    `- G-G max pick: ${qualityVsRun5.ggMaxPick ? "PASS" : "FAIL"} (${ggRow?.maxPickMW ?? "n/a"} vs ${run5Baseline.ggMaxPick})`,
    `- C-S max pick: ${qualityVsRun5.csMaxPick ? "PASS" : "FAIL"} (${csRow?.maxPickMW ?? "n/a"} vs ${run5Baseline.csMaxPick})`,
    `- Spot top-2: ${spotTopPickSummary(buyTransfers, teamRows, "G-G")} | ${spotTopPickSummary(buyTransfers, teamRows, "C-S")}`,
    "",
    "## Spot Teams",
    "",
    "| Team | Roster | Cash | Cash/Gehalt | Buys | avg Pick MW | max Pick MW | ≥ Opt | Hoard |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...spotTeams.map((code) => {
      const row = teamRows.find((entry) => String(entry.teamCode).toUpperCase() === code);
      if (!row) return `| ${code} | — | — | — | — | — | — | — | — |`;
      const tops = topPickPricesForTeam(buyTransfers, String(row.teamId), 2);
      const top2Label = tops.length > 0 ? tops.map((value) => value.toFixed(1)).join(" / ") : "—";
      return `| ${code} | ${row.rosterAfter}/${row.playerOpt} | ${row.cashAfter} | ${row.cashSalaryAfter} | ${row.buyCount} | ${row.avgPickMW} | ${row.maxPickMW} | ${row.reachedOpt ? "yes" : "no"} | ${row.hoardingAfter ? "HOARD" : "ok"} |`;
    }),
    "",
    "## Success checks",
    "",
    `- Star lane below q85: ${rejectedRows.length === 0 ? "PASS" : `FAIL (${rejectedRows.length})`}`,
    `- Repair buys in audit: ${repairBuys.length === 0 ? "PASS" : `FAIL (${repairBuys.length})`}`,
    `- G-G buy ≥ q65 when spendable ≥ q65: ${
      (() => {
        const gg = teamRows.find((row) => String(row.teamCode).toUpperCase() === "G-G");
        if (!gg) return "n/a";
        const spendable = Number(gg.spendableBefore ?? 0);
        const maxPick = Number(gg.maxPickMW || 0);
        if (spendable < leagueAnchors.q65Price) return "n/a (low spendable)";
        return maxPick >= leagueAnchors.q65Price ? "PASS" : "FAIL";
      })()
    }`,
    `- Median cash/salary in 0.25–0.75: ${
      medianCashSalary != null && medianCashSalary >= 0.25 && medianCashSalary <= 0.75 ? "PASS" : "FAIL"
    } (${medianCashSalary ?? "n/a"})`,
    `- Horter ≤ 2: ${hoardersAfter <= 2 ? "PASS" : `FAIL (${hoardersAfter})`}`,
    `- C-S cash/salary ≤ 1.0: ${
      csRow && Number(csRow.cashSalaryAfter) <= 1.0 ? "PASS" : `FAIL (${csRow?.cashSalaryAfter ?? "n/a"})`
    }`,
    `- C-S avg pick ≥ q65: ${
      csRow && Number(csRow.avgPickMW || 0) >= leagueAnchors.q65Price
        ? "PASS"
        : `FAIL (${csRow?.avgPickMW ?? "n/a"} vs ${leagueAnchors.q65Price})`
    }`,
    `- Teams ≥ Opt ohne Repair ≥ 25: ${teamsAtOptWithoutRepair >= 25 ? "PASS" : `FAIL (${teamsAtOptWithoutRepair}/32)`}`,
  ].join("\n");

  await writeFile(path.join(outputDir, "pick-audit-teams.csv"), toCsv(
    ["teamId", "teamCode", "rosterBefore", "rosterAfter", "playerOpt", "reachedOpt", "standingRank", "ambition", "themePrimaryShareAfter", "themeTargetShare", "avgPickThemeScore", "primaryThemePickMatches", "cashBefore", "cashAfter", "cashSalaryBefore", "cashSalaryAfter", "hoardingAfter", "spendableBefore", "reserveBefore", "salaryBefore", "salaryAfter", "buyCount", "sellCount", "avgPickMW", "maxPickMW", "laneMix", "convergenceStatus", "spotTeam"],
    teamRows,
  ));
  await writeFile(path.join(outputDir, "pick-audit-slots.csv"), toCsv(
    ["teamId", "teamCode", "slotIndex", "lane", "floorMW", "ceilingMW", "spendableBefore", "affordable"],
    slotRows,
  ));
  await writeFile(path.join(outputDir, "pick-audit-picks.csv"), toCsv(
    ["teamId", "teamCode", "playerId", "playerName", "lane", "price", "marketTier", "tierMatch", "race", "className", "themeScore", "themeTier", "primaryThemeMatch", "themeTags", "source"],
    pickRows,
  ));
  await writeFile(path.join(outputDir, "pick-audit-rejected.csv"), toCsv(
    ["teamId", "teamCode", "playerId", "reason", "price", "q85"],
    rejectedRows,
  ));
  await writeFile(path.join(outputDir, "pick-audit-summary.md"), summary);

  log(`Done. ${pickRows.length} buys exported. Teams ≥ Opt: ${teamsAtOpt}/32`);
  const kpi = {
    runLabel,
    outputDir,
    saveId: save.saveId,
    seasonId,
    teamsAtOpt,
    avgPickMw,
    corePlusBuys,
    starPlusBuys,
    totalPickSpend,
    picksGte40,
    picksGte50,
    starChaserSpend,
    spotIdentityQuality,
    spotRosterQuality: Object.fromEntries(
      spotTeamCodes.map((code) => {
        const row = teamRows.find((entry) => String(entry.teamCode).toUpperCase() === code);
        if (!row) return [code, null] as const;
        const teamId = String(row.teamId);
        return [
          code,
          {
            rosterMwTop5Avg: rosterMwTop5Avg(save!.gameState, teamId),
            playersGte40InRoster: countRosterPlayersGte(save!.gameState, teamId, 40),
          },
        ] as const;
      }),
    ),
    gmOverrides: scenario.gmOverrides,
    timingMs,
    ggTopPicks,
    csTopPicks,
    ggMaxPick: ggRow?.maxPickMW ?? null,
    csMaxPick: csRow?.maxPickMW ?? null,
    qualityVsRun5,
    teamsAtOptWithoutRepair,
    hoardersAfter,
    teamsOverSoftTarget,
    teamsBelowOpt: belowOptTeams.length,
    teamsInTargetBand,
    medianCashSalary,
    p75CashSalary,
    buyCount: pickRows.length,
    sellCount: sellTransfers.length,
    convergenceBuys: convergence.appliedBuys,
    convergenceSells: convergence.appliedSells,
    repairBuys: repairBuys.length,
    buySourceMix,
    marketEngineBuys,
    salaryFactor,
  };
  await writeFile(path.join(outputDir, "pick-audit-kpi.json"), `${JSON.stringify(kpi, null, 2)}\n`);
  console.log(JSON.stringify(kpi, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
