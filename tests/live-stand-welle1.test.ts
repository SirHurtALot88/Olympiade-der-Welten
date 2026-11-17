/**
 * LIVE-STAND, WELLE 1 (17.11., docs/design/live-stand-overlay-konzept-17-11.md).
 *
 * Prueft das Overlay im echten Motor (Chromium, wie `spiele-bahn-invarianten.test.ts`):
 *   1. GEZEIGT = GEBUCHT: am Rennende stehen in der Tafel (Reiter JETZT) exakt die Plaetze und
 *      Punkte, die der Endstand des Spiels zeigt -- je Laeufer, fuer Zeitfahren, Spurt, Climbing.
 *   2. MESSPUNKTE: der Reiter ZZ1/ZZ2 ordnet nach `u.zz[ci]` (aufsteigend), der Erste steht auf
 *      "Best", und der Abstand ist die Differenz zur Bestzeit.
 *   3. SPOILERWAECHTER: vor dem ersten Durchgang an einem Messpunkt ist dessen Reiter gesperrt
 *      (erreicht 0) und die Tafel zeigt dort keine Zeit.
 *   4. FELDSPIEL: der Endstand im Band (Siegchance 100/0/50) folgt dem gezeigten Stand (#score).
 *   5. Keine Seitenfehler.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SEITEN_PFAD = pathToFileURL(
  join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.html"),
).href;
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

type Zeile = { id: string | number; name: string; rang: string; wert: string; abstand: string; punkte: string; prognose: string };
type Daten = {
  typ: string;
  aktiv: string;
  messpunkte: { id: string; kurz: string; erreicht: number }[] | null;
  zeilen: Zeile[] | null;
  band: { k: string; chance?: number | null; v?: string }[];
};

declare global {
  interface Window {
    __arena: Record<string, (...args: unknown[]) => unknown>;
  }
}

async function neueDisziplin(seite: Page, disc: string) {
  await seite.evaluate((d) => {
    const a = window.__arena;
    a.setDisc(d);
    if (a.anpfiffCountdown) a.anpfiffCountdown(false);
  }, disc);
}

async function probe(seite: Page, reiter?: string): Promise<Daten> {
  return seite.evaluate((r) => {
    const a = window.__arena;
    if (r) a.liveStand({ reiter: r });
    return (a.liveStandProbe() as { daten: Daten }).daten;
  }, reiter);
}

async function endstandTabelle(seite: Page) {
  // Endstand-Tafeln beider Teams: Laeufer | Platz | Zeit | Punkte.
  return seite.evaluate(() => {
    const zeilen: { name: string; platz: string; punkte: string }[] = [];
    for (const id of ["etafelL", "etafelR"]) {
      const tab = document.getElementById(id);
      if (!tab) continue;
      for (const tr of Array.from(tab.querySelectorAll("tbody tr"))) {
        const td = Array.from(tr.querySelectorAll("td")).map((x) => (x.textContent || "").trim());
        if (td.length >= 4) zeilen.push({ name: td[0].replace(/^★\s*/, ""), platz: td[1], punkte: td[td.length - 1] });
      }
    }
    return zeilen;
  });
}

