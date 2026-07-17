"use client";

import type * as React from "react";

import FoundationRanksNewLook from "@/app/foundation/ranks-v2/FoundationRanksNewLook";
import type { SortState } from "@/lib/foundation/tabs/cockpit-types";
import type { Team } from "@/lib/data/olyDataTypes";

export interface FoundationRanksPanelProps {
  sortedPpAreaRows: Array<{
    rank: number;
    team: Team;
    pps: { total: number; pow: number; spe: number; men: number; soc: number };
    formBonus: { total: number; pow: number; spe: number; men: number; soc: number };
  }>;
  ppAreaRankClassMaps: {
    total: Map<string, string>;
    pow: Map<string, string>;
    spe: Map<string, string>;
    men: Map<string, string>;
    soc: Map<string, string>;
  };
  ppAreaMetricPools: {
    total: Array<number | null | undefined>;
    pow: Array<number | null | undefined>;
    spe: Array<number | null | undefined>;
    men: Array<number | null | undefined>;
    soc: Array<number | null | undefined>;
  };
  tableSorts: { ppArea: SortState };
  toggleTableSort: (tableId: string, columnKey: string) => void;
  openTeamProfileById: (teamId: string) => void;
  /**
   * Aktives/gesteuertes Manager-Team (für die "Dein Team"-Hervorhebung, T-035).
   * Vom Shell-Host durchgereicht, weil der FoundationState-Context im Shell
   * nicht mehr gemountet ist. Fehlt der Wert, greift nur der humanControlled-
   * Fallback.
   */
  ownTeamId?: string | null;
  renderPpAreaMetricCell: (
    value: number,
    formBonus: number,
    options: { tone: string; pool: Array<number | null | undefined>; fallbackMax: number },
  ) => React.ReactNode;
  SortableHeader: React.ComponentType<{
    label: string;
    tableId: string;
    columnKey: string;
    sortState?: SortState;
    onToggle: (tableId: string, columnKey: string) => void;
  }>;
}

export default function FoundationRanksPanel(props: FoundationRanksPanelProps) {
  return <FoundationRanksNewLook {...props} />;
}
