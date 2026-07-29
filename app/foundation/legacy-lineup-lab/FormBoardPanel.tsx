"use client";

import type { DragEvent, ReactNode } from "react";
import { useMemo, useState } from "react";

import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import { NlDeltaChip } from "@/components/foundation/new-look";
import { VeloImpactStrip } from "@/components/foundation/velo-ui";
import type { FormCardPlanRecord, LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type {
  LegacyFormCardOption,
  LegacyLineupDraft,
  LegacyLineupLoadedContext,
  LegacyModifierSourceSummary,
  LegacyTeamPowerOption,
} from "@/lib/lineups/legacy-lineup-types";

type FormBoardPickCell = {
  matchdayId: string;
  disciplineSide: "d1" | "d2";
  slot: "primary" | "secondary";
  disciplineId: string | null;
  disciplineColor: LegacyFormCardOption["color"] | null;
};

type FormDeckCard = LegacyFormCardOption & {
  isUsed: boolean;
  isReserved: boolean;
};

// Feste Anzeige-Reihenfolge der Bereichsfarben (POW/SPE/MEN/SOC) — identisch zur
// Sortierung im Karten-Deck des Clients, damit beide Ansichten dieselbe Ordnung zeigen.
const FORM_CARD_COLOR_ORDER: LegacyFormCardOption["color"][] = ["red", "green", "blue", "yellow"];

export type FormBoardPanelProps = {
  modifiers: LineupDraftModifiers;
  context: LegacyLineupLoadedContext | null;
  draft: LegacyLineupDraft | null;
  draftIntensityPreview: {
    baseScore: number | null;
    finalScore: number | null;
  };
  formPlanOpenCells: number;
  formDeckCards: FormDeckCard[];
  formCardCounts: { positiveAvailable: number; negativeAvailable: number };
  activeFormPickCell: FormBoardPickCell | null;
  formCardPlanByKey: Map<string, FormCardPlanRecord>;
  formCardPlanPendingKey: string | null;
  usedFormCards: LegacyFormCardOption[];
  isReadOnly: boolean;
  matchdayId: string;
  matchdayOptions: Array<{ id: string; matchdayIndex?: number; index?: number }>;
  /**
   * Captain-Saisonbudget als Planungs-Kontext (aus den bestehenden Client-Derivations
   * `captainSeasonLimit` / `captainSeasonUsedWithDraft` / `captainDraftRemaining` —
   * hier wird nichts neu berechnet). Eine Captain-VORAUSPLANUNG pro künftigem Spieltag
   * existiert im Datenmodell bewusst nicht: Der Captain wird am Spieltag selbst in der
   * Einsatzliste gesetzt. Der Formplan zeigt daher nur den Restbestand über die Saison,
   * damit man beim Karten-Planen mitdenken kann, wo noch Captain-Einsätze übrig sind.
   */
  captainSeasonLimit: number;
  captainSeasonUsedWithDraft: number;
  captainDraftRemaining: number;
  /** Kategorie-Kürzel (POW/SPE/MEN/SOC/FLEX) einer Team-Power — geteilter Client-Helper. */
  getTeamPowerCategoryLabel: (category: LegacyTeamPowerOption["category"]) => string;
  formatModifierSourceLabel: (source: LegacyModifierSourceSummary | null | undefined) => string;
  formatFormPlanImpact: (
    primary: LegacyFormCardOption | null,
    secondary: LegacyFormCardOption | null,
    disciplineColor: LegacyFormCardOption["color"] | null,
  ) => string;
  formatFormCardValueLabel: (value: number) => string;
  formatFormCardColorLabel: (color: LegacyFormCardOption["color"]) => string;
  formatFormCardOptionLabel: (card: LegacyFormCardOption, disciplineColor: LegacyFormCardOption["color"] | null) => string;
  formatNullableScore: (value: number | null) => string;
  resolveTeamDisciplineRank: (
    ranks: LegacyLineupLoadedContext["teamDisciplineRanks"] | null | undefined,
    disciplineId: string | null,
    displayName: string | null,
  ) => number | null;
  getFormCardColorForCategory: (category: string | null | undefined) => LegacyFormCardOption["color"] | null;
  getFormBoardCardOptions: (
    matchdayId: string,
    disciplineSide: "d1" | "d2",
    slot: "primary" | "secondary",
    disciplineColor: LegacyFormCardOption["color"] | null,
  ) => LegacyFormCardOption[];
  renderSelectedFormCardChip: (
    cardId: string | null,
    disciplineColor: LegacyFormCardOption["color"] | null,
  ) => ReactNode;
  clearActiveFormPickCell: () => void;
  assignFormCardFromDeck: (cardId: string) => void;
  assignFormCardToCell: (input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
    slot: "primary" | "secondary";
    cardId: string;
  }) => void;
  setActiveFormPickCell: (cell: FormBoardPickCell) => void;
  skipFormCardsForSide: (input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    disciplineId: string | null;
  }) => void;
};

