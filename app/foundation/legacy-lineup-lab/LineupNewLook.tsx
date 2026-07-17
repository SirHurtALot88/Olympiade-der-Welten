"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type ReactNode } from "react";

import type { LegacyLineupFocusV2BoardProps } from "@/app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import {
  FATIGUE_HIGH,
  NlCard,
  NlCountUpValue,
  NlDeltaChip,
  NlEmptyState,
  NlFatigueGauge,
  NlProgressBar,
  NlRadar,
  NlSkeletonCard,
  StatChip,
  fatigueTone,
  formatNlNumber,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look";
import { VeloRangeBar } from "@/components/foundation/velo-ui/VeloRangeBar";
import { filterLegacyLineupCandidateEntries } from "@/lib/lineups/legacy-lineup-candidate-tabs";
import type { LegacyLineupPreviewResult, LegacyLineupScoreResult } from "@/lib/lineups/legacy-lineup-types";
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
  /**
   * Letztes Preview-Ergebnis des Clients (derselbe Feed, den die klassische
   * Einsatzliste für ihren Scoreboard-Reveal nutzt). Treibt die Resolve-Show —
   * null/nicht-ok => Show wird gar nicht angeboten (progressive Enhancement).
   */
  resolvePreview: LegacyLineupPreviewResult | null;
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

/**
 * Inline-Style für die Captain-Auswahl-Chips (Phase 3). Bewusst inline, weil
 * globals.css hier nicht angefasst werden darf — Tokens halten es theme-treu.
 * `active` markiert die aktuelle Auswahl (Rahmen/Fläche in Akzentfarbe).
 */
function captainChipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 9px",
    borderRadius: "var(--nl-r-sm)",
    border: `1px solid ${active ? "var(--nl-accent)" : "var(--nl-line)"}`,
    background: active ? "color-mix(in srgb, var(--nl-accent) 18%, transparent)" : "var(--nl-panel-2)",
    color: active ? "var(--nl-accent)" : "var(--nl-ink)",
    font: "inherit",
    fontSize: "12px",
    lineHeight: 1.1,
    cursor: "pointer",
  };
}

/* --- Feature 1: Portrait-Avatar + Hover-Vorschau -----------------------
 * Kleiner, dichter Avatar-Chip (Initialen-Fallback) für Slot-/Kandidaten-/
 * Fokus-Zeilen. Bewusst winzig (20–28px), damit Stats/Score nicht verdrängt
 * werden und die Kandidatenliste gleich viele Zeilen zeigt wie zuvor. Der
 * Hover reicht die exakt gleiche `FoundationPlayerPortraitPreview` durch wie
 * das v2-Board (portaliertes Overlay ⇒ keine Layout-Verschiebung).
 */

type NlPortraitPlayer = {
  id: string;
  name: string;
  portraitUrl: string | null;
  className: string | null;
  playerOvr?: number | null;
  playerPps?: number | null;
  coreStats?: { pow: number; spe: number; men: number; soc: number } | null;
};

