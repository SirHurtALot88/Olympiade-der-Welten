/**
 * VERKAUF ALS KOSTEN-NUTZEN-ABWAEGUNG (Chris 24.11.), docs/design/verkauf-restgehalt-24-11.md Abschnitt 9.
 *
 * Woertlich (gekuerzt): „Du hast einen Spieler, der 10 Millionen kostet. Und den wuerdest du jetzt fuer 11 verkaufen, wenn er … krass
 * performt hat. Das waere doch total daemlich. … Klar, wenn das Angebot so unverschaemt gut ist, dass du richtig viel Kohle damit
 * machst, dann lohnt sich das auch. … es muessen ja auch mal Spieler verkauft werden, die unter Marktwert sind … Es muss halt moeglich
 * sein, auch zum Beispiel 8 Spieler zu verkaufen, die alle ein gutes Angebot haben und vielleicht kaufst du dir dafuer 12 neue.“
 *
 * Die Waechter:
 *  1. Die drei Zahlenbeispiele der Doku an der reinen Abwaegung (`verkaufsAbwaegung`).
 *  2. Kadertiefe ist eine Kostenkurve, keine Grenze; Finanznot und Team-Charakter verschieben die Linie.
 *  3. Chris' 8-raus/12-rein: im Planer gehen bei vielen richtig guten Angeboten 8 von 12, der Kaufplaner hebt das Ziel ueber die
 *     Tiefen-Aufstockung und kauft reichlich nach.
 */
import { describe, expect, it, vi } from "vitest";

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
        breakdown: { ...input.baseBreakdown, salePrice: preis },
      };
    },
  };
});

const { verkaufsAbwaegung, VERKAUFS_ABWAEGUNG } = await import("@/lib/ai/organic-squad/utility");
const { planOrganicSellsForTeam, planeTiefenAufstockung, TIEFE_AUFSTOCKUNG_MAX } = await import("@/lib/ai/organic-squad/draft-adapter");
const { buildOrganicSquadPlan } = await import("@/lib/ai/organic-squad/draft-builder");
const { deriveUtilityWeights } = await import("@/lib/ai/organic-squad/weights");
const { wirtschaftsRegelnFuerNeueSaison } = await import("@/lib/resolve/wirtschafts-regeln");

/** Neutrales Team (wWin 1, wProfit 0,1), Kader 12, 8 Spieler je Spieltag, Gehalt 0,27 x MW (Median der Liga). */
const abw = (o: Partial<Parameters<typeof verkaufsAbwaegung>[0]>) =>
  verkaufsAbwaegung({
    marktwert: 10,
    preis: 10,
    restgehalt: 0,
    gehalt: 2.7,
    leistungsFaktor: 1,
    staerkeVerhaeltnis: 1,
    kaderVorher: 12,
    spieltagsBedarf: 8,
    finanznot: false,
    wWin: 1,
    wProfit: 0.1,
    zufall: 0.5,
    ...o,
  });

describe("Zahlenbeispiele (Doku Abschnitt 9)", () => {
  // Top-Performer: 10 C MW, hat im Bracket ueberperformt (Leistungsfaktor 1,2), Staerke 1,25 x Kader-Median.
  const top = { marktwert: 10, gehalt: 2.7, leistungsFaktor: 1.2, staerkeVerhaeltnis: 1.25 };

  it("Top-Performer 10 C MW zu 11 C: bleibt — 1 C Gewinn deckt weder Ersatz noch Gehalt", () => {
    const a = abw({ ...top, preis: 11 });
    expect(a.vorteil).toBeLessThan(-4);
    // Der Haltewert liegt deutlich ueber dem Marktwert: Leistung (halb bestaendig) und Bedeutung im Team.
    expect(a.halteWert).toBeCloseTo(10 * (1 + VERKAUFS_ABWAEGUNG.LEISTUNG_OBEN * 0.2) * 1.25, 6);
  });

  it("Top-Performer zu 18 C: geht — das Angebot ist so gut, dass es Ersatz, Risiko und Tiefe bezahlt", () => {
    expect(abw({ ...top, preis: 18 }).vorteil).toBeGreaterThan(0);
    // Die Linie liegt bei rund 15,3 C (gut 1,5 x MW), passend zum Kernschutz 1,5 / 1,4 / 1,3.
    expect(abw({ ...top, preis: 14.5 }).vorteil).toBeLessThan(0);
  });

  it("schwacher Spieler 6 C MW zu 4 C: darf gehen — Verkauf unter Marktwert, kleiner Verlust, Gehalt gespart", () => {
    const a = abw({ marktwert: 6, gehalt: 1.62, preis: 4, leistungsFaktor: 0.67, staerkeVerhaeltnis: 0.75 });
    expect(a.vorteil).toBeGreaterThan(0);
    expect(a.erloes).toBeLessThan(6);
    expect(a.gehaltsBilanz).toBeGreaterThan(0);
  });

  it("Verlustscheu: ein kleiner Verlust in C geht, ein grosser kaum (derselbe schwache Spieler bei 20 C MW zu 13,3 C)", () => {
    const klein = abw({ marktwert: 6, gehalt: 1.62, preis: 4, leistungsFaktor: 0.67, staerkeVerhaeltnis: 0.75 });
    const gross = abw({ marktwert: 20, gehalt: 5.4, preis: 13.3, leistungsFaktor: 0.67, staerkeVerhaeltnis: 0.75 });
    expect(klein.verlustScheu).toBeLessThan(0.5);
    expect(gross.verlustScheu).toBeGreaterThan(1.5);
    expect(gross.verlustScheu / (20 - 13.3)).toBeGreaterThan(klein.verlustScheu / 2);
    // In Finanznot zaehlt der Verlust nicht als Scheu.
    expect(abw({ marktwert: 20, gehalt: 5.4, preis: 13.3, finanznot: true }).verlustScheu).toBe(0);
  });

  it("Mittelfeld ohne Ueberleistung zum Marktwert: bleibt; ab etwa 1,1 x MW lohnt es sich (Chris 25.11.: haeufiger Gewinne mitnehmen)", () => {
    const mitte = { marktwert: 20, gehalt: 5.4 };
    expect(abw({ ...mitte, preis: 20 }).vorteil).toBeLessThan(0);
    expect(abw({ ...mitte, preis: 21 }).vorteil).toBeLessThan(0);
    expect(abw({ ...mitte, preis: 23 }).vorteil).toBeGreaterThan(0);
  });
});

