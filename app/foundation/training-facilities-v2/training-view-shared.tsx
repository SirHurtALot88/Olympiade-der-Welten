"use client";

import { useMemo, useState } from "react";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import {
  buildTrainingImpactItems,
  buildTrainingModeSegments,
  formatVeloNumber,
  formatVeloSignedNumber,
  VeloAttributeFocusTags,
  VeloImpactStrip,
  VeloIntensityRail,
  VeloStarRating,
  VeloStatOrbitRow,
} from "@/components/foundation/velo-ui";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import type { PlayerDemandStatus } from "@/lib/data/olyDataTypes";

import type {
  TrainingClassOption,
  TrainingDevelopmentFilter,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";

export function formatLocaleNumber(value: number | null | undefined, digits = 0) {
  return formatVeloNumber(value, digits);
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatVeloNumber(value, 0)}%`;
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

function getDevelopmentBadgeLabel(tone: ReturnType<typeof getDevelopmentTone>) {
  if (tone === "growth") return "steigt";
  if (tone === "regression") return "kann fallen";
  return "stabil";
}

function getDemandStatusLabel(status: PlayerDemandStatus) {
  switch (status) {
    case "fulfilled":
      return "erfuellt";
    case "at_risk":
      return "unter Druck";
    case "failed":
      return "ignoriert";
    default:
      return "offen";
  }
}

function TrainingTraitBoostRow({ row }: { row: TrainingPlayerRowView }) {
  if (row.traitBoosts.length === 0 && row.modifiers.traitModifierPct === 0) {
    return null;
  }

  return (
    <div className="training-v2-trait-boost-row" aria-label="Trait Training Boosts">
      <div className="training-v2-trait-boost-summary">
        <span>Trait Boost</span>
        <strong className={row.modifiers.traitModifierPct >= 0 ? "text-positive" : "text-negative"}>
          {formatSignedPercent(row.modifiers.traitModifierPct)}
        </strong>
      </div>
      <div className="training-v2-trait-boost-chips">
        {row.traitBoosts.slice(0, 4).map((entry) => (
          <span
            key={`${row.player.id}-${entry.trait}`}
            className={`training-v2-trait-chip is-${entry.tone}`}
            title={`${entry.trait}: ${entry.pct >= 0 ? "+" : ""}${formatVeloNumber(entry.pct, 1)}% Legacy Training Signal`}
          >
            {entry.tone === "positive" ? "★" : entry.tone === "negative" ? "▼" : "•"} {entry.trait} {entry.pct >= 0 ? "+" : ""}
            {formatVeloNumber(entry.pct, 1)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function TrainingModeDemandBanner({ row }: { row: TrainingPlayerRowView }) {
  const demand = row.trainingDemand;
  if (!demand || demand.status === "fulfilled") {
    return null;
  }

  const preferred = getTrainingModePresentation(demand.preferredMode);
  return (
    <div className={`training-v2-mode-demand is-${demand.status}`} aria-label="Trainingswunsch">
      <div className="training-v2-mode-demand-copy">
        <strong>{demand.label}</strong>
        <span>
          {getDemandStatusLabel(demand.status)} · will {preferred.label} · Moral {demand.moraleReward >= 0 ? "+" : ""}
          {demand.moraleReward}/{demand.moralePenalty}
        </span>
      </div>
      <small>{demand.detail}</small>
    </div>
  );
}

function TrainingAttributeForecastGrid({ row }: { row: TrainingPlayerRowView }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...row.attributeForecast].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const visible = expanded ? sorted : sorted.slice(0, 5);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="training-v2-attribute-forecast">
      <div className="training-v2-attribute-forecast-head">
        <strong>Stat Forecast</strong>
        {sorted.length > 5 ? (
          <button className="secondary-button inline-button" type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Weniger" : `Alle ${sorted.length} Stats`}
          </button>
        ) : null}
      </div>
      <div className="training-v2-attribute-forecast-grid">
        {visible.map((entry) => (
          <article
            className={`training-v2-attribute-forecast-card${entry.delta < 0 ? " is-risk" : entry.delta > 0 ? " is-gain" : ""}${entry.affinity === "signature" ? " is-signature" : entry.affinity === "weak" ? " is-weak" : ""}`}
            key={`${row.player.id}-${entry.attribute}`}
          >
            <div className="training-v2-attribute-forecast-title">
              <small>{entry.attribute}</small>
              {entry.affinity === "signature" ? <span className="training-v2-affinity-mark is-signature">★</span> : null}
              {entry.affinity === "weak" ? <span className="training-v2-affinity-mark is-weak">◆</span> : null}
            </div>
            <strong>
              {formatVeloNumber(entry.before, 1)} → {formatVeloNumber(entry.after, 1)}
            </strong>
            <em>{formatVeloSignedNumber(entry.delta, 1)}</em>
            <div className="training-v2-attribute-forecast-split">
              <span>T {formatVeloSignedNumber(entry.training, 1)}</span>
              <span>P {formatVeloSignedNumber(entry.performance, 1)}</span>
              <span>R {formatVeloSignedNumber(entry.regression, 1)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

type TrainingModeGuideProps = {
  trainingModeOptions: TrainingModeOption[];
};

export function TrainingModeGuide({ trainingModeOptions }: TrainingModeGuideProps) {
  return (
    <div className="training-v2-mode-guide velo-mode-guide" aria-label="Trainingslast Erklaerung">
      {trainingModeOptions.map((option) => (
        <article className={`training-v2-mode-guide-card velo-mode-guide-card is-${option.fatigueRisk === "niedrig" ? "growth" : option.fatigueRisk === "hoch" ? "regression" : "stable"}`} key={`mode-guide-${option.value}`}>
          <span>{option.label}</span>
          <strong>+{formatVeloNumber(option.baseXp, 0)} XP · Fatigue {formatVeloNumber(option.fatigueLoad, 0)}</strong>
          <small>
            {option.recoveryDeltaPct > 0 ? `+${option.recoveryDeltaPct}% Reg` : option.recoveryDeltaPct < 0 ? `${option.recoveryDeltaPct}% Reg` : "±0 Reg"} · {option.note}
          </small>
        </article>
      ))}
    </div>
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
  showIntensityRail?: boolean;
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
  showIntensityRail = true,
}: TrainingPlayerLaneProps) {
  const modeSegments = buildTrainingModeSegments(
    trainingModeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      baseXp: option.baseXp,
      recoveryDeltaPct: option.recoveryDeltaPct,
      fatigueLoad: option.fatigueLoad,
      note: option.note,
    })),
  );

  const teamModeCounts = useMemo(
    () =>
      playerRows.reduce(
        (counts, row) => {
          counts[row.mode] += 1;
          return counts;
        },
        { leicht: 0, mittel: 0, hart: 0 },
      ),
    [playerRows],
  );

  return (
    <>
      <div className="training-v2-section-head">
        <div>
          <TooltipHeading as="h3" tooltip="Modus und Klasse pro Spieler. Filter nach Entwicklung und Risiko.">
            Kader
          </TooltipHeading>
        </div>
        <span className="pill">
          {playerRows.length}/{allPlayerCount}
        </span>
      </div>

      <div className="training-v2-team-mode-strip" aria-label="Team-Trainingsmodus">
        <span>Team-Modus</span>
        <strong>
          Leicht {teamModeCounts.leicht} · Mittel {teamModeCounts.mittel} · Hart {teamModeCounts.hart}
        </strong>
      </div>

      <div className="training-v2-filter-row">
        {([
          { id: "all" as const, label: "Alle" },
          { id: "growth" as const, label: "Steigt" },
          { id: "stable" as const, label: "Stabil" },
          { id: "regression" as const, label: "Risiko" },
        ]).map((filter) => (
          <button
            key={filter.id}
            className={`training-v2-filter-card${developmentFilter === filter.id ? " is-active" : ""}`}
            type="button"
            onClick={() => onSetDevelopmentFilter(filter.id)}
          >
            <span>{filter.label}</span>
            <strong>{developmentSummary[filter.id]}</strong>
          </button>
        ))}
      </div>

      <div className="training-v2-player-list training-v2-rider-grid">
        {playerRows.map((row) => {
          const portrait = getPortraitModel(row.player);
          const tone = getDevelopmentTone(row);
          const isHighRisk = row.forecast.regressionRisk === "high";
          return (
            <article className={`training-v2-rider-card velo-rider-card is-${tone}${isHighRisk ? " is-high-risk" : ""}`} id={`training-player-${row.player.id}`} key={row.entryId}>
              <VeloStatOrbitRow stats={row.player.coreStats} ariaLabel={`${row.player.name} Achsenwerte`} />

              <div className="training-v2-rider-hero">
                <button
                  className="training-v2-rider-portrait-button"
                  type="button"
                  onClick={() => onOpenPlayerDetails?.({ playerId: row.player.id, activePlayerId: row.entryId })}
                >
                  <div className="training-v2-rider-portrait-wrap">
                    {portrait.src ? (
                      <OptimizedMediaImage
                        src={portrait.src}
                        alt={row.player.name}
                        width={112}
                        height={112}
                        className="training-v2-rider-portrait"
                      />
                    ) : (
                      <div className="training-v2-rider-portrait training-v2-rider-portrait-fallback">{portrait.initials}</div>
                    )}
                  </div>
                </button>

                <div className="training-v2-rider-copy">
                  <div className="training-v2-rider-title-row">
                    <button
                      type="button"
                      className="table-link-button"
                      onClick={() => onOpenPlayerDetails?.({ playerId: row.player.id, activePlayerId: row.entryId })}
                    >
                      {row.player.name}
                    </button>
                    <span className={`training-v2-badge is-${tone}`}>{getDevelopmentBadgeLabel(tone)}</span>
                    {isHighRisk ? <span className="training-v2-badge is-risk-urgent">10/10 Risiko</span> : null}
                  </div>
                  <p className="training-v2-rider-meta">
                    <ClassColorChip className={row.player.className} /> · {row.roleTag ?? "ohne Rolle"}
                  </p>
                  <div className="training-v2-rider-star-stack velo-star-stack">
                    <VeloStarRating compact label="CA" value={row.developmentStars.currentAbilityStars ?? row.developmentStars.currentAbilityRating} />
                    <VeloStarRating compact label="PO" tone="gold" value={row.developmentStars.potentialStars ?? row.developmentStars.potentialRating} />
                  </div>
                  <p className="training-v2-rider-class-line">
                    Klasse {row.organicForecast.classBefore} → {row.organicForecast.classAfter}
                  </p>
                </div>

                <div className="training-v2-rider-ability-stack">
                  <div className={`training-v2-rider-ability velo-value-flash-target is-${tone}`}>
                    <span>DEV</span>
                    <strong>{formatVeloNumber(row.forecast.netDevelopmentXP, 0)}</strong>
                    <small>Entwicklung</small>
                  </div>
                  {row.playerPps != null ? (
                    <div className="training-v2-rider-ability is-pps">
                      <span>PPs</span>
                      <strong>{formatVeloNumber(row.playerPps, 1)}</strong>
                      <small>Leistung</small>
                    </div>
                  ) : null}
                </div>
              </div>

              <TrainingTraitBoostRow row={row} />
              <TrainingModeDemandBanner row={row} />

              <div className="training-v2-rider-forecast-row">
                <div>
                  <span>Stat Forecast</span>
                  <strong className={row.organicForecast.netSetpoints >= 0 ? "text-positive" : "text-negative"}>
                    {row.organicForecast.netSetpoints > 0 ? "+" : ""}
                    {formatVeloNumber(row.organicForecast.netSetpoints, 1)}
                  </strong>
                </div>
                <div>
                  <span>Training</span>
                  <strong>+{formatVeloNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
                </div>
                <div title="Matchday-Leistung. Sanfter Taper erst nahe Attribut-Decke — nicht wie Training.">
                  <span>Performance</span>
                  <strong>+{formatVeloNumber(row.organicForecast.performanceSetpoints, 1)}</strong>
                </div>
                <div>
                  <span>Fatigue</span>
                  <strong>+{formatVeloNumber(row.organicForecast.fatigueLoad, 1)}</strong>
                </div>
              </div>

              <VeloImpactStrip
                flashKey={row.mode}
                items={buildTrainingImpactItems({
                  trainingSetpoints: row.organicForecast.trainingSetpoints,
                  performanceSetpoints: row.organicForecast.performanceSetpoints,
                  netSetpoints: row.organicForecast.netSetpoints,
                  recoveryBefore: row.recoveryForecast.before,
                  recoveryAfter: row.recoveryForecast.after,
                  recoveryDeltaPct: row.recoveryForecast.modifierPct,
                  regressionRisk: row.forecast.regressionRisk,
                  legacyXpPreview: row.trainingXp + row.performanceXp,
                })}
              />

              {showIntensityRail ? (
              <VeloIntensityRail
                ariaLabel={`${row.player.name} Trainingsmodus`}
                segments={modeSegments}
                activeValue={row.mode}
                demandValue={row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? row.trainingDemand.preferredMode : null}
                disabled={trainingModeReadOnly}
                onSelect={(value) => onSetTrainingMode(row.player.id, value as PlayerTrainingMode)}
              />
              ) : null}

              <div className="training-v2-plan-controls">
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

              <VeloAttributeFocusTags primary={row.classTrainingFocus.primary} risks={row.classTrainingFocus.risks} />

              <TrainingAttributeForecastGrid row={row} />

              <div className="training-v2-player-foot training-v2-modifier-row">
                <small>
                  Traits {formatSignedPercent(row.modifiers.traitModifierPct)} · Facility {formatSignedPercent(row.modifiers.facilityModifierPct)} · Potential x
                  {formatVeloNumber(row.modifiers.potentialTrainingMultiplier, 2)}
                </small>
                {row.trainingDemand && row.trainingDemand.status !== "fulfilled" ? (
                  <small className={`training-v2-mode-demand-foot is-${row.trainingDemand.status}`}>
                    Wunsch {getTrainingModePresentation(row.trainingDemand.preferredMode).label} · aktuell{" "}
                    {getTrainingModePresentation(row.mode).label}
                  </small>
                ) : null}
                <small>
                  {row.modifiers.signatureAttributes.length > 0 ? `★ ${row.modifiers.signatureAttributes.join(" / ")}` : "★ —"}
                  {row.modifiers.weakAttribute ? ` · ◆ Weak ${row.modifiers.weakAttribute}` : ""}
                </small>
                <small>{row.modeConfig.note}</small>
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
