import fs from "node:fs";
import path from "node:path";

const DOWNLOADS_DIR = "/Users/chrisfalk/Downloads";
const OUTPUT_DIR = path.resolve("references/retool-transfermarkt-columns");
const RETOOL_JSON_PATTERN = /^Olympiade%20der%20Welten%20Draftboard(?: \(\d+\))?\.json$/;

export type RetoolTransfermarktColumn = {
  id: string;
  label: string | null;
  dataKey: string | null;
  visible: boolean | "conditional" | null;
  hiddenExpression: string | null;
  order: number;
  width: number | null;
  type: string | null;
  format: string | null;
  numberFormat: string | null;
  currencyFormat: string | null;
  percentFormat: string | null;
  decimalSettings: string | null;
  prefix: string | null;
  suffix: string | null;
  alignment: string | null;
  sortable: boolean | null;
  filterable: boolean | null;
  editable: boolean | null;
  valueFormatting: string | null;
  conditionalFormatting: string[];
  formattingExpressions: string[];
  expressionRefs: string[];
  foundColorCodes: string[];
};

export type RetoolTransfermarktTable = {
  componentName: string;
  componentId: string;
  page: string | null;
  subtype: string | null;
  tableTitle: string | null;
  dataSource: string | null;
  columns: RetoolTransfermarktColumn[];
  rowActions: Array<{
    label: string | null;
    event: string | null;
    method: string | null;
    script: string | null;
  }>;
  dependencies: {
    queries: string[];
    transformers: string[];
    states: string[];
    components: string[];
    all: string[];
  };
};

export type RetoolFormattingColumn = {
  table: string;
  columnId: string;
  label: string | null;
  dataKey: string | null;
  order: number;
  type: string | null;
  format: string | null;
  numberFormat: string | null;
  currencyFormat: string | null;
  percentFormat: string | null;
  decimalSettings: string | null;
  prefix: string | null;
  suffix: string | null;
  alignment: string | null;
  width: number | null;
  visible: boolean | "conditional" | null;
  hiddenExpression: string | null;
  editable: boolean | null;
  readOnly: boolean | null;
  valueFormatting: string | null;
  formattingExpressions: string[];
  conditionalFormatting: string[];
  expressionRefs: string[];
  foundColorCodes: string[];
};

export type RetoolFormattingExtraction = {
  sourcePath?: string;
  extractedAt?: string;
  foundColorCodes: string[];
  foundConditionalFormattingRules: number;
  columnsWithFormatting: number;
  formattingExtractionQuality: "high" | "medium" | "low";
  tables: Array<{
    componentName: string;
    dataSource: string | null;
    columns: RetoolFormattingColumn[];
  }>;
};

type PluginBlock = {
  name: string;
  componentId: string | null;
  type: string | null;
  subtype: string | null;
  page: string | null;
  block: string;
};

const KNOWN_TRANSFERMARKT_TABLES = ["playersTable", "aiTeamNeedsTable", "playersTable2", "563c2352", "fb9267f5"] as const;

function decodeEscapedString(value: string) {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function parseSerializedValue(raw: string) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return decodeEscapedString(raw.slice(1, -1));
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return raw;
}

function parseFlatMap(block: string, fieldName: string) {
  const token = `"${fieldName}",["^1L",[`;
  const start = block.indexOf(token);
  if (start === -1) {
    return new Map<string, string | number | boolean>();
  }

  const bodyStart = start + token.length;
  const bodyEnd = block.indexOf("]]", bodyStart);
  if (bodyEnd === -1) {
    return new Map<string, string | number | boolean>();
  }

  const body = block.slice(bodyStart, bodyEnd);
  const map = new Map<string, string | number | boolean>();
  const pairRegex = /"([^"]*)",(true|false|-?\d+(?:\.\d+)?|"(?:\\.|[^"])*")/g;
  for (const pair of body.matchAll(pairRegex)) {
    const key = pair[1] ?? "";
    const value = pair[2] ?? "";
    map.set(key, parseSerializedValue(value));
  }

  return map;
}

const CSS_COLOR_NAMES = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "brown",
  "teal",
  "cyan",
  "magenta",
  "lime",
  "maroon",
  "navy",
  "olive",
  "silver",
  "aqua",
  "transparent",
]);

