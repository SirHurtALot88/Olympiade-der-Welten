"use client";

import Image from "next/image";

import { getArenaAxisValueTier, getCoreStatGrade } from "@/lib/matchday-arena/arena-stat-visuals";

import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";

export type VeloAxisKey = "pow" | "spe" | "men" | "soc";

const AXIS_META: Record<VeloAxisKey, { label: string; tone: string; icon: string }> = {
  pow: { label: "POW", tone: "is-pow", icon: "/discipline-icons/POW.svg" },
  spe: { label: "SPE", tone: "is-spe", icon: "/discipline-icons/SPE.svg" },
  men: { label: "MEN", tone: "is-men", icon: "/discipline-icons/MEN.svg" },
  soc: { label: "SOC", tone: "is-soc", icon: "/discipline-icons/SOC.svg" },
};

type VeloStatOrbitChipProps = {
  axis: VeloAxisKey;
  value: number;
  showGrade?: boolean;
  showIcon?: boolean;
  className?: string;
};

export function VeloStatOrbitChip({ axis, value, showGrade = false, showIcon = false, className = "" }: VeloStatOrbitChipProps) {
  const meta = AXIS_META[axis];
  const tier = getArenaAxisValueTier(value);
  const grade = showGrade ? getCoreStatGrade(value) : null;
  return (
    <span
      className={`velo-stat-orbit-chip training-v2-rider-orbit-chip ${meta.tone} is-tier-${tier}${className ? ` ${className}` : ""}`}
      title={`${meta.label} ${formatNlNumber(value, 0)}${grade ? ` (${grade})` : ""}`}
    >
      {showIcon ? (
        <Image
          src={meta.icon}
          alt={meta.label}
          width={12}
          height={12}
          className="velo-stat-orbit-icon"
          aria-hidden
        />
      ) : (
        <small>{meta.label}</small>
      )}
      <strong>{formatNlNumber(value, 0)}</strong>
      {grade ? <span className="velo-stat-orbit-grade">{grade}</span> : null}
    </span>
  );
}

type VeloStatOrbitRowProps = {
  stats: { pow: number; spe: number; men: number; soc: number };
  ariaLabel?: string;
  showGrade?: boolean;
  showIcon?: boolean;
  className?: string;
};

export function VeloStatOrbitRow({ stats, ariaLabel, showGrade = false, showIcon = false, className = "" }: VeloStatOrbitRowProps) {
  return (
    <div className={`velo-stat-orbit-row training-v2-rider-orbit${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      <VeloStatOrbitChip axis="pow" value={stats.pow} showGrade={showGrade} showIcon={showIcon} />
      <VeloStatOrbitChip axis="spe" value={stats.spe} showGrade={showGrade} showIcon={showIcon} />
      <VeloStatOrbitChip axis="men" value={stats.men} showGrade={showGrade} showIcon={showIcon} />
      <VeloStatOrbitChip axis="soc" value={stats.soc} showGrade={showGrade} showIcon={showIcon} />
    </div>
  );
}
