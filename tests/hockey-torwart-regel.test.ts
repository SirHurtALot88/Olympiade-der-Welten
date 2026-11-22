import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * HOCKEY-TORWART-REGEL (22.11., docs/design/hockey-torwart-22-11.md).
 *
 * Drei Dinge:
 *  1. RUECKWEG BIT-IDENTISCH: `hockeyTorwart("alt")` und der gebuchte Spieltag-Umschlag
 *     `formatByDisciplineId.hockey = "alt"` rechnen dasselbe wie der Motor vor der Aenderung (Fingerabdruck
 *     `spiele hockey/torwart-alt`), und beide unterscheiden sich von der neuen Regel (gezeigt = gebucht).
 *  2. EIGNUNG WIRKT: der Torwart mit der hoeheren Hockey-Eignung haelt in der neuen Regel messbar mehr als in der alten
 *     (Rang-Korrelation Eignung gegen Fangquote steigt), PARADE allein hing nicht an der Matrix.
 *  3. DAUERFEUER: die Puste des Torwarts faellt unter Beschuss (der tiefste Stand liegt in der neuen Regel deutlich unter
 *     dem der alten) und sinkt bei geringer Ausdauer tiefer.
 */

type TeilnehmerDiag = { parade: number; ausd: number; saves: number; gegentore: number; pusteMin: number; pusteMax: number };
type Teilnehmer = { n: string; eig: number; wert: number; torwart?: boolean; diag?: TeilnehmerDiag };
type Probe = { varianten: Array<{ spiele: Array<{ teilnehmer: Teilnehmer[] }> }> };
type Arena = {
  disziplinProbe: (d: string, o: Record<string, unknown>) => Probe;
  spiele: (d: string, saat: number) => unknown;
  hockeyTorwart: (r: unknown) => unknown;
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten as Array<{ heim: unknown[]; gast: unknown[] }>;

function oeffne(umschlag?: Record<string, unknown>) {
  const skripte = ladeMotorSkripte(MOCKUPS);
  const kontext = baueMotorKontext();
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({
    heim: familie[0]!.heim, gast: familie[0]!.gast, aufstellung: {}, mutatoren: [],
    ...(umschlag ? { formatByDisciplineId: umschlag } : {}),
  });
  vm.runInContext(
    "window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;",
    kontext.fenster,
  );
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  return kontext;
}

async function warteAuf(kontext: ReturnType<typeof baueMotorKontext>) {
  for (let i = 0; i < 200 && !kontext.fenster.__arena; i += 1) await new Promise((resolve) => setImmediate(resolve));
  return kontext.fenster.__arena as Arena;
}

let standard: ReturnType<typeof baueMotorKontext>;
let gebuchtAlt: ReturnType<typeof baueMotorKontext>;
let A: Arena;
let AAlt: Arena;

beforeAll(async () => {
  standard = oeffne();
  gebuchtAlt = oeffne({ hockey: "alt" });
  A = await warteAuf(standard);
  AAlt = await warteAuf(gebuchtAlt);
}, 120_000);

afterAll(() => {
  standard?.aufraeumen();
  gebuchtAlt?.aufraeumen();
});

// Zyklen (z. B. `deckt`) werden wie im Fingerabdruck deterministisch markiert.
const json = (x: unknown) => {
  const auf = new WeakSet<object>();
  return JSON.stringify(x, (_k, w) => {
    if (w && typeof w === "object") { if (auf.has(w)) return "[verweis]"; auf.add(w); }
    return w;
  });
};

describe("Hockey-Torwart-Regel: Rueckweg und Umschlag", () => {
  it("der Umschlag 'alt' rechnet wie der Messhebel 'alt' (gezeigt = gebucht) und anders als die neue Regel", () => {
    const neu = json(A.spiele("hockey", 7));
    const umschlagAlt = json(AAlt.spiele("hockey", 7));
    A.hockeyTorwart("alt");
    const hebelAlt = json(A.spiele("hockey", 7));
    A.hockeyTorwart(null);
    expect(umschlagAlt).toBe(hebelAlt);
    expect(neu).not.toBe(hebelAlt);
    // Nach dem Zuruecksetzen rechnet der Standard wieder die neue Regel.
    expect(json(A.spiele("hockey", 7))).toBe(neu);
  });
});

function torwartZeilen(arena: Arena, spiele: number) {
  const probe = arena.disziplinProbe("hockey", { n: spiele, kaderFamilie: familie, hockeyDiag: true });
  const zeilen: Array<{ eig: number; sv: number; pusteAnteilMin: number; ausd: number }> = [];
  for (const variante of probe.varianten) for (const spiel of variante.spiele) for (const t of spiel.teilnehmer) {
    if (!t.torwart || !t.diag) continue;
    const schuesse = t.diag.saves + t.diag.gegentore;
    if (schuesse < 10) continue;
    zeilen.push({ eig: t.eig, sv: t.diag.saves / schuesse, pusteAnteilMin: t.diag.pusteMin / Math.max(1, t.diag.pusteMax), ausd: t.diag.ausd });
  }
  return zeilen;
}

const mittel = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const rang = (v: number[]) => {
  const i = v.map((x, j) => [x, j] as const).sort((p, q) => p[0] - q[0]);
  const o = new Array<number>(v.length);
  i.forEach(([, j], k) => { o[j] = k; });
  return o;
};
const spearman = (a: number[], b: number[]) => {
  const A1 = rang(a), B1 = rang(b), m = (A1.length - 1) / 2;
  let c = 0, s = 0, t = 0;
  for (let i = 0; i < A1.length; i += 1) { c += (A1[i]! - m) * (B1[i]! - m); s += (A1[i]! - m) ** 2; t += (B1[i]! - m) ** 2; }
  return c / Math.sqrt(s * t);
};

describe("Hockey-Torwart-Regel: Wirkung", () => {
  it("Eignung und Fangquote haengen in der neuen Regel staerker zusammen als in der alten; Puste faellt unter Dauerfeuer", () => {
    const neu = torwartZeilen(A, 12);
    A.hockeyTorwart("alt");
    const alt = torwartZeilen(A, 12);
    A.hockeyTorwart(null);
    expect(neu.length).toBeGreaterThan(40);
    expect(alt.length).toBeGreaterThan(40);
    const korrNeu = spearman(neu.map((z) => z.eig), neu.map((z) => z.sv));
    const korrAlt = spearman(alt.map((z) => z.eig), alt.map((z) => z.sv));
    expect(korrNeu).toBeGreaterThan(korrAlt);
    // Dauerfeuer: der tiefste Puste-Stand (Anteil am Vorrat) liegt unter dem der alten Regel.
    expect(mittel(neu.map((z) => z.pusteAnteilMin))).toBeLessThan(mittel(alt.map((z) => z.pusteAnteilMin)) - 0.1);
    // ... und bei geringer Ausdauer tiefer als bei hoher.
    const ausdMedian = [...neu.map((z) => z.ausd)].sort((p, q) => p - q)[Math.floor(neu.length / 2)]!;
    const schwach = neu.filter((z) => z.ausd < ausdMedian).map((z) => z.pusteAnteilMin);
    const stark = neu.filter((z) => z.ausd >= ausdMedian).map((z) => z.pusteAnteilMin);
    expect(mittel(schwach)).toBeLessThan(mittel(stark));
  }, 240_000);
});
