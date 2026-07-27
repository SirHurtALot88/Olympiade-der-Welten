import { describe, expect, it } from "vitest";

import { markRingColor } from "@/app/foundation/discipline-stage/arena/PlayerMark";

// Regression guard for the arena injury feedback (optisches Verletzungs-Feedback):
// der Verletzungs-Ring muss IMMER gewinnen, egal welche anderen Prioritäten
// (Spotlight/eigenes Team/Beziehung) gleichzeitig aktiv sind — sonst geht das
// starke visuelle Signal in einem "normalen" Highlight-Moment unter.
describe("markRingColor injury priority", () => {
  it("injury wins over spotlight, own team and relation", () => {
    expect(markRingColor({ injury: true, spotlight: true, isOwn: true, relation: "ally" })).toBe("var(--nl-risk)");
    expect(markRingColor({ injury: true, spotlight: true })).toBe("var(--nl-risk)");
    expect(markRingColor({ injury: true, isOwn: true })).toBe("var(--nl-risk)");
    expect(markRingColor({ injury: true, relation: "rival" })).toBe("var(--nl-risk)");
  });

  it("falls back to the existing priority order when not injured", () => {
    expect(markRingColor({ spotlight: true, isOwn: true })).toBe("var(--nl-accent)");
    expect(markRingColor({ isOwn: true })).toBe("var(--nl-accent)");
    expect(markRingColor({ relation: "ally" })).toBe("hsl(210 70% 60%)");
    expect(markRingColor({ relation: "rival" })).toBe("var(--nl-risk)");
    expect(markRingColor({})).toBe("var(--nl-line)");
  });
});
