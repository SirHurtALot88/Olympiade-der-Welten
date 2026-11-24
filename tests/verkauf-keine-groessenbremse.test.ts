/**
 * KEINE KADERGROESSEN-BREMSE AUF VERKAEUFE (Chris 24.11., „fuer immer“), docs/design/verkauf-restgehalt-24-11.md Abschnitt 8.
 *
 * Woertlich: „Wenn ich jetzt zum Beispiel 12 Spieler habe und 10 davon haben ein richtig gutes Angebot und ich soll mindestens 10
 * Spieler haben, dann verkaufe ich ja nicht nur 2, dann verkaufe ich 8 oder so und kaufe mir ein viel besseres Team oder ein
 * gleichwertiges Team und habe viel mehr Cash. … Es ist immer erlaubt, alle moeglichen Spieler zu verkaufen. Es gibt keine Groesse,
 * die sagt, du darfst nicht unter die Soll-Kadergroesse gehen.“
 *
 * Die Waechter hier:
 *  1. Chris' Beispiel im Planer: 12 Spieler, Opt 10, 10 mit richtig gutem Angebot — die KI verkauft deutlich mehr als 2 (auch unter
 *     das Minimum), am Vertragsende wie im Fenster. Ob einer geht, entscheidet die Kosten-Nutzen-Abwaegung (Abschnitt 9); die
 *     Kadertiefe ist darin ein Kostenposten, keine Grenze. Kernschutz (Angebot 1,5 / 1,4 / 1,3 x MW) bleibt eine Wert-Regel.
 *  2. Der Kaufplaner fuellt einen so geschrumpften Kader im selben Fenster wieder bis Opt.
 *  3. Ohne gutes Angebot verkauft dasselbe Team keinen gleich starken Stammspieler — der Wert entscheidet, nicht die Groesse.
 *  4. Vertrags-Tick: keine Hoechstzahl an Freigaben, keine Halte-Signale nach Kadergroesse (mit Stempel); ohne Stempel wie vorher.
 *  5. Vertragsaufloesung: ein Kader unter Opt macht den Spieler nicht wertvoller (mit Stempel).
 *  6. Die Fenster-Grenze max(8, playerMin) im alten Stand (`OLY_FENSTER_AUF_OPT=0`) gilt mit Stempel nicht.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

/** Angebotsfaktor je Spieler (Preis / Marktwert vor Kaderdruck); vom Test gesetzt. */
const ANGEBOT = new Map<string, number>();

vi.mock("@/lib/market/transfermarkt-sell-pricing-policy", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/market/transfermarkt-sell-pricing-policy")>();
  return {
    ...original,
    // Preis = Marktwert x Angebot x Kaderdruck (am Minimum 0,95, darunter 0,9 — dieselben Stufen wie die echte Policy).
    applySellPricingPolicyToBreakdown: (input: Parameters<typeof original.applySellPricingPolicyToBreakdown>[0]) => {
      const mw = input.baseBreakdown.baseMarketValue ?? 0;
      const playerMin = input.gameState.teamIdentities.find((i) => i.teamId === input.teamId)?.playerMin ?? 8;
      const druck = input.rosterAfter < playerMin ? 0.9 : input.rosterAfter === playerMin ? 0.95 : 1;
      const preis = Math.round(mw * (ANGEBOT.get(input.player?.id ?? "") ?? 1) * druck * 100) / 100;
      return {
        policy: { seasonStartDiscount: 1, timingMultiplier: 1, liquidationMalus: druck, identityFitMultiplier: 1, combinedMultiplier: druck, notes: [] },
        preFloorSalePrice: preis,
        floorApplied: false,
        breakdown: { ...input.baseBreakdown, saleFactor: mw > 0 ? preis / mw : null, salePrice: preis },
      };
    },
  };
});

const { planOrganicSellsForTeam } = await import("@/lib/ai/organic-squad/draft-adapter");
const { buildOrganicSquadPlan } = await import("@/lib/ai/organic-squad/draft-builder");
const { deriveUtilityWeights } = await import("@/lib/ai/organic-squad/weights");
const { computeSeasonEndContractTick } = await import("@/lib/contracts/contract-renewal-service");
const { decideAiContractDissolution } = await import("@/lib/morale/ai-contract-dissolution-service");
const { wirtschaftsRegelnFuerNeueSaison } = await import("@/lib/resolve/wirtschafts-regeln");

afterEach(() => {
  ANGEBOT.clear();
});

