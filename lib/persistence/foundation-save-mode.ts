import type { GameState, ScenarioMeta } from "@/lib/data/olyDataTypes";

export type FoundationSaveModePreset = "solo_1" | "solo_2" | "solo_4" | "online_4v4" | "custom";
export type FoundationSaveMode = "all" | FoundationSaveModePreset;

type SaveModeInput = {
  name?: string | null;
  scenarioMeta?: ScenarioMeta | null;
  gameState?: GameState | null;
  saveMode?: FoundationSaveModePreset | null;
};

const PRESET_SAVE_MODES: FoundationSaveModePreset[] = ["solo_1", "solo_2", "solo_4", "online_4v4", "custom"];

export const FOUNDATION_SAVE_MODE_OPTIONS: Array<{ value: FoundationSaveMode; label: string }> = [
  { value: "all", label: "Alle Spielstände" },
  { value: "solo_1", label: "Solo 1 Team" },
  { value: "solo_2", label: "Solo 2 Teams" },
  { value: "solo_4", label: "Solo 4 Teams" },
  { value: "online_4v4", label: "Multiplayer 4v4" },
  { value: "custom", label: "Custom" },
];

export function normalizeFoundationSaveMode(value?: string | null): FoundationSaveMode {
  return value === "all" || PRESET_SAVE_MODES.includes(value as FoundationSaveModePreset)
    ? (value as FoundationSaveMode)
    : "all";
}

export function normalizeFoundationPresetSaveMode(value?: string | null): FoundationSaveModePreset | null {
  return PRESET_SAVE_MODES.includes(value as FoundationSaveModePreset) ? (value as FoundationSaveModePreset) : null;
}

export function formatFoundationSaveModeLabel(mode?: FoundationSaveMode | null) {
  return FOUNDATION_SAVE_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Custom";
}

function hasRoomContext(meta?: ScenarioMeta | null) {
  return Boolean(
    meta?.roomId ||
      meta?.roomCode ||
      (meta?.roomParticipants?.length ?? 0) > 0 ||
      meta?.scenarioType === "manager_multiplayer_test",
  );
}

function countHumanTeams(gameState?: GameState | null) {
  if (!gameState) {
    return null;
  }

  const settings = gameState.seasonState.teamControlSettings;
  if (settings) {
    return Object.values(settings).filter((setting) => setting.controlMode === "manual").length;
  }

  return gameState.teams.filter((team) => team.humanControlled).length;
}

function modeFromHumanTeamCount(count: number | null | undefined): FoundationSaveModePreset | null {
  if (count === 1) return "solo_1";
  if (count === 2) return "solo_2";
  if (count === 4) return "solo_4";
  if (typeof count === "number" && count > 0) return "custom";
  return null;
}

function modeFromText(input: SaveModeInput): FoundationSaveModePreset | null {
  const text = `${input.name ?? ""} ${input.scenarioMeta?.label ?? ""} ${input.scenarioMeta?.description ?? ""}`.toLowerCase();
  if (text.includes("online 4v4") || text.includes("multiplayer") || text.includes("room")) return "online_4v4";
  if (text.includes("solo 4") || text.includes("4 team")) return "solo_4";
  if (text.includes("solo 2") || text.includes("2 team")) return "solo_2";
  if (text.includes("solo 1") || text.includes("singleplayer foundation")) return "solo_1";
  return null;
}

export function resolveFoundationSaveMode(input: SaveModeInput): FoundationSaveModePreset {
  const meta = input.scenarioMeta ?? input.gameState?.scenarioMeta ?? null;
  const declaredMode =
    normalizeFoundationPresetSaveMode(input.saveMode) ??
    normalizeFoundationPresetSaveMode(meta?.saveMode) ??
    normalizeFoundationPresetSaveMode(meta?.newGamePresetId);
  if (declaredMode) {
    return declaredMode;
  }

  if (hasRoomContext(meta)) {
    return "online_4v4";
  }

  const countMode = modeFromHumanTeamCount(meta?.humanControlledTeamCount ?? countHumanTeams(input.gameState));
  if (countMode) {
    return countMode;
  }

  const textMode = modeFromText({ ...input, scenarioMeta: meta });
  if (textMode) {
    return textMode;
  }

  if (!meta || meta.scenarioType === "fresh_start") {
    return "solo_1";
  }

  return "custom";
}

export function matchesFoundationSaveMode(mode: FoundationSaveMode, input: SaveModeInput) {
  return mode === "all" || resolveFoundationSaveMode(input) === mode;
}
