import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NL_PLAYERS_COLUMN_PRESETS,
  NL_PLAYERS_HIDEABLE_COLUMN_IDS,
  readColumnPreferences,
  resolvePresetVisibility,
} from "@/app/foundation/players-table/foundation-players-column-presets";
import {
  buildDisciplinePpsSortKey,
  buildDisciplineSortKey,
  getDisciplineIdFromPpsSortKey,
  getDisciplineIdFromSortKey,
  getRowDisciplinePps,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";
import { buildRosterDisciplinePpsByAxis } from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";

/**
 * Vertrag der aufklappbaren Achsen-Spalten im Spieler-Verzeichnis:
 * POW/SPE/MEN/SOC sind je eine eigene Spalte, und jede lässt sich nach rechts
 * auf ihre Disziplinen aufklappen — dort stehen die in der Disziplin GEHOLTEN
 * PPs (Saison-Ledger), nicht die Disziplin-Wertung.
 */
describe("Spieler-Verzeichnis: Achsen-Spalten + Disziplin-PPs", () => {
  it("führt je Achse eine eigene abschaltbare Spalte statt einer Sammelspalte", () => {
    expect(NL_PLAYERS_HIDEABLE_COLUMN_IDS).toContain("axisPow");
    expect(NL_PLAYERS_HIDEABLE_COLUMN_IDS).toContain("axisSpe");
    expect(NL_PLAYERS_HIDEABLE_COLUMN_IDS).toContain("axisMen");
    expect(NL_PLAYERS_HIDEABLE_COLUMN_IDS).toContain("axisSoc");
    expect(NL_PLAYERS_HIDEABLE_COLUMN_IDS).not.toContain("axes");
  });

  it("zeigt alle vier Achsen-Spalten in den Presets 'Alles' und 'Scouting'", () => {
    for (const presetId of ["alles", "scouting"] as const) {
      const visibility = resolvePresetVisibility(presetId);
      for (const columnId of ["axisPow", "axisSpe", "axisMen", "axisSoc"]) {
        expect(visibility[columnId], `${presetId}/${columnId}`).toBe(true);
      }
    }
    // Kompakt blendet die Achsen bewusst aus — das bleibt so.
    const kompakt = NL_PLAYERS_COLUMN_PRESETS.find((preset) => preset.id === "kompakt");
    expect(kompakt?.visible).not.toContain("axisPow");
  });

  it("übernimmt eine alte gespeicherte 'axes'-Präferenz nicht als versteckte Achsen-Spalten", () => {
    const key = "nl-players-column-presets:save-test";
    const store = new Map<string, string>([
      [key, JSON.stringify({ version: 1, preset: "custom", visibility: { axes: false, pps: false } })],
    ]);
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (name: string) => store.get(name) ?? null },
      location: { search: "?save=save-test" },
    };
    try {
      const preferences = readColumnPreferences("save-test");
      expect(preferences).not.toBeNull();
      // Die vier neuen Spalten kannte der alte Eintrag nicht → sie starten sichtbar.
      expect(preferences?.visibility.axisPow).toBe(true);
      expect(preferences?.visibility.axisSoc).toBe(true);
      // Bekannte Spalten behalten ihren gespeicherten Zustand.
      expect(preferences?.visibility.pps).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("faerbt die Disziplin-Spalten im Ton ihrer Achse, nicht im Heat-Regenbogen", () => {
    const tableText = readFileSync(
      join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
      "utf8",
    );
    // Zelle UND Kopf tragen den Achsenton — sonst ist bei zwei aufgeklappten
    // Achsen nebeneinander nicht erkennbar, welcher Block wozu gehoert.
    expect(tableText).toContain("nl-players-td-disc-pps ${nlToneClass(axis.key)}");
    expect(tableText).toContain("nl-players-th-disc-pps ${nlToneClass(entry.axisKey)}");
    // Gruppenklammer: Achse offen -> linke Kante, letzte Disziplin -> rechte Kante.
    expect(tableText).toContain("is-group-start");
    expect(tableText).toContain("is-group-end");
    expect(tableText).toContain("is-group-open");

    const cssText = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    // Die Heat-Stufe steuert jetzt die Deckkraft des Achsentons statt eine
    // eigene Farbe zu setzen — Zugehoerigkeit ueber Farbe, Leistung ueber Staerke.
    expect(cssText).toContain(".is-new-look .nl-players-td-disc-pps.heat-band-8 {");
    expect(cssText).toContain("color-mix(in srgb, var(--nl-tone, var(--nl-accent)) 48%, transparent)");
    expect(cssText).toContain(".is-new-look .nl-players-td-disc-pps.is-group-end");
  });

  it("hält Wertungs- und PPs-Sortierschlüssel einer Disziplin auseinander", () => {
    const ratingKey = buildDisciplineSortKey("disc-climbing");
    const ppsKey = buildDisciplinePpsSortKey("disc-climbing");

    expect(ratingKey).not.toBe(ppsKey);
    expect(getDisciplineIdFromSortKey(ratingKey)).toBe("disc-climbing");
    expect(getDisciplineIdFromPpsSortKey(ppsKey)).toBe("disc-climbing");
    // Kein Präfix-Übergriff in beide Richtungen.
    expect(getDisciplineIdFromPpsSortKey(ratingKey)).toBeNull();
    expect(getDisciplineIdFromSortKey(ppsKey)).toBeNull();
  });

  it("liest die in einer Disziplin geholten PPs aus der Achsen-Struktur der Zeile", () => {
    const disciplines = [
      { id: "d-power-1", name: "Gewichtheben", category: "power", displayOrder: 1 },
      { id: "d-power-2", name: "Hochsprung", category: "power", displayOrder: 2 },
      { id: "d-speed-1", name: "Sprint", category: "speed", displayOrder: 3 },
    ] as unknown as Parameters<typeof buildRosterDisciplinePpsByAxis>[0]["disciplines"];

    const byAxis = buildRosterDisciplinePpsByAxis({
      disciplines,
      pointsByDiscipline: { "d-power-1": 6.14, "d-speed-1": 2 },
      pointsByArea: { power: 6.14, speed: 2 },
      axisTotals: { pow: 99, spe: 99, men: 99, soc: 99 },
    });

    const row = { disciplinePpsByAxis: byAxis };
    expect(getRowDisciplinePps(row, "d-power-1")).toBeCloseTo(6.1, 5);
    // Disziplin ohne Ledger-Eintrag = 0 geholte PPs (kein "unbekannt").
    expect(getRowDisciplinePps(row, "d-power-2")).toBe(0);
    expect(getRowDisciplinePps(row, "d-speed-1")).toBe(2);
    // Fremde Disziplin gehört nicht zur Zeile.
    expect(getRowDisciplinePps(row, "d-unknown")).toBeNull();

    // Achsentotal kommt aus dem Ledger, nicht aus dem Ratings-Fallback (99).
    expect(byAxis.find((axis) => axis.axis === "pow")?.axisPps).toBeCloseTo(6.1, 5);
    expect(byAxis.find((axis) => axis.axis === "men")?.axisPps).toBe(99);
  });
});
