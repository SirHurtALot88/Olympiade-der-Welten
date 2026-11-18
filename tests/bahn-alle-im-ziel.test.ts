import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * ENDE ERST, WENN ALLE IM ZIEL SIND (18.11., Chris woertlich: "Ende bitte erst wenn ALLE im Ziel sind,
 * damit die Spieler auch entsprechend mit PPs geratet werden koennen"). Climbing endete bis dahin am
 * Lead-Zeitlimit (10,6 Sim-s) mit im Mittel 64 % Kletterern ohne Zeit. Jetzt hat in jeder Bahn jeder
 * Teilnehmer eine Zeit (oder ist bei Takeshi ausgeschieden), und die Rangliste ordnet nach Zeit.
 * Laeuft ueber den Node-Motor (kein Chromium), Kader aus der Kaderfamilie (echte Spieler).
 */

type Laeufer = { n: string; platz: number; zeit: number | null; raus: boolean };
type Lauf = { zeit: number; seiten: number[]; laeufer: Laeufer[] };
type Arena = { bahnLauf: (d: string, s: number) => Lauf; bahnFlags: (neu?: unknown) => unknown };

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten;
const SAATEN = [1, 7, 42, 1337, 9256];

const kontexte: ReturnType<typeof baueMotorKontext>[] = [];
const arenen: { name: string; A: Arena }[] = [];

beforeAll(async () => {
  const skripte = ladeMotorSkripte(MOCKUPS);
  for (const [name, heim, gast] of [
    ["2 gegen 2", familie[0].heim.slice(0, 2), familie[0].gast.slice(0, 2)],
    ["voller Kader", familie[3].heim, familie[3].gast],
  ] as const) {
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
    arenen.push({ name, A: kontext.fenster.__arena as Arena });
  }
}, 120_000);

afterAll(() => {
  for (const k of kontexte) k.aufraeumen();
});

describe("Bahn: Ende erst, wenn alle im Ziel sind", () => {
  for (const d of ["climbing", "spurt", "time-trial", "takeshis-castle", "staffel"]) {
    it(`${d}: jeder Teilnehmer hat am Ende eine Zeit (oder ist ausgeschieden)`, () => {
      for (const { name, A } of arenen) {
        for (const s of SAATEN) {
          const lauf = A.bahnLauf(d, s);
          const ohneZeit = lauf.laeufer.filter((u) => u.zeit == null && !u.raus).map((u) => u.n);
          expect(ohneZeit, `${d} ${name} Saat ${s}`).toEqual([]);
        }
      }
    });
  }

  it("climbing: kein Rennen endet mehr an einer Uhr -- das Ende ist der letzte Zieleinlauf, unter dem Deckel", () => {
    for (const { name, A } of arenen) {
      for (const s of SAATEN) {
        const lauf = A.bahnLauf("climbing", s);
        const letzte = Math.max(...lauf.laeufer.map((u) => u.zeit ?? 0));
        expect(lauf.zeit, `${name} Saat ${s}`).toBeLessThanOrEqual(60);
        expect(lauf.zeit - letzte, `${name} Saat ${s}`).toBeLessThan(0.05);
      }
    }
  });

  it("climbing: die Platzierung folgt der Zeit, und die Rangpunkte summieren sich zu N*(N+1)/2", () => {
    for (const { A } of arenen) {
      const lauf = A.bahnLauf("climbing", 7);
      const zeiten = [...lauf.laeufer].sort((a, b) => a.platz - b.platz).map((u) => u.zeit as number);
      for (let i = 1; i < zeiten.length; i += 1) expect(zeiten[i]).toBeGreaterThanOrEqual(zeiten[i - 1]);
      const n = lauf.laeufer.length;
      expect(lauf.seiten[0] + lauf.seiten[1]).toBeCloseTo((n * (n + 1)) / 2, 9);
    }
  });
});
