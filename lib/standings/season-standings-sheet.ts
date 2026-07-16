import fs from "node:fs/promises";
import path from "node:path";
import {
  analyzePrizeMoneySheet,
  PRIZE_MONEY_NORMALIZED_CSV_PATH,
  PRIZE_MONEY_NORMALIZED_JSON_PATH,
  type PrizeMoneyNormalizedRow,
} from "@/lib/season/prize-money-sheet";

export const SEASON_STANDINGS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=589766543";

// Repo-relative root so the bundled reference sheets resolve on any machine/CI, not just the
// original macOS workspace. Previously a hardcoded absolute macOS path, which made rank-to-points /
// standings sheets unresolvable off that machine — blocking matchday resolution (points_table_missing)
// and thus season completion + sponsor settlement.
const WORKSPACE_ROOT = process.cwd();

export const LOCAL_STANDINGS_CSV_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "season-standings.csv",
);
export const LOCAL_STANDINGS_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "season-standings.json",
);
export const LOCAL_RANK_TO_POINTS_CSV_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "rank-to-points.csv",
);
export const LOCAL_RANK_TO_POINTS_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "rank-to-points.json",
);
export const LOCAL_PRIZE_MONEY_CSV_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "prize-money-table.csv",
);
export const LOCAL_PRIZE_MONEY_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "prize-money-table.json",
);

export type StandingsSourceKind = "season_standings" | "rank_to_points" | "prize_money";
export type StandingsDetectedTabKind =
  | "season_standings"
  | "rank_to_points"
  | "prize_money"
  | "attribute_sheet"
  | "unknown";

export type SeasonStandingsSheetRow = {
  raw: Record<string, string>;
  rawTeamLabel: string | null;
  resolvedTeamId: string | null;
  resolvedTeamName: string | null;
  teamName: string | null;
  teamCode: string | null;
  rank: number | null;
  points: number | null;
  currentRank: number | null;
  currentPoints: number | null;
  totalScore: number | null;
  cash: number | null;
  cashFc: number | null;
  startplatz: number | null;
  rankDiff: number | null;
  sponsorBasis: number | null;
  sponsorRank: number | null;
  sponsorTotal: number | null;
  guv: number | null;
  cashTotal: number | null;
  form: number | null;
  transfers: number | null;
  matchday: string | null;
  season: string | null;
  warnings: string[];
};

export type RankToPointsSheetRow = {
  raw: Record<string, string>;
  playerCount: number | null;
  pointsByRank: Record<string, number | null>;
};

export type PrizeMoneySheetRow = {
  raw: Record<string, string>;
  rank: number | null;
  placement: string | null;
  prize: number | null;
  bonus: number | null;
  malus: number | null;
  league: string | null;
  season: string | null;
  percent?: number | null;
  basis?: number | null;
  correction?: number | null;
  sourceRow?: number | null;
  warnings: string[];
};

export type TeamMappingCandidate = {
  teamId: string;
  shortCode: string;
  teamName: string;
};

export type SeasonStandingsDisciplineColumn = {
  normalizedKey: string;
  sheetColumn: string;
};

export const SEASON_STANDINGS_DISCIPLINE_COLUMNS: SeasonStandingsDisciplineColumn[] = [
  { normalizedKey: "schach", sheetColumn: "Schach" },
  { normalizedKey: "tdm", sheetColumn: "TDM" },
  { normalizedKey: "gewichtheben", sheetColumn: "Gewichtheben" },
  { normalizedKey: "eiskunst", sheetColumn: "Eiskunst" },
  { normalizedKey: "fechten", sheetColumn: "Fechten" },
  { normalizedKey: "spurt", sheetColumn: "Spurt" },
  { normalizedKey: "football", sheetColumn: "Football" },
  { normalizedKey: "showcase", sheetColumn: "Showcase" },
  { normalizedKey: "takeshi", sheetColumn: "Takeshi" },
  { normalizedKey: "breaking", sheetColumn: "Breaking" },
  { normalizedKey: "hockey", sheetColumn: "Hockey" },
  { normalizedKey: "tennis", sheetColumn: "Tennis" },
  { normalizedKey: "battlefield", sheetColumn: "Battlefield" },
  { normalizedKey: "mini_dm", sheetColumn: "Mini DM" },
  { normalizedKey: "climbing", sheetColumn: "Climbing" },
  { normalizedKey: "basketball", sheetColumn: "Basketball" },
  { normalizedKey: "i_spy", sheetColumn: "I Spy" },
  { normalizedKey: "staffel", sheetColumn: "Staffel" },
  { normalizedKey: "wettessen", sheetColumn: "Wettessen" },
  { normalizedKey: "time_trial", sheetColumn: "Time Trial" },
];

