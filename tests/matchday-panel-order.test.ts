import { describe, expect, it } from "vitest";

import {
  resolveMatchdayRanks,
  resolveProjectedRanksFromMatchday,
  sortMatchdayPanelRows,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

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

// Regression: Die Standings-Vorschau liest das GESPEICHERTE Spieltagsergebnis. Läuft der
// Spieltag nur in der Arena und wurde noch nicht übernommen, meldet sie
// `missing_result_for_matchday` und lässt projectedPoints/projectedRank leer — in der
// Tabelle stand dann überall „–", und die Sortierung fiel zusätzlich auf die
// Eingangsreihenfolge zurück, weil sie bei aufgedeckter Disziplin 2 daran hängt.
describe("Spieltags-Wertung · projizierter Rang ohne gespeichertes Ergebnis", () => {
  type ProjRow = { teamId: string; currentPoints: number | null; sum: number; projectedRank: number | null };

  it("leitet den neuen Rang aus Saisonpunkten plus Spieltags-Punkten ab", () => {
    const rows: ProjRow[] = [
      { teamId: "R-L", currentPoints: 5, sum: 20.4, projectedRank: null }, // 25,4 → 1
      { teamId: "P-S", currentPoints: 20, sum: 17.9, projectedRank: null }, // 37,9 → wäre 1
      { teamId: "C-C", currentPoints: 12, sum: 4.2, projectedRank: null }, // 16,2 → 3
    ];

    const ranks = resolveProjectedRanksFromMatchday(rows);
    expect(ranks.get("P-S")).toBe(1);
    expect(ranks.get("R-L")).toBe(2);
    expect(ranks.get("C-C")).toBe(3);
  });

  it("teilt bei Punktgleichstand denselben Rang zu", () => {
    const rows: ProjRow[] = [
      { teamId: "A", currentPoints: 10, sum: 5, projectedRank: null },
      { teamId: "B", currentPoints: 12, sum: 3, projectedRank: null },
      { teamId: "C", currentPoints: 1, sum: 1, projectedRank: null },
    ];

    const ranks = resolveProjectedRanksFromMatchday(rows);
    expect(ranks.get("A")).toBe(1);
    expect(ranks.get("B")).toBe(1);
    expect(ranks.get("C")).toBe(3);
  });

  it("überspringt Teams ohne Saisonpunkte, statt sie auf Rang 1 zu setzen", () => {
    const rows: ProjRow[] = [
      { teamId: "ohne", currentPoints: null, sum: 99, projectedRank: null },
      { teamId: "mit", currentPoints: 4, sum: 1, projectedRank: null },
    ];

    const ranks = resolveProjectedRanksFromMatchday(rows);
    expect(ranks.has("ohne")).toBe(false);
    expect(ranks.get("mit")).toBe(1);
  });

  it("macht die Tabelle bei aufgedeckter Disziplin 2 wieder sortierbar", () => {
    // Vor dem Fix waren alle projectedRank null → alle gleich → Eingangsreihenfolge.
    const base = [
      { teamId: "spät", currentPoints: 1, sum: 1, projectedRank: null as number | null, total: 2, currentRank: 30 },
      { teamId: "top", currentPoints: 20, sum: 20, projectedRank: null as number | null, total: 40, currentRank: 2 },
    ];
    const derived = resolveProjectedRanksFromMatchday(base);
    for (const row of base) row.projectedRank = derived.get(row.teamId) ?? null;

    expect(sortMatchdayPanelRows(base, true).map((row) => row.teamId)).toEqual(["top", "spät"]);
  });
});

// Die Tabelle sortiert nach der Tagesleistung, zeigte aber nur den Saison-Rang — die
// Zahlenspalte lief dadurch scheinbar wirr (4, 15, 19, 5 …). Der Tagesrang macht die
// Reihenfolge explizit; beide Raenge stehen jetzt beschriftet nebeneinander.
describe("Spieltags-Wertung · Tagesrang", () => {
  it("rankt nach der Gesamt-Spalte, unabhaengig vom Saison-Rang", () => {
    const ranks = resolveMatchdayRanks(firstMatchdayRows());

    expect(ranks.get("P-S")).toBe(1); // +21,1 — Saison-Rang 17
    expect(ranks.get("M-M")).toBe(2); // +17,9
    expect(ranks.get("B-F")).toBe(3); // +16,1
    expect(ranks.get("C-C")).toBe(4); // +3,7
    expect(ranks.get("A-A")).toBe(5); // +1,8 — Saison-Rang 1
  });

  it("laeuft parallel zur Sortierung: Tagesrang 1..n in Anzeigereihenfolge", () => {
    const sorted = sortMatchdayPanelRows(firstMatchdayRows(), false);
    const ranks = resolveMatchdayRanks(sorted);

    expect(sorted.map((row) => ranks.get(row.teamId))).toEqual([1, 2, 3, 4, 5]);
  });

  it("teilt bei Gleichstand den Rang und ueberspringt danach entsprechend", () => {
    const rows = [
      { teamId: "A", total: 10 },
      { teamId: "B", total: 10 },
      { teamId: "C", total: 4 },
    ];

    const ranks = resolveMatchdayRanks(rows);
    expect(ranks.get("A")).toBe(1);
    expect(ranks.get("B")).toBe(1);
    expect(ranks.get("C")).toBe(3);
  });
});
