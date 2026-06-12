import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";

import rawPlayerStats from "@/data/generated/oly-player-stats.json";
import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";
import { db } from "@/src/server/db";

type RawPlayerEconomySource = {
  id: string;
  name: string;
  marketValue?: number | null;
  salaryDemand?: number | null;
};

type AuditStatus =
  | "match"
  | "missing_in_source"
  | "missing_in_db"
  | "scale_mismatch"
  | "value_mismatch"
  | "fallback_used";

type EconomyComparison = {
  playerName: string;
  playerId: string;
  sourceMarketValue: number | null;
  dbMarketValue: number | null;
  sourceSalaryDemand: number | null;
  dbSalaryDemand: number | null;
  activePlayerSalary: number | null;
  transfermarktServiceMarketValue: number | null;
  transfermarktServiceSalary: number | null;
  status: AuditStatus;
};

type EconomyAuditSummary = {
  sourceHasMarketValue: number;
  dbHasMarketValue: number;
  sourceHasSalary: number;
  dbHasSalary: number;
  exactMatches: number;
  scaleMismatchCandidates: number;
  missingSalaryCount: number;
  missingMarketValueCount: number;
  fallbackUsedCount: number;
  valueMismatchCount: number;
};

type RawFieldSample = {
  fieldName: string;
  sourcePath: string;
  present: boolean;
  detectedType: string;
  sampleValues: Array<string | number>;
  decimalPointCount: number;
  decimalCommaCount: number;
  repeatedSampleCount: number;
  looksDefaultHeavy: boolean;
};

function getNumberStats(values: number[]) {
  if (values.length === 0) {
    return { min: null, max: null, median: null };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];

  return {
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
    median,
  };
}

function getTopValueCounts(values: number[], sampleByValue: Map<number, string>, limit = 20) {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])
    .slice(0, limit)
    .map(([value, count]) => ({
      value,
      count,
      samplePlayer: sampleByValue.get(value) ?? null,
    }));
}

function describeValueType(values: unknown[]) {
  const types = Array.from(new Set(values.map((value) => (value == null ? "nullish" : Array.isArray(value) ? "array" : typeof value))));
  return types.join("|");
}

function buildRawFieldSample(
  sourcePlayers: RawPlayerEconomySource[],
  fieldName: string,
  aliases: string[],
): RawFieldSample {
  const allKeys = new Set(Object.keys(sourcePlayers[0] ?? {}));
  const matchedKey = aliases.find((alias) => allKeys.has(alias)) ?? null;
  const samplePlayers = sourcePlayers.slice(0, 10);
  const sampleValues = samplePlayers.map((player) => {
    if (!matchedKey) {
      return "missing";
    }

    const value = (player as Record<string, unknown>)[matchedKey];
    return typeof value === "string" || typeof value === "number" ? value : value == null ? "null" : JSON.stringify(value);
  });
  const stringValues = sampleValues.filter((value): value is string => typeof value === "string");
  const numericishStrings = stringValues.filter((value) => /[0-9]/.test(value));
  const repeatedSampleCount = new Set(sampleValues).size === 1 && sampleValues.length > 0 ? sampleValues.length : 0;

  return {
    fieldName,
    sourcePath: matchedKey ? `data/generated/oly-player-stats.json.${matchedKey}` : "not_found",
    present: Boolean(matchedKey),
    detectedType: matchedKey
      ? describeValueType(sourcePlayers.slice(0, 25).map((player) => (player as Record<string, unknown>)[matchedKey]))
      : "missing",
    sampleValues,
    decimalPointCount: numericishStrings.filter((value) => value.includes(".")).length,
    decimalCommaCount: numericishStrings.filter((value) => value.includes(",")).length,
    repeatedSampleCount,
    looksDefaultHeavy: repeatedSampleCount >= 8,
  };
}

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };

  return {
    saveId: getValue("--saveId", "save-initial"),
    seasonId: getValue("--seasonId", "season-1"),
    sampleSize: Number(getValue("--sample", "5")),
  };
}

function isPresentNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isScaleMismatch(sourceValue: number | null, dbValue: number | null) {
  if (!isPresentNumber(sourceValue) || !isPresentNumber(dbValue) || sourceValue === 0 || dbValue === 0) {
    return false;
  }

  const ratio = Math.max(sourceValue, dbValue) / Math.min(sourceValue, dbValue);
  return [10, 100, 1000].some((candidate) => Math.abs(ratio - candidate) < 0.001);
}

export function classifyEconomyComparison(input: Omit<EconomyComparison, "status">): AuditStatus {
  const {
    sourceMarketValue,
    dbMarketValue,
    sourceSalaryDemand,
    dbSalaryDemand,
    transfermarktServiceMarketValue,
    transfermarktServiceSalary,
  } = input;

  if (!isPresentNumber(sourceMarketValue) && !isPresentNumber(sourceSalaryDemand)) {
    return "missing_in_source";
  }

  if (!isPresentNumber(dbMarketValue) && !isPresentNumber(dbSalaryDemand)) {
    return "missing_in_db";
  }

  const serviceParticipates =
    transfermarktServiceMarketValue != null || transfermarktServiceSalary != null;

  if (
    serviceParticipates &&
    (transfermarktServiceMarketValue !== dbMarketValue ||
      transfermarktServiceSalary !== dbSalaryDemand)
  ) {
    return "fallback_used";
  }

  if (
    isScaleMismatch(sourceMarketValue, dbMarketValue) ||
    isScaleMismatch(sourceSalaryDemand, dbSalaryDemand)
  ) {
    return "scale_mismatch";
  }

  if (sourceMarketValue === dbMarketValue && sourceSalaryDemand === dbSalaryDemand) {
    return "match";
  }

  return "value_mismatch";
}

