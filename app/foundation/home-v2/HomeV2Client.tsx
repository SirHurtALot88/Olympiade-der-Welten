"use client";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import type { HomeV2ClientProps, HomeV2TopPlayerCard } from "@/app/foundation/home-v2/home-v2-types";
import { HOME_V2_TOP_PLAYER_COUNT } from "@/app/foundation/home-v2/home-v2-types";

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getPlayerHighlightLabel(card: HomeV2TopPlayerCard) {
  if (card.highlight === "prospect") return "Prospect";
  if (card.highlight === "top") return "Top";
  return null;
}

function getPlayerRankFrameClass(index: number) {
  if (index === 0) return " is-rank-gold";
  if (index === 1) return " is-rank-silver";
  if (index === 2) return " is-rank-bronze";
  return "";
}

function getGmToneClass(tone: string | null | undefined) {
  if (tone === "hot") return "is-danger";
  if (tone === "watch") return "is-warning";
  if (tone === "new") return "is-info";
  return "is-ready";
}

function getNextStepToneClass(status: string) {
  if (status.toLowerCase().includes("block")) return "is-warning";
  if (status.toLowerCase().includes("bereit") || status.toLowerCase().includes("ready")) return "is-ready";
  return "is-info";
}

export default function HomeV2Client({
  teamName,
  teamCode,
  teamLogoUrl,
  teamLogoInitials,
  seasonName,
  matchdayLabel,
  controlModeLabel,
  rank,
  points,
  cash,
  salaryTotal,
  guv,
  rosterCount,
  gmStoryLabel,
  gmStoryTone,
  boardPressure,
  boardRating,
  boardObjectives,
  nextStepLabel,
  nextStepStatus,
  warnings,
  topPlayers,
  leagueHeatPools,
  facilities,
  inboxItems,
  inboxCriticalCount = 0,
  todayCards,
  onContinue,
  onOpenLineup,
  onOpenMarket,
  onOpenTraining,
  onOpenOffice,
  onOpenSeason,
  onOpenInbox,
  onOpenBoardObjectives,
  onOpenPlayer,
}: HomeV2ClientProps) {
  const handleTodayCardClick = (key: string) => {
    if (key === "lineup") {
      onOpenLineup();
      return;
    }
    if (key === "team") {
      onOpenSeason();
      return;
    }
    if (key === "tasks") {
      onOpenInbox();
    }
  };

  return (
    <div className="home-v2-shell home-v2-shell-compact" data-testid="foundation-home-v2" id="foundation-home-v2">
      <header className="home-v2-hero">
        <div className="home-v2-hero-main">
          {teamLogoUrl ? (
            <OptimizedMediaImage className="home-v2-logo" src={teamLogoUrl} alt={`${teamName} Logo`} width={64} height={64} />
          ) : (
            <span className="home-v2-logo team-logo-placeholder">{teamLogoInitials}</span>
          )}
          <div className="home-v2-hero-copy">
            <h2>{teamName}</h2>
            <div className="home-v2-hero-meta">
              <span className="pill">{teamCode}</span>
              <span className="pill">{seasonName}</span>
              <span className="pill">{matchdayLabel}</span>
              <span className="pill muted">{controlModeLabel}</span>
            </div>
          </div>
        </div>
        <div className="home-v2-hero-stats" aria-label="Team KPIs">
          <div className="home-v2-hero-stat">
            <span>Rang</span>
            <strong>{rank != null ? `#${rank}` : "—"}</strong>
          </div>
          <div className="home-v2-hero-stat">
            <span>Punkte</span>
            <strong>{formatNumber(points, 1)}</strong>
          </div>
          <div className="home-v2-hero-stat">
            <span>Cash</span>
            <strong>{formatMoney(cash)}</strong>
          </div>
          <div className="home-v2-hero-stat">
            <span>GuV</span>
            <strong>{formatMoney(guv)}</strong>
          </div>
          <div className="home-v2-hero-stat">
            <span>Kader</span>
            <strong>{rosterCount}</strong>
          </div>
          <div className="home-v2-hero-stat is-muted">
            <span>Gehalt</span>
            <strong>{formatMoney(salaryTotal)}</strong>
          </div>
        </div>
        <button type="button" className="primary-button home-v2-continue" onClick={onContinue}>
          Weiter
        </button>
      </header>

      <div className="home-v2-signal-strip" aria-label="Heute">
        {todayCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`home-v2-signal-chip is-${card.tone}`}
            onClick={() => handleTodayCardClick(card.key)}
            title={card.detail}
          >
            <span>{card.kicker}</span>
            <strong>{card.title}</strong>
          </button>
        ))}
        {warnings.slice(0, 2).map((warning) => (
          <span key={warning} className="home-v2-signal-chip is-warning is-static">
            <span>Hinweis</span>
            <strong>{warning}</strong>
          </span>
        ))}
      </div>

      <nav className="home-v2-quick-nav" aria-label="Schnellzugriff">
        <button type="button" className="home-v2-quick-link" onClick={onOpenLineup}>
          Einsatzliste
        </button>
        <button type="button" className="home-v2-quick-link" onClick={onOpenMarket}>
          Transfermarkt
        </button>
        <button type="button" className="home-v2-quick-link" onClick={onOpenTraining}>
          Training
        </button>
        <button type="button" className="home-v2-quick-link" onClick={onOpenOffice}>
          Office
        </button>
        <button type="button" className="home-v2-quick-link" onClick={onOpenSeason}>
          Saisonstand
        </button>
      </nav>

      <div className="home-v2-main-grid home-v2-main-grid-compact">
        <section className="home-v2-top-players" aria-label="Top 6 Spieler">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Kader</span>
            <h3>Top 6 Spieler</h3>
            <p className="muted">Die sechs stärksten Kaderwerte — gleiche Logik wie Disziplin-Top-6 in der Rangtabelle.</p>
          </div>
          <div className="home-v2-player-grid">
            {topPlayers.length > 0 ? (
              topPlayers.slice(0, HOME_V2_TOP_PLAYER_COUNT).map((player, index) => (
                <FoundationPlayerPortraitCard
                  key={player.playerId}
                  playerId={player.playerId}
                  name={player.name}
                  portraitUrl={player.portraitUrl}
                  portraitInitials={player.portraitInitials}
                  playerOvr={player.playerOvr}
                  playerMvs={player.playerMvs}
                  playerPps={player.playerPps}
                  pow={player.pow}
                  spe={player.spe}
                  men={player.men}
                  soc={player.soc}
                  leagueHeatPools={leagueHeatPools}
                  rosterRank={player.rosterRank}
                  highlight={getPlayerHighlightLabel(player)}
                  rankFrameClass={getPlayerRankFrameClass(index)}
                  caRating={player.caRating}
                  poRangeMin={player.poRangeMin}
                  poRangeMax={player.poRangeMax}
                  variant="home"
                  onOpen={() => onOpenPlayer(player.playerId)}
                  title={`${player.name} öffnen · Top-6 Kader #${index + 1}`}
                />
              ))
            ) : (
              <p className="muted">Noch keine Kaderdaten.</p>
            )}
          </div>
        </section>

        <aside className="home-v2-side-stack">
          <section className="home-v2-panel home-v2-next-panel">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Next Play</span>
              <h3 title={nextStepStatus}>{nextStepLabel}</h3>
            </div>
            <span className={`transfer-status-pill ${getNextStepToneClass(nextStepStatus)}`}>{nextStepStatus}</span>
            <button type="button" className="primary-button home-v2-next-button" onClick={onContinue}>
              Weiter
            </button>
          </section>

          <section className="home-v2-panel home-v2-board-panel">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Front Office</span>
              <h3>{gmStoryLabel ?? "Board"}</h3>
            </div>
            <div className="home-v2-board-meta">
              <span className={`transfer-status-pill ${getGmToneClass(gmStoryTone)}`}>
                Druck {boardPressure ?? "—"}
              </span>
              <span className="pill">Board {boardRating ?? "—"}</span>
            </div>
            {boardObjectives.length > 0 ? (
              <div className="home-v2-objective-list">
                {boardObjectives.slice(0, 3).map((objective) => (
                  <button
                    key={objective.objectiveId}
                    type="button"
                    className="home-v2-objective-card"
                    onClick={() => onOpenBoardObjectives?.()}
                  >
                    <strong>{objective.label}</strong>
                    <span className={`transfer-status-pill${objective.status === "at_risk" || objective.status === "failed" ? " is-warning" : ""}`}>
                      {objective.currentValue ?? "—"} / {objective.targetValue ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <button type="button" className="secondary-button inline-button" onClick={onOpenOffice}>
              Office
            </button>
          </section>

          {inboxItems.length > 0 ? (
            <section className="home-v2-panel home-v2-inbox-panel">
              <div className="home-v2-panel-head">
                <span className="eyebrow">Entscheidungen</span>
                <h3>
                  {inboxItems.length} offen
                  {inboxCriticalCount > 0 ? <span className="pill is-warning">{inboxCriticalCount} kritisch</span> : null}
                </h3>
              </div>
              <ul className="home-v2-inbox-list">
                {inboxItems.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button type="button" className="home-v2-inbox-item" onClick={onOpenInbox}>
                      <span className={`foundation-warning-dot is-${item.severity}`} aria-hidden="true" />
                      <span>
                        <strong>{item.title}</strong>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="secondary-button inline-button" onClick={onOpenInbox}>
                Alle Aufgaben
              </button>
            </section>
          ) : null}

          {facilities.length > 0 ? (
            <section className="home-v2-panel home-v2-facilities-panel is-compact">
              <div className="home-v2-panel-head">
                <span className="eyebrow">Facilities</span>
                <h3>Infrastruktur</h3>
              </div>
              <div className="home-v2-facility-row">
                {facilities.map((facility) => (
                  <span key={facility.facilityId} className="home-v2-facility-chip" title={`${facility.label} Lv ${facility.level}`}>
                    <strong>{facility.label.split(" ")[0]}</strong>
                    <small>Lv {facility.level}</small>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
