import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * BASKETBALL-PUSTE-REGEL (22.11., docs/design/basketball-puste-22-11.md).
 *
 * Drei Dinge:
 *  1. RUECKWEG BIT-IDENTISCH: `basketballPuste("alt")` und der gebuchte Spieltag-Umschlag
 *     `formatByDisciplineId.basketball = "alt"` rechnen dasselbe wie der Motor vor der Aenderung (Fingerabdruck
 *     `spiele basketball/puste-alt`, die drei alten `spiele basketball`-Zeilen 91a13edbaa37/9cae043e306d/8a75782eceaa),
 *     und beide unterscheiden sich von der neuen Regel (gezeigt = gebucht).
 *  2. PUSTE WIRKT: jeder Spieler hat in der neuen Regel einen Vorrat, der Vorrat haengt an AUSDAUER, wer viel aktiv ist,
 *     faellt tiefer; in der alten Regel bleibt jede Puste-Zeile still (pusteMax 0).
 *  3. BETEILIGUNG: der Anteil der Feldspieler mit fast null Ballaktionen (der Maru-Fall) sinkt gegenueber der alten Regel.
 */

type Bet = { fga: number; assists: number; rebounds: number; steals: number; bloecke: number; verluste: number; pusteMin: number; pusteMax: number; weg: number };
type Teilnehmer = { n: string; eig: number; wert: number; bet?: Bet };
type Probe = { varianten: Array<{ spiele: Array<{ teilnehmer: Teilnehmer[] }> }> };
type Arena = {
  disziplinProbe: (d: string, o: Record<string, unknown>) => Probe;
  spiele: (d: string, saat: number) => unknown;
  basketballPuste: (r: unknown) => unknown;
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten as Array<{ heim: unknown[]; gast: unknown[] }>;

function oeffne(kader: boolean, umschlag?: Record<string, unknown>) {
  const skripte = ladeMotorSkripte(MOCKUPS);
  const kontext = baueMotorKontext();
  if (kader) {
    kontext.fenster.__olyNodeUebergabe = JSON.stringify({
      heim: familie[0]!.heim, gast: familie[0]!.gast, aufstellung: {}, mutatoren: [],
      ...(umschlag ? { formatByDisciplineId: umschlag } : {}),
    });
    vm.runInContext(
      "window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;",
      kontext.fenster,
    );
  }
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  return kontext;
}

async function warteAuf(kontext: ReturnType<typeof baueMotorKontext>) {
  for (let i = 0; i < 200 && !kontext.fenster.__arena; i += 1) await new Promise((resolve) => setImmediate(resolve));
  return kontext.fenster.__arena as Arena;
}

let ohneKader: ReturnType<typeof baueMotorKontext>;
let standard: ReturnType<typeof baueMotorKontext>;
let gebuchtAlt: ReturnType<typeof baueMotorKontext>;
let A0: Arena;
let A: Arena;
let AAlt: Arena;

beforeAll(async () => {
  ohneKader = oeffne(false);
  standard = oeffne(true);
  gebuchtAlt = oeffne(true, { basketball: "alt" });
  A0 = await warteAuf(ohneKader);
  A = await warteAuf(standard);
  AAlt = await warteAuf(gebuchtAlt);
}, 120_000);

afterAll(() => {
  ohneKader?.aufraeumen();
  standard?.aufraeumen();
  gebuchtAlt?.aufraeumen();
});

// Zyklen (z. B. `deckt`) werden wie im Fingerabdruck (scripts/pruefe-wertung-fingerabdruck.mjs) deterministisch markiert.
const json = (x: unknown) => {
  const auf = new WeakSet<object>();
  return JSON.stringify(x, (_k, w) => {
    if (w && typeof w === "object") { if (auf.has(w)) return "[verweis]"; auf.add(w); }
    return w;
  });
};
const hash = (x: unknown) => createHash("sha256").update(json(x)).digest("hex").slice(0, 12);

describe("Basketball-Puste-Regel: Rueckweg und Umschlag", () => {
  it("die alte Regel trifft bit-genau die Fingerabdruck-Werte von vor dem 22.11.", () => {
    const erwartet: Record<number, string> = { 1: "91a13edbaa37", 7: "9cae043e306d", 42: "8a75782eceaa" };
    A0.basketballPuste("alt");
    try {
      for (const saat of [1, 7, 42]) expect(hash(A0.spiele("basketball", saat)), `Saat ${saat}`).toBe(erwartet[saat]);
    } finally {
      A0.basketballPuste(null);
    }
    // Die neue Regel (Standard) rechnet anders.
    for (const saat of [1, 7, 42]) expect(hash(A0.spiele("basketball", saat)), `Saat ${saat}`).not.toBe(erwartet[saat]);
  });

  it("der Umschlag 'alt' rechnet wie der Messhebel 'alt' (gezeigt = gebucht) und anders als die neue Regel", () => {
    const neu = json(A.spiele("basketball", 7));
    const umschlagAlt = json(AAlt.spiele("basketball", 7));
    A.basketballPuste("alt");
    const hebelAlt = json(A.spiele("basketball", 7));
    A.basketballPuste(null);
    expect(umschlagAlt).toBe(hebelAlt);
    expect(neu).not.toBe(hebelAlt);
    // Nach dem Zuruecksetzen rechnet der Standard wieder die neue Regel.
    expect(json(A.spiele("basketball", 7))).toBe(neu);
  });
});

function zeilen(arena: Arena, spiele: number, jeSeite: number) {
  const probe = arena.disziplinProbe("basketball", { n: spiele, kaderFamilie: familie, jeSeite, beteiligungDiag: true });
  const z: Array<{ akt: number; pusteMin: number; pusteMax: number; weg: number }> = [];
  for (const v of probe.varianten) for (const s of v.spiele) for (const t of s.teilnehmer) {
    const b = t.bet!;
    z.push({ akt: b.fga + b.assists + b.rebounds + b.steals + b.bloecke + b.verluste, pusteMin: b.pusteMin, pusteMax: b.pusteMax, weg: b.weg });
  }
  return z;
}

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

describe("Basketball-Puste-Regel: Wirkung", () => {
  it("Vorrat aus AUSDAUER, aktive Spieler fallen tiefer; Rueckweg ohne Puste; weniger Geister", () => {
    const neu = zeilen(A, 12, 4);
    A.basketballPuste("alt");
    const alt = zeilen(A, 12, 4);
    A.basketballPuste(null);
    expect(neu.length).toBeGreaterThan(400);

    // Alte Regel: jede Puste-Zeile still.
    expect(alt.every((z) => z.pusteMax === 0 && z.weg === 0)).toBe(true);
    // Neue Regel: jeder hat einen Vorrat, gelaufen wird viel.
    expect(neu.every((z) => z.pusteMax > 0)).toBe(true);
    expect(neu.reduce((s, z) => s + z.weg, 0) / neu.length).toBeGreaterThan(20000);

    // Der tiefste Stand (Anteil am Vorrat) liegt im Mittel deutlich unter 100 % und haengt am Vorrat (AUSDAUER): wer mehr hat,
    // faellt relativ weniger tief.
    const anteil = neu.map((z) => z.pusteMin / z.pusteMax);
    const mittelAnteil = anteil.reduce((s, v) => s + v, 0) / anteil.length;
    expect(mittelAnteil).toBeLessThan(0.75);
    expect(mittelAnteil).toBeGreaterThan(0.2);
    expect(spearman(anteil, neu.map((z) => z.pusteMax))).toBeGreaterThan(0.3);
    // Wer viel am Ball ist (viele Aktionen), faellt tiefer.
    expect(spearman(anteil, neu.map((z) => z.akt))).toBeLessThan(-0.2);

    // Beteiligung: weniger Feldspieler mit hoechstens drei Ballaktionen als in der alten Regel (Maru-Fall).
    const geister = (l: typeof neu) => l.filter((z) => z.akt <= 3).length / l.length;
    expect(geister(neu)).toBeLessThan(geister(alt));
  }, 240_000);
});
