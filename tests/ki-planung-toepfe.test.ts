/**
 * KI-Planung mit Toepfen (Finanzkonzept V2, Chris 18.11.): eine Zahl fuer Planung UND Sperre, erst die Pflichtplaetze
 * (Kader 8) reservieren, Pflichtkader nie gesperrt, Leiter statt Stillstand; Ruecklage ab Saison 2 nach Gehaltskosten.
 */
import { afterEach, describe, expect, it } from "vitest";

import { buildOrganicSquadPlan, type OrganicSquadPlanInput } from "@/lib/ai/organic-squad/draft-builder";
import { type CoreAxis, type OrganicDiscipline, type OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import type { GameState } from "@/lib/data/olyDataTypes";
import { berechneKiRuecklage, ruecklagenQuote } from "@/lib/finance/ki-ruecklage";
import {
  kaderpflichtZuschlag,
  kaufRahmen,
  pruefeKaufGegenVorstandFreigabe,
  VORSTAND_PFLICHT_KADER,
} from "@/lib/finance/vorstand-budgetfreigabe";

afterEach(() => {
  delete process.env.OLY_RUECKLAGE_GEHALT_S2;
});

describe("Ruecklage: Saison 1 Startbudget, ab Saison 2 Gehaltskosten", () => {
  it("Saison 1 bleibt bit-gleich (Quote x Budget, Boden 0,35 x Zielgehalt)", () => {
    const alt = berechneKiRuecklage({ finances: 5, budget: 300, zielgehalt: 40 });
    const s1 = berechneKiRuecklage({ finances: 5, budget: 300, zielgehalt: 40, saison: 1 });
    expect(s1).toEqual(alt);
    expect(s1.bindend).toBe("quote");
  });

  it("Saison 2 = Quote x Zielgehalt, unabhaengig von Kasse und Kaderwert", () => {
    for (const [fw, gehalt] of [[1, 40], [1, 80], [5, 60], [10, 40], [10, 80]] as const) {
      const klein = berechneKiRuecklage({ finances: fw, budget: 100, zielgehalt: gehalt, saison: 2 });
      const gross = berechneKiRuecklage({ finances: fw, budget: 900, zielgehalt: gehalt, saison: 2 });
      expect(klein.ruecklage).toBeCloseTo(ruecklagenQuote(fw) * gehalt, 2);
      expect(gross.ruecklage).toBe(klein.ruecklage);
      expect(klein.bindend).toBe("gehaltskosten");
    }
  });

  it("Beispieltabelle Finanzwert x Gehalt (Saison 2) und Vergleich mit dem alten Boden 0,35 x Gehalt", () => {
    const zeilen: string[] = [];
    for (const fw of [1, 5, 10]) {
      for (const gehalt of [40, 60, 80]) {
        const neu = berechneKiRuecklage({ finances: fw, budget: 0, zielgehalt: gehalt, saison: 2 }).ruecklage;
        zeilen.push(`FW ${fw} / Gehalt ${gehalt}: ${neu} (alter Boden ${0.35 * gehalt})`);
        expect(neu).toBeLessThan(0.35 * gehalt + 1e-9);
      }
    }
    expect(zeilen).toHaveLength(9);
  });

  it("Schalter OLY_RUECKLAGE_GEHALT_S2=0 stellt die alte Regel her (A/B-Messung)", () => {
    process.env.OLY_RUECKLAGE_GEHALT_S2 = "0";
    const r = berechneKiRuecklage({ finances: 5, budget: 300, zielgehalt: 40, saison: 2 });
    expect(r.bindend).toBe("quote");
  });
});

function spielstand(): GameState {
  const rosters = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, teamId: "A", playerId: `pA${i}`, salary: 8 }));
  const players = rosters.map((r) => ({ id: r.playerId, marketValue: 10 }));
  return {
    season: { id: "season-2", currentMatchday: 1, matchdayIds: [], totalMatchdays: 20 },
    gamePhase: "season_active",
    matchdayState: { status: "open" },
    teams: [{ teamId: "A", name: "A", cash: 60 }],
    teamIdentities: [{ teamId: "A", finances: 5, ambition: 5, playerOpt: 11, playerMin: 5 }],
    rosters,
    players,
    transferHistory: [],
    seasonState: { boardConfidence: { A: { teamId: "A", value: 3, pressure: 5, warnings: [] } }, facilityEvents: [] },
  } as unknown as GameState;
}

