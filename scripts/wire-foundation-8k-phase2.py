#!/usr/bin/env python3
"""Phase 2: wire remaining Foundation cross-tab hooks and delete inline duplicates."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "app/foundation/FoundationPageClient.tsx"


def replace_between(text: str, start: str, end: str, replacement: str, label: str, optional: bool = False) -> str:
    if start not in text:
        if optional:
            print(f"[{label}] skip (start not found)")
            return text
        raise SystemExit(f"[{label}] start marker not found: {start[:80]!r}")
    idx = text.index(start)
    if end not in text[idx:]:
        if optional:
            print(f"[{label}] skip (end not found)")
            return text
        raise SystemExit(f"[{label}] end marker not found after start")
    idx_end = text.index(end, idx)
    new_text = text[:idx] + replacement + text[idx_end:]
    print(f"[{label}] replaced {idx_end - idx} chars")
    return new_text


def delete_between(text: str, start: str, end: str, label: str, optional: bool = False) -> str:
    return replace_between(text, start, end, "", label, optional=optional)


def main() -> None:
    text = PATH.read_text()

    # Import sort worker if missing
    if "usePlayerDirectorySortWorker" not in text:
        text = text.replace(
            'import { usePlayerDirectorySlice } from "@/lib/foundation/use-player-directory-slice";',
            'import { usePlayerDirectorySlice } from "@/lib/foundation/use-player-directory-slice";\n'
            'import { usePlayerDirectorySortWorker } from "@/lib/foundation/use-player-directory-sort-worker";',
        )

    # 1. Discipline ranks hook (after season overview feed effect)
    if "useFoundationCrossTabDisciplineRanks({" not in text:
        discipline_hook = """  const {
    disciplineRankRows,
    sortedDisciplineRankRows,
    disciplineLeaderEntries,
    seasonDisciplineScheduleRows,
    seasonBriefingScheduleReady,
    currentMatchdayDisciplineSchedule,
    visibleDisciplineConfigRows,
  } = useFoundationCrossTabDisciplineRanks({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsHeavyComparison,
    shouldLoadSeasonOverviewFeed,
    isFoundationBootstrapState,
    gameState,
    activeSaveId,
    orderedDisciplines,
    disciplineCategoryFilter,
    tableSorts,
  });
  const rankLeaderCards = disciplineLeaderEntries;

"""
        text = replace_between(
            text,
            "  const disciplineRankRows = useMemo(() => {",
            "  const currentAreaRanksByTeamId = useMemo(() => {",
            discipline_hook + "  const currentAreaRanksByTeamId = useMemo(() => {",
            "discipline-ranks-hook",
        )

    # Delete duplicate discipline schedule/config blocks (between roster and buildTeamDetailDrawerData)
    text = delete_between(
        text,
        "  const seasonDisciplineScheduleRows = useMemo(\n    () => getSeasonDisciplineSchedule(gameState, { saveId: activeSaveId || \"normalized-local-save\" }),\n    [activeSaveId, gameState],\n  );\n",
        "  const buildTeamDetailDrawerData = (resolvedTeamId: string | null): TeamDetailDrawerData | null => {",
        "discipline-schedule-dup",
        optional=True,
    )

    # Delete duplicate sorted discipline rank / config memos
    text = delete_between(
        text,
        "  const sortedDisciplineRankRows = useMemo(\n    () =>\n      sortRows(disciplineRankRows, tableSorts.disciplineRanks, {",
        "  const seasonTopPlayerRows = useMemo(() => {",
        "discipline-sorted-dup",
        optional=True,
    )

    # 2. Teams roster hook
    if "useFoundationCrossTabTeamsRoster({" not in text:
        teams_roster_hook = """  const {
    selectedRosterTableRows,
    buildTeamDetailDrawerData,
    teamProfileData,
  } = useFoundationCrossTabTeamsRoster({
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
    shouldBuildMarketView,
    teamProfileTeamId,
    canonicalSeasonLabel,
    gameState,
    rosterPlayers,
    playerRatingsById,
    seasonStandRows,
    currentAreaRanksByTeamId,
    seasonPointsLedger,
    teamObjectiveOverview,
    currentMatchdayDisciplineSchedule,
  });

