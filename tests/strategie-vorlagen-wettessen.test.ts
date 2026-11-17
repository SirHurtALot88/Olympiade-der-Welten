import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { baueMotorKontext, ladeMotorSkripte, simuliereDuelle } from "@/lib/battle/arena-node-motor.mjs";
import { buildArenaStrategieBeide, leseTeamStrategie } from "@/lib/foundation/battle-arena/arena-strategie-adapter";
import {
  istStrategieVorlagenAktiv,
  normalisiereStrategie,
  STRATEGIE_VORLAGEN_KATALOG,
  strategieVorlagenFuer,
} from "@/lib/lineups/strategie-vorlagen";

/**
 * STRATEGIE-VORLAGEN, PILOT WETTESSEN (17.11., docs/design/strategie-templates-16-11.md 6.1/6.2, 7 Schritt 1).
 *  - Flagge aus / neutral / unbekannte Kennung = identisch; ein- und wieder ausgeschaltet = identisch (Rueckweg).
 *  - Vorlage an = deterministisch, wirkt NUR auf Wettessen, aendert nur die Haltung (eine Stufe je Esser).
 *  - Umschlag (`strategieByDisciplineId`, Node-Runner-Pfad) und Messvorgabe liefern dasselbe Spiel.
 *  - Katalog in TS und Motor deckungsgleich; Adapter liest den Entwurf nur hinter der Flagge.
 * Laeuft ueber den Node-Motor (kein Chromium).
 */

type EsserDiag = { n: string; seite: number; haltung: string; quelle: string; vorlage?: string; kiHaltung?: string; kurve: number[]; NERVEN: number };
type Probe = { varianten?: Array<{ spiele: Array<{ buehne: { esser: EsserDiag[] } }> }>; spiele?: Array<{ buehne: { esser: EsserDiag[] } }> };
type Arena = {
  strategieVorlagen: (neu?: unknown) => { gesetzt: Record<string, unknown>; katalog: Record<string, Record<string, number>> };
  buehneHaltungTest: (neu?: unknown) => unknown;
  spiele: (d: string, s: number) => unknown;
  motoren: () => string[];
  disziplinProbe: (d: string, o: Record<string, unknown>) => Probe;
};

const MOCKUPS = path.resolve(process.cwd(), "public", "mockups");
const familie = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/generated/kaderfamilie-live-save.json"), "utf8"),
).varianten as Array<{ heim: unknown[]; gast: unknown[] }>;
const SAATEN = Array.from({ length: 8 }, (_, i) => 101 + i * 37);
const LEITER = ["gleichmaessig", "schlussspurt", "sprint"];
const schiebe = (h: string, r: number) => LEITER[Math.max(0, Math.min(2, LEITER.indexOf(h) + r))];

let kontext: ReturnType<typeof baueMotorKontext>;
let skripte: ReturnType<typeof ladeMotorSkripte>;
let A: Arena;

function mitVorlage<T>(vorgabe: unknown, f: () => T): T {
  A.strategieVorlagen(vorgabe);
  try {
    return f();
  } finally {
    A.strategieVorlagen("reset");
  }
}
const wettessen = () => SAATEN.map((s) => JSON.stringify(A.spiele("wettessen", s)));
const esserVon = (p: Probe) => (p.varianten ?? [p]).flatMap((v) => v.spiele ?? []).flatMap((s) => s.buehne.esser);

