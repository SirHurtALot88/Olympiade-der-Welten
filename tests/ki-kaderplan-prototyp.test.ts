/**
 * KADERPLAN (Standard im Saison-1-Setup-Draft, `OLY_KI_KADERPLAN=0` schaltet ab; docs/design/ki-pick-analyse-18-11.md):
 *  1. jeder Kauf unter dem Zielkader (Opt) reserviert die restlichen geplanten Plaetze zu einem Platzpreis (ab 12, keine
 *     Fueller) — das Team landet am Zielkader statt 1 bis 3 darunter; traegt die Kasse nicht alle, nur so viele, wie sie
 *     traegt (nie weniger Spieler als ohne Kaderplan);
 *  2. kein Billigster-Spieler-Notweg: unter dem Pflichtkader mit Toepfen nimmt die KI den BESTBEWERTETEN bezahlbaren Spieler;
 *  3. ueber Opt keine Fueller, eine GM-Senkung des Opt bleibt stehen;
 *  4. ohne Kaderplan ist der Builder bit-gleich zum Builder der Basis #1618 (Fixture-Kopie, mehrere hundert Zufallsfaelle);
 *  5. nur in Saison 1 (Review S3), Protokoll auch beim gescheiterten Kauf (Review S4, tests/liga-draft-kaderplan-ausstieg.test.ts).
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  applyOrganicBuyStep,
  buildOrganicSquadPlan,
  createOrganicPlanStepState,
  KADERPLAN_PLATZ_MIN_MW,
  kaderplanProtokoll,
  kaderplanRahmen,
  organicBuyStep,
  type OrganicSquadPlanInput,
} from "@/lib/ai/organic-squad/draft-builder";
import * as basis from "@/tests/fixtures/kaderplan-basis/draft-builder-basis";
import { istKaderplanAktiv } from "@/lib/ai/organic-squad/draft-adapter";
import type { CoreAxis, OrganicDiscipline, OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import { buildLeagueMarketBrackets, type MarketBracketLane } from "@/lib/ai/market-pick-engine/market-brackets";
import { kaufeMitNachruecken, LIGA_DRAFT_KI_MAX_KAUFVERSUCHE, LIGA_DRAFT_KI_TOPN_STUFEN } from "@/lib/draft/liga-draft-dienst";
import { gmKaderOptAnpassung } from "@/lib/foundation/team-general-managers";

afterEach(() => {
  delete process.env.OLY_KI_KADERPLAN;
});

const DISCIPLINES: OrganicDiscipline[] = [
  { id: "tdm", category: "power" },
  { id: "tennis", category: "mental" },
  { id: "spurt", category: "speed" },
];
const AXIS: Record<CoreAxis, number> = { pow: 0.4, spe: 0.3, men: 0.2, soc: 0.1 };

function zufall(start: number) {
  let seed = start;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Markt wie im frischen Spiel: Preise 3 bis 90, Qualitaet steigt mit dem Preis. */
function markt(n: number, saat: number, prefix = "p"): OrganicPlayerView[] {
  const rnd = zufall(saat);
  return Array.from({ length: n }, (_, i) => {
    const wert = Math.round((3 + rnd() ** 1.6 * 87) * 10) / 10;
    const q = 35 + wert * 0.6 + rnd() * 10;
    return {
      playerId: `${prefix}${i}`,
      pow: q + rnd() * 10, spe: q + rnd() * 10, men: q + rnd() * 10, soc: q + rnd() * 10,
      disciplineRatings: { tdm: q + rnd() * 10, tennis: q + rnd() * 10, spurt: q + rnd() * 10 },
      marketValue: wert,
      salary: Math.max(1, Math.round(wert / 4)),
    };
  });
}

