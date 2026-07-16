import { describe, expect, it } from "vitest";

import {
  FATIGUE_LOAD_BY_MODE,
  TRAINING_SETPOINTS_BY_MODE,
  getAllTrainingModePresentations,
  getTrainingModePresentation,
} from "@/lib/training/training-mode-presentation";
import { PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import { TRAINING_RECOVERY_IMPACT } from "@/lib/training/training-recovery-impact";

describe("training-mode-presentation", () => {
  it("keeps mode constants aligned across presentation sources", () => {
    const leicht = getTrainingModePresentation("leicht");
    const mittel = getTrainingModePresentation("mittel");
    const hart = getTrainingModePresentation("hart");

    expect(leicht.baseXp).toBe(PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.leicht);
    expect(mittel.baseXp).toBe(PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.mittel);
    expect(hart.baseXp).toBe(PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.hart);

    expect(leicht.recoveryDeltaPct).toBe(TRAINING_RECOVERY_IMPACT.leicht.recoveryDeltaPct);
    expect(mittel.recoveryDeltaPct).toBe(TRAINING_RECOVERY_IMPACT.mittel.recoveryDeltaPct);
    expect(hart.recoveryDeltaPct).toBe(TRAINING_RECOVERY_IMPACT.hart.recoveryDeltaPct);

    expect(leicht.trainingSetpoints).toBe(TRAINING_SETPOINTS_BY_MODE.leicht);
    expect(hart.fatigueLoad).toBe(FATIGUE_LOAD_BY_MODE.hart);
  });

  it("returns all three modes in order", () => {
    expect(getAllTrainingModePresentations().map((entry) => entry.value)).toEqual(["leicht", "mittel", "hart"]);
  });
});