describe("Pflichtkader: nie gesperrt, auch bei kleinem Identity-Minimum", () => {
  it("unter 8 Spielern geht jeder Kauf durch (Identity-Minimum 5), ab 8 sperrt der Topf", () => {
    const gs = spielstand();
    const rahmen = kaufRahmen(gs, "A");
    expect(rahmen.gedeckelt).toBe(true);
    const zuTeuer = { fee: rahmen.abloeseFrei + 50, salary: 1, playerMin: 5 };
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { ...zuTeuer, rosterBefore: VORSTAND_PFLICHT_KADER - 1 }).ok).toBe(true);
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { ...zuTeuer, rosterBefore: VORSTAND_PFLICHT_KADER }).ok).toBe(false);
  });

  it("die Sperre rechnet mit derselben Zahl wie der Planer (kaufRahmen)", () => {
    const gs = spielstand();
    const rahmen = kaufRahmen(gs, "A");
    const grenze = { salary: 0, rosterBefore: 9, playerMin: 8 };
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { ...grenze, fee: rahmen.abloeseFrei }).ok).toBe(true);
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { ...grenze, fee: rahmen.abloeseFrei + 0.5 }).ok).toBe(false);
  });
});

describe("Draft-Builder mit Rahmen: jeder geplante Kauf besteht die Sperre (Eigenschaftstest)", () => {
  const DISCIPLINES: OrganicDiscipline[] = [
    { id: "tdm", category: "power" },
    { id: "tennis", category: "mental" },
  ];
  const AXIS: Record<CoreAxis, number> = { pow: 0.4, spe: 0.2, men: 0.2, soc: 0.2 };
  let seed = 1;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const spieler = (id: string): OrganicPlayerView => {
    const wert = 4 + Math.floor(rnd() * 46);
    return {
      playerId: id, pow: 55 + rnd() * 40, spe: 55 + rnd() * 40, men: 55 + rnd() * 40, soc: 55 + rnd() * 40,
      disciplineRatings: { tdm: 55 + rnd() * 40, tennis: 55 + rnd() * 40 }, marketValue: wert, salary: Math.max(1, Math.round(wert / 4)),
    };
  };

  it("Pflichtkader erreicht, Wunschkaeufe nur im Rahmen, ueber 8 nie ueber dem Topf", () => {
    for (let lauf = 0; lauf < 60; lauf += 1) {
      seed = 1000 + lauf;
      const vorhanden = Math.floor(rnd() * 11);
      const start = Array.from({ length: vorhanden }, (_, i) => spieler(`s${i}`));
      const kandidaten = Array.from({ length: 30 }, (_, i) => spieler(`c${i}`));
      const feeCap = 10 + rnd() * 120;
      const salaryCap = 5 + rnd() * 40;
      const input: OrganicSquadPlanInput = {
        startingSquad: start,
        candidates: kandidaten,
        identityAxisWeights: AXIS,
        disciplines: DISCIPLINES,
        economy: {
          cash: 400, cashBuffer: 5, salaryTotal: start.reduce((x, p) => x + p.salary, 0), boardRisk: 0.3, expectedPrize: 0,
          sponsorIncome: 0, facilityNet: 0, netTransfer: 0, feeCap, salaryCap,
          weights: deriveUtilityWeights({ ambition: 60, finances: 50, boardConfidence: 50, harmony: 50, playerOpt: 11 }, {}),
        },
      };
      const plan = buildOrganicSquadPlan(input);
      // 1) Pflichtkader: bei 400 C Kasse nie unter 8 (kein Stillstand wegen der Finanzregeln).
      expect(start.length + plan.decisions.length).toBeGreaterThanOrEqual(VORSTAND_PFLICHT_KADER);
      // 2) Jeder Kauf ab Kader 8 besteht die Sperre mit den laufenden Summen aller bisherigen Kaeufe.
      let fee = 0;
      let sal = 0;
      let kader = start.length;
      for (const d of plan.decisions) {
        const p = kandidaten.find((c) => c.playerId === d.playerId)!;
        if (kader >= VORSTAND_PFLICHT_KADER) {
          expect(fee + p.marketValue).toBeLessThanOrEqual(feeCap + 1e-9);
          expect(sal + p.salary).toBeLessThanOrEqual(salaryCap + 1e-9);
        }
        fee += p.marketValue;
        sal += p.salary;
        kader += 1;
      }
    }
  });
});

