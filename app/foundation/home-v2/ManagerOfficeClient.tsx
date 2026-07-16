"use client";

import { useEffect, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { VeloImpactStrip, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import { isSeasonOnePreseasonNeutralBoard } from "@/lib/board/team-season-objectives-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { GmStoryView } from "@/lib/foundation/gm-story";
import type { GameInboxItem, TeamControlMode } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { SeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDisplayMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTransfermarktCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLocalePoints(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function formatWholeNumber(value: number | null | undefined) {
  return formatLocalePoints(value, 0);
}

function formatTeamControlModeLabel(mode: TeamControlMode | null | undefined) {
  if (mode === "manual") return "geführt";
  if (mode === "ai") return "automatisch";
  if (mode === "passive") return "beobachtet";
  return "offen";
}

type ManagerCardTone = "ready" | "warning" | "danger";

type ManagerActionCard = {
  key: string;
  eyebrow?: string;
  title: string;
  detail: string;
  meta: string;
  tone: ManagerCardTone;
  priority: number;
  onClick: () => void;
};

type ManagerPriorityCard = ManagerActionCard & {
  accent: string;
};

type HqWishlistEntry = {
  id: string;
  playerName: string;
  className: string;
  marketValue: number | null;
};

type HqSellMarker = {
  id: string;
  playerName: string;
  buyoutCost: number | null;
  morale: number | null;
};

type HqAxisEntry = {
  label: string;
  rank: number;
};

export type ManagerOfficeClientProps = {
  homeNextMatchdayStatus: {
    openSlots: number;
    requiredSlots: number;
    filledSlots: number;
    resultAvailable: boolean;
    hasFormCards: boolean;
    statusLabel: string;
  };
  selectedTeamPlayerDemands: Array<{ detail: string; type?: string }>;
  selectedHqFinanceWarnings: string[];
  selectedStandingRow: {
    cash: number | null;
    salaryTotal: number | null;
    rosterCount: number | null;
    rank: number | null;
    points: number | null;
    guv: number | null;
  } | null;
  /**
   * Kredit-Kern (`lib/finance/loan-service.ts`): jährliche Kreditrate und
   * Restschuld des aktiven Manager-Teams (Fog of War — nie ein fremdes Team,
   * siehe `use-credits-view-model.ts`). `null`/`0` blendet die Anzeige aus.
   */
  loanInstallment?: number | null;
  outstandingDebt?: number | null;
  activeTeamOpenInboxItems: Array<{ title: string }>;
  activeTeamCriticalInboxItems: unknown[];
  selectedOpenObjectives: Array<{ label: string; detail?: string | null; actionHint?: string | null }>;
  selectedBoardConfidence: { pressure: number; value: number } | null;
  hqTrainingFocusCount: number;
  selectedTeamGeneralManager: {
    profile: { name: string; title: string; facilityPriorities: string[] };
    assignment: { source?: string; dismissalReason?: string | null };
  } | null;
  hqTransferWishlistEntries: HqWishlistEntry[];
  selectedTeamCaptainProfile: {
    playerName: string;
    style: string;
    effects: { moraleBuffer: number };
  } | null;
  selectedTeamCaptainCandidates: Array<{
    playerId: string;
    playerName: string;
    leadershipScore: number;
    style: string;
    effects: {
      moraleBuffer: number;
      rivalryPressureReductionPct: number;
      teamPowerModifierPct: number;
    };
    hasCaptaincyDemand: boolean;
    demandLabel: string | null;
  }>;
  selectedTeamCaptainPlayerId: string | null;
  assignTeamCaptainBusy: boolean;
  captainEffectsTooltip: string;
  onAssignTeamCaptain: (playerId: string) => void;
  selectedTeamPowers: unknown[];
  hqContractExpiringCount: number;
  hqTransferSellMarkers: HqSellMarker[];
  selectedHqMoraleSummary: {
    average: number;
    criticalCount: number;
    exitRiskCount: number;
  } | null;
  selectedRosterTableRows: unknown[];
  selectedHqAxisSummary: {
    weakestTwo: HqAxisEntry[];
    strongest: HqAxisEntry | null;
  } | null;
  selectedHqInboxItems: GameInboxItem[];
  selectedHqGmStory: GmStoryView | null;
  selectedTeam: { teamId?: string; name?: string; shortCode?: string } | null;
  selectedTeamControl: { controlMode: TeamControlMode | null } | null;
  homeActiveTeamLogo: { src?: string | null; initials?: string } | null;
  gameState: { season: { name: string }; gamePhase?: string | null };
  currentMatchdayDisplayLabel: string;
  selectedTeamCanManage: boolean;
  isReadOnlyMode: boolean;
  selectedTeamAverageAxisStats: { pow: number; spe: number; men: number; soc: number } | null;
  rosterPlayers: unknown[];
  onNavigate: (view: FoundationViewId) => void;
  onOpenTeam: (teamId: string) => void;
  onNavigateInboxItem: (item: GameInboxItem) => void;
  seasonReadinessChecklist?: SeasonReadinessChecklist | null;
};

export function ManagerOfficeClient({
  homeNextMatchdayStatus,
  selectedTeamPlayerDemands,
  selectedHqFinanceWarnings,
  selectedStandingRow,
  loanInstallment,
  outstandingDebt,
  activeTeamOpenInboxItems,
  activeTeamCriticalInboxItems,
  selectedOpenObjectives,
  selectedBoardConfidence,
  hqTrainingFocusCount,
  selectedTeamGeneralManager,
  hqTransferWishlistEntries,
  selectedTeamCaptainProfile,
  selectedTeamCaptainCandidates,
  selectedTeamCaptainPlayerId,
  assignTeamCaptainBusy,
  captainEffectsTooltip,
  onAssignTeamCaptain,
  selectedTeamPowers,
  hqContractExpiringCount,
  hqTransferSellMarkers,
  selectedHqMoraleSummary,
  selectedRosterTableRows,
  selectedHqAxisSummary,
  selectedHqInboxItems,
  selectedHqGmStory,
  selectedTeam,
  selectedTeamControl,
  homeActiveTeamLogo,
  gameState,
  currentMatchdayDisplayLabel,
  selectedTeamCanManage,
  isReadOnlyMode,
  selectedTeamAverageAxisStats,
  rosterPlayers,
  onNavigate,
  onOpenTeam,
  onNavigateInboxItem,
  seasonReadinessChecklist,
}: ManagerOfficeClientProps) {
  const [draftCaptainPlayerId, setDraftCaptainPlayerId] = useState<string | null>(selectedTeamCaptainPlayerId);

  useEffect(() => {
    setDraftCaptainPlayerId(selectedTeamCaptainPlayerId);
  }, [selectedTeamCaptainPlayerId, selectedTeam?.teamId]);
              function sortManagerCards<T extends { priority: number; title: string }>(cards: T[]) {
                return [...cards].sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title, "de"));
              }
	            const immediateCards = sortManagerCards([
	              {
	                key: "lineup",
	                eyebrow: "Sofort",
	                title: homeNextMatchdayStatus.openSlots > 0 ? "Einsatzliste fertig machen" : homeNextMatchdayStatus.resultAvailable ? "Ergebnis ansehen" : "Arena bereit",
	                detail:
	                  homeNextMatchdayStatus.requiredSlots > 0
	                    ? `${homeNextMatchdayStatus.filledSlots}/${homeNextMatchdayStatus.requiredSlots} Slots · ${homeNextMatchdayStatus.openSlots} offen`
	                    : "Noch kein Spieltag aktiv.",
	                meta:
                    homeNextMatchdayStatus.openSlots > 0
                      ? "erst Einsatz fertig machen"
                      : homeNextMatchdayStatus.hasFormCards
                        ? "Nutzen: direkt revealbar"
                        : "Formkarten optional · Arena trotzdem spielbar",
                  priority: homeNextMatchdayStatus.openSlots > 0 ? 100 : 72,
	                tone: homeNextMatchdayStatus.openSlots > 0 ? "warning" : "ready",
	                onClick: () => onNavigate(homeNextMatchdayStatus.openSlots > 0 ? "lineup" : "matchdayArena"),
	              },
	              {
	                key: "demands",
	                eyebrow: "Sofort",
	                title: selectedTeamPlayerDemands.length > 0 ? "Forderungen prüfen" : "Kader ruhig",
	                detail: selectedTeamPlayerDemands[0]?.detail ?? "Gerade kein Spieler mit akutem Wunsch.",
	                meta: selectedTeamPlayerDemands.length > 0 ? `Schaden: Moral kippt bei ${selectedTeamPlayerDemands.length}` : "keine Reibung",
                  priority: selectedTeamPlayerDemands.length > 0 ? 88 : 44,
	                tone: selectedTeamPlayerDemands.length > 0 ? "warning" : "ready",
	                onClick: () =>
	                  onNavigate(
	                    selectedTeamPlayerDemands[0]?.type === "facility" ? "trainingV2" : "lineup",
	                  ),
	              },
	              {
	                key: "finance",
	                eyebrow: "Sofort",
	                title: selectedHqFinanceWarnings.length > 0 ? "Cash-Druck sichtbar" : "Finanzen stabil",
	                detail:
	                  selectedHqFinanceWarnings[0] ??
	                  `Cash ${selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"} · Gehalt ${selectedStandingRow?.salaryTotal != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"}`,
	                meta: selectedHqFinanceWarnings.length > 0 ? "Schaden: Cash/Gehaltsdruck" : "Puffer stabil",
                  priority: selectedHqFinanceWarnings.length > 0 ? 92 : 48,
	                tone: selectedHqFinanceWarnings.length > 0 ? "danger" : "ready",
	                onClick: () => onNavigate("prize"),
	              },
	              {
	                key: "inboxV2",
	                eyebrow: "Sofort",
	                title: activeTeamOpenInboxItems.length > 0 ? "Entscheidungen öffnen" : "Keine harten To-dos",
	                detail:
	                  activeTeamOpenInboxItems[0]?.title ??
	                  "Offene Aufgaben und Warnungen für dein Team triagieren.",
	                meta: activeTeamCriticalInboxItems.length > 0 ? `Kritisch: ${activeTeamCriticalInboxItems.length}` : `${activeTeamOpenInboxItems.length} offen`,
                  priority: activeTeamCriticalInboxItems.length > 0 ? 86 : activeTeamOpenInboxItems.length > 0 ? 68 : 36,
	                tone: activeTeamOpenInboxItems.length > 0 ? "warning" : "ready",
	                onClick: () => onNavigate("inboxV2"),
	              },
	            ]);
	            const seasonCards = sortManagerCards([
	              {
	                key: "board",
	                eyebrow: "Diese Season",
	                title: selectedOpenObjectives[0]?.label ?? "Board sauber halten",
	                detail: selectedOpenObjectives[0]?.detail ?? selectedOpenObjectives[0]?.actionHint ?? "Aktive Ziele, Druck und Richtung für diese Season.",
                meta:
                  (selectedBoardConfidence?.pressure ?? 0) >= 8
                    ? "Schaden: Board verliert Geduld"
                    : (selectedBoardConfidence?.pressure ?? 0) >= 6
                      ? "Warnung: Board schaut hin"
                      : selectedOpenObjectives.length > 0
                        ? "Nutzen: Ziel-Fortschritt sichern"
                        : "Ruhige Board-Lage",
                  priority:
                    (selectedBoardConfidence?.pressure ?? 0) >= 8
                      ? 84
                      : (selectedBoardConfidence?.pressure ?? 0) >= 6
                        ? 76
                        : selectedOpenObjectives.length > 0
                          ? 70
                          : 42,
                tone:
                  (selectedBoardConfidence?.pressure ?? 0) >= 8
                    ? "danger"
                    : (selectedBoardConfidence?.pressure ?? 0) >= 6
                      ? "warning"
                      : selectedOpenObjectives.length > 0
                        ? "warning"
                        : "ready",
	                onClick: () => onNavigate("season"),
	              },
	              {
	                key: "training",
	                eyebrow: "Diese Season",
	                title: hqTrainingFocusCount > 0 ? "Training nachschärfen" : "Training ruhig",
	                detail:
	                  hqTrainingFocusCount > 0
	                    ? `${hqTrainingFocusCount} Spieler haben XP oder Fatigue-Signale.`
	                    : "Gerade kein akuter Trainingsstau.",
	                meta: hqTrainingFocusCount > 0 ? "Nutzen: XP sichern, Fatigue beruhigen" : selectedTeamGeneralManager?.profile.facilityPriorities.slice(0, 2).join(" · ") ?? "Facility-Fokus offen",
                  priority: hqTrainingFocusCount > 0 ? 74 : 40,
	                tone: hqTrainingFocusCount > 0 ? "warning" : "ready",
	                onClick: () => onNavigate("trainingCompact"),
	              },
	              {
	                key: "market",
	                eyebrow: "Diese Season",
	                title: hqTransferWishlistEntries[0]?.playerName ?? "Marktwatch aufbauen",
	                detail:
	                  hqTransferWishlistEntries[0]
	                    ? `${hqTransferWishlistEntries[0].className} · MW ${hqTransferWishlistEntries[0].marketValue != null ? formatTransfermarktCurrency(hqTransferWishlistEntries[0].marketValue) : "—"}`
	                    : "Merke interessante Free Agents und beobachte Fits direkt von hier.",
	                meta: hqTransferWishlistEntries.length > 0 ? `Nutzen: ${hqTransferWishlistEntries.length} konkrete Targets` : "Chance: Watchlist aufbauen",
                  priority: hqTransferWishlistEntries.length > 0 ? 66 : 38,
	                tone: hqTransferWishlistEntries.length > 0 ? "ready" : "warning",
	                onClick: () => onNavigate("marketV2"),
	              },
	              {
	                key: "powers",
	                eyebrow: "Diese Season",
	                title: selectedTeamCaptainProfile?.playerName ?? "Captain & Team Powers",
	                detail:
	                  selectedTeamCaptainProfile
	                    ? `${selectedTeamCaptainProfile.style} · Buffer +${formatLocalePoints(selectedTeamCaptainProfile.effects.moraleBuffer, 1)}`
	                    : "Noch kein klares Captain-Signal sichtbar.",
	                meta: selectedTeamPowers.length > 0 ? `${selectedTeamPowers.length} Powers aktiv` : "Captain-Synergien offen",
                  priority: selectedTeamPowers.length > 0 ? 54 : 46,
	                tone: selectedTeamPowers.length > 0 ? "ready" : "warning",
	                onClick: () => {
                    onNavigate("homeV2");
                    window.setTimeout(() => {
                      document.getElementById("foundation-hq-captain-picker")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 120);
                  },
	              },
	            ]);
	            const preseasonCards = sortManagerCards([
	              {
	                key: "expiring",
	                eyebrow: "Vor Saisonwechsel",
	                title: hqContractExpiringCount > 0 ? "Ausläufer absichern" : "Verträge wirken stabil",
	                detail:
	                  hqContractExpiringCount > 0
	                    ? `${hqContractExpiringCount} Verträge laufen bald aus.`
	                    : "Keine akute Verlängerungswelle sichtbar.",
	                meta: hqContractExpiringCount > 0 ? "Schaden: Verliere Binder ohne Plan" : `${selectedRosterTableRows.length} Spieler im Kader`,
                  priority: hqContractExpiringCount > 0 ? 82 : 34,
	                tone: hqContractExpiringCount > 0 ? "warning" : "ready",
	                onClick: () => onNavigate("teams"),
	              },
	              {
	                key: "sell",
	                eyebrow: "Vor Saisonwechsel",
	                title: hqTransferSellMarkers.length > 0 ? "VK-Vormerkung prüfen" : "Keine Abgänge markiert",
	                detail:
	                  hqTransferSellMarkers[0]
	                    ? `${hqTransferSellMarkers[0].playerName} · Buyout ${hqTransferSellMarkers[0].buyoutCost != null ? formatDisplayMoney(hqTransferSellMarkers[0].buyoutCost) : "—"}`
	                    : "Wenn ein Spieler nicht mehr passt, hier vorbereitet in den Abgang gehen.",
	                meta: hqTransferSellMarkers.length > 0 ? `${hqTransferSellMarkers.length} markiert` : "Kein geplanter Exit",
                  priority: hqTransferSellMarkers.length > 0 ? 62 : 28,
	                tone: hqTransferSellMarkers.length > 0 ? "warning" : "ready",
	                onClick: () => onNavigate("teams"),
	              },
	              {
	                key: "morale",
	                eyebrow: "Vor Saisonwechsel",
	                title: selectedHqMoraleSummary ? `Moral ${formatLocalePoints(selectedHqMoraleSummary.average, 1)}` : "Moral prüfen",
	                detail:
	                  selectedHqMoraleSummary
	                    ? `${selectedHqMoraleSummary.criticalCount} kritisch · ${selectedHqMoraleSummary.exitRiskCount} Exit-Risiken`
	                    : "Noch keine belastbare Moral-Lage für dieses Team.",
	                meta: selectedTeamCaptainProfile?.playerName ? `Captain ${selectedTeamCaptainProfile.playerName}` : "kein Captain",
                  priority:
                    (selectedHqMoraleSummary?.criticalCount ?? 0) > 0 || (selectedHqMoraleSummary?.exitRiskCount ?? 0) > 0
                      ? 90
                      : 44,
	                tone:
	                  (selectedHqMoraleSummary?.criticalCount ?? 0) > 0 || (selectedHqMoraleSummary?.exitRiskCount ?? 0) > 0
	                    ? "danger"
	                    : "ready",
	                onClick: () => onNavigate("teams"),
	              },
	              {
	                key: "forecast",
	                eyebrow: "Vor Saisonwechsel",
	                title: "Preisgeld & Forecast",
	                detail:
	                  selectedStandingRow?.rank != null
	                    ? `Rang #${selectedStandingRow.rank} · ${selectedStandingRow.points != null ? formatLocalePoints(selectedStandingRow.points, 1) : "—"} Punkte`
	                    : "Rang und Kassenlauf im Blick behalten.",
	                meta: selectedStandingRow?.guv != null ? `GuV ${formatMoney(selectedStandingRow.guv)}` : "GuV —",
                  priority: selectedStandingRow?.guv != null && selectedStandingRow.guv < 0 ? 58 : 30,
	                tone: selectedStandingRow?.guv != null && selectedStandingRow.guv < 0 ? "warning" : "ready",
	                onClick: () => onNavigate("prize"),
	              },
	            ]);
              const managerPriorityCards = sortManagerCards([
                {
                  key: "priority-lineup",
                  title: homeNextMatchdayStatus.openSlots > 0 ? "Einsatzliste offen" : homeNextMatchdayStatus.resultAvailable ? "Reveal lesen" : "Arena starten",
                  detail:
                    homeNextMatchdayStatus.requiredSlots > 0
                      ? `${homeNextMatchdayStatus.filledSlots}/${homeNextMatchdayStatus.requiredSlots} Slots · ${homeNextMatchdayStatus.openSlots} offen`
                      : "Kein aktiver Spieltag im Fokus.",
                  meta: homeNextMatchdayStatus.openSlots > 0 ? "Schaden: Matchday blockiert" : "Nutzen: Spieltag direkt spielbar",
                  tone: homeNextMatchdayStatus.openSlots > 0 ? "warning" : "ready",
                  priority: homeNextMatchdayStatus.openSlots > 0 ? 100 : 70,
                  accent: "lineup",
                  onClick: () => onNavigate(homeNextMatchdayStatus.openSlots > 0 ? "lineup" : "matchdayArena"),
                },
                {
                  key: "priority-finance",
                  title: selectedHqFinanceWarnings.length > 0 ? "Cash-Druck" : "Finanzlage stabil",
                  detail:
                    selectedHqFinanceWarnings[0] ??
                    `Cash ${selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"} · Gehalt ${selectedStandingRow?.salaryTotal != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"}`,
                  meta: selectedHqFinanceWarnings.length > 0 ? "Schaden: Markt und Verlaengerungen enger" : "Nutzen: Flex für Deals",
                  tone: selectedHqFinanceWarnings.length > 0 ? "danger" : "ready",
                  priority: selectedHqFinanceWarnings.length > 0 ? 92 : 54,
                  accent: "finance",
                  onClick: () => onNavigate("prize"),
                },
                {
                  key: "priority-morale",
                  title:
                    (selectedHqMoraleSummary?.criticalCount ?? 0) > 0 || (selectedHqMoraleSummary?.exitRiskCount ?? 0) > 0
                      ? "Moral kippt"
                      : "Moral ruhig",
                  detail:
                    selectedHqMoraleSummary
                      ? `${selectedHqMoraleSummary.criticalCount} kritisch · ${selectedHqMoraleSummary.exitRiskCount} Exit-Risiken`
                      : "Noch keine belastbare Moral-Lage.",
                  meta:
                    (selectedHqMoraleSummary?.criticalCount ?? 0) > 0 || (selectedHqMoraleSummary?.exitRiskCount ?? 0) > 0
                      ? "Schaden: Forderungen und Abgangsrisiko"
                      : "Nutzen: stabiler Kern",
                  tone:
                    (selectedHqMoraleSummary?.criticalCount ?? 0) > 0 || (selectedHqMoraleSummary?.exitRiskCount ?? 0) > 0
                      ? "danger"
                      : "ready",
                  priority:
                    (selectedHqMoraleSummary?.criticalCount ?? 0) > 0 || (selectedHqMoraleSummary?.exitRiskCount ?? 0) > 0
                      ? 90
                      : 48,
                  accent: "board",
                  onClick: () => onNavigate("teams"),
                },
                {
                  key: "priority-market",
                  title: hqTransferWishlistEntries.length > 0 ? "Marktchance da" : "Marktwatch fehlt",
                  detail:
                    hqTransferWishlistEntries[0]
                      ? `${hqTransferWishlistEntries[0].playerName} · ${hqTransferWishlistEntries[0].className} · MW ${hqTransferWishlistEntries[0].marketValue != null ? formatTransfermarktCurrency(hqTransferWishlistEntries[0].marketValue) : "—"}`
                      : "Wishlist und Fits geben dir wieder schnellere Kaufentscheidungen.",
                  meta: hqTransferWishlistEntries.length > 0 ? "Nutzen: vorbereitete Targets" : "Chance: Watchlist aufbauen",
                  tone: hqTransferWishlistEntries.length > 0 ? "ready" : "warning",
                  priority: hqTransferWishlistEntries.length > 0 ? 72 : 46,
                  accent: "power",
                  onClick: () => onNavigate("marketV2"),
                },
                {
                  key: "priority-training",
                  title: hqTrainingFocusCount > 0 ? "Training braucht Fokus" : "Training ruhig",
                  detail:
                    hqTrainingFocusCount > 0
                      ? `${hqTrainingFocusCount} Spieler mit XP-/Fatigue-Signal.`
                      : "Gerade kein akuter Trainingsstau.",
                  meta: hqTrainingFocusCount > 0 ? "Nutzen: Entwicklung sichern" : "Kein Sofortschaden",
                  tone: hqTrainingFocusCount > 0 ? "warning" : "ready",
                  priority: hqTrainingFocusCount > 0 ? 68 : 40,
                  accent: "lineup",
                  onClick: () => onNavigate("trainingCompact"),
                },
              ]);
              const marketWatchRows = hqTransferWishlistEntries.slice(0, 3);
              // Cash/Gehalt/Kader/Moral/Achsen/Board sind bereits im State-Strip bzw. im Board-Impact-Strip
              // oben sichtbar - hier bleibt nur der GM-Status, der sonst nirgends kompakt auftaucht.
              const hqGlanceRows = [
                {
                  key: "gm",
                  label: "GM-Status",
                  value: selectedTeamGeneralManager?.profile.name ?? "—",
                  detail:
                    selectedTeamGeneralManager?.assignment.source === "board_replacement" ||
                    selectedTeamGeneralManager?.assignment.dismissalReason
                      ? "Board-Wechsel · neuer GM"
                      : (selectedBoardConfidence?.pressure ?? 0) >= 8
                        ? `Hot Seat · Druck ${selectedBoardConfidence?.pressure ?? "—"}/10`
                        : (selectedBoardConfidence?.pressure ?? 0) >= 6
                          ? `Board schaut hin · Druck ${selectedBoardConfidence?.pressure ?? "—"}/10`
                          : selectedTeamGeneralManager?.profile.title ?? "Front Office",
                },
              ];
              const immediatePrimaryAction = immediateCards[0] ?? null;
              const seasonPrimaryAction = seasonCards[0] ?? null;
              const preseasonPrimaryAction = preseasonCards[0] ?? null;
	            return (
	              <section className="foundation-hq-panel" data-testid="foundation-hq" id="foundation-hq">
	                <div className="foundation-hq-hero">
	                  <button
	                    className="foundation-home-team-card foundation-hq-team-card"
	                    type="button"
	                    onClick={() => selectedTeam?.teamId && onOpenTeam(selectedTeam.teamId)}
	                    title="Team-Dossier öffnen"
	                  >
	                    <OptimizedMediaImage
	                      className="foundation-home-logo"
	                      src={homeActiveTeamLogo?.src}
	                      alt={`${selectedTeam?.name ?? "Team"} Logo`}
	                      loading="eager"
	                      fetchPriority="high"
	                      fallback={
	                        <span className="foundation-home-logo team-logo-placeholder">
	                          {homeActiveTeamLogo?.initials ?? selectedTeam?.shortCode ?? "?"}
	                        </span>
	                      }
	                    />
	                    <div className="stack">
	                      <span className="eyebrow">HQ / Manager-Zentrale</span>
	                      <h1>{selectedTeam?.name ?? "Kein Team ausgewählt"}</h1>
                        {selectedTeamGeneralManager ? (
                          <p className="muted foundation-hq-gm-line">
                            GM {selectedTeamGeneralManager.profile.name} · {selectedTeamGeneralManager.profile.title}
                          </p>
                        ) : null}
                        {selectedTeam && (!selectedTeamCanManage || isReadOnlyMode) ? (
                          <span className="transfer-status-pill is-warning">Nur Ansicht</span>
                        ) : null}
                        {selectedTeamAverageAxisStats ? (
                          <VeloStatOrbitRow
                            ariaLabel="Team Achsen Durchschnitt"
                            className="foundation-hq-axis-orbit"
                            stats={{
                              pow: selectedTeamAverageAxisStats.pow,
                              spe: selectedTeamAverageAxisStats.spe,
                              men: selectedTeamAverageAxisStats.men,
                              soc: selectedTeamAverageAxisStats.soc,
                            }}
                          />
                        ) : null}
	                    </div>
	                  </button>
	                </div>
                  {seasonReadinessChecklist ? (
                    <section className="foundation-hq-readiness-checklist" data-testid="foundation-season-readiness-checklist" aria-label={seasonReadinessChecklist.title}>
                      <div className="foundation-hq-readiness-head">
                        <span className="eyebrow">{seasonReadinessChecklist.title}</span>
                        <strong>
                          {seasonReadinessChecklist.readyCount}/{seasonReadinessChecklist.totalCount} bereit
                        </strong>
                      </div>
                      <div className="foundation-hq-readiness-grid">
                        {seasonReadinessChecklist.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`foundation-hq-readiness-item is-${item.status}`}
                            onClick={() => {
                              onNavigate(item.targetView);
                              if (item.targetPanel) {
                                window.setTimeout(() => {
                                  document.getElementById(item.targetPanel!)?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 120);
                              }
                            }}
                          >
                            <strong>{item.label}</strong>
                            <small>{item.detail}</small>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {selectedTeamGeneralManager && selectedHqGmStory && !isSeasonOnePreseasonNeutralBoard(gameState as GameState) ? (
                    <div
                      className={`season-v2-gm-story is-${selectedHqGmStory.tone}`}
                      data-testid="foundation-hq-gm-story"
                      title="GM-Mandat aus Board Confidence, Druck und möglichen Wechselgruenden."
                    >
                      <strong>{selectedHqGmStory.label}</strong>
                      <span>
                        {selectedTeamGeneralManager.profile.name} · {selectedTeamGeneralManager.profile.title} ·{" "}
                        {selectedHqGmStory.detail}
                      </span>
                    </div>
                  ) : null}

                  <VeloImpactStrip
                    className="foundation-hq-board-impact-strip"
                    items={[
                      {
                        key: "pressure",
                        label: "Druck",
                        value: `${selectedBoardConfidence?.pressure ?? "—"}/10`,
                        tone: (selectedBoardConfidence?.pressure ?? 0) >= 8 ? "negative" : (selectedBoardConfidence?.pressure ?? 0) >= 6 ? "warning" : "neutral",
                      },
                      {
                        key: "confidence",
                        label: "Rating",
                        value: `${selectedBoardConfidence?.value ?? "—"}/10`,
                        tone: (selectedBoardConfidence?.value ?? 0) >= 7 ? "positive" : (selectedBoardConfidence?.value ?? 0) <= 4 ? "negative" : "neutral",
                      },
                      {
                        key: "goal",
                        label: "Nächstes Ziel",
                        value: selectedOpenObjectives[0]?.label ?? managerPriorityCards[0]?.title ?? "—",
                        tone: "neutral",
                      },
                    ]}
                  />

                  <section
                    className="foundation-hq-captain-picker"
                    id="foundation-hq-captain-picker"
                    data-testid="foundation-hq-captain-picker"
                    aria-label="Saison-Kapitän wählen"
                  >
                    <div className="foundation-hq-captain-head">
                      <div className="stack">
                        <span className="eyebrow">Saison-Führung</span>
                        <strong title={captainEffectsTooltip}>Kapitän ernennen</strong>
                        <p className="muted">{captainEffectsTooltip}</p>
                      </div>
                      {selectedTeamCaptainProfile ? (
                        <span className="pill">
                          Aktiv: {selectedTeamCaptainProfile.playerName} · {selectedTeamCaptainProfile.style}
                        </span>
                      ) : null}
                    </div>
                    <div className="foundation-hq-captain-candidates">
                      {selectedTeamCaptainCandidates.length > 0 ? (
                        selectedTeamCaptainCandidates.map((candidate) => (
                          <button
                            key={`hq-captain-${candidate.playerId}`}
                            type="button"
                            className={`foundation-hq-captain-candidate${draftCaptainPlayerId === candidate.playerId ? " is-selected" : ""}`}
                            onClick={() => setDraftCaptainPlayerId(candidate.playerId)}
                            disabled={!selectedTeamCanManage || isReadOnlyMode}
                          >
                            <strong>{candidate.playerName}</strong>
                            <small>
                              Leadership {formatLocalePoints(candidate.leadershipScore, 1)} · {candidate.style} · Buffer +
                              {formatLocalePoints(candidate.effects.moraleBuffer, 1)} · Power +
                              {formatLocalePoints(candidate.effects.teamPowerModifierPct, 1)}%
                            </small>
                            {candidate.hasCaptaincyDemand ? (
                              <span className="transfer-status-pill is-warning">{candidate.demandLabel ?? "Will Captain sein"}</span>
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <p className="muted">Kein Kader für die Kapitänswahl verfügbar.</p>
                      )}
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={
                        !draftCaptainPlayerId ||
                        !selectedTeamCanManage ||
                        isReadOnlyMode ||
                        assignTeamCaptainBusy ||
                        draftCaptainPlayerId === selectedTeamCaptainPlayerId
                      }
                      onClick={() => draftCaptainPlayerId && onAssignTeamCaptain(draftCaptainPlayerId)}
                    >
                      {assignTeamCaptainBusy ? "Speichert …" : "Kapitän bestätigen"}
                    </button>
                  </section>

                  <section className="foundation-hq-priority-rail" aria-label="Manager-Fokus">
                    <div className="foundation-hq-focus-head">
                      <div className="foundation-hq-focus-copy">
                        <span className="eyebrow" title="Nach Dringlichkeit sortiert">Manager-Fokus</span>
                        <strong>Was du jetzt tun solltest</strong>
                      </div>
                      <span className="pill">{managerPriorityCards.filter((card) => card.tone !== "ready").length} aktiv</span>
                    </div>
                    <div className="foundation-hq-priority-grid">
                      {managerPriorityCards.map((card) => (
                        <button
                          key={`hq-priority-${card.key}`}
                          className={`foundation-hq-priority-card is-${card.accent}`}
                          type="button"
                          onClick={card.onClick}
                        >
                          <span>{card.tone === "danger" ? "Druck" : card.tone === "warning" ? "Jetzt" : "Chance"}</span>
                          <strong>{card.title}</strong>
                          <small>{card.detail}</small>
                          <b>{card.meta}</b>
                        </button>
                      ))}
                    </div>
                  </section>

	                <div className="foundation-hq-state-strip">
	                  <article className="foundation-hq-state-card">
	                    <span>Cash</span>
	                    <strong>{selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"}</strong>
	                    <small>sofort verfügbar</small>
	                  </article>
	                  <article className="foundation-hq-state-card">
	                    <span>Gehalt</span>
	                    <strong>{selectedStandingRow?.salaryTotal != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"}</strong>
	                    <small>laufender Druck</small>
	                  </article>
	                  {loanInstallment != null && loanInstallment > 0 ? (
	                    <article className="foundation-hq-state-card">
	                      <span>Kreditrate</span>
	                      <strong>{formatMoney(loanInstallment)}</strong>
	                      <small>
	                        {outstandingDebt != null && outstandingDebt > 0
	                          ? `Restschuld ${formatMoney(outstandingDebt)}`
	                          : "jährliche Tilgung"}
	                      </small>
	                    </article>
	                  ) : null}
	                  <article className="foundation-hq-state-card">
	                    <span>Kadergröße</span>
	                    <strong>{selectedStandingRow?.rosterCount ?? rosterPlayers.length}</strong>
	                    <small>aktive Spieler</small>
	                  </article>
	                  <article className="foundation-hq-state-card">
	                    <span>Moral-Schnitt</span>
	                    <strong>{selectedHqMoraleSummary?.average != null ? formatLocalePoints(selectedHqMoraleSummary.average, 1) : "—"}</strong>
	                    <small>{selectedHqMoraleSummary?.criticalCount ?? 0} kritisch</small>
	                  </article>
	                  <article className="foundation-hq-state-card">
	                    <span>Schwächste Achsen</span>
	                    <strong>
	                      {selectedHqAxisSummary?.weakestTwo.length
	                        ? selectedHqAxisSummary.weakestTwo.map((entry) => `${entry.label} #${entry.rank}`).join(" · ")
	                        : "—"}
	                    </strong>
	                    <small>
	                      {selectedHqAxisSummary?.strongest ? `stark in ${selectedHqAxisSummary.strongest.label} #${selectedHqAxisSummary.strongest.rank}` : "keine Rangdaten"}
	                    </small>
	                  </article>
	                </div>

	                <div className="foundation-hq-zones">
	                  <article className="foundation-home-card foundation-hq-zone">
	                    <div className="panel-header compact">
	                      <div className="stack">
	                        <h2>Sofort</h2>
	                      </div>
                        <div className="foundation-hq-zone-head-actions">
	                      <span className={`transfer-status-pill${homeNextMatchdayStatus.openSlots > 0 ? " is-warning" : " is-ready"}`}>
	                        {homeNextMatchdayStatus.statusLabel}
	                      </span>
                          {immediatePrimaryAction ? (
                            <button className="secondary-button inline-button" type="button" onClick={immediatePrimaryAction.onClick} title={immediatePrimaryAction.detail}>
                              Jetzt öffnen
                            </button>
                          ) : null}
                        </div>
	                    </div>
	                    <div className="foundation-hq-action-grid">
	                      {immediateCards.map((card) => (
	                        <button key={`hq-immediate-${card.key}`} className={`foundation-hq-action-card is-${card.tone}`} type="button" onClick={card.onClick} title={`${card.detail} · ${card.meta}`}>
	                          <span>{card.eyebrow}</span>
	                          <strong>{card.title}</strong>
	                          <small>{card.detail}</small>
	                          <b>{card.meta}</b>
	                        </button>
	                      ))}
	                    </div>
	                  </article>

	                  <article className="foundation-home-card foundation-hq-zone">
	                    <div className="panel-header compact">
	                      <div className="stack">
	                        <h2>Diese Season</h2>
	                      </div>
                        <div className="foundation-hq-zone-head-actions">
	                      <span className="pill">{selectedOpenObjectives.length} Ziele offen</span>
                          {seasonPrimaryAction ? (
                            <button className="secondary-button inline-button" type="button" onClick={seasonPrimaryAction.onClick} title={seasonPrimaryAction.detail}>
                              Direkt rein
                            </button>
                          ) : null}
                        </div>
	                    </div>
	                    <div className="foundation-hq-action-grid">
	                      {seasonCards.map((card) => (
	                        <button key={`hq-season-${card.key}`} className={`foundation-hq-action-card is-${card.tone}`} type="button" onClick={card.onClick} title={`${card.detail} · ${card.meta}`}>
	                          <span>{card.eyebrow}</span>
	                          <strong>{card.title}</strong>
	                          <small>{card.detail}</small>
	                          <b>{card.meta}</b>
	                        </button>
	                      ))}
	                    </div>
	                    <div className="foundation-hq-mini-grid">
	                      <div className="foundation-hq-mini-card is-glance">
	                        <span>GM-Status</span>
                          <div className="foundation-hq-glance-grid">
                            {hqGlanceRows.map((row) => (
                              <div key={`hq-glance-${row.key}`} className="foundation-hq-glance-card">
                                <span>{row.label}</span>
                                <strong>{row.value}</strong>
                                <small>{row.detail}</small>
                              </div>
                            ))}
                          </div>
	                      </div>
	                      <div className="foundation-hq-mini-card is-watch">
	                        <span>Wishlist</span>
	                        {marketWatchRows.length > 0 ? (
	                          <div className="foundation-hq-mini-list">
	                            {marketWatchRows.map((entry) => (
	                              <button key={`hq-wishlist-${entry.id}`} className="foundation-hq-mini-row" type="button" onClick={() => onNavigate("marketV2")}>
	                                <strong>{entry.playerName}</strong>
	                                <small>{entry.className} · {entry.marketValue != null ? formatTransfermarktCurrency(entry.marketValue) : "—"} · Watch</small>
	                              </button>
	                            ))}
	                          </div>
	                        ) : (
	                          <p className="muted">Noch leer. Gute Targets hier merken und später schneller ziehen.</p>
	                        )}
	                      </div>
	                      <div className="foundation-hq-mini-card">
	                        <span>Marktchance</span>
	                        {selectedHqAxisSummary?.weakestTwo[0] ? (
	                          <button className="foundation-hq-mini-row" type="button" onClick={() => onNavigate("marketV2")}>
	                            <strong>{selectedHqAxisSummary?.weakestTwo[0] ? `${selectedHqAxisSummary.weakestTwo[0].label} reparieren` : "Fits prüfen"}</strong>
	                            <small>
                                {selectedHqAxisSummary?.weakestTwo[0]
                                  ? `Schwachpunkt #${selectedHqAxisSummary.weakestTwo[0].rank} · Markt direkt auf diese Achse drehen`
                                  : "Kaderbedarf und Wishlist im Markt kombinieren"}
                              </small>
	                          </button>
	                        ) : (
	                          <p className="muted">Gerade kein klarer Marktbedarf sichtbar.</p>
	                        )}
	                      </div>
	                    </div>
	                  </article>

	                  <article className="foundation-home-card foundation-hq-zone">
	                    <div className="panel-header compact">
	                      <div className="stack">
	                        <h2>Vor Saisonwechsel</h2>
	                      </div>
                        <div className="foundation-hq-zone-head-actions">
	                      <span className="pill">{hqContractExpiringCount} Ausläufer</span>
                          {preseasonPrimaryAction ? (
                            <button className="secondary-button inline-button" type="button" onClick={preseasonPrimaryAction.onClick} title={preseasonPrimaryAction.detail}>
                              Vorbereiten
                            </button>
                          ) : null}
                        </div>
	                    </div>
	                    <div className="foundation-hq-action-grid">
	                      {preseasonCards.map((card) => (
	                        <button key={`hq-preseason-${card.key}`} className={`foundation-hq-action-card is-${card.tone}`} type="button" onClick={card.onClick} title={`${card.detail} · ${card.meta}`}>
	                          <span>{card.eyebrow}</span>
	                          <strong>{card.title}</strong>
	                          <small>{card.detail}</small>
	                          <b>{card.meta}</b>
	                        </button>
	                      ))}
	                    </div>
	                    <div className="foundation-hq-mini-grid">
	                      <div className="foundation-hq-mini-card">
	                        <span>VK vorgemerkt</span>
	                        {hqTransferSellMarkers.length > 0 ? (
	                          <div className="foundation-hq-mini-list">
	                            {hqTransferSellMarkers.map((entry) => (
	                              <button key={`hq-sell-marker-${entry.id}`} className="foundation-hq-mini-row" type="button" onClick={() => onNavigate("teams")}>
	                                <strong>{entry.playerName}</strong>
	                                <small>Buyout {entry.buyoutCost != null ? formatDisplayMoney(entry.buyoutCost) : "—"} · Moral {entry.morale != null ? formatWholeNumber(entry.morale) : "—"}</small>
	                              </button>
	                            ))}
	                          </div>
	                        ) : (
	                          <p className="muted">Noch kein Spieler für den Abgang vorgemerkt.</p>
	                        )}
	                      </div>
	                      <div className="foundation-hq-mini-card">
	                        <span>Inbox & Lore</span>
	                        {selectedHqInboxItems.length > 0 ? (
	                          <div className="foundation-hq-mini-list">
	                            {selectedHqInboxItems.slice(0, 3).map((item) => (
	                              <button key={`hq-story-${item.itemId}`} className="foundation-hq-mini-row" type="button" onClick={() => onNavigateInboxItem(item)}>
	                                <strong>{item.title}</strong>
	                                <small>{item.description}</small>
	                              </button>
	                            ))}
	                          </div>
	                        ) : (
	                          <p className="muted">Gerade keine neuen Team-Highlights.</p>
	                        )}
	                      </div>
	                    </div>
	                  </article>
	                </div>
	              </section>
	            );
}
