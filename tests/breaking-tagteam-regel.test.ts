import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { baueMotorKontext, ladeMotorSkripte } from "@/lib/battle/arena-node-motor.mjs";
import { BREAKING_WAFFEN, normalisiereBreakingWaffen } from "@/lib/lineups/breaking-waffen";

/**
 * BREAKING ALS TAG-TEAM-1v1 (22.11., docs/design/breaking-tagteam-22-11.md).
 *
 *  1. RUECKWEG BIT-IDENTISCH: `breakingFormat("gauntlet")` und der gebuchte Spieltag-Umschlag `formatByDisciplineId.breaking =
 *     "gauntlet"` rechnen dasselbe wie der Motor vor der Aenderung (Fingerabdruck `spiele breaking/gauntlet`, die drei alten
 *     `spiele breaking`-Zeilen ed316124be88/0a689ade305e/c4bf3bd3603f), und beide unterscheiden sich vom Tag-Team.
 *  2. REGELN: jeder kommt dran (keiner zweimal, bevor alle lebenden dran waren), Standzeit, genau EINE Waffe je Gang und Spieler,
 *     der Kampf endet durch Aufgabe, ein vom Manager gesetzter Plan schlaegt die KI-Wahl.
 *  3. WAFFEN: gleiches Schadensbudget je Phase; die Liste im Motor und in lib/lineups/breaking-waffen.ts ist deckungsgleich.
 */

