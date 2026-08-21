import type { GameState, Team, TeamControlMode, TeamControlSettings } from "@/lib/data/olyDataTypes";
import {
  resolveFoundationSaveMode,
  type FoundationSaveModePreset,
} from "@/lib/persistence/foundation-save-mode";

export const DEFAULT_ACTIVE_OWNER_ID = "user_local";
export const FRANKY_OWNER_ID = "franky_remote_placeholder";
export const LOCAL_USER_DISPLAY_LABEL = "Chris";
export const AI_OWNER_ID = "ai";

export type TeamOwnerType = "local_user" | "local_friend" | "remote_player" | "ai";

export type TeamOwner = {
  ownerId: string;
  label: string;
  type: TeamOwnerType;
  controlledTeamIds: string[];
};

export type TeamControlFilter =
  | "my_teams"
  | "human"
  | "ai"
  | "passive"
  | "all"
  | `owner:${string}`;

export const DEFAULT_TEAM_OWNERS: Array<Omit<TeamOwner, "controlledTeamIds">> = [
  { ownerId: DEFAULT_ACTIVE_OWNER_ID, label: LOCAL_USER_DISPLAY_LABEL, type: "local_user" },
  { ownerId: "ramona_local", label: "Ramona", type: "local_friend" },
  { ownerId: FRANKY_OWNER_ID, label: "Franky", type: "remote_player" },
  { ownerId: AI_OWNER_ID, label: "AI", type: "ai" },
];

function normalizeOwnerIdForMode(controlMode: TeamControlMode, ownerId: string | null | undefined) {
  if (controlMode === "manual") {
    return ownerId && ownerId !== AI_OWNER_ID ? ownerId : DEFAULT_ACTIVE_OWNER_ID;
  }

  if (controlMode === "ai") {
    return AI_OWNER_ID;
  }

  return ownerId ?? AI_OWNER_ID;
}

function normalizeOwnerSlotForMode(controlMode: TeamControlMode, ownerSlot: string | null | undefined, ownerId: string) {
  if (ownerSlot) {
    return ownerSlot;
  }

  if (controlMode === "manual") {
    return ownerId === DEFAULT_ACTIVE_OWNER_ID ? "user" : ownerId;
  }

  return controlMode;
}

