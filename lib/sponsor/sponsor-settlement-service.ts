import { randomUUID } from "@/lib/utils/random-id";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
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


/**
 * Die Gehaltssumme, die am Saisonende wirklich abgebucht wird.
 *
 * EINE STELLE, NICHT ZWEI. Hier stand bis zum Finanz-Audit eine eigene Schleife über die Roster —
 * inhaltlich dasselbe wie `getTeamActualSalaryTotal`, nur mit `Number(x.toFixed(1))` statt
 * `Math.round(x*10)/10` gerundet. Am Live-Abbild (`new-game-1785823388048-1hf25q`) trennte genau
 * diese Rundung ein Team um 0,1 C von der Zahl, die der Finanzen-Reiter zeigte. Es gibt jetzt nur
 * noch die eine Funktion; wer das Gehalt braucht, ruft sie auf.
 */
function getTeamSalaryTotal(gameState: GameState, teamId: string): number {
  return getTeamActualSalaryTotal(gameState, teamId);
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

/**
 * Log-Komponenten, die in `sponsorPayoutLogs` mitfahren, aber KEINE Sponsoreinnahme sind, sondern
 * Gehalts-Buchungen. `salary_deduct` ist der saisonale Gehaltsabzug (siehe `applySponsorSettlement`),
 * `salary_factor_repair` der Ausgleich aus `scripts/repariere-sponsor-gehaltsfaktor.ts` — beide
 * korrigieren die AUSGABEN-Seite und dürfen die Sponsor-Einnahme nicht verfälschen.
 */
const NICHT_SPONSOR_KOMPONENTEN = new Set(["salary_deduct", "salary_factor_repair"]);

/**
 * DIE EINE SPONSOR-EINNAHME EINER SAISON, je Team — bereits gebucht plus projizierter Rest.
 *
 * WARUM ES DIESE FUNKTION GIBT (Finanz-Audit 11.08.2026). Drei Stellen brauchten dieselbe Größe und
 * bildeten sie unterschiedlich:
 *   - `getSeasonSponsorCashTotal` zählte gebuchte Logs nur, wenn `cashDelta > 0` war, den
 *     projizierten Rest aber vorzeichenecht. Am aktiven Spielstand (`new-game-1786465783606-0kalpx`,
 *     86 Vorschauzeilen, davon 3 negativ mit zusammen −8,8 C) sprang die Zahl im Moment des
 *     Abrechnens von 2 533,8 auf 2 542,6 C — derselbe Sachverhalt, zwei Zahlen. Richtig ist die
 *     vorzeichenechte Summe: der Kommentar in dieser Datei verlangte sie ausdrücklich, und der
 *     damalige Vorschuss (Log `+Betrag`, Settlement-Zeile `−(Betrag + Gebühr)`) wäre sonst zweimal
 *     gutgeschrieben. Den Vorschuss gibt es nicht mehr; die vorzeichenechte Summe bleibt richtig,
 *     weil das Settlement weiterhin negative Zeilen kennt (Sockelabzug eines verfehlten Ziels).
 *   - `season-guv-resolver` und `prize-money-preview` lasen NUR die Vorschau. Sobald die Abrechnung
 *     gebucht war, überspringt `previewSponsorSettlement` diese Teams (Duplikat-Wache) und die
 *     Sponsor-Einnahme fiel auf 0 — am Messkörper (`new-game-1785823388048-1hf25q`, Saison 2 bereits
 *     abgerechnet) wies die GuV dadurch je Team 46 bis 96 C zu wenig aus (z. B. Zero Heroes −86,8
 *     statt +5,1).
 *
 * Beide Zweige zusammen sind stabil über den Apply hinweg: was aus der Projektion verschwindet,
 * taucht als Log wieder auf.
 */
export function getSeasonSponsorCashByTeam(gameState: GameState): Map<string, number> {
  const seasonId = gameState.season.id;
  const byTeam = new Map<string, number>();
  const add = (teamId: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    byTeam.set(teamId, (byTeam.get(teamId) ?? 0) + delta);
  };

  // 1) Bereits gebucht: jedes Sponsor-Log dieser Saison, VORZEICHENECHT (season_end-Zeilen
  //    inklusive der negativen; in Altspielstaenden auch noch base_first-Vorschuesse, die dort
  //    echtes, nicht mehr zurueckgefordertes Geld sind).
  for (const log of gameState.seasonState.sponsorPayoutLogs ?? []) {
    if (log.seasonId !== seasonId) continue;
    if (NICHT_SPONSOR_KOMPONENTEN.has(log.componentId ?? "")) continue;
    add(log.teamId, log.cashDelta);
  }

  // 2) Projizierter Rest: alles, was noch nicht gebucht ist. `previewSponsorSettlement` lässt
  //    bereits abgerechnete Teams aus, es kann also nichts doppelt zählen.
  try {
    for (const row of previewSponsorSettlement(gameState, "season_end").rows) {
      add(row.teamId, row.cashDelta);
    }
  } catch {
    // Ohne Verträge gibt es keine Vorschau — dann trägt nur der gebuchte Teil.
  }

  for (const [teamId, value] of byTeam) {
    byTeam.set(teamId, roundCash(value));
  }
  return byTeam;
}

/** Liga-Summe der Sponsor-Einnahme dieser Saison. Eine Herleitung, siehe `getSeasonSponsorCashByTeam`. */
export function getSeasonSponsorCashTotal(gameState: GameState): number {
  let total = 0;
  for (const value of getSeasonSponsorCashByTeam(gameState).values()) {
    total += value;
  }
  return roundCash(total);
}
