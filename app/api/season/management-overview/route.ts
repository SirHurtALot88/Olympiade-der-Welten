export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { inspectSeasonManagementSheetWithFallback, mapSeasonManagementRowsToTeams } from "@/lib/foundation/season-management-sheet";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import { resolveSessionOwnerId } from "@/lib/auth/session";
import { db } from "@/src/server/db";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const seasonId = searchParams.get("seasonId")?.trim() || "season-1";
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const ownerId = source === "sqlite" ? await resolveSessionOwnerId() : null;

    const teamStates =
      source === "sqlite"
        ? (() => {
            const persistence = createPersistenceService();
            const resolved = resolveLocalPersistedSave(persistence, saveId, ownerId);
            return resolved
              ? resolved.save.gameState.teams.map((team) => ({
                  teamId: team.teamId,
                  team: { name: team.name },
                }))
              : [];
          })()
        : await db.teamSeasonState.findMany({
            where: {
              saveId,
              seasonId,
            },
            select: {
              teamId: true,
              team: {
                select: {
                  name: true,
                },
              },
            },
          });

    const sheet = await inspectSeasonManagementSheetWithFallback({ timeoutMs: 5000 });
    const mapping = mapSeasonManagementRowsToTeams(
      sheet.rows,
      teamStates.map((state) => ({
        teamId: state.teamId,
        teamName: state.team.name,
      })),
    );

    return NextResponse.json({
      items: mapping.mappedRows
        .filter((row) => row.teamId)
        .map((row) => ({
          teamId: row.teamId,
          teamName: row.resolvedTeamName ?? row.teamName,
          startBudget: row.startBudget,
          playerMin: row.playerMin,
          playerOpt: row.playerOpt,
          warnings: row.warnings,
        })),
      missingMappings: mapping.missingMappings,
      source: {
        kind: sheet.sourceKind,
        budgetColumn: "Startbudget",
        fallbackReason: sheet.fallbackReason,
      },
      scope: {
        saveId,
        seasonId,
      },
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    const message = error instanceof Error ? error.message : "Season management overview could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        missingMappings: [],
        source: {
          kind: "season_management_sheet",
          budgetColumn: "Startbudget",
        },
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
