"use client";

/**
 * Foundation shell module-scope helpers (Phase 5.4 — module-scope extraction).
 *
 * Pure helper functions + small static config objects that used to live at
 * module scope inside `FoundationPageClient.tsx`: table-preference
 * (de)serialization, view/URL/localStorage sync helpers, player-portrait
 * rendering, owner/team-identity/strategy normalization, and the static
 * nav-view/training-mode config lists. None of this closes over component
 * state, so it is safe to import from the parent or any extracted tab host.
 */
import { useState } from "react";
import type { CSSProperties } from "react";

import type { GameInboxItem, GameState, Player, Team, TeamControlSettings, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitMediaModel } from "@/lib/data/mediaAssets";
import {
  DEFAULT_ACTIVE_OWNER_ID,
  withNormalizedTeamControlSettings,
  type TeamControlFilter,
} from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { normalizeFoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import type { FoundationTableColumn } from "@/lib/foundation/foundation-table-ui-types";
import {
  getDefaultFoundationViewTarget,
  normalizeFoundationViewParam,
  type FoundationViewId,
} from "@/lib/foundation/foundation-view-routing";
import type { GameFlowView } from "@/lib/foundation/game-flow-controller";
import {
  mergeFoundationHistoryReplaceState,
  parseFoundationFacilityFromUrl,
  parseFoundationPanelFromUrl,
  readFoundationHistoryState,
  type FoundationPanelId,
} from "@/lib/foundation/foundation-navigation-history";
import { parseFoundationPlayerIdFromUrl, parseFoundationTabFromUrl, syncFoundationUrlState } from "@/lib/foundation/foundation-url-state";
import {
  getDefaultGlobalTableWidths,
  normalizeGlobalTablePreferenceEntry,
  uniqueGlobalColumnIds,
} from "@/lib/ui/global-table-layout";
import { PLAYER_PROGRESSION_XP_CONSTANTS } from "@/lib/training/player-progression-forecast";
import type {
  ActiveManagerTeamContext,
  ActiveManagerTeamSource,
  FoundationAiPreseasonAutomationRun,
  FoundationView,
  PersistedFoundationTablePreferenceEntry,
  PersistedFoundationTablePreferences,
  TeamRosterRoleFilter,
  TrainingModeDraft,
} from "@/lib/foundation/tabs/foundation-page-types";
import {
  FOUNDATION_ACTIVE_OWNER_STORAGE_KEY,
  FOUNDATION_MANAGER_TEAM_STORAGE_KEY,
  FOUNDATION_SAVE_MODE_STORAGE_KEY,
  FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY,
  FOUNDATION_TEAM_FILTER_STORAGE_KEY,
} from "@/lib/foundation/tabs/foundation-page-types";

export function loadFoundationTablePreferences(): PersistedFoundationTablePreferences {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(FOUNDATION_TABLE_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PersistedFoundationTablePreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeFoundationTablePreferenceEntry(
  entry?: PersistedFoundationTablePreferenceEntry,
): PersistedFoundationTablePreferenceEntry {
  const normalized = normalizeGlobalTablePreferenceEntry(entry);
  const activePreset =
    normalized.activePreset === "retool_default" ||
    normalized.activePreset === "compact" ||
    normalized.activePreset === "finance" ||
    normalized.activePreset === "performance" ||
    normalized.activePreset === "custom"
      ? normalized.activePreset
      : null;
  return {
    ...normalized,
    activePreset,
  };
}

export function getDefaultTableWidths(columns: FoundationTableColumn[]) {
  return getDefaultGlobalTableWidths(columns);
}

export function uniqueColumnIds(columnIds: string[]) {
  return uniqueGlobalColumnIds(columnIds);
}

export function applyStoredColumnOrder(
  columns: FoundationTableColumn[],
  columnOrder?: string[],
  pinnedLeft?: string[],
  pinnedRight?: string[],
) {
  const orderIndex = new Map((columnOrder ?? []).map((columnId, index) => [columnId, index]));
  const baseColumns = [...columns].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex == null && rightIndex == null) {
      return columns.findIndex((column) => column.id === left.id) - columns.findIndex((column) => column.id === right.id);
    }
    if (leftIndex == null) {
      return 1;
    }
    if (rightIndex == null) {
      return -1;
    }
    return leftIndex - rightIndex;
  });

  const columnById = new Map(baseColumns.map((column) => [column.id, column]));
  const leftPinnedColumns = uniqueColumnIds(pinnedLeft ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const rightPinnedColumns = uniqueColumnIds(pinnedRight ?? [])
    .map((columnId) => columnById.get(columnId))
    .filter((column): column is FoundationTableColumn => Boolean(column));
  const handled = new Set([...leftPinnedColumns, ...rightPinnedColumns].map((column) => column.id));
  const middleColumns = baseColumns.filter((column) => !handled.has(column.id));

  return [...leftPinnedColumns, ...middleColumns, ...rightPinnedColumns];
}

export const foundationPrimaryViews: Array<{ id: FoundationView; label: string; tooltip: string }> = [
  { id: "home", label: "Home", tooltip: "Manager-Zentrale: nächste Schritte, wichtigste Spieler, Liga-Lage und To-dos." },
  { id: "season", label: "Saisonstand", tooltip: "Tabelle, Manager, Teamstärken und Punkteentwicklung." },
  { id: "lineup", label: "Einsatzliste", tooltip: "Spieler in Slots setzen, Team-Boost wählen und Spieltag vorbereiten." },
  { id: "matchdayArena", label: "Arena", tooltip: "Spieltag als Reveal/Event ansehen und Ergebnis verstehen." },
  { id: "teams", label: "Teams", tooltip: "Kader, Verträge, Value, Achsenprofil und Teamdetails prüfen." },
  { id: "trainingCompact", label: "Training", tooltip: "Kompakte Trainingssteuerung: Modus, Klasse, Forecast und Risiko pro Spieler." },
  { id: "trainingV2", label: "Gebäude", tooltip: "Facilities V2: Upgrade, Wartung, Unterhalt und Wirkung am aktiven Spielstand." },
  { id: "players", label: "Spieler", tooltip: "Spieler suchen, vergleichen und Profil/Training/Markt öffnen." },
  { id: "ranks", label: "Ranks", tooltip: "Team- und Disziplinranks nach Gesamtstärke und Achsen." },
  { id: "diszis", label: "Diszis", tooltip: "Disziplinen, Mutatoren und Gewichtungen prüfen." },
  { id: "prize", label: "Preisgeld", tooltip: "Preisgeld- und Saisonende-Ausblick nach Tabellenplatz." },
  { id: "market", label: "Transfermarkt", tooltip: "Kaufen, verkaufen, Value prüfen und Budgets absichern." },
  { id: "history", label: "Transferhistorie", tooltip: "Vergangene Deals, Gewinne, Risiken und Kaderbewegungen." },
];

export const foundationAdminViews: Array<{ id: FoundationView; label: string; tooltip: string }> = [
	  { id: "cockpit", label: "Spieltag", tooltip: "Spieltag steuern, Status prüfen und nächste Phase vorbereiten." },
	  { id: "homeV2", label: "Home v2", tooltip: "Velo-Victory-artiges Manager-Dashboard mit Top-Spielern und KPIs (Preview)." },
	  { id: "facilitiesOverviewV2", label: "Facilities v2", tooltip: "Legacy-Overview — öffnet jetzt die volle Gebäude-V2 mit Save-Anbindung." },
	  { id: "scoutingCenterV2", label: "Scouting Hub", tooltip: "Scouting-Zusammenfassung und Handoff in den Transfermarkt — kein separates Center (Preview)." },
	  { id: "generator", label: "Player Generator", tooltip: "Spieler generieren und Draftwerte prüfen." },
  { id: "teamSettings", label: "Team Settings", tooltip: "Teamnamen, Manager, Identität und Steuerung konfigurieren." },
  { id: "admin", label: "Admin", tooltip: "Technische Steuerung, Import, Simulationen und Debug-Hilfen." },
];

export const foundationSecondaryViews: Array<{ id: FoundationView; label: string; tooltip: string }> = [
  { id: "seasonPreview", label: "Saisonstand Preview", tooltip: "Preview-Tabelle vor dem finalen Schreiben." },
  { id: "debug", label: "Debug", tooltip: "Nur technische Analyse und Rohsignale." },
];

export const foundationInternalViews: Array<{ id: FoundationView; label: string }> = [
  { id: "matchdayResult", label: "Spieltagsergebnis" },
  { id: "homeV2", label: "Home v2" },
  { id: "facilitiesOverviewV2", label: "Facilities Overview v2" },
  { id: "scoutingCenterV2", label: "Scouting Hub v2" },
  { id: "seasonV2", label: "Saisonstand v2" },
  { id: "historyV2", label: "Transferhistorie v2" },
  { id: "encyclopedia", label: "Lexikon" },
];

export const homeTaskLabelContract = [
  "Spieler verkaufen",
  "Spieler kaufen",
  "Training prüfen",
  "XP verteilen",
  "Facility Upgrade möglich",
  "Formkarten setzen",
  "Arena starten",
  "Ergebnis ansehen",
] as const;

export const foundationViews = [...foundationPrimaryViews, ...foundationAdminViews, ...foundationSecondaryViews, ...foundationInternalViews];

export function normalizeInboxTargetView(view: string | null | undefined): FoundationView {
  return foundationViews.some((entry) => entry.id === view) ? resolveFoundationViewTarget(view as FoundationView) : "home";
}

export function getFoundationViewScrollTarget(view: FoundationView | GameFlowView | string | null | undefined) {
  switch (view) {
    case "home":
      return "foundation-home";
    case "homeV2":
      return "foundation-home-v2";
    case "facilitiesOverviewV2":
      return "foundation-facilities-v2";
    case "scoutingCenterV2":
      return "foundation-scouting-hub-v2";
    case "inboxV2":
      return "foundation-inbox-v2";
    case "inbox":
      return "foundation-inbox-v2";
    case "hq":
      return "foundation-hq";
    case "encyclopedia":
      return "foundation-encyclopedia";
    case "lineup":
    case "lineupV2":
      return "foundation-lineup-v2";
    case "matchdayArena":
      return "foundation-matchday-arena";
    case "matchdayResult":
      return "foundation-matchday-result";
    case "season":
      return "team-table";
    case "seasonV2":
      return "foundation-season-v2";
    case "seasonPreview":
      return "standings-preview";
    case "players":
      return "players-table";
    case "teams":
      return "team-focus-roster";
    case "training":
      return "foundation-training-compact";
    case "trainingCompact":
      return "foundation-training-compact";
    case "trainingV2":
      return "foundation-facilities-v2";
    case "market":
      return "transfer-market";
    case "marketV2":
      return "transfer-market";
    case "history":
      return "transfer-history";
    case "historyV2":
      return "transfer-history";
    case "teamSettings":
      return "foundation-team-settings";
    case "admin":
      return "foundation-admin";
    case "generator":
      return "foundation-generator";
    case "cockpit":
      return "foundation-cockpit";
    case "prize":
      return "prize-money";
    case "ranks":
      return "discipline-ranks";
    case "diszis":
      return "foundation-diszis";
    default:
      return null;
  }
}

export function resolveFoundationPanelScrollTarget(input: {
  targetView: FoundationView | GameFlowView | string;
  panel?: string | null;
}) {
  if (input.panel === "sponsor-choice") {
    return "sponsor-choice";
  }
  if (input.panel === "board-objectives") {
    return "team-board-objectives";
  }
  if (input.panel === "contracts" || input.panel === "roster") {
    return "team-focus-roster";
  }
  if (input.panel === "formcards") {
    return "foundation-lineup";
  }
  if (input.panel === "training-plan") {
    return "foundation-facilities-v2";
  }
  if (input.panel === "season-end-development") {
    return "foundation-training-compact";
  }
  if (input.panel === "arena-result-summary") {
    return "arena-result-summary";
  }
  return input.panel ?? getFoundationViewScrollTarget(input.targetView) ?? "foundation-home";
}

export function scrollToFoundationTarget(targetId: string | null | undefined) {
  if (!targetId || typeof window === "undefined") {
    return;
  }
  window.setTimeout(() => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.remove("foundation-jump-target");
    window.requestAnimationFrame(() => {
      target.classList.add("foundation-jump-target");
      window.setTimeout(() => target.classList.remove("foundation-jump-target"), 1400);
    });
  }, 90);
}

