import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE_ROOT = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

export const PRIZE_MONEY_RAW_CSV_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "prize-money-table.csv",
);
export const PRIZE_MONEY_RAW_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "prize-money-table.json",
);
export const PRIZE_MONEY_NORMALIZED_CSV_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "prize-money-table.normalized.csv",
);
export const PRIZE_MONEY_NORMALIZED_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "prize-money-table.normalized.json",
);

export type PrizeMoneyNormalizedRow = {
  rank: number | null;
  placementLabel: string | null;
  prizeMoney: number | null;
  percent: number | null;
  basis: number | null;
  correction: number | null;
  bonus: number | null;
  malus: number | null;
  season: string | null;
  sourceRow: number;
  warnings: string[];
};

export type PrizeMoneyBlockSummary = {
  id: string;
  headerRow: number;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  rowsCount: number;
  headers: string[];
  detectedColumns: string[];
  reason: string | null;
  status: "candidate" | "rejected" | "selected";
};

export type PrizeMoneyAnalysis = {
  status: "ok" | "blocked";
  reason: string | null;
  detectedBlocks: PrizeMoneyBlockSummary[];
  candidateHeaderRows: number[];
  candidateDataRanges: string[];
  rejectedBlocks: Array<{ id: string; reason: string }>;
  selectedBlock: PrizeMoneyBlockSummary | null;
  rows: PrizeMoneyNormalizedRow[];
  warnings: string[];
  rawHeaders: string[];
};

export type PrizeMoneyPlacementRow = {
  rankDelta: number;
  placementAmount: number | null;
  percent: number | null;
  sourceRow: number;
};

export type PrizeMoneySeasonFactorRow = {
  seasonLabel: string;
  factor: number | null;
  sourceRow: number;
};

export type PrizeMoneySourceBundle = {
  normalizedRows: PrizeMoneyNormalizedRow[];
  placementRows: PrizeMoneyPlacementRow[];
  seasonFactors: PrizeMoneySeasonFactorRow[];
};

