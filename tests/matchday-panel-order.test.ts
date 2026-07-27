import { describe, expect, it } from "vitest";

import { sortMatchdayPanelRows } from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

type Row = { teamId: string; total: number; currentRank: number | null; projectedRank: number | null };

// Situation aus dem Spiel: erster Spieltag, Disziplin 2 noch verdeckt. `currentRank` ist
// hier nur die Startreihenfolge (alphabetisch vergeben), trägt also keine Wertungsaussage.
function firstMatchdayRows(): Row[] {
  return [
    { teamId: "A-A", total: 1.8, currentRank: 1, projectedRank: null },
    { teamId: "B-F", total: 16.1, currentRank: 2, projectedRank: null },
    { teamId: "C-C", total: 3.7, currentRank: 4, projectedRank: null },
    { teamId: "P-S", total: 21.1, currentRank: 17, projectedRank: null },
    { teamId: "M-M", total: 17.9, currentRank: 12, projectedRank: null },
  ];
}

describe("Spieltags-Wertung · Reihenfolge", () => {
  it("ordnet bei verdeckter Disziplin 2 nach der Gesamt-Spalte, nicht nach der Startreihenfolge", () => {
    const sorted = sortMatchdayPanelRows(firstMatchdayRows(), false);

    expect(sorted.map((row) => row.teamId)).toEqual(["P-S", "M-M", "B-F", "C-C", "A-A"]);
    // Regression: vorher stand A-A (+1,8) oben und P-S (+21,1) auf Platz 4 von 5.
    expect(sorted[0]!.teamId).not.toBe("A-A");
    // Die Gesamt-Werte laufen jetzt monoton fallend.
    const totals = sorted.map((row) => row.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("ordnet nach dem projizierten Endrang, sobald Disziplin 2 aufgedeckt ist", () => {
    const rows: Row[] = [
      { teamId: "A-A", total: 30, currentRank: 1, projectedRank: 9 },
      { teamId: "B-F", total: 2, currentRank: 2, projectedRank: 1 },
      { teamId: "C-C", total: 10, currentRank: 4, projectedRank: 5 },
    ];

    // Ist der Spieltag fertig gewertet, gilt der Endrang — nicht mehr die Tagessumme.
    expect(sortMatchdayPanelRows(rows, true).map((row) => row.teamId)).toEqual(["B-F", "C-C", "A-A"]);
  });

  it("hält Gleichstände über den Saison-Rang stabil", () => {
    const rows: Row[] = [
      { teamId: "spät", total: 5, currentRank: 20, projectedRank: null },
      { teamId: "früh", total: 5, currentRank: 3, projectedRank: null },
    ];

    expect(sortMatchdayPanelRows(rows, false).map((row) => row.teamId)).toEqual(["früh", "spät"]);
  });

  it("behandelt fehlende Ränge als hinten liegend, statt sie nach vorn zu sortieren", () => {
    const rows: Row[] = [
      { teamId: "ohne-rang", total: 1, currentRank: null, projectedRank: null },
      { teamId: "mit-rang", total: 1, currentRank: 8, projectedRank: 8 },
    ];

    expect(sortMatchdayPanelRows(rows, false).map((row) => row.teamId)).toEqual(["mit-rang", "ohne-rang"]);
    expect(sortMatchdayPanelRows(rows, true).map((row) => row.teamId)).toEqual(["mit-rang", "ohne-rang"]);
  });
});
