/**
 * One-off report builder: parses the 10 existing checkpoint-season-{1..10}.md files
 * (outputs/s1-s10-validated-run-1/) and produces a per-team, per-season CSV of
 * (MW + Cash) and roster size ("Kader"), for a quick visual trend overview.
 *
 * Usage: npx tsx scripts/build-season-mw-cash-roster-csv.ts
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CHECKPOINT_DIR = path.join(PROJECT_ROOT, "outputs/s1-s10-validated-run-1");
const OUTPUT_CSV = path.join(CHECKPOINT_DIR, "team-mw-cash-roster-by-season.csv");

type TeamRow = { team: string; cash: number; mw: number; kader: number };

function parseGermanNumber(raw: string): number {
  return Number(raw.trim().replace(/\./g, "").replace(",", "."));
}

function parseCheckpoint(filePath: string): Map<string, TeamRow> {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const result = new Map<string, TeamRow>();

  const headerIndex = lines.findIndex((line) => line.startsWith("| Team | Cash | MW | Kader"));
  if (headerIndex === -1) {
    throw new Error(`Could not find team table header in ${filePath}`);
  }

  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const cells = line.split("|").map((cell) => cell.trim());
    // cells[0] is "" (before first pipe); cells[1..] are Team, Cash, MW, Kader, hardMin, Opt, Gehalt, ...
    const team = cells[1];
    if (!team) break;
    const cash = parseGermanNumber(cells[2]);
    const mw = parseGermanNumber(cells[3]);
    const kader = Number(cells[4].trim());
    result.set(team, { team, cash, mw, kader });
  }

  return result;
}

function main() {
  const seasons = Array.from({ length: 10 }, (_, i) => i + 1);
  const perSeasonData = new Map<number, Map<string, TeamRow>>();

  for (const season of seasons) {
    const filePath = path.join(CHECKPOINT_DIR, `checkpoint-season-${season}.md`);
    perSeasonData.set(season, parseCheckpoint(filePath));
  }

  const allTeams = Array.from(perSeasonData.get(1)!.keys()).sort((a, b) => a.localeCompare(b));

  const header = ["Team", ...seasons.flatMap((s) => [`S${s}_MW_Cash`, `S${s}_Kader`])];
  const rows: string[][] = [header];

  for (const team of allTeams) {
    const row: string[] = [team];
    for (const season of seasons) {
      const teamRow = perSeasonData.get(season)!.get(team);
      if (!teamRow) {
        row.push("", "");
        continue;
      }
      const mwCash = Math.round((teamRow.mw + teamRow.cash) * 10) / 10;
      row.push(mwCash.toFixed(1).replace(".", ","), String(teamRow.kader));
    }
    rows.push(row);
  }

  const csv = rows.map((row) => row.join(";")).join("\n") + "\n";
  fs.writeFileSync(OUTPUT_CSV, csv, "utf8");
  console.log(`Written: ${OUTPUT_CSV}`);
  console.log(`Teams: ${allTeams.length}, Seasons: ${seasons.length}`);
}

main();
