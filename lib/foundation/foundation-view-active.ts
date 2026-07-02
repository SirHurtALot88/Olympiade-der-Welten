import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export function isFoundationViewActive(activeView: FoundationViewId, ...views: FoundationViewId[]): boolean {
  return views.includes(activeView);
}

export function isFoundationAnyViewActive(activeView: FoundationViewId, views: FoundationViewId[]): boolean {
  return views.includes(activeView);
}
