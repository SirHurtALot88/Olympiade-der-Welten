import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, execSync, spawnSync } from "node:child_process";

type SnapshotMetadata = {
  generatedAt: string;
  gitBranch: string | null;
  gitCommit: string | null;
  packageName: string | null;
  nodeVersion: string | null;
  npmVersion: string | null;
  projectRoot: string;
};

type RouteSummary = {
  file: string;
  kind: "page" | "route" | "layout";
  appPath: string;
};

type PrismaSummary = {
  schemaPath: string;
  models: string[];
  enums: string[];
  migrations: string[];
  syncScripts: Array<{ name: string; command: string }>;
};

type ServiceSummary = {
  file: string;
  group: string;
  exports: string[];
  description: string;
  lineCount: number;
};

type ScriptSummary = {
  name: string;
  command: string;
  tags: string[];
};

type TestSummary = {
  files: string[];
  groups: Record<string, string[]>;
  lastKnownStatus: string;
};

type DocSummary = {
  file: string;
  keywordHits: Record<string, number>;
};

type SafetyFlag = {
  path: string;
  kind: string;
  dryRunDefault: boolean | null;
  writeFlagRequired: boolean | null;
  allowedTables: string[];
  forbiddenTables: string[];
};

type ProjectSnapshot = {
  metadata: SnapshotMetadata;
  appStructure: {
    routes: RouteSummary[];
    foundationTabs: Array<{ id: string; label: string }>;
    apiEndpoints: string[];
  };
  prisma: PrismaSummary;
  services: ServiceSummary[];
  scripts: ScriptSummary[];
  tests: TestSummary;
  docs: DocSummary[];
  knownCompletedBlocks: string[];
  knownBlockers: string[];
  safetyFlags: SafetyFlag[];
  masterplanRules: {
    snapshotAfterPhase: boolean;
    phase0AWriteSafetyAudit: boolean;
    standingsApplyGateActive: boolean;
    noLegacyTermsInActiveStandings: boolean;
    buildGatePerPhase: string[];
  };
  sourceZip: {
    created: boolean;
    path: string | null;
    reason: string | null;
  };
};

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "references", "project-snapshots");
const jsonOutputPath = path.join(outputDir, "current-app-snapshot.json");
const markdownOutputPath = path.join(outputDir, "current-app-snapshot.md");
const manifestOutputPath = path.join(outputDir, "current-app-file-manifest.json");
const zipOutputPath = path.join(outputDir, "current-app-source.zip");

const excludedRootNames = new Set(["node_modules", ".next", ".next-dev", ".turbo", ".git"]);

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function safeExec(command: string, args: string[] = []) {
  try {
    return execFileSync(command, args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

async function readText(filePath: string) {
  return fs.readFile(filePath, "utf8");
}

async function listFiles(dir: string, predicate: (entryPath: string) => boolean): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (excludedRootNames.has(entry.name)) {
        continue;
      }
      files.push(...(await listFiles(fullPath, predicate)));
      continue;
    }

    if (predicate(fullPath)) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

function classifyScript(name: string, command: string): string[] {
  const tags: string[] = [];
  const text = `${name} ${command}`.toLowerCase();
  if (text.includes("audit")) tags.push("audit");
  if (text.includes("smoke")) tags.push("smoke");
  if (name.includes("build") || name.includes("clean") || command.includes("next build")) tags.push("build/clean");
  if (text.includes("retool:extract")) tags.push("retool extract");
  if (text.includes("sync") || text.includes("import")) tags.push("sync/import");
  if (text.includes("seed") || text.includes("migrate") || text.includes("studio")) tags.push("db");
  if (text.includes("preview")) tags.push("preview");
  return Array.from(new Set(tags));
}

function inferServiceDescription(file: string): string {
  const base = path.basename(file, path.extname(file));
  if (base.includes("buy-service")) return "Transfermarkt buy write path with preview/execute flow.";
  if (base.includes("sell-service")) return "Transfermarkt sell write path with preview/execute flow.";
  if (base.includes("history-read-service")) return "Read-only transfer history listing service.";
  if (base.includes("read-service")) return "Read-only data loading service.";
  if (base.includes("preview-engine")) return "Read-only preview engine.";
  if (base.includes("sheet")) return "Sheet import or audit helper.";
  if (base.includes("repository")) return "Persistence or read repository.";
  if (base.includes("mapper")) return "Mapping layer between sources and app models.";
  if (base.includes("lab")) return "Lab or debug helper for visual verification.";
  return `${base} module`;
}

function extractExports(text: string): string[] {
  const exports = new Set<string>();
  const patterns = [
    /export\s+async\s+function\s+([A-Za-z0-9_]+)/g,
    /export\s+function\s+([A-Za-z0-9_]+)/g,
    /export\s+const\s+([A-Za-z0-9_]+)/g,
    /export\s+type\s+([A-Za-z0-9_]+)/g,
    /export\s+class\s+([A-Za-z0-9_]+)/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      exports.add(match[1]);
    }
  }

  const blockMatches = text.match(/export\s*{([^}]+)}/g) ?? [];
  for (const block of blockMatches) {
    const inner = block.replace(/^export\s*{/, "").replace(/}$/, "");
    for (const part of inner.split(",")) {
      const name = part.trim().split(/\s+as\s+/i)[0]?.trim();
      if (name) exports.add(name);
    }
  }

  return Array.from(exports).sort();
}

