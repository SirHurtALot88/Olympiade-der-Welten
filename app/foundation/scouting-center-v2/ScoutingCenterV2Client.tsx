"use client";

import type { ScoutingHubV2ClientProps } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";
import FoundationSubNav from "@/app/foundation/shell/FoundationSubNav";
import ScoutingCenterV2NewLook from "@/app/foundation/scouting-center-v2/ScoutingCenterV2NewLook";
import ScoutingPriorityQueue from "@/app/foundation/scouting-center-v2/ScoutingPriorityQueue";
import ScoutingReportPanel from "@/app/foundation/scouting-center-v2/ScoutingReportPanel";
import { useNewLook } from "@/lib/ui/new-look-preference";
import { useState } from "react";

function renderStars(level: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <span key={`scout-star-${index}`} className={index < level ? "is-filled" : ""}>
      ★
    </span>
  ));
}

const REVEAL_STEP_LABELS = ["Basis", "Range", "Trait+", "Sterne", "Diszi", "Exakt"];

function renderRevealLadder(disclosureLevel: number) {
  return (
    <div className="scouting-reveal-ladder" role="list" aria-label="Scouting-Enthüllungsstufe">
      {REVEAL_STEP_LABELS.map((label, level) => (
        <div
          key={label}
          role="listitem"
          className={`scouting-reveal-step${level <= disclosureLevel ? " is-reached" : ""}${level === disclosureLevel ? " is-current" : ""}`}
          title={`L${level} · ${label}`}
        >
          <span className="scouting-reveal-step-dot">{level}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

export default function ScoutingCenterV2Client(props: ScoutingHubV2ClientProps) {
  // "Neuer Look" Flag-Gate (additiv): Hooks laufen unverändert vor dem Gate
  // (stabile Hook-Reihenfolge beim Umschalten des Flags); Flag aus =>
  // bestehende Ansicht unverändert.
  const [newLook] = useNewLook();
  const [internalActiveTab, setInternalActiveTab] = useState<"overview" | "reports" | "recommended">("overview");
  if (newLook) return <ScoutingCenterV2NewLook {...props} />;
  const {
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
    onOpenFacilities,
    onOpenPlayer,
    queueEntries = [],
    focusEtaLabel = null,
    wishlistSlotLimit = null,
    onReorderQueue,
    onRemoveFromQueue,
    report = null,
    selectedReportPlayerId = null,
    onSelectReportPlayer,
  } = props;
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
        <section className="scouting-overview-stats">
          <article className="scouting-stat-chip" title={draftContextNote}>
            <span className="eyebrow">Budget</span>
            <strong>{recruitmentBudget}</strong>
          </article>

          <article className="scouting-stat-chip" title={draftContextNote}>
            <span className="eyebrow">Kader</span>
            <strong>
              {rosterCount}
              {rosterMinimum != null ? `/${rosterMinimum}` : ""}
            </strong>
            {rosterGap > 0 ? (
              <span className="transfer-status-pill is-warning">−{rosterGap} bis Minimum</span>
            ) : (
              <span className="transfer-status-pill is-ready">Minimum erreicht</span>
            )}
          </article>

          <article className="scouting-stat-chip" title="Progressive Enthüllung im Transfermarkt — Base-Infos bleiben für Rekrutierung sichtbar.">
            <span className="eyebrow">Scouting-Stufe</span>
            <div className="home-v2-stars scouting-stat-stars">{renderStars(scoutingFacilityLevel)}</div>
            <small className="muted">Stufe {disclosureLevel}/5</small>
          </article>
        </section>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <section className="scouting-facility-power">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Scouting Office</span>
              <h3>Slots &amp; Speed pro Spieltag</h3>
            </div>
            {scoutingFacilityLevel <= 0 ? (
              <>
                <p className="muted">
                  Noch kein Scouting Office gebaut — die Warteschlange läuft ohne Fortschritt. Bau eins, damit Fokus-Ziele
                  Intel sammeln.
                </p>
                {onOpenFacilities ? (
                  <button type="button" className="primary-button inline-button" onClick={onOpenFacilities}>
                    Scouting Office bauen
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {scoutPipeline ? (
                  <>
                    {scoutPipeline.draftSuspended ? (
                      <span className="muted">Draft-Phase — Slots ohne Limit ({scoutPipeline.occupiedSlots} belegt)</span>
                    ) : (
                      <>
                        <div className="scouting-facility-slot-track">
                          <div
                            className="scouting-facility-slot-fill"
                            style={{
                              width: `${Math.min(100, (scoutPipeline.occupiedSlots / Math.max(1, scoutPipeline.maxSlots)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="muted">
                          {scoutPipeline.occupiedSlots}/{scoutPipeline.maxSlots} Scouting-Slots belegt
                        </span>
                      </>
                    )}
                    <div className="scouting-facility-rates">
                      <div className="scouting-facility-rate-chip">
                        <span>Fokus · Platz 1</span>
                        <strong>+{scoutPipeline.focusTickGain}%/Spieltag</strong>
                      </div>
                      <div className="scouting-facility-rate-chip">
                        <span>Rest der Wishlist</span>
                        <strong>+{scoutPipeline.wishlistTickGain}%/Spieltag</strong>
                      </div>
                      <div className="scouting-facility-rate-chip">
                        <span>Passive Scouts</span>
                        <strong>
                          {scoutPipeline.passiveActive}/{scoutPipeline.passiveSlots} aktiv · +{scoutPipeline.passiveTickGain}
                          %/Spieltag
                        </strong>
                      </div>
                    </div>
                  </>
                ) : null}
                {scoutingFacilityLevel < 5 ? (
                  onOpenFacilities ? (
                    <button type="button" className="secondary-button inline-button" onClick={onOpenFacilities}>
                      Facility upgraden für mehr Speed
                    </button>
                  ) : null
                ) : (
                  <span className="transfer-status-pill is-ready">Max-Level erreicht</span>
                )}
              </>
            )}
          </section>

          <section className="scouting-reveal-section">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Fog of War</span>
              <h3>Enthüllung bei Scouting L{disclosureLevel}</h3>
            </div>
            {renderRevealLadder(disclosureLevel)}
            <div className="scouting-reveal-pill-row">
              {baseInfoAlwaysVisible.map((entry) => (
                <span key={entry} className="scouting-reveal-pill is-visible is-base" title={entry}>
                  ✓ {entry}
                </span>
              ))}
              {visibleAtTier.map((entry) => (
                <span key={entry} className="scouting-reveal-pill is-visible" title={entry}>
                  ✓ {entry}
                </span>
              ))}
            </div>
            {hiddenAtTier.length > 0 ? (
              <div className="scouting-reveal-pill-row is-hidden-row">
                {hiddenAtTier.map((entry) => (
                  <span key={entry} className="scouting-reveal-pill is-hidden" title={entry}>
                    🔒 {entry}
                  </span>
                ))}
              </div>
            ) : null}
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
                {" — Platz 1 zuerst, Rest folgt automatisch."}
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
