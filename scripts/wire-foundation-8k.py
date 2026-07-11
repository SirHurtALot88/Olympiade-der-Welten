#!/usr/bin/env python3
"""Apply Foundation 8k cross-tab hook wirings (Phase 5.7)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "app/foundation/FoundationPageClient.tsx"


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    if start not in text:
        raise SystemExit(f"[{label}] start marker not found")
    idx = text.index(start)
    if end not in text[idx:]:
        raise SystemExit(f"[{label}] end marker not found after start")
    idx_end = text.index(end, idx)
    new_text = text[:idx] + replacement + text[idx_end:]
    print(f"[{label}] replaced {idx_end - idx} chars")
    return new_text


def delete_between(text: str, start: str, end: str, label: str) -> str:
    return replace_between(text, start, end, "", label)


def main() -> None:
    text = PATH.read_text()

    # Gate helpers after shouldLoadSeasonOverviewFeedActive
    gate_anchor = "  const isFoundationBootstrapState = gameState.season.id === \"loading\" || selectedTeamId === \"loading-team\";"
    if "const shouldBuildTeamsView =" not in text:
        gate_block = """
  const shouldBuildTeamsView = activeView === "teams";
  const shouldBuildSeasonStandRowsGate = shouldBuildSeasonStandRows({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
  });
  const shouldBuildFullSeasonStandRowsGate = shouldBuildFullSeasonStandRows({
    activeView: activeView as FoundationViewId,
    shouldBuildTeamsView,
    shouldBuildHomeV2Overview,
  });
  const shouldBuildSelectedStandingRowGate = shouldBuildSelectedStandingRow({
    activeView: activeView as FoundationViewId,
    shouldBuildSeasonStandRows: shouldBuildSeasonStandRowsGate,
  });
  const shouldBuildSeasonHistorySnapshotsGate = shouldBuildSeasonHistorySnapshots({
    activeView: activeView as FoundationViewId,
    shouldLoadSeasonOverviewFeedActive,
  });
  const shouldBuildSeasonOverviewOptionsGate = shouldBuildSeasonOverviewOptions({
    shouldBuildSeasonHistorySnapshots: shouldBuildSeasonHistorySnapshotsGate,
  });
  const shouldBuildPpAreaRowsGate = shouldBuildPpAreaRows(activeView as FoundationViewId);
  const shouldBuildSeasonFormBonusGate =
    shouldBuildPpAreaRowsGate || activeView === "seasonV2" || shouldBuildTeamsView;
"""
        text = text.replace(gate_anchor, gate_anchor + gate_block)

    text = text.replace("if (!shouldBuildSeasonStandRows)", "if (!shouldBuildSeasonStandRowsGate)")
    text = text.replace("shouldBuildSelectedStandingRow\n        ?", "shouldBuildSelectedStandingRowGate\n        ?")
    text = text.replace("[seasonStandRows, selectedTeam, shouldBuildSelectedStandingRow]", "[seasonStandRows, selectedTeam, shouldBuildSelectedStandingRowGate]")
    text = text.replace("shouldBuildSeasonFormBonus\n        ?", "shouldBuildSeasonFormBonusGate\n        ?")
    text = text.replace("[gameState, seasonOverviewSeasonId, shouldBuildSeasonFormBonus]", "[gameState, seasonOverviewSeasonId, shouldBuildSeasonFormBonusGate]")
    text = text.replace("if (!shouldBuildPpAreaRows)", "if (!shouldBuildPpAreaRowsGate)")
    text = text.replace("[seasonFormBonusByTeamId, seasonStandRows, shouldBuildPpAreaRows]", "[seasonFormBonusByTeamId, seasonStandRows, shouldBuildPpAreaRowsGate]")
    text = text.replace("if (!shouldBuildSeasonOverviewOptions)", "if (!shouldBuildSeasonOverviewOptionsGate)")
    text = text.replace("[gameState.season.id, gameState.season.name, seasonHistorySnapshots, shouldBuildSeasonOverviewOptions]", "[gameState.season.id, gameState.season.name, seasonHistorySnapshots, shouldBuildSeasonOverviewOptionsGate]")

    # Season prize hook
    season_prize_hook = """  const {
    ppAreaRows,
    seasonHistorySnapshots,
    seasonOverviewOptions,
    sortedPpAreaRows,
    ppAreaRankClassMaps,
    ppAreaMetricPools,
    prizePreviewHardBlocked,
    selectedPrizePreviewRow,
    seasonEndChampionRow,
    currentSeasonCashPrizeApplyLogs,
    prizeApplyState,
    prizeAuditCompact,
  } = useFoundationCrossTabSeasonPrize({
    activeView: activeView as FoundationViewId,
    shouldBuildPpAreaRows: shouldBuildPpAreaRowsGate,
    shouldBuildSeasonHistorySnapshots: shouldBuildSeasonHistorySnapshotsGate,
    shouldBuildSeasonOverviewOptions: shouldBuildSeasonOverviewOptionsGate,
    shouldLoadPrizePreviewFeed,
    gameState,
    seasonStandRows,
    seasonFormBonusByTeamId,
    tableSorts,
    prizePreviewFeed,
    cashApplyFeed,
    selectedTeam,
  });

