/**
 * AUFSTELLUNG · KAMPFWERTE NUR ALS GANZE ZAHLEN (Chris, 08.11.: "bitte nur gerade Zahlen zeigen").
 *
 * Die aufgeklappte Spielerkarte in der Aufstellung (renderBoard) zeigte
 * "LP 89.48130901737728 · ANG 82.36347761826772 · VER 95.58230735947119 · TMP 32",
 * weil aufEignung() LP/ANG/VER mit einem krummen Faktor skaliert. `battle-mode.engine.js`
 * ist ein browsergebundenes IIFE ohne Exporte; geprueft wird deshalb der echte Quelltext:
 * die Anzeigehelfer werden herausgeschnitten und mit Fliesskommawerten ausgefuehrt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MOTOR = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");

function ladeKampfwerteZeile(): (s: Record<string, number>) => string {
  const helfer = MOTOR.match(/const kampfzahl=\(x\)=>[^\n]*\n/);
  const zeile = MOTOR.match(/function kampfwerteZeile\(s\)\{[\s\S]*?\n {2}\}\n/);
  expect(helfer, "kampfzahl fehlt im Motor").not.toBeNull();
  expect(zeile, "kampfwerteZeile fehlt im Motor").not.toBeNull();
  // eslint-disable-next-line no-new-func
  return new Function(`${helfer![0]}${zeile![0]}return kampfwerteZeile;`)() as (s: Record<string, number>) => string;
}

describe("Battle Arena · Aufstellung zeigt gerundete Kampfwerte", () => {
  it("rundet Fliesskomma-Kampfwerte auf ganze Zahlen", () => {
    const zeile = ladeKampfwerteZeile()({
      LP: 89.48130901737728,
      ANG: 82.36347761826772,
      VER: 95.58230735947119,
      TMP: 32,
    });
    expect(zeile).toBe("LP 89 · ANG 82 · VER 96 · TMP 32");
    expect(zeile).not.toMatch(/\d\.\d/);
  });

  it("die Spielerkarte in renderBoard nutzt den Rundungshelfer statt roher s.LP/s.ANG/s.VER", () => {
    expect(MOTOR).toContain('u.appendChild(el("span",null,kampfwerteZeile(s)));');
    expect(MOTOR).not.toMatch(/"LP "\+s\.LP\+/);
    // Auch die Tooltips der Prozentzeile duerfen keine rohen Werte mehr einsetzen.
    expect(MOTOR).not.toMatch(/\("\+s\.LP\+" × "/);
    expect(MOTOR).not.toMatch(/er steht bei "\+s\.ANG\+"/);
    expect(MOTOR).not.toMatch(/mit VER "\+s\.VER\+"/);
  });
});
