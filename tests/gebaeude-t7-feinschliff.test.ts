/**
 * Paket T7 (Gebäude-Feinschliff). Vier gezielte Fixes, alle chirurgisch,
 * das Investitions-Radar selbst (Chris' Lieblingsmodul) bleibt unangetastet.
 *
 * F1: "nicht gebaut" bekam denselben roten Rahmen wie "Risiko" — 7 von 8
 *     Karten sahen aus wie ein Problem, obwohl alles in Ordnung war.
 * F2: Unterhalt/Netto zeigten hart kodiert "−0,0 Mio" für nicht gebaute
 *     Gebäude (ein negatives Nichts) und färbten eine Null grün/rot.
 * F3: "RECOVERY 20" und "TRAININGSEFFEKT 0 · +1,2% · Scouting … · Analytics
 *     …" quetschten mehrere Fakten in einen Chip ohne Einheit/Einordnung.
 * F5: Der Arena-Karten-Hinweis nutzte rohes --nl-accent als Textfarbe
 *     (S-C gemessen 3,72:1) statt der angehobenen --nl-accent-text.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  facilityNetToneClass,
  formatFacilityUpkeepAmount,
  getFacilityCardTone,
} from "@/app/foundation/facilities-v2/FacilitiesV2NewLook";
import type { FacilityRowView } from "@/app/foundation/facilities-v2/facilities-v2-types";

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const SOURCE = readFileSync(
  join(process.cwd(), "app/foundation/facilities-v2/FacilitiesV2NewLook.tsx"),
  "utf8",
);

function regel(selektor: string): string {
  const start = CSS.indexOf(`${selektor} {`);
  expect(start, `Regel fehlt: ${selektor}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(start, CSS.indexOf("}", start));
}

function unbuiltFacility(overrides: Partial<FacilityRowView> = {}): FacilityRowView {
  return {
    id: "fan_shop",
    name: "Fan Shop",
    description: "",
    effect: "",
    level: 0,
    nextLevel: 1,
    upgradeCost: 10,
    currentUpkeep: 0,
    nextUpkeep: 0.8,
    currentIncome: 0,
    nextIncome: 3.9,
    conditionPct: 0,
    efficiencyPct: 0,
    conditionStatus: "unbuilt",
    maintenanceCost: 0,
    sourceStatus: "ok",
    currentEffect: "",
    nextLevelEffect: "",
    ...overrides,
  };
}

describe("F1: 'nicht gebaut' ist kein Risiko-Ton", () => {
  it("getFacilityCardTone gibt 'unbuilt' für level <= 0, nie 'risk'", () => {
    expect(getFacilityCardTone(unbuiltFacility({ level: 0 }))).toBe("unbuilt");
    expect(getFacilityCardTone(unbuiltFacility({ level: -1 as unknown as number }))).toBe("unbuilt");
  });

  it("ein echtes Risiko-Gebäude (gebaut, schlechter Zustand) bleibt 'risk'", () => {
    expect(
      getFacilityCardTone(unbuiltFacility({ level: 2, conditionPct: 30, efficiencyPct: 40 })),
    ).toBe("risk");
  });

  it("ein gesundes gebautes Gebäude bleibt 'good'", () => {
    expect(
      getFacilityCardTone(unbuiltFacility({ level: 3, conditionPct: 95, efficiencyPct: 100 })),
    ).toBe("good");
  });

  it("Karten- und Listen-Rendering nutzen getFacilityCardTone, nicht das rohe getWearTone", () => {
    expect(SOURCE).toContain("const wearTone = getFacilityCardTone(facility);");
  });

  it("CSS: .is-unbuilt ist ein neutraler gestrichelter Rahmen, keine Risiko-Farbe", () => {
    const card = regel(".is-new-look .nl-facility-card.is-unbuilt");
    expect(card).toContain("dashed");
    expect(card).not.toContain("--nl-risk");
    const row = regel(".is-new-look .nl-facility-list-row.is-unbuilt td:first-child");
    expect(row).not.toContain("--nl-risk");
  });
});

describe("F2: Unterhalt/Netto zeigen keine falsche Null-Semantik", () => {
  it("formatFacilityUpkeepAmount rendert 0 ohne Minus-Vorzeichen", () => {
    expect(formatFacilityUpkeepAmount(0)).toBe("0,0 Mio");
    expect(formatFacilityUpkeepAmount(0)).not.toContain("−");
  });

  it("formatFacilityUpkeepAmount rendert echten Unterhalt weiterhin mit Minus", () => {
    expect(formatFacilityUpkeepAmount(0.6)).toBe("−0,6 Mio");
  });

  it("facilityNetToneClass: Null ist neutral, nicht grün/rot", () => {
    expect(facilityNetToneClass(0)).toBe("is-neutral");
    expect(facilityNetToneClass(0.02)).toBe("is-neutral"); // rundet auf 0,0 Mio
  });

  it("facilityNetToneClass: echte Werte bleiben grün/rot", () => {
    expect(facilityNetToneClass(1.2)).toBe("is-positive");
    expect(facilityNetToneClass(-1.2)).toBe("is-negative");
  });

  it("Karten-/Listen-Rendering rufen die geteilten Helfer auf, kein hartkodiertes Minus mehr", () => {
    expect(SOURCE).toContain("{formatFacilityUpkeepAmount(facility.currentUpkeep)}");
    expect(SOURCE).not.toContain("−{formatTransfermarktCurrency(facility.currentUpkeep)}");
  });
});

describe("F3: Recovery/Trainingseffekt-Chips sind Label + Wert + Klartext", () => {
  it("Regeneration-Chip hat eine erklärende Sub-Zeile", () => {
    expect(SOURCE).toContain('label="Regeneration"');
    expect(SOURCE).toContain("Team-Ø nach Training");
  });

  it("Trainings-XP/Scouting/Analytics sind eigene Chips statt einer gequetschten Sub-Zeile", () => {
    expect(SOURCE).toContain('label="Trainings-XP"');
    expect(SOURCE).toContain('label="Scouting"');
    expect(SOURCE).toContain('label="Analytics"');
  });
});

describe("F5: Arena-Beliebtheits-Hinweis nutzt --nl-accent-text, nicht rohes --nl-accent", () => {
  it("CSS-Regel zeigt auf --nl-accent-text", () => {
    const block = regel(".is-new-look .nl-facility-arena-popularity");
    expect(block).toContain("var(--nl-accent-text");
    expect(block).not.toContain("var(--nl-accent,");
  });
});