"""
    if "useFoundationCrossTabSeasonPrize({" not in text:
        text = replace_between(
            text,
            "  const ppAreaRows = useMemo(",
            "  const selectedSeasonSnapshot = useMemo(",
            season_prize_hook,
            "season-prize",
        )

    # Remove duplicate prize preview core memos (keep V2 forecast memos)
    if "const prizePreviewRows = useMemo(() => prizePreviewFeed" in text:
        text = delete_between(
            text,
            "  const prizePreviewRows = useMemo(() => prizePreviewFeed?.items ?? [], [prizePreviewFeed]);\n",
            "  useEffect(() => {\n    if (!shouldBuildPrizeV2Ui)",
            "prize-preview-core",
        )

    # Remove duplicate sorted pp area memos
    if "  const sortedPpAreaRows = useMemo(\n    () =>\n      sortRows(ppAreaRows" in text:
        text = delete_between(
            text,
            "  const sortedPpAreaRows = useMemo(\n    () =>\n      sortRows(ppAreaRows",
            "  const seasonTopPlayerRows = useMemo(() => {",
            "sorted-pp-area",
        )

    # Command palette + flow coach
    if "const foundationCommandItems = useMemo<FoundationCommandItem[]>(() => {" in text:
        cmd_repl = """  const { foundationCommandItems, visibleFoundationCommandItems } = useFoundationCrossTabCommandPalette({
    activeView,
    activeManagerTeamId,
    commandSearch,
    gameState,
    globalNextLabel,
    globalNextStatusClass,
    gameFlowActionStepCta: gameFlowActionStep.cta,
    isTransferMarketViewActive,
    primaryInboxItem,
    selectedEncyclopediaEntryId,
    triggerGlobalNext,
    openFoundationViewCommand,
    openTeamDrawerById,
    openPlayerDrawerById,
    openEncyclopediaEntry,
  });
  const { activeFlowCoach, foundationFlowLoopStages, activeFlowLoopIndex } = useFoundationCrossTabFlowCoach({
    activeView,
    homeV2Tab,
    globalNextLabel,
    globalNextTitle,
  });

  const selectedEncyclopediaEntry ="""
        text = replace_between(
            text,
            "  const foundationCommandItems = useMemo<FoundationCommandItem[]>(() => {",
            "  const selectedEncyclopediaEntry =",
            cmd_repl,
            "command-palette-flow-coach",
        )

    # Screen primary action
    if "const screenPrimaryAction = useMemo<FoundationScreenPrimaryAction | null>(() => {" in text:
        spa_repl = """  const {
    shouldShowArenaBackToLineup,
    seasonEndRosterActionsActive,
    selectedTeamRosterActionsAvailable,
    selectedTeamRosterActionHint,
    screenPrimaryAction,
    readOnlyBannerMessage,
  } = useFoundationCrossTabScreenPrimaryAction({
    activeView,
    activeManagerMatchdayReady,
    activeManagerArenaBlockerReason,
    gameState,
    readMeta,
    localSeasonTransitionGate,
    marketTeamId,
    marketBuyBusy,
    marketPreviewPlayer,
    marketSelectedTeam,
    selectedTeam,
    selectedTeamCanManage,
    selectedTeamHasUnsavedChanges,
    isSelectedTeamManagementLocked,
    inboxPrimaryTeamItem,
    canManageTeamId,
    setFoundationView,
    setActiveView,
    navigateHomeTab,
    navigateToInboxItem,
    openMarketOfferPanel,
  });

  const showCompactHeader = activeView !== \"home\";"""
        if "const shouldShowArenaBackToLineup = !activeManagerMatchdayReady;" in text:
            text = replace_between(
                text,
                "  const shouldShowArenaBackToLineup = !activeManagerMatchdayReady;",
                "  const showCompactHeader = activeView !== \"home\";",
                spa_repl,
                "screen-primary-action",
            )

    # Foundation activities
    if "const foundationActivities = useMemo(" in text and "useFoundationCrossTabFoundationActivities({" not in text:
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

  const foundationStateContextValue = useFoundationStateContextValue({"""
        text = replace_between(
            text,
            "  const foundationActivities = useMemo(",
            "  const foundationStateContextValue = useMemo<FoundationStateContextValue>(",
            fa_repl,
            "foundation-activities",
        )
        # Remove old useMemo body for state context
        if "const foundationStateContextValue = useFoundationStateContextValue({" in text:
            text = replace_between(
                text,
                "  const foundationStateContextValue = useFoundationStateContextValue({",
                "  const foundationShellRouterBodyProps: FoundationShellRouterBodyProps = {",
                """  const foundationStateContextValue = useFoundationStateContextValue({
    gameState,
    setGameState,
    activeSaveId,
    activeSaveName,
    foundationSaveMode,
    readMeta,
    selectedTeamId,
    activeManagerTeamId,
    isFoundationBootstrapState,
    foundationManageableTeamIds,
    loadSave,
    reloadLiveSeasonState,
  });

  const foundationShellRouterBodyProps: FoundationShellRouterBodyProps = {""",
                "state-context",
            )

    # Fix helper name references in props
    text = text.replace("getBusyActionReason,", "getBusyActionReason: getFoundationBusyActionReason,")
    text = text.replace("getCockpitBusyReason,", "getCockpitBusyReason: getFoundationCockpitBusyReason,")
    text = text.replace("getReadOnlyActionReason,", "getReadOnlyActionReason: getFoundationReadOnlyActionReason,")

    # Trim re-export barrel: keep only types and minimal exports
    barrel_start = "\nexport {\n  ActiveManagerTeamContext,"
    if barrel_start in text:
        barrel_end = "};\n\nexport type {"
        idx = text.index(barrel_start)
        idx_end = text.index(barrel_end, idx)
        slim_barrel = """

export {
  setFoundationView,
  syncFoundationViewInUrl,
};

export type {"""
        text = text[:idx] + slim_barrel + text[idx_end + len("export type {") - len("export type {") :]
        # fix botched slice - redo cleanly
        idx = text.rfind("\nexport {\n  setFoundationView,")
        if idx == -1:
            idx = text.rfind("\nexport {")
        type_idx = text.rfind("\nexport type {")
        if idx != -1 and type_idx != -1 and type_idx > idx:
            text = text[:idx] + """

export {
  setFoundationView,
  syncFoundationViewInUrl,
};

""" + text[type_idx:]

    PATH.write_text(text)
    print("final lines:", len(text.splitlines()))


if __name__ == "__main__":
    main()
