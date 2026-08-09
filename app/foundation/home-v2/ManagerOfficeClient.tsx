"use client";

import { useEffect, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { VeloImpactStrip, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import { isSeasonOnePreseasonNeutralBoard } from "@/lib/board/team-season-objectives-service";
import { buildCaptainEffectExplanations } from "@/lib/morale/team-captain-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { GmStoryView } from "@/lib/foundation/gm-story";
import type { GameInboxItem, TeamControlMode } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { SeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";

/**
 * Office (S1, Audit O1–O4): eingedampft auf das, was NUR hier lebt.
 *
 * Vorher beantwortete die Seite „was soll ich tun?" fünffach parallel
 * (Manager-Fokus, Sofort-/Season-/Preseason-Spalten, KPI-Zeile, Board-Kasten)
 * und wiederholte Cash/Gehalt/Einsatzliste mehrfach aus der Übersicht. Jetzt:
 *
 * 1. Hero (Team + GM + Achsen Ø Top-6) — Identität der Zentrale.
 * 2. Board-Block (GM-Story + Druck/Rating/nächstes Ziel) — der Vorstands-Kontext.
 * 3. Kapitänwahl als VERGLEICHSTABELLE (O3): Leadership visuell als Balken,
 *    alle Effekte in einheitlichem Format spaltenweise vergleichbar.
 * 4. Front-Office-Notizen: nur Inhalte mit Daten (Wishlist, VK-Vormerkung,
 *    Ausläufer) als kompakte Zeilen — Leerzustände sind EINE dezente Zeile,
 *    keine vollwertigen Karten (O4).
 *
 * Aufgaben/Warnungen/Finanz-KPIs leben auf der Übersicht bzw. in der Inbox —
 * eine Quelle pro Größe, keine Kopien hier.
 */

function formatTransfermarktCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLocalePoints(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

type HqWishlistEntry = {
  id: string;
  playerName: string;
  className: string;
  marketValue: number | null;
};

type HqSellMarker = {
  id: string;
  playerName: string;
  buyoutCost: number | null;
  morale: number | null;
};

type HqAxisEntry = {
  label: string;
  rank: number;
};

export type ManagerOfficeClientProps = {
  homeNextMatchdayStatus: {
    openSlots: number;
    requiredSlots: number;
    filledSlots: number;
    resultAvailable: boolean;
    hasFormCards: boolean;
    statusLabel: string;
  };
  selectedTeamPlayerDemands: Array<{ detail: string; type?: string }>;
  selectedHqFinanceWarnings: string[];
  selectedStandingRow: {
    cash: number | null;
    salaryTotal: number | null;
    rosterCount: number | null;
    rank: number | null;
    points: number | null;
    guv: number | null;
  } | null;
  /**
   * Kredit-Kern (`lib/finance/loan-service.ts`): jährliche Kreditrate und
   * Restschuld des aktiven Manager-Teams (Fog of War — nie ein fremdes Team,
   * siehe `use-credits-view-model.ts`). `null`/`0` blendet die Anzeige aus.
   */
  loanInstallment?: number | null;
  outstandingDebt?: number | null;
  activeTeamOpenInboxItems: Array<{ title: string }>;
  activeTeamCriticalInboxItems: unknown[];
  selectedOpenObjectives: Array<{ label: string; detail?: string | null; actionHint?: string | null }>;
  selectedBoardConfidence: { pressure: number; value: number } | null;
  hqTrainingFocusCount: number;
  selectedTeamGeneralManager: {
    profile: { name: string; title: string; facilityPriorities: string[] };
    assignment: { source?: string; dismissalReason?: string | null };
  } | null;
  hqTransferWishlistEntries: HqWishlistEntry[];
  selectedTeamCaptainProfile: {
    playerName: string;
    style: string;
    effects: { moraleBuffer: number };
  } | null;
  selectedTeamCaptainCandidates: Array<{
    playerId: string;
    playerName: string;
    leadershipScore: number;
    style: string;
    effects: {
      moraleBuffer: number;
      rivalryPressureReductionPct: number;
      teamPowerModifierPct: number;
    };
    hasCaptaincyDemand: boolean;
    demandLabel: string | null;
  }>;
  selectedTeamCaptainPlayerId: string | null;
  assignTeamCaptainBusy: boolean;
  captainEffectsTooltip: string;
  onAssignTeamCaptain: (playerId: string) => void;
  selectedTeamPowers: unknown[];
  hqContractExpiringCount: number;
  hqTransferSellMarkers: HqSellMarker[];
  selectedHqMoraleSummary: {
    average: number;
    criticalCount: number;
    exitRiskCount: number;
  } | null;
  selectedRosterTableRows: unknown[];
  selectedHqAxisSummary: {
    weakestTwo: HqAxisEntry[];
    strongest: HqAxisEntry | null;
  } | null;
  selectedHqInboxItems: GameInboxItem[];
  selectedHqGmStory: GmStoryView | null;
  selectedTeam: { teamId?: string; name?: string; shortCode?: string } | null;
  selectedTeamControl: { controlMode: TeamControlMode | null } | null;
  homeActiveTeamLogo: { src?: string | null; initials?: string } | null;
  gameState: { season: { name: string }; gamePhase?: string | null };
  currentMatchdayDisplayLabel: string;
  selectedTeamCanManage: boolean;
  isReadOnlyMode: boolean;
  selectedTeamTopSixAxisStats: { pow: number; spe: number; men: number; soc: number } | null;
  rosterPlayers: unknown[];
  onNavigate: (view: FoundationViewId) => void;
  onOpenTeam: (teamId: string) => void;
  onNavigateInboxItem: (item: GameInboxItem) => void;
  seasonReadinessChecklist?: SeasonReadinessChecklist | null;
};

export function ManagerOfficeClient({
  selectedOpenObjectives,
  selectedBoardConfidence,
  selectedTeamGeneralManager,
  hqTransferWishlistEntries,
  selectedTeamCaptainProfile,
  selectedTeamCaptainCandidates,
  selectedTeamCaptainPlayerId,
  assignTeamCaptainBusy,
  captainEffectsTooltip,
  onAssignTeamCaptain,
  hqContractExpiringCount,
  hqTransferSellMarkers,
  selectedHqGmStory,
  selectedTeam,
  homeActiveTeamLogo,
  gameState,
  selectedTeamCanManage,
  isReadOnlyMode,
  selectedTeamTopSixAxisStats,
  onNavigate,
  onOpenTeam,
  seasonReadinessChecklist,
}: ManagerOfficeClientProps) {
  const [draftCaptainPlayerId, setDraftCaptainPlayerId] = useState<string | null>(selectedTeamCaptainPlayerId);

  useEffect(() => {
    setDraftCaptainPlayerId(selectedTeamCaptainPlayerId);
  }, [selectedTeamCaptainPlayerId, selectedTeam?.teamId]);

  // Kapitän-Vergleich (O3): Kandidaten nach Leadership absteigend, Effekte
  // spaltenweise — die Spaltenmenge kommt aus dem geteilten Erklär-Helfer
  // (buildCaptainEffectExplanations), damit Werte UND Tooltips identisch zu
  // jeder anderen Captain-Anzeige sind. Kein zweiter Rechenweg.
  const captainRows = [...selectedTeamCaptainCandidates]
    .sort((left, right) => right.leadershipScore - left.leadershipScore)
    .map((candidate) => ({
      candidate,
      effects: buildCaptainEffectExplanations(candidate),
    }));
  const captainEffectColumns = captainRows[0]?.effects.map((effect) => ({ key: effect.key, label: effect.label })) ?? [];
  const maxLeadership = captainRows.reduce((max, row) => Math.max(max, row.candidate.leadershipScore), 0);

  // Front-Office-Notizen: nur Zeilen mit Daten. Leere Themen erscheinen als EINE
  // dezente Sammelzeile statt als gleichrangige Leerkarten (O4).
  const wishlistRows = hqTransferWishlistEntries.slice(0, 3);
  const sellRows = hqTransferSellMarkers.slice(0, 3);
  const hasNotes = wishlistRows.length > 0 || sellRows.length > 0 || hqContractExpiringCount > 0;

  // GM-Status-Zeile: die einzige Stelle, an der der Mandats-Zustand des GM
  // kompakt steht (Hot Seat / Board-Wechsel) — bleibt deshalb im Office.
  const gmStatusDetail = selectedTeamGeneralManager
    ? selectedTeamGeneralManager.assignment.source === "board_replacement" ||
      selectedTeamGeneralManager.assignment.dismissalReason
      ? "Board-Wechsel · neuer GM"
      : // Formatfix (Durchklick): Druck ist eine 1-Nachkommastellen-Größe — roh interpoliert
        // stand hier „Druck 8.4/10" (JS-Punkt statt Hauskomma).
        (selectedBoardConfidence?.pressure ?? 0) >= 8
        ? `Hot Seat · Druck ${formatLocalePoints(selectedBoardConfidence?.pressure, 1)}/10`
        : (selectedBoardConfidence?.pressure ?? 0) >= 6
          ? `Board schaut hin · Druck ${formatLocalePoints(selectedBoardConfidence?.pressure, 1)}/10`
          : selectedTeamGeneralManager.profile.title
    : null;

  return (
    <section className="foundation-hq-panel" data-testid="foundation-hq" id="foundation-hq">
      <div className="foundation-hq-hero">
        <button
          className="foundation-home-team-card foundation-hq-team-card"
          type="button"
          onClick={() => selectedTeam?.teamId && onOpenTeam(selectedTeam.teamId)}
          title="Team-Dossier öffnen"
        >
          <OptimizedMediaImage
            className="foundation-home-logo"
            src={homeActiveTeamLogo?.src}
            alt={`${selectedTeam?.name ?? "Team"} Logo`}
            loading="eager"
            fetchPriority="high"
            fallback={
              <span className="foundation-home-logo team-logo-placeholder">
                {homeActiveTeamLogo?.initials ?? selectedTeam?.shortCode ?? "?"}
              </span>
            }
          />
          <div className="stack">
            <span className="eyebrow">HQ / Manager-Zentrale</span>
            <h1>{selectedTeam?.name ?? "Kein Team ausgewählt"}</h1>
            {selectedTeamGeneralManager ? (
              <p className="muted foundation-hq-gm-line">
                GM {selectedTeamGeneralManager.profile.name} · {selectedTeamGeneralManager.profile.title}
              </p>
            ) : null}
            {selectedTeam && (!selectedTeamCanManage || isReadOnlyMode) ? (
              <span className="transfer-status-pill is-warning">Nur Ansicht</span>
            ) : null}
            {selectedTeamTopSixAxisStats ? (
              // F4: dieselbe Größe wie Home-Radar und Markt-Impact —
              // Ø Top-6 je Achse (computeTeamTopSixAxisStats), und die
              // Basis steht dran.
              <span title="Ø der sechs besten Werte je Achse — gleiche Basis wie Home-Radar und Markt-Vorschau">
                <VeloStatOrbitRow
                  ariaLabel="Team-Achsen Ø Top-6"
                  className="foundation-hq-axis-orbit"
                  stats={{
                    pow: selectedTeamTopSixAxisStats.pow,
                    spe: selectedTeamTopSixAxisStats.spe,
                    men: selectedTeamTopSixAxisStats.men,
                    soc: selectedTeamTopSixAxisStats.soc,
                  }}
                />
                <span className="foundation-hq-axis-basis">Ø Top-6</span>
              </span>
            ) : null}
          </div>
        </button>
      </div>
      {seasonReadinessChecklist ? (
        <section className="foundation-hq-readiness-checklist" data-testid="foundation-season-readiness-checklist" aria-label={seasonReadinessChecklist.title}>
          <div className="foundation-hq-readiness-head">
            <span className="eyebrow">{seasonReadinessChecklist.title}</span>
            <strong>
              {seasonReadinessChecklist.readyCount}/{seasonReadinessChecklist.totalCount} bereit
            </strong>
          </div>
          <div className="foundation-hq-readiness-grid">
            {seasonReadinessChecklist.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`foundation-hq-readiness-item is-${item.status}`}
                onClick={() => {
                  onNavigate(item.targetView);
                  if (item.targetPanel) {
                    window.setTimeout(() => {
                      document.getElementById(item.targetPanel!)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 120);
                  }
                }}
              >
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {selectedTeamGeneralManager && selectedHqGmStory && !isSeasonOnePreseasonNeutralBoard(gameState as GameState) ? (
        <div
          className={`season-v2-gm-story is-${selectedHqGmStory.tone}`}
          data-testid="foundation-hq-gm-story"
          title="GM-Mandat aus Board Confidence, Druck und möglichen Wechselgruenden."
        >
          <strong>{selectedHqGmStory.label}</strong>
          <span>
            {selectedTeamGeneralManager.profile.name} · {selectedTeamGeneralManager.profile.title} ·{" "}
            {selectedHqGmStory.detail}
          </span>
        </div>
      ) : null}

      <VeloImpactStrip
        className="foundation-hq-board-impact-strip"
        items={[
          {
            key: "pressure",
            label: "Druck",
            value: `${selectedBoardConfidence?.pressure ?? "—"}/10`,
            tone: (selectedBoardConfidence?.pressure ?? 0) >= 8 ? "negative" : (selectedBoardConfidence?.pressure ?? 0) >= 6 ? "warning" : "neutral",
          },
          {
            key: "confidence",
            label: "Rating",
            value: `${selectedBoardConfidence?.value ?? "—"}/10`,
            tone: (selectedBoardConfidence?.value ?? 0) >= 7 ? "positive" : (selectedBoardConfidence?.value ?? 0) <= 4 ? "negative" : "neutral",
          },
          {
            key: "goal",
            label: "Nächstes Ziel",
            // Board-Ziele mit Fortschritt leben auf der Übersicht (eine Quelle) —
            // hier nur das nächste offene, sonst der ehrliche Leer-Hinweis.
            value: selectedOpenObjectives[0]?.label ?? "keine offenen",
            tone: "neutral",
          },
        ]}
      />

      <section
        className="foundation-hq-captain-picker"
        id="foundation-hq-captain-picker"
        data-testid="foundation-hq-captain-picker"
        aria-label="Saison-Kapitän wählen"
      >
        <div className="foundation-hq-captain-head">
          <div className="stack">
            <span className="eyebrow">Saison-Führung</span>
            <strong title={captainEffectsTooltip}>Kapitän ernennen</strong>
            <p className="muted">{captainEffectsTooltip}</p>
          </div>
          {selectedTeamCaptainProfile ? (
            <span className="pill">
              Aktiv: {selectedTeamCaptainProfile.playerName} · {selectedTeamCaptainProfile.style}
            </span>
          ) : null}
        </div>
        {/* O3: Vergleichstabelle statt acht fast identischer Textkarten — der
            Unterschied (Leadership) ist als Balken sichtbar, alle Effekte stehen
            in einheitlichem Format nebeneinander. Zeile klicken = Kandidat wählen. */}
        {captainRows.length > 0 ? (
          <div className="foundation-hq-captain-table-wrap">
            <table className="foundation-hq-captain-table nl-tnum" data-testid="foundation-hq-captain-table">
              <thead>
                <tr>
                  <th>Kandidat</th>
                  <th>Leadership</th>
                  <th>Stil</th>
                  {captainEffectColumns.map((column) => (
                    <th key={column.key} className="is-num">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {captainRows.map(({ candidate, effects }) => {
                  const isDraft = draftCaptainPlayerId === candidate.playerId;
                  const isActive = selectedTeamCaptainPlayerId === candidate.playerId;
                  return (
                    <tr
                      key={`hq-captain-${candidate.playerId}`}
                      className={`foundation-hq-captain-row${isDraft ? " is-selected" : ""}${isActive ? " is-active" : ""}`}
                      onClick={() => {
                        if (selectedTeamCanManage && !isReadOnlyMode) setDraftCaptainPlayerId(candidate.playerId);
                      }}
                      aria-selected={isDraft}
                    >
                      <td className="foundation-hq-captain-name">
                        <strong>{candidate.playerName}</strong>
                        {isActive ? <span className="foundation-hq-captain-active-pill">Aktiv</span> : null}
                        {candidate.hasCaptaincyDemand ? (
                          <span className="transfer-status-pill is-warning">{candidate.demandLabel ?? "Will Captain sein"}</span>
                        ) : null}
                      </td>
                      <td className="foundation-hq-captain-lead">
                        <span className="foundation-hq-captain-lead-bar" aria-hidden="true">
                          <i style={{ width: `${maxLeadership > 0 ? Math.round((candidate.leadershipScore / maxLeadership) * 100) : 0}%` }} />
                        </span>
                        <span className="foundation-hq-captain-lead-value">{formatLocalePoints(candidate.leadershipScore, 1)}</span>
                      </td>
                      <td className="foundation-hq-captain-style">{candidate.style}</td>
                      {effects.map((effect) => (
                        <td
                          key={effect.key}
                          className="is-num"
                          title={[effect.appliesTo, effect.formula, effect.caveat].filter(Boolean).join("\n")}
                        >
                          {effect.displayValue}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Kein Kader für die Kapitänswahl verfügbar.</p>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={
            !draftCaptainPlayerId ||
            !selectedTeamCanManage ||
            isReadOnlyMode ||
            assignTeamCaptainBusy ||
            draftCaptainPlayerId === selectedTeamCaptainPlayerId
          }
          onClick={() => draftCaptainPlayerId && onAssignTeamCaptain(draftCaptainPlayerId)}
        >
          {assignTeamCaptainBusy ? "Speichert …" : "Kapitän bestätigen"}
        </button>
      </section>

      {/* Front-Office-Notizen: nur, was NICHT schon auf der Übersicht steht —
          und nur mit echten Daten. Leerzustände: eine dezente Zeile (O4). */}
      <section className="foundation-hq-notes" aria-label="Front-Office-Notizen">
        <div className="foundation-hq-notes-head">
          <span className="eyebrow">Front Office</span>
          <strong>Notizen</strong>
          {gmStatusDetail && selectedTeamGeneralManager ? (
            <span className="foundation-hq-notes-gm" title="GM-Mandat — Details im Board-Kasten oben">
              GM {selectedTeamGeneralManager.profile.name} · {gmStatusDetail}
            </span>
          ) : null}
          <button
            type="button"
            className="foundation-hq-notes-inbox-link"
            onClick={() => onNavigate("inboxV2")}
            title="Alle offenen Aufgaben und Warnungen in der Inbox"
          >
            Entscheidungen öffnen →
          </button>
        </div>
        {hasNotes ? (
          <div className="foundation-hq-notes-grid">
            {wishlistRows.length > 0 ? (
              <button type="button" className="foundation-hq-notes-row" onClick={() => onNavigate("marketV2")}>
                <span className="foundation-hq-notes-label">Wunschliste</span>
                <strong>
                  {wishlistRows
                    .map((entry) => `${entry.playerName} (${entry.className}${entry.marketValue != null ? ` · MW ${formatTransfermarktCurrency(entry.marketValue)}` : ""})`)
                    .join(" · ")}
                </strong>
                <small>{hqTransferWishlistEntries.length} vorgemerkt — zum Transfermarkt</small>
              </button>
            ) : null}
            {sellRows.length > 0 ? (
              <button type="button" className="foundation-hq-notes-row" onClick={() => onNavigate("teams")}>
                <span className="foundation-hq-notes-label">VK vorgemerkt</span>
                <strong>{sellRows.map((entry) => entry.playerName).join(" · ")}</strong>
                <small>{hqTransferSellMarkers.length} für den Abgang markiert — zum Kader</small>
              </button>
            ) : null}
            {hqContractExpiringCount > 0 ? (
              <button type="button" className="foundation-hq-notes-row" onClick={() => onNavigate("teams")}>
                <span className="foundation-hq-notes-label">Ausläufer</span>
                <strong className="nl-tnum">{hqContractExpiringCount} Verträge laufen bald aus</strong>
                <small>Verlängern oder Abgang planen — zu Liste &amp; Verträge</small>
              </button>
            ) : null}
          </div>
        ) : (
          <p className="foundation-hq-notes-empty">
            Gerade nichts vorzubereiten — Wishlist, Abgangs-Vormerkungen und auslaufende Verträge erscheinen hier,
            sobald es sie gibt.
          </p>
        )}
      </section>
    </section>
  );
}