describe("Kaderpflicht-Freigabe (Chris 18.11.): Geld da, nicht freigegeben, Kader unter Minimum oder Opt", () => {
  function team(kader: number, cash: number, opts: { playerMin?: number; playerOpt?: number; vertrauen?: number } = {}): GameState {
    const rosters = Array.from({ length: kader }, (_, i) => ({ id: `r${i}`, teamId: "A", playerId: `pA${i}`, salary: 4 }));
    const players: Array<{ id: string; marketValue: number; salaryDemand?: number }> = rosters.map((r) => ({ id: r.playerId, marketValue: 15 }));
    for (let i = 0; i < 20; i += 1) players.push({ id: `fa${i}`, marketValue: 20, salaryDemand: 5 });
    return {
      season: { id: "season-2", currentMatchday: 1, matchdayIds: [], totalMatchdays: 20 },
      gamePhase: "season_active",
      matchdayState: { status: "open" },
      teams: [{ teamId: "A", name: "A", cash }],
      teamIdentities: [{ teamId: "A", finances: 10, ambition: 5, playerMin: opts.playerMin ?? 9, playerOpt: opts.playerOpt ?? 11 }],
      rosters,
      players,
      transferHistory: [],
      seasonState: { boardConfidence: { A: { teamId: "A", value: opts.vertrauen ?? 8, pressure: 5, warnings: [] } }, facilityEvents: [] },
    } as unknown as GameState;
  }

  it("6 Spieler, 87 C Kasse, hoher Finanzwert: der Rahmen reicht fuer mindestens 4 sinnvolle Kaeufe (Platzpreis 20 C, Gehalt 5 C)", () => {
    const gs = team(6, 87, { playerMin: 10, playerOpt: 12 });
    const rahmen = kaufRahmen(gs, "A");
    expect(rahmen.stand.kaderpflicht.platzAbloese).toBe(20);
    let fee = 0;
    let sal = 0;
    for (let k = 0; k < 4; k += 1) {
      const g = rahmen.grenzeFuer(6 + k, fee, sal);
      expect(20).toBeLessThanOrEqual(g.fee + 1e-9);
      expect(5).toBeLessThanOrEqual(g.salary + 1e-9);
      fee += 20;
      sal += 5;
    }
    expect(rahmen.stand.kaderpflicht.text).toContain("Kaderpflicht: Vorstand gibt");
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: 20, salary: 5, rosterBefore: 6, playerMin: 10 }).ok).toBe(true);
  });

  it("auch die Gehaltsseite wird freigegeben: Kader am Minimum, Gehaltstopf leer, Weg Richtung Opt (Befund Z-H aus #1634)", () => {
    const basis = { kaderMin: 9, kaderOpt: 12, platzAbloese: 20, platzGehalt: 5, notruecklage: 15, cash: 87 };
    // Am Minimum: Gehalt der Plaetze bis Opt (3 x 5 C) unabhaengig von Kasse und Gehaltstopf
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 9 }).gehalt).toBe(15);
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 9, cash: 5 }).gehalt).toBe(15);
    // Unter dem Minimum: Gehalt der fehlenden Plaetze bis Minimum
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 7 }).gehalt).toBe(10);
    // Die Grenze fuer den naechsten Kauf nimmt das Groessere aus Rahmen nach Quote und Kaderpflicht
    const rahmen = kaufRahmen(team(9, 87, { playerMin: 9, playerOpt: 12 }), "A");
    expect(rahmen.grenzeFuer(9, 0, 0).salary).toBeGreaterThanOrEqual(15 - 1e-9);
    expect(rahmen.grenzeFuer(9, 0, 1000).salary).toBeGreaterThanOrEqual(15 - 1e-9);
  });

  it("Team bei Opt: keine Wirkung", () => {
    const rahmen = kaufRahmen(team(11, 87), "A");
    expect(rahmen.stand.kaderpflicht.aktiv).toBe(false);
    expect(rahmen.stand.kaderpflicht.text).toBeNull();
    expect(rahmen.stand.kaderpflicht.zuschlagAbloese).toBe(0);
  });

  it("Kasse reicht nicht: die Freigabe ist nie groesser als die Kasse (kein Notkauf, erst die bestehende Kredit-Leiter)", () => {
    const rahmen = kaufRahmen(team(6, 30), "A");
    expect(rahmen.stand.investition.frei).toBeLessThanOrEqual(30 + 1e-9);
    expect(rahmen.grenzeFuer(6, 0, 0).fee).toBeLessThanOrEqual(30 + 1e-9);
  });

  it("zwischen Minimum und Opt wirkt sie nur mit Geld ueber der Notruecklage; unter dem Minimum aus der ganzen Kasse", () => {
    const basis = { kaderMin: 9, kaderOpt: 12, platzAbloese: 20, platzGehalt: 5, notruecklage: 15 };
    // Kader 9 (= Minimum), Opt 12: 3 Plaetze x 20 = 60, aber nur Kasse ueber der Notruecklage zaehlt
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 9, cash: 87 }).abloese).toBe(60);
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 9, cash: 30 }).abloese).toBe(15);
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 9, cash: 12 }).abloese).toBe(0);
    // Kader 6 (unter dem Minimum): 3 x 20 = 60 aus der GANZEN Kasse, auch unter der Notruecklage
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 6, cash: 87 }).abloese).toBe(60);
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 6, cash: 12 }).abloese).toBe(12);
    expect(kaderpflichtZuschlag({ ...basis, kaderIst: 12, cash: 87 })).toEqual({ abloese: 0, gehalt: 0 });
  });

  it("Saison 1: keine Wirkung (alles frei)", () => {
    const gs = team(6, 87);
    gs.season = { ...gs.season, id: "season-1" };
    const rahmen = kaufRahmen(gs, "A");
    expect(rahmen.gedeckelt).toBe(false);
    expect(rahmen.stand.kaderpflicht.aktiv).toBe(false);
  });
});
