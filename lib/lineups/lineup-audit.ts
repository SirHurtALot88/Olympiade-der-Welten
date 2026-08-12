// Rechenkern der Bewertungs-/Freigabe-Kette aus der Einsatzliste (vormals reine
// `useMemo`-Koerper in LegacyLineupLabClient.tsx). Reines Verschieben — keine
// Verhaltensaenderung. Die Komponente behaelt duenne `useMemo`-Huellen, die diese
// Funktionen mit denselben Eingaben aufrufen wie vorher.
//
// Warum das lohnt: `lineupMiniAudit` gatet das Speichern. Ein hier verlorenes
// Blocking-Item liesse eine ungueltige Aufstellung in einen Spieltag, der danach
// nicht mehr korrigierbar ist. Als reine Funktion ist genau das jetzt mit einer
// festen Fixture ueber `vitest` (node-Umgebung, kein jsdom) direkt pruefbar. Siehe
// tests/lineup-candidate-model.test.ts.

import type { LegacyLineupLabPlayerOption, LegacyLineupLabSlot } from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyLineupPreviewResult, LegacyLineupScoreResult } from "@/lib/lineups/legacy-lineup-types";
import {
  formatDecimalScore,
  formatFatigueImpactDetail,
  getSelectedOptionMeta,
  isElevatedFatigue,
  type MatchdayRosterCard,
  type MatchdaySlotPreviewCard,
} from "@/lib/lineups/lineup-candidate-model";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type LineupMoraleDecision = {
  playerId: string;
  activePlayerId: string | null;
  playerName: string;
  demandId: string;
  label: string;
  detail: string;
  priority: "low" | "medium" | "high";
  targetDisciplineId: string | null;
  fulfilled: boolean;
  isRelevant: boolean;
  moraleDelta: number;
};

export type LineupSlotIssue = {
  tone: "ready" | "warning" | "blocked";
  label: string;
  detail: string;
};

export type LineupMiniAuditItem = {
  key: string;
  label: string;
  detail: string;
  tone: "ready" | "warning" | "blocked";
};

export type LineupMiniAudit = {
  status: "ready" | "warning" | "blocked";
  items: LineupMiniAuditItem[];
  blockingItems: LineupMiniAuditItem[];
  warningItems: LineupMiniAuditItem[];
};

export type LineupFlowSummary = {
  totalRequired: number;
  selectedCount: number;
  progressPercent: number;
  captainCount: number;
  nextStep: {
    label: string;
    detail: string;
    tone: "ready" | "warning" | "blocked";
  };
};

export type LineupSaveCta = {
  tone: "ready" | "warning" | "blocked";
  label: string;
  detail: string;
  buttonLabel: string;
};

export type MatchdayPreviewCards = {
  d1: LegacyLineupScoreResult | null;
  d2: LegacyLineupScoreResult | null;
  d1RangeLow: number;
  d1RangeHigh: number;
  d2RangeLow: number;
  d2RangeHigh: number;
  totalRangeLow: number;
  totalRangeHigh: number;
  d1Projected: number;
  d2Projected: number;
  d1Fatigue: number;
  d2Fatigue: number;
  d1FatiguePenalty: number;
  d2FatiguePenalty: number;
  totalFatigue: number;
  openSlots: number;
  totalProjected: number;
  totalBase: number;
  riskLevel: "hoch" | "mittel" | "niedrig";
};

// ---------------------------------------------------------------------------
// Der eigentliche Rechenkern — vormals `useMemo`-Koerper in LegacyLineupLabClient.
// ---------------------------------------------------------------------------

