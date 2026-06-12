import fs from "node:fs";
import path from "node:path";

const projectRoot = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";
const referencesDir = path.join(projectRoot, "references", "retool-ai-golden-master");
const docsDir = path.join(projectRoot, "docs");
const outputDir = path.join(projectRoot, "references", "retool-standings-economy");
const retoolAppExportCandidates = [
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (7).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (6).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (5).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (4).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (3).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (2).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (1).json",
  "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard.json",
] as const;

const groups = {
  standings: [
    "Saisonstand",
    "standings",
    "rank",
    "points",
    "fame",
    "point_diff",
    "matches_played",
    "wins",
    "losses",
    "draws",
    "player_season_scores",
    "saisonstand_history",
    "team_season_history",
    "alliance_team_scores",
    "alliance_matchups",
    "points_for",
    "points_against",
  ],
  scoring: [
    "updateCurrentScore",
    "updateCurrentScoreX10Query",
    "base_score_x_10",
    "form_points_x_10",
    "trait_points_x_10",
    "total_score_x_10",
    "captain_boost_x10",
    "formkarten_v2",
    "current_score_x10",
  ],
  cashPrize: [
    "cash",
    "budget",
    "preisgeld",
    "prize",
    "placement",
    "season end",
    "bonus",
    "penalty",
    "Platzierung",
    "cash bonus",
    "cash malus",
  ],
} as const;

type GroupName = keyof typeof groups;

type ExtractedReference = {
  name: string;
  id: string;
  page: string | null;
  sourceKind: "JS Query" | "SQL" | "Function" | "State" | "Component" | "unknown";
  body: string;
  dependencies: string[];
  searchHits: string[];
  extractionQuality: "complete" | "partial" | "quirky";
  sourceFile: string;
};

type SaisonstandColumnSourceStatus =
  | "mapped"
  | "mapped_with_transform"
  | "missing_source"
  | "blocked_formula_unclear"
  | "intentionally_hidden"
  | "legacy_not_ported";

type SaisonstandColumnContractEntry = {
  order: number;
  retoolColumnName: string;
  displayLabel: string;
  normalizedKey: string;
  retoolType: "string" | "decimal" | "unknown";
  visibleInRetool: boolean;
  hiddenInRetool: boolean;
  currentAppField: string | null;
  sourceKind: string;
  sourceDescription: string;
  sourceStatus: SaisonstandColumnSourceStatus;
  transformNote: string | null;
  format: string;
  compactVisible: boolean;
  expertVisible: boolean;
  retoolColumnId: string;
  columnSize: number | null;
  alignment: string | null;
  headerBackgroundColor: string | null;
  headerTextColor: string | null;
  valueTransform: string | null;
  decimalPlaces: number | null;
  sortRole: "points_desc" | "rank_asc" | "text" | "numeric" | null;
  notes: string | null;
};

type SaisonstandColumnContract = {
  generatedAt: string;
  sourceAppExportPath: string;
  sourceComponentId: string;
  sourcePage: string;
  dataSourceExpression: string;
  columns: SaisonstandColumnContractEntry[];
};

function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function readFileText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function listReferenceFiles(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .map((name) => path.join(dir, name))
    .filter((filePath) => fs.statSync(filePath).isFile());
}

function inferSourceKind(filePath: string, body: string): ExtractedReference["sourceKind"] {
  if (filePath.endsWith(".state.js")) return "State";
  if (filePath.endsWith(".sql")) return "SQL";
  if (body.includes("SELECT ") || body.includes("INSERT ") || body.includes("UPDATE ")) return "SQL";
  if (filePath.endsWith(".js")) {
    if (body.includes("query") || body.includes(".trigger(")) return "JS Query";
    return "Function";
  }
  return "unknown";
}

function inferPage(body: string) {
  const pageMatch = body.match(/\/\/\s*page:\s*(.+)/i);
  if (pageMatch?.[1]) {
    return pageMatch[1].trim();
  }
  if (body.includes("Saisonstand")) return "Saisonstand";
  if (body.includes("Transfermarkt")) return "Transfermarkt";
  if (body.includes("Teams")) return "Teams";
  return null;
}

