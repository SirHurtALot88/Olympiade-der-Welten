import { afterEach, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  entwicklungNeuFuer,
  entwicklungsRegelFuer,
  entwicklungsRegelFuerSpielmodus,
  stempleEntwicklungsRegelBeimAnlegen,
  stempleEntwicklungsRegelNachLaden,
} from "@/lib/resolve/entwicklung-regel";
import {
  ENTWICKLUNGS_PARAMETER_STANDARD,
  entwicklungsKurve,
  entwicklungsKurvenSkala,
  ertragsFaktor,
  fokusFaktor,
  trainingsAnkommFaktor,
  verfallSumme,
} from "@/lib/training/entwicklung-neu";
import { applyAttributeCeilingSeasonDrift } from "@/lib/scouting/player-attribute-ceiling-service";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";

afterEach(() => {
  delete process.env.OLY_ENTWICKLUNG;
});

const neuesSpiel = () =>
  ({ scenarioMeta: { gameMode: "battle" }, season: { id: "season-1" }, seasonState: { seasonId: "season-1" } }) as unknown as GameState;

describe("Entwicklungsregel: Stempel im Spielstand", () => {
  it("ohne Stempel, mit fremdem Stempel und mit alt gilt die alte Regel", () => {
    expect(entwicklungsRegelFuer(undefined)).toBe("alt");
    expect(entwicklungsRegelFuer({ seasonState: { seasonId: "season-1" } })).toBe("alt");
    expect(
      entwicklungsRegelFuer({ seasonState: { seasonId: "season-2", entwicklungsRegel: { seasonId: "season-1", regel: "neu" } } }),
    ).toBe("alt");
    expect(entwicklungNeuFuer({ seasonState: { seasonId: "s", entwicklungsRegel: { seasonId: "s", regel: "alt" } } })).toBe(false);
  });

  it("neues Spiel: neu ab Saison 1, idempotent; die Prozessvariable wirkt nur beim Stempeln", () => {
    const gs = stempleEntwicklungsRegelBeimAnlegen(neuesSpiel());
    expect(gs.seasonState.entwicklungsRegel).toEqual({ seasonId: "season-1", regel: "neu" });
    expect(stempleEntwicklungsRegelBeimAnlegen(gs)).toBe(gs);
    process.env.OLY_ENTWICKLUNG = "alt";
    expect(entwicklungNeuFuer(gs)).toBe(true);
    expect(entwicklungsRegelFuerSpielmodus(neuesSpiel(), "season-2")).toEqual({ seasonId: "season-2", regel: "alt" });
  });

  it("Manager-Spielstand bekommt keinen Stempel", () => {
    const manager = { scenarioMeta: { gameMode: "manager" }, season: { id: "season-1" }, seasonState: { seasonId: "season-1" } } as unknown as GameState;
    expect(stempleEntwicklungsRegelBeimAnlegen(manager)).toBe(manager);
    expect(entwicklungsRegelFuerSpielmodus(manager, "season-2")).toBeUndefined();
  });

  it("bestehender Spielstand: Lade-Migration schreibt alt fest, der Saisonwechsel bringt neu", () => {
    const geladen = stempleEntwicklungsRegelNachLaden(neuesSpiel());
    expect(geladen.seasonState.entwicklungsRegel).toEqual({ seasonId: "season-1", regel: "alt" });
    expect(stempleEntwicklungsRegelNachLaden(geladen)).toBe(geladen);
    const wechsel = {
      ...geladen,
      season: { id: "season-2" },
      seasonState: { ...geladen.seasonState, seasonId: "season-2", entwicklungsRegel: entwicklungsRegelFuerSpielmodus(geladen, "season-2") },
    } as GameState;
    expect(entwicklungsRegelFuer(geladen)).toBe("alt");
    expect(entwicklungsRegelFuer(wechsel)).toBe("neu");
  });
});

