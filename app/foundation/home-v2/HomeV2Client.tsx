"use client";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import type { HomeV2ClientProps, HomeV2TopPlayerCard } from "@/app/foundation/home-v2/home-v2-types";

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatNumber(value, 2);
}

function renderStars(level: number, maxLevel: number) {
  return Array.from({ length: maxLevel }, (_, index) => (
    <span key={`star-${index}`} className={index < level ? "is-filled" : ""}>
      ★
    </span>
  ));
}

function getPlayerHighlightLabel(card: HomeV2TopPlayerCard) {
  if (card.highlight === "prospect") return "Hot Prospect";
  if (card.highlight === "top") return "Top Spieler";
  return null;
}

function getGmToneClass(tone: string | null | undefined) {
  if (tone === "hot") return "is-danger";
  if (tone === "watch") return "is-warning";
  if (tone === "new") return "is-info";
  return "is-ready";
}

export default function HomeV2Client({
  teamName,
  teamCode,
  teamLogoUrl,
  teamLogoInitials,
  seasonName,
  matchdayLabel,
  managerLabel,
  controlModeLabel,
  rank,
  points,
  cash,
  salaryTotal,
  guv,
  rosterCount,
  gmStoryLabel,
  gmStoryDetail,
  gmStoryTone,
  boardPressure,
  boardRating,
  boardObjectives,
  nextStepLabel,
  nextStepStatus,
  nextStepDetail,
  warnings,
  topPlayers,
  facilities,
  scheduleItems,
  inboxItems,
  todayCards,
  onContinue,
  onOpenClassicHome,
  onOpenTeams,
  onOpenLineup,
  onOpenMarket,
  onOpenTraining,
  onOpenHq,
  onOpenSeason,
  onOpenInbox,
  onOpenPlayer,
}: HomeV2ClientProps) {
  return (
    <div className="home-v2-shell" data-testid="foundation-home-v2" id="foundation-home-v2">
      <header className="home-v2-header">
        <div className="home-v2-team-identity">
          {teamLogoUrl ? (
            <OptimizedMediaImage className="home-v2-logo" src={teamLogoUrl} alt={`${teamName} Logo`} width={72} height={72} />
          ) : (
            <span className="home-v2-logo team-logo-placeholder">{teamLogoInitials}</span>
          )}
          <div>
            <span className="eyebrow">Manager Overview V2</span>
            <h2>{teamName}</h2>
            <div className="home-v2-meta">
              <span className="pill">{teamCode}</span>
              <span className="pill">{seasonName}</span>
              <span className="pill">{matchdayLabel}</span>
              <span className="pill">{managerLabel}</span>
              <span className="pill">{controlModeLabel}</span>
            </div>
          </div>
        </div>
        <div className="home-v2-header-actions">
          <button type="button" className="secondary-button" onClick={onOpenClassicHome}>
            Classic Home
          </button>
          <button type="button" className="primary-button home-v2-continue" onClick={onContinue}>
            Weiter
          </button>
        </div>
      </header>

      <section className="home-v2-kpi-grid" aria-label="Team KPIs">
        <article className="home-v2-kpi-card">
          <span>Rang</span>
          <strong>{rank != null ? `#${rank}` : "—"}</strong>
        </article>
        <article className="home-v2-kpi-card">
          <span>Punkte</span>
          <strong>{formatNumber(points, 1)}</strong>
        </article>
        <article className="home-v2-kpi-card">
          <span>Cash</span>
          <strong>{formatMoney(cash)}</strong>
        </article>
        <article className="home-v2-kpi-card">
          <span>Gehalt</span>
          <strong>{formatMoney(salaryTotal)}</strong>
        </article>
        <article className="home-v2-kpi-card">
          <span>GuV</span>
          <strong>{formatMoney(guv)}</strong>
        </article>
        <article className="home-v2-kpi-card">
          <span>Kader</span>
          <strong>{rosterCount}</strong>
        </article>
      </section>

      <div className="home-v2-main-grid">
        <section className="home-v2-panel home-v2-next-panel">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Nächster Schritt</span>
            <h3>{nextStepLabel}</h3>
          </div>
          <p className="muted">{nextStepStatus}</p>
          <p>{nextStepDetail}</p>
          {warnings.length > 0 ? (
            <div className="home-v2-warning-row">
              {warnings.map((warning) => (
                <span key={warning} className="transfer-status-pill is-warning">
                  {warning}
                </span>
              ))}
            </div>
          ) : (
            <span className="transfer-status-pill is-ready">Bereit</span>
          )}
          <div className="home-v2-action-row">
            <button type="button" className="primary-button" onClick={onContinue}>
              Weiter
            </button>
            <button type="button" className="secondary-button" onClick={onOpenLineup}>
              Einsatzliste
            </button>
            <button type="button" className="secondary-button" onClick={onOpenMarket}>
              Markt
            </button>
          </div>
        </section>

        <section className="home-v2-panel home-v2-board-panel">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Front Office</span>
            <h3>{gmStoryLabel ?? "Board & GM"}</h3>
          </div>
          <div className="home-v2-board-meta">
            <span className={`transfer-status-pill ${getGmToneClass(gmStoryTone)}`}>
              Druck {boardPressure ?? "—"}/10
            </span>
            <span className="pill">Board {boardRating ?? "—"}/10</span>
          </div>
          <p className="muted">{gmStoryDetail ?? "Kein GM-Signal sichtbar."}</p>
          <button type="button" className="secondary-button inline-button" onClick={onOpenHq}>
            HQ öffnen
          </button>
          {boardObjectives.length > 0 ? (
            <div className="home-v2-objective-list">
              {boardObjectives.slice(0, 4).map((objective) => (
                <article key={objective.objectiveId} className="home-v2-objective-card">
                  <strong>{objective.label}</strong>
                  <span className={`transfer-status-pill${objective.status === "at_risk" || objective.status === "failed" ? " is-warning" : ""}`}>
                    {objective.currentValue ?? "—"} / {objective.targetValue ?? "—"}
                  </span>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="home-v2-top-players" aria-label="Top Spieler">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Kader-Spotlight</span>
            <h3>Top 3 Spieler</h3>
          </div>
          <div className="home-v2-player-grid">
            {topPlayers.length > 0 ? (
              topPlayers.slice(0, 3).map((player, index) => {
                const highlight = getPlayerHighlightLabel(player);
                return (
                  <button
                    key={player.playerId}
                    type="button"
                    className={`home-v2-player-card${index === 0 ? " is-featured" : ""}`}
                    onClick={() => onOpenPlayer(player.playerId)}
                    title={`${player.name} öffnen`}
                  >
                    {highlight ? <span className="home-v2-player-badge">{highlight}</span> : null}
                    {player.portraitUrl ? (
                      <OptimizedMediaImage
                        className="home-v2-player-portrait"
                        src={player.portraitUrl}
                        alt={player.name}
                        width={96}
                        height={96}
                      />
                    ) : (
                      <span className="home-v2-player-portrait is-placeholder">{player.portraitInitials}</span>
                    )}
                    <strong>{player.name}</strong>
                    <small>{player.roleTag ?? "Rolle offen"}</small>
                    <div className="home-v2-player-stats">
                      <span>OVR {formatNumber(player.playerOvr, 1)}</span>
                      <span>PPs {formatNumber(player.playerPps, 1)}</span>
                      <span>MVS {formatNumber(player.playerMvs, 1)}</span>
                    </div>
                    <VeloStatOrbitRow
                      ariaLabel={`${player.name} Bereichswerte`}
                      className="home-v2-player-orbit"
                      stats={{
                        pow: player.ppPow ?? 0,
                        spe: player.ppSpe ?? 0,
                        men: player.ppMen ?? 0,
                        soc: player.ppSoc ?? 0,
                      }}
                    />
                    <small className="muted">
                      MW {formatMoney(player.marketValue)} · LZ {player.contractLength ?? "—"}
                    </small>
                  </button>
                );
              })
            ) : (
              <p className="muted">Noch keine Kaderdaten für Spotlight-Karten.</p>
            )}
          </div>
          <button type="button" className="secondary-button inline-button" onClick={onOpenTeams}>
            Kader öffnen
          </button>
        </section>

        <section className="home-v2-panel home-v2-facilities-panel">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Facilities</span>
            <h3>Infrastruktur</h3>
          </div>
          <div className="home-v2-facility-grid">
            {facilities.map((facility) => (
              <article key={facility.facilityId} className="home-v2-facility-card">
                <strong>{facility.label}</strong>
                <div className="home-v2-stars">{renderStars(facility.level, facility.maxLevel)}</div>
                <small>Lv {facility.level}/{facility.maxLevel}</small>
              </article>
            ))}
          </div>
          <button type="button" className="secondary-button inline-button" onClick={onOpenTraining}>
            Training & Gebäude
          </button>
        </section>

        <section className="home-v2-panel home-v2-schedule-panel">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Schedule</span>
            <h3>Spieltage</h3>
          </div>
          <ul className="home-v2-schedule-list">
            {scheduleItems.map((item) => (
              <li key={item.matchdayId} className={item.isCurrent ? "is-current" : item.isPast ? "is-past" : ""}>
                <strong>{item.label}</strong>
                <span>{item.isCurrent ? "Aktiv" : item.isPast ? "Erledigt" : "Geplant"}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-button inline-button" onClick={onOpenSeason}>
            Saisonstand
          </button>
        </section>

        <section className="home-v2-panel home-v2-inbox-panel">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Inbox</span>
            <h3>Heute wichtig</h3>
          </div>
          <div className="home-v2-today-grid">
            {todayCards.map((card) => (
              <article key={card.key} className={`home-v2-today-card is-${card.tone}`}>
                <span className="eyebrow">{card.kicker}</span>
                <strong>{card.title}</strong>
                <small>{card.detail}</small>
              </article>
            ))}
          </div>
          <ul className="home-v2-inbox-list">
            {inboxItems.length > 0 ? (
              inboxItems.map((item) => (
                <li key={item.id} className={`is-${item.severity}`}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </li>
              ))
            ) : (
              <li className="is-info">
                <strong>Keine harten To-dos</strong>
                <span>Inbox ist ruhig — Flow weiterfahren.</span>
              </li>
            )}
          </ul>
          <button type="button" className="secondary-button inline-button" onClick={onOpenInbox}>
            Inbox öffnen
          </button>
        </section>
      </div>
    </div>
  );
}
