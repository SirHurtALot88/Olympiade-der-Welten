import fs from "node:fs/promises";
import path from "node:path";

import { diffGoldenMaster, type JsonValue } from "@/lib/golden-master/fixture-diff";

type CliArgs = {
  fixturePath?: string;
  actualPath?: string;
  ignoredPaths: string[];
  toleratedFloatDelta?: number;
  help: boolean;
};

export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    ignoredPaths: [],
    help: argv.includes("--help") || argv.includes("-h"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--fixture") {
      result.fixturePath = argv[index + 1];
      index += 1;
    } else if (token === "--actual") {
      result.actualPath = argv[index + 1];
      index += 1;
    } else if (token === "--ignore") {
      const value = argv[index + 1];
      if (value) {
        result.ignoredPaths.push(value);
      }
      index += 1;
    } else if (token === "--delta") {
      const value = Number(argv[index + 1]);
      result.toleratedFloatDelta = Number.isFinite(value) ? value : undefined;
      index += 1;
    }
  }

  return result;
}

async function readJsonFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as JsonValue;
}

export function printHelp() {
  console.log("golden:compare");
  console.log("Compares a golden-master fixture against an app-output JSON snapshot.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run golden:compare -- --fixture <expected.json> --actual <actual.json>");
  console.log("");
  console.log("Options:");
  console.log("  --fixture <path>   Expected Retool/app golden-master fixture JSON");
  console.log("  --actual <path>    Actual app output JSON to compare");
  console.log("  --ignore <path>    Ignore a volatile path, repeatable");
  console.log("  --delta <number>   Allowed numeric float delta");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.fixturePath || !args.actualPath) {
    throw new Error("Missing required arguments. Use --fixture <expected.json> and --actual <actual.json>.");
  }

  const fixturePath = path.resolve(process.cwd(), args.fixturePath);
  const actualPath = path.resolve(process.cwd(), args.actualPath);
  const [expected, actual] = await Promise.all([readJsonFile(fixturePath), readJsonFile(actualPath)]);
  const fixtureDelta =
    typeof expected === "object" && expected !== null && !Array.isArray(expected) && typeof expected.toleratedFloatDelta === "number"
      ? expected.toleratedFloatDelta
      : undefined;
  const result = diffGoldenMaster(expected, actual, {
    ignoredPaths: args.ignoredPaths,
    toleratedFloatDelta: args.toleratedFloatDelta ?? fixtureDelta ?? 0,
  });

  console.log(`fixture: ${fixturePath}`);
  console.log(`actual: ${actualPath}`);
  console.log(`ignoredPaths: ${args.ignoredPaths.length > 0 ? args.ignoredPaths.join(", ") : "none"}`);
  console.log(`toleratedFloatDelta: ${args.toleratedFloatDelta ?? fixtureDelta ?? 0}`);

  if (result.exactMatch) {
    console.log("result: exact match");
    return;
  }

  console.log("result: mismatch");
  for (const diff of result.diffs) {
    if (diff.kind === "numeric_delta") {
      console.log(`- ${diff.kind} @ ${diff.path} | expected=${diff.expected} | actual=${diff.actual} | delta=${diff.delta}`);
      continue;
    }
    console.log(`- ${diff.kind} @ ${diff.path} | expected=${JSON.stringify(diff.expected)} | actual=${JSON.stringify(diff.actual)}`);
  }
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
