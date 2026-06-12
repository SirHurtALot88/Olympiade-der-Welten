import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type {
  DisciplineSide,
  LegacyLineupEntryInput,
  LegacyLineupLoadedContext,
} from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";

export type LegacyMatchdayReadinessStatus =
  | "ready"
  | "underfilled_roster"
  | "missing_lineup"
  | "invalid_lineup"
  | "missing_score_coverage"
  | "unknown";

export type LegacyMatchdayReadiness = {
  teamId: string;
  teamName: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  d1DisciplineId: string | null;
  d2DisciplineId: string | null;
  d1Required: number;
  d2Required: number;
  requiredTotalUniquePlayers: number;
  activePlayersCount: number;
  hasExistingLineup: boolean;
  matchdayReady: boolean;
  readinessStatus: LegacyMatchdayReadinessStatus;
  missingPlayersToMin7: number;
  missingPlayersToRequirement: number;
  missingScoresCount: number;
  validationWarnings: string[];
  reasonCodes: string[];
  shortReason: string;
};

const LEGACY_MATCHDAY_MINIMUM_PLAYERS = 7;

function buildDisciplineSidePlayerCounts(entries: LegacyLineupEntryInput[], context: LegacyLineupLoadedContext) {
  const uniquePairs = Array.from(new Set(entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`)));
  return Object.fromEntries(
    uniquePairs.map((key) => {
      const [disciplineId] = key.split("::");
      return [key, context.disciplinePlayerCounts[disciplineId] ?? 0] as const;
    }),
  );
}

function buildScoreCoverage(entries: LegacyLineupEntryInput[], context: LegacyLineupLoadedContext) {
  const uniquePairs = Array.from(new Set(entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`)));
  const parts = uniquePairs.map((pair) => {
    const [disciplineId, disciplineSide] = pair.split("::") as [string, DisciplineSide];
    return scoreLegacyLineupDisciplineSide({
      disciplineId,
      disciplineSide,
      entries,
      disciplineScores: context.disciplineScores,
    });
  });

  return {
    missingScores: parts.flatMap((part) => part.missingScores),
    validationWarnings: parts.flatMap((part) => part.validationWarnings),
  };
}

export function buildLegacyMatchdayReadiness(context: LegacyLineupLoadedContext): LegacyMatchdayReadiness {
  const draft = context.existingDraft;
  const entries = draft?.entries ?? [];
  const d1DisciplineId = context.contextMeta.d1DisciplineId;
  const d2DisciplineId = context.contextMeta.d2DisciplineId;
  const d1Required = d1DisciplineId ? (context.disciplinePlayerCounts[d1DisciplineId] ?? 0) : 0;
  const d2Required = d2DisciplineId ? (context.disciplinePlayerCounts[d2DisciplineId] ?? 0) : 0;
  const requiredTotalUniquePlayers = d1Required + d2Required;
  const activePlayersCount = context.activePlayers.length;
  const missingPlayersToRequirement = Math.max(0, requiredTotalUniquePlayers - activePlayersCount);
  const missingPlayersToMin7 = Math.max(0, 7 - activePlayersCount);
  const base = {
    teamId: context.team.id,
    teamName: context.team.name,
    saveId: context.saveId,
    seasonId: context.seasonId,
    matchdayId: context.matchdayId,
    d1DisciplineId,
    d2DisciplineId,
    d1Required,
    d2Required,
    requiredTotalUniquePlayers,
    activePlayersCount,
    hasExistingLineup: Boolean(draft),
    missingPlayersToMin7,
    missingPlayersToRequirement,
  };

  if (activePlayersCount < LEGACY_MATCHDAY_MINIMUM_PLAYERS) {
    return {
      ...base,
      matchdayReady: false,
      readinessStatus: "underfilled_roster",
      missingScoresCount: 0,
      validationWarnings: draft ? [] : ["No existing legacy lineup draft was found for this team and matchday."],
      reasonCodes: ["under_minimum_matchday_players"],
      shortReason: `Needs at least ${LEGACY_MATCHDAY_MINIMUM_PLAYERS} active players, has ${activePlayersCount}.`,
    };
  }

  if (!draft) {
    return {
      ...base,
      matchdayReady: false,
      readinessStatus: "missing_lineup",
      missingScoresCount: 0,
      validationWarnings: ["No existing legacy lineup draft was found for this team and matchday."],
      reasonCodes: ["no_existing_draft"],
      shortReason: "Team could play the matchday, but no draft lineup is saved.",
    };
  }

  const allowPartialLineup = activePlayersCount < requiredTotalUniquePlayers;
  const validation = validateLegacyLineupContext({
    ...context,
    entries,
    disciplinePlayerCounts:
      entries.length > 0
        ? Object.fromEntries(
            Object.entries(context.disciplinePlayerCounts).filter(([disciplineId]) =>
              entries.some((entry) => entry.disciplineId === disciplineId),
            ),
          )
        : {},
    disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(entries, context),
  }, {
    enforceCompleteness: !allowPartialLineup,
  });

  if (!validation.isValid) {
    const reasonCodes = validation.errors.map((error) => {
      if (error.includes("used more than once")) return "duplicate_player_usage";
      if (error.includes("expects")) return "wrong_player_count";
      if (error.includes("missing activePlayerId")) return "missing_active_player_id";
      if (error.includes("does not match activePlayerId")) return "player_id_mismatch";
      return "invalid_lineup_entries";
    });

    return {
      ...base,
      matchdayReady: false,
      readinessStatus: "invalid_lineup",
      missingScoresCount: 0,
      validationWarnings: validation.errors,
      reasonCodes: Array.from(new Set(reasonCodes)),
      shortReason: validation.errors[0] ?? "Draft lineup is invalid for this matchday.",
    };
  }

  const scoreCoverage = buildScoreCoverage(entries, context);
  if (scoreCoverage.missingScores.length > 0) {
    return {
      ...base,
      matchdayReady: false,
      readinessStatus: "missing_score_coverage",
      missingScoresCount: scoreCoverage.missingScores.length,
      validationWarnings: scoreCoverage.validationWarnings,
      reasonCodes: ["missing_discipline_scores"],
      shortReason: `Draft is present, but ${scoreCoverage.missingScores.length} discipline score(s) are missing.`,
    };
  }

  return {
    ...base,
    matchdayReady: true,
    readinessStatus: "ready",
    missingScoresCount: 0,
    validationWarnings: validation.warnings,
    reasonCodes: allowPartialLineup ? ["partial_lineup_allowed"] : [],
    shortReason: allowPartialLineup
      ? `Minimum ${LEGACY_MATCHDAY_MINIMUM_PLAYERS} reached. Partial single-discipline lineup is allowed (${activePlayersCount}/${requiredTotalUniquePlayers}).`
      : "Draft lineup is present and preview-ready.",
  };
}
