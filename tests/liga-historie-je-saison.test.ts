/**
 * IN WELCHER LIGA SPIELTE EIN TEAM IN EINER VERGANGENEN SAISON? — Chris, 02.11.:
 *
 *   „gerade auch bei den Team- und den Spieler-Drawern, dass man dann vielleicht noch hinzufuegt,
 *    in Season 1, in welcher Liga haben sie denn gespielt zu dem Zeitpunkt […] ob die dann zu dem
 *    Zeitpunkt Liga 1, 2, 3, 4, 5 irgendwas waren, falls man es nochmal erweitert".
 *
 * Geprueft wird die eine Lesestelle (`lib/season/league-history.ts`) und die Zustellwege, ueber die
 * die Liga in die Drawer kommt: Saison-Schnappschuss (Server), Kurzfassung `foundationSeasonHistory`
 * (Browser) und die Rueckrechnung aus `leagueByTeamId` + Auf-/Abstiegs-Protokollen.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildTeamCareerSeries } from "@/lib/foundation/career-series";
import {
  alsSchnappschussErsatz,
  projiziereSaisonHistorie,
} from "@/lib/persistence/foundation-season-history-projection";
import {
  buildHistoricalLeagueTierLookup,
  formatLeagueTierLabel,
  formatLeagueTierShortLabel,
  getLeagueLevel,
  leagueTierForLevel,
  toLeagueSpanningPosition,
} from "@/lib/season/league-history";

function baueSpielstand(input: {
  seasonId: string;
  leagueByTeamId?: Record<string, string>;
  leagueMovementLogs?: Array<{ seasonId: string; promotedTeamIds: string[]; relegatedTeamIds: string[] }>;
  seasonSnapshots?: SeasonSnapshotRecord[];
  foundationSeasonHistory?: unknown[];
}): GameState {
  return {
    season: { id: input.seasonId, name: input.seasonId, year: 2026, currentMatchday: 1, matchdayIds: [] },
    seasonState: {
      seasonId: input.seasonId,
      schedule: [],
      standings: {},
      leagueByTeamId: input.leagueByTeamId,
      leagueMovementLogs: (input.leagueMovementLogs ?? []).map((log, index) => ({
        id: `league-movement:${log.seasonId}:${index}`,
        saveId: "test",
        createdAt: "2026-11-02T00:00:00.000Z",
        ...log,
      })),
      seasonSnapshots: input.seasonSnapshots,
      foundationSeasonHistory: input.foundationSeasonHistory,
    },
    teams: [],
  } as unknown as GameState;
}

function baueSchnappschuss(
  seasonId: string,
  teams: Array<{ teamId: string; rank: number; leagueTier?: string | null; isGold?: boolean; isLiga2Champion?: boolean; isSilver?: boolean; isBronze?: boolean }>,
): SeasonSnapshotRecord {
  return {
    snapshotId: `snap-${seasonId}`,
    seasonId,
    seasonName: seasonId.replace("season-", "Season "),
    archivedAt: "2026-11-01T00:00:00.000Z",
    finalStandings: teams.map((team) => ({
      teamCode: team.teamId,
      teamName: team.teamId,
      points: 100,
      disciplinePoints: 100,
      cashEnd: null,
      rosterEnd: 8,
      salaryEnd: null,
      marketValueEnd: null,
      transferCount: 0,
      transferBuyCount: 0,
      transferSellCount: 0,
      transferNet: 0,
      ...team,
    })),
    playerPerformances: [],
  } as unknown as SeasonSnapshotRecord;
}

describe("Liga-Kennung — offenes Schema liga<N>, nicht auf zwei Ligen festgenagelt", () => {
  it("liest Stufe, Langform und Kurzform fuer beliebig viele Ligen", () => {
    expect(getLeagueLevel("liga1")).toBe(1);
    expect(getLeagueLevel("liga2")).toBe(2);
    expect(getLeagueLevel("liga5")).toBe(5);
    expect(getLeagueLevel(null)).toBeNull();
    expect(getLeagueLevel("ohne_liga")).toBeNull();
    expect(leagueTierForLevel(4)).toBe("liga4");
    expect(formatLeagueTierLabel("liga1")).toBe("Liga 1");
    expect(formatLeagueTierLabel("liga12")).toBe("Liga 12");
    expect(formatLeagueTierShortLabel("liga3")).toBe("L3");
    expect(formatLeagueTierLabel(null)).toBeNull();
    expect(formatLeagueTierShortLabel(undefined)).toBeNull();
  });

  it("rechnet Raenge fuer Verlaufslinien ligauebergreifend — Liga 2 liegt hinter Liga 1", () => {
    expect(toLeagueSpanningPosition(1, "liga2", 16)).toBe(17);
    expect(toLeagueSpanningPosition(16, "liga1", 16)).toBe(16);
    expect(toLeagueSpanningPosition(2, "liga3", 16)).toBe(34);
    // Manager Mode: kein Liga-Split, Rang bleibt Rang.
    expect(toLeagueSpanningPosition(5, null, 16)).toBe(5);
    expect(toLeagueSpanningPosition(null, "liga1", 16)).toBeNull();
  });
});

describe("buildHistoricalLeagueTierLookup", () => {
  it("nimmt die im Schnappschuss eingefrorene Liga — auch wenn das Team inzwischen auf-/abgestiegen ist", () => {
    const gameState = baueSpielstand({
      seasonId: "season-2",
      leagueByTeamId: { AUF: "liga1", AB: "liga2" },
      leagueMovementLogs: [{ seasonId: "season-1", promotedTeamIds: ["AUF"], relegatedTeamIds: ["AB"] }],
      seasonSnapshots: [
        baueSchnappschuss("season-1", [
          { teamId: "AUF", rank: 1, leagueTier: "liga2" },
          { teamId: "AB", rank: 16, leagueTier: "liga1" },
        ]),
      ],
    });
    const ligaVon = buildHistoricalLeagueTierLookup(gameState);

    expect(ligaVon("season-1", "AUF")).toBe("liga2");
    expect(ligaVon("season-1", "AB")).toBe("liga1");
    // Laufende Saison: die aktuelle Zuordnung.
    expect(ligaVon("season-2", "AUF")).toBe("liga1");
    expect(ligaVon("season-2", "AB")).toBe("liga2");
  });

  it("rechnet Schnappschuesse ohne Feld und die laufende Saison nach `league_movement` korrekt zurueck", () => {
    // Season 2 ist abgeschlossen, `league_movement` ist schon gelaufen (Saisonrueckblick-Fenster):
    // `leagueByTeamId` beschreibt bereits Season 3. Weder Season 1 noch Season 2 haben ein Feld.
    const gameState = baueSpielstand({
      seasonId: "season-2",
      leagueByTeamId: { X: "liga1", Y: "liga2" },
      leagueMovementLogs: [
        { seasonId: "season-1", promotedTeamIds: ["Y"], relegatedTeamIds: ["X"] },
        { seasonId: "season-2", promotedTeamIds: ["X"], relegatedTeamIds: ["Y"] },
      ],
      seasonSnapshots: [
        baueSchnappschuss("season-1", [{ teamId: "X", rank: 15 }, { teamId: "Y", rank: 2 }]),
        baueSchnappschuss("season-2", [{ teamId: "X", rank: 1 }, { teamId: "Y", rank: 14 }]),
      ],
    });
    const ligaVon = buildHistoricalLeagueTierLookup(gameState);

    expect(ligaVon("season-1", "X")).toBe("liga1");
    expect(ligaVon("season-1", "Y")).toBe("liga2");
    expect(ligaVon("season-2", "X")).toBe("liga2");
    expect(ligaVon("season-2", "Y")).toBe("liga1");
  });

  it("vertraegt mehr als zwei Ligen — eine Rueckrechnung ueber drei Stufen", () => {
    const gameState = baueSpielstand({
      seasonId: "season-4",
      leagueByTeamId: { Z: "liga1" },
      leagueMovementLogs: [
        { seasonId: "season-3", promotedTeamIds: ["Z"], relegatedTeamIds: [] },
        { seasonId: "season-2", promotedTeamIds: ["Z"], relegatedTeamIds: [] },
        { seasonId: "season-1", promotedTeamIds: ["Z"], relegatedTeamIds: [] },
      ],
    });
    const ligaVon = buildHistoricalLeagueTierLookup(gameState);

    expect(ligaVon("season-1", "Z")).toBe("liga4");
    expect(ligaVon("season-2", "Z")).toBe("liga3");
    expect(ligaVon("season-3", "Z")).toBe("liga2");
    expect(ligaVon("season-4", "Z")).toBe("liga1");
    expect(formatLeagueTierLabel(ligaVon("season-1", "Z"))).toBe("Liga 4");
  });

  it("Manager Mode / Legacy: ohne Liga-Split kommt nie eine Liga heraus", () => {
    const gameState = baueSpielstand({
      seasonId: "season-2",
      seasonSnapshots: [baueSchnappschuss("season-1", [{ teamId: "M", rank: 1, leagueTier: null }, { teamId: "N", rank: 2 }])],
    });
    const ligaVon = buildHistoricalLeagueTierLookup(gameState);

    expect(ligaVon("season-1", "M")).toBeNull();
    expect(ligaVon("season-1", "N")).toBeNull();
    expect(ligaVon("season-2", "M")).toBeNull();
    expect(ligaVon(null, "M")).toBeNull();
  });

  it("liest im Browser die Kurzfassung, wenn die Schnappschuesse gestrichen sind", () => {
    const voll = baueSchnappschuss("season-1", [
      { teamId: "AUF", rank: 1, leagueTier: "liga2" },
      { teamId: "AB", rank: 16, leagueTier: "liga1" },
    ]);
    const gameState = baueSpielstand({
      seasonId: "season-2",
      leagueByTeamId: { AUF: "liga1", AB: "liga2" },
      // Bewusst KEIN Protokoll: ohne Kurzfassung waere das Ergebnis „liga1" fuer AUF — falsch.
      foundationSeasonHistory: projiziereSaisonHistorie([voll]),
    });
    const ligaVon = buildHistoricalLeagueTierLookup(gameState);

    expect(ligaVon("season-1", "AUF")).toBe("liga2");
    expect(ligaVon("season-1", "AB")).toBe("liga1");
  });
});

describe("Kurzfassung fuer den Browser", () => {
  it("faehrt `leagueTier` mit und vergibt Gold nur an den Liga-1-Ersten", () => {
    const historie = projiziereSaisonHistorie([
      baueSchnappschuss("season-1", [
        { teamId: "L1", rank: 1, leagueTier: "liga1" },
        { teamId: "L2", rank: 1, leagueTier: "liga2" },
      ]),
    ]);
    expect(historie[0]?.teams.map((team) => [team.teamId, team.leagueTier])).toEqual([
      ["L1", "liga1"],
      ["L2", "liga2"],
    ]);

    const [ersatz] = alsSchnappschussErsatz(historie, []);
    const nachTeam = new Map((ersatz?.finalStandings ?? []).map((row) => [row.teamId, row] as const));
    expect(nachTeam.get("L1")).toMatchObject({ leagueTier: "liga1", isGold: true, isLiga2Champion: false });
    expect(nachTeam.get("L2")).toMatchObject({ leagueTier: "liga2", isGold: false, isLiga2Champion: true });
  });

  it("laesst Altfassungen ohne Feld unveraendert — kein erfundenes `null`", () => {
    const historie = projiziereSaisonHistorie([baueSchnappschuss("season-1", [{ teamId: "ALT", rank: 1 }])]);
    expect(historie[0]?.teams[0]).not.toHaveProperty("leagueTier");
    const [ersatz] = alsSchnappschussErsatz(historie, []);
    expect(ersatz?.finalStandings[0]).toMatchObject({ isGold: true });
  });
});

describe("Werdegang des Teams", () => {
  it("zeigt die Liga je Saison und gibt dem Zweitliga-Meister keine Goldmedaille", () => {
    const gameState = baueSpielstand({
      seasonId: "season-3",
      leagueByTeamId: { AUF: "liga1" },
      leagueMovementLogs: [{ seasonId: "season-1", promotedTeamIds: ["AUF"], relegatedTeamIds: [] }],
      seasonSnapshots: [
        baueSchnappschuss("season-1", [
          { teamId: "AUF", rank: 1, leagueTier: "liga2", isGold: false, isLiga2Champion: true, isSilver: false, isBronze: false },
        ]),
        baueSchnappschuss("season-2", [
          { teamId: "AUF", rank: 12, leagueTier: "liga1", isGold: false, isSilver: false, isBronze: false },
        ]),
      ],
    });

    const serie = buildTeamCareerSeries(gameState, "AUF");

    expect(serie.seasons.map((entry) => [entry.seasonId, entry.rank, entry.leagueTier, entry.medal])).toEqual([
      ["season-1", 1, "liga2", null],
      ["season-2", 12, "liga1", null],
    ]);
    // Rang 12 in Liga 1 ist besser als Rang 1 in Liga 2.
    expect(serie.superlatives.bestSeason).toMatchObject({ rank: 12, leagueTier: "liga1" });
  });
});
