"use client";

import { useMemo, useState, type CSSProperties } from "react";

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
import type { AllTimeTableClientProps } from "@/app/foundation/all-time-table-v2/AllTimeTableClient";
import type { AllTimeTableRow } from "@/lib/foundation/all-time-table";

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

type ChartMetricKey = "mw" | "cash" | "points" | "rank";

const CHART_METRICS: Array<{ id: ChartMetricKey; label: string; tone: NlTone }> = [
  { id: "mw", label: "MW", tone: "accent" },
  { id: "cash", label: "Cash", tone: "good" },
  { id: "points", label: "Punkte", tone: "spe" },
  { id: "rank", label: "Rang", tone: "warn" },
];

type TableSortKey =
  | "seasonsPlayed"
  | "cumulativePoints"
  | "avgRank"
  | "bestRank"
  | "titles"
  | "mwNow"
  | "mwPeak"
  | "mwGrowthAbs"
  | "cashPeak";

const TABLE_COLUMNS: Array<NlTableColumn<AllTimeTableRow>> = [
  { key: "allTimeRank", label: "#", align: "right", width: "40px" },
  { key: "teamName", label: "Team" },
  { key: "seasonsPlayed", label: "Saisons", align: "right", sortable: true, tooltip: "Anzahl gespielter Saisons (inkl. laufender Saison)" },
  { key: "cumulativePoints", label: "Punkte", align: "right", sortable: true, tooltip: "Kumulierte Liga-Punkte über alle Saisons inkl. laufender Saison" },
  { key: "avgRank", label: "Ø Rang", align: "right", sortable: true, tooltip: "Ø Rang über archivierte Saisons" },
  { key: "bestRank", label: "Best", align: "right", sortable: true, tooltip: "Bester Rang über archivierte Saisons" },
  { key: "titles", label: "Titel", align: "right", sortable: true, tooltip: "#1-Finishes über archivierte Saisons" },
  { key: "mwNow", label: "MW jetzt", align: "right", sortable: true, tooltip: "Aktuellster bekannter Marktwert" },
  { key: "mwPeak", label: "MW Peak", align: "right", sortable: true, tooltip: "Höchster je erreichter Marktwert" },
  { key: "mwGrowthAbs", label: "MW +/-", align: "right", sortable: true, tooltip: "Marktwert-Wachstum seit der ersten bekannten Saison" },
  { key: "cashPeak", label: "Cash Peak", align: "right", sortable: true, tooltip: "Höchster je erreichter Cash-Stand" },
];

const LIVE_ONLY_COLUMNS: Array<NlTableColumn<AllTimeTableRow>> = [
  { key: "allTimeRank", label: "#", align: "right", width: "40px" },
  { key: "teamName", label: "Team" },
  { key: "liveRank", label: "Rang", align: "right" },
  { key: "cumulativePoints", label: "Punkte", align: "right" },
  { key: "mwNow", label: "MW", align: "right" },
  {
    key: "cashNow",
    label: "Cash (Saison-Stand)",
    align: "right",
    tooltip: "Cash-Stand aus der Saison-Tabelle — kann vom Live-Kontostand in Finanzen/Kredite abweichen.",
  },
];

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getSortValue(row: AllTimeTableRow, key: TableSortKey): number {
  switch (key) {
    case "seasonsPlayed":
      return row.seasons.length;
    case "cumulativePoints":
      return row.cumulativePoints;
    case "avgRank":
      return row.avgRank ?? Number.POSITIVE_INFINITY;
    case "bestRank":
      return row.bestRank ?? Number.POSITIVE_INFINITY;
    case "titles":
      return row.titles;
    case "mwNow":
      return row.mwNow ?? Number.NEGATIVE_INFINITY;
    case "mwPeak":
      return row.mwPeak ?? Number.NEGATIVE_INFINITY;
    case "mwGrowthAbs":
      return row.mwGrowthAbs ?? Number.NEGATIVE_INFINITY;
    case "cashPeak":
      return row.cashPeak ?? Number.NEGATIVE_INFINITY;
    default:
      return 0;
  }
}

function getChartValues(row: AllTimeTableRow, metric: ChartMetricKey): number[] {
  const seasons = row.seasons.slice(-10);
  const raw = seasons.map((season) => {
    if (metric === "mw") return season.marketValue;
    if (metric === "cash") return season.cash;
    if (metric === "points") return season.points;
    // Rang invertiert (kleinere Zahl = besser) → -rang, damit "hoch" in der
    // Sparkline immer "besser" bedeutet, wie bei MW/Cash/Punkte.
    return season.rank != null ? -season.rank : null;
  });
  return raw.filter(isFiniteNumber);
}

