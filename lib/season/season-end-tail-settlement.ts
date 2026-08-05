/**
 * DER GEMEINSAME SCHWANZ DER SAISONENDE-BUCHUNG — Kredite, Vorstandsziele, Zahlungsunfähigkeit.
 *
 * WARUM ES DIESE DATEI GIBT. Es gab zwei Wege, eine Saison abzurechnen:
 *
 *   A) `runLocalSeasonCompletion` (Cockpit, „Saison abschliessen") — vollständig.
 *   B) `writeLocalCashPrizeApply` (Knopf „Sponsoren buchen" / „Jetzt nachbuchen") — bucht Sponsor,
 *      Apron und Gebäude, und hörte danach auf.
 *
 * Weg B fehlten drei Schritte, die auf dem Konto landen: die KREDITRATEN, die
 * VORSTANDSZIEL-Prämien/-Strafen und — der folgenreichste — der INSOLVENZ-BACKSTOP. Genau dieser
 * Weg war es, den Chris benutzt hat, als er meldete: „ich habe jetzt das Cash gebucht und so viele
 * Teams hatten ne positive GuV und jetzt haben so viele Teams negatives Cash????" Der Spielstand
 * zeigte 12 Teams im Minus, 0 Kredite, 0 Notkredit-Logs und genau einen `cashPrizeApplyLog` — der
 * Backstop war nie gelaufen, weil dieser Pfad ihn nicht kannte.
 *
 * Hier steht der Schwanz jetzt EINMAL, und beide Wege rufen ihn auf. Reihenfolge wie in A, weil sie
 * begründet ist: Kredite vor Gebäuden (die Rate ist fällig, bevor Unterhalt bezahlt wird), Ziele
 * danach, und der Backstop ganz zuletzt — er ist der einzige Schritt, der garantieren soll, dass
 * hinterher kein Team negatives Cash hat, und das kann er nur, wenn alle anderen Cash-Bewegungen
 * schon gebucht sind.
 *
 * IDEMPOTENZ: jeder Teilschritt prüft sein eigenes Log (`loanApplyLogs`, `objectiveRewardApplyLogs`)
 * und überspringt sich, wenn er in dieser Saison schon lief. Wer zuerst kommt, bucht — egal über
 * welchen der beiden Wege.
 */

import { applyTeamSeasonObjectiveRewards } from "@/lib/board/team-season-objectives-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { applyInsolvencyBackstop, applyLoanSettlement } from "@/lib/finance/loan-service";

export type SeasonEndTailResult = {
  gameState: GameState;
  loanSettlementApplied: boolean;
  objectiveRewardsApplied: boolean;
  emergencyLoans: Array<{ teamId: string; principal: number }>;
  warnings: string[];
};

export type SeasonEndTailInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  /** `false` = nur prüfen, nichts buchen. */
  execute: boolean;
};

function hasLoanSettlementLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.loanApplyLogs ?? []).some((log) => log.seasonId === seasonId && log.kind !== "early_payoff");
}

function hasObjectiveRewardLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.objectiveRewardApplyLogs ?? []).some((log) => log.seasonId === seasonId);
}

/**
 * Bucht Kredite → Vorstandsziele → Insolvenz-Backstop auf den übergebenen Zustand und gibt den
 * neuen Zustand zurück. Persistiert NICHTS — das bleibt beim Aufrufer, der seine eigene
 * Save-/Transaktionsführung hat.
 */
export function applySeasonEndTail(input: SeasonEndTailInput): SeasonEndTailResult {
  const warnings: string[] = [];
  let gameState = input.gameState;

  // 1) Kreditraten (Zins + Tilgung).
  let loanSettlementApplied = false;
  if (input.execute && !hasLoanSettlementLog(gameState, input.seasonId)) {
    const result = applyLoanSettlement(gameState, { execute: true, seasonId: input.seasonId });
    if (result.applied) {
      gameState = result.gameState;
      loanSettlementApplied = true;
    }
    // `LoanSettlementPreview` traegt keine Warnungen — der Schritt meldet nur, ob er gebucht hat.
  }

  // 2) Vorstandsziele (Prämien und Strafen).
  let objectiveRewardsApplied = false;
  if (input.execute && !hasObjectiveRewardLog(gameState, input.seasonId)) {
    const result = applyTeamSeasonObjectiveRewards(gameState, {
      saveId: input.saveId,
      seasonId: input.seasonId,
      execute: true,
    });
    if (result.applied) {
      gameState = result.gameState;
      objectiveRewardsApplied = true;
    }
    warnings.push(...(result.warnings ?? []));
  }

  // 3) Zahlungsunfähigkeit. LETZTER Cash-Schritt: nach Sponsor/Gehalt, Raten, Gebäude und Zielen
  // darf kein Team negatives Cash behalten. Statt das Cash auf 0 zu klemmen (das wäre Geldschöpfung)
  // nimmt jedes betroffene Team einen Notkredit über den Fehlbetrag auf — echte Restschuld im
  // bestehenden Kreditsystem, Cash danach 0.
  let emergencyLoans: Array<{ teamId: string; principal: number }> = [];
  if (input.execute) {
    const insolvency = applyInsolvencyBackstop({ gameState, saveId: input.saveId });
    if (insolvency.emergencyLoans.length > 0) {
      gameState = insolvency.gameState;
      emergencyLoans = insolvency.emergencyLoans;
    }
    warnings.push(...(insolvency.warnings ?? []));
  }

  return {
    gameState,
    loanSettlementApplied,
    objectiveRewardsApplied,
    emergencyLoans,
    warnings: Array.from(new Set(warnings)),
  };
}
