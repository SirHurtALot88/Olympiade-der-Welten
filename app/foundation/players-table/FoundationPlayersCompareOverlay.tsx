"use client";

/**
 * Vergleichs-Overlay (additiv, "Neuer Look") — 2 bis 4 Spieler aus dem
 * Verzeichnis nebeneinander: Achsen-Radar (POW/SPE/MEN/SOC, überlagert, je
 * Spieler eine Farbe) + kompakte Kennzahlen-Tabelle (OVR/PPs/MVS/MW/
 * Gehalt), bester Wert je Zeile hervorgehoben. Rein clientseitig aus den
 * bereits geladenen Verzeichnis-`rows` — kein Fetch, keine neue
 * Datenquelle. Auswahl passiert per Checkbox je Tabellenzeile in
 * `FoundationPlayersTableNewLook.tsx` (`comparePlayerIds`, max. 4).
 *
 * Overlay-Mechanik (ESC/Backdrop/Fokus-Falle) spiegelt `NlRankingDrawer`
 * (`components/foundation/new-look/NlRankingDrawer.tsx`) — nur als
 * zentriertes Panel statt Seiten-Drawer, weil hier deutlich mehr Breite
 * für Radar + Tabelle nebeneinander gebraucht wird. Handgerolltes SVG-Radar
 * (gleiche Geometrie-Schule wie `NlRadar`), weil `NlRadar` selbst nur ein
 * Haupt- + ein Ghost-Polygon zeichnet — hier werden bis zu vier Polygone
 * gleichzeitig mit eigener Tonfarbe gebraucht.
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-pcompare-*`.
 */

import { useEffect, useMemo, useRef } from "react";

import {
  getPlayerDisplayMarketValue,
  getPlayerDisplaySalary,
  getRosterEntryDisplaySalary,
} from "@/app/foundation/foundation-page-client-exports";
import { formatNlMoney, formatNlNumber, nlToneClass, NL_AXIS_LABELS, type NlAxisKey, type NlTone } from "@/components/foundation/new-look";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

const RADAR_AXIS_ORDER: NlAxisKey[] = ["pow", "spe", "men", "soc"];
const RADAR_SIZE = 240;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 84;
const RADAR_RINGS = [0.25, 0.5, 0.75, 1];

function radarPoint(axisIndex: number, ratio: number) {
  const angle = (axisIndex / RADAR_AXIS_ORDER.length) * Math.PI * 2 - Math.PI / 2;
  return {
    x: RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS * ratio,
    y: RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS * ratio,
  };
}

/** Bis zu 4 unterscheidbare Serienfarben — bestehende Ton-Tokens statt neu erfundener Hex-Werte. */
const COMPARE_SERIES_TONES: NlTone[] = ["accent", "good", "warn", "risk"];

type CompareStatKey = "ovr" | "pps" | "mvs" | "mw" | "salary";

const COMPARE_STAT_ROWS: ReadonlyArray<{
  key: CompareStatKey;
  label: string;
  digits: number;
  money?: boolean;
  /** Gehalt: niedriger ist besser (gleiche Konvention wie der Gehalts-Delta-Chip in der Tabelle). */
  lowerIsBetter?: boolean;
}> = [
  { key: "ovr", label: "OVR", digits: 1 },
  { key: "pps", label: "PPs", digits: 1 },
  { key: "mvs", label: "MVS", digits: 1 },
  { key: "mw", label: "MW", digits: 2, money: true },
  { key: "salary", label: "Gehalt", digits: 2, money: true, lowerIsBetter: true },
];

function getCompareStatValue(row: FoundationPlayerScopeRow, key: CompareStatKey): number | null {
  switch (key) {
    case "ovr":
      return row.playerOvr;
    case "pps":
      return row.playerPps;
    case "mvs":
      return row.playerMvs;
    case "mw":
      return getPlayerDisplayMarketValue(row.player);
    case "salary":
      return row.roster ? getRosterEntryDisplaySalary(row.roster, row.player) : getPlayerDisplaySalary(row.player);
    default:
      return null;
  }
}

export type FoundationPlayersCompareOverlayProps = {
  open: boolean;
  onClose: () => void;
  /** Ausgewählte Zeilen in Auswahl-Reihenfolge, 2–4 Spieler. */
  rows: FoundationPlayerScopeRow[];
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  onRemove: (playerId: string) => void;
};

