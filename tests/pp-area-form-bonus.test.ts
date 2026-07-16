import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildPpAreaFormBonusByTeamId,
  formatPpFormBonus,
  formatPpFormBonusParen,
  resolvePpAreaTotalsFromSeasonRow,
} from "@/lib/foundation/pp-area-form-bonus";

function createMinimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "S1", name: "Saison 1", currentMatchday: 1, matchdayIds: ["md-1"] },
    teams: [{ teamId: "A-A", name: "Team Alpha", shortCode: "ALP", budget: 100, cash: 100 }],
    players: [],
    rosters: [],
    disciplines: [
      { id: "pow1", name: "TDM", category: "power", weight: 1 },
      { id: "spe1", name: "Staffel", category: "speed", weight: 1 },
      { id: "men1", name: "Schach", category: "mental", weight: 1 },
      { id: "soc1", name: "Basketball", category: "social", weight: 1 },
    ],
    seasonState: {
      disciplineResults: [],
      matchdayResults: [],
      seasonSnapshots: [],
    },
    matchdayState: { matchdayId: "md-1", status: "resolved" },
    ...overrides,
  } as GameState;
}

describe("pp area form bonus", () => {
  it("accumulates form card modifiers by discipline area", () => {
    const gameState = createMinimalGameState({
      seasonState: {
        disciplineResults: [
          {
            id: "dr-1",
            matchdayResultId: "result-1",
            teamId: "A-A",
            disciplineId: "pow1",
            disciplineSide: "d1",
            rank: 1,
            baseScore: 40,
            totalScore: 45,
            formModifier: 60,
            readinessStatus: "ready",
            warnings: [],
            createdAt: "2026-06-06T12:00:00.000Z",
          },
          {
            id: "dr-2",
            matchdayResultId: "result-1",
            teamId: "A-A",
            disciplineId: "spe1",
            disciplineSide: "d2",
            rank: 2,
            baseScore: 35,
            totalScore: 38,
            formModifier: 80,
            readinessStatus: "ready",
            warnings: [],
            createdAt: "2026-06-06T12:01:00.000Z",
          },
          {
            id: "dr-3",
            matchdayResultId: "result-2",
            teamId: "A-A",
            disciplineId: "men1",
            disciplineSide: "d1",
            rank: 3,
            baseScore: 20,
            totalScore: 22,
            formModifier: 12,
            readinessStatus: "ready",
            warnings: [],
            createdAt: "2026-06-06T12:02:00.000Z",
          },
        ],
        matchdayResults: [
          {
            id: "result-1",
            seasonId: "S1",
            matchdayId: "md-1",
            status: "preview_applied",
            createdAt: "2026-06-06T12:00:00.000Z",
          },
          {
            id: "result-2",
            seasonId: "S1",
            matchdayId: "md-2",
            status: "preview_applied",
            createdAt: "2026-06-06T12:03:00.000Z",
          },
        ],
        seasonSnapshots: [],
      },
    });

    const totals = buildPpAreaFormBonusByTeamId(gameState, "S1");

    expect(totals["A-A"]).toEqual({
      total: 152,
      pow: 60,
      spe: 80,
      men: 12,
      soc: 0,
    });
  });

  it("formats form bonus labels with optional parentheses", () => {
    expect(formatPpFormBonus(60)).toBe("+60");
    expect(formatPpFormBonusParen(80)).toBe("(+80)");
    expect(formatPpFormBonus(-4.2)).toBe("-4,2");
    expect(formatPpFormBonusParen(0)).toBeNull();
  });

  it("prefers saisonstand discipline sums over ledger area totals for MEN and SOC", () => {
    const totals = resolvePpAreaTotalsFromSeasonRow({
      disciplineValues: {
        mini_dm: 11,
        fechten: 12,
        schach: 7,
        takeshi: 3,
        football: 5,
        eiskunst: 2,
      },
      ppsTotal: 40,
      ppsPow: 11,
      ppsSpe: 12,
      ppsMen: 0,
      ppsSoc: 0,
    });

    expect(totals.pow).toBe(11);
    expect(totals.spe).toBe(12);
    expect(totals.men).toBe(10);
    expect(totals.soc).toBe(7);
    expect(totals.total).toBe(40);
  });

  it("falls back to ledger area totals when discipline values are empty", () => {
    const totals = resolvePpAreaTotalsFromSeasonRow({
      disciplineValues: {},
      ppsTotal: 25,
      ppsPow: 10,
      ppsSpe: 8,
      ppsMen: 4,
      ppsSoc: 3,
    });

    expect(totals).toEqual({
      total: 25,
      pow: 10,
      spe: 8,
      men: 4,
      soc: 3,
    });
  });
});