/** Vormals `matchdayPreviewCards` (useMemo). */
export function buildMatchdayPreviewCards(input: {
  resolvedPreview: Extract<LegacyLineupPreviewResult, { ok: true }> | null;
  slots: LegacyLineupLabSlot[];
  slotPreviewByKey: Map<string, MatchdaySlotPreviewCard>;
  d1RequiredPlayers: number;
  d2RequiredPlayers: number;
  lineupMetaD1Selected: number;
  lineupMetaD2Selected: number;
}): MatchdayPreviewCards {
  const { resolvedPreview, slots, slotPreviewByKey, d1RequiredPlayers, d2RequiredPlayers, lineupMetaD1Selected, lineupMetaD2Selected } = input;

  const bySide = {
    d1: resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d1") ?? null,
    d2: resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d2") ?? null,
  };
  const d1SlotPreviews = slots
    .filter((slot) => slot.disciplineSide === "d1")
    .map((slot) => slotPreviewByKey.get(slot.key))
    .filter((entry): entry is MatchdaySlotPreviewCard => Boolean(entry));
  const d2SlotPreviews = slots
    .filter((slot) => slot.disciplineSide === "d2")
    .map((slot) => slotPreviewByKey.get(slot.key))
    .filter((entry): entry is MatchdaySlotPreviewCard => Boolean(entry));
  const sumProjected = (entries: MatchdaySlotPreviewCard[]) =>
    entries.reduce((sum, entry) => sum + (entry.projected.totalProjected ?? 0), 0);
  const sumFatigueCost = (entries: MatchdaySlotPreviewCard[]) =>
    entries.reduce((sum, entry) => sum + (entry.projected.additionalFatigue ?? 0), 0);
  const sumFatiguePenalty = (entries: MatchdaySlotPreviewCard[]) =>
    entries.reduce((sum, entry) => sum + (entry.projected.fatigueModifier ?? 0), 0);
  const sumRangeLow = (entries: MatchdaySlotPreviewCard[]) =>
    entries.reduce((sum, entry) => sum + (entry.projected.rangeLow ?? entry.projected.totalProjected ?? 0), 0);
  const sumRangeHigh = (entries: MatchdaySlotPreviewCard[]) =>
    entries.reduce((sum, entry) => sum + (entry.projected.rangeHigh ?? entry.projected.totalProjected ?? 0), 0);
  const d1Projected = sumProjected(d1SlotPreviews);
  const d2Projected = sumProjected(d2SlotPreviews);
  const d1Fatigue = sumFatigueCost(d1SlotPreviews);
  const d2Fatigue = sumFatigueCost(d2SlotPreviews);
  const d1FatiguePenalty = sumFatiguePenalty(d1SlotPreviews);
  const d2FatiguePenalty = sumFatiguePenalty(d2SlotPreviews);
  const totalFatigue = sumFatigueCost(d1SlotPreviews) + sumFatigueCost(d2SlotPreviews);
  const openSlots =
    Math.max(d1RequiredPlayers - lineupMetaD1Selected, bySide.d1?.missingPlayers ?? 0, 0) +
    Math.max(d2RequiredPlayers - lineupMetaD2Selected, bySide.d2?.missingPlayers ?? 0, 0);
  const totalProjected = d1Projected + d2Projected;
  const totalBase =
    d1SlotPreviews.reduce((sum, entry) => sum + (entry.selectedScore ?? 0), 0) +
    d2SlotPreviews.reduce((sum, entry) => sum + (entry.selectedScore ?? 0), 0);
  const riskLevel =
    openSlots > 0
      ? "hoch"
      : Math.abs(totalFatigue) >= 40
        ? "mittel"
        : "niedrig";

  return {
    d1: bySide.d1 ? { ...bySide.d1, totalScore: d1Projected || bySide.d1.totalScore } : bySide.d1,
    d2: bySide.d2 ? { ...bySide.d2, totalScore: d2Projected || bySide.d2.totalScore } : bySide.d2,
    d1RangeLow: sumRangeLow(d1SlotPreviews),
    d1RangeHigh: sumRangeHigh(d1SlotPreviews),
    d2RangeLow: sumRangeLow(d2SlotPreviews),
    d2RangeHigh: sumRangeHigh(d2SlotPreviews),
    totalRangeLow: sumRangeLow(d1SlotPreviews) + sumRangeLow(d2SlotPreviews),
    totalRangeHigh: sumRangeHigh(d1SlotPreviews) + sumRangeHigh(d2SlotPreviews),
    d1Projected,
    d2Projected,
    d1Fatigue,
    d2Fatigue,
    d1FatiguePenalty,
    d2FatiguePenalty,
    totalFatigue,
    openSlots,
    totalProjected,
    totalBase,
    riskLevel,
  };
}

