import { randomUUID } from "@/lib/utils/random-id";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  getSponsorRank32BaseAnchorSalary,
  getRankMilestoneBonus,
  getSponsorPayoutForFinalRankAndTier,
  getUnlockedMilestones,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-service";
import { getSponsorProfileComponentFactors } from "@/lib/sponsor/sponsor-negotiation";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";

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

function getCurrentSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function getTeamSalaryTotal(gameState: GameState, teamId: string): number {
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  if (rosterEntries.length === 0) {
    return 0;
  }
  return roundCash(
    rosterEntries.reduce((sum, entry) => {
      const player = gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0),
  );
}

function buildSeasonEndRows(gameState: GameState, contract: TeamSponsorContract): SponsorSettlementRow[] {
  const team = gameState.teams.find((entry) => entry.teamId === contract.teamId);
  const row = buildTeamSeasonOverviewRows({ gameState }).find((entry) => entry.teamId === contract.teamId) ?? null;
  const currentRank = row?.rank ?? null;
  const startRank = contract.startRank ?? row?.startplatz ?? currentRank;
  const salaryFactor = getCurrentSalaryFactor(gameState);
  const baseAnchorSalary = getSponsorRank32BaseAnchorSalary(gameState);
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
      const payout = contract.payouts.baseFirstPaid
        ? roundCash(component.rewardCash / 2)
        : roundCash(component.rewardCash);
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: contract.payouts.baseFirstPaid ? `${component.label} (2. Rate)` : `${component.label} (Saisonbasis)`,
        status: "paid",
        cashDelta: payout,
        reason: contract.payouts.baseFirstPaid ? `Restbasis ${payout}` : `Saisonbasis ${payout}`,
      });
      continue;
    }

    if (component.kind === "rank") {
      const starTier = contract.starTier ?? 2;
      const baseComponent = contract.components.find((entry) => entry.kind === "base");
      const baseTotal = baseComponent?.rewardCash ?? 0;
      const targetTotal = getSponsorPayoutForFinalRankAndTier(
        currentRank,
        salaryFactor,
        starTier,
        baseAnchorSalary,
        contract.archetype,
        contract.teamQualityRankAtSign,
        // Feed 2: expectedRank = Vorsaison-Stärkerang beim Vertragsabschluss (teamQualityRankAtSign). Für den
        // performance-Archetyp belohnt getSponsorPayoutForFinalRankAndTier so das Übertreffen der Erwartung
        // als KONKAVEN Bonus (absolute Rang-Leiter + Anteil der gewonnenen Meilenstein-SCHWIERIGKEIT) — ein
        // schwaches Team, das über seine Erwartung klettert, schlägt damit security, monoton im Endrang.
        contract.teamQualityRankAtSign,
        // Golden: der gedeckelte Rang-Boost muss im Settlement dasselbe zahlen wie in der Angebots-Anzeige.
        contract.isGolden ?? false,
      );
      // F4 — Verhandlungsprofil zahlt jetzt auch am Rang-Upside (vorher zahlte das Settlement die
      // Kurve MINUS negotiated-Base, wodurch die Summe unabhängig vom Profil immer = Kurve war: "Ambitioniert"
      // bekam bei gutem Endrang KEIN Plus, nur bei schlechtem Endrang WENIGER Base + doppelte Strafe → reine
      // Falle). Fix: das Rang-Residual gegen die BALANCED-Base messen (negotiated Base / baseMult rekonstruiert
      // die balanced Base) und mit upsideMult skalieren. Für balanced (baseMult=1, upsideMult=1) exakt das
      // alte max(0, targetTotal - baseTotal) — kein Verhalten geändert. Ambitioniert (0.88/1.25) zahlt bei
      // hohem Endrang echt mehr, safe (1.05/0.85) weniger Upside gegen höheren garantierten Sockel.
      const negotiationFactors = getSponsorProfileComponentFactors(contract.negotiationProfile ?? "balanced");
      const neutralBaseTotal = negotiationFactors.baseMult !== 0 ? baseTotal / negotiationFactors.baseMult : baseTotal;
      const rankResidual = Math.max(0, targetTotal - neutralBaseTotal);
      const payout = roundCash(rankResidual * negotiationFactors.upsideMult);
      const unlockedLabels = getUnlockedMilestones(currentRank).map((milestone) => milestone.label);
      const unlockedBonus = getRankMilestoneBonus(currentRank, salaryFactor);
      const completed = payout > 0;
      const noMilestones = unlockedBonus <= 0;
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: component.label,
        status: completed ? "paid" : noMilestones ? "skipped" : component.penaltyCash ? "failed_penalty" : "skipped",
        cashDelta: completed ? payout : noMilestones ? 0 : -(component.penaltyCash ?? 0),
        reason: completed
          ? `Rang ${currentRank} → ${unlockedLabels.join(", ") || "—"} (+${unlockedBonus} C Stufen)`
          : `Rang ${currentRank ?? "—"} — keine Gewinnstufe freigeschaltet`,
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
      // TEIL B — generalisierter Skalier-Pfad: der Evaluator liefert eine ERREICHTE STUFE (Fraction 0..1),
      // die Settlement zahlt `rewardCash * fraction`. Bestehende binäre Sonderziele (ohne `stages`) liefern
      // Fraction 0 oder 1 und verhalten sich damit exakt wie zuvor; die Fan-Infrastruktur-Skalierung
      // (levelSum/CAP) und die mehrstufigen Bonusziele laufen über denselben Pfad.
      const stageResult = evaluateSpecialComponentStage(gameState, contract.teamId, component);
      const cashDelta = roundCash(component.rewardCash * stageResult.fraction);
      const reason =
        stageResult.fraction >= 1
          ? "Sonderziel voll erfüllt"
          : stageResult.fraction > 0
            ? `Sonderziel Teilstufe (${Math.round(stageResult.fraction * 100)}% — ${stageResult.reachedLabel})`
            : "Sonderziel offen";
      rows.push({
        teamId: contract.teamId,
        teamName: team?.name ?? contract.teamId,
        componentId: component.componentId,
        kind: component.kind,
        label: component.label,
        status: cashDelta > 0 ? "paid" : "skipped",
        cashDelta,
        reason,
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
  /** When true, deduct roster salary once as part of season-end settlement (replaces cash-prize salary deduction). */
  deductSalary?: boolean;
}): { gameState: GameState; preview: SponsorSettlementPreview; applied: boolean } {
  const phase = input.phase ?? "season_end";
  const preview = previewSponsorSettlement(input.gameState, phase);
  if (!input.execute || (!preview.canApply && !input.deductSalary)) {
    return { gameState: input.gameState, preview, applied: false };
  }

  const cashByTeamId = new Map<string, number>();
  const payoutLogs: NonNullable<GameState["seasonState"]["sponsorPayoutLogs"]> = [];
  const contracts = { ...(input.gameState.seasonState.sponsorContractsByTeamId ?? {}) };

  for (const team of input.gameState.teams) {
    if (hasSeasonEndPayoutLog(input.gameState, input.gameState.season.id, team.teamId)) {
      continue;
    }
    const contract = getTeamSponsorContract(input.gameState, team.teamId);
    const teamRows = contract ? preview.rows.filter((row) => row.teamId === team.teamId && row.cashDelta !== 0) : [];
    let delta = roundCash(teamRows.reduce((sum, row) => sum + row.cashDelta, 0));
    if (input.deductSalary && contract) {
      const salaryTotal = getTeamSalaryTotal(input.gameState, team.teamId);
      if (salaryTotal > 0) {
        delta = roundCash(delta - salaryTotal);
        payoutLogs.push({
          id: `sponsor-payout:${input.gameState.season.id}:${team.teamId}:salary_deduct:${randomUUID()}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          phase: "season_end",
          componentId: "salary_deduct",
          cashDelta: -salaryTotal,
          action: "apply",
          createdAt: new Date().toISOString(),
        });
      }
    }
    if (!contract && teamRows.length === 0 && delta === 0) {
      continue;
    }
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
    if (!contract) {
      continue;
    }
    const paidBase = teamRows.some((row) => row.kind === "base" && row.status === "paid");
    contracts[team.teamId] = {
      ...contract,
      payouts: {
        ...contract.payouts,
        baseFirstPaid: paidBase ? true : contract.payouts.baseFirstPaid,
        baseSecondPaid: paidBase ? true : contract.payouts.baseSecondPaid,
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
  const seasonId = gameState.season.id;
  const allLogs = gameState.seasonState.sponsorPayoutLogs ?? [];

  // Sum every sponsor payout log already applied this season (base_first + any season_end partials).
  const alreadyPaid = allLogs
    .filter((log) => log.seasonId === seasonId && log.cashDelta > 0)
    .reduce((sum, log) => sum + log.cashDelta, 0);

  // Add the projected remaining payouts that have not yet been applied (season_end preview).
  const preview = previewSponsorSettlement(gameState, "season_end");
  const projectedRemaining = preview.rows.reduce((sum, row) => sum + Math.max(0, row.cashDelta), 0);

  return roundCash(alreadyPaid + projectedRemaining);
}
