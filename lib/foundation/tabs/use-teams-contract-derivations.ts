import { useMemo } from "react";

import type { ContractShape, ContractYearSalary, GameState, Team } from "@/lib/data/olyDataTypes";
import { CONTRACT_SHAPE_LABELS } from "@/lib/foundation/contract-shape-label";
import { roundViewNumberByFactor as roundViewNumber } from "@/lib/foundation/foundation-number-utils";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { bewerteGehalt, type SalaryBenchmarkResult } from "@/lib/contracts/salary-benchmark";
import { buildLeagueSalaryBenchmarks, modellFuerSpieler } from "@/lib/contracts/salary-benchmark-league";
import { empfehleVertrag, type ContractRecommendationResult } from "@/lib/contracts/contract-recommendation";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";

export type ContractAssessment = ContractRecommendationResult & {
  /** Gehalt gegen ueblich; null, wenn die Liga dafuer noch zu wenig hergibt. */
  gehalt: SalaryBenchmarkResult | null;
};

/**
 * Das aktuell gezahlte Jahresgehalt: der letzte Eintrag des Zahlplans, der noch zum laufenden
 * Vertrag gehoert. Bewusst nicht die Gesamtsumme und nicht der Durchschnitt — gefragt ist, was
 * dieser Spieler HEUTE kostet.
 */
function letztesAktivesGehalt(schedule: ContractYearSalary[] | null | undefined): number | null {
  if (!schedule || schedule.length === 0) return null;
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    const wert = schedule[index]?.salary;
    if (wert != null && Number.isFinite(wert) && wert > 0) return wert;
  }
  return null;
}

export type UseTeamsContractDerivationsInput = {
  enabled: boolean;
  gameState: GameState;
  selectedTeam: Team | null;
  showTeamContractPreviewRows: boolean;
  /** Ligaweite Ratings — Grundlage fuer Leistung und Marktwert-Bracket. */
  playerRatingsById: Map<string, PlayerRatingContractRow>;
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
      balanced: { shape: "balanced", label: CONTRACT_SHAPE_LABELS.balanced, count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
      front_loaded: { shape: "front_loaded", label: CONTRACT_SHAPE_LABELS.front_loaded, count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
      back_loaded: { shape: "back_loaded", label: CONTRACT_SHAPE_LABELS.back_loaded, count: 0, totalSalary: 0, currentDelta: 0, futureDelta: 0 },
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

  /**
   * DIE VERTRAGS-BEWERTUNG je Spieler — dieselbe Grundlage, auf der auch die KI ueber Verkaeufe
   * entscheidet (`lib/contracts/salary-benchmark*`), damit Anzeige und Computer-Gegner nicht
   * verschiedene Antworten auf dieselbe Frage geben.
   *
   * Ligaweit gebaut und je Marktwert-Bracket getrennt: verglichen wird mit seinesgleichen, nicht
   * mit dem eigenen Kader und nicht mit der ganzen Liga in einem Topf.
   */
  const salaryBenchmarks = useMemo(
    () =>
      input.enabled
        ? buildLeagueSalaryBenchmarks({ gameState: input.gameState, ratingsById: input.playerRatingsById })
        : null,
    [input.enabled, input.gameState, input.playerRatingsById],
  );

  const contractAssessmentByPlayerId = useMemo(() => {
    const ergebnis = new Map<string, ContractAssessment>();
    if (!salaryBenchmarks) return ergebnis;
    for (const row of visibleSelectedTeamContractRows) {
      const rating = input.playerRatingsById.get(row.playerId);
      const gehalt = bewerteGehalt(modellFuerSpieler(salaryBenchmarks, row.playerId), {
        salary: letztesAktivesGehalt(row.yearlySalarySchedule),
        leistung: rating?.mvs ?? null,
        laufzeit: row.contractLength,
      });
      const empfehlung = empfehleVertrag({
        gehalt,
        vk: row.exitValue,
        marktwert: row.marketValueAtExit,
        restlaufzeit: row.contractLength,
        moral: row.morale,
        intent: row.moraleContractIntent,
      });
      ergebnis.set(row.playerId, { gehalt, ...empfehlung });
    }
    return ergebnis;
  }, [input.playerRatingsById, salaryBenchmarks, visibleSelectedTeamContractRows]);

  /** Wie viele Vertraege in welcher Empfehlung stehen — die Zusammenfassung fuer die Board-Leiste. */
  const contractRecommendationCounts = useMemo(() => {
    const zaehler = { verlaengern: 0, beobachten: 0, abgeben: 0 };
    for (const eintrag of contractAssessmentByPlayerId.values()) {
      zaehler[eintrag.empfehlung] += 1;
    }
    return zaehler;
  }, [contractAssessmentByPlayerId]);

  return {
    selectedTeamContractTable,
    selectedTeamContractShapeMix,
    selectedTeamContractPreviewRowCount,
    visibleSelectedTeamContractRows,
    contractAssessmentByPlayerId,
    contractRecommendationCounts,
  };
}