/** Vormals `lineupReadyToSave` (useMemo). */
export function computeLineupReadyToSave(input: {
  openSlots: number;
  allAvailablePlayersDeployed: boolean;
  duplicateSelectionsCount: number;
  captainBudgetExceeded: boolean;
  entriesCount: number;
}): boolean {
  const { openSlots, allAvailablePlayersDeployed, duplicateSelectionsCount, captainBudgetExceeded, entriesCount } = input;
  return (
    (openSlots === 0 || allAvailablePlayersDeployed) &&
    duplicateSelectionsCount === 0 &&
    !captainBudgetExceeded &&
    entriesCount > 0
  );
}

/** Vormals `lineupFlowSummary` (useMemo). */
export function buildLineupFlowSummary(input: {
  activeSlot: LegacyLineupLabSlot | null;
  captainBudgetExceeded: boolean;
  captainDraftUsedCount: number;
  captainSeasonLimit: number;
  captainUsedBeforeCurrentDraft: number;
  captains: Record<"d1" | "d2", string>;
  d1RequiredPlayers: number;
  d2RequiredPlayers: number;
  hasDraft: boolean;
  duplicateSelectionsCount: number;
  lineupMetaD1Selected: number;
  lineupMetaD2Selected: number;
  moraleAtRiskCount: number;
  moraleNetDelta: number;
  lineupReadyToSave: boolean;
  openSlots: number;
}): LineupFlowSummary {
  const {
    activeSlot,
    captainBudgetExceeded,
    captainDraftUsedCount,
    captainSeasonLimit,
    captainUsedBeforeCurrentDraft,
    captains,
    d1RequiredPlayers,
    d2RequiredPlayers,
    hasDraft,
    duplicateSelectionsCount,
    lineupMetaD1Selected,
    lineupMetaD2Selected,
    moraleAtRiskCount,
    moraleNetDelta,
    lineupReadyToSave,
    openSlots,
  } = input;

  const totalRequired = d1RequiredPlayers + d2RequiredPlayers;
  const selectedCount = lineupMetaD1Selected + lineupMetaD2Selected;
  const progressPercent = totalRequired > 0 ? Math.min(100, Math.round((selectedCount / totalRequired) * 100)) : 0;
  const captainCount = Number(Boolean(captains.d1)) + Number(Boolean(captains.d2));
  const hasDuplicateSelections = duplicateSelectionsCount > 0;
  const hasOpenSlots = openSlots > 0;
  const missingCaptainCount = Number(!captains.d1) + Number(!captains.d2);
  const nextStep = hasOpenSlots
    ? {
        label: "Slots füllen",
        detail: `${openSlots} offene Slots · aktiver Fokus ${activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : "Auto"}`,
        tone: "warning" as const,
      }
    : hasDuplicateSelections
      ? {
          label: "Doppelte Spieler lösen",
          detail: `${duplicateSelectionsCount} Konflikt${duplicateSelectionsCount === 1 ? "" : "e"} vor dem Speichern`,
          tone: "blocked" as const,
        }
      : captainBudgetExceeded
        ? {
            label: "Captain-Limit prüfen",
            detail: `${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit} Saison-Captains`,
            tone: "blocked" as const,
          }
        : moraleAtRiskCount > 0 && moraleNetDelta < 0
          ? {
              label: "Forderungen abwägen",
              detail: `${moraleAtRiskCount} offen · Moral ${formatMoraleDelta(moraleNetDelta)}`,
              tone: "warning" as const,
            }
        : lineupReadyToSave
          ? {
              label: "Lineup speichern",
              detail:
                missingCaptainCount > 0
                  ? `Slots voll · Captain optional (${missingCaptainCount} offen)`
                  : "Slots voll · Captain gesetzt · bereit für den Matchday-Save",
              tone: "ready" as const,
            }
          : {
              label: hasDraft ? "Bereit für Arena" : "Preview prüfen",
              detail: hasDraft ? "Gespeicherter Draft liegt vor" : "Optional Preview berechnen oder direkt speichern",
              tone: "ready" as const,
            };

  return {
    totalRequired,
    selectedCount,
    progressPercent,
    captainCount,
    nextStep,
  };
}

