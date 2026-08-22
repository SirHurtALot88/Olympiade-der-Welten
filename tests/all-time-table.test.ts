import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";

function buildGameState(partial: Partial<GameState>): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: { seasonSnapshots: [] },
    teams: [],
    ...partial,
  } as GameState;
}

function team(teamId: string, teamCode: string, teamName: string) {
  return { teamId, shortCode: teamCode, name: teamName } as unknown as GameState["teams"][number];
}

function standing(input: {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  marketValueEnd?: number | null;
  marketValueTotalEnd?: number | null;
  marketValueSeasonEnd?: number | null;
  cashEnd?: number | null;
  cashEntry?: number | null;
  cashTotal?: number | null;
}) {
  return {
    teamId: input.teamId,
    teamCode: input.teamCode,
    teamName: input.teamName,
    rank: input.rank,
    points: input.points,
    marketValueEnd: input.marketValueEnd ?? null,
    marketValueTotalEnd: input.marketValueTotalEnd,
    marketValueSeasonEnd: input.marketValueSeasonEnd,
    cashEnd: input.cashEnd ?? null,
    cashEntry: input.cashEntry,
    cashTotal: input.cashTotal,
    disciplinePointsByArea: {},
  };
}

describe("all-time-table", () => {
  it("ranks the leader by cumulative points, falling back to the silver-medal tie-break when points and titles are equal", () => {
    const model = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 50 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 2, points: 0 }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 3, points: 0 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 1, points: 50 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha"), team("t2", "BBB", "Beta")],
      }),
    });

    // Both teams: 50 cumulative points, 1 title each (gold ties). Beta also
    // has a silver (rank 2 in season-1) while Alpha has none (rank 3 in
    // season-2 is neither silver nor bronze) — the silver-count tie-break
    // decides in Beta's favor.
    expect(model.rows.find((row) => row.teamId === "t1")?.cumulativePoints).toBe(50);
    expect(model.rows.find((row) => row.teamId === "t2")?.cumulativePoints).toBe(50);
    expect(model.rows.find((row) => row.teamId === "t1")?.titles).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t2")?.titles).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t2")?.medals.silver).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t1")?.medals.silver).toBe(0);
    expect(model.leader?.teamId).toBe("t2");
    expect(model.leader?.allTimeRank).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t1")?.allTimeRank).toBe(2);
  });

  it("breaks a full tie (points/titles/medals) on best rank, then avg rank, then team name", () => {
    const bestRankModel = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 4, points: 10 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 5, points: 10 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Zeta"), team("t2", "BBB", "Alpha")],
      }),
    });
    // Same points, no titles/medals for either team — bestRank (4 vs 5) decides.
    expect(bestRankModel.rows[0].teamId).toBe("t1");
    expect(bestRankModel.rows[0].bestRank).toBe(4);
    expect(bestRankModel.rows[1].bestRank).toBe(5);

    const avgRankModel = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 4, points: 5 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 4, points: 5 }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 6, points: 5 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 8, points: 5 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Zeta"), team("t2", "BBB", "Alpha")],
      }),
    });
    // Same points/bestRank (both 4) — avgRank ((4+6)/2=5 vs (4+8)/2=6) decides.
    expect(avgRankModel.rows[0].teamId).toBe("t1");
    expect(avgRankModel.rows[0].avgRank).toBe(5);
    expect(avgRankModel.rows[1].avgRank).toBe(6);

    const nameModel = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 4, points: 5 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 4, points: 5 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Zeta"), team("t2", "BBB", "Alpha")],
      }),
    });
    // Everything tied (points/titles/medals/bestRank/avgRank) — German
    // locale team-name comparison decides: "Alpha" sorts before "Zeta".
    expect(nameModel.rows[0].teamId).toBe("t2");
    expect(nameModel.rows[1].teamId).toBe("t1");
  });

  it("computes MW peak/first/now and growth abs+pct, preferring the *Total variant with an honest fallback", () => {
    const model = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              // Older snapshot: only the non-Total field is populated.
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 10, marketValueEnd: 100 }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                standing({
                  teamId: "t1",
                  teamCode: "AAA",
                  teamName: "Alpha",
                  rank: 1,
                  points: 10,
                  marketValueEnd: 999, // should be ignored in favor of Total
                  marketValueTotalEnd: 180,
                }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-3",
              seasonName: "Season 3",
              finalStandings: [
                standing({
                  teamId: "t1",
                  teamCode: "AAA",
                  teamName: "Alpha",
                  rank: 2,
                  points: 5,
                  marketValueTotalEnd: 150,
                }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });

    const row = model.rows.find((entry) => entry.teamId === "t1");
    expect(row).toBeDefined();
    expect(row?.mwFirst).toBe(100);
    expect(row?.mwPeak).toBe(180);
    expect(row?.mwNow).toBe(150);
    expect(row?.mwGrowthAbs).toBe(50);
    expect(row?.mwGrowthPct).toBe(50);
    expect(model.biggestMwGrowth?.teamId).toBe("t1");
  });

  /**
   * UMGESCHRIEBEN. Hier stand „merges the live season last" — die laufende Saison wurde als eigene
   * Zeile angehaengt. Diese Regel ist mit `6l1b0i` aufgehoben: „in der ewigen Tabelle sollen
   * wirklich nur vergangene abgeschlossene Seasons getrackt werden!" Aus derselben Regel entstand
   * `bia63a` (doppelte Punkte in S2 MD1) — der Standings-Feed traegt am Saisonanfang noch den
   * Vorsaison-Stand, die Saison stand damit zweimal in der Liste.
   *
   * Der Test bleibt an derselben Stelle stehen, damit die AUFGEHOBENE Regel nicht unbemerkt
   * zurueckkehrt; er nagelt jetzt ihr Gegenteil fest. Die neue Zusage im Detail steht in
   * tests/ewige-tabelle-nur-abgeschlossene-saisons.test.ts.
   */
  it("nimmt die laufende Saison NICHT auf, auch nicht mit Live-Feed", () => {
    const withLive = buildAllTimeTableModel({
      gameState: buildGameState({
        season: { id: "season-2", name: "Season 2" } as unknown as GameState["season"],
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
      liveStandingsByTeamId: {
        t1: { rank: 1, points: 15, marketValue: 200, cash: 30 },
      },
    });

    const liveRow = withLive.rows.find((entry) => entry.teamId === "t1");
    // Nur die archivierte season-1. Die 15 Live-Punkte bleiben draussen, 40 bleiben 40.
    expect(liveRow?.seasons).toHaveLength(1);
    expect(liveRow?.seasons[0].seasonId).toBe("season-1");
    expect(liveRow?.seasons.some((season) => season.isLive)).toBe(false);
    expect(liveRow?.cumulativePoints).toBe(40);

    // Dieselbe Saison-Id wie ein Snapshot: unveraendert nur EINE Zeile (galt vorher wie nachher).
    const dedupedModel = buildAllTimeTableModel({
      gameState: buildGameState({
        season: { id: "season-1", name: "Season 1" } as unknown as GameState["season"],
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
      liveStandingsByTeamId: {
        t1: { rank: 1, points: 999, marketValue: 999, cash: 999 },
      },
    });
    const dedupedRow = dedupedModel.rows.find((entry) => entry.teamId === "t1");
    expect(dedupedRow?.seasons).toHaveLength(1);
    expect(dedupedRow?.cumulativePoints).toBe(40);

    // Without a live-standings input, no live row is invented even though the
    // live season id differs from the archive.
    const withoutLive = buildAllTimeTableModel({
      gameState: buildGameState({
        season: { id: "season-2", name: "Season 2" } as unknown as GameState["season"],
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    const noLiveRow = withoutLive.rows.find((entry) => entry.teamId === "t1");
    expect(noLiveRow?.seasons).toHaveLength(1);
  });

  it("exposes a null/false/0 tri-state for hasArchive/hasHistory before, and after, archiving", () => {
    const compactLoad = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: { seasonSnapshots: undefined } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    expect(compactLoad.hasArchive).toBe(false);
    expect(compactLoad.hasHistory).toBe(false);
    expect(compactLoad.archivedSeasonCount).toBe(0);
    // Team identities still resolve from `gameState.teams` even pre-archive-load.
    expect(compactLoad.rows).toHaveLength(1);
    expect(compactLoad.rows[0].cumulativePoints).toBe(0);
    // A "leader" always resolves to rows[0] when there is at least one team —
    // but the title/MW-growth/cash-peak leaders stay honestly null without
    // any real (non-zero/finite) value to point to.
    expect(compactLoad.leader?.teamId).toBe("t1");
    expect(compactLoad.mostTitles).toBeNull();
    expect(compactLoad.biggestMwGrowth).toBeNull();
    expect(compactLoad.richestEver).toBeNull();

    const zeroSeasons = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: { seasonSnapshots: [] } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    expect(zeroSeasons.hasArchive).toBe(true);
    expect(zeroSeasons.hasHistory).toBe(false);
    expect(zeroSeasons.archivedSeasonCount).toBe(0);

    const oneSeason = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    expect(oneSeason.hasArchive).toBe(true);
    expect(oneSeason.hasHistory).toBe(true);
    expect(oneSeason.archivedSeasonCount).toBe(1);
    expect(oneSeason.rows[0].avgRank).toBe(1);
    expect(oneSeason.rows[0].bestRank).toBe(1);
    expect(oneSeason.rows[0].titles).toBe(1);
  });

  it("sorts snapshots numerically by season id (season-2 before season-10) and caps chart-ready seasons", () => {
    const model = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-10",
              seasonName: "Season 10",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 10 })],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 2, points: 20 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });

    const row = model.rows.find((entry) => entry.teamId === "t1");
    expect(row?.seasons.map((season) => season.seasonId)).toEqual(["season-2", "season-10"]);
    expect(model.seasonLabels).toHaveLength(2);
  });
  /**
   * CHRIS' VORGABE: „die snapshots für Cash und Marktwert sollen ja auch erst am anfang der Saison
   * nach den Käufen stattfinden für die ewige Tabelle / Finanzen."
   *
   * Den Eintrittsstand schreibt `patchCompletedSeasonSnapshotAfterPreseasonBuy` in
   * `marketValueTotalEnd` und `cashEntry`; dass er gelaufen ist, sagt `entryRosterPatchedAt`.
   */
  describe("Eintrittsstand nach den Kaeufen", () => {
    function baueModell(snapshot: Record<string, unknown>) {
      return buildAllTimeTableModel({
        gameState: buildGameState({
          seasonState: { seasonSnapshots: [snapshot] } as unknown as GameState["seasonState"],
          teams: [team("t1", "AAA", "Alpha")],
        }),
      });
    }

    const zeile = (modell: ReturnType<typeof buildAllTimeTableModel>) =>
      modell.rows.find((entry) => entry.teamId === "t1")?.seasons[0];

    it("zeigt nach dem Patch den Stand nach den Kaeufen", () => {
      const modell = baueModell({
        seasonId: "season-1",
        seasonName: "Season 1",
        entryRosterPatchedAt: "2026-08-08T00:00:00.000Z",
        finalStandings: [
          standing({
            teamId: "t1",
            teamCode: "AAA",
            teamName: "Alpha",
            rank: 1,
            points: 10,
            marketValueSeasonEnd: 100,
            marketValueTotalEnd: 260,
            cashEnd: 90,
            cashEntry: 12.5,
          }),
        ],
        playerPerformances: [],
      });

      // Nicht der Saison-Endstand (100 / 90), sondern der Stand, mit dem das Team weiterspielt.
      expect(zeile(modell)?.marketValue).toBe(260);
      expect(zeile(modell)?.cash).toBe(12.5);
    });

    it("faellt ohne Patch auf den Saison-Endstand zurueck", () => {
      const modell = baueModell({
        seasonId: "season-1",
        seasonName: "Season 1",
        finalStandings: [
          standing({
            teamId: "t1",
            teamCode: "AAA",
            teamName: "Alpha",
            rank: 1,
            points: 10,
            marketValueSeasonEnd: 100,
            marketValueTotalEnd: 55,
            cashEnd: 90,
          }),
        ],
        playerPerformances: [],
      });

      // Ohne Patch traegt `marketValueTotalEnd` noch den Stand VOR der Entwicklung (55) und waere
      // die schlechtere Zahl — hier gewinnt der echte Saisonabschluss.
      expect(zeile(modell)?.marketValue).toBe(100);
      expect(zeile(modell)?.cash).toBe(90);
    });

    it("nimmt `cashTotal` erst, wenn sonst nichts da ist", () => {
      const modell = baueModell({
        seasonId: "season-1",
        seasonName: "Season 1",
        finalStandings: [
          standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 10, cashTotal: 77 }),
        ],
        playerPerformances: [],
      });

      // `cashTotal` ist eine Prognose aus dem Cash-Apply — deshalb ganz hinten.
      expect(zeile(modell)?.cash).toBe(77);
    });
  });
});
