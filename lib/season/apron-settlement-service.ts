/**
 * APRON-SETTLEMENT-SERVICE — die Verdrahtung um die reine Arithmetik in apron-service.ts: Linien zu
 * Saisonbeginn einfrieren, am Saisonende die Abgaben/Ausgleiche auf `team.cash` buchen.
 *
 * REIHENFOLGE IN DER SAISONENDE-KETTE: läuft NACH der Sponsor-Abrechnung (`applySponsorSettlement`,
 * sponsor-settlement-service.ts) und VOR der Kassenbuchung (dem Persistieren des Saisonend-Cash-
 * Stands, cash-prize-apply-service.ts `writeLocalCashPrizeApply` / season-completion-service.ts).
 * Reihenfolge ist hier nicht kosmetisch: der Deckel dieses Schritts braucht den bereits bekannten
 * Wertungsanteil, und `apronWertungsanteil` ist zwar unabhängig vom SPONSOR-Vertrag selbst (siehe
 * Kommentar dort), der Endrang, den beide Schritte lesen, muss aber in jedem Fall schon feststehen —
 * beide Aufrufer lesen ihn aus derselben, zu diesem Zeitpunkt bereits bestraften/finalen Tabelle
 * (nach der Formkarten-Strafe, siehe season-completion-service.ts). Liefe der Apron VOR der Sponsor-
 * Abrechnung, würde er auf einer Tabelle rechnen, die die Sponsor-Abrechnung selbst noch verändern
 * könnte (Bonus-/Malus-Ranganpassungen) — zwei Schritte, zwei verschiedene "Endränge" im selben
 * Saisonabschluss.
 */
import type { ApronSettlementLogRecord, GameState } from "@/lib/data/olyDataTypes";
import { randomUUID } from "@/lib/utils/random-id";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  apronWertungsanteil,
  computeApronLines,
  computeApronSettlement,
  type ApronLines,
  type ApronTeamRow,
} from "@/lib/season/apron-service";

function roundCash(value: number): number {
  return Number(value.toFixed(1));
}

function getCurrentSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function getTeamRealSalaryTotal(gameState: GameState, teamId: string): number {
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  if (rosterEntries.length === 0) return 0;
  return roundCash(
    rosterEntries.reduce((sum, entry) => {
      const player = gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0),
  );
}

// ── Einfrieren zu Saisonbeginn ────────────────────────────────────────────────────────────────

/**
 * Friert die Apron-Linien für die AKTUELLE Saison ein, falls noch nicht geschehen. Idempotent: ein
 * bereits vorhandener Snapshot für `gameState.season.id` wird nie überschrieben — das ist die ganze
 * Absicherung gegen "man kauft gegen eine Grenze, die sich durch die eigenen Käufe verschiebt".
 *
 * Aufrufstellen: `lib/game/new-game-setup-service.ts` (Season 1 — Rosters noch leer, greift der
 * Referenz-Gehalt-Fallback aus `computeApronLines`) und `lib/season/preseason-workflow-service.ts`
 * (Season-Übergang, unmittelbar bevor `gamePhase` auf `season_active` schaltet, also NACH dem
 * Transferfenster — der Gehaltsstand, gegen den die neue Saison antritt, steht dann fest).
 */
export function ensureSeasonApronLinesFrozen(gameState: GameState): GameState {
  const existing = gameState.seasonState.apronLinesSnapshot;
  if (existing && existing.seasonId === gameState.season.id) {
    return gameState;
  }
  const lines = computeApronLines(gameState);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      apronLinesSnapshot: {
        seasonId: gameState.season.id,
        frozenAtMatchdayId: gameState.matchdayState?.matchdayId ?? "",
        createdAt: new Date().toISOString(),
        medianSalary: lines.medianSalary,
        line1: lines.line1,
        line2: lines.line2,
        usedReferenceSalary: lines.usedReferenceSalary,
      },
    },
  };
}

// ── Vorschau + Abrechnung am Saisonende ───────────────────────────────────────────────────────

export type ApronSettlementPreview = {
  seasonId: string;
  lines: ApronLines | null;
  rows: ApronTeamRow[];
  topf: number;
  zahlerCount: number;
  empfaengerCount: number;
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
  alreadyApplied: boolean;
};

function hasSeasonEndApronLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.apronSettlementLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
}

/**
 * Baut die Vorschau der Apron-Abrechnung. Braucht eingefrorene Linien (`ensureSeasonApronLinesFrozen`
 * muss schon gelaufen sein) — ohne Snapshot gibt es keine Grenze, gegen die gemessen werden könnte,
 * und die Vorschau bleibt leer statt eine Grenze ad hoc am Saisonende zu erfinden.
 */
