import type { FormCardPlanRecord } from "@/lib/data/olyDataTypes";
import type { LegacyFormCardOption } from "@/lib/lineups/legacy-lineup-types";

export type OpenFormPickCell = {
  matchdayId: string;
  disciplineSide: "d1" | "d2";
  slot: "primary" | "secondary";
  disciplineId: string | null;
  disciplineColor: LegacyFormCardOption["color"] | null;
};

type ScheduleEntry = {
  matchdayId: string;
  matchdayIndex: number;
  discipline1: { disciplineId: string | null; category: string | null } | null;
  discipline2: { disciplineId: string | null; category: string | null } | null;
};

export function resolveFirstOpenFormPickCell(input: {
  schedule: ScheduleEntry[];
  formCardPlanByKey: Map<string, FormCardPlanRecord>;
  currentMatchdayId: string;
  getFormCardColorForCategory: (category: string | null | undefined) => LegacyFormCardOption["color"] | null;
}): OpenFormPickCell | null {
  const sortedEntries = [...input.schedule].sort((left, right) => {
    if (left.matchdayId === input.currentMatchdayId) return -1;
    if (right.matchdayId === input.currentMatchdayId) return 1;
    return left.matchdayIndex - right.matchdayIndex;
  });

  for (const entry of sortedEntries) {
    for (const disciplineSide of ["d1", "d2"] as const) {
      const slot = disciplineSide === "d1" ? entry.discipline1 : entry.discipline2;
      if (!slot) {
        continue;
      }
      const plan = input.formCardPlanByKey.get(`${entry.matchdayId}:${disciplineSide}`);
      const disciplineColor = input.getFormCardColorForCategory(slot.category);
      if (!plan?.primaryFormCardId) {
        return {
          matchdayId: entry.matchdayId,
          disciplineSide,
          slot: "primary",
          disciplineId: slot.disciplineId,
          disciplineColor,
        };
      }
      if (!plan?.secondaryFormCardId) {
        return {
          matchdayId: entry.matchdayId,
          disciplineSide,
          slot: "secondary",
          disciplineId: slot.disciplineId,
          disciplineColor,
        };
      }
    }
  }

  return null;
}
