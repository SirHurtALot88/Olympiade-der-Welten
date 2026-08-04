/**
 * GEMELDET VON CHRIS (Seite „Spieltag · Saisonstand", Panel „Disziplinen nach Bereich",
 * data/bug-reports/bug-2026-08-04T13-22-34-347Z-pqcssb.json):
 *
 * „Können wir wenn wir die Punkte ausklappen, neben den geholten Punkten in den Diszis auch den
 * Rank schreiben? Also zb MIN (2) 5 # 3 — also 5 PPs geholt was rang 3 entspricht. Finde das ist
 * eine Info, die überall sein sollte, wo man PPs sieht, dass man sowohl bei den Teams als auch
 * Spielern sieht, welchem Rank das entspricht."
 *
 * Das Panel zeigte je Disziplin Kürzel, Teilnehmerzahl, Balken und PP-Zahl — aber nirgends, was
 * die Zahl in der Liga bedeutet. Die Rang-Rechnung dafür gab es längst: `buildValueRanks` ordnet
 * die Bereichsspalten der Tabelle. Sie war nur nie eine Ebene tiefer angewendet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const standings = readFileSync(join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("Saisonstand: der Rang steht hinter den geholten PPs", () => {
  it("rankt jede einzelne Disziplin gegen alle Teams", () => {
    expect(standings).toContain("const disciplineRanksByTeam = useMemo(");
    // Dieselbe Rechnung wie die Bereichsspalten — keine zweite, leicht andere Rangordnung.
    expect(standings).toContain("buildValueRanks(standingsRows, (row) => row.disciplineValues[key])");
  });

  it("haengt den Rang an die Disziplin-Zahl im Aufklapp-Panel", () => {
    expect(standings).toContain("disciplineRanksByTeam.get(key)?.get(row.teamId)");
  });

  it("haengt ihn genauso an den Bereichs-Wert darueber", () => {
    // Chris: „eine Info, die ueberall sein sollte, wo man PPs sieht" — auch eine Ebene hoeher.
    // Der Rang der Bereichsspalte wurde schon vorher berechnet, aber nur zum EINFAERBEN der
    // Tabellenzelle benutzt (getAreaRankBandClass); im Aufklapp-Panel stand er nirgends.
    expect(standings).toContain(
      "renderLeagueRankSuffix(areaRanksByTeam[group.id]?.get(row.teamId), group.label, areaValue)",
    );
  });

  it("schreibt keinen Rang neben eine Null", () => {
    // Zu Saisonbeginn stehen ganze Disziplinen auf 0. Ein „#28" neben einer 0 liest sich wie eine
    // Wertung, wo schlicht nichts passiert ist.
    const start = standings.indexOf("function renderLeagueRankSuffix");
    expect(start, "renderLeagueRankSuffix nicht gefunden").toBeGreaterThanOrEqual(0);
    const helper = standings.slice(start, standings.indexOf("\nfunction getAreaValue", start));
    expect(helper).toContain("value <= 0");
    expect(helper).toContain("return null;");
  });

  it("erklaert den Rang im Tooltip, statt ihn nur hinzuschreiben", () => {
    expect(standings).toContain("Liga-Rang ${rank} nach geholten PPs");
  });

  it("benutzt die vorhandene Rang-Schreibweise, statt eine zweite zu erfinden", () => {
    // Der Rang hinter Marktwert/Gehaeltern sagt dasselbe und sieht schon so aus — inklusive
    // Gold-Akzent fuer #1. Eine eigene Klasse waere eine Sprache zu viel.
    expect(standings).toContain('`nl-standings-rank-suffix nl-tnum${rank === 1 ? " is-top" : ""}`');
    // Und genau EINE Regel dafuer im Stylesheet, keine zweite daneben.
    const treffer = css.split(".is-new-look .nl-standings-rank-suffix {").length - 1;
    expect(treffer, "doppelte CSS-Regel fuer denselben Rang-Suffix").toBe(1);
  });
});
