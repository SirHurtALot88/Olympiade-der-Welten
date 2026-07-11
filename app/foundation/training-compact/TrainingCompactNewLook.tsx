"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/foundation/EmptyState";
import { NlCard, NlDeltaChip, StatChip, StatChipRow, formatNlNumber } from "@/components/foundation/new-look";
import { VeloIntensityRail, buildTrainingModeSegments, formatVeloNumber, formatVeloSignedNumber } from "@/components/foundation/velo-ui";
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
  { id: "growth", label: "Upgrade bereit", hint: "Spieler mit positivem Netto-Forecast" },
  { id: "regression", label: "Risiko", hint: "Spieler mit Rückschritt-Risiko" },
  { id: "stable", label: "Stabil", hint: "Spieler ohne große Bewegung" },
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
    return "Regression und Fatigue drücken stärker als Training + Performance.";
  }
  if (row.forecast.regressionRisk === "high") {
    return `Wächst noch, aber hohes Rückschritt-Risiko (Druck ${formatVeloNumber(row.forecast.regressionPressure, 0)}).`;
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
  }`;

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
}: {
  row: TrainingPlayerRowView;
  trainingModeOptions: TrainingCompactClientProps["trainingModeOptions"];
}) {
  const projection = useMemo(
    () => buildTrainingIntensityProjection(row, trainingModeOptions),
    [row, trainingModeOptions],
  );
  const potentialMultiplier = row.modifiers.potentialTrainingMultiplier;
  const potentialTone = getPotentialTone(potentialMultiplier);
  const best = projection.reduce((max, entry) => Math.max(max, entry.trainingGain), 0.01);

  return (
    <div className="nl-training-intensity" data-testid="nl-training-intensity" aria-label="Trainingsbudget je Intensität">
      <div className="nl-training-intensity-head">
        <span className="nl-training-intensity-title">Entwicklung je Intensität</span>
        <span
          className={`nl-training-potential is-${potentialTone}`}
          title="Potential-Trainingsspeed: höheres Potential ⇒ mehr Zuwachs pro Intensität. Dieser Faktor steckt in jeder Prognose unten."
        >
          <NlTrainingGlyph kind="signature" /> Potential ×{formatVeloNumber(potentialMultiplier, 2)}
        </span>
      </div>
      <div className="nl-training-intensity-rows">
        {projection.map((entry) => (
          <div
            key={`intensity-${row.player.id}-${entry.mode}`}
            className={`nl-training-intensity-row${entry.isCurrent ? " is-current" : ""}`}
            title={`${entry.label}: +${formatVeloNumber(entry.trainingGain, 1)} durch Training · Regression ${formatVeloSignedNumber(entry.regression, 1)} · Netto ${formatVeloSignedNumber(entry.net, 1)} SP · Fatigue ${formatVeloNumber(entry.fatigueLoad, 0)}`}
          >
            <span className="nl-training-intensity-label">
              {entry.label}
              {entry.isCurrent ? <span className="nl-training-intensity-current">aktiv</span> : null}
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
            <NlDeltaChip
              value={entry.net}
              format={(n) => `${formatVeloSignedNumber(n, 1)} SP`}
              className="nl-training-intensity-net"
            />
          </div>
        ))}
      </div>
      <small className="nl-training-intensity-foot nl-tnum">
        Regression konstant {formatVeloSignedNumber(projection[0]?.regression ?? 0, 1)} · höheres Potential ⇒ größerer
        Trainings-Zuwachs
      </small>
    </div>
  );
}

function NlTrainingPlayerCard({
  row,
  trainingModeReadOnly,
  modeSegments,
  trainingModeOptions,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
}: {
  row: TrainingPlayerRowView;
  trainingModeReadOnly: boolean;
  modeSegments: ReturnType<typeof buildTrainingModeSegments>;
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
        <span className="nl-training-player-avatar" aria-hidden="true">
          {getInitials(row.player.name)}
        </span>
        <div className="nl-training-player-copy">
          <strong className="nl-training-player-name">{row.player.name}</strong>
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
            {row.developmentStars.currentAbilityRating != null
              ? ` · CA ${formatNlNumber(row.developmentStars.currentAbilityRating, 0)}`
              : ""}
            {row.developmentStars.potentialStars
              ? ` · PO ${row.developmentStars.potentialStars}`
              : row.developmentStars.potentialRating != null
                ? ` · PO ${formatNlNumber(row.developmentStars.potentialRating, 0)}`
                : ""}
          </small>
        </div>
        <span className={`nl-training-player-badge is-${tone}`}>{getToneBadgeLabel(tone)}</span>
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
        {formatVeloNumber(row.organicForecast.fatigueLoad, 1)} · Risiko {row.forecast.fatigueStrain.label}
      </small>

      <NlTrainingIntensityProjection row={row} trainingModeOptions={trainingModeOptions} />

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
              title={`${row.fatigueWarning} · Marktwert-Druck ${formatVeloNumber(row.forecast.regressionPressure, 0)}`}
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

      <footer className="nl-training-player-controls">
        <VeloIntensityRail
          ariaLabel={`${row.player.name} Trainingsmodus`}
          segments={modeSegments}
          activeValue={row.mode}
          demandValue={demand && demand.status !== "fulfilled" ? demand.preferredMode : null}
          disabled={trainingModeReadOnly}
          onSelect={(value) => onSetTrainingMode(row.player.id, value as PlayerTrainingMode)}
        />
        <div className="nl-training-player-foot">
          <label className="nl-training-class-select">
            <span>Trainingsklasse</span>
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
          {onOpenPlayerDetails ? (
            <button
              type="button"
              className="nl-training-inline-button"
              onClick={() => onOpenPlayerDetails({ playerId: row.player.id, activePlayerId: row.entryId })}
            >
              Profil öffnen
            </button>
          ) : null}
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
        <StatChipRow aria-label="Trainings-Kennzahlen">
          <StatChip
            label="Regeneration"
            value={`${formatNlNumber(summary.recoveryBeforeTraining, 1)} → ${formatNlNumber(summary.recoveryAfterTraining, 1)}`}
            sub={`Leicht ${summary.lightModeCount} · Hart ${summary.hardModeCount}`}
            tone="spe"
          />
          <StatChip
            label="Trainingsplan"
            value={formatNlNumber(summary.trainingXpAfter, 1)}
            sub={`Facility ${formatSignedPercent(summary.trainingXpModifierPct)}`}
            tone="accent"
            title="Laufende Saison-Prognose aus Training, Performance und Regression."
          />
          <StatChip
            label="Performance"
            value={formatNlNumber(summary.performanceXp, 1)}
            sub={`Netto ${formatNlNumber(summary.totalXp, 1)} SP`}
            tone="pow"
          />
          <StatChip
            label="Entwicklungsziel"
            value={`${developmentSummary.growth} steigt`}
            sub={`${developmentSummary.stable} stabil · ${developmentSummary.regression} Risiko`}
            tone="good"
            title="Saisonende-Sicht auf Klasse, Potential und erwartete Richtung. Klick: zu Upgrade-bereiten Spielern springen."
            onClick={() => {
              onSetDevelopmentFilter("growth");
              if (typeof document !== "undefined") {
                document
                  .getElementById("training-development-filters")
                  ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
              }
            }}
          />
        </StatChipRow>
        <p className="nl-training-topline">
          Top: <strong>{topGrowth?.player.name ?? "—"}</strong>
          {topGrowth ? ` (${formatVeloSignedNumber(topGrowth.organicForecast.netSetpoints, 1)})` : ""} · Risiko:{" "}
          <strong>{topRisk?.player.name ?? "—"}</strong>
          {topRisk ? ` (Druck ${formatVeloNumber(topRisk.forecast.regressionPressure, 0)})` : ""}
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
              modeSegments={modeSegments}
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
