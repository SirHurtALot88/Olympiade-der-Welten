/**
 * Budget-Gespraech (23.11.): zwei Toepfe und Vorstands-Quote ab Saison 1, Startvertrauen aus der Identitaet, gefuehrter Antrag,
 * Stempel, Tor vor dem Draft, Delegation. Fixture: Saison 1, zwei Menschen (H-1 selbst, H-2 delegiert) und ein KI-Team (K-1).
 */
import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { berechneVorstandBudgetStand, resolveVorstandFreigabe, startVertrauenAusIdentitaet } from "@/lib/finance/vorstand-budgetfreigabe";
import {
  BUDGET_VORSCHLAG,
  beurteileBudgetWahl,
  budgetTisch,
  fuehreKiBudgetGespraecheAus,
  lesBudgetVereinbarung,
  teamsOhneVereinbarung,
  unterschreibeBudgetVereinbarung,
  vorschlagFuerAbwesende,
} from "@/lib/finance/vorstand-budget-gespraech";
import { DELEGATION_STUFEN } from "@/lib/foundation/team-delegation";
import { toepfeAbSaison1, wirtschaftsRegelnFuerNeueSaison } from "@/lib/resolve/wirtschafts-regeln";

const team = (teamId: string, human: boolean, cash = 200): Team =>
  ({ teamId, shortCode: teamId, name: `Team ${teamId}`, budget: cash, cash, identityId: teamId, humanControlled: human, rosterLimit: 14, logoPath: null }) as Team;
const identity = (teamId: string, boardConfidence: number): TeamIdentity =>
  ({ teamId, playerType: null, pow: 5, spe: 5, men: 5, soc: 5, ambition: 6, finances: 6, boardConfidence, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerMin: 8, playerOpt: 11 }) as TeamIdentity;
const spieler = (id: string): Player =>
  ({ id, name: id, rating: 60, marketValue: 20, salaryDemand: 5, className: "Hero", race: "Human", disciplineRatings: { d1: 50 }, coreStats: { pow: 40, spe: 40, men: 40, soc: 40 }, fatigue: 0, form: 0, potential: 0 }) as unknown as Player;

function fixture(opts: { stempel?: "neu" | "alt" | null; saison?: number } = {}): GameState {
  const saison = opts.saison ?? 1;
  const teams = [team("H-1", true), team("H-2", true), team("K-1", false)];
  const players = Array.from({ length: 30 }, (_, i) => spieler(`frei-${i}`));
  const stempel = opts.stempel === null ? undefined : { ...wirtschaftsRegelnFuerNeueSaison(`season-${saison}`), toepfeS1: opts.stempel ?? "neu" };
  return {
    season: { id: `season-${saison}`, name: `Season ${saison}`, year: 2026, currentMatchday: 1, matchdayIds: ["md-1", "md-2"] },
    seasonState: {
      seasonId: `season-${saison}`,
      schedule: [],
      standings: {},
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      contractEvents: [],
      seasonSnapshots: [],
      wirtschaftsRegeln: stempel,
      teamControlSettings: {
        "H-1": { teamId: "H-1", controlMode: "manual", ownerId: "user_local", displayLabel: "Chris" },
        "H-2": { teamId: "H-2", controlMode: "manual", ownerId: "ramona_local", displayLabel: "Ramona", delegation: { stufe: "halbautomatik" } },
        "K-1": { teamId: "K-1", controlMode: "ai", ownerId: "ai" },
      },
    },
    gamePhase: "season_active",
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: [identity("H-1", 7.4), identity("H-2", 2.4), identity("K-1", 9)],
    players,
    disciplines: [],
    rosters: [] as RosterEntry[],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
    mappingReport: {},
  } as unknown as GameState;
}

describe("Toepfe und Quote ab Saison 1", () => {
  it("der Stempel schaltet Saison 1 scharf, ohne Stempel bleibt der alte Weg", () => {
    expect(toepfeAbSaison1(fixture())).toBe(true);
    expect(toepfeAbSaison1(fixture({ stempel: "alt" }))).toBe(false);
    expect(toepfeAbSaison1(fixture({ stempel: null }))).toBe(false);
    expect(toepfeAbSaison1(fixture({ stempel: null, saison: 2 }))).toBe(true);
    expect(berechneVorstandBudgetStand(fixture({ stempel: null }), "H-1").gedeckelt).toBe(false);
    expect(resolveVorstandFreigabe(fixture({ stempel: "alt" }), "H-2").anteil).toBe(1);
  });

  it("Startvertrauen = Identitaet: 7,4 -> 90 %, 2,4 -> 70 %, 9 -> 100 %", () => {
    const gs = fixture();
    expect(startVertrauenAusIdentitaet(gs, "H-1")).toBe(7.4);
    expect(resolveVorstandFreigabe(gs, "H-1").anteil).toBe(0.9);
    expect(resolveVorstandFreigabe(gs, "H-2").anteil).toBe(0.7);
    expect(resolveVorstandFreigabe(gs, "K-1").anteil).toBe(1);
    const s = berechneVorstandBudgetStand(gs, "H-2");
    expect(s.gedeckelt).toBe(true);
    expect(s.wirksamerAnteil).toBe(0.7);
    // Rücklage und Gehaltspuffer stecken im Topf; der Pflichtkader 8 bleibt quotenfrei (leerer Kader: Kaderpflicht-Freigabe).
    expect(s.herleitung.verfuegbar).toBeLessThan(200);
    expect(s.kaderpflicht.aktiv).toBe(true);
  });

  it("die halbe Ruecklage steckt in Saison 1 im Topf; „vorsichtig“ haelt die volle", () => {
    const gs = fixture();
    const normal = beurteileBudgetWahl(gs, "H-1", BUDGET_VORSCHLAG);
    const vorsichtig = beurteileBudgetWahl(gs, "H-1", { ...BUDGET_VORSCHLAG, ruecklage: "vorsichtig" });
    expect(vorsichtig.stand.herleitung.ruecklageZiel).toBeCloseTo(normal.stand.herleitung.ruecklageZiel * 2, 1);
    expect(vorsichtig.stand.investition.gesamt).toBeLessThan(normal.stand.investition.gesamt);
  });
});

