import type { Discipline } from "@/lib/data/olyDataTypes";
import type { FoundationTableColumn } from "@/lib/foundation/tabs/cockpit-types";
import { saisonstandDisciplineColumns } from "@/lib/foundation/saisonstand-column-contract";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";

export const TEAMS_VIEW_COLUMNS: FoundationTableColumn[] = [
  { id: "team", label: "Team", dataKey: "team", defaultWidth: 240, minWidth: 180 },
  { id: "overallRank", label: "Rank", dataKey: "overallRank", defaultWidth: 74, minWidth: 62 },
  { id: "cash", label: "Cash", dataKey: "cash", defaultWidth: 120, minWidth: 100 },
  { id: "guv", label: "GuV", dataKey: "guv", defaultWidth: 106, minWidth: 88 },
  { id: "roster", label: "#", dataKey: "roster", defaultWidth: 78, minWidth: 62 },
  { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 100, minWidth: 84 },
  { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 100, minWidth: 84 },
  { id: "sponsor", label: "Sponsor", dataKey: "sponsor", defaultWidth: 108, minWidth: 88 },
  { id: "pow", label: "POW", dataKey: "pow", defaultWidth: 86, minWidth: 72 },
  { id: "spe", label: "SPE", dataKey: "spe", defaultWidth: 86, minWidth: 72 },
  { id: "men", label: "MEN", dataKey: "men", defaultWidth: 86, minWidth: 72 },
  { id: "soc", label: "SOC", dataKey: "soc", defaultWidth: 86, minWidth: 72 },
  { id: "histPoints", label: "Hist. Punkte", dataKey: "histPoints", defaultWidth: 126, minWidth: 104 },
  { id: "avgPoints", label: "Ø Punkte", dataKey: "avgPoints", defaultWidth: 108, minWidth: 90 },
  { id: "gold", label: "🥇", dataKey: "gold", defaultWidth: 66, minWidth: 56 },
  { id: "silver", label: "🥈", dataKey: "silver", defaultWidth: 66, minWidth: 56 },
  { id: "bronze", label: "🥉", dataKey: "bronze", defaultWidth: 66, minWidth: 56 },
  { id: "top5", label: "Top 5", dataKey: "top5", defaultWidth: 86, minWidth: 72 },
  { id: "top10", label: "Top 10", dataKey: "top10", defaultWidth: 96, minWidth: 78 },
  { id: "avgRank", label: "Avg Rank", dataKey: "avgRank", defaultWidth: 110, minWidth: 90 },
  { id: "seasonPoints", label: "Seasons", dataKey: "seasonPoints", defaultWidth: 150, minWidth: 120 },
];

export function getTeamAxisRankTooltip(axisLabel: "POW" | "SPE" | "MEN" | "SOC") {
  return `${axisLabel} Rang: Die Engine nimmt pro Disziplin die Top 6 scorefaehigen Spieler eines Teams, summiert diese Teamstaerke je Bereich und rankt alle Teams ligaweit.`;
}

export function getTeamsViewColumnTitle(columnId: string) {
  if (columnId === "pow") return getTeamAxisRankTooltip("POW");
  if (columnId === "spe") return getTeamAxisRankTooltip("SPE");
  if (columnId === "men") return getTeamAxisRankTooltip("MEN");
  if (columnId === "soc") return getTeamAxisRankTooltip("SOC");
  if (columnId === "gold") return "Goldmedaillen aus archivierten Seasons.";
  if (columnId === "silver") return "Silbermedaillen aus archivierten Seasons.";
  if (columnId === "bronze") return "Bronzemedaillen aus archivierten Seasons.";
  if (columnId === "seasonPoints") return "Aufklappen zeigt die Punkte des Teams pro archivierter Season.";
  return undefined;
}

export function buildOrderedFoundationDisciplines(disciplines: Discipline[]) {
  const saisonstandOrderIndex = new Map<string, number>(
    saisonstandDisciplineColumns.map((disciplineKey, index) => [disciplineKey, index] as const),
  );

  return [...disciplines].sort((left, right) => {
    const leftKey = normalizeLineupDisciplineFieldName(left.id);
    const rightKey = normalizeLineupDisciplineFieldName(right.id);
    const leftIndex = saisonstandOrderIndex.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = saisonstandOrderIndex.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    const leftOrder = left.displayOrder ?? left.originalOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? right.originalOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, "de");
  });
}
