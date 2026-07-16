import fs from "node:fs/promises";

import {
  PRIZE_MONEY_NORMALIZED_CSV_PATH,
  PRIZE_MONEY_NORMALIZED_JSON_PATH,
  readNormalizedPrizeMoneyRows,
} from "@/lib/season/prize-money-sheet";

export type PrizeMoneyNormalizedAudit = {
  status: "ok" | "blocked";
  rowsCount: number;
  minRank: number | null;
  maxRank: number | null;
  missingRanks: number[];
  duplicateRanks: number[];
  invalidPrizeValues: Array<{ rank: number | null; value: number | null; sourceRow: number }>;
  totalPrizePool: number;
  warnings: string[];
  files: {
    normalizedCsvPresent: boolean;
    normalizedJsonPresent: boolean;
    selectedBlockDocumented: boolean;
  };
};

export async function auditPrizeMoneyNormalized(): Promise<PrizeMoneyNormalizedAudit> {
  const [normalizedRows, csvPresent, jsonText] = await Promise.all([
    readNormalizedPrizeMoneyRows(),
    fs
      .access(PRIZE_MONEY_NORMALIZED_CSV_PATH)
      .then(() => true)
      .catch(() => false),
    fs.readFile(PRIZE_MONEY_NORMALIZED_JSON_PATH, "utf8").catch(() => null),
  ]);

  const parsedJson = jsonText ? (JSON.parse(jsonText) as { selectedBlock?: unknown }) : null;
  const jsonPresent = Boolean(jsonText);
  const selectedBlockDocumented = Boolean(parsedJson && parsedJson.selectedBlock);

  const warnings = new Set<string>();
  if (!csvPresent) warnings.add("normalized_csv_missing");
  if (!jsonPresent) warnings.add("normalized_json_missing");
  if (!selectedBlockDocumented) warnings.add("selected_block_missing");

  const rankCounts = new Map<number, number>();
  const invalidPrizeValues: Array<{ rank: number | null; value: number | null; sourceRow: number }> = [];

  for (const row of normalizedRows) {
    if (row.rank != null) {
      rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1);
    }
    if (row.prizeMoney == null || !Number.isFinite(row.prizeMoney)) {
      invalidPrizeValues.push({
        rank: row.rank,
        value: row.prizeMoney,
        sourceRow: row.sourceRow,
      });
    }
    if (row.sourceRow == null || !Number.isFinite(row.sourceRow)) {
      warnings.add("source_row_missing");
    }
  }

  const ranks = Array.from(rankCounts.keys()).sort((a, b) => a - b);
  const duplicateRanks = ranks.filter((rank) => (rankCounts.get(rank) ?? 0) > 1);
  const minRank = ranks.length > 0 ? ranks[0] : null;
  const maxRank = ranks.length > 0 ? ranks[ranks.length - 1] : null;
  const missingRanks: number[] = [];

  if (minRank != null && maxRank != null) {
    for (let rank = minRank; rank <= maxRank; rank += 1) {
      if (!rankCounts.has(rank)) missingRanks.push(rank);
    }
  }

  if (normalizedRows.length !== 32) warnings.add(`unexpected_rows_count:${normalizedRows.length}`);
  if (duplicateRanks.length > 0) warnings.add("duplicate_ranks_detected");
  if (missingRanks.length > 0) warnings.add("missing_rank_gap_detected");
  if (invalidPrizeValues.length > 0) warnings.add("invalid_prize_values_detected");

  const totalPrizePool = normalizedRows.reduce((sum, row) => sum + (row.prizeMoney ?? 0), 0);
  const status =
    csvPresent &&
    jsonPresent &&
    selectedBlockDocumented &&
    normalizedRows.length === 32 &&
    duplicateRanks.length === 0 &&
    missingRanks.length === 0 &&
    invalidPrizeValues.length === 0
      ? "ok"
      : "blocked";

  return {
    status,
    rowsCount: normalizedRows.length,
    minRank,
    maxRank,
    missingRanks,
    duplicateRanks,
    invalidPrizeValues,
    totalPrizePool,
    warnings: Array.from(warnings),
    files: {
      normalizedCsvPresent: csvPresent,
      normalizedJsonPresent: jsonPresent,
      selectedBlockDocumented,
    },
  };
}

async function main() {
  const audit = await auditPrizeMoneyNormalized();
  console.log(`status: ${audit.status}`);
  console.log(`rowsCount: ${audit.rowsCount}`);
  console.log(`rankRange: ${audit.minRank ?? "-"}-${audit.maxRank ?? "-"}`);
  console.log(`missingRanks: ${audit.missingRanks.length ? audit.missingRanks.join(", ") : "none"}`);
  console.log(`duplicateRanks: ${audit.duplicateRanks.length ? audit.duplicateRanks.join(", ") : "none"}`);
  console.log(`invalidPrizeValues: ${audit.invalidPrizeValues.length}`);
  console.log(`totalPrizePool: ${audit.totalPrizePool.toFixed(1)}`);
  console.log(`normalizedCsvPresent: ${audit.files.normalizedCsvPresent ? "yes" : "no"}`);
  console.log(`normalizedJsonPresent: ${audit.files.normalizedJsonPresent ? "yes" : "no"}`);
  console.log(`selectedBlockDocumented: ${audit.files.selectedBlockDocumented ? "yes" : "no"}`);
  if (audit.warnings.length) {
    console.log("warnings:");
    for (const warning of audit.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error("prize money normalized audit failed");
  console.error(error);
  process.exitCode = 1;
});