function eingabe(saat: number, cash: number, playerOpt: number, extra?: Partial<OrganicSquadPlanInput["economy"]>): OrganicSquadPlanInput {
  return {
    startingSquad: [],
    candidates: markt(400, saat),
    identityAxisWeights: AXIS,
    disciplines: DISCIPLINES,
    economy: {
      cash, cashBuffer: 12, salaryTotal: 0, boardRisk: 0.3, expectedPrize: 0, sponsorIncome: 0, facilityNet: 0, netTransfer: 0,
      solvencyFloor: 12, minFillFloor: 12,
      weights: deriveUtilityWeights({ ambition: 60, finances: 50, boardConfidence: 50, harmony: 50, playerOpt }, {}),
      ...extra,
    },
    draftSeed: `test:${saat}`,
  };
}
const mitKaderplan = (input: OrganicSquadPlanInput, gmOptGesenkt = false): OrganicSquadPlanInput => ({ ...input, kaderplan: { gmOptGesenkt } });

describe("Kaderplan: geplante Plaetze werden besetzt", () => {
  it("mit genug Geld fuer den Zielkader landet die KI am Zielkader, nie darunter, ohne Fueller", () => {
    let geprueft = 0;
    for (let saat = 1; saat <= 30; saat += 1) {
      const opt = 10 + (saat % 5);
      const cash = 170 + (saat * 37) % 160;
      const input = eingabe(saat, cash, opt);
      const vorher = buildOrganicSquadPlan(input);
      const nachher = buildOrganicSquadPlan(mitKaderplan(input));
      const ziel = input.economy.weights.optTarget;
      // Nie kleiner als vorher bis zum Zielkader (ueber Opt durfte vorher mit Fuellern groesser sein).
      expect(nachher.finalSquad.length).toBeGreaterThanOrEqual(Math.min(vorher.finalSquad.length, ziel));
      expect(nachher.finalCash).toBeGreaterThanOrEqual(12 - 1e-9);
      // Traegt die Kasse den Zielkader zum Platzpreis (Protokoll: `opt_erreicht`), wird er erreicht, und unter Opt kommt KEIN
      // Fueller (< 12) — ausser als gezaehlter Notweg; in diesem grosszuegigen Markt gibt es keinen.
      if (nachher.kaderplan!.grund === "opt_erreicht" || cash - 12 >= ziel * 15) {
        geprueft += 1;
        expect(nachher.finalSquad.length).toBeGreaterThanOrEqual(ziel);
        const fuellerUnterOpt = nachher.finalSquad.slice(0, ziel).filter((s) => s.marketValue < KADERPLAN_PLATZ_MIN_MW);
        expect(fuellerUnterOpt).toEqual([]);
        expect(nachher.kaderplan!.notwege).toEqual([]);
      }
      // Ueber Opt nie ein Fueller (Review S5).
      for (const spieler of nachher.finalSquad.slice(ziel)) expect(spieler.marketValue).toBeGreaterThanOrEqual(KADERPLAN_PLATZ_MIN_MW);
    }
    expect(geprueft).toBeGreaterThan(10);
  });

  it("Review S1: Kader 8, Opt 12, Kasse fuer nur ein, zwei Plaetze — der Kaderplan kauft, statt bei 8 stehen zu bleiben", () => {
    const pool = markt(200, 4);
    const preis = (wert: number, id: string): OrganicPlayerView => ({ ...pool[0]!, playerId: id, marketValue: wert, salary: 1 });
    const start = [5, 6, 7, 8, 9, 10, 11, 12].map((w, i) => preis(20 + w, `s${i}`));
    const candidates = [preis(4, "c4"), preis(5, "c5"), preis(6, "c6"), preis(13, "c13"), preis(15, "c15"), preis(30, "c30")];
    const input: OrganicSquadPlanInput = {
      ...eingabe(1, 22, 12),
      startingSquad: start,
      candidates,
      economy: { ...eingabe(1, 22, 12).economy, cash: 22, salaryTotal: 8 },
    };
    expect(input.economy.weights.optTarget).toBe(12);
    const mit = buildOrganicSquadPlan(mitKaderplan(input));
    const ohne = buildOrganicSquadPlan(input);
    // 22 - 4 = 18 (Reserve fuer 1 weiteren Platz zu 5 traegt nicht mehr ueber 12, also nur dieser) -> 18 - 5 = 13 -> Schluss.
    expect(mit.finalSquad.length).toBe(10);
    expect(mit.finalSquad.length).toBeGreaterThanOrEqual(ohne.finalSquad.length);
    expect(mit.finalCash).toBeGreaterThanOrEqual(12);
    expect(mit.kaderplan!.grund).toBe("unter_opt_rahmen_erschoepft");
  });

  it("Review S1: nie weniger Spieler als ohne Kaderplan (bis zum Zielkader), auch bei knapper Kasse und Startkader", () => {
    for (let saat = 1; saat <= 120; saat += 1) {
      const rnd = zufall(saat * 7919);
      const opt = 9 + Math.floor(rnd() * 6);
      const startGroesse = Math.floor(rnd() * 10);
      const pool = markt(250, saat);
      const startingSquad = pool.slice(0, startGroesse);
      const cash = 12 + rnd() * (rnd() < 0.5 ? 40 : 220);
      const input: OrganicSquadPlanInput = {
        ...eingabe(saat, cash, opt),
        startingSquad,
        candidates: pool.slice(startGroesse),
      };
      input.economy.salaryTotal = startingSquad.reduce((s, p) => s + p.salary, 0);
      const ohne = buildOrganicSquadPlan(input);
      const mit = buildOrganicSquadPlan(mitKaderplan(input));
      expect(mit.finalSquad.length, `Saat ${saat}`).toBeGreaterThanOrEqual(Math.min(ohne.finalSquad.length, input.economy.weights.optTarget));
    }
  });
});

