"use client";

/**
 * SAISONABSCHLUSS — die Bühne für das Ende einer Saison.
 *
 * "Ich habe jetzt die 10 Spieltage durch, was passiert nun? Der Button Saison vorbereiten
 * bringt gar nichts und bringt mich auch nicht weiter … was mich dann aber auf diesen
 * Debug-Screen bringt wo ich gar nicht hin will."
 *
 * Die Mechanik war komplett vorhanden — Endstand, Auszeichnungen, Board-Abrechnung,
 * Preisgeld, Entwicklung, Saisonwechsel. Nur lag sie im Cockpit, einem Werkzeugkasten mit
 * Vokabeln wie "Preview laden", "Blocker prüfen" und "salary_explosion". Der Flow schickte
 * den Spieler am Saisonende genau dorthin.
 *
 * Diese Ansicht erfindet nichts nach: Daten kommen aus `buildSeasonReview(gameState)`
 * (Meister, Endtabelle, Auszeichnungen, Board-Abrechnung), die Aktionen sind dieselben
 * Handler, die auch das Cockpit aufruft. Neu ist ausschließlich die REIHENFOLGE und die
 * Sprache: was ist passiert → was steht an → ein Knopf je Schritt.
 */
import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonReview } from "@/lib/season/season-review-service";
import type { SeasonEndPayoutStatus } from "@/lib/season/season-end-sponsor-payout-status";

export type SeasonFinaleStepState = "done" | "ready" | "blocked" | "busy";

export type FoundationSeasonFinalePanelProps = {
  gameState: GameState;
  activeTeamId: string | null;
  /**
   * Steht das Sponsorgeld dieser Saison auf dem Konto?
   *
   * Frueher hiess dieser Prop `prizeApplied` und beantwortete eine andere Frage: ob ein
   * Audit-Log existiert. Das ist nicht dasselbe — ein Spielstand, in dem der Schritt vor
   * der Buchungs-Reparatur lief, traegt ein Log OHNE Zahlung. Dort stand „erledigt · das
   * Geld steht auf dem Konto" ueber unveraendertem Cash, und der Knopf war weg.
   *
   * `pending_payout` ist genau dieser Fall: angestossen, aber nicht gebucht — nachholbar.
   */
  seasonEndPayoutStatus: SeasonEndPayoutStatus;
  /** Spielerentwicklung der Saison ist bereits angewendet. */
  developmentApplied: boolean;
  /** Vorschau des Saisonwechsels liegt vor und ist ohne Blocker. */
  nextSeasonReady: boolean;
  /** Irgendeine Saisonende-Aktion läuft gerade. */
  busy: boolean;
  /** Nur-Lesen (fremder Spielstand) — dann keine schreibenden Knöpfe. */
  readOnly: boolean;
  onApplyPrize: () => void;
  onLoadNextSeasonPreview: () => void;
  onStartNextSeason: () => void;
  onOpenDevelopment: () => void;
  onOpenRoster: () => void;
};

function formatValue(value: number | string | null): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Auslaufende Verträge des eigenen Teams — Restlaufzeit 1 oder weniger. */
function countExpiringContracts(gameState: GameState, teamId: string | null): number {
  if (!teamId) return 0;
  return gameState.rosters.filter((entry) => entry.teamId === teamId && (entry.contractLength ?? 0) <= 1).length;
}

