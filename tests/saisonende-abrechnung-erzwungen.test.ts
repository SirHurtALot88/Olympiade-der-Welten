/**
 * GEMELDET VON CHRIS: „natürlich muss die auszahlung und das ganze cash thema erzwungen sein ohne
 * das kommt man nicht in die neue season!"
 *
 * BEFUND: Der Schritt „Finanzen" (`season_rewards`) der Saisonende-Kette hat nur die Phase
 * weitergeschaltet. Die eigentliche Buchung — Preisgeld, Sponsorgeld, Facility-Unterhalt, Apron —
 * läuft über einen eigenen, bestätigten Weg (`cash-prize-apply-service` /
 * `season-completion-service`) und war damit schlicht überspringbar. Ein Klick weiter, und die
 * Kette lief bis in die neue Saison, ohne dass je Geld geflossen wäre.
 *
 * Die Folgen standen an zwei Stellen: In der Saisonbilanz fehlten Sponsoreinnahme und
 * Gehaltsabzug, und der eingefrorene Kontostand (`cashSeasonEnd`, festgeschrieben direkt vor den
 * Verkäufen) hielt einen Stand fest, den es so nie gab.
 *
 * Der Riegel sitzt auf `season_rewards` und NICHT erst vor der Verkaufsphase: der Freeze der
 * Saisonwerte hängt am Ende von `player_development`, also eine Station dahinter. Ein späterer
 * Riegel käme zu spät.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { isSeasonEndCashSettlementPending } from "@/lib/season/season-transition-service";

const root = process.cwd();
const transitionService = readFileSync(join(root, "lib/season/season-transition-service.ts"), "utf8");
const handlers = readFileSync(join(root, "lib/foundation/tabs/cockpit-handlers.ts"), "utf8");

function stateMit(input: {
  sponsorPayoutLogs?: GameState["seasonState"]["sponsorPayoutLogs"];
  cashPrizeApplyLogs?: GameState["seasonState"]["cashPrizeApplyLogs"];
}): GameState {
  return {
    season: { id: "season-3", name: "Season 3", year: 3, currentMatchday: 10, matchdayIds: [] },
    seasonState: {
      seasonId: "season-3",
      sponsorPayoutLogs: input.sponsorPayoutLogs ?? [],
      cashPrizeApplyLogs: input.cashPrizeApplyLogs ?? [],
    },
  } as unknown as GameState;
}

const sponsorLog = (seasonId: string, phase: "base_first" | "season_end") => ({
  id: `log-${seasonId}-${phase}`,
  saveId: "save-1",
  seasonId,
  teamId: "team-1",
  phase,
  componentId: null,
  cashDelta: 100,
  action: "apply" as const,
  createdAt: "2026-08-09T00:00:00.000Z",
});

describe("Saisonende-Abrechnung · wann sie als offen gilt", () => {
  it("ist offen, solange kein Geld geflossen ist", () => {
    expect(isSeasonEndCashSettlementPending(stateMit({}))).toBe(true);
  });

  it("ist erledigt, sobald ein season_end-Zahlungslog dieser Saison vorliegt", () => {
    expect(isSeasonEndCashSettlementPending(stateMit({ sponsorPayoutLogs: [sponsorLog("season-3", "season_end")] }))).toBe(
      false,
    );
  });

  it("zählt den Saisonbeginn-Payout NICHT als Saisonabschluss", () => {
    // Sponsoren zahlen auch zu Saisonbeginn (`base_first`). Das ist eine andere Buchung.
    expect(isSeasonEndCashSettlementPending(stateMit({ sponsorPayoutLogs: [sponsorLog("season-3", "base_first")] }))).toBe(
      true,
    );
  });

  it("zählt den Payout einer ANDEREN Saison nicht", () => {
    expect(isSeasonEndCashSettlementPending(stateMit({ sponsorPayoutLogs: [sponsorLog("season-2", "season_end")] }))).toBe(
      true,
    );
  });

  it("lässt ein reines Audit-Log NICHT durchgehen", () => {
    // Der Unterschied ist auf einem echten Spielstand schon einmal aufgetreten: das Audit-Log
    // stand, das Cash aller 32 Teams war unverändert. `pending_payout` ist nicht „bezahlt".
    const state = stateMit({
      cashPrizeApplyLogs: [{ id: "audit-1", seasonId: "season-3" } as never],
    });
    expect(isSeasonEndCashSettlementPending(state)).toBe(true);
  });
});

describe("Saisonende-Abrechnung · der Riegel sperrt wirklich", () => {
  it("blockiert den Schritt in der Vorschau", () => {
    expect(transitionService).toMatch(
      /stepId === "season_rewards" && cashSettlementPending[\s\S]{0,120}SEASON_REWARDS_PENDING_REASON/,
    );
  });

  it("blockiert auch das tatsächliche Weiterschalten, nicht nur den Knopf", () => {
    // DIE eigentliche Lücke einer naiven Fassung: `computeSeasonTransitionAdvance` liest die
    // Schritt-Blocker gar nicht — es prüft nur `canCompleteSeason`. Ein Riegel, der allein in
    // `buildStepPreviews` steht, gräbt den Knopf aus und lässt die Route trotzdem durch.
    expect(transitionService).toMatch(
      /if \(currentStep === "season_rewards" && isSeasonEndCashSettlementPending\(save\.gameState\)\) \{[\s\S]{0,400}status: "blocked"/,
    );
  });

  it("hängt vor der Spielerentwicklung, nicht erst vor den Verkäufen", () => {
    // Nach `player_development` friert der Saisonstand ein (`cashSeasonEnd`). Ein Riegel dahinter
    // würde einen Kontostand festschreiben, auf dem das Sponsorgeld noch fehlt.
    const steps = readFileSync(join(root, "lib/season/season-transition-steps.ts"), "utf8");
    const reihenfolge = steps.indexOf('"season_rewards"');
    expect(reihenfolge).toBeGreaterThan(-1);
    expect(steps.indexOf('"player_development"')).toBeGreaterThan(reihenfolge);
    expect(steps.indexOf('"transfer_sell_phase"')).toBeGreaterThan(steps.indexOf('"player_development"'));
  });

  it("sagt im Schritt-Text, was zu tun ist", () => {
    expect(transitionService).toContain("Erst die Saisonende-Abrechnung ausführen");
  });

  it("übersetzt den Blocker für die Oberfläche", () => {
    // Roh im Fehlerband stünde „season_end_cash_settlement_pending" — das sagt niemandem etwas.
    expect(handlers).toContain("season_end_cash_settlement_pending:");
    expect(handlers).toContain("Saisonende-Abrechnung ist noch offen");
    expect(handlers).toContain("uebersetzeUebergangsBlocker");
  });
});
