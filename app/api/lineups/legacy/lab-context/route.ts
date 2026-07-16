export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { loadLocalLegacyLineupContext, loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { DEFAULT_ACTIVE_OWNER_ID, buildTeamControlSettingsMap, canLocalUserManageTeam } from "@/lib/foundation/team-control-settings";
import { canFoundationLocalUserManageTeam } from "@/lib/foundation/foundation-admin-dev-flags";
import {
  buildLegacyLineupLabContextCacheKey,
  readLegacyLineupLabContextCache,
  writeLegacyLineupLabContextCache,
} from "@/lib/lineups/legacy-lineup-lab-context-cache";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  buildLineupDisciplineContract,
  buildMatchdayLineupContract,
  countSeasonCaptains,
  countSeasonLineupDisciplineSides,
  formatLineupTeamStatusLabel,
  SEASON_CAPTAIN_SLOTS,
} from "@/lib/lineups/lineup-discipline-contract";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { db } from "@/src/server/db";

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

function parseOptionalParams(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite",
    saveId: searchParams.get("saveId")?.trim() ?? null,
    seasonId: searchParams.get("seasonId")?.trim() ?? null,
    matchdayId: searchParams.get("matchdayId")?.trim() ?? null,
    teamId: searchParams.get("teamId")?.trim() ?? null,
    activeOwnerId: searchParams.get("activeOwnerId")?.trim() || DEFAULT_ACTIVE_OWNER_ID,
  };
}

async function resolveDefaultPrismaParams(input: {
  saveId: string | null;
  seasonId: string | null;
  matchdayId: string | null;
  teamId: string | null;
}): Promise<LegacyLineupKeyParams> {
  const save =
    (input.saveId ? await db.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await db.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No save available for legacy lineup lab.");
  }

  const season =
    (input.seasonId
      ? await db.season.findFirst({
          where: { id: input.seasonId, saveId: save.id },
        })
      : null) ??
    (await db.season.findFirst({
      where: { id: "season-1", saveId: save.id },
    })) ??
    (await db.season.findFirst({
      where: { saveId: save.id },
      orderBy: [{ year: "asc" }],
    }));

  if (!season) {
    throw new Error(`No season available for save ${save.id}.`);
  }

  const matchday =
    (input.matchdayId
      ? await db.matchday.findFirst({
          where: { id: input.matchdayId, seasonId: season.id },
        })
      : null) ??
    (await db.matchday.findFirst({
      where: { id: "matchday-1", seasonId: season.id },
    })) ??
    (await db.matchday.findFirst({
      where: { seasonId: season.id },
      orderBy: [{ index: "asc" }],
    }));

  if (!matchday) {
    throw new Error(`No matchday available for season ${season.id}.`);
  }

  const teamState =
    (input.teamId
      ? await db.teamSeasonState.findUnique({
          where: {
            saveId_seasonId_teamId: {
              saveId: save.id,
              seasonId: season.id,
              teamId: input.teamId,
            },
          },
        })
      : null) ??
    (await db.teamSeasonState.findFirst({
      where: { saveId: save.id, seasonId: season.id },
      orderBy: [{ teamId: "asc" }],
    }));

  if (!teamState) {
    throw new Error(`No team available for save ${save.id} and season ${season.id}.`);
  }

  return {
    saveId: save.id,
    seasonId: season.id,
    matchdayId: matchday.id,
    teamId: teamState.teamId,
  };
}

function resolveDefaultSqliteParamsFromSave(
  save: PersistedSaveGame,
  input: {
    saveId: string | null;
    seasonId: string | null;
    matchdayId: string | null;
    teamId: string | null;
  },
): LegacyLineupKeyParams {
  const season = save.gameState.season;
  const seasonId = input.seasonId && input.seasonId === season.id ? input.seasonId : season.id;
  const matchdayId =
    input.matchdayId && season.matchdayIds.includes(input.matchdayId)
      ? input.matchdayId
      : save.gameState.matchdayState.matchdayId;
  const teamId =
    input.teamId && save.gameState.teams.some((team) => team.teamId === input.teamId)
      ? input.teamId
      : save.gameState.teams[0]?.teamId;

  if (!teamId) {
    throw new Error(`No team available in local save ${save.saveId}.`);
  }

  return {
    saveId: save.saveId,
    seasonId,
    matchdayId,
    teamId,
  };
}

function resolveDefaultSqliteParams(input: {
  saveId: string | null;
  seasonId: string | null;
  matchdayId: string | null;
  teamId: string | null;
}): LegacyLineupKeyParams {
  const persistence = createPersistenceService();
  const { save } = resolveLocalPersistedSave(persistence, input.saveId);
  return resolveDefaultSqliteParamsFromSave(save, input);
}

