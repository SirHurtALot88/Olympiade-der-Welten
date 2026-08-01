import type {
  LegacyActivePlayerRef,
  LegacyInjuryRiskProjectionRef,
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
  injuryStatus: LegacyRosterPlayerRef["injuryStatus"];
  injuryUntilMatchday: string | null;
  injuryRiskPercent: number | null;
  injuryRiskBand: string | null;
  injuryRiskLabel: string | null;
  /** Einsatz-Risiko je Intensitaet — vorberechnet aus dem echten Wurf-Modell, siehe LegacyInjuryRiskProjectionRef. */
  injuryRiskProjection: LegacyInjuryRiskProjectionRef | null;
};

export function buildLegacyLineupLabSlots(context: LegacyLineupLoadedContext): LegacyLineupLabSlot[] {
  const disciplineNameById = new Map(context.disciplines.map((discipline) => [discipline.id, discipline.name]));
  const result: LegacyLineupLabSlot[] = [];

  const d1DisciplineId = context.contextMeta.d1DisciplineId;
  const d2DisciplineId = context.contextMeta.d2DisciplineId;

  if (d1DisciplineId) {
    const count = resolveSideSlotCount(context, d1DisciplineId, "d1");
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
    const count = resolveSideSlotCount(context, d2DisciplineId, "d2");
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

/**
 * Slot-Anzahl je Disziplin-Seite: MUSS dem saisonal gewürfelten Schedule-Wert
 * folgen (disciplineSidePlayerCounts, Key "<id>::<side>"), nicht dem statischen
 * Basis-playerCount. Sonst rendert die Einsatzliste zu wenige/zu viele Slots
 * gegenüber dem, was Validator, Readiness und die AI verlangen — und der User
 * kann nicht alle Spieler einsetzen bzw. bekommt die Aufstellung nicht bestätigt.
 * Gleiches Fallback-Muster wie die AI-Engine (ai-legacy-lineup-engine.ts).
 */
function resolveSideSlotCount(
  context: LegacyLineupLoadedContext,
  disciplineId: string,
  side: "d1" | "d2",
): number {
  return (
    context.disciplineSidePlayerCounts?.[`${disciplineId}::${side}`] ??
    context.disciplinePlayerCounts[disciplineId] ??
    0
  );
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
      injuryStatus: player?.injuryStatus ?? "healthy",
      injuryUntilMatchday: player?.injuryUntilMatchday ?? null,
      injuryRiskPercent: player?.injuryRiskPercent ?? null,
      injuryRiskBand: player?.injuryRiskBand ?? null,
      injuryRiskLabel: player?.injuryRiskLabel ?? null,
      injuryRiskProjection: player?.injuryRiskProjection ?? null,
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
