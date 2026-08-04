import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MATCHDAY_PANEL_DEFAULT_SORT,
  resolveMatchdayRanks,
  resolveProjectedRanksFromMatchday,
  sortMatchdayPanelRows,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

type Row = {
  teamId: string;
  teamName: string;
  total: number;
  currentRank: number | null;
  projectedRank: number | null;
  d1Pts: number | null;
  d2Pts: number | null;
  sum: number;
  mutPp: number;
};

function row(partial: Partial<Row> & { teamId: string; total: number }): Row {
  return {
    teamName: partial.teamName ?? partial.teamId,
    currentRank: partial.currentRank ?? null,
    projectedRank: partial.projectedRank ?? null,
    d1Pts: partial.d1Pts ?? partial.total,
    d2Pts: partial.d2Pts ?? null,
    sum: partial.sum ?? partial.total,
    mutPp: partial.mutPp ?? 0,
    ...partial,
  };
}

// Situation aus dem Spiel: erster Spieltag, Disziplin 2 noch verdeckt. `currentRank` ist
// hier nur die Startreihenfolge (alphabetisch vergeben), trägt also keine Wertungsaussage.
function firstMatchdayRows(): Row[] {
  return [
    row({ teamId: "A-A", total: 1.8, currentRank: 1 }),
    row({ teamId: "B-F", total: 16.1, currentRank: 2 }),
    row({ teamId: "C-C", total: 3.7, currentRank: 4 }),
    row({ teamId: "P-S", total: 21.1, currentRank: 17 }),
    row({ teamId: "M-M", total: 17.9, currentRank: 12 }),
  ];
}

