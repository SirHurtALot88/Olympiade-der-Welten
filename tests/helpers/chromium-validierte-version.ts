/**
 * DIE VALIDIERTE CHROMIUM-VERSION FUER `arena-node-chromium-mathe.mjs` (Opus-PM-Review,
 * Rebase 11.11.). `lib/battle/arena-node-chromium-mathe.mjs` bildet Chromiums `Math.sin`/`cos`/
 * `pow` nach -- bitgleich nachgemessen gegen GENAU diese Version: Chrome for Testing
 * 148.0.7778.96, die Playwright als Chromium-Revision 1223 installiert (`npx playwright install
 * chromium`, gepinnt durch die `playwright`/`playwright-core`-Version in `package.json`). Das ist
 * auch die Version, die CI und der Produktionsserver tatsaechlich benutzen -- beide installieren
 * Chromium ausschliesslich ueber Playwright selbst (`channel: "chromium"`,
 * `ermittleChromiumLaunchOptions()` in arena-headless-runner.ts), nie ueber einen fest
 * einprogrammierten lokalen Pfad.
 *
 * WARUM NICHT EINFACH `ermittleChromiumLaunchOptions()` VERWENDEN: deren `STANDARD_CHROMIUM_
 * EXECUTABLE_PATH` zeigt in manchen Dev-Sandboxes auf eine lokal vorinstallierte, oft NEUERE
 * Chromium-Version (z. B. 153.x) als die hier validierte -- genau das fuehrte zu einem
 * Fehlalarm im Mikro-Benchmark (299/200 000 sin-Werte 1 ULP abweichend), der leicht als echte
 * Regression missverstanden werden konnte, es aber nicht war (die echten Disziplin-Paritaetstests
 * blieben auf derselben Sandbox bitgleich). `launcheValidierteChromiumRevision()` startet deshalb
 * GEZIELT die Playwright-eigene Revision, nicht die lokale Pfad-Praeferenz.
 *
 * PROZESS-HINWEIS: eine Anhebung von `playwright`/`playwright-core` in `package.json` kann die
 * installierte Revision (und damit ggf. V8s sin/cos/pow) aendern. `pruefeChromiumMajorVersion()`
 * schlaegt dann hier LAUT fehl (s. `tests/arena-chromium-revision-goldentest.test.ts`), statt dass
 * ein kuenftiger Mikro-Benchmark-Fehlschlag faelschlich als Regression im eigenen Code gelesen
 * wird. Nach einem solchen Versions-Sprung: `tests/arena-node-chromium-mathe.test.ts` (Mikro-
 * Benchmark) UND `tests/arena-node-runner-paritaet.test.ts` (echte Disziplin-Paritaet) gegen die
 * neue Version laufen lassen -- erst wenn beide bitgleich sind, `VALIDIERTE_CHROMIUM_MAJOR_VERSION`
 * hier UND den Kopfkommentar in `arena-node-chromium-mathe.mjs` auf die neue Version aktualisieren.
 */

/** Nur die MAJOR-Version zaehlt -- Patch-Releases innerhalb derselben Major-Version haben die
 *  sin/cos/pow-Algorithmen bisher nicht veraendert (148.0.7778.96 ist der heute gemessene Stand). */
export const VALIDIERTE_CHROMIUM_MAJOR_VERSION = "148";

/**
 * Wirft mit einer Meldung, die den Unterschied zwischen "falsche Chromium-Version in dieser
 * Sandbox" und "echte Regression in arena-node-chromium-mathe.mjs" explizit macht, statt den
 * Aufrufer raten zu lassen.
 */
export function pruefeChromiumMajorVersion(version: string): void {
  const major = version.split(".")[0];
  if (major === VALIDIERTE_CHROMIUM_MAJOR_VERSION) return;
  throw new Error(
    `Chromium-Versionssprung erkannt: installiert/gestartet ist ${version} (Major ${major}), ` +
      `arena-node-chromium-mathe.mjs ist aber nur gegen Chromium ${VALIDIERTE_CHROMIUM_MAJOR_VERSION}.x ` +
      `(148.0.7778.96, Playwright-Revision 1223) bitgleich nachgemessen. Das ist KEINE automatische ` +
      `Regression -- aber die nachfolgenden sin/cos/pow-Vergleiche in diesem Testlauf sind damit NICHT ` +
      `aussagekraeftig, egal was sie melden. Naechster Schritt: tests/arena-node-chromium-mathe.test.ts ` +
      `(Mikro-Benchmark) und tests/arena-node-runner-paritaet.test.ts (echte Disziplin-Paritaet) gegen ` +
      `Chromium ${major}.x laufen lassen; erst wenn beide bitgleich sind, VALIDIERTE_CHROMIUM_MAJOR_VERSION ` +
      `(tests/helpers/chromium-validierte-version.ts) und den Kopfkommentar in arena-node-chromium-mathe.mjs ` +
      `aktualisieren.`,
  );
}

/**
 * Startet GEZIELT die von Playwright fuer dieses Projekt gepinnte Chromium-Revision (`channel:
 * "chromium"`) -- bewusst NICHT `ermittleChromiumLaunchOptions()`, deren lokale Pfad-Praeferenz
 * (`STANDARD_CHROMIUM_EXECUTABLE_PATH`, arena-headless-runner.ts) in manchen Dev-Sandboxes auf eine
 * andere Chromium-Version zeigt (s. Kopfkommentar oben). Netzwerk-Abriegelung wie beim normalen
 * Arena-Runner, damit dieser Test keine externen Verbindungen aufbaut.
 */
export async function launcheValidierteChromiumRevision() {
  const { chromium } = await import("playwright");
  const { ARENA_NETZWERK_ABRIEGELUNG_ARGS } = await import("@/lib/battle/arena-headless-runner");
  return chromium.launch({ headless: true, channel: "chromium", args: [...ARENA_NETZWERK_ABRIEGELUNG_ARGS] });
}