describe("Das gefuehrte Gespraech", () => {
  it("Vorschlag: Zusage ohne Bitte, Stand = Vorschlag", () => {
    const u = beurteileBudgetWahl(fixture(), "H-1", BUDGET_VORSCHLAG);
    expect(u.urteil).toBe("zustimmung");
    expect(u.preis).toBe(0);
    expect(u.stand.investition.gesamt).toBeCloseTo(u.standVorschlag.investition.gesamt, 5);
  });

  it("„Alles auf eine Karte“ unter Vertrauen 4 wird abgelehnt, Stempel nur bei Zusage", () => {
    const gs = fixture();
    const alles = beurteileBudgetWahl(gs, "H-2", { ...BUDGET_VORSCHLAG, ambition: "alles" });
    expect(alles.urteil).toBe("ablehnung");
    expect(unterschreibeBudgetVereinbarung(gs, "H-2", { ...BUDGET_VORSCHLAG, ambition: "alles" }, "ramona_local").ok).toBe(false);
  });

  it("Unterschrift stempelt, wirkt auf dieselben Felder und kostet kein Office-Gespraech", () => {
    const gs = fixture();
    const r = unterschreibeBudgetVereinbarung(gs, "H-1", { ...BUDGET_VORSCHLAG, ruecklage: "vorsichtig" }, "user_local");
    expect(r.ok).toBe(true);
    const st = lesBudgetVereinbarung(r.gameState, "H-1");
    expect(st?.gefuehrtVon).toBe("mensch");
    expect(st?.ownerId).toBe("user_local");
    expect(st?.ruecklageStufe).toBe("vorsichtig");
    expect(st?.transferTopf).toBe(berechneVorstandBudgetStand(r.gameState, "H-1").investition.gesamt);
    expect(r.gameState.seasonState.vorstandGespraeche?.["H-1"]?.genutzt ?? 0).toBe(0);
  });

  it("nach dem ersten Kauf ist das Gespraech zu", () => {
    const gs = fixture();
    gs.transferHistory = [{ seasonId: "season-1", transferType: "buy", toTeamId: "H-1", fee: 5, netCashImpact: 5 } as never];
    expect(unterschreibeBudgetVereinbarung(gs, "H-1", BUDGET_VORSCHLAG, "user_local").ok).toBe(false);
  });
});

describe("Tor, Delegation, KI", () => {
  it("Vorstand ist ein eigener Delegationsbereich: Halbautomatik = KI", () => {
    expect(DELEGATION_STUFEN.voll_selbst.vorstand).toBe("selbst");
    expect(DELEGATION_STUFEN.halbautomatik.vorstand).toBe("ki");
    expect(DELEGATION_STUFEN.voll_ki.vorstand).toBe("ki");
  });

  it("KI und delegierte Menschen stempeln sofort, wer selbst verhandelt, haelt den Draft an", () => {
    const gs = fuehreKiBudgetGespraecheAus(fixture());
    expect(lesBudgetVereinbarung(gs, "K-1")?.gefuehrtVon).toBe("ki");
    expect(lesBudgetVereinbarung(gs, "H-2")?.gefuehrtVon).toBe("ki");
    expect(lesBudgetVereinbarung(gs, "H-1")).toBeNull();
    expect(teamsOhneVereinbarung(gs)).toEqual(["H-1"]);
    expect(budgetTisch(gs).find((z) => z.teamId === "H-1")?.status).toBe("verhandelt");
    expect(budgetTisch(gs).find((z) => z.teamId === "H-2")?.fuehrung).toBe("ki");
    const fertig = unterschreibeBudgetVereinbarung(gs, "H-1", BUDGET_VORSCHLAG, "user_local").gameState;
    expect(teamsOhneVereinbarung(fertig)).toEqual([]);
  });

  it("ab Saison 2 wartet das Fenster nicht: Abwesende bekommen den Vorschlag", () => {
    const gs = vorschlagFuerAbwesende(fixture({ saison: 2 }));
    expect(lesBudgetVereinbarung(gs, "H-1")?.gefuehrtVon).toBe("vorschlag");
  });

  it("ohne Stempel (altes Spiel) gibt es kein Gespraech und kein Tor", () => {
    const gs = fixture({ stempel: null });
    expect(fuehreKiBudgetGespraecheAus(gs)).toBe(gs);
    expect(teamsOhneVereinbarung(gs)).toEqual([]);
  });
});
