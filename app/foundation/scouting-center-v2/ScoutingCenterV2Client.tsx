"use client";

import type { ScoutingHubV2ClientProps } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";

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
  watchTargets,
  onOpenMarket,
  onOpenHomeV2,
  onOpenPlayer,
}: ScoutingHubV2ClientProps) {
  const rosterGap =
    rosterMinimum != null && rosterCount < rosterMinimum ? rosterMinimum - rosterCount : 0;

  return (
    <div className="scouting-center-v2-shell" data-testid="foundation-scouting-hub-v2" id="foundation-scouting-hub-v2">
      <header className="scouting-center-v2-header">
        <div>
          <span className="eyebrow">Scouting & Transfermarkt</span>
          <h2>{teamName}</h2>
          <p className="muted">
            {scoutingFacilityLabel} · Scouting L{scoutingFacilityLevel} · Hub-Preview — kein separates Scouting Center
          </p>
        </div>
        <div className="scouting-center-v2-actions">
          <button type="button" className="secondary-button" onClick={onOpenHomeV2}>
            Home V2
          </button>
          <button type="button" className="primary-button" onClick={onOpenMarket}>
            Transfermarkt öffnen
          </button>
        </div>
      </header>

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

      <section className="scouting-hub-v2-watchlist">
        <div className="home-v2-panel-head">
          <span className="eyebrow">Watchlist / Beobachtet</span>
          <h3>Deine Scouting-Ziele</h3>
        </div>
        {watchTargets.length > 0 ? (
          <div className="scouting-hub-v2-target-grid">
            {watchTargets.map((target) => (
              <button
                key={target.playerId}
                type="button"
                className="scouting-hub-v2-target-card"
                onClick={() => onOpenPlayer(target.playerId)}
              >
                <strong>{target.playerName}</strong>
                <span>{target.className}</span>
                <span>MW {target.marketValue}</span>
                <small>{target.baseInfoSummary}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">
            Noch keine Watchlist-Einträge. Im Transfermarkt Spieler markieren — Base-Infos reichen für den ersten Draft.
          </p>
        )}
        <button type="button" className="primary-button inline-button" onClick={onOpenMarket}>
          Transfermarkt öffnen
        </button>
      </section>
    </div>
  );
}
