import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
// "apps" enthaelt eigenstaendige Apps (z. B. apps/LEC) mit eigener tsconfig und
// eigenem "@/"-Alias -> dieser Oly-Root-Check darf sie nicht scannen (sie haben
// eigene CI/Tests). Sonst werden ihre "@/"-Imports faelschlich als fehlend gemeldet.
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "coverage", ".git", "outputs", "apps"]);

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }
  return files;
}

function resolveAliasImport(importPath: string) {
  if (!importPath.startsWith("@/")) {
    return null;
  }
  const relative = importPath.slice(2);
  const base = path.join(ROOT, relative);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function collectImports(source: string) {
  const imports = new Set<string>();
  const patterns = [
    /from\s+["'](@\/[^"']+)["']/g,
    /import\s+["'](@\/[^"']+)["']/g,
    /require\(\s*["'](@\/[^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      imports.add(match[1]!);
    }
  }
  return [...imports];
}

function main() {
  const missing: Array<{ file: string; importPath: string }> = [];
  for (const file of walk(ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    for (const importPath of collectImports(source)) {
      if (!resolveAliasImport(importPath)) {
        missing.push({ file: path.relative(ROOT, file), importPath });
      }
    }
  }

  if (missing.length > 0) {
    console.error("Missing @/ imports:");
    for (const entry of missing.slice(0, 50)) {
      console.error(`- ${entry.file} -> ${entry.importPath}`);
    }
    if (missing.length > 50) {
      console.error(`... and ${missing.length - 50} more`);
    }
    process.exit(1);
    return;
  }

  console.log(JSON.stringify({ ok: true, checkedFiles: walk(ROOT).length }, null, 2));
}

main();
