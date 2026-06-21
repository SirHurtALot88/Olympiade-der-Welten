import { expect, it } from "vitest";

import type { Discipline, GameState } from "@/lib/data/olyDataTypes";
import {
  buildSeasonSeededDisciplineSchedule,
  getSeasonDisciplineSchedule,
} from "@/lib/season/season-discipline-schedule";

const disciplines: Discipline[] = [
  { id: "pow-1", name: "Power One", category: "power", weight: 1, playerCount: 2 },
  { id: "spe-1", name: "Speed One", category: "speed", weight: 1, playerCount: 3 },
  { id: "men-1", name: "Mental One", category: "mental", weight: 1, playerCount: 4 },
  { id: "soc-1", name: "Social One", category: "social", weight: 1, playerCount: 5 },
  { id: "pow-2", name: "Power Two", category: "power", weight: 1, playerCount: 6 },
  { id: "spe-2", name: "Speed Two", category: "speed", weight: 1, playerCount: 2 },
  { id: "men-2", name: "Mental Two", category: "mental", weight: 1, playerCount: 3 },
  { id: "soc-2", name: "Social Two", category: "social", weight: 1, playerCount: 4 },
];

function signature(entries: ReturnType<typeof buildSeasonSeededDisciplineSchedule>["entries"]) {
  return entries.map((entry) => `${entry.discipline1?.disciplineId}:${entry.discipline2?.disciplineId}`).join("|");
}

function slotCounts(entries: ReturnType<typeof buildSeasonSeededDisciplineSchedule>["entries"]) {
  return entries.map((entry) => `${entry.discipline1?.disciplineId}:${entry.discipline1?.playerCount}|${entry.discipline2?.disciplineId}:${entry.discipline2?.playerCount}`).join("|");
}

it("builds season-specific seeded schedules with consistent matchday ids", () => {
  const season2 = buildSeasonSeededDisciplineSchedule({
    saveId: "save-a",
    seasonId: "season-2",
    disciplines,
    matchdayCount: 4,
  });
  const season3 = buildSeasonSeededDisciplineSchedule({
    saveId: "save-a",
    seasonId: "season-3",
    disciplines,
    matchdayCount: 4,
  });

  expect(season2.matchdayIds).toEqual(["season-2-matchday-1", "season-2-matchday-2", "season-2-matchday-3", "season-2-matchday-4"]);
  expect(season2.entries.map((entry) => entry.matchdayId)).toEqual(season2.matchdayIds);
  expect(season2.entries.every((entry) => entry.sourceStatus === "season_seed")).toBe(true);
  expect(season2.scheduleSeed).not.toBe(season3.scheduleSeed);
  expect(signature(season2.entries)).not.toBe(signature(season3.entries));
  expect(slotCounts(season2.entries)).not.toBe(slotCounts(season3.entries));
});

it("pairs rerolled disciplines within the roster-sized slot budget", () => {
  const schedule = buildSeasonSeededDisciplineSchedule({
    saveId: "save-a",
    seasonId: "season-3",
    disciplines: [
      ...disciplines,
      { id: "pow-3", name: "Power Three", category: "power", weight: 1, playerCount: 6 },
      { id: "soc-3", name: "Social Three", category: "social", weight: 1, playerCount: 4 },
    ],
    matchdayCount: 5,
    maxCombinedPlayerCount: 10,
  });

  expect(schedule.entries).toHaveLength(5);
  expect(schedule.entries.every((entry) => {
    const d1Count = entry.discipline1?.playerCount ?? 0;
    const d2Count = entry.discipline2?.playerCount ?? 0;
    return d1Count + d2Count <= 10;
  })).toBe(true);
  expect(schedule.warnings).not.toContain("season_schedule_pair_over_roster_limit");
});