/** Runder Mini-Avatar: Portrait falls vorhanden, sonst Initialen (Fallback bleibt bei Bildfehler sichtbar). */
function NlPlayerAvatar({
  portraitUrl,
  name,
  size = 22,
}: {
  portraitUrl?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const showImg = Boolean(portraitUrl) && !failed;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        flex: "0 0 auto",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--nl-panel-2)",
        border: "1px solid var(--nl-line)",
        color: "var(--nl-mut)",
        fontSize: `${Math.round(size * 0.42)}px`,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {initials}
      {showImg ? (
        // Initialen bleiben als Unterlage — schlägt das Bild fehl, blenden wir es aus.
        <img
          src={portraitUrl as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
    </span>
  );
}

/**
 * Umhüllt einen Knoten mit der Portrait-Hover-Vorschau (identische Props wie
 * `wrapLineupV2PortraitPreview` im v2-Board). Ohne coreStats gibt es keine
 * Vorschau ⇒ Knoten wird unverändert zurückgegeben (progressive Enhancement).
 */
function wrapNlPortraitPreview(node: ReactNode, player: NlPortraitPlayer, disabled = false): ReactNode {
  if (!player.coreStats) return node;
  return (
    <FoundationPlayerPortraitPreview
      playerId={player.id}
      name={player.name}
      portraitUrl={player.portraitUrl}
      portraitInitials={player.name.slice(0, 2).toUpperCase()}
      playerOvr={player.playerOvr ?? null}
      playerMvs={null}
      playerPps={player.playerPps}
      pow={player.coreStats.pow}
      spe={player.coreStats.spe}
      men={player.coreStats.men}
      soc={player.coreStats.soc}
      leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
      variant="team"
      context="lineupCandidate"
      previewDensity="compact"
      playerClassName={player.className}
      disabled={disabled}
    >
      {node}
    </FoundationPlayerPortraitPreview>
  );
}

/* --- Feature 2: „Score to beat" — Rivalitäts-Stärke (spoiler-sicher) ----
 * relationship < 0 = Rivalität; je negativer, desto schärfer. Nur ein Wort
 * fürs Tooltip — keine Zahl, kein projiziertes Ergebnis.
 */
function rivalStrengthLabel(relationship: number): string {
  if (relationship <= -4) return "Erzrivale";
  if (relationship <= -3) return "starker Rivale";
  return "Rivale";
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

/** Risiko-Wort → semantischer Ton für den Kit-Chip: hoch=risk, mittel=warn, niedrig=good. */
function getNlRiskTone(riskLevel: string): NlTone {
  if (riskLevel === "hoch") return "risk";
  if (riskLevel === "mittel") return "warn";
  return "good";
}

function getAxisForCategory(category: string | null | undefined): NlAxisKey | null {
  if (category === "power") return "pow";
  if (category === "speed") return "spe";
  if (category === "mental") return "men";
  if (category === "social") return "soc";
  return null;
}

const NL_AXIS_AREA_LABEL: Record<NlAxisKey, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };

/** Reason-Chip-Achse (pow/spe/men/soc) → Kit-Ton; unbekannt ⇒ neutral. */
function reasonChipTone(axis: string): NlTone {
  if (axis === "pow" || axis === "spe" || axis === "men" || axis === "soc") return axis;
  return "neutral";
}

/* --- Kleinteile ------------------------------------------------------- */

/**
 * Ring-Zähler (#Ring-Label-Klarheit): EINE eindeutige Bruchzahl
 * "besetzte Slots / benötigte Slots" plus ein Status-Wort — keine dritte,
 * konkurrierende Zahl mehr.
 *
 * Zuvor standen drei Werte nebeneinander ("selected / verfügbare Slots · min. N"),
 * die auseinanderlaufen konnten und Widersprüche wie "10 / 9 · min. 10" ergaben
 * (mehr besetzt als Slot-Karten am Board; Minimum größer als der Nenner).
 * Ursache: `total` (gerenderte Slot-Karten = `disciplinePlayerCounts`) und
 * `minRequired` (Pflicht-Minimum aus dem Contract = Summe `requiredPlayers`)
 * stammen aus verschiedenen Pfaden und sind im Normalfall identisch, können
 * aber desyncen. Wir bilden daher EIN Ziel aus dem Maximum aller drei Größen,
 * sodass der Zähler nie den Nenner und das Minimum nie den Nenner übersteigt.
 */
function NlCompletenessRing({
  selected,
  total,
  ready,
  minRequired,
}: {
  selected: number;
  total: number;
  ready: boolean;
  minRequired?: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  // Benötigte Slots = so viele muss die Aufstellung füllen, um komplett zu sein.
  const target = Math.max(total, minRequired ?? 0, selected);
  const filled = Math.min(selected, target);
  const open = Math.max(0, target - filled);
  const pct = target > 0 ? Math.min(1, filled / target) : 0;
  const subLabel = ready ? "bereit" : open > 0 ? `${open} offen` : "belegt";
  const readyDetail = ready
    ? ", bereit zum Speichern"
    : open > 0
      ? `, noch ${open} offen`
      : "";
  return (
    <div
      className={`nl-lineup-ring${ready ? " is-ready" : pct >= 1 ? " is-full" : ""}`}
      role="img"
      aria-label={`Aufstellung ${filled} von ${target || "—"} Slots besetzt${readyDetail}`}
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
          {filled}/{target || "—"}
        </strong>
        <small>{subLabel}</small>
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
  const laneSummary = rows
    .map((row) => `${row.label} ${row.value != null && Number.isFinite(row.value) ? formatScore(row.value as number) : "—"}`)
    .join(", ");
  return (
    <span className="nl-lineup-lane-meter" role="img" aria-label={`Lane-Stärke ${laneSummary}`}>
      {rows.map((row) => {
        const hasValue = row.value != null && Number.isFinite(row.value);
        const pct = hasValue ? Math.max(6, Math.min(100, ((row.value as number) / maxValue) * 100)) : 0;
        return (
          <span key={row.label} className="nl-lineup-lane-row" aria-hidden="true">
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

/* --- Resolve-Show: Slot-für-Slot-Auflösung (Projektion) ----------------- */
/*
 * Baut auf dem bestehenden Reveal-System der Einsatzliste auf: dieselben
 * Preview-Daten (LegacyLineupPreviewResult), die der klassische Scoreboard-
 * Reveal (Form-/Mutator-Toggles) konsumiert — hier nur dramaturgisch als
 * Show inszeniert. Es wird KEIN Wert erfunden: Slots = baseDisciplineScore
 * je Entry, Fatigue = fatigueModifier je Seite (fatigueAdjusted − Base),
 * Formkarten = formCardLabel/formModifier je Seite, Endstand = totalScore.
 */

type NlShowSlot = {
  key: string;
  side: "d1" | "d2";
  slotIndex: number;
  name: string;
  base: number | null;
  /** Fatigue-Abzug dieses Slots (fatigueAdjustedScore − baseScore, i. d. R. ≤ 0). */
  fatigueDelta: number | null;
  fatigueCount: number | null;
  isCaptain: boolean;
};

type NlShowFormCard = {
  side: "d1" | "d2";
  ready: boolean;
  label: string | null;
  value: number | null;
};

type NlShowBonusItem = { id: string; label: string; value: number };

type NlShowData = {
  slots: NlShowSlot[];
  slotTotal: number;
  fatigueKnown: boolean;
  fatigueTotal: number;
  afterFatigueTotal: number;
  formCards: NlShowFormCard[];
  formTotal: number;
  afterFormTotal: number;
  bonusItems: NlShowBonusItem[];
  finalTotal: number;
  /** Ändert sich die Aufstellung/Preview, stoppt eine laufende Show sauber. */
  signature: string;
};

function roundShowScore(value: number) {
  return Math.round(value * 10) / 10;
}

const NL_SHOW_BONUS_DEFS: Array<{ id: string; label: string; pick: (side: LegacyLineupScoreResult) => number | null | undefined }> = [
  { id: "morale", label: "Moral", pick: (side) => side.moraleModifier },
  { id: "intensity", label: "Intensität", pick: (side) => side.intensityModifier },
  { id: "slotRole", label: "Slot-Rollen", pick: (side) => side.slotRoleModifier },
  { id: "mutator", label: "Mutatoren", pick: (side) => side.mutatorModifier },
  { id: "captain", label: "Captain", pick: (side) => side.captainBonusTotal },
  { id: "power", label: "Team-Power", pick: (side) => side.teamPowerModifier },
];

function buildNlResolveShowData(preview: LegacyLineupPreviewResult | null): NlShowData | null {
  if (!preview || !preview.ok) return null;

  const sideResults = (["d1", "d2"] as const)
    .map((side) => preview.disciplineSideScores.find((entry) => entry.disciplineSide === side) ?? null)
    .filter((entry): entry is LegacyLineupScoreResult => entry != null);
  if (sideResults.length === 0) return null;

  const slots: NlShowSlot[] = sideResults.flatMap((sideResult) =>
    [...sideResult.entries]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((entry) => ({
        key: `${entry.disciplineSide}-${entry.slotIndex}`,
        side: entry.disciplineSide,
        slotIndex: entry.slotIndex,
        name: entry.name ?? entry.playerId,
        base: entry.baseDisciplineScore ?? null,
        fatigueDelta:
          entry.baseDisciplineScore != null && entry.fatigueAdjustedScore != null
            ? roundShowScore(entry.fatigueAdjustedScore - entry.baseDisciplineScore)
            : null,
        fatigueCount: entry.fatigueCount ?? null,
        isCaptain: Boolean(entry.isCaptain),
      })),
  );
  if (slots.length === 0) return null;

  const slotTotal = roundShowScore(slots.reduce((sum, slot) => sum + (slot.base ?? 0), 0));
  const fatigueKnown = sideResults.some((side) => side.fatigueStatus === "mapped" && side.fatigueModifier != null);
  const fatigueTotal = roundShowScore(
    sideResults.reduce((sum, side) => sum + (side.fatigueStatus === "mapped" ? side.fatigueModifier ?? 0 : 0), 0),
  );
  const afterFatigueTotal = roundShowScore(slotTotal + fatigueTotal);

  const formCards: NlShowFormCard[] = sideResults.map((side) => ({
    side: side.disciplineSide ?? "d1",
    ready: side.formCardStatus === "ready",
    label: side.formCardLabel ?? null,
    value: side.formCardStatus === "ready" ? side.formModifier ?? 0 : null,
  }));
  const formTotal = roundShowScore(formCards.reduce((sum, card) => sum + (card.value ?? 0), 0));
  const afterFormTotal = roundShowScore(afterFatigueTotal + formTotal);

  const bonusItems: NlShowBonusItem[] = NL_SHOW_BONUS_DEFS.map((def) => {
    const values = sideResults.map((side) => def.pick(side)).filter((value): value is number => value != null && Number.isFinite(value));
    return values.length > 0 ? { id: def.id, label: def.label, value: roundShowScore(values.reduce((sum, value) => sum + value, 0)) } : null;
  }).filter((item): item is NlShowBonusItem => item != null && Math.abs(item.value) >= 0.05);

  const finalTotal = roundShowScore(sideResults.reduce((sum, side) => sum + (side.totalScore ?? 0), 0));

  return {
    slots,
    slotTotal,
    fatigueKnown,
    fatigueTotal,
    afterFatigueTotal,
    formCards,
    formTotal,
    afterFormTotal,
    bonusItems,
    finalTotal,
    signature: `${slots.map((slot) => `${slot.key}:${slot.base ?? "-"}`).join("|")}::${fatigueTotal}::${formTotal}::${finalTotal}`,
  };
}

function NlLineupResolveShow({
  data,
  sideLabels,
  arenaReady,
  onNavigateArena,
}: {
  data: NlShowData;
  sideLabels: Record<"d1" | "d2", string>;
  arenaReady: boolean;
  onNavigateArena?: () => void;
}) {
  const slotCount = data.slots.length;
  const fatigueStep = slotCount + 1;
  const formStep = slotCount + 2;
  const bonusStep = slotCount + 3;
  const maxStep = slotCount + 4;

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const signatureRef = useRef(data.signature);

  // prefers-reduced-motion beobachten: Show springt dann sofort zum Endstand.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Aufstellung/Preview geändert: laufende Dramaturgie ist veraltet — Show
  // stoppen und (falls schon gestartet) direkt den neuen Endstand zeigen.
  useEffect(() => {
    if (signatureRef.current === data.signature) return;
    signatureRef.current = data.signature;
    setIsPlaying(false);
    setStep((current) => (current > 0 ? maxStep : 0));
  }, [data.signature, maxStep]);

  // Timer der Show: Slots im schnellen Takt, Phasen (Fatigue/Form/Boni/Finale)
  // mit mehr Luft. Reines UI-Timing, blockiert nie Interaktion.
  useEffect(() => {
    if (!isPlaying) return;
    if (step >= maxStep) {
      setIsPlaying(false);
      return;
    }
    const delay = step < slotCount ? 850 : 1500;
    const timer = window.setTimeout(() => setStep((current) => Math.min(maxStep, current + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [isPlaying, step, maxStep, slotCount]);

  const clampedStep = Math.min(step, maxStep);
  const revealedCount = Math.min(clampedStep, slotCount);
  const isDone = clampedStep >= maxStep;

  function startShow() {
    setIsOpen(true);
    if (reduceMotion) {
      setIsPlaying(false);
      setStep(maxStep);
      return;
    }
    setStep(0);
    setIsPlaying(true);
  }

  function skipToEnd() {
    setIsOpen(true);
    setIsPlaying(false);
    setStep(maxStep);
  }

  const runningScore = useMemo(() => {
    if (clampedStep >= bonusStep) return data.finalTotal;
    if (clampedStep >= formStep) return data.afterFormTotal;
    if (clampedStep >= fatigueStep) return data.afterFatigueTotal;
    return roundShowScore(data.slots.slice(0, revealedCount).reduce((sum, slot) => sum + (slot.base ?? 0), 0));
  }, [clampedStep, bonusStep, formStep, fatigueStep, revealedCount, data]);

  const latestDelta = useMemo(() => {
    if (clampedStep <= 0) return null;
    if (clampedStep <= slotCount) return data.slots[clampedStep - 1]?.base ?? null;
    if (clampedStep === fatigueStep) return data.fatigueKnown ? data.fatigueTotal : null;
    if (clampedStep === formStep) return data.formCards.some((card) => card.ready) ? data.formTotal : null;
    return roundShowScore(data.finalTotal - data.afterFormTotal);
  }, [clampedStep, slotCount, fatigueStep, formStep, data]);

  const announcement = useMemo(() => {
    if (!isOpen || clampedStep <= 0) return "";
    const score = formatNlNumber(runningScore, 1);
    if (clampedStep <= slotCount) {
      const slot = data.slots[clampedStep - 1];
      return slot ? `${slot.side.toUpperCase()}-${slot.slotIndex + 1} ${slot.name}: ${formatNlNumber(slot.base, 1)} Punkte — Zwischenstand ${score}` : "";
    }
    if (clampedStep === fatigueStep) {
      return data.fatigueKnown ? `Fatigue zieht ${formatNlNumber(Math.abs(data.fatigueTotal), 1)} Punkte ab — Zwischenstand ${score}` : `Fatigue-Quelle fehlt — Zwischenstand ${score}`;
    }
    if (clampedStep === formStep) {
      return data.formCards.some((card) => card.ready)
        ? `Formkarten bringen ${formatNlNumber(data.formTotal, 1)} — Zwischenstand ${score}`
        : `Formkarten noch verdeckt — Zwischenstand ${score}`;
    }
    if (clampedStep === bonusStep) return `Boni eingerechnet — Zwischenstand ${score}`;
    return `Endstand der Projektion: ${score} Punkte`;
  }, [isOpen, clampedStep, slotCount, fatigueStep, formStep, bonusStep, runningScore, data]);

  const phasePips: Array<{ id: string; label: string; targetStep: number; reached: boolean }> = [
    { id: "slots", label: "Slots", targetStep: slotCount, reached: clampedStep >= 1 },
    { id: "fatigue", label: "Fatigue", targetStep: fatigueStep, reached: clampedStep >= fatigueStep },
    { id: "form", label: "Formkarten", targetStep: formStep, reached: clampedStep >= formStep },
    { id: "bonus", label: "Boni", targetStep: bonusStep, reached: clampedStep >= bonusStep },
    { id: "final", label: "Endstand", targetStep: maxStep, reached: isDone },
  ];
  const currentPipId = (phasePips.find((pip) => clampedStep <= pip.targetStep) ?? phasePips[phasePips.length - 1]).id;

  const renderShowSide = (side: "d1" | "d2") => {
    const sideSlots = data.slots
      .map((slot, index) => ({ slot, index }))
      .filter((entry) => entry.slot.side === side);
    if (sideSlots.length === 0) return null;
    return (
      <div key={`nl-show-side-${side}`} className={`nl-lineup-show-side is-${side}`}>
        <span className="nl-lineup-show-side-label">
          {side.toUpperCase()} · {sideLabels[side]}
        </span>
        <ol className="nl-lineup-show-slots">
          {sideSlots.map(({ slot, index }) => {
            const revealed = index < revealedCount;
            const isLatest = revealed && index === revealedCount - 1 && clampedStep <= slotCount;
            return (
              <li
                key={slot.key}
                className={`nl-lineup-show-slot${revealed ? " is-revealed" : " is-hidden"}${isLatest ? " is-latest" : ""}${clampedStep >= fatigueStep ? " is-fatigued" : ""}`}
              >
                <span className="nl-lineup-show-slot-tag nl-tnum">
                  {side.toUpperCase()}-{slot.slotIndex + 1}
                  {slot.isCaptain ? <em className="nl-lineup-show-slot-captain">C</em> : null}
                </span>
                {revealed ? (
                  <>
                    <strong className="nl-lineup-show-slot-name">{slot.name}</strong>
                    <span className="nl-lineup-show-slot-score nl-tnum">{formatNlNumber(slot.base, 1)}</span>
                    {clampedStep >= fatigueStep && slot.fatigueDelta != null && slot.fatigueDelta !== 0 ? (
                      <NlDeltaChip
                        value={slot.fatigueDelta}
                        format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`}
                        title={`Fatigue-Abzug${slot.fatigueCount != null ? ` (Belastung ${Math.round(slot.fatigueCount)})` : ""}`}
                        className="nl-lineup-show-slot-fatigue"
                      />
                    ) : null}
                  </>
                ) : (
                  <span className="nl-lineup-show-slot-veil" aria-hidden="true">
                    ?
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  return (
    <section className="nl-lineup-show" aria-label="Resolve-Show" data-testid="nl-lineup-resolve-show">
      <header className="nl-lineup-show-head">
        <div className="nl-lineup-show-title">
          <span className="nl-lineup-eyebrow">Resolve-Show · Projektion deiner Einsatzliste</span>
          <strong>So löst dein Spieltag auf — Slot für Slot</strong>
        </div>
        <div className="nl-lineup-show-controls">
          {!isOpen ? (
            <>
              <button type="button" className="nl-lineup-btn is-primary" onClick={startShow}>
                ▶ Show abspielen
              </button>
              <button type="button" className="nl-lineup-btn is-ghost" onClick={skipToEnd}>
                Endstand zeigen
              </button>
            </>
          ) : (
            <>
              {isDone ? (
                <button type="button" className="nl-lineup-btn is-primary" onClick={startShow} title="Show von vorn abspielen">
                  ↺ Replay
                </button>
              ) : (
                <button
                  type="button"
                  className="nl-lineup-btn is-primary"
                  aria-pressed={isPlaying}
                  onClick={() => setIsPlaying((current) => !current)}
                >
                  {isPlaying ? "❚❚ Pause" : "▶ Play"}
                </button>
              )}
              {!isDone ? (
                <button type="button" className="nl-lineup-btn is-ghost" onClick={skipToEnd} title="Direkt zum Endstand springen">
                  Überspringen ⏭
                </button>
              ) : null}
              <button
                type="button"
                className="nl-lineup-btn is-ghost"
                onClick={() => {
                  setIsPlaying(false);
                  setIsOpen(false);
                }}
              >
                Schließen
              </button>
            </>
          )}
        </div>
      </header>

      {isOpen ? (
        <div className="nl-lineup-show-body">
          <div className="nl-lineup-show-scorebar">
            <ol className="nl-lineup-show-phases" aria-label="Phasen der Auflösung">
              {phasePips.map((pip) => (
                <li key={pip.id}>
                  <button
                    type="button"
                    className={`nl-lineup-show-phase${pip.reached ? " is-reached" : ""}${pip.id === currentPipId ? " is-current" : ""}`}
                    onClick={() => {
                      setIsPlaying(false);
                      setStep(pip.targetStep);
                    }}
                    title={`Zur Phase „${pip.label}" springen`}
                  >
                    {pip.label}
                  </button>
                </li>
              ))}
            </ol>
            <div className="nl-lineup-show-score">
              <small>{isDone ? "Projizierter Endstand" : "Zwischenstand"}</small>
              <strong key={`nl-show-score-${clampedStep}`} className="nl-tnum">
                {formatNlNumber(runningScore, 1)}
              </strong>
              {latestDelta != null && latestDelta !== 0 ? (
                <NlDeltaChip value={latestDelta} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`} title="Letzter Effekt auf den Team-Score" />
              ) : null}
            </div>
          </div>

          <div className="nl-lineup-show-sides">
            {renderShowSide("d1")}
            {renderShowSide("d2")}
          </div>

          {clampedStep >= fatigueStep ? (
            <div key={`nl-show-fatigue-${data.signature}`} className="nl-lineup-show-phasecard is-fatigue" role="group" aria-label="Fatigue">
              <span className="nl-lineup-show-phasecard-label">Fatigue</span>
              {data.fatigueKnown ? (
                <>
                  <strong>Belastung zieht {formatNlNumber(Math.abs(data.fatigueTotal), 1)} Punkte vom Team ab</strong>
                  <NlDeltaChip value={data.fatigueTotal} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`} title="Summe der Fatigue-Abzüge über beide Disziplinen" />
                </>
              ) : (
                <strong>Fatigue-Quelle fehlt — kein Abzug bekannt</strong>
              )}
            </div>
          ) : null}

          {clampedStep >= formStep ? (
            <div key={`nl-show-form-${data.signature}`} className="nl-lineup-show-phasecard is-form" role="group" aria-label="Formkarten">
              <span className="nl-lineup-show-phasecard-label">Formkarten</span>
              <ul className="nl-lineup-show-formcards">
                {data.formCards.map((card, index) => (
                  <li
                    key={`nl-show-formcard-${card.side}`}
                    className={`nl-lineup-show-formcard${card.ready ? "" : " is-unknown"}`}
                    style={{ animationDelay: `${index * 140}ms` }}
                  >
                    <small>{card.side.toUpperCase()} · {sideLabels[card.side]}</small>
                    <strong>{card.ready ? card.label ?? "Formkarte" : "Noch verdeckt"}</strong>
                    {card.ready ? (
                      <NlDeltaChip value={card.value ?? 0} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`} />
                    ) : (
                      <span className="nl-lineup-show-formcard-hint">Reveal folgt in der Arena</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {clampedStep >= bonusStep ? (
            <div key={`nl-show-bonus-${data.signature}`} className="nl-lineup-show-phasecard is-bonus" role="group" aria-label="Weitere Boni">
              <span className="nl-lineup-show-phasecard-label">Boni</span>
              {data.bonusItems.length > 0 ? (
                <ul className="nl-lineup-show-bonuslist">
                  {data.bonusItems.map((item) => (
                    <li key={item.id} className="nl-lineup-show-bonus">
                      <span>{item.label}</span>
                      <NlDeltaChip value={item.value} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`} />
                    </li>
                  ))}
                </ul>
              ) : (
                <strong>Keine weiteren Boni aktiv</strong>
              )}
            </div>
          ) : null}

          {isDone ? (
            <div key={`nl-show-final-${data.signature}`} className="nl-lineup-show-final">
              <div className="nl-lineup-show-final-copy">
                <small>Projizierter Team-Score (D1 + D2)</small>
                <strong className="nl-tnum">{formatNlNumber(data.finalTotal, 1)}</strong>
              </div>
              {arenaReady && onNavigateArena ? (
                <button type="button" className="nl-lineup-btn is-arena is-ready" onClick={onNavigateArena}>
                  Zur Arena →
                </button>
              ) : (
                <span className="nl-lineup-show-final-hint">Der echte Reveal (Form, Mutatoren, Ränge) läuft in der Arena.</span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}

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
  resolvePreview,
}: LineupNewLookProps) {
  const [hoveredCandidateId, setHoveredCandidateId] = useState<string | null>(null);
  // Compare-Tray (Feature 3): angehefteter Kandidat A; hovert man einen anderen
  // (B), zeigt das Fokus-Panel A vs B (Radar-Overlay + Range + Delta).
  const [pinnedCandidateId, setPinnedCandidateId] = useState<string | null>(null);
  const [saveHelpOpen, setSaveHelpOpen] = useState(false);
  // Optimieren-Panel: Upgrade-Hinweise für die volle Aufstellung (Feature 1, additiv).
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [verdict, setVerdict] = useState<NlVerdictState | null>(null);
  const verdictTimeoutRef = useRef<number | null>(null);
  const prevAssignPulseRef = useRef<number | undefined>(undefined);

  /* --- Drag & Drop (progressive Enhancement der Klick-Zuweisung) ---------
   * Kandidatenkarte → Formation-Slot (Drop ⇒ onAssignPlayer), sowie belegter
   * Slot → Kader-Panel (Drop ⇒ onClearSlot). Klick-Pfad bleibt vollständig
   * erhalten; DnD ist rein additiv und wird bei isReadOnly/isBusy deaktiviert.
   */
  const [dragCandidateId, setDragCandidateId] = useState<string | null>(null);
  const [dragSourceSlotKey, setDragSourceSlotKey] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [isRemovalHover, setIsRemovalHover] = useState(false);
  const dndEnabled = !isReadOnly && !isBusy;

  const clearDragState = () => {
    setDragCandidateId(null);
    setDragSourceSlotKey(null);
    setDragOverSlotKey(null);
    setIsRemovalHover(false);
  };

  // Kandidat aufnehmen (aus dem Kader) — Payload = activePlayerId.
  const handleCandidateDragStart = (event: ReactDragEvent<HTMLElement>, candidateId: string | null | undefined) => {
    if (!dndEnabled || !candidateId) {
      event.preventDefault();
      return;
    }
    setDragSourceSlotKey(null);
    setDragCandidateId(candidateId);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", candidateId);
    event.dataTransfer.setData("application/x-nl-candidate", candidateId);
  };

  // Belegten Slot aufnehmen — Payload = Slot-Key (Drop im Kader ⇒ leeren).
  const handleSlotDragStart = (event: ReactDragEvent<HTMLElement>, slotKey: string, playerId: string) => {
    if (!dndEnabled || !playerId) {
      event.preventDefault();
      return;
    }
    setDragCandidateId(null);
    setDragSourceSlotKey(slotKey);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
    event.dataTransfer.setData("application/x-nl-slot", slotKey);
  };

  // Slots akzeptieren nur Kandidaten-Drags (Zuweisung), keine Slot→Slot-Moves.
  const handleSlotDragOver = (event: ReactDragEvent<HTMLElement>, slotKey: string) => {
    if (!dndEnabled || !dragCandidateId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (dragOverSlotKey !== slotKey) setDragOverSlotKey(slotKey);
  };

  const handleSlotDragLeave = (slotKey: string) => {
    if (dragOverSlotKey === slotKey) setDragOverSlotKey(null);
  };

  const handleSlotDrop = (event: ReactDragEvent<HTMLElement>, slotKey: string) => {
    if (!dndEnabled) return;
    const candidateId =
      dragCandidateId ||
      event.dataTransfer.getData("application/x-nl-candidate") ||
      event.dataTransfer.getData("text/plain");
    clearDragState();
    if (!candidateId) return;
    event.preventDefault();
    onAssignPlayer(slotKey, candidateId);
  };

  // Kader-Panel ist Ablage-Zone zum Entfernen — nur für Slot-Drags aktiv.
  const handleRemovalDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!dndEnabled || !dragSourceSlotKey) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isRemovalHover) setIsRemovalHover(true);
  };

  const handleRemovalDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!dndEnabled || !dragSourceSlotKey) return;
    event.preventDefault();
    const slotKey = dragSourceSlotKey;
    clearDragState();
    onClearSlot(slotKey);
  };

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

  // Optimieren (Feature 1): pro BELEGTEM Slot prüfen, ob der Top-Kandidat der
  // Slot-Summary ein anderer (= besserer) Spieler ist als der aktuell Gesetzte.
  // `topCandidates` stammt aus getAvailableOptionsForSlot und schließt bereits
  // anderswo gesetzte Spieler aus → jeder Vorschlag ist eligible & konfliktfrei.
  // Gain = Top-Projektion − aktuelle Slot-Projektion; nur echte Zugewinne (>0).
  const lineupUpgrades = useMemo(() => {
    const rows: Array<{ slotKey: string; slotLabel: string; currentName: string; suggestedId: string; suggestedName: string; gain: number }> = [];
    for (const slot of slots) {
      const currentId = selections[slot.key];
      if (!currentId) continue; // nur belegte Slots optimieren
      const summary = slotCandidateSummaryByKey.get(slot.key);
      const top = summary?.topCandidates[0] ?? null;
      if (!top || top.activePlayerId === currentId) continue; // bereits der beste Kandidat gesetzt
      const currentProjected = summary?.currentProjected ?? null;
      const gain =
        currentProjected != null && top.projectedScore != null
          ? Number((top.projectedScore - currentProjected).toFixed(1))
          : null;
      if (gain == null || gain <= 0) continue; // nur echte Verbesserungen anbieten
      rows.push({
        slotKey: slot.key,
        slotLabel: `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1}`,
        currentName: rosterCardByActivePlayerId.get(currentId)?.name ?? getSelectedOptionMeta(currentId)?.name ?? "Spieler",
        suggestedId: top.activePlayerId,
        suggestedName: top.name,
        gain,
      });
    }
    return rows.sort((left, right) => right.gain - left.gain);
  }, [slots, selections, slotCandidateSummaryByKey, rosterCardByActivePlayerId, getSelectedOptionMeta]);

  // "Alle übernehmen": Snapshot sequenziell anwenden, aber pro Ziel-Spieler nur
  // einmal — verhindert Doppel-Zuweisung, falls ein freier Spieler für zwei
  // Slots zugleich Top-Vorschlag ist (Undo deckt Assignments bereits ab).
  const applyAllUpgrades = () => {
    const applied = new Set<string>();
    for (const row of lineupUpgrades) {
      if (applied.has(row.suggestedId)) continue;
      applied.add(row.suggestedId);
      onAssignPlayer(row.slotKey, row.suggestedId);
    }
  };

  // Bug T-002: KEIN Fallback auf filteredCandidates[0], falls alle Kandidaten
  // blockiert sind — sonst würde "Top-Pick setzen" einen blockierten Spieler
  // zuweisen (z.B. schon anderswo gesetzt / nicht spielberechtigt).
  const topPickForActiveSlot = useMemo(
    () => filteredCandidates.find((entry) => !entry.activeSlotCandidate?.blockReason) ?? null,
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
  // Fatigue des Fokus-Spielers (Feature 2): als Mini-Gauge im Fokus-Panel.
  const focusFatigue = focusPlayer?.activePlayerId ? getSelectedOptionMeta(focusPlayer.activePlayerId)?.fatigueCount ?? null : null;

  // Slot-Projektion eines Spielers im aktiven Slot (Feature 1/3): Range + Punkt
  // aus dem activeSlotCandidate; für den bereits Gesetzten fällt die Range auf
  // die Slot-Preview zurück. Erfindet keine Werte — fehlt beides, bleibt null.
  const slotStatsForPlayer = (playerId: string | null | undefined) => {
    if (!playerId) return null;
    const entry = filteredCandidates.find((candidate) => candidate.player.activePlayerId === playerId) ?? null;
    const asc = entry?.activeSlotCandidate ?? null;
    const slotProjected = activeSlot ? slotPreviewByKey.get(activeSlot.key)?.projected ?? null : null;
    const isSelected = activeSlot ? selections[activeSlot.key] === playerId : false;
    return {
      player: rosterCardByActivePlayerId.get(playerId) ?? entry?.player ?? null,
      projected: asc?.projectedScore ?? (isSelected ? slotProjected?.totalProjected ?? null : null),
      rangeLow: asc?.rangeLow ?? (isSelected ? slotProjected?.rangeLow ?? null : null),
      rangeHigh: asc?.rangeHigh ?? (isSelected ? slotProjected?.rangeHigh ?? null : null),
    };
  };

  // Confidence-Band des Fokus-Spielers (Feature 1).
  const focusStats = slotStatsForPlayer(focusPlayerId);

  // Compare-Tray-Zustand (Feature 3): aktiv, sobald ein Kandidat angeheftet ist
  // UND ein anderer gehovert wird. Ohne Pin bleibt das Fokus-Panel unverändert.
  const compareActive =
    pinnedCandidateId != null && hoveredCandidateId != null && hoveredCandidateId !== pinnedCandidateId;
  const compareA = compareActive ? slotStatsForPlayer(pinnedCandidateId) : null;
  const compareB = compareActive ? slotStatsForPlayer(hoveredCandidateId) : null;
  // Gemeinsame Skala beider Vergleichs-Bänder, damit A und B direkt vergleichbar sind.
  const compareDomain = (() => {
    if (!compareA || !compareB) return null;
    const values = [compareA.rangeLow, compareA.rangeHigh, compareA.projected, compareB.rangeLow, compareB.rangeHigh, compareB.projected].filter(
      (value): value is number => value != null && Number.isFinite(value),
    );
    if (values.length === 0) return null;
    return { min: Math.min(...values) - 2, max: Math.max(...values) + 2 };
  })();

  // Reason-Chips je Kandidat (Feature 2): Achsen-Begründung aus der Slot-Summary
  // des aktiven Slots (bereits vorhanden, war ungenutzt). Key = activePlayerId.
  const reasonChipsByPlayerId = useMemo(() => {
    const top = activeSlotKey ? slotCandidateSummaryByKey.get(activeSlotKey)?.topCandidates ?? [] : [];
    return new Map(
      top
        .filter((candidate) => (candidate.reasonChips?.length ?? 0) > 0)
        .map((candidate) => [candidate.activePlayerId, candidate.reasonChips ?? []] as const),
    );
  }, [activeSlotKey, slotCandidateSummaryByKey]);

  // Gemeinsame Skala für die Confidence-Bänder der Top-4-Kandidaten, damit die
  // Bänder untereinander vergleichbar sind (sonst eigene Skala je Zeile).
  const candidateRangeDomain = useMemo(() => {
    const values: number[] = [];
    for (const entry of filteredCandidates.slice(0, 4)) {
      const asc = entry.activeSlotCandidate;
      if (asc?.rangeLow != null) values.push(asc.rangeLow);
      if (asc?.rangeHigh != null) values.push(asc.rangeHigh);
      if (asc?.projectedScore != null) values.push(asc.projectedScore);
    }
    if (values.length === 0) return null;
    return { min: Math.min(...values) - 2, max: Math.max(...values) + 2 };
  }, [filteredCandidates]);

  const activeCaptainSide = activeSlot?.disciplineSide ?? "d1";
  const activeCaptainEntries = captainSelectEntriesBySide[activeCaptainSide] ?? [];
  const activeCaptainInfoById = useMemo(
    () => new Map(captainInfoBySide[activeCaptainSide].map((info) => [info.activePlayerId, info] as const)),
    [activeCaptainSide, captainInfoBySide],
  );

  const totalRequired = lineupFlowSummary.totalRequired;
  const selectedCount = lineupFlowSummary.selectedCount;
  // Verfügbare Slot-Karten insgesamt (d1 + d2) — dieselbe Basis wie im
  // Discipline-Header, s. `sideSlots.length` in `renderSide`. Der Ring bildet
  // aus diesem Wert, `totalRequired` (Pflicht-Minimum) und `selectedCount` EIN
  // Ziel (Maximum), damit die Bruchzahl nie widersprüchlich wird (s.
  // NlCompletenessRing).
  const totalAvailableSlots = slots.length;

  // Resolve-Show: staged Slot-für-Slot-Auflösung aus dem bestehenden
  // Preview-Feed. null => Abschnitt erscheint gar nicht (Seite unverändert).
  const resolveShowData = useMemo(() => buildNlResolveShowData(resolvePreview), [resolvePreview]);
  const resolveShowSideLabels = useMemo<Record<"d1" | "d2", string>>(
    () => ({
      d1: context?.matchdayContract?.discipline1?.displayName ?? "Disziplin 1",
      d2: context?.matchdayContract?.discipline2?.displayName ?? "Disziplin 2",
    }),
    [context?.matchdayContract?.discipline1?.displayName, context?.matchdayContract?.discipline2?.displayName],
  );

  if (!context) {
    return (
      <div className="nl-lineup-root" data-testid="lineup-new-look">
        <div className="nl-lineup-loading" role="status" aria-busy="true">
          <span className="sr-only">Spieltag-Kontext wird geladen…</span>
          <NlSkeletonCard lines={4} />
        </div>
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

    // Feature 2 „Score to beat" (spoiler-sicher): nächste Saison-Rivalen dieser
    // Disziplin. Quelle = context.teamPowerWindows[disciplineId].top8Rivals, gebaut
    // aus der SAISON-Rangtabelle (rankSource "active_roster_top6_sum_discipline_
    // score" — identisch zum Saisonstand). `rank` = aktueller Saison-Rang,
    // `relationship` = Rivalitäts-Stärke (negativer = schärfer). Hier wird KEIN
    // projiziertes Spieltag-Ergebnis und kein Nach-Spieltag-Rang berührt.
    const disciplineId = discipline?.disciplineId ?? null;
    const rivalWindow = disciplineId ? context.teamPowerWindows?.[disciplineId] ?? null : null;
    const standingsRivals = rivalWindow?.top8Rivals ?? [];
    // Rivalitäts-Druck spiegelt exakt die Client-Schwelle (rivalryPressureByDiscipline):
    // sitzt ein Rivale auf Rang ≤ 3, wiegt „Vollgas" schwerer (Druck 1.5 statt 1) —
    // reine Standings-Ableitung, dieselbe Größe, die bereits in die Projektion fließt.
    const nearestRivalRank = standingsRivals.length > 0 ? Math.min(...standingsRivals.map((rival) => rival.rank)) : null;
    const rivalPressureElevated = nearestRivalRank != null && nearestRivalRank <= 3;

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
                {/* Slot-Label-Klarheit: "belegt/verfügbar" statt der früheren
                    Bruchzahl {sideSelected}/{sideRequired} — die verglich belegte
                    Slots mit dem Pflicht-Minimum und ergab z. B. "6/2" (6 belegte
                    von 6 verfügbaren Slots, davon 2 Pflicht). Pflicht-Minimum
                    steht jetzt separat als "min. N". */}
                Rang {rank ?? "—"} · {sideSelected}/{sideSlots.length || "—"} belegt · min. {sideRequired || "—"}
              </small>
            </div>
          </div>
          <div className="nl-lineup-side-meta">
            {/* Completeness-Fill jetzt über das Kit-Primitive NlProgressBar
                (semantischer Ton nach Füllgrad). Die alte Klasse bleibt nur als
                Größen-Constraint (90×4) erhalten; `progressPct` (0–100) treibt die
                Bar direkt, damit der Füllgrad byte-genau dem alten Balken entspricht. */}
            <NlProgressBar
              value={progressPct}
              max={100}
              showValue={false}
              className="nl-lineup-side-progress"
              title={`${sideSelected}/${sideRequired || "—"} Pflicht-Slots besetzt`}
            />
            <div className="nl-lineup-intensity" role="group" aria-label={`${disciplineSide.toUpperCase()} Intensity`}>
              {(["conserve", "normal", "push"] as const).map((stage) => (
                <button
                  key={`${disciplineSide}-${stage}`}
                  type="button"
                  className={intensity === stage ? "is-selected" : ""}
                  aria-pressed={intensity === stage}
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

          {/* Feature 2: kompakter Rivalen-Streifen (eigene Zeile — side-head ist
              flex-wrap). Zeigt Saison-Rang + Rivalitäts-Stärke der nächsten
              Rivalen; Tooltip erklärt, warum „Vollgas" gegen sie mehr kostet.
              Rein Standings-basiert — kein Spieltag-Ergebnis. */}
          {standingsRivals.length > 0 ? (
            <div
              className="nl-lineup-side-rivals"
              data-testid={`nl-lineup-side-rivals-${disciplineSide}`}
              style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", fontSize: "11px" }}
              title={
                rivalPressureElevated
                  ? "Zu schlagen: enge Saison-Rivalen (einer steht auf Rang ≤ 3 dieser Disziplin). Weil ein Rivale so weit oben rangiert, wiegt Vollgas hier schwerer — der Rivalitäts-Druck erhöht die Varianz deiner Projektion. Basis: Saisonstand, kein Spieltag-Ergebnis."
                  : "Zu schlagen: deine nächsten Saison-Rivalen in dieser Disziplin (aus dem Saisonstand, kein Spieltag-Ergebnis)."
              }
            >
              <span style={{ color: "var(--nl-mut)", fontWeight: 700, letterSpacing: "0.02em" }}>Zu schlagen</span>
              {standingsRivals.slice(0, 2).map((rival) => (
                <span
                  key={rival.teamId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 7px",
                    borderRadius: "var(--nl-r-pill)",
                    border: "1px solid var(--nl-line)",
                    background: "var(--nl-panel-2)",
                    color: "var(--nl-ink)",
                  }}
                  title={`${rival.teamName}: Saison-Rang #${rival.rank} · ${rivalStrengthLabel(rival.relationship)}`}
                >
                  <strong className="nl-tnum" style={{ color: "var(--nl-accent)" }}>
                    #{rival.rank}
                  </strong>
                  <span style={{ maxWidth: "9ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rival.teamName}</span>
                  {/* Stärke als 1–3 Schwerter (nur Deko, Erklärung im Tooltip). */}
                  <em style={{ fontStyle: "normal", color: "var(--nl-mut-2)" }} aria-hidden="true">
                    {"⚔".repeat(Math.min(3, Math.max(1, Math.round(Math.abs(rival.relationship) - 1))))}
                  </em>
                </span>
              ))}
              {rivalPressureElevated ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "2px 7px",
                    borderRadius: "var(--nl-r-pill)",
                    border: "1px solid color-mix(in srgb, var(--nl-warn) 55%, transparent)",
                    background: "color-mix(in srgb, var(--nl-warn) 16%, transparent)",
                    color: "var(--nl-warn)",
                    fontWeight: 700,
                  }}
                  title="Ein Rivale steht auf Rang ≤ 3 dieser Disziplin — Vollgas kostet hier mehr (erhöhter Rivalitäts-Druck)."
                >
                  Druck ↑
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="nl-lineup-slot-grid">
          {sideSlots.map((slot, slotRevealIndex) => {
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
            // Nach-Spieltag-Belastung (Feature 2): aktuelle Fatigue + projizierte
            // Zusatz-Ermüdung dieses Slots. >= FATIGUE_HIGH ⇒ Warn-Affordanz.
            const aftermathFatigue = fatigue != null ? fatigue + (preview?.projected.additionalFatigue ?? 0) : null;
            const aftermathHigh = aftermathFatigue != null && aftermathFatigue >= FATIGUE_HIGH;

            return (
              <article
                key={`nl-lineup-slot-${slot.key}`}
                id={`lineup-slot-${slot.key}`}
                // nl-reveal: gestaffelter Karten-Einstieg (CSS-only, Stagger-Index
                // pro Seite) — dasselbe Muster wie MatchdayResultNewLook/Standings.
                className={`nl-lineup-slot nl-reveal${player ? " is-filled" : " is-open"}${isActive ? " is-active" : ""}${isNextTarget ? " is-next" : ""}${isJustAssigned ? " is-just-assigned" : ""}${
                  dndEnabled && dragCandidateId ? " is-drop-target" : ""
                }${dragOverSlotKey === slot.key ? " is-drag-over" : ""}${dragSourceSlotKey === slot.key ? " is-dragging" : ""}`}
                style={{ "--nl-reveal-i": Math.min(slotRevealIndex, 14) } as CSSProperties}
                draggable={player && dndEnabled ? true : undefined}
                onDragStart={player ? (event) => handleSlotDragStart(event, slot.key, selectedId) : undefined}
                onDragEnd={player ? clearDragState : undefined}
                onDragOver={(event) => handleSlotDragOver(event, slot.key)}
                onDragLeave={() => handleSlotDragLeave(slot.key)}
                onDrop={(event) => handleSlotDrop(event, slot.key)}
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
                        {/* Feature 1: 22px-Portrait-Avatar (Initialen-Fallback) links vom Namen;
                            Hover ⇒ volle Portrait-Karte (wie v2). `strong` ist bereits Flex-Row
                            mit gap — Score/Fatigue rutschen dadurch nicht raus. */}
                        {wrapNlPortraitPreview(
                          <NlPlayerAvatar portraitUrl={player.portraitUrl} name={player.name} size={22} />,
                          player,
                          isReadOnly || isBusy,
                        )}
                        {player.name}
                        {isCaptain ? <span className="nl-lineup-captain-badge">C</span> : null}
                      </strong>
                      <span className="nl-lineup-slot-score">
                        {/* Nur noch die projizierte Slot-Punktzahl — die redundante
                            "Basis"-Zweitzahl entfernt. Fatigue jetzt als Mini-Gauge
                            (Feature 2) statt bloßem "F N"-Text. "Pkt"-Einheit macht
                            klar, dass dies die erwartete Punktzahl ist (nicht die
                            danebenstehende Fatigue-Gauge) — siehe .nl-lineup-slot-score-unit. */}
                        <em className="nl-tnum">
                          {formatNullableScore(projected)}
                          <small className="nl-lineup-slot-score-unit">Pkt</small>
                        </em>
                        {fatigue != null ? (
                          <NlFatigueGauge value={fatigue} label="F" title={`Fatigue ${Math.round(fatigue)}/100`} />
                        ) : null}
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
                    {/* Fatigue-Aftermath-Warnung (Feature 2): Spieler ist nach diesem
                        Spieltag hoch belastet. Ton über fatigueTone (⇒ is-risk). */}
                    {aftermathHigh ? (
                      <span
                        className={`nl-lineup-chip is-${fatigueTone(aftermathFatigue as number)}`}
                        title="nach diesem Spieltag hoch belastet"
                      >
                        Nach Spieltag hoch
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
          <NlCompletenessRing
            selected={selectedCount}
            total={totalAvailableSlots}
            minRequired={totalRequired}
            ready={lineupReadyToSave}
          />
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
            {/* Count-up der Hero-Zahl (Kit-Primitive): animiert die obere
                Fenstergrenze; die untere Grenze läuft proportional zur Animation
                mit, sodass das "low–high"-Fenster erhalten bleibt und der Endwert
                exakt formatProjectedMetricWindow entspricht. */}
            <strong className="nl-tnum">
              <NlCountUpValue
                value={matchdayPreviewCards.totalRangeHigh}
                format={(animatedHigh) => {
                  const finalHigh = matchdayPreviewCards.totalRangeHigh;
                  const low = matchdayPreviewCards.totalRangeLow;
                  const ratio = finalHigh != null && finalHigh !== 0 ? animatedHigh / finalHigh : 1;
                  return formatProjectedMetricWindow(low != null ? low * ratio : null, animatedHigh);
                }}
              />
            </strong>
          </div>
          {/* HUD-Paar "D1"/"D2" entfernt: wiederholte nur die Zahl, die bereits im
              gewählten Intensity-Button (renderSide) steht — Buttons sind die
              Single-Source-of-Truth. */}
          {/* Risiko als tonfarbener Kit-Chip (StatChip → nlToneClass): hoch=risk,
              mittel=warn, niedrig=good — statt des bloßen Kleinbuchstaben-Worts. */}
          <StatChip
            label="Risiko"
            value={matchdayPreviewCards.riskLevel}
            tone={getNlRiskTone(matchdayPreviewCards.riskLevel)}
            title={`Risiko-Level: ${matchdayPreviewCards.riskLevel}`}
          />
          {/* Fatigue-Kosten (Feature 2): Summe der Zusatz-Ermüdung dieses Spieltags
              (matchdayPreviewCards.totalFatigue). Ton über die kanonischen Fatigue-
              Schwellen (≥40 warn, ≥65 risk). */}
          <StatChip
            label="Fatigue-Kosten"
            value={`−${formatNlNumber(matchdayPreviewCards.totalFatigue, 1)}`}
            tone={fatigueTone(matchdayPreviewCards.totalFatigue)}
            title={`Ermüdung, die dieser Spieltag kostet: ${formatNlNumber(matchdayPreviewCards.totalFatigue, 1)}`}
          />
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
          {/* Optimieren (Feature 1): blendet die Upgrade-Karte ein/aus. Der
              Panel-Inhalt selbst bleibt im Read-Only-Modus rein informativ
              lesbar (T-034) — nur die „Übernehmen"-Buttons innerhalb der
              Karte sind per !isReadOnly ausgeblendet, daher darf dieser
              Toggle NICHT über isReadOnly gesperrt werden. */}
          <button
            type="button"
            className={`nl-lineup-btn is-ghost${optimizeOpen ? " is-selected" : ""}`}
            aria-expanded={optimizeOpen}
            onClick={() => setOptimizeOpen((current) => !current)}
            title="Bessere Kandidaten für belegte Slots vorschlagen"
          >
            Optimieren
            {lineupUpgrades.length > 0 ? <em className="nl-tnum"> {lineupUpgrades.length}</em> : null}
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

      {/* --- Optimieren (Feature 1): Upgrade-Hinweise für belegte Slots ------- */}
      {optimizeOpen ? (
        <NlCard
          eyebrow="Optimieren"
          title="Bessere Aufstellung finden"
          data-testid="nl-lineup-optimize"
          actions={
            <>
              {lineupUpgrades.length > 0 && !isReadOnly ? (
                <button type="button" className="nl-lineup-btn is-primary" onClick={applyAllUpgrades} disabled={isBusy}>
                  Alle übernehmen
                </button>
              ) : null}
              <button type="button" className="nl-lineup-btn is-ghost" onClick={() => setOptimizeOpen(false)}>
                Schließen
              </button>
            </>
          }
        >
          {lineupUpgrades.length === 0 ? (
            <NlEmptyState icon="✓" tone="good" title="Aufstellung ist bereits optimal" message="Für keinen belegten Slot gibt es einen stärkeren freien Kandidaten." />
          ) : (
            <ul className="nl-lineup-show-bonuslist">
              {lineupUpgrades.map((row) => (
                <li key={row.slotKey} className="nl-lineup-show-bonus" data-testid="nl-lineup-optimize-row">
                  <span>
                    <strong className="nl-tnum">{row.slotLabel}</strong> {row.currentName} → {row.suggestedName}
                  </span>
                  <NlDeltaChip value={row.gain} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`} title="Projizierter Zugewinn dieses Wechsels" />
                  {!isReadOnly ? (
                    <button
                      type="button"
                      className="nl-lineup-btn is-ghost is-small"
                      onClick={() => onAssignPlayer(row.slotKey, row.suggestedId)}
                      disabled={isBusy}
                    >
                      Übernehmen
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </NlCard>
      ) : null}

      {resolveShowData ? (
        <NlLineupResolveShow
          data={resolveShowData}
          sideLabels={resolveShowSideLabels}
          arenaReady={arenaReady}
          onNavigateArena={onNavigateArena}
        />
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

            {compareActive && compareA?.player && compareB?.player ? (
              // Compare-Tray (Feature 3): angeheftet (A) vs. gehovert (B) —
              // Radar-Overlay (Mehrserien-Modus), beide Confidence-Bänder auf
              // gemeinsamer Skala und das Projektions-Delta B − A.
              <div className="nl-lineup-focus-player" data-testid="nl-lineup-compare">
                <div className="nl-lineup-focus-radar">
                  {compareA.player.coreStats && compareB.player.coreStats ? (
                    <NlRadar
                      max={100}
                      axisDefs={(["pow", "spe", "men", "soc"] as const).map((key) => ({ key, label: NL_AXIS_AREA_LABEL[key] }))}
                      series={[
                        { id: "pin", label: compareA.player.name, tone: "accent", values: compareA.player.coreStats },
                        { id: "hover", label: compareB.player.name, tone: "good", dashed: true, values: compareB.player.coreStats },
                      ]}
                      aria-label={`Vergleichs-Radar: ${compareA.player.name} gegen ${compareB.player.name}`}
                    />
                  ) : (
                    <p className="nl-lineup-focus-noradar">Keine Achsen-Daten für den Vergleich.</p>
                  )}
                </div>
                <div className="nl-lineup-focus-meta">
                  <span className="nl-lineup-eyebrow">Vergleich · angeheftet vs. gehovert</span>
                  <strong>
                    {compareA.player.name} vs. {compareB.player.name}
                  </strong>
                  <StatChip label="A" value={formatNullableScore(compareA.projected)} sub={compareA.player.name} tone="accent" title="Angehefteter Kandidat" />
                  {compareA.rangeLow != null && compareA.rangeHigh != null ? (
                    <VeloRangeBar low={compareA.rangeLow} high={compareA.rangeHigh} point={compareA.projected} tone="neutral" compact domainMin={compareDomain?.min ?? null} domainMax={compareDomain?.max ?? null} />
                  ) : null}
                  <StatChip label="B" value={formatNullableScore(compareB.projected)} sub={compareB.player.name} tone="good" title="Gehoverter Kandidat" />
                  {compareB.rangeLow != null && compareB.rangeHigh != null ? (
                    <VeloRangeBar low={compareB.rangeLow} high={compareB.rangeHigh} point={compareB.projected} tone="positive" compact domainMin={compareDomain?.min ?? null} domainMax={compareDomain?.max ?? null} />
                  ) : null}
                  {compareA.projected != null && compareB.projected != null ? (
                    <NlDeltaChip
                      value={Number((compareB.projected - compareA.projected).toFixed(1))}
                      format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 1)}`}
                      title="Projektions-Delta: gehovert (B) − angeheftet (A)"
                    />
                  ) : null}
                  <button type="button" className="nl-lineup-btn is-ghost is-small" onClick={() => setPinnedCandidateId(null)}>
                    Vergleich lösen
                  </button>
                </div>
              </div>
            ) : focusPlayer ? (
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
                  {/* Feature 1: 28px-Portrait-Avatar im Fokus-Panel (Initialen-Fallback).
                      Detailkarte ist hier schon sichtbar (Radar/Stats) ⇒ kein Hover-Popover nötig. */}
                  <strong style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <NlPlayerAvatar portraitUrl={focusPlayer.portraitUrl} name={focusPlayer.name} size={28} />
                    <span>{focusPlayer.name}</span>
                  </strong>
                  <small>
                    {focusPlayer.className ?? "—"}
                    {focusPlayer.playerOvr != null ? (
                      <span title="Basis-OVR aus dem Spielerprofil — auf Home steht die liga-normalisierte OVR, daher weicht der Wert ab.">
                        {" · Basis-OVR "}
                        {formatScore(focusPlayer.playerOvr)}
                      </span>
                    ) : (
                      ""
                    )}
                  </small>
                  {focusLaneVerdict ? (
                    <span className="nl-lineup-chip is-neutral" title={focusLaneVerdict.detail}>
                      {focusLaneVerdict.label}
                    </span>
                  ) : null}
                  {/* Lane-Verdikt-Chip + NlLaneMeter bleiben als Lane-Signal.
                      Die frühere "Bester Slot: … · NN"-Zeile war nur das Maximum der
                      Lane-Werte und damit redundant — entfernt. */}
                  <NlLaneMeter bestD1={focusLaneD1} bestD2={focusLaneD2} />
                  {/* Confidence-Band (Feature 1): projizierte Punktespanne des
                      Fokus-Spielers im aktiven Slot (füllt den in Phase 0 durch
                      den entfernten Zeilen-Lane-Meter freigewordenen Platz). */}
                  {focusStats && focusStats.rangeLow != null && focusStats.rangeHigh != null ? (
                    <VeloRangeBar
                      low={focusStats.rangeLow}
                      high={focusStats.rangeHigh}
                      point={focusStats.projected}
                      tone="neutral"
                      compact
                      ariaLabel={`Projektion ${formatNullableScore(focusStats.rangeLow)} bis ${formatNullableScore(focusStats.rangeHigh)}${
                        focusStats.projected != null ? `, Fokus ${formatNullableScore(focusStats.projected)}` : ""
                      }`}
                    />
                  ) : null}
                  {/* Fatigue als Mini-Gauge (Feature 2) statt bloßem Textwert. */}
                  {focusFatigue != null ? (
                    <NlFatigueGauge value={focusFatigue} label="Fatigue" title={`Fatigue ${Math.round(focusFatigue)}/100`} />
                  ) : null}
                  <button
                    type="button"
                    className="nl-lineup-btn is-ghost is-small"
                    onClick={() => onOpenPlayer(focusPlayer.id, focusPlayer.activePlayerId)}
                  >
                    Profil
                  </button>
                  {/* Pin-Affordanz (Feature 3): Fokus-Spieler zum Vergleich anheften;
                      danach einen anderen Kandidaten hovern ⇒ A-vs-B-Compare-Tray. */}
                  {focusPlayer.activePlayerId ? (
                    <button
                      type="button"
                      className={`nl-lineup-btn is-ghost is-small${pinnedCandidateId === focusPlayer.activePlayerId ? " is-selected" : ""}`}
                      aria-pressed={pinnedCandidateId === focusPlayer.activePlayerId}
                      title="Zum Vergleich anheften — danach anderen Kandidaten hovern zeigt A vs B"
                      onClick={() =>
                        setPinnedCandidateId((current) =>
                          current === focusPlayer.activePlayerId ? null : focusPlayer.activePlayerId ?? null,
                        )
                      }
                    >
                      {pinnedCandidateId === focusPlayer.activePlayerId ? "📌 Angeheftet" : "📌 Vergleichen"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="nl-lineup-focus-noradar">Kandidat wählen oder Slot fokussieren.</p>
            )}

            {/* Phase 3: Captain-Chip-Grid ersetzt das veraltete native <select>.
                Jeder Kandidat ist ein fokussierbarer Button-Chip (Name + geschätzter
                Captain-Bonus, optional Moral-Reward). Ein Klick ruft denselben
                onUpdateCaptain-Handler wie zuvor auf — Selektionslogik/State bleiben
                unverändert. Styling über Inline-Tokens (kein globals.css-Zugriff),
                damit es kompakt in die Fokus-Rail passt. */}
            <div className="nl-lineup-captain">
              <span>Captain {activeCaptainSide.toUpperCase()} · {captainDraftRemaining} frei heute</span>
              {/* Saison-Captain-Budget als Kit-NlProgressBar (invert: voll = ausgeschöpft → risk). */}
              <NlProgressBar
                value={captainSeasonUsedWithDraft}
                max={captainSeasonLimit || 1}
                label="Saisonbudget"
                invert
                format={(v) => `${formatNlNumber(v, 0)} / ${formatNlNumber(captainSeasonLimit, 0)}`}
                title={`${captainSeasonUsedWithDraft} von ${captainSeasonLimit} Captain-Einsätzen dieser Saison verplant`}
                className="nl-lineup-captain-budget"
              />
              <div
                role="group"
                aria-label={`Captain ${activeCaptainSide.toUpperCase()} wählen`}
                style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}
              >
                {/* "Kein Captain"-Chip (aktiv, wenn keine Auswahl gesetzt ist). */}
                {(() => {
                  const noneSelected = !captains[activeCaptainSide];
                  return (
                    <button
                      type="button"
                      aria-pressed={noneSelected}
                      disabled={isReadOnly || isBusy}
                      onClick={() => onUpdateCaptain(activeCaptainSide, "")}
                      style={captainChipStyle(noneSelected)}
                    >
                      Kein Captain
                    </button>
                  );
                })()}
                {activeCaptainEntries.map((entry) => {
                  const info = activeCaptainInfoById.get(entry.activePlayerId);
                  const isSelected = captains[activeCaptainSide] === entry.activePlayerId;
                  return (
                    <button
                      key={entry.activePlayerId}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={isReadOnly || isBusy}
                      onClick={() => onUpdateCaptain(activeCaptainSide, entry.activePlayerId)}
                      title={`${entry.name} als Captain ${activeCaptainSide.toUpperCase()} setzen`}
                      style={captainChipStyle(isSelected)}
                    >
                      <strong style={{ fontWeight: isSelected ? 700 : 600 }}>{entry.name}</strong>
                      {info?.estimatedCaptainBonus != null ? (
                        <em style={{ fontStyle: "normal", color: "var(--nl-good)", fontWeight: 700 }} title="Geschätzter Score-Bonus">
                          +{formatScore(info.estimatedCaptainBonus)}
                        </em>
                      ) : null}
                      {info?.moraleReward != null ? (
                        <em style={{ fontStyle: "normal", color: "var(--nl-accent)", fontWeight: 700 }} title="Moral-Reward bei Forderungserfüllung">
                          ♥+{formatScore(info.moraleReward)}
                        </em>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className={`nl-lineup-candidates${dndEnabled && dragSourceSlotKey ? " is-removal-active" : ""}${
              isRemovalHover ? " is-removal-hover" : ""
            }`}
            aria-label="Kader"
            onDragOver={handleRemovalDragOver}
            onDragLeave={() => setIsRemovalHover(false)}
            onDrop={handleRemovalDrop}
          >
            {dndEnabled && dragSourceSlotKey ? (
              <div className="nl-lineup-removal-overlay" aria-hidden="true">
                Spieler hier ablegen, um den Slot zu leeren
              </div>
            ) : null}
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
              {/* Kit-Leerzustände statt bloßer <p>-Zeilen (einheitliches --nl-*-Vokabular). */}
              {!activeSlot ? (
                <NlEmptyState
                  icon="🎯"
                  title="Kein Slot fokussiert"
                  message="Erst einen Slot links wählen — dann Kandidaten einsetzen."
                />
              ) : null}
              {filteredCandidates.length === 0 ? (
                <NlEmptyState title="Keine Kandidaten" message="Keine Kandidaten in dieser Gruppe." />
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
                  // Achsen-Begründung (Feature 2) + Confidence-Band (Feature 1) je Kandidat.
                  const reasonChips = candidateId ? reasonChipsByPlayerId.get(candidateId) ?? [] : [];
                  const candidateRange = entry.activeSlotCandidate ?? null;

                  return (
                    <button
                      key={`nl-candidate-${candidate.id}-${entry.groupKey}`}
                      type="button"
                      className={`nl-lineup-candidate${isAssignedHere ? " is-assigned" : ""}${isBlocked ? " is-blocked" : ""}${
                        dragCandidateId === candidateId && candidateId ? " is-dragging" : ""
                      }`}
                      // Feature 1: Grid um eine schmale Avatar-Spalte erweitern (Basis war
                      // "1fr auto"). „auto" ⇒ nur so breit wie der 20px-Avatar; Namens-/
                      // Score-Spalte bleiben unverändert, also gleiche Zeilendichte.
                      style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}
                      disabled={isReadOnly || isBlocked || !candidateId}
                      draggable={dndEnabled && !isBlocked && Boolean(candidateId) ? true : undefined}
                      title={
                        isBlocked
                          ? entry.detail
                          : activeSlot
                            ? `In ${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1} einsetzen (Klick) oder auf einen Slot ziehen`
                            : "Auf einen Slot ziehen, um einzusetzen (oder Slot wählen und klicken)"
                      }
                      onDragStart={(event) => handleCandidateDragStart(event, candidateId)}
                      onDragEnd={clearDragState}
                      onMouseEnter={() => setHoveredCandidateId(candidateId ?? null)}
                      onFocus={() => setHoveredCandidateId(candidateId ?? null)}
                      onClick={() => candidateId && activeSlot && onAssignPlayer(activeSlot.key, candidateId)}
                    >
                      {index < 4 ? (
                        <span className="nl-lineup-candidate-rank nl-tnum" aria-hidden="true">
                          {index + 1}
                        </span>
                      ) : null}
                      {/* Feature 1: 20px-Avatar als erste Grid-Spalte (Initialen-Fallback,
                          Hover ⇒ volle Karte). Klick fällt weiterhin auf den Button-Handler
                          durch (Zuweisung); Drag-Quelle bleibt der gesamte Button. */}
                      {wrapNlPortraitPreview(
                        <NlPlayerAvatar portraitUrl={candidate.portraitUrl} name={candidate.name} size={20} />,
                        candidate,
                        isReadOnly || isBlocked,
                      )}
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
                        {/* Reason-Chips (Feature 2): Top 1–2 Achsen-Begründungen als
                            getönte StatChips (Achsen-Ton), statt nur Freitext oben. */}
                        {reasonChips.length > 0 ? (
                          <span className="nl-lineup-candidate-reasons">
                            {reasonChips.slice(0, 2).map((chip) => (
                              <StatChip
                                key={chip.axis}
                                label={chip.label}
                                value={chip.rating ?? "—"}
                                tone={reasonChipTone(chip.axis)}
                                title={chip.detail}
                              />
                            ))}
                          </span>
                        ) : null}
                        {/* Confidence-Band (Feature 1) auf den Top-4-Zeilen, gemeinsame
                            Skala (candidateRangeDomain) ⇒ Bänder direkt vergleichbar.
                            Ersetzt den in Phase 0 entfernten Zeilen-Lane-Meter. */}
                        {index < 4 && candidateRange?.rangeLow != null && candidateRange?.rangeHigh != null ? (
                          <VeloRangeBar
                            low={candidateRange.rangeLow}
                            high={candidateRange.rangeHigh}
                            point={projectedScore}
                            tone="neutral"
                            compact
                            domainMin={candidateRangeDomain?.min ?? null}
                            domainMax={candidateRangeDomain?.max ?? null}
                            ariaLabel={`Projektion ${formatNullableScore(candidateRange.rangeLow)} bis ${formatNullableScore(candidateRange.rangeHigh)}`}
                          />
                        ) : null}
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