export default function FormBoardPanel({
  modifiers,
  context,
  draft,
  draftIntensityPreview,
  formPlanOpenCells,
  formDeckCards,
  formCardCounts,
  activeFormPickCell,
  formCardPlanByKey,
  formCardPlanPendingKey,
  usedFormCards,
  isReadOnly,
  matchdayId,
  matchdayOptions,
  captainSeasonLimit,
  captainSeasonUsedWithDraft,
  captainDraftRemaining,
  getTeamPowerCategoryLabel,
  formatModifierSourceLabel,
  formatFormPlanImpact,
  formatFormCardValueLabel,
  formatFormCardColorLabel,
  formatFormCardOptionLabel,
  formatNullableScore,
  resolveTeamDisciplineRank,
  getFormCardColorForCategory,
  getFormBoardCardOptions,
  renderSelectedFormCardChip,
  clearActiveFormPickCell,
  assignFormCardFromDeck,
  assignFormCardToCell,
  setActiveFormPickCell,
  skipFormCardsForSide,
}: FormBoardPanelProps) {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCellId, setDragOverCellId] = useState<string | null>(null);
  const formPlanProgress = useMemo(() => {
    const totalCells = Math.max(1, matchdayOptions.length * 2);
    const filledCells = (context?.formCardPlans ?? []).filter(
      (plan) => plan.primaryFormCardId || plan.secondaryFormCardId,
    ).length;
    return { filledCells, totalCells };
  }, [context?.formCardPlans, matchdayOptions.length]);

  // Aktueller Spieltag-Index als Referenzpunkt der Saison-Planung: steuert die
  // "Heute"/"Gespielt"/"Plan"-Beschriftung der Timeline und die Rest-Saison-Zählung
  // im Ressourcen-Cockpit. Gleiche Auflösungskette wie bisher in der Timeline
  // (matchdayOptions zuerst, Context-Fallback), nur einmal zentral statt pro Eintrag.
  const currentMatchdayIndex = useMemo(() => {
    const option = matchdayOptions.find((matchday) => matchday.id === matchdayId);
    return option?.matchdayIndex ?? option?.index ?? context?.matchday.index ?? null;
  }, [context?.matchday.index, matchdayId, matchdayOptions]);

  // Wie viele Spieltage (inkl. heute) noch kommen — der Nenner der Frage
  // "verbrenne ich meine Ressourcen zu früh?".
  const remainingMatchdayCount = useMemo(() => {
    const schedule = context?.seasonDisciplineSchedule ?? [];
    if (currentMatchdayIndex == null) {
      return schedule.length;
    }
    return schedule.filter((entry) => entry.matchdayIndex >= currentMatchdayIndex).length;
  }, [context?.seasonDisciplineSchedule, currentMatchdayIndex]);

  const freeDeckCards = useMemo(
    () => formDeckCards.filter((card) => !card.isUsed && !card.isReserved),
    [formDeckCards],
  );

  // Freie Karten pro Bereichsfarbe: die zentrale Info für den Farbmatch (x2).
  // Wird sowohl im Ressourcen-Cockpit als auch pro Timeline-Zelle angezeigt
  // ("wie viele passende Karten habe ich für diese Disziplin noch übrig?").
  const freeCardCountByColor = useMemo(() => {
    const counts: Record<LegacyFormCardOption["color"], number> = { red: 0, green: 0, blue: 0, yellow: 0 };
    for (const card of freeDeckCards) {
      counts[card.color] += 1;
    }
    return counts;
  }, [freeDeckCards]);

  // Team-Power-Saisonbudget: reine Sichtbarmachung der vorhandenen Ladungen aus
  // `context.teamPowers` (chargesRemaining/chargesTotal/isUsedUp). Auch hier gilt:
  // Eine Team-Power-VORAUSPLANUNG pro künftigem Spieltag existiert im Datenmodell
  // nicht — aktiviert wird die Power am Spieltag in der Einsatzliste. Passive Powers
  // haben kein Ladungs-Budget und werden nur gezählt, nicht aufsummiert.
  const teamPowerBudget = useMemo(() => {
    const powers = context?.teamPowers ?? [];
    const activePowers = powers.filter((power) => !power.isPassive);
    return {
      powers: activePowers,
      passiveCount: powers.length - activePowers.length,
      chargesRemaining: activePowers.reduce((sum, power) => sum + power.chargesRemaining, 0),
      chargesTotal: activePowers.reduce((sum, power) => sum + power.chargesTotal, 0),
    };
  }, [context?.teamPowers]);

  const captainSeasonRemaining = Math.max(0, captainSeasonLimit - captainSeasonUsedWithDraft);

  function cellAcceptsDraggedCard(input: {
    matchdayId: string;
    disciplineSide: "d1" | "d2";
    slot: "primary" | "secondary";
    disciplineColor: LegacyFormCardOption["color"] | null;
  }) {
    if (!draggedCardId) {
      return false;
    }
    const allowed = new Set(
      getFormBoardCardOptions(input.matchdayId, input.disciplineSide, input.slot, input.disciplineColor).map((entry) => entry.id),
    );
    return allowed.has(draggedCardId);
  }

  function getDragOverClassName(
    cellId: string,
    input: {
      matchdayId: string;
      disciplineSide: "d1" | "d2";
      slot: "primary" | "secondary";
      disciplineColor: LegacyFormCardOption["color"] | null;
    },
  ) {
    if (dragOverCellId !== cellId || !draggedCardId) {
      return "";
    }
    return cellAcceptsDraggedCard(input) ? " is-drag-over" : " is-drag-invalid";
  }

  function handleDragOverCell(
    event: DragEvent<HTMLButtonElement>,
    cellId: string,
    input: {
      matchdayId: string;
      disciplineSide: "d1" | "d2";
      slot: "primary" | "secondary";
      disciplineColor: LegacyFormCardOption["color"] | null;
    },
  ) {
    event.preventDefault();
    setDragOverCellId(cellId);
    event.dataTransfer.dropEffect = cellAcceptsDraggedCard(input) ? "copy" : "none";
  }
  function handleDropOnCell(
    event: DragEvent<HTMLButtonElement>,
    input: {
      matchdayId: string;
      disciplineSide: "d1" | "d2";
      disciplineId: string | null;
      slot: "primary" | "secondary";
      disciplineColor: LegacyFormCardOption["color"] | null;
    },
  ) {
    event.preventDefault();
    setDragOverCellId(null);
    const cardId = event.dataTransfer.getData("text/form-card-id") || draggedCardId;
    if (!cardId || isReadOnly) {
      return;
    }
    const allowed = new Set(
      getFormBoardCardOptions(input.matchdayId, input.disciplineSide, input.slot, input.disciplineColor).map((entry) => entry.id),
    );
    if (!allowed.has(cardId)) {
      return;
    }
    assignFormCardToCell({
      matchdayId: input.matchdayId,
      disciplineSide: input.disciplineSide,
      disciplineId: input.disciplineId,
      slot: input.slot,
      cardId,
    });
    setDraggedCardId(null);
  }

  return (
    <section
      id="legacy-lineup-panel-formplan"
      role="tabpanel"
      aria-labelledby="legacy-lineup-tab-formplan"
      className="legacy-lineup-form-board"
      aria-label="Saison-Formkarten"
    >
      <div className="legacy-lineup-form-board-head">
        <div>
          <span>Saison-Planung</span>
          <strong>Formplan</strong>
        </div>
        <div className="legacy-lineup-form-board-head-stats">
          <span className="pill" title="Aktueller Spieltag und verbleibende Spieltage inkl. heute.">
            Spieltag {currentMatchdayIndex ?? "—"} · {remainingMatchdayCount} übrig
          </span>
          <span className="pill">Form {formatModifierSourceLabel(context?.formCardSource)}</span>
          <NlDeltaChip
            value={formCardCounts.positiveAvailable}
            format={(n) => `${n} positiv`}
            title="Verfügbare positive Formkarten"
          />
          <NlDeltaChip
            value={formCardCounts.negativeAvailable > 0 ? -formCardCounts.negativeAvailable : 0}
            format={(n) => `${Math.abs(n)} negativ`}
            title="Verfügbare negative Formkarten"
          />
        </div>
      </div>
      <div className="legacy-lineup-form-board-sync-banner" aria-label="Heute-Status">
        <span className={modifiers.d1.primaryFormCardId || modifiers.d2.primaryFormCardId ? "is-ready" : "is-warning"}>
          Plan → Entwurf {modifiers.d1.primaryFormCardId || modifiers.d2.primaryFormCardId ? "sync ✓" : "optional — kein Einsatz"}
        </span>
        <span className={draft ? "is-ready" : "is-warning"}>Gespeichert {draft ? "✓" : "⚠"}</span>
      </div>
      <p className="legacy-lineup-form-board-hint">
        Beide Slots sind optional. F1 ± · F2 nur positiv. Farbmatch (Karte = Disziplin-Bereich) verdoppelt den Kartenwert.
        Negative bis Saisonende abwerfen — offene Negative kosten Strafpunkte.
      </p>
      {/*
        Saison-Ressourcen-Cockpit: eine Zeile, drei Budgets — Formkarten, Captain,
        Team-Power. Genau die Frage, die dieser Screen beantworten soll: "Wie viel
        habe ich noch, und für wie viele Spieltage muss es reichen?" Formkarten sind
        die einzige Ressource mit persistiertem Zukunfts-Plan (formCardPlans); Captain
        und Team-Power zeigen bewusst NUR das Saison-Kontingent als Planungs-Kontext,
        weil das Datenmodell für sie keine Vorausplanung pro Spieltag kennt.
      */}
      <div className="legacy-lineup-form-resources" aria-label="Saison-Ressourcen">
        <article className="legacy-lineup-form-resource is-cards">
          <div className="legacy-lineup-form-resource-head">
            <span>Formkarten</span>
            <strong>{freeDeckCards.length} frei</strong>
          </div>
          <div
            className="legacy-lineup-form-resource-meter"
            role="img"
            aria-label={`${freeDeckCards.length} von ${Math.max(formDeckCards.length, 1)} Formkarten frei`}
          >
            <span style={{ width: `${Math.round((freeDeckCards.length / Math.max(formDeckCards.length, 1)) * 100)}%` }} />
          </div>
          <small>
            {formPlanOpenCells} Zellen offen · {formPlanProgress.filledCells}/{formPlanProgress.totalCells} Spieltag-Seiten geplant
          </small>
          <div className="legacy-lineup-form-resource-colors">
            {FORM_CARD_COLOR_ORDER.map((color) => (
              <span
                key={`form-resource-color-${color}`}
                className={`legacy-lineup-form-card-chip legacy-lineup-form-resource-color is-${color}${freeCardCountByColor[color] === 0 ? " is-depleted" : ""}`}
                title={`Freie ${formatFormCardColorLabel(color)}-Karten — zählen in ${formatFormCardColorLabel(color)}-Disziplinen doppelt (x2).`}
              >
                <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                {formatFormCardColorLabel(color)} {freeCardCountByColor[color]}
              </span>
            ))}
          </div>
        </article>
        <article className="legacy-lineup-form-resource is-captain">
          <div className="legacy-lineup-form-resource-head">
            <span>Captain</span>
            <strong>{captainSeasonRemaining} von {captainSeasonLimit} übrig</strong>
          </div>
          <div
            className="legacy-lineup-form-resource-meter"
            role="img"
            aria-label={`${captainSeasonRemaining} von ${captainSeasonLimit} Captain-Einsätzen übrig`}
          >
            <span style={{ width: `${Math.round((captainSeasonRemaining / Math.max(captainSeasonLimit, 1)) * 100)}%` }} />
          </div>
          <small>
            {captainSeasonUsedWithDraft}/{captainSeasonLimit} Saison verplant · heute noch {captainDraftRemaining} möglich
          </small>
          <p className="legacy-lineup-form-resource-note">
            Captain wird am Spieltag in der Einsatzliste gesetzt — keine Vorausplanung pro Spieltag.
          </p>
        </article>
        <article className="legacy-lineup-form-resource is-power">
          <div className="legacy-lineup-form-resource-head">
            <span>Team-Power</span>
            <strong>
              {teamPowerBudget.chargesRemaining}/{teamPowerBudget.chargesTotal} Ladungen
            </strong>
          </div>
          <div
            className="legacy-lineup-form-resource-meter"
            role="img"
            aria-label={`${teamPowerBudget.chargesRemaining} von ${teamPowerBudget.chargesTotal} Team-Power-Ladungen übrig`}
          >
            <span
              style={{ width: `${Math.round((teamPowerBudget.chargesRemaining / Math.max(teamPowerBudget.chargesTotal, 1)) * 100)}%` }}
            />
          </div>
          <small>
            Quelle {formatModifierSourceLabel(context?.teamPowerSource)}
            {teamPowerBudget.passiveCount > 0 ? ` · ${teamPowerBudget.passiveCount} passiv` : ""}
          </small>
          {teamPowerBudget.powers.length > 0 ? (
            <div className="legacy-lineup-form-resource-power-list">
              {teamPowerBudget.powers.map((power) => (
                <span
                  key={`form-resource-power-${power.id}`}
                  className={`legacy-lineup-form-resource-power${power.isUsedUp ? " is-used-up" : ""}`}
                  title={power.description}
                >
                  {getTeamPowerCategoryLabel(power.category)} · {power.label} · {power.chargesRemaining}/{power.chargesTotal}
                </span>
              ))}
            </div>
          ) : null}
          <p className="legacy-lineup-form-resource-note">
            Team-Power wird am Spieltag in der Einsatzliste aktiviert — keine Vorausplanung pro Spieltag.
          </p>
        </article>
      </div>
      <div className="legacy-lineup-form-board-current" aria-label="Aktiver Formplan">
        {(["d1", "d2"] as const).map((disciplineSide) => {
          const discipline = disciplineSide === "d1" ? context?.matchdayContract?.discipline1 : context?.matchdayContract?.discipline2;
          const rank = resolveTeamDisciplineRank(context?.teamDisciplineRanks, discipline?.disciplineId ?? null, discipline?.displayName ?? null);
          const selectedPrimaryCard = (context?.formCards ?? []).find((card) => card.id === modifiers[disciplineSide].primaryFormCardId) ?? null;
          const selectedSecondaryCard = (context?.formCards ?? []).find((card) => card.id === modifiers[disciplineSide].secondaryFormCardId) ?? null;
          const disciplineColor = getFormCardColorForCategory(discipline?.category ?? null);
          const formImpact = formatFormPlanImpact(selectedPrimaryCard, selectedSecondaryCard, disciplineColor);
          return (
            <article key={`form-board-current-${disciplineSide}`} className={`is-${disciplineColor ?? "neutral"}`}>
              <div className="legacy-lineup-form-board-current-head">
                <DisciplineIcon disciplineId={discipline?.disciplineId ?? null} label={discipline?.displayName ?? disciplineSide.toUpperCase()} showLabel />
                <span title="Rank und Spieleranzahl am aktiven Spieltag.">
                  #{rank ?? "—"} · {discipline?.requiredPlayers ?? "—"} Spieler
                </span>
              </div>
              <VeloImpactStrip
                className="legacy-lineup-form-board-velo-strip"
                items={[
                  {
                    key: "form",
                    label: "Form",
                    value: formImpact,
                    tone: selectedPrimaryCard ? "positive" : "neutral",
                  },
                  {
                    key: "final",
                    label: "Final",
                    value: formatNullableScore(draftIntensityPreview.finalScore),
                    tone: "positive",
                  },
                ]}
              />
              {matchdayId === context?.matchday.id ? (
                <button
                  type="button"
                  className="secondary-button inline-button legacy-lineup-form-board-skip-side"
                  disabled={isReadOnly || (!selectedPrimaryCard && !selectedSecondaryCard)}
                  onClick={() =>
                    skipFormCardsForSide({
                      matchdayId,
                      disciplineSide,
                      disciplineId: discipline?.disciplineId ?? null,
                    })
                  }
                >
                  Keine Karten spielen
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="legacy-lineup-form-board-workspace">
        <aside className="legacy-lineup-form-deck" aria-label="Karten-Deck">
          <div className="legacy-lineup-form-deck-head">
            <span>Karten-Deck</span>
            <strong>{activeFormPickCell ? "Karte wählen" : "Zelle rechts aktivieren"}</strong>
            <span className="legacy-lineup-form-deck-count">
              {freeDeckCards.length} frei · {formDeckCards.length} gesamt
            </span>
            <span className="legacy-lineup-form-deck-progress" aria-label="Saison-Fortschritt Formplan">
              {formPlanProgress.filledCells}/{formPlanProgress.totalCells} Spieltage geplant
            </span>
          </div>
          {activeFormPickCell ? (
            <button className="secondary-button legacy-lineup-form-deck-clear" type="button" onClick={clearActiveFormPickCell} disabled={isReadOnly}>
              Auswahl leeren
            </button>
          ) : null}
          <div className="legacy-lineup-form-deck-stack" aria-hidden="true">
            {formDeckCards.filter((card) => !card.isUsed).slice(0, 3).map((card, index) => (
              <span key={`deck-stack-${card.id}`} className={`legacy-lineup-form-deck-stack-card is-${card.color}`} style={{ transform: `translateY(${index * 4}px)` }} />
            ))}
          </div>
          <div className="legacy-lineup-form-deck-grid is-deck-feel">
            {formDeckCards.map((card) => {
              const activeCellColor = activeFormPickCell?.disciplineColor ?? null;
              const allowedDeckCardIds = activeFormPickCell
                ? new Set(
                    getFormBoardCardOptions(
                      activeFormPickCell.matchdayId,
                      activeFormPickCell.disciplineSide,
                      activeFormPickCell.slot,
                      activeFormPickCell.disciplineColor,
                    ).map((entry) => entry.id),
                  )
                : null;
              const planForActiveCell = activeFormPickCell
                ? formCardPlanByKey.get(`${activeFormPickCell.matchdayId}:${activeFormPickCell.disciplineSide}`)
                : null;
              const isSelectedInActiveCell =
                activeFormPickCell?.slot === "primary"
                  ? planForActiveCell?.primaryFormCardId === card.id
                  : planForActiveCell?.secondaryFormCardId === card.id;
              return (
                <button
                  key={`form-deck-${card.id}`}
                  type="button"
                  draggable={!isReadOnly && !card.isUsed}
                  data-testid="form-deck-chip"
                  onDragStart={(event) => {
                    setDraggedCardId(card.id);
                    event.dataTransfer.setData("text/form-card-id", card.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={() => {
                    setDraggedCardId(null);
                    setDragOverCellId(null);
                  }}
                  className={`legacy-lineup-form-card-chip legacy-lineup-form-deck-chip is-${card.color}${card.isUsed ? " is-used" : ""}${card.isReserved && !isSelectedInActiveCell ? " is-reserved" : ""}${draggedCardId === card.id ? " is-dragging" : ""}`}
                  disabled={isReadOnly || !activeFormPickCell || card.isUsed || (allowedDeckCardIds != null && !allowedDeckCardIds.has(card.id))}
                  title={
                    card.isUsed
                      ? "Bereits eingesetzt"
                      : card.isReserved && !isSelectedInActiveCell
                        ? "Andere Spieltage reserviert"
                        : formatFormCardOptionLabel(card, activeCellColor)
                  }
                  onClick={() => assignFormCardFromDeck(card.id)}
                >
                  <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                  {formatFormCardColorLabel(card.color)} {formatFormCardValueLabel(card.value)}
                  {activeCellColor === card.color ? " · x2" : ""}
                </button>
              );
            })}
          </div>
        </aside>
        <div className="legacy-lineup-form-timeline" aria-label="Spieltag-Timeline">
          {(context?.seasonDisciplineSchedule ?? []).map((entry) => {
            const isCurrentMatchday = entry.matchdayId === matchdayId;
            // "Gespielt"-Spieltage bleiben sichtbar (Saison-Gedächtnis: wo wurde schon
            // investiert?), werden aber visuell zurückgenommen — dort plant niemand mehr.
            const isPastMatchday =
              !isCurrentMatchday && currentMatchdayIndex != null && entry.matchdayIndex < currentMatchdayIndex;
            const matchdayDistance = Math.abs(entry.matchdayIndex - (currentMatchdayIndex ?? entry.matchdayIndex));
            const isCompactMatchday = !isCurrentMatchday && matchdayDistance > 2;
            return (
              <article
                key={`form-board-${entry.matchdayId}`}
                className={`legacy-lineup-form-timeline-entry${isCurrentMatchday ? " is-current" : ""}${isCompactMatchday ? " is-compact" : ""}${isPastMatchday ? " is-past" : ""}`}
              >
                <div className="legacy-lineup-form-board-matchday">
                  <span>Spieltag {entry.matchdayIndex}</span>
                  <strong>{entry.matchdayLabel}</strong>
                  <small>{isCurrentMatchday ? "Heute" : isPastMatchday ? "Gespielt" : "Plan"}</small>
                </div>
                <div className="legacy-lineup-form-board-disciplines">
                  {(["d1", "d2"] as const).map((disciplineSide) => {
                    const slot = disciplineSide === "d1" ? entry.discipline1 : entry.discipline2;
                    const plan = formCardPlanByKey.get(`${entry.matchdayId}:${disciplineSide}`) ?? null;
                    const selectedCard = (context?.formCards ?? []).find((card) => card.id === plan?.primaryFormCardId) ?? null;
                    const selectedBonusCard =
                      (context?.formCards ?? []).find((card) => card.id === plan?.secondaryFormCardId && card.value > 0) ?? null;
                    const rank = resolveTeamDisciplineRank(context?.teamDisciplineRanks, slot?.disciplineId ?? null, slot?.displayName ?? null);
                    const disciplineColor = getFormCardColorForCategory(slot?.category ?? null);
                    const planImpact = formatFormPlanImpact(selectedCard, selectedBonusCard, disciplineColor);
                    const pendingKey = `${entry.matchdayId}:${disciplineSide}`;
                    const playerCount = slot?.playerCount ?? null;
                    const hasPlannedCards = Boolean(selectedCard || selectedBonusCard);
                    const matchingFreeCount = disciplineColor ? freeCardCountByColor[disciplineColor] : 0;
                    const isPrimaryActive =
                      activeFormPickCell?.matchdayId === entry.matchdayId &&
                      activeFormPickCell.disciplineSide === disciplineSide &&
                      activeFormPickCell.slot === "primary";
                    const isSecondaryActive =
                      activeFormPickCell?.matchdayId === entry.matchdayId &&
                      activeFormPickCell.disciplineSide === disciplineSide &&
                      activeFormPickCell.slot === "secondary";

                    return (
                      <section
                        key={`${entry.matchdayId}-${disciplineSide}`}
                        className={`legacy-lineup-form-board-cell is-${disciplineColor ?? "neutral"}${isCurrentMatchday ? " is-current-side" : ""}${isPrimaryActive || isSecondaryActive ? " is-flow-focus" : ""}`}
                      >
                        <div className="legacy-lineup-form-board-discipline-head">
                          <DisciplineIcon disciplineId={slot?.disciplineId ?? null} label={slot?.displayName ?? "—"} className="legacy-lineup-form-board-discipline-icon" />
                          <span>{disciplineSide.toUpperCase()}</span>
                        </div>
                        {/*
                          Chancen-Zeile: macht pro Zelle explizit, was vorher nur als
                          Hintergrund-Tönung kodiert war — welche Kartenfarbe hier doppelt
                          zählt und wie viele passende Karten dafür noch frei sind. Dazu der
                          Planungs-Status (geplant/offen), damit man die Timeline scannen
                          kann, ohne jede F1/F2-Zelle einzeln zu lesen.
                        */}
                        {!isCompactMatchday ? (
                          <div className="legacy-lineup-form-board-cell-chance">
                            {disciplineColor ? (
                              <span
                                className={`legacy-lineup-form-card-chip legacy-lineup-form-board-match-chip is-${disciplineColor}`}
                                title={`Farbmatch: ${formatFormCardColorLabel(disciplineColor)}-Karten zählen in dieser Disziplin doppelt · ${matchingFreeCount} passende Karte(n) frei.`}
                              >
                                <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                                x2 {formatFormCardColorLabel(disciplineColor)} · {matchingFreeCount} frei
                              </span>
                            ) : null}
                            {hasPlannedCards ? (
                              <span className="legacy-lineup-form-board-cell-flag is-planned">✓ geplant</span>
                            ) : !isPastMatchday ? (
                              <span className="legacy-lineup-form-board-cell-flag is-open">offen</span>
                            ) : null}
                          </div>
                        ) : null}
                        {/*
                          Rank/Spieler/Impact stehen in JEDER Zelle — auch bei weit
                          entfernten Spieltagen. Genau dort plant man ja voraus, und
                          ohne den Disziplin-Rang fehlt die einzige Information, an der
                          man entscheidet, wo eine knappe Karte hingehört. Die
                          Kompakt-Ansicht spart weiter Platz (Chancen-Zeile bleibt aus,
                          der Streifen läuft mit engeren Abständen).
                        */}
                        <VeloImpactStrip
                          className={`legacy-lineup-form-board-cell-velo-strip${isCompactMatchday ? " is-compact" : ""}`}
                          items={[
                            {
                              key: "rank",
                              label: "Rank",
                              value: rank != null ? `#${rank}` : "—",
                              // Top-3-Disziplinen sind die aussichtsreichsten Einsätze für
                              // knappe Ressourcen — dezent grün markiert, Rest bleibt neutral.
                              tone: rank != null && rank <= 3 ? "positive" : "neutral",
                            },
                            {
                              key: "players",
                              label: "Spieler",
                              value: playerCount != null ? String(playerCount) : "—",
                              tone: "neutral",
                            },
                            {
                              key: "impact",
                              label: "Impact",
                              value: planImpact,
                              tone: hasPlannedCards ? "positive" : "neutral",
                            },
                          ]}
                        />
                        <div className="legacy-lineup-form-board-chip-picks">
                          <button
                            type="button"
                            data-form-board-cell-id={`${entry.matchdayId}:${disciplineSide}:primary`}
                            aria-pressed={isPrimaryActive}
                            className={`legacy-lineup-form-board-pick is-primary${isPrimaryActive ? " is-active" : ""}${selectedCard ? ` is-${selectedCard.color}` : ""}${getDragOverClassName(`${entry.matchdayId}:${disciplineSide}:primary`, {
                              matchdayId: entry.matchdayId,
                              disciplineSide,
                              slot: "primary",
                              disciplineColor,
                            })}`}
                            disabled={isReadOnly || formCardPlanPendingKey === pendingKey || !slot}
                            onDragOver={(event) =>
                              handleDragOverCell(event, `${entry.matchdayId}:${disciplineSide}:primary`, {
                                matchdayId: entry.matchdayId,
                                disciplineSide,
                                slot: "primary",
                                disciplineColor,
                              })
                            }
                            onDragLeave={() => setDragOverCellId(null)}
                            onDrop={(event) =>
                              handleDropOnCell(event, {
                                matchdayId: entry.matchdayId,
                                disciplineSide,
                                disciplineId: slot?.disciplineId ?? null,
                                slot: "primary",
                                disciplineColor,
                              })
                            }
                            onClick={() =>
                              setActiveFormPickCell({
                                matchdayId: entry.matchdayId,
                                disciplineSide,
                                slot: "primary",
                                disciplineId: slot?.disciplineId ?? null,
                                disciplineColor,
                              })
                            }
                          >
                            <span>F1</span>
                            {selectedCard ? renderSelectedFormCardChip(selectedCard.id, disciplineColor) : <em>wählen</em>}
                          </button>
                          <button
                            type="button"
                            data-form-board-cell-id={`${entry.matchdayId}:${disciplineSide}:secondary`}
                            aria-pressed={isSecondaryActive}
                            className={`legacy-lineup-form-board-pick is-secondary${isSecondaryActive ? " is-active" : ""}${selectedBonusCard ? ` is-${selectedBonusCard.color}` : ""}${getDragOverClassName(`${entry.matchdayId}:${disciplineSide}:secondary`, {
                              matchdayId: entry.matchdayId,
                              disciplineSide,
                              slot: "secondary",
                              disciplineColor,
                            })}`}
                            disabled={isReadOnly || formCardPlanPendingKey === pendingKey || !slot}
                            onDragOver={(event) =>
                              handleDragOverCell(event, `${entry.matchdayId}:${disciplineSide}:secondary`, {
                                matchdayId: entry.matchdayId,
                                disciplineSide,
                                slot: "secondary",
                                disciplineColor,
                              })
                            }
                            onDragLeave={() => setDragOverCellId(null)}
                            onDrop={(event) =>
                              handleDropOnCell(event, {
                                matchdayId: entry.matchdayId,
                                disciplineSide,
                                disciplineId: slot?.disciplineId ?? null,
                                slot: "secondary",
                                disciplineColor,
                              })
                            }
                            onClick={() =>
                              setActiveFormPickCell({
                                matchdayId: entry.matchdayId,
                                disciplineSide,
                                slot: "secondary",
                                disciplineId: slot?.disciplineId ?? null,
                                disciplineColor,
                              })
                            }
                          >
                            <span>F2+</span>
                            {selectedBonusCard ? renderSelectedFormCardChip(selectedBonusCard.id, disciplineColor) : <em>wählen</em>}
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {usedFormCards.length > 0 ? (
        <div className="legacy-lineup-form-board-used">
          <span>Bereits genutzt</span>
          <div className="legacy-lineup-used-form-card-list">
            {usedFormCards.map((card) => (
              <span key={`form-board-used-${card.id}`} className={`legacy-lineup-form-card-chip legacy-lineup-used-form-card is-${card.color}`}>
                <span className="legacy-lineup-form-card-dot" aria-hidden="true" />
                {formatFormCardValueLabel(card.value)} Punkte · {formatFormCardColorLabel(card.color)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
