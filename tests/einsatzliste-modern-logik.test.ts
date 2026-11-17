import { describe, expect, it } from "vitest";

import {
  bauePruefsaetze,
  berechneVerteilung,
  gewichtsZeilen,
  lastTon,
  setzeMitTausch,
} from "@/lib/lineups/einsatzliste-modern-logik";

const slots = [
  { key: "d1-0", side: "d1" as const },
  { key: "d1-1", side: "d1" as const },
  { key: "d2-0", side: "d2" as const },
];
const werte = [
  ["a", [{ slotKey: "d1-0", projectedScore: 90 }, { slotKey: "d1-1", projectedScore: 80 }, { slotKey: "d2-0", projectedScore: 85 }]],
  ["b", [{ slotKey: "d1-0", projectedScore: 70 }, { slotKey: "d1-1", projectedScore: 75 }, { slotKey: "d2-0", projectedScore: 60 }]],
  ["c", [{ slotKey: "d1-0", projectedScore: 50 }, { slotKey: "d1-1", projectedScore: 55 }, { slotKey: "d2-0", projectedScore: 65 }]],
  ["v", [{ slotKey: "d1-0", projectedScore: 99 }, { slotKey: "d1-1", projectedScore: 99 }, { slotKey: "d2-0", projectedScore: 99 }]],
] as const;

describe("Verteilung (Optimieren/Auffüllen)", () => {
  it("setzt jeden Spieler höchstens einmal und lässt Verletzte aus", () => {
    const v = berechneVerteilung({ modus: "optimieren", slots, selections: {}, werte, ausgeschlossen: new Set(["v"]) });
    const ids = Object.values(v.neu).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("v");
    expect(v.neu["d1-0"]).toBe("a");
    expect(v.neu["d1-1"]).toBe("b");
    expect(v.neu["d2-0"]).toBe("c");
  });

  it("Auffüllen lässt Gesetztes stehen und nimmt nur freie Spieler", () => {
    const v = berechneVerteilung({ modus: "auffuellen", slots, selections: { "d1-0": "c" }, werte, ausgeschlossen: new Set(["v"]) });
    expect(v.neu["d1-0"]).toBe("c");
    expect(v.neu["d1-1"]).toBe("b");
    expect(v.neu["d2-0"]).toBe("a");
    expect(v.wechsel.map((w) => w.slotKey).sort()).toEqual(["d1-1", "d2-0"]);
  });

  it("Captain bleibt auf seiner Seite", () => {
    const v = berechneVerteilung({
      modus: "optimieren",
      slots,
      selections: {},
      werte,
      ausgeschlossen: new Set(["v"]),
      captainSeite: new Map([["a", "d1" as const]]),
    });
    expect(v.neu["d2-0"]).not.toBe("a");
  });

  it("Optimieren meldet einen Gewinn gegenüber der Handbesetzung", () => {
    const v = berechneVerteilung({ modus: "optimieren", slots, selections: { "d1-0": "c", "d1-1": "b", "d2-0": "a" }, werte, ausgeschlossen: new Set(["v"]) });
    expect(v.gewinn).toBeGreaterThan(0);
  });
});

describe("Einweg-Iteratoren", () => {
  it("verträgt Map.entries() als Eingabe (wird zweimal gelesen)", () => {
    const karte = new Map(werte.map(([id, e]) => [id, e] as const));
    const v = berechneVerteilung({ modus: "optimieren", slots, selections: {}, werte: karte.entries(), ausgeschlossen: new Set(["v"]) });
    expect(Object.values(v.neu).filter(Boolean)).toHaveLength(3);
  });
});

describe("setzeMitTausch", () => {
  it("zieht den Spieler vom alten Platz ab und tauscht den Verdrängten dorthin", () => {
    expect(setzeMitTausch({ "d1-0": "a", "d1-1": "b" }, "d1-1", "a")).toEqual({ "d1-0": "b", "d1-1": "a" });
  });
  it("ohne alten Platz wird nur ersetzt", () => {
    expect(setzeMitTausch({ "d1-0": "a" }, "d1-0", "c")).toEqual({ "d1-0": "c" });
  });
});

describe("Prüfung in Sätzen", () => {
  const basis = {
    slots: [{ key: "d1-0" }, { key: "d1-1" }],
    slotName: (k: string) => k,
    playerName: (id: string) => `Spieler ${id}`,
    fehlerCodes: [] as string[],
  };
  it("offene Plätze sind ein Fehler mit Sprung, der Captain-Hinweis nicht", () => {
    const s = bauePruefsaetze({
      ...basis,
      finishItems: [
        { key: "open-slots", label: "Slots", detail: "1 offen", tone: "blocked" },
        { key: "captain", label: "Captain", detail: "Optional", tone: "warning" },
      ],
      slotIssues: new Map(),
      selections: { "d1-0": "a" },
    });
    expect(s[0]).toMatchObject({ ton: "fehler", slotKey: "d1-1" });
    expect(s.find((x) => x.id === "captain")?.ton).toBe("hinweis");
  });
  it("Verletzter wird zum Fehler, rohe Codes werden übersetzt", () => {
    const s = bauePruefsaetze({
      ...basis,
      finishItems: [],
      slotIssues: new Map([["d1-0", [{ label: "Verletzt", detail: "x", tone: "blocked" }]]]),
      selections: { "d1-0": "a", "d1-1": "b" },
      fehlerCodes: ["lineup_not_operationally_ready"],
    });
    expect(s.filter((x) => x.ton === "fehler")).toHaveLength(2);
    expect(s.some((x) => x.satz.includes("abgabebereit"))).toBe(true);
  });
  it("ohne Befund steht ein Ok-Satz da", () => {
    const s = bauePruefsaetze({ ...basis, finishItems: [], slotIssues: new Map(), selections: {} });
    expect(s).toHaveLength(1);
    expect(s[0]!.ton).toBe("ok");
  });
});

describe("Rollenkarte", () => {
  it("sortiert nach Gewicht, Rollen-Attribute bekommen nur ein Abzeichen", () => {
    const z = gewichtsZeilen(
      [
        { attributeKey: "speed", weightPct: 5 },
        { attributeKey: "will", weightPct: 20 },
        { attributeKey: "power", weightPct: 12 },
        { attributeKey: "health", weightPct: 0 },
      ],
      { majorPositiveAttribute: "speed", minorPositiveAttribute: "power" },
    );
    expect(z.map((x) => x.attribut)).toEqual(["will", "power", "speed"]);
    expect(z.map((x) => x.rolle)).toEqual([null, "nebenfokus", "schwerpunkt"]);
  });
  it("Last-Ton", () => {
    expect([lastTon(10), lastTon(50), lastTon(80), lastTon(null)]).toEqual(["gut", "mittel", "hoch", "gut"]);
  });
});
