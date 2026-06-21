export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { AiLegacyLineupPreview, AiLegacyLineupPreviewStatus } from "@/lib/ai/ai-needs-types";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { db } from "@/src/server/db";

type PreviewSource = "sqlite" | "prisma";

type BatchPreviewTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  status: AiLegacyLineupPreviewStatus;
  d1Status: AiLegacyLineupPreviewStatus;
  d2Status: AiLegacyLineupPreviewStatus;
  d1DisciplineName: string | null;
  d2DisciplineName: string | null;
  d1SelectedPlayers: number;
  d1RequiredPlayers: number;
  d1MissingSlots: number;
  d2SelectedPlayers: number;
  d2RequiredPlayers: number;
  d2MissingSlots: number;
  d1CaptainName: string | null;
  d2CaptainName: string | null;
  totalExpectedScore: number;
  warnings: string[];
  blockingReasons: string[];
  explanation: string;
};

function parseSource(request: Request): PreviewSource {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

function parseBaseParams(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    saveId: searchParams.get("saveId")?.trim() ?? null,
    seasonId: searchParams.get("seasonId")?.trim() ?? null,
    matchdayId: searchParams.get("matchdayId")?.trim() ?? null,
  };
}

async function resolveSqliteBatchContext(input: {
  saveId: string | null;
  seasonId: string | null;
  matchdayId: string | null;
}) {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (input.saveId ? persistence.getSaveById(input.saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for AI batch preview.");
  }

  const season = save.gameState.season;
  const seasonId = input.seasonId && input.seasonId === season.id ? input.seasonId : season.id;
  const matchdayId =
    input.matchdayId && season.matchdayIds.includes(input.matchdayId)
      ? input.matchdayId
      : save.gameState.matchdayState.matchdayId;

  return {
    params: {
      saveId: save.saveId,
      seasonId,
      matchdayId,
    },
    teams: save.gameState.teams.map((team) => ({
      teamId: team.teamId,
      teamCode: team.shortCode ?? team.teamId,
      teamName: team.name,
    })),
  };
}

async function resolvePrismaBatchContext(input: {
  saveId: string | null;
  seasonId: string | null;
  matchdayId: string | null;
}) {
  const save =
    (input.saveId ? await db.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await db.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No Prisma save available for AI batch preview.");
  }

  const season =
    (input.seasonId
      ? await db.season.findFirst({
          where: { id: input.seasonId, saveId: save.id },
        })
      : null) ??
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
      where: { seasonId: season.id },
      orderBy: [{ index: "asc" }],
    }));

  if (!matchday) {
    throw new Error(`No matchday available for season ${season.id}.`);
  }

  const teamStates = await db.teamSeasonState.findMany({
    where: { saveId: save.id, seasonId: season.id },
    include: { team: true },
    orderBy: [{ teamId: "asc" }],
  });

  return {
    params: {
      saveId: save.id,
      seasonId: season.id,
      matchdayId: matchday.id,
    },
    teams: teamStates.map((state: (typeof teamStates)[number]) => ({
      teamId: state.teamId,
      teamCode: state.team.shortCode ?? state.teamId,
      teamName: state.team.name,
    })),
  };
}

function toBlockedEntry(
  team: { teamId: string; teamCode: string; teamName: string },
  reasons: string[],
): BatchPreviewTeamEntry {
  return {
    teamId: team.teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    status: "blocked",
    d1Status: "blocked",
    d2Status: "blocked",
    d1DisciplineName: null,
    d2DisciplineName: null,
    d1SelectedPlayers: 0,
    d1RequiredPlayers: 0,
    d1MissingSlots: 0,
    d2SelectedPlayers: 0,
    d2RequiredPlayers: 0,
    d2MissingSlots: 0,
    d1CaptainName: null,
    d2CaptainName: null,
    totalExpectedScore: 0,
    warnings: reasons,
    blockingReasons: reasons,
    explanation: "AI-Vorschau blockiert.",
  };
}

function toBatchEntry(team: { teamId: string; teamCode: string; teamName: string }, preview: AiLegacyLineupPreview): BatchPreviewTeamEntry {
  const blockingReasons = preview.status === "blocked" ? preview.warnings : [];
  return {
    teamId: preview.teamId,
    teamCode: preview.teamCode || team.teamCode,
    teamName: preview.teamName || team.teamName,
    status: preview.status,
    d1Status: preview.d1.status,
    d2Status: preview.d2.status,
    d1DisciplineName: preview.d1.disciplineName,
    d2DisciplineName: preview.d2.disciplineName,
    d1SelectedPlayers: preview.d1.selectedPlayers,
    d1RequiredPlayers: preview.d1.requiredPlayers,
    d1MissingSlots: preview.d1.missingSlots,
    d2SelectedPlayers: preview.d2.selectedPlayers,
    d2RequiredPlayers: preview.d2.requiredPlayers,
    d2MissingSlots: preview.d2.missingSlots,
    d1CaptainName: preview.d1.captainName,
    d2CaptainName: preview.d2.captainName,
    totalExpectedScore: preview.totalExpectedScore,
    warnings: preview.warnings,
    blockingReasons,
    explanation: preview.explanation,
  };
}

export async function GET(request: Request) {
  try {
    const source = parseSource(request);
    const baseParams = parseBaseParams(request);
    const baseContext =
      source === "prisma"
        ? await resolvePrismaBatchContext(baseParams)
        : await resolveSqliteBatchContext(baseParams);

    const teams = await Promise.all(
      baseContext.teams.map(async (team: (typeof baseContext.teams)[number]) => {
        const params: LegacyLineupKeyParams = {
          ...baseContext.params,
          teamId: team.teamId,
        };

        const contextResult =
          source === "prisma"
            ? await new LegacyLineupContextLoader().loadLegacyLineupContext(params)
            : loadLocalLegacyLineupContext(params);

        if (!contextResult.ok) {
          return toBlockedEntry(team, [...contextResult.errors, ...contextResult.warnings]);
        }

        return toBatchEntry(team, buildAiLegacyLineupPreview(contextResult.context, source));
      }),
    );

    const sortedTeams = [...teams].sort((left, right) => {
      if (right.totalExpectedScore !== left.totalExpectedScore) {
        return right.totalExpectedScore - left.totalExpectedScore;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

    return NextResponse.json({
      source,
      readOnly: true,
      matchdayId: baseContext.params.matchdayId,
      totalTeams: sortedTeams.length,
      readyTeams: sortedTeams.filter((entry) => entry.status === "ready").length,
      warningTeams: sortedTeams.filter((entry) => entry.status === "incomplete_roster" || entry.status === "missing_scores").length,
      blockedTeams: sortedTeams.filter((entry) => entry.status === "blocked").length,
      teams: sortedTeams,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI batch preview could not be loaded.",
      },
      { status: 500 },
    );
  }
}
