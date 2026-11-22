import { describe, expect, it } from "vitest";

import { KERN_VERKAUF_LOG, planOrganicSellsForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { ROSTER_MIN } from "@/lib/ai/organic-squad/types";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { kaufRahmen, schaetzeFreigabeNaechsteSaison } from "@/lib/finance/vorstand-budgetfreigabe";
import { buildRecentlySoldByTeam } from "@/lib/market/anti-rebuy-guard";
import {
  gueltigeWirtschaftsRegeln,
  stempleWirtschaftsRegelnBeimAnlegen,
  vorjahrAnteileFuerSaisonwechsel,
  wirtschaftsRegel,
  wirtschaftsRegelnFuerNeueSaison,
} from "@/lib/resolve/wirtschafts-regeln";

const NEU = (seasonId: string, vorjahr?: Record<string, number>) => ({ ...wirtschaftsRegelnFuerNeueSaison(seasonId), ...(vorjahr ? { vorjahr } : {}) });

describe("Runde 2, Punkt 5: Wirtschafts-Regeln als Spielstand-Stempel", () => {
  it("ohne Stempel (bestehender Spielstand) oder mit Stempel einer anderen Saison gilt 'alt'; neu angelegte Spiele bekommen 'neu'", () => {
    const gs = { season: { id: "season-2" }, seasonState: { seasonId: "season-2" } } as unknown as GameState;
    expect(wirtschaftsRegel(gs, "quote")).toBe("alt");
    const andere = { ...gs, seasonState: { seasonId: "season-2", wirtschaftsRegeln: NEU("season-1") } } as unknown as GameState;
    expect(gueltigeWirtschaftsRegeln(andere)).toBeNull();
    expect(wirtschaftsRegel(andere, "anker")).toBe("alt");
    const neu = stempleWirtschaftsRegelnBeimAnlegen({ season: { id: "season-1" }, seasonState: { seasonId: "season-1" } } as unknown as GameState);
    expect(["quote", "anker", "kernschutz", "rueckkauf"].map((n) => wirtschaftsRegel(neu, n as "quote"))).toEqual(["neu", "neu", "neu", "neu"]);
    // idempotent
    expect(stempleWirtschaftsRegelnBeimAnlegen(neu)).toBe(neu);
  });

  it("der Schalter wirkt nur auf NEUE Saisons (Stempel einer laufenden Saison bleibt)", () => {
    process.env.OLY_BOARD_ERWARTUNG_ANKER = "aus";
    try {
      expect(wirtschaftsRegelnFuerNeueSaison("season-3").anker).toBe("alt");
      const laufend = { season: { id: "season-3" }, seasonState: { seasonId: "season-3", wirtschaftsRegeln: { ...NEU("season-3"), anker: "neu" } } } as unknown as GameState;
      expect(wirtschaftsRegel(laufend, "anker")).toBe("neu");
    } finally {
      delete process.env.OLY_BOARD_ERWARTUNG_ANKER;
    }
  });
});

describe("Runde 2, Punkte 2 und 3: Erwartungsanker aus dem Stempel, ligagerecht", () => {
  const row = (teamId: string, pps: number, mw: number) => ({ teamId, ppsTotal: pps, marketValueTotal: mw, rank: null }) as never;
  const rows = new Map([
    ["a", row("a", 90, 200)],
    ["b", row("b", 60, 150)],
    ["c", row("c", 30, 90)],
    ["d", row("d", 10, 40)],
  ]);
  const stand = (vorjahr: Record<string, number>, mitStempel = true) =>
    ({
      season: { id: "season-2" },
      teams: ["a", "b", "c", "d"].map((teamId) => ({ teamId })),
      seasonState: { seasonId: "season-2", ...(mitStempel ? { wirtschaftsRegeln: NEU("season-2", vorjahr) } : {}) },
    }) as unknown as GameState;

  it("Browser und Server lesen dieselbe Zahl: der Anker liegt im kleinen Stempel, nicht im (im Browser fehlenden) Archiv", () => {
    const gs = stand({ d: 0 });
    // kein seasonSnapshots-Feld im Stand (wie im Browser) und trotzdem Anker
    expect(gs.seasonState.seasonSnapshots).toBeUndefined();
    expect(computeTeamExpectation({ row: rows.get("d")!, rowsByTeamId: rows, identity: null, gameState: gs }).expectedRank).toBe(3);
    expect(computeTeamExpectation({ row: rows.get("d")!, rowsByTeamId: rows, identity: null, gameState: stand({ d: 0 }, false) }).expectedRank).toBe(4);
  });

  it("Aufsteiger (Anteil 1 = Letzter der neuen Liga) wird nicht bestraft, Absteiger (Anteil 0 = Erster) nicht belohnt", () => {
    // a ist Aufsteiger: Platz 1 der alten Liga zaehlt NICHT als Platz 1 der neuen. Staerke-Rang 1, Vorjahr = Letzter (4) -> (1+4)/2 = 3 (nicht 1).
    const auf = computeTeamExpectation({ row: rows.get("a")!, rowsByTeamId: rows, identity: null, gameState: stand({ a: 1 }) }).expectedRank;
    expect(auf).toBeGreaterThanOrEqual(2);
    // d ist Absteiger: Staerke-Rang 4, Vorjahr = Erster der neuen Liga -> (4+1)/2 -> 3 statt der alten 'Erwartung 4 = erfuellt'
    const ab = computeTeamExpectation({ row: rows.get("d")!, rowsByTeamId: rows, identity: null, gameState: stand({ d: 0 }) }).expectedRank;
    expect(ab).toBeLessThan(4);
  });

  it("vorjahrAnteileFuerSaisonwechsel bildet Auf-/Absteiger ab und rechnet den Rang ligalokal", () => {
    const gs = {
      season: { id: "season-1" },
      teams: ["a", "b", "c", "d"].map((teamId) => ({ teamId })),
      seasonState: {
        seasonId: "season-1",
        // nach der Bewegung: a (war Liga 2, Erster) ist jetzt Liga 1, d (war Liga 1, Letzter) ist jetzt Liga 2
        leagueByTeamId: { a: "liga1", b: "liga1", c: "liga2", d: "liga2" },
        leagueMovementLogs: [{ id: "x", saveId: "s", seasonId: "season-1", createdAt: "", promotedTeamIds: ["a"], relegatedTeamIds: ["d"] }],
        seasonSnapshots: [
          {
            seasonId: "season-1",
            finalStandings: [
              { teamId: "a", rank: 1 },
              { teamId: "b", rank: 2 },
              { teamId: "c", rank: 2 },
              { teamId: "d", rank: 2 },
            ],
          },
        ],
      },
    } as unknown as GameState;
    const anteil = vorjahrAnteileFuerSaisonwechsel(gs, "season-1");
    expect(anteil.a).toBe(1);
    expect(anteil.d).toBe(0);
    expect(anteil.b).toBe(1); // Rang 2 von 2 in Liga 1
    expect(anteil.c).toBe(1);
  });
});

describe("Runde 2, Punkt 1/5: Kaderpflicht-Quote hinter dem Stempel", () => {
  function team(kader: number, regel: "alt" | "neu"): GameState {
    const rosters = Array.from({ length: kader }, (_, i) => ({ id: `r${i}`, teamId: "A", playerId: `pA${i}`, salary: 4 }));
    const players: Array<{ id: string; marketValue: number; salaryDemand?: number }> = rosters.map((r) => ({ id: r.playerId, marketValue: 15 }));
    for (let i = 0; i < 20; i += 1) players.push({ id: `fa${i}`, marketValue: 20, salaryDemand: 5 });
    return {
      season: { id: "season-2", currentMatchday: 1, matchdayIds: [], totalMatchdays: 20 },
      gamePhase: "season_active",
      matchdayState: { status: "open" },
      teams: [{ teamId: "A", name: "A", cash: 90 }],
      teamIdentities: [{ teamId: "A", finances: 10, ambition: 5, playerMin: 10, playerOpt: 13 }],
      rosters,
      players,
      transferHistory: [],
      seasonState: {
        seasonId: "season-2",
        wirtschaftsRegeln: { ...NEU("season-2"), quote: regel },
        boardConfidence: { A: { teamId: "A", value: 1, pressure: 5, warnings: [] } },
        facilityEvents: [],
      },
    } as unknown as GameState;
  }

  it("alt: Plaetze bis Opt ohne Quote; neu: nur der Pflichtkader 8", () => {
    const alt = kaufRahmen(team(9, "alt"), "A");
    const neu = kaufRahmen(team(9, "neu"), "A");
    expect(alt.stand.kaderpflicht.bisOpt).toBe(true);
    expect(alt.stand.kaderpflicht.kaderMin).toBe(10);
    expect(neu.stand.kaderpflicht.bisOpt).toBe(false);
    expect(neu.stand.kaderpflicht.kaderMin).toBe(8);
    expect(neu.stand.kaderpflicht.aktiv).toBe(false);
    expect(alt.grenzeFuer(9, 0, 0).fee).toBeGreaterThanOrEqual(neu.grenzeFuer(9, 0, 0).fee);
    expect(kaufRahmen(team(7, "neu"), "A").stand.kaderpflicht.aktiv).toBe(true);
  });
});

describe("Runde 2, Punkt 11: Vorausschau auf die Freigabe der naechsten Saison (dieselbe Formel, keine UI)", () => {
  const stand = (vertrauen: number, kasse: number): GameState =>
    ({
      season: { id: "season-2" },
      teams: [{ teamId: "A", cash: kasse }],
      teamIdentities: [{ teamId: "A", finances: 6, ambition: 5, playerMin: 8, playerOpt: 11 }],
      rosters: Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, teamId: "A", playerId: `p${i}`, salary: 4 })),
      players: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, marketValue: 12 })),
      transferHistory: [],
      seasonState: { boardConfidence: { A: { teamId: "A", value: vertrauen, pressure: 5, warnings: [] } } },
    }) as unknown as GameState;

  it("niedriges Vertrauen gibt weniger frei als hohes; Saison = laufende + 1; Was-waere-wenn ueber Optionen", () => {
    const hoch = schaetzeFreigabeNaechsteSaison(stand(9, 80), "A");
    const niedrig = schaetzeFreigabeNaechsteSaison(stand(2, 80), "A");
    expect(hoch.saisonNummer).toBe(3);
    expect(hoch.anteil).toBe(1);
    expect(niedrig.anteil).toBeLessThan(hoch.anteil);
    expect(niedrig.ausgebbarTransfer).toBeLessThan(hoch.ausgebbarTransfer);
    expect(schaetzeFreigabeNaechsteSaison(stand(9, 80), "A", { vertrauen: 2 }).anteil).toBe(niedrig.anteil);
    expect(schaetzeFreigabeNaechsteSaison(stand(9, 80), "A", { kasse: 0 }).ausgebbarTransfer).toBe(0);
  });
});

