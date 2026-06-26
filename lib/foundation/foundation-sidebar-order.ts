import {
  FOUNDATION_NAV_GROUPS,
  type FoundationNavGroup,
} from "@/lib/foundation/foundation-nav-config";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { reorderGlobalTableColumns } from "@/lib/ui/global-table-layout";

export const FOUNDATION_SIDEBAR_ORDER_STORAGE_KEY = "foundation-sidebar-order-v1";

export type FoundationSidebarOrderState = Partial<Record<FoundationNavGroup["id"], FoundationViewId[]>>;

export function reorderFoundationSidebarItems(
  currentOrder: FoundationViewId[],
  sourceId: FoundationViewId,
  targetId: FoundationViewId,
): FoundationViewId[] {
  return reorderGlobalTableColumns(currentOrder, sourceId, targetId) as FoundationViewId[];
}

export function applyFoundationSidebarOrder(
  groups: FoundationNavGroup[],
  order: FoundationSidebarOrderState | null,
): FoundationNavGroup[] {
  if (!order) {
    return groups;
  }

  return groups.map((group) => {
    const savedOrder = order[group.id];
    if (!savedOrder?.length) {
      return group;
    }

    const itemById = new Map(group.items.map((item) => [item.id, item]));
    const orderedItems = savedOrder
      .map((id) => itemById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const seen = new Set(orderedItems.map((item) => item.id));
    for (const item of group.items) {
      if (!seen.has(item.id)) {
        orderedItems.push(item);
      }
    }

    return {
      ...group,
      items: orderedItems,
    };
  });
}

export function getDefaultFoundationSidebarOrder(): FoundationSidebarOrderState {
  const order: FoundationSidebarOrderState = {};
  for (const group of FOUNDATION_NAV_GROUPS) {
    order[group.id] = group.items.map((item) => item.id);
  }
  return order;
}

export function loadFoundationSidebarOrder(): FoundationSidebarOrderState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(FOUNDATION_SIDEBAR_ORDER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as FoundationSidebarOrderState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFoundationSidebarOrder(order: FoundationSidebarOrderState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FOUNDATION_SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(order));
}
