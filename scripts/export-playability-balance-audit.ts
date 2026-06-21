import fs from "node:fs";
import path from "node:path";

const OUTPUT_ROOT = process.env.OLY_EXPORT_DIR ?? "outputs";
const SOURCE_DIR =
  process.env.OLY_PLAYABILITY_AUDIT_SOURCE_DIR ??
  findLatestAuditDir(OUTPUT_ROOT, "pick-market-gv-salary-audit-");

type CsvRow = Record<string, string>;

type PlayabilityRow = {
  run: string;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  gmArchetype: string;
  gvGroup: string;
  rosterAfterMarket: number;
  playerOpt: number;
  playerMax: number;
  cashAfterMarket: number;
  salaryAfterMarket: number;
  marketValueAfterMarket: number;
  avgPow: number;
  avgSpe: number;
  avgMen: number;
  avgSoc: number;
  avgCore: number;
  salaryToMarketPct: number;
  cashBufferToSalaryPct: number;
  marketReaction: string;
  playabilityStatus: "ok" | "watch" | "red";
  diagnosis: string;
};

type DominanceRow = {
  run: string;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  sampleScope: string;
  marketValueRank: number;
  salaryRank: number;
  avgCoreRank: number;
  cashRank: number;
  dominanceRiskScore: number;
  permanentWinnerRisk: "low" | "watch" | "red";
  permanentBankruptRisk: "low" | "watch" | "red";
  diagnosis: string;
};

type IdentityRow = {
  run: string;
  gmArchetype: string;
  teams: number;
  avgPickScore: number;
  avgIdentityFit: number;
  avgBudgetFit: number;
  avgValueScore: number;
  buys: number;
  sells: number;
  negativeAfterMarket: number;
  redPickReasons: number;
  redTransferIntents: number;
  behaviorStatus: "ok" | "watch" | "red";
  diagnosis: string;
};

type EconomyDriftRow = {
  run: string;
  saveId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  sampleScope: string;
  cashAfterMarket: number;
  salaryAfterMarket: number;
  marketValueAfterMarket: number;
  salaryToMarketPct: number;
  maxPlayerMarketValue: number;
  maxPlayerSalary: number;
  guardHits: number;
  driftStatus: "ok" | "watch" | "red";
  diagnosis: string;
};

function main(): void {
  if (!SOURCE_DIR) {
    throw new Error("No pick-market audit output found. Set OLY_PLAYABILITY_AUDIT_SOURCE_DIR.");
  }

  const teamRows = readCsv(path.join(SOURCE_DIR, "pick-market-gv-team-outcomes.csv"));
  const diversityRows = readCsv(path.join(SOURCE_DIR, "draft-quality-roster-diversity-audit.csv"));
  const gmRows = readCsv(path.join(SOURCE_DIR, "manager-ai-gm-behavior-audit.csv"));
  const pickRows = readCsv(path.join(SOURCE_DIR, "manager-ai-draft-pick-reasoning-audit.csv"));
  const transferRows = readCsv(path.join(SOURCE_DIR, "manager-ai-transfer-intent-audit.csv"));
  const guardRows = readCsv(path.join(SOURCE_DIR, "mw-salary-escalation-guard.csv"));

  const diversityByTeam = new Map(diversityRows.map((row) => [teamKey(row), row]));
  const guardRowsByTeam = groupBy(guardRows, (row) => teamKey(row));

  const playabilityRows = buildPlayabilityRows(teamRows, diversityByTeam);
  const dominanceRows = buildDominanceRows(playabilityRows);
  const identityRows = buildIdentityRows(gmRows, pickRows, transferRows);
  const economyRows = buildEconomyRows(playabilityRows, guardRowsByTeam);

  writeCsv(path.join(SOURCE_DIR, "playability-plausibility-audit.csv"), playabilityRows);
  writeCsv(path.join(SOURCE_DIR, "dominance-risk-audit.csv"), dominanceRows);
  writeCsv(path.join(SOURCE_DIR, "ai-identity-differentiation-audit.csv"), identityRows);
  writeCsv(path.join(SOURCE_DIR, "economy-drift-guard-audit.csv"), economyRows);
  writeMarkdownReport(SOURCE_DIR, playabilityRows, dominanceRows, identityRows, economyRows);

  const summary = {
    sourceDir: SOURCE_DIR,
    report: path.join(SOURCE_DIR, "playability-balance-audit.md"),
    playabilityRed: playabilityRows.filter((row) => row.playabilityStatus === "red").length,
    playabilityWatch: playabilityRows.filter((row) => row.playabilityStatus === "watch").length,
    dominanceWatchOrRed: dominanceRows.filter(
      (row) => row.permanentWinnerRisk !== "low" || row.permanentBankruptRisk !== "low",
    ).length,
    identityRed: identityRows.filter((row) => row.behaviorStatus === "red").length,
    identityWatch: identityRows.filter((row) => row.behaviorStatus === "watch").length,
    economyRed: economyRows.filter((row) => row.driftStatus === "red").length,
    economyWatch: economyRows.filter((row) => row.driftStatus === "watch").length,
  };
  console.log(JSON.stringify(summary, null, 2));
}

