import fs from "node:fs";
import path from "node:path";

const sourcePath = "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (7).json";
const outputDir = "/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master";

const targetTerms = [
  "aiTeamNeeds",
  "AI2_06_SimulatePicks",
  "AI2_RunNeeds",
  "aiPickSeasonPlan",
  "seasonPlannerEngine",
  "seasonPlannerEngineV7",
  "disciplineRecipesGlobal",
  "disciplineNeeds",
  "disciplineHoleWeight",
  "disciplineNeedDiagnostics",
  "teamIdentityOverrides",
  "teamIdentityWeights",
  "rosterNeeds",
  "rosterPressureProfile",
  "aiPackageScoringConfig",
  "cashCreatorPackageScoringConfig",
  "playerExhaustionMap",
  "fatigueMult",
  "captain_boost_x10",
  "formkarten_v2",
] as const;

type ExtractedHit = {
  term: string;
  id: string | null;
  type: string | null;
  subtype: string | null;
  page: string | null;
  folder: string | null;
  updatedAt: string | null;
  codeField: string | null;
  code: string | null;
  dependencies: string[];
  complete: boolean;
  sourceIndex: number;
  fileName: string;
};

function decodeQuotedString(serialized: string, startQuoteIndex: number) {
  let index = startQuoteIndex + 1;
  let result = "";

  while (index < serialized.length) {
    const char = serialized[index];
    if (char === "\\") {
      const next = serialized[index + 1];
      if (next === "n") result += "\n";
      else if (next === "r") result += "\r";
      else if (next === "t") result += "\t";
      else if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else result += next ?? "";
      index += 2;
      continue;
    }
    if (char === '"') {
      return {
        value: result,
        endIndex: index,
      };
    }
    result += char;
    index += 1;
  }

  return {
    value: result,
    endIndex: serialized.length - 1,
  };
}

function findNearestValueBefore(serialized: string, index: number, label: string, lookback = 16000) {
  const pattern = `"${label}","`;
  const start = Math.max(0, index - lookback);
  const foundAt = serialized.lastIndexOf(pattern, index);
  if (foundAt < start) {
    return null;
  }

  const quoteStart = foundAt + pattern.length - 1;
  return decodeQuotedString(serialized, quoteStart);
}

function findNearestValueAfter(serialized: string, index: number, label: string, lookahead = 20000) {
  const pattern = `"${label}","`;
  const foundAt = serialized.indexOf(pattern, index);
  if (foundAt === -1 || foundAt > index + lookahead) {
    return null;
  }

  const quoteStart = foundAt + pattern.length - 1;
  return decodeQuotedString(serialized, quoteStart);
}

function findFirstValueAfterWithinBlock(serialized: string, startIndex: number, labels: string[], lookahead = 12000) {
  for (const label of labels) {
    const value = findNearestValueAfter(serialized, startIndex, label, lookahead);
    if (value) {
      return {
        label,
        value,
      };
    }
  }
  return null;
}

function findNearestSimpleField(serialized: string, index: number, labels: string[]) {
  for (const label of labels) {
    const before = findNearestValueBefore(serialized, index, label);
    if (before?.value) {
      return before.value;
    }
  }
  return null;
}

function extractDependencies(code: string | null) {
  if (!code) {
    return [];
  }
  const dependencies = new Set<string>();
  const regex = /\{\{([\s\S]*?)\}\}/g;
  for (const match of code.matchAll(regex)) {
    const dependency = match[1]?.trim();
    if (dependency) {
      dependencies.add(dependency);
    }
  }
  return Array.from(dependencies);
}

function sanitizeFileBaseName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferExtension(hit: Pick<ExtractedHit, "type" | "codeField">) {
  if (hit.type === "state") {
    return ".state.js";
  }
  if (hit.codeField === "query" || hit.codeField === "src") {
    return ".js";
  }
  if (hit.codeField === "value") {
    return ".state.js";
  }
  return ".txt";
}

