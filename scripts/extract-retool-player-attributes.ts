import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("references/retool-player-attributes");
const DOWNLOADS_DIR = "/Users/chrisfalk/Downloads";
const RETOOL_JSON_PATTERN = /^Olympiade%20der%20Welten%20Draftboard(?: \(\d+\))?\.json$/;
const PROJECT_RETROOL_REF = path.resolve("references/retool-ai-golden-master/getPlayerAttributesForAI.state.js");

type ExtractedAttributeSource = {
  queryName: string;
  sourceKind: "GoogleSheetsQuery" | "SqlQueryUnified" | "unknown";
  page: string | null;
  resourceDisplayName: string | null;
  spreadsheetId: string | null;
  sheetName: string | null;
  queryBody: string | null;
  tableName: string | null;
  fields: string[];
  ratings: string[];
  extractionQuality: "complete" | "partial" | "quirky";
  dataEmbedded: boolean;
  notes: string[];
  sourcePath: string;
};

const ATTRIBUTE_FIELDS = [
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
];

const RATING_FIELDS = ATTRIBUTE_FIELDS.map((field) => `${field}_rating`);

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function findRetoolJsonCandidates() {
  return fs
    .readdirSync(DOWNLOADS_DIR)
    .filter((name) => RETOOL_JSON_PATTERN.test(name))
    .map((name) => {
      const filePath = path.join(DOWNLOADS_DIR, name);
      const stat = fs.statSync(filePath);
      return { filePath, mtimeMs: stat.mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function extractQuotedValue(block: string, key: string) {
  const pattern = new RegExp(`"${key}","((?:\\\\.|[^"])*)"`);
  const match = pattern.exec(block);
  return match ? match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n") : null;
}

function extractRetoolBlockFromJson(jsonText: string) {
  const queryStart = jsonText.indexOf('"getAttributeData"');
  if (queryStart === -1) {
    return null;
  }

  const nextKnownBlock = jsonText.indexOf('"getRassenData"', queryStart);
  const blockEnd = nextKnownBlock === -1 ? Math.min(jsonText.length, queryStart + 12000) : nextKnownBlock;
  return jsonText.slice(queryStart, blockEnd);
}

function findBestRetoolJsonBlock() {
  for (const candidate of findRetoolJsonCandidates()) {
    const text = fs.readFileSync(candidate.filePath, "utf8");
    const block = extractRetoolBlockFromJson(text);
    if (block && block.includes('"sheetName","Attribute"')) {
      return { block, sourcePath: candidate.filePath };
    }
  }

  const fallback = findRetoolJsonCandidates()[0];
  if (!fallback) {
    return null;
  }

  const text = fs.readFileSync(fallback.filePath, "utf8");
  const block = extractRetoolBlockFromJson(text);
  return block ? { block, sourcePath: fallback.filePath } : null;
}

function extractAttributeSource(): ExtractedAttributeSource {
  const notes: string[] = [];

  const stateJsExists = fs.existsSync(PROJECT_RETROOL_REF);
  const stateJsText = stateJsExists ? fs.readFileSync(PROJECT_RETROOL_REF, "utf8") : "";
  const stateJsPartial =
    stateJsText.includes("getPlayerAttributesForAI") || stateJsText.includes("GoogleSheetsQuery") || stateJsText.includes("Attribute");

  let block = "";
  let sourcePath = PROJECT_RETROOL_REF;
  const jsonBlock = findBestRetoolJsonBlock();
  if (jsonBlock) {
    block = jsonBlock.block;
    sourcePath = jsonBlock.sourcePath;
  }

  const queryName = block ? "getAttributeData" : stateJsPartial ? "getPlayerAttributesForAI" : "unknown";
  const sourceKind = block.includes('"GoogleSheetsQuery"')
    ? "GoogleSheetsQuery"
    : block.includes('"SqlQueryUnified"')
      ? "SqlQueryUnified"
      : stateJsText.includes("SqlQueryUnified")
        ? "SqlQueryUnified"
        : stateJsText.includes("GoogleSheetsQuery")
          ? "GoogleSheetsQuery"
          : "unknown";
  const page = extractQuotedValue(block, "^1V") ?? extractQuotedValue(block, "page") ?? (stateJsText.match(/page:\s*([^\n]+)/)?.[1]?.trim() ?? null);
  const resourceDisplayName = extractQuotedValue(block, "^1J");
  const spreadsheetId = extractQuotedValue(block, "spreadsheetId");
  const sheetName = extractQuotedValue(block, "sheetName");
  const queryBody = extractQuotedValue(block, "query");
  const tableName = sheetName ?? (queryBody?.match(/FROM\s+"([^"]+)"/i)?.[1] ?? null);

  if (!block && stateJsPartial) {
    notes.push("Project reference contains only metadata for the attribute query.");
  }
  if (sourceKind === "GoogleSheetsQuery") {
    notes.push("Retool source is a Google Sheets query against the Attribute tab, not an embedded SQL body.");
  }
  if (!queryBody) {
    notes.push("Query found, data not embedded.");
  }

  const extractionQuality: ExtractedAttributeSource["extractionQuality"] = queryBody
    ? "complete"
    : block
      ? "partial"
      : "quirky";

  return {
    queryName,
    sourceKind,
    page,
    resourceDisplayName,
    spreadsheetId,
    sheetName,
    queryBody,
    tableName,
    fields: ATTRIBUTE_FIELDS,
    ratings: RATING_FIELDS,
    extractionQuality,
    dataEmbedded: false,
    notes,
    sourcePath,
  };
}

function writeOutputs(source: ExtractedAttributeSource) {
  ensureOutputDir();

  const querySqlText = source.queryBody
    ? source.queryBody
    : [
        "-- Retool attribute source located",
        `-- queryName: ${source.queryName}`,
        `-- sourceKind: ${source.sourceKind}`,
        `-- page: ${source.page ?? "unknown"}`,
        `-- sourcePath: ${source.sourcePath}`,
        `-- spreadsheetId: ${source.spreadsheetId ?? "unknown"}`,
        `-- sheetName: ${source.sheetName ?? "unknown"}`,
        "-- Query found, data not embedded.",
      ].join("\n");

  fs.writeFileSync(path.join(OUTPUT_DIR, "attribute-query.sql"), `${querySqlText}\n`, "utf8");
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "attribute-fields.json"),
    `${JSON.stringify(
      {
        queryName: source.queryName,
        sourceKind: source.sourceKind,
        page: source.page,
        resourceDisplayName: source.resourceDisplayName,
        spreadsheetId: source.spreadsheetId,
        sheetName: source.sheetName,
        tableName: source.tableName,
        fields: source.fields,
        ratings: source.ratings,
        extractionQuality: source.extractionQuality,
        dataEmbedded: source.dataEmbedded,
        notes: source.notes,
        sourcePath: source.sourcePath,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const readme = [
    "# Retool Player Attributes Extract",
    "",
    `- Query name: \`${source.queryName}\``,
    `- Source kind: \`${source.sourceKind}\``,
    `- Page: \`${source.page ?? "unknown"}\``,
    `- Source path: \`${source.sourcePath}\``,
    `- Spreadsheet: \`${source.resourceDisplayName ?? "unknown"}\``,
    `- Spreadsheet ID: \`${source.spreadsheetId ?? "unknown"}\``,
    `- Sheet name: \`${source.sheetName ?? "unknown"}\``,
    `- Extraction quality: \`${source.extractionQuality}\``,
    "",
    "## Attribute fields",
    ...source.fields.map((field) => `- \`${field}\``),
    "",
    "## Rating fields",
    ...source.ratings.map((field) => `- \`${field}\``),
    "",
    "## Data status",
    source.dataEmbedded ? "- Embedded Retool data found." : "- Query found, data not embedded.",
    "",
    "## Notes",
    ...source.notes.map((note) => `- ${note}`),
    "",
    "If a future export includes raw Attribute rows, place them next to this README as `attribute-data.json` or `attribute-data.csv` for mapping audits.",
  ].join("\n");

  fs.writeFileSync(path.join(OUTPUT_DIR, "README.md"), `${readme}\n`, "utf8");
}

export function extractRetoolPlayerAttributes() {
  const source = extractAttributeSource();
  writeOutputs(source);
  return source;
}

if (require.main === module) {
  const result = extractRetoolPlayerAttributes();
  console.log("Retool player attributes extract");
  console.log(`queryName: ${result.queryName}`);
  console.log(`sourceKind: ${result.sourceKind}`);
  console.log(`page: ${result.page ?? "unknown"}`);
  console.log(`tableName: ${result.tableName ?? "unknown"}`);
  console.log(`sourcePath: ${result.sourcePath}`);
  console.log(`extractionQuality: ${result.extractionQuality}`);
  console.log(`dataEmbedded: ${result.dataEmbedded ? "yes" : "no"}`);
  console.log(`notes: ${result.notes.join(" | ") || "none"}`);
}
