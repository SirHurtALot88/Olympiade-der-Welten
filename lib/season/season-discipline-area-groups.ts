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

/**
 * Fixed roster size per discipline — how many players contest each discipline.
 *
 * Canonical source: `foundationSeedDisciplines[].playerCount` in lib/data/dataAdapter.ts
 * (and the `Discipline.playerCount` column in prisma/schema.prisma). Mirrored here as a
 * constant so the standings columns can be ordered by discipline size without threading
 * the live gameState through this constants-only module. Keep in sync with the seed data.
 */
export const SEASON_DISCIPLINE_PLAYER_COUNT: Record<SeasonDisciplineKey, number> = {
  tdm: 3,
  mini_dm: 2,
  gewichtheben: 6,
  hockey: 5,
  breaking: 4,
  staffel: 3,
  time_trial: 4,
  spurt: 2,
  climbing: 6,
  fechten: 5,
  schach: 2,
  takeshi: 4,
  tennis: 3,
  i_spy: 6,
  wettessen: 5,
  basketball: 6,
  football: 4,
  battlefield: 2,
  eiskunst: 3,
  showcase: 5,
};

/** Axis-group membership (which disciplines belong to POW/SPE/MEN/SOC). */
const SEASON_DISCIPLINE_AREA_GROUP_MEMBERSHIP: Array<{
  id: SeasonDisciplineAreaId;
  label: string;
  keys: SeasonDisciplineKey[];
}> = [
  { id: "pow", label: "POW", keys: ["tdm", "mini_dm", "gewichtheben", "hockey", "breaking"] },
  { id: "spe", label: "SPE", keys: ["staffel", "time_trial", "spurt", "climbing", "fechten"] },
  { id: "men", label: "MEN", keys: ["schach", "takeshi", "tennis", "i_spy", "wettessen"] },
  { id: "soc", label: "SOC", keys: ["basketball", "football", "battlefield", "eiskunst", "showcase"] },
];

/**
 * Axis groups with each group's discipline columns ordered by roster size (most players
 * first). This drives the standings grid column order, so e.g. the POW group reads
 * GEW(6) · HOC(5) · BRE(4) · TDM(3) · MIN(2). Ties keep their membership order (JS sort
 * is stable); the summing/record helpers below are order-independent.
 */
export const SEASON_DISCIPLINE_AREA_GROUPS: Array<{
  id: SeasonDisciplineAreaId;
  label: string;
  keys: SeasonDisciplineKey[];
}> = SEASON_DISCIPLINE_AREA_GROUP_MEMBERSHIP.map((group) => ({
  ...group,
  keys: [...group.keys].sort(
    (left, right) => SEASON_DISCIPLINE_PLAYER_COUNT[right] - SEASON_DISCIPLINE_PLAYER_COUNT[left],
  ),
}));

/**
 * Dieselben Gruppen in der KANONISCHEN Disziplin-Reihenfolge (POW liest damit
 * TDM · Mini DM · Gewichtheben · Hockey · Breaking).
 *
 * `SEASON_DISCIPLINE_AREA_GROUPS` sortiert bewusst nach Kadergrösse — das war
 * eine Anforderung an die RANG-Tabelle, wo die Spaltenbreite mit der Spielerzahl
 * korrespondiert. Über den gemeinsamen Export ist diese Sortierung aber auch im
 * Saisonstand gelandet, wo sie niemand bestellt hat: dort erwartet man die
 * Reihenfolge, in der die Disziplinen überall sonst stehen. Deshalb hier ein
 * eigener Export statt einer Umsortierung an der Anzeigestelle — die Reihenfolge
 * bleibt so an EINER Stelle definiert.
 */
export const SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER: Array<{
  id: SeasonDisciplineAreaId;
  label: string;
  keys: SeasonDisciplineKey[];
}> = SEASON_DISCIPLINE_AREA_GROUP_MEMBERSHIP.map((group) => ({ ...group, keys: [...group.keys] }));

/**
 * `SeasonDisciplineKey` (z. B. "showcase", "eiskunst") auf die tatsaechliche `discipline.id`
 * im Katalog (`lib/data/dataAdapter.ts`) — an ein paar Stellen weichen die IDs vom Kuerzel-Key
 * ab (Bindestrich/Unterstrich, oder ein ganz anderes Wort: "eiskunstlauf" statt "eiskunst",
 * "speed-schach" statt "schach", "takeshis-castle" statt "takeshi").
 */
