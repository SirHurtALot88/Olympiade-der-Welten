import path from "node:path";
import { describe, expect, it } from "vitest";

describe("transfermarkt audit script", () => {
  it("loads env config and only logs presence flags for database urls", async () => {
    const moduleText = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        path.join(process.cwd(), "scripts/audit-transfermarkt-state.ts"),
        "utf8",
      ),
    );

    expect(moduleText).toContain('loadEnvConfig');
    expect(moduleText).toContain('DATABASE_URL present:');
    expect(moduleText).toContain('DIRECT_URL present:');
    expect(moduleText).toContain('purchasesTotal:');
    expect(moduleText).toContain('recentTransfers:');
    expect(moduleText).not.toContain('console.log(process.env.DATABASE_URL');
    expect(moduleText).not.toContain('console.log(process.env.DIRECT_URL');
  });
});
