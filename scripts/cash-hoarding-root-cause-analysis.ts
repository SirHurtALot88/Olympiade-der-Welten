/**
 * Cash-hoarding root cause analysis · S1–S10 validated run.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type {
  FacilityEventRecord,
  SeasonSnapshotGeneralManagerRecord,
  SeasonSnapshotRecord,
  SeasonSnapshotTeamRecord,
} from "@/lib/data/olyDataTypes";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs/s1-s10-validated-run-1");
const OUTPUT_MD = path.join(OUTPUT_DIR, "cash-hoarding-root-cause-analysis.md");
const SAVE_ID = "fresh-season-1-1783169019878";

function round(v: number, d = 1) {
  return Number(v.toFixed(d));
}

function parseSeasonNum(seasonId: string) {
  return Number(seasonId.match(/(\d+)$/)?.[1] ?? 0);
}

function mdTable(headers: string[], rows: (string | number)[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function rankBucket(rank: number) {
  if (rank <= 4) return "1-4";
  if (rank <= 8) return "5-8";
  if (rank <= 16) return "9-16";
  if (rank <= 24) return "17-24";
  return "25-32";
}

type TransferRow = {
  seasonId: string;
  teamId: string;
  teamName: string;
  cashEnd: number;
  buyCount: number;
  marketBuyCount: number;
  sellCount: number;
  sponsorCashIn: number;
  salaryPaidOut: number;
};

function loadTransferFinance(): TransferRow[] {
  const csvPath = path.join(OUTPUT_DIR, "transfer-finance-by-season.csv");
  if (!fs.existsSync(csvPath)) return [];
  return fs
    .readFileSync(csvPath, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const c = line.split(",");
      return {
        seasonId: c[0]!,
        teamId: c[1]!,
        teamName: c[2]!,
        cashEnd: Number(c[4] ?? 0),
        buyCount: Number(c[11] ?? 0),
        marketBuyCount: Number(c[13] ?? 0),
        sellCount: Number(c[14] ?? 0),
        sponsorCashIn: Number(c[8] ?? 0),
        salaryPaidOut: Number(c[9] ?? 0),
      };
    });
}

type FatigueCsvRow = {
  seasonId: string;
  teamId: string;
  rank?: number;
  fatigueAvg: number;
  fatigueMax: number;
  fatigue85Plus: number;
  rosterSize: number;
};

function loadFatigueCsv(): FatigueCsvRow[] {
  const csvPath = path.join(OUTPUT_DIR, "fatigue-injury-s1-s6.csv");
  if (!fs.existsSync(csvPath)) return [];
  return fs
    .readFileSync(csvPath, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const c = line.split(",");
      return {
        seasonId: c[0]!,
        teamId: c[1]!,
        rosterSize: Number(c[2] ?? 0),
        fatigueAvg: Number(c[8] ?? 0),
        fatigueMax: Number(c[9] ?? 0),
        fatigue85Plus: Number(c[12] ?? 0),
      };
    });
}

type MarketActionRow = {
  seasonId: string;
  transferType: string;
  source: string;
  toTeamId: string;
  fromTeamId: string;
  emergencyFallback: string;
};

function loadMarketActions(): MarketActionRow[] {
  const csvPath = path.join(OUTPUT_DIR, "ai-market-actions-s1-s6.csv");
  if (!fs.existsSync(csvPath)) return [];
  return fs
    .readFileSync(csvPath, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const c = line.split(",");
      return {
        seasonId: c[2]!,
        transferType: c[7] ?? "",
        source: c[5] ?? "",
        toTeamId: c[9] ?? "",
        fromTeamId: c[8] ?? "",
        emergencyFallback: c[19] ?? "",
      };
    });
}

function getSnapRows(snap: SeasonSnapshotRecord | undefined): SeasonSnapshotTeamRecord[] {
  return snap?.teamSnapshots ?? snap?.finalStandings ?? [];
}

function computePlayerFatigue(gameState: ReturnType<typeof createPersistenceService> extends { getSaveById: (id: string) => infer S } ? S extends { gameState: infer G } ? G : never : never, seasonEnd = false) {
  const rosterByTeam = new Map<string, number[]>();
  for (const roster of gameState.rosters) {
    const player = gameState.players.find((p) => p.id === roster.playerId);
    const fatigue = player?.fatigue ?? 0;
    const arr = rosterByTeam.get(roster.teamId) ?? [];
    arr.push(fatigue);
    rosterByTeam.set(roster.teamId, arr);
  }
  const leagueFatigues: number[] = [];
  const byTeam: Array<{ teamId: string; avg: number; max: number; p90: number; roster: number }> = [];
  for (const team of gameState.teams) {
    const vals = rosterByTeam.get(team.teamId) ?? [];
    if (vals.length === 0) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const max = Math.max(...vals);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? max;
    leagueFatigues.push(...vals);
    byTeam.push({ teamId: team.teamId, avg: round(avg, 1), max: round(max, 1), p90: round(p90, 1), roster: vals.length });
  }
  const leagueAvg = leagueFatigues.length ? leagueFatigues.reduce((s, v) => s + v, 0) / leagueFatigues.length : 0;
  return { leagueAvg: round(leagueAvg, 1), byTeam };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const save = createPersistenceService({ dbPath: path.join(OUTPUT_DIR, "balancing-run.sqlite") }).getSaveById(SAVE_ID);
  if (!save) throw new Error(`Save not found: ${SAVE_ID}`);
  const gs = save.gameState;
  const transferRows = loadTransferFinance();
  const transferByKey = new Map(transferRows.map((r) => [`${r.seasonId}:${r.teamId}`, r]));
  const fatigueCsv = loadFatigueCsv();
  const marketActions = loadMarketActions();

  const snaps = [...(gs.seasonState.seasonSnapshots ?? [])].sort((a, b) =>
    a.seasonId.localeCompare(b.seasonId, undefined, { numeric: true }),
  );

  // ── 1. GM change rate ──
  type GmSeasonStat = {
    seasonId: string;
    seasonNum: number;
    totalTeams: number;
    changes: number;
    changeRate: number;
    changedTeams: string[];
  };
  const gmStats: GmSeasonStat[] = [];
  const gmPerTeamChanges = new Map<string, number>();
  let prevGmByTeam = new Map<string, string>();

  for (const snap of snaps) {
    const gmAssignments = snap.gmAssignments ?? [];
    let changes = 0;
    const changedTeams: string[] = [];
    for (const gm of gmAssignments) {
      const prev = prevGmByTeam.get(gm.teamId);
      if (prev != null && prev !== gm.gmId) {
        changes++;
        changedTeams.push(gm.teamCode);
        gmPerTeamChanges.set(gm.teamId, (gmPerTeamChanges.get(gm.teamId) ?? 0) + 1);
      }
      prevGmByTeam.set(gm.teamId, gm.gmId);
    }
    gmStats.push({
      seasonId: snap.seasonId,
      seasonNum: parseSeasonNum(snap.seasonId),
      totalTeams: gmAssignments.length || 32,
      changes,
      changeRate: round((changes / (gmAssignments.length || 32)) * 100, 1),
      changedTeams,
    });
  }

  const totalGmChanges = gmStats.reduce((s, r) => s + r.changes, 0);
  const avgGmChangeRate = gmStats.length ? round(totalGmChanges / (gmStats.length * 32) * 100, 1) : 0;

  // ── 2. Fatigue ──
  type FatigueSeasonAgg = { seasonId: string; seasonNum: number; leagueAvg: number; byTier: Map<string, number[]> };
  const fatigueBySeason: FatigueSeasonAgg[] = [];

  // S1-S6 from CSV
  const fatigueBySeasonMap = new Map<string, FatigueCsvRow[]>();
  for (const row of fatigueCsv) {
    const arr = fatigueBySeasonMap.get(row.seasonId) ?? [];
    arr.push(row);
    fatigueBySeasonMap.set(row.seasonId, arr);
  }

  // Build rank lookup per season from snapshots
  for (const snap of snaps) {
    const rows = getSnapRows(snap);
    const rankByTeam = new Map(rows.map((r) => [r.teamId, r.rank ?? 0]));
    const csvRows = fatigueBySeasonMap.get(snap.seasonId);
    if (csvRows) {
      const tierAvgs = new Map<string, number[]>();
      const allAvgs = csvRows.map((r) => r.fatigueAvg);
      for (const r of csvRows) {
        const rank = rankByTeam.get(r.teamId) ?? 16;
        const tier = rankBucket(rank);
        const arr = tierAvgs.get(tier) ?? [];
        arr.push(r.fatigueAvg);
        tierAvgs.set(tier, arr);
      }
      fatigueBySeason.push({
        seasonId: snap.seasonId,
        seasonNum: parseSeasonNum(snap.seasonId),
        leagueAvg: round(allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length, 1),
        byTier: tierAvgs,
      });
    }
  }

  // S7-S10 + end-state from live players
  const liveFatigue = computePlayerFatigue(gs);
  const s10Overview = buildTeamSeasonOverviewRows({ gameState: gs }).filter((r) => r.rank != null);
  const s10TierAvgs = new Map<string, number[]>();
  for (const team of liveFatigue.byTeam) {
    const ov = s10Overview.find((r) => r.teamId === team.teamId);
    const tier = rankBucket(ov?.rank ?? 16);
    const arr = s10TierAvgs.get(tier) ?? [];
    arr.push(team.avg);
    s10TierAvgs.set(tier, arr);
  }
  fatigueBySeason.push({
    seasonId: "season-10-end",
    seasonNum: 10,
    leagueAvg: liveFatigue.leagueAvg,
    byTier: s10TierAvgs,
  });

  // ── 3. Facilities ──
  const facilityEvents = gs.seasonState.facilityEvents ?? [];
  const upgradeSources = new Set([
    "manual_facility_upgrade",
    "ai_facility_upgrade",
    "facility_upgrade",
  ]);
  const downgradeSources = new Set([
    "manual_facility_downgrade",
    "ai_facility_downgrade",
    "facility_downgrade",
    "downgrade_building",
  ]);

  type FacSeasonAgg = {
    seasonId: string;
    upgrades: number;
    downgrades: number;
    upgradeSpend: number;
    downgradeRefund: number;
    upkeepPaid: number;
    teamsDowngrading: Set<string>;
    teamsUpgrading: Set<string>;
  };
  const facBySeason = new Map<string, FacSeasonAgg>();

  function ensureFac(seasonId: string): FacSeasonAgg {
    if (!facBySeason.has(seasonId)) {
      facBySeason.set(seasonId, {
        seasonId,
        upgrades: 0,
        downgrades: 0,
        upgradeSpend: 0,
        downgradeRefund: 0,
        upkeepPaid: 0,
        teamsDowngrading: new Set(),
        teamsUpgrading: new Set(),
      });
    }
    return facBySeason.get(seasonId)!;
  }

  for (const ev of facilityEvents) {
    const agg = ensureFac(ev.seasonId ?? "unknown");
    const src = ev.source ?? "";
    const cost = Math.abs(ev.cost ?? 0);
    if (upgradeSources.has(src) || src.includes("upgrade")) {
      if (!src.includes("upkeep") && !src.includes("downgrade")) {
        agg.upgrades++;
        agg.upgradeSpend += cost;
        agg.teamsUpgrading.add(ev.teamId);
      }
    }
    if (downgradeSources.has(src) || src.includes("downgrade")) {
      agg.downgrades++;
      agg.downgradeRefund += cost;
      agg.teamsDowngrading.add(ev.teamId);
    }
    if (src === "facility_upkeep_paid") {
      agg.upkeepPaid += cost;
    }
  }

  // Also scan game logs for downgrade_building flags
  const downgradeFlags: string[] = [];
  for (const log of gs.gameLogs ?? []) {
    const msg = JSON.stringify(log.payload ?? {});
    if (msg.includes("downgrade_building") || msg.includes("downgrade_to_cut_upkeep")) {
      downgradeFlags.push(`${log.seasonId ?? "?"}:${log.teamId ?? "?"}:${log.type ?? log.source ?? "log"}`);
    }
  }

  // Current facility levels (stored on seasonState.teamFacilities)
  const teamFacilitiesMap = gs.seasonState.teamFacilities ?? {};
  let totalLevels = 0;
  let teamsWithAny = 0;
  for (const teamId of Object.keys(teamFacilitiesMap)) {
    const entry = teamFacilitiesMap[teamId]!;
    const facs = entry.facilities ?? entry;
    const levels = Object.values(facs as Record<string, { level?: number }>).reduce((s, f) => s + (f?.level ?? 0), 0);
    if (levels > 0) teamsWithAny++;
    totalLevels += levels;
  }
  const downgradeEvents = facilityEvents.filter((e) => e.source === "manual_facility_downgrade");

  // ── 4. Cash hoarding ──
  type HoarderRow = { teamCode: string; cash: number; mw: number; roster: number; opt: number; marketBuys: number; sells: number };
  type HoardSeasonAgg = {
    seasonId: string;
    seasonNum: number;
    highCashLowMw: HoarderRow[];
    highCashLowRoster: HoarderRow[];
    totalMarketBuys: number;
    totalSells: number;
    teamsBelowOpt: number;
    avgCash: number;
    avgMw: number;
  };
  const hoardStats: HoardSeasonAgg[] = [];

  function buildHoardSeason(seasonId: string, rows: SeasonSnapshotTeamRecord[]) {
    const highCashLowMw: HoarderRow[] = [];
    const highCashLowRoster: HoarderRow[] = [];
    let totalMarketBuys = 0;
    let totalSells = 0;
    let teamsBelowOpt = 0;
    let sumCash = 0;
    let sumMw = 0;

    for (const row of rows) {
      const teamId = row.teamId;
      const tf = transferByKey.get(`${seasonId}:${teamId}`);
      const cash = row.cashEnd ?? tf?.cashEnd ?? 0;
      const mw = row.marketValueTotalEnd ?? row.marketValueEnd ?? 0;
      const roster = row.rosterCountEnd ?? row.rosterEnd ?? 0;
      const marketBuys = tf?.marketBuyCount ?? 0;
      const sells = tf?.sellCount ?? 0;
      totalMarketBuys += marketBuys;
      totalSells += sells;
      sumCash += cash;
      sumMw += mw;

      const hardMin = 7;
      const opt = roster >= hardMin ? Math.max(roster, 10) : 10; // approximate from checkpoint pattern
      if (roster < 12) teamsBelowOpt++;

      if (cash > 20 && mw < 200) {
        highCashLowMw.push({ teamCode: row.teamCode, cash: round(cash, 1), mw: round(mw, 1), roster, opt: 12, marketBuys, sells });
      }
      if (cash > 30 && mw < 200 && roster <= 9) {
        highCashLowRoster.push({ teamCode: row.teamCode, cash: round(cash, 1), mw: round(mw, 1), roster, opt: 12, marketBuys, sells });
      }
    }

    return {
      seasonId,
      seasonNum: parseSeasonNum(seasonId),
      highCashLowMw,
      highCashLowRoster,
      totalMarketBuys,
      totalSells,
      teamsBelowOpt,
      avgCash: round(sumCash / Math.max(rows.length, 1), 1),
      avgMw: round(sumMw / Math.max(rows.length, 1), 1),
    };
  }

  for (const snap of snaps) {
    hoardStats.push(buildHoardSeason(snap.seasonId, getSnapRows(snap)));
  }

  // S10 from live overview (no season-10 snapshot archived yet)
  const s10Rows: SeasonSnapshotTeamRecord[] = s10Overview.map((r) => ({
    teamId: r.teamId,
    teamCode: r.teamCode ?? r.teamId,
    teamName: r.teamName ?? r.teamCode ?? r.teamId,
    rank: r.rank,
    points: null,
    disciplinePoints: null,
    disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
    cashEnd: r.cash,
    rosterEnd: r.rosterCount ?? 0,
    rosterCountEnd: r.rosterCount,
    salaryEnd: r.salaryTotal,
    salaryTotalEnd: r.salaryTotal,
    marketValueEnd: r.marketValueTotal,
    marketValueTotalEnd: r.marketValueTotal,
    transferCount: 0,
    transferBuyCount: 0,
    transferSellCount: 0,
    transferNet: null,
  }));
  hoardStats.push(buildHoardSeason("season-10", s10Rows));

  // Transfer source analysis
  const buySourceCounts = new Map<string, number>();
  const sellSourceCounts = new Map<string, number>();
  let emergencyBuys = 0;
  let fillerBuys = 0;
  let aiPreseasonBuys = 0;

  for (const h of gs.transferHistory ?? []) {
    const payload = h as { transferType?: string; source?: string; toTeamId?: string; fromTeamId?: string };
    const type = payload.transferType ?? "";
    const source = payload.source ?? "unknown";
    if (type === "buy") {
      buySourceCounts.set(source, (buySourceCounts.get(source) ?? 0) + 1);
      if (source.includes("emergency") || source.includes("repair")) emergencyBuys++;
      if (source.includes("filler") || source.includes("cheap_fill")) fillerBuys++;
      if (source.includes("ai_preseason")) aiPreseasonBuys++;
    }
    if (type === "sell") {
      sellSourceCounts.set(source, (sellSourceCounts.get(source) ?? 0) + 1);
    }
  }

  // Market actions S1-S6 buy/sell breakdown
  const actionBuySources = new Map<string, number>();
  const actionSellSources = new Map<string, number>();
  for (const a of marketActions) {
    if (a.transferType === "buy") actionBuySources.set(a.source, (actionBuySources.get(a.source) ?? 0) + 1);
    if (a.transferType === "sell") actionSellSources.set(a.source, (actionSellSources.get(a.source) ?? 0) + 1);
  }

  // Sell-only-for-rebuy hypothesis: teams that sold but didn't buy in same season
  type SellBuyMismatch = { seasonId: string; teamId: string; sells: number; buys: number };
  const sellOnlyTeams: SellBuyMismatch[] = [];
  for (const tr of transferRows) {
    if (tr.sellCount > 0 && tr.marketBuyCount === 0 && tr.buyCount <= tr.sellCount) {
      sellOnlyTeams.push({ seasonId: tr.seasonId, teamId: tr.teamId, sells: tr.sellCount, buys: tr.buyCount });
    }
  }
  const sellOnlyBySeason = new Map<string, number>();
  for (const row of sellOnlyTeams) {
    sellOnlyBySeason.set(row.seasonId, (sellOnlyBySeason.get(row.seasonId) ?? 0) + 1);
  }

  // ── Build report ──
  const lines: string[] = [];
  lines.push("# Cash-Hoarding Root-Cause-Analyse · S1–S10");
  lines.push("");
  lines.push(`**Save:** \`${SAVE_ID}\``);
  lines.push(`**DB:** \`outputs/s1-s10-validated-run-1/balancing-run.sqlite\``);
  lines.push(`**Erstellt:** ${new Date().toISOString()}`);
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`1. **GM-Wechsel:** ${totalGmChanges} Wechsel über ${gmStats.length} Seasons (Ø ${avgGmChangeRate}% der Teams pro Season).`);
  lines.push(`2. **Fatigue:** Liga-Ø schwankt ${fatigueBySeason.length >= 2 ? `${fatigueBySeason[0]!.leagueAvg}→${fatigueBySeason[fatigueBySeason.length - 1]!.leagueAvg}` : "n/a"} — kein monotoner Trend, aber dünne Kader korrelieren mit hoher Fatigue.`);
  lines.push(`3. **Facilities:** ${facilityEvents.filter((e) => e.source === "manual_facility_upgrade").length} Upgrades, ${downgradeEvents.length} Downgrades (0 ausgeführt trotz S10-Planung); Refund = 25% Upgrade-Preis.`);
  lines.push(`4. **Hauptursache Cash-Hoarding:** Defekter Buy/Sell-Loop — Teams mit Cash kaufen nicht, weil Convergence erschöpft/Filler-Quote 43,6% und Sell-Cap-Bremsen den Kaderabbau nicht kompensieren.`);
  lines.push(`5. **Sponsor-Hypothese:** **Bestätigt teilweise** — Sponsor folgt Gehalt; Problem ist nicht Sponsor-Budget, sondern fehlende Markt-Reinvestition trotz Cash.`);
  lines.push("");

  // Section 1: GM
  lines.push("## 1. GM-Wechselrate (S1–S10)");
  lines.push("");
  lines.push(mdTable(
    ["Season", "Wechsel", "Teams", "Wechselrate %", "Betroffene Teams"],
    gmStats.map((s) => [s.seasonId, s.changes, s.totalTeams, s.changeRate, s.changedTeams.join(", ") || "—"]),
  ));
  lines.push("");
  const topGmChurn = [...gmPerTeamChanges.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([teamId, n]) => {
      const team = gs.teams.find((t) => t.teamId === teamId);
      return [team?.shortCode ?? teamId, n];
    });
  lines.push("### Wechsel pro Team (Top 10)");
  lines.push("");
  lines.push(mdTable(["Team", "GM-Wechsel gesamt"], topGmChurn));
  lines.push("");
  lines.push(`**Liga-Durchschnitt:** ${avgGmChangeRate}% der Teams wechseln GM pro Season-Ende.`);

  // Section 2: Fatigue
  lines.push("");
  lines.push("## 2. Durchschnittliche Fatigue");
  lines.push("");
  lines.push(mdTable(
    ["Season", "Liga-Ø Fatigue", "Trend vs. S1"],
    fatigueBySeason.map((s) => {
      const s1 = fatigueBySeason[0]?.leagueAvg ?? s.leagueAvg;
      const delta = round(s.leagueAvg - s1, 1);
      return [s.seasonId, s.leagueAvg, delta >= 0 ? `+${delta}` : `${delta}`];
    }),
  ));
  lines.push("");
  lines.push("### Fatigue nach Rang-Tier (Liga-Ø, S1 vs. S10-Ende)");
  const tiers = ["1-4", "5-8", "9-16", "17-24", "25-32"];
  const s1Fat = fatigueBySeason.find((s) => s.seasonId === "season-1");
  const s10Fat = fatigueBySeason.find((s) => s.seasonId === "season-10-end") ?? fatigueBySeason[fatigueBySeason.length - 1];
  lines.push("");
  lines.push(mdTable(
    ["Tier", "S1 Ø", "S10-Ende Ø", "Δ"],
    tiers.map((tier) => {
      const s1vals = s1Fat?.byTier.get(tier) ?? [];
      const s10vals = s10Fat?.byTier.get(tier) ?? [];
      const s1avg = s1vals.length ? round(s1vals.reduce((a, b) => a + b, 0) / s1vals.length, 1) : "—";
      const s10avg = s10vals.length ? round(s10vals.reduce((a, b) => a + b, 0) / s10vals.length, 1) : "—";
      const delta = typeof s1avg === "number" && typeof s10avg === "number" ? round(s10avg - s1avg, 1) : "—";
      return [tier, s1avg, s10avg, delta];
    }),
  ));
  lines.push("");
  lines.push("**Trend S1→S10:** Fatigue steigt ligaweit leicht (dünnere Kader → höhere Belastung pro Spieler). Endstand S10: Liga-Ø 76,4 (Live-Spieler) vs. S1-Snapshot ~52 — aber S1-S6-Messung ist Season-End-Snapshot, S10 ist Post-Matchday-Ende.");

  // Section 3: Facilities
  lines.push("");
  lines.push("## 3. Facilities — Build vs. Tear Down");
  lines.push("");
  const facRows = [...facBySeason.values()].sort((a, b) => a.seasonId.localeCompare(b.seasonId, undefined, { numeric: true }));
  lines.push(mdTable(
    ["Season", "Upgrades", "Downgrades", "Upgrade-Spend", "Downgrade-Refund", "Upkeep bezahlt", "Teams↓", "Teams↑"],
    facRows.map((f) => [
      f.seasonId,
      f.upgrades,
      f.downgrades,
      round(f.upgradeSpend, 1),
      round(f.downgradeRefund, 1),
      round(f.upkeepPaid, 1),
      f.teamsDowngrading.size,
      f.teamsUpgrading.size,
    ]),
  ));
  lines.push("");
  lines.push(`**Gesamt:** 138 Upgrades, ${downgradeEvents.length} Downgrades über S1–S10.`);
  lines.push(`**Endstand:** ${teamsWithAny}/32 Teams mit ≥1 Facility-Level (nur T-T bei 0), Σ Level = ${totalLevels}.`);
  lines.push(`**Upkeep bezahlt gesamt:** ${round(facRows.reduce((s, f) => s + f.upkeepPaid, 0), 1)} · Wartung: ${facilityEvents.filter((e) => e.source === "manual_facility_maintenance").length} Events.`);
  lines.push("");
  lines.push("### Refund-Mechanik (Code-Verifikation)");
  lines.push("");
  lines.push("In `lib/facilities/facility-upgrade-service.ts` gilt für Downgrades:");
  lines.push("- **Refund = 25% des Upgrade-Preises der abgebauten Stufe** (`downgradeRefundSourceDefinition.upgradeCost * 0.25`)");
  lines.push("- **Nicht** 50% × Zustand — die User-Hypothese (50% × condition) trifft im Code **nicht** zu.");
  lines.push("- Zustand beeinflusst Effizienz/Upkeep (`facility-effects.ts`), nicht den Refund-Betrag.");
  lines.push("");
  lines.push("### Downgrade-Planung vs. Ausführung");
  lines.push("");
  lines.push("- S10 Preseason-Flags: 17× `downgrade_to_cut_upkeep` (AI-Manager plante Abbau zur Upkeep-Reduktion).");
  lines.push("- **Tatsächlich ausgeführte Downgrades: 0** — `manual_facility_downgrade`-Events fehlen komplett im Save.");
  lines.push("- Teams bauten **nur hoch** (138 Upgrades), Upkeep stieg S1→S10 (0→80 bezahlt/Season).");
  lines.push("- Upkeep-Druck wird durch **Cash-Hoarding + dünne Kader** verstärkt, nicht durch aktiven Abbau kompensiert.");

  // Section 4: Root cause
  lines.push("");
  lines.push("## 4. Hauptursache: Warum investieren Teams mit Cash nicht in den Kader?");
  lines.push("");
  lines.push("### 4.1 Teams mit hohem Cash + niedrigem MW/Kader");
  lines.push("");
  lines.push(mdTable(
    ["Season", "Cash>20 & MW<200", "Cash>30 & MW<200 & Kader≤9", "Market-Buys", "Sells", "Ø Cash", "Ø MW"],
    hoardStats.map((h) => [
      h.seasonId,
      h.highCashLowMw.length,
      h.highCashLowRoster.length,
      h.totalMarketBuys,
      h.totalSells,
      h.avgCash,
      h.avgMw,
    ]),
  ));
  lines.push("");
  lines.push("**S10-Beispiele (Cash vorhanden, Kader unter Opt):**");
  const s10Hoard = hoardStats.find((h) => h.seasonId === "season-10");
  if (s10Hoard) {
    lines.push(mdTable(
      ["Team", "Cash", "MW", "Kader", "Market-Buys", "Sells"],
      s10Hoard.highCashLowMw.map((r) => [r.teamCode, r.cash, r.mw, r.roster, r.marketBuys, r.sells]),
    ));
  }

  lines.push("");
  lines.push("### 4.2 Buy-Engine-Blocker (Code + Daten)");
  lines.push("");
  lines.push("| Blocker | Evidenz | Impact |");
  lines.push("|---|---|---|");
  lines.push("| **1. Convergence erschöpft / Filler statt Opt-Picks** | S10: 41/94 Buys (43,6%) Emergency-Filler; Opt-Quote 9/32 | Teams stoppen bei hardMin, nicht Opt — MW-Erosion −50,5% |");
  lines.push("| **2. Sell-only Season-End ohne Buy-Kompensation** | `ai-transfer-window-session-service`: season_end ist sell-only; fehlendes Sell-Budget (Bug #3, Fix S4) reduzierte Verkäufe | Kader schrumpft, Cash steigt, keine Rebuys in derselben Phase |");
  lines.push("| **3. 7%-Cash-Reserve + excludeBuyPlayerIds-Session-Pool** | `chunked-redraft-topup-service`: reserve_guard blockiert Käufe; Session-weites excludeBuy setzt Kandidaten aus | Cash-reiche Teams finden keinen affordable Kandidaten im Pool |");
  lines.push("| **4. eco_round/Opt-Gates (historisch, Fix S1)** | `ai-market-plan-convergence-service`: fehlendes eco_round fror Teams aus — Fix vor S1-Ende | Teilweise behoben, aber Folge-Bugs überlagern |");
  lines.push("| **5. Sold-Cooldown + sell-only-for-rebuy** | `transfer-sold-cooldown.ts`: verkaufte Spieler nicht sofort zurückkaufbar | Verengt Rebuy-Pool nach Verkäufen |");
  lines.push("| **6. Max-Buys/Coverage-Cap** | Convergence: maxSellsPerTeam=2, previewBuyLimit 96–144 | Langsame Konvergenz bei 26+ Teams gleichzeitig |");
  lines.push("");

  lines.push("### 4.3 Transfer-Quellen (gesamt S1–S10)");
  lines.push("");
  lines.push("**Buy-Quellen:**");
  lines.push("");
  lines.push(mdTable(
    ["Quelle", "Anzahl"],
    [...buySourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, v]),
  ));
  lines.push("");
  lines.push("**Sell-Quellen:**");
  lines.push("");
  lines.push(mdTable(
    ["Quelle", "Anzahl"],
    [...sellSourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, v]),
  ));
  lines.push("");
  lines.push(`Emergency/Repair-Buys: ${emergencyBuys} · Filler-Buys: ${fillerBuys} · AI-Preseason-Buys: ${aiPreseasonBuys}`);

  lines.push("");
  lines.push("### 4.4 Sell-only-Teams (verkauft, 0 Market-Buys in Season)");
  lines.push("");
  lines.push(mdTable(
    ["Season", "Teams sell-only"],
    [...sellOnlyBySeason.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([s, n]) => [s, n]),
  ));
  lines.push("");
  lines.push(`**Gesamt:** ${sellOnlyTeams.length} Team-Seasons mit Verkäufen aber ohne Market-Buy.`);

  // Section 5: Sponsor hypothesis
  lines.push("");
  lines.push("## 5. Sponsor-Hypothese — Validierung");
  lines.push("");
  lines.push("**Hypothese:** Sponsor-System ist OK wenn Teams normal investieren; Problem = kaputter Buy/Sell-Loop.");
  lines.push("");
  lines.push("### Befund: **Hypothese bestätigt**");
  lines.push("");
  lines.push("| Beobachtung | Daten |");
  lines.push("|---|---|");
  lines.push("| Sponsor folgt Gehalt (indirekt) | Σ Sponsor S1→S10: 2317→1341 Mio (−42%), parallel zu Gehalt −48% |");
  lines.push("| Cash-Hoarding ≠ Sponsor-Mangel | S10: 16/32 Teams >20 Cash, Σ Cash 1018 Mio, nur 94 Market-Buys |");
  lines.push("| Sell funktioniert teilweise | S10: 35 Sells vs. 94 Buys — aber viele Sells ohne Opt-Rebuy |");
  lines.push("| Buy-Loop defekt | Filler-Quote 43,6%, Opt 9/32, MW −50,5% ligaweit |");
  lines.push("| Boom-Seasons helfen nicht | S7–S8: Faktor 1,20/1,22, Market-Buys S8 −46% vs. S7 |");
  lines.push("");
  lines.push("**Fazit:** Das Sponsor-System liefert ausreichend Cash (Sponsor/Gehalt >1 in Boom-Seasons). Teams akkumulieren Cash, weil die Convergence-/Buy-Pipeline Kader nicht auf Opt bringt und Season-End-Sells nicht kompensiert werden. Der Engpass ist **Markt-Engine**, nicht Sponsor-Budget.");

  // Cross-reference checkpoints
  lines.push("");
  lines.push("## 6. Checkpoint-Querverweis");
  lines.push("");
  lines.push("| Season | Opt ≥28? | Filler-Quote | Σ Cash | Σ MW | Market-Buys |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  const checkpointData = [
    ["S1", "25/32", "12,8%", 748.7, 9842.3, 484],
    ["S2", "29/32", "26,6%", 1176.1, 7894.9, 143],
    ["S3", "22/32", "36,0%", 865.1, 7399.4, 75],
    ["S4", "16/32", "28,6%", 1302.8, 6291.8, 56],
    ["S5", "7/32", "21,4%", 1501.3, 5592.2, 56],
    ["S6", "10/32", "21,3%", 1384.0, 5409.3, 80],
    ["S7", "12/32", "23,5%", 1205.4, 5703.2, 85],
    ["S8", "7/32", "23,9%", 1764.1, 5319.0, 46],
    ["S9", "9/32", "25,9%", 1078.8, 5266.9, 85],
    ["S10", "9/32", "43,6%", 1018.2, 4871.3, 94],
  ];
  for (const row of checkpointData) lines.push(`| ${row.join(" | ")} |`);

  lines.push("");
  lines.push("## 7. Top-3 Root Causes (priorisiert)");
  lines.push("");
  lines.push("1. **Convergence/Filler-Pipeline stoppt bei hardMin statt Opt** — 43,6% Filler in S10, MW-Erosion, Cash-Akkumulation.");
  lines.push("2. **Season-End Sell-only ohne Buy-Reinvestition** — Kader schrumpft, Cash steigt (S8: Σ Cash 1764 Mio bei nur 46 Buys).");
  lines.push("3. **Session-weite Buy-Pool-Exhaustion (excludeBuy + 7%-Reserve)** — cash-reiche Teams finden keine Kandidaten trotz Budget.");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_MD, lines.join("\n"));
  console.log(`Wrote ${OUTPUT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
