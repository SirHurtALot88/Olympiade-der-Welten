import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
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
  activePlayersCount: number;
  requiredTotalUniquePlayers: number;
  readinessStatus: LegacyMatchdayReadinessStatus;
  reasonCodes: string[];
  shortReason: string;
};

const LEGACY_MATCHDAY_MINIMUM_PLAYERS = 7;

function getRequiredCounts(context: LegacyLineupLoadedContext) {
  const d1Required = context.contextMeta.d1DisciplineId
    ? context.disciplinePlayerCounts[context.contextMeta.d1DisciplineId] ?? 0
    : 0;
  const d2Required = context.contextMeta.d2DisciplineId
    ? context.disciplinePlayerCounts[context.contextMeta.d2DisciplineId] ?? 0
    : 0;

  return {
    d1Required,
    d2Required,
    requiredTotalUniquePlayers: d1Required + d2Required,
  };
}

export function buildLegacyMatchdayReadiness(
  context: LegacyLineupLoadedContext,
): LegacyMatchdayReadiness {
  const { d1Required, d2Required, requiredTotalUniquePlayers } = getRequiredCounts(context);
  const activePlayersCount = context.activePlayers.length;
  const draft = context.existingDraft;

  if (activePlayersCount < LEGACY_MATCHDAY_MINIMUM_PLAYERS) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "underfilled_roster",
      reasonCodes: ["under_minimum_matchday_players"],
      shortReason: `Only ${activePlayersCount}/${LEGACY_MATCHDAY_MINIMUM_PLAYERS} minimum active players available.`,
    };
  }

  if (!draft) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "missing_lineup",
      reasonCodes: ["no_existing_draft"],
      shortReason: "No legacy lineup draft exists for this team.",
    };
  }

  const allowPartialLineup = activePlayersCount < requiredTotalUniquePlayers;
  const validation = validateLegacyLineupContext({
    ...context,
    entries: draft.entries,
    disciplinePlayerCounts: Object.fromEntries(
      [
        context.contextMeta.d1DisciplineId
          ? [context.contextMeta.d1DisciplineId, d1Required]
          : null,
        context.contextMeta.d2DisciplineId
          ? [context.contextMeta.d2DisciplineId, d2Required]
          : null,
      ].filter((entry): entry is [string, number] => Boolean(entry)),
    ),
    disciplineSidePlayerCounts: Object.fromEntries(
      [
        context.contextMeta.d1DisciplineId
          ? [`${context.contextMeta.d1DisciplineId}::d1`, d1Required]
          : null,
        context.contextMeta.d2DisciplineId
          ? [`${context.contextMeta.d2DisciplineId}::d2`, d2Required]
          : null,
      ].filter((entry): entry is [string, number] => Boolean(entry)),
    ),
  }, {
    enforceCompleteness: !allowPartialLineup,
  });

  if (!validation.isValid) {
    const reasonCodes = validation.errors.map((error) => {
      if (error.includes("duplicate")) return "duplicate_player_usage";
      if (error.includes("Expected")) return "wrong_player_count";
      if (error.includes("does not match")) return "player_mismatch";
      return "invalid_lineup";
    });

    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "invalid_lineup",
      reasonCodes,
      shortReason: validation.errors[0] ?? "Draft validation failed.",
    };
  }

  const scoreWarnings = [
    ...(context.contextMeta.d1DisciplineId
      ? scoreLegacyLineupDisciplineSide({
          disciplineId: context.contextMeta.d1DisciplineId,
          disciplineSide: "d1",
          entries: draft.entries,
          disciplineScores: context.disciplineScores,
        }).missingScores
      : []),
    ...(context.contextMeta.d2DisciplineId
      ? scoreLegacyLineupDisciplineSide({
          disciplineId: context.contextMeta.d2DisciplineId,
          disciplineSide: "d2",
          entries: draft.entries,
          disciplineScores: context.disciplineScores,
        }).missingScores
      : []),
  ];

  if (scoreWarnings.length > 0) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "missing_score_coverage",
      reasonCodes: ["missing_discipline_scores"],
      shortReason: `Missing ${scoreWarnings.length} discipline score entries for used players.`,
    };
  }

  if (d1Required === 0 && d2Required === 0) {
    return {
      teamId: context.team.id,
      teamName: context.team.name,
      activePlayersCount,
      requiredTotalUniquePlayers,
      readinessStatus: "unknown",
      reasonCodes: ["missing_matchday_requirements"],
      shortReason: "Matchday requirements could not be derived.",
    };
  }

  return {
    teamId: context.team.id,
    teamName: context.team.name,
    activePlayersCount,
    requiredTotalUniquePlayers,
    readinessStatus: "ready",
    reasonCodes: allowPartialLineup ? ["partial_lineup_allowed"] : [],
    shortReason: allowPartialLineup
      ? `Minimum ${LEGACY_MATCHDAY_MINIMUM_PLAYERS} reached. Partial single-discipline lineup is allowed (${activePlayersCount}/${requiredTotalUniquePlayers}).`
      : `Draft is valid for ${d1Required}+${d2Required} slots.`,
  };
}
