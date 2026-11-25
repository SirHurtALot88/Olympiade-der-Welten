/**
 * TEAM-BLICK: Verkauf und Nachkauf als ein Plan; Kredit nach Risikobereitschaft (Chris 25.11.),
 * docs/design/verkauf-restgehalt-24-11.md Abschnitt 10.
 *
 * Woertlich: „es gibt keinen team blick darauf der sagt ok ich hab jetzt 2 leute unter wert verkauft vllt sollte ich dann doch meinen
 * starken teuren player verkaufen wenn der n gutes angebot hat um das zu kompensieren und mich neu aufzustellen ODER teams die knapp bei
 * kasse sind müssten verkaufen damit sie vllt 1 teuren spieler verkaufen um 2 mittlere zu holen - oder nen mittleren oder günstigen
 * verkaufen und nicht nachbesetzen um cash zu generieren“ — und zum Kredit: „wenn sie das geld noch haben benötigen sie den kredit
 * nicht, wenn kein geld da ist aber es die lage vom team verbessert hängt das auch bisschen von der risikobereitschaft des teams ab“.
 *
 * Die Waechter, je einer fuer Chris' drei Faelle und den Risiko-Kredit:
 *  1. Bilanz-Ausgleich: wer schon unter Wert abgab, nimmt einen Gewinnverkauf mit, den er sonst liesse.
 *  2. Umbau „1 teuer → 2 mittel“: der teure Spieler mit gutem Angebot geht, wenn der Kaufplaner mit dem Erloes mehr Staerke kauft.
 *  3. Cash-Verkauf: ein Team knapp bei Kasse verkauft einen mittleren Spieler, den ein reiches Team behaelt.
 *  4. Risiko-Kredit: fehlt Geld fuer den Opt, leiht ein mutiges Team, ein vorsichtiges nicht, ein Team mit Geld auch nicht.
 */
import { describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

/** Angebotsfaktor je Spieler (Preis / Marktwert vor Kaderdruck); vom Test gesetzt. */
const ANGEBOT = new Map<string, number>();

vi.mock("@/lib/market/transfermarkt-sell-pricing-policy", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/market/transfermarkt-sell-pricing-policy")>();
  return {
    ...original,
    applySellPricingPolicyToBreakdown: (input: Parameters<typeof original.applySellPricingPolicyToBreakdown>[0]) => {
      const mw = input.baseBreakdown.baseMarketValue ?? 0;
      const preis = Math.round(mw * (ANGEBOT.get(input.player?.id ?? "") ?? 1) * 100) / 100;
      return {
        policy: { seasonStartDiscount: 1, timingMultiplier: 1, liquidationMalus: 1, identityFitMultiplier: 1, combinedMultiplier: 1, notes: [] },
        preFloorSalePrice: preis,
        floorApplied: false,
        breakdown: { ...input.baseBreakdown, salePrice: preis },
      };
    },
  };
});

const { verkaufsAbwaegung } = await import("@/lib/ai/organic-squad/utility");
const { planOrganicSellsForTeam } = await import("@/lib/ai/organic-squad/draft-adapter");
const { kreditRisikoBereitschaft, resolveAiLoanDecision, RISIKO_KREDIT_SCHWELLE } = await import("@/lib/ai/ai-loan-decision-service");
const { wirtschaftsRegelnFuerNeueSaison } = await import("@/lib/resolve/wirtschafts-regeln");

