"use client";

import { useEffect } from "react";

type FoundationKeyboardNavigationOptions = {
  enabled?: boolean;
  onBack: () => void;
  canBack?: () => boolean;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

// A modal, drawer, popover or menu currently mounted in the DOM. When one is
// open, Escape/Backspace must dismiss *that* overlay (its own handler) instead
// of navigating the shell back to the previous tab — otherwise the user gets
// yanked to Home while a dialog is still open (a keyboard trap).
// `:not([hidden])` is essential: several KPI hover panels are permanently
// mounted with `hidden={!open}` (Teams/Team-Profil headers) — without the guard
// they would count as "open" the whole time that view is shown and dead-lock
// Escape/Backspace back-navigation on those views.
const OPEN_OVERLAY_SELECTOR = [
  '[role="dialog"]:not([hidden])',
  '[aria-modal="true"]:not([hidden])',
  '[role="menu"]:not([hidden])',
  '[role="listbox"]:not([hidden])',
  "dialog[open]",
  "[data-nl-overlay-open]:not([hidden])",
  ".nl-rankdrawer:not([hidden])",
  ".nl-rankdrawer-backdrop:not([hidden])",
].join(",");

function hasOpenDismissibleOverlay() {
  if (typeof document === "undefined") return false;
  return document.querySelector(OPEN_OVERLAY_SELECTOR) != null;
}

export function useFoundationKeyboardNavigation({
  enabled = true,
  onBack,
  canBack,
}: FoundationKeyboardNavigationOptions) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape" || event.key === "Backspace") {
        // Let an open dialog/drawer/menu handle the key itself — don't hijack
        // it into a back-navigation and strand the overlay open.
        if (hasOpenDismissibleOverlay()) return;
        if (canBack && !canBack()) return;
        event.preventDefault();
        onBack();
        return;
      }

      if (event.key === "BrowserBack") {
        onBack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canBack, enabled, onBack]);
}