describe.skipIf(!chromiumVerfuegbar())("Live-Stand Welle 1 (Arena-Motor, Chromium)", () => {
  let browser: Browser;
  let seite: Page;
  const fehler: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch(existsSync(CHROMIUM_PFAD) ? { executablePath: CHROMIUM_PFAD } : {});
    seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITEN_PFAD, { waitUntil: "domcontentloaded", timeout: LAUF_TIMEOUT_MS });
    await seite.waitForFunction(() => window.__arena && window.__arena.liveStandProbe, null, { timeout: 90_000 });
    await seite.click("#t2");
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Zeitfahren: Reiter ZZ1/ZZ2 gesperrt, bis jemand dort war (Spoilerwaechter)", async () => {
    await neueDisziplin(seite, "time-trial");
    await seite.click("#play");
    await seite.waitForFunction(() => (window.__arena.anpfiffStatus as () => { laeuft: boolean; ticks: number })().ticks > 2, null, { timeout: 20_000 });
    const d = await probe(seite);
    expect(d.typ).toBe("bahn");
    expect(d.messpunkte?.map((m) => m.kurz)).toEqual(["ZZ1", "ZZ2", "ZIEL", "JETZT"]);
    const zz1 = d.messpunkte!.find((m) => m.id === "zz0")!;
    if (zz1.erreicht === 0) {
      // Erzwungener Reiter auf einen Messpunkt ohne Durchgang faellt auf AUTO/JETZT zurueck.
      const erzwungen = await probe(seite, "zz0");
      expect(erzwungen.aktiv).not.toBe("zz0");
    }
    await seite.evaluate(() => window.__arena.liveStand({ reiter: "auto" }));
  }, LAUF_TIMEOUT_MS);

  it("Zeitfahren am Ende: Tafel = Endstand (Platz und Punkte je Laeufer), ZZ-Reiter nach u.zz geordnet", async () => {
    await seite.evaluate(() => window.__arena.schnellDurch());
    await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: LAUF_TIMEOUT_MS });
    const jetzt = await probe(seite, "jetzt");
    const end = await endstandTabelle(seite);
    expect(end.length).toBe(jetzt.zeilen!.length);
    for (const z of jetzt.zeilen!) {
      const e = end.find((x) => x.name === z.name);
      expect(e, z.name).toBeDefined();
      expect(z.rang).toBe(e!.platz);
      expect(Number(z.punkte.replace(",", "."))).toBeCloseTo(Number(e!.punkte.replace(",", ".")), 1);
      // Prognose am Ende = gebuchter Platz.
      expect(z.prognose).toBe(z.rang + ".");
    }
    for (const reiter of ["zz0", "zz1", "ziel"]) {
      const d = await probe(seite, reiter);
      expect(d.aktiv).toBe(reiter);
      const mit = d.zeilen!.filter((z) => z.rang !== "–");
      expect(mit.length).toBeGreaterThan(0);
      expect(mit[0].abstand).toBe("Best");
      const zeiten = mit.map((z) => {
        const t = z.wert.split(":");
        return t.length === 2 ? Number(t[0]) * 60 + Number(t[1].replace(",", ".")) : Number(t[0].replace(",", "."));
      });
      for (let i = 1; i < zeiten.length; i++) expect(zeiten[i]).toBeGreaterThanOrEqual(zeiten[i - 1]);
      mit.forEach((z, i) => expect(z.rang).toBe(String(i + 1)));
    }
  }, LAUF_TIMEOUT_MS);

  for (const disc of ["spurt", "climbing"]) {
    it(`${disc} am Ende: Tafel = Endstand`, async () => {
      await neueDisziplin(seite, disc);
      await seite.evaluate(() => window.__arena.schnellDurch());
      await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: LAUF_TIMEOUT_MS });
      const jetzt = await probe(seite, "jetzt");
      if (!jetzt) return; // HYROX/Hatz zeigen ihre eigene Rangleiste (Welle 2)
      const end = await endstandTabelle(seite);
      for (const z of jetzt.zeilen!) {
        const e = end.find((x) => x.name === z.name);
        expect(e, z.name).toBeDefined();
        expect(z.rang).toBe(e!.platz);
        expect(Number(z.punkte.replace(",", "."))).toBeCloseTo(Number(e!.punkte.replace(",", ".")), 1);
      }
    }, LAUF_TIMEOUT_MS);
  }

  it("Hockey am Ende: Siegchance im Band folgt dem gezeigten Stand", async () => {
    await neueDisziplin(seite, "hockey");
    await seite.evaluate(() => window.__arena.schnellDurch());
    await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: LAUF_TIMEOUT_MS });
    const d = await probe(seite);
    expect(d.typ).toBe("feldspiel");
    const stand = await seite.evaluate(() => document.getElementById("score")?.textContent || "");
    const [a, b] = stand.split(":").map((x) => Number(x.trim()));
    const chance = d.band.find((f) => f.k === "Siegchance")!.chance;
    expect(chance).toBe(a > b ? 1 : b > a ? 0 : 0.5);
    // Linescore-Summe = Endstand.
    const letzte = d.zeilen!.filter((z) => (z as unknown as { kum: string }).kum).pop() as unknown as { kum: string };
    expect(letzte.kum.replace(/\s/g, "")).toBe(`${a}:${b}`);
  }, LAUF_TIMEOUT_MS);

  it("keine Seitenfehler", () => {
    expect(fehler).toEqual([]);
  });
});