export type SeasonStandingsTeamMappingAudit = {
  mappedTeamsCount: number;
  missingInSheet: string[];
  missingInDb: string[];
  duplicateSheetTeams: string[];
  ambiguousMappings: string[];
  mappingWarnings: string[];
  rows: SeasonStandingsSheetRow[];
};

export type StandingsSheetAudit = {
  sourceKind: StandingsSourceKind;
  access: "remote_csv" | "local_csv" | "local_json" | "missing";
  status: "ok" | "blocked";
  reason: string | null;
  sheetUrl: string | null;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  mappedRows: SeasonStandingsSheetRow[] | RankToPointsSheetRow[] | PrizeMoneySheetRow[];
  expectedExportPaths: string[];
  detectedTabKind: StandingsDetectedTabKind;
  rowsCount: number;
  detectedColumns: string[];
  invalidRows: string[];
  duplicateRanks: number[];
  missingPrizeValues: string[];
  warnings: string[];
  detectedBlocks?: Array<{
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
  }>;
  candidateHeaderRows?: number[];
  candidateDataRanges?: string[];
  rejectedBlocks?: Array<{ id: string; reason: string }>;
  selectedBlock?: {
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
  } | null;
};

export type StandingsSourceOptions = {
  url?: string;
  localCsvPath?: string;
  localJsonPath?: string;
};

type SourceConfig = {
  sourceKind: StandingsSourceKind;
  url: string | null;
  localCsvPath: string;
  localJsonPath: string;
};

type CsvRecords = {
  headers: string[];
  records: Array<Record<string, string>>;
};

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

  return rows.filter((row) => row.some((value) => value.trim().length > 0));
}

function toRecords(text: string): CsvRecords {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map((header) => header.trim());
  const records = rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = row[index] ?? "";
    }
    return record;
  });

  return { headers, records };
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
}

function toNumber(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickValue(record: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (key in record && record[key].trim().length > 0) {
      return record[key];
    }
  }

  return "";
}

function hasAny(normalized: Set<string>, values: string[]) {
  return values.some((value) => normalized.has(normalizeHeader(value)));
}

export function detectSheetTabKind(headers: string[]): StandingsDetectedTabKind {
  const normalized = new Set(headers.map(normalizeHeader));

  if (hasAny(normalized, ["Power", "Health", "Torment Rating"])) {
    return "attribute_sheet";
  }

  if (
    hasAny(normalized, ["Team", "Teamname", "Name", "Mannschaft", "Kuerzel", "Kürzel"]) &&
    hasAny(normalized, ["Rank", "Platz", "Rang"]) &&
    hasAny(normalized, ["Punkte", "Points"]) &&
    (
      hasAny(normalized, ["GesamtScore", "TotalScore", "Gesamtwertung", "Score"]) ||
      hasAny(normalized, ["Cash"]) ||
      hasAny(normalized, ["TDM"]) ||
      hasAny(normalized, ["Mini DM"])
    )
  ) {
    return "season_standings";
  }

  if (
    hasAny(normalized, ["Spieleranzahl"]) &&
    headers.some((header) => /^\d+\.$/.test(header.trim()))
  ) {
    return "rank_to_points";
  }

  if (
    hasAny(normalized, ["Rank", "Platz", "Rang"]) &&
    hasAny(normalized, ["Punkte", "Points"]) &&
    !hasAny(normalized, ["Team", "Teamname", "Name"])
  ) {
    return "rank_to_points";
  }

  if (
    hasAny(normalized, ["Rank", "Platz", "Rang", "Placement", "Platzierung"]) &&
    hasAny(normalized, ["Prize", "Preisgeld", "PrizeMoney", "CashBonus", "Cash Bonus", "Bonus", "Payout"])
  ) {
    return "prize_money";
  }

  return "unknown";
}

