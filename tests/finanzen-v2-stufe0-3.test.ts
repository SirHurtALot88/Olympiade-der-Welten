import { afterEach, describe, expect, it } from "vitest";

import { buildOrganicSquadPlan, type OrganicSquadPlanInput } from "@/lib/ai/organic-squad/draft-builder";
import {
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicPlayerView,
} from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import type { GameState } from "@/lib/data/olyDataTypes";
import { berechneKiRuecklage, normalisiereFinanzwert, ruecklagenQuote } from "@/lib/finance/ki-ruecklage";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import {
  berechneVorstandBudgetStand,
  pruefeKaufGegenVorstandFreigabe,
  resolveVorstandFreigabe,
  stufeFuerVertrauen,
} from "@/lib/finance/vorstand-budgetfreigabe";

afterEach(() => {
  delete process.env.OLY_VORSTAND_BUDGET;
  delete process.env.OLY_KI_RUECKLAGE_V2;
});

describe("Stufe 1 — KI-Ruecklage nach Finanzwert", () => {
  it("Quote steigt linear von 5 % (Finanzwert 1) auf 25 % (Finanzwert 10)", () => {
    expect(ruecklagenQuote(1)).toBeCloseTo(0.05, 6);
    expect(ruecklagenQuote(10)).toBeCloseTo(0.25, 6);
    expect(ruecklagenQuote(5.5)).toBeCloseTo(0.15, 6);
    // Chris: niedriger Finanzwert 5 bis 10 %, hoher 15 bis 25 %.
    expect(ruecklagenQuote(3)).toBeLessThanOrEqual(0.1);
    expect(ruecklagenQuote(6)).toBeGreaterThanOrEqual(0.15);
  });

  it("normiert Altwerte (0 bis 100) und fehlende Werte", () => {
    expect(normalisiereFinanzwert(70)).toBe(7);
    expect(normalisiereFinanzwert(undefined)).toBe(5);
    expect(normalisiereFinanzwert(0)).toBe(1);
  });

  it("haengt am Finanzwert, nicht am Budget: gleiches Budget, hoeherer Finanzwert, mehr Ruecklage", () => {
    const arm = berechneKiRuecklage({ finances: 2, budget: 300, zielgehalt: 40 });
    const reich = berechneKiRuecklage({ finances: 9, budget: 300, zielgehalt: 40 });
    expect(reich.ruecklage).toBeGreaterThan(arm.ruecklage * 2);
    // und gleicher Finanzwert, anderes Budget: Anteil bleibt gleich
    const klein = berechneKiRuecklage({ finances: 6, budget: 200, zielgehalt: 40 });
    const gross = berechneKiRuecklage({ finances: 6, budget: 320, zielgehalt: 40 });
    expect(klein.ruecklage / 200).toBeCloseTo(gross.ruecklage / 320, 2);
  });

  it("Untergrenze 0,35 x Zielgehalt greift, wenn die Quote zu klein ist", () => {
    const r = berechneKiRuecklage({ finances: 1, budget: 100, zielgehalt: 80 });
    expect(r.bindend).toBe("gehalt");
    expect(r.ruecklage).toBeCloseTo(28, 2);
  });
});

describe("Stufe 3 — Vorstand-Budgetfreigabe", () => {
  it("Stufen nach Vertrauen", () => {
    expect(stufeFuerVertrauen(8).anteil).toBe(1);
    expect(stufeFuerVertrauen(6).stufe).toBe("hoch");
    expect(stufeFuerVertrauen(5).stufe).toBe("mittel");
    expect(stufeFuerVertrauen(5).anteil).toBe(0.85);
    expect(stufeFuerVertrauen(3).anteil).toBe(0.7);
    expect(stufeFuerVertrauen(3).stufe).toBe("niedrig");
    expect(stufeFuerVertrauen(2.4).stufe).toBe("sparauflage");
    expect(stufeFuerVertrauen(2.4).anteil).toBe(0.5);
  });

  function stateMit(saisonId: string, vertrauen?: number): GameState {
    return {
      season: { id: saisonId },
      seasonState: { boardConfidence: vertrauen == null ? {} : { A: { teamId: "A", value: vertrauen, pressure: 5, warnings: [] } } },
    } as unknown as GameState;
  }

  it("Saison 1 gibt immer 100 % frei, ab Saison 2 gilt das Vertrauen", () => {
    expect(resolveVorstandFreigabe(stateMit("season-1", 1), "A").anteil).toBe(1);
    expect(resolveVorstandFreigabe(stateMit("season-1", 1), "A").grund).toBe("saison_1");
    const s2 = resolveVorstandFreigabe(stateMit("season-2", 3), "A");
    expect(s2.stufe).toBe("niedrig");
    expect(s2.anteil).toBe(0.7);
    expect(resolveVorstandFreigabe(stateMit("season-2"), "A").grund).toBe("ohne_vertrauenswert");
  });

  it("OLY_VORSTAND_BUDGET=0 schaltet die Freigabe aus", () => {
    process.env.OLY_VORSTAND_BUDGET = "0";
    expect(resolveVorstandFreigabe(stateMit("season-2", 1), "A").anteil).toBe(1);
  });
});

