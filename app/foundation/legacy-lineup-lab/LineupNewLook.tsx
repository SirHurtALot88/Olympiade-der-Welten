"use client";

import { uebersetzeLineupFehler, uebersetzeLineupFehlerListe } from "@/lib/lineups/lineup-fehlertexte";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type ReactNode } from "react";

import type { LegacyLineupFocusV2BoardProps } from "@/lib/lineups/legacy-lineup-board-props";
import type { LineupRosterShortfall } from "@/lib/lineups/lineup-roster-shortfall";
import FoundationPlayerPortraitPreview from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import { getPlayerPortraitInitials } from "@/lib/data/mediaAssets";
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
import { getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
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

/**
 * Formkarten-Direktzuweisung pro Diszi (Feature): der Client liefert je Seite die
 * bereits gefilterten/formatierten Kartenoptionen (primär/sekundär) plus die aktuelle
 * Auswahl. Die Einsatzliste rendert daraus zwei kompakte Dropdowns und ruft
 * `onAssignDisciplineFormCard` — die Persistenz (Formplan + Modifier-Sync) liegt beim Client.
 */
type NlFormCardAreaColor = "red" | "green" | "blue" | "yellow";
type NlFormCardChoice = { id: string; label: string; color?: NlFormCardAreaColor | null };

// Bereichs-Farben der Formkarten-Optionen (POW=rot, SPE=grün, MEN=blau, SOC=gelb).
// Gleiche Hex-Werte wie `.legacy-lineup-form-card-option.is-*` in globals.css, damit
// die farbige Punkte-Anzeige im Dropdown und in der Legacy-Ansicht konsistent bleibt.
const NL_FORM_CARD_AREA_HEX: Record<NlFormCardAreaColor, string> = {
  red: "#ff8b86",
  green: "#a8e7aa",
  blue: "#a9ccff",
  yellow: "#ffd987",
};
type NlDisciplineFormCardControl = {
  disciplineId: string | null;
  colorLabel: string | null;
  primarySelectedId: string | null;
  secondarySelectedId: string | null;
  primaryOptions: NlFormCardChoice[];
  secondaryOptions: NlFormCardChoice[];
};

/**
 * Team-Power-Auswahl je Disziplin. Der Client liefert die bereits gefilterte,
 * sortierte und beschriftete Optionsliste (Effekt · Bereich · Prozent · Fit ·
 * Ladungen · Quelle) sowie eine Kurzfassung der aktuellen Auswahl — die
 * Einsatzliste rendert daraus nur noch das Dropdown und meldet die Wahl über
 * `onAssignTeamPower` zurück. Eine Power kann pro Spieltag nur EINMAL gesetzt
 * werden; die Sperre der bereits in der anderen Diszi belegten Power steckt
 * schon in der gelieferten Optionsliste.
 */
type NlTeamPowerChoice = { id: string; label: string; isDebuff: boolean; isOffFit: boolean };
type NlDisciplineTeamPowerControl = {
  disciplineId: string | null;
  selectedId: string | null;
  options: NlTeamPowerChoice[];
  /** Beschriftung der Leer-Option — nennt bei leerer Liste auch den Grund. */
  emptyLabel: string;
  /** Tooltip des Selects (Quelle + Grund, bei Read-Only zusätzlich die Sperre). */
  title: string;
  /** Kurzfassung der gewählten Power (Wirkung · Fit · Ladungen), sonst `null`. */
  selectedSummary: string | null;
  sourceLabel: string | null;
};

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
   * Kader kleiner als die Plätze dieses Spieltags (null = alles deckbar). Ohne diesen
   * Hinweis lief die Kandidatenliste irgendwann leer und sagte nur "Keine Kandidaten" —
   * gemeldet als "spieler können nichtmehr in disziplinen eingesetzt werden".
   */
  rosterShortfall?: LineupRosterShortfall | null;
  /**
   * Letztes Preview-Ergebnis des Clients (derselbe Feed, den die klassische
   * Einsatzliste für ihren Scoreboard-Reveal nutzt). Treibt die Resolve-Show —
   * null/nicht-ok => Show wird gar nicht angeboten (progressive Enhancement).
   */
  resolvePreview: LegacyLineupPreviewResult | null;
  /**
   * Formkarten-Direktzuweisung je Diszi (optional, additiv). Ist die Prop gesetzt,
   * zeigt jede Disziplin zwei Dropdowns (primäre/sekundäre Formkarte). Fehlt sie
   * (z. B. Read-Only-Kontexte ohne Formkarten), bleibt die Ansicht unverändert.
   */
  formCardControlsBySide?: { d1: NlDisciplineFormCardControl; d2: NlDisciplineFormCardControl } | null;
  onAssignDisciplineFormCard?: (
    side: "d1" | "d2",
    slot: "primary" | "secondary",
    cardId: string | null,
    disciplineId: string | null,
  ) => void;
  /** Pro Seite: läuft gerade ein Formplan-Save (Dropdowns kurz deaktivieren). */
  formCardSavePendingSide?: { d1: boolean; d2: boolean } | null;
  /**
   * Team-Power-Auswahl je Diszi (optional, additiv). Fehlt die Prop, bleibt die
   * Ansicht unverändert — dieselbe Konvention wie bei den Formkarten.
   */
  teamPowerControlsBySide?: { d1: NlDisciplineTeamPowerControl; d2: NlDisciplineTeamPowerControl } | null;
  onAssignTeamPower?: (side: "d1" | "d2", powerId: string | null) => void;
  /**
   * Bandbreite (low/high) der Disziplin-Projektion je Intensitätsstufe — passend
   * zu den Punktwerten aus `disciplineTacticPreviewBySide`. Quelle: dieselbe
   * Projektionsfunktion, aufsummiert über die Slots der Seite (s. Client-Memo
   * `focusV2DisciplineTacticRangeBySide`). Fehlt die Prop, zeigt der Header nur
   * die Punktwerte wie bisher.
   */
  disciplineTacticRangeBySide?: Record<
    "d1" | "d2",
    Record<MatchdayIntensityStage, { low: number; high: number } | null>
  > | null;
  /**
   * Zusatzfelder derselben Preview-Karte, die der Board-Typ nicht listet: die
   * bereits im Client berechneten Disziplin-Summen (Punkt + Bandbreite). Werden
   * per Intersection ergänzt, damit das HUD die erwarteten Punkte je Disziplin
   * ausweisen kann, ohne den v2-Board-Vertrag zu ändern.
   */
  matchdayPreviewCards: {
    d1Projected: number | null;
    d2Projected: number | null;
    d1RangeLow: number | null;
    d1RangeHigh: number | null;
    d2RangeLow: number | null;
    d2RangeHigh: number | null;
  };
};

