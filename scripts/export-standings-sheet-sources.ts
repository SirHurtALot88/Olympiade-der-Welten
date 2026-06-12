import fs from "node:fs/promises";
import path from "node:path";
import { writeNormalizedPrizeMoneyFiles } from "@/lib/season/prize-money-sheet";

const SHEET_BASE =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=";

const SOURCES = [
  {
    name: "season-standings",
    gid: "475050161",
    csvPath: path.resolve(process.cwd(), "references/sheets/season-standings.csv"),
    jsonPath: path.resolve(process.cwd(), "references/sheets/season-standings.json"),
  },
  {
    name: "rank-to-points",
    gid: "1155023152",
    csvPath: path.resolve(process.cwd(), "references/sheets/rank-to-points.csv"),
    jsonPath: path.resolve(process.cwd(), "references/sheets/rank-to-points.json"),
  },
  {
    name: "prize-money-table",
    gid: "2059519103",
    csvPath: path.resolve(process.cwd(), "references/sheets/prize-money-table.csv"),
    jsonPath: path.resolve(process.cwd(), "references/sheets/prize-money-table.json"),
  },
] as const;

type SourceName = (typeof SOURCES)[number]["name"];

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [rawKey, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(rawKey, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(rawKey, next);
      index += 1;
      continue;
    }
    args.set(rawKey, "true");
  }

  return {
    source: (args.get("source") ?? null) as SourceName | null,
    gid: args.get("gid") ?? null,
    url: args.get("url") ?? null,
  };
}

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

async function exportSource(
  source: (typeof SOURCES)[number],
  options: {
    gid?: string | null;
    url?: string | null;
  } = {},
) {
  const effectiveGid = options.gid ?? source.gid;
  const effectiveUrl = options.url ?? (effectiveGid ? `${SHEET_BASE}${effectiveGid}` : null);
  if (!effectiveUrl) {
    throw new Error("prize money sheet export missing");
  }

  const response = await fetch(effectiveUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name} sheet export (${response.status})`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  const [headerRow, ...dataRows] = rows;
  const records = dataRows.map((row) =>
    Object.fromEntries(headerRow.map((header, index) => [header.trim(), row[index] ?? ""])),
  );

  await fs.mkdir(path.dirname(source.csvPath), { recursive: true });
  await fs.writeFile(source.csvPath, csv.endsWith("\n") ? csv : `${csv}\n`, "utf8");
  await fs.writeFile(
    source.jsonPath,
    `${JSON.stringify(
      {
        source: "google_sheet_export",
        gid: effectiveGid,
        url: effectiveUrl,
        exportedAt: new Date().toISOString(),
        headers: headerRow.map((header) => header.trim()),
        rows: records,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`exported: ${source.name}`);
  console.log(`gid: ${effectiveGid}`);
  console.log(`csv: ${source.csvPath}`);
  console.log(`json: ${source.jsonPath}`);
  console.log(`rows: ${records.length}`);

  if (source.name === "prize-money-table") {
    const normalized = await writeNormalizedPrizeMoneyFiles();
    if (normalized.written) {
      console.log("normalized: written");
    } else {
      console.log(`normalized: blocked (${normalized.analysis.reason ?? "unknown"})`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.source) {
    const source = SOURCES.find((entry) => entry.name === args.source);
    if (!source) {
      throw new Error(`Unknown source: ${args.source}`);
    }
    await exportSource(source, { gid: args.gid, url: args.url });
    return;
  }

  for (const source of SOURCES) {
    await exportSource(source, {
      gid: source.name === "prize-money-table" ? args.gid : null,
      url: source.name === "prize-money-table" ? args.url : null,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