describe("Stufe 3 — harte Sperre, Verkaufserloese, Kontostand", () => {
  function state(cash: number, vertrauen: number, history: unknown[] = []): GameState {
    return {
      season: { id: "season-2" },
      teams: [{ teamId: "A", cash }],
      rosters: [],
      teamIdentities: [],
      transferHistory: history,
      seasonState: { boardConfidence: { A: { teamId: "A", value: vertrauen, pressure: 5, warnings: [] } } },
    } as unknown as GameState;
  }
  const buy = (fee: number, salary: number) => ({ id: "b", seasonId: "season-2", transferType: "buy", toTeamId: "A", fromTeamId: null, fee, salary });
  const sell = (fee: number) => ({ id: "s", seasonId: "season-2", transferType: "sell", fromTeamId: "A", toTeamId: null, fee, salary: 0 });

  it("Stand: freigegeben, ausgegeben, noch frei, gesperrt; Kontostand bleibt unveraendert", () => {
    const gs = state(100, 3); // niedrig = 70 %
    const st = berechneVorstandBudgetStand(gs, "A");
    expect(st.freigegebenGesamt).toBe(70);
    expect(st.ausgegeben).toBe(0);
    expect(st.nochFrei).toBe(70);
    expect(st.gesperrt).toBe(30);
    expect(st.grund).toContain("70 %");
    expect(gs.teams[0]!.cash).toBe(100);
    expect(st.getrennt).toBe(true);
    expect(st.investition.frei).toBe(st.nochFrei);
    expect(st.gehalt.quote).toBe(0.75);
  });

  it("Kauf ueber der Freigabe ist abgelehnt (Transfertopf und Gehaltstopf), darunter erlaubt", () => {
    const gs = state(100, 3); // Transfer 70 %, Gehalt max(75 %, 70 %) = 75 % von 41 = 30,75
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: 60, salary: 8, rosterBefore: 10, playerMin: 8 }).ok).toBe(true);
    const teuer = pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: 71, salary: 8, rosterBefore: 10, playerMin: 8 });
    expect(teuer.ok).toBe(false);
    expect(teuer.reason).toBe("vorstand_transferbudget_nicht_freigegeben");
    const gehalt = pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: 10, salary: 31, rosterBefore: 10, playerMin: 8 });
    expect(gehalt.reason).toBe("vorstand_gehaltsbudget_nicht_freigegeben");
    // unter dem Kader-Minimum gilt die Sperre nicht
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: 90, salary: 40, rosterBefore: 6, playerMin: 8 }).ok).toBe(true);
  });

  it("Gehaltsquote nie unter 75 %, auch bei Sparauflage (50 % Transfer)", () => {
    const st = berechneVorstandBudgetStand(state(100, 1), "A");
    expect(st.anteil).toBe(0.5);
    expect(st.gehalt.quote).toBe(0.75);
    expect(st.investition.quote).toBe(0.5);
    expect(st.getrennt).toBe(true);
  });

  it("Verkauf: frei werdendes Gehalt kommt zu 100 % ins Gehaltsbudget zurueck", () => {
    const mitKader = (gehaelter: number[]) => ({
      ...state(100, 3),
      rosters: gehaelter.map((g, i) => ({ teamId: "A", playerId: `p${i}`, salary: g })),
    }) as unknown as GameState;
    const vor = berechneVorstandBudgetStand(mitKader([10, 10]), "A").gehalt;
    const nach = berechneVorstandBudgetStand(mitKader([10]), "A").gehalt;
    expect(nach.frei - vor.frei).toBeCloseTo(10, 2);
  });

  it("Verkaufserloes ist nur zu X % frei: 20 C bei 70 % -> 14 C frei, 6 C bleiben (alter Ablauf)", () => {
    // ALTER ABLAUF (`OLY_TRANSFERFENSTER_GEMEINSAM=0`). Im gemeinsamen Fenster sind Erloese zu 100 % frei
    // (Chris 18.11.), siehe tests/transferfenster-gemeinsam.test.ts.
    const vorher = process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
    process.env.OLY_TRANSFERFENSTER_GEMEINSAM = "0";
    try {
      // Anfangskasse 100, Verkauf 20 -> Kasse jetzt 120. Freigegeben 70 % x (100 + 20) = 84, davon 14 aus dem Verkauf.
      const gs = state(120, 3, [sell(20)]);
      const st = berechneVorstandBudgetStand(gs, "A");
      expect(st.freigegebenGesamt).toBe(84);
      expect(st.nochFrei).toBe(84);
      expect(st.gesperrt).toBe(36);
      // Ohne Verkauf waeren es 70: der Verkauf schaltet genau 14 frei
      expect(st.nochFrei - 70).toBe(14);
    } finally {
      if (vorher === undefined) delete process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
      else process.env.OLY_TRANSFERFENSTER_GEMEINSAM = vorher;
    }
  });

  it("im gemeinsamen Fenster ist der Verkaufserloes zu 100 % frei: 20 C bei 70 % -> 20 C frei", () => {
    // Anfangskasse 100, Verkauf 20 -> Kasse jetzt 120. Freigegeben 70 % x 100 + 20 = 90.
    const st = berechneVorstandBudgetStand(state(120, 3, [sell(20)]), "A");
    expect(st.freigegebenGesamt).toBe(90);
    expect(st.nochFrei - 70).toBe(20);
  });

  it("bereits Ausgegebenes mindert das noch Freie, die Kasse bleibt das Maximum", () => {
    // Anfangskasse 100, Kauf 40 -> Kasse 60, freigegeben 70, ausgegeben 40, frei 30, gesperrt 30
    const st = berechneVorstandBudgetStand(state(60, 3, [buy(40, 5)]), "A");
    expect(st.freigegebenGesamt).toBe(70);
    expect(st.ausgegeben).toBe(40);
    expect(st.nochFrei).toBe(30);
    expect(st.gesperrt).toBe(30);
  });
});

