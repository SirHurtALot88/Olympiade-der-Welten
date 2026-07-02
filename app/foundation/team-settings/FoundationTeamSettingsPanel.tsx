"use client";

import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";
import {
  FOUNDATION_SAVE_MODE_OPTIONS,
  NEW_GAME_PRESET_DEFAULTS,
  NEW_GAME_VISIBLE_PRESET_IDS,
  buildResolvedTeamIdentities,
  buildScenarioWarning,
  buildTeamControlSettingsMap,
  buildTeamIdentityDraftMap,
  buildTeamStrategyProfileMap,
  clampBiasValue,
  clampIdentityValue,
  deriveChrisFrankyTeamIdsFromSettings,
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
  normalizeFoundationSaveMode,
  normalizeTeamStrategyLevel,
  parseCsvList,
  resolveFoundationSaveMode,
  setFoundationView,
  teamIdentityFieldLabels,
  teamStrategyBiasFieldLabels,
  teamStrategyIdentityListFieldLabels,
  teamStrategyLevelFieldLabels,
  teamStrategyListFieldLabels,
  teamStrategySportsBiasAxisMap,
  teamStrategySportsBiasFieldLabels,
  withSynchronizedStrategyAliases,
} from "@/app/foundation/foundation-page-client-exports";
import type { NewGamePresetId } from "@/app/foundation/foundation-page-client-exports";

/** Dumb Team Settings panel (Strangler Phase 3). */
export type FoundationTeamSettingsPanelProps = FoundationShellRouterBodyProps;

