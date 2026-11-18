/**
 * CLIMBING-FORMAT "CANYON" (Bau 18.11., docs/design/climbing-canyon-bau-18-11.md) -- Node-Motor, kein Chromium.
 *
 *  1. Schalter aus bleibt Standard: ein Canyon-Lauf dazwischen hinterlaesst keinen Zustand, der den
 *     Standard-Climbing-Lauf derselben Saat veraendert (Bit-Gleichheit gegen main belegt der Fingerabdruck,
 *     `node scripts/pruefe-wertung-fingerabdruck.mjs --node`: GESAMT unveraendert).
 *  2. Gezeigt = gebucht: in der zuschaubaren Wiedergabe (sondenLauf, derselbe Takt wie loop()) steht jeder
 *     Kletterer in jedem abgetasteten Tick BITGLEICH dort, wo der gebuchte Lauf (bahnSpurProbe) ihn hat, und
 *     die Zeichnung setzt die Figur auf genau diesen Ort.
 *  3. Mechanik: alle kommen oben an, Seilschaften aus der Aufstellung (6 -> 2+2+2, 5 -> 3+2, 4 -> 2+2), je
 *     Seite verschiedene Wege, Rangeln/Hilfen/Wegwechsel kommen vor und kosten etwas, niemand wartet lange.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

type CanyonLaeufer = {
  n: string; id: number; seite: number; eig: number; weg: string; wegStart: string; seilNr: number; seilGroesse: number;
  zeit: number; warte: number; gegeben: number; bekommen: number; rangeln: number; gewechselt: number; hochgerechnet: boolean;
};
type CanyonMessung = {
  zeit: number; warteMax: number; warteDreiSek: number; warteVierSek: number; laengste: number;
  zaehler: Record<string, number>; seilschaften: { seite: number; nr: number; weg: string; groesse: number }[];
  laeufer: CanyonLaeufer[];
};
type Spur = { namen: { id: number; n: string; seite: number }[]; spur: number[][] };
type Figur = { id: number; n: string; seite: number; pos: number; x: number; y: number; sichtX: number; sichtY: number; zustand: string };
type Arena = {
  bahnFlags: (neu?: unknown) => Record<string, unknown>;
  canyonParameter: (neu?: unknown) => Record<string, unknown>;
  spiele: (d: string, s: number) => unknown;
  disziplinProbe: (d: string, o: unknown) => { varianten?: { spiele: { canyon?: CanyonMessung }[] }[]; spiele?: { canyon?: CanyonMessung }[] };
  bahnSpurProbe: (bd: string, saat: number) => Spur;
  canyonFigurenProbe: () => { rennT: number; laeufer: Figur[] } | null;
  endstandNachlauf: (an: boolean) => void;
  anpfiffCountdown: (an: boolean) => void;
  bahnPodAnzeigen: (bd: string, pod: unknown) => void;
  setDisc: (d: string) => void;
  sondenLauf: (ticks: number) => unknown;
  vorbei: () => boolean;
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const roh = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

let kontext: ReturnType<typeof baueMotorKontext>;
let A: Arena;

function canyonRennen(n: number, jeSeite?: number): CanyonMessung[] {
  A.bahnFlags({ climbingFormat: "canyon" });
  try {
    const x = A.disziplinProbe("climbing", {
      n, canyonDiag: true, ...(jeSeite ? { jeSeite } : {}),
      kaderFamilie: familie.slice(0, 2).map((v: { heim: unknown; gast: unknown }) => ({ heim: v.heim, gast: v.gast })),
    });
    return roh((x.varianten || [{ spiele: x.spiele || [] }]).flatMap((v) => v.spiele.map((s) => s.canyon).filter(Boolean) as CanyonMessung[]));
  } finally {
    A.bahnFlags({ climbingFormat: "standard" });
  }
}

beforeAll(async () => {
  const skripte = ladeMotorSkripte(MOCKUPS);
  kontext = baueMotorKontext();
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({ heim: familie[0].heim.slice(0, 6), gast: familie[0].gast.slice(0, 6), aufstellung: {}, mutatoren: [], seedByDisciplineId: {} });
  vm.runInContext("window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;", kontext.fenster);
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  for (let i = 0; i < 5000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  A = kontext.fenster.__arena as Arena;
}, 120_000);

afterAll(() => kontext?.aufraeumen());

describe("Climbing-Canyon: Schalter", () => {
  it("ist im Standard aus", () => {
    expect(A.bahnFlags().climbingFormat).toBe("standard");
  });
  it("ein Canyon-Lauf dazwischen veraendert den Standard derselben Saat nicht", () => {
    const vorher = JSON.stringify(roh(A.spiele("climbing", 7)));
    A.bahnFlags({ climbingFormat: "canyon" });
    const canyon = JSON.stringify(roh(A.spiele("climbing", 7)));
    A.bahnFlags({ climbingFormat: "standard" });
    const nachher = JSON.stringify(roh(A.spiele("climbing", 7)));
    expect(canyon).not.toBe(vorher);
    expect(nachher).toBe(vorher);
  });
  it("ist deterministisch: dieselbe Saat ergibt denselben Canyon-Lauf", () => {
    A.bahnFlags({ climbingFormat: "canyon" });
    try {
      expect(JSON.stringify(roh(A.spiele("climbing", 42)))).toBe(JSON.stringify(roh(A.spiele("climbing", 42))));
    } finally {
      A.bahnFlags({ climbingFormat: "standard" });
    }
  });
});

describe("Climbing-Canyon: gezeigt = gebucht", () => {
  for (const saat of [1337, 9256]) {
    it(`Saat ${saat}: jede Figur steht in jedem abgetasteten Tick bitgleich am gebuchten Ort`, () => {
      A.bahnFlags({ climbingFormat: "canyon" });
      try {
        const gebucht = roh(A.bahnSpurProbe("climbing", saat));
        A.endstandNachlauf(false);
        A.anpfiffCountdown(false);
        A.bahnPodAnzeigen("climbing", null);
        (kontext.fenster.__olyArenaKader as { seedByDisciplineId: Record<string, number> }).seedByDisciplineId = { climbing: saat };
        A.setDisc("climbing");
        const idx = new Map(gebucht.namen.map((l, i) => [l.id, i]));
        let verglichen = 0;
        let ticks = 0;
        while (ticks < 60 * 60 * 8) {
          A.sondenLauf(37);
          ticks += 37;
          const p = roh(A.canyonFigurenProbe());
          expect(p).not.toBeNull();
          const tick = Math.round(p!.rennT * 60);
          if (tick > 0) {
            const zeile = gebucht.spur[Math.min(tick, gebucht.spur.length) - 1]!;
            for (const l of p!.laeufer) {
              expect(l.pos, `${l.n} @ Tick ${tick}`).toBe(zeile[idx.get(l.id)!]);
              // Die Zeichnung geht vom gebuchten Ort aus; Abweichung nur durch Ruck/Pendeln/Haengen (< 60 Welt-px)
              if (l.zustand !== "ziel") expect(Math.hypot(l.sichtX - l.x, l.sichtY - l.y)).toBeLessThan(60);
              verglichen += 1;
            }
          }
          if (A.vorbei()) break;
        }
        expect(verglichen).toBeGreaterThan(200);
      } finally {
        A.bahnFlags({ climbingFormat: "standard" });
      }
    }, 120_000);
  }
});

describe("Climbing-Canyon: Mechanik", () => {
  let rennen: CanyonMessung[] = [];
  beforeAll(() => { rennen = canyonRennen(6); }, 120_000);

  it("alle kommen oben an, keiner wird hochgerechnet", () => {
    expect(rennen.length).toBe(12);
    for (const r of rennen) {
      expect(r.laeufer.length).toBe(12);
      for (const l of r.laeufer) { expect(l.hochgerechnet).toBe(false); expect(l.zeit).toBeGreaterThan(0); }
      expect(r.zeit).toBeLessThan(80);
    }
  });
  it("Seilschaften aus der Aufstellung: 6 -> 2+2+2, je Seite drei verschiedene Wege", () => {
    for (const r of rennen) for (const s of [0, 1]) {
      const S = r.seilschaften.filter((q) => q.seite === s);
      expect(S.map((q) => q.groesse)).toEqual([2, 2, 2]);
      expect(new Set(S.map((q) => q.weg)).size).toBe(3);
    }
  });
  it("5 -> 3+2 und 4 -> 2+2", () => {
    const fuenf = canyonRennen(1, 5)[0]!;
    const vier = canyonRennen(1, 4)[0]!;
    expect(fuenf.seilschaften.filter((q) => q.seite === 0).map((q) => q.groesse)).toEqual([3, 2]);
    expect(vier.seilschaften.filter((q) => q.seite === 0).map((q) => q.groesse)).toEqual([2, 2]);
  }, 60_000);
  it("Rangeln, Hilfen, Ausweichen und Proben kommen vor", () => {
    const summe = (k: string) => rennen.reduce((a, r) => a + (r.zaehler[k] || 0), 0);
    expect(summe("rangeln") + summe("abgeblockt")).toBeGreaterThan(0);
    expect(summe("zieht") + summe("schiebt")).toBeGreaterThan(0);
    expect(summe("obenrum") + summe("aussen")).toBeGreaterThan(0);
    expect(summe("rutsch") + summe("wanken") + summe("fehlgriff")).toBeGreaterThan(0);
  });
  it("Rangeln geht mehrfach (Chris 18.11.), Hilfen sind gedeckelt", () => {
    const P = A.canyonParameter() as { hilfe: string; hilfeGedeckelt: { zugMax: number } };
    expect(P.hilfe).toBe("gedeckelt");
    const alle = rennen.flatMap((r) => r.laeufer);
    expect(Math.max(...alle.map((l) => l.rangeln))).toBeGreaterThanOrEqual(2);
    for (const r of rennen) for (const l of r.laeufer) expect(l.gegeben).toBeLessThanOrEqual(P.hilfeGedeckelt.zugMax + 6);
  });
  it("Warten bleibt kurz: Anteil unter 5 %, vier oder mehr zugleich hoechstens kurz", () => {
    const tempo = (A.canyonParameter() as { tempo: number }).tempo;
    let warte = 0, zeit = 0;
    for (const r of rennen) for (const l of r.laeufer) { warte += l.warte; zeit += l.zeit * tempo; }
    expect(warte / zeit).toBeLessThan(0.05);
    for (const r of rennen) expect(r.warteVierSek).toBeLessThan(1.5);
  });
});
