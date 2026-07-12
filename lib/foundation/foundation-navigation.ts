import type { Dispatch, SetStateAction } from "react";

import { syncFoundationUrlState } from "@/lib/foundation/foundation-url-state";
import {
  getDefaultFoundationViewTarget,
  type FoundationViewId,
} from "@/lib/foundation/foundation-view-routing";

export type FoundationNavigationTransition = (callback: () => void) => void;

let runFoundationNavigationTransition: FoundationNavigationTransition = (callback) => {
  callback();
};

let onFoundationNavigationStart: (() => void) | null = null;

export function bindFoundationNavigationTransition(transition: FoundationNavigationTransition) {
  runFoundationNavigationTransition = transition;
}

export function bindFoundationNavigationStart(handler: () => void) {
  onFoundationNavigationStart = handler;
}

export function setFoundationView(
  view: FoundationViewId,
  setActiveView: Dispatch<SetStateAction<FoundationViewId>>,
  options?: { push?: boolean },
) {
  // Default to pushing a history entry so the browser Back button walks the
  // game loop (Home → Einsatzliste → Arena → Ergebnis → …). Programmatic
  // redirects (legacy→v2 view normalization) opt out with `{ push: false }`.
  const pushHistory = options?.push !== false;
  const applyViewChange = () => {
    onFoundationNavigationStart?.();
    const targetView = getDefaultFoundationViewTarget(view);
    setActiveView(targetView);
    const team =
      typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("team") : null;
    syncFoundationUrlState(
      {
        view: targetView,
        tab: null,
        playerId: null,
        team,
        panel: null,
        facilityId: null,
        facilityAction: null,
      },
      { mode: pushHistory ? "push" : "replace" },
    );
  };
  runFoundationNavigationTransition(applyViewChange);
}
