import fs from "node:fs";
import path from "node:path";

type RetoolAttributeRow = {
  name?: string | null;
  [key: string]: unknown;
};

type FuzzyCandidate = {
  sourceName: string;
  candidates: string[];
};

type SampleMatch = {
  sourceName: string;
  appPlayerId: string;
  appPlayerName: string;
};

type InvalidNumberEntry = {
  sourceName: string;
  field: string;
  value: unknown;
};

type InvalidRatingEntry = {
  sourceName: string;
  field: string;
  value: unknown;
};

export type MappingAuditResult = {
  status: "ok" | "blocked";
  blockedReason: string | null;
  queryFound: boolean;
  dataAvailable: boolean;
  sourceKind: string | null;
  tableName: string | null;
  headers: string[];
  missingRequiredFields: string[];
  exactMatches: number;
  matchRate: number;
  missingInApp: string[];
  missingInAttributes: string[];
  duplicateNames: string[];
  fuzzyCandidates: FuzzyCandidate[];
  invalidNumbers: InvalidNumberEntry[];
  invalidRatings: InvalidRatingEntry[];
  sampleMatches: SampleMatch[];
};

const RETOOL_DIR = path.resolve("references/retool-player-attributes");
const FIELD_PATH = path.join(RETOOL_DIR, "attribute-fields.json");
const DATA_JSON_PATH = path.join(RETOOL_DIR, "attribute-data.json");
const DATA_CSV_PATH = path.join(RETOOL_DIR, "attribute-data.csv");
const PLAYER_STATS_JSON_PATH = path.resolve("data/generated/oly-player-stats.json");

const REQUIRED_NUMBER_FIELDS = [
  "power",
  "health",
  "stamina",
  "determination",
  "speed",
  "dexterity",
  "intelligence",
  "awareness",
  "will",
  "charisma",
  "spirit",
  "torment",
] as const;

const REQUIRED_RATING_FIELDS = [
  "power_rating",
  "health_rating",
  "stamina_rating",
  "determination_rating",
  "speed_rating",
  "dexterity_rating",
  "intelligence_rating",
  "awareness_rating",
  "will_rating",
  "charisma_rating",
  "spirit_rating",
  "torment_rating",
] as const;

const REQUIRED_FIELDS = ["name", ...REQUIRED_NUMBER_FIELDS, ...REQUIRED_RATING_FIELDS] as const;
const VALID_RATINGS = new Set(["S+", "S", "A", "B", "C", "D", "E", "F"]);

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

  const header = (rows[0] ?? []).map((cell) => cell.trim());
  return rows.slice(1).map((line) => Object.fromEntries(header.map((key, index) => [key, line[index]?.trim() ?? ""])));
}

function toSnakeCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function canonicalizeRow(row: RetoolAttributeRow) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [toSnakeCase(key), value]);
  const normalized = Object.fromEntries(normalizedEntries) as Record<string, unknown>;
  return normalized;
}

function loadRetoolAttributeData() {
  if (fs.existsSync(DATA_JSON_PATH)) {
    const raw = JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf8")) as RetoolAttributeRow[] | { rows?: RetoolAttributeRow[] };
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw.rows) ? raw.rows : [];
    return rows.map(canonicalizeRow);
  }
  if (fs.existsSync(DATA_CSV_PATH)) {
    return parseCsv(fs.readFileSync(DATA_CSV_PATH, "utf8")).map(canonicalizeRow);
  }
  return null;
}

