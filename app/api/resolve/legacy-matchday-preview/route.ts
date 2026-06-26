export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import type { LegacyLineupContextLoadResult, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { readArenaPreviewCache, writeArenaPreviewCache } from "@/lib/foundation/arena-preview-cache";
import { buildLegacyMatchdayResolvePreviewPayload } from "@/lib/foundation/legacy-matchday-resolve-preview-service";
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
  if (params.length === 0) {
    return [];
  }

  const first = params[0]!;
  return loadAllLocalLegacyLineupContexts({
    saveId: first.saveId,
    seasonId: first.seasonId,
    matchdayId: first.matchdayId,
    teamIds: params.map((entry) => entry.teamId),
  });
}

function buildArenaPreviewCacheSignature(versionMeta: {
  contentSignature?: string | null;
  saveVersion?: number | null;
  lineupDraftCount?: number;
  transferHistoryCount?: number;
  updatedAt?: string;
} | null) {
  if (versionMeta?.contentSignature) {
    return versionMeta.contentSignature;
  }

  if (!versionMeta) {
    return "0";
  }

  return `${versionMeta.saveVersion ?? 0}|${versionMeta.lineupDraftCount ?? 0}|${versionMeta.transferHistoryCount ?? 0}|${versionMeta.updatedAt ?? ""}`;
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

    if (parsed.source === "sqlite") {
      const persistence = createPersistenceService();
      const versionMeta = persistence.getSaveVersionMetadata(params.saveId);
      const cacheKey = `${params.saveId}:${params.seasonId}:${params.matchdayId}`;
      const cacheSignature = buildArenaPreviewCacheSignature(versionMeta);
      const cached = readArenaPreviewCache(cacheKey, cacheSignature);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const contextResults =
      parsed.source === "prisma"
        ? await loadPrismaContexts(teamParams)
        : loadSqliteContexts(teamParams);

    const responsePayload = buildLegacyMatchdayResolvePreviewPayload({
      source: parsed.source,
      params,
      contextResults,
    });

    if (!responsePayload) {
      const errors = contextResults.flatMap((result) => (result.ok ? [] : result.errors));
      const warnings = contextResults.flatMap((result) => result.warnings);
      return NextResponse.json({ error: "No legacy resolve contexts could be loaded.", errors, warnings }, { status: 500 });
    }

    if (parsed.source === "sqlite") {
      const persistence = createPersistenceService();
      const versionMeta = persistence.getSaveVersionMetadata(params.saveId);
      const cacheKey = `${params.saveId}:${params.seasonId}:${params.matchdayId}`;
      const cacheSignature = buildArenaPreviewCacheSignature(versionMeta);
      writeArenaPreviewCache(cacheKey, cacheSignature, responsePayload);
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Legacy resolve preview could not be loaded." },
      { status: 500 },
    );
  }
}