/** Vormals `lineupMiniAudit` (useMemo). */
export function buildLineupMiniAudit(input: {
  openSlots: number;
  allAvailablePlayersDeployed: boolean;
  selectedCount: number;
  totalRequired: number;
  duplicateSelectionsCount: number;
  captainBudgetExceeded: boolean;
  captainUsedBeforeCurrentDraft: number;
  captainDraftUsedCount: number;
  captainSeasonLimit: number;
  captains: Record<"d1" | "d2", string>;
  d1Label: string;
  d2Label: string;
  captainSeasonUsedWithDraft: number;
  missingSeasonFormCards: boolean;
  moraleAtRiskCount: number;
  moraleNetDelta: number;
  previewWarningsCount: number;
}): LineupMiniAudit {
  const {
    openSlots,
    allAvailablePlayersDeployed,
    selectedCount,
    totalRequired,
    duplicateSelectionsCount,
    captainBudgetExceeded,
    captainUsedBeforeCurrentDraft,
    captainDraftUsedCount,
    captainSeasonLimit,
    captains,
    d1Label,
    d2Label,
    captainSeasonUsedWithDraft,
    missingSeasonFormCards,
    moraleAtRiskCount,
    moraleNetDelta,
    previewWarningsCount,
  } = input;

  const items: LineupMiniAuditItem[] = [];
  if (openSlots > 0) {
    items.push({
      key: "open-slots",
      label: "Slots",
      detail: allAvailablePlayersDeployed
        ? `${openSlots} offen · alle Spieler eingesetzt`
        : `${openSlots} offen`,
      tone: allAvailablePlayersDeployed ? "warning" : "blocked",
    });
  } else {
    items.push({
      key: "open-slots",
      label: "Slots",
      detail: `${selectedCount}/${totalRequired || "—"} voll`,
      tone: "ready",
    });
  }
  if (duplicateSelectionsCount > 0) {
    items.push({
      key: "duplicates",
      label: "Doppelwahl",
      detail: `${duplicateSelectionsCount} Konflikt${duplicateSelectionsCount === 1 ? "" : "e"}`,
      tone: "blocked",
    });
  }
  items.push({
    key: "captain",
    label: "Captain",
    detail: captainBudgetExceeded
      ? `${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit} Limit`
      : !captains.d1 && !captains.d2
        ? "Optional · beide offen"
        : !captains.d1
          ? `Optional · ${d1Label} offen`
          : !captains.d2
            ? `Optional · ${d2Label} offen`
            : `${captainSeasonUsedWithDraft}/${captainSeasonLimit} Saison`,
    tone: captainBudgetExceeded ? "blocked" : captains.d1 || captains.d2 ? "ready" : "warning",
  });
  if (missingSeasonFormCards) {
    items.push({
      key: "form-source",
      label: "Form",
      detail: "Quelle fehlt",
      tone: "warning",
    });
  }
  if (moraleAtRiskCount > 0) {
    items.push({
      key: "morale",
      label: "Forderungen",
      detail: `${moraleAtRiskCount} offen · ${formatMoraleDelta(moraleNetDelta)}`,
      tone: moraleNetDelta < 0 ? "warning" : "ready",
    });
  }
  if (previewWarningsCount > 0) {
    items.push({
      key: "preview",
      label: "Preview",
      detail: `${previewWarningsCount} Hinweis${previewWarningsCount === 1 ? "" : "e"}`,
      tone: "warning",
    });
  }
  const status = items.some((item) => item.tone === "blocked")
    ? "blocked"
    : items.some((item) => item.tone === "warning")
      ? "warning"
      : "ready";
  return {
    status,
    items,
    blockingItems: items.filter((item) => item.tone === "blocked"),
    warningItems: items.filter((item) => item.tone === "warning"),
  };
}


