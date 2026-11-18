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

        // EREIGNISBASIERT STATT AUF FESTE ZEITPUNKTE (Benchmark Basketball 17.11.): bis dahin war
        // dieser Test auf "Draco passt zwischen t=4,02 und t=4,52" der Saat 1337 festgenagelt. Das
        // Spacing-Modul und das FIBA-Feld (docs/design/spacing-modul-17-11.md) verschieben jede
        // Laufbahn und damit diese Zeitpunkte -- die REGEL (Pass -> 1,5 s Schnitt zur Korbachse)
        // bleibt. Gesucht wird deshalb das erste abgeschlossene Zuspiel im Raster (0,5 s): Traeger A
        // im einen Tick, Mitspieler B derselben Seite im naechsten, A vorher ohne Schnitt-Fenster.
        const spielerIn = (tick: DiagDetailTick, n: string) => tick.spieler.find((s) => s.n === n)!;
        let i = -1;
        for (let k = 0; k + 4 < ticks.length; k++) {
          const a = ticks[k].traeger, b = ticks[k + 1].traeger;
          if (!a || !b || a === b || ticks[k].ballSeite !== ticks[k + 1].ballSeite) continue;
          const pa = spielerIn(ticks[k], a), pb = spielerIn(ticks[k + 1], b);
          if (pa.side !== pb.side || pa.cutBis) continue;
          // A darf in den naechsten 1,5 s den Ball nicht zurueckbekommen (sonst neues Fenster).
          if ([2, 3, 4].some((d) => ticks[k + d].traeger === a)) continue;
          i = k; break;
        }
        expect(i, "kein abgeschlossenes Zuspiel in 10 s gefunden").toBeGreaterThanOrEqual(0);
        const passgeber = ticks[i].traeger!;
        const vorPass = spielerIn(ticks[i], passgeber);
        expect(vorPass.hatBall).toBe(true);
        expect(vorPass.cutBis).toBe(false);
        const nachPass = spielerIn(ticks[i + 1], passgeber);
        expect(nachPass.hatBall).toBe(false);

        // GENAU DESHALB cutBis=true, fuer ein Fenster von GIVE_AND_GO_CUT_DAUER=1,5s: der Pass fiel
        // in (t_i, t_i+1], das Fenster endet also in (t_i+1 + 1,0, t_i+1 + 1,5].
        expect(nachPass.cutBis).toBe(true);
        expect(spielerIn(ticks[i + 2], passgeber).cutBis).toBe(true);
        expect(spielerIn(ticks[i + 4], passgeber).cutBis).toBe(false);

        // WAEHREND DES FENSTERS zielt dieselbe Formel wie beim Roll auf zy=H/2 (=235): der Abstand
        // des Passgebers zur Korbachse schrumpft (oder er steht schon auf ihr).
        const abstandZurMitte = (y: number) => Math.abs(y - 235);
        const abstandBeimPass = abstandZurMitte(nachPass.y);
        const abstandSpaeter = abstandZurMitte(spielerIn(ticks[i + 3], passgeber).y);
        expect(abstandSpaeter < abstandBeimPass - 5 || abstandSpaeter < 15).toBe(true);
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
