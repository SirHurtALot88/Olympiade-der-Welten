import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { LegacyMatchdayReadiness, LegacyMatchdayReadinessStatus } from "@/lib/lineups/legacy-matchday-readiness";
import type {
  DisciplineHighlightCandidate,
  LegacyMatchdayResolvePreview,
  PlayerPerformancePreview,
} from "@/lib/resolve/legacy-matchday-resolve-types";

export type ResolveLabTopPlayerRow = PlayerPerformancePreview & {
  teamName: string;
  disciplineName: string;
};

export type ResolveLabTeamEntryRow = {
  disciplineId: string;
  disciplineName: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  baseScore: number | null;
  fatigueAdjustedScore: number | null;
  captainBonus: number | null;
  finalPlayerScore: number | null;
  pointsAwarded: number | null;
  isCaptain: boolean;
  warnings: string[];
};

export type ResolveLabTeamDetail = {
  teamId: string;
  teamName: string;
  hasLineup: boolean;
  readinessStatus: LegacyMatchdayReadinessStatus;
  readinessReasonCodes: string[];
  readinessExplanation: string;
  activePlayersCount: number;
  requiredTotalUniquePlayers: number;
  missingPlayersToRequirement: number;
  entries: ResolveLabTeamEntryRow[];
  missingScores: string[];
  validationWarnings: string[];
};

export type ResolveLabPlayerCatalogRow = {
  playerId: string;
  activePlayerId: string | null;
  teamId: string;
  teamCode: string;
  teamName: string;
  name: string;
  portraitUrl: string | null;
  className: string | null;
  potential: number | null;
  ovr: number | null;
  pps: number | null;
  traitsPositive: string[];
  traitsNegative: string[];
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  contractLength: number | null;
  salary: number | null;
  marketValue: number | null;
  disciplineValues: Array<{
    id: string;
    label: string;
    value: number | null;
  }>;
};

export type ResolveLabSummary = {
  teamsTotal: number;
  teamsWithLineup: number;
  teamsReady: number;
  teamsUnderfilled: number;
  missingLineups: number;
  teamsMissingLineup: number;
  teamsInvalidLineup: number;
  teamsMissingScoreCoverage: number;
  warningsCount: number;
  d1DisciplineId: string | null;
  d1DisciplineName: string | null;
  d2DisciplineId: string | null;
  d2DisciplineName: string | null;
};

function getPlayerName(context: LegacyLineupLoadedContext, playerId: string) {
  return context.rosterPlayers.find((player) => player.id === playerId)?.name ?? playerId;
}

function getDisciplineName(context: LegacyLineupLoadedContext | null, disciplineId: string) {
  return context?.disciplines.find((discipline) => discipline.id === disciplineId)?.name ?? disciplineId;
}

export function buildResolveLabSummary(
  preview: LegacyMatchdayResolvePreview,
  contexts: LegacyLineupLoadedContext[],
  readinessByTeamId: Map<string, LegacyMatchdayReadiness>,
): ResolveLabSummary {
  const firstContext = contexts[0] ?? null;
  const d1DisciplineId = firstContext?.contextMeta.d1DisciplineId ?? null;
  const d2DisciplineId = firstContext?.contextMeta.d2DisciplineId ?? null;
  const readinessRows = Array.from(readinessByTeamId.values());

  return {
    teamsTotal: preview.teamResults.length,
    teamsWithLineup: preview.teamResults.filter((team) => !team.missingLineup).length,
    teamsReady: readinessRows.filter((team) => team.readinessStatus === "ready").length,
    teamsUnderfilled: readinessRows.filter((team) => team.readinessStatus === "underfilled_roster").length,
    missingLineups: preview.missingLineups.length,
    teamsMissingLineup: readinessRows.filter((team) => team.readinessStatus === "missing_lineup").length,
    teamsInvalidLineup: readinessRows.filter((team) => team.readinessStatus === "invalid_lineup").length,
    teamsMissingScoreCoverage: readinessRows.filter((team) => team.readinessStatus === "missing_score_coverage").length,
    warningsCount: preview.warnings.length,
    d1DisciplineId,
    d1DisciplineName: d1DisciplineId ? getDisciplineName(firstContext, d1DisciplineId) : null,
    d2DisciplineId,
    d2DisciplineName: d2DisciplineId ? getDisciplineName(firstContext, d2DisciplineId) : null,
  };
}

export function buildResolveLabTopPlayersBySide(
  preview: LegacyMatchdayResolvePreview,
  contexts: LegacyLineupLoadedContext[],
) {
  const firstContext = contexts[0] ?? null;
  const d1DisciplineId = firstContext?.contextMeta.d1DisciplineId ?? null;
  const d2DisciplineId = firstContext?.contextMeta.d2DisciplineId ?? null;
  const contextByTeamId = new Map(contexts.map((context) => [context.team.id, context]));

  const mapRows = (disciplineId: string | null) => {
    if (!disciplineId) return [] as ResolveLabTopPlayerRow[];
    const disciplinePreview = preview.disciplinePreviews.find((item) => item.disciplineId === disciplineId);
    if (!disciplinePreview) return [] as ResolveLabTopPlayerRow[];
    return disciplinePreview.topPlayers.slice(0, 10).map((player) => {
      const context = contextByTeamId.get(player.teamId);
      return {
        ...player,
        teamName: context?.team.name ?? player.teamId,
        disciplineName: disciplinePreview.disciplineName,
      };
    });
  };

  return {
    d1: mapRows(d1DisciplineId),
    d2: mapRows(d2DisciplineId),
  };
}

