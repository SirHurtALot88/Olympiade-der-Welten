import { PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import { TRAINING_RECOVERY_IMPACT } from "@/lib/training/training-recovery-impact";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

/** Base training budget per mode (season-end organic progression).
 *  Calibrated for peak P90 ~4.5–8 and league Ø Δ within ±0.4. */
export const TRAINING_SETPOINTS_BY_MODE: Record<PlayerTrainingMode, number> = {
  leicht: 3.19,
  mittel: 4.04,
  hart: 5.74,
};

export const FATIGUE_LOAD_BY_MODE: Record<PlayerTrainingMode, number> = {
  leicht: 6,
  mittel: 12,
  hart: 22,
};

export type TrainingModePresentation = {
  value: PlayerTrainingMode;
  label: string;
  note: string;
  baseXp: number;
  recoveryDeltaPct: number;
  trainingSetpoints: number;
  fatigueLoad: number;
  fatigueRisk: "niedrig" | "mittel" | "hoch";
  strainLabel: string;
};

const TRAINING_MODE_NOTES: Record<PlayerTrainingMode, string> = {
  leicht: "Schonend, weniger Base-XP, bessere Regeneration.",
  mittel: "Standardfokus fuer stabile Entwicklung und normale Erholung.",
  hart: "Mehr Base-XP, aber spuerbar schlechtere Regeneration.",
};

const TRAINING_MODE_FATIGUE_RISK: Record<PlayerTrainingMode, TrainingModePresentation["fatigueRisk"]> = {
  leicht: "niedrig",
  mittel: "mittel",
  hart: "hoch",
};

export const TRAINING_MODE_ORDER: PlayerTrainingMode[] = ["leicht", "mittel", "hart"];

export function getTrainingModePresentation(mode: PlayerTrainingMode): TrainingModePresentation {
  const recovery = TRAINING_RECOVERY_IMPACT[mode] ?? TRAINING_RECOVERY_IMPACT.mittel;
  return {
    value: mode,
    label: recovery.label,
    note: TRAINING_MODE_NOTES[mode],
    baseXp: PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode[mode],
    recoveryDeltaPct: recovery.recoveryDeltaPct,
    trainingSetpoints: TRAINING_SETPOINTS_BY_MODE[mode],
    fatigueLoad: FATIGUE_LOAD_BY_MODE[mode],
    fatigueRisk: TRAINING_MODE_FATIGUE_RISK[mode],
    strainLabel: recovery.strainLabel,
  };
}

export function getAllTrainingModePresentations(): TrainingModePresentation[] {
  return TRAINING_MODE_ORDER.map((mode) => getTrainingModePresentation(mode));
}

export function formatTrainingModeRecoveryLabel(deltaPct: number) {
  if (deltaPct > 0) return `+${deltaPct}% Reg`;
  if (deltaPct < 0) return `${deltaPct}% Reg`;
  return "±0 Reg";
}
