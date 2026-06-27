"use client";

import { useMemo, useState } from "react";

type HistoryPoint = {
  seasonId: string | null;
  seasonName: string;
  isActiveSeason: boolean;
  ovr: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
};

type ProgressMetric = "ovr" | "pow" | "spe" | "men" | "soc";

const METRIC_OPTIONS: Array<{ id: ProgressMetric; label: string; className: string }> = [
  { id: "ovr", label: "OVR", className: "is-neutral" },
  { id: "pow", label: "POW", className: "is-power" },
  { id: "spe", label: "SPE", className: "is-speed" },
  { id: "men", label: "MEN", className: "is-mental" },
  { id: "soc", label: "SOC", className: "is-social" },
];

type PlayerAttributeProgressChartProps = {
  historyRows: HistoryPoint[];
};

function formatChartValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
}

export default function PlayerAttributeProgressChart({ historyRows }: PlayerAttributeProgressChartProps) {
  const [metric, setMetric] = useState<ProgressMetric>("ovr");

  const sortedRows = useMemo(
    () =>
      [...historyRows].sort((left, right) => {
        const leftKey = left.seasonId ?? left.seasonName;
        const rightKey = right.seasonId ?? right.seasonName;
        return leftKey.localeCompare(rightKey, "de", { numeric: true });
      }),
    [historyRows],
  );

  const points = useMemo(
    () =>
      sortedRows
        .map((row) => ({
          label: row.seasonName,
          value: row[metric],
          isActiveSeason: row.isActiveSeason,
        }))
        .filter((entry): entry is { label: string; value: number; isActiveSeason: boolean } => entry.value != null && Number.isFinite(entry.value)),
    [metric, sortedRows],
  );

  const chartGeometry = useMemo(() => {
    if (points.length === 0) {
      return null;
    }

    const width = 640;
    const height = 180;
    const paddingX = 28;
    const paddingY = 20;
    const minValue = Math.min(...points.map((entry) => entry.value));
    const maxValue = Math.max(...points.map((entry) => entry.value));
    const valueSpan = Math.max(maxValue - minValue, 1);
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;

    const coordinates = points.map((entry, index) => {
      const x = paddingX + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
      const y = paddingY + innerHeight - ((entry.value - minValue) / valueSpan) * innerHeight;
      return { ...entry, x, y };
    });

    const polyline = coordinates.map((entry) => `${entry.x},${entry.y}`).join(" ");

    return {
      width,
      height,
      coordinates,
      polyline,
      minValue,
      maxValue,
    };
  }, [points]);

  const activeMetric = METRIC_OPTIONS.find((entry) => entry.id === metric) ?? METRIC_OPTIONS[0];

  if (points.length === 0) {
    return (
      <div className="player-attribute-progress-chart player-attribute-progress-chart-empty" data-testid="player-attribute-progress-chart">
        <h4>Entwicklungsverlauf</h4>
        <p className="muted">Noch keine Saison-Daten für eine Verlaufsgrafik. Nach dem ersten Saisonabschluss erscheinen OVR und Achsenpunkte hier.</p>
      </div>
    );
  }

  return (
    <div className="player-attribute-progress-chart" data-testid="player-attribute-progress-chart">
      <div className="player-attribute-progress-chart-head">
        <h4>Entwicklungsverlauf</h4>
        <div className="player-attribute-progress-chart-metrics" role="tablist" aria-label="Metrik wählen">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={metric === option.id}
              className={`player-attribute-progress-metric${metric === option.id ? " is-active" : ""} player-drawer-history-axis ${option.className}`}
              onClick={() => setMetric(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {chartGeometry ? (
        <div className="player-attribute-progress-chart-shell">
          <svg
            className={`player-attribute-progress-svg ${activeMetric.className}`}
            viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
            role="img"
            aria-label={`${activeMetric.label} Verlauf über ${points.length} Seasons`}
          >
            <line
              x1={28}
              y1={chartGeometry.height - 20}
              x2={chartGeometry.width - 28}
              y2={chartGeometry.height - 20}
              className="player-attribute-progress-axis"
            />
            <polyline points={chartGeometry.polyline} className="player-attribute-progress-line" />
            {chartGeometry.coordinates.map((entry) => (
              <g key={`${entry.label}-${entry.value}`}>
                <circle cx={entry.x} cy={entry.y} r={4} className="player-attribute-progress-dot" />
                <title>
                  {entry.label}: {formatChartValue(entry.value)}
                  {entry.isActiveSeason ? " (live)" : ""}
                </title>
              </g>
            ))}
          </svg>
          <div className="player-attribute-progress-labels">
            {chartGeometry.coordinates.map((entry) => (
              <span key={`label-${entry.label}`} className={entry.isActiveSeason ? "is-live" : undefined}>
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="table-shell player-attribute-progress-table-shell">
        <table className="team-table player-attribute-progress-table">
          <thead>
            <tr>
              <th>Saison</th>
              {METRIC_OPTIONS.map((option) => (
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
                {METRIC_OPTIONS.map((option) => (
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
