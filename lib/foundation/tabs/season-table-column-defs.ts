import type { FoundationTableColumn } from "@/lib/foundation/tabs/cockpit-types";
import {
  getSaisonstandExpertContractColumns,
  saisonstandColumnContract,
} from "@/lib/foundation/saisonstand-column-contract";
import { getGameTermShort } from "@/lib/ui/game-encyclopedia";

/** "mini_dm" → "Mini Dm", "schach" → "Schach" — disambiguiert die kurzen Spalten-Kuerzel. */
function humanizeColumnKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * DER BONUS IST EIN DAVON-POSTEN, KEIN ZUSATZ.
 *
 * Der Mutator-Aufschlag steckt bereits in jeder der 20 Disziplin-Spalten: der Ledger bucht
 * je Spieler-Zeile `points = Anteil + mutatorPpsBonus` und summiert genau dieses `points`
 * nach `pointsByDiscipline`. Am Live-Abbild vom 11.08. gilt in beiden aktiven Staenden fuer
 * alle 32 Teams `Σ Disziplin-Spalten − Punkte == Bonus` (Abweichung 0,0). Wer "Punkte +
 * Bonus" liest, liegt richtig; wer "Σ Disziplinen + Bonus" liest, zaehlt doppelt.
 *
 * Der Vertragstext beschreibt nur die HERKUNFT der Zahl ("Mutator-PPs aus gespeicherten
 * Player-Performance-Zeilen …") und sagt nichts darueber, dass sie nebenan schon enthalten
 * ist. Genau das ergaenzt dieser Satz — die Buchung bleibt unangetastet.
 */
const BONUS_DAVON_HINWEIS =
  "DAVON-Posten: bereits in den Disziplin-Spalten dieser Zeile enthalten, nicht noch einmal " +
  "addieren. Es gilt: Punkte + Bonus = Summe der Disziplin-Spalten.";

export function buildFoundationSeasonTableColumns(): FoundationTableColumn[] {
  const contractColumns = saisonstandColumnContract.columns.map((column) => ({
    id: column.normalizedKey,
    label: column.normalizedKey === "bonuspunkte" ? "dav. Bonus" : column.displayLabel,
    dataKey: column.normalizedKey,
    defaultWidth: Math.max(Math.round(column.columnSize ?? 96), 52),
    minWidth: column.normalizedKey === "mannschaft" ? 150 : 52,
    visibleByDefault: column.compactVisible,
    // Jede Spalte bekommt einen Hover-Tooltip: erst das Lexikon (GuV etc.),
    // sonst der ausgeschriebene Spaltenname statt nur des Kuerzels.
    tooltip:
      column.normalizedKey === "bonuspunkte"
        ? `${BONUS_DAVON_HINWEIS} ${column.sourceDescription} ${column.transformNote ?? ""}`.trim()
        : getGameTermShort(column.displayLabel) ?? humanizeColumnKey(column.normalizedKey),
  }));

  return [
    ...contractColumns,
    { id: "actions", label: "Aktion", dataKey: "actions", defaultWidth: 120, minWidth: 100, visibleByDefault: true },
  ];
}

const SEASON_TABLE_PINNED_COLUMN_IDS = new Set(["platz", "mannschaft", "punkte"]);

export function buildSeasonModeColumns(seasonTableColumns: FoundationTableColumn[]): FoundationTableColumn[] {
  const contractColumns = getSaisonstandExpertContractColumns();
  const columnById = new Map(seasonTableColumns.map((column) => [column.id, column]));
  return contractColumns
    .map((column) => columnById.get(column.normalizedKey))
    .filter((column): column is FoundationTableColumn => Boolean(column));
}

export function buildSeasonTablePinnedOffsets(
  visibleSeasonTableColumns: FoundationTableColumn[],
  getSeasonTableColumnWidth: (column: FoundationTableColumn) => number,
): Map<string, number> {
  let currentLeft = 0;
  const offsets = new Map<string, number>();
  for (const column of visibleSeasonTableColumns) {
    if (!SEASON_TABLE_PINNED_COLUMN_IDS.has(column.id)) {
      continue;
    }
    offsets.set(column.id, currentLeft);
    currentLeft += getSeasonTableColumnWidth(column);
  }
  return offsets;
}

export function scrollSeasonTableToColumn(
  shell: HTMLDivElement | null,
  visibleSeasonTableColumns: FoundationTableColumn[],
  columnId: string,
  getSeasonTableColumnWidth: (column: FoundationTableColumn) => number,
) {
  if (!shell) {
    return;
  }

  const targetIndex = visibleSeasonTableColumns.findIndex((column) => column.id === columnId);
  if (targetIndex < 0) {
    return;
  }

  const left = visibleSeasonTableColumns
    .slice(0, targetIndex)
    .reduce((sum, column) => sum + getSeasonTableColumnWidth(column), 0);

  shell.scrollTo({
    left: Math.max(left - 18, 0),
    behavior: "smooth",
  });
}
