import type { GameState, ScenarioMeta } from "@/lib/data/olyDataTypes";

// PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md, E4): "online_1v1"/"online_2v2" sind dazugekommen,
// weil ein 1+1- oder 2+2-Raum (neue RoomOwnershipPreset-Werte, types/game.ts) sonst unter
// "online_4v4" liefe und die Team-Zuteilung vier Plaetze je Seite anbaete, obwohl der Raum nur
// einen/zwei kennt (Befund 1.4 im Plan). Bestehende Spielstaende sind unangetastet -- es kommen
// zwei Werte dazu, keiner aendert sich.
export type FoundationSaveModePreset = "solo_1" | "solo_2" | "solo_4" | "online_1v1" | "online_2v2" | "online_4v4" | "custom";
export type FoundationSaveMode = "all" | FoundationSaveModePreset;

type SaveModeInput = {
  name?: string | null;
  scenarioMeta?: ScenarioMeta | null;
  gameState?: GameState | null;
  saveMode?: FoundationSaveModePreset | null;
};

const PRESET_SAVE_MODES: FoundationSaveModePreset[] = ["solo_1", "solo_2", "solo_4", "online_1v1", "online_2v2", "online_4v4", "custom"];

export const FOUNDATION_SAVE_MODE_OPTIONS: Array<{ value: FoundationSaveMode; label: string }> = [
  { value: "all", label: "Alle Spielstände" },
  { value: "solo_1", label: "Solo 1 Team" },
  { value: "solo_2", label: "Solo 2 Teams" },
  { value: "solo_4", label: "Solo 4 Teams" },
  { value: "online_1v1", label: "Multiplayer 1v1" },
  { value: "online_2v2", label: "Multiplayer 2v2" },
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

/**
 * FUND, geprueft fuer Paket 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md): dieser Rueckfall in
 * `resolveFoundationSaveMode` unten nimmt fuer JEDEN Raum-Kontext ohne deklarierten Modus
 * "online_4v4" an -- vor Paket 2 war das immer richtig, weil `startRoom`/
 * `syncRoomOwnershipToBoundSave` (room-store.ts) `saveMode: "online_4v4"` fuer JEDEN Raum woertlich
 * schrieben, unabhaengig vom Preset.
 *
 * ENTSCHEIDUNG: bleibt so, wird NICHT auf die neuen Modi erweitert. `declaredMode` (oben in
 * `resolveFoundationSaveMode`) gewinnt IMMER zuerst -- und seit Paket 2 deklariert jeder neu
 * erzeugte oder umverteilte Raum-Save seinen echten Modus explizit ueber `applyGameModeOwnership`
 * (room-store.ts, `resolveFoundationSaveModeForPreset` aus lib/room/online-room-model.ts). Dieser
 * Rueckfall hier wird also nur noch fuer Raum-Saves ohne deklarierten Modus erreicht -- Alt-Saves
 * von VOR Paket 2 (die ihn tatsaechlich alle als 4v4 kannten) oder ein beschaedigter/unvollstaendiger
 * Datensatz. Fuer BEIDE Faelle ist "online_4v4" weiterhin die einzige messbar richtige Annahme; ihn
 * auf einen der neuen Modi zu aendern waere geraten, nicht gemessen.
 */
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
  // "online 1v1"/"online 2v2" VOR dem allgemeinen "multiplayer"/"room"-Treffer geprueft (E4):
  // dieser Text-Scan laeuft ohnehin nur, wenn declaredMode UND hasRoomContext(meta) beide nichts
  // liefern (resolveFoundationSaveMode unten) -- fuer neu erzeugte Raum-Saves greift `declaredMode`
  // immer zuerst. Bleibt trotzdem ergaenzt, damit ein Text, der den neuen Modus explizit nennt,
  // nicht am generischen "multiplayer"/"room"-Treffer (der zuerst zu "online_4v4" griffe) vorbeiginge.
  if (text.includes("online 1v1")) return "online_1v1";
  if (text.includes("online 2v2")) return "online_2v2";
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
