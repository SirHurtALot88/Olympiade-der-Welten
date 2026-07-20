import type { SeasonDisciplineScheduleEntry } from "@/lib/data/olyDataTypes";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import type { GameState } from "@/lib/data/olyDataTypes";

export type TransfermarktDoubleLoadWarning = {
  matchdayId: string;
  matchdayLabel: string;
  disciplineIds: [string, string];
  disciplineNames: [string, string];
  tooltip: string;
};

export type TopDisciplineLike = {
  disciplineId: string;
  disciplineName: string;
};

function findDoubleLoadWarningsInSchedule(input: {
  schedule: SeasonDisciplineScheduleEntry[];
  topDisciplines: TopDisciplineLike[];
}) {
  const topById = new Map(input.topDisciplines.slice(0, 3).map((entry) => [entry.disciplineId, entry.disciplineName] as const));
  const warnings: TransfermarktDoubleLoadWarning[] = [];

  for (const scheduleEntry of input.schedule) {
    const firstId = scheduleEntry.discipline1?.disciplineId ?? null;
    const secondId = scheduleEntry.discipline2?.disciplineId ?? null;
    if (!firstId || !secondId || !topById.has(firstId) || !topById.has(secondId)) {
      continue;
    }

    const firstName = topById.get(firstId) ?? scheduleEntry.discipline1?.displayName ?? firstId;
    const secondName = topById.get(secondId) ?? scheduleEntry.discipline2?.displayName ?? secondId;
    warnings.push({
      matchdayId: scheduleEntry.matchdayId,
      matchdayLabel: scheduleEntry.matchdayLabel,
      disciplineIds: [firstId, secondId],
      disciplineNames: [firstName, secondName],
      tooltip: `Doppelbelastung: ${firstName} und ${secondName} liegen beide in den Top 3 dieses Spielers und laufen am ${scheduleEntry.matchdayLabel} parallel.`,
    });
  }

  return warnings;
}

export function buildTransfermarktDoubleLoadWarnings(input: {
  gameState: GameState;
  scoutingLevel?: number | null;
  topDisciplines: TopDisciplineLike[];
  saveId?: string | null;
}) {
  if ((input.scoutingLevel ?? 0) < 3 || input.topDisciplines.length < 2) {
    return [];
  }

  return findDoubleLoadWarningsInSchedule({
    schedule: getSeasonDisciplineSchedule(input.gameState, { saveId: input.saveId }),
    topDisciplines: input.topDisciplines,
  });
}

