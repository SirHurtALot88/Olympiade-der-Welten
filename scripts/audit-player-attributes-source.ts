import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type AttributeAuditRecommendation =
  | "full_import_possible"
  | "partial_import_possible"
  | "source_missing";

export type AttributeKey12 =
  | "power"
  | "health"
  | "stamina"
  | "intelligence"
  | "determination"
  | "awareness"
  | "speed"
  | "dexterity"
  | "charisma"
  | "will"
  | "spirit"
  | "torment";

type RawPlayerAttributeSource = {
  id: string;
  name: string;
  coreStats?: {
    pow?: number | null;
    spe?: number | null;
    men?: number | null;
    soc?: number | null;
  } | null;
  [key: string]: unknown;
};

type AttributePresence = {
  key: AttributeKey12;
  label: string;
  sourceExists: boolean;
  sourcePath: string | null;
  sourceHeader: string | null;
  dbExists: boolean;
  dbPath: string | null;
  proxyOnly: boolean;
  proxyFrom: string[];
  sourcePresentCount: number;
  dbPresentCount: number;
  missingCount: number;
};

type AttributeExampleRow = {
  playerId: string;
  playerName: string;
  realValues: Partial<Record<AttributeKey12, number | null>>;
  proxyRatings: Partial<Record<AttributeKey12, string | null>>;
};

export type PlayerAttributesAuditReport = {
  sourcePlayerCount: number;
  sourceHeaders: string[];
  jsonKeys: string[];
  attributes: AttributePresence[];
  proxyFieldsUsed: Record<AttributeKey12, string[]>;
  exampleValues: AttributeExampleRow[];
  recommendation: AttributeAuditRecommendation;
};

const PLAYER_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=1895535866";

const PLAYER_STATS_JSON_PATH = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");

const ATTRIBUTE_SPECS: Array<{
  key: AttributeKey12;
  label: string;
  jsonPaths: string[];
  sheetHeaders: string[];
  dbFields: string[];
  proxyFrom: string[];
}> = [
  { key: "power", label: "Power", jsonPaths: ["coreStats.pow"], sheetHeaders: ["Pow"], dbFields: ["pow"], proxyFrom: [] },
  { key: "health", label: "Health", jsonPaths: ["health", "hea"], sheetHeaders: ["Hea", "Health"], dbFields: ["health", "hea"], proxyFrom: ["pow"] },
  { key: "stamina", label: "Stamina", jsonPaths: ["stamina", "sta"], sheetHeaders: ["Sta", "Stamina"], dbFields: ["stamina", "sta"], proxyFrom: ["spe"] },
  { key: "intelligence", label: "Intelligence", jsonPaths: ["intelligence", "int"], sheetHeaders: ["Int", "Intelligence"], dbFields: ["intelligence", "int"], proxyFrom: ["men"] },
  { key: "determination", label: "Determination", jsonPaths: ["determination", "det"], sheetHeaders: ["Det", "Determination"], dbFields: ["determination", "det"], proxyFrom: ["men"] },
  { key: "awareness", label: "Awareness", jsonPaths: ["awareness", "awa"], sheetHeaders: ["Awa", "Awareness"], dbFields: ["awareness", "awa"], proxyFrom: ["men"] },
  { key: "speed", label: "Speed", jsonPaths: ["coreStats.spe", "speed", "spe"], sheetHeaders: ["Spe"], dbFields: ["spe", "speed"], proxyFrom: [] },
  { key: "dexterity", label: "Dexterity", jsonPaths: ["dexterity", "dex"], sheetHeaders: ["Dex", "Dexterity"], dbFields: ["dexterity", "dex"], proxyFrom: ["spe"] },
  { key: "charisma", label: "Charisma", jsonPaths: ["charisma", "cha"], sheetHeaders: ["Cha", "Charisma"], dbFields: ["charisma", "cha"], proxyFrom: ["soc"] },
  { key: "will", label: "Will", jsonPaths: ["will", "wil"], sheetHeaders: ["Wil", "Will"], dbFields: ["will", "wil"], proxyFrom: ["men"] },
  { key: "spirit", label: "Spirit", jsonPaths: ["spirit", "spi"], sheetHeaders: ["Spi", "Spirit"], dbFields: ["spirit", "spi"], proxyFrom: ["soc"] },
  { key: "torment", label: "Torment", jsonPaths: ["torment", "tor"], sheetHeaders: ["Tor", "Torment"], dbFields: ["torment", "tor"], proxyFrom: ["soc"] },
];

