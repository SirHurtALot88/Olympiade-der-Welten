import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Prisma studio contract", () => {
  const projectRoot = path.resolve(__dirname, "..");

  it("keeps DisciplineCategory aligned with current database categories", () => {
    const schemaText = fs.readFileSync(path.join(projectRoot, "prisma", "schema.prisma"), "utf8");

    expect(schemaText).toContain("enum DisciplineCategory");
    expect(schemaText).toContain("  power");
    expect(schemaText).toContain("  speed");
    expect(schemaText).toContain("  mental");
    expect(schemaText).toContain("  social");
  });

  it("keeps a LineupSlot smoke query with discipline relation", () => {
    const scriptText = fs.readFileSync(
      path.join(projectRoot, "scripts", "check-prisma-studio-models.ts"),
      "utf8",
    );

    expect(scriptText).toContain("LineupSlot");
    expect(scriptText).toContain("prisma.lineupSlot.findMany");
    expect(scriptText).toContain("include: { discipline: true, lineup: true, player: true, activePlayer: true }");
  });

  it("starts prisma commands through the local env wrapper", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["db:generate"]).toContain("run-prisma-with-env.ts generate");
    expect(packageJson.scripts?.["db:studio"]).toContain("run-prisma-with-env.ts studio");
  });
});
