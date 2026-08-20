"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  NlCard,
  NlCountUpValue,
  NlEmptyState,
  NlRankingDrawer,
  NlSkeletonCard,
  NlSkeletonTable,
  NlSparkline,
  NlSubTabs,
  NlTable,
  formatNlMoney,
  formatNlNumber,
  nlToneClass,
  type NlRankingDrawerRow,
  type NlTableColumn,
  type NlTableSortDirection,
  type NlTone,
} from "@/components/foundation/new-look";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { AllTimeTableClientProps } from "@/app/foundation/all-time-table-v2/AllTimeTableClient";
import type { AllTimeTableRow } from "@/lib/foundation/all-time-table";
import AllTimeLeagueChart, { type AllTimeLeagueChartMetric } from "@/app/foundation/all-time-table-v2/AllTimeLeagueChart";
import { baueSaisonSpalten, getSaisonWert, parseSaisonSpalte } from "@/lib/foundation/all-time-season-columns";
import { isFiniteNumber } from "@/lib/foundation/foundation-number-utils";

/**
 * "Ewige Tabelle" (All-Time Table) — "Neuer Look" Mehr-Saison-Team-
 * Auswertung (#Nav "Ewige Tabelle", Gruppe Team).
 *
 * Reiner Präsentations-Layer: das Modell (`buildAllTimeTableModel`,
 * `lib/foundation/all-time-table.ts`) liefert bereits alle Aggregate
 * (kumulierte Punkte, Ø-Rang, Titel, MW-Wachstum, Cash-Peak, …) — hier wird
 * nichts neu berechnet, nur sortiert/gefiltert/dargestellt.
 *
 * Degradiert ehrlich statt erfundene Werte zu zeigen:
 * - `!hasArchive` (Compact-Load, Archiv noch nicht geladen): Skeleton.
 * - `hasArchive && !hasHistory` (0 archivierte Saisons): Leerzustand + eine
 *   schlanke Live-Stand-Tabelle (nur laufende Saison, falls vorhanden).
 * - genau 1 archivierte Saison (oder generell <2 Datenpunkte je Team):
 *   Tabelle voll, Sparkline-Grid wird durch einen Hinweis ersetzt.
 */

type AllTimeKpiKey = "leader" | "titles" | "mwGrowth" | "cashPeak";

type AllTimeKpiMetric = {
  key: AllTimeKpiKey;
  label: string;
  tone: NlTone;
  drawerLabel: string;
  getValue: (row: AllTimeTableRow) => number | null;
  format: (value: number) => string;
  holder: (row: AllTimeTableRow) => string;
};

const KPI_METRICS: AllTimeKpiMetric[] = [
  {
    key: "leader",
    label: "Ewiger Leader",
    tone: "accent",
    drawerLabel: "Ewige Tabelle · Punkte",
    getValue: (row) => row.cumulativePoints,
    format: (value) => formatNlNumber(value, 1),
    holder: (row) => `${row.teamName} · ${formatNlNumber(row.seasons.length, 0)} Saison${row.seasons.length === 1 ? "" : "en"}`,
  },
  {
    key: "titles",
    label: "Meiste Titel",
    tone: "warn",
    drawerLabel: "Meiste Titel",
    getValue: (row) => (row.titles > 0 ? row.titles : null),
    format: (value) => formatNlNumber(value, 0),
    holder: (row) => row.teamName,
  },
  {
    key: "mwGrowth",
    label: "Größtes MW-Wachstum",
    tone: "spe",
    drawerLabel: "MW-Wachstum",
    getValue: (row) => row.mwGrowthAbs,
    format: (value) => `${value >= 0 ? "+" : ""}${formatNlMoney(value)}`,
    holder: (row) => row.teamName,
  },
  {
    key: "cashPeak",
    label: "Cash-Peak",
    tone: "good",
    drawerLabel: "Cash-Peak",
    getValue: (row) => row.cashPeak,
    format: (value) => formatNlMoney(value),
    holder: (row) => row.teamName,
  },
];

type ChartMetricKey = "mw" | "cash" | "teamValue" | "points" | "rank";

const CHART_METRICS: Array<{ id: ChartMetricKey; label: string; tone: NlTone }> = [
  { id: "mw", label: "MW", tone: "accent" },
  { id: "cash", label: "Cash", tone: "good" },
  { id: "teamValue", label: "Teamwert", tone: "men" },
  { id: "points", label: "Punkte", tone: "spe" },
  { id: "rank", label: "Rang", tone: "warn" },
];

// Geld-Metriken: hier zeigt schon eine einzelne (laufende) Saison einen sinnvollen
// Anker — der aktuelle Wert ist der Verlauf-Startpunkt. Punkte/Rang bei S1 (alles 0
// bzw. kein Rang) bleiben beim schlichten „ab 2 Saisons"-Hinweis.
const MONEY_CHART_METRICS: ReadonlySet<ChartMetricKey> = new Set<ChartMetricKey>(["mw", "cash", "teamValue"]);

