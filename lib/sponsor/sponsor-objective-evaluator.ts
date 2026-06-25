import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

export function evaluateSponsorRankObjective(currentRank: number | null, targetRank: number) {
  if (currentRank == null) return "open" as const;
  if (currentRank <= targetRank) return "completed" as const;
  if (currentRank <= targetRank + 2) return "at_risk" as const;
  return "failed" as const;
}

export function evaluateSponsorImprovementObjective(startRank: number | null, currentRank: number | null, targetImprovement: number) {
  if (startRank == null || currentRank == null) return "open" as const;
  const improvement = startRank - currentRank;
  if (improvement >= targetImprovement) return "completed" as const;
  if (improvement >= targetImprovement - 1) return "at_risk" as const;
  return "open" as const;
}

export function evaluateSpecialComponentForObjective(
  gameState: GameState,
  teamId: string,
  component: SponsorOfferComponent,
): "open" | "completed" | "at_risk" {
  const specialKey = component.specialKey ?? "";
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const row = rows.find((entry) => entry.teamId === teamId) ?? null;
  if (specialKey === "transfer_profit_min") {
    const target = typeof component.targetValue === "number" ? component.targetValue : 5;
    return (row?.transferNet ?? 0) >= target ? "completed" : (row?.transferNet ?? 0) >= target - 2 ? "at_risk" : "open";
  }
  if (specialKey === "discipline_top3_count") {
    const performances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter(
      (entry) => entry.teamId === teamId && (entry.rankInDiscipline ?? 99) <= 3,
    );
    const target = typeof component.targetValue === "number" ? component.targetValue : 2;
    return performances.length >= target ? "completed" : performances.length >= target - 1 ? "at_risk" : "open";
  }
  if (specialKey === "form_color_cover") {
    const rosterPlayerIds = new Set(
      gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
    );
    const colors = new Set(
      gameState.players
        .filter((player) => rosterPlayerIds.has(player.id))
        .map((player) => player.className)
        .filter(Boolean),
    );
    const parsedTarget =
      typeof component.targetValue === "number"
        ? component.targetValue
        : typeof component.targetValue === "string"
          ? Number.parseInt(component.targetValue, 10)
          : NaN;
    const targetColors = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 4;
    return colors.size >= targetColors ? "completed" : colors.size >= targetColors - 1 ? "at_risk" : "open";
  }
  return "open";
}
