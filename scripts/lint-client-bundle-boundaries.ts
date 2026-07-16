import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CLIENT_ROOTS = ["app/foundation", "components/foundation"];
const FORBIDDEN_IMPORTS = [
  "better-sqlite3",
  "legacy-lineup-local-service",
  "@/lib/persistence/persistence-service",
  "@/lib/lineups/legacy-lineup-local-service",
];

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanClientBundleBoundaries() {
  const violations: string[] = [];

  for (const root of CLIENT_ROOTS) {
    const absoluteRoot = path.join(ROOT, root);
    for (const filePath of collectSourceFiles(absoluteRoot)) {
      const relativePath = path.relative(ROOT, filePath);
      const source = fs.readFileSync(filePath, "utf8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (source.includes(`"${forbidden}"`) || source.includes(`'${forbidden}'`)) {
          violations.push(`${relativePath} imports forbidden module "${forbidden}"`);
        }
      }
    }
  }

  return violations;
}

function main() {
  const violations = scanClientBundleBoundaries();
  if (violations.length > 0) {
    console.error("Client bundle boundary violations:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }
  console.log("Client bundle boundaries OK.");
}

main();
