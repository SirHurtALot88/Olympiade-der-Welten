import { NextResponse } from "next/server";

import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import type { GameState } from "@/lib/data/olyDataTypes";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildScenarioMeta } from "@/lib/persistence/scenario-meta";

type SaveActionBody =
  | { action: "create"; name: string }
  | { action: "clone"; sourceSaveId: string; name: string }
  | { action: "snapshot"; sourceSaveId: string; name?: string }
  | { action: "activate"; saveId: string }
  | { action: "fresh-season-1"; name?: string };

function serializeSave(save: {
  saveId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  gameState: GameState;
}) {
  return {
    saveId: save.saveId,
    name: save.name,
    status: save.status,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    gameState: save.gameState,
  };
}

function serializeSaveSummary(save: {
  saveId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  scenarioMeta?: unknown;
}) {
  return {
    saveId: save.saveId,
    name: save.name,
    status: save.status,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    scenarioMeta: save.scenarioMeta,
  };
}

async function loadPrismaResponse(saveId?: string) {
  const snapshot = await loadFoundationSnapshotFromPrisma(saveId);
  if (!snapshot) {
    return NextResponse.json(
      {
        save: null,
        saves: [],
        _meta: {
          source: "prisma",
          readOnly: true,
          generatedAt: new Date().toISOString(),
        },
        error: "Prisma foundation snapshot could not be loaded.",
      },
      { status: 404 },
    );
  }

  const projected = projectFoundationStateFromPrisma(snapshot);
  return NextResponse.json({
    save: projected.save,
    saves: projected.saves,
    _meta: {
      source: "prisma",
      readOnly: true,
      generatedAt: new Date().toISOString(),
    },
  });
}

function loadSqliteResponse(saveId?: string) {
  const persistence = createPersistenceService();
  const bootstrap = persistence.bootstrapSingleplayerSave();
  const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave() ?? bootstrap.save;

  if (!save) {
    return NextResponse.json(
      {
        save: null,
        saves: [],
        _meta: {
          source: "sqlite",
          readOnly: false,
          generatedAt: new Date().toISOString(),
        },
        error: "SQLite save could not be loaded.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    save: serializeSave({
      ...save,
      gameState: withNormalizedLocalTeamSettings(save.gameState),
    }),
    saves: persistence.listSaves().map(serializeSaveSummary),
    _meta: {
      source: "sqlite",
      readOnly: false,
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() || undefined;
  const source = searchParams.get("source")?.trim();

  if (source === "prisma") {
    return loadPrismaResponse(saveId);
  }

  return loadSqliteResponse(saveId);
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source")?.trim();
  if (source === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json()) as { saveId?: string; gameState?: GameState };
  if (!body.saveId || !body.gameState) {
    return NextResponse.json({ error: "saveId and gameState are required." }, { status: 400 });
  }

  const persistence = createPersistenceService();
  const save = persistence.saveSingleplayerState(body.saveId, withNormalizedLocalTeamSettings(body.gameState));

  return NextResponse.json({
    save: {
      saveId: save.saveId,
      name: save.name,
    },
    saves: persistence.listSaves().map(serializeSaveSummary),
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source")?.trim();
  if (source === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json()) as SaveActionBody;
  const persistence = createPersistenceService();

  let save:
    | ReturnType<typeof persistence.createSave>
    | ReturnType<typeof persistence.cloneSave>
    | ReturnType<typeof persistence.activateSave>
    | null = null;

  if (body.action === "create") {
    save = persistence.createSave(body.name);
  } else if (body.action === "clone") {
    save = persistence.cloneSave(body.sourceSaveId, body.name);
  } else if (body.action === "snapshot") {
    const source = persistence.getSaveById(body.sourceSaveId);
    if (!source) {
      return NextResponse.json({ error: "sourceSaveId could not be resolved." }, { status: 404 });
    }
    const scenarioMeta = buildScenarioMeta({
      gameState: source.gameState,
      label: body.name ?? `${source.name} Snapshot`,
      sourceSaveId: source.saveId,
      isStableTestPoint: true,
    });
    save = persistence.createScenarioSnapshot({
      sourceSaveId: source.saveId,
      name: body.name ?? scenarioMeta.label,
      scenarioMeta,
    });
  } else if (body.action === "activate") {
    save = persistence.activateSave(body.saveId);
  } else if (body.action === "fresh-season-1") {
    save = persistence.createFreshSeasonOneSave({
      name: body.name,
    });
  }

  return NextResponse.json({
    save: save ? { saveId: save.saveId } : null,
    saves: persistence.listSaves().map(serializeSaveSummary),
  });
}
function withNormalizedLocalTeamSettings(gameState: GameState): GameState {
  return withNormalizedTeamStrategyProfiles(withNormalizedTeamControlSettings(withNormalizedTeamIdentityOverrides(gameState)));
}
