import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  buildFoundationHref,
  type FoundationPanelId,
  type FoundationUrlState,
  writeFoundationUrlState,
} from "@/lib/foundation/foundation-navigation-history";

export function parseFoundationTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("tab");
}

export function parseFoundationPlayerIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("playerId");
}

export function parseFoundationSaveIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("saveId");
}

export type { FoundationPanelId, FoundationUrlState };

export function syncFoundationUrlState(
  input: FoundationUrlState,
  options?: { mode?: "push" | "replace" },
) {
  writeFoundationUrlState(input, options?.mode ?? "replace");
}

/** @deprecated use syncFoundationUrlState */
export function syncFoundationUrlStateLegacy(input: {
  view: FoundationViewId;
  tab?: string | null;
  playerId?: string | null;
}) {
  syncFoundationUrlState({
    view: input.view,
    tab: input.tab ?? null,
    playerId: input.playerId ?? null,
    team: typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("team") : null,
    panel: null,
    facilityId: null,
    facilityAction: null,
  });
}

export { buildFoundationHref };