describe("Kaderplan: Zaehlung der Plaetze und Protokoll (Review S2)", () => {
  const spieler = (id: string, wert: number): OrganicPlayerView => ({ ...markt(1, 1)[0]!, playerId: id, marketValue: wert, salary: 1 });

  it("der aktuelle Kauf zaehlt zum Platzpreis, nicht zum Preis des billigsten Fuellers", () => {
    const start = Array.from({ length: 8 }, (_, i) => spieler(`s${i}`, 20));
    // Opt 9, also nur dieser Kauf. Kasse 12 + 12,5: ein Fueller zu 3 passt, ein Spieler ab 12 (13) nicht.
    const input: OrganicSquadPlanInput = {
      ...eingabe(1, 24.5, 9),
      startingSquad: start,
      candidates: [spieler("f3", 3), spieler("c13", 13), spieler("c40", 40)],
    };
    expect(input.economy.weights.optTarget).toBe(9);
    const rahmen = kaderplanRahmen(mitKaderplan(input), createOrganicPlanStepState(input));
    // Vorher: 9 (= Opt, „opt_erreicht"), obwohl der 9. Platz nur mit einem Fueller zu besetzen ist.
    expect(rahmen.plaetze).toBe(8);
    expect(rahmen.fuellerSperre).toBe(false);
    const plan = buildOrganicSquadPlan(mitKaderplan(input));
    expect(plan.finalSquad.map((s) => s.playerId)).toContain("f3");
    expect(plan.kaderplan!.grund).toBe("opt_erreicht_tiefe_vor_qualitaet");
  });

  it("ein Fueller unter Opt trotz `opt_erreicht` zaehlt im Protokoll als Notweg; ein Kader unter 8 ebenso", () => {
    const start = Array.from({ length: 8 }, (_, i) => spieler(`s${i}`, 20));
    const input = mitKaderplan({ ...eingabe(1, 200, 9), startingSquad: start, candidates: [spieler("f4", 4), spieler("c13", 13)] });
    const anfang = createOrganicPlanStepState(input);
    const protokoll = kaderplanProtokoll(input, anfang, { squad: [...start, spieler("f4", 4)] });
    expect(protokoll.grund).toBe("opt_erreicht");
    expect(protokoll.notwege).toEqual(["fueller_rueckfall"]);
    // Schon im Schritt gemeldet: nicht doppelt.
    expect(kaderplanProtokoll(input, anfang, { squad: [...start, spieler("f4", 4)] }, ["fueller_rueckfall"]).notwege).toEqual(["fueller_rueckfall"]);
    const leer = mitKaderplan({ ...eingabe(1, 200, 9), candidates: [spieler("c13", 13)] });
    expect(kaderplanProtokoll(leer, createOrganicPlanStepState(leer), { squad: [spieler("a", 20)] }).notwege).toContain("unter_minimum");
  });

  it("Review K2: ein ungueltiger Platz-Wettbewerb (NaN) rechnet wie 1", () => {
    const input = mitKaderplan(eingabe(9, 240, 12));
    const step = createOrganicPlanStepState(input);
    const eins = kaderplanRahmen({ ...input, economy: { ...input.economy, platzWettbewerb: 1 } }, step);
    const nan = kaderplanRahmen({ ...input, economy: { ...input.economy, platzWettbewerb: Number.NaN } }, step);
    expect(Number.isFinite(nan.reserve)).toBe(true);
    expect(nan).toEqual(eins);
  });
});