function extractFoundationTabs(text: string) {
  const matches = text.matchAll(/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*\}/g);
  return Array.from(matches).map((match) => ({ id: match[1], label: match[2] }));
}

function summarizeDocs(docs: Array<{ file: string; text: string }>): DocSummary[] {
  const keywords = [
    "DONE",
    "BLOCKED",
    "TODO",
    "offline_legacy_only",
    "Golden Master",
    "no writes",
    "transfermarkt",
    "standings",
    "cash",
    "attributes",
  ];

  return docs.map(({ file, text }) => ({
    file,
    keywordHits: Object.fromEntries(
      keywords.map((keyword) => [
        keyword,
        (text.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) ?? []).length,
      ]),
    ),
  }));
}

function buildKnownCompletedBlocks(allTexts: string[]) {
  const haystack = allTexts.join("\n").toLowerCase();
  const blocks = [
    ["Transfermarkt read-only", haystack.includes("free-agents") && haystack.includes("transfermarkt")],
    ["Buy-Service", haystack.includes("transfermarkt-buy-service") || haystack.includes("buy-service")],
    ["Sell-Service", haystack.includes("transfermarkt-sell-service") || haystack.includes("sell-service")],
    ["Transferhistorie", haystack.includes("transfer history") || haystack.includes("transferhistorie")],
    ["echte 12 Attribute importiert", haystack.includes("playerattributesheet") || haystack.includes("tormentrating")],
    ["negative Fit-Werte möglich", haystack.includes("mercenary") && haystack.includes("fit")],
    ["Build-Stabilität", haystack.includes("next:clean") && haystack.includes("build:clean")],
    ["Standings Preview read-only", haystack.includes("standings preview") && haystack.includes("blockedrules")],
    ["Mutating Script Safety Audit", haystack.includes("project:audit-write-safety") || haystack.includes("phase 0a")],
  ];

  return blocks.filter(([, ok]) => ok).map(([label]) => label as string);
}

function buildKnownBlockers(allTexts: string[]) {
  const haystack = allTexts.join("\n").toLowerCase();
  const blockers = [
    ["Standings/Punkte-Sheet-Mapping fehlt", haystack.includes("season_standings_sheet_mapping_missing")],
    ["Rank-to-points Mapping fehlt", haystack.includes("rank_to_points_mapping_missing") || haystack.includes("rang-zu-punkte")],
    ["Season standings export fehlt", haystack.includes("season standings sheet export missing") || haystack.includes("todo_retool_or_sheet_export_required")],
    ["Cash/Preisgeld-Tabelle fehlt", haystack.includes("cash_prize_table_missing") || haystack.includes("preisgeld bleibt blockiert")],
    ["VIP Wal Attribute fehlen", haystack.includes("vip wal")],
    ["mögliche Offline-Legacy-Spuren entfernen", haystack.includes("offline_legacy_only")],
    ["Sell-UI fehlt", haystack.includes("noch kein normaler ui-verkaufsbutton") || haystack.includes("sell-ui")],
    ["Golden-Master-Fit fehlt", haystack.includes("golden-master-fit")],
  ];

  return blockers.filter(([, ok]) => ok).map(([label]) => label as string);
}

