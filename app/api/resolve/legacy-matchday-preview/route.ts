export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import type { LegacyLineupContextLoadResult, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildResolveLabPlayerCatalog,
  buildResolveLabSummary,
  buildResolveLabTeamDetails,
  buildResolveLabTopPlayersBySide,
  getHighlightCandidatesForTeam,
  getTopPlayerNameForTeam,
} from "@/lib/resolve/legacy-resolve-lab";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { db } from "@/src/server/db";

function parseOptionalParams(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite",
    saveId: searchParams.get("saveId")?.trim() ?? null,
    seasonId: searchParams.get("seasonId")?.trim() ?? null,
    matchdayId: searchParams.get("matchdayId")?.trim() ?? null,
  };
}

async function resolveDefaultPrismaParams(input: { saveId: string | null; seasonId: string | null; matchdayId: string | null }) {
  const save =
    (input.saveId ? await db.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await db.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) throw new Error("No save available for legacy resolve lab.");

  const season =
    (input.seasonId ? await db.season.findFirst({ where: { id: input.seasonId, saveId: save.id } }) : null) ??
    (await db.season.findFirst({ where: { id: "season-1", saveId: save.id } })) ??
    (await db.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));

  if (!season) throw new Error(`No season available for save ${save.id}.`);

  const matchday =
    (input.matchdayId ? await db.matchday.findFirst({ where: { id: input.matchdayId, seasonId: season.id } }) : null) ??
    (await db.matchday.findFirst({ where: { id: "matchday-1", seasonId: season.id } })) ??
    (await db.matchday.findFirst({ where: { seasonId: season.id }, orderBy: [{ index: "asc" }] }));

  if (!matchday) throw new Error(`No matchday available for season ${season.id}.`);

  return { saveId: save.id, seasonId: season.id, matchdayId: matchday.id };
}

function resolveDefaultSqliteParams(input: { saveId: string | null; seasonId: string | null; matchdayId: string | null }) {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (input.saveId ? persistence.getSaveById(input.saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for legacy resolve lab.");
  }

  const season = save.gameState.season;
  const seasonId = input.seasonId && input.seasonId === season.id ? input.seasonId : season.id;
  const matchdayId =
    input.matchdayId && season.matchdayIds.includes(input.matchdayId)
      ? input.matchdayId
      : save.gameState.matchdayState.matchdayId;

  return {
    saveId: save.saveId,
    seasonId,
    matchdayId,
  };
}

async function loadPrismaContexts(params: LegacyLineupKeyParams[]): Promise<LegacyLineupContextLoadResult[]> {
  const loader = new LegacyLineupContextLoader(db, new LegacyLineupRepository(db));
  return Promise.all(params.map((entry) => loader.loadLegacyLineupContext(entry)));
}

function loadSqliteContexts(params: LegacyLineupKeyParams[]): LegacyLineupContextLoadResult[] {
  return params.map((entry) => loadLocalLegacyLineupContext(entry));
}

export async function GET(request: Request) {
  try {
    const parsed = parseOptionalParams(request);
    const params =
      parsed.source === "prisma"
        ? await resolveDefaultPrismaParams(parsed)
        : resolveDefaultSqliteParams(parsed);

    const teamIds =
      parsed.source === "prisma"
        ? (
            await db.teamSeasonState.findMany({
              where: { saveId: params.saveId, seasonId: params.seasonId },
              orderBy: [{ teamId: "asc" }],
              select: { teamId: true },
            })
          ).map((state) => state.teamId)
        : (() => {
            const persistence = createPersistenceService();
            const save = persistence.getSaveById(params.saveId) ?? persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
            return save.gameState.teams.map((team) => team.teamId);
          })();

    const teamParams = teamIds.map<LegacyLineupKeyParams>((teamId) => ({
      ...params,
      teamId,
    }));
    const contextResults =
      parsed.source === "prisma"
        ? await loadPrismaContexts(teamParams)
        : loadSqliteContexts(teamParams);

    const errors = contextResults.flatMap((result) => (result.ok ? [] : result.errors));
    const warnings = contextResults.flatMap((result) => result.warnings);
    const contexts = contextResults.flatMap((result) => (result.ok ? [result.context] : []));

    if (contexts.length === 0) {
      return NextResponse.json({ error: "No legacy resolve contexts could be loaded.", errors, warnings }, { status: 500 });
    }

    const readinessRows = contexts.map((context) => buildLegacyMatchdayReadiness(context));
    const readinessByTeamId = new Map(readinessRows.map((row) => [row.teamId, row]));
    const preview = buildLegacyMatchdayResolvePreview(contexts);
    const summary = buildResolveLabSummary(preview, contexts, readinessByTeamId);
    const teamDetails = buildResolveLabTeamDetails(contexts, preview, readinessByTeamId);
    const topPlayers = buildResolveLabTopPlayersBySide(preview, contexts);
    const playerCatalog = buildResolveLabPlayerCatalog(contexts);

    return NextResponse.json({
      source: parsed.source,
      params,
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Legacy resolve preview could not be loaded." },
      { status: 500 },
    );
  }
}
