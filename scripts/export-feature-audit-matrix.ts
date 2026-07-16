import fs from "node:fs";
import path from "node:path";

import {
  buildFeatureAuditMatrix,
  getFeatureAuditFlags,
  type FeatureAuditEntry,
} from "@/lib/foundation/feature-audit-matrix";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function escapeCsv(value: string | number | boolean): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function listOutputFiles(): string[] {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR).filter((entry) => fs.statSync(path.join(OUTPUT_DIR, entry)).isFile());
}

function joinList(values: string[]): string {
  return values.length > 0 ? values.join("; ") : "—";
}

function renderStatus(entry: FeatureAuditEntry): string {
  if (entry.prodReady) return `${entry.status} / prod`;
  if (entry.sandboxOnly) return `${entry.status} / sandbox`;
  return entry.status;
}

function renderMarkdown(entries: FeatureAuditEntry[], matrix: ReturnType<typeof buildFeatureAuditMatrix>): string {
  const lines: string[] = [
    "# Feature Audit Matrix",
    "",
    `Generated: ${matrix.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Features erfasst: ${matrix.summary.total}`,
    `- Prod-ready: ${matrix.summary.prodReady}`,
    `- Sandbox-ready oder besser: ${matrix.summary.sandboxReadyOrBetter}`,
    `- Preview-only/geplant: ${matrix.summary.previewOnly}`,
    `- Local-write Features: ${matrix.summary.localWrite}`,
    `- Multiplayer-ready: ${matrix.summary.multiplayerReady}`,
    `- Fehlende Tests: ${matrix.summary.missingTests}`,
    `- Fehlende Browser-Smokes: ${matrix.summary.missingSmoke}`,
    `- Local-write ohne Write-Safety: ${matrix.summary.localWriteWithoutWriteSafety}`,
    `- Multiplayer fehlt: ${matrix.summary.multiplayerMissing}`,
    "",
    "## Top Blocker",
    "",
  ];

  for (const blocker of matrix.summary.topBlockers) {
    lines.push(`- ${blocker.label}: \`${blocker.blocker}\``);
  }
  if (matrix.summary.topBlockers.length === 0) lines.push("- Keine Blocker erfasst.");

  lines.push(
    "",
    "## Matrix",
    "",
    "| Feature | Kategorie | Status | Tests | Smoke | Write Safety | Multiplayer | Blocker | Proof |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const entry of entries) {
    const flags = getFeatureAuditFlags(entry);
    lines.push(
      [
        entry.label,
        entry.category,
        renderStatus(entry),
        flags.missingTests ? "test_missing" : joinList(entry.testCoverage),
        flags.missingSmoke ? "smoke_missing" : joinList(entry.smokeCoverage),
        flags.localWriteWithoutWriteSafety ? "write_safety_missing" : entry.writeSafety,
        entry.multiplayerReady ? "ready" : "missing",
        joinList(entry.knownBlockers),
        joinList(entry.proofFiles),
      ]
        .map((value) => String(value).replaceAll("|", "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  return `${lines.join("\n")}\n`;
}

function renderCsv(entries: FeatureAuditEntry[]): string {
  const header = [
    "featureId",
    "label",
    "category",
    "status",
    "views",
    "writePaths",
    "testCoverage",
    "smokeCoverage",
    "writeSafety",
    "multiplayerReady",
    "sandboxOnly",
    "prodReady",
    "knownBlockers",
    "proofFiles",
    "lastChecked",
  ];
  const rows = entries.map((entry) =>
    [
      entry.featureId,
      entry.label,
      entry.category,
      entry.status,
      joinList(entry.views),
      joinList(entry.writePaths),
      joinList(entry.testCoverage),
      joinList(entry.smokeCoverage),
      entry.writeSafety,
      entry.multiplayerReady,
      entry.sandboxOnly,
      entry.prodReady,
      joinList(entry.knownBlockers),
      joinList(entry.proofFiles),
      entry.lastChecked,
    ].map(escapeCsv).join(","),
  );
  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

function main() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const matrix = buildFeatureAuditMatrix({
    generatedAt: new Date().toISOString(),
    availableProofFiles: listOutputFiles(),
  });

  const jsonPath = path.join(OUTPUT_DIR, "feature-audit-matrix.json");
  const markdownPath = path.join(OUTPUT_DIR, "feature-audit-matrix.md");
  const csvPath = path.join(OUTPUT_DIR, "feature-audit-matrix.csv");

  fs.writeFileSync(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, renderMarkdown(matrix.entries, matrix), "utf8");
  fs.writeFileSync(csvPath, renderCsv(matrix.entries), "utf8");

  console.log(
    JSON.stringify(
      {
        outputs: { jsonPath, markdownPath, csvPath },
        features: matrix.summary.total,
        prodReady: matrix.summary.prodReady,
        sandboxReadyOrBetter: matrix.summary.sandboxReadyOrBetter,
        previewOnly: matrix.summary.previewOnly,
        missingTests: matrix.summary.missingTests,
        missingSmoke: matrix.summary.missingSmoke,
        multiplayerMissing: matrix.summary.multiplayerMissing,
      },
      null,
      2,
    ),
  );
}

main();
