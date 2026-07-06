"use client";

import type { DragEvent, ReactNode } from "react";
import { useMemo, useState } from "react";

import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import { VeloImpactStrip } from "@/components/foundation/velo-ui";
import type { FormCardPlanRecord, LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type { LegacyFormCardOption, LegacyLineupDraft, LegacyLineupLoadedContext, LegacyModifierSourceSummary } from "@/lib/lineups/legacy-lineup-types";

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
  activeFormPickCell: FormBoardPickCell | null;
  formCardPlanByKey: Map<string, FormCardPlanRecord>;
  formCardPlanPendingKey: string | null;
  usedFormCards: LegacyFormCardOption[];
  isReadOnly: boolean;
  matchdayId: string;
  matchdayOptions: Array<{ id: string; matchdayIndex?: number; index?: number }>;
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
  activeFormPickCell,
  formCardPlanByKey,
  formCardPlanPendingKey,
  usedFormCards,
  isReadOnly,
  matchdayId,
  matchdayOptions,
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
          <span>Saison-Formkarten</span>
          <strong>Formplan</strong>
        </div>
        <div className="legacy-lineup-form-board-head-stats">
          <span className="pill">{formPlanOpenCells} offen</span>
          <span className="pill">{formDeckCards.filter((card) => !card.isUsed && !card.isReserved).length} frei</span>
          <span className="pill">Form {formatModifierSourceLabel(context?.formCardSource)}</span>
        </div>
      </div>
      <div className="legacy-lineup-form-board-sync-banner" aria-label="Heute-Status">
        <span className={modifiers.d1.primaryFormCardId || modifiers.d2.primaryFormCardId ? "is-ready" : "is-warning"}>
          Plan → Entwurf {modifiers.d1.primaryFormCardId || modifiers.d2.primaryFormCardId ? "sync ✓" : "optional — kein Einsatz"}
        </span>
        <span className={draft ? "is-ready" : "is-warning"}>Gespeichert {draft ? "✓" : "⚠"}</span>
      </div>
      <p className="legacy-lineup-form-board-hint">
        Beide Slots sind optional. F1 ± · F2 nur positiv. Negative bis Saisonende abwerfen — offene Negative kosten Strafpunkte.
      </p>
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
            <strong>{activeFormPickCell ? "Karte wählen" : "Zelle links aktivieren"}</strong>
            <span className="legacy-lineup-form-deck-count">
              {formDeckCards.filter((card) => !card.isUsed && !card.isReserved).length} frei · {formDeckCards.length} gesamt
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
            const currentMatchdayIndex =
              matchdayOptions.find((matchday) => matchday.id === matchdayId)?.matchdayIndex ??
              matchdayOptions.find((matchday) => matchday.id === matchdayId)?.index ??
              context?.matchday.index ??
              entry.matchdayIndex;
            const matchdayDistance = Math.abs(entry.matchdayIndex - currentMatchdayIndex);
            const isCompactMatchday = !isCurrentMatchday && matchdayDistance > 2;
            return (
              <article
                key={`form-board-${entry.matchdayId}`}
                className={`legacy-lineup-form-timeline-entry${isCurrentMatchday ? " is-current" : ""}${isCompactMatchday ? " is-compact" : ""}`}
              >
                <div className="legacy-lineup-form-board-matchday">
                  <span>Spieltag {entry.matchdayIndex}</span>
                  <strong>{entry.matchdayLabel}</strong>
                  <small>{isCurrentMatchday ? "Heute" : "Plan"}</small>
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
                        {!isCompactMatchday ? (
                          <VeloImpactStrip
                            className="legacy-lineup-form-board-cell-velo-strip"
                            items={[
                              { key: "rank", label: "Rank", value: rank != null ? `#${rank}` : "—", tone: "neutral" },
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
                                tone: selectedCard || selectedBonusCard ? "positive" : "neutral",
                              },
                            ]}
                          />
                        ) : null}
                        <div className="legacy-lineup-form-board-chip-picks">
                          <button
                            type="button"
                            data-form-board-cell-id={`${entry.matchdayId}:${disciplineSide}:primary`}
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
