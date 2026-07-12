import { useMemo } from "react";

import type { Discipline, GameState } from "@/lib/data/olyDataTypes";
import {
  sortFoundationTableRows,
  type FoundationTableSortState,
} from "@/lib/foundation/foundation-table-sort";
import { getTeamRosterPlayerOvrSortKey } from "@/lib/foundation/team-roster-player-sort";

export type TeamRosterRoleFilter = "all" | "starter" | "rotation" | "prospect" | "bench" | "other";
export type TeamRosterFocusMode = "default" | "salary" | "value" | "contracts" | "training";

export type SelectedRosterTableRow = {
  entry: {
    roleTag?: string | null;
    contractLength: number;
    salary?: number | null;
  };
  player: {
    name: string;
    className: string;
    form: string | number;
    coreStats: { pow: number; spe: number; men: number; soc: number };
    disciplineRatings: Record<string, number>;
    currentXP?: number | null;
    fatigue?: number | null;
  };
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  saleBreakdown: {
    salePrice?: number | null;
    saleFactor?: number | null;
  };
  /** "Neuer Look" CA/PO-Sterne (Tier-3 Rosterkarten) — optional, nur von `NlTeamsRosterRow`-Konsumenten genutzt. */
  known?: boolean;
  caStars?: number | null;
  poStarRange?: { min: number; max: number } | null;
  caScore?: number | null;
  poScoreRange?: { min: number; max: number } | null;
};

function getTeamRosterRoleBucket(roleTag: string | null | undefined): Exclude<TeamRosterRoleFilter, "all"> {
  const normalized = (roleTag ?? "").toLowerCase();
  if (normalized.includes("starter") || normalized.includes("star") || normalized.includes("core")) {
    return "starter";
  }
  if (normalized.includes("rotation")) {
    return "rotation";
  }
  if (normalized.includes("prospect")) {
    return "prospect";
  }
  if (normalized.includes("bench") || normalized.includes("bank")) {
    return "bench";
  }
  return "other";
}

export type UseTeamsRosterTableDerivationsInput = {
  selectedRosterTableRows: SelectedRosterTableRow[];
  selectedRosterSort: FoundationTableSortState | undefined;
  disciplines: Discipline[];
  gameState: GameState;
  teamRosterFocusMode: TeamRosterFocusMode;
  teamRosterRoleFilter: TeamRosterRoleFilter;
  getRosterEntryDisplayMarketValue: (
    entry: SelectedRosterTableRow["entry"],
    player: SelectedRosterTableRow["player"],
  ) => number | null;
  getRosterEntryDisplaySalary: (
    entry: SelectedRosterTableRow["entry"],
    player: SelectedRosterTableRow["player"],
  ) => number | null;
  getRosterEntrySalarySortValue: (
    entry: SelectedRosterTableRow["entry"],
    player: SelectedRosterTableRow["player"],
  ) => number | null;
  getRosterEntrySalaryDelta: (
    entry: SelectedRosterTableRow["entry"],
    player: SelectedRosterTableRow["player"],
    gameState: GameState,
  ) => number | null;
};

