"use client";

import { useMemo } from "react";

import {
  buildAttributeHistoryDelta,
  PLAYER_ATTRIBUTE_CHART_KEYS,
  PLAYER_ATTRIBUTE_CHART_LABELS,
  type PlayerAttributeHistoryRow,
} from "@/lib/foundation/player-attribute-history";
import type { PlayerProgressHistoryRow } from "@/lib/foundation/player-progress-summary";
import {
  buildPlayerProgressSummary,
  formatProgressDelta,
  sortPlayerProgressHistoryRows,
} from "@/lib/foundation/player-progress-summary";

type PlayerAttributeProgressChartProps = {
  historyRows: PlayerProgressHistoryRow[];
  attributeHistoryRows?: PlayerAttributeHistoryRow[];
};

const PP_METRICS = [
  { id: "pow" as const, label: "POW", className: "is-power" },
  { id: "spe" as const, label: "SPE", className: "is-speed" },
  { id: "men" as const, label: "MEN", className: "is-mental" },
  { id: "soc" as const, label: "SOC", className: "is-social" },
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

function buildPpBarChartGeometry(rows: PlayerProgressHistoryRow[]) {
  const width = 560;
  const height = 220;
  const paddingLeft = 42;
  const paddingRight = 16;
  const paddingTop = 18;
  const paddingBottom = 42;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const values = rows.flatMap((row) => PP_METRICS.map((metric) => row[metric.id]).filter((value): value is number => value != null && Number.isFinite(value)));
  const maxValue = Math.max(...values, 1);
  const groupWidth = innerWidth / Math.max(rows.length, 1);
  const barWidth = Math.min(14, groupWidth / (PP_METRICS.length + 1));

  const groups = rows.map((row, rowIndex) => {
    const groupX = paddingLeft + rowIndex * groupWidth + groupWidth / 2;
    const bars = PP_METRICS.map((metric, metricIndex) => {
      const value = row[metric.id];
      const barHeight = value != null && Number.isFinite(value) ? (value / maxValue) * innerHeight : 0;
      const x = groupX - ((PP_METRICS.length * barWidth) / 2) + metricIndex * (barWidth + 2);
      const y = paddingTop + innerHeight - barHeight;
      return {
        metric,
        value,
        x,
        y,
        width: barWidth,
        height: barHeight,
      };
    });
    return {
      row,
      groupX,
      bars,
    };
  });

  return { width, height, paddingTop, paddingBottom, innerHeight, maxValue, groups };
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
  const ppChart = useMemo(() => (sortedRows.length > 0 ? buildPpBarChartGeometry(sortedRows) : null), [sortedRows]);
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
        <div className="player-attribute-progress-line-chart-shell is-focused" data-testid="player-attribute-progress-str-line">
          <div className="player-attribute-progress-chart-subhead">
            <h5>STR (Power)</h5>
            <p className="muted">
              Entwicklung über {attributeHistoryRows.length} Saisons
              {strChart.delta != null ? (
                <>
                  {" "}
                  · Bilanz {strChart.delta > 0 ? "+" : ""}
                  {formatChartValue(strChart.delta)}
                </>
              ) : null}
            </p>
          </div>
          <svg
            className="player-attribute-progress-line-chart-svg is-focused"
            viewBox={`0 0 ${strChart.width} ${strChart.height}`}
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
        </div>
      ) : null}

      {attributeChart ? (
        <div className="player-attribute-progress-line-chart-shell" data-testid="player-attribute-progress-attribute-lines">
          <div className="player-attribute-progress-chart-subhead">
            <h5>Attribute</h5>
            <p className="muted">Liniendiagramm der Kernattribute über die Saisons.</p>
          </div>
          <svg
            className="player-attribute-progress-line-chart-svg"
            viewBox={`0 0 ${attributeChart.width} ${attributeChart.height}`}
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
        </div>
      ) : null}

      {ppChart ? (
        <div className="player-attribute-progress-bar-chart-shell" data-testid="player-attribute-progress-pp-bars">
          <div className="player-attribute-progress-chart-subhead">
            <h5>PP-Entwicklung</h5>
            <p className="muted">Alle Achsen-PPs je Saison im Säulendiagramm.</p>
          </div>
          <svg
            className="player-attribute-progress-bar-chart-svg"
            viewBox={`0 0 ${ppChart.width} ${ppChart.height}`}
            role="img"
            aria-label="PP-Entwicklung über Saisons"
          >
            <text x={4} y={ppChart.height - ppChart.paddingBottom + 4} className="player-attribute-progress-y-tick">
              0
            </text>
            <text x={4} y={ppChart.paddingTop + 4} className="player-attribute-progress-y-tick">
              {formatChartValue(ppChart.maxValue)}
            </text>
            <line
              x1={42}
              y1={ppChart.height - ppChart.paddingBottom}
              x2={ppChart.width - 16}
              y2={ppChart.height - ppChart.paddingBottom}
              className="player-attribute-progress-axis"
            />
            {ppChart.groups.map((group) => (
              <g key={`pp-group-${group.row.seasonId ?? group.row.seasonName}`}>
                {group.bars.map((bar) => (
                  <rect
                    key={`${group.row.seasonName}-${bar.metric.id}`}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    className={`player-attribute-progress-bar ${bar.metric.className}`}
                    rx={2}
                  >
                    <title>
                      {bar.metric.label}: {formatChartValue(bar.value)} ({group.row.seasonName})
                    </title>
                  </rect>
                ))}
                <text
                  x={group.groupX}
                  y={ppChart.height - 12}
                  textAnchor="middle"
                  className={`player-attribute-progress-season-label${group.row.isActiveSeason ? " is-live" : ""}`}
                >
                  {group.row.seasonName}
                </text>
              </g>
            ))}
          </svg>
          <div className="player-attribute-progress-pp-legend">
            {PP_METRICS.map((metric) => (
              <span key={`pp-legend-${metric.id}`} className={`player-attribute-progress-pp-legend-item ${metric.className}`}>
                {metric.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {attributeHistoryRows.length > 0 ? (
        <div className="table-shell player-attribute-progress-table-shell" data-testid="player-attribute-progress-attribute-table">
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
      ) : null}

      <div className="table-shell player-attribute-progress-table-shell">
        <table className="team-table player-attribute-progress-table">
          <thead>
            <tr>
              <th>Saison</th>
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
                <td className="player-drawer-history-axis is-neutral">{formatChartValue(row.ovr)}</td>
                {PP_METRICS.map((option) => (
                  <td key={`${row.seasonName}-${option.id}`} className={`player-drawer-history-axis ${option.className}`}>
                    {formatChartValue(row[option.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