function buildSafetyFlags(): SafetyFlag[] {
  return [
    {
      path: "lib/market/transfermarkt-buy-service.ts",
      kind: "buy write path",
      dryRunDefault: true,
      writeFlagRequired: true,
      allowedTables: ["Transfer", "ActivePlayer", "TeamSeasonState"],
      forbiddenTables: ["SQLite", "standings", "season prize", "AI"],
    },
    {
      path: "lib/market/transfermarkt-sell-service.ts",
      kind: "sell write path",
      dryRunDefault: true,
      writeFlagRequired: true,
      allowedTables: ["Transfer", "ActivePlayer", "TeamSeasonState"],
      forbiddenTables: ["SQLite", "standings", "season prize", "AI"],
    },
    {
      path: "lib/resolve/legacy-matchday-result-apply-service.ts",
      kind: "result apply path",
      dryRunDefault: true,
      writeFlagRequired: true,
      allowedTables: [
        "local SeasonState.matchdayResults",
        "local SeasonState.disciplineResults",
        "local SeasonState.playerDisciplinePerformances",
        "local SeasonState.disciplineHighlights",
        "local SeasonState.resultAuditLogs",
      ],
      forbiddenTables: ["Prisma MatchdayResult", "TeamSeasonState standings", "cash", "price money"],
    },
    {
      path: "scripts/sync-player-attribute-sheet-to-db.ts",
      kind: "attribute sync script",
      dryRunDefault: true,
      writeFlagRequired: true,
      allowedTables: ["PlayerAttribute"],
      forbiddenTables: ["transfermarkt", "standings", "SQLite"],
    },
    {
      path: "scripts/sync-player-sheet-columns-to-db.ts",
      kind: "player sheet sync script",
      dryRunDefault: true,
      writeFlagRequired: true,
      allowedTables: ["Player", "PlayerAttribute"],
      forbiddenTables: ["transfermarkt", "standings", "SQLite"],
    },
    {
      path: "prisma/seed.ts",
      kind: "seed path",
      dryRunDefault: false,
      writeFlagRequired: false,
      allowedTables: ["foundation seed tables"],
      forbiddenTables: ["production-only destructive reset"],
    },
    {
      path: "prisma/migrations",
      kind: "migration path",
      dryRunDefault: false,
      writeFlagRequired: false,
      allowedTables: ["schema-level changes"],
      forbiddenTables: ["blind resets", "drops without explicit intent"],
    },
  ];
}

function buildMasterplanRules(allTexts: string[]) {
  const haystack = allTexts.join("\n").toLowerCase();
  return {
    snapshotAfterPhase:
      haystack.includes("snapshot pflicht") || haystack.includes("project:export-snapshot"),
    phase0AWriteSafetyAudit:
      haystack.includes("phase 0a") || haystack.includes("mutating script safety audit"),
    standingsApplyGateActive:
      haystack.includes("standings apply darf nicht") ||
      haystack.includes("rank-to-points") && haystack.includes("season-standings"),
    noLegacyTermsInActiveStandings:
      haystack.includes("offline_legacy_only") && haystack.includes("keine fame"),
    buildGatePerPhase: [
      "npm run next:clean",
      "npm run build",
      "npm run build",
      "npm test",
      "npm run db:smoke-studio-models (bei Prisma/DB-Aenderungen)",
    ],
  };
}

