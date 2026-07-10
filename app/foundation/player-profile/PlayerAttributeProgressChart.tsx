"use client";

import { useMemo, type ReactNode } from "react";

import {
  buildAttributeHistoryDelta,
  PLAYER_ATTRIBUTE_CHART_KEYS,
  PLAYER_ATTRIBUTE_CHART_LABELS,
  type PlayerAttributeHistoryRow,
} from "@/lib/foundation/player-attribute-history";
import type { PlayerDrawerHistoryRow } from "@/lib/foundation/player-detail-drawer";
import {
  buildPlayerProgressSummary,
  formatProgressDelta,
  sortPlayerProgressHistoryRows,
  type PlayerProgressHistoryRow,
} from "@/lib/foundation/player-progress-summary";

type PlayerAttributeProgressChartProps = {
  historyRows: PlayerDrawerHistoryRow[];
  attributeHistoryRows?: PlayerAttributeHistoryRow[];
};

const PP_METRICS = [
  { id: "pow" as const, label: "POW", className: "is-power", rankKey: "powRank" as const },
  { id: "spe" as const, label: "SPE", className: "is-speed", rankKey: "speRank" as const },
  { id: "men" as const, label: "MEN", className: "is-mental", rankKey: "menRank" as const },
  { id: "soc" as const, label: "SOC", className: "is-social", rankKey: "socRank" as const },
];

const ATTRIBUTE_COLORS: Record<string, string> = {
  power: "#ff6b57",
  health: "#ff9d57",
  stamina: "#ffd057",
  intelligence: "#57c7ff",
  awareness: "#7aa0ff",
  determination: "#b58cff",
  speed: "#57ffd6",
  dexterity: "#e0c06a",
};

function formatChartValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
}

function formatPpTableMetric(value: number | null | undefined, rank?: number | null) {
  const formatted = formatChartValue(value);
  return rank != null ? `${formatted} · #${rank}` : formatted;
}

function resolveHistoryPps(row: PlayerDrawerHistoryRow) {
  return row.pps ?? row.totalPoints;
}

function ProgressChartCollapsible({
  testId,
  title,
  subtitle,
  shellClassName = "",
  defaultOpen = false,
  children,
}: {
  testId: string;
  title: string;
  subtitle?: string;
  shellClassName?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className={`player-attribute-progress-collapsible ${shellClassName}`.trim()}
      data-testid={testId}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="player-attribute-progress-collapsible-summary">
        <span className="player-attribute-progress-collapsible-copy">
          <strong>{title}</strong>
          {subtitle ? <span className="muted">{subtitle}</span> : null}
        </span>
      </summary>
      <div className="player-attribute-progress-collapsible-body">{children}</div>
    </details>
  );
}

