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
 *   5. LAUFENDES SPIEL, GERENDERTES DOM (Review PR #1560): im Zeitfahren kurz nach dem Start
 *      stehen die noch nicht gestarteten Fahrer in `#lsTafel` ohne Rang ("–") und ohne Punkte, die
 *      Gestarteten tragen die Raenge 1..k, der Reiter-Knopf behaelt ueber mehrere Ticks den Fokus,
 *      und die Messpunkt-Reiter zeigen keine PKT-Spalte (die Punkte meinen JETZT).
 *   6. Keine Seitenfehler.
 *
 * In der CI laeuft die Datei im Job `arena-chromium-tests` (mit OLY_ARENA_CHROMIUM_PFLICHT=1: fehlt
 * Chromium dort, ist das ein Fehler statt eines stillen Ueberspringens) und ist aus dem Shard-Lauf
 * von `full-test-suite` ausgeschlossen.
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
  auto: boolean;
  spalten: { wert?: string; punkte?: string | null; name: string } | null;
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

const CHROMIUM_PFLICHT = process.env.OLY_ARENA_CHROMIUM_PFLICHT === "1";

describe("Live-Stand Welle 1: Chromium-Pflicht", () => {
  it("in der CI (OLY_ARENA_CHROMIUM_PFLICHT=1) ist Chromium da, sonst waere der Test stumm", () => {
    if (CHROMIUM_PFLICHT) expect(chromiumVerfuegbar()).toBe(true);
  });
});

async function tafelDom(seite: Page) {
  return seite.evaluate(() => {
    const tafel = document.getElementById("lsTafel");
    if (!tafel || tafel.hidden) return null;
    const kopf = Array.from(tafel.querySelectorAll("table.ls-tab-tabelle thead th")).map((x) => (x.textContent || "").trim());
    const zeilen = Array.from(tafel.querySelectorAll("table.ls-tab-tabelle tbody tr")).map((tr) => ({
      dim: tr.classList.contains("dim"),
      td: Array.from(tr.querySelectorAll("td")).map((x) => (x.textContent || "").trim()),
    }));
    const reiter = Array.from(tafel.querySelectorAll("[data-ls-reiter]")).map((b) => ({
      id: (b as HTMLElement).dataset.lsReiter,
      an: b.classList.contains("an"),
      gesperrt: (b as HTMLButtonElement).disabled,
    }));
    return { kopf, zeilen, reiter };
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
    // lsWarnung(): ein geschluckter Fehler im Live-Stand meldet sich einmal als console.warn.
    seite.on("console", (m) => {
      if (m.type() === "warning" && m.text().startsWith("Live-Stand")) fehler.push(m.text());
    });
    await seite.goto(SEITEN_PFAD, { waitUntil: "domcontentloaded", timeout: LAUF_TIMEOUT_MS });
    await seite.waitForFunction(() => window.__arena && window.__arena.liveStandProbe, null, { timeout: 90_000 });
    await seite.click("#t2");
  }, LAUF_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("Zeitfahren laufend: Spoilerwaechter, Fahrer am Start ohne Rang/Punkte, Fokus bleibt (gerendertes DOM)", async () => {
    await neueDisziplin(seite, "time-trial");
    await seite.evaluate(() => window.__arena.liveStand({ modus: "tafel", reiter: "auto" }));
    await seite.click("#play");
    await seite.waitForFunction(() => (window.__arena.anpfiffStatus as () => { laeuft: boolean; ticks: number })().ticks > 2, null, { timeout: 20_000 });
    // Warten, bis die Tafel im laufenden Spiel steht (4x/s gezeichnet).
    await seite.waitForFunction(() => {
      const t = document.getElementById("lsTafel");
      return !!t && !t.hidden && t.querySelectorAll("tbody tr").length > 0;
    }, null, { timeout: 20_000 });

    const d = await probe(seite);
    expect(d.typ).toBe("bahn");
    expect(d.messpunkte?.map((m) => m.kurz)).toEqual(["ZZ1", "ZZ2", "ZIEL", "JETZT"]);
    // SPOILERWAECHTER, unbedingt: kurz nach dem Start war noch niemand an ZZ1, ZZ2 oder im Ziel.
    for (const id of ["zz0", "zz1", "ziel"]) {
      const m = d.messpunkte!.find((x) => x.id === id)!;
      expect(m.erreicht, id).toBe(0);
      // Erzwungener Reiter faellt auf AUTO/JETZT zurueck ...
      const erzwungen = await probe(seite, id);
      expect(erzwungen.aktiv, id).toBe("jetzt");
      expect(erzwungen.auto, id).toBe(true);
      // ... und die Tafel im DOM zeigt dafuer keine Zeit: Reiter gesperrt, keine Messpunkt-Spalte.
      const dom = (await tafelDom(seite))!;
      expect(dom.reiter.find((r) => r.id === id)?.gesperrt, id).toBe(true);
      expect(dom.reiter.find((r) => r.id === "auto")?.an, id).toBe(true);
      expect(dom.kopf).not.toContain(d.messpunkte!.find((x) => x.id === id)!.kurz);
    }
    await seite.evaluate(() => window.__arena.liveStand({ reiter: "auto" }));

    // NOCH AM START: Rang "–", keine Punkte; Gestartete haben die Raenge 1..k ohne Luecke.
    const jetzt = await probe(seite);
    const wartend = jetzt.zeilen!.filter((z) => z.wert.startsWith("Start "));
    expect(wartend.length).toBeGreaterThan(0);
    for (const z of wartend) {
      expect(z.rang, z.name).toBe("–");
      expect(z.punkte, z.name).toBe("");
    }
    const gestartet = jetzt.zeilen!.filter((z) => z.rang !== "–");
    gestartet.forEach((z, i) => expect(z.rang).toBe(String(i + 1)));
    const rang = jetzt.band.find((f) => f.k === "Rang")!;
    const [r] = String(rang.v).split("/");
    if (r !== "–") expect(Number(r)).toBeLessThanOrEqual(gestartet.length);

    // Dasselbe im gerenderten DOM: eine Zeile je Fahrer, gedimmte Zeilen mit "–" und leerer PKT-Spalte.
    const dom = (await tafelDom(seite))!;
    expect(dom.kopf).toContain("PKT");
    expect(dom.zeilen.length).toBe(jetzt.zeilen!.length);
    const pktSpalte = dom.kopf.indexOf("PKT");
    const domWartend = dom.zeilen.filter((z) => z.td[2]?.startsWith("Start "));
    expect(domWartend.length).toBe(wartend.length);
    for (const z of domWartend) {
      expect(z.dim).toBe(true);
      expect(z.td[0]).toBe("–");
      expect(z.td[pktSpalte]).toBe("");
    }

    // FOKUS: der Reiter-Knopf wird nicht bei jedem Tick neu gebaut.
    await seite.focus('#lsTafel [data-ls-reiter="auto"]');
    await seite.waitForTimeout(1300);
    const fokus = await seite.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.lsReiter ?? null);
    expect(fokus).toBe("auto");
    await seite.evaluate(() => window.__arena.liveStand({ modus: "band" }));
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
      // PKT meint JETZT, nicht die Zwischenzeit: im Messpunkt-Reiter weder Spalte noch Werte.
      expect(d.spalten?.punkte ?? null).toBeNull();
      for (const z of d.zeilen!) expect(z.punkte).toBe("");
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
      // Spurt klassisch erzwingen (HYROX/Hatz haben ihre eigene Rangleiste, Welle 2).
      await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "klassisch" }));
      await neueDisziplin(seite, disc);
      await seite.evaluate(() => window.__arena.schnellDurch());
      await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: LAUF_TIMEOUT_MS });
      const jetzt = await probe(seite, "jetzt");
      expect(jetzt, `${disc}: Live-Stand fehlt`).not.toBeNull();
      expect(jetzt.typ).toBe("bahn");
      const end = await endstandTabelle(seite);
      expect(end.length).toBeGreaterThan(0);
      expect(jetzt.zeilen!.length).toBe(end.length);
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
