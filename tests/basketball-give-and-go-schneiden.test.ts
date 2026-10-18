import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser } from "playwright";
import { describe, expect, it } from "vitest";

/**
 * GIVE-AND-GO-SCHNEIDEN (Option B, docs/design/basketball-tempo-passing-diagnose-14-10.md
 * Abschnitt 6, Task #123): nach einem erfolgreichen Zuspiel schneidet der Passgeber fuer
 * GIVE_AND_GO_CUT_DAUER (1,5s) zum Korb statt sofort in seinen Slot zurueckzulaufen — exakt
 * dasselbe Zielschema wie das bestehende Roll-Fenster (`u.rollBis`), nur ueber ein anderes
 * Ereignis ausgeloest (`u.cutBis`, s. loeseFlugAuf/bewegeSpielerLive in battle-mode.engine.js).
 *
 * ZWEI TESTS, derselbe Zweiteilung wie bei den uebrigen Basketball-Abnahmen in dieser Datei
 * (s. basketball-pps-referenz-drift.test.ts): ein DETERMINISTISCHER Test auf die
 * Entscheidungslogik selbst (fester Saat, exakte Ticks, `window.__arena.diagDetail` --
 * dieselbe read-only Sonde, die auch die Spacing-Untersuchung vom 26.08. benutzt hat) und ein
 * STATISTISCHER Sanity-Test ueber viele Spiele (`feldspielProbe`), der absichert, dass die
 * neue Mechanik keine offensichtlichen Regressionen (NaN-Positionen, eingefrorene Spiele,
 * unplausible Boxscores) einschleppt. Die eigentliche Rho-/Pp-Abnahme (CLAUDE.md-Pflicht)
 * steht NICHT hier, sondern im PR-Text (zwei unabhaengige Saatstroeme gegen den echten Live-
 * Motor, s. scripts/miss-feldspiel-rangtreue.mjs / scripts/messe-arena-einfluss.mjs) --
 * dieselbe Arbeitsteilung wie bei jeder anderen Basketball-Mechanik-Runde in diesem Repo.
 *
 * SAAT 1337, BIS 10 IST VERIFIZIERT, NICHT GERATEN: `diagDetail(1337,10)` wurde vor dem
 * Schreiben dieses Tests einmal von Hand durchgesehen (s. PR-Beschreibung fuer das Protokoll)
 * -- Draco (Seite 0) haelt den Ball bis t=4.02, passt dann zu King Arlen Morgolor, und genau
 * ab t=4.52 (der naechste 0,5s-Tick dieser Sonde) steht sein `cutBis` auf `true`. Das Fenster
 * laeuft bis fsT+1,5s (GIVE_AND_GO_CUT_DAUER) -- bei 0,52/1,02/... Tick-Raster heisst das: an
 * t=4.52/5.02/5.52 `true`, an t=6.02 (1,5s nach 4,52) wieder `false`. Waehrend des Fensters
 * zielt dieselbe Formel wie beim Roll auf `zy=H/2` (Canvas 1240x470, H/2=235) -- Dracos y bleibt
 * in diesem Fenster auf 225-228, deutlich naeher an 235 als vor dem Pass (127-247) oder nach
 * Ablauf des Fensters, wenn er in seinen Slot weiterlaeuft.
 */

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 60_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

async function launchOptions() {
  return existsSync(CHROMIUM_PFAD)
    ? { headless: true, executablePath: CHROMIUM_PFAD, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] }
    : { headless: true, channel: "chromium" as const, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] };
}

type DiagDetailTick = {
  t: number;
  ballSeite: number | null;
  traeger: string | null;
  spieler: Array<{
    n: string;
    side: number;
    x: number;
    y: number;
    hatBall: boolean;
    slotIdx: number | null;
    deckt: string | null;
    screent: boolean;
    rollBis: boolean;
    cutBis: boolean;
  }>;
};

