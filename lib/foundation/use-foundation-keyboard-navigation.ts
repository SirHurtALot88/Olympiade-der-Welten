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
const OPEN_OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[role="menu"]',
  '[role="listbox"]',
  "dialog[open]",
  "[data-nl-overlay-open]",
  ".nl-rankdrawer",
  ".nl-rankdrawer-backdrop",
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
