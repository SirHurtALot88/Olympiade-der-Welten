/**
 * VERKAUF MIT RESTGEHALT (24.11., docs/design/verkauf-restgehalt-24-11.md).
 *
 * Gemessen (32 KI, Saat 1, Fenster vor Saison 2): 50 KI-Verkaeufe trugen 330,73 C Restgehalt-Abloese bei 704,65 C Erloes.
 * Alle 50 Spieler hatten in Saison 1 einen Ein-Jahres-Vertrag, wurden im Vertrags-Tick um 1 bis 4 Jahre verlaengert und
 * gleich im naechsten Fenster verkauft — die Abloese war das Restgehalt des GERADE unterschriebenen Vertrags.
 *
 * Die Waechter hier:
 *  1. Der Tick verlaengert keinen auslaufenden Vertrag, den die KI im naechsten Fenster verkaufen wuerde; der Abgang ist
 *     ein abloesefreier Verkauf am Vertragsende (Erloes ohne Buyout), und er zaehlt nicht gegen die Freigabe-Bremse.
 *  2. Fuer einen Spieler, dessen Verkauf ohnehin geplant ist, nimmt die KI eine Vertragsaufloesung an (Teilverzicht statt
 *     vollem Rest-Buyout).
 *  3. Die Verkaufspruefung der KI rechnet mit dem Erloes NACH Rest-Buyout (Stempel `restgehalt`).
 *  4. Die Verkaufsabsicht am Saisonende ist genau der Plan der Verkaufsrunde, und ohne Stempel leer.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { computeSeasonEndContractTick } from "@/lib/contracts/contract-renewal-service";
import { ermittleKiVerkaufsabsichtAmSaisonende } from "@/lib/contracts/ki-verkaufsabsicht-saisonende";
import { frischVerlaengerteSpieler, planOrganicSellsForTeam, restgehaltVerkaufLohnt } from "@/lib/ai/organic-squad/draft-adapter";
import { saltOrganicSeed } from "@/lib/ai/ai-transfer-window-session-service";
import { decideAiContractDissolution } from "@/lib/morale/ai-contract-dissolution-service";
import { wirtschaftsRegel, wirtschaftsRegelnFuerNeueSaison } from "@/lib/resolve/wirtschafts-regeln";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { applySellPricingPolicyToBreakdown, isBigHaircut } from "@/lib/market/transfermarkt-sell-pricing-policy";
import { resolveOpenBuyoutCostForRoster } from "@/lib/market/transfermarkt-sell-proceeds";
import type { PersistedSaveGame } from "@/lib/persistence/types";

// ---------------------------------------------------------------------------------------------------------------------
// Vertrags-Tick (Fixture wie tests/contract-renewal-service.test.ts, gekuerzt)
// ---------------------------------------------------------------------------------------------------------------------
function team(teamId: string, humanControlled = false): Team {
  return { teamId, shortCode: teamId, name: teamId, budget: 100, cash: 100, identityId: teamId, humanControlled, rosterLimit: 12, logoPath: null };
}

function spieler(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: id,
    rating: 95,
    marketValue: 45,
    salaryDemand: 7,
    displayMarketValue: 45,
    displaySalary: 7,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { climb: 70, chess: 65 },
    disciplineTierCounts: { above20: 2, above40: 2, above60: 2, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
    ...partial,
  } as Player;
}

function kader(playerId: string, teamId = "A-A", partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 1,
    salary: 6,
    upkeep: 6,
    purchasePrice: 45,
    currentValue: 45,
    roleTag: "starter",
    joinedSeasonId: "season-1",
    ...partial,
  } as RosterEntry;
}

function tickState(teams: Team[], players: Player[], rosters: RosterEntry[]): GameState {
  return {
    gamePhase: "season_end_management",
    season: { id: "season-2", name: "Season 2", year: 2026, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: Object.fromEntries(teams.map((t) => [t.teamId, { points: 0 }])),
      teamControlSettings: Object.fromEntries(
        teams.map((t) => [
          t.teamId,
          {
            teamId: t.teamId,
            controlMode: t.humanControlled ? "manual" : "ai",
            ownerId: t.humanControlled ? "user_local" : "ai",
            ownerSlot: t.humanControlled ? "user" : "ai",
            displayLabel: t.shortCode,
          },
        ]),
      ),
    },
    matchdayState: { matchdayId: "matchday-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: [],
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
}

function save(gameState: GameState): PersistedSaveGame {
  return { saveId: "verkauf-restgehalt-save", name: "t", status: "active", createdAt: "", updatedAt: "", gameState } as PersistedSaveGame;
}

describe("Vertrags-Tick: geplanter Verkauf wird nicht verlaengert", () => {
  const stand = () => save(tickState([team("A-A")], [spieler("p1")], [kader("p1")]));

  it("ohne Verkaufsabsicht verlaengert die KI den wertvollen Spieler (Vorher-Verhalten bleibt)", () => {
    const tick = computeSeasonEndContractTick(stand());
    expect(tick.renewedPlayers).toBe(1);
    expect(tick.gameState.rosters).toHaveLength(1);
    expect(tick.gameState.transferHistory).toHaveLength(0);
  });

  it("mit Verkaufsabsicht endet der Vertrag: abloesefreier Verkauf, kein Restgehalt, keine Verlaengerung", () => {
    const vorher = stand();
    const tick = computeSeasonEndContractTick(vorher, undefined, { kiVerkaufsabsicht: new Map([["A-A", new Set(["p1"])]]) });
    expect(tick.renewedPlayers).toBe(0);
    expect(tick.releasedPlayers).toBe(1);
    expect(tick.gameState.rosters).toHaveLength(0);
    const abgang = tick.gameState.transferHistory[0];
    expect(abgang?.transferType).toBe("contract_exit");
    expect(abgang?.buyoutCost ?? 0).toBe(0);
    expect(abgang?.fee ?? 0).toBeGreaterThan(0);
    const kasse = tick.gameState.teams.find((t) => t.teamId === "A-A")?.cash ?? 0;
    expect(kasse).toBeCloseTo(100 + (abgang?.fee ?? 0), 2);
    const ereignis = tick.gameState.seasonState.contractEvents?.find((e) => e.playerId === "p1");
    expect(ereignis?.eventType).toBe("contract_expired_exit");
    expect(ereignis?.decisionReason).toBe("ki_verkauf_geplant");
  });

  it("geplante Abgaenge zaehlen nicht gegen die Freigabe-Bremse (keine Zwangs-Brueckenverlaengerung)", () => {
    // Fuenf Spieler, deren Gehaltssprung bei Verlaengerung zu gross ist (Freigabe "heuristic"): nach drei Freigaben je Team
    // verlaengert die Bremse den Rest fuer ein Jahr. Zaehlten die zwei geplanten Verkaeufe (vorne im Kader) mit, griffe sie frueher.
    const teuer = (id: string) => spieler(id, { rating: 50 });
    const ids = ["g1", "g2", "s1", "s2", "s3", "s4", "s5"];
    const players = ids.map((id) => (id.startsWith("g") ? spieler(id) : teuer(id)));
    const rosters = ids.map((id) => kader(id, "A-A", id.startsWith("g") ? {} : { salary: 0.5, roleTag: "bench" }));
    const ohne = computeSeasonEndContractTick(save(tickState([team("A-A")], players, rosters)));
    const mit = computeSeasonEndContractTick(save(tickState([team("A-A")], players, rosters)), undefined, {
      kiVerkaufsabsicht: new Map([["A-A", new Set(["g1", "g2"])]]),
    });
    const freigegeben = (t: typeof ohne) =>
      (t.gameState.seasonState.contractEvents ?? []).filter((e) => e.eventType === "contract_expired_exit" && e.decisionReason !== "ki_verkauf_geplant").length;
    // Die regulaeren Freigaben sind mit und ohne Absicht gleich viele — die zwei geplanten Verkaeufe kommen obendrauf.
    expect(freigegeben(ohne)).toBe(3);
    expect(freigegeben(mit)).toBe(freigegeben(ohne));
    // Ohne Absicht: g1/g2 verlaengert + 2 Brueckenverlaengerungen; mit Absicht bleiben nur die 2 Bruecken.
    expect(ohne.renewedPlayers).toBe(4);
    expect(mit.renewedPlayers).toBe(2);
    expect(mit.releasedPlayers).toBe(ohne.releasedPlayers + 2);
  });

  it("ein menschliches Team entscheidet selbst — die Absicht aendert dort nichts", () => {
    const mensch = save(tickState([team("H-H", true)], [spieler("p1")], [kader("p1", "H-H")]));
    const tick = computeSeasonEndContractTick(mensch, undefined, { kiVerkaufsabsicht: new Map([["H-H", new Set(["p1"])]]) });
    expect(tick.gameState.rosters[0]?.contractStatus).toBe("renewal_pending");
    expect(tick.gameState.transferHistory).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Vertragsaufloesung vor dem Verkauf mit vollem Buyout
// ---------------------------------------------------------------------------------------------------------------------
describe("Vertragsaufloesung: bei geplantem Verkauf nimmt die KI an", () => {
  const basis = {
    offer: {
      playerId: "p1",
      playerName: "p1",
      teamId: "A-A",
      morale: 30,
      salePrice: 20,
      openBuyout: 12,
      waivedBuyout: 4,
      payableBuyout: 8,
      waiverShare: 0.33,
      remainingContractLength: 3,
      previouslyDeclined: false,
    },
    marketValue: 60,
    salary: 6,
    remainingYears: 2,
    purchasePrice: 20,
    qualityShareInTeam: 1,
    ratingValue: 60,
    rosterBefore: 10,
    playerMin: 8,
    playerOpt: 10,
    cashBefore: 50,
  };

  it("ohne Verkaufsabsicht haelt sie einen wertvollen Spieler (Behalten-Wert hoeher)", () => {
    const d = decideAiContractDissolution({ ...basis, renewal: { wouldRenew: false, renewalSalary: null, renewalLength: 0 } });
    expect(d.decision).toBe("declined");
  });

  it("mit Verkaufsabsicht nimmt sie an — die Aufloesung kostet nur den nicht erlassenen Rest", () => {
    const d = decideAiContractDissolution({
      ...basis,
      renewal: { wouldRenew: false, renewalSalary: null, renewalLength: 0, verkaufGeplant: true },
    });
    expect(d.decision).toBe("accepted");
    expect(d.reason).toBe("verkauf_geplant");
    expect(d.netCash).toBe(12);
  });

  it("die Pleite-Wache gilt weiter", () => {
    const d = decideAiContractDissolution({
      ...basis,
      offer: { ...basis.offer, salePrice: 5, payableBuyout: 20 },
      cashBefore: 3,
      renewal: { wouldRenew: false, renewalSalary: null, renewalLength: 0, verkaufGeplant: true },
    });
    expect(d.decision).toBe("declined");
    expect(d.reason).toBe("cash_floor");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Verkaufspruefung netto nach Rest-Buyout (Fixture wie tests/transfermarkt-sell-value-floor.test.ts)
// ---------------------------------------------------------------------------------------------------------------------
const IDENTITY = {
  teamId: "team-test",
  ambition: 55,
  finances: 45,
  boardConfidence: 55,
  harmony: 50,
  playerMin: 8,
  playerOpt: 8,
  pow: 70,
  spe: 12,
  men: 12,
  soc: 12,
} as unknown as TeamIdentity;

type GateOptionen = {
  /** Marktwert je Spieler (Standard 40); als Funktion je Index. */
  mw?: number | ((i: number) => number);
  /** Gehalt je Saison (Standard 8). */
  gehalt?: number;
  /** Stempel `verkaufSchwellen` (Standard "alt", damit die Restgehalt-Waechter oben genau die Regel `restgehalt` messen). */
  schwellen?: "alt" | "neu";
  /** POW je Index (Standard 75): steuert die Qualitaet im Kader. */
  pow?: (i: number) => number;
  /** Anzahl Spieler (Standard 18). */
  anzahl?: number;
};

