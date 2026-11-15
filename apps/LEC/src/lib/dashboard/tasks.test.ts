import { describe, expect, it } from "vitest";
import { isTaskKey, matchesTask, taskCounts } from "./tasks";

const base = { articleId: "a", active: true, hidden: false, stock: 2, reorderDue: false, market: null, lifecycle: null, delistMarkedAt: null, ebayEndedAt: null, codeName: null } as const;
const none = new Set<string>();

describe("matchesTask", () => {
  it("Nachbestellen: nur faellige", () => {
    expect(matchesTask("nachbestellen", { ...base, reorderDue: true, stock: 0 }, none)).toBe(true);
    expect(matchesTask("nachbestellen", base, none)).toBe(false);
  });
  it("Preis aendern: zu guenstig oder zu teuer mit Urteil und Bestand, nicht im Korridor", () => {
    const m = (status: string, rated = true) => ({ rated, status }) as never;
    expect(matchesTask("preis", { ...base, market: m("zu_guenstig") }, none)).toBe(true);
    expect(matchesTask("preis", { ...base, market: m("zu_teuer") }, none)).toBe(true);
    expect(matchesTask("preis", { ...base, market: m("im_korridor") }, none)).toBe(false);
    expect(matchesTask("preis", { ...base, market: m("zu_teuer", false) }, none)).toBe(false);
    expect(matchesTask("preis", { ...base, stock: 0, market: m("zu_teuer") }, none)).toBe(false);
  });
  it("Auslisten: Massnahme mit Bestand; Markiert; Aufraeumen aus drei Gruenden", () => {
    expect(matchesTask("auslisten", { ...base, lifecycle: "auslisten" as never }, none)).toBe(true);
    expect(matchesTask("auslisten", { ...base, stock: 0, lifecycle: "auslisten" as never }, none)).toBe(false);
    expect(matchesTask("markiert", { ...base, delistMarkedAt: "2026-11-01" }, none)).toBe(true);
    expect(matchesTask("aufraeumen", { ...base, ebayEndedAt: "2026-11-01" }, none)).toBe(true);
    expect(matchesTask("aufraeumen", base, new Set(["a"]))).toBe(true);
    expect(matchesTask("aufraeumen", { ...base, codeName: { mismatch: true } as never }, none)).toBe(true);
    expect(matchesTask("aufraeumen", base, none)).toBe(false);
  });
  it("Ausgeblendete zaehlen nie", () => {
    expect(matchesTask("nachbestellen", { ...base, hidden: true, reorderDue: true }, none)).toBe(false);
  });
});

describe("Daten pruefen", () => {
  const w = (qty: number) => ({ "365": { qty } }) as never;
  it("EK fehlt bei Bestand oder Verkauf; Verlust trotz 3 Verkaeufen; EK ueber 150 % vom Marktwert", () => {
    expect(matchesTask("daten", { ...base, ekMissing: true }, none)).toBe(true);
    expect(matchesTask("daten", { ...base, ekMissing: true, stock: 0 }, none)).toBe(false);
    expect(matchesTask("daten", { ...base, ekMissing: true, stock: 0, windows: w(2) }, none)).toBe(true);
    expect(matchesTask("daten", { ...base, ekMissing: false, windows: w(3), dbIIPercent: -0.1 }, none)).toBe(true);
    expect(matchesTask("daten", { ...base, ekMissing: false, windows: w(2), dbIIPercent: -0.1 }, none)).toBe(false);
    expect(matchesTask("daten", { ...base, ekMissing: false, ek: 16, market: { value: 10 } as never }, none)).toBe(true);
    expect(matchesTask("daten", { ...base, ekMissing: false, ek: 14, market: { value: 10 } as never }, none)).toBe(false);
  });
  it("Aufraeumen hat Vorrang vor Daten pruefen", () => {
    expect(matchesTask("daten", { ...base, ekMissing: true, ebayEndedAt: "2026-11-01" }, none)).toBe(false);
    expect(matchesTask("aufraeumen", { ...base, ekMissing: true, ebayEndedAt: "2026-11-01" }, none)).toBe(true);
  });
});

describe("taskCounts und isTaskKey", () => {
  it("zaehlt je Aufgabe", () => {
    const c = taskCounts([base, { ...base, articleId: "b", reorderDue: true }, { ...base, articleId: "c", hidden: true, reorderDue: true }], none);
    expect(c.alle).toBe(2);
    expect(c.nachbestellen).toBe(1);
  });
  it("kennt die Schluessel", () => {
    expect(isTaskKey("preis")).toBe(true);
    expect(isTaskKey("x")).toBe(false);
    expect(isTaskKey(null)).toBe(false);
  });
});