export function buildPlayerProfileHydrationSuccessKey(seasonId: string, playerId: string) {
  return `${seasonId}:${playerId}`;
}

export function buildPlayerProfileHydrationFailureKey(seasonId: string, playerId: string, playersLoaded: number) {
  return `${seasonId}:${playerId}:fail:${playersLoaded}`;
}

export function buildPlayerProfileHydrationLoadingKey(seasonId: string, playerId: string) {
  return `${seasonId}:${playerId}:loading`;
}

export function buildSeasonBriefingDismissKey(saveId: string, seasonId: string) {
  return `${saveId}:${seasonId}`;
}

export function seasonBriefingDismissStorageKey(saveId: string, seasonId: string) {
  return `oly:season-briefing-dismissed:${buildSeasonBriefingDismissKey(saveId, seasonId)}`;
}

export function readSeasonBriefingDismissedFromStorage(saveId: string, seasonId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(seasonBriefingDismissStorageKey(saveId, seasonId)) === "1";
}

export function writeSeasonBriefingDismissedToStorage(saveId: string, seasonId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(seasonBriefingDismissStorageKey(saveId, seasonId), "1");
}

export function clearSeasonBriefingDismissedFromStorage(saveId: string, seasonId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(seasonBriefingDismissStorageKey(saveId, seasonId));
}

