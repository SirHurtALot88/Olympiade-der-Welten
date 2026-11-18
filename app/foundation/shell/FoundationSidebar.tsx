"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { FoundationRailIcon } from "@/app/foundation/shell/foundation-nav-icons";

import { getAppVersionBadge } from "@/lib/app-version";
import { FOUNDATION_NAV_GROUPS, isFoundationNavViewActive } from "@/lib/foundation/foundation-nav-config";
import type { FoundationNavAttentionMap } from "@/lib/foundation/foundation-nav-attention";
import {
  applyFoundationSidebarOrder,
  loadFoundationSidebarOrder,
  reorderFoundationSidebarItems,
  saveFoundationSidebarOrder,
  type FoundationSidebarOrderState,
} from "@/lib/foundation/foundation-sidebar-order";
import { getDefaultFoundationViewTarget, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";

// Monochrome line-icons (currentColor) für Views, bei denen ein bildhaftes Icon
// klarer ist als ein Unicode-Glyph. Fällt auf item.icon (Glyph) zurück, wenn
// keine SVG hinterlegt ist. viewBox 0 0 16 16, damit sie zum 14px-Slot passen.
const NAV_VIEW_ICON_SVGS: Partial<Record<FoundationViewId, ReactNode>> = {
  // Hantel — Training
  trainingCompact: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" focusable="false" aria-hidden="true">
      <line x1="5.2" y1="8" x2="10.8" y2="8" />
      <line x1="3.4" y1="5.4" x2="3.4" y2="10.6" />
      <line x1="1.7" y1="6.4" x2="1.7" y2="9.6" />
      <line x1="12.6" y1="5.4" x2="12.6" y2="10.6" />
      <line x1="14.3" y1="6.4" x2="14.3" y2="9.6" />
    </svg>
  ),
  // Stadion — Arena
  matchdayArena: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" focusable="false" aria-hidden="true">
      <ellipse cx="8" cy="8" rx="6.6" ry="4.3" />
      <rect x="5" y="6.1" width="6" height="3.8" rx="1.3" />
    </svg>
  ),
  // Tabelle — Saisonstand
  seasonV2: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" focusable="false" aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
      <line x1="2.5" y1="6.3" x2="13.5" y2="6.3" />
      <line x1="2.5" y1="9.7" x2="13.5" y2="9.7" />
      <line x1="8" y1="6.3" x2="8" y2="13" />
    </svg>
  ),
};

type FoundationSidebarProps = {
  activeView: FoundationViewId;
  onNavigate: (view: FoundationViewId) => void;
  onPrefetchView?: (view: FoundationViewId) => void;
  attentionByViewId?: FoundationNavAttentionMap;
  seasonContextLabel?: string | null;
  // Kompakter "Aktives Team"-Picker, direkt unter dem Neuer-Look-Toggle.
  // Wiring (value/onChange/Optionsliste) kommt unverändert aus der Router-Body.
  teamPicker?: ReactNode;
  /** Wappen und Name des aktiven Teams: Kopf der Schiene (18.11., App-Rahmen modern). */
  teamCrest?: ReactNode;
  teamName?: string | null;
  /** Office: Punkt unten in der Schiene. */
  onOpenOffice?: () => void;
  /**
   * Icon-Schiene: ohne diese Prop bleibt die breite Seitenleiste. Mit ihr ist die Leiste kompakt
   * (nur Symbole), fährt bei Hover/Tastaturfokus aus und hält sich bei `pinned` dauerhaft offen.
   */
  rail?: { pinned: boolean; onPinnedChange: (pinned: boolean) => void };
};

// Kurze Absicht, bevor die Schiene ausfährt: ein Streifen über die Leiste soll sie nicht aufblitzen
// lassen (Mockup: ruhige Leiste, Beschriftung nur auf Wunsch).
const RAIL_HOVER_DELAY_MS = 140;

type SidebarDragState = {
  groupId: keyof FoundationSidebarOrderState;
  itemId: FoundationViewId;
} | null;

