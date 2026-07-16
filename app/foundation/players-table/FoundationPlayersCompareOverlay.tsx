"use client";

/**
 * Vergleichs-Overlay (additiv, "Neuer Look") — 2 bis 4 Spieler aus dem
 * Verzeichnis nebeneinander: Achsen-Radar (POW/SPE/MEN/SOC, überlagert, je
 * Spieler eine Farbe) + kompakte Kennzahlen-Tabelle in Gruppen (Kern-
 * Kennzahlen OVR/CA/PPs/MVS/MW/Gehalt, Achsen-Werte POW/SPE/MEN/SOC als
 * Zahlen, Saison-Einsätze sowie ein eigener "All-Time/Karriere"-Block mit
 * Karriere-PPs/-Einsätzen/-Saisons, Restlaufzeit und bester Disziplin —
 * #112), bester Wert je (hervorhebbarer) Zeile markiert. Rein clientseitig
 * aus den bereits geladenen Verzeichnis-`rows` — kein Fetch, keine neue
 * Datenquelle. Auswahl passiert per Checkbox je Tabellenzeile in
 * `FoundationPlayersTableNewLook.tsx` (`comparePlayerIds`, max. 4).
 *
 * Overlay-Mechanik (ESC/Backdrop/Fokus-Falle) spiegelt `NlRankingDrawer`
 * (`components/foundation/new-look/NlRankingDrawer.tsx`) — nur als
 * zentriertes Panel statt Seiten-Drawer, weil hier deutlich mehr Breite
 * für Radar + Tabelle nebeneinander gebraucht wird. Der Radar selbst nutzt
 * den generischen Mehrserien-Modus von `NlRadar` (`axisDefs` + `series`,
 * bis zu vier überlagerte Polygone mit eigener Tonfarbe + solid/dashed) —
 * ersetzt das vormals hier handgerollte SVG (gleiche Geometrie-Schule wie
 * `NlRadar`, jetzt aber im Kit selbst).
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-pcompare-*` (Panel/
 * Legende/Tabelle) sowie `.nl-radar*`/`.nl-radar-*-series` (Radar, geteilt
 * mit dem Kit).
 */

import { Fragment, useEffect, useMemo, useRef } from "react";

import {
  getPlayerDisplayMarketValue,
  getPlayerDisplaySalary,
  getRosterEntryDisplaySalary,
} from "@/app/foundation/foundation-page-client-exports";
import {
  formatNlMoney,
  formatNlNumber,
  nlToneClass,
  NL_AXIS_LABELS,
  NlRadar,
  type NlAxisKey,
  type NlRadarAxisDef,
  type NlRadarSeries,
  type NlTone,
} from "@/components/foundation/new-look";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import { computeCurrentAbilityScore } from "@/lib/scouting/current-ability-score";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

const RADAR_AXIS_ORDER: NlAxisKey[] = ["pow", "spe", "men", "soc"];
const RADAR_AXIS_DEFS: NlRadarAxisDef[] = RADAR_AXIS_ORDER.map((key) => ({ key, label: NL_AXIS_LABELS[key] }));

/** Bis zu 4 unterscheidbare Serienfarben — bestehende Ton-Tokens statt neu erfundener Hex-Werte. */
const COMPARE_SERIES_TONES: NlTone[] = ["accent", "good", "warn", "risk"];
/**
 * Je Serie ein EIGENES Linienmuster (solid / dash / dot / dash-dot) statt nur
 * "solid vs. gestrichelt". Vorher trugen Serie 2 (good=grün) und Serie 4
 * (risk=rot) dasselbe Dash — genau das Rot-Grün-Paar, das Farbenblinde am
 * ehesten verwechseln, war so nur über die Farbe trennbar (Colorblind-Audit).
 * Distinkte Muster machen die Serien auch ohne Hue unterscheidbar.
 */
const COMPARE_SERIES_DASH = ["none", "6 4", "2 3", "10 4 2 4"];

type CompareStatKey =
  | "ovr"
  | "ca"
  | "pps"
  | "mvs"
  | "mw"
  | "salary"
  | "pow"
  | "spe"
  | "men"
  | "soc"
  | "appearances"
  | "allTimePps"
  | "careerAppearances"
  | "careerSeasons"
  | "contractLength"
  | "bestDiscipline";