function mapSeasonRows(records: Array<Record<string, string>>): SeasonStandingsSheetRow[] {
  return records.map((record) => ({
    raw: record,
    rawTeamLabel:
      pickValue(record, ["Team", "team", "Team Name", "Teamname", "Mannschaft", "Name"]) || null,
    resolvedTeamId: null,
    resolvedTeamName: null,
    teamName:
      pickValue(record, ["Team", "team", "Team Name", "Teamname", "Mannschaft", "Name"]) || null,
    teamCode: pickValue(record, ["Kürzel", "Kuerzel", "Team Code", "Code"]) || null,
    rank: toNumber(pickValue(record, ["Rank", "rank", "Platz", "platz", "Rang", "rang"])),
    points: toNumber(pickValue(record, ["Punkte", "Points", "points", "punkte"])),
    currentRank: toNumber(pickValue(record, ["Rank", "rank", "Platz", "platz", "Rang", "rang"])),
    currentPoints: toNumber(pickValue(record, ["Punkte", "Points", "points", "punkte"])),
    totalScore: toNumber(
      pickValue(record, ["GesamtScore", "TotalScore", "totalScore", "Gesamtwertung", "Score"]),
    ),
    cash: toNumber(pickValue(record, ["Cash", "cash"])),
    cashFc: toNumber(pickValue(record, ["Cash FC", "cash_fc", "CashFC"])),
    startplatz: toNumber(pickValue(record, ["Startplatz", "Start", "startplatz"])),
    rankDiff: toNumber(pickValue(record, ["Rank Diff", "rank_diff", "Diff"])),
    sponsorBasis: toNumber(pickValue(record, ["Sponsor Basis", "Basis", "sponsor_basis"])),
    sponsorRank: toNumber(
      pickValue(record, ["Sponsor Rank", "Platzierung", "platzierung", "sponsor_rank"]),
    ),
    sponsorTotal: toNumber(pickValue(record, ["Sponsor Total", "sponsor_total"])),
    guv: toNumber(pickValue(record, ["GuV", "gu_v", "GUV"])),
    cashTotal: toNumber(pickValue(record, ["Cash Total", "cash_total"])),
    form: toNumber(pickValue(record, ["Form", "form"])),
    transfers: toNumber(pickValue(record, ["Transfers", "transfers"])),
    matchday: pickValue(record, ["Matchday", "Spieltag", "matchday"]) || null,
    season: pickValue(record, ["Season", "Saison", "season"]) || null,
    warnings: [],
  }));
}

function mapRankToPointsRows(records: Array<Record<string, string>>): RankToPointsSheetRow[] {
  const rankKeys = Array.from(
    new Set(
      records.flatMap((record) =>
        Object.keys(record).filter((key) => /^\d+\.$/.test(key.trim())),
      ),
    ),
  ).sort((left, right) => Number(left.replace(".", "")) - Number(right.replace(".", "")));

  return records
    .map((record) => ({
      raw: record,
      playerCount: toNumber(pickValue(record, ["Spieleranzahl", "Player Count", "player_count"])),
      pointsByRank: Object.fromEntries(rankKeys.map((key) => [key, toNumber(record[key])])),
    }))
    .filter((row) => row.playerCount != null);
}

function mapPrizeMoneyRows(records: Array<Record<string, string>>): PrizeMoneySheetRow[] {
  return records.map((record) => ({
    raw: record,
    rank: toNumber(
      pickValue(record, ["Rank", "rank", "Platz", "platz", "Rang", "rang", "Placement", "Platzierung"]),
    ),
    placement:
      pickValue(record, ["Placement", "Platzierung", "Label", "Beschreibung", "Description"]) || null,
    prize: toNumber(pickValue(record, ["Prize", "Preisgeld", "PrizeMoney", "CashBonus", "Cash Bonus", "Payout"])),
    bonus: toNumber(pickValue(record, ["Bonus", "Cash Bonus", "Placement Bonus"])),
    malus: toNumber(pickValue(record, ["Malus", "Penalty", "Cash Malus"])),
    league: pickValue(record, ["Liga", "League", "league"]) || null,
    season: pickValue(record, ["Season", "Saison", "season"]) || null,
    warnings: [],
  }));
}

