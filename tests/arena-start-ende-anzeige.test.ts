import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * ARENA START/ENDE (18.11., Chris' Live-Befunde Spieltag 1, D1 Climbing / D2 Battlefield).
 *
 *  1. KEIN ENDSTAND VOR DEM START: vor dem ersten Tick stand oben "7 · 3 (von 10)" und unten in der
 *     Kaderleiste "7:3" -- die Rangpunkte N..1 auf der stabilen Laeuferreihenfolge, solange noch
 *     niemand einen Meter gezeigt hat. Vor dem Start steht jede Bahn jetzt 0 : 0.
 *  2. VORSTELLUNG IM VIER-TEAM-POD: die Vorstellung zeigte die ersten beiden Teams der Gruppe statt
 *     des gesteuerten Teams. Der Host reicht `eigeneSeite`/`gegnerSeite` mit, die Vorstellung liest sie.
 *
 * Laeuft ueber den Node-Motor (kein Chromium). Kader: erste Paarung der Kaderfamilie (echte Spieler).
 */

type Probe = { standLive: number[] | null; rennT: number; reihe: unknown[] };
type Lauf = { seiten: number[]; laeufer: { zeit: number | null; raus: boolean }[] };
type Arena = {
  setDisc: (d: string) => void;
  zeitfahrenVizProbe: () => Probe;
  bahnLauf: (d: string, s: number) => Lauf;
  battlefieldPodAnzeigen: (pod: unknown) => boolean;
  einlaufSeitenProbe: () => number[];
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten;

const kontexte: ReturnType<typeof baueMotorKontext>[] = [];
async function ladeArena(heim: unknown[], gast: unknown[]): Promise<Arena> {
  const skripte = ladeMotorSkripte(MOCKUPS);
  const kontext = baueMotorKontext();
  kontexte.push(kontext);
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({ heim, gast, aufstellung: {}, mutatoren: [] });
  vm.runInContext(
    "window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;",
    kontext.fenster,
  );
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  for (let i = 0; i < 5000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  return kontext.fenster.__arena as Arena;
}

let zweiGegenZwei: Arena;
let voll: Arena;

beforeAll(async () => {
  // 2 gegen 2 ist genau Chris' Fall ("(von 10)" = vier Kletterer).
  zweiGegenZwei = await ladeArena(familie[0].heim.slice(0, 2), familie[0].gast.slice(0, 2));
  voll = await ladeArena(familie[1].heim, familie[1].gast);
}, 120_000);

afterAll(() => {
  for (const k of kontexte) k.aufraeumen();
});

describe("kein Endstand vor dem Start", () => {
  for (const d of ["climbing", "spurt", "time-trial", "takeshis-castle", "staffel"]) {
    it(`${d}: vor dem ersten Tick steht 0 : 0 (2 gegen 2 und voller Kader)`, () => {
      for (const A of [zweiGegenZwei, voll]) {
        A.setDisc(d);
        const p = A.zeitfahrenVizProbe();
        expect(p.rennT).toBe(0);
        expect(p.reihe.length).toBeGreaterThan(0);
        expect(p.standLive).toEqual([0, 0]);
      }
    });
  }

  it("nach dem Rennen steht wieder ein echter Rangpunktestand (Summe N*(N+1)/2)", () => {
    for (const d of ["climbing", "spurt"]) {
      const lauf = zweiGegenZwei.bahnLauf(d, 1337);
      const n = lauf.laeufer.length;
      expect(lauf.seiten[0] + lauf.seiten[1]).toBe((n * (n + 1)) / 2);
    }
  });
});

describe("Vorstellung im Vier-Team-Pod zeigt das gesteuerte Team", () => {
  const pod = (eigeneSeite: number | null, gegnerSeite: number | null) => ({
    teams: [0, 1, 2, 3].map((i) => ({
      name: `Team ${i}`,
      kurz: null,
      kader: (i < 2 ? familie[2] : familie[3])[i % 2 === 0 ? "heim" : "gast"],
    })),
    k: 4,
    saat: 4711,
    aufstellung: [{}, {}, {}, {}],
    eigeneSeite,
    gegnerSeite,
  });

  it("ohne Pod bleibt es bei Heim gegen Gast", () => {
    voll.battlefieldPodAnzeigen(null);
    voll.setDisc("battlefield");
    expect(voll.einlaufSeitenProbe()).toEqual([0, 1]);
  });

  it("mit eigeneSeite/gegnerSeite zeigt die Vorstellung genau diese beiden", () => {
    voll.setDisc("battlefield");
    expect(voll.battlefieldPodAnzeigen(pod(2, 3))).toBe(true);
    expect(voll.einlaufSeitenProbe()).toEqual([2, 3]);
    expect(voll.battlefieldPodAnzeigen(pod(3, null))).toBe(true);
    expect(voll.einlaufSeitenProbe()).toEqual([3, 0]);
  });

  it("ohne Angabe (alter Host) bleibt es bei den ersten beiden der Gruppe", () => {
    expect(voll.battlefieldPodAnzeigen(pod(null, null))).toBe(true);
    expect(voll.einlaufSeitenProbe()).toEqual([0, 1]);
    voll.battlefieldPodAnzeigen(null);
  });
});
