/**
 * BAHN IM POD-FORMAT (01.11.): N Teams auf einer Strecke fuer Takeshi's Castle und Staffel.
 *
 * Zwei Teile, beide gegen echten Chromium (die Engine ist ein IIFE mit DOM-Zugriff, s.
 * tests/spiele-bahn-invarianten.test.ts):
 *
 * 1. DAS DUELL BLEIBT BIT-IDENTISCH. `bauSpurt()`/`stepSpurt()`/`BAHNEN_N` kennen jetzt N Seiten
 *    (`bahnPodKader`, battle-mode.engine.js). Im Duell (`bahnPodKader===null`) muss jede dieser
 *    Zeilen Zeichen fuer Zeichen das alte Ergebnis liefern. Die Fingerabdruecke unten sind am
 *    Engine-Stand VOR dem Umbau gezogen (Commit 7af8e7e1, `spieleBahn(bd, saat)` fuer fuenf Saaten,
 *    sha256 ueber das JSON) und nach dem Umbau unveraendert nachgemessen. Staffel ist die
 *    bestabgenommene Disziplin des Spiels (rho 0,937) — ein Ausschlag hier heisst: der Umbau hat
 *    das Duell veraendert.
 *    BEWUSSTE Aenderungen an der Bahn-Mechanik verschieben diese Werte natuerlich; dann neu ziehen
 *    (dieselbe Rechnung wie `fingerabdruck()` unten) und in der PR begruenden.
 *
 * 2. DER POD-EINSTIEG (`window.__arena.spieleBahnPod`) liefert eine echte Vierer-Wertung:
 *    vier Teams, Platz 1..4, Ligapunkte 2-1-0-0 (Gleichstand teilt), 4×k Laeufer im Boxscore, die
 *    Teamwertung passt zur Rangfolge, deterministisch je Saat — und er hinterlaesst NICHTS im
 *    Duell-Zustand (Aufstellung, Persoenlichkeiten, Formkarten, Bahnzahl).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WURZEL = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEITEN_PFAD = pathToFileURL(join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const LAUF_TIMEOUT_MS = 180_000;

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

// Am Engine-Stand vor dem N-Bahnen-Umbau gezogen (s. Kopfkommentar).
const SAATEN: Array<number | string> = [1, 7, 42, 1337, "save:s1:md3:staffel"];
const FINGERABDRUECKE_VOR_DEM_UMBAU: Record<string, string> = {
  staffel: "bbb0c028e8447abe",
  "takeshis-castle": "5bbb7171f24f2908",
  spurt: "d0b83c4c88b4fa0e",
  "time-trial": "b167882f39f9bc63",
  climbing: "d538d2c1fb7f6344",
};

type PodTeam = { side: number; wert: number | null; zielzeit: number | null; eventPlatz: number; ligaPunkte: number };
type PodErgebnis = { disziplin: string; saat: number; teams: PodTeam[]; boxscore: { name: string; side: number; wert: number }[] };
type KaderSpieler = { n: string; d: Record<string, number>; a: Record<string, number> };

declare global {
  interface Window {
    __arena: {
      spieleBahn: (bd: string, saat: number | string) => unknown;
      spieleBahnPod: (
        bd: string,
        teams: KaderSpieler[][],
        saat: number | string,
        platzJeTeam?: Array<Record<string, { d: string; slot: string }>> | null,
        optionen?: { formSaat?: number | string },
      ) => PodErgebnis;
      bahnPodDisziplinen: () => string[];
    };
  }
}

function fingerabdruck(werte: unknown): string {
  return createHash("sha256").update(JSON.stringify(werte)).digest("hex").slice(0, 16);
}

// Vier echte Team-Kader aus der Kader-Familie (dieselbe Quelle wie die Abnahme-Skripte).
function vierTeams(): KaderSpieler[][] {
  const familie = JSON.parse(readFileSync(join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")) as {
    varianten: Array<{ heim: KaderSpieler[]; gast: KaderSpieler[] }>;
  };
  return [familie.varianten[0]!.heim, familie.varianten[0]!.gast, familie.varianten[1]!.heim, familie.varianten[1]!.gast];
}

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Bahn im Pod-Format (N Teams) -- Duell unveraendert, Vierer-Wertung echt", () => {
  let browser: Browser;
  let seite: Page;

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(() => typeof window.__arena !== "undefined", null, { timeout: LAUF_TIMEOUT_MS });
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it.each(Object.keys(FINGERABDRUECKE_VOR_DEM_UMBAU))(
    "Duell %s: spieleBahn() liefert bit-identisch dasselbe wie vor dem N-Bahnen-Umbau",
    async (bd) => {
      const laeufe = await seite.evaluate(
        ({ bd, saaten }) => saaten.map((s) => window.__arena.spieleBahn(bd, s)),
        { bd, saaten: SAATEN },
      );
      expect(fingerabdruck(laeufe)).toBe(FINGERABDRUECKE_VOR_DEM_UMBAU[bd]);
    },
    LAUF_TIMEOUT_MS,
  );

  it("nur Takeshi's Castle und Staffel laufen im Pod-Format", async () => {
    const liste = await seite.evaluate(() => window.__arena.bahnPodDisziplinen());
    expect(liste.sort()).toEqual(["staffel", "takeshis-castle"]);
    const fehler = await seite.evaluate(
      (teams) => {
        try {
          window.__arena.spieleBahnPod("spurt", teams, 1);
          return null;
        } catch (e) {
          return String(e);
        }
      },
      vierTeams(),
    );
    expect(fehler).toContain("Pod-Format");
  });

  it.each(["takeshis-castle", "staffel"])(
    "Pod %s: vier Teams, Platz 1..4, 2-1-0-0, 24 Laeufer, Wertung passt zur Rangfolge, deterministisch",
    async (bd) => {
      const teams = vierTeams();
      const { a, b, c } = await seite.evaluate(
        ({ bd, teams }) => ({
          a: window.__arena.spieleBahnPod(bd, teams, "save:s1:md7:" + bd, null, { formSaat: "save:s1:md7:" + bd }),
          b: window.__arena.spieleBahnPod(bd, teams, "save:s1:md7:" + bd, null, { formSaat: "save:s1:md7:" + bd }),
          c: window.__arena.spieleBahnPod(bd, teams, "save:s1:md8:" + bd, null, { formSaat: "save:s1:md8:" + bd }),
        }),
        { bd, teams },
      );
      expect(b).toEqual(a);
      for (const erg of [a, c]) {
        expect(erg.teams.map((t) => t.side)).toEqual([0, 1, 2, 3]);
        expect(erg.boxscore).toHaveLength(24);
        for (let s = 0; s < 4; s += 1) expect(erg.boxscore.filter((e) => e.side === s)).toHaveLength(6);
        // Ligapunkte: insgesamt 3, ohne Gleichstand genau 2-1-0-0 nach Platz.
        expect(erg.teams.reduce((x, t) => x + t.ligaPunkte, 0)).toBeCloseTo(3, 9);
        const plaetze = erg.teams.map((t) => t.eventPlatz);
        if (new Set(plaetze).size === 4) {
          for (const t of erg.teams) expect(t.ligaPunkte).toBe([2, 1, 0, 0][t.eventPlatz - 1]);
        }
        // Rangfolge = Teamwertung: Takeshi mehr Burgpunkte besser, Staffel fruehere Zielzeit besser.
        const nachPlatz = [...erg.teams].sort((x, y) => x.eventPlatz - y.eventPlatz);
        for (let i = 1; i < 4; i += 1) {
          const vorn = nachPlatz[i - 1]!, hinten = nachPlatz[i]!;
          if (bd === "takeshis-castle") expect(vorn.wert!).toBeGreaterThanOrEqual(hinten.wert!);
          else if (hinten.zielzeit != null) expect(vorn.zielzeit!).toBeLessThanOrEqual(hinten.zielzeit);
        }
        if (bd === "takeshis-castle") {
          // Teamwert = Summe der Laeuferwerte (Burgpunkte), wie im Duell.
          for (const t of erg.teams) {
            const summe = erg.boxscore.filter((e) => e.side === t.side).reduce((x, e) => x + e.wert, 0);
            expect(t.wert!).toBeCloseTo(Math.round(summe * 10) / 10, 6);
          }
        }
      }
    },
    LAUF_TIMEOUT_MS,
  );

  it("ein Pod-Lauf hinterlaesst nichts im Duell-Zustand (Aufstellung, Formkarten, Bahnzahl)", async () => {
    const teams = vierTeams();
    const { vorher, nachher } = await seite.evaluate(
      ({ teams, saaten }) => {
        const duell = () =>
          ["staffel", "takeshis-castle", "spurt"].map((bd) => saaten.map((s) => window.__arena.spieleBahn(bd, s)));
        const vorher = duell();
        window.__arena.spieleBahnPod("takeshis-castle", teams, 99, null, { formSaat: 99 });
        window.__arena.spieleBahnPod("staffel", teams, 98, null, { formSaat: 98 });
        return { vorher, nachher: duell() };
      },
      { teams, saaten: SAATEN },
    );
    expect(nachher).toEqual(vorher);
  }, LAUF_TIMEOUT_MS);
});
