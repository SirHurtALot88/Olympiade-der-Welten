/**
 * NEGATIVER KONTOSTAND MUSS IM SAISONSTAND ALS WARNUNG ERKENNBAR SEIN.
 *
 * GEMELDET VON CHRIS: „bitte den aktuellen Cash stand auch rot markieren wenn der negativ sein
 * sollte!" (Seite „Spieltag · Saisonstand".)
 *
 * WAS VORHER WAR: die Cash-Zelle bekam gar keine Zustandsklasse und stand damit in derselben
 * gedämpften Farbe wie jede andere Finanzzahl — ein Team im Minus war beim Überfliegen nicht von
 * einem gesunden zu unterscheiden. Die Auszeichnung dafür gab es in dieser Tabelle längst
 * (`.nl-standings-td-fin.is-neg`, `app/globals.css`), die Nachbarspalte Sponsoren nutzt das
 * Gegenstück `is-pos` sogar in derselben Zeile.
 *
 * NUR DIE NEGATIVE SEITE, und das ist Absicht: färbte man positives Cash grün, leuchtete die halbe
 * Spalte, und die eine echte Warnung ginge darin unter. Die Meldung bittet auch nur um Rot.
 *
 * Ein Quelltext-Test, weil die Fehlerklasse „die Klasse wird beim nächsten Umbau wieder vergessen"
 * genau so und nicht über das Verhalten zu fassen ist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const QUELLE = readFileSync(
  join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"),
  "utf8",
);

describe("Saisonstand: negativer Cash-Stand ist rot", () => {
  it("die Cash-Zelle setzt is-neg, wenn der Stand unter null liegt", () => {
    expect(QUELLE).toMatch(/\(row\.cash \?\? 0\) < 0 \? " is-neg" : ""/);
  });

  it("die Cash-Zelle wird nicht mehr ohne Zustandsklasse ausgegeben", () => {
    // Genau die alte Zeile — sie darf nicht zurückkehren.
    expect(QUELLE).not.toContain('<td className="nl-standings-td-fin">{formatNlMoney(row.cash)}</td>');
  });

  it("positives Cash bleibt ohne Auszeichnung — keine gruene Spalte", () => {
    // NUR die Cash-Zelle betrachten. Ein zu weit gefasster Ausschnitt greift in die NACHBARzelle
    // (Sponsoren), und die traegt `is-pos` voellig zurecht — daran waere der Test gescheitert,
    // ohne dass am Cash etwas falsch gewesen waere.
    const start = QUELLE.indexOf("(row.cash ?? 0) < 0");
    const zelle = QUELLE.slice(start, QUELLE.indexOf("</td>", start));
    expect(zelle).not.toContain("is-pos");
  });

  it("die verwendete Klasse existiert im Stylesheet", () => {
    // Ohne diese Zusicherung koennte der Test gruen sein, waehrend im Spiel nichts rot wird.
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain(".nl-standings-td-fin.is-neg");
  });
});