/* --- Format-Helfer (lokal, präsentational) --------------------------- */

function formatScore(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNullableScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return formatScore(value);
}

function formatSignedScore(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  // formatNlNumber liefert de-DE ("-35,8"); Plus für Positive vorne dran.
  return `${value > 0 ? "+" : ""}${formatNlNumber(value, digits)}`;
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
  const initials = getPlayerPortraitInitials(name);
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
      portraitInitials={getPlayerPortraitInitials(player.name)}
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

/**
 * Obergrenze der Risiko-Meter-Skala: das Maximum, das das Modell ueberhaupt hergibt
 * (Risiko bei Fatigue 100). Aus der ECHTEN Kurve abgeleitet statt hart codiert, damit
 * eine Rebalancierung der Anker die Skala automatisch mitzieht.
 */
const MAX_MATCHDAY_INJURY_RISK_PERCENT = getInjuryRiskPercent(100);

/**
 * Ton fuer das Einsatz-Verletzungsrisiko eines aufgestellten Spielers, abgeleitet aus dem
 * Band des ECHTEN Modells (`bandLabel` aus projectMatchdayInjuryRisk) statt aus eigenen
 * Prozent-Schwellen — sonst haette die Anzeige eine zweite, driftende Risikoskala.
 * none/minimal bleiben ohne Farbton: das Risiko wird trotzdem IMMER angezeigt (nie 0 %,
 * Feature-Request "Ruhetag davor und trotzdem verletzt"), soll unauffaellig aber sichtbar sein.
 */
function getNlInjuryProjectionTone(bandLabel: string): NlTone {
  if (bandLabel === "sehr_stark" || bandLabel === "stark") return "risk";
  if (bandLabel === "mittel") return "warn";
  return "neutral";
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
      {/* Ohne Titelzeile: "Resolve-Show · Projektion deiner Einsatzliste / So löst dein
          Spieltag auf — Slot für Slot" beschrieb nur, was die Show darunter ohnehin zeigt,
          und kostete eine ganze Zeile. Die Bedienelemente bleiben — ohne sie waere die Show
          nicht mehr abspielbar. `aria-label` der Section traegt den Namen weiterhin. */}
      <header className="nl-lineup-show-head">
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
  disciplineTacticRangeBySide,
  recentlyAssignedSlotKey,
  undoInfo,
  onUndo,
  statusMessage,
  errors,
  rosterShortfall = null,
  resolvePreview,
  formCardControlsBySide,
  onAssignDisciplineFormCard,
  formCardSavePendingSide,
  teamPowerControlsBySide,
  onAssignTeamPower,
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

  /**
   * „Die Aufstellung ist gesperrt" ist ein ZUSTAND, kein Fehler: der Spieltag laeuft, die Liste
   * ist abgegeben, es gibt nichts zu reparieren. Sie gehoert deshalb in die neutrale Statuszeile
   * und nicht in die rote Fehlerzeile — dort stand sie zuletzt direkt ueber dem gelben Hinweis
   * „Du kannst so speichern und in die Arena" und widersprach ihm.
   */
  const { blockingErrors, lockedNotice } = useMemo(() => {
    const locked = errors.find((code) => code === "lineup_draft_is_locked") ?? null;
    return {
      blockingErrors: errors.filter((code) => code !== "lineup_draft_is_locked"),
      lockedNotice: locked,
    };
  }, [errors]);

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

  /**
   * WER GERADE AM HAKEN HÄNGT — und was ER in jedem Slot brächte.
   *
   * GEMELDET VON CHRIS: „wenn ich einen spieler in der einsatzliste per drag and drop irgendwo rein
   * ziehen will, müsste während des drags seine stats pro slot kommen, aktuell wird immernoch nur
   * der beste spieler angezeigt."
   *
   * Genau so war es: die offenen Slots zeigten unverändert ihren „Best Fit" — den Vorschlag der
   * Liste, nicht den Spieler in der Hand. Wer jemanden über das Feld zog, sah überall die Zahlen
   * eines ANDEREN und musste raten, wo der eigene Griff etwas taugt.
   *
   * Die Zahlen dafür liegen längst vor: `playerBestSlotSummaryByActivePlayerId` rechnet jeden
   * Spieler gegen JEDEN Slot (`lineup-candidate-model.ts`, volle Rangliste, nicht nur die Spitze)
   * — inklusive `projectedDelta` gegen den Stand, der im Slot gerade projiziert ist. Hier wird
   * nichts neu gerechnet, nur nachgeschlagen.
   *
   * Beide Griffe zählen: aus dem Kader (`dragCandidateId`) und aus einem belegten Slot heraus
   * (`dragSourceSlotKey` → der Spieler, der dort steht). Der Umzug innerhalb des Feldes ist genau
   * die Frage „wo steht er besser".
   */
  const dragPlayerId = dragCandidateId ?? (dragSourceSlotKey ? selections[dragSourceSlotKey] ?? null : null);
  const dragPlayerName = dragPlayerId ? rosterCardByActivePlayerId.get(dragPlayerId)?.name ?? null : null;
  const dragSlotFitByKey = useMemo(() => {
    if (!dragPlayerId) return new Map<string, NlBestSlotEntry>();
    return new Map(
      (playerBestSlotSummaryByActivePlayerId.get(dragPlayerId) ?? []).map((entry) => [entry.slotKey, entry] as const),
    );
  }, [dragPlayerId, playerBestSlotSummaryByActivePlayerId]);

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

  // Captain-Infos je Disziplin-Seite. Frueher war hier nur die AKTIVE Slot-Seite aufgeloest
  // — der Picker sass in der Fokus-Rail und wechselte seine Bedeutung, je nachdem welcher
  // Slot gerade fokussiert war. Jetzt bekommt jeder Disziplin-Block seinen eigenen Picker,
  // was der Regel entspricht: ein Captain PRO Disziplin-Seite.
  const captainInfoByIdBySide = useMemo(
    () => ({
      d1: new Map(captainInfoBySide.d1.map((info) => [info.activePlayerId, info] as const)),
      d2: new Map(captainInfoBySide.d2.map((info) => [info.activePlayerId, info] as const)),
    }),
    [captainInfoBySide],
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
    /**
     * KEIN EWIGES SKELETT.
     *
     * GEMELDET VON CHRIS (mit Bild): die Einsatzliste laedt „einfach minutenlang". Zu sehen waren
     * vier graue Balken — genau dieser Block. Sein Ladehinweis ist `sr-only`, also unsichtbar; auf
     * dem Schirm stand nichts, was den Zustand erklaert haette.
     *
     * Ursache war nicht die Ladezeit: Die Route antwortet mit HTTP 200 und `context: null`, wenn
     * der Spieltags-Kontext nicht gebaut werden kann (siehe `lab-context/route.ts` — dort steht
     * `context: contextResult.ok ? contextResult.context : null`). Das Laden war also laengst
     * fertig, es gab nur nichts zu zeigen. Der Block hier fragte aber allein `!context` ab und
     * zeigte deshalb bis in alle Ewigkeit „laedt".
     *
     * `isBusy` unterscheidet die beiden Faelle: laeuft die Anfrage noch, ist das Skelett richtig.
     * Ist sie durch und der Kontext trotzdem leer, gehoert der GRUND auf den Schirm — sonst sucht
     * der Spieler den Fehler bei seiner Leitung.
     */
    if (isBusy) {
      return (
        <div className="nl-lineup-root" data-testid="lineup-new-look">
          <div className="nl-lineup-loading" role="status" aria-busy="true">
            <span className="sr-only">Spieltag-Kontext wird geladen…</span>
            <NlSkeletonCard lines={4} />
          </div>
        </div>
      );
    }

    return (
      <div className="nl-lineup-root" data-testid="lineup-new-look">
        <div className="nl-lineup-empty" role="alert" data-testid="lineup-context-unavailable">
          <p className="nl-lineup-empty__title">Die Einsatzliste liess sich fuer diesen Spieltag nicht aufbauen.</p>
          {errors.length > 0 ? (
            <ul className="nl-lineup-empty__reasons">
              {uebersetzeLineupFehlerListe(errors).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="nl-lineup-empty__hint">
              Es kam eine Antwort, aber kein Spieltags-Kontext — und kein Grund dazu. Bitte die Seite neu laden;
              bleibt es dabei, ist das ein Fehler und gehoert gemeldet.
            </p>
          )}
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
    const tacticRange = disciplineTacticRangeBySide?.[disciplineSide] ?? null;
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
              {(["conserve", "normal", "push"] as const).map((stage) => {
                // Bandbreite je Stufe (dauerhaft sichtbar, nicht nur im Tooltip):
                // low/high kommen aus derselben Projektionsfunktion wie der Punktwert,
                // aufsummiert über die Slots dieser Seite (s. Client-Memo
                // `focusV2DisciplineTacticRangeBySide`). Ohne Daten bleibt die Zeile weg.
                const stageRange = tacticRange?.[stage] ?? null;
                const rangeLabel = stageRange ? `${formatNlNumber(stageRange.low, 0)}–${formatNlNumber(stageRange.high, 0)}` : null;
                return (
                  <button
                    key={`${disciplineSide}-${stage}`}
                    type="button"
                    className={intensity === stage ? "is-selected" : ""}
                    aria-pressed={intensity === stage}
                    disabled={isReadOnly || isBusy}
                    onClick={() => onUpdateDisciplineIntensity(disciplineSide, stage)}
                    // Spalten-Layout: Zeile 1 = Label + Punktwert (wie bisher),
                    // Zeile 2 = kompakte Bandbreite. Inline, damit globals.css unberührt bleibt.
                    style={{ flexDirection: "column", alignItems: "center", gap: "1px", lineHeight: 1.15 }}
                    title={
                      tacticPreview
                        ? `${formatIntensityLabel(stage)} · projiziert ${formatNullableScore(tacticPreview[stage])}${
                            stageRange
                              ? ` · Bandbreite ${formatNullableScore(stageRange.low)} bis ${formatNullableScore(stageRange.high)}`
                              : ""
                          }`
                        : formatIntensityLabel(stage)
                    }
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {formatIntensityLabel(stage)}
                      {tacticPreview && tacticPreview[stage] != null ? (
                        <em className="nl-tnum">{formatNullableScore(tacticPreview[stage])}</em>
                      ) : null}
                    </span>
                    {rangeLabel ? (
                      <em
                        className="nl-tnum"
                        style={{ fontStyle: "normal", fontSize: "9px", fontWeight: 600, color: "var(--nl-mut-2)", opacity: 1 }}
                      >
                        {rangeLabel}
                      </em>
                    ) : null}
                  </button>
                );
              })}
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
                  <strong className="nl-tnum" style={{ color: "var(--nl-accent-text, var(--nl-accent))" }}>
                    #{rival.rank}
                  </strong>
                  {/* S6/L4 (Audit Spieltag): 9ch schnitt praktisch jeden Teamnamen ab
                      (Median 14, Maximum 21 Zeichen) — "Wicked ..." ohne sichtbaren
                      Rest. 15ch deckt die meisten Namen vollständig; die Ellipse bleibt
                      als Sicherheitsnetz für die wenigen Ausreißer, der volle Name steht
                      ohnehin im Tooltip der Pille. */}
                  <span style={{ maxWidth: "15ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rival.teamName}</span>
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

        {(() => {
          // Formkarten-Direktzuweisung (Feature): zwei Dropdowns je Diszi (primär/sekundär).
          // Nur zeigen, wenn es tatsächlich etwas auszuwählen/anzuzeigen gibt, sonst kein Clutter.
          const control = formCardControlsBySide?.[disciplineSide] ?? null;
          if (!control) return null;
          // Frueher verschwand der ganze Block, sobald es nichts mehr auszuwaehlen gab
          // ("sonst kein Clutter"). Am Saisonende — wenn alle Karten verbraucht sind — sah
          // das aus, als sei das Formkarten-Feature kaputt: die Slots waren einfach nicht
          // mehr da, ohne jede Erklaerung. Genau so ist es gemeldet worden.
          //
          // Der Block bleibt jetzt stehen und sagt, WARUM nichts zu waehlen ist. Ein leeres
          // Feld mit Begruendung ist eine Information; ein fehlendes Feld ist ein Raetsel.
          const hasAnything =
            control.primaryOptions.length > 0 ||
            control.secondaryOptions.length > 0 ||
            control.primarySelectedId != null ||
            control.secondarySelectedId != null;
          const pending = formCardSavePendingSide?.[disciplineSide] ?? false;
          const disabled = isReadOnly || isBusy || pending;
          const renderFormCardSelect = (
            slot: "primary" | "secondary",
            label: string,
            selectedId: string | null,
            options: NlFormCardChoice[],
          ) => (
            <label
              style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1 1 160px", minWidth: 0 }}
            >
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em", color: "var(--nl-mut)", textTransform: "uppercase" }}>
                {label}
              </span>
              <select
                className="input"
                style={{ fontSize: "12px", padding: "4px 6px" }}
                value={selectedId ?? ""}
                disabled={disabled}
                aria-label={`${disciplineSide.toUpperCase()} ${label} Formkarte`}
                onChange={(event) =>
                  onAssignDisciplineFormCard?.(disciplineSide, slot, event.target.value || null, control.disciplineId)
                }
              >
                <option value="">— keine —</option>
                {options.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    // Punkte-Zeile etwas größer + in der Bereichsfarbe (MEN=blau usw.),
                    // damit der Wert im Dropdown sofort ins Auge fällt. Native <option>
                    // erlaubt nur ganze-Zeile-Styling — Chrome/Firefox rendern es im
                    // Popup, Safari ignoriert es und fällt sauber auf Default zurück.
                    style={
                      option.color
                        ? { color: NL_FORM_CARD_AREA_HEX[option.color], fontSize: "13px", fontWeight: 700 }
                        : undefined
                    }
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
          return (
            <div
              className="nl-lineup-formcards"
              data-testid={`nl-lineup-formcards-${disciplineSide}`}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "8px",
                margin: "0 0 8px",
                padding: "8px 10px",
                borderRadius: "var(--nl-r-card, 10px)",
                border: "1px solid var(--nl-line)",
                background: "var(--nl-panel-2)",
              }}
            >
              <span
                style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--nl-ink)", flex: "1 1 100%" }}
              >
                Formkarten{control.colorLabel ? ` · Diszi-Farbe ${control.colorLabel}` : ""}
                {pending ? <em style={{ fontStyle: "normal", color: "var(--nl-mut)", fontWeight: 600 }}> · speichert…</em> : null}
              </span>
              {hasAnything ? (
                <>
                  {renderFormCardSelect("primary", "Primär", control.primarySelectedId, control.primaryOptions)}
                  {renderFormCardSelect("secondary", "Sekundär (+)", control.secondarySelectedId, control.secondaryOptions)}
                </>
              ) : (
                <span
                  style={{ fontSize: "11.5px", color: "var(--nl-mut)", flex: "1 1 100%" }}
                  title="Formkarten werden pro Saison vergeben und sind mit dem Ausspielen verbraucht."
                >
                  Keine Formkarte mehr verfügbar — alle Karten dieser Saison sind gespielt.
                </span>
              )}
            </div>
          );
        })()}

        {(() => {
          // Team-Power DIESER Disziplin. Fehlte in der Einsatzliste komplett — die
          // Optionen wurden im Client zwar weiter abgeleitet, aber von keiner Ansicht
          // gerendert, sodass man pro Spieltag gar keine Power mehr setzen konnte.
          // Bewusst direkt unter den Formkarten und über dem Captain: alle drei
          // Spieltag-Ressourcen einer Disziplin stehen damit als Block beieinander.
          const control = teamPowerControlsBySide?.[disciplineSide] ?? null;
          if (!control) return null;
          // Nichts zu wählen UND nichts gesetzt → kein leerer Kasten. Der Grund
          // ("alle verbraucht", "Quelle fehlt", …) steckt in `emptyLabel` und wird
          // nur gezeigt, solange es überhaupt Powers geben könnte.
          if (control.options.length === 0 && !control.selectedId) return null;
          const disabled = isReadOnly || isBusy;
          const sideLabel = disciplineSide.toUpperCase();
          return (
            <div
              className="nl-lineup-teampower"
              data-testid={`nl-lineup-teampower-${disciplineSide}`}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "8px",
                margin: "0 0 8px",
                padding: "8px 10px",
                borderRadius: "var(--nl-r-card, 10px)",
                border: "1px solid var(--nl-line)",
                background: "var(--nl-panel-2)",
              }}
            >
              <span
                style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--nl-ink)", flex: "1 1 100%" }}
              >
                Team-Power · {sideLabel}
                {control.sourceLabel ? (
                  <em style={{ fontStyle: "normal", color: "var(--nl-mut)", fontWeight: 600 }}> · {control.sourceLabel}</em>
                ) : null}
              </span>
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1 1 100%", minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    color: "var(--nl-mut)",
                    textTransform: "uppercase",
                  }}
                >
                  Power einsetzen
                </span>
                <select
                  className="input"
                  style={{ fontSize: "12px", padding: "4px 6px" }}
                  value={control.selectedId ?? ""}
                  disabled={disabled}
                  title={control.title}
                  aria-label={`${sideLabel} Team-Power wählen`}
                  onChange={(event) => onAssignTeamPower?.(disciplineSide, event.target.value || null)}
                >
                  <option value="">— {control.emptyLabel} —</option>
                  {control.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {control.selectedSummary ? (
                <span
                  style={{ fontSize: "11px", fontWeight: 600, color: "var(--nl-mut)", flex: "1 1 100%" }}
                  title="Projizierte Wirkung der gewählten Power auf diese Disziplin."
                >
                  {control.selectedSummary}
                </span>
              ) : null}
            </div>
          );
        })()}

        {/* Captain DIESER Disziplin. Jede Seite hat ihren eigenen Picker — die Regel erlaubt
            genau einen Captain je Disziplin-Seite. Vorher gab es nur EINEN Picker in der
            Fokus-Rail, der der aktiven Slot-Seite folgte: man sah nicht, fuer welche
            Disziplin man gerade setzt, und er wirkte wie ein globaler Schalter. */}
        {(() => {
          const sideCaptainEntries = captainSelectEntriesBySide[disciplineSide] ?? [];
          if (sideCaptainEntries.length === 0) return null;
          const infoById = captainInfoByIdBySide[disciplineSide];
          const selectedId = captains[disciplineSide] ?? "";
          const sideLabel = disciplineSide.toUpperCase();
          return (
            <div
              className="nl-lineup-captain nl-lineup-captain-side"
              data-testid={`nl-lineup-captain-${disciplineSide}`}
              style={{
                margin: "0 0 8px",
                padding: "8px 10px",
                borderRadius: "var(--nl-r-card, 10px)",
                border: "1px solid var(--nl-line)",
                background: "var(--nl-panel-2)",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--nl-ink)" }}>
                Captain · {sideLabel}
                <em style={{ fontStyle: "normal", color: "var(--nl-mut)", fontWeight: 600 }}>
                  {" "}· {captainDraftRemaining} frei heute · {captainSeasonUsedWithDraft}/{captainSeasonLimit} Saison
                </em>
              </span>
              <div
                role="group"
                aria-label={`Captain ${sideLabel} wählen`}
                style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}
              >
                <button
                  type="button"
                  aria-pressed={!selectedId}
                  disabled={isReadOnly || isBusy}
                  onClick={() => onUpdateCaptain(disciplineSide, "")}
                  style={captainChipStyle(!selectedId)}
                >
                  Kein Captain
                </button>
                {sideCaptainEntries.map((entry) => {
                  const info = infoById.get(entry.activePlayerId);
                  const isSelected = selectedId === entry.activePlayerId;
                  return (
                    <button
                      key={entry.activePlayerId}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={isReadOnly || isBusy}
                      onClick={() => onUpdateCaptain(disciplineSide, entry.activePlayerId)}
                      title={`${entry.name} als Captain ${sideLabel} setzen`}
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
          );
        })()}

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
            const selectedMeta = selectedId ? getSelectedOptionMeta(selectedId) : null;
            const fatigue = selectedMeta?.fatigueCount ?? null;
            // Der Einsatz-Verletzungsrisiko-Wurf steht schon hier — und er traegt die ECHTE
            // Spieltagslast. Deshalb wird er zuerst geholt: die Nach-Spieltag-Belastung darunter
            // liest ihn mit.
            const injuryProjectionForSlot =
              selectedMeta?.injuryRiskProjection?.[getDisciplineIntensity(slot.disciplineSide)] ?? null;
            /**
             * NACH-SPIELTAG-BELASTUNG — jetzt aus dem Modell, das auch bucht.
             *
             * HIER STAND `fatigue + projected.additionalFatigue`. `additionalFatigue` ist aber
             * eine ANZEIGEGROESSE und bei 5 / 8 / 11 gedeckelt
             * (`INTENSITY_CONFIG.additionalFatigueCap`, matchday-slot-roles.ts:91-93), waehrend
             * real `MATCHDAY_FATIGUE_LOAD x Trait x Intensitaet` = 12 / 16 / 22,4 gebucht wird
             * (fatigue-injury-service.ts:147, :202). Die Einsatzliste zeigte einen Einsatz also
             * rund HALB so teuer, wie er ist — und das ausgerechnet an der Stelle, an der man
             * entscheidet, wen man noch einmal aufstellt.
             *
             * `fatigueBeforeRoll` ist genau die Zahl, gegen die das Spiel den Verletzungswurf
             * macht: aktuelle Ermuedung plus echte Spieltagslast. Damit zeigen Belastung und
             * Risiko dieselbe Grundlage, statt zwei verschiedene.
             *
             * Der alte Weg bleibt als Rueckfall, wenn keine Projektion vorliegt (synthetische
             * Kontexte, alte Spielstaende) — dort ist eine zu niedrige Zahl immer noch besser als
             * gar keine.
             */
            const aftermathFatigue =
              injuryProjectionForSlot?.fatigueBeforeRoll ??
              (fatigue != null ? fatigue + (preview?.projected.additionalFatigue ?? 0) : null);
            const aftermathHigh = aftermathFatigue != null && aftermathFatigue >= FATIGUE_HIGH;
            // Einsatz-Verletzungsrisiko (Feature-Request "man sieht nicht, wer Verletzungs-
            // potential hat — in der Arena isses zu spaet"): vorberechnet aus dem ECHTEN
            // Wurf-Modell (Fatigue + Spieltags-Last, traits- und intensitaetsskaliert),
            // hier nur noch per aktueller Seiten-Intensitaet nachgeschlagen. Wird fuer JEDEN
            // aufgestellten Spieler gezeigt, auch ausgeruht (~2 %): das Restrisiko ist Teil
            // des Modells und soll nicht mehr wie ein Bug wirken, wenn es zuschlaegt.
            const injuryProjection = injuryProjectionForSlot;

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
                      // S6/L2 (Audit Spieltag): vorher lief JEDES Slot-Issue hart auf
                      // `is-risk` (rot) — unabhängig vom eigentlichen `issue.tone` aus
                      // `buildSlotIssuesByKey`. Ergebnis: der Normalzustand "Slot noch
                      // offen" (9× pro Spieltag) sah aus wie ein Fehler, genau wie ein
                      // echter Blocker (Doppelwahl, verletzter Spieler). Jetzt folgt die
                      // Farbe dem Ton: "blocked" bleibt rot (echte Blocker + der aktive
                      // "Hier weiter"-Slot), "warning" wird gelb-warn — außer beim leeren,
                      // nicht-aktiven Slot ("Offen") selbst: der ist der Normalfall vor
                      // dem Ausfüllen und bleibt bewusst ohne Alarmfarbe.
                      <span
                        className={`nl-lineup-chip${
                          issue.tone === "blocked" ? " is-risk" : !player && issue.tone === "warning" ? "" : " is-warn"
                        }`}
                        title={issue.detail}
                      >
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

                {/* Einsatz-Verletzungsrisiko als METER, nicht als blosser Text: das Risiko
                    ist eine kontinuierliche Groesse pro Spieler — die Fuell-LAENGE macht die
                    Slots auf einen Blick vergleichbar (der riskanteste faellt sofort auf),
                    ohne Zahlen lesen zu muessen; Farbton allein waere fuer Farbfehlsichtige
                    unbrauchbar. Der exakte Prozentwert steht rechts daneben — es ist genau
                    die Zahl, gegen die der Spieltag wuerfelt (aktuelle Fatigue + Einsatz-Last),
                    nicht das Risiko der aktuellen Fatigue (das unterschlug die Last und
                    zeigte Ausgeruhten 0 %). Gleiches Kit-Primitive wie ueberall im Neuen
                    Look (NlProgressBar), Ton aus den Risiko-Baendern des Modells. Die Skala
                    endet beim Modell-Maximum (Risiko bei Fatigue 100), damit die volle
                    Track-Laenge "schlimmster moeglicher Fall" bedeutet — auf einer
                    0-100-%-Skala waere selbst Hoechstrisiko ein unlesbarer Splitter.
                    Immer sichtbar, sobald ein Spieler im Slot steht: auch die ~2 %
                    Restrisiko eines Ausgeruhten sind Teil des Modells und sollen nicht
                    mehr wie ein Bug wirken, wenn sie zuschlagen. */}
                {player && injuryProjection ? (
                  <NlProgressBar
                    className="nl-lineup-injury-meter"
                    // Die Fatigue-Wanderung gehoert SICHTBAR ins Etikett, nicht in den Tooltip.
                    // Vorher stand hier nur "Verl.-Risiko", waehrend die Karte daneben die
                    // AKTUELLE Fatigue zeigte und der Prozentwert auf der Fatigue NACH dem
                    // Einsatz beruhte. Gemeldet als "das Verletzungsrisiko kommt mir seltsam
                    // hoch vor — bis 25 soll doch 0 sein": bei angezeigter Fatigue 22 standen
                    // 4,2 %, weil der Wurf real bei 36 faellt. Es gibt nur EINE Fatigue (der
                    // Wert wird nach dem Spieltag genau so gespeichert, siehe
                    // fatigue-injury-service.ts, `fatigue: fatigueBeforeRoll`) — aber wer nur
                    // "22" und "4,2 %" nebeneinander sieht, muss die Schutzzone fuer kaputt
                    // halten. Im Tooltip stand es bereits; ein Tooltip beantwortet die Frage
                    // nur dem, der sie schon hat.
                    label={`Verl.-Risiko · F ${formatNlNumber(fatigue ?? 0, 0)}→${formatNlNumber(injuryProjection.fatigueBeforeRoll, 0)}`}
                    value={injuryProjection.riskPercent}
                    max={MAX_MATCHDAY_INJURY_RISK_PERCENT}
                    tone={getNlInjuryProjectionTone(injuryProjection.bandLabel)}
                    format={(current) => `${formatNlNumber(current, 1)} %`}
                    title={`Verletzungsrisiko dieses Einsatzes: ${formatNlNumber(injuryProjection.riskPercent, 1)} % — gewürfelt bei Fatigue ${formatNlNumber(injuryProjection.fatigueBeforeRoll, 0)} (aktuell ${formatNlNumber(fatigue ?? 0, 0)} + Einsatz-Last ${formatNlNumber(injuryProjection.matchdayLoad, 0)}). Skala bis ${formatNlNumber(MAX_MATCHDAY_INJURY_RISK_PERCENT, 0)} % (Modell-Maximum bei Fatigue 100). Ein Restrisiko besteht bei jedem Einsatz, 0 % gibt es nicht. Verletzungen entstehen nur so — nicht durch Gegner.`}
                  />
                ) : null}

                {/* WÄHREND DES ZIEHENS GILT DER SPIELER IN DER HAND, nicht der Vorschlag der
                    Liste. Die Zeile steht auch auf BELEGTEN Slots — dort ist sie die Antwort auf
                    „lohnt der Tausch?" und trägt deshalb das Delta gegen den, der gerade drin
                    steht. Ohne Wert (keine Basis in dieser Disziplin) sagt sie das ausdrücklich,
                    statt eine Lücke zu lassen, die wie ein Ladefehler aussieht. */}
                {dragPlayerId ? (
                  (() => {
                    const dragFit = dragSlotFitByKey.get(slot.key) ?? null;
                    const dragDelta = player ? dragFit?.projectedDelta ?? null : null;
                    return (
                      <div
                        className={`nl-lineup-bestfit nl-lineup-dragfit${dragFit ? "" : " is-empty"}`}
                        title={
                          dragFit
                            ? `${dragPlayerName ?? "Spieler"} in ${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1}: ${dragFit.fitSummary}`
                            : `${dragPlayerName ?? "Spieler"} hat für diese Disziplin keinen Wert.`
                        }
                      >
                        <small>Zieht</small>
                        <strong>{dragPlayerName ?? "—"}</strong>
                        <em className="nl-tnum">
                          {formatNullableScore(dragFit?.projectedScore ?? null)}
                          {dragDelta != null ? (
                            <span className={dragDelta >= 0 ? "text-positive" : "text-negative"}>
                              {` (${formatSignedScore(dragDelta, 1)})`}
                            </span>
                          ) : null}
                        </em>
                      </div>
                    );
                  })()
                ) : !player && topCandidate ? (
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
          {/* Aufschlüsselung der erwarteten Punkte: zusätzlich zum Gesamtwert jede
              Disziplin einzeln, jeweils mit Namen und derselben low–high-Bandbreite
              (matchdayPreviewCards.dNRangeLow/High — dieselben Summen, aus denen sich
              totalRangeLow/High zusammensetzt). Rein additiv, der Gesamtwert bleibt. */}
          {(["d1", "d2"] as const).map((side) => {
            const sideName = disciplineBySide[side]?.displayName ?? (side === "d1" ? "Disziplin 1" : "Disziplin 2");
            const sideLow = side === "d1" ? matchdayPreviewCards.d1RangeLow : matchdayPreviewCards.d2RangeLow;
            const sideHigh = side === "d1" ? matchdayPreviewCards.d1RangeHigh : matchdayPreviewCards.d2RangeHigh;
            const sidePoint = side === "d1" ? matchdayPreviewCards.d1Projected : matchdayPreviewCards.d2Projected;
            return (
              <div
                key={`nl-lineup-hud-metric-${side}`}
                className="nl-lineup-hud-metric"
                data-testid={`nl-lineup-hud-metric-${side}`}
                title={`${side.toUpperCase()} ${sideName}: erwartet ${formatNullableScore(sidePoint)} Punkte · Bandbreite ${formatProjectedMetricWindow(sideLow, sideHigh)}`}
              >
                <small>
                  {side.toUpperCase()} · {sideName}
                </small>
                <strong className="nl-tnum">{formatProjectedMetricWindow(sideLow, sideHigh)}</strong>
              </div>
            );
          })}
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
              Schwellen (≥40 warn, ≥65 risk).
              S6/L4 (Audit Spieltag): das "−" kam bisher fest vor die Zahl, auch bei
              0 (leere Einsatzliste) — sichtbares "−0" statt einer echten Null. Das
              Minus ist nur bei einer echten Kosten-Summe > 0 eine Aussage. */}
          <StatChip
            label="Fatigue-Kosten"
            value={
              matchdayPreviewCards.totalFatigue > 0
                ? `−${formatNlNumber(matchdayPreviewCards.totalFatigue, 1)}`
                : formatNlNumber(matchdayPreviewCards.totalFatigue, 1)
            }
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

      {/* GEMELDET VON CHRIS (Screenshot Einsatzliste): hier stand blank `lineup_draft_is_locked`
          — der Rohcode aus dem Aufstellungs-Dienst, rot und als `role="alert"`. Zwei Dinge waren
          daran falsch.

          ERSTENS die Sprache: die Liste gab ihre Fehlerliste ungefiltert aus. Ein technischer
          Bezeichner ist von einem Absturz nicht zu unterscheiden. Sie laeuft jetzt durch
          dieselbe Uebersetzung wie jeder andere Blocker im Spiel.

          ZWEITENS die Einstufung, und das ist der eigentliche Punkt: „gesperrt, weil der Spieltag
          laeuft" ist ein ZUSTAND, kein Fehler — Chris dazu: „ich habe alle spieler eingesetzt die
          ich einsetzen konnte daran duerfte es nicht haken hier an der stelle darf dann kein
          blocker entstehen". Genau so stand es auf dem Schirm: eine rote Fehlerzeile direkt ueber
          dem gelben Hinweis „Du kannst so speichern und in die Arena". Der Zustand steht jetzt in
          der neutralen Statuszeile, nur echte Fehler bleiben rot. */}
      {blockingErrors.length > 0 ? (
        <div className="nl-lineup-status is-error" role="alert">
          {uebersetzeLineupFehlerListe(blockingErrors).join(" · ")}
        </div>
      ) : lockedNotice ? (
        <div className="nl-lineup-status" role="status" data-testid="nl-lineup-locked-notice">
          {uebersetzeLineupFehler(lockedNotice)}
        </div>
      ) : statusMessage ? (
        <div className="nl-lineup-status" role="status">
          {statusMessage}
        </div>
      ) : null}

      {/* Kader kleiner als der Spieltag: der Hinweis MUSS oben stehen, bevor der Manager sich
          wundert, warum ab dem x-ten Slot niemand mehr auswählbar ist. Vorher stand dort nur
          "Keine Kandidaten in dieser Gruppe" — richtig, aber unerklärt. */}
      {rosterShortfall ? (
        <div className="nl-lineup-status is-warn" role="status" data-testid="nl-lineup-roster-shortfall">
          <strong>{rosterShortfall.headline}</strong> {rosterShortfall.detail} {rosterShortfall.hint}
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
            {/* Der Captain-Picker sitzt jetzt IN den Disziplin-Bloecken (renderCaptainPicker),
                nicht mehr hier in der Fokus-Rail. Dort folgte er der aktiven Slot-Seite und
                wirkte dadurch wie EIN globaler Schalter am Rand — obwohl je Disziplin ein
                eigener Captain gesetzt werden kann (perDisciplineSideMaxCaptains = 1). */}
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
                /* Leer heisst nicht kaputt. Ist der Kader zu klein fuer den Spieltag, ist genau
                   DAS der Grund — und der gehoert hierhin, nicht nur in den Hinweis oben. */
                <NlEmptyState
                  title={rosterShortfall ? rosterShortfall.headline : "Keine Kandidaten"}
                  message={
                    rosterShortfall
                      ? `${rosterShortfall.detail} ${rosterShortfall.hint}`
                      : "Keine Kandidaten in dieser Gruppe."
                  }
                />
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
