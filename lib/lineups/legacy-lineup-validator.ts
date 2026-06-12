import type {
  LegacyLineupContext,
  LegacyLineupValidationOptions,
  LegacyLineupValidationResult,
} from "@/lib/lineups/legacy-lineup-types";

export function validateLegacyLineupContext(
  input: LegacyLineupContext,
  options: LegacyLineupValidationOptions = {},
): LegacyLineupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const enforceCompleteness = options.enforceCompleteness ?? true;

  const activePlayerById = new Map(input.activePlayers.map((player) => [player.id, player]));
  const playerUsageByMatchday = new Map<string, string>();
  const entriesByDisciplineSide = new Map<string, number>();
  const captainCountByDisciplineSide = new Map<string, number>();

  for (const entry of input.entries) {
    if (!entry.activePlayerId) {
      errors.push(`Entry ${entry.disciplineId}/${entry.disciplineSide}/slot-${entry.slotIndex} is missing activePlayerId.`);
      continue;
    }

    const activePlayer = activePlayerById.get(entry.activePlayerId);
    if (!activePlayer) {
      errors.push(`activePlayerId ${entry.activePlayerId} does not exist in the provided team roster.`);
      continue;
    }

    if (activePlayer.saveId !== input.saveId || activePlayer.seasonId !== input.seasonId || activePlayer.teamId !== input.teamId) {
      errors.push(
        `activePlayerId ${entry.activePlayerId} does not belong to save ${input.saveId}, season ${input.seasonId}, team ${input.teamId}.`,
      );
    }

    if (activePlayer.playerId !== entry.playerId) {
      errors.push(`playerId ${entry.playerId} does not match activePlayerId ${entry.activePlayerId}.`);
    }

    const usageKey = entry.playerId;
    const usageSlot = `${entry.disciplineId}/${entry.disciplineSide}/slot-${entry.slotIndex}`;
    const previousUsage = playerUsageByMatchday.get(usageKey);
    if (previousUsage) {
      errors.push(`Player ${entry.playerId} is used more than once in matchday ${input.matchdayId}: ${previousUsage} and ${usageSlot}.`);
    } else {
      playerUsageByMatchday.set(usageKey, usageSlot);
    }

    const countKey = `${entry.disciplineId}::${entry.disciplineSide}`;
    entriesByDisciplineSide.set(countKey, (entriesByDisciplineSide.get(countKey) ?? 0) + 1);
    if (entry.isCaptain) {
      captainCountByDisciplineSide.set(countKey, (captainCountByDisciplineSide.get(countKey) ?? 0) + 1);
    }
  }

  const expectedCountsBySide =
    input.disciplineSidePlayerCounts ??
    Object.fromEntries(
      Object.entries(input.disciplinePlayerCounts).flatMap(([disciplineId, expectedCount]) =>
        (["d1", "d2"] as const).map((side) => [`${disciplineId}::${side}`, expectedCount] as const),
      ),
    );

  for (const [key, expectedCount] of Object.entries(expectedCountsBySide)) {
    const [disciplineId, side] = key.split("::");
    if (side !== "d1" && side !== "d2") {
      continue;
    }

      const actualCount = entriesByDisciplineSide.get(key) ?? 0;

    if (actualCount !== expectedCount) {
      const message = `Discipline ${disciplineId} on ${side} expects ${expectedCount} entries, but received ${actualCount}.`;
      if (enforceCompleteness) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }

    const expectedCaptains = input.disciplineSideCaptainCounts?.[key] ?? 0;
    const actualCaptains = captainCountByDisciplineSide.get(key) ?? 0;
    if (actualCaptains > 1) {
      errors.push(`Discipline ${disciplineId} on ${side} allows at most 1 captain, but received ${actualCaptains}.`);
    }
    if (expectedCaptains > 0 && actualCaptains !== expectedCaptains) {
      const message = `Discipline ${disciplineId} on ${side} expects ${expectedCaptains} captains, but received ${actualCaptains}.`;
      if (enforceCompleteness) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  const seasonCaptainLimit = options.seasonCaptainLimit ?? null;
  if (seasonCaptainLimit != null) {
    const currentDraftCaptainSides = Array.from(captainCountByDisciplineSide.entries())
      .filter(([, value]) => value > 0)
      .map(([key]) => key);
    const captainUsedBeforeCurrentDraftSides = options.captainUsedBeforeCurrentDraftSides ?? [];
    const totalCaptainSides = new Set([
      ...captainUsedBeforeCurrentDraftSides,
      ...currentDraftCaptainSides,
    ]);
    const totalCaptainCount = totalCaptainSides.size;
    const captainUsedBeforeCurrentDraft = options.captainUsedBeforeCurrentDraft ?? 0;
    const fallbackCaptainCount = captainUsedBeforeCurrentDraft + currentDraftCaptainSides.length;
    const effectiveCaptainCount =
      captainUsedBeforeCurrentDraftSides.length > 0 ? totalCaptainCount : fallbackCaptainCount;

    if (effectiveCaptainCount > seasonCaptainLimit) {
      errors.push(
        `Season captain limit ${seasonCaptainLimit} would be exceeded (${effectiveCaptainCount}).`,
      );
    }
  }

  for (const entry of input.entries) {
    if (!input.disciplinePlayerCounts[entry.disciplineId]) {
      warnings.push(`Discipline ${entry.disciplineId} has no configured playerCount in the provided context.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
