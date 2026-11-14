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
