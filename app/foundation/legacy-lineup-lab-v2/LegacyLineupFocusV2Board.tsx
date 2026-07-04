"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { VeloImpactStrip, VeloRangeBar } from "@/components/foundation/velo-ui";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { getLegacyLineupDragFitTier, type LegacyLineupDragFitTier } from "@/lib/lineups/legacy-lineup-drag-drop";
import { filterLegacyLineupCandidateEntries, type LegacyLineupCandidateTab } from "@/lib/lineups/legacy-lineup-candidate-tabs";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { LegacyLineupLabSlot } from "@/lib/lineups/legacy-lineup-lab";
import type { MatchdayIntensityStage, MatchdaySlotRoleDefinition } from "@/lib/lineups/matchday-slot-roles";

type RosterCard = {
  id: string;
  activePlayerId: string | null;
  portraitUrl: string | null;
  name: string;
  className: string | null;
  discipline1Score: number | null;
  discipline2Score: number | null;
};

type SlotCandidate = {
  activePlayerId: string;
  name: string;
  projectedScore: number | null;
  scoreDelta: number | null;
  fitSummary: string;
  fitDetail: string;
  roleModifier?: number | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  warnings?: string[];
};

type SlotCandidateSummary = {
  topCandidates: SlotCandidate[];
  currentProjected: number | null;
};

type CandidateGroupKey = LegacyLineupCandidateTab;

type PlayerBestSlotEntry = {
  slotKey: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  projectedScore: number | null;
  projectedDelta: number | null;
  fitSummary: string;
};

type FocusCandidateEntry = {
  player: RosterCard & {
    discipline1Label?: string;
    discipline2Label?: string;
    fatigueCount?: number | null;
  };
  activeSlotCandidate: {
    projectedScore: number | null;
    scoreDelta: number | null;
    blockReason?: string | null;
    fitSummary?: string;
    baseScore?: number | null;
    roleModifier?: number | null;
    rangeLow?: number | null;
    rangeHigh?: number | null;
    warnings?: string[];
    fatigueModifier?: number | null;
    additionalFatigue?: number | null;
  } | null;
  groupKey: string;
  groupMeta: { label: string };
  wantsActiveSlot: boolean;
  detail: string;
  shortReason: string;
  fitTier?: string | null;
  preferredSlotTags?: string[];
};

type CandidateGroup = {
  key: string;
  meta: { label: string };
  entries: FocusCandidateEntry[];
  totalCount: number;
};

type SlotIssue = {
  label: string;
  detail: string;
  tone: string;
};

type RoleAttribute = {
  key: string;
  shortLabel: string;
  ratingLabel: string | null;
  emphasis?: string;
};

type SlotDragPreview = {
  projected: { totalProjected: number | null };
  scoreDelta: number | null;
  blockReason: string | null;
  fitTier: string | null;
};

type CaptainSelectEntry = {
  activePlayerId: string;
  name: string;
};

type CaptainInfo = {
  activePlayerId: string;
  estimatedCaptainBonus: number | null;
  moraleReward: number | null;
};

export type LegacyLineupFocusV2BoardProps = {
  context: LegacyLineupLoadedContext | null;
  slots: LegacyLineupLabSlot[];
  selections: Record<string, string>;
  activeSlotKey: string | null;
  onActiveSlotChange: (slotKey: string) => void;
  rosterCardByActivePlayerId: Map<string, RosterCard>;
  slotCandidateSummaryByKey: Map<string, SlotCandidateSummary>;
  slotPreviewByKey: Map<
    string,
    {
      projected: {
        totalProjected: number | null;
        additionalFatigue?: number | null;
        fatigueModifier?: number | null;
        roleModifier?: number | null;
        rangeLow?: number | null;
        rangeHigh?: number | null;
        warnings?: string[];
      };
      selectedScore?: number | null;
    }
  >;
  slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
  slotIssuesByKey: Map<string, SlotIssue[]>;
  slotRoleAttributesByKey: Map<string, RoleAttribute[]>;
  slotDragPreviewByKey: Map<string, SlotDragPreview>;
  draggedActivePlayerId: string | null;
  onDragStart: (activePlayerId: string) => void;
  onDragEnd: () => void;
  onDropOnSlot: (slotKey: string, activePlayerId: string | null) => void;
  getDragFitTierClass: (fitTier: LegacyLineupDragFitTier | string | null) => string;
  getTierStyleClass: (ratingLabel: string | null | undefined) => string;
  candidateGroups: CandidateGroup[];
  candidateTab: LegacyLineupCandidateTab;
  onCandidateTabChange: (tab: LegacyLineupCandidateTab) => void;
  playerBestSlotSummaryByActivePlayerId: Map<string, PlayerBestSlotEntry[]>;
  captains: Record<"d1" | "d2", string>;
  captainSelectEntriesBySide: Record<"d1" | "d2", CaptainSelectEntry[]>;
  captainInfoBySide: Record<"d1" | "d2", CaptainInfo[]>;
  captainDraftRemaining: number;
  captainSeasonUsedWithDraft: number;
  captainSeasonLimit: number;
  onUpdateCaptain: (disciplineSide: "d1" | "d2", activePlayerId: string) => void;
  lineupMeta: { d1Selected: number; d2Selected: number };
  d1Rank: number | null;
  d2Rank: number | null;
  getSelectedOptionMeta: (activePlayerId: string) => { name: string; fatigueCount?: number | null } | null;
  onAssignPlayer: (slotKey: string, activePlayerId: string) => void;
  /** Increments on every real assignment (click, digit-key, Enter top-pick) — see LegacyLineupLabClient. */
  assignPulse?: number;
  onClearSlot: (slotKey: string) => void;
  onOpenPlayer: (playerId: string, activePlayerId?: string | null) => void;
  isReadOnly: boolean;
  isBusy: boolean;
  matchdayHeaderSummary: string;
  matchdayPreviewCards: {
    openSlots: number;
    totalRangeLow: number | null;
    totalRangeHigh: number | null;
    totalFatigue: number;
    riskLevel: string;
  };
  lineupFlowSummary: {
    selectedCount: number;
    totalRequired: number;
    nextStep: { label: string; detail: string };
  };
  lineupSaveCta: {
    tone: string;
    label: string;
    detail: string;
    buttonLabel: string;
  };
  lineupReadyToSave: boolean;
  lineupMiniAuditBlockers: number;
  captainBudgetExceeded: boolean;
  missingSeasonFormCards: boolean;
  formatProjectedMetricWindow: (low: number | null | undefined, high: number | null | undefined) => string;
  onFocusNextOpenSlot: () => void;
  onAutoFillOpenSlots: () => void;
  onSaveDraft: () => void;
  getDisciplineIntensity: (disciplineSide: "d1" | "d2") => MatchdayIntensityStage;
  onUpdateDisciplineIntensity: (disciplineSide: "d1" | "d2", intensity: MatchdayIntensityStage) => void;
  playerFilter: string;
  onPlayerFilterChange: (value: string) => void;
  controlsSlot?: ReactNode;
  tacticsSlot?: ReactNode;
  disciplineColorClassBySide: Record<"d1" | "d2", string>;
};

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDecimalScore(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function formatNullableScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return formatScore(value);
}

