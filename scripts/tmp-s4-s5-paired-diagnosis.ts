/**
 * Pair S4 season_end → S5 preseason: cash, roster, MW, sponsor per team.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";

const ROOT = path.resolve(__dirname, "..");
const DB = path.join(ROOT, "outputs/s1-s5-transfer-2026-07-06T21-31-56/balancing-run.sqlite");
const SAVE_ID = "fresh-season-1-1783373516602";

function round(v: number, d = 2) {
  return Number(v.toFixed(d));
}

async function main() {
  process.env.OLY_APP_SQLITE_PATH = DB;
  loadEnvConfig(ROOT);
  getDatabase();
  const p = createPersistenceService();
  const save = p.getSaveById(SAVE_ID);
  if (!save) throw new Error("save missing");
  const gs = save.gameState;

  const playerById = new Map(gs.players.map((pl) => [pl.id, pl]));

  function teamMw(teamId: string) {
    return round(
      gs.rosters
        .filter((r) => r.teamId === teamId)
        .reduce((sum, r) => {
          const pl = playerById.get(r.playerId);
          const eco = resolvePlayerEconomyContract({ player: pl, rosterEntry: r });
          return sum + (eco.marketValue ?? 0);
        }, 0),
    );
  }

  // Reconstruct per-team state before/after S4 season_end and before/after S5 preseason
  type Snap = { roster: number; cash: number; mw: number; min: number; opt: number; gap: number };

  function snapAt(teamId: string, rosterOverride?: number, cashOverride?: number): Snap {
    const team = gs.teams.find((t) => t.teamId === teamId)!;
    const id = gs.teamIdentities.find((e) => e.teamId === teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, id);
    const roster =
      rosterOverride ??
      gs.rosters.filter((r) => r.teamId === teamId).length;
    const cash = cashOverride ?? round(team.cash ?? 0);
    return { roster, cash, mw: teamMw(teamId), min: playerMin, opt: playerOpt, gap: playerOpt - roster };
  }

  // Net S4 season_end sells and S5 preseason buys per team from history
  const s4Sells = gs.transferHistory.filter((e) => e.seasonId === "season-4" && e.transferType === "sell");
  const s5Buys = gs.transferHistory.filter((e) => e.seasonId === "season-5" && e.transferType === "buy");
  const s5Sells = gs.transferHistory.filter((e) => e.seasonId === "season-5" && e.transferType === "sell");

  // Walk back from final state through S5 season_end sells, then S5 preseason, etc.
  const netRoster = new Map<string, number>();
  const netCash = new Map<string, number>();
  for (const team of gs.teams) {
    netRoster.set(team.teamId, gs.rosters.filter((r) => r.teamId === team.teamId).length);
    netCash.set(team.teamId, team.cash ?? 0);
  }

  // Undo S5 season_end
  for (const sell of s5Sells) {
    if (sell.fromTeamId) {
      netRoster.set(sell.fromTeamId, (netRoster.get(sell.fromTeamId) ?? 0) + 1);
      netCash.set(sell.fromTeamId, (netCash.get(sell.fromTeamId) ?? 0) - (sell.fee ?? 0));
    }
  }

  const afterS5Preseason = new Map(netRoster);
  const cashAfterS5Pre = new Map(netCash);

  // Undo S5 preseason buys
  for (const buy of s5Buys) {
    if (buy.toTeamId) {
      netRoster.set(buy.toTeamId, (netRoster.get(buy.toTeamId) ?? 0) - 1);
      netCash.set(buy.toTeamId, (netCash.get(buy.toTeamId) ?? 0) + (buy.fee ?? 0));
    }
  }
  const beforeS5Preseason = new Map(netRoster);
  const cashBeforeS5Pre = new Map(netCash);

  // Undo S4→S5 transition effects approximated: S4 season_end sells only (season-4)
  for (const sell of s4Sells) {
    if (sell.fromTeamId) {
      netRoster.set(sell.fromTeamId, (netRoster.get(sell.fromTeamId) ?? 0) + 1);
      netCash.set(sell.fromTeamId, (netCash.get(sell.fromTeamId) ?? 0) - (sell.fee ?? 0));
    }
  }
  const beforeS4SeasonEnd = new Map(netRoster);
  const cashBeforeS4End = new Map(netCash);

  // Sponsor logs
  const sponsorByTeamSeason = new Map<string, number>();
  for (const log of gs.seasonState.sponsorPayoutLogs ?? []) {
    const key = `${log.seasonId}:${log.teamId}:${log.phase ?? ""}`;
    sponsorByTeamSeason.set(key, (sponsorByTeamSeason.get(key) ?? 0) + (log.cashDelta ?? 0));
  }

  console.log("\n=== S4 END → S5 PRESEASON (paired per team) ===\n");
  console.log(
    "Team | Roster S4pre→S4post→S5pre | Cash S4pre→S4post→S5pre | OptGap S4post | S4 sells | S5 buys | estGapCost | affordable?",
  );

  const rows: Array<Record<string, unknown>> = [];
  for (const team of [...gs.teams].sort((a, b) => (a.shortCode ?? "").localeCompare(b.shortCode ?? ""))) {
    const tid = team.teamId;
    const code = team.shortCode ?? tid;
    const id = gs.teamIdentities.find((e) => e.teamId === tid);
    const { playerOpt } = deriveRosterTargets(team, id);
    const r0 = beforeS4SeasonEnd.get(tid) ?? 0;
    const r1 = beforeS5Preseason.get(tid) ?? 0;
    const r2 = afterS5Preseason.get(tid) ?? 0;
    const c0 = round(cashBeforeS4End.get(tid) ?? 0);
    const c1 = round(cashBeforeS5Pre.get(tid) ?? 0);
    const c2 = round(cashAfterS5Pre.get(tid) ?? 0);
    const gapAfterS4Sell = playerOpt - r1;
    const estGapCost = round(Math.max(0, gapAfterS4Sell) * 17); // ~17M mid backup
    const sells4 = s4Sells.filter((s) => s.fromTeamId === tid);
    const buys5 = s5Buys.filter((b) => b.toTeamId === tid);
    const sellFees4 = round(sells4.reduce((s, e) => s + (e.fee ?? 0), 0));
    const affordable = c1 >= estGapCost * 0.5 ? "maybe" : c1 >= 15 ? "tight" : "NO";
    rows.push({ code, r0, r1, r2, c0, c1, c2, gapAfterS4Sell, estGapCost, sellFees4, buys5: buys5.length, affordable });
    console.log(
      `${code.padEnd(4)} | ${String(r0).padStart(2)}→${String(r1).padStart(2)}→${String(r2).padStart(2)} | ${String(c0).padStart(6)}→${String(c1).padStart(6)}→${String(c2).padStart(6)} | gap=${String(gapAfterS4Sell).padStart(2)} | s4s=${sells4.length} fee=${sellFees4} | s5b=${buys5.length} | need~${estGapCost} | ${affordable}`,
    );
  }

  console.log("\n=== Prize apply logs ===");
  console.log("cashPrizeApplyLogs count:", (gs.seasonState.cashPrizeApplyLogs ?? []).length);
  for (let i = 1; i <= 5; i++) {
    const sid = `season-${i}`;
    const prize = (gs.seasonState.cashPrizeApplyLogs ?? [])
      .filter((l) => l.seasonId === sid)
      .reduce((s, l) => s + ((l as { prizeMoney?: number; cashDelta?: number }).prizeMoney ?? (l as { cashDelta?: number }).cashDelta ?? 0), 0);
    console.log(`${sid} prizeApplied=${round(prize)}`);
  }

  console.log("\n=== Sponsor / Prize per season (league sum) ===");
  for (let i = 1; i <= 5; i++) {
    const sid = `season-${i}`;
    const sponsorEnd = gs.seasonState.sponsorPayoutLogs
      ?.filter((l) => l.seasonId === sid && l.phase === "season_end")
      .reduce((s, l) => s + (l.cashDelta ?? 0), 0) ?? 0;
    const sponsorPre = gs.seasonState.sponsorPayoutLogs
      ?.filter((l) => l.seasonId === sid && l.phase === "preseason")
      .reduce((s, l) => s + (l.cashDelta ?? 0), 0) ?? 0;
    console.log(`${sid}: sponsor season_end=${round(sponsorEnd)} preseason=${round(sponsorPre)}`);
  }

  console.log("\n=== League totals: cash + MW trend (current = after S5 season_end) ===");
  let totalCash = 0;
  let totalMw = 0;
  for (const team of gs.teams) {
    totalCash += team.cash ?? 0;
    totalMw += teamMw(team.teamId);
  }
  console.log(`Final: cash Σ=${round(totalCash)} MW Σ=${round(totalMw)} roster Σ=${gs.rosters.length}`);

  // S1 draft end approx from first transfers
  const s1DraftSpend = gs.transferHistory
    .filter((e) => e.seasonId === "season-1" && e.transferType === "buy")
    .reduce((s, e) => s + (e.fee ?? 0), 0);
  console.log(`S1 draft buy fees Σ=${round(s1DraftSpend)}`);

  const unaffordable = rows.filter((r) => r.affordable === "NO" && (r.gapAfterS4Sell as number) > 0);
  console.log(`\nTeams after S4 sell with opt gap but cash likely insufficient for gap: ${unaffordable.length}`);
  for (const r of unaffordable.slice(0, 12)) {
    console.log(`  ${r.code}: cash=${r.c1} gap=${r.gapAfterS4Sell} need~${r.estGapCost} s4sells=${r.sellFees4}`);
  }

  // Salary vs sponsor net per team S4
  console.log("\n=== Sample teams: salary vs sponsor S4 season_end ===");
  for (const code of ["T-T", "C-C", "W-L", "M-M", "B-B"]) {
    const team = gs.teams.find((t) => t.shortCode === code);
    if (!team) continue;
    const salary = round(
      gs.rosters
        .filter((r) => r.teamId === team.teamId)
        .reduce((s, r) => s + (r.salary ?? r.upkeep ?? 0), 0),
    );
    const sponsorS4 = round(
      (gs.seasonState.sponsorPayoutLogs ?? [])
        .filter((l) => l.seasonId === "season-4" && l.teamId === team.teamId)
        .reduce((s, l) => s + (l.cashDelta ?? 0), 0),
    );
    console.log(`${code}: salary=${salary} sponsorNet S4=${sponsorS4} cashNow=${round(team.cash ?? 0)} mw=${teamMw(team.teamId)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
