"use client";

import { useMemo, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { getPlayerPortraitModel } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { EmptyState } from "@/components/foundation/EmptyState";
import { NlCard, NlDeltaChip, StatChip, StatChipRow, formatNlNumber, useCountUp } from "@/components/foundation/new-look";
import { NlAbilityStars, VeloIntensityRail, buildTrainingModeSegments, formatVeloNumber, formatVeloSignedNumber } from "@/components/foundation/velo-ui";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import { sortTrainingAttributeForecastByClassProfile } from "@/lib/training/training-forecast-display";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import type { TrainingCompactClientProps } from "@/app/foundation/training-compact/TrainingCompactClient";
import type {
  TrainingAttributeForecastEntry,
  TrainingDevelopmentFilter,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";
import {
  TrainingBudgetBreakdownDisclosure,
  buildTrainingClassGainRanking,
  buildTrainingClassSuggestion,
  buildTrainingIntensityProjection,
  formatSignedPercent,
  getDevelopmentTone,
} from "@/app/foundation/training-facilities-v2/training-view-shared";

/**
 * "Neuer Look" Training — flag-gated, additiv (nur wenn `useNewLook` aktiv ist).
 *
 * Konsumiert exakt dieselben Props wie `TrainingCompactClient` und ruft nur die
 * echten Handler auf (`onSetTrainingMode`, `onSetTrainingClass`,
 * `onSetDevelopmentFilter`, `onOpenPlayerDetails`, `onOpenFacilities`, `onOpenTeams`).
 *
 * Bewusst weggelassen (keine echten Daten/Handler dafür):
 * - kein Compare-Panel (reines Erklär-Panel, im neuen Look ersetzt durch die
 *   Team-Intensitäts-Vorschau aus denselben `trainingModeOptions`-Werten),
 * - kein numerischer Potential-Wert pro Attribut in den Props — der Cap-Marker
 *   nutzt daher den echten `ceilingState`/`headroomLabel` (capped/closing).
 */

const DEVELOPMENT_FILTERS: Array<{ id: TrainingDevelopmentFilter; label: string; hint: string }> = [
  {
    id: "growth",
    label: "Upgrade bereit",
    hint: "Netto-Forecast ≥ +2 SP: Training + Performance übersteigen die Regression deutlich über die Saison. Kein Sofort-Upgrade, sondern die Saisonend-Tendenz.",
  },
  {
    id: "regression",
    label: "Risiko",
    hint: "Netto-Forecast negativ ODER hohes Rückschritt-Risiko: Regression überwiegt bereits Training + Performance oder droht das zu tun.",
  },
  {
    id: "stable",
    label: "Stabil",
    hint: "Netto-Forecast zwischen 0 und +2 SP ohne hohes Risiko — Training gleicht die laufende Regression etwa aus.",
  },
  { id: "all", label: "Alle", hint: "Kompletter Kader" },
];

type NlTrainingGlyphKind = "recommend" | "wish" | "signature" | "weak" | "risk" | "trait";

/** Konsistentes Inline-SVG-Icon-Set statt gemischter Emoji (💡/⚑/★/▼/◆). */
function NlTrainingGlyph({ kind }: { kind: NlTrainingGlyphKind }) {
  const shared = {
    width: 12,
    height: 12,
    viewBox: "0 0 16 16",
    "aria-hidden": true as const,
    focusable: false as const,
    className: "nl-training-glyph",
  };
  switch (kind) {
    case "recommend":
      // Glühbirne (KI-Empfehlung)
      return (
        <svg {...shared}>
          <path
            d="M8 1.5a4.5 4.5 0 0 0-2.6 8.17c.45.33.7.75.76 1.23h3.68c.06-.48.31-.9.76-1.23A4.5 4.5 0 0 0 8 1.5Z"
            fill="currentColor"
          />
          <path d="M6.4 12.2h3.2v1a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1v-1Z" fill="currentColor" opacity="0.65" />
        </svg>
      );
    case "wish":
      // Fahne (Trainingswunsch)
      return (
        <svg {...shared}>
          <path d="M4 1.5v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 2.5h7l-1.8 2.5L12 7.5H5v-5Z" fill="currentColor" />
        </svg>
      );
    case "signature":
    case "trait":
      // Stern (Signature-Attribut / Trait-Boost)
      return (
        <svg {...shared}>
          <path
            d="M8 1.6 9.9 5.5l4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.6Z"
            fill="currentColor"
          />
        </svg>
      );
    case "weak":
      // Raute (Weak-Attribut)
      return (
        <svg {...shared}>
          <path d="M8 1.8 14.2 8 8 14.2 1.8 8 8 1.8Z" fill="currentColor" />
        </svg>
      );
    case "risk":
      // Warn-Dreieck (Regression/Risiko)
      return (
        <svg {...shared}>
          <path d="M8 1.8 15 13.8H1L8 1.8Z" fill="currentColor" />
          <path d="M8 6v4" stroke="var(--nl-bg, #0e1420)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.9" fill="var(--nl-bg, #0e1420)" />
        </svg>
      );
    default:
      return null;
  }
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function getToneBadgeLabel(tone: ReturnType<typeof getDevelopmentTone>) {
  if (tone === "growth") return "steigt";
  if (tone === "regression") return "kann fallen";
  return "stabil";
}

/**
 * #49 — Angewendete Training-/Performance-/Regressions-Summe direkt aus den
 * echten Attribut-Forecast-Einträgen (dieselbe Rechnung wie
 * `buildTrainingBudgetBreakdown`, hier nur ohne die Schritt-Liste).
 */
function getAppliedTotals(row: TrainingPlayerRowView) {
  let training = 0;
  let performance = 0;
  let regression = 0;
  for (const entry of row.attributeForecast) {
    training += entry.training;
    performance += entry.performance;
    regression += entry.regression;
  }
  return { training, performance, regression };
}

/**
 * #49 — "kann fallen" self-explanatory machen: WARUM kann das Attribut-Set
 * fallen (Regression übersteigt Training+Performance) und WAS fehlt zum
 * Halten (nötige zusätzliche Performance/Training-SP, damit Netto ≥ 0 wird).
 * Nutzt ausschließlich echte, bereits berechnete Felder — keine neue Formel.
 */
function getToneBadgeTooltip(row: TrainingPlayerRowView, tone: ReturnType<typeof getDevelopmentTone>): string {
  if (tone === "growth") {
    return `Wächst (Upgrade bereit): Netto-Forecast ${formatVeloSignedNumber(row.organicForecast.netSetpoints, 1)} SP ≥ +2 SP — Training + Performance übersteigen die Regression über die Saison deutlich.`;
  }
  if (tone === "regression") {
    const { training, performance, regression } = getAppliedTotals(row);
    const net = row.organicForecast.netSetpoints;
    if (net < 0) {
      return `Kann fallen: Regression ${formatVeloNumber(regression, 1)} SP übersteigt Training (+${formatVeloNumber(training, 1)}) + Performance (+${formatVeloNumber(performance, 1)}). Um zu halten fehlen ca. ${formatVeloNumber(Math.abs(net), 1)} SP mehr aus Training oder Performance.`;
    }
    return `Kann fallen: Netto-Forecast noch ${formatVeloSignedNumber(net, 1)} SP im Plus, aber Rückschritt-Risiko hoch (Regressions-Druck ${formatVeloNumber(row.forecast.regressionPressure, 0)}). Steigt der Druck weiter oder sinkt Training/Performance, kippt der Forecast ins Minus.`;
  }
  return `Stabil: Netto-Forecast ${formatVeloSignedNumber(row.organicForecast.netSetpoints, 1)} SP zwischen 0 und +2 — Training gleicht die laufende Regression etwa aus.`;
}

/** Sanftes Scrollen respektiert `prefers-reduced-motion` statt es zu ignorieren. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type TrainingSortKey = "default" | "net" | "risk" | "training" | "performance" | "name";

const TRAINING_SORT_OPTIONS: Array<{ id: TrainingSortKey; label: string }> = [
  { id: "default", label: "Standard" },
  { id: "net", label: "Netto-Forecast" },
  { id: "risk", label: "Rückschritt-Risiko" },
  { id: "training", label: "Trainingsplan" },
  { id: "performance", label: "Performance" },
  { id: "name", label: "Name" },
];

/** Sortiert eine Kopie der echten Kader-Zeilen nach real vorhandenen Feldern. */
function sortTrainingPlayerRows(rows: TrainingPlayerRowView[], sortKey: TrainingSortKey): TrainingPlayerRowView[] {
  if (sortKey === "default") return rows;
  const sorted = [...rows];
  switch (sortKey) {
    case "net":
      sorted.sort((left, right) => right.organicForecast.netSetpoints - left.organicForecast.netSetpoints);
      break;
    case "risk":
      sorted.sort((left, right) => right.forecast.regressionPressure - left.forecast.regressionPressure);
      break;
    case "training":
      sorted.sort((left, right) => right.trainingXp - left.trainingXp);
      break;
    case "performance":
      sorted.sort((left, right) => right.performanceXp - left.performanceXp);
      break;
    case "name":
      sorted.sort((left, right) => left.player.name.localeCompare(right.player.name, "de"));
      break;
    default:
      break;
  }
  return sorted;
}

/**
 * Haupt-Takeaway pro Spieler (immer sichtbar): Netto-Delta + Hauptgrund.
 * Nutzt dieselben echten Forecast-Felder wie die bisherige "Warum?"-Disclosure.
 */
function getCoreTakeaway(row: TrainingPlayerRowView): string {
  if (row.organicForecast.netSetpoints < 0) {
    const missing = Math.abs(row.organicForecast.netSetpoints);
    return `Regression drückt stärker als Training + Performance — es fehlen ca. ${formatVeloNumber(missing, 1)} SP zum Halten.`;
  }
  if (row.forecast.regressionRisk === "high") {
    return `Wächst noch, aber hohes Rückschritt-Risiko (Druck ${formatVeloNumber(row.forecast.regressionPressure, 0)}) — kippt der Druck weiter, fällt das Netto ins Minus.`;
  }
  if (row.organicForecast.netSetpoints >= 2) {
    return "Training und Performance überwiegen deutlich — Upgrade in Reichweite.";
  }
  return "Entwicklung stabil — Training gleicht die laufende Regression aus.";
}

/**
 * Attribut-Forecast als Bar (jetzt → Prognose) statt Zahlenmatrix.
 * Grün = Wachstum, Rot = Rückschritt; Cap-Marker aus dem echten
 * `ceilingState` (Potential-Decke erreicht/fast erreicht). Rohzahlen
 * wandern in Sekundärtext + Tooltip.
 */
function NlTrainingForecastBar({
  entry,
  scaleMax,
}: {
  entry: TrainingAttributeForecastEntry;
  scaleMax: number;
}) {
  const from = Number.isFinite(entry.before) ? Math.max(0, entry.before) : 0;
  const to = Number.isFinite(entry.after) ? Math.max(0, entry.after) : 0;
  const base = Math.min(from, to);
  const growth = entry.delta > 0;
  const regression = entry.delta < 0;
  const basePct = Math.min(100, (base / scaleMax) * 100);
  const deltaPct = Math.min(100 - basePct, (Math.abs(to - from) / scaleMax) * 100);
  const capMarker = entry.ceilingState === "capped" || entry.ceilingState === "closing";
  const capPct = Math.min(100, (Math.max(from, to) / scaleMax) * 100);
  const tooltip = `${entry.attribute}: ${formatVeloNumber(entry.before, 1)} → ${formatVeloNumber(entry.after, 1)} (${formatVeloSignedNumber(entry.delta, 1)}) · T ${formatVeloSignedNumber(entry.training, 1)} · P ${formatVeloSignedNumber(entry.performance, 1)} · R ${formatVeloSignedNumber(entry.regression, 1)}${
    entry.ceilingState === "capped"
      ? " · Potential erreicht"
      : entry.ceilingState === "closing"
        ? ` · Potential fast erreicht (${entry.headroomLabel ?? "eng"})`
        : ""
  }${regression ? ` · kann fallen: fehlen ca. ${formatVeloNumber(Math.abs(entry.delta), 1)} SP (Training+Performance) zum Halten` : ""}`;

  return (
    <div
      className={`nl-training-forecast-row${growth ? " is-growth" : regression ? " is-regression" : ""}`}
      title={tooltip}
    >
      <span className="nl-training-forecast-label">
        {entry.attribute}
        {entry.affinity === "signature" ? (
          <span className="nl-training-affinity is-signature" title="Signature-Attribut">
            <NlTrainingGlyph kind="signature" />
          </span>
        ) : null}
        {entry.affinity === "weak" ? (
          <span className="nl-training-affinity is-weak" title="Weak-Attribut">
            <NlTrainingGlyph kind="weak" />
          </span>
        ) : null}
      </span>
      <div className="nl-training-forecast-track" aria-hidden="true">
        <span className="nl-training-forecast-base" style={{ width: `${basePct}%` }} />
        {deltaPct > 0 ? (
          <span
            className={`nl-training-forecast-delta${regression ? " is-regression" : ""}`}
            style={{ left: `${basePct}%`, width: `${Math.max(deltaPct, 0.75)}%` }}
          />
        ) : null}
        {capMarker ? (
          <span
            className={`nl-training-forecast-cap${entry.ceilingState === "capped" ? " is-capped" : " is-closing"}`}
            style={{ left: `${capPct}%` }}
            title={
              entry.ceilingState === "capped"
                ? "Potential erreicht"
                : `Potential fast erreicht (${entry.headroomLabel ?? "eng"})`
            }
          />
        ) : null}
      </div>
      <span className="nl-training-forecast-numbers nl-tnum">
        {formatVeloNumber(entry.before, 1)} → {formatVeloNumber(entry.after, 1)}
      </span>
      <NlDeltaChip value={entry.delta} format={(n) => formatVeloSignedNumber(n, 1)} className="nl-training-forecast-chip" />
    </div>
  );
}

/** Potential-Trainingsspeed als Tonstufe — macht hohes Potential auf einen Blick sichtbar. */
function getPotentialTone(multiplier: number): "high" | "good" | "neutral" | "low" {
  if (multiplier >= 1.12) return "high";
  if (multiplier >= 1.03) return "good";
  if (multiplier >= 0.98) return "neutral";
  return "low";
}

/**
 * D1/D2 — Pro-Spieler, pro-Intensität Trainings-Prognose. Zeigt für Leicht/Mittel/Hart
 * den erwarteten Zuwachs "durch Training" (potentialgetrieben, daher pro Spieler
 * unterschiedlich) plus die konstante Regression und den projizierten Netto-Wert.
 */
function NlTrainingIntensityProjection({
  row,
  trainingModeOptions,
  readOnly,
  demandMode,
  onSelectMode,
}: {
  row: TrainingPlayerRowView;
  trainingModeOptions: TrainingCompactClientProps["trainingModeOptions"];
  readOnly: boolean;
  demandMode: PlayerTrainingMode | null;
  onSelectMode: (mode: PlayerTrainingMode) => void;
}) {
  const projection = useMemo(
    () => buildTrainingIntensityProjection(row, trainingModeOptions),
    [row, trainingModeOptions],
  );
  const potentialMultiplier = row.modifiers.potentialTrainingMultiplier;
  const potentialTone = getPotentialTone(potentialMultiplier);
  const best = projection.reduce((max, entry) => Math.max(max, entry.trainingGain), 0.01);

  return (
    <div
      className="nl-training-intensity is-selectable"
      data-testid="nl-training-intensity"
      role="radiogroup"
      aria-label="Trainingsintensität wählen"
    >
      <div className="nl-training-intensity-head">
        <span className="nl-training-intensity-title">
          Intensität {readOnly ? "" : <span className="nl-training-intensity-hint-inline">· tippen zum Wählen</span>}
        </span>
        <span
          className={`nl-training-potential is-${potentialTone}`}
          title="Potential-Trainingsspeed: höheres Potential ⇒ mehr Zuwachs pro Intensität. Dieser Faktor steckt in jeder Prognose unten."
        >
          <NlTrainingGlyph kind="signature" /> Potential ×{formatVeloNumber(potentialMultiplier, 2)}
        </span>
      </div>
      <div className="nl-training-intensity-rows">
        {projection.map((entry) => (
          <button
            type="button"
            key={`intensity-${row.player.id}-${entry.mode}`}
            className={`nl-training-intensity-row${entry.isCurrent ? " is-current" : ""}${
              demandMode === entry.mode && !entry.isCurrent ? " is-demand" : ""
            }`}
            role="radio"
            aria-checked={entry.isCurrent}
            disabled={readOnly}
            onClick={() => onSelectMode(entry.mode as PlayerTrainingMode)}
            title={`${entry.label} wählen: +${formatVeloNumber(entry.trainingGain, 1)} durch Training · Regression ${formatVeloSignedNumber(entry.regression, 1)} · Netto ${formatVeloSignedNumber(entry.net, 1)} SP · Fatigue-Last ${formatVeloNumber(entry.fatigueLoad, 0)} · Erholungs-Tempo ${formatSignedPercent(entry.recoveryDeltaPct)} (Erholungs-Rate, nicht Fatigue-Last)`}
          >
            <span className="nl-training-intensity-label">
              {entry.label}
              {entry.isCurrent ? <span className="nl-training-intensity-current">aktiv</span> : null}
              {demandMode === entry.mode && !entry.isCurrent ? (
                <span className="nl-training-intensity-demand">will</span>
              ) : null}
            </span>
            <span className="nl-training-intensity-bar" aria-hidden="true">
              <span
                className="nl-training-intensity-fill"
                style={{ width: `${Math.min(100, (entry.trainingGain / best) * 100)}%` }}
              />
            </span>
            <span className="nl-training-intensity-gain nl-tnum" title="Erwarteter Zuwachs durch Training bei dieser Intensität">
              +{formatVeloNumber(entry.trainingGain, 1)} <small>Training</small>
            </span>
            <span
              className={`nl-training-intensity-recovery nl-tnum${entry.recoveryDeltaPct < 0 ? " is-negative" : entry.recoveryDeltaPct > 0 ? " is-positive" : ""}`}
              title="Erholungs-Tempo dieser Intensität (Erholungs-Rate, nicht Fatigue-Last) — Erholung ↔ Verletzungsrisiko-Trade-off"
            >
              {formatSignedPercent(entry.recoveryDeltaPct)} <small>Erholung</small>
            </span>
            <NlDeltaChip
              value={entry.net}
              format={(n) => `${formatVeloSignedNumber(n, 1)} SP`}
              className="nl-training-intensity-net"
            />
          </button>
        ))}
      </div>
      <small className="nl-training-intensity-foot nl-tnum">
        Regression konstant {formatVeloSignedNumber(projection[0]?.regression ?? 0, 1)} · höheres Potential ⇒ größerer
        Trainings-Zuwachs · höhere Intensität kostet Regeneration (Verletzungsrisiko steigt)
      </small>
    </div>
  );
}

/**
 * #53 — Top-4 Klassen nach geschätztem Trainings-SP-Zugewinn (siehe
 * `buildTrainingClassGainRanking` für die Herleitung). Die aktuell trainierte
 * Klasse wird, falls unter den Top-4, klar markiert ("aktiv").
 */
function NlTrainingClassRanking({
  row,
  trainingClassOptions,
  readOnly,
  onSelectClass,
}: {
  row: TrainingPlayerRowView;
  trainingClassOptions: TrainingCompactClientProps["trainingClassOptions"];
  readOnly: boolean;
  onSelectClass: (className: string) => void;
}) {
  const ranking = useMemo(
    () => buildTrainingClassGainRanking(row, trainingClassOptions, { limit: 4, includeCurrent: true }),
    [row, trainingClassOptions],
  );
  if (ranking.length === 0) return null;
  const best = ranking.reduce((max, entry) => Math.max(max, entry.estimatedGain), 0.01);
  const currentOutsideTop = ranking.some((entry) => entry.isCurrent && entry.rank > 4);

  return (
    <div
      className="nl-training-class-ranking is-selectable"
      data-testid="nl-training-class-ranking"
      role="radiogroup"
      aria-label="Trainingsklasse wählen — Top-4 plus deine aktuelle"
    >
      <span className="nl-training-class-ranking-title">
        Beste Klassen + deine aktuelle · SP-Zugewinn{" "}
        {readOnly ? "" : <span className="nl-training-intensity-hint-inline">· tippen zum Wählen</span>}
      </span>
      <div className="nl-training-class-ranking-rows">
        {ranking.map((entry) => (
          <button
            type="button"
            key={`class-rank-${row.player.id}-${entry.className}`}
            className={`nl-training-class-ranking-row${entry.isCurrent ? " is-current" : ""}${
              entry.isCurrent && currentOutsideTop ? " is-current-outside" : ""
            }`}
            role="radio"
            aria-checked={entry.isCurrent}
            disabled={readOnly}
            onClick={() => onSelectClass(entry.className)}
            title={`${entry.label} als Trainingsklasse wählen: Rang ${entry.rank} · ca. +${formatVeloNumber(entry.estimatedGain, 1)} SP geschätzt${
              entry.isCurrent ? " · wird aktuell trainiert" : ""
            } · Schätzung: Trainingsbudget (${formatVeloNumber(row.organicForecast.trainingSetpoints, 1)} SP) nach Klassen-Attributgewichtung verteilt, abgeschwächt an Attributen nahe der Potential-Decke und gewichtet nach Signature-/Weak-Attribut-Affinität sowie dem Development-Route-Bonus der Klasse. Reale Werte hängen zusätzlich von Performance-Anteil ab.${
              entry.hasFocusRouteBonus ? " · +8% Trainingsfokus-Bonus (Achse passt)" : ""
            }`}
          >
            <span className="nl-training-class-ranking-rank nl-tnum">{entry.rank}</span>
            <span className="nl-training-class-ranking-label">
              {entry.label}
              {entry.isCurrent ? <span className="nl-training-class-ranking-current">aktiv</span> : null}
              {entry.hasFocusRouteBonus ? (
                <span className="nl-training-class-ranking-focus-bonus" title="Trainingsfokus-Route-Bonus: +8%">
                  +8% Fokus
                </span>
              ) : null}
            </span>
            <span className="nl-training-class-ranking-bar" aria-hidden="true">
              <span
                className="nl-training-class-ranking-fill"
                style={{ width: `${Math.min(100, (entry.estimatedGain / best) * 100)}%` }}
              />
            </span>
            <span className="nl-training-class-ranking-value nl-tnum">≈+{formatVeloNumber(entry.estimatedGain, 1)} SP</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NlTrainingPlayerCard({
  row,
  trainingModeReadOnly,
  trainingModeOptions,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
}: {
  row: TrainingPlayerRowView;
  trainingModeReadOnly: boolean;
  trainingModeOptions: TrainingCompactClientProps["trainingModeOptions"];
  trainingClassOptions: TrainingCompactClientProps["trainingClassOptions"];
  onSetTrainingMode: TrainingCompactClientProps["onSetTrainingMode"];
  onSetTrainingClass: TrainingCompactClientProps["onSetTrainingClass"];
  onOpenPlayerDetails: TrainingCompactClientProps["onOpenPlayerDetails"];
}) {
  const [showAllAttributes, setShowAllAttributes] = useState(false);
  const tone = getDevelopmentTone(row);
  const classSuggestion = useMemo(
    () => buildTrainingClassSuggestion(row, trainingClassOptions),
    [row, trainingClassOptions],
  );
  // Label der Klasse, die aktuell tatsächlich trainiert wird (row.trainingClass — kann von
  // row.player.className abweichen, siehe "Trainingsklasse"-Select unten). Wird explizit als
  // "Trainiert:"-Seite im Vorschlags-Chip gezeigt, damit die Klasse nicht mit der oben gezeigten
  // Statprofil-Entwicklung (classBefore/classAfter) verwechselt werden kann.
  const currentTrainingClassLabel = useMemo(
    () => trainingClassOptions.find((option) => option.value === row.trainingClass)?.label ?? row.trainingClass,
    [row.trainingClass, trainingClassOptions],
  );
  const sortedForecast = useMemo(
    () => sortTrainingAttributeForecastByClassProfile(row.attributeForecast, row.trainingClass, row.adminBalancingConfig),
    [row.adminBalancingConfig, row.attributeForecast, row.trainingClass],
  );
  const visibleForecast = showAllAttributes ? sortedForecast : sortedForecast.slice(0, 5);
  const scaleMax = useMemo(() => {
    const peak = sortedForecast.reduce((max, entry) => Math.max(max, entry.before, entry.after), 0);
    return Math.max(20, Math.ceil((peak * 1.12) / 5) * 5);
  }, [sortedForecast]);

  const recommendedMode = row.recommendedTrainingMode ?? null;
  const recommendedPresentation = recommendedMode ? getTrainingModePresentation(recommendedMode) : null;
  const showRecommendation =
    recommendedMode != null && recommendedMode !== row.mode && row.recommendedTrainingMatchesCurrent === false;
  const demand = row.trainingDemand;
  const hasDemand = demand != null && demand.status !== "fulfilled";
  const hasTraitBoost = row.traitBoosts.length > 0 || row.modifiers.traitModifierPct !== 0;
  const isHighRisk = row.forecast.regressionRisk === "high";

  return (
    <article
      className={`nl-training-player nl-training-tone-${tone}`}
      id={`training-player-${row.player.id}`}
      data-testid="nl-training-player-card"
    >
      <header className="nl-training-player-head">
        {(() => {
          const portrait = getPlayerPortraitModel(row.player);
          return (
            <span className="nl-training-player-avatar">
              <OptimizedMediaImage
                className="nl-training-player-avatar-media"
                src={portrait.previewSrc ?? portrait.src}
                alt={`${row.player.name} Portrait`}
                fallbackLabel={portrait.initials || getInitials(row.player.name)}
                onErrorClassName="nl-training-player-avatar-media"
                loading="lazy"
              />
            </span>
          );
        })()}
        <div className="nl-training-player-copy">
          {onOpenPlayerDetails ? (
            <button
              type="button"
              className="nl-training-player-name-button"
              data-testid="training-player-profile-button"
              title={`${row.player.name} Profil öffnen`}
              onClick={() => onOpenPlayerDetails({ playerId: row.player.id, activePlayerId: row.entryId })}
            >
              {row.player.name}
            </button>
          ) : (
            <strong className="nl-training-player-name">{row.player.name}</strong>
          )}
          <small
            className="nl-training-player-class"
            title={
              row.organicForecast.classBefore === row.organicForecast.classAfter
                ? undefined
                : `Statprofil-Entwicklung über die Saison (nicht die Trainingsklasse): ${row.organicForecast.classBefore} → ${row.organicForecast.classAfter}. Trainiert wird aktuell als ${currentTrainingClassLabel}.`
            }
          >
            {row.organicForecast.classBefore === row.organicForecast.classAfter
              ? row.player.className
              : `${row.organicForecast.classBefore} → ${row.organicForecast.classAfter}`}
          </small>
          {row.developmentStars.currentAbilityStars != null ||
          row.developmentStars.currentAbilityRating != null ||
          row.developmentStars.potentialStars != null ||
          row.developmentStars.potentialRating != null ? (
            <NlAbilityStars
              caStars={row.developmentStars.currentAbilityStars}
              caScore={row.developmentStars.currentAbilityRating}
              poStars={row.developmentStars.potentialStars}
              poScore={row.developmentStars.potentialRating}
              known
              compact
              className="nl-training-player-stars"
              label="Fähigkeiten"
            />
          ) : null}
        </div>
        <span className={`nl-training-player-badge is-${tone} nl-training-hint`} title={getToneBadgeTooltip(row, tone)}>
          {getToneBadgeLabel(tone)}
        </span>
      </header>

      {/* Kern-Takeaway: Netto-Delta + Hauptgrund, immer sichtbar (de-nested). */}
      <div className="nl-training-takeaway" data-testid="nl-training-takeaway">
        <NlDeltaChip
          value={row.organicForecast.netSetpoints}
          format={(n) => `${formatVeloSignedNumber(n, 1)} SP`}
          title="Netto-Forecast: Training + Performance − Regression über alle 12 Attribute"
        />
        <p>{getCoreTakeaway(row)}</p>
      </div>
      <small className="nl-training-takeaway-split nl-tnum">
        Training +{formatVeloNumber(row.organicForecast.trainingSetpoints, 1)} · Performance +
        {formatVeloNumber(row.organicForecast.performanceSetpoints, 1)} · Fatigue{" "}
        {formatVeloNumber(row.organicForecast.fatigueLoad, 1)} ·{" "}
        <span
          className="nl-training-hint"
          title={`Strain-Risiko aus der aktuellen Intensität (${getTrainingModePresentation(row.mode).label}): Fatigue-Last ${formatVeloNumber(row.organicForecast.fatigueLoad, 1)}. ${row.fatigueWarning} Hart erhöht Fatigue und senkt Regeneration, Leicht senkt beides.`}
        >
          Risiko {row.forecast.fatigueStrain.label}
        </span>
      </small>

      <NlTrainingIntensityProjection
        row={row}
        trainingModeOptions={trainingModeOptions}
        readOnly={trainingModeReadOnly}
        demandMode={demand && demand.status !== "fulfilled" ? demand.preferredMode : null}
        onSelectMode={(mode) => onSetTrainingMode(row.player.id, mode)}
      />
      <NlTrainingClassRanking
        row={row}
        trainingClassOptions={trainingClassOptions}
        readOnly={trainingModeReadOnly}
        onSelectClass={(className) => onSetTrainingClass(row.player.id, className)}
      />

      {showRecommendation || hasTraitBoost || hasDemand || isHighRisk || classSuggestion ? (
        <div className="nl-training-chip-row" aria-label="Trainings-Hinweise">
          {classSuggestion ? (
            <span
              className="nl-training-chip is-class-suggest"
              data-testid="training-class-suggestion"
              title={`Klassen-Vorschlag: ${classSuggestion.label} passt am besten zu den Signature-Attributen ${classSuggestion.attributes.join(" + ")}. Trainiert wird aktuell als ${currentTrainingClassLabel}.`}
            >
              <NlTrainingGlyph kind="signature" /> Trainiert: {currentTrainingClassLabel} → Vorschlag: {classSuggestion.label}
            </span>
          ) : null}
          {showRecommendation && recommendedPresentation ? (
            <span
              className="nl-training-chip is-recommend"
              data-testid="training-ai-recommendation"
              title={`Empfohlen: ${recommendedPresentation.label}${row.recommendedTrainingDetail ? ` — ${row.recommendedTrainingDetail}` : ""}`}
            >
              <NlTrainingGlyph kind="recommend" /> {recommendedPresentation.label}
            </span>
          ) : null}
          {hasTraitBoost ? (
            <span
              className={`nl-training-chip is-trait${row.modifiers.traitModifierPct >= 0 ? " is-positive" : " is-negative"}`}
              title={
                row.traitBoosts
                  .map((entry) => `${entry.trait} ${entry.pct >= 0 ? "+" : ""}${formatVeloNumber(entry.pct, 1)}%`)
                  .join(" · ") || "Trait Training Boost"
              }
            >
              <NlTrainingGlyph kind="trait" /> {formatSignedPercent(row.modifiers.traitModifierPct)}
            </span>
          ) : null}
          {hasDemand && demand ? (
            <span
              className={`nl-training-chip is-wish is-${demand.status}`}
              title={`${demand.label} · will ${getTrainingModePresentation(demand.preferredMode).label} · Moral ${demand.moraleReward >= 0 ? "+" : ""}${demand.moraleReward}/${demand.moralePenalty} — ${demand.detail}`}
            >
              <NlTrainingGlyph kind="wish" /> will {getTrainingModePresentation(demand.preferredMode).label}
            </span>
          ) : null}
          {isHighRisk ? (
            <span
              className="nl-training-chip is-risk"
              title={`Rückschritt-Risiko hoch: Regressions-Druck ${formatVeloNumber(row.forecast.regressionPressure, 0)} (Alterung, Marktwert-Druck, Belastung). ${row.fatigueWarning} ${
                row.organicForecast.netSetpoints < 0
                  ? `Um zu halten fehlen ca. ${formatVeloNumber(Math.abs(row.organicForecast.netSetpoints), 1)} SP mehr aus Training/Performance.`
                  : `Aktuell noch +${formatVeloNumber(row.organicForecast.netSetpoints, 1)} SP im Plus, aber wackelig — steigt der Druck weiter, kippt der Forecast ins Minus.`
              }`}
            >
              <NlTrainingGlyph kind="risk" /> Rückschritt-Risiko
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="nl-training-forecast" data-testid="nl-training-forecast-bars" aria-label="Attribut-Forecast">
        {visibleForecast.map((entry) => (
          <NlTrainingForecastBar key={`${row.player.id}-${entry.attributeKey}`} entry={entry} scaleMax={scaleMax} />
        ))}
        {sortedForecast.length > 5 ? (
          <button
            type="button"
            className="nl-training-inline-button"
            onClick={() => setShowAllAttributes((current) => !current)}
          >
            {showAllAttributes ? "Weniger anzeigen" : `Alle ${sortedForecast.length} Stats`}
          </button>
        ) : null}
      </div>

      {/* Nur die Detail-Berechnung bleibt einklappbar (identische echte Werte). */}
      <TrainingBudgetBreakdownDisclosure row={row} />

      {/* Intensität + Klasse werden oben direkt in den Prognose-Zeilen gewählt
          (klickbar). Hier nur noch der Vollzugriff auf alle Klassen als Fallback,
          falls die Wunsch-Klasse nicht unter den Top-3 ist. */}
      <footer className="nl-training-player-controls">
        <div className="nl-training-player-foot">
          <label className="nl-training-class-select">
            <span>Andere Klasse</span>
            <select
              className="input"
              value={row.trainingClass}
              disabled={trainingModeReadOnly}
              onChange={(event) => onSetTrainingClass(row.player.id, event.target.value)}
            >
              {trainingClassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </footer>
    </article>
  );
}

export default function TrainingCompactNewLook({
  selectedTeam,
  selectedTeamControlMode,
  seasonLabel,
  managementLocked = false,
  managementLockedReason = null,
  summary,
  developmentFilter,
  developmentSummary,
  onSetDevelopmentFilter,
  trainingModeOptions,
  trainingClassOptions,
  playerRows,
  allPlayerCount,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
  onOpenFacilities,
  onOpenTeams,
}: TrainingCompactClientProps) {
  const trainingModeReadOnly = managementLocked;
  const [sortKey, setSortKey] = useState<TrainingSortKey>("default");
  const sortedPlayerRows = useMemo(() => sortTrainingPlayerRows(playerRows, sortKey), [playerRows, sortKey]);
  const modeSegments = useMemo(
    () =>
      buildTrainingModeSegments(
        trainingModeOptions.map((option) => ({
          value: option.value,
          label: option.label,
          trainingSetpoints: option.trainingSetpoints,
          baseXp: option.baseXp,
          recoveryDeltaPct: option.recoveryDeltaPct,
          fatigueLoad: option.fatigueLoad,
          note: option.note,
        })),
      ),
    [trainingModeOptions],
  );

  const teamModeCounts = useMemo(
    () =>
      playerRows.reduce(
        (counts, row) => {
          counts[row.mode] += 1;
          return counts;
        },
        { leicht: 0, mittel: 0, hart: 0 } as Record<PlayerTrainingMode, number>,
      ),
    [playerRows],
  );

  const uniformTeamMode =
    playerRows.length > 0 && playerRows.every((row) => row.mode === playerRows[0].mode) ? playerRows[0].mode : null;

  // Team-Vorschau je Intensität: echte, potentialgewichtete Summe der pro-Spieler-Prognose
  // (nicht der flache Konstant-Wert) — so unterscheidet sich das Team-Budget zwischen Kadern.
  const teamProjectionByMode = useMemo(() => {
    const totals = new Map<PlayerTrainingMode, { trainingGain: number; net: number }>();
    for (const option of trainingModeOptions) {
      totals.set(option.value, { trainingGain: 0, net: 0 });
    }
    for (const row of playerRows) {
      for (const entry of buildTrainingIntensityProjection(row, trainingModeOptions)) {
        const bucket = totals.get(entry.mode);
        if (bucket) {
          bucket.trainingGain += entry.trainingGain;
          bucket.net += entry.net;
        }
      }
    }
    return totals;
  }, [playerRows, trainingModeOptions]);

  const topGrowth =
    [...playerRows].sort((left, right) => right.organicForecast.netSetpoints - left.organicForecast.netSetpoints)[0] ?? null;
  const topRisk =
    [...playerRows].sort(
      (left, right) =>
        right.forecast.regressionPressure - left.forecast.regressionPressure ||
        right.organicForecast.netSetpoints - left.organicForecast.netSetpoints,
    )[0] ?? null;

  // #48 — Team-Summe für die 4 Header-Kacheln (Performance/Trainings-Zugewinn/
  // Regression/Netto). Aufsummiert aus den echten, bereits angewendeten
  // Attribut-Forecast-Feldern (dieselbe Rechnung wie `buildTrainingBudgetBreakdown`
  // pro Spieler), daher reconciled Training + Performance + Regression exakt zu Netto.
  const teamKpis = useMemo(() => {
    let performance = 0;
    let training = 0;
    let regression = 0;
    let net = 0;
    for (const row of playerRows) {
      for (const entry of row.attributeForecast) {
        training += entry.training;
        performance += entry.performance;
        regression += entry.regression;
      }
      net += row.organicForecast.netSetpoints;
    }
    return { performance, training, regression, net };
  }, [playerRows]);

  // Hero-Zähler (#Wave2) für die 4 Header-Kacheln — reine Zähl-Animation,
  // keine neue Berechnung (identische Summen wie `teamKpis`).
  const animatedTeamPerformance = useCountUp(teamKpis.performance);
  const animatedTeamTraining = useCountUp(teamKpis.training);
  const animatedTeamRegression = useCountUp(teamKpis.regression);
  const animatedTeamNet = useCountUp(teamKpis.net);

  return (
    <section
      className="nl-training"
      data-testid="foundation-training-compact"
      id="foundation-training-compact"
      data-new-look="true"
    >
      <NlCard
        className="nl-training-header-card"
        eyebrow={`${selectedTeam.shortCode} · ${selectedTeamControlMode ?? "manual"} · ${seasonLabel}`}
        title="Training"
        actions={
          <div className="nl-training-header-actions">
            {onOpenFacilities ? (
              <button type="button" className="nl-training-inline-button" onClick={onOpenFacilities}>
                Gebäude
              </button>
            ) : null}
            {onOpenTeams ? (
              <button type="button" className="nl-training-inline-button" onClick={onOpenTeams}>
                Teams
              </button>
            ) : null}
          </div>
        }
      >
        {/* #48 — 4 klare Kacheln: Performance, Trainings-Zugewinn, Regression, Netto.
            Jede Kachel summiert dieselben, bereits angewendeten Attribut-Forecast-Felder
            (row.attributeForecast[].training/performance/regression) über den ganzen Kader,
            daher gilt exakt Training + Performance + Regression = Netto — keine getrennten,
            widersprüchlichen Zahlensysteme mehr. */}
        <StatChipRow aria-label="Trainings-Kennzahlen: Performance, Trainings-Zugewinn, Regression, Netto">
          <StatChip
            label="Performance"
            value={`+${formatNlNumber(animatedTeamPerformance ?? teamKpis.performance, 1)} SP`}
            sub="aus Matchday-Ergebnissen"
            tone="pow"
            title="SP-Zuwachs aus echten Matchday-Ergebnissen (Score, Rang, Beitrag) über den ganzen Kader — unabhängig von der Trainingsintensität."
          />
          <StatChip
            label="Trainings-Zugewinn"
            value={`+${formatNlNumber(animatedTeamTraining ?? teamKpis.training, 1)} SP`}
            sub="aus Trainingsintensität"
            tone="accent"
            title="SP-Zuwachs durch Training über den ganzen Kader — abhängig von Trainingsintensität (Leicht/Mittel/Hart), Potential und Facility-Boni."
          />
          <StatChip
            label="Regression"
            value={`${formatNlNumber(animatedTeamRegression ?? teamKpis.regression, 1)} SP`}
            sub="Alterung & Marktwert-Druck"
            tone="risk"
            title="SP-Verlust, den der Kader automatisch durch Alterung, Marktwert-Druck und Belastung verliert — muss durch Training + Performance ausgeglichen werden."
          />
          <StatChip
            label="Netto"
            value={`${formatVeloSignedNumber(animatedTeamNet ?? teamKpis.net, 1)} SP`}
            sub="Performance + Training − Regression"
            tone={teamKpis.net >= 0 ? "good" : "risk"}
            title="Summe aus Performance + Trainings-Zugewinn − Regression über den ganzen Kader. Positiv = Kader wächst im Schnitt, negativ = Kader baut im Schnitt ab."
          />
        </StatChipRow>
        <p className="nl-training-topline">
          Regeneration Ø {formatNlNumber(summary.recoveryBeforeTraining, 1)} → {formatNlNumber(summary.recoveryAfterTraining, 1)} ·
          Leicht {summary.lightModeCount} · Hart {summary.hardModeCount} · Top:{" "}
          <strong>{topGrowth?.player.name ?? "—"}</strong>
          {topGrowth ? ` (${formatVeloSignedNumber(topGrowth.organicForecast.netSetpoints, 1)})` : ""} · Risiko:{" "}
          <strong>{topRisk?.player.name ?? "—"}</strong>
          {topRisk ? ` (Druck ${formatVeloNumber(topRisk.forecast.regressionPressure, 0)})` : ""} ·{" "}
          <button
            type="button"
            className="nl-training-topline-link"
            title="Saisonende-Sicht auf Klasse, Potential und erwartete Richtung. Klick: zu den Entwicklungsfiltern springen."
            onClick={() => {
              onSetDevelopmentFilter("growth");
              if (typeof document !== "undefined") {
                document
                  .getElementById("training-development-filters")
                  ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
              }
            }}
          >
            Entwicklungsziel: {developmentSummary.growth} steigt · {developmentSummary.stable} stabil ·{" "}
            {developmentSummary.regression} Risiko
          </button>
        </p>
        {managementLockedReason ? <p className="nl-training-locked">{managementLockedReason}</p> : null}
      </NlCard>

      <NlCard
        className="nl-training-global-card"
        eyebrow="Team-Intensität"
        title="Alle Spieler auf einen Modus"
        data-testid="training-global-mode-rail"
      >
        <VeloIntensityRail
          ariaLabel="Trainingsmodus für alle Spieler"
          segments={modeSegments}
          activeValue={uniformTeamMode ?? ""}
          disabled={trainingModeReadOnly}
          onSelect={(value) => {
            playerRows.forEach((row) => onSetTrainingMode(row.player.id, value as PlayerTrainingMode));
          }}
        />
        <div className="nl-training-team-preview" aria-label="Team-Effekt Vorschau">
          <small>
            Aktuell: Leicht {teamModeCounts.leicht} · Mittel {teamModeCounts.mittel} · Hart {teamModeCounts.hart}
          </small>
          {trainingModeOptions.map((option) => {
            const team = teamProjectionByMode.get(option.value);
            return (
              <small key={`team-preview-${option.value}`} className="nl-tnum">
                Alle {option.label}: +{formatVeloNumber(team?.trainingGain ?? option.trainingSetpoints * playerRows.length, 1)}{" "}
                durch Training · Netto {formatVeloSignedNumber(team?.net ?? 0, 1)} SP · Fatigue{" "}
                {formatVeloNumber(option.fatigueLoad * playerRows.length, 0)}
              </small>
            );
          })}
        </div>
      </NlCard>

      <div className="nl-training-filter-row" id="training-development-filters" role="group" aria-label="Entwicklungsfilter">
        {DEVELOPMENT_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`nl-training-filter${developmentFilter === filter.id ? " is-active" : ""}`}
            title={filter.hint}
            aria-pressed={developmentFilter === filter.id}
            onClick={() => onSetDevelopmentFilter(filter.id)}
          >
            <span>{filter.label}</span>
            <strong className="nl-tnum">{developmentSummary[filter.id]}</strong>
          </button>
        ))}
        <label className="nl-training-sort">
          <span>Sortierung</span>
          <select
            className="input"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as TrainingSortKey)}
            aria-label="Kader sortieren"
          >
            {TRAINING_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="nl-training-filter-count nl-tnum">
          {playerRows.length}/{allPlayerCount}
        </span>
      </div>

      {playerRows.length === 0 ? (
        <EmptyState
          title="Keine Trainingsdaten"
          text="Für dieses Team liegen aktuell keine Spieler oder kein passender Entwicklungsfilter vor."
          actionLabel={onOpenTeams ? "Teams öffnen" : undefined}
          onAction={onOpenTeams}
        />
      ) : (
        <div className="nl-training-grid">
          {sortedPlayerRows.map((row) => (
            <NlTrainingPlayerCard
              key={row.entryId}
              row={row}
              trainingModeReadOnly={trainingModeReadOnly}
              trainingModeOptions={trainingModeOptions}
              trainingClassOptions={trainingClassOptions}
              onSetTrainingMode={onSetTrainingMode}
              onSetTrainingClass={onSetTrainingClass}
              onOpenPlayerDetails={onOpenPlayerDetails}
            />
          ))}
        </div>
      )}
    </section>
  );
}