function buildPlayabilityRows(teamRows: CsvRow[], diversityByTeam: Map<string, CsvRow>): PlayabilityRow[] {
  return teamRows.map((team) => {
    const diversity = diversityByTeam.get(teamKey(team));
    const salaryAfterMarket = num(team.salaryAfterMarket);
    const marketValueAfterMarket = num(team.marketValueAfterMarket);
    const cashAfterMarket = num(team.cashAfterMarket);
    const rosterAfterMarket = num(team.rosterAfterMarket);
    const playerOpt = num(team.playerOpt);
    const playerMax = num(team.playerMax);
    const avgPow = num(diversity?.avgPow);
    const avgSpe = num(diversity?.avgSpe);
    const avgMen = num(diversity?.avgMen);
    const avgSoc = num(diversity?.avgSoc);
    const avgCore = round((avgPow + avgSpe + avgMen + avgSoc) / 4);
    const salaryToMarketPct = pct(salaryAfterMarket, marketValueAfterMarket);
    const cashBufferToSalaryPct = pct(cashAfterMarket, salaryAfterMarket);
    const executedSells = num(team.executedSells);
    const executedBuys = num(team.executedBuys);
    const diagnosis: string[] = [];

    if (cashAfterMarket < 0) diagnosis.push("cash_negative_after_market");
    if (cashAfterMarket >= 0 && cashBufferToSalaryPct < 8) diagnosis.push("cash_buffer_too_thin");
    if (rosterAfterMarket < playerOpt) diagnosis.push("below_opt_roster");
    if (rosterAfterMarket > playerMax) diagnosis.push("above_max_roster");
    if (salaryToMarketPct > 32) diagnosis.push("salary_load_high_vs_mw");
    if (avgCore < 24) diagnosis.push("team_strength_low");
    if (team.gvGroup === "minus_15" && cashAfterMarket < 5 && executedSells === 0) {
      diagnosis.push("pressure_without_sell_reaction");
    }
    if (diversity?.diversityStatus === "red") diagnosis.push("roster_diversity_red");

    const playabilityStatus =
      cashAfterMarket < 0 ||
      rosterAfterMarket < playerOpt - 1 ||
      rosterAfterMarket > playerMax ||
      salaryToMarketPct > 40 ||
      avgCore < 20
        ? "red"
        : diagnosis.length > 0
          ? "watch"
          : "ok";

    return {
      run: team.run,
      saveId: team.saveId,
      teamId: team.teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      gmArchetype: team.gmArchetype,
      gvGroup: team.gvGroup,
      rosterAfterMarket,
      playerOpt,
      playerMax,
      cashAfterMarket,
      salaryAfterMarket,
      marketValueAfterMarket,
      avgPow,
      avgSpe,
      avgMen,
      avgSoc,
      avgCore,
      salaryToMarketPct,
      cashBufferToSalaryPct,
      marketReaction: `${executedBuys} buys / ${executedSells} sells`,
      playabilityStatus,
      diagnosis: diagnosis.join("|") || "ok",
    };
  });
}

function buildDominanceRows(rows: PlayabilityRow[]): DominanceRow[] {
  const marketRank = rankMap(rows, (row) => row.marketValueAfterMarket);
  const salaryRank = rankMap(rows, (row) => row.salaryAfterMarket);
  const coreRank = rankMap(rows, (row) => row.avgCore);
  const cashRank = rankMap(rows, (row) => row.cashAfterMarket);
  const maxMarket = Math.max(...rows.map((row) => row.marketValueAfterMarket), 1);
  const maxSalary = Math.max(...rows.map((row) => row.salaryAfterMarket), 1);
  const maxCore = Math.max(...rows.map((row) => row.avgCore), 1);
  const maxCash = Math.max(...rows.map((row) => row.cashAfterMarket), 1);

  return rows.map((row) => {
    const dominanceRiskScore = round(
      (row.marketValueAfterMarket / maxMarket) * 35 +
        (row.avgCore / maxCore) * 35 +
        (row.salaryAfterMarket / maxSalary) * 15 +
        (Math.max(row.cashAfterMarket, 0) / maxCash) * 15,
    );
    const winnerRisk = dominanceRiskScore >= 85 ? "red" : dominanceRiskScore >= 76 ? "watch" : "low";
    const bankruptRisk = row.cashAfterMarket < 0 ? "red" : row.cashAfterMarket < 5 ? "watch" : "low";
    const diagnosis = [
      winnerRisk !== "low" ? "dominance_proxy_high" : "",
      bankruptRisk !== "low" ? "cash_failure_proxy" : "",
      "needs_multiseason_confirmation",
    ]
      .filter(Boolean)
      .join("|");

    return {
      run: row.run,
      saveId: row.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      sampleScope: "single_preseason_proxy",
      marketValueRank: marketRank.get(teamKey(row)) ?? 0,
      salaryRank: salaryRank.get(teamKey(row)) ?? 0,
      avgCoreRank: coreRank.get(teamKey(row)) ?? 0,
      cashRank: cashRank.get(teamKey(row)) ?? 0,
      dominanceRiskScore,
      permanentWinnerRisk: winnerRisk,
      permanentBankruptRisk: bankruptRisk,
      diagnosis,
    };
  });
}