describe("Spieltags-Wertung · Reihenfolge", () => {
  it("ordnet bei verdeckter Disziplin 2 nach der Gesamt-Spalte, nicht nach der Startreihenfolge", () => {
    const sorted = sortMatchdayPanelRows(firstMatchdayRows(), MATCHDAY_PANEL_DEFAULT_SORT);

    expect(sorted.map((row) => row.teamId)).toEqual(["P-S", "M-M", "B-F", "C-C", "A-A"]);
    // Regression: vorher stand A-A (+1,8) oben und P-S (+21,1) auf Platz 4 von 5.
    expect(sorted[0]!.teamId).not.toBe("A-A");
    // Die Gesamt-Werte laufen jetzt monoton fallend.
    const totals = sorted.map((row) => row.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("sortiert auf Wunsch nach dem Saison-Rang statt nach dem Spieltag", () => {
    const rows = [
      row({ teamId: "A-A", total: 30, currentRank: 1, projectedRank: 9 }),
      row({ teamId: "B-F", total: 2, currentRank: 2, projectedRank: 1 }),
      row({ teamId: "C-C", total: 10, currentRank: 4, projectedRank: 5 }),
    ];

    // Rang-Spalte aufsteigend: Rang 1 oben — unabhaengig von der Tagesleistung.
    expect(sortMatchdayPanelRows(rows, { key: "season", dir: "asc" }).map((r) => r.teamId)).toEqual(["B-F", "C-C", "A-A"]);
  });

  it("dreht die Richtung, wenn dieselbe Spalte erneut sortiert wird", () => {
    const rows = firstMatchdayRows();

    expect(sortMatchdayPanelRows(rows, { key: "total", dir: "desc" })[0]!.teamId).toBe("P-S");
    expect(sortMatchdayPanelRows(rows, { key: "total", dir: "asc" })[0]!.teamId).toBe("A-A");
  });

  it("sortiert nach Teamname alphabetisch", () => {
    const rows = [
      row({ teamId: "z", teamName: "Zero Heroes", total: 99 }),
      row({ teamId: "a", teamName: "Armageddon", total: 1 }),
    ];

    expect(sortMatchdayPanelRows(rows, { key: "team", dir: "asc" }).map((r) => r.teamId)).toEqual(["a", "z"]);
  });

  it("haelt Gleichstaende ueber die Gesamt-Spalte und dann den Namen stabil", () => {
    const rows = [
      row({ teamId: "b", teamName: "Beta", total: 5, mutPp: 1 }),
      row({ teamId: "a", teamName: "Alpha", total: 5, mutPp: 1 }),
    ];

    // Gleiche Sortierspalte, gleicher Gesamtwert → Name entscheidet, nicht die Eingangsreihenfolge.
    expect(sortMatchdayPanelRows(rows, { key: "mutator", dir: "desc" }).map((r) => r.teamId)).toEqual(["a", "b"]);
  });

  it("sortiert fehlende Werte ans Ende, statt sie nach vorn zu ziehen", () => {
    const rows = [
      row({ teamId: "ohne-rang", total: 1, currentRank: null, projectedRank: null }),
      row({ teamId: "mit-rang", total: 1, currentRank: 8, projectedRank: 8 }),
    ];

    expect(sortMatchdayPanelRows(rows, { key: "season", dir: "asc" }).map((r) => r.teamId)).toEqual(["mit-rang", "ohne-rang"]);
  });
});

// Regression: Die Standings-Vorschau liest das GESPEICHERTE Spieltagsergebnis. Läuft der
// Spieltag nur in der Arena und wurde noch nicht übernommen, meldet sie
// `missing_result_for_matchday` und lässt projectedPoints/projectedRank leer — in der
// Tabelle stand dann überall „–", und die Sortierung fiel zusätzlich auf die
// Eingangsreihenfolge zurück, weil sie bei aufgedeckter Disziplin 2 daran hängt.
describe("Spieltags-Wertung · projizierter Rang ohne gespeichertes Ergebnis", () => {
  // `total` ist die Zahl aus der Gesamt-Spalte: Disziplin-Punkte PLUS Mutator-Bonus. Genau die
  // wird auch in der Saisontabelle gebucht (Spalte BONUS) — `sum` allein waere zu wenig.
  type ProjRow = { teamId: string; currentPoints: number | null; total: number; projectedRank: number | null };

  it("leitet den neuen Rang aus Saisonpunkten plus Spieltags-Punkten ab", () => {
    const rows: ProjRow[] = [
      { teamId: "R-L", currentPoints: 5, total: 20.4, projectedRank: null }, // 25,4 → 1
      { teamId: "P-S", currentPoints: 20, total: 17.9, projectedRank: null }, // 37,9 → wäre 1
      { teamId: "C-C", currentPoints: 12, total: 4.2, projectedRank: null }, // 16,2 → 3
    ];

    const ranks = resolveProjectedRanksFromMatchday(rows);
    expect(ranks.get("P-S")).toBe(1);
    expect(ranks.get("R-L")).toBe(2);
    expect(ranks.get("C-C")).toBe(3);
  });

  it("teilt bei Punktgleichstand denselben Rang zu", () => {
    const rows: ProjRow[] = [
      { teamId: "A", currentPoints: 10, total: 5, projectedRank: null },
      { teamId: "B", currentPoints: 12, total: 3, projectedRank: null },
      { teamId: "C", currentPoints: 1, total: 1, projectedRank: null },
    ];

    const ranks = resolveProjectedRanksFromMatchday(rows);
    expect(ranks.get("A")).toBe(1);
    expect(ranks.get("B")).toBe(1);
    expect(ranks.get("C")).toBe(3);
  });

  it("überspringt Teams ohne Saisonpunkte, statt sie auf Rang 1 zu setzen", () => {
    const rows: ProjRow[] = [
      { teamId: "ohne", currentPoints: null, total: 99, projectedRank: null },
      { teamId: "mit", currentPoints: 4, total: 1, projectedRank: null },
    ];

    const ranks = resolveProjectedRanksFromMatchday(rows);
    expect(ranks.has("ohne")).toBe(false);
    expect(ranks.get("mit")).toBe(1);
  });


  it("rechnet den Mutator-Bonus mit — sonst steht ein Bonus-Team zu tief", () => {
    // GEMELDET VON CHRIS nach Spieltag 10: „schade fuer M-M dass sie es nicht geschafft haben aufs
    // treppchen — und ploetzlich sind sie doch 2." Genau dieser Fall: ohne den Bonus liegt M-M
    // hinter H-R, mit Bonus davor. Die Saisontabelle bucht den Bonus, der Endstand-Bildschirm
    // rechnete ihn nicht mit.
    const mm = { teamId: "M-M", currentPoints: 126.8, total: 6.9, projectedRank: null };
    const hr = { teamId: "H-R", currentPoints: 123.6, total: 7.5, projectedRank: null };
    // Ohne Bonus waere M-M mit 130,7 hinter H-R mit 131,1 — mit Bonus 133,7 zu 131,1 davor.
    const ranks = resolveProjectedRanksFromMatchday([
      { ...mm, total: mm.total + 4 },
      { ...hr, total: hr.total },
    ]);
    expect(ranks.get("M-M")).toBe(1);
    expect(ranks.get("H-R")).toBe(2);
  });

  it("mischt nicht zwei Ranglisten in eine Spalte", () => {
    // Die Panel-Logik fuellte frueher nur die LUECKEN: Teams mit gespeicherter Projektion behielten
    // den Rang der Engine, der Rest bekam den abgeleiteten. Zwei je fuer sich stimmige Ranglisten,
    // zusammen aber eine Reihenfolge, die keiner von beiden entspricht.
    const panel = readFileSync(join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"), "utf8");
    expect(panel).toContain("const alleAusDerEngine = rows.every((row) => row.projectedRank != null)");
    expect(panel).not.toContain("if (row.projectedRank == null) {");
  });

  it("macht die Saison-Rang-Spalte wieder sortierbar", () => {
    // Vor dem Fix waren alle projectedRank null → nach dieser Spalte war nichts zu ordnen.
    const base = [
      row({ teamId: "spät", total: 2, sum: 1, currentRank: 30 }),
      row({ teamId: "top", total: 40, sum: 20, currentRank: 2 }),
    ];
    const withPoints = base.map((entry) => ({ ...entry, currentPoints: entry.teamId === "top" ? 20 : 1 }));
    const derived = resolveProjectedRanksFromMatchday(withPoints);
    for (const entry of base) entry.projectedRank = derived.get(entry.teamId) ?? null;

    expect(sortMatchdayPanelRows(base, { key: "season", dir: "asc" }).map((entry) => entry.teamId)).toEqual(["top", "spät"]);
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
    const sorted = sortMatchdayPanelRows(firstMatchdayRows(), MATCHDAY_PANEL_DEFAULT_SORT);
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