function mapNormalizedPrizeMoneyRows(rows: PrizeMoneyNormalizedRow[]): PrizeMoneySheetRow[] {
  return rows.map((row) => ({
    raw: {
      rank: row.rank == null ? "" : String(row.rank),
      placementLabel: row.placementLabel ?? "",
      prizeMoney: row.prizeMoney == null ? "" : String(row.prizeMoney),
      percent: row.percent == null ? "" : String(row.percent),
      basis: row.basis == null ? "" : String(row.basis),
      correction: row.correction == null ? "" : String(row.correction),
      bonus: row.bonus == null ? "" : String(row.bonus),
      malus: row.malus == null ? "" : String(row.malus),
      season: row.season ?? "",
      sourceRow: String(row.sourceRow),
    },
    rank: row.rank,
    placement: row.placementLabel,
    prize: row.prizeMoney,
    bonus: row.bonus,
    malus: row.malus,
    league: null,
    season: row.season,
    percent: row.percent,
    basis: row.basis,
    correction: row.correction,
    sourceRow: row.sourceRow,
    warnings: row.warnings,
  }));
}

function mapRowsForKind(
  sourceKind: StandingsSourceKind,
  records: Array<Record<string, string>>,
): StandingsSheetAudit["mappedRows"] {
  if (sourceKind === "rank_to_points") {
    return mapRankToPointsRows(records);
  }

  if (sourceKind === "prize_money") {
    return mapPrizeMoneyRows(records);
  }

  return mapSeasonRows(records);
}

function buildSourceConfig(sourceKind: StandingsSourceKind, options: StandingsSourceOptions = {}): SourceConfig {
  if (sourceKind === "rank_to_points") {
    return {
      sourceKind,
      url: options.url ?? null,
      localCsvPath: options.localCsvPath ?? LOCAL_RANK_TO_POINTS_CSV_PATH,
      localJsonPath: options.localJsonPath ?? LOCAL_RANK_TO_POINTS_JSON_PATH,
    };
  }

  if (sourceKind === "prize_money") {
    return {
      sourceKind,
      url:
        options.url ??
        "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=2059519103",
      localCsvPath: options.localCsvPath ?? LOCAL_PRIZE_MONEY_CSV_PATH,
      localJsonPath: options.localJsonPath ?? LOCAL_PRIZE_MONEY_JSON_PATH,
    };
  }

  return {
    sourceKind,
    url: options.url ?? SEASON_STANDINGS_SHEET_URL,
    localCsvPath: options.localCsvPath ?? LOCAL_STANDINGS_CSV_PATH,
    localJsonPath: options.localJsonPath ?? LOCAL_STANDINGS_JSON_PATH,
  };
}

function expectedTabKindForSource(sourceKind: StandingsSourceKind): StandingsDetectedTabKind {
  return sourceKind;
}

function buildBlockedReason(sourceKind: StandingsSourceKind, detectedTabKind: StandingsDetectedTabKind) {
  if (detectedTabKind === "attribute_sheet") {
    if (sourceKind === "season_standings") {
      return "blocked: configured source currently resolves to Attribute tab, not season standings";
    }
    return `blocked: configured source currently resolves to Attribute tab, not ${sourceKind.replaceAll("_", " ")}`;
  }

  if (detectedTabKind === "unknown") {
    return `blocked: ${sourceKind.replaceAll("_", " ")} export missing, inaccessible, or unrecognized`;
  }

  return `blocked: expected ${sourceKind.replaceAll("_", " ")}, found ${detectedTabKind.replaceAll("_", " ")}`;
}

