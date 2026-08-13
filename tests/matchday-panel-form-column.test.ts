import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MATCHDAY_PANEL_DEFAULT_SORT,
  sortMatchdayPanelRows,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

function row(teamId: string, formPp: number, total = 0) {
  return {
    teamId,
    teamName: teamId,
    currentRank: null,
    projectedRank: null,
    d1Pts: null,
    d2Pts: null,
    sum: 0,
    mutPp: 0,
    formPp,
    total,
  };
}

/**
 * Die Spieltags-Wertung zeigte den Formkarten-Einsatz nur als kleine Chips am
 * Teamnamen. Damit liess sich nicht beantworten, ob der Kartensatz an diesem
 * Spieltag gepasst hat — dafuer braucht es eine ordenbare Spalte.
 */
describe("Spieltags-Wertung: Form als eigene Spalte", () => {
  it("sortiert nach dem Formkarten-Beitrag", () => {
    const rows = [row("a", -2), row("b", 3), row("c", 0)];

    const desc = sortMatchdayPanelRows([...rows], { key: "form", dir: "desc" });
    expect(desc.map((entry) => entry.teamId)).toEqual(["b", "c", "a"]);

    const asc = sortMatchdayPanelRows([...rows], { key: "form", dir: "asc" });
    expect(asc.map((entry) => entry.teamId)).toEqual(["a", "c", "b"]);
  });

  it("laesst die Vorgabe-Sortierung unangetastet (Spieltagsergebnis, nicht Form)", () => {
    expect(MATCHDAY_PANEL_DEFAULT_SORT).toEqual({ key: "total", dir: "desc" });
  });

  it("weist den Beitrag aus, ohne ihn ein zweites Mal zu addieren", () => {
    const panel = read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");
    // Die Gesamt-Spalte bleibt Punkte + Mutator — Form steckt bereits in den
    // Disziplin-Punkten und darf nicht doppelt zaehlen.
    expect(panel).toContain("total: sum + mutPp,");
    expect(panel).not.toContain("total: sum + mutPp + formPp");
  });

  it("respektiert die Aufdeck-Regel: verdeckte Disziplinen tragen nichts bei", () => {
    const panel = read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");
    expect(panel).toContain(
      "(d1Revealed ? mods?.d1?.formModifier ?? 0 : 0) + (d2Revealed ? mods?.d2?.formModifier ?? 0 : 0)",
    );
  });

  it("haelt Kopf und Team-Block im selben Raster", () => {
    const panel = read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");
    const columnCount = (panel.match(/const PANEL_GRID_COLUMNS = "([^"]+)"/)?.[1] ?? "").split(/\s+/).length;
    // Tagesrang · Saison-Rang · Wappen · Team · Punkte · Form · Captain · Mutator · Gesamt.
    // Die beiden Disziplin-SPALTEN sind entfallen: ihre Werte stehen jetzt in den
    // Disziplin-Zeilen unter dem Team. Das Wappen hat eine eigene Spalte, weil es ueber
    // den ganzen Team-Block laeuft. Captain kam hinzu — er stand vorher nur als Chip am
    // Teamnamen, man sah also DASS einer gesetzt war, aber nicht, was er gebracht hat.
    expect(columnCount).toBe(9);
    // Nur noch ZWEI Renderpfade: der Kopf und der Team-Block. Die Disziplin-Zeilen sind
    // keine eigenen Raster mehr, sondern Zeilen im Raster des Team-Blocks — genau
    // deshalb koennen sie mit dem Wappen ueberhaupt eine gemeinsame Spalte teilen.
    expect(panel.match(/gridTemplateColumns: PANEL_GRID_COLUMNS/g)?.length).toBe(2);
    // Und die Spaltenindizes kommen aus EINER Quelle, statt an jeder Zelle zu stehen.
    // Bewusst feldweise geprueft statt als ein Literal-String: die Schreibweise (ein-
    // oder mehrzeilig) ist Formatierung, die Reihenfolge ist die Aussage.
    for (const [name, index] of [
      ["rank", 1],
      ["seasonRank", 2],
      ["crest", 3],
      ["team", 4],
      ["points", 5],
      ["form", 6],
      ["captain", 7],
      ["mutator", 8],
      ["total", 9],
    ] as const) {
      expect(panel, `COL.${name} soll ${index} sein`).toMatch(new RegExp(`${name}:\\s*${index}\\b`));
    }
  });

  /**
   * Die Spaltenkoepfe standen nicht auf einer Linie: "◆ MUTATOR ▼" ist in Versalien mit
   * Sperrung das laengste Label und brach in seiner Spalte um — die Raute landete auf einer
   * eigenen Zeile und schob das Wort nach unten. Beides zusammen haelt das ab: die Koepfe
   * brechen nie um, und die Spalte ist breit genug.
   */
  it("die Spaltenkoepfe brechen nicht um", () => {
    const panel = read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");
    // Endmarke AB der Startposition suchen: `{label}` steht auch in den Chips weiter oben,
    // ein blankes indexOf lieferte sonst eine Endmarke VOR dem Anfang und damit einen
    // leeren Ausschnitt — der Test waere gruen geblieben, ohne irgendetwas zu pruefen.
    const buttonStart = panel.indexOf("const sortButton =");
    const button = panel.slice(buttonStart, panel.indexOf("{label}", buttonStart));
    expect(buttonStart, "sortButton nicht gefunden").toBeGreaterThan(-1);
    expect(button.length, "leerer Ausschnitt — die Marken passen nicht mehr").toBeGreaterThan(100);
    expect(button).toContain('whiteSpace: "nowrap"');
    const widths = (panel.match(/const PANEL_GRID_COLUMNS = "([^"]+)"/)?.[1] ?? "").split(/\s+/);
    // Mutator-Spalte (Index 7, 0-basiert) traegt das laengste Label.
    expect(Number.parseInt(widths[7] ?? "0", 10)).toBeGreaterThanOrEqual(88);
  });
});

