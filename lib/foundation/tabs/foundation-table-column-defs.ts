import type { Discipline } from "@/lib/data/olyDataTypes";
import { getSaisonstandCompactContractColumns } from "@/lib/foundation/saisonstand-column-contract";
import type { FoundationTableColumn, FoundationTablePreset } from "@/lib/foundation/tabs/cockpit-types";

export {
  buildFoundationSeasonTableColumns,
  buildSeasonModeColumns,
  buildSeasonTablePinnedOffsets,
  scrollSeasonTableToColumn,
} from "@/lib/foundation/tabs/season-table-column-defs";

export function buildFoundationPlayersTableColumns(): FoundationTableColumn[] {
  return [
    { id: "image", label: "Bild", dataKey: "image", defaultWidth: 96, minWidth: 80 },
    { id: "name", label: "Name", dataKey: "name", defaultWidth: 220, minWidth: 170 },
    { id: "team", label: "Team", dataKey: "team", defaultWidth: 180, minWidth: 140 },
    { id: "class", label: "Klasse", dataKey: "class", defaultWidth: 140, minWidth: 110 },
    { id: "race", label: "Rasse", dataKey: "race", defaultWidth: 120, minWidth: 96 },
    { id: "pps", label: "PPs", dataKey: "pps", defaultWidth: 96, minWidth: 78 },
    { id: "ovr", label: "OVR", dataKey: "ovr", defaultWidth: 96, minWidth: 78 },
    { id: "mvs", label: "MVS", dataKey: "mvs", defaultWidth: 96, minWidth: 78 },
    { id: "mw", label: "MW", dataKey: "mw", defaultWidth: 120, minWidth: 100 },
    { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 120, minWidth: 100 },
    { id: "contract", label: "Vertrag", dataKey: "contract", defaultWidth: 96, minWidth: 80 },
    { id: "appearances", label: "Einsaetze", dataKey: "appearances", defaultWidth: 94, minWidth: 78 },
    { id: "bestDiscipline", label: "Beste Diszi", dataKey: "bestDiscipline", defaultWidth: 120, minWidth: 98 },
    {
      id: "careerLeague",
      label: "Alltime",
      dataKey: "careerLeague",
      defaultWidth: 108,
      minWidth: 88,
      tooltip: "Gesamte Liga-Einsätze und PPs über alle Saisons (Archiv + Live).",
    },
    { id: "traits", label: "Traits", dataKey: "traits", defaultWidth: 230, minWidth: 180 },
  ];
}

export function buildFoundationTransferHistoryTableColumns(): FoundationTableColumn[] {
  return [
    { id: "image", label: "Bild", dataKey: "image", defaultWidth: 104, minWidth: 84 },
    { id: "name", label: "Spieler", dataKey: "name", defaultWidth: 220, minWidth: 170 },
    { id: "season", label: "Saison", dataKey: "season", defaultWidth: 110, minWidth: 90 },
    { id: "type", label: "Typ", dataKey: "type", defaultWidth: 90, minWidth: 72 },
    { id: "from", label: "Von", dataKey: "from", defaultWidth: 180, minWidth: 140 },
    { id: "to", label: "Zu", dataKey: "to", defaultWidth: 180, minWidth: 140 },
    { id: "fee", label: "Abloese", dataKey: "fee", defaultWidth: 110, minWidth: 90 },
    { id: "guv", label: "GuV", dataKey: "guv", defaultWidth: 110, minWidth: 90 },
    { id: "marketValue", label: "Marktwert", dataKey: "marketValue", defaultWidth: 110, minWidth: 90 },
    { id: "pow", label: "Power", dataKey: "pow", defaultWidth: 90, minWidth: 72 },
    { id: "spe", label: "Speed", dataKey: "spe", defaultWidth: 90, minWidth: 72 },
    { id: "men", label: "Mental", dataKey: "men", defaultWidth: 90, minWidth: 72 },
    { id: "soc", label: "Social", dataKey: "soc", defaultWidth: 90, minWidth: 72 },
    { id: "salary", label: "Gehalt", dataKey: "salary", defaultWidth: 110, minWidth: 90 },
    { id: "className", label: "Klasse", dataKey: "className", defaultWidth: 120, minWidth: 96 },
    { id: "race", label: "Rasse", dataKey: "race", defaultWidth: 120, minWidth: 96 },
    { id: "happenedAt", label: "Zeitpunkt", dataKey: "happenedAt", defaultWidth: 180, minWidth: 150 },
    { id: "remainingContractLength", label: "Restlaufzeit", dataKey: "remainingContractLength", defaultWidth: 118, minWidth: 96 },
    { id: "source", label: "Quelle", dataKey: "source", defaultWidth: 132, minWidth: 110, visibleByDefault: false },
  ];
}