export function buildResolveLabTeamDetails(
  contexts: LegacyLineupLoadedContext[],
  preview: LegacyMatchdayResolvePreview,
  readinessByTeamId: Map<string, LegacyMatchdayReadiness>,
): ResolveLabTeamDetail[] {
  const previewByTeamId = new Map(preview.teamResults.map((team) => [team.teamId, team]));
  const previewDisciplineRows = preview.disciplinePreviews.flatMap((discipline) => discipline.teamResults);

  return contexts.map((context) => {
    const readiness = readinessByTeamId.get(context.team.id);
    const teamPreview = previewByTeamId.get(context.team.id);
    const teamDisciplineRows = previewDisciplineRows.filter((row) => row.teamId === context.team.id);

    return {
      teamId: context.team.id,
      teamName: context.team.name,
      hasLineup: Boolean(context.existingDraft),
      readinessStatus: readiness?.readinessStatus ?? "unknown",
      readinessReasonCodes: readiness?.reasonCodes ?? ["readiness_missing"],
      readinessExplanation: readiness?.shortReason ?? "No readiness explanation available.",
      activePlayersCount: readiness?.activePlayersCount ?? context.activePlayers.length,
      requiredTotalUniquePlayers:
        readiness?.requiredTotalUniquePlayers ??
        ((context.contextMeta.d1DisciplineId ? (context.disciplinePlayerCounts[context.contextMeta.d1DisciplineId] ?? 0) : 0) +
          (context.contextMeta.d2DisciplineId ? (context.disciplinePlayerCounts[context.contextMeta.d2DisciplineId] ?? 0) : 0)),
      missingPlayersToRequirement: readiness?.missingPlayersToRequirement ?? 0,
      entries: teamDisciplineRows
        .flatMap((row) =>
          row.entries.map((entry) => ({
            disciplineId: row.disciplineId,
            disciplineName: getDisciplineName(context, row.disciplineId),
            disciplineSide: row.disciplineSide,
            slotIndex: entry.slotIndex,
            playerId: entry.playerId,
            activePlayerId: entry.activePlayerId,
            playerName: entry.playerName || getPlayerName(context, entry.playerId),
            baseScore: entry.baseValue,
            fatigueAdjustedScore: entry.fatigueAdjustedValue,
            captainBonus: entry.captainBonus,
            finalPlayerScore: entry.finalPlayerScore,
            pointsAwarded: entry.pointsAwarded ?? null,
            isCaptain: entry.isCaptain,
            warnings: entry.warnings,
          })),
        )
        .sort((left, right) => {
          if (left.disciplineSide !== right.disciplineSide) return left.disciplineSide.localeCompare(right.disciplineSide);
          return left.slotIndex - right.slotIndex;
        }),
      missingScores: teamDisciplineRows.flatMap((row) => row.missingScores),
      validationWarnings: Array.from(
        new Set([
          ...(readiness?.validationWarnings ?? []),
          ...teamDisciplineRows.flatMap((row) => row.warnings),
          ...(!context.existingDraft ? ["No existing legacy lineup draft was found for this team and matchday."] : []),
        ]),
      ),
    };
  });
}

export function getTopPlayerNameForTeam(preview: LegacyMatchdayResolvePreview, teamId: string): string | null {
  const topPlayer = preview.disciplinePreviews
    .flatMap((discipline) => discipline.topPlayers)
    .filter((player) => player.teamId === teamId)
    .sort((left, right) => right.finalPlayerScore - left.finalPlayerScore)[0];

  return topPlayer?.playerName ?? null;
}

export function getHighlightCandidatesForTeam(
  preview: LegacyMatchdayResolvePreview,
  teamId: string,
): DisciplineHighlightCandidate[] {
  return preview.disciplinePreviews
    .flatMap((discipline) => discipline.highlightCandidates)
    .filter((candidate) => candidate.teamId === teamId || candidate.relatedTeamId === teamId);
}

export function buildResolveLabPlayerCatalog(
  contexts: LegacyLineupLoadedContext[],
): ResolveLabPlayerCatalogRow[] {
  return contexts.flatMap((context) =>
    context.rosterPlayers.map((player) => {
      const activePlayer = context.activePlayers.find((entry) => entry.playerId === player.id) ?? null;
      const disciplineValues = context.disciplineScores
        .filter((entry) => entry.playerId === player.id)
        .map((entry) => ({
          id: entry.disciplineId,
          label: context.disciplines.find((discipline) => discipline.id === entry.disciplineId)?.name ?? entry.disciplineId,
          value: entry.score,
        }))
        .sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY));

      return {
        playerId: player.id,
        activePlayerId: activePlayer?.id ?? null,
        teamId: context.team.id,
        teamCode: context.team.shortCode,
        teamName: context.team.name,
        name: player.name,
        portraitUrl: player.portraitUrl ?? null,
        className: player.className ?? null,
        potential: player.potential ?? null,
        ovr: player.ovr ?? null,
        pps: player.pps ?? null,
        traitsPositive: player.traitsPositive ?? [],
        traitsNegative: player.traitsNegative ?? [],
        pow: player.coreStats.pow ?? null,
        spe: player.coreStats.spe ?? null,
        men: player.coreStats.men ?? null,
        soc: player.coreStats.soc ?? null,
        contractLength: activePlayer?.contractLength ?? null,
        salary: activePlayer?.salary ?? null,
        marketValue: activePlayer?.marketValue ?? null,
        disciplineValues,
      };
    }),
  );
}
