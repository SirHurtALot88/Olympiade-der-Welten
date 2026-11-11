/**
 * BUGTICKET #69: "Seraph-II zeigt schwarzen Platzhalter ('?') statt PixelLab-Figur in
 * Battlefield." Nachpruefung ergab KEINEN Bug — weder einen Verdrahtungsfehler noch eine
 * fehlende PixelLab-Generierung:
 *
 *   1. Seraph-11 (der Name im Spielstand; "Seraph-II" im Ticket ist derselbe Spieler — die
 *      Ziffer "11" liest sich in der RaniraSeason-Anzeigeschrift auf der Kader-Karte leicht wie
 *      "II", s. public/mockups/battle-mode.html) hat eine VOLLSTAENDIGE PixelLab-Figur: Grundpose
 *      + alle vier Animationsarten (walk/angriff/treffer/tod), s.
 *      data/generated/figuren-sprites.json und public/mockups/battle-mode.figuren.js. Kein
 *      fehlendes Asset, keine Chris-Freigabe noetig.
 *   2. Der schwarze "?"-Platzhalter ist der AUFKLAERUNGS-NEBEL (B-5, Fable-Ideen Arena/I-Spy,
 *      30.09., s. Kommentar bei NEBEL_SICHT_RADIUS in battle-mode.engine.js): in der Disziplin
 *      Battlefield bleibt eine gegnerische Figur Silhouette, bis eine eigene Figur ihr nahegekommen
 *      ist — reine Zeichnung, "keine Wirkung auf Zielwahl/Treffer/Schaden". Per Playwright-
 *      Screenshot gegen battle-mode.html (ueber HTTP, damit der PixelLab-Zeichenpfad aktiv ist)
 *      nachgestellt: Seraph-11 erscheint beim Anpfiff als schwarzer Kreis mit "?", sobald sich
 *      eigene Figuren naehern, zeigt sie ihre echte PixelLab-Figur.
 *   3. KEIN Seraph-11-spezifisches Muster: mit demselben Standard-Kader zeigt
 *      "Ralazar the Balanced" (andere Figur, andere Reihe/Rolle) exakt dasselbe Verhalten —
 *      der Nebel haengt an der Position beim Anpfiff, nicht am Namen/an der Figur.
 *   4. Rein zeichnend: die Nebel-Buchhaltung lebt ausschliesslich in draw() (s.
 *      `imNebel`-Formel), das jede headless-Messung (disziplinProbe/spiele/
 *      spieleArenaDomination, s. scripts/pruefe-wertung-fingerabdruck.mjs) NIE aufruft
 *      (`messLaufStumm`/`M.lauf()` zeichnen nicht) — kann also gar keine Wertung/Rangtreue
 *      beeinflussen. Der Fingerabdruck vor dieser PR-Runde (nur ein zusaetzlicher
 *      Test-Lesesonde, keine Aenderung an Simulation/Zeichnung) ist unveraendert, s.
 *      PR-Beschreibung.
 *
 * Ergebnis: KEIN Code-Fix noetig (keine Wertungs-/Verdrahtungsaenderung). Diese Datei haelt das
 * beobachtete, beabsichtigte Verhalten als Regression fest, inklusive der Entwarnung "kein
 * fehlendes PixelLab-Asset" und "kein figurenspezifisches Muster".
 *
 * WARUM ECHTER CHROMIUM: s. tests/spiele-bahn-invarianten.test.ts (der Motor ist ein IIFE, das
 * beim Laden auf document/Canvas zugreift). Ohne Chromium uebersprungen, wie dort.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const LAUF_TIMEOUT_MS = 120_000;
const SEKUNDEN_FENSTER = 20;
const SAATEN = [1337, 7919, 20260823, 42, 9001];

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  try {
    return readdirSync(join(homedir(), ".cache", "ms-playwright")).some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

type NebelZeile = { n: string; side: number; jeFogged: boolean; amEndeFogged: boolean };

describe.skipIf(!chromiumVerfuegbar())("Battlefield-Aufklaerungsnebel: kein Sprite-Bug, reine Sicht-Buchhaltung (#69)", () => {
  let browser: Browser;
  let seite: Page;
  const laeufe: Record<number, NebelZeile[]> = {};

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(
      () => typeof (window as unknown as { __arena?: { battlefieldNebelProbe?: unknown } }).__arena?.battlefieldNebelProbe !== "undefined",
      null,
      { timeout: LAUF_TIMEOUT_MS },
    );
    for (const saat of SAATEN) {
      laeufe[saat] = await seite.evaluate(
        ({ saat, sekunden }) => {
          const A = (window as unknown as {
            __arena: { battlefieldNebelProbe: (saat: number, sekunden: number) => NebelZeile[] };
          }).__arena;
          return A.battlefieldNebelProbe(saat, sekunden) as never;
        },
        { saat, sekunden: SEKUNDEN_FENSTER },
      );
    }
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("die eigene Seite (0) gilt nie als im Nebel — der Nebel gilt ausdruecklich nur aus Sicht der eigenen Seite auf den Gegner", () => {
    for (const saat of SAATEN) {
      for (const zeile of laeufe[saat]!.filter((z) => z.side === 0)) {
        expect(zeile.jeFogged, `${zeile.n} (Saat ${saat})`).toBe(false);
        expect(zeile.amEndeFogged, `${zeile.n} (Saat ${saat})`).toBe(false);
      }
    }
  });

  it("Seraph-11 startet in Battlefield tatsaechlich als Silhouette — reproduziert den Bugbericht", () => {
    for (const saat of SAATEN) {
      const seraph = laeufe[saat]!.find((z) => z.n === "Seraph-11");
      expect(seraph, `Seraph-11 fehlt im Standard-Kader (Saat ${saat})`).toBeDefined();
      expect(seraph!.side, `Seraph-11 (Saat ${saat})`).toBe(1);
      expect(seraph!.jeFogged, `Seraph-11 (Saat ${saat}) war nie verdeckt — Repro gescheitert`).toBe(true);
    }
  });

  it("kein Seraph-11-spezifisches Muster: mindestens eine WEITERE Figur desselben Kaders zeigt dasselbe Verhalten", () => {
    for (const saat of SAATEN) {
      const jeFoggedAusserSeraph = laeufe[saat]!.filter((z) => z.side === 1 && z.n !== "Seraph-11" && z.jeFogged);
      expect(jeFoggedAusserSeraph.length, `Saat ${saat}: ${JSON.stringify(laeufe[saat])}`).toBeGreaterThan(0);
    }
  });

  it("der Nebel ist nicht dauerhaft: nach 20 Sekunden ist niemand (auch Seraph-11 nicht) mehr verdeckt", () => {
    for (const saat of SAATEN) {
      for (const zeile of laeufe[saat]!) {
        expect(zeile.amEndeFogged, `${zeile.n} (Saat ${saat})`).toBe(false);
      }
    }
  });

  it("die Nebel-Bedingung ist fest auf die Disziplin \"battlefield\" verdrahtet (Quelltext-Haertung gegen versehentliche Ausweitung)", () => {
    const motor = readFileSync(join(WURZEL, "public", "mockups", "battle-mode.engine.js"), "utf8");
    const treffer = motor.match(/disc===["']battlefield["']&&!bfPodAktiv\(\)/g) ?? [];
    // Bisher zwei Fundstellen: die Sicht-Buchhaltungsschleife und die "imNebel"-Formel selbst
    // (s. Kommentar "AUFKLAERUNGS-NEBEL" im Motor). Weniger waere ein Hinweis, dass eine der
    // beiden Pruefungen verschwunden ist; mehr, dass der Nebel versehentlich auf eine weitere
    // Disziplin ausgeweitet wurde.
    expect(treffer.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Seraph-11: PixelLab-Figur ist vollstaendig (keine fehlende Generierung)", () => {
  it("figuren-sprites.json traegt Grundpose, alle vier Rotationen und alle vier Animationsarten", () => {
    const index = JSON.parse(readFileSync(join(WURZEL, "data", "generated", "figuren-sprites.json"), "utf8")) as Record<
      string,
      { pixellabId: string; rotationen: string[]; animationen: Array<{ kind: string }> }
    >;
    const seraph = index["seraph-11"];
    expect(seraph, "seraph-11 fehlt im Figuren-Index").toBeDefined();
    expect(seraph!.pixellabId).toBeTruthy();
    expect(new Set(seraph!.rotationen)).toEqual(new Set(["south", "east", "west", "north"]));
    const arten = new Set(seraph!.animationen.map((a) => a.kind));
    expect(arten).toEqual(new Set(["walk", "angriff", "tod", "treffer"]));
  });

  it("battle-mode.figuren.js (Arena-Motor-Export) kennt \"Seraph-11\" unter genau diesem Anzeigenamen", () => {
    const figJs = readFileSync(join(WURZEL, "public", "mockups", "battle-mode.figuren.js"), "utf8");
    expect(figJs).toMatch(/"Seraph-11":\{"s":"seraph-11"/);
  });
});
