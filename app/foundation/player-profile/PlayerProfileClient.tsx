"use client";

import { useEffect } from "react";

import PlayerDetailDrawer from "@/app/foundation/PlayerDetailDrawer";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import {
  PLAYER_PROFILE_TAB_ANCHORS,
  type PlayerProfileTabId,
} from "@/lib/foundation/player-profile-service";

type PlayerProfileClientProps = {
  data: PlayerDetailDrawerData;
  activeTab: PlayerProfileTabId;
  onTabChange: (tab: PlayerProfileTabId) => void;
  onClose?: () => void;
  onOpenTraining?: () => void;
  onOpenContractOffer?: () => void;
};

export default function PlayerProfileClient({
  data,
  activeTab,
  onTabChange,
  onClose,
  onOpenTraining,
  onOpenContractOffer,
}: PlayerProfileClientProps) {
  useEffect(() => {
    const anchorId = PLAYER_PROFILE_TAB_ANCHORS[activeTab];
    if (!anchorId) {
      return;
    }
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab, data.playerId]);

  return (
    <PlayerDetailDrawer
      variant="page"
      data={data}
      onClose={() => {
        onClose?.();
      }}
      onOpenBuyPreview={
        onOpenContractOffer
          ? (player) => {
              onOpenContractOffer();
            }
          : undefined
      }
    />
  );
}
