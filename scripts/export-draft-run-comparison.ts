import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FULL_DIR = path.join(PROJECT_ROOT, "outputs/full-clean-redraft");
const MULTI_DIR = path.join(PROJECT_ROOT, "outputs/multi-season-s1-s6-blocked-2026-06-14T02-31-02-625Z");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs/draft-run-comparison");

const FOCUS_TEAMS = [
  { teamId: "M-M", teamName: "Mayhem Mavericks" },
  { teamId: "Z-H", teamName: "Zero Heroes" },
  { teamId: "B-P", teamName: "Black Panthers" },
  { teamId: "C-C", teamName: "Cash Creators" },
  { teamId: "W-W", teamName: "Wicked Wizards" },
];

type Row = Record<string, string>;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function readCsv(filePath: string): Row[] {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "";
  if (!content) return [];
  const [headerLine, ...lines] = content.split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  return lines
    .filter(Boolean)
    .map((line) => {
      const cells = splitCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });
}

function csvCell(value: unknown) {
  const normalized =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const content = rows.length
    ? `${[headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`
    : "";
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content, "utf8");
}

function num(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function avg(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function countBy<T>(items: T[], predicate: (item: T) => boolean) {
  return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
}

function maybeDateMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function findTeam(rows: Row[], teamId: string) {
  return rows.find((row) => row.teamCode === teamId || row.teamId === teamId) ?? null;
}

function reconstructCashSequence(params: {
  runLabel: string;
  teamId: string;
  teamName: string;
  picks: Row[];
  finalCash: number | null;
  feeField: string;
}) {
  const spend = sum(params.picks.map((pick) => num(pick[params.feeField])));
  let cash = params.finalCash == null ? null : params.finalCash + spend;
  return params.picks.map((pick, index) => {
    const fee = num(pick[params.feeField]) ?? 0;
    const cashBefore = cash;
    const cashAfter = cash == null ? null : cash - fee;
    cash = cashAfter;
    return {
      run: params.runLabel,
      pickIndex: index + 1,
      teamId: params.teamId,
      teamName: params.teamName,
      playerId: pick.playerId ?? "",
      playerName: pick.playerName ?? "",
      class: pick.class ?? "",
      race: pick.race ?? "",
      marketValue: round(num(pick.marketValue) ?? num(pick.fee)),
      salary: round(num(pick.salary)),
      cashBefore: round(cashBefore),
      cashAfter: round(cashAfter),
      reason: pick.reason || pick.source || "",
      top5RejectedCandidates: "not_logged_in_this_run",
      rejectionReason: "not_logged_in_this_run",
    };
  });
}

function inferFullMsPerPick(transferRows: Row[], pickCount: number) {
  const dates = transferRows
    .map((row) => maybeDateMs(row.happenedAt))
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);
  if (dates.length < 2 || pickCount <= 0) return null;
  return (dates[dates.length - 1] - dates[0]) / pickCount;
}

function buildMetricBlock(params: {
  runLabel: string;
  picks: Row[];
  teamRows: Row[];
  summary: Record<string, unknown>;
  marketValueField: string;
  rosterField: string;
  cashField: string;
  teamsBelowMin: string[];
  msPerPick: number | null;
  timingQuality: string;
  identityFitField?: string;
  valueScoreField?: string;
}) {
  const rosterCounts = params.teamRows.map((row) => num(row[params.rosterField]));
  const cashValues = params.teamRows.map((row) => num(row[params.cashField]));
  const marketValues = params.picks.map((row) => num(row[params.marketValueField]));
  const salaries = params.picks.map((row) => num(row.salary));
  const identityValues = params.identityFitField ? params.picks.map((row) => num(row[params.identityFitField!])) : [];
  const valueScores = params.valueScoreField ? params.picks.map((row) => num(row[params.valueScoreField!])) : [];
  return {
    runLabel: params.runLabel,
    picksTotal: params.picks.length,
    msPerPick: round(params.msPerPick),
    timingQuality: params.timingQuality,
    teamsBelowPlayerMin: params.teamsBelowMin.length,
    teamsBelowPlayerMinList: params.teamsBelowMin,
    avgCashUnused: round(avg(cashValues)),
    avgRosterCount: round(avg(rosterCounts)),
    avgPickMarketValue: round(avg(marketValues)),
    avgSalary: round(avg(salaries)),
    avgIdentityFit: round(avg(identityValues)),
    avgValueScore: round(avg(valueScores)),
    explicitCheapFallbackPicks: 0,
    cheapProxyPicksFeeLte15: countBy(marketValues, (value) => (value ?? Number.POSITIVE_INFINITY) <= 15),
    topCandidateRejectedCashSalaryFilters: null,
    rejectionLogging: "not_available_in_historical_outputs",
    summary: params.summary,
  };
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const fullSummaryFile = readJson<{ summary: Record<string, unknown>; teamEconomy?: unknown; warnings?: unknown }>(
  path.join(FULL_DIR, "full-clean-redraft-summary.json"),
);
const fullSummary = fullSummaryFile.summary;
const fullPicks = readCsv(path.join(FULL_DIR, "full-clean-redraft-picks.csv"));
const fullTeams = readCsv(path.join(FULL_DIR, "full-clean-redraft-team-economy.csv"));
const fullTransfers = readCsv(path.join(FULL_DIR, "full-clean-redraft-transfer-history.csv"));

const multiSummary = readJson<Record<string, unknown>>(path.join(MULTI_DIR, "multi-season-s1-s6-summary.json"));
const multiPicks = readCsv(path.join(MULTI_DIR, "ai-market-actions-s1-s6.csv"));
const multiTeams = readCsv(path.join(MULTI_DIR, "roster-size-s1-s6.csv"));

const fullTeamsBelowMin = ((fullSummary.teamsUnderMin as string[] | undefined) ?? []).map(String);
const multiTeamsBelowMin =
  ((multiSummary.teamsBelowMin as Array<{ teamId: string }> | undefined) ?? []).map((team) => team.teamId);

const metrics = [
  buildMetricBlock({
    runLabel: "run1_full_clean_redraft",
    picks: fullPicks,
    teamRows: fullTeams,
    summary: {
      saveId: fullSummary.saveId,
      saveName: fullSummary.saveName,
      stopReason: fullSummary.stopReason,
      runnerStoppedAt: fullSummary.runnerStoppedAt,
    },
    marketValueField: "marketValue",
    rosterField: "finalRosterCount",
    cashField: "cashEnd",
    teamsBelowMin: fullTeamsBelowMin,
    msPerPick: inferFullMsPerPick(fullTransfers, fullPicks.length),
    timingQuality: "transferHistory timestamp window; excludes final 5min no-output hang",
    identityFitField: "teamFit",
    valueScoreField: "valueScore",
  }),
  buildMetricBlock({
    runLabel: "run2_multiseason_s1_topup_oom",
    picks: multiPicks,
    teamRows: multiTeams,
    summary: {
      saveId: multiSummary.saveId,
      saveName: multiSummary.saveName,
      blocker: multiSummary.blocker,
      blockerPhase: multiSummary.blockerPhase,
      lastObservedPhase: multiSummary.lastObservedPhase,
    },
    marketValueField: "fee",
    rosterField: "rosterCount",
    cashField: "cash",
    teamsBelowMin: multiTeamsBelowMin,
    msPerPick: null,
    timingQuality: "not logged; run ended in node_out_of_memory_during_topup",
  }),
];

const modeDiffRows = [
  {
    field: "saveId",
    run1_full_clean_redraft: fullSummary.saveId,
    run2_multiseason_s1_topup_oom: multiSummary.saveId,
    impact: "Different saves; both started as clean S1 contexts, but run2 was created by long-run sandbox autoprep.",
  },
  {
    field: "runner/script",
    run1_full_clean_redraft: "scripts/clean-redraft-v2.ts / ai_full_clean_redraft",
    run2_multiseason_s1_topup_oom: "scripts/long-run-sandbox-s1-s6.ts -> old season1_autoprep_topup",
    impact: "Run1 used dedicated redraft planner; run2 used the old initial-fill helper inside the long-run.",
  },
  {
    field: "mode",
    run1_full_clean_redraft: "full_clean_redraft",
    run2_multiseason_s1_topup_oom: "season1_initial_topup during multi-season prep",
    impact: "Run1 was a draft audit; run2 was a pre-matchday safety fill.",
  },
  {
    field: "target",
    run1_full_clean_redraft: "intended redraft/ready, but stopped in draft round 9; many teams only reached 8 picks",
    run2_multiseason_s1_topup_oom: "playerOpt-ish topup capped by roster rules; 31/32 teams reached min and many reached opt",
    impact: "Run2 bought more because its target continued past playerMin; run1 stopped before opt phase completed.",
  },
  {
    field: "roundLimit",
    run1_full_clean_redraft: "stepsPerTeam default 12, observed stop at round 9 planning",
    run2_multiseason_s1_topup_oom: "implicit while-loop until target; no safe chunk/round flush in historical run",
    impact: "Run1 was interrupted; run2 kept scanning until memory failed.",
  },
  {
    field: "teamTimeLimitMs",
    run1_full_clean_redraft: "not present in historical output",
    run2_multiseason_s1_topup_oom: "not present in old topup; last phase Z-H 0/11 before OOM",
    impact: "Neither historical run had the new per-team bounded chunk controls.",
  },
  {
    field: "shortlist size",
    run1_full_clean_redraft: "planner-specific, not recorded in output",
    run2_multiseason_s1_topup_oom: "not recorded; behavior indicates repeated broad pool scans and first affordable/cheap candidates",
    impact: "Cannot prove exact shortlist count from old artifacts; rejection logging was missing.",
  },
  {
    field: "candidate filters",
    run1_full_clean_redraft: "identity/team/value-oriented planner fields exist, but pick scores were reconstructed empty after timeout",
    run2_multiseason_s1_topup_oom: "basic active/free-agent/affordable roster fill; no identityFit/valueScore exported",
    impact: "Run2 had weaker quality signals in persisted output and likely selected cheaper fallback candidates.",
  },
  {
    field: "budget reserve rules",
    run1_full_clean_redraft: "spent many teams near cash floor; M-M 325 -> 24.54",
    run2_multiseason_s1_topup_oom: "large cash remained; M-M ended 196.41 after 11-player roster",
    impact: "Run2 poor picks were not explained by cash shortage for focus teams.",
  },
  {
    field: "salary reserve rules",
    run1_full_clean_redraft: "salarySum tracked in team economy; no salary rejection log",
    run2_multiseason_s1_topup_oom: "salarySum tracked only final; no salary rejection log",
    impact: "No evidence that salary reserve caused worse picks; exact rejected candidates were not logged.",
  },
  {
    field: "topup source",
    run1_full_clean_redraft: "ai_full_clean_redraft",
    run2_multiseason_s1_topup_oom: "season1_autoprep_topup",
    impact: "This is the main behavioral split.",
  },
  {
    field: "buy service path",
    run1_full_clean_redraft: "official local transfer/buy history path, later reconstructed after timeout",
    run2_multiseason_s1_topup_oom: "official local buy path per pick, but with repeated full pool/feed rebuilds",
    impact: "Cash/history were written, but run2 paid high memory/perf cost.",
  },
  {
    field: "scoring function",
    run1_full_clean_redraft: "AI pick planner scoring intended; persisted score fields unavailable after timeout",
    run2_multiseason_s1_topup_oom: "old topup fill metric/fallback, no identityFit/valueScore persisted",
    impact: "Run2 maximized filling roster slots more than pick quality.",
  },
  {
    field: "fallback behavior",
    run1_full_clean_redraft: "stopped/hung before completion; no fallback rejection detail",
    run2_multiseason_s1_topup_oom: "continued buying low-fee candidates until target/OOM",
    impact: "Run2 bought more players but diluted quality with cheap fallback-like picks.",
  },
];

const focusRows = FOCUS_TEAMS.map((team) => {
  const fullTeam = findTeam(fullTeams, team.teamId);
  const multiTeam = findTeam(multiTeams, team.teamId);
  const fullTeamPicks = fullPicks.filter((pick) => pick.teamCode === team.teamId);
  const multiTeamPicks = multiPicks.filter((pick) => pick.toTeamId === team.teamId);
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    run1_roster: num(fullTeam?.finalRosterCount),
    run1_playerMin: num(fullTeam?.playerMin),
    run1_playerOpt: num(fullTeam?.playerOpt),
    run1_cashEnd: round(num(fullTeam?.cashEnd)),
    run1_pickCount: fullTeamPicks.length,
    run1_avgMarketValue: round(avg(fullTeamPicks.map((pick) => num(pick.marketValue)))),
    run2_roster: num(multiTeam?.rosterCount),
    run2_playerMin: num(multiTeam?.playerMin),
    run2_playerOpt: num(multiTeam?.playerOpt),
    run2_cashEnd: round(num(multiTeam?.cash)),
    run2_pickCount: multiTeamPicks.length,
    run2_avgMarketValue: round(avg(multiTeamPicks.map((pick) => num(pick.fee)))),
    interpretation:
      team.teamId === "Z-H"
        ? "Run2 OOM happened while trying to finish this team; it stayed below min despite high cash."
        : "Run2 usually bought more players, but at lower average fee/value than the full-clean picks.",
  };
});

const mayhemFull = reconstructCashSequence({
  runLabel: "run1_full_clean_redraft",
  teamId: "M-M",
  teamName: "Mayhem Mavericks",
  picks: fullPicks.filter((pick) => pick.teamCode === "M-M"),
  finalCash: num(findTeam(fullTeams, "M-M")?.cashEnd),
  feeField: "marketValue",
});
const mayhemMulti = reconstructCashSequence({
  runLabel: "run2_multiseason_s1_topup_oom",
  teamId: "M-M",
  teamName: "Mayhem Mavericks",
  picks: multiPicks.filter((pick) => pick.toTeamId === "M-M"),
  finalCash: num(findTeam(multiTeams, "M-M")?.cash),
  feeField: "fee",
});

const run1PhaseAReached = fullTeams.filter((row) => (num(row.finalRosterCount) ?? 0) >= (num(row.playerMin) ?? 0)).length;
const run1PhaseBReached = fullTeams.filter((row) => (num(row.finalRosterCount) ?? 0) >= (num(row.playerOpt) ?? 0)).length;
const run2PhaseAReached = multiTeams.filter((row) => (num(row.rosterCount) ?? 0) >= (num(row.playerMin) ?? 0)).length;
const run2PhaseBReached = multiTeams.filter((row) => (num(row.rosterCount) ?? 0) >= (num(row.playerOpt) ?? 0)).length;

const diagnosis = {
  answers: {
    A_why_run1_only_about_8_players:
      "Run1 did not finish. It stopped at draft round 9 planning after no phase output for over 5 minutes. Teams with playerMin <= 8 could look complete, but 19 teams stayed below min and almost nobody reached opt. The observed ~8 players are therefore mostly the number of completed draft rounds, not a good target decision.",
    B_why_run2_more_but_worse_cheaper:
      "Run2 used the old season1_autoprep_topup inside the multi-season runner. That helper kept filling toward opt/target, so it bought 341 players, but the persisted output has no identityFit/valueScore and the picks are much cheaper on average. The behavior points to safety-fill/cheap-affordable selection rather than the full redraft quality planner.",
    C_responsible_rule_phase_filter:
      "Run1 blocker: full_clean_redraft runner hang at draft round 9. Run2 blocker: old season1_autoprep_topup target loop plus repeated full-pool/feed rebuilds; it favored roster completion and cheap affordable candidates, then failed with node_out_of_memory_during_topup.",
    D_next_needed_change:
      "Use the chunked redraft/topup service as the only S1 initial-fill path, keep Phase A playerMin bounded, then add a quality-aware Phase B toward playerOpt with logged topRejected candidates/filter reasons before touching balance values.",
  },
  phaseReach: {
    run1: {
      teamsAtOrAbovePlayerMin: run1PhaseAReached,
      teamsAtOrAbovePlayerOpt: run1PhaseBReached,
      teamCount: fullTeams.length,
      phaseADominated: true,
      phaseBReached: run1PhaseBReached > 0,
    },
    run2: {
      teamsAtOrAbovePlayerMin: run2PhaseAReached,
      teamsAtOrAbovePlayerOpt: run2PhaseBReached,
      teamCount: multiTeams.length,
      phaseADominated: false,
      phaseBReached: run2PhaseBReached > 0,
    },
  },
  shortlistFinding:
    "Exact historical shortlist size and top-5 rejections are not recoverable from the two old outputs. This is a logging gap, not proof of a specific candidate-size threshold.",
  cashReserveFinding:
    "For Mayhem Mavericks, run2 ended with large unused cash after reaching opt, so cash reserve did not force the cheap picks there. For run1, M-M spent down to 24.54 and stopped at min, but the global stop reason was runner hang rather than cash reserve.",
};

const comparison = {
  generatedAt: new Date().toISOString(),
  sourceRuns: {
    run1: {
      label: "run1_full_clean_redraft",
      dir: path.relative(PROJECT_ROOT, FULL_DIR),
      saveId: fullSummary.saveId,
      runner: "scripts/clean-redraft-v2.ts",
    },
    run2: {
      label: "run2_multiseason_s1_topup_oom",
      dir: path.relative(PROJECT_ROOT, MULTI_DIR),
      saveId: multiSummary.saveId,
      runner: "scripts/long-run-sandbox-s1-s6.ts",
    },
  },
  metrics,
  modeDiffRows,
  focusRows,
  mayhemMavericks: {
    cashSequences: [...mayhemFull, ...mayhemMulti],
    hadEnoughCashForBetterPlayers:
      "Run2: yes, M-M ended with 196.41 cash after 11 players; cheap picks were target/path behavior, not affordability. Run1: M-M started with enough cash and spent most of it, but the run stopped after min before opt.",
    rejectedCandidateAudit:
      "Top-5 rejected candidates per pick were not logged in either historical run, so exact rejection reasons cannot be reconstructed without rerunning with rejection instrumentation.",
  },
  diagnosis,
};

writeCsv("draft-mode-diff.csv", modeDiffRows);
writeCsv("draft-focus-team-diff.csv", focusRows);
writeCsv("draft-mayhem-picks.csv", [...mayhemFull, ...mayhemMulti]);
fs.writeFileSync(path.join(OUTPUT_DIR, "draft-run-comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`, "utf8");

const md = `# Draft Run Comparison

Generated: ${comparison.generatedAt}

## Executive Diagnosis

**A) Warum Lauf 1 nur ca. 8 Spieler pro Team erzeugte**

Run 1 war kein abgeschlossener Draft. Der Full-Clean-Redraft stoppte bei **draft round 9 planning** nach über 5 Minuten ohne Phasen-Output. Dadurch sehen viele Teams wie "8-Spieler-Teams" aus: das ist hauptsächlich die Anzahl der abgeschlossenen Runden, nicht ein sauber erreichter Zielzustand. Ergebnis: **${fullPicks.length} Picks**, **${fullTeamsBelowMin.length} Teams unter playerMin**, nur **${run1PhaseBReached}/${fullTeams.length} Teams bei playerOpt**.

**B) Warum Lauf 2 mehr, aber schlechter/billiger kaufte**

Run 2 lief über den alten **season1_autoprep_topup** im Multi-Season-Runner. Dieser Pfad kaufte weiter Richtung Opt/Target und kam deshalb auf **${multiPicks.length} Picks**, aber die Picks waren deutlich günstiger: avg fee **${metrics[1].avgPickMarketValue}** statt Run-1 avg market value **${metrics[0].avgPickMarketValue}**. Der Pfad war ein Sicherheits-Topup mit schwächeren/fehlenden Qualitäts-Signalen im Output, nicht der hochwertige Full-Redraft-Planner.

**C) Verantwortliche Regel/Phase/Filter**

Run 1: technischer Stop im Full-Clean-Redraft bei Runde 9.  
Run 2: alter S1-Topup-Pfad mit Ziel Richtung playerOpt, wiederholten Full-Pool-/Feed-Rebuilds und cheap-affordable/fallback-artiger Kandidatenauswahl. Der Lauf endete mit **${multiSummary.blocker}** in **${multiSummary.blockerPhase}**.

**D) Nötige Änderung danach**

Nicht balancieren, bevor der Initial-Fill-Pfad vereinheitlicht ist: S1 initial fill nur noch über den chunked Redraft/Topup-Service, Phase A sauber bis playerMin, danach eine explizite qualitätsbewusste Phase B Richtung playerOpt. Zusätzlich müssen Top-5-Rejections und Filtergründe pro Pick geloggt werden, sonst bleibt die genaue Rejection-Frage bei historischen Läufen blind.

## Metrics

| Metric | Run 1 Full Clean | Run 2 Multi Topup |
|---|---:|---:|
| Picks total | ${metrics[0].picksTotal} | ${metrics[1].picksTotal} |
| ms per pick | ${metrics[0].msPerPick ?? "n/a"} | ${metrics[1].msPerPick ?? "n/a"} |
| Teams below playerMin | ${metrics[0].teamsBelowPlayerMin} | ${metrics[1].teamsBelowPlayerMin} |
| Avg cash unused | ${metrics[0].avgCashUnused} | ${metrics[1].avgCashUnused} |
| Avg roster count | ${metrics[0].avgRosterCount} | ${metrics[1].avgRosterCount} |
| Avg pick market value | ${metrics[0].avgPickMarketValue} | ${metrics[1].avgPickMarketValue} |
| Avg salary | ${metrics[0].avgSalary} | ${metrics[1].avgSalary} |
| Avg identityFit | ${metrics[0].avgIdentityFit ?? "not logged"} | ${metrics[1].avgIdentityFit ?? "not logged"} |
| Avg valueScore | ${metrics[0].avgValueScore ?? "not logged"} | ${metrics[1].avgValueScore ?? "not logged"} |
| Cheap proxy picks <= 15 | ${metrics[0].cheapProxyPicksFeeLte15} | ${metrics[1].cheapProxyPicksFeeLte15} |

## Focus Teams

| Team | Run 1 roster | Run 1 cash | Run 1 avg MV | Run 2 roster | Run 2 cash | Run 2 avg fee | Note |
|---|---:|---:|---:|---:|---:|---:|---|
${focusRows
  .map(
    (row) =>
      `| ${row.teamId} ${row.teamName} | ${row.run1_roster ?? ""} | ${row.run1_cashEnd ?? ""} | ${row.run1_avgMarketValue ?? ""} | ${row.run2_roster ?? ""} | ${row.run2_cashEnd ?? ""} | ${row.run2_avgMarketValue ?? ""} | ${row.interpretation} |`,
  )
  .join("\n")}

## Mayhem Mavericks Detail

Mayhem Mavericks had enough budget for stronger players in Run 2: reconstructed final cash is **196.41** after reaching **11 players**. The cheapness is therefore not a cash-reserve explanation for M-M; it is caused by the old topup mode/target/path. In Run 1, M-M reached **8 players**, spent down to **24.54**, and then the whole runner stopped before opt.

Top-5 rejected candidates per pick are **not available** in either historical output. That exact question needs rejection instrumentation in the next measured run; it cannot be reconstructed truthfully from these files.

## Files

- \`draft-run-comparison.json\`
- \`draft-mode-diff.csv\`
- \`draft-focus-team-diff.csv\`
- \`draft-mayhem-picks.csv\`
`;

fs.writeFileSync(path.join(OUTPUT_DIR, "draft-run-comparison.md"), md, "utf8");

console.log(
  JSON.stringify(
    {
      outputDir: path.relative(PROJECT_ROOT, OUTPUT_DIR),
      files: [
        "draft-run-comparison.md",
        "draft-run-comparison.json",
        "draft-mode-diff.csv",
        "draft-focus-team-diff.csv",
        "draft-mayhem-picks.csv",
      ],
      run1Picks: fullPicks.length,
      run2Picks: multiPicks.length,
      run1TeamsBelowMin: fullTeamsBelowMin.length,
      run2TeamsBelowMin: multiTeamsBelowMin.length,
    },
    null,
    2,
  ),
);
