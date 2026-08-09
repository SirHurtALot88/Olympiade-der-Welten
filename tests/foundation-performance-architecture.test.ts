import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

import {
  buildLegacyLineupLabContextCacheKey,
  invalidateLegacyLineupLabContextCache,
  readLegacyLineupLabContextCache,
  writeLegacyLineupLabContextCache,
} from "@/lib/lineups/legacy-lineup-lab-context-cache";
import { shouldBuildFoundationGameFlow } from "@/lib/foundation/tabs/use-foundation-game-flow";
import {
  shouldBuildFoundationCockpitFlowWarnings,
  shouldBuildFoundationGameInboxDerivations,
  shouldBuildFoundationMatchdayFlowDerivations,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-game-flow";
import {
  shouldBuildFoundationMatchdaySummaryDerivations,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-matchday-lineup";
import {
  shouldBuildFoundationSeasonBriefingData,
  shouldBuildFoundationSeasonReadinessChecklist,
  shouldBuildFoundationSeasonSetupFlow,
  shouldBuildFoundationSeasonTransitionGate,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-season-briefing";
import {
  shouldBuildFoundationHqGmStory,
  shouldBuildFoundationHqOfficeDerivations,
  shouldBuildFoundationTeamGmProfileDerivations,
  shouldBuildFoundationTeamObjectiveOverview,
  shouldBuildFoundationTeamPlayerDemands,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-home-v2";
import {
  shouldBuildFoundationPpAreaTableDerivations,
  shouldBuildFoundationPrizePreviewDerivations,
  shouldBuildFoundationSeasonEndChampionRow,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-season-prize";
import {
  shouldBuildFoundationTrainingCompactDerivations,
  shouldBuildFoundationTrainingFacilitiesDerivations,
  shouldBuildFoundationTrainingForecastDerivations,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-training";
import {
  shouldBuildFoundationLeagueHeatPools,
  shouldBuildFoundationPlayerDirectory,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";
import {
  shouldBuildFoundationHqTransferMarkerDerivations,
  shouldBuildFoundationScoutingHubDerivations,
  shouldBuildFoundationTransferSellMarkerDerivations,
  shouldBuildFoundationTransferWishlistDerivations,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-market-filters";
import {
  shouldBuildFoundationSelectedRosterTableRows,
  shouldBuildFoundationTeamProfileData,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import {
  shouldLoadStandingsPreviewFeed,
  shouldRefreshSeasonOverviewOnReload,
} from "@/lib/foundation/tabs/use-standings-preview-feed";
import { isFoundationViewActive } from "@/lib/foundation/foundation-view-active";
import {
  isSeasonArchiveLoaded,
  shouldLoadSeasonArchiveForView,
  shouldRequestSeasonArchiveLoad,
} from "@/lib/foundation/tabs/use-season-archive-load";
import {
  resolveShouldBuildTeamsOverviewTable,
  resolveShouldBuildTeamsPlayerRatings,
  resolveShouldBuildTeamsPortraitsTab,
  resolveShouldBuildTeamsRosterDerivations,
  resolveShouldBuildTeamsScopedRatings,
  shouldBuildTeamsView,
} from "@/lib/foundation/tabs/teams-view-derivations";
import fs from "node:fs/promises";
import path from "node:path";

import { FoundationTabActiveHost } from "@/lib/foundation/foundation-tab-active-host";

const root = path.join(process.cwd());

describe("foundation performance architecture helpers", () => {
  it("mounts only active foundation views", () => {
    expect(isFoundationViewActive("lineupV2", "lineupV2", "lineup")).toBe(true);
    expect(isFoundationViewActive("teams", "lineupV2", "lineup")).toBe(false);
  });

  it("unmounts inactive tab hosts via FoundationTabActiveHost", () => {
    expect(FoundationTabActiveHost({ active: false, children: "hidden" })).toBeNull();
    expect(FoundationTabActiveHost({ active: true, children: "visible" })).toBe("visible");
  });

  it("scopes teams sub-tab derivations and ratings loading", () => {
    expect(shouldBuildTeamsView("teams")).toBe(true);
    expect(shouldBuildTeamsView("seasonV2")).toBe(false);
    expect(resolveShouldBuildTeamsOverviewTable("teams", "roster")).toBe(true);
    expect(resolveShouldBuildTeamsOverviewTable("teams", "portraits")).toBe(false);
    expect(resolveShouldBuildTeamsScopedRatings("teams", "roster")).toBe(true);
    expect(resolveShouldBuildTeamsScopedRatings("teams", "contracts")).toBe(true);
    expect(resolveShouldBuildTeamsScopedRatings("teams", "portraits")).toBe(false);
    expect(resolveShouldBuildTeamsPortraitsTab("teams", "portraits")).toBe(true);
    expect(resolveShouldBuildTeamsPortraitsTab("teams", "roster")).toBe(false);
    expect(
      resolveShouldBuildTeamsRosterDerivations({ activeView: "teams", teamsHydrationPhase: "shell" }),
    ).toBe(false);
    expect(
      resolveShouldBuildTeamsRosterDerivations({ activeView: "teams", teamsHydrationPhase: "full" }),
    ).toBe(true);
    expect(
      resolveShouldBuildTeamsPlayerRatings({
        activeView: "teams",
        teamsHydrationPhase: "shell",
        selectedTeamDetailTab: "roster",
        shouldBuildTeamContracts: false,
        shouldBuildExtendedTeamPanels: false,
      }),
    ).toBe(false);
    expect(
      resolveShouldBuildTeamsPlayerRatings({
        activeView: "teams",
        teamsHydrationPhase: "full",
        selectedTeamDetailTab: "roster",
        shouldBuildTeamContracts: false,
        shouldBuildExtendedTeamPanels: false,
      }),
    ).toBe(true);
    expect(
      resolveShouldBuildTeamsPlayerRatings({
        activeView: "seasonV2",
        teamsHydrationPhase: "full",
        selectedTeamDetailTab: "roster",
        shouldBuildTeamContracts: false,
        shouldBuildExtendedTeamPanels: false,
      }),
    ).toBe(false);
  });

  it("scopes game flow and feed reload helpers to relevant tabs", () => {
    expect(shouldBuildFoundationGameFlow("homeV2")).toBe(true);
    expect(shouldBuildFoundationGameFlow("trainingCompact")).toBe(false);
    expect(shouldBuildFoundationGameInboxDerivations("inboxV2")).toBe(true);
    expect(shouldBuildFoundationGameInboxDerivations("teams")).toBe(false);
    expect(shouldBuildFoundationMatchdayFlowDerivations("matchdayArena")).toBe(true);
    expect(shouldBuildFoundationMatchdayFlowDerivations("marketV2")).toBe(false);
    expect(shouldBuildFoundationMatchdaySummaryDerivations("matchdayResult")).toBe(true);
    expect(shouldBuildFoundationMatchdaySummaryDerivations("teams")).toBe(false);
    expect(shouldBuildFoundationSeasonTransitionGate("cockpit")).toBe(true);
    expect(shouldBuildFoundationSeasonTransitionGate("lineupV2")).toBe(false);
    expect(shouldBuildFoundationSeasonSetupFlow("homeV2")).toBe(true);
    expect(shouldBuildFoundationSeasonSetupFlow("marketV2")).toBe(false);
    expect(shouldBuildFoundationSeasonBriefingData("seasonPreview")).toBe(true);
    expect(shouldBuildFoundationSeasonBriefingData("teams")).toBe(false);
    expect(shouldBuildFoundationSeasonReadinessChecklist("homeV2")).toBe(false);
    expect(shouldBuildFoundationSeasonReadinessChecklist("homeV2", "office")).toBe(true);
    expect(shouldBuildFoundationSeasonReadinessChecklist("teams")).toBe(false);
    expect(shouldBuildFoundationCockpitFlowWarnings("cockpit")).toBe(true);
    expect(shouldBuildFoundationCockpitFlowWarnings("teams")).toBe(false);
    expect(shouldLoadStandingsPreviewFeed("matchdayArena")).toBe(true);
    expect(shouldLoadStandingsPreviewFeed("teams")).toBe(false);
    expect(shouldRefreshSeasonOverviewOnReload("seasonV2")).toBe(true);
    expect(shouldRefreshSeasonOverviewOnReload("lineupV2")).toBe(false);
  });

  it("scopes home v2 hq derivations to relevant tabs", () => {
    expect(
      shouldBuildFoundationTeamObjectiveOverview({
        shouldBuildHomeV2Overview: false,
        shouldBuildTeamsView: false,
        shouldBuildMarketView: false,
        activeView: "lineupV2",
        teamProfileTeamId: null,
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationTeamObjectiveOverview({
        shouldBuildHomeV2Overview: true,
        shouldBuildTeamsView: false,
        shouldBuildMarketView: false,
        activeView: "homeV2",
        teamProfileTeamId: null,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTeamObjectiveOverview({
        shouldBuildHomeV2Overview: false,
        shouldBuildTeamsView: false,
        shouldBuildMarketView: false,
        activeView: "seasonV2",
        teamProfileTeamId: null,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTeamObjectiveOverview({
        shouldBuildHomeV2Overview: false,
        shouldBuildTeamsView: false,
        shouldBuildMarketView: false,
        activeView: "lineupV2",
        teamProfileTeamId: "team-a",
      }),
    ).toBe(true);
    expect(shouldBuildFoundationHqOfficeDerivations(false)).toBe(false);
    expect(shouldBuildFoundationHqOfficeDerivations(true)).toBe(false);
    expect(shouldBuildFoundationHqOfficeDerivations(true, "office")).toBe(true);
    expect(
      shouldBuildFoundationHqGmStory({ shouldBuildHomeV2Overview: false, activeView: "teams" }),
    ).toBe(false);
    expect(
      shouldBuildFoundationHqGmStory({ shouldBuildHomeV2Overview: false, activeView: "teamSettings" }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTeamGmProfileDerivations({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
        activeView: "lineupV2",
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationTeamGmProfileDerivations({
        shouldBuildTeamsView: true,
        shouldBuildHomeV2Overview: false,
        activeView: "lineupV2",
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTeamPlayerDemands({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: true,
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationTeamPlayerDemands({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: true,
        homeV2Tab: "office",
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTeamPlayerDemands({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(false);
  });

  it("scopes training cross-tab derivations to relevant tabs", () => {
    expect(
      shouldBuildFoundationTrainingForecastDerivations({
        shouldBuildTrainingView: false,
        shouldBuildPlayerProfileTrainingRow: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationTrainingForecastDerivations({
        shouldBuildTrainingView: true,
        shouldBuildPlayerProfileTrainingRow: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTrainingForecastDerivations({
        shouldBuildTrainingView: false,
        shouldBuildPlayerProfileTrainingRow: true,
      }),
    ).toBe(true);
    expect(shouldBuildFoundationTrainingCompactDerivations(false)).toBe(false);
    expect(shouldBuildFoundationTrainingCompactDerivations(true)).toBe(true);
    expect(shouldBuildFoundationTrainingFacilitiesDerivations(false)).toBe(false);
    expect(shouldBuildFoundationTrainingFacilitiesDerivations(true)).toBe(true);
  });

  it("scopes season prize cross-tab derivations to relevant tabs", () => {
    expect(shouldBuildFoundationPpAreaTableDerivations(false)).toBe(false);
    expect(shouldBuildFoundationPpAreaTableDerivations(true)).toBe(true);
    expect(shouldBuildFoundationPrizePreviewDerivations(false)).toBe(false);
    expect(shouldBuildFoundationPrizePreviewDerivations(true)).toBe(true);
    expect(shouldBuildFoundationSeasonEndChampionRow("cockpit")).toBe(true);
    expect(shouldBuildFoundationSeasonEndChampionRow("prize")).toBe(true);
    expect(shouldBuildFoundationSeasonEndChampionRow("teams")).toBe(false);
  });

  it("scopes player directory and league heat pool derivations to relevant tabs", () => {
    expect(shouldBuildFoundationPlayerDirectory("players")).toBe(true);
    expect(shouldBuildFoundationPlayerDirectory("teams")).toBe(false);
    expect(
      shouldBuildFoundationLeagueHeatPools({
        shouldBuildPlayerDirectory: false,
        shouldBuildMarketView: false,
        shouldBuildTeamHistory: false,
        activeView: "lineupV2",
        showExtendedTeamPanels: false,
        selectedTeamDetailTab: "roster",
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationLeagueHeatPools({
        shouldBuildPlayerDirectory: true,
        shouldBuildMarketView: false,
        shouldBuildTeamHistory: false,
        activeView: "lineupV2",
        showExtendedTeamPanels: false,
        selectedTeamDetailTab: "roster",
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationLeagueHeatPools({
        shouldBuildPlayerDirectory: false,
        shouldBuildMarketView: false,
        shouldBuildTeamHistory: false,
        activeView: "teams",
        showExtendedTeamPanels: false,
        selectedTeamDetailTab: "portraits",
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationLeagueHeatPools({
        shouldBuildPlayerDirectory: false,
        shouldBuildMarketView: false,
        shouldBuildTeamHistory: false,
        activeView: "homeV2",
        showExtendedTeamPanels: false,
        selectedTeamDetailTab: "roster",
        homeV2OverviewHeavyReady: true,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationLeagueHeatPools({
        shouldBuildPlayerDirectory: false,
        shouldBuildMarketView: false,
        shouldBuildTeamHistory: false,
        activeView: "homeV2",
        showExtendedTeamPanels: false,
        selectedTeamDetailTab: "roster",
        homeV2OverviewHeavyReady: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationLeagueHeatPools({
        shouldBuildPlayerDirectory: false,
        shouldBuildMarketView: false,
        shouldBuildTeamHistory: false,
        activeView: "homeV2",
        showExtendedTeamPanels: false,
        selectedTeamDetailTab: "roster",
        homeV2Tab: "office",
        homeV2OverviewHeavyReady: true,
      }),
    ).toBe(false);
  });

  it("scopes market filter and transfer marker derivations to relevant tabs", () => {
    expect(shouldBuildFoundationTransferWishlistDerivations(false)).toBe(false);
    expect(shouldBuildFoundationTransferWishlistDerivations(true)).toBe(true);
    expect(
      shouldBuildFoundationTransferSellMarkerDerivations({
        shouldBuildMarketView: false,
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationTransferSellMarkerDerivations({
        shouldBuildMarketView: false,
        shouldBuildTeamsView: true,
        shouldBuildHomeV2Overview: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationTransferSellMarkerDerivations({
        shouldBuildMarketView: false,
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: true,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationScoutingHubDerivations({ shouldBuildMarketView: false, shouldBuildScoutingHubView: false }),
    ).toBe(false);
    expect(
      shouldBuildFoundationScoutingHubDerivations({ shouldBuildMarketView: true, shouldBuildScoutingHubView: false }),
    ).toBe(true);
    expect(
      shouldBuildFoundationScoutingHubDerivations({ shouldBuildMarketView: false, shouldBuildScoutingHubView: true }),
    ).toBe(true);
    expect(shouldBuildFoundationHqTransferMarkerDerivations(false)).toBe(false);
    expect(shouldBuildFoundationHqTransferMarkerDerivations(true)).toBe(true);
  });

  it("scopes teams roster cross-tab derivations to relevant tabs", () => {
    expect(
      shouldBuildFoundationSelectedRosterTableRows({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
        shouldBuildMarketView: false,
      }),
    ).toBe(false);
    expect(
      shouldBuildFoundationSelectedRosterTableRows({
        shouldBuildTeamsView: true,
        shouldBuildHomeV2Overview: false,
        shouldBuildMarketView: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationSelectedRosterTableRows({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: true,
        shouldBuildMarketView: false,
      }),
    ).toBe(true);
    expect(
      shouldBuildFoundationSelectedRosterTableRows({
        shouldBuildTeamsView: false,
        shouldBuildHomeV2Overview: false,
        shouldBuildMarketView: true,
      }),
    ).toBe(true);
    expect(shouldBuildFoundationTeamProfileData(null)).toBe(false);
    expect(shouldBuildFoundationTeamProfileData("H-R")).toBe(true);
  });

  it("scopes season archive loads to views that need historical snapshots", () => {
    expect(shouldLoadSeasonArchiveForView("players", { showExtendedTeamPanels: false })).toBe(false);
    expect(shouldLoadSeasonArchiveForView("teams", { showExtendedTeamPanels: false })).toBe(false);
    expect(shouldLoadSeasonArchiveForView("teams", { showExtendedTeamPanels: true })).toBe(true);
    expect(shouldLoadSeasonArchiveForView("trainingCompact", { showExtendedTeamPanels: false })).toBe(false);
    expect(shouldLoadSeasonArchiveForView("seasonV2", { showExtendedTeamPanels: false })).toBe(true);
    expect(shouldLoadSeasonArchiveForView("playerProfile", { showExtendedTeamPanels: false })).toBe(true);
    expect(shouldLoadSeasonArchiveForView("teamProfile", { showExtendedTeamPanels: false })).toBe(true);
    expect(shouldLoadSeasonArchiveForView("allTimeTable", { showExtendedTeamPanels: false })).toBe(true);
    expect(isSeasonArchiveLoaded(undefined)).toBe(false);
    expect(isSeasonArchiveLoaded([])).toBe(true);
    expect(isSeasonArchiveLoaded([{ seasonId: "season-1" } as never])).toBe(true);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "players",
        seasonSnapshots: undefined,
        showExtendedTeamPanels: false,
      }),
    ).toBe(false);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "seasonV2",
        seasonSnapshots: undefined,
        showExtendedTeamPanels: false,
      }),
    ).toBe(true);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "seasonV2",
        seasonSnapshots: [],
        showExtendedTeamPanels: false,
        seasonArchiveFetchCompleted: false,
      }),
    ).toBe(true);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "seasonV2",
        seasonSnapshots: [],
        showExtendedTeamPanels: false,
        seasonArchiveFetchCompleted: true,
      }),
    ).toBe(false);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "teams",
        seasonSnapshots: undefined,
        showExtendedTeamPanels: false,
      }),
    ).toBe(false);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "teams",
        seasonSnapshots: undefined,
        showExtendedTeamPanels: true,
      }),
    ).toBe(true);
    expect(
      shouldRequestSeasonArchiveLoad({
        activeView: "teamProfile",
        seasonSnapshots: [],
        showExtendedTeamPanels: false,
        seasonArchiveFetchCompleted: false,
      }),
    ).toBe(true);
  });

  it("serves ratings-slice from materialized projection before full save load", async () => {
    const ratingsSliceRouteText = await fs.readFile(
      path.join(root, "app/api/season/ratings-slice/route.ts"),
      "utf8",
    );
    expect(ratingsSliceRouteText).toContain("tryResolvePersistedRatingsSlice");
    expect(ratingsSliceRouteText).toContain('warnings: ["projection_read"]');
  });

  it("wires marketSellBusy into the teams detail panel", async () => {
    const foundationText = await readFoundationOrchestratorSource(root);
    const foundationSurfaceText = await readFoundationSurfaceSource(root);
    const pageStateText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-page-state.ts"),
      "utf8",
    );
    const cockpitHostText = await fs.readFile(
      path.join(root, "app/foundation/cockpit-v2/FoundationCockpitHost.tsx"),
      "utf8",
    );
    const cockpitPanelText = await fs.readFile(
      path.join(root, "app/foundation/cockpit-v2/FoundationCockpitPanel.tsx"),
      "utf8",
    );
    // Cockpit-Duplikat aufgeloest (siehe Plan): `FoundationSharedProvider`
    // hielt dieselben vier `cockpit*`-States ein zweites Mal parallel zu
    // `use-foundation-page-state.ts`, ohne dass beide je synchronisiert
    // wurden — zwei Wahrheiten fuer denselben Busy-Zustand. Jetzt gibt es
    // nur noch eine Quelle (den Hook); Host und Panel bekommen sie als Props.
    expect(foundationText).not.toContain("FoundationSharedProvider");
    expect(foundationText).not.toContain("useFoundationShared");
    expect(foundationText).toContain("FoundationStateProvider");
    expect(foundationText).toContain("useFoundationCrossTabGameFlow");
    expect(foundationText).toContain("useFoundationCrossTabHomeV2");
    expect(foundationText).toContain("useFoundationCrossTabSeasonPrize");
    expect(foundationText).toContain("useFoundationCrossTabTraining");
    expect(foundationText).toContain("useFoundationCrossTabDisciplineRanks");
    expect(foundationText).toContain("useFoundationCrossTabPlayerDirectory");
    expect(foundationText).toContain("useFoundationCrossTabMarketFilters");
    expect(foundationText).toContain("useFoundationCrossTabTeamsRoster");
    expect(foundationText).toContain("useFoundationCrossTabMatchdayLineup");
    expect(foundationText).toContain("useFoundationCrossTabSeasonBriefing");
    expect(foundationSurfaceText).toContain('activeView === "admin"');
    expect(foundationSurfaceText).toContain('active={activeView === "seasonPreview"}');
    expect(foundationSurfaceText).toContain('activeView === "generator"');
    expect(foundationSurfaceText).toContain('activeView === "debug"');
    expect(foundationSurfaceText).toContain('active={activeView === "history" || activeView === "historyV2"}');
    expect(foundationSurfaceText).toContain('activeView === "training" || activeView === "trainingCompact"');
    expect(pageStateText).toContain("cockpitBusyKey");
    expect(pageStateText).toContain("cockpitAiBatchApplyFeed");
    expect(pageStateText).toContain("cockpitAiIncludeWarningTeams");
    expect(pageStateText).toContain("cockpitAiOverwriteExisting");
    expect(cockpitHostText).not.toContain("useFoundationShared");
    expect(cockpitHostText).toContain("use-cockpit-panel-derivations");
    expect(cockpitPanelText).not.toContain("useFoundationShared");
    expect(foundationText).not.toContain("cockpitBusyKey={cockpitBusyKey}");
    expect(foundationText).not.toContain("setCockpitBusyKey={setCockpitBusyKey}");
    const teamsText = await fs.readFile(
      path.join(root, "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"),
      "utf8",
    );

    expect(foundationText).toContain("/api/season/snapshots");
    expect(foundationText).toContain("usePlayerDirectorySlice");
    expect(foundationText).toContain("useTeamOverviewSlice");
    expect(foundationText).toContain("prefetchSeasonStandingsData");
    expect(foundationText).toContain("prefetchPlayerDirectoryData");
    expect(foundationText).toContain("@/lib/foundation/foundation-navigation");
    expect(foundationText).toContain("bindFoundationNavigationStart");
    expect(foundationSurfaceText).toContain("FoundationShellRouterTeams");
    expect(foundationSurfaceText).toContain("FoundationShellRouterCockpit");
    expect(foundationSurfaceText).toContain("FoundationShellRouterInboxV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterSeasonV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterPrize");
    expect(foundationSurfaceText).toContain("FoundationShellRouterLineup");
    expect(foundationSurfaceText).toContain("FoundationShellRouterMarketV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterMarketSell");
    expect(foundationSurfaceText).toContain("isMarketOfferPanelOpen");
    // The old FoundationShellRouterMatchdayArena panel UI (matchday-arena-v2) was
    // removed; the "matchdayArena" view now renders FoundationDisciplineStageHost
    // directly (see the "Arena = die (ehemalige) Disziplin-Bühne" comment in
    // FoundationShellRouterBody.tsx).
    expect(foundationSurfaceText).toContain("FoundationDisciplineStageHost");
    expect(foundationSurfaceText).toContain("FoundationShellRouterMatchdayResult");
    expect(foundationSurfaceText).toContain("FoundationShellRouterHistoryV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterSeasonPreview");
    expect(foundationSurfaceText).toContain("FoundationTeamsViewHost");
    expect(foundationSurfaceText).toContain("FoundationTeamSettingsHost");
    expect(foundationSurfaceText).toContain("FoundationRanksHost");
    expect(foundationSurfaceText).toContain("FoundationDiszisHost");
    expect(foundationSurfaceText).toContain('activeView === "lineup"');
    expect(foundationSurfaceText).toContain('activeView === "lineupV2"');
    expect(foundationSurfaceText).toContain('activeView === "prize"');
    expect(foundationSurfaceText).toContain('activeView === "teamSettings"');
    expect(foundationSurfaceText).toContain('activeView === "ranks"');
    expect(foundationSurfaceText).toContain('activeView === "diszis"');
    const prizeHostText = await fs.readFile(
      path.join(root, "app/foundation/prize-v2/FoundationPrizeFinanceShellHost.tsx"),
      "utf8",
    );
    expect(prizeHostText).toContain("use-prize-panel-derivations");
    expect(prizeHostText).toContain("FoundationPrizeFinanceHost");
    const lineupHostText = await fs.readFile(
      path.join(root, "app/foundation/legacy-lineup-lab/FoundationLineupShellHost.tsx"),
      "utf8",
    );
    expect(lineupHostText).toContain("use-lineup-derivations");
    expect(lineupHostText).toContain("FoundationLineupPanel");
    const marketHostText = await fs.readFile(
      path.join(root, "app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost.tsx"),
      "utf8",
    );
    expect(marketHostText).toContain("use-market-v2-derivations");
    expect(marketHostText).toContain("FoundationTransfermarktV2Panel");
    const marketSellHostText = await fs.readFile(
      path.join(root, "app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx"),
      "utf8",
    );
    expect(marketSellHostText).toContain("use-market-sell-derivations");
    const marketBuyHostText = await fs.readFile(
      path.join(root, "app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost.tsx"),
      "utf8",
    );
    expect(marketBuyHostText).toContain("use-market-buy-derivations");

    /**
     * DIE TESTIDS STEHEN NICHT MEHR IN DEN HOSTS. Seit „Kauf und Verkauf auf einer Huelle" (#345)
     * reichen beide Hosts ihre Testid als PROP `testId` an `FoundationDecisionSurface` durch, die
     * daraus das `data-testid` rendert. Im DOM steht danach unveraendert dasselbe.
     *
     * Vorher stand hier auf beiden Seiten `toContain('data-testid="…"')` — als Text im Quelltext
     * gesucht. Auf der Kaufseite schlug das seitdem fehl. Auf der Verkaufsseite bestand es weiter,
     * aber aus dem falschen Grund: die Zeichenkette taucht dort nur noch in einem KOMMENTAR auf,
     * der den Umzug erklaert. Eine Zusicherung, die ein Kommentar erfuellt, sichert nichts.
     *
     * Geprueft wird darum die Kette, auf die es ankommt: beide Hosts reichen ihre Testid durch,
     * und die Huelle macht daraus wirklich ein `data-testid`.
     */
    expect(marketSellHostText).toContain('testId="transfer-sell-page"');
    expect(marketBuyHostText).toContain('testId="transfer-offer-page"');
    const decisionSurfaceText = await fs.readFile(
      path.join(root, "app/foundation/decision-surface/FoundationDecisionSurface.tsx"),
      "utf8",
    );
    expect(decisionSurfaceText).toContain("data-testid={testId}");
    const transfermarktV2Text = await fs.readFile(
      path.join(root, "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx"),
      "utf8",
    );
    expect(transfermarktV2Text).toContain("FoundationShellRouterMarketBuy");
    const resultHostShellText = await fs.readFile(
      path.join(root, "app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost.tsx"),
      "utf8",
    );
    // FoundationMatchdayResultShellHost.tsx is now a thin wrapper around
    // MatchdayResultNewLook.tsx, which owns the actual panel markup (including
    // the id landmark). Combine both so this check still reflects real wiring.
    const resultHostNewLookText = await fs.readFile(
      path.join(root, "app/foundation/matchday-result-v2/MatchdayResultNewLook.tsx"),
      "utf8",
    );
    const resultHostText = `${resultHostShellText}\n${resultHostNewLookText}`;
    /**
     * HIER STAND EINE ABSICHTLICH ROTE ZUSICHERUNG auf „use-matchday-result-derivations", mit dem
     * Verdacht, der Umschalter „Spieltag / Saisonstand" sei verlorengegangen. Nachgesehen: er ist
     * nicht verloren, er ist ueberfluessig geworden.
     *
     * Der alte Host (`32683df8^`) hatte zwei Knoepfe. Unter „Saisonstand" lag eine zweite Tabelle
     * mit Tagesrang, Tagespunkten, D1/D2-Score, Rang vorher und nachher, Δ Rang und kumulierten
     * Punkten. Genau diese Spalten zeigt `MatchdayResultNewLook` heute in EINER Tabelle — es gibt
     * nichts mehr, zwischen dem man umschalten koennte.
     *
     * Der Hook war seit #211 von niemandem mehr importiert, sein Zustand hing nur noch als
     * durchgereichte, nirgends gelesene Prop in der Wurzel. Beides ist jetzt entfernt. Statt der
     * toten Verdrahtung sichert dieser Test, dass die Zusammenlegung haelt: beide Haelften des
     * frueheren Umschalters muessen in derselben Tabelle stehen.
     */
    expect(resultHostText).toContain('id="foundation-matchday-result"');
    for (const spalte of [
      "matchdayRank",
      "matchdayPoints",
      "d1Score",
      "d2Score",
      "seasonRankBeforeMatchday",
      "seasonRankAfterMatchday",
      "rankDelta",
      "cumulativePoints",
    ]) {
      expect(resultHostNewLookText).toContain(spalte);
    }
    const historyHostText = await fs.readFile(
      path.join(root, "app/foundation/transfer-history-v2/FoundationHistoryV2ShellHost.tsx"),
      "utf8",
    );
    expect(historyHostText).toContain('id="transfer-history"');
    expect(historyHostText).toContain("use-history-v2-derivations");
    expect(historyHostText).toContain("TransferHistoryV2Client");
    const seasonPreviewHostShellText = await fs.readFile(
      path.join(root, "app/foundation/season-preview-v2/FoundationSeasonPreviewShellHost.tsx"),
      "utf8",
    );
    // FoundationSeasonPreviewShellHost.tsx is now a thin wrapper around
    // SeasonPreviewNewLook.tsx, which owns the actual panel markup.
    const seasonPreviewNewLookText = await fs.readFile(
      path.join(root, "app/foundation/season-preview-v2/SeasonPreviewNewLook.tsx"),
      "utf8",
    );
    const seasonPreviewHostText = `${seasonPreviewHostShellText}\n${seasonPreviewNewLookText}`;
    /**
     * AUCH HIER STAND EINE ABSICHTLICH ROTE ZUSICHERUNG, auf „use-season-preview-derivations".
     * Der Hook baute ein Spaltensystem: sortieren per Kopfzeile, Breite ziehen, links und rechts
     * anheften, Spalten aus- und einblenden. `SeasonPreviewNewLook` hat davon nichts mehr, es
     * sortiert fest ueber `compareProjectionRows`.
     *
     * Nachgesehen: die DATEN sind vollstaendig geblieben — aktuelle Punkte, Matchday-Score und
     * -Rang, Punkte-Delta, Punkte nachher, Vorschau-Rang, aktueller Rang, Result-Status. Verloren
     * ist nur die BEDIENUNG der Spalten. Das ist eine Design-Entscheidung des neuen Looks, keine
     * Panne, und die schlankere Tabelle bleibt. Der Hook war seit dem Umbau von niemandem mehr
     * importiert und ist entfernt; wer das Spaltensystem zurueckwill, holt ihn aus der Historie.
     *
     * Gesichert wird darum das, was bleiben muss: die Vorschau zeigt weiterhin alle Kennzahlen.
     */
    expect(seasonPreviewHostText).toContain('id="standings-preview"');
    for (const kennzahl of [
      "currentPoints",
      "currentRank",
      "matchdayScore",
      "matchdayRank",
      "pointsDelta",
      "projectedPoints",
      "projectedRank",
      "resultStatus",
    ]) {
      expect(seasonPreviewNewLookText).toContain(kennzahl);
    }
    const seasonHostText = await fs.readFile(
      path.join(root, "app/foundation/season-v2/FoundationSeasonV2Host.tsx"),
      "utf8",
    );
    expect(seasonHostText).toContain("use-season-v2-data");
    expect(seasonHostText).toContain("use-season-v2-standings-derivations");
    expect(seasonHostText).toContain("use-season-v2-panel-derivations");
    const teamsHostText = await fs.readFile(
      path.join(root, "app/foundation/teams-v2/FoundationTeamsViewHost.tsx"),
      "utf8",
    );
    expect(teamsHostText).toContain("useTeamsContractDerivations");
    expect(teamsHostText).toContain("useTeamsExtendedPanelDerivations");
    expect(teamsHostText).toContain("useTeamsHydrationPhase");
    expect(teamsHostText).toContain("use-teams-panel-derivations");
    expect(foundationText).toContain("seasonV2HydrationPhase");
    expect(foundationText).toContain("shouldBuildSeasonV2PlayerRatings");
    const prefetchText = await fs.readFile(path.join(root, "lib/foundation/foundation-panel-prefetch.ts"), "utf8");
    expect(prefetchText).toContain('players: () => import("@/app/foundation/players-table/FoundationPlayersTablePanel")');
    expect(prefetchText).toContain('prefetchFoundationPanel("players")');
    expect(foundationText).toContain("useSeasonStandRows");
    expect(foundationText).toContain("shouldBuildFullSeasonStandRows");
    expect(foundationSurfaceText).toContain('activeView === "playerProfile"');
    expect(foundationSurfaceText).toContain('active={activeView === "matchdayResult"}');
    expect(foundationText).not.toContain("FoundationViewMount");
    const seasonFeedActionsText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-season-feed-actions.ts"),
      "utf8",
    );
    expect(seasonFeedActionsText).toContain("seedSeasonStandingsOverviewCache");
    expect(seasonFeedActionsText).toContain("fetchSeasonSliceJson");
    const persistenceActionsText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-persistence-actions.ts"),
      "utf8",
    );
    expect(persistenceActionsText).toContain("applyCompactSeasonArchiveSentinelIfNeeded");
    expect(persistenceActionsText).toContain("invalidatePlayerProfileSessionCache");
    expect(persistenceActionsText).toContain("invalidatePlayerAttributeSheetCache");
    /**
     * `homeV2OverviewHeavyReady` staffelt den Aufbau der HQ-Uebersicht: erst das Geruest, die
     * teuren Liga-Heat-Pools danach im Leerlauf. Bei `fd984c8` fiel die Sperre aus dem Scope, die
     * Auswertung in `shouldBuildFoundationLeagueHeatPools` blieb stehen und fiel auf `?? true`
     * zurueck — seither rechnete die Seite sofort mit. Dasselbe galt fuer `homeV2Tab`: ohne ihn
     * zaehlte jeder HQ-Unterreiter als Uebersicht und baute die Pools mit auf.
     *
     * Die frueher hier stehende Zusicherung suchte den Namen im Orchestrator-Quelltext und war
     * seitdem rot. Sie prueft jetzt die Stelle, an der die Sperre wirklich sitzt, und beide
     * Haelften der Verdrahtung.
     *
     * Nicht wiederhergestellt: `enableTopPlayerForecasts` hing an derselben Sperre, laeuft aber
     * ueber `FoundationHomeV2Host` — und der wird nur noch von `FoundationShellRouterHomeV2`
     * gerendert, den niemand mehr aufruft. Der lebende HQ-Pfad geht ueber `FoundationHomeV2Panel`.
     * Diese Haelfte haette also nichts bewirkt.
     */
    const shellScopeText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    expect(shellScopeText).toContain("const [homeV2OverviewHeavyReady, setHomeV2OverviewHeavyReady] = useState(false)");
    expect(shellScopeText).toContain("requestIdleCallback(() => setHomeV2OverviewHeavyReady(true), { timeout: 1500 })");
    expect(shellScopeText).toMatch(/homeV2Tab,\n\s*homeV2OverviewHeavyReady,/);
    // player-profile-session-cache is imported by use-foundation-persistence-actions.ts
    // (already read above as persistenceActionsText), not by the orchestrator directly.
    expect(persistenceActionsText).toContain("player-profile-session-cache");
    expect(prefetchText).toContain("prefetchMatchdayArenaBase");
    expect(prefetchText).toContain("matchday-arena-session-cache");
    expect(foundationText).toContain("marketSellBusy,");
    const inboxHostText = await fs.readFile(
      path.join(root, "app/foundation/inbox-v2/FoundationInboxV2Host.tsx"),
      "utf8",
    );
    expect(inboxHostText).toContain("use-inbox-v2-derivations");
    expect(inboxHostText).toContain("<InboxV2Client");
    expect(teamsText).toContain("marketSellBusy?: boolean");
    expect(teamsText).toContain("marketSellBusy = false");
    expect(teamsText).toContain("teamsHydrationPhase");
    expect(teamsText).toContain("showLeagueLogos");
    expect(teamsText).toContain("BudgetedMediaImage");
    expect(foundationText).toContain("seasonRatingsPlayerIds");
    expect(foundationText).toContain("resolveShouldBuildTeamsScopedRatings");
    expect(foundationText).toContain("shouldBuildSeasonStandRows");
    expect(foundationText).toContain("shouldBuildSeasonHistorySnapshots");
    expect(foundationText).toContain("shouldBuildSelectedStandingRow");
    expect(foundationText).toContain("season-v2-derivations");
    expect(teamsHostText).toContain("shouldBuildTeamsAreaRanks");
    expect(teamsHostText).toContain("teamsHydrationPhase");
  });

  it("caches lab-context payloads by save signature", () => {
    const cacheKey = buildLegacyLineupLabContextCacheKey({
      saveId: "save-a",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "H-R",
      activeOwnerId: "owner-a",
    });

    writeLegacyLineupLabContextCache(cacheKey, "sig-1", { ok: true });
    expect(readLegacyLineupLabContextCache(cacheKey, "sig-1")).toEqual({ ok: true });
    expect(readLegacyLineupLabContextCache(cacheKey, "sig-2")).toBeNull();

    invalidateLegacyLineupLabContextCache("save-a");
    expect(readLegacyLineupLabContextCache(cacheKey, "sig-1")).toBeNull();
  });

  it("memoizes usePlayerDirectorySlice ratingsById to avoid an infinite render loop", async () => {
    // Regression guard: ratingsById used to be rebuilt from `payload` on every
    // render (not memoized), which gave every downstream useMemo/useEffect in
    // use-foundation-cross-tab-player-directory.ts a "new" input each render
    // and caused a "Maximum update depth exceeded" crash on the Players tab
    // once the API payload arrived (confirmed via foundation-v9 audit).
    const sliceText = await fs.readFile(
      path.join(root, "lib/foundation/use-player-directory-slice.ts"),
      "utf8",
    );
    expect(sliceText).toContain("const ratingsById = useMemo(");
    expect(sliceText).toMatch(/useMemo\(\s*\(\)\s*=>\s*\(payload \? hydrateSeasonRatingsSliceMap\(payload\.ratingsByPlayerId\) : EMPTY_RATINGS_MAP\),\s*\[payload\],\s*\)/);
    expect(sliceText).not.toMatch(/const ratingsById = payload\s*\n?\s*\?\s*hydrateSeasonRatingsSliceMap/);
  });

  it("builds team profile content signature from gameState.rosters", async () => {
    const fileText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts"),
      "utf8",
    );
    expect(fileText).not.toContain("gameState.activeRoster");
    expect(fileText).toContain("(input.gameState.rosters ?? [])");
  });

  it("keeps the useState count in use-foundation-page-state.ts from growing back", async () => {
    // Ratsche: der Plan haelt fest, dass genau diese Absicherung zwischen
    // frueheren Aufraeumrunden gefehlt hat — Zustand wanderte an die
    // Verbrauchsstelle (Cockpit-Dup entfernt, `FoundationStateProvider`
    // verdrahtet), aber ohne Obergrenze wuchs die Wurzel bei der naechsten
    // Feature-Runde einfach wieder zu. Der Wert ist der IST-Stand nach dieser
    // Aufraeumrunde, keine willkuerliche Zielzahl — jeder neue `useState` hier
    // muss diese Zahl bewusst anheben, nicht heimlich durchrutschen.
    const pageStateText = await fs.readFile(
      path.join(root, "lib/foundation/tabs/use-foundation-page-state.ts"),
      "utf8",
    );
    // 233 -> 237, bewusst angehoben statt heimlich durchgerutscht: „Verkauf: eine Buyout-Regel,
    // ehrlicher MW-Vergleich, Sprung nach oben — plus Board-Bilanz per Zeilenklick" (#416) hat
    // genau vier Zustaende ergaenzt, die zusammengehoeren — marketSellPeekBusy, -Error, -Preview
    // und -Subject. Das ist die Vorschau, die beim Klick auf eine Board-Zeile laedt: laeuft gerade,
    // ging schief, das Ergebnis, und fuer wen. Der Nachtrag blieb damals aus, seither war diese
    // Ratsche rot. Die vier gehoerten laengerfristig eher in die Ansicht, die sie verbraucht, als
    // in die Wurzel — aber das ist ein eigener Umbau, kein Nachtragen einer Zahl.
    const useStateCallCount = (pageStateText.match(/=\s*useState[<(]/g) ?? []).length;
    expect(useStateCallCount).toBeLessThanOrEqual(237);
  });
});
