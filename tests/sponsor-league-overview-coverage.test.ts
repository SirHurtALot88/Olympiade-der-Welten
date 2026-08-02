import { describe, expect, it } from "vitest";

import { computeSponsorCostCoverage, getSponsorCoverageTone } from "@/lib/sponsor/sponsor-offer-presenter";

/**
 * Liga-Sponsorenübersicht: Deckungsgrad neben dem Betrag.
 *
 * Die Liste zeigte bisher nur die voraussichtliche Auszahlung. Am gespielten Spielstand gemessen
 * sagt dieser Betrag allein nichts darüber, ob ein Team davon leben kann — die Kader kosten
 * zwischen 37,8 und 84,4. Erst das Verhältnis zu den Fixkosten ist über alle 32 Zeilen vergleichbar.
 */
describe("sponsor cost coverage", () => {
  it("sets the coverage relative to salaries plus upkeep", () => {
    // 90 auf 84,4 Gehalt + 5,6 Unterhalt: die Fixkosten sind genau gedeckt, nicht 107 %.
    expect(computeSponsorCostCoverage(90, 84.4 + 5.6)).toBeCloseTo(1, 5);
  });

  it("has no coverage without a contract or without costs", () => {
    expect(computeSponsorCostCoverage(null, 64.4)).toBeNull();
    // Ein Team ohne Fixkosten hat nichts zu decken — eine Prozentzahl wäre hier erfunden.
    expect(computeSponsorCostCoverage(50, 0)).toBeNull();
    expect(computeSponsorCostCoverage(50, Number.NaN)).toBeNull();
  });

  it("keeps a sponsor that does not cover its own costs out of the green tone", () => {
    // 0,999 ist noch keine Deckung: die Grenze liegt exakt bei 100 %, sonst liest sich ein Team,
    // das jede Saison Substanz verliert, wie ein gesundes.
    expect(getSponsorCoverageTone(0.999)).toBe("warn");
    expect(getSponsorCoverageTone(1)).toBe("good");
    expect(getSponsorCoverageTone(1.27)).toBe("good");
  });

  it("marks a gap that prize money cannot close as bad", () => {
    expect(getSponsorCoverageTone(0.85)).toBe("warn");
    expect(getSponsorCoverageTone(0.8499)).toBe("bad");
    expect(getSponsorCoverageTone(0.42)).toBe("bad");
  });
});