describe("Kaderplan: ueber dem Zielkader (Review S5)", () => {
  it("hat der GM den Opt bewusst gesenkt, hoert das Team am gesenkten Opt auf — kein Fueller, kein weiterer Kauf", () => {
    for (let saat = 1; saat <= 20; saat += 1) {
      const input = eingabe(saat, 600, 11);
      const ziel = input.economy.weights.optTarget;
      const plan = buildOrganicSquadPlan(mitKaderplan(input, true));
      expect(plan.finalSquad.length).toBe(ziel);
    }
  });

  it("ueber Opt nur Spieler ab Platzpreis: die Fueller sind die einzigen bezahlbaren -> Schluss am Opt", () => {
    const pool = markt(300, 3);
    const start = pool.slice(0, 9);
    // Kasse reicht ueber dem Puffer (12) nur fuer Fueller (< 12), nicht fuer einen Spieler ab 12.
    const fueller = pool.slice(9).filter((p) => p.marketValue < 8);
    const teuer = pool.slice(9).filter((p) => p.marketValue >= KADERPLAN_PLATZ_MIN_MW);
    const input: OrganicSquadPlanInput = { ...eingabe(3, 12 + 11, 9), startingSquad: start, candidates: [...fueller, ...teuer] };
    input.economy.weights = { ...input.economy.weights, optTarget: 9 };
    const mit = buildOrganicSquadPlan(mitKaderplan(input));
    expect(mit.finalSquad.length).toBe(9);
    expect(mit.decisions).toEqual([]);
  });
});

