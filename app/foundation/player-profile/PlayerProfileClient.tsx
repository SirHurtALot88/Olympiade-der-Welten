"use client";

import { useEffect } from "react";

import PlayerDetailDrawer from "@/app/foundation/PlayerDetailDrawer";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import {
  PLAYER_PROFILE_TAB_ANCHORS,
  type PlayerProfileTabId,
} from "@/lib/foundation/player-profile-service";
import type {
  TrainingClassOption,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

type PlayerProfileClientProps = {
  data: PlayerDetailDrawerData;
  activeTab: PlayerProfileTabId;
  onTabChange: (tab: PlayerProfileTabId) => void;
  onClose?: () => void;
  onOpenTraining?: () => void;
  onOpenContractOffer?: () => void;
  onOpenLeagueLeaders?: (
    categoryId: LeagueLeaderCategoryId,
    returnContext?: { playerId: string; playerName: string },
  ) => void;
  onOpenTeam?: (teamId: string) => void;
  trainingRow?: TrainingPlayerRowView | null;
  trainingModeOptions?: TrainingModeOption[];
  trainingClassOptions?: TrainingClassOption[];
  onSetTrainingMode?: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass?: (playerId: string, trainingClass: string) => void;
  trainingReadOnly?: boolean;
};

export default function PlayerProfileClient({
  data,
  activeTab,
  onTabChange,
  onClose,
  onOpenTraining,
  onOpenContractOffer,
  onOpenLeagueLeaders,
  onOpenTeam,
  trainingRow = null,
  trainingModeOptions = [],
  trainingClassOptions = [],
  onSetTrainingMode,
  onSetTrainingClass,
  trainingReadOnly = false,
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
      onOpenTraining={onOpenTraining}
      onOpenLeagueLeaders={onOpenLeagueLeaders}
      onOpenTeam={onOpenTeam}
      trainingRow={trainingRow}
      trainingModeOptions={trainingModeOptions}
      trainingClassOptions={trainingClassOptions}
      onSetTrainingMode={onSetTrainingMode}
      onSetTrainingClass={onSetTrainingClass}
      trainingReadOnly={trainingReadOnly}
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