export function parseFoundationViewFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeFoundationViewParam(new URL(window.location.href).searchParams.get("view"));
}

export function syncFoundationViewInUrl(
  view: FoundationView,
  tab?: string | null,
  playerId?: string | null,
  options?: {
    panel?: FoundationPanelId;
    push?: boolean;
    facilityId?: string | null;
    facilityAction?: string | null;
    team?: string | null;
  },
) {
  if (typeof window === "undefined") {
    return;
  }

  const team =
    options?.team ??
    (typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("team") : null);

  syncFoundationUrlState(
    {
      view: view as FoundationViewId,
      tab: tab ?? null,
      playerId: playerId ?? null,
      team,
      panel: options?.panel ?? null,
      facilityId: options?.facilityId ?? null,
      facilityAction: options?.facilityAction ?? null,
    },
    { mode: options?.push ? "push" : "replace" },
  );
}

export function resolveFoundationViewTarget(view: FoundationView): FoundationView {
  return getDefaultFoundationViewTarget(view as FoundationViewId) as FoundationView;
}

export function resolveFoundationTeamId(teams: Team[], value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match =
    teams.find((team) => team.teamId.toLowerCase() === normalized) ??
    teams.find((team) => team.shortCode.toLowerCase() === normalized);

  return match?.teamId ?? null;
}