type PrizeMoneySheetAnalysisOptions = {
  rawCsvPath?: string;
  normalizedJsonPath?: string;
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "\"") {
      if (inQuotes && text[index + 1] === "\"") {
        currentField += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function toNumber(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const parsed = Number(normalized.replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isRankHeader(value: string) {
  const normalized = normalizeHeader(value);
  return normalized === "rank" || normalized === "platz" || normalized === "rang";
}

function isPrizeHeader(value: string) {
  const normalized = normalizeHeader(value);
  return [
    "preisgeld",
    "prize",
    "prizemoney",
    "cashbonus",
    "cash bonus",
    "gesamt preisgeld",
    "payout",
  ].includes(normalized);
}

function isPositiveRank(value: string | undefined) {
  const parsed = toNumber(value);
  return parsed != null && Number.isInteger(parsed) && parsed >= 1 && parsed <= 64;
}

function detectColumns(headers: string[]) {
  return headers.flatMap((header, index) => {
    const normalized = normalizeHeader(header);
    if (isRankHeader(header)) return [{ key: "rank", index }];
    if (isPrizeHeader(header)) return [{ key: "prizeMoney", index }];
    if (normalized === "%" || normalized === "percent" || normalized === "platzierung %") return [{ key: "percent", index }];
    if (normalized === "basis") return [{ key: "basis", index }];
    if (normalized === "korrektur" || normalized === "+/-") return [{ key: "correction", index }];
    if (normalized === "bonus" || normalized === "placement bonus" || normalized === "cash bonus") return [{ key: "bonus", index }];
    if (normalized === "malus" || normalized === "penalty" || normalized === "cash malus") return [{ key: "malus", index }];
    if (normalized === "season" || normalized === "saison") return [{ key: "season", index }];
    if (normalized === "platzierung" || normalized === "placement") return [{ key: "placementLabel", index }];
    return [];
  });
}

function buildBlockId(headerRow: number, startCol: number) {
  return `r${headerRow + 1}c${startCol + 1}`;
}

function analyzeMatrix(rows: string[][]): PrizeMoneyAnalysis {
  const candidateHeaderRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => isRankHeader(cell)))
    .map(({ index }) => index + 1);

  const detectedBlocks: PrizeMoneyBlockSummary[] = [];
  const rejectedBlocks: Array<{ id: string; reason: string }> = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!isRankHeader(cell)) return;

      const window = row.slice(colIndex, colIndex + 12);
      const prizeIndexRelative = window.findIndex((entry) => isPrizeHeader(entry));
      const blockId = buildBlockId(rowIndex, colIndex);

      if (prizeIndexRelative === -1) {
        detectedBlocks.push({
          id: blockId,
          headerRow: rowIndex + 1,
          startRow: rowIndex + 2,
          endRow: rowIndex + 1,
          startCol: colIndex + 1,
          endCol: Math.min(row.length, colIndex + 12),
          rowsCount: 0,
          headers: window.map((value) => value.trim()).filter(Boolean),
          detectedColumns: ["rank"],
          reason: "rank_header_without_prize_column",
          status: "rejected",
        });
        rejectedBlocks.push({ id: blockId, reason: "rank_header_without_prize_column" });
        return;
      }

      const startCol = colIndex;
      const endCol = colIndex + prizeIndexRelative + 3;
      const headers = row.slice(startCol, endCol + 1);
      const columns = detectColumns(headers);
      const prizeIndex = startCol + prizeIndexRelative;
      let endRow = rowIndex;
      const normalizedRows: PrizeMoneyNormalizedRow[] = [];

      for (let dataIndex = rowIndex + 1; dataIndex < rows.length; dataIndex += 1) {
        const dataRow = rows[dataIndex];
        if (!isPositiveRank(dataRow[startCol])) {
          break;
        }

        endRow = dataIndex;
        const getCell = (key: string) => {
          const column = columns.find((entry) => entry.key === key);
          return column ? dataRow[startCol + column.index] ?? "" : "";
        };

        normalizedRows.push({
          rank: toNumber(dataRow[startCol]),
          placementLabel: getCell("placementLabel").trim() || null,
          prizeMoney: toNumber(dataRow[prizeIndex]),
          percent: toNumber(getCell("percent")),
          basis: toNumber(getCell("basis")),
          correction: toNumber(getCell("correction")),
          bonus: toNumber(getCell("bonus")),
          malus: toNumber(getCell("malus")),
          season: getCell("season").trim() || null,
          sourceRow: dataIndex + 1,
          warnings: [],
        });
      }

      const duplicateRanks = new Set<number>();
      const seenRanks = new Set<number>();
      for (const entry of normalizedRows) {
        if (entry.rank == null) continue;
        if (seenRanks.has(entry.rank)) duplicateRanks.add(entry.rank);
        seenRanks.add(entry.rank);
      }

      const missingPrizeCount = normalizedRows.filter((entry) => entry.prizeMoney == null).length;
      const reason =
        normalizedRows.length < 8
          ? "too_few_rank_rows"
          : duplicateRanks.size > 0
            ? "duplicate_ranks"
            : missingPrizeCount > 0
              ? "missing_prize_values"
              : null;

      detectedBlocks.push({
        id: blockId,
        headerRow: rowIndex + 1,
        startRow: rowIndex + 2,
        endRow: endRow + 1,
        startCol: startCol + 1,
        endCol: endCol + 1,
        rowsCount: normalizedRows.length,
        headers: headers.map((value) => value.trim()).filter(Boolean),
        detectedColumns: columns.map((entry) => entry.key),
        reason,
        status: reason ? "rejected" : "candidate",
      });

      if (reason) {
        rejectedBlocks.push({ id: blockId, reason });
      }
    });
  });

  const viableBlocks = detectedBlocks.filter((block) => block.status === "candidate");
  const sortedViableBlocks = [...viableBlocks].sort((left, right) => {
    if (right.rowsCount !== left.rowsCount) return right.rowsCount - left.rowsCount;
    return left.startCol - right.startCol;
  });

  const selectedBlock =
    sortedViableBlocks.length === 1
      ? { ...sortedViableBlocks[0], status: "selected" as const }
      : sortedViableBlocks.length > 1 && sortedViableBlocks[0].rowsCount > sortedViableBlocks[1].rowsCount
        ? { ...sortedViableBlocks[0], status: "selected" as const }
        : null;

  const selectedRows =
    selectedBlock == null
      ? []
      : rows
          .slice(selectedBlock.startRow - 1, selectedBlock.endRow)
          .map((dataRow, offset) => {
            const getByHeader = (key: string) => {
              const relativeIndex = detectColumns(selectedBlock.headers).find((entry) => entry.key === key)?.index;
              return relativeIndex == null ? "" : dataRow[selectedBlock.startCol - 1 + relativeIndex] ?? "";
            };

            return {
              rank: toNumber(dataRow[selectedBlock.startCol - 1]),
              placementLabel: getByHeader("placementLabel").trim() || null,
              prizeMoney: toNumber(getByHeader("prizeMoney")),
              percent: toNumber(getByHeader("percent")),
              basis: toNumber(getByHeader("basis")),
              correction: toNumber(getByHeader("correction")),
              bonus: toNumber(getByHeader("bonus")),
              malus: toNumber(getByHeader("malus")),
              season: getByHeader("season").trim() || null,
              sourceRow: selectedBlock.startRow + offset,
              warnings: [
                getByHeader("bonus").trim() ? null : "bonus_missing_treated_as_zero",
                getByHeader("malus").trim() ? null : "malus_missing_treated_as_zero",
              ].filter((value): value is string => Boolean(value)),
            } satisfies PrizeMoneyNormalizedRow;
          });

  const status = selectedBlock ? "ok" : "blocked";
  const warnings =
    selectedBlock == null
      ? [
          sortedViableBlocks.length > 1 ? "multiple_candidate_blocks" : "no_unambiguous_prize_block_found",
          ...rejectedBlocks.map((entry) => `${entry.id}:${entry.reason}`),
        ]
      : [];

  return {
    status,
    reason: selectedBlock ? null : "prize_money_table_invalid",
    detectedBlocks: detectedBlocks.map((block) =>
      selectedBlock && block.id === selectedBlock.id ? { ...block, status: "selected" } : block,
    ),
    candidateHeaderRows,
    candidateDataRanges: viableBlocks.map((block) => `${block.startRow}-${block.endRow}`),
    rejectedBlocks,
    selectedBlock,
    rows: selectedRows,
    warnings,
    rawHeaders: rows.find((row) => row.some((cell) => isPrizeHeader(cell)))?.filter((value) => value.trim().length > 0) ?? [],
  };
}