async function loadPrismaOptions(params: LegacyLineupKeyParams) {
  const saves = await db.save.findMany({
    orderBy: [{ updatedAt: "desc" }],
  });
  const seasons = await db.season.findMany({
    where: { saveId: params.saveId },
    orderBy: [{ year: "asc" }],
  });
  const matchdays = await db.matchday.findMany({
    where: { seasonId: params.seasonId },
    orderBy: [{ index: "asc" }],
  });
  const teamStates = await db.teamSeasonState.findMany({
    where: { saveId: params.saveId, seasonId: params.seasonId },
    include: { team: true },
    orderBy: [{ teamId: "asc" }],
  });
  const lineups = await db.lineup.findMany({
    where: { saveId: params.saveId, seasonId: params.seasonId },
    include: { slots: true },
  });
  const disciplineConfigs = await db.seasonDisciplineConfig.findMany({
    where: { seasonId: params.seasonId },
    orderBy: [{ displayOrder: "asc" }],
  });
  const matchdayResults = await db.matchdayResult.findMany({
    where: {
      saveId: params.saveId,
      seasonId: params.seasonId,
      status: "preview_applied",
    },
  });

  const contract = buildLineupDisciplineContract(
    disciplineConfigs.map((config) => ({
      id: config.disciplineId,
      name: config.disciplineId,
      category: "power",
      weight: 1,
      originalOrder: config.originalOrder ?? undefined,
      displayOrder: config.displayOrder ?? undefined,
      playerCount: config.playerCount ?? undefined,
      mutator1: config.mutator1,
      mutator2: config.mutator2,
    })),
  );
  const totalLineupSides = contract.length;
  const normalizedLineups = lineups.map((lineup) => ({
    teamId: lineup.teamId,
    seasonId: lineup.seasonId,
    matchdayId: lineup.matchdayId,
    entries: lineup.slots.map((slot) => ({
      disciplineId: slot.disciplineId,
      disciplineSide: slot.disciplineSide,
      isCaptain: false,
    })),
  }));
  const totalTeams = teamStates.length;
  const resultByMatchdayId = new Map(matchdayResults.map((result) => [result.matchdayId, result] as const));

  return {
    saves: saves.map((save) => ({ id: save.id, name: save.name, status: save.status })),
    seasons: seasons.map((season) => ({ id: season.id, name: season.name, year: season.year, status: season.status })),
    matchdays: matchdays.map((matchday) => {
      const readyTeams = teamStates.filter(
        (state) =>
          countMatchdayLineupDisciplineSides({
            lineups: normalizedLineups,
            teamId: state.teamId,
            seasonId: params.seasonId,
            matchdayId: matchday.id,
          }) >= 2,
      ).length;
      const result = resultByMatchdayId.get(matchday.id) ?? null;
      return {
        id: matchday.id,
        label: matchday.label,
        index: matchday.index,
        status: result ? "resolved" : matchday.status,
        resultApplied: Boolean(result),
        resultId: result?.id ?? null,
        discipline1Label: null,
        discipline1RequiredPlayers: null,
        discipline2Label: null,
        discipline2RequiredPlayers: null,
        sourceStatus: "legacy_seed",
        readyTeams,
        totalTeams,
        isReady: totalTeams > 0 && readyTeams >= totalTeams,
      };
    }),
    teams: teamStates.map((state) => {
      const lineupFilledCount = countSeasonLineupDisciplineSides({
        lineups: normalizedLineups,
        teamId: state.teamId,
        seasonId: params.seasonId,
      });
      const captainUsedCount = countSeasonCaptains({
        lineups: normalizedLineups,
        teamId: state.teamId,
        seasonId: params.seasonId,
      });
      const currentMatchdayReady =
        countMatchdayLineupDisciplineSides({
          lineups: normalizedLineups,
          teamId: state.teamId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
        }) >= 2;

      return {
        id: state.teamId,
        name: state.team.name,
        activePlayers: 0,
        controlMode: "manual",
        aiLineupApplyEnabled: false,
        lineupFilledCount,
        totalLineupSides,
        captainUsedCount,
        captainSlots: SEASON_CAPTAIN_SLOTS,
        statusLabel: formatLineupTeamStatusLabel({
          team: { shortCode: state.team.shortCode, name: state.team.name },
          lineupFilledCount,
          totalLineupSides,
          captainUsedCount,
        }),
        currentMatchdayReady,
      };
    }),
  };
}

