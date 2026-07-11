import { describe, expect, it } from "vitest";

import {
  PLAYTEST_CHECKLIST_BLOCKER_IDS,
  listPlaytestBlockersWithoutRoute,
  resolveFlowBlockerRoute,
  resolvePrimaryBlockerRoute,
} from "@/lib/foundation/flow-blocker-routing";

describe("flow-blocker-routing", () => {
  it("maps every playtest-checklist blocker id to a UI route", () => {
    expect(listPlaytestBlockersWithoutRoute()).toEqual([]);
    for (const blockerId of PLAYTEST_CHECKLIST_BLOCKER_IDS) {
      expect(resolveFlowBlockerRoute(blockerId)).not.toBeNull();
    }
  });

  it("resolves lineup_not_submitted to lineup view", () => {
    expect(resolveFlowBlockerRoute("lineup_not_submitted")).toMatchObject({
      targetView: "lineup",
      ctaLabel: "Lineup bestätigen",
    });
  });

  it("resolves training_missing to training compact", () => {
    expect(resolveFlowBlockerRoute("training_missing")).toMatchObject({
      targetView: "trainingCompact",
    });
  });

  it("picks the first routable blocker from a list", () => {
    expect(
      resolvePrimaryBlockerRoute(["unknown_blocker", "training_missing", "lineup_not_submitted"]),
    ).toMatchObject({
      targetView: "trainingCompact",
    });
  });
});