const IDENTITY = {
  teamId: "team-test",
  ambition: 55,
  finances: 45,
  boardConfidence: 55,
  harmony: 50,
  playerMin: 8,
  playerOpt: 10,
  pow: 70,
  spe: 12,
  men: 12,
  soc: 12,
} as unknown as TeamIdentity;

/** 12 Spieler, p0 der beste, Ein-Jahres-Vertraege am Vertragsende (Gehalt der Saison gebucht ⇒ kein Restgehalt). */
function chrisKader(schwellen: "alt" | "neu") {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < 12; i++) {
    const pid = `p${i}`;
    players.push({
      id: pid,
      name: pid,
      coreStats: { pow: 90 - i, spe: 50, men: 50, soc: 50 },
      disciplineRatings: { tdm: 80 - i },
      marketValue: 30,
      salaryDemand: 4,
      potential: 0,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "f",
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
    } as unknown as Player);
    rosters.push({
      id: `r${i}`,
      teamId: "team-test",
      playerId: pid,
      contractLength: 1,
      salary: 4,
      upkeep: 4,
      purchasePrice: 30,
      currentValue: 30,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    } as RosterEntry);
  }
  const t = { teamId: "team-test", name: "T", shortCode: "T", cash: 80, rosterLimit: 20, budget: 100, identityId: "team-test", humanControlled: false } as unknown as Team;
  const gameState = {
    gamePhase: "season_active",
    season: { id: "season-1", name: "S1", currentMatchday: 20, matchdayIds: [] },
    matchdayState: { matchdayId: "season-1-md-20", status: "resolved" },
    teams: [t],
    players,
    rosters,
    teamIdentities: [IDENTITY],
    disciplines: [{ id: "tdm", category: "power" }],
    seasonState: {
      seasonId: "season-1",
      seasonSnapshots: [],
      sponsorPayoutLogs: [{ seasonId: "season-1", teamId: "team-test", componentId: "salary_deduct" }],
      wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-1"), kernschutz: "neu", restgehalt: "neu", verkaufSchwellen: schwellen },
    },
  } as unknown as GameState;
  return { gameState, team: t, players };
}

