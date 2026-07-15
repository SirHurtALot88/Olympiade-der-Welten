"use client";

import { useEffect, useRef, useState } from "react";

import PlayerDetailDrawer from "@/app/foundation/PlayerDetailDrawer";
import { NlSubTabs } from "@/components/foundation/new-look";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { LeagueLeaderCategoryId } from "@/lib/foundation/league-leaders-service";
import {
  PLAYER_PROFILE_TABS,
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
  // "Neuer Look" (#62, flag-gated): Profil-Untertabs als sticky NlSubTabs.
  // Ein Sentinel + IntersectionObserver blendet die Leiste erst ein, wenn
  // die Shell-Subnav aus dem Viewport gescrollt ist; ein zweiter Observer
  // hält den aktiven Tab beim Scrollen mit den Anker-Sektionen synchron.
  const [subTabsStuck, setSubTabsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const suppressScrollRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  const onTabChangeRef = useRef(onTabChange);
  activeTabRef.current = activeTab;
  onTabChangeRef.current = onTabChange;

  useEffect(() => {
    if (suppressScrollRef.current) {
      // Tab-Wechsel kam aus der Scroll-Beobachtung — nicht zurückscrollen.
      suppressScrollRef.current = false;
      return;
    }
    const anchorId = PLAYER_PROFILE_TAB_ANCHORS[activeTab];
    if (!anchorId) {
      return;
    }
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab, data.playerId]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setSubTabsStuck(false);
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setSubTabsStuck(entry ? !entry.isIntersecting : false);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [data.playerId]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }
    const tabByAnchorId = new Map<string, PlayerProfileTabId>(
      (Object.entries(PLAYER_PROFILE_TAB_ANCHORS) as Array<[PlayerProfileTabId, string]>).map(
        ([tab, anchorId]) => [anchorId, tab],
      ),
    );
    const elements = [...tabByAnchorId.keys()]
      .map((anchorId) => document.getElementById(anchorId))
      .filter((element): element is HTMLElement => element != null);
    if (elements.length === 0) {
      return;
    }

    const intersecting = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            intersecting.delete(entry.target.id);
          }
        }
        if (intersecting.size === 0) {
          return;
        }
        // Innerhalb des Lese-Bands gewinnt die unterste (zuletzt erreichte) Sektion.
        let nextAnchorId: string | null = null;
        let nextTop = Number.NEGATIVE_INFINITY;
        for (const [anchorId, top] of intersecting) {
          if (top > nextTop) {
            nextTop = top;
            nextAnchorId = anchorId;
          }
        }
        const nextTab = nextAnchorId ? tabByAnchorId.get(nextAnchorId) : undefined;
        if (nextTab && nextTab !== activeTabRef.current) {
          suppressScrollRef.current = true;
          onTabChangeRef.current(nextTab);
        }
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 },
    );
    for (const element of elements) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [data.playerId]);

  return (
    <>
      <div ref={sentinelRef} className="is-new-look nl-profile-subtabs-sentinel" aria-hidden="true" />
      <div
        className={`is-new-look nl-profile-subtabs${subTabsStuck ? " is-stuck" : ""}`}
        data-testid="player-profile-sticky-subtabs"
      >
        <NlSubTabs
          items={PLAYER_PROFILE_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
          activeId={activeTab}
          onSelect={(id) => onTabChange(id as PlayerProfileTabId)}
          aria-label="Profil-Unterbereiche"
        />
      </div>
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
    </>
  );
}
