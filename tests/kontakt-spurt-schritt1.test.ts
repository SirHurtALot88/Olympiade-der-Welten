import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";

/**
 * KONTAKT-SCHRITT 1 (16.11., docs/design/kontakt-persoenlichkeit-16-11.md Abschnitte 3.1-3.4, 4.1, 6.4):
 * Pilot Spurt klassisch, Stufen 1-3 hinter `BAHN_ART.spurt.kontakt`, Standard null.
 *  - Flag aus (und {stufe:0}) = identisch; ein- und wieder ausgeschaltet = identisch (Rueckweg).
 *  - Flag an = deterministisch, wirkt nur im klassischen Spurt (nicht Takeshi, Hatz, HYROX).
 *  - Stufe 1: Kosten wie spezifiziert (Grundpreis je Versuch, Mini-Stun je Fehlschlag).
 *  - Stufe 2: Auswahlschwelle pMin (wählerische Typen verzichten öfter), Verteidiger-Wahl.
 *  - Stufe 3: Foul/Haenger nur dort; einzeln abschaltbar.
 * Laeuft ueber den Node-Motor (kein Chromium).
 */

type Kontakt = {
  versuche: number; treffer: number; verzichtet: number; insLeere: number; ministun: number;
  getroffen: number; gestanden: number; ausgewichen: number; haenger: number; fouls: number;
  gefoult: number; zeitZugefuegt: number; zeitBezahlt: number;
};
type Laeufer = { n: string; zeit: number | null; kontakt?: Kontakt };
type Lauf = { laeufer: Laeufer[] };
type Arena = {
  kontaktFlags: (neu?: unknown) => Record<string, unknown>;
  kontaktPersZwang: (...arg: unknown[]) => unknown;
  bahnFlags: (neu?: unknown) => unknown;
  bahnLauf: (d: string, s: number) => Lauf;
  spiele: (d: string, s: number) => unknown;
  kontaktZaehler: () => Array<Record<string, number | string>>;
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten;
const SAATEN = Array.from({ length: 24 }, (_, i) => 101 + i * 37);

let kontext: ReturnType<typeof baueMotorKontext>;
let A: Arena;
const roh = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function mitFlag<T>(flag: unknown, f: () => T, zwang: string | null = null): T {
  A.kontaktFlags({ spurt: flag });
  if (zwang) A.kontaktPersZwang(zwang);
  try {
    return f();
  } finally {
    A.kontaktFlags({ spurt: null });
    A.kontaktPersZwang(null);
  }
}
const laeufe = () => SAATEN.map((s) => roh(A.bahnLauf("spurt", s)));
function summe(liste: Lauf[], k: keyof Kontakt): number {
  return liste.reduce((s, l) => s + l.laeufer.reduce((t, u) => t + (u.kontakt ? Number(u.kontakt[k]) : 0), 0), 0);
}

beforeAll(async () => {
  const skripte = ladeMotorSkripte(MOCKUPS);
  kontext = baueMotorKontext();
  // Variante 2 der Kaderfamilie: genug Wucht im Feld, dass es je Rennen mehrere Rempler gibt.
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({
    heim: familie[2].heim,
    gast: familie[2].gast,
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
  // Mit Kader waehlt die Saat sonst das Spurt-Format (Hatz/HYROX); die Tests brauchen den klassischen Spurt.
  A.bahnFlags({ spurtFormat: "klassisch" });
}, 120_000);

afterAll(() => {
  kontext?.aufraeumen();
});

describe("Flag aus = identisch", () => {
  it("ohne Flag, mit {stufe:0} und nach Ein-/Ausschalten von {stufe:3}: dasselbe Rennen, kein kontakt-Schluessel", () => {
    const aus = SAATEN.slice(0, 8).map((s) => JSON.stringify(A.spiele("spurt", s)));
    const ausLauf = JSON.stringify(roh(A.bahnLauf("spurt", 7)));
    expect(ausLauf).not.toContain('"kontakt"');
    mitFlag({ stufe: 0 }, () => {
      expect(SAATEN.slice(0, 8).map((s) => JSON.stringify(A.spiele("spurt", s)))).toEqual(aus);
      expect(JSON.stringify(roh(A.bahnLauf("spurt", 7)))).toBe(ausLauf);
    });
    mitFlag({ stufe: 3 }, () => A.spiele("spurt", 7));
    expect(SAATEN.slice(0, 8).map((s) => JSON.stringify(A.spiele("spurt", s)))).toEqual(aus);
    expect(JSON.stringify(roh(A.bahnLauf("spurt", 7)))).toBe(ausLauf);
  }, 120_000);

  it("ein Spurt-Flag laesst Takeshi, Hatz und HYROX unberuehrt (Stufen wirken nur im klassischen Spurt)", () => {
    const takeshi = JSON.stringify(A.spiele("takeshis-castle", 7));
    const formate = ["hatz", "hyrox"].map((fmt) => {
      A.bahnFlags({ spurtFormat: fmt });
      try {
        return JSON.stringify(A.spiele("spurt", 7));
      } finally {
        A.bahnFlags({ spurtFormat: "klassisch" });
      }
    });
    mitFlag({ stufe: 3 }, () => {
      expect(JSON.stringify(A.spiele("takeshis-castle", 7))).toBe(takeshi);
      ["hatz", "hyrox"].forEach((fmt, i) => {
        A.bahnFlags({ spurtFormat: fmt });
        try {
          expect(JSON.stringify(A.spiele("spurt", 7))).toBe(formate[i]);
        } finally {
          A.bahnFlags({ spurtFormat: "klassisch" });
        }
      });
    });
    // Takeshi selbst mit Flag: eigener Pilot (Schritt 3), hier noch wirkungslos.
    A.kontaktFlags({ "takeshis-castle": { stufe: 3 } });
    try {
      expect(JSON.stringify(A.spiele("takeshis-castle", 7))).toBe(takeshi);
    } finally {
      A.kontaktFlags({ "takeshis-castle": null });
    }
  }, 120_000);
});

describe("Flag an = deterministisch und wirksam", () => {
  it.each([[{ stufe: 1 }], [{ nur: [2] }], [{ nur: [3] }], [{ stufe: 3 }]])(
    "%j: zweimal gleich, Boxscore-Zeile vorhanden, Rennen bewegt sich ueber die Saaten",
    (flag) => {
      const aus = laeufe();
      const an1 = mitFlag(flag, laeufe);
      const an2 = mitFlag(flag, laeufe);
      expect(JSON.stringify(an2)).toBe(JSON.stringify(an1));
      for (const l of an1) for (const u of l.laeufer) expect(u.kontakt).toBeDefined();
      expect(summe(an1, "versuche") + summe(an1, "verzichtet")).toBeGreaterThan(0);
      const zeiten = (x: Lauf[]) => JSON.stringify(x.map((l) => l.laeufer.map((u) => u.zeit)));
      expect(zeiten(an1)).not.toBe(zeiten(aus));
    },
    120_000,
  );
});

describe("Stufe 1: Kosten des Versuchs", () => {
  it("Grundpreis je Versuch (0,26 s bei 82 %) und Mini-Stun je Fehlschlag (0,45 s bei 35 %) stehen exakt in der Zeitbuchung", () => {
    const an = mitFlag({ stufe: 1 }, laeufe);
    const versuche = summe(an, "versuche"), ministun = summe(an, "ministun");
    expect(versuche).toBeGreaterThan(5);
    expect(ministun).toBeGreaterThan(0);
    // Ohne Stufe 2 weicht niemand aus, ohne Stufe 3 gibt es weder Foul noch Haenger, und jeder
    // Fehlschlag ist ein Mini-Stun.
    expect(summe(an, "ausgewichen") + summe(an, "haenger") + summe(an, "fouls") + summe(an, "verzichtet")).toBe(0);
    expect(ministun).toBe(summe(an, "insLeere"));
    expect(summe(an, "treffer") + ministun).toBe(versuche);
    // bezahlt = was die Opfer verlieren + Grundpreis + Mini-Stun (Rundung je Laeufer auf 0,01 s).
    const erwartet = summe(an, "zeitZugefuegt") + versuche * 0.26 * 0.18 + ministun * 0.45 * 0.65;
    const laeuferZahl = an.reduce((s, l) => s + l.laeufer.length, 0);
    expect(Math.abs(summe(an, "zeitBezahlt") - erwartet)).toBeLessThan(0.006 * laeuferZahl);
  }, 120_000);

  it("Dosis 0 nimmt die Kosten heraus, Dosis 0,5 halbiert den Mini-Stun", () => {
    const null0 = mitFlag({ stufe: 1, dosis: 0 }, laeufe);
    expect(summe(null0, "ministun")).toBe(0);
    const halb = mitFlag({ stufe: 1, dosis: 0.5 }, laeufe);
    const erwartet = summe(halb, "zeitZugefuegt") + summe(halb, "versuche") * 0.13 * 0.18 + summe(halb, "ministun") * 0.225 * 0.65;
    const laeuferZahl = halb.reduce((s, l) => s + l.laeufer.length, 0);
    expect(Math.abs(summe(halb, "zeitBezahlt") - erwartet)).toBeLessThan(0.006 * laeuferZahl);
  }, 120_000);
});

describe("Stufe 2: Auswahlschwelle und Verteidiger-Wahl", () => {
  it("ohne Stufe 1 kein Mini-Stun; Ausweichen kommt vor", () => {
    const an = mitFlag({ nur: [2] }, laeufe);
    expect(summe(an, "ministun")).toBe(0);
    expect(summe(an, "ausgewichen")).toBeGreaterThan(0);
  }, 120_000);

  it("pMin wirkt: der wählerische Typ (beschuetzer, 0,60) verzichtet anteilig öfter als der Draufgänger (0,30)", () => {
    const anteil = (typ: string) => {
      const an = mitFlag({ nur: [2] }, laeufe, typ);
      const v = summe(an, "verzichtet");
      return v / Math.max(1, v + summe(an, "versuche"));
    };
    const draufgaenger = anteil("draufgaenger"), beschuetzer = anteil("beschuetzer");
    expect(beschuetzer).toBeGreaterThan(draufgaenger);
  }, 120_000);

  it("ausweichfreudiger Typ (schleicher, aw 90) weicht öfter aus als das Bollwerk (aw 15)", () => {
    const ausw = (typ: string) => summe(mitFlag({ nur: [2] }, laeufe, typ), "ausgewichen");
    expect(ausw("schleicher")).toBeGreaterThan(ausw("bollwerk"));
  }, 120_000);
});

describe("Stufe 3: Traits, Haerte, Foul, Haenger", () => {
  it("Foul und Haenger nur mit Stufe 3 und einzeln abschaltbar", () => {
    const s12 = mitFlag({ stufe: 2 }, laeufe);
    expect(summe(s12, "fouls") + summe(s12, "haenger")).toBe(0);
    const s3 = mitFlag({ stufe: 3 }, laeufe);
    expect(summe(s3, "haenger")).toBeGreaterThan(0);
    const ohne = mitFlag({ stufe: 3, foul: false, haenger: false }, laeufe);
    expect(summe(ohne, "fouls") + summe(ohne, "haenger")).toBe(0);
    // Ein Foul ist ein Treffer ohne Wirkung beim Opfer: die Zahl der Gefoulten passt.
    expect(summe(s3, "gefoult")).toBe(summe(s3, "fouls"));
  }, 120_000);
});