describe("Kaderplan: kein Billigster-Spieler-Notweg", () => {
  it("unter dem Pflichtkader mit gesperrtem Topf nimmt die KI den bestbewerteten bezahlbaren, nicht den billigsten", () => {
    const input = eingabe(3, 300, 11, { feeCap: 0, salaryCap: 0 });
    const ohne = buildOrganicSquadPlan(input);
    const mit = buildOrganicSquadPlan(mitKaderplan(input));
    const billigste = [...input.candidates].sort((a, b) => a.marketValue - b.marketValue).slice(0, 8).map((p) => p.playerId);
    // Alt: der Topf ist zu, unter 8 kommen genau die acht billigsten (Notweg).
    expect(ohne.decisions.map((d) => d.playerId).sort()).toEqual([...billigste].sort());
    // Neu: acht Spieler, aber nach Bewertung — nicht die acht billigsten.
    expect(mit.finalSquad.length).toBeGreaterThanOrEqual(8);
    expect(mit.decisions.map((d) => d.playerId).sort()).not.toEqual([...billigste].sort());
    const wert = (ids: string[]) => ids.reduce((s, id) => s + input.candidates.find((p) => p.playerId === id)!.marketValue, 0);
    expect(wert(mit.decisions.slice(0, 8).map((d) => d.playerId))).toBeGreaterThan(wert(billigste));
    // Der gelockerte Topf ist mit Kaderplan ein gezaehlter Notweg.
    expect(mit.kaderplan!.notwege).toContain("topf_ueberzogen");
  });

  it("Review K3: ohne Kaderplan meldet der Schritt keinen Notweg (Daten bit-gleich)", () => {
    const input = eingabe(3, 300, 11, { feeCap: 0, salaryCap: 0 });
    const step = createOrganicPlanStepState(input);
    expect(organicBuyStep(input, step).notweg).toBeUndefined();
    expect(organicBuyStep(mitKaderplan(input), step).notweg).toBe("topf_ueberzogen");
  });

  it("Einzelschritt-Draft: nach Fehlkaeufen geht es in der Rangliste weiter, nie zur Billig-Liste (Versuchsgrenze wie live)", () => {
    expect(LIGA_DRAFT_KI_MAX_KAUFVERSUCHE).toBe(40);
    const rangliste = Array.from({ length: 300 }, (_, i) => `r${i}`);
    const stufen = [...LIGA_DRAFT_KI_TOPN_STUFEN, Number.MAX_SAFE_INTEGER];
    // Platz 36 (jenseits der Top 20, also aus der 200er-Stufe) nach 35 Fehlkaeufen: gekauft, nicht aus dem Notfall.
    const ergebnis = kaufeMitNachruecken({
      topNStufen: stufen,
      rangliste: (n) => rangliste.slice(0, n),
      notfall: () => ["billig"],
      kaufe: (id) => (id === "r35" ? { ok: true, ergebnis: id } : { ok: false, grund: "spieler_vergeben" }),
    });
    expect(ergebnis.ok && ergebnis.playerId).toBe("r35");
    expect(ergebnis.ok && ergebnis.ausNotfall).toBe(false);
    // Nach 40 Fehlkaeufen ist Schluss (`blockiert`) — die Billig-Liste kommt auch dann nicht.
    const versucht: string[] = [];
    const blockiert = kaufeMitNachruecken({
      topNStufen: stufen,
      rangliste: (n) => rangliste.slice(0, n),
      notfall: () => ["billig"],
      kaufe: (id) => {
        versucht.push(id);
        return id === "r250" || id === "billig" ? { ok: true, ergebnis: id } : { ok: false, grund: "spieler_vergeben" };
      },
    });
    expect(blockiert).toMatchObject({ ok: false, grund: "blockiert" });
    expect(versucht).toHaveLength(40);
    expect(versucht).not.toContain("billig");
  });
});

describe("Kaderplan: Saison-1-Draft und (seit Fenster auf Opt) das Transferfenster ab Saison 2, Standard an", () => {
  it("Saison 1 an; ab Saison 2 an mit Fenster auf Opt, aus mit `OLY_FENSTER_AUF_OPT=0`; `OLY_KI_KADERPLAN=0` schaltet ab", () => {
    const vorher = { fenster: process.env.OLY_FENSTER_AUF_OPT, gemeinsam: process.env.OLY_TRANSFERFENSTER_GEMEINSAM };
    try {
      delete process.env.OLY_FENSTER_AUF_OPT;
      delete process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
      expect(istKaderplanAktiv({ season: { id: "season-1" } } as never)).toBe(true);
      // Review S3 geloest (Gehaltsseite der Plaetze bis Opt reserviert): ab Saison 2 im Fenster an.
      expect(istKaderplanAktiv({ season: { id: "season-2" } } as never)).toBe(true);
      expect(istKaderplanAktiv({ season: { id: "season-11" } } as never)).toBe(true);
      // Alter Stand: nur Saison 1.
      process.env.OLY_FENSTER_AUF_OPT = "0";
      expect(istKaderplanAktiv({ season: { id: "season-1" } } as never)).toBe(true);
      expect(istKaderplanAktiv({ season: { id: "season-2" } } as never)).toBe(false);
      delete process.env.OLY_FENSTER_AUF_OPT;
      // Ohne gemeinsames Fenster gibt es kein Fenster auf Opt.
      process.env.OLY_TRANSFERFENSTER_GEMEINSAM = "0";
      expect(istKaderplanAktiv({ season: { id: "season-2" } } as never)).toBe(false);
      delete process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
      process.env.OLY_KI_KADERPLAN = "0";
      expect(istKaderplanAktiv({ season: { id: "season-1" } } as never)).toBe(false);
      expect(istKaderplanAktiv({ season: { id: "season-2" } } as never)).toBe(false);
      process.env.OLY_KI_KADERPLAN = "1";
    } finally {
      if (vorher.fenster === undefined) delete process.env.OLY_FENSTER_AUF_OPT;
      else process.env.OLY_FENSTER_AUF_OPT = vorher.fenster;
      if (vorher.gemeinsam === undefined) delete process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
      else process.env.OLY_TRANSFERFENSTER_GEMEINSAM = vorher.gemeinsam;
    }
  });
});