describe("Kadertiefe, Finanzlage, Charakter", () => {
  it("Kadertiefe ist eine Kostenkurve: klein bei 12 bis 14, steil unter 8 — nie eine Sperre", () => {
    const tiefe = (kader: number) => abw({ kaderVorher: kader }).tiefenKosten;
    expect(tiefe(14)).toBeLessThan(0.3);
    expect(tiefe(12)).toBeLessThan(tiefe(10));
    expect(tiefe(8)).toBeLessThan(tiefe(6));
    expect(tiefe(5)).toBeGreaterThan(5);
    // Ein unverschaemtes Angebot traegt auch den Abgang unter 6.
    expect(abw({ kaderVorher: 5, preis: 30 }).vorteil).toBeGreaterThan(0);
  });

  it("Finanznot: Geld ist mehr wert (Liquiditaet), die Marge faellt weg", () => {
    const normal = abw({ preis: 11 });
    const not = abw({ preis: 11, finanznot: true });
    expect(not.liquiditaet).toBeCloseTo(VERKAUFS_ABWAEGUNG.LIQUIDITAET * 11, 6);
    expect(not.marge).toBe(0);
    expect(not.vorteil).toBeGreaterThan(normal.vorteil);
  });

  it("Charakter: ein Haendler (wProfit) verkauft eher als ein ehrgeiziges Team (wWin); das Bauchgefuehl streut", () => {
    expect(abw({ preis: 12, wProfit: 1.7 }).vorteil).toBeGreaterThan(abw({ preis: 12, wWin: 2.4 }).vorteil);
    expect(abw({ preis: 12, zufall: 0.95 }).vorteil).toBeGreaterThan(abw({ preis: 12, zufall: 0.05 }).vorteil);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Chris' 8-raus/12-rein im Planer
// ---------------------------------------------------------------------------------------------------------------------
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

/** 12 Spieler (p0 der beste), Ein-Jahres-Vertraege am Vertragsende: kein Restgehalt. */
function kader() {
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
    rosters.push({ id: `r${i}`, teamId: "team-test", playerId: pid, contractLength: 1, salary: 4, upkeep: 4, purchasePrice: 30, currentValue: 30, joinedSeasonId: "season-1" } as RosterEntry);
  }
  const team = { teamId: "team-test", name: "T", shortCode: "T", cash: 80, rosterLimit: 20, budget: 100, identityId: "team-test", humanControlled: false } as unknown as Team;
  const gameState = {
    gamePhase: "season_active",
    season: { id: "season-1", name: "S1", currentMatchday: 20, matchdayIds: [] },
    matchdayState: { matchdayId: "season-1-md-20", status: "resolved" },
    teams: [team],
    players,
    rosters,
    teamIdentities: [IDENTITY],
    disciplines: [{ id: "tdm", category: "power" }],
    seasonState: {
      seasonId: "season-1",
      seasonSnapshots: [],
      sponsorPayoutLogs: [{ seasonId: "season-1", teamId: "team-test", componentId: "salary_deduct" }],
      wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-1"), kernschutz: "neu", restgehalt: "neu", verkaufSchwellen: "neu", vertragsPlan: "alt" },
    },
  } as unknown as GameState;
  return { gameState, team, players };
}

describe("Chris' 8-raus/12-rein: viele richtig gute Angebote", () => {
  it("bei 1,5 x MW fuer zehn Spieler gehen 8 von 12 — unter Opt und Minimum, jeder mit positivem Vorteil", () => {
    for (let i = 0; i < 12; i++) ANGEBOT.set(`p${i}`, i < 2 ? 0.95 : 1.5);
    const { gameState, team, players } = kader();
    for (const vertragsende of [true, false]) {
      const plan = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: players, allowBelowMin: true, vertragsende });
      expect(plan.decisions.length).toBe(8);
      expect(plan.finalRosterSize).toBe(4);
      for (const d of plan.decisions) {
        expect(d.abgangsGrund).toBe("kosten_nutzen");
        expect(d.abwaegung!.vorteil).toBeGreaterThan(0);
      }
      const verkauft = new Set(plan.decisions.map((d) => d.playerId));
      for (const id of ["p0", "p1"]) expect(verkauft.has(id)).toBe(false); // kein gutes Angebot
    }
    ANGEBOT.clear();
  });

  it("danach plant der GM mehr Tiefe (Ziel 10 -> 12) und kauft reichlich nach: 8 raus, mindestens 8 rein", () => {
    // Die Tiefen-Aufstockung: 8 Spieler je Spieltag, Rahmen traegt (Kasse aus 8 Verkaeufen) — Opt 10 -> 12.
    const aufstockung = planeTiefenAufstockung({ opt: 10, identitaetsOpt: 10, rosterMax: 14, spieltagsBedarf: 8, bias: null, traegt: () => true });
    expect(aufstockung.opt).toBe(10 + TIEFE_AUFSTOCKUNG_MAX);
    const axis = { pow: 0.4, spe: 0.3, men: 0.2, soc: 0.1 } as const;
    const view = (id: string, wert: number) => {
      const q = 35 + wert * 0.6;
      return { playerId: id, pow: q, spe: q, men: q, soc: q, disciplineRatings: { tdm: q }, marketValue: wert, salary: wert * 0.27 };
    };
    const weights = { ...deriveUtilityWeights({ ambition: 55, finances: 45, boardConfidence: 55, harmony: 50, playerOpt: 10 }, {}), optTarget: aufstockung.opt };
    const plan = buildOrganicSquadPlan({
      startingSquad: [view("p0", 30), view("p1", 30), view("p2", 30), view("p3", 30)],
      candidates: Array.from({ length: 24 }, (_, i) => view(`markt${i}`, 14 + i)),
      identityAxisWeights: axis,
      disciplines: [{ id: "tdm", category: "power" }],
      economy: {
        cash: 80 + 8 * 45,
        cashBuffer: 12,
        salaryTotal: 16,
        boardRisk: 0.3,
        expectedPrize: 0,
        sponsorIncome: 0,
        facilityNet: 0,
        netTransfer: 0,
        solvencyFloor: 12,
        weights,
      },
      draftSeed: "acht-raus-zwoelf-rein",
      kaderplan: { gmOptGesenkt: false },
    });
    expect(plan.finalSquad.length - 4).toBeGreaterThanOrEqual(8);
    expect(plan.finalSquad.length).toBeGreaterThanOrEqual(12);
  });

  it("ohne Geld (Rahmen traegt nicht) bleibt das Ziel; ein Elite-GM stockt weniger auf, ein Tiefen-GM mehr", () => {
    expect(planeTiefenAufstockung({ opt: 10, identitaetsOpt: 10, rosterMax: 14, spieltagsBedarf: 8, bias: null, traegt: () => false }).opt).toBe(10);
    // Belastungsziel 0,62: bei Opt 13 liegt die Einsatzquote 8/13 = 0,615 schon darunter — keine Aufstockung.
    expect(planeTiefenAufstockung({ opt: 13, identitaetsOpt: 13, rosterMax: 14, spieltagsBedarf: 8, bias: null, traegt: () => true }).opt).toBe(13);
    const elite = planeTiefenAufstockung({ opt: 11, identitaetsOpt: 11, rosterMax: 14, spieltagsBedarf: 8, bias: { eliteSmallRosterPreference: 10 }, traegt: () => true });
    const tiefe = planeTiefenAufstockung({ opt: 11, identitaetsOpt: 11, rosterMax: 14, spieltagsBedarf: 8, bias: { rosterDepthPreference: 10 }, traegt: () => true });
    expect(elite.opt).toBeLessThan(tiefe.opt);
    expect(tiefe.opt).toBeLessThanOrEqual(14);
  });
});