"""
        text = replace_between(
            text,
            "  const shouldBuildSelectedRosterTableRows =\n    shouldBuildTeamsView || shouldBuildHomeV2Overview || shouldBuildMarketView;\n",
            "  const selectedTeamsHistoryData = useMemo<TeamDetailDrawerData | null>(() => {",
            teams_roster_hook + "  const selectedTeamsHistoryData = useMemo<TeamDetailDrawerData | null>(() => {",
            "teams-roster-hook",
            optional=True,
        )

    # 3. Training hook
    if "useFoundationCrossTabTraining({" not in text:
        training_hook = """  const {
    trainingPlayerForecastRows,
    trainingForecastSummary,
    trainingDevelopmentSummary,
    filteredTrainingPlayerForecastRows,
    trainingLoadPlanByPlayerId,
    trainingPlayerRowViews,
    playerProfileTrainingRow,
    trainingFacilityRows,
    selectedTrainingFacilityPreview,
    trainingFacilityForecast,
    trainingFacilitySeasonEndFinance,
    trainingFacilityEffectPreview,
    seasonEndFacilityInput,
    seasonEndProgressionPreview,
    trainingV2ModeOptions,
  } = useFoundationCrossTabTraining({
    shouldBuildTrainingView,
    shouldBuildTrainingCompactView,
    shouldBuildTrainingFacilitiesView,
    shouldBuildPlayerProfileTrainingRow,
    gameState,
    selectedTeam,
    selectedTeamFacilityState,
    rosterPlayers,
    playerRatingsById,
    playerSeasonPerformanceMap,
    trainingModeDraft,
    trainingClassDraft,
    trainingDevelopmentFilter,
    trainingFacilityPreviewId,
    playerProfileData,
    readMeta,
    plannedXpUpgradesLength: plannedXpUpgrades.length,
    seasonEndAttributeDraft,
  });

"""
        text = replace_between(
            text,
            "  const trainingForecastPlayerLimit = useTrainingForecastLimit({",
            "  const leaguePlayerHeatPools = useMemo(() => {",
            training_hook,
            "training-hook",
            optional=True,
        )

    # 4. Player directory + market filters
    if "useFoundationCrossTabPlayerDirectory({" not in text:
        player_hook = """  const { orderedIds: playerDirectoryOrderedIds, sortRows: sortPlayerDirectoryRows } =
    usePlayerDirectorySortWorker();
  const {
    leaguePlayerHeatPools,
    playerScopeRows,
    playerClassOptions,
    playersTableScopeRows,
    playersTableRows,
    sortedPlayersTableRows,
    displayedPlayersTableRows,
    playerBracketCounts,
  } = useFoundationCrossTabPlayerDirectory({
    activeView: activeView as FoundationViewId,
    shouldBuildPlayerDirectory,
    shouldBuildMarketView,
    shouldBuildTeamHistory,
    showExtendedTeamPanels,
    selectedTeamDetailTab,
    gameState,
    playerRatingsById,
    playerDirectorySlice,
    playerScope,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    deferredPlayerTeamFilter,
    deferredPlayerClassFilter,
    deferredPlayerBracketFilter,
    tableSorts,
    playerDirectoryOrderedIds,
    sortPlayerDirectoryRows,
  });
  const {
    transferSellMarkerKeySet,
    transferWishlistEntriesForMarketV2,
    scoutingHubV2TargetSections,
    scoutingHubV2Visibility,
    hqTransferWishlistEntries,
    hqTransferSellMarkers,
    hqContractExpiringCount,
    hqTrainingFocusCount,
  } = useFoundationCrossTabMarketFilters({
    activeView: activeView as FoundationViewId,
    shouldBuildMarketView,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
    activeSaveId,
    gameState,
    selectedTeam,
    selectedTeamFacilityState,
    selectedRosterTableRows,
  });

