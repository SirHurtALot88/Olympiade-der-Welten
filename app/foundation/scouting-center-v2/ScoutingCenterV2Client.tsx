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
  return target.pow != null || target.spe != null || target.men != null || target.soc != null;
}

function hasCaStars(target: ScoutingHubV2WatchTarget) {
  return target.caOverall != null;
}

function renderScoutTargetCard(input: {
  target: ScoutingHubV2WatchTarget;
  onOpenPlayer: (playerId: string) => void;
  testId: string;
}) {
  const { target, onOpenPlayer, testId } = input;
  const isActive = target.scoutStatus !== "bookmarked";

  return (
    <button
      key={target.playerId}
      type="button"
      className={`scouting-hub-v2-target-card${isActive ? " is-active-scout" : " is-bookmarked-only"}`}
      onClick={() => onOpenPlayer(target.playerId)}
      data-testid={testId}
      title={isActive ? "Aktiv gescoutet — Klick öffnet Spielerprofil." : "Nur gemerkt — kein Scout-Slot. Im Markt entfernen oder Slot freimachen."}
    >
      <div className="scouting-hub-v2-target-head">
        <strong>{target.playerName}</strong>
        <span
          className={`transfer-status-pill${isActive ? " is-ready" : ""}`}
          title={isActive ? "Dieser Spieler ist in der aktiven Scout-Pipeline." : "Nur auf der Wishlist, wird nicht aktiv gescoutet."}
        >
          {isActive ? `Scout aktiv${target.scoutCertainty != null ? ` ${target.scoutCertainty}%` : ""}` : "Nur gemerkt"}
        </span>
      </div>
      <span>{target.className}</span>
      {target.scoutSourceLabel ? <span>{target.scoutSourceLabel}</span> : null}
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
              P {formatHalfStar(target.caPow)} · S {formatHalfStar(target.caSpe)} · M {formatHalfStar(target.caMen)} · So{" "}
              {formatHalfStar(target.caSoc)}
            </small>
          ) : null}
          {target.poDisplay ? (
            <span className="scouting-hub-v2-po-label" data-testid="scouting-potential-stars">
              PO {target.poDisplay}
              {target.potentialGap != null && target.potentialGap > 0 ? ` · Gap +${target.potentialGap}★` : ""}
            </span>
          ) : null}
          {target.poPow != null ? (
            <small className="muted scouting-hub-v2-axis-stars" data-testid="scouting-po-axis-stars">
              PO-Achsen P {formatHalfStar(target.poPow)} · S {formatHalfStar(target.poSpe)} · M {formatHalfStar(target.poMen)} · So{" "}
              {formatHalfStar(target.poSoc)}
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
      {isActive && target.scoutMilestone ? <small className="muted">{target.scoutMilestone}</small> : null}
      <small className="muted">{target.baseInfoSummary}</small>
    </button>
  );
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
  activeScoutTargets,
  bookmarkedTargets = [],
  watchTargets = [],
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
  const rosterGap = rosterMinimum != null && rosterCount < rosterMinimum ? rosterMinimum - rosterCount : 0;
  const resolvedActiveTargets = activeScoutTargets.length > 0 ? activeScoutTargets : watchTargets;

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
              <span className="eyebrow">Scout-Pipeline</span>
              <h3>Aktiv gescoutet</h3>
              {scoutPipeline ? (
                <p className="muted">
                  {scoutPipeline.draftSuspended
                    ? `${resolvedActiveTargets.length} aktiv · Draft ohne Limit`
                    : `${resolvedActiveTargets.length}/${scoutPipeline.maxSlots} Slots · 4 + 3/Stufe · +${scoutPipeline.tickGain} Intel/Spieltag`}
                  {scoutPipeline.passiveActive > 0 ? ` · ${scoutPipeline.passiveActive} passive Scouts` : ""}
                </p>
              ) : null}
            </div>
            {resolvedActiveTargets.length > 0 ? (
              <div className="scouting-hub-v2-target-grid">
                {resolvedActiveTargets.map((target) =>
                  renderScoutTargetCard({
                    target,
                    onOpenPlayer,
                    testId: "scouting-watchlist-card",
                  }),
                )}
              </div>
            ) : (
              <p className="muted">
                {scoutPipeline && scoutPipeline.draftSuspended
                  ? "Noch niemand gemerkt — im Transfermarkt Spieler auf die Wishlist setzen."
                  : "Noch niemand aktiv gescoutet — Wishlist-Spieler erscheinen hier mit Intel-Fortschritt."}
              </p>
            )}
          </section>

          {bookmarkedTargets.length > 0 ? (
            <section className="scouting-hub-v2-watchlist">
              <div className="home-v2-panel-head">
                <span className="eyebrow">Wishlist</span>
                <h3>Nur gemerkt</h3>
                <p className="muted">Über dem Slot-Limit — nicht aktiv gescoutet. Entfernen oder Scouting Office upgraden.</p>
              </div>
              <div className="scouting-hub-v2-target-grid">
                {bookmarkedTargets.map((target) =>
                  renderScoutTargetCard({
                    target,
                    onOpenPlayer,
                    testId: "scouting-bookmarked-target-card",
                  }),
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === "recommended" || activeTab === "reports" ? (
        <section className="scouting-hub-v2-watchlist">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Top Stärken</span>
            <h3>Top 3 Disziplinen (Scouting)</h3>
          </div>
          <div className="scouting-hub-v2-target-grid" data-testid="scouting-top-disciplines">
            {resolvedActiveTargets.slice(0, 3).map((target) => (
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
          <button type="button" className="primary-button inline-button" onClick={onOpenMarket}>
            Transfermarkt öffnen
          </button>
        </section>
      ) : null}
    </div>
  );
}
