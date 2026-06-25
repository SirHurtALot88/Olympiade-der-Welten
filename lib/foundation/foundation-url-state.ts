import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export function parseFoundationTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("tab");
}

export function parseFoundationPlayerIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("playerId");
}

export function syncFoundationUrlState(input: {
  view: FoundationViewId;
  tab?: string | null;
  playerId?: string | null;
}) {
  if (typeof window === "undefined") return;

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("view", input.view);

  if (input.tab) {
    nextUrl.searchParams.set("tab", input.tab);
  } else {
    nextUrl.searchParams.delete("tab");
  }

  if (input.playerId) {
    nextUrl.searchParams.set("playerId", input.playerId);
  } else {
    nextUrl.searchParams.delete("playerId");
  }

  window.history.replaceState({}, "", nextUrl.toString());
}
