import { describe, expect, it } from "vitest";

import { buildSeasonStandingsTopPlayersByTeam } from "@/lib/foundation/season-standings-top-players";

type MiniPlayer = { id: string; name: string };

function makeGameState(input: {
  players: MiniPlayer[];
  rosters: Array<{ playerId: string; teamId: string }>;
}) {
  return {
    players: input.players,
    rosters: input.rosters.map((entry, index) => ({ id: `r${index}`, ...entry })),
  } as unknown as Parameters<typeof buildSeasonStandingsTopPlayersByTeam>[0]["gameState"];
}

function makeRatings(
  entries: Record<string, { ppPow?: number | null; ppSpe?: number | null; ppMen?: number | null; ppSoc?: number | null }>,
) {
  return new Map(
    Object.entries(entries).map(([playerId, values]) => [
      playerId,
      { ppPow: values.ppPow ?? null, ppSpe: values.ppSpe ?? null, ppMen: values.ppMen ?? null, ppSoc: values.ppSoc ?? null },
    ]),
  );
}

function makeLedger(entries: Record<string, Record<string, number>>) {
  return {
    playerSummariesByPlayerId: new Map(
      Object.entries(entries).map(([playerId, pointsByDiscipline]) => [
        playerId,
        { pointsByDiscipline },
      ]),
    ),
  } as unknown as Parameters<typeof buildSeasonStandingsTopPlayersByTeam>[0]["seasonPointsLedger"];
}

describe("buildSeasonStandingsTopPlayersByTeam", () => {
  it("ranks the top 3 players per team and axis by axis PPs, dropping zero values", () => {
    const gameState = makeGameState({
      players: [
        { id: "p1", name: "Anna" },
        { id: "p2", name: "Bela" },
        { id: "p3", name: "Cora" },
        { id: "p4", name: "Doro" },
        { id: "p5", name: "Rival" },
      ],
      rosters: [
        { playerId: "p1", teamId: "A-A" },
        { playerId: "p2", teamId: "A-A" },
        { playerId: "p3", teamId: "A-A" },
        { playerId: "p4", teamId: "A-A" },
        { playerId: "p5", teamId: "B-B" },
      ],
    });
    const ratings = makeRatings({
      p1: { ppPow: 4.5 },
      p2: { ppPow: 9.1 },
      p3: { ppPow: 1.2 },
      p4: { ppPow: 6.6, ppSpe: 0 },
      p5: { ppPow: 99 },
    });

    const byTeam = buildSeasonStandingsTopPlayersByTeam({
      gameState,
      playerRatingsById: ratings,
      seasonPointsLedger: null,
    });

    const teamA = byTeam.get("A-A");
    expect(teamA).toBeTruthy();
    // Top 3 nach ppPow, absteigend — p3 (Platz 4) fällt raus, der Rivale (B-B) sowieso.
    expect(teamA!.pow?.map((entry) => entry.playerId)).toEqual(["p2", "p4", "p1"]);
    expect(teamA!.pow?.[0]?.value).toBe(9.1);
    // ppSpe = 0 → keine Liste (ehrlich leer statt Nullen-Rangfolge).
    expect(teamA!.spe).toBeUndefined();
    expect(byTeam.get("B-B")!.pow?.map((entry) => entry.playerId)).toEqual(["p5"]);
  });

  it("maps ledger discipline ids to standings column keys (mini-dm → mini_dm)", () => {
    const gameState = makeGameState({
      players: [
        { id: "p1", name: "Anna" },
        { id: "p2", name: "Bela" },
      ],
      rosters: [
        { playerId: "p1", teamId: "A-A" },
        { playerId: "p2", teamId: "A-A" },
      ],
    });
    const ledger = makeLedger({
      p1: { "mini-dm": 5.5, fechten: 0 },
      p2: { "mini-dm": 7.25, "unbekannte-disziplin": 3 },
    });

    const byTeam = buildSeasonStandingsTopPlayersByTeam({
      gameState,
      playerRatingsById: null,
      seasonPointsLedger: ledger,
    });

    const teamA = byTeam.get("A-A");
    expect(teamA!.mini_dm?.map((entry) => entry.playerId)).toEqual(["p2", "p1"]);
    expect(teamA!.mini_dm?.[0]?.value).toBe(7.25);
    // 0 Punkte → nicht gelistet; unbekannte Disziplin → keine erfundene Spalte.
    expect(teamA!.fechten).toBeUndefined();
    expect(Object.keys(teamA!)).toEqual(["mini_dm"]);
  });

  it("returns an empty map when there is no source data", () => {
    const gameState = makeGameState({ players: [], rosters: [] });
    const byTeam = buildSeasonStandingsTopPlayersByTeam({
      gameState,
      playerRatingsById: null,
      seasonPointsLedger: null,
    });
    expect(byTeam.size).toBe(0);
  });
});
