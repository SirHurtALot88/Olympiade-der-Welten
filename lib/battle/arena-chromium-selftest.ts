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
 */
import { chromium } from "playwright";

import { ermittleChromiumLaunchOptions } from "@/lib/battle/arena-headless-runner";

export type ArenaChromiumSelftestErgebnis = {
  ok: boolean;
  detail: string;
  geprueftUm: string;
};

let cache: Promise<ArenaChromiumSelftestErgebnis> | null = null;

async function fuehreSelbsttestAus(): Promise<ArenaChromiumSelftestErgebnis> {
  try {
    // DIESELBEN Launch-Optionen wie der echte Arena-Lauf (`ermittleChromiumLaunchOptions()`,
    // `arena-headless-runner.ts`) — kein zweiter, abweichender Satz Argumente/Pfade.
    const browser = await chromium.launch(ermittleChromiumLaunchOptions());
    try {
      const version = browser.version();
      return { ok: true, detail: `chromium ${version}`, geprueftUm: new Date().toISOString() };
    } finally {
      await browser.close();
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: detail.slice(0, 300), geprueftUm: new Date().toISOString() };
  }
}

export function pruefeArenaChromiumVerfuegbarkeitGecacht(): Promise<ArenaChromiumSelftestErgebnis> {
  if (!cache) {
    cache = fuehreSelbsttestAus();
  }
  return cache;
}

/** NUR FUER TESTS: setzt den Cache zurueck, damit ein Test den Selbsttest erneut ausloesen kann. */
export function setzeArenaChromiumSelftestCacheZurueck(): void {
  cache = null;
}