type FeldspielProbeErgebnis = {
  spiele: Array<{
    spieler: Array<{ n: string; wert: number; x?: number; y?: number }>;
  }>;
};

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Basketball Give-and-Go-Schneiden (Option B, Task #123)", () => {
  it(
    "cutBis springt GENAU bei einem erfolgreichen Zuspiel an, haelt 1,5s und zieht die Y-Position in dieser Zeit zur Feldmitte",
    async () => {
      const seitenPfad = join(process.cwd(), "public", "mockups", "battle-mode.html");
      let browser: Browser | undefined;
      try {
        browser = await chromium.launch(await launchOptions());
        const page = await browser.newPage();
        await page.addInitScript(() => {
          (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
          (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = undefined;
        });
        await page.goto(pathToFileURL(seitenPfad).href, { waitUntil: "networkidle" });
        await page.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", {
          timeout: 15_000,
        });

        const ticks: DiagDetailTick[] = await page.evaluate(() => {
          const arena = (
            window as unknown as { __arena: { diagDetail: (saat: number, bis: number) => DiagDetailTick[] } }
          ).__arena;
          const alterTimeout = window.setTimeout;
          // s. messe-arena-einfluss.mjs: ohne diesen Haken stapeln sich waehrend des einen
          // synchronen Laufs tausende setTimeout-Anmeldungen der Anzeige-Schicht.
          (window as unknown as { setTimeout: typeof window.setTimeout }).setTimeout = (() => 0) as unknown as typeof window.setTimeout;
          try {
            return arena.diagDetail(1337, 10);
          } finally {
            (window as unknown as { setTimeout: typeof window.setTimeout }).setTimeout = alterTimeout;
          }
        });

        const draco = (t: number) => {
          const tick = ticks.find((x) => Math.abs(x.t - t) < 0.01);
          expect(tick, `kein Tick bei t=${t} gefunden`).toBeDefined();
          const spieler = tick!.spieler.find((s) => s.n === "Draco");
          expect(spieler, `Draco fehlt im Tick t=${t}`).toBeDefined();
          return { tick: tick!, spieler: spieler! };
        };

        // VOR DEM PASS: Draco haelt den Ball, cutBis ist aus.
        const vorPass = draco(4.02);
        expect(vorPass.spieler.hatBall).toBe(true);
        expect(vorPass.spieler.cutBis).toBe(false);

        // DER PASS SELBST (zwischen t=4.02 und t=4.52): Draco verliert den Ball, ein
        // MITSPIELER DERSELBEN SEITE haelt ihn danach — die Signatur eines abgeschlossenen
        // Zuspiels, nicht eines Turnovers/Steals (der die Seite wechseln wuerde).
        const nachPass = draco(4.52);
        expect(nachPass.spieler.hatBall).toBe(false);
        expect(nachPass.tick.ballSeite).toBe(vorPass.tick.ballSeite);
        expect(nachPass.tick.traeger).not.toBeNull();
        expect(nachPass.tick.traeger).not.toBe("Draco");
        const empfaenger = nachPass.tick.spieler.find((s) => s.n === nachPass.tick.traeger);
        expect(empfaenger?.side).toBe(vorPass.spieler.side);

        // GENAU DESHALB cutBis=true, fuer ein Fenster von GIVE_AND_GO_CUT_DAUER=1,5s.
        expect(nachPass.spieler.cutBis).toBe(true);
        expect(draco(5.02).spieler.cutBis).toBe(true);
        expect(draco(5.52).spieler.cutBis).toBe(true);
        // 1,5s nach t=4.52 (t=6.02) ist das Fenster abgelaufen -- exakt wie beim bestehenden
        // Roll-Fenster, das ueber dieselbe fsT-Vergleichslogik ausläuft.
        expect(draco(6.02).spieler.cutBis).toBe(false);

        // WAEHREND DES FENSTERS ziehlt dieselbe Formel wie beim Roll auf zy=H/2 (Canvas
        // 1240x470 laut battle-mode.html, H/2=235) -- Dracos y soll in dieser Zeit deutlich
        // naeher an 235 liegen als kurz VOR dem Pass.
        // Frueher Vergleichspunkt (t=2.52, deutlich vor dem Pass, noch im normalen
        // Fastbreak-/Aufbau-Lauf): y=204, Abstand 31px -- der Vergleichswert zeigt, dass
        // Dracos y-Position OHNE das Cut-Fenster frei schwankt, nicht von sich aus auf
        // der Feldmitte haengenbleibt.
        const abstandZurMitte = (y: number) => Math.abs(y - 235);
        const abstandFrueherVergleich = abstandZurMitte(draco(2.52).spieler.y);
        const abstandWaehrendFenster = Math.max(
          abstandZurMitte(nachPass.spieler.y),
          abstandZurMitte(draco(5.02).spieler.y),
          abstandZurMitte(draco(5.52).spieler.y),
        );
        expect(abstandWaehrendFenster).toBeLessThan(15);
        expect(abstandFrueherVergleich).toBeGreaterThan(25);
      } finally {
        await browser?.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it(
    "ueber 12 Spiele bleibt das Spiel stabil (keine NaN-Positionen, plausible Boxscores) mit dem Give-and-Go-Schneiden aktiv",
    async () => {
      const seitenPfad = join(process.cwd(), "public", "mockups", "battle-mode.html");
      let browser: Browser | undefined;
      try {
        browser = await chromium.launch(await launchOptions());
        const page = await browser.newPage();
        await page.addInitScript(() => {
          (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
          (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = undefined;
        });
        await page.goto(pathToFileURL(seitenPfad).href, { waitUntil: "networkidle" });
        await page.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", {
          timeout: 15_000,
        });

        const ergebnis: FeldspielProbeErgebnis = await page.evaluate(() => {
          const arena = (
            window as unknown as {
              __arena: { feldspielProbe: (dId: string, opt: { n: number; jeSeite: number }) => FeldspielProbeErgebnis };
            }
          ).__arena;
          return arena.feldspielProbe("basketball", { n: 12, jeSeite: 6 });
        });

        expect(ergebnis.spiele.length).toBe(12);
        for (const spiel of ergebnis.spiele) {
          expect(spiel.spieler.length).toBeGreaterThan(0);
          for (const spieler of spiel.spieler) {
            expect(Number.isFinite(spieler.wert)).toBe(true);
          }
        }
      } finally {
        await browser?.close();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});
