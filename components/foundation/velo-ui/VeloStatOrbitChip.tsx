"use client";

import { getArenaAxisValueTier } from "@/lib/matchday-arena/arena-stat-visuals";

import { formatVeloNumber } from "@/components/foundation/velo-ui/formatters";

export type VeloAxisKey = "pow" | "spe" | "men" | "soc";

const AXIS_META: Record<VeloAxisKey, { label: string; tone: string }> = {
  pow: { label: "POW", tone: "is-pow" },
  spe: { label: "SPE", tone: "is-spe" },
  men: { label: "MEN", tone: "is-men" },
  soc: { label: "SOC", tone: "is-soc" },
};

type VeloStatOrbitChipProps = {
  axis: VeloAxisKey;
  value: number;
  className?: string;
};

export function VeloStatOrbitChip({ axis, value, className = "" }: VeloStatOrbitChipProps) {
  const meta = AXIS_META[axis];
  const tier = getArenaAxisValueTier(value);
  return (
    <span
      className={`velo-stat-orbit-chip training-v2-rider-orbit-chip ${meta.tone} is-tier-${tier}${className ? ` ${className}` : ""}`}
      title={`${meta.label} ${formatVeloNumber(value, 0)}`}
    >
      <small>{meta.label}</small>
      <strong>{formatVeloNumber(value, 0)}</strong>
    </span>
  );
}

type VeloStatOrbitRowProps = {
  stats: { pow: number; spe: number; men: number; soc: number };
  ariaLabel?: string;
  className?: string;
};

export function VeloStatOrbitRow({ stats, ariaLabel, className = "" }: VeloStatOrbitRowProps) {
  return (
    <div className={`velo-stat-orbit-row training-v2-rider-orbit${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      <VeloStatOrbitChip axis="pow" value={stats.pow} />
      <VeloStatOrbitChip axis="spe" value={stats.spe} />
      <VeloStatOrbitChip axis="men" value={stats.men} />
      <VeloStatOrbitChip axis="soc" value={stats.soc} />
    </div>
  );
}
