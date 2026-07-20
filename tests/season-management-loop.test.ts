import path from "node:path";
import { describe, expect, it } from "vitest";
import fs from "node:fs";

import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

describe("fresh season one management loop seed", () => {
  it("starts every team with budget=cash and management rows derived from the real local roster seed", () => {
    const gameState = createFreshSeasonOneGameState();
    const rows = buildTeamSeasonOverviewRows({ gameState });
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

    expect(rows).toHaveLength(32);
    expect(gameState.transferHistory).toHaveLength(0);
    expect(Object.keys(gameState.seasonState.teamStrategyProfiles ?? {})).toHaveLength(32);
    expect(gameState.season.matchdayIds).toHaveLength(10);
    expect(gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(gameState.seasonState.disciplineSchedule?.every((entry) => entry.sourceStatus === "season_seed")).toBe(true);
    expect(gameState.seasonState.disciplineSchedule?.[0]?.discipline1?.disciplineId).not.toBe("mini-dm");
    expect(gameState.seasonState.disciplineSchedule?.[0]?.discipline2?.disciplineId).not.toBe("fechten");

    for (const row of rows) {
      const roster = gameState.rosters.filter((entry) => entry.teamId === row.teamId);
      const salaryTotal = Number(
        roster.reduce((sum, entry) => {
          const player = playerById.get(entry.playerId);
          return sum + (typeof player?.displaySalary === "number" ? player.displaySalary : entry.salary);
        }, 0).toFixed(2),
      );
      const marketValueTotal = Number(
        roster.reduce((sum, entry) => {
          const player = playerById.get(entry.playerId);
          return sum + (typeof player?.displayMarketValue === "number"
            ? player.displayMarketValue
            : entry.currentValue ?? entry.purchasePrice ?? getImportedPlayerDisplayMarketValue(player ?? {}) ?? 0);
        }, 0).toFixed(2),
      );
      const avgContractLength =
        roster.length > 0
          ? Number((roster.reduce((sum, entry) => sum + entry.contractLength, 0) / roster.length).toFixed(1))
          : null;

      expect(row.cash).toBe(row.budget);
      expect(row.rosterCount).toBe(roster.length);
      expect(row.salaryTotal).toBe(salaryTotal);
      expect(row.marketValueTotal).toBe(roster.length > 0 ? marketValueTotal : null);
      expect(row.avgContractLength).toBe(avgContractLength);

      if (row.avgContractLength != null) {
        expect(Number.isInteger(row.avgContractLength * 10)).toBe(true);
      }
    }

    expect(rows[0]?.teamName).toBe("Mayhem Mavericks");
    expect(rows[0]?.cash).toBe(325);
    expect(rows[0]?.rank).toBe(1);
    expect(rows[rows.length - 1]?.teamName).toBe("Riptide Rivers");
    expect(rows[rows.length - 1]?.cash).toBe(170);
  });

  it("derives current season player stats only from stored playerDisciplinePerformances", () => {
    const gameState = createFreshSeasonOneGameState();
    const activeRosterEntry = gameState.rosters[0] ?? null;

    if (!activeRosterEntry) {
      expect(gameState.rosters).toHaveLength(0);
      return;
    }

    gameState.seasonState.matchdayResults = [
      {
        id: "matchday-result-test",
        saveId: "save-singleplayer-dev",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 32,
        teamsReady: 32,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "performance-test",
        matchdayResultId: "matchday-result-test",
        teamId: activeRosterEntry.teamId,
        playerId: activeRosterEntry.playerId,
        activePlayerId: activeRosterEntry.id,
        disciplineId: gameState.disciplines[0]?.id ?? "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 31.2,
        finalPlayerScore: 33,
        scoreContribution: 11,
        rankInTeam: 1,
        rankInDiscipline: 4,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: null,
        createdAt: "2026-06-06T12:01:00.000Z",
      },
    ];

    const performanceMap = buildPlayerSeasonPerformanceMap(gameState);
    const activeSummary = performanceMap.get(activeRosterEntry.playerId);

    expect(activeSummary).toBeTruthy();
    expect(activeSummary?.appearances).toBe(1);
    expect(activeSummary?.totalPoints).toBe(11);
    expect(activeSummary?.latestFinalScore).toBe(33);
    expect(activeSummary?.bestDisciplineLabel).toBe(gameState.disciplines[0]?.name ?? "d1");

    const untouchedActivePlayerId = gameState.rosters[1]?.playerId;
    if (untouchedActivePlayerId) {
      expect(performanceMap.has(untouchedActivePlayerId)).toBe(false);
    }
  });

  it("keeps the full local season smoke free of hidden tie seeds and includes explicit matchday progress", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/smoke-local-season-loop.ts"),
      "utf8",
    );

    expect(source).not.toContain("seedProjectedPointsTieBreak");
    expect(source).not.toContain("breakStoredStandingsTies");
    expect(source).toContain("executeMatchdayAdvance");
    expect(source).toContain("afterMatchdayAdvance");
  });

  it("provides a multi-matchday smoke that reuses the first local loop and runs a second configured matchday", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/smoke-local-multi-matchday-loop.ts"),
      "utf8",
    );

    expect(packageJson.scripts?.["season:smoke-local-multi-loop"]).toBe("tsx scripts/smoke-local-multi-matchday-loop.ts");
    expect(source).toContain("scripts/smoke-local-season-loop.ts");
    expect(source).toContain("matchday-2");
    expect(source).toContain("Expected a configured next matchday after completing the second local matchday cycle.");
    expect(source).toContain("nextPreviewMatchdayId");
  });

  it("provides a dedicated local matchday auto-run service, route and smoke script", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const serviceText = fs.readFileSync(
      path.join(process.cwd(), "lib/season/matchday-auto-run-service.ts"),
      "utf8",
    );
    const routeText = fs.readFileSync(
      path.join(process.cwd(), "app/api/season/matchday-auto-run/route.ts"),
      "utf8",
    );
    const smokeText = fs.readFileSync(
      path.join(process.cwd(), "scripts/smoke-matchday-auto-run.ts"),
      "utf8",
    );

    expect(packageJson.scripts?.["season:smoke-matchday-auto-run"]).toBe("tsx scripts/smoke-matchday-auto-run.ts");
    expect(serviceText).toContain("MATCHDAY_AUTO_RUN_CONFIRM_TOKEN");
    expect(serviceText).toContain("applyAiLegacyLineupBatchLocally");
    expect(serviceText).toContain("LegacyMatchdayResultApplyService");
    expect(serviceText).toContain("executeStandingsApply");
    expect(serviceText).not.toContain("executeCashPrizeApply");
    expect(serviceText).toContain("executeMatchdayAdvance");
    expect(serviceText).not.toContain("applyAiMarketPlanLocally");
    expect(serviceText).toContain("includeWarningLineups");
    expect(serviceText).toContain("overwriteExistingLineups");
    expect(serviceText).toContain("stopOnTie");
    expect(serviceText).toContain("advanceAfterCashApply");
    expect(serviceText).toContain("missing_manual_lineup");
    expect(serviceText).toContain("passive_missing_lineup");
    expect(serviceText).toContain("manualMissing");
    expect(serviceText).toContain("passiveMissing");
    expect(routeText).toContain("confirmToken");
    expect(routeText).toContain("Prisma/Supabase mode is read-only in this build.");
    expect(smokeText).toContain("runLocalMatchdayAutoRun");
    expect(smokeText).toContain("MATCHDAY_AUTO_RUN_CONFIRM_TOKEN");
    expect(smokeText).toContain('testStatus: "passed"');
  });

  it("documents the transfer window policy as a separate phase outside matchday auto-run", () => {
    const policyText = fs.readFileSync(
      path.join(process.cwd(), "docs/TRANSFER_WINDOW_POLICY.md"),
      "utf8",
    );
    const marketApplyRouteText = fs.readFileSync(
      path.join(process.cwd(), "app/api/ai/market-plan-apply/route.ts"),
      "utf8",
    );

    expect(policyText).toContain("AI-Market-Apply laeuft nie automatisch im Matchday Auto-Run.");
    expect(policyText).toContain("manual_transfer_window");
    expect(marketApplyRouteText).toContain("transferPhaseRequired");
  });

  it("provides a whole-season dryrun service, route and cockpit entry without real execute mode", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const serviceText = fs.readFileSync(
      path.join(process.cwd(), "lib/season/whole-season-dryrun-service.ts"),
      "utf8",
    );
    const aliasServiceText = fs.readFileSync(
      path.join(process.cwd(), "lib/season/whole-season-dry-run-service.ts"),
      "utf8",
    );
    const routeText = fs.readFileSync(
      path.join(process.cwd(), "app/api/season/whole-season-dryrun/route.ts"),
      "utf8",
    );
    const aliasRouteText = fs.readFileSync(
      path.join(process.cwd(), "app/api/season/whole-season-dry-run/route.ts"),
      "utf8",
    );
    const smokeText = fs.readFileSync(
      path.join(process.cwd(), "scripts/smoke-whole-season-dry-run.ts"),
      "utf8",
    );
    const foundationText = fs.readFileSync(
      path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx"),
      "utf8",
    );

    expect(packageJson.scripts?.["season:smoke-whole-season-dry-run"]).toBe("tsx scripts/smoke-whole-season-dry-run.ts");
    expect(serviceText).toContain("simulationMode: \"in_memory_local_copy\"");
    expect(serviceText).toContain("runLocalMatchdayAutoRun");
    expect(serviceText).toContain("MATCHDAY_AUTO_RUN_CONFIRM_TOKEN");
    expect(serviceText).toContain("maxMatchdays");
    expect(serviceText).toContain("stopOnMissingManualLineups");
    expect(serviceText).toContain("advanceAfterEachMatchday");
    expect(serviceText).toContain("includeMarketPhase");
    expect(serviceText).toContain("readOnly: true");
    expect(aliasServiceText).toContain("whole-season-dryrun-service");
    expect(routeText).toContain("Whole season simulation is dry-run only in this block.");
    expect(routeText).toContain("startMatchdayId");
    expect(routeText).toContain("maxMatchdays");
    expect(aliasRouteText).toContain("whole-season-dryrun/route");
    expect(smokeText).toContain("runWholeSeasonDryRun");
    expect(smokeText).toContain('testStatus: "blocked_as_expected"');
    expect(foundationText).toContain("Season DryRun simulieren");
    expect(foundationText).toContain("runCockpitWholeSeasonDryRun");
    expect(foundationText).toContain("/api/season/whole-season-dry-run");
    expect(foundationText).toContain("Max Matchdays");
  });
});