beforeAll(async () => {
  skripte = ladeMotorSkripte(MOCKUPS);
  kontext = baueMotorKontext();
  kontext.fenster.__olyNodeUebergabe = JSON.stringify({ heim: familie[0]!.heim, gast: familie[0]!.gast, aufstellung: {}, mutatoren: [] });
  vm.runInContext(
    "window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;",
    kontext.fenster,
  );
  skripte.rezepte.runInContext(kontext.fenster);
  skripte.engine.runInContext(kontext.fenster);
  for (let i = 0; i < 5000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  A = kontext.fenster.__arena as Arena;
}, 120_000);

afterAll(() => {
  kontext?.aufraeumen();
});

describe("Katalog", () => {
  it("TS-Katalog und Motor-Katalog tragen dieselben Kennungen, defensiv = −1, offensiv = +1", () => {
    const { katalog } = A.strategieVorlagen();
    expect(Object.keys(katalog).sort()).toEqual(Object.keys(STRATEGIE_VORLAGEN_KATALOG).sort());
    for (const [d, vorlagen] of Object.entries(STRATEGIE_VORLAGEN_KATALOG)) {
      expect(Object.keys(katalog[d]!).sort()).toEqual(vorlagen.map((v) => v.id).sort());
      for (const v of vorlagen) expect(katalog[d]![v.id]).toBe(v.stufe === "offensiv" ? 1 : -1);
    }
  });

  it("normalisiereStrategie nimmt nur Kennungen der eigenen Disziplin an", () => {
    expect(normalisiereStrategie("wettessen", "reinhauen")).toBe("reinhauen");
    expect(normalisiereStrategie("wettessen", "sprint")).toBeNull();
    expect(normalisiereStrategie("wettessen", "neutral")).toBeNull();
    expect(normalisiereStrategie("speed-schach", "reinhauen")).toBeNull();
    expect(normalisiereStrategie("wettessen", null)).toBeNull();
    expect(strategieVorlagenFuer("hockey")).toEqual([]);
  });
});

describe("Neutral = identisch (Flagge aus ist im Motor: kein Feld im Umschlag)", () => {
  it("[null,null], unbekannte Kennungen und Ein-/Ausschalten aendern kein Wettessen-Spiel", () => {
    const aus = wettessen();
    expect(aus.join("")).not.toContain("vorlage");
    mitVorlage({ wettessen: [null, null] }, () => expect(wettessen()).toEqual(aus));
    mitVorlage({ wettessen: ["sprint", "ellbogen-raus"] }, () => expect(wettessen()).toEqual(aus));
    mitVorlage({ "speed-schach": ["reinhauen", "reinhauen"] }, () => expect(wettessen()).toEqual(aus));
    // Rueckweg: einmal scharf gespielt, danach wieder exakt das alte Spiel.
    mitVorlage({ wettessen: ["reinhauen", "kontrolliert"] }, () => wettessen());
    expect(wettessen()).toEqual(aus);
  }, 120_000);

  it("Diagnose ohne Vorlage traegt keinen vorlage-Schluessel und Quelle 'ki'", () => {
    const esser = esserVon(A.disziplinProbe("wettessen", { n: 2, buehneDiag: true }));
    expect(esser.length).toBeGreaterThan(0);
    for (const e of esser) {
      expect(e).not.toHaveProperty("vorlage");
      expect(e.quelle).toBe("ki");
    }
  }, 120_000);
});

describe("Vorlage an", () => {
  it("deterministisch und wirksam: dieselbe Vorlage liefert zweimal dasselbe Spiel, anders als neutral", () => {
    const aus = wettessen();
    for (const v of ["reinhauen", "kontrolliert"]) {
      const a = mitVorlage({ wettessen: [v, v] }, wettessen);
      const b = mitVorlage({ wettessen: [v, v] }, wettessen);
      expect(a).toEqual(b);
      expect(a.some((x, i) => x !== aus[i])).toBe(true);
    }
  }, 120_000);

  it("verschiebt die KI-Haltung jedes Essers der eigenen Seite um genau eine Stufe, die andere Seite bleibt KI", () => {
    for (const [v, r] of [["reinhauen", 1], ["kontrolliert", -1]] as const) {
      const esser = mitVorlage({ wettessen: [v, null] }, () => esserVon(A.disziplinProbe("wettessen", { n: 3, buehneDiag: true })));
      const heim = esser.filter((e) => e.seite === 0);
      const gast = esser.filter((e) => e.seite === 1);
      expect(heim.length).toBeGreaterThan(0);
      for (const e of heim) {
        expect(e.vorlage).toBe(v);
        expect(e.quelle).toBe("vorlage");
        expect(e.haltung).toBe(schiebe(e.kiHaltung!, r));
      }
      for (const e of gast) {
        expect(e).not.toHaveProperty("vorlage");
        expect(e.quelle).toBe("ki");
      }
    }
  }, 120_000);

  it("Messvorgabe der Haltung (buehneHaltungTest) schlaegt die Team-Vorlage", () => {
    A.buehneHaltungTest({ 0: "gleichmaessig", 1: "gleichmaessig" });
    try {
      const ohne = wettessen();
      const mit = mitVorlage({ wettessen: ["reinhauen", "reinhauen"] }, wettessen);
      expect(mit).toEqual(ohne);
    } finally {
      A.buehneHaltungTest({ 0: null, 1: null });
    }
  }, 120_000);

  it("Verhalten: Reinhauen isst frueher (Bissanteil Minute 1-3 hoeher, Mauer frueher) als neutral", () => {
    const zaehle = (esser: EsserDiag[]) => {
      let frueh = 0, ges = 0;
      for (const e of esser) {
        frueh += e.kurve.slice(0, 3).reduce((a, b) => a + b, 0);
        ges += e.kurve.reduce((a, b) => a + b, 0);
      }
      return frueh / ges;
    };
    const probe = () => esserVon(A.disziplinProbe("wettessen", { n: 6, buehneDiag: true }));
    const neutral = zaehle(probe());
    const rein = mitVorlage({ wettessen: ["reinhauen", "reinhauen"] }, () => zaehle(probe()));
    expect(rein).toBeGreaterThan(neutral);
  }, 120_000);

  it("wirkt nur auf Wettessen: alle anderen Disziplinen bleiben unberuehrt, auch mit Vorlage fuer beide Seiten", () => {
    const andere = A.motoren().filter((d) => d !== "wettessen");
    expect(andere.length).toBeGreaterThanOrEqual(19);
    // Manche Ergebnisse tragen Mehrfachverweise -- dieselbe Serialisierung wie
    // scripts/pruefe-wertung-fingerabdruck.mjs (`sicher`).
    const sicher = (x: unknown) => {
      const auf = new WeakSet<object>();
      return JSON.stringify(x, (_k, w: unknown) => {
        if (w && typeof w === "object") {
          if (auf.has(w)) return "[verweis]";
          auf.add(w);
        }
        return w;
      });
    };
    const vorher = andere.map((d) => sicher(A.spiele(d, 7)));
    const nachher = mitVorlage({ wettessen: ["reinhauen", "kontrolliert"] }, () => andere.map((d) => sicher(A.spiele(d, 7))));
    expect(nachher).toEqual(vorher);
  }, 300_000);
});

describe("Umschlag (Node-Runner-Pfad) = Messvorgabe", () => {
  const auftrag = (strategie?: Record<string, [string | null, string | null]>) => ({
    art: "duelle",
    disziplin: "wettessen",
    chassis: "buehneAuftritt" as const,
    mutatoren: [],
    fixtures: SAATEN.slice(0, 3).map((seed) => ({
      heim: familie[1]!.heim,
      gast: familie[1]!.gast,
      aufstellung: {},
      seed,
      kulisseByDisciplineId: {},
      ...(strategie ? { strategieByDisciplineId: strategie } : {}),
    })),
  });

  it("ohne Feld = [null,null] = neutral; mit Vorlage anders und deterministisch", async () => {
    const ohne = JSON.stringify(await simuliereDuelle(skripte, auftrag()));
    const leer = JSON.stringify(await simuliereDuelle(skripte, auftrag({ wettessen: [null, null] })));
    const fremd = JSON.stringify(await simuliereDuelle(skripte, auftrag({ wettessen: ["sprint", "xyz"] })));
    expect(leer).toBe(ohne);
    expect(fremd).toBe(ohne);
    const mit = JSON.stringify(await simuliereDuelle(skripte, auftrag({ wettessen: ["reinhauen", null] })));
    const mit2 = JSON.stringify(await simuliereDuelle(skripte, auftrag({ wettessen: ["reinhauen", null] })));
    expect(mit).toBe(mit2);
    expect(mit).not.toBe(ohne);
  }, 300_000);
});

describe("Adapter Entwurf -> Umschlag (Flagge OLY_STRATEGIE_VORLAGEN)", () => {
  const altServer = process.env.OLY_STRATEGIE_VORLAGEN;
  const altClient = process.env.NEXT_PUBLIC_OLY_STRATEGIE_VORLAGEN;
  afterEach(() => {
    if (altServer === undefined) delete process.env.OLY_STRATEGIE_VORLAGEN;
    else process.env.OLY_STRATEGIE_VORLAGEN = altServer;
    if (altClient === undefined) delete process.env.NEXT_PUBLIC_OLY_STRATEGIE_VORLAGEN;
    else process.env.NEXT_PUBLIC_OLY_STRATEGIE_VORLAGEN = altClient;
  });
  const spielstand = (heimStrategie: unknown, gastModifiers: unknown = { d1: {}, d2: {} }) =>
    ({
      seasonState: {
        lineupDrafts: [
          {
            teamId: "heim",
            matchdayId: "md-1",
            entries: [{ disciplineId: "wettessen", disciplineSide: "d2", slotIndex: 0, playerId: "p1", activePlayerId: null }],
            modifiers: { d1: { intensity: "normal" }, d2: { intensity: "normal", strategie: heimStrategie } },
          },
          { teamId: "gast", matchdayId: "md-1", entries: [], modifiers: gastModifiers },
        ],
        disciplineSchedule: [
          { matchdayId: "md-1", discipline1: { disciplineId: "tennis" }, discipline2: { disciplineId: "wettessen" } },
        ],
      },
    }) as unknown as GameState;

  it("Flagge aus (Standard): nie ein Umschlag-Feld, auch wenn der Entwurf eine Vorlage traegt", () => {
    delete process.env.OLY_STRATEGIE_VORLAGEN;
    delete process.env.NEXT_PUBLIC_OLY_STRATEGIE_VORLAGEN;
    expect(istStrategieVorlagenAktiv()).toBe(false);
    expect(buildArenaStrategieBeide(spielstand("reinhauen"), "heim", "gast", "md-1", ["wettessen"])).toBeNull();
  });

  it("Flagge an: Heim aus den Eintraegen, Gast ueber den Spielplan; neutral/fremd -> kein Feld", () => {
    process.env.OLY_STRATEGIE_VORLAGEN = "1";
    expect(buildArenaStrategieBeide(spielstand("reinhauen"), "heim", "gast", "md-1", ["wettessen"])).toEqual({
      wettessen: ["reinhauen", null],
    });
    expect(
      buildArenaStrategieBeide(spielstand(null, { d1: {}, d2: { strategie: "kontrolliert" } }), "heim", "gast", "md-1", ["wettessen"]),
    ).toEqual({ wettessen: [null, "kontrolliert"] });
    expect(buildArenaStrategieBeide(spielstand(undefined), "heim", "gast", "md-1", ["wettessen"])).toBeNull();
    expect(buildArenaStrategieBeide(spielstand("ellbogen-raus"), "heim", "gast", "md-1", ["wettessen"])).toBeNull();
    // Disziplin ohne Katalogeintrag: neutral, auch wenn auf ihrer Seite etwas steht.
    expect(leseTeamStrategie(spielstand("reinhauen"), "heim", "md-1", "tennis")).toBeNull();
    expect(leseTeamStrategie(spielstand("reinhauen"), "heim", "md-2", "wettessen")).toBeNull();
  });
});