export default function AllTimeTableNewLook({ model, selectedTeamId, seasonLabel, onOpenTeam }: AllTimeTableClientProps) {
  const [openKpi, setOpenKpi] = useState<AllTimeKpiKey | null>(null);
  const [sort, setSort] = useState<{ key: TableSortKey; direction: NlTableSortDirection }>({
    key: "cumulativePoints",
    direction: "desc",
  });
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>("mw");
  const [showAllCharts, setShowAllCharts] = useState(false);

  const sortedRows = useMemo(() => {
    if (!model) return [];
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...model.rows].sort((left, right) => (getSortValue(left, sort.key) - getSortValue(right, sort.key)) * factor);
  }, [model, sort]);

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

  if (!model || !model.hasArchive) {
    return (
      <section className="nl-alltime" id="all-time-table" data-testid="foundation-all-time-table" data-new-look="true" aria-label="Ewige Tabelle">
        <NlCard className="nl-alltime-header-card" eyebrow={seasonLabel} title="Ewige Tabelle">
          <p className="nl-alltime-hint">Team-Entwicklung über alle Saisons: Punkte, Marktwert, Cash und der ewige Leader.</p>
        </NlCard>
        <div role="status" aria-busy="true">
          <span className="sr-only">Ewige Tabelle wird geladen …</span>
          <NlSkeletonCard lines={2} />
          <NlSkeletonTable rows={8} cols={6} />
        </div>
      </section>
    );
  }

  if (!model.hasHistory) {
    return (
      <section className="nl-alltime" id="all-time-table" data-testid="foundation-all-time-table" data-new-look="true" aria-label="Ewige Tabelle">
        <NlCard className="nl-alltime-header-card" eyebrow={seasonLabel} title="Ewige Tabelle">
          <p className="nl-alltime-hint">Team-Entwicklung über alle Saisons: Punkte, Marktwert, Cash und der ewige Leader.</p>
        </NlCard>
        <NlEmptyState
          title="Noch keine abgeschlossene Saison archiviert"
          message="Sobald die erste Saison archiviert ist, erscheinen hier Punkte-, Marktwert- und Cash-Entwicklung über alle Saisons sowie der ewige Leader."
          data-testid="nl-alltime-empty"
        />
        {model.rows.length > 0 ? (
          <NlCard className="nl-alltime-live-card" title="Laufende Saison" eyebrow={seasonLabel}>
            <NlTable
              columns={LIVE_ONLY_COLUMNS}
              rows={model.rows}
              rowKey={(row) => row.teamId}
              rowClassName={(row) => (selectedTeamId != null && row.teamId === selectedTeamId ? "is-own-team" : undefined)}
              onRowClick={(row) => onOpenTeam(row.teamId)}
              data-testid="nl-alltime-live-table"
              aria-label="Laufende Saison"
              renderCell={(row, column) => {
                if (column.key === "allTimeRank") return row.allTimeRank;
                if (column.key === "teamName") return `${row.teamName} · ${row.teamCode}`;
                if (column.key === "liveRank") {
                  const rank = row.seasons[row.seasons.length - 1]?.rank ?? null;
                  return rank != null ? `#${formatNlNumber(rank, 0)}` : "—";
                }
                if (column.key === "cumulativePoints") return formatNlNumber(row.cumulativePoints, 1);
                if (column.key === "mwNow") return formatNlMoney(row.mwNow);
                if (column.key === "cashNow") return formatNlMoney(row.cashNow);
                return null;
              }}
            />
          </NlCard>
        ) : null}
      </section>
    );
  }

  const maxSeasonPoints = Math.max(0, ...model.rows.map((row) => row.seasons.length));
  const canShowCharts = maxSeasonPoints >= 2;
  const defaultChartRows = sortedRows.slice(0, 8);
  const ownRow = selectedTeamId != null ? model.rows.find((row) => row.teamId === selectedTeamId) ?? null : null;
  const chartRows = showAllCharts
    ? sortedRows
    : ownRow != null && !defaultChartRows.some((row) => row.teamId === ownRow.teamId)
      ? [...defaultChartRows, ownRow]
      : defaultChartRows;

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

      <NlCard className="nl-alltime-table-card" title="Alle Teams" eyebrow={`${formatNlNumber(model.rows.length, 0)} Teams`}>
        <NlTable
          columns={TABLE_COLUMNS}
          rows={sortedRows}
          rowKey={(row) => row.teamId}
          rowClassName={(row) => (selectedTeamId != null && row.teamId === selectedTeamId ? "is-own-team" : undefined)}
          sortState={{ key: sort.key, direction: sort.direction }}
          onSort={handleSort}
          onRowClick={(row) => onOpenTeam(row.teamId)}
          data-testid="nl-alltime-table"
          aria-label="Ewige Tabelle"
          renderCell={(row, column) => {
            switch (column.key) {
              case "allTimeRank":
                return row.allTimeRank;
              case "teamName":
                return (
                  <span className="nl-alltime-team-cell">
                    <strong>{row.teamName}</strong>
                    <small>{row.teamCode}</small>
                  </span>
                );
              case "seasonsPlayed":
                return formatNlNumber(row.seasons.length, 0);
              case "cumulativePoints":
                return formatNlNumber(row.cumulativePoints, 1);
              case "avgRank":
                return row.avgRank != null ? `#${formatNlNumber(row.avgRank, 1)}` : "—";
              case "bestRank":
                return row.bestRank != null ? `#${formatNlNumber(row.bestRank, 0)}` : "—";
              case "titles":
                return row.titles > 0 ? formatNlNumber(row.titles, 0) : "—";
              case "mwNow":
                return formatNlMoney(row.mwNow);
              case "mwPeak":
                return formatNlMoney(row.mwPeak);
              case "mwGrowthAbs":
                return row.mwGrowthAbs != null ? `${row.mwGrowthAbs >= 0 ? "+" : ""}${formatNlMoney(row.mwGrowthAbs)}` : "—";
              case "cashPeak":
                return formatNlMoney(row.cashPeak);
              default:
                return null;
            }
          }}
        />
      </NlCard>

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
            <div className="nl-alltime-chart-grid">
              {chartRows.map((row) => {
                const values = getChartValues(row, chartMetric);
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
                        aria-label={`${row.teamName} · ${CHART_METRICS.find((metric) => metric.id === chartMetric)?.label ?? ""}-Verlauf`}
                      />
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
