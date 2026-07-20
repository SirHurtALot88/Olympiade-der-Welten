import { buildLegacyLineupAggregateScore, scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import type {
  DisciplineSide,
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupPreview,
  LegacyLineupRepositoryContext,
  LegacyLineupSaveResult,
} from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";

function normalizeEntries(entries: LegacyLineupEntryInput[]) {
  return [...entries]
    .map((entry) => ({
      ...entry,
      disciplineId: entry.disciplineId.trim(),
      playerId: entry.playerId.trim(),
      disciplineSide: entry.disciplineSide,
      activePlayerId: entry.activePlayerId?.trim() ?? null,
    }))
    .sort((left, right) => {
      if (left.disciplineId !== right.disciplineId) {
        return left.disciplineId.localeCompare(right.disciplineId);
      }
      if (left.disciplineSide !== right.disciplineSide) {
        return left.disciplineSide.localeCompare(right.disciplineSide);
      }
      return left.slotIndex - right.slotIndex;
    });
}

function isDisciplineSide(value: string): value is DisciplineSide {
  return value === "d1" || value === "d2";
}

function buildDisciplineSidePlayerCounts(
  entries: LegacyLineupEntryInput[],
  disciplinePlayerCounts: Record<string, number>,
) {
  return Object.fromEntries(
    Array.from(new Set(entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`))).map((key) => {
      const [disciplineId] = key.split("::");
      return [key, disciplinePlayerCounts[disciplineId] ?? 0] as const;
    }),
  );
}

export class LegacyLineupService {
  constructor(private readonly repository: Pick<
    LegacyLineupRepository,
    "getLegacyLineupDraft" | "getLegacyLineupRepositoryContext" | "saveLegacyLineupDraft"
  > = new LegacyLineupRepository()) {}

  async getLegacyLineupDraft(params: LegacyLineupKeyParams): Promise<LegacyLineupDraft | null> {
    return this.repository.getLegacyLineupDraft(params);
  }

  async saveLegacyLineupDraft(
    params: LegacyLineupKeyParams,
    entries: LegacyLineupEntryInput[],
  ): Promise<LegacyLineupSaveResult> {
    const normalizedEntries = normalizeEntries(entries);

    for (const entry of normalizedEntries) {
      if (!isDisciplineSide(entry.disciplineSide)) {
        return {
          ok: false,
          errors: [`Invalid disciplineSide "${String(entry.disciplineSide)}". Expected d1 or d2.`],
          warnings: [],
        };
      }
    }

    const context = await this.repository.getLegacyLineupRepositoryContext(params, normalizedEntries);
    if (!context) {
      return {
        ok: false,
        errors: ["saveId, seasonId, matchdayId or teamId could not be resolved for the Prisma lineup context."],
        warnings: [],
      };
    }

    const validation = validateLegacyLineupContext({
      ...context,
      entries: normalizedEntries,
      disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(normalizedEntries, context.disciplinePlayerCounts),
    });

    if (!validation.isValid) {
      return {
        ok: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    const draft = await this.repository.saveLegacyLineupDraft(params, normalizedEntries);
    return {
      ok: true,
      draft,
      warnings: validation.warnings,
    };
  }

  async calculateLegacyLineupPreview(params: LegacyLineupKeyParams): Promise<LegacyLineupPreview | null> {
    const draft = await this.repository.getLegacyLineupDraft(params);
    if (!draft) {
      return null;
    }

    const context = await this.repository.getLegacyLineupRepositoryContext(params, draft.entries);
    if (!context) {
      return null;
    }

    return buildLegacyLineupPreview(draft, context);
  }
}

export function buildLegacyLineupPreview(
  draft: LegacyLineupDraft,
  context: LegacyLineupRepositoryContext,
): LegacyLineupPreview {
  const validation = validateLegacyLineupContext({
    ...context,
    entries: draft.entries,
  });
  const groupedKeys = Array.from(
    new Set(draft.entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`)),
  );

  const disciplineSideScores = groupedKeys.map((groupKey) => {
    const [disciplineId, disciplineSide] = groupKey.split("::") as [string, DisciplineSide];
    return scoreLegacyLineupDisciplineSide({
      disciplineId,
      disciplineSide,
      matchdayId: context.matchdayId, // Form-Jitter pro Spieltag
      entries: draft.entries,
      disciplineScores: context.disciplineScores,
      activePlayers: context.activePlayers,
      requiredPlayers: context.disciplineSidePlayerCounts?.[groupKey] ?? context.disciplinePlayerCounts[disciplineId] ?? null,
    });
  });

  const scorePreview = buildLegacyLineupAggregateScore(disciplineSideScores);

  return {
    ...draft,
    scorePreview,
    totalScore: scorePreview.totalScore,
    disciplineSideScores,
    validationWarnings: [...validation.warnings, ...scorePreview.validationWarnings],
    missingScores: scorePreview.missingScores,
  };
}
