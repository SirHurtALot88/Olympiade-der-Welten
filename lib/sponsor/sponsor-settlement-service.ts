import { randomUUID } from "@/lib/utils/random-id";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-service";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import { buildMigratedSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-migration";
import {
  getSponsorV3Terms, sponsorV3SettlementParts, type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-offer-service";

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

/**
 * SPONSORSYSTEM V3 — Abrechnung aus den bei Unterschrift eingefrorenen Konditionen.
 *
 * Die drei Zeilen sind DIFFERENZEN echter Modellwerte und addieren sich per Teleskopsumme exakt auf
 * `sponsorV3Settle(...)`. Deshalb koennen Rundung und Untergrenze die Summe nicht verfaelschen, egal
 * an welcher Stelle sie greifen — und deshalb ist die im Angebot angezeigte garantierte Leiter
 * zeichengleich die Summe der Zeilen "Saisonbasis" und "Tabellenplatz".
 *
 * Das SONDERZIEL wird weiterhin vom bestehenden `evaluateSpecialComponentStage` ausgewertet: V3
 * bepreist es neu (Praemie nach Rarity, Sockelabzug −p·G), erfindet es aber nicht neu. Die KLAUSEL
 * ist ersatzlos entfallen — ihre Risikofunktion uebernimmt der Kurven-Tilt der Karte.
 */
function buildSponsorV3SeasonEndRows(
  gameState: GameState, contract: TeamSponsorContract, terms: SponsorV3ContractTerms, currentRank: number | null,
): SponsorSettlementRow[] {
  const team = gameState.teams.find((entry) => entry.teamId === contract.teamId);
  const goalComponent = contract.components.find((component) => component.kind === "special") ?? null;
  const goalFraction = goalComponent && terms.goalSize > 0
    ? Math.max(0, Math.min(1, evaluateSpecialComponentStage(gameState, contract.teamId, goalComponent).fraction))
    : 0;
  const parts = sponsorV3SettlementParts({ terms, finalRank: currentRank, goalFraction });
  return parts.map((part) => ({
    teamId: contract.teamId,
    teamName: team?.name ?? contract.teamId,
    componentId: `${contract.offerId}:v3:${part.key}`,
    kind: part.key,
    label: part.label,
    status: part.cashDelta > 0 ? "paid" : part.met ? "paid" : "skipped",
    cashDelta: part.cashDelta,
    reason: part.reason,
  }));
}

/**
 * DIE EINE ABRECHNUNGSREGEL. Jeder Vertrag wird aus seiner eingefrorenen V3-Leiter bezahlt.
 *
 * Traegt ein Vertrag noch keine V3-Konditionen — moeglich nur in einem Spielstand, dessen
 * Leiter-Migration (`sponsor-v3-migration.ts`) noch nicht gelaufen ist —, werden sie hier mit
 * DERSELBEN Funktion nachgebaut, die auch die Migration benutzt. Es gibt damit keinen zweiten
 * Rechenweg und keine "alte Rechnung" mehr, in die etwas zurueckfallen koennte.
 */
function buildSeasonEndRows(gameState: GameState, contract: TeamSponsorContract): SponsorSettlementRow[] {
  const row = buildTeamSeasonOverviewRows({ gameState }).find((entry) => entry.teamId === contract.teamId) ?? null;
  const currentRank = row?.rank ?? null;
  const terms = getSponsorV3Terms(contract) ?? buildMigratedSponsorV3Terms(gameState, contract);
  return buildSponsorV3SeasonEndRows(gameState, contract, terms, currentRank);
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
    // Audit R2/V2: Gehalt wird IMMER abgezogen — unabhängig davon, ob ein Sponsorvertrag existiert. Vorher
    // war der (einzige) saisonale Gehaltsabzug an `contract` gekoppelt, sodass vertragslose Teams (Mensch
    // ohne Sponsor, passive Teams, abgelaufene AI-Verträge) NIE Gehalt zahlten → systematischer Ökonomie-
    // Skew + KI-Paritätsbruch (AI signt automatisch, Mensch konnte durch Nicht-Unterschreiben den größten
    // Kostenblock dauerhaft vermeiden). getTeamSalaryTotal ist rosterbasiert und braucht keinen Vertrag.
    if (input.deductSalary) {
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
