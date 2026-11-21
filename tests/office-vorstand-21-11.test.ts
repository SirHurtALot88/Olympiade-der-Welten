/**
 * Office 21.11: Vorstandsziele (Laufzeit, Lieblingsspieler, Widerspruchspruefung), Gespraech, Praemien, keine Geldstrafe,
 * Mehrspieler. Fixture: Saison 3, zwei menschliche Teams (H-1, H-2) und ein KI-Team (K-1).
 */
import { describe, expect, it, vi } from "vitest";

import {
  buildTeamObjectiveOverview,
  buildTeamSeasonObjectiveSettlement,
  getTeamObjectivePool,
  istZielTauschbar,
  refreshTeamObjectiveState,
  selectBoardObjectiveDrafts,
  tauscheVorstandsZiel,
  zielTauschZeitfenster,
} from "@/lib/board/team-season-objectives-service";
import {
  baueGespraechZusageZiele,
  baueLieblingsspielerZiel,
  baueVertragslaufzeitZiel,
  ermittleLieblingsspieler,
  LIEBLING_VERKAUF_VERTRAUEN,
  LIEBLING_VERLAENGERUNG_VERTRAUEN,
  pruefeZielSatz,
  type ZielEntwurf,
} from "@/lib/board/vorstand-ziele-erweitert";
import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { berechneVorstandBudgetStand, lesVorstandZustand, resolveVorstandFreigabe, stufeFuerVertrauen } from "@/lib/finance/vorstand-budgetfreigabe";
import { buildTeamKontoauszug } from "@/lib/finance/kontoauszug";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";
import { buildTransferFinanceAudit } from "@/lib/season/transfer-finance-audit";
import { setzeUmschichtung } from "@/lib/finance/vorstand-budget-aktionen";
import {
  beurteileGespraech,
  nimmGegenangebotAn,
  stelleGespraechAntrag,
  ziehGegenangebotZurueck,
} from "@/lib/finance/vorstand-gespraech";
import { lesVorstandGespraech } from "@/lib/finance/vorstand-gespraech-zustand";
import { buildOfficeModell } from "@/lib/finance/office-modell";
import { bucheSiegpraemien, bucheTreuepraemie, lesPraemienLog, lesPraemienPlan, setzePraemienPlan } from "@/lib/finance/vorstand-praemien";

function team(teamId: string, partial: Partial<Team> = {}): Team {
  return {
    teamId,
    shortCode: teamId,
    name: partial.name ?? `Team ${teamId}`,
    budget: 120,
    cash: partial.cash ?? 90,
    identityId: teamId,
    humanControlled: partial.humanControlled ?? false,
    rosterLimit: 12,
    logoPath: null,
  } as Team;
}

function identity(teamId: string, partial: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId,
    playerType: null,
    pow: 8,
    spe: 7,
    men: 5,
    soc: 3,
    ambition: partial.ambition ?? 6,
    finances: partial.finances ?? 6,
    boardConfidence: 7,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
  } as TeamIdentity;
}

function player(id: string, partial: Partial<Player> = {}): Player {
  return {
    id,
    name: partial.name ?? id,
    rating: 60,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: 5,
    className: partial.className ?? "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 50 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as unknown as Player;
}

function roster(teamId: string, playerId: string, partial: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: partial.contractLength ?? 2,
    contractEndSeasonNumber: partial.contractEndSeasonNumber,
    salary: partial.salary ?? 3,
    upkeep: 4,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  } as RosterEntry;
}

/** Fixture. `enden`: Endsaison je Spieler der Teams H-1, H-2, K-1 (Standard: gestreut). */
function fixture(opts: { enden?: number[]; vertrauen?: Record<string, number>; cash?: number; phase?: string } = {}): GameState {
  const teams = [team("H-1", { humanControlled: true, cash: opts.cash ?? 90 }), team("H-2", { humanControlled: true, cash: opts.cash ?? 90 }), team("K-1")];
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  const enden = opts.enden ?? [3, 4, 5, 6, 4, 5, 3, 6, 4, 5];
  for (const t of teams) {
    enden.forEach((ende, i) => {
      const id = `${t.teamId}-p${i}`;
      players.push(player(id, { name: `${t.teamId} Spieler ${i}`, marketValue: 30 - i }));
      rosters.push(roster(t.teamId, id, { contractEndSeasonNumber: ende, contractLength: ende - 3 + 1 }));
    });
  }
  const vertrauen = opts.vertrauen ?? { "H-1": 6.2, "H-2": 3.4, "K-1": 5 };
  return {
    season: { id: "season-3", name: "Season 3", year: 2026, currentMatchday: 1, matchdayIds: ["md-1", "md-2", "md-3"] },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings: { "K-1": { points: 100, rank: 1 }, "H-2": { points: 90, rank: 2 }, "H-1": { points: 80, rank: 3 } },
      boardConfidence: Object.fromEntries(Object.entries(vertrauen).map(([k, v]) => [k, { teamId: k, value: v, pressure: 11 - v, warnings: [] }])),
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      contractEvents: [],
      seasonSnapshots: [],
    },
    gamePhase: opts.phase ?? "transfer_buy_phase",
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: teams.map((t) => identity(t.teamId, t.teamId === "H-2" ? { finances: 9, ambition: 3 } : {})),
    players,
    disciplines: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: players.map((p) => ({
      playerId: p.id,
      teamId: p.id.split("-p")[0] === "H-1" ? "H-1" : p.id.startsWith("H-2") ? "H-2" : "K-1",
      morale: 60,
      visibleMood: "neutral",
      lastUpdatedSeasonId: "season-3",
      reasons: [],
      contractIntent: "open",
    })),
    logs: [],
    mappingReport: {},
  } as unknown as GameState;
}

/** Saison-Schnappschuss der Vorsaison mit PP je Spieler (der Lieblingsspieler von H-1 ist p2). */
function mitPp(gs: GameState): GameState {
  return {
    ...gs,
    seasonState: {
      ...gs.seasonState,
      seasonSnapshots: [
        {
          seasonId: "season-2",
          playerPerformances: [
            { playerId: "H-1-p1", pps: 40, appearances: 10 },
            { playerId: "H-1-p2", pps: 55, appearances: 10 },
            { playerId: "H-1-p3", pps: 12, appearances: 10 },
            { playerId: "K-1-p1", pps: 90, appearances: 10 },
          ],
        },
      ],
    } as unknown as GameState["seasonState"],
  };
}

const eintrag = (id: string, titel: string, status: ZielEntwurf["status"] = "open", extra: Partial<ZielEntwurf> = {}): ZielEntwurf => ({
  objectiveId: id,
  category: "finance",
  label: titel,
  targetValue: 1,
  currentValue: 1,
  status,
  ...extra,
});

