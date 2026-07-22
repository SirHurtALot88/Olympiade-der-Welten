"use client";

import { useEffect, useState, type ReactNode } from "react";

import { parseFoundationTabFromUrl } from "@/lib/foundation/foundation-url-state";
import {
  type AiActionBreakdownEntry,
  deriveBlockedBreakdownFromReasons,
} from "@/lib/ai/ai-action-breakdown";
import type { AiPreseasonAutomationRunRecord } from "@/lib/data/olyDataTypes";

import {
  NlCard,
  NlCountUpValue,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
} from "@/components/foundation/new-look";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { FoundationTeamSettingsPanelProps } from "@/app/foundation/team-settings/FoundationTeamSettingsPanel";
import { FOUNDATION_SAVE_MODE_OPTIONS } from "@/app/foundation/foundation-page-client-exports";
import type { TeamStrategyProfile } from "@/app/foundation/foundation-page-client-exports";
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

const AI_PRESEASON_MODE_LABELS: Record<AiPreseasonAutomationRunRecord["mode"], string> = {
  setup_draft: "Setup-Draft",
  season_market: "Preseason-Markt",
  none: "keine AI-Teams",
};

const AI_PRESEASON_STATUS_LABELS: Record<AiPreseasonAutomationRunRecord["status"], string> = {
  running: "läuft",
  completed: "abgeschlossen",
  failed: "fehlgeschlagen",
  skipped: "übersprungen",
};

/** Rohe Blocker-/Warn-Strings (`teamCode:actionType:reason`) für die Anzeige aufhübschen. */
function formatAiPreseasonReason(raw: string): string {
  const parts = raw.split(":");
  if (parts.length >= 3) {
    const [teamCode, actionType, ...rest] = parts;
    return `${teamCode} · ${actionType} · ${rest.join(":")}`;
  }
  return raw;
}

/**
 * Read-only Diagnose einer einzelnen AI-Preseason-Automatik: Modus, Teams
 * fertig/gesamt und eine Kategorie-Tabelle (angewandt/blockiert) plus
 * ausklappbare Blocker-/Warnungs-Listen. Nutzt bevorzugt das im Run-Record
 * gespeicherte `actionBreakdown`; für alte Records ohne dieses Feld wird ein
 * Fallback aus den rohen `blockingReasons` abgeleitet.
 */
