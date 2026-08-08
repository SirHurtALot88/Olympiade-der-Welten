import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { SeasonEconomyFactorRecord } from "@/lib/data/olyDataTypes";
import {
  buildSalaryFactorOutlook,
  deriveSalaryFactorOutlook,
} from "@/lib/foundation/finances/salary-factor-outlook";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";

const root = process.cwd();

function makeFactorRecord(input: { horizonIndex: number; factor: number; seasonId?: string }): SeasonEconomyFactorRecord {
  return {
    seasonId: input.seasonId ?? "season-1",
    seasonLabel: input.horizonIndex === 0 ? "Aktuell" : `Season +${input.horizonIndex}`,
    horizonIndex: input.horizonIndex,
    factor: input.factor,
    source: "rolled",
    rollSeed: null,
    carriedFromSeasonId: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveSalaryFactorOutlook (Kern-Ableitung Wert + Richtung)", () => {
  it("erkennt eine steigende Ökonomie (nächste Season teurer/reicher)", () => {
    const outlook = deriveSalaryFactorOutlook([1.0, 1.1, 0.9, 1.2, 0.85]);
    expect(outlook.currentFactor).toBe(1.0);
    expect(outlook.nextFactor).toBe(1.1);
    expect(outlook.direction).toBe("up");
    expect(outlook.delta).toBeCloseTo(0.1, 10);
  });

  it("erkennt eine fallende Ökonomie", () => {
    const outlook = deriveSalaryFactorOutlook([1.15, 0.9]);
    expect(outlook.direction).toBe("down");
    expect(outlook.delta).toBeCloseTo(-0.25, 10);
  });

  it("meldet 'flat' bei identischen Werten (alle Werte gleich)", () => {
    const outlook = deriveSalaryFactorOutlook([1.05, 1.05, 1.05, 1.05, 1.05]);
    expect(outlook.direction).toBe("flat");
    expect(outlook.delta).toBe(0);
  });

  it("verschluckt Float-Rauschen unterhalb der round2-Auflösung als 'flat'", () => {
    const outlook = deriveSalaryFactorOutlook([1.1, 1.1000000001]);
    expect(outlook.direction).toBe("flat");
    expect(outlook.delta).toBe(0);
  });

  it("zeigt bei einem einzigen Datenpunkt den Wert, aber KEINE Richtung", () => {
    const outlook = deriveSalaryFactorOutlook([1.05]);
    expect(outlook.currentFactor).toBe(1.05);
    expect(outlook.nextFactor).toBeNull();
    expect(outlook.direction).toBeNull();
    expect(outlook.delta).toBeNull();
  });

  it("liefert bei leerem Fenster überall null", () => {
    const outlook = deriveSalaryFactorOutlook([]);
    expect(outlook).toEqual({ currentFactor: null, nextFactor: null, direction: null, delta: null });
  });

  it("behandelt NaN/ungültige aktuelle Werte als fehlend (keine Richtung)", () => {
    const outlook = deriveSalaryFactorOutlook([Number.NaN, 1.1]);
    expect(outlook.currentFactor).toBeNull();
    expect(outlook.nextFactor).toBe(1.1);
    expect(outlook.direction).toBeNull();
    expect(outlook.delta).toBeNull();
  });

  it("ersetzt einen fehlenden +1-Horizont NICHT durch spätere Horizonte (positionsbezogen)", () => {
    const outlook = deriveSalaryFactorOutlook([1.05, null, 1.2]);
    expect(outlook.currentFactor).toBe(1.05);
    expect(outlook.nextFactor).toBeNull();
    expect(outlook.direction).toBeNull();
  });

  it("verwirft nicht-positive Faktoren als ungültig", () => {
    const outlook = deriveSalaryFactorOutlook([0, 1.1]);
    expect(outlook.currentFactor).toBeNull();
    expect(outlook.direction).toBeNull();
  });
});

describe("buildSalaryFactorOutlook (Verdrahtung auf das kanonische Season-Ökonomie-Fenster)", () => {
  it("liest ein persistiertes Fenster 1:1 (gleiche Wahrheit wie Briefing/KI)", () => {
    const seasonState = {
      seasonEconomyFactors: [
        makeFactorRecord({ horizonIndex: 0, factor: 1.09 }),
        makeFactorRecord({ horizonIndex: 1, factor: 0.95 }),
        makeFactorRecord({ horizonIndex: 2, factor: 1.2 }),
        makeFactorRecord({ horizonIndex: 3, factor: 0.88 }),
        makeFactorRecord({ horizonIndex: 4, factor: 1.01 }),
      ],
    };
    const outlook = buildSalaryFactorOutlook({ saveId: "save-x", seasonId: "season-1", seasonState });
    expect(outlook.currentFactor).toBe(1.09);
    expect(outlook.nextFactor).toBe(0.95);
    expect(outlook.direction).toBe("down");
    expect(outlook.delta).toBeCloseTo(-0.14, 10);
  });

  it("nutzt ohne persistiertes Fenster exakt dieselben Werte wie getSeasonEconomyFactorWindow (Parität)", () => {
    const window = getSeasonEconomyFactorWindow({ saveId: "save-parity", seasonId: "season-3" });
    const outlook = buildSalaryFactorOutlook({ saveId: "save-parity", seasonId: "season-3" });
    expect(outlook.currentFactor).toBe(window[0]?.factor ?? null);
    expect(outlook.nextFactor).toBe(window[1]?.factor ?? null);
  });
});

// --- UI-Verdrahtungs-Contract (Source-Scan, gleiches Muster wie die anderen
// *-ui-contract-Tests): der Salary Factor muss im Finanzen-Reiter sichtbar
// verdrahtet sein — mit Richtungs-Ton nach Spieler-Nutzen und echter saveId.
describe("finances salary factor ui contract", () => {
  it("zeigt den Salary-Factor-Chip im Finanzen-Reiter mit Richtungs-Ton und Erklär-Tooltip", async () => {
    const viewText = await fs.readFile(path.join(root, "app/foundation/finances/FoundationFinancesNewLook.tsx"), "utf8");
    // M3 (Markt-Audit F5): Label eingedeutscht — der Tooltip nennt weiterhin den englischen
    // Begriff „Salary Factor", damit der Draht zu Season-Briefing/KI-Doku nicht abreißt.
    expect(viewText).toContain('label="Gehaltsfaktor"');
    expect(viewText).toContain("Salary Factor");
    expect(viewText).toContain("salaryFactorOutlook");
    // Ton nach Nutzen für den Spieler: steigender Faktor = mehr Liga-Einnahmen = good.
    expect(viewText).toContain('if (direction === "up") return "good"');
    expect(viewText).toContain('if (direction === "down") return "risk"');
    expect(viewText).toContain("SALARY_FACTOR_TOOLTIP");
    // Ehrlichkeit: ohne validen Wert kein Chip, ohne nächste Season keine Richtung.
    expect(viewText).toContain("salaryFactorOutlook.currentFactor != null");
  });

  it("verdrahtet Host und Shell mit der echten saveId (gleiche Faktoren wie Briefing/KI)", async () => {
    const hostText = await fs.readFile(path.join(root, "app/foundation/finances/FoundationFinancesHost.tsx"), "utf8");
    expect(hostText).toContain("buildSalaryFactorOutlook");
    expect(hostText).toContain("saveId");

    const shellText = await fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
    expect(shellText).toContain("saveId={activeSaveId}");
  });
});
