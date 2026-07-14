import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  fanInfrastructureLevelSum,
  getTeamAxisRank,
  parseAxisTargetValue,
  type SponsorAxisKey,
} from "@/lib/sponsor/sponsor-special-objectives";

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

  if (specialKey === "axis_rank_top") {
    const parsed = parseAxisTargetValue(component.targetValue);
    if (!parsed) {
      return "open";
    }
    const axisRank = getTeamAxisRank(rows, teamId, parsed.axis as SponsorAxisKey, gameState);
    if (axisRank.rank == null) {
      return "open";
    }
    if (axisRank.rank <= parsed.topRank) {
      return "completed";
    }
    if (axisRank.rank <= parsed.topRank + 2) {
      return "at_risk";
    }
    return "open";
  }

  if (specialKey === "salary_pressure_max") {
    const target = typeof component.targetValue === "number" ? component.targetValue : Number(component.targetValue);
    const salary = row?.salaryTotal ?? getTeamDisplaySalaryTotal(gameState, teamId);
    if (!Number.isFinite(target) || target <= 0) {
      return "open";
    }
    if (salary <= target) {
      return "completed";
    }
    if (salary <= target * 1.05) {
      return "at_risk";
    }
    return "open";
  }

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
  if (specialKey === "fan_infrastructure") {
    // Greift, sobald mindestens ein Income-Gebäude (fan_shop / arena_upgrade) auf L1 steht. Die
    // eigentliche Höhe der Auszahlung skaliert dann in der Settlement mit der Gesamtstufe (siehe
    // fanInfrastructureLevelSum / die Settlement-Skalierung) — hier nur die Ja/Nein-Schwelle.
    const target = typeof component.targetValue === "number" ? component.targetValue : 1;
    const levelSum = fanInfrastructureLevelSum(gameState, teamId);
    if (levelSum >= target) return "completed";
    return "open";
  }
  if (specialKey === "beat_expected_rank") {
    // targetValue = beim Signing eingefrorene absolute Ziel-Platzierung (erwartete Qualität − margin).
    const target = typeof component.targetValue === "number" ? component.targetValue : Number(component.targetValue);
    const rank = row?.rank ?? null;
    if (rank == null || !Number.isFinite(target)) return "open";
    if (rank <= target) return "completed";
    if (rank <= target + 2) return "at_risk";
    return "open";
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
