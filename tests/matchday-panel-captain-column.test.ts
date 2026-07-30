/**
 * GEMELDET: „bisschen widersprüchlich wenn ein team in einer diszi einen captain setzt um besser zu
 * sein aber auch eine -8 form" — plus „Punkte, Form, Mutator und Gesamt bitte sauber nebeneinander"
 * und „füge dort noch Captain hinter Form hinzu".
 *
 * Der Widerspruch war ein Anzeige-Problem, kein Rechen-Problem: dass ein Team einen Captain gesetzt
 * hatte, stand nur als Chip am Teamnamen. Man sah also DASS einer gesetzt war, aber nicht, was er
 * gebracht hat — daneben eine dicke rote Form-Zahl, und die Zeile las sich, als hätte das Team
 * gegen sich selbst gespielt. Mit einer eigenen Spalte stehen beide Entscheidungen als Zahlen
 * nebeneinander und lassen sich gegeneinander lesen.
 *
 * `sortMatchdayPanelRows` ist echt aufrufbar und wird auch echt geprüft. Die Spalten-Form (Raster,
 * Zellen, Umbruch) liegt in einem großen Client-Panel und wird am Quelltext geprüft — dieselbe
 * Bauart wie bei den übrigen Panel-Verträgen in diesem Verzeichnis.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sortMatchdayPanelRows } from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

const PANEL = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);

function row(teamId: string, captainPp: number) {
  return {
    teamId,
    teamName: teamId,
    currentRank: null,
    projectedRank: null,
    d1Pts: null,
    d2Pts: null,
    sum: 0,
    mutPp: 0,
    formPp: 0,
    captainPp,
    total: 0,
  };
}

describe("Spieltags-Wertung: Captain als eigene Spalte", () => {
  it("sortiert nach dem Captain-Beitrag", () => {
    const rows = [row("a", 1.5), row("b", 0), row("c", 4.2)];
    expect(sortMatchdayPanelRows([...rows], { key: "captain", dir: "desc" }).map((e) => e.teamId)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(sortMatchdayPanelRows([...rows], { key: "captain", dir: "asc" }).map((e) => e.teamId)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("steht hinter Form und vor Mutator", () => {
    expect(PANEL).toMatch(/form:\s*6/);
    expect(PANEL).toMatch(/captain:\s*7/);
    expect(PANEL).toMatch(/mutator:\s*8/);
  });

  /**
   * Dieselbe Aufdeck-Regel wie bei Punkten, Form und Mutator — eine verdeckte Disziplin darf über
   * die Captain-Spalte nichts verraten.
   */
  it("respektiert die Aufdeck-Regel", () => {
    expect(PANEL).toContain(
      "(d1Revealed ? mods?.d1?.captainBonus ?? 0 : 0) + (d2Revealed ? mods?.d2?.captainBonus ?? 0 : 0)",
    );
  });

  /**
   * Der Captain-Beitrag steckt — wie die Form — bereits in den Disziplin-Punkten. Er darf in der
   * Gesamt-Spalte nicht ein zweites Mal addiert werden.
   */
  it("zählt nicht doppelt in die Gesamt-Spalte", () => {
    expect(PANEL).toContain("total: sum + mutPp,");
    expect(PANEL).not.toContain("sum + mutPp + captainPp");
  });

  /**
   * „Nicht gesetzt" und „hat nichts gebracht" sind verschiedene Aussagen. Eine 0 in der Spalte
   * würde behaupten, der Captain habe nichts bewirkt — dabei stand oft gar keiner in der Diszi.
   */
  it("zeigt einen Strich statt einer 0, wenn kein Captain gesetzt war", () => {
    expect(PANEL).toContain('"Kein Captain in den aufgedeckten Disziplinen"');
    // Bewusst ohne Einrückung im Muster: die exakte Formatierung ist Sache des Formatierers,
    // die Aussage ist "unter der Schwelle steht ein Strich, keine 0".
    expect(PANEL.replace(/\s+/g, " ")).toContain("Math.abs(row.captainPp) < 0.05 ? \"–\"");
  });
});
