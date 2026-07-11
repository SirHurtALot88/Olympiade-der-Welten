"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import FoundationTeamPortraitCard, {
  type FoundationTeamPortraitCardProps,
} from "@/components/foundation/team-portrait-card/FoundationTeamPortraitCard";

export type FoundationTeamPortraitCardData = Omit<FoundationTeamPortraitCardProps, "interactive" | "onOpen" | "className" | "style">;

export type FoundationTeamPortraitPreviewProps = {
  children: ReactNode;
  disabled?: boolean;
  /**
   * Team card data is resolved lazily on first hover/focus instead of being computed
   * eagerly for every row — `buildTeamDetailDrawerData` is a documented performance
   * hotspot (see docs/tab-performance-hotspots-v9-comparison.md) and is too expensive
   * to call unconditionally for every row of a 160-row table.
   */
  resolveCardData: () => FoundationTeamPortraitCardData | null;
};

export default function FoundationTeamPortraitPreview({
  children,
  disabled = false,
  resolveCardData,
}: FoundationTeamPortraitPreviewProps) {
  const previewId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [cardData, setCardData] = useState<FoundationTeamPortraitCardData | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = 240;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - panelWidth - 12);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 320);
    setPosition({ top, left });
  }, []);

  const show = useCallback(() => {
    if (disabled) return;
    const resolved = cardData ?? resolveCardData();
    if (!resolved) return;
    if (!cardData) {
      setCardData(resolved);
    }
    updatePosition();
    setOpen(true);
  }, [cardData, disabled, resolveCardData, updatePosition]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onScroll = () => updatePosition();
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
  }, [hide, open, previewId, updatePosition]);

  const previewPanel =
    open && position && cardData && typeof document !== "undefined"
      ? createPortal(
          <div
            className="foundation-team-portrait-preview-panel"
            role="tooltip"
            id={previewId}
            style={{ top: position.top, left: position.left }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <FoundationTeamPortraitCard {...cardData} interactive={false} />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        className="foundation-team-portrait-preview-anchor"
        aria-describedby={open ? previewId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          if (window.matchMedia("(hover: none)").matches) {
            event.stopPropagation();
            setOpen((current) => {
              if (!current) {
                if (!cardData) {
                  const resolved = resolveCardData();
                  if (!resolved) return current;
                  setCardData(resolved);
                }
                updatePosition();
              }
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