type Eintrag = {
  art: "anschlag" | "wechsel";
  gang: number; phase?: number; umlauf?: number;
  peiniger?: string; peinigerSide?: number; ertragender?: string; waffe?: string; quelle?: string; schaden?: number; haelt?: boolean; hpNach?: number; gut?: number;
  team?: number; raus?: string; rein?: string; grund?: string;
};
type Arena = {
  spiele: (d: string, saat: number) => unknown;
  breakingFormat: (r: unknown) => unknown;
  breakingEnde: () => { art: string; lebende: number[]; gaenge: number; anschlaege: number } | null;
  breakingProtokoll: () => Eintrag[];
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten as Array<{ heim: Array<{ n?: string; name?: string }>; gast: Array<{ n?: string; name?: string }> }>;

function oeffne(kader: boolean, umschlag?: Record<string, unknown>, aufstellung: Record<string, unknown> = {}) {
  const skripte = ladeMotorSkripte(MOCKUPS);
  const kontext = baueMotorKontext();
  if (kader) {
    kontext.fenster.__olyNodeUebergabe = JSON.stringify({
      heim: familie[0]!.heim, gast: familie[0]!.gast, aufstellung, mutatoren: [],
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
  gebuchtAlt = oeffne(true, { breaking: "gauntlet" });
  A0 = await warteAuf(ohneKader);
  A = await warteAuf(standard);
  AAlt = await warteAuf(gebuchtAlt);
}, 120_000);

afterAll(() => {
  ohneKader?.aufraeumen();
  standard?.aufraeumen();
  gebuchtAlt?.aufraeumen();
});

const json = (x: unknown) => {
  const auf = new WeakSet<object>();
  return JSON.stringify(x, (_k, w) => {
    if (w && typeof w === "object") { if (auf.has(w)) return "[verweis]"; auf.add(w); }
    return w;
  });
};
const hash = (x: unknown) => createHash("sha256").update(json(x)).digest("hex").slice(0, 12);

describe("Breaking-Tag-Team: Rueckweg und Umschlag", () => {
  it("der Gauntlet trifft bit-genau die Fingerabdruck-Werte von vor dem 22.11.", () => {
    const erwartet: Record<number, string> = { 1: "ed316124be88", 7: "0a689ade305e", 42: "c4bf3bd3603f" };
    A0.breakingFormat("gauntlet");
    try {
      for (const saat of [1, 7, 42]) expect(hash(A0.spiele("breaking", saat)), `Saat ${saat}`).toBe(erwartet[saat]);
    } finally {
      A0.breakingFormat(null);
    }
    // Das Tag-Team (Standard) rechnet anders.
    for (const saat of [1, 7, 42]) expect(hash(A0.spiele("breaking", saat)), `Saat ${saat}`).not.toBe(erwartet[saat]);
  });

  it("der Umschlag 'gauntlet' rechnet wie der Messhebel (gezeigt = gebucht) und anders als das Tag-Team", () => {
    const neu = json(A.spiele("breaking", 7));
    const umschlagAlt = json(AAlt.spiele("breaking", 7));
    A.breakingFormat("gauntlet");
    const hebelAlt = json(A.spiele("breaking", 7));
    A.breakingFormat(null);
    expect(umschlagAlt).toBe(hebelAlt);
    expect(neu).not.toBe(hebelAlt);
    expect(json(A.spiele("breaking", 7))).toBe(neu);
  });
});

function kaempfe(arena: Arena, saaten: number[]) {
  return saaten.map((saat) => {
    arena.spiele("breaking", saat);
    return { ende: arena.breakingEnde()!, protokoll: arena.breakingProtokoll() };
  });
}

describe("Breaking-Tag-Team: Regeln", () => {
  const saaten = [3, 11, 29, 47, 101, 977];

  it("jeder kommt dran: keiner geht ein zweites Mal rein, bevor alle lebenden Teamkameraden dran waren", () => {
    for (const k of kaempfe(A, saaten)) {
      const anschlaege = k.protokoll.filter((e) => e.art === "anschlag");
      // Teams aus dem Protokoll: der Peiniger gehoert zu peinigerSide, der Ertragende zur anderen Seite.
      const mitglieder: Array<Set<string>> = [new Set(), new Set()];
      for (const e of anschlaege) { mitglieder[e.peinigerSide!]!.add(e.peiniger!); mitglieder[1 - e.peinigerSide!]!.add(e.ertragender!); }
      expect(mitglieder[0]!.size).toBe(6);
      expect(mitglieder[1]!.size).toBe(6);
      const einsaetze = new Map<string, number>();
      einsaetze.set(anschlaege[0]!.peiniger!, 1);
      einsaetze.set(anschlaege[0]!.ertragender!, 1);
      const gebrochen = new Set<string>();
      let zweiteEinsaetze = 0;
      for (const e of k.protokoll) {
        if (e.art === "anschlag") { if ((e.hpNach ?? 1) <= 0) gebrochen.add(e.ertragender!); continue; }
        const bisher = einsaetze.get(e.rein!) ?? 0;
        for (const andere of mitglieder[e.team!]!) {
          if (andere === e.rein || gebrochen.has(andere)) continue;
          expect(bisher, `${e.rein} kommt zum ${bisher + 1}. Mal rein, ${andere} (lebt) war erst ${einsaetze.get(andere) ?? 0}x dran`).toBeLessThanOrEqual(einsaetze.get(andere) ?? 0);
        }
        if (bisher >= 1) zweiteEinsaetze += 1;
        einsaetze.set(e.rein!, bisher + 1);
      }
      // Jeder der zwoelf stand mindestens einmal im Ring, und der Kampf reicht in den zweiten Umlauf.
      expect(mitglieder[0]!.size + mitglieder[1]!.size).toBe(12);
      expect(zweiteEinsaetze).toBeGreaterThan(0);
    }
  });

  it("genau eine Waffe je Gang und Spieler, und jede Waffe ist gueltig", () => {
    const gueltig = new Set(BREAKING_WAFFEN.map((w) => w.id as string));
    for (const k of kaempfe(A, saaten)) {
      const jeGang = new Map<string, Set<string>>();
      for (const e of k.protokoll.filter((x) => x.art === "anschlag")) {
        expect(gueltig.has(e.waffe!)).toBe(true);
        const schluessel = `${e.gang}|${e.peiniger}`;
        (jeGang.get(schluessel) ?? jeGang.set(schluessel, new Set()).get(schluessel)!).add(e.waffe!);
      }
      for (const [schluessel, waffen] of jeGang) expect(waffen.size, schluessel).toBe(1);
    }
  });

  it("der Kampf endet durch Aufgabe: ein Team ist komplett gebrochen", () => {
    for (const k of kaempfe(A, saaten)) {
      expect(k.ende.art).toBe("aufgabe");
      expect(Math.min(...k.ende.lebende)).toBe(0);
      expect(k.ende.anschlaege).toBeLessThanOrEqual(330);
    }
  });

  it("Standzeit: niemand steht mehr als zwei Gaenge am Stueck im Ring (ausser dem Letzten seines Teams)", () => {
    for (const k of kaempfe(A, saaten)) {
      const gaenge = [...new Set(k.protokoll.filter((e) => e.art === "anschlag").map((e) => e.gang))];
      const serie = new Map<string, number>();
      for (const g of gaenge) {
        const imRing = new Set<string>();
        for (const e of k.protokoll.filter((x) => x.art === "anschlag" && x.gang === g)) { imRing.add(e.peiniger!); imRing.add(e.ertragender!); }
        for (const n of [...serie.keys()]) if (!imRing.has(n)) serie.delete(n);
        for (const n of imRing) serie.set(n, (serie.get(n) ?? 0) + 1);
        for (const [n, c] of serie) expect(c, `${n} in Gang ${g}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("deterministisch: dieselbe Saat gibt dasselbe Protokoll; ein anderer Kader eine andere Waffenwahl der KI", () => {
    const a = kaempfe(A, [5])[0]!;
    const b = kaempfe(A, [5])[0]!;
    expect(json(a.protokoll)).toBe(json(b.protokoll));
    expect(a.protokoll.some((e) => e.art === "anschlag" && e.quelle === "ki")).toBe(true);
  });

  it("die KI waehlt die Waffe, deren Kanal beim Gegner am schwaechsten ist (Konterwahl)", () => {
    const k = kaempfe(A0, [13])[0]!;
    const waffenVerteilung = new Set(k.protokoll.filter((e) => e.art === "anschlag").map((e) => e.waffe));
    expect(waffenVerteilung.size).toBeGreaterThanOrEqual(2);
  });
});

describe("Breaking-Tag-Team: Waffenplan des Managers", () => {
  it("ein gesetzter Plan schlaegt die KI-Wahl (je eigenem Gang), nicht Gesetztes fuellt die KI", async () => {
    const namen = familie[0]!.heim.map((p) => String(p.n ?? p.name));
    const aufstellung: Record<string, unknown> = {};
    // Alle sechs Heim-Spieler gesetzt, der erste mit Plan "hieb, wucht", alle anderen ohne Plan.
    namen.slice(0, 6).forEach((n, i) => { aufstellung[n] = { d: "breaking", slot: `s${i + 1}`, ...(i === 0 ? { waffen: ["hieb", "wucht"] } : {}) }; });
    const k = oeffne(true, undefined, aufstellung);
    try {
      const arena = await warteAuf(k);
      arena.spiele("breaking", 21);
      const p = arena.breakingProtokoll().filter((e) => e.art === "anschlag" && e.peiniger === namen[0]);
      expect(p.length).toBeGreaterThan(0);
      const jeGang = new Map<number, string>();
      for (const e of p) jeGang.set(e.gang, e.waffe!);
      const folge = [...jeGang.entries()].sort((x, y) => x[0] - y[0]).map(([, w]) => w);
      // Eigener Gang 1 = hieb, eigener Gang 2 = wucht, dann wiederholt sich der Plan.
      expect(folge[0]).toBe("hieb");
      if (folge.length > 1) expect(folge[1]).toBe("wucht");
      if (folge.length > 2) expect(folge[2]).toBe("hieb");
      expect(p.every((e) => e.quelle === "plan")).toBe(true);
    } finally {
      k.aufraeumen();
    }
  }, 60_000);

  it("die Normalisierung nimmt nur gueltige Kennungen an", () => {
    expect(normalisiereBreakingWaffen(["hieb", "unsinn", null, "wucht", "zermuerbung", "hieb", "wucht"])).toEqual(["hieb", null, null, "wucht", "zermuerbung", "hieb"]);
    expect(normalisiereBreakingWaffen([null, "x"])).toBeNull();
    expect(normalisiereBreakingWaffen("hieb")).toBeNull();
    expect(normalisiereBreakingWaffen(undefined)).toBeNull();
  });
});

describe("Breaking-Tag-Team: Waffen", () => {
  it("Motor und Katalog nennen dieselben Waffen; gleiches Schadensbudget je Phase (je rund 70 bei 50 % Halten)", () => {
    const quelle = readFileSync(path.join(MOCKUPS, "battle-mode.engine.js"), "utf8");
    const block = quelle.slice(quelle.indexOf("const TT_WAFFEN_KONSTANTE"), quelle.indexOf("const TT_WAFFEN_IDS"));
    const budget: number[] = [];
    for (const w of BREAKING_WAFFEN) {
      const m = new RegExp(`${w.id}:\\s*\\{[^}]*n:(\\d+),\\s*halt:(\\d+(?:\\.\\d+)?),\\s*bricht:(\\d+(?:\\.\\d+)?)[^}]*kanal:"(\\w+)"`).exec(block);
      expect(m, w.id).not.toBeNull();
      expect(m![4]).toBe(w.kanal);
      budget.push(Number(m![1]) * (Number(m![2]) + Number(m![3])) / 2);
    }
    expect(Math.max(...budget) - Math.min(...budget)).toBeLessThan(5);
    expect(Math.min(...budget)).toBeGreaterThan(60);
    expect(Math.max(...budget)).toBeLessThan(80);
  });
});
