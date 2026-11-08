import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * OBERFLAECHEN-EFFEKTE IM MOTOR (08.11.): der Bootstrap-Umschlag `kulisseByDisciplineId` (Host und
 * Runner, s. lib/battle/arena-kulisse.ts) steuert die Wertung -- und nur fuer Disziplinen mit
 * Kulissen-Profil. Braucht einen echten Browser; ohne Chromium uebersprungen (wie
 * tests/arena-headless-runner.test.ts, `full-test-suite` faehrt ohne Browser).
 */

function chromiumVerfuegbar(): boolean {
  if (existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")) return true;
  for (const ort of [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), ".cache", "ms-playwright")]) {
    if (!ort) continue;
    try {
      if (readdirSync(ort).some((eintrag) => eintrag.startsWith("chromium"))) return true;
    } catch {
      // weiter
    }
  }
  return false;
}

const SEITE = pathToFileURL(join(process.cwd(), "public/mockups/battle-mode.html")).href;
const familie = JSON.parse(readFileSync(join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;

describe.skipIf(!chromiumVerfuegbar())("Kulisse im Motor", () => {
  let browser: Browser;
  beforeAll(async () => {
    const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
    browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  }, 60_000);
  afterAll(async () => {
    await browser?.close();
  });

  async function spiele(disziplin: string, saat: number, kulisseByDisciplineId: Record<string, string> | null) {
    const seite = await browser.newPage();
    try {
      await seite.addInitScript(
        ([kader, kulisse]) => {
          (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
          (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = {
            heim: kader.heim,
            gast: kader.gast,
            aufstellung: {},
            mutatoren: [],
            ...(kulisse ? { kulisseByDisciplineId: kulisse } : {}),
          };
        },
        [familie[0], kulisseByDisciplineId] as const,
      );
      await seite.goto(SEITE);
      await seite.waitForFunction(() => (window as unknown as { __arena?: unknown }).__arena, null, { timeout: 60_000 });
      return await seite.evaluate(
        ([d, s]) => {
          const A = (window as unknown as {
            __arena: {
              spieleBuehneDuell: (d: string, s: number) => unknown;
              buehneKulisse: () => string | null;
              kulisseFuerSaat: (d: string, s: number) => string | null;
            };
          }).__arena;
          const ergebnis = A.spieleBuehneDuell(d, s);
          return { ergebnis, kulisse: A.buehneKulisse(), gewaehlt: A.kulisseFuerSaat(d, s) };
        },
        [disziplin, saat] as const,
      );
    } finally {
      await seite.close();
    }
  }

  it("die gebuchte Tennis-Kulisse traegt die Wertung", async () => {
    const sand = await spiele("tennis", 424242, { tennis: "riviera" });
    const rasen = await spiele("tennis", 424242, { tennis: "court" });
    expect(sand.kulisse).toBe("riviera");
    expect(sand.gewaehlt).toBe("riviera");
    expect(rasen.kulisse).toBe("court");
    expect(JSON.stringify(sand.ergebnis)).not.toBe(JSON.stringify(rasen.ergebnis));
    // Dieselbe Buchung -> dasselbe Spiel (deterministisch).
    expect(JSON.stringify(await spiele("tennis", 424242, { tennis: "riviera" }))).toBe(JSON.stringify(sand));
  }, 120_000);

  it("ohne Kulissen-Profil ist das Feld wirkungslos", async () => {
    const ohne = await spiele("speed-schach", 424242, null);
    const mit = await spiele("speed-schach", 424242, { "speed-schach": "park", tennis: "riviera" });
    expect(mit.kulisse).toBeNull();
    expect(JSON.stringify(mit.ergebnis)).toBe(JSON.stringify(ohne.ergebnis));
  }, 120_000);
});
