import { describe, expect, it } from "vitest";

import { buildPlayerContractTileView } from "@/lib/foundation/player-contract-tile";
import type { ContractYearSalary } from "@/lib/data/olyDataTypes";

function year(yearIndex: number, salary: number, label = `Season ${yearIndex}`): ContractYearSalary {
  return { yearIndex, seasonOffset: yearIndex - 1, label, salary };
}

describe("player contract tile", () => {
  it("labels the remaining seasons and keeps the singular for a one-season deal", () => {
    // `contractLength` ist die VERBLEIBENDE Laufzeit — der Saisonende-Tick
    // zaehlt sie herunter, es ist nicht die urspruenglich vereinbarte Dauer.
    expect(buildPlayerContractTileView({ contractLength: 3 }).valueLabel).toBe("3 Saisons");
    expect(buildPlayerContractTileView({ contractLength: 1 }).valueLabel).toBe("1 Saison");
  });

  it("marks a one-season contract as expiring", () => {
    const view = buildPlayerContractTileView({ contractLength: 1, yearlySalarySchedule: [year(1, 3.4)] });
    expect(view.isExpiring).toBe(true);
    expect(view.subLabel).toBe("läuft aus");
  });

  it("hides the tile entirely without a running contract", () => {
    for (const length of [0, null, undefined]) {
      const view = buildPlayerContractTileView({ contractLength: length });
      expect(view.valueLabel).toBeNull();
      expect(view.schedule).toEqual([]);
    }
  });

  it("suppresses the progression for a single-season contract", () => {
    // Bei einer Saison steht der Betrag bereits in der GEHALT-Kachel — ein
    // "Verlauf" aus genau einem Wert waere reine Doppelung.
    const view = buildPlayerContractTileView({ contractLength: 1, yearlySalarySchedule: [year(1, 3.4)] });
    expect(view.schedule).toEqual([]);
  });

  it("reports rising, falling and flat salary progressions", () => {
    const rising = buildPlayerContractTileView({
      contractLength: 3,
      yearlySalarySchedule: [year(1, 3.4), year(2, 3.9), year(3, 4.5)],
    });
    expect(rising.subLabel).toBe("steigend");
    expect(rising.schedule).toHaveLength(3);

    const falling = buildPlayerContractTileView({
      contractLength: 3,
      yearlySalarySchedule: [year(1, 4.5), year(2, 3.9), year(3, 3.4)],
    });
    expect(falling.subLabel).toBe("fallend");

    const flat = buildPlayerContractTileView({
      contractLength: 2,
      yearlySalarySchedule: [year(1, 4), year(2, 4)],
    });
    expect(flat.subLabel).toBe("konstant");
  });

  it("does not sell sub-cent rounding noise as a trend", () => {
    const view = buildPlayerContractTileView({
      contractLength: 2,
      yearlySalarySchedule: [year(1, 4.001), year(2, 4.006)],
    });
    expect(view.subLabel).toBe("konstant");
  });

  it("trims a schedule that outruns the remaining length", () => {
    // Altstaende/importierte Economy koennen eine laengere Staffel tragen als
    // die Restlaufzeit — Kachel und Verlauf duerfen sich nie widersprechen.
    const view = buildPlayerContractTileView({
      contractLength: 2,
      yearlySalarySchedule: [year(1, 3), year(2, 4), year(3, 5), year(4, 6)],
    });
    expect(view.valueLabel).toBe("2 Saisons");
    expect(view.schedule.map((entry) => entry.salary)).toEqual([3, 4]);
    // Der Trend folgt der zugeschnittenen Staffel, nicht der Rohstaffel.
    expect(view.subLabel).toBe("steigend");
  });

  it("keeps the current season first so the UI can flag it", () => {
    const view = buildPlayerContractTileView({
      contractLength: 3,
      yearlySalarySchedule: [year(1, 3.4, "Season 4"), year(2, 3.9, "Season 5"), year(3, 4.5, "Season 6")],
    });
    expect(view.schedule[0]?.label).toBe("Season 4");
  });
});
