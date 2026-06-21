import type {
  DisciplineHighlightCandidate,
  LegacyMatchdayResolvePreview,
  PlayerPerformancePreview,
  ResolveHighlightType,
} from "@/lib/resolve/legacy-matchday-resolve-types";

export type MatchdayResultPayloadStatus = "preview_applied" | "superseded" | "voided";
export type ResultReadinessStatus =
  | "ready"
  | "underfilled_roster"
  | "missing_lineup"
  | "invalid_lineup"
  | "missing_score_coverage"
  | "unknown";

export type LegacyMatchdayResultMapperInput = {
  preview: LegacyMatchdayResolvePreview;
  sourceVersion: string;
  status?: MatchdayResultPayloadStatus;
  readinessByTeamId?: Record<
    string,
    {
      readinessStatus: ResultReadinessStatus;
      reasonCodes?: string[];
      shortReason?: string;
    }
  >;
  auditAction?: string;
};

export type MatchdayResultWritePayload = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  status: MatchdayResultPayloadStatus;
  sourceVersion: string;
  teamsTotal: number;
  teamsReady: number;
  teamsUnderfilled: number;
  teamsMissingLineup: number;
  teamsInvalidLineup: number;
  teamsMissingScoreCoverage: number;
  warningsCount: number;
};

export type DisciplineResultWritePayload = {
  id: string;
  matchdayResultId: string;
  teamId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  rank: number;
  baseScore: number;
  totalScore: number;
  formModifier: number | null;
  readinessStatus: ResultReadinessStatus;
  warnings: string[];
};

export type PlayerDisciplinePerformanceWritePayload = {
  id: string;
  matchdayResultId: string;
  teamId: string;
  playerId: string;
  activePlayerId: string | null;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  baseValue: number;
  finalPlayerScore: number;
  mutatorScoreBonus: number | null;
  mutatorPpsBonus: number | null;
  scoreContribution: number;
  rankInTeam: number;
  rankInDiscipline: number;
  isTop10: boolean;
  isMvpCandidate: boolean;
  storyWeight: number | null;
};

export type DisciplineHighlightWritePayload = {
  id: string;
  matchdayResultId: string;
  disciplineId: string | null;
  highlightType: ResolveHighlightType;
  teamId: string | null;
  playerId: string | null;
  relatedTeamId: string | null;
  importanceScore: number;
  shortSummary: string | null;
  payload: Record<string, unknown>;
};

export type ResultAuditLogWritePayload = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  matchdayResultId: string;
  action: string;
  payload: Record<string, unknown>;
};

export type LegacyMatchdayResultWriteBundle = {
  matchdayResultPayload: MatchdayResultWritePayload;
  disciplineResultPayloads: DisciplineResultWritePayload[];
  playerPerformancePayloads: PlayerDisciplinePerformanceWritePayload[];
  highlightPayloads: DisciplineHighlightWritePayload[];
  auditPayload: ResultAuditLogWritePayload;
};

function toStableId(...parts: Array<string | number>) {
  return parts.join("__");
}

function getFallbackReadinessStatus(
  teamId: string,
  preview: LegacyMatchdayResolvePreview,
): ResultReadinessStatus {
  if (preview.missingLineups.some((team) => team.teamId === teamId)) {
    return "missing_lineup";
  }
  return "ready";
}

function getDisciplineSideForPlayer(
  performance: PlayerPerformancePreview,
  preview: LegacyMatchdayResolvePreview,
): "d1" | "d2" {
  const disciplinePreview = preview.disciplinePreviews.find(
    (entry) => entry.disciplineId === performance.disciplineId,
  );
  return disciplinePreview?.disciplineSide ?? "d1";
}

function normalizeHighlightPayload(candidate: DisciplineHighlightCandidate) {
  return candidate.payload ?? {};
}

