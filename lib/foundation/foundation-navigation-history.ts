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
};

const HISTORY_STATE_KEY = "foundationNav";

export function parseFoundationPanelFromUrl(): FoundationPanelId {
  if (typeof window === "undefined") return null;
  const panel = new URL(window.location.href).searchParams.get("panel");
  if (panel === "offer" || panel === "sell" || panel === "briefing" || panel === "facility") {
    return panel;
  }
  return null;
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

export function buildFoundationSearchParams(state: FoundationUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("view", state.view);

  if (state.tab) params.set("tab", state.tab);
  if (state.playerId) params.set("playerId", state.playerId);
  if (state.team) params.set("team", state.team);
  if (state.panel) params.set("panel", state.panel);
  if (state.facilityId) params.set("facilityId", state.facilityId);
  if (state.facilityAction) params.set("facilityAction", state.facilityAction);

  return params;
}

export function buildFoundationHref(state: FoundationUrlState, basePath = "/foundation"): string {
  const params = buildFoundationSearchParams(state);
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

  const href = buildFoundationHref(state);
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