function buildHitForIndex(serialized: string, term: string, sourceIndex: number): ExtractedHit {
  const exactIdIndex = serialized.lastIndexOf(`"id","${term}"`, sourceIndex);
  const exactKeyIndex = serialized.lastIndexOf(`],"${term}",["`, sourceIndex);
  const preferredAnchor = Math.max(exactIdIndex, exactKeyIndex);
  const exactBlockStart = preferredAnchor >= 0 && preferredAnchor >= sourceIndex - 20000 ? preferredAnchor : sourceIndex;

  const id =
    findNearestSimpleField(serialized, exactBlockStart, ["id"]) ??
    findNearestSimpleField(serialized, sourceIndex, ["id"]) ??
    findNearestSimpleField(serialized, sourceIndex, ["name"]);

  const type =
    findNearestSimpleField(serialized, exactBlockStart, ["type", "^1F"]) ??
    findNearestSimpleField(serialized, sourceIndex, ["type", "^1F"]);

  const subtype =
    findNearestSimpleField(serialized, exactBlockStart, ["subtype", "^1G"]) ??
    findNearestSimpleField(serialized, sourceIndex, ["subtype", "^1G"]);

  const page =
    findNearestSimpleField(serialized, exactBlockStart, ["pageName", "^1V"]) ??
    findNearestSimpleField(serialized, sourceIndex, ["pageName", "^1V"]);

  const folder =
    findNearestSimpleField(serialized, sourceIndex, ["folderName", "folder"]);

  const updatedAt =
    findNearestSimpleField(serialized, exactBlockStart, ["updatedAt"]) ??
    findNearestSimpleField(serialized, sourceIndex, ["updatedAt"]);

  const preferredBlockCode = preferredAnchor >= 0
    ? findFirstValueAfterWithinBlock(serialized, exactBlockStart, ["value", "funcBody", "query", "src"], 16000)
    : null;
  const discoveredCode = preferredBlockCode
    ? preferredBlockCode
    : ["funcBody", "query", "src", "value"]
        .map((label) => ({ label, value: findNearestValueAfter(serialized, sourceIndex - 200, label, 14000) }))
        .find((candidate) => candidate.value?.value?.includes(term)) ?? null;

  const codeField = discoveredCode?.label ?? null;
  const code = discoveredCode?.value?.value ?? null;

  const dependencies = extractDependencies(code);
  const complete = Boolean(code);

  const fileBase = sanitizeFileBaseName(id || term);
  const fileName = `${fileBase}${inferExtension({ type, codeField })}`;

  return {
    term,
    id: id ?? null,
    type: type ?? null,
    subtype: subtype ?? null,
    page: page ?? null,
    folder: folder ?? null,
    updatedAt: updatedAt ?? null,
    codeField,
    code,
    dependencies,
    complete,
    sourceIndex,
    fileName,
  };
}

function dedupeHits(hits: ExtractedHit[]) {
  const bestByKey = new Map<string, ExtractedHit>();

  for (const hit of hits) {
    const key = `${hit.term}::${hit.id ?? "unknown"}::${hit.codeField ?? "none"}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, hit);
      continue;
    }
    const existingScore = Number(existing.complete) * 10 + (existing.code?.length ?? 0);
    const nextScore = Number(hit.complete) * 10 + (hit.code?.length ?? 0);
    if (nextScore > existingScore) {
      bestByKey.set(key, hit);
    }
  }

  const bestByFileName = new Map<string, ExtractedHit>();
  for (const hit of bestByKey.values()) {
    const existing = bestByFileName.get(hit.fileName);
    if (!existing) {
      bestByFileName.set(hit.fileName, hit);
      continue;
    }
    const existingScore = Number(existing.complete) * 100000 + (existing.code?.length ?? 0);
    const nextScore = Number(hit.complete) * 100000 + (hit.code?.length ?? 0);
    if (nextScore > existingScore) {
      bestByFileName.set(hit.fileName, hit);
    }
  }

  return Array.from(bestByFileName.values()).sort((left, right) => left.term.localeCompare(right.term) || left.sourceIndex - right.sourceIndex);
}

function writeHitFile(hit: ExtractedHit) {
  const absolutePath = path.join(outputDir, hit.fileName);
  const header = [
    `// term: ${hit.term}`,
    `// id: ${hit.id ?? "unknown"}`,
    `// type: ${hit.type ?? "unknown"}`,
    `// subtype: ${hit.subtype ?? "unknown"}`,
    `// page: ${hit.page ?? "unknown"}`,
    `// folder: ${hit.folder ?? "unknown"}`,
    `// updatedAt: ${hit.updatedAt ?? "unknown"}`,
    `// codeField: ${hit.codeField ?? "unknown"}`,
    `// dependencies: ${hit.dependencies.length > 0 ? hit.dependencies.join(" | ") : "none"}`,
    `// extractionStatus: ${hit.complete ? "complete_or_primary_match" : "partial_match_only"}`,
    "",
  ].join("\n");

  const body = hit.code ?? `// Partial match only.\n// No direct code/value block could be extracted for ${hit.term}.\n`;
  fs.writeFileSync(absolutePath, `${header}${body}\n`, "utf8");
}

