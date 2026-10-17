/**
 * CHROMIUM-SELBSTTEST, GECACHT (Opus-Auflage, Plan `docs/design/
 * battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 9, Punkt 3; Abschnitt 4.1): `/api/health`
 * soll zeigen, ob Chromium im Image/Container ueberhaupt startbar ist (E1, PR 2) — aber darf dafuer
 * NICHT bei jedem Aufruf selbst einen Browser starten. Healthchecks laufen typischerweise alle paar
 * Sekunden (Docker, Load-Balancer, `scripts/pruefe-spiegel-frische.ts`-artige Monitore); ein
 * Chromium-Start je Aufruf waere genau die Dauerlast, die der ganze "on demand, nicht dauerhaft
 * warm"-Entwurf (`arena-headless-runner.ts`-Kopfkommentar) vermeiden soll.
 *
 * DAHER: EIN Selbsttest fuer die Lebensdauer des Node-Prozesses. Der erste Aufruf von
 * `pruefeArenaChromiumVerfuegbarkeitGecacht()` startet ihn, merkt sich das Ergebnis UND merkt sich
 * das noch laufende Promise — jeder Aufruf, der waehrenddessen eintrifft (auch von einer ZWEITEN
 * gleichzeitigen Health-Anfrage), haengt sich an dasselbe Promise, statt einen zweiten Browser zu
 * starten. Nach Abschluss liefert jeder weitere Aufruf nur noch den Cache, fuer immer (bis zum
 * naechsten Prozess-Neustart) — ein einmal bestandener/gescheiterter Test wird nicht wiederholt,
 * weil ein Deploy, der das aendern wuerde, ohnehin einen neuen Prozess startet.
 *
 * Bewusst GETRENNT von `arena-headless-runner.ts`: dieser Test braucht nur `chromium.launch()` +
 * sofortiges `close()` (kein `battle-mode.html`, keine Simulation) — ein Minimalfall, der schnell
 * ist und nichts ueber das eigentliche Kader-/Aufstellungs-Modell wissen muss.
 *
 * OPUS-REVIEW (Merge-Bedingung "Kleinigkeit", PR 3/K1): zwei Luecken ergaenzt, beide erst sichtbar,
 * seit es den echten Arena-Vorlauf (`arena-vorlauf-service.ts`) ueberhaupt gibt:
 *
 *   1. OHNE den globalen Chromium-Semaphor (`arena-chromium-semaphor.ts`) koennte der allererste
 *      `/api/health`-Aufruf nach einem Deploy GLEICHZEITIG mit einem echten, gerade laufenden
 *      Arena-Vorlauf einen ZWEITEN Chromium-Prozess starten -- genau die Doppelbelegung, die der
 *      Semaphor fuer jeden anderen Aufrufer schon verhindert. Jetzt laeuft der Selbsttest UNTER
 *      demselben Semaphor: entweder wartet er hoeflich, bis der echte Lauf fertig ist, oder ein
 *      echter Lauf wartet kurz auf den (schnellen) Selbsttest -- nie beide Browser gleichzeitig.
 *   2. OHNE ein eigenes Timeout wuerde ein haengender `chromium.launch()` (kaputtes Image, volle
 *      Platte, ...) das gecachte Promise fuer immer offen lassen -- JEDER kuenftige
 *      `/api/health`-Aufruf (auch der synchrone Blick unten) haette damit fuer immer "pruefe"
 *      stehen, nie ein Ergebnis. Dasselbe Muster wie B2 (`arena-headless-runner.ts`s
 *      Gesamt-Timeout): ein Budget, das den Selbsttest-Fall abdeckt (reines launch()+close(), kein
 *      `battle-mode.html`), deutlich kuerzer als das Simulations-Budget.
 */
import { chromium } from "playwright";

import { ermittleChromiumLaunchOptions } from "@/lib/battle/arena-headless-runner";
import { mitChromiumSemaphor } from "@/lib/battle/arena-chromium-semaphor";