function extractExpressionRefs(value: string | null) {
  if (!value) {
    return [];
  }

  const refs = new Set<string>();
  for (const token of ["currentSourceRow", "self", "item", "row", "value", "currentRow", "currentColumn"]) {
    if (value.includes(token)) {
      refs.add(token);
    }
  }
  return Array.from(refs);
}

function extractColorCodes(value: string | null) {
  if (!value) {
    return [];
  }

  const colors = new Set<string>();
  for (const match of value.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)) {
    colors.add(match[0]);
  }
  for (const match of value.matchAll(/\brgba?\([^)]+\)/gi)) {
    colors.add(match[0]);
  }
  for (const match of value.matchAll(/\bhsla?\([^)]+\)/gi)) {
    colors.add(match[0]);
  }
  for (const match of value.matchAll(/["']([A-Za-z]+)["']/g)) {
    const token = match[1]?.toLowerCase();
    if (token && CSS_COLOR_NAMES.has(token)) {
      colors.add(match[1]!);
    }
  }

  return Array.from(colors);
}

function inferFormatDetails(format: string | null, valueFormatting: string | null) {
  const combined = [format, valueFormatting].filter(Boolean).join(" ");
  const currencyFormat = format === "currency" || /\bcurrency\b/i.test(combined) ? "currency" : null;
  const percentFormat = format === "percent" || /\bpercent\b/i.test(combined) ? "percent" : null;
  const numberFormat = format === "decimal" || /\bdecimal\b/i.test(combined) ? "decimal" : null;
  const decimalSettings = /toFixed\((\d+)\)/.exec(combined)?.[1] ?? null;
  const prefix = /['"`]([^'"`]+)['"`]\s*\+/.exec(combined)?.[1] ?? null;
  const suffix = /\+\s*['"`]([^'"`]+)['"`]/.exec(combined)?.[1] ?? null;

  return {
    numberFormat,
    currencyFormat,
    percentFormat,
    decimalSettings,
    prefix,
    suffix,
  };
}

function parseIdList(block: string, fieldName: string) {
  const token = `"${fieldName}",["^A",[`;
  const start = block.indexOf(token);
  if (start === -1) {
    return [];
  }

  const bodyStart = start + token.length;
  const bodyEnd = block.indexOf("]]", bodyStart);
  if (bodyEnd === -1) {
    return [];
  }

  return Array.from(block.slice(bodyStart, bodyEnd).matchAll(/"([^"]+)"/g)).map((candidate) => candidate[1]!);
}

function extractMustacheDependencies(value: string | null) {
  if (!value) {
    return [];
  }

  const dependencies = new Set<string>();
  for (const match of value.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const dependency = match[1]?.trim();
    if (dependency) {
      dependencies.add(dependency);
    }
  }

  return Array.from(dependencies);
}

function extractDotValueRefs(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(new Set(Array.from(value.matchAll(/\b([A-Za-z0-9_]+)\.value\b/g)).map((match) => match[1]!)));
}

function categorizeDependencies(values: string[]) {
  const queries = new Set<string>();
  const transformers = new Set<string>();
  const states = new Set<string>();
  const components = new Set<string>();

  for (const value of values) {
    if (/Table$|^playersTable\d*$|modal|drawer|container|text|button|select|checkbox|tabs?/i.test(value)) {
      components.add(value);
      continue;
    }
    if (/state|snapshot|filter|selected|picked|current|plan|runState/i.test(value)) {
      states.add(value);
      continue;
    }
    if (/get|query|pool|ratings|playersWith|buy|history|overview|candidate/i.test(value)) {
      queries.add(value);
      continue;
    }
    transformers.add(value);
  }

  return {
    queries: Array.from(queries).sort(),
    transformers: Array.from(transformers).sort(),
    states: Array.from(states).sort(),
    components: Array.from(components).sort(),
    all: Array.from(new Set(values)).sort(),
  };
}

export function listPluginBlocks(serialized: string) {
  return KNOWN_TRANSFERMARKT_TABLES.flatMap<PluginBlock>((name) => {
    const token = `"${name}",["^0",["^ ","n","pluginTemplate","v",["^ ","id","`;
    const index = serialized.indexOf(token);
    if (index === -1) {
      return [];
    }

    let nextIndex = serialized.length;
    for (const otherName of KNOWN_TRANSFERMARKT_TABLES) {
      if (otherName === name) continue;
      const candidateIndex = serialized.indexOf(`"${otherName}",["^0",["^ ","n","pluginTemplate","v",["^ ","id","`, index + token.length);
      if (candidateIndex !== -1 && candidateIndex < nextIndex) {
        nextIndex = candidateIndex;
      }
    }

    const block = serialized.slice(index, Math.min(serialized.length, Math.min(nextIndex + 1, index + 200000)));
    const type = (block.match(/"\^1F","([^"]+)"/)?.[1] ?? null) as string | null;
    const subtype = (block.match(/"\^1G","([^"]+)"/)?.[1] ?? null) as string | null;
    const page = (block.match(/"\^1V","([^"]+)"/)?.[1] ?? null) as string | null;
    const componentId = block.match(/"\^ ","id","([^"]+)"/)?.[1] ?? null;

    return [
      {
        name,
        componentId,
        type,
        subtype,
        page,
        block,
      },
    ];
  });
}

function inferTableTitle(block: string, componentName: string) {
  const explicit = block.match(/"emptyMessage","((?:\\.|[^"])*)"/)?.[1];
  if (explicit) {
    return decodeEscapedString(explicit);
  }
  return componentName;
}