type TableSortKey =
  | "seasonsPlayed"
  | "cumulativePoints"
  | "avgPoints"
  | "avgRank"
  | "bestRank"
  | "titles"
  | "gold"
  | "silver"
  | "bronze"
  | "top5"
  | "top10"
  | "mwNow"
  | "mwPeak"
  | "mwGrowthAbs"
  | "mwGrowthPct"
  | "cashNow"
  | "cashPeak"
  | "teamValueNow"
  /**
   * Saisonspalten der Verlaufssicht: `saison:<seasonId>:mw` bzw. `:cash`. Sie stehen NICHT als
   * feste Namen hier, weil es je Spielstand andere sind — die Liste kommt aus
   * `model.seasonLabels`, und der Sortierwert wird in `getSortValue` aus dem Schluessel gelesen.
   */
  | `saison:${string}`;

// „Aufteilung" der Ewigen Tabelle in fokussierte Sichten (Reiter über der
// Tabelle): Punkte & Ränge · Medaillen · Marktwert · Cash & Teamwert. Alle
// Werte stammen aus dem bereits berechneten Modell — hier nur Spaltenauswahl.
type TableFocus = "points" | "medals" | "marketValue" | "cash" | "seasonHistory";

const TABLE_FOCUS_TABS: Array<{ id: TableFocus; label: string }> = [
  { id: "points", label: "Punkte & Ränge" },
  { id: "medals", label: "Medaillen" },
  { id: "marketValue", label: "Marktwert" },
  { id: "cash", label: "Cash & Teamwert" },
  {
    id: "seasonHistory",
    label: "Verlauf je Saison",
  },
];

const BASE_COLUMNS: Array<NlTableColumn<AllTimeTableRow>> = [
  { key: "allTimeRank", label: "#", align: "right", width: "40px" },
  { key: "teamName", label: "Team" },
  { key: "seasonsPlayed", label: "Saisons", align: "right", sortable: true, tooltip: "Anzahl gespielter Saisons (inkl. laufender Saison)" },
];

const POINTS_COLUMNS_BASE: Array<NlTableColumn<AllTimeTableRow>> = [
  ...BASE_COLUMNS,
  { key: "cumulativePoints", label: "Punkte", align: "right", sortable: true, tooltip: "Kumulierte Liga-Punkte über alle Saisons inkl. laufender Saison" },
  { key: "avgPoints", label: "Ø Punkte", align: "right", sortable: true, tooltip: "Ø Liga-Punkte je gespielter Saison" },
  { key: "avgRank", label: "Ø Rang", align: "right", sortable: true, tooltip: "Ø Abschluss-Rang über alle Saisons (kleiner = besser)" },
  { key: "bestRank", label: "Best", align: "right", sortable: true, tooltip: "Bester je erreichter Abschluss-Rang" },
];

/**
 * T8/A1 (Team-Audit): "Bei 1 archivierter Saison sind Ø Rang und Best
 * spaltenweise identisch — drei Spalten ohne Unterscheidungskraft."
 * `avgRank`/`bestRank` kommen beide aus genau demselben einen Wert
 * (`ranks.length === 1` → Ø = Min), solange nur eine Saison abgeschlossen
 * ist — kein Rechenfehler, nur eine Spalte, die noch nichts zu unterscheiden
 * hat. Ab der zweiten archivierten Saison können sich Ø und Bester
 * unterscheiden → beide Spalten kommen zurück. Nicht ausgeblendet, sondern
 * zusammengelegt UND erklärt (Tooltip), statt zwei Spalten mit derselben
 * Zahl nebeneinander stehen zu lassen.
 */
function getPointsColumns(archivedSeasonCount: number): Array<NlTableColumn<AllTimeTableRow>> {
  if (archivedSeasonCount >= 2) {
    return POINTS_COLUMNS_BASE;
  }
  return POINTS_COLUMNS_BASE.filter((column) => column.key !== "bestRank").map((column) =>
    column.key === "avgRank"
      ? {
          ...column,
          label: "Rang",
          tooltip:
            "Abschluss-Rang der bisher einen archivierten Saison. Ø-Rang und Bester Rang trennen sich, sobald eine zweite Saison archiviert ist — bis dahin dieselbe Zahl, eine Spalte statt zwei.",
        }
      : column,
  );
}

