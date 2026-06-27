import path from "node:path";

import {
  applyPlayerFlavorImport,
  loadPlayerFlavorImportEntriesFromFile,
  persistPlayerFlavorImport,
} from "../lib/player-import/player-flavor-batch-service";

function parseArgs(argv: string[]) {
  const write = argv.includes("--write");
  const allowEmpty = argv.includes("--allow-empty");
  const overwriteExisting = argv.includes("--overwrite-existing");
  const fileFlagIndex = argv.findIndex((arg) => arg === "--file");
  const filePath = fileFlagIndex >= 0 ? argv[fileFlagIndex + 1] : "";
  if (!filePath) {
    throw new Error("Provide --file path/to/player-flavor-import.json");
  }
  return {
    write,
    allowEmpty,
    overwriteExisting,
    filePath: path.resolve(process.cwd(), filePath),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = loadPlayerFlavorImportEntriesFromFile(args.filePath);
  const result = applyPlayerFlavorImport(entries, {
    allowEmpty: args.allowEmpty,
    skipExistingFlavor: !args.overwriteExisting,
  });

  console.log(`mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`skipExistingFlavor: ${!args.overwriteExisting}`);
  console.log(`entries: ${entries.length}`);
  console.log(`updated: ${result.updated}`);
  console.log(`unchanged: ${result.unchanged}`);
  console.log(`skipped: ${result.skipped}`);
  console.log(`skippedExisting: ${result.skippedExisting}`);
  console.log(`notFound: ${result.notFound}`);

  if (result.updatedPlayerIds.length > 0) {
    console.log(`updatedIds: ${result.updatedPlayerIds.slice(0, 10).join(", ")}${result.updatedPlayerIds.length > 10 ? " ..." : ""}`);
  }

  if (result.issues.length > 0) {
    console.log("issues:");
    for (const issue of result.issues.slice(0, 20)) {
      console.log(`  [${issue.index}] ${issue.code}: ${issue.message}`);
    }
    if (result.issues.length > 20) {
      console.log(`  ... ${result.issues.length - 20} more`);
    }
  }

  if (!args.write) {
    if (result.updated > 0) {
      console.log("dry-run only — re-run with --write to persist.");
    }
    return;
  }

  if (result.updated === 0) {
    console.log("nothing to write.");
    return;
  }

  const persistResult = persistPlayerFlavorImport(result);
  console.log(`stats: ${persistResult.statsPath}`);
  console.log(`sqlite catalog updated for ${persistResult.updatedPlayerIds.length} players`);
}

main();
