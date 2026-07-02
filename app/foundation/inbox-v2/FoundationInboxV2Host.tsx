"use client";

import type { Dispatch, SetStateAction } from "react";

import InboxV2Client from "@/app/foundation/inbox-v2/InboxV2Client";
import type { InboxV2Mode } from "@/app/foundation/inbox-v2/inbox-v2-types";
import type { GameInboxItem, GameState, Team } from "@/lib/data/olyDataTypes";
import { applyInboxQuickAction } from "@/lib/foundation/inbox-quick-action-service";
import { useInboxV2Derivations } from "@/lib/foundation/tabs/use-inbox-v2-derivations";

export type FoundationInboxV2HostProps = {
  selectedTeam: Team | null;
  activeTeamInboxItems: GameInboxItem[];
  activeTeamDecisionInboxItems: GameInboxItem[];
  activeTeamDecisionCriticalInboxItems: GameInboxItem[];
  activeTeamChronicleInboxItems: GameInboxItem[];
  inboxMode: InboxV2Mode;
  inboxCategoryFilter: string;
  inboxIncludeDone: boolean;
  inboxIncludeDismissed: boolean;
  inboxV2SelectedItemId: string | null;
  setInboxV2SelectedItemId: Dispatch<SetStateAction<string | null>>;
  setInboxIncludeDone: Dispatch<SetStateAction<boolean>>;
  setInboxIncludeDismissed: Dispatch<SetStateAction<boolean>>;
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  readMeta: { source: string; readOnly: boolean };
  activeSaveId: string;
  persistLocalGameStateImmediately: (gameState: GameState) => Promise<void>;
  navigateToInboxItem: (item: GameInboxItem) => void;
  updateInboxItemStatus: (item: GameInboxItem, status: GameInboxItem["status"]) => void;
};

/**
 * Inbox V2 host (Strangler Phase 5.3). Mounts inbox-only derivations and panel
 * wiring only while the Inbox V2 tab is active.
 */
export default function FoundationInboxV2Host({
  selectedTeam,
  activeTeamInboxItems,
  activeTeamDecisionInboxItems,
  activeTeamDecisionCriticalInboxItems,
  activeTeamChronicleInboxItems,
  inboxMode,
  inboxCategoryFilter,
  inboxIncludeDone,
  inboxIncludeDismissed,
  inboxV2SelectedItemId,
  setInboxV2SelectedItemId,
  setInboxIncludeDone,
  setInboxIncludeDismissed,
  gameState,
  setGameState,
  readMeta,
  activeSaveId,
  persistLocalGameStateImmediately,
  navigateToInboxItem,
  updateInboxItemStatus,
}: FoundationInboxV2HostProps) {
  const { visibleInboxItems, inboxV2Items } = useInboxV2Derivations({
    activeTeamInboxItems,
    inboxMode,
    inboxCategoryFilter,
    inboxIncludeDone,
    inboxIncludeDismissed,
  });

  if (!selectedTeam) {
    return null;
  }

  return (
    <section className="panel foundation-inbox-v2-panel">
      <InboxV2Client
        items={inboxV2Items}
        selectedItemId={inboxV2SelectedItemId ?? inboxV2Items[0]?.id ?? null}
        onSelectItem={setInboxV2SelectedItemId}
        openCount={inboxMode === "decisions" ? activeTeamDecisionInboxItems.length : activeTeamChronicleInboxItems.length}
        criticalCount={inboxMode === "decisions" ? activeTeamDecisionCriticalInboxItems.length : 0}
        mode={inboxMode}
        teamLabel={`${selectedTeam.shortCode} · ${selectedTeam.name}`}
        categoryFilter={inboxCategoryFilter}
        hideCategoryFilters
        includeDone={inboxIncludeDone}
        onIncludeDoneChange={setInboxIncludeDone}
        includeDismissed={inboxIncludeDismissed}
        onIncludeDismissedChange={setInboxIncludeDismissed}
        onRunChoice={(itemId, choiceId) => {
          const sourceItem = visibleInboxItems.find((item) => item.itemId === itemId);
          if (!sourceItem) {
            return;
          }
          if (choiceId === "dismiss-later") {
            updateInboxItemStatus(sourceItem, "dismissed");
            return;
          }
          if (choiceId === "apply-training-light") {
            const result = applyInboxQuickAction(gameState, sourceItem, choiceId);
            if (result.applied) {
              setGameState(result.gameState);
              if (readMeta.source !== "prisma" && !readMeta.readOnly && activeSaveId !== "loading-save") {
                void persistLocalGameStateImmediately(result.gameState).catch((error) => {
                  console.error(error);
                });
              }
            }
            return;
          }
          if (choiceId === "open-lineup" || choiceId === "open-target") {
            navigateToInboxItem(sourceItem);
          }
        }}
        onMarkDone={(itemId) => {
          const sourceItem = visibleInboxItems.find((item) => item.itemId === itemId);
          if (sourceItem) {
            updateInboxItemStatus(sourceItem, "done");
          }
        }}
        onDismiss={(itemId) => {
          const sourceItem = visibleInboxItems.find((item) => item.itemId === itemId);
          if (sourceItem) {
            updateInboxItemStatus(sourceItem, "dismissed");
          }
        }}
      />
    </section>
  );
}
