import { describe, expect, it } from "vitest";
import { assessReorder, type ReorderInput } from "./reorder";

const NOW = new Date("2026-11-13T10:00:00Z");
const base: ReorderInput = { active: true, stock: 0, minStock: null, desiredStock: null, units365: 3, unitsAll: 5, coverMonths: null, unitProfit: 1.5, snoozeUntil: null, now: NOW };

describe("assessReorder", () => {
  it("Mindestbestand aus Billbee: immer faellig, mit Fehlmenge bis zum Soll", () => {
    expect(assessReorder({ ...base, stock: 2, minStock: 2, desiredStock: 6, units365: 0, unitsAll: 0 })).toMatchObject({ due: true, reason: "mindestbestand", qty: 4 });
  });
  it("rechnerisch: ausverkauft mit mindestens 2 Verkaeufen im Jahr", () => {
    expect(assessReorder(base)).toMatchObject({ due: true, reason: "ausverkauft" });
  });
  it("rechnerisch: Reichweite knapp, aber nicht zu knapp ist nicht faellig", () => {
    expect(assessReorder({ ...base, stock: 2, coverMonths: 1.2 })).toMatchObject({ due: true, reason: "reichweite" });
    expect(assessReorder({ ...base, stock: 2, coverMonths: 3 }).due).toBe(false);
  });
  it("kleiner Artikel mit nur einem Verkauf im Jahr: nicht vorgeschlagen, mit Begruendung", () => {
    const r = assessReorder({ ...base, units365: 1, unitProfit: 1.4 });
    expect(r.due).toBe(false);
    expect(r.skipReason).toContain("1 Verkauf im Jahr");
  });
  it("teurer Artikel mit einem Verkauf im Jahr und gutem Gewinn: faellig", () => {
    expect(assessReorder({ ...base, units365: 1, unitProfit: 12 }).due).toBe(true);
  });
  it("nie verkauft, ausgelaufen: nicht faellig, ohne Begruendung", () => {
    expect(assessReorder({ ...base, units365: 0, unitsAll: 0 })).toMatchObject({ due: false, skipReason: null });
    expect(assessReorder({ ...base, active: false }).due).toBe(false);
  });
  it("zurueckgestellt: bis zum Datum nicht faellig, danach wieder", () => {
    const until = new Date("2027-02-01T00:00:00Z");
    expect(assessReorder({ ...base, snoozeUntil: until })).toMatchObject({ due: false, snoozedUntil: until.toISOString() });
    expect(assessReorder({ ...base, snoozeUntil: new Date("2026-11-01T00:00:00Z") }).due).toBe(true);
  });
});

describe("Bestellmenge", () => {
  const base = { active: true, stock: 1, minStock: 1, desiredStock: null, units365: 10, unitsAll: 10, coverMonths: 1.2, unitProfit: 5, snoozeUntil: null, now: new Date("2026-11-13") };
  it("ohne Soll aus Verkaufstempo (3 Monate)", () => {
    expect(assessReorder({ ...base, paceMonth: 1 }).qty).toBe(2);
    expect(assessReorder({ ...base, paceMonth: 2 }).qty).toBe(5);
  });
  it("mindestens eine Stueck ueber Mindestbestand", () => {
    expect(assessReorder({ ...base, paceMonth: 0 }).qty).toBe(1);
  });
});
