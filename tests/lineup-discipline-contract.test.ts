import { describe, expect, it } from "vitest";

import { foundationSeedDisciplines, foundationSeedMatchdays, foundationSeedSeason } from "@/lib/data/dataAdapter";
import {
  buildLineupDisciplineContract,
  buildMatchdayLineupContract,
  countSeasonCaptains,
  countSeasonLineupDisciplineSides,
  SEASON_CAPTAIN_SLOTS,
} from "@/lib/lineups/lineup-discipline-contract";
import { buildLegacySeedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

describe("lineup discipline contract", () => {
  it("covers all 20 disciplines in the seeded display order", () => {
    const contract = buildLineupDisciplineContract(foundationSeedDisciplines);

    expect(contract).toHaveLength(20);
    expect(contract.every((entry) => entry.rankSourceStatus === "mapped_with_transform")).toBe(true);
    expect(contract.every((entry) => entry.rankSource === "active_roster_top6_sum_discipline_score")).toBe(true);
    expect(contract.map((entry) => `${entry.displayName}:${entry.requiredPlayers}`)).toEqual([
      "Mini DM:2",
      "Fechten:5",
      "Schach:2",
      "I Spy:6",
      "Basketball:6",
      "Time Trial:4",
      "Gewichtheben:6",
      "Eiskunst:3",
      "Showcase:5",
      "Hockey:5",
      "Takeshi:4",
      "Breaking:4",
      "Wettessen:5",
      "Staffel:3",
      "Battlefield:2",
      "Tennis:3",
      "TDM:3",
      "Climbing:6",
      "Football:4",
      "Spurt:2",
    ]);
    expect(contract.every((entry) => entry.requiredCaptains === 0)).toBe(true);
    expect(contract.every((entry) => entry.sourceStatus === "mapped")).toBe(true);
  });

  it("maps current matchdays to the correct D1 and D2 disciplines", () => {
    const disciplineSchedule = buildLegacySeedSeasonDisciplineSchedule({
      seasonId: foundationSeedSeason.id,
      disciplines: foundationSeedDisciplines,
      matchdayIds: foundationSeedSeason.matchdayIds,
    });
    const first = buildMatchdayLineupContract({
      season: foundationSeedSeason,
      matchday: foundationSeedMatchdays[0]!,
      disciplines: foundationSeedDisciplines,
      disciplineSchedule,
    });
    const second = buildMatchdayLineupContract({
      season: foundationSeedSeason,
      matchday: foundationSeedMatchdays[1]!,
      disciplines: foundationSeedDisciplines,
      disciplineSchedule,
    });

    expect(first.discipline1?.disciplineId).toBe("mini-dm");
    expect(first.discipline1?.requiredPlayers).toBe(2);
    expect(first.discipline2?.disciplineId).toBe("fechten");
    expect(first.discipline2?.requiredPlayers).toBe(5);
    expect(second.discipline1?.disciplineId).toBe("speed-schach");
    expect(second.discipline2?.disciplineId).toBe("i-spy");
    expect(first.discipline1?.rankSourceStatus).toBe("mapped_with_transform");
    expect(first.discipline2?.rankSourceStatus).toBe("mapped_with_transform");
    expect(first.sourceStatus).toBe("legacy_seed");
    expect(first.seasonCaptainSlots).toBe(SEASON_CAPTAIN_SLOTS);
    expect(first.totalDisciplineSidesInSeason).toBe(20);
  });

  it("uses matchday schedule player counts instead of catalog defaults when they differ", () => {
    const disciplineSchedule = buildLegacySeedSeasonDisciplineSchedule({
      seasonId: foundationSeedSeason.id,
      disciplines: foundationSeedDisciplines,
      matchdayIds: foundationSeedSeason.matchdayIds,
    }).map((entry) =>
      entry.matchdayId === "matchday-1" && entry.discipline2
        ? {
            ...entry,
            discipline2: {
              ...entry.discipline2,
              playerCount: 6,
            },
          }
        : entry,
    );

    const matchdayOne = buildMatchdayLineupContract({
      season: foundationSeedSeason,
      matchday: foundationSeedMatchdays[0]!,
      disciplines: foundationSeedDisciplines,
      disciplineSchedule,
    });

    expect(matchdayOne.discipline2?.disciplineId).toBe("fechten");
    expect(matchdayOne.discipline2?.requiredPlayers).toBe(6);
  });

  it("does not silently fall back to index pairing when a stored season schedule misses a matchday entry", () => {
    const disciplineSchedule = buildLegacySeedSeasonDisciplineSchedule({
      seasonId: foundationSeedSeason.id,
      disciplines: foundationSeedDisciplines,
      matchdayIds: foundationSeedSeason.matchdayIds,
    }).filter((entry) => entry.matchdayId !== "matchday-2");

    const second = buildMatchdayLineupContract({
      season: foundationSeedSeason,
      matchday: foundationSeedMatchdays[1]!,
      disciplines: foundationSeedDisciplines,
      disciplineSchedule,
    });

    expect(second.sourceStatus).toBe("discipline_schedule_rule_missing");
    expect(second.discipline1).toBeNull();
    expect(second.discipline2).toBeNull();
  });

  it("counts season lineup coverage and captain usage by discipline side", () => {
    const lineups = [
      {
        teamId: "A-A",
        seasonId: "season-1",
        entries: [
          { disciplineId: "mini-dm", disciplineSide: "d1" as const, isCaptain: true },
          { disciplineId: "mini-dm", disciplineSide: "d1" as const },
          { disciplineId: "fechten", disciplineSide: "d2" as const, isCaptain: true },
        ],
      },
      {
        teamId: "A-A",
        seasonId: "season-1",
        entries: [{ disciplineId: "speed-schach", disciplineSide: "d1" as const }],
      },
      {
        teamId: "B-P",
        seasonId: "season-1",
        entries: [{ disciplineId: "mini-dm", disciplineSide: "d1" as const, isCaptain: true }],
      },
    ];

    expect(
      countSeasonLineupDisciplineSides({
        lineups,
        teamId: "A-A",
        seasonId: "season-1",
      }),
    ).toBe(3);
    expect(
      countSeasonCaptains({
        lineups,
        teamId: "A-A",
        seasonId: "season-1",
      }),
    ).toBe(2);
  });
});
