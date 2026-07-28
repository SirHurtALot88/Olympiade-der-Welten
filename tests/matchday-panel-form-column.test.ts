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

  it("haelt Kopf und Datenzeile im selben Raster", () => {
    const panel = read("app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx");
    const columnCount = (panel.match(/const PANEL_GRID_COLUMNS = "([^"]+)"/)?.[1] ?? "").split(/\s+/).length;
    // Tagesrang · Saison-Rang · Team · D1 · D2 · Punkte · Form · Mutator · Gesamt
    expect(columnCount).toBe(9);
    // Beide Renderpfade teilen sich dieselbe Konstante.
    expect(panel.match(/gridTemplateColumns: PANEL_GRID_COLUMNS/g)?.length).toBe(2);
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

  it("leitet die Zeilenhoehe aus der verfuegbaren Hoehe ab, statt sie fest zu setzen", () => {
    expect(native).toContain("const LADDER_ROW_H = useMemo(");
    expect(native).toContain("Math.max(LADDER_ROW_MIN_H, Math.min(LADDER_ROW_MAX_H, available / N))");
    // Der Kopfblock wird gemessen, sonst muesste seine Hoehe geraten werden.
    expect(native).toContain("ladderHeadRef");
  });

  it("klebt nicht mehr per sticky, damit nichts gegenueber der Arena wandert", () => {
    expect(native).not.toContain('position: done ? "static" : "sticky"');
  });
});
