"use client";

import { useMemo, useState } from "react";

import FoundationCockpitPanel, {
  type FoundationCockpitPanelProps,
} from "@/app/foundation/cockpit-v2/FoundationCockpitPanel";
import type { FeatureAuditFilter } from "@/lib/foundation/feature-audit-matrix";
import type {
  MultiSeasonBalanceEconomyRow,
  MultiSeasonBalanceGameplayRow,
  MultiSeasonBalancePlayerRow,
  MultiSeasonBalanceTeamRow,
} from "@/lib/foundation/multiseason-balance-dashboard";
import { useFoundationShared } from "@/lib/foundation/foundation-shared-context";
import {
  createCockpitAiBatchHandlers,
  createCockpitMatchdayApplyHandlers,
  createCockpitPreseasonHandlers,
  createCockpitSeasonTransitionHandlers,
  type CockpitAiBatchHandlersDeps,
  type CockpitMatchdayApplyHandlersDeps,
  type CockpitPreseasonHandlersDeps,
  type CockpitSeasonTransitionHandlersDeps,
} from "@/lib/foundation/tabs/cockpit-handlers";
import { formatCockpitReason } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import {
  useCockpitPanelDerivations,
  type UseCockpitPanelDerivationsInput,
} from "@/lib/foundation/tabs/use-cockpit-panel-derivations";

/**
 * Cockpit host (Strangler Phase 1.6). Owns the cockpit-only status derivations
 * so they only run while the cockpit view is mounted (activeView === "cockpit").
 * Raw feeds/state flow in as props; the derived cockpit*Status values are
 * computed here and forwarded to the dumb panel.
 */
type FoundationCockpitHostComputedKey =
  | "cockpitSaveStatus"
  | "cockpitFreshSeasonStatus"
  | "cockpitTransfermarktStatus"
  | "cockpitLineupStatus"
  | "cockpitAiLineupStatus"
  | "cockpitResolveStatus"
  | "cockpitResultApplyStatus"
  | "cockpitStandingsPreviewStatus"
  | "cockpitStandingsApplyStatus"
  | "cockpitPrizePreviewStatus"
  | "cockpitCashApplyStatus"
  | "cockpitSeasonSnapshotStatus"
  | "cockpitMatchdayAdvanceStatus"
  | "cockpitAutoRunStatus"
  | "cockpitWholeSeasonDryRunStatus"
  | "cockpitMatchdayMvpScoringStatus"
  | "cockpitFlowChecklist"
  | "cockpitOverallStatus";

type FoundationCockpitHostDerivedKey =
  | "cockpitQuickLinks"
  | "featureAuditFilter"
  | "featureAuditMatrix"
  | "filteredFeatureAuditEntries"
  | "lineupModifierStatusSummary"
  | "lineupStatusSummary"
  | "multiSeasonBalanceDashboard"
  | "multiSeasonEconomyColumns"
  | "multiSeasonGameplayColumns"
  | "multiSeasonPlayerColumns"
  | "multiSeasonTeamBalanceColumns"
  | "renderMultiSeasonEconomyCell"
  | "renderMultiSeasonGameplayCell"
  | "renderMultiSeasonPlayerCell"
  | "renderMultiSeasonTeamCell"
  | "setFeatureAuditFilter"
  | "sortedMultiSeasonEconomyRows"
  | "sortedMultiSeasonGameplayRows"
  | "sortedMultiSeasonPlayerRows"
  | "sortedMultiSeasonTeamRows"
  | "visibleMultiSeasonEconomyColumns"
  | "visibleMultiSeasonGameplayColumns"
  | "visibleMultiSeasonPlayerColumns"
  | "visibleMultiSeasonTeamBalanceColumns";

type FoundationCockpitHostHandlerKey =
  | "runCockpitAiLineupBatchApply"
  | "runCockpitRosterFill"
  | "runCockpitCashApply"
  | "runCockpitMatchdayAdvance"
  | "runCockpitMatchdayAutoRun"
  | "runCockpitMatchdayMvpScoring"
  | "runCockpitResultApply"
  | "runCockpitStandingsApply"
  | "runCockpitWholeSeasonDryRun"
  | "runPreSeasonNextSeasonSetup"
  | "runPreSeasonWorkflowPreview"
  | "refreshSeasonCockpit"
  | "runSeasonCompletion"
  | "runSeasonSnapshotAction"
  | "runSeasonTransition";

export type FoundationCockpitHostAiBatchDeps = Pick<
  CockpitAiBatchHandlersDeps,
  | "buildCockpitScopeParams"
  | "roomContext"
  | "marketAiApplyIncludeWarnings"
  | "reloadAfterMarketRosterApply"
  | "reloadResolvePreview"
  | "setMarketAiApplyBusy"
  | "setMarketAiApplyFeed"
  | "setRosterFillBusy"
  | "setRosterFillFeed"
  | "showReadOnlyNotice"
>;

export type FoundationCockpitHostMatchdayDeps = Omit<
  CockpitMatchdayApplyHandlersDeps,
  "readMetaSource" | "setCockpitBusyKey" | "seasonId" | "matchdayId" | "firstMatchdayId"
