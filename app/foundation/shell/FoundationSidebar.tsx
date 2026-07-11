"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
import NewLookToggle from "@/components/foundation/werdegang/NewLookToggle";
import { useNewLook } from "@/lib/ui/new-look-preference";

type FoundationSidebarProps = {
  activeView: FoundationViewId;
  onNavigate: (view: FoundationViewId) => void;
  onPrefetchView?: (view: FoundationViewId) => void;
  attentionByViewId?: FoundationNavAttentionMap;
  seasonContextLabel?: string | null;
};

type SidebarDragState = {
  groupId: keyof FoundationSidebarOrderState;
  itemId: FoundationViewId;
} | null;

export default function FoundationSidebar({
  activeView,
  onNavigate,
  onPrefetchView,
  attentionByViewId,
  seasonContextLabel,
}: FoundationSidebarProps) {
  const [newLookEnabled] = useNewLook();
  const [navGroups, setNavGroups] = useState(FOUNDATION_NAV_GROUPS);
  const [draggingItem, setDraggingItem] = useState<SidebarDragState>(null);
  const dragState = useRef<SidebarDragState>(null);

  // "S1 · MD 1" → ["S1", "MD 1"]; Trennzeichen stammt aus buildSeasonContextLabel.
  const contextParts = seasonContextLabel ? seasonContextLabel.split(" · ") : [];
  const seasonPart = contextParts[0] ?? null;
  const matchdayPart = contextParts[1] ?? null;
  const canSplitContext = Boolean(newLookEnabled && seasonPart && matchdayPart);

  useEffect(() => {
    const savedOrder = loadFoundationSidebarOrder();
    setNavGroups(applyFoundationSidebarOrder(FOUNDATION_NAV_GROUPS, savedOrder));
  }, []);

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
    <aside className="foundation-sidebar" data-testid="foundation-sidebar" aria-label="Foundation Navigation">
      <a className="foundation-skip-link" href="#foundation-main-content">
        Zum Hauptinhalt springen
      </a>
      <div className="foundation-sidebar-brand">
        <Link className="foundation-sidebar-save-link" href="/">
          Spielstände
        </Link>
        <strong>Oly Manager</strong>
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
      <div className="foundation-sidebar-newlook">
        <NewLookToggle className="is-sidebar" />
      </div>
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
                  {item.icon ? <span className="foundation-sidebar-icon" aria-hidden="true">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </aside>
  );
}