/**
 * Review K6: AUS gegen den Builder der Basis #1618 (Fixture-Kopie), nicht AUS gegen AUS. Mehrere hundert Zufallsfaelle mit und
 * ohne Toepfe, Komposition, Startkader, Gehaltsdeckel, Saat. Verglichen: Block-Plan (Spieler, Nutzen), `finalCash`,
 * `finalSalaryTotal`, `stoppedBelowMin`; im Einzelschritt je Schritt `kind`, `best`, Stop-Nutzen und die Top 3.
 */
describe("Kaderplan aus: bit-gleich zum Builder der Basis #1618", () => {
  const LANES: MarketBracketLane[] = ["superstar", "star", "core", "depth", "backup", "reserve"];
  function zufallsFall(fall: number): OrganicSquadPlanInput {
    const rnd = zufall(fall * 104729 + 17);
    const pool = markt(60 + Math.floor(rnd() * 240), fall, `f${fall}_`);
    const startGroesse = rnd() < 0.5 ? 0 : Math.floor(rnd() * 11);
    const startingSquad = pool.slice(0, startGroesse);
    const candidates = pool.slice(startGroesse);
    const opt = 8 + Math.floor(rnd() * 7);
    const cash = 5 + rnd() * (rnd() < 0.3 ? 60 : 450);
    const cashBuffer = rnd() * 30;
    const mitToepfen = rnd() < 0.35;
    const komposition = rnd() < 0.4;
    const brackets = buildLeagueMarketBrackets(candidates.map((p) => p.marketValue));
    const counts = Object.fromEntries(LANES.map((lane) => [lane, Math.floor(rnd() * 4)])) as Record<MarketBracketLane, number>;
    return {
      startingSquad,
      candidates,
      identityAxisWeights: { pow: rnd(), spe: rnd(), men: rnd(), soc: rnd() },
      disciplines: DISCIPLINES,
      economy: {
        cash,
        cashBuffer,
        salaryTotal: startingSquad.reduce((s, p) => s + p.salary, 0),
        boardRisk: rnd(),
        expectedPrize: rnd() * 40,
        sponsorIncome: rnd() * 40,
        facilityNet: rnd() * 10 - 5,
        netTransfer: 0,
        weights: deriveUtilityWeights(
          { ambition: 20 + rnd() * 80, finances: 20 + rnd() * 80, boardConfidence: 50, harmony: 50, playerOpt: opt },
          {},
        ),
        rosterMax: rnd() < 0.2 ? 12 : undefined,
        solvencyFloor: rnd() < 0.5 ? rnd() * cashBuffer : undefined,
        minFillFloor: rnd() < 0.5 ? rnd() * 25 : undefined,
        feeCap: mitToepfen ? rnd() * 200 : undefined,
        salaryCap: mitToepfen && rnd() < 0.7 ? rnd() * 50 : undefined,
        salaryCeiling: rnd() < 0.3 ? 10 + rnd() * 60 : undefined,
      },
      draftSeed: rnd() < 0.7 ? `fall:${fall}` : null,
      composition: komposition ? { counts, brackets } : undefined,
    };
  }
  const FAELLE = 300;

  it(`Block-Plan in ${FAELLE} Zufallsfaellen gleich (auch mit Schalter-Env an, solange der Adapter den Kaderplan nicht setzt)`, () => {
    let mitTopf = 0;
    let mitKomposition = 0;
    let mitStart = 0;
    for (let fall = 1; fall <= FAELLE; fall += 1) {
      const input = zufallsFall(fall);
      if (input.economy.feeCap != null) mitTopf += 1;
      if (input.composition) mitKomposition += 1;
      if (input.startingSquad.length > 0) mitStart += 1;
      process.env.OLY_KI_KADERPLAN = fall % 2 === 0 ? "1" : "0";
      const heute = buildOrganicSquadPlan(input);
      const alt = basis.buildOrganicSquadPlan(input as basis.OrganicSquadPlanInput);
      expect(heute.decisions, `Fall ${fall}`).toEqual(alt.decisions);
      expect(heute.finalCash, `Fall ${fall}`).toBe(alt.finalCash);
      expect(heute.finalSalaryTotal, `Fall ${fall}`).toBe(alt.finalSalaryTotal);
      expect(heute.stoppedBelowMin, `Fall ${fall}`).toBe(alt.stoppedBelowMin);
      expect(heute.finalSquad.map((s) => s.playerId)).toEqual(alt.finalSquad.map((s) => s.playerId));
      expect(heute.kaderplan).toBeUndefined();
    }
    // Die Faelle decken die Zweige wirklich ab.
    expect(mitTopf).toBeGreaterThan(60);
    expect(mitKomposition).toBeGreaterThan(80);
    expect(mitStart).toBeGreaterThan(80);
  });

  it(`Einzelschritt in ${FAELLE} Zufallsfaellen gleich: kind, best, Stop-Nutzen, Top 3`, () => {
    for (let fall = 1; fall <= FAELLE; fall += 1) {
      const input = zufallsFall(fall + 5000);
      const heute = createOrganicPlanStepState(input);
      const alt = basis.createOrganicPlanStepState(input as basis.OrganicSquadPlanInput);
      for (let schritt = 0; schritt < 16; schritt += 1) {
        const a = organicBuyStep(input, heute, { topN: 3 });
        const b = basis.organicBuyStep(input as basis.OrganicSquadPlanInput, alt, { topN: 3 });
        expect(a.kind, `Fall ${fall}/${schritt}`).toBe(b.kind);
        expect(a.best?.playerId ?? null).toBe(b.best?.playerId ?? null);
        expect(a.bestUtility).toBe(b.bestUtility);
        expect(a.stopUtility).toBe(b.stopUtility);
        expect(a.stoppedBelowMin).toBe(b.stoppedBelowMin);
        expect(a.top.map((t) => [t.playerId, t.utility])).toEqual(b.top.map((t) => [t.playerId, t.utility]));
        expect(a.notweg).toBeUndefined();
        if (a.kind !== "buy" || !a.best) break;
        applyOrganicBuyStep(input, heute, a.best);
        basis.applyOrganicBuyStep(input as basis.OrganicSquadPlanInput, alt, b.best!);
      }
    }
  });
});

