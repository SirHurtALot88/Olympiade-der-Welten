import type {
  LegacyActivePlayerRef,
  LegacyLineupEntryInput,
  LegacyLineupLoadedContext,
  LegacyRosterPlayerRef,
} from "@/lib/lineups/legacy-lineup-types";

export type LegacyLineupLabSlot = {
  key: string;
  disciplineId: string;
  disciplineName: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
};

export type LegacyLineupLabPlayerOption = {
  activePlayerId: string;
  playerId: string;
  name: string;
  disciplineScores: Record<string, number | null>;
  fatigueCount: number | null;
};

export function buildLegacyLineupLabSlots(context: LegacyLineupLoadedContext): LegacyLineupLabSlot[] {
  const disciplineNameById = new Map(context.disciplines.map((discipline) => [discipline.id, discipline.name]));
  const result: LegacyLineupLabSlot[] = [];

  const d1DisciplineId = context.contextMeta.d1DisciplineId;
  const d2DisciplineId = context.contextMeta.d2DisciplineId;

  if (d1DisciplineId) {
    const count = context.disciplinePlayerCounts[d1DisciplineId] ?? 0;
    for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
      result.push({
        key: `${d1DisciplineId}::d1::${slotIndex}`,
        disciplineId: d1DisciplineId,
        disciplineName: disciplineNameById.get(d1DisciplineId) ?? d1DisciplineId,
        disciplineSide: "d1",
        slotIndex,
      });
    }
  }

  if (d2DisciplineId) {
    const count = context.disciplinePlayerCounts[d2DisciplineId] ?? 0;
    for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
      result.push({
        key: `${d2DisciplineId}::d2::${slotIndex}`,
        disciplineId: d2DisciplineId,
        disciplineName: disciplineNameById.get(d2DisciplineId) ?? d2DisciplineId,
        disciplineSide: "d2",
        slotIndex,
      });
    }
  }

  return result;
}

export function buildLegacyLineupLabPlayerOptions(context: LegacyLineupLoadedContext): LegacyLineupLabPlayerOption[] {
  const rosterByPlayerId = new Map<string, LegacyRosterPlayerRef>(context.rosterPlayers.map((player) => [player.id, player]));
  const scoreByPlayerAndDiscipline = new Map(
    context.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score] as const),
  );

  return context.activePlayers.map((activePlayer: LegacyActivePlayerRef) => {
    const player = rosterByPlayerId.get(activePlayer.playerId);
    return {
      activePlayerId: activePlayer.id,
      playerId: activePlayer.playerId,
      name: player?.name ?? activePlayer.playerId,
      disciplineScores: Object.fromEntries(
        context.disciplines.map((discipline) => [
          discipline.id,
          scoreByPlayerAndDiscipline.get(`${activePlayer.playerId}::${discipline.id}`) ?? null,
        ]),
      ),
      fatigueCount: context.fatigueByPlayerId?.[activePlayer.playerId]?.count ?? null,
    };
  });
}

export function buildLegacyLineupEntriesFromSelections(input: {
  slots: LegacyLineupLabSlot[];
  selections: Record<string, string>;
  playerOptions: LegacyLineupLabPlayerOption[];
}): LegacyLineupEntryInput[] {
  const optionByActivePlayerId = new Map(input.playerOptions.map((option) => [option.activePlayerId, option]));
  const entries: LegacyLineupEntryInput[] = [];

  for (const slot of input.slots) {
    const activePlayerId = input.selections[slot.key];
    if (!activePlayerId) {
      continue;
    }

    const playerOption = optionByActivePlayerId.get(activePlayerId);
    if (!playerOption) {
      continue;
    }

    entries.push({
      disciplineId: slot.disciplineId,
      disciplineSide: slot.disciplineSide,
      slotIndex: slot.slotIndex,
      playerId: playerOption.playerId,
      activePlayerId: playerOption.activePlayerId,
    });
  }

  return entries;
}

export function findDuplicateActivePlayerSelections(selections: Record<string, string>) {
  const counts = new Map<string, number>();
  for (const activePlayerId of Object.values(selections)) {
    if (!activePlayerId) {
      continue;
    }
    counts.set(activePlayerId, (counts.get(activePlayerId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([activePlayerId]) => activePlayerId);
}
