import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export const TRAINING_RECOVERY_IMPACT: Record<
  PlayerTrainingMode,
  {
    label: string;
    recoveryMultiplier: number;
    recoveryDeltaPct: number;
    strainLabel: "schonend" | "normal" | "belastend";
  }
> = {
  leicht: {
    label: "Leicht",
    recoveryMultiplier: 1.25,
    recoveryDeltaPct: 25,
    strainLabel: "schonend",
  },
  mittel: {
    label: "Mittel",
    recoveryMultiplier: 1,
    recoveryDeltaPct: 0,
    strainLabel: "normal",
  },
  hart: {
    label: "Hart",
    recoveryMultiplier: 0.68,
    recoveryDeltaPct: -32,
    strainLabel: "belastend",
  },
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function applyTrainingRecoveryImpact(baseRecovery: number, mode: PlayerTrainingMode) {
  const impact = TRAINING_RECOVERY_IMPACT[mode] ?? TRAINING_RECOVERY_IMPACT.mittel;
  return {
    before: round(baseRecovery),
    after: round(Math.max(0, baseRecovery * impact.recoveryMultiplier)),
    modifierPct: impact.recoveryDeltaPct,
    label: impact.label,
    strainLabel: impact.strainLabel,
  };
}
