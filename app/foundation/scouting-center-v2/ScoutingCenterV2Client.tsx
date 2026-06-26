"use client";

import type { ScoutingHubV2ClientProps, ScoutingHubV2WatchTarget } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";
import FoundationSubNav from "@/app/foundation/shell/FoundationSubNav";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import { VeloScoutMetric, VeloStarRating, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import { useState } from "react";

function renderStars(level: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <span key={`scout-star-${index}`} className={index < level ? "is-filled" : ""}>
      ★
    </span>
  ));
}

function getPotentialBandLabel(band: string | null | undefined) {
  if (band === "elite") return "★ Elite";
  if (band === "high") return "↑ Hoch";
  if (band === "medium") return "Mittel";
  if (band === "low") return "Gering";
  return null;
}

function formatHalfStar(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}★`;
}

function hasAxisStats(target: ScoutingHubV2WatchTarget) {
  return (
    target.pow != null ||
    target.spe != null ||
    target.men != null ||
    target.soc != null
  );
}

function hasCaStars(target: ScoutingHubV2WatchTarget) {
  return target.caOverall != null;
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
  scoutPipeline = null,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  hideSubNav = false,
  onOpenMarket,
  onOpenPlayer,
}: ScoutingHubV2ClientProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<"overview" | "reports" | "recommended">("overview");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: "overview" | "reports" | "recommended") => {
    onActiveTabChange?.(tab);
    if (controlledActiveTab == null) {
      setInternalActiveTab(tab);
    }
  };
  const rosterGap =
    rosterMinimum != null && rosterCount < rosterMinimum ? rosterMinimum - rosterCount : 0;

  return (
    <div className="scouting-center-v2-shell" data-testid="foundation-scouting-hub-v2" id="foundation-scouting-hub-v2">
      <header className="scouting-center-v2-header">
        <div>
          <span className="eyebrow">Scouting & Transfermarkt</span>
          <h2>{teamName}</h2>
          <p className="muted">
            {scoutingFacilityLabel} · Scouting L{scoutingFacilityLevel} · Markt-Hub (kein separates Scouting Center — Potenzial aus Kader/Facilities)
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
          { id: "reports", label: "Reports" },
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

      <section className="scouting-hub-v2-watchlist">
        <div className="home-v2-panel-head">
          <span className="eyebrow">Facility Pipeline</span>
          <h3>Aktive Beobachtung</h3>
          {scoutPipeline ? (
            <p className="muted">
              {scoutPipeline.occupiedSlots}/{scoutPipeline.maxSlots} Slots · +{scoutPipeline.tickGain} Intel/Spieltag
              {scoutPipeline.passiveActive > 0 ? ` · ${scoutPipeline.passiveActive} passive Scouts` : ""}
            </p>
          ) : null}
        </div>
        {scoutPipeline && scoutPipeline.records.length > 0 ? (
          <div className="scouting-hub-v2-target-grid">
            {scoutPipeline.records.map((record) => (
              <button
                key={`scout-pipeline-${record.playerId}`}
                type="button"
                className="scouting-hub-v2-target-card"
                onClick={() => onOpenPlayer(record.playerId)}
              >
                <strong>{record.playerName}</strong>
                <span>{record.source}</span>
                <span>Scouting {record.certainty}%</span>
                <small>
                  {record.certainty < 25
                    ? "Nächster Meilenstein: Achsen-Band"
                    : record.certainty < 50
                      ? "Nächster Meilenstein: Achsen-Sterne"
                      : record.certainty < 75
                        ? "Nächster Meilenstein: Potential-Band"
                        : "Nächster Meilenstein: enge Potential-Range"}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">Scouting Office beobachtet noch keine Spieler — Watchlist im Transfermarkt setzen oder Facility upgraden.</p>
        )}
      </section>
      </>
      ) : null}

      {activeTab === "recommended" || activeTab === "reports" ? (
      <section className="scouting-hub-v2-watchlist">
        <div className="home-v2-panel-head">
          <span className="eyebrow">Top Stärken</span>
          <h3>Top 3 Disziplinen (Scouting)</h3>
        </div>
        <div className="scouting-hub-v2-target-grid" data-testid="scouting-top-disciplines">
          {watchTargets.slice(0, 3).map((target) => (
            <article key={`disc-${target.playerId}`} className="scouting-hub-v2-target-card">
              <DisciplineIcon disciplineId={target.className?.toLowerCase()} label={target.className ?? "Flex"} showLabel />
              <VeloScoutMetric rangeLabel={target.marketValue} tier={target.className?.slice(0, 1) ?? "?"} scoutingLevel={disclosureLevel} />
              <strong>{target.playerName}</strong>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {(activeTab === "overview" || activeTab === "recommended") ? (
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
                data-testid="scouting-watchlist-card"
              >
                <strong>{target.playerName}</strong>
                <span>{target.className}</span>
                {hasAxisStats(target) ? (
                  <VeloStatOrbitRow
                    showGrade
                    stats={{
                      pow: target.pow ?? 0,
                      spe: target.spe ?? 0,
                      men: target.men ?? 0,
                      soc: target.soc ?? 0,
                    }}
                    ariaLabel={`${target.playerName} Achsenwerte`}
                  />
                ) : (
                  <small className="muted">MW {target.marketValue}</small>
                )}
                {hasCaStars(target) ? (
                  <div className="scouting-hub-v2-ca-po-row" data-testid="scouting-ca-po-row">
                    <VeloStarRating compact label="CA" value={target.caOverall} />
                    {target.caPow != null ? (
                      <small className="muted scouting-hub-v2-axis-stars">
                        P {formatHalfStar(target.caPow)} · S {formatHalfStar(target.caSpe)} · M{" "}
                        {formatHalfStar(target.caMen)} · So {formatHalfStar(target.caSoc)}
                      </small>
                    ) : null}
                    {target.poDisplay ? (
                      <span className="scouting-hub-v2-po-label" data-testid="scouting-potential-stars">
                        PO {target.poDisplay}
                        {target.potentialGap != null && target.potentialGap > 0
                          ? ` · Gap +${target.potentialGap}★`
                          : ""}
                      </span>
                    ) : null}
                    {target.poPow != null ? (
                      <small className="muted scouting-hub-v2-axis-stars" data-testid="scouting-po-axis-stars">
                        PO-Achsen P {formatHalfStar(target.poPow)} · S {formatHalfStar(target.poSpe)} · M{" "}
                        {formatHalfStar(target.poMen)} · So {formatHalfStar(target.poSoc)}
                      </small>
                    ) : null}
                  </div>
                ) : null}
                {target.potentialBand ? (
                  <span
                    className={
                      target.potentialBand === "elite"
                        ? "transfer-status-pill is-ready"
                        : target.potentialBand === "high"
                          ? "transfer-status-pill is-info"
                          : "pill"
                    }
                    data-testid="scouting-potential-band"
                  >
                    {getPotentialBandLabel(target.potentialBand)}
                  </span>
                ) : null}
                <small className="muted">{target.baseInfoSummary}</small>
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
      ) : null}
    </div>
  );
}
