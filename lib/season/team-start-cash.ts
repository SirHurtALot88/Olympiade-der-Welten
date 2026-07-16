import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE_ROOT = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

export const TEAM_START_CASH_CSV_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "team-start-cash.csv",
);
export const TEAM_START_CASH_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  "references",
  "sheets",
  "team-start-cash.json",
);

export type TeamStartCashRow = {
  teamCode: string;
  teamName: string | null;
  startCash: number | null;
  season: string | null;
  sourceRow: number;
  warnings: string[];
};

export type TeamStartCashReference = {
  status: "ok" | "blocked";
  reason: string | null;
  access: "local_csv" | "local_json" | "missing";
  rows: TeamStartCashRow[];
  warnings: string[];
  errors: string[];
  sourcePath: string | null;
};

export type TeamStartCashReferenceOptions = {
  csvPath?: string;
  jsonPath?: string;
};

export type TeamStartCashTargetState = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  currentCash: number;
};

export type TeamStartCashPlanItem = {
  teamStateId: string | null;
  teamId: string | null;
  teamCode: string;
  teamName: string | null;
  currentCash: number | null;
  startCash: number | null;
  delta: number | null;
  status:
    | "matched"
    | "missing_in_reference"
    | "missing_in_db"
    | "duplicate_reference"
    | "invalid_start_cash";
  warnings: string[];
};

export type TeamStartCashSyncPlan = {
  dryRun: boolean;
  canWrite: boolean;
  blockingReasons: string[];
  warnings: string[];
  summary: {
    referenceRows: number;
    uniqueReferenceTeams: number;
    dbTeams: number;
    matchedTeams: number;
    missingInReference: number;
    missingInDb: number;
    duplicateReferenceTeams: number;
    invalidStartCashRows: number;
    differingCashRows: number;
    transfersTotal: number;
    activeSeasonMutated: boolean;
  };
  items: TeamStartCashPlanItem[];
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ")
    .trim();
}

function normalizeTeamCode(value: string) {
  return value.trim().toUpperCase();
}

function parseNumber(value: string | undefined) {
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

function rowsToRecords(rows: string[][]) {
  const headers = (rows[0] ?? []).map((header) => header.trim());
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
  return { headers, records };
}

function readValue(record: Record<string, string>, aliases: string[]) {
  for (const [key, value] of Object.entries(record)) {
    if (aliases.includes(normalizeHeader(key)) && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function mapRecordsToRows(records: Array<Record<string, string>>): TeamStartCashRow[] {
  return records
    .map((record, index) => {
      const teamCode = normalizeTeamCode(
        readValue(record, ["teamcode", "team code", "code", "kürzel", "kuerzel"]),
      );
      const teamName = readValue(record, ["teamname", "team name", "name"]) || null;
      const startCash = parseNumber(
        readValue(record, ["startcash", "start cash", "cash", "startkapital", "start kapital"]),
      );
      const season = readValue(record, ["season", "saison"]) || null;

      if (!teamCode && !teamName) {
        return null;
      }

      const warnings: string[] = [];
      if (!teamCode) warnings.push("team_code_missing");
      if (startCash == null) warnings.push("start_cash_missing_or_invalid");

      return {
        teamCode,
        teamName,
        startCash,
        season,
        sourceRow: index + 2,
        warnings,
      } satisfies TeamStartCashRow;
    })
    .filter((row): row is TeamStartCashRow => row !== null);
}

async function readLocalCsv(csvPath = TEAM_START_CASH_CSV_PATH) {
  try {
    const text = await fs.readFile(csvPath, "utf8");
    const parsed = rowsToRecords(parseCsv(text));
    return {
      access: "local_csv" as const,
      sourcePath: csvPath,
      rows: mapRecordsToRows(parsed.records),
    };
  } catch {
    return null;
  }
}

async function readLocalJson(jsonPath = TEAM_START_CASH_JSON_PATH) {
  try {
    const text = await fs.readFile(jsonPath, "utf8");
    const parsed = JSON.parse(text) as Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
    const records = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]),
      ),
    );
    return {
      access: "local_json" as const,
      sourcePath: jsonPath,
      rows: mapRecordsToRows(records),
    };
  } catch {
    return null;
  }
}

export async function loadTeamStartCashReference(
  options: TeamStartCashReferenceOptions = {},
): Promise<TeamStartCashReference> {
  const csv = await readLocalCsv(options.csvPath ?? TEAM_START_CASH_CSV_PATH);
  if (csv) {
    const errors = csv.rows.length === 0 ? ["team_start_cash_reference_empty"] : [];
    return {
      status: errors.length === 0 ? "ok" : "blocked",
      reason: errors.length === 0 ? null : "team start cash data missing or empty",
      access: csv.access,
      rows: csv.rows,
      warnings: csv.rows.flatMap((row) => row.warnings),
      errors,
      sourcePath: csv.sourcePath,
    };
  }

  const json = await readLocalJson(options.jsonPath ?? TEAM_START_CASH_JSON_PATH);
  if (json) {
    const errors = json.rows.length === 0 ? ["team_start_cash_reference_empty"] : [];
    return {
      status: errors.length === 0 ? "ok" : "blocked",
      reason: errors.length === 0 ? null : "team start cash data missing or empty",
      access: json.access,
      rows: json.rows,
      warnings: json.rows.flatMap((row) => row.warnings),
      errors,
      sourcePath: json.sourcePath,
    };
  }

  return {
    status: "blocked",
    reason: "team start cash data missing; need local reference file",
    access: "missing",
    rows: [],
    warnings: [],
    errors: ["team_start_cash_data_missing"],
    sourcePath: null,
  };
}