function parseDataSource(block: string) {
  const token = '"data","';
  const start = block.indexOf(token);
  if (start === -1) {
    return null;
  }
  const bodyStart = start + token.length;
  let index = bodyStart;
  let escaped = false;
  while (index < block.length) {
    const char = block[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      index += 1;
      continue;
    }
    if (char === '"') {
      return decodeEscapedString(block.slice(bodyStart, index));
    }
    index += 1;
  }
  return null;
}

function parseColumns(block: string) {
  const ids = parseIdList(block, "_columnIds");
  const labels = parseFlatMap(block, "_columnLabel");
  const dataKeys = parseFlatMap(block, "_columnKey");
  const hidden = parseFlatMap(block, "_columnHidden");
  const widths = parseFlatMap(block, "_columnSize");
  const formats = parseFlatMap(block, "_columnFormat");
  const alignments = parseFlatMap(block, "_columnAlignment");
  const sortDisabled = parseFlatMap(block, "_columnSortDisabled");
  const editable = parseFlatMap(block, "_columnEditable");
  const valueOverride = parseFlatMap(block, "_columnValueOverride");
  const backgroundColor = parseFlatMap(block, "_columnBackgroundColor");
  const textColor = parseFlatMap(block, "_columnTextColor");

  return ids.map<RetoolTransfermarktColumn>((id, order) => {
    const hiddenValue = hidden.get(id);
    const hiddenExpression = typeof hiddenValue === "string" ? hiddenValue : hiddenValue == null ? null : String(hiddenValue);
    const visibility =
      hiddenExpression == null || hiddenExpression === "" || hiddenExpression === "false"
        ? true
        : hiddenExpression === "true"
          ? false
          : "conditional";

    const formattingExpression = valueOverride.get(id);
    const conditionalFormatting = [
      backgroundColor.get(id),
      textColor.get(id),
    ]
      .flatMap((value) => (typeof value === "string" && value.trim().length > 0 ? [value] : []));
    const formattingExpressions = [
      typeof formattingExpression === "string" && formattingExpression.length > 0 ? String(formattingExpression) : null,
      ...conditionalFormatting,
      hiddenExpression,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));
    const expressionRefs = Array.from(new Set(formattingExpressions.flatMap((value) => extractExpressionRefs(value))));
    const foundColorCodes = Array.from(new Set(formattingExpressions.flatMap((value) => extractColorCodes(value))));
    const formatValue = typeof formats.get(id) === "string" ? String(formats.get(id)) : null;
    const formatDetails = inferFormatDetails(
      formatValue,
      typeof formattingExpression === "string" && formattingExpression.length > 0 ? String(formattingExpression) : null,
    );

    return {
      id,
      label: typeof labels.get(id) === "string" ? String(labels.get(id)) : null,
      dataKey: typeof dataKeys.get(id) === "string" ? String(dataKeys.get(id)) : null,
      visible: visibility,
      hiddenExpression,
      order,
      width: typeof widths.get(id) === "number" ? Number(widths.get(id)) : null,
      type: formatValue,
      format: formatValue,
      numberFormat: formatDetails.numberFormat,
      currencyFormat: formatDetails.currencyFormat,
      percentFormat: formatDetails.percentFormat,
      decimalSettings: formatDetails.decimalSettings,
      prefix: formatDetails.prefix,
      suffix: formatDetails.suffix,
      alignment: typeof alignments.get(id) === "string" ? String(alignments.get(id)) : null,
      sortable: sortDisabled.has(id) ? sortDisabled.get(id) !== true : null,
      filterable: true,
      editable: editable.has(id) ? editable.get(id) !== "" : null,
      valueFormatting: typeof formattingExpression === "string" && formattingExpression.length > 0 ? String(formattingExpression) : null,
      conditionalFormatting,
      formattingExpressions,
      expressionRefs,
      foundColorCodes,
    };
  });
}

