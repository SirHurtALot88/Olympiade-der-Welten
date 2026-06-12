export {};

import fs from "node:fs";
import path from "node:path";

import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";

type WriteSafetyEntry = {
  path: string;
  category: string;
  defaultMode: "read-only" | "dry-run" | "write";
  writeGate: "--write" | "confirm-token" | "dryRun=false" | "direct" | "n/a";
  allowedTables: string[];
  forbiddenTables: string[];
  secretsSafe: boolean;
  explicitRemoteWriteRequired: boolean;
};

const entries: WriteSafetyEntry[] = [
  {
    path: "lib/market/transfermarkt-local-service.ts",
    category: "local buy/sell source of truth",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Standings", "Result"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/market/transfermarkt-buy-service.ts",
    category: "legacy prisma buy service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["ActivePlayer", "Transfer", "TeamSeasonState"],
    forbiddenTables: ["Standings", "Result", "SQLite", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: true,
  },
  {
    path: "lib/market/transfermarkt-sell-service.ts",
    category: "legacy prisma sell service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["ActivePlayer", "Transfer", "TeamSeasonState"],
    forbiddenTables: ["Standings", "Result", "SQLite", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: true,
  },
  {
    path: "lib/ai/ai-picks-run-service.ts",
    category: "ai season picks execute",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/ai/auto-roster-fill-service.ts",
    category: "ai auto roster fill",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/ai/ai-market-plan-apply-service.ts",
    category: "ai market plan apply",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory", "local audit logs"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/ai/ai-pick-audit-reset-service.ts",
    category: "ai pick audit reset",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/standings/standings-apply-service.ts",
    category: "standings apply local service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local SeasonState.standings.points", "local SeasonState.standings.rank", "local SeasonState.standingsApplyLogs"],
    forbiddenTables: ["Prisma TeamSeasonState", "Transfer", "ActivePlayer", "Cash", "Preisgeld", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/lineups/legacy-lineup-local-service.ts",
    category: "lineup local service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local SeasonState.lineups", "local SeasonState.aiLineupApplyLogs"],
    forbiddenTables: ["Prisma Lineup", "Transfer", "ActivePlayer", "Cash"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/prize-money-preview.ts",
    category: "prize preview",
    defaultMode: "read-only",
    writeGate: "n/a",
    allowedTables: [],
    forbiddenTables: ["TeamSeasonState", "Transfer", "ActivePlayer", "SQLite", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: true,
  },
  {
    path: "lib/season/cash-prize-apply-service.ts",
    category: "cash prize apply local service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Team.cash", "local SeasonState.cashPrizeApplyLogs"],
    forbiddenTables: ["Prisma TeamSeasonState", "Standings", "Transfer", "ActivePlayer", "Result", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "app/api/season/cash-prize-apply/route.ts",
    category: "cash prize apply api",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Team.cash", "local SeasonState.cashPrizeApplyLogs"],
    forbiddenTables: ["Prisma TeamSeasonState", "Standings", "Transfer", "ActivePlayer", "Result", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/resolve/legacy-matchday-result-apply-service.ts",
    category: "result apply service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: [
      "local SeasonState.matchdayResults",
      "local SeasonState.disciplineResults",
      "local SeasonState.playerDisciplinePerformances",
      "local SeasonState.disciplineHighlights",
      "local SeasonState.resultAuditLogs",
    ],
    forbiddenTables: ["Prisma MatchdayResult", "Prisma DisciplineResult", "TeamSeasonState standings", "Cash", "Preisgeld"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/matchday-progress-service.ts",
    category: "matchday advance local service",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local MatchdayState", "local SeasonState.matchdayAdvanceLogs"],
    forbiddenTables: ["Prisma Matchday", "Transfer", "ActivePlayer", "Cash"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/matchday-auto-run-service.ts",
    category: "matchday auto-run local orchestrator",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local lineups", "local matchday results", "local standings logs"],
    forbiddenTables: ["Prisma MatchdayResult", "Prisma Lineup", "Prisma TeamSeasonState", "Transfer"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "scripts/season1-autoprep.ts",
    category: "season 1 local autoprep test script",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: ["local Player.trainingMode", "local SeasonState.formCards", "local SeasonState.lineupDrafts", "local export files"],
    forbiddenTables: ["Prisma", "remote database", "Team.cash", "Transfer direct insert", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "scripts/season1-autoprep-topup.ts",
    category: "season 1 local autoprep transfer top-up",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory"],
    forbiddenTables: ["Prisma", "remote database", "Result", "Standings", "direct roster insert"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "scripts/season1-autoprep-rebalance.ts",
    category: "season 1 local autoprep transfer rebalance",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory"],
    forbiddenTables: ["Prisma", "remote database", "Result", "Standings", "direct roster insert"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "scripts/season1-simulation-run.ts",
    category: "season 1 local whole-season simulation runner",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: [
      "local SeasonState.matchdayResults",
      "local SeasonState.disciplineResults",
      "local SeasonState.playerDisciplinePerformances",
      "local SeasonState.disciplineHighlights",
      "local SeasonState.standings",
      "local SeasonState.standingsApplyLogs",
      "local SeasonState.matchdayAdvanceLogs",
      "local MatchdayState",
      "local GameState.gamePhase",
      "local export files",
    ],
    forbiddenTables: ["Prisma", "remote database", "Team.cash", "cashPrizeApplyLogs", "Transfer direct insert", "ActivePlayer direct insert"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "scripts/season-transition-s1-s2-run.ts",
    category: "season 1 to season 2 local transition test runner",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: [
      "local Team.cash via cash-prize/facility services",
      "local SeasonState.cashPrizeApplyLogs",
      "local SeasonState.teamFacilities",
      "local SeasonState.facilityEvents",
      "local rosters via transfer services",
      "local transferHistory via transfer services",
      "local Season",
      "local MatchdayState",
      "local SeasonState reset for next season",
      "local GameState.gamePhase",
      "local preSeasonWorkflowLogs",
      "local export files",
    ],
    forbiddenTables: ["Prisma", "remote database", "direct inserts", "attribute writes", "market value writes", "salary writes"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/matchday-mvp-scoring-service.ts",
    category: "matchday mvp local scoring",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local SeasonState.playerDisciplinePerformances", "local matchday results", "local standings logs"],
    forbiddenTables: ["Prisma MatchdayResult", "Prisma PlayerDisciplineScore", "Prisma TeamSeasonState", "Transfer"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/season-snapshot-service.ts",
    category: "season snapshot local service",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local SeasonState.seasonSnapshots"],
    forbiddenTables: ["Prisma", "Transfer", "ActivePlayer", "Cash"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/persistence/season-start-reset-service.ts",
    category: "season start reset local service",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local rosters", "local transferHistory", "local SeasonState"],
    forbiddenTables: ["Prisma", "remote database"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/facilities/facility-upgrade-service.ts",
    category: "facility upgrade local service",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local SeasonState.teamFacilities", "local SeasonState.facilityEvents"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "app/api/facilities/upgrade/route.ts",
    category: "facility upgrade api",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Team.cash", "local SeasonState.teamFacilities", "local SeasonState.facilityEvents"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/progression/season-end-xp-apply-service.ts",
    category: "season-end xp spend local service",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Player.attributes", "local Player.currentXP", "local Player.spentXP", "local Player.discipline snapshot", "local GameState.playerProgressionEvents"],
    forbiddenTables: ["Prisma", "remote database", "local Team.cash", "market value direct write", "salary direct write"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "app/api/progression/season-end-xp-spend/route.ts",
    category: "season-end xp spend api",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Player.attributes", "local Player.currentXP", "local Player.spentXP", "local Player.discipline snapshot", "local GameState.playerProgressionEvents"],
    forbiddenTables: ["Prisma", "remote database", "local Team.cash", "market value direct write", "salary direct write"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/progression/ai-xp-spend-planner.ts",
    category: "ai season-end xp spend planner",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Player.attributes via season-end-xp-apply-service", "local Player.currentXP via season-end-xp-apply-service", "local Player.spentXP via season-end-xp-apply-service", "local GameState.playerProgressionEvents via season-end-xp-apply-service"],
    forbiddenTables: ["Prisma", "remote database", "local Team.cash", "market value direct write", "salary direct write", "second write implementation"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "app/api/progression/ai-xp-spend/route.ts",
    category: "ai season-end xp spend api",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Player.attributes via season-end-xp-apply-service", "local Player.currentXP via season-end-xp-apply-service", "local Player.spentXP via season-end-xp-apply-service", "local GameState.playerProgressionEvents via season-end-xp-apply-service"],
    forbiddenTables: ["Prisma", "remote database", "local Team.cash", "market value direct write", "salary direct write", "second write implementation"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/facilities/facility-season-end-service.ts",
    category: "facility season-end finance local service",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Team.cash", "local SeasonState.teamFacilities", "local SeasonState.facilityEvents"],
    forbiddenTables: ["Prisma ActivePlayer", "Prisma Transfer", "Prisma TeamSeasonState", "Result", "Standings"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/preseason-workflow-service.ts",
    category: "pre-season workflow local orchestrator",
    defaultMode: "dry-run",
    writeGate: "confirm-token",
    allowedTables: ["local Season", "local MatchdayState", "local SeasonState", "local GameLog"],
    forbiddenTables: ["Prisma", "remote database", "Transfer direct insert", "ActivePlayer direct insert"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "app/api/season/preseason-workflow/route.ts",
    category: "pre-season workflow api",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local Season", "local MatchdayState", "local SeasonState", "local GameLog"],
    forbiddenTables: ["Prisma", "remote database", "Transfer direct insert", "ActivePlayer direct insert"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/season-transition-service.ts",
    category: "season transition metadata service",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local GameState.gamePhase", "local GameState.seasonTransition"],
    forbiddenTables: ["Prisma", "remote database", "Team.cash", "rosters", "transferHistory", "Season advance"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "lib/season/season-review-service.ts",
    category: "season review presenter service",
    defaultMode: "read-only",
    writeGate: "n/a",
    allowedTables: [],
    forbiddenTables: ["Prisma", "remote database", "Team.cash", "rosters", "transferHistory", "Season advance"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "app/api/season/transition/route.ts",
    category: "season transition api",
    defaultMode: "dry-run",
    writeGate: "dryRun=false",
    allowedTables: ["local GameState.gamePhase", "local GameState.seasonTransition"],
    forbiddenTables: ["Prisma", "remote database", "Team.cash", "rosters", "transferHistory", "Season advance"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "scripts/sync-player-attribute-sheet-to-db.ts",
    category: "attribute sync script",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: ["PlayerAttribute"],
    forbiddenTables: ["Transfer", "Standings", "Result", "SQLite"],
    secretsSafe: true,
    explicitRemoteWriteRequired: true,
  },
  {
    path: "scripts/sync-player-sheet-columns-to-db.ts",
    category: "player sheet sync script",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: ["Player", "PlayerAttribute"],
    forbiddenTables: ["Transfer", "Standings", "Result", "SQLite"],
    secretsSafe: true,
    explicitRemoteWriteRequired: true,
  },
  {
    path: "scripts/sync-team-start-cash-to-db.ts",
    category: "team start cash sync script",
    defaultMode: "dry-run",
    writeGate: "--write",
    allowedTables: ["TeamSeasonState.cash"],
    forbiddenTables: ["Transfer", "ActivePlayer", "Standings", "SQLite", "AI"],
    secretsSafe: true,
    explicitRemoteWriteRequired: true,
  },
  {
    path: "prisma/seed.ts",
    category: "seed",
    defaultMode: "write",
    writeGate: "direct",
    allowedTables: ["foundation seed tables"],
    forbiddenTables: ["implicit production remote writes"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
  {
    path: "prisma/migrations",
    category: "migrations",
    defaultMode: "write",
    writeGate: "direct",
    allowedTables: ["schema-level changes"],
    forbiddenTables: ["blind reset", "destructive drop without intent"],
    secretsSafe: true,
    explicitRemoteWriteRequired: false,
  },
];

function pathExists(entryPath: string) {
  return fs.existsSync(path.join(process.cwd(), entryPath));
}

function main() {
  assertOlyProjectRoot();

  console.log("Write safety audit");
  console.log(JSON.stringify(entries, null, 2));

  const defaultSafe = entries.filter(
    (entry) => entry.defaultMode === "read-only" || entry.defaultMode === "dry-run",
  ).length;
  const gated = entries.filter(
    (entry) => entry.writeGate === "--write" || entry.writeGate === "confirm-token" || entry.writeGate === "dryRun=false",
  ).length;
  const missingPaths = entries.filter((entry) => !pathExists(entry.path));
  const unsafeDefaultWrites = entries.filter(
    (entry) => entry.defaultMode === "write" && entry.path !== "prisma/seed.ts" && entry.path !== "prisma/migrations",
  );

  console.log(`entriesTotal: ${entries.length}`);
  console.log(`defaultNonMutating: ${defaultSafe}`);
  console.log(`explicitWriteGate: ${gated}`);
  console.log(`missingPathCount: ${missingPaths.length}`);
  console.log(`unsafeDefaultWriteCount: ${unsafeDefaultWrites.length}`);

  if (missingPaths.length > 0) {
    console.error(`missingPaths: ${missingPaths.map((entry) => entry.path).join(", ")}`);
    process.exitCode = 1;
  }

  if (unsafeDefaultWrites.length > 0) {
    console.error(`unsafeDefaultWrites: ${unsafeDefaultWrites.map((entry) => entry.path).join(", ")}`);
    process.exitCode = 1;
  }
}

main();
