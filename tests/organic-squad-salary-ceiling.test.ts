import { describe, expect, it } from "vitest";

import { computeTeamSalaryCeiling } from "@/lib/ai/organic-squad/salary-ceiling";
import { buildOrganicSquadPlan, type OrganicSquadPlanInput } from "@/lib/ai/organic-squad/draft-builder";
import { TEAM_GENERAL_MANAGER_PROFILES } from "@/lib/foundation/team-general-managers";
import type { CoreAxis, OrganicDiscipline, OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import type { GameState } from "@/lib/data/olyDataTypes";

const STAR_CHASER_GM_ID = TEAM_GENERAL_MANAGER_PROFILES.find((p) => p.archetype === "star_chaser")!.gmId;
const BARGAIN_HUNTER_GM_ID = TEAM_GENERAL_MANAGER_PROFILES.find((p) => p.archetype === "bargain_hunter")!.gmId;

/**
 * Minimal GameState fixture builder for computeTeamSalaryCeiling, in the same spirit as
 * ai-loan-decision-service.test.ts's buildTeamGameState — only the fields the ceiling actually reads
 * (sponsor payout logs / contract, facility upkeep, loan installments, roster salary+market value,
 * identity.ambition, GM archetype, season snapshots for the value trend) need to be populated.
 */
function buildFixture(input: {
  teamId?: string;
  cash: number;
  rosterCount: number;
  salaryPerPlayer?: number;
  marketValuePerPlayer?: number;
  annualRevenue?: number;
  ambition?: number;
  gmId?: string | null;
  seasonSnapshotValues?: number[]; // (cashEnd + marketValueEnd) series, oldest → newest, up to 3
}): GameState {
  const teamId = input.teamId ?? "T-1";
  const seasonId = "season-4";
  const salaryPerPlayer = input.salaryPerPlayer ?? 6;
  const marketValuePerPlayer = input.marketValuePerPlayer ?? 15;

  const rosters = Array.from({ length: input.rosterCount }, (_, index) => ({
    id: `r${index}`,
    teamId,
    playerId: `p${index}`,
    salary: salaryPerPlayer,
    upkeep: salaryPerPlayer,
    contractLength: 2,
    currentValue: marketValuePerPlayer,
  }));
  const players = Array.from({ length: input.rosterCount }, (_, index) => ({
    id: `p${index}`,
    name: `P${index}`,
    marketValue: marketValuePerPlayer,
    displayMarketValue: marketValuePerPlayer,
    salaryDemand: salaryPerPlayer,
    displaySalary: salaryPerPlayer,
    rating: 55,
    fatigue: 20,
  }));

  const sponsorPayoutLogs =
    input.annualRevenue == null
      ? []
      : [
          {
            id: "payout-1",
            saveId: "save-1",
            seasonId,
            teamId,
            phase: "season_end",
            componentId: "base",
            cashDelta: input.annualRevenue,
            action: "apply",
            createdAt: "2028-01-01T00:00:00.000Z",
          },
        ];

  const seasonSnapshots = (input.seasonSnapshotValues ?? []).map((value, index) => ({
    seasonId: `season-${index + 1}`,
    seasonName: `Season ${index + 1}`,
    archivedAt: `202${index}-06-01T00:00:00.000Z`,
    status: "completed" as const,
    finalStandings: [
      {
        teamId,
        teamCode: teamId,
        teamName: teamId,
        rank: 5,
        points: 0,
        disciplinePoints: 0,
        disciplinePointsByArea: { pow: 0, spe: 0, men: 0, soc: 0 },
        cashEnd: value,
        rosterEnd: input.rosterCount,
        salaryEnd: 0,
        marketValueEnd: 0,
        transferCount: 0,
        transferBuyCount: 0,
        transferSellCount: 0,
        transferNet: 0,
      },
    ],
    playerPerformances: [],
  }));

  return {
    season: { id: seasonId, name: seasonId, year: 2029, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId,
      schedule: [],
      standings: { [teamId]: { points: 0 } },
      loans: [],
      sponsorPayoutLogs,
      seasonSnapshots,
      teamGeneralManagers: input.gmId
        ? {
            [teamId]: {
              teamId,
              gmId: input.gmId,
              assignedSeasonId: seasonId,
              influencePct: 30,
              source: "auto_generated" as const,
            },
          }
        : {},
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, shortCode: "T1", name: "Team", budget: input.cash, cash: input.cash, rosterLimit: 14 }],
    teamIdentities: [
      { teamId, playerMin: 8, playerOpt: 11, playerMax: 14, finances: 5, ambition: input.ambition ?? 5 },
    ],
    players,
    disciplines: [],
    disciplineSchedule: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

describe("computeTeamSalaryCeiling", () => {
  it("(a) sponsor-rich mid-table team: ceiling lands above its current actual salary (frees headroom)", () => {
    // teamValue (cash + rosterMW) ≈ 250, close to the league-median reference (260) ⇒ rangeWidth ≈ 0, so
    // this case isolates sustainableSalary itself: expected sponsor income (120) comfortably exceeds the
    // team's current salary (10×6=60) even after fixed costs, because the team is under-spending its
    // income (exactly the sponsor-rich-under-builder problem this feature targets).
    const gs = buildFixture({ cash: 100, rosterCount: 10, salaryPerPlayer: 6, marketValuePerPlayer: 15, annualRevenue: 120 });
    const currentSalary = 10 * 6;
    const result = computeTeamSalaryCeiling(gs, "T-1", { teamCash: 100 });

    expect(result.expectedSponsor).toBe(120);
    expect(result.teamValue).toBeCloseTo(100 + 10 * 15, 5);
    expect(result.salaryCeiling).toBeGreaterThan(currentSalary);
  });

  it("(b) high-value + ambitious (star_chaser) team: ceiling lands well above sustainableSalary (gamble room)", () => {
    const gs = buildFixture({
      cash: 300,
      rosterCount: 10,
      marketValuePerPlayer: 40, // rosterMW 400 ⇒ teamValue 700, well above the 260 reference
      annualRevenue: 120,
      ambition: 9,
      gmId: STAR_CHASER_GM_ID,
    });
    const result = computeTeamSalaryCeiling(gs, "T-1", { teamCash: 300 });

    expect(result.teamValue).toBeCloseTo(700, 5);
    expect(result.trendFactor).toBe(1); // no season history ⇒ no squeeze
    expect(result.rangeWidth).toBeGreaterThan(0);
    expect(result.ambitionScale).toBeGreaterThan(1); // star_chaser archetype amplifies raw ambition
    expect(result.salaryCeiling).toBeGreaterThan(result.sustainableSalary + 30);
  });

  it("(b-contrast) the same wealthy team with a bargain_hunter GM gets ~no gamble room", () => {
    const wealthyBase = { cash: 300, rosterCount: 10, marketValuePerPlayer: 40, annualRevenue: 120, ambition: 9 };
    const starChaser = computeTeamSalaryCeiling(
      buildFixture({ ...wealthyBase, gmId: STAR_CHASER_GM_ID }),
      "T-1",
      { teamCash: 300 },
    );
    const bargainHunter = computeTeamSalaryCeiling(
      buildFixture({ ...wealthyBase, gmId: BARGAIN_HUNTER_GM_ID }),
      "T-1",
      { teamCash: 300 },
    );

    expect(bargainHunter.ambitionScale).toBeLessThan(0.2); // spec: bargain_hunter/culture_keeper ⇒ ~0
    expect(bargainHunter.salaryCeiling).toBeLessThan(starChaser.salaryCeiling);
  });

  it("(c) 3-season falling teamValue: trendFactor < 1 and the ceiling is squeezed back toward sustainableSalary", () => {
    const wealthyBase = { cash: 300, rosterCount: 10, marketValuePerPlayer: 40, annualRevenue: 120, ambition: 9, gmId: STAR_CHASER_GM_ID };
    const rising = computeTeamSalaryCeiling(
      buildFixture({ ...wealthyBase, seasonSnapshotValues: [400, 500, 600] }),
      "T-1",
      { teamCash: 300 },
    );
    const falling = computeTeamSalaryCeiling(
      buildFixture({ ...wealthyBase, seasonSnapshotValues: [600, 500, 400] }),
      "T-1",
      { teamCash: 300 },
    );

    expect(rising.trendFactor).toBe(1);
    expect(falling.trendFactor).toBeLessThan(1);
    expect(falling.rangeWidth).toBeLessThan(rising.rangeWidth);
    expect(falling.salaryCeiling).toBeLessThan(rising.salaryCeiling);
    // Squeezed case lands closer to the pure income-anchored sustainableSalary line than the un-squeezed one.
    expect(falling.salaryCeiling - falling.sustainableSalary).toBeLessThan(rising.salaryCeiling - rising.sustainableSalary);
  });

  it("no income data yet (fresh team, no sponsor contract/settlement) ⇒ no false zero-cap (Infinity, not 0)", () => {
    const gs = buildFixture({ cash: 200, rosterCount: 8, annualRevenue: undefined as unknown as number });
    const result = computeTeamSalaryCeiling(gs, "T-1", { teamCash: 200 });
    expect(result.expectedSponsor).toBe(0);
    expect(result.salaryCeiling).toBe(Infinity);
  });
});

describe("salary ceiling wiring in buildOrganicSquadPlan (draft-builder.ts)", () => {
  const DISCIPLINES: OrganicDiscipline[] = [{ id: "tdm", category: "power" }];
  const AXIS: Record<CoreAxis, number> = { pow: 0.4, spe: 0.2, men: 0.2, soc: 0.2 };

  function pool(): OrganicPlayerView[] {
    return Array.from({ length: 12 }, (_, i) => ({
      playerId: `c${i}`,
      pow: 70 + i,
      spe: 60,
      men: 60,
      soc: 60,
      disciplineRatings: { tdm: 72 + i },
      marketValue: 20,
      salary: 8, // each additional signing adds 8 to the total wage bill
    }));
  }

  function baseEconomy(over: Partial<OrganicSquadPlanInput["economy"]>): OrganicSquadPlanInput {
    return {
      startingSquad: [],
      candidates: pool(),
      identityAxisWeights: AXIS,
      disciplines: DISCIPLINES,
      economy: {
        cash: 1000, // cash is generous on purpose — isolates the SALARY gate from the cash gate
        cashBuffer: 5,
        salaryTotal: 0,
        boardRisk: 0.3,
        expectedPrize: 0,
        sponsorIncome: 0,
        facilityNet: 0,
        netTransfer: 0,
        weights: deriveUtilityWeights({ ambition: 55, finances: 55, boardConfidence: 50, harmony: 50, playerOpt: 12 }, {}),
        rosterMin: 8,
        rosterMax: 12,
        ...over,
      },
    };
  }

  it("(d) flag off (salaryCeiling undefined) ⇒ salary is never gated, roster can build past a would-be ceiling", () => {
    const result = buildOrganicSquadPlan(baseEconomy({})); // no salaryCeiling field at all
    expect(result.finalSquad.length).toBeGreaterThan(8); // builds past rosterMin toward opt, unconstrained
  });

  it("flag on: a low salaryCeiling stops NEW salary once rosterMin is reached, but never blocks reaching it", () => {
    // 8 players × salary 8 = 64 already exceeds a ceiling of 40 ⇒ every slot past rosterMin(8) must be
    // rejected by the salary gate (cash is abundant, so this isolates the salary check specifically).
    const result = buildOrganicSquadPlan(baseEconomy({ salaryCeiling: 40 }));
    expect(result.finalSquad.length).toBe(8); // hard minimum reached...
    expect(result.stoppedBelowMin).toBe(false); // ...never below it (survival satisfied)...
    expect(result.finalSquad.length).toBeLessThan(12); // ...but no further salary added past the ceiling.
  });
});