type CompareStatRowDef = {
  key: CompareStatKey;
  label: string;
  digits?: number;
  money?: boolean;
  /** Gehalt: niedriger ist besser (gleiche Konvention wie der Gehalts-Delta-Chip in der Tabelle). */
  lowerIsBetter?: boolean;
  /** Keine "bester Wert"-Hervorhebung — Restlaufzeit (länger ist nicht per se besser) und Text-Zeilen. */
  noHighlight?: boolean;
  /** Text-Zeile (z. B. "Beste Disziplin") — kein Zahlenwert, keine Formatierung/Bestwert-Logik. */
  text?: boolean;
};

type CompareGroup = {
  id: string;
  /** Optionale Zwischenüberschrift, z. B. um die All-Time-/Karriere-Zeilen als eigenen Block zu lesen. */
  heading?: string;
  rows: readonly CompareStatRowDef[];
};

/**
 * Vergleichs-Zeilen in Gruppen (#112 — mehr Stats inkl. All-Time-Perspektive,
 * Produkt-Feedback "vielleicht noch paar Stats mehr die interessant sein
 * könnten auch aus All-Time Sicht"). Alle Werte kommen aus bereits auf
 * `FoundationPlayerScopeRow` vorhandenen Feldern — keine neue Datenquelle.
 */
const COMPARE_GROUPS: readonly CompareGroup[] = [
  {
    id: "core",
    rows: [
      { key: "ovr", label: "OVR", digits: 1 },
      { key: "ca", label: "CA", digits: 1 },
      { key: "pps", label: "PPs", digits: 1 },
      { key: "mvs", label: "MVS", digits: 1 },
      { key: "mw", label: "MW", digits: 2, money: true },
      { key: "salary", label: "Gehalt", digits: 2, money: true, lowerIsBetter: true },
    ],
  },
  {
    id: "axes",
    heading: "Achsen",
    rows: [
      { key: "pow", label: "POW", digits: 0 },
      { key: "spe", label: "SPE", digits: 0 },
      { key: "men", label: "MEN", digits: 0 },
      { key: "soc", label: "SOC", digits: 0 },
    ],
  },
  {
    id: "season",
    heading: "Saison",
    rows: [{ key: "appearances", label: "Einsätze", digits: 0 }],
  },
  {
    id: "career",
    heading: "All-Time / Karriere",
    rows: [
      { key: "allTimePps", label: "All-Time-PPs", digits: 1 },
      { key: "careerAppearances", label: "Karriere-Einsätze", digits: 0 },
      { key: "careerSeasons", label: "Karriere-Saisons", digits: 0 },
      { key: "contractLength", label: "Restlaufzeit", digits: 0, noHighlight: true },
      { key: "bestDiscipline", label: "Beste Disziplin", noHighlight: true, text: true },
    ],
  },
];

function getCompareStatValue(row: FoundationPlayerScopeRow, key: CompareStatKey): number | null {
  switch (key) {
    case "ovr":
      return row.playerOvr;
    case "ca":
      return computeCurrentAbilityScore(row.player.coreStats);
    case "pps":
      return row.playerPps;
    case "mvs":
      return row.playerMvs;
    case "mw":
      return getPlayerDisplayMarketValue(row.player);
    case "salary":
      return row.roster ? getRosterEntryDisplaySalary(row.roster, row.player) : getPlayerDisplaySalary(row.player);
    case "pow":
      return row.player.coreStats.pow ?? null;
    case "spe":
      return row.player.coreStats.spe ?? null;
    case "men":
      return row.player.coreStats.men ?? null;
    case "soc":
      return row.player.coreStats.soc ?? null;
    case "appearances":
      return row.appearances;
    case "allTimePps":
      return row.careerLeagueStats?.totalPps ?? null;
    case "careerAppearances":
      return row.careerLeagueStats?.appearances ?? null;
    case "careerSeasons":
      return row.careerLeagueStats?.seasonsPlayed ?? null;
    case "contractLength":
      return row.roster?.contractLength ?? null;
    default:
      return null;
  }
}