>;

export type FoundationCockpitHostPreseasonDeps = Omit<
  CockpitPreseasonHandlersDeps,
  "readMetaSource" | "setCockpitBusyKey" | "preSeasonWorkflowFeed"
>;

export type FoundationCockpitHostSeasonTransitionDeps = Omit<
  CockpitSeasonTransitionHandlersDeps,
  | "readMetaSource"
  | "setCockpitBusyKey"
  | "seasonId"
  | "wholeSeasonMaxMatchdays"
  | "wholeSeasonIncludeWarningLineups"
  | "wholeSeasonOverwriteExistingLineups"
  | "wholeSeasonStopOnTie"
>;

export type FoundationCockpitHostProps = Omit<
  FoundationCockpitPanelProps,
  FoundationCockpitHostComputedKey | FoundationCockpitHostDerivedKey | FoundationCockpitHostHandlerKey
> & {
  freshSeasonStartMessage: string | null;
  marketTeamId: string;
  prizePreviewHardBlocked: string[];
  tableColumnPreferences: UseCockpitPanelDerivationsInput["tableColumnPreferences"];
  getTablePinnedLeftIds: UseCockpitPanelDerivationsInput["getTablePinnedLeftIds"];
  getTablePinnedRightIds: UseCockpitPanelDerivationsInput["getTablePinnedRightIds"];
  aiBatchDeps: FoundationCockpitHostAiBatchDeps;
  matchdayDeps: FoundationCockpitHostMatchdayDeps;
  preseasonDeps: FoundationCockpitHostPreseasonDeps;
  seasonTransitionDeps: FoundationCockpitHostSeasonTransitionDeps;
  wholeSeasonMaxMatchdays: number;
};

