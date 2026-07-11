/**
 * Advance one season from an existing save (season_end → transition → next preseason).
 * Default: planner-only (no emergency repair).
 *
 * Usage:
 *   node --import tsx scripts/run-next-season-from-save.ts --save-db outputs/.../balancing-run.sqlite
 *   node --import tsx scripts/run-next-season-from-save.ts --save-db ... --focus-team Z-H
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getLongRunPlannerMaxLeagueRounds, getLongRunPlannerMaxTeamCycles } from "@/lib/season/long-run-profile";
import { isTransferActionAllowed } from "@/lib/season/transfer-season-policy";
import {
  buildPreSeasonNextSeasonSetupToken,
  applyPreSeasonNextSeasonSetupLightweight,
} from "@/lib/season/preseason-workflow-service";

import {
  applyQuickSimSeasonEndStack,
  cloneSourceDatabase,
  collectTeamRows,
  log,
  resolvePersistenceFromEnv,
  round,
  runEmergencyRepairIfNeeded,
  setAllTeamsAi,
} from "./s1-s2-transfer-shared";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function seasonNumberFromId(seasonId: string) {
  const match = /^season-(\d+)$/.exec(seasonId);
  if (!match) throw new Error(`Unexpected season id: ${seasonId}`);
  return Number(match[1]);
}

function seasonIdForNumber(n: number) {
  return `season-${n}`;
}

function bracketShort(tier: ReturnType<typeof classifyMarketBracket>) {
  const map = {
    Superstar: "SS",
    Star: "ST",
    Core: "CO",
    Depth: "DE",
    Backup: "BA",
    Reserve: "RE",
  } as const;
  return map[tier];
}

function loadLatestSaveId(sqlitePath: string) {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    const row = db.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as
      | { save_id: string }
      | undefined;
    if (!row?.save_id) throw new Error(`No save in ${sqlitePath}`);
    return row.save_id;
  } finally {
    db.close();
  }
}

function findOriginalBuy(history: TransferHistoryEntry[], playerId: string) {
  return history.find((entry) => entry.transferType === "buy" && entry.playerId === playerId && entry.toTeamId);
}

function analyzeMarketSells(input: { gameState: GameState; seasonId: string }) {
  const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team]));
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player]));
  const sells = input.gameState.transferHistory.filter(
    (entry) => entry.seasonId === input.seasonId && entry.transferType === "sell",
  );

  return sells.map((sell) => {
    const team = sell.fromTeamId ? teamById.get(sell.fromTeamId) : null;
    const buy = findOriginalBuy(input.gameState.transferHistory, sell.playerId);
    const buyFee = buy?.fee ?? buy?.marketValue ?? null;
    const sellFee = sell.fee ?? sell.marketValue ?? 0;
    const netCash = sell.netCashImpact ?? sellFee - (sell.buyoutCost ?? 0);
    const pnlVsBuy = buyFee != null ? round(netCash - buyFee) : null;
    const player = playerById.get(sell.playerId);
    const contract = player ? resolvePlayerEconomyContract(player) : null;
    return {
      teamCode: team?.shortCode ?? sell.fromTeamId ?? "?",
      playerName: sell.playerName ?? player?.name ?? sell.playerId,
      mw: round(sell.marketValue ?? contract?.marketValue ?? 0),
      buyFee: buyFee != null ? round(buyFee) : null,
      sellFee: round(sellFee),
      buyoutCost: round(sell.buyoutCost ?? 0),
      netCash: round(netCash),
      pnlVsBuy,
      source: sell.source ?? "?",
    };
  });
}

function analyzeContractExits(input: { gameState: GameState; seasonId: string }) {
  const events = (input.gameState.seasonState.contractEvents ?? []).filter(
    (event) => event.seasonId === input.seasonId && event.eventType === "contract_expired_exit",
  );
  const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team]));
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player]));

  return events.map((event) => {
    const buy = event.playerId ? findOriginalBuy(input.gameState.transferHistory, event.playerId) : null;
    const buyFee = buy?.fee ?? buy?.marketValue ?? null;
    const exitCash = event.exitValue ?? 0;
    const pnlVsBuy = buyFee != null ? round(exitCash - buyFee) : null;
    const player = event.playerId ? playerById.get(event.playerId) : null;
    return {
      teamCode: teamById.get(event.teamId)?.shortCode ?? event.teamId,
      playerName: event.playerName ?? player?.name ?? event.playerId ?? "?",
      exitCash: round(exitCash),
      buyFee: buyFee != null ? round(buyFee) : null,
      pnlVsBuy,
      reason: event.reason ?? "contract_expired_exit",
    };
  });
}

function rosterContractRows(gameState: GameState, teamCode?: string) {
  const prices = gameState.players
    .map((player) => resolvePlayerEconomyContract(player).marketValue)
    .filter((value) => value > 0);
  const brackets = buildLeagueMarketBrackets(prices.length > 0 ? prices : [12, 20, 30, 45, 65, 90]);
  const teams = teamCode
    ? gameState.teams.filter((team) => (team.shortCode ?? team.teamId) === teamCode)
    : gameState.teams;

  return teams
    .map((team) => {
      const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const { playerOpt } = deriveRosterTargets(team, identity);
      const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const players = rosterEntries
        .map((entry) => {
          const player = gameState.players.find((p) => p.id === entry.playerId);
          if (!player) return null;
          const economy = resolvePlayerEconomyContract(player);
          const mw = economy.marketValue ?? player.marketValue ?? 0;
          const tier = classifyMarketBracket(mw, brackets);
          const buy = findOriginalBuy(gameState.transferHistory, entry.playerId);
          return {
            name: player.name,
            mw: round(mw),
            salary: round(economy.salary ?? player.salary ?? 0),
            bracket: bracketShort(tier),
            contractLength: entry.contractLength,
            buyFee: buy?.fee != null ? round(buy.fee) : null,
            buySeason: buy?.seasonId ?? null,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry != null)
        .sort((a, b) => b.mw - a.mw);

      const expiringLe1 = players.filter((p) => p.contractLength <= 1).length;
      const salary = round(getTeamSalarySum(gameState, team.teamId));
      const cash = round(team.cash ?? 0);
      return {
        teamCode: team.shortCode ?? team.teamId,
        roster: players.length,
        playerOpt,
        cash,
        salary,
        cashSalary: salary > 0 ? round(cash / salary, 3) : null,
        expiringLe1,
        players,
      };
    })
    .sort((a, b) => a.teamCode.localeCompare(b.teamCode));
}

function buildContractPlReport(input: {
  gameState: GameState;
  fromSeasonId: string;
  toSeasonId: string;
  focusTeam: string;
  seasonEndSells: ReturnType<typeof analyzeMarketSells>;
  contractExits: ReturnType<typeof analyzeContractExits>;
  preseasonBuys: TransferHistoryEntry[];
  rosterBefore: ReturnType<typeof rosterContractRows>;
  rosterAfter: ReturnType<typeof rosterContractRows>;
}) {
  const lines: string[] = [
    `# Contract & P/L Report — ${input.fromSeasonId} → ${input.toSeasonId}`,
    "",
    `- Market sells (${input.fromSeasonId} season_end): **${input.seasonEndSells.length}**`,
    `- Contract exits (${input.fromSeasonId} tick): **${input.contractExits.length}**`,
    `- Preseason buys (${input.toSeasonId}): **${input.preseasonBuys.length}**`,
    "",
    "## Liga — Vertragslängen (Ende " + input.toSeasonId + " Preseason)",
    "",
    "| Team | # | Opt | Cash | Sal | C/S | LZ≤1 | SS ST CO DE BA RE |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const team of input.rosterAfter) {
    const roles = { SS: 0, ST: 0, CO: 0, DE: 0, BA: 0, RE: 0 };
    for (const player of team.players) {
      roles[player.bracket as keyof typeof roles] += 1;
    }
    lines.push(
      `| ${team.teamCode} | ${team.roster} | ${team.playerOpt} | ${team.cash} | ${team.salary} | ${team.cashSalary ?? "—"} | ${team.expiringLe1} | ${roles.SS} ${roles.ST} ${roles.CO} ${roles.DE} ${roles.BA} ${roles.RE} |`,
    );
  }

  lines.push("", "## Verkäufe & Vertragsablauf — P/L vs. Kaufpreis", "");
  const sellByTeam = new Map<string, typeof input.seasonEndSells>();
  for (const row of input.seasonEndSells) {
    const list = sellByTeam.get(row.teamCode) ?? [];
    list.push(row);
    sellByTeam.set(row.teamCode, list);
  }
  const exitByTeam = new Map<string, typeof input.contractExits>();
  for (const row of input.contractExits) {
    const list = exitByTeam.get(row.teamCode) ?? [];
    list.push(row);
    exitByTeam.set(row.teamCode, list);
  }

  const allTeams = [...new Set([...sellByTeam.keys(), ...exitByTeam.keys()])].sort();
  if (allTeams.length === 0) {
    lines.push("_Keine Verkäufe oder Vertrags-Exits in dieser Phase._");
  }
  for (const teamCode of allTeams) {
    const sells = sellByTeam.get(teamCode) ?? [];
    const exits = exitByTeam.get(teamCode) ?? [];
    if (sells.length === 0 && exits.length === 0) continue;
    const sellPnl = round(sells.reduce((sum, row) => sum + (row.pnlVsBuy ?? 0), 0));
    const exitPnl = round(exits.reduce((sum, row) => sum + (row.pnlVsBuy ?? 0), 0));
    lines.push(`### ${teamCode} — Markt-Verkäufe: ${sells.length}, Vertrags-Exit: ${exits.length}, P/L Σ ${round(sellPnl + exitPnl)}`);
    for (const row of sells) {
      lines.push(
        `- **SELL** ${row.playerName} | Kauf ${row.buyFee ?? "?"}M → net ${row.netCash}M | P/L **${row.pnlVsBuy ?? "?"}**M | ${row.source}`,
      );
    }
    for (const row of exits) {
      lines.push(
        `- **EXIT** ${row.playerName} | Kauf ${row.buyFee ?? "?"}M → Exit-Cash ${row.exitCash}M | P/L **${row.pnlVsBuy ?? "?"}**M`,
      );
    }
    lines.push("");
  }

  const focusBefore = input.rosterBefore.find((row) => row.teamCode === input.focusTeam);
  const focusAfter = input.rosterAfter.find((row) => row.teamCode === input.focusTeam);
  lines.push(`## Fokus: ${input.focusTeam}`, "");
  if (focusBefore) {
    lines.push(`### ${input.focusTeam} vor ${input.fromSeasonId} season_end`, "");
    lines.push("| Spieler | MW | LZ | Bracket | Kauf | Season |");
    lines.push("| --- | ---: | ---: | --- | ---: | --- |");
    for (const player of focusBefore.players) {
      lines.push(
        `| ${player.name} | ${player.mw} | ${player.contractLength} | ${player.bracket} | ${player.buyFee ?? "—"} | ${player.buySeason ?? "—"} |`,
      );
    }
    lines.push("");
  }
  if (focusAfter) {
    lines.push(`### ${input.focusTeam} nach ${input.toSeasonId} preseason`, "");
    lines.push("| Spieler | MW | LZ | Bracket | Kauf | Season |");
    lines.push("| --- | ---: | ---: | --- | ---: | --- |");
    for (const player of focusAfter.players) {
      lines.push(
        `| ${player.name} | ${player.mw} | ${player.contractLength} | ${player.bracket} | ${player.buyFee ?? "—"} | ${player.buySeason ?? "—"} |`,
      );
    }
    lines.push("");
  }

  const focusBuys = input.preseasonBuys.filter((entry) => {
    const team = input.gameState.teams.find((row) => row.teamId === entry.toTeamId);
    return (team?.shortCode ?? entry.toTeamId) === input.focusTeam;
  });
  if (focusBuys.length > 0) {
    lines.push(`### ${input.focusTeam} — ${input.toSeasonId} Preseason-Käufe`, "");
    for (const buy of focusBuys) {
      lines.push(`- ${buy.playerName ?? buy.playerId} | ${round(buy.fee ?? buy.marketValue ?? 0)}M | ${buy.source ?? "?"}`);
    }
  } else {
    lines.push(`_${input.focusTeam}: keine Preseason-Käufe in ${input.toSeasonId}._`);
  }

  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveDbArg = argValue("--save-db");
  if (!saveDbArg) {
    throw new Error("Usage: --save-db path/to/balancing-run.sqlite [--focus-team Z-H]");
  }
  const saveDb = path.isAbsolute(saveDbArg) ? saveDbArg : path.join(PROJECT_ROOT, saveDbArg);
  if (!fs.existsSync(saveDb)) throw new Error(`DB not found: ${saveDb}`);

  const focusTeam = argValue("--focus-team") ?? "Z-H";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `next-season-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  delete process.env.OLY_APP_SQLITE_PATH;
  const sqlitePath = cloneSourceDatabase(saveDb, outputDir);
  process.env.OLY_APP_SQLITE_PATH = sqlitePath;
  const persistence = resolvePersistenceFromEnv();

  const sourceSaveId = loadLatestSaveId(saveDb);
  let save = persistence.getSaveById(sourceSaveId);
  if (!save) throw new Error(`Save missing: ${sourceSaveId}`);
  save = setAllTeamsAi(save, persistence);

  const fromSeasonNumber = seasonNumberFromId(save.gameState.season.id);
  const fromSeasonId = save.gameState.season.id;
  const toSeasonId = seasonIdForNumber(fromSeasonNumber + 1);

  log(`Start: ${fromSeasonId} (${save.gameState.gamePhase}) → advance to ${toSeasonId}`);
  log(`DB clone → ${sqlitePath}`);

  const rosterBeforeSeasonEnd = rosterContractRows(save.gameState, focusTeam);
  const rowsBefore = collectTeamRows(save.gameState);

  log(`${fromSeasonId} season-end stack…`);
  const seasonEndStack = await applyQuickSimSeasonEndStack(save, persistence);
  save = seasonEndStack.save;
  log(
    `${fromSeasonId} contracts renewed=${seasonEndStack.contractsRenewed} released=${seasonEndStack.contractsReleased} exitCash=${seasonEndStack.contractExitCashDelta}`,
  );

  const contractExits = analyzeContractExits({ gameState: save.gameState, seasonId: fromSeasonId });

  log(`${fromSeasonId} season_end sell…`);
  const seasonEndSession = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: fromSeasonId,
    persistence,
    phase: "season_end",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: isTransferActionAllowed(fromSeasonId, "season_end_market_buy"),
    skipIfExistingMarketTransfers: false,
    progressLog: true,
    outputDir,
  });
  save = persistence.getSaveById(save.saveId)!;
  const seasonEndSells = analyzeMarketSells({ gameState: save.gameState, seasonId: fromSeasonId });
  const rowsAfterSell = collectTeamRows(save.gameState);
  log(`${fromSeasonId} season_end: sells=${seasonEndSession.appliedSells} buys=${seasonEndSession.appliedBuys}`);

  log(`Transition ${fromSeasonId} → ${toSeasonId}…`);
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
  if (!next.applied) {
    throw new Error(`Transition blocked: ${next.blockingReasons.join(" | ")}`);
  }
  save = persistence.getSaveById(save.saveId)!;
  if (save.gameState.season.id !== toSeasonId) {
    throw new Error(`Expected ${toSeasonId}, got ${save.gameState.season.id}`);
  }

  await runPreseasonProactiveCashRecovery({ saveId: save.saveId, seasonId: toSeasonId, persistence });

  log(`${toSeasonId} preseason buy…`);
  const preseasonSession = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: toSeasonId,
    persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
    outputDir,
  });
  await runEmergencyRepairIfNeeded({
    saveId: save.saveId,
    seasonId: toSeasonId,
    persistence,
    outputDir,
  });

  save = persistence.getSaveById(save.saveId)!;
  const rowsAfterPreseason = collectTeamRows(save.gameState);
  const preseasonBuys = save.gameState.transferHistory.filter(
    (entry) => entry.seasonId === toSeasonId && entry.transferType === "buy" && entry.toTeamId,
  );
  const rosterAfter = rosterContractRows(save.gameState);

  const report = buildContractPlReport({
    gameState: save.gameState,
    fromSeasonId,
    toSeasonId,
    focusTeam,
    seasonEndSells,
    contractExits,
    preseasonBuys,
    rosterBefore: rosterBeforeSeasonEnd,
    rosterAfter,
  });

  const reportPath = path.join(outputDir, "contract-pl-report.md");
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(
    path.join(outputDir, "advance-summary.json"),
    JSON.stringify(
      {
        fromSeasonId,
        toSeasonId,
        focusTeam,
        seasonEnd: {
          sells: seasonEndSession.appliedSells,
          buys: seasonEndSession.appliedBuys,
          sellPnlTotal: round(seasonEndSells.reduce((sum, row) => sum + (row.pnlVsBuy ?? 0), 0)),
          contractExitPnlTotal: round(contractExits.reduce((sum, row) => sum + (row.pnlVsBuy ?? 0), 0)),
          contractsRenewed: seasonEndStack.contractsRenewed,
          contractsReleased: seasonEndStack.contractsReleased,
        },
        preseason: {
          buys: preseasonSession.appliedBuys,
          teamsAtMin: rowsAfterPreseason.filter((row) => row.atMin).length,
          teamsAtOpt: rowsAfterPreseason.filter((row) => row.atOpt).length,
          avgCash: round(rowsAfterPreseason.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, rowsAfterPreseason.length)),
        },
        focusTeamDelta: {
          before: rowsBefore.find((row) => row.teamCode === focusTeam),
          afterSell: rowsAfterSell.find((row) => row.teamCode === focusTeam),
          afterPreseason: rowsAfterPreseason.find((row) => row.teamCode === focusTeam),
          preseasonBuys: preseasonBuys
            .filter((entry) => save.gameState.teams.find((team) => team.teamId === entry.toTeamId)?.shortCode === focusTeam)
            .map((entry) => ({
              playerName: entry.playerName,
              fee: entry.fee,
              source: entry.source,
            })),
        },
        buySources: preseasonBuys.reduce(
          (counts, entry) => {
            const src = entry.source ?? "unknown";
            counts[src] = (counts[src] ?? 0) + 1;
            return counts;
          },
          {} as Record<string, number>,
        ),
      },
      null,
      2,
    ),
  );

  log(`Done → ${outputDir}`);
  console.log(report);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