/**
 * DER FRISCHERE ERSATZ FUER EINEN MUEDEN SLOT — der Hinweis nennt einen NAMEN, keine Ermahnung.
 *
 * GEMELDET VON CHRIS: „um mehr anreiz zu schaffen spieler für rotation zu holen -> können wir in
 * der einsatzliste einen hinweis einbauen wenn spieler hohe fatigue hat dass alternativ noch ein
 * rotationsspieler gezeigt wird der ‚frischer' ist?"
 *
 * WARUM DAS NOETIG WAR: der Hinweis „eher rotieren" gab es schon, aber er sagte nur, DASS man
 * rotieren soll — nie MIT WEM. Wer 12 Spieler hat, muss die Liste selbst durchsehen; wer keinen
 * frischen Ersatz hat, bekam denselben Satz und lief ins Leere. Ein benannter Vorschlag beantwortet
 * beides: er zeigt den Spieler, oder er erscheint gar nicht — und dieses Ausbleiben ist selbst die
 * Auskunft „du hast niemanden, hol dir Rotation".
 *
 * WER IN FRAGE KOMMT, bewusst eng:
 *   - nicht schon in einem anderen Slot gesetzt (sonst waere es eine Doppelwahl),
 *   - nicht verletzt und nicht in Erholung — wir empfehlen keine Schonung durch einen Angeschlagenen,
 *   - kann die Disziplin ueberhaupt (ein Wert in `disciplineScores` fuer genau diese Disziplin),
 *   - SELBST NICHT ERHOEHT MUEDE (`isElevatedFatigue`) — ein Tausch von 62 auf 51 ist kein Ausweg,
 *   - und mindestens `FRISCHER_MINDESTABSTAND` Punkte frischer, damit der Hinweis nicht bei
 *     Marginalien auftaucht.
 * Bei mehreren Treffern gewinnt der frischeste; bei gleicher Fatigue der fuer diese Disziplin bessere.
 */
const FRISCHER_MINDESTABSTAND = 15;

export function findeFrischerenErsatz(input: {
  disciplineId: string;
  selectedId: string;
  selectedFatigue: number | null | undefined;
  playerOptions: LegacyLineupLabPlayerOption[];
  belegteIds: Set<string>;
}): { name: string; fatigue: number } | null {
  const muede = input.selectedFatigue ?? 0;
  const treffer = input.playerOptions
    .filter((option) => option.activePlayerId !== input.selectedId)
    .filter((option) => !input.belegteIds.has(option.activePlayerId))
    .filter((option) => option.injuryStatus !== "injured" && option.injuryStatus !== "recovering")
    .filter((option) => typeof option.disciplineScores[input.disciplineId] === "number")
    .filter((option) => !isElevatedFatigue(option.fatigueCount))
    .filter((option) => muede - (option.fatigueCount ?? 0) >= FRISCHER_MINDESTABSTAND)
    .sort((left, right) => {
      const fatigueDiff = (left.fatigueCount ?? 0) - (right.fatigueCount ?? 0);
      if (fatigueDiff !== 0) return fatigueDiff;
      return (right.disciplineScores[input.disciplineId] ?? 0) - (left.disciplineScores[input.disciplineId] ?? 0);
    })[0];

  return treffer ? { name: treffer.name, fatigue: Math.round(treffer.fatigueCount ?? 0) } : null;
}

