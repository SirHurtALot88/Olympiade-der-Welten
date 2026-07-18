import { describe, expect, it } from "vitest";

import {
  calculateBoardConfidence,
  getNetTransferBalanceObjective,
  getSportTargetV2,
  resolveBoardDisposition,
  selectBoardObjectiveDrafts,
} from "@/lib/board/team-season-objectives-service";
import { isBoardObjectivesV2Enabled } from "@/lib/board/board-objectives-config";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { TeamBoardConfidenceRecord, TeamIdentity, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";

function failedObjectives(count: number): TeamSeasonObjectiveRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    seasonId: "season-1",
    teamId: "T",
    objectiveId: `obj-${i}`,
    category: "sport",
    label: "x",
    targetValue: 1,
    currentValue: 0,
    status: "failed",
    boardConfidenceDelta: -0.6,
    source: "test",
  })) as TeamSeasonObjectiveRecord[];
}

function withV2<T>(fn: () => T): T {
  const prev = process.env.OLY_BOARD_OBJECTIVES_V2;
  process.env.OLY_BOARD_OBJECTIVES_V2 = "1";
  try {
    return fn();
  } finally {
    if (prev == null) delete process.env.OLY_BOARD_OBJECTIVES_V2;
    else process.env.OLY_BOARD_OBJECTIVES_V2 = prev;
  }
}

// V2 is now the shipped default (flag ON unless explicitly disabled with "0"). withV1 forces the
// legacy path to assert V1-only behaviour (e.g. no perceivedPressure layer).
function withV1<T>(fn: () => T): T {
  const prev = process.env.OLY_BOARD_OBJECTIVES_V2;
  process.env.OLY_BOARD_OBJECTIVES_V2 = "0";
  try {
    return fn();
  } finally {
    if (prev == null) delete process.env.OLY_BOARD_OBJECTIVES_V2;
    else process.env.OLY_BOARD_OBJECTIVES_V2 = prev;
  }
}

function row(teamId: string, ppsTotal: number, marketValueTotal: number): TeamManagementSnapshotRow {
  return { teamId, ppsTotal, marketValueTotal } as TeamManagementSnapshotRow;
}

/** A 4-team league: T1 strongest ... T4 weakest (by pps + market value). */
function buildLeague(): Map<string, TeamManagementSnapshotRow> {
  return new Map([
    ["T1", row("T1", 130, 320)],
    ["T2", row("T2", 110, 260)],
    ["T3", row("T3", 90, 200)],
    ["T4", row("T4", 70, 140)],
  ]);
}

function identity(ambition: number): TeamIdentity {
  return { ambition } as TeamIdentity;
}

