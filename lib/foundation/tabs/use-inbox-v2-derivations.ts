import { useMemo } from "react";

import type { GameInboxItem } from "@/lib/data/olyDataTypes";
import { filterGameInboxItems, filterInboxItemsByMode, groupInboxItemsForDisplay } from "@/lib/foundation/game-inbox-service";
import { mapInboxQuickActionsToChoices } from "@/lib/foundation/inbox-quick-action-service";
import type { InboxV2Item, InboxV2Mode } from "@/app/foundation/inbox-v2/inbox-v2-types";

export interface UseInboxV2DerivationsInput {
  activeTeamInboxItems: GameInboxItem[];
  inboxMode: InboxV2Mode;
  inboxCategoryFilter: string;
  inboxIncludeDone: boolean;
  inboxIncludeDismissed: boolean;
}

/**
 * Inbox V2 derivations (Strangler Phase 5.3). Runs only while
 * `FoundationInboxV2Host` is mounted (`activeView === "inboxV2"`).
 */
export function useInboxV2Derivations(input: UseInboxV2DerivationsInput) {
  const {
    activeTeamInboxItems,
    inboxMode,
    inboxCategoryFilter,
    inboxIncludeDone,
    inboxIncludeDismissed,
  } = input;

  const visibleInboxItems = useMemo(() => {
    const modeItems = filterInboxItemsByMode(activeTeamInboxItems, inboxMode);
    let filtered = filterGameInboxItems(modeItems, {
      category: inboxCategoryFilter,
      includeDone: inboxIncludeDone,
      includeDismissed: inboxIncludeDismissed,
    });
    if (inboxCategoryFilter === "transfer") {
      filtered = filtered.filter((item) =>
        inboxMode === "chronicle" ? item.source === "transfer_history" : item.source !== "transfer_history",
      );
    }
    return groupInboxItemsForDisplay(filtered);
  }, [activeTeamInboxItems, inboxCategoryFilter, inboxIncludeDismissed, inboxIncludeDone, inboxMode]);

  const inboxV2Items = useMemo(
    () =>
      visibleInboxItems.map(
        (item): InboxV2Item => ({
          id: item.itemId,
          category: item.category.toUpperCase(),
          title: item.title,
          detail: item.description,
          severity: item.severity,
          status: item.status,
          choices: mapInboxQuickActionsToChoices(item),
        }),
      ),
    [visibleInboxItems],
  );

  return {
    visibleInboxItems,
    inboxV2Items,
  };
}
