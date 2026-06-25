import { randomUUID } from "@/lib/utils/random-id";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-service";
import { evaluateSpecialComponentForObjective } from "@/lib/sponsor/sponsor-objective-evaluator";

export type SponsorSettlementPhase = "season_end";

export type SponsorSettlementRow = {
  teamId: string;
  teamName: string;
  componentId: string;
  kind: SponsorOfferComponent["kind"];
  label: string;
  status: "paid" | "skipped" | "pending" | "failed_penalty";
  cashDelta: number;
  reason: string;
};

export type SponsorSettlementPreview = {
  seasonId: string;
  phase: SponsorSettlementPhase;
  rows: SponsorSettlementRow[];
  totalCashDelta: number;
  warnings: string[];
  blockingReasons: string[];
  canApply: boolean;
  duplicateDetected: boolean;
};

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

function hasSeasonEndPayoutLog(gameState: GameState, seasonId: string, teamId: string) {
  return (gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.teamId === teamId && log.phase === "season_end",
  );
}

function buildSeasonEndRows(gameState: GameState, contract: TeamSponsorContract): SponsorSettlementRow[] {
  const team = gameState.teams.find((entry) => entry.teamId === contract.teamId);
  const row = buildTeamSeasonOverviewRows({ gameState }).find((entry) => entry.teamId === contract.teamId) ?? null;
  const currentRank = row?.rank ?? null;
  const startRank = contract.startRank ?? row?.startplatz ?? currentRank;
  const rows: SponsorSettlementRow[] = [];

  for (const component of contract.components) {
    if (component.kind === "base") {
      if (contract.payouts.baseSecondPaid) {
        rows.push({
          teamId: contract.teamId,
          teamName: team?.name ?? contract.teamId,
          componentId: component.componentId,
          kind: component.kind,
          label: component.label,
          status: "skipped",
          cashDelta: 0,
          reason: "Basis zweite Rate bereits ausgezahlt",
        });
        continue;
      }
      const payout = roundCash(component.rewardCash / 2);
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: `${component.label} (2. Rate)`,
        status: "paid",
        cashDelta: payout,
        reason: `Restbasis ${payout}`,
      });
      continue;
    }

    if (component.kind === "rank") {
      const target = typeof component.targetValue === "number" ? component.targetValue : 16;
      const completed = currentRank != null && currentRank <= target;
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: component.label,
        status: completed ? "paid" : component.penaltyCash ? "failed_penalty" : "skipped",
        cashDelta: completed ? component.rewardCash : -(component.penaltyCash ?? 0),
        reason: completed
          ? `Rang ${currentRank} erreicht Ziel Top ${target}`
          : `Rang ${currentRank ?? "—"} verfehlt Top ${target}`,
      });
      continue;
    }

    if (component.kind === "improvement") {
      const target = typeof component.targetValue === "number" ? component.targetValue : 2;
      const improvement = startRank != null && currentRank != null ? startRank - currentRank : 0;
      const completed = improvement >= target;
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: component.label,
        status: completed ? "paid" : "skipped",
        cashDelta: completed ? component.rewardCash : 0,
        reason: completed
          ? `Verbesserung +${improvement} (Ziel ${target})`
          : `Verbesserung +${improvement} unter Ziel ${target}`,
      });
      continue;
    }

    if (component.kind === "special") {
      const completed = evaluateSpecialComponentForObjective(gameState, contract.teamId, component) === "completed";
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: component.label,
        status: completed ? "paid" : "skipped",
        cashDelta: completed ? component.rewardCash : 0,
        reason: completed ? "Sonderziel erfüllt" : "Sonderziel offen",
      });
    }
  }

  return rows;
}

