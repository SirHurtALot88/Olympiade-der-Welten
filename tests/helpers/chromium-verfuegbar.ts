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

export function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}
