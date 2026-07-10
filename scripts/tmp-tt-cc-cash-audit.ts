/**
 * Deep cash audit: T-T, C-C — sponsors, salary, transfers, prize per season.
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
const TEAMS = ["T-T", "C-C"];

function round(v: number, d = 2) {
  return Number(v.toFixed(d));
}

async function main() {
  process.env.OLY_APP_SQLITE_PATH = DB;
  loadEnvConfig(ROOT);
  getDatabase();
  const save = createPersistenceService().getSaveById(SAVE_ID);
  if (!save) throw new Error("save missing");
  const gs = save.gameState;
  const playerById = new Map(gs.players.map((p) => [p.id, p]));

  for (const code of TEAMS) {
    const team = gs.teams.find((t) => t.shortCode === code);
    if (!team) continue;
    const tid = team.teamId;
    const identity = gs.teamIdentities.find((e) => e.teamId === tid);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);

    console.log(`\n${"=".repeat(70)}\n${code} (${team.name}) — DEEP CASH AUDIT\n${"=".repeat(70)}`);
    console.log(`Budget (frozen S1): ${team.budget} · Cash NOW: ${round(team.cash ?? 0)} · MW NOW: roster below`);
    console.log(`Targets: min=${playerMin} opt=${playerOpt}`);

    const rosterNow = gs.rosters.filter((r) => r.teamId === tid);
    console.log(`\n--- Current roster (${rosterNow.length} players) ---`);
    let salaryNow = 0;
    let mwNow = 0;
    for (const r of rosterNow) {
      const p = playerById.get(r.playerId);
      const eco = resolvePlayerEconomyContract({ player: p, rosterEntry: r });
      const sal = r.salary ?? r.upkeep ?? eco.salary ?? 0;
      const mw = eco.marketValue ?? 0;
      salaryNow += sal;
      mwNow += mw;
      console.log(
        `  ${(p?.name ?? r.playerId).slice(0, 28).padEnd(28)} MW=${String(round(mw)).padStart(6)} Sal=${String(round(sal)).padStart(5)} contract=${r.contractLength ?? "?"}`,
      );
    }
    console.log(`  Σ MW=${round(mwNow)} Σ Salary=${round(salaryNow)}/season`);

    console.log(`\n--- Sponsor payouts by season ---`);
    const sponsorLogs = (gs.seasonState.sponsorPayoutLogs ?? []).filter((l) => l.teamId === tid);
    for (let i = 1; i <= 5; i++) {
      const sid = `season-${i}`;
      const rows = sponsorLogs.filter((l) => l.seasonId === sid);
      const net = round(rows.reduce((s, l) => s + (l.cashDelta ?? 0), 0));
      const detail = rows.map((l) => `${l.componentId ?? l.phase}:${l.cashDelta}`).join(", ");
      console.log(`  ${sid}: net=${net} (${detail || "none"})`);
    }
    console.log(`  Σ sponsor all seasons: ${round(sponsorLogs.reduce((s, l) => s + (l.cashDelta ?? 0), 0))}`);

    console.log(`\n--- Prize money (applied) ---`);
    const prizeLogs = (gs.seasonState.cashPrizeApplyLogs ?? []).filter((l) => l.teamId === tid);
    if (prizeLogs.length === 0) console.log("  NONE APPLIED (cashPrizeApplyLogs empty for this team)");
    else {
      for (const l of prizeLogs) console.log(`  ${l.seasonId}: ${(l as { prizeMoney?: number }).prizeMoney ?? l.cashDelta}`);
    }

    console.log(`\n--- Transfers by season ---`);
    for (let i = 1; i <= 5; i++) {
      const sid = `season-${i}`;
      const txs = gs.transferHistory.filter(
        (e) => e.seasonId === sid && (e.fromTeamId === tid || e.toTeamId === tid),
      );
      const buys = txs.filter((e) => e.transferType === "buy" && e.toTeamId === tid);
      const sells = txs.filter((e) => e.transferType === "sell" && e.fromTeamId === tid);
      const buyFees = round(buys.reduce((s, e) => s + (e.fee ?? 0), 0));
      const sellFees = round(sells.reduce((s, e) => s + (e.fee ?? 0), 0));
      console.log(`\n  ${sid}: buys=${buys.length} (-${buyFees}) sells=${sells.length} (+${sellFees}) net=${round(sellFees - buyFees)}`);
      for (const s of sells) {
        console.log(
          `    SELL ${(s.playerName ?? s.playerId).slice(0, 24).padEnd(24)} fee=${round(s.fee ?? 0)} MW=${round(s.marketValue ?? 0)} src=${s.source}`,
        );
      }
      for (const b of buys) {
        console.log(
          `    BUY  ${(b.playerName ?? b.playerId).slice(0, 24).padEnd(24)} fee=${round(b.fee ?? 0)} MW=${round(b.marketValue ?? 0)} src=${b.source}`,
        );
      }
    }

    const allBuys = gs.transferHistory.filter((e) => e.toTeamId === tid && e.transferType === "buy");
    const allSells = gs.transferHistory.filter((e) => e.fromTeamId === tid && e.transferType === "sell");
    const totalBuy = round(allBuys.reduce((s, e) => s + (e.fee ?? 0), 0));
    const totalSell = round(allSells.reduce((s, e) => s + (e.fee ?? 0), 0));
    const totalSponsor = round(sponsorLogs.reduce((s, l) => s + (l.cashDelta ?? 0), 0));

    console.log(`\n--- Cash flow summary (approximate) ---`);
    console.log(`  Start budget (S1): ~${team.budget ?? "?"} (fresh save)`);
    console.log(`  Σ buy fees: -${totalBuy}`);
    console.log(`  Σ sell fees: +${totalSell}`);
    console.log(`  Σ sponsor net: ${totalSponsor}`);
    console.log(`  Σ prize: 0 (not applied in pipeline)`);
    console.log(`  Implied cash ≈ budget - buys + sells + sponsor = ${round((team.budget ?? 0) - totalBuy + totalSell + totalSponsor)}`);
    console.log(`  Actual cash now: ${round(team.cash ?? 0)}`);

    // S4 sells detail
    const s4sells = gs.transferHistory.filter(
      (e) => e.seasonId === "season-4" && e.fromTeamId === tid && e.transferType === "sell",
    );
    if (s4sells.length) {
      console.log(`\n--- S4 season_end sells (the "4 players ~20M" question) ---`);
      for (const s of s4sells) {
        const p = playerById.get(s.playerId);
        const eco = p ? resolvePlayerEconomyContract({ player: p, rosterEntry: null }) : null;
        console.log(
          `  ${s.playerName ?? s.playerId}: fee=${round(s.fee ?? 0)} transferMW=${round(s.marketValue ?? 0)} salary=${round(s.salary ?? 0)} remainingContract=${s.remainingContractLength}`,
        );
      }
      console.log(`  Total S4 sell fees: ${round(s4sells.reduce((s, e) => s + (e.fee ?? 0), 0))}`);
    }
  }

  console.log(`\n${"=".repeat(70)}\nLEAGUE: teams with negative cash NOW\n${"=".repeat(70)}`);
  const neg = gs.teams.filter((t) => (t.cash ?? 0) < 0).sort((a, b) => (a.cash ?? 0) - (b.cash ?? 0));
  for (const t of neg) {
    const roster = gs.rosters.filter((r) => r.teamId === t.teamId).length;
    console.log(`  ${t.shortCode}: cash=${round(t.cash ?? 0)} roster=${roster}`);
  }
  console.log(`Total negative-cash teams: ${neg.length}/32`);

  console.log(`\nPipeline prize apply: ${(gs.seasonState.cashPrizeApplyLogs ?? []).length} logs league-wide`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