export function buildTeamStartCashSyncPlan(input: {
  referenceRows: TeamStartCashRow[];
  teamStates: TeamStartCashTargetState[];
  transfersTotal: number;
  dryRun?: boolean;
}) {
  const { referenceRows, teamStates, transfersTotal, dryRun = true } = input;
  const blockingReasons: string[] = [];
  const warnings = new Set<string>();

  const teamStateByCode = new Map(teamStates.map((state) => [normalizeTeamCode(state.teamCode), state] as const));
  const referenceByCode = new Map<string, TeamStartCashRow>();
  const duplicateCodes = new Set<string>();
  const items: TeamStartCashPlanItem[] = [];

  for (const row of referenceRows) {
    const key = normalizeTeamCode(row.teamCode);
    if (!key) {
      items.push({
        teamStateId: null,
        teamId: null,
        teamCode: row.teamCode,
        teamName: row.teamName,
        currentCash: null,
        startCash: row.startCash,
        delta: null,
        status: "missing_in_db",
        warnings: [...row.warnings, "team_code_missing"],
      });
      continue;
    }

    if (referenceByCode.has(key)) {
      duplicateCodes.add(key);
      items.push({
        teamStateId: null,
        teamId: null,
        teamCode: key,
        teamName: row.teamName,
        currentCash: null,
        startCash: row.startCash,
        delta: null,
        status: "duplicate_reference",
        warnings: [...row.warnings, `duplicate_team_code:${key}`],
      });
      continue;
    }

    referenceByCode.set(key, row);
    const teamState = teamStateByCode.get(key) ?? null;
    const delta =
      teamState && row.startCash != null ? row.startCash - teamState.currentCash : null;

    const status: TeamStartCashPlanItem["status"] =
      row.startCash == null
        ? "invalid_start_cash"
        : !teamState
          ? "missing_in_db"
          : "matched";

    if (teamState && delta !== 0) {
      warnings.add(`current cash differs from start cash:${key}`);
    }

    items.push({
      teamStateId: teamState?.id ?? null,
      teamId: teamState?.teamId ?? null,
      teamCode: key,
      teamName: teamState?.teamName ?? row.teamName,
      currentCash: teamState?.currentCash ?? null,
      startCash: row.startCash,
      delta,
      status,
      warnings: row.warnings,
    });
  }

  for (const teamState of teamStates) {
    const key = normalizeTeamCode(teamState.teamCode);
    if (referenceByCode.has(key)) {
      continue;
    }
    items.push({
      teamStateId: teamState.id,
      teamId: teamState.teamId,
      teamCode: key,
      teamName: teamState.teamName,
      currentCash: teamState.currentCash,
      startCash: null,
      delta: null,
      status: "missing_in_reference",
      warnings: [`missing_reference:${key}`],
    });
  }

  const missingInReference = items.filter((item) => item.status === "missing_in_reference").length;
  const missingInDb = items.filter((item) => item.status === "missing_in_db").length;
  const invalidStartCashRows = items.filter((item) => item.status === "invalid_start_cash").length;
  const duplicateReferenceTeams = items.filter((item) => item.status === "duplicate_reference").length;
  const matchedTeams = items.filter((item) => item.status === "matched").length;
  const differingCashRows = items.filter((item) => item.status === "matched" && item.delta !== 0).length;
  const activeSeasonMutated = transfersTotal > 0;

  if (referenceRows.length === 0) blockingReasons.push("team_start_cash_reference_missing");
  if (referenceByCode.size !== 32) blockingReasons.push(`expected_32_reference_rows_got:${referenceByCode.size}`);
  if (teamStates.length !== 32) blockingReasons.push(`expected_32_team_states_got:${teamStates.length}`);
  if (duplicateCodes.size > 0) blockingReasons.push("duplicate_reference_team_codes");
  if (missingInReference > 0) blockingReasons.push("missing_teams_in_reference");
  if (missingInDb > 0) blockingReasons.push("missing_teams_in_db");
  if (invalidStartCashRows > 0) blockingReasons.push("invalid_start_cash_rows");
  if (differingCashRows > 0) blockingReasons.push("current_cash_differs_from_start_cash");
  if (activeSeasonMutated) blockingReasons.push("active_season_already_mutated");
  if (transfersTotal > 0) blockingReasons.push("transfers_already_exist");

  return {
    dryRun,
    canWrite: blockingReasons.length === 0,
    blockingReasons,
    warnings: Array.from(warnings),
    summary: {
      referenceRows: referenceRows.length,
      uniqueReferenceTeams: referenceByCode.size,
      dbTeams: teamStates.length,
      matchedTeams,
      missingInReference,
      missingInDb,
      duplicateReferenceTeams,
      invalidStartCashRows,
      differingCashRows,
      transfersTotal,
      activeSeasonMutated,
    },
    items: items.sort((left, right) => left.teamCode.localeCompare(right.teamCode, "de")),
  } satisfies TeamStartCashSyncPlan;
}
