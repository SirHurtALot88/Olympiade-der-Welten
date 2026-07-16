import { describe, expect, it } from "vitest";

import {
  shouldBuildArchivedSeasonDisciplineLeaderboards,
  shouldBuildDisciplineConfigDerivations,
  shouldBuildDisciplineRanks,
  shouldBuildFullSeasonStandRows,
  shouldBuildSeasonHistorySnapshots,
  shouldBuildSeasonOverviewOptions,
  shouldBuildSeasonStandRows,
  shouldBuildSeasonV2PlayerRatings,
  shouldBuildSeasonTopPlayerRows,
  shouldBuildLeagueTrainingLeaderRows,
  shouldBuildSelectedStandingRow,
  shouldEnableTeamOverviewSlice,
} from "@/lib/foundation/tabs/season-v2-derivations";
import { buildSeasonOverviewOptions } from "@/lib/foundation/tabs/use-season-v2-panel-derivations";

describe("season-v2-derivations", () => {
  it("scopes season stand rows to views that need standings data", () => {
    expect(
      shouldBuildSeasonStandRows({
        activeView: "players",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildSeasonStandRows({
        activeView: "seasonV2",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonStandRows({
        activeView: "players",
        shouldBuildTeamsView: true,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonStandRows({
        activeView: "teamSettings",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonStandRows({
        activeView: "scoutingCenterV2",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonStandRows({
        activeView: "cockpit",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
  });

  it("scopes full season stand rows separately from cockpit lightweight", () => {
    expect(
      shouldBuildFullSeasonStandRows({
        activeView: "cockpit",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildFullSeasonStandRows({
        activeView: "seasonV2",
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildFullSeasonStandRows({
        activeView: "players",
        shouldBuildTeamsView: true,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
  });

  it("defers season v2 ratings until full hydration", () => {
    expect(shouldBuildSeasonV2PlayerRatings("seasonV2", "shell")).toBe(false);
    expect(shouldBuildSeasonV2PlayerRatings("seasonV2", "full")).toBe(true);
    expect(shouldBuildSeasonV2PlayerRatings("teams", "full")).toBe(false);
  });

  it("builds top-player rows for season v2 full and legacy rank tabs", () => {
    expect(
      shouldBuildSeasonTopPlayerRows({
        shouldBuildSeasonV2PlayerRatings: true,
        activeView: "seasonV2",
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonTopPlayerRows({
        shouldBuildSeasonV2PlayerRatings: false,
        activeView: "ranks",
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonTopPlayerRows({
        shouldBuildSeasonV2PlayerRatings: false,
        activeView: "players",
      }),
    ).toBe(false);
  });

  it("builds league training leader rows only on ranks", () => {
    expect(shouldBuildLeagueTrainingLeaderRows("ranks")).toBe(true);
    expect(shouldBuildLeagueTrainingLeaderRows("seasonV2")).toBe(false);
    expect(shouldBuildLeagueTrainingLeaderRows("players")).toBe(false);
  });

  it("enables team overview slice for standings consumers", () => {
    expect(
      shouldEnableTeamOverviewSlice({
        activeView: "players",
        shouldBuildSeasonStandRows: false,
      }),
    ).toBe(false);
    expect(
      shouldEnableTeamOverviewSlice({
        activeView: "ranks",
        shouldBuildSeasonStandRows: true,
      }),
    ).toBe(true);
  });

  it("mirrors selected standing row to season stand consumers", () => {
    expect(
      shouldBuildSelectedStandingRow({
        activeView: "lineupV2",
        shouldBuildSeasonStandRows: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildSelectedStandingRow({
        activeView: "homeV2",
        shouldBuildSeasonStandRows: true,
      }),
    ).toBe(true);
  });

  it("scopes season history snapshots to overview feed consumers and cockpit", () => {
    expect(
      shouldBuildSeasonHistorySnapshots({
        activeView: "lineupV2",
        shouldLoadSeasonOverviewFeedActive: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildSeasonHistorySnapshots({
        activeView: "seasonV2",
        shouldLoadSeasonOverviewFeedActive: true,
      }),
    ).toBe(true);
    expect(
      shouldBuildSeasonHistorySnapshots({
        activeView: "cockpit",
        shouldLoadSeasonOverviewFeedActive: false,
      }),
    ).toBe(true);
  });

  it("builds season overview options only when history snapshots are needed", () => {
    expect(
      shouldBuildSeasonOverviewOptions({
        shouldBuildSeasonHistorySnapshots: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildSeasonOverviewOptions({
        shouldBuildSeasonHistorySnapshots: true,
      }),
    ).toBe(true);
  });

  it("builds archived discipline leaderboards only on season v2", () => {
    expect(shouldBuildArchivedSeasonDisciplineLeaderboards("seasonV2")).toBe(true);
    expect(shouldBuildArchivedSeasonDisciplineLeaderboards("cockpit")).toBe(false);
  });

  it("scopes discipline rank rows to ranks/season/prize and extended teams comparison", () => {
    expect(
      shouldBuildDisciplineRanks({
        activeView: "players",
        shouldBuildTeamsHeavyComparison: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildDisciplineRanks({
        activeView: "ranks",
        shouldBuildTeamsHeavyComparison: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildDisciplineRanks({
        activeView: "prize",
        shouldBuildTeamsHeavyComparison: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildDisciplineRanks({
        activeView: "teams",
        shouldBuildTeamsHeavyComparison: true,
      }),
    ).toBe(true);
  });

  it("scopes discipline config derivations to diszis and season overview consumers", () => {
    expect(
      shouldBuildDisciplineConfigDerivations({
        activeView: "diszis",
        shouldLoadSeasonOverviewFeed: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildDisciplineConfigDerivations({
        activeView: "players",
        shouldLoadSeasonOverviewFeed: true,
      }),
    ).toBe(true);
    expect(
      shouldBuildDisciplineConfigDerivations({
        activeView: "training",
        shouldLoadSeasonOverviewFeed: false,
      }),
    ).toBe(false);
  });

  it("builds season overview options from snapshots when full build is enabled", () => {
    const gameState = {
      season: { id: "2026", name: "Saison 2026" },
    } as Parameters<typeof buildSeasonOverviewOptions>[0]["gameState"];

    expect(
      buildSeasonOverviewOptions({
        gameState,
        seasonHistorySnapshots: [],
        shouldBuildFull: false,
      }),
    ).toEqual([
      {
        seasonId: "2026",
        seasonName: "Saison 2026",
        status: "active",
        archivedAt: null,
      },
    ]);

    expect(
      buildSeasonOverviewOptions({
        gameState,
        seasonHistorySnapshots: [
          {
            seasonId: "2025",
            seasonName: "Saison 2025",
            status: "completed",
            archivedAt: "2026-01-01T00:00:00.000Z",
          } as Parameters<typeof buildSeasonOverviewOptions>[0]["seasonHistorySnapshots"][number],
        ],
        shouldBuildFull: true,
      }).map((option) => option.seasonId),
    ).toEqual(["2026", "2025"]);
  });
});
