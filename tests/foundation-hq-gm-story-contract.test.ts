import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildGmStoryView, getGmStoryTone } from "@/lib/foundation/gm-story";

const root = process.cwd();

describe("foundation hq gm story contract", () => {
  it("surfaces gm change, hot seat and board pressure in HQ", () => {
    const foundationSource = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");
    const officeSource = readFileSync(join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx"), "utf8");

    expect(foundationSource).toContain("ManagerOfficeClient");
    expect(officeSource).toContain('data-testid="foundation-hq-gm-story"');
    expect(officeSource).toContain("selectedHqGmStory");
    expect(officeSource).toContain("Hot Seat");
    expect(officeSource).toContain("Board-Wechsel");
  });

  it("derives gm story tone from board pressure and replacement signals", () => {
    expect(getGmStoryTone({ boardPressure: 8.5, boardConfidenceValue: 6 })).toBe("hot");
    expect(
      getGmStoryTone({
        source: "board_replacement",
        dismissalReason: "high_board_pressure",
        boardPressure: 4,
        boardConfidenceValue: 5,
      }),
    ).toBe("new");

    const hotSeat = buildGmStoryView({
      boardPressure: 8.2,
      boardConfidenceValue: 4.5,
    });
    expect(hotSeat.label).toBe("Hot Seat");
    expect(hotSeat.statusLabel).toBe("Hot Seat");
    expect(hotSeat.detail).toContain("Druck 8,2");

    const replacement = buildGmStoryView({
      source: "board_replacement",
      dismissalReason: "low_board_confidence",
      boardPressure: 3,
      boardConfidenceValue: 2,
    });
    expect(replacement.label).toBe("Board-Wechsel");
    expect(replacement.detail).toContain("Board Confidence zu niedrig");
  });
});