export function buildFoundationDisciplineConfigTableColumns(): FoundationTableColumn[] {
  return [
    { id: "originalOrder", label: "Original-Reihenfolge", dataKey: "originalOrder", defaultWidth: 170, minWidth: 130 },
    { id: "displayOrder", label: "Reihenfolge", dataKey: "displayOrder", defaultWidth: 120, minWidth: 96 },
    { id: "name", label: "Disziplin", dataKey: "name", defaultWidth: 220, minWidth: 160 },
    { id: "playerCount", label: "Spieleranzahl", dataKey: "playerCount", defaultWidth: 128, minWidth: 104 },
    { id: "mutator1", label: "Mutator 1", dataKey: "mutator1", defaultWidth: 160, minWidth: 120 },
    { id: "mutator2", label: "Mutator 2", dataKey: "mutator2", defaultWidth: 160, minWidth: 120 },
  ];
}

export function buildFoundationDisciplineRanksColumns(
  orderedDisciplines: Discipline[],
): FoundationTableColumn[] {
  return [
    { id: "team", label: "Team", dataKey: "team", defaultWidth: 178, minWidth: 150, maxWidth: 210 },
    { id: "totalRank", label: "TOT", dataKey: "totalRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
    { id: "powRank", label: "POW", dataKey: "powRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
    { id: "speRank", label: "SPE", dataKey: "speRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
    { id: "menRank", label: "MEN", dataKey: "menRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
    { id: "socRank", label: "SOC", dataKey: "socRank", defaultWidth: 64, minWidth: 58, maxWidth: 76 },
    ...orderedDisciplines.map((discipline) => ({
      id: discipline.id,
      label: discipline.name.replace(/\s+/g, "").slice(0, 3).toUpperCase(),
      dataKey: discipline.id,
      defaultWidth: 44,
      minWidth: 40,
      maxWidth: 52,
    })),
  ];
}

export function buildFoundationSeasonCompactPresets(
  seasonTableColumns: FoundationTableColumn[],
): FoundationTablePreset[] {
  const compactOrder = [
    ...getSaisonstandCompactContractColumns().map((column) => column.normalizedKey),
    "actions",
  ];
  const compactColumns = compactOrder
    .map((columnId) => seasonTableColumns.find((column) => column.id === columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const defaultOrder = compactColumns.map((column) => column.id);
  return [
    {
      id: "retool_default",
      label: "Retool Default",
      description: "Harte Reihenfolge der kompakten Saisonansicht.",
      order: defaultOrder,
      visibleColumnIds: compactColumns.filter((column) => column.visibleByDefault ?? true).map((column) => column.id),
      pinnedLeft: ["platz", "mannschaft", "punkte"],
    },
    {
      id: "compact",
      label: "Compact",
      description: "Kernwerte fuer schnellen Spieltagsblick.",
      order: defaultOrder,
      visibleColumnIds: ["platz", "mannschaft", "punkte", "tdm", "gewichtheben", "hockey", "schach", "takeshi", "vertragslange", "actions"],
      pinnedLeft: ["platz", "mannschaft", "punkte"],
    },
    {
      id: "finance",
      label: "Finance",
      description: "Finanznahe Saisonwerte ohne volle Expertensicht.",
      order: defaultOrder,
      visibleColumnIds: ["platz", "mannschaft", "punkte", "vertragslange", "actions"],
      pinnedLeft: ["platz", "mannschaft", "punkte"],
    },
    {
      id: "performance",
      label: "Performance",
      description: "Disziplinlastige Sicht auf Punkte und Kernleistungen.",
      order: defaultOrder,
      visibleColumnIds: defaultOrder.filter((columnId) => columnId !== "actions").concat("actions"),
      pinnedLeft: ["platz", "mannschaft", "punkte"],
    },
  ];
}