function detectColumnsForSource(sourceKind: StandingsSourceKind, headers: string[]) {
  const normalized = new Set(headers.map(normalizeHeader));
  if (sourceKind === "prize_money") {
    return [
      hasAny(normalized, ["Platz", "Rank", "Rang", "position"]) ? "rank" : null,
      hasAny(normalized, ["Preisgeld", "Prize", "PrizeMoney", "CashBonus", "Cash Bonus"]) ? "prize" : null,
      hasAny(normalized, ["Bonus", "Cash Bonus", "Placement Bonus"]) ? "bonus" : null,
      hasAny(normalized, ["Malus", "Penalty", "Cash Malus"]) ? "malus" : null,
      hasAny(normalized, ["Liga", "League"]) ? "league" : null,
      hasAny(normalized, ["Season", "Saison"]) ? "season" : null,
    ].filter((value): value is string => Boolean(value));
  }

  if (sourceKind === "rank_to_points") {
    return [
      hasAny(normalized, ["Spieleranzahl"]) ? "player_count" : null,
      headers.some((header) => /^\d+\.$/.test(header.trim())) ? "rank_matrix" : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [
    hasAny(normalized, ["Mannschaft", "Team", "Teamname", "Kürzel"]) ? "team" : null,
    hasAny(normalized, ["Platz", "Rank", "Rang"]) ? "rank" : null,
    hasAny(normalized, ["Punkte", "Points"]) ? "points" : null,
    hasAny(normalized, ["Cash"]) ? "cash" : null,
  ].filter((value): value is string => Boolean(value));
}

function buildAuditMeta(
  sourceKind: StandingsSourceKind,
  headers: string[],
  mappedRows: StandingsSheetAudit["mappedRows"],
) {
  if (sourceKind !== "prize_money") {
    return {
      rowsCount: mappedRows.length,
      detectedColumns: detectColumnsForSource(sourceKind, headers),
      invalidRows: [] as string[],
      duplicateRanks: [] as number[],
      missingPrizeValues: [] as string[],
      warnings: [] as string[],
    };
  }

  const prizeRows = mappedRows as PrizeMoneySheetRow[];
  const invalidRows: string[] = [];
  const duplicateRanks = new Set<number>();
  const missingPrizeValues: string[] = [];
  const seenRanks = new Set<number>();

  prizeRows.forEach((row, index) => {
    if (row.rank == null) {
      invalidRows.push(`invalid_rank_row:${index + 1}`);
    } else if (seenRanks.has(row.rank)) {
      duplicateRanks.add(row.rank);
    } else {
      seenRanks.add(row.rank);
    }

    if (row.prize == null) {
      missingPrizeValues.push(`missing_prize_row:${index + 1}`);
    }
  });

  const warnings = [
    ...Array.from(duplicateRanks).map((rank) => `duplicate_rank:${rank}`),
    ...missingPrizeValues,
    ...invalidRows,
  ];

  return {
    rowsCount: prizeRows.length,
    detectedColumns: detectColumnsForSource(sourceKind, headers),
    invalidRows,
    duplicateRanks: Array.from(duplicateRanks).sort((left, right) => left - right),
    missingPrizeValues,
    warnings,
  };
}

async function readLocalJson(localJsonPath: string) {
  try {
    const text = await fs.readFile(localJsonPath, "utf8");
    const parsed = JSON.parse(text) as Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
    const records = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]),
      ),
    );
    const headers = Array.from(new Set(records.flatMap((row) => Object.keys(row))));
    return { headers, records };
  } catch {
    return null;
  }
}

async function readLocalCsv(localCsvPath: string) {
  try {
    const text = await fs.readFile(localCsvPath, "utf8");
    return toRecords(text);
  } catch {
    return null;
  }
}

