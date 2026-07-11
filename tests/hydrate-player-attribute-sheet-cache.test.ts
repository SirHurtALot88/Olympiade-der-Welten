import { describe, expect, it } from "vitest";

import { invalidatePlayerAttributeSheetCache } from "@/lib/foundation/hydrate-player-attribute-sheet";

describe("hydrate-player-attribute-sheet cache", () => {
  it("exposes save-scoped invalidation", () => {
    expect(() => invalidatePlayerAttributeSheetCache({ saveId: "save-1" })).not.toThrow();
    expect(() => invalidatePlayerAttributeSheetCache()).not.toThrow();
  });
});