export function previewApronSettlement(gameState: GameState): ApronSettlementPreview {
  const seasonId = gameState.season.id;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const lines = gameState.seasonState.apronLinesSnapshot?.seasonId === seasonId ? gameState.seasonState.apronLinesSnapshot : null;
  const alreadyApplied = hasSeasonEndApronLog(gameState, seasonId);

  if (!lines) {
    blockingReasons.push("apron_lines_not_frozen");
    return {
      seasonId,
      lines: null,
      rows: [],
      topf: 0,
      zahlerCount: 0,
      empfaengerCount: 0,
      canApply: false,
      blockingReasons,
      warnings,
      alreadyApplied,
    };
  }

  const overviewRows = buildTeamSeasonOverviewRows({ gameState });
  const rankByTeamId = new Map(overviewRows.map((row) => [row.teamId, row.rank] as const));
  const salaryFactor = getCurrentSalaryFactor(gameState);

  const teams = gameState.teams.map((team) => {
    const finalRank = rankByTeamId.get(team.teamId) ?? null;
    if (finalRank == null) {
      warnings.push(`${team.shortCode}:apron_rank_missing`);
    }
    return {
      teamId: team.teamId,
      salary: getTeamRealSalaryTotal(gameState, team.teamId),
      rankShare: apronWertungsanteil(finalRank ?? 32, salaryFactor),
    };
  });

  const settlement = computeApronSettlement({ lines, salaryFactor, teams });

  return {
    seasonId,
    lines,
    rows: settlement.rows,
    topf: settlement.topf,
    zahlerCount: settlement.zahlerCount,
    empfaengerCount: settlement.empfaengerCount,
    canApply: !alreadyApplied && settlement.rows.some((row) => row.nettoDelta !== 0),
    blockingReasons,
    warnings,
    alreadyApplied,
  };
}

export function applyApronSettlement(input: {
  gameState: GameState;
  saveId: string;
  execute?: boolean;
}): { gameState: GameState; preview: ApronSettlementPreview; applied: boolean } {
  const preview = previewApronSettlement(input.gameState);
  if (!input.execute || preview.alreadyApplied || preview.lines == null || preview.rows.every((row) => row.nettoDelta === 0)) {
    return { gameState: input.gameState, preview, applied: false };
  }

  const now = new Date().toISOString();
  const logs: ApronSettlementLogRecord[] = [];
  const cashByTeamId = new Map<string, number>();

  // Abgaben werden je Team unabhaengig gerundet — jede ist ein eigener, unverteilter Wert, das
  // rundet nichts weg. Die Ausschüttung dagegen ist EIN Topf, geteilt durch die Empfänger-Anzahl;
  // wuerde jeder Anteil unabhaengig gerundet, koennte die Summe der Ausgleiche um ein paar Zehntel
  // vom (gerundeten) Topf abweichen — die Erhaltung waere nur noch ungefaehr wahr. Deshalb ruendet
  // NUR der letzte Empfaenger den Rest auf: alle anderen bekommen den normal gerundeten Anteil, der
  // letzte bekommt exakt "Topf minus alle anderen", garantiert exakte Gleichheit.
  const payoutRows = preview.rows.filter((row) => row.ausgleich > 0);
  let roundedTopf = 0;
  const levyDeltaByTeamId = new Map<string, number>();
  for (const row of preview.rows) {
    if (row.abgabe > 0) {
      const delta = roundCash(row.abgabe);
      levyDeltaByTeamId.set(row.teamId, delta);
      roundedTopf = roundCash(roundedTopf + delta);
    }
  }
  const payoutDeltaByTeamId = new Map<string, number>();
  let distributed = 0;
  payoutRows.forEach((row, index) => {
    const isLast = index === payoutRows.length - 1;
    const delta = isLast ? roundCash(roundedTopf - distributed) : roundCash(row.ausgleich);
    distributed = roundCash(distributed + delta);
    payoutDeltaByTeamId.set(row.teamId, delta);
  });

  for (const row of preview.rows) {
    const levyDelta = levyDeltaByTeamId.get(row.teamId);
    if (levyDelta != null && levyDelta > 0) {
      cashByTeamId.set(row.teamId, roundCash((cashByTeamId.get(row.teamId) ?? 0) - levyDelta));
      logs.push({
        id: `apron-settlement:${preview.seasonId}:${row.teamId}:levy:${randomUUID()}`,
        saveId: input.saveId,
        seasonId: preview.seasonId,
        teamId: row.teamId,
        phase: "season_end",
        kind: "levy",
        cashDelta: -levyDelta,
        action: "apply",
        createdAt: now,
      });
    }
    const payoutDelta = payoutDeltaByTeamId.get(row.teamId);
    if (payoutDelta != null && payoutDelta !== 0) {
      cashByTeamId.set(row.teamId, roundCash((cashByTeamId.get(row.teamId) ?? 0) + payoutDelta));
      logs.push({
        id: `apron-settlement:${preview.seasonId}:${row.teamId}:payout:${randomUUID()}`,
        saveId: input.saveId,
        seasonId: preview.seasonId,
        teamId: row.teamId,
        phase: "season_end",
        kind: "payout",
        cashDelta: payoutDelta,
        action: "apply",
        createdAt: now,
      });
    }
  }

  if (logs.length === 0) {
    return { gameState: input.gameState, preview, applied: false };
  }

  const nextGameState: GameState = {
    ...input.gameState,
    teams: input.gameState.teams.map((team) => {
      const delta = cashByTeamId.get(team.teamId) ?? 0;
      return delta === 0 ? team : { ...team, cash: roundCash(team.cash + delta) };
    }),
    seasonState: {
      ...input.gameState.seasonState,
      apronSettlementLogs: [...logs, ...(input.gameState.seasonState.apronSettlementLogs ?? [])],
    },
  };

  return { gameState: nextGameState, preview, applied: true };
}
