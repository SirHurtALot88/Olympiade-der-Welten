import { describe, expect, it } from "vitest";

import { prefetchFoundationPanel } from "@/lib/foundation/foundation-panel-prefetch";

describe("foundation panel prefetch", () => {
  it("loads panel modules without throwing", async () => {
    prefetchFoundationPanel("teams");
    prefetchFoundationPanel("lineup");
    await expect(import("@/app/foundation/teams-v2/FoundationTeamsDetailPanel")).resolves.toBeTruthy();
  });
});