// `seasonHistory` fehlt hier bewusst: seine Spalten haengen am Spielstand und werden im Bauteil
// aus dem Modell erzeugt (siehe `saisonSpalten`), nicht als feste Liste vorgehalten.
const FOCUS_COLUMNS: Record<Exclude<TableFocus, "points" | "seasonHistory">, Array<NlTableColumn<AllTimeTableRow>>> = {
  medals: [
    ...BASE_COLUMNS,
    { key: "gold", label: "🥇", align: "right", sortable: true, tooltip: "Gold — Anzahl 1. Plätze (Meistertitel)" },
    { key: "silver", label: "🥈", align: "right", sortable: true, tooltip: "Silber — Anzahl 2. Plätze" },
    { key: "bronze", label: "🥉", align: "right", sortable: true, tooltip: "Bronze — Anzahl 3. Plätze" },
    { key: "top5", label: "Top 5", align: "right", sortable: true, tooltip: "Wie oft das Team eine Saison in den Top 5 abgeschlossen hat" },
    { key: "top10", label: "Top 10", align: "right", sortable: true, tooltip: "Wie oft das Team eine Saison in den Top 10 abgeschlossen hat" },
  ],
  marketValue: [
    ...BASE_COLUMNS,
    { key: "mwNow", label: "MW jetzt", align: "right", sortable: true, tooltip: "Aktuellster bekannter Marktwert" },
    { key: "mwPeak", label: "MW Peak", align: "right", sortable: true, tooltip: "Höchster je erreichter Marktwert" },
    { key: "mwGrowthAbs", label: "MW +/-", align: "right", sortable: true, tooltip: "Marktwert-Wachstum seit der ersten bekannten Saison" },
    { key: "mwGrowthPct", label: "MW %", align: "right", sortable: true, tooltip: "Prozentuales Marktwert-Wachstum seit der ersten bekannten Saison" },
  ],
  cash: [
    ...BASE_COLUMNS,
    { key: "cashNow", label: "Cash jetzt", align: "right", sortable: true, tooltip: "Aktuellster bekannter Cash-Stand" },
    { key: "cashPeak", label: "Cash Peak", align: "right", sortable: true, tooltip: "Höchster je erreichter Cash-Stand" },
    { key: "teamValueNow", label: "Teamwert", align: "right", sortable: true, tooltip: "Teamwert = Marktwert + Cash (aktuellster bekannter Stand)" },
  ],
};

const FOCUS_DEFAULT_SORT: Record<TableFocus, TableSortKey> = {
  points: "cumulativePoints",
  medals: "gold",
  marketValue: "mwNow",
  cash: "teamValueNow",
  // Der Verlauf sortiert nach der Gesamtleistung, nicht nach einer einzelnen Saison — sonst
  // entschiede die zufaellig erste Spalte, wer oben steht.
  seasonHistory: "cumulativePoints",
};

function getAvgPoints(row: AllTimeTableRow): number | null {
  return row.seasons.length > 0 ? row.cumulativePoints / row.seasons.length : null;
}

function getTeamValueNow(row: AllTimeTableRow): number | null {
  if (row.mwNow == null && row.cashNow == null) {
    return null;
  }
  return (row.mwNow ?? 0) + (row.cashNow ?? 0);
}

function getSortValue(row: AllTimeTableRow, key: TableSortKey): number {
  const saisonSpalte = parseSaisonSpalte(key);
  if (saisonSpalte) {
    // Eine Saison, die ein Team nie gespielt hat, sortiert ans Ende — nicht auf 0. „Nicht dabei"
    // ist kein Kontostand von null.
    return getSaisonWert(row, saisonSpalte.seasonId, saisonSpalte.metrik) ?? Number.NEGATIVE_INFINITY;
  }
  switch (key) {
    case "seasonsPlayed":
      return row.seasons.length;
    case "cumulativePoints":
      return row.cumulativePoints;
    case "avgPoints":
      return getAvgPoints(row) ?? Number.NEGATIVE_INFINITY;
    case "avgRank":
      return row.avgRank ?? Number.POSITIVE_INFINITY;
    case "bestRank":
      return row.bestRank ?? Number.POSITIVE_INFINITY;
    case "titles":
      return row.titles;
    case "gold":
      return row.medals.gold;
    case "silver":
      return row.medals.silver;
    case "bronze":
      return row.medals.bronze;
    case "top5":
      return row.medals.top5;
    case "top10":
      return row.medals.top10;
    case "mwNow":
      return row.mwNow ?? Number.NEGATIVE_INFINITY;
    case "mwPeak":
      return row.mwPeak ?? Number.NEGATIVE_INFINITY;
    case "mwGrowthAbs":
      return row.mwGrowthAbs ?? Number.NEGATIVE_INFINITY;
    case "mwGrowthPct":
      return row.mwGrowthPct ?? Number.NEGATIVE_INFINITY;
    case "cashNow":
      return row.cashNow ?? Number.NEGATIVE_INFINITY;
    case "cashPeak":
      return row.cashPeak ?? Number.NEGATIVE_INFINITY;
    case "teamValueNow":
      return getTeamValueNow(row) ?? Number.NEGATIVE_INFINITY;
    default:
      return 0;
  }
}

