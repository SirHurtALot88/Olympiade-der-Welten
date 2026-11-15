import { describe, expect, it } from "vitest";
import { ageDaysOf, capitalByAge, groupOfDays } from "./kapitalAlter";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const row = (id: string, o: Record<string, unknown> = {}) =>
  ({ articleId: id, active: true, hidden: false, stock: 2, lastSoldAt: daysAgo(10), listedDays: null, ekMissing: false, today: { capitalBound: 10 }, ...o }) as never;

describe("groupOfDays / ageDaysOf", () => {
  it("teilt nach 90 / 180 / 365 Tagen", () => {
    expect([0, 90, 91, 180, 181, 365, 366].map(groupOfDays)).toEqual(["frisch", "frisch", "ruhig", "ruhig", "langsam", "langsam", "ladenhueter"]);
  });
  it("Alter = Tage seit letztem Verkauf, sonst geschaetztes Angebotsalter, sonst unbekannt", () => {
    expect(ageDaysOf({ lastSoldAt: daysAgo(40), listedDays: 999 }, NOW)).toBe(40);
    expect(ageDaysOf({ lastSoldAt: null, listedDays: 400 }, NOW)).toBe(400);
    expect(ageDaysOf({ lastSoldAt: null, listedDays: null }, NOW)).toBeNull();
  });
});

describe("capitalByAge", () => {
  it("summiert Kapital je Altersgruppe, zaehlt Artikel ohne EK und ohne Alter separat", () => {
    const r = capitalByAge(
      [
        row("a", { lastSoldAt: daysAgo(10), today: { capitalBound: 10 } }),
        row("b", { lastSoldAt: daysAgo(200), today: { capitalBound: 20 } }),
        row("c", { lastSoldAt: daysAgo(500), today: { capitalBound: 30 } }),
        row("d", { lastSoldAt: null, listedDays: 700, today: { capitalBound: 5 } }),
        row("e", { ekMissing: true, today: { capitalBound: null } }),
        row("f", { lastSoldAt: null, listedDays: null, today: { capitalBound: 7 } }),
        row("g", { stock: 0 }),
        row("h", { hidden: true }),
        row("i", { active: false }),
      ],
      NOW
    );
    const cap = (k: string) => r.groups.find((g) => g.key === k)!.capital;
    expect(cap("frisch")).toBe(10);
    expect(cap("langsam")).toBe(20);
    expect(cap("ladenhueter")).toBe(35);
    expect(r.groups.find((g) => g.key === "ladenhueter")!.articles).toBe(2);
    expect(r.total).toBe(65);
    expect(r.withoutEk).toBe(1);
    expect(r.unknownAge).toEqual({ articles: 1, capital: 7 });
    expect(r.items[0].articleId).toBe("c"); // groesstes Kapital zuerst
  });
});
