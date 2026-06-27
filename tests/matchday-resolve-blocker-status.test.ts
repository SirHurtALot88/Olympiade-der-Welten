import { describe, expect, it } from "vitest";

import { extractMatchdayResolveBlockerStatus } from "@/lib/foundation/matchday-resolve-blocker-status";

describe("matchday resolve blocker status", () => {
  it("returns team row status when active team is not ready", () => {
    expect(
      extractMatchdayResolveBlockerStatus({
        preview: {
          preview: { status: "ready" },
          teamRows: [{ teamId: "M-M", status: "missing_lineups" }],
        },
        activeTeamId: "M-M",
      }),
    ).toBe("missing_lineups");
  });

  it("falls back to readinessStatus when status is missing", () => {
    expect(
      extractMatchdayResolveBlockerStatus({
        preview: {
          preview: { status: "ready" },
          teamRows: [{ teamId: "M-M", readinessStatus: "incomplete_lineups" }],
        },
        activeTeamId: "M-M",
      }),
    ).toBe("incomplete_lineups");
  });

  it("returns global preview status when active team is ready", () => {
    expect(
      extractMatchdayResolveBlockerStatus({
        preview: {
          preview: { status: "missing_scores" },
          teamRows: [{ teamId: "M-M", status: "ready" }],
        },
        activeTeamId: "M-M",
      }),
    ).toBe("missing_scores");
  });
});
