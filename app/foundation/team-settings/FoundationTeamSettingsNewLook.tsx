"use client";

import { useState, type ReactNode } from "react";

import { parseFoundationTabFromUrl } from "@/lib/foundation/foundation-url-state";

import {
  NlCard,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
} from "@/components/foundation/new-look";
import type { FoundationTeamSettingsPanelProps } from "@/app/foundation/team-settings/FoundationTeamSettingsPanel";
import {
  FOUNDATION_SAVE_MODE_OPTIONS,
  NEW_GAME_PRESET_DEFAULTS,
  NEW_GAME_VISIBLE_PRESET_IDS,
} from "@/app/foundation/foundation-page-client-exports";
import type { NewGamePresetId, TeamStrategyProfile } from "@/app/foundation/foundation-page-client-exports";
import type {
  RosterEntry,
  Team,
  TeamControlSettings,
  TeamIdentity,
  TeamStrategyBias,
} from "@/lib/data/olyDataTypes";
import type {
  FoundationSeasonStartResetTeamRow,
  NewGameTeamPreview,
  TeamIdentityDraftMap,
  TeamStrategyDraftMap,
} from "@/lib/foundation/tabs/foundation-page-types";
import type { SaveSummary } from "@/lib/persistence/types";

/**
 * "Neuer Look" Team-Einstellungen (flag-gated, additiv).
 *
 * Wird ausschließlich aus `FoundationTeamSettingsHost` gerendert, wenn der
 * Runtime-Flag (`useNewLook`) aktiv ist — ohne Flag läuft der Tab unverändert
 * über `FoundationTeamSettingsPanel`. Konsumiert exakt dieselben Props und
 * Handler wie das alte Panel; KEIN Feature wurde entfernt:
 * Save-Verwaltung (Bereich, Wechsel, Neues Spiel, Season-Start-Reset,
 * Klonen/Snapshots), Team-Auswahl mit Suche, Spielmodus/Ownership,
 * AI-Automation, Identity-Rohwerte, Strategy-Profil (inkl. Legacy/Debug),
 * Export JSON, Speichern und Draft-Verwerfen.
 *
 * Neu ist nur die Struktur: eine Header-Karte mit Kennzahlen-Chips und
 * globalen Aktionen + vier Unterbereiche (NlSubTabs) statt einer sehr
 * langen Scroll-Seite.
 */

type NlTeamSettingsSection = "saves" | "team" | "control" | "strategy";

const NL_TEAMSETTINGS_SECTION_ITEMS: Array<{ id: NlTeamSettingsSection; label: string }> = [
  { id: "saves", label: "Spielstände & Start" },
  { id: "team", label: "Team-Fokus" },
  { id: "control", label: "Spielmodus & KI" },
  { id: "strategy", label: "Identity & Strategie" },
];

