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
 * Phase 2 (Differentiator-Analytics):
 * - Werte / Liga-Perzentil-Umschalter (Feature 1): im Perzentil-Modus plottet
 *   der Radar je Achse das Liga-Perzentil (aus `leaguePlayerHeatPools`) statt
 *   des Rohwerts ("Form = Standing"); Metriken mit echtem Pool bekommen in der
 *   Tabelle eine ton-gefärbte `NlProgressBar` (Füllung = Perzentil).
 * - Ähnliche Spieler (Feature 2): clientseitiger Nächste-Nachbarn-Lauf über die
 *   sichtbaren Achsen POW/SPE/MEN/SOC; Klick nimmt einen Treffer in den
 *   Vergleich auf. FOG: nie PO/Potenzial fremder Spieler.
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
 * mit dem Kit). Der Umschalter reused `.nl-phub-metric-*` (Analyse-Hub).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

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
  NlProgressBar,
  NlRadar,
  type NlAxisKey,
  type NlRadarAxisDef,
  type NlRadarSeries,
  type NlTone,
} from "@/components/foundation/new-look";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import {
  formatLeaguePercentile,
  getPoolHeatTone,
  type LeaguePlayerHeatPools,
} from "@/lib/foundation/player-league-heat";
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

/** Achsen für Ähnlichkeits-Suche (Feature 2) — bewusst NUR die sichtbaren POW/SPE/MEN/SOC, nie verdecktes PO/Potenzial (Fog of War). */
const SIMILAR_AXES: readonly NlAxisKey[] = ["pow", "spe", "men", "soc"];
/** Kleiner Ähnlichkeits-Bonus (Distanz × Faktor) für Spieler derselben Klasse — gleiche Klasse rutscht so leicht nach vorn. */
const SIMILAR_SAME_CLASS_FACTOR = 0.92;
/** Wie viele ähnliche Spieler im Fuß des Overlays gelistet werden. */
const SIMILAR_LIMIT = 5;

/** Darstellungsmodus des Vergleichs: Rohwerte (Standard) oder Liga-Perzentil ("Form = Standing", FBref-Stil). */
type CompareValueMode = "value" | "percentile";

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

/**
 * Metrik → ligaweiter Heat-Pool (Feature 1). Nur Kennzahlen MIT echtem Pool
 * (OVR/PPs/MVS + Achsen POW/SPE/MEN/SOC) bekommen ein Perzentil; für Geld-/
 * Karriere-/CA-Zeilen ohne Pool wird nichts erfunden (`null` → Rohwert-Fallback).
 */
function getStatPool(key: CompareStatKey, pools: LeaguePlayerHeatPools): number[] | null {
  switch (key) {
    case "ovr":
      return pools.ovr;
    case "pps":
      return pools.pps;
    case "mvs":
      return pools.mvs;
    case "pow":
      return pools.pow;
    case "spe":
      return pools.spe;
    case "men":
      return pools.men;
    case "soc":
      return pools.soc;
    default:
      return null;
  }
}

/** Ligaweiter Rang eines Werts im Heat-Pool (1 = bester) — gleiche Zählweise wie `getLeagueRank` im Verzeichnis. */
function leagueRankOf(value: number | null | undefined, pool: number[]): number | null {
  if (value == null || !Number.isFinite(value) || pool.length === 0) {
    return null;
  }
  let higher = 0;
  for (const entry of pool) {
    if (entry > value) {
      higher += 1;
    }
  }
  return higher + 1;
}

/**
 * Liga-Perzentil eines Werts als 0–100 (höher = besser), gleiche Konvention wie
 * `getLeagueRank`+`formatLeaguePercentile` im Verzeichnis: Perzentil =
 * (1 − (Rang−1)/Poolgröße) · 100. `null`, wenn kein valider Wert/Pool vorliegt.
 */
function leaguePercentileValue(value: number | null | undefined, pool: number[]): number | null {
  const rank = leagueRankOf(value, pool);
  if (rank == null) {
    return null;
  }
  return Math.max(0, Math.min(100, (1 - (rank - 1) / pool.length) * 100));
}

export type FoundationPlayersCompareOverlayProps = {
  open: boolean;
  onClose: () => void;
  /** Ausgewählte Zeilen in Auswahl-Reihenfolge, 2–4 Spieler. */
  rows: FoundationPlayerScopeRow[];
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  onRemove: (playerId: string) => void;
  /** Ligaweite Heat-Pools (bereits geladen) — Basis für den Perzentil-Modus (Feature 1). */
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  /** Vollständige (Umfang-gefilterte) Verzeichnis-Zeilen — Grundgesamtheit der Ähnlichkeits-Suche (Feature 2). */
  allRows: FoundationPlayerScopeRow[];
  /** Fügt einen Spieler dem Vergleich hinzu (Klick auf "Ähnliche Spieler"). */
  onAddToCompare: (playerId: string) => void;
};

