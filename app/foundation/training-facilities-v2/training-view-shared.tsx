"use client";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import type {
  TrainingClassOption,
  TrainingDevelopmentFilter,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";

const AXIS_META = {
  pow: { label: "POW", tone: "is-pow" },
  spe: { label: "SPE", tone: "is-spe" },
  men: { label: "MEN", tone: "is-men" },
  soc: { label: "SOC", tone: "is-soc" },
} as const;

export function formatLocaleNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatLocaleNumber(value, 0)}%`;
}

export function getDevelopmentTone(row: TrainingPlayerRowView) {
  if (row.forecast.netDevelopmentXP < 0 || row.forecast.regressionRisk === "high") {
    return "regression";
  }
  if (row.forecast.netDevelopmentXP >= 45) {
    return "growth";
  }
  return "stable";
}

function getPortraitModel(player: TrainingPlayerRowView["player"]) {
  const src = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath);
  const initials =
    player.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { src, initials };
}

function TrainingAxisPill({ axis, value }: { axis: keyof typeof AXIS_META; value: number }) {
  const meta = AXIS_META[axis];
  return (
    <span className={`training-v2-axis-pill ${meta.tone}`}>
      <small>{meta.label}</small>
      <strong>{formatLocaleNumber(value, 0)}</strong>
    </span>
  );
}

type TrainingPlayerLaneProps = {
  playerRows: TrainingPlayerRowView[];
  allPlayerCount: number;
  developmentFilter: TrainingDevelopmentFilter;
  developmentSummary: Record<TrainingDevelopmentFilter, number>;
  onSetDevelopmentFilter: (filter: TrainingDevelopmentFilter) => void;
  trainingModeOptions: TrainingModeOption[];
  trainingClassOptions: TrainingClassOption[];
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  trainingModeReadOnly?: boolean;
};

export function TrainingPlayerLane({
  playerRows,
  allPlayerCount,
  developmentFilter,
  developmentSummary,
  onSetDevelopmentFilter,
  trainingModeOptions,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
  trainingModeReadOnly = false,
}: TrainingPlayerLaneProps) {
  return (
    <>
      <div className="training-v2-section-head">
        <div>
          <span className="training-v2-kicker">Spielertraining</span>
          <strong>Wer steigt jetzt, wer kippt spaeter?</strong>
        </div>
        <span className="pill">
          {playerRows.length}/{allPlayerCount}
        </span>
      </div>

      <div className="training-v2-filter-row">
        {([
          { id: "all" as const, label: "Alle", detail: "ganzer Kader" },
          { id: "growth" as const, label: "Steigt", detail: "lohnt sich jetzt" },
          { id: "stable" as const, label: "Stabil", detail: "Modus pruefen" },
          { id: "regression" as const, label: "Risiko", detail: "zuerst sichern" },
        ]).map((filter) => (
          <button
            key={filter.id}
            className={`training-v2-filter-card${developmentFilter === filter.id ? " is-active" : ""}`}
            type="button"
            onClick={() => onSetDevelopmentFilter(filter.id)}
          >
            <span>{filter.label}</span>
            <strong>{developmentSummary[filter.id]}</strong>
            <small>{filter.detail}</small>
          </button>
        ))}
      </div>

      <div className="training-v2-player-list">
        {playerRows.map((row) => {
          const portrait = getPortraitModel(row.player);
          const tone = getDevelopmentTone(row);
          return (
            <article className={`training-v2-player-card is-${tone}`} id={`training-player-${row.player.id}`} key={row.entryId}>
              <button
                className="training-v2-player-head"
                type="button"
                onClick={() => onOpenPlayerDetails?.({ playerId: row.player.id, activePlayerId: row.entryId })}
              >
                <div className="training-v2-player-media">
                  {portrait.src ? (
                    <OptimizedMediaImage
                      src={portrait.src}
                      alt={row.player.name}
                      width={78}
                      height={78}
                      className="training-v2-player-image"
                    />
                  ) : (
                    <div className="training-v2-player-image training-v2-player-image-fallback">{portrait.initials}</div>
                  )}
                </div>
                <div className="training-v2-player-copy">
                  <strong className="training-v2-clickable">{row.player.name}</strong>
                  <p>
                    <ClassColorChip className={row.player.className} /> · {row.roleTag ?? "ohne Rolle"}
                  </p>
                  <div className="training-v2-axis-row">
                    <TrainingAxisPill axis="pow" value={row.player.coreStats.pow} />
                    <TrainingAxisPill axis="spe" value={row.player.coreStats.spe} />
                    <TrainingAxisPill axis="men" value={row.player.coreStats.men} />
                    <TrainingAxisPill axis="soc" value={row.player.coreStats.soc} />
                  </div>
                </div>
                <div className="training-v2-player-badge-row">
                  <span className={`training-v2-badge is-${tone}`}>
                    {tone === "growth" ? "steigt" : tone === "regression" ? "kann fallen" : "stabil"}
                  </span>
                </div>
              </button>

              <div className="training-v2-player-metrics">
                <div>
                  <span>Stat Forecast</span>
                  <strong className={row.organicForecast.netSetpoints >= 0 ? "text-positive" : "text-negative"}>
                    {row.organicForecast.netSetpoints > 0 ? "+" : ""}
                    {formatLocaleNumber(row.organicForecast.netSetpoints, 1)}
                  </strong>
                </div>
                <div>
                  <span>Training</span>
                  <strong>+{formatLocaleNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
                </div>
                <div>
                  <span>Potential</span>
                  <strong>
                    {row.organicForecast.potentialRating ?? "—"} · x{formatLocaleNumber(row.organicForecast.potentialTrainingMultiplier, 2)}
                  </strong>
                </div>
                <div>
                  <span>Fatigue</span>
                  <strong>+{formatLocaleNumber(row.organicForecast.fatigueLoad, 1)}</strong>
                </div>
              </div>

              <div className="training-v2-plan-controls">
                <div className="training-v2-mode-strip" aria-label={`${row.player.name} Trainingsmodus`}>
                  {trainingModeOptions.map((option) => (
                    <button
                      key={`${row.player.id}-${option.value}`}
                      className={`training-v2-mode-chip${row.mode === option.value ? " is-active" : ""}`}
                      type="button"
                      disabled={trainingModeReadOnly}
                      onClick={() => onSetTrainingMode(row.player.id, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="filter-field training-v2-class-select">
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
              </div>

              <div className="training-v2-stat-forecast">
                {row.organicForecast.topGains.map((entry) => (
                  <span key={`${row.player.id}-gain-${entry.attribute}`}>
                    <small>{entry.attribute}</small>
                    <strong>
                      {formatLocaleNumber(entry.before, 1)} → {formatLocaleNumber(entry.after, 1)}
                    </strong>
                    <em>+{formatLocaleNumber(entry.delta, 1)}</em>
                  </span>
                ))}
                {row.organicForecast.topLosses.map((entry) => (
                  <span className="is-risk" key={`${row.player.id}-loss-${entry.attribute}`}>
                    <small>{entry.attribute}</small>
                    <strong>
                      {formatLocaleNumber(entry.before, 1)} → {formatLocaleNumber(entry.after, 1)}
                    </strong>
                    <em>{formatLocaleNumber(entry.delta, 1)}</em>
                  </span>
                ))}
              </div>

              <div className="training-v2-player-foot">
                <small>{row.modeConfig.note}</small>
                <small>
                  Klasse {row.organicForecast.classBefore} → {row.organicForecast.classAfter} · Training {row.trainingClass}
                </small>
                <small>
                  Performance +{formatLocaleNumber(row.organicForecast.performanceSetpoints, 1)} · Steigerungsstufe {row.forecast.trainingFormTier}
                </small>
                <small>
                  Risiko {row.forecast.fatigueStrain.label} · {row.fatigueWarning}
                </small>
              </div>
            </article>
          );
        })}
        {playerRows.length === 0 ? (
          <div className="training-v2-empty">
            <strong>Keine Spieler im aktuellen Filter.</strong>
            <p>Wechsle den Entwicklungsfokus oder waehle ein anderes Team.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
