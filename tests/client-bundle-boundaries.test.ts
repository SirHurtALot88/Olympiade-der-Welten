import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const CLIENT_ROOTS = ["app/foundation", "components/foundation"];
const FORBIDDEN_IMPORTS = ["better-sqlite3", "legacy-lineup-local-service"];

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return /\.(tsx|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("client bundle boundaries", () => {
  it("keeps sqlite persistence out of foundation client bundles", () => {
    const violations: string[] = [];
    for (const root of CLIENT_ROOTS) {
      for (const filePath of collectSourceFiles(path.join(ROOT, root))) {
        const source = fs.readFileSync(filePath, "utf8");
        for (const forbidden of FORBIDDEN_IMPORTS) {
          if (source.includes(`"${forbidden}"`) || source.includes(`'${forbidden}'`)) {
            violations.push(`${path.relative(ROOT, filePath)} -> ${forbidden}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
