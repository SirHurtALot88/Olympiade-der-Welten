// @ts-nocheck
"use client";

import { Fragment, memo, startTransition, useEffect, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";

import type { ContractAssessment } from "@/lib/foundation/tabs/use-teams-contract-derivations";
import ClassColorChip, { getClassColorClassName } from "@/app/foundation/ClassColorChip";
import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
// Nur die Mapping-Funktion — die Karte selbst bleibt der dynamische Import weiter unten.
import { buildAxisPpsFromRating } from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { formatContractShapeShortLabel, rosterSalariesDifferForDisplay } from "@/lib/foundation/player-economy-contract";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";
import TeamDrawerHistoryTable from "@/components/foundation/team-drawer/TeamDrawerHistoryTable";
import { isSeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";
import type { ContractDissolutionOffer } from "@/lib/morale/contract-dissolution-service";
import { TEAM_BOARD_PRESSURE_TOOLTIP, TEAM_BOARD_RATING_TOOLTIP } from "@/lib/foundation/team-board-tooltips";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type {
  TransfermarktSellPreviewSubject,
  TransfermarktSellSummary,
} from "@/lib/foundation/tabs/use-market-sell-derivations";
import FoundationRosterSellPeekDrawer from "@/app/foundation/teams-v2/FoundationRosterSellPeekDrawer";
import { VeloSplitMeter } from "@/components/foundation/velo-ui";
import {
  NlCard,
  NlEmptyState,
  NlTable,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
} from "@/components/foundation/new-look";

const TEAM_ROSTER_PORTRAIT_LOADING = {
  loading: "lazy",
  fetchPriority: "auto",
} as const;

// TEMP TEST: forces roster actions clickable so the sell/renew windows can be
// previewed mid-season. Remove when done. Der Server phase-gated produktive
// Writes weiterhin (Preview-sicher) — dieser Schalter macht NUR die Buttons
// klickbar, damit Verkaufs-/Verhandlungsfenster vor dem Season-End begutachtet
// werden können.
const TEMP_FORCE_ROSTER_ACTIONS = true;

/** League-table logos beyond the selected row load after shell paint (+200 ms idle). */
const TEAMS_INITIAL_VISIBLE_LOGO_ROWS = 10;
const TEAMS_DEFERRED_LOGO_IDLE_MS = 200;

const FoundationPlayerPortraitCard = dynamic(
  () => import("@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard"),
  { ssr: false },
);

function PlayerPortrait({
  src,
  initials,
  alt,
  className,
  style,
  loading = "lazy",
  fetchPriority = "auto",
}: {
  src: string | null;
  initials: string;
  alt: string;
  className: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} transfermarkt-portrait-placeholder`} aria-label={`${alt} Platzhalter`} style={style}>
        {initials}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      style={style}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Vertrags-Restlaufzeit → Heat-Band-Klasse (`heat-band-1`..`heat-band-8`,
 * dieselbe Ton-Skala wie `getPoolHeatClass`). 1 Jahr = am dringendsten
 * (rot), 5+ Jahre = am sichersten (blau) — reine Anzeige-Einordnung, keine
 * neue Spielmechanik.
 */
function getContractLengthHeatBandClass(length) {
  if (length == null || !Number.isFinite(length)) {
    return "";
  }
  if (length <= 1) return "heat-band-1";
  if (length === 2) return "heat-band-3";
  if (length === 3) return "heat-band-5";
  if (length === 4) return "heat-band-6";
  return "heat-band-8";
}

/** Die vier Achsen in Anzeige-Reihenfolge — Werte und Ligarang kommen aus demselben Rating. */
const AUSLAUF_ACHSEN = [
  { kuerzel: "POW", titel: "Kraft", ton: "pow", wertKey: "ppPow", rangKey: "ppPowRank" },
  { kuerzel: "SPE", titel: "Tempo", ton: "spe", wertKey: "ppSpe", rangKey: "ppSpeRank" },
  { kuerzel: "MEN", titel: "Kopf", ton: "men", wertKey: "ppMen", rangKey: "ppMenRank" },
  { kuerzel: "SOC", titel: "Sozial", ton: "soc", wertKey: "ppSoc", rangKey: "ppSocRank" },
] as const;

const EMPFEHLUNG_LABEL: Record<"verlaengern" | "beobachten" | "abgeben", string> = {
  verlaengern: "Verlängern",
  beobachten: "Beobachten",
  abgeben: "Abgeben",
};

/** Teuer ist ein Risiko-Ton, guenstig ein guter — "ueblich" bleibt bewusst unauffaellig. */
function gehaltsTon(einordnung: "teuer" | "ueblich" | "guenstig" | null): string {
  if (einordnung === "teuer") return "bad";
  if (einordnung === "guenstig") return "good";
  return "neutral";
}

/**
 * Balkenbreite fuer die Abweichungs-Skalen. Die Skala endet bei ±40 % — darueber hinaus wird
 * nicht weiter gestreckt, sondern der Balken laeuft an, damit ein Ausreisser die Skala aller
 * anderen Karten nicht unlesbar macht. Die Zahl daneben nennt den echten Wert.
 */
function gaugeStyle(relativ: number | null | undefined): CSSProperties {
  const wert = relativ != null && Number.isFinite(relativ) ? relativ : 0;
  const anteil = Math.min(1, Math.abs(wert) / 0.4);
  return { width: `${(anteil * 50).toFixed(1)}%`, [wert >= 0 ? "left" : "right"]: "50%" } as CSSProperties;
}

/** Moral-Vertragsintent → Ton-Klasse für den Intent-Chip (Verträge-Tabelle):
 * grün = verlängerungsbereit, gelb = fordert mehr/nur kurz, rot = denkt an
 * Wechsel/blockt. Reine Anzeige-Einordnung, keine neue Spielmechanik. */
function getContractIntentToneClass(intent) {
  if (intent === "willing_to_extend") return "is-positive";
  if (intent === "considering_exit" || intent === "refuses_extension") return "is-risk";
  if (intent === "demands_raise" || intent === "short_term_only") return "is-watch";
  return "is-neutral";
}

/** Balkengeometrie für den Gehaltsforecast-Chart (Verträge-Tab): pro Saison
 * ein Balken (gebundene Summe), plus ein zweiter Balken NUR wenn die
 * Preview-Summe (inkl. Kaufdialog-Drafts) tatsächlich abweicht — sonst
 * bleibt der Chart auf den Normalfall (keine Drafts) reduziert. */
function buildContractForecastChartGeometry(totalsCommitted, totalsWithPreview) {
  if (!Array.isArray(totalsCommitted) || totalsCommitted.length === 0) {
    return null;
  }
  const width = 600;
  const height = 168;
  const paddingLeft = 6;
  const paddingRight = 6;
  const paddingTop = 22;
  const paddingBottom = 26;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const slotWidth = innerWidth / totalsCommitted.length;
  const barWidth = Math.max(10, slotWidth * 0.32);
  const barGap = slotWidth * 0.06;

  const committedValues = totalsCommitted.map((entry) => (Number.isFinite(entry?.salary) ? entry.salary : 0));
  const previewValues = totalsCommitted.map((_, index) => {
    const preview = totalsWithPreview?.[index];
    return preview && Number.isFinite(preview.salary) ? preview.salary : null;
  });
  const maxValue = Math.max(1, ...committedValues, ...previewValues.filter((value) => value != null));

  const bars = totalsCommitted.map((entry, index) => {
    const committedValue = committedValues[index];
    const previewValue = previewValues[index];
    const hasPreviewDelta = previewValue != null && Math.abs(previewValue - committedValue) >= 0.01;
    const committedHeight = (committedValue / maxValue) * innerHeight;
    const previewHeight = hasPreviewDelta ? (previewValue / maxValue) * innerHeight : null;
    const slotStart = paddingLeft + index * slotWidth;
    const centerX = slotStart + slotWidth / 2;
    const committedX = hasPreviewDelta ? centerX - barWidth - barGap / 2 : centerX - barWidth / 2;
    const previewX = committedX + barWidth + barGap;
    return {
      label: entry.label,
      committedValue,
      previewValue: hasPreviewDelta ? previewValue : null,
      hasPreviewDelta,
      x: committedX,
      y: paddingTop + innerHeight - committedHeight,
      width: barWidth,
      height: committedHeight,
      previewX,
      previewY: previewHeight != null ? paddingTop + innerHeight - previewHeight : null,
      previewWidth: barWidth,
      previewHeight,
      centerX,
    };
  });

  return { width, height, paddingTop, paddingBottom, innerHeight, maxValue, bars };
}

/** Gruppiert die aktiven Vertragszeilen nach Restlaufzeit (1 Jahr … Cap) für
 * die Restlaufzeiten-Zeitleiste — Cap = Anzahl der Forecast-Saisons
 * (`seasonLabels.length`, i. d. R. 5), längere Laufzeiten fallen in den
 * letzten Bucket ("Cap+"). Preview-Drafts zählen nicht mit (noch kein
 * aktiver Vertrag). */
function buildContractExpiryBuckets(rows, seasonLabelCount) {
  const maxBucket = Math.max(1, seasonLabelCount || 5);
  const buckets = new Map();
  for (let year = 1; year <= maxBucket; year += 1) {
    buckets.set(year, []);
  }
  (rows ?? [])
    .filter((row) => row.status === "active")
    .forEach((row) => {
      const length = Number.isFinite(row.contractLength) ? row.contractLength : null;
      if (length == null) {
        return;
      }
      const bucketYear = Math.min(Math.max(1, Math.round(length)), maxBucket);
      const bucket = buckets.get(bucketYear) ?? [];
      bucket.push(row);
      buckets.set(bucketYear, bucket);
    });
  return Array.from(buckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([year, bucketRows]) => ({
      year,
      isOverflowBucket: year === maxBucket,
      rows: [...bucketRows].sort((left, right) => left.playerName.localeCompare(right.playerName, "de-DE")),
    }));
}

/** Gehaltsverlauf-Treppe für die Verträge-Tabelle: pro Saison ein Mini-Balken,
 * Höhe relativ zum HÖCHSTEN Saisongehalt DIESER Zeile skaliert (nicht Team-Max)
 * — so bleibt die VertragsFORM (front-/back-/balanced) auch bei kleinen
 * Gehältern gut lesbar. Leere/ausgelaufene Saisons bekommen einen flachen,
 * blassen Platzhalter-Balken. */
function buildContractSalarySteps(row, seasonLabels) {
  const seasons = Array.isArray(seasonLabels) ? seasonLabels : [];
  const values = seasons.map((label, index) => {
    const raw = row.yearlySalarySchedule?.[index]?.salary;
    return { label, salary: Number.isFinite(raw) && raw > 0 ? raw : null };
  });
  const maxSalary = Math.max(1, ...values.map((entry) => entry.salary ?? 0));
  let lastActiveIndex = -1;
  values.forEach((entry, index) => {
    if (entry.salary != null) {
      lastActiveIndex = index;
    }
  });
  // Erste Saison MIT Gehalt = die laufende Saison (`yearlySalarySchedule[0]`, siehe
  // `resolvePlayerEconomySalary`). Das ist der Betrag, den das Team JETZT zahlt — und
  // damit die Zahl, die neben der Treppe steht und nach der die Spalte sortiert.
  const currentIndex = values.findIndex((entry) => entry.salary != null);
  const steps = values.map((entry, index) => ({
    label: entry.label,
    salary: entry.salary,
    heightPct: entry.salary != null ? Math.max(12, Math.round((entry.salary / maxSalary) * 100)) : 8,
    isEmpty: entry.salary == null,
    isLast: index === lastActiveIndex,
    isCurrent: index === currentIndex,
  }));
  return {
    steps,
    lastActiveSalary: lastActiveIndex >= 0 ? values[lastActiveIndex].salary : null,
    currentSalary: currentIndex >= 0 ? values[currentIndex].salary : null,
  };
}

/** Mini-Balkenstreifen für die Tabellen-Fußzeile (Team-Gehaltslast pro
 * Saison) — dieselbe committed/preview-Farbsprache wie der
 * Gehaltsforecast-Chart oben, nur kompakt je Saison statt als eigener
 * Chart. */
function buildContractFooterSteps(totalsCommitted, totalsWithPreview) {
  const committed = Array.isArray(totalsCommitted) ? totalsCommitted : [];
  const preview = Array.isArray(totalsWithPreview) ? totalsWithPreview : [];
  const maxValue = Math.max(
    1,
    ...committed.map((entry) => (Number.isFinite(entry?.salary) ? entry.salary : 0)),
    ...preview.map((entry) => (Number.isFinite(entry?.salary) ? entry.salary : 0)),
  );
  return committed.map((entry, index) => {
    const committedValue = Number.isFinite(entry?.salary) ? entry.salary : 0;
    const previewEntry = preview[index];
    const previewValue = Number.isFinite(previewEntry?.salary) ? previewEntry.salary : committedValue;
    return {
      label: entry?.label ?? "",
      committedValue,
      previewValue,
      hasPreviewDelta: Math.abs(previewValue - committedValue) >= 0.01,
      committedPct: Math.max(4, Math.round((committedValue / maxValue) * 100)),
      previewPct: Math.max(4, Math.round((previewValue / maxValue) * 100)),
    };
  });
}

export type FoundationTeamsDetailPanelProps = {
  active: boolean;
  teamsHydrationPhase?: "shell" | "full";
  gameState: unknown;
  selectedTeam: unknown;
  /** Wave D · D1 Feld-Form-Strip (nur im Neuen Look verwendet, additiv/optional). */
  fieldRaceRecentForm?: unknown;
  fieldRacePlayedMatchdayCount?: unknown;
  sortedTeamsViewRows: unknown;
  visibleTeamsViewColumns: unknown;
  SortableHeader: unknown;
  getTableColumnWidth: unknown;
  getTableHeaderDragProps: unknown;
  getTeamsViewColumnTitle: unknown;
  toggleTableSort: unknown;
  startTableColumnResize: unknown;
  resetTableColumnWidth: unknown;
  tableSorts: unknown;
  joinClassNames: unknown;
  getOwnerTeamHighlightClass: unknown;
  resolvedTeamControlSettings: unknown;
  scheduleActiveManagerTeam: unknown;
  openTeamProfileById: unknown;
  formatMoney: unknown;
  formatLocalePoints: unknown;
  getSeasonCashHeatClass: unknown;
  formatWholeNumber: unknown;
  getTeamAxisRankTooltip: unknown;
  getRankHeatClass: unknown;
  teamHistoryPointRankMaps: unknown;
  selectedTeamsHistoryData: unknown;
  teamEconomyTiles: unknown;
  formatNullableMoney: unknown;
  formatSignedDisplayMoney: unknown;
  getTeamHistoryRankToneClass: unknown;
  selectedTeamObjectives: unknown;
  teamObjectiveOverview: unknown;
  selectedTeamSponsorContract: unknown;
  selectedTeamSponsorOffers: unknown;
  selectedTeamContractShapeMix: unknown;
  renderMetricBar: unknown;
  leaguePlayerHeatPools: unknown;
  selectedTeamDetailTab: "roster" | "contracts" | "portraits" | "transfer";
  teamRosterRoleFilter: unknown;
  setTeamRosterRoleFilter: unknown;
  teamRosterFocusMode: unknown;
  setTeamRosterFocusMode: unknown;
  sortedSelectedRosterTableRows: unknown;
  filteredSelectedRosterTableRows: unknown;
  selectedStandingRow: unknown;
  selectedRoster: unknown;
  visibleSelectedRosterColumns: unknown;
  selectedTeamContractTable: unknown;
  selectedTeamContractPreviewRowCount: unknown;
  visibleSelectedTeamContractRows: unknown;
  /** Gehalt-gegen-ueblich und Board-Empfehlung je Spieler (siehe use-teams-contract-derivations). */
  contractAssessmentByPlayerId?: Map<string, ContractAssessment>;
  contractRecommendationCounts?: { verlaengern: number; beobachten: number; abgeben: number };
  showTeamContractPreviewRows: unknown;
  setShowTeamContractPreviewRows: unknown;
  contractRenewalBusy: unknown;
  marketSellBusy?: boolean;
  /** Spieler, die dem Team gerade anbieten, ihren Vertrag aufzulösen (Season-End). */
  contractDissolutionOffers?: ContractDissolutionOffer[];
  /** Spieler, dessen Entscheidung gerade geschrieben wird — sperrt nur dessen Knöpfe. */
  contractDissolutionBusyPlayerId?: string | null;
  onDecideContractDissolution?: (playerId: string, decision: "accepted" | "declined") => void | Promise<void>;
  openContractRenewalNegotiation: unknown;
  openMarketSellModal: unknown;
  /**
   * DER BLICK STATT DES SCHRITTS — Kader-Drawer mit der Board-Bilanz beim Klick auf eine Zeile.
   *
   * GEMELDET: „ich finde auch das verkaufsfenster sollte ggf als drawer oder so rein kommen schon
   * wenn man den spieler in der zeile anklickt, damit man auch bei spielern die man nicht
   * verkaufen will direkt sehen kann was das board dazu sagt!"
   *
   * Optional gehalten, damit ein Host ohne Verkaufs-Verdrahtung (Prisma-Referenz, Tests) die
   * Tabelle unveraendert rendert — ohne die Props bleiben die Zeilen einfach nicht klickbar.
   */
  openMarketSellPeek?: (subject: TransfermarktSellPreviewSubject, teamId?: string) => void | Promise<void>;
  closeMarketSellPeek?: () => void;
  openMarketSellFromPeek?: (subject: TransfermarktSellPreviewSubject, teamId?: string) => void | Promise<void>;
  marketSellPeekSubject?: TransfermarktSellPreviewSubject | null;
  marketSellPeekPreview?: TransfermarktSellSummary | null;
  marketSellPeekBusy?: boolean;
  marketSellPeekError?: string | null;
  openPlayerDrawerById: unknown;
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  getPlayerPortraitModel: unknown;
  getClassColorClassName: unknown;
  getRosterEntryDisplaySalary: unknown;
  getRosterEntryCurrentSeasonSalary: unknown;
  getRosterEntryDisplayMarketValue: unknown;
  renderEconomyDelta: unknown;
  getPlayerDisplayMarketValueDelta: unknown;
  getRosterEntrySalaryDelta: unknown;
  formatPpsValue: unknown;
  formatDisplayMoney: unknown;
  formatContractShapeLabel: unknown;
  formatMoraleContractIntentLabel: unknown;
  getPlayerDisplaySalary: unknown;
  starters: unknown;
  bench: unknown;
  selectedIdentity: unknown;
  freeAgents: unknown;
  aiPreview: unknown;
  selectedAiTeamId: unknown;
  aiMarketPreview: unknown;
  isPending: unknown;
  isReadOnlyMode: unknown;
  showReadOnlyNotice: unknown;
  setGameState: unknown;
  runAiTurn: unknown;
  showExtendedTeamPanels: unknown;
  setShowExtendedTeamPanels: unknown;
  formatTransfermarktCurrency: unknown;
  roundViewNumber: unknown;
  getLineupDraftSideCounts: unknown;
  isSelectedTeamManagementLocked: unknown;
  selectedTeamControl: unknown;
  formatTeamControlModeLabel: unknown;
  openTeamDrawerById: unknown;
  selectedRosterTableRows: unknown;
  shouldBuildTeamContracts: unknown;
  playerSeasonPerformanceMap: unknown;
  chooseTeamSponsor: unknown;
  confirmContractRenewalNegotiation: unknown;
  formatObjectiveStatusLabel: unknown;
  formatCockpitReason: unknown;
  getPoolHeatClass: unknown;
  getResponsiveTableImageSize: unknown;
  getTeamLogoModel: unknown;
  setContractRenewalNegotiation: unknown;
  setShowSelectedRosterPpsBreakdown: unknown;
  setShowTeamDisciplines: unknown;
  toggleTransferSellMarker: unknown;
  transferSellMarkerKeySet: unknown;
  selectedBoardConfidence: unknown;
  selectedTeamCommercialRating: unknown;
  showTeamDisciplines: unknown;
  teamRosterRoleFilterOptions: unknown;
  teamRosterFocusOptions: unknown;
  contractRenewalNegotiation: unknown;
  showSelectedRosterPpsBreakdown: unknown;
  sponsorChoiceMessage: unknown;
  sponsorChoiceBusy: unknown;
  selectedTeamCanManage: unknown;
  selectedTeamRosterActionsAvailable: unknown;
  selectedTeamRosterActionHint: unknown;
  contractRenewalMessage: unknown;
  contractRenewalError: unknown;
  /** Manuelles KI-Pick-Auffüllen für genau dieses Team (Kader-Tab). */
  runTeamPicksRefill?: (teamId: string) => void | Promise<void>;
  teamPicksRefillBusyTeamId?: string | null;
  teamPicksRefillMessage?: { teamId: string; tone: "success" | "error"; text: string } | null;
};

function FoundationTeamsDetailPanel({
  active,
  teamsHydrationPhase = "full",
  gameState,
  selectedTeam,
  sortedTeamsViewRows,
  visibleTeamsViewColumns,
  SortableHeader,
  getTableColumnWidth,
  getTableHeaderDragProps,
  getTeamsViewColumnTitle,
  toggleTableSort,
  startTableColumnResize,
  resetTableColumnWidth,
  tableSorts,
  joinClassNames,
  getOwnerTeamHighlightClass,
  resolvedTeamControlSettings,
  scheduleActiveManagerTeam,
  openTeamProfileById,
  formatMoney,
  formatLocalePoints,
  getSeasonCashHeatClass,
  formatWholeNumber,
  getTeamAxisRankTooltip,
  getRankHeatClass,
  teamHistoryPointRankMaps,
  selectedTeamsHistoryData,
  teamEconomyTiles,
  formatNullableMoney,
  formatSignedDisplayMoney,
  getTeamHistoryRankToneClass,
  selectedTeamObjectives,
  teamObjectiveOverview,
  selectedTeamSponsorContract,
  selectedTeamSponsorOffers,
  selectedTeamContractShapeMix,
  renderMetricBar,
  leaguePlayerHeatPools,
  selectedTeamDetailTab,
  teamRosterRoleFilter,
  setTeamRosterRoleFilter,
  teamRosterFocusMode,
  setTeamRosterFocusMode,
  sortedSelectedRosterTableRows,
  filteredSelectedRosterTableRows,
  selectedStandingRow,
  selectedRoster,
  visibleSelectedRosterColumns,
  selectedTeamContractTable,
  selectedTeamContractPreviewRowCount,
  visibleSelectedTeamContractRows,
  contractAssessmentByPlayerId,
  contractRecommendationCounts,
  showTeamContractPreviewRows,
  setShowTeamContractPreviewRows,
  contractRenewalBusy,
  marketSellBusy = false,
  contractDissolutionOffers = [],
  contractDissolutionBusyPlayerId = null,
  onDecideContractDissolution,
  openContractRenewalNegotiation,
  openMarketSellModal,
  openMarketSellPeek,
  closeMarketSellPeek,
  openMarketSellFromPeek,
  marketSellPeekSubject = null,
  marketSellPeekPreview = null,
  marketSellPeekBusy = false,
  marketSellPeekError = null,
  openPlayerDrawerById,
  playerRatingsById,
  getPlayerPortraitModel,
  getClassColorClassName,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntryDisplayMarketValue,
  renderEconomyDelta,
  getPlayerDisplayMarketValueDelta,
  getRosterEntrySalaryDelta,
  formatPpsValue,
  formatDisplayMoney,
  formatContractShapeLabel,
  formatMoraleContractIntentLabel,
  getPlayerDisplaySalary,
  starters,
  bench,
  selectedIdentity,
  freeAgents,
  aiPreview,
  selectedAiTeamId,
  aiMarketPreview,
  isPending,
  isReadOnlyMode,
  showReadOnlyNotice,
  setGameState,
  runAiTurn,
  showExtendedTeamPanels,
  setShowExtendedTeamPanels,
  formatTransfermarktCurrency,
  roundViewNumber,
  getLineupDraftSideCounts,
  isSelectedTeamManagementLocked,
  selectedTeamControl,
  formatTeamControlModeLabel,
  openTeamDrawerById,
  selectedRosterTableRows,
  shouldBuildTeamContracts,
  playerSeasonPerformanceMap,
  chooseTeamSponsor,
  confirmContractRenewalNegotiation,
  formatObjectiveStatusLabel,
  formatCockpitReason,
  getPoolHeatClass,
  getResponsiveTableImageSize,
  getTeamLogoModel,
  setContractRenewalNegotiation,
  setShowSelectedRosterPpsBreakdown,
  setShowTeamDisciplines,
  toggleTransferSellMarker,
  transferSellMarkerKeySet,
  selectedBoardConfidence,
  selectedTeamCommercialRating,
  showTeamDisciplines,
  teamRosterRoleFilterOptions,
  teamRosterFocusOptions,
  contractRenewalNegotiation,
  showSelectedRosterPpsBreakdown,
  sponsorChoiceMessage,
  sponsorChoiceBusy,
  selectedTeamCanManage,
  selectedTeamRosterActionsAvailable,
  selectedTeamRosterActionHint,
  contractRenewalMessage,
  contractRenewalError,
  runTeamPicksRefill,
  teamPicksRefillBusyTeamId,
  teamPicksRefillMessage,
}: FoundationTeamsDetailPanelProps) {
  if (!active) {
    return null;
  }

  const showLeagueLogos = teamsHydrationPhase === "full";
  const showSecondaryPanels = teamsHydrationPhase === "full";
  const [showDeferredTeamLogos, setShowDeferredTeamLogos] = useState(false);
  // "Neuer Look" (flag-gated): Verträge/Transfer laufen weiter über dieses
  // Panel (der Host routet nur roster/portraits zum NL-Kader). Mit Flag AN
  // rendern die Vertrags-/Transfer-Blöcke das NL-Kit (StatChip/NlTable/
  // NlEmptyState), mit Flag AUS exakt die bisherige Struktur — reine
  // Hüllen-Umschaltung, keine Datenänderung.
  const [nlContractSort, setNlContractSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  // Vertrags-Auslauf-Center: Sichtbarkeit umschalten zwischen nur auslaufenden
  // Verträgen (LZ ≤ 1) und dem ganzen aktiven Kader (für Buyout-und-Verkauf).
  const [auslaufScope, setAuslaufScope] = useState<"expiring" | "all">("expiring");
  // Ausklappbare Disziplin-PPs je Roster-Zeile (POW/SPE/MEN/SOC → Einzel-
  // disziplinen). Nur eine Zeile gleichzeitig offen (wie die Spieler-Tabelle),
  // Zustand lokal — additive, entkoppelt vom globalen Achsen-Spalten-Umschalter.
  const [expandedRosterPpsDisziId, setExpandedRosterPpsDisziId] = useState<string | null>(null);
  // Dasselbe Ausklapp-Muster für die Verträge-Tabelle (NlTable), Zustand je Spieler-ID.
  const [expandedContractPpsPlayerId, setExpandedContractPpsPlayerId] = useState<string | null>(null);
  // Roster-Zeilen nach Spieler-ID (trägt ppPow/… + disciplinePpsByAxis) — Quelle
  // für die Achsen-/Disziplin-PPs der Verträge-Tabelle (join über playerId).
  const rosterRowByPlayerId = new Map(
    (filteredSelectedRosterTableRows ?? []).map((row) => [row.player.id, row]),
  );

  // Kompakte "at a glance"-Achsen-PPs (POW/SPE/MEN/SOC) für eine Zelle.
  // Optional (`sort`) machen die vier Achsen-Chips anklickbar und sortieren
  // die Tabelle nach genau dieser Achse (Vorbild: die Achsen-Header in
  // FoundationPlayersTableNewLook.tsx, `nl-players-axis`/`onToggleSort`).
  // Ohne `sort`-Option (z. B. der Kader-Tab) bleibt der Chip ein reiner
  // `<span>` wie bisher — additiv, kein Verhalten für bestehende Aufrufer.
  const renderPpsAxisStrip = (axisValues, ariaName, sort) => (
    <div className="selected-roster-pps-axes" aria-label={`PPs nach Bereich für ${ariaName}`}>
      {axisValues.map((axisItem) => {
        const label = `${axisItem.label}-PPs (Saison)`;
        const value =
          axisItem.value != null && Number.isFinite(axisItem.value) ? formatPpsValue(axisItem.value) : "—";
        if (!sort) {
          return (
            <span
              key={axisItem.axis}
              className={`selected-roster-pps-axis nl-tone-${axisItem.axis}`}
              title={label}
            >
              <span className="selected-roster-pps-axis-label">{axisItem.label}</span>
              <span className="selected-roster-pps-axis-value nl-tnum">{value}</span>
            </span>
          );
        }
        const isActiveSort = sort.activeAxis === axisItem.axis;
        return (
          <button
            key={axisItem.axis}
            type="button"
            className={`selected-roster-pps-axis selected-roster-pps-axis-sortable nl-tone-${axisItem.axis}${
              isActiveSort ? " is-active-sort" : ""
            }`}
            title={`Nach ${label} sortieren`}
            aria-pressed={isActiveSort}
            onClick={(event) => {
              // Nicht an den Zeilen-/Drawer-Klick durchreichen — ein
              // Achsenklick soll ausschließlich sortieren (gleiches Muster
              // wie der bestehende PPs-Zellen-Wrapper weiter unten).
              event.stopPropagation();
              sort.onSort(axisItem.axis);
            }}
          >
            <span className="selected-roster-pps-axis-label">{axisItem.label}</span>
            <span className="selected-roster-pps-axis-value nl-tnum">{value}</span>
          </button>
        );
      })}
    </div>
  );

  // Ausklapp-Panel mit den echten Disziplin-PPs, gruppiert nach Achse.
  const renderPpsDisziPanel = ({ name, axisGroups, panelId }) => (
    <div className="selected-roster-pps-diszi-panel" id={panelId} role="region" aria-label={`Disziplin-PPs ${name}`}>
      <div className="selected-roster-pps-diszi-head">
        <strong>{name}</strong>
        <span className="muted">Performance-Punkte je Disziplin (Saison), gruppiert nach Bereich</span>
      </div>
      <div className="selected-roster-pps-diszi-axes-grid">
        {(Array.isArray(axisGroups) ? axisGroups : []).map((axisGroup) => (
          <div key={axisGroup.axis} className={`selected-roster-pps-diszi-axis nl-tone-${axisGroup.axis}`}>
            <div className="selected-roster-pps-diszi-axis-head">
              <span className="selected-roster-pps-diszi-axis-label">{axisGroup.label}</span>
              <span className="selected-roster-pps-diszi-axis-total nl-tnum">
                {axisGroup.axisPps != null && Number.isFinite(axisGroup.axisPps) ? formatPpsValue(axisGroup.axisPps) : "—"}
              </span>
            </div>
            <ul className="selected-roster-pps-diszi-list">
              {axisGroup.disciplines.length === 0 ? (
                <li className="selected-roster-pps-diszi-item is-empty">
                  <span className="muted">Keine Disziplinen</span>
                </li>
              ) : (
                axisGroup.disciplines.map((discipline) => (
                  <li
                    key={discipline.id}
                    className="selected-roster-pps-diszi-item"
                    title={
                      discipline.playerCount != null
                        ? `${discipline.name}: ${discipline.playerCount} Spieler pro Team treten in dieser Disziplin an`
                        : discipline.name
                    }
                  >
                    <span className="selected-roster-pps-diszi-item-name">
                      {discipline.name}
                      {/* Kadergröße der Disziplin. Gedämpft und in Klammern, damit sie den
                          Namen ergänzt statt mit dem PPs-Wert rechts zu konkurrieren. */}
                      {discipline.playerCount != null ? (
                        <span className="selected-roster-pps-diszi-item-count"> ({discipline.playerCount})</span>
                      ) : null}
                    </span>
                    <span className="selected-roster-pps-diszi-item-value nl-tnum">{formatPpsValue(discipline.pps)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  useEffect(() => {
    if (!showLeagueLogos) {
      setShowDeferredTeamLogos(false);
      return;
    }

    let cancelled = false;
    const finish = () => {
      if (!cancelled) {
        setShowDeferredTeamLogos(true);
      }
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      const idleId = globalThis.requestIdleCallback(finish, { timeout: TEAMS_DEFERRED_LOGO_IDLE_MS });
      return () => {
        cancelled = true;
        globalThis.cancelIdleCallback?.(idleId);
      };
    }

    const timerId = globalThis.setTimeout(finish, TEAMS_DEFERRED_LOGO_IDLE_MS);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timerId);
    };
  }, [showLeagueLogos, selectedTeam?.teamId]);

  const shouldShowTeamRowLogo = (teamId: string, rowIndex: number) =>
    showLeagueLogos &&
    (showDeferredTeamLogos ||
      rowIndex < TEAMS_INITIAL_VISIBLE_LOGO_ROWS ||
      teamId === selectedTeam?.teamId);
  const contractExpiringCount = selectedRoster.filter((entry) => entry.contractLength <= 1).length;
  // Verkaufen/Verlängern sind IMMER sichtbar (Discoverability); außerhalb des
  // Season-End-Fensters nur ausgegraut + Tooltip statt versteckt. Der TEMP-
  // Schalter oben macht sie zum Testen sofort klickbar (Server gated Writes).
  const rosterActionsEnabled = Boolean(selectedTeamRosterActionsAvailable) || TEMP_FORCE_ROSTER_ACTIONS;
  const sellActionTitle = selectedTeamRosterActionsAvailable
    ? "Verkaufen — öffnet die Verkaufs-Vorschau"
    : TEMP_FORCE_ROSTER_ACTIONS
      ? "Test-Modus: Aktion freigeschaltet. Verkauf öffnet regulär am Season-End (nach MD10)."
      : "Verkauf öffnet am Season-End (nach MD10).";
  const renewActionTitle = selectedTeamRosterActionsAvailable
    ? "Verlängern — öffnet die Gehaltsverhandlung"
    : TEMP_FORCE_ROSTER_ACTIONS
      ? "Test-Modus: Aktion freigeschaltet. Gehaltsverhandlung öffnet regulär am Season-End (nach MD10)."
      : "Gehaltsverhandlung öffnet am Season-End (nach MD10).";

  return (
    <div className="foundation-teams-view-panel" data-testid="foundation-teams-view" data-team-tab={selectedTeamDetailTab}>
            <>
              {/* Vertragsauflösung auf Spielerwunsch. Steht ÜBER dem Kader, weil sie eine
                  Frist hat: wer nicht entscheidet, behält den Spieler samt seiner Unzufriedenheit.
                  Die Liste kommt vom Server — Preis und Anspruch werden dort gerechnet, damit die
                  Ansicht keinen veralteten Preis buchen kann. */}
              {rosterActionsEnabled && contractDissolutionOffers.length > 0 ? (
                <NlCard
                  className="teams-dissolution-card"
                  id="team-focus-dissolution"
                  data-testid="teams-contract-dissolution"
                  eyebrow="Kader · Saisonende"
                  title={
                    <>
                      Vertragsauflösung auf Spielerwunsch
                      <span className="teams-dissolution-count">
                        {contractDissolutionOffers.length}{" "}
                        {contractDissolutionOffers.length === 1 ? "Anfrage" : "Anfragen"}
                      </span>
                    </>
                  }
                >
                  {/* Kurz halten: die Herleitung steht in der Zeile selbst und in den Tooltips.
                      Vier Zeilen Fließtext über drei Angeboten liest ohnehin niemand. */}
                  <p className="nl-market-muted teams-dissolution-intro">
                    Er verzichtet nur <b>anteilig</b> auf seinen Rest-Buyout — wie viel, hängt an Moral und Charakter.
                    Den Zeitpunkt suchst du dir nicht aus; lehnst du ab, bricht seine Moral deutlich ein.
                  </p>
                  <ul className="teams-dissolution-list">
                    {contractDissolutionOffers.map((offer) => {
                      const busy = contractDissolutionBusyPlayerId === offer.playerId;
                      const anyBusy = contractDissolutionBusyPlayerId != null;
                      const zahlbar = offer.payableBuyout ?? 0;
                      const netto = offer.salePrice - zahlbar;
                      const offerPlayer =
                        gameState.players.find((candidate) => candidate.id === offer.playerId) ?? null;
                      const portrait = offerPlayer ? getPlayerPortraitModel(offerPlayer) : null;
                      return (
                        <li key={offer.playerId} className="teams-dissolution-item">
                          <div className="teams-dissolution-identity">
                            {/* Kompaktes Bild statt der Hover-Vorschau: die Zeile ist eine
                                Entscheidung, kein Spielerprofil — das oeffnet der Namensklick. */}
                            <span className="teams-dissolution-portrait" aria-hidden="true">
                              {portrait?.thumbSrc ?? portrait?.src ? (
                                <BudgetedMediaImage
                                  src={(portrait.thumbSrc ?? portrait.src) as string}
                                  alt=""
                                  width={44}
                                  height={44}
                                  fallbackLabel={portrait.initials}
                                  fallback={<span className="teams-dissolution-portrait-fallback">{portrait.initials}</span>}
                                />
                              ) : (
                                <span className="teams-dissolution-portrait-fallback">
                                  {offer.playerName.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </span>
                            <div className="teams-dissolution-identity-copy">
                              <button
                                type="button"
                                className="nl-teams-playerlink is-inline"
                                onClick={() => void openPlayerDrawerById(offer.playerId)}
                                title={`${offer.playerName} öffnen`}
                              >
                                {offer.playerName}
                              </button>
                              <span className="teams-dissolution-chips">
                                <span className="teams-dissolution-chip is-risk" title="Je unzufriedener, desto mehr gibt er auf.">
                                  Moral {formatNlNumber(offer.morale, 1)}
                                </span>
                                <span className="teams-dissolution-chip" title="Restlaufzeit seines Vertrags.">
                                  {offer.remainingContractLength}{" "}
                                  {offer.remainingContractLength === 1 ? "Saison" : "Saisons"}
                                </span>
                                {offer.previouslyDeclined ? (
                                  <span
                                    className="teams-dissolution-chip is-warn"
                                    title="Du hast schon einmal abgelehnt — das verschiebt seinen Verzicht, je nach Charakter in beide Richtungen."
                                  >
                                    fragt erneut
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </div>

                          {/* Der geteilte Balken IST die neue Regel: er zeigt, wie viel des offenen
                              Buyouts der Spieler liegen lässt und was am Team hängen bleibt. */}
                          <div className="teams-dissolution-split">
                            {offer.openBuyout > 0 ? (
                              <VeloSplitMeter
                                share={offer.waiverShare ?? 0}
                                leadLabel="erlässt"
                                leadValue={formatNlMoney(offer.waivedBuyout)}
                                restLabel="du zahlst"
                                restValue={formatNlMoney(zahlbar)}
                                ariaLabel={`Rest-Buyout ${formatNlMoney(offer.openBuyout)}: ${formatNlMoney(offer.waivedBuyout)} erlassen, ${formatNlMoney(zahlbar)} zahlbar`}
                              />
                            ) : (
                              <span className="nl-market-muted teams-dissolution-nobuyout">
                                Vertrag läuft aus — kein offener Buyout.
                              </span>
                            )}
                          </div>

                          <div className="teams-dissolution-money nl-tnum">
                            <span
                              className="teams-dissolution-net"
                              title="Was nach Abzug des offenen Buyout-Rests wirklich ins Team-Cash geht."
                            >
                              <small>Netto</small>
                              <strong>{formatNlMoney(netto)}</strong>
                            </span>
                            <small className="muted">
                              {formatNlMoney(offer.salePrice)} Verkaufspreis
                              {zahlbar > 0 ? ` − ${formatNlMoney(zahlbar)} Buyout` : ""}
                            </small>
                          </div>

                          <div className="teams-dissolution-actions">
                            <button
                              type="button"
                              className="primary-button nl-teams-action"
                              disabled={busy || anyBusy}
                              onClick={() => void onDecideContractDissolution?.(offer.playerId, "accepted")}
                              title="Der Spieler geht; das Team kassiert den Verkaufspreis abzüglich des nicht erlassenen Buyout-Rests."
                            >
                              {busy ? "…" : "Auflösen"}
                            </button>
                            <button
                              type="button"
                              className="nl-teams-action nl-teams-action-danger"
                              disabled={busy || anyBusy}
                              onClick={() => void onDecideContractDissolution?.(offer.playerId, "declined")}
                              title="Der Spieler bleibt und erfüllt seinen Vertrag — seine Moral bricht deutlich ein."
                            >
                              {busy ? "…" : "Ablehnen"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </NlCard>
              ) : null}
              <section className="panel team-focus-panel teams-primary-roster-panel" id="team-focus-roster">
                <div className="panel-header team-focus-header">
                  <div className="team-focus-title-wrap">
                    {(() => {
                      const logo = getTeamLogoModel(selectedTeam, { variant: "thumb" });
                      return showLeagueLogos && logo.src ? (
                        <BudgetedMediaImage
                          className="team-focus-logo"
                          src={logo.src}
                          alt={`${selectedTeam.name} Logo`}
                          width={72}
                          height={72}
                          loading="eager"
                          fetchPriority="high"
                          fallback={
                            <div className="team-focus-logo team-logo-placeholder" aria-label={`${selectedTeam.name} Logo Platzhalter`}>
                              {logo.initials}
                            </div>
                          }
                        />
                      ) : (
                        <div className="team-focus-logo team-logo-placeholder" aria-label={`${selectedTeam.name} Logo Platzhalter`}>
                          {logo.initials}
                        </div>
                      );
                    })()}
                    <div>
                    <p className="eyebrow">Team Fokus</p>
                    <h2>
                      {selectedTeam.name}
                      {selectedTeamDetailTab === "contracts" ? " · Verträge" : selectedTeamDetailTab === "transfer" ? " · Transfers" : " · Kader"}
                    </h2>
                    </div>
                  </div>
                  <div className="team-focus-header-actions">
                    {selectedTeamDetailTab === "roster" ? (
                      <button
                        className="secondary-button inline-button"
                        type="button"
                        onClick={() => setShowTeamDisciplines((current) => !current)}
                        title={showTeamDisciplines ? "Diszi-Spalten ausblenden" : "Diszi-Spalten einblenden"}
                      >
                        Diszis
                      </button>
                    ) : (
                      <button
                        className="secondary-button inline-button"
                        type="button"
                        onClick={() => openTeamProfileById(selectedTeam.teamId)}
                      >
                        Profil
                      </button>
                    )}
                  </div>
                </div>
                {selectedTeamDetailTab === "roster" ? (
                  <>
                    <div className="team-roster-role-filterbar" aria-label="Kaderrollen filtern">
                      {teamRosterRoleFilterOptions.map((option) => (
                        <button
                          key={`team-roster-role-filter-${option.id}`}
                          className={`secondary-button inline-button${teamRosterRoleFilter === option.id ? " is-active" : ""}`}
                          type="button"
                          onClick={() => setTeamRosterRoleFilter(option.id)}
                        >
                          {option.label} <span>{option.count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="team-roster-focusbar" aria-label="Kaderfokus wählen">
                      {teamRosterFocusOptions.map((option) => (
                        <button
                          key={`team-roster-focus-${option.id}`}
                          className={`secondary-button inline-button${teamRosterFocusMode === option.id ? " is-active" : ""}`}
                          type="button"
                          onClick={() => setTeamRosterFocusMode(option.id)}
                        >
                          {option.label} <span>{option.count}</span>
                        </button>
                      ))}
                    </div>
                    {selectedTeamRosterActionHint ? (
                      <div className={`team-roster-action-status${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
                        <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
                        <span>{selectedTeamRosterActionHint}</span>
                      </div>
                    ) : null}
                    {teamPicksRefillMessage && selectedTeam && teamPicksRefillMessage.teamId === selectedTeam.teamId ? (
                      <div className={`status-banner${teamPicksRefillMessage.tone === "success" ? " is-success" : " is-warning"}`}>
                        {teamPicksRefillMessage.text}
                      </div>
                    ) : null}
                    <div className="team-focus-layout">
                      <div className="table-shell team-focus-table-shell" style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}>
                        <table
                          className={`team-table selected-team-roster-table${showTeamDisciplines ? "" : " is-compact"}`}
                        >
                          <colgroup>
                            {visibleSelectedRosterColumns.map((column) => (
                              <col key={column.id} style={{ width: `${getTableColumnWidth("selectedRosterTable", column)}px` }} />
                            ))}
                          </colgroup>
                          <thead>
                            <tr>
                              {visibleSelectedRosterColumns.map((column) => (
                                <th
                                  key={column.id}
                                  {...getTableHeaderDragProps("selectedRosterTable", column, visibleSelectedRosterColumns)}
                                  style={{ width: `${getTableColumnWidth("selectedRosterTable", column)}px`, minWidth: `${column.minWidth}px` }}
                                >
                                  <div className="resizable-header-cell">
                                    {column.id === "image" ? (
                                      <span>Bild</span>
                                    ) : (
                                      <SortableHeader label={column.label} tableId="selectedRoster" columnKey={column.dataKey} sortState={tableSorts.selectedRoster} onToggle={toggleTableSort} />
                                    )}
                                    <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("selectedRosterTable", column, event)} onDoubleClick={() => resetTableColumnWidth("selectedRosterTable", column)} />
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSelectedRosterTableRows.map(({ entry, player, playerOvr, playerMvs, playerPps, ppPow, ppSpe, ppMen, ppSoc, disciplinePpsByAxis, saleBreakdown, known: rowKnown, caStars: rowCaStars, poStarRange: rowPoStarRange, caScore: rowCaScore, poScoreRange: rowPoScoreRange }) => {
                              const hasPpsBreakdown = [ppPow, ppSpe, ppMen, ppSoc].some((value) => value != null && Number.isFinite(value));
                              // "At a glance"-Achsenwerte (POW/SPE/MEN/SOC) für die kompakte Mini-Anzeige in der PPs-Zelle.
                              const rosterPpsAxes = [
                                { axis: "pow", label: "POW", value: ppPow },
                                { axis: "spe", label: "SPE", value: ppSpe },
                                { axis: "men", label: "MEN", value: ppMen },
                                { axis: "soc", label: "SOC", value: ppSoc },
                              ];
                              const axisDisciplineGroups = Array.isArray(disciplinePpsByAxis) ? disciplinePpsByAxis : [];
                              const isPpsDisziExpanded = expandedRosterPpsDisziId === entry.id;
                              const ppsDisziPanelId = `roster-pps-diszi-${entry.id}`;
                              const isContractExpiring = entry.contractLength <= 1;
                              return (
                              <Fragment key={entry.id}>
                              <tr
                                className={entry.contractLength <= 1 ? "is-contract-expiring" : undefined}
                                onClick={() => void openPlayerDrawerById(player.id, entry.id)}
                              >
                                {visibleSelectedRosterColumns.map((column) => {
                                  if (column.id === "image") {
                                    const portrait = getPlayerPortraitModel(player);
                                    const imageSize = getResponsiveTableImageSize(
                                      getTableColumnWidth("selectedRosterTable", column),
                                    );
                                    const thumbSrc = showLeagueLogos ? portrait.thumbSrc ?? portrait.src : null;
                                    return (
                                      <td key={column.id}>
                                        <FoundationPlayerPortraitPreview
                                          playerId={player.id}
                                          name={player.name}
                                          portraitUrl={portrait.src}
                                          portraitInitials={portrait.initials}
                                          playerOvr={playerOvr}
                                          playerMvs={playerMvs}
                                          playerPps={playerPps}
                                          pow={player.coreStats.pow ?? null}
                                          spe={player.coreStats.spe ?? null}
                                          men={player.coreStats.men ?? null}
                                          soc={player.coreStats.soc ?? null}
                                          leagueHeatPools={leaguePlayerHeatPools}
                                          variant="team"
                                          context="teamGrid"
                                          roleTag={entry.roleTag}
                                          playerClassName={player.className}
                                          previewDensity="full"
                                          newLook
                                          known={rowKnown}
                                          caStars={rowCaStars}
                                          caScore={rowCaScore}
                                          poStarRange={rowPoStarRange}
                                          poScoreRange={rowPoScoreRange}
                                        >
                                          <PlayerPortrait
                                            className="transfermarkt-portrait"
                                            src={thumbSrc}
                                            initials={portrait.initials}
                                            alt={player.name}
                                            loading={TEAM_ROSTER_PORTRAIT_LOADING.loading}
                                            fetchPriority={TEAM_ROSTER_PORTRAIT_LOADING.fetchPriority}
                                            style={{ width: imageSize, minWidth: imageSize }}
                                          />
                                        </FoundationPlayerPortraitPreview>
                                      </td>
                                    );
                                  }
                                  if (column.id === "name") {
                                    return (
                                      <td key={column.id} className="teams-v2-name-cell is-sticky-actions">
                                        <div className="table-player-cell">
                                          <button
                                            className="table-link-button"
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              openPlayerDrawerById(player.id, entry.id);
                                            }}
                                          >
                                            {player.name}
                                          </button>
                                          <small className="muted table-player-identity">{formatPlayerIdentitySubMeta(player)}</small>
                                          <div className="transfermarkt-inline-actions teams-v2-row-icon-actions">
                                            <button
                                              className="table-icon-button"
                                              type="button"
                                              title={sellActionTitle}
                                              aria-label={`${player.name} verkaufen`}
                                              disabled={!rosterActionsEnabled || marketSellBusy}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void openMarketSellModal({
                                                  activePlayerId: entry.id,
                                                  playerId: player.id,
                                                  playerName: player.name,
                                                  className: player.className,
                                                  race: player.race,
                                                  portraitUrl: getPlayerPortraitModel(player).previewSrc ?? getPlayerPortraitModel(player).src,
                                                }, selectedTeam?.teamId);
                                              }}
                                            >
                                              ⇄
                                            </button>
                                            {selectedTeam ? (
                                              <button
                                                className="table-icon-button"
                                                type="button"
                                                title={renewActionTitle}
                                                aria-label={`${player.name} verlängern`}
                                                disabled={!rosterActionsEnabled || contractRenewalBusy != null}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  void openContractRenewalNegotiation({
                                                    teamId: selectedTeam.teamId,
                                                    playerId: player.id,
                                                    playerName: player.name,
                                                    contractLength: 2,
                                                  });
                                                }}
                                              >
                                                ↻
                                              </button>
                                            ) : null}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "class") {
                                    return (
                                      <td key={column.id}>
                                        <ClassIcon classNameValue={player.className} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                                      </td>
                                    );
                                  }
                                  if (column.id === "race") {
                                    return (
                                      <td key={column.id}>
                                        <RaceIcon race={player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
                                      </td>
                                    );
                                  }
                                  if (column.id === "mw") {
                                    const marketValue = getRosterEntryDisplayMarketValue(entry, player);
                                    const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
                                    return (
                                      <td key={column.id}>
                                        <div className="economy-money-stack">
                                          <strong>{formatLocalePoints(marketValue, 1)}</strong>
                                          {marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01 ? (
                                            <small className={marketValueDelta >= 0 ? "text-positive" : "text-negative"}>
                                              {formatSignedDisplayMoney(marketValueDelta)}
                                            </small>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "salePrice") {
                                    return (
                                      <td key={column.id}>
                                        <div className="selected-roster-sale-cell">
                                          <strong>{saleBreakdown.salePrice != null ? formatTransfermarktCurrency(saleBreakdown.salePrice) : "—"}</strong>
                                          <small className="muted">
                                            {saleBreakdown.bracket != null ? `Bracket ${saleBreakdown.bracket}` : "kein Bracket"}
                                          </small>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "saleFactor") {
                                    return (
                                      <td key={column.id}>
                                        <div className="selected-roster-sale-cell">
                                          <strong>{saleBreakdown.saleFactor != null ? `${formatLocalePoints(saleBreakdown.saleFactor, 2)}x` : "—"}</strong>
                                          <small className="muted">
                                            {saleBreakdown.rankInBracket != null && saleBreakdown.bracketGroupSize > 0
                                              ? `${saleBreakdown.rankInBracket}/${saleBreakdown.bracketGroupSize} MVS`
                                              : "MVS offen"}
                                          </small>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "salary") {
                                    const annualSalary = getRosterEntryDisplaySalary(entry, player);
                                    const currentSeasonSalary = getRosterEntryCurrentSeasonSalary(entry, player);
                                    const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                                    const showSeasonSubline = rosterSalariesDifferForDisplay(currentSeasonSalary, annualSalary);
                                    return (
                                      <td key={column.id}>
                                        <div className="economy-money-stack">
                                          <strong>{formatDisplayMoney(annualSalary)}</strong>
                                          {salaryDelta != null && Math.abs(salaryDelta) >= 0.01 ? (
                                            <small className={salaryDelta <= 0 ? "text-positive" : "text-negative"}>
                                              {formatSignedDisplayMoney(salaryDelta)}
                                            </small>
                                          ) : null}
                                          {showSeasonSubline ? (
                                            <small className="players-table-salary-season" title="Gehalt diese Saison (Vertragsjahr 1)">
                                              Saison: {formatDisplayMoney(currentSeasonSalary)}
                                            </small>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "value") {
                                    const currentSalary = getRosterEntryDisplaySalary(entry, player);
                                    const valueScore =
                                      playerPps != null && currentSalary != null && currentSalary > 0
                                        ? playerPps / currentSalary
                                        : null;
                                    return <td key={column.id}>{valueScore != null ? formatLocalePoints(valueScore, 2) : "—"}</td>;
                                  }
                                  if (column.id === "contract") return <td key={column.id}>{entry.contractLength}</td>;
                                  if (column.id === "ovr") return <td key={column.id}>{renderMetricBar(playerOvr, { tone: "ovr", pool: leaguePlayerHeatPools.ovr, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "mvs") return <td key={column.id}>{renderMetricBar(playerMvs, { tone: "mvs", pool: leaguePlayerHeatPools.mvs, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "pps") {
                                    return (
                                      <td key={column.id}>
                                        <div className="selected-roster-pps-cell">
                                          <button
                                            className={`selected-roster-pps-trigger${showSelectedRosterPpsBreakdown ? " is-open" : ""}`}
                                            type="button"
                                            aria-expanded={showSelectedRosterPpsBreakdown}
                                            disabled={!hasPpsBreakdown}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setShowSelectedRosterPpsBreakdown((current) => !current);
                                            }}
                                          >
                                            {renderMetricBar(playerPps, {
                                              tone: "pps",
                                              pool: leaguePlayerHeatPools.pps,
                                              fallbackMax: 120,
                                              format: (value) => formatPpsValue(value),
                                            })}
                                            <span className="selected-roster-pps-trigger-label">
                                              {hasPpsBreakdown
                                                ? showSelectedRosterPpsBreakdown
                                                  ? "Spalten ausblenden"
                                                  : "Als Spalten"
                                                : "Keine Bereichs-PPs"}
                                            </span>
                                          </button>
                                          {renderPpsAxisStrip(rosterPpsAxes, player.name)}
                                          <button
                                            className={`selected-roster-pps-diszi-toggle${isPpsDisziExpanded ? " is-open" : ""}`}
                                            type="button"
                                            aria-expanded={isPpsDisziExpanded}
                                            aria-controls={ppsDisziPanelId}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setExpandedRosterPpsDisziId((current) => (current === entry.id ? null : entry.id));
                                            }}
                                          >
                                            <span className="selected-roster-pps-diszi-chevron" aria-hidden="true" />
                                            <span>{isPpsDisziExpanded ? "Disziplinen schließen" : "Disziplin-PPs"}</span>
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (column.id === "ppPow") return <td key={column.id}>{renderMetricBar(ppPow, { tone: "pow", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "ppSpe") return <td key={column.id}>{renderMetricBar(ppSpe, { tone: "spe", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "ppMen") return <td key={column.id}>{renderMetricBar(ppMen, { tone: "men", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "ppSoc") return <td key={column.id}>{renderMetricBar(ppSoc, { tone: "soc", pool: leaguePlayerHeatPools.pps, fallbackMax: 40, format: (value) => formatPpsValue(value) })}</td>;
                                  if (column.id === "pow") return <td key={column.id}>{renderMetricBar(player.coreStats.pow, { tone: "pow", pool: leaguePlayerHeatPools.pow, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "spe") return <td key={column.id}>{renderMetricBar(player.coreStats.spe, { tone: "spe", pool: leaguePlayerHeatPools.spe, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "men") return <td key={column.id}>{renderMetricBar(player.coreStats.men, { tone: "men", pool: leaguePlayerHeatPools.men, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  if (column.id === "soc") return <td key={column.id}>{renderMetricBar(player.coreStats.soc, { tone: "soc", pool: leaguePlayerHeatPools.soc, fallbackMax: 100, format: (value) => formatWholeNumber(value) })}</td>;
                                  return <td key={column.id} className={getPoolHeatClass(player.disciplineRatings[column.id] ?? null, leaguePlayerHeatPools.disciplines[column.id] ?? [])}>{(player.disciplineRatings[column.id] ?? 0).toFixed(0)}</td>;
                                })}
                              </tr>
                              {isPpsDisziExpanded ? (
                                <tr className="selected-roster-pps-diszi-row">
                                  <td colSpan={visibleSelectedRosterColumns.length}>
                                    {renderPpsDisziPanel({
                                      name: player.name,
                                      axisGroups: axisDisciplineGroups,
                                      panelId: ppsDisziPanelId,
                                    })}
                                  </td>
                                </tr>
                              ) : null}
                              </Fragment>
                            )})}
                          </tbody>
                        </table>
                      </div>
                      <div className="team-focus-footer">
                        <div className="team-focus-footer-stats">
                          <article>
                            <span>Kaderstatus</span>
                            <strong>
                              {filteredSelectedRosterTableRows.length} / {selectedStandingRow?.rosterCount ?? selectedRoster.length} Spieler · Ø LZ{" "}
                              {selectedStandingRow?.avgContractLength != null
                                ? formatLocalePoints(selectedStandingRow.avgContractLength, 1)
                                : "—"}
                            </strong>
                          </article>
                        </div>
                        <div className="team-focus-footer-actions">
                          <span className="muted">
                            {showTeamDisciplines
                              ? `20 Diszis sichtbar · Teamranks in Ranks und Diszis-Konfiguration unten`
                              : "Diszi-Spalten aktuell ausgeblendet"}
                          </span>
                          <div className="team-detail-actions">
                            {selectedTeamRosterActionsAvailable && selectedTeam && runTeamPicksRefill ? (
                              <button
                                className="secondary-button inline-button"
                                type="button"
                                disabled={teamPicksRefillBusyTeamId != null}
                                title="KI-Picks für dieses Team neu anwerfen"
                                onClick={() => void runTeamPicksRefill(selectedTeam.teamId)}
                              >
                                {teamPicksRefillBusyTeamId === selectedTeam.teamId ? "Wirbt an…" : "Kader auffüllen"}
                              </button>
                            ) : null}
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              onClick={() => setShowTeamDisciplines((current) => !current)}
                              title={showTeamDisciplines ? "Diszi-Spalten ausblenden" : "Diszi-Spalten einblenden"}
                            >
                              Diszis
                            </button>
                            <button
                              className="secondary-button inline-button"
                              type="button"
                              onClick={() => setShowExtendedTeamPanels((current) => !current)}
                              title={showExtendedTeamPanels ? "Zusatzpanels ausblenden" : "Zusatzpanels einblenden"}
                            >
                              Panels
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : selectedTeamDetailTab === "transfer" ? (
                  <div className="teams-v2-transfer-tab" data-testid="teams-v2-transfer-tab">
                    <StatChipRow className="teams-v2-finance-role-cards" aria-label="Team-Finanzen">
                      <StatChip
                        label="Cash"
                        value={selectedStandingRow?.cash != null ? formatNlMoney(selectedStandingRow.cash) : "—"}
                      />
                      <StatChip
                        label="Gehalt"
                        value={selectedStandingRow?.salaryTotal != null ? formatNlMoney(selectedStandingRow.salaryTotal) : "—"}
                      />
                      <StatChip
                        label="GuV"
                        tone={selectedStandingRow?.guv != null ? (selectedStandingRow.guv < 0 ? "risk" : "good") : "neutral"}
                        value={selectedStandingRow?.guv != null ? formatSignedDisplayMoney(selectedStandingRow.guv) : "—"}
                      />
                    </StatChipRow>
                    {(() => {
                      const liveHistory = selectedTeamsHistoryData?.history?.find((row) => row.isLive) ?? selectedTeamsHistoryData?.history?.[0] ?? null;
                      const duelRival = sortedTeamsViewRows?.find(
                        (row) => row.teamId !== selectedTeam.teamId && row.rank != null && selectedStandingRow?.rank != null && Math.abs(row.rank - selectedStandingRow.rank) <= 2,
                      ) ?? null;
                      return (
                        <>
                          {duelRival ? (
                            <StatChip
                              className="teams-v2-duel-card"
                              label="Duell"
                              value={`#${selectedStandingRow?.rank ?? "—"} ${selectedTeam.shortCode} vs #${duelRival.rank ?? "—"} ${duelRival.team?.shortCode ?? duelRival.teamCode ?? duelRival.team?.name ?? duelRival.teamName ?? "—"}`}
                              sub={`${formatLocalePoints(selectedStandingRow?.points ?? 0, 1)} vs ${formatLocalePoints(duelRival.points ?? 0, 1)} Punkte`}
                            />
                          ) : null}
                          <div className="teams-v2-transfer-cards">
                            <NlCard eyebrow="Top-Kauf">
                              {liveHistory?.topBuyPlayer ? (
                                <button type="button" className="nl-teams-playerlink" onClick={() => liveHistory.topBuyPlayerId && void openPlayerDrawerById(liveHistory.topBuyPlayerId)}>
                                  <span className="nl-teams-playername">{liveHistory.topBuyPlayer}</span>
                                  <span className="nl-teams-playermeta">{formatNlMoney(liveHistory.topBuyAmount)}</span>
                                </button>
                              ) : (
                                <span className="nl-teams-playermeta">Kein Zugang gebucht</span>
                              )}
                            </NlCard>
                            <NlCard eyebrow="Top-Verkauf">
                              {liveHistory?.topSellPlayer ? (
                                <button type="button" className="nl-teams-playerlink" onClick={() => liveHistory.topSellPlayerId && void openPlayerDrawerById(liveHistory.topSellPlayerId)}>
                                  <span className="nl-teams-playername">{liveHistory.topSellPlayer}</span>
                                  <span className="nl-teams-playermeta">{formatNlMoney(liveHistory.topSellAmount)}</span>
                                </button>
                              ) : (
                                <span className="nl-teams-playermeta">Kein Abgang gebucht</span>
                              )}
                            </NlCard>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="team-contracts-layout">
                    <StatChipRow className="team-contracts-summary-grid" aria-label="Vertragsübersicht">
                      <StatChip label="Aktive Verträge" value={selectedRoster.length} />
                      <StatChip
                        label="Laufen aus"
                        value={contractExpiringCount}
                        tone={contractExpiringCount > 0 ? "warn" : "neutral"}
                      />
                      <StatChip label="Preview-Drafts" value={selectedTeamContractPreviewRowCount} />
                      {selectedTeamContractShapeMix ? (
                        <StatChip
                          label="Strukturiert"
                          value={`${selectedTeamContractShapeMix.nonBalancedCount}/${selectedTeamContractShapeMix.totalCount}`}
                          sub={`Δ jetzt ${formatSignedDisplayMoney(selectedTeamContractShapeMix.currentDelta)}`}
                        />
                      ) : null}
                    </StatChipRow>
                    {contractRenewalMessage ? (
                      <div className="status-banner is-success">{contractRenewalMessage}</div>
                    ) : null}
                    {contractRenewalError ? (
                      <div className="status-banner is-warning">{contractRenewalError}</div>
                    ) : null}
                    {/* Die Gehaltsverhandlung („Verlängern") öffnet als eigenes
                        Overlay-Fenster (ContractRenewalNegotiationModal, gemountet
                        in FoundationShellRouterBody) — der frühere Inline-Banner
                        mit nacktem Zahlenfeld ist dadurch ersetzt. */}
                    {selectedTeamRosterActionHint ? (
                      <div className={`team-roster-action-status${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
                        <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
                        <span>{selectedTeamRosterActionHint}</span>
                      </div>
                    ) : null}
                    {selectedTeam
                      ? (() => {
                          /* Vertrags-Auslauf-Center: fokussiertes „verlängern-oder-verkaufen"-
                             Cockpit. Modus „Auslaufend" zeigt nur Verträge mit LZ ≤ 1 (letzte
                             Saison, endet nach MD10); Modus „Ganzer Kader" zeigt alle aktiven
                             Spieler — denn ein länger laufender Vertrag lässt sich per Buyout
                             auflösen und der Spieler gewinnbringend verkaufen. Bewusst KEINE
                             zweite Volltabelle — kompakte Entscheidungskarten mit Performance
                             (PPs/OVR) + Vertragsdaten inkl. Netto-bei-Verkauf nebeneinander. */
                          const auslaufActiveRows = (visibleSelectedTeamContractRows ?? []).filter(
                            (row) => row.status === "active",
                          );
                          if (auslaufActiveRows.length === 0) {
                            return null;
                          }
                          const auslaufRows =
                            auslaufScope === "all"
                              ? auslaufActiveRows
                              : auslaufActiveRows.filter((row) => row.contractLength <= 1);
                          const auslaufExpiringCount = auslaufActiveRows.filter(
                            (row) => row.contractLength <= 1,
                          ).length;
                          const auslaufPlayersById = new Map(
                            (gameState?.players ?? []).map((player) => [player.id, player]),
                          );
                          const auslaufDecorated = auslaufRows.map((row) => {
                            const ratings = playerRatingsById.get(row.playerId);
                            const staircase = buildContractSalarySteps(row, selectedTeamContractTable?.seasonLabels);
                            const netProceeds =
                              row.exitValue != null &&
                              Number.isFinite(row.exitValue) &&
                              row.buyoutCost != null &&
                              Number.isFinite(row.buyoutCost)
                                ? row.exitValue - row.buyoutCost
                                : null;
                            return {
                              row,
                              ratings,
                              currentSalary: staircase.lastActiveSalary,
                              ppsSeason: ratings?.ppsSeason ?? null,
                              netProceeds,
                              assessment: contractAssessmentByPlayerId?.get(row.playerId) ?? null,
                            };
                          });
                          const auslaufSorted = [...auslaufDecorated].sort((left, right) => {
                            // Dringlichkeit zuerst: was abgegeben werden sollte, dann was
                            // beobachtet gehoert. Erst danach greift die alte Ordnung
                            // (auslaufende Vertraege, dann Leistung, dann Name) — wer den Reiter
                            // oeffnet, soll die Entscheidungen sehen und nicht danach suchen.
                            const rang = (empfehlung: string | null | undefined) =>
                              empfehlung === "abgeben" ? 0 : empfehlung === "beobachten" ? 1 : 2;
                            const leftRank = rang(left.assessment?.empfehlung);
                            const rightRank = rang(right.assessment?.empfehlung);
                            if (leftRank !== rightRank) {
                              return leftRank - rightRank;
                            }
                            // Auslaufende (LZ ≤ 1) immer oben, dann PPs Saison desc, dann Name.
                            const leftExpiring = left.row.contractLength <= 1 ? 0 : 1;
                            const rightExpiring = right.row.contractLength <= 1 ? 0 : 1;
                            if (leftExpiring !== rightExpiring) {
                              return leftExpiring - rightExpiring;
                            }
                            const leftPps = left.ppsSeason != null && Number.isFinite(left.ppsSeason) ? left.ppsSeason : Number.NEGATIVE_INFINITY;
                            const rightPps = right.ppsSeason != null && Number.isFinite(right.ppsSeason) ? right.ppsSeason : Number.NEGATIVE_INFINITY;
                            if (rightPps !== leftPps) {
                              return rightPps - leftPps;
                            }
                            return String(left.row.playerName).localeCompare(String(right.row.playerName), "de-DE");
                          });
                          const auslaufSalaryFreed = auslaufDecorated.reduce(
                            (sum, item) => sum + (Number.isFinite(item.currentSalary) ? item.currentSalary : 0),
                            0,
                          );
                          const auslaufPpsValues = auslaufDecorated
                            .map((item) => item.ppsSeason)
                            .filter((value) => value != null && Number.isFinite(value));
                          const auslaufAvgPps =
                            auslaufPpsValues.length > 0
                              ? auslaufPpsValues.reduce((sum, value) => sum + value, 0) / auslaufPpsValues.length
                              : null;
                          const auslaufIsAll = auslaufScope === "all";
                          return (
                            <NlCard
                              className="team-auslauf-center"
                              eyebrow="Kaderplanung"
                              title="Vertrags-Auslauf-Center"
                              data-testid="team-auslauf-center"
                              actions={
                                <div
                                  className="team-auslauf-scope"
                                  role="group"
                                  aria-label="Umfang wählen"
                                >
                                  <button
                                    type="button"
                                    className={`team-auslauf-scope-btn${auslaufIsAll ? "" : " is-active"}`}
                                    aria-pressed={!auslaufIsAll}
                                    onClick={() => setAuslaufScope("expiring")}
                                  >
                                    Auslaufend
                                  </button>
                                  <button
                                    type="button"
                                    className={`team-auslauf-scope-btn${auslaufIsAll ? " is-active" : ""}`}
                                    aria-pressed={auslaufIsAll}
                                    onClick={() => setAuslaufScope("all")}
                                  >
                                    Ganzer Kader
                                  </button>
                                </div>
                              }
                            >
                              <span
                                className="team-auslauf-info"
                                title="Verträge mit LZ ≤ 1 enden nach MD10 dieser Saison — verlängere jetzt, sonst wird der Spieler beim Verkauf auf den Transfermarkt gestellt. Auch länger laufende Verträge lassen sich per Buyout auflösen — liegt VK/Ablöse über dem Buyout, lohnt sich der Verkauf."
                                aria-label="Hinweis zu Vertrags-Auslauf"
                              >
                                ⓘ
                              </span>
                              {contractRecommendationCounts &&
                              contractRecommendationCounts.abgeben +
                                contractRecommendationCounts.beobachten +
                                contractRecommendationCounts.verlaengern >
                                0 ? (
                                <div className="team-auslauf-board" aria-label="Board-Vorschlag">
                                  <span className="team-auslauf-board-label">Board-Vorschlag</span>
                                  <span className="team-auslauf-board-chips">
                                    <span className="team-auslauf-board-chip is-abgeben">
                                      {formatWholeNumber(contractRecommendationCounts.abgeben)}× abgeben
                                    </span>
                                    <span className="team-auslauf-board-chip is-beobachten">
                                      {formatWholeNumber(contractRecommendationCounts.beobachten)}× beobachten
                                    </span>
                                    <span className="team-auslauf-board-chip is-verlaengern">
                                      {formatWholeNumber(contractRecommendationCounts.verlaengern)}× verlängern
                                    </span>
                                  </span>
                                </div>
                              ) : null}
                              <StatChipRow aria-label="Auslauf-Kennzahlen">
                                <StatChip
                                  label={auslaufIsAll ? "Angezeigt" : "Auslaufend"}
                                  value={formatWholeNumber(auslaufDecorated.length)}
                                  tone={auslaufIsAll ? undefined : "warn"}
                                  sub={auslaufIsAll ? `davon ${formatWholeNumber(auslaufExpiringCount)} auslaufend` : "LZ läuft aus"}
                                />
                                <StatChip
                                  label="Gehalt frei"
                                  value={formatNlMoney(auslaufSalaryFreed)}
                                  sub="bei Verkauf aller"
                                />
                                <StatChip
                                  label="Ø PPs"
                                  value={auslaufAvgPps != null ? formatLocalePoints(auslaufAvgPps, 1) : "—"}
                                  sub="Saison-Schnitt"
                                />
                              </StatChipRow>
                              <div className="team-auslauf-grid" role="list">
                                {auslaufSorted.map(({ row, ratings, currentSalary, ppsSeason, netProceeds, assessment }) => {
                                  const auslaufPlayer = auslaufPlayersById.get(row.playerId);
                                  const auslaufPortrait = auslaufPlayer ? getPlayerPortraitModel(auslaufPlayer) : null;
                                  const auslaufShapeClass = (row.contractShape ?? "balanced").replace("_", "-");
                                  return (
                                    <article className="team-auslauf-card" role="listitem" key={row.rowId ?? row.playerId}>
                                      <header className="team-auslauf-card-head">
                                        <PlayerPortrait
                                          className="team-auslauf-portrait"
                                          src={auslaufPortrait?.thumbSrc ?? auslaufPortrait?.src ?? null}
                                          initials={auslaufPortrait?.initials ?? String(row.playerName ?? "?").slice(0, 2)}
                                          alt={row.playerName}
                                        />
                                        <div className="team-auslauf-card-ident">
                                          <button
                                            type="button"
                                            className="nl-teams-playerlink"
                                            onClick={() => void openPlayerDrawerById(row.playerId)}
                                          >
                                            <span className="nl-teams-playername">{row.playerName}</span>
                                            <span className="nl-teams-playermeta">
                                              {(row.roleTag ?? "").toLowerCase() === "prospect" ? "Kader" : (row.roleTag ?? "Kader")}
                                            </span>
                                          </button>
                                          {row.contractLength <= 1 ? (
                                            <span
                                              className="team-contract-lz-chip is-expiring heat-band-1 team-auslauf-lz"
                                              title="Letzte Vertragssaison — endet nach MD10. Verlängern, sonst wandert der Spieler beim Verkauf auf den Transfermarkt."
                                            >
                                              läuft aus
                                            </span>
                                          ) : (
                                            <span
                                              className="team-contract-lz-chip team-auslauf-lz team-auslauf-lz-neutral"
                                              title={`Vertrag läuft noch ${formatWholeNumber(row.contractLength)} Saisons — per Buyout auflösbar.`}
                                            >
                                              {formatWholeNumber(row.contractLength)} Saisons
                                            </span>
                                          )}
                                        </div>
                                      </header>
                                      {/* OVR, PPs und MVS als die drei Leitzahlen — OVR steht an
                                          vielen Stellen im Spiel, PPs sind die erzielten Punkte,
                                          MVS beantwortet die Gehaltsfrage. */}
                                      <div className="team-auslauf-perf" aria-label="Leistung">
                                        <span className="team-auslauf-stat">
                                          <small>OVR</small>
                                          <strong>{ratings?.ovrNormalized != null ? formatWholeNumber(ratings.ovrNormalized) : "—"}</strong>
                                        </span>
                                        <span className="team-auslauf-stat">
                                          <small>PPs Saison</small>
                                          <strong>
                                            {ppsSeason != null ? formatLocalePoints(ppsSeason, 1) : "—"}
                                            {ratings?.ppsSeasonRank != null ? ` · #${formatWholeNumber(ratings.ppsSeasonRank)}` : ""}
                                          </strong>
                                        </span>
                                        <span className="team-auslauf-stat">
                                          <small>MVS</small>
                                          <strong>
                                            {ratings?.mvs != null ? formatLocalePoints(ratings.mvs, 1) : "—"}
                                            {ratings?.mvsRank != null ? ` · #${formatWholeNumber(ratings.mvsRank)}` : ""}
                                          </strong>
                                        </span>
                                      </div>
                                      {/* PPs je Achse mit Ligarang. Achsen ohne Punkte bleiben
                                          sichtbar und gedaempft stehen: dass ein Spieler dort
                                          nichts liefert, ist selbst eine Aussage. */}
                                      {ratings ? (
                                        <div className="team-auslauf-axes" aria-label="PPs je Achse">
                                          {AUSLAUF_ACHSEN.map((achse) => {
                                            const wert = ratings[achse.wertKey];
                                            const rang = ratings[achse.rangKey];
                                            const leer = wert == null || wert <= 0;
                                            return (
                                              <span
                                                key={achse.kuerzel}
                                                className={`team-auslauf-axis is-${achse.ton}${leer ? " is-empty" : ""}`}
                                                title={`${achse.titel}: ${wert != null ? formatLocalePoints(wert, 1) : "—"} PPs${rang != null ? `, Liga-Rang ${formatWholeNumber(rang)}` : ""}`}
                                              >
                                                <b>{achse.kuerzel}</b>
                                                <span className="team-auslauf-axis-val">
                                                  {wert != null ? formatLocalePoints(wert, 1) : "—"}
                                                </span>
                                                <span className="team-auslauf-axis-rank">
                                                  {!leer && rang != null ? `#${formatWholeNumber(rang)}` : "—"}
                                                </span>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                      <dl className="team-auslauf-facts">
                                        <div>
                                          <dt>Gehalt</dt>
                                          <dd>{currentSalary != null ? formatNlMoney(currentSalary) : "—"}</dd>
                                        </div>
                                        <div>
                                          <dt>Buyout</dt>
                                          <dd>{row.buyoutCost != null ? formatNlMoney(row.buyoutCost) : "—"}</dd>
                                        </div>
                                        <div>
                                          <dt>VK/Ablöse</dt>
                                          <dd>{row.exitValue != null ? formatNlMoney(row.exitValue) : "—"}</dd>
                                        </div>
                                        {netProceeds != null ? (
                                          <div>
                                            <dt>Netto b. VK</dt>
                                            <dd>
                                              <span
                                                className={`team-auslauf-net ${netProceeds >= 0 ? "is-good" : "is-bad"}`}
                                              >
                                                {formatNlMoney(netProceeds)}
                                              </span>
                                            </dd>
                                          </div>
                                        ) : null}
                                        <div>
                                          <dt>Form</dt>
                                          <dd>
                                            <span className={`team-contract-shape is-${auslaufShapeClass}`}>
                                              {formatContractShapeLabel(row.contractShape)}
                                            </span>
                                          </dd>
                                        </div>
                                      </dl>
                                      <div className="team-auslauf-moral">
                                        {row.moraleContractIntent ? (
                                          <span
                                            className={`team-contract-intent-chip ${getContractIntentToneClass(row.moraleContractIntent)}`}
                                          >
                                            {formatMoraleContractIntentLabel(row.moraleContractIntent)}
                                          </span>
                                        ) : null}
                                        {row.morale != null ? (
                                          <span className="team-auslauf-morale-val" title={row.moraleMood ?? "Moral"}>
                                            {row.moraleSmiley ?? ""} {formatWholeNumber(row.morale)}
                                          </span>
                                        ) : null}
                                        {row.moraleRenewalRisk != null ? (
                                          <span className="team-auslauf-risk">
                                            Risiko {formatWholeNumber(row.moraleRenewalRisk)}%
                                          </span>
                                        ) : null}
                                      </div>
                                      {assessment ? (
                                        <div className="team-auslauf-verdict">
                                          {assessment.gehalt ? (
                                            <div
                                              className="team-auslauf-gauge"
                                              title="Verglichen wird mit Spielern derselben Marktwert-Klasse, ligaweit — nicht mit dem eigenen Kader. Berücksichtigt ist auch die Vertragslaufzeit, weil lange Verträge üblicherweise besser dotiert sind."
                                            >
                                              <span className="team-auslauf-gauge-head">
                                                <small>Gehalt gegen üblich</small>
                                                <strong className={`is-${gehaltsTon(assessment.gehaltsEinordnung)}`}>
                                                  {formatSignedDisplayMoney(assessment.gehalt.abweichung)}
                                                </strong>
                                              </span>
                                              <span className="team-auslauf-gauge-rail">
                                                <span className="team-auslauf-gauge-zero" />
                                                <span
                                                  className={`team-auslauf-gauge-bar is-${gehaltsTon(assessment.gehaltsEinordnung)}`}
                                                  style={gaugeStyle(assessment.gehalt.relativ)}
                                                />
                                              </span>
                                              <span className="team-auslauf-gauge-sub">
                                                üblich {formatNlMoney(assessment.gehalt.ueblich)}
                                              </span>
                                            </div>
                                          ) : null}
                                          {assessment.vkAbweichung != null ? (
                                            <div
                                              className="team-auslauf-gauge is-vk"
                                              title="Erzielbarer Verkaufspreis im Vergleich zum aktuellen Marktwert. Unter Marktwert heißt: ein Verkauf jetzt verbrennt Wert."
                                            >
                                              <span className="team-auslauf-gauge-head">
                                                <small>VK gegen Marktwert</small>
                                                <strong className={assessment.vkAbweichung >= 0 ? "is-good" : "is-bad"}>
                                                  {formatSignedDisplayMoney(assessment.vkAbweichung)}
                                                </strong>
                                              </span>
                                              <span className="team-auslauf-gauge-rail">
                                                <span className="team-auslauf-gauge-zero" />
                                                <span
                                                  className={`team-auslauf-gauge-bar ${assessment.vkAbweichung >= 0 ? "is-good" : "is-bad"}`}
                                                  style={gaugeStyle(
                                                    row.marketValueAtExit != null && row.marketValueAtExit > 0
                                                      ? assessment.vkAbweichung / row.marketValueAtExit
                                                      : 0,
                                                  )}
                                                />
                                              </span>
                                              <span className="team-auslauf-gauge-sub">
                                                MW {row.marketValueAtExit != null ? formatNlMoney(row.marketValueAtExit) : "—"}
                                              </span>
                                            </div>
                                          ) : null}
                                          <p className={`team-auslauf-advice is-${assessment.empfehlung}`}>
                                            <strong>{EMPFEHLUNG_LABEL[assessment.empfehlung]}</strong>
                                            <span>{assessment.begruendung}</span>
                                          </p>
                                        </div>
                                      ) : null}
                                      {/* Immer sichtbar: außerhalb des Season-End-Fensters
                                          ausgegraut + Tooltip statt versteckt (Discoverability). */}
                                      <div className="team-auslauf-actions" onClick={(event) => event.stopPropagation()}>
                                        <button
                                          className="nl-teams-action"
                                          type="button"
                                          disabled={!rosterActionsEnabled || contractRenewalBusy != null}
                                          title={renewActionTitle}
                                          onClick={() =>
                                            void openContractRenewalNegotiation({
                                              teamId: selectedTeam.teamId,
                                              playerId: row.playerId,
                                              playerName: row.playerName,
                                              contractLength: 2,
                                            })
                                          }
                                        >
                                          Verlängern
                                        </button>
                                        <span className="nl-teams-action-danger-group">
                                          <button
                                            className="nl-teams-action nl-teams-action-danger"
                                            type="button"
                                            disabled={!rosterActionsEnabled || marketSellBusy}
                                            title={sellActionTitle}
                                            onClick={() =>
                                              void openMarketSellModal(
                                                {
                                                  activePlayerId: row.rowId,
                                                  playerId: row.playerId,
                                                  playerName: row.playerName,
                                                  className: auslaufPlayer?.className ?? "—",
                                                  race: auslaufPlayer?.race ?? "—",
                                                  portraitUrl: auslaufPortrait?.previewSrc ?? auslaufPortrait?.src ?? null,
                                                },
                                                selectedTeam.teamId,
                                              )
                                            }
                                          >
                                            Verkaufen
                                          </button>
                                        </span>
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                            </NlCard>
                          );
                        })()
                      : null}
                    {selectedTeamContractTable ? (
                      <div className="team-contracts-forecast-row contract-forecast-panel">
                        <div className="team-contracts-section-head">
                          <strong>Gehaltsforecast</strong>
                          <span className="muted">Gebundene Summen je Saison</span>
                        </div>
                        {(() => {
                          const chart = buildContractForecastChartGeometry(
                            selectedTeamContractTable.totalsCommitted,
                            selectedTeamContractTable.totalsWithPreview,
                          );
                          if (!chart) {
                            return null;
                          }
                          return (
                            <svg
                              className="contract-forecast-chart-svg nl-tnum"
                              viewBox={`0 0 ${chart.width} ${chart.height}`}
                              preserveAspectRatio="xMidYMid meet"
                              role="img"
                              aria-label={`Gehaltsforecast: ${chart.bars.map((bar) => `${bar.label} ${formatDisplayMoney(bar.committedValue)}`).join(", ")}`}
                            >
                              <line
                                x1={0}
                                y1={chart.paddingTop + chart.innerHeight}
                                x2={chart.width}
                                y2={chart.paddingTop + chart.innerHeight}
                                className="contract-forecast-chart-axis"
                              />
                              {chart.bars.map((bar) => (
                                <g key={bar.label}>
                                  <rect
                                    x={bar.x}
                                    y={bar.y}
                                    width={bar.width}
                                    height={Math.max(bar.height, 1)}
                                    rx={3}
                                    className="contract-forecast-chart-bar is-committed"
                                  >
                                    <title>
                                      {bar.label} · {formatDisplayMoney(bar.committedValue)}
                                    </title>
                                  </rect>
                                  {bar.hasPreviewDelta ? (
                                    <rect
                                      x={bar.previewX}
                                      y={bar.previewY}
                                      width={bar.previewWidth}
                                      height={Math.max(bar.previewHeight, 1)}
                                      rx={3}
                                      className="contract-forecast-chart-bar is-preview"
                                    >
                                      <title>
                                        {bar.label} · Preview {formatDisplayMoney(bar.previewValue)}
                                      </title>
                                    </rect>
                                  ) : null}
                                  <text
                                    x={bar.centerX}
                                    y={Math.min(bar.y, bar.previewY ?? bar.y) - 6}
                                    textAnchor="middle"
                                    className="contract-forecast-chart-value"
                                  >
                                    {formatDisplayMoney(bar.committedValue)}
                                  </text>
                                  <text
                                    x={bar.centerX}
                                    y={chart.paddingTop + chart.innerHeight + 16}
                                    textAnchor="middle"
                                    className="contract-forecast-chart-label"
                                  >
                                    {bar.label}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          );
                        })()}
                      </div>
                    ) : null}
                    {selectedTeamContractTable ? (
                      <div className="team-contracts-expiry-panel" data-testid="team-contracts-expiry-timeline">
                        <div className="team-contracts-section-head">
                          <strong>Restlaufzeiten</strong>
                          <span className="muted">Wer läuft wann aus</span>
                        </div>
                        <div className="team-contracts-expiry-track nl-tnum">
                          {buildContractExpiryBuckets(
                            selectedTeamContractTable.rows,
                            selectedTeamContractTable.seasonLabels?.length,
                          ).map((bucket) => (
                            <div
                              key={`expiry-${bucket.year}`}
                              className={`team-contracts-expiry-bucket ${getContractLengthHeatBandClass(bucket.year)}`}
                            >
                              <div className="team-contracts-expiry-bucket-head">
                                <span>
                                  {bucket.year === 1 ? "Läuft aus" : `${bucket.year} J.${bucket.isOverflowBucket ? "+" : ""}`}
                                </span>
                                <strong>{bucket.rows.length}</strong>
                              </div>
                              <div className="team-contracts-expiry-bucket-players">
                                {bucket.rows.length > 0 ? (
                                  bucket.rows.map((row) => (
                                    <button
                                      key={row.rowId}
                                      type="button"
                                      className="team-contracts-expiry-chip"
                                      title={`${row.playerName} öffnen`}
                                      onClick={() => void openPlayerDrawerById(row.playerId)}
                                    >
                                      {row.playerName}
                                    </button>
                                  ))
                                ) : (
                                  <span className="team-contracts-expiry-empty">—</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedTeamContractShapeMix ? (
                      <div className="team-contract-mix-panel">
                        <div className="team-contracts-section-head">
                          <strong>Vertragsmix</strong>
                          <span className="muted nl-tnum">
                            {selectedTeamContractShapeMix.nonBalancedCount}/{selectedTeamContractShapeMix.totalCount} strukturiert
                          </span>
                        </div>
                        <div
                          className="team-contract-mix-segbar"
                          role="img"
                          aria-label={`Vertragsmix: ${selectedTeamContractShapeMix.entries.map((entry) => `${entry.label} ${formatLocalePoints(entry.share, 0)}%`).join(", ")}`}
                        >
                          {selectedTeamContractShapeMix.entries.map((entry) =>
                            entry.share > 0 ? (
                              <span
                                key={entry.shape}
                                className={`team-contract-mix-segbar-seg is-${entry.shape.replace("_", "-")}`}
                                style={{ width: `${entry.share}%` }}
                                title={`${entry.label} · ${entry.count} · ${formatLocalePoints(entry.share, 0)}%`}
                              />
                            ) : null,
                          )}
                        </div>
                        <div className="team-contract-mix-segbar-legend">
                          {selectedTeamContractShapeMix.entries.map((entry) => (
                            <span
                              key={`legend-${entry.shape}`}
                              className={`team-contract-mix-segbar-legend-item is-${entry.shape.replace("_", "-")}`}
                            >
                              <i aria-hidden="true" /> {entry.label} <strong>{entry.count}</strong>
                            </span>
                          ))}
                        </div>
                        <details className="team-contracts-mix-details">
                          <summary>Struktur-Details</summary>
                          <div className="team-contract-mix-grid">
                            {selectedTeamContractShapeMix.entries.map((entry) => (
                              <article className={`team-contract-mix-card is-${entry.shape.replace("_", "-")}`} key={entry.shape}>
                                <div className="team-contract-mix-card-head">
                                  <span>{entry.label}</span>
                                  <strong>{formatLocalePoints(entry.share, 0)}%</strong>
                                </div>
                                <div className="team-contract-mix-metrics">
                                  <span>
                                    <strong>{entry.count}</strong> Verträge
                                  </span>
                                  <span>
                                    <strong>{formatDisplayMoney(entry.totalSalary)}</strong> gebunden
                                  </span>
                                </div>
                              </article>
                            ))}
                          </div>
                        </details>
                      </div>
                    ) : null}
                    <div className="team-contracts-toolbar">
                      {selectedTeamContractPreviewRowCount > 0 ? (
                        <button
                          className={`secondary-button inline-button${showTeamContractPreviewRows ? " is-active" : ""}`}
                          type="button"
                          onClick={() => setShowTeamContractPreviewRows((current) => !current)}
                          title={showTeamContractPreviewRows ? "Preview-Zeilen ausblenden" : "Preview-Zeilen einblenden"}
                        >
                          Preview {showTeamContractPreviewRows ? "an" : "aus"} · {selectedTeamContractPreviewRowCount}
                        </button>
                      ) : null}
                    </div>
                    {(() => {
                        const nlContractRows = (() => {
                          const base = visibleSelectedTeamContractRows ?? [];
                          if (!nlContractSort) {
                            return base;
                          }
                          const dir = nlContractSort.direction === "asc" ? 1 : -1;
                          // Einmal je Zeile statt einmal je Vergleich — die Treppe wird
                          // beim Rendern ohnehin gebaut, hier nur der aktuelle Betrag.
                          const currentSalaryByRowId = new Map(
                            base.map((row) => [
                              row.rowId,
                              buildContractSalarySteps(row, selectedTeamContractTable?.seasonLabels).currentSalary,
                            ]),
                          );
                          const readSortValue = (row) => {
                            switch (nlContractSort.key) {
                              case "player":
                                return row.playerName;
                              case "status":
                                return row.status;
                              case "shape":
                                return formatContractShapeLabel(row.contractShape);
                              case "lz":
                                return row.contractLength;
                              case "morale":
                                return row.morale;
                              case "intent":
                                return row.moraleContractIntent
                                  ? formatMoraleContractIntentLabel(row.moraleContractIntent)
                                  : null;
                              case "buyout":
                                return row.buyoutCost;
                              case "exit":
                                return row.exitValue;
                              // "Akt. MW" — aktueller Marktwert VOR Sale-Factor (siehe
                              // TeamContractSeasonRow: marketValueAtExit ist trotz des
                              // Namens die Basis, exitValue = marketValueAtExit * saleFactor
                              // und steht schon in der VK-Spalte — hier also keine Dublette).
                              case "marketValueNow":
                                return row.marketValueAtExit;
                              // Gehaltsverlauf sortiert nach dem AKTUELLEN Saisongehalt —
                              // also nach genau der Zahl, die die Zelle neben der Treppe
                              // zeigt. Vorher lief die Sortierung über `totalSalary` (Summe
                              // über die ganze Laufzeit), die Zelle zeigte aber die letzte
                              // Vertragssaison: drei verschiedene Größen, und der oberste
                              // Spieler war weder der teuerste von heute noch der mit der
                              // größten angezeigten Zahl. Die Laufzeit-Summe steht weiter im
                              // Tooltip der Spalte und in der Fußzeile.
                              case "salary":
                                return currentSalaryByRowId.get(row.rowId) ?? null;
                              case "ovr":
                                return rosterRowByPlayerId.get(row.playerId)?.playerOvr ?? null;
                              case "mvs":
                                return rosterRowByPlayerId.get(row.playerId)?.playerMvs ?? null;
                              // Achsen-PPs (POW/SPE/MEN/SOC) — je Achse einzeln sortierbar
                              // über den Klick auf den jeweiligen Chip in der PPs-Zelle.
                              case "pps:pow":
                                return rosterRowByPlayerId.get(row.playerId)?.ppPow ?? null;
                              case "pps:spe":
                                return rosterRowByPlayerId.get(row.playerId)?.ppSpe ?? null;
                              case "pps:men":
                                return rosterRowByPlayerId.get(row.playerId)?.ppMen ?? null;
                              case "pps:soc":
                                return rosterRowByPlayerId.get(row.playerId)?.ppSoc ?? null;
                              // Die Summe, die der Spieler in dieser Saison geholt hat — dieselbe
                              // Zahl, die auch die Spielerliste als „PPs" führt (`playerPps`),
                              // NICHT die Summe der vier Achsen-Chips nachgerechnet.
                              case "ppsTotal":
                                return rosterRowByPlayerId.get(row.playerId)?.playerPps ?? null;
                              default:
                                return null;
                            }
                          };
                          return [...base].sort((left, right) => {
                            const leftValue = readSortValue(left);
                            const rightValue = readSortValue(right);
                            if (leftValue == null && rightValue == null) return 0;
                            if (leftValue == null) return 1;
                            if (rightValue == null) return -1;
                            if (typeof leftValue === "string") {
                              return leftValue.localeCompare(String(rightValue), "de-DE") * dir;
                            }
                            return (leftValue - rightValue) * dir;
                          });
                        })();
                        const handleNlContractSort = (key: string) =>
                          setNlContractSort((prev) =>
                            prev?.key === key
                              ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
                              : // Erster Klick auf eine Spalte sortiert IMMER absteigend zuerst
                                // (höchster/"bester" Wert zuerst, Z→A bei Text) — das ist die
                                // natürliche Erwartung ("wer verdient am meisten?", "wer läuft
                                // zuerst aus?") und erspart einen sonst nötigen zweiten Klick.
                                // Erst der zweite Klick auf dieselbe Spalte schaltet auf "asc".
                                { key, direction: "desc" },
                          );
                        const nlContractColumns = [
                          { key: "player", label: "Spieler", sortable: true },
                          { key: "status", label: "Status", sortable: true },
                          { key: "shape", label: "Form", sortable: true },
                          { key: "lz", label: "LZ", align: "center", sortable: true },
                          { key: "morale", label: "Moral", align: "center", sortable: true },
                          { key: "intent", label: "Intent", sortable: true },
                          { key: "buyout", label: "Buyout", align: "right", sortable: true },
                          { key: "exit", label: "VK", align: "right", sortable: true },
                          {
                            key: "marketValueNow",
                            label: "Akt. MW",
                            align: "right",
                            sortable: true,
                            tooltip: "Aktueller Marktwert inkl. Transfermarkt-Sale-Factor (der Faktor ×… steht klein daneben). Nicht zu verwechseln mit VK — das ist der Preis NACH Anwendung des Faktors.",
                          },
                          {
                            key: "ovr",
                            label: "OVR",
                            align: "right",
                            sortable: true,
                            tooltip: "Gesamtstärke (Overall).",
                          },
                          {
                            key: "mvs",
                            label: "MVS",
                            align: "right",
                            sortable: true,
                            tooltip: "Marktwert-Score.",
                          },
                          /**
                           * GEMELDET: „Und mir fehlt noch eine Spalte für die Gesamt PPs die der
                           * spieler geholt hat."
                           *
                           * Die PPs-Zelle daneben zeigt die vier Achsen einzeln — die Summe stand
                           * nirgends, und aus vier Balken im Kopf zu addieren ist keine Antwort.
                           * Die Zahl kommt aus derselben Quelle wie die PPs-Spalte der
                           * Spielerliste (`playerPps` aus dem Season-Points-Ledger), damit nicht
                           * zwei Ansichten verschiedene Summen für denselben Spieler zeigen.
                           */
                          {
                            key: "ppsTotal",
                            label: "PPs ges.",
                            align: "right",
                            sortable: true,
                            tooltip:
                              "Performance-Punkte dieser Saison insgesamt — die Summe über alle Disziplinen. Die Aufschlüsselung nach Bereich steht in der Spalte daneben.",
                          },
                          {
                            key: "pps",
                            label: "PPs",
                            tooltip:
                              "Season-Performance-Punkte nach Bereich (POW/SPE/MEN/SOC) — jede Achse einzeln anklickbar zum Sortieren, ausklappbar für die Disziplin-PPs.",
                            width: 168,
                          },
                          { key: "salary", label: "Gehaltsverlauf", sortable: true, tooltip: "Treppe = Gehalt je Vertragssaison. Die Zahl daneben ist das AKTUELLE Saisongehalt — danach wird auch sortiert." },
                          { key: "actions", label: "Aktionen", align: "right" },
                        ];
                        const renderNlContractCell = (row, column) => {
                          const isSellMarked =
                            row.status === "active" &&
                            selectedTeam != null &&
                            transferSellMarkerKeySet.has(`${selectedTeam.teamId}:${row.playerId}`);
                          const shapeClass = (row.contractShape ?? "balanced").replace("_", "-");
                          switch (column.key) {
                            case "player":
                              return (
                                <div className="table-player-cell">
                                  <button
                                    type="button"
                                    className="nl-teams-playerlink"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void openPlayerDrawerById(row.playerId);
                                    }}
                                  >
                                    <span className="nl-teams-playername">{row.playerName}</span>
                                    <span className="nl-teams-playermeta">{(row.roleTag ?? "").toLowerCase() === "prospect" ? "Kader" : (row.roleTag ?? "Kader")}</span>
                                  </button>
                                  {isSellMarked ? <span className="pill pill-warning">VK vorgemerkt</span> : null}
                                </div>
                              );
                            case "status":
                              return (
                                <span className={`team-status-chip is-${row.status === "preview" ? "preview" : "active"}`}>
                                  {row.status === "preview" ? "Preview" : "Aktiv"}
                                </span>
                              );
                            case "shape":
                              return (
                                <span className={`team-contract-shape is-${shapeClass}`}>
                                  {formatContractShapeLabel(row.contractShape)}
                                </span>
                              );
                            case "lz":
                              return row.contractLength <= 1 ? (
                                <span
                                  className={`team-contract-lz-chip is-expiring ${getContractLengthHeatBandClass(row.contractLength)}`}
                                  title="Letzte Vertragssaison — endet nach MD10. Verlängern, sonst wandert der Spieler beim Verkauf auf den Transfermarkt."
                                >
                                  läuft aus
                                </span>
                              ) : (
                                <span className={`team-contract-lz-chip ${getContractLengthHeatBandClass(row.contractLength)}`}>
                                  {formatWholeNumber(row.contractLength)}
                                </span>
                              );
                            case "morale":
                              return row.morale != null ? (
                                <span title={row.moraleMood ?? "Moral"}>
                                  {row.moraleSmiley ?? ""} {formatWholeNumber(row.morale)}
                                  {row.moraleSalaryModifier != null ? ` · x${formatLocalePoints(row.moraleSalaryModifier, 2)}` : ""}
                                </span>
                              ) : (
                                "—"
                              );
                            case "intent":
                              return row.moraleContractIntent ? (
                                <span
                                  className={`team-contract-intent-chip ${getContractIntentToneClass(row.moraleContractIntent)}`}
                                  title={
                                    row.moraleRenewalRisk != null
                                      ? `Renewal Risk ${formatWholeNumber(row.moraleRenewalRisk)}%`
                                      : undefined
                                  }
                                >
                                  {formatMoraleContractIntentLabel(row.moraleContractIntent)}
                                </span>
                              ) : (
                                "—"
                              );
                            case "buyout":
                              return row.buyoutCost != null ? formatNlMoney(row.buyoutCost) : "—";
                            case "exit":
                              return row.exitValue != null ? formatNlMoney(row.exitValue) : "—";
                            case "marketValueNow":
                              // marketValueAtExit ist im Row-Modell trotz des Namens die
                              // Basis VOR dem Sale-Factor (siehe contract-negotiation-preview.ts /
                              // transfermarkt-sale-factor.ts: exitValue = marketValueAtExit ×
                              // saleFactor) — also der AKTUELLE Marktwert, keine Dublette der
                              // VK-Spalte. Faktor klein daneben, Betrag groß.
                              return row.marketValueAtExit != null ? (
                                <span className="team-contract-mv-cell nl-tnum">
                                  <strong>{formatNlMoney(row.marketValueAtExit)}</strong>
                                  {row.saleFactor != null ? (
                                    <span className="team-contract-mv-cell-factor">
                                      · ×{formatNlNumber(row.saleFactor, 2)}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                "—"
                              );
                            case "ovr": {
                              const value = rosterRowByPlayerId.get(row.playerId)?.playerOvr ?? null;
                              return value != null ? formatWholeNumber(value) : "—";
                            }
                            case "mvs": {
                              const value = rosterRowByPlayerId.get(row.playerId)?.playerMvs ?? null;
                              return value != null ? formatPpsValue(value) : "—";
                            }
                            case "ppsTotal": {
                              const rosterRow = rosterRowByPlayerId.get(row.playerId) ?? null;
                              const value = rosterRow?.playerPps ?? null;
                              if (value == null) {
                                return "—";
                              }
                              return (
                                <span className="selected-roster-pps-total nl-tnum">
                                  {formatPpsValue(value)}
                                  {rosterRow?.ppsRank != null ? (
                                    <small className="selected-roster-pps-total-rank" title="Ligaweiter Platz nach Season-PPs.">
                                      #{formatWholeNumber(rosterRow.ppsRank)}
                                    </small>
                                  ) : null}
                                </span>
                              );
                            }
                            case "pps": {
                              const rosterRow = rosterRowByPlayerId.get(row.playerId) ?? null;
                              const contractPpsAxes = [
                                { axis: "pow", label: "POW", value: rosterRow?.ppPow ?? null },
                                { axis: "spe", label: "SPE", value: rosterRow?.ppSpe ?? null },
                                { axis: "men", label: "MEN", value: rosterRow?.ppMen ?? null },
                                { axis: "soc", label: "SOC", value: rosterRow?.ppSoc ?? null },
                              ];
                              const isContractPpsExpanded = expandedContractPpsPlayerId === row.playerId;
                              const activeAxis = nlContractSort?.key?.startsWith("pps:")
                                ? nlContractSort.key.slice("pps:".length)
                                : null;
                              return (
                                <div className="selected-roster-pps-cell" onClick={(event) => event.stopPropagation()}>
                                  {renderPpsAxisStrip(contractPpsAxes, row.playerName, {
                                    activeAxis,
                                    onSort: (axis) => handleNlContractSort(`pps:${axis}`),
                                  })}
                                  <button
                                    className={`selected-roster-pps-diszi-toggle${isContractPpsExpanded ? " is-open" : ""}`}
                                    type="button"
                                    aria-expanded={isContractPpsExpanded}
                                    aria-controls={`contract-pps-diszi-${row.rowId}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setExpandedContractPpsPlayerId((current) =>
                                        current === row.playerId ? null : row.playerId,
                                      );
                                    }}
                                  >
                                    <span className="selected-roster-pps-diszi-chevron" aria-hidden="true" />
                                    <span>{isContractPpsExpanded ? "Disziplinen schließen" : "Disziplin-PPs"}</span>
                                  </button>
                                </div>
                              );
                            }
                            case "salary": {
                              const staircase = buildContractSalarySteps(row, selectedTeamContractTable?.seasonLabels);
                              return (
                                <div className={`team-contract-salary-cell is-${shapeClass}`}>
                                  <div
                                    className="team-contract-salary-steps"
                                    role="img"
                                    aria-label={`Gehaltsverlauf ${row.playerName}: ${staircase.steps
                                      .map((step) => `${step.label} ${step.salary != null ? formatDisplayMoney(step.salary) : "kein Vertrag"}`)
                                      .join(", ")}`}
                                  >
                                    {staircase.steps.map((step) => (
                                      <span
                                        key={`${row.rowId}-${step.label}`}
                                        className={joinClassNames(
                                          "team-contract-salary-step",
                                          step.isEmpty && "is-empty",
                                          step.isLast && !step.isEmpty && "is-last",
                                        )}
                                        style={{ height: `${step.heightPct}%` }}
                                        title={`${step.label} · ${step.salary != null ? formatDisplayMoney(step.salary) : "kein Vertrag"}`}
                                      />
                                    ))}
                                  </div>
                                  {/* AKTUELLES Saisongehalt — was das Team heute zahlt, und
                                      die Größe, nach der die Spalte sortiert. Vorher stand
                                      hier die LETZTE Vertragssaison: bei front-/back-loaded
                                      Verträgen eine ganz andere Zahl als die aktuelle Last,
                                      und sortiert wurde nach einer dritten (Laufzeit-Summe).
                                      Der komplette Verlauf steckt weiter in der Treppe
                                      daneben, jeder Balken mit eigenem Tooltip. */}
                                  <span
                                    className="team-contract-salary-cell-value nl-tnum"
                                    title={
                                      staircase.lastActiveSalary != null && staircase.currentSalary != null
                                        ? `Aktuelle Saison ${formatDisplayMoney(staircase.currentSalary)} · letzte Vertragssaison ${formatDisplayMoney(staircase.lastActiveSalary)}`
                                        : "Aktuelles Saisongehalt"
                                    }
                                  >
                                    {staircase.currentSalary != null ? formatDisplayMoney(staircase.currentSalary) : "—"}
                                  </span>
                                </div>
                              );
                            }
                            case "actions":
                              /* T-036-Follow-up: „Verkaufen" ist destruktiv (öffnet die
                                 Verkaufs-Vorschau) und stand bislang optisch ununterscheidbar
                                 direkt neben „Verlängern" → Fehlklick-Gefahr, analog zum
                                 bereits behobenen Fall in FoundationTeamsNewLook.tsx.
                                 Fix nach demselben Muster: „Verlängern" (unkritisch) zuerst,
                                 „Verkaufen" in eigener Danger-Gruppe mit Abstand/Trennlinie
                                 und Warnstil (`nl-teams-action-danger-group` /
                                 `nl-teams-action-danger`, bereits vorhanden). */
                              /* Immer sichtbar (statt hinter `selectedTeamRosterActionsAvailable`
                                 versteckt): außerhalb des Season-End-Fensters ausgegraut +
                                 Tooltip. „Verlängern" rendert jetzt für ALLE aktiven Verträge —
                                 das Verhandlungsfenster erklärt selbst, warum LZ > 1 (noch)
                                 blockiert ist. */
                              return row.status === "active" ? (
                                <div className="transfermarkt-inline-actions" onClick={(event) => event.stopPropagation()}>
                                  {selectedTeam ? (
                                    <button
                                      className="nl-teams-action"
                                      type="button"
                                      disabled={!rosterActionsEnabled || contractRenewalBusy != null}
                                      title={renewActionTitle}
                                      onClick={() =>
                                        void openContractRenewalNegotiation({
                                          teamId: selectedTeam.teamId,
                                          playerId: row.playerId,
                                          playerName: row.playerName,
                                        })
                                      }
                                    >
                                      Verlängern
                                    </button>
                                  ) : null}
                                  {selectedTeam ? (
                                    <button
                                      className="nl-teams-action"
                                      type="button"
                                      onClick={() =>
                                        toggleTransferSellMarker({
                                          teamId: selectedTeam.teamId,
                                          playerId: row.playerId,
                                          playerName: row.playerName,
                                          contractLength: row.contractLength,
                                          buyoutCost: row.buyoutCost,
                                          marketValueAtExit: row.marketValueAtExit,
                                          morale: row.morale,
                                        })
                                      }
                                    >
                                      {isSellMarked ? "VK gemerkt" : "VK vormerken"}
                                    </button>
                                  ) : null}
                                  <span className="nl-teams-action-danger-group">
                                    <button
                                      className="nl-teams-action nl-teams-action-danger"
                                      type="button"
                                      disabled={!rosterActionsEnabled || marketSellBusy}
                                      title={sellActionTitle}
                                      onClick={() =>
                                        void openMarketSellModal(
                                          {
                                            activePlayerId: row.rowId,
                                            playerId: row.playerId,
                                            playerName: row.playerName,
                                            className:
                                              gameState.players.find((candidate) => candidate.id === row.playerId)?.className ?? "—",
                                            race: gameState.players.find((candidate) => candidate.id === row.playerId)?.race ?? "—",
                                            portraitUrl:
                                              gameState.players.find((candidate) => candidate.id === row.playerId)?.portraitUrl ?? null,
                                          },
                                          selectedTeam?.teamId,
                                        )
                                      }
                                    >
                                      Verkaufen
                                    </button>
                                  </span>
                                </div>
                              ) : (
                                "—"
                              );
                            default:
                              return "—";
                          }
                        };
                        if (!nlContractRows.length) {
                          return (
                            <NlEmptyState
                              icon="📄"
                              title={selectedTeamContractTable?.rows.length ? "Nur Preview-Zeilen vorhanden" : "Noch keine Vertragsdaten"}
                              message={
                                selectedTeamContractTable?.rows.length
                                  ? "Schalte Preview ein, um die Draft-Zeilen zu sehen."
                                  : "In diesem Scope liegen noch keine Verträge vor."
                              }
                              action={
                                selectedTeamContractTable?.rows.length && selectedTeamContractPreviewRowCount > 0
                                  ? { label: "Preview einblenden", onClick: () => setShowTeamContractPreviewRows(true) }
                                  : undefined
                              }
                            />
                          );
                        }
                        const totalCommitted = (selectedTeamContractTable?.totalsCommitted ?? []).reduce(
                          (sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0),
                          0,
                        );
                        const totalWithPreview = (selectedTeamContractTable?.totalsWithPreview ?? []).reduce(
                          (sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0),
                          0,
                        );
                        return (
                          <div className="team-contracts-nl-table">
                            <NlTable
                              aria-label="Vertragsübersicht"
                              data-testid="teams-v2-contracts-table"
                              className="team-contracts-table"
                              zebra={false}
                              columns={nlContractColumns}
                              rows={nlContractRows}
                              rowKey={(row) => row.rowId}
                              rowClassName={(row) => {
                                const isSellMarked =
                                  row.status === "active" &&
                                  selectedTeam != null &&
                                  transferSellMarkerKeySet.has(`${selectedTeam.teamId}:${row.playerId}`);
                                return (
                                  [
                                    row.status === "preview" && "is-preview-row",
                                    row.contractLength <= 1 && "is-contract-expiring",
                                    isSellMarked && "is-sell-marked",
                                  ]
                                    .filter(Boolean)
                                    .join(" ") || undefined
                                );
                              }}
                              sortState={nlContractSort}
                              onSort={handleNlContractSort}
                              /**
                               * GEMELDET: „ich finde auch das verkaufsfenster sollte ggf als
                               * drawer oder so rein kommen schon wenn man den spieler in der
                               * zeile anklickt, damit man auch bei spielern die man nicht
                               * verkaufen will direkt sehen kann was das board dazu sagt!"
                               *
                               * Die Zeile öffnet deshalb den Einschätzungs-Drawer, nicht den
                               * Verkauf. Preview-Zeilen (Kaufdialog-Drafts) bleiben stumm — zu
                               * ihnen gibt es keinen Kaderspieler, den man abgeben könnte. Die
                               * Aktions-Knöpfe in der Zeile stoppen ihr Event bereits selbst,
                               * „Verkaufen" führt also weiterhin direkt zur Verkaufsseite.
                               */
                              onRowClick={
                                openMarketSellPeek && selectedTeam
                                  ? (row) => {
                                      if (row.status !== "active") {
                                        return;
                                      }
                                      const player = gameState.players.find((candidate) => candidate.id === row.playerId);
                                      void openMarketSellPeek(
                                        {
                                          activePlayerId: row.rowId,
                                          playerId: row.playerId,
                                          playerName: row.playerName,
                                          className: player?.className ?? "—",
                                          race: player?.race ?? "—",
                                          portraitUrl: player?.portraitUrl ?? null,
                                        },
                                        selectedTeam.teamId,
                                      );
                                    }
                                  : undefined
                              }
                              renderCell={renderNlContractCell}
                              isRowExpanded={(row) => expandedContractPpsPlayerId === row.playerId}
                              renderExpandedRow={(row) =>
                                renderPpsDisziPanel({
                                  name: row.playerName,
                                  axisGroups: rosterRowByPlayerId.get(row.playerId)?.disciplinePpsByAxis ?? [],
                                  panelId: `contract-pps-diszi-${row.rowId}`,
                                })
                              }
                            />
                            {/* Der Einschätzungs-Drawer hängt an der Tabelle, nicht an der
                                Seite: er gehört zu dieser Zeilenliste und schließt mit ihr. */}
                            <FoundationRosterSellPeekDrawer
                              subject={marketSellPeekSubject}
                              preview={marketSellPeekPreview}
                              busy={marketSellPeekBusy}
                              error={marketSellPeekError}
                              onClose={() => closeMarketSellPeek?.()}
                              onOpenSell={(subject) => {
                                void openMarketSellFromPeek?.(subject, selectedTeam?.teamId);
                              }}
                            />
                            {selectedTeamContractTable ? (
                              <StatChipRow aria-label="Gehaltssumme je Saison">
                                <StatChip label="Summe aktiv" value={formatDisplayMoney(totalCommitted)} sub="Team-Gehaltslast" />
                                <StatChip
                                  label="Summe mit Preview"
                                  value={formatDisplayMoney(totalWithPreview)}
                                  sub="inkl. Kaufdialog-Drafts"
                                  tone={Math.abs(totalWithPreview - totalCommitted) >= 0.01 ? "warn" : "neutral"}
                                />
                              </StatChipRow>
                            ) : null}
                          </div>
                        );
                      })()}
                  </div>
                )}
              </section>

              {selectedTeamDetailTab === "roster" ? (
                <>
                  <section className="panel teams-league-panel" id="teams-league-overview">
                    <div className="teams-comparison-header">
                      <div>
                        <span className="eyebrow">Teams · Liga</span>
                        <strong>Teamtabelle</strong>
                      </div>
                    </div>
                    <div className="table-shell teams-overview-shell" style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}>
                      <table className="team-table teams-overview-table">
                        <colgroup>
                          {visibleTeamsViewColumns.map((column) => (
                            <col key={column.id} style={{ width: `${getTableColumnWidth("teamsView", column)}px` }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr>
                            {visibleTeamsViewColumns.map((column) => (
                              <th
                                key={column.id}
                                {...getTableHeaderDragProps("teamsView", column, visibleTeamsViewColumns)}
                                className={
                                  column.id === "pow"
                                    ? "teams-view-head-pow"
                                    : column.id === "spe"
                                      ? "teams-view-head-spe"
                                      : column.id === "men"
                                        ? "teams-view-head-men"
                                        : column.id === "soc"
                                          ? "teams-view-head-soc"
                                          : ""
                                }
                                style={{ width: `${getTableColumnWidth("teamsView", column)}px`, minWidth: `${column.minWidth}px` }}
                                title={getTeamsViewColumnTitle(column.id)}
                              >
                                <div className="resizable-header-cell">
                                  <SortableHeader label={column.label} tableId="teamsView" columnKey={column.dataKey} sortState={tableSorts.teamsView} onToggle={toggleTableSort} />
                                  <span className="column-resizer" draggable={false} role="separator" aria-orientation="vertical" aria-label={`${column.label} Breite anpassen`} onMouseDown={(event) => startTableColumnResize("teamsView", column, event)} onDoubleClick={() => resetTableColumnWidth("teamsView", column)} />
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTeamsViewRows.map((row, rowIndex) => (
                            <tr
                              key={row.team.teamId}
                              className={joinClassNames(
                                selectedTeam?.teamId === row.team.teamId && "is-selected",
                                getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.team.teamId]),
                              )}
                              onClick={() => {
                                scheduleActiveManagerTeam(row.team.teamId, "manual_select");
                              }}
                            >
                              {visibleTeamsViewColumns.map((column) => {
                                if (column.id === "team") {
                                  const logo = getTeamLogoModel(row.team, { variant: "thumb" });
                                  return (
                                    <td key={column.id} className="teams-view-team-cell">
                                      <button
                                        className="table-link-button players-table-team-button"
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openTeamProfileById(row.team.teamId);
                                        }}
                                      >
                                        {shouldShowTeamRowLogo(row.team.teamId, rowIndex) && logo.src ? (
                                          <BudgetedMediaImage
                                            className="players-table-team-logo"
                                            src={logo.src}
                                            alt={`${row.team.name} Logo`}
                                            width={30}
                                            height={30}
                                            loading="lazy"
                                            fetchPriority="low"
                                            fallback={
                                              <span
                                                className="players-table-team-logo players-table-team-logo-placeholder"
                                                aria-label={`${row.team.name} Logo Platzhalter`}
                                              >
                                                {logo.initials}
                                              </span>
                                            }
                                          />
                                        ) : (
                                          <span
                                            className="players-table-team-logo players-table-team-logo-placeholder"
                                            aria-label={`${row.team.name} Logo Platzhalter`}
                                          >
                                            {logo.initials}
                                          </span>
                                        )}
                                        <span>{row.team.name}</span>
                                      </button>
                                    </td>
                                  );
                                }
                                if (column.id === "overallRank") return <td key={column.id} className="teams-view-rank-cell">{row.overallRank ?? "—"}</td>;
                                if (column.id === "cash") return <td key={column.id} className={`teams-view-finance-cell teams-view-cash-cell ${row.cash != null ? getSeasonCashHeatClass(row.cash, sortedTeamsViewRows) : ""}`}>{row.cash != null ? formatMoney(row.cash) : "—"}</td>;
                                if (column.id === "guv") return <td key={column.id} className={`teams-view-finance-cell ${row.guv == null ? "" : row.guv >= 0 ? "text-positive" : "text-negative"}`}>{row.guv != null ? formatLocalePoints(row.guv, 1) : "—"}</td>;
                                if (column.id === "roster") return <td key={column.id} className="teams-view-meta-cell">{row.rosterCount}</td>;
                                if (column.id === "mw") return <td key={column.id} className="teams-view-finance-cell">{row.marketValueTotal != null ? formatLocalePoints(row.marketValueTotal, 2) : "—"}</td>;
                                if (column.id === "salary") return <td key={column.id} className="teams-view-finance-cell">{formatLocalePoints(row.salaryTotal, 2)}</td>;
                                if (column.id === "sponsor") return <td key={column.id} className="teams-view-finance-cell">{row.sponsorTotal != null ? formatLocalePoints(row.sponsorTotal, 1) : "—"}</td>;
                                if (column.id === "pow") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("POW")} className={`teams-view-axis-cell teams-view-axis-cell-pow ${row.currentPowRank != null ? getRankHeatClass(row.currentPowRank, gameState.teams.length) : ""}`}>{row.currentPowRank != null ? formatWholeNumber(row.currentPowRank) : "—"}</td>;
                                if (column.id === "spe") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("SPE")} className={`teams-view-axis-cell teams-view-axis-cell-spe ${row.currentSpeRank != null ? getRankHeatClass(row.currentSpeRank, gameState.teams.length) : ""}`}>{row.currentSpeRank != null ? formatWholeNumber(row.currentSpeRank) : "—"}</td>;
                                if (column.id === "men") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("MEN")} className={`teams-view-axis-cell teams-view-axis-cell-men ${row.currentMenRank != null ? getRankHeatClass(row.currentMenRank, gameState.teams.length) : ""}`}>{row.currentMenRank != null ? formatWholeNumber(row.currentMenRank) : "—"}</td>;
                                if (column.id === "soc") return <td key={column.id} title={row.rosterCount === 0 ? "Kein aktiver Kader vorhanden" : getTeamAxisRankTooltip("SOC")} className={`teams-view-axis-cell teams-view-axis-cell-soc ${row.currentSocRank != null ? getRankHeatClass(row.currentSocRank, gameState.teams.length) : ""}`}>{row.currentSocRank != null ? formatWholeNumber(row.currentSocRank) : "—"}</td>;
                                if (column.id === "histPoints") {
                                  const rank = teamHistoryPointRankMaps.total.get(row.team.teamId);
                                  return <td key={column.id} className={`teams-view-history-points-cell ${rank != null ? getRankHeatClass(rank, gameState.teams.length) : ""}`}>{row.historicalPointsTotal != null ? formatLocalePoints(row.historicalPointsTotal, 1) : "—"}</td>;
                                }
                                if (column.id === "avgPoints") {
                                  const rank = teamHistoryPointRankMaps.average.get(row.team.teamId);
                                  return <td key={column.id} className={`teams-view-history-points-cell ${rank != null ? getRankHeatClass(rank, gameState.teams.length) : ""}`}>{row.avgPoints != null ? formatLocalePoints(row.avgPoints, 1) : "—"}</td>;
                                }
                                if (column.id === "gold") return <td key={column.id} className="teams-view-medal-cell" title="Goldmedaillen">🥇 {row.goldCount}</td>;
                                if (column.id === "silver") return <td key={column.id} className="teams-view-medal-cell" title="Silbermedaillen">🥈 {row.silverCount}</td>;
                                if (column.id === "bronze") return <td key={column.id} className="teams-view-medal-cell" title="Bronzemedaillen">🥉 {row.bronzeCount}</td>;
                                if (column.id === "top5") return <td key={column.id} className="teams-view-meta-cell">{row.top5}</td>;
                                if (column.id === "top10") return <td key={column.id} className="teams-view-meta-cell">{row.top10}</td>;
                                if (column.id === "avgRank") return <td key={column.id} className="teams-view-meta-cell">{row.avgRank != null ? formatWholeNumber(row.avgRank) : "—"}</td>;
                                if (column.id === "seasonPoints") {
                                  const historyEntries = [...row.historicalPointsBySeason].sort((left, right) =>
                                    left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }),
                                  );
                                  return (
                                    <td key={column.id} className="teams-view-season-points-cell">
                                      {historyEntries.length > 0 ? (
                                        <details>
                                          <summary>{historyEntries.length} Seasons</summary>
                                          <div className="teams-view-season-points-list">
                                            {historyEntries.map((entry) => (
                                              <span key={`${row.team.teamId}-${entry.seasonId}`}>
                                                <b>{entry.seasonName.replace("Season ", "S")}</b>
                                                {formatLocalePoints(entry.points, 1)}
                                                {entry.rank != null ? <small>#{entry.rank}</small> : null}
                                              </span>
                                            ))}
                                          </div>
                                        </details>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  );
                                }
                                return <td key={column.id}>—</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {showSecondaryPanels && selectedTeamsHistoryData ? (
                    <section className="panel teams-economy-panel" aria-label="Team-Kennzahlen">
                      <div className="teams-v2-focus-grid">
                        {teamEconomyTiles.map((tile) => (
                          <article key={tile.label} className={`teams-v2-focus-card is-${tile.tone}`} title={tile.detail}>
                            <span>{tile.label}</span>
                            <strong>{tile.value}</strong>
                            <small>{tile.note}</small>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {showSecondaryPanels ? (
                    <>
                  <section className="panel teams-history-panel teams-v2-history-panel" aria-label="Team-Historie">
                    <div className="teams-v2-section-head">
                      <div>
                        <TooltipHeading
                          as="h3"
                          tooltip="Live-Season zuerst, darunter die echten Team-Snapshots mit Rang, Punkten, PPs, Achsen, Cash, Gehalt und Marktwert."
                        >
                          {selectedTeam.name} · Historie
                        </TooltipHeading>
                      </div>
                    </div>
                    {selectedTeamsHistoryData?.history?.length ? (
                      <TeamDrawerHistoryTable
                        rows={selectedTeamsHistoryData.history}
                        getRowClassName={(row) => (row.isLive ? "is-live" : undefined)}
                        renderCell={(columnId, row) => {
                          if (columnId === "season") {
                            return (
                              <>
                                <strong>{row.seasonName}</strong>
                                {row.isLive ? <span className="pill">Live</span> : null}
                              </>
                            );
                          }
                          if (columnId === "rank") {
                            return (
                              <span className={`teams-v2-rank-cell ${getTeamHistoryRankToneClass(row.rank)}`}>
                                {row.rank != null ? `#${row.rank}` : "—"}
                              </span>
                            );
                          }
                          if (columnId === "points") return formatLocalePoints(row.points, 1);
                          if (columnId === "pps") return formatLocalePoints(row.pps, 1);
                          if (columnId === "pow") return formatLocalePoints(row.ppPow, 1);
                          if (columnId === "spe") return formatLocalePoints(row.ppSpe, 1);
                          if (columnId === "men") return formatLocalePoints(row.ppMen, 1);
                          if (columnId === "soc") return formatLocalePoints(row.ppSoc, 1);
                          if (isSeasonDisciplineKey(columnId)) {
                            return formatLocalePoints(row.disciplineValues[columnId], 1);
                          }
                          if (columnId === "cash") return formatNullableMoney(row.cash);
                          if (columnId === "salary") return formatNullableMoney(row.salaryTotal);
                          if (columnId === "mw") return formatNullableMoney(row.marketValue);
                          if (columnId === "guv") {
                            return (
                              <span className={row.guv != null && row.guv < 0 ? "text-negative" : "text-positive"}>
                                {formatSignedDisplayMoney(row.guv)}
                              </span>
                            );
                          }
                          if (columnId === "injuriesCount") {
                            return row.injuriesCount != null ? row.injuriesCount : "—";
                          }
                          if (columnId === "averageFatigue") {
                            return row.averageFatigue != null ? formatLocalePoints(row.averageFatigue, 1) : "—";
                          }
                          if (columnId === "topBuy") {
                            return row.topBuyPlayer ? (
                              <button
                                type="button"
                                className="teams-v2-history-transfer-link text-negative"
                                onClick={() => row.topBuyPlayerId && void openPlayerDrawerById(row.topBuyPlayerId)}
                              >
                                {row.topBuyPlayer} · {formatNullableMoney(row.topBuyAmount)}
                              </button>
                            ) : (
                              "—"
                            );
                          }
                          if (columnId === "topSell") {
                            return row.topSellPlayer ? (
                              <button
                                type="button"
                                className={`teams-v2-history-transfer-link ${row.topSellProfit != null && row.topSellProfit >= 0 ? "text-positive" : row.topSellProfit != null ? "text-negative" : ""}`}
                                onClick={() => row.topSellPlayerId && void openPlayerDrawerById(row.topSellPlayerId)}
                                title={
                                  row.topSellProfit != null
                                    ? row.topSellProfit >= 0
                                      ? `Verkaufsgewinn: ${formatSignedDisplayMoney(row.topSellProfit)}`
                                      : `Verlust: ${formatSignedDisplayMoney(row.topSellProfit)}`
                                    : undefined
                                }
                              >
                                {row.topSellPlayer} · {formatNullableMoney(row.topSellAmount)}
                                {row.topSellProfit != null ? ` (${formatSignedDisplayMoney(row.topSellProfit)})` : ""}
                              </button>
                            ) : (
                              "—"
                            );
                          }
                          return "—";
                        }}
                      />
                    ) : (
                      <p className="muted">Für dieses Team ist noch keine Historie verfügbar.</p>
                    )}
                  </section>

                  <section className="panel team-objectives-panel teams-secondary-objectives-panel" data-testid="team-board-objectives" id="team-board-objectives">
                    <div className="panel-header compact">
                      <div className="stack">
                        <h2>Board-Ziele</h2>
                        <p className="muted">Saisonziele für Sport, Finanzen, Transfers, Kader, Gebäude und Entwicklung.</p>
                      </div>
                      <div className="room-meta foundation-admin-meta">
                        <span className="pill" title={TEAM_BOARD_RATING_TOOLTIP}>
                          Board Rating {selectedBoardConfidence?.value ?? "—"}/10
                        </span>
                        <span
                          className={`transfer-status-pill${(selectedBoardConfidence?.pressure ?? 0) >= 8 ? " is-warning" : " is-ready"}`}
                          title={TEAM_BOARD_PRESSURE_TOOLTIP}
                        >
                          Druck {selectedBoardConfidence?.pressure ?? "—"}/10
                        </span>
                      </div>
                    </div>
                    <div className="teams-summary-grid history-summary-grid">
                      {selectedTeamObjectives.map((objective) => (
                        <article
                          key={`team-objective-${objective.objectiveId}`}
                          className="metric-card teams-summary-card"
                          title={`Grundlage: ${objective.source}`}
                        >
                          <span>{objective.category.toUpperCase()}</span>
                          <strong>{objective.label}</strong>
                          <small className="muted">
                            Ist {String(objective.currentValue ?? "—")} · Ziel {String(objective.targetValue ?? "—")}
                          </small>
                          <div className="room-meta foundation-admin-meta">
                            <span className={`transfer-status-pill${objective.status === "completed" ? " is-ready" : objective.status === "failed" || objective.status === "at_risk" ? " is-warning" : ""}`}>
                              {formatObjectiveStatusLabel(objective.status)}
                            </span>
                            {objective.rewardCash != null ? <span className="pill">Bonus {formatMoney(objective.rewardCash)}</span> : null}
                            {objective.penaltyCash != null ? <span className="pill">Malus {formatMoney(objective.penaltyCash)}</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                    {selectedBoardConfidence?.warnings.length ? (
                      <p className="muted">Board-Hinweise: {selectedBoardConfidence.warnings.map(formatCockpitReason).join(", ")}</p>
                    ) : null}
                  </section>
                    </>
                  ) : null}
                </>
              ) : null}

              {selectedTeamDetailTab === "roster" && showExtendedTeamPanels ? (
              <div className="foundation-main-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h2>Starter</h2>
                  </div>
                  <div className="roster-grid team-portraits-grid">
                    {starters.map(({ entry, player }) => {
                      const portrait = getPlayerPortraitModel(player);
                      const ratings = playerRatingsById.get(player.id);
                      const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
                      const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                      return (
                        <FoundationPlayerPortraitCard
                          key={entry.id}
                          playerId={player.id}
                          name={player.name}
                          portraitUrl={portrait.thumbSrc ?? portrait.src}
                          portraitInitials={portrait.initials}
                          playerOvr={ratings?.ovrNormalized ?? null}
                          playerMvs={ratings?.mvs ?? null}
                          playerPps={ratings?.ppsSeason ?? null}
                          ovrRank={ratings?.ovrRank ?? null}
                          mvsRank={ratings?.mvsRank ?? null}
                          ppsRank={ratings?.ppsSeasonRank ?? null}
                          pow={player.coreStats.pow}
                          spe={player.coreStats.spe}
                          men={player.coreStats.men}
                          soc={player.coreStats.soc}
                          axisPps={buildAxisPpsFromRating(ratings)}
                          leagueHeatPools={leaguePlayerHeatPools}
                          variant="team"
                          className={getClassColorClassName(player.className, "player-card-class-frame")}
                          subMeta={formatPlayerIdentitySubMeta(player) || null}
                          onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
                          title="Spielerprofil öffnen"
                          economyStats={[
                            {
                              label: "MW",
                              value: formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2),
                              delta:
                                marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                                  ? `${marketValueDelta > 0 ? "+" : ""}${formatLocalePoints(marketValueDelta, 2)}`
                                  : null,
                              deltaClass: marketValueDelta != null && marketValueDelta > 0 ? "text-positive" : marketValueDelta != null && marketValueDelta < 0 ? "text-negative" : "",
                            },
                            {
                              label: "Gehalt",
                              value: formatDisplayMoney(getRosterEntryDisplaySalary(entry, player)),
                              delta:
                                salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                                  ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                                  : null,
                              deltaClass: salaryDelta != null && salaryDelta < 0 ? "text-positive" : salaryDelta != null && salaryDelta > 0 ? "text-negative" : "",
                            },
                            { label: "LZ", value: `${entry.contractLength ?? "—"}${formatContractShapeShortLabel(entry.contractShape) ? ` · ${formatContractShapeShortLabel(entry.contractShape)}` : ""}` },
                          ]}
                        />
                      );
                    })}
                    {starters.length === 0 ? <p className="muted">Noch keine Starter im Kader.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Bench</h2>
                  </div>
                  <div className="roster-grid team-portraits-grid">
                    {bench.map(({ entry, player }) => {
                      const portrait = getPlayerPortraitModel(player);
                      const ratings = playerRatingsById.get(player.id);
                      const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
                      const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
                      return (
                        <FoundationPlayerPortraitCard
                          key={entry.id}
                          playerId={player.id}
                          name={player.name}
                          portraitUrl={portrait.thumbSrc ?? portrait.src}
                          portraitInitials={portrait.initials}
                          playerOvr={ratings?.ovrNormalized ?? null}
                          playerMvs={ratings?.mvs ?? null}
                          playerPps={ratings?.ppsSeason ?? null}
                          ovrRank={ratings?.ovrRank ?? null}
                          mvsRank={ratings?.mvsRank ?? null}
                          ppsRank={ratings?.ppsSeasonRank ?? null}
                          pow={player.coreStats.pow}
                          spe={player.coreStats.spe}
                          men={player.coreStats.men}
                          soc={player.coreStats.soc}
                          axisPps={buildAxisPpsFromRating(ratings)}
                          leagueHeatPools={leaguePlayerHeatPools}
                          variant="team"
                          className={getClassColorClassName(player.className, "player-card-class-frame")}
                          subMeta={formatPlayerIdentitySubMeta(player) || null}
                          onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
                          title="Spielerprofil öffnen"
                          economyStats={[
                            {
                              label: "MW",
                              value: formatLocalePoints(getRosterEntryDisplayMarketValue(entry, player), 2),
                              delta:
                                marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                                  ? `${marketValueDelta > 0 ? "+" : ""}${formatLocalePoints(marketValueDelta, 2)}`
                                  : null,
                              deltaClass: marketValueDelta != null && marketValueDelta > 0 ? "text-positive" : marketValueDelta != null && marketValueDelta < 0 ? "text-negative" : "",
                            },
                            {
                              label: "Gehalt",
                              value: formatDisplayMoney(getRosterEntryDisplaySalary(entry, player)),
                              delta:
                                salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                                  ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                                  : null,
                              deltaClass: salaryDelta != null && salaryDelta < 0 ? "text-positive" : salaryDelta != null && salaryDelta > 0 ? "text-negative" : "",
                            },
                            { label: "LZ", value: `${entry.contractLength ?? "—"}${formatContractShapeShortLabel(entry.contractShape) ? ` · ${formatContractShapeShortLabel(entry.contractShape)}` : ""}` },
                          ]}
                        />
                      );
                    })}
                    {bench.length === 0 ? <p className="muted">Keine Bench-Spieler im Moment.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Team Identity</h2>
                  </div>
                  {selectedIdentity ? (
                    <div className="identity-grid">
                      <article className="identity-card">
                        <span>Zielachsen</span>
                        <strong>
                          {selectedIdentity.pow}/{selectedIdentity.spe}/{selectedIdentity.men}/{selectedIdentity.soc}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Ambition / Finanzen</span>
                        <strong>
                          {selectedIdentity.ambition} / {selectedIdentity.finances}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Board / Harmony</span>
                        <strong>
                          {selectedIdentity.boardConfidence} / {selectedIdentity.harmony}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Manners / Coop</span>
                        <strong>
                          {selectedIdentity.manners} / {selectedIdentity.cooperation}
                        </strong>
                      </article>
                      <article className="identity-card">
                        <span>Popularity</span>
                        <strong>{selectedIdentity.popularity}</strong>
                      </article>
                    </div>
                  ) : (
                    <p className="muted">Für dieses Team liegt noch keine Identity vor.</p>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Freie Spieler</h2>
                  </div>
                  <div className="free-agent-list">
                    {freeAgents.map((player) => (
                      <article className="free-agent-card" key={player.id}>
                        <div>
                          <strong>{player.name}</strong>
                            <p className="muted">
                              <ClassColorChip className={player.className} /> ·{" "}
                              {player.preferredDisciplineIds.length ? (
                                player.preferredDisciplineIds.slice(0, 2).map((disciplineId, index) => (
                                  <span key={`${player.id}-pref-diszi-${disciplineId}`} style={{ display: "inline-flex", alignItems: "center" }}>
                                    {index > 0 ? " · " : ""}
                                    <DisciplineIcon disciplineId={disciplineId} label={disciplineId} className="discipline-icon-chip-inline" />
                                  </span>
                                ))
                              ) : (
                                "Allround"
                              )}
                            </p>
                        </div>
                        <div className="free-agent-stats">
                          <span>{formatWholeNumber(playerRatingsById.get(player.id)?.ovrNormalized ?? null)}</span>
                          <span>{formatLocalePoints(getPlayerDisplaySalary(player), 2)}</span>
                        </div>
                      </article>
                    ))}
                    {freeAgents.length === 0 ? <p className="muted">Keine freien Spieler gefunden.</p> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>AI Preview</h2>
                  </div>
                  {aiPreview ? (
                    <div className="stack">
                      <p>{aiPreview.summary}</p>
                      <div className="metric-grid compact">
                        <article className="metric-card">
                          <span>Need Score</span>
                          <strong>{aiPreview.needs.overallNeedScore.toFixed(2)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Roster Gap</span>
                          <strong>{aiPreview.needs.rosterGap.toFixed(2)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Budget Pressure</span>
                          <strong>{aiPreview.needs.budgetPressure.toFixed(2)}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Upkeep Pressure</span>
                          <strong>{aiPreview.needs.upkeepPressure.toFixed(2)}</strong>
                        </article>
                      </div>
                      <p className="muted">
                        Größte Lücken: {aiPreview.needs.uncoveredNeedAxes.join(", ") || "keine größeren Lücken"}
                      </p>
                      <p className="muted">
                        Priorisierte Disziplinen: {aiPreview.needs.topNeedDisciplineIds.join(", ") || "noch offen"}
                      </p>
                      <button
                        className="primary-button inline-button"
                        disabled={isPending || !selectedAiTeamId || isReadOnlyMode}
                        type="button"
                        onClick={() => {
                          if (isReadOnlyMode) {
                            showReadOnlyNotice();
                            return;
                          }

                          if (!selectedAiTeamId) {
                            return;
                          }

                          startTransition(() => {
                            setGameState((current) => {
                              const result = runAiTurn(current, selectedAiTeamId);
                              return {
                                ...current,
                                logs: [
                                  ...current.logs,
                                  {
                                    id: `ui-ai-${Date.now()}`,
                                    type: "ai",
                                    message: result.summary,
                                    createdAt: new Date().toISOString(),
                                  },
                                ],
                              };
                            });
                          });
                        }}
                      >
                        {isPending ? "AI arbeitet..." : "AI Turn simulieren"}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Kein KI-Team für eine Vorschau verfügbar.</p>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h2>Transfermarkt-Tendenz</h2>
                  </div>
                  <ul className="debug-list">
                    {aiMarketPreview.slice(0, 6).map((intent) => (
                      <li key={intent.listingId}>
                        {intent.listingId} · {intent.action} · {intent.score.toFixed(2)}
                      </li>
                    ))}
                    {aiMarketPreview.length === 0 ? <li>Noch keine verwertbaren Marktimpulse.</li> : null}
                  </ul>
                </section>
              </div>
              ) : null}
            </>
    </div>
  );
}

export default memo(FoundationTeamsDetailPanel);