function gateState(regel: "alt" | "neu" | null, vertragsJahre = 2, opt: GateOptionen = {}) {
  const mwVon = (i: number) => (typeof opt.mw === "function" ? opt.mw(i) : opt.mw ?? 40);
  const gehalt = opt.gehalt ?? 8;
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  const perfs: unknown[] = [];
  for (let i = 0; i < (opt.anzahl ?? 18); i++) {
    const pid = `p${i}`;
    players.push({
      id: pid,
      name: pid,
      coreStats: { pow: opt.pow ? opt.pow(i) : 75, spe: 50, men: 50, soc: 50 },
      disciplineRatings: { tdm: 60 },
      marketValue: mwVon(i),
      salaryDemand: gehalt,
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
      contractLength: vertragsJahre,
      salary: gehalt,
      upkeep: gehalt,
      purchasePrice: 10,
      currentValue: mwVon(i),
      roleTag: "starter",
      joinedSeasonId: "season-2",
    } as RosterEntry);
    perfs.push({
      id: `perf-${i}`,
      matchdayResultId: "result-1",
      teamId: "team-test",
      playerId: pid,
      activePlayerId: `r${i}`,
      disciplineId: "tdm",
      disciplineSide: "tdm",
      slotIndex: i,
      baseValue: 90 - i * 4,
      finalPlayerScore: 90 - i * 4,
      scoreContribution: 90 - i * 4,
      rankInTeam: i + 1,
      rankInDiscipline: i + 1,
      isTop10: true,
      isMvpCandidate: false,
      storyWeight: 1,
      createdAt: "2026-06-10T12:00:00.000Z",
    });
  }
  const t = { teamId: "team-test", name: "T", shortCode: "T", cash: 100, rosterLimit: 20, budget: 100, identityId: "team-test", humanControlled: false } as unknown as Team;
  const gameState = {
    gamePhase: "season_active",
    season: { id: "season-2", name: "S2", currentMatchday: 1, matchdayIds: [] },
    matchdayState: { matchdayId: "season-2-md-1", status: "open" },
    teams: [t],
    players,
    rosters,
    teamIdentities: [IDENTITY],
    disciplines: [{ id: "tdm", category: "power" }],
    seasonState: {
      seasonId: "season-2",
      matchdayResults: [{ id: "result-1", seasonId: "season-2", status: "preview_applied" }],
      playerDisciplinePerformances: perfs,
      seasonSnapshots: [],
      ...(regel
        ? { wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-2"), kernschutz: "alt", restgehalt: regel, verkaufSchwellen: opt.schwellen ?? "alt" } }
        : {}),
    },
  } as unknown as GameState;
  return { gameState, team: t, players };
}

function nettoErloes(gameState: GameState, playerId: string, rosterAfter: number) {
  const player = gameState.players.find((p) => p.id === playerId)!;
  const rosterEntry = gameState.rosters.find((r) => r.playerId === playerId)!;
  const base = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry);
  const priced = applySellPricingPolicyToBreakdown({ gameState, teamId: "team-test", player, rosterEntry, baseBreakdown: base, rosterAfter });
  const realized = priced.preFloorSalePrice ?? priced.breakdown.salePrice ?? 0;
  return realized - resolveOpenBuyoutCostForRoster({ rosterEntry, gameState });
}