/**
 * Beschriftung je Punkt fuer den Hover — „Saison 3 · 412,5". Gerechnet aus DENSELBEN Reihen wie
 * `getChartValues`, damit Punkt und Beschriftung nicht auseinanderlaufen koennen: beide filtern
 * anschliessend die Luecken raus, also muss der Filter auf dem Paar passieren, nicht auf den Reihen
 * einzeln.
 */
function getChartSeries(
  row: AllTimeTableRow,
  metric: ChartMetricKey,
): { values: number[]; labels: string[] } {
  const seasons = row.seasons.slice(-10);
  const paare = seasons
    .map((season) => ({ season, value: getChartValueForSeason(season, metric) }))
    .filter((eintrag): eintrag is { season: (typeof seasons)[number]; value: number } => isFiniteNumber(eintrag.value));
  return {
    values: paare.map((eintrag) => eintrag.value),
    labels: paare.map((eintrag) => {
      // Der Rang steckt negiert in der Reihe (siehe unten) — im Hover wieder als echter Platz.
      const anzeige = metric === "rank" ? `Platz ${Math.abs(eintrag.value)}` : formatNlMoney(eintrag.value);
      const zahl = metric === "points" ? `${eintrag.value} Punkte` : anzeige;
      return `${eintrag.season.seasonLabel} · ${zahl}`;
    }),
  };
}

function getChartValueForSeason(season: AllTimeTableRow["seasons"][number], metric: ChartMetricKey): number | null {
  if (metric === "mw") return season.marketValue;
  if (metric === "cash") return season.cash;
  if (metric === "teamValue") {
    return season.marketValue != null || season.cash != null ? (season.marketValue ?? 0) + (season.cash ?? 0) : null;
  }
  if (metric === "points") return season.points;
  return season.rank != null ? -season.rank : null;
}

function getChartValues(row: AllTimeTableRow, metric: ChartMetricKey): number[] {
  const seasons = row.seasons.slice(-10);
  const raw = seasons.map((season) => {
    if (metric === "mw") return season.marketValue;
    if (metric === "cash") return season.cash;
    if (metric === "teamValue") {
      return season.marketValue != null || season.cash != null ? (season.marketValue ?? 0) + (season.cash ?? 0) : null;
    }
    if (metric === "points") return season.points;
    // Rang invertiert (kleinere Zahl = besser) → -rang, damit "hoch" in der
    // Sparkline immer "besser" bedeutet, wie bei MW/Cash/Punkte.
    return season.rank != null ? -season.rank : null;
  });
  return raw.filter(isFiniteNumber);
}

/** Zell-Renderer der Ewigen Tabelle — identisch für die Live- und die
 * Archiv-Sicht (beide nutzen dieselben Fokus-Spalten). */
function renderAllTimeCell(row: AllTimeTableRow, column: NlTableColumn<AllTimeTableRow>): ReactNode {
  const saisonSpalte = parseSaisonSpalte(column.key);
  if (saisonSpalte) {
    const wert = getSaisonWert(row, saisonSpalte.seasonId, saisonSpalte.metrik);
    // „—" heisst hier wirklich „diese Saison nicht gespielt" und nicht „0" — deshalb kein Nullwert.
    return wert == null ? "—" : formatNlMoney(wert);
  }
  switch (column.key) {
    case "allTimeRank":
      return row.allTimeRank;
    case "teamName": {
      const logoSrc = getTeamLogoBrowserUrl(row.teamId, null, { variant: "thumb" });
      return (
        <span className="nl-alltime-team-cell" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
          <BudgetedMediaImage
            src={logoSrc}
            alt={`${row.teamName} Logo`}
            className="nl-spreview-crest"
            width={24}
            height={24}
            loading="lazy"
            fallback={<span className="nl-spreview-crest nl-spreview-crest-fallback">{row.teamCode}</span>}
          />
          <span className="nl-spreview-team-copy">
            <strong>{row.teamName}</strong>
            <small>{row.teamCode}</small>
          </span>
        </span>
      );
    }
    case "seasonsPlayed":
      return formatNlNumber(row.seasons.length, 0);
    case "cumulativePoints":
      return formatNlNumber(row.cumulativePoints, 1);
    case "avgPoints": {
      const avg = getAvgPoints(row);
      return avg != null ? formatNlNumber(avg, 1) : "—";
    }
    case "avgRank":
      return row.avgRank != null ? `#${formatNlNumber(row.avgRank, 1)}` : "—";
    case "bestRank":
      return row.bestRank != null ? `#${formatNlNumber(row.bestRank, 0)}` : "—";
    case "gold":
      return row.medals.gold > 0 ? formatNlNumber(row.medals.gold, 0) : "—";
    case "silver":
      return row.medals.silver > 0 ? formatNlNumber(row.medals.silver, 0) : "—";
    case "bronze":
      return row.medals.bronze > 0 ? formatNlNumber(row.medals.bronze, 0) : "—";
    case "top5":
      return row.medals.top5 > 0 ? formatNlNumber(row.medals.top5, 0) : "—";
    case "top10":
      return row.medals.top10 > 0 ? formatNlNumber(row.medals.top10, 0) : "—";
    case "mwNow":
      return formatNlMoney(row.mwNow);
    case "mwPeak":
      return formatNlMoney(row.mwPeak);
    case "mwGrowthAbs":
      return row.mwGrowthAbs != null ? `${row.mwGrowthAbs >= 0 ? "+" : ""}${formatNlMoney(row.mwGrowthAbs)}` : "—";
    case "mwGrowthPct":
      return row.mwGrowthPct != null ? `${row.mwGrowthPct >= 0 ? "+" : ""}${formatNlNumber(row.mwGrowthPct, 0)} %` : "—";
    case "cashNow":
      return formatNlMoney(row.cashNow);
    case "cashPeak":
      return formatNlMoney(row.cashPeak);
    case "teamValueNow": {
      const teamValue = getTeamValueNow(row);
      return teamValue != null ? formatNlMoney(teamValue) : "—";
    }
    default:
      return null;
  }
}