it("keeps discipline categories stable while rerolling seasonal player counts", () => {
  const schedule = buildSeasonSeededDisciplineSchedule({
    saveId: "save-a",
    seasonId: "season-4",
    disciplines,
    matchdayCount: 4,
  });
  const baseCountById = new Map(disciplines.map((discipline) => [discipline.id, discipline.playerCount] as const));
  const categoryCounts = { power: 0, speed: 0, mental: 0, social: 0 };
  let changedPlayerCount = false;

  for (const entry of schedule.entries) {
    for (const slot of [entry.discipline1, entry.discipline2]) {
      if (!slot) continue;
      categoryCounts[slot.category] += 1;
      changedPlayerCount ||= slot.playerCount !== baseCountById.get(slot.disciplineId);
      expect(slot.playerCount).toBeGreaterThanOrEqual(2);
      expect(slot.playerCount).toBeLessThanOrEqual(6);
    }
  }

  expect(categoryCounts).toEqual({ power: 2, speed: 2, mental: 2, social: 2 });
  expect(changedPlayerCount).toBe(true);
});

it("keeps every discipline area balanced across 2-6 slot sizes", () => {
  const fullDisciplinePool: Discipline[] = [
    ...disciplines,
    { id: "pow-3", name: "Power Three", category: "power", weight: 1, playerCount: 4 },
    { id: "pow-4", name: "Power Four", category: "power", weight: 1, playerCount: 5 },
    { id: "pow-5", name: "Power Five", category: "power", weight: 1, playerCount: 3 },
    { id: "spe-3", name: "Speed Three", category: "speed", weight: 1, playerCount: 4 },
    { id: "spe-4", name: "Speed Four", category: "speed", weight: 1, playerCount: 5 },
    { id: "spe-5", name: "Speed Five", category: "speed", weight: 1, playerCount: 6 },
    { id: "men-3", name: "Mental Three", category: "mental", weight: 1, playerCount: 2 },
    { id: "men-4", name: "Mental Four", category: "mental", weight: 1, playerCount: 5 },
    { id: "men-5", name: "Mental Five", category: "mental", weight: 1, playerCount: 6 },
    { id: "soc-3", name: "Social Three", category: "social", weight: 1, playerCount: 2 },
    { id: "soc-4", name: "Social Four", category: "social", weight: 1, playerCount: 3 },
    { id: "soc-5", name: "Social Five", category: "social", weight: 1, playerCount: 6 },
  ];
  const schedule = buildSeasonSeededDisciplineSchedule({
    saveId: "save-balanced",
    seasonId: "season-1",
    disciplines: fullDisciplinePool,
    matchdayCount: 10,
  });
  const countsByCategory: Record<Discipline["category"], number[]> = {
    power: [],
    speed: [],
    mental: [],
    social: [],
  };

  for (const entry of schedule.entries) {
    for (const slot of [entry.discipline1, entry.discipline2]) {
      if (!slot) continue;
      countsByCategory[slot.category].push(slot.playerCount ?? 0);
    }
  }

  expect(Object.fromEntries(Object.entries(countsByCategory).map(([category, counts]) => [category, [...counts].sort((a, b) => a - b)]))).toEqual({
    power: [2, 3, 4, 5, 6],
    speed: [2, 3, 4, 5, 6],
    mental: [2, 3, 4, 5, 6],
    social: [2, 3, 4, 5, 6],
  });
});

it("does not treat stale previous-season discipline schedules as active", () => {
  const stale = buildSeasonSeededDisciplineSchedule({
    saveId: "save-a",
    seasonId: "season-2",
    disciplines,
    matchdayCount: 4,
  });
  const gameState = {
    season: { id: "season-3", name: "Season 3", year: 3, currentMatchday: 1, matchdayIds: ["matchday-1", "matchday-2", "matchday-3", "matchday-4"] },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      disciplineSchedule: stale.entries,
      standings: {},
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    disciplines,
    teams: [],
  } as unknown as GameState;

  const active = getSeasonDisciplineSchedule(gameState);

  expect(active.every((entry) => entry.seasonId === "season-3")).toBe(true);
  expect(active.some((entry) => entry.seasonId === "season-2")).toBe(false);
});
