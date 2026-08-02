/**
 * UI-Audit-Vorab-Scan (mechanischer Teil des View-Audits).
 *
 * Sammelt pro Datei/View die maschinell auffindbaren Signale ein, die der
 * manuelle Audit-Durchlauf (docs/ui-audit-checklist.md) als Startpunkte
 * benutzt. Der Scan bewertet NICHT — er zaehlt. Ob ein Treffer ein echtes
 * Problem ist, entscheidet der Audit-Durchlauf am Code.
 *
 * Signale (alle rein statisch aus dem Quelltext gezogen):
 *   - LOC + Hook-Zaehler (useState/useEffect/useMemo/useCallback) pro Datei
 *   - View -> Datei-Zuordnung mit Gesamt-LOC und dickster Datei
 *   - grosse Listen-Renderer ohne memo/useMemo/Virtualisierung (Heuristik)
 *   - Inline-Objekt-/Array-Literale in JSX-Props (`={{` / `={[`) pro Datei
 *   - scroll-/resize-Listener ohne requestAnimationFrame/throttle/debounce
 *   - "use client" ohne erkennbaren Client-Bedarf (Heuristik)
 *   - Top-Level-Funktionsnamen, die in mehreren Dateien definiert sind
 *     (Kandidaten fuer kopierte Formatter/Helper)
 *   - roher "wird geladen"-Text (Ladezustand ohne Skeleton-Komponente)
 *
 * Bewusst NICHT hier drin (existiert schon als eigenes Tooling):
 *   - EUR/Intl/Hex-Verstoesse   -> npm run ci:design-tokens
 *   - verbotene Client-Imports  -> npm run ci:client-bundle-lint
 *   - Laufzeit-Messungen        -> npm run perf:foundation-tabs
 *
 * Ausgabe: JSON nach outputs/ui-audit-scan/ui-audit-scan.json (bzw.
 * $OLY_OUTPUT_DIR) + kurze Konsolen-Zusammenfassung. Exit-Code ist immer 0 —
 * das ist ein Report, kein Gate.
 *
 * Aufruf: npx tsx scripts/ui-audit-scan.ts   (npm run audit:ui)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["app/foundation", "components/foundation", "lib/foundation"];
const OUTPUT_DIR = process.env.OLY_OUTPUT_DIR ?? path.join(ROOT, "outputs");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "ui-audit-scan", "ui-audit-scan.json");

const SCAN_EXTENSIONS = /\.(tsx|ts)$/;
const EXCLUDED_NAME_PATTERNS = [/\.test\./, /\.spec\./];
const EXCLUDED_DIR_NAMES = new Set([".next", "node_modules"]);

// View-Id (lib/foundation/foundation-view-routing.ts) -> Verzeichnisse unter
// app/foundation. Views ohne eigenes Verzeichnis rendern inline im Router-Body
// und landen im Pseudo-View "(inline im Router-Body)".
const VIEW_DIR_MAP: Record<string, string[]> = {
  homeV2: ["app/foundation/home-v2"],
  inboxV2: ["app/foundation/inbox-v2"],
  "lineup/lineupV2": ["app/foundation/legacy-lineup-lab", "app/foundation/legacy-lineup-lab-v2"],
  "matchdayArena/diszis": ["app/foundation/discipline-stage"],
  matchdayResult: ["app/foundation/matchday-result-v2"],
  marketV2: ["app/foundation/transfermarkt-v2"],
  "market (Legacy-Lab)": ["app/foundation/transfermarkt-lab"],
  trainingCompact: ["app/foundation/training-compact"],
  trainingV2: ["app/foundation/training-facilities-v2", "app/foundation/facilities-v2"],
  facilitiesOverviewV2: ["app/foundation/facilities-overview-v2"],
  seasonV2: ["app/foundation/season-v2"],
  seasonPreview: ["app/foundation/season-preview-v2"],
  historyV2: ["app/foundation/transfer-history-v2"],
  scoutingCenterV2: ["app/foundation/scouting-center-v2"],
  prize: ["app/foundation/prize-v2"],
  finances: ["app/foundation/finances"],
  teams: ["app/foundation/teams-v2"],
  teamProfile: ["app/foundation/team-profile"],
  playerProfile: ["app/foundation/player-profile"],
  players: ["app/foundation/players-table"],
  ranks: ["app/foundation/ranks-v2"],
  leagueLeaders: ["app/foundation/league-leaders-v2"],
  allTimeTable: ["app/foundation/all-time-table-v2"],
  cockpit: ["app/foundation/cockpit-v2"],
  teamSettings: ["app/foundation/team-settings"],
  changelog: ["app/foundation/changelog"],
  credits: ["app/foundation/credits"],
  "sponsors (unter Finanzen/HQ)": ["app/foundation/sponsors-v2"],
  "debug (Resolve-Lab)": ["app/foundation/legacy-resolve-lab"],
  "shell/gemeinsam": ["app/foundation/shell", "app/foundation/contract-offer", "app/foundation/debug"],
};

interface FileStats {
  file: string;
  loc: number;
  useClient: boolean;
  hooks: { useState: number; useEffect: number; useMemo: number; useCallback: number };
  mapCalls: number;
  inlineObjectProps: number;
  inlineArrayProps: number;
  hasMemo: boolean;
  usesVirtualizer: boolean;
  scrollResizeListeners: number;
  hasRafOrThrottle: boolean;
  rawLoadingTextLines: number[];
  topLevelFunctionNames: string[];
}

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) {
        continue;
      }
      files.push(...collectSourceFiles(path.join(dir, entry.name)));
      continue;
    }
    if (SCAN_EXTENSIONS.test(entry.name) && !EXCLUDED_NAME_PATTERNS.some((p) => p.test(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function countMatches(source: string, pattern: RegExp): number {
  return (source.match(new RegExp(pattern.source, "g")) ?? []).length;
}

// Top-Level-Definitionen (Zeilenanfang, keine Einrueckung): `function name(`
// oder `const name = (...)/async/function/x =>`. Imports/Re-Exports matchen
// nicht, verschachtelte Helper ebenfalls nicht — gewollt, wir suchen kopierte
// Modul-Helper, keine lokalen Closures.
const TOP_LEVEL_FN = /^(?:export\s+)?(?:default\s+)?function\s+([A-Za-z_$][\w$]*)/;
const TOP_LEVEL_CONST_FN =
  /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(?:async\s+)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/;

function analyzeFile(relativePath: string, source: string): FileStats {
  const lines = source.split("\n");
  const functionNames: string[] = [];
  const rawLoadingTextLines: number[] = [];

  lines.forEach((lineText, index) => {
    const fnMatch = lineText.match(TOP_LEVEL_FN) ?? lineText.match(TOP_LEVEL_CONST_FN);
    if (fnMatch) {
      functionNames.push(fnMatch[1]);
    }
    // Roher Ladetext statt Skeleton (NlSkeleton/FoundationPanelSkeleton).
    if (/wird geladen/i.test(lineText)) {
      rawLoadingTextLines.push(index + 1);
    }
  });

  return {
    file: relativePath,
    loc: lines.length,
    useClient: /^\s*["']use client["']/m.test(source),
    hooks: {
      useState: countMatches(source, /\buseState(?:<[^>]*>)?\(/),
      useEffect: countMatches(source, /\buseEffect\(/),
      useMemo: countMatches(source, /\buseMemo\(/),
      useCallback: countMatches(source, /\buseCallback\(/),
    },
    mapCalls: countMatches(source, /\.map\(/),
    inlineObjectProps: countMatches(source, /=\{\{/),
    inlineArrayProps: countMatches(source, /=\{\[/),
    hasMemo: /\bmemo\(|React\.memo\(/.test(source),
    usesVirtualizer: /useVirtualizer\(/.test(source),
    scrollResizeListeners: countMatches(source, /addEventListener\(\s*["'](?:scroll|resize)["']/),
    hasRafOrThrottle: /requestAnimationFrame|throttle|debounce/i.test(source),
    rawLoadingTextLines,
    topLevelFunctionNames: functionNames,
  };
}

// Heuristik "use client ohne Client-Bedarf": Direktive gesetzt, aber keine
// Hooks, keine Event-Handler-Props und keine Browser-APIs im Quelltext.
function looksLikeNeedlessUseClient(stats: FileStats, source: string): boolean {
  if (!stats.useClient) {
    return false;
  }
  const hookTotal =
    stats.hooks.useState + stats.hooks.useEffect + stats.hooks.useMemo + stats.hooks.useCallback;
  if (hookTotal > 0) {
    return false;
  }
  if (/\buse[A-Z]\w*\(/.test(source)) {
    // Custom Hooks (useFoundation..., useCountUp, ...) zaehlen als Client-Bedarf.
    return false;
  }
  if (/\bon[A-Z]\w*=\{/.test(source)) {
    return false;
  }
  if (/\b(window|document|localStorage|sessionStorage|navigator|addEventListener)\b/.test(source)) {
    return false;
  }
  if (/\bdynamic\(/.test(source)) {
    // next/dynamic mit ssr:false braucht die Direktive.
    return false;
  }
  return true;
}

function main() {
  const allStats: FileStats[] = [];
  const sourcesByFile = new Map<string, string>();

  for (const root of SCAN_ROOTS) {
    for (const filePath of collectSourceFiles(path.join(ROOT, root))) {
      const relativePath = path.relative(ROOT, filePath).split(path.sep).join("/");
      const source = fs.readFileSync(filePath, "utf8");
      sourcesByFile.set(relativePath, source);
      allStats.push(analyzeFile(relativePath, source));
    }
  }

  // --- View-Zuordnung -------------------------------------------------------
  const claimedDirs = new Set(Object.values(VIEW_DIR_MAP).flat());
  const viewSummaries = Object.entries(VIEW_DIR_MAP).map(([view, dirs]) => {
    const files = allStats.filter((s) => dirs.some((d) => s.file.startsWith(`${d}/`)));
    const totalLoc = files.reduce((sum, f) => sum + f.loc, 0);
    const biggest = [...files].sort((a, b) => b.loc - a.loc)[0];
    return {
      view,
      dirs,
      fileCount: files.length,
      totalLoc,
      biggestFile: biggest ? { file: biggest.file, loc: biggest.loc } : null,
    };
  });
  // Router-Body & Co: Views ohne eigenes Verzeichnis (encyclopedia, ranks-Teile,
  // Legacy-V1-Views, generator, admin ...) leben inline in diesen Dateien.
  const rootLevelFiles = allStats.filter(
    (s) => s.file.startsWith("app/foundation/") && !s.file.slice("app/foundation/".length).includes("/"),
  );
  viewSummaries.push({
    view: "(inline im Router-Body: encyclopedia, ranks, generator, Legacy-V1-Views, admin, ...)",
    dirs: ["app/foundation/*.tsx (Top-Level)"],
    fileCount: rootLevelFiles.length,
    totalLoc: rootLevelFiles.reduce((sum, f) => sum + f.loc, 0),
    biggestFile: (() => {
      const b = [...rootLevelFiles].sort((a, x) => x.loc - a.loc)[0];
      return b ? { file: b.file, loc: b.loc } : null;
    })(),
  });
  const unclaimedDirs = new Set<string>();
  for (const s of allStats) {
    if (!s.file.startsWith("app/foundation/")) continue;
    const rest = s.file.slice("app/foundation/".length);
    const slash = rest.indexOf("/");
    if (slash < 0) continue;
    const dir = `app/foundation/${rest.slice(0, slash)}`;
    if (!claimedDirs.has(dir)) {
      unclaimedDirs.add(dir);
    }
  }

  // --- Signal-Listen --------------------------------------------------------
  const hookTotal = (s: FileStats) =>
    s.hooks.useState + s.hooks.useEffect + s.hooks.useMemo + s.hooks.useCallback;

  const biggestFiles = [...allStats].sort((a, b) => b.loc - a.loc).slice(0, 20);

  const hookHeavyFiles = allStats
    .filter((s) => s.hooks.useState + s.hooks.useEffect >= 15)
    .sort((a, b) => hookTotal(b) - hookTotal(a))
    .map((s) => ({ file: s.file, loc: s.loc, ...s.hooks }));

  // Listen-Renderer-Heuristik: viele .map(-Aufrufe, grosse Datei, keinerlei
  // memo/useMemo und keine Virtualisierung -> Kandidat fuer Re-Render-Kosten.
  const unmemoizedListRenderers = allStats
    .filter((s) => s.file.endsWith(".tsx") && s.loc >= 300 && s.mapCalls >= 8 && !s.hasMemo && s.hooks.useMemo === 0 && !s.usesVirtualizer)
    .sort((a, b) => b.mapCalls - a.mapCalls)
    .map((s) => ({ file: s.file, loc: s.loc, mapCalls: s.mapCalls }));

  const inlinePropHotspots = allStats
    .filter((s) => s.inlineObjectProps + s.inlineArrayProps >= 15)
    .sort((a, b) => b.inlineObjectProps + b.inlineArrayProps - (a.inlineObjectProps + a.inlineArrayProps))
    .map((s) => ({
      file: s.file,
      loc: s.loc,
      inlineObjectProps: s.inlineObjectProps,
      inlineArrayProps: s.inlineArrayProps,
      mapCalls: s.mapCalls,
    }));

  const unthrottledScrollResize = allStats
    .filter((s) => s.scrollResizeListeners > 0 && !s.hasRafOrThrottle)
    .map((s) => ({ file: s.file, listeners: s.scrollResizeListeners }));

  const needlessUseClient = allStats
    .filter((s) => looksLikeNeedlessUseClient(s, sourcesByFile.get(s.file) ?? ""))
    .map((s) => ({ file: s.file, loc: s.loc }));

  const rawLoadingText = allStats
    .filter((s) => s.rawLoadingTextLines.length > 0)
    .map((s) => ({ file: s.file, lines: s.rawLoadingTextLines }));

  // Doppelt definierte Top-Level-Funktionsnamen ueber Dateigrenzen hinweg.
  // Generische Namen (main, ...) und Einbuchstabler werden gefiltert.
  const nameToFiles = new Map<string, Set<string>>();
  for (const s of allStats) {
    for (const name of s.topLevelFunctionNames) {
      if (name.length < 4 || name === "main") continue;
      if (!nameToFiles.has(name)) {
        nameToFiles.set(name, new Set());
      }
      nameToFiles.get(name)!.add(s.file);
    }
  }
  const duplicateFunctionNames = [...nameToFiles.entries()]
    .filter(([, files]) => files.size >= 2)
    .map(([name, files]) => ({ name, files: [...files].sort() }))
    .sort((a, b) => b.files.length - a.files.length);

  const useClientFileCount = allStats.filter((s) => s.useClient).length;

  const result = {
    generatedAt: new Date().toISOString(),
    scanRoots: SCAN_ROOTS,
    totals: {
      files: allStats.length,
      loc: allStats.reduce((sum, s) => sum + s.loc, 0),
      useClientFiles: useClientFileCount,
    },
    views: viewSummaries.sort((a, b) => b.totalLoc - a.totalLoc),
    unclaimedViewDirs: [...unclaimedDirs].sort(),
    signals: {
      biggestFiles: biggestFiles.map((s) => ({ file: s.file, loc: s.loc })),
      hookHeavyFiles,
      unmemoizedListRenderers,
      inlinePropHotspots,
      unthrottledScrollResize,
      needlessUseClient,
      rawLoadingText,
      duplicateFunctionNames,
    },
    perFile: allStats
      .map(({ topLevelFunctionNames: _drop, rawLoadingTextLines, ...rest }) => ({
        ...rest,
        rawLoadingTextCount: rawLoadingTextLines.length,
      }))
      .sort((a, b) => b.loc - a.loc),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  // --- Zusammenfassung ------------------------------------------------------
  console.log("UI-Audit-Vorab-Scan");
  console.log(`  Dateien: ${result.totals.files} (${result.totals.loc} LOC), davon "use client": ${useClientFileCount}`);
  console.log("");
  console.log("  Groesste Views (LOC gesamt):");
  for (const v of result.views.slice(0, 8)) {
    console.log(`    ${String(v.totalLoc).padStart(6)}  ${v.view}  (dickste Datei: ${v.biggestFile?.file ?? "-"} @ ${v.biggestFile?.loc ?? 0})`);
  }
  console.log("");
  console.log(`  Hook-schwere Dateien (useState+useEffect >= 15): ${hookHeavyFiles.length}`);
  for (const f of hookHeavyFiles.slice(0, 5)) {
    console.log(`    ${f.file}  (state=${f.useState} effect=${f.useEffect} memo=${f.useMemo} cb=${f.useCallback})`);
  }
  console.log(`  Grosse Listen-Renderer ohne memo/useMemo/Virtualizer: ${unmemoizedListRenderers.length}`);
  for (const f of unmemoizedListRenderers.slice(0, 5)) {
    console.log(`    ${f.file}  (${f.mapCalls}x .map, ${f.loc} LOC)`);
  }
  console.log(`  Inline-Prop-Hotspots (>= 15x ={{ oder ={[ ): ${inlinePropHotspots.length}`);
  console.log(`  scroll/resize-Listener ohne rAF/Throttle: ${unthrottledScrollResize.length}`);
  for (const f of unthrottledScrollResize) {
    console.log(`    ${f.file}  (${f.listeners} Listener)`);
  }
  console.log(`  "use client" ohne erkennbaren Client-Bedarf (Heuristik): ${needlessUseClient.length}`);
  for (const f of needlessUseClient.slice(0, 8)) {
    console.log(`    ${f.file}`);
  }
  console.log(`  Roher "wird geladen"-Text statt Skeleton: ${rawLoadingText.length} Dateien`);
  console.log(`  Top-Level-Helfer mit gleichem Namen in >= 2 Dateien: ${duplicateFunctionNames.length}`);
  for (const d of duplicateFunctionNames.slice(0, 10)) {
    console.log(`    ${d.name}  (${d.files.length}x: ${d.files.join(", ")})`);
  }
  if (unclaimedDirs.size > 0) {
    console.log(`  Nicht zugeordnete View-Verzeichnisse: ${[...unclaimedDirs].join(", ")}`);
  }
  console.log("");
  console.log(`  JSON: ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log("  Checkliste fuer den manuellen Teil: docs/ui-audit-checklist.md");
}

main();
