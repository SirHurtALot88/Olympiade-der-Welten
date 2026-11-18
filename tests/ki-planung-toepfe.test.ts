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
