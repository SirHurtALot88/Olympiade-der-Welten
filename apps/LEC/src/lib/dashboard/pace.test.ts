import { describe, expect, it } from "vitest";
import { weightedMonthlyPace } from "./pace";

const NOW = new Date("2026-11-12T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("weightedMonthlyPace", () => {
  it("gleichmaessiger Absatz ergibt ungefaehr den Jahresschnitt", () => {
    const sales = Array.from({ length: 365 }, (_, i) => ({ soldAt: daysAgo(i + 0.5), qty: 1 / 12 * 12 / 12 })); // 365 * (1/12) = 30,4 Stk
    // 30,4 Stk in 365 Tagen = 2,5 Stk/Monat
    expect(weightedMonthlyPace(sales, NOW)).toBeCloseTo(2.5, 0);
  });
  it("juengerer Absatz zaehlt mehr als aelterer", () => {
    const recent = weightedMonthlyPace([{ soldAt: daysAgo(10), qty: 5 }], NOW);
    const old = weightedMonthlyPace([{ soldAt: daysAgo(300), qty: 5 }], NOW);
    expect(recent).toBeGreaterThan(old * 2);
  });
  it("Mengen zaehlen: 3 Stueck in einem Verkauf wie 3 einzelne", () => {
    const one = weightedMonthlyPace([{ soldAt: daysAgo(40), qty: 3 }], NOW);
    const three = weightedMonthlyPace([1, 2, 3].map(() => ({ soldAt: daysAgo(40), qty: 1 })), NOW);
    expect(one).toBeCloseTo(three, 6);
  });
  it("ohne Verkaeufe oder ausserhalb des Zeitraums: 0", () => {
    expect(weightedMonthlyPace([], NOW)).toBe(0);
    expect(weightedMonthlyPace([{ soldAt: daysAgo(500), qty: 4 }], NOW)).toBe(0);
  });
});
