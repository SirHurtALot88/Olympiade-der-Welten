/**
 * Diagnose S2-S5 preseason min/opt, contract lengths, buy/sell imbalance.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";

const ROOT = path.resolve(__dirname, "..");
const DB = path.join(ROOT, "outputs/s1-s5-transfer-2026-07-06T21-31-56/balancing-run.sqlite");
const SAVE_ID = "fresh-season-1-1783373516602";

function round(v: number, d = 2) {
  return Number(v.toFixed(d));
}

function rosterSnapshot(gameState: ReturnType<NonNullable<ReturnType<typeof createPersistenceService>["getSaveById"]>>["gameState"]) {
  const rows = gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((e) => e.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const roster = gameState.rosters.filter((e) => e.teamId === team.teamId).length;
    return {
      teamCode: team.shortCode ?? team.teamId,
      roster,
      playerMin,
      playerOpt,
      cash: round(team.cash ?? 0),
      atMin: roster >= playerMin,
      atOpt: roster >= playerOpt,
      gapToOpt: playerOpt - roster,
    };
  });
  return rows.sort((a, b) => a.teamCode.localeCompare(b.teamCode));
}

function contractStats(gameState: ReturnType<NonNullable<ReturnType<typeof createPersistenceService>["getSaveById"]>>["gameState"]) {
  const contractByPlayer = new Map(
    (gameState.contracts ?? []).map((c) => [`${c.teamId}:${c.playerId}`, c.remainingSeasons ?? c.length ?? null]),
  );
  const lengths: number[] = [];
  for (const entry of gameState.rosters) {
    const fromContract = contractByPlayer.get(`${entry.teamId}:${entry.playerId}`);
    const fromRoster = (entry as { contractLength?: number | null }).contractLength;
    const len = typeof fromContract === "number" ? fromContract : typeof fromRoster === "number" ? fromRoster : null;
    if (typeof len === "number" && Number.isFinite(len)) lengths.push(len);
  }
  const dist = new Map<number, number>();
  for (const len of lengths) dist.set(len, (dist.get(len) ?? 0) + 1);
  return {
    count: lengths.length,
    avg: lengths.length ? round(lengths.reduce((s, v) => s + v, 0) / lengths.length) : 0,
    expiringLe1: lengths.filter((v) => v <= 1).length,
    expiringLe2: lengths.filter((v) => v <= 2).length,
    dist: Object.fromEntries([...dist.entries()].sort((a, b) => a[0] - b[0])),
  };
}

async function main() {
  process.env.OLY_APP_SQLITE_PATH = DB;
  loadEnvConfig(ROOT);
  getDatabase();
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(SAVE_ID);
  if (!save) throw new Error("Save missing");

  const gs = save.gameState;
  console.log("\n=== Transfer counts per season ===");
  for (let i = 1; i <= 5; i += 1) {
    const sid = `season-${i}`;
    const transfers = gs.transferHistory.filter((e) => e.seasonId === sid);
    const buys = transfers.filter((e) => e.transferType === "buy");
    const sells = transfers.filter((e) => e.transferType === "sell");
    const bySource = (type: "buy" | "sell") => {
      const map = new Map<string, number>();
      for (const e of transfers.filter((x) => x.transferType === type)) {
        const src = e.source ?? "unknown";
        map.set(src, (map.get(src) ?? 0) + 1);
      }
      return Object.fromEntries(map);
    };
    console.log(
      `${sid}: buys=${buys.length} sells=${sells.length} buyFees=${round(buys.reduce((s, e) => s + (e.fee ?? 0), 0))} sellFees=${round(sells.reduce((s, e) => s + (e.fee ?? 0), 0))}`,
    );
    console.log("  buy sources:", bySource("buy"));
    console.log("  sell sources:", bySource("sell"));
  }

  console.log("\n=== Contract lengths (current end state, season-5 completed) ===");
  console.log(JSON.stringify(contractStats(gs), null, 2));

  console.log("\n=== Final roster min/opt (after all phases) ===");
  const finalRows = rosterSnapshot(gs);
  const underMin = finalRows.filter((r) => !r.atMin);
  const underOpt = finalRows.filter((r) => !r.atOpt);
  console.log(`Min: ${finalRows.filter((r) => r.atMin).length}/32 · Opt: ${finalRows.filter((r) => r.atOpt).length}/32`);
  if (underMin.length) console.log("Under MIN:", underMin);
  console.log("Under OPT (top 10 gaps):", underOpt.sort((a, b) => b.gapToOpt - a.gapToOpt).slice(0, 10));

  // Reconstruct roster BEFORE S5 preseason buys by undoing S5 buys/sells from history order
  console.log("\n=== S5 preseason: before vs after buys (reconstructed) ===");
  const s5PreBuySources = new Set([
    "ai_preseason_market_buy",
    "manual_transfer_window",
    "preseason_roster_repair_buy",
    "ai_roster_fill",
  ]);
  const s5PreseasonBuys = gs.transferHistory.filter(
    (e) => e.seasonId === "season-5" && e.transferType === "buy" && s5PreBuySources.has(e.source ?? ""),
  );
  const s5PreseasonSells = gs.transferHistory.filter(
    (e) => e.seasonId === "season-5" && e.transferType === "sell",
  );

  // Approximate roster before S5 preseason: current roster + sold players - bought players
  // Better: count per team from transfer net
  const teamById = new Map(gs.teams.map((t) => [t.teamId, t.shortCode ?? t.teamId]));
  const netByTeam = new Map<string, number>();
  for (const team of gs.teams) netByTeam.set(team.teamId, gs.rosters.filter((r) => r.teamId === team.teamId).length);

  for (const sell of s5PreseasonSells) {
    if (sell.fromTeamId) netByTeam.set(sell.fromTeamId, (netByTeam.get(sell.fromTeamId) ?? 0) + 1);
  }
  for (const buy of s5PreseasonBuys) {
    if (buy.toTeamId) netByTeam.set(buy.toTeamId, (netByTeam.get(buy.toTeamId) ?? 0) - 1);
  }

  let beforeMin = 0;
  let beforeOpt = 0;
  let afterMin = 0;
  let afterOpt = 0;
  const teamDetails: Array<Record<string, unknown>> = [];
  for (const team of gs.teams) {
    const identity = gs.teamIdentities.find((e) => e.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const before = netByTeam.get(team.teamId) ?? 0;
    const after = gs.rosters.filter((r) => r.teamId === team.teamId).length;
    if (before >= playerMin) beforeMin += 1;
    if (before >= playerOpt) beforeOpt += 1;
    if (after >= playerMin) afterMin += 1;
    if (after >= playerOpt) afterOpt += 1;
    const buys = s5PreseasonBuys.filter((b) => b.toTeamId === team.teamId).length;
    const sells = s5PreseasonSells.filter((s) => s.fromTeamId === team.teamId).length;
    if (before < playerMin || after < playerMin || before < playerOpt || buys > 0 || sells > 0) {
      teamDetails.push({
        team: team.shortCode,
        before,
        after,
        min: playerMin,
        opt: playerOpt,
        buys,
        sells,
        cash: round(team.cash ?? 0),
      });
    }
  }
  console.log(`S5 preseason BEFORE buys (reconstructed): min=${beforeMin}/32 opt=${beforeOpt}/32`);
  console.log(`S5 preseason AFTER buys: min=${afterMin}/32 opt=${afterOpt}/32`);
  console.log("Teams with activity or gaps:", teamDetails.sort((a, b) => String(a.team).localeCompare(String(b.team))));

  // Same for S2 preseason
  console.log("\n=== S2 preseason: before vs after (reconstructed) ===");
  const s2Buys = gs.transferHistory.filter((e) => e.seasonId === "season-2" && e.transferType === "buy");
  const s2Sells = gs.transferHistory.filter((e) => e.seasonId === "season-2" && e.transferType === "sell");
  const netS2 = new Map<string, number>();
  for (const team of gs.teams) {
    // start from current and walk back all S3-S5 transfers... too heavy; walk back S2 only from snapshot at S3 start
    netS2.set(team.teamId, gs.rosters.filter((r) => r.teamId === team.teamId).length);
  }
  // undo season 3-5 transfers
  for (const sid of ["season-5", "season-4", "season-3"]) {
    for (const sell of gs.transferHistory.filter((e) => e.seasonId === sid && e.transferType === "sell")) {
      if (sell.fromTeamId) netS2.set(sell.fromTeamId, (netS2.get(sell.fromTeamId) ?? 0) + 1);
    }
    for (const buy of gs.transferHistory.filter((e) => e.seasonId === sid && e.transferType === "buy")) {
      if (buy.toTeamId) netS2.set(buy.toTeamId, (netS2.get(buy.toTeamId) ?? 0) - 1);
    }
  }
  // undo S2 preseason (buys add back to seller side when undoing buy = remove buyer roster)
  for (const sell of s2Sells) {
    if (sell.fromTeamId) netS2.set(sell.fromTeamId, (netS2.get(sell.fromTeamId) ?? 0) + 1);
  }
  for (const buy of s2Buys) {
    if (buy.toTeamId) netS2.set(buy.toTeamId, (netS2.get(buy.toTeamId) ?? 0) - 1);
  }
  let s2BeforeMin = 0;
  let s2BeforeOpt = 0;
  const s2UnderMin: string[] = [];
  for (const team of gs.teams) {
    const identity = gs.teamIdentities.find((e) => e.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const before = netS2.get(team.teamId) ?? 0;
    if (before >= playerMin) s2BeforeMin += 1;
    else s2UnderMin.push(`${team.shortCode}:${before}/${playerMin}`);
    if (before >= playerOpt) s2BeforeOpt += 1;
  }
  // after S2 preseason = before S3
  const netS2After = new Map(netS2);
  for (const sell of s2Sells) {
    if (sell.fromTeamId) netS2After.set(sell.fromTeamId, (netS2After.get(sell.fromTeamId) ?? 0) - 1);
  }
  for (const buy of s2Buys) {
    if (buy.toTeamId) netS2After.set(buy.toTeamId, (netS2After.get(buy.toTeamId) ?? 0) + 1);
  }
  let s2AfterMin = 0;
  let s2AfterOpt = 0;
  const s2UnderMinAfter: string[] = [];
  for (const team of gs.teams) {
    const identity = gs.teamIdentities.find((e) => e.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const after = netS2After.get(team.teamId) ?? 0;
    if (after >= playerMin) s2AfterMin += 1;
    else s2UnderMinAfter.push(`${team.shortCode}:${after}/${playerMin}`);
    if (after >= playerOpt) s2AfterOpt += 1;
  }
  console.log(`S2 BEFORE preseason buys: min=${s2BeforeMin}/32 opt=${s2BeforeOpt}/32 underMin=${s2UnderMin.join(",") || "none"}`);
  console.log(`S2 AFTER preseason buys: min=${s2AfterMin}/32 opt=${s2AfterOpt}/32 underMin=${s2UnderMinAfter.join(",") || "none"}`);
  console.log(`S2 buys=${s2Buys.length} sells=${s2Sells.length}`);

  // Roster size trend at season starts (after each preseason)
  console.log("\n=== Avg roster / opt targets ===");
  const optSum = gs.teams.reduce((s, t) => {
    const id = gs.teamIdentities.find((e) => e.teamId === t.teamId);
    return s + deriveRosterTargets(t, id).playerOpt;
  }, 0);
  const minSum = gs.teams.reduce((s, t) => {
    const id = gs.teamIdentities.find((e) => e.teamId === t.teamId);
    return s + deriveRosterTargets(t, id).playerMin;
  }, 0);
  console.log(`League sum playerMin=${minSum} playerOpt=${optSum} avgOpt=${round(optSum / 32)} currentRoster=${gs.rosters.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