function parseRowActions(block: string) {
  const labels = parseFlatMap(block, "_actionLabel");
  const actions = parseIdList(block, "_actionIds");

  return actions.map((id) => {
    const targetToken = `"targetId","${id}"`;
    const targetIndex = block.indexOf(targetToken);
    const actionWindow =
      targetIndex === -1 ? "" : block.slice(Math.max(0, targetIndex - 1200), Math.min(block.length, targetIndex + 5000));
    const event = actionWindow.match(/"event","([^"]+)"/)?.[1] ?? null;
    const method = actionWindow.match(/"method","([^"]+)"/)?.[1] ?? null;
    const scriptMatch = actionWindow.match(/"src","((?:\\.|[^"])*)"/)?.[1] ?? null;

    return {
      label: typeof labels.get(id) === "string" ? String(labels.get(id)) : null,
      event,
      method,
      script: scriptMatch ? decodeEscapedString(scriptMatch) : null,
    };
  });
}

export function extractTransfermarktTablesFromSerialized(serialized: string) {
  const blocks = listPluginBlocks(serialized);
  const candidateTables = blocks.filter((block) => {
    if (block.page !== "transfermarktPage") {
      return false;
    }

    if (block.subtype !== "TableWidget2") {
      return false;
    }

    return /(player|wishlist|candidate|listing|free|buy|need|table|market)/i.test(block.name);
  });

  return candidateTables.map<RetoolTransfermarktTable>((block) => {
    const dataSource = parseDataSource(block.block);
    const columns = parseColumns(block.block);
    const rowActions = parseRowActions(block.block);
    const dependencyValues = new Set<string>([
      ...extractMustacheDependencies(dataSource),
      ...extractDotValueRefs(dataSource),
      ...rowActions.flatMap((action) => extractDotValueRefs(action.script)),
      ...rowActions.flatMap((action) => extractMustacheDependencies(action.script)),
    ]);

    return {
      componentName: block.name,
      componentId: block.componentId ?? block.name,
      page: block.page,
      subtype: block.subtype,
      tableTitle: inferTableTitle(block.block, block.name),
      dataSource,
      columns,
      rowActions,
      dependencies: categorizeDependencies(Array.from(dependencyValues)),
    };
  });
}

export function buildTransfermarktFormattingExtraction(
  tables: RetoolTransfermarktTable[],
): RetoolFormattingExtraction {
  const formattingTables = tables.map((table) => ({
    componentName: table.componentName,
    dataSource: table.dataSource,
    columns: table.columns.map<RetoolFormattingColumn>((column) => ({
      table: table.componentName,
      columnId: column.id,
      label: column.label,
      dataKey: column.dataKey,
      order: column.order,
      type: column.type,
      format: column.format,
      numberFormat: column.numberFormat,
      currencyFormat: column.currencyFormat,
      percentFormat: column.percentFormat,
      decimalSettings: column.decimalSettings,
      prefix: column.prefix,
      suffix: column.suffix,
      alignment: column.alignment,
      width: column.width,
      visible: column.visible,
      hiddenExpression: column.hiddenExpression,
      editable: column.editable,
      readOnly: column.editable == null ? null : !column.editable,
      valueFormatting: column.valueFormatting,
      formattingExpressions: column.formattingExpressions,
      conditionalFormatting: column.conditionalFormatting,
      expressionRefs: column.expressionRefs,
      foundColorCodes: column.foundColorCodes,
    })),
  }));

  const allColumns = formattingTables.flatMap((table) => table.columns);
  const foundColorCodes = Array.from(new Set(allColumns.flatMap((column) => column.foundColorCodes))).sort();
  const foundConditionalFormattingRules = allColumns.reduce(
    (sum, column) => sum + column.conditionalFormatting.length,
    0,
  );
  const columnsWithFormatting = allColumns.filter(
    (column) => column.conditionalFormatting.length > 0 || column.valueFormatting || column.hiddenExpression,
  ).length;
  const formattingExtractionQuality =
    foundColorCodes.length > 0 && foundConditionalFormattingRules > 0
      ? "high"
      : columnsWithFormatting > 0
        ? "medium"
        : "low";

  return {
    foundColorCodes,
    foundConditionalFormattingRules,
    columnsWithFormatting,
    formattingExtractionQuality,
    tables: formattingTables,
  };
}