describe("Freigabe-Stufen und Anhebung im Gespraech", () => {
  it("die fuenf Stufen und die Untergrenze des Gehaltstopfs", () => {
    expect(stufeFuerVertrauen(7.5).anteil).toBe(1);
    expect(stufeFuerVertrauen(5).anteil).toBe(0.9);
    expect(stufeFuerVertrauen(4.9).anteil).toBe(0.8);
    expect(stufeFuerVertrauen(2.9).anteil).toBe(0.7);
    expect(stufeFuerVertrauen(1.4).anteil).toBe(0.5);
    const gs = fixture({ vertrauen: { "H-1": 1.0, "H-2": 1.0, "K-1": 1.0 } });
    const s = berechneVorstandBudgetStand(gs, "H-1");
    expect(s.anteil).toBe(0.5);
    expect(s.gehalt.quote).toBeGreaterThanOrEqual(0.75);
  });

  it("Zustimmung hebt die Quote um eine Stufe an und verbraucht ein Gespraech", () => {
    const gs = fixture();
    const vorher = resolveVorstandFreigabe(gs, "H-1");
    expect(vorher.anteil).toBe(0.9);
    const e = beurteileGespraech(gs, "H-1", { bitte: "stufe", zusagen: ["vertrauen", "binden"] });
    expect(e.sperre).toBeNull();
    const r = stelleGespraechAntrag(gs, "H-1", { bitte: "stufe", zusagen: ["vertrauen", "binden", "zielhoch"] });
    expect(r.ausgang === "zustimmung" || r.ausgang === "gegenangebot").toBe(true);
    if (r.ausgang === "zustimmung") {
      expect(resolveVorstandFreigabe(r.gameState, "H-1").anteil).toBe(1);
    }
    expect(lesVorstandGespraech(r.gameState, "H-1").genutzt).toBe(1);
  });

  it("Stufe 100 % ist nicht anhebbar: feste Regel, trotzdem verbraucht der Antrag ein Gespraech nicht, solange er nur eingeschaetzt wird", () => {
    const gs = fixture({ vertrauen: { "H-1": 8, "H-2": 3, "K-1": 5 } });
    const e = beurteileGespraech(gs, "H-1", { bitte: "stufe", zusagen: [] });
    expect(e.sperre).toMatch(/voll freigegeben/);
    expect(e.urteil).toBe("ablehnung");
    expect(lesVorstandGespraech(gs, "H-1").genutzt).toBe(0);
  });

  it("hoechstens zwei Gespraeche je Saison", () => {
    let gs = fixture({ vertrauen: { "H-1": 8, "H-2": 3, "K-1": 5 } });
    for (let i = 0; i < 2; i += 1) {
      const r = stelleGespraechAntrag(gs, "H-1", { bitte: "stufe", zusagen: [] });
      gs = r.gameState;
    }
    expect(lesVorstandGespraech(gs, "H-1").genutzt).toBe(2);
    const dritte = stelleGespraechAntrag(gs, "H-1", { bitte: "stufe", zusagen: [] });
    expect(dritte.ok).toBe(false);
    expect(dritte.reason).toBe("keine_gespraeche");
  });

  it("Gegenangebot: Runde 2 im selben Gespraech, Annehmen bindet die Zusagen, Zurueckziehen laesst es verbraucht", () => {
    const roh = refreshTeamObjectiveState(mitPp(fixture()));
    // Nach dem Auffrischen steht das berechnete Vertrauen; fuer die Waage setzen wir es fest.
    const gs = { ...roh, seasonState: { ...roh.seasonState, boardConfidence: { ...roh.seasonState.boardConfidence, "H-1": { teamId: "H-1", value: 3.6, pressure: 7.4, warnings: [] } } } } as GameState;
    // Vertrauen 3,6 x 2 = 7,2 gegen 14: es fehlen 6,8; Lieblingsspieler binden (4) und Vertrauen einsetzen (3) schliessen die Luecke.
    const r = stelleGespraechAntrag(gs, "H-1", { bitte: "stufe", zusagen: [] });
    expect(r.ausgang).toBe("gegenangebot");
    const z = lesVorstandGespraech(r.gameState, "H-1");
    expect(z.genutzt).toBe(1);
    expect(z.offen?.vorschlag.length).toBeGreaterThan(0);
    const angenommen = nimmGegenangebotAn(r.gameState, "H-1");
    expect(angenommen.ausgang).toBe("zustimmung");
    expect(lesVorstandGespraech(angenommen.gameState, "H-1").genutzt).toBe(1);
    expect(lesVorstandGespraech(angenommen.gameState, "H-1").zusagen.length).toBeGreaterThan(0);
    expect(resolveVorstandFreigabe(angenommen.gameState, "H-1").anteil).toBe(0.9);
    const zurueck = ziehGegenangebotZurueck(r.gameState, "H-1");
    expect(lesVorstandGespraech(zurueck.gameState, "H-1").genutzt).toBe(1);
    expect(lesVorstandGespraech(zurueck.gameState, "H-1").offen).toBeNull();
  });

  it("Gehaltsdeckel zugesagt: kein Umschichten ins Gehalt, und die Zusage vertraegt sich nicht mit einer Bitte um mehr Gehalt", () => {
    const gs = fixture({ vertrauen: { "H-1": 3.2, "H-2": 3, "K-1": 5 } });
    const e = beurteileGespraech(gs, "H-1", { bitte: "sonder", betrag: 1, zusagen: ["deckel"] });
    expect(e.zusagenVerfuegbar.deckel).toMatch(/Widerspricht/);
    const mitDeckel = stelleGespraechAntrag(gs, "H-1", { bitte: "ziel", zielId: "x", zusagen: ["deckel", "vertrauen"] });
    // Ziel tauschen mit unbekanntem Ziel: abgelehnt; der Deckel wird dann nicht gebunden.
    expect(lesVorstandGespraech(mitDeckel.gameState, "H-1").zusagen.some((x) => x.art === "deckel")).toBe(false);
    const gebunden = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        vorstandGespraeche: { "H-1": { ...lesVorstandGespraech(gs, "H-1"), zusagen: [{ art: "deckel" as const, seit: "x" }] } },
      },
    };
    const um = setzeUmschichtung(gebunden, "H-1", 1);
    expect(um.ok).toBe(false);
    expect(um.reason).toBe("gehaltsdeckel_zugesagt");
  });
});

describe("Widerspruchspruefung der Ziele", () => {
  it("Sparziel gegen Rang-Ziel bei Kader unter Soll ist ein Widerspruch, sonst nicht", () => {
    const sparen = eintrag("finance-net-transfer-balance", "Netto-Transferausgaben: Ligarang 1 bis 4");
    const top6 = eintrag("expectation-rank", "Top 6 erreichen", "open", { category: "sport" });
    expect(pruefeZielSatz([sparen, top6], { kaderUnterSoll: true }).ok).toBe(false);
    expect(pruefeZielSatz([sparen, top6], { kaderUnterSoll: false }).ok).toBe(true);
    expect(pruefeZielSatz([sparen, top6], { kaderUnterSoll: true }).paare).toBe(1);
  });

  it("bei der Vergabe fliegt das widersprechende Ziel raus und das naechste Finanzziel rueckt nach", () => {
    const top6 = eintrag("expectation-rank", "Top 6 erreichen", "open", { category: "sport" });
    const sparen = eintrag("finance-net-transfer-balance", "Netto-Transferausgaben", "open", { category: "finance" });
    const kader = eintrag("roster-form-color-cover", "Farben im Kader abdecken", "open", { category: "roster" });
    const picked = selectBoardObjectiveDrafts({
      objectives: [top6, sparen, kader],
      profile: null,
      identity: null,
      slateSize: 3,
      kontext: { kaderUnterSoll: true },
    });
    expect(picked.map((p) => p.objectiveId)).toEqual(["expectation-rank", "roster-form-color-cover"]);
    const ersatz = picked.find((p) => p.objectiveId === "roster-form-color-cover");
    expect(ersatz?.ersetzt?.label).toBe("Netto-Transferausgaben");
    expect(ersatz?.ersetzt?.weil).toMatch(/Soll-Größe/);
  });

  it("Zieltausch im Gespraech: ein Ziel wird durch ein anderes ersetzt und das Gespraech ist verbraucht", () => {
    const gs = refreshTeamObjectiveState(fixture({ vertrauen: { "H-1": 6, "H-2": 3, "K-1": 5 } }));
    const tauschbar = (gs.seasonState.teamSeasonObjectives ?? []).filter(
      (o) => o.teamId === "H-1" && o.seasonId === gs.season.id && !/^(board-|vorstand-|sponsor-)/.test(o.objectiveId) && o.status !== "completed" && o.status !== "failed",
    );
    expect(tauschbar.length).toBeGreaterThan(0);
    const probe = tauschbar[0]!;
    const m = buildOfficeModell(gs, "H-1")!;
    expect(m.ziele.some((z) => z.id === probe.objectiveId && z.tauschbar)).toBe(true);
    const r = stelleGespraechAntrag(gs, "H-1", { bitte: "ziel", zielId: probe.objectiveId, zusagen: ["vertrauen", "binden"] });
    const z = lesVorstandGespraech(r.gameState, "H-1");
    expect(z.genutzt).toBe(1);
    expect(["zustimmung", "gegenangebot", "ablehnung"]).toContain(r.ausgang);
    if (r.ausgang === "zustimmung") {
      const nachher = (r.gameState.seasonState.teamSeasonObjectives ?? []).filter((o) => o.teamId === "H-1");
      expect(nachher.some((o) => o.objectiveId === probe.objectiveId)).toBe(false);
      expect(nachher.some((o) => o.ersetzt?.label === probe.label)).toBe(true);
    }
  });
});