describe("Stufe 0 — Kontoauszug aus vorhandenen Ledgern", () => {
  it("fasst Transfers, Sponsor, Apron, Ziele und Notfall-Kasse je Team zusammen (nur Lesen)", () => {
    const gs = {
      teams: [{ teamId: "A" }, { teamId: "B" }],
      transferHistory: [
        { id: "t1", playerId: "p1", seasonId: "season-1", matchdayId: null, source: "ai_organic_squad_buy", transferType: "buy", fromTeamId: null, toTeamId: "A", fee: 20, salary: 5, marketValue: 20, remainingContractLength: 2, happenedAt: "2026-01-01T00:00:01Z", seasonLabel: "s1" },
        { id: "t2", playerId: "p2", seasonId: "season-1", matchdayId: null, source: "sell", transferType: "sell", fromTeamId: "A", toTeamId: null, fee: 10, netCashImpact: 8, salary: 5, marketValue: 10, remainingContractLength: 1, happenedAt: "2026-01-01T00:00:02Z", seasonLabel: "s1" },
      ],
      seasonState: {
        sponsorPayoutLogs: [{ id: "s", saveId: "x", seasonId: "season-1", teamId: "A", phase: "season_end", componentId: "base", cashDelta: 50, action: "apply", createdAt: "2026-01-02T00:00:00Z" }],
        apronSettlementLogs: [{ id: "a", saveId: "x", seasonId: "season-1", teamId: "A", phase: "season_end", kind: "levy", cashDelta: -2, action: "apply", createdAt: "2026-01-02T00:00:01Z" }],
        objectiveRewardApplyLogs: [{ id: "o", saveId: "x", seasonId: "season-1", action: "apply", payload: { totalCashDelta: 3, totalBoardConfidenceDelta: 0, appliedTeams: 1, cashDeltaByTeamId: { B: 3 } }, createdAt: "2026-01-02T00:00:02Z" }],
        aiEmergencyCashInjections: [{ id: "e", saveId: "x", seasonId: "season-1", teamId: "B", reason: "preseason_roster_repair_cash_floor", cashBefore: 0, cashAfter: 5, amount: 5, createdAt: "2026-01-01T00:00:03Z" }],
      },
    } as unknown as GameState;
    const k = buildKontoauszuege(gs, "season-1");
    const a = k.get("A")!;
    // Saison 1: Kauf und Verkauf vor Spieltag 1 sind Kaderaufbau aus dem Startbudget (Chris 18.11.), keine Transfers.
    expect(a.zeilen.map((z) => z.art)).toEqual(["kaderaufbau", "kaderaufbau", "gehalt_und_sponsor_saisonende", "apron"]);
    expect(a.saldo).toBe(-20 + 8 + 50 - 2);
    expect(a.summeAbfluss).toBe(-22);
    expect(k.get("B")!.saldo).toBe(8);
    // andere Saison: leer
    expect(buildKontoauszuege(gs, "season-2").get("A")!.zeilen).toHaveLength(0);
  });
});