export type ArenaChromiumSelftestErgebnis = {
  ok: boolean;
  detail: string;
  geprueftUm: string;
};

const STANDARD_SELFTEST_TIMEOUT_MS = (() => {
  const raw = process.env.OLY_ARENA_SELFTEST_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
})();

let cache: Promise<ArenaChromiumSelftestErgebnis> | null = null;
/** Synchron lesbarer Spiegel desselben Ergebnisses -- Grundlage fuer `leseSelftestStatusOhneZuWarten()`. */
let letztesErgebnis: ArenaChromiumSelftestErgebnis | null = null;

async function fuehreLaunchUndCloseAus(): Promise<ArenaChromiumSelftestErgebnis> {
  // DIESELBEN Launch-Optionen wie der echte Arena-Lauf (`ermittleChromiumLaunchOptions()`,
  // `arena-headless-runner.ts`) — kein zweiter, abweichender Satz Argumente/Pfade.
  const browser = await chromium.launch(ermittleChromiumLaunchOptions());
  try {
    const version = browser.version();
    return { ok: true, detail: `chromium ${version}`, geprueftUm: new Date().toISOString() };
  } finally {
    await browser.close();
  }
}

async function fuehreSelbsttestAus(): Promise<ArenaChromiumSelftestErgebnis> {
  try {
    // UNTER DEM SEMAPHOR (s. Kopfkommentar Punkt 1) UND mit eigenem Timeout (Punkt 2) -- sonst
    // koennte ein haengender Launch dieses Promise fuer immer offen lassen, unabhaengig vom
    // Semaphor selbst (der nur die REIHENFOLGE regelt, nicht wie lange eine Aufgabe braucht).
    const ergebnis = await mitChromiumSemaphor(() =>
      Promise.race([
        fuehreLaunchUndCloseAus(),
        new Promise<ArenaChromiumSelftestErgebnis>((resolve) => {
          setTimeout(() => {
            resolve({
              ok: false,
              detail: `arena-chromium-selftest: Timeout (${STANDARD_SELFTEST_TIMEOUT_MS}ms) beim Start.`,
              geprueftUm: new Date().toISOString(),
            });
          }, STANDARD_SELFTEST_TIMEOUT_MS);
        }),
      ]),
    );
    letztesErgebnis = ergebnis;
    return ergebnis;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const ergebnis = { ok: false, detail: detail.slice(0, 300), geprueftUm: new Date().toISOString() };
    letztesErgebnis = ergebnis;
    return ergebnis;
  }
}

export function pruefeArenaChromiumVerfuegbarkeitGecacht(): Promise<ArenaChromiumSelftestErgebnis> {
  if (!cache) {
    cache = fuehreSelbsttestAus();
  }
  return cache;
}

/**
 * NICHT-BLOCKIERENDER Blick auf den Selbsttest (Opus-Review, "Kleinigkeit"): stoesst ihn an (falls
 * noch nicht geschehen), WARTET ABER NIE auf ihn -- `/api/health` antwortet damit sofort mit
 * `"pruefe"`, solange der (unter dem Semaphor womoeglich noch auf einen echten Arena-Vorlauf
 * wartende) Selbsttest noch laeuft, statt die ganze Healthcheck-Antwort daran zu haengen.
 */
export function leseSelftestStatusOhneZuWarten(): ArenaChromiumSelftestErgebnis | { status: "pruefe" } {
  if (!cache) {
    // Erster Aufruf ueberhaupt -- anstossen (fire-and-forget), aber nicht erst darauf warten.
    cache = fuehreSelbsttestAus();
  }
  return letztesErgebnis ?? { status: "pruefe" };
}

/** NUR FUER TESTS: setzt den Cache zurueck, damit ein Test den Selbsttest erneut ausloesen kann. */
export function setzeArenaChromiumSelftestCacheZurueck(): void {
  cache = null;
  letztesErgebnis = null;
}