describe("Lieblingsspieler des Vorstands", () => {
  it("ist der beste Spieler des eigenen Kaders nach PP der Vorsaison", () => {
    const l = ermittleLieblingsspieler(mitPp(fixture()), "H-1");
    expect(l?.playerId).toBe("H-1-p2");
    expect(l?.quelle).toBe("vorsaison");
  });

  it("in Saison 1 (kein Schnappschuss) zaehlt die aktuelle PP", () => {
    const gs = fixture();
    gs.seasonState.matchdayResults = [{ id: "r1", seasonId: "season-3", matchdayId: "md-1" }] as never;
    gs.seasonState.playerDisciplinePerformances = [
      { id: "a", matchdayResultId: "r1", teamId: "H-1", playerId: "H-1-p4", scoreContribution: 9 },
      { id: "b", matchdayResultId: "r1", teamId: "H-1", playerId: "H-1-p5", scoreContribution: 14 },
    ] as never;
    const l = ermittleLieblingsspieler(gs, "H-1");
    expect(l?.playerId).toBe("H-1-p5");
    expect(l?.quelle).toBe("aktuell");
  });

  it("Verkauf kostet -1,0 Vertrauen, Verlaengerung bringt +0,3, Freigabe nimmt den Abzug weg", () => {
    const gs = mitPp(fixture());
    const normal = baueLieblingsspielerZiel(gs, "H-1")!;
    expect(normal.status).toBe("open");
    expect(normal.targetValue).toBe("H-1-p2");

    const verkauft = { ...gs, rosters: gs.rosters.filter((r) => r.playerId !== "H-1-p2") };
    // Die Wahl steht im gespeicherten Ziel: fest fuer die Saison, auch wenn er weg ist.
    const festgelegt = {
      ...verkauft,
      seasonState: { ...verkauft.seasonState, teamSeasonObjectives: [{ ...normal, seasonId: "season-3", teamId: "H-1", source: "vorstand_lieblingsspieler" }] },
    } as GameState;
    const weg = baueLieblingsspielerZiel(festgelegt, "H-1")!;
    expect(weg.status).toBe("failed");
    expect(weg.boardConfidenceDelta).toBe(LIEBLING_VERKAUF_VERTRAUEN);
    expect(weg.penaltyCash).toBeUndefined();

    const verlaengert = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        contractEvents: [{ eventId: "e", seasonId: "season-3", teamId: "H-1", playerId: "H-1-p2", eventType: "contract_renewed" }],
      },
    } as unknown as GameState;
    const plus = baueLieblingsspielerZiel(verlaengert, "H-1")!;
    expect(plus.status).toBe("completed");
    expect(plus.boardConfidenceDelta).toBe(LIEBLING_VERLAENGERUNG_VERTRAUEN);

    // Gespraech: freigegeben -> kein Abzug.
    const frei = {
      ...festgelegt,
      seasonState: {
        ...festgelegt.seasonState,
        vorstandGespraeche: { "H-1": { ...lesVorstandGespraech(festgelegt, "H-1"), lieblingFreigegeben: true } },
      },
    } as GameState;
    expect(baueLieblingsspielerZiel(frei, "H-1")!.boardConfidenceDelta).toBe(0);

    // KI-Team: bis zur Messung mit 32 KI-Teams gibt es das Ziel dort gar nicht (kein Delta, kein Druck, keine Zaehlung).
    const kiGs = mitPp(fixture());
    kiGs.seasonState.seasonSnapshots = [
      { seasonId: "season-2", playerPerformances: [{ playerId: "K-1-p2", pps: 70, appearances: 10 }] },
    ] as never;
    expect(baueLieblingsspielerZiel(kiGs, "K-1")).toBeNull();
  });

  it("Bitte „Lieblingsspieler freigeben“ im Gespraech setzt die Freigabe", () => {
    const gs = mitPp(fixture({ vertrauen: { "H-1": 5, "H-2": 3, "K-1": 5 } }));
    const r = stelleGespraechAntrag(gs, "H-1", { bitte: "liebling", zusagen: ["vertrauen", "zielhoch"] });
    if (r.ausgang === "zustimmung") expect(lesVorstandGespraech(r.gameState, "H-1").lieblingFreigegeben).toBe(true);
    expect(lesVorstandGespraech(r.gameState, "H-1").genutzt).toBe(1);
  });
});

describe("Laufzeit-Ziel: Vertragslaufzeiten", () => {
  it("alle Vertraege enden zugleich: gefaehrdet, nach Saisonende verfehlt; gestreut: erfuellt", () => {
    const zugleich = fixture({ enden: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] });
    const z = baueVertragslaufzeitZiel(zugleich, "H-1")!;
    expect(z.currentValue).toBe(10);
    expect(z.targetValue).toBe(3);
    expect(z.status).toBe("at_risk");
    expect(z.boardConfidenceDelta).toBe(0);
    expect(z.laufzeit).toEqual({ vonSaisonNr: 3, bisSaisonNr: 4 });
    expect(z.penaltyCash).toBeUndefined();

    const ende = fixture({ enden: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] });
    ende.seasonState.matchdayResults = ["md-1", "md-2", "md-3"].map((m) => ({ id: `r-${m}`, seasonId: "season-3", matchdayId: m })) as never;
    const verfehlt = baueVertragslaufzeitZiel(ende, "H-1")!;
    expect(verfehlt.status).toBe("failed");
    expect(verfehlt.boardConfidenceDelta).toBe(-0.4);
    // KI-Team: das Ziel gibt es dort bis zur Messung nicht.
    expect(baueVertragslaufzeitZiel(ende, "K-1")).toBeNull();

    const gestreut = baueVertragslaufzeitZiel(fixture({ enden: [4, 5, 6, 4, 5, 6, 7, 8, 4, 5] }), "H-1")!;
    expect(gestreut.status).toBe("completed");
    expect(gestreut.boardConfidenceDelta).toBe(0.3);
    // Saison 1 kennt das Ziel nicht (Draft-Vertraege laufen fest ein Jahr).
    const s1 = fixture();
    s1.season = { ...s1.season, id: "season-1", name: "Season 1" };
    expect(baueVertragslaufzeitZiel(s1, "H-1")).toBeNull();
  });

  it("die Laufzeit mehrerer Saisons steht am Ziel und im Office-Modell", () => {
    const gs = refreshTeamObjectiveState(fixture({ enden: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] }));
    const m = buildOfficeModell(gs, "H-1")!;
    const z = m.ziele.find((x) => x.id === "board-vertragslaufzeiten");
    expect(z).toBeDefined();
    expect(z!.mehrjaehrig).toBe(true);
    expect(z!.laufzeitText).toBe("bis Ende Saison 4");
    expect(z!.neu).toBe(true);
    expect(m.vertraege?.grenze).toBe(3);
  });
});