"""
        text = replace_between(
            text,
            "  const leaguePlayerHeatPools = useMemo(() => {",
            "  const seasonModeColumns = useMemo(",
            player_hook + "  const seasonModeColumns = useMemo(",
            "player-directory-market-filters",
            optional=True,
        )

    # Delete scattered player directory duplicates
    text = delete_between(
        text,
        "  const playersTableRows = useMemo(() => {\n    return playerScopeRows",
        "  const historyPlayerById = useMemo(",
        "players-table-rows-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const sortedPlayersTableRows = useMemo(\n    () => {\n      if (!shouldBuildPlayerDirectory) {",
        "  const sortedTeamsViewRows = useMemo(",
        "sorted-players-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const transferWishlistEntriesForMarketV2 = useMemo(() => {",
        "  const rosterPlayersByOvr = useMemo(",
        "transfer-wishlist-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const scoutingHubV2TargetSections = useMemo(() => {",
        "  const scoutingHubV2Visibility = useMemo(() => {",
        "scouting-hub-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const scoutingHubV2Visibility = useMemo(() => {\n    const scoutingLevel = getFacilityLevel(selectedTeamFacilityState, \"scouting_office\");",
        "  const inboxV2Items = useMemo(",
        "scouting-visibility-dup",
        optional=True,
    )

    # 5. Matchday lineup hook
    if "useFoundationCrossTabMatchdayLineup({" not in text:
        matchday_hook = """  const {
    homeCurrentLineupDraft,
    currentMatchdayLineupDrafts,
    currentMatchdayRequiredLineupSlots,
    isCurrentMatchdayLineupComplete,
    aiLineupMissingTeamIds,
    activeManagerLineupReady,
    activeManagerLineupSubmitted,
    homeNextMatchdayStatus,
    matchdaySummaryOptions,
    activeMatchdaySummaryId,
    matchdaySummary,
    activeTeamMatchdaySummaryRow,
    ensureAiLineupsForCurrentMatchday,
  } = useFoundationCrossTabMatchdayLineup({
    activeView,
    gameState,
    activeManagerTeamId,
    aiLineupEnsureTeams,
    currentMatchdayDisciplineSchedule,
    selectedMatchdaySummaryId,
    activeSaveId,
    readMetaSource: readMeta.source,
    readMetaReadOnly: readMeta.readOnly,
    roomContext,
    foundationSaveMode,
    aiLineupEnsureBusy,
    setAiLineupEnsureBusy,
    setAiLineupEnsureFeed,
    loadSave,
  });

"""
        text = replace_between(
            text,
            "  const matchdaySummaryOptions = useMemo(() => getMatchdaySummaryOptions(gameState, gameState.season.id), [gameState]);\n",
            "  const currentSeasonRankDeltaByTeamId = useMemo(",
            matchday_hook + "  const currentSeasonRankDeltaByTeamId = useMemo(",
            "matchday-lineup-hook",
            optional=True,
        )

    text = delete_between(
        text,
        "  const activeTeamMatchdaySummaryRow = useMemo(\n    () => matchdaySummary.teamRows.find((row) => row.teamId === activeManagerTeamId) ?? null,\n    [activeManagerTeamId, matchdaySummary.teamRows],\n  );\n",
        "  const hasSeasonResultsForHome = useMemo(",
        "matchday-summary-row-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const homeCurrentLineupDraft = useMemo(",
        "  const handleFormCardPlanSaved = (payload: {",
        "matchday-lineup-inline-dup",
        optional=True,
    )

    # 6. Season briefing hook
    if "useFoundationCrossTabSeasonBriefing({" not in text:
        season_briefing_hook = """  const {
    localSeasonTransitionGate,
    seasonSetupFlow,
    seasonBriefingData,
    seasonReadinessChecklist,
  } = useFoundationCrossTabSeasonBriefing({
    activeView,
    activeSaveId,
    activeManagerTeamId,
    gameState,
    selectedTeam,
    rosterPlayers,
    selectedTeamFacilityState,
    selectedTeamSponsorContract,
    currentMatchdayDisciplineSchedule,
    homeNextMatchdayStatus,
    seasonDisciplineScheduleRows,
    prizePreviewFeed,
  });

