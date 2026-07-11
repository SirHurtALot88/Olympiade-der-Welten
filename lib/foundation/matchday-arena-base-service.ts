import type { MatchdayMvpScoringResult } from "@/lib/season/matchday-mvp-scoring-service";
import { runMatchdayMvpScoring } from "@/lib/season/matchday-mvp-scoring-service";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { DEFAULT_ACTIVE_OWNER_ID, buildTeamControlSettingsMap, canLocalUserManageTeam } from "@/lib/foundation/team-control-settings";
import { readArenaPreviewCache, writeArenaPreviewCache } from "@/lib/foundation/arena-preview-cache";
import {
  loadSqliteLegacyMatchdayResolvePreview,
  type LegacyMatchdayResolvePreviewPayload,
} from "@/lib/foundation/legacy-matchday-resolve-preview-service";
import {
  buildLineupDisciplineContract,
  countSeasonCaptains,
  countSeasonLineupDisciplineSides,
  formatLineupTeamStatusLabel,
  SEASON_CAPTAIN_SLOTS,
} from "@/lib/lineups/lineup-discipline-contract";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { readStandingsPreviewCache, writeStandingsPreviewCache } from "@/lib/standings/standings-preview-cache";

function countMatchdayLineupDisciplineSides(input: {
  lineups: Array<{
    teamId: string;
    seasonId: string;
    matchdayId: string;
    entries: Array<{ disciplineId: string; disciplineSide: "d1" | "d2" }>;
  }>;
  teamId: string;
  seasonId: string;
  matchdayId: string;
}) {
  const keys = new Set<string>();
  for (const draft of input.lineups) {
    if (draft.teamId !== input.teamId || draft.seasonId !== input.seasonId || draft.matchdayId !== input.matchdayId) {
      continue;
    }
    for (const entry of draft.entries) {
      keys.add(`${entry.disciplineId}::${entry.disciplineSide}`);
    }
  }
  return keys.size;
}

function buildArenaOptions(save: PersistedSaveGame, params: LegacyLineupKeyParams) {
  const contract = buildLineupDisciplineContract(save.gameState.disciplines);
  const lineups = save.gameState.seasonState.lineupDrafts ?? [];
  const totalLineupSides = contract.length;
  const disciplineSchedule = getSeasonDisciplineSchedule(save.gameState);
  const disciplineScheduleByMatchdayId = new Map(disciplineSchedule.map((entry) => [entry.matchdayId, entry] as const));
  const controlSettingsMap = buildTeamControlSettingsMap(save.gameState.teams, save.gameState.seasonState.teamControlSettings);
  const totalTeams = save.gameState.teams.length;
  const resultByMatchdayId = new Map(
    (save.gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === save.gameState.season.id && result.status === "preview_applied")
      .map((result) => [result.matchdayId, result] as const),
  );

  return {
    saves: createPersistenceService().listSaves().map((saveItem) => ({ id: saveItem.saveId, name: saveItem.name, status: saveItem.status })),
    seasons: [
      {
        id: save.gameState.season.id,
        name: save.gameState.season.name,
        year: save.gameState.season.year,
        status: "active",
      },
    ],
    matchdays: save.gameState.season.matchdayIds.map((matchdayId, index) => {
      const readyTeams = save.gameState.teams.filter(
        (team) =>
          countMatchdayLineupDisciplineSides({
            lineups,
            teamId: team.teamId,
            seasonId: save.gameState.season.id,
            matchdayId,
          }) >= 2,
      ).length;
      const result = resultByMatchdayId.get(matchdayId) ?? null;
      return {
        id: matchdayId,
        label: disciplineScheduleByMatchdayId.get(matchdayId)?.matchdayLabel ?? `Spieltag ${index + 1}`,
        index: disciplineScheduleByMatchdayId.get(matchdayId)?.matchdayIndex ?? index + 1,
        status: result ? "resolved" : save.gameState.matchdayState.matchdayId === matchdayId ? save.gameState.matchdayState.status : "planning",
        resultApplied: Boolean(result),
        resultId: result?.id ?? null,
        discipline1Label: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline1?.displayName ?? null,
        discipline1RequiredPlayers: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline1?.playerCount ?? null,
        discipline2Label: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline2?.displayName ?? null,
        discipline2RequiredPlayers: disciplineScheduleByMatchdayId.get(matchdayId)?.discipline2?.playerCount ?? null,
        sourceStatus: disciplineScheduleByMatchdayId.get(matchdayId)?.sourceStatus ?? "legacy_seed",
        readyTeams,
        totalTeams,
        isReady: totalTeams > 0 && readyTeams >= totalTeams,
      };
    }),
    teams: save.gameState.teams.map((team) => {
      const activePlayers = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      const lineupFilledCount = countSeasonLineupDisciplineSides({
        lineups,
        teamId: team.teamId,
        seasonId: save.gameState.season.id,
      });
      const captainUsedCount = countSeasonCaptains({
        lineups,
        teamId: team.teamId,
        seasonId: save.gameState.season.id,
      });
      const currentMatchdayReady =
        countMatchdayLineupDisciplineSides({
          lineups,
          teamId: team.teamId,
          seasonId: save.gameState.season.id,
          matchdayId: params.matchdayId,
        }) >= 2;
      return {
        id: team.teamId,
        name: team.name,
        activePlayers,
        controlMode: controlSettingsMap[team.teamId]?.controlMode ?? "manual",
        aiLineupApplyEnabled: controlSettingsMap[team.teamId]?.aiLineupApplyEnabled ?? false,
        lineupFilledCount,
        totalLineupSides,
        captainUsedCount,
        captainSlots: SEASON_CAPTAIN_SLOTS,
        statusLabel: formatLineupTeamStatusLabel({
          team,
          lineupFilledCount,
          totalLineupSides,
          captainUsedCount,
        }),
        currentMatchdayReady,
      };
    }),
  };
}

