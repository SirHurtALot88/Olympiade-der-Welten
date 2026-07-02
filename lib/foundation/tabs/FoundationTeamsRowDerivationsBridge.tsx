"use client";

import { useLayoutEffect } from "react";

import {
  EMPTY_TEAM_HISTORY_COLUMNS,
  EMPTY_TEAM_HISTORY_POINT_RANK_MAPS,
  EMPTY_TEAMS_VIEW_ROWS,
} from "@/lib/foundation/tabs/teams-view-derivations";
import {
  useTeamsViewRowDerivations,
  type UseTeamsViewRowDerivationsInput,
  type UseTeamsViewRowDerivationsResult,
} from "@/lib/foundation/tabs/use-teams-view-derivations";

export const EMPTY_TEAMS_VIEW_ROW_DERIVATIONS: UseTeamsViewRowDerivationsResult = {
  teamsViewRows: EMPTY_TEAMS_VIEW_ROWS,
  sortedTeamsViewRows: EMPTY_TEAMS_VIEW_ROWS,
  teamHistorySeasonPointColumns: EMPTY_TEAM_HISTORY_COLUMNS,
  teamHistoryPointRankMaps: EMPTY_TEAM_HISTORY_POINT_RANK_MAPS,
  teamsViewSummary: null,
  selectedHqAxisSummary: null,
};

export function FoundationTeamsRowDerivationsBridge(props: {
  input: UseTeamsViewRowDerivationsInput;
  onChange: (result: UseTeamsViewRowDerivationsResult) => void;
}) {
  const result = useTeamsViewRowDerivations(props.input);

  useLayoutEffect(() => {
    props.onChange(result);
  }, [props.onChange, result]);

  return null;
}