function writeReadme(hits: ExtractedHit[], missingTerms: string[]) {
  const lines: string[] = [];
  lines.push("# Retool AI Golden Master Extraction");
  lines.push("");
  lines.push(`Quelle: \`${sourcePath}\``);
  lines.push("");
  lines.push("Diese Dateien wurden automatisch aus der Retool-JSON extrahiert.");
  lines.push("");
  lines.push("## Treffer");
  lines.push("");

  for (const hit of hits) {
    lines.push(`### ${hit.term}`);
    lines.push(`- Datei: [${hit.fileName}](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/${hit.fileName})`);
    lines.push(`- Typ: ${hit.type ?? "unknown"}`);
    lines.push(`- Subtype: ${hit.subtype ?? "unknown"}`);
    lines.push(`- Page: ${hit.page ?? "unknown"}`);
    lines.push(`- Folder: ${hit.folder ?? "unknown"}`);
    lines.push(`- Source field: ${hit.codeField ?? "unknown"}`);
    lines.push(`- Dependencies: ${hit.dependencies.length > 0 ? hit.dependencies.join(" | ") : "none"}`);
    lines.push(`- Status: ${hit.complete ? "vollstaendig oder primaerer Codeblock extrahiert" : "Teiltreffer / Codeblock unklar"}`);
    lines.push("");
  }

  lines.push("## Nicht gefunden");
  lines.push("");
  if (missingTerms.length === 0) {
    lines.push("- keine");
  } else {
    for (const term of missingTerms) {
      lines.push(`- ${term}`);
    }
  }

  fs.writeFileSync(path.join(outputDir, "README.md"), `${lines.join("\n")}\n`, "utf8");
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const root = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as { page?: { data?: { appState?: string } } };
  const serialized = root.page?.data?.appState;

  if (typeof serialized !== "string") {
    throw new Error("Retool JSON does not contain page.data.appState as a string.");
  }

  const rawHits: ExtractedHit[] = [];

  for (const term of targetTerms) {
    let searchIndex = 0;
    while (true) {
      const foundAt = serialized.indexOf(term, searchIndex);
      if (foundAt === -1) {
        break;
      }
      rawHits.push(buildHitForIndex(serialized, term, foundAt));
      searchIndex = foundAt + term.length;
    }
  }

  const hits = dedupeHits(rawHits);
  const termsFound = new Set(hits.map((hit) => hit.term));
  const missingTerms = targetTerms.filter((term) => !termsFound.has(term));

  for (const hit of hits) {
    writeHitFile(hit);
  }
  writeReadme(hits, missingTerms);

  console.log(`Extracted hits: ${hits.length}`);
  console.log(`Missing terms: ${missingTerms.length}`);
  for (const hit of hits) {
    console.log(`- ${hit.term} -> ${hit.fileName} (${hit.complete ? "code" : "partial"})`);
  }
  if (missingTerms.length > 0) {
    console.log(`Missing: ${missingTerms.join(", ")}`);
  }
}

main();