async function createSourceZip(): Promise<{ created: boolean; path: string | null; reason: string | null }> {
  const gitAvailable = safeExec("git", ["rev-parse", "--is-inside-work-tree"]);
  const zipAvailable = safeExec("which", ["zip"]);

  if (!gitAvailable) {
    return { created: false, path: null, reason: "git unavailable" };
  }

  if (!zipAvailable) {
    return { created: false, path: null, reason: "zip unavailable" };
  }

  let trackedFiles: string[];
  try {
    trackedFiles = execSync("git ls-files", { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((file) => {
        const parts = file.split("/");
        if (parts.some((part) => excludedRootNames.has(part))) return false;
        const base = path.basename(file);
        if (base.startsWith(".env")) return false;
        if (file.startsWith("references/project-snapshots/")) return false;
        return true;
      });
  } catch {
    return { created: false, path: null, reason: "git ls-files failed" };
  }

  if (trackedFiles.length === 0) {
    return { created: false, path: null, reason: "no tracked files found" };
  }

  const zipRun = spawnSync("zip", ["-q", zipOutputPath, ...trackedFiles], {
    cwd: projectRoot,
    stdio: ["ignore", "ignore", "pipe"],
  });

  if (zipRun.status !== 0) {
    return { created: false, path: null, reason: "zip creation failed" };
  }

  return { created: true, path: zipOutputPath, reason: null };
}

function buildMarkdown(snapshot: ProjectSnapshot) {
  const scripts = snapshot.scripts
    .map((script) => `- \`${script.name}\`: ${script.command}${script.tags.length ? ` [${script.tags.join(", ")}]` : ""}`)
    .join("\n");
  const routes = snapshot.appStructure.routes
    .map((route) => `- \`${route.appPath}\` (${route.kind})`)
    .join("\n");
  const apis = snapshot.appStructure.apiEndpoints.map((route) => `- \`${route}\``).join("\n");
  const models = snapshot.prisma.models.map((model) => `- \`${model}\``).join("\n");
  const enums = snapshot.prisma.enums.map((entry) => `- \`${entry}\``).join("\n");
  const migrations = snapshot.prisma.migrations.map((entry) => `- \`${entry}\``).join("\n");
  const writeFlags = snapshot.safetyFlags
    .map(
      (flag) =>
        `- \`${flag.path}\`: ${flag.kind}; dryRun default: ${flag.dryRunDefault === null ? "unknown" : flag.dryRunDefault ? "yes" : "no"}; ` +
        `write flag nötig: ${flag.writeFlagRequired === null ? "unknown" : flag.writeFlagRequired ? "yes" : "no"}; ` +
        `allowed: ${flag.allowedTables.join(", ")}; forbidden: ${flag.forbiddenTables.join(", ")}`,
    )
    .join("\n");
  const readOnlyPaths = snapshot.services
    .filter((service) => service.description.toLowerCase().includes("read-only") || service.file.includes("preview"))
    .slice(0, 20)
    .map((service) => `- \`${service.file}\`: ${service.description}`)
    .join("\n");
  const docs = snapshot.docs
    .map((doc) => `- \`${doc.file}\``)
    .join("\n");

  return `# Current App Snapshot

## 1. Executive Summary
- Generated: ${snapshot.metadata.generatedAt}
- Project root: \`${snapshot.metadata.projectRoot}\`
- Package: \`${snapshot.metadata.packageName ?? "unknown"}\`
- Git branch: \`${snapshot.metadata.gitBranch ?? "unknown"}\`
- Git commit: \`${snapshot.metadata.gitCommit ?? "unknown"}\`
- Node / npm: \`${snapshot.metadata.nodeVersion ?? "unknown"}\` / \`${snapshot.metadata.npmVersion ?? "unknown"}\`

## 2. Current Feature Status
- Completed:
${snapshot.knownCompletedBlocks.map((item) => `  - ${item}`).join("\n")}
- Blockers:
${snapshot.knownBlockers.map((item) => `  - ${item}`).join("\n")}

## 3. Routes / Pages
${routes}

Foundation tabs:
${snapshot.appStructure.foundationTabs.map((tab) => `- \`${tab.id}\` → ${tab.label}`).join("\n")}

## 4. API Endpoints
${apis}

## 5. Prisma Models / Migrations
Models:
${models}

Enums:
${enums}

Migrations:
${migrations}

## 6. Write Paths
${writeFlags}

## 7. Read-only Preview Paths
${readOnlyPaths}

## 8. Masterplan Rules
- Snapshot after phase: ${snapshot.masterplanRules.snapshotAfterPhase ? "yes" : "no"}
- Phase 0A write safety audit: ${snapshot.masterplanRules.phase0AWriteSafetyAudit ? "yes" : "no"}
- Standings apply gate active: ${snapshot.masterplanRules.standingsApplyGateActive ? "yes" : "no"}
- No legacy terms in active standings: ${snapshot.masterplanRules.noLegacyTermsInActiveStandings ? "yes" : "no"}
- Build gate per phase:
${snapshot.masterplanRules.buildGatePerPhase.map((item) => `  - ${item}`).join("\n")}

## 9. Audits / Smoke Scripts
${scripts}

## 10. Tests
- Last known local status: ${snapshot.tests.lastKnownStatus}
- Test files: ${snapshot.tests.files.length}
- Transfermarkt:
${(snapshot.tests.groups.Transfermarkt || []).map((item) => `  - \`${item}\``).join("\n")}
- Standings Preview:
${(snapshot.tests.groups["Standings Preview"] || []).map((item) => `  - \`${item}\``).join("\n")}
- Attribute Import:
${(snapshot.tests.groups["Attribute Import"] || []).map((item) => `  - \`${item}\``).join("\n")}
- Build Stability:
${(snapshot.tests.groups["Build Stability"] || []).map((item) => `  - \`${item}\``).join("\n")}

## 11. Blockers / Next Steps
${snapshot.knownBlockers.map((item) => `- ${item}`).join("\n")}

## Docs
${docs}

## Source Zip
- Created: ${snapshot.sourceZip.created ? "yes" : "no"}
- Path: ${snapshot.sourceZip.path ?? "not created"}
- Reason: ${snapshot.sourceZip.reason ?? "n/a"}
`;
}

async function main() {
  await ensureDir(outputDir);

  const packageJsonText = await readText(path.join(projectRoot, "package.json"));
  const packageJson = JSON.parse(packageJsonText) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  const schemaText = await readText(path.join(projectRoot, "prisma", "schema.prisma"));
  const foundationText = await readText(path.join(projectRoot, "app", "foundation", "FoundationPageClient.tsx"));

  const metadata: SnapshotMetadata = {
    generatedAt: new Date().toISOString(),
    gitBranch: safeExec("git", ["branch", "--show-current"]),
    gitCommit: safeExec("git", ["rev-parse", "HEAD"]),
    packageName: packageJson.name ?? null,
    nodeVersion: process.version,
    npmVersion: safeExec("npm", ["-v"]),
    projectRoot,
  };

  const appFiles = await listFiles(path.join(projectRoot, "app"), (filePath) =>
    /\/(page|route|layout)\.tsx?$/.test(filePath.replace(/\\/g, "/")),
  );
  const routes: RouteSummary[] = appFiles.map((file) => {
    const normalized = file.replace(/\\/g, "/");
    const kind = normalized.endsWith("/route.ts") ? "route" : normalized.endsWith("/layout.tsx") ? "layout" : "page";
    const appPath = normalized
      .replace(/^app/, "")
      .replace(/\/page\.tsx$/, "")
      .replace(/\/route\.ts$/, "")
      .replace(/\/layout\.tsx$/, "")
      .replace(/^$/, "/");

    return { file: normalized, kind, appPath: appPath || "/" };
  });

  const apiEndpoints = routes
    .filter((route) => route.kind === "route" && route.appPath.startsWith("/api/"))
    .map((route) => route.appPath);

  const foundationTabs = extractFoundationTabs(foundationText);

  const models = Array.from(schemaText.matchAll(/^model\s+([A-Za-z0-9_]+)/gm)).map((match) => match[1]);
  const enums = Array.from(schemaText.matchAll(/^enum\s+([A-Za-z0-9_]+)/gm)).map((match) => match[1]);
  const migrations = (await listFiles(path.join(projectRoot, "prisma", "migrations"), (filePath) => filePath.endsWith("migration.sql"))).sort();
  const syncScripts = Object.entries(packageJson.scripts ?? {})
    .filter(([name]) => name.includes("sync") || name.includes("db:"))
    .map(([name, command]) => ({ name, command }));

  const prisma: PrismaSummary = {
    schemaPath: "prisma/schema.prisma",
    models,
    enums,
    migrations,
    syncScripts,
  };

  const serviceRoots = [
    "lib/market",
    "lib/standings",
    "lib/lineups",
    "lib/resolve",
    "lib/db",
    "lib/data",
  ];
  const serviceFiles = (
    await Promise.all(
      serviceRoots.map((root) =>
        listFiles(path.join(projectRoot, root), (filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx")),
      ),
    )
  ).flat();

  const services: ServiceSummary[] = [];
  for (const file of serviceFiles) {
    const text = await readText(path.join(projectRoot, file));
    services.push({
      file,
      group: file.split("/").slice(0, 2).join("/"),
      exports: extractExports(text),
      description: inferServiceDescription(file),
      lineCount: text.split("\n").length,
    });
  }

  const scripts: ScriptSummary[] = Object.entries(packageJson.scripts ?? {}).map(([name, command]) => ({
    name,
    command,
    tags: classifyScript(name, command),
  }));

  const testFiles = await listFiles(path.join(projectRoot, "tests"), (filePath) => filePath.endsWith(".test.ts"));
  const groupRules: Array<[string, RegExp]> = [
    ["Transfermarkt", /transfermarkt|transfer-history|foundation-transfermarkt/i],
    ["Buy", /buy/i],
    ["Sell", /sell/i],
    ["History", /history/i],
    ["Standings Preview", /standings-preview|standings-online-version/i],
    ["Attribute Import", /attribute|player-attributes/i],
    ["Formatting", /formatting|column-contract|lab/i],
    ["Build Stability", /prisma-studio|golden-master|singleplayer-state/i],
  ];
  const groupedTests = Object.fromEntries(
    groupRules.map(([label, pattern]) => [label, testFiles.filter((file) => pattern.test(file))]),
  );

  const tests: TestSummary = {
    files: testFiles,
    groups: groupedTests,
    lastKnownStatus: "unknown at export time; run npm test for current status",
  };

  const docFiles = await listFiles(path.join(projectRoot, "docs"), (filePath) => filePath.endsWith(".md"));
  const docsWithText = await Promise.all(
    docFiles.map(async (file) => ({ file, text: await readText(path.join(projectRoot, file)) })),
  );
  const docs = summarizeDocs(docsWithText);

  const allTexts = [
    packageJsonText,
    schemaText,
    foundationText,
    ...docsWithText.map((doc) => doc.text),
    ...services.map((service) => service.description),
  ];

  const knownCompletedBlocks = buildKnownCompletedBlocks(allTexts);
  const knownBlockers = buildKnownBlockers(allTexts);
  const safetyFlags = buildSafetyFlags();
  const masterplanRules = buildMasterplanRules(allTexts);
  const sourceZip = await createSourceZip();

  const snapshot: ProjectSnapshot = {
    metadata,
    appStructure: {
      routes,
      foundationTabs,
      apiEndpoints,
    },
    prisma,
    services,
    scripts,
    tests,
    docs,
    knownCompletedBlocks,
    knownBlockers,
    safetyFlags,
    masterplanRules,
    sourceZip,
  };

  const fileManifest = await listFiles(projectRoot, (filePath) => {
    const normalized = filePath.replace(/\\/g, "/");
    const relative = path.relative(projectRoot, normalized).replace(/\\/g, "/");
    if (!relative) return false;
    if (relative.startsWith("node_modules/")) return false;
    if (relative.startsWith(".next/") || relative.startsWith(".next-dev/") || relative.startsWith(".turbo/")) return false;
    const base = path.basename(relative);
    if (base.startsWith(".env")) return false;
    return true;
  });

  await fs.writeFile(jsonOutputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.writeFile(markdownOutputPath, `${buildMarkdown(snapshot)}\n`);
  await fs.writeFile(manifestOutputPath, `${JSON.stringify(fileManifest, null, 2)}\n`);

  console.log(`snapshotJson: ${jsonOutputPath}`);
  console.log(`snapshotMarkdown: ${markdownOutputPath}`);
  console.log(`snapshotManifest: ${manifestOutputPath}`);
  console.log(`sourceZip: ${sourceZip.created ? sourceZip.path : `skipped (${sourceZip.reason})`}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
