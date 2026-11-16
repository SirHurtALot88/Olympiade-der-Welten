import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARENA_KULISSEN_PROFILE,
  berechneOberflaechenwert,
  kulisseHash,
  kulisseSchluessel,
  kulissenProfileImEngineFormat,
  kulissenTendenz,
  kulissenTendenzChips,
  waehleKulisse,
  waehleKulisseFuerFixture,
  waehleKulisseIndex,
} from "@/lib/battle/arena-kulisse";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import { resolveArenaHostSeeds } from "@/lib/battle/arena-host-seed";
// Nur gelesen (Regel 3 des Konzepts: nur Matrix-Attribute) -- die Matrix wird nirgends veraendert.
import { officialDisciplineWeightMatrix } from "@/lib/player-generator/official-discipline-weights";
import type { Fixture } from "@/lib/data/olyDataTypes";

/**
 * OBERFLAECHEN-EFFEKTE (08.11., docs/design/oberflaechen-effekte-konzept-08-11.md).
 *   1. Engine und TS tragen dieselben Profile und denselben Hash (bit-identisch).
 *   2. Jedes Profil haelt die Regeln 1-5 des Konzepts (Nullsumme je Variante und je Attribut,
 *      nur Matrix-Attribute, Amplitude, Primaerweg >= 90 %).
 *   3. Die Varianten-Reihenfolge stimmt mit battle-mode.kulissen.js ueberein, wo die Disziplin dort
 *      schon gezeichnet wird (gleicher Hash-Index fuer Anzeige und Wertung).
 */

const ENGINE = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");
const KULISSEN_JS = readFileSync(join(process.cwd(), "public/mockups/battle-mode.kulissen.js"), "utf8");