function buildIdentityRows(gmRows: CsvRow[], pickRows: CsvRow[], transferRows: CsvRow[]): IdentityRow[] {
  const redPicksByArchetype = countBy(
    pickRows.filter((row) => row.status === "red"),
    (row) => row.gmArchetype,
  );
  const redTransfersByArchetype = countBy(
    transferRows.filter((row) => row.intentStatus === "red"),
    (row) => row.gmArchetype,
  );

  return gmRows.map((row) => {
    const redPickReasons = redPicksByArchetype.get(row.gmArchetype) ?? 0;
    const redTransferIntents = redTransfersByArchetype.get(row.gmArchetype) ?? 0;
    const avgPickScore = num(row.avgPickScore);
    const avgBudgetFit = num(row.avgBudgetFit);
    const negativeAfterMarket = num(row.negativeAfterMarket);
    const diagnosis: string[] = [];

    if (avgPickScore < -1000 || avgBudgetFit < -1000) diagnosis.push("draft_score_explodes_negative");
    if (negativeAfterMarket > 0) diagnosis.push("archetype_leaves_negative_cash");
    if (redPickReasons > 0) diagnosis.push("red_draft_pick_reasoning");
    if (redTransferIntents > 0) diagnosis.push("red_transfer_intent");

    const behaviorStatus =
      avgPickScore < -10000 || negativeAfterMarket >= 2 || redTransferIntents >= 2
        ? "red"
        : diagnosis.length > 0
          ? "watch"
          : "ok";

    return {
      run: row.run,
      gmArchetype: row.gmArchetype,
      teams: num(row.teams),
      avgPickScore,
      avgIdentityFit: num(row.avgIdentityFit),
      avgBudgetFit,
      avgValueScore: num(row.avgValueScore),
      buys: num(row.buys),
      sells: num(row.sells),
      negativeAfterMarket,
      redPickReasons,
      redTransferIntents,
      behaviorStatus,
      diagnosis: diagnosis.join("|") || "ok",
    };
  });
}

function buildEconomyRows(rows: PlayabilityRow[], guardRowsByTeam: Map<string, CsvRow[]>): EconomyDriftRow[] {
  return rows.map((row) => {
    const guards = guardRowsByTeam.get(teamKey(row)) ?? [];
    const maxPlayerMarketValue = round(Math.max(0, ...guards.map((guard) => num(guard.marketValue))));
    const maxPlayerSalary = round(Math.max(0, ...guards.map((guard) => num(guard.salary))));
    const redGuardHits = guards.filter((guard) => guard.guardStatus === "red").length;
    const watchGuardHits = guards.filter((guard) => guard.guardStatus === "watch").length;
    const guardHits = redGuardHits + watchGuardHits;
    const diagnosis: string[] = [];

    if (row.cashAfterMarket < 0) diagnosis.push("team_cash_negative");
    if (row.salaryToMarketPct > 32) diagnosis.push("team_salary_to_mw_high");
    if (redGuardHits > 0) diagnosis.push("player_mw_salary_guard_red");
    if (maxPlayerMarketValue > 120) diagnosis.push("player_mw_over_120");
    if (maxPlayerSalary > 30) diagnosis.push("player_salary_over_30");
    diagnosis.push("needs_multiseason_drift_sample");

    const driftStatus =
      row.cashAfterMarket < 0 ||
      row.salaryToMarketPct > 40 ||
      redGuardHits > 0 ||
      maxPlayerMarketValue > 120 ||
      maxPlayerSalary > 35
        ? "red"
        : diagnosis.length > 1 || guardHits > 0
          ? "watch"
          : "ok";

    return {
      run: row.run,
      saveId: row.saveId,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      sampleScope: "single_preseason_guard",
      cashAfterMarket: row.cashAfterMarket,
      salaryAfterMarket: row.salaryAfterMarket,
      marketValueAfterMarket: row.marketValueAfterMarket,
      salaryToMarketPct: row.salaryToMarketPct,
      maxPlayerMarketValue,
      maxPlayerSalary,
      guardHits,
      driftStatus,
      diagnosis: diagnosis.join("|"),
    };
  });
}