function extractDependencies(body: string) {
  const deps = new Set<string>();
  for (const match of body.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const dependency = match[1]?.trim();
    if (dependency) deps.add(dependency);
  }
  for (const match of body.matchAll(/\b([A-Za-z0-9_]+)\.trigger\(/g)) {
    const dependency = match[1]?.trim();
    if (dependency) deps.add(`${dependency}.trigger()`);
  }
  return Array.from(deps).sort();
}

function extractSearchHits(body: string, terms: readonly string[]) {
  const lowerBody = body.toLowerCase();
  return terms.filter((term) => lowerBody.includes(term.toLowerCase()));
}

function inferQuality(filePath: string, body: string, hitCount: number): ExtractedReference["extractionQuality"] {
  if (body.includes("No direct code/value block could be extracted")) return "quirky";
  if (filePath.endsWith(".txt") && !body.includes("const ") && !body.includes("SELECT ")) return "partial";
  if (hitCount <= 1 && body.length < 120) return "partial";
  return "complete";
}

function buildReference(filePath: string, matchedTerms: string[]): ExtractedReference {
  const body = readFileText(filePath);
  const baseName = path.basename(filePath);
  return {
    name: baseName,
    id: baseName,
    page: inferPage(body),
    sourceKind: inferSourceKind(filePath, body),
    body,
    dependencies: extractDependencies(body),
    searchHits: matchedTerms,
    extractionQuality: inferQuality(filePath, body, matchedTerms.length),
    sourceFile: filePath,
  };
}

function collectGroupReferences(files: string[], terms: readonly string[]) {
  const results: ExtractedReference[] = [];
  for (const filePath of files) {
    const body = readFileText(filePath);
    const matchedTerms = extractSearchHits(body, terms);
    if (matchedTerms.length > 0) {
      results.push(buildReference(filePath, matchedTerms));
    }
  }
  return results.sort((left, right) => left.name.localeCompare(right.name));
}

function writeJson(fileName: string, value: unknown) {
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeReadme(summary: Record<GroupName, ExtractedReference[]>) {
  const lines = [
    "# Retool Standings & Economy Extract",
    "",
    "Read-only Extrakt der vorhandenen Retool-Referenzen fuer Punkte, Saisonstand, Scoring und Cash/Preisgeld.",
    "",
    "## Dateien",
    "- `manifest.json`",
    "- `standings.raw.json`",
    "- `scoring.raw.json`",
    "- `cash-prize.raw.json`",
    "",
    "## Trefferuebersicht",
    `- Standings: ${summary.standings.length}`,
    `- Scoring: ${summary.scoring.length}`,
    `- Cash/Prize: ${summary.cashPrize.length}`,
    "",
    "## Hinweise",
    "- Die Referenzen stammen aus exportierten Retool-Artefakten und vorhandener Doku.",
    "- `quirky` bedeutet: Spur ist vorhanden, aber technisch nicht als vollstaendige Einzelquery rekonstruierbar.",
    "- Diese Dateien sind Extrakte und keine produktive App-Logik.",
  ];
  fs.writeFileSync(path.join(outputDir, "README.md"), `${lines.join("\n")}\n`, "utf8");
}

function buildManifest(summary: Record<GroupName, ExtractedReference[]>) {
  return {
    generatedAt: new Date().toISOString(),
    sourceDir: referencesDir,
    sourceAppExportPath: getRetoolAppExportPath(),
    docsUsed: [
      path.join(docsDir, "README_RETOOL_SYSTEM.md"),
      path.join(docsDir, "SYSTEM_MAP_RETOOL_REFERENCE.md"),
    ],
    groups: {
      standings: summary.standings.length,
      scoring: summary.scoring.length,
      cashPrize: summary.cashPrize.length,
    },
  };
}

function getRetoolAppExportPath() {
  const found = retoolAppExportCandidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("No Retool Draftboard export found in Downloads.");
  }
  return found;
}

function normalizeContractKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function parsePairArray(raw: string) {
  const parsed = JSON.parse(`[${raw}]`) as Array<string | number | boolean | null>;
  const pairs: Array<[string, string | number | boolean | null]> = [];
  for (let index = 0; index < parsed.length; index += 2) {
    pairs.push([String(parsed[index]), parsed[index + 1] ?? null]);
  }
  return pairs;
}

function extractFieldBlock(appState: string, componentId: string, fieldName: string) {
  const componentIndex = appState.indexOf(`"id","${componentId}"`);
  if (componentIndex === -1) {
    throw new Error(`Component ${componentId} not found in Retool export.`);
  }

  const fieldIndex = appState.indexOf(`"${fieldName}",["^1L",[`, componentIndex);
  if (fieldIndex === -1) {
    throw new Error(`Field ${fieldName} not found for component ${componentId}.`);
  }

  const start = fieldIndex + `"${fieldName}",["^1L",[`.length;
  const end = appState.indexOf("]]", start);
  if (end === -1) {
    throw new Error(`Could not close ${fieldName} block for component ${componentId}.`);
  }

  return parsePairArray(appState.slice(start, end));
}

function buildSaisonstandColumnMappings() {
  const disciplineMappings = Object.fromEntries(
    [
      "schach",
      "tdm",
      "gewichtheben",
      "eiskunst",
      "fechten",
      "spurt",
      "football",
      "showcase",
      "takeshi",
      "breaking",
      "hockey",
      "tennis",
      "battlefield",
      "mini_dm",
      "climbing",
      "basketball",
      "i_spy",
      "staffel",
      "wettessen",
      "time_trial",
    ].map((normalizedKey) => [
      normalizedKey,
      {
        currentAppField: `disciplineValues.${normalizedKey}`,
        sourceKind: "sheet_value",
        sourceDescription: "Direct team discipline value from the mapped season-standings sheet export.",
        sourceStatus: "mapped_with_transform" as const,
        transformNote: "Reads the exact season-standings sheet column after team mapping.",
        format: "decimal_1",
        compactVisible: true,
        decimalPlaces: 1,
        valueTransform: null,
        sortRole: "numeric" as const,
        notes: "Shown in compact season standings because the source is real and Retool-visible.",
      },
    ]),
  );

  return {
    platzierung: {
      currentAppField: "sponsorRank",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct placement-style finance field from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Sponsor Rank value; kept separate from the current sport rank.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: "Visible Retool finance placement column; sourced from the sheet export field, not from the current sport rank.",
    },
    kuerzel: {
      currentAppField: "teamCode",
      sourceKind: "team",
      sourceDescription: "Team short code from team data.",
      sourceStatus: "intentionally_hidden",
      transformNote: null,
      format: "string",
      compactVisible: false,
      decimalPlaces: null,
      valueTransform: null,
      sortRole: "text",
      notes: "Hidden in Retool.",
    },
    cash_fc: {
      currentAppField: "cashFc",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct Cash FC value from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Cash FC field as-is.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    ...disciplineMappings,
    gehalt: {
      currentAppField: "salaryTotal",
      sourceKind: "team_management_overview",
      sourceDescription: "Sum of active player salaries from the shared team management aggregation.",
      sourceStatus: "mapped",
      transformNote: "Uses ActivePlayer.salary / RosterEntry.salary sum.",
      format: "decimal_2",
      compactVisible: false,
      decimalPlaces: 2,
      valueTransform: null,
      sortRole: "numeric",
      notes: "Visible team salary column in normal management units.",
    },
    guv: {
      currentAppField: "guv",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct GuV value from the season-standings sheet export / corrected Retool season data.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported GuV field as-is.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    startplatz: {
      currentAppField: "startplatz",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct start placement value from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Startplatz field as-is.",
      format: "decimal_0",
      compactVisible: false,
      decimalPlaces: 0,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    sponsor_season: {
      currentAppField: "sponsorSeason",
      sourceKind: "derived_from_season_standings_sheet",
      sourceDescription: "Derived sponsor season component from real exported season finance fields.",
      sourceStatus: "mapped_with_transform",
      transformNote:
        "Computed as Sponsor Total - Sponsor Basis - Platzierung, matching the explicit Retool correctedSaisonstand formula.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    cash_total: {
      currentAppField: "cashTotal",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct cash total value from the season-standings sheet export / corrected Retool season data.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Cash Total field as-is.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    punkte: {
      currentAppField: "points",
      sourceKind: "standings_preview_snapshot",
      sourceDescription: "Current season points from the read-only standings snapshot.",
      sourceStatus: "mapped",
      transformNote: "Retool sorted the visible table by Punkte descending.",
      format: "decimal_1",
      compactVisible: true,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "points_desc",
      notes: "Default visible sort source in Retool sortedSaisonstand.",
    },
    basis: {
      currentAppField: "sponsorBasis",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct sponsor basis field from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Sponsor Basis field as-is.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    platz: {
      currentAppField: "rank",
      sourceKind: "standings_preview_snapshot",
      sourceDescription: "Current season rank from the read-only standings snapshot.",
      sourceStatus: "mapped",
      transformNote: null,
      format: "decimal_0",
      compactVisible: true,
      decimalPlaces: 0,
      valueTransform: null,
      sortRole: "rank_asc",
      notes: "Sports rank, distinct from Retool finance placement column.",
    },
    bonuspunkte: {
      currentAppField: null,
      sourceKind: "legacy_not_ported",
      sourceDescription: "Retool bonus points logic is not ported into the current read-only season table.",
      sourceStatus: "legacy_not_ported",
      transformNote: null,
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    sponsor_total: {
      currentAppField: "sponsorTotal",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct sponsor total field from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Sponsor Total field as-is.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    vertragslange: {
      currentAppField: "avgContractLength",
      sourceKind: "team_management_overview",
      sourceDescription: "Average active contract length from the shared team management aggregation.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Rendered with one decimal place.",
      format: "decimal_1",
      compactVisible: true,
      decimalPlaces: 1,
      valueTransform: "fixed_1",
      sortRole: "numeric",
      notes: null,
    },
    mannschaft: {
      currentAppField: "teamName",
      sourceKind: "team",
      sourceDescription: "Team display name from team data.",
      sourceStatus: "mapped_with_transform",
      transformNote: "App corrects the visible Retool bug and renders this header as 'Team'.",
      format: "string",
      compactVisible: true,
      decimalPlaces: null,
      valueTransform: null,
      sortRole: "text",
      notes: "Retool bug used 'Klasse' as visible label; app uses the correct label 'Team'.",
    },
    cash: {
      currentAppField: "cash",
      sourceKind: "team_season_state_cash",
      sourceDescription: "Current cash from TeamSeasonState / standings snapshot cash source.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Retool rounded visible cash cells to one decimal place.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: "fixed_1",
      sortRole: "numeric",
      notes: "Displayed value follows Retool one-decimal rounding, but source remains current team cash.",
    },
    form: {
      currentAppField: "financeForm",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct form field from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Form field as-is.",
      format: "decimal_1",
      compactVisible: false,
      decimalPlaces: 1,
      valueTransform: "fixed_1",
      sortRole: "numeric",
      notes: null,
    },
    rank_diff: {
      currentAppField: "rankDiff",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Direct rank delta field from the season-standings sheet export.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Rank Diff field as-is.",
      format: "decimal_0",
      compactVisible: false,
      decimalPlaces: 0,
      valueTransform: null,
      sortRole: "numeric",
      notes: null,
    },
    transfers: {
      currentAppField: "transfersSeasonValue",
      sourceKind: "season_standings_sheet",
      sourceDescription: "Retool transfer finance column is read from the season-standings export when present; empty exports stay empty.",
      sourceStatus: "mapped_with_transform",
      transformNote: "Reads the exported Transfers field; empty cells remain null instead of falling back to 0 or transfer count.",
      format: "decimal_2",
      compactVisible: false,
      decimalPlaces: 2,
      valueTransform: null,
      sortRole: "numeric",
      notes: "Do not map to transferCount; screenshot values indicate a money-like field.",
    },
  } as const satisfies Record<
    string,
    {
      currentAppField: string | null;
      sourceKind: string;
      sourceDescription: string;
      sourceStatus: SaisonstandColumnSourceStatus;
      transformNote: string | null;
      format: string;
      compactVisible: boolean;
      decimalPlaces: number | null;
      valueTransform: string | null;
      sortRole: "points_desc" | "rank_asc" | "text" | "numeric" | null;
      notes: string | null;
    }
  >;
}

function extractSaisonstandColumnContract(): SaisonstandColumnContract {
  const exportPath = getRetoolAppExportPath();
  const outer = JSON.parse(readFileText(exportPath)) as {
    page?: { data?: { appState?: string } };
  };
  const appState = outer.page?.data?.appState;
  if (!appState) {
    throw new Error("Retool export does not contain page.data.appState.");
  }

  const componentId = "saisonstandTable";
  const fullNames = new Map(extractFieldBlock(appState, componentId, "_columnKey").map(([id, value]) => [id, String(value ?? "")]));
  const labels = new Map(extractFieldBlock(appState, componentId, "_columnLabel").map(([id, value]) => [id, String(value ?? "")]));
  const hiddenMap = new Map(extractFieldBlock(appState, componentId, "_columnHidden").map(([id, value]) => [id, String(value ?? "") === "true"]));
  const formatMap = new Map(extractFieldBlock(appState, componentId, "_columnFormat").map(([id, value]) => [id, String(value ?? "unknown")]));
  const alignmentMap = new Map(extractFieldBlock(appState, componentId, "_columnAlignment").map(([id, value]) => [id, String(value ?? "")]));
  const sizeMap = new Map(extractFieldBlock(appState, componentId, "_columnSize").map(([id, value]) => [id, typeof value === "number" ? value : Number(value)]));
  const headerBgMap = new Map(extractFieldBlock(appState, componentId, "_columnHeaderBackgroundColor").map(([id, value]) => [id, String(value ?? "")]));
  const headerTextMap = new Map(extractFieldBlock(appState, componentId, "_columnHeaderTextColor").map(([id, value]) => [id, String(value ?? "")]));

  const mapping = buildSaisonstandColumnMappings();
  const orderedIds = Array.from(fullNames.keys());

  const columns = orderedIds.map((columnId, index) => {
    const retoolColumnName = fullNames.get(columnId) ?? columnId;
    const normalizedKey = normalizeContractKey(retoolColumnName);
    const metadata = mapping[normalizedKey as keyof typeof mapping] ?? {
      currentAppField: null,
      sourceKind: "missing_source",
      sourceDescription: "No current app source mapping recorded for this Retool column.",
      sourceStatus: "missing_source" as const,
      transformNote: null,
      format: formatMap.get(columnId) ?? "unknown",
      compactVisible: false,
      decimalPlaces: null,
      valueTransform: null,
      sortRole: null,
      notes: null,
    };
    const hiddenInRetool = hiddenMap.get(columnId) ?? false;

    return {
      order: index + 1,
      retoolColumnName,
      displayLabel:
        normalizedKey === "mannschaft"
          ? "Team"
          : (labels.get(columnId) ?? retoolColumnName),
      normalizedKey,
      retoolType: (formatMap.get(columnId) as "string" | "decimal" | undefined) ?? "unknown",
      visibleInRetool: !hiddenInRetool,
      hiddenInRetool,
      currentAppField: metadata.currentAppField,
      sourceKind: metadata.sourceKind,
      sourceDescription: metadata.sourceDescription,
      sourceStatus: hiddenInRetool ? "intentionally_hidden" : metadata.sourceStatus,
      transformNote: metadata.transformNote,
      format: metadata.format,
      compactVisible: metadata.compactVisible && !hiddenInRetool,
      expertVisible: !hiddenInRetool,
      retoolColumnId: columnId,
      columnSize: Number.isFinite(sizeMap.get(columnId) ?? Number.NaN) ? Number(sizeMap.get(columnId)) : null,
      alignment: alignmentMap.get(columnId) || null,
      headerBackgroundColor: headerBgMap.get(columnId) || null,
      headerTextColor: headerTextMap.get(columnId) || null,
      valueTransform: metadata.valueTransform,
      decimalPlaces: metadata.decimalPlaces,
      sortRole: metadata.sortRole,
      notes: metadata.notes,
    } satisfies SaisonstandColumnContractEntry;
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceAppExportPath: exportPath,
    sourceComponentId: componentId,
    sourcePage: "Saisonstand",
    dataSourceExpression: "{{ sortedSaisonstand.value }}",
    columns,
  };
}

function main() {
  ensureOutputDir();

  const referenceFiles = listReferenceFiles(referencesDir);
  const docsFiles = [
    path.join(docsDir, "README_RETOOL_SYSTEM.md"),
    path.join(docsDir, "SYSTEM_MAP_RETOOL_REFERENCE.md"),
  ].filter((filePath) => fs.existsSync(filePath));
  const searchableFiles = [...referenceFiles, ...docsFiles];

  const standings = collectGroupReferences(searchableFiles, groups.standings);
  const scoring = collectGroupReferences(searchableFiles, groups.scoring);
  const cashPrize = collectGroupReferences(searchableFiles, groups.cashPrize);

  const summary = { standings, scoring, cashPrize };

  writeJson("manifest.json", buildManifest(summary));
  writeJson("standings.raw.json", standings);
  writeJson("scoring.raw.json", scoring);
  writeJson("cash-prize.raw.json", cashPrize);
  writeJson("saisonstand-column-contract.json", extractSaisonstandColumnContract());
  writeReadme(summary);

  console.log(`standings hits: ${standings.length}`);
  console.log(`scoring hits: ${scoring.length}`);
  console.log(`cash-prize hits: ${cashPrize.length}`);
  console.log(`output: ${outputDir}`);
}

main();
