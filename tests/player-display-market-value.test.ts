import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { createPlayerBaselinesForPlayers } from "@/lib/players/player-baseline-service";
import {
  getPlayerDisplayMarketValueDelta,
  getPlayerSeasonMarketValueReference,
  getPlayerSeasonZeroMarketValueDelta,
  getPlayerSeasonZeroMarketValueReference,
} from "@/lib/foundation/player-display-market-value";

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Greed",
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 61,
    salaryDemand: partial?.salaryDemand ?? 10,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 61,
    displaySalary: partial?.displaySalary ?? 10,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 70, d2: 65 },
    disciplineTierCounts: partial?.disciplineTierCounts ?? { above20: 2, above40: 2, above60: 2, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
  };
}

function createRosterEntry(partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id: partial?.id ?? "roster-1",
    teamId: partial?.teamId ?? "A-A",
    playerId: partial?.playerId ?? "player-1",
    contractLength: partial?.contractLength ?? 2,
    salary: partial?.salary ?? 10,
    upkeep: partial?.upkeep ?? 10,
    purchasePrice: partial?.purchasePrice ?? 8,
    currentValue: partial?.currentValue ?? 61,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input: {
  player: Player;
  roster?: RosterEntry | null;
  seasonId?: string;
}): GameState {
  const seasonId = input.seasonId ?? "season-2";
  return {
    season: {
      id: seasonId,
      name: seasonId,
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as GameState["season"],
    seasonState: { seasonId, schedule: [], standings: {} } as GameState["seasonState"],
    players: [input.player],
    rosters: input.roster ? [input.roster] : [],
    teams: [],
    disciplines: [],
    playerBaselines: createPlayerBaselinesForPlayers(
      [
        {
          ...input.player,
          marketValue: 8,
          displayMarketValue: 8,
        },
      ],
      { source: "seed", createdAt: "2026-06-01T00:00:00.000Z" },
    ),
  } as GameState;
}

describe("player display market value delta", () => {
  it("uses draft purchasePrice as game-start reference instead of post-season currentValue", () => {
    const player = createPlayer({ marketValue: 61.4, displayMarketValue: 61.4 });
    const roster = createRosterEntry({
      purchasePrice: 60,
      currentValue: 61.4,
      joinedSeasonId: "season-1",
    });
    const gameState = createGameState({ player, roster, seasonId: "season-2" });

    expect(getPlayerSeasonMarketValueReference({ player, rosterEntry: roster, gameState })).toBe(60);
    expect(getPlayerDisplayMarketValueDelta({ player, rosterEntry: roster, gameState })).toBe(1.4);
  });

  it("does not anchor against season-0 baseline when roster purchasePrice is available", () => {
    const player = createPlayer({ marketValue: 61, displayMarketValue: 61 });
    const roster = createRosterEntry({
      purchasePrice: 60,
      currentValue: 61,
      joinedSeasonId: "season-1",
    });
    const gameState = createGameState({ player, roster, seasonId: "season-2" });

    expect(getPlayerSeasonMarketValueReference({ player, rosterEntry: roster, gameState })).toBe(60);
    expect(getPlayerDisplayMarketValueDelta({ player, rosterEntry: roster, gameState })).toBe(1);
  });

  it("tracks mid-season signings against purchase price for the current season", () => {
    const player = createPlayer({ marketValue: 45, displayMarketValue: 45 });
    const roster = createRosterEntry({
      purchasePrice: 40,
      currentValue: 40,
      joinedSeasonId: "season-2",
    });
    const gameState = createGameState({ player, roster, seasonId: "season-2" });

    expect(getPlayerSeasonMarketValueReference({ player, rosterEntry: roster, gameState })).toBe(40);
    expect(getPlayerDisplayMarketValueDelta({ player, rosterEntry: roster, gameState })).toBe(5);
  });

  it("shows in-season drift when live player MW diverges from draft purchasePrice", () => {
    const player = createPlayer({ marketValue: 63.5, displayMarketValue: 63.5 });
    const roster = createRosterEntry({
      purchasePrice: 60,
      currentValue: 61,
      joinedSeasonId: "season-1",
    });
    const gameState = createGameState({ player, roster, seasonId: "season-2" });

    expect(getPlayerDisplayMarketValueDelta({ player, rosterEntry: roster, gameState })).toBe(3.5);
  });

  it("falls back to season-0 baseline for unrostered players", () => {
    const player = createPlayer({ marketValue: 12, displayMarketValue: 12 });
    const gameState = createGameState({ player, roster: null, seasonId: "season-2" });

    expect(getPlayerSeasonMarketValueReference({ player, rosterEntry: null, gameState })).toBe(8);
    expect(getPlayerDisplayMarketValueDelta({ player, rosterEntry: null, gameState })).toBe(4);
  });

  it("ignores legacy baseline scale mismatches and uses imported display MW as season-0 reference", () => {
    const player = createPlayer({
      id: "player-2984-vip-wal",
      marketValue: 100,
      displayMarketValue: 100,
      salaryDemand: 17,
      displaySalary: 17,
    });
    const gameState = {
      ...createGameState({ player, roster: null, seasonId: "season-1" }),
      playerBaselines: [
        {
          playerId: player.id,
          name: player.name,
          race: player.race,
          className: player.className,
          subclasses: [],
          traits: [],
          traitsPositive: [],
          traitsNegative: [],
          attributes: {},
          marketValue: 1_000_000,
          salary: 10,
          seasonZeroEconomy: {
            source: "season_0_backfilled",
            marketValue: 1_000_000,
            salary: 10,
            purchasePrice: 1_000_000,
            salaryMarketValue: 1_000_000,
            baseMarketValue: null,
            salaryBase: null,
            traitPercentSum: null,
            marketValueSource: "baseline_market_value_backfill",
            salarySource: "baseline_salary_backfill",
            computedAt: "2026-06-01T00:00:00.000Z",
          },
          disciplineRatings: {},
          source: "seed",
          baselineVersion: "player-baseline-v2",
          createdAt: "2026-06-01T00:00:00.000Z",
          importedAt: "2026-06-01T00:00:00.000Z",
          sourceFile: "data/generated/oly-player-stats.json",
          checksumAlgorithm: "sha256",
          checksum: "legacy-test",
        },
      ],
    } as GameState;

    expect(getPlayerSeasonZeroMarketValueReference({ player, gameState, currentMarketValue: 100 })).toBe(100);
    expect(getPlayerSeasonZeroMarketValueDelta({ player, gameState, currentMarketValue: 100 })).toBeNull();
    expect(getPlayerSeasonMarketValueReference({ player, rosterEntry: null, gameState, currentMarketValue: 100 })).toBe(100);
  });
});