async function readRawMatrix(rawCsvPath = PRIZE_MONEY_RAW_CSV_PATH) {
  const csv = await fs.readFile(rawCsvPath, "utf8");
  return parseCsv(csv);
}

export async function analyzePrizeMoneySheet(options: PrizeMoneySheetAnalysisOptions = {}) {
  const normalizedRows = await readNormalizedPrizeMoneyRows(options.normalizedJsonPath);
  try {
    const matrix = await readRawMatrix(options.rawCsvPath);
    const rawAnalysis = analyzeMatrix(matrix);
    if (normalizedRows.length > 0) {
      return {
        ...rawAnalysis,
        status: "ok",
        reason: null,
        rows: normalizedRows,
      } satisfies PrizeMoneyAnalysis;
    }
    return rawAnalysis;
  } catch {
    if (normalizedRows.length > 0) {
      return {
        status: "ok",
        reason: null,
        detectedBlocks: [],
        candidateHeaderRows: [],
        candidateDataRanges: [],
        rejectedBlocks: [],
        selectedBlock: {
          id: "normalized-file",
          headerRow: 0,
          startRow: normalizedRows[0]?.sourceRow ?? 0,
          endRow: normalizedRows.at(-1)?.sourceRow ?? 0,
          startCol: 0,
          endCol: 0,
          rowsCount: normalizedRows.length,
          headers: ["rank", "placementLabel", "prizeMoney", "percent", "basis", "correction", "bonus", "malus", "season"],
          detectedColumns: ["rank", "prizeMoney", "percent", "basis", "correction", "bonus", "malus", "season"],
          reason: null,
          status: "selected",
        },
        rows: normalizedRows,
        warnings: [],
        rawHeaders: ["rank", "placementLabel", "prizeMoney", "percent", "basis", "correction", "bonus", "malus", "season"],
      } satisfies PrizeMoneyAnalysis;
    }

    return {
      status: "blocked",
      reason: "prize_money_table_missing",
      detectedBlocks: [],
      candidateHeaderRows: [],
      candidateDataRanges: [],
      rejectedBlocks: [],
      selectedBlock: null,
      rows: [],
      warnings: ["prize_money_sheet_export_missing"],
      rawHeaders: [],
    } satisfies PrizeMoneyAnalysis;
  }
}

