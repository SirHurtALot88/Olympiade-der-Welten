import { describe, expect, it } from "vitest";

import {
  applySeasonRankColumn,
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
  // `sum` ist die Zahl, die GEBUCHT wird: die Disziplin-Punkte aus der Rang→Punkte-Tabelle.
  // Der Mutator-Aufschlag (`mutPp`, in der Gesamt-Spalte `total` mit drin) ist ein SPIELER-Punkt
  // und geht nicht in die Saisontabelle — siehe den Wert-Test weiter unten.
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

  /**
   * DER MUTATOR-AUFSCHLAG WIRD NICHT GEBUCHT — die Projektion darf ihn nicht mitrechnen.
   *
   * Echte Zahlen aus dem Live-Abbild `new-game-1785823388048-1hf25q` (Saison 2, Spieltag 10):
   * Punktestand VOR dem Spieltag (`matchdayBaselinePoints`), das gebuchte Tagesdelta aus
   * `rank_to_points` (`sum`) und der Mutator-Aufschlag des Tages (`mutPp`, Σ aller
   * `playerDisciplinePerformances.mutatorPpsBonus` des Teams). Rechts der Rang, den
   * `standings-apply` tatsaechlich in den Spielstand geschrieben hat.
   *
   * Mit `sum + mutPp` projiziert wichen 6 von 32 Raengen ab; mit `sum` sind es 0 von 32.
   */
  it("projiziert den gebuchten Rang — der Mutator-Aufschlag zaehlt nicht mit", () => {
    const abbild = [
      { teamId: "P-S", currentPoints: 100.1, sum: 10.3, mutPp: 0.3, gebuchterRang: 8 },
      { teamId: "R-L", currentPoints: 99.9, sum: 9.7, mutPp: 1.2, gebuchterRang: 9 },
      { teamId: "W-W", currentPoints: 81.3, sum: 16.5, mutPp: 0, gebuchterRang: 15 },
      { teamId: "T-T", currentPoints: 89.4, sum: 7.5, mutPp: 0.9, gebuchterRang: 16 },
      { teamId: "U-A", currentPoints: 34.4, sum: 2.1, mutPp: 0, gebuchterRang: 31 },
      { teamId: "C-C", currentPoints: 35.1, sum: 0.9, mutPp: 0.6, gebuchterRang: 32 },
    ];
    const reihenfolge = (ranks: Map<string, number>) =>
      [...abbild].sort((a, b) => (ranks.get(a.teamId) ?? 99) - (ranks.get(b.teamId) ?? 99)).map((r) => r.teamId);
    const gebucht = [...abbild].sort((a, b) => a.gebuchterRang - b.gebuchterRang).map((r) => r.teamId);

    // Die Zeilen tragen BEIDE Groessen, genau wie im Panel — `total` ist die Gesamt-Spalte
    // (Disziplin-Punkte + Mutator). Wer die Projektion wieder auf `total` umstellt, faellt hier.
    const ranks = resolveProjectedRanksFromMatchday(
      abbild.map((r) => ({
        teamId: r.teamId,
        currentPoints: r.currentPoints,
        sum: r.sum,
        total: Number((r.sum + r.mutPp).toFixed(4)),
        projectedRank: null,
      })),
    );
    expect(reihenfolge(ranks)).toEqual(gebucht);
    // Die Punktesummen selbst, damit ein Rangvergleich nicht zufaellig aufgeht:
    expect(abbild.map((r) => Number((r.currentPoints + r.sum).toFixed(1)))).toEqual([110.4, 109.6, 97.8, 96.9, 36.5, 36]);

    // GEGENPROBE: mit dem Mutator-Aufschlag kippen genau diese drei Paare.
    const mitMutator = resolveProjectedRanksFromMatchday(
      abbild.map((r) => ({
        teamId: r.teamId,
        currentPoints: r.currentPoints,
        sum: Number((r.sum + r.mutPp).toFixed(4)),
        projectedRank: null,
      })),
    );
    expect(reihenfolge(mitMutator)).toEqual(["R-L", "P-S", "T-T", "W-W", "C-C", "U-A"]);
  });

  /**
   * DIESER TEST LAS FRUEHER DEN QUELLTEXT.
   *
   * Er suchte im Panel nach den Zeichenketten `const alleAusDerEngine = rows.every(…)` und
   * `if (row.projectedRank == null) {`. Das ist die Fehlerklasse "Test prueft Quelltext-Strings
   * statt Werte": er waere gruen geblieben, wenn die Regel in eine tote Funktion gewandert
   * waere, und er waere rot geworden, sobald jemand eine Variable umbenennt, ohne dass sich
   * das Verhalten aendert. Seit dem Audit vom 11.08. steht die Regel als `applySeasonRankColumn`
   * exportiert da und wird hier an WERTEN geprueft — inklusive Gegenprobe auf das alte
   * Luecken-Fuellen.
   */
  it("mischt nicht zwei Ranglisten in eine Spalte", () => {
    // Vier Teams, aber nur zwei tragen eine Engine-Projektion. Genau die Lage, in der die alte
    // Logik mischte: A/B behielten 1/2 aus der Engine, C/D bekamen aus der abgeleiteten Liste
    // ebenfalls kleine Zahlen — Rang 1 und 2 waren danach doppelt vergeben.
    const gemischt = [
      { teamId: "A", currentPoints: 10, sum: 1, projectedRank: 1 as number | null },
      { teamId: "B", currentPoints: 9, sum: 1, projectedRank: 2 as number | null },
      { teamId: "C", currentPoints: 40, sum: 5, projectedRank: null as number | null },
      { teamId: "D", currentPoints: 30, sum: 5, projectedRank: null as number | null },
    ];

    // GEGENPROBE — so sah die alte Regel aus (nur Luecken fuellen):
    const alteRegel = gemischt.map((row) => ({ ...row }));
    const abgeleitet = resolveProjectedRanksFromMatchday(alteRegel);
    for (const row of alteRegel) {
      if (row.projectedRank == null) row.projectedRank = abgeleitet.get(row.teamId) ?? null;
    }
    expect(alteRegel.map((row) => row.projectedRank)).toEqual([1, 2, 1, 2]);
    // Rang 1 und 2 doppelt, 3 und 4 gar nicht — keine Ordnung, sondern zwei uebereinander.
    expect(new Set(alteRegel.map((row) => row.projectedRank)).size).toBe(2);

    // NEUE REGEL: unvollstaendige Engine-Daten → ALLE Raenge kommen aus einer Liste.
    applySeasonRankColumn(gemischt);
    expect(gemischt.map((row) => row.projectedRank)).toEqual([3, 4, 1, 2]);
    expect(new Set(gemischt.map((row) => row.projectedRank)).size).toBe(4);
  });

  it("laesst eine VOLLSTAENDIGE Engine-Rangliste unangetastet", () => {
    // Sind alle Raenge gebucht, ist die Engine die verbindliche Quelle — auch dann, wenn die
    // abgeleitete Rechnung eine andere Reihenfolge ergaebe (hier: nach Punkten waere B vorn).
    const ausDerEngine = [
      { teamId: "A", currentPoints: 1, sum: 0, projectedRank: 1 as number | null },
      { teamId: "B", currentPoints: 99, sum: 0, projectedRank: 2 as number | null },
    ];
    applySeasonRankColumn(ausDerEngine);
    expect(ausDerEngine.map((row) => row.projectedRank)).toEqual([1, 2]);
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
