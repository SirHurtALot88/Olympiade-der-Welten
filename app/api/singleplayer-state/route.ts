export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import type {
  ContractNegotiationDraftStatus,
  GameState,
  NewGameFlowStepId,
  NewGameFlowStepStatus,
} from "@/lib/data/olyDataTypes";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import {
  DEFAULT_ACTIVE_OWNER_ID,
  buildTeamControlSettingsMap,
  withNormalizedTeamControlSettings,
} from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";
import { prepareGameStateForPersistence } from "@/lib/foundation/materialize-on-save";
import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import {
  matchesFoundationSaveMode,
  normalizeFoundationSaveMode,
  resolveFoundationSaveMode,
  type FoundationSaveMode,
} from "@/lib/persistence/foundation-save-mode";
import { buildScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistenceService, SaveSummary } from "@/lib/persistence/types";
import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import { setTeamCaptain } from "@/lib/morale/team-captain-service";
import { buildContractNegotiationDraft } from "@/lib/market/contract-negotiation-preview";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import { getActiveRoomBySaveId } from "@/lib/room/room-store";

type SaveActionBody =
  | { action: "create"; name: string }
  | { action: "clone"; sourceSaveId: string; name: string }
  | { action: "snapshot"; sourceSaveId: string; name?: string }
  | { action: "activate"; saveId: string }
  | { action: "fresh-season-1"; name?: string }
  | {
      action: "assign-team-captain";
      saveId: string;
      teamId: string;
      playerId: string;
    }
  | {
      action: "new-game-flow-step";
      saveId: string;
      stepId: NewGameFlowStepId;
      status: NewGameFlowStepStatus;
      selectedTeamId?: string | null;
    }
  | {
      action: "contract-negotiation-outcome";
      saveId: string;
      summary: TransfermarktBuyPreview;
      status: ContractNegotiationDraftStatus;
      extraWarnings?: string[];
    };

const NEW_GAME_FLOW_STEP_IDS: NewGameFlowStepId[] = [
  "season_intro",
  "team_confirm",
  "roster_review",
  "appoint_captain",
  "first_transfers",
  "fill_roster",
  "training_facilities",
  "set_lineup",
];

const NEW_GAME_FLOW_STEP_STATUSES: NewGameFlowStepStatus[] = ["open", "completed", "skipped"];

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
  saveMode?: unknown;
}) {
  return {
    saveId: save.saveId,
    name: save.name,
    status: save.status,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    scenarioMeta: save.scenarioMeta,
    saveMode: save.saveMode,
  };
}

function enrichSaveSummary(save: SaveSummary): SaveSummary {
  return {
    ...save,
    saveMode: resolveFoundationSaveMode(save),
  };
}

