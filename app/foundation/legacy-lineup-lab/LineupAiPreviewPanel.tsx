"use client";

import type { AiLegacyLineupPreview, AiLegacyLineupSuggestionSide } from "@/lib/ai/ai-needs-types";
import {
  describeAiPreviewStatus,
  getAiPreviewStatusTone,
  type AiBatchApplyResponse,
  type AiBatchPreviewEntry,
  type AiBatchPreviewSummary,
} from "@/lib/ai/ai-legacy-lineup-batch-types";

/**
 * DIE BEDIENUNG DER KI-VORSCHAU — zurueck auf den Schirm.
 *
 * ENTSCHEIDUNG VON CHRIS aus der Test-Triage: „ki vorschau -> bedienung zurück".
 *
 * Der Befund davor, nachgemessen und nicht vermutet: im Lab-Client gab es die komplette Mechanik —
 * `handleAiPreview`, `handleAiPreviewAllTeams`, `handleAdoptAiPreview`, `handleSaveAiPreview`,
 * `handleAiBatchApply`, `handleOpenAiBatchDetails` — und KEINER dieser sechs Handler hatte einen
 * Aufrufer. Auch `isAiPreviewPanelOpen` wurde gesetzt und nirgends gelesen. Die Vorschau lief also
 * vollstaendig, schrieb ihr Ergebnis in den Zustand, und der Zustand wurde nie gezeichnet.
 *
 * Das ist derselbe Fehlertyp, der in diesem Projekt schon mehrfach auffiel: eine Rechnung
 * existiert, der gezeichnete Pfad bekommt sie nur nie. Optionale Props und ungenutzte Funktionen
 * loesen keinen Typfehler aus — es faellt erst auf, wenn jemand die Funktion sucht.
 *
 * HIER WIRD NICHT GERECHNET. Die Komponente formatiert ausschliesslich, was ihr gereicht wird, und
 * ruft die Handler des Clients auf. Status-Wort und Ton kommen aus
 * `ai-legacy-lineup-batch-types.ts`, damit Einzel- und Stapelansicht dasselbe Wort benutzen.
 */
export function LineupAiPreviewPanel({
  isOpen,
  onClose,
  canPreviewSelectedTeam,
  selectedTeamIsAi,
  isBusy,
  isReadOnly,
  preview,
  batchEntries,
  batchSummary,
  batchApplyFeed,
  includeWarnings,
  onIncludeWarningsChange,
  overwriteExisting,
  onOverwriteExistingChange,
  onPreviewTeam,
  onPreviewAllTeams,
  onAdoptPreview,
  onSavePreview,
  onOpenBatchDetails,
  onBatchApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  canPreviewSelectedTeam: boolean;
  selectedTeamIsAi: boolean;
  isBusy: boolean;
  isReadOnly: boolean;
  preview: AiLegacyLineupPreview | null;
  batchEntries: AiBatchPreviewEntry[];
  batchSummary: AiBatchPreviewSummary | null;
  batchApplyFeed: AiBatchApplyResponse | null;
  includeWarnings: boolean;
  onIncludeWarningsChange: (next: boolean) => void;
  overwriteExisting: boolean;
  onOverwriteExistingChange: (next: boolean) => void;
  onPreviewTeam: () => void;
  onPreviewAllTeams: () => void;
  onAdoptPreview: () => void;
  onSavePreview: () => void;
  onOpenBatchDetails: (entry: AiBatchPreviewEntry) => void;
  onBatchApply: (dryRun: boolean) => void;
}) {
  return (
    <div className="nl-ai-preview" data-testid="lineup-ai-preview">
      <div className="nl-ai-preview-actions">
        <button
          type="button"
          className="nl-lineup-btn"
          disabled={isBusy || !canPreviewSelectedTeam}
          title={
            selectedTeamIsAi
              ? "KI-Vorschlag für dieses Team laden und in die Slots übernehmen"
              : "Nur für KI-gesteuerte Teams — dieses Team wird manuell geführt."
          }
          onClick={onPreviewTeam}
        >
          KI-Vorschlag für dieses Team
        </button>
        <button
          type="button"
          className="nl-lineup-btn"
          disabled={isBusy}
          title="Alle KI-Teams dieses Spieltags auf einmal vorschauen — es wird nichts gespeichert."
          onClick={onPreviewAllTeams}
        >
          Alle KI-Teams vorschauen
        </button>
        {isOpen ? (
          <button type="button" className="nl-lineup-btn is-ghost" onClick={onClose}>
            Vorschau schließen
          </button>
        ) : null}
      </div>

      {isOpen && preview ? (
        <AiSinglePreview
          preview={preview}
          isBusy={isBusy}
          isReadOnly={isReadOnly}
          onAdoptPreview={onAdoptPreview}
          onSavePreview={onSavePreview}
        />
      ) : null}

      {isOpen && !preview && batchEntries.length > 0 ? (
        <AiBatchPreview
          entries={batchEntries}
          summary={batchSummary}
          applyFeed={batchApplyFeed}
          isBusy={isBusy}
          isReadOnly={isReadOnly}
          includeWarnings={includeWarnings}
          onIncludeWarningsChange={onIncludeWarningsChange}
          overwriteExisting={overwriteExisting}
          onOverwriteExistingChange={onOverwriteExistingChange}
          onOpenBatchDetails={onOpenBatchDetails}
          onBatchApply={onBatchApply}
        />
      ) : null}
    </div>
  );
}

