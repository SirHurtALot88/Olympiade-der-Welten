import { useMemo } from "react";

import type { ContractShape, GameState, Team } from "@/lib/data/olyDataTypes";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

function roundViewNumber(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export type UseTeamsContractDerivationsInput = {
  enabled: boolean;
  gameState: GameState;
  selectedTeam: Team | null;
  showTeamContractPreviewRows: boolean;
};

export function useTeamsContractDerivations(input: UseTeamsContractDerivationsInput) {
  const canonicalSeasonLabel = useMemo(
    () =>
      getCanonicalSeasonLabel({
        seasonId: input.gameState.season.id,
        seasonName: input.gameState.season.name,
      }),
    [input.gameState.season.id, input.gameState.season.name],
  );

  const selectedTeamContractTable = useMemo(
    () =>
      input.selectedTeam && input.enabled
        ? buildTeamContractSeasonTable({
            gameState: input.gameState,
            teamId: input.selectedTeam.teamId,
            seasonLabelBase: canonicalSeasonLabel,
          })
        : null,
    [canonicalSeasonLabel, input.enabled, input.gameState, input.selectedTeam],
  );

  const selectedTeamContractShapeMix = useMemo(() => {
    if (!selectedTeamContractTable) {
      return null;
    }

    const activeRows = selectedTeamContractTable.rows.filter((row) => row.status === "active");
    const totalCount = activeRows.length;
    const buckets: Record<
      ContractShape,
      {
        shape: ContractShape;
        label: string;
        count: number;
        totalSalary: number;
        currentDelta: number;
        futureDelta: number;
      }
    > = {
      balanced: { shape: "balanced", label: "Balanced", count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
      front_loaded: { shape: "front_loaded", label: "Front-loaded", count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
      back_loaded: { shape: "back_loaded", label: "Back-loaded", count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
    };

    activeRows.forEach((row) => {
      const shape = row.contractShape ?? "balanced";
      const scheduleSalary = row.yearlySalarySchedule.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);
      const totalSalary = row.totalSalary ?? scheduleSalary;
      if (!Number.isFinite(totalSalary) || totalSalary <= 0) {
        buckets[shape].count += 1;
        return;
      }

      const contractLength = Math.max(1, row.contractLength || row.yearlySalarySchedule.length || 1);
      const balancedAnnualSalary = totalSalary / contractLength;
      const currentSalary = row.yearlySalarySchedule[0]?.salary ?? balancedAnnualSalary;
      const futureSalary = Math.max(0, totalSalary - currentSalary);
      const balancedFutureSalary = Math.max(0, totalSalary - balancedAnnualSalary);

      buckets[shape].count += 1;
      buckets[shape].totalSalary += totalSalary;
      buckets[shape].currentDelta += currentSalary - balancedAnnualSalary;
      buckets[shape].futureDelta += futureSalary - balancedFutureSalary;
    });

    const entries = (["balanced", "front_loaded", "back_loaded"] as ContractShape[]).map((shape) => {
      const bucket = buckets[shape];
      return {
        ...bucket,
        share: totalCount > 0 ? (bucket.count / totalCount) * 100 : 0,
        totalSalary: roundViewNumber(bucket.totalSalary, 2),
        currentDelta: roundViewNumber(bucket.currentDelta, 2),
        futureDelta: roundViewNumber(bucket.futureDelta, 2),
      };
    });

    const nonBalancedCurrentDelta = entries
      .filter((entry) => entry.shape !== "balanced")
      .reduce((sum, entry) => sum + entry.currentDelta, 0);
    const nonBalancedFutureDelta = entries
      .filter((entry) => entry.shape !== "balanced")
      .reduce((sum, entry) => sum + entry.futureDelta, 0);

    return {
      totalCount,
      entries,
      nonBalancedCount: entries.filter((entry) => entry.shape !== "balanced").reduce((sum, entry) => sum + entry.count, 0),
      currentDelta: roundViewNumber(nonBalancedCurrentDelta, 2),
      futureDelta: roundViewNumber(nonBalancedFutureDelta, 2),
    };
  }, [selectedTeamContractTable]);

  const selectedTeamContractPreviewRowCount = useMemo(
    () => selectedTeamContractTable?.rows.filter((row) => row.status === "preview").length ?? 0,
    [selectedTeamContractTable],
  );

  const visibleSelectedTeamContractRows = useMemo(
    () =>
      selectedTeamContractTable?.rows.filter((row) => input.showTeamContractPreviewRows || row.status !== "preview") ?? [],
    [input.showTeamContractPreviewRows, selectedTeamContractTable],
  );

  return {
    selectedTeamContractTable,
    selectedTeamContractShapeMix,
    selectedTeamContractPreviewRowCount,
    visibleSelectedTeamContractRows,
  };
}