describe("Chris' Beispiel: 12 Spieler, Opt 10, 10 mit richtig gutem Angebot", () => {
  const angebote = (faktor: number) => {
    // Die beiden Besten haben kein Angebot ueber dem Marktwert, die anderen zehn `faktor` x MW.
    for (let i = 0; i < 12; i++) ANGEBOT.set(`p${i}`, i < 2 ? 0.95 : faktor);
  };

  for (const vertragsende of [true, false]) {
    it(`die KI verkauft deutlich mehr als 2 — auch unter Opt und Minimum (${vertragsende ? "Vertragsende" : "Fenster"})`, () => {
      angebote(1.5);
      const { gameState, team, players } = chrisKader("neu");
      const plan = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: players, allowBelowMin: true, vertragsende });
      expect(plan.optTarget).toBeGreaterThanOrEqual(9);
      // p4 … p11 gehen (8 Spieler, Chris: „dann verkaufe ich 8 oder so“); p0/p1 haben kein gutes Angebot, p2/p3 haelt die Tiefe.
      expect(plan.decisions.length).toBeGreaterThanOrEqual(8);
      expect(plan.finalRosterSize).toBeLessThan(IDENTITY.playerMin as number);
      const verkauft = new Set(plan.decisions.map((d) => d.playerId));
      for (const id of ["p0", "p1"]) expect(verkauft.has(id)).toBe(false);
      // Jeder Abgang traegt seine Abwaegung, im Fenster wie am Vertragsende.
      for (const d of plan.decisions) {
        expect(d.abgangsGrund).toBe("kosten_nutzen");
        expect(d.abwaegung!.vorteil).toBeGreaterThan(0);
      }
    });
  }

  it("auch unter dem Minimum bleibt es eine Kosten-Frage: Kaderdruck im Preis und Tiefenkosten beenden den Abverkauf", () => {
    // 1,25 x MW: vier gehen (bis zum Minimum 8); der naechste Abgang kostet 10 % im Preis (unter dem Minimum) und mehr Belastung.
    angebote(1.25);
    const { gameState, team, players } = chrisKader("neu");
    const plan = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: players, allowBelowMin: true, vertragsende: true });
    expect(plan.finalRosterSize).toBe(8);
    const tiefen = plan.decisions.map((d) => d.abwaegung!.tiefenKosten);
    for (let i = 1; i < tiefen.length; i++) expect(tiefen[i]).toBeGreaterThan(tiefen[i - 1]!);
  });

  it("ohne gutes Angebot verkauft dasselbe Team keinen gleich starken Stammspieler — der Wert entscheidet, nicht die Groesse", () => {
    for (let i = 0; i < 12; i++) ANGEBOT.set(`p${i}`, 1.0);
    const { gameState, team, players } = chrisKader("neu");
    const plan = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: players, allowBelowMin: true, vertragsende: true });
    expect(plan.decisions).toHaveLength(0);
  });

  it("ohne Stempel (alter Stand) bleibt es bei der Nutzen-Runde (`sellUtility`), ohne Abwaegung", () => {
    angebote(1.25);
    const alt = chrisKader("alt");
    const planAlt = planOrganicSellsForTeam({ gameState: alt.gameState, team: alt.team, identity: IDENTITY, roster: alt.players, allowBelowMin: true, vertragsende: true });
    expect(planAlt.decisions.length).toBeGreaterThan(0);
    for (const d of planAlt.decisions) {
      expect(d.abwaegung).toBeUndefined();
      expect(d.abgangsGrund).toBeUndefined();
    }
  });

  it("danach kauft die KI nach: der Kaufplaner fuellt den Rest-Kader im selben Fenster bis Opt", () => {
    const axis = { pow: 0.4, spe: 0.3, men: 0.2, soc: 0.1 } as const;
    const view = (id: string, wert: number) => {
      const q = 35 + wert * 0.6;
      return { playerId: id, pow: q, spe: q, men: q, soc: q, disciplineRatings: { tdm: q }, marketValue: wert, salary: wert * 0.15 };
    };
    const weights = deriveUtilityWeights({ ambition: 55, finances: 45, boardConfidence: 55, harmony: 50, playerOpt: 10 }, {});
    expect(weights.optTarget).toBe(10);
    // Drei Bleiber, die Kasse traegt die Erloese der neun Verkaeufe (9 x 37,5 C) plus die alte Kasse.
    const plan = buildOrganicSquadPlan({
      startingSquad: [view("p0", 30), view("p1", 30), view("p2", 30)],
      candidates: Array.from({ length: 20 }, (_, i) => view(`markt${i}`, 20 + i)),
      identityAxisWeights: axis,
      disciplines: [{ id: "tdm", category: "power" }],
      economy: {
        cash: 80 + 9 * 37.5,
        cashBuffer: 12,
        salaryTotal: 12,
        boardRisk: 0.3,
        expectedPrize: 0,
        sponsorIncome: 0,
        facilityNet: 0,
        netTransfer: 0,
        solvencyFloor: 12,
        weights,
      },
      draftSeed: "keine-groessenbremse",
      kaderplan: { gmOptGesenkt: false },
    });
    expect(plan.finalSquad.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Vertrags-Tick: keine Freigabe-Hoechstzahl, keine Halte-Signale nach Kadergroesse
// ---------------------------------------------------------------------------------------------------------------------
function tickState(schwellen: "alt" | "neu" | null, anzahl: number, gehalt = 0.5) {
  const teams = [{ teamId: "A-A", shortCode: "A-A", name: "A-A", budget: 100, cash: 100, identityId: "A-A", humanControlled: false, rosterLimit: 14, logoPath: null } as unknown as Team];
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < anzahl; i++) {
    // Gehalt 0,5 bei Forderung 3: die Gehaltsforderung steigt zu stark (`salaryRisk`), die KI gibt frei — ein Wert-Urteil.
    players.push({
      id: `s${i}`, name: `s${i}`, rating: 50, marketValue: 10, salaryDemand: 3, displayMarketValue: 10, displaySalary: 3, className: "Hero", race: "Human",
      alignment: "N", gender: "f", subclasses: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
      preferredDisciplineIds: [], disciplineRatings: { climb: 45 }, fatigue: 0, form: 0, potential: 0,
    } as unknown as Player);
    rosters.push({ id: `roster:A-A:s${i}`, teamId: "A-A", playerId: `s${i}`, contractLength: 1, salary: gehalt, upkeep: gehalt, purchasePrice: 10, currentValue: 10, roleTag: "bench", joinedSeasonId: "season-1" } as RosterEntry);
  }
  const gameState = {
    gamePhase: "season_end_management",
    season: { id: "season-2", name: "Season 2", year: 2026, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: { "A-A": { points: 0 } },
      teamControlSettings: { "A-A": { teamId: "A-A", controlMode: "ai", ownerId: "ai", ownerSlot: "ai", displayLabel: "A-A" } },
      ...(schwellen ? { wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-2"), verkaufSchwellen: schwellen } } : {}),
    },
    matchdayState: { matchdayId: "matchday-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: [{ teamId: "A-A", playerMin: 8, playerOpt: 12 } as unknown as TeamIdentity],
    players,
    disciplines: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
    logs: [],
    mappingReport: { warnings: [] },
  } as unknown as GameState;
  return { saveId: "keine-groessenbremse", name: "t", status: "active", createdAt: "", updatedAt: "", gameState } as never;
}

describe("Vertrags-Tick ohne Kadergroessen-Bremse (Stempel `verkaufSchwellen`)", () => {
  it("Kader 7 unter Minimum 8: ohne Stempel ist die Kadergroesse der Grund zu verlaengern, mit Stempel die Kosten-Rechnung", () => {
    // Gehalt 3 = Forderung: verlaengern ist billiger als ersetzen — die KI behaelt sie, aber wegen des Werts, nicht der Groesse.
    const ohne = computeSeasonEndContractTick(tickState("alt", 7, 3));
    const mit = computeSeasonEndContractTick(tickState("neu", 7, 3));
    const gruende = (t: typeof ohne) => (t.gameState.seasonState.contractEvents ?? []).map((e) => e.decisionReason);
    expect(gruende(ohne)).toContain("hard_min_retention");
    expect(gruende(mit)).not.toContain("hard_min_retention");
    expect(mit.renewedPlayers).toBe(7);
    for (const g of gruende(mit)) expect(["tco_prefers_renew", "heuristic_renew"]).toContain(g);
  });

  it("keine Freigabe-Hoechstzahl: mit Stempel gehen alle freigegebenen, ohne Stempel hoechstens 3 (der Rest wird brueckenverlaengert)", () => {
    const ohne = computeSeasonEndContractTick(tickState("alt", 13));
    const mit = computeSeasonEndContractTick(tickState("neu", 13));
    const abgaenge = (t: typeof ohne) => (t.gameState.seasonState.contractEvents ?? []).filter((e) => e.eventType === "contract_expired_exit").length;
    expect(abgaenge(ohne)).toBeLessThanOrEqual(3);
    expect(abgaenge(mit)).toBeGreaterThan(3);
  });
});

describe("Vertragsaufloesung: ein Kader unter Opt macht den Spieler nicht wertvoller (Stempel)", () => {
  const basis = {
    offer: {
      teamId: "A-A", playerId: "p1", playerName: "p1", salePrice: 20, payableBuyout: 4, morale: 30, seasonId: "season-2",
      remainingYears: 2, waivedBuyout: 2, previouslyDeclined: false,
    },
    marketValue: 30,
    salary: 6,
    remainingYears: 2,
    purchasePrice: 20,
    qualityShareInTeam: 0.5,
    ratingValue: 30,
    rosterBefore: 6,
    playerMin: 8,
    playerOpt: 12,
    cashBefore: 50,
    renewal: null,
  } as unknown as Parameters<typeof decideAiContractDissolution>[0];

  it("rosterFactor hoechstens 1 mit Stempel, bis 1,45 ohne", () => {
    expect(decideAiContractDissolution(basis).rosterFactor).toBeGreaterThan(1);
    expect(decideAiContractDissolution({ ...basis, ohneKadergroessenBremse: true }).rosterFactor).toBeLessThanOrEqual(1);
    // Ueber Opt bleibt der Abschlag (Ueberschuss darf leichter gehen).
    expect(decideAiContractDissolution({ ...basis, rosterBefore: 16, ohneKadergroessenBremse: true }).rosterFactor).toBeLessThan(1);
  });
});

describe("Fenster-Grenze max(8, playerMin) gilt mit Stempel nicht (Quellpruefung)", () => {
  const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");
  it("Verkaufsrunde und Verkaufsabsicht fragen den Stempel", () => {
    expect(quelle("lib/ai/ai-transfer-window-session-service.ts")).toContain(
      'if (input.sellNotBelowMin && wirtschaftsRegel(gameState, "verkaufSchwellen") !== "neu") {',
    );
    expect(quelle("lib/contracts/ki-verkaufsabsicht-saisonende.ts")).toContain(
      'if (istTransferfensterGemeinsam() && !istFensterAufOpt() && wirtschaftsRegel(gameState, "verkaufSchwellen") !== "neu") {',
    );
  });
  it("die Konstante ABGANG_UNTER_OPT_MAX ist weg", () => {
    expect(quelle("lib/ai/organic-squad/draft-adapter.ts")).not.toContain("ABGANG_UNTER_OPT_MAX");
  });
});
