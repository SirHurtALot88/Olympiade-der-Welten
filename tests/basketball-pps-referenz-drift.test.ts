import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser } from "playwright";
import { describe, expect, it } from "vitest";

import basketballPpsReferenzJson from "@/data/generated/basketball-pps-referenz.json";

/**
 * DER WAECHTER AUS docs/design/pps-skalierung-opus.md ABSCHNITT 8.3: eine eingefrorene
 * Referenzverteilung (`data/generated/basketball-pps-referenz.json`) ist nach JEDER Aenderung,
 * die den rohen Boxscore-Impact verschiebt (`feldspielWert()`-Gewichte, Spieldauer/`VIERTEL_*`,
 * Basketball-Rezept, Kadergenerierung), sofort falsch — UND sie sagt es nicht von selbst. Genau
 * das ist schon einmal passiert: die Referenzwerte im Opus-Dokument waren durch eine
 * Spieldauer-Aenderung bereits um Faktor 2,5 veraltet, bevor irgendwer es bemerkte (dortiger
 * Abschnitt 1.3). Ohne einen automatischen Waechter faellt so eine Drift nicht auf, bis jemand von
 * Hand nachmisst.
 *
 * Dieser Test zieht ~24 Spiele mit `window.__arena.feldspielProbe("basketball", {n: 24})` — dem
 * DEMOKADER des Mockups — und vergleicht den Median-Impact mit
 * `demoKaderMedianFuerDriftpruefung` bei `playerCount` 6. Weicht er um mehr als ±25 % ab, schlaegt
 * der Test fehl: die Referenz muss neu gezogen werden (`scripts/ziehe-basketball-pps-referenz.ts`).
 *
 * WICHTIG, WARUM GEGEN `demoKaderMedianFuerDriftpruefung` UND NICHT GEGEN DAS PRODUKTIVE `iMittel`
 * GEPRUEFT WIRD: `scripts/ziehe-basketball-pps-referenz.ts` zieht `iMittel`/`iKrass` bewusst aus
 * ECHTEN Liga-Kadern (Opus-Dokument Abschnitt 1: der Demokader spannt Eignungen von rund 20 bis
 * 70, ein echtes Liga-Feld spannt mehr) — die beiden Populationen liegen deshalb SYSTEMATISCH
 * auseinander, unabhaengig von jeder Motor-Aenderung. Ein Vergleich Demokader-Median gegen
 * Liga-`iMittel` waere kein Drift-Test, sondern ein staendiger Fehlalarm. Das Skript zieht deshalb
 * ZUSAETZLICH einen `demoKaderMedianFuerDriftpruefung` aus GENAU DEM Demokader, den auch dieser
 * Test befragt — beide Seiten desselben Vergleichs stammen aus derselben Population, nur zu
 * unterschiedlichen Zeitpunkten. Das ist der eigentliche Sinn eines Drift-Waechters: "hat sich
 * seit dem letzten Ziehen etwas bewegt", nicht "stimmen zwei verschiedene Grundgesamtheiten
 * ueberein".
 *
 * WARUM ES DEN MEDIAN MISST, NICHT DIE SPITZE: bei n=24 Spielen (~144 Spielerwerte bei jeSeite 6)
 * ist der Median stabil, `iKrass` (99,5.-Perzentil) waere es bei dieser Stichprobengroesse nicht
 * (Opus-Dokument Abschnitt 8.3) — derselbe Gedanke wie der bestehende `HK_TW_BASIS`-Kommentar im
 * Motor (battle-mode.engine.js), nur hier maschinell durchgesetzt statt als Kommentar gehofft.
 *
 * Testing-Lektion aus PR6 (full-test-suite faehrt OHNE Chromium): `describe.skipIf`, exakt das
 * Verfuegbarkeits-Muster aus tests/arena-headless-runner.test.ts.
 */

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 60_000;
const ABWEICHUNGS_SCHWELLE = 0.25;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

function median(sortiert: readonly number[]): number {
  if (sortiert.length === 0) return 0;
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 0 ? (sortiert[mitte - 1]! + sortiert[mitte]!) / 2 : sortiert[mitte]!;
}

async function launchOptions() {
  return existsSync(CHROMIUM_PFAD)
    ? { headless: true, executablePath: CHROMIUM_PFAD, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] }
    : { headless: true, channel: "chromium" as const, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] };
}

type BasketballPpsReferenzJson = {
  feldgroessen: Record<string, { demoKaderMedianFuerDriftpruefung?: number | null }>;
};

const DEMO_BASIS_6V6 = (basketballPpsReferenzJson as BasketballPpsReferenzJson).feldgroessen["6"]?.demoKaderMedianFuerDriftpruefung;

describe.skipIf(!chromiumVerfuegbar())("basketball-pps-referenz: Drift-Waechter", () => {
  it.skipIf(DEMO_BASIS_6V6 == null)(
    "der Median-Impact des Demokaders liegt innerhalb von ±25 % des beim Ziehen eingefrorenen Demokader-Mediums (playerCount 6)",
    async () => {
      const basis = DEMO_BASIS_6V6!;

      const seitenPfad = join(process.cwd(), "public", "mockups", "battle-mode.html");
      let browser: Browser | undefined;
      try {
        browser = await chromium.launch(await launchOptions());
        const page = await browser.newPage();
        await page.goto(pathToFileURL(seitenPfad).href);
        await page.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", {
          timeout: 15_000,
        });

        const werte = await page.evaluate(() => {
          const arena = (
            window as unknown as {
              __arena: {
                feldspielProbe: (
                  dId: string,
                  opt: { n: number },
                ) => { spiele: Array<{ spieler: Array<{ wert: number }> }> };
              };
            }
          ).__arena;
          const ergebnis = arena.feldspielProbe("basketball", { n: 24 });
          return ergebnis.spiele.flatMap((spiel) => spiel.spieler.map((spieler) => spieler.wert));
        });

        expect(werte.length).toBeGreaterThan(100);
        const sortiert = [...werte].sort((a, b) => a - b);
        const gemessenerMedian = median(sortiert);

        const abweichung = Math.abs(gemessenerMedian - basis) / basis;
        expect(
          abweichung,
          `Median-Impact des Demokaders (${gemessenerMedian.toFixed(1)}) weicht um ` +
            `${(abweichung * 100).toFixed(0)}% vom beim letzten Ziehen eingefrorenen Wert (${basis}) ab ` +
            `— mehr als die erlaubten ${ABWEICHUNGS_SCHWELLE * 100}%. Der rohe Boxscore-Impact hat sich ` +
            `vermutlich verschoben (z.B. durch eine Aenderung an feldspielWert()/Spieldauer/Rezept) und die ` +
            `Referenz muss neu gezogen werden: scripts/ziehe-basketball-pps-referenz.ts.`,
        ).toBeLessThanOrEqual(ABWEICHUNGS_SCHWELLE);
      } finally {
        await browser?.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});
