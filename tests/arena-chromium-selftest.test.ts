import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * OPUS-REVIEW ("Kleinigkeit", Merge-Bedingung PR 3/K1): `lib/battle/arena-chromium-selftest.ts`
 * hatte bisher KEINE eigene Testdatei. Drei Eigenschaften, die seit der "Kleinigkeit"-Nachbesserung
 * gelten muessen, werden hier mit gemocktem `"playwright"` (kein echter Browser) belegt:
 *
 *   1. Der Selbsttest laeuft UNTER dem globalen Chromium-Semaphor (`arena-chromium-semaphor.ts`) --
 *      ein bereits belegter Semaphor verzoegert den Selbsttest-Launch, startet ihn aber nicht
 *      GLEICHZEITIG mit der anderen Aufgabe.
 *   2. `/api/health` darf nie blockieren: `leseSelftestStatusOhneZuWarten()` liefert sofort
 *      `{status:"pruefe"}`, solange der (unter dem Semaphor womoeglich wartende) Selbsttest noch
 *      laeuft -- nie ein `await`, das auf den echten Launch wartet.
 *   3. Ein haengender `chromium.launch()` darf das gecachte Promise nicht fuer immer offen lassen
 *      (B2-Analogie) -- nach dem eigenen `OLY_ARENA_SELFTEST_TIMEOUT_MS`-Budget liegt ein
 *      `ok:false`-Ergebnis mit "Timeout" im Detail vor.
 */

type MockVerhalten = {
  launch: () => Promise<{ version: () => string; close: () => Promise<void> }>;
};

const verhalten: MockVerhalten = {
  launch: async () => ({ version: () => "mock-chromium", close: async () => {} }),
};

const launchAufrufe: number[] = [];

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => {
      launchAufrufe.push(Date.now());
      return verhalten.launch();
    }),
  },
}));

process.env.OLY_ARENA_SELFTEST_TIMEOUT_MS = "300";

const { mitChromiumSemaphor } = await import("@/lib/battle/arena-chromium-semaphor");
const {
  pruefeArenaChromiumVerfuegbarkeitGecacht,
  leseSelftestStatusOhneZuWarten,
  setzeArenaChromiumSelftestCacheZurueck,
} = await import("@/lib/battle/arena-chromium-selftest");

afterEach(() => {
  setzeArenaChromiumSelftestCacheZurueck();
  launchAufrufe.length = 0;
  verhalten.launch = async () => ({ version: () => "mock-chromium", close: async () => {} });
});

describe("arena-chromium-selftest · Kleinigkeit (Opus-Review, Merge-Bedingung)", () => {
  it("laeuft unter dem globalen Semaphor: wartet auf eine bereits belegende Aufgabe, startet nicht parallel", async () => {
    let belegungFreigegebenUm: number | null = null;
    const belegung = mitChromiumSemaphor(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      belegungFreigegebenUm = Date.now();
      return "belegt-fertig";
    });

    // Der Selbsttest wird WAEHREND die obige Aufgabe den Semaphor haelt angestossen.
    const selftestPromise = pruefeArenaChromiumVerfuegbarkeitGecacht();

    await belegung;
    const ergebnis = await selftestPromise;

    expect(ergebnis.ok).toBe(true);
    expect(launchAufrufe).toHaveLength(1);
    // Der tatsaechliche chromium.launch()-Aufruf des Selbsttests geschah NICHT, bevor die
    // belegende Aufgabe den Semaphor freigegeben hat -- kein gleichzeitiger zweiter Browser.
    expect(belegungFreigegebenUm).not.toBeNull();
    expect(launchAufrufe[0]).toBeGreaterThanOrEqual(belegungFreigegebenUm!);
  });

  it('"/api/health" blockiert nie: leseSelftestStatusOhneZuWarten() liefert sofort "pruefe", bis der (verzoegerte) Selbsttest fertig ist', async () => {
    let freigeben: (() => void) | null = null;
    verhalten.launch = () =>
      new Promise((resolve) => {
        freigeben = () => resolve({ version: () => "mock-chromium", close: async () => {} });
      });

    const sofort = leseSelftestStatusOhneZuWarten();
    expect(sofort).toEqual({ status: "pruefe" });

    // Noch immer "pruefe", solange der Launch absichtlich nicht freigegeben wurde.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(leseSelftestStatusOhneZuWarten()).toEqual({ status: "pruefe" });

    expect(freigeben).not.toBeNull();
    freigeben!();
    const fertig = await pruefeArenaChromiumVerfuegbarkeitGecacht();
    expect(fertig.ok).toBe(true);

    // Nach Abschluss liefert derselbe nicht-blockierende Blick das fertige Ergebnis, kein
    // "pruefe" mehr.
    const danach = leseSelftestStatusOhneZuWarten();
    expect("status" in danach).toBe(false);
  });

  it("ein haengender chromium.launch() haelt das Ergebnis NICHT fuer immer offen -- Timeout statt ewigem Pruefen", async () => {
    verhalten.launch = () => new Promise(() => {}); // haengt absichtlich fuer immer

    const start = Date.now();
    const ergebnis = await pruefeArenaChromiumVerfuegbarkeitGecacht();
    const dauerMs = Date.now() - start;

    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.detail).toMatch(/Timeout/);
    // Innerhalb des (fuer diesen Test auf 300ms gesetzten) Budgets plus grosszuegiger Reserve --
    // nicht erst beim Vitest-Timeout.
    expect(dauerMs).toBeLessThan(5_000);

    // Der nicht-blockierende Blick zeigt danach dasselbe Timeout-Ergebnis, kein "pruefe" mehr --
    // ein haengender Launch darf den Cache nicht fuer immer auf "pruefe" einfrieren.
    const status = leseSelftestStatusOhneZuWarten();
    expect("status" in status).toBe(false);
  });
});