export default function FoundationSeasonFinalePanel(props: FoundationSeasonFinalePanelProps) {
  const {
    gameState,
    activeTeamId,
    seasonEndPayoutStatus,
    developmentApplied,
    nextSeasonReady,
    busy,
    readOnly,
    onApplyPrize,
    onLoadNextSeasonPreview,
    onStartNextSeason,
    onOpenDevelopment,
    onOpenRoster,
  } = props;

  // `buildSeasonReview` ist rein und liest nur den GameState — es gibt hier nichts zu
  // laden. Memoisiert, weil es die komplette Saison durchrechnet.
  const review = useMemo(() => buildSeasonReview(gameState), [gameState]);
  const expiringContracts = useMemo(
    () => countExpiringContracts(gameState, activeTeamId),
    [gameState, activeTeamId],
  );

  const ownRankIndex = activeTeamId ? review.finalTable.findIndex((row) => row.id === activeTeamId) : -1;
  const ownRow = ownRankIndex >= 0 ? review.finalTable[ownRankIndex] : null;
  const ownObjectives = activeTeamId ? review.objectiveSettlement.byTeamId?.[activeTeamId] ?? null : null;
  const isChampion = Boolean(activeTeamId && review.championTeam?.id === activeTeamId);

  const steps: Array<{
    key: string;
    title: string;
    detail: string;
    state: SeasonFinaleStepState;
    action: { label: string; onClick: () => void } | null;
  }> = [
    /**
     * Drei Zustaende, nicht zwei. „Angestossen" und „bezahlt" sind verschiedene Dinge —
     * sie gleichzusetzen war der Fehler, an dem ein Spielstand mit unveraendertem Cash
     * als „erledigt" dastand und der Knopf nicht mehr anfassbar war.
     */
    {
      key: "prize",
      title: "Sponsoren & Preisgeld buchen",
      detail:
        seasonEndPayoutStatus === "paid"
          ? "Ist gebucht — Sponsorgeld abzüglich Gehälter steht auf dem Konto."
          : seasonEndPayoutStatus === "pending_payout"
            ? "Der Schritt lief, aber das Geld ist nie geflossen — das war ein Fehler und ist behoben. Jetzt nachbuchen."
            : "Sponsorgeld wird abzüglich Gehälter gutgeschrieben.",
      state:
        seasonEndPayoutStatus === "paid" ? "done" : busy ? "busy" : "ready",
      action:
        seasonEndPayoutStatus === "paid" || readOnly
          ? null
          : {
              label: seasonEndPayoutStatus === "pending_payout" ? "Jetzt nachbuchen" : "Sponsoren buchen",
              onClick: onApplyPrize,
            },
    },
    {
      key: "development",
      title: "Spielerentwicklung ansehen",
      detail: developmentApplied
        ? "Die Saison hat auf deine Spieler gewirkt — im Training siehst du, wer sich wie entwickelt hat."
        : "Wird beim Start der neuen Saison angewendet. Vorher kannst du dir ansehen, was ansteht.",
      state: developmentApplied ? "done" : "ready",
      action: { label: "Zum Training", onClick: onOpenDevelopment },
    },
    {
      key: "contracts",
      title:
        expiringContracts > 0
          ? `Auslaufende Verträge (${expiringContracts})`
          : "Verträge — nichts läuft aus",
      detail:
        expiringContracts > 0
          ? "Diese Spieler verlassen dich, wenn du nicht verlängerst. Im Kader kannst du verhandeln."
          : "Kein Vertrag läuft zum Saisonende aus.",
      state: expiringContracts > 0 ? "ready" : "done",
      action: expiringContracts > 0 ? { label: "Zum Kader", onClick: onOpenRoster } : null,
    },
    {
      key: "next-season",
      title: "Neue Saison starten",
      detail: nextSeasonReady
        ? "Alles geprüft. Der Start schreibt Entwicklung, neuen Spielplan und Formkarten."
        : "Erst prüfen lassen, was der Saisonwechsel verändert — dann starten.",
      state: readOnly ? "blocked" : busy ? "busy" : "ready",
      action: readOnly
        ? null
        : nextSeasonReady
          ? { label: "Neue Saison starten", onClick: onStartNextSeason }
          : { label: "Saisonwechsel prüfen", onClick: onLoadNextSeasonPreview },
    },
  ];

  return (
    <section className="panel nl-season-finale" id="season-finale" data-testid="season-finale">
      <header className="nl-season-finale-hero">
        <span className="nl-season-finale-eyebrow">Saison abgeschlossen</span>
        <h2>
          {isChampion
            ? "Du bist Champion."
            : ownRow
              ? `Platz ${ownRankIndex + 1} zum Saisonende`
              : "Die Saison ist durch"}
        </h2>
        <p className="nl-season-finale-sub">
          {review.championTeam
            ? `Meister: ${review.championTeam.name}${
                review.championTeam.value != null ? ` · ${formatValue(review.championTeam.value)} Punkte` : ""
              }`
            : "Kein Meister ermittelt."}
          {ownRow?.value != null ? ` · Du: ${formatValue(ownRow.value)} Punkte` : ""}
        </p>
      </header>

      {/* AUSZEICHNUNGEN. Die gab es schon lange — `buildSeasonReview` vergibt Champion,
          Player of the Season, MVS King, PPs King, Best Transfer und Discipline Monster.
          Sie standen nur im Cockpit und damit faktisch nirgends. */}
      {review.awards.length > 0 ? (
        <div className="nl-season-finale-awards" data-testid="season-finale-awards">
          <h3>Auszeichnungen</h3>
          <ul>
            {review.awards.map((award) => (
              <li key={award.awardId} className={`nl-season-finale-award is-${award.category}`}>
                <span className="nl-season-finale-award-label">{award.label}</span>
                <strong>{award.winnerName}</strong>
                <small>{award.reason}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* BOARD-ABRECHNUNG. Ein verfehltes Ziel ist hier eine Bilanz, kein Hindernis —
          deshalb steht es als Ergebnis da und nicht als Warnung am Weiter-Knopf. */}
      {ownObjectives ? (
        <div className="nl-season-finale-board" data-testid="season-finale-board">
          <h3>Deine Saisonziele</h3>
          <p>
            <strong>{ownObjectives.completed}</strong> erfüllt · <strong>{ownObjectives.failed}</strong> verfehlt
            {ownObjectives.open > 0 ? <> · {ownObjectives.open} offen</> : null}
          </p>
          <ul>
            {review.objectiveSettlement.rows
              .filter((row) => row.teamId === activeTeamId)
              .map((row) => (
                <li key={row.objectiveId ?? row.label} className={`is-${row.status}`}>
                  <span>{row.label}</span>
                  <small>{row.status === "completed" ? "erfüllt" : row.status === "failed" ? "verfehlt" : "offen"}</small>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="nl-season-finale-steps" data-testid="season-finale-steps">
        <h3>Das steht jetzt an</h3>
        <ol>
          {steps.map((step) => (
            <li key={step.key} className={`nl-season-finale-step is-${step.state}`} data-step={step.key}>
              <div className="nl-season-finale-step-text">
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </div>
              {step.action ? (
                <button
                  type="button"
                  className="primary-button inline-button"
                  disabled={busy || readOnly}
                  onClick={step.action.onClick}
                >
                  {step.action.label}
                </button>
              ) : (
                <span className="nl-season-finale-step-done">{step.state === "done" ? "erledigt" : "—"}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