export function parseFoundationTeamIdFromUrl(teams: Team[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const team = new URL(window.location.href).searchParams.get("team");
  if (!team || team === "loading-team") {
    return null;
  }
  return resolveFoundationTeamId(teams, team);
}

export function getRawFoundationTeamParam() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL(window.location.href).searchParams.get("team");
}

export function readStoredFoundationManagerTeamId(teams: Team[]) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(FOUNDATION_MANAGER_TEAM_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { teamId?: string | null };
    return resolveFoundationTeamId(teams, parsed.teamId);
  } catch {
    return null;
  }
}

export function persistFoundationManagerTeamId(teamId: string, saveId: string | null, source: ActiveManagerTeamSource) {
  if (typeof window === "undefined" || !teamId) {
    return;
  }

  window.localStorage.setItem(
    FOUNDATION_MANAGER_TEAM_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      activeManagerTeamId: teamId,
      teamId,
      saveId,
      source,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function readStoredFoundationActiveOwnerId() {
  if (typeof window === "undefined") {
    return DEFAULT_ACTIVE_OWNER_ID;
  }

  try {
    const raw = window.localStorage.getItem(FOUNDATION_ACTIVE_OWNER_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ACTIVE_OWNER_ID;
    }

    const parsed = JSON.parse(raw) as { ownerId?: string | null };
    return parsed.ownerId || DEFAULT_ACTIVE_OWNER_ID;
  } catch {
    return DEFAULT_ACTIVE_OWNER_ID;
  }
}

export function persistFoundationActiveOwnerId(ownerId: string) {
  if (typeof window === "undefined" || !ownerId) {
    return;
  }

  window.localStorage.setItem(
    FOUNDATION_ACTIVE_OWNER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      ownerId,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function readStoredFoundationTeamFilter(): TeamControlFilter {
  if (typeof window === "undefined") {
    return "my_teams";
  }

  try {
    const raw = window.localStorage.getItem(FOUNDATION_TEAM_FILTER_STORAGE_KEY);
    if (!raw) {
      return "my_teams";
    }

    const parsed = JSON.parse(raw) as { filter?: TeamControlFilter | null };
    return parsed.filter ?? "my_teams";
  } catch {
    return "my_teams";
  }
}

export function persistFoundationTeamFilter(filter: TeamControlFilter) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    FOUNDATION_TEAM_FILTER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      filter,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function readStoredFoundationSaveMode(): FoundationSaveMode {
  if (typeof window === "undefined") {
    return "all";
  }

  try {
    const urlMode = new URL(window.location.href).searchParams.get("saveMode");
    if (urlMode) {
      return normalizeFoundationSaveMode(urlMode);
    }

    const raw = window.localStorage.getItem(FOUNDATION_SAVE_MODE_STORAGE_KEY);
    if (!raw) {
      return "all";
    }

    const parsed = JSON.parse(raw) as { saveMode?: string | null };
    return normalizeFoundationSaveMode(parsed.saveMode);
  } catch {
    return "all";
  }
}

export function persistFoundationSaveMode(saveMode: FoundationSaveMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    FOUNDATION_SAVE_MODE_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      saveMode,
      updatedAt: new Date().toISOString(),
    }),
  );

  const nextUrl = new URL(window.location.href);
  if (saveMode === "all") {
    nextUrl.searchParams.delete("saveMode");
  } else {
    nextUrl.searchParams.set("saveMode", saveMode);
  }
  mergeFoundationHistoryReplaceState(nextUrl.toString());
}

export function resolveDefaultManagerTeamId(teams: Team[], settingsMap?: Record<string, TeamControlSettings> | null) {
  if (settingsMap) {
    const userTeams = teams
      .filter((team) => settingsMap[team.teamId]?.controlMode === "manual" && settingsMap[team.teamId]?.ownerId === DEFAULT_ACTIVE_OWNER_ID)
      .sort((left, right) => String(settingsMap[left.teamId]?.ownerSlot ?? "").localeCompare(String(settingsMap[right.teamId]?.ownerSlot ?? "")));
    if (userTeams[0]) {
      return userTeams[0].teamId;
    }
  }
  return teams.find((team) => team.humanControlled)?.teamId ?? teams[0]?.teamId ?? "";
}

export function resolvePreferredFoundationTeamContext(
  teams: Team[],
  options?: {
    currentTeamId?: string | null;
    currentSource?: ActiveManagerTeamSource;
    initialTeamId?: string | null;
    settingsMap?: Record<string, TeamControlSettings> | null;
    ignoreStoredPreference?: boolean;
  },
): ActiveManagerTeamContext {
  const requestedFromUrl = parseFoundationTeamIdFromUrl(teams);
  if (requestedFromUrl) {
    return { teamId: requestedFromUrl, source: "route" };
  }

  const rawTeamParam = getRawFoundationTeamParam();
  const invalidRouteWarning =
    rawTeamParam && rawTeamParam.trim()
      ? `Team ${rawTeamParam} ist in diesem Save nicht vorhanden. Fallback auf Manager-Team.`
      : null;

  const requestedFromInitial = resolveFoundationTeamId(teams, options?.initialTeamId);
  if (requestedFromInitial) {
    return { teamId: requestedFromInitial, source: "route", warning: invalidRouteWarning };
  }

  const currentTeamId = options?.currentTeamId ?? null;
  if (currentTeamId && teams.some((team) => team.teamId === currentTeamId)) {
    return { teamId: currentTeamId, source: options?.currentSource ?? "manual_select", warning: invalidRouteWarning };
  }

  if (!options?.ignoreStoredPreference) {
    const requestedFromStorage = readStoredFoundationManagerTeamId(teams);
    if (requestedFromStorage) {
      return { teamId: requestedFromStorage, source: "saved_preference", warning: invalidRouteWarning };
    }
  }

  return { teamId: resolveDefaultManagerTeamId(teams, options?.settingsMap), source: "default_human_team", warning: invalidRouteWarning };
}

export function resolvePreferredFoundationTeamId(
  teams: Team[],
  options?: {
    currentTeamId?: string | null;
    initialTeamId?: string | null;
  },
) {
  return resolvePreferredFoundationTeamContext(teams, options).teamId;
}

export function syncFoundationTeamIdInUrl(teamId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readFoundationHistoryState();
  syncFoundationUrlState({
    view: (current?.view ?? parseFoundationViewFromUrl() ?? "homeV2") as FoundationViewId,
    tab: current?.tab ?? parseFoundationTabFromUrl(),
    playerId: current?.playerId ?? parseFoundationPlayerIdFromUrl(),
    team: teamId,
    panel: current?.panel ?? parseFoundationPanelFromUrl(),
    facilityId: current?.facilityId ?? parseFoundationFacilityFromUrl().facilityId,
    facilityAction: current?.facilityAction ?? parseFoundationFacilityFromUrl().facilityAction,
  });
}

export function compareSortValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "de", { numeric: true, sensitivity: "base" });
}