export function previewSponsorSettlement(
  gameState: GameState,
  phase: SponsorSettlementPhase = "season_end",
): SponsorSettlementPreview {
  const seasonId = gameState.season.id;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const rows: SponsorSettlementRow[] = [];

  if (phase !== "season_end") {
    blockingReasons.push("unsupported_sponsor_settlement_phase");
  }

  for (const team of gameState.teams) {
    const contract = getTeamSponsorContract(gameState, team.teamId);
    if (!contract) {
      warnings.push(`${team.shortCode}:sponsor_contract_missing`);
      continue;
    }
    if (hasSeasonEndPayoutLog(gameState, seasonId, team.teamId)) {
      continue;
    }
    rows.push(...buildSeasonEndRows(gameState, contract));
  }

  const totalCashDelta = roundCash(rows.reduce((sum, row) => sum + row.cashDelta, 0));
  const duplicateDetected = gameState.teams.some((team) => hasSeasonEndPayoutLog(gameState, seasonId, team.teamId));

  return {
    seasonId,
    phase,
    rows,
    totalCashDelta,
    warnings,
    blockingReasons,
    canApply: blockingReasons.length === 0 && rows.some((row) => row.cashDelta !== 0),
    duplicateDetected,
  };
}

export function applySponsorSettlement(input: {
  gameState: GameState;
  saveId: string;
  phase?: SponsorSettlementPhase;
  execute?: boolean;
}): { gameState: GameState; preview: SponsorSettlementPreview; applied: boolean } {
  const phase = input.phase ?? "season_end";
  const preview = previewSponsorSettlement(input.gameState, phase);
  if (!input.execute || !preview.canApply) {
    return { gameState: input.gameState, preview, applied: false };
  }

  const cashByTeamId = new Map<string, number>();
  const payoutLogs: NonNullable<GameState["seasonState"]["sponsorPayoutLogs"]> = [];
  const contracts = { ...(input.gameState.seasonState.sponsorContractsByTeamId ?? {}) };

  for (const team of input.gameState.teams) {
    const contract = getTeamSponsorContract(input.gameState, team.teamId);
    if (!contract || hasSeasonEndPayoutLog(input.gameState, input.gameState.season.id, team.teamId)) {
      continue;
    }
    const teamRows = preview.rows.filter((row) => row.teamId === team.teamId && row.cashDelta !== 0);
    const delta = roundCash(teamRows.reduce((sum, row) => sum + row.cashDelta, 0));
    if (delta !== 0) {
      cashByTeamId.set(team.teamId, delta);
    }
    for (const row of teamRows) {
      payoutLogs.push({
        id: `sponsor-payout:${input.gameState.season.id}:${team.teamId}:${row.componentId}:${randomUUID()}`,
        saveId: input.saveId,
        seasonId: input.gameState.season.id,
        teamId: team.teamId,
        phase: "season_end",
        componentId: row.componentId,
        cashDelta: row.cashDelta,
        action: "apply",
        createdAt: new Date().toISOString(),
      });
    }
    contracts[team.teamId] = {
      ...contract,
      payouts: {
        ...contract.payouts,
        baseSecondPaid: true,
        rankPaid: teamRows.some((row) => row.kind === "rank" && row.status === "paid") || contract.payouts.rankPaid,
        improvementPaid:
          teamRows.some((row) => row.kind === "improvement" && row.status === "paid") || contract.payouts.improvementPaid,
        specialPaid: teamRows.some((row) => row.kind === "special" && row.status === "paid") || contract.payouts.specialPaid,
      },
    };
  }

  const nextGameState: GameState = {
    ...input.gameState,
    teams: input.gameState.teams.map((team) => {
      const delta = cashByTeamId.get(team.teamId) ?? 0;
      return delta === 0 ? team : { ...team, cash: roundCash(team.cash + delta) };
    }),
    seasonState: {
      ...input.gameState.seasonState,
      sponsorContractsByTeamId: contracts,
      sponsorPayoutLogs: [...payoutLogs, ...(input.gameState.seasonState.sponsorPayoutLogs ?? [])],
    },
  };

  return { gameState: nextGameState, preview, applied: payoutLogs.length > 0 };
}

export function getSeasonSponsorCashTotal(gameState: GameState): number {
  const preview = previewSponsorSettlement(gameState, "season_end");
  const paidBaseFirst = (gameState.seasonState.sponsorPayoutLogs ?? [])
    .filter((log) => log.seasonId === gameState.season.id && log.phase === "base_first")
    .reduce((sum, log) => sum + log.cashDelta, 0);
  const projectedEnd = preview.rows.reduce((sum, row) => sum + Math.max(0, row.cashDelta), 0);
  return roundCash(paidBaseFirst + projectedEnd);
}