export function createDefaultTeamControlSettings(team: Team): TeamControlSettings {
  const controlMode: TeamControlMode = team.humanControlled ? "manual" : "ai";
  const ownerId = normalizeOwnerIdForMode(controlMode, null);

  return {
    teamId: team.teamId,
    controlMode,
    ownerId,
    ownerSlot: normalizeOwnerSlotForMode(controlMode, null, ownerId),
    displayLabel: team.shortCode,
    aiLineupPreviewEnabled: controlMode === "ai",
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: controlMode === "ai",
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: controlMode === "ai",
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

/** Teams under manual control (Spieler-Teams aus Admin/Team-Einstellungen). */
export function getManualControlTeamIds(gameState: GameState): Set<string> {
  const settingsMap = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  return new Set(
    gameState.teams
      .filter((team) => settingsMap[team.teamId]?.controlMode === "manual")
      .map((team) => team.teamId),
  );
}

export function buildTeamControlSettingsMap(teams: Team[], existing?: Record<string, TeamControlSettings> | null) {
  return Object.fromEntries(
    teams.map((team) => {
      const current = existing?.[team.teamId];
      const defaults = createDefaultTeamControlSettings(team);
      const controlMode = current?.controlMode ?? defaults.controlMode;
      const ownerId = normalizeOwnerIdForMode(controlMode, current?.ownerId ?? defaults.ownerId);
      return [
        team.teamId,
        {
          ...defaults,
          ...current,
          teamId: team.teamId,
          controlMode,
          ownerId,
          ownerSlot: normalizeOwnerSlotForMode(controlMode, current?.ownerSlot ?? defaults.ownerSlot, ownerId),
          displayLabel: current?.displayLabel ?? defaults.displayLabel,
          aiLineupApplyEnabled: current?.aiLineupApplyEnabled ?? current?.aiLineupAutoApplyEnabled ?? defaults.aiLineupApplyEnabled,
        },
      ];
    }),
  );
}

export function getTeamControlSettings(gameState: GameState, teamId: string) {
  const existing = gameState.seasonState.teamControlSettings?.[teamId];
  if (existing) {
    return existing;
  }

  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team ? createDefaultTeamControlSettings(team) : null;
}

/**
 * Klarname zu einer Owner-ID — fuer Anzeigen, die eine Person benennen (z. B. wer einen
 * Spielstand angelegt hat).
 *
 * Gibt `null` zurueck, wenn keine ID vorliegt. Das ist ein echter Zustand, kein Fehler:
 * Spielstaende aus der Zeit vor der `created_by`-Spalte und alles, was ohne aktivierten
 * Login entstanden ist, haben schlicht keinen Urheber-Vermerk. Die Anzeigestelle
 * entscheidet, wie sie das benennt — hier wird nichts geraten.
 *
 * Unbekannte IDs kommen unveraendert zurueck statt als "Unbekannt": eine rohe ID ist beim
 * Nachsehen brauchbarer als ein Platzhalter.
 */
export function resolveOwnerDisplayLabel(ownerId: string | null | undefined): string | null {
  if (!ownerId) {
    return null;
  }
  return DEFAULT_TEAM_OWNERS.find((owner) => owner.ownerId === ownerId)?.label ?? ownerId;
}

export function isChrisOwnedTeamSettings(settings: TeamControlSettings | null | undefined) {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  const ownerId = normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
  return (
    ownerId === DEFAULT_ACTIVE_OWNER_ID ||
    settings.ownerSlot === "user" ||
    settings.displayLabel === LOCAL_USER_DISPLAY_LABEL
  );
}

export function isFrankyOwnedTeamSettings(settings: TeamControlSettings | null | undefined) {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  const ownerId = normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
  return ownerId === FRANKY_OWNER_ID || settings.displayLabel === "Franky";
}

export function deriveChrisFrankyTeamIdsFromSettings(teams: Team[], settingsMap: Record<string, TeamControlSettings>) {
  const chrisTeamIds: string[] = [];
  const frankyTeamIds: string[] = [];

  for (const team of teams) {
    const settings = settingsMap[team.teamId];
    if (isChrisOwnedTeamSettings(settings)) {
      chrisTeamIds.push(team.teamId);
      continue;
    }
    if (isFrankyOwnedTeamSettings(settings)) {
      frankyTeamIds.push(team.teamId);
    }
  }

  return { chrisTeamIds, frankyTeamIds };
}

export function getGameModeOwnershipLimits(saveMode: FoundationSaveModePreset): {
  chrisMax: number;
  frankyMax: number;
} {
  switch (saveMode) {
    case "online_4v4":
      return { chrisMax: 4, frankyMax: 4 };
    // PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md, E4): ohne diese zwei Zeilen liefe ein
    // 1+1-/2+2-Raum unter derselben Obergrenze wie 4v4 (der `default`-Zweig faellt sonst auf 1/0,
    // was einen 2+2-Raum faelschlich auf ein Team je Seite deckeln wuerde) -- die Obergrenze muss
    // zum tatsaechlich gewaehlten Save-Modus passen, nicht zur naechstbesten bekannten Groesse.
    case "online_2v2":
      return { chrisMax: 2, frankyMax: 2 };
    case "online_1v1":
      return { chrisMax: 1, frankyMax: 1 };
    case "solo_4":
      return { chrisMax: 4, frankyMax: 0 };
    case "solo_2":
      return { chrisMax: 2, frankyMax: 0 };
    case "solo_1":
      return { chrisMax: 1, frankyMax: 0 };
    case "custom":
      // Free single-player-first selection: up to 4 teams for the human (Chris) seat,
      // with the 2nd (Franky) seat available but optional/hidden by default.
      return { chrisMax: 4, frankyMax: 4 };
    default:
      return { chrisMax: 1, frankyMax: 0 };
  }
}

export function createChrisFrankyTeamControlSetting(
  team: Team,
  ownership: "chris" | "franky" | "ai",
): TeamControlSettings {
  if (ownership === "chris") {
    return {
      teamId: team.teamId,
      controlMode: "manual",
      ownerId: DEFAULT_ACTIVE_OWNER_ID,
      ownerSlot: "user",
      displayLabel: LOCAL_USER_DISPLAY_LABEL,
      aiLineupPreviewEnabled: false,
      aiLineupApplyEnabled: false,
      aiLineupAutoApplyEnabled: false,
      aiTransferPreviewEnabled: false,
      aiTransferAutoApplyEnabled: false,
      aiSellPreviewEnabled: false,
      aiSellAutoApplyEnabled: false,
      notes: null,
      strategyLock: null,
    };
  }

  if (ownership === "franky") {
    return {
      teamId: team.teamId,
      controlMode: "manual",
      ownerId: FRANKY_OWNER_ID,
      ownerSlot: FRANKY_OWNER_ID,
      displayLabel: "Franky",
      aiLineupPreviewEnabled: false,
      aiLineupApplyEnabled: false,
      aiLineupAutoApplyEnabled: false,
      aiTransferPreviewEnabled: false,
      aiTransferAutoApplyEnabled: false,
      aiSellPreviewEnabled: false,
      aiSellAutoApplyEnabled: false,
      notes: null,
      strategyLock: null,
    };
  }

  return {
    teamId: team.teamId,
    controlMode: "ai",
    ownerId: AI_OWNER_ID,
    ownerSlot: "ai",
    displayLabel: "AI",
    aiLineupPreviewEnabled: true,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: true,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: true,
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

export function applyChrisFrankyOwnershipToTeamControlSettings(
  teams: Team[],
  chrisTeamIds: string[],
  frankyTeamIds: string[],
  existing?: Record<string, TeamControlSettings> | null,
) {
  const chrisSet = new Set(chrisTeamIds);
  const frankySet = new Set(frankyTeamIds.filter((teamId) => !chrisSet.has(teamId)));

  return Object.fromEntries(
    teams.map((team) => {
      const existingSettings = existing?.[team.teamId];
      const ownership = chrisSet.has(team.teamId) ? "chris" : frankySet.has(team.teamId) ? "franky" : "ai";
      const nextSettings = createChrisFrankyTeamControlSetting(team, ownership);
      return [
        team.teamId,
        existingSettings
          ? {
              ...existingSettings,
              ...nextSettings,
              teamId: team.teamId,
              notes: existingSettings.notes ?? nextSettings.notes,
              strategyLock: existingSettings.strategyLock ?? nextSettings.strategyLock,
            }
          : nextSettings,
      ];
    }),
  );
}

export function resolveGameModeFromState(gameState: GameState): FoundationSaveModePreset {
  return resolveFoundationSaveMode({ gameState, scenarioMeta: gameState.scenarioMeta });
}

export function applyGameModeOwnership(
  gameState: GameState,
  input: {
    saveMode: FoundationSaveModePreset;
    chrisTeamIds: string[];
    frankyTeamIds: string[];
  },
): GameState {
  const validTeamIds = new Set(gameState.teams.map((team) => team.teamId));
  const chrisTeamIds = input.chrisTeamIds.filter((teamId) => validTeamIds.has(teamId));
  const frankyTeamIds = input.frankyTeamIds.filter(
    (teamId) => validTeamIds.has(teamId) && !chrisTeamIds.includes(teamId),
  );
  const teamControlSettings = applyChrisFrankyOwnershipToTeamControlSettings(
    gameState.teams,
    chrisTeamIds,
    frankyTeamIds,
    gameState.seasonState.teamControlSettings,
  );
  const teams = gameState.teams.map((team) => ({
    ...team,
    humanControlled: teamControlSettings[team.teamId]?.controlMode === "manual",
  }));
  const primaryChrisTeamId = chrisTeamIds[0] ?? null;
  const humanControlledTeamCount = chrisTeamIds.length + frankyTeamIds.length;

  return {
    ...gameState,
    teams,
    scenarioMeta: gameState.scenarioMeta
      ? {
          ...gameState.scenarioMeta,
          saveMode: input.saveMode,
          newGamePresetId: input.saveMode,
          humanControlledTeamCount,
        }
      : gameState.scenarioMeta,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings,
      newGameFlow: gameState.seasonState.newGameFlow
        ? {
            ...gameState.seasonState.newGameFlow,
            selectedTeamId:
              input.saveMode === "solo_1"
                ? primaryChrisTeamId
                : (gameState.seasonState.newGameFlow.selectedTeamId ?? primaryChrisTeamId),
          }
        : gameState.seasonState.newGameFlow,
    },
  };
}

/** Sync derived fields from teamControlSettings without mutating ownership. */
/**
 * EIN KI-TEAM, DAS SICH ALS MEINES AUSGIBT — UND DEN SPIELMODUS GLEICH MIT ERFINDET.
 *
 * GEMELDET VON CHRIS (`17xs83`, „Verwaltung · Settings", Spielstand `hwz8fk`): „Beim Switch in
 * Season 2 ist C-C plötzlich auch ein von mir gesteuertes Team! aber nur im KI Verhalten Reiter —
 * und ich bekomme das nicht weg…"
 *
 * DER AUSLÖSER IST BEHOBEN, DIE NARBE NICHT. `getProtectedHumanTeamIds` zählte früher jedes Team
 * mit `humanControlled !== false` — also auch `undefined` — als Spieler-Team, und
 * `protectManualPlayerTeams` SCHRIEB diese Annahme zurück (`humanControlled: true` plus
 * `controlMode: "manual"`). Ein einziger Durchlauf machte aus einem KI-Team dauerhaft ein
 * Spieler-Team. Seit der Korrektur zählt nur noch ein ausdrückliches `true` — die bereits
 * umgeschriebenen Spielstände heilt das aber nicht.
 *
 * WARUM ER ES NICHT WEGBEKAM, und das ist der eigentliche Befund: der Spielmodus ist in diesen
 * Ständen NICHT gesetzt (`scenarioMeta.saveMode` leer), sondern wird aus der ANZAHL der manuellen
 * Teams abgeleitet (`resolveFoundationSaveMode` → `modeFromHumanTeamCount`). Das falsch markierte
 * Team hat den Modus damit selbst erzeugt:
 *
 *   `hwz8fk`  Modus solo_2   Chris 2/2 (C-C, S-C)   selectedTeamId S-C   ← C-C ist die Narbe
 *   `89rv3s`  Modus solo_2   Chris 2/2 (C-C, S-C)   selectedTeamId S-C   ← dieselbe
 *   `n90y4m`  Modus solo_1   Chris 1/1 (C-C)        selectedTeamId C-C   ← hier ist C-C echt
 *
 * Die Oberfläche zeigt daraufhin „Chris 2/2 — voll", also den Fehler als gültige Einstellung. Sie
 * bestätigt ihn, statt ihn zu benennen.
 *
 * DER FINGERABDRUCK ist eng und über alle sieben Live-Spielstände geprüft:
 *
 *   1. `controlMode === "manual"`,
 *   2. das Etikett lautet „AI" — ein echt gewähltes Team trägt dort den Spielernamen; in den
 *      sieben Ständen trug KEIN echtes Spieler-Team „AI",
 *   3. es ist nicht das in `newGameFlow.selectedTeamId` gewählte Team.
 *
 * Zur Sicherheit bleibt mindestens ein manuelles Team stehen: eine Heilung, die einen Spielstand
 * ohne eigenes Team zurücklässt, wäre schlimmer als die Narbe.
 *
 * GESCHRIEBEN WIRD ÜBER `applyChrisFrankyOwnershipToTeamControlSettings` — dieselbe Funktion, die
 * auch die Team-Zuordnung benutzt. Ein eigener „setz das auf ai"-Zweig wäre eine zweite Wahrheit
 * darüber, was „KI-Team" bedeutet.
 */
export function heileFalschAlsMenschMarkierteTeams(gameState: GameState): {
  gameState: GameState;
  geheilteTeamIds: string[];
} {
  const teams = gameState.teams ?? [];
  if (teams.length === 0) {
    return { gameState, geheilteTeamIds: [] };
  }

  const settingsMap = buildTeamControlSettingsMap(teams, gameState.seasonState?.teamControlSettings);
  const gewaehltesTeam = gameState.seasonState?.newGameFlow?.selectedTeamId ?? null;

  const verdaechtig = teams
    .filter((team) => {
      const settings = settingsMap[team.teamId];
      if (!settings || settings.controlMode !== "manual") {
        return false;
      }
      if (team.teamId === gewaehltesTeam) {
        return false;
      }
      return (settings.displayLabel ?? "").trim().toUpperCase() === "AI";
    })
    .map((team) => team.teamId);

  if (verdaechtig.length === 0) {
    return { gameState, geheilteTeamIds: [] };
  }

  const { chrisTeamIds, frankyTeamIds } = deriveChrisFrankyTeamIdsFromSettings(teams, settingsMap);
  const verdaechtigeIds = new Set(verdaechtig);
  const naechsteChris = chrisTeamIds.filter((teamId) => !verdaechtigeIds.has(teamId));
  const naechsteFranky = frankyTeamIds.filter((teamId) => !verdaechtigeIds.has(teamId));

  // Der Riegel: lieber die Narbe behalten als einen Spielstand ohne eigenes Team.
  if (naechsteChris.length + naechsteFranky.length === 0) {
    return { gameState, geheilteTeamIds: [] };
  }

  const teamControlSettings = applyChrisFrankyOwnershipToTeamControlSettings(
    teams,
    naechsteChris,
    naechsteFranky,
    settingsMap,
  );

  return {
    gameState: {
      ...gameState,
      teams: teams.map((team) => ({
        ...team,
        humanControlled: teamControlSettings[team.teamId]?.controlMode === "manual",
      })),
      seasonState: {
        ...gameState.seasonState,
        teamControlSettings,
      },
    },
    geheilteTeamIds: verdaechtig,
  };
}

export function withNormalizedTeamControlSettings(gameState: GameState): GameState {
  /**
   * Vor der Normalisierung: die Narbe aus `17xs83` wegräumen — ein KI-Team, das ein früherer
   * Schutzlauf dauerhaft als Spieler-Team zurückgeschrieben hat. Begründung, Fingerabdruck und
   * Messung stehen in `team-control-narbe-heilen.ts`.
   *
   * HIER und nicht in einem Reparaturskript, weil dieser Normalisierer auf dem LADEPFAD läuft
   * (`app/api/singleplayer-state/route.ts` → `withNormalizedLocalTeamSettings`): bestehende
   * Spielstände heilen sich damit beim nächsten Laden selbst. Chris kommt an den Server nicht
   * heran, ein Skript hätte ihn also nicht erreicht.
   */
  const { gameState: geheilt } = heileFalschAlsMenschMarkierteTeams(gameState);
  const settingsMap = buildTeamControlSettingsMap(geheilt.teams, geheilt.seasonState.teamControlSettings);
  const teams = geheilt.teams.map((team) => ({
    ...team,
    humanControlled: settingsMap[team.teamId]?.controlMode === "manual",
  }));

  return {
    ...gameState,
    teams,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: buildTeamControlSettingsMap(teams, settingsMap),
    },
  };
}

export function mergeAiAutomationFromDraft(
  ownershipSettings: Record<string, TeamControlSettings>,
  draft: Record<string, TeamControlSettings>,
): Record<string, TeamControlSettings> {
  return Object.fromEntries(
    Object.entries(ownershipSettings).map(([teamId, settings]) => {
      const draftSettings = draft[teamId];
      if (settings.controlMode !== "ai" || !draftSettings) {
        return [teamId, settings];
      }

      return [
        teamId,
        {
          ...settings,
          aiLineupPreviewEnabled: draftSettings.aiLineupPreviewEnabled,
          aiLineupApplyEnabled: draftSettings.aiLineupApplyEnabled,
          aiLineupAutoApplyEnabled: draftSettings.aiLineupAutoApplyEnabled,
          aiTransferPreviewEnabled: draftSettings.aiTransferPreviewEnabled,
          aiTransferAutoApplyEnabled: draftSettings.aiTransferAutoApplyEnabled,
          aiSellPreviewEnabled: draftSettings.aiSellPreviewEnabled,
          aiSellAutoApplyEnabled: draftSettings.aiSellAutoApplyEnabled,
          notes: draftSettings.notes ?? settings.notes,
        },
      ];
    }),
  );
}

export function isAiLineupBatchApplyEnabled(settings: TeamControlSettings | null | undefined) {
  if (!settings) {
    return false;
  }

  return settings.aiLineupApplyEnabled ?? settings.aiLineupAutoApplyEnabled ?? false;
}

export function buildTeamOwners(teams: Team[], settingsMap: Record<string, TeamControlSettings>): TeamOwner[] {
  const ownerMeta = new Map(DEFAULT_TEAM_OWNERS.map((owner) => [owner.ownerId, owner]));
  const controlledTeamIds = new Map<string, string[]>();

  for (const team of teams) {
    const settings = settingsMap[team.teamId] ?? createDefaultTeamControlSettings(team);
    const ownerId = normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
    controlledTeamIds.set(ownerId, [...(controlledTeamIds.get(ownerId) ?? []), team.teamId]);
    if (!ownerMeta.has(ownerId)) {
      ownerMeta.set(ownerId, {
        ownerId,
        label: settings.displayLabel ?? ownerId,
        type: "local_friend",
      });
    }
  }

  return Array.from(ownerMeta.values()).map((owner) => ({
    ...owner,
    controlledTeamIds: controlledTeamIds.get(owner.ownerId) ?? [],
  }));
}

export function getTeamOwner(settings: TeamControlSettings | null | undefined) {
  if (!settings) {
    return null;
  }

  return normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
}

export function canOwnerManageTeam(
  settings: TeamControlSettings | null | undefined,
  activeOwnerId = DEFAULT_ACTIVE_OWNER_ID,
) {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  return getTeamOwner(settings) === activeOwnerId;
}

export function canLocalUserManageTeam(
  gameState: GameState,
  teamId: string | null | undefined,
  activeOwnerId = DEFAULT_ACTIVE_OWNER_ID,
) {
  if (!teamId) {
    return false;
  }

  return canOwnerManageTeam(getTeamControlSettings(gameState, teamId), activeOwnerId);
}

export function filterTeamsByControlScope(
  teams: Team[],
  settingsMap: Record<string, TeamControlSettings>,
  filter: TeamControlFilter,
  activeOwnerId = DEFAULT_ACTIVE_OWNER_ID,
) {
  if (filter === "all") {
    return teams;
  }

  if (filter === "human") {
    return teams.filter((team) => settingsMap[team.teamId]?.controlMode === "manual");
  }

  if (filter === "ai") {
    return teams.filter((team) => settingsMap[team.teamId]?.controlMode === "ai");
  }

  if (filter === "passive") {
    return teams.filter((team) => settingsMap[team.teamId]?.controlMode === "passive");
  }

  const ownerId = filter.startsWith("owner:") ? filter.slice("owner:".length) : activeOwnerId;
  return teams.filter((team) => {
    const settings = settingsMap[team.teamId];
    return getTeamOwner(settings) === ownerId;
  });
}
