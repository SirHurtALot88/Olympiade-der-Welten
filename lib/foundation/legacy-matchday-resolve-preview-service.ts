import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupContextLoadResult } from "@/lib/lineups/legacy-lineup-types";
import {
  buildResolveLabPlayerCatalog,
  buildResolveLabSummary,
  buildResolveLabTeamDetails,
  buildResolveLabTopPlayersBySide,
  getHighlightCandidatesForTeam,
  getTopPlayerNameForTeam,
} from "@/lib/resolve/legacy-resolve-lab";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";

export type LegacyMatchdayResolvePreviewPayload = {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: ReturnType<typeof buildResolveLabSummary>;
  preview: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  teamDetails: ReturnType<typeof buildResolveLabTeamDetails>;
  topPlayers: ReturnType<typeof buildResolveLabTopPlayersBySide>;
  playerCatalog: ReturnType<typeof buildResolveLabPlayerCatalog>;
  warnings: string[];
  teamRows: Array<
    ReturnType<typeof buildLegacyMatchdayResolvePreview>["teamResults"][number] & {
      topPlayer: string | null;
      highlightFlag: boolean;
      readinessStatus: string;
      readinessReasonCodes: string[];
      activePlayersCount: number;
      requiredTotalUniquePlayers: number;
      missingPlayersToRequirement: number;
      shortReason: string;
    }
  >;
};

export function buildLegacyMatchdayResolvePreviewPayload(input: {
  source: "sqlite" | "prisma";
  params: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  contextResults: LegacyLineupContextLoadResult[];
}): LegacyMatchdayResolvePreviewPayload | null {
  const warnings = input.contextResults.flatMap((result) => result.warnings);
  const contexts = input.contextResults.flatMap((result) => (result.ok ? [result.context] : []));

  if (contexts.length === 0) {
    return null;
  }

  const readinessRows = contexts.map((context) => buildLegacyMatchdayReadiness(context));
  const readinessByTeamId = new Map(readinessRows.map((row) => [row.teamId, row]));
  const preview = buildLegacyMatchdayResolvePreview(contexts);
  const summary = buildResolveLabSummary(preview, contexts, readinessByTeamId);
  const teamDetails = buildResolveLabTeamDetails(contexts, preview, readinessByTeamId);
  const topPlayers = buildResolveLabTopPlayersBySide(preview, contexts);
  const playerCatalog = buildResolveLabPlayerCatalog(contexts);

  return {
    source: input.source,
    params: input.params,
    summary,
    preview,
    teamDetails,
    topPlayers,
    playerCatalog,
    warnings: Array.from(new Set([...warnings, ...preview.warnings])),
    teamRows: preview.teamResults.map((team) => ({
      ...team,
      topPlayer: getTopPlayerNameForTeam(preview, team.teamId),
      highlightFlag: getHighlightCandidatesForTeam(preview, team.teamId).length > 0,
      readinessStatus: readinessByTeamId.get(team.teamId)?.readinessStatus ?? "unknown",
      readinessReasonCodes: readinessByTeamId.get(team.teamId)?.reasonCodes ?? ["readiness_missing"],
      activePlayersCount: readinessByTeamId.get(team.teamId)?.activePlayersCount ?? 0,
      requiredTotalUniquePlayers: readinessByTeamId.get(team.teamId)?.requiredTotalUniquePlayers ?? 0,
      missingPlayersToRequirement: readinessByTeamId.get(team.teamId)?.missingPlayersToRequirement ?? 0,
      shortReason: readinessByTeamId.get(team.teamId)?.shortReason ?? "No readiness explanation available.",
    })),
  };
}

export function loadSqliteLegacyMatchdayResolvePreview(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
}) {
  const contextResults = loadAllLocalLegacyLineupContexts(input);
  return buildLegacyMatchdayResolvePreviewPayload({
    source: "sqlite",
    params: input,
    contextResults,
  });
}
