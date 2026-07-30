import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CASH_PRIZE_BENCHMARK_ONLY } from "@/lib/season/cash-prize-benchmark-flag";
import { buildSeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * GEMELDET: „ich habe den button gedrückt vom saisonübergang! Aber er hat nicht
 * funktioniert" — daneben unveraenderte Cash-Zahlen, waehrend der Schritt
 * „Preisgeld & Sponsoren buchen" als erledigt gemeldet wurde mit dem Satz
 * „Ist gebucht — das Geld steht auf dem Konto."
 *
 * Der Knopf hatte funktioniert. Sein Text war falsch.
 *
 * `executeCashPrizeApply` ist laut `cash-prize-benchmark-flag.ts` ein Benchmark-
 * Endpunkt: solange `CASH_PRIZE_BENCHMARK_ONLY` gilt, wird ausschliesslich der
 * Preisgeld-/Sponsor-Benchmark samt Audit-Log persistiert — `writeLocalCashPrizeApply`
 * setzt `nextTeams = save.gameState.teams`, also unveraendert.
 *
 * Im Spielstand des Melders (Spieltag 10, `season_completed`) steht es im Log selbst:
 *
 *   totalPrizeMoney: 2365.1
 *   benchmarkOnly:   true
 *   cashPayoutApplied: false
 *
 * Das echte Geld bucht `runLocalSeasonCompletion` beim Saisonwechsel (Sponsor-
 * Settlement, Gebaeude-Abrechnung, Kreditrate).
 */
describe("Saisonabschluss: der Preisgeld-Schritt behauptet keine Buchung mehr", () => {
  const PANEL = read("app/foundation/season-v2/FoundationSeasonFinalePanel.tsx");

  it("faellt zurueck auf die Wahrheit ueber dasselbe Flag, das die Buchung steuert", () => {
    // Nicht als Text kopiert, sondern am Flag entschieden — sonst laeuft die Aussage
    // auseinander, sobald der Payout wirklich eingeschaltet wird.
    expect(PANEL).toContain('from "@/lib/season/cash-prize-benchmark-flag"');
    expect(PANEL).toContain("CASH_PRIZE_BENCHMARK_ONLY ? \"Preisgeld & Sponsoren berechnen\"");
  });

  it("sagt im Benchmark-Betrieb NICHT, dass das Geld auf dem Konto steht", () => {
    // Der Satz darf nur noch im Nicht-Benchmark-Zweig stehen.
    const claim = "Ist gebucht — das Geld steht auf dem Konto.";
    const claimIndex = PANEL.indexOf(claim);
    expect(claimIndex).toBeGreaterThan(-1);
    // Direkt davor muss der Benchmark-Zweig bereits abgezweigt sein.
    const before = PANEL.slice(Math.max(0, claimIndex - 900), claimIndex);
    expect(before).toContain("CASH_PRIZE_BENCHMARK_ONLY");
    expect(before).toContain("hier fliesst noch kein Geld");
  });

  it("zeigt, WO das Geld stattdessen gebucht wird", () => {
    expect(PANEL).toContain("Gutgeschrieben wird beim Saisonwechsel");
    // Und der Saisonwechsel-Schritt nennt es ebenfalls, statt es nur zu implizieren.
    expect(PANEL).toContain("bucht Sponsoren, Gebäude und Kreditrate aufs Konto");
  });

  /**
   * Der Zustand kam aus der falschen Frage: `prizeApplied` prueft nur, OB ein Log
   * existiert — nicht, ob Geld geflossen ist. Das bleibt so (der Schritt IST
   * erledigt), aber die Beschriftung darf daraus keine Buchung machen.
   */
  it("behaelt den Erledigt-Zustand — nur die Aussage aendert sich", () => {
    expect(PANEL).toContain('state: prizeApplied ? "done" : busy ? "busy" : "ready",');
  });
});

describe("Saison-Checkliste: dieselbe Aussage, dieselbe Quelle", () => {
  function seasonEndGameState(withPrizeLog: boolean) {
    return {
      season: { id: "season-1" },
      gamePhase: "season_completed",
      matchdayState: { matchdayId: "matchday-10" },
      teams: [{ teamId: "C-C" }],
      rosters: [],
      players: [],
      playerProgressionEvents: [],
      seasonState: {
        cashPrizeApplyLogs: withPrizeLog
          ? [{ seasonId: "season-1", payload: { benchmarkOnly: true, cashPayoutApplied: false } }]
          : [],
        lineupDrafts: [],
      },
    } as never;
  }

  it("nennt den Schritt im Benchmark-Betrieb 'berechnet', nicht 'gebucht'", () => {
    const checklist = buildSeasonReadinessChecklist({ gameState: seasonEndGameState(true), teamId: "C-C" });
    const prize = checklist.items.find((item) => item.id === "prize");
    expect(prize).toBeTruthy();
    if (CASH_PRIZE_BENCHMARK_ONLY) {
      expect(prize!.label).toBe("Preisgeld berechnet");
      expect(prize!.detail).toContain("gutgeschrieben wird beim Saisonwechsel");
      expect(prize!.detail).not.toContain("angewendet");
    } else {
      expect(prize!.label).toBe("Preisgeld gebucht");
    }
  });

  it("laesst den offenen Zustand unveraendert", () => {
    const checklist = buildSeasonReadinessChecklist({ gameState: seasonEndGameState(false), teamId: "C-C" });
    const prize = checklist.items.find((item) => item.id === "prize");
    expect(prize!.status).toBe("open");
    expect(prize!.detail).toBe("Preisgeld noch offen.");
  });
});

/**
 * Der Kern des Ganzen: das Flag und der Schreibpfad muessen zusammenpassen. Faellt das
 * auseinander, meldet die Oberflaeche wieder etwas, das im Audit-Log widerlegt wird.
 */
describe("Preisgeld-Buchung: Flag und Schreibpfad sagen dasselbe", () => {
  it("schreibt den Benchmark-Zustand in genau der Form ins Log, die das Flag vorgibt", () => {
    const service = read("lib/season/cash-prize-apply-service.ts");
    expect(service).toContain("benchmarkOnly: CASH_PRIZE_BENCHMARK_ONLY,");
    expect(service).toContain("cashPayoutApplied: !CASH_PRIZE_BENCHMARK_ONLY,");
  });

  it("laesst Team-Cash im Benchmark-Betrieb nachweislich unangetastet", () => {
    const service = read("lib/season/cash-prize-apply-service.ts");
    // `nextTeams` ist unveraendert der bestehende Kader-/Team-Stand — genau deshalb
    // bewegt sich kein Cash. Aendert sich das, muss auch die Beschriftung mitziehen.
    expect(service).toContain("const nextTeams = save.gameState.teams;");
  });
});