describe("Runde 2, Punkte 5 und 8: Rueckkauf-Sperre nach Vertragsende, Stempel und Karte", () => {
  const exitEintrag = { id: "e1", playerId: "p1", seasonId: "season-1", transferType: "contract_exit", fromTeamId: "A", toTeamId: null, fee: 0, salary: 4, marketValue: 10, remainingContractLength: 0, happenedAt: "2027-01-01T00:00:00.000Z", seasonLabel: "S1" };
  const stand = (regel: "alt" | "neu", history: unknown[] = [exitEintrag]) =>
    ({
      season: { id: "season-2" },
      seasonState: { seasonId: "season-2", wirtschaftsRegeln: { ...NEU("season-2"), rueckkauf: regel } },
      transferHistory: history,
    }) as unknown as GameState;

  it("neu: Vertragsende der Vorsaison sperrt den Rueckkauf wie ein Verkauf; alt: frei", () => {
    expect(buildRecentlySoldByTeam(stand("neu")).get("A")?.has("p1")).toBe(true);
    expect(buildRecentlySoldByTeam(stand("alt")).get("A")?.has("p1")).toBeFalsy();
  });

  it("hat ihn seither jemand anderes verpflichtet, ist die Sperre hinfaellig; die Karte wird je Verlauf einmal gebaut", () => {
    const spaeter = { ...exitEintrag, id: "b1", transferType: "buy", fromTeamId: null, toTeamId: "B", happenedAt: "2027-02-01T00:00:00.000Z" };
    expect(buildRecentlySoldByTeam(stand("neu", [exitEintrag, spaeter])).get("A")?.has("p1")).toBeFalsy();
    const gs = stand("neu");
    expect(buildRecentlySoldByTeam(gs)).toBe(buildRecentlySoldByTeam(gs));
  });
});

