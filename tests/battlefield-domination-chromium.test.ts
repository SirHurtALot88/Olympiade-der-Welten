/**
 * BATTLEFIELD-DOMINATION IM ECHTEN MOTOR (Task #198, Chris 27.10.).
 *
 * „bei battlefield und 2 spielern müssen alle agieren, auch der commander und der spotter können
 * und sollen ja felder einnehmen bzw es versuchen. Spieler müssen auch rotieren und taktisch
 * agieren, es soll keine fixe aufteilung sein wer an welchem slot ist".
 *
 * Geprueft ueber `window.__arena.spieleArenaDomination("battlefield", saat, {jeSeite: k})`, das je
 * Kaempfer Rolle, Eroberungsanteil und die angesteuerten Orte zurueckgibt:
 *   1. Der Motor spielt je k genau die Rollen der Aufstellung (BATTLEFIELD_SLOTS_JE_K) — bei 2
 *      gegen 2 also KEIN Commander/Spotter, bei 6 gegen 6 alle sechs.
 *   2. JEDE Rolle erobert: ueber die Saaten traegt jede Rolle Eroberungsfortschritt bei —
 *      ausdruecklich auch Commander und Spotter.
 *   3. KEINE feste Ort-Bindung: jede Rolle steuert ueber die Saaten mindestens zwei der drei
 *      Orte an, und es gibt Ortswechsel waehrend des Spiels (Rotation).
 *
 * WARUM ECHTER CHROMIUM: s. tests/spiele-bahn-invarianten.test.ts (der Motor ist ein IIFE, das
 * beim Laden auf document/Canvas zugreift). Ohne Chromium uebersprungen, wie dort.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(
  join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.html"),
).href;
const LAUF_TIMEOUT_MS = 240_000;
const SAATEN = 12;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  try {
    return readdirSync(join(homedir(), ".cache", "ms-playwright")).some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

type Kaempfer = { side: number; slot: string; erob: number; wechsel: number; besucht: number[] };
type Spiel = { kaempfer: Kaempfer[]; besitz: Array<number | null> };

const ERWARTET: Record<number, string[]> = {
  2: ["moraleanchor", "siegecore"],
  4: ["commander", "fieldcontrol", "moraleanchor", "siegecore"],
  6: ["commander", "disruptor", "fieldcontrol", "moraleanchor", "siegecore", "spotter"],
};

describe.skipIf(!chromiumVerfuegbar())("Battlefield-Domination: jede Rolle erobert, keine feste Ort-Bindung", () => {
  let browser: Browser;
  let seite: Page;
  const spiele: Record<number, Spiel[]> = {};

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", null, {
      timeout: LAUF_TIMEOUT_MS,
    });
    for (const k of [2, 4, 6]) {
      spiele[k] = await seite.evaluate(
        ({ k, n }) => {
          const A = (window as unknown as {
            __arena: { spieleArenaDomination: (d: string, s: number, o: { jeSeite: number }) => unknown };
          }).__arena;
          const aus = [];
          for (let i = 0; i < n; i++) aus.push(A.spieleArenaDomination("battlefield", 1337 + i * 7919, { jeSeite: k }));
          return aus as never;
        },
        { k, n: SAATEN },
      );
    }
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("es gibt drei Orte (Nord, Mitte, Sued)", () => {
    for (const s of spiele[4]!) expect(s.besitz).toHaveLength(3);
  });

  it.each([2, 4, 6])("k=%i: beide Seiten spielen genau die Rollen der Aufstellung fuer diese Kadergroesse", (k) => {
    for (const s of spiele[k]!) {
      for (const seite of [0, 1]) {
        const slots = s.kaempfer.filter((x) => x.side === seite).map((x) => x.slot).sort();
        expect(slots).toEqual(ERWARTET[k]);
      }
    }
  });

  it.each([2, 4, 6])("k=%i: jede Rolle traegt ueber die Saaten Eroberungsfortschritt bei", (k) => {
    for (const rolle of ERWARTET[k]!) {
      const erob = spiele[k]!.flatMap((s) => s.kaempfer).filter((x) => x.slot === rolle).reduce((a, x) => a + x.erob, 0);
      expect(erob, `${rolle} bei k=${k}`).toBeGreaterThan(0);
    }
  });

  it.each([2, 4, 6])("k=%i: keine Rolle ist an einen Ort gebunden — jede steuert mindestens zwei der drei Orte an", (k) => {
    for (const rolle of ERWARTET[k]!) {
      const orte = new Set<number>();
      for (const x of spiele[k]!.flatMap((s) => s.kaempfer).filter((y) => y.slot === rolle)) {
        x.besucht.forEach((v, i) => v && orte.add(i));
      }
      expect(orte.size, `${rolle} bei k=${k}`).toBeGreaterThanOrEqual(2);
    }
  });

  it.each([4, 6])("k=%i: Spieler rotieren waehrend des Spiels (Ortswechsel)", (k) => {
    const kaempfer = spiele[k]!.flatMap((s) => s.kaempfer);
    const mitWechsel = kaempfer.filter((x) => x.wechsel > 0).length / kaempfer.length;
    expect(mitWechsel).toBeGreaterThan(0.3);
  });
});
