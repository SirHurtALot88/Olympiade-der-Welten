/**
 * TASK #105 -- PP NACH ZEIT STATT PLATZ, MARGIN-FORMEL (15.10., nach der Stamina-Kalibrierung
 * desselben Tages, s. `docs/design/time-trial-sequenzieller-start-pp-zeit-15-10.md` Abschnitt 2.5
 * und den Nachtrag in `docs/design/stand-aller-disziplinen.md`).
 *
 * `bahnRangliste()` mischt fuer Time-Trial jetzt einen Zeitabstand-Anteil (`marginAnteil`, s.
 * `BAHN_ART["time-trial"]`) in die Rangpunkte: der ANKER (bester Laeufer N, schlechtester 1)
 * bleibt exakt wie zuvor, nur die ZWISCHENSCHRITTE richten sich jetzt nach dem tatsaechlichen
 * Zeitabstand zum Feld statt nach gleichen Eins-Schritten. Vier Garantien sind hier NICHT
 * verhandelbar, weil eine falsche Umsetzung entweder die Rangtreue-Messung stillschweigend
 * veraendert haette (der Mindestvertrag aus `spiele-bahn-invarianten.test.ts`) oder die neue
 * Formel unbemerkt zu einer Nullaenderung gemacht haette:
 *
 *   1. ANKER: das schnellste und das langsamste Zielzeit-Ergebnis eines vollstaendigen Rennens
 *      bekommen weiterhin exakt N bzw. 1 Punkte -- derselbe Wertebereich wie die reinen
 *      Rangpunkte, nur mit anderer Verteilung dazwischen.
 *   2. MONOTONIE: eine schnellere Zielzeit bekommt NIE weniger Punkte als eine langsamere
 *      (Spearman-Invarianz der Diagnose, s. dort Abschnitt 2.2) -- sonst waere `rho je Spiel`
 *      nicht mehr garantiert unveraendert.
 *   3. DIE FORMEL WIRKT WIRKLICH: bei ungleichen Zeitabstaenden sind die Punkteschritte
 *      zwischen aufeinanderfolgenden Plaetzen NICHT alle exakt 1 -- sonst waere `marginAnteil`
 *      nur eine tote Konfigurationszeile.
 *   4. ISOLATION: jede andere Bahn-Disziplin (hier Spurt, `wertung:"rang"`, kein eigenes
 *      `marginAnteil`) bleibt bit-identisch bei reinen, ganzzahligen Rangpunkten N..1 --
 *      `bahnRangliste()` ist generischer Code fuer alle fuenf Bahnen.
 *
 * Dieselbe Begruendung wie in `spiele-bahn-invarianten.test.ts` fuer echten Chromium statt
 * eines reinen Node-Imports: `battle-mode.engine.js` ist ein IIFE, das beim Laden sofort auf
 * `document`/Canvas zugreift.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it, afterAll, beforeAll } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(
  join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.html"),
).href;
const LAUF_TIMEOUT_MS = 120_000;
// 60 Saaten reichen hier -- anders als die 240-Saaten-Rangkorrelation in
// spiele-bahn-invarianten.test.ts geht es nur um harte Grenzwerte (Anker/Monotonie/Integer-
// Rangpunkte), die entweder JEDE Saat erfuellen oder gar keine; 240 waeren nur mehr Laufzeit
// fuer dieselbe Aussage.
const SAATEN_ANZAHL = 60;

type BahnLaeufer = {
  platz: number;
  n: string;
  rangpunkte: number;
  zeit: number | null;
  raus: boolean;
};
type BahnLaufErgebnis = { laeufer: BahnLaeufer[] } | null;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Time-Trial PP-Margin-Formel (Task #105, 15.10.)", () => {
  let browser: Browser;
  let seite: Page;

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", null, {
      timeout: LAUF_TIMEOUT_MS,
    });
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  async function bahnLaeufeSammeln(bd: string, anzahl: number): Promise<BahnLaufErgebnis[]> {
    return seite.evaluate<BahnLaufErgebnis[], { bd: string; anzahl: number }>(
      ({ bd, anzahl }) => {
        const arena = (window as unknown as { __arena: { bahnLauf: (d: string, saat: number) => BahnLaufErgebnis } })
          .__arena;
        const ergebnisse: BahnLaufErgebnis[] = [];
        for (let saat = 1; saat <= anzahl; saat += 1) {
          ergebnisse.push(arena.bahnLauf(bd, saat));
        }
        return ergebnisse;
      },
      { bd, anzahl },
    );
  }

  it("Time-Trial: Anker bleibt N..1 -- schnellste Zielzeit N Punkte, langsamste 1 Punkt (vollstaendige Rennen)", async () => {
    const laeufe = await bahnLaeufeSammeln("time-trial", SAATEN_ANZAHL);
    let geprueft = 0;
    for (const lauf of laeufe) {
      if (!lauf) continue;
      const alleFertig = lauf.laeufer.every((u) => u.zeit != null && !u.raus);
      if (!alleFertig) continue; // DNF/raus fallen bewusst auf reine Rangpunkte zurueck, s. Kopfkommentar
      const n = lauf.laeufer.length;
      const punkte = lauf.laeufer.map((u) => u.rangpunkte);
      expect(Math.max(...punkte)).toBeCloseTo(n, 9);
      expect(Math.min(...punkte)).toBeCloseTo(1, 9);
      geprueft += 1;
    }
    expect(geprueft).toBeGreaterThan(SAATEN_ANZAHL * 0.5);
  });

  it("Time-Trial: Monotonie -- schnellere Zielzeit bekommt nie weniger Punkte als eine langsamere", async () => {
    const laeufe = await bahnLaeufeSammeln("time-trial", SAATEN_ANZAHL);
    for (const lauf of laeufe) {
      if (!lauf) continue;
      const fertige = lauf.laeufer
        .filter((u) => u.zeit != null && !u.raus)
        .sort((a, b) => a.zeit! - b.zeit!);
      for (let i = 1; i < fertige.length; i += 1) {
        // Zeit aufsteigend (langsamer werdend) -- Punkte duerfen dabei nie steigen.
        expect(fertige[i]!.rangpunkte).toBeLessThanOrEqual(fertige[i - 1]!.rangpunkte + 1e-9);
      }
    }
  });

  it("Time-Trial: die Formel wirkt wirklich -- Punkteschritte zwischen Plaetzen sind nicht alle exakt 1", async () => {
    const laeufe = await bahnLaeufeSammeln("time-trial", SAATEN_ANZAHL);
    let mindestEinAbweichenderSchritt = false;
    for (const lauf of laeufe) {
      if (!lauf) continue;
      const fertige = lauf.laeufer
        .filter((u) => u.zeit != null && !u.raus)
        .sort((a, b) => a.zeit! - b.zeit!);
      for (let i = 1; i < fertige.length; i += 1) {
        const schritt = fertige[i - 1]!.rangpunkte - fertige[i]!.rangpunkte;
        if (Math.abs(schritt - 1) > 1e-6) {
          mindestEinAbweichenderSchritt = true;
          break;
        }
      }
      if (mindestEinAbweichenderSchritt) break;
    }
    expect(mindestEinAbweichenderSchritt).toBe(true);
  });

  it("Spurt bleibt unveraendert: reine, ganzzahlige Rangpunkte N..1 (Isolation, kein eigenes marginAnteil)", async () => {
    const laeufe = await bahnLaeufeSammeln("spurt", SAATEN_ANZAHL);
    let geprueft = 0;
    for (const lauf of laeufe) {
      if (!lauf) continue;
      const n = lauf.laeufer.length;
      const punkte = lauf.laeufer.map((u) => u.rangpunkte).sort((a, b) => b - a);
      for (const p of punkte) expect(Number.isInteger(p)).toBe(true);
      expect(punkte).toEqual(Array.from({ length: n }, (_, i) => n - i));
      geprueft += 1;
    }
    expect(geprueft).toBeGreaterThan(0);
  });
});