describe("Kaderplan: Platzpreis aus dem Startpool", () => {
  it("billige 12er im Restpool weg, die Reserve bleibt beim Startpreis", () => {
    const input = mitKaderplan(eingabe(9, 240, 12));
    const start = createOrganicPlanStepState(input);
    const startPreise = input.candidates.map((p) => p.marketValue).sort((a, b) => a - b);
    // Restpool ohne alle Spieler zwischen 12 und 20 (die haben andere Teams schon genommen).
    const restInput = { ...input, candidates: input.candidates.filter((p) => p.marketValue < 12 || p.marketValue > 20) };
    const rest = createOrganicPlanStepState(restInput);
    const mitRestpool = kaderplanRahmen(restInput, rest);
    const mitStartpool = kaderplanRahmen({ ...restInput, economy: { ...restInput.economy, platzPreise: startPreise } }, rest);
    expect(mitStartpool.reserve).toBeLessThan(mitRestpool.reserve);
    expect(kaderplanRahmen({ ...input, economy: { ...input.economy, platzPreise: startPreise } }, start).reserve).toBeCloseTo(
      kaderplanRahmen(input, start).reserve,
      6,
    );
  });

  it("jeder Plan traegt einen Grund fuer seine Kadergroesse; ohne Kaderplan keinen", () => {
    const input = eingabe(11, 260, 13);
    expect(buildOrganicSquadPlan(input).kaderplan).toBeUndefined();
    const plan = buildOrganicSquadPlan(mitKaderplan(input));
    expect(plan.kaderplan).toBeDefined();
    expect(plan.kaderplan!.kader).toBe(plan.finalSquad.length);
    expect(plan.kaderplan!.optTarget).toBe(input.economy.weights.optTarget);
    if (plan.finalSquad.length >= plan.kaderplan!.optTarget) {
      expect(["opt_erreicht", "opt_erreicht_tiefe_vor_qualitaet"]).toContain(plan.kaderplan!.grund);
    } else {
      expect(plan.kaderplan!.grund).toBe("unter_opt_rahmen_erschoepft");
    }
    expect(plan.kaderplan!.text.length).toBeGreaterThan(10);
  });

  it("knappes Geld: Zielkader trotzdem erreicht, Protokoll sagt „Tiefe vor Qualitaet\" statt still unter Opt", () => {
    const input = eingabe(5, 150, 14);
    const plan = buildOrganicSquadPlan(mitKaderplan(input));
    expect(plan.finalSquad.length).toBeGreaterThanOrEqual(input.economy.weights.optTarget);
    expect(plan.kaderplan!.grund).toBe("opt_erreicht_tiefe_vor_qualitaet");
    expect(plan.kaderplan!.rahmenPlaetze).toBeLessThan(input.economy.weights.optTarget);
  });
});