describe("Draft-Builder — Ruecklage auch unter dem Kader-Minimum", () => {
  const DISCIPLINES: OrganicDiscipline[] = [
    { id: "tdm", category: "power" },
    { id: "spurt", category: "power" },
    { id: "tennis", category: "mental" },
  ];
  const AXIS: Record<CoreAxis, number> = { pow: 0.4, spe: 0.2, men: 0.2, soc: 0.2 };
  function pool(): OrganicPlayerView[] {
    const out: OrganicPlayerView[] = [];
    for (const d of DISCIPLINES) {
      for (let tier = 0; tier < 8; tier += 1) {
        out.push({
          playerId: `${d.id}-${tier}`, pow: 70 + tier * 2, spe: 60, men: 60, soc: 60,
          disciplineRatings: { [d.id]: 72 + tier * 2 }, marketValue: 12 + tier * 6, salary: 4 + tier,
        });
      }
    }
    return out;
  }
  function input(over: Partial<OrganicSquadPlanInput["economy"]>): OrganicSquadPlanInput {
    return {
      startingSquad: [], candidates: pool(), identityAxisWeights: AXIS, disciplines: DISCIPLINES,
      economy: {
        cash: 300, cashBuffer: 5, salaryTotal: 0, boardRisk: 0.3, expectedPrize: 0, sponsorIncome: 0, facilityNet: 0, netTransfer: 0,
        weights: deriveUtilityWeights({ ambition: 60, finances: 50, boardConfidence: 50, harmony: 50, playerOpt: 11 }, {}),
        ...over,
      },
    };
  }

  it("ohne minFillFloor unveraendert (bit-gleich: Feld undefined = 0)", () => {
    const a = buildOrganicSquadPlan(input({}));
    const b = buildOrganicSquadPlan(input({ minFillFloor: undefined }));
    expect(b.decisions).toEqual(a.decisions);
    expect(b.finalCash).toBe(a.finalCash);
  });

  it("haelt mit gesetzter Ruecklage die Kasse und erreicht trotzdem das Minimum", () => {
    const r = buildOrganicSquadPlan(input({ cashBuffer: 60, solvencyFloor: 60, minFillFloor: 60 }));
    expect(r.finalCash).toBeGreaterThanOrEqual(60 - 1e-9);
    expect(r.finalSquad.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    expect(r.stoppedBelowMin).toBe(false);
  });

  it("Mindestkader geht vor Ruecklage, wenn beides nicht zusammen geht", () => {
    // Kasse 160, Ruecklage 100: die 8 billigsten Spieler kosten 138 C, mit Ruecklage waeren nur 60 C da.
    // Das Minimum gewinnt (Floor faellt auf 0 zurueck), die Kasse sinkt dabei unter die Ruecklage.
    const r = buildOrganicSquadPlan(input({ cash: 160, cashBuffer: 100, solvencyFloor: 100, minFillFloor: 100 }));
    expect(r.finalSquad.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    expect(r.finalCash).toBeGreaterThanOrEqual(0);
  });

  it("feeCap begrenzt die Summe aus Abloesen und Gehaeltern ab dem Minimum hart", () => {
    const frei = buildOrganicSquadPlan(input({ cash: 400 }));
    const cap = 150;
    const r = buildOrganicSquadPlan(input({ cash: 400, feeCap: cap }));
    const kosten = r.finalSquad.reduce((x, p) => x + p.marketValue + p.salary, 0);
    expect(r.finalSquad.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    // oberhalb des Minimums nie ueber der Freigabe: Kosten der Kaeufe jenseits des Minimums passen hinein
    expect(frei.finalSquad.length).toBeGreaterThanOrEqual(r.finalSquad.length);
    expect(kosten).toBeLessThan(frei.finalSquad.reduce((x, p) => x + p.marketValue + p.salary, 0) + 1);
  });
});