const SEASON_DISCIPLINE_KEY_TO_CATALOG_ID: Record<SeasonDisciplineKey, string> = {
  tdm: "tdm",
  mini_dm: "mini-dm",
  gewichtheben: "gewichtheben",
  hockey: "hockey",
  breaking: "breaking",
  staffel: "staffel",
  time_trial: "time-trial",
  spurt: "spurt",
  climbing: "climbing",
  fechten: "fechten",
  schach: "speed-schach",
  takeshi: "takeshis-castle",
  tennis: "tennis",
  i_spy: "i-spy",
  wettessen: "wettessen",
  basketball: "basketball",
  football: "football",
  battlefield: "battlefield",
  eiskunst: "eiskunstlauf",
  showcase: "showcase",
};

/**
 * Wie `SEASON_DISCIPLINE_AREA_GROUPS`, aber sortiert nach der TATSAECHLICH fuer DIESE Saison
 * ausgelosten Spielerzahl je Disziplin statt der statischen Katalog-Zahl.
 *
 * GEMELDET VON CHRIS (mit Bild): „Showcase hat 6 Spieler in der Season und trotzdem ist SHO
 * nur 2." Ursache: der Saison-Spielplan wuerfelt die Spielerzahl pro Disziplin JEDE Saison neu
 * aus (`buildSeasonPlayerCountByDiscipline` in `season-discipline-schedule.ts`) — dieselbe Zahl,
 * die auch die Punkteverteilung steuert (`resolveDisciplinePlayerCount` in
 * `lib/resolve/rank-to-points.ts`), also die fuer die Saison GUELTIGE Groesse. Die alte,
 * statische `SEASON_DISCIPLINE_AREA_GROUPS`-Sortierung nutzt dagegen `SEASON_DISCIPLINE_PLAYER_COUNT`,
 * die Katalog-Zahl aus dem Startzustand — die stimmt nur zufaellig noch mit der ausgelosten
 * Saison ueberein. Nachgemessen am gemeldeten Spielstand: die SOC-Gruppe stand als
 * BAS · SHO · FOO · EIS · BAT (Katalog: 6 · 5 · 4 · 3 · 2), waehrend die echten Saison-Werte
 * BAS=6 · SHO=3 · FOO=2 · EIS=4 · BAT=5 waren — keine absteigende Reihe mehr, SHO landete auf
 * Position 2, obwohl es (je nach Saison-Auslosung) durchaus mehr Spieler haben kann als BAT
 * oder EIS, die dahinter stehen.
 *
 * `playerCountByDisciplineId` kommt aus `buildSeasonDisciplinePlayerCountMap(gameState)`
 * (`lib/season/season-discipline-schedule.ts`). Fehlt ein Wert (Alt-Save ohne Spielplan),
 * faellt NUR diese eine Disziplin auf die Katalog-Zahl zurueck, statt die ganze Sortierung zu
 * verwerfen.
 */
export function buildSeasonAwareDisciplineAreaGroups(
  playerCountByDisciplineId: Map<string, number | null | undefined> | Record<string, number | null | undefined>,
): Array<{ id: SeasonDisciplineAreaId; label: string; keys: SeasonDisciplineKey[] }> {
  const readCount = (key: SeasonDisciplineKey): number => {
    const catalogId = SEASON_DISCIPLINE_KEY_TO_CATALOG_ID[key];
    const value =
      playerCountByDisciplineId instanceof Map
        ? playerCountByDisciplineId.get(catalogId)
        : playerCountByDisciplineId[catalogId];
    return value != null && Number.isFinite(value) ? value : SEASON_DISCIPLINE_PLAYER_COUNT[key];
  };

  return SEASON_DISCIPLINE_AREA_GROUP_MEMBERSHIP.map((group) => ({
    ...group,
    keys: [...group.keys].sort((left, right) => readCount(right) - readCount(left)),
  }));
}

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

function getSnapshotTeamPerformanceRows(snapshot: {
  playerPerformances?: Array<{
    playerId?: string;
    teamId?: string | null;
    disciplineBreakdown?: Array<{ disciplineId: string; totalContribution?: number | null }>;
  }>;
  playerPerformanceSnapshots?: Array<{
    playerId?: string;
    teamId?: string | null;
    disciplineBreakdown?: Array<{ disciplineId: string; totalContribution?: number | null }>;
  }>;
}) {
  const rows = [...(snapshot.playerPerformances ?? [])];
  const seenPlayerIds = new Set(rows.map((row) => row.playerId).filter((playerId): playerId is string => Boolean(playerId)));

  for (const row of snapshot.playerPerformanceSnapshots ?? []) {
    if (row.playerId && seenPlayerIds.has(row.playerId)) {
      continue;
    }
    rows.push(row);
  }

  return rows;
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

  for (const player of getSnapshotTeamPerformanceRows(snapshot)) {
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
