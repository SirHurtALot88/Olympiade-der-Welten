import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

/**
 * Cross-tab season derivation consumer map (Phase 4):
 *
 * | Derivation | Primary consumers |
 * |---|---|
 * | seasonStandRows | teams, homeV2, cockpit (lightweight), seasonV2, prize, matchdayArena, teamProfile, teamSettings, scoutingCenterV2, ppArea/ranks/diszis — built in `use-season-stand-rows.ts` |
 * | sortedSeasonStandRows | seasonV2 only (host hook) |
 * | selectedStandingRow | homeV2, scoutingCenterV2, teamSettings, prize, cockpit, seasonV2 |
 * | seasonFormBonusByTeamId | ppAreaRows, seasonV2 sorted standings (host), legacy saisonstand form column |
 * | ppAreaRows | ranks (FoundationRanksHost) |
 * | seasonHistorySnapshots | seasonV2, cockpit, season overview feed (prize/ranks/diszis/teams-extended) |
 * | archivedSeasonDisciplineLeaderboards | seasonV2 only (host hook) |
 * | seasonOverviewOptions / labels / selectedSeasonSnapshot | seasonV2 panel (host hook `use-season-v2-panel-derivations.ts`); parent keeps gated `buildSeasonOverviewOptions` for feed useEffect |
 */

export function shouldBuildPpAreaRows(activeView: FoundationViewId): boolean {
  return (
    activeView === "ranks" ||
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "seasonPreview" ||
    activeView === "season" ||
    activeView === "diszis"
  );
}

export function shouldBuildFullSeasonStandRows(input: {
  activeView: FoundationViewId;
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
}): boolean {
  return (
    input.shouldBuildTeamsView ||
    input.shouldBuildHomeV2Overview ||
    shouldBuildPpAreaRows(input.activeView) ||
    input.activeView === "seasonV2" ||
    input.activeView === "matchdayArena" ||
    input.activeView === "prize" ||
    input.activeView === "teamProfile" ||
    input.activeView === "teamSettings" ||
    input.activeView === "scoutingCenterV2"
  );
}

export function shouldBuildSeasonStandRows(input: {
  activeView: FoundationViewId;
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
}): boolean {
  return shouldBuildFullSeasonStandRows(input) || input.activeView === "cockpit";
}

export function shouldBuildSelectedStandingRow(input: {
  activeView: FoundationViewId;
  shouldBuildSeasonStandRows: boolean;
}): boolean {
  return input.shouldBuildSeasonStandRows;
}

export function shouldBuildSeasonHistorySnapshots(input: {
  activeView: FoundationViewId;
  shouldLoadSeasonOverviewFeedActive: boolean;
}): boolean {
  return input.shouldLoadSeasonOverviewFeedActive || input.activeView === "cockpit";
}

export function shouldBuildSeasonOverviewOptions(input: {
  shouldBuildSeasonHistorySnapshots: boolean;
}): boolean {
  return input.shouldBuildSeasonHistorySnapshots;
}

export function shouldBuildArchivedSeasonDisciplineLeaderboards(activeView: FoundationViewId): boolean {
  return activeView === "seasonV2";
}

export function shouldEnableTeamOverviewSlice(input: {
  activeView: FoundationViewId;
  shouldBuildSeasonStandRows: boolean;
}): boolean {
  return (
    input.activeView === "teams" ||
    input.activeView === "seasonV2" ||
    input.activeView === "matchdayArena" ||
    input.shouldBuildSeasonStandRows
  );
}

export function shouldBuildSeasonV2PlayerRatings(
  activeView: FoundationViewId,
  seasonV2HydrationPhase: "shell" | "full",
): boolean {
  return activeView === "seasonV2" && seasonV2HydrationPhase === "full";
}

export function shouldBuildSeasonTopPlayerRows(input: {
  shouldBuildSeasonV2PlayerRatings: boolean;
  activeView: FoundationViewId;
}): boolean {
  return (
    input.shouldBuildSeasonV2PlayerRatings ||
    input.activeView === "ranks" ||
    input.activeView === "diszis" ||
    input.activeView === "prize"
  );
}

export function shouldBuildSortedSeasonStandRows(activeView: FoundationViewId): boolean {
  return activeView === "seasonV2";
}

export function shouldBuildSeasonEndChampionRow(activeView: FoundationViewId): boolean {
  return activeView === "cockpit" || activeView === "prize";
}

export function shouldBuildDisciplineRanks(input: {
  activeView: FoundationViewId;
  shouldBuildTeamsHeavyComparison: boolean;
}): boolean {
  return (
    input.shouldBuildTeamsHeavyComparison ||
    input.activeView === "ranks" ||
    input.activeView === "seasonPreview" ||
    input.activeView === "season" ||
    input.activeView === "prize"
  );
}

export function shouldBuildDisciplineConfigDerivations(input: {
  activeView: FoundationViewId;
  shouldLoadSeasonOverviewFeed: boolean;
}): boolean {
  return input.activeView === "diszis" || input.shouldLoadSeasonOverviewFeed;
}