/** Vormals `slotIssuesByKey` (useMemo). */
export function buildSlotIssuesByKey(input: {
  slots: LegacyLineupLabSlot[];
  selections: Record<string, string>;
  playerOptions: LegacyLineupLabPlayerOption[];
  rosterCardByActivePlayerId: Map<string, MatchdayRosterCard>;
  slotPreviewByKey: Map<string, MatchdaySlotPreviewCard>;
  duplicateSelectionIds: Set<string>;
  moraleDecisionsByActivePlayerId: Map<string, LineupMoraleDecision[]>;
  activeSlotKey: string | null;
}): Map<string, LineupSlotIssue[]> {
  const { slots, selections, playerOptions, rosterCardByActivePlayerId, slotPreviewByKey, duplicateSelectionIds, moraleDecisionsByActivePlayerId, activeSlotKey } = input;

  return new Map(
    slots.map((slot) => {
      const selectedId = selections[slot.key] ?? "";
      const selectedOption = getSelectedOptionMeta(playerOptions, selectedId);
      const selectedRosterCard = rosterCardByActivePlayerId.get(selectedId) ?? null;
      const slotPreview = slotPreviewByKey.get(slot.key) ?? null;
      const selectedDemandDecisions =
        selectedId && selectedRosterCard
          ? (moraleDecisionsByActivePlayerId.get(selectedId) ?? []).filter(
              (decision) =>
                !decision.targetDisciplineId ||
                decision.targetDisciplineId === slot.disciplineId ||
                decision.label === "Captain-Rolle",
            )
          : [];
      const issues: LineupSlotIssue[] = [];

      if (!selectedId) {
        // S6/L2 (Audit Spieltag): ein leerer, noch nicht in Bearbeitung befindlicher
        // Slot ist der NORMALZUSTAND jedes Spieltags vor dem Ausfüllen — vorher hieß
        // er "Spieler fehlt" und wurde (Rendering-Bug in LineupNewLook.tsx: jedes
        // Issue lief hart auf `is-risk`) rot wie ein echter Fehler dargestellt, 9×
        // gleichzeitig auf der Seite. "Offen" deckt sich mit dem Label, das die Karte
        // ohnehin schon zeigt ("Offen" / "Slot wählen") — der Best-Fit-Name steht
        // bereits als eigene Zeile darunter, keine zweite Nennung nötig. Der aktive
        // Slot ("Hier weiter") bleibt bewusst ein echter Blocker (tone "blocked").
        issues.push({
          tone: activeSlotKey === slot.key ? "blocked" : "warning",
          label: activeSlotKey === slot.key ? "Hier weiter" : "Offen",
          detail: `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1} wartet noch auf einen Spieler.`,
        });
      }
      if (selectedId && duplicateSelectionIds.has(selectedId)) {
        issues.push({
          tone: "blocked",
          label: "Doppelwahl",
          detail: "Dieser Spieler ist schon in einem anderen Slot gesetzt.",
        });
      }
      if (selectedOption?.injuryStatus === "injured") {
        issues.unshift({
          tone: "blocked",
          label: "Verletzt",
          detail: "Verletzter Spieler — aus dem Lineup nehmen oder ersetzen.",
        });
      } else if (selectedOption?.injuryStatus === "recovering") {
        issues.unshift({
          tone: "warning",
          label: "Recovery",
          detail: "Spieler erholt sich noch — Belastung reduzieren.",
        });
      }
      if (isElevatedFatigue(selectedOption?.fatigueCount)) {
        const ersatz = selectedId
          ? findeFrischerenErsatz({
              disciplineId: slot.disciplineId,
              selectedId,
              selectedFatigue: selectedOption?.fatigueCount,
              playerOptions,
              belegteIds: new Set(Object.values(selections).filter(Boolean)),
            })
          : null;
        issues.push({
          tone: "warning",
          label: "Fatigue-Risiko",
          detail: ersatz
            ? `${formatFatigueImpactDetail(selectedOption?.fatigueCount)}: frischer waere ${ersatz.name} (Fatigue ${ersatz.fatigue}).`
            : `${formatFatigueImpactDetail(selectedOption?.fatigueCount)}: eher rotieren oder Team-Einsatz senken.`,
        });
      }
      const firstWarning = slotPreview?.projected.warnings[0];
      if (firstWarning) {
        issues.push({
          tone: "warning",
          label: formatLineupHintLabel(firstWarning),
          detail: firstWarning,
        });
      }
      for (const decision of selectedDemandDecisions) {
        issues.push({
          tone: decision.fulfilled ? "ready" : "warning",
          label: decision.fulfilled ? "Forderung erfüllt" : "Forderung offen",
          detail: `${decision.playerName}: ${decision.label} (${formatMoraleDelta(decision.moraleDelta)} Moral)`,
        });
      }

      return [slot.key, issues.slice(0, 4)] as const;
    }),
  );
}