describe("Keine Geldstrafen", () => {
  it("ein verfehltes Ziel kostet nur Vertrauen: die Abrechnung bucht nie einen Geldabzug", () => {
    const gs = refreshTeamObjectiveState(fixture({ vertrauen: { "H-1": 2, "H-2": 2, "K-1": 2 } }));
    // Alle Ziele auf „verfehlt“ mit Altfeld penaltyCash: gebucht wird trotzdem nichts.
    const verfehlt = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        teamSeasonObjectives: (gs.seasonState.teamSeasonObjectives ?? []).map((o) => ({ ...o, status: "failed" as const, penaltyCash: 7, boardConfidenceDelta: -0.5 })),
      },
    } as GameState;
    const abrechnung = buildTeamSeasonObjectiveSettlement(verfehlt);
    expect(abrechnung.rows.length).toBeGreaterThan(0);
    expect(abrechnung.rows.every((r) => r.cashDelta >= 0)).toBe(true);
    expect(abrechnung.totals.cashDelta).toBeGreaterThanOrEqual(0);
    const m = buildOfficeModell(verfehlt, "H-1")!;
    expect(JSON.stringify(m)).not.toMatch(/penaltyCash|Malus/);
  });
});

describe("Praemien", () => {
  it("Sperre: fest geplante Praemien ueber dem freien Gehaltstopf lassen sich nicht speichern", () => {
    const gs = fixture();
    const frei = berechneVorstandBudgetStand(gs, "H-1").gehalt.frei;
    const klein = setzePraemienPlan(gs, "H-1", { siegStufe: 1, treueStufe: 0 });
    expect(klein.ok || klein.reason === "gehaltstopf_zu_klein").toBe(true);
    // Gehaltstopf leer druecken: sehr hohe Gehaelter.
    const teuer = { ...gs, rosters: gs.rosters.map((r) => (r.teamId === "H-1" ? { ...r, salary: 400 } : r)) };
    expect(berechneVorstandBudgetStand(teuer, "H-1").gehalt.frei).toBe(0);
    const r = setzePraemienPlan(teuer, "H-1", { siegStufe: 2, treueStufe: 2 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("gehaltstopf_zu_klein");
    expect(r.meldung).toMatch(/Sperre ist hart/);
    expect(frei).toBeGreaterThanOrEqual(0);
  });

  it("nur Menschen: die KI bekommt keinen Plan und keine Buchung", () => {
    const gs = fixture();
    expect(setzePraemienPlan(gs, "K-1", { siegStufe: 1, treueStufe: 1 }).reason).toBe("nur_mensch");
    expect(lesPraemienPlan(gs, "K-1").siegStufe).toBe(0);
  });

  it("Treuepraemie: bucht Anteil des neuen Gehalts aus dem Gehaltstopf, hebt die Moral, nie doppelt", () => {
    const gs0 = fixture();
    const gs = setzePraemienPlan(gs0, "H-1", { siegStufe: 0, treueStufe: 2 }).gameState;
    expect(lesPraemienPlan(gs, "H-1").treueStufe).toBe(2);
    const cashVorher = gs.teams.find((t) => t.teamId === "H-1")!.cash;
    const frei0 = berechneVorstandBudgetStand(gs, "H-1").gehalt.frei;
    const nach = bucheTreuepraemie(gs, "H-1", "H-1-p1", 6, "ev-1");
    expect(nach.teams.find((t) => t.teamId === "H-1")!.cash).toBeCloseTo(cashVorher - 0.6, 5);
    expect(lesPraemienPlan(nach, "H-1").treueGebucht).toBeCloseTo(0.6, 5);
    expect(berechneVorstandBudgetStand(nach, "H-1").gehalt.frei).toBeCloseTo(frei0 - 0.6, 1);
    expect(nach.playerMoraleState!.find((p) => p.playerId === "H-1-p1")!.morale).toBe(70);
    expect(nach.playerMoraleState!.find((p) => p.playerId === "H-1-p2")!.morale).toBe(60);
    const doppelt = bucheTreuepraemie(nach, "H-1", "H-1-p1", 6, "ev-1");
    expect(lesPraemienPlan(doppelt, "H-1").treueGebucht).toBeCloseTo(0.6, 5);
    // Das Team des anderen Menschen bleibt unberuehrt (Mehrspieler).
    expect(doppelt.teams.find((t) => t.teamId === "H-2")!.cash).toBe(90);
    expect(lesPraemienPlan(doppelt, "H-2").treueGebucht).toBe(0);
  });

  it("Siegpraemie: je Sieg und Einsatz, nur mit Plan, idempotent je Spieltag", () => {
    const gs0 = fixture();
    const gs1 = setzePraemienPlan(gs0, "H-1", { siegStufe: 2, treueStufe: 0 }).gameState;
    const gs = {
      ...gs1,
      seasonState: {
        ...gs1.seasonState,
        matchdayResults: [{ id: "res-1", seasonId: "season-3", matchdayId: "md-1" }],
        disciplineResults: [
          { id: "d1", matchdayResultId: "res-1", teamId: "H-1", disciplineId: "a", disciplineSide: "d1", rank: 1, ergebnisNormiert: [7, 4] },
          { id: "d2", matchdayResultId: "res-1", teamId: "H-1", disciplineId: "b", disciplineSide: "d2", rank: 3, ergebnisNormiert: [3, 8] },
          { id: "d3", matchdayResultId: "res-1", teamId: "H-2", disciplineId: "a", disciplineSide: "d1", rank: 1, ergebnisNormiert: [7, 4] },
        ],
        playerDisciplinePerformances: ["p0", "p1", "p2", "p3"].map((p, i) => ({ id: `pp${i}`, matchdayResultId: "res-1", teamId: "H-1", playerId: `H-1-${p}`, disciplineSide: "d1" })),
      },
    } as unknown as GameState;
    const nach = bucheSiegpraemien(gs, "res-1");
    // D1 gewonnen, D2 verloren: 1 Sieg x 4 Eingesetzte (auf D1) x 0,02 = 0,08 C.
    expect(lesPraemienPlan(nach, "H-1").siegGebucht).toBeCloseTo(0.08, 5);
    expect(nach.teams.find((t) => t.teamId === "H-1")!.cash).toBeCloseTo(90 - 0.08, 5);
    expect(nach.playerMoraleState!.find((p) => p.playerId === "H-1-p0")!.morale).toBe(62);
    expect(nach.playerMoraleState!.find((p) => p.playerId === "H-1-p9")!.morale).toBe(60);
    // H-2 hat keinen Plan: kein Abzug, auch wenn es einen Sieg gab.
    expect(nach.teams.find((t) => t.teamId === "H-2")!.cash).toBe(90);
    const nochmal = bucheSiegpraemien(nach, "res-1");
    expect(lesPraemienPlan(nochmal, "H-1").siegGebucht).toBeCloseTo(0.08, 5);
  });
});

describe("Mehrspieler: je Team getrennt", () => {
  it("zwei menschliche Teams haben eigene Gespraeche, Ziele und Praemien", () => {
    const gs = fixture({ vertrauen: { "H-1": 8, "H-2": 3.2, "K-1": 5 } });
    const a = stelleGespraechAntrag(gs, "H-2", { bitte: "stufe", zusagen: ["vertrauen", "binden", "zielhoch"] });
    expect(lesVorstandGespraech(a.gameState, "H-2").genutzt).toBe(1);
    expect(lesVorstandGespraech(a.gameState, "H-1").genutzt).toBe(0);
    const p = setzePraemienPlan(a.gameState, "H-1", { siegStufe: 1, treueStufe: 1 });
    expect(lesPraemienPlan(p.gameState, "H-1").siegStufe).toBe(1);
    expect(lesPraemienPlan(p.gameState, "H-2").siegStufe).toBe(0);
    const m1 = buildOfficeModell(p.gameState, "H-1")!;
    const m2 = buildOfficeModell(p.gameState, "H-2")!;
    expect(m1.teamId).toBe("H-1");
    expect(m2.teamId).toBe("H-2");
    expect(m1.gespraech.genutzt).toBe(0);
    expect(m2.gespraech.genutzt).toBe(1);
    expect(m1.vertrauen).toBe(8);
    expect(m2.vertrauen).toBeCloseTo(3.2, 5);
    expect(m1.charakter).not.toBe(m2.charakter);
  });

  it("das Office-Modell rechnet Raenge so, dass Rang 1 der beste ist (Gehaltskosten: das guenstigste Team)", () => {
    const gs = fixture();
    gs.rosters = gs.rosters.map((r) => (r.teamId === "K-1" ? { ...r, salary: 1 } : r));
    const m = buildOfficeModell(gs, "H-1")!;
    expect(m.raenge.gehaltskosten?.rang).toBe(2);
    const k = buildOfficeModell(gs, "K-1")!;
    expect(k.raenge.gehaltskosten?.rang).toBe(1);
    expect(buildTeamObjectiveOverview(gs).objectives.length).toBeGreaterThan(0);
  });
});

/* ====================================================================================================================
 * Review-Funde 21.11. und Behebung (Doku: docs/design/office-vorstand-bau-21-11.md)
 * ================================================================================================================== */

/** Zeilen fuer die Praemien-Tests: H-1 spielt, je Seite eigene Eingesetzte. */
function spieltagMitZeilen(
  gs: GameState,
  zeilen: Array<{ id: string; side: "d1" | "d2"; extra: Record<string, unknown>; spieler: string[] }>,
  resultId = "res-1",
): GameState {
  return {
    ...gs,
    seasonState: {
      ...gs.seasonState,
      matchdayResults: [...(gs.seasonState.matchdayResults ?? []).filter((r) => r.id !== resultId), { id: resultId, seasonId: "season-3", matchdayId: "md-1" }],
      disciplineResults: [
        ...(gs.seasonState.disciplineResults ?? []).filter((r) => r.matchdayResultId !== resultId),
        ...zeilen.map((z) => ({ id: `${resultId}-${z.id}`, matchdayResultId: resultId, teamId: "H-1", disciplineId: z.id, disciplineSide: z.side, rank: 16, ...z.extra })),
      ],
      playerDisciplinePerformances: [
        ...(gs.seasonState.playerDisciplinePerformances ?? []).filter((r) => r.matchdayResultId !== resultId),
        ...zeilen.flatMap((z) => z.spieler.map((p, i) => ({ id: `${resultId}-${z.id}-${i}`, matchdayResultId: resultId, teamId: "H-1", playerId: p, disciplineSide: z.side }))),
      ],
    },
  } as unknown as GameState;
}

describe("Review 21.11: Praemien", () => {
  const d1 = { id: "a", side: "d1" as const, extra: { ergebnisNormiert: [7, 4] }, spieler: ["H-1-p0", "H-1-p1"] };
  const d2 = { id: "b", side: "d2" as const, extra: { ergebnisNormiert: [6, 3] }, spieler: ["H-1-p2", "H-1-p3", "H-1-p4"] };

  it("gestaffelter Commit: D1 zahlt bei D1, D2 zahlt spaeter bei D2; Replay zahlt nie doppelt", () => {
    const plan = setzePraemienPlan(fixture(), "H-1", { siegStufe: 2, treueStufe: 0 }).gameState;
    // Commit 1: nur D1 liegt vor.
    const nachD1 = bucheSiegpraemien(spieltagMitZeilen(plan, [d1]), "res-1", ["d1"]);
    expect(lesPraemienPlan(nachD1, "H-1").siegGebucht).toBeCloseTo(0.04, 5);
    // Commit 2 (dieselbe matchdayResultId): D2 kommt dazu, nur D2 ist neu.
    const nachD2 = bucheSiegpraemien(spieltagMitZeilen(nachD1, [d1, d2]), "res-1", ["d2"]);
    expect(lesPraemienPlan(nachD2, "H-1").siegGebucht).toBeCloseTo(0.04 + 0.06, 5);
    expect(nachD2.teams.find((t) => t.teamId === "H-1")!.cash).toBeCloseTo(90 - 0.1, 5);
    // Je Seite zahlen nur die auf dieser Seite Eingesetzten: p0 (nur D1) und p2 (nur D2) je einmal +2.
    expect(nachD2.playerMoraleState!.find((p) => p.playerId === "H-1-p0")!.morale).toBe(62);
    expect(nachD2.playerMoraleState!.find((p) => p.playerId === "H-1-p2")!.morale).toBe(62);
    expect(nachD2.playerMoraleState!.find((p) => p.playerId === "H-1-p9")!.morale).toBe(60);
    // Replay beider Commits: nichts mehr.
    const replay = bucheSiegpraemien(bucheSiegpraemien(nachD2, "res-1", ["d1"]), "res-1", ["d2"]);
    expect(lesPraemienPlan(replay, "H-1").siegGebucht).toBeCloseTo(0.1, 5);
    expect(replay.teams.find((t) => t.teamId === "H-1")!.cash).toBeCloseTo(90 - 0.1, 5);
    // Ohne Seitenangabe (Voll-Re-Apply) zaehlt ebenfalls nur, was noch offen ist.
    expect(lesPraemienPlan(bucheSiegpraemien(nachD2, "res-1"), "H-1").siegGebucht).toBeCloseTo(0.1, 5);
  });

  it("Sieg heisst gewonnene Begegnung: Duell-Niederlage auf Rang 1 zaehlt nicht, im Pod nur Platz 1", () => {
    const plan = setzePraemienPlan(fixture(), "H-1", { siegStufe: 1, treueStufe: 0 }).gameState;
    const gebucht = (zeile: { id: string; side: "d1" | "d2"; extra: Record<string, unknown>; spieler: string[] }) =>
      lesPraemienPlan(bucheSiegpraemien(spieltagMitZeilen(plan, [zeile]), "res-1", ["d1"]), "H-1").siegGebucht;
    expect(gebucht({ id: "a", side: "d1", extra: { rank: 1, ergebnisNormiert: [4, 7] }, spieler: ["H-1-p0"] })).toBe(0);
    expect(gebucht({ id: "a", side: "d1", extra: { rank: 1, ergebnisNormiert: [5, 5] }, spieler: ["H-1-p0"] })).toBe(0);
    expect(gebucht({ id: "a", side: "d1", extra: { rank: 16, verhaeltnis: 3 }, spieler: ["H-1-p0"] })).toBeCloseTo(0.01, 5);
    const pod = (platz: number) => ({
      id: "a",
      side: "d1" as const,
      extra: { rank: platz === 1 ? 16 : 1, miniDmPod: { podId: "p", platz, teamIds: ["H-1", "H-2", "K-1", "X"], wert: 5 } },
      spieler: ["H-1-p0"],
    });
    expect(gebucht(pod(1))).toBeCloseTo(0.01, 5);
    expect(gebucht(pod(2))).toBe(0);
    // Alte Zeile ohne diese Felder: Rueckfall auf die obere Haelfte nach Rang (3 Teams: Rang 1 gewinnt).
    expect(gebucht({ id: "a", side: "d1", extra: { rank: 1 }, spieler: ["H-1-p0"] })).toBeCloseTo(0.01, 5);
    expect(gebucht({ id: "a", side: "d1", extra: { rank: 3 }, spieler: ["H-1-p0"] })).toBe(0);
  });

  it("ungekuerztes Geld-Log: alle Zahlungen stehen drin, auch wenn das Anzeige-Protokoll kuerzt; Moral-Kennungen sind eindeutig", () => {
    let gs = setzePraemienPlan(fixture(), "H-1", { siegStufe: 1, treueStufe: 2 }).gameState;
    for (let i = 1; i <= 15; i += 1) {
      gs = spieltagMitZeilen(gs, [{ ...d1, spieler: ["H-1-p0"] }], `res-${i}`);
      gs = bucheSiegpraemien(gs, `res-${i}`, ["d1"]);
    }
    gs = bucheTreuepraemie(gs, "H-1", "H-1-p1", 6, "ev-1");
    const plan = lesPraemienPlan(gs, "H-1");
    expect(plan.protokoll.length).toBeLessThanOrEqual(12);
    const log = lesPraemienLog(gs, "H-1");
    expect(log.length).toBe(16);
    expect(log.filter((e) => e.art === "sieg").length).toBe(15);
    const summe = log.reduce((a, e) => a + e.cashDelta, 0);
    expect(summe).toBeCloseTo(-(plan.siegGebucht + plan.treueGebucht), 5);
    expect(gs.teams.find((t) => t.teamId === "H-1")!.cash).toBeCloseTo(90 + summe, 5);
    // H-2 hat nichts gezahlt: eigenes Log je Team.
    expect(lesPraemienLog(gs, "H-2").length).toBe(0);
    const ids = gs.playerMoraleState!.find((p) => p.playerId === "H-1-p0")!.reasons.map((r) => r.reasonId);
    expect(new Set(ids).size).toBe(ids.length);
    // Ein Saisonwechsel loescht das Log nicht: es bleibt je Saison lesbar.
    const naechste = { ...gs, season: { ...gs.season, id: "season-4", name: "Season 4" } } as GameState;
    expect(lesPraemienLog(naechste, "H-1").length).toBe(16);
    expect(lesPraemienLog(naechste, "H-1", "season-3").length).toBe(16);
    expect(lesPraemienLog(naechste, "H-1", "season-4").length).toBe(0);
  });

  it("Finanz-Audit fuehrt die Praemien als eigenen Kanal und der Kontoauszug zeigt sie", () => {
    let gs = setzePraemienPlan(fixture(), "H-1", { siegStufe: 2, treueStufe: 0 }).gameState;
    gs = bucheSiegpraemien(spieltagMitZeilen(gs, [d1, d2]), "res-1");
    const log = lesPraemienLog(gs, "H-1");
    expect(log.length).toBe(2);
    const summe = log.reduce((a, e) => a + e.cashDelta, 0);
    expect(summe).toBeLessThan(0);
    const audit = buildTransferFinanceAudit(gs);
    const zeile = audit.rows.find((r) => r.teamId === "H-1" && r.seasonId === "season-3");
    expect(zeile?.netPraemienCash).toBeCloseTo(summe, 5);
    const konto = buildTeamKontoauszug(gs, "H-1");
    expect(konto.jeArt.vorstand_praemien).toBeCloseTo(summe, 5);
  });
});

describe("Review 21.11: KI bleibt bis zur Messung neutral", () => {
  it("die neuen Zielarten gibt es nur bei Menschen: kein Eintrag, kein Delta, kein Druck bei KI-Teams", () => {
    const gs = refreshTeamObjectiveState(mitPp(fixture({ enden: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] })));
    const ids = (teamId: string) => (gs.seasonState.teamSeasonObjectives ?? []).filter((o) => o.teamId === teamId).map((o) => o.objectiveId);
    expect(ids("H-1")).toContain("board-lieblingsspieler");
    expect(ids("H-1")).toContain("board-vertragslaufzeiten");
    expect(ids("K-1")).not.toContain("board-lieblingsspieler");
    expect(ids("K-1")).not.toContain("board-vertragslaufzeiten");
    // Auch nach dem Saisonende: nichts fuer die KI in der Abrechnung.
    const ende = { ...gs, seasonState: { ...gs.seasonState, matchdayResults: ["md-1", "md-2", "md-3"].map((m) => ({ id: `r-${m}`, seasonId: "season-3", matchdayId: m })) } } as GameState;
    const abrechnung = buildTeamSeasonObjectiveSettlement(refreshTeamObjectiveState(ende));
    expect(abrechnung.rows.filter((r) => r.teamId === "K-1" && /board-(lieblingsspieler|vertragslaufzeiten)/.test(r.objectiveId)).length).toBe(0);
  });

  it("Mensch symmetrisch: Bonus und Malus gelten, Vertragslaufzeit zahlt dort wie die uebrigen Vorstandsziele Geld", () => {
    const gestreut = baueVertragslaufzeitZiel(fixture({ enden: [4, 5, 6, 4, 5, 6, 7, 8, 4, 5] }), "H-1")!;
    expect(gestreut.boardConfidenceDelta).toBe(0.3);
    expect(gestreut.rewardCash).toBe(2);
    const ende = fixture({ enden: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] });
    ende.seasonState.matchdayResults = ["md-1", "md-2", "md-3"].map((m) => ({ id: `r-${m}`, seasonId: "season-3", matchdayId: m })) as never;
    expect(baueVertragslaufzeitZiel(ende, "H-1")!.boardConfidenceDelta).toBe(-0.4);
  });

  it("aktuelle PP ohne Ergebnisse dieser Saison ist leer, nicht die Summe aller Saisons", () => {
    const gs = fixture();
    gs.seasonState.matchdayResults = [];
    gs.seasonState.playerDisciplinePerformances = [{ id: "alt", matchdayResultId: "aus-der-vorsaison", teamId: "H-1", playerId: "H-1-p4", scoreContribution: 30 }] as never;
    expect(ermittleLieblingsspieler(gs, "H-1")).toBeNull();
  });
});

