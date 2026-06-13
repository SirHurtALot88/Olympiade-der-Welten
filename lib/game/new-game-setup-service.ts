import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import type {
  GameState,
  ScenarioType,
  SeasonState,
  Team,
  TeamControlMode,
  TeamControlSettings,
} from "@/lib/data/olyDataTypes";
import { createNewGameFromPlayerBaseline } from "@/lib/players/player-baseline-service";
import { buildPlayerPotentialRecordsForSave } from "@/lib/progression/player-potential-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService, PersistedSaveGame } from "@/lib/persistence/types";
import { DEFAULT_ACTIVE_OWNER_ID, AI_OWNER_ID } from "@/lib/foundation/team-control-settings";
import {
  buildOwnershipForPreset,
  buildParticipant,
  createMultiplayerRoomMeta,
  syncParticipantControlledTeams,
} from "@/lib/room/online-room-model";
import type { RoomParticipant, TeamOwnershipRecord } from "@/types/game";

export type NewGamePresetId = "solo_1" | "solo_2" | "solo_4" | "online_4v4" | "custom";

export type NewGameSetupInput = {
  presetId: NewGamePresetId;
  chrisTeamIds?: string[];
  frankyTeamIds?: string[];
  sandbox?: boolean;
  saveName?: string;
  confirmToken?: string | null;
  now?: string;
  saveId?: string;
};

export type NewGameTeamPreview = {
  teamId: string;
  shortCode: string;
  name: string;
  budget: number;
  startRank: number;
  controlMode: TeamControlMode;
  ownerId: string;
  ownerLabel: string;
};

export type NewGameSetupPreview = {
  mode: "preview";
  presetId: NewGamePresetId;
  saveName: string;
  sandbox: boolean;
  scenarioType: ScenarioType;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  aiTeamIds: string[];
  teams: NewGameTeamPreview[];
  counts: {
    chris: number;
    franky: number;
    ai: number;
    passive: number;
    total: number;
  };
  baseline: {
    playerCount: number;
    baselineCount: number;
    resetPlayers: number;
  };
  seasonSetup: {
    seasonId: string;
    currentMatchday: number;
    gamePhase: "preseason_management";
    matchdayCount: number;
    scheduleCount: number;
    formCardsStatus: "pending_generation";
    lineupsStatus: "empty";
    standingsStatus: "empty_with_start_rank";
  };
  room:
    | {
        enabled: true;
        host: "Chris";
        pendingParticipant: "Franky";
        roomCode: "created_on_apply";
      }
    | {
        enabled: false;
      };
  warnings: string[];
  blockers: string[];
  confirmToken: string;
};

export type NewGameSetupApplyResult = {
  mode: "applied";
  save: {
    saveId: string;
    name: string;
  };
  previousActiveSaveId: string | null;
  preview: NewGameSetupPreview;
};

const CHRIS_ONLINE_4V4_TEAM_IDS = ["P-S", "D-P", "M-M", "V-W"];
const FRANKY_ONLINE_4V4_TEAM_IDS = ["M-S", "P-C", "C-S", "G-G"];

export const NEW_GAME_PRESETS: Array<{
  presetId: NewGamePresetId;
  label: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  isOnline: boolean;
}> = [
  { presetId: "solo_1", label: "Solo 1 Team", chrisTeamIds: ["M-M"], frankyTeamIds: [], isOnline: false },
  { presetId: "solo_2", label: "Solo 2 Teams", chrisTeamIds: ["M-M", "D-P"], frankyTeamIds: [], isOnline: false },
  { presetId: "solo_4", label: "Solo 4 Teams", chrisTeamIds: CHRIS_ONLINE_4V4_TEAM_IDS, frankyTeamIds: [], isOnline: false },
  {
    presetId: "online_4v4",
    label: "Online 4v4",
    chrisTeamIds: CHRIS_ONLINE_4V4_TEAM_IDS,
    frankyTeamIds: FRANKY_ONLINE_4V4_TEAM_IDS,
    isOnline: true,
  },
  { presetId: "custom", label: "Custom", chrisTeamIds: ["M-M"], frankyTeamIds: [], isOnline: false },
];

function uniqueTeamIds(teamIds: string[] | undefined, validTeamIds: Set<string>) {
  return Array.from(new Set((teamIds ?? []).map((teamId) => teamId.trim()).filter((teamId) => validTeamIds.has(teamId))));
}

function getPreset(presetId: NewGamePresetId) {
  return NEW_GAME_PRESETS.find((preset) => preset.presetId === presetId) ?? NEW_GAME_PRESETS[0]!;
}

