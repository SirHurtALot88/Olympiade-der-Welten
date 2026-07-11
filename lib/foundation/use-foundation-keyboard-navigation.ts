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
