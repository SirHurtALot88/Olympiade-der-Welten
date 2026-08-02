"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import FoundationPlayerPortraitCard, {
  type FoundationPlayerPortraitCardProps,
} from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { useRafThrottledCallback } from "@/lib/foundation/use-raf-throttled-scroll";

export type FoundationPlayerPortraitPreviewProps = Omit<
  FoundationPlayerPortraitCardProps,
  "interactive" | "density" | "onOpen"
> & {
  children: ReactNode;
  previewDensity?: "compact" | "full";
  disabled?: boolean;
};

export default function FoundationPlayerPortraitPreview({
  children,
  previewDensity = "compact",
  disabled = false,
  ...cardProps
}: FoundationPlayerPortraitPreviewProps) {
  const previewId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = previewDensity === "full" ? 240 : 200;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - panelWidth - 12);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 320);
    setPosition({ top, left });
  }, [previewDensity]);

  const show = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
  }, [disabled, updatePosition]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  // Scroll/Resize passieren waehrend die Preview offen ist deutlich haeufiger
  // als einmal pro Frame (v.a. Trackpad-Scroll) — rAF-throttlen statt bei
  // jedem Event zu repositionieren. Der initiale `updatePosition()`-Aufruf in
  // `show()` bleibt unthrottled, damit der erste Frame sofort korrekt sitzt.
  const onScroll = useRafThrottledCallback(updatePosition);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onPointerDown = (event: PointerEvent) => {
      const anchor = anchorRef.current;
      const panel = document.getElementById(previewId);
      if (!anchor || anchor.contains(event.target as Node)) {
        return;
      }
      if (panel?.contains(event.target as Node)) {
        return;
      }
      hide();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [hide, onScroll, open, previewId]);

  const previewPanel =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            className="foundation-player-portrait-preview-panel"
            role="tooltip"
            id={previewId}
            style={{ top: position.top, left: position.left }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <FoundationPlayerPortraitCard
              {...cardProps}
              density={previewDensity}
              context={cardProps.context ?? "tablePreview"}
              interactive={false}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        className="foundation-player-portrait-preview-anchor"
        aria-describedby={open ? previewId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          if (window.matchMedia("(hover: none)").matches) {
            event.stopPropagation();
            setOpen((current) => {
              if (!current) updatePosition();
              return !current;
            });
          }
        }}
      >
        {children}
      </span>
      {previewPanel}
    </>
  );
}
