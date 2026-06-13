import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";

describe("feature audit ui contract", () => {
  it("renders the feature audit matrix in the cockpit with filters and export links", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain("data-testid=\"feature-audit-matrix\"");
    expect(fileText).toContain("Feature Audit");
    expect(fileText).toContain("featureAuditFilters.map");
    expect(fileText).toContain("feature-audit-top-blockers");
    expect(fileText).toContain("/outputs/feature-audit-matrix.md");
    expect(fileText).toContain("/outputs/feature-audit-matrix.csv");
    expect(fileText).toContain("test_missing");
    expect(fileText).toContain("smoke_missing");
    expect(fileText).toContain("MP fehlt");
  });
});
