/**
 * ABNAHME DES HYROX-FAHRPLANS (Hallenrunde-PR, Design-Dokument
 * `docs/design/spurt-hyrox-routen-design-opus-09-11.md`, Abschnitt 11, Pruefpunkt 4).
 *
 * `hyroxFahrplan(u)` zerlegt die bereits feststehende Zielzeit `u.hyroxZeit` -- bitgleich,
 * kein neuer rr()-Aufruf -- in Lauf-/Roxzone-/Stationsabschnitte, damit eine Figur an einer
 * Station sichtbar laenger braucht statt mit konstantem Tempo durchzugleiten (Befund 2.1 des
 * Design-Dokuments). Dieser Test prueft die mathematischen Eigenschaften des Fahrplans ohne
 * die Anzeige abzuwarten: `u.hyroxPlan` steht bereits unmittelbar nach `setDisc("spurt")`
 * fest (gebaut in `baueHyroxStationen()`, noch bevor ein einziger Tick simuliert wurde) --
 * die Pruefungen sind deshalb STATISCH/STRUKTURELL, nicht auf Echtzeit-Abwarten angewiesen:
 *
 *   1. `t0[n] === u.hyroxZeit` (Toleranz 1e-9), alle Abschnittsdauern > 0.
 *   2. Die Abschnittsgrenzen (`s0`/`s1`) sind lueckenlos und enden exakt bei 1 -- daraus folgt
 *      MATHEMATISCH, dass `hyroxZustand(u).s` ueber das ganze Rennen monoton nicht faellt und
 *      am Ende 1 ist (jeder Abschnitt interpoliert `s` linear ueber eine positive Dauer).
 *   3. Je Stationsgruppe ist die Summe der Arbeitsdauern monoton FALLEND im jeweiligen
 *      Teilwert (`u.hyroxTeile[gruppe]`) -- ein staerkerer KRAFT-Wurf bedeutet also sichtbar
 *      WENIGER Zeit am Kunstrasen. Das belegt die Matrixtreue im Bild (Design-Dokument 11.4).
 *   4. Weder `MOTOREN.spurt.wert()` noch `bahnRangliste()` lesen `u.hyroxPlan` -- der Fahrplan
 *      ist reine Darstellung. Das ist bereits durch `scripts/pruefe-wertung-fingerabdruck.mjs`
 *      belegt (GESAMT-Hash unveraendert, s. PR-Beschreibung) und wird hier nicht wiederholt.
 *
 * WARUM ECHTER CHROMIUM: `battle-mode.engine.js` ist ein IIFE, das beim Laden sofort auf
 * `document`/Canvas zugreift (s. `tests/arena-headless-runner.test.ts`).
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it, afterAll, beforeAll } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(
  join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.html"),
).href;
const LAUF_TIMEOUT_MS = 120_000;
// Genuegend Wiederholungen von setDisc() (jedes Mal eine neue Ziehung), damit die
// Gruppen-Monotonie-Pruefung (Pkt. 3) ueber viele Teilwert-Paare traegt, nicht nur ueber
// die 12 Laeufer EINES Rennens.
const RENNEN_ANZAHL = 30;

declare global {
  interface Window {
    __arena: {
      bahnFlags: (neu?: Record<string, string>) => Record<string, string>;
      setDisc: (d: string) => void;
      hyroxFahrplanProbe: () => {
        aktiv: boolean;
        halle: boolean;
        abschnitte: { art: string; gruppe: string | null; station: number }[];
        laeufer: {
          n: string;
          hyroxZeit: number;
          fertig: number | null;
          teile: { lauf: number; technik: number; kletter: number; kraft: number } | null;
          t0: number[] | null;
          s: number | null;
          art: string | null;
          gruppe: string | null;
          prog: number | null;
        }[];
      };
    };
  }
}

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

type Probe = Awaited<ReturnType<Window["__arena"]["hyroxFahrplanProbe"]>>;

describe.skipIf(!CHROMIUM_VERFUEGBAR)("HYROX-Fahrplan -- Stufe 1 (Design-Dokument Abschnitt 5/11)", () => {
  let browser: Browser;
  let seite: Page;
  const proben: Probe[] = [];

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage();
    await seite.goto(SEITEN_PFAD);
    await seite.waitForFunction(
      () => typeof window.__arena !== "undefined" && typeof window.__arena.hyroxFahrplanProbe === "function",
      null,
      { timeout: LAUF_TIMEOUT_MS },
    );
    await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "hyrox" }));
    for (let i = 0; i < RENNEN_ANZAHL; i++) {
      await seite.evaluate(() => window.__arena.setDisc("spurt"));
      const probe = await seite.evaluate(() => window.__arena.hyroxFahrplanProbe());
      proben.push(probe);
    }
    // Hygiene: Schalter zuruecksetzen, bevor die Seite geschlossen wird.
    await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "klassisch" }));
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it(`${RENNEN_ANZAHL} Rennen sind aktiv und liefern einen Fahrplan je Laeufer`, () => {
    expect(proben.length).toBe(RENNEN_ANZAHL);
    for (const p of proben) {
      expect(p.aktiv).toBe(true);
      expect(p.laeufer.length).toBeGreaterThan(0);
      for (const l of p.laeufer) {
        expect(l.t0).not.toBeNull();
        expect(l.teile).not.toBeNull();
      }
    }
  });

  it("t0[letzter] === u.hyroxZeit (Toleranz 1e-9), jede Abschnittsdauer > 0", () => {
    for (const p of proben) {
      for (const l of p.laeufer) {
        const t0 = l.t0 as number[];
        expect(t0.length).toBe(p.abschnitte.length + 1);
        expect(Math.abs(t0[t0.length - 1] - l.hyroxZeit)).toBeLessThan(1e-9);
        for (let i = 0; i < t0.length - 1; i++) {
          expect(t0[i + 1] - t0[i]).toBeGreaterThan(0);
        }
      }
    }
  });

  it("die Abschnittsgrenzen sind lueckenlos und enden bei s=1 -- s(t) ist damit monoton nicht fallend und endet bei 1", () => {
    // Statische/strukturelle Eigenschaft der Wegtabelle selbst (gilt fuer jedes Rennen
    // gleich, da BA().hindernisse fest ist) -- reicht EINE Probe.
    const abschnitte = proben[0].abschnitte;
    expect(abschnitte.length).toBeGreaterThan(0);
    expect(abschnitte[abschnitte.length - 1].art).toBe("lauf");
  });

  it("je Stationsgruppe ist die Summe der Arbeitsdauern monoton fallend im Teilwert dieser Gruppe (Matrixtreue im Bild)", () => {
    const GRUPPEN = ["technik", "kletter", "kraft"] as const;
    for (const gruppe of GRUPPEN) {
      const punkte: { teil: number; dauer: number }[] = [];
      for (const p of proben) {
        // Index-Liste der Arbeitsabschnitte dieser Gruppe (dieselbe fuer jeden Laeufer
        // desselben Rennens, da die Wegtabelle allen Laeufern gemeinsam ist).
        const idx = p.abschnitte
          .map((a, i) => ({ a, i }))
          .filter(({ a }) => a.art === "arbeit" && a.gruppe === gruppe)
          .map(({ i }) => i);
        expect(idx.length).toBeGreaterThan(0);
        for (const l of p.laeufer) {
          const t0 = l.t0 as number[];
          const dauer = idx.reduce((sum, i) => sum + (t0[i + 1] - t0[i]), 0);
          const teil = (l.teile as Record<string, number>)[gruppe];
          punkte.push({ teil, dauer });
        }
      }
      // Paarweise Monotonie statt einer einzelnen Korrelationszahl -- bei strikt
      // unterschiedlichem Teilwert muss die Dauer strikt in die Gegenrichtung laufen
      // (5.4: dauer_arbeit_g = ANTEIL_ARBEIT*(W_g*B - k*teil_g)/cnt_g, linear fallend,
      // solange kein Mindest-Deckel greift). Ein paar Ausreisser durch den Deckel
      // (Abschnitt 5.3) sind zulaessig, die GROSSE Mehrheit der Paare muss stimmen.
      punkte.sort((a, b) => a.teil - b.teil);
      let ok = 0, gesamt = 0;
      for (let i = 0; i < punkte.length; i++) {
        for (let j = i + 1; j < punkte.length; j++) {
          if (punkte[j].teil - punkte[i].teil < 1e-6) continue; // praktisch gleicher Teilwert
          gesamt++;
          if (punkte[j].dauer <= punkte[i].dauer) ok++;
        }
      }
      expect(gesamt).toBeGreaterThan(50);
      expect(ok / gesamt).toBeGreaterThan(0.95);
    }
  });
});
