"use client";

import type { ScoutingHubV2ClientProps } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";
import FoundationSubNav from "@/app/foundation/shell/FoundationSubNav";
import ScoutingPriorityQueue from "@/app/foundation/scouting-center-v2/ScoutingPriorityQueue";
import ScoutingReportPanel from "@/app/foundation/scouting-center-v2/ScoutingReportPanel";
import { useState } from "react";

function renderStars(level: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <span key={`scout-star-${index}`} className={index < level ? "is-filled" : ""}>
      ★
    </span>
  ));
}

export default function ScoutingCenterV2Client({
  teamName,
  scoutingFacilityLevel,
  scoutingFacilityLabel,
  recruitmentBudget,
  rosterCount,
  rosterMinimum,
  rosterOptimum,
  draftContextNote,
  disclosureLevel,
  visibleAtTier,
  hiddenAtTier,
  baseInfoAlwaysVisible,
  scoutPipeline = null,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  hideSubNav = false,
  onOpenMarket,
  onOpenPlayer,
  queueEntries = [],
  focusEtaLabel = null,
  wishlistSlotLimit = null,
  onReorderQueue,
  onRemoveFromQueue,
  report = null,
  selectedReportPlayerId = null,
  onSelectReportPlayer,
}: ScoutingHubV2ClientProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<"overview" | "reports" | "recommended">("overview");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: "overview" | "reports" | "recommended") => {
    onActiveTabChange?.(tab);
    if (controlledActiveTab == null) {
      setInternalActiveTab(tab);
    }
  };
  const rosterGap = rosterMinimum != null && rosterCount < rosterMinimum ? rosterMinimum - rosterCount : 0;
  const readyToBuyEntries = queueEntries.filter((entry) => entry.isFullyScouted);
  const focusEntry = queueEntries.find((entry) => entry.isFocusTarget && !entry.isFullyScouted) ?? null;

  return (
    <div className="scouting-center-v2-shell" data-testid="foundation-scouting-hub-v2" id="foundation-scouting-hub-v2">
      <header className="scouting-center-v2-header">
        <div>
          <span className="eyebrow">Scouting</span>
          <h2 title={`${scoutingFacilityLabel} · Scouting L${scoutingFacilityLevel} · Markt-Hub`}>{teamName}</h2>
          <p className="home-v2-hero-meta-line">
            {scoutingFacilityLabel} · L{scoutingFacilityLevel}
            {rosterGap > 0 ? ` · −${rosterGap} Kader` : ""}
          </p>
        </div>
        <div className="scouting-center-v2-actions" />
      </header>

      {!hideSubNav ? (
        <FoundationSubNav
          className="scouting-center-v2-subnav"
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as typeof activeTab)}
          items={[
            { id: "overview", label: "Übersicht" },
            { id: "reports", label: "Scouting Report" },
            { id: "recommended", label: "Empfehlungen" },
          ]}
        />
      ) : null}

      {(activeTab === "overview" || activeTab === "recommended") ? (
        <section className="scouting-hub-v2-recruitment">
          <article className="scouting-hub-v2-card">
            <span className="eyebrow">Draft & Rekrutierung</span>
            <h3>Kaderaufbau aus leerem Start</h3>
            <p>{draftContextNote}</p>
            <div className="scouting-hub-v2-metrics">
              <div>
                <span>Budget</span>
                <strong>{recruitmentBudget}</strong>
              </div>
              <div>
                <span>Kader</span>
                <strong>
                  {rosterCount}
                  {rosterMinimum != null ? ` / min ${rosterMinimum}` : ""}
                  {rosterOptimum != null ? ` · opt ${rosterOptimum}` : ""}
                </strong>
              </div>
              {rosterGap > 0 ? (
                <span className="transfer-status-pill is-warning">{rosterGap} Spieler bis Minimum</span>
              ) : (
                <span className="transfer-status-pill is-ready">Mindestkader erreicht</span>
              )}
            </div>
          </article>

          <article className="scouting-hub-v2-card">
            <span className="eyebrow">Scouting-Stufe</span>
            <div className="home-v2-stars">{renderStars(scoutingFacilityLevel)}</div>
            <p className="muted">
              Stufe {disclosureLevel}: progressive Enthüllung im Transfermarkt — Base-Infos bleiben für Rekrutierung sichtbar.
            </p>
          </article>
        </section>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <section className="scouting-hub-v2-disclosure">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Sichtbarkeit</span>
              <h3>Was du bei Scouting L{disclosureLevel} siehst</h3>
            </div>
            <div className="scouting-hub-v2-disclosure-grid">
              <article>
                <strong>Base Infos (immer)</strong>
                <ul>
                  {baseInfoAlwaysVisible.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </article>
              <article>
                <strong>Aktuell sichtbar</strong>
                <ul>
                  {visibleAtTier.length > 0 ? visibleAtTier.map((entry) => <li key={entry}>{entry}</li>) : <li>—</li>}
                </ul>
              </article>
              <article>
                <strong>Noch verborgen</strong>
                <ul>
                  {hiddenAtTier.length > 0 ? hiddenAtTier.map((entry) => <li key={entry}>{entry}</li>) : <li>—</li>}
                </ul>
              </article>
            </div>
          </section>

          <section className="scouting-hub-v2-watchlist scouting-queue-section">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Scouting-Warteschlange</span>
              <h3>Wishlist — per Drag &amp; Drop sortieren</h3>
              <p className="muted">
                {scoutPipeline
                  ? scoutPipeline.draftSuspended
                    ? `${queueEntries.length} auf der Wishlist · Draft ohne Limit`
                    : `${queueEntries.length} auf der Wishlist · ${scoutPipeline.maxSlots} aktive Slots`
                  : `${queueEntries.length} auf der Wishlist`}
                {" — Platz 1 wird zuerst voll gescoutet, danach geht es automatisch mit dem nächsten weiter."}
              </p>
            </div>
            <ScoutingPriorityQueue
              entries={queueEntries}
              focusEtaLabel={focusEtaLabel}
              slotLimit={scoutPipeline?.draftSuspended ? null : (scoutPipeline?.maxSlots ?? wishlistSlotLimit)}
              selectedReportPlayerId={selectedReportPlayerId}
              onReorder={(playerId, targetIndex) => onReorderQueue?.(playerId, targetIndex)}
              onOpenPlayer={onOpenPlayer}
              onRemove={(playerId) => onRemoveFromQueue?.(playerId)}
              onSelectReport={(playerId) => {
                onSelectReportPlayer?.(playerId);
                setActiveTab("reports");
              }}
              onOpenMarket={onOpenMarket}
            />
          </section>
        </>
      ) : null}

      {activeTab === "reports" ? (
        <section className="scouting-report-section">
          <ScoutingReportPanel
            report={report}
            onOpenPlayer={onOpenPlayer}
            onPromoteToFocus={(playerId) => onReorderQueue?.(playerId, 0)}
            onRemove={(playerId) => onRemoveFromQueue?.(playerId)}
            canPromoteToFocus={queueEntries.length > 1}
          />
          {queueEntries.length > 1 ? (
            <div className="scouting-report-queue-picker">
              <span className="eyebrow">Andere Wishlist-Spieler</span>
              <div className="scouting-report-queue-picker-chips">
                {queueEntries
                  .filter((entry) => entry.playerId !== report?.playerId)
                  .map((entry) => (
                    <button
                      key={entry.playerId}
                      type="button"
                      className="scouting-report-queue-chip"
                      onClick={() => onSelectReportPlayer?.(entry.playerId)}
                    >
                      {entry.playerName}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "recommended" ? (
        <section className="scouting-recommendations-section" data-testid="scouting-recommendations">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Empfehlungen</span>
            <h3>Nächste Schritte</h3>
            <p className="muted">
              Voll gescoutete Wishlist-Spieler sind kaufbereit. Der Fokus in der Übersicht scoutet den nächsten Kandidaten
              automatisch weiter.
            </p>
          </div>

          {focusEntry ? (
            <article className="scouting-recommendations-focus-card">
              <span className="eyebrow">Aktueller Fokus</span>
              <strong>{focusEntry.playerName}</strong>
              <p className="muted">
                {focusEntry.certainty}% Intel
                {focusEtaLabel ? ` · ${focusEtaLabel}` : ""}
              </p>
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() => {
                  onSelectReportPlayer?.(focusEntry.playerId);
                  setActiveTab("reports");
                }}
              >
                Scouting Report öffnen
              </button>
            </article>
          ) : null}

          {readyToBuyEntries.length > 0 ? (
            <div className="scouting-recommendations-ready-grid">
              {readyToBuyEntries.map((entry) => (
                <article key={entry.playerId} className="scouting-recommendations-ready-card">
                  <strong>{entry.playerName}</strong>
                  <span className="transfer-status-pill is-ready">Kaufbereit</span>
                  <button
                    type="button"
                    className="ghost-button inline-button"
                    onClick={() => {
                      onSelectReportPlayer?.(entry.playerId);
                      setActiveTab("reports");
                    }}
                  >
                    Report öffnen
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted scouting-recommendations-empty">Noch niemand vollständig gescoutet.</p>
          )}
        </section>
      ) : null}

      {(activeTab === "overview" || activeTab === "recommended") ? (
        <section className="scouting-hub-v2-watchlist">
          <button type="button" className="primary-button inline-button" onClick={onOpenMarket}>
            Transfermarkt öffnen
          </button>
        </section>
      ) : null}
    </div>
  );
}
