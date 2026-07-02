import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";

export type SeasonDisciplineAreaId = "pow" | "spe" | "men" | "soc";

export type SeasonDisciplineKey =
  | "tdm"
  | "mini_dm"
  | "gewichtheben"
  | "hockey"
  | "breaking"
  | "staffel"
  | "time_trial"
  | "spurt"
  | "climbing"
  | "fechten"
  | "schach"
  | "takeshi"
  | "tennis"
  | "i_spy"
  | "wettessen"
  | "basketball"
  | "football"
  | "battlefield"
  | "eiskunst"
  | "showcase";

export const SEASON_DISCIPLINE_LABELS: Record<SeasonDisciplineKey, string> = {
  tdm: "TDM",
  mini_dm: "MIN",
  gewichtheben: "GEW",
  hockey: "HOC",
  breaking: "BRE",
  staffel: "STA",
  time_trial: "TIT",
  spurt: "SPU",
  climbing: "CLI",
  fechten: "FEC",
  schach: "SCH",
  takeshi: "TAK",
  tennis: "TEN",
  i_spy: "ISP",
  wettessen: "WET",
  basketball: "BAS",
  football: "FOO",
  battlefield: "BAT",
  eiskunst: "EIS",
  showcase: "SHO",
};

export const SEASON_DISCIPLINE_AREA_GROUPS: Array<{
  id: SeasonDisciplineAreaId;
  label: string;
  keys: SeasonDisciplineKey[];
}> = [
  { id: "pow", label: "POW", keys: ["tdm", "mini_dm", "gewichtheben", "hockey", "breaking"] },
  { id: "spe", label: "SPE", keys: ["staffel", "time_trial", "spurt", "climbing", "fechten"] },
  { id: "men", label: "MEN", keys: ["schach", "takeshi", "tennis", "i_spy", "wettessen"] },
  { id: "soc", label: "SOC", keys: ["basketball", "football", "battlefield", "eiskunst", "showcase"] },
];

const SEASON_DISCIPLINE_KEY_SET = new Set<string>(Object.keys(SEASON_DISCIPLINE_LABELS));

export type PlayerHistoryDisciplineValues = Partial<Record<SeasonDisciplineKey, number | null>>;

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function isSeasonDisciplineKey(value: string): value is SeasonDisciplineKey {
  return SEASON_DISCIPLINE_KEY_SET.has(value);
}

export function buildPlayerHistoryDisciplineValues(
  breakdown: Array<{ disciplineId: string; totalContribution?: number | null }> | undefined,
): PlayerHistoryDisciplineValues {
  const result: PlayerHistoryDisciplineValues = {};

  for (const entry of breakdown ?? []) {
    const normalizedKey = normalizeLineupDisciplineFieldName(entry.disciplineId);
    if (!isSeasonDisciplineKey(normalizedKey)) {
      continue;
    }
    result[normalizedKey] =
      entry.totalContribution != null && Number.isFinite(entry.totalContribution)
        ? roundValue(entry.totalContribution, 1)
        : null;
  }

  return result;
}

export function sumSeasonDisciplineAreaTotal(
  disciplineValues: Record<string, number | null | undefined> | undefined,
  areaId: SeasonDisciplineAreaId,
) {
  const group = SEASON_DISCIPLINE_AREA_GROUPS.find((entry) => entry.id === areaId);
  if (!group) {
    return 0;
  }

  let total = 0;
  for (const key of group.keys) {
    const value = disciplineValues?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
    }
  }

  return roundValue(total, 1);
}

export function resolveSeasonDisciplineAreaTotal(
  disciplineValues: Record<string, number | null | undefined> | undefined,
  areaId: SeasonDisciplineAreaId,
  ledgerAreaTotal?: number | null,
) {
  const disciplineTotal = sumSeasonDisciplineAreaTotal(disciplineValues, areaId);
  if (disciplineTotal > 0) {
    return disciplineTotal;
  }
  if (ledgerAreaTotal != null && Number.isFinite(ledgerAreaTotal) && ledgerAreaTotal > 0) {
    return roundValue(ledgerAreaTotal, 1);
  }
  if (disciplineTotal === 0 && ledgerAreaTotal === 0) {
    return 0;
  }
  return ledgerAreaTotal != null && Number.isFinite(ledgerAreaTotal) ? roundValue(ledgerAreaTotal, 1) : null;
}

export function buildTeamHistoryDisciplineValuesFromRecord(
  disciplineValues: Record<string, number | null | undefined> | undefined,
): PlayerHistoryDisciplineValues {
  const result: PlayerHistoryDisciplineValues = {};

  for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
    for (const key of group.keys) {
      const value = disciplineValues?.[key];
      result[key] =
        value != null && Number.isFinite(value) ? roundValue(value, 1) : null;
    }
  }

  return result;
}

export function buildTeamHistoryDisciplineValuesFromSnapshot(
  snapshot: {
    playerPerformances?: Array<{
      teamId?: string | null;
      disciplineBreakdown?: Array<{ disciplineId: string; totalContribution?: number | null }>;
    }>;
  },
  teamId: string,
): PlayerHistoryDisciplineValues {
  const totals: PlayerHistoryDisciplineValues = {};

  for (const player of snapshot.playerPerformances ?? []) {
    if (player.teamId !== teamId) {
      continue;
    }

    for (const entry of player.disciplineBreakdown ?? []) {
      const normalizedKey = normalizeLineupDisciplineFieldName(entry.disciplineId);
      if (!isSeasonDisciplineKey(normalizedKey)) {
        continue;
      }

      const value = entry.totalContribution ?? 0;
      if (!Number.isFinite(value)) {
        continue;
      }

      totals[normalizedKey] = roundValue((totals[normalizedKey] ?? 0) + value, 1);
    }
  }

  return totals;
}
