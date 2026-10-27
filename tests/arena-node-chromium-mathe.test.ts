import { runInContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { chromiumCos, chromiumPow, chromiumSin } from "@/lib/battle/arena-node-chromium-mathe.mjs";
import { baueMotorKontext } from "@/lib/battle/arena-node-motor.mjs";
import { chromiumVerfuegbar } from "@/tests/helpers/chromium-verfuegbar";

/**
 * QUICK-SIM (27.10.): Node 22 rechnet `Math.sin`/`Math.cos`/`Math.pow` mit fdlibm, Chromium 141
 * mit glibc — `arena-node-chromium-mathe.mjs` bildet Chromium nach. Gefunden am Basketball-
 * Paritaetsfall: `Math.cos(0.7330382858376183)` (42 Grad) ist in Node `…942`, in Chromium `…944`,
 * und dieses eine Bit wuchs ueber die Positionsrechnung bis in die Boxscore.
 */

/** Deterministische Testargumente ueber mehrere Groessenordnungen (inkl. branred-Bereich). */
function argumente(saat: number, anzahl: number): number[] {
  let s = saat >>> 0;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  return Array.from({ length: anzahl }, (_, i) => {
    switch (i % 7) {
      case 0: return r() * 2 - 1;
      case 1: return r() * 20 - 10;
      case 2: return r() * 2000 - 1000;
      case 3: return (r() * 2 - 1) * 1e6;
      case 4: return r() * Math.PI * 4;
      case 5: return (r() * 2 - 1) * 1e12;
      default: return (r() * 2 - 1) * 1e300;
    }
  });
}

describe("arena-node-chromium-mathe", () => {
  it("trifft die in Chromium gemessenen Werte, wo Node abweicht", () => {
    // Werte aus Chromium 141 (Playwright chromium-1194), Node 22 liefert jeweils das Nachbar-Double.
    expect(chromiumCos(0.7330382858376183)).toBe(0.7431448254773944);
    expect(chromiumSin(690664.2373651266)).toBe(-0.7176602593456426);
    expect(chromiumCos(101.01673984900117)).toBe(0.8843134027425213);
  });

  it("Sonderwerte wie in JavaScript gefordert", () => {
    expect(Object.is(chromiumSin(-0), -0)).toBe(true);
    expect(chromiumCos(0)).toBe(1);
    for (const x of [NaN, Infinity, -Infinity]) {
      expect(chromiumSin(x)).toBeNaN();
      expect(chromiumCos(x)).toBeNaN();
    }
    expect(chromiumPow(2, 10)).toBe(1024);
    expect(chromiumPow(3, 2)).toBe(9);
    expect(chromiumPow(-8, 3)).toBe(-512);
    expect(chromiumPow(-8, 1 / 3)).toBeNaN();
    expect(chromiumPow(4, 0.5)).toBe(2);
    expect(chromiumPow(-Infinity, 0.5)).toBe(Infinity);
    expect(chromiumPow(NaN, 0)).toBe(1);
    expect(chromiumPow(1, Infinity)).toBeNaN();
    expect(chromiumPow(1, NaN)).toBeNaN();
    expect(chromiumPow(0, -1)).toBe(Infinity);
    expect(chromiumPow(-0, -3)).toBe(-Infinity);
    expect(chromiumPow(2, 1024)).toBe(Infinity);
    expect(chromiumPow(2, -1075)).toBe(0);
    expect(chromiumPow(2, -1074)).toBe(5e-324);
  });

  it("weicht vom eingebauten Ergebnis hoechstens im letzten Bit ab", () => {
    const fastGleich = (eigen: number, nativ: number) =>
      Object.is(eigen, nativ) || Math.abs(eigen - nativ) <= Math.abs(nativ) * 2 ** -51 + Number.MIN_VALUE;
    for (const x of argumente(11, 20_000)) {
      expect(fastGleich(chromiumSin(x), Math.sin(x)), `sin(${x})`).toBe(true);
      expect(fastGleich(chromiumCos(x), Math.cos(x)), `cos(${x})`).toBe(true);
      const basis = Math.abs(x) % 50;
      const exponent = (x % 7) / 1.3;
      expect(fastGleich(chromiumPow(basis, exponent), Math.pow(basis, exponent)), `pow(${basis}, ${exponent})`).toBe(true);
    }
  });

  it("der Motor-Kontext rechnet mit der Nachbildung, der Node-Prozess bleibt unberuehrt", () => {
    const nativCos = Math.cos;
    const kontext = baueMotorKontext();
    try {
      expect(runInContext("Math.cos(0.7330382858376183)", kontext.fenster)).toBe(0.7431448254773944);
      expect(runInContext("Math.pow(2, 0.5) === Math.SQRT2", kontext.fenster)).toBe(true);
    } finally {
      kontext.aufraeumen();
    }
    expect(Math.cos).toBe(nativCos);
  });

  it.skipIf(!chromiumVerfuegbar())(
    "sin/cos sind bitgleich zu Chromium, pow bis auf seltene FMA-Grenzfaelle",
    async () => {
      const { chromium } = await import("playwright");
      const { ermittleChromiumLaunchOptions } = await import("@/lib/battle/arena-headless-runner");
      const werte = argumente(42, 200_000);
      const paare = werte.slice(0, 50_000).map((x, i) => [i % 3 === 0 ? Math.abs(x) % 50 : Math.abs(x) % 3, i % 4 === 0 ? Math.round(x % 7) : (x % 7) / 1.3]);
      const browser = await chromium.launch(ermittleChromiumLaunchOptions());
      try {
        const page = await browser.newPage();
        const referenz = await page.evaluate(
          ({ werte, paare }) => ({ sin: werte.map(Math.sin), cos: werte.map(Math.cos), pow: paare.map(([x, y]) => Math.pow(x!, y!)) }),
          { werte, paare },
        );
        const abweichungen = (eigen: number[], ref: number[]) => eigen.filter((wert, i) => !Object.is(wert, ref[i])).length;
        expect(abweichungen(werte.map(chromiumSin), referenz.sin)).toBe(0);
        expect(abweichungen(werte.map(chromiumCos), referenz.cos)).toBe(0);
        // Gemessen: ~0,06 % mit der Nachbildung gegenueber ~6 % mit Node-eigenem fdlibm-pow.
        const powEigen = abweichungen(paare.map(([x, y]) => chromiumPow(x!, y!)), referenz.pow);
        const powNativ = abweichungen(paare.map(([x, y]) => Math.pow(x!, y!)), referenz.pow);
        expect(powEigen).toBeLessThanOrEqual(paare.length * 0.002);
        expect(powEigen * 20).toBeLessThan(powNativ);
      } finally {
        await browser.close();
      }
    },
    300_000,
  );
});
