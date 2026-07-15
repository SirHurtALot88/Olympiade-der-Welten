import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { normalizeFoundationViewParam } from "@/lib/foundation/foundation-view-routing";

export type FoundationPanelId = "offer" | "sell" | "briefing" | "facility" | null;

export type FoundationUrlState = {
  view: FoundationViewId;
  tab?: string | null;
  playerId?: string | null;
  team?: string | null;
  panel?: FoundationPanelId;
  facilityId?: string | null;
  facilityAction?: string | null;
  /**
   * Pins the Foundation shell to a specific save. When present, a fresh
   * navigation (reload, new tab, deep link) to this URL loads exactly this
   * save instead of falling back to the single global "active" save row.
   */
  saveId?: string | null;
};

export type FoundationRoomUrlParams = {
  roomCode: string;
  participantId: string;
  userId: string;
  seatToken: string;
  saveId: string;
};

const HISTORY_STATE_KEY = "foundationNav";

const ROOM_URL_PARAM_KEYS = ["roomCode", "participantId", "userId", "seatToken", "saveId"] as const;

export function readFoundationRoomParamsFromSearchParams(source: URLSearchParams): FoundationRoomUrlParams | null {
  const roomCode = source.get("roomCode")?.trim().toUpperCase() ?? "";
  const participantId = source.get("participantId")?.trim() ?? "";
  const userId = source.get("userId")?.trim() ?? "";
  const seatToken = source.get("seatToken")?.trim() ?? "";
  const saveId = source.get("saveId")?.trim() ?? "";

  if (!roomCode || !participantId || !userId || !seatToken || !saveId) {
    return null;
  }

  return { roomCode, participantId, userId, seatToken, saveId };
}

export function appendFoundationRoomParamsToSearchParams(
  params: URLSearchParams,
  roomParams: FoundationRoomUrlParams | null,
) {
  if (!roomParams) {
    return params;
  }

  params.set("roomCode", roomParams.roomCode);
  params.set("participantId", roomParams.participantId);
  params.set("userId", roomParams.userId);
  params.set("seatToken", roomParams.seatToken);
  params.set("saveId", roomParams.saveId);
  return params;
}

export function parseFoundationPanelFromUrl(): FoundationPanelId {
  if (typeof window === "undefined") return null;
  const panel = new URL(window.location.href).searchParams.get("panel");
  if (panel === "offer" || panel === "sell" || panel === "briefing" || panel === "facility") {
    return panel;
  }
  return null;
}

export function parseFoundationSaveIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("saveId");
}

/**
 * "Neues Spiel"-Absicht vom Startbildschirm: `?newGame=1` signalisiert, dass die
 * Person direkt in den New-Game-Assistenten (Team-Settings → Saves) will und der
 * bestehende Save NICHT mit seinem Season-Einstieg-Overlay dazwischenfunken soll.
 * Der Parameter ist bewusst nicht Teil von FoundationUrlState: Sobald irgendeine
 * reguläre URL-Synchronisierung läuft (spätestens beim Erstellen des neuen Saves),
 * fällt er von selbst wieder aus der URL und die Unterdrückung endet.
 */
export function parseFoundationNewGameIntentFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("newGame") === "1";
}

export function parseFoundationUrlStateFromLocation(): FoundationUrlState {
  if (typeof window === "undefined") {
    return {
      view: "homeV2",
      tab: null,
      playerId: null,
      team: null,
      panel: null,
      facilityId: null,
      facilityAction: null,
      saveId: null,
    };
  }

  const url = new URL(window.location.href);
  const facility = parseFoundationFacilityFromUrl();

  return {
    view: normalizeFoundationViewParam(url.searchParams.get("view")) ?? "homeV2",
    tab: url.searchParams.get("tab"),
    playerId: url.searchParams.get("playerId"),
    team: url.searchParams.get("team"),
    panel: parseFoundationPanelFromUrl(),
    facilityId: facility.facilityId,
    facilityAction: facility.facilityAction,
    saveId: url.searchParams.get("saveId"),
  };
}

export function mergeFoundationHistoryReplaceState(nextUrl: string, extraState: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const foundationNav = readFoundationHistoryState();
  const previousState =
    window.history.state && typeof window.history.state === "object" ? window.history.state : {};

  window.history.replaceState(
    {
      ...previousState,
      ...extraState,
      ...(foundationNav ? { [HISTORY_STATE_KEY]: foundationNav } : {}),
    },
    "",
    nextUrl,
  );
}
export function parseFoundationFacilityFromUrl(): { facilityId: string | null; facilityAction: string | null } {
  if (typeof window === "undefined") {
    return { facilityId: null, facilityAction: null };
  }
  const url = new URL(window.location.href);
  return {
    facilityId: url.searchParams.get("facilityId"),
    facilityAction: url.searchParams.get("facilityAction"),
  };
}

export function buildFoundationSearchParams(
  state: FoundationUrlState,
  options?: { roomParams?: FoundationRoomUrlParams | null; preserveRoomParamsFrom?: URLSearchParams | null },
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("view", state.view);

  if (state.tab) params.set("tab", state.tab);
  if (state.playerId) params.set("playerId", state.playerId);
  if (state.team) params.set("team", state.team);
  if (state.panel) params.set("panel", state.panel);
  if (state.facilityId) params.set("facilityId", state.facilityId);
  if (state.facilityAction) params.set("facilityAction", state.facilityAction);
  if (state.saveId) params.set("saveId", state.saveId);

  const roomParams =
    options?.roomParams ??
    (options?.preserveRoomParamsFrom ? readFoundationRoomParamsFromSearchParams(options.preserveRoomParamsFrom) : null);
  appendFoundationRoomParamsToSearchParams(params, roomParams);

  return params;
}

export function buildFoundationHref(
  state: FoundationUrlState,
  basePath = "/foundation",
  options?: { roomParams?: FoundationRoomUrlParams | null; preserveRoomParamsFrom?: URLSearchParams | null },
): string {
  const params = buildFoundationSearchParams(state, options);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function readFoundationHistoryState(): FoundationUrlState | null {
  if (typeof window === "undefined") return null;
  const raw = window.history.state?.[HISTORY_STATE_KEY];
  if (!raw || typeof raw !== "object" || typeof raw.view !== "string") {
    return null;
  }
  return raw as FoundationUrlState;
}

export function writeFoundationUrlState(state: FoundationUrlState, mode: "push" | "replace" = "replace") {
  if (typeof window === "undefined") return;

  const currentSearch = new URL(window.location.href).searchParams;
  const href = buildFoundationHref(state, "/foundation", { preserveRoomParamsFrom: currentSearch });
  const historyState = { [HISTORY_STATE_KEY]: state };

  if (mode === "push") {
    window.history.pushState(historyState, "", href);
  } else {
    window.history.replaceState(historyState, "", href);
  }
}

export function foundationNavigateBack() {
  if (typeof window === "undefined") return;
  window.history.back();
}

export function canFoundationNavigateBack() {
  if (typeof window === "undefined") return false;
  return window.history.length > 1;
}
