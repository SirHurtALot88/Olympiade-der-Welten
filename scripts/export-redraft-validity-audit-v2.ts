import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const OLD_REDFRAFT_DIR = process.env.OLY_OLD_REDFRAFT_DIR ?? path.join(PROJECT_ROOT, "outputs/full-clean-redraft");
const OUTPUT_DIR =
  process.env.OLY_REDFRAFT_VALIDITY_AUDIT_DIR ??
  path.join(PROJECT_ROOT, "outputs/redraft-validity-audit-v2");

type OldSummary = {
  summary?: {
    teamsUnderMin?: Array<{ teamId: string; rosterCount: number; playerMin: number }>;
    invalidReasons?: string[];
    stopReason?: string;
  };
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readCsv(filePath: string) {
  if (!fs.existsSync(filePath)) return [] as Array<Record<string, string>>;
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const headers = lines[0]?.split(",").map((header) => header.replace(/^"|"$/g, "")) ?? [];
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").replace(/^"|"$/g, "").replaceAll('""', '"')]));
  });
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  fs.writeFileSync(
    path.join(OUTPUT_DIR, fileName),
    `${[headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function main() {
  const summary = readJson<OldSummary>(path.join(OLD_REDFRAFT_DIR, "full-clean-redraft-summary.json"));
  const teams = readCsv(path.join(OLD_REDFRAFT_DIR, "full-clean-redraft-team-economy.csv"));
  const picks = readCsv(path.join(OLD_REDFRAFT_DIR, "full-clean-redraft-picks.csv"));
  const transferHistory = readCsv(path.join(OLD_REDFRAFT_DIR, "full-clean-redraft-transfer-history.csv"));
  const teamsUnderMinFromSummary = summary?.summary?.teamsUnderMin ?? [];
  const teamsUnderMin = teams.length
    ? teams
        .filter((row) => Number(row.finalRosterCount ?? row.rosterAfter ?? row.rosterCount ?? 0) < Number(row.playerMin ?? row.minimumRoster ?? 8))
        .map((row) => ({
          teamId: row.teamId ?? row.teamCode ?? "",
          teamName: row.teamName ?? "",
          rosterCount: Number(row.finalRosterCount ?? row.rosterAfter ?? row.rosterCount ?? 0),
          playerMin: Number(row.playerMin ?? row.minimumRoster ?? 8),
          cash: Number(row.cashAfter ?? row.cashEnd ?? row.cash ?? 0),
        }))
    : teamsUnderMinFromSummary.map((row) => ({ ...row, teamName: "", cash: null }));
  const cashLeftWhileBelowMin = teamsUnderMin.filter((row) => Number(row.cash ?? 0) > 0);
  const reconstructedPicks = picks.filter((row) =>
    Object.values(row).some((value) => value.includes("reconstructed_from_transfer_history") || value.includes("reconstructed")),
  );
  const missingPickScores = picks.filter((row) => {
    const score = row.pickScore ?? row.selectedScore ?? row.aiScore ?? "";
    return score === "" || score === "0" || !Number.isFinite(Number(score));
  });
  const invalidReasons = [
    teamsUnderMin.length > 0 ? "teams_below_player_min" : null,
    cashLeftWhileBelowMin.length > 0 ? "cash_left_while_below_min" : null,
    missingPickScores.length > 0 ? "missing_pick_scores" : null,
    reconstructedPicks.length > 0 ? "picks_reconstructed_from_transferhistory" : null,
    transferHistory.length < picks.length ? "transferhistory_incomplete" : null,
    summary?.summary?.stopReason?.match(/timeout|oom|abort/i) ? "draft_aborted_or_timed_out" : null,
  ].filter((entry): entry is string => Boolean(entry));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "last-full-clean-redraft-invalid.md"),
    [
      "# Last Full Clean Redraft Validity Audit",
      "",
      "- DRAFT_VALID = false",
      `- Quelle: ${OLD_REDFRAFT_DIR}`,
      `- Teams unter Min: ${teamsUnderMin.length}`,
      `- Teams mit Cash trotz unter Min: ${cashLeftWhileBelowMin.length}`,
      `- Picks ohne Score: ${missingPickScores.length}`,
      `- Rekonstruierte Picks: ${reconstructedPicks.length}`,
      `- Transferhistory Rows: ${transferHistory.length}`,
      `- Pick Rows: ${picks.length}`,
      "",
      "## Hard-Fail Gruende",
      ...invalidReasons.map((reason) => `- ${reason}`),
      "",
      "## Teams unter Min",
      ...teamsUnderMin.map((row) => `- ${row.teamId}: ${row.rosterCount}/${row.playerMin}, Cash ${row.cash ?? "?"}`),
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "last-full-clean-redraft-invalid.json"),
    `${JSON.stringify(
      {
        draftValid: false,
        sourceDir: OLD_REDFRAFT_DIR,
        invalidReasons,
        teamsUnderMin,
        cashLeftWhileBelowMin,
        missingPickScoreCount: missingPickScores.length,
        reconstructedPickCount: reconstructedPicks.length,
        transferHistoryRows: transferHistory.length,
        pickRows: picks.length,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeCsv("last-full-clean-redraft-teams-under-min.csv", teamsUnderMin);
  writeCsv("last-full-clean-redraft-missing-pick-scores.csv", missingPickScores);
  console.log(
    JSON.stringify(
      {
        outputDir: OUTPUT_DIR,
        draftValid: false,
        invalidReasons,
        teamsUnderMin: teamsUnderMin.length,
        cashLeftWhileBelowMin: cashLeftWhileBelowMin.length,
        missingPickScoreCount: missingPickScores.length,
      },
      null,
      2,
    ),
  );
}

main();