function writeMarkdownReport(
  outputDir: string,
  playabilityRows: PlayabilityRow[],
  dominanceRows: DominanceRow[],
  identityRows: IdentityRow[],
  economyRows: EconomyDriftRow[],
): void {
  const redPlayability = playabilityRows.filter((row) => row.playabilityStatus === "red");
  const watchPlayability = playabilityRows.filter((row) => row.playabilityStatus === "watch");
  const dominanceRisks = dominanceRows.filter(
    (row) => row.permanentWinnerRisk !== "low" || row.permanentBankruptRisk !== "low",
  );
  const identityProblems = identityRows.filter((row) => row.behaviorStatus !== "ok");
  const economyProblems = economyRows.filter((row) => row.driftStatus !== "ok");

  const lines = [
    "# Playability Balance Audit",
    "",
    `Source: ${outputDir}`,
    "",
    "## Kurzfazit",
    "",
    `- Plausibilitaet: ${redPlayability.length} red, ${watchPlayability.length} watch.`,
    `- Dominanz/Pleite-Risiko: ${dominanceRisks.length} Teams mit Proxy-Signal.`,
    `- AI-Identitaet: ${identityProblems.length} GM-Archetypen mit watch/red.`,
    `- Economy Drift Guard: ${economyProblems.length} Teams mit watch/red.`,
    "",
    "Hinweis: Dominanz und Economy-Drift sind hier bewusst als Single-Run-Fruehwarnung markiert. Fuer echte Aussagen wie 'immer gewinnt' oder 'ueber mehrere Seasons eskaliert' muss derselbe Guard auf einen Multi-Season-Archivlauf angewendet werden.",
    "",
    "## Wichtigste Plausibilitaets-Probleme",
    "",
    ...redPlayability.slice(0, 12).map((row) => {
      return `- ${row.teamCode} ${row.teamName}: Cash ${row.cashAfterMarket}, Gehalt ${row.salaryAfterMarket}, MW ${row.marketValueAfterMarket}, Kader ${row.rosterAfterMarket}/${row.playerOpt}; ${row.diagnosis}`;
    }),
    "",
    "## Dominanz- und Pleite-Risiko",
    "",
    ...dominanceRisks.slice(0, 12).map((row) => {
      return `- ${row.teamCode} ${row.teamName}: Dominanz ${row.dominanceRiskScore}, Winner ${row.permanentWinnerRisk}, Pleite ${row.permanentBankruptRisk}; ${row.diagnosis}`;
    }),
    "",
    "## AI-Identitaet",
    "",
    ...identityProblems.map((row) => {
      return `- ${row.gmArchetype}: ${row.behaviorStatus}; Picks ${row.redPickReasons} red, Transfers ${row.redTransferIntents} red, negative Teams ${row.negativeAfterMarket}; ${row.diagnosis}`;
    }),
    "",
    "## Economy Drift Guard",
    "",
    ...economyProblems.slice(0, 12).map((row) => {
      return `- ${row.teamCode} ${row.teamName}: Cash ${row.cashAfterMarket}, Gehalt ${row.salaryAfterMarket}, MW ${row.marketValueAfterMarket}, Salary/MW ${row.salaryToMarketPct}%, GuardHits ${row.guardHits}; ${row.diagnosis}`;
    }),
    "",
    "## Dateien",
    "",
    "- playability-plausibility-audit.csv",
    "- dominance-risk-audit.csv",
    "- ai-identity-differentiation-audit.csv",
    "- economy-drift-guard-audit.csv",
  ];

  fs.writeFileSync(path.join(outputDir, "playability-balance-audit.md"), `${lines.join("\n")}\n`);
}

function findLatestAuditDir(root: string, prefix: string): string {
  if (!fs.existsSync(root)) return "";
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(root, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] ?? "";
}

function readCsv(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function writeCsv<T extends Record<string, unknown>>(filePath: string, rows: T[]): void {
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function teamKey(row: { run?: string | number; teamId?: string }): string {
  return `${row.run ?? ""}:${row.teamId ?? ""}`;
}

function groupBy<T>(rows: T[], getKey: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function countBy<T>(rows: T[], getKey: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rankMap<T extends { run: string; teamId: string }>(rows: T[], value: (row: T) => number): Map<string, number> {
  return new Map(
    [...rows]
      .sort((a, b) => value(b) - value(a))
      .map((row, index) => [teamKey(row), index + 1]),
  );
}

function num(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part: number, total: number): number {
  if (!Number.isFinite(total) || total === 0) return 0;
  return round((part / total) * 100);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

main();
