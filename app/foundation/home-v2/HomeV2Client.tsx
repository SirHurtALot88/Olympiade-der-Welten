"use client";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { FoundationButton } from "@/components/foundation/FoundationButton";
import { FoundationCard } from "@/components/foundation/FoundationCard";
import { EmptyState } from "@/components/foundation/EmptyState";
import FoundationGameDecisionBoard from "@/components/foundation/modern-game/FoundationGameDecisionBoard";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import HomeV2NewLook from "@/app/foundation/home-v2/HomeV2NewLook";
import type { HomeV2ClientProps, HomeV2TopPlayerCard } from "@/app/foundation/home-v2/home-v2-types";
import { HOME_V2_TOP_PLAYER_COUNT } from "@/app/foundation/home-v2/home-v2-types";
import { useNewLook } from "@/lib/ui/new-look-preference";

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
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function getPlayerHighlightLabel(card: HomeV2TopPlayerCard) {
  if (card.highlight === "prospect") return "Talent";
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

function buildDevelopmentHighlights(topPlayers: HomeV2TopPlayerCard[]) {
  const winners = topPlayers
    .filter((player) => (player.poRangeMax ?? 0) > (player.caRating ?? 0) + 4)
    .slice(0, 3);
  const risks = topPlayers
    .filter((player) => (player.caRating ?? 0) > (player.poRangeMax ?? 0) + 2)
    .slice(0, 3);
  return { winners, risks };
}

export default function HomeV2Client(props: HomeV2ClientProps) {
  // "Neuer Look" Flag-Gate (additiv): Flag an => neues Cockpit mit
  // denselben Props; Flag aus => bestehendes Layout unverändert.
  const [newLook] = useNewLook();
  if (newLook) return <HomeV2NewLook {...props} />;

  const {
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
    onCompleteInboxItem,
    onOpenBoardObjectives,
    onOpenPlayer,
  } = props;
  const visibleTodayCards = todayCards.slice(0, 3);
  const primaryTodayCard = visibleTodayCards[0] ?? null;
  const developmentHighlights = buildDevelopmentHighlights(topPlayers);

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

  const relevantWarnings = warnings.filter(
    (warning) => !["no_active_team", "season_started_no_results"].includes(warning),
  );

  return (
    <div className="home-v2-shell home-v2-shell-compact modern-game-shell" data-testid="foundation-home-v2" id="foundation-home-v2">
      <header className="home-v2-hero">
        <div className="home-v2-hero-main">
          {teamLogoUrl ? (
            <OptimizedMediaImage className="home-v2-logo" src={teamLogoUrl} alt={`${teamName} Logo`} width={64} height={64} />
          ) : (
            <span className="home-v2-logo team-logo-placeholder">{teamLogoInitials}</span>
          )}
          <div className="home-v2-hero-copy">
            <span className="eyebrow">{seasonName} · {matchdayLabel}</span>
            <h2>{teamName}</h2>
            <p className="muted">{teamCode} · {controlModeLabel}</p>
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
        <FoundationButton className="home-v2-continue" onClick={onContinue}>
          Weiter · {nextStepLabel}
        </FoundationButton>
      </header>

      <FoundationGameDecisionBoard
        title="Heute wichtig"
        subtitle="Priorisiert nach Dringlichkeit — FM-Style Next Actions"
        testId="home-v2-today-board"
        stats={visibleTodayCards.map((card) => ({
          id: card.key,
          label: card.kicker,
          value: card.title,
          detail: card.detail,
          tone: card.tone === "warning" ? "warning" : card.tone === "ready" ? "ready" : "info",
        }))}
        actions={
          <FoundationButton variant="secondary" className="inline-button" onClick={() => handleTodayCardClick(primaryTodayCard?.key ?? "lineup")}>
            Zum ersten Schritt
          </FoundationButton>
        }
      />

      <div className="home-v2-signal-strip modern-game-today-chips" aria-label="Schnellaktionen">
        {visibleTodayCards.map((card, index) => (
          <button
            key={card.key}
            type="button"
            className={`home-v2-signal-chip is-${card.tone}${index === 0 ? " is-primary" : ""}`}
            onClick={() => handleTodayCardClick(card.key)}
            title={card.detail}
          >
            <span>{index + 1}. {card.kicker}</span>
            <strong>{card.title}</strong>
          </button>
        ))}
        {relevantWarnings.slice(0, 1).map((warning) => (
          <span key={warning} className="home-v2-signal-chip is-warning is-static">
            <span>Hinweis</span>
            <strong>{warning.replaceAll("_", " ")}</strong>
          </span>
        ))}
      </div>

      <div className="home-v2-main-grid home-v2-main-grid-compact">
        <section className="home-v2-top-players" aria-label="Top 6 Spieler">
          <div className="home-v2-panel-head">
            <span className="eyebrow">Kader</span>
            <h3>Top 6 Spieler</h3>
            <p className="muted">Stärkste Kaderwerte — Karten wie in Teams & Einsatzliste.</p>
          </div>
          <div className="home-v2-player-grid">
            {topPlayers.length > 0 ? (
              topPlayers.slice(0, HOME_V2_TOP_PLAYER_COUNT).map((player, index) => (
                <FoundationPlayerPortraitCard
                  key={player.playerId}
                  playerId={player.playerId}
                  name={player.name}
                  portraitUrl={player.portraitUrl}
                  portraitPlaceholderUrl={player.portraitPlaceholderUrl}
                  portraitInitials={player.portraitInitials}
                  playerOvr={player.playerOvr}
                  playerMvs={player.playerMvs}
                  playerPps={player.playerPps}
                  ovrRank={player.ovrRank}
                  mvsRank={player.mvsRank}
                  ppsRank={player.ppsRank}
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
                  context="teamGrid"
                  portraitLoading={index < 2 ? "eager" : "lazy"}
                  portraitFetchPriority={index < 2 ? "high" : "auto"}
                  onOpen={() => onOpenPlayer(player.playerId)}
                  title={`${player.name} öffnen · Top-6 Kader #${index + 1}`}
                />
              ))
            ) : (
              <EmptyState
                title="Noch keine Kaderdaten"
                text="Sobald das Team geladen ist, erscheinen hier die wichtigsten Kaderkarten."
                actionLabel="Weiter"
                onAction={onContinue}
              />
            )}
          </div>
        </section>

        <aside className="home-v2-side-stack">
          <FoundationCard as="section" variant="panel" className="home-v2-panel home-v2-next-panel modern-game-next-panel">
            <div className="home-v2-panel-head">
              <span className="eyebrow">Nächster Zug</span>
              <h3 title={nextStepStatus}>{nextStepLabel}</h3>
            </div>
            <span className={`transfer-status-pill ${getNextStepToneClass(nextStepStatus)}`}>{nextStepStatus}</span>
            <p className="muted">{primaryTodayCard?.detail ?? "„Weiter“ oben springt direkt zur empfohlenen Aktion."}</p>
          </FoundationCard>

          <FoundationCard as="section" variant="panel" className="home-v2-panel home-v2-board-panel">
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
          </FoundationCard>

          {(developmentHighlights.winners.length > 0 || developmentHighlights.risks.length > 0) ? (
            <FoundationCard as="section" variant="panel" className="home-v2-panel home-v2-development-panel">
              <div className="home-v2-panel-head">
                <span className="eyebrow">Entwicklung</span>
                <h3>Gewinner & Risiko</h3>
              </div>
              <div className="home-v2-development-split is-sidebar">
                {developmentHighlights.winners.length > 0 ? (
                  <div className="home-v2-development-column">
                    <span className="home-v2-development-label">Gewinner</span>
                    <ul className="home-v2-development-list">
                      {developmentHighlights.winners.map((player) => (
                        <li key={player.playerId}>
                          <button type="button" className="home-v2-development-item" onClick={() => onOpenPlayer(player.playerId)}>
                            <span>{player.name}</span>
                            <small className="muted">
                              CA {formatNumber(player.caRating, 0)} · PO {formatNumber(player.poRangeMax, 0)}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {developmentHighlights.risks.length > 0 ? (
                  <div className="home-v2-development-column">
                    <span className="home-v2-development-label">Risiko</span>
                    <ul className="home-v2-development-list">
                      {developmentHighlights.risks.map((player) => (
                        <li key={player.playerId}>
                          <button type="button" className="home-v2-development-item" onClick={() => onOpenPlayer(player.playerId)}>
                            <span>{player.name}</span>
                            <small className="muted">
                              CA {formatNumber(player.caRating, 0)} · Deckung {formatNumber(player.poRangeMax, 0)}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </FoundationCard>
          ) : null}

          {inboxItems.length > 0 ? (
            <FoundationCard as="section" variant="panel" className="home-v2-panel home-v2-inbox-panel">
              <div className="home-v2-panel-head">
                <span className="eyebrow">Entscheidungen</span>
                <h3>
                  {inboxItems.length} offen
                  {inboxCriticalCount > 0 ? <span className="pill is-warning">{inboxCriticalCount} kritisch</span> : null}
                </h3>
              </div>
              <ul className="home-v2-inbox-list">
                {inboxItems.slice(0, 3).map((item) => (
                  <li key={item.id} className="home-v2-inbox-row">
                    <button type="button" className="home-v2-inbox-item" onClick={onOpenInbox}>
                      <span className={`foundation-warning-dot is-${item.severity}`} aria-hidden="true" />
                      <span>
                        <strong>{item.title}</strong>
                        {item.detail ? <small className="muted">{item.detail}</small> : null}
                      </span>
                    </button>
                    {onCompleteInboxItem ? (
                      <button
                        type="button"
                        className="home-v2-inbox-checkoff"
                        data-testid={`home-v2-inbox-checkoff-${item.id}`}
                        aria-label={`${item.title} erledigt`}
                        title="Als erledigt abhaken"
                        onClick={() => onCompleteInboxItem(item.id)}
                      >
                        ✓
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <FoundationButton variant="secondary" className="inline-button" onClick={onOpenInbox}>
                Alle Aufgaben
              </FoundationButton>
            </FoundationCard>
          ) : null}

          {facilities.length > 0 ? (
            <FoundationCard as="section" variant="panel" className="home-v2-panel home-v2-facilities-panel is-compact">
              <div className="home-v2-panel-head">
                <span className="eyebrow">Gebäude</span>
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
            </FoundationCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