function getByPath(record: Record<string, unknown>, dottedPath: string) {
  const parts = dottedPath.split(".");
  let current: unknown = record;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function hasNumericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
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

export function parseCsvHeader(text: string) {
  const [firstLine] = text.split(/\r?\n/);
  return firstLine ? parseCsvLine(firstLine).map((cell) => cell.trim()) : [];
}

export async function fetchPlayerSheetHeaders() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(PLAYER_SHEET_CSV_URL, {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player sheet CSV (${response.status}).`);
    }

    return parseCsvHeader(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRawPlayerAttributeSource() {
  const fileText = await fs.readFile(PLAYER_STATS_JSON_PATH, "utf8");
  return JSON.parse(fileText) as RawPlayerAttributeSource[];
}

function buildProxyRatingsSummary() {
  return Object.fromEntries(ATTRIBUTE_SPECS.map((spec) => [spec.key, spec.proxyFrom])) as Record<AttributeKey12, string[]>;
}

export function buildPlayerAttributesAuditReport(input: {
  sourcePlayers: RawPlayerAttributeSource[];
  sourceHeaders: string[];
  schemaText: string;
}): PlayerAttributesAuditReport {
  const { sourcePlayers, sourceHeaders, schemaText } = input;
  const jsonKeys = Object.keys(sourcePlayers[0] ?? {}).sort();
  const headerSet = new Set(sourceHeaders);

  const attributes = ATTRIBUTE_SPECS.map<AttributePresence>((spec) => {
    const matchedJsonPath = spec.jsonPaths.find((jsonPath) =>
      sourcePlayers.some((player) => hasNumericValue(getByPath(player as Record<string, unknown>, jsonPath))),
    ) ?? null;

    const matchedHeader = spec.sheetHeaders.find((header) => headerSet.has(header)) ?? null;
    const matchedDbField = spec.dbFields.find((field) =>
      new RegExp(`\\b${field}\\s+(Float|Int)\\b`).test(schemaText),
    ) ?? null;

    const sourcePresentCount = matchedJsonPath
      ? sourcePlayers.filter((player) => hasNumericValue(getByPath(player as Record<string, unknown>, matchedJsonPath))).length
      : 0;

    const sourceExists = Boolean(matchedJsonPath || matchedHeader);
    const dbExists = Boolean(matchedDbField);

    return {
      key: spec.key,
      label: spec.label,
      sourceExists,
      sourcePath: matchedJsonPath,
      sourceHeader: matchedHeader,
      dbExists,
      dbPath: matchedDbField ? `PlayerAttribute.${matchedDbField}` : null,
      proxyOnly: !sourceExists && spec.proxyFrom.length > 0,
      proxyFrom: spec.proxyFrom,
      sourcePresentCount,
      dbPresentCount: dbExists ? sourcePlayers.length : 0,
      missingCount: sourcePlayers.length - sourcePresentCount,
    };
  });

  const recommendation = (() => {
    const realCount = attributes.filter((attribute) => attribute.sourceExists).length;
    if (realCount === ATTRIBUTE_SPECS.length) {
      return "full_import_possible";
    }
    if (realCount > 0) {
      return "partial_import_possible";
    }
    return "source_missing";
  })();

  const exampleValues = sourcePlayers.slice(0, 10).map<AttributeExampleRow>((player) => {
    const realValues = Object.fromEntries(
      ATTRIBUTE_SPECS.map((spec) => {
        const jsonPath = spec.jsonPaths.find((candidate) =>
          hasNumericValue(getByPath(player as Record<string, unknown>, candidate)),
        );
        return [spec.key, jsonPath ? (getByPath(player as Record<string, unknown>, jsonPath) as number) : null];
      }),
    ) as Partial<Record<AttributeKey12, number | null>>;

    return {
      playerId: player.id,
      playerName: player.name,
      realValues,
      proxyRatings: Object.fromEntries(
        ATTRIBUTE_SPECS.filter((spec) => spec.proxyFrom.length > 0).map((spec) => [spec.key, `${spec.proxyFrom.join("+")} -> rating tier`]),
      ) as Partial<Record<AttributeKey12, string | null>>,
    };
  });

  return {
    sourcePlayerCount: sourcePlayers.length,
    sourceHeaders,
    jsonKeys,
    attributes,
    proxyFieldsUsed: buildProxyRatingsSummary(),
    exampleValues,
    recommendation,
  };
}

async function main() {
  const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
  const schemaText = await fs.readFile(schemaPath, "utf8");
  const sourcePlayers = await loadRawPlayerAttributeSource();

  let sourceHeaders: string[] = [];
  try {
    sourceHeaders = await fetchPlayerSheetHeaders();
  } catch (error) {
    console.warn(`Sheet header fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const report = buildPlayerAttributesAuditReport({
    sourcePlayers,
    sourceHeaders,
    schemaText,
  });

  console.log("Player attributes source audit");
  console.log(`sourcePlayerCount: ${report.sourcePlayerCount}`);
  console.log(`recommendation: ${report.recommendation}`);
  console.log("");
  console.log("Attribute coverage");
  for (const attribute of report.attributes) {
    console.log(
      `- ${attribute.label}: source=${attribute.sourceExists ? "real" : attribute.proxyOnly ? "proxy_only" : "missing"} | db=${attribute.dbExists ? "present" : "missing"} | sourcePath=${attribute.sourcePath ?? "-"} | sheetHeader=${attribute.sourceHeader ?? "-"} | dbPath=${attribute.dbPath ?? "-"} | missingCount=${attribute.missingCount}`,
    );
  }
  console.log("");
  console.log("Proxy fields used");
  for (const [key, proxyFrom] of Object.entries(report.proxyFieldsUsed)) {
    if (proxyFrom.length > 0) {
      console.log(`- ${key}: ${proxyFrom.join(", ")}`);
    }
  }
  console.log("");
  console.log("Example values (first 10 players)");
  for (const row of report.exampleValues) {
    const values = ATTRIBUTE_SPECS.map((spec) => `${spec.key}=${row.realValues[spec.key] ?? "x"}`).join(" | ");
    console.log(`- ${row.playerName} (${row.playerId}) :: ${values}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