export default function FoundationPlayersCompareOverlay({
  open,
  onClose,
  rows,
  openPlayerDrawerById,
  onRemove,
  leaguePlayerHeatPools,
  allRows,
  onAddToCompare,
}: FoundationPlayersCompareOverlayProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  // Rohwerte (Standard) vs. Liga-Perzentil ("shape = standing", Feature 1).
  const [valueMode, setValueMode] = useState<CompareValueMode>("value");
  // Klassenschnitt-Ghost im Radar (Sofascore "average player") — standardmäßig sichtbar, faint.
  const [showClassAverage, setShowClassAverage] = useState(true);

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

  /**
   * `NlRadar`-Mehrserien-Input: eine Serie je verglichenem Spieler. Im
   * Perzentil-Modus (Feature 1) trägt jede Achse ihr Liga-Perzentil (0–100)
   * statt des Rohwerts — dadurch bedeutet die Radar-Form direkt "Liga-Standing".
   * Die Pools (POW/SPE/MEN/SOC) sind sichtbare Achsen, kein verdecktes PO.
   */
  const radarSeries = useMemo<NlRadarSeries[]>(
    () =>
      series.map(({ row, tone }, index) => ({
        id: row.player.id,
        label: row.player.name,
        tone,
        dashPattern: COMPARE_SERIES_DASH[index] ?? "none",
        values:
          valueMode === "percentile"
            ? {
                pow: leaguePercentileValue(row.player.coreStats.pow, leaguePlayerHeatPools.pow),
                spe: leaguePercentileValue(row.player.coreStats.spe, leaguePlayerHeatPools.spe),
                men: leaguePercentileValue(row.player.coreStats.men, leaguePlayerHeatPools.men),
                soc: leaguePercentileValue(row.player.coreStats.soc, leaguePlayerHeatPools.soc),
              }
            : {
                pow: row.player.coreStats.pow ?? null,
                spe: row.player.coreStats.spe ?? null,
                men: row.player.coreStats.men ?? null,
                soc: row.player.coreStats.soc ?? null,
              },
      })),
    [series, valueMode, leaguePlayerHeatPools],
  );

  /**
   * Klassenschnitt-Ghost (Feature 3, Sofascore "average player") — Durchschnitt
   * von POW/SPE/MEN/SOC ALLER Spieler der Klasse des ersten (Anker-)Spielers,
   * rein aus den bereits geladenen `allRows`. FOG: nur sichtbare Achsen, nie
   * PO/Potenzial. `null`, wenn keine Klasse/keine Werte vorliegen. `count` für
   * den Tooltip; die Rohschnitte werden je nach Modus zusätzlich ins Perzentil
   * übersetzt (gleiche Skala wie die Spieler-Serien im Perzentil-Modus).
   */
  const classAverage = useMemo(() => {
    const anchor = compareRows[0];
    const className = anchor?.player.className;
    if (!className) {
      return null;
    }
    const classRows = allRows.filter((row) => row.player.className === className);
    const sums: Record<NlAxisKey, { total: number; count: number }> = {
      pow: { total: 0, count: 0 },
      spe: { total: 0, count: 0 },
      men: { total: 0, count: 0 },
      soc: { total: 0, count: 0 },
    };
    for (const row of classRows) {
      for (const axis of RADAR_AXIS_ORDER) {
        const value = row.player.coreStats[axis];
        if (value != null && Number.isFinite(value)) {
          sums[axis].total += value;
          sums[axis].count += 1;
        }
      }
    }
    // Nur zeichnen, wenn jede Achse mindestens einen realen Wert hat — keine 0-Auffüllung erfinden.
    if (RADAR_AXIS_ORDER.some((axis) => sums[axis].count === 0)) {
      return null;
    }
    const averages: Record<NlAxisKey, number> = {
      pow: sums.pow.total / sums.pow.count,
      spe: sums.spe.total / sums.spe.count,
      men: sums.men.total / sums.men.count,
      soc: sums.soc.total / sums.soc.count,
    };
    return { className, count: classRows.length, averages };
  }, [compareRows, allRows]);

  /**
   * Ghost-Serie für den Radar: eine zusätzliche, neutral-getönte, gestrichelte
   * Serie hinter den Spieler-Polygonen (in `combinedRadarSeries` vorangestellt →
   * zuerst gezeichnet = im Hintergrund). Im Perzentil-Modus trägt sie das
   * Liga-Perzentil der Klassen-Durchschnitte (gleiche Skala wie die Spieler).
   */
  const classAverageSeries = useMemo<NlRadarSeries | null>(() => {
    if (!showClassAverage || !classAverage) {
      return null;
    }
    const { averages } = classAverage;
    return {
      id: "class-average",
      label: `Klassenschnitt · ${classAverage.className} (${classAverage.count})`,
      tone: "neutral",
      dashPattern: "3 3",
      values:
        valueMode === "percentile"
          ? {
              pow: leaguePercentileValue(averages.pow, leaguePlayerHeatPools.pow),
              spe: leaguePercentileValue(averages.spe, leaguePlayerHeatPools.spe),
              men: leaguePercentileValue(averages.men, leaguePlayerHeatPools.men),
              soc: leaguePercentileValue(averages.soc, leaguePlayerHeatPools.soc),
            }
          : { pow: averages.pow, spe: averages.spe, men: averages.men, soc: averages.soc },
    };
  }, [showClassAverage, classAverage, valueMode, leaguePlayerHeatPools]);

  // Ghost zuerst → hinter den Spieler-Polygonen; ohne Ghost unverändert.
  const combinedRadarSeries = useMemo<NlRadarSeries[]>(
    () => (classAverageSeries ? [classAverageSeries, ...radarSeries] : radarSeries),
    [classAverageSeries, radarSeries],
  );

  /**
   * Ähnliche Spieler (Feature 2) — clientseitiger Nächste-Nachbarn-Lauf über
   * die bereits geladenen `allRows`: je Achse (POW/SPE/MEN/SOC) am ligaweiten
   * Min/Max normalisiert, euklidische Distanz zum ersten ausgewählten Spieler
   * (Anker), kleiner Bonus für gleiche Klasse. FOG: ausschließlich sichtbare
   * Achsen — nie PO/Potenzial fremder Spieler. Bereits im Vergleich befindliche
   * Spieler werden übersprungen.
   */
  const similarPlayers = useMemo(() => {
    const anchor = compareRows[0];
    if (!anchor) {
      return [] as Array<{ row: FoundationPlayerScopeRow; distance: number }>;
    }
    const anchorValues = SIMILAR_AXES.map((axis) => anchor.player.coreStats[axis]);
    if (anchorValues.some((value) => value == null || !Number.isFinite(value))) {
      return [];
    }
    // Normalisierungs-Spannen je Achse aus dem ligaweiten Heat-Pool (min→max).
    const ranges = SIMILAR_AXES.map((axis) => {
      const pool = leaguePlayerHeatPools[axis].filter((entry) => Number.isFinite(entry));
      if (pool.length === 0) {
        return { min: 0, span: 100 };
      }
      const min = Math.min(...pool);
      const max = Math.max(...pool);
      return { min, span: max > min ? max - min : 1 };
    });
    const normalize = (values: Array<number | null | undefined>) =>
      values.map((value, index) => ((value ?? 0) - ranges[index]!.min) / ranges[index]!.span);
    const anchorNorm = normalize(anchorValues);
    const excluded = new Set(compareRows.map((row) => row.player.id));

    return allRows
      .filter((row) => !excluded.has(row.player.id))
      .map((row) => {
        const values = SIMILAR_AXES.map((axis) => row.player.coreStats[axis]);
        if (values.some((value) => value == null || !Number.isFinite(value))) {
          return null;
        }
        const candidateNorm = normalize(values);
        let sumSq = 0;
        for (let index = 0; index < candidateNorm.length; index += 1) {
          const delta = candidateNorm[index]! - anchorNorm[index]!;
          sumSq += delta * delta;
        }
        let distance = Math.sqrt(sumSq);
        if (row.player.className && row.player.className === anchor.player.className) {
          distance *= SIMILAR_SAME_CLASS_FACTOR; // kleiner Bonus für gleiche Klasse
        }
        return { row, distance };
      })
      .filter((entry): entry is { row: FoundationPlayerScopeRow; distance: number } => entry != null)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMILAR_LIMIT);
  }, [compareRows, allRows, leaguePlayerHeatPools]);

  const compareFull = compareRows.length >= 4;

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
          {/* Werte / Liga-Perzentil (Feature 1) — segmentierter Umschalter, gleiches
              Vokabular wie die Kennzahl-Leiste im Analyse-Hub (nl-phub-metric-bar). */}
          <div className="nl-phub-metric-bar" role="group" aria-label="Darstellung: Rohwerte oder Liga-Perzentil">
            <button
              type="button"
              className={`nl-phub-metric-btn${valueMode === "value" ? " is-active" : ""}`}
              onClick={() => setValueMode("value")}
              aria-pressed={valueMode === "value"}
              title="Rohwerte (0–100) anzeigen"
            >
              Werte
            </button>
            <button
              type="button"
              className={`nl-phub-metric-btn${valueMode === "percentile" ? " is-active" : ""}`}
              onClick={() => setValueMode("percentile")}
              aria-pressed={valueMode === "percentile"}
              title="Liga-Perzentil anzeigen — Form = Liga-Standing"
            >
              Liga-Perzentil
            </button>
          </div>
          {/* Klassenschnitt-Ghost umschalten (Feature 3) — nur anbieten, wenn ein
              Durchschnitt existiert. Inline-Styles statt neuer globals.css-Klasse. */}
          {classAverage ? (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "var(--nl-fs-xs)",
                color: "var(--nl-mut)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title={`Durchschnitt aller ${classAverage.count} Spieler der Klasse ${classAverage.className} als Ghost-Polygon`}
            >
              <input
                type="checkbox"
                checked={showClassAverage}
                onChange={(event) => setShowClassAverage(event.target.checked)}
              />
              Klassenschnitt
            </label>
          ) : null}
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
            series={combinedRadarSeries}
            aria-label={
              valueMode === "percentile"
                ? `Achsen-Radar (Liga-Perzentil) POW/SPE/MEN/SOC: ${series
                    .map(({ row }) => row.player.name)
                    .join(" · ")}`
                : `Achsen-Radar POW/SPE/MEN/SOC: ${series
                    .map(
                      ({ row }) =>
                        `${row.player.name} — ${RADAR_AXIS_ORDER.map(
                          (key) => `${NL_AXIS_LABELS[key]} ${formatNlNumber(row.player.coreStats[key] ?? null, 0)}`,
                        ).join(", ")}`,
                    )
                    .join(" · ")}`
            }
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
                            // Perzentil-Modus (Feature 1): Metriken MIT echtem Liga-Pool bekommen
                            // eine ton-gefärbte NlProgressBar (Füllung = Perzentil), toniert über
                            // getPoolHeatTone. Pool-lose Zeilen (Geld/Karriere/CA) fallen auf den
                            // Rohwert zurück — es wird kein Perzentil erfunden.
                            const percentilePool =
                              valueMode === "percentile" ? getStatPool(statRow.key, leaguePlayerHeatPools) : null;
                            const percentile =
                              percentilePool && percentilePool.length > 0
                                ? leaguePercentileValue(value, percentilePool)
                                : null;
                            if (percentilePool && percentile != null) {
                              const rank = leagueRankOf(value, percentilePool);
                              const percentileLabel = formatLeaguePercentile(rank, percentilePool.length);
                              return (
                                <td key={row.player.id} className={isBest ? "is-best" : undefined}>
                                  <NlProgressBar
                                    value={percentile}
                                    max={100}
                                    tone={getPoolHeatTone(value, percentilePool)}
                                    showValue
                                    format={() => percentileLabel ?? "—"}
                                    title={`${statRow.label}: ${percentileLabel ?? "—"} (Rang #${rank ?? "—"} von ${percentilePool.length})`}
                                  />
                                </td>
                              );
                            }
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

        {/* Ähnliche Spieler (Feature 2) — Fuß des Overlays. Klick fügt den Spieler
            dem Vergleich hinzu (bis max. 4). Reine Client-Berechnung über die
            sichtbaren Achsen; kein Perzentil/PO fremder Spieler wird geleakt. */}
        {similarPlayers.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--nl-s2)" }}>
            <span className="nl-pcompare-eyebrow">
              Ähnliche Spieler{compareRows[0] ? ` · wie ${compareRows[0].player.name}` : ""}
            </span>
            <ul className="nl-pcompare-legend" aria-label="Ähnliche Spieler">
              {similarPlayers.map(({ row, distance }) => {
                // Distanz (0 = identisch, ~2 = maximal) grob in eine Ähnlichkeits-% für die Anzeige übersetzt.
                const similarity = Math.max(0, Math.min(100, Math.round((1 - distance / 2) * 100)));
                return (
                  <li key={row.player.id} className={`nl-pcompare-legend-item ${nlToneClass("neutral")}`}>
                    <button
                      type="button"
                      className="nl-pcompare-legend-name"
                      onClick={() => onAddToCompare(row.player.id)}
                      disabled={compareFull}
                      title={
                        compareFull
                          ? "Vergleich ist voll (max. 4 Spieler)"
                          : `${row.player.name} zum Vergleich hinzufügen · Ähnlichkeit ~${similarity}%`
                      }
                    >
                      + {row.player.name}
                    </button>
                    <span className="nl-pcompare-legend-sub">{row.team?.name ?? "Free Agent"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