export default function FoundationPlayersCompareOverlay({
  open,
  onClose,
  rows,
  openPlayerDrawerById,
  onRemove,
}: FoundationPlayersCompareOverlayProps) {
  const dialogRef = useRef<HTMLElement | null>(null);

  // ESC schließt, wie beim PlayerDetailDrawer/NlRankingDrawer (nur aktiv, solange offen).
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useFocusTrap(open, dialogRef);

  const compareRows = useMemo(() => rows.slice(0, 4), [rows]);

  const series = useMemo(
    () => compareRows.map((row, index) => ({ row, tone: COMPARE_SERIES_TONES[index] ?? ("neutral" as NlTone) })),
    [compareRows],
  );

  const radarGeometry = useMemo(
    () =>
      series.map(({ row, tone }) => {
        const points = RADAR_AXIS_ORDER.map((key, index) => {
          const raw = row.player.coreStats[key] ?? null;
          const value = raw != null && Number.isFinite(raw) ? raw : 0;
          const ratio = Math.max(0, Math.min(value / 100, 1));
          return { key, value: raw, ...radarPoint(index, ratio) };
        });
        return {
          row,
          tone,
          polygon: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
          points,
        };
      }),
    [series],
  );

  const bestByStat = useMemo(() => {
    const result = new Map<CompareStatKey, number>();
    for (const statRow of COMPARE_STAT_ROWS) {
      const values = compareRows
        .map((row) => getCompareStatValue(row, statRow.key))
        .filter((value): value is number => value != null && Number.isFinite(value));
      if (values.length === 0) {
        continue;
      }
      result.set(statRow.key, statRow.lowerIsBetter ? Math.min(...values) : Math.max(...values));
    }
    return result;
  }, [compareRows]);

  if (!open) {
    return null;
  }

  if (compareRows.length < 2) {
    return (
      <div className="nl-pcompare-backdrop" role="presentation" onClick={onClose}>
        <div
          className="nl-pcompare-panel nl-pcompare-panel-empty"
          role="dialog"
          aria-modal="true"
          aria-label="Spielervergleich"
          onClick={(event) => event.stopPropagation()}
        >
          <p>Mindestens 2 Spieler auswählen, um zu vergleichen.</p>
          <button type="button" className="nl-pcompare-close" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nl-pcompare-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="nl-pcompare-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Spielervergleich: ${compareRows.map((row) => row.player.name).join(", ")}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="nl-pcompare-head">
          <div className="nl-pcompare-head-copy">
            <span className="nl-pcompare-eyebrow">Vergleich</span>
            <h3 className="nl-pcompare-title">{compareRows.length} Spieler</h3>
          </div>
          <button type="button" className="nl-pcompare-close" onClick={onClose}>
            Schließen
          </button>
        </header>

        <ul className="nl-pcompare-legend" aria-label="Verglichene Spieler">
          {series.map(({ row, tone }) => (
            <li key={row.player.id} className={`nl-pcompare-legend-item ${nlToneClass(tone)}`}>
              <span className="nl-pcompare-legend-swatch" aria-hidden="true" />
              <button
                type="button"
                className="nl-pcompare-legend-name"
                onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                title={`${row.player.name} öffnen`}
              >
                {row.player.name}
              </button>
              <span className="nl-pcompare-legend-sub">{row.team?.name ?? "Free Agent"}</span>
              {compareRows.length > 2 ? (
                <button
                  type="button"
                  className="nl-pcompare-legend-remove"
                  onClick={() => onRemove(row.player.id)}
                  aria-label={`${row.player.name} aus dem Vergleich entfernen`}
                  title="Aus dem Vergleich entfernen"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="nl-pcompare-body">
          <svg
            className="nl-pcompare-radar"
            viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Achsen-Radar POW/SPE/MEN/SOC: ${radarGeometry
              .map(
                ({ row, points }) =>
                  `${row.player.name} — ${points
                    .map((point) => `${NL_AXIS_LABELS[point.key]} ${formatNlNumber(point.value, 0)}`)
                    .join(", ")}`,
              )
              .join(" · ")}`}
          >
            {RADAR_RINGS.map((ring) => (
              <polygon
                key={`nl-pcompare-ring-${ring}`}
                points={RADAR_AXIS_ORDER.map((_, index) => {
                  const point = radarPoint(index, ring);
                  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                }).join(" ")}
                className="nl-pcompare-radar-ring"
                fill="none"
              />
            ))}
            {RADAR_AXIS_ORDER.map((key, index) => {
              const outer = radarPoint(index, 1);
              return (
                <line
                  key={`nl-pcompare-spoke-${key}`}
                  x1={RADAR_CENTER}
                  y1={RADAR_CENTER}
                  x2={outer.x}
                  y2={outer.y}
                  className="nl-pcompare-radar-spoke"
                />
              );
            })}
            {radarGeometry.map(({ row, tone, polygon }) => (
              <polygon key={row.player.id} points={polygon} className={`nl-pcompare-radar-shape ${nlToneClass(tone)}`} />
            ))}
            {radarGeometry.map(({ row, tone, points }) =>
              points.map((point) => (
                <circle
                  key={`${row.player.id}-${point.key}`}
                  cx={point.x}
                  cy={point.y}
                  r={3}
                  className={`nl-pcompare-radar-dot ${nlToneClass(tone)}`}
                >
                  <title>
                    {row.player.name} · {NL_AXIS_LABELS[point.key]}: {formatNlNumber(point.value, 0)}
                  </title>
                </circle>
              )),
            )}
            {RADAR_AXIS_ORDER.map((key, index) => {
              const label = radarPoint(index, 1.28);
              return (
                <text
                  key={`nl-pcompare-label-${key}`}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="nl-pcompare-radar-label"
                >
                  {NL_AXIS_LABELS[key]}
                </text>
              );
            })}
          </svg>

          <div className="nl-pcompare-table-wrap">
            <table className="nl-pcompare-table nl-tnum">
              <thead>
                <tr>
                  <th scope="col">Kennzahl</th>
                  {series.map(({ row, tone }) => (
                    <th key={row.player.id} scope="col" className={nlToneClass(tone)}>
                      {row.player.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_STAT_ROWS.map((statRow) => {
                  const best = bestByStat.get(statRow.key);
                  return (
                    <tr key={statRow.key}>
                      <th scope="row">{statRow.label}</th>
                      {compareRows.map((row) => {
                        const value = getCompareStatValue(row, statRow.key);
                        const isBest = value != null && Number.isFinite(value) && best != null && value === best;
                        const formatted =
                          value == null || !Number.isFinite(value)
                            ? "—"
                            : statRow.money
                              ? formatNlMoney(value)
                              : formatNlNumber(value, statRow.digits);
                        return (
                          <td key={row.player.id} className={isBest ? "is-best" : undefined}>
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