function AiPreseasonRunDiagnostic({
  run,
  seasonKey,
  defaultOpen,
}: {
  run: AiPreseasonAutomationRunRecord;
  seasonKey: string;
  defaultOpen: boolean;
}) {
  const breakdown: AiActionBreakdownEntry[] =
    run.actionBreakdown && run.actionBreakdown.length > 0
      ? run.actionBreakdown
      : deriveBlockedBreakdownFromReasons(run.blockingReasons);
  const hasExplicitBreakdown = Boolean(run.actionBreakdown && run.actionBreakdown.length > 0);
  const totalApplied = breakdown.reduce((sum, entry) => sum + entry.applied, 0);
  const totalBlocked = run.blockingReasons.length;
  const teamsComplete = run.aiTeamsTotal > 0 && run.aiTeamsCompleted >= run.aiTeamsTotal;
  const allClean = totalBlocked === 0 && run.status !== "failed";
  const startedLabel = (() => {
    const parsed = Date.parse(run.startedAt);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("de-DE") : run.startedAt;
  })();

  return (
    <details
      className="nl-teamsettings-details nl-ai-audit-run"
      open={defaultOpen}
      data-testid={`ai-preseason-run-${seasonKey}`}
    >
      <summary>
        <span className="nl-ai-audit-run-title">
          {seasonKey} · {AI_PRESEASON_MODE_LABELS[run.mode]}
        </span>
        <span className={`nl-teamsettings-status${allClean ? " is-good" : totalBlocked > 0 ? " is-risk" : " is-warn"}`}>
          {allClean ? "alles sauber ✓" : `${totalBlocked} blockiert`}
        </span>
      </summary>

      <div className="nl-teamsettings-metric-grid">
        <NlMetric label="Modus" value={AI_PRESEASON_MODE_LABELS[run.mode]} sub={AI_PRESEASON_STATUS_LABELS[run.status]} />
        <NlMetric
          label="Teams"
          value={`${run.aiTeamsCompleted}/${run.aiTeamsTotal}`}
          sub={teamsComplete ? "vollständig" : "unvollständig"}
        />
        <NlMetric label="angewandt" value={hasExplicitBreakdown ? totalApplied : run.managerActionsApplied} sub="Manager-Aktionen" />
        <NlMetric label="blockiert" value={totalBlocked} sub={totalBlocked === 0 ? "keine" : "siehe unten"} />
        <NlMetric label="Käufe / Verkäufe" value={`${run.transferBuysApplied} / ${run.transferSellsApplied}`} sub="Transfermarkt" />
        <NlMetric label="Start" value={startedLabel} sub="letzter Lauf" />
      </div>

      <div className="nl-teamsettings-table-shell">
        <table className="nl-teamsettings-table nl-tnum">
          <thead>
            <tr>
              <th>Kategorie</th>
              <th>angewandt</th>
              <th>blockiert</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.length === 0 ? (
              <tr>
                <td colSpan={3} className="nl-teamsettings-note">
                  Keine kategorisierten Manager-Aktionen erfasst.
                </td>
              </tr>
            ) : (
              breakdown.map((entry) => (
                <tr key={`${seasonKey}-cat-${entry.category}`}>
                  <td>{entry.category}</td>
                  <td>
                    <span className={entry.applied > 0 ? "nl-teamsettings-status is-good" : ""}>{entry.applied}</span>
                  </td>
                  <td>
                    <span className={entry.blocked > 0 ? "nl-teamsettings-status is-risk" : "nl-teamsettings-status is-good"}>
                      {entry.blocked}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!hasExplicitBreakdown ? (
        <p className="nl-teamsettings-note">
          Älterer Lauf ohne gespeicherte Kategorie-Aufstellung — die „angewandt&quot;-Zahl ist die Gesamtzahl der
          Manager-Aktionen, die Blocker-Kategorien sind aus den Blocker-Gründen abgeleitet.
        </p>
      ) : null}

      {run.blockingReasons.length > 0 ? (
        <details className="nl-teamsettings-details is-nested">
          <summary>Blockierte Aktionen ({run.blockingReasons.length})</summary>
          <ul className="nl-ai-audit-list">
            {run.blockingReasons.map((reason, index) => (
              <li key={`${seasonKey}-block-${index}`} className="nl-teamsettings-note">
                {formatAiPreseasonReason(reason)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {run.warnings.length > 0 ? (
        <details className="nl-teamsettings-details is-nested">
          <summary>Warnungen ({run.warnings.length})</summary>
          <ul className="nl-ai-audit-list">
            {run.warnings.map((warning, index) => (
              <li key={`${seasonKey}-warn-${index}`} className="nl-teamsettings-note">
                {formatAiPreseasonReason(warning)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </details>
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
  const [multiSelectSaves, setMultiSelectSaves] = useState(false);
  const [selectedSaveIdsForDeletion, setSelectedSaveIdsForDeletion] = useState<Set<string>>(new Set());
  const [saveDeleteMessage, setSaveDeleteMessage] = useState<string | null>(null);

  // One-click "Neues Spiel erstellen": `runNewGameSetup(false)` verlangt einen
  // bereits validierten Preview. Um den bequemen Ein-Klick-Flow zu erreichen,
  // ohne die Service-Semantik zu ändern, merken wir uns die Erstell-Absicht und
  // ketten Preview → Create über einen Effect: Nach einem Preview-Lauf (busy
  // fällt wieder auf false) wird bei fehlerfreiem, blockerfreiem Preview
  // automatisch der echte Create-Lauf angestoßen. Blocker/Fehler stoppen die
  // Kette und werden wie gehabt inline gezeigt.
  const [pendingNewGameCreate, setPendingNewGameCreate] = useState(false);

  async function handleCreateNewGame() {
    if (newGameBusy || readMeta.readOnly || pendingNewGameCreate) {
      return;
    }
    if (newGamePreview && newGamePreview.blockers.length === 0) {
      await runNewGameSetup(false);
      return;
    }
    setPendingNewGameCreate(true);
    await runNewGameSetup(true);
  }

  useEffect(() => {
    if (!pendingNewGameCreate || newGameBusy) {
      return;
    }
    // Preview-Lauf ist fertig — entscheide, ob wir weiter zum Create dürfen.
    if (newGamePreview && newGamePreview.blockers.length === 0) {
      setPendingNewGameCreate(false);
      void runNewGameSetup(false);
      return;
    }
    // Blocker oder Fehler: Kette beenden, Inline-Anzeige übernimmt.
    setPendingNewGameCreate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNewGameCreate, newGameBusy, newGamePreview, newGameError]);

  /** Umschalten der Mehrfachauswahl für Save-Löschung; verwirft eine laufende Auswahl. */
  function toggleMultiSelectSaves() {
    setMultiSelectSaves((current) => !current);
    setSelectedSaveIdsForDeletion(new Set());
    setSaveDeleteMessage(null);
  }

  function toggleSaveSelectedForDeletion(saveId: string) {
    setSelectedSaveIdsForDeletion((current) => {
      const next = new Set(current);
      if (next.has(saveId)) {
        next.delete(saveId);
      } else {
        next.add(saveId);
      }
      return next;
    });
  }

  /**
   * Löscht einen oder mehrere Spielstände nach Bestätigung. Der aktive Save wird von der
   * Auswahl-UI bereits ausgeschlossen (Checkbox/Button deaktiviert) — der Server blockt ihn
   * zusätzlich als letzte Sicherung.
   */
  async function deleteSaves(saveIds: string[]) {
    if (saveIds.length === 0 || isSaveBusy || readMeta.readOnly) {
      return;
    }
    const confirmMessage =
      saveIds.length === 1
        ? "Spielstand wirklich löschen? Das kann nicht rückgängig gemacht werden."
        : `${saveIds.length} Spielstände wirklich löschen? Das kann nicht rückgängig gemacht werden.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setSaveDeleteMessage(null);
    await runSaveAction({ action: "delete", saveIds });
    setSelectedSaveIdsForDeletion(new Set());
    setSaveDeleteMessage(saveIds.length === 1 ? "Spielstand gelöscht." : `${saveIds.length} Spielstände gelöscht.`);
  }

  // Single-player-first: das New-Game-Setup ist eine freie Team-Auswahl (1-4 Teams
  // für die Chris-Seat), nicht mehr an einen vorab gewählten Spielmodus-Preset
  // gebunden. Unter der Haube bleibt das Preset-Feld bestehen (für /api/new-game),
  // wird hier aber einmalig auf "custom" normalisiert, damit toggleNewGameTeam die
  // volle Ownership-Grenze (bis zu 4 Teams) nutzt statt der Solo-1-Vorgabe.
  useEffect(() => {
    if (newGamePresetId !== "custom") {
      applyNewGamePreset("custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <section className="nl-teamsettings-subpanel nl-newgame" data-testid="new-game-setup-wizard">
        <header className="nl-teamsettings-subhead">
          <h4>Neues Spiel starten</h4>
          <span className="nl-teamsettings-hint">Single-Player · Baseline · Startbudget</span>
        </header>

        {/* Summary-Hero: großes, scanbares Portfolio-Signal + KPI-Chips. */}
        <div className="nl-newgame-hero">
          <div className="nl-newgame-hero-lead">
            <span className="nl-newgame-hero-eyebrow">Dein Klub-Portfolio</span>
            <p className="nl-newgame-hero-headline">
              Du steuerst{" "}
              <NlCountUpValue
                className="nl-newgame-hero-count nl-tnum"
                value={newGameChrisTeamIds.length}
                format={(value) => String(Math.round(value))}
              />{" "}
              <span className="nl-newgame-hero-of">von {gameState.teams.length}</span> Teams
            </p>
            <span className="nl-newgame-hero-hint">
              {newGameChrisTeamIds.length === 0
                ? "Wähle 1 bis 4 Klubs, die du selbst managst — alle übrigen laufen unter KI-Kontrolle."
                : `${newGameChrisTeamIds.length === 1 ? "1 Klub" : `${newGameChrisTeamIds.length} Klubs`} unter deiner Kontrolle · bis zu 4 möglich`}
            </span>
          </div>
          <StatChipRow className="nl-newgame-hero-chips" aria-label="Setup-Übersicht">
            <StatChip
              label="Deine Teams"
              value={`${newGameChrisTeamIds.length}/4`}
              tone={newGameChrisTeamIds.length > 0 ? "good" : "neutral"}
              sub="du steuerst"
            />
            <StatChip
              label="KI-Teams"
              value={Math.max(0, gameState.teams.length - newGameChrisTeamIds.length - newGameFrankyTeamIds.length)}
              sub="automatisch"
            />
            {newGameFrankyTeamIds.length > 0 ? (
              <StatChip label="2. Spieler" value={`${newGameFrankyTeamIds.length}/4`} tone="warn" sub="Franky" />
            ) : null}
          </StatChipRow>
        </div>

        {/* Kompakte Optionen: Save-Name + Sandbox (Bindings/Titel unverändert). */}
        <div className="nl-newgame-options">
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
          <label className="nl-teamsettings-check nl-newgame-sandbox">
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

        {/* Club-Picker: die ganze Karte ist der Auswahl-Toggle. */}
        <div className="nl-newgame-pickerhead">
          <strong>Wähle deine Klubs</strong>
          <span className="nl-teamsettings-hint">Karte antippen = selbst steuern · nicht gewählte Klubs übernimmt die KI</span>
        </div>
        <div className="nl-newgame-clubgrid" data-testid="new-game-ownership-picker">
          {[...gameState.teams]
            .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
            .map((team) => {
              const isChris = newGameChrisTeamIds.includes(team.teamId);
              const isFranky = newGameFrankyTeamIds.includes(team.teamId);
              const logo = getTeamLogoModel(team, { variant: "thumb" });
              const selectDisabled = newGameBusy || readMeta.readOnly || isFranky;
              return (
                <article
                  key={`new-game-team-${team.teamId}`}
                  className={`nl-newgame-club${isChris ? " is-picked" : ""}${isFranky ? " is-franky" : ""}`}
                >
                  <button
                    type="button"
                    className="nl-newgame-club-select"
                    aria-pressed={isChris}
                    disabled={selectDisabled}
                    title={
                      isFranky
                        ? "Dieses Team ist bereits dem 2. Spieler zugeordnet."
                        : readMeta.readOnly
                          ? getReadOnlyActionReason("die Team-Zuordnung")
                          : newGameBusy
                            ? getBusyActionReason("Das New-Game-Setup")
                            : isChris
                              ? "Team wieder freigeben — die KI übernimmt."
                              : "Dieses Team steuerst du selbst (bis zu 4 Teams)."
                    }
                    onClick={() => toggleNewGameTeam("chris", team.teamId)}
                  >
                    <span className="nl-newgame-club-crest">
                      <BudgetedMediaImage
                        src={logo.src}
                        alt={`${team.name} Logo`}
                        className="nl-newgame-club-crest-img"
                        width={48}
                        height={48}
                        loading="lazy"
                        fallback={<span className="nl-newgame-club-crest-fallback">{logo.initials}</span>}
                      />
                    </span>
                    <span className="nl-newgame-club-body">
                      <span className="nl-newgame-club-code">{team.shortCode}</span>
                      <span className="nl-newgame-club-name">{team.name}</span>
                      <span className="nl-newgame-club-budget nl-tnum">Budget {formatNlMoney(team.budget)}</span>
                    </span>
                    {isChris ? (
                      <span className="nl-newgame-club-badge">DEIN TEAM ✓</span>
                    ) : isFranky ? (
                      <span className="nl-newgame-club-badge is-franky">2. Spieler</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="nl-newgame-club-profile"
                    aria-label={`${team.name} Teamprofil öffnen`}
                    title="Teamprofil öffnen"
                    onClick={() => openTeamProfileById(team.teamId)}
                  >
                    <span aria-hidden="true">ⓘ</span>
                  </button>
                </article>
              );
            })}
        </div>

        <details className="nl-teamsettings-details">
          <summary>2. Spieler (Multiplayer — später)</summary>
          <p className="nl-teamsettings-note">
            Optional: Weise zusätzliche Teams einem zweiten menschlichen Spieler (Franky) zu. Für den
            Single-Player-Start kannst du diesen Bereich ignorieren — ohne Auswahl bleiben alle übrigen Teams bei
            der KI.
          </p>
          <div className="nl-teamsettings-metric-grid">
            <NlMetric
              label="Franky"
              value={`${newGameFrankyTeamIds.length}/4`}
              sub={newGameFrankyTeamIds.join(" · ") || "kein Team"}
            />
          </div>
          <div className="nl-teamsettings-team-grid">
            {[...gameState.teams]
              .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.shortCode.localeCompare(b.shortCode))
              .map((team) => {
                const isChris = newGameChrisTeamIds.includes(team.teamId);
                const isFranky = newGameFrankyTeamIds.includes(team.teamId);
                return (
                  <article
                    key={`new-game-franky-${team.teamId}`}
                    className={`nl-teamsettings-team-card${isChris ? " is-owned-chris" : ""}${isFranky ? " is-owned-franky" : ""}`}
                  >
                    <div className="nl-teamsettings-team-card-main">
                      <strong>{team.shortCode}</strong>
                      <span>{team.name}</span>
                    </div>
                    <div className="nl-teamsettings-team-card-actions">
                      <button
                        type="button"
                        className={`nl-teamsettings-btn is-small${isFranky ? " is-primary" : ""}`}
                        disabled={newGameBusy || readMeta.readOnly || isChris}
                        title={
                          isChris
                            ? "Dieses Team steuerst du bereits selbst."
                            : readMeta.readOnly
                              ? getReadOnlyActionReason("die Team-Zuordnung")
                              : newGameBusy
                                ? getBusyActionReason("Das New-Game-Setup")
                                : "Ordnet dieses Team dem 2. Spieler (Franky) zu."
                        }
                        onClick={() => toggleNewGameTeam("franky", team.teamId)}
                      >
                        {isFranky ? "Franky ✓" : "Franky"}
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
        </details>

        <div className="nl-teamsettings-actions nl-newgame-actions">
          <button
            type="button"
            className="nl-teamsettings-btn"
            disabled={newGameBusy || readMeta.readOnly || pendingNewGameCreate}
            title={
              readMeta.readOnly
                ? getReadOnlyActionReason("das New-Game-Setup")
                : newGameBusy
                  ? getBusyActionReason("Das New-Game-Setup")
                  : "Trockenlauf: prüft Baseline, Ownership und Season-Setup, ohne den Spielstand zu bauen."
            }
            onClick={() => void runNewGameSetup(true)}
          >
            {newGameBusy && !pendingNewGameCreate ? "Prüft..." : "Setup prüfen"}
          </button>
          <button
            type="button"
            className="nl-teamsettings-btn is-primary nl-newgame-cta"
            disabled={newGameBusy || readMeta.readOnly || pendingNewGameCreate}
            title={
              readMeta.readOnly
                ? getReadOnlyActionReason("ein neues Spiel")
                : newGameBusy || pendingNewGameCreate
                  ? getBusyActionReason("Das New-Game-Setup")
                  : newGamePreview && newGamePreview.blockers.length > 0
                    ? `Noch offen: ${newGamePreview.blockers.map((reason: string) => formatCockpitReason(reason)).join(" · ")}`
                    : "Prüft das Setup und erstellt anschließend direkt den neuen lokalen Spielstand."
            }
            onClick={() => void handleCreateNewGame()}
          >
            {pendingNewGameCreate ? "Prüft & erstellt..." : newGameBusy ? "Arbeitet..." : "Neues Spiel erstellen"}
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
                        <td>{formatNlMoney(team.budget)}</td>
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

          <div className="nl-teamsettings-actions is-compact">
            <button
              type="button"
              className="nl-teamsettings-btn is-small"
              disabled={isSaveBusy || readMeta.readOnly || saveSummaries.length === 0}
              title={
                readMeta.readOnly
                  ? getReadOnlyActionReason("die Mehrfachauswahl")
                  : "Wählt mehrere Spielstände aus, um sie gemeinsam zu löschen."
              }
              onClick={toggleMultiSelectSaves}
            >
              {multiSelectSaves ? "Mehrfachauswahl beenden" : "Mehrere auswählen"}
            </button>
            {multiSelectSaves ? (
              <button
                type="button"
                className="nl-teamsettings-btn is-small is-danger"
                disabled={selectedSaveIdsForDeletion.size === 0 || isSaveBusy || readMeta.readOnly}
                title={
                  readMeta.readOnly
                    ? getReadOnlyActionReason("Spielstände")
                    : selectedSaveIdsForDeletion.size === 0
                      ? "Wähle zuerst mindestens einen Spielstand aus."
                      : "Löscht alle ausgewählten Spielstände unwiderruflich."
                }
                onClick={() => void deleteSaves([...selectedSaveIdsForDeletion])}
              >
                Ausgewählte löschen ({selectedSaveIdsForDeletion.size})
              </button>
            ) : null}
          </div>
          {saveDeleteMessage ? <p className="nl-teamsettings-msg is-good">{saveDeleteMessage}</p> : null}

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
                    {multiSelectSaves ? (
                      <label
                        className="nl-teamsettings-check is-small"
                        title={
                          save.saveId === activeSaveId
                            ? "Der aktive Spielstand kann nicht gelöscht werden — lade zuerst einen anderen."
                            : "Für Mehrfachlöschung auswählen."
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedSaveIdsForDeletion.has(save.saveId)}
                          disabled={save.saveId === activeSaveId || isSaveBusy || readMeta.readOnly}
                          onChange={() => toggleSaveSelectedForDeletion(save.saveId)}
                        />
                        <span className="sr-only">{save.name} auswählen</span>
                      </label>
                    ) : null}
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
                    {!multiSelectSaves ? (
                      <button
                        type="button"
                        className="nl-teamsettings-btn is-small is-danger"
                        disabled={isSaveBusy || readMeta.readOnly || save.saveId === activeSaveId}
                        title={
                          save.saveId === activeSaveId
                            ? "Der aktive Spielstand kann nicht gelöscht werden — lade zuerst einen anderen."
                            : readMeta.readOnly
                              ? getReadOnlyActionReason("diesen Save")
                              : isSaveBusy
                                ? getBusyActionReason("Die Save-Aktion")
                                : "Löscht diesen Spielstand unwiderruflich."
                        }
                        onClick={() => void deleteSaves([save.saveId])}
                      >
                        Löschen
                      </button>
                    ) : null}
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
    // T-014: Prev/Next muss über die gefilterte Liste laufen, nicht über
    // gameState.teams — sonst springt der Wechsel zu Teams, die das Grid
    // (filteredTeamSettingsTeams) wegen des Suchfilters gar nicht anzeigt.
    const filteredSelectedTeamSettingsIndex = filteredTeamSettingsTeams.findIndex(
      (team: Team) => team.teamId === selectedTeamId,
    );
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
              disabled={filteredSelectedTeamSettingsIndex <= 0}
              title={
                filteredSelectedTeamSettingsIndex <= 0
                  ? "Du bist bereits beim ersten Team der gefilterten Liste."
                  : "Springt zum vorherigen Team in der gefilterten Liste."
              }
              onClick={() => {
                const previousTeam = filteredTeamSettingsTeams[filteredSelectedTeamSettingsIndex - 1];
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
              disabled={
                filteredSelectedTeamSettingsIndex < 0 ||
                filteredSelectedTeamSettingsIndex >= filteredTeamSettingsTeams.length - 1
              }
              title={
                filteredSelectedTeamSettingsIndex < 0 ||
                filteredSelectedTeamSettingsIndex >= filteredTeamSettingsTeams.length - 1
                  ? "Du bist bereits beim letzten Team der gefilterten Liste."
                  : "Springt zum nächsten Team in der gefilterten Liste."
              }
              onClick={() => {
                const nextTeam = filteredTeamSettingsTeams[filteredSelectedTeamSettingsIndex + 1];
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
              value={selectedStandingRow?.cash != null ? formatNlMoney(selectedStandingRow.cash) : "—"}
              sub="liquide Mittel"
            />
            <NlMetric
              label="Gehalt"
              value={selectedStandingRow?.salaryTotal != null ? formatNlMoney(selectedStandingRow.salaryTotal) : "—"}
              sub="aktueller Kader"
            />
            <NlMetric
              label="MW"
              value={selectedStandingRow?.marketValueTotal != null ? formatNlMoney(selectedStandingRow.marketValueTotal) : "—"}
              sub="gesamter Kader"
            />
            <NlMetric
              label="Sponsor"
              value={selectedStandingRow?.sponsorTotal != null ? formatNlMoney(selectedStandingRow.sponsorTotal) : "—"}
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

  function renderAiPreseasonAuditCard() {
    const runsMap: Record<string, AiPreseasonAutomationRunRecord> =
      gameState.seasonState.aiPreseasonAutomationRuns ?? {};
    const runs = Object.entries(runsMap)
      .map(([seasonKey, run]) => ({ seasonKey, run }))
      .sort((a, b) => {
        const aTime = Date.parse(a.run.startedAt);
        const bTime = Date.parse(b.run.startedAt);
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      });
    return (
      <NlCard
        className="nl-teamsettings-card"
        eyebrow="Diagnose"
        title="AI-Preseason: was die KI-Teams gemacht haben"
        data-testid="nl-teamsettings-ai-preseason-audit"
      >
        <p className="nl-teamsettings-note">
          Read-only Kontrolle der Preseason-Automatik: was die AI-Teams tatsächlich angewandt haben
          (Training, Gebäude, Budget, Verträge, Verkaufsplan) und was mit welchem Grund blockiert wurde.
          „blockiert = 0&quot; bedeutet: alles ist sauber durchgelaufen.
        </p>
        {runs.length === 0 ? (
          <p className="nl-teamsettings-msg is-warn">
            <strong>Noch kein Preseason-Lauf erfasst.</strong> Sobald die AI-Preseason einmal gelaufen ist,
            erscheint hier je Saison eine Aufstellung.
          </p>
        ) : (
          <div className="nl-ai-audit-runs">
            {runs.map((entry, index) => (
              <AiPreseasonRunDiagnostic
                key={`ai-preseason-audit-${entry.seasonKey}`}
                run={entry.run}
                seasonKey={entry.seasonKey}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        )}
      </NlCard>
    );
  }

  function renderControlSection() {
    return (
      <>
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
      {renderAiPreseasonAuditCard()}
      </>
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
