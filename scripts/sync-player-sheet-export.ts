import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PLAYER_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=1895535866";

type PlayerRecord = {
  id: string;
  name: string;
  marketValue: number;
  salaryDemand: number;
  displayMarketValue?: number;
  displaySalary?: number;
  cost?: number;
  upkeepBase?: number;
  referenceClass?: string | null;
  imageSource?: string | null;
  bracketLabel?: string | null;
  [key: string]: unknown;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("de");
}

function parseLocaleNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "#NV" || trimmed === "#N/A") {
    return null;
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntCell(value: string | undefined) {
  const parsed = parseLocaleNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

function parseNullableString(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "#NV" || trimmed === "#N/A") {
    return null;
  }

  return trimmed;
}

async function main() {
  const response = await fetch(PLAYER_SHEET_CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch player sheet export (${response.status})`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  const [headerRow, ...dataRows] = rows;
  const headerIndex = new Map(headerRow.map((header, index) => [header.trim(), index]));
  const jsonPath = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");
  const players = JSON.parse(await readFile(jsonPath, "utf8")) as PlayerRecord[];

  const rowByName = new Map<string, string[]>();
  for (const row of dataRows) {
    const name = row[headerIndex.get("Name") ?? -1]?.trim();
    if (!name) {
      continue;
    }
    rowByName.set(normalizeName(name), row);
  }

  let updated = 0;
  for (const player of players) {
    const row = rowByName.get(normalizeName(player.name));
    if (!row) {
      continue;
    }

    player.referenceClass = parseNullableString(row[headerIndex.get("Referenz Klasse") ?? -1]);
    player.imageSource = parseNullableString(row[headerIndex.get("Bild") ?? -1]);
    player.bracketLabel = parseNullableString(row[headerIndex.get("Bracket") ?? -1]);
    // Marktwert/Gehalt/Kosten/Unterhalt kommen aus der offiziellen Economy-Engine beim Katalog-Load,
    // nicht aus dem Sheet-Export.
    updated += 1;
  }

  await writeFile(jsonPath, `${JSON.stringify(players, null, 2)}\n`, "utf8");
  console.log(`updatedPlayers: ${updated}`);
  console.log(`output: ${jsonPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