export default function FoundationTeamSettingsPanel(props: FoundationTeamSettingsPanelProps) {
  const {
    activeMatchday,
    activeSaveGameMode,
    activeSaveId,
    activeSaveIsInCurrentMode,
    activeSaveName,
    activeSaveSummary,
    activeScenarioWarning,
    activeSeasonId,
    aiLineupApplyEnabled,
    aiLineupAutoApplyEnabled,
    aiLineupPreviewEnabled,
    aiSellPreviewEnabled,
    aiTeams,
    aiTransferPreviewEnabled,
    allowTestWrites,
    applyNewGamePreset,
    baselineCount,
    blockingReasons,
    buildResolvedTeamIdentities,
    buildScenarioWarning,
    buildTeamControlSettingsMap,
    buildTeamIdentityDraftMap,
    buildTeamStrategyProfileMap,
    buyStyle,
    canonicalSeasonLabel,
    changeFoundationSaveMode,
    chrisMax,
    chrisTeamIds,
    clampBiasValue,
    clampIdentityValue,
    containsFinalStandings,
    contractStyle,
    controlMode,
    currentCash,
    currentMatchday,
    currentMatchdayResults,
    currentRosterCount,
    currentRosterEntries,
    currentSaveOwnership,
    currentStoredLineups,
    currentTransferCount,
    currentTransfers,
    deriveChrisFrankyTeamIdsFromSettings,
    dryRun,
    exportSelectedTeamSettingsJson,
    facilityPriorities,
    fantasyTheme,
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
    frankyMax,
    frankyTeamIds,
    freshSeasonStartMessage,
    gameModeOwnershipChrisIds,
    gameModeOwnershipLimits,
    gamePhase,
    gameState,
    getBusyActionReason,
    getCockpitStatusLabel,
    getCockpitStatusPillClass,
    getReadOnlyActionReason,
    importedPlayerCount,
    influencePct,
    isActive,
    isChris,
    isFranky,
    isHotSeat,
    isReplacement,
    isSaveBusy,
    isStableTestPoint,
    lineupDoctrine,
    lineupStyleNote,
    loreTheme,
    manualTeams,
    mappingReport,
    marketDoctrine,
    marketValueTotal,
    matchdayCount,
    matchedRosterCount,
    newGameBusy,
    newGameChrisTeamIds,
    newGameError,
    newGameFrankyTeamIds,
    newGamePresetId,
    newGamePreview,
    newGameSandbox,
    newGameSaveName,
    newGameSuccess,
    nextSaveId,
    nextTeam,
    nextValue,
    normalizeFoundationSaveMode,
    normalizeTeamStrategyLevel,
    openTeamProfileById,
    ownerLabel,
    parseCsvList,
    passiveTeams,
    playerCount,
    playerMin,
    playerOpt,
    playerType,
    previousTeam,
    rawValue,
    readMeta,
    readSourceLabel,
    resetCash,
    resetIdentities,
    resetIdentity,
    resetMatchdayResults,
    resetProfile,
    resetRosterCount,
    resetRosterEntries,
    resetStoredLineups,
    resetTransfers,
    resolveFoundationSaveMode,
    resolvedSaveMode,
    resolvedSeasonId,
    resolvedTeamControlSettings,
    rosterMinTarget,
    rosterOptTarget,
    rosterStyle,
    runNewGameSetup,
    runSaveAction,
    runSeasonStartReset,
    salaryTotal,
    saveContext,
    saveId,
    saveMode,
    saveName,
    saveSummaries,
    saveTeamSettings,
    savedOwnership,
    savedSettings,
    scenarioMeta,
    scenarioType,
    scopeWarning,
    seasonId,
    seasonSetup,
    seasonStartResetBusy,
    seasonStartResetFeed,
    seasonState,
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
    sellStyle,
    sellStyleNote,
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
    shortCode,
    sourceNote,
    sourceSaveId,
    sponsorTotal,
    startCashRowsApplied,
    startCashSource,
    startRank,
    statusLabel,
    strategySummary,
    strategyVersion,
    teamCode,
    teamControlDraft,
    teamControlMessage,
    teamControlSettings,
    teamCount,
    teamId,
    teamIdentities,
    teamIdentityFieldLabels,
    teamIdentityMessage,
    teamIdentityOverrides,
    teamName,
    teamSettings,
    teamSettingsSearch,
    teamStrategyBiasFieldLabels,
    teamStrategyIdentityListFieldLabels,
    teamStrategyLevelFieldLabels,
    teamStrategyListFieldLabels,
    teamStrategyMessage,
    teamStrategyProfiles,
    teamStrategySportsBiasAxisMap,
    teamStrategySportsBiasFieldLabels,
    toggleGameModeOwnershipTeam,
    toggleNewGameTeam,
    transferStyleNote,
    updateTeamControlDraft,
    updateTeamIdentityDraft,
    updateTeamStrategyDraft,
    updatedAt,
    withSynchronizedStrategyAliases
  } = props;

  return (
    <section className="panel foundation-team-settings-panel" data-testid="foundation-team-settings" id="foundation-team-settings">
            <div className="panel-header">
              <h2>Team Settings</h2>
            </div>
            <div className="room-meta foundation-admin-meta">
              <span className="pill">{canonicalSeasonLabel}</span>
              <span className="pill">Save {activeSaveName}</span>
              <span className="pill">Scenario {formatScenarioTypeLabel(activeSaveSummary?.scenarioMeta?.scenarioType ?? gameState.scenarioMeta?.scenarioType)}</span>
              <span className={`pill foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}`}>Spielstand: {readSourceLabel}</span>
              <span className="pill">Matchday {gameState.season.currentMatchday}</span>
              <span className="pill">Teams {gameState.teams.length}</span>
              <span className="pill">Spieler {gameState.players.length}</span>
              <span className="pill">Roster {gameState.rosters.length}</span>
            </div>
            <div className="foundation-team-settings-hero">
              <article className="foundation-team-settings-lead">
                <span className="foundation-kicker">Control Room</span>
                <strong>Spielmodus, Team-Zuordnung und AI-Automation.</strong>
                <p className="muted">
                  Der Spielmodus ist die einzige Wahrheit fuer Ownership. Solo = 1 Team, Online 4v4 = 4+4 Teams, Rest AI.
                </p>
                <div className="room-meta foundation-admin-meta">
                  <span className={`pill${selectedTeamHasUnsavedChanges ? " warning-pill" : " success-pill"}`}>
                    {selectedTeamHasUnsavedChanges ? "Aenderungen offen" : "Alles synchron"}
                  </span>
                  <span className="pill">Aktiv {selectedTeam?.shortCode ?? "—"}</span>
                  <span className="pill">GM {selectedTeamGeneralManager?.profile.name ?? "—"}</span>
                  <span className="pill">Steuerung {formatTeamControlModeLabel(selectedTeamControl?.controlMode)}</span>
                </div>
                <div className="foundation-save-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-team-settings-saves")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Saves & Start
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-team-settings-team-selection")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Team-Fokus
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-team-settings-controls")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Team-KI
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => document.getElementById("foundation-admin")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    Admin
                  </button>
                </div>
              </article>
              <div className="foundation-team-settings-overview">
                <article className="metric-card">
                  <span>Aktiver Save</span>
                  <strong>{activeSaveName}</strong>
                  <small>{formatFoundationSaveModeLabel(foundationSaveMode)}</small>
                </article>
                <article className="metric-card">
                  <span>Saves im Bereich</span>
                  <strong>{saveSummaries.length}</strong>
                  <small>{activeSaveIsInCurrentMode ? "aktiver Save sichtbar" : "aktiver Save ausserhalb"}</small>
                </article>
                <article className="metric-card">
                  <span>Steuerung</span>
                  <strong>{manualTeams.length}/{aiTeams.length}/{passiveTeams.length}</strong>
                  <small>Manual · AI · Passive</small>
                </article>
                <article className="metric-card">
                  <span>Aktives Team</span>
                  <strong>{selectedTeam?.shortCode ?? "—"}</strong>
                  <small>{selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "noch ohne Rang"}</small>
                </article>
              </div>
            </div>
            <div className="foundation-main-grid">
              <section className="panel" id="foundation-team-settings-saves">
                <div className="panel-header">
                  <h2>Spielstaende</h2>
                </div>
                <div className="stack">
                  <article className="metric-card">
                    <span>Aktiv</span>
                    <strong>{activeSaveName}</strong>
                    <small className="muted">
                      {activeSaveSummary ? `Update ${new Date(activeSaveSummary.updatedAt).toLocaleString("de-DE")}` : activeSaveId}
                    </small>
                    <small className="muted">
                      <span data-testid="foundation-active-save-id">{formatShortSaveId(activeSaveId)}</span> · {formatScenarioTypeLabel(activeSaveSummary?.scenarioMeta?.scenarioType ?? gameState.scenarioMeta?.scenarioType)}
                    </small>
                    <small className="muted">
                      {activeSaveSummary?.scenarioMeta?.activeSeasonId ?? gameState.scenarioMeta?.activeSeasonId ?? gameState.season.id} ·{" "}
                      {activeSaveSummary?.scenarioMeta?.gamePhase ?? gameState.scenarioMeta?.gamePhase ?? gameState.gamePhase ?? "season_active"} ·{" "}
                      MD {activeSaveSummary?.scenarioMeta?.activeMatchday ?? gameState.scenarioMeta?.activeMatchday ?? gameState.season.currentMatchday}
                    </small>
                    <small className={`foundation-read-status${readMeta.readOnly ? " is-readonly" : ""}`}>
                      Spielstand: {readSourceLabel}
                    </small>
                  </article>
                  {activeScenarioWarning ? (
                    <div className="transfer-callout is-warning">
                      <strong>Save-Hinweis</strong>
                      <span>{activeScenarioWarning}</span>
                    </div>
                  ) : null}

                  <label className="filter-field">
                    <span>Save-Bereich</span>
                    <select
                      className="input"
                      data-testid="foundation-save-mode-select"
                      value={foundationSaveMode}
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den Save-Bereich")
                          : isSaveBusy
                            ? getBusyActionReason("Der Save-Wechsel")
                            : "Waehlt, in welchem Bereich lokale Spielstaende angezeigt und gesteuert werden."
                      }
                      onChange={(event) => changeFoundationSaveMode(normalizeFoundationSaveMode(event.target.value))}
                    >
                      {FOUNDATION_SAVE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filter-field">
                    <span>Aktiven Save wechseln</span>
                    <select
                      className="input"
                      data-testid="foundation-save-switch-select"
                      value={activeSaveIsInCurrentMode ? activeSaveId : ""}
                      disabled={isSaveBusy || readMeta.readOnly || saveSummaries.length === 0}
                      title={
                        saveSummaries.length === 0
                          ? "In diesem Save-Bereich gibt es gerade keine Spielstaende."
                          : readMeta.readOnly
                            ? getReadOnlyActionReason("den aktiven Spielstand")
                            : isSaveBusy
                              ? getBusyActionReason("Der Save-Wechsel")
                              : "Waehlt den lokalen Spielstand, mit dem du weiterarbeitest."
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
                      {saveSummaries.map((save) => (
                        <option key={save.saveId} value={save.saveId}>
                          {save.name} · {formatFoundationSaveModeLabel(save.saveMode ?? resolveFoundationSaveMode(save))} ({save.status})
                        </option>
                      ))}
                    </select>
                  </label>

                  <section className="panel" data-testid="new-game-setup-wizard">
                    <div className="panel-header">
                      <h3>Neues Spiel starten</h3>
                      <span className="pill">Baseline · Startbudget · Ownership</span>
                    </div>
                    <p className="muted">
                      Erst pruefen, dann erstellen. Der aktuelle Save bleibt erhalten; beim Confirm wird ein neuer lokaler Save aktiv.
                    </p>
                    <div className="filter-grid">
                      <label className="filter-field">
                        <span>Spielmodus</span>
                        <select
                          className="input"
                          value={newGamePresetId}
                          disabled={newGameBusy || readMeta.readOnly}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("den Spielmodus")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Waehlt das Basissetup fuer das neue Spiel."
                          }
                          onChange={(event) => applyNewGamePreset(event.target.value as NewGamePresetId)}
                        >
                          {NEW_GAME_VISIBLE_PRESET_IDS.map((presetId) => (
                            <option key={presetId} value={presetId}>
                              {NEW_GAME_PRESET_DEFAULTS[presetId].label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-field">
                        <span>Save-Name</span>
                        <input
                          className="input"
                          value={newGameSaveName}
                          disabled={newGameBusy || readMeta.readOnly}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("den Save-Namen")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Optionaler Name fuer den neuen lokalen Spielstand."
                          }
                          placeholder="Optional, sonst automatisch"
                          onChange={(event) => {
                            setNewGameSaveName(event.target.value);
                            setNewGamePreview(null);
                          }}
                        />
                      </label>
                      <label className="filter-field checkbox-field">
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
                      <label className="filter-field" data-testid="new-game-solo-team-select">
                        <span>Dein Team</span>
                        <select
                          className="input"
                          disabled={newGameBusy || readMeta.readOnly}
                          value={newGameChrisTeamIds[0] ?? ""}
                          title={
                            readMeta.readOnly
                              ? getReadOnlyActionReason("die Team-Zuordnung")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Waehle genau 1 Team fuer den Solo-Spielstand."
                          }
                          onChange={(event) => {
                            if (event.target.value) {
                              setNewGameSoloTeam(event.target.value);
                            }
                          }}
                        >
                          <option value="" disabled>
                            Team waehlen
                          </option>
                          {[...gameState.teams]
                            .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                            .map((team) => (
                              <option key={`new-game-solo-${team.teamId}`} value={team.teamId}>
                                {team.name} ({team.shortCode}) · Budget {formatMoney(team.budget)}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <div className="metric-grid compact">
                          <article className="metric-card">
                            <span>Chris</span>
                            <strong>{newGameChrisTeamIds.length}/4</strong>
                            <small>{newGameChrisTeamIds.join(" · ") || "kein Team"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Franky</span>
                            <strong>{newGameFrankyTeamIds.length}/4</strong>
                            <small>{newGameFrankyTeamIds.join(" · ") || "kein Team"}</small>
                          </article>
                          <article className="metric-card">
                            <span>Rest</span>
                            <strong>{Math.max(0, gameState.teams.length - newGameChrisTeamIds.length - newGameFrankyTeamIds.length)}</strong>
                            <small>Auto-Teams</small>
                          </article>
                        </div>

                        <div className="team-chip-grid" data-testid="new-game-ownership-picker">
                          {[...gameState.teams]
                            .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                            .map((team) => {
                              const isChris = newGameChrisTeamIds.includes(team.teamId);
                              const isFranky = newGameFrankyTeamIds.includes(team.teamId);
                              return (
                                <div
                                  key={`new-game-team-${team.teamId}`}
                                  className={`team-settings-team-card${isChris ? " is-owned-by-user" : ""}${isFranky ? " is-owned-by-remote" : ""}`}
                                  onClick={() => openTeamProfileById(team.teamId)}
                                  title="Teamprofil öffnen"
                                >
                                  <strong>{team.shortCode}</strong>
                                  <span>{team.name}</span>
                                  <small>Budget {formatMoney(team.budget)}</small>
                                  <div className="foundation-save-actions save-summary-actions">
                                    <button
                                      className={isChris ? "primary-button inline-button" : "secondary-button inline-button"}
                                      type="button"
                                      disabled={newGameBusy || readMeta.readOnly || isFranky}
                                      title={
                                        isFranky
                                          ? "Dieses Team ist bereits Franky zugeordnet."
                                          : readMeta.readOnly
                                            ? getReadOnlyActionReason("die Team-Zuordnung")
                                            : newGameBusy
                                              ? getBusyActionReason("Das New-Game-Setup")
                                              : "Ordnet dieses Team Chris/User fuer den neuen Spielstand zu."
                                      }
                                      onClick={() => toggleNewGameTeam("chris", team.teamId)}
                                    >
                                      Chris
                                    </button>
                                    <button
                                      className={isFranky ? "primary-button inline-button" : "secondary-button inline-button"}
                                      type="button"
                                      disabled={newGameBusy || readMeta.readOnly || isChris}
                                      title={
                                        isChris
                                          ? "Dieses Team ist bereits Chris/User zugeordnet."
                                          : readMeta.readOnly
                                            ? getReadOnlyActionReason("die Team-Zuordnung")
                                            : newGameBusy
                                              ? getBusyActionReason("Das New-Game-Setup")
                                              : "Ordnet dieses Team Franky fuer den neuen Spielstand zu."
                                      }
                                      onClick={() => toggleNewGameTeam("franky", team.teamId)}
                                    >
                                      Franky
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </>
                    )}

                    <div className="foundation-save-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={newGameBusy || readMeta.readOnly}
                        title={
                          readMeta.readOnly
                            ? getReadOnlyActionReason("das New-Game-Setup")
                            : newGameBusy
                              ? getBusyActionReason("Das New-Game-Setup")
                              : "Prueft Baseline, Ownership und Season-Setup, bevor der neue Spielstand gebaut wird."
                        }
                        onClick={() => void runNewGameSetup(true)}
                      >
                        {newGameBusy ? "Prueft..." : "Setup pruefen"}
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          newGameBusy ||
                          readMeta.readOnly ||
                          !newGamePreview ||
                          newGamePreview.blockers.length > 0
                        }
                        title={
                          readMeta.readOnly
                            ? getReadOnlyActionReason("ein neues Spiel")
                            : newGameBusy
                              ? getBusyActionReason("Das New-Game-Setup")
                              : !newGamePreview
                                ? "Bitte zuerst das Setup pruefen."
                                : newGamePreview.blockers.length > 0
                                  ? `Noch offen: ${newGamePreview.blockers.map((reason) => formatCockpitReason(reason)).join(" · ")}`
                                  : "Erstellt den neuen lokalen Spielstand mit dem geprueften Setup."
                        }
                        onClick={() => void runNewGameSetup(false)}
                      >
                        Neues Spiel erstellen
                      </button>
                    </div>

                    {newGameError ? <p className="text-negative">{newGameError}</p> : null}
                    {newGameSuccess ? <p className="text-positive">{newGameSuccess}</p> : null}
                    {newGamePreview ? (
                      <section className="panel">
                        <div className="panel-header">
                          <h3>New-Game Preview</h3>
                          <span className={newGamePreview.blockers.length > 0 ? "transfer-status-pill is-danger" : "transfer-status-pill is-ready"}>
                            {newGamePreview.blockers.length > 0 ? "blockiert" : "ready"}
                          </span>
                        </div>
                        <div className="metric-grid compact">
                          <article className="metric-card">
                            <span>Baseline</span>
                            <strong>{newGamePreview.baseline.baselineCount}/{newGamePreview.baseline.playerCount}</strong>
                            <small>Spieler werden auf Ursprung gesetzt</small>
                          </article>
                          <article className="metric-card">
                            <span>Season</span>
                            <strong>{newGamePreview.seasonSetup.seasonId}</strong>
                            <small>{newGamePreview.seasonSetup.matchdayCount} Spieltage · Matchday {newGamePreview.seasonSetup.currentMatchday}</small>
                          </article>
                          <article className="metric-card">
                            <span>Ownership</span>
                            <strong>{newGamePreview.counts.chris}+{newGamePreview.counts.franky}+{newGamePreview.counts.ai}</strong>
                            <small>Chris · Franky · AI</small>
                          </article>
                          <article className="metric-card">
                            <span>Room</span>
                            <strong>{newGamePreview.room.enabled ? "Online vorbereitet" : "Solo"}</strong>
                            <small>{newGamePreview.room.enabled ? "Code beim Erstellen" : "kein Room"}</small>
                          </article>
                        </div>
                        <div className="table-shell">
                          <table className="data-table compact-table">
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
                                .filter((team) => team.ownerLabel !== "AI" || team.startRank <= 5 || team.teamId === "R-R")
                                .sort((a, b) => a.startRank - b.startRank)
                                .map((team) => (
                                  <tr key={`new-game-preview-${team.teamId}`} onClick={() => openTeamProfileById(team.teamId)}>
                                    <td>{team.startRank}</td>
                                    <td>{team.shortCode} · {team.name}</td>
                                    <td>{formatMoney(team.budget)}</td>
                                    <td>{team.ownerLabel}</td>
                                    <td>{formatTeamControlModeLabel(team.controlMode)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        {newGamePreview.warnings.length > 0 ? (
                          <p className="muted">Hinweise: {newGamePreview.warnings.join(" · ")}</p>
                        ) : null}
                        {newGamePreview.blockers.length > 0 ? (
                          <p className="text-negative">Blocker: {newGamePreview.blockers.join(" · ")}</p>
                        ) : null}
                      </section>
                    ) : null}
                  </section>

                  <div className="foundation-save-actions">
                    <button
                      className="secondary-button"
                      type="button"
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
                      className="primary-button"
                      type="button"
                      disabled={isSaveBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("ein neues Spiel")
                          : isSaveBusy
                            ? getBusyActionReason("Die Save-Aktion")
                            : "Startet einen frischen Season-1-Spielstand, ohne bestehende Saves zu loeschen."
                      }
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Erstellt einen neuen lokalen Testspielstand fuer Season 1. Bestehende Saves bleiben erhalten.",
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
                      className="secondary-button"
                      type="button"
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
                      className="secondary-button"
                      type="button"
                      disabled={seasonStartResetBusy || readMeta.readOnly}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den Season-Start-Reset")
                          : seasonStartResetBusy
                            ? getBusyActionReason("Der Season-Start-Reset")
                            : "Prueft, wie der aktuelle Save auf den Season-Start zurueckgesetzt wuerde."
                      }
                      onClick={() => {
                        void runSeasonStartReset(false);
                      }}
                    >
                      {seasonStartResetBusy ? "Laedt..." : "Season-Start-Reset pruefen"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={seasonStartResetBusy || readMeta.readOnly || !seasonStartResetFeed || !seasonStartResetFeed.dryRun}
                      title={
                        readMeta.readOnly
                          ? getReadOnlyActionReason("den Season-Start-Reset")
                          : seasonStartResetBusy
                            ? getBusyActionReason("Der Season-Start-Reset")
                            : !seasonStartResetFeed || !seasonStartResetFeed.dryRun
                              ? "Bitte zuerst den Reset trocken pruefen."
                              : "Setzt den aktuellen lokalen Save hart auf den Season-Start zurueck."
                      }
                      onClick={() => {
                        if (!seasonStartResetFeed) {
                          return;
                        }
                        const confirmed = window.confirm(
                          `Aktuellen Save jetzt hart auf Season-Start zuruecksetzen? ${seasonStartResetFeed.summary.currentTransfers} Transfers, ${seasonStartResetFeed.summary.currentRosterEntries} Roster-Eintraege und gespeicherte Spieltagsdaten werden entfernt.`,
                        );
                        if (!confirmed) {
                          return;
                        }
                        void runSeasonStartReset(true);
                      }}
                    >
                      Season-Start-Reset ausfuehren
                    </button>
                  </div>

                  {freshSeasonStartMessage ? <p className="text-positive">{freshSeasonStartMessage}</p> : null}
                  {seasonStartResetFeed ? (
                    <section className="panel">
                      <div className="panel-header">
                        <h3>Season-Start-Reset</h3>
                        <span className={getCockpitStatusPillClass(seasonStartResetFeed.status)}>
                          {getCockpitStatusLabel(seasonStartResetFeed.status)}
                        </span>
                      </div>
                      <p className="muted">
                        Save {seasonStartResetFeed.saveContext.saveName ?? activeSaveName} ·{" "}
                        {seasonStartResetFeed.saveContext.resolvedSeasonId ?? gameState.season.id}
                      </p>
                      <div className="metric-grid compact">
                        <article className="metric-card">
                          <span>Transfers</span>
                          <strong>{seasonStartResetFeed.summary.currentTransfers} → {seasonStartResetFeed.summary.resetTransfers}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Roster</span>
                          <strong>{seasonStartResetFeed.summary.currentRosterEntries} → {seasonStartResetFeed.summary.resetRosterEntries}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Stored Results</span>
                          <strong>{seasonStartResetFeed.summary.currentMatchdayResults} → {seasonStartResetFeed.summary.resetMatchdayResults}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Lineups</span>
                          <strong>{seasonStartResetFeed.summary.currentStoredLineups} → {seasonStartResetFeed.summary.resetStoredLineups}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Start-Cash Quelle</span>
                          <strong>{seasonStartResetFeed.summary.startCashSource === "reference" ? "Referenz" : "Fresh Seed"}</strong>
                        </article>
                        <article className="metric-card">
                          <span>Cash-Zeilen</span>
                          <strong>{seasonStartResetFeed.summary.startCashRowsApplied}</strong>
                        </article>
                      </div>
                      {seasonStartResetFeed.saveContext.scopeWarning ? (
                        <p className="text-negative">{seasonStartResetFeed.saveContext.scopeWarning}</p>
                      ) : null}
                      {seasonStartResetFeed.warnings.length > 0 ? (
                        <p className="muted">Warnings: {seasonStartResetFeed.warnings.join(" · ")}</p>
                      ) : null}
                      {seasonStartResetFeed.blockingReasons.length > 0 ? (
                        <p className="text-negative">Blocker: {seasonStartResetFeed.blockingReasons.join(" · ")}</p>
                      ) : null}
                      <div className="table-shell">
                        <table className="data-table compact-table">
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
                            {seasonStartResetFeed.teams.map((team) => (
                              <tr key={`season-start-reset-${team.teamId}`} onClick={() => openTeamProfileById(team.teamId)}>
                                <td>{team.teamCode} · {team.teamName}</td>
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
                  ) : null}

                  <div className="save-summary-list">
                    {saveSummaries.length === 0 ? (
                      <div className="transfer-callout">
                        <strong>Keine Spielstaende in diesem Bereich</strong>
                        <span>Wechsle den Save-Bereich oder starte ein neues Spiel in diesem Modus.</span>
                      </div>
                    ) : null}
                    {saveSummaries.map((save) => {
                      const meta = save.scenarioMeta;
                      const warning = buildScenarioWarning(meta);
                      const resolvedSaveMode = save.saveMode ?? resolveFoundationSaveMode(save);
                      return (
                        <article
                          key={save.saveId}
                          className={`save-summary-card${save.saveId === activeSaveId ? " is-active" : ""}`}
                        >
                          <div className="save-summary-card-head">
                            <strong>{save.name}</strong>
                            <span className="pill">{formatScenarioTypeLabel(meta?.scenarioType)}</span>
                          </div>
                          <span className="muted">
                            {formatShortSaveId(save.saveId)} · {formatFoundationSaveModeLabel(resolvedSaveMode)} · {save.status}
                          </span>
                          <span className="muted">
                            {meta?.activeSeasonId ?? "—"} · {meta?.gamePhase ?? "—"} · MD {meta?.activeMatchday ?? "—"}
                          </span>
                          <span className="muted">Update {new Date(save.updatedAt).toLocaleString("de-DE")}</span>
                          <div className="save-summary-flags">
                            <span className={`transfer-status-pill${meta?.containsFinalStandings ? " is-ready" : " is-warning"}`}>
                              S1-Endstand {meta?.containsFinalStandings ? "ja" : "nein"}
                            </span>
                            <span className={`transfer-status-pill${meta?.scenarioType === "season2_start" ? " is-ready" : ""}`}>
                              S2-Start {meta?.scenarioType === "season2_start" ? "ja" : "nein"}
                            </span>
                            {meta?.isStableTestPoint ? <span className="transfer-status-pill is-ready">Stable Testpoint</span> : null}
                            {meta?.scenarioType === "sandbox_multiseason_test" ? (
                              <span className="transfer-status-pill is-warning">Sandbox</span>
                            ) : null}
                            {meta?.allowTestWrites ? (
                              <span className="transfer-status-pill is-warning">Test Writes erlaubt</span>
                            ) : null}
                          </div>
                          {warning ? <span className="muted">{warning}</span> : null}
                          <div className="foundation-save-actions save-summary-actions">
                            <button
                              className="secondary-button inline-button"
                              type="button"
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
                              className="secondary-button inline-button"
                              type="button"
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
                              className="secondary-button inline-button"
                              type="button"
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
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Importstatus</h2>
                </div>
                <div className="metric-grid">
                  <article className="metric-card">
                    <span>Spieler</span>
                    <strong>{gameState.mappingReport.importedPlayerCount}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Teams</span>
                    <strong>{gameState.mappingReport.teamCount}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Gemappt</span>
                    <strong>{gameState.mappingReport.matchedRosterCount}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Warnungen</span>
                    <strong>{gameState.mappingReport.warnings.length}</strong>
                  </article>
                </div>
              </section>

              <section className="panel foundation-wide foundation-team-settings-focus-panel">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Aktives Team</h2>
                    <p className="muted">Das aktuell ausgewaehlte Team steht hier im Zentrum. Von hier springst du direkt in Kader, Markt oder Team-Drawer.</p>
                  </div>
                  <div className="room-meta foundation-admin-meta">
                    <span className="pill">{selectedTeam?.name ?? "Kein Team"}</span>
                    <span className="pill">Roster {selectedRoster.length}</span>
                    <span className="pill">GM {selectedTeamGeneralManager?.profile.archetype ?? "—"}</span>
                  </div>
                </div>
                <div className="foundation-team-settings-focus-grid">
                  <article className="foundation-team-settings-focus-card is-primary">
                    <span>Team</span>
                    <strong>{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Kein Team aktiv"}</strong>
                    <small>
                      {selectedTeam
                        ? `${formatTeamControlModeLabel(selectedTeamControl?.controlMode)} · ${selectedStandingRow?.rank != null ? `Rang #${selectedStandingRow.rank}` : "noch ohne Rang"}`
                        : "Waehle oben ein Team fuer Identity, Strategy und Control."}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Punkte</span>
                    <strong>{selectedStandingRow?.points != null ? formatLocalePoints(selectedStandingRow.points, 1) : "—"}</strong>
                    <small>Live-Stand</small>
                  </article>
                  <article className="metric-card">
                    <span>Cash</span>
                    <strong>{selectedStandingRow?.cash != null ? formatMoney(selectedStandingRow.cash) : "—"}</strong>
                    <small>liquide Mittel</small>
                  </article>
                  <article className="metric-card">
                    <span>Gehalt</span>
                    <strong>{selectedStandingRow?.salaryTotal != null ? formatMoney(selectedStandingRow.salaryTotal) : "—"}</strong>
                    <small>aktueller Kader</small>
                  </article>
                  <article className="metric-card">
                    <span>MW</span>
                    <strong>{selectedStandingRow?.marketValueTotal != null ? formatMoney(selectedStandingRow.marketValueTotal) : "—"}</strong>
                    <small>gesamter Kader</small>
                  </article>
                  <article className="metric-card">
                    <span>Sponsor</span>
                    <strong>{selectedStandingRow?.sponsorTotal != null ? formatMoney(selectedStandingRow.sponsorTotal) : "—"}</strong>
                    <small>pro Season</small>
                  </article>
                </div>
                {selectedTeamGeneralManager ? (
                  <div className="foundation-team-settings-gm-panel">
                    <article className="foundation-team-settings-focus-card foundation-team-settings-gm-summary">
                      <span>GM-Einfluss</span>
                      <strong>{selectedTeamGeneralManager.profile.name}</strong>
                      {selectedHqGmStory ? (
                        <span className={`transfer-status-pill${selectedHqGmStory.isHotSeat ? " is-warning" : selectedHqGmStory.isReplacement ? " is-info" : ""}`}>
                          {selectedHqGmStory.statusLabel}
                        </span>
                      ) : null}
                      <p>
                        {selectedTeamGeneralManager.profile.title} wirkt aktuell zu{" "}
                        <strong>{selectedTeamGeneralManager.assignment.influencePct}%</strong> auf Teamidentitaet, Pick-Fokus,
                        Cash-Risiko und Vertragsstil.
                      </p>
                      {selectedTeamGmAxisShares ? (
                        <div className="team-drawer-gm-axis-row">
                          <span className="is-pow">POW {selectedTeamGmAxisShares.pow}%</span>
                          <span className="is-spe">SPE {selectedTeamGmAxisShares.spe}%</span>
                          <span className="is-men">MEN {selectedTeamGmAxisShares.men}%</span>
                          <span className="is-soc">SOC {selectedTeamGmAxisShares.soc}%</span>
                        </div>
                      ) : null}
                    </article>
                    <article className="foundation-team-settings-focus-card">
                      <span>Wie er tickt</span>
                      <strong>dominante Hebel</strong>
                      <div className="team-drawer-gm-bias-grid">
                        {selectedTeamGmBiasHighlights.map((entry) => (
                          <div className="team-drawer-gm-bias-row" key={`gm-bias-${entry.key}`}>
                            <span>{entry.label}</span>
                            <strong>
                              {entry.tendency} · {entry.rawValue}/10
                            </strong>
                            <small>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</small>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className="foundation-team-settings-focus-card">
                      <span>Doktrin</span>
                      <strong>{selectedTeamGeneralManager.profile.marketDoctrine}</strong>
                      <small>{selectedTeamGeneralManager.profile.lineupDoctrine}</small>
                      <div className="foundation-pill-row">
                        {selectedTeamGeneralManager.profile.facilityPriorities.slice(0, 3).map((facility) => (
                          <span className="pill" key={`gm-facility-${facility}`}>
                            {facility}
                          </span>
                        ))}
                      </div>
                    </article>
                  </div>
                ) : null}
                <div className="foundation-save-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!selectedTeam}
                    title={selectedTeam ? "Teamprofil öffnen" : "Waehle zuerst ein Team aus."}
                    onClick={() => selectedTeam && openTeamProfileById(selectedTeam.teamId)}
                  >
                    Teamprofil
                  </button>
                </div>
              </section>

              <section className="panel foundation-wide" id="foundation-team-settings-team-selection">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Team-Auswahl</h2>
                    <p className="muted">Waehlt das Team fuer Identity, Strategy Profile und Control Settings. Der Wechsel bleibt ueber die URL teilbar.</p>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "minmax(240px, 1.3fr) minmax(220px, 1fr) auto auto",
                    alignItems: "end",
                  }}
                >
                  <label className="stack">
                    <span>Team waehlen</span>
                    <select
                      className="input"
                      value={selectedTeamId}
                      onChange={(event) => selectTeamSettingsTeam(event.target.value)}
                    >
                      {gameState.teams.map((team) => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.name} ({team.shortCode})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span>Teamliste filtern</span>
                    <input
                      className="input"
                      type="search"
                      placeholder="Name oder Teamcode"
                      value={teamSettingsSearch}
                      onChange={(event) => setTeamSettingsSearch(event.target.value)}
                    />
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
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
                    className="secondary-button"
                    type="button"
                    disabled={selectedTeamSettingsIndex < 0 || selectedTeamSettingsIndex >= gameState.teams.length - 1}
                    title={
                      selectedTeamSettingsIndex < 0 || selectedTeamSettingsIndex >= gameState.teams.length - 1
                        ? "Du bist bereits beim letzten Team der Liste."
                        : "Springt zum naechsten Team in der aktuellen Liste."
                    }
                    onClick={() => {
                      const nextTeam = gameState.teams[selectedTeamSettingsIndex + 1];
                      if (nextTeam) {
                        selectTeamSettingsTeam(nextTeam.teamId);
                      }
                    }}
                  >
                    Naechstes
                  </button>
                </div>
                <div className="room-meta foundation-admin-meta" style={{ marginTop: 12 }}>
                  <span className="pill">Aktiv {selectedTeam?.name ?? "—"}</span>
                  <span className="pill">Code {selectedTeam?.shortCode ?? "—"}</span>
                  <span className="pill">Teams {gameState.teams.length}</span>
                  <span className="pill">{selectedTeamHasUnsavedChanges ? "Nicht gespeichert" : "Synchron"}</span>
                </div>
                <div className="team-selector">
                  {filteredTeamSettingsTeams.map((team) => {
                    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
                    const isActive = selectedTeam?.teamId === team.teamId;
                    const controlMode = resolvedTeamControlSettings[team.teamId]?.controlMode ?? "manual";

                    return (
                      <button
                        key={team.teamId}
                        className={`team-selector-card${isActive ? " is-active" : ""}`}
                        type="button"
                        onClick={() => {
                          selectTeamSettingsTeam(team.teamId);
                          setFoundationView("teamSettings", setActiveView);
                        }}
                      >
                        <span className="team-selector-code">{team.shortCode}</span>
                        <strong>{team.name}</strong>
                        <span className="muted">
                          Roster {rosterCount} · {formatTeamControlModeLabel(controlMode)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="panel foundation-wide" id="foundation-team-settings-controls">
                <div className="panel-header">
                  <div className="stack">
                    <h2>Spielmodus &amp; Team-Zuordnung</h2>
                    <p className="muted">
                      Eine Wahrheit pro Save: Der Spielmodus legt fest, wie viele Teams menschlich sind. Alles andere laeuft als AI.
                      Aenderungen erst mit &quot;Lokal speichern&quot; dauerhaft schreiben.
                    </p>
                  </div>
                  <div className="foundation-save-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={readMeta.readOnly}
                      title={readMeta.readOnly ? getReadOnlyActionReason("die Team-Control-Settings") : "Speichert Spielmodus-Zuordnung und AI-Automation in diesem Save."}
                      onClick={saveTeamSettings}
                    >
                      Lokal speichern
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={readMeta.readOnly}
                      title={readMeta.readOnly ? getReadOnlyActionReason("den Team-Control-Draft") : "Setzt alle lokalen Entwurfs-Aenderungen auf den gespeicherten Stand zurueck."}
                      onClick={() => {
                        const savedSettings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
                        const savedOwnership = deriveChrisFrankyTeamIdsFromSettings(gameState.teams, savedSettings);
                        setTeamIdentityDraft(buildTeamIdentityDraftMap(gameState.teams, gameState.teamIdentities));
                        setTeamControlDraft(savedSettings);
                        setGameModeOwnershipChrisIds(savedOwnership.chrisTeamIds);
                        setGameModeOwnershipFrankyIds(savedOwnership.frankyTeamIds);
                        setTeamStrategyDraft(
                          buildTeamStrategyProfileMap(
                            gameState.teams,
                            gameState.teamIdentities,
                            gameState.seasonState.teamStrategyProfiles,
                          ),
                        );
                        setTeamIdentityMessage("Nicht gespeicherte Team-Identity-Änderungen wurden verworfen.");
                        setTeamControlMessage("Nicht gespeicherte Änderungen wurden verworfen.");
                        setTeamStrategyMessage("Nicht gespeicherte Strategy-Profile wurden verworfen.");
                      }}
                    >
                      Draft verwerfen
                    </button>
                  </div>
                  {readMeta.readOnly ? (
                    <p className="foundation-screen-action-reason">Warum nicht: {getReadOnlyActionReason("die Team-Control-Settings")}</p>
                  ) : null}
                </div>
                <div className="room-meta foundation-admin-meta" style={{ marginTop: 12 }}>
                  <span className="pill" data-testid="foundation-active-game-mode">
                    Modus {formatFoundationSaveModeLabel(activeSaveGameMode)}
                  </span>
                  <span className="pill">Chris {currentSaveOwnership.chrisTeamIds.length}/{gameModeOwnershipLimits.chrisMax}</span>
                  {gameModeOwnershipLimits.frankyMax > 0 ? (
                    <span className="pill">Franky {currentSaveOwnership.frankyTeamIds.length}/{gameModeOwnershipLimits.frankyMax}</span>
                  ) : null}
                  <span className="pill">AI {aiTeams.length}</span>
                  <span className={`pill foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}`}>Speichern: {readSourceLabel}</span>
                </div>

                <section className="panel" data-testid="game-mode-ownership-panel" style={{ marginTop: 12 }}>
                  <div className="panel-header">
                    <div className="stack">
                      <h3>Team-Zuordnung</h3>
                      <p className="muted">
                        {activeSaveGameMode === "online_4v4"
                          ? "Waehle genau 4 Teams fuer Chris und 4 fuer Franky. Alle anderen Teams bleiben AI."
                          : activeSaveGameMode === "solo_1"
                            ? "Waehle genau 1 Team fuer dich. Alle anderen Teams bleiben AI."
                            : `Maximal ${gameModeOwnershipLimits.chrisMax} Chris-Team(s)${gameModeOwnershipLimits.frankyMax ? ` und ${gameModeOwnershipLimits.frankyMax} Franky-Team(s)` : ""}.`}
                      </p>
                    </div>
                  </div>

                  {activeSaveGameMode === "solo_1" || (gameModeOwnershipLimits.chrisMax === 1 && gameModeOwnershipLimits.frankyMax === 0) ? (
                    <label className="filter-field" style={{ marginTop: 12 }}>
                      <span>Dein Team</span>
                      <select
                        className="input"
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
                          Team waehlen
                        </option>
                        {gameState.teams.map((team) => (
                          <option key={`solo-team-${team.teamId}`} value={team.teamId}>
                            {team.name} ({team.shortCode})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <div className="metric-grid compact" style={{ marginTop: 12 }}>
                        <article className="metric-card">
                          <span>Chris</span>
                          <strong>{currentSaveOwnership.chrisTeamIds.length}/{gameModeOwnershipLimits.chrisMax}</strong>
                          <small>{currentSaveOwnership.chrisTeamIds.join(" · ") || "kein Team"}</small>
                        </article>
                        <article className="metric-card">
                          <span>Franky</span>
                          <strong>{currentSaveOwnership.frankyTeamIds.length}/{gameModeOwnershipLimits.frankyMax}</strong>
                          <small>{currentSaveOwnership.frankyTeamIds.join(" · ") || "kein Team"}</small>
                        </article>
                        <article className="metric-card">
                          <span>AI</span>
                          <strong>
                            {Math.max(
                              0,
                              gameState.teams.length -
                                currentSaveOwnership.chrisTeamIds.length -
                                currentSaveOwnership.frankyTeamIds.length,
                            )}
                          </strong>
                          <small>automatisch</small>
                        </article>
                      </div>
                      <div className="team-chip-grid" data-testid="game-mode-ownership-picker">
                        {[...gameState.teams]
                          .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
                          .map((team) => {
                            const isChris = currentSaveOwnership.chrisTeamIds.includes(team.teamId);
                            const isFranky = currentSaveOwnership.frankyTeamIds.includes(team.teamId);
                            return (
                              <div
                                key={`game-mode-team-${team.teamId}`}
                                className={`team-settings-team-card${isChris ? " is-owned-by-user" : ""}${isFranky ? " is-owned-by-remote" : ""}`}
                              >
                                <strong>{team.shortCode}</strong>
                                <span>{team.name}</span>
                                <div className="foundation-save-actions save-summary-actions">
                                  <button
                                    className={isChris ? "primary-button inline-button" : "secondary-button inline-button"}
                                    type="button"
                                    disabled={readMeta.readOnly || isFranky}
                                    onClick={() => toggleGameModeOwnershipTeam("chris", team.teamId)}
                                  >
                                    Chris
                                  </button>
                                  <button
                                    className={isFranky ? "primary-button inline-button" : "secondary-button inline-button"}
                                    type="button"
                                    disabled={readMeta.readOnly || isChris || gameModeOwnershipLimits.frankyMax === 0}
                                    onClick={() => toggleGameModeOwnershipTeam("franky", team.teamId)}
                                  >
                                    Franky
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </section>

                <section className="panel" data-testid="ai-automation-panel" style={{ marginTop: 12 }}>
                  <div className="panel-header">
                    <div className="stack">
                      <h3>AI-Automation (nur AI-Teams)</h3>
                      <p className="muted">Preview- und Apply-Flags fuer automatisierte AI-Teams. Ownership bleibt unveraendert.</p>
                    </div>
                  </div>
                  <div className="table-shell" style={{ marginTop: 12 }}>
                    <table className="data-table compact-table">
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
                          .filter((team) => (teamControlDraft[team.teamId] ?? resolvedTeamControlSettings[team.teamId])?.controlMode === "ai")
                          .map((team) => {
                            const settings = teamControlDraft[team.teamId] ?? resolvedTeamControlSettings[team.teamId];
                            if (!settings) return null;
                            return (
                              <tr key={`ai-auto-${team.teamId}`}>
                                <td>
                                  <strong>{team.shortCode}</strong>
                                  <span className="muted"> {team.name}</span>
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={settings.aiLineupPreviewEnabled}
                                    disabled={readMeta.readOnly}
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
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
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
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
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
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
                                    onChange={(event) => {
                                      updateTeamControlDraft(team.teamId, (current) => ({
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
                <div className="foundation-save-actions" style={{ marginTop: 12 }}>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!selectedTeam || !selectedIdentityDraft || !selectedTeamStrategyDraft}
                    title={
                      !selectedTeam
                        ? "Waehle zuerst ein Team aus."
                        : !selectedIdentityDraft || !selectedTeamStrategyDraft
                          ? "Fuer dieses Team fehlen noch lokale Identity- oder Strategy-Daten."
                          : "Exportiert die aktuellen lokalen Team-Settings als JSON."
                    }
                    onClick={exportSelectedTeamSettingsJson}
                  >
                    Export JSON
                  </button>
                </div>
                {!selectedTeam || !selectedIdentityDraft || !selectedTeamStrategyDraft ? (
                  <p className="foundation-screen-action-reason">
                    Warum nicht: {!selectedTeam ? "Waehle zuerst ein Team aus." : "Fuer dieses Team fehlen noch lokale Identity- oder Strategy-Daten."}
                  </p>
                ) : null}
                {teamIdentityMessage ? <p className="text-positive">{teamIdentityMessage}</p> : null}
                {teamControlMessage ? <p className="text-positive">{teamControlMessage}</p> : null}
                {teamStrategyMessage ? <p className="text-positive">{teamStrategyMessage}</p> : null}

                {selectedTeam && selectedTeamStrategyDraft ? (
                  <div className="panel inset-panel" style={{ marginTop: 18 }}>
                    <div className="panel-header">
                      <div className="stack">
                        <h3>Team Strategy Profile</h3>
                        <p className="muted">
                          Ausfuehrlicher lokaler Lore- und Bias-Kontext fuer AI-Erklaerungen. Keine Automatik, keine Auto-Apply-Aktion.
                        </p>
                      </div>
                      <div className="room-meta foundation-admin-meta">
                        <span className="pill">{selectedTeam.name}</span>
                        <span className="pill">{selectedTeam.shortCode}</span>
                        <span className="pill">Steuerung {formatTeamControlModeLabel(selectedTeamControl?.controlMode)}</span>
                      </div>
                    </div>

                    <div className="stats-grid" style={{ marginTop: 12 }}>
                      <article className="metric-card">
                        <span>POW</span>
                        <strong>{selectedIdentityDraft?.pow ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>SPE</span>
                        <strong>{selectedIdentityDraft?.spe ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>MEN</span>
                        <strong>{selectedIdentityDraft?.men ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>SOC</span>
                        <strong>{selectedIdentityDraft?.soc ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Player Type</span>
                        <strong>{selectedIdentityDraft?.playerType ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Profil-Version</span>
                        <strong>{selectedTeamStrategyDraft.strategyVersion ?? "v1-local"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Roster Target</span>
                        <strong>
                          {(selectedTeamStrategyDraft.rosterMinTarget ?? selectedIdentityDraft?.playerMin ?? "—")}/
                          {(selectedTeamStrategyDraft.rosterOptTarget ?? selectedIdentityDraft?.playerOpt ?? "—")}
                        </strong>
                      </article>
                    </div>

                    <div className="panel inset-panel" style={{ marginTop: 16 }}>
                      <div className="panel-header">
                        <div className="stack">
                          <h3>Local Overrides</h3>
                          <p className="muted">
                            Defaults kommen aus den kanonischen Teamquellen. Gespeichert wird nur lokal im aktiven Save, niemals in Prisma.
                          </p>
                        </div>
                      </div>
                      <div className="room-meta foundation-admin-meta" style={{ marginTop: 12 }}>
                        <span className="pill">Save {activeSaveName}</span>
                        <span className="pill">Identity Default {selectedIdentityDraft?.sourceNote ?? "—"}</span>
                        <span className="pill">
                          Identity Override {gameState.seasonState.teamIdentityOverrides?.[selectedTeam.teamId] ? "ja" : "nein"}
                        </span>
                        <span className="pill">Control Save seasonState.teamControlSettings</span>
                        <span className="pill">Strategy Save seasonState.teamStrategyProfiles</span>
                      </div>
                    </div>

                    {selectedIdentityDraft ? (
                      <div className="panel inset-panel" style={{ marginTop: 16 }}>
                        <div className="panel-header">
                          <div className="stack">
                            <h3>Identity Rohwerte</h3>
                            <p className="muted">Exakte Team-Identitaet aus den lokalen Quellen. Diese Rohwerte werden nicht auf generische 50er- oder 60er-Biaswerte geglaettet.</p>
                          </div>
                          <div className="room-meta foundation-admin-meta">
                            <span className="pill">Default: {selectedIdentityDraft.sourceNote ?? "—"}</span>
                            <span className="pill">Raw Identity</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                            marginTop: 12,
                          }}
                        >
                          <label className="stack">
                            <span>Player Type</span>
                            <select
                              className="input"
                              disabled={readMeta.readOnly}
                              value={selectedIdentityDraft.playerType ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateTeamIdentityDraft(selectedTeam.teamId, (current) => ({
                                  ...current,
                                  playerType: value || null,
                                }));
                              }}
                            >
                              <option value="">—</option>
                              <option value="F">F</option>
                              <option value="C">C</option>
                            </select>
                          </label>
                          {teamIdentityFieldLabels.map((field) => (
                            <label key={field.key} className="stack">
                              <span>{field.label}</span>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                max={field.key === "playerMin" || field.key === "playerOpt" ? 32 : 20}
                                step={field.key === "playerMin" || field.key === "playerOpt" ? 1 : 0.5}
                                disabled={readMeta.readOnly}
                                value={selectedIdentityDraft[field.key]}
                                onChange={(event) => {
                                  const nextValue = clampIdentityValue(Number(event.target.value), field.key);
                                  updateTeamIdentityDraft(selectedTeam.teamId, (current) => ({
                                    ...current,
                                    [field.key]: nextValue,
                                  }));
                                }}
                              />
                            </label>
                          ))}
                        </div>

                        {selectedIdentityAxisBias ? (
                          <div className="stats-grid" style={{ marginTop: 16 }}>
                            <article className="metric-card">
                              <span>POW Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.pow)}</strong>
                            </article>
                            <article className="metric-card">
                              <span>SPE Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.spe)}</strong>
                            </article>
                            <article className="metric-card">
                              <span>MEN Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.men)}</strong>
                            </article>
                            <article className="metric-card">
                              <span>SOC Bias</span>
                              <strong>{formatIdentityWeight(selectedIdentityAxisBias.soc)}</strong>
                            </article>
                          </div>
                        ) : null}
                        <p className="muted" style={{ marginTop: 10 }}>
                          Derived Axis Bias % = round(Achsenwert / Summe aus Power, Speed, Mental, Social * 100).
                          {selectedIdentityAxisBias?.warning === "identity_axis_sum_zero"
                            ? " Warnung: identity_axis_sum_zero."
                            : ""}
                        </p>

                        <div className="foundation-save-actions" style={{ marginTop: 16 }}>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={readMeta.readOnly}
                            title={readMeta.readOnly ? getReadOnlyActionReason("die Team-Identity") : "Speichert die lokalen Rohwerte und Biases dieses Teams."}
                            onClick={saveTeamSettings}
                          >
                            Identity lokal speichern
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={readMeta.readOnly}
                            title={readMeta.readOnly ? getReadOnlyActionReason("die Team-Identity") : "Setzt die Team-Identity fuer dieses Team auf den Default zurueck."}
                            onClick={() => {
                              const resetIdentities = buildResolvedTeamIdentities(gameState.teams, gameState.teamIdentities, {});
                              const resetIdentity = resetIdentities.find((identity) => identity.teamId === selectedTeam.teamId);
                              if (!resetIdentity) {
                                return;
                              }
                              setTeamIdentityDraft((current) => ({
                                ...current,
                                [selectedTeam.teamId]: resetIdentity,
                              }));
                              setTeamIdentityMessage(`Default-Identity fuer ${selectedTeam.name} wiederhergestellt.`);
                            }}
                          >
                            Identity auf Default
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "grid",
                        gap: 16,
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      <label className="stack">
                        <span>Fantasy Theme</span>
                        <input
                          className="input"
                          type="text"
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.fantasyTheme ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                fantasyTheme: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Lore Theme</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.loreTheme ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                loreTheme: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Summary</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.strategySummary}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                strategySummary: value,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Buy Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.buyStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                buyStyle: value,
                                transferStyleNote: current.transferStyleNote === current.buyStyle ? value : current.transferStyleNote,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Sell Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.sellStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                sellStyle: value,
                                sellStyleNote: current.sellStyleNote === current.sellStyle ? value : current.sellStyleNote,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Contract Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.contractStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                contractStyle: value,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Roster Style</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.rosterStyle}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                rosterStyle: value,
                                lineupStyleNote: current.lineupStyleNote === current.rosterStyle ? value : current.lineupStyleNote,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Notes</span>
                        <textarea
                          className="input"
                          rows={3}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.notes ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                notes: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      {teamStrategyIdentityListFieldLabels.map((field) => (
                        <label key={field.key} className="stack">
                          <span>{field.label}</span>
                          <textarea
                            className="input"
                            rows={2}
                            disabled={readMeta.readOnly}
                            value={formatCsvList(selectedTeamStrategyDraft[field.key])}
                            placeholder="comma, separated, values"
                            onChange={(event) => {
                              const next = parseCsvList(event.target.value);
                              updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                                withSynchronizedStrategyAliases(current, {
                                  [field.key]: next,
                                } as Partial<TeamStrategyProfile>),
                              );
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      <label className="stack">
                        <span>Roster Min Target</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={32}
                          step={1}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.rosterMinTarget ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value === "" ? null : Math.max(0, Math.min(32, Math.round(Number(event.target.value))));
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                rosterMinTarget: nextValue,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Roster Opt Target</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={32}
                          step={1}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.rosterOptTarget ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value === "" ? null : Math.max(0, Math.min(32, Math.round(Number(event.target.value))));
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                rosterOptTarget: nextValue,
                              }),
                            );
                          }}
                        />
                      </label>
                      {teamStrategyLevelFieldLabels.map((field) => (
                        <label key={field.key} className="stack">
                          <span>{field.label}</span>
                          <select
                            className="input"
                            disabled={readMeta.readOnly}
                            value={selectedTeamStrategyDraft[field.key] ?? "medium"}
                            onChange={(event) => {
                              updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
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
                        </label>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      {teamStrategySportsBiasFieldLabels.map((field) => (
                        <article key={field.key} className="metric-card">
                          <span>{field.label}</span>
                          <strong>{formatIdentityWeight(selectedIdentityAxisBias?.[teamStrategySportsBiasAxisMap[field.key]] ?? null)}</strong>
                          <small className="muted">read-only aus Identity Rohwerten</small>
                        </article>
                      ))}
                      <label className="stack">
                        <span>Lineup Style Note</span>
                        <textarea
                          className="input"
                          rows={2}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.lineupStyleNote ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                lineupStyleNote: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Transfer Style Note</span>
                        <textarea
                          className="input"
                          rows={2}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.transferStyleNote ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                transferStyleNote: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                      <label className="stack">
                        <span>Sell Style Note</span>
                        <textarea
                          className="input"
                          rows={2}
                          disabled={readMeta.readOnly}
                          value={selectedTeamStrategyDraft.sellStyleNote ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                              withSynchronizedStrategyAliases(current, {
                                sellStyleNote: value || null,
                              }),
                            );
                          }}
                        />
                      </label>
                    </div>

                    <details className="panel inset-panel" style={{ marginTop: 16 }}>
                      <summary>Legacy-Kompatibilitaet / Debug</summary>
                      <p className="muted" style={{ marginTop: 12 }}>
                        Diese Werte dienen nur der Rueckwaertskompatibilitaet und sind nicht die primaere Team Identity oder die fuehrende AI-Bias-Quelle.
                      </p>
                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          marginTop: 12,
                        }}
                      >
                        {teamStrategyListFieldLabels.map((field) => (
                          <label key={field.key} className="stack">
                            <span>{field.label}</span>
                            <textarea
                              className="input"
                              rows={2}
                              disabled={readMeta.readOnly}
                              value={formatCsvList(selectedTeamStrategyDraft[field.key])}
                              placeholder="comma, separated, values"
                              onChange={(event) => {
                                const next = parseCsvList(event.target.value);
                                updateTeamStrategyDraft(selectedTeam.teamId, (current) =>
                                  withSynchronizedStrategyAliases(current, {
                                    [field.key]: next,
                                  } as Partial<TeamStrategyProfile>),
                                );
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </details>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        marginTop: 16,
                      }}
                    >
                      {teamStrategyBiasFieldLabels.map((field) => (
                        <label key={field.key} className="stack">
                          <span>{field.label}</span>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            disabled={readMeta.readOnly}
                            value={selectedTeamStrategyDraft.bias[field.key]}
                            onChange={(event) => {
                              const nextValue = clampBiasValue(Number(event.target.value));
                              updateTeamStrategyDraft(selectedTeam.teamId, (current) => ({
                                ...current,
                                bias: {
                                  ...current.bias,
                                  [field.key]: nextValue,
                                },
                              }));
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <div className="foundation-save-actions" style={{ marginTop: 16 }}>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={readMeta.readOnly}
                        title={readMeta.readOnly ? getReadOnlyActionReason("das Strategy-Profil") : "Speichert das lokale Strategy-Profil dieses Teams im aktiven Save."}
                        onClick={saveTeamSettings}
                      >
                        Strategy Profile lokal speichern
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={readMeta.readOnly}
                        title={readMeta.readOnly ? getReadOnlyActionReason("das Strategy-Profil") : "Verwirft ungespeicherte Strategy-Aenderungen und springt auf den aktuellen Save-Stand zurueck."}
                        onClick={() => {
                          setTeamStrategyDraft(
                            buildTeamStrategyProfileMap(
                              gameState.teams,
                              gameState.teamIdentities,
                              gameState.seasonState.teamStrategyProfiles,
                            ),
                          );
                          setTeamStrategyMessage("Strategy-Profile-Draft wurde auf den lokalen Save-Stand zurueckgesetzt.");
                        }}
                      >
                        Strategy Draft zuruecksetzen
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={readMeta.readOnly}
                        title={readMeta.readOnly ? getReadOnlyActionReason("das Strategy-Profil") : "Setzt das Strategy-Profil dieses Teams auf die Default-Werte zurueck."}
                        onClick={() => {
                          const defaults = buildTeamStrategyProfileMap(gameState.teams, gameState.teamIdentities);
                          const resetProfile = defaults[selectedTeam.teamId];
                          if (!resetProfile) {
                            return;
                          }
                          setTeamStrategyDraft((current) => ({
                            ...current,
                            [selectedTeam.teamId]: resetProfile,
                          }));
                          setTeamStrategyMessage(`Default-Profil fuer ${selectedTeam.name} wiederhergestellt.`);
                        }}
                      >
                        Reset auf Default
                      </button>
                    </div>
                    {readMeta.readOnly ? <p className="muted">Prisma/Supabase bleibt read-only. Profile koennen dort nicht gespeichert werden.</p> : null}
                    {selectedTeamStrategyProfile ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        AI read-only Kontext: {selectedTeamStrategyProfile.strategySummary}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>

            </div>
    </section>
  );
}