function loadSqliteOptions(save: PersistedSaveGame, persistence: ReturnType<typeof createPersistenceService>, params: LegacyLineupKeyParams) {
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
    saves: persistence.listSaves().map((saveItem) => ({ id: saveItem.saveId, name: saveItem.name, status: saveItem.status })),
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

function isSqliteLineupReadOnly(save: PersistedSaveGame, params: LegacyLineupKeyParams, activeOwnerId: string) {
  return !canFoundationLocalUserManageTeam(canLocalUserManageTeam(save.gameState, params.teamId, activeOwnerId));
}

export async function GET(request: Request) {
  try {
    const parsed = parseOptionalParams(request);

    if (parsed.source === "prisma") {
      const params = await resolveDefaultPrismaParams(parsed);
      const loader = new LegacyLineupContextLoader(db, new LegacyLineupRepository(db));
      const contextResult = await loader.loadLegacyLineupContext(params);
      const options = await loadPrismaOptions(params);
      const enrichedContext =
        contextResult.ok
          ? (() => {
              const contract = buildLineupDisciplineContract(
                contextResult.context.seasonDisciplineConfigs.map((config) => {
                  const discipline = contextResult.context.disciplines.find((entry) => entry.id === config.disciplineId);
                  return {
                    id: config.disciplineId,
                    name: discipline?.name ?? config.disciplineId,
                    category: (discipline?.category as "power" | "speed" | "mental" | "social" | undefined) ?? "power",
                    weight: 1,
                    originalOrder: config.originalOrder ?? undefined,
                    displayOrder: config.displayOrder ?? undefined,
                    playerCount: config.playerCount ?? undefined,
                    mutator1: config.mutator1,
                    mutator2: config.mutator2,
                  };
                }),
              );
              const matchdayContract = buildMatchdayLineupContract({
                season: {
                  id: contextResult.context.season.id,
                  name: contextResult.context.season.name,
                  year: contextResult.context.season.year,
                  currentMatchday: contextResult.context.season.currentMatchday,
                  matchdayIds: options.matchdays.map((entry) => entry.id),
                },
                matchday: {
                  id: contextResult.context.matchday.id,
                  seasonId: contextResult.context.matchday.seasonId,
                  index: contextResult.context.matchday.index,
                  label: contextResult.context.matchday.label,
                  fixtureIds: [],
                },
                disciplines: contract.map((entry) => ({
                  id: entry.disciplineId,
                  name: entry.displayName,
                  category: entry.category,
                  weight: 1,
                  originalOrder: entry.order ?? undefined,
                  displayOrder: entry.order ?? undefined,
                  playerCount: entry.requiredPlayers ?? undefined,
                })),
              });
              const selectedTeam = options.teams.find((entry) => entry.id === params.teamId);
              return {
                ...contextResult.context,
                lineupContract: contract,
                matchdayContract,
                teamStatus: selectedTeam
                  ? {
                      lineupFilledCount: selectedTeam.lineupFilledCount ?? 0,
                      totalLineupSides: selectedTeam.totalLineupSides ?? contract.length,
                      captainUsedCount: selectedTeam.captainUsedCount ?? 0,
                      captainSlots: selectedTeam.captainSlots ?? SEASON_CAPTAIN_SLOTS,
                      displayLabel: selectedTeam.statusLabel ?? selectedTeam.name,
                    }
                  : undefined,
                teamDisciplineRanks: Object.fromEntries(
                  Object.entries(contextResult.context.teamDisciplineRanks ?? {}),
                ),
                captainRule: {
                  seasonCaptainSlots: SEASON_CAPTAIN_SLOTS,
                  perDisciplineSideMaxCaptains: 1,
                  sourceStatus: "mapped_with_transform",
                },
              };
            })()
          : null;
      return NextResponse.json({
        params,
        source: "prisma",
        readOnly: true,
        context: enrichedContext,
        contextWarnings: contextResult.ok ? contextResult.warnings : contextResult.warnings,
        contextErrors: contextResult.ok ? [] : contextResult.errors,
        options,
      });
    }

    const persistence = createPersistenceService();
    const { save } = resolveLocalPersistedSave(persistence, parsed.saveId);
    const params = resolveDefaultSqliteParamsFromSave(save, parsed);
    const versionMeta = persistence.getSaveVersionMetadata(save.saveId);
    const cacheKey = buildLegacyLineupLabContextCacheKey({
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      teamId: params.teamId,
      activeOwnerId: parsed.activeOwnerId,
    });
    const cacheSignature = versionMeta?.contentSignature ?? `${save.saveId}:${versionMeta?.saveVersion ?? 0}`;
    const cachedPayload = readLegacyLineupLabContextCache<Record<string, unknown>>(cacheKey, cacheSignature);
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        headers: {
          "Cache-Control": "private, max-age=30",
          ETag: `"${cacheSignature}:${cacheKey}"`,
        },
      });
    }

    const contextResult = loadLocalLegacyLineupContextFromGameState(save.gameState, params);
    const options = loadSqliteOptions(save, persistence, params);
    const payload = {
      params,
      source: "sqlite",
      readOnly: isSqliteLineupReadOnly(save, params, parsed.activeOwnerId),
      context: contextResult.ok ? contextResult.context : null,
      contextWarnings: contextResult.ok ? contextResult.warnings : contextResult.warnings,
      contextErrors: contextResult.ok ? [] : contextResult.errors,
      options,
    };
    writeLegacyLineupLabContextCache(cacheKey, cacheSignature, payload);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30",
        ETag: `"${cacheSignature}:${cacheKey}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Legacy lineup lab context could not be loaded." },
      { status: 500 },
    );
  }
}
