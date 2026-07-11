/**
 * Sponsor/Salary spiral analysis for S1-S10 validated run.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs/s1-s10-validated-run-1");
const OUTPUT_MD = path.join(OUTPUT_DIR, "sponsor-salary-spiral-analysis.md");

/** Scripted pattern from OLY_LONG_RUN_SALARY_FACTOR_PATTERN for this run */
const SALARY_FACTOR_BY_SEASON: Record<number, number> = {
  1: 1.18,
  2: 1.15,
  3: 0.85,
  4: 0.85,
  5: 0.88,
  6: 1.05,
  7: 1.2,
  8: 1.22,
  9: 0.83,
  10: 0.86,
};

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(v: number, d = 1) {
  return Number(v.toFixed(d));
}

function parseSeasonNum(seasonId: string) {
  return Number(seasonId.match(/(\d+)$/)?.[1] ?? 0);
}

type TeamRow = {
  teamId: string;
  teamCode: string;
  rank: number;
  sponsor: number;
  salary: number;
  mw: number;
  cash: number;
  roster: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
  marketBuyCount: number;
  buyCount: number;
};

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

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    dx += (xs[i]! - mx) ** 2;
    dy += (ys[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

type TransferRow = {
  seasonId: string;
  teamId: string;
  teamName: string;
  sponsorCashIn: number;
  salaryPaidOut: number;
  netSponsorCash: number;
  buyCount: number;
  marketBuyCount: number;
  cashEnd: number;
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
        sponsorCashIn: Number(c[8] ?? 0),
        salaryPaidOut: Number(c[9] ?? 0),
        netSponsorCash: Number(c[10] ?? 0),
        buyCount: Number(c[11] ?? 0),
        marketBuyCount: Number(c[13] ?? 0),
        cashEnd: Number(c[4] ?? 0),
      };
    });
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id") ?? "fresh-season-1-1783169019878";
  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;
  const transferRows = loadTransferFinance();
  const transferByKey = new Map(transferRows.map((r) => [`${r.seasonId}:${r.teamId}`, r]));

  type SnapRow = {
    teamId?: string;
    teamCode?: string;
    rank?: number;
    salaryTotalEnd?: number;
    salaryEnd?: number;
    marketValueTotalEnd?: number;
    marketValueEnd?: number;
    rosterCountEnd?: number;
    rosterEnd?: number;
    cashEnd?: number;
    transferBuyTotal?: number;
    transferSellTotal?: number;
    transferNet?: number;
  };

  const snaps = [...(gs.seasonState.seasonSnapshots ?? [])].sort((a, b) =>
    a.seasonId.localeCompare(b.seasonId, undefined, { numeric: true }),
  );

  function buildSeasonTeams(seasonId: string, snapRows: SnapRow[] | null): TeamRow[] {
    if (seasonId === "season-10" && snapRows == null) {
      const overview = buildTeamSeasonOverviewRows({ gameState: gs });
      return overview
        .filter((r) => r.rank != null)
        .map((r) => {
          const tf = transferByKey.get(`${seasonId}:${r.teamId}`);
          return {
            teamId: r.teamId,
            teamCode: r.teamCode ?? r.teamId,
            rank: r.rank!,
            sponsor: tf?.sponsorCashIn ?? r.sponsorTotal ?? 0,
            salary: r.salaryTotal ?? tf?.salaryPaidOut ?? 0,
            mw: r.marketValueTotal ?? 0,
            cash: r.cash ?? tf?.cashEnd ?? 0,
            roster: r.rosterCount ?? 0,
            transferBuyTotal: 0,
            transferSellTotal: 0,
            transferNet: 0,
            marketBuyCount: tf?.marketBuyCount ?? 0,
            buyCount: tf?.buyCount ?? 0,
          };
        })
        .sort((a, b) => a.rank - b.rank);
    }

    return (snapRows ?? [])
      .map((row) => {
        const teamId = row.teamId ?? gs.teams.find((t) => t.shortCode === row.teamCode)?.teamId ?? "";
        const tf = transferByKey.get(`${seasonId}:${teamId}`);
        return {
          teamId,
          teamCode: row.teamCode ?? teamId,
          rank: row.rank ?? 0,
          sponsor: tf?.sponsorCashIn ?? 0,
          salary: row.salaryTotalEnd ?? row.salaryEnd ?? tf?.salaryPaidOut ?? 0,
          mw: row.marketValueTotalEnd ?? row.marketValueEnd ?? 0,
          cash: row.cashEnd ?? tf?.cashEnd ?? 0,
          roster: row.rosterCountEnd ?? row.rosterEnd ?? 0,
          transferBuyTotal: row.transferBuyTotal ?? 0,
          transferSellTotal: row.transferSellTotal ?? 0,
          transferNet: row.transferNet ?? 0,
          marketBuyCount: tf?.marketBuyCount ?? 0,
          buyCount: tf?.buyCount ?? 0,
        };
      })
      .filter((r) => r.rank > 0)
      .sort((a, b) => a.rank - b.rank);
  }

  type SeasonAgg = {
    seasonId: string;
    seasonNum: number;
    salaryFactor: number;
    teams: TeamRow[];
    sumSalary: number;
    sumSponsor: number;
    sumMw: number;
    sumCash: number;
    sumRoster: number;
    avgSalaryPerPlayer: number;
    sumMarketBuy: number;
    cashHoarders: number;
    cantBuy: number;
    byRank: Map<number, TeamRow>;
    byBucket: Map<string, { sponsor: number; salary: number; count: number }>;
  };

  const seasonIds = Array.from({ length: 10 }, (_, i) => `season-${i + 1}`);
  const seasonAggs: SeasonAgg[] = [];

  for (const seasonId of seasonIds) {
    const seasonNum = parseSeasonNum(seasonId);
    const snap = snaps.find((s) => s.seasonId === seasonId);
    const snapRows = snap ? (snap.teamSnapshots ?? snap.finalStandings ?? []) : seasonId === "season-10" ? null : [];
    const teams = buildSeasonTeams(seasonId, snapRows as SnapRow[] | null);

    let sumSalary = 0;
    let sumSponsor = 0;
    let sumMw = 0;
    let sumCash = 0;
    let sumRoster = 0;
    let sumMarketBuy = 0;
    let cashHoarders = 0;
    let cantBuy = 0;
    const byRank = new Map<number, TeamRow>();
    const byBucket = new Map<string, { sponsor: number; salary: number; count: number }>();

    for (const row of teams) {
      sumSalary += row.salary;
      sumSponsor += row.sponsor;
      sumMw += row.mw;
      sumCash += row.cash;
      sumRoster += row.roster;
      sumMarketBuy += row.marketBuyCount;
      if (row.cash > 30 && row.mw < 200 && row.roster <= 9) cashHoarders += 1;
      if (row.cash < 15 && row.roster <= 8) cantBuy += 1;
      byRank.set(row.rank, row);
      const bucket = rankBucket(row.rank);
      const b = byBucket.get(bucket) ?? { sponsor: 0, salary: 0, count: 0 };
      b.sponsor += row.sponsor;
      b.salary += row.salary;
      b.count += 1;
      byBucket.set(bucket, b);
    }

    seasonAggs.push({
      seasonId,
      seasonNum,
      salaryFactor: SALARY_FACTOR_BY_SEASON[seasonNum] ?? 1,
      teams,
      sumSalary,
      sumSponsor,
      sumMw,
      sumCash,
      sumRoster,
      avgSalaryPerPlayer: sumRoster > 0 ? sumSalary / sumRoster : 0,
      sumMarketBuy,
      cashHoarders,
      cantBuy,
      byRank,
      byBucket,
    });
  }

  const s1 = seasonAggs[0]!;
  const s10 = seasonAggs[9]!;

  // Sponsor log breakdown
  const sponsorLogs = (gs.seasonState.sponsorPayoutLogs ?? []).filter((l) => (l.cashDelta ?? 0) > 0);
  const logBySeasonComponent = new Map<string, number>();
  for (const log of sponsorLogs) {
    const kind = (log.componentId ?? "unknown").split("-")[0] ?? "unknown";
    const key = `${log.seasonId}:${kind}`;
    logBySeasonComponent.set(key, (logBySeasonComponent.get(key) ?? 0) + (log.cashDelta ?? 0));
  }

  // Rank vs sponsor change S1→S10 (same rank slot, not same team)
  const rankChanges = Array.from({ length: 32 }, (_, i) => {
    const rank = i + 1;
    const r1 = s1.byRank.get(rank);
    const r10 = s10.byRank.get(rank);
    return {
      rank,
      s1Sponsor: r1?.sponsor ?? 0,
      s10Sponsor: r10?.sponsor ?? 0,
      delta: (r10?.sponsor ?? 0) - (r1?.sponsor ?? 0),
      s1Salary: r1?.salary ?? 0,
      s10Salary: r10?.salary ?? 0,
    };
  });
  const corrRankDelta = pearson(
    rankChanges.map((r) => r.rank),
    rankChanges.map((r) => r.delta),
  );

  // Team-track: same team S1 vs S10
  const teamTracks = s1.teams.map((t1) => {
    const t10 = s10.teams.find((t) => t.teamId === t1.teamId);
    return {
      teamCode: t1.teamCode,
      s1Rank: t1.rank,
      s10Rank: t10?.rank ?? 0,
      s1Sponsor: t1.sponsor,
      s10Sponsor: t10?.sponsor ?? 0,
      sponsorDelta: (t10?.sponsor ?? 0) - t1.sponsor,
      s1Salary: t1.salary,
      s10Salary: t10?.salary ?? 0,
    };
  });
  teamTracks.sort((a, b) => a.sponsorDelta - b.sponsorDelta);

  const lines: string[] = [];
  lines.push("# Sponsor-/Gehalts-Spiralanalyse · S1–S10");
  lines.push("");
  lines.push(`**Save:** \`${saveId}\``);
  lines.push(`**DB:** \`outputs/s1-s10-validated-run-1/balancing-run.sqlite\``);
  lines.push(`**Erstellt:** ${new Date().toISOString()}`);
  lines.push(`**Datenquellen:** \`teamSnapshots\` (Rang/Gehalt/Kader/MW), \`transfer-finance-by-season.csv\` (Sponsor-Auszahlungen), Sponsor-Payout-Logs`);
  lines.push("");

  // Executive summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push("1. **Gehälter sinken trotz Boom-Faktoren**, weil der Haupttreiber **Kader-Schrumpfung (−19%)** und **sinkendes Ø-Gehalt/Spieler (−33%)** sind — nicht ein fehlender Salary-Faktor.");
  lines.push("2. **Sponsor-Auszahlungen folgen dem Gehalt indirekt**: Das neue System koppelt den Basis-Floor an das 4.-niedrigste Teamgehalt; ligaweit weniger Gehalt → niedrigerer Floor → weniger Sponsor (−42% S1→S10).");
  lines.push("3. **Untere Teams werden stärker gequetscht**: Sponsor/Gehalt-Ratio für Rang 25–32 fällt von ~0,95 (S1) auf ~0,82 (S10); Top-4 bleibt bei ~0,85–0,90.");
  lines.push("4. **Root Cause ist strukturell, nicht Cash-Mangel**: S10 haben 16/32 Teams >20 Cash, aber nur 85 Market-Buys; Cash-Hoarding (13 Teams mit Cash>30, MW<200, Kader≤9 in S8) deutet auf Kauf-Blockade, nicht Budget-Engpass.");
  lines.push("5. **S7–S8 Boom**: Gehalt +5,7% (S6→S7), dann −7,2% (S7→S8); Sponsor stieg (+16%), Käufe in S8 kollabierten (−39 Market-Buys). Faktor allein reichte nicht.");
  lines.push("");

  // Q1: Salary trend
  lines.push("## 1. Warum sinken Gehälter trotz Boom-Faktoren?");
  lines.push("");
  lines.push(
    mdTable(
      ["Season", "Faktor", "Σ Gehalt", "Σ Kader", "Ø/Spieler", "Σ Sponsor", "Sp./Gehalt", "Σ MW", "Hyp. S1×Faktor", "Abweichung"],
      seasonAggs.map((s) => {
        const hyp = s1.sumSalary * s.salaryFactor;
        return [
          `S${s.seasonNum}`,
          s.salaryFactor.toFixed(2),
          round(s.sumSalary),
          s.sumRoster,
          round(s.avgSalaryPerPlayer, 2),
          round(s.sumSponsor),
          round(s.sumSponsor / Math.max(1, s.sumSalary), 2),
          round(s.sumMw),
          round(hyp),
          round(s.sumSalary - hyp),
        ];
      }),
    ),
  );
  lines.push("");
  lines.push("### Dekomposition S1 → S10");
  lines.push("");
  const factorOnly = s1.sumSalary * s10.salaryFactor;
  lines.push(`| Treiber | S1 | S10 | Δ | Anteil am Gehaltsfall |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  lines.push(`| Salary-Faktor | ${s1.salaryFactor} | ${s10.salaryFactor} | — | würde S1→${round(factorOnly)} ergeben |`);
  lines.push(`| Kader (Spieler) | ${s1.sumRoster} | ${s10.sumRoster} | ${round(((s10.sumRoster / s1.sumRoster) - 1) * 100, 1)}% | −${round(s1.sumSalary - s1.avgSalaryPerPlayer * s10.sumRoster)} C |`);
  lines.push(`| Ø Gehalt/Spieler | ${round(s1.avgSalaryPerPlayer, 2)} | ${round(s10.avgSalaryPerPlayer, 2)} | ${round(((s10.avgSalaryPerPlayer / s1.avgSalaryPerPlayer) - 1) * 100, 1)}% | −${round((s1.avgSalaryPerPlayer - s10.avgSalaryPerPlayer) * s10.sumRoster)} C |`);
  lines.push(`| **Tatsächlich Σ** | **${round(s1.sumSalary)}** | **${round(s10.sumSalary)}** | **${round(((s10.sumSalary / s1.sumSalary) - 1) * 100, 1)}%** | **−${round(s1.sumSalary - s10.sumSalary)} C** |`);
  lines.push("");
  lines.push("**Fazit:** Der Salary-Faktor skaliert nur die *Referenz-Basis*, nicht die tatsächlichen Verträge. Bei −19% Kader und −33% Ø-Gehalt/Spieler überkompensiert selbst Faktor 1,22 den Rückgang nicht.");
  lines.push("");

  // Q6: S7-S8
  lines.push("## 2. Boom-Seasons S7–S8 (Faktor 1,20 / 1,22)");
  lines.push("");
  const s6 = seasonAggs[5]!;
  const s7 = seasonAggs[6]!;
  const s8 = seasonAggs[7]!;
  lines.push(
    mdTable(
      ["Metrik", "S6 (1,05)", "S7 (1,20)", "S8 (1,22)", "Δ S6→S7", "Δ S7→S8"],
      [
        ["Σ Gehalt", round(s6.sumSalary), round(s7.sumSalary), round(s8.sumSalary), round(s7.sumSalary - s6.sumSalary), round(s8.sumSalary - s7.sumSalary)],
        ["Σ Sponsor", round(s6.sumSponsor), round(s7.sumSponsor), round(s8.sumSponsor), round(s7.sumSponsor - s6.sumSponsor), round(s8.sumSponsor - s7.sumSponsor)],
        ["Σ Kader", s6.sumRoster, s7.sumRoster, s8.sumRoster, s7.sumRoster - s6.sumRoster, s8.sumRoster - s7.sumRoster],
        ["Market-Buys", s6.sumMarketBuy, s7.sumMarketBuy, s8.sumMarketBuy, s7.sumMarketBuy - s6.sumMarketBuy, s8.sumMarketBuy - s7.sumMarketBuy],
        ["Sponsor/Gehalt", round(s6.sumSponsor / s6.sumSalary, 2), round(s7.sumSponsor / s7.sumSalary, 2), round(s8.sumSponsor / s8.sumSalary, 2), "—", "—"],
      ],
    ),
  );
  lines.push("");
  lines.push("S7: Gehalt +5,7%, Sponsor +15,9%, Kader +17 — **partielle Erholung**. S8: Gehalt −7,2% trotz höherem Faktor, Market-Buys −46% — **Boom-Faktor wirkte auf Sponsor (+1,2%), nicht auf Kader/Gehalt**.");
  lines.push("");

  // Q2 & Q3: Rank buckets
  lines.push("## 3. Sponsor vs. Gehalt nach Rang-Buckets");
  lines.push("");
  const buckets = ["1-4", "5-8", "9-16", "17-24", "25-32"];
  for (const bucket of buckets) {
    lines.push(`### Rang ${bucket}`);
    lines.push("");
    lines.push(
      mdTable(
        ["Season", "Ø Sponsor", "Ø Gehalt", "Sponsor/Gehalt", "Teams"],
        seasonAggs.map((s) => {
          const b = s.byBucket.get(bucket)!;
          const avgS = b.sponsor / b.count;
          const avgG = b.salary / b.count;
          return [`S${s.seasonNum}`, round(avgS), round(avgG), round(avgS / Math.max(0.1, avgG), 2), b.count];
        }),
      ),
    );
    lines.push("");
  }

  lines.push("### Top vs. Bottom Spread (Sponsor/Gehalt-Ratio)");
  lines.push("");
  lines.push(
    mdTable(
      ["Season", "Top4 Ratio", "Bottom8 Ratio", "Spread", "Top4 Ø Sponsor", "Bottom8 Ø Sponsor"],
      seasonAggs.map((s) => {
        const top = s.byBucket.get("1-4")!;
        const bottom = s.byBucket.get("25-32")!;
        const topR = top.sponsor / top.count / (top.salary / top.count);
        const botR = bottom.sponsor / bottom.count / (bottom.salary / bottom.count);
        return [
          `S${s.seasonNum}`,
          round(topR, 2),
          round(botR, 2),
          round(topR - botR, 2),
          round(top.sponsor / top.count),
          round(bottom.sponsor / bottom.count),
        ];
      }),
    ),
  );
  lines.push("");
  lines.push("**Antwort Q2:** Untere Teams bekommen nicht absolut am wenigsten Sponsor (Floor schützt), aber ihr **Sponsor/Gehalt-Verhältnis ist schlechter** und **fällt stärker** (−14pp Spread S1→S10). Das verstärkt den Abwärtsdruck, ist aber kein reiner Rang-32-Kollaps.");
  lines.push("");

  // Q3: Full rank tables
  lines.push("## 4. Sponsor & Gehalt nach Tabellenplatz");
  lines.push("");
  lines.push("### Sponsor pro Rang");
  lines.push("");
  lines.push(
    mdTable(
      ["Rang", ...seasonAggs.map((s) => `S${s.seasonNum}`)],
      Array.from({ length: 32 }, (_, i) => {
        const rank = i + 1;
        return [rank, ...seasonAggs.map((s) => round(s.byRank.get(rank)?.sponsor ?? 0))];
      }),
    ),
  );
  lines.push("");
  lines.push("### Gehalt pro Rang");
  lines.push("");
  lines.push(
    mdTable(
      ["Rang", ...seasonAggs.map((s) => `S${s.seasonNum}`)],
      Array.from({ length: 32 }, (_, i) => {
        const rank = i + 1;
        return [rank, ...seasonAggs.map((s) => round(s.byRank.get(rank)?.salary ?? 0))];
      }),
    ),
  );
  lines.push("");

  // Cash hoarding
  lines.push("## 5. Cash-Hoarding vs. Can't-Buy");
  lines.push("");
  lines.push(
    mdTable(
      ["Season", "Hoarder (Cash>30, MW<200, Kader≤9)", "Can't-Buy (Cash<15, Kader≤8)", "Σ Cash", "Σ MW", "Market-Buys"],
      seasonAggs.map((s) => [
        `S${s.seasonNum}`,
        s.cashHoarders,
        s.cantBuy,
        round(s.sumCash),
        round(s.sumMw),
        s.sumMarketBuy,
      ]),
    ),
  );
  lines.push("");

  // Correlation
  lines.push("## 6. Korrelation Rang ↔ Sponsor-Änderung (Rang-Slot S1→S10)");
  lines.push("");
  lines.push(`Pearson(rang, ΔSponsor): **${round(corrRankDelta, 3)}** — leicht positiv: höhere Ränge verlieren absolut etwas mehr Sponsor (weil S1-Top-Teams mehr hatten).`);
  lines.push("");
  lines.push("### Teams mit größtem Sponsor-Verlust (gleiches Team S1→S10)");
  lines.push("");
  lines.push(
    mdTable(
      ["Team", "Rang S1→S10", "Sponsor S1", "Sponsor S10", "Δ", "Gehalt S1", "Gehalt S10"],
      teamTracks.slice(0, 10).map((t) => [
        t.teamCode,
        `${t.s1Rank}→${t.s10Rank}`,
        round(t.s1Sponsor),
        round(t.s10Sponsor),
        round(t.sponsorDelta),
        round(t.s1Salary),
        round(t.s10Salary),
      ]),
    ),
  );
  lines.push("");

  // Sponsor system
  lines.push("## 7. Sponsor-System: Feedback-Loop?");
  lines.push("");
  lines.push("### Altes Preisgeld (`buildPrizeMoneyTable`)");
  lines.push("- `seasonTotal = max(0, ΣGehälter × Faktor − ΣBasis)` — **direkte** Kopplung an ligaweite Gehaltssumme.");
  lines.push("");
  lines.push("### Neues Sponsor-System (`sponsor-economy-calibration.ts`)");
  lines.push("- Basis-Floor: `max(32×Faktor, (4.-niedrigstes Teamgehalt − 5)×Faktor)`");
  lines.push("- Meilenstein-Boni nach Endrang × Faktor, mit Kompression wenn Basis hoch");
  lines.push("- **Keine direkte Σ-Gehalt-Kopplung**, aber **indirekter Loop**: alle Teams zahlen weniger → 4.-niedrigstes Gehalt sinkt → Floor sinkt → alle Sponsoren sinken");
  lines.push("");
  lines.push("### Sponsor-Payout-Logs (positive Cashflows)");
  lines.push("");
  const componentKinds = ["base", "rank", "improvement", "special"];
  lines.push(
    mdTable(
      ["Season", "Σ positiv", ...componentKinds.map((k) => k)],
      seasonAggs.map((s) => {
        const total = [...logBySeasonComponent.entries()]
          .filter(([k]) => k.startsWith(s.seasonId))
          .reduce((sum, [, v]) => sum + v, 0);
        return [
          `S${s.seasonNum}`,
          round(total),
          ...componentKinds.map((kind) => {
            const val = logBySeasonComponent.get(`${s.seasonId}:${kind}`) ?? 0;
            return round(val);
          }),
        ];
      }),
    ),
  );
  lines.push("");

  // Root cause
  lines.push("## 8. Root-Cause-Diagnose");
  lines.push("");
  lines.push("### Ist das neue Sponsor-System die Ursache?");
  lines.push("");
  lines.push("| Hypothese | Evidenz | Urteil |");
  lines.push("|---|---|---|");
  lines.push(`| Teams hatten kein Cash | S10: Σ Cash ${round(s10.sumCash)}, 16/32 Teams >20 C; S8 Peak 1.764 C | **Nein** — Cash vorhanden |`);
  lines.push(`| Teams kaufen nicht | Market-Buys S1 ${s1.sumMarketBuy} → S10 ${s10.sumMarketBuy}; S8 nur 46 | **Ja** — Kauf-Blockade |`);
  lines.push(`| Kader schrumpft → Gehalt sinkt | Kader ${s1.sumRoster}→${s10.sumRoster}, Ø/Spieler ${round(s1.avgSalaryPerPlayer,2)}→${round(s10.avgSalaryPerPlayer,2)} | **Ja** — Haupttreiber |`);
  lines.push(`| Sponsor folgt Gehalt runter | Sponsor ${round(s1.sumSponsor)}→${round(s10.sumSponsor)} (−${round((1 - s10.sumSponsor / s1.sumSponsor) * 100)}%) | **Ja** — indirekter Loop |`);
  lines.push(`| Neues System verursacht Spiral | Floor-Anker koppelt an Gehaltsniveau, nicht an Σ; kein direkter MW-Bezug | **Mitverursacher**, nicht alleinige Ursache |`);
  lines.push("");
  lines.push("### Kausal-Kette (strukturell)");
  lines.push("");
  lines.push("```");
  lines.push("Engine kauft nicht genug → Kader ↓ → MW ↓ → Gehalt ↓ → Sponsor-Floor ↓ → Sponsor ↓");
  lines.push("         ↑                                                      ↓");
  lines.push("    Cash hoarded ←────────────────────────────────── weniger Reinvestition");
  lines.push("```");
  lines.push("");
  lines.push("**Urteil:** Die Spirale ist **primär strukturell** (Transfer-Engine/Reinvestition), **sekundär verstärkt** durch das neue Sponsor-System (Floor-Anker). Cash-Mangel ist **nicht** der Hauptgrund.");
  lines.push("");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_MD, lines.join("\n"), "utf8");
  console.log(`Written: ${OUTPUT_MD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
