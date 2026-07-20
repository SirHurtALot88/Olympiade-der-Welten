import path from "node:path";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { extractRetoolPlayerAttributes } from "@/scripts/extract-retool-player-attributes";

describe("extract retool player attributes", () => {
  it("finds the Retool attribute query/source", () => {
    const result = extractRetoolPlayerAttributes();

    expect(result.queryName).toBeTruthy();
    expect(["GoogleSheetsQuery", "SqlQueryUnified", "unknown"]).toContain(result.sourceKind);
    expect(result.fields).toContain("power");
    expect(result.ratings).toContain("power_rating");
  });

  it("writes read-only extraction outputs", () => {
    const base = path.join(process.cwd(), "references/retool-player-attributes");
    extractRetoolPlayerAttributes();

    expect(fs.existsSync(`${base}/attribute-query.sql`)).toBe(true);
    expect(fs.existsSync(`${base}/attribute-fields.json`)).toBe(true);
    expect(fs.existsSync(`${base}/README.md`)).toBe(true);
  });
});