function findLatestRetoolJsonPath() {
  const entries = fs
    .readdirSync(DOWNLOADS_DIR)
    .filter((entry) => RETOOL_JSON_PATTERN.test(entry))
    .map((entry) => path.join(DOWNLOADS_DIR, entry))
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return entries[0]?.filePath ?? null;
}

function loadRetoolAppState(sourcePath: string) {
  const raw = fs.readFileSync(sourcePath, "utf8");
  const parsed = JSON.parse(raw) as {
    page?: {
      data?: {
        appState?: string;
      };
    };
  };

  const appState = parsed.page?.data?.appState;
  if (!appState) {
    throw new Error("Retool JSON does not contain page.data.appState.");
  }

  return appState;
}

export function writeTransfermarktColumnExtraction(params?: {
  sourcePath?: string;
  outputDir?: string;
}) {
  const sourcePath = params?.sourcePath ?? findLatestRetoolJsonPath();
  if (!sourcePath) {
    throw new Error("No Retool Draftboard JSON found in Downloads.");
  }

  const outputDir = params?.outputDir ?? OUTPUT_DIR;
  const serialized = loadRetoolAppState(sourcePath);
  const tables = extractTransfermarktTablesFromSerialized(serialized);
  const formatting = buildTransfermarktFormattingExtraction(tables);

  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = {
    sourcePath,
    extractedAt: new Date().toISOString(),
    tablesFound: tables.length,
    tables: tables.map((table) => ({
      componentName: table.componentName,
      componentId: table.componentId,
      page: table.page,
      subtype: table.subtype,
      dataSource: table.dataSource,
      columnCount: table.columns.length,
      rowActionCount: table.rowActions.length,
      dependencies: table.dependencies,
    })),
    foundColorCodes: formatting.foundColorCodes,
    foundConditionalFormattingRules: formatting.foundConditionalFormattingRules,
    columnsWithFormatting: formatting.columnsWithFormatting,
    formattingExtractionQuality: formatting.formattingExtractionQuality,
  };

  fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "transfermarkt-columns.raw.json"), `${JSON.stringify(tables, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDir, "transfermarkt-formatting.raw.json"),
    `${JSON.stringify(
      {
        ...formatting,
        sourcePath,
        extractedAt: manifest.extractedAt,
      },
      null,
      2,
    )}\n`,
  );

  const readme = [
    "# Retool Transfermarkt Column Extract",
    "",
    `Source: \`${sourcePath}\``,
    "",
    `Tables found: ${tables.length}`,
    "",
    ...tables.flatMap((table) => [
      `## ${table.componentName}`,
      `- componentId: \`${table.componentId}\``,
      `- page: \`${table.page ?? "unknown"}\``,
      `- subtype: \`${table.subtype ?? "unknown"}\``,
      `- data source: \`${table.dataSource ?? "unknown"}\``,
      `- columns: ${table.columns.length}`,
      `- actions: ${table.rowActions.map((action) => action.label ?? action.method ?? "unknown").join(", ") || "none"}`,
      `- dependencies: ${table.dependencies.all.join(", ") || "none"}`,
      "",
    ]),
  ].join("\n");

  fs.writeFileSync(path.join(outputDir, "README.md"), `${readme}\n`);

  return {
    sourcePath,
    outputDir,
    tables,
    formatting,
  };
}

if (process.argv[1]?.includes("extract-retool-transfermarkt-columns.ts")) {
  const result = writeTransfermarktColumnExtraction();
  console.log(`sourcePath: ${result.sourcePath}`);
  console.log(`tablesFound: ${result.tables.length}`);
  console.log(`foundColorCodes: ${result.formatting.foundColorCodes.length}`);
  for (const table of result.tables) {
    console.log(`- ${table.componentName}: columns=${table.columns.length}, actions=${table.rowActions.length}`);
  }
}