"""
        text = replace_between(
            text,
            "  const localSeasonTransitionGate = useMemo(() => {",
            "  const scrollSeasonTableToColumn = (columnId: string) => {",
            season_briefing_hook + "  const scrollSeasonTableToColumn = (columnId: string) => {",
            "season-briefing-hook",
            optional=True,
        )

    text = delete_between(
        text,
        "  const seasonSetupFlow = useMemo(() => {",
        "  const seasonBriefingTeamAxes = selectedIdentity",
        "season-setup-flow-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const seasonBriefingData = useMemo(() => {",
        "  const seasonBriefingTeamAxes = selectedIdentity",
        "season-briefing-data-dup",
        optional=True,
    )

    # 7. Remove duplicate season-end roster actions (provided by screen-primary-action hook)
    text = delete_between(
        text,
        "  const seasonEndRosterActionsActive = useMemo(() => {\n    const phase = gameState.gamePhase ?? \"season_active\";",
        "  const hqContractExpiringCount = useMemo(",
        "season-end-roster-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const hqContractExpiringCount = useMemo(\n    () => selectedRosterTableRows.filter((row) => row.entry.contractLength <= 1).length,\n    [selectedRosterTableRows],\n  );\n",
        "  const hqTrainingFocusCount = useMemo(",
        "hq-contract-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const hqTrainingFocusCount = useMemo(\n    () =>\n      selectedRosterTableRows.filter(\n        (row) => (row.player.currentXP ?? 0) > 0 || (row.player.fatigue ?? 0) > 0,\n      ).length,\n    [selectedRosterTableRows],\n  );\n",
        "  const hqTransferWishlistEntries = useMemo(",
        "hq-training-dup",
        optional=True,
    )
    text = delete_between(
        text,
        "  const hqTransferWishlistEntries = useMemo(",
        "  const sortedSelectedRosterTableRows = useMemo(",
        "hq-transfer-dup",
        optional=True,
    )

    # 8. Foundation activities
    if "useFoundationCrossTabFoundationActivities({" not in text:
        fa_repl = """  const foundationActivities = useFoundationCrossTabFoundationActivities({
    isSaveBusy,
    aiPreseasonBusy,
    aiPreseasonDisplayRun,
    aiLineupEnsureBusy,
    aiLineupEnsureTeamsCount: aiLineupEnsureTeams.length,
    aiLineupMissingTeamIdsCount: aiLineupMissingTeamIds.length,
    aiLineupEnsureFeed,
    adminSimulationBusy,
    adminSimulationRun,
    seasonTransitionBusy,
    preSeasonWorkflowBusy,
    seasonStartResetBusy,
    newGameBusy,
    rosterFillBusy,
    adminBalancingBusy,
    cockpitBusyKey,
    aiTeamsCount: aiTeams.length,
  });

"""
        text = replace_between(
            text,
            "  const foundationActivities = useMemo(\n    () =>\n      buildFoundationActivities({",
            "  const foundationShellRouterBodyProps = {",
            fa_repl + "  const foundationShellRouterBodyProps = {",
            "foundation-activities",
            optional=True,
        )

    # Fix duplicate showCompactHeader
    while "  const showCompactHeader = activeView !== \"home\";\n  const showCompactHeader = activeView !== \"home\";" in text:
        text = text.replace(
            "  const showCompactHeader = activeView !== \"home\";\n  const showCompactHeader = activeView !== \"home\";",
            "  const showCompactHeader = activeView !== \"home\";",
        )

    # Trim re-export barrel
    barrel_marker = "\nexport {\n  ClassColorChip,"
    type_marker = "\nexport type {"
    if barrel_marker in text and type_marker in text:
        idx = text.index(barrel_marker)
        type_idx = text.index(type_marker, idx)
        text = (
            text[:idx]
            + """

export {
  setFoundationView,
  syncFoundationViewInUrl,
};

"""
            + text[type_idx:]
        )
        print("[barrel] trimmed re-exports")

    PATH.write_text(text)
    print("final lines:", len(text.splitlines()))


if __name__ == "__main__":
    main()