function buildStartRankByTeamId(teams: Team[]) {
  return new Map(
    [...teams]
      .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.teamId.localeCompare(b.teamId))
      .map((team, index) => [team.teamId, index + 1] as const),
  );
}

function createControlSetting(input: {
  team: Team;
  controlMode: TeamControlMode;
  ownerId: string;
  ownerSlot: string;
  displayLabel: string;
}): TeamControlSettings {
  const isAi = input.controlMode === "ai";
  return {
    teamId: input.team.teamId,
    controlMode: input.controlMode,
    ownerId: input.ownerId,
    ownerSlot: input.ownerSlot,
    displayLabel: input.displayLabel,
    aiLineupPreviewEnabled: isAi,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: isAi,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: isAi,
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

function createScenarioRoomMeta(input: {
  enabled: boolean;
  saveId?: string;
  now: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
}) {
  if (!input.enabled) {
    return {
      participants: [] as RoomParticipant[],
      ownership: [] as TeamOwnershipRecord[],
      roomId: undefined,
      roomCode: undefined,
    };
  }

  const roomCode = `NEW-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const room = createMultiplayerRoomMeta({
    roomCode,
    saveId: input.saveId ?? "created_on_apply",
    createdByUserId: "user_chris",
    now: input.now,
  });
  const participants = syncParticipantControlledTeams(
    [
      buildParticipant({
        participantId: "participant-chris",
        userId: "user_chris",
        displayName: "Chris",
        role: "host",
        controlledTeamIds: input.chrisTeamIds,
        now: input.now,
      }),
      buildParticipant({
        participantId: "participant-franky",
        userId: "user_franky",
        displayName: "Franky",
        role: "player",
        connectionStatus: "offline",
        controlledTeamIds: input.frankyTeamIds,
        now: input.now,
      }),
    ],
    [],
  );
  const ownership = buildOwnershipForPreset(participants, "chris_4_franky_4_rest_ai");
  const patchedOwnership = ownership.map((entry) => {
    if (input.chrisTeamIds.includes(entry.teamId)) {
      return {
        ...entry,
        controllerType: "human" as const,
        participantId: "participant-chris",
        userId: "user_chris",
        ownerDisplayName: "Chris",
      };
    }
    if (input.frankyTeamIds.includes(entry.teamId)) {
      return {
        ...entry,
        controllerType: "human" as const,
        participantId: "participant-franky",
        userId: "user_franky",
        ownerDisplayName: "Franky",
      };
    }
    return {
      teamId: entry.teamId,
      controllerType: "ai" as const,
      ownerDisplayName: "AI",
    };
  });

  return {
    participants: syncParticipantControlledTeams(participants, patchedOwnership),
    ownership: patchedOwnership,
    roomId: room.roomId,
    roomCode: room.roomCode,
  };
}

function createConfirmToken(input: {
  presetId: NewGamePresetId;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  sandbox: boolean;
  baselineCount: number;
  playerCount: number;
  rankSignature: string;
}) {
  return [
    "new_game_setup_v1",
    input.presetId,
    input.sandbox ? "sandbox" : "standard",
    input.chrisTeamIds.join(","),
    input.frankyTeamIds.join(","),
    input.baselineCount,
    input.playerCount,
    input.rankSignature,
  ].join(":");
}

export function buildNewGameStateFromBaseline(input: NewGameSetupInput & { saveId?: string }) {
  const now = input.now ?? new Date().toISOString();
  const baseGameState = createFreshSeasonOneGameState();
  const validTeamIds = new Set(baseGameState.teams.map((team) => team.teamId));
  const preset = getPreset(input.presetId);
  const chrisTeamIds = uniqueTeamIds(input.chrisTeamIds ?? preset.chrisTeamIds, validTeamIds);
  const frankyTeamIds = uniqueTeamIds(input.frankyTeamIds ?? preset.frankyTeamIds, validTeamIds).filter(
    (teamId) => !chrisTeamIds.includes(teamId),
  );
  const humanTeamIds = new Set([...chrisTeamIds, ...frankyTeamIds]);
  const aiTeamIds = baseGameState.teams.filter((team) => !humanTeamIds.has(team.teamId)).map((team) => team.teamId);
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (chrisTeamIds.length === 0) {
    blockers.push("new_game_requires_at_least_one_chris_team");
  }
  if (input.presetId === "online_4v4" && frankyTeamIds.length !== 4) {
    warnings.push("online_4v4_expected_four_franky_teams");
  }
  if (input.presetId === "online_4v4" && chrisTeamIds.length !== 4) {
    warnings.push("online_4v4_expected_four_chris_teams");
  }

  const baselineReset = createNewGameFromPlayerBaseline({ gameState: baseGameState });
  if (!baselineReset.ok) {
    blockers.push(...baselineReset.blockers);
  }

  const startRankByTeamId = buildStartRankByTeamId(baseGameState.teams);
  const rankSignature = ["M-M", "R-R"]
    .map((teamId) => `${teamId}:${startRankByTeamId.get(teamId) ?? "missing"}`)
    .join("|");
  if (startRankByTeamId.get("M-M") !== 1) {
    warnings.push(`start_rank_reference_mismatch:M-M:${startRankByTeamId.get("M-M") ?? "missing"}`);
  }
  if (startRankByTeamId.get("R-R") !== 32) {
    warnings.push(`start_rank_reference_mismatch:R-R:${startRankByTeamId.get("R-R") ?? "missing"}`);
  }

  const roomMeta = createScenarioRoomMeta({
    enabled: input.presetId === "online_4v4",
    saveId: input.saveId,
    now,
    chrisTeamIds,
    frankyTeamIds,
  });

  const teamControlSettings = Object.fromEntries(
    baseGameState.teams.map((team) => {
      if (chrisTeamIds.includes(team.teamId)) {
        return [
          team.teamId,
          createControlSetting({
            team,
            controlMode: "manual",
            ownerId: DEFAULT_ACTIVE_OWNER_ID,
            ownerSlot: "user",
            displayLabel: "Chris",
          }),
        ];
      }
      if (frankyTeamIds.includes(team.teamId)) {
        return [
          team.teamId,
          createControlSetting({
            team,
            controlMode: "manual",
            ownerId: "franky_remote_placeholder",
            ownerSlot: "franky_remote_placeholder",
            displayLabel: "Franky",
          }),
        ];
      }
      return [
        team.teamId,
        createControlSetting({
          team,
          controlMode: "ai",
          ownerId: AI_OWNER_ID,
          ownerSlot: "ai",
          displayLabel: "AI",
        }),
      ];
    }),
  );

  const resetGameState = baselineReset.ok ? baselineReset.gameState : baseGameState;
  const standings: SeasonState["standings"] = Object.fromEntries(
    baseGameState.teams.map((team) => [
      team.teamId,
      {
        points: 0,
        rank: startRankByTeamId.get(team.teamId) ?? null,
        startplatz: startRankByTeamId.get(team.teamId) ?? null,
        rankDiff: 0,
      },
    ]),
  );

  const scenarioType: ScenarioType = input.sandbox ? "sandbox_multiseason_test" : "new_game";
  const saveName =
    input.saveName?.trim() ||
    (input.presetId === "online_4v4"
      ? `Oly Online 4v4 New Game ${new Date(now).toLocaleString("de-DE")}`
      : `Oly New Game ${getPreset(input.presetId).label} ${new Date(now).toLocaleString("de-DE")}`);

  const gameState: GameState = {
    ...resetGameState,
    gamePhase: "preseason_management",
    saveVersion: 1,
    lastAppliedEventId: null,
    appliedEventIds: [],
    scenarioMeta: {
      scenarioType,
      label: saveName,
      description: input.sandbox
        ? "Neues Sandbox-Testspiel aus immutable Player-Baseline."
        : "Neues Spiel aus immutable Player-Baseline und echten Startbudgets.",
      createdAt: now,
      isStableTestPoint: false,
      allowTestWrites: Boolean(input.sandbox),
      containsFinalStandings: false,
      containsSeasonHistory: false,
      activeSeasonId: "season-1",
      activeMatchday: 1,
      gamePhase: "preseason_management",
      roomId: roomMeta.roomId,
      roomCode: roomMeta.roomCode,
      roomParticipants: roomMeta.participants,
      teamOwnership: roomMeta.ownership,
    },
    season: {
      ...resetGameState.season,
      id: "season-1",
      name: "Season 1",
      currentMatchday: 1,
    },
    matchdayState: {
      matchdayId: resetGameState.season.matchdayIds[0] ?? "season-1-matchday-1",
      status: "planning",
      pendingTeamIds: baseGameState.teams.map((team) => team.teamId),
      resolvedFixtureIds: [],
    },
    teams: resetGameState.teams.map((team) => ({
      ...team,
      cash: team.budget,
      humanControlled: humanTeamIds.has(team.teamId),
    })),
    rosters: [],
    contracts: [],
    transferHistory: [],
    playerPotential: buildPlayerPotentialRecordsForSave({
      saveId: input.saveId ?? "season-1-new-game-preview",
      players: resetGameState.players,
    }),
    playerProgressionEvents: [],
    seasonState: {
      ...resetGameState.seasonState,
      seasonId: "season-1",
      standings,
      teamControlSettings,
      teamFacilities: {},
      facilityEvents: [],
      teamSeasonObjectives: [],
      boardConfidence: {},
      contractEvents: [],
      preSeasonWorkflowLogs: [],
      playerGeneratorDrafts: [],
      contractNegotiationDrafts: [],
      transferWishlist: [],
      standingsApplyLogs: [],
      cashPrizeApplyLogs: [],
      matchdayAdvanceLogs: [],
      formCards: [],
      lineupDrafts: [],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      seasonSnapshots: [],
    },
    logs: [
      {
        id: `log-new-game-${Date.now()}`,
        type: "system",
        message: `Neues Spiel vorbereitet (${getPreset(input.presetId).label}).`,
        createdAt: now,
      },
    ],
  };

  const preview: NewGameSetupPreview = {
    mode: "preview",
    presetId: input.presetId,
    saveName,
    sandbox: Boolean(input.sandbox),
    scenarioType,
    chrisTeamIds,
    frankyTeamIds,
    aiTeamIds,
    teams: gameState.teams.map((team) => {
      const setting = teamControlSettings[team.teamId]!;
      return {
        teamId: team.teamId,
        shortCode: team.shortCode,
        name: team.name,
        budget: team.budget,
        startRank: startRankByTeamId.get(team.teamId) ?? 0,
        controlMode: setting.controlMode,
        ownerId: setting.ownerId ?? AI_OWNER_ID,
        ownerLabel: setting.displayLabel ?? "AI",
      };
    }),
    counts: {
      chris: chrisTeamIds.length,
      franky: frankyTeamIds.length,
      ai: aiTeamIds.length,
      passive: 0,
      total: gameState.teams.length,
    },
    baseline: {
      playerCount: baseGameState.players.length,
      baselineCount: baseGameState.playerBaselines?.length ?? 0,
      resetPlayers: baselineReset.ok ? baselineReset.resetPlayers : 0,
    },
    seasonSetup: {
      seasonId: "season-1",
      currentMatchday: 1,
      gamePhase: "preseason_management",
      matchdayCount: gameState.season.matchdayIds.length,
      scheduleCount: gameState.seasonState.disciplineSchedule?.length ?? gameState.season.matchdayIds.length,
      formCardsStatus: "pending_generation",
      lineupsStatus: "empty",
      standingsStatus: "empty_with_start_rank",
    },
    room:
      input.presetId === "online_4v4"
        ? {
            enabled: true,
            host: "Chris",
            pendingParticipant: "Franky",
            roomCode: "created_on_apply",
          }
        : { enabled: false },
    warnings,
    blockers,
    confirmToken: createConfirmToken({
      presetId: input.presetId,
      chrisTeamIds,
      frankyTeamIds,
      sandbox: Boolean(input.sandbox),
      baselineCount: baseGameState.playerBaselines?.length ?? 0,
      playerCount: baseGameState.players.length,
      rankSignature,
    }),
  };

  return {
    gameState,
    preview,
  };
}

export function previewNewGameSetup(input: NewGameSetupInput): NewGameSetupPreview {
  return buildNewGameStateFromBaseline(input).preview;
}

export function applyNewGameSetup(
  input: NewGameSetupInput,
  persistence: PersistenceService = createPersistenceService(),
): NewGameSetupApplyResult {
  const previousActiveSaveId = persistence.getActiveSave()?.saveId ?? null;
  const preliminary = buildNewGameStateFromBaseline(input);
  if (preliminary.preview.blockers.length > 0) {
    throw new Error(`new_game_setup_blocked:${preliminary.preview.blockers.join(",")}`);
  }
  if (!input.confirmToken || input.confirmToken !== preliminary.preview.confirmToken) {
    throw new Error("new_game_setup_confirm_token_stale");
  }

  const saveId = `new-game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prepared = buildNewGameStateFromBaseline({ ...input, saveId });
  const created: PersistedSaveGame = persistence.createFreshSeasonOneSave({
    saveId,
    name: prepared.preview.saveName,
  });
  const saved = persistence.saveSingleplayerState(created.saveId, prepared.gameState);
  persistence.activateSave(saved.saveId);

  return {
    mode: "applied",
    save: {
      saveId: saved.saveId,
      name: saved.name,
    },
    previousActiveSaveId,
    preview: prepared.preview,
  };
}
