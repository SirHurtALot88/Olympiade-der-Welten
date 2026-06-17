export const SEASON_MANAGEMENT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=716960672";

export type SeasonManagementSheetRow = {
  teamName: string;
  startBudget: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  warnings: string[];
};

export type SeasonManagementMappingRow = SeasonManagementSheetRow & {
  teamId: string | null;
  resolvedTeamName: string | null;
};

import seasonManagementReferenceRows from "@/references/sheets/season-management.json";

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

function parseCsv(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
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

function normalizeTeamName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadSeasonManagementReferenceRows(): SeasonManagementSheetRow[] {
  return structuredClone(seasonManagementReferenceRows as SeasonManagementSheetRow[]);
}

export async function inspectSeasonManagementSheetWithFallback(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const sheet = await inspectSeasonManagementSheet((input, init) =>
      fetchImpl(input, {
        ...init,
        signal: controller.signal,
      }),
    );
    return {
      ...sheet,
      sourceKind: "season_management_sheet" as const,
      fallbackReason: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "season_management_sheet_unavailable";
    return {
      headers: [],
      rows: loadSeasonManagementReferenceRows(),
      sourceKind: "season_management_reference_fallback" as const,
      fallbackReason: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function inspectSeasonManagementSheet(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(SEASON_MANAGEMENT_SHEET_URL, {
    headers: {
      accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Season management sheet could not be loaded (${response.status}).`);
  }

  const rows = parseCsv(await response.text());
  const [headerRow, ...valueRows] = rows;
  const headerIndex = new Map(headerRow.map((header, index) => [header.trim(), index] as const));

  const mappedRows = valueRows
    .map((row): SeasonManagementSheetRow | null => {
      const teamName = row[headerIndex.get("Name") ?? -1]?.trim() ?? "";
      if (!teamName) {
        return null;
      }

      return {
        teamName,
        startBudget: parseNumber(row[headerIndex.get("Startbudget") ?? -1]),
        playerMin: parseNumber(row[headerIndex.get("Player Min") ?? -1]),
        playerOpt: parseNumber(row[headerIndex.get("Player Opt") ?? -1]),
        warnings: [],
      } satisfies SeasonManagementSheetRow;
    })
    .filter((row): row is SeasonManagementSheetRow => row !== null);

  return {
    headers: headerRow.map((value) => value.trim()),
    rows: mappedRows,
  };
}

export function mapSeasonManagementRowsToTeams(
  rows: SeasonManagementSheetRow[],
  teams: Array<{ teamId: string; teamName: string }>,
) {
  const byNormalizedName = new Map(
    teams.map((team) => [normalizeTeamName(team.teamName), team] as const),
  );

  const mappedRows: SeasonManagementMappingRow[] = rows.map((row) => {
    const match = byNormalizedName.get(normalizeTeamName(row.teamName)) ?? null;
    return {
      ...row,
      teamId: match?.teamId ?? null,
      resolvedTeamName: match?.teamName ?? null,
      warnings: match ? row.warnings : [...row.warnings, `missing_team_mapping:${row.teamName}`],
    };
  });

  return {
    mappedRows,
    missingMappings: mappedRows.filter((row) => !row.teamId).map((row) => row.teamName),
  };
}