async function inspectSource(
  sourceKind: StandingsSourceKind,
  options: StandingsSourceOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<StandingsSheetAudit> {
  if (sourceKind === "prize_money") {
    const analysis = await analyzePrizeMoneySheet();
    const mappedRows = mapNormalizedPrizeMoneyRows(analysis.rows);
    const auditMeta = buildAuditMeta(sourceKind, analysis.rawHeaders, mappedRows);

    return {
      sourceKind,
      access: mappedRows.length > 0 ? "local_csv" : "missing",
      status: analysis.status,
      reason:
        analysis.status === "ok"
          ? null
          : analysis.reason === "prize_money_table_missing"
            ? "blocked: prize money export missing, inaccessible, or unrecognized"
            : "blocked: prize money table invalid or ambiguous",
      sheetUrl: buildSourceConfig(sourceKind, options).url,
      headers: analysis.rawHeaders,
      sampleRows: mappedRows.slice(0, 5).map((row) => row.raw),
      mappedRows,
      expectedExportPaths: [
        LOCAL_PRIZE_MONEY_CSV_PATH,
        LOCAL_PRIZE_MONEY_JSON_PATH,
        PRIZE_MONEY_NORMALIZED_CSV_PATH,
        PRIZE_MONEY_NORMALIZED_JSON_PATH,
      ],
      detectedTabKind: analysis.status === "ok" ? "prize_money" : "unknown",
      ...auditMeta,
      warnings: Array.from(new Set([...(auditMeta.warnings ?? []), ...analysis.warnings])),
      detectedBlocks: analysis.detectedBlocks,
      candidateHeaderRows: analysis.candidateHeaderRows,
      candidateDataRanges: analysis.candidateDataRanges,
      rejectedBlocks: analysis.rejectedBlocks,
      selectedBlock: analysis.selectedBlock,
    };
  }

  const config = buildSourceConfig(sourceKind, options);
  const expectedExportPaths = [config.localCsvPath, config.localJsonPath];

  const createAudit = (
    access: StandingsSheetAudit["access"],
    headers: string[],
    records: Array<Record<string, string>>,
    detectedTabKind: StandingsDetectedTabKind,
  ): StandingsSheetAudit => {
    const status = detectedTabKind === expectedTabKindForSource(sourceKind) ? "ok" : "blocked";
    const mappedRows = mapRowsForKind(sourceKind, records);
    const auditMeta = buildAuditMeta(sourceKind, headers, mappedRows);
    return {
      sourceKind,
      access,
      status,
      reason: status === "ok" ? null : buildBlockedReason(sourceKind, detectedTabKind),
      sheetUrl: config.url,
      headers,
      sampleRows: records.slice(0, 5),
      mappedRows,
      expectedExportPaths,
      detectedTabKind,
      ...auditMeta,
    };
  };

  const localCsv = await readLocalCsv(config.localCsvPath);
  if (localCsv) {
    return createAudit("local_csv", localCsv.headers, localCsv.records, detectSheetTabKind(localCsv.headers));
  }

  const localJson = await readLocalJson(config.localJsonPath);
  if (localJson) {
    return createAudit("local_json", localJson.headers, localJson.records, detectSheetTabKind(localJson.headers));
  }

  if (!config.url) {
    return {
      sourceKind,
      access: "missing",
      status: "blocked",
      reason: `blocked: ${sourceKind.replaceAll("_", " ")} export missing, inaccessible, or unrecognized`,
      sheetUrl: null,
      headers: [],
      sampleRows: [],
      mappedRows: [],
      expectedExportPaths,
      detectedTabKind: "unknown",
      rowsCount: 0,
      detectedColumns: [],
      invalidRows: [],
      duplicateRanks: [],
      missingPrizeValues: [],
      warnings: [],
    };
  }

  try {
    const response = await fetchImpl(config.url, {
      headers: {
        accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        sourceKind,
        access: "missing",
        status: "blocked",
        reason: `blocked: ${sourceKind.replaceAll("_", " ")} export missing, inaccessible, or unrecognized`,
        sheetUrl: config.url,
        headers: [],
        sampleRows: [],
        mappedRows: [],
        expectedExportPaths,
        detectedTabKind: "unknown",
        rowsCount: 0,
        detectedColumns: [],
        invalidRows: [],
        duplicateRanks: [],
        missingPrizeValues: [],
        warnings: [],
      };
    }

    const text = await response.text();
    const remoteCsv = toRecords(text);
    return createAudit("remote_csv", remoteCsv.headers, remoteCsv.records, detectSheetTabKind(remoteCsv.headers));
  } catch {
    return {
      sourceKind,
      access: "missing",
      status: "blocked",
      reason: `blocked: ${sourceKind.replaceAll("_", " ")} export missing, inaccessible, or unrecognized`,
      sheetUrl: config.url,
        headers: [],
        sampleRows: [],
        mappedRows: [],
        expectedExportPaths,
        detectedTabKind: "unknown",
        rowsCount: 0,
        detectedColumns: [],
        invalidRows: [],
        duplicateRanks: [],
        missingPrizeValues: [],
        warnings: [],
      };
    }
}

export async function inspectSeasonStandingsSheet(
  options: StandingsSourceOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<StandingsSheetAudit> {
  return inspectSource("season_standings", options, fetchImpl);
}

export async function inspectRankToPointsSheet(
  options: StandingsSourceOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<StandingsSheetAudit> {
  return inspectSource("rank_to_points", options, fetchImpl);
}

export async function inspectPrizeMoneySheet(
  options: StandingsSourceOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<StandingsSheetAudit> {
  return inspectSource("prize_money", options, fetchImpl);
}

function normalizeTeamLabel(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );
    }
  }
  return rows[left.length][right.length];
}

export function mapSeasonStandingsRowsToTeams(
  rows: SeasonStandingsSheetRow[],
  teams: TeamMappingCandidate[],
): SeasonStandingsTeamMappingAudit {
  const teamByShortCode = new Map(teams.map((team) => [team.shortCode.trim().toLowerCase(), team] as const));
  const teamByName = new Map(teams.map((team) => [team.teamName.trim().toLowerCase(), team] as const));
  const teamByNormalizedName = new Map(teams.map((team) => [normalizeTeamLabel(team.teamName), team] as const));
  const duplicateSheetTeams = new Set<string>();
  const missingInDb = new Set<string>();
  const ambiguousMappings = new Set<string>();
  const mappingWarnings: string[] = [];
  const seenSheetKeys = new Set<string>();

  const mappedRows = rows.map((row) => {
    const warnings = [...row.warnings];
    const rawLabel = row.rawTeamLabel?.trim() ?? "";
    const codeLabel = row.teamCode?.trim() ?? "";
    const rowKey = `${codeLabel}::${rawLabel}`.trim();
    if (rowKey && seenSheetKeys.has(rowKey)) {
      duplicateSheetTeams.add(rowKey);
      warnings.push(`duplicate_sheet_team:${rowKey}`);
    }
    if (rowKey) {
      seenSheetKeys.add(rowKey);
    }

    const shortCodeMatch = codeLabel ? teamByShortCode.get(codeLabel.toLowerCase()) ?? null : null;
    const exactNameMatch = rawLabel ? teamByName.get(rawLabel.toLowerCase()) ?? null : null;
    const normalizedNameMatch = rawLabel ? teamByNormalizedName.get(normalizeTeamLabel(rawLabel)) ?? null : null;
    const resolved = shortCodeMatch ?? exactNameMatch ?? normalizedNameMatch;

    if (!resolved && rawLabel) {
      const normalized = normalizeTeamLabel(rawLabel);
      const fuzzyCandidates = teams
        .map((team) => ({
          team,
          distance: levenshteinDistance(normalized, normalizeTeamLabel(team.teamName)),
        }))
        .filter((entry) => entry.distance <= 3)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 3);

      if (fuzzyCandidates.length > 0) {
        ambiguousMappings.add(rawLabel);
        warnings.push(
          `ambiguous_mapping:${rawLabel}->${fuzzyCandidates.map((entry) => entry.team.shortCode).join("|")}`,
        );
        mappingWarnings.push(
          `Ambiguous season standings mapping for ${rawLabel}: ${fuzzyCandidates
            .map((entry) => `${entry.team.shortCode}/${entry.team.teamName}`)
            .join(", ")}`,
        );
      } else {
        missingInDb.add(rawLabel);
        warnings.push(`missing_in_db:${rawLabel}`);
      }
    }

    return {
      ...row,
      resolvedTeamId: resolved?.teamId ?? null,
      resolvedTeamName: resolved?.teamName ?? null,
      teamName: resolved?.teamName ?? row.teamName,
      warnings,
    };
  });

  const mappedTeamIds = new Set(mappedRows.map((row) => row.resolvedTeamId).filter((value): value is string => Boolean(value)));
  const missingInSheet = teams
    .filter((team) => !mappedTeamIds.has(team.teamId))
    .map((team) => `${team.shortCode}:${team.teamName}`);

  return {
    mappedTeamsCount: mappedTeamIds.size,
    missingInSheet,
    missingInDb: Array.from(missingInDb).sort((left, right) => left.localeCompare(right, "de")),
    duplicateSheetTeams: Array.from(duplicateSheetTeams).sort((left, right) => left.localeCompare(right, "de")),
    ambiguousMappings: Array.from(ambiguousMappings).sort((left, right) => left.localeCompare(right, "de")),
    mappingWarnings: Array.from(new Set(mappingWarnings)).sort((left, right) => left.localeCompare(right, "de")),
    rows: mappedRows,
  };
}

export function extractSeasonStandingsDisciplineValues(row: Pick<SeasonStandingsSheetRow, "raw">) {
  return Object.fromEntries(
    SEASON_STANDINGS_DISCIPLINE_COLUMNS.map((column) => [
      column.normalizedKey,
      toNumber(row.raw[column.sheetColumn]),
    ]),
  ) as Record<string, number | null>;
}