// Statisch pro Build (hängt nur von Version + zur Build-Zeit inlined
// NEXT_PUBLIC_OLY_BUILD_*-Env-Vars ab) — einmal pro Modul-Load berechnen,
// nicht bei jedem Render.
const APP_VERSION_BADGE = getAppVersionBadge();

export default function FoundationSidebar({
  activeView,
  onNavigate,
  onPrefetchView,
  attentionByViewId,
  seasonContextLabel,
  teamPicker,
  teamCrest,
  teamName,
  onOpenOffice,
  rail,
}: FoundationSidebarProps) {
  // Gleitende Marke: EINE Goldmarke fährt zum aktiven Punkt, statt an jedem Punkt neu zu erscheinen.
  const asideRef = useRef<HTMLElement | null>(null);
  const [marke, setMarke] = useState<{ top: number; height: number } | null>(null);
  const [railHover, setRailHover] = useState(false);
  const railTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRailTimer = () => {
    if (railTimer.current) {
      clearTimeout(railTimer.current);
      railTimer.current = null;
    }
  };
  useEffect(() => clearRailTimer, []);
  const railMode = rail ? (rail.pinned ? "pinned" : railHover ? "open" : "compact") : undefined;
  const [navGroups, setNavGroups] = useState(FOUNDATION_NAV_GROUPS);
  const [draggingItem, setDraggingItem] = useState<SidebarDragState>(null);
  const dragState = useRef<SidebarDragState>(null);

  // "S1 · MD 1" → ["S1", "MD 1"]; Trennzeichen stammt aus buildSeasonContextLabel.
  const contextParts = seasonContextLabel ? seasonContextLabel.split(" · ") : [];
  const seasonPart = contextParts[0] ?? null;
  const matchdayPart = contextParts[1] ?? null;
  const canSplitContext = Boolean(seasonPart && matchdayPart);

  useEffect(() => {
    const savedOrder = loadFoundationSidebarOrder();
    setNavGroups(applyFoundationSidebarOrder(FOUNDATION_NAV_GROUPS, savedOrder));
  }, []);

  useLayoutEffect(() => {
    if (!rail) return undefined;
    const messen = () => {
      const aside = asideRef.current;
      const aktiv = aside?.querySelector<HTMLElement>(".foundation-sidebar-item.is-active");
      if (!aside || !aktiv) {
        setMarke(null);
        return;
      }
      const a = aside.getBoundingClientRect();
      const b = aktiv.getBoundingClientRect();
      const top = Math.round(b.top - a.top + aside.scrollTop + b.height * 0.2);
      const height = Math.round(b.height * 0.6);
      setMarke((alt) => (alt && alt.top === top && alt.height === height ? alt : { top, height }));
    };
    messen();
    const timer = setTimeout(messen, 220);
    return () => clearTimeout(timer);
  }, [activeView, railMode, navGroups, rail]);

  const persistGroupOrder = (groupId: keyof FoundationSidebarOrderState, itemIds: FoundationViewId[]) => {
    const savedOrder = loadFoundationSidebarOrder() ?? {};
    saveFoundationSidebarOrder({
      ...savedOrder,
      [groupId]: itemIds,
    });
  };

  const reorderGroupItems = (
    groupId: keyof FoundationSidebarOrderState,
    sourceId: FoundationViewId,
    targetId: FoundationViewId,
  ) => {
    if (sourceId === targetId) {
      return;
    }

    setNavGroups((currentGroups) =>
      currentGroups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        const currentOrder = group.items.map((item) => item.id);
        const nextOrder = reorderFoundationSidebarItems(currentOrder, sourceId, targetId);
        if (nextOrder.every((id, index) => id === currentOrder[index])) {
          return group;
        }

        const itemById = new Map(group.items.map((item) => [item.id, item]));
        const nextItems = nextOrder
          .map((id) => itemById.get(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        persistGroupOrder(groupId, nextOrder);
        return {
          ...group,
          items: nextItems,
        };
      }),
    );
  };

  const getItemDragProps = (groupId: keyof FoundationSidebarOrderState, itemId: FoundationViewId) => ({
    onDragOver: (event: React.DragEvent<HTMLButtonElement>) => {
      const drag = dragState.current;
      if (!drag || drag.groupId !== groupId || drag.itemId === itemId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    onDrop: (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const drag = dragState.current;
      dragState.current = null;
      setDraggingItem(null);
      if (!drag || drag.groupId !== groupId) {
        return;
      }
      reorderGroupItems(groupId, drag.itemId, itemId);
    },
  });

  const getHandleDragProps = (groupId: keyof FoundationSidebarOrderState, itemId: FoundationViewId) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent<HTMLSpanElement>) => {
      dragState.current = { groupId, itemId };
      setDraggingItem({ groupId, itemId });
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", itemId);
    },
    onDragEnd: () => {
      dragState.current = null;
      setDraggingItem(null);
    },
    onMouseDown: (event: React.MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
    },
    onClick: (event: React.MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
    },
  });

  return (
    <aside
      ref={asideRef}
      className="foundation-sidebar"
      data-testid="foundation-sidebar"
      data-rail={railMode}
      aria-label="Foundation Navigation"
      onMouseEnter={
        rail
          ? () => {
              clearRailTimer();
              railTimer.current = setTimeout(() => setRailHover(true), RAIL_HOVER_DELAY_MS);
            }
          : undefined
      }
      onMouseLeave={
        rail
          ? () => {
              clearRailTimer();
              setRailHover(false);
            }
          : undefined
      }
      onFocus={
        rail
          ? (event) => {
              // Nur Tastaturfokus klappt aus; ein Mausklick soll die Leiste nicht aufgeklappt festhalten.
              if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
                clearRailTimer();
                setRailHover(true);
              }
            }
          : undefined
      }
      onBlur={
        rail
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setRailHover(false);
              }
            }
          : undefined
      }
    >
      <a className="foundation-skip-link" href="#foundation-main-content">
        Zum Hauptinhalt springen
      </a>
      {rail ? (
        <div className="foundation-rail-head">
          {teamCrest ? (
            <span className="foundation-rail-wappen" data-testid="foundation-rail-wappen" title={teamName ?? undefined}>
              {teamCrest}
              {teamName ? <strong className="foundation-rail-wappen-name">{teamName}</strong> : null}
            </span>
          ) : null}
          <button
            type="button"
            className="foundation-rail-pin"
            data-testid="foundation-rail-pin"
            aria-pressed={rail.pinned}
            aria-label="Beschriftung immer zeigen"
            title={rail.pinned ? "Beschriftung wieder einklappen" : "Beschriftung immer zeigen"}
            onClick={() => rail.onPinnedChange(!rail.pinned)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7" />
            </svg>
            <span className="foundation-rail-pin-text">{rail.pinned ? "Angeheftet" : "Anheften"}</span>
          </button>
        </div>
      ) : null}
      <div className="foundation-sidebar-brand">
        <Link className="foundation-sidebar-save-link" href="/">
          Spielstände
        </Link>
        <div className="foundation-sidebar-brand-row">
          <strong>Oly Manager</strong>
          <span
            className="foundation-sidebar-version-badge"
            data-testid="foundation-sidebar-version-badge"
            title={APP_VERSION_BADGE.title}
          >
            {APP_VERSION_BADGE.compact}
          </span>
        </div>
        {seasonContextLabel ? (
          canSplitContext ? (
            <div
              className="foundation-sidebar-context-portal"
              data-testid="foundation-season-context"
              role="group"
              aria-label={`${seasonContextLabel} — aktuelle Saison und Spieltag`}
            >
              <button
                type="button"
                className="foundation-sidebar-context-chip"
                title={`${seasonPart} — zum Saisonstand`}
                onClick={() => onNavigate("seasonV2")}
              >
                {seasonPart}
              </button>
              <span className="foundation-sidebar-context-sep" aria-hidden="true">·</span>
              <button
                type="button"
                className="foundation-sidebar-context-chip"
                title={`${matchdayPart} — zur Arena`}
                onClick={() => onNavigate("matchdayArena")}
              >
                {matchdayPart}
              </button>
            </div>
          ) : (
            <span
              className="foundation-sidebar-season-context"
              data-testid="foundation-season-context"
              title={`${seasonContextLabel} — aktuelle Saison und Spieltag`}
            >
              {seasonContextLabel}
            </span>
          )
        ) : null}
      </div>
      {teamPicker ? <div className="foundation-sidebar-team-picker">{teamPicker}</div> : null}
      {navGroups.map((group) => (
        <section key={group.id} className="foundation-sidebar-group">
          <span className="foundation-sidebar-group-label">{group.label}</span>
          <div className="foundation-sidebar-items">
            {group.items.map((item) => {
              const targetView = getDefaultFoundationViewTarget(item.id);
              const isActive = isFoundationNavViewActive(activeView, item.id);
              const needsAttention = Boolean(attentionByViewId?.[item.id]);
              const isDragging = draggingItem?.groupId === group.id && draggingItem.itemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`foundation-sidebar-item${isActive ? " is-active" : ""}${needsAttention ? " is-attention" : ""}${isDragging ? " is-dragging" : ""}`}
                  data-testid={`foundation-nav-${item.id}`}
                  title={item.tooltip}
                  aria-label={rail ? `${item.label}${item.badge ? ` (${item.badge})` : ""}${needsAttention ? " — braucht Aufmerksamkeit" : ""}` : undefined}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onNavigate(targetView)}
                  onMouseEnter={() => onPrefetchView?.(item.id)}
                  onFocus={() => onPrefetchView?.(item.id)}
                  {...getItemDragProps(group.id, item.id)}
                >
                  <span
                    className="foundation-sidebar-drag-handle"
                    aria-hidden="true"
                    title="Reihenfolge ändern"
                    {...getHandleDragProps(group.id, item.id)}
                  >
                    <svg viewBox="0 0 12 12" width="12" height="12" focusable="false" aria-hidden="true">
                      <circle cx="3" cy="2" r="1" />
                      <circle cx="9" cy="2" r="1" />
                      <circle cx="3" cy="6" r="1" />
                      <circle cx="9" cy="6" r="1" />
                      <circle cx="3" cy="10" r="1" />
                      <circle cx="9" cy="10" r="1" />
                    </svg>
                  </span>
                  {rail ? (
                    <span className="foundation-sidebar-icon foundation-sidebar-icon-svg foundation-rail-icon" aria-hidden="true">
                      <FoundationRailIcon viewId={item.id} fallback={item.icon} />
                    </span>
                  ) : NAV_VIEW_ICON_SVGS[item.id] ? (
                    <span className="foundation-sidebar-icon foundation-sidebar-icon-svg" aria-hidden="true">
                      {NAV_VIEW_ICON_SVGS[item.id]}
                    </span>
                  ) : item.icon ? (
                    <span className="foundation-sidebar-icon" aria-hidden="true">{item.icon}</span>
                  ) : null}
                  <span className="foundation-sidebar-item-label">{item.label}</span>
                  {rail && needsAttention ? (
                    <span className="foundation-rail-zahl" data-testid={`foundation-nav-attention-${item.id}`} aria-hidden="true">
                      !
                    </span>
                  ) : null}
                  {item.badge ? (
                    <span className="foundation-sidebar-item-badge" data-testid={`foundation-nav-badge-${item.id}`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {rail ? (
        <>
          <span
            className={`foundation-rail-marke${marke ? " is-da" : ""}`}
            style={marke ? { transform: `translateY(${marke.top}px)`, height: marke.height } : undefined}
            aria-hidden="true"
          />
          <div className="foundation-rail-unten">
            {onOpenOffice ? (
              <button
                type="button"
                className="foundation-sidebar-item foundation-rail-office"
                data-testid="foundation-rail-office"
                aria-label="Office öffnen"
                title="Office öffnen"
                onClick={onOpenOffice}
              >
                <span className="foundation-sidebar-icon foundation-sidebar-icon-svg foundation-rail-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
                    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
                  </svg>
                </span>
                <span className="foundation-sidebar-item-label">Office</span>
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </aside>
  );
}
