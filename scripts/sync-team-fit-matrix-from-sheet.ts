import fs from "node:fs";
import path from "node:path";

const SHEET_ID = "1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk";
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "data/source/team-fit-matrix.json");
const RACE_SHEET = "Rassen";
const SUBCLASS_SHEET = "Subclasses";

type FitMatrixRow = {
  teamId: string;
  playerGroup: string | null;
  fits: Record<string, number>;
  sum: number | null;
};

type FitMatrix = {
  source: {
    sheetId: string;
    sheets: {
      races: string;
      subclasses: string;
    };
    syncedAt: string;
  };
  races: {
    tokens: string[];
    rows: FitMatrixRow[];
  };
  subclasses: {
    tokens: string[];
    rows: FitMatrixRow[];
  };
};

function csvUrl(sheetName: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((entry) => entry.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((entry) => entry.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function toNumber(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMatrix(csvText: string) {
  const rows = parseCsv(csvText);
  const headers = rows[0] ?? [];
  const teamIndex = headers.findIndex((header) => header.trim().toLowerCase() === "team");
  const playerIndex = headers.findIndex((header) => header.trim().toLowerCase() === "player");
  const sumIndex = headers.findIndex((header) => header.trim().toLowerCase() === "summe");
  if (teamIndex < 0 || playerIndex < 0) {
    throw new Error("Team fit matrix sheet is missing Team or Player columns.");
  }

  const tokenColumns = headers
    .map((header, index) => ({ token: header.trim(), index }))
    .filter((entry) => entry.index !== teamIndex && entry.index !== playerIndex && entry.index !== sumIndex && entry.token.length > 0);
  const matrixRows = rows
    .slice(1)
    .map((rawRow) => {
      const teamId = rawRow[teamIndex]?.trim() ?? "";
      if (!teamId) return null;
      const fits = Object.fromEntries(
        tokenColumns.flatMap(({ token, index }) => {
          const value = toNumber(rawRow[index]);
          return value == null ? [] : [[token, value] as const];
        }),
      );
      return {
        teamId,
        playerGroup: rawRow[playerIndex]?.trim() || null,
        fits,
        sum: sumIndex >= 0 ? toNumber(rawRow[sumIndex]) : null,
      };
    })
    .filter((row): row is FitMatrixRow => row != null);

  return {
    tokens: tokenColumns.map((entry) => entry.token),
    rows: matrixRows,
  };
}

async function fetchSheet(sheetName: string) {
  const response = await fetch(csvUrl(sheetName));
  if (!response.ok) {
    throw new Error(`Could not fetch ${sheetName}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const [racesCsv, subclassesCsv] = await Promise.all([fetchSheet(RACE_SHEET), fetchSheet(SUBCLASS_SHEET)]);
  const matrix: FitMatrix = {
    source: {
      sheetId: SHEET_ID,
      sheets: {
        races: RACE_SHEET,
        subclasses: SUBCLASS_SHEET,
      },
      syncedAt: new Date().toISOString(),
    },
    races: parseMatrix(racesCsv),
    subclasses: parseMatrix(subclassesCsv),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath: OUTPUT_PATH,
        raceRows: matrix.races.rows.length,
        raceTokens: matrix.races.tokens.length,
        subclassRows: matrix.subclasses.rows.length,
        subclassTokens: matrix.subclasses.tokens.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