export function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export const trainingModeConfigs: Record<
  TrainingModeDraft,
  {
    label: string;
    baseXp: number;
    fatigueRisk: "niedrig" | "mittel" | "hoch";
    note: string;
  }
> = {
  leicht: {
    label: "Leicht",
    baseXp: PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.leicht,
    fatigueRisk: "niedrig",
    note: "Schonend, weniger Setpoints, bessere Regeneration.",
  },
  mittel: {
    label: "Mittel",
    baseXp: PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.mittel,
    fatigueRisk: "mittel",
    note: "Standardfokus für stabile Entwicklung und normale Erholung.",
  },
  hart: {
    label: "Hart",
    baseXp: PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.hart,
    fatigueRisk: "hoch",
    note: "Mehr Setpoints, aber spürbar schlechtere Regeneration.",
  },
};

export function getPlayerPortraitModel(player: Pick<Player, "id" | "name" | "portraitUrl" | "portraitPath">) {
  return getPlayerPortraitMediaModel(player);
}

export const TEAM_ROSTER_PORTRAIT_LOADING = {
  loading: "lazy",
  fetchPriority: "auto",
} as const;

export function PlayerPortrait({
  src,
  initials,
  alt,
  className,
  style,
  loading = "lazy",
  fetchPriority = "auto",
}: {
  src: string | null;
  initials: string;
  alt: string;
  className: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} transfermarkt-portrait-placeholder`} aria-label={`${alt} Platzhalter`} style={style}>
        {initials}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      style={style}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
    />
  );
}


export function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

export function getOwnerTeamHighlightClass(settings: TeamControlSettings | null | undefined) {
  if (settings?.controlMode !== "manual") {
    return "";
  }
  if (settings.ownerId === DEFAULT_ACTIVE_OWNER_ID) {
    return "is-owner-user-team";
  }
  if (settings.ownerId === "franky_remote_placeholder") {
    return "is-owner-franky-team";
  }
  return "";
}


export function getRanksMetricToneClass(columnId: string, scope: "head" | "cell") {
  const prefix = scope === "head" ? "ranks-head-metric" : "ranks-metric-cell";
  if (columnId === "totalRank") return `${prefix} ${prefix}-total ranks-summary-block-start`;
  if (columnId === "powRank") return `${prefix} ${prefix}-pow`;
  if (columnId === "speRank") return `${prefix} ${prefix}-spe`;
  if (columnId === "menRank") return `${prefix} ${prefix}-men`;
  if (columnId === "socRank") return `${prefix} ${prefix}-soc ranks-summary-block-end`;
  return "";
}



export function getResponsiveTableImageSize(width: number) {
  return Math.max(40, Math.min(160, width - 24));
}

export function isStaleAiPreseasonRun(run: FoundationAiPreseasonAutomationRun | null | undefined) {
  if (run?.status !== "running") {
    return false;
  }
  const startedAt = Date.parse(run.startedAt);
  if (!Number.isFinite(startedAt)) {
    return true;
  }
  return Date.now() - startedAt > 120_000;
}

export function normalizeAiPreseasonRun(run: FoundationAiPreseasonAutomationRun | null | undefined) {
  if (!run || !isStaleAiPreseasonRun(run)) {
    return run ?? null;
  }
  return {
    ...run,
    status: "failed" as const,
    completedAt: run.completedAt ?? new Date().toISOString(),
    blockingReasons: Array.from(new Set([...(run.blockingReasons ?? []), "ai_preseason_run_stale"])),
  };
}



export function isInboxItemOwnedByTeam(item: GameInboxItem, teamId: string | null | undefined) {
  if (!teamId) {
    return false;
  }
  if (item.teamId === teamId) {
    return true;
  }
  const targetTeam =
    typeof item.targetParams.team === "string"
      ? item.targetParams.team
      : typeof item.targetParams.teamId === "string"
        ? item.targetParams.teamId
        : null;
  return targetTeam === teamId;
}



export const initialGameState: GameState = {
  season: {
    id: "loading",
    name: "Foundation lädt",
    year: 0,
    currentMatchday: 1,
    matchdayIds: [],
  },
  seasonState: {
    seasonId: "loading",
    schedule: [],
    standings: {},
    teamControlSettings: {},
    teamStrategyProfiles: {},
  },
  matchdayState: {
    matchdayId: "loading",
    status: "planning",
    pendingTeamIds: [],
    resolvedFixtureIds: [],
  },
  teams: [
    {
      teamId: "loading-team",
      shortCode: "LOAD",
      name: "Foundation lädt",
      logoPath: null,
      budget: 0,
      cash: 0,
      identityId: "loading-team",
      humanControlled: true,
      rosterLimit: 0,
      rosterMinTarget: 0,
      rosterOptTarget: 0,
    },
  ],
  teamIdentities: [
    {
      teamId: "loading-team",
      playerType: null,
      pow: 0,
      spe: 0,
      men: 0,
      soc: 0,
      ambition: 0,
      finances: 0,
      boardConfidence: 0,
      harmony: 0,
      manners: 0,
      popularity: 0,
      cooperation: 0,
      playerMin: 0,
      playerOpt: 0,
      sourceNote: "loading",
    },
  ],
  players: [],
  disciplines: [],
  rosters: [],
  contracts: [],
  transferListings: [],
  transferHistory: [],
  logs: [],
  mappingReport: {
    mappingSource: "loading",
    teamSource: "loading",
    generatedAt: new Date(0).toISOString(),
    processedMappingRows: 0,
    importedPlayerCount: 0,
    matchedRosterCount: 0,
    teamCount: 0,
    unmappedPlayers: [],
    teamsWithoutPlayers: [],
    mappingRowsWithoutPlayerMatch: [],
    duplicateMappedPlayers: [],
    unknownTeamCodes: [],
    duplicateTeamCodes: [],
    warnings: [],
  },
};

export function withNormalizedLocalTeamSettings(gameState: GameState): GameState {
  return withNormalizedTeamStrategyProfiles(
    withNormalizedTeamControlSettings(
      withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(gameState)),
    ),
  );
}

export function buildTeamIdentityDraftMap(teams: Team[], teamIdentities: TeamIdentity[]) {
  const byTeamId = new Map(teamIdentities.map((identity) => [identity.teamId, identity] as const));
  return Object.fromEntries(
    teams.flatMap((team) => {
      const identity = byTeamId.get(team.teamId);
      return identity ? [[team.teamId, identity] as const] : [];
    }),
  );
}

export function clampIdentityValue(value: number, key: keyof TeamIdentity) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value * 10) / 10;
  if (key === "playerMin" || key === "playerOpt") {
    return Math.max(0, Math.min(32, Math.round(rounded)));
  }

  return Math.max(0, Math.min(20, rounded));
}

export function getTeamRosterRoleBucket(roleTag: string | null | undefined): Exclude<TeamRosterRoleFilter, "all"> {
  const normalized = (roleTag ?? "").toLowerCase();
  if (normalized.includes("starter") || normalized.includes("star") || normalized.includes("core")) {
    return "starter";
  }
  if (normalized.includes("rotation")) {
    return "rotation";
  }
  if (normalized.includes("prospect")) {
    return "prospect";
  }
  if (normalized.includes("bench") || normalized.includes("bank")) {
    return "bench";
  }
  return "other";
}

export function clampBiasValue(value: number) {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function normalizeTeamStrategyLevel(value: string): "low" | "medium" | "high" {
  return value === "low" || value === "high" ? value : "medium";
}

export function withSynchronizedStrategyAliases(current: TeamStrategyProfile, patch: Partial<TeamStrategyProfile>): TeamStrategyProfile {
  const next = {
    ...current,
    ...patch,
  };

  if (patch.dislikedArchetypes) {
    next.avoidedArchetypes = patch.dislikedArchetypes;
  }
  if (patch.dislikedRaces) {
    next.avoidedRaces = patch.dislikedRaces;
  }
  if (patch.dislikedClasses) {
    next.avoidedClasses = patch.dislikedClasses;
  }
  if (patch.lockedNoGos) {
    next.hardNoGos = patch.lockedNoGos;
  }

  return next;
}

export function WarningList({
  title,
  warnings,
}: {
  title: string;
  warnings: string[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      {warnings.length > 0 ? (
        <ul className="warning-list">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Aktuell keine offenen Punkte.</p>
      )}
    </section>
  );
}