describe("Entwicklung neu: Bausteine", () => {
  it("Ertragskurve: je naeher an der Decke, desto schwerer, stetig und nie ueber 1", () => {
    expect(ertragsFaktor(null)).toBe(1);
    expect(ertragsFaktor(12)).toBe(1);
    expect(ertragsFaktor(0)).toBe(0.05);
    let letzter = 0;
    for (let h = 0; h <= 12; h += 0.5) {
      const e = ertragsFaktor(h);
      expect(e).toBeGreaterThanOrEqual(letzter);
      expect(e).toBeLessThanOrEqual(1);
      letzter = e;
    }
    // Anschluss an den alten Zustandsschritt "closing" (0,45 bei 5 Punkten Abstand).
    expect(ertragsFaktor(5)).toBeGreaterThan(0.4);
    expect(ertragsFaktor(5)).toBeLessThan(0.55);
  });

  it("Ankomm-Faktor: gut die Haelfte ohne Einsaetze, 1,0 in der Mitte, 1,4 an der Spitze", () => {
    const p = ENTWICKLUNGS_PARAMETER_STANDARD;
    expect(trainingsAnkommFaktor(0, 1, p)).toBeCloseTo(0.6, 5);
    expect(trainingsAnkommFaktor(20, 0.5, p)).toBeCloseTo(1.0, 5);
    expect(trainingsAnkommFaktor(20, 1, p)).toBeCloseTo(1.4, 5);
    expect(trainingsAnkommFaktor(20, 0, p)).toBeCloseTo(0.6, 5);
  });

  it("Verfall nur nach Ausfalltagen, nie negativ", () => {
    const p = { ...ENTWICKLUNGS_PARAMETER_STANDARD, verfallJeAusfalltag: 0.25 };
    expect(verfallSumme(0, p)).toBe(0);
    expect(verfallSumme(4, p)).toBeCloseTo(1, 5);
    expect(verfallSumme(-3, p)).toBe(0);
  });

  it("Entwicklungskurve: Vorzeichen bleibt, kleine Summen werden gedaempft, grosse verstaerkt, Deckel haelt", () => {
    const p = ENTWICKLUNGS_PARAMETER_STANDARD;
    expect(entwicklungsKurve(0, p)).toBe(0);
    expect(Math.abs(entwicklungsKurve(2, p))).toBeLessThan(2);
    expect(Math.abs(entwicklungsKurve(10, p))).toBeGreaterThan(10);
    expect(entwicklungsKurve(-10, p)).toBeCloseTo(-entwicklungsKurve(10, p), 8);
    expect(entwicklungsKurve(500, p)).toBe(p.kurveMax);
    expect(entwicklungsKurvenSkala(3, p)).toBeGreaterThan(0);
    expect(entwicklungsKurvenSkala(0, p)).toBe(1);
  });

  it("Fokus-Faktor: Ziel gehalten gibt mehr, dauernd gewechselt weniger", () => {
    const p = ENTWICKLUNGS_PARAMETER_STANDARD;
    expect(fokusFaktor(1, p)).toBeCloseTo(1 + p.fokusStaerke, 8);
    expect(fokusFaktor(0.2, p)).toBeCloseTo(1 - p.fokusStaerke, 8);
    expect(fokusFaktor(0.7, p)).toBeGreaterThan(fokusFaktor(0.5, p));
  });
});

describe("Entwicklung neu: Potentialdrift verschiebt den Mittelwert nicht", () => {
  const decken = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((a) => [a, 60]));
  const mittel = (outlook: "breakout" | "growth" | "stable" | "stagnation" | "regression_risk", neu: boolean) => {
    let summe = 0;
    let n = 0;
    for (let i = 0; i < 400; i += 1) {
      const d = applyAttributeCeilingSeasonDrift({ attributeCeilings: decken, saveId: "s", playerId: `p${i}`, seasonId: "season-1", growthOutlook: outlook, entwicklungNeu: neu });
      for (const a of PROGRESSION_ATTRIBUTE_ORDER) { summe += (d[a] ?? 60) - 60; n += 1; }
    }
    return summe / n;
  };

  it("alt: breakout drueckt jede Decke hoch (Mittel deutlich ueber 0), neu: nur eine Verschiebung der Wahrscheinlichkeit", () => {
    expect(mittel("breakout", false)).toBeGreaterThan(1.2);
    expect(mittel("breakout", true)).toBeLessThan(0.7);
    expect(mittel("regression_risk", true)).toBeGreaterThan(-0.7);
    expect(Math.abs(mittel("stable", true))).toBeLessThan(0.25);
  });

  it("neu bleibt in den Schritten -2, 0, +2", () => {
    const d = applyAttributeCeilingSeasonDrift({ attributeCeilings: decken, saveId: "s", playerId: "p1", seasonId: "season-1", growthOutlook: "growth", entwicklungNeu: true });
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) expect([-2, 0, 2]).toContain((d[a] ?? 60) - 60);
  });
});