function engineFunktion(name: string): string {
  const start = ENGINE.indexOf(`function ${name}(`);
  expect(start, `function ${name} nicht gefunden`).toBeGreaterThan(-1);
  let tiefe = 0;
  for (let i = ENGINE.indexOf("{", start); i < ENGINE.length; i += 1) {
    if (ENGINE[i] === "{") tiefe += 1;
    if (ENGINE[i] === "}") {
      tiefe -= 1;
      if (tiefe === 0) return ENGINE.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} nicht abgeschlossen`);
}

const engineKulisseHash = new Function(
  `${engineFunktion("normalisiereSaat")}\n${engineFunktion("ispyMischeHash")}\nreturn (s)=>ispyMischeHash(normalisiereSaat(s));`,
)() as (s: string) => number;

describe("Engine <-> TS", () => {
  it("KULISSEN_PROFILE in der Engine entspricht ARENA_KULISSEN_PROFILE", () => {
    const treffer = ENGINE.match(/const KULISSEN_PROFILE=(\{.*\});\n/);
    expect(treffer, "KULISSEN_PROFILE-Zeile nicht gefunden").not.toBeNull();
    expect(JSON.parse(treffer![1])).toEqual(kulissenProfileImEngineFormat());
  });

  it("kulisseHash ist bit-identisch zum Motor (FNV-1a + Avalanche)", () => {
    const schluessel = [
      kulisseSchluessel("tennis", 1, "", "", ""),
      kulisseSchluessel("tennis", 123456789, "team-a", "team-b", "md-7"),
      kulisseSchluessel("mini-dm", "save:s1:md7:mini-dm", "x", "y", 3),
      kulisseSchluessel("tdm", undefined, null, undefined, null),
      "ä|ö|ü|ß|€",
    ];
    for (let i = 0; i < 500; i += 1) schluessel.push(kulisseSchluessel("tennis", (i * 2654435761) >>> 0, `h${i}`, `g${i}`, i % 7));
    for (const s of schluessel) expect(kulisseHash(s)).toBe(engineKulisseHash(s));
  });

  it("der Motor nutzt fuer die Wertung denselben Schluessel wie fuer die Anzeige", () => {
    const anzeige = engineFunktion("kulisseWaehlen");
    const wertung = engineFunktion("kulisseSpielId");
    const feld = 'meta.heimTeamId||"", meta.gastTeamId||"", meta.spieltag??""].join("|")';
    expect(anzeige).toContain(feld);
    expect(wertung).toContain(feld);
    expect(wertung).toContain("kulisseByDisciplineId");
    expect(anzeige).toContain("kulisseByDisciplineId");
  });

  it("die Varianten-Reihenfolge stimmt mit battle-mode.kulissen.js ueberein (wo gezeichnet)", () => {
    const fenster: { __ARENA_KULISSEN?: Record<string, Array<{ id: string }>> } = {};
    new Function("window", KULISSEN_JS)(fenster);
    for (const [d, p] of Object.entries(ARENA_KULISSEN_PROFILE)) {
      const gezeichnet = fenster.__ARENA_KULISSEN?.[d];
      if (!gezeichnet) continue;
      expect(gezeichnet.map((k) => k.id)).toEqual(p.varianten.map((v) => v.id));
    }
  });
});

describe("Regeln je Profil (Konzept Abschnitt 3)", () => {
  for (const [d, p] of Object.entries(ARENA_KULISSEN_PROFILE)) {
    const matrix = officialDisciplineWeightMatrix[d as keyof typeof officialDisciplineWeightMatrix] as Record<string, number>;
    it(`${d}: Nullsumme je Variante, je Attribut, nur Matrix-Attribute, Amplitude, Primaerweg`, () => {
      expect(matrix).toBeTruthy();
      const spalten: Record<string, number> = {};
      for (const v of p.varianten) {
        const werte = Object.entries(v.profil);
        expect(werte.reduce((s, [, x]) => s + (x ?? 0), 0), `${d}/${v.id} Zeilensumme`).toBe(0);
        expect(werte.reduce((s, [, x]) => s + Math.abs(x ?? 0), 0)).toBeLessThanOrEqual(16);
        for (const [k, x] of werte) {
          expect(matrix[k] ?? 0, `${d}/${v.id}: ${k} steht nicht in der Matrix`).toBeGreaterThan(0);
          expect(Math.abs(x ?? 0)).toBeLessThanOrEqual(4);
          expect((matrix[k] ?? 0) + (x ?? 0)).toBeGreaterThan(0);
          spalten[k] = (spalten[k] ?? 0) + (x ?? 0);
        }
      }
      for (const [k, s] of Object.entries(spalten)) expect(s, `${d}: Spaltensumme ${k}`).toBe(0);
      const [primaer, gewicht] = Object.entries(matrix).sort((a, b) => b[1] - a[1])[0];
      for (const v of p.varianten) {
        expect(gewicht + ((v.profil as Record<string, number>)[primaer] ?? 0)).toBeGreaterThanOrEqual(0.9 * gewicht);
      }
      expect(p.deckel).toBeLessThanOrEqual(8);
    });
  }
});

describe("waehleKulisse", () => {
  it("ist deterministisch, nur fuer Disziplinen mit Profil, und etwa gleichverteilt", () => {
    expect(waehleKulisse("tdm", 1, "a", "b", "md")).toBeNull();
    const zaehler: Record<string, number> = {};
    for (let i = 0; i < 3000; i += 1) {
      const saat = seedZuZahl(buildArenaMatchSeed({
        saveId: "s", seasonId: "season-1", matchdayId: `md-${i % 30}`, disciplineId: "tennis",
        homeTeamId: `t${i % 13}`, awayTeamId: `t${(i * 7) % 11}x`,
      }));
      const v = waehleKulisseFuerFixture({ disziplin: "tennis", saat, homeTeamId: `t${i % 13}`, awayTeamId: `t${(i * 7) % 11}x`, matchdayId: `md-${i % 30}` });
      expect(v).not.toBeNull();
      expect(waehleKulisse("tennis", saat, `t${i % 13}`, `t${(i * 7) % 11}x`, `md-${i % 30}`)?.id).toBe(v!.id);
      zaehler[v!.id] = (zaehler[v!.id] ?? 0) + 1;
    }
    for (const v of ARENA_KULISSEN_PROFILE.tennis.varianten) expect(zaehler[v.id]).toBeGreaterThan(850);
  });

  it("Index-Rechnung = Engine-Rechnung", () => {
    const s = kulisseSchluessel("tennis", 42, "h", "g", "md-1");
    expect(waehleKulisseIndex(3, "tennis", 42, "h", "g", "md-1")).toBe(engineKulisseHash(s) % 3);
  });

  it("Host-Saaten liefern die gebuchte Kulisse orientierungsunabhaengig mit", () => {
    const fixture = { homeTeamId: "heim", awayTeamId: "gast" } as unknown as Fixture;
    const fixtureIndex = new Map<string, Fixture>([["heim", fixture], ["gast", fixture]]);
    const basis = { saveId: "s", seasonId: "season-1", matchdayId: "md-3", disciplineIds: ["tennis", "basketball"], fixtureIndex };
    const a = resolveArenaHostSeeds({ ...basis, heimTeamId: "heim", gastTeamId: "gast" });
    const b = resolveArenaHostSeeds({ ...basis, heimTeamId: "gast", gastTeamId: "heim" });
    expect(a.kulisseByDisciplineId).toEqual(b.kulisseByDisciplineId);
    expect(Object.keys(a.kulisseByDisciplineId)).toEqual(["tennis"]);
    expect(a.kulisseByDisciplineId.tennis).toBe(
      waehleKulisseFuerFixture({ disziplin: "tennis", saat: a.seedByDisciplineId.tennis, homeTeamId: "heim", awayTeamId: "gast", matchdayId: "md-3" })!.id,
    );
  });
});

describe("Oberflaechenwert und Tendenz", () => {
  it("haengt nur von der Form des Profils ab, nicht von der Hoehe", () => {
    const flach = { awareness: 70, speed: 70, intelligence: 70, stamina: 70, dexterity: 70, determination: 70, charisma: 70 };
    for (const v of ARENA_KULISSEN_PROFILE.tennis.varianten) {
      expect(berechneOberflaechenwert(flach, "tennis", v.id)!.ow).toBeCloseTo(0, 10);
    }
    const sandSpezialist = { awareness: 30, speed: 25, intelligence: 40, stamina: 90, dexterity: 85, determination: 70, charisma: 40 };
    const ow = berechneOberflaechenwert(sandSpezialist, "tennis", "riviera")!;
    expect(ow.ow).toBeGreaterThan(2.5);
    expect(kulissenTendenz(ow.ow)).toBe("++");
    expect(ow.beitraege[0].attribut).toBe("stamina");
  });

  it("deckelt auf +/- deckel", () => {
    const extrem = { stamina: 100, dexterity: 100, determination: 100, awareness: 0, speed: 0, intelligence: 0, charisma: 0 };
    const ow = berechneOberflaechenwert(extrem, "tennis", "riviera")!;
    expect(ow.owRoh).toBeCloseTo(8, 10);
    expect(ow.ow).toBe(5);
  });

  it("Tendenz-Schwellen", () => {
    expect([3, 2.5, 2, 1, 0.5, -0.99, -1, -2.49, -2.5, -4].map(kulissenTendenz))
      .toEqual(["++", "++", "+", "+", "0", "0", "-", "-", "--", "--"]);
  });

  it("Tendenz-Chips: groesste Betraege zuerst", () => {
    const chips = kulissenTendenzChips(ARENA_KULISSEN_PROFILE.tennis.varianten[1]);
    expect(chips.map((c) => `${c.attribut}${c.richtung}`)).toEqual(["staminaauf", "dexterityauf", "speedab"]);
  });
});