function buildFocusedAttributeLineGeometry(rows: PlayerAttributeHistoryRow[], attribute: (typeof PLAYER_ATTRIBUTE_CHART_KEYS)[number]) {
  const width = 560;
  const height = 180;
  const paddingLeft = 42;
  const paddingRight = 16;
  const paddingTop = 18;
  const paddingBottom = 42;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = rows
    .map((row, index) => {
      const value = row.attributes[attribute];
      if (value == null || !Number.isFinite(value)) {
        return null;
      }
      const x = paddingLeft + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
      return { row, value, x };
    })
    .filter((point): point is NonNullable<typeof point> => point != null);

  if (points.length === 0) {
    return null;
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = Math.max(maxValue - minValue, 1);
  const coordinates = points.map((point) => ({
    ...point,
    y: paddingTop + innerHeight - ((point.value - minValue) / valueSpan) * innerHeight,
  }));

  return {
    width,
    height,
    paddingTop,
    paddingBottom,
    minValue,
    maxValue,
    coordinates,
    polyline: coordinates.map((point) => `${point.x},${point.y}`).join(" "),
    delta: buildAttributeHistoryDelta(rows, attribute),
  };
}

function formatSeasonShortLabel(seasonName: string, seasonId: string | null) {
  const match = (seasonId ?? seasonName).match(/season-(\d+)/i);
  if (match) {
    return `S${match[1]}`;
  }
  return seasonName.replace(/^Season\s+/i, "S");
}

function buildPpMetricBlockChartsGeometry(rows: PlayerProgressHistoryRow[]) {
  const width = 280;
  const height = 148;
  const paddingLeft = 28;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 34;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const slotWidth = innerWidth / Math.max(rows.length, 1);
  const barWidth = Math.min(16, slotWidth * 0.52);

  return PP_METRICS.map((metric) => {
    const values = rows
      .map((row) => row[metric.id])
      .filter((value): value is number => value != null && Number.isFinite(value));
    const maxValue = Math.max(...values, 1);

    const bars = rows.map((row, index) => {
      const value = row[metric.id];
      const hasValue = value != null && Number.isFinite(value);
      const centerX = paddingLeft + index * slotWidth + slotWidth / 2;
      const barHeight = hasValue && value > 0 ? (value / maxValue) * innerHeight : 0;
      const x = centerX - barWidth / 2;
      const y = paddingTop + innerHeight - barHeight;
      return {
        row,
        value: hasValue ? value : null,
        centerX,
        x,
        y,
        width: barWidth,
        height: barHeight,
      };
    });

    return {
      metric,
      width,
      height,
      paddingTop,
      paddingBottom,
      innerHeight,
      maxValue,
      bars,
    };
  });
}

function buildAttributeLineChartGeometry(rows: PlayerAttributeHistoryRow[]) {
  const width = 560;
  const height = 240;
  const paddingLeft = 42;
  const paddingRight = 16;
  const paddingTop = 18;
  const paddingBottom = 42;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const values = rows.flatMap((row) =>
    PLAYER_ATTRIBUTE_CHART_KEYS.map((attribute) => row.attributes[attribute]).filter((value): value is number => value != null && Number.isFinite(value)),
  );
  if (values.length === 0) {
    return null;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = Math.max(maxValue - minValue, 1);

  const series = PLAYER_ATTRIBUTE_CHART_KEYS.map((attribute) => {
    const points = rows
      .map((row, index) => {
        const value = row.attributes[attribute];
        if (value == null || !Number.isFinite(value)) {
          return null;
        }
        const x = paddingLeft + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
        const y = paddingTop + innerHeight - ((value - minValue) / valueSpan) * innerHeight;
        return { row, value, x, y };
      })
      .filter((point): point is NonNullable<typeof point> => point != null);
    return {
      attribute,
      points,
      polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
    };
  }).filter((entry) => entry.points.length > 0);

  return {
    width,
    height,
    paddingTop,
    paddingBottom,
    innerHeight,
    minValue,
    maxValue,
    series,
    seasonLabels: rows.map((row) => row.seasonName),
  };
}

export default function PlayerAttributeProgressChart({
  historyRows,
  attributeHistoryRows = [],
}: PlayerAttributeProgressChartProps) {
  const sortedRows = useMemo(() => sortPlayerProgressHistoryRows(historyRows), [historyRows]);
  const summary = useMemo(() => buildPlayerProgressSummary(sortedRows), [sortedRows]);
  const ppMetricCharts = useMemo(
    () => (sortedRows.length > 0 ? buildPpMetricBlockChartsGeometry(sortedRows) : []),
    [sortedRows],
  );
  const attributeChart = useMemo(
    () => (attributeHistoryRows.length >= 2 ? buildAttributeLineChartGeometry(attributeHistoryRows) : null),
    [attributeHistoryRows],
  );
  const strChart = useMemo(
    () => (attributeHistoryRows.length >= 2 ? buildFocusedAttributeLineGeometry(attributeHistoryRows, "power") : null),
    [attributeHistoryRows],
  );

  if (sortedRows.length === 0 || !summary) {
    return (
      <div className="player-attribute-progress-chart player-attribute-progress-chart-empty" data-testid="player-attribute-progress-chart">
        <h4>Entwicklungsverlauf</h4>
        <p className="muted">Noch keine Saison-Daten für eine Verlaufsgrafik. Nach dem ersten Saisonabschluss erscheinen Attribute und PPs hier.</p>
      </div>
    );
  }

  return (
    <div className="player-attribute-progress-chart" data-testid="player-attribute-progress-chart">
      <div className="player-attribute-progress-chart-head">
        <h4>Entwicklungsverlauf</h4>
        <p className="player-attribute-progress-range muted">
          {summary.firstSeasonName} → {summary.lastSeasonName}
          {summary.lastSeasonIsLive ? " live" : ""}
        </p>
      </div>

      <div className="player-attribute-progress-summary" data-testid="player-attribute-progress-summary">
        <span className="player-attribute-progress-summary-label">Entwicklungsbilanz (PPs)</span>
        <div className="player-attribute-progress-summary-chips">
          {summary.metrics.map((metric) => (
            <span
              key={`summary-${metric.id}`}
              className={`player-attribute-progress-delta-chip is-${metric.tone} player-drawer-history-axis ${metric.id === "ovr" ? "is-neutral" : `is-${metric.id === "pow" ? "power" : metric.id === "spe" ? "speed" : metric.id === "men" ? "mental" : "social"}`}`}
            >
              <small>{metric.label}</small>
              <strong>{formatProgressDelta(metric.delta)}</strong>
            </span>
          ))}
          <span className={`player-attribute-progress-delta-chip is-${summary.axisSumTone} is-axis-sum`}>
            <small>Achsen-Summe</small>
            <strong>{formatProgressDelta(summary.axisSumDelta)}</strong>
          </span>
        </div>
      </div>

      {strChart ? (
        <div data-testid="player-attribute-progress-str-line">
        <ProgressChartCollapsible
          testId="player-attribute-progress-str-line"
          title="STR (Power)"
          shellClassName="player-attribute-progress-line-chart-shell is-focused"
          subtitle={`Entwicklung über ${attributeHistoryRows.length} Saisons${
            strChart.delta != null
              ? ` · Bilanz ${strChart.delta > 0 ? "+" : ""}${formatChartValue(strChart.delta)}`
              : ""
          }`}
        >
          <svg
            className="player-attribute-progress-line-chart-svg is-focused"
            viewBox={`0 0 ${strChart.width} ${strChart.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="STR Entwicklung über Saisons"
          >
            <text x={4} y={strChart.height - strChart.paddingBottom + 4} className="player-attribute-progress-y-tick">
              {formatChartValue(strChart.minValue)}
            </text>
            <text x={4} y={strChart.paddingTop + 4} className="player-attribute-progress-y-tick">
              {formatChartValue(strChart.maxValue)}
            </text>
            <line
              x1={42}
              y1={strChart.height - strChart.paddingBottom}
              x2={strChart.width - 16}
              y2={strChart.height - strChart.paddingBottom}
              className="player-attribute-progress-axis"
            />
            <polyline points={strChart.polyline} className="player-attribute-progress-attribute-line is-focused-str" style={{ stroke: ATTRIBUTE_COLORS.power }} />
            {strChart.coordinates.map((point) => (
              <g key={`str-${point.row.seasonId}`}>
                <circle cx={point.x} cy={point.y} r={4} className="player-attribute-progress-attribute-dot" style={{ fill: ATTRIBUTE_COLORS.power, stroke: ATTRIBUTE_COLORS.power }} />
                <text x={point.x - 8} y={point.y - 10} className="player-attribute-progress-value-label">
                  {formatChartValue(point.value)}
                </text>
                <text
                  x={point.x}
                  y={strChart.height - 12}
                  textAnchor="middle"
                  className={`player-attribute-progress-season-label${point.row.isActiveSeason ? " is-live" : ""}`}
                >
                  {point.row.seasonName}
                </text>
              </g>
            ))}
          </svg>
        </ProgressChartCollapsible>
        </div>
      ) : null}

      {attributeChart ? (
        <ProgressChartCollapsible
          testId="player-attribute-progress-attribute-lines"
          title="Attribute"
          shellClassName="player-attribute-progress-line-chart-shell"
          subtitle="Liniendiagramm der Kernattribute über die Saisons."
        >
          <svg
            className="player-attribute-progress-line-chart-svg"
            viewBox={`0 0 ${attributeChart.width} ${attributeChart.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Attribut-Entwicklung über Saisons"
          >
            <text x={4} y={attributeChart.height - attributeChart.paddingBottom + 4} className="player-attribute-progress-y-tick">
              {formatChartValue(attributeChart.minValue)}
            </text>
            <text x={4} y={attributeChart.paddingTop + 4} className="player-attribute-progress-y-tick">
              {formatChartValue(attributeChart.maxValue)}
            </text>
            <line
              x1={42}
              y1={attributeChart.height - attributeChart.paddingBottom}
              x2={attributeChart.width - 16}
              y2={attributeChart.height - attributeChart.paddingBottom}
              className="player-attribute-progress-axis"
            />
            {attributeChart.series.map((entry) => (
              <g key={`attr-series-${entry.attribute}`}>
                <polyline
                  points={entry.polyline}
                  className="player-attribute-progress-attribute-line"
                  style={{ stroke: ATTRIBUTE_COLORS[entry.attribute] ?? "#d8dee8" }}
                />
                {entry.points.map((point) => (
                  <circle
                    key={`${entry.attribute}-${point.row.seasonId}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    className="player-attribute-progress-attribute-dot"
                    style={{ fill: ATTRIBUTE_COLORS[entry.attribute] ?? "#d8dee8", stroke: ATTRIBUTE_COLORS[entry.attribute] ?? "#d8dee8" }}
                  >
                    <title>
                      {PLAYER_ATTRIBUTE_CHART_LABELS[entry.attribute as keyof typeof PLAYER_ATTRIBUTE_CHART_LABELS] ?? entry.attribute}: {formatChartValue(point.value)} ({point.row.seasonName})
                    </title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
          <div className="player-attribute-progress-attribute-legend">
            {attributeChart.series.map((entry) => (
              <span key={`legend-${entry.attribute}`} className="player-attribute-progress-attribute-legend-item">
                <i style={{ backgroundColor: ATTRIBUTE_COLORS[entry.attribute] ?? "#d8dee8" }} />
                {PLAYER_ATTRIBUTE_CHART_LABELS[entry.attribute as keyof typeof PLAYER_ATTRIBUTE_CHART_LABELS] ?? entry.attribute}
              </span>
            ))}
          </div>
          <div className="player-attribute-progress-labels">
            {attributeHistoryRows.map((row) => (
              <span key={`attr-label-${row.seasonId}`} className={row.isActiveSeason ? "is-live" : undefined}>
                {row.seasonName}
              </span>
            ))}
          </div>
        </ProgressChartCollapsible>
      ) : null}

      {ppMetricCharts.length > 0 ? (
        <ProgressChartCollapsible
          testId="player-attribute-progress-pp-bars"
          title="PP-Entwicklung"
          shellClassName="player-attribute-progress-bar-chart-shell"
          subtitle="Je Achse ein Block — Saisons direkt vergleichbar."
          defaultOpen
        >
          <div className="player-attribute-progress-pp-blocks">
            {/* Contract: data-testid="player-attribute-progress-pp-metric-pow" */}
            {ppMetricCharts.map((chart) => (
              <article
                key={`pp-metric-${chart.metric.id}`}
                className={`player-attribute-progress-pp-metric-block ${chart.metric.className}`}
                data-testid={chart.metric.id === "pow" ? "player-attribute-progress-pp-metric-pow" : `player-attribute-progress-pp-metric-${chart.metric.id}`}
              >
                <header className="player-attribute-progress-pp-metric-head">
                  <strong>{chart.metric.label}</strong>
                  <span className="muted">max {formatChartValue(chart.maxValue)}</span>
                </header>
                <svg
                  className="player-attribute-progress-pp-metric-svg"
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-label={`${chart.metric.label} PP je Saison`}
                >
                  <line
                    x1={28}
                    y1={chart.height - chart.paddingBottom}
                    x2={chart.width - 10}
                    y2={chart.height - chart.paddingBottom}
                    className="player-attribute-progress-axis"
                  />
                  {chart.bars.map((bar) => (
                    <g key={`${chart.metric.id}-${bar.row.seasonId ?? bar.row.seasonName}`}>
                      {bar.height > 0 ? (
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          className={`player-attribute-progress-bar ${chart.metric.className}`}
                          rx={2}
                        >
                          <title>
                            {chart.metric.label}: {formatChartValue(bar.value)} ({bar.row.seasonName})
                          </title>
                        </rect>
                      ) : null}
                      <text
                        x={bar.centerX}
                        y={bar.height > 0 ? bar.y - 4 : chart.paddingTop + chart.innerHeight / 2}
                        textAnchor="middle"
                        className={`player-attribute-progress-value-label${bar.value == null ? " is-empty" : ""}`}
                      >
                        {formatChartValue(bar.value)}
                      </text>
                      <text
                        x={bar.centerX}
                        y={chart.height - 10}
                        textAnchor="middle"
                        className={`player-attribute-progress-season-label${bar.row.isActiveSeason ? " is-live" : ""}`}
                      >
                        {formatSeasonShortLabel(bar.row.seasonName, bar.row.seasonId)}
                      </text>
                    </g>
                  ))}
                </svg>
              </article>
            ))}
          </div>
        </ProgressChartCollapsible>
      ) : null}

      {attributeHistoryRows.length > 0 ? (
        <div data-testid="player-attribute-progress-attribute-table">
        <ProgressChartCollapsible
          testId="player-attribute-progress-attribute-table"
          title="Attribut-Tabelle"
          subtitle="Saisonwerte und Deltas je Kernattribut."
        >
          <div className="table-shell player-attribute-progress-table-shell">
          <table className="team-table player-attribute-progress-table player-attribute-progress-attribute-table">
            <thead>
              <tr>
                <th>Saison</th>
                {PLAYER_ATTRIBUTE_CHART_KEYS.map((attribute) => (
                  <th key={`attr-head-${attribute}`}>{PLAYER_ATTRIBUTE_CHART_LABELS[attribute]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attributeHistoryRows.map((row, rowIndex) => (
                <tr key={`attr-row-${row.seasonId}`}>
                  <td>
                    <strong>{row.seasonName}</strong>
                    {row.isActiveSeason ? <small className="player-drawer-history-tag">live</small> : null}
                  </td>
                  {PLAYER_ATTRIBUTE_CHART_KEYS.map((attribute) => {
                    const value = row.attributes[attribute];
                    const previous = rowIndex > 0 ? attributeHistoryRows[rowIndex - 1]?.attributes[attribute] : null;
                    const delta =
                      value != null && previous != null && Number.isFinite(value) && Number.isFinite(previous)
                        ? Number((value - previous).toFixed(1))
                        : null;
                    return (
                      <td key={`${row.seasonId}-${attribute}`}>
                        {formatChartValue(value)}
                        {delta != null && delta !== 0 ? (
                          <small className={delta > 0 ? "text-positive" : "text-negative"}>
                            {" "}
                            ({delta > 0 ? "+" : ""}
                            {formatChartValue(delta)})
                          </small>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </ProgressChartCollapsible>
        </div>
      ) : null}

      <ProgressChartCollapsible
        testId="player-attribute-progress-pp-table"
        title="PP-Tabelle"
        subtitle="Gesamt-PPs, OVR und Achsen-PPs je Saison inkl. Liga-Rang."
        defaultOpen
      >
        <div className="table-shell player-attribute-progress-table-shell">
        <table className="team-table player-attribute-progress-table">
          <thead>
            <tr>
              <th>Saison</th>
              <th className="player-drawer-history-axis is-neutral">PPs</th>
              <th className="player-drawer-history-axis is-neutral">OVR</th>
              {PP_METRICS.map((option) => (
                <th key={option.id} className={`player-drawer-history-axis ${option.className}`}>
                  {option.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={`${row.seasonId ?? row.seasonName}`}>
                <td>
                  <strong>{row.seasonName}</strong>
                  {row.isActiveSeason ? <small className="player-drawer-history-tag">live</small> : null}
                </td>
                <td className="player-drawer-history-axis is-neutral">
                  {formatPpTableMetric(resolveHistoryPps(row), row.ppsRank)}
                </td>
                <td className="player-drawer-history-axis is-neutral">{formatPpTableMetric(row.ovr, row.ovrRank)}</td>
                {PP_METRICS.map((option) => (
                  <td key={`${row.seasonName}-${option.id}`} className={`player-drawer-history-axis ${option.className}`}>
                    {formatPpTableMetric(row[option.id], row[option.rankKey])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </ProgressChartCollapsible>
    </div>
  );
}