/** Beschriftetes Formularfeld (Label oben, Control darunter). */
function NlField({
  label,
  children,
  className,
  "data-testid": dataTestId,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <label className={["nl-teamsettings-field", className ?? ""].filter(Boolean).join(" ")} data-testid={dataTestId}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Kompakte Kennzahl-Kachel (Label / Wert / Fußnote). */
function NlMetric({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <article className="nl-teamsettings-metric">
      <span className="nl-teamsettings-metric-label">{label}</span>
      <strong className="nl-teamsettings-metric-value nl-tnum">{value}</strong>
      {sub != null ? <small className="nl-teamsettings-metric-sub">{sub}</small> : null}
    </article>
  );
}

export default function FoundationTeamSettingsNewLook(props: FoundationTeamSettingsPanelProps) {
  const {
    activeSaveGameMode,
    activeSaveId,
    activeSaveIsInCurrentMode,
    activeSaveName,
    activeSaveSummary,
    activeScenarioWarning,
    aiTeams,
    applyNewGamePreset,
    buildResolvedTeamIdentities,
    buildScenarioWarning,
    buildTeamControlSettingsMap,
    buildTeamIdentityDraftMap,
    buildTeamStrategyProfileMap,
    canonicalSeasonLabel,
    changeFoundationSaveMode,
    currentSaveOwnership,
    clampBiasValue,
    clampIdentityValue,
    deriveChrisFrankyTeamIdsFromSettings,
    exportSelectedTeamSettingsJson,
    filteredTeamSettingsTeams,
    formatCockpitReason,
    formatCsvList,
    formatFoundationSaveModeLabel,
    formatIdentityWeight,
    formatLocalePoints,
    formatMoney,
    formatScenarioTypeLabel,
    formatShortSaveId,
    formatTeamControlModeLabel,
    formatTransfermarktCurrency,
    foundationSaveMode,
    freshSeasonStartMessage,
    gameModeOwnershipChrisIds,
    gameModeOwnershipLimits,
    gameState,
    getBusyActionReason,
    getCockpitStatusLabel,
    getCockpitStatusPillClass,
    getReadOnlyActionReason,
    isSaveBusy,
    manualTeams,
    newGameBusy,
    newGameChrisTeamIds,
    newGameError,
    newGameFrankyTeamIds,
    newGamePresetId,
    newGamePreview,
    newGameSandbox,
    newGameSaveName,
    newGameSuccess,
    normalizeFoundationSaveMode,
    normalizeTeamStrategyLevel,
    openTeamProfileById,
    parseCsvList,
    passiveTeams,
    readMeta,
    readSourceLabel,
    resolveFoundationSaveMode,
    resolvedTeamControlSettings,
    runNewGameSetup,
    runSaveAction,
    runSeasonStartReset,
    saveSummaries,
    saveTeamSettings,
    seasonStartResetBusy,
    seasonStartResetFeed,
    selectTeamSettingsTeam,
    selectedHqGmStory,
    selectedIdentityAxisBias,
    selectedIdentityDraft,
    selectedRoster,
    selectedStandingRow,
    selectedTeam,
    selectedTeamControl,
    selectedTeamGeneralManager,
    selectedTeamGmAxisShares,
    selectedTeamGmBiasHighlights,
    selectedTeamHasUnsavedChanges,
    selectedTeamId,
    selectedTeamSettingsIndex,
    selectedTeamStrategyDraft,
    selectedTeamStrategyProfile,
    setActiveView,
    setFoundationView,
    setFreshSeasonStartMessage,
    setGameModeOwnershipChrisIds,
    setGameModeOwnershipFrankyIds,
    setNewGamePreview,
    setNewGameSandbox,
    setNewGameSaveName,
    setNewGameSoloTeam,
    setSoloPlayerTeam,
    setTeamControlDraft,
    setTeamControlMessage,
    setTeamIdentityDraft,
    setTeamIdentityMessage,
    setTeamSettingsSearch,
    setTeamStrategyDraft,
    setTeamStrategyMessage,
    teamControlDraft,
    teamIdentityFieldLabels,
    teamIdentityMessage,
    teamControlMessage,
    teamSettingsSearch,
    teamStrategyBiasFieldLabels,
    teamStrategyIdentityListFieldLabels,
    teamStrategyLevelFieldLabels,
    teamStrategyListFieldLabels,
    teamStrategyMessage,
    teamStrategySportsBiasAxisMap,
    teamStrategySportsBiasFieldLabels,
    toggleGameModeOwnershipTeam,
    toggleNewGameTeam,
    updateTeamControlDraft,
    updateTeamIdentityDraft,
    updateTeamStrategyDraft,
    withSynchronizedStrategyAliases,
  } = props;

  // Friction fix (Generalprobe #2): the HQ "Wähle dein Team" CTA deep-links via
  // `?view=teamSettings&tab=control`, so honor that tab on mount and open the
  // "Spielmodus & KI" sub-tab (where `solo-player-team-select` lives) directly.
  const [activeSection, setActiveSection] = useState<NlTeamSettingsSection>(() => {
    const tab = typeof window !== "undefined" ? parseFoundationTabFromUrl() : null;
    if (tab === "control" || tab === "team" || tab === "strategy" || tab === "saves") {
      return tab;
    }
    return "saves";
  });

  const exportDisabledReason = !selectedTeam
    ? "Wähle zuerst ein Team aus."
    : !selectedIdentityDraft || !selectedTeamStrategyDraft
      ? "Für dieses Team fehlen noch lokale Identity- oder Strategy-Daten."
      : null;

  /** Draft-Verwerfen: identisch zum alten Panel (Identity/Control/Strategy). */
  function discardDrafts() {
    const savedSettings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
    const savedOwnership = deriveChrisFrankyTeamIdsFromSettings(gameState.teams, savedSettings);
    setTeamIdentityDraft(buildTeamIdentityDraftMap(gameState.teams, gameState.teamIdentities));
    setTeamControlDraft(savedSettings);
    setGameModeOwnershipChrisIds(savedOwnership.chrisTeamIds);
    setGameModeOwnershipFrankyIds(savedOwnership.frankyTeamIds);
    setTeamStrategyDraft(
      buildTeamStrategyProfileMap(gameState.teams, gameState.teamIdentities, gameState.seasonState.teamStrategyProfiles),
    );
    setTeamIdentityMessage("Nicht gespeicherte Team-Identity-Änderungen wurden verworfen.");
    setTeamControlMessage("Nicht gespeicherte Änderungen wurden verworfen.");
    setTeamStrategyMessage("Nicht gespeicherte Strategy-Profile wurden verworfen.");
  }

  function renderMessages() {
    if (!teamIdentityMessage && !teamControlMessage && !teamStrategyMessage) {
      return null;
    }
    return (
      <div className="nl-teamsettings-messages" role="status">
        {teamIdentityMessage ? <p className="nl-teamsettings-msg is-good">{teamIdentityMessage}</p> : null}
        {teamControlMessage ? <p className="nl-teamsettings-msg is-good">{teamControlMessage}</p> : null}
        {teamStrategyMessage ? <p className="nl-teamsettings-msg is-good">{teamStrategyMessage}</p> : null}
      </div>
    );
  }

  function renderNewGameWizard() {
    return (
      <section className="nl-teamsettings-subpanel" data-testid="new-game-setup-wizard">
        <header className="nl-teamsettings-subhead">
          <h4>Neues Spiel starten</h4>
          <span className="nl-teamsettings-hint">Baseline · Startbudget · Ownership</span>
        </header>
        <p className="nl-teamsettings-note">
          Erst prüfen, dann erstellen. Der aktuelle Save bleibt erhalten; beim Confirm wird ein neuer lokaler Save
          aktiv.
        </p>
        <div className="nl-teamsettings-field-grid">
          <NlField label="Spielmodus">
            <select
              value={newGamePresetId}
              disabled={newGameBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den Spielmodus")
                  : newGameBusy
                    ? getBusyActionReason("Das New-Game-Setup")
                    : "Wählt das Basissetup für das neue Spiel."
              }
              onChange={(event) => applyNewGamePreset(event.target.value as NewGamePresetId)}
            >
              {NEW_GAME_VISIBLE_PRESET_IDS.map((presetId) => (
                <option key={presetId} value={presetId}>
                  {NEW_GAME_PRESET_DEFAULTS[presetId].label}
                </option>
              ))}
            </select>
          </NlField>
          <NlField label="Save-Name">
            <input
              value={newGameSaveName}
              disabled={newGameBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den Save-Namen")
                  : newGameBusy
                    ? getBusyActionReason("Das New-Game-Setup")
                    : "Optionaler Name für den neuen lokalen Spielstand."
              }
              placeholder="Optional, sonst automatisch"
              onChange={(event) => {
                setNewGameSaveName(event.target.value);
                setNewGamePreview(null);
              }}
            />
          </NlField>
          <label className="nl-teamsettings-check">
            <input
              type="checkbox"
              checked={newGameSandbox}
              disabled={newGameBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("die Sandbox-Markierung")
                  : newGameBusy
                    ? getBusyActionReason("Das New-Game-Setup")
                    : "Markiert den neuen Save klar als Test- oder Sandbox-Stand."
              }
              onChange={(event) => {
                setNewGameSandbox(event.target.checked);
                setNewGamePreview(null);
              }}
            />
            <span>als Sandbox/Testsave markieren</span>
          </label>
        </div>

        {newGamePresetId === "solo_1" ? (
          <NlField label="Dein Team" data-testid="new-game-solo-team-select">
            <select
              disabled={newGameBusy || readMeta.readOnly}
              value={newGameChrisTeamIds[0] ?? ""}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("die Team-Zuordnung")
                  : newGameBusy
                    ? getBusyActionReason("Das New-Game-Setup")
                    : "Wähle genau 1 Team für den Solo-Spielstand."
              }
              onChange={(event) => {
                if (event.target.value) {
                  setNewGameSoloTeam(event.target.value);
                }
              }}
            >
              <option value="" disabled>
                Team wählen
              </option>
              {[...gameState.teams]
                .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                .map((team) => (
                  <option key={`new-game-solo-${team.teamId}`} value={team.teamId}>
                    {team.name} ({team.shortCode}) · Budget {formatMoney(team.budget)}
                  </option>
                ))}
            </select>
          </NlField>
        ) : (
          <>
            <div className="nl-teamsettings-metric-grid">
              <NlMetric
                label="Chris"
                value={`${newGameChrisTeamIds.length}/4`}
                sub={newGameChrisTeamIds.join(" · ") || "kein Team"}
              />
              <NlMetric
                label="Franky"
                value={`${newGameFrankyTeamIds.length}/4`}
                sub={newGameFrankyTeamIds.join(" · ") || "kein Team"}
              />
              <NlMetric
                label="Rest"
                value={Math.max(0, gameState.teams.length - newGameChrisTeamIds.length - newGameFrankyTeamIds.length)}
                sub="Auto-Teams"
              />
            </div>
            <div className="nl-teamsettings-team-grid" data-testid="new-game-ownership-picker">
              {[...gameState.teams]
                .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                .map((team) => {
                  const isChris = newGameChrisTeamIds.includes(team.teamId);
                  const isFranky = newGameFrankyTeamIds.includes(team.teamId);
                  return (
                    <article
                      key={`new-game-team-${team.teamId}`}
                      className={`nl-teamsettings-team-card${isChris ? " is-owned-chris" : ""}${isFranky ? " is-owned-franky" : ""}`}
                    >
                      <button
                        type="button"
                        className="nl-teamsettings-team-card-main"
                        onClick={() => openTeamProfileById(team.teamId)}
                        title="Teamprofil öffnen"
                      >
                        <strong>{team.shortCode}</strong>
                        <span>{team.name}</span>
                        <small className="nl-tnum">Budget {formatMoney(team.budget)}</small>
                      </button>
                      <div className="nl-teamsettings-team-card-actions">
                        <button
                          type="button"
                          className={`nl-teamsettings-btn is-small${isChris ? " is-primary" : ""}`}
                          disabled={newGameBusy || readMeta.readOnly || isFranky}
                          title={
                            isFranky
                              ? "Dieses Team ist bereits Franky zugeordnet."
                              : readMeta.readOnly
                                ? getReadOnlyActionReason("die Team-Zuordnung")
                                : newGameBusy
                                  ? getBusyActionReason("Das New-Game-Setup")
                                  : "Ordnet dieses Team Chris/User für den neuen Spielstand zu."
                          }
                          onClick={() => toggleNewGameTeam("chris", team.teamId)}
                        >
                          Chris
                        </button>
                        <button
                          type="button"
                          className={`nl-teamsettings-btn is-small${isFranky ? " is-primary" : ""}`}
                          disabled={newGameBusy || readMeta.readOnly || isChris}
                          title={
                            isChris
                              ? "Dieses Team ist bereits Chris/User zugeordnet."
                              : readMeta.readOnly
                                ? getReadOnlyActionReason("die Team-Zuordnung")
                                : newGameBusy
                                  ? getBusyActionReason("Das New-Game-Setup")
                                  : "Ordnet dieses Team Franky für den neuen Spielstand zu."
                          }
                          onClick={() => toggleNewGameTeam("franky", team.teamId)}
                        >
                          Franky
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          </>
        )}

        <div className="nl-teamsettings-actions">
          <button
            type="button"
            className="nl-teamsettings-btn"
            disabled={newGameBusy || readMeta.readOnly}
            title={
              readMeta.readOnly
                ? getReadOnlyActionReason("das New-Game-Setup")
                : newGameBusy
                  ? getBusyActionReason("Das New-Game-Setup")
                  : "Prüft Baseline, Ownership und Season-Setup, bevor der neue Spielstand gebaut wird."
            }
            onClick={() => void runNewGameSetup(true)}
          >
            {newGameBusy ? "Prüft..." : "Setup prüfen"}
          </button>
          <button
            type="button"
            className="nl-teamsettings-btn is-primary"
            disabled={newGameBusy || readMeta.readOnly || !newGamePreview || newGamePreview.blockers.length > 0}
            title={
              readMeta.readOnly
                ? getReadOnlyActionReason("ein neues Spiel")
                : newGameBusy
                  ? getBusyActionReason("Das New-Game-Setup")
                  : !newGamePreview
                    ? "Bitte zuerst das Setup prüfen."
                    : newGamePreview.blockers.length > 0
                      ? `Noch offen: ${newGamePreview.blockers.map((reason: string) => formatCockpitReason(reason)).join(" · ")}`
                      : "Erstellt den neuen lokalen Spielstand mit dem geprüften Setup."
            }
            onClick={() => void runNewGameSetup(false)}
          >
            Neues Spiel erstellen
          </button>
        </div>

        {newGameError ? <p className="nl-teamsettings-msg is-risk">{newGameError}</p> : null}
        {newGameSuccess ? <p className="nl-teamsettings-msg is-good">{newGameSuccess}</p> : null}
        {newGamePreview ? (
          <section className="nl-teamsettings-subpanel is-nested">
            <header className="nl-teamsettings-subhead">
              <h4>New-Game Preview</h4>
              <span
                className={`nl-teamsettings-status${newGamePreview.blockers.length > 0 ? " is-risk" : " is-good"}`}
              >
                {newGamePreview.blockers.length > 0 ? "blockiert" : "ready"}
              </span>
            </header>
            <div className="nl-teamsettings-metric-grid">
              <NlMetric
                label="Baseline"
                value={`${newGamePreview.baseline.baselineCount}/${newGamePreview.baseline.playerCount}`}
                sub="Spieler werden auf Ursprung gesetzt"
              />
              <NlMetric
                label="Season"
                value={newGamePreview.seasonSetup.seasonId}
                sub={`${newGamePreview.seasonSetup.matchdayCount} Spieltage · Matchday ${newGamePreview.seasonSetup.currentMatchday}`}
              />
              <NlMetric
                label="Ownership"
                value={`${newGamePreview.counts.chris}+${newGamePreview.counts.franky}+${newGamePreview.counts.ai}`}
                sub="Chris · Franky · AI"
              />
              <NlMetric
                label="Room"
                value={newGamePreview.room.enabled ? "Online vorbereitet" : "Solo"}
                sub={newGamePreview.room.enabled ? "Code beim Erstellen" : "kein Room"}
              />
            </div>
            <div className="nl-teamsettings-table-shell">
              <table className="nl-teamsettings-table nl-tnum">
                <thead>
                  <tr>
                    <th>StartRank</th>
                    <th>Team</th>
                    <th>Budget</th>
                    <th>Owner</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {newGamePreview.teams
                    .filter(
                      (team: NewGameTeamPreview) => team.ownerLabel !== "AI" || team.startRank <= 5 || team.teamId === "R-R",
                    )
                    .sort((a: NewGameTeamPreview, b: NewGameTeamPreview) => a.startRank - b.startRank)
                    .map((team: NewGameTeamPreview) => (
                      <tr
                        key={`new-game-preview-${team.teamId}`}
                        className="is-clickable"
                        onClick={() => openTeamProfileById(team.teamId)}
                        title={`${team.name} Profil öffnen`}
                      >
                        <td>{team.startRank}</td>
                        <td>
                          {team.shortCode} · {team.name}
                        </td>
                        <td>{formatMoney(team.budget)}</td>
                        <td>{team.ownerLabel}</td>
                        <td>{formatTeamControlModeLabel(team.controlMode)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {newGamePreview.warnings.length > 0 ? (
              <p className="nl-teamsettings-note">Hinweise: {newGamePreview.warnings.join(" · ")}</p>
            ) : null}
            {newGamePreview.blockers.length > 0 ? (
              <p className="nl-teamsettings-msg is-risk">Blocker: {newGamePreview.blockers.join(" · ")}</p>
            ) : null}
          </section>
        ) : null}
      </section>
    );
  }

  function renderSeasonStartResetFeed() {
    if (!seasonStartResetFeed) {
      return null;
    }
    return (
      <section className="nl-teamsettings-subpanel">
        <header className="nl-teamsettings-subhead">
          <h4>Season-Start-Reset</h4>
          <span className={getCockpitStatusPillClass(seasonStartResetFeed.status)}>
            {getCockpitStatusLabel(seasonStartResetFeed.status)}
          </span>
        </header>
        <p className="nl-teamsettings-note">
          Save {seasonStartResetFeed.saveContext.saveName ?? activeSaveName} ·{" "}
          {seasonStartResetFeed.saveContext.resolvedSeasonId ?? gameState.season.id}
        </p>
        <div className="nl-teamsettings-metric-grid">
          <NlMetric
            label="Transfers"
            value={`${seasonStartResetFeed.summary.currentTransfers} → ${seasonStartResetFeed.summary.resetTransfers}`}
          />
          <NlMetric
            label="Roster"
            value={`${seasonStartResetFeed.summary.currentRosterEntries} → ${seasonStartResetFeed.summary.resetRosterEntries}`}
          />
          <NlMetric
            label="Stored Results"
            value={`${seasonStartResetFeed.summary.currentMatchdayResults} → ${seasonStartResetFeed.summary.resetMatchdayResults}`}
          />
          <NlMetric
            label="Lineups"
            value={`${seasonStartResetFeed.summary.currentStoredLineups} → ${seasonStartResetFeed.summary.resetStoredLineups}`}
          />
          <NlMetric
            label="Start-Cash Quelle"
            value={seasonStartResetFeed.summary.startCashSource === "reference" ? "Referenz" : "Fresh Seed"}
          />
          <NlMetric label="Cash-Zeilen" value={seasonStartResetFeed.summary.startCashRowsApplied} />
        </div>
        {seasonStartResetFeed.saveContext.scopeWarning ? (
          <p className="nl-teamsettings-msg is-risk">{seasonStartResetFeed.saveContext.scopeWarning}</p>
        ) : null}
        {seasonStartResetFeed.warnings.length > 0 ? (
          <p className="nl-teamsettings-note">Warnings: {seasonStartResetFeed.warnings.join(" · ")}</p>
        ) : null}
        {seasonStartResetFeed.blockingReasons.length > 0 ? (
          <p className="nl-teamsettings-msg is-risk">Blocker: {seasonStartResetFeed.blockingReasons.join(" · ")}</p>
        ) : null}
        <div className="nl-teamsettings-table-shell">
          <table className="nl-teamsettings-table nl-tnum">
            <thead>
              <tr>
                <th>Team</th>
                <th>Cash jetzt</th>
                <th>Cash Reset</th>
                <th>Roster jetzt</th>
                <th>Roster Reset</th>
                <th>Transfers</th>
              </tr>
            </thead>
            <tbody>
              {seasonStartResetFeed.teams.map((team: FoundationSeasonStartResetTeamRow) => (
                <tr
                  key={`season-start-reset-${team.teamId}`}
                  className="is-clickable"
                  onClick={() => openTeamProfileById(team.teamId)}
                  title={`${team.teamName} Profil öffnen`}
                >
                  <td>
                    {team.teamCode} · {team.teamName}
                  </td>
                  <td>{formatTransfermarktCurrency(team.currentCash)}</td>
                  <td>{formatTransfermarktCurrency(team.resetCash)}</td>
                  <td>{team.currentRosterCount}</td>
                  <td>{team.resetRosterCount}</td>
                  <td>{team.currentTransferCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderSavesSection() {
    return (
      <>
        <NlCard className="nl-teamsettings-card" eyebrow="Spielstände" title="Saves & Start" data-testid="nl-teamsettings-saves">
          <div className="nl-teamsettings-savecontext">
            <article className="nl-teamsettings-metric is-wide">
              <span className="nl-teamsettings-metric-label">Aktiv</span>
              <strong className="nl-teamsettings-metric-value">{activeSaveName}</strong>
              <small className="nl-teamsettings-metric-sub">
                {activeSaveSummary
                  ? `Update ${new Date(activeSaveSummary.updatedAt).toLocaleString("de-DE")}`
                  : activeSaveId}
              </small>
              <small className="nl-teamsettings-metric-sub">
                <span data-testid="foundation-active-save-id">{formatShortSaveId(activeSaveId)}</span> ·{" "}
                {formatScenarioTypeLabel(activeSaveSummary?.scenarioMeta?.scenarioType ?? gameState.scenarioMeta?.scenarioType)}
              </small>
              <small className="nl-teamsettings-metric-sub">
                {activeSaveSummary?.scenarioMeta?.activeSeasonId ?? gameState.scenarioMeta?.activeSeasonId ?? gameState.season.id} ·{" "}
                {activeSaveSummary?.scenarioMeta?.gamePhase ?? gameState.scenarioMeta?.gamePhase ?? gameState.gamePhase ?? "season_active"} ·{" "}
                MD {activeSaveSummary?.scenarioMeta?.activeMatchday ?? gameState.scenarioMeta?.activeMatchday ?? gameState.season.currentMatchday}
              </small>
              <small className={`nl-teamsettings-metric-sub${readMeta.readOnly ? " is-warn" : ""}`}>
                Spielstand: {readSourceLabel}
              </small>
            </article>
            {activeScenarioWarning ? (
              <p className="nl-teamsettings-msg is-warn">
                <strong>Save-Hinweis</strong> {activeScenarioWarning}
              </p>
            ) : null}
          </div>

          <div className="nl-teamsettings-field-grid">
            <NlField label="Save-Bereich">
              <select
                data-testid="foundation-save-mode-select"
                value={foundationSaveMode}
                disabled={isSaveBusy || readMeta.readOnly}
                title={
                  readMeta.readOnly
                    ? getReadOnlyActionReason("den Save-Bereich")
                    : isSaveBusy
                      ? getBusyActionReason("Der Save-Wechsel")
                      : "Wählt, in welchem Bereich lokale Spielstände angezeigt und gesteuert werden."
                }
                onChange={(event) => changeFoundationSaveMode(normalizeFoundationSaveMode(event.target.value))}
              >
                {FOUNDATION_SAVE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </NlField>
            <NlField label="Aktiven Save wechseln">
              <select
                data-testid="foundation-save-switch-select"
                value={activeSaveIsInCurrentMode ? activeSaveId : ""}
                disabled={isSaveBusy || readMeta.readOnly || saveSummaries.length === 0}
                title={
                  saveSummaries.length === 0
                    ? "In diesem Save-Bereich gibt es gerade keine Spielstände."
                    : readMeta.readOnly
                      ? getReadOnlyActionReason("den aktiven Spielstand")
                      : isSaveBusy
                        ? getBusyActionReason("Der Save-Wechsel")
                        : "Wählt den lokalen Spielstand, mit dem du weiterarbeitest."
                }
                onChange={(event) => {
                  const nextSaveId = event.target.value;
                  if (!nextSaveId) {
                    return;
                  }
                  void runSaveAction({ action: "activate", saveId: nextSaveId });
                }}
              >
                {!activeSaveIsInCurrentMode ? (
                  <option value="" disabled>
                    Kein Save in diesem Bereich
                  </option>
                ) : null}
                {saveSummaries.map((save: SaveSummary) => (
                  <option key={save.saveId} value={save.saveId}>
                    {save.name} · {formatFoundationSaveModeLabel(save.saveMode ?? resolveFoundationSaveMode(save))} ({save.status})
                  </option>
                ))}
              </select>
            </NlField>
          </div>

          {renderNewGameWizard()}

          <div className="nl-teamsettings-actions">
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={isSaveBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("einen neuen Save")
                  : isSaveBusy
                    ? getBusyActionReason("Die Save-Aktion")
                    : "Erstellt einen neuen lokalen Spielstand auf Basis des aktuellen Zustands."
              }
              onClick={() => {
                const name = `Save ${new Date().toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`;
                void runSaveAction({ action: "create", name });
              }}
            >
              Neuer Save
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn is-primary"
              disabled={isSaveBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("ein neues Spiel")
                  : isSaveBusy
                    ? getBusyActionReason("Die Save-Aktion")
                    : "Startet einen frischen Season-1-Spielstand, ohne bestehende Saves zu löschen."
              }
              onClick={() => {
                const confirmed = window.confirm(
                  "Erstellt einen neuen lokalen Testspielstand für Season 1. Bestehende Saves bleiben erhalten.",
                );
                if (!confirmed) {
                  return;
                }
                setFreshSeasonStartMessage(null);
                void runSaveAction({
                  action: "fresh-season-1",
                  name: `Fresh Season 1 ${new Date().toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`,
                });
              }}
            >
              Neues Spiel / Season 1 starten
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={isSaveBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den aktiven Save")
                  : isSaveBusy
                    ? getBusyActionReason("Die Save-Aktion")
                    : "Dupliziert den aktuellen Spielstand als sichere Arbeitskopie."
              }
              onClick={() => {
                void runSaveAction({ action: "clone", sourceSaveId: activeSaveId, name: `${activeSaveName} Kopie` });
              }}
            >
              Save duplizieren
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={seasonStartResetBusy || readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den Season-Start-Reset")
                  : seasonStartResetBusy
                    ? getBusyActionReason("Der Season-Start-Reset")
                    : "Prüft, wie der aktuelle Save auf den Season-Start zurückgesetzt würde."
              }
              onClick={() => {
                void runSeasonStartReset(false);
              }}
            >
              {seasonStartResetBusy ? "Lädt..." : "Season-Start-Reset prüfen"}
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn is-danger"
              disabled={seasonStartResetBusy || readMeta.readOnly || !seasonStartResetFeed || !seasonStartResetFeed.dryRun}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den Season-Start-Reset")
                  : seasonStartResetBusy
                    ? getBusyActionReason("Der Season-Start-Reset")
                    : !seasonStartResetFeed || !seasonStartResetFeed.dryRun
                      ? "Bitte zuerst den Reset trocken prüfen."
                      : "Setzt den aktuellen lokalen Save hart auf den Season-Start zurück."
              }
              onClick={() => {
                if (!seasonStartResetFeed) {
                  return;
                }
                const confirmed = window.confirm(
                  `Aktuellen Save jetzt hart auf Season-Start zurücksetzen? ${seasonStartResetFeed.summary.currentTransfers} Transfers, ${seasonStartResetFeed.summary.currentRosterEntries} Roster-Einträge und gespeicherte Spieltagsdaten werden entfernt.`,
                );
                if (!confirmed) {
                  return;
                }
                void runSeasonStartReset(true);
              }}
            >
              Season-Start-Reset ausführen
            </button>
          </div>

          {freshSeasonStartMessage ? <p className="nl-teamsettings-msg is-good">{freshSeasonStartMessage}</p> : null}
          {renderSeasonStartResetFeed()}

          <div className="nl-teamsettings-savelist">
            {saveSummaries.length === 0 ? (
              <p className="nl-teamsettings-msg is-warn">
                <strong>Keine Spielstände in diesem Bereich</strong> Wechsle den Save-Bereich oder starte ein neues
                Spiel in diesem Modus.
              </p>
            ) : null}
            {saveSummaries.map((save: SaveSummary) => {
              const meta = save.scenarioMeta;
              const warning = buildScenarioWarning(meta);
              const resolvedSaveMode = save.saveMode ?? resolveFoundationSaveMode(save);
              return (
                <article
                  key={save.saveId}
                  className={`nl-teamsettings-save-card${save.saveId === activeSaveId ? " is-active" : ""}`}
                >
                  <header className="nl-teamsettings-save-card-head">
                    <strong>{save.name}</strong>
                    <span className="nl-teamsettings-hint">{formatScenarioTypeLabel(meta?.scenarioType)}</span>
                  </header>
                  <span className="nl-teamsettings-note nl-tnum">
                    {formatShortSaveId(save.saveId)} · {formatFoundationSaveModeLabel(resolvedSaveMode)} · {save.status}
                  </span>
                  <span className="nl-teamsettings-note nl-tnum">
                    {meta?.activeSeasonId ?? "—"} · {meta?.gamePhase ?? "—"} · MD {meta?.activeMatchday ?? "—"}
                  </span>
                  <span className="nl-teamsettings-note nl-tnum">
                    Update {new Date(save.updatedAt).toLocaleString("de-DE")}
                  </span>
                  <div className="nl-teamsettings-flag-row">
                    <span className={`nl-teamsettings-status${meta?.containsFinalStandings ? " is-good" : " is-warn"}`}>
                      S1-Endstand {meta?.containsFinalStandings ? "ja" : "nein"}
                    </span>
                    <span className={`nl-teamsettings-status${meta?.scenarioType === "season2_start" ? " is-good" : ""}`}>
                      S2-Start {meta?.scenarioType === "season2_start" ? "ja" : "nein"}
                    </span>
                    {meta?.isStableTestPoint ? <span className="nl-teamsettings-status is-good">Stable Testpoint</span> : null}
                    {meta?.scenarioType === "sandbox_multiseason_test" ? (
                      <span className="nl-teamsettings-status is-warn">Sandbox</span>
                    ) : null}
                    {meta?.allowTestWrites ? <span className="nl-teamsettings-status is-warn">Test Writes erlaubt</span> : null}
                  </div>
                  {warning ? <span className="nl-teamsettings-note">{warning}</span> : null}
                  <div className="nl-teamsettings-actions is-compact">
                    <button
                      type="button"
                      className="nl-teamsettings-btn is-small"
                      disabled={isSaveBusy || readMeta.readOnly || save.saveId === activeSaveId}
                      title={
                        save.saveId === activeSaveId
                          ? "Dieser Save ist bereits aktiv."
                          : readMeta.readOnly
                            ? getReadOnlyActionReason("den aktiven Save")
                            : isSaveBusy
                              ? getBusyActionReason("Die Save-Aktion")
                              : "Macht diesen lokalen Save zum aktiven Arbeitsstand."
                      }
                      onClick={() => void runSaveAction({ action: "activate", saveId: save.saveId })}
                    >
                      Als aktiv setzen
                    </button>
                    <button
                      type="button"
                      className="nl-teamsettings-btn is-small"
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("diesen Save")
                          : isSaveBusy
                            ? getBusyActionReason("Die Save-Aktion")
                            : "Erstellt eine Kopie dieses Spielstands."
                      }
                      onClick={() => void runSaveAction({ action: "clone", sourceSaveId: save.saveId, name: `${save.name} Kopie` })}
                    >
                      Klonen
                    </button>
                    <button
                      type="button"
                      className="nl-teamsettings-btn is-small"
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("einen Snapshot")
                          : isSaveBusy
                            ? getBusyActionReason("Die Save-Aktion")
                            : "Erstellt einen fest eingefrorenen Snapshot dieses Spielstands."
                      }
                      onClick={() => void runSaveAction({ action: "snapshot", sourceSaveId: save.saveId, name: `${save.name} Snapshot` })}
                    >
                      Snapshot erstellen
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </NlCard>

        <NlCard className="nl-teamsettings-card" eyebrow="Import" title="Importstatus">
          <div className="nl-teamsettings-metric-grid">
            <NlMetric label="Spieler" value={gameState.mappingReport.importedPlayerCount} />
            <NlMetric label="Teams" value={gameState.mappingReport.teamCount} />
            <NlMetric label="Gemappt" value={gameState.mappingReport.matchedRosterCount} />
            <NlMetric label="Warnungen" value={gameState.mappingReport.warnings.length} />
          </div>
        </NlCard>
      </>
    );
  }

  function renderTeamSection() {
    return (
      <>
        <NlCard
          className="nl-teamsettings-card"
          eyebrow="Team-Auswahl"
          title="Team wählen"
          data-testid="nl-teamsettings-team-selection"
        >
          <p className="nl-teamsettings-note">
            Wählt das Team für Identity, Strategy Profile und Control Settings. Der Wechsel bleibt über die URL
            teilbar.
          </p>
          <div className="nl-teamsettings-field-grid is-selector">
            <NlField label="Team wählen">
              <select value={selectedTeamId} onChange={(event) => selectTeamSettingsTeam(event.target.value)}>
                {gameState.teams.map((team: Team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.name} ({team.shortCode})
                  </option>
                ))}
              </select>
            </NlField>
            <NlField label="Teamliste filtern">
              <input
                type="search"
                placeholder="Name oder Teamcode"
                value={teamSettingsSearch}
                onChange={(event) => setTeamSettingsSearch(event.target.value)}
              />
            </NlField>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={selectedTeamSettingsIndex <= 0}
              title={
                selectedTeamSettingsIndex <= 0
                  ? "Du bist bereits beim ersten Team der Liste."
                  : "Springt zum vorherigen Team in der aktuellen Liste."
              }
              onClick={() => {
                const previousTeam = gameState.teams[selectedTeamSettingsIndex - 1];
                if (previousTeam) {
                  selectTeamSettingsTeam(previousTeam.teamId);
                }
              }}
            >
              Vorheriges
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={selectedTeamSettingsIndex < 0 || selectedTeamSettingsIndex >= gameState.teams.length - 1}
              title={
                selectedTeamSettingsIndex < 0 || selectedTeamSettingsIndex >= gameState.teams.length - 1
                  ? "Du bist bereits beim letzten Team der Liste."
                  : "Springt zum nächsten Team in der aktuellen Liste."
              }
              onClick={() => {
                const nextTeam = gameState.teams[selectedTeamSettingsIndex + 1];
                if (nextTeam) {
                  selectTeamSettingsTeam(nextTeam.teamId);
                }
              }}
            >
              Nächstes
            </button>
          </div>
          <div className="nl-teamsettings-pill-row nl-tnum">
            <span className="nl-teamsettings-hint">Aktiv {selectedTeam?.name ?? "—"}</span>
            <span className="nl-teamsettings-hint">Code {selectedTeam?.shortCode ?? "—"}</span>
            <span className="nl-teamsettings-hint">Teams {gameState.teams.length}</span>
            <span className={`nl-teamsettings-status${selectedTeamHasUnsavedChanges ? " is-warn" : " is-good"}`}>
              {selectedTeamHasUnsavedChanges ? "Nicht gespeichert" : "Synchron"}
            </span>
          </div>
          <div className="nl-teamsettings-team-grid">
            {filteredTeamSettingsTeams.map((team: Team) => {
              const rosterCount = gameState.rosters.filter((entry: RosterEntry) => entry.teamId === team.teamId).length;
              const isActive = selectedTeam?.teamId === team.teamId;
              const controlMode = resolvedTeamControlSettings[team.teamId]?.controlMode ?? "manual";
              return (
                <button
                  key={team.teamId}
                  type="button"
                  className={`nl-teamsettings-team-card is-selectable${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    selectTeamSettingsTeam(team.teamId);
                    setFoundationView("teamSettings", setActiveView);
                  }}
                >
                  <strong>{team.shortCode}</strong>
                  <span>{team.name}</span>
                  <small className="nl-tnum">
                    Roster {rosterCount} · {formatTeamControlModeLabel(controlMode)}
                  </small>
                </button>
              );
            })}
          </div>
        </NlCard>

        <NlCard
          className="nl-teamsettings-card"
          eyebrow="Fokus"
          title="Aktives Team"
          actions={
            <button
              type="button"
              className="nl-teamsettings-btn is-small"
              disabled={!selectedTeam}
              title={selectedTeam ? "Teamprofil öffnen" : "Wähle zuerst ein Team aus."}
              onClick={() => selectedTeam && openTeamProfileById(selectedTeam.teamId)}
            >
              Teamprofil
            </button>
          }
        >
          <p className="nl-teamsettings-note">
            Das aktuell ausgewählte Team steht hier im Zentrum — Roster {selectedRoster.length} · GM{" "}
            {selectedTeamGeneralManager?.profile.archetype ?? "—"}.
          </p>
          <div className="nl-teamsettings-metric-grid">
            <NlMetric
              label="Team"
              value={selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Kein Team aktiv"}
              sub={
                selectedTeam
                  ? `${formatTeamControlModeLabel(selectedTeamControl?.controlMode)} · ${selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "noch ohne Rang"}`
                  : "Wähle oben ein Team für Identity, Strategy und Control."
              }
            />
            <NlMetric
              label="Punkte"
              value={selectedStandingRow?.points != null ? formatLocalePoints(selectedStandingRow.points, 1) : "—"}
              sub="Live-Stand"
            />
            <NlMetric
              label="Cash"
              value={selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"}
              sub="liquide Mittel"
            />
            <NlMetric
              label="Gehalt"
              value={selectedStandingRow?.salaryTotal != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"}
              sub="aktueller Kader"
            />
            <NlMetric
              label="MW"
              value={selectedStandingRow?.marketValueTotal != null ? formatMoney(selectedStandingRow.marketValueTotal) : "—"}
              sub="gesamter Kader"
            />
            <NlMetric
              label="Sponsor"
              value={selectedStandingRow?.sponsorTotal != null ? formatMoney(selectedStandingRow.sponsorTotal) : "—"}
              sub="pro Season"
            />
          </div>
          {selectedTeamGeneralManager ? (
            <div className="nl-teamsettings-gm-grid">
              <article className="nl-teamsettings-gm-card">
                <span className="nl-teamsettings-metric-label">GM-Einfluss</span>
                <strong>{selectedTeamGeneralManager.profile.name}</strong>
                {selectedHqGmStory ? (
                  <span
                    className={`nl-teamsettings-status${selectedHqGmStory.isHotSeat ? " is-warn" : selectedHqGmStory.isReplacement ? " is-info" : ""}`}
                  >
                    {selectedHqGmStory.statusLabel}
                  </span>
                ) : null}
                <p className="nl-teamsettings-note">
                  {selectedTeamGeneralManager.profile.title} wirkt aktuell zu{" "}
                  <strong className="nl-tnum">{selectedTeamGeneralManager.assignment.influencePct}%</strong> auf
                  Teamidentität, Pick-Fokus, Cash-Risiko und Vertragsstil.
                </p>
                {selectedTeamGmAxisShares ? (
                  <div className="nl-teamsettings-gm-axes nl-tnum" aria-label="GM Achsen">
                    <span className="nl-tone-pow">POW {selectedTeamGmAxisShares.pow}%</span>
                    <span className="nl-tone-spe">SPE {selectedTeamGmAxisShares.spe}%</span>
                    <span className="nl-tone-men">MEN {selectedTeamGmAxisShares.men}%</span>
                    <span className="nl-tone-soc">SOC {selectedTeamGmAxisShares.soc}%</span>
                  </div>
                ) : null}
              </article>
              <article className="nl-teamsettings-gm-card">
                <span className="nl-teamsettings-metric-label">Wie er tickt</span>
                <strong>dominante Hebel</strong>
                <ul className="nl-teamsettings-gm-bias-list">
                  {selectedTeamGmBiasHighlights.map(
                    (entry: { key: keyof TeamStrategyBias; label: string; rawValue: number; delta: number; tendency: string }) => (
                      <li className="nl-teamsettings-gm-bias-row nl-tnum" key={`gm-bias-${entry.key}`}>
                        <span>{entry.label}</span>
                        <strong>
                          {entry.tendency} · {entry.rawValue}/10
                        </strong>
                        <small>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</small>
                      </li>
                    ),
                  )}
                </ul>
              </article>
              <article className="nl-teamsettings-gm-card">
                <span className="nl-teamsettings-metric-label">Doktrin</span>
                <strong>{selectedTeamGeneralManager.profile.marketDoctrine}</strong>
                <small className="nl-teamsettings-metric-sub">{selectedTeamGeneralManager.profile.lineupDoctrine}</small>
                <div className="nl-teamsettings-pill-row">
                  {selectedTeamGeneralManager.profile.facilityPriorities.slice(0, 3).map((facility: string) => (
                    <span className="nl-teamsettings-hint" key={`gm-facility-${facility}`}>
                      {facility}
                    </span>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
        </NlCard>
      </>
    );
  }

  function renderControlSection() {
    return (
      <NlCard
        className="nl-teamsettings-card"
        eyebrow="Steuerung"
        title="Spielmodus & Team-Zuordnung"
        data-testid="nl-teamsettings-controls"
        actions={
          <div className="nl-teamsettings-actions is-compact">
            <button
              type="button"
              className="nl-teamsettings-btn is-small is-primary"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("die Team-Control-Settings")
                  : "Speichert Spielmodus-Zuordnung und AI-Automation in diesem Save."
              }
              onClick={saveTeamSettings}
            >
              Lokal speichern
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn is-small"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den Team-Control-Draft")
                  : "Setzt alle lokalen Entwurfs-Änderungen auf den gespeicherten Stand zurück."
              }
              onClick={discardDrafts}
            >
              Draft verwerfen
            </button>
          </div>
        }
      >
        <p className="nl-teamsettings-note">
          Eine Wahrheit pro Save: Der Spielmodus legt fest, wie viele Teams menschlich sind. Alles andere läuft als AI.
          Änderungen erst mit &quot;Lokal speichern&quot; dauerhaft schreiben.
        </p>
        {readMeta.readOnly ? (
          <p className="nl-teamsettings-msg is-warn">Warum nicht: {getReadOnlyActionReason("die Team-Control-Settings")}</p>
        ) : null}
        <div className="nl-teamsettings-pill-row nl-tnum">
          <span className="nl-teamsettings-hint" data-testid="foundation-active-game-mode">
            Modus {formatFoundationSaveModeLabel(activeSaveGameMode)}
          </span>
          <span className="nl-teamsettings-hint">
            Chris {currentSaveOwnership.chrisTeamIds.length}/{gameModeOwnershipLimits.chrisMax}
          </span>
          {gameModeOwnershipLimits.frankyMax > 0 ? (
            <span className="nl-teamsettings-hint">
              Franky {currentSaveOwnership.frankyTeamIds.length}/{gameModeOwnershipLimits.frankyMax}
            </span>
          ) : null}
          <span className="nl-teamsettings-hint">AI {aiTeams.length}</span>
          <span className={`nl-teamsettings-hint${readMeta.readOnly ? " is-warn" : ""}`}>Speichern: {readSourceLabel}</span>
        </div>

        <section className="nl-teamsettings-subpanel" data-testid="game-mode-ownership-panel">
          <header className="nl-teamsettings-subhead">
            <h4>Team-Zuordnung</h4>
          </header>
          <p className="nl-teamsettings-note">
            {activeSaveGameMode === "online_4v4"
              ? "Wähle genau 4 Teams für Chris und 4 für Franky. Alle anderen Teams bleiben AI."
              : activeSaveGameMode === "solo_1"
                ? "Wähle genau 1 Team für dich. Alle anderen Teams bleiben AI."
                : `Maximal ${gameModeOwnershipLimits.chrisMax} Chris-Team(s)${gameModeOwnershipLimits.frankyMax ? ` und ${gameModeOwnershipLimits.frankyMax} Franky-Team(s)` : ""}.`}
          </p>
          {activeSaveGameMode === "solo_1" || (gameModeOwnershipLimits.chrisMax === 1 && gameModeOwnershipLimits.frankyMax === 0) ? (
            <NlField label="Dein Team">
              <select
                data-testid="solo-player-team-select"
                disabled={readMeta.readOnly}
                value={gameModeOwnershipChrisIds[0] ?? ""}
                onChange={(event) => {
                  if (event.target.value) {
                    setSoloPlayerTeam(event.target.value);
                  }
                }}
              >
                <option value="" disabled>
                  Team wählen
                </option>
                {gameState.teams.map((team: Team) => (
                  <option key={`solo-team-${team.teamId}`} value={team.teamId}>
                    {team.name} ({team.shortCode})
                  </option>
                ))}
              </select>
            </NlField>
          ) : (
            <>
              <div className="nl-teamsettings-metric-grid">
                <NlMetric
                  label="Chris"
                  value={`${currentSaveOwnership.chrisTeamIds.length}/${gameModeOwnershipLimits.chrisMax}`}
                  sub={currentSaveOwnership.chrisTeamIds.join(" · ") || "kein Team"}
                />
                <NlMetric
                  label="Franky"
                  value={`${currentSaveOwnership.frankyTeamIds.length}/${gameModeOwnershipLimits.frankyMax}`}
                  sub={currentSaveOwnership.frankyTeamIds.join(" · ") || "kein Team"}
                />
                <NlMetric
                  label="AI"
                  value={Math.max(
                    0,
                    gameState.teams.length -
                      currentSaveOwnership.chrisTeamIds.length -
                      currentSaveOwnership.frankyTeamIds.length,
                  )}
                  sub="automatisch"
                />
              </div>
              <div className="nl-teamsettings-team-grid" data-testid="game-mode-ownership-picker">
                {[...gameState.teams]
                  .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                  .map((team) => {
                    const isChris = currentSaveOwnership.chrisTeamIds.includes(team.teamId);
                    const isFranky = currentSaveOwnership.frankyTeamIds.includes(team.teamId);
                    return (
                      <article
                        key={`game-mode-team-${team.teamId}`}
                        className={`nl-teamsettings-team-card${isChris ? " is-owned-chris" : ""}${isFranky ? " is-owned-franky" : ""}`}
                      >
                        <div className="nl-teamsettings-team-card-main">
                          <strong>{team.shortCode}</strong>
                          <span>{team.name}</span>
                        </div>
                        <div className="nl-teamsettings-team-card-actions">
                          <button
                            type="button"
                            className={`nl-teamsettings-btn is-small${isChris ? " is-primary" : ""}`}
                            disabled={readMeta.readOnly || isFranky}
                            onClick={() => toggleGameModeOwnershipTeam("chris", team.teamId)}
                          >
                            Chris
                          </button>
                          <button
                            type="button"
                            className={`nl-teamsettings-btn is-small${isFranky ? " is-primary" : ""}`}
                            disabled={readMeta.readOnly || isChris || gameModeOwnershipLimits.frankyMax === 0}
                            onClick={() => toggleGameModeOwnershipTeam("franky", team.teamId)}
                          >
                            Franky
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </>
          )}
        </section>

        <section className="nl-teamsettings-subpanel" data-testid="ai-automation-panel">
          <header className="nl-teamsettings-subhead">
            <h4>AI-Automation (nur AI-Teams)</h4>
          </header>
          <p className="nl-teamsettings-note">
            Preview- und Apply-Flags für automatisierte AI-Teams. Ownership bleibt unverändert.
          </p>
          <div className="nl-teamsettings-table-shell">
            <table className="nl-teamsettings-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Lineup Preview</th>
                  <th>Lineup Apply</th>
                  <th>Transfer Preview</th>
                  <th>Sell Preview</th>
                </tr>
              </thead>
              <tbody>
                {gameState.teams
                  .filter(
                    (team: Team) => (teamControlDraft[team.teamId] ?? resolvedTeamControlSettings[team.teamId])?.controlMode === "ai",
                  )
                  .map((team: Team) => {
                    const settings = teamControlDraft[team.teamId] ?? resolvedTeamControlSettings[team.teamId];
                    if (!settings) return null;
                    return (
                      <tr key={`ai-auto-${team.teamId}`}>
                        <td>
                          <strong>{team.shortCode}</strong>
                          <span className="nl-teamsettings-note"> {team.name}</span>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={settings.aiLineupPreviewEnabled}
                            disabled={readMeta.readOnly}
                            aria-label={`${team.name}: Lineup Preview`}
                            onChange={(event) => {
                              updateTeamControlDraft(team.teamId, (current: TeamControlSettings) => ({
                                ...current,
                                aiLineupPreviewEnabled: event.target.checked,
                              }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={settings.aiLineupApplyEnabled ?? settings.aiLineupAutoApplyEnabled}
                            disabled={readMeta.readOnly}
                            aria-label={`${team.name}: Lineup Apply`}
                            onChange={(event) => {
                              updateTeamControlDraft(team.teamId, (current: TeamControlSettings) => ({
                                ...current,
                                aiLineupApplyEnabled: event.target.checked,
                              }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={settings.aiTransferPreviewEnabled}
                            disabled={readMeta.readOnly}
                            aria-label={`${team.name}: Transfer Preview`}
                            onChange={(event) => {
                              updateTeamControlDraft(team.teamId, (current: TeamControlSettings) => ({
                                ...current,
                                aiTransferPreviewEnabled: event.target.checked,
                              }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={settings.aiSellPreviewEnabled}
                            disabled={readMeta.readOnly}
                            aria-label={`${team.name}: Sell Preview`}
                            onChange={(event) => {
                              updateTeamControlDraft(team.teamId, (current: TeamControlSettings) => ({
                                ...current,
                                aiSellPreviewEnabled: event.target.checked,
                              }));
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="nl-teamsettings-actions">
          <button
            type="button"
            className="nl-teamsettings-btn"
            disabled={exportDisabledReason != null}
            title={exportDisabledReason ?? "Exportiert die aktuellen lokalen Team-Settings als JSON."}
            onClick={exportSelectedTeamSettingsJson}
          >
            Export JSON
          </button>
        </div>
        {exportDisabledReason != null ? (
          <p className="nl-teamsettings-msg is-warn">Warum nicht: {exportDisabledReason}</p>
        ) : null}
      </NlCard>
    );
  }

  function renderStrategySection() {
    if (!selectedTeam || !selectedTeamStrategyDraft) {
      return (
        <NlCard className="nl-teamsettings-card" eyebrow="Strategie" title="Identity & Strategy Profile">
          <p className="nl-teamsettings-empty">
            {!selectedTeam
              ? "Wähle zuerst im Bereich Team-Fokus ein Team aus."
              : "Für dieses Team fehlen noch lokale Identity- oder Strategy-Daten."}
          </p>
        </NlCard>
      );
    }
    return (
      <NlCard
        className="nl-teamsettings-card"
        eyebrow="Strategie"
        title="Team Strategy Profile"
        data-testid="nl-teamsettings-strategy"
        actions={
          <div className="nl-teamsettings-pill-row nl-tnum">
            <span className="nl-teamsettings-hint">{selectedTeam.name}</span>
            <span className="nl-teamsettings-hint">{selectedTeam.shortCode}</span>
            <span className="nl-teamsettings-hint">
              Steuerung {formatTeamControlModeLabel(selectedTeamControl?.controlMode)}
            </span>
          </div>
        }
      >
        <p className="nl-teamsettings-note">
          Ausführlicher lokaler Lore- und Bias-Kontext für AI-Erklärungen. Keine Automatik, keine Auto-Apply-Aktion.
        </p>

        <div className="nl-teamsettings-metric-grid">
          <NlMetric label="POW" value={selectedIdentityDraft?.pow ?? "—"} />
          <NlMetric label="SPE" value={selectedIdentityDraft?.spe ?? "—"} />
          <NlMetric label="MEN" value={selectedIdentityDraft?.men ?? "—"} />
          <NlMetric label="SOC" value={selectedIdentityDraft?.soc ?? "—"} />
          <NlMetric label="Player Type" value={selectedIdentityDraft?.playerType ?? "—"} />
          <NlMetric label="Profil-Version" value={selectedTeamStrategyDraft.strategyVersion ?? "v1-local"} />
          <NlMetric
            label="Roster Target"
            value={`${selectedTeamStrategyDraft.rosterMinTarget ?? selectedIdentityDraft?.playerMin ?? "—"}/${selectedTeamStrategyDraft.rosterOptTarget ?? selectedIdentityDraft?.playerOpt ?? "—"}`}
          />
        </div>

        <div className="nl-teamsettings-pill-row nl-tnum">
          <span className="nl-teamsettings-hint">Save {activeSaveName}</span>
          <span className="nl-teamsettings-hint">Identity Default {selectedIdentityDraft?.sourceNote ?? "—"}</span>
          <span className="nl-teamsettings-hint">
            Identity Override {gameState.seasonState.teamIdentityOverrides?.[selectedTeam.teamId] ? "ja" : "nein"}
          </span>
          <span className="nl-teamsettings-hint">Control Save seasonState.teamControlSettings</span>
          <span className="nl-teamsettings-hint">Strategy Save seasonState.teamStrategyProfiles</span>
        </div>

        {selectedIdentityDraft ? (
          <section className="nl-teamsettings-subpanel">
            <header className="nl-teamsettings-subhead">
              <h4>Identity Rohwerte</h4>
              <span className="nl-teamsettings-hint">Default: {selectedIdentityDraft.sourceNote ?? "—"}</span>
            </header>
            <p className="nl-teamsettings-note">
              Exakte Team-Identität aus den lokalen Quellen. Diese Rohwerte werden nicht auf generische 50er- oder
              60er-Biaswerte geglaettet.
            </p>
            <div className="nl-teamsettings-field-grid">
              <NlField label="Player Type">
                <select
                  disabled={readMeta.readOnly}
                  value={selectedIdentityDraft.playerType ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateTeamIdentityDraft(selectedTeam.teamId, (current: TeamIdentity) => ({
                      ...current,
                      playerType: value || null,
                    }));
                  }}
                >
                  <option value="">—</option>
                  <option value="F">F</option>
                  <option value="C">C</option>
                </select>
              </NlField>
              {teamIdentityFieldLabels.map((field: (typeof teamIdentityFieldLabels)[number]) => (
                <NlField key={field.key} label={field.label}>
                  <input
                    type="number"
                    min={0}
                    max={field.key === "playerMin" || field.key === "playerOpt" ? 32 : 20}
                    step={field.key === "playerMin" || field.key === "playerOpt" ? 1 : 0.5}
                    disabled={readMeta.readOnly}
                    value={selectedIdentityDraft[field.key]}
                    onChange={(event) => {
                      const nextValue = clampIdentityValue(Number(event.target.value), field.key);
                      updateTeamIdentityDraft(selectedTeam.teamId, (current: TeamIdentity) => ({
                        ...current,
                        [field.key]: nextValue,
                      }));
                    }}
                  />
                </NlField>
              ))}
            </div>
            {selectedIdentityAxisBias ? (
              <div className="nl-teamsettings-metric-grid">
                <NlMetric label="POW Bias" value={formatIdentityWeight(selectedIdentityAxisBias.pow)} />
                <NlMetric label="SPE Bias" value={formatIdentityWeight(selectedIdentityAxisBias.spe)} />
                <NlMetric label="MEN Bias" value={formatIdentityWeight(selectedIdentityAxisBias.men)} />
                <NlMetric label="SOC Bias" value={formatIdentityWeight(selectedIdentityAxisBias.soc)} />
              </div>
            ) : null}
            <p className="nl-teamsettings-note">
              Derived Axis Bias % = round(Achsenwert / Summe aus Power, Speed, Mental, Social * 100).
              {selectedIdentityAxisBias?.warning === "identity_axis_sum_zero" ? " Warnung: identity_axis_sum_zero." : ""}
            </p>
            <div className="nl-teamsettings-actions">
              <button
                type="button"
                className="nl-teamsettings-btn is-primary"
                disabled={readMeta.readOnly}
                title={
                  readMeta.readOnly
                    ? getReadOnlyActionReason("die Team-Identity")
                    : "Speichert die lokalen Rohwerte und Biases dieses Teams."
                }
                onClick={saveTeamSettings}
              >
                Identity lokal speichern
              </button>
              <button
                type="button"
                className="nl-teamsettings-btn"
                disabled={readMeta.readOnly}
                title={
                  readMeta.readOnly
                    ? getReadOnlyActionReason("die Team-Identity")
                    : "Setzt die Team-Identity für dieses Team auf den Default zurück."
                }
                onClick={() => {
                  const resetIdentities = buildResolvedTeamIdentities(gameState.teams, gameState.teamIdentities, {});
                  const resetIdentity = resetIdentities.find(
                    (identity: TeamIdentity) => identity.teamId === selectedTeam.teamId,
                  );
                  if (!resetIdentity) {
                    return;
                  }
                  setTeamIdentityDraft((current: TeamIdentityDraftMap) => ({
                    ...current,
                    [selectedTeam.teamId]: resetIdentity,
                  }));
                  setTeamIdentityMessage(`Default-Identity für ${selectedTeam.name} wiederhergestellt.`);
                }}
              >
                Identity auf Default
              </button>
            </div>
          </section>
        ) : null}

        <section className="nl-teamsettings-subpanel">
          <header className="nl-teamsettings-subhead">
            <h4>Lore & Stil</h4>
          </header>
          <div className="nl-teamsettings-field-grid is-wide">
            <NlField label="Fantasy Theme">
              <input
                type="text"
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.fantasyTheme ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      fantasyTheme: value || null,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Lore Theme">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.loreTheme ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      loreTheme: value || null,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Summary">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.strategySummary}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      strategySummary: value,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Buy Style">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.buyStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      buyStyle: value,
                      transferStyleNote: current.transferStyleNote === current.buyStyle ? value : current.transferStyleNote,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Sell Style">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.sellStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      sellStyle: value,
                      sellStyleNote: current.sellStyleNote === current.sellStyle ? value : current.sellStyleNote,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Contract Style">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.contractStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      contractStyle: value,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Roster Style">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.rosterStyle}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      rosterStyle: value,
                      lineupStyleNote: current.lineupStyleNote === current.rosterStyle ? value : current.lineupStyleNote,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Notes">
              <textarea
                rows={3}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.notes ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      notes: value || null,
                    }),
                  );
                }}
              />
            </NlField>
          </div>

          <div className="nl-teamsettings-field-grid is-wide">
            {teamStrategyIdentityListFieldLabels.map((field: (typeof teamStrategyIdentityListFieldLabels)[number]) => (
              <NlField key={field.key} label={field.label}>
                <textarea
                  rows={2}
                  disabled={readMeta.readOnly}
                  value={formatCsvList(selectedTeamStrategyDraft[field.key])}
                  placeholder="comma, separated, values"
                  onChange={(event) => {
                    const next = parseCsvList(event.target.value);
                    updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                      withSynchronizedStrategyAliases(current, {
                        [field.key]: next,
                      } as Partial<TeamStrategyProfile>),
                    );
                  }}
                />
              </NlField>
            ))}
          </div>

          <div className="nl-teamsettings-field-grid">
            <NlField label="Roster Min Target">
              <input
                type="number"
                min={0}
                max={32}
                step={1}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.rosterMinTarget ?? ""}
                onChange={(event) => {
                  const nextValue =
                    event.target.value === "" ? null : Math.max(0, Math.min(32, Math.round(Number(event.target.value))));
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      rosterMinTarget: nextValue,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Roster Opt Target">
              <input
                type="number"
                min={0}
                max={32}
                step={1}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.rosterOptTarget ?? ""}
                onChange={(event) => {
                  const nextValue =
                    event.target.value === "" ? null : Math.max(0, Math.min(32, Math.round(Number(event.target.value))));
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      rosterOptTarget: nextValue,
                    }),
                  );
                }}
              />
            </NlField>
            {teamStrategyLevelFieldLabels.map((field: (typeof teamStrategyLevelFieldLabels)[number]) => (
              <NlField key={field.key} label={field.label}>
                <select
                  disabled={readMeta.readOnly}
                  value={selectedTeamStrategyDraft[field.key] ?? "medium"}
                  onChange={(event) => {
                    updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                      withSynchronizedStrategyAliases(current, {
                        [field.key]: normalizeTeamStrategyLevel(event.target.value),
                      } as Partial<TeamStrategyProfile>),
                    );
                  }}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </NlField>
            ))}
          </div>

          <div className="nl-teamsettings-field-grid">
            {teamStrategySportsBiasFieldLabels.map((field: (typeof teamStrategySportsBiasFieldLabels)[number]) => (
              <NlMetric
                key={field.key}
                label={field.label}
                value={formatIdentityWeight(selectedIdentityAxisBias?.[teamStrategySportsBiasAxisMap[field.key]] ?? null)}
                sub="read-only aus Identity Rohwerten"
              />
            ))}
            <NlField label="Lineup Style Note">
              <textarea
                rows={2}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.lineupStyleNote ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      lineupStyleNote: value || null,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Transfer Style Note">
              <textarea
                rows={2}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.transferStyleNote ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      transferStyleNote: value || null,
                    }),
                  );
                }}
              />
            </NlField>
            <NlField label="Sell Style Note">
              <textarea
                rows={2}
                disabled={readMeta.readOnly}
                value={selectedTeamStrategyDraft.sellStyleNote ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                    withSynchronizedStrategyAliases(current, {
                      sellStyleNote: value || null,
                    }),
                  );
                }}
              />
            </NlField>
          </div>

          <details className="nl-teamsettings-details">
            <summary>Legacy-Kompatibilität / Debug</summary>
            <p className="nl-teamsettings-note">
              Diese Werte dienen nur der Rückwärtskompatibilität und sind nicht die primäre Team Identity oder die
              führende AI-Bias-Quelle.
            </p>
            <div className="nl-teamsettings-field-grid is-wide">
              {teamStrategyListFieldLabels.map((field: (typeof teamStrategyListFieldLabels)[number]) => (
                <NlField key={field.key} label={field.label}>
                  <textarea
                    rows={2}
                    disabled={readMeta.readOnly}
                    value={formatCsvList(selectedTeamStrategyDraft[field.key])}
                    placeholder="comma, separated, values"
                    onChange={(event) => {
                      const next = parseCsvList(event.target.value);
                      updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) =>
                        withSynchronizedStrategyAliases(current, {
                          [field.key]: next,
                        } as Partial<TeamStrategyProfile>),
                      );
                    }}
                  />
                </NlField>
              ))}
            </div>
          </details>

          <div className="nl-teamsettings-field-grid">
            {teamStrategyBiasFieldLabels.map((field: (typeof teamStrategyBiasFieldLabels)[number]) => (
              <NlField key={field.key} label={field.label}>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  disabled={readMeta.readOnly}
                  value={selectedTeamStrategyDraft.bias[field.key]}
                  onChange={(event) => {
                    const nextValue = clampBiasValue(Number(event.target.value));
                    updateTeamStrategyDraft(selectedTeam.teamId, (current: TeamStrategyProfile) => ({
                      ...current,
                      bias: {
                        ...current.bias,
                        [field.key]: nextValue,
                      },
                    }));
                  }}
                />
              </NlField>
            ))}
          </div>

          <div className="nl-teamsettings-actions">
            <button
              type="button"
              className="nl-teamsettings-btn is-primary"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("das Strategy-Profil")
                  : "Speichert das lokale Strategy-Profil dieses Teams im aktiven Save."
              }
              onClick={saveTeamSettings}
            >
              Strategy Profile lokal speichern
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("das Strategy-Profil")
                  : "Verwirft ungespeicherte Strategy-Änderungen und springt auf den aktuellen Save-Stand zurück."
              }
              onClick={() => {
                setTeamStrategyDraft(
                  buildTeamStrategyProfileMap(
                    gameState.teams,
                    gameState.teamIdentities,
                    gameState.seasonState.teamStrategyProfiles,
                  ),
                );
                setTeamStrategyMessage("Strategy-Profile-Draft wurde auf den lokalen Save-Stand zurückgesetzt.");
              }}
            >
              Strategy Draft zurücksetzen
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("das Strategy-Profil")
                  : "Setzt das Strategy-Profil dieses Teams auf die Default-Werte zurück."
              }
              onClick={() => {
                const defaults = buildTeamStrategyProfileMap(gameState.teams, gameState.teamIdentities);
                const resetProfile = defaults[selectedTeam.teamId];
                if (!resetProfile) {
                  return;
                }
                setTeamStrategyDraft((current: TeamStrategyDraftMap) => ({
                  ...current,
                  [selectedTeam.teamId]: resetProfile,
                }));
                setTeamStrategyMessage(`Default-Profil für ${selectedTeam.name} wiederhergestellt.`);
              }}
            >
              Reset auf Default
            </button>
          </div>
          {readMeta.readOnly ? (
            <p className="nl-teamsettings-note">
              Prisma/Supabase bleibt read-only. Profile können dort nicht gespeichert werden.
            </p>
          ) : null}
          {selectedTeamStrategyProfile ? (
            <p className="nl-teamsettings-note">AI read-only Kontext: {selectedTeamStrategyProfile.strategySummary}</p>
          ) : null}
        </section>
      </NlCard>
    );
  }

  return (
    <div
      className="nl-teamsettings"
      id="foundation-team-settings"
      data-testid="foundation-team-settings"
      data-new-look="true"
    >
      <NlCard className="nl-teamsettings-header-card" data-testid="nl-teamsettings-header">
        <div className="nl-teamsettings-header">
          <div className="nl-teamsettings-header-copy">
            <span className="nl-teamsettings-eyebrow">Control Room · {canonicalSeasonLabel}</span>
            <h2 className="nl-teamsettings-title">Team-Einstellungen</h2>
            <p className="nl-teamsettings-note">
              Der Spielmodus ist die einzige Wahrheit für Ownership. Solo = 1 Team, Online 4v4 = 4+4 Teams, Rest AI.
            </p>
            <StatChipRow className="nl-teamsettings-header-chips" aria-label="Team-Einstellungen Kennzahlen">
              <StatChip
                label="Save"
                value={activeSaveName}
                sub={formatFoundationSaveModeLabel(foundationSaveMode)}
                tone="accent"
                onClick={() => setActiveSection("saves")}
                title="Zu Spielstände & Start wechseln"
              />
              <StatChip
                label="Saves im Bereich"
                value={formatNlNumber(saveSummaries.length, 0)}
                sub={activeSaveIsInCurrentMode ? "aktiver Save sichtbar" : "aktiver Save ausserhalb"}
                onClick={() => setActiveSection("saves")}
                title="Zu Spielstände & Start wechseln"
              />
              <StatChip
                label="Steuerung"
                value={`${manualTeams.length}/${aiTeams.length}/${passiveTeams.length}`}
                sub="Manual · AI · Passive"
                onClick={() => setActiveSection("control")}
                title="Zu Spielmodus & KI wechseln"
              />
              <StatChip
                label="Aktives Team"
                value={selectedTeam?.shortCode ?? "—"}
                sub={selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "noch ohne Rang"}
                onClick={() => setActiveSection("team")}
                title="Zum Team-Fokus wechseln"
              />
              <StatChip
                label="GM"
                value={selectedTeamGeneralManager?.profile.name ?? "—"}
                onClick={() => setActiveSection("team")}
                title="Zum Team-Fokus wechseln"
              />
              <StatChip
                label="Draft"
                value={selectedTeamHasUnsavedChanges ? "offen" : "synchron"}
                tone={selectedTeamHasUnsavedChanges ? "warn" : "good"}
                title={selectedTeamHasUnsavedChanges ? "Es gibt ungespeicherte Änderungen." : "Alles synchron."}
              />
            </StatChipRow>
            <div className="nl-teamsettings-pill-row nl-tnum">
              <span className="nl-teamsettings-hint">
                Scenario{" "}
                {formatScenarioTypeLabel(activeSaveSummary?.scenarioMeta?.scenarioType ?? gameState.scenarioMeta?.scenarioType)}
              </span>
              <span className={`nl-teamsettings-hint${readMeta.readOnly ? " is-warn" : ""}`}>
                Spielstand: {readSourceLabel}
              </span>
              <span className="nl-teamsettings-hint">Matchday {gameState.season.currentMatchday}</span>
              <span className="nl-teamsettings-hint">Teams {gameState.teams.length}</span>
              <span className="nl-teamsettings-hint">Spieler {gameState.players.length}</span>
              <span className="nl-teamsettings-hint">Roster {gameState.rosters.length}</span>
              <span className="nl-teamsettings-hint">
                Steuerung {formatTeamControlModeLabel(selectedTeamControl?.controlMode)}
              </span>
            </div>
          </div>
          <div className="nl-teamsettings-header-actions">
            <button
              type="button"
              className="nl-teamsettings-btn is-primary"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("die Team-Settings")
                  : "Speichert Identity, Strategy und Control-Settings lokal in diesem Save."
              }
              onClick={saveTeamSettings}
            >
              Lokal speichern
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={readMeta.readOnly}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("den Team-Settings-Draft")
                  : "Setzt alle lokalen Entwurfs-Änderungen auf den gespeicherten Stand zurück."
              }
              onClick={discardDrafts}
            >
              Draft verwerfen
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              disabled={exportDisabledReason != null}
              title={exportDisabledReason ?? "Exportiert die aktuellen lokalen Team-Settings als JSON."}
              onClick={exportSelectedTeamSettingsJson}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="nl-teamsettings-btn"
              title="Zum Admin-Bereich springen"
              onClick={() => {
                const node = typeof document !== "undefined" ? document.getElementById("foundation-admin") : null;
                if (!node) {
                  return;
                }
                const reduceMotion =
                  typeof window.matchMedia === "function" &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
              }}
            >
              Admin
            </button>
          </div>
        </div>
      </NlCard>

      {renderMessages()}

      <NlSubTabs
        items={NL_TEAMSETTINGS_SECTION_ITEMS}
        activeId={activeSection}
        onSelect={(id) => setActiveSection(id as NlTeamSettingsSection)}
        aria-label="Team-Einstellungen Unterbereiche"
        className="nl-teamsettings-subtabs"
      />

      {activeSection === "saves" ? renderSavesSection() : null}
      {activeSection === "team" ? renderTeamSection() : null}
      {activeSection === "control" ? renderControlSection() : null}
      {activeSection === "strategy" ? renderStrategySection() : null}
    </div>
  );
}
