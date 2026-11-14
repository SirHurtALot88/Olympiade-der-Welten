import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ARENA-REVIEW 14.11. (Darstellung & Animationen ueber alle 20 Disziplinen, echter Kader aus dem
 * aktiven Battle-Save). Vier reine Anzeige-Funde, alle ohne Einfluss auf die Wertung
 * (`scripts/pruefe-wertung-fingerabdruck.mjs` vorher = nachher):
 *   1. Pixel-Figuren lasen die KAMPF-Uhr `t`, die in Feldspiel/Buehne/Bahn stillsteht -- Gehzyklus
 *      eingefroren, jeder Sturz auf Bild 0 (aufrecht) festgehalten.
 *   2. Feldspiel: `u.vx` ist dort der Schritt je Tick, die Geh-Schwelle `>=3` (eine Geschwindigkeit)
 *      liess langsamere Laeufe in der Standpose gleiten.
 *   3. Tennis/Fechten/Speed-Schach: die Kopfzeile zeigte waehrend des Spiels eine Nullsumme
 *      ("1277 : -1277") statt eines Stands.
 *   4. Mini-DM-FFA: Spieler ohne PixelLab-Figur erschienen als farbiges Oval mit Initialen statt als
 *      Baukasten-Figur.
 */
const MOTOR = readFileSync(path.resolve(process.cwd(), "public", "mockups", "battle-mode.engine.js"), "utf8");

function funktion(kopf: string): string {
  const start = MOTOR.indexOf(kopf);
  expect(start, kopf + " nicht gefunden").toBeGreaterThan(-1);
  const ende = MOTOR.indexOf("\n  }\n", start);
  return MOTOR.slice(start, ende + 4);
}

const nurCode = (quelle: string) =>
  quelle
    .split("\n")
    .filter((z) => !z.trim().startsWith("//"))
    .join("\n");

describe("Arena-Review 14.11. · Anzeige-Uhr der Pixel-Figuren", () => {
  it("pixelAnzeigeUhr() liefert je Chassis die Uhr, die dort wirklich laeuft", () => {
    const quelle = funktion("  function pixelAnzeigeUhr(){");
    const fabrik = new Function(
      "istFeldspiel",
      "istBuehne",
      "istBahn",
      "disc",
      "fsT",
      "buehneT",
      "rennT",
      "t",
      `${quelle}\nreturn pixelAnzeigeUhr();`,
    );
    const uhr = (d: string) =>
      fabrik(
        (x: string) => x === "basketball",
        (x: string) => x === "eiskunstlauf",
        (x: string) => x === "climbing",
        d,
        11,
        22,
        33,
        44,
      );
    expect(uhr("basketball")).toBe(11);
    expect(uhr("eiskunstlauf")).toBe(22);
    expect(uhr("climbing")).toBe(33);
    expect(uhr("tdm")).toBe(44);
  });

  it("zeichnePixelFigur liest nur noch die Anzeige-Uhr, nie das nackte `t`", () => {
    const code = nurCode(funktion("  function zeichnePixelFigur(ctx,u,x,y,G,z,r0){"));
    expect(code).toContain("const T=pixelAnzeigeUhr();");
    expect(code).not.toMatch(/(?<![\w.$"'])t(?![\w$"'])/);
  });

  it("Feldspiel: jeder echte Schritt (u.vx je Tick) zaehlt als Gehen", () => {
    const code = nurCode(funktion("  function zeichnePixelFigur(ctx,u,x,y,G,z,r0){"));
    expect(code).toContain("(istFeldspiel(disc)&&schrittL1>0.25)");
  });
});

describe("Arena-Review 14.11. · Duell-Kopfzeile (Tennis/Fechten/Speed-Schach)", () => {
  type Teilnehmer = { side: number; brett: number; aktuell: number; verlauf: number[]; treffer?: number };
  function stand(teilnehmer: Teilnehmer[], fechten: boolean, done = false): string {
    const quelle = funktion("  function buehneDuellStandText(){");
    const fabrik = new Function(
      "BB",
      "TEILNEHMER",
      "done",
      "duellBretterGewonnen",
      `${quelle}\nreturn buehneDuellStandText();`,
    );
    return fabrik(() => ({ fechten }), teilnehmer, done, () => 9);
  }
  // Drei Bretter, Vorteil wie im Motor je Spieler aus eigener Sicht (Nullsumme).
  const bretter = (werte: number[], treffer?: Array<[number, number]>): Teilnehmer[] =>
    werte.flatMap((v, i) => [
      { side: 0, brett: i, aktuell: 0, verlauf: [v], treffer: treffer?.[i]?.[0] },
      { side: 1, brett: i, aktuell: 0, verlauf: [-v], treffer: treffer?.[i]?.[1] },
    ]);

  it("zeigt waehrend des Spiels, wie viele Bretter jede Seite vorn hat -- keine Nullsumme mehr", () => {
    expect(stand(bretter([120, -40, 300]), false)).toBe("2 : 1");
    expect(stand(bretter([120, -40, 300]), false)).not.toMatch(/-/);
  });

  it("gleichstehende/noch nicht begonnene Bretter zaehlen fuer niemanden", () => {
    expect(stand(bretter([0, 0, 5]), false)).toBe("1 : 0");
  });

  it("Fechten liest den laufenden Trefferstand, nicht den Vorteil", () => {
    // Vorteil spricht fuer Seite 0, die Treffer auf zwei Bahnen fuer Seite 1.
    expect(stand(bretter([50, 50, 50], [[1, 4], [2, 3], [5, 5]]), true)).toBe("0 : 2");
  });

  it("nach dem Abpfiff bleibt es bei den Brettsiegen (duellBretterGewonnen)", () => {
    expect(stand(bretter([120, -40, 300]), false, true)).toBe("9 : 9");
  });
});

describe("Arena-Review 14.11. · Mini-DM-FFA ohne eigene Figur", () => {
  it("zeichnet die Baukasten-Figur (zeichneSprite) vor dem Oval-Notnagel", () => {
    const start = MOTOR.indexOf("    function figur(k,now,p){");
    expect(start).toBeGreaterThan(-1);
    const block = MOTOR.slice(start, MOTOR.indexOf("const fig=zf.fig;", start));
    const sprite = block.indexOf("zeichneSprite(cx,stell,0,-PIXEL_FUSS);");
    const oval = block.indexOf("cx.ellipse(0,-34,18,34,0,0,Math.PI*2)");
    expect(sprite).toBeGreaterThan(-1);
    expect(oval).toBeGreaterThan(sprite);
  });
});
