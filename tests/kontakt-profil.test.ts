import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * KONTAKT-SCHRITT 0 (16.11., docs/design/kontakt-persoenlichkeit-16-11.md Abschnitte 2, 3.5, 6.5, 10):
 * `kontaktProfil(p)` (vier Regler aus Persoenlichkeit und Traits), Flag-Geruest, eigener Zufallsstrom,
 * Kontrafaktik "alle ein Typ" und die Zaehler. Laeuft ueber den Node-Motor (kein Chromium noetig),
 * damit die Pruefung auch in der vollen Suite ohne Browser greift.
 */

type Profil = {
  pers: string;
  kb: number;
  ha: number;
  di: number;
  aw: number;
  pMin: number;
  neigung: string | null;
  revanche: boolean;
  schutz: boolean;
  haftet: boolean;
  warum: string[];
};
type Spieler = { n?: string; c?: string; r?: string; sub?: string[]; tp?: string[]; tn?: string[] };
type Arena = {
  kontaktProfil: (p: Spieler, persKey?: string) => Profil;
  kontaktBasis: () => Record<string, { kb: number; ha: number; di: number; aw: number }>;
  kontaktPersZwang: (...arg: unknown[]) => { typ: string; traits: boolean } | null;
  kontaktFlags: (neu?: unknown) => Record<string, unknown>;
  bahnFlags: (neu?: unknown) => unknown;
  kontaktZaehler: () => Array<Record<string, number | string>>;
  kontaktZufallProbe: (saat: number | string, n: number) => number[];
  spiele: (d: string, s: number) => unknown;
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten;

let kontext: ReturnType<typeof baueMotorKontext>;
let A: Arena;
let standardFlags: Record<string, unknown>;
// Ergebnisse kommen aus dem Kontext-Realm: als JSON in den Test-Realm holen.
const roh = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const profil = (p: Spieler, key?: string) => roh(A.kontaktProfil(p, key));

beforeAll(async () => {
  const skripte = ladeMotorSkripte(MOCKUPS);
  kontext = baueMotorKontext();
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({
    heim: familie[0].heim,
    gast: familie[0].gast,
    aufstellung: {},
    mutatoren: [],
  });
  vm.runInContext(
    "window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;",
    kontext.fenster,
  );
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  for (let i = 0; i < 5000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  A = kontext.fenster.__arena as Arena;
  // Seit 17.11. ist Spurt klassisch scharf (Engine-Standard spurt:{stufe:3}, Konzept 6.5 Punkt 3).
  // Standard festhalten, danach fuer die Schritt-0-Pruefungen unten auf "aus".
  standardFlags = roh(A.kontaktFlags());
  A.kontaktFlags({ spurt: null });
}, 120_000);

afterAll(() => {
  kontext?.aufraeumen();
});

describe("kontaktProfil · Basis je Persoenlichkeit (Abschnitt 2.2)", () => {
  const ERWARTET: Record<string, [number, number, number, number, number]> = {
    draufgaenger: [90, 85, 30, 20, 0.3],
    opportunist: [70, 45, 40, 65, 0.45],
    duellant: [55, 60, 60, 40, 0.45],
    schleicher: [50, 35, 55, 90, 0.55],
    beschuetzer: [50, 55, 70, 30, 0.6],
    bollwerk: [25, 60, 75, 15, 0.55],
  };
  it.each(Object.entries(ERWARTET))("%s", (typ, [kb, ha, di, aw, pMin]) => {
    const p = profil({}, typ);
    expect([p.pers, p.kb, p.ha, p.di, p.aw, p.pMin]).toEqual([typ, kb, ha, di, aw, pMin]);
    expect(p.warum).toEqual([]);
  });

  it("kb/100 ist Zeichen fuer Zeichen die alte willTackeln-Tabelle (beschuetzer = alter Rueckfall 0,5)", () => {
    const alt: Record<string, number> = {
      draufgaenger: 0.9,
      duellant: 0.55,
      schleicher: 0.5,
      opportunist: 0.7,
      bollwerk: 0.25,
      beschuetzer: 0.5,
    };
    const basis = roh(A.kontaktBasis());
    expect(Object.keys(basis).sort()).toEqual(Object.keys(alt).sort());
    for (const [typ, w] of Object.entries(alt)) expect(basis[typ].kb / 100).toBe(w);
    expect(basis).not.toHaveProperty("taktiker");
  });

  it("ohne Schluessel leitet es den Typ ueber leitePers() ab, Unbekanntes faellt auf duellant", () => {
    expect(profil({ c: "Berserker" }).pers).toBe("draufgaenger");
    expect(profil({ c: "Tank" }).pers).toBe("bollwerk");
    expect(profil({}).pers).toBe("duellant");
    expect(profil({}, "taktiker").pers).toBe("duellant");
  });

  it("bedingte Neigungen: beschuetzer schuetzt, Egomaniac nimmt den Schutz-Reflex", () => {
    expect(profil({}, "beschuetzer").schutz).toBe(true);
    expect(profil({ tn: ["Egomaniac"] }, "beschuetzer").schutz).toBe(false);
    expect(profil({ tp: ["Loyal"] }, "duellant").schutz).toBe(true);
    expect(profil({ tn: ["Vindictive"] }, "duellant").revanche).toBe(true);
    expect(profil({ tn: ["Vindictive", "ColdBlooded"] }, "duellant").revanche).toBe(false);
  });
});

describe("kontaktProfil · Trait-Verschiebung, Deckel, Klemme (Abschnitt 2.3)", () => {
  it("einzelne Traits verschieben additiv", () => {
    const p = profil({ tn: ["Cheater"] }, "duellant");
    expect([p.kb, p.ha, p.di, p.aw]).toEqual([55, 60, 35, 40]);
    expect(p.warum).toEqual(["Cheater"]);
    const q = profil({ tp: ["Disciplined", "Cool"] }, "duellant");
    expect([q.di, q.aw]).toEqual([90, 50]); // di +35 -> Deckel +30
    expect(profil({ tn: ["Gambler"] }, "duellant").pMin).toBe(0.35);
  });

  it("Summe je Regler auf +-30 gedeckelt", () => {
    // Cheater -25, Renegade -20, Feisty -15 = -60 -> -30
    expect(profil({ tn: ["Cheater", "Renegade", "Feisty"] }, "duellant").di).toBe(30);
    // Disciplined +25, Fair +20 = +45 -> +30 (Basis duellant 60 -> 90)
    expect(profil({ tp: ["Disciplined", "Fair"] }, "duellant").di).toBe(90);
  });

  it("Ergebnis auf 5..95 geklemmt", () => {
    const hoch = profil({ tp: ["Fearless", "FiredUp"] }, "draufgaenger");
    expect(hoch.kb).toBe(95);
    expect(hoch.aw).toBe(5);
    const tief = profil({ tp: ["Relaxed"], tn: ["Timid", "FaintHearted", "Lazy"] }, "bollwerk");
    expect(tief.kb).toBe(5);
    expect(tief.aw).toBe(45);
  });

  it("unbekannte und wertungsfreie Traits aendern nichts", () => {
    const basis = profil({}, "opportunist");
    const mit = profil({ tp: ["Healthy", "Sexy", "GibtEsNicht"], tn: ["Mercenary"] }, "opportunist");
    expect({ ...mit, warum: [] }).toEqual(basis);
  });

  it("deterministisch: Reihenfolge und Doppelungen der Traits sind egal", () => {
    const a = profil({ tp: ["Cool", "Fearless"], tn: ["Gambler", "Cruel"] }, "schleicher");
    const b = profil({ tp: ["Fearless", "Cool", "Cool"], tn: ["Cruel", "Gambler", "Gambler"] }, "schleicher");
    expect({ ...a, warum: [] }).toEqual({ ...b, warum: [] });
    expect(profil({ tp: ["Cool"] }, "schleicher")).toEqual(profil({ tp: ["Cool"] }, "schleicher"));
  });

  it("echte Kader: jeder Spieler bekommt ein gueltiges Profil", () => {
    for (const p of [...familie[0].heim, ...familie[0].gast] as Spieler[]) {
      const pr = profil(p);
      for (const r of [pr.kb, pr.ha, pr.di, pr.aw]) {
        expect(r).toBeGreaterThanOrEqual(5);
        expect(r).toBeLessThanOrEqual(95);
      }
      expect(pr.pMin).toBeGreaterThan(0);
      expect(pr.pMin).toBeLessThan(1);
    }
  });
});

describe("Kontrafaktik 'alle ein Typ'", () => {
  it("zwingt das Profil auf einen Typ, ohne Traits; mit {traits:true} mit Traits; null hebt auf", () => {
    expect(roh(A.kontaktPersZwang())).toBeNull();
    expect(roh(A.kontaktPersZwang("bollwerk"))).toEqual({ typ: "bollwerk", traits: false });
    try {
      const p = profil({ c: "Berserker", tp: ["Fearless"] });
      expect([p.pers, p.kb, p.aw]).toEqual(["bollwerk", 25, 15]);
      expect(profil({}, "draufgaenger").pers).toBe("bollwerk");
      A.kontaktPersZwang({ typ: "bollwerk", traits: true });
      expect(profil({ tp: ["Fearless"] }).kb).toBe(35);
      // Ungueltiger Typ laesst den Zustand stehen.
      expect(roh(A.kontaktPersZwang("taktiker"))).toEqual({ typ: "bollwerk", traits: true });
    } finally {
      A.kontaktPersZwang(null);
    }
    expect(roh(A.kontaktPersZwang())).toBeNull();
  });
});

describe("Flag-Geruest, eigener Zufallsstrom, Zaehler", () => {
  it("Standard: nur Spurt scharf ({stufe:3}, seit 17.11.); setzen und loeschen ueber kontaktFlags/bahnFlags", () => {
    expect(standardFlags).toEqual({ spurt: { stufe: 3 } });
    expect(roh(A.kontaktFlags())).toEqual({});
    expect(roh(A.kontaktFlags({ spurt: { stufe: 0 }, football: { stufe: 0 }, gibtsnicht: { stufe: 0 } }))).toEqual({
      spurt: { stufe: 0 },
      football: { stufe: 0 },
    });
    A.kontaktFlags({ spurt: null, football: null });
    expect(roh(A.kontaktFlags())).toEqual({});
    A.bahnFlags({ kontakt: { "takeshis-castle": { stufe: 0 }, football: { stufe: 0 } } });
    expect(roh(A.kontaktFlags())).toEqual({ "takeshis-castle": { stufe: 0 } });
    A.kontaktFlags({ "takeshis-castle": null });
    expect(roh(A.kontaktFlags())).toEqual({});
  });

  it("eigener Strom ist je Saat deterministisch und liegt in [0,1)", () => {
    const a = roh(A.kontaktZufallProbe(7, 6));
    expect(roh(A.kontaktZufallProbe(7, 6))).toEqual(a);
    expect(roh(A.kontaktZufallProbe(8, 6))).not.toEqual(a);
    for (const x of a) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it.each(["spurt", "takeshis-castle"])(
    "%s: Flag an ist in Schritt 0 wirkungslos, rr() bleibt unberuehrt, Zaehler laufen",
    (d) => {
      const aus = JSON.stringify(A.spiele(d, 7));
      const zaehlerAus = roh(A.kontaktZaehler());
      A.kontaktFlags({ [d]: { stufe: 0 } });
      try {
        const an = JSON.stringify(A.spiele(d, 7));
        expect(an).toBe(aus);
        const zaehlerAn = roh(A.kontaktZaehler());
        const summe = (z: Array<Record<string, number | string>>, k: string) =>
          z.reduce((s, r) => s + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
        // Die echten Zaehler sind mit und ohne Flag gleich (gleiches Rennen) ...
        for (const k of ["anlauf", "versuch", "treffer", "insLeere", "abgeprallt"])
          expect(summe(zaehlerAn, k)).toBe(summe(zaehlerAus, k));
        // Takeshi rempelt gemessen ~13x je Rennen: dort darf der Zaehler nicht leer bleiben.
        if (d === "takeshis-castle") expect(summe(zaehlerAn, "versuch")).toBeGreaterThan(0);
        // ... und nur mit Flag laeuft die Schatten-Buchhaltung, je Versuch genau ein Zug.
        expect(summe(zaehlerAus, "schattenStromZug")).toBe(0);
        expect(summe(zaehlerAn, "schattenStromZug")).toBe(summe(zaehlerAn, "versuch"));
        expect(summe(zaehlerAn, "schattenUeberPMin") + summe(zaehlerAn, "schattenUnterPMin")).toBe(
          summe(zaehlerAn, "versuch"),
        );
      } finally {
        A.kontaktFlags({ [d]: null });
      }
    },
    120_000,
  );
});
