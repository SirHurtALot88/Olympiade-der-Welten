import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  exportPlayerFlavorBatch,
  type PlayerFlavorExportBatch,
} from "../lib/player-import/player-flavor-batch-service";

function parseArgs(argv: string[]) {
  const outFlagIndex = argv.findIndex((arg) => arg === "--out");
  const outPath = outFlagIndex >= 0 ? argv[outFlagIndex + 1] : "";
  const limitFlagIndex = argv.findIndex((arg) => arg === "--limit");
  const limitRaw = limitFlagIndex >= 0 ? argv[limitFlagIndex + 1] : "";
  const offsetFlagIndex = argv.findIndex((arg) => arg === "--offset");
  const offsetRaw = offsetFlagIndex >= 0 ? argv[offsetFlagIndex + 1] : "";
  const idsFlagIndex = argv.findIndex((arg) => arg === "--ids");
  const idsRaw = idsFlagIndex >= 0 ? argv[idsFlagIndex + 1] : "";
  const namesFlagIndex = argv.findIndex((arg) => arg === "--names");
  const namesRaw = namesFlagIndex >= 0 ? argv[namesFlagIndex + 1] : "";
  const formatFlagIndex = argv.findIndex((arg) => arg === "--format");
  const format = formatFlagIndex >= 0 ? argv[formatFlagIndex + 1] : "json";

  if (!outPath) {
    throw new Error("Provide --out path/to/player-flavor-export.json");
  }
  if (format !== "json" && format !== "jsonl") {
    throw new Error("--format must be json or jsonl");
  }

  return {
    outPath: path.resolve(process.cwd(), outPath),
    missingOnly: argv.includes("--missing-only"),
    limit: limitRaw ? Number(limitRaw) : null,
    offset: offsetRaw ? Number(offsetRaw) : 0,
    ids: idsRaw ? idsRaw.split(",").map((value) => value.trim()).filter(Boolean) : null,
    names: namesRaw ? namesRaw.split(",").map((value) => value.trim()).filter(Boolean) : null,
    format,
  };
}

function writeExportFile(batch: PlayerFlavorExportBatch, outPath: string, format: "json" | "jsonl") {
  mkdirSync(path.dirname(outPath), { recursive: true });
  if (format === "jsonl") {
    const lines = batch.entries.map((entry) => JSON.stringify({ id: entry.id, name: entry.name, flavorDe: entry.flavorDe }));
    writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
    return;
  }
  writeFileSync(outPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const batch = exportPlayerFlavorBatch({
    missingOnly: args.missingOnly,
    limit: args.limit,
    offset: args.offset,
    ids: args.ids,
    names: args.names,
  });

  writeExportFile(batch, args.outPath, args.format as "json" | "jsonl");

  console.log(`exported: ${batch.count} players`);
  console.log(`missingOnly: ${batch.filters.missingOnly}`);
  console.log(`styleGuide: ${batch.styleGuidePath}`);
  console.log(`out: ${args.outPath}`);
  console.log(`withPortrait: ${batch.entries.filter((entry) => entry.hasPortrait).length}`);
  console.log(`withFlavorDe: ${batch.entries.filter((entry) => entry.flavorDe.trim()).length}`);
}

main();