describe("Review 21.11: Zieltausch", () => {
  const mitZielen = () => refreshTeamObjectiveState(fixture({ vertrauen: { "H-1": 6, "H-2": 3, "K-1": 5 } }));

  it("ein bereits erfuelltes oder verfehltes Kandidatenziel ist kein Ersatz", () => {
    // H-1 steht auf Rang 1: das Rang-Ziel im Pool ist erfuellt und darf nie als Ersatz eingetauscht werden.
    const basis = mitZielen();
    const rang1 = {
      ...basis,
      seasonState: { ...basis.seasonState, standings: { "K-1": { points: 80, rank: 3 }, "H-2": { points: 90, rank: 2 }, "H-1": { points: 100, rank: 1 } } },
    } as unknown as GameState;
    const pool = getTeamObjectivePool(rang1, "H-1");
    const erledigt = pool.filter((k) => k.status === "completed" || k.status === "failed").map((k) => k.objectiveId);
    expect(erledigt.length).toBeGreaterThan(0);
    for (const ziel of (rang1.seasonState.teamSeasonObjectives ?? []).filter((o) => o.teamId === "H-1" && istZielTauschbar(o))) {
      const r = tauscheVorstandsZiel(rang1, "H-1", ziel.objectiveId);
      if (r.ok) expect(erledigt).not.toContain(r.neu!.objectiveId);
    }
  });

  it("nur bis Spieltag 10 oder im Transferfenster; danach gesperrt mit Begruendung", () => {
    const gs = mitZielen();
    const probe = (gs.seasonState.teamSeasonObjectives ?? []).find((o) => o.teamId === "H-1" && istZielTauschbar(o))!;
    const matchdayIds = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
    const spaet = (n: number, phase: string) =>
      ({
        ...gs,
        gamePhase: phase,
        season: { ...gs.season, matchdayIds },
        seasonState: { ...gs.seasonState, matchdayResults: matchdayIds.slice(0, n).map((m) => ({ id: `r-${m}`, seasonId: "season-3", matchdayId: m })) },
      }) as unknown as GameState;
    expect(zielTauschZeitfenster(spaet(10, "season_active")).erlaubt).toBe(true);
    expect(zielTauschZeitfenster(spaet(11, "season_active")).erlaubt).toBe(false);
    expect(zielTauschZeitfenster(spaet(11, "season_end_management")).erlaubt).toBe(true);
    const zu = tauscheVorstandsZiel(spaet(12, "season_active"), "H-1", probe.objectiveId);
    expect(zu.ok).toBe(false);
    expect(zu.reason).toBe("tausch_zu_spaet");
    // Die Bitte im Gespraech ist gesperrt, mit Begruendung (die UI zeigt sie am Knopf), und das Office-Modell bietet nichts an.
    const e = beurteileGespraech(spaet(12, "season_active"), "H-1", { bitte: "ziel", zielId: probe.objectiveId, zusagen: [] });
    expect(e.sperre).toMatch(/Spieltag 10/);
    expect(buildOfficeModell(spaet(12, "season_active"), "H-1")!.ziele.some((z) => z.tauschbar)).toBe(false);
  });
});