function fuzzyCandidateNames(sourceName: string, appNames: string[]) {
  const normalized = normalizeName(sourceName);
  const tokens = normalized.split(" ").filter(Boolean);
  return appNames.filter((candidate) => {
    const appNormalized = normalizeName(candidate);
    return tokens.some((token) => token.length >= 4 && appNormalized.includes(token));
  });
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toRating(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

export function buildRetoolAttributeMappingAudit(): MappingAuditResult {
  const fieldMeta = fs.existsSync(FIELD_PATH)
    ? (JSON.parse(fs.readFileSync(FIELD_PATH, "utf8")) as {
        queryName?: string;
        sourceKind?: string;
        tableName?: string | null;
        fields?: string[];
      })
    : null;
  const queryFound = Boolean(fieldMeta?.queryName);
  const data = loadRetoolAttributeData();

  if (!data) {
    return {
      status: "blocked",
      blockedReason: "Attribute data missing; need export from Retool/Google Sheet Attribute tab",
      queryFound,
      dataAvailable: false,
      sourceKind: fieldMeta?.sourceKind ?? null,
      tableName: fieldMeta?.tableName ?? null,
      headers: fieldMeta?.fields ?? [],
      missingRequiredFields: [...REQUIRED_FIELDS],
      exactMatches: 0,
      matchRate: 0,
      missingInApp: [],
      missingInAttributes: [],
      duplicateNames: [],
      fuzzyCandidates: [],
      invalidNumbers: [],
      invalidRatings: [],
      sampleMatches: [],
    };
  }

  const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))));
  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => !headers.includes(field));

  if (missingRequiredFields.length > 0) {
    return {
      status: "blocked",
      blockedReason: `Missing required attribute fields: ${missingRequiredFields.join(", ")}`,
      queryFound,
      dataAvailable: true,
      sourceKind: fieldMeta?.sourceKind ?? null,
      tableName: fieldMeta?.tableName ?? null,
      headers,
      missingRequiredFields,
      exactMatches: 0,
      matchRate: 0,
      missingInApp: [],
      missingInAttributes: [],
      duplicateNames: [],
      fuzzyCandidates: [],
      invalidNumbers: [],
      invalidRatings: [],
      sampleMatches: [],
    };
  }

  const appPlayers = JSON.parse(fs.readFileSync(PLAYER_STATS_JSON_PATH, "utf8")) as Array<{ id: string; name: string }>;
  const appByName = new Map(appPlayers.map((player) => [normalizeName(player.name), player]));
  const appNames = appPlayers.map((player) => player.name);

  const sourceNames = data.map((row) => String(row.name ?? "").trim()).filter(Boolean);
  const duplicates = sourceNames.filter((name, index) => sourceNames.indexOf(name) !== index);
  const uniqueSourceNames = Array.from(new Set(sourceNames));

  const invalidNumbers: InvalidNumberEntry[] = [];
  const invalidRatings: InvalidRatingEntry[] = [];

  for (const row of data) {
    const sourceName = String(row.name ?? "").trim() || "(missing-name)";
    for (const field of REQUIRED_NUMBER_FIELDS) {
      const value = row[field];
      if (toNumber(value) == null) {
        invalidNumbers.push({ sourceName, field, value });
      }
    }
    for (const field of REQUIRED_RATING_FIELDS) {
      const rating = toRating(row[field]);
      if (!rating || !VALID_RATINGS.has(rating)) {
        invalidRatings.push({ sourceName, field, value: row[field] });
      }
    }
  }

  const exactMatches = uniqueSourceNames.filter((name) => appByName.has(normalizeName(name))).length;
  const matchRate = uniqueSourceNames.length ? Number(((exactMatches / uniqueSourceNames.length) * 100).toFixed(2)) : 0;
  const missingInApp = uniqueSourceNames.filter((name) => !appByName.has(normalizeName(name)));
  const sourceNameSet = new Set(uniqueSourceNames.map((name) => normalizeName(name)));
  const missingInAttributes = appPlayers
    .filter((player) => !sourceNameSet.has(normalizeName(player.name)))
    .slice(0, 100)
    .map((player) => player.name);

  const fuzzyCandidates = missingInApp.slice(0, 25).map((name) => ({
    sourceName: name,
    candidates: fuzzyCandidateNames(name, appNames).slice(0, 5),
  }));

  const sampleMatches = uniqueSourceNames
    .filter((name) => appByName.has(normalizeName(name)))
    .slice(0, 10)
    .map((name) => {
      const player = appByName.get(normalizeName(name))!;
      return {
        sourceName: name,
        appPlayerId: player.id,
        appPlayerName: player.name,
      };
    });

  return {
    status: "ok",
    blockedReason: null,
    queryFound,
    dataAvailable: true,
    sourceKind: fieldMeta?.sourceKind ?? null,
    tableName: fieldMeta?.tableName ?? null,
    headers,
    missingRequiredFields: [],
    exactMatches,
    matchRate,
    missingInApp,
    missingInAttributes,
    duplicateNames: Array.from(new Set(duplicates)),
    fuzzyCandidates,
    invalidNumbers,
    invalidRatings,
    sampleMatches,
  };
}

if (require.main === module) {
  const result = buildRetoolAttributeMappingAudit();
  console.log("Retool attribute mapping audit");
  console.log(`status: ${result.status}`);
  console.log(`queryFound: ${result.queryFound ? "yes" : "no"}`);
  console.log(`dataAvailable: ${result.dataAvailable ? "yes" : "no"}`);
  console.log(`sourceKind: ${result.sourceKind ?? "unknown"}`);
  console.log(`tableName: ${result.tableName ?? "unknown"}`);
  console.log(`headers: ${result.headers.join(" | ") || "none"}`);
  if (result.blockedReason) {
    console.log(`blocked: ${result.blockedReason}`);
    process.exit(0);
  }
  console.log(`exactMatches: ${result.exactMatches}`);
  console.log(`matchRate: ${result.matchRate}%`);
  console.log(`missingInApp: ${result.missingInApp.length}`);
  console.log(`missingInAttributes: ${result.missingInAttributes.length}`);
  console.log(`duplicateNames: ${result.duplicateNames.join(", ") || "none"}`);
  console.log(`invalidNumbers: ${result.invalidNumbers.length}`);
  console.log(`invalidRatings: ${result.invalidRatings.length}`);
}