export async function loadMatchdayArenaBase(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  activeOwnerId?: string;
  includeDetails?: boolean;
}) {
  const persistence = createPersistenceService();
  const { save } = resolveLocalPersistedSave(persistence, input.saveId);
  const versionMeta = persistence.getSaveVersionMetadata(save.saveId);
  const contentSignature = versionMeta?.contentSignature ?? null;
  const params: LegacyLineupKeyParams = {
    saveId: save.saveId,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
  };
  const contextResult = loadLocalLegacyLineupContextFromGameState(save.gameState, params);
  const scoreResult = await runMatchdayMvpScoring({
    saveId: save.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId,
    source: "sqlite",
    dryRun: true,
    execute: false,
  });

  let resolvePreview: LegacyMatchdayResolvePreviewPayload | null = null;
  let standingsPreview: Awaited<ReturnType<typeof buildStandingsPreview>> | null = null;

  if (input.includeDetails === true) {
    const resolveCacheKey = `${save.saveId}:${params.seasonId}:${params.matchdayId}`;
    const cacheSignature = contentSignature ?? `${versionMeta?.updatedAt ?? save.updatedAt}`;
    resolvePreview =
      readArenaPreviewCache<LegacyMatchdayResolvePreviewPayload>(resolveCacheKey, cacheSignature) ??
      loadSqliteLegacyMatchdayResolvePreview({
        saveId: save.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
      });
    if (resolvePreview) {
      writeArenaPreviewCache(resolveCacheKey, cacheSignature, resolvePreview);
    }

    const standingsCacheKey = `${save.saveId}:${params.seasonId}:${params.matchdayId}`;
    standingsPreview =
      readStandingsPreviewCache<Awaited<ReturnType<typeof buildStandingsPreview>>>(
        standingsCacheKey,
        cacheSignature,
      ) ??
      (await buildStandingsPreview(
        {
          saveId: save.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          source: "sqlite",
        },
        undefined,
        persistence,
      ));
    writeStandingsPreviewCache(standingsCacheKey, cacheSignature, standingsPreview);
  }

  return {
    params,
    source: "sqlite" as const,
    readOnly: !canLocalUserManageTeam(save.gameState, params.teamId, input.activeOwnerId ?? DEFAULT_ACTIVE_OWNER_ID),
    context: contextResult.ok ? contextResult.context : null,
    contextWarnings: contextResult.ok ? contextResult.warnings : contextResult.warnings,
    contextErrors: contextResult.ok ? [] : contextResult.errors,
    options: buildArenaOptions(save, params),
    scoreSummary: scoreResult,
    scoreWarnings: scoreResult.warnings ?? [],
    scoreBlockingReasons: scoreResult.blockingReasons ?? [],
    resolvePreview,
    standingsPreview,
    saveVersion: save.gameState.saveVersion ?? 0,
    contentSignature,
  };
}