describe("Review 21.11: Zusagen und Antraege", () => {
  it("Zusage „Vertrauen einsetzen“: kein verfehltes/gefaehrdetes Ziel, kein Druck, keine Inbox-Meldung, Kosten erst bei der naechsten Festlegung", () => {
    const gs0 = fixture({ vertrauen: { "H-1": 8, "H-2": 3.4, "K-1": 5 } });
    const vorher = refreshTeamObjectiveState(gs0);
    const wertVorher = vorher.seasonState.boardConfidence!["H-1"]!.value;
    const druckVorher = vorher.seasonState.boardConfidence!["H-1"]!.pressure;
    const mitZusage = {
      ...vorher,
      seasonState: {
        ...vorher.seasonState,
        vorstandGespraeche: { ...(vorher.seasonState.vorstandGespraeche ?? {}), "H-1": { ...lesVorstandGespraech(vorher, "H-1"), zusagen: [{ art: "vertrauen", seit: "x" }] } },
      },
    } as unknown as GameState;
    const nach = refreshTeamObjectiveState(mitZusage);
    const z = (nach.seasonState.teamSeasonObjectives ?? []).find((o) => o.teamId === "H-1" && o.objectiveId === "vorstand-gespraech-vertrauen")!;
    expect(z).toBeDefined();
    expect(z.status).toBe("open");
    expect(nach.seasonState.boardConfidence!["H-1"]!.value).toBe(wertVorher);
    expect(nach.seasonState.boardConfidence!["H-1"]!.pressure).toBe(druckVorher);
    expect(nach.seasonState.boardConfidence!["H-1"]!.warnings).toEqual(vorher.seasonState.boardConfidence!["H-1"]!.warnings);
    expect(resolveVorstandFreigabe(nach, "H-1").vertrauen).toBe(wertVorher);
    // Keine Inbox-Meldung „Board-Ziel verfehlt/gefaehrdet" fuer die Zusage.
    const inbox = buildGameInboxItems({ gameState: nach, saveId: "s", activeTeamId: "H-1" });
    expect(inbox.some((i) => /Zusage an den Vorstand/.test(i.title ?? ""))).toBe(false);
    // Die Kosten werden erst bei der naechsten Festlegung (Abrechnung) gebucht.
    const abrechnung = buildTeamSeasonObjectiveSettlement(nach);
    const zeile = abrechnung.rows.find((r) => r.teamId === "H-1" && r.objectiveId === "vorstand-gespraech-vertrauen")!;
    expect(zeile.boardConfidenceDelta).toBe(-0.25);
  });

  it("Kostenvermerk „Ruecklage angezapft“ ist kein verfehltes Ziel und loest keine Inbox-Meldung aus", () => {
    const gs0 = fixture({ vertrauen: { "H-1": 8, "H-2": 3.4, "K-1": 5 } });
    const gs = refreshTeamObjectiveState({
      ...gs0,
      seasonState: { ...gs0.seasonState, vorstandBudget: { "H-1": { ...lesVorstandZustand(gs0, "H-1"), ruecklageAngezapft: 1, vertrauensKosten: 0.25 } } },
    } as unknown as GameState);
    expect((gs.seasonState.teamSeasonObjectives ?? []).some((o) => o.teamId === "H-1" && o.objectiveId === "vorstand-ruecklage-angezapft")).toBe(true);
    const inbox = buildGameInboxItems({ gameState: gs, saveId: "s", activeTeamId: "H-1" });
    expect(inbox.some((i) => /angezapft/i.test(i.title ?? ""))).toBe(false);
  });

  it("Zusage „Lieblingsspieler verlaengern“ ist gesperrt, wenn er diese Saison schon verlaengert ist; keine doppelte +0,3", () => {
    const gs = mitPp(fixture({ vertrauen: { "H-1": 5, "H-2": 3, "K-1": 5 } }));
    const verlaengert = {
      ...gs,
      seasonState: { ...gs.seasonState, contractEvents: [{ eventId: "e", seasonId: "season-3", teamId: "H-1", playerId: "H-1-p2", eventType: "contract_renewed" }] },
    } as unknown as GameState;
    const e = beurteileGespraech(verlaengert, "H-1", { bitte: "stufe", zusagen: ["binden"] });
    expect(e.zusagenVerfuegbar.binden).toMatch(/schon verlängert/);
    expect(beurteileGespraech(gs, "H-1", { bitte: "stufe", zusagen: [] }).zusagenVerfuegbar.binden).toBeNull();
    // Hat der Mensch die Verlaengerung zugesagt UND wird verlaengert, zahlt nur die Zusage die +0,3.
    const zugesagt = {
      ...verlaengert,
      seasonState: {
        ...verlaengert.seasonState,
        vorstandGespraeche: { "H-1": { ...lesVorstandGespraech(verlaengert, "H-1"), zusagen: [{ art: "binden", playerId: "H-1-p2", seit: "x" }] } },
      },
    } as unknown as GameState;
    expect(baueLieblingsspielerZiel(zugesagt, "H-1")!.boardConfidenceDelta).toBe(0);
    const zusageZiel = baueGespraechZusageZiele(zugesagt, "H-1", 3).find((z) => z.objectiveId === "vorstand-gespraech-binden")!;
    expect(zusageZiel.boardConfidenceDelta).toBe(0.3);
    expect(baueLieblingsspielerZiel(verlaengert, "H-1")!.boardConfidenceDelta).toBe(0.3);
  });

  it("fehlerhafter Antrag (Betrag oder Ziel fehlt) verbraucht kein Gespraech", () => {
    const gs = fixture({ vertrauen: { "H-1": 8, "H-2": 3, "K-1": 5 } });
    for (const antrag of [
      { bitte: "sonder" as const, zusagen: [] },
      { bitte: "anzapf" as const, betrag: 0, zusagen: [] },
      { bitte: "ziel" as const, zusagen: [] },
      { bitte: "ziel" as const, zielId: "gibt-es-nicht", zusagen: [] },
    ]) {
      const r = stelleGespraechAntrag(gs, "H-1", antrag);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("antrag_unvollstaendig");
      expect(lesVorstandGespraech(r.gameState, "H-1").genutzt).toBe(0);
      expect(r.gameState).toBe(gs);
    }
  });
});