function formatSignedDecimalScore(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function formatIntensityLabel(intensity: MatchdayIntensityStage) {
  if (intensity === "push") return "Push";
  if (intensity === "conserve") return "Schonen";
  return "Normal";
}

function getSlotReadinessLabel(hasSelection: boolean, projected: number | null) {
  if (!hasSelection) return "Offen";
  if (projected == null) return "Gesetzt";
  if (projected >= 85) return "Stark";
  if (projected >= 70) return "Solide";
  return "Schwach";
}

/** Reuses the drag-fit tier vocabulary (best/great/okay/poor/blocked) for a persistent, idle-state
 * glow so slot/candidate quality reads at a glance without requiring a drag gesture. Mirrors the
 * arena-v2 tier color language (gold/green/gray/orange/red). */
function getIdleTierGlowClass(fitTier: string | null | undefined) {
  switch (fitTier) {
    case "best":
      return "is-tier-elite";
    case "great":
      return "is-tier-strong";
    case "okay":
      return "is-tier-mid";
    case "poor":
      return "is-tier-weak";
    case "blocked":
      return "is-tier-poor";
    default:
      return "";
  }
}

export default function LegacyLineupFocusV2Board({
  context,
  slots,
  selections,
  activeSlotKey,
  onActiveSlotChange,
  rosterCardByActivePlayerId,
  slotCandidateSummaryByKey,
  slotPreviewByKey,
  slotRoleByKey,
  slotIssuesByKey,
  slotRoleAttributesByKey,
  slotDragPreviewByKey,
  draggedActivePlayerId,
  onDragStart,
  onDragEnd,
  onDropOnSlot,
  getDragFitTierClass,
  getTierStyleClass,
  candidateGroups,
  candidateTab,
  onCandidateTabChange,
  playerBestSlotSummaryByActivePlayerId,
  captains,
  captainSelectEntriesBySide,
  captainInfoBySide,
  captainDraftRemaining,
  captainSeasonUsedWithDraft,
  captainSeasonLimit,
  onUpdateCaptain,
  lineupMeta,
  d1Rank,
  d2Rank,
  getSelectedOptionMeta,
  onAssignPlayer,
  assignPulse,
  onClearSlot,
  onOpenPlayer,
  isReadOnly,
  isBusy,
  matchdayHeaderSummary,
  matchdayPreviewCards,
  lineupFlowSummary,
  lineupSaveCta,
  lineupReadyToSave,
  lineupMiniAuditBlockers,
  captainBudgetExceeded,
  missingSeasonFormCards,
  formatProjectedMetricWindow,
  onFocusNextOpenSlot,
  onAutoFillOpenSlots,
  onSaveDraft,
  getDisciplineIntensity,
  onUpdateDisciplineIntensity,
  playerFilter,
  onPlayerFilterChange,
  controlsSlot,
  tacticsSlot,
  disciplineColorClassBySide,
}: LegacyLineupFocusV2BoardProps) {
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [pinnedCandidateIds, setPinnedCandidateIds] = useState<string[]>([]);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const activeSlot = activeSlotKey ? slots.find((slot) => slot.key === activeSlotKey) ?? null : null;
  const activeRole = activeSlot ? slotRoleByKey.get(activeSlot.key) ?? null : null;
  const activeSelectionId = activeSlot ? selections[activeSlot.key] ?? "" : "";
  const activeRosterCard = activeSelectionId ? rosterCardByActivePlayerId.get(activeSelectionId) ?? null : null;
  const activeSlotPreview = activeSlot ? slotPreviewByKey.get(activeSlot.key) ?? null : null;
  const activeSelectedOption = activeSelectionId ? getSelectedOptionMeta(activeSelectionId) : null;
  const activeRoleAttributes = activeSlot ? slotRoleAttributesByKey.get(activeSlot.key) ?? [] : [];

  const d1Discipline = context?.matchdayContract?.discipline1 ?? null;
  const d2Discipline = context?.matchdayContract?.discipline2 ?? null;
  const d1Required = d1Discipline?.requiredPlayers ?? 0;
  const d2Required = d2Discipline?.requiredPlayers ?? 0;

  // Reset per-slot compare pins when the active slot changes — pins only make sense in the
  // context of "candidates for this slot".
  useEffect(() => {
    setPinnedCandidateIds([]);
  }, [activeSlot?.key]);

  // Flash the "Slot" impact card whenever the projected total for the *same* active slot changes
  // in place (e.g. intensity toggle while a slot stays focused). Keyed per slot so merely
  // switching focus between two slots with different scores doesn't cause a spurious flash.
  const flashTimeoutRef = useRef<number | null>(null);
  const triggerSlotFlash = useCallback(() => {
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    setFlashKey("slot");
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashKey(null);
      flashTimeoutRef.current = null;
    }, 650);
  }, []);
  useEffect(() => () => {
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
  }, []);

  const prevFlashTrackingRef = useRef<{ slotKey: string | null; total: number | null } | undefined>(undefined);
  useEffect(() => {
    const slotKey = activeSlot?.key ?? null;
    const total = activeSlotPreview?.projected.totalProjected ?? null;
    const previous = prevFlashTrackingRef.current;
    prevFlashTrackingRef.current = { slotKey, total };
    if (previous === undefined) return;
    // Only auto-flash when the focused slot stayed the same but its score moved (e.g. intensity
    // toggle). Assignment-driven flashes are triggered explicitly at the click site below, since
    // assigning a candidate usually advances focus to the next open slot in the same tick.
    if (previous.slotKey === slotKey && previous.total !== total) {
      triggerSlotFlash();
    }
  }, [activeSlot?.key, activeSlotPreview?.projected.totalProjected, triggerSlotFlash]);

  // Explicit pulse from the parent covers every real assignment (click, digit-key, Enter
  // top-pick) uniformly, independent of whether focus then jumps to a different (still empty)
  // slot in the same render — which is the common case for fast squad building.
  const prevAssignPulseRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (assignPulse == null) return;
    if (prevAssignPulseRef.current === undefined) {
      prevAssignPulseRef.current = assignPulse;
      return;
    }
    if (prevAssignPulseRef.current !== assignPulse) {
      prevAssignPulseRef.current = assignPulse;
      triggerSlotFlash();
    }
  }, [assignPulse, triggerSlotFlash]);

  const filteredCandidateGroups = useMemo(
    () => filterLegacyLineupCandidateEntries(candidateGroups, candidateTab, playerFilter),
    [candidateGroups, candidateTab, playerFilter],
  );

  const topPickForActiveSlot = filteredCandidateGroups.find((entry) => !entry.activeSlotCandidate?.blockReason) ?? filteredCandidateGroups[0] ?? null;

  const candidateTabCounts = useMemo(
    () => ({
      all: candidateGroups.reduce((sum, group) => sum + group.entries.length, 0),
      instant: candidateGroups.filter((g) => g.key === "instant").reduce((sum, g) => sum + g.entries.length, 0),
      alternative: candidateGroups
        .filter((g) => g.key !== "instant" && g.key !== "blocked")
        .reduce((sum, g) => sum + g.entries.length, 0),
      blocked: candidateGroups.filter((g) => g.key === "blocked").reduce((sum, g) => sum + g.entries.length, 0),
    }),
    [candidateGroups],
  );

  const activeCaptainSide = activeSlot?.disciplineSide ?? "d1";
  const activeCaptainEntries = captainSelectEntriesBySide[activeCaptainSide] ?? [];
  const activeCaptainInfoMap = new Map(captainInfoBySide[activeCaptainSide].map((info) => [info.activePlayerId, info] as const));

  const focusedPlayerName = focusedPlayerId ? rosterCardByActivePlayerId.get(focusedPlayerId)?.name ?? null : null;
  const focusedPlayerDeltaBySlotKey = useMemo(() => {
    if (!focusedPlayerId) return new Map<string, PlayerBestSlotEntry>();
    const entries = playerBestSlotSummaryByActivePlayerId.get(focusedPlayerId) ?? [];
    return new Map(entries.map((entry) => [entry.slotKey, entry] as const));
  }, [focusedPlayerId, playerBestSlotSummaryByActivePlayerId]);

  const allCandidateEntries = useMemo(() => candidateGroups.flatMap((group) => group.entries), [candidateGroups]);
  const candidateEntryByActivePlayerId = useMemo(
    () => new Map(allCandidateEntries.filter((entry) => entry.player.activePlayerId).map((entry) => [entry.player.activePlayerId as string, entry] as const)),
    [allCandidateEntries],
  );
  const pinnedEntries = pinnedCandidateIds
    .map((id) => candidateEntryByActivePlayerId.get(id) ?? null)
    .filter((entry): entry is FocusCandidateEntry => entry != null);

  function togglePinnedCandidate(activePlayerId: string) {
    setPinnedCandidateIds((current) => {
      if (current.includes(activePlayerId)) {
        return current.filter((id) => id !== activePlayerId);
      }
      const next = [...current, activePlayerId];
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
  }

  function toggleFocusedPlayer(activePlayerId: string | null) {
    if (!activePlayerId) return;
    setFocusedPlayerId((current) => (current === activePlayerId ? null : activePlayerId));
  }

  return (
    <div className="legacy-lineup-v2-shell" data-testid="legacy-lineup-v2-board">
      <div className="legacy-lineup-v2-toolbar" aria-label="Matchday Toolbar">
        <div className="legacy-lineup-v2-toolbar-main">
          <span className="legacy-lineup-v2-preview-chip">Preview</span>
          <div>
            <span>Matchday Prep</span>
            <strong>{matchdayHeaderSummary}</strong>
            <small>{lineupSaveCta.label} · {lineupFlowSummary.nextStep.label}</small>
          </div>
        </div>
        <div className="legacy-lineup-v2-toolbar-metrics">
          <span className={matchdayPreviewCards.openSlots > 0 ? "is-warning" : "is-ready"} title="Belegte Slots">
            Slots <strong>{lineupFlowSummary.selectedCount}/{lineupFlowSummary.totalRequired || "—"}</strong>
          </span>
          <span className={captainBudgetExceeded ? "is-blocked" : captainDraftRemaining <= 0 ? "is-warning" : "is-ready"} title="Captain Saisonbudget">
            Captain <strong>{captainSeasonUsedWithDraft}/{captainSeasonLimit}</strong>
          </span>
          <span className={missingSeasonFormCards ? "is-warning" : "is-ready"} title="Formkarten">
            Form <strong>{missingSeasonFormCards ? "offen" : "ok"}</strong>
          </span>
          <span className="is-score" title="Projected Score">
            Score <strong>{formatProjectedMetricWindow(matchdayPreviewCards.totalRangeLow, matchdayPreviewCards.totalRangeHigh)}</strong>
          </span>
          <span className={matchdayPreviewCards.totalFatigue >= 40 ? "is-warning" : "is-ready"} title="Fatigue">
            Fatigue <strong>{formatDecimalScore(matchdayPreviewCards.totalFatigue, 1)}</strong>
          </span>
          <span className={lineupMiniAuditBlockers > 0 ? "is-blocked" : "is-ready"} title="Blocker">
            Blocker <strong>{lineupMiniAuditBlockers}</strong>
          </span>
          <span className={matchdayPreviewCards.riskLevel === "hoch" ? "is-blocked" : matchdayPreviewCards.riskLevel === "mittel" ? "is-warning" : "is-ready"}>
            Risiko <strong>{matchdayPreviewCards.riskLevel}</strong>
          </span>
        </div>
        <div className="legacy-lineup-v2-toolbar-actions">
          <span className="legacy-lineup-v2-keyboard-hint" aria-label="Tastaturkürzel">
            ↑↓ Slots · ⌫ Leeren · 1–4 Kandidat (sichtbare Liste) · Enter Top-Pick
          </span>
          <span className="legacy-lineup-v2-flow-chip" title={lineupFlowSummary.nextStep.detail}>
            {lineupFlowSummary.nextStep.label}
          </span>
          <button className="secondary-button inline-button" type="button" onClick={onFocusNextOpenSlot} disabled={isBusy || matchdayPreviewCards.openSlots === 0}>
            Nächster Slot
          </button>
          <button className="secondary-button inline-button" type="button" onClick={onAutoFillOpenSlots} disabled={isBusy || matchdayPreviewCards.openSlots === 0}>
            Auto-Fill
          </button>
          <button
            className={`primary-button inline-button${lineupReadyToSave ? " is-ready" : ""}`}
            type="button"
            data-testid="lineup-v2-save-button"
            onClick={onSaveDraft}
            disabled={isBusy || isReadOnly}
            title={lineupSaveCta.detail}
          >
            {lineupSaveCta.buttonLabel}
          </button>
        </div>
      </div>

      {controlsSlot ? <div className="legacy-lineup-v2-controls">{controlsSlot}</div> : null}

      {focusedPlayerId ? (
        <div className="legacy-lineup-v2-focus-player-banner">
          <span>
            Fokus: <strong>{focusedPlayerName ?? "Spieler"}</strong> — grün = besser als aktuelle Belegung, rot = schlechter, blau = aktueller Slot.
          </span>
          <button type="button" onClick={() => setFocusedPlayerId(null)} aria-label="Fokus aufheben" title="Fokus aufheben">
            ×
          </button>
        </div>
      ) : null}

      <div className="legacy-lineup-v2-layout">
        <section className="legacy-lineup-v2-slots" aria-label="Slot-Übersicht">
          {(["d1", "d2"] as const).map((disciplineSide) => {
            const discipline = disciplineSide === "d1" ? d1Discipline : d2Discipline;
            const sideSlots = slots.filter((slot) => slot.disciplineSide === disciplineSide);
            const selectedCount = disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected;
            const requiredCount = discipline?.requiredPlayers ?? 0;
            const rank = disciplineSide === "d1" ? d1Rank : d2Rank;
            const sideProgressPercent = requiredCount > 0 ? Math.min(100, Math.round((selectedCount / requiredCount) * 100)) : 0;
            const disciplineColorClass = disciplineColorClassBySide[disciplineSide];

            return (
              <section
                key={`v2-side-${disciplineSide}`}
                className={`legacy-lineup-v2-side is-${disciplineSide} is-intensity-${getDisciplineIntensity(disciplineSide)} ${disciplineColorClass}`.trim()}
              >
                <header className="legacy-lineup-v2-side-head">
                  <div className="legacy-lineup-v2-side-head-main">
                    <span>{disciplineSide.toUpperCase()}</span>
                    <strong>{discipline?.displayName ?? "—"}</strong>
                    <small>
                      Rank {rank ?? "—"} · {selectedCount}/{requiredCount || "—"} Slots
                    </small>
                    <div className="legacy-lineup-progress-track legacy-lineup-v2-progress" aria-label={`${disciplineSide.toUpperCase()} Fortschritt`}>
                      <span style={{ width: `${sideProgressPercent}%` }} />
                    </div>
                  </div>
                  <div className="legacy-lineup-v2-side-meta">
                    <div
                      className={`legacy-lineup-v2-intensity is-${getDisciplineIntensity(disciplineSide)}`}
                      role="group"
                      aria-label={`${disciplineSide.toUpperCase()} Intensity`}
                    >
                      {(["conserve", "normal", "push"] as const).map((intensity) => (
                        <button
                          key={`${disciplineSide}-${intensity}`}
                          type="button"
                          className={getDisciplineIntensity(disciplineSide) === intensity ? "is-selected" : ""}
                          onClick={() => onUpdateDisciplineIntensity(disciplineSide, intensity)}
                          disabled={isReadOnly || isBusy}
                          title={
                            isReadOnly
                              ? "Nur Ansicht – Intensity kann hier nicht geändert werden."
                              : `${disciplineSide.toUpperCase()} auf ${formatIntensityLabel(intensity)} setzen`
                          }
                        >
                          {formatIntensityLabel(intensity)}
                        </button>
                      ))}
                    </div>
                  </div>
                </header>

                <div className="legacy-lineup-v2-slot-list">
                  {sideSlots.map((slot) => {
                    const role = slotRoleByKey.get(slot.key) ?? null;
                    const selectedId = selections[slot.key] ?? "";
                    const rosterCard = selectedId ? rosterCardByActivePlayerId.get(selectedId) ?? null : null;
                    const selectedOption = selectedId ? getSelectedOptionMeta(selectedId) : null;
                    const selectedScore =
                      rosterCard != null
                        ? slot.disciplineSide === "d1"
                          ? rosterCard.discipline1Score
                          : rosterCard.discipline2Score
                        : null;
                    const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
                    const slotCandidates = slotCandidateSummaryByKey.get(slot.key)?.topCandidates ?? [];
                    const topCandidate = slotCandidates[0] ?? null;
                    const isActive = activeSlotKey === slot.key;
                    const projected = slotPreview?.projected.totalProjected ?? null;
                    const readiness = getSlotReadinessLabel(Boolean(rosterCard), projected);
                    const issues = slotIssuesByKey.get(slot.key) ?? [];
                    const dragPreview = slotDragPreviewByKey.get(slot.key) ?? null;
                    const isCaptain = captains[slot.disciplineSide] === selectedId && Boolean(selectedId);

                    const knownProjectedScores = [...slotCandidates.map((candidate) => candidate.projectedScore), projected].filter(
                      (value): value is number => value != null,
                    );
                    const bestKnownProjected = knownProjectedScores.length > 0 ? Math.max(...knownProjectedScores) : null;
                    const idleFitTier =
                      rosterCard && projected != null && bestKnownProjected != null
                        ? getLegacyLineupDragFitTier({
                            blocked: false,
                            projectedScore: projected,
                            bestProjectedScore: bestKnownProjected,
                            currentProjectedScore: projected,
                          })
                        : null;

                    const focusEntry = focusedPlayerId ? focusedPlayerDeltaBySlotKey.get(slot.key) ?? null : null;
                    const isFocusedPlayerCurrentSlot = focusedPlayerId != null && selectedId === focusedPlayerId;
                    const focusClass = !focusedPlayerId
                      ? ""
                      : isFocusedPlayerCurrentSlot
                        ? " is-focus-current"
                        : focusEntry?.projectedDelta != null && focusEntry.projectedDelta > 0.05
                          ? " is-focus-better"
                          : focusEntry?.projectedDelta != null && focusEntry.projectedDelta < -0.05
                            ? " is-focus-worse"
                            : "";

                    return (
                      <div
                        key={`v2-slot-${slot.key}`}
                        id={`lineup-slot-${slot.key}`}
                        className={`legacy-lineup-v2-slot-row${isActive ? " is-active" : ""}${rosterCard ? " is-filled" : " is-empty"}${draggedActivePlayerId ? " is-drop-ready" : ""} ${getDragFitTierClass(dragPreview?.fitTier ?? null)} ${getIdleTierGlowClass(idleFitTier)}${focusClass}`.trim()}
                        onDragOver={(event) => {
                          if (dragPreview?.blockReason) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          onDropOnSlot(slot.key, event.dataTransfer.getData("text/plain") || draggedActivePlayerId);
                        }}
                      >
                        <button type="button" className="legacy-lineup-v2-slot-main" onClick={() => onActiveSlotChange(slot.key)}>
                          <span className="legacy-lineup-v2-slot-index">{disciplineSide.toUpperCase()}-{slot.slotIndex + 1}</span>
                          <span className="legacy-lineup-v2-slot-role">{role?.label ?? "Slot"}</span>

                          {rosterCard ? (
                            <span className="legacy-lineup-v2-slot-player">
                              {rosterCard.portraitUrl ? (
                                <OptimizedMediaImage className="legacy-lineup-v2-slot-portrait" src={rosterCard.portraitUrl} alt={rosterCard.name} width={32} height={32} />
                              ) : (
                                <span className="legacy-lineup-v2-slot-portrait is-placeholder">{rosterCard.name.slice(0, 2).toUpperCase()}</span>
                              )}
                              <strong>{rosterCard.name}</strong>
                              {isCaptain ? <span className="legacy-lineup-v2-captain-badge">C</span> : null}
                            </span>
                          ) : (
                            <span className="legacy-lineup-v2-slot-empty-label">Offen</span>
                          )}

                          <span className="legacy-lineup-v2-slot-metrics">
                            <em>Base {formatNullableScore(selectedScore)}</em>
                            <strong>Slot {formatNullableScore(projected ?? topCandidate?.projectedScore ?? null)}</strong>
                            {rosterCard && slotPreview?.projected.rangeLow != null && slotPreview?.projected.rangeHigh != null ? (
                              <VeloRangeBar
                                className="legacy-lineup-v2-slot-range"
                                compact
                                low={slotPreview.projected.rangeLow}
                                high={slotPreview.projected.rangeHigh}
                                point={slotPreview.projected.totalProjected}
                              />
                            ) : null}
                            <small>F {Math.round(selectedOption?.fatigueCount ?? 0)}</small>
                          </span>

                          <span className={`legacy-lineup-v2-slot-state is-${readiness === "Offen" ? "open" : "ready"}`}>{readiness}</span>
                        </button>

                        {rosterCard && !isReadOnly ? (
                          <button
                            type="button"
                            className="legacy-lineup-v2-slot-clear"
                            data-testid="lineup-v2-clear-slot"
                            title="Spieler entfernen (Backspace)"
                            aria-label={`${rosterCard.name} aus Slot entfernen`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onClearSlot(slot.key);
                            }}
                          >
                            ×
                          </button>
                        ) : null}

                        {!rosterCard && topCandidate ? (
                          <button
                            type="button"
                            className="legacy-lineup-v2-top-pick-chip"
                            disabled={isReadOnly}
                            onClick={() => onAssignPlayer(slot.key, topCandidate.activePlayerId)}
                            title={topCandidate.fitDetail}
                          >
                            {topCandidate.name} · {formatNullableScore(topCandidate.projectedScore)}
                          </button>
                        ) : null}

                        {issues[0] ? (
                          <span className={`legacy-lineup-v2-slot-issue is-${issues[0].tone}`} title={issues[0].detail}>
                            {issues[0].label}
                          </span>
                        ) : null}

                        {dragPreview ? (
                          <span className={`legacy-lineup-v2-slot-drop-preview ${getDragFitTierClass(dragPreview.fitTier)}`}>
                            Drop {formatNullableScore(dragPreview.projected.totalProjected)}
                            {dragPreview.scoreDelta != null ? ` · ${dragPreview.scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(dragPreview.scoreDelta, 1)}` : ""}
                          </span>
                        ) : null}

                        {focusedPlayerId && isFocusedPlayerCurrentSlot ? (
                          <span className="legacy-lineup-v2-slot-focus-delta is-current">Aktueller Slot von {focusedPlayerName ?? "Spieler"}</span>
                        ) : focusedPlayerId && focusEntry?.projectedDelta != null ? (
                          <span className={`legacy-lineup-v2-slot-focus-delta ${focusEntry.projectedDelta > 0 ? "is-positive" : focusEntry.projectedDelta < 0 ? "is-negative" : ""}`}>
                            {focusedPlayerName ?? "Spieler"} hier: {formatSignedDecimalScore(focusEntry.projectedDelta)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>

        <aside className="legacy-lineup-v2-focus" aria-label="Aktiver Slot">
          {!activeSlot ? (
            <div className="legacy-lineup-v2-focus-empty">
              <span>Fokus</span>
              <strong>Slot auswählen</strong>
              <small>Wähle links einen Slot für Kandidaten, Captain und Score-Preview.</small>
            </div>
          ) : (
            <>
              <header className="legacy-lineup-v2-focus-head">
                <div>
                  <span>{activeSlot.disciplineSide.toUpperCase()}-{activeSlot.slotIndex + 1}</span>
                  <strong>{activeRole?.label ?? "Slot"}</strong>
                  <small>{activeRole?.description ?? "Standard-Rolle"}</small>
                </div>
                <div className="legacy-lineup-v2-focus-actions">
                  {topPickForActiveSlot && !activeRosterCard && !isReadOnly ? (
                    <button
                      type="button"
                      className="primary-button inline-button"
                      onClick={() => topPickForActiveSlot.player.activePlayerId && onAssignPlayer(activeSlot.key, topPickForActiveSlot.player.activePlayerId)}
                    >
                      Top Pick
                    </button>
                  ) : null}
                  {activeRosterCard && !isReadOnly ? (
                    <button type="button" className="secondary-button inline-button" onClick={() => onClearSlot(activeSlot.key)}>
                      Leeren
                    </button>
                  ) : null}
                  <button type="button" className="secondary-button inline-button" onClick={onFocusNextOpenSlot} disabled={isBusy}>
                    Nächster
                  </button>
                </div>
              </header>

              {activeRoleAttributes.length > 0 ? (
                <div className="legacy-lineup-v2-role-attributes">
                  {activeRoleAttributes.map((attribute) => (
                    <span
                      key={`${activeSlot.key}-${attribute.key}`}
                      className={`legacy-lineup-slot-attribute-pill ${getTierStyleClass(attribute.ratingLabel)} ${attribute.emphasis === "support" ? "is-strain" : "is-positive"}`}
                    >
                      {attribute.shortLabel} {attribute.ratingLabel ?? "—"}
                    </span>
                  ))}
                </div>
              ) : null}

              {activeRosterCard ? (
                <FoundationPlayerPortraitCard
                  playerId={activeRosterCard.id}
                  name={activeRosterCard.name}
                  portraitUrl={activeRosterCard.portraitUrl}
                  portraitInitials={activeRosterCard.name.slice(0, 2).toUpperCase()}
                  playerOvr={null}
                  playerMvs={null}
                  pow={null}
                  spe={null}
                  men={null}
                  soc={null}
                  leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
                  variant="team"
                  context="lineup"
                  density="compact"
                  interactive={false}
                  playerClassName={activeRosterCard.className}
                  contextData={{
                    lineup: {
                      d1Score: `D1: ${formatNullableScore(activeRosterCard.discipline1Score)}`,
                      d2Score: `D2: ${formatNullableScore(activeRosterCard.discipline2Score)}`,
                      fatigueLabel: `F ${Math.round(activeSelectedOption?.fatigueCount ?? 0)}`,
                    },
                  }}
                  footerSlot={
                    <button type="button" className="secondary-button inline-button" onClick={() => onOpenPlayer(activeRosterCard.id, activeRosterCard.activePlayerId)}>
                      Profil
                    </button>
                  }
                />
              ) : (
                <div className="legacy-lineup-v2-focus-open">
                  <span>Freier Slot</span>
                  <strong>{topPickForActiveSlot?.player.name ?? "Keine Kandidaten"}</strong>
                  <small>{topPickForActiveSlot?.detail ?? "Kandidat unten wählen oder Top-Pick übernehmen."}</small>
                </div>
              )}

              {activeSlotPreview ? (
                <VeloImpactStrip
                  className="legacy-lineup-v2-impact"
                  flashKey={flashKey}
                  items={[
                    {
                      key: "base",
                      label: "Base",
                      value: formatNullableScore(activeSlotPreview.selectedScore ?? null),
                      tone: "neutral",
                    },
                    {
                      key: "role",
                      label: "Rolle",
                      value: formatSignedDecimalScore(activeSlotPreview.projected.roleModifier ?? 0, 1),
                      tone: (activeSlotPreview.projected.roleModifier ?? 0) >= 0 ? "positive" : "negative",
                    },
                    {
                      key: "slot",
                      label: "Slot",
                      value: formatNullableScore(activeSlotPreview.projected.totalProjected),
                      tone: "positive",
                    },
                    {
                      key: "fatigue",
                      label: "Fatigue",
                      value: `+${formatDecimalScore(activeSlotPreview.projected.additionalFatigue ?? 0, 1)}`,
                      tone: "neutral",
                    },
                    {
                      key: "malus",
                      label: "Malus",
                      value: formatDecimalScore(activeSlotPreview.projected.fatigueModifier ?? 0, 1),
                      tone: "negative",
                    },
                  ]}
                />
              ) : null}

              {activeSlotPreview && activeSlotPreview.projected.rangeLow != null && activeSlotPreview.projected.rangeHigh != null ? (
                <div className="legacy-lineup-v2-focus-range">
                  <span>Range ({formatIntensityLabel(getDisciplineIntensity(activeSlot.disciplineSide))})</span>
                  <VeloRangeBar
                    low={activeSlotPreview.projected.rangeLow}
                    high={activeSlotPreview.projected.rangeHigh}
                    point={activeSlotPreview.projected.totalProjected}
                    tone="positive"
                  />
                  <strong>
                    {formatNullableScore(activeSlotPreview.projected.rangeLow)}–{formatNullableScore(activeSlotPreview.projected.rangeHigh)}
                  </strong>
                </div>
              ) : null}

              <div className="legacy-lineup-v2-captain-strip">
                <label>
                  <span>Captain {activeCaptainSide.toUpperCase()}</span>
                  <select
                    className="input"
                    value={captains[activeCaptainSide]}
                    onChange={(event) => onUpdateCaptain(activeCaptainSide, event.target.value)}
                    disabled={isReadOnly || activeCaptainEntries.length === 0}
                  >
                    <option value="">Kein Captain</option>
                    {activeCaptainEntries.map((entry) => {
                      const info = activeCaptainInfoMap.get(entry.activePlayerId);
                      return (
                        <option key={entry.activePlayerId} value={entry.activePlayerId}>
                          {entry.name} · +{formatNullableScore(info?.estimatedCaptainBonus ?? null)}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <small>{captainDraftRemaining} frei heute</small>
              </div>

              {pinnedEntries.length > 0 ? (
                <div className="legacy-lineup-v2-compare" aria-label="Kandidaten-Vergleich">
                  <div className="legacy-lineup-v2-compare-head">
                    <span>Vergleich{pinnedEntries.length < 2 ? " · zweiten Kandidaten anheften" : ""}</span>
                    <button type="button" onClick={() => setPinnedCandidateIds([])} aria-label="Vergleich zurücksetzen" title="Vergleich zurücksetzen">
                      ×
                    </button>
                  </div>
                  <div className="legacy-lineup-v2-compare-grid">
                    <span />
                    {pinnedEntries.map((entry) => (
                      <span key={`compare-name-${entry.player.activePlayerId}`} className="is-name">
                        {entry.player.name}
                      </span>
                    ))}
                    {pinnedEntries.length === 1 ? <span /> : null}

                    <span>Base</span>
                    {pinnedEntries.map((entry) => (
                      <span key={`compare-base-${entry.player.activePlayerId}`}>{formatNullableScore(entry.activeSlotCandidate?.baseScore ?? null)}</span>
                    ))}
                    {pinnedEntries.length === 1 ? <span /> : null}

                    <span>Rolle</span>
                    {pinnedEntries.map((entry) => (
                      <span key={`compare-role-${entry.player.activePlayerId}`}>{formatSignedDecimalScore(entry.activeSlotCandidate?.roleModifier ?? null)}</span>
                    ))}
                    {pinnedEntries.length === 1 ? <span /> : null}

                    <span>Intensity</span>
                    {pinnedEntries.map((entry) => (
                      <span key={`compare-intensity-${entry.player.activePlayerId}`}>{formatIntensityLabel(getDisciplineIntensity(activeSlot.disciplineSide))}</span>
                    ))}
                    {pinnedEntries.length === 1 ? <span /> : null}

                    <span>Fatigue</span>
                    {pinnedEntries.map((entry) => (
                      <span key={`compare-fatigue-${entry.player.activePlayerId}`}>
                        -{formatDecimalScore(entry.activeSlotCandidate?.fatigueModifier ?? 0, 1)} / +{formatDecimalScore(entry.activeSlotCandidate?.additionalFatigue ?? 0, 1)}
                      </span>
                    ))}
                    {pinnedEntries.length === 1 ? <span /> : null}

                    <span>Range</span>
                    {pinnedEntries.map((entry) => (
                      <span key={`compare-range-${entry.player.activePlayerId}`}>
                        {formatNullableScore(entry.activeSlotCandidate?.rangeLow ?? null)}–{formatNullableScore(entry.activeSlotCandidate?.rangeHigh ?? null)}
                      </span>
                    ))}
                    {pinnedEntries.length === 1 ? <span /> : null}

                    <span>Score</span>
                    {pinnedEntries.map((entry, index) => {
                      const otherScore = pinnedEntries[1 - index]?.activeSlotCandidate?.projectedScore ?? null;
                      const thisScore = entry.activeSlotCandidate?.projectedScore ?? null;
                      const isWinner = pinnedEntries.length === 2 && thisScore != null && otherScore != null && thisScore > otherScore;
                      return (
                        <span key={`compare-score-${entry.player.activePlayerId}`} className={isWinner ? "is-winner" : ""}>
                          {formatNullableScore(thisScore)}
                        </span>
                      );
                    })}
                    {pinnedEntries.length === 1 ? <span /> : null}
                  </div>
                </div>
              ) : null}

              <section className="legacy-lineup-v2-candidates" aria-label="Kandidaten für aktiven Slot">
                <div className="legacy-lineup-v2-candidates-head">
                  <div className="legacy-lineup-v2-candidate-tabs" role="tablist" data-testid="lineup-v2-candidate-tabs">
                    {([
                      { key: "all" as const, label: "Alle" },
                      { key: "instant" as const, label: "Sofort" },
                      { key: "alternative" as const, label: "Alternative" },
                      { key: "blocked" as const, label: "Blockiert" },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={candidateTab === tab.key}
                        className={candidateTab === tab.key ? "is-active" : ""}
                        onClick={() => onCandidateTabChange(tab.key)}
                      >
                        {tab.label} ({candidateTabCounts[tab.key]})
                      </button>
                    ))}
                  </div>
                  <input
                    className="input legacy-lineup-v2-candidate-search"
                    type="search"
                    value={playerFilter}
                    onChange={(event) => onPlayerFilterChange(event.target.value)}
                    placeholder="Kandidat suchen"
                    aria-label="Kandidaten suchen"
                  />
                </div>
                <div className="legacy-lineup-v2-candidate-list">
                  {filteredCandidateGroups.length === 0 ? (
                    <span className="legacy-lineup-v2-candidate-empty">Keine Kandidaten in dieser Gruppe.</span>
                  ) : (
                    filteredCandidateGroups.map((entry, index) => {
                      const candidate = entry.player;
                      const projectedScore = entry.activeSlotCandidate?.projectedScore ?? null;
                      const scoreDelta = entry.activeSlotCandidate?.scoreDelta ?? null;
                      const isAssigned = activeSelectionId === candidate.activePlayerId;
                      const isBlocked = Boolean(entry.activeSlotCandidate?.blockReason);
                      const isPinned = Boolean(candidate.activePlayerId && pinnedCandidateIds.includes(candidate.activePlayerId));
                      const isFocused = Boolean(candidate.activePlayerId && focusedPlayerId === candidate.activePlayerId);

                      const bestSlotEntries = candidate.activePlayerId ? playerBestSlotSummaryByActivePlayerId.get(candidate.activePlayerId) ?? [] : [];
                      const bestSlot = bestSlotEntries[0] ?? null;
                      const showBestSlotTag = Boolean(bestSlot && activeSlot && bestSlot.slotKey !== activeSlot.key && bestSlot.projectedScore != null);
                      const bestSlotDeltaVsHere =
                        showBestSlotTag && bestSlot && projectedScore != null && bestSlot.projectedScore != null
                          ? Number((bestSlot.projectedScore - projectedScore).toFixed(1))
                          : null;

                      return (
                        <div
                          key={`v2-candidate-${candidate.id}-${entry.groupKey}`}
                          className={`legacy-lineup-v2-candidate-row${isAssigned ? " is-assigned" : ""}${isBlocked ? " is-blocked" : ""} ${getIdleTierGlowClass(entry.fitTier)}`.trim()}
                          draggable={Boolean(candidate.activePlayerId) && !isBlocked}
                          onDragStart={() => candidate.activePlayerId && onDragStart(candidate.activePlayerId)}
                          onDragEnd={onDragEnd}
                        >
                          {index < 4 ? (
                            <span className="legacy-lineup-v2-candidate-rank-badge" aria-hidden="true">
                              {index + 1}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="legacy-lineup-v2-candidate-main-btn"
                            disabled={isReadOnly || isBlocked}
                            onClick={() => {
                              if (!candidate.activePlayerId) return;
                              onAssignPlayer(activeSlot.key, candidate.activePlayerId);
                            }}
                          >
                            {candidate.portraitUrl ? (
                              <OptimizedMediaImage className="legacy-lineup-v2-candidate-portrait" src={candidate.portraitUrl} alt={candidate.name} width={36} height={36} />
                            ) : (
                              <span className="legacy-lineup-v2-candidate-portrait is-placeholder">{candidate.name.slice(0, 2).toUpperCase()}</span>
                            )}
                            <span className="legacy-lineup-v2-candidate-main">
                              <strong>{candidate.name}</strong>
                              <small>
                                {entry.groupMeta.label}
                                {entry.wantsActiveSlot ? " · Wunsch" : ""}
                                {entry.shortReason ? ` · ${entry.shortReason}` : ""}
                              </small>
                              <small className="legacy-lineup-v2-candidate-detail">{entry.detail}</small>
                              {showBestSlotTag && bestSlot ? (
                                <span className="legacy-lineup-v2-best-slot-tag" title="Slot mit der besten Projektion für diesen Spieler">
                                  Bester Slot: {bestSlot.disciplineSide.toUpperCase()}-{bestSlot.slotIndex + 1}
                                  {bestSlotDeltaVsHere != null ? ` (${formatSignedDecimalScore(bestSlotDeltaVsHere)})` : ""}
                                </span>
                              ) : null}
                              {entry.activeSlotCandidate?.rangeLow != null && entry.activeSlotCandidate?.rangeHigh != null ? (
                                <VeloRangeBar
                                  className="legacy-lineup-v2-candidate-range"
                                  compact
                                  low={entry.activeSlotCandidate.rangeLow}
                                  high={entry.activeSlotCandidate.rangeHigh}
                                  point={projectedScore}
                                />
                              ) : null}
                            </span>
                            <span className="legacy-lineup-v2-candidate-metrics">
                              <strong>{formatNullableScore(projectedScore)}</strong>
                              {scoreDelta != null ? (
                                <em>
                                  {scoreDelta >= 0 ? "+" : ""}
                                  {formatDecimalScore(scoreDelta, 1)}
                                </em>
                              ) : null}
                            </span>
                          </button>
                          <span className="legacy-lineup-v2-candidate-actions">
                            <button
                              type="button"
                              className={`legacy-lineup-v2-focus-btn${isFocused ? " is-active" : ""}`}
                              title="Beste Slots für diesen Spieler im Slot-Board hervorheben"
                              aria-label={`Beste Slots für ${candidate.name} anzeigen`}
                              disabled={!candidate.activePlayerId}
                              onClick={() => toggleFocusedPlayer(candidate.activePlayerId)}
                            >
                              🎯
                            </button>
                            <button
                              type="button"
                              className={`legacy-lineup-v2-pin-btn${isPinned ? " is-pinned" : ""}`}
                              title="Zum Vergleich anheften"
                              aria-label={`${candidate.name} zum Vergleich anheften`}
                              disabled={!candidate.activePlayerId}
                              onClick={() => candidate.activePlayerId && togglePinnedCandidate(candidate.activePlayerId)}
                            >
                              📌
                            </button>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>

      {tacticsSlot ? (
        <details className="legacy-lineup-v2-tactics">
          <summary>Taktik · Form & Team-Power</summary>
          <div className="legacy-lineup-v2-tactics-body">{tacticsSlot}</div>
        </details>
      ) : null}
    </div>
  );
}
