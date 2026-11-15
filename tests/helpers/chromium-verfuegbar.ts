/**
 * GEMEINSAME CHROMIUM-VERFUEGBARKEITSPRUEFUNG fuer Tests, die echtes Headless-Chromium brauchen
 * (Playwright). Dieselbe Pruefung, die `tests/mini-dm-ffa-pod-headless-runner.test.ts` und
 * `tests/mini-dm-ffa-formkarten-position-fix.test.ts` schon je lokal hielten -- hier als EINE
 * geteilte Stelle fuer neue Tests (z. B. `tests/mini-dm-ffa-e2e-real-chromium.test.ts`), damit der
 * Pfad/die Cache-Logik nicht ein drittes Mal eigenstaendig kopiert wird. Bestehende Kopien bleiben
 * bewusst unveraendert (kein Risiko fuer bereits gruene Tests durch eine Refaktorierung, die diese
 * PR nicht verlangt).
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/**
 * Verzeichnisse, in denen Playwright installierte Browser ablegt -- `~/.cache/ms-playwright` ist
 * der Standardort, `PLAYWRIGHT_BROWSERS_PATH` (gesetzt in manchen Sandboxes/CI-Images) ueberschreibt
 * ihn. NACHTRAG (Opus-PM-Review, Rebase 11.11.): der fest einprogrammierte `CHROMIUM_PFAD` oben
 * zeigt auf eine Revision, die `npx playwright install chromium` beim naechsten Lauf als "unused"
 * entfernt (sie gehoert keiner in diesem `package.json` gepinnten Playwright-Version mehr) -- ohne
 * diesen zweiten Ort waere `chromiumVerfuegbar()` danach in genau der Sandbox falsch (alle davon
 * abhaengigen Tests wuerden STILL uebersprungen statt zu laufen), die den Browser per
 * `PLAYWRIGHT_BROWSERS_PATH` statt `~/.cache/ms-playwright` ablegt.
 */
function playwrightBrowserVerzeichnisse(): string[] {
  const verzeichnisse = [join(homedir(), ".cache", "ms-playwright")];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) verzeichnisse.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  return verzeichnisse;
}

export function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  return playwrightBrowserVerzeichnisse().some((verzeichnis) => {
    try {
      return readdirSync(verzeichnis).some((eintrag) => eintrag.startsWith("chromium"));
    } catch {
      return false;
    }
  });
}