export default function FoundationCockpitHost(props: FoundationCockpitHostProps) {
  const {
    freshSeasonStartMessage,
    marketTeamId,
    prizePreviewHardBlocked,
    tableColumnPreferences,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    aiBatchDeps,
    matchdayDeps,
    preseasonDeps,
    seasonTransitionDeps,
    wholeSeasonMaxMatchdays,
    formatLocalePoints,
    formatMoney,
    ...panelProps
  } = props;
  const [featureAuditFilter, setFeatureAuditFilter] = useState<FeatureAuditFilter>("all");
  const panelDerivations = useCockpitPanelDerivations({
    gameState: panelProps.gameState,
    resolvePreviewFeed: panelProps.resolvePreviewFeed,
    featureAuditFilter,
    tableColumnPreferences,
    tableSorts: panelProps.tableSorts,
    isTableColumnVisible: panelProps.isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
  });

  const renderMultiSeasonTeamCell = (row: MultiSeasonBalanceTeamRow, columnId: string) => {
    if (columnId === "team") return <strong>{row.teamCode}</strong>;
    if (columnId === "seasons") return row.seasons;
    if (columnId === "champions") return row.championCount;
    if (columnId === "avgRank") return row.averageRank != null ? formatLocalePoints(row.averageRank, 1) : "—";
    if (columnId === "bestRank") return row.bestRank ?? "—";
    if (columnId === "worstRank") return row.worstRank ?? "—";
    if (columnId === "rankDelta") return row.rankDelta != null ? formatLocalePoints(row.rankDelta, 0) : "—";
    if (columnId === "avgPoints") return row.averagePoints != null ? formatLocalePoints(row.averagePoints, 1) : "—";
    if (columnId === "top5") return row.top5Count;
    if (columnId === "bottom5") return row.bottom5Count;
    if (columnId === "points") return row.pointsBySeason;
    if (columnId === "source") return row.source;
    return "—";
  };

  const renderMultiSeasonEconomyCell = (row: MultiSeasonBalanceEconomyRow, columnId: string) => {
    if (columnId === "team") return <strong>{row.teamCode}</strong>;
    if (columnId === "cash") return row.cashCurrent != null ? formatMoney(row.cashCurrent) : "—";
    if (columnId === "cashAvg") return row.cashEndAverage != null ? formatMoney(row.cashEndAverage) : "—";
    if (columnId === "cashMax") return row.cashMax != null ? formatMoney(row.cashMax) : "—";
    if (columnId === "salary") return row.salaryCurrent != null ? formatMoney(row.salaryCurrent) : "—";
    if (columnId === "salaryRatio") return row.salaryRatio != null ? formatLocalePoints(row.salaryRatio, 2) : "—";
    if (columnId === "transferSpend") return formatMoney(row.transferSpend);
    if (columnId === "transferIncome") return formatMoney(row.transferIncome);
    if (columnId === "transferNet") return formatMoney(row.transferNet);
    if (columnId === "facilityNet") return formatMoney(row.facilityNet);
    if (columnId === "warning") return row.warning ? <span className="pill is-warning">{row.warning}</span> : "—";
    return "—";
  };

  const renderMultiSeasonPlayerCell = (row: MultiSeasonBalancePlayerRow, columnId: string) => {
    if (columnId === "player") return <strong>{row.playerName}</strong>;
    if (columnId === "team") return row.teamName ?? row.teamId ?? "—";
    if (columnId === "seasons") return row.seasons;
    if (columnId === "points") return row.totalPoints != null ? formatLocalePoints(row.totalPoints, 1) : "—";
    if (columnId === "avg") return row.averageContribution != null ? formatLocalePoints(row.averageContribution, 2) : "—";
    if (columnId === "top10") return row.top10Count;
    if (columnId === "mvp") return row.mvpCount;
    if (columnId === "xp") return row.xpSpent || "—";
    if (columnId === "attrDelta") return row.attributeDelta || "—";
    if (columnId === "mwDelta") return row.marketValueDelta != null ? formatMoney(row.marketValueDelta) : "—";
    if (columnId === "salaryDelta") return row.salaryPreviewDelta != null ? formatMoney(row.salaryPreviewDelta) : "—";
    if (columnId === "value") return row.valueSignal != null ? formatLocalePoints(row.valueSignal, 2) : "—";
    return "—";
  };

  const renderMultiSeasonGameplayCell = (row: MultiSeasonBalanceGameplayRow, columnId: string) => {
    if (columnId === "metric") return <strong>{row.metric}</strong>;
    if (columnId === "value") return row.value;
    if (columnId === "signal") return row.signal != null ? formatLocalePoints(row.signal, 2) : "—";
    if (columnId === "warning") return row.warning ? <span className="pill is-warning">{row.warning}</span> : "—";
    if (columnId === "source") return row.source;
    return "—";
  };
  const {
    cockpitAiBatchApplyFeed,
    cockpitAiIncludeWarningTeams,
    cockpitAiOverwriteExisting,
    setCockpitAiBatchApplyFeed,
    setCockpitBusyKey,
  } = useFoundationShared();

  const aiBatchHandlers = useMemo(
    () =>
      createCockpitAiBatchHandlers({
        readMetaSource: panelProps.readMeta.source,
        setCockpitBusyKey,
        cockpitAiIncludeWarningTeams,
        cockpitAiOverwriteExisting,
        setCockpitAiBatchApplyFeed,
        ...aiBatchDeps,
      }),
    [
      aiBatchDeps,
      cockpitAiIncludeWarningTeams,
      cockpitAiOverwriteExisting,
      panelProps.readMeta.source,
      setCockpitAiBatchApplyFeed,
      setCockpitBusyKey,
    ],
  );

  const matchdayHandlers = useMemo(
    () =>
      createCockpitMatchdayApplyHandlers({
        readMetaSource: panelProps.readMeta.source,
        setCockpitBusyKey,
        seasonId: panelProps.gameState.season.id,
        matchdayId: panelProps.gameState.matchdayState.matchdayId,
        firstMatchdayId: panelProps.gameState.season.matchdayIds[0] ?? panelProps.gameState.matchdayState.matchdayId,
        ...matchdayDeps,
      }),
    [
      matchdayDeps,
      panelProps.gameState.matchdayState.matchdayId,
      panelProps.gameState.season.id,
      panelProps.gameState.season.matchdayIds,
      panelProps.readMeta.source,
      setCockpitBusyKey,
    ],
  );

  const preseasonHandlers = useMemo(
    () =>
      createCockpitPreseasonHandlers({
        readMetaSource: panelProps.readMeta.source,
        setCockpitBusyKey,
        preSeasonWorkflowFeed: panelProps.preSeasonWorkflowFeed,
        ...preseasonDeps,
      }),
    [
      panelProps.preSeasonWorkflowFeed,
      panelProps.readMeta.source,
      preseasonDeps,
      setCockpitBusyKey,
    ],
  );

  const seasonTransitionHandlers = useMemo(
    () =>
      createCockpitSeasonTransitionHandlers({
        readMetaSource: panelProps.readMeta.source,
        setCockpitBusyKey,
        seasonId: panelProps.gameState.season.id,
        wholeSeasonMaxMatchdays,
        wholeSeasonIncludeWarningLineups: panelProps.wholeSeasonIncludeWarningLineups,
        wholeSeasonOverwriteExistingLineups: panelProps.wholeSeasonOverwriteExistingLineups,
        wholeSeasonStopOnTie: panelProps.wholeSeasonStopOnTie,
        ...seasonTransitionDeps,
      }),
    [
      panelProps.gameState.season.id,
      panelProps.readMeta.source,
      panelProps.wholeSeasonIncludeWarningLineups,
      panelProps.wholeSeasonOverwriteExistingLineups,
      panelProps.wholeSeasonStopOnTie,
      seasonTransitionDeps,
      setCockpitBusyKey,
      wholeSeasonMaxMatchdays,
    ],
  );
  const {
    aiLineupApplyTeams,
    aiTeams,
    cashApplyFeed,
    currentSeasonCashPrizeApplyLogs,
    gameState,
    historyFeed,
    marketFeed,
    matchdayAdvanceFeed,
    matchdayAutoRunFeed,
    matchdayMvpScoringFeed,
    prizePreviewFeed,
    readMeta,
    resolvePreviewFeed,
    resultApplyFeed,
    seasonSnapshotFeed,
    seasonStandRows,
    standingsApplyFeed,
    standingsPreviewFeed,
    wholeSeasonDryRunFeed,
  } = panelProps;
  const { lineupStatusSummary } = panelDerivations;

  const cockpitSaveStatus = useMemo(() => {
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma/Supabase ist hier nur Referenz. Apply-Aktionen bleiben gesperrt.",
      };
    }
    if (gameState.teams.length === 32) {
      return {
        status: "ready" as const,
        message: "Lokaler Testspielstand ist aktiv und vollstaendig geladen.",
      };
    }
    return {
      status: "warning" as const,
      message: "Der lokale Save ist geladen, aber die Teamanzahl weicht vom 32-Team-Contract ab.",
    };
  }, [gameState.teams.length, readMeta.source]);

  const cockpitFreshSeasonStatus = useMemo(() => {
    const totalTeams = seasonStandRows.length;
    const zeroPointTeams = seasonStandRows.filter((row) => (row.points ?? 0) === 0).length;
    const budgetAlignedTeams = seasonStandRows.filter(
      (row) => row.budget != null && row.cash != null && Number(row.budget.toFixed(2)) === Number(row.cash.toFixed(2)),
    ).length;
    const hasTransfers = (historyFeed?.items.length ?? 0) > 0 || gameState.transferHistory.length > 0;
    const hasStoredResults = (gameState.seasonState.matchdayResults?.length ?? 0) > 0;

    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Fresh Season 1 kann nur lokal gestartet und bewertet werden.",
      };
    }

    if (
      totalTeams === 32 &&
      zeroPointTeams === totalTeams &&
      budgetAlignedTeams === totalTeams &&
      !hasTransfers &&
      !hasStoredResults
    ) {
      return {
        status: "ready" as const,
        message: "Der aktive Save sieht wie ein frischer Season-1-Start aus: Cash = Budget, Punkte = 0.",
      };
    }

    if (freshSeasonStartMessage) {
      return {
        status: "applied" as const,
        message: freshSeasonStartMessage,
      };
    }

    return {
      status: "warning" as const,
      message: "Der aktive Save ist bereits benutzt oder nicht mehr auf frischem Season-1-Stand.",
    };
  }, [freshSeasonStartMessage, gameState.seasonState.matchdayResults, gameState.transferHistory.length, historyFeed, readMeta.source, seasonStandRows]);

  const cockpitTransfermarktStatus = useMemo(() => {
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma bleibt read-only. Testkaeufe laufen nur im lokalen SQLite-Save.",
      };
    }

    if (!marketFeed) {
      return {
        status: "open" as const,
        message: "Transfermarkt-Feed noch nicht geladen.",
      };
    }

    if (!marketTeamId) {
      return {
        status: "open" as const,
        message: "Team waehlen, damit Kaufvorschau, Cash und Roster-Druck bewertet werden koennen.",
      };
    }

    if (!marketFeed.teamContext) {
      return {
        status: "warning" as const,
        message: "Teamkontext fehlt noch. Feed neu laden oder Team erneut waehlen.",
      };
    }

    if ((marketFeed.items?.length ?? 0) === 0) {
      return {
        status: "warning" as const,
        message: "Keine Free Agents im aktuellen lokalen Feed gefunden.",
      };
    }

    return {
      status: "ready" as const,
      message: "Transfermarkt ist lokal spielbar. Kaufvorschau zeigt echte Before/After-Werte.",
    };
  }, [marketFeed, marketTeamId, readMeta.source]);

  const cockpitLineupStatus = useMemo(() => {
    if (!resolvePreviewFeed) {
      return {
        status: "open" as const,
        message: "Status noch nicht geladen. Preview oeffnen, um Readiness und fehlende Teams zu sehen.",
      };
    }
    if (lineupStatusSummary.missingTeams > 0) {
      return {
        status: "warning" as const,
        message: `${lineupStatusSummary.missingTeams} Teams ohne gespeicherte Einsatzliste.`,
      };
    }
    if (lineupStatusSummary.incompleteTeams > 0) {
      return {
        status: "warning" as const,
        message: `${lineupStatusSummary.incompleteTeams} Teams sind noch unvollstaendig oder ohne Score-Coverage.`,
      };
    }
    if (lineupStatusSummary.readyTeams === lineupStatusSummary.totalTeams && lineupStatusSummary.totalTeams > 0) {
      return {
        status: "ready" as const,
        message: "Alle Teams sind fuer diesen Spieltag lineup-seitig ready.",
      };
    }
    return {
      status: "open" as const,
      message: "Readiness ist vorhanden, aber noch nicht vollstaendig eingeordnet.",
    };
  }, [lineupStatusSummary, resolvePreviewFeed]);

  const cockpitAiLineupStatus = useMemo(() => {
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma bleibt hier read-only. AI-Teams koennen im Cockpit nur im lokalen Save gespeichert werden.",
      };
    }
    if (cockpitAiBatchApplyFeed?.error) {
      return {
        status: "blocked" as const,
        message: cockpitAiBatchApplyFeed.error,
      };
    }
    if (cockpitAiBatchApplyFeed && !cockpitAiBatchApplyFeed.dryRun && cockpitAiBatchApplyFeed.summary.savedTeams > 0) {
      return {
        status: "applied" as const,
        message: `${cockpitAiBatchApplyFeed.summary.savedTeams} AI-Teams wurden lokal aufgestellt.`,
      };
    }
    if (cockpitAiBatchApplyFeed?.dryRun) {
      if (cockpitAiBatchApplyFeed.summary.blockedTeams > 0) {
        return {
          status: "warning" as const,
          message: `${cockpitAiBatchApplyFeed.summary.blockedTeams} AI-Teams bleiben im DryRun blockiert.`,
        };
      }
      if (cockpitAiBatchApplyFeed.summary.plannedLineups > 0) {
        return {
          status: "ready" as const,
          message: `${cockpitAiBatchApplyFeed.summary.plannedLineups} AI-Lineups koennen lokal gespeichert werden.`,
        };
      }
      return {
        status: "warning" as const,
        message: "Der DryRun hat aktuell keine speicherbaren AI-Lineups gefunden.",
      };
    }
    if (aiLineupApplyTeams.length === 0) {
      return {
        status: "warning" as const,
        message:
          aiTeams.length > 0
            ? "AI-Teams sind vorhanden, aber AI-Lineup-Apply ist noch nicht freigegeben. Ueber den Aktivieren-Button oder in den Team Settings kann das lokal freigegeben werden."
            : "Aktuell ist kein Team mit controlMode=ai und aktivem AI-Lineup-Apply freigegeben.",
      };
    }
    return {
      status: "open" as const,
      message: "DryRun zeigt zuerst, welche AI-Teams lokal aufgestellt werden koennen.",
    };
  }, [aiLineupApplyTeams.length, aiTeams.length, cockpitAiBatchApplyFeed, readMeta.source]);

  const cockpitResolveStatus = useMemo(() => {
    const status = resolvePreviewFeed?.preview.status;
    if (!status) {
      return { status: "open" as const, message: "Noch keine Resolve Preview geladen." };
    }
    if (status === "ready") {
      return { status: "ready" as const, message: "Resolve Preview ist bereit und zeigt D1/D2 Rankings read-only." };
    }
    if (status === "blocked") {
      return { status: "blocked" as const, message: "Resolve Preview ist blockiert und benoetigt erst geklaerte Quellen oder Lineups." };
    }
    return { status: "warning" as const, message: `Resolve Preview meldet ${status}.` };
  }, [resolvePreviewFeed]);

  const cockpitResultApplyStatus = useMemo(() => {
    const summary = resultApplyFeed?.summary;
    const blockingReasons = resultApplyFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (resultApplyFeed?.applied) {
      return { status: "applied" as const, message: "Result Apply wurde lokal gespeichert." };
    }
    if (resultApplyFeed && (resultApplyFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Result Apply ist aktuell blockiert." };
    }
    if (resolvePreviewFeed?.preview.status === "ready") {
      return { status: "ready" as const, message: "Result Apply kann nach Dry-Run lokal bestaetigt werden." };
    }
    return { status: "open" as const, message: "Erst Resolve Preview laden, dann Dry-Run oder Apply ausfuehren." };
  }, [resolvePreviewFeed, resultApplyFeed]);

  const cockpitStandingsPreviewStatus = useMemo(() => {
    if (!standingsPreviewFeed) {
      return { status: "open" as const, message: "Noch keine Standings Preview geladen." };
    }
    if ((standingsPreviewFeed.blockedRules?.length ?? 0) > 0) {
      return { status: "warning" as const, message: standingsPreviewFeed.blockedRules[0] ?? "Standings Preview hat offene Blocker." };
    }
    if ((standingsPreviewFeed.summary.readyTeams ?? 0) === (standingsPreviewFeed.summary.totalTeams ?? 0) && (standingsPreviewFeed.summary.totalTeams ?? 0) > 0) {
      return { status: "ready" as const, message: "Punkte-Delta und projected Rank sind fuer alle Teams berechnet." };
    }
    return { status: "warning" as const, message: "Standings Preview ist noch nicht fuer alle Teams ready." };
  }, [standingsPreviewFeed]);

  const cockpitStandingsApplyStatus = useMemo(() => {
    const summary = standingsApplyFeed?.summary;
    const blockingReasons = standingsApplyFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (standingsApplyFeed?.applied) {
      return { status: "applied" as const, message: "Standings Apply wurde lokal geschrieben." };
    }
    if (standingsApplyFeed && (standingsApplyFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Standings Apply ist blockiert." };
    }
    if ((standingsPreviewFeed?.blockedRules?.length ?? 0) === 0 && (standingsPreviewFeed?.summary.readyTeams ?? 0) > 0) {
      return { status: "ready" as const, message: "Standings Apply kann nach Dry-Run lokal bestaetigt werden." };
    }
    return { status: "open" as const, message: "Erst Standings Preview in einen apply-faehigen Zustand bringen." };
  }, [standingsApplyFeed, standingsPreviewFeed]);

  const cockpitPrizePreviewStatus = useMemo(() => {
    if (!prizePreviewFeed) {
      return { status: "open" as const, message: "Noch keine Preisgeld-Vorschau geladen." };
    }
    if (prizePreviewHardBlocked.length > 0) {
      return { status: "blocked" as const, message: prizePreviewHardBlocked[0] ?? "Preisgeldtabelle ist nicht verwendbar." };
    }
    if ((prizePreviewFeed.summary.calculableTeams ?? 0) > 0 && (prizePreviewFeed.summary.blockedItemsCount ?? 0) === 0) {
      return { status: "ready" as const, message: "Cash vorher, Preisgeld und Cash nachher sind fuer alle Teams berechenbar." };
    }
    return { status: "warning" as const, message: "Preisgeld-Vorschau ist nur teilweise berechenbar." };
  }, [prizePreviewFeed, prizePreviewHardBlocked]);

  const cockpitCashApplyStatus = useMemo(() => {
    const summary = cashApplyFeed?.summary;
    const blockingReasons = cashApplyFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (cashApplyFeed?.applied || currentSeasonCashPrizeApplyLogs.length > 0) {
      return { status: "applied" as const, message: currentSeasonCashPrizeApplyLogs.length > 0 ? "Preisgeld wurde fuer diese Season bereits angewendet." : "Cash Apply wurde lokal gespeichert." };
    }
    if (cashApplyFeed && (cashApplyFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Cash Apply ist blockiert." };
    }
    if ((prizePreviewFeed?.summary.calculableTeams ?? 0) > 0 && (prizePreviewFeed?.summary.blockedItemsCount ?? 0) === 0) {
      return { status: "ready" as const, message: "Cash Apply kann nach Dry-Run lokal bestaetigt werden." };
    }
    return { status: "open" as const, message: "Erst Preisgeld-Vorschau vollstaendig berechnen." };
  }, [cashApplyFeed, currentSeasonCashPrizeApplyLogs.length, prizePreviewFeed]);

  const cockpitSeasonSnapshotStatus = useMemo(() => {
    const currentSeasonSnapshot = (gameState.seasonState.seasonSnapshots ?? []).find(
      (snapshot) => snapshot.seasonId === gameState.season.id,
    );
    if (readMeta.source === "prisma") {
      return {
        status: "blocked" as const,
        message: "Prisma bleibt read-only. Season-Snapshots koennen nur im lokalen SQLite-Save gespeichert werden.",
      };
    }
    if (seasonSnapshotFeed?.applied) {
      return {
        status: "applied" as const,
        message: "Die Saisonhistorie wurde lokal archiviert.",
      };
    }
    if (seasonSnapshotFeed?.canCreate) {
      return {
        status: "ready" as const,
        message: "Die aktuelle Season kann jetzt lokal als Historien-Snapshot gespeichert werden.",
      };
    }
    if (seasonSnapshotFeed && !seasonSnapshotFeed.canCreate) {
      return {
        status: "blocked" as const,
        message: seasonSnapshotFeed.blockingReasons[0] ?? "Season Snapshot ist aktuell blockiert.",
      };
    }
    if (currentSeasonSnapshot) {
      return {
        status: "applied" as const,
        message: "Fuer diese Season existiert bereits ein lokaler Snapshot.",
      };
    }
    return {
      status: "open" as const,
      message: "DryRun zeigt zuerst, ob die aktuelle Season bereits sauber archiviert werden kann.",
    };
  }, [gameState.season.id, gameState.seasonState.seasonSnapshots, readMeta.source, seasonSnapshotFeed]);

  const cockpitMatchdayAdvanceStatus = useMemo(() => {
    const summary = matchdayAdvanceFeed?.summary;
    const blockingReasons = matchdayAdvanceFeed?.blockingReasons ?? summary?.blockingReasons ?? [];
    if (matchdayAdvanceFeed?.applied) {
      return { status: "applied" as const, message: "Der lokale Save wurde auf den naechsten Matchday fortgeschrieben." };
    }
    if (matchdayAdvanceFeed && (matchdayAdvanceFeed.canApply ?? summary?.canApply) === false) {
      return { status: "blocked" as const, message: blockingReasons[0] ?? "Matchday-Fortschritt ist blockiert." };
    }
    if (cashApplyFeed?.applied) {
      return { status: "ready" as const, message: "Der Spieltag kann jetzt lokal abgeschlossen und auf den naechsten Matchday gesetzt werden." };
    }
    return { status: "open" as const, message: "Erst Result, Standings und Cash fuer den aktuellen Matchday lokal abschliessen." };
  }, [cashApplyFeed, matchdayAdvanceFeed]);

  const cockpitAutoRunStatus = useMemo(() => {
    if (!matchdayAutoRunFeed) {
      return { status: "open" as const, message: "DryRun zeigt zuerst, ob der aktuelle Matchday lokal komplett durchlaufen kann." };
    }
    if (matchdayAutoRunFeed.status === "applied") {
      const formCards = matchdayAutoRunFeed.summary.formCardsSelected ?? 0;
      const advanceText = matchdayAutoRunFeed.summary.advanceAllowed ? " Der Spieltag wurde fortgeschrieben." : "";
      return {
        status: "applied" as const,
        message: `Der aktuelle Matchday wurde lokal ausgefuehrt. AI-Lineups und ${formCards} Formkarten wurden vorbereitet.${advanceText}`,
      };
    }
    if (matchdayAutoRunFeed.status === "blocked") {
      return {
        status: "blocked" as const,
        message: matchdayAutoRunFeed.blockingReasons[0]
          ? formatCockpitReason(matchdayAutoRunFeed.blockingReasons[0])
          : "Der Auto-Run ist blockiert.",
      };
    }
    if (matchdayAutoRunFeed.status === "warning") {
      return { status: "warning" as const, message: "Der Auto-Run meldet Warnungen. Bitte Step-Details pruefen." };
    }
    if (matchdayAutoRunFeed.summary.resolveReady) {
      const formCards = matchdayAutoRunFeed.summary.formCardsSelected ?? 0;
      return {
        status: "ready" as const,
        message: `DryRun ist bereit: Lineups passen, ${formCards} Formkarten sind im Plan. Der Matchday kann lokal simuliert werden.`,
      };
    }
    return { status: "ready" as const, message: "DryRun ist geladen. Der Matchday kann lokal simuliert werden." };
  }, [matchdayAutoRunFeed]);

  const cockpitWholeSeasonDryRunStatus = useMemo(() => {
    if (!wholeSeasonDryRunFeed) {
      return { status: "open" as const, message: "Die Saison-Simulation nutzt eine isolierte lokale Kopie und zeigt zuerst moegliche Blocker ueber alle Spieltage." };
    }
    if (wholeSeasonDryRunFeed.status === "blocked") {
      if (wholeSeasonDryRunFeed.blockingReasons.includes("ai_lineup_apply_disabled")) {
        return {
          status: "blocked" as const,
          message: `${wholeSeasonDryRunFeed.skippedDisabledAiTeams} AI-Teams sind noch nicht fuer AI-Lineup-Apply freigegeben. Aktiviere zuerst Step 5 oder die Team Settings.`,
        };
      }
      return {
        status: "blocked" as const,
        message: wholeSeasonDryRunFeed.blockedAtMatchday
          ? `${wholeSeasonDryRunFeed.blockedAtMatchday.label}: ${formatCockpitReason(wholeSeasonDryRunFeed.blockingReasons[0] ?? "season_dryrun_blocked")}`
          : formatCockpitReason(wholeSeasonDryRunFeed.blockingReasons[0] ?? "season_dryrun_blocked"),
      };
    }
    if (wholeSeasonDryRunFeed.status === "completed") {
      return { status: "applied" as const, message: "Die lokale Saison wurde auf einer isolierten In-Memory-Kopie komplett durchsimuliert." };
    }
    if (wholeSeasonDryRunFeed.status === "warning") {
      return { status: "warning" as const, message: "Die Saison konnte auf der In-Memory-Kopie weitgehend simuliert werden, meldet aber Warnungen." };
    }
    return { status: "ready" as const, message: "Die lokale Saison konnte komplett auf einer isolierten Kopie durchsimuliert werden." };
  }, [wholeSeasonDryRunFeed]);

  const cockpitMatchdayMvpScoringStatus = useMemo(() => {
    if (!matchdayMvpScoringFeed) {
      return {
        status: "open" as const,
        message: "Noch kein Matchday-1 DryRun geladen. Der MVP rechnet bei Bedarf mit echten Base Scores und markiert Auto-Lineups sauber.",
      };
    }
    if (matchdayMvpScoringFeed.error) {
      return {
        status: "blocked" as const,
        message: matchdayMvpScoringFeed.error,
      };
    }
    if (matchdayMvpScoringFeed.status === "blocked") {
      return {
        status: "blocked" as const,
        message: matchdayMvpScoringFeed.blockingReasons[0]
          ? formatCockpitReason(matchdayMvpScoringFeed.blockingReasons[0])
          : "Der Matchday-1 Slice ist aktuell blockiert.",
      };
    }
    if (matchdayMvpScoringFeed.status === "applied") {
      return {
        status: "applied" as const,
        message: "Matchday 1 wurde lokal durchgerechnet und in Result- plus Standings-State geschrieben.",
      };
    }
    if (matchdayMvpScoringFeed.status === "warning") {
      return {
        status: "warning" as const,
        message: "Der Slice ist spielbar. Warnungen betreffen derzeit vor allem Wunschkader, Auto-Lineups oder noch fehlende Spezialquellen.",
      };
    }
    return {
      status: "ready" as const,
      message: "DryRun ist bereit. D1 und D2 koennen jetzt lokal in den aktiven Save geschrieben werden.",
    };
  }, [matchdayMvpScoringFeed]);

  const cockpitFlowChecklist = useMemo(
    () => [
      { label: "Matchday offen", done: true },
      {
        label: "AI-Teams aufgestellt",
        done: Boolean(cockpitAiBatchApplyFeed && !cockpitAiBatchApplyFeed.dryRun && cockpitAiBatchApplyFeed.summary.savedTeams > 0),
        active: cockpitAiLineupStatus.status === "ready",
      },
      { label: "Result Apply", done: Boolean(resultApplyFeed?.applied), active: cockpitResultApplyStatus.status === "ready" },
      { label: "Standings Apply", done: Boolean(standingsApplyFeed?.applied), active: cockpitStandingsApplyStatus.status === "ready" },
      { label: "Ergebnis im Saisonstand", done: Boolean(standingsApplyFeed?.applied), active: cockpitStandingsApplyStatus.status === "ready" },
    ],
    [
      cockpitAiBatchApplyFeed,
      cockpitAiLineupStatus.status,
      cockpitResultApplyStatus.status,
      cockpitStandingsApplyStatus.status,
      resultApplyFeed?.applied,
      standingsApplyFeed?.applied,
    ],
  );

  const cockpitOverallStatus = useMemo(() => {
    if (matchdayAdvanceFeed?.applied) {
      return "Matchday abgeschlossen";
    }
    if (cockpitMatchdayAdvanceStatus.status === "ready") {
      return "bereit fuer Matchday-Abschluss";
    }
    if (cockpitCashApplyStatus.status === "ready") {
      return "bereit fuer Cash Apply";
    }
    if (cockpitStandingsApplyStatus.status === "ready") {
      return "bereit fuer Standings Apply";
    }
    if (cockpitResultApplyStatus.status === "ready") {
      return "bereit fuer Result Apply";
    }
    if (cockpitAiLineupStatus.status === "ready") {
      return "bereit fuer AI-Lineup-Save";
    }
    if (
      cockpitAiLineupStatus.status === "warning" ||
      cockpitResolveStatus.status === "warning" ||
      cockpitLineupStatus.status === "warning" ||
      cockpitStandingsPreviewStatus.status === "warning" ||
      cockpitPrizePreviewStatus.status === "warning"
    ) {
      return "Warnings offen";
    }
    if (
      cockpitAiLineupStatus.status === "blocked" ||
      cockpitResolveStatus.status === "blocked" ||
      cockpitResultApplyStatus.status === "blocked" ||
      cockpitStandingsApplyStatus.status === "blocked" ||
      cockpitCashApplyStatus.status === "blocked" ||
      cockpitMatchdayAdvanceStatus.status === "blocked"
    ) {
      return "blockiert";
    }
    return "Matchday offen";
  }, [
    cockpitAiLineupStatus.status,
    cockpitCashApplyStatus.status,
    cockpitLineupStatus.status,
    cockpitMatchdayAdvanceStatus.status,
    cockpitPrizePreviewStatus.status,
    cockpitResolveStatus.status,
    cockpitResultApplyStatus.status,
    cockpitStandingsApplyStatus.status,
    cockpitStandingsPreviewStatus.status,
    matchdayAdvanceFeed?.applied,
  ]);

  return (
    <FoundationCockpitPanel
      {...panelProps}
      {...aiBatchHandlers}
      {...matchdayHandlers}
      {...preseasonHandlers}
      {...seasonTransitionHandlers}
      {...panelDerivations}
      featureAuditFilter={featureAuditFilter}
      setFeatureAuditFilter={setFeatureAuditFilter}
      renderMultiSeasonTeamCell={renderMultiSeasonTeamCell}
      renderMultiSeasonEconomyCell={renderMultiSeasonEconomyCell}
      renderMultiSeasonPlayerCell={renderMultiSeasonPlayerCell}
      renderMultiSeasonGameplayCell={renderMultiSeasonGameplayCell}
      formatLocalePoints={formatLocalePoints}
      formatMoney={formatMoney}
      cockpitSaveStatus={cockpitSaveStatus}
      cockpitFreshSeasonStatus={cockpitFreshSeasonStatus}
      cockpitTransfermarktStatus={cockpitTransfermarktStatus}
      cockpitLineupStatus={cockpitLineupStatus}
      cockpitAiLineupStatus={cockpitAiLineupStatus}
      cockpitResolveStatus={cockpitResolveStatus}
      cockpitResultApplyStatus={cockpitResultApplyStatus}
      cockpitStandingsPreviewStatus={cockpitStandingsPreviewStatus}
      cockpitStandingsApplyStatus={cockpitStandingsApplyStatus}
      cockpitPrizePreviewStatus={cockpitPrizePreviewStatus}
      cockpitCashApplyStatus={cockpitCashApplyStatus}
      cockpitSeasonSnapshotStatus={cockpitSeasonSnapshotStatus}
      cockpitMatchdayAdvanceStatus={cockpitMatchdayAdvanceStatus}
      cockpitAutoRunStatus={cockpitAutoRunStatus}
      cockpitWholeSeasonDryRunStatus={cockpitWholeSeasonDryRunStatus}
      cockpitMatchdayMvpScoringStatus={cockpitMatchdayMvpScoringStatus}
      cockpitFlowChecklist={cockpitFlowChecklist}
      cockpitOverallStatus={cockpitOverallStatus}
    />
  );
}
