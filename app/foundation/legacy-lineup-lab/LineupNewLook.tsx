"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { LegacyLineupFocusV2BoardProps } from "@/app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board";
import { NlRadar, type NlAxisKey } from "@/components/foundation/new-look";
import { filterLegacyLineupCandidateEntries } from "@/lib/lineups/legacy-lineup-candidate-tabs";
import type { MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";

/**
 * "Neuer Look" Einsatzliste — flag-gated Squad-Builder (additiv).
 *
 * Wird nur gerendert, wenn `useNewLook` aktiv ist; `LegacyLineupLabClient`
 * fällt ohne Flag byte-identisch auf focusV2/classic zurück. Der Builder
 * erfindet keine Spiellogik: Er konsumiert dieselben abgeleiteten Props wie
 * `LegacyLineupFocusV2Board` (Slots, Selections, Kandidaten-Gruppen,
 * Slot-Previews, Best-Slot-Summaries) und ruft dieselben Handler auf
 * (`onAssignPlayer` → updateSelection, `onClearSlot`, `onAutoFillOpenSlots`,
 * `onSaveDraft`, Intensity-/Captain-Updates, Undo).
 *
 * Die Entscheidungs-Signale (Lead-Tier "Alternativlos/Klar bester/Knapp vor
 * #2/Enges Rennen" und der D1/D2-Lane-Verdict) spiegeln bewusst exakt die
 * v1-Schwellen aus `LegacyLineupFocusV2Board.tsx` (dort modul-privat, Datei
 * darf hier nicht angefasst werden — Werte synchron halten!).
 */

type NlCandidateEntry = LegacyLineupFocusV2BoardProps["candidateGroups"][number]["entries"][number];
type NlBestSlotEntry = { slotKey: string; disciplineSide: "d1" | "d2"; slotIndex: number; projectedScore: number | null; projectedDelta: number | null; fitSummary: string };

export type LineupNewLookProps = Pick<
  LegacyLineupFocusV2BoardProps,
  | "context"
  | "slots"
  | "selections"
  | "activeSlotKey"
  | "nextOpenSlotKey"
  | "onActiveSlotChange"
  | "rosterCardByActivePlayerId"
  | "slotCandidateSummaryByKey"
  | "slotPreviewByKey"
  | "slotRoleByKey"
  | "slotIssuesByKey"
  | "candidateGroups"
  | "candidateTab"
  | "onCandidateTabChange"
  | "playerBestSlotSummaryByActivePlayerId"
  | "captains"
  | "captainSelectEntriesBySide"
  | "captainInfoBySide"
  | "captainDraftRemaining"
  | "captainSeasonUsedWithDraft"
  | "captainSeasonLimit"
  | "onUpdateCaptain"
  | "lineupMeta"
  | "d1Rank"
  | "d2Rank"
  | "getSelectedOptionMeta"
  | "onAssignPlayer"
  | "assignPulse"
  | "onClearSlot"
  | "onOpenPlayer"
  | "isReadOnly"
  | "isBusy"
  | "matchdayPreviewCards"
  | "lineupFlowSummary"
  | "lineupSaveCta"
  | "lineupReadyToSave"
  | "lineupFinishItems"
  | "formatProjectedMetricWindow"
  | "onFocusNextOpenSlot"
  | "onAutoFillOpenSlots"
  | "onSaveDraft"
  | "getDisciplineIntensity"
  | "onUpdateDisciplineIntensity"
  | "playerFilter"
  | "onPlayerFilterChange"
  | "controlsSlot"
  | "arenaReady"
  | "onNavigateArena"
  | "disciplineTacticPreviewBySide"
> & {
  /** Slot, der gerade real zugewiesen wurde (Client-State, ~900ms Lebenszeit). */
  recentlyAssignedSlotKey: string | null;
  /** Undo-Snapshot-Metadaten aus dem Client (null = nichts rückgängig zu machen). */
  undoInfo: { label: string; detail: string } | null;
  onUndo: () => void;
  /** Letzte Statusmeldung des Clients (Save-Feedback etc.). */
  statusMessage: string;
  errors: string[];
};

/* --- Format-Helfer (lokal, präsentational) --------------------------- */

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatNullableScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return formatScore(value);
}

