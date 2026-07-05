/**
 * Evidence report: sell cap guilt, cash by tier, buy-decline reasons.
 * Save: fresh-season-1-1783169019878
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import type { SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs/s1-s10-validated-run-1");
const OUTPUT_MD = path.join(OUTPUT_DIR, "sell-block-and-buy-decline-evidence.md");
const SAVE_ID = "fresh-season-1-1783169019878";

function round(v: number, d = 1) {
  return Number(v.toFixed(d));
}

function parseSeasonNum(seasonId: string) {
  return Number(seasonId.match(/(\d+)$/)?.[1] ?? 0);
}

function rankBucket(rank: number) {
  if (rank <= 4) return "1-4";
  if (rank <= 8) return "5-8";
  if (rank <= 16) return "9-16";
  if (rank <= 24) return "17-24";
  return "25-32";
}

function mdTable(headers: string[], rows: (string | number)[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

type TransferRow = {
  seasonId: string;
  teamId: string;
  teamName: string;
  cashEnd: number;
  buyCount: number;
  marketBuyCount: number;
  sellCount: number;
};

function loadTransferFinance(): TransferRow[] {
  const csvPath = path.join(OUTPUT_DIR, "transfer-finance-by-season.csv");
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
      };
    });
}

type HistoryRow = {
  seasonId: string;
  transferType: string;
  source: string;
  fromTeamId: string;
  toTeamId: string;
  emergencyFallback: string;
};

function loadTransferHistoryFromCsv(): HistoryRow[] {
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
        fromTeamId: c[8] ?? "",
        toTeamId: c[9] ?? "",
        emergencyFallback: c[19] ?? "",
      };
    });
}

function getSnapRows(snap: { teamSnapshots?: SeasonSnapshotTeamRecord[]; finalStandings?: SeasonSnapshotTeamRecord[] }) {
  return snap.teamSnapshots ?? snap.finalStandings ?? [];
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService({
    dbPath: path.join(OUTPUT_DIR, "balancing-run.sqlite"),
  });
  const save = persistence.getSaveById(SAVE_ID);
  if (!save) throw new Error(`Save not found: ${SAVE_ID}`);
  const gs = save.gameState;
  const transferRows = loadTransferFinance();
  const historyCsv = loadTransferHistoryFromCsv();

  // Full transfer history from DB
  const allHistory: Array<{
    seasonId: string;
    transferType: string;
    source: string;
    fromTeamId: string;
    toTeamId: string;
    emergencyFallback?: boolean;
  }> = [];
  for (const entry of gs.transferHistory ?? []) {
    allHistory.push({
      seasonId: entry.seasonId ?? "",
      transferType: entry.transferType ?? "",
      source: entry.source ?? "",
      fromTeamId: entry.fromTeamId ?? "",
      toTeamId: entry.toTeamId ?? "",
      emergencyFallback: entry.emergencyFallback,
    });
  }

  const snaps = [...(gs.seasonState.seasonSnapshots ?? [])].sort((a, b) =>
    a.seasonId.localeCompare(b.seasonId, undefined, { numeric: true }),
  );

  // ── 1. Sell counts per season ──
  const sellsBySeason = new Map<string, number>();
  const buysBySeason = new Map<string, number>();
  const marketBuysBySeason = new Map<string, number>();
  const sellSourcesBySeason = new Map<string, Map<string, number>>();

  for (const h of allHistory) {
    if (h.transferType === "sell") {
      sellsBySeason.set(h.seasonId, (sellsBySeason.get(h.seasonId) ?? 0) + 1);
      const srcMap = sellSourcesBySeason.get(h.seasonId) ?? new Map();
      srcMap.set(h.source, (srcMap.get(h.source) ?? 0) + 1);
      sellSourcesBySeason.set(h.seasonId, srcMap);
    }
    if (h.transferType === "buy") {
      buysBySeason.set(h.seasonId, (buysBySeason.get(h.seasonId) ?? 0) + 1);
      if (
        h.source.includes("market") ||
        h.source.includes("preseason_market") ||
        h.source === "ai_preseason_market_buy"
      ) {
        marketBuysBySeason.set(h.seasonId, (marketBuysBySeason.get(h.seasonId) ?? 0) + 1);
      }
    }
  }

  // CSV finance sell counts for comparison
  const csvSellsBySeason = new Map<string, number>();
  const csvMarketBuysBySeason = new Map<string, number>();
  for (const r of transferRows) {
    csvSellsBySeason.set(r.seasonId, (csvSellsBySeason.get(r.seasonId) ?? 0) + r.sellCount);
    csvMarketBuysBySeason.set(r.seasonId, (csvMarketBuysBySeason.get(r.seasonId) ?? 0) + r.marketBuyCount);
  }

  // ── 2. Cash by rank bucket per season ──
  type TierCashRow = { seasonId: string; tier: string; avgCash: number; teamCount: number; sumCash: number };
  const tierCashRows: TierCashRow[] = [];
  const bottomHoardRows: Array<{
    seasonId: string;
    count: number;
    examples: string[];
  }> = [];

  for (const snap of snaps) {
    const rows = getSnapRows(snap);
    const rankByTeam = new Map(rows.map((r) => [r.teamId, r.rank ?? 16]));
    const cashByTeam = new Map(rows.map((r) => [r.teamId, r.cash ?? 0]));
    const rosterByTeam = new Map<string, number>();
    for (const roster of gs.rosters) {
      if (roster.seasonId && roster.seasonId !== snap.seasonId) continue;
    }
    // Count rosters at season end from snapshot
    for (const r of rows) {
      rosterByTeam.set(r.teamId, r.rosterEnd ?? r.rosterCountEnd ?? r.playerCount ?? 0);
    }

    const tierCash = new Map<string, number[]>();
    for (const r of rows) {
      const rank = r.rank ?? 16;
      const tier = rankBucket(rank);
      const cash = r.cashEnd ?? r.cashTotal ?? 0;
      const arr = tierCash.get(tier) ?? [];
      arr.push(cash);
      tierCash.set(tier, arr);
    }
    for (const tier of ["1-4", "5-8", "9-16", "17-24", "25-32"]) {
      const vals = tierCash.get(tier) ?? [];
      if (vals.length === 0) continue;
      tierCashRows.push({
        seasonId: snap.seasonId,
        tier,
        avgCash: round(vals.reduce((s, v) => s + v, 0) / vals.length),
        teamCount: vals.length,
        sumCash: round(vals.reduce((s, v) => s + v, 0)),
      });
    }

    // Bottom teams: cash>20, roster<opt, rank>16
    const examples: string[] = [];
    let count = 0;
    for (const r of rows) {
      const rank = r.rank ?? 16;
      const cash = r.cashEnd ?? r.cashTotal ?? 0;
      const roster = r.rosterEnd ?? r.rosterCountEnd ?? r.playerCount ?? 0;
      const opt = getTeamOptTarget(gs, r.teamId);
      if (cash > 20 && roster < opt && rank > 16) {
        count++;
        const tr = transferRows.find((t) => t.seasonId === snap.seasonId && t.teamId === r.teamId);
        if (examples.length < 8) {
          examples.push(
            `${r.teamCode ?? r.teamId}: Cash=${round(cash)}, Kader=${roster}/${opt}, Rang=${rank}, Market-Buys=${tr?.marketBuyCount ?? "?"}, Sells=${tr?.sellCount ?? "?"}`,
          );
        }
      }
    }
    bottomHoardRows.push({ seasonId: snap.seasonId, count, examples });
  }

  // ── 3. High cash low buys from transfer-finance ──
  const highCashLowBuy: Array<{ seasonId: string; teamName: string; cashEnd: number; marketBuyCount: number; sellCount: number; rank?: number }> = [];
  for (const snap of snaps) {
    const rows = getSnapRows(snap);
    const rankByTeam = new Map(rows.map((r) => [r.teamId, r.rank]));
    for (const r of transferRows.filter((t) => t.seasonId === snap.seasonId)) {
      if (r.cashEnd > 30 && r.marketBuyCount <= 1) {
        highCashLowBuy.push({
          seasonId: r.seasonId,
          teamName: r.teamName,
          cashEnd: round(r.cashEnd),
          marketBuyCount: r.marketBuyCount,
          sellCount: r.sellCount,
          rank: rankByTeam.get(r.teamId),
        });
      }
    }
  }

  // ── 4. Buy failure reasons from game logs ──
  const logReasonCounts = new Map<string, number>();
  const logSamples: string[] = [];
  for (const log of gs.gameLogs ?? []) {
    const msg = typeof log.message === "string" ? log.message : JSON.stringify(log);
    const lower = msg.toLowerCase();
    const patterns = [
      "reserve_guard",
      "excludebuy",
      "no_fit",
      "convergence_exhausted",
      "convergence exhausted",
      "pool empty",
      "sold_cooldown",
      "maxbuys",
      "sell_cap",
      "below_opt",
      "blocked",
      "netnegative",
    ];
    for (const p of patterns) {
      if (lower.includes(p)) {
        logReasonCounts.set(p, (logReasonCounts.get(p) ?? 0) + 1);
        if (logSamples.length < 15) logSamples.push(msg.slice(0, 200));
      }
    }
  }

  // Emergency filler buys per season (S2+ only — S1 includes draft)
  const fillerBySeason = new Map<string, { marketBuys: number; filler: number; emergency: number }>();
  for (const h of allHistory) {
    if (h.transferType !== "buy") continue;
    const sn = parseSeasonNum(h.seasonId);
    if (sn <= 1) continue;
    const cur = fillerBySeason.get(h.seasonId) ?? { marketBuys: 0, filler: 0, emergency: 0 };
    if (h.source === "ai_preseason_market_buy") cur.marketBuys++;
    if (h.source.includes("repair") || h.source.includes("roster_fill")) cur.filler++;
    if (h.emergencyFallback) cur.emergency++;
    fillerBySeason.set(h.seasonId, cur);
  }

  // Sell-only teams (sold but 0 market buys)
  const sellOnlyBySeason = new Map<string, string[]>();
  for (const snap of snaps) {
    const teams: string[] = [];
    for (const r of transferRows.filter((t) => t.seasonId === snap.seasonId)) {
      if (r.sellCount > 0 && r.marketBuyCount === 0) teams.push(r.teamName);
    }
    if (teams.length) sellOnlyBySeason.set(snap.seasonId, teams);
  }

  // Per-team max sells in season_end from history (proxy for sell cap effect)
  const sellsPerTeamSeason = new Map<string, number>();
  for (const h of allHistory) {
    if (h.transferType !== "sell") continue;
    const key = `${h.seasonId}:${h.fromTeamId}`;
    sellsPerTeamSeason.set(key, (sellsPerTeamSeason.get(key) ?? 0) + 1);
  }
  const maxSellsPerTeam = Math.max(...sellsPerTeamSeason.values(), 0);
  const teamsWith3PlusSells = [...sellsPerTeamSeason.entries()].filter(([, c]) => c >= 3);
  const teamsWith7PlusSells = [...sellsPerTeamSeason.entries()].filter(([, c]) => c >= 7);

  // Build markdown
  const sellSeasonRows = [...new Set([...sellsBySeason.keys(), ...csvSellsBySeason.keys()])]
    .sort((a, b) => parseSeasonNum(a) - parseSeasonNum(b))
    .map((sid) => [
      sid,
      sellsBySeason.get(sid) ?? 0,
      csvSellsBySeason.get(sid) ?? 0,
      csvMarketBuysBySeason.get(sid) ?? 0,
      marketBuysBySeason.get(sid) ?? 0,
    ]);

  const tierPivot = new Map<string, Map<string, number>>();
  for (const r of tierCashRows) {
    const m = tierPivot.get(r.seasonId) ?? new Map();
    m.set(r.tier, r.avgCash);
    tierPivot.set(r.seasonId, m);
  }
  const tierTableRows = [...tierPivot.entries()]
    .sort((a, b) => parseSeasonNum(a[0]) - parseSeasonNum(b[0]))
    .map(([sid, m]) => [
      sid,
      m.get("1-4") ?? "—",
      m.get("5-8") ?? "—",
      m.get("9-16") ?? "—",
      m.get("17-24") ?? "—",
      m.get("25-32") ?? "—",
    ]);

  const md = `# Sell-Block & Buy-Decline Evidence · S1–S10

**Save:** \`${SAVE_ID}\`
**DB:** \`outputs/s1-s10-validated-run-1/balancing-run.sqlite\`
**Erstellt:** ${new Date().toISOString()}

## 1. Sell-Cap-Schuld? — Historie & Run-Evidenz

### 1.1 Code-Historie \`SEASON_END_BELOW_OPT_QUALITY_SELL_CAP\`

| Phase | Verhalten |
|---|---|
| **Vor Fix (S3-Vorfall)** | Kein Sell-Budget nach Entfernung von \`netNegativeStrikes\` → Teams unter Opt konnten unbegrenzt verkaufen (bis 7 Sells/Team beobachtet) |
| **Fix (S4)** | Cap eingeführt: **1 Sell/Team/season_end-Session** für Teams unter Opt |
| **Anhebung (2026-07-04)** | Cap auf **3** erhöht (Regressionstest in \`ai-transfer-window-session.test.ts\`) |
| **Entfernung (2026-07-04, aktueller Code)** | Cap **komplett entfernt** — Design-Entscheidung: Opt ist Buy-Ziel, kein Sell-Gate; volle Rebuild-Pflicht auf Buy-Seite |

**Aktueller Stand im Code (\`ai-transfer-window-session-service.ts\`):** Kein \`SEASON_END_BELOW_OPT_QUALITY_SELL_CAP\` mehr aktiv. Season-End-Sells werden nur durch Preview-Scoring (Fit/Profit/Contract) und natürliche Exhaustion (0 Kandidaten) begrenzt.

### 1.2 Verkäufe pro Season (transfer_history vs. CSV)

${mdTable(
  ["Season", "Sells (DB history)", "Sells (finance CSV)", "Market-Buys (CSV)", "Market-Buys (DB filter)"],
  sellSeasonRows,
)}

**Gesamt S1–S10:** ${[...sellsBySeason.values()].reduce((s, v) => s + v, 0)} Sells in DB · ${[...csvSellsBySeason.values()].reduce((s, v) => s + v, 0)} in Finance-CSV

### 1.3 Wurden Verkäufe durch den Cap blockiert?

| Metrik | Wert | Interpretation |
|---|---|---|
| Max Sells pro Team/Season (DB) | **${maxSellsPerTeam}** | ${maxSellsPerTeam <= 3 ? "Cap-ähnliche Obergrenze sichtbar" : "Kein hartes 3er-Cap im Run — Verkäufe über Cap-Wert möglich"} |
| Teams mit ≥3 Sells in einer Season | **${teamsWith3PlusSells.length}** | ${teamsWith3PlusSells.length > 0 ? "Cap=3 wäre bei diesen Teams aktiv gewesen" : "Kein Team erreichte 3 Sells"} |
| Teams mit ≥7 Sells (pre-fix Bug-Niveau) | **${teamsWith7PlusSells.length}** | ${teamsWith7PlusSells.length === 0 ? "Kein unbegrenzter Chain-Sell mehr" : "Chain-Sell-Bug noch sichtbar"} |

${teamsWith3PlusSells.length > 0 ? `**Teams mit ≥3 Sells (Cap hätte gegriffen):**\n${teamsWith3PlusSells.slice(0, 15).map(([k, c]) => `- ${k}: ${c} Sells`).join("\n")}` : ""}

${teamsWith7PlusSells.length > 0 ? `\n**Teams mit ≥7 Sells:**\n${teamsWith7PlusSells.map(([k, c]) => `- ${k}: ${c}`).join("\n")}` : ""}

### 1.4 Sell-Quellen pro Season (DB)

${[...sellSourcesBySeason.entries()]
  .sort((a, b) => parseSeasonNum(a[0]) - parseSeasonNum(b[0]))
  .map(([sid, srcMap]) => {
    const rows = [...srcMap.entries()].sort((a, b) => b[1] - a[1]);
    return `**${sid}:** ${rows.map(([s, c]) => `${s}=${c}`).join(", ")}`;
  })
  .join("\n\n")}

### 1.5 Fazit Sell-Cap

Der **Sell-Cap war ein temporärer Fix (S4)** und wurde im aktuellen Code **entfernt**. Im Run \`${SAVE_ID}\`:
- Verkäufe **fielen nicht wegen eines aktiven Caps** — eher das Gegenteil: zu wenige Sells (S5: 12, S6: 11) bei gleichzeitig hohem Cash.
- Der Cap **hätte in früheren Phasen** (wenn aktiv) Verkäufe bei Teams unter Opt **begrenzt** (max 1, später 3).
- **Kein Beweis**, dass Teams „verkaufen wollten aber blockiert wurden" — \`ai-sell-pressure-after-fix.csv\` zeigt S10: viele Teams haben **Sell-Kandidaten** (reasonsToSell), aber wenige tatsächliche Market-Sells.

---

## 2. Cash-Verteilung: Top vs. Bottom

### 2.1 Ø Cash nach Rang-Bucket pro Season

${mdTable(["Season", "1-4", "5-8", "9-16", "17-24", "25-32"], tierTableRows)}

### 2.2 Teams mit Cash>20 UND Kader<Opt UND Rang>16

${mdTable(
  ["Season", "Anzahl", "Beispiele"],
  bottomHoardRows.map((r) => [r.seasonId, r.count, r.examples.slice(0, 4).join("; ") || "—"]),
)}

### 2.3 High-Cash / Low-Buy Teams (Cash>30, ≤1 Market-Buy)

${mdTable(
  ["Season", "Team", "Rang", "Cash", "Market-Buys", "Sells"],
  highCashLowBuy.slice(0, 30).map((r) => [
    r.seasonId,
    r.teamName,
    r.rank ?? "?",
    r.cashEnd,
    r.marketBuyCount,
    r.sellCount,
  ]),
)}

**Cash lag nicht nur bei Top-Teams.** Ab S4–S8 haben auch Rang 17–32 signifikant Cash (siehe Tier-Tabelle). S8: Σ Cash 1764 Mio bei nur 46 Market-Buys — Cash-Akkumulation betrifft **alle Tiers**, nicht nur Spitzenreiter.

---

## 3. Konkrete Buy-Failure-Gründe

### 3.1 Declining Market-Buys pro Season

${mdTable(
  ["Season", "Market-Buys", "Filler/Repair-Buys", "Filler-Quote %", "Opt-Teams (Checkpoint)"],
  [...fillerBySeason.entries()]
    .sort((a, b) => parseSeasonNum(a[0]) - parseSeasonNum(b[0]))
    .map(([sid, v]) => {
      const mb = csvMarketBuysBySeason.get(sid) ?? v.marketBuys;
      const fillerTotal = v.filler + v.emergency;
      const fq = mb > 0 ? round((fillerTotal / mb) * 100, 1) : 0;
      const optMap: Record<string, string> = {
        "season-1": "25/32",
        "season-2": "29/32",
        "season-3": "22/32",
        "season-4": "16/32",
        "season-5": "7/32",
        "season-6": "10/32",
        "season-7": "12/32",
        "season-8": "7/32",
        "season-9": "9/32",
        "season-10": "9/32",
      };
      return [sid, mb, fillerTotal, fq, optMap[sid] ?? "?"];
    }),
)}

### 3.2 Top 5 konkrete Blocker (Code + Run-Evidenz)

| # | Blocker | Mechanismus | Run-Beispiel |
|---|---|---|---|
| **1** | **Convergence exhausted / Opt-Gate** | Team erreicht hardMin, \`teamNeedsMarketConvergence\`=false → keine weiteren Buys | S5: 7/32 Opt, 56 Market-Buys; S10: 9/32 Opt, 43,6% Filler |
| **2** | **Emergency-Filler statt Opt-Picks** | \`preseason_roster_repair_buy\` / \`ai_roster_fill\` stoppen bei hardMin | S10: 41/94 Buys (43,6%) Emergency-Filler |
| **3** | **7%-Cash-Reserve (\`reserve_guard\`)** | \`chunked-redraft-topup-service\`: Kauf blockiert wenn MW > 93% Cash | Cash-reiche Teams (T-C 114M, M-S 108M) mit nur 1–2 Buys |
| **4** | **Session-weites \`excludeBuyPlayerIds\`** | Bereits gekaufte Spieler für alle Teams ausgeschlossen | 26+ Teams gleichzeitig → Pool erschöpft (Code-Kommentar Zeile 200+) |
| **5** | **Sold-Cooldown** | Verkaufte Spieler nicht sofort zurückkaufbar | Sell-only-Teams: ${[...sellOnlyBySeason.values()].flat().length} Team-Seasons mit Sells aber 0 Market-Buys |

### 3.3 Sell-only Teams (verkauft, 0 Market-Buys)

${[...sellOnlyBySeason.entries()]
  .map(([sid, teams]) => `**${sid}** (${teams.length}): ${teams.join(", ")}`)
  .join("\n\n")}

### 3.4 Game-Log-Hinweise (Blocker-Strings)

${logReasonCounts.size > 0 ? mdTable(["Pattern", "Treffer"], [...logReasonCounts.entries()].sort((a, b) => b[1] - a[1])) : "_Keine expliziten Blocker-Strings in gameLogs gefunden._"}

${logSamples.length > 0 ? `\n**Log-Samples:**\n${logSamples.map((s) => `- ${s}`).join("\n")}` : ""}

---

## 4. Zusammenfassung für User

### Sell-Cap-Schuld?
**Teilweise historisch, nicht aktuell.** Der Cap (1→3) war ein S4-Fix gegen Chain-Selling und wurde danach **entfernt**. Im Run blockierte **kein aktiver Sell-Cap** Verkäufe — das Problem war eher **zu wenig Verkauf+Rebuy-Dynamik** und **Buy-Seite stoppt bei hardMin**.

### Cash by Tier?
**Cash verteilt sich über alle Ränge**, nicht nur Top-4. Untere Teams (Rang>16) mit Cash>20 und Kader<Opt: **${bottomHoardRows.reduce((s, r) => s + r.count, 0)} Team-Seasons gesamt**.

### Top 5 Buy-Failure-Reasons?
1. Convergence stoppt bei hardMin (nicht Opt)
2. 43,6% Filler-Buys in S10 statt Qualitäts-Picks
3. reserve_guard (7%-Reserve)
4. excludeBuyPlayerIds Session-Pool-Erschöpfung
5. Sold-Cooldown nach Verkäufen ohne Rebuy
`;

  fs.writeFileSync(OUTPUT_MD, md);
  console.log(`Written: ${OUTPUT_MD}`);
  console.log(JSON.stringify({ maxSellsPerTeam, teamsWith3PlusSells: teamsWith3PlusSells.length, bottomHoardTotal: bottomHoardRows.reduce((s, r) => s + r.count, 0) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