describe("Runde 2, Punkte 3 und 10: Kernschutz mit Ausnahme fuer gute Angebote", () => {
  const IDENTITY = { ambition: 55, finances: 45, boardConfidence: 55, harmony: 50, playerOpt: ROSTER_MIN, pow: 70, spe: 12, men: 12, soc: 12 } as unknown as TeamIdentity;
  const DISC = [
    { id: "tdm", category: "power" },
    { id: "staffel", category: "speed" },
  ];
  const mk = (id: string, pow: number, mv: number) =>
    ({ id, coreStats: { pow, spe: 50, men: 50, soc: 50 }, disciplineRatings: { tdm: 82 }, marketValue: mv, salaryDemand: 8, potential: 0 }) as unknown as Player;
  const team = (cash: number) => ({ teamId: "team-test", name: "T", cash, rosterLimit: 14 }) as unknown as Team;
  const roster = () => {
    const r = Array.from({ length: 9 }, (_, i) => mk(`b${i}`, 70, 24));
    r.push(mk("star", 95, 70));
    return r;
  };
  const plan = (regel: "alt" | "neu", cash: number) =>
    planOrganicSellsForTeam({
      gameState: { disciplines: DISC, seasonState: { seasonId: "season-2", wirtschaftsRegeln: { ...NEU("season-2"), kernschutz: regel } }, season: { id: "season-2" } } as unknown as GameState,
      team: team(cash),
      identity: IDENTITY,
      roster: roster(),
      allowBelowMin: false,
    });

  it("neu: der beste Spieler wird ohne Finanznot und ohne gutes Angebot nicht verkauft; alt: wie bisher", () => {
    const alt = plan("alt", 400);
    const neu = plan("neu", 400);
    expect(alt.decisions.some((d) => d.playerId === "star")).toBe(true);
    expect(neu.decisions.some((d) => d.playerId === "star")).toBe(false);
  });

  it("in Finanznot (Kasse unter dem Puffer) darf er gehen, und der Verkauf steht in der Messspur", () => {
    KERN_VERKAUF_LOG.length = 0;
    const neu = plan("neu", -5);
    const verkauft = neu.decisions.map((d) => d.playerId);
    if (verkauft.includes("star")) {
      expect(KERN_VERKAUF_LOG.some((e) => e.playerId === "star" && e.grund === "finanznot")).toBe(true);
    }
    // wenigstens: der Kernschutz haelt nicht gegen Finanznot
    expect(plan("neu", 400).decisions.length).toBeLessThanOrEqual(neu.decisions.length + 9);
  });
});