const abw = (o: Partial<Parameters<typeof verkaufsAbwaegung>[0]>) =>
  verkaufsAbwaegung({
    marktwert: 20,
    preis: 20,
    restgehalt: 0,
    gehalt: 5.4,
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

describe("1. Bilanz-Ausgleich: nach zwei Abgaengen unter Wert wird ein guter Deal mitgenommen", () => {
  it("ein knapper Gewinnverkauf, der fuer sich nicht reicht, kippt mit Buchverlust in der Runde", () => {
    // Leistungstraeger 20 C, Staerke 1,1 x Median, Angebot 24 C: allein knapp negativ.
    const allein = abw({ preis: 24, staerkeVerhaeltnis: 1.1 });
    expect(allein.vorteil).toBeLessThan(0);
    // Zwei Abgaenge unter Wert (−3 und −4 C) davor: der Gewinn gleicht aus.
    const mitBilanz = abw({ preis: 24, staerkeVerhaeltnis: 1.1, buchBilanz: -7 });
    expect(mitBilanz.ausgleich).toBeGreaterThan(0);
    expect(mitBilanz.vorteil).toBeGreaterThan(0);
    // Ohne Gewinn (Angebot unter MW) gibt es keinen Ausgleich.
    expect(abw({ preis: 18, buchBilanz: -7 }).ausgleich).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Planer-Faelle mit Markt
// ---------------------------------------------------------------------------------------------------------------------
const IDENTITY = {
  teamId: "team-test",
  ambition: 55,
  finances: 45,
  boardConfidence: 55,
  harmony: 50,
  playerMin: 8,
  playerOpt: 10,
  pow: 25,
  spe: 25,
  men: 25,
  soc: 25,
} as unknown as TeamIdentity;

function spieler(id: string, q: number, mw: number): Player {
  return {
    id,
    name: id,
    coreStats: { pow: q, spe: q, men: q, soc: q },
    disciplineRatings: { tdm: q, staffel: q },
    marketValue: mw,
    salaryDemand: Math.round(mw * 0.27 * 10) / 10,
    potential: 0,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
  } as unknown as Player;
}

function welt(input: { kader: Player[]; markt: Player[]; cash: number }) {
  const rosters: RosterEntry[] = input.kader.map((p, i) => ({
    id: `r${i}`,
    teamId: "team-test",
    playerId: p.id,
    contractLength: 1,
    salary: p.salaryDemand,
    upkeep: p.salaryDemand,
    purchasePrice: p.marketValue,
    currentValue: p.marketValue,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  })) as unknown as RosterEntry[];
  const team = { teamId: "team-test", name: "T", shortCode: "T", cash: input.cash, rosterLimit: 20, budget: 100, identityId: "team-test", humanControlled: false } as unknown as Team;
  const gameState = {
    gamePhase: "season_active",
    season: { id: "season-1", name: "S1", currentMatchday: 20, matchdayIds: [] },
    matchdayState: { matchdayId: "season-1-md-20", status: "resolved" },
    teams: [team],
    players: [...input.kader, ...input.markt],
    rosters,
    teamIdentities: [IDENTITY],
    disciplines: [
      { id: "tdm", category: "power" },
      { id: "staffel", category: "speed" },
    ],
    transferHistory: [],
    seasonState: {
      seasonId: "season-1",
      seasonSnapshots: [],
      sponsorPayoutLogs: [{ seasonId: "season-1", teamId: "team-test", componentId: "salary_deduct" }],
      wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-1"), kernschutz: "neu", restgehalt: "neu", verkaufSchwellen: "neu" },
    },
  } as unknown as GameState;
  return { gameState, team };
}

describe("2. Umbau „1 teuer → 2 mittel“ mit dem Kaufplaner", () => {
  // 11 Spieler: ein teurer (MW 60, Qualitaet 70, Angebot 1,15 x MW), zehn um Qualitaet 55. Der Markt hat viele gute mittlere Spieler
  // (Qualitaet 66 fuer 24 C): fuer 69 C Erloes holt der Planer zwei, die den Kader staerker machen als der eine teure.
  const kader = [spieler("star", 70, 60), ...Array.from({ length: 10 }, (_, i) => spieler(`k${i}`, 55 - i * 0.3, 18))];
  const markt = [
    ...Array.from({ length: 12 }, (_, i) => spieler(`mittel${i}`, 66 - i * 0.2, 24)),
    ...Array.from({ length: 12 }, (_, i) => spieler(`billig${i}`, 45, 8 + i * 0.1)),
    ...Array.from({ length: 4 }, (_, i) => spieler(`teuer${i}`, 72, 80 + i)),
  ];

  it("mit gutem Angebot und gutem Markt geht der Teure als Umbau, der Plan kauft mindestens zwei und ist staerker als Halten", () => {
    ANGEBOT.set("star", 1.15);
    const { gameState, team } = welt({ kader, markt, cash: 20 });
    const plan = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: kader, allowBelowMin: true, marktKandidaten: markt });
    const umbau = plan.decisions.find((d) => d.abgangsGrund === "umbau");
    expect(umbau?.playerId).toBe("star");
    expect(umbau!.umbau!.kaeufe).toBeGreaterThanOrEqual(2);
    expect(umbau!.umbau!.wert).toBeGreaterThan(umbau!.umbau!.haltenWert!);
    ANGEBOT.clear();
  });

  it("ohne Angebot ueber dem Marktwert gibt es keinen Umbau, und ohne Markt auch nicht", () => {
    ANGEBOT.set("star", 0.95);
    const { gameState, team } = welt({ kader, markt, cash: 20 });
    const ohneAngebot = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: kader, allowBelowMin: true, marktKandidaten: markt });
    expect(ohneAngebot.decisions.some((d) => d.abgangsGrund === "umbau")).toBe(false);
    ANGEBOT.set("star", 1.15);
    const ohneMarkt = planOrganicSellsForTeam({ gameState, team, identity: IDENTITY, roster: kader, allowBelowMin: true, marktKandidaten: [] });
    expect(ohneMarkt.decisions.some((d) => d.playerId === "star")).toBe(false);
    ANGEBOT.clear();
  });
});

describe("3. Cash-Verkauf ohne Nachbesetzung: knapp bei Kasse", () => {
  it("ein Team knapp bei Kasse verkauft einen mittleren Spieler zum Marktwert, ein reiches behaelt ihn", () => {
    const kader = Array.from({ length: 13 }, (_, i) => spieler(`k${i}`, 60 - i, 20));
    const knapp = welt({ kader, markt: [], cash: 6 });
    const reich = welt({ kader, markt: [], cash: 300 });
    const planKnapp = planOrganicSellsForTeam({ gameState: knapp.gameState, team: knapp.team, identity: IDENTITY, roster: kader, allowBelowMin: true, marktKandidaten: [] });
    const planReich = planOrganicSellsForTeam({ gameState: reich.gameState, team: reich.team, identity: IDENTITY, roster: kader, allowBelowMin: true, marktKandidaten: [] });
    expect(planKnapp.decisions.length).toBeGreaterThan(planReich.decisions.length);
    expect(planKnapp.decisions.some((d) => d.abgangsGrund === "cash_verkauf")).toBe(true);
    // Die Tiefe traegt es: der knappe Kader bleibt spielfaehig.
    expect(planKnapp.finalRosterSize).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 4. Risiko-Kredit
// ---------------------------------------------------------------------------------------------------------------------
function kreditLage(input: { cash: number; kader: number; opt: number; riskTolerance: number; cashPriority: number; stempel?: boolean }): GameState {
  const teamId = "T-1";
  const rosters = Array.from({ length: input.kader }, (_, i) => ({ id: `r${i}`, teamId, playerId: `p${i}`, salary: 3, upkeep: 3, contractLength: 2, currentValue: 15 }));
  const players = Array.from({ length: input.kader }, (_, i) => ({ id: `p${i}`, name: `P${i}`, marketValue: 15, displayMarketValue: 15, rating: 55, fatigue: 20, salary: 3 }));
  return {
    season: { id: "season-2", name: "season-2", year: 2028, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: { [teamId]: { points: 0 } },
      loans: [],
      loanApplyLogs: [],
      sponsorPayoutLogs: [
        { id: "payout-1", saveId: "save-1", seasonId: "season-2", teamId, phase: "season_end", componentId: "base", cashDelta: 80, action: "apply", createdAt: "2027-01-01T00:00:00.000Z" },
      ],
      aiManagerBudgetReservations: {},
      teamStrategyProfiles: {
        [teamId]: {
          teamId,
          strategySummary: "Test",
          preferredArchetypes: [],
          secondaryArchetypes: [],
          bias: {
            cashPriority: input.cashPriority, valuePriority: 5, starPriority: 5, riskTolerance: input.riskTolerance, wageSensitivity: 5,
            sellForProfitAggression: 5, shortContractPreference: 5, longContractPreference: 5, loyaltyBias: 5, harmonyStrictness: 5,
            rosterDepthPreference: 5, eliteSmallRosterPreference: 5,
          },
        },
      },
      ...(input.stempel === false ? {} : { wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-2"), verkaufSchwellen: "neu" } }),
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, shortCode: "T-1", name: "Team", budget: input.cash, cash: input.cash, rosterLimit: 14 }],
    teamIdentities: [{ teamId, playerMin: 8, playerOpt: input.opt, playerMax: 14, finances: 5, ambition: 5 }],
    players,
    disciplines: [],
    disciplineSchedule: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: { warnings: [] },
  } as unknown as GameState;
}

describe("4. Risiko-Kredit nach Risikobereitschaft", () => {
  // Kader 11 bei Opt 12: ueber der Zwischenstufe (Min + halber Weg), der bedarfsgetriebene Kredit sagt `no_need`.
  it("fehlt Geld fuer den Opt, leiht ein mutiges Team (Grund risk_driven_borrow), ein vorsichtiges nicht", () => {
    const mutig = kreditLage({ cash: 2, kader: 11, opt: 12, riskTolerance: 9, cashPriority: 2 });
    const vorsichtig = kreditLage({ cash: 2, kader: 11, opt: 12, riskTolerance: 2, cashPriority: 8 });
    expect(kreditRisikoBereitschaft(mutig, "T-1")).toBeGreaterThanOrEqual(RISIKO_KREDIT_SCHWELLE);
    expect(kreditRisikoBereitschaft(vorsichtig, "T-1")).toBeLessThan(RISIKO_KREDIT_SCHWELLE);
    const m = resolveAiLoanDecision(mutig, "T-1");
    expect(m.shouldBorrow).toBe(true);
    expect(m.reason).toBe("risk_driven_borrow");
    expect(resolveAiLoanDecision(vorsichtig, "T-1").shouldBorrow).toBe(false);
  });

  it("wer das Geld hat, kauft ohne Kredit; ohne Stempel bleibt es beim bedarfsgetriebenen Kredit", () => {
    expect(resolveAiLoanDecision(kreditLage({ cash: 400, kader: 11, opt: 12, riskTolerance: 9, cashPriority: 2 }), "T-1").shouldBorrow).toBe(false);
    const ohneStempel = resolveAiLoanDecision(kreditLage({ cash: 2, kader: 11, opt: 12, riskTolerance: 9, cashPriority: 2, stempel: false }), "T-1");
    expect(ohneStempel.shouldBorrow).toBe(false);
    expect(ohneStempel.reason).toBe("no_need");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 5. Qualitaetstausch mit Risiko-Kredit (PM 25.11.): Team auf Ziel, klar besserer Spieler am Markt, Geld fehlt
// ---------------------------------------------------------------------------------------------------------------------
describe("5. Qualitaetstausch mit Risiko-Kredit ueber den Umbau-Weg", () => {
  function tauschWelt(riskTolerance: number, cashPriority: number) {
    const kader = [spieler("schwach", 35, 8), ...Array.from({ length: 9 }, (_, i) => spieler(`k${i}`, 55 - i * 0.2, 18))];
    const markt = [
      ...Array.from({ length: 6 }, (_, i) => spieler(`top${i}`, 78 - i * 0.2, 45 + i)),
      ...Array.from({ length: 20 }, (_, i) => spieler(`fueller${i}`, 40, 6 + i * 0.1)),
    ];
    const { gameState, team } = welt({ kader, markt, cash: 5 });
    const bias = {
      cashPriority, valuePriority: 5, starPriority: 5, riskTolerance, wageSensitivity: 5, sellForProfitAggression: 5, shortContractPreference: 5,
      longContractPreference: 5, loyaltyBias: 5, harmonyStrictness: 5, rosterDepthPreference: 5, eliteSmallRosterPreference: 5,
    };
    const gs = {
      ...gameState,
      season: { id: "season-2", name: "S2", currentMatchday: 0, matchdayIds: [] },
      seasonState: {
        ...gameState.seasonState,
        seasonId: "season-2",
        // Gehalt der Saison gebucht: Ein-Jahres-Vertraege ohne Restgehalt (Vertragsende).
        sponsorPayoutLogs: [{ seasonId: "season-2", teamId: "team-test", componentId: "salary_deduct" }],
        loans: [],
        teamStrategyProfiles: { "team-test": { teamId: "team-test", strategySummary: "t", preferredArchetypes: [], secondaryArchetypes: [], bias } },
        wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-2"), kernschutz: "neu", restgehalt: "neu", verkaufSchwellen: "neu" },
      },
    } as unknown as GameState;
    return { gameState: gs, team, kader, markt };
  }

  it("ein mutiges Team gibt (nach den Einzelabgaengen) seinen Schwaechsten ab und plant den Kauf eines klar Besseren mit Kredit; ein vorsichtiges nicht", () => {
    const mutig = tauschWelt(9, 2);
    const planMutig = planOrganicSellsForTeam({ gameState: mutig.gameState, team: mutig.team, identity: IDENTITY, roster: mutig.kader, allowBelowMin: true, marktKandidaten: mutig.markt });
    const tausch = planMutig.decisions.find((d) => d.abgangsGrund === "tausch_kredit");
    expect(tausch).toBeDefined();
    // Der Tausch trifft den schwaechsten Verbliebenen (der ganz schwache ging schon in der Einzelabwaegung), keinen Kernspieler.
    expect(["schwach", "k5", "k6", "k7", "k8"]).toContain(tausch!.playerId);
    expect(tausch!.umbau!.kredit).toBeGreaterThan(0);
    expect(tausch!.umbau!.kreditKosten).toBeGreaterThan(0);
    // Klarer Staerke-Gewinn der besten 6 gegenueber Halten, Zinsen eingerechnet.
    expect(tausch!.umbau!.staerke).toBeGreaterThan(tausch!.umbau!.haltenStaerke!);
    const vorsichtig = tauschWelt(2, 8);
    const planVorsichtig = planOrganicSellsForTeam({ gameState: vorsichtig.gameState, team: vorsichtig.team, identity: IDENTITY, roster: vorsichtig.kader, allowBelowMin: true, marktKandidaten: vorsichtig.markt });
    expect(planVorsichtig.decisions.some((d) => d.abgangsGrund === "tausch_kredit")).toBe(false);
  });
});