export function buildEconomyAuditSummary(rows: EconomyComparison[]): EconomyAuditSummary {
  return rows.reduce<EconomyAuditSummary>(
    (summary, row) => {
      if (isPresentNumber(row.sourceMarketValue)) {
        summary.sourceHasMarketValue += 1;
      } else {
        summary.missingMarketValueCount += 1;
      }

      if (isPresentNumber(row.dbMarketValue)) {
        summary.dbHasMarketValue += 1;
      }

      if (isPresentNumber(row.sourceSalaryDemand)) {
        summary.sourceHasSalary += 1;
      } else {
        summary.missingSalaryCount += 1;
      }

      if (isPresentNumber(row.dbSalaryDemand)) {
        summary.dbHasSalary += 1;
      }

      if (row.status === "match") {
        summary.exactMatches += 1;
      }
      if (row.status === "scale_mismatch") {
        summary.scaleMismatchCandidates += 1;
      }
      if (row.status === "fallback_used") {
        summary.fallbackUsedCount += 1;
      }
      if (row.status === "value_mismatch") {
        summary.valueMismatchCount += 1;
      }

      return summary;
    },
    {
      sourceHasMarketValue: 0,
      dbHasMarketValue: 0,
      sourceHasSalary: 0,
      dbHasSalary: 0,
      exactMatches: 0,
      scaleMismatchCandidates: 0,
      missingSalaryCount: 0,
      missingMarketValueCount: 0,
      fallbackUsedCount: 0,
      valueMismatchCount: 0,
    },
  );
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  console.log(`DATABASE_URL present: ${process.env.DATABASE_URL ? "yes" : "no"}`);

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. player:audit-economy-source requires a configured Prisma database. Check .env.local in the project root.",
    );
  }

  const input = parseArgs(process.argv.slice(2));
  const sourcePlayers = rawPlayerStats as RawPlayerEconomySource[];
  const sourceByPlayerId = new Map(sourcePlayers.map((player) => [player.id, player]));

  const [dbPlayers, activePlayers, freeAgentService] = await Promise.all([
    db.player.findMany({
      include: {
        attributes: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.activePlayer.findMany({
      where: {
        saveId: input.saveId,
        seasonId: input.seasonId,
      },
      select: {
        playerId: true,
        salary: true,
      },
    }),
    listTransfermarktFreeAgents({
      saveId: input.saveId,
      seasonId: input.seasonId,
      limit: 250,
    }),
  ]);

  const activeByPlayerId = new Map(activePlayers.map((entry) => [entry.playerId, entry.salary]));
  const serviceByPlayerId = new Map(
    freeAgentService.items.map((item) => [item.playerId, { marketValue: item.marketValue, salary: item.salary }]),
  );

  const rows: EconomyComparison[] = dbPlayers.map((player) => {
    const source = sourceByPlayerId.get(player.id);
    const service = serviceByPlayerId.get(player.id);

    const comparisonBase = {
      playerName: player.name,
      playerId: player.id,
      sourceMarketValue: source?.marketValue ?? null,
      dbMarketValue: player.attributes?.marketValue ?? null,
      sourceSalaryDemand: source?.salaryDemand ?? null,
      dbSalaryDemand: player.attributes?.salaryDemand ?? null,
      activePlayerSalary: activeByPlayerId.get(player.id) ?? null,
      transfermarktServiceMarketValue: service?.marketValue ?? null,
      transfermarktServiceSalary: service?.salary ?? null,
    };

    return {
      ...comparisonBase,
      status: classifyEconomyComparison(comparisonBase),
    };
  });

  const summary = buildEconomyAuditSummary(rows);
  const marketValues = sourcePlayers.map((player) => player.marketValue).filter(isPresentNumber);
  const salaryValues = sourcePlayers.map((player) => player.salaryDemand).filter(isPresentNumber);
  const sourceMarketSamples = new Map<number, string>();
  const sourceSalarySamples = new Map<number, string>();
  for (const player of sourcePlayers) {
    if (isPresentNumber(player.marketValue) && !sourceMarketSamples.has(player.marketValue)) {
      sourceMarketSamples.set(player.marketValue, player.name);
    }
    if (isPresentNumber(player.salaryDemand) && !sourceSalarySamples.has(player.salaryDemand)) {
      sourceSalarySamples.set(player.salaryDemand, player.name);
    }
  }
  const marketStats = getNumberStats(marketValues);
  const salaryStats = getNumberStats(salaryValues);
  const topMarketValueCounts = getTopValueCounts(marketValues, sourceMarketSamples);
  const topSalaryCounts = getTopValueCounts(salaryValues, sourceSalarySamples);
  const countMarket100k = marketValues.filter((value) => value === 100000).length;
  const countSalary10k = salaryValues.filter((value) => value === 10000).length;
  const rawJsonText = JSON.stringify(sourcePlayers.slice(0, 100));
  const localeSuspicion = rawJsonText.includes('": "') ? "possible_string_locale_values_present" : "no_string_locale_signals_detected";
  const rawFieldSamples = [
    buildRawFieldSample(sourcePlayers, "marketValue", ["marketValue", "Marktwert", "MW", "value", "currentValue", "price", "Kosten"]),
    buildRawFieldSample(sourcePlayers, "salaryDemand", ["salaryDemand", "salary", "Gehalt", "Unterhalt", "upkeep"]),
    buildRawFieldSample(sourcePlayers, "purchasePrice", ["purchasePrice", "price", "Kosten"]),
  ];
  const sampleRows = [...rows]
    .sort((left, right) => {
      const severity = (status: AuditStatus) =>
        ({
          scale_mismatch: 0,
          value_mismatch: 1,
          fallback_used: 2,
          missing_in_db: 3,
          missing_in_source: 4,
          match: 5,
        })[status];

      return severity(left.status) - severity(right.status) || left.playerName.localeCompare(right.playerName, "de");
    })
    .slice(0, Math.max(1, input.sampleSize));

  console.log("Player economy source audit");
  console.log("sourceFile: data/generated/oly-player-stats.json");
  console.log(`saveId: ${input.saveId}`);
  console.log(`seasonId: ${input.seasonId}`);
  console.log(`playersCompared: ${rows.length}`);
  console.log(`sourceHasMarketValue: ${summary.sourceHasMarketValue}`);
  console.log(`dbHasMarketValue: ${summary.dbHasMarketValue}`);
  console.log(`sourceHasSalary: ${summary.sourceHasSalary}`);
  console.log(`dbHasSalary: ${summary.dbHasSalary}`);
  console.log(`exactMatches: ${summary.exactMatches}`);
  console.log(`scaleMismatchCandidates: ${summary.scaleMismatchCandidates}`);
  console.log(`missingSalaryCount: ${summary.missingSalaryCount}`);
  console.log(`missingMarketValueCount: ${summary.missingMarketValueCount}`);
  console.log(`fallbackUsedCount: ${summary.fallbackUsedCount}`);
  console.log(`valueMismatchCount: ${summary.valueMismatchCount}`);
  console.log(`distinctMarketValues: ${new Set(marketValues).size}`);
  console.log(`marketValueMin: ${marketStats.min ?? "n/a"}`);
  console.log(`marketValueMax: ${marketStats.max ?? "n/a"}`);
  console.log(`marketValueMedian: ${marketStats.median ?? "n/a"}`);
  console.log(`marketValue100000Count: ${countMarket100k}`);
  console.log(`marketValue100000Pct: ${((countMarket100k / Math.max(marketValues.length, 1)) * 100).toFixed(2)}%`);
  console.log(`distinctSalaryDemandValues: ${new Set(salaryValues).size}`);
  console.log(`salaryDemandMin: ${salaryStats.min ?? "n/a"}`);
  console.log(`salaryDemandMax: ${salaryStats.max ?? "n/a"}`);
  console.log(`salaryDemandMedian: ${salaryStats.median ?? "n/a"}`);
  console.log(`salaryDemand10000Count: ${countSalary10k}`);
  console.log(`salaryDemand10000Pct: ${((countSalary10k / Math.max(salaryValues.length, 1)) * 100).toFixed(2)}%`);
  console.log(`localeSuspicion: ${localeSuspicion}`);
  console.log("rawFieldInventory:");
  for (const field of rawFieldSamples) {
    console.log(
      [
        `- fieldName=${field.fieldName}`,
        `sourcePath=${field.sourcePath}`,
        `present=${field.present ? "yes" : "no"}`,
        `detectedType=${field.detectedType}`,
        `decimalPointCount=${field.decimalPointCount}`,
        `decimalCommaCount=${field.decimalCommaCount}`,
        `repeatedSampleCount=${field.repeatedSampleCount}`,
        `looksDefaultHeavy=${field.looksDefaultHeavy ? "yes" : "no"}`,
        `samples=${field.sampleValues.join(", ")}`,
      ].join(" | "),
    );
  }
  console.log("topMarketValueCounts:");
  for (const entry of topMarketValueCounts) {
    console.log(`- value=${entry.value} | count=${entry.count} | samplePlayer=${entry.samplePlayer ?? "n/a"}`);
  }
  console.log("topSalaryDemandCounts:");
  for (const entry of topSalaryCounts) {
    console.log(`- value=${entry.value} | count=${entry.count} | samplePlayer=${entry.samplePlayer ?? "n/a"}`);
  }
  if (topMarketValueCounts[0] && topMarketValueCounts[0].count / Math.max(marketValues.length, 1) > 0.2) {
    console.log(`defaultValueWarning: marketValue=${topMarketValueCounts[0].value} appears unusually often.`);
  }
  if (topSalaryCounts[0] && topSalaryCounts[0].count / Math.max(salaryValues.length, 1) > 0.2) {
    console.log(`defaultValueWarning: salaryDemand=${topSalaryCounts[0].value} appears unusually often.`);
  }
  console.log("sample:");

  for (const row of sampleRows) {
    console.log(
      [
        `- ${row.playerName}`,
        `playerId=${row.playerId}`,
        `sourceMarketValue=${row.sourceMarketValue ?? "missing"}`,
        `dbMarketValue=${row.dbMarketValue ?? "missing"}`,
        `sourceSalaryDemand=${row.sourceSalaryDemand ?? "missing"}`,
        `dbSalaryDemand=${row.dbSalaryDemand ?? "missing"}`,
        `activePlayerSalary=${row.activePlayerSalary ?? "n/a"}`,
        `serviceMarketValue=${row.transfermarktServiceMarketValue ?? "n/a"}`,
        `serviceSalary=${row.transfermarktServiceSalary ?? "n/a"}`,
        `status=${row.status}`,
      ].join(" | "),
    );
  }
}

async function runCli() {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

const isDirectRun = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectRun) {
  void runCli();
}