export async function readNormalizedPrizeMoneyRows(normalizedJsonPath = PRIZE_MONEY_NORMALIZED_JSON_PATH) {
  try {
    const text = await fs.readFile(normalizedJsonPath, "utf8");
    const parsed = JSON.parse(text) as { rows?: PrizeMoneyNormalizedRow[] };
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

export async function writeNormalizedPrizeMoneyFiles() {
  const analysis = await analyzePrizeMoneySheet();
  if (analysis.status !== "ok" || !analysis.selectedBlock) {
    return { written: false, analysis };
  }

  const headers = [
    "rank",
    "placementLabel",
    "prizeMoney",
    "percent",
    "basis",
    "correction",
    "bonus",
    "malus",
    "season",
    "sourceRow",
    "warnings",
  ];

  const csvLines = [
    headers.join(","),
    ...analysis.rows.map((row) =>
      [
        row.rank ?? "",
        row.placementLabel ?? "",
        row.prizeMoney ?? "",
        row.percent ?? "",
        row.basis ?? "",
        row.correction ?? "",
        row.bonus ?? "",
        row.malus ?? "",
        row.season ?? "",
        row.sourceRow,
        row.warnings.join("|"),
      ]
        .map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`)
        .join(","),
    ),
  ];

  await fs.mkdir(path.dirname(PRIZE_MONEY_NORMALIZED_CSV_PATH), { recursive: true });
  await fs.writeFile(PRIZE_MONEY_NORMALIZED_CSV_PATH, `${csvLines.join("\n")}\n`, "utf8");
  await fs.writeFile(
    PRIZE_MONEY_NORMALIZED_JSON_PATH,
    `${JSON.stringify(
      {
        source: "normalized_prize_money_table",
        generatedAt: new Date().toISOString(),
        selectedBlock: analysis.selectedBlock,
        rows: analysis.rows,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { written: true, analysis };
}

export async function readPrizeMoneySourceBundle(
  rawCsvPath = PRIZE_MONEY_RAW_CSV_PATH,
  normalizedJsonPath = PRIZE_MONEY_NORMALIZED_JSON_PATH,
): Promise<PrizeMoneySourceBundle> {
  const normalizedRows = await readNormalizedPrizeMoneyRows(normalizedJsonPath);
  const placementRows: PrizeMoneyPlacementRow[] = [];
  const seasonFactors: PrizeMoneySeasonFactorRow[] = [];

  try {
    const rawCsv = await fs.readFile(rawCsvPath, "utf8");
    const matrix = parseCsv(rawCsv);

    for (let rowIndex = 2; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] ?? [];

      const rankDelta = toNumber(row[0]);
      const placementAmount = toNumber(row[1]);
      const placementPercent = toNumber(row[2]);
      if (rankDelta != null && placementAmount != null) {
        placementRows.push({
          rankDelta,
          placementAmount,
          percent: placementPercent,
          sourceRow: rowIndex + 1,
        });
      }

      const factorTag = row[13]?.trim() ?? "";
      const factorLabel = row[14]?.trim() ?? "";
      const factorValue = toNumber(row[15]);
      if (factorTag || factorLabel || factorValue != null) {
        const seasonLabel =
          factorLabel === "Faktor:"
            ? "Aktuell"
            : factorLabel || factorTag || `Season ${seasonFactors.length + 1}`;

        if (
          factorLabel === "Faktor:" ||
          factorLabel.startsWith("Season +") ||
          factorTag.startsWith("S")
        ) {
          seasonFactors.push({
            seasonLabel,
            factor: factorValue,
            sourceRow: rowIndex + 1,
          });
        }
      }
    }
  } catch {
    return {
      normalizedRows,
      placementRows: [],
      seasonFactors: [],
    };
  }

  return {
    normalizedRows,
    placementRows,
    seasonFactors,
  };
}