export function useTeamsRosterTableDerivations(input: UseTeamsRosterTableDerivationsInput) {
  const sortedSelectedRosterTableRows = useMemo(
    () =>
      sortFoundationTableRows(input.selectedRosterTableRows, input.selectedRosterSort, {
        name: (row) => row.player.name,
        class: (row) => row.player.className,
        fit: (row) => row.player.form,
        mw: (row) =>
          input.getRosterEntryDisplayMarketValue(row.entry, row.player) ?? Number.NEGATIVE_INFINITY,
        salePrice: (row) => row.saleBreakdown.salePrice ?? Number.NEGATIVE_INFINITY,
        saleFactor: (row) => row.saleBreakdown.saleFactor ?? Number.NEGATIVE_INFINITY,
        salary: (row) => input.getRosterEntrySalarySortValue(row.entry, row.player) ?? Number.NEGATIVE_INFINITY,
        value: (row) => {
          const salary = input.getRosterEntryDisplaySalary(row.entry, row.player);
          return row.playerPps != null && salary != null && salary > 0
            ? row.playerPps / salary
            : Number.NEGATIVE_INFINITY;
        },
        contract: (row) => row.entry.contractLength,
        ovr: (row) =>
          getTeamRosterPlayerOvrSortKey(
            row.playerOvr,
            input.getRosterEntryDisplayMarketValue(row.entry, row.player),
          ),
        mvs: (row) => row.playerMvs ?? Number.NEGATIVE_INFINITY,
        pps: (row) => row.playerPps ?? Number.NEGATIVE_INFINITY,
        pow: (row) => row.player.coreStats.pow,
        spe: (row) => row.player.coreStats.spe,
        men: (row) => row.player.coreStats.men,
        soc: (row) => row.player.coreStats.soc,
        ...Object.fromEntries(
          input.disciplines.map((discipline) => [
            discipline.id,
            (row: SelectedRosterTableRow) => row.player.disciplineRatings[discipline.id] ?? 0,
          ]),
        ),
      }),
    [
      input.disciplines,
      input.getRosterEntryDisplayMarketValue,
      input.getRosterEntryDisplaySalary,
      input.getRosterEntrySalarySortValue,
      input.selectedRosterSort,
      input.selectedRosterTableRows,
    ],
  );

  const teamRosterFocusOptions = useMemo(() => {
    const salaryCount = input.selectedRosterTableRows.filter((row) => {
      const delta = input.getRosterEntrySalaryDelta(row.entry, row.player, input.gameState);
      return delta != null && delta > 0;
    }).length;
    const valueCount = input.selectedRosterTableRows.filter((row) => {
      const salary = input.getRosterEntryDisplaySalary(row.entry, row.player);
      return row.playerPps != null && row.playerPps > 0 && salary != null && salary > 0;
    }).length;
    const expiringCount = input.selectedRosterTableRows.filter((row) => row.entry.contractLength <= 1).length;
    const trainingCount = input.selectedRosterTableRows.filter(
      (row) => (row.player.currentXP ?? 0) > 0 || (row.player.fatigue ?? 0) > 0,
    ).length;
    return [
      { id: "default" as const, label: "Standard", count: input.selectedRosterTableRows.length },
      { id: "salary" as const, label: "Gehaltsdruck", count: salaryCount },
      { id: "value" as const, label: "Value", count: valueCount },
      { id: "contracts" as const, label: "Verträge", count: expiringCount },
      { id: "training" as const, label: "Training", count: trainingCount },
    ].filter((entry) => entry.id === "default" || entry.count > 0);
  }, [input.gameState, input.getRosterEntryDisplaySalary, input.getRosterEntrySalaryDelta, input.selectedRosterTableRows]);

  const focusedSelectedRosterTableRows = useMemo(() => {
    if (input.teamRosterFocusMode === "default") {
      return sortedSelectedRosterTableRows;
    }

    const rows = [...sortedSelectedRosterTableRows];
    if (input.teamRosterFocusMode === "salary") {
      return rows.sort((left, right) => {
        const rightDelta =
          input.getRosterEntrySalaryDelta(right.entry, right.player, input.gameState) ??
          Number.NEGATIVE_INFINITY;
        const leftDelta =
          input.getRosterEntrySalaryDelta(left.entry, left.player, input.gameState) ??
          Number.NEGATIVE_INFINITY;
        return rightDelta - leftDelta;
      });
    }
    if (input.teamRosterFocusMode === "value") {
      return rows.sort((left, right) => {
        const leftSalary = input.getRosterEntryDisplaySalary(left.entry, left.player);
        const rightSalary = input.getRosterEntryDisplaySalary(right.entry, right.player);
        const leftScore =
          left.playerPps != null && leftSalary != null && leftSalary > 0
            ? left.playerPps / leftSalary
            : Number.NEGATIVE_INFINITY;
        const rightScore =
          right.playerPps != null && rightSalary != null && rightSalary > 0
            ? right.playerPps / rightSalary
            : Number.NEGATIVE_INFINITY;
        return rightScore - leftScore;
      });
    }
    if (input.teamRosterFocusMode === "contracts") {
      return rows.sort((left, right) => left.entry.contractLength - right.entry.contractLength);
    }
    return rows.sort((left, right) => {
      const rightScore = (right.player.currentXP ?? 0) * 100 + (right.player.fatigue ?? 0);
      const leftScore = (left.player.currentXP ?? 0) * 100 + (left.player.fatigue ?? 0);
      return rightScore - leftScore;
    });
  }, [
    input.gameState,
    input.getRosterEntryDisplaySalary,
    input.getRosterEntrySalaryDelta,
    input.teamRosterFocusMode,
    sortedSelectedRosterTableRows,
  ]);

  const teamRosterRoleFilterOptions = useMemo(() => {
    const counts: Record<TeamRosterRoleFilter, number> = {
      all: input.selectedRosterTableRows.length,
      starter: 0,
      rotation: 0,
      prospect: 0,
      bench: 0,
      other: 0,
    };
    for (const row of input.selectedRosterTableRows) {
      counts[getTeamRosterRoleBucket(row.entry.roleTag)] += 1;
    }
    return [
      { id: "all" as const, label: "Alle", count: counts.all },
      { id: "starter" as const, label: "Starter", count: counts.starter },
      { id: "rotation" as const, label: "Rotation", count: counts.rotation },
      { id: "prospect" as const, label: "Prospects", count: counts.prospect },
      { id: "bench" as const, label: "Bank", count: counts.bench },
      { id: "other" as const, label: "Sonstige", count: counts.other },
    ].filter((entry) => entry.id === "all" || entry.count > 0);
  }, [input.selectedRosterTableRows]);

  const filteredSelectedRosterTableRows = useMemo(
    () =>
      input.teamRosterRoleFilter === "all"
        ? focusedSelectedRosterTableRows
        : focusedSelectedRosterTableRows.filter(
            (row) => getTeamRosterRoleBucket(row.entry.roleTag) === input.teamRosterRoleFilter,
          ),
    [focusedSelectedRosterTableRows, input.teamRosterRoleFilter],
  );

  return {
    sortedSelectedRosterTableRows,
    focusedSelectedRosterTableRows,
    filteredSelectedRosterTableRows,
    teamRosterFocusOptions,
    teamRosterRoleFilterOptions,
  };
}
