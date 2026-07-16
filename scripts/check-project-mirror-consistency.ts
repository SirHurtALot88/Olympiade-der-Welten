import fs from "node:fs";
import path from "node:path";

type Level = "PASS" | "WARN" | "FAIL";

type Finding = {
  level: Level;
  label: string;
  detail: string;
};

const projectRoot = process.cwd();

const requiredPaths = [
  "app",
  "lib",
  "lib/ai",
  "lib/data",
  "lib/game",
  "lib/game-state",
  "lib/lineups",
  "lib/resolve",
  "lib/room",
  "prisma",
  "scripts",
  "tests",
  "types",
];

const requiredFiles = [
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
  "next.config.ts",
  "prisma/schema.prisma",
];

const requiredScripts = [
  "db:generate",
  "db:migrate",
  "db:seed",
  "test",
  "build",
  "lineup:check-readiness",
  "resolve:check-legacy-matchday",
  "resolve:smoke-apply",
  "retool:extract-ai",
];

function exists(relativePath: string) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8")) as T;
}

function main() {
  const findings: Finding[] = [];

  for (const relativePath of requiredPaths) {
    findings.push({
      level: exists(relativePath) ? "PASS" : "FAIL",
      label: `path:${relativePath}`,
      detail: exists(relativePath) ? "present" : "missing",
    });
  }

  for (const relativePath of requiredFiles) {
    findings.push({
      level: exists(relativePath) ? "PASS" : "FAIL",
      label: `file:${relativePath}`,
      detail: exists(relativePath) ? "present" : "missing",
    });
  }

  if (exists("tsconfig.json")) {
    const tsconfig = readJson<{
      compilerOptions?: { paths?: Record<string, string[]> };
    }>("tsconfig.json");
    const aliasValues = tsconfig.compilerOptions?.paths?.["@/*"] ?? [];
    const aliasOk = aliasValues.includes("./*");
    findings.push({
      level: aliasOk ? "PASS" : "FAIL",
      label: "alias:@/*",
      detail: aliasOk ? 'mapped to "./*"' : `unexpected mapping: ${JSON.stringify(aliasValues)}`,
    });
  } else {
    findings.push({
      level: "FAIL",
      label: "alias:@/*",
      detail: "tsconfig.json missing",
    });
  }

  if (exists("package.json")) {
    const pkg = readJson<{ scripts?: Record<string, string> }>("package.json");
    for (const scriptName of requiredScripts) {
      const present = Boolean(pkg.scripts?.[scriptName]);
      findings.push({
        level: present ? "PASS" : "FAIL",
        label: `script:${scriptName}`,
        detail: present ? pkg.scripts?.[scriptName] ?? "present" : "missing",
      });
    }
  } else {
    findings.push({
      level: "FAIL",
      label: "scripts",
      detail: "package.json missing",
    });
  }

  const failCount = findings.filter((finding) => finding.level === "FAIL").length;
  const warnCount = findings.filter((finding) => finding.level === "WARN").length;
  const passCount = findings.filter((finding) => finding.level === "PASS").length;
  const overall: Level = failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS";

  console.log(`Project mirror consistency: ${overall}`);
  console.log(`projectRoot: ${projectRoot}`);
  console.log(`passes: ${passCount}`);
  console.log(`warnings: ${warnCount}`);
  console.log(`fails: ${failCount}`);
  console.log("checks:");

  for (const finding of findings) {
    console.log(`- [${finding.level}] ${finding.label} | ${finding.detail}`);
  }

  if (overall === "FAIL") {
    process.exitCode = 1;
  }
}

main();