describe("Board-Objectives V2 — calibrated sport target", () => {
  it("defaults the V2 flag ON unless env disables it", () => {
    // V2 is the shipped default now: unset env -> ON; only "0" disables it.
    const prev = process.env.OLY_BOARD_OBJECTIVES_V2;
    delete process.env.OLY_BOARD_OBJECTIVES_V2;
    expect(isBoardObjectivesV2Enabled()).toBe(true);
    process.env.OLY_BOARD_OBJECTIVES_V2 = "0";
    expect(isBoardObjectivesV2Enabled()).toBe(false);
    process.env.OLY_BOARD_OBJECTIVES_V2 = "1";
    expect(isBoardObjectivesV2Enabled()).toBe(true);
    if (prev == null) delete process.env.OLY_BOARD_OBJECTIVES_V2;
    else process.env.OLY_BOARD_OBJECTIVES_V2 = prev;
  });

  it("targets a strong ambitious team above its expected finish (a real climb)", () => {
    const rows = buildLeague();
    const target = getSportTargetV2({ identity: identity(10), teamId: "T1", rowsByTeamId: rows });
    // T1 is expected ~rank 1; high ambition still can't go below 1.
    expect(target.rank).toBe(1);
  });

  it("gives a weak team an achievable target near the bottom, not a title push", () => {
    const rows = buildLeague();
    const weakLowAmbition = getSportTargetV2({ identity: identity(2), teamId: "T4", rowsByTeamId: rows });
    // Expected rank for T4 is 4 (weakest); low ambition -> small stretch -> target stays near the bottom.
    expect(weakLowAmbition.rank).toBeGreaterThanOrEqual(3);
  });

  it("damps the stretch for weak teams in a full-size league (bottom-of-table gets a hold target)", () => {
    // 24-team league where the probe team is dead last on both metrics -> expectedRank ~24 (>= damp threshold).
    const rows = new Map<string, TeamManagementSnapshotRow>();
    for (let i = 1; i <= 24; i++) rows.set(`X${i}`, row(`X${i}`, 200 - i * 5, 400 - i * 10));
    const target = getSportTargetV2({ identity: identity(10), teamId: "X24", rowsByTeamId: rows });
    // Damped: maxStretch*0.4=2.4 -> stretch 2 -> target 22, far milder than the undamped stretch-6 (rank 18).
    expect(target.rank).toBeGreaterThanOrEqual(22);
  });

  it("scales difficulty with ambition: more ambition -> harder (lower) target for the same team", () => {
    const rows = buildLeague();
    const lowAmb = getSportTargetV2({ identity: identity(2), teamId: "T2", rowsByTeamId: rows });
    const highAmb = getSportTargetV2({ identity: identity(10), teamId: "T2", rowsByTeamId: rows });
    expect(highAmb.rank).toBeLessThanOrEqual(lowAmb.rank);
  });

  it("never targets below rank 1 or above league size", () => {
    const rows = buildLeague();
    for (const teamId of ["T1", "T2", "T3", "T4"]) {
      for (const amb of [0, 5, 10]) {
        const t = getSportTargetV2({ identity: identity(amb), teamId, rowsByTeamId: rows });
        expect(t.rank).toBeGreaterThanOrEqual(1);
        expect(t.rank).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("Board-Objectives V2 — perceived-pressure layer", () => {
  const boardIdentity = (boardConfidence: number, harmony: number): TeamIdentity =>
    ({ boardConfidence, harmony } as TeamIdentity);

  it("emits perceivedPressure + pressureMomentum only under V2", () => {
    const objectives = failedObjectives(2);
    // V2 default is ON, so force the legacy path to assert the V1 record shape (no perceived layer).
    const v1 = withV1(() => calculateBoardConfidence({ teamId: "T", identity: boardIdentity(5, 5), objectives }));
    expect(v1.perceivedPressure).toBeUndefined();
    expect(v1.pressureMomentum).toBeUndefined();
    const v2 = withV2(() => calculateBoardConfidence({ teamId: "T", identity: boardIdentity(5, 5), objectives }));
    expect(typeof v2.perceivedPressure).toBe("number");
    expect(typeof v2.pressureMomentum).toBe("number");
  });

  it("a patient (high-confidence, high-harmony) board feels less pressure than a volatile one", () => {
    const objectives = failedObjectives(3);
    const patient = withV2(() => calculateBoardConfidence({ teamId: "T", identity: boardIdentity(9, 9), objectives }));
    const volatile = withV2(() => calculateBoardConfidence({ teamId: "T", identity: boardIdentity(2, 2), objectives }));
    expect(patient.perceivedPressure!).toBeLessThan(volatile.perceivedPressure!);
  });

  it("momentum lags: high prior momentum keeps perceived pressure elevated after failures clear", () => {
    const noFailures: TeamSeasonObjectiveRecord[] = [];
    const calm = withV2(() =>
      calculateBoardConfidence({ teamId: "T", identity: boardIdentity(5, 5), objectives: noFailures, storedBoard: { teamId: "T", value: 5, pressure: 5, warnings: [], pressureMomentum: 0 } }),
    );
    const lagging = withV2(() =>
      calculateBoardConfidence({ teamId: "T", identity: boardIdentity(5, 5), objectives: noFailures, storedBoard: { teamId: "T", value: 5, pressure: 5, warnings: [], pressureMomentum: 3 } }),
    );
    // Same current (zero) gap, but the team that was under pressure recently still feels more of it.
    expect(lagging.perceivedPressure!).toBeGreaterThan(calm.perceivedPressure!);
  });

  it("a high-leadership captain lowers perceived pressure without touching goals (F2)", () => {
    const objectives = failedObjectives(3);
    const noCaptain = withV2(() =>
      calculateBoardConfidence({ teamId: "T", identity: boardIdentity(5, 5), objectives, captainLeadershipScore: 0 }),
    );
    const strongCaptain = withV2(() =>
      calculateBoardConfidence({ teamId: "T", identity: boardIdentity(5, 5), objectives, captainLeadershipScore: 80 }),
    );
    expect(strongCaptain.perceivedPressure!).toBeLessThan(noCaptain.perceivedPressure!);
    // Goals (value) are unaffected by the captain — only felt pressure moves.
    expect(strongCaptain.value).toBe(noCaptain.value);
  });
});

describe("Board-Objectives V2 — disposition (F1) + dynamic slate (F4)", () => {
  const id = (ambition: number, boardConfidence: number, harmony: number): TeamIdentity =>
    ({ ambition, boardConfidence, harmony } as TeamIdentity);
  const board = (value: number): TeamBoardConfidenceRecord => ({ teamId: "T", value, pressure: 11 - value, warnings: [] });

  it("overperformance raises ambition + patience; disappointment lowers both (F1)", () => {
    const base = resolveBoardDisposition({ identity: id(5, 5, 5), previousSeasonBoard: null });
    const over = resolveBoardDisposition({ identity: id(5, 5, 5), previousSeasonBoard: board(9) });
    const under = resolveBoardDisposition({ identity: id(5, 5, 5), previousSeasonBoard: board(2) });
    expect(over.ambition).toBeGreaterThan(base.ambition);
    expect(over.patience).toBeGreaterThan(base.patience);
    expect(under.ambition).toBeLessThan(base.ambition);
    expect(under.patience).toBeLessThan(base.patience);
  });

  it("dynamic disposition ambition sharpens the sport target", () => {
    const rows = buildLeague();
    const easy = getSportTargetV2({ identity: identity(5), teamId: "T2", rowsByTeamId: rows, ambition01: 0.1 });
    const hard = getSportTargetV2({ identity: identity(5), teamId: "T2", rowsByTeamId: rows, ambition01: 1.0 });
    expect(hard.rank).toBeLessThanOrEqual(easy.rank);
  });

  it("dynamic slate size caps the number of board objectives (F4)", () => {
    const objectives = Array.from({ length: 8 }, (_, i) => ({
      objectiveId: `sport-rank-${i}`,
      category: "sport",
      label: "x",
      targetValue: 1,
      currentValue: 0,
      status: "open",
      source: "test",
    })) as Parameters<typeof selectBoardObjectiveDrafts>[0]["objectives"];
    const three = selectBoardObjectiveDrafts({ objectives, profile: null, identity: null, slateSize: 3 });
    const five = selectBoardObjectiveDrafts({ objectives, profile: null, identity: null, slateSize: 5 });
    expect(three.length).toBe(3);
    expect(five.length).toBe(5);
  });
});

describe("getNetTransferBalanceObjective (finance)", () => {
  function financeRow(input: { transferNet: number; cash: number }): TeamManagementSnapshotRow {
    return { teamId: "T", transferNet: input.transferNet, cash: input.cash } as TeamManagementSnapshotRow;
  }
  function profileWithCashPriority(cashPriority: number) {
    return { bias: { cashPriority } } as unknown as Parameters<typeof getNetTransferBalanceObjective>[0]["profile"];
  }

  it("does not auto-fail a modest net-buy for a neutral/low cash-priority board (target 0)", () =>
    withV2(() => {
      // Regression for the net-transfer auto-fail bug: cashPriority 5 -> surplus target 0. A modest
      // net-buy (transferNet -5) must NOT be an automatic failure; it becomes a soft overspend ceiling
      // (max(8, cash*0.15) = 15) with netSpend 5 <= 15 -> completed.
      const objective = getNetTransferBalanceObjective({
        row: financeRow({ transferNet: -5, cash: 100 }),
        profile: profileWithCashPriority(5),
        seasonNum: 1,
      });
      expect(objective.targetValue).toBe(15);
      expect(objective.status).toBe("completed");
    }));

  it("keeps an at_risk band and only fails reckless overspend past the ceiling (target 0)", () =>
    withV2(() => {
      const cash = 100; // ceiling = 15; at_risk up to 15 * 1.15 = 17.25
      const atRisk = getNetTransferBalanceObjective({
        row: financeRow({ transferNet: -16, cash }),
        profile: profileWithCashPriority(5),
        seasonNum: 1,
      });
      expect(atRisk.status).toBe("at_risk");
      const failed = getNetTransferBalanceObjective({
        row: financeRow({ transferNet: -30, cash }),
        profile: profileWithCashPriority(5),
        seasonNum: 1,
      });
      expect(failed.status).toBe("failed");
    }));

  it("still demands a real surplus for a cash-focused board (target > 0)", () =>
    withV2(() => {
      const objective = getNetTransferBalanceObjective({
        row: financeRow({ transferNet: 12, cash: 100 }),
        profile: profileWithCashPriority(8),
        seasonNum: 1,
      });
      expect(objective.targetValue).toBe(3.6);
      expect(objective.status).toBe("completed");
    }));
});
