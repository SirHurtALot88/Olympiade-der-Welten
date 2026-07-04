"use client";

import { formatTrainingModeRecoveryLabel } from "@/lib/training/training-mode-presentation";

import { formatVeloNumber } from "@/components/foundation/velo-ui/formatters";

export type VeloIntensitySegment = {
  value: string;
  label: string;
  toneClass?: string;
  lines: string[];
  note?: string;
  disabled?: boolean;
};

type VeloIntensityRailProps = {
  segments: VeloIntensitySegment[];
  activeValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  demandValue?: string | null;
};

export function VeloIntensityRail({
  segments,
  activeValue,
  onSelect,
  disabled = false,
  ariaLabel,
  className = "",
  demandValue = null,
}: VeloIntensityRailProps) {
  return (
    <div className={`velo-intensity-rail training-v2-intensity-rail${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {segments.map((segment) => {
        const isActive = segment.value === activeValue;
        const isDemanded = demandValue != null && segment.value === demandValue;
        const toneClass = segment.toneClass ?? `is-${segment.value}`;
        return (
          <button
            key={segment.value}
            className={`velo-intensity-segment training-v2-intensity-segment ${toneClass}${isActive ? " is-active" : ""}${isDemanded ? " is-demanded" : ""}`}
            type="button"
            disabled={disabled || segment.disabled}
            title={segment.note}
            onClick={() => onSelect(segment.value)}
          >
            <span className="velo-intensity-segment-label">{segment.label}</span>
            {segment.lines.map((line) => (
              <small key={`${segment.value}-${line}`}>{line}</small>
            ))}
          </button>
        );
      })}
    </div>
  );
}

export type TrainingModeSegmentInput = {
  value: string;
  label: string;
  /** Organic per-training-cycle stat budget (matches the "Training" tile, e.g. 3,4/4,3/6,1). */
  trainingSetpoints: number;
  /** Season-end spendable bonus-XP pool for manual attribute upgrades (unrelated scale, e.g. 40/70/110). */
  baseXp?: number;
  recoveryDeltaPct: number;
  fatigueLoad: number;
  note?: string;
};

export function buildTrainingModeSegments(options: TrainingModeSegmentInput[]): VeloIntensitySegment[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    toneClass: `is-${option.value}`,
    note:
      option.baseXp != null
        ? `${option.note ?? ""}${option.note ? " " : ""}Separat: +${formatVeloNumber(option.baseXp, 0)} Saison-Bonus-XP zum manuellen Ausgeben am Saisonende.`.trim()
        : option.note,
    lines: [
      `+${formatVeloNumber(option.trainingSetpoints, 1)} Trainingsbudget`,
      formatTrainingModeRecoveryLabel(option.recoveryDeltaPct),
      `Fatigue ${formatVeloNumber(option.fatigueLoad, 0)}`,
    ],
  }));
}
