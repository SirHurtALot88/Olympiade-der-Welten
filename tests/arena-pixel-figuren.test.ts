import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { baueArenaFigurenQuelle, baueArenaFigurenTabelle, leseArenaFigurenEingaben } from "../scripts/baue-arena-figuren.mjs";

/**
 * PIXEL-FIGUREN IM ARENA-MOTOR (02.11.): zweiter Zeichenpfad in zeichneSprite() fuer Spieler
 * mit eigenem PixelLab-Satz. Die Tests halten die drei Zusagen fest, die die Aenderung
 * ungefaehrlich machen:
 *   1. die Namens-Tabelle (battle-mode.figuren.js) ist aus dem Figuren-Index generiert und
 *      aktuell — keine von Hand gepflegte zweite Wahrheit;
 *   2. der Pfad ist rein zeichnend: kein Zufall, keine Schreibzugriffe auf die Einheit;
 *   3. unter file:// (Headless-Runner, Messskripte) bleibt er aus — dort laeuft der Motor
 *      bit-identisch wie vorher, inklusive aller Leinwand-Messungen.
 */
const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const MOTOR = readFileSync(path.join(MOCKUPS, "battle-mode.engine.js"), "utf8");
const HUELLE = readFileSync(path.join(MOCKUPS, "battle-mode.html"), "utf8");

function pixelModul(): string {
  const start = MOTOR.indexOf("// PIXEL-FIGUREN (PixelLab, 02.11.)");
  const ende = MOTOR.indexOf("\n  function zeichnePixelFigur(", start);
  const endeFn = MOTOR.indexOf("\n  }\n", ende);
  expect(start).toBeGreaterThan(-1);
  expect(ende).toBeGreaterThan(start);
  // Nur Code, keine Kommentarzeilen (die erklaeren u.a. "kein rr()").
  return MOTOR.slice(start, endeFn)
    .split("\n")
    .filter((zeile) => !zeile.trim().startsWith("//"))
    .join("\n");
}

describe("Arena · PixelLab-Figuren statt Baukasten", () => {
  it("battle-mode.figuren.js ist aus Figuren-Index + Spielerliste generiert und aktuell", () => {
    const { index, spieler } = leseArenaFigurenEingaben();
    const erwartet = baueArenaFigurenQuelle(index, spieler);
    const ist = readFileSync(path.join(MOCKUPS, "battle-mode.figuren.js"), "utf8");
    expect(ist, "veraltet — `node scripts/baue-arena-figuren.mjs` laufen lassen").toBe(erwartet);
  });

  it("jede Figur im Index ist genau einem Spielernamen zugeordnet", () => {
    const { index, spieler } = leseArenaFigurenEingaben();
    const tabelle = baueArenaFigurenTabelle(index, spieler) as Record<string, { s: string }>;
    const slugs = Object.values(tabelle).map((e) => e.s);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(slugs)).toEqual(new Set(Object.keys(index)));
  });

  it("die Huelle laedt die Figuren-Tabelle VOR dem Motor", () => {
    const fig = HUELLE.indexOf('<script src="battle-mode.figuren.js"></script>');
    const motor = HUELLE.indexOf('<script src="battle-mode.engine.js"></script>');
    expect(fig).toBeGreaterThan(-1);
    expect(fig).toBeLessThan(motor);
  });

  it("der Pixel-Pfad ist rein zeichnend: kein Zufall, keine Zuweisung an die Einheit", () => {
    const modul = pixelModul();
    expect(modul).not.toMatch(/\brr\(/);
    expect(modul).not.toMatch(/Math\.random/);
    // Keine Schreibzugriffe der Form `u.feld=` / `u.feld+=` (Vergleiche `u.x===` sind erlaubt).
    expect(modul).not.toMatch(/\bu\.[A-Za-z_]+\s*(?:[+\-*/]?=)(?!=)/);
  });

  it("unter file:// bleibt der Pfad aus (Headless-Runner/Messungen unveraendert)", () => {
    expect(MOTOR).toMatch(/const PIXEL_FIGUR_AKTIV=/);
    expect(MOTOR).toContain("/^https?:$/.test(window.location.protocol)");
    expect(MOTOR).toContain("const PIXEL_FIGUREN=(PIXEL_FIGUR_AKTIV&&");
  });

  it("ohne geladene Figur faellt zeichneSprite() auf den alten Bauplan zurueck", () => {
    const start = MOTOR.indexOf("  function zeichneSprite(ctx,u,x,y,feldspiel){");
    const kopf = MOTOR.slice(start, start + 1500);
    expect(kopf).toContain("const pixFig=pixelFigurBereit(u.n);");
    expect(kopf).toContain("const b=pixFig?BAU_PIXEL:(BAU[u.n]||BAU_STD);");
  });
});