export default function AllTimeTableNewLook({ model, selectedTeamId, seasonLabel, onOpenTeam }: AllTimeTableClientProps) {
  const [openKpi, setOpenKpi] = useState<AllTimeKpiKey | null>(null);
  const [focus, setFocus] = useState<TableFocus>("points");
  /**
   * Hervorhebung in der Liga-Grafik. `null` heisst „noch nicht angeklickt" — dann greift unten das
   * eigene Team als Vorgabe (`lcmgxx`: „mein eigenes standardmäßig das hervorgehobene"). Ein
   * eigener Zustand statt `selectedTeamId` direkt, damit ein Klick die Vorgabe ueberschreiben kann,
   * ohne die Team-Auswahl der ganzen Ansicht zu verstellen.
   */
  const [hervorgehobenesTeam, setHervorgehobenesTeam] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: TableSortKey; direction: NlTableSortDirection }>({
    key: "cumulativePoints",
    direction: "desc",
  });

  // Fokus-Wechsel setzt die Tabelle auf eine sinnvolle Standard-Sortierung der
  // gewählten Sicht (z. B. Medaillen → Gold, Marktwert → MW jetzt).
  function handleFocusSelect(nextFocus: TableFocus) {
    setFocus(nextFocus);
    setSort({ key: FOCUS_DEFAULT_SORT[nextFocus], direction: "desc" });
  }
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>("mw");
  const [showAllCharts, setShowAllCharts] = useState(false);

  const sortedRows = useMemo(() => {
    if (!model) return [];
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...model.rows].sort((left, right) => (getSortValue(left, sort.key) - getSortValue(right, sort.key)) * factor);
  }, [model, sort]);

  /**
   * Die tatsächlich gerenderten Spalten des aktuellen Fokus — EINE Quelle für
   * Tabellenkopf UND die Verlauf-Caption unten (T8/A2: "Top 8" muss das
   * wirklich aktive Sortierkriterium nennen, nicht immer "nach Punkten"
   * behaupten, wenn gerade z. B. nach Marktwert sortiert ist).
   */
  /**
   * Die Saisonspalten kommen aus dem Modell, nicht aus einer festen Liste: jeder Spielstand hat
   * andere Saisons, und die laufende kommt waehrend des Spielens dazu. Reihenfolge und Beschriftung
   * stammen aus `model.rows[].seasons` — derselben Quelle, aus der auch die Zelle liest.
   */
  const saisonSpalten = useMemo<Array<NlTableColumn<AllTimeTableRow>>>(
    () => (model ? baueSaisonSpalten(model.rows) : []),
    [model],
  );

  const activeColumns = useMemo(
    () =>
      focus === "points"
        ? getPointsColumns(model?.archivedSeasonCount ?? 0)
        : focus === "seasonHistory"
          ? [...BASE_COLUMNS, ...saisonSpalten]
          : FOCUS_COLUMNS[focus as Exclude<TableFocus, "points" | "seasonHistory">],
    [focus, model?.archivedSeasonCount, saisonSpalten],
  );

  const openKpiMetric = useMemo(() => KPI_METRICS.find((metric) => metric.key === openKpi) ?? null, [openKpi]);

  const drawerRows = useMemo<NlRankingDrawerRow[]>(() => {
    if (!model || !openKpiMetric) return [];
    return [...model.rows]
      .map((row) => ({ row, value: openKpiMetric.getValue(row) }))
      .filter((entry): entry is { row: AllTimeTableRow; value: number } => isFiniteNumber(entry.value))
      .sort((left, right) => right.value - left.value)
      .map((entry, index) => ({
        id: entry.row.teamId,
        rank: index + 1,
        name: entry.row.teamName,
        sub: entry.row.teamCode,
        value: entry.value,
        displayValue: openKpiMetric.format(entry.value),
        tone: openKpiMetric.tone,
        isOwn: selectedTeamId != null && entry.row.teamId === selectedTeamId,
      }));
  }, [model, openKpiMetric, selectedTeamId]);

  function handleSort(key: string) {
    setSort((current) => {
      if (current.key === key) {
        return { key: key as TableSortKey, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key: key as TableSortKey, direction: "desc" };
    });
  }

  // Fokus-Tabelle (Punkte & Ränge · Medaillen · Marktwert · Cash & Teamwert) —
  // identisch für Live- und Archiv-Sicht, damit die Aufteilung ab der ersten
  // Saison sichtbar ist (Medaillen/Ø-Werte sind bis zum ersten Saison-Abschluss
  // ehrlich 0/—).
  function renderFocusTableCard() {
    if (!model || model.rows.length === 0) {
      return null;
    }
    return (
      <NlCard
        className="nl-alltime-table-card"
        title="Alle Teams"
        eyebrow={`${formatNlNumber(model.rows.length, 0)} Teams`}
        actions={
          <NlSubTabs
            items={TABLE_FOCUS_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
            activeId={focus}
            onSelect={(id) => handleFocusSelect(id as TableFocus)}
            aria-label="Auswertung wählen"
            className="nl-alltime-focus-subtabs"
          />
        }
      >
        <NlTable
          columns={activeColumns}
          rows={sortedRows}
          rowKey={(row) => row.teamId}
          rowClassName={(row) => (selectedTeamId != null && row.teamId === selectedTeamId ? "is-own-team" : undefined)}
          sortState={{ key: sort.key, direction: sort.direction }}
          onSort={handleSort}
          onRowClick={(row) => onOpenTeam(row.teamId)}
          data-testid="nl-alltime-table"
          aria-label="Ewige Tabelle"
          renderCell={renderAllTimeCell}
        />
      </NlCard>
    );
  }

  if (!model || !model.hasArchive) {
    return (
      <section className="nl-alltime" id="all-time-table" data-testid="foundation-all-time-table" data-new-look="true" aria-label="Ewige Tabelle">
        <NlCard className="nl-alltime-header-card" eyebrow={seasonLabel} title="Ewige Tabelle" />
        <div role="status" aria-busy="true">
          <span className="sr-only">Ewige Tabelle wird geladen …</span>
          <NlSkeletonCard lines={2} />
          <NlSkeletonTable rows={8} cols={6} />
        </div>
      </section>
    );
  }

  // Verlaufs-Daten für BEIDE Pfade (S1 ohne Archiv & voller Archiv-Pfad) berechnen,
  // damit die Verlaufskarte schon ab der laufenden Saison den aktuellen MW zeigt.
  const maxSeasonPoints = Math.max(0, ...model.rows.map((row) => row.seasons.length));
  // Ab 1 Saison mit finitem Geld-Wert rendert die Verlaufskarte bereits: die
  // Geld-Metriken zeigen dann den aktuellen Wert als einzelnen Verlauf-Startpunkt
  // (statt „ab 2 Saisons"). ≥2 Datenpunkte behalten die echte Sparkline.
  const hasSingleMoneyAnchor = model.rows.some(
    (row) =>
      getChartValues(row, "mw").length >= 1 ||
      getChartValues(row, "cash").length >= 1 ||
      getChartValues(row, "teamValue").length >= 1,
  );
  const canShowCharts = maxSeasonPoints >= 2 || hasSingleMoneyAnchor;
  /**
   * Die Verlaufskarte kennt fuenf Kennzahlen, die Liga-Grafik vier: `teamValue` (MW + Cash) laesst
   * sich aus `AllTimeSeasonPoint` nicht je Saison bilden, ohne zwei moeglicherweise fehlende Werte
   * stillschweigend als 0 zu behandeln. Statt eine erfundene Linie zu zeichnen, bleibt die
   * Liga-Grafik bei dieser Wahl leer — die Kacheln daneben zeigen sie weiterhin.
   */
  const ligaMetrik: AllTimeLeagueChartMetric | null =
    chartMetric === "mw" || chartMetric === "cash" || chartMetric === "points" || chartMetric === "rank"
      ? chartMetric
      : null;
  const defaultChartRows = sortedRows.slice(0, 8);
  const ownRow = selectedTeamId != null ? model.rows.find((row) => row.teamId === selectedTeamId) ?? null : null;
  const ownRowAppended = ownRow != null && !defaultChartRows.some((row) => row.teamId === ownRow.teamId);
  const chartRows = showAllCharts ? sortedRows : ownRowAppended ? [...defaultChartRows, ownRow] : defaultChartRows;

  /**
   * T8/A2 (Team-Audit): "Der Cut bei 8+eigenes ist nicht beschriftet ('Top 8
   * nach Punkten' fehlt als Caption)." Die Auswahl kommt aus `sortedRows` —
   * der TABELLEN-Sortierung, die je nach Fokus-Reiter/Klick auf einen anderen
   * Spaltenkopf wechselt (nicht immer Punkte, nicht immer absteigend). Label
   * kommt aus `activeColumns` — derselben Quelle wie der Tabellenkopf, damit
   * Caption und Kopfzeile nie auseinanderlaufen können.
   */
  const chartSortLabel = activeColumns.find((column) => column.key === sort.key)?.label ?? sort.key;
  const chartCaption = showAllCharts
    ? `Alle ${formatNlNumber(sortedRows.length, 0)} Teams — sortiert nach ${chartSortLabel}${sort.direction === "asc" ? " (aufsteigend)" : ""}.`
    : `Top ${formatNlNumber(defaultChartRows.length, 0)} nach ${chartSortLabel}${
        sort.direction === "asc" ? " (aufsteigend)" : ""
      }${ownRowAppended ? " · dein Team ergänzt" : ""}.`;

  const renderChartsCard = () => (
    <NlCard
      className="nl-alltime-charts-card"
      title="Entwicklung je Team"
      eyebrow="Verlauf über die letzten Saisons"
      actions={
        <NlSubTabs
          items={CHART_METRICS.map((metric) => ({ id: metric.id, label: metric.label }))}
          activeId={chartMetric}
          onSelect={(id) => setChartMetric(id as ChartMetricKey)}
          aria-label="Entwicklungs-Kennzahl"
          className="nl-alltime-chart-subtabs"
        />
      }
    >
      {!canShowCharts ? (
        <p className="nl-alltime-chart-hint">Verläufe erscheinen ab 2 Saisons Historie je Team.</p>
      ) : (
        <>
          <p className="nl-alltime-chart-caption">{chartCaption}</p>
          {/* ALLE TEAMS IN EINEM BILD (`lcmgxx`). Steht ueber dem Kachelgitter: erst „wo stehe ich
              gegen die Liga", dann der Verlauf je Team im Detail. Das Gitter bleibt — es beantwortet
              eine andere Frage und war ausdruecklich gewuenscht („mit nem Hover ne
              Liniendiagramm-Grafik"). */}
          {ligaMetrik ? (
            <AllTimeLeagueChart
              rows={sortedRows}
              metric={ligaMetrik}
              highlightedTeamId={hervorgehobenesTeam ?? selectedTeamId ?? null}
              onHighlight={setHervorgehobenesTeam}
            />
          ) : null}
          <div className="nl-alltime-chart-grid">
            {chartRows.map((row) => {
              const { values, labels } = getChartSeries(row, chartMetric);
              const tone = CHART_METRICS.find((metric) => metric.id === chartMetric)?.tone ?? "accent";
              return (
                <article
                  key={row.teamId}
                  className={`nl-alltime-chart-tile${selectedTeamId != null && row.teamId === selectedTeamId ? " is-own-team" : ""}`}
                >
                  <button
                    type="button"
                    className="nl-alltime-chart-tile-team"
                    onClick={() => onOpenTeam(row.teamId)}
                    title={`${row.teamName} · Profil öffnen`}
                  >
                    {row.teamName}
                  </button>
                  {values.length >= 2 ? (
                    <NlSparkline
                      points={values}
                      tone={tone}
                      // Chris: „mit nem Hover ne Liniendiagramm-Grafik ... sieht wie die Entwicklung war."
                      // Jeder Punkt traegt jetzt seine Saison und seinen Wert.
                      pointLabels={labels}
                      aria-label={`${row.teamName} · ${CHART_METRICS.find((metric) => metric.id === chartMetric)?.label ?? ""}-Verlauf`}
                    />
                  ) : MONEY_CHART_METRICS.has(chartMetric) && values.length === 1 ? (
                    <span className={`nl-alltime-chart-tile-anchor ${nlToneClass(tone)}`}>
                      <span className="nl-alltime-chart-tile-anchor-value nl-tnum">{formatNlMoney(values[0])}</span>
                      <span className="nl-alltime-chart-tile-anchor-caption">aktuell · Verlauf ab Saison 2</span>
                    </span>
                  ) : (
                    <span className="nl-alltime-chart-tile-hint">ab 2 Saisons</span>
                  )}
                </article>
              );
            })}
          </div>
          {sortedRows.length > defaultChartRows.length ? (
            <button type="button" className="nl-alltime-chart-toggle" onClick={() => setShowAllCharts((current) => !current)}>
              {showAllCharts ? "Weniger anzeigen" : "Alle anzeigen"}
            </button>
          ) : null}
        </>
      )}
    </NlCard>
  );

  if (!model.hasHistory) {
    return (
      <section className="nl-alltime" id="all-time-table" data-testid="foundation-all-time-table" data-new-look="true" aria-label="Ewige Tabelle">
        <NlCard className="nl-alltime-header-card" eyebrow={seasonLabel} title="Ewige Tabelle" />
        <NlEmptyState
          title="Noch keine abgeschlossene Saison archiviert"
          message="Die Aufteilung unten zeigt bereits die laufende Saison. Medaillen (🥇/🥈/🥉), Top-5/Top-10, Ø-Punkte und Ø-Rang füllen sich, sobald die erste Saison abgeschlossen ist; Verläufe & ewiger Leader ab der zweiten Saison."
          data-testid="nl-alltime-empty"
        />
        {renderFocusTableCard()}
        {/* Geld-Verlauf schon ab S1: aktueller MW/Cash/Teamwert als Anker sichtbar. */}
        {canShowCharts ? renderChartsCard() : null}
      </section>
    );
  }

  return (
    <section className="nl-alltime" id="all-time-table" data-testid="foundation-all-time-table" data-new-look="true" aria-label="Ewige Tabelle">
      <NlCard
        className="nl-alltime-header-card"
        eyebrow={seasonLabel}
        title="Ewige Tabelle"
        actions={
          <span className="nl-alltime-season-badge nl-tnum">
            {formatNlNumber(model.archivedSeasonCount, 0)} Saison{model.archivedSeasonCount === 1 ? "" : "en"} archiviert
          </span>
        }
      >
        <p className="nl-alltime-hint">
          Team-Entwicklung über alle Saisons: kumulierte Punkte, Marktwert- und Cash-Verlauf sowie der ewige Leader.
          {/* T8 (Chris' Rückfrage): früher Saisonzustand erklären statt stillschweigend
              voraussetzen — bei erst 1 archivierten Saison stammt fast alles hier noch
              aus dieser einen Saison, die laufende zählt in "Saisons" mit, obwohl sie
              gerade erst begonnen hat. */}
          {model.archivedSeasonCount === 1 ? (
            <>
              {" "}
              Aktuell ist erst eine Saison archiviert — die „Saisons"-Spalte zählt die laufende Saison mit, auch
              wenn sie gerade erst begonnen hat. Verläufe, Ø-/Bester-Rang-Trennung und der ewige Leader werden
              erst mit der zweiten archivierten Saison aussagekräftig.
            </>
          ) : null}
        </p>
      </NlCard>

      <div className="nl-alltime-kpis">
        {KPI_METRICS.map((metric, index) => {
          const leaderRow =
            metric.key === "leader"
              ? model.leader
              : metric.key === "titles"
                ? model.mostTitles
                : metric.key === "mwGrowth"
                  ? model.biggestMwGrowth
                  : model.richestEver;
          const value = leaderRow ? metric.getValue(leaderRow) : null;
          return (
            <button
              key={metric.key}
              type="button"
              className={`nl-alltime-kpi nl-reveal ${nlToneClass(metric.tone)}${leaderRow != null && selectedTeamId != null && leaderRow.teamId === selectedTeamId ? " is-own-team" : ""}`}
              style={{ "--nl-reveal-i": index } as CSSProperties}
              onClick={() => setOpenKpi(metric.key)}
              title={`Rangliste ${metric.drawerLabel} öffnen`}
            >
              <span className="nl-alltime-kpi-label">{metric.label}</span>
              {leaderRow != null && value != null ? (
                <>
                  <span className="nl-alltime-kpi-value nl-tnum">
                    <NlCountUpValue value={value} format={metric.format} />
                  </span>
                  <span className="nl-alltime-kpi-holder">{metric.holder(leaderRow)}</span>
                </>
              ) : (
                <span className="nl-alltime-kpi-empty">Keine Daten</span>
              )}
            </button>
          );
        })}
      </div>

      {renderFocusTableCard()}

      {renderChartsCard()}

      <NlRankingDrawer
        open={openKpiMetric != null}
        onClose={() => setOpenKpi(null)}
        metricLabel={openKpiMetric?.drawerLabel ?? ""}
        metricKey={openKpiMetric?.key}
        subtitle={seasonLabel}
        rows={drawerRows}
        onSelectRow={(row) => onOpenTeam(row.id)}
      />
    </section>
  );
}