describe("Review 21.11: Geldstrafe, Freigabe", () => {
  it("penaltyCash wird beim Fortschreiben nicht mehr mitgefuehrt (ausser Sponsor-Spiegel)", () => {
    const gs = refreshTeamObjectiveState(fixture({ vertrauen: { "H-1": 2, "H-2": 2, "K-1": 2 } }));
    // Saisonende: viele Ziele sind verfehlt und tragen im Generator ein Altfeld penaltyCash.
    const ende = {
      ...gs,
      seasonState: { ...gs.seasonState, matchdayResults: ["md-1", "md-2", "md-3"].map((m) => ({ id: `r-${m}`, seasonId: "season-3", matchdayId: m })) },
    } as GameState;
    const pool = [...getTeamObjectivePool(ende, "H-1"), ...getTeamObjectivePool(ende, "H-2")];
    // Der Generator selbst kennt das Altfeld noch (sonst prueft der Test nichts) ...
    expect(pool.some((o) => o.penaltyCash != null)).toBe(true);
    // ... das Fortschreiben des gespeicherten Bestands fuehrt es aber nicht mehr mit.
    const vorhanden = new Set((ende.seasonState.teamSeasonObjectives ?? []).filter((o) => o.teamId === "H-1").map((o) => o.objectiveId));
    const mitAltfeld = getTeamObjectivePool(ende, "H-1").filter((o) => o.penaltyCash != null && !vorhanden.has(o.objectiveId));
    expect(mitAltfeld.length).toBeGreaterThan(0);
    const bestand = { ...ende, seasonState: { ...ende.seasonState, teamSeasonObjectives: [...(ende.seasonState.teamSeasonObjectives ?? []), ...mitAltfeld] } } as GameState;
    const nochmal = refreshTeamObjectiveState(bestand);
    const eigene = (nochmal.seasonState.teamSeasonObjectives ?? []).filter((o) => !/sponsor_v2/.test(o.source ?? ""));
    expect(eigene.length).toBeGreaterThan(0);
    for (const o of eigene) {
      if (/status_stale/.test(o.source ?? "")) continue;
      expect(o.penaltyCash, `${o.objectiveId}`).toBeUndefined();
    }
  });

  it("Stufen-Anhebung und Lockerung durch Verkaeufe stapeln nicht (altes Fenster, in dem die Lockerung gilt)", () => {
    // Im gemeinsamen Fenster (Standard) sind Verkaufserloese zu 100 % frei, die Lockerung ruht. Sie gilt nur im alten Ablauf.
    vi.stubEnv("OLY_TRANSFERFENSTER_GEMEINSAM", "0");
    try {
      const basis = fixture({ vertrauen: { "H-1": 4, "H-2": 3, "K-1": 5 } });
      const verkaeufe = [{ seasonId: "season-3", transferType: "sell", fromTeamId: "H-1", toTeamId: "X", fee: 80, netCashImpact: 80, playerId: "H-1-p0" }];
      const ohne = berechneVorstandBudgetStand(basis, "H-1");
      // Nur Lockerung: eine Stufe mehr als die Ausgangsquote.
      const nurLockerung = berechneVorstandBudgetStand({ ...basis, transferHistory: verkaeufe } as unknown as GameState, "H-1");
      expect(nurLockerung.lockerung.aktiv).toBe(true);
      expect(nurLockerung.wirksamerAnteil).toBeGreaterThan(ohne.anteil);
      // Nur Anhebung: ebenfalls genau eine Stufe mehr.
      const angehoben = {
        ...basis,
        seasonState: { ...basis.seasonState, vorstandBudget: { "H-1": { ...lesVorstandZustand(basis, "H-1"), stufenAnhebung: 1 } } },
      } as unknown as GameState;
      const nurAnhebung = berechneVorstandBudgetStand(angehoben, "H-1");
      expect(nurAnhebung.anteil).toBeGreaterThan(ohne.anteil);
      // Beides zugleich: es gilt die hoehere der beiden, nie beide; hoechstens 100 %.
      const beides = berechneVorstandBudgetStand({ ...angehoben, transferHistory: verkaeufe } as unknown as GameState, "H-1");
      expect(beides.wirksamerAnteil).toBeCloseTo(Math.max(nurAnhebung.wirksamerAnteil, nurLockerung.wirksamerAnteil), 9);
      expect(beides.wirksamerAnteil).toBeLessThanOrEqual(1);
      expect(beides.lockerung.aktiv).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("Review 21.11: Anzeigefehler", () => {
  it("Rang-Ziele nennen sinnvolle Plaetze und den Rang in der eigenen Liga", () => {
    const gs = fixture({ vertrauen: { "H-1": 6, "H-2": 3, "K-1": 5 } });
    const liga = { ...gs, seasonState: { ...gs.seasonState, leagueByTeamId: { "H-1": "L1", "H-2": "L1", "K-1": "L2" } } } as unknown as GameState;
    const pool = getTeamObjectivePool(liga, "H-1");
    const erwartung = pool.find((o) => o.objectiveId === "expectation-rank");
    expect(erwartung?.detail ?? "").not.toMatch(/mindestens 0 Plätze/);
    expect(erwartung?.detail ?? "").not.toMatch(/mindestens 1 Plätze/);
    const quote = pool.find((o) => o.objectiveId === "finance-salary-ratio");
    // In der Liga L1 gibt es zwei Teams: der Rang steht nie von 3.
    if (quote?.detail) expect(quote.detail).not.toMatch(/von 3\b/);
  });
});
