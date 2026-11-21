import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * TENNIS: UNGERADE RUBBER-ZAHL (21.11., Chris: „Tennis 2:2 bei 5 Einzeln“).
 *
 * Das Davis-Cup-Doppel (T-F2, battle-mode.engine.js) fasst die letzten zwei Bretter zu EINEM Rubber
 * zusammen. Bei 5 Spielern je Seite blieben so 3 Einzel + 1 Doppel = 4 Rubber, und ein 2:2 war möglich
 * — im Live-Save an Spieltag 6 bei 4 von 16 Tennis-Duellen. Seit dem Fix gibt es das Doppel nur bei
 * gerader Brettzahl: 2 → 1 Rubber, 3 → 3, 4 → 3, 5 → 5, 6 → 5. Die Rubber-Zahl ist damit immer ungerade,
 * ein Mannschafts-Remis nur noch bei einem einzelnen Brett mit exaktem Punktgleichstand möglich.
 *
 * Geprüft über `disziplinProbe(..., { jeSeite, buehneDiag: true })`: `buehne.seiten` ist der Teamstand
 * in gewonnenen Rubbern (dieselbe Zählung wie `spieleBuehneDuell()`), `buehne.bretter` je Brett der
 * Brettentscheid beider Seiten.
 */

type BrettDiag = { sa: boolean; sb: boolean };
type Probe = { spiele?: Array<{ buehne?: { seiten: number[]; bretter: BrettDiag[] } }> };
type Arena = { disziplinProbe: (d: string, o: Record<string, unknown>) => Probe };

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten as Array<{ heim: unknown[]; gast: unknown[] }>;

let kontext: ReturnType<typeof baueMotorKontext>;
let A: Arena;

beforeAll(async () => {
  const skripte = ladeMotorSkripte(MOCKUPS);
  kontext = baueMotorKontext();
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({ heim: familie[0]!.heim, gast: familie[0]!.gast, aufstellung: {}, mutatoren: [] });
  vm.runInContext(
    "window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;",
    kontext.fenster,
  );
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  for (let i = 0; i < 200 && !kontext.fenster.__arena; i += 1) await new Promise((resolve) => setImmediate(resolve));
  A = kontext.fenster.__arena as Arena;
}, 120_000);

afterAll(() => kontext?.aufraeumen());

/** Erwartete Rubber-Zahl je Spielerzahl: Doppel nur bei gerader Brettzahl. */
const rubber = (n: number) => (n % 2 === 0 ? n - 1 : n);

function probe(jeSeite: number) {
  const ergebnis = A.disziplinProbe("tennis", { n: 12, jeSeite, buehneDiag: true });
  return (ergebnis.spiele ?? []).map((spiel) => spiel.buehne!);
}

describe("Tennis: Rubber-Zahl ist immer ungerade", () => {
  it.each([2, 3, 4, 5, 6])("%i Spieler je Seite", (jeSeite) => {
    const spiele = probe(jeSeite);
    expect(spiele.length).toBe(12);
    for (const spiel of spiele) {
      expect(spiel.bretter).toHaveLength(jeSeite);
      // Jedes Brett ist entschieden (Tennis kennt kein Remis) -- dann summiert sich der Teamstand
      // genau auf die Rubber-Zahl, und eine ungerade Summe kann nie gleich verteilt sein.
      const entschieden = spiel.bretter.every((b) => b.sa !== b.sb);
      if (!entschieden) continue;
      expect(spiel.seiten[0]! + spiel.seiten[1]!).toBe(rubber(jeSeite));
      expect(spiel.seiten[0]).not.toBe(spiel.seiten[1]);
    }
  }, 120_000);

  it("5 Einzel: kein Doppel, fünf Rubber (der gemeldete Fall)", () => {
    const spiele = probe(5);
    expect(spiele.every((spiel) => spiel.seiten[0]! + spiel.seiten[1]! <= 5)).toBe(true);
    expect(spiele.some((spiel) => spiel.seiten[0]! + spiel.seiten[1]! === 5)).toBe(true);
    expect(spiele.some((spiel) => spiel.seiten[0] === spiel.seiten[1])).toBe(false);
  }, 120_000);
});
