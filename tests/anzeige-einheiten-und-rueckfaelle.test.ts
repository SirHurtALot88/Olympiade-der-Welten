/**
 * AUDIT 11.08.2026 — VIER ANZEIGEN, DIE SICH SELBST WIDERSPRACHEN.
 *
 * Alle vier Befunde sind reine ANZEIGE-Fehler: keine Buchung ist falsch, keine Regel wurde
 * geaendert. Falsch war jeweils, dass zwei verschiedene Groessen unter einer Beschriftung
 * nebeneinanderstanden. Dieser Test haelt die Messwerte fest, mit denen das nachgewiesen
 * wurde, und prueft WERTE — nicht Quelltext-Strings.
 *
 * Messgrundlage: Abbild von `origin/live-save`, gepusht 2026-08-11T20:41Z, juengster
 * Schreibvorgang 1,7 h davor. Saves:
 *   aktiv       `new-game-1786465783606-0kalpx` (Saison 1, Spieltag 2)
 *   Messkoerper `new-game-1785823388048-1hf25q` (Saison 2, Spieltag 10)
 */
import { describe, expect, it } from "vitest";

import {
  resolveMatchdayRanks,
  scoreText,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";
import { getPlayerPortraitInitials, getPlayerPortraitMediaModel } from "@/lib/data/mediaAssets";
import { buildFoundationSeasonTableColumns } from "@/lib/foundation/tabs/season-table-column-defs";

// ===================================================================================
// A · PORTRAITS: ein Rueckfall-Kuerzel, nicht zwei
// ===================================================================================
describe("Portraits · das Initialen-Kuerzel ist ueberall dasselbe", () => {
  /**
   * Es gab zwei Formeln: die des Portrait-Modells (Anfangsbuchstaben der ersten zwei
   * Namensteile) und ein `name.slice(0, 2).toUpperCase()` in Buehnen-Drawer, Hover-Karte,
   * Aufstellungs-Labor, Verkaufs-Modal und Auflosungs-Liste. Ueber die 2984 Spieler des
   * aktiven Saves unterschieden sie sich bei 2957 — 99,1 %. Derselbe Spieler stand in der
   * einen Ansicht als "U" und in der anderen als "UM" auf dem Schirm.
   */
  it("nimmt die Anfangsbuchstaben, nicht die ersten zwei Zeichen", () => {
    // Echte Namen aus dem Abbild.
    expect(getPlayerPortraitInitials("Umbros")).toBe("U");
    expect(getPlayerPortraitInitials("Kargath")).toBe("K");
    expect(getPlayerPortraitInitials("Riley Le Rouge")).toBe("RL");
    expect(getPlayerPortraitInitials("Lakshmi Ekelmann")).toBe("LE");
    // Leerer/blanker Name faellt nicht auf "" zurueck, sondern auf ein sichtbares Zeichen.
    expect(getPlayerPortraitInitials("   ")).toBe("?");

    // GEGENPROBE — genau die alte Formel, die daneben stand:
    const alteFormel = (name: string) => name.slice(0, 2).toUpperCase();
    for (const name of ["Umbros", "Kargath", "Zed", "Wartusk", "Pooka"]) {
      expect(alteFormel(name)).not.toBe(getPlayerPortraitInitials(name));
    }
    // Bei mehrteiligen Namen fallen die beiden ebenfalls auseinander.
    expect(alteFormel("Riley Le Rouge")).toBe("RI");
    expect(getPlayerPortraitInitials("Riley Le Rouge")).toBe("RL");
  });

  it("das Portrait-Modell benutzt genau dieses Kuerzel", () => {
    for (const name of ["Umbros", "Riley Le Rouge", "Lakshmi Ekelmann"]) {
      const model = getPlayerPortraitMediaModel({
        id: "player-9999-test",
        name,
        portraitUrl: null,
        portraitPath: null,
      } as never);
      expect(model.initials).toBe(getPlayerPortraitInitials(name));
    }
  });
});

// ===================================================================================
// B · SPIELTAGS-WERTUNG: Form und Captain sind SCORE, die Spalte daneben ist PUNKTE
// ===================================================================================
describe("Spieltags-Wertung · Form/Captain stehen in Score, nicht in Punkten", () => {
  /**
   * Gemessen am Messkoerper, `season-2-matchday-10`, beide Disziplinen aufgedeckt:
   * bei 12 von 32 Teams war der Form-Wert GROESSER als die komplette Punkte-Spalte,
   * Verhaeltnis |Form|/Punkte im Mittel 1,4. Spitzenfall N-N: 26,4 Punkte neben 184,3 Form.
   * Beide liefen durch dieselbe Formatierung (`ppText`) und sahen deshalb aus wie dieselbe
   * Einheit. Die Klammer ist in diesem Panel die Score-Schreibweise (die Spieler-Chips
   * darunter schreiben "12,3 PP (48,7)").
   */
  const abbildMd10 = [
    { teamId: "N-N", punkte: 26.4, form: 184.3 },
    { teamId: "L-R", punkte: 25.6, form: 102.7 },
    { teamId: "D-P", punkte: 15.2, form: 86.8 },
    { teamId: "P-C", punkte: 13.6, form: 70.9 },
    { teamId: "W-W", punkte: 16.5, form: 69.6 },
    { teamId: "M-M", punkte: 20.7, form: 47.2 },
    { teamId: "H-R", punkte: 25.0, form: 35.3 },
    { teamId: "S-S", punkte: 12.3, form: -11.4 },
    { teamId: "Z-H", punkte: 20.7, form: 0 },
  ];

  it("die Messlage: der Form-Wert uebersteigt die Punkte-Spalte um ein Vielfaches", () => {
    const groesser = abbildMd10.filter((row) => Math.abs(row.form) > row.punkte);
    expect(groesser.map((row) => row.teamId)).toEqual(["N-N", "L-R", "D-P", "P-C", "W-W", "M-M", "H-R"]);
    // Der Spitzenfall aus dem Abbild, auf den sich der Kommentar im Panel beruft.
    expect(abbildMd10[0]).toEqual({ teamId: "N-N", punkte: 26.4, form: 184.3 });
    expect(abbildMd10[0]!.form / abbildMd10[0]!.punkte).toBeGreaterThan(6);
  });

  it("schreibt Score-Werte in Klammern — Punkte-Werte nicht", () => {
    expect(scoreText(184.3)).toBe("(+184.3)");
    expect(scoreText(-11.4)).toBe("(-11.4)");
    expect(scoreText(0)).toBe("(0)");
    expect(scoreText(null)).toBe("–");
    // Ein Score-Wert ist damit an jeder Stelle von einem Punkte-Wert unterscheidbar:
    // die Punkte-Spalte rendert "+26.4", die Form-Spalte "(+184.3)".
    for (const row of abbildMd10) {
      const gerendert = scoreText(row.form);
      expect(gerendert.startsWith("(")).toBe(true);
      expect(gerendert.endsWith(")")).toBe(true);
    }
  });

  it("GEGENPROBE: mit der alten Formatierung waren beide Spalten nicht zu unterscheiden", () => {
    const alteFormatierung = (value: number) =>
      Math.abs(value) < 0.05 ? "0" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
    // Punkte-Spalte und Form-Spalte lieferten Zeichenketten derselben Bauart …
    expect(alteFormatierung(26.4)).toBe("+26.4");
    expect(alteFormatierung(184.3)).toBe("+184.3");
    // … und die neue unterscheidet sie.
    expect(scoreText(184.3)).not.toBe(alteFormatierung(184.3));
  });
});

// ===================================================================================
// C · SAISONSTAND: der Bonus ist ein DAVON-Posten
// ===================================================================================
describe("Saisonstand · der Bonus steht nicht ein zweites Mal daneben", () => {
  /**
   * Gemessen ueber `buildTeamSeasonOverviewRows` an beiden aktiven Staenden, je 32 Teams:
   * `Σ Disziplin-Spalten − Punkte-Spalte == Bonus-Spalte`, Abweichung 0,0 bei 32 von 32.
   * Der Mutator-Aufschlag steckt also bereits in jeder Disziplin-Spalte (der Ledger bucht
   * `points = Anteil + mutatorPpsBonus`). Wer "Punkte + Bonus" liest, kommt richtig heraus;
   * wer "Σ Disziplinen + Bonus" liest, zaehlt um genau den Bonus zu viel.
   */
  const abbild = [
    // aktiver Save, Saison 1, Spieltag 2
    { save: "0kalpx", teamId: "P-C", punkte: 20.5, bonus: 0.3, summeDisziplinen: 20.8 },
    { save: "0kalpx", teamId: "C-S", punkte: 9.5, bonus: 1.2, summeDisziplinen: 10.7 },
    { save: "0kalpx", teamId: "W-W", punkte: 18.8, bonus: 0.0, summeDisziplinen: 18.8 },
    // Messkoerper, Saison 2, Spieltag 10
    { save: "1hf25q", teamId: "B-B", punkte: 77.6, bonus: 6.3, summeDisziplinen: 83.9 },
    { save: "1hf25q", teamId: "Z-H", punkte: 160.3, bonus: 5.1, summeDisziplinen: 165.4 },
    { save: "1hf25q", teamId: "H-R", punkte: 141.0, bonus: 6.0, summeDisziplinen: 147.0 },
  ];

  it("Punkte + Bonus ergibt die Disziplin-Summe — der Bonus ist darin enthalten", () => {
    for (const row of abbild) {
      expect(Number((row.punkte + row.bonus).toFixed(1)), `${row.save}/${row.teamId}`).toBe(row.summeDisziplinen);
    }
  });

  it("GEGENPROBE: 'Σ Disziplinen + Bonus' zaehlt genau um den Bonus zu viel", () => {
    for (const row of abbild) {
      const falscheLesart = Number((row.summeDisziplinen + row.bonus).toFixed(1));
      expect(Number((falscheLesart - row.summeDisziplinen).toFixed(1))).toBe(row.bonus);
    }
    // Groesste Ueberzaehlung im Messkoerper: B-B mit 6,3.
    expect(Math.max(...abbild.map((row) => row.bonus))).toBe(6.3);
  });

  it("die Spalte heisst 'dav. Bonus' und ihr Tooltip verbietet das Addieren", () => {
    const bonus = buildFoundationSeasonTableColumns().find((column) => column.id === "bonuspunkte");
    expect(bonus, "Bonus-Spalte fehlt im Saisonstand-Vertrag").toBeDefined();
    expect(bonus!.label).toBe("dav. Bonus");
    expect(bonus!.tooltip).toContain("DAVON-Posten");
    expect(bonus!.tooltip).toContain("nicht noch einmal");
  });
});

// ===================================================================================
// D · TAGESRANG: zwei Fragen, zwei Zahlen — die Spalte sagt jetzt, welche sie meint
// ===================================================================================
describe("Tagesrang · PP-Ausbeute und gebuchte Punkte ordnen verschieden", () => {
  /**
   * Vollstaendige Zeilen aus dem Messkoerper, `season-2-matchday-10`:
   * `sum` = gebuchte Disziplin-Punkte, `mutPp` = Mutator-Aufschlag (wird NICHT gebucht),
   * `total` = PP-Ausbeute des Tages. Das Arena-Panel ordnet nach `total`, das
   * Spieltags-Ergebnis (`lib/foundation/matchday-summary.ts`, `rankTeams(matchdayPoints)`)
   * nach `sum`. Gemessen wichen 17 von 32 Zeilen ab.
   */
  const md10 = [
    ["N-N", 26.4, 0.3], ["H-R", 25.0, 1.2], ["L-R", 25.6, 0.3], ["M-M", 20.7, 0.9],
    ["Z-H", 20.7, 0.9], ["B-P", 16.2, 0.3], ["W-W", 16.5, 0.0], ["D-P", 15.2, 0.6],
    ["P-C", 13.6, 0.3], ["L-K", 12.1, 0.3], ["S-S", 12.3, 0.0], ["C-S", 10.7, 0.6],
    ["T-C", 10.1, 1.2], ["R-L", 9.7, 1.2], ["P-S", 10.3, 0.3], ["V-D", 9.6, 0.6],
    ["B-B", 7.5, 1.5], ["T-T", 7.5, 0.9], ["S-C", 7.2, 0.6], ["M-S", 6.6, 0.9],
    ["W-L", 5.8, 1.5], ["D-L", 7.0, 0.3], ["A-A", 6.4, 0.6], ["V-W", 5.8, 0.6],
    ["G-G", 5.7, 0.0], ["R-C", 5.1, 0.6], ["T-G", 4.7, 0.3], ["V-V", 3.7, 0.3],
    ["R-R", 3.9, 0.0], ["N-W", 3.6, 0.0], ["U-A", 2.1, 0.0], ["C-C", 0.9, 0.6],
  ] as const;

  const rows = md10.map(([teamId, sum, mutPp]) => ({
    teamId,
    teamName: teamId,
    sum,
    mutPp,
    total: Number((sum + mutPp).toFixed(4)),
  }));

  // Nachbau von `rankTeams` aus lib/foundation/matchday-summary.ts: gebuchte Punkte,
  // Gleichstand nach Teamname.
  const ergebnisRang = new Map(
    [...rows]
      .sort((left, right) => right.sum - left.sum || left.teamName.localeCompare(right.teamName, "de"))
      .map((row, index) => [row.teamId, index + 1] as const),
  );

  it("die beiden Definitionen liefern an Spieltag 10 unterschiedliche Raenge", () => {
    const ppRang = resolveMatchdayRanks(rows);
    const abweichend = rows.filter((row) => ppRang.get(row.teamId) !== ergebnisRang.get(row.teamId));
    expect(abweichend.length).toBe(17);

    // Die beiden Faelle, die den Befund ausgeloest haben.
    expect(ppRang.get("H-R")).toBe(2);
    expect(ergebnisRang.get("H-R")).toBe(3);
    expect(ppRang.get("L-R")).toBe(3);
    expect(ergebnisRang.get("L-R")).toBe(2);
  });

  it("die Panel-Spalte ordnet nach der PP-Ausbeute — das ist ihre Frage", () => {
    const ppRang = resolveMatchdayRanks(rows);
    // H-R hat weniger gebuchte Punkte als L-R (25,0 < 25,6), aber mehr PP (26,2 > 25,9).
    expect(rows.find((r) => r.teamId === "H-R")!.total).toBeGreaterThan(
      rows.find((r) => r.teamId === "L-R")!.total,
    );
    expect(ppRang.get("H-R")!).toBeLessThan(ppRang.get("L-R")!);

    // GEGENPROBE: wuerde die Spalte nach `sum` ordnen, kehrte sich das Paar um — genau die
    // Zahl, die das Spieltags-Ergebnis zeigt.
    expect(ergebnisRang.get("H-R")!).toBeGreaterThan(ergebnisRang.get("L-R")!);
  });
});
