import { PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import { TRAINING_RECOVERY_IMPACT } from "@/lib/training/training-recovery-impact";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

/** Base training budget per mode (season-end organic progression).
 *  Calibrated for peak P90 ~5–8 and league Ø Δ within ±0.4.
 *
 *  2026-08-01: um Faktor 0,76 gesenkt (3,6/4,56/6,47 → 2,74/3,47/4,92). Chris' Zielvorgabe ist ein
 *  Ø-Performance-Anteil von 50 % am Bruttozuwachs; gemessen waren es 34,3 %
 *  (`npm run training:source-share-audit`, Save new-game-1785174792968-8d7mdx, 332 Spieler).
 *
 *  Warum SENKEN statt die Performance allein anheben: der Anteil allein ueber Performance zu
 *  erreichen haette Performance × 1,92 gebraucht und den Liga-Ø-Netto von +0,73 auf ≈ +2,9
 *  getrieben — weit aus dem Korridor [-0,4; +0,4]. Das Paar (Performance × 1,46, Training × 0,76)
 *  verschiebt das VERHAELTNIS und laesst die Bruttosumme, und damit den Netto-Haushalt, stehen.
 *
 *  Der Spillover stammt aus demselben Budget und skaliert deshalb automatisch mit. */
export const TRAINING_SETPOINTS_BY_MODE: Record<PlayerTrainingMode, number> = {
  leicht: 3.43,
  mittel: 4.34,
  hart: 6.15,
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
  mittel: "Standardfokus für stabile Entwicklung und normale Erholung.",
  hart: "Mehr Base-XP, aber spürbar schlechtere Regeneration.",
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
