/**
 * Lane + cash report for a completed S1→S2 smoke run directory.
 *
 * Usage:
 *   node --import tsx scripts/s1-s2-lane-cash-report.ts outputs/s1-s2-transfer-smoke-...
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";

import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { isCashSalaryRatioInSoftBand } from "@/lib/ai/season1-draft-cash-planner";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function bracketShort(tier: MarketBracketTierLabel) {
  const map: Record<MarketBracketTierLabel, string> = {
    Superstar: "SS",
    Star: "ST",
    Core: "CO",
    Depth: "DE",
    Backup: "BA",
    Reserve: "RE",
  };
  return map[tier];
}

function laneFromMw(mw: number, brackets: ReturnType<typeof buildLeagueMarketBrackets>) {
  const tier = classifyMarketBracket(mw, brackets);
  if (tier === "Superstar") return "superstar_pick";
  if (tier === "Star") return "star_pick";
  if (tier === "Core") return "core_investment";
  if (tier === "Depth") return "depth_value";
  if (tier === "Backup") return "backup";
  return "cheap_fill";
}

function findRunDir(input: string) {
  const resolved = path.isAbsolute(input) ? input : path.join(PROJECT_ROOT, input);
  if (fs.existsSync(path.join(resolved, "run-result.json"))) return resolved;
  const children = fs
    .readdirSync(resolved)
    .map((name) => path.join(resolved, name))
    .filter((entry) => fs.statSync(entry).isDirectory())
    .filter((entry) => fs.existsSync(path.join(entry, "run-result.json")));
  if (children.length === 1) return children[0]!;
  throw new Error(`Could not resolve run dir from ${input}`);
}

function loadSaveFromSqlite(sqlitePath: string) {
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

type PlannedPick = {
  step?: number;
  playerName?: string;
  playerId?: string;
  price?: number | null;
  marketValue?: number | null;
  pickLane?: string | null;
  lane?: string | null;
  slotPurposeLabel?: string | null;
  slotBracket?: string | null;
  status?: string | null;
};

type PreseasonDiag = {
  teams?: Array<{
    teamCode: string;
    cashBefore?: number | null;
    cashAfter?: number | null;
    rosterBefore?: number | null;
    rosterAfter?: number | null;
    plannedPicks?: PlannedPick[];
  }>;
  globalPreview?: { laneDistribution?: Array<{ label: string; count: number }> };
  globalExecution?: { laneDistribution?: Array<{ label: string; count: number }> };
};

function summarizeLaneCounts(picks: PlannedPick[]) {
  const counts: Record<string, number> = {};
  for (const pick of picks) {
    const lane = (pick.pickLane ?? pick.lane ?? "unknown").trim();
    counts[lane] = (counts[lane] ?? 0) + 1;
  }
  return counts;
}

function formatLaneCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([lane, count]) => `${lane}:${count}`)
    .join(", ");
}

function analyzeSells(input: {
  history: TransferHistoryEntry[];
  gameState: GameState;
  seasonId: string;
}) {
  const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team]));
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player]));
  const buysByPlayer = new Map<string, TransferHistoryEntry>();
  for (const entry of input.history) {
    if (entry.transferType === "buy" && entry.playerId) {
      buysByPlayer.set(entry.playerId, entry);
    }
  }

  const sells = input.history.filter(
    (entry) => entry.seasonId === input.seasonId && entry.transferType === "sell",
  );

  const rows = sells.map((sell) => {
    const team = sell.fromTeamId ? teamById.get(sell.fromTeamId) : null;
    const buy = buysByPlayer.get(sell.playerId);
    const buyFee = buy?.fee ?? buy?.marketValue ?? null;
    const sellFee = sell.fee ?? sell.marketValue ?? 0;
    const netCash = sell.netCashImpact ?? sellFee - (sell.buyoutCost ?? 0);
    const pnlVsBuy = buyFee != null ? round(netCash - buyFee) : null;
    const profitable = pnlVsBuy != null ? pnlVsBuy > 0.5 : netCash > 0.5;
    const player = playerById.get(sell.playerId);
    const contract = player ? resolvePlayerEconomyContract(player) : null;
    return {
      teamCode: team?.shortCode ?? sell.fromTeamId ?? "?",
      playerName: sell.playerName ?? player?.name ?? sell.playerId,
      mw: round(sell.marketValue ?? contract?.marketValue ?? 0),
      buyFee,
      sellFee: round(sellFee),
      buyoutCost: round(sell.buyoutCost ?? 0),
      netCash: round(netCash),
      pnlVsBuy,
      profitable,
      source: sell.source ?? "?",
    };
  });

  const byTeam = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byTeam.get(row.teamCode) ?? [];
    list.push(row);
    byTeam.set(row.teamCode, list);
  }

  return { rows, byTeam, total: rows.length, profitable: rows.filter((row) => row.profitable).length };
}

function teamCashInvestSummary(gameState: GameState, teamCode: string, startCash?: number | null) {
  const team = gameState.teams.find((entry) => (entry.shortCode ?? entry.teamId) === teamCode);
  if (!team) return null;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const { playerMin, playerMax } = deriveRosterTargets(team, identity);
  const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
  const mw = round(
    gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .map((entry) => {
        const player = gameState.players.find((p) => p.id === entry.playerId);
        return player ? resolvePlayerEconomyContract(player).marketValue : 0;
      })
      .reduce((sum, value) => sum + value, 0),
  );
  const cash = round(team.cash ?? 0);
  const spent = startCash != null ? round(startCash - cash) : null;
  return { cash, mw, roster, playerMin, playerMax, spent, atMin: roster >= playerMin, atOpt: roster >= playerMax - 1 };
}

function summarizeCashSalaryBand(gameState: GameState, label: string) {
  const rows = gameState.teams.map((team) => {
    const salary = getTeamSalarySum(gameState, team.teamId);
    const cash = round(team.cash ?? 0);
    const ratio = salary > 0 ? round(cash / salary, 3) : null;
    return {
      teamCode: team.shortCode ?? team.teamId,
      cash,
      salary: round(salary),
      ratio,
      inBand: isCashSalaryRatioInSoftBand(ratio),
    };
  });
  const inBand = rows.filter((row) => row.inBand);
  const overBand = rows.filter((row) => row.ratio != null && row.ratio > 0.79);
  const underBand = rows.filter((row) => row.ratio != null && row.ratio < 0.21);
  console.log(`### Cash/Salary Soft-Band (0.25–0.75) — ${label}`);
  console.log(
    `Teams in Band: **${inBand.length}/${rows.length}** | über Band: ${overBand.length} | unter Band: ${underBand.length}`,
  );
  if (overBand.length > 0) {
    console.log(
      `Hoarding: ${overBand
        .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
        .slice(0, 8)
        .map((row) => `${row.teamCode}:${row.ratio}`)
        .join(", ")}`,
    );
  }
  if (underBand.length > 0) {
    console.log(
      `Cash-arm: ${underBand
        .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))
        .slice(0, 8)
        .map((row) => `${row.teamCode}:${row.ratio}`)
        .join(", ")}`,
    );
  }
  console.log("");
  return { inBand: inBand.length, total: rows.length, rows };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Usage: node --import tsx scripts/s1-s2-lane-cash-report.ts <smoke-output-dir>");
    process.exit(1);
  }

  const runDir = findRunDir(inputArg);
  const sqlitePath = path.join(runDir, "balancing-run.sqlite");
  const preseasonDiagPath = path.join(runDir, "preseason-batch-plan-vs-execute-season-2.json");
  const draftBaselinePath = path.join(PROJECT_ROOT, "outputs/s1-draft-baseline.sqlite");
  const economyPath = path.join(runDir, "economy-rows.json");

  if (!fs.existsSync(sqlitePath)) throw new Error(`Missing ${sqlitePath}`);

  process.env.OLY_APP_SQLITE_PATH = sqlitePath;
  const persistence = createPersistenceService();
  const saveId = loadSaveFromSqlite(sqlitePath);
  const finalSave = persistence.getSaveById(saveId);
  if (!finalSave) throw new Error(`Save ${saveId} not found`);

  const gs = finalSave.gameState;
  const history = gs.transferHistory;

  let draftSave = finalSave;
  if (fs.existsSync(draftBaselinePath)) {
    process.env.OLY_APP_SQLITE_PATH = draftBaselinePath;
    const draftPersistence = createPersistenceService();
    const draftSaveId = loadSaveFromSqlite(draftBaselinePath);
    draftSave = draftPersistence.getSaveById(draftSaveId) ?? finalSave;
  }

  const draftGs = draftSave.gameState;
  const draftBuys = history.filter((entry) => entry.seasonId === "season-1" && entry.transferType === "buy");
  const draftPrices = draftBuys.map((entry) => entry.marketValue ?? entry.fee ?? 0).filter((v) => v > 0);
  const draftBrackets = buildLeagueMarketBrackets(draftPrices.length > 0 ? draftPrices : [12, 20, 30, 45, 65, 90]);

  const preseasonDiag: PreseasonDiag | null = fs.existsSync(preseasonDiagPath)
    ? (JSON.parse(fs.readFileSync(preseasonDiagPath, "utf8")) as PreseasonDiag)
    : null;

  const economyRows: Array<{ teamCode: string; sellFeesS1: number; buyFeesS2: number; cashEnd: number; guvEstimate: number }> =
    fs.existsSync(economyPath) ? JSON.parse(fs.readFileSync(economyPath, "utf8")) : [];

  const focusTeams = ["W-L", "C-C", "M-M", "S-C", "T-T", "H-R", "N-N"];

  console.log(`\n# S1→S2 Lane & Cash Report`);
  console.log(`Run: ${runDir}`);
  console.log(`Generated: ${new Date().toISOString()}\n`);

  summarizeCashSalaryBand(draftGs, "nach S1 Draft");
  summarizeCashSalaryBand(gs, "Ende S2 Preseason");

  // --- S1 DRAFT ---
  console.log(`## S1 Draft — Kauf-Lanes (aus Transfer-History + Bracket-Klassifikation)\n`);
  const s1ByTeam = new Map<string, Array<{ name: string; mw: number; lane: string; bracket: string }>>();
  for (const buy of draftBuys) {
    const team = gs.teams.find((entry) => entry.teamId === buy.toTeamId);
    const code = team?.shortCode ?? buy.toTeamId ?? "?";
    const mw = buy.marketValue ?? buy.fee ?? 0;
    const bracket = bracketShort(classifyMarketBracket(mw, draftBrackets));
    const lane = laneFromMw(mw, draftBrackets);
    const list = s1ByTeam.get(code) ?? [];
    list.push({ name: buy.playerName ?? buy.playerId, mw: round(mw), lane, bracket });
    s1ByTeam.set(code, list);
  }

  const allS1Lanes: Record<string, number> = {};
  for (const buys of s1ByTeam.values()) {
    for (const buy of buys) {
      allS1Lanes[buy.lane] = (allS1Lanes[buy.lane] ?? 0) + 1;
    }
  }
  console.log(`Liga gesamt (${draftBuys.length} Käufe): ${formatLaneCounts(allS1Lanes)}\n`);

  for (const code of focusTeams) {
    const buys = s1ByTeam.get(code);
    if (!buys?.length) continue;
    const startTeam = draftGs.teams.find((entry) => entry.shortCode === code);
    const startCash = startTeam?.cash ?? null;
    const end = teamCashInvestSummary(draftGs, code, startCash);
    const lanes = summarizeLaneCounts(buys.map((buy) => ({ pickLane: buy.lane })));
    console.log(`### ${code} — S1 Draft`);
    console.log(`Lanes: ${formatLaneCounts(lanes)} | Käufe: ${buys.length} | Cash Ende Draft: ${end?.cash ?? "?"} | ausgegeben: ${end?.spent ?? "?"}`);
    for (const buy of buys.sort((a, b) => b.mw - a.mw)) {
      console.log(`  - ${buy.name} (${buy.mw}M, ${buy.bracket}, ${buy.lane})`);
    }
    console.log("");
  }

  // --- S1 SELLS ---
  console.log(`## S1 Ende — Verkäufe (Gewinn = netCash − urspr. Kaufpreis)\n`);
  const sellAnalysis = analyzeSells({ history, gameState: gs, seasonId: "season-1" });
  console.log(
    `Liga: ${sellAnalysis.total} Verkäufe, ${sellAnalysis.profitable} mit positivem P&L vs. Kaufpreis\n`,
  );

  for (const code of focusTeams) {
    const teamSells = sellAnalysis.byTeam.get(code) ?? [];
    if (teamSells.length === 0) {
      console.log(`### ${code} — keine Verkäufe`);
      continue;
    }
    const totalPnl = round(teamSells.reduce((sum, row) => sum + (row.pnlVsBuy ?? row.netCash), 0));
    console.log(`### ${code} — ${teamSells.length} Verkäufe | P&L vs Kauf: ${totalPnl}M`);
    for (const sell of teamSells.sort((a, b) => (b.pnlVsBuy ?? 0) - (a.pnlVsBuy ?? 0))) {
      const tag = sell.profitable ? "GEWINN" : "VERLUST";
      console.log(
        `  - ${sell.playerName} | Kauf ${sell.buyFee ?? "?"}M → Verkauf ${sell.sellFee}M (net ${sell.netCash}M) | P&L ${sell.pnlVsBuy ?? "?"}M [${tag}]`,
      );
    }
    console.log("");
  }

  // --- S2 PRESEASON ---
  console.log(`## S2 Preseason — Kauf-Lanes (Planner pickLane)\n`);
  if (!preseasonDiag) {
    console.log(`(preseason-batch-plan-vs-execute-season-2.json fehlt)\n`);
  } else {
    const allS2 = summarizeLaneCounts(
      (preseasonDiag.teams ?? []).flatMap((team) => team.plannedPicks ?? []),
    );
    console.log(
      `Liga Plan/Execute: preview=[${formatLaneCounts(
        Object.fromEntries((preseasonDiag.globalPreview?.laneDistribution ?? []).map((entry) => [entry.label, entry.count])),
      )}] execute=[${formatLaneCounts(
        Object.fromEntries((preseasonDiag.globalExecution?.laneDistribution ?? []).map((entry) => [entry.label, entry.count])),
      )}]\n`,
    );
    console.log(`Alle Teams zusammen: ${formatLaneCounts(allS2)}\n`);

    for (const code of focusTeams) {
      const team = preseasonDiag.teams?.find((entry) => entry.teamCode === code);
      if (!team) continue;
      const picks = (team.plannedPicks ?? []).filter((pick) => pick.status !== "skipped");
      if (picks.length === 0) {
        console.log(`### ${code} — keine S2-Käufe geplant/ausgeführt`);
        continue;
      }
      const lanes = summarizeLaneCounts(picks);
      const spent = round((team.cashBefore ?? 0) - (team.cashAfter ?? 0));
      console.log(
        `### ${code} — S2 Preseason | ${picks.length} Picks | Cash ${team.cashBefore ?? "?"}→${team.cashAfter ?? "?"} (investiert ~${spent}M) | Roster ${team.rosterBefore ?? "?"}→${team.rosterAfter ?? "?"}`,
      );
      console.log(`Lanes: ${formatLaneCounts(lanes)}`);
      for (const pick of picks) {
        const mw = pick.price ?? pick.marketValue ?? null;
        const purpose = pick.slotPurposeLabel ? ` | brief: ${pick.slotPurposeLabel}` : "";
        console.log(
          `  #${pick.step ?? "?"} ${pick.pickLane ?? pick.lane ?? "?"} → ${pick.playerName} (${mw ?? "?"}M)${purpose}`,
        );
      }
      console.log("");
    }
  }

  // --- Cash Investment summary ---
  console.log(`## Cash-Investition Ende S2 (Fokus-Teams)\n`);
  console.log("| Team | S1 Sell-Fees | S2 Buy-Fees | Cash Ende | GuV est. | Roster | Opt? |");
  console.log("|------|-------------|-------------|-----------|----------|--------|------|");
  const finalRows = JSON.parse(fs.readFileSync(path.join(runDir, "team-rows-after-preseason.json"), "utf8")) as Array<{
    teamCode: string;
    roster: number;
    playerOpt: number;
    cash: number;
    atOpt: boolean;
  }>;
  for (const code of focusTeams) {
    const row = finalRows.find((entry) => entry.teamCode === code);
    const econ = economyRows.find((entry) => entry.teamCode === code);
    if (!row) continue;
    console.log(
      `| ${code} | ${econ?.sellFeesS1 ?? "?"} | ${econ?.buyFeesS2 ?? "?"} | ${row.cash} | ${econ?.guvEstimate ?? "?"} | ${row.roster}/${row.playerOpt} | ${row.atOpt ? "ja" : "nein"} |`,
    );
  }

  const hoarding = finalRows
    .filter((row) => row.cash > 80 && !row.atOpt)
    .sort((a, b) => b.cash - a.cash)
    .slice(0, 8);
  if (hoarding.length > 0) {
    console.log(`\n### Cash-Hoarding (>80M, nicht Opt): ${hoarding.map((row) => `${row.teamCode}:${row.cash}M`).join(", ")}`);
  }

  const lowCash = finalRows
    .filter((row) => row.cash < 15)
    .sort((a, b) => a.cash - b.cash)
    .slice(0, 8);
  if (lowCash.length > 0) {
    console.log(`### Cash-knapp (<15M): ${lowCash.map((row) => `${row.teamCode}:${row.cash}M`).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