function listSavesForMode(persistence: PersistenceService, saveMode: FoundationSaveMode) {
  const summaries = persistence.listSaves().map(enrichSaveSummary);
  return saveMode === "all" ? summaries : summaries.filter((save) => matchesFoundationSaveMode(saveMode, save));
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

function loadSqliteResponse(saveId?: string, requestedSaveMode: FoundationSaveMode = "all", compactInitial = false) {
  const persistence = createPersistenceService();
  let allSaves = persistence.listSaves().map(enrichSaveSummary);
  if (allSaves.length === 0) {
    persistence.bootstrapSingleplayerSave();
    allSaves = persistence.listSaves().map(enrichSaveSummary);
  }

  const modeSaves =
    requestedSaveMode === "all"
      ? allSaves
      : allSaves.filter((summary) => matchesFoundationSaveMode(requestedSaveMode, summary));
  const activeSave = persistence.getActiveSave();
  const activeSaveSummary =
    activeSave && (requestedSaveMode === "all" || matchesFoundationSaveMode(requestedSaveMode, activeSave))
      ? activeSave
      : null;
  const fallbackSummary = modeSaves[0] ?? allSaves[0] ?? null;
  const save = saveId
    ? persistence.getSaveById(saveId)
    : activeSaveSummary
      ? activeSaveSummary
      : fallbackSummary
      ? persistence.activateSave(fallbackSummary.saveId) ?? persistence.getSaveById(fallbackSummary.saveId)
      : null;
  if (!saveId && fallbackSummary) {
    allSaves = persistence.listSaves().map(enrichSaveSummary);
  }
  const responseModeSaves =
    requestedSaveMode === "all"
      ? allSaves
      : allSaves.filter((summary) => matchesFoundationSaveMode(requestedSaveMode, summary));

  if (!save) {
    return NextResponse.json(
      {
        save: null,
        saves: [],
        _meta: {
          source: "sqlite",
          readOnly: false,
          generatedAt: new Date().toISOString(),
          saveMode: requestedSaveMode,
        },
        error: "SQLite save could not be loaded.",
      },
      { status: 404 },
    );
  }

  const normalizedGameState = withNormalizedLocalTeamSettings(save.gameState);
  const gameState = compactInitial ? normalizedGameState : refreshTeamObjectiveState(normalizedGameState);

  return NextResponse.json({
    save: serializeSave({
      ...save,
      gameState: compactInitial ? compactFoundationInitialGameState(gameState) : gameState,
    }),
    saves: responseModeSaves.map(serializeSaveSummary),
    _meta: {
      source: "sqlite",
      readOnly: false,
      generatedAt: new Date().toISOString(),
      saveMode: requestedSaveMode,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() || undefined;
  const source = searchParams.get("source")?.trim();
  const saveMode = normalizeFoundationSaveMode(searchParams.get("saveMode")?.trim());
  const compactInitial = searchParams.get("compact") === "foundation-initial";

  if (source === "prisma") {
    return loadPrismaResponse(saveId);
  }

  return loadSqliteResponse(saveId, saveMode, compactInitial);
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source")?.trim();
  const saveMode = normalizeFoundationSaveMode(searchParams.get("saveMode")?.trim());
  if (source === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json()) as {
    saveId?: string;
    gameState?: GameState;
    expectedSaveVersion?: number;
    expectedUpdatedAt?: string;
    materializeSeasonDerivations?: boolean;
    compactPut?: boolean;
    skipMaterializeIfUnchanged?: boolean;
  };
  if (!body.saveId || !body.gameState) {
    return NextResponse.json({ error: "saveId and gameState are required." }, { status: 400 });
  }

  const persistence = createPersistenceService();
  const existing = persistence.getSaveById(body.saveId);
  if (!existing) {
    return NextResponse.json({ error: `Save ${body.saveId} not found.` }, { status: 404 });
  }

  const currentSaveVersion = existing.gameState.saveVersion ?? 0;
  if (body.expectedSaveVersion !== undefined && body.expectedSaveVersion !== currentSaveVersion) {
    return NextResponse.json(
      {
        error: "save_version_conflict",
        currentSaveVersion,
        message: `Expected saveVersion ${body.expectedSaveVersion}, current is ${currentSaveVersion}.`,
      },
      { status: 409 },
    );
  }
  if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== existing.updatedAt) {
    return NextResponse.json(
      {
        error: "save_version_conflict",
        currentUpdatedAt: existing.updatedAt,
        message: "Save was updated elsewhere before this write could be applied.",
      },
      { status: 409 },
    );
  }

  const activeRoom = getActiveRoomBySaveId(body.saveId);
  if (activeRoom) {
    return NextResponse.json(
      {
        error: "room_save_generic_write_forbidden",
        roomCode: activeRoom.roomCode,
        message: "Room-Saves dürfen nicht über den Singleplayer-Fallback geschrieben werden.",
      },
      { status: 409 },
    );
  }

  const rehydratedGameState = rehydrateGameStateAfterCompactPut(existing.gameState, body.gameState);
  const nextGameState = withNormalizedLocalTeamSettings(rehydratedGameState);
  const preparedGameState = body.materializeSeasonDerivations
    ? withPersistedSeasonDerivations(nextGameState)
    : body.skipMaterializeIfUnchanged === false
      ? withPersistedSeasonDerivations(nextGameState)
      : prepareGameStateForPersistence(existing.gameState, nextGameState);
  const save = persistence.saveSingleplayerState(body.saveId, preparedGameState);

  return NextResponse.json({
    save: {
      saveId: save.saveId,
      name: save.name,
      saveVersion: save.gameState.saveVersion,
    },
    saves: listSavesForMode(persistence, saveMode).map(serializeSaveSummary),
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source")?.trim();
  const saveMode = normalizeFoundationSaveMode(searchParams.get("saveMode")?.trim());
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
  } else if (body.action === "assign-team-captain") {
    if (!body.saveId || !body.teamId || !body.playerId) {
      return NextResponse.json({ error: "saveId, teamId and playerId are required." }, { status: 400 });
    }

    const sourceSave = persistence.getSaveById(body.saveId);
    if (!sourceSave) {
      return NextResponse.json({ error: "saveId could not be resolved." }, { status: 404 });
    }

    const team = sourceSave.gameState.teams.find((entry) => entry.teamId === body.teamId);
    if (!team?.humanControlled) {
      return NextResponse.json({ error: "Kapitän kann nur für manuell geführte Teams gesetzt werden." }, { status: 403 });
    }

    let nextGameState: GameState;
    try {
      nextGameState = setTeamCaptain(sourceSave.gameState, body.teamId, body.playerId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Kapitän konnte nicht gesetzt werden." },
        { status: 400 },
      );
    }

    save = persistence.saveSingleplayerState(body.saveId, withNormalizedLocalTeamSettings(nextGameState));
  } else if (body.action === "new-game-flow-step") {
    if (!body.saveId || !NEW_GAME_FLOW_STEP_IDS.includes(body.stepId) || !NEW_GAME_FLOW_STEP_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "saveId, stepId and status are required." }, { status: 400 });
    }

    const sourceSave = persistence.getSaveById(body.saveId);
    if (!sourceSave) {
      return NextResponse.json({ error: "saveId could not be resolved." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const previousFlow = sourceSave.gameState.seasonState.newGameFlow ?? {
      active: true,
      selectedTeamId: body.selectedTeamId ?? null,
      steps: [],
    };
    const nextSteps = NEW_GAME_FLOW_STEP_IDS.map((stepId) => {
      const stored = previousFlow.steps?.find((step) => step.stepId === stepId);
      if (stepId !== body.stepId) {
        return stored ?? { stepId, status: "open" as const };
      }

      return {
        stepId,
        status: body.status,
        completedAt: body.status === "completed" ? now : stored?.completedAt ?? null,
        skippedAt: body.status === "skipped" ? now : stored?.skippedAt ?? null,
      };
    });
    const isHandled = nextSteps.every((step) => step.status === "completed" || step.status === "skipped");
    const nextGameState = withNormalizedLocalTeamSettings({
      ...sourceSave.gameState,
      seasonState: {
        ...sourceSave.gameState.seasonState,
        newGameFlow: {
          ...previousFlow,
          active: true,
          dismissed: false,
          selectedTeamId: body.selectedTeamId ?? previousFlow.selectedTeamId ?? null,
          steps: nextSteps,
          updatedAt: now,
          completedAt: isHandled ? previousFlow.completedAt ?? now : previousFlow.completedAt ?? null,
        },
      },
    });

    save = persistence.saveSingleplayerState(body.saveId, nextGameState);
  } else if (body.action === "contract-negotiation-outcome") {
    if (!body.saveId || !body.summary?.player?.id || !body.summary?.team?.id) {
      return NextResponse.json({ error: "saveId und summary mit Team/Spieler sind erforderlich." }, { status: 400 });
    }

    const sourceSave = persistence.getSaveById(body.saveId);
    if (!sourceSave) {
      return NextResponse.json({ error: "saveId could not be resolved." }, { status: 404 });
    }

    const summary = body.summary;
    const summaryTeam = summary.team;
    const summaryPlayer = summary.player;
    if (!summaryTeam || !summaryPlayer) {
      return NextResponse.json({ error: "summary team/player missing." }, { status: 400 });
    }
    const draft = buildContractNegotiationDraft({
      saveId: body.saveId,
      seasonId: sourceSave.gameState.season.id,
      teamId: summaryTeam.id,
      playerId: summaryPlayer.id,
      playerName: summaryPlayer.name,
      preview: {
        expectedSalary: summary.expectedSalary ?? null,
        baseExpectedSalary: summary.baseExpectedSalary ?? null,
        demandMultiplier: summary.demandMultiplier ?? null,
        offeredSalary: summary.offeredSalary ?? null,
        offerRatio: summary.offerRatio ?? null,
        contractLength: summary.contractLength,
        contractShape: summary.contractShape ?? "balanced",
        yearlySalarySchedule: summary.yearlySalarySchedule ?? [],
        totalSalary: summary.totalSalary ?? null,
        roundingAdjustment: summary.roundingAdjustment ?? null,
        buyoutCost: summary.buyoutCost ?? null,
        bracket: summary.bracket ?? null,
        teamFit: summary.teamFit ?? null,
        acceptanceScore: summary.acceptanceScore ?? null,
        acceptChance: summary.acceptChance ?? null,
        counterChance: summary.counterChance ?? null,
        rejectChance: summary.rejectChance ?? null,
        contractPreference: summary.contractPreference ?? null,
        demandBreakdown: summary.demandBreakdown ?? [],
        scoreBreakdown: summary.negotiationScoreBreakdown ?? [],
        reasons: summary.negotiationReasons ?? [],
        warnings: [...(summary.negotiationWarnings ?? []), ...(body.extraWarnings ?? [])],
        blockingReasons: summary.negotiationBlockingReasons ?? [],
        status: body.status,
      },
    });

    const currentDrafts = sourceSave.gameState.seasonState.contractNegotiationDrafts ?? [];
    const nextGameState = withNormalizedLocalTeamSettings({
      ...sourceSave.gameState,
      seasonState: {
        ...sourceSave.gameState.seasonState,
        contractNegotiationDrafts: [
          draft,
          ...currentDrafts.filter((entry) => entry.draftId !== draft.draftId),
        ],
      },
    });

    save = persistence.saveSingleplayerState(body.saveId, nextGameState);
  }

  return NextResponse.json({
    save: save
      ? {
          saveId: save.saveId,
          name: save.name,
          saveVersion: save.gameState.saveVersion,
        }
      : null,
    saves: listSavesForMode(persistence, saveMode).map(serializeSaveSummary),
  });
}
function withNormalizedLocalTeamSettings(gameState: GameState): GameState {
  return withNormalizedTeamStrategyProfiles(
    withNormalizedTeamControlSettings(
      withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(gameState)),
    ),
  );
}