function AiSinglePreview({
  preview,
  isBusy,
  isReadOnly,
  onAdoptPreview,
  onSavePreview,
}: {
  preview: AiLegacyLineupPreview;
  isBusy: boolean;
  isReadOnly: boolean;
  onAdoptPreview: () => void;
  onSavePreview: () => void;
}) {
  const tone = getAiPreviewStatusTone({
    status: preview.status,
    warnings: preview.warnings ?? [],
    blockingReasons: [],
  });
  return (
    <div className="nl-ai-preview-body" data-testid="lineup-ai-preview-single" data-tone={tone}>
      <div className="nl-ai-preview-head">
        <strong>
          {preview.teamName} · {describeAiPreviewStatus(preview.status)}
        </strong>
        <span className="nl-tnum">{preview.totalExpectedScore.toFixed(1)} erwartete Punkte</span>
      </div>
      {preview.explanation ? <small>{preview.explanation}</small> : null}

      <div className="nl-ai-preview-sides">
        <AiPreviewSide side={preview.d1} />
        <AiPreviewSide side={preview.d2} />
      </div>

      {/* Die Captain-Begruendungen sind ausdruecklich KEINE Warnungen — sie stehen deshalb in
          einem eigenen Block und nicht im Warnungskanal. */}
      {preview.captainDecisions?.length ? (
        <ul className="nl-ai-preview-notes">
          {preview.captainDecisions.map((decision, index) => (
            <li key={`${decision}-${index}`}>{decision}</li>
          ))}
        </ul>
      ) : null}

      {preview.warnings?.length ? (
        <ul className="nl-ai-preview-warnings">
          {preview.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="nl-ai-preview-actions">
        <button type="button" className="nl-lineup-btn" disabled={isBusy} onClick={onAdoptPreview}>
          In die Slots übernehmen
        </button>
        <button
          type="button"
          className="nl-lineup-btn is-primary"
          disabled={isBusy || isReadOnly}
          title={isReadOnly ? "Referenzmodus ist nur zum Anschauen." : "AI-Vorschlag lokal speichern"}
          onClick={onSavePreview}
        >
          Vorschlag speichern
        </button>
      </div>
    </div>
  );
}

function AiPreviewSide({ side }: { side: AiLegacyLineupSuggestionSide }) {
  return (
    <div className="nl-ai-preview-side" data-side={side.disciplineSide}>
      <strong>{side.disciplineName ?? side.disciplineSide.toUpperCase()}</strong>
      <span className="nl-tnum">
        {side.selectedPlayers} / {side.requiredPlayers} Plätze
        {side.missingSlots > 0 ? ` · ${side.missingSlots} offen` : ""}
      </span>
      <span>Captain: {side.captainName ?? "keiner"}</span>
      <span className="nl-tnum">{side.expectedScore.toFixed(1)} Punkte</span>
    </div>
  );
}

function AiBatchPreview({
  entries,
  summary,
  applyFeed,
  isBusy,
  isReadOnly,
  includeWarnings,
  onIncludeWarningsChange,
  overwriteExisting,
  onOverwriteExistingChange,
  onOpenBatchDetails,
  onBatchApply,
}: {
  entries: AiBatchPreviewEntry[];
  summary: AiBatchPreviewSummary | null;
  applyFeed: AiBatchApplyResponse | null;
  isBusy: boolean;
  isReadOnly: boolean;
  includeWarnings: boolean;
  onIncludeWarningsChange: (next: boolean) => void;
  overwriteExisting: boolean;
  onOverwriteExistingChange: (next: boolean) => void;
  onOpenBatchDetails: (entry: AiBatchPreviewEntry) => void;
  onBatchApply: (dryRun: boolean) => void;
}) {
  return (
    <div className="nl-ai-preview-body" data-testid="lineup-ai-preview-batch">
      {summary ? (
        <div className="nl-ai-preview-head">
          <strong>{summary.totalTeams} KI-Teams</strong>
          <span className="nl-tnum">
            {summary.readyTeams} bereit · {summary.warningTeams} mit Hinweis · {summary.blockedTeams} blockiert
          </span>
        </div>
      ) : null}

      <ul className="nl-ai-preview-list">
        {entries.map((entry) => {
          const tone = getAiPreviewStatusTone(entry);
          return (
            <li key={entry.teamId} data-tone={tone}>
              <button
                type="button"
                className="nl-ai-preview-row"
                disabled={isBusy}
                title="Dieses Team öffnen und den Vorschlag im Detail ansehen"
                onClick={() => onOpenBatchDetails(entry)}
              >
                <span className="nl-ai-preview-row-team">{entry.teamName}</span>
                <span className="nl-ai-preview-row-status">{describeAiPreviewStatus(entry.status)}</span>
                <span className="nl-tnum">
                  {entry.d1SelectedPlayers + entry.d2SelectedPlayers} / {entry.d1RequiredPlayers + entry.d2RequiredPlayers}
                </span>
                <span className="nl-tnum">{entry.totalExpectedScore.toFixed(1)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="nl-ai-preview-options">
        <label>
          <input
            type="checkbox"
            checked={includeWarnings}
            disabled={isBusy}
            onChange={(event) => onIncludeWarningsChange(event.target.checked)}
          />
          <span>Teams mit Hinweis einschließen</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={overwriteExisting}
            disabled={isBusy}
            onChange={(event) => onOverwriteExistingChange(event.target.checked)}
          />
          <span>Bestehende Einsatzlisten ersetzen</span>
        </label>
      </div>

      {/* DER PROBELAUF IST PFLICHT, nicht Zierde: `handleAiBatchApply(false)` verlangt einen
          vorherigen Trockenlauf, weil es sonst keine Zahl gaebe, die der Nutzer bestaetigt. */}
      <div className="nl-ai-preview-actions">
        <button type="button" className="nl-lineup-btn" disabled={isBusy || isReadOnly} onClick={() => onBatchApply(true)}>
          Probelauf
        </button>
        <button
          type="button"
          className="nl-lineup-btn is-primary"
          disabled={isBusy || isReadOnly || !applyFeed?.dryRun}
          title={applyFeed?.dryRun ? "Vorschläge jetzt lokal speichern" : "Erst Probelauf — dann steht die Zahl, die du bestätigst."}
          onClick={() => onBatchApply(false)}
        >
          Speichern
        </button>
      </div>

      {applyFeed ? (
        <small className="nl-ai-preview-feed">
          {applyFeed.dryRun ? "Probelauf: " : "Gespeichert: "}
          {applyFeed.dryRun ? applyFeed.summary.plannedLineups : applyFeed.summary.savedTeams} Einsatzlisten
          {applyFeed.summary.wouldOverwrite > 0 && applyFeed.dryRun
            ? ` · ${applyFeed.summary.wouldOverwrite} bestehende würden ersetzt`
            : ""}
          {applyFeed.summary.skippedBlocked > 0 ? ` · ${applyFeed.summary.skippedBlocked} blockiert` : ""}
          {applyFeed.summary.skippedWarning > 0 ? ` · ${applyFeed.summary.skippedWarning} mit Hinweis übersprungen` : ""}
        </small>
      ) : null}
    </div>
  );
}