describe("Verkaufspruefung der KI rechnet mit dem Erloes nach Rest-Buyout", () => {
  it("mit Stempel `restgehalt: neu` verkauft ein zahlungsfaehiges Team keinen Spieler, dessen Netto ein grosser Abschlag ist", () => {
    const alt = gateState("alt");
    const neu = gateState("neu");
    const planAlt = planOrganicSellsForTeam({ gameState: alt.gameState, team: alt.team, identity: IDENTITY, roster: alt.players, allowBelowMin: true });
    const planNeu = planOrganicSellsForTeam({ gameState: neu.gameState, team: neu.team, identity: IDENTITY, roster: neu.players, allowBelowMin: true });
    // Zwei offene Vertragsjahre zu 8 C: 16 C Restgehalt auf 40 C Marktwert. Ohne Regel geht trotzdem verkauft ...
    expect(planAlt.decisions.length).toBeGreaterThan(0);
    // ... mit Regel deutlich weniger, und jeder verbliebene Verkauf hat ein Netto ueber der Abschlag-Schwelle.
    expect(planNeu.decisions.length).toBeLessThan(planAlt.decisions.length);
    let kader = neu.players.length;
    for (const d of planNeu.decisions) {
      kader -= 1;
      expect(isBigHaircut(40, nettoErloes(neu.gameState, d.playerId, kader))).toBe(false);
    }
  });

  it("ohne Restvertrag (Vertrag laeuft mit dieser Saison aus) aendert die Regel nichts", () => {
    // contractLength 1 und Gehalt der Saison schon gebucht ⇒ kein Restgehalt ⇒ Netto = Brutto.
    const mitAbzug = (s: ReturnType<typeof gateState>) => ({
      ...s.gameState,
      seasonState: { ...s.gameState.seasonState, sponsorPayoutLogs: [{ seasonId: "season-2", teamId: "team-test", componentId: "salary_deduct" }] },
    }) as unknown as GameState;
    const alt = gateState("alt", 1);
    const neu = gateState("neu", 1);
    const planAlt = planOrganicSellsForTeam({ gameState: mitAbzug(alt), team: alt.team, identity: IDENTITY, roster: alt.players, allowBelowMin: true });
    const planNeu = planOrganicSellsForTeam({ gameState: mitAbzug(neu), team: neu.team, identity: IDENTITY, roster: neu.players, allowBelowMin: true });
    expect(planNeu.decisions.map((d) => d.playerId)).toEqual(planAlt.decisions.map((d) => d.playerId));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Verkaufsabsicht am Saisonende = Plan der Verkaufsrunde; Stempel
// ---------------------------------------------------------------------------------------------------------------------
describe("Verkaufsabsicht am Saisonende", () => {
  afterEach(() => {
    delete process.env.OLY_KI_RESTGEHALT;
  });

  it("ist genau der Plan, den die Verkaufsrunde mit derselben Saat rechnen wuerde", () => {
    const { gameState, team: t, players } = gateState("neu", 1);
    const s = { ...save(gameState), saveId: "absicht-save" } as PersistedSaveGame;
    const absicht = ermittleKiVerkaufsabsichtAmSaisonende(s);
    const plan = planOrganicSellsForTeam({
      gameState,
      team: t,
      identity: IDENTITY,
      roster: players,
      purchasePriceByPlayerId: Object.fromEntries(gameState.rosters.map((r) => [r.playerId, r.purchasePrice as number])),
      allowBelowMin: true,
      draftSeed: saltOrganicSeed(`absicht-save:team-test`),
    });
    expect(plan.decisions.length).toBeGreaterThan(0);
    expect([...(absicht.get("team-test") ?? [])].sort()).toEqual(plan.decisions.map((d) => d.playerId).sort());
  });

  it("ist leer ohne Stempel oder mit `restgehalt: alt` (bestehender Spielstand rechnet seine Saison alt zu Ende)", () => {
    expect(ermittleKiVerkaufsabsichtAmSaisonende(save(gateState(null, 1).gameState)).size).toBe(0);
    expect(ermittleKiVerkaufsabsichtAmSaisonende(save(gateState("alt", 1).gameState)).size).toBe(0);
  });

  it("neue Saisons bekommen den Stempel `neu`, der Schalter OLY_KI_RESTGEHALT=aus stellt `alt` ein", () => {
    expect(wirtschaftsRegelnFuerNeueSaison("season-3").restgehalt).toBe("neu");
    process.env.OLY_KI_RESTGEHALT = "aus";
    expect(wirtschaftsRegelnFuerNeueSaison("season-3").restgehalt).toBe("alt");
    // Altstempel ohne Feld gilt als "alt".
    const altStempel = { season: { id: "season-3" }, seasonState: { seasonId: "season-3", wirtschaftsRegeln: { seasonId: "season-3", quote: "neu", anker: "neu", kernschutz: "neu" } } };
    expect(wirtschaftsRegel(altStempel as never, "restgehalt")).toBe("alt");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Verkaufs-Schwellen (24.11., Stempel `verkaufSchwellen`, verkauf-restgehalt-24-11.md Abschnitt 7)
// ---------------------------------------------------------------------------------------------------------------------
describe("Verkaufs-Schwellen: Restgehalt bremst, Vertragsende nach derselben Kosten-Nutzen-Abwaegung", () => {
  afterEach(() => {
    delete process.env.OLY_KI_VERKAUF_SCHWELLEN;
  });

  /** Das Gehalt der laufenden Saison ist gebucht: ein Ein-Jahres-Vertrag hat dann kein Restgehalt (Vertragsende). */
  const mitGehaltsAbzug = (gameState: GameState) =>
    ({
      ...gameState,
      seasonState: { ...gameState.seasonState, sponsorPayoutLogs: [{ seasonId: "season-2", teamId: "team-test", componentId: "salary_deduct" }] },
    }) as unknown as GameState;

  it("Chris' Beispiel: 8 C je Saison, noch 4 Jahre, 25 C Marktwert — die KI behaelt ihn (auch in Finanznot)", () => {
    // Reine Regel: 32 C Restgehalt gegen hoechstens ~25 C Erloes — netto negativ, also nie.
    expect(restgehaltVerkaufLohnt({ marketValue: 25, realizedPrice: 25, openBuyout: 32 })).toBe(false);
    // Selbst ein Angebot deutlich ueber dem Marktwert reicht nicht, solange netto unter 90 % des Marktwerts bleibt.
    expect(restgehaltVerkaufLohnt({ marketValue: 25, realizedPrice: 40, openBuyout: 32 })).toBe(false);
    // Erst ein Preis, der das Restgehalt UND fast den ganzen Marktwert traegt, waere eine Gewinnmitnahme (55 C fuer 25 C MW).
    expect(restgehaltVerkaufLohnt({ marketValue: 25, realizedPrice: 55, openBuyout: 32 })).toBe(true);
    // Ohne Restgehalt greift die Regel nicht.
    expect(restgehaltVerkaufLohnt({ marketValue: 25, realizedPrice: 20, openBuyout: 0 })).toBe(true);

    // Im Planer: ein Kader aus solchen Spielern (18 bei Opt 8, also eigentlich Ueberschuss) — mit Stempel geht keiner.
    const { gameState, team: t, players } = gateState("neu", 4, { mw: 25, gehalt: 8, schwellen: "neu" });
    expect(resolveOpenBuyoutCostForRoster({ rosterEntry: gameState.rosters[0]!, gameState })).toBeCloseTo(32, 1);
    const plan = planOrganicSellsForTeam({ gameState, team: t, identity: IDENTITY, roster: players, allowBelowMin: true });
    expect(plan.decisions).toHaveLength(0);
    // Auch im Vertragsende-Plan (Verkaufsabsicht vor dem Tick) bleibt er: sein Vertrag laeuft noch.
    const planEnde = planOrganicSellsForTeam({ gameState, team: t, identity: IDENTITY, roster: players, allowBelowMin: true, vertragsende: true });
    expect(planEnde.decisions).toHaveLength(0);
    // Finanznot (Kasse unter 0) hebt die Sperre nicht auf: Bargeld zahlen, um ihn loszuwerden, bringt keine Liquiditaet.
    const pleite = { ...gameState, teams: gameState.teams.map((x) => ({ ...x, cash: -5 })) } as GameState;
    const planPleite = planOrganicSellsForTeam({ gameState: pleite, team: { ...t, cash: -5 }, identity: IDENTITY, roster: players, allowBelowMin: true });
    expect(planPleite.decisions).toHaveLength(0);
  });

  it("ohne Stempel (vorher) verkaufte ein Team in Finanznot denselben Kader trotz 32 C Restgehalt", () => {
    const { gameState, team: t, players } = gateState("neu", 4, { mw: 25, gehalt: 8, schwellen: "alt" });
    const pleite = { ...gameState, teams: gameState.teams.map((x) => ({ ...x, cash: -5 })) } as GameState;
    const plan = planOrganicSellsForTeam({ gameState: pleite, team: { ...t, cash: -5 }, identity: IDENTITY, roster: players, allowBelowMin: true });
    expect(plan.decisions.length).toBeGreaterThan(0);
  });

  it("am Vertragsende gilt dieselbe Kosten-Nutzen-Abwaegung wie im Fenster: jeder Abgang mit positivem Vorteil, weniger als ohne Stempel", () => {
    // 18 gleich starke Spieler, Opt 8, Ein-Jahres-Vertraege ohne Restgehalt; die Leistungs-Rangfolge gibt p0 … p6 ein Angebot
    // ueber dem Marktwert, den anderen darunter.
    const ohne = gateState("neu", 1, { schwellen: "alt" });
    const mit = gateState("neu", 1, { schwellen: "neu" });
    const planOhne = planOrganicSellsForTeam({ gameState: mitGehaltsAbzug(ohne.gameState), team: ohne.team, identity: IDENTITY, roster: ohne.players, allowBelowMin: true, vertragsende: true });
    const planMit = planOrganicSellsForTeam({ gameState: mitGehaltsAbzug(mit.gameState), team: mit.team, identity: IDENTITY, roster: mit.players, allowBelowMin: true, vertragsende: true });
    const planFenster = planOrganicSellsForTeam({ gameState: mitGehaltsAbzug(mit.gameState), team: mit.team, identity: IDENTITY, roster: mit.players, allowBelowMin: true });
    expect(planOhne.decisions.length).toBeGreaterThan(18 - planOhne.optTarget);
    expect(planMit.decisions.length).toBeGreaterThan(0);
    expect(planMit.decisions.length).toBeLessThan(planOhne.decisions.length);
    expect(planMit.decisions.map((d) => d.playerId)).toEqual(planFenster.decisions.map((d) => d.playerId));
    let kader = mit.players.length;
    for (const d of planMit.decisions) {
      kader -= 1;
      expect(d.abgangsGrund).toBe("kosten_nutzen");
      expect(d.abwaegung!.vorteil).toBeGreaterThan(0);
      // Gleich starke Spieler: es geht nur, wer ein Angebot ueber dem Marktwert hat (die Abwaegung verlangt Ersatz, Risiko, Marge).
      expect(nettoErloes(mitGehaltsAbzug(mit.gameState), d.playerId, kader)).toBeGreaterThan(40);
    }
  });

  it("schwache Spieler duerfen auch unter Marktwert gehen; Stammspieler ohne gutes Angebot bleiben", () => {
    // 8 Spieler bei Opt 8: zwei sind klar schwaecher (POW 20 statt 75) und billig.
    const { gameState, team: t, players } = gateState("neu", 1, {
      schwellen: "neu",
      anzahl: 8,
      pow: (i) => (i >= 6 ? 20 : 75),
      mw: (i) => (i >= 6 ? 12 : 40),
    });
    const plan = planOrganicSellsForTeam({ gameState: mitGehaltsAbzug(gameState), team: t, identity: IDENTITY, roster: players, allowBelowMin: true, vertragsende: true });
    const verkauft = new Map(plan.decisions.map((d) => [d.playerId, d] as const));
    expect(verkauft.has("p6")).toBe(true);
    expect(verkauft.has("p7")).toBe(true);
    expect(Math.min(verkauft.get("p6")!.abwaegung!.erloes, verkauft.get("p7")!.abwaegung!.erloes)).toBeLessThan(12);
    for (const d of plan.decisions) {
      if (d.playerId === "p6" || d.playerId === "p7") continue;
      expect(d.abwaegung!.erloes).toBeGreaterThan(40);
    }
  });

  it("ein gerade verlaengerter Vertrag wird nicht freiwillig verkauft", () => {
    // Billiges Restgehalt (3 x 1 C auf 40 C MW): netto ueber 90 % waere moeglich — aber alle wurden gerade verlaengert.
    const { gameState, team: t, players } = gateState("neu", 3, { mw: 40, gehalt: 1, schwellen: "neu" });
    const verlaengert = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        contractEvents: players.map((p) => ({
          eventId: `e-${p.id}`, seasonId: "season-1", teamId: "team-test", playerId: p.id, eventType: "contract_renewed",
          oldSalary: 1, newSalary: 1, oldLength: 1, newLength: 3, source: "ai_contract_renewal", timestamp: "2026-06-01T00:00:00.000Z",
        })),
      },
    } as unknown as GameState;
    expect(frischVerlaengerteSpieler(verlaengert, "team-test").size).toBe(18);
    const plan = planOrganicSellsForTeam({ gameState: verlaengert, team: t, identity: IDENTITY, roster: players, allowBelowMin: true });
    expect(plan.decisions).toHaveLength(0);
    // Ist der Vertrag seither gealtert (Laufzeit 2 statt 3), gilt er nicht mehr als frisch verlaengert.
    const gealtert = { ...verlaengert, rosters: verlaengert.rosters.map((r) => ({ ...r, contractLength: 2 })) } as GameState;
    expect(frischVerlaengerteSpieler(gealtert, "team-test").size).toBe(0);
  });

  it("Stempel: neue Saisons bekommen `verkaufSchwellen: neu`, OLY_KI_VERKAUF_SCHWELLEN=aus stellt `alt` ein, Altstempel = alt", () => {
    expect(wirtschaftsRegelnFuerNeueSaison("season-3").verkaufSchwellen).toBe("neu");
    process.env.OLY_KI_VERKAUF_SCHWELLEN = "aus";
    expect(wirtschaftsRegelnFuerNeueSaison("season-3").verkaufSchwellen).toBe("alt");
    const altStempel = { season: { id: "season-3" }, seasonState: { seasonId: "season-3", wirtschaftsRegeln: { seasonId: "season-3", quote: "neu", anker: "neu", kernschutz: "neu", restgehalt: "neu" } } };
    expect(wirtschaftsRegel(altStempel as never, "verkaufSchwellen")).toBe("alt");
  });
});

describe("Vertrags-Tick mit Stempel `verkaufSchwellen`: keine Freigabe-Bremse mehr (Chris 24.11., keine Kadergroessen-Bremse)", () => {
  it("zwei geplante Abgaenge + fuenf heuristische Freigaben ⇒ alle sieben gehen, nichts wird brueckenverlaengert", () => {
    const teuer = (id: string) => spieler(id, { rating: 50 });
    const ids = ["g1", "g2", "s1", "s2", "s3", "s4", "s5"];
    const players = ids.map((id) => (id.startsWith("g") ? spieler(id) : teuer(id)));
    const rosters = ids.map((id) => kader(id, "A-A", id.startsWith("g") ? {} : { salary: 0.5, roleTag: "bench" }));
    const mitStempel = (gs: GameState) =>
      ({
        ...gs,
        seasonState: { ...gs.seasonState, wirtschaftsRegeln: { ...wirtschaftsRegelnFuerNeueSaison("season-2"), verkaufSchwellen: "neu" } },
      }) as GameState;
    const tick = computeSeasonEndContractTick(save(mitStempel(tickState([team("A-A")], players, rosters))), undefined, {
      kiVerkaufsabsicht: new Map([["A-A", new Set(["g1", "g2"])]]),
    });
    const ereignisse = tick.gameState.seasonState.contractEvents ?? [];
    const geplant = ereignisse.filter((e) => e.decisionReason === "ki_verkauf_geplant").length;
    const freigegeben = ereignisse.filter((e) => e.eventType === "contract_expired_exit" && e.decisionReason !== "ki_verkauf_geplant").length;
    expect(geplant).toBe(2);
    expect(freigegeben).toBe(5);
    expect(tick.renewedPlayers).toBe(0);
    // Ohne Stempel (alter Stand): hoechstens drei heuristische Freigaben, der Rest wird fuer ein Jahr brueckenverlaengert.
    const ohneStempel = computeSeasonEndContractTick(save(tickState([team("A-A")], players, rosters)), undefined, {
      kiVerkaufsabsicht: new Map([["A-A", new Set(["g1", "g2"])]]),
    });
    const ereignisseOhne = ohneStempel.gameState.seasonState.contractEvents ?? [];
    expect(ereignisseOhne.filter((e) => e.eventType === "contract_expired_exit" && e.decisionReason !== "ki_verkauf_geplant").length).toBe(3);
    expect(ohneStempel.renewedPlayers).toBe(2);
  });
});