function formatSignedScore(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatIntensityLabel(intensity: MatchdayIntensityStage) {
  if (intensity === "push") return "Vollgas";
  if (intensity === "conserve") return "Schonen";
  return "Normal";
}

/* --- v1-Entscheidungs-Signale (Schwellen synchron zu LegacyLineupFocusV2Board) --- */

const NL_LEAD_ALTERNATIVLOS_MIN = 10;
const NL_LEAD_KLAR_MIN = 4;
const NL_LEAD_KNAPP_MIN = 1.5;

function getNlLineupLeadTier(lead: number): { label: string; tone: "good" | "accent" | "neutral" | "risk" } {
  if (lead >= NL_LEAD_ALTERNATIVLOS_MIN) return { label: "Alternativlos", tone: "good" };
  if (lead >= NL_LEAD_KLAR_MIN) return { label: "Klar bester", tone: "accent" };
  if (lead >= NL_LEAD_KNAPP_MIN) return { label: "Knapp vor #2", tone: "neutral" };
  return { label: "Enges Rennen", tone: "risk" };
}

const NL_LANE_FLEX_MAX = 3;

function getNlLaneVerdict(bestD1: number | null, bestD2: number | null): { label: string; detail: string } | null {
  if (bestD1 == null && bestD2 == null) return null;
  if (bestD1 == null) return { label: "Nur D2", detail: "Nur D2-Projektion bekannt" };
  if (bestD2 == null) return { label: "Nur D1", detail: "Nur D1-Projektion bekannt" };
  const diff = bestD2 - bestD1;
  if (Math.abs(diff) < NL_LANE_FLEX_MAX) return { label: "Flexibel", detail: "D1 und D2 fast gleichauf" };
  if (diff > 0) return { label: `D2-Typ ${formatSignedScore(diff)}`, detail: `Stärker in D2 (${formatSignedScore(diff)})` };
  return { label: `D1-Typ ${formatSignedScore(-diff)}`, detail: `Stärker in D1 (${formatSignedScore(-diff)})` };
}

/** Spiegelt getSlotReadinessLabel aus dem v1-Board (belegte Slots). */
function getNlSlotReadiness(projected: number | null, topPickScore: number | null): { label: string; tone: "good" | "neutral" | "risk" } {
  if (projected == null) return { label: "Gesetzt", tone: "neutral" };
  if (topPickScore != null && projected >= topPickScore - 0.05) return { label: "Bester Pick ✓", tone: "good" };
  if (topPickScore != null && projected >= topPickScore - 8) return { label: "Solide", tone: "neutral" };
  return { label: "Notfall", tone: "risk" };
}

function getAxisForCategory(category: string | null | undefined): NlAxisKey | null {
  if (category === "power") return "pow";
  if (category === "speed") return "spe";
  if (category === "mental") return "men";
  if (category === "social") return "soc";
  return null;
}

const NL_AXIS_AREA_LABEL: Record<NlAxisKey, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

/* --- Kleinteile ------------------------------------------------------- */

function NlCompletenessRing({ selected, total, ready }: { selected: number; total: number; ready: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(1, selected / total) : 0;
  return (
    <div
      className={`nl-lineup-ring${ready ? " is-ready" : pct >= 1 ? " is-full" : ""}`}
      role="img"
      aria-label={`Aufstellung ${selected} von ${total || "—"} Slots besetzt${ready ? ", bereit zum Speichern" : ""}`}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="nl-lineup-ring-track" cx="32" cy="32" r={radius} />
        <circle
          className="nl-lineup-ring-fill"
          cx="32"
          cy="32"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="nl-lineup-ring-copy">
        <strong className="nl-tnum">
          {selected}/{total || "—"}
        </strong>
        <small>{ready ? "bereit" : "Slots"}</small>
      </span>
    </div>
  );
}

function NlLaneMeter({ bestD1, bestD2 }: { bestD1: number | null; bestD2: number | null }) {
  const maxValue = Math.max(bestD1 ?? 0, bestD2 ?? 0, 0.01);
  const rows: Array<{ label: string; value: number | null }> = [
    { label: "D1", value: bestD1 },
    { label: "D2", value: bestD2 },
  ];
  return (
    <span className="nl-lineup-lane-meter" aria-hidden="true">
      {rows.map((row) => {
        const hasValue = row.value != null && Number.isFinite(row.value);
        const pct = hasValue ? Math.max(6, Math.min(100, ((row.value as number) / maxValue) * 100)) : 0;
        return (
          <span key={row.label} className="nl-lineup-lane-row">
            <small>{row.label}</small>
            <span className="nl-lineup-lane-track">{hasValue ? <span style={{ width: `${pct}%` }} /> : null}</span>
            <em className="nl-tnum">{hasValue ? formatScore(row.value as number) : "—"}</em>
          </span>
        );
      })}
    </span>
  );
}

type NlVerdictState = {
  key: number;
  slotLabel: string;
  playerName: string;
  projected: number | null;
  lead: number | null;
  tierLabel: string;
  tierTone: "good" | "accent" | "neutral" | "risk";
};

/* --- Hauptkomponente --------------------------------------------------- */

export default function LineupNewLook({
  context,
  slots,
  selections,
  activeSlotKey,
  nextOpenSlotKey,
  onActiveSlotChange,
  rosterCardByActivePlayerId,
  slotCandidateSummaryByKey,
  slotPreviewByKey,
  slotRoleByKey,
  slotIssuesByKey,
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
  matchdayPreviewCards,
  lineupFlowSummary,
  lineupSaveCta,
  lineupReadyToSave,
  lineupFinishItems,
  formatProjectedMetricWindow,
  onFocusNextOpenSlot,
  onAutoFillOpenSlots,
  onSaveDraft,
  getDisciplineIntensity,
  onUpdateDisciplineIntensity,
  playerFilter,
  onPlayerFilterChange,
  controlsSlot,
  arenaReady = false,
  onNavigateArena,
  disciplineTacticPreviewBySide,
  recentlyAssignedSlotKey,
  undoInfo,
  onUndo,
  statusMessage,
  errors,
}: LineupNewLookProps) {
  const [hoveredCandidateId, setHoveredCandidateId] = useState<string | null>(null);
  const [saveHelpOpen, setSaveHelpOpen] = useState(false);
  const [verdict, setVerdict] = useState<NlVerdictState | null>(null);
  const verdictTimeoutRef = useRef<number | null>(null);
  const prevAssignPulseRef = useRef<number | undefined>(undefined);

  // Verdikt-HUD: feuert auf jede echte Zuweisung (assignPulse aus updateSelection).
  // Der Vergleichswert ist die beste *verbleibende* Alternative für den Slot —
  // beantwortet direkt "Ist dieser Spieler klar der Beste für den Slot?".
  useEffect(() => {
    if (assignPulse == null) return;
    if (prevAssignPulseRef.current === undefined) {
      prevAssignPulseRef.current = assignPulse;
      return;
    }
    if (prevAssignPulseRef.current === assignPulse) return;
    prevAssignPulseRef.current = assignPulse;

    const slotKey = recentlyAssignedSlotKey;
    if (!slotKey) return;
    const slot = slots.find((entry) => entry.key === slotKey);
    const assignedId = selections[slotKey] ?? "";
    const player = assignedId ? rosterCardByActivePlayerId.get(assignedId) ?? null : null;
    if (!slot || !player) return;

    const projected = slotPreviewByKey.get(slotKey)?.projected.totalProjected ?? null;
    const bestAlternative =
      slotCandidateSummaryByKey.get(slotKey)?.topCandidates.find((candidate) => candidate.activePlayerId !== assignedId) ?? null;
    const lead =
      projected != null && bestAlternative?.projectedScore != null
        ? Number((projected - bestAlternative.projectedScore).toFixed(1))
        : null;
    const tier =
      lead == null
        ? { label: "Gesetzt", tone: "neutral" as const }
        : lead < -0.05
          ? { label: "Bessere Option frei", tone: "risk" as const }
          : getNlLineupLeadTier(lead);

    setVerdict({
      key: assignPulse,
      slotLabel: `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1}`,
      playerName: player.name,
      projected,
      lead,
      tierLabel: tier.label,
      tierTone: tier.tone,
    });
    if (verdictTimeoutRef.current) {
      window.clearTimeout(verdictTimeoutRef.current);
    }
    verdictTimeoutRef.current = window.setTimeout(() => {
      setVerdict(null);
      verdictTimeoutRef.current = null;
    }, 2000);
  }, [assignPulse, recentlyAssignedSlotKey, rosterCardByActivePlayerId, selections, slotCandidateSummaryByKey, slotPreviewByKey, slots]);

  useEffect(
    () => () => {
      if (verdictTimeoutRef.current) window.clearTimeout(verdictTimeoutRef.current);
    },
    [],
  );

  const activeSlot = useMemo(
    () => (activeSlotKey ? slots.find((slot) => slot.key === activeSlotKey) ?? null : null),
    [activeSlotKey, slots],
  );

  const filteredCandidates = useMemo(
    () => filterLegacyLineupCandidateEntries(candidateGroups, candidateTab, playerFilter),
    [candidateGroups, candidateTab, playerFilter],
  );

  const candidateTabCounts = useMemo(
    () => ({
      all: candidateGroups.reduce((sum, group) => sum + group.entries.length, 0),
      instant: candidateGroups.filter((group) => group.key === "instant").reduce((sum, group) => sum + group.entries.length, 0),
      alternative: candidateGroups
        .filter((group) => group.key !== "instant" && group.key !== "blocked")
        .reduce((sum, group) => sum + group.entries.length, 0),
      blocked: candidateGroups.filter((group) => group.key === "blocked").reduce((sum, group) => sum + group.entries.length, 0),
    }),
    [candidateGroups],
  );

  // Live-Teamstärke: Ø der vier Achsen über alle aktuell gesetzten Spieler
  // (nur echte coreStats aus dem Kader — Slots ohne coreStats zählen nicht mit).
  const teamAxisAverage = useMemo(() => {
    const stats = slots
      .map((slot) => selections[slot.key])
      .filter((id): id is string => Boolean(id))
      .map((id) => rosterCardByActivePlayerId.get(id)?.coreStats ?? null)
      .filter((entry): entry is { pow: number; spe: number; men: number; soc: number } => entry != null);
    if (stats.length === 0) return null;
    const sum = stats.reduce(
      (acc, entry) => ({ pow: acc.pow + entry.pow, spe: acc.spe + entry.spe, men: acc.men + entry.men, soc: acc.soc + entry.soc }),
      { pow: 0, spe: 0, men: 0, soc: 0 },
    );
    return {
      count: stats.length,
      axes: (["pow", "spe", "men", "soc"] as const).map((key) => ({ key, value: Number((sum[key] / stats.length).toFixed(1)) })),
    };
  }, [rosterCardByActivePlayerId, selections, slots]);

  const topPickForActiveSlot = useMemo(
    () => filteredCandidates.find((entry) => !entry.activeSlotCandidate?.blockReason) ?? filteredCandidates[0] ?? null,
    [filteredCandidates],
  );

  // Spielerkarte im Fokus-Panel: gehoverter Kandidat > gesetzter Spieler > Top-Pick.
  const activeSelectionId = activeSlot ? selections[activeSlot.key] ?? "" : "";
  const focusPlayerId = hoveredCandidateId ?? (activeSelectionId || topPickForActiveSlot?.player.activePlayerId || null);
  const focusPlayer = focusPlayerId ? rosterCardByActivePlayerId.get(focusPlayerId) ?? null : null;
  const focusBestSlots: NlBestSlotEntry[] = focusPlayerId ? playerBestSlotSummaryByActivePlayerId.get(focusPlayerId) ?? [] : [];
  const focusLaneD1 = focusBestSlots.find((entry) => entry.disciplineSide === "d1")?.projectedScore ?? null;
  const focusLaneD2 = focusBestSlots.find((entry) => entry.disciplineSide === "d2")?.projectedScore ?? null;
  const focusLaneVerdict = getNlLaneVerdict(focusLaneD1, focusLaneD2);

  const activeCaptainSide = activeSlot?.disciplineSide ?? "d1";
  const activeCaptainEntries = captainSelectEntriesBySide[activeCaptainSide] ?? [];
  const activeCaptainInfoById = useMemo(
    () => new Map(captainInfoBySide[activeCaptainSide].map((info) => [info.activePlayerId, info] as const)),
    [activeCaptainSide, captainInfoBySide],
  );

  const totalRequired = lineupFlowSummary.totalRequired;
  const selectedCount = lineupFlowSummary.selectedCount;

  if (!context) {
    return (
      <div className="nl-lineup-root" data-testid="lineup-new-look">
        <div className="nl-lineup-loading">Spieltag-Kontext wird geladen…</div>
      </div>
    );
  }

  const disciplineBySide = {
    d1: context.matchdayContract?.discipline1 ?? null,
    d2: context.matchdayContract?.discipline2 ?? null,
  } as const;

  const renderSide = (disciplineSide: "d1" | "d2") => {
    const discipline = disciplineBySide[disciplineSide];
    const axis = getAxisForCategory(discipline?.category ?? null);
    const sideSlots = slots.filter((slot) => slot.disciplineSide === disciplineSide);
    const sideSelected = disciplineSide === "d1" ? lineupMeta.d1Selected : lineupMeta.d2Selected;
    const sideRequired = discipline?.requiredPlayers ?? 0;
    const rank = disciplineSide === "d1" ? d1Rank : d2Rank;
    const intensity = getDisciplineIntensity(disciplineSide);
    const tacticPreview = disciplineTacticPreviewBySide?.[disciplineSide] ?? null;
    const progressPct = sideRequired > 0 ? Math.min(100, Math.round((sideSelected / sideRequired) * 100)) : 0;

    return (
      <section
        key={`nl-lineup-side-${disciplineSide}`}
        className={`nl-lineup-side is-${disciplineSide}${axis ? ` is-axis-${axis}` : ""}`}
        aria-label={`${disciplineSide.toUpperCase()} ${discipline?.displayName ?? ""}`.trim()}
      >
        <header className="nl-lineup-side-head">
          <div className="nl-lineup-side-title">
            <span className="nl-lineup-side-tag">{disciplineSide.toUpperCase()}</span>
            <div>
              <strong>{discipline?.displayName ?? "—"}</strong>
              <small>
                {axis ? `${NL_AXIS_AREA_LABEL[axis]} · ` : ""}
                Rank {rank ?? "—"} · {sideSelected}/{sideRequired || "—"} Slots
              </small>
            </div>
          </div>
          <div className="nl-lineup-side-meta">
            <div className="nl-lineup-side-progress" aria-hidden="true">
              <span style={{ width: `${progressPct}%` }} />
            </div>
            <div className="nl-lineup-intensity" role="group" aria-label={`${disciplineSide.toUpperCase()} Intensity`}>
              {(["conserve", "normal", "push"] as const).map((stage) => (
                <button
                  key={`${disciplineSide}-${stage}`}
                  type="button"
                  className={intensity === stage ? "is-selected" : ""}
                  disabled={isReadOnly || isBusy}
                  onClick={() => onUpdateDisciplineIntensity(disciplineSide, stage)}
                  title={
                    tacticPreview
                      ? `${formatIntensityLabel(stage)} · projiziert ${formatNullableScore(tacticPreview[stage])}`
                      : formatIntensityLabel(stage)
                  }
                >
                  {formatIntensityLabel(stage)}
                  {tacticPreview && tacticPreview[stage] != null ? (
                    <em className="nl-tnum">{formatNullableScore(tacticPreview[stage])}</em>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="nl-lineup-slot-grid">
          {sideSlots.map((slot) => {
            const role = slotRoleByKey.get(slot.key) ?? null;
            const selectedId = selections[slot.key] ?? "";
            const player = selectedId ? rosterCardByActivePlayerId.get(selectedId) ?? null : null;
            const preview = slotPreviewByKey.get(slot.key) ?? null;
            const projected = preview?.projected.totalProjected ?? null;
            const summary = slotCandidateSummaryByKey.get(slot.key);
            const topCandidate = summary?.topCandidates[0] ?? null;
            const secondCandidate = summary?.topCandidates[1] ?? null;
            const openLead =
              topCandidate?.projectedScore != null
                ? Number((topCandidate.projectedScore - (secondCandidate?.projectedScore ?? topCandidate.projectedScore)).toFixed(1))
                : null;
            const openLeadTier = openLead != null ? getNlLineupLeadTier(openLead) : null;
            const readiness = player ? getNlSlotReadiness(projected, topCandidate?.projectedScore ?? null) : null;
            const issue = (slotIssuesByKey.get(slot.key) ?? [])[0] ?? null;
            const isActive = activeSlotKey === slot.key;
            const isNextTarget = !player && nextOpenSlotKey === slot.key;
            const isJustAssigned = recentlyAssignedSlotKey === slot.key;
            const isCaptain = Boolean(selectedId) && captains[slot.disciplineSide] === selectedId;
            const fatigue = selectedId ? getSelectedOptionMeta(selectedId)?.fatigueCount ?? null : null;

            return (
              <article
                key={`nl-lineup-slot-${slot.key}`}
                id={`lineup-slot-${slot.key}`}
                className={`nl-lineup-slot${player ? " is-filled" : " is-open"}${isActive ? " is-active" : ""}${isNextTarget ? " is-next" : ""}${isJustAssigned ? " is-just-assigned" : ""}`}
              >
                <button type="button" className="nl-lineup-slot-hit" onClick={() => onActiveSlotChange(slot.key)}>
                  <span className="nl-lineup-slot-top">
                    <span className="nl-lineup-slot-index">
                      {slot.disciplineSide.toUpperCase()}-{slot.slotIndex + 1}
                    </span>
                    <span className="nl-lineup-slot-role">{role?.label ?? "Slot"}</span>
                  </span>

                  {player ? (
                    <span className="nl-lineup-slot-player">
                      <strong>
                        {player.name}
                        {isCaptain ? <span className="nl-lineup-captain-badge">C</span> : null}
                      </strong>
                      <span className="nl-lineup-slot-score">
                        <em className="nl-tnum">{formatNullableScore(projected)}</em>
                        <small>
                          Basis {formatNullableScore(preview?.selectedScore ?? null)}
                          {fatigue != null ? ` · F ${Math.round(fatigue)}` : ""}
                        </small>
                      </span>
                    </span>
                  ) : (
                    <span className="nl-lineup-slot-player is-empty-label">
                      <strong>Offen</strong>
                      <small>{isNextTarget ? "Nächster Fokus" : "Slot wählen"}</small>
                    </span>
                  )}

                  <span className="nl-lineup-slot-foot">
                    {player && readiness ? (
                      <span className={`nl-lineup-chip is-${readiness.tone}`}>{readiness.label}</span>
                    ) : openLeadTier ? (
                      <span
                        className={`nl-lineup-chip is-${openLeadTier.tone}`}
                        title={`Vorsprung des Top-Kandidaten zu #2: ${formatSignedScore(openLead)}`}
                      >
                        {openLeadTier.label}
                      </span>
                    ) : null}
                    {issue ? (
                      <span className="nl-lineup-chip is-risk" title={issue.detail}>
                        {issue.label}
                      </span>
                    ) : null}
                  </span>
                </button>

                {!player && topCandidate ? (
                  <button
                    type="button"
                    className="nl-lineup-bestfit"
                    disabled={isReadOnly || isBusy}
                    title={topCandidate.fitDetail}
                    onClick={() => onAssignPlayer(slot.key, topCandidate.activePlayerId)}
                  >
                    <small>Best Fit</small>
                    <strong>{topCandidate.name}</strong>
                    <em className="nl-tnum">{formatNullableScore(topCandidate.projectedScore)}</em>
                  </button>
                ) : null}

                {player && !isReadOnly ? (
                  <button
                    type="button"
                    className="nl-lineup-slot-clear"
                    aria-label={`${player.name} aus Slot entfernen`}
                    title="Spieler entfernen"
                    onClick={() => onClearSlot(slot.key)}
                  >
                    ×
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="nl-lineup-root" data-testid="lineup-new-look">
      {/* --- HUD: Completeness-Ring · Teamstärke · Aktionen ------------- */}
      <header className="nl-lineup-hud">
        <div className="nl-lineup-hud-status">
          <NlCompletenessRing selected={selectedCount} total={totalRequired} ready={lineupReadyToSave} />
          <div className="nl-lineup-hud-copy">
            <span className="nl-lineup-eyebrow">Einsatzliste</span>
            <strong>
              {context.team?.name ?? "Team"} · Spieltag {context.matchday?.index ?? "—"}
            </strong>
            <span className={`nl-lineup-nextstep is-${matchdayPreviewCards.openSlots > 0 ? "warn" : "good"}`} title={lineupFlowSummary.nextStep.detail}>
              {lineupFlowSummary.nextStep.label}
            </span>
          </div>
        </div>

        <div className="nl-lineup-hud-strength" key={`strength-${assignPulse ?? 0}`} data-testid="nl-lineup-team-strength">
          <div className="nl-lineup-hud-metric is-primary">
            <small>Erwartete Punkte</small>
            <strong className="nl-tnum">
              {formatProjectedMetricWindow(matchdayPreviewCards.totalRangeLow, matchdayPreviewCards.totalRangeHigh)}
            </strong>
          </div>
          {(["d1", "d2"] as const).map((side) => {
            const tactic = disciplineTacticPreviewBySide?.[side] ?? null;
            const current = tactic ? tactic[getDisciplineIntensity(side)] : null;
            return (
              <div key={`hud-side-${side}`} className={`nl-lineup-hud-metric is-${side}`}>
                <small>{side.toUpperCase()}</small>
                <strong className="nl-tnum">{formatNullableScore(current)}</strong>
              </div>
            );
          })}
          <div className={`nl-lineup-hud-metric is-risk-${matchdayPreviewCards.riskLevel}`}>
            <small>Risiko</small>
            <strong>{matchdayPreviewCards.riskLevel}</strong>
          </div>
          {teamAxisAverage ? (
            <div className="nl-lineup-hud-radar" title={`Ø Achsen der ${teamAxisAverage.count} gesetzten Spieler`}>
              <NlRadar axes={teamAxisAverage.axes} aria-label={`Team-Radar: Ø Achsen der ${teamAxisAverage.count} gesetzten Spieler`} />
            </div>
          ) : null}
        </div>

        <div className="nl-lineup-hud-actions">
          {undoInfo ? (
            <button type="button" className="nl-lineup-btn is-ghost" title={undoInfo.detail} onClick={onUndo} disabled={isBusy}>
              ↺ Rückgängig
            </button>
          ) : null}
          <button
            type="button"
            className="nl-lineup-btn is-ghost"
            onClick={onFocusNextOpenSlot}
            disabled={isBusy || matchdayPreviewCards.openSlots === 0}
          >
            Nächster Slot
          </button>
          <button
            type="button"
            className="nl-lineup-btn is-ghost"
            onClick={onAutoFillOpenSlots}
            disabled={isBusy || isReadOnly || matchdayPreviewCards.openSlots === 0}
          >
            Automatisch füllen
          </button>
          <div className="nl-lineup-save-wrap">
            <button
              type="button"
              className={`nl-lineup-btn is-primary${lineupReadyToSave ? " is-ready" : ""}`}
              data-testid="nl-lineup-save"
              disabled={isBusy || isReadOnly}
              title={lineupSaveCta.detail}
              aria-expanded={!lineupReadyToSave ? saveHelpOpen : undefined}
              onClick={() => {
                if (!lineupReadyToSave) {
                  setSaveHelpOpen((current) => !current);
                  return;
                }
                setSaveHelpOpen(false);
                onSaveDraft();
              }}
            >
              {lineupSaveCta.buttonLabel}
            </button>
            {!lineupReadyToSave && saveHelpOpen ? (
              <div className="nl-lineup-save-help" role="dialog" aria-label="Offene Punkte vor dem Speichern">
                <strong>{lineupSaveCta.label}</strong>
                <ul>
                  {lineupFinishItems.map((item) => (
                    <li key={item.key} className={`is-${item.tone}`}>
                      <span>{item.label}</span>
                      <small>{item.detail}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {onNavigateArena ? (
            <button
              type="button"
              className={`nl-lineup-btn is-arena${arenaReady ? " is-ready" : ""}`}
              disabled={!arenaReady || isBusy || isReadOnly}
              title={arenaReady ? "Einsatzliste gespeichert — zur Arena" : "Erst speichern und Blocker lösen, dann Arena"}
              onClick={() => arenaReady && onNavigateArena()}
            >
              Zur Arena →
            </button>
          ) : null}
        </div>
      </header>

      {controlsSlot ? <div className="nl-lineup-controls">{controlsSlot}</div> : null}

      {errors.length > 0 ? (
        <div className="nl-lineup-status is-error" role="alert">
          {errors.join(" · ")}
        </div>
      ) : statusMessage ? (
        <div className="nl-lineup-status" role="status">
          {statusMessage}
        </div>
      ) : null}

      <div className="nl-lineup-layout">
        {/* --- Slot-Board: Formation nach D1/D2 (Bereichs-getönt) ------- */}
        <div className="nl-lineup-board" aria-label="Slot-Board">
          {renderSide("d1")}
          {renderSide("d2")}
        </div>

        {/* --- Rail: Fokus-Spielerkarte + Kader ------------------------- */}
        <aside className="nl-lineup-rail" aria-label="Aktiver Slot und Kader">
          <section className="nl-lineup-focus">
            <header className="nl-lineup-focus-head">
              <div>
                <span className="nl-lineup-eyebrow">
                  {activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : "Fokus"}
                </span>
                <strong>{activeSlot ? slotRoleByKey.get(activeSlot.key)?.label ?? "Slot" : "Slot wählen"}</strong>
              </div>
              {activeSlot && !activeSelectionId && topPickForActiveSlot?.player.activePlayerId && !isReadOnly ? (
                <button
                  type="button"
                  className="nl-lineup-btn is-primary"
                  onClick={() => onAssignPlayer(activeSlot.key, topPickForActiveSlot.player.activePlayerId as string)}
                >
                  Top-Pick setzen
                </button>
              ) : null}
              {activeSlot && activeSelectionId && !isReadOnly ? (
                <button type="button" className="nl-lineup-btn is-ghost" onClick={() => onClearSlot(activeSlot.key)}>
                  Leeren
                </button>
              ) : null}
            </header>

            {focusPlayer ? (
              <div className="nl-lineup-focus-player">
                <div className="nl-lineup-focus-radar">
                  {focusPlayer.coreStats ? (
                    <NlRadar
                      axes={(["pow", "spe", "men", "soc"] as const).map((key) => ({
                        key,
                        value: focusPlayer.coreStats?.[key] ?? 0,
                      }))}
                      showValues
                      aria-label={`Achsen-Radar für ${focusPlayer.name}`}
                    />
                  ) : (
                    <p className="nl-lineup-focus-noradar">Keine Achsen-Daten.</p>
                  )}
                </div>
                <div className="nl-lineup-focus-meta">
                  <strong>{focusPlayer.name}</strong>
                  <small>
                    {focusPlayer.className ?? "—"}
                    {focusPlayer.playerOvr != null ? ` · OVR ${formatScore(focusPlayer.playerOvr)}` : ""}
                  </small>
                  {focusLaneVerdict ? (
                    <span className="nl-lineup-chip is-neutral" title={focusLaneVerdict.detail}>
                      {focusLaneVerdict.label}
                    </span>
                  ) : null}
                  <NlLaneMeter bestD1={focusLaneD1} bestD2={focusLaneD2} />
                  {focusBestSlots[0] ? (
                    <small className="nl-lineup-focus-bestslot">
                      Bester Slot: {focusBestSlots[0].disciplineSide.toUpperCase()}-{focusBestSlots[0].slotIndex + 1} ·{" "}
                      {formatNullableScore(focusBestSlots[0].projectedScore)}
                    </small>
                  ) : null}
                  <button
                    type="button"
                    className="nl-lineup-btn is-ghost is-small"
                    onClick={() => onOpenPlayer(focusPlayer.id, focusPlayer.activePlayerId)}
                  >
                    Profil
                  </button>
                </div>
              </div>
            ) : (
              <p className="nl-lineup-focus-noradar">Kandidat wählen oder Slot fokussieren.</p>
            )}

            <div className="nl-lineup-captain">
              <label>
                <span>
                  Captain {activeCaptainSide.toUpperCase()} · {captainSeasonUsedWithDraft}/{captainSeasonLimit} Saison ·{" "}
                  {captainDraftRemaining} frei heute
                </span>
                <select
                  className="nl-lineup-captain-select"
                  value={captains[activeCaptainSide] ?? ""}
                  disabled={isReadOnly || isBusy}
                  onChange={(event) => onUpdateCaptain(activeCaptainSide, event.target.value)}
                >
                  <option value="">Kein Captain</option>
                  {activeCaptainEntries.map((entry) => {
                    const info = activeCaptainInfoById.get(entry.activePlayerId);
                    return (
                      <option key={entry.activePlayerId} value={entry.activePlayerId}>
                        {entry.name}
                        {info?.estimatedCaptainBonus != null ? ` (+${formatScore(info.estimatedCaptainBonus)})` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
          </section>

          <section className="nl-lineup-candidates" aria-label="Kader">
            <header className="nl-lineup-candidates-head">
              <div className="nl-lineup-candidate-tabs" role="tablist">
                {(
                  [
                    { key: "all", label: "Alle" },
                    { key: "instant", label: "Sofort" },
                    { key: "alternative", label: "Alternative" },
                    { key: "blocked", label: "Blockiert" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={candidateTab === tab.key}
                    className={candidateTab === tab.key ? "is-active" : ""}
                    onClick={() => onCandidateTabChange(tab.key)}
                  >
                    {tab.label} <em className="nl-tnum">{candidateTabCounts[tab.key]}</em>
                  </button>
                ))}
              </div>
              <input
                className="nl-lineup-candidate-search"
                type="search"
                value={playerFilter}
                onChange={(event) => onPlayerFilterChange(event.target.value)}
                placeholder="Spieler suchen"
                aria-label="Kandidaten suchen"
              />
            </header>

            <div className="nl-lineup-candidate-list" onMouseLeave={() => setHoveredCandidateId(null)}>
              {filteredCandidates.length === 0 ? (
                <p className="nl-lineup-candidate-empty">Keine Kandidaten in dieser Gruppe.</p>
              ) : (
                filteredCandidates.map((entry: NlCandidateEntry, index: number) => {
                  const candidate = entry.player;
                  const candidateId = candidate.activePlayerId;
                  const projectedScore = entry.activeSlotCandidate?.projectedScore ?? null;
                  const scoreDelta = entry.activeSlotCandidate?.scoreDelta ?? null;
                  const isBlocked = Boolean(entry.activeSlotCandidate?.blockReason);
                  const isAssignedHere = Boolean(candidateId) && activeSelectionId === candidateId;
                  const bestSlots: NlBestSlotEntry[] = candidateId ? playerBestSlotSummaryByActivePlayerId.get(candidateId) ?? [] : [];
                  const bestSlot = bestSlots[0] ?? null;
                  const laneD1 = bestSlots.find((slotEntry) => slotEntry.disciplineSide === "d1")?.projectedScore ?? null;
                  const laneD2 = bestSlots.find((slotEntry) => slotEntry.disciplineSide === "d2")?.projectedScore ?? null;

                  return (
                    <button
                      key={`nl-candidate-${candidate.id}-${entry.groupKey}`}
                      type="button"
                      className={`nl-lineup-candidate${isAssignedHere ? " is-assigned" : ""}${isBlocked ? " is-blocked" : ""}`}
                      disabled={isReadOnly || isBlocked || !candidateId || !activeSlot}
                      title={isBlocked ? entry.detail : activeSlot ? `In ${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1} einsetzen` : entry.detail}
                      onMouseEnter={() => setHoveredCandidateId(candidateId ?? null)}
                      onFocus={() => setHoveredCandidateId(candidateId ?? null)}
                      onClick={() => candidateId && activeSlot && onAssignPlayer(activeSlot.key, candidateId)}
                    >
                      {index < 4 ? (
                        <span className="nl-lineup-candidate-rank nl-tnum" aria-hidden="true">
                          {index + 1}
                        </span>
                      ) : null}
                      <span className="nl-lineup-candidate-main">
                        <strong>{candidate.name}</strong>
                        <small>
                          {entry.groupMeta.label}
                          {entry.shortReason ? ` · ${entry.shortReason}` : ""}
                        </small>
                        {bestSlot ? (
                          <small className="nl-lineup-candidate-bestslot">
                            Bester Slot {bestSlot.disciplineSide.toUpperCase()}-{bestSlot.slotIndex + 1} ·{" "}
                            {formatNullableScore(bestSlot.projectedScore)}
                          </small>
                        ) : null}
                        <NlLaneMeter bestD1={laneD1} bestD2={laneD2} />
                      </span>
                      <span className="nl-lineup-candidate-score">
                        <strong className="nl-tnum">{formatNullableScore(projectedScore)}</strong>
                        {scoreDelta != null ? (
                          <em className={`nl-tnum ${scoreDelta >= 0 ? "is-up" : "is-down"}`}>{formatSignedScore(scoreDelta)}</em>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* --- Verdikt-HUD nach Zuweisung -------------------------------- */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {verdict ? `${verdict.playerName} in ${verdict.slotLabel} gesetzt — ${verdict.tierLabel}` : ""}
      </div>
      {verdict ? (
        <div key={verdict.key} className={`nl-lineup-verdict is-${verdict.tierTone}`} role="presentation" data-testid="nl-lineup-verdict">
          <span className="nl-lineup-verdict-tier">{verdict.tierLabel}</span>
          <strong>
            {verdict.playerName} → {verdict.slotLabel}
          </strong>
          <small className="nl-tnum">
            Slot-Score {formatNullableScore(verdict.projected)}
            {verdict.lead != null ? ` · ${formatSignedScore(verdict.lead)} vs. beste Alternative` : ""}
          </small>
        </div>
      ) : null}
    </div>
  );
}