export function mapLegacyMatchdayResolvePreviewToResultPayload(
  input: LegacyMatchdayResultMapperInput,
): LegacyMatchdayResultWriteBundle {
  const { preview } = input;
  const status = input.status ?? "preview_applied";
  const matchdayResultId = toStableId(
    "matchday-result",
    preview.saveId,
    preview.seasonId,
    preview.matchdayId,
  );

  const readinessStatuses = preview.teamResults.map((teamResult) => {
    return (
      input.readinessByTeamId?.[teamResult.teamId]?.readinessStatus ??
      getFallbackReadinessStatus(teamResult.teamId, preview)
    );
  });

  const countByStatus = (target: ResultReadinessStatus) =>
    readinessStatuses.filter((statusValue) => statusValue === target).length;

  const matchdayResultPayload: MatchdayResultWritePayload = {
    id: matchdayResultId,
    saveId: preview.saveId,
    seasonId: preview.seasonId,
    matchdayId: preview.matchdayId,
    status,
    sourceVersion: input.sourceVersion,
    teamsTotal: preview.teamResults.length,
    teamsReady: countByStatus("ready"),
    teamsUnderfilled: countByStatus("underfilled_roster"),
    teamsMissingLineup: countByStatus("missing_lineup"),
    teamsInvalidLineup: countByStatus("invalid_lineup"),
    teamsMissingScoreCoverage: countByStatus("missing_score_coverage"),
    warningsCount: preview.warnings.length,
  };

  const disciplineResultPayloads: DisciplineResultWritePayload[] = preview.disciplinePreviews.flatMap(
    (disciplinePreview) =>
      disciplinePreview.teamResults.map((teamResult) => {
        const readinessStatus =
          input.readinessByTeamId?.[teamResult.teamId]?.readinessStatus ??
          getFallbackReadinessStatus(teamResult.teamId, preview);

        return {
          id: toStableId(
            "discipline-result",
            matchdayResultId,
            teamResult.teamId,
            disciplinePreview.disciplineId,
            disciplinePreview.disciplineSide,
          ),
          matchdayResultId,
          teamId: teamResult.teamId,
          disciplineId: disciplinePreview.disciplineId,
          disciplineSide: disciplinePreview.disciplineSide,
          rank: teamResult.rank,
          baseScore: teamResult.baseScore,
          totalScore: teamResult.finalPreviewScore,
          formModifier: teamResult.formModifier,
          readinessStatus,
          warnings: teamResult.warnings,
        };
      }),
  );

  const playerPerformancePayloads: PlayerDisciplinePerformanceWritePayload[] = preview.disciplinePreviews.flatMap(
    (disciplinePreview) =>
      disciplinePreview.topPlayers.map((player) => ({
        id: toStableId(
          "player-performance",
          matchdayResultId,
          player.teamId,
          player.disciplineId,
          getDisciplineSideForPlayer(player, preview),
          player.slotIndex,
        ),
        matchdayResultId,
        teamId: player.teamId,
        playerId: player.playerId,
        activePlayerId: player.activePlayerId ?? null,
        disciplineId: player.disciplineId,
        disciplineSide: getDisciplineSideForPlayer(player, preview),
        slotIndex: player.slotIndex,
        baseValue: player.baseValue,
        finalPlayerScore: player.finalPlayerScore,
        mutatorScoreBonus: player.mutatorBonus ?? null,
        mutatorPpsBonus: player.mutatorPpsBonus ?? null,
        scoreContribution: player.pointsAwarded ?? player.scoreContribution,
        rankInTeam: player.rankInTeam,
        rankInDiscipline: player.rankInDiscipline,
        isTop10: player.isTop10,
        isMvpCandidate: player.isMvpCandidate,
        storyWeight: player.storyWeight ?? null,
      })),
  );

  const highlightPayloads: DisciplineHighlightWritePayload[] = preview.disciplinePreviews.flatMap(
    (disciplinePreview) =>
      disciplinePreview.highlightCandidates.map((candidate, index) => ({
        id: toStableId(
          "discipline-highlight",
          matchdayResultId,
          disciplinePreview.disciplineId,
          candidate.highlightType,
          index,
        ),
        matchdayResultId,
        disciplineId: candidate.disciplineId ?? null,
        highlightType: candidate.highlightType,
        teamId: candidate.teamId ?? null,
        playerId: candidate.playerId ?? null,
        relatedTeamId: candidate.relatedTeamId ?? null,
        importanceScore: candidate.importanceScore,
        shortSummary: candidate.shortSummary ?? null,
        payload: normalizeHighlightPayload(candidate),
      })),
  );

  const auditPayload: ResultAuditLogWritePayload = {
    id: toStableId("result-audit", matchdayResultId, input.auditAction ?? "prepare_apply_payload"),
    saveId: preview.saveId,
    seasonId: preview.seasonId,
    matchdayId: preview.matchdayId,
    matchdayResultId,
    action: input.auditAction ?? "prepare_apply_payload",
    payload: {
      sourceVersion: input.sourceVersion,
      warnings: preview.warnings,
      missingLineups: preview.missingLineups,
      missingScores: preview.missingScores,
      readinessByTeamId: input.readinessByTeamId ?? {},
    },
  };

  return {
    matchdayResultPayload,
    disciplineResultPayloads,
    playerPerformancePayloads,
    highlightPayloads,
    auditPayload,
  };
}