/** Text-Zeilen (aktuell nur "Beste Disziplin") — getrennt von `getCompareStatValue`, da kein Zahlenwert/Bestwert. */
function getCompareTextValue(row: FoundationPlayerScopeRow, key: CompareStatKey): string | null {
  switch (key) {
    case "bestDiscipline":
      return row.bestDiscipline ?? null;
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

  /** `NlRadar`-Mehrserien-Input: eine Serie je verglichenem Spieler. */
  const radarSeries = useMemo<NlRadarSeries[]>(
    () =>
      series.map(({ row, tone }, index) => ({
        id: row.player.id,
        label: row.player.name,
        tone,
        dashPattern: COMPARE_SERIES_DASH[index] ?? "none",
        values: {
          pow: row.player.coreStats.pow ?? null,
          spe: row.player.coreStats.spe ?? null,
          men: row.player.coreStats.men ?? null,
          soc: row.player.coreStats.soc ?? null,
        },
      })),
    [series],
  );

  const bestByStat = useMemo(() => {
    const result = new Map<CompareStatKey, number>();
    for (const group of COMPARE_GROUPS) {
      for (const statRow of group.rows) {
        if (statRow.text || statRow.noHighlight) {
          continue;
        }
        const values = compareRows
          .map((row) => getCompareStatValue(row, statRow.key))
          .filter((value): value is number => value != null && Number.isFinite(value));
        if (values.length === 0) {
          continue;
        }
        result.set(statRow.key, statRow.lowerIsBetter ? Math.min(...values) : Math.max(...values));
      }
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
          {series.map(({ row, tone }, index) => (
            <li key={row.player.id} className={`nl-pcompare-legend-item ${nlToneClass(tone)}`}>
              <span className="nl-pcompare-legend-swatch" aria-hidden="true">
                <svg viewBox="0 0 22 8" preserveAspectRatio="none">
                  <line
                    x1="1"
                    y1="4"
                    x2="21"
                    y2="4"
                    stroke="var(--nl-tone, var(--nl-accent))"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={
                      COMPARE_SERIES_DASH[index] && COMPARE_SERIES_DASH[index] !== "none"
                        ? COMPARE_SERIES_DASH[index]
                        : undefined
                    }
                  />
                </svg>
              </span>
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
          <NlRadar
            className="nl-pcompare-radar"
            axisDefs={RADAR_AXIS_DEFS}
            series={radarSeries}
            aria-label={`Achsen-Radar POW/SPE/MEN/SOC: ${series
              .map(
                ({ row }) =>
                  `${row.player.name} — ${RADAR_AXIS_ORDER.map(
                    (key) => `${NL_AXIS_LABELS[key]} ${formatNlNumber(row.player.coreStats[key] ?? null, 0)}`,
                  ).join(", ")}`,
              )
              .join(" · ")}`}
          />

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
                {COMPARE_GROUPS.map((group) => (
                  <Fragment key={group.id}>
                    {group.heading ? (
                      <tr className="nl-pcompare-group-heading">
                        <th scope="colgroup" colSpan={compareRows.length + 1}>
                          {group.heading}
                        </th>
                      </tr>
                    ) : null}
                    {group.rows.map((statRow) => {
                      const best = statRow.text || statRow.noHighlight ? undefined : bestByStat.get(statRow.key);
                      return (
                        <tr key={statRow.key}>
                          <th scope="row">{statRow.label}</th>
                          {compareRows.map((row) => {
                            if (statRow.text) {
                              const textValue = getCompareTextValue(row, statRow.key);
                              return <td key={row.player.id}>{textValue ?? "—"}</td>;
                            }
                            const value = getCompareStatValue(row, statRow.key);
                            const isBest =
                              !statRow.noHighlight && value != null && Number.isFinite(value) && best != null && value === best;
                            const formatted =
                              value == null || !Number.isFinite(value)
                                ? "—"
                                : statRow.money
                                  ? formatNlMoney(value)
                                  : formatNlNumber(value, statRow.digits ?? 0);
                            return (
                              <td key={row.player.id} className={isBest ? "is-best" : undefined}>
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