describe("Spieltags-Wertung: Disziplin 1 wird sofort nach ihrem Abschluss aufgedeckt", () => {
  const arena = read("app/foundation/discipline-stage/DisciplineStageArena.tsx");

  it("deckt d1 auf, sobald d1 in dieser Sitzung durchgelaufen ist", () => {
    expect(arena).toContain(
      "Boolean(matchdayPanel.d1?.disciplineId && endedDisciplineIds.has(matchdayPanel.d1.disciplineId)) ||",
    );
  });

  it("verraet d1 nicht mehr allein dadurch, dass man d2 im Dropdown anwaehlt", () => {
    // Frueher: `d2 === disciplineId ? true : …` — das blosse Umschalten auf
    // Disziplin 2 zeigte Aufstellung und Karten von Disziplin 1, bevor sie lief.
    expect(arena).not.toContain("matchdayPanel.d2?.disciplineId === disciplineId\n                ? true");
    expect(arena).toContain("matchdayPanel.teamResults.some((row) => row.d1Points != null)");
  });
});

describe("Arena-Ladder: gleiche Hoehe wie die Arena, ohne Innen-Scroll", () => {
  const native = read("app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx");

  it("streckt die Ladder-Spalte auf die Hoehe der Arena-Hauptspalte", () => {
    expect(native).toContain('alignItems: "stretch"');
    // `height` statt `maxHeight`: kurze Listen liessen sonst ein Loch darunter.
    expect(native).toContain("height: ladderMaxH ?? undefined");
    expect(native).not.toContain("maxHeight: ladderMaxH");
  });

  /**
   * HIER STAND DIE RECHNUNG ALS ZEICHENKETTE
   * (`toContain("Math.max(LADDER_ROW_MIN_H, Math.min(LADDER_ROW_MAX_H, available / N))")`).
   * Sie ist zerbrochen, als die Rechnung nach `lib/matchday-arena/arena-ladder-metrics.ts`
   * gewandert ist — obwohl sie dort seither ueber WERTE geprueft wird
   * (tests/arena-tabelle-auf-einer-linie.test.ts: Polster- und Rahmenabzug, exakte
   * Ausfuellung, Kappung nach oben und unten, Rueckfallwert).
   *
   * Die Zeichenketten-Fassung haette ohnehin nichts belegt: sie waere auch dann gruen
   * geblieben, wenn `available` falsch berechnet worden waere, und sie kippte bei einer
   * reinen Umbenennung. Hier bleibt nur, was sich HIER und nur hier sagen laesst: die
   * Komponente rechnet nicht selbst, sondern benutzt die eine geteilte Stelle — und sie
   * MISST den Kopfblock, statt seine Hoehe zu raten.
   */
  it("rechnet die Zeilenhoehe nicht selbst, sondern ueber die geteilte Stelle — und misst den Kopf", () => {
    expect(native).toContain("resolveArenaLadderRowHeight");
    expect(native).toContain("ladderHeadRef");
    // Kein zweiter, eigener Rechenweg neben der geteilten Stelle.
    expect(native).not.toContain("Math.min(LADDER_ROW_MAX_H");
  });

  it("klebt nicht mehr per sticky, damit nichts gegenueber der Arena wandert", () => {
    expect(native).not.toContain('position: done ? "static" : "sticky"');
  });
});
