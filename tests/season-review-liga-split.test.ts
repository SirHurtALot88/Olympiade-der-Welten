/**
 * SAISONRUECKBLICK MIT ZWEI LIGEN: ENDTABELLE LIGA-LOKAL 1..N, LIGA 1 VORN, CHAMPION = LIGA-1-ERSTER (02.11.).
 *
 * Befund am Battle-Save „Battle Mode VW – alle Figuren (02.11.)" nach „Abrechnung buchen": die
 * gespeicherten Raenge waren global 1..32 (Formkarten-Strafe vor ef4e81c56), die Liga-1-Tabelle zeigte
 * 1,5,6,7,9,10,11,13,… . `buildFinalTable` las diese Raenge blind durch. Umgekehrt haetten korrekt
 * liga-lokale Raenge zwei „#1" erzeugt und den Champion vom Zufall der Einfuegereihenfolge abhaengig
 * gemacht. Beide Faelle hier, plus Manager Mode unveraendert.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonReview } from "@/lib/season/season-review-service";

type Eintrag = { teamId: string; liga: "liga1" | "liga2"; points: number; rank: number };

function stand(eintraege: Eintrag[], mitSplit = true): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 20, matchdayIds: [] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: Object.fromEntries(eintraege.map((e) => [e.teamId, { points: e.points, rank: e.rank }])),
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      ...(mitSplit ? { leagueByTeamId: Object.fromEntries(eintraege.map((e) => [e.teamId, e.liga])) } : {}),
    },
    matchdayState: { matchdayId: "matchday-20", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: eintraege.map((e) => ({
      teamId: e.teamId,
      shortCode: e.teamId,
      name: `Team ${e.teamId}`,
      budget: 100,
      cash: 50,
      identityId: `i-${e.teamId}`,
      humanControlled: false,
      rosterLimit: 12,
    })),
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
  } as unknown as GameState;
}

// Punkte interleaved: L2-A (59) liegt global VOR L1-A (57), damit eine globale Rangvergabe auffiele.
// Gespeichert sind die globalen Raenge 1..6 (Zustand nach der alten Formkarten-Strafe).
const GLOBAL_GERANKT: Eintrag[] = [
  { teamId: "L2-A", liga: "liga2", points: 59, rank: 1 },
  { teamId: "L1-A", liga: "liga1", points: 57, rank: 2 },
  { teamId: "L2-B", liga: "liga2", points: 50, rank: 3 },
  { teamId: "L1-B", liga: "liga1", points: 49, rank: 4 },
  { teamId: "L1-C", liga: "liga1", points: 30, rank: 5 },
  { teamId: "L2-C", liga: "liga2", points: 29, rank: 6 },
];

describe("Saisonrueckblick: Endtabelle je Liga", () => {
  it("globale gespeicherte Raenge -> je Liga 1..3, Liga 1 vorn, Champion ist der Liga-1-Erste", () => {
    const review = buildSeasonReview(stand(GLOBAL_GERANKT));
    const zeilen = review.finalTable as Array<{ teamId: string; rank: number; leagueTier: string; label: string }>;
    expect(zeilen.map((z) => `${z.leagueTier}#${z.rank}:${z.teamId}`)).toEqual([
      "liga1#1:L1-A",
      "liga1#2:L1-B",
      "liga1#3:L1-C",
      "liga2#1:L2-A",
      "liga2#2:L2-B",
      "liga2#3:L2-C",
    ]);
    expect(zeilen[0]!.label).toBe("#1 Liga 1 · 57 Punkte");
    expect(review.championTeam?.id).toBe("L1-A");
    expect(review.awards.find((award) => award.awardId === "champion")?.winnerId).toBe("L1-A");
  });

  it("liga-lokal gespeicherte Raenge (zwei #1) -> Champion haengt nicht an der Einfuegereihenfolge", () => {
    const ligaLokal: Eintrag[] = [
      { teamId: "L2-A", liga: "liga2", points: 59, rank: 1 },
      { teamId: "L2-B", liga: "liga2", points: 50, rank: 2 },
      { teamId: "L1-A", liga: "liga1", points: 57, rank: 1 },
      { teamId: "L1-B", liga: "liga1", points: 49, rank: 2 },
    ];
    const review = buildSeasonReview(stand(ligaLokal));
    expect(review.championTeam?.id).toBe("L1-A");
    expect((review.finalTable as Array<{ rank: number }>).map((z) => z.rank)).toEqual([1, 2, 1, 2]);
  });

  it("ohne Liga-Split (Manager Mode) bleibt der gespeicherte Rang unveraendert massgeblich", () => {
    const review = buildSeasonReview(stand(GLOBAL_GERANKT, false));
    const zeilen = review.finalTable as Array<{ teamId: string; rank: number; label: string }>;
    expect(zeilen.map((z) => `${z.rank}:${z.teamId}`)).toEqual(["1:L2-A", "2:L1-A", "3:L2-B", "4:L1-B", "5:L1-C", "6:L2-C"]);
    expect(zeilen[0]!.label).toBe("#1 · 59 Punkte");
    expect(review.championTeam?.id).toBe("L2-A");
  });
});