describe("Kaderplan: bewusste GM-Senkung des Opt (weniger, dafuer staerker)", () => {
  it("hoechstens −2, nie unter Minimum + 1, Tiefen-GM senkt nie, Grund protokolliert", () => {
    const star = gmKaderOptAnpassung({ bias: { starPriority: 10, eliteSmallRosterPreference: 9, rosterDepthPreference: 3 }, opt: 12, rosterMin: 8 });
    expect(star.opt).toBe(10);
    expect(star.grund).toContain("weniger Spieler, dafuer staerker");
    const knapp = gmKaderOptAnpassung({ bias: { starPriority: 10, eliteSmallRosterPreference: 9 }, opt: 10, rosterMin: 8 });
    expect(knapp.opt).toBe(9);
    const mittel = gmKaderOptAnpassung({ bias: { starPriority: 8, eliteSmallRosterPreference: 7 }, opt: 13, rosterMin: 8 });
    expect(mittel.opt).toBe(12);
    const tiefe = gmKaderOptAnpassung({ bias: { starPriority: 10, eliteSmallRosterPreference: 10, rosterDepthPreference: 8 }, opt: 14, rosterMin: 8 });
    expect(tiefe.opt).toBe(14);
    expect(tiefe.grund).toBeNull();
    expect(gmKaderOptAnpassung({ bias: null, opt: 12, rosterMin: 8 }).delta).toBe(0);
    for (let opt = 8; opt <= 14; opt += 1) {
      const r = gmKaderOptAnpassung({ bias: { starPriority: 10, eliteSmallRosterPreference: 10 }, opt, rosterMin: 8 });
      expect(r.opt).toBeGreaterThanOrEqual(Math.min(opt, 9));
      expect(opt - r.opt).toBeLessThanOrEqual(2);
    }
  });
});