/** Vormals `lineupSaveCta` (useMemo). */
export function buildLineupSaveCta(input: {
  openSlots: number;
  allAvailablePlayersDeployed: boolean;
  captainBudgetExceeded: boolean;
  captainUsedBeforeCurrentDraft: number;
  captainDraftUsedCount: number;
  captainSeasonLimit: number;
  duplicateSelectionsCount: number;
  hasDraft: boolean;
  lineupReadyToSave: boolean;
  captains: Record<"d1" | "d2", string>;
}): LineupSaveCta {
  const {
    openSlots,
    allAvailablePlayersDeployed,
    captainBudgetExceeded,
    captainUsedBeforeCurrentDraft,
    captainDraftUsedCount,
    captainSeasonLimit,
    duplicateSelectionsCount,
    hasDraft,
    lineupReadyToSave,
    captains,
  } = input;

  const blockers: string[] = [];
  if (openSlots > 0 && !allAvailablePlayersDeployed) {
    blockers.push(`${openSlots} Slot${openSlots === 1 ? "" : "s"} offen`);
  }
  if (captainBudgetExceeded) {
    blockers.push(`Captain-Limit ${captainUsedBeforeCurrentDraft + captainDraftUsedCount}/${captainSeasonLimit}`);
  }
  if (duplicateSelectionsCount > 0) {
    blockers.push(`${duplicateSelectionsCount} Konflikt${duplicateSelectionsCount === 1 ? "" : "e"}`);
  }

  if (hasDraft) {
    return {
      tone: "ready" as const,
      label: "Arena bereit",
      detail: "Draft ist gespeichert und kann direkt in die Arena gehen.",
      buttonLabel: "Arena bereit",
    };
  }

  if (lineupReadyToSave) {
    const allDeployedHint = allAvailablePlayersDeployed && openSlots > 0
      ? "Alle Spieler eingesetzt · Formkarte & Captain optional."
      : !captains.d1 && !captains.d2
        ? "Slots voll, keine Konflikte. Captains sind optional und können gespart werden."
        : "Slots voll, Captain-Plan passt, keine Konflikte mehr.";
    return {
      tone: "ready" as const,
      label: "Lineup bereit speichern",
      detail: allDeployedHint,
      buttonLabel: "Lineup bereit speichern",
    };
  }

  // F4 (Befund L1): der CTA zählte hier BLOCKER-KATEGORIEN („Noch 1 offen"),
  // direkt neben dem Ring, der SLOTS zählt („0/9 · 9 offen") — zwei Zähler,
  // zwei Einheiten, dieselbe Wortwahl. Die Slot-Zahl ist die Quelle; der CTA
  // erfindet keine eigene „Dinge"-Einheit mehr, sondern benennt den Blocker
  // wörtlich (ein Blocker → sein Text, z. B. „9 Slots offen" — identisch mit
  // dem Ring) oder zählt ausdrücklich „Blocker".
  const blockerCount = blockers.length;
  return {
    tone: blockers.some((entry) => entry.includes("Konflikt")) ? ("blocked" as const) : ("warning" as const),
    label: blockerCount === 1 ? blockers[0]! : blockerCount > 1 ? `${blockerCount} Blocker offen` : "Noch nicht bereit",
    detail: blockers.slice(0, 3).join(" · ") || "Bitte offene Punkte zuerst aufraeumen.",
    buttonLabel: blockerCount === 1 ? blockers[0]! : blockerCount > 1 ? `${blockerCount} Blocker` : "Noch nicht bereit",
  };
}

// ---------------------------------------------------------------------------
// Kleine, formatierungsnahe Helfer (vormals modulweite Funktionen in
// LegacyLineupLabClient.tsx, unveraendert hierher verschoben).
// ---------------------------------------------------------------------------

export function formatMoraleDelta(value: number) {
  if (value > 0) return `+${formatDecimalScore(value, 1)}`;
  if (value < 0) return formatDecimalScore(value, 1);
  return "0";
}

export function formatLineupHintLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "Hinweis";
  }
  if (normalized.includes("captain")) {
    return "Captain prüfen";
  }
  if (normalized.includes("fatigue") || normalized.includes("ersch")) {
    if (normalized.includes("kostet bereits")) {
      return "Fatigue-Malus";
    }
    return "Fatigue-Risiko";
  }
  if (normalized.includes("form")) {
    return "Formkarten prüfen";
  }
  if (normalized.includes("off-role") || normalized.includes("passt schwach")) {
    return "Off-Role";
  }
  if (normalized.includes("starker slot-fit") || normalized.includes("playbook-profil")) {
    return "Guter Slot-Fit";
  }
  if (normalized.includes("push bei stark")) {
    return "Push riskant";
  }
  if (normalized.includes("rivalitaet") || normalized.includes("rivalitätsdruck")) {
    return "Rivalitätsdruck";
  }
  if (normalized.includes("schwaches") && normalized.includes("strain")) {
    return "Strain-Risiko";
  }
  if (normalized.includes("slotrolle fehlt")) {
    return "Keine Rolle";
  }
  if (normalized.includes("slot")) {
    return "Rollen-Hinweis";
  }
  if (normalized.includes("lineup") || normalized.includes("vollst")) {
    return "Lineup prüfen";
  }
  return "Hinweis";
}
