"use client";

import type { CSSProperties } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import type { HomeV2ClientProps, HomeV2TodayCard, HomeV2TopPlayerCard } from "@/app/foundation/home-v2/home-v2-types";
import { HOME_V2_TOP_PLAYER_COUNT } from "@/app/foundation/home-v2/home-v2-types";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import {
  NlCard,
  NlDeltaChip,
  NlFieldRaceFormStrip,
  NlProgressBar,
  NlRadar,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  nlToneClass,
  useCountUp,
  type NlAxisKey,
  type NlRadarAxis,
  type NlTone,
} from "@/components/foundation/new-look";
import { formatObjectiveStatusLabel } from "@/lib/foundation/tabs/cockpit-ui-helpers";

/**
 * "Neuer Look" Manager-Cockpit für Home V2 (flag-gated, additive).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `HomeV2Client` fällt ohne Flag unverändert auf das bestehende Layout
 * zurück. Konsumiert exakt dieselben Props/Daten wie der alte Client;
 * es gibt keine Zeit-/Uhr-Simulation, daher bewusst keine Countdown- oder
 * "vs. letzte Woche"-Elemente.
 *
 * KPI-Ranking-Drawer (#37, `NlRankingDrawer`): bewusst NICHT hier verdrahtet.
 * "Rang"/"Punkte" sind hier nur der eigene Skalar (kein Zeilen-Array anderer
 * Teams in `HomeV2ClientProps`), und OVR/PPs/MVS laufen über
 * `FoundationPlayerPortraitCard` (kein StatChip in dieser Datei, Komponente
 * gehört nicht zum Wave-4-Scope). Ein Drawer bräuchte hier erfundene Daten —
 * die Chips bleiben deshalb Navigation zu `onOpenSeason`, das die volle
 * Rangliste samt Drawer trägt (`SeasonStandingsNewLook`).
 */

function toFiniteNumber(value: string | number | boolean | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatObjectiveValue(value: string | number | boolean | null): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (typeof value === "number") return formatNlNumber(value, 1);
  return value;
}

function getObjectiveTone(status: string): NlTone {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "good";
  if (normalized === "at_risk" || normalized === "failed") return "risk";
  if (normalized === "blocked") return "warn";
  return "accent";
}

function getGuvTone(guv: number | null): NlTone {
  if (guv == null || !Number.isFinite(guv) || guv === 0) return "neutral";
  return guv > 0 ? "good" : "risk";
}

function getTodayCardTone(tone: HomeV2TodayCard["tone"]): NlTone {
  if (tone === "warning") return "warn";
  if (tone === "ready") return "good";
  return "accent";
}

/* --- Top-6 Portraitkarten: identische Zuordnung wie HomeV2Client --- */
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

/* --- Inline-SVG Icons (kein Emoji) ------------------------------- */
type NlIconProps = { className?: string };

const NL_ICON_SVG_PROPS = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function IconBolt({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2Z" />
    </svg>
  );
}

function IconTarget({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  );
}

function IconTrophy({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 4" />
      <path d="M17 5h3a3 3 0 0 1-3 4" />
      <path d="M12 14v3" />
      <path d="M8 20h8" />
      <path d="M10 17h4v3h-4z" />
    </svg>
  );
}

function IconInboxTray({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M4 5h16v14H4z" />
      <path d="M4 13h5a3 3 0 0 0 6 0h5" />
    </svg>
  );
}

function IconUsers({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14.6c2.3.2 4 1.5 4.5 4" />
    </svg>
  );
}

function IconBuilding({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <path d="M5 21V5l7-2.5V21" />
      <path d="M12 8.5 19 11v10" />
      <path d="M3 21h18" />
      <path d="M8 8h1.2M8 12h1.2M8 16h1.2M15 14h1.2M15 17.5h1.2" />
    </svg>
  );
}

function IconClipboard({ className }: NlIconProps) {
  return (
    <svg {...NL_ICON_SVG_PROPS} className={className}>
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9.5 4.5V3h5v1.5" />
      <path d="M9 10h6M9 13.5h6M9 17h3.5" />
    </svg>
  );
}

/* --- Aufsteiger/Risiken-Zeile (#40): CA/PO-Delta + Potenzialspanne + --- */
/* Kaderrang + Mini-Balken (CA relativ zur Potenzialdecke). Eine          */
/* gemeinsame Zeilen-Komponente für Aufsteiger und Risiken hält beide     */
/* Listen synchron und vermeidet doppelten JSX. */
function DevelopmentPlayerRow({
  player,
  tone,
  onOpenPlayer,
}: {
  player: HomeV2TopPlayerCard;
  tone: Extract<NlTone, "good" | "risk">;
  onOpenPlayer: (playerId: string) => void;
}) {
  const ca = player.caRating;
  const poMin = player.poRangeMin;
  const poMax = player.poRangeMax;
  const delta = (poMax ?? 0) - (ca ?? 0);
  const barMax = Math.max(poMax ?? 0, ca ?? 0, 1);

  return (
    <li>
      <button
        type="button"
        className="nl-home-development-row nl-home-development-row-rich"
        onClick={() => onOpenPlayer(player.playerId)}
        title={`${player.name} öffnen · CA ${formatNlNumber(ca, 0)} · Potenzial ${formatNlNumber(poMin, 0)}–${formatNlNumber(poMax, 0)} · Kaderrang #${player.rosterRank}`}
      >
        <span className="nl-home-development-top">
          <span className="nl-home-development-name">{player.name}</span>
          <span className="nl-home-development-rank nl-tnum">Kaderrang #{player.rosterRank}</span>
        </span>
        <span className="nl-home-development-figures nl-tnum">
          <span className="nl-home-development-ca">CA {formatNlNumber(ca, 0)}</span>
          <NlDeltaChip
            value={delta}
            format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)} PO`}
          />
        </span>
        <NlProgressBar
          className="nl-home-development-bar"
          value={ca ?? 0}
          max={barMax}
          tone={tone}
          showValue={false}
          title={`CA relativ zur Potenzialdecke (${formatNlNumber(poMax, 0)})`}
        />
        <span className="nl-home-development-range nl-tnum">
          Potenzial {formatNlNumber(poMin, 0)}–{formatNlNumber(poMax, 0)}
        </span>
      </button>
    </li>
  );
}

function getTodayCardIcon(key: string) {
  if (key === "lineup") return <IconClipboard />;
  if (key === "tasks") return <IconInboxTray />;
  if (key === "team") return <IconTrophy />;
  return <IconBolt />;
}

export default function HomeV2NewLook({
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
  loanInstallment,
  outstandingDebt,
  rosterCount,
  fieldRaceForm,
  fieldRacePlayedMatchdays,
  fieldRaceTotalTeams,
  fieldRaceRankMovement,
  boardPressure,
  boardRating,
  boardObjectives,
  nextStepLabel,
  nextStepStatus,
  nextStepDetail,
  nextStepBlocked = false,
  warnings,
  showTeamPickerCta = false,
  onOpenTeamPicker,
  topPlayers,
  leagueHeatPools,
  facilities,
  scheduleItems,
  inboxItems,
  inboxCriticalCount = 0,
  todayCards,
  onContinue,
  onOpenLineup,
  onOpenTeams,
  onOpenSeason,
  onOpenOffice,
  onOpenFacilities,
  onOpenInbox,
  onCompleteInboxItem,
  onOpenBoardObjectives,
  onOpenPlayer,
}: HomeV2ClientProps) {
  const visibleTodayCards = todayCards.slice(0, 3);
  // `no_active_team` / `season_started_no_results` are filtered by the host
  // (see HOME_HIDDEN_WARNING_KEYS in lib/foundation/tabs/cockpit-ui-helpers.ts)
  // BEFORE the raw keys are mapped to German labels, so `warnings` here is
  // already the display-ready list.
  const relevantWarnings = warnings;

  // D2 Feld-relative Rang-KPI: "#{rank} von {total} · Top {pct}%". Perzentil aus
  // Rang/Feldgröße (Beispiel: #31 von 32 → Top 97%). Fog-sicher — nur die
  // öffentliche Feldgröße und der eigene Rang, keine fremden Werte.
  const fieldRankPercentile =
    rank != null && fieldRaceTotalTeams != null && fieldRaceTotalTeams > 0
      ? Math.max(1, Math.min(100, Math.round((rank / fieldRaceTotalTeams) * 100)))
      : null;
  const rankFieldSub =
    rank != null && fieldRaceTotalTeams != null && fieldRaceTotalTeams > 0
      ? `von ${formatNlNumber(fieldRaceTotalTeams, 0)}${fieldRankPercentile != null ? ` · Top ${fieldRankPercentile}%` : ""}`
      : undefined;
  // D4 Rang-Movement (Δ vs. letzter Spieltag): >0 ▲ Plätze gut, <0 ▼. Am ersten
  // Spieltag (kein Vorwert) bewusst "neu" statt eines erfundenen Deltas.
  const isFirstFieldRaceMatchday = (fieldRacePlayedMatchdays ?? 0) <= 1;

  // Hero-/KPI-Zähler (#Wave2): nur die Headline-Zahlen zählen hoch — Tabellen
  // und Listen bleiben unverändert. Fixe Anzahl Top-Level-Hooks (kein Loop),
  // respektiert prefers-reduced-motion via `useCountUp`.
  const animatedRank = useCountUp(rank);
  const animatedCash = useCountUp(cash);
  const animatedGuv = useCountUp(guv);
  const animatedPoints = useCountUp(points);
  const animatedRosterCount = useCountUp(rosterCount, { durationMs: 700 });
  const animatedSalaryTotal = useCountUp(salaryTotal);
  const animatedLoanInstallment = useCountUp(loanInstallment);
  const hasActiveLoan = loanInstallment != null && loanInstallment > 0;

  // Team-Achsenprofil (#50): Durchschnitt der vier Spiel-Achsen über die
  // Top-Kader-Spieler — nur reale, endliche Werte, fehlende Achsen fallen
  // raus. Radar wird nur gerendert, wenn mindestens eine Achse ableitbar ist.
  const teamAxisProfile: NlRadarAxis[] = (["pow", "spe", "men", "soc"] as NlAxisKey[])
    .map((key) => {
      const values = topPlayers
        .map((player) => player[key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      if (values.length === 0) {
        return null;
      }
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return { key, value: Math.round(average) } satisfies NlRadarAxis;
    })
    .filter((axis): axis is NlRadarAxis => axis !== null);

  // Entwicklungs-Highlights (#51): Aufsteiger = Potenzial deutlich über
  // aktueller Klasse (CA), Risiken = aktuelle Klasse über Potenzial.
  // Gleiche Schwellen wie im bestehenden HomeV2Client.
  const developmentWinners = topPlayers
    .filter((player) => (player.poRangeMax ?? 0) > (player.caRating ?? 0) + 4)
    .slice(0, 3);
  const developmentRisks = topPlayers
    .filter((player) => (player.caRating ?? 0) > (player.poRangeMax ?? 0) + 2)
    .slice(0, 3);
  const hasDevelopmentHighlights = developmentWinners.length > 0 || developmentRisks.length > 0;

  // Saisonstand-Kachel (Redundanz-Abbau #40): Rang/Punkte/GuV stehen
  // bereits im Hero oben — hier stattdessen echte, dort nicht gezeigte
  // Kennzahlen aus scheduleItems ableiten statt die Hero-Chips zu
  // wiederholen.
  const playedMatchdayCount = scheduleItems.filter((item) => item.isPast || item.isCurrent).length;
  const pointsPerMatchday = points != null && playedMatchdayCount > 0 ? points / playedMatchdayCount : null;
  const remainingMatchdayCount = scheduleItems.length > 0 ? scheduleItems.length - playedMatchdayCount : null;

  // Gleiche Ziel-Zuordnung wie im bestehenden HomeV2Client.
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
    <div className="nl-home" data-testid="foundation-home-v2" id="foundation-home-v2" data-new-look="true">
      {/* FM26-inspiriertes Bento-Raster: variabel große Kacheln statt
          gleichförmig gestapelter Karten. Rein visuelle Reorganisation —
          alle Daten, Zähler, Reveal-Stagger und Interaktionen bleiben
          identisch; nur der äußere Container ist jetzt ein Grid. */}
      <div className="nl-home-bento">
      {/* --- Hero: NlCard-Kopfkarte (große Bento-Kachel, volle Breite) --- */}
      <NlCard
        className="nl-home-hero-card nl-bento-item nl-bento-span-12 nl-bento-hero"
        data-testid="nl-home-hero"
        actions={
          <div className="nl-home-hero-next">
            {/* CC7: the "Weiter · …" advance action is rendered once in the global
                top-bar (foundation-global-next-button, wired to triggerGlobalNext).
                The hero no longer duplicates that button — it only surfaces the
                current flow status so the richer context stays without a second
                advance control. */}
            <span className="nl-home-next-status" title={nextStepDetail}>{nextStepStatus}</span>
            {nextStepBlocked ? (
              <span className={`nl-home-next-reason ${nlToneClass("warn")}`}>{nextStepDetail}</span>
            ) : null}
          </div>
        }
      >
        <div className="nl-home-hero-body">
          <div className="nl-home-hero-identity">
            {teamLogoUrl ? (
              <OptimizedMediaImage className="nl-home-hero-logo" src={teamLogoUrl} alt={`${teamName} Logo`} width={56} height={56} />
            ) : (
              <span className="nl-home-hero-logo nl-home-hero-logo-fallback" role="img" aria-label={`${teamName} Logo`}>{teamLogoInitials}</span>
            )}
            <div className="nl-home-hero-copy">
              <span className="nl-home-eyebrow">{seasonName} · {matchdayLabel}</span>
              <h2 className="nl-home-hero-title">{teamName}</h2>
              <p className="nl-home-hero-meta">{teamCode} · {controlModeLabel}</p>
            </div>
          </div>

          <StatChipRow className="nl-home-hero-kpis" aria-label="Team KPIs">
            <span className="nl-home-rank-portal">
              <StatChip
                label="Rang"
                value={rank != null ? `#${formatNlNumber(animatedRank ?? rank, 0)}` : "—"}
                tone="accent"
                sub={rankFieldSub}
                onClick={onOpenSeason}
                title={
                  rankFieldSub
                    ? `Rang ${rank} von ${fieldRaceTotalTeams} im Feld — zum Saisonstand`
                    : "Zum Saisonstand"
                }
              />
              {fieldRaceRankMovement != null ? (
                <NlDeltaChip
                  value={fieldRaceRankMovement}
                  format={(n) => (n === 0 ? "±0" : `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`)}
                  title="Rang-Bewegung gegenüber dem letzten Spieltag"
                  className="nl-home-rank-move"
                />
              ) : rank != null && isFirstFieldRaceMatchday ? (
                <span
                  className="nl-home-rank-move is-new nl-tnum"
                  title="Erster Spieltag — noch keine Rang-Bewegung"
                >
                  neu
                </span>
              ) : null}
            </span>
            <StatChip
              label="Cash"
              value={formatNlMoney(animatedCash ?? cash)}
              onClick={onOpenOffice}
              title="Zum Front Office"
            />
          </StatChipRow>

          {fieldRaceForm != null ? (
            <NlFieldRaceFormStrip
              entries={fieldRaceForm}
              playedMatchdayCount={fieldRacePlayedMatchdays}
              compact
              className="nl-home-hero-form"
            />
          ) : null}

          <StatChipRow className="nl-home-hero-chips" aria-label="Weitere Team-Kennzahlen">
            <StatChip label="GuV" value={formatNlMoney(animatedGuv ?? guv)} tone={getGuvTone(guv)} onClick={onOpenOffice} title="Gewinn und Verlust — zum Front Office" />
            <StatChip label="Saisonpunkte" value={formatNlNumber(animatedPoints ?? points, 1)} tone="accent" onClick={onOpenSeason} title="Saison-Punktestand — identisch zum Saisonstand" />
            <StatChip label="Kader" value={formatNlNumber(animatedRosterCount ?? rosterCount, 0)} onClick={onOpenTeams} title="Zum Kader" />
            <StatChip label="Gehalt" value={formatNlMoney(animatedSalaryTotal ?? salaryTotal)} onClick={onOpenOffice} title="Gehaltsbudget — zum Front Office" />
            {hasActiveLoan ? (
              <StatChip
                label="Kreditrate"
                value={formatNlMoney(animatedLoanInstallment ?? loanInstallment)}
                tone="warn"
                onClick={onOpenOffice}
                sub={
                  outstandingDebt != null && outstandingDebt > 0
                    ? `Restschuld ${formatNlMoney(outstandingDebt)}`
                    : undefined
                }
                title="Jährliche Kreditrate — zum Front Office"
              />
            ) : null}
          </StatChipRow>
        </div>
      </NlCard>

      {showTeamPickerCta ? (
        <NlCard
          className="nl-home-team-picker-cta"
          data-testid="home-team-picker-cta"
          eyebrow="Erster Schritt"
          title="Wähle dein Team"
          actions={
            <button type="button" className="primary-button" onClick={onOpenTeamPicker}>
              Team wählen
            </button>
          }
        >
          <p>
            Noch steuert kein Team dieses Save. Wähle dein Team in den Team-Einstellungen, um Kader,
            Transfers und Aufstellung selbst zu übernehmen.
          </p>
        </NlCard>
      ) : null}

      {relevantWarnings.length > 0 ? (
        <div className="nl-home-warning-row nl-bento-item nl-bento-span-12" aria-label="Hinweise">
          {relevantWarnings.slice(0, 3).map((warning) => (
            <span key={warning} className={`nl-home-warning-chip ${nlToneClass("warn")}`}>{warning}</span>
          ))}
        </div>
      ) : null}

      {/* --- Spieltag-Rail: Saisonpfad (vergangen · aktuell · kommend) --- */}
      {scheduleItems.length > 0 ? (
        <nav className="nl-home-schedule-rail nl-bento-item nl-bento-span-12" aria-label="Saisonpfad">
          <ol className="nl-home-schedule-track">
            {scheduleItems.map((item) => {
              const state = item.isCurrent ? "is-current" : item.isPast ? "is-past" : "is-upcoming";
              const stateLabel = item.isCurrent ? "aktuell" : item.isPast ? "gespielt" : "kommend";
              return (
                <li
                  key={item.matchdayId}
                  className={`nl-home-schedule-node ${state}`}
                  aria-current={item.isCurrent ? "step" : undefined}
                  title={`${item.label} · ${stateLabel}`}
                >
                  <span className="nl-home-schedule-dot" aria-hidden="true" />
                  <span className="nl-home-schedule-label">{item.label}</span>
                  <span className="sr-only">{stateLabel}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      {/* --- Heute wichtig: klickbare Entscheidungs-Karten als Bento-
          Kacheln (erste Karte breiter/„primär", die übrigen kompakt) --- */}
      <div className="nl-home-section-head nl-bento-item nl-bento-span-12 nl-bento-head" aria-label="Heute wichtig">
        <span className="nl-home-section-icon"><IconBolt /></span>
        <h3 className="nl-home-section-title">Heute wichtig</h3>
      </div>
      {visibleTodayCards.map((card, index) => (
        <div
          key={card.key}
          className={`nl-reveal nl-bento-item ${index === 0 ? "nl-bento-span-6" : "nl-bento-span-3"}`}
          style={{ "--nl-reveal-i": index } as CSSProperties}
        >
              <NlCard
                interactive
                onClick={() => handleTodayCardClick(card.key)}
                className={`nl-home-today-card ${nlToneClass(getTodayCardTone(card.tone))}${index === 0 ? " is-primary" : ""}`}
                eyebrow={
                  <span className="nl-home-today-kicker">
                    {getTodayCardIcon(card.key)}
                    {index + 1}. {card.kicker}
                  </span>
                }
                title={card.title}
                data-testid={`nl-home-today-card-${card.key}`}
              >
                <p className="nl-home-today-detail">{card.detail}</p>
              </NlCard>
            </div>
          ))}

      {/* --- Top-Kader: Top-6 Portraitkarten (volle Bento-Breite) --- */}
      <section className="nl-home-section nl-bento-item nl-bento-span-12" aria-label="Top-Kader">
        <div className="nl-home-section-head">
          <span className="nl-home-section-icon"><IconUsers /></span>
          <h3 className="nl-home-section-title">Top-Kader · Deine besten 6</h3>
          <span className="nl-home-section-hint" title="Reihenfolge: Rolle (Stammspieler zuerst), dann Saisonleistung (PPs), MVS und OVR">
            sortiert nach Rolle &amp; Saisonleistung
          </span>
        </div>
        {topPlayers.length > 0 ? (
          <div className="nl-home-portrait-grid">
            {topPlayers.slice(0, HOME_V2_TOP_PLAYER_COUNT).map((player, index) => (
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
                newLook
                known
                caStars={player.caStars}
                poStars={player.poStars}
                portraitLoading={index < 2 ? "eager" : "lazy"}
                portraitFetchPriority={index < 2 ? "high" : "auto"}
                onOpen={() => onOpenPlayer(player.playerId)}
                title={`${player.name} öffnen · Top-6 Kader #${index + 1}`}
              />
            ))}
          </div>
        ) : (
          <p className="nl-home-empty-note">Noch keine Kaderdaten.</p>
        )}
      </section>

      {/* --- Team-Profil (#50) & Entwicklung (#51) — als Bento-Kacheln:
          Radar als hohe Feature-Kachel (2 Rasterzeilen), Aufsteiger/
          Risiken als breitere Nebenkachel. --------------------------- */}
      {teamAxisProfile.length > 0 || hasDevelopmentHighlights ? (
        <>
          <div className="nl-home-section-head nl-bento-item nl-bento-span-12 nl-bento-head" aria-label="Team-Profil und Entwicklung">
            <span className="nl-home-section-icon"><IconTarget /></span>
            <h3 className="nl-home-section-title">Team-Profil &amp; Entwicklung</h3>
          </div>
            {teamAxisProfile.length > 0 ? (
              <NlCard
                className="nl-home-radar-card nl-home-radar-card-hero nl-bento-item nl-bento-span-5 nl-bento-tall"
                eyebrow={<span className="nl-home-card-eyebrow-icon"><IconUsers /> Achsen-Profil</span>}
                title="Team-Stärke"
                data-testid="nl-home-team-radar"
              >
                <div className="nl-home-radar-wrap nl-home-radar-wrap-hero">
                  <NlRadar axes={teamAxisProfile} showValues aria-label="Team-Achsenprofil POW, SPE, MEN, SOC" />
                </div>
                <p className="nl-home-radar-note">Ø der Top-{topPlayers.length} nach POW · SPE · MEN · SOC</p>
              </NlCard>
            ) : null}

            {hasDevelopmentHighlights ? (
              <NlCard
                className="nl-home-development-card nl-bento-item nl-bento-span-7"
                eyebrow={<span className="nl-home-card-eyebrow-icon"><IconBolt /> Entwicklung</span>}
                title="Aufsteiger &amp; Risiken"
                data-testid="nl-home-development"
              >
                <div className="nl-home-development-groups">
                  {developmentWinners.length > 0 ? (
                    <div className="nl-home-development-group">
                      <span className={`nl-home-development-heading ${nlToneClass("good")}`}>Aufsteiger</span>
                      <ul className="nl-home-development-list">
                        {developmentWinners.map((player) => (
                          <DevelopmentPlayerRow key={player.playerId} player={player} tone="good" onOpenPlayer={onOpenPlayer} />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {developmentRisks.length > 0 ? (
                    <div className="nl-home-development-group">
                      <span className={`nl-home-development-heading ${nlToneClass("risk")}`}>Risiken</span>
                      <ul className="nl-home-development-list">
                        {developmentRisks.map((player) => (
                          <DevelopmentPlayerRow key={player.playerId} player={player} tone="risk" onOpenPlayer={onOpenPlayer} />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </NlCard>
            ) : null}
        </>
      ) : null}

        {/* --- Board-Ziele: echte current/target als ProgressBar ----- */}
        <NlCard
          className="nl-home-board-card nl-bento-item nl-bento-span-5"
          eyebrow={<span className="nl-home-card-eyebrow-icon"><IconTarget /> Front Office</span>}
          title="Board-Ziele"
          actions={
            <span className="nl-home-board-meta nl-tnum">
              Druck {boardPressure ?? "—"} · Board {boardRating ?? "—"}
            </span>
          }
        >
          {boardObjectives.length > 0 ? (
            <div className="nl-home-objective-list">
              {boardObjectives.slice(0, 4).map((objective) => {
                const current = toFiniteNumber(objective.currentValue);
                const target = toFiniteNumber(objective.targetValue);
                const tone = getObjectiveTone(objective.status);
                return (
                  <button
                    key={objective.objectiveId}
                    type="button"
                    className="nl-home-objective-row"
                    onClick={() => onOpenBoardObjectives?.()}
                    title={`${objective.label} — ${formatObjectiveStatusLabel(objective.status)}`}
                  >
                    {current != null && target != null && target > 0 ? (
                      <NlProgressBar
                        label={
                          tone === "risk" || tone === "warn"
                            ? `${objective.label} · ${formatObjectiveStatusLabel(objective.status)}`
                            : objective.label
                        }
                        value={current}
                        max={target}
                        tone={tone}
                        format={(value, max) => `${formatNlNumber(value, 1)} / ${formatNlNumber(max, 1)}`}
                      />
                    ) : (
                      <span className="nl-home-objective-fallback">
                        <span className="nl-home-objective-label">{objective.label}</span>
                        <span className={`nl-home-objective-status ${nlToneClass(tone)}`}>
                          {formatObjectiveValue(objective.currentValue)} / {formatObjectiveValue(objective.targetValue)} · {formatObjectiveStatusLabel(objective.status)}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="nl-home-empty-note">Noch keine Board-Ziele hinterlegt.</p>
          )}
        </NlCard>

        {/* --- Liga-Kurzkarte: Rang + Punkte, klick -> Saisonstand ---- */}
        <NlCard
          className="nl-home-league-card nl-bento-item nl-bento-span-3"
          interactive
          onClick={onOpenSeason}
          eyebrow={<span className="nl-home-card-eyebrow-icon"><IconTrophy /> Liga</span>}
          title="Saisonstand"
          actions={<span className="nl-home-card-link">Zum Saisonstand →</span>}
          data-testid="nl-home-league-card"
        >
          <div className="nl-home-league-body">
            {/* Rang/Punkte/GuV stehen bereits oben im Hero — hier bewusst
                keine Wiederholung, sondern daraus abgeleitete Kennzahlen. */}
            <StatChipRow aria-label="Saison-Kennzahlen">
              <StatChip
                label="Ø Punkte/Spieltag"
                value={pointsPerMatchday != null ? formatNlNumber(pointsPerMatchday, 2) : "—"}
                tone="accent"
                title="Punkte geteilt durch bereits gespielte Spieltage"
              />
              <StatChip
                label="Verbleibend"
                value={remainingMatchdayCount != null ? formatNlNumber(remainingMatchdayCount, 0) : "—"}
                sub="Spieltage"
                title="Verbleibende Spieltage bis Saisonende"
              />
            </StatChipRow>
          </div>
        </NlCard>

        {/* --- Entscheidungen: offene Inbox-Items mit Checkoff -------- */}
        <NlCard
          className="nl-home-inbox-card nl-bento-item nl-bento-span-4"
          eyebrow={<span className="nl-home-card-eyebrow-icon"><IconInboxTray /> Entscheidungen</span>}
          title={
            <span className="nl-home-inbox-title">
              {inboxItems.length} offen
              {inboxCriticalCount > 0 ? (
                <span className={`nl-home-critical-pill ${nlToneClass("risk")}`}>{inboxCriticalCount} kritisch</span>
              ) : null}
            </span>
          }
          actions={
            <button type="button" className="nl-home-card-link-button" onClick={onOpenInbox}>
              Alle Aufgaben →
            </button>
          }
        >
          {inboxItems.length > 0 ? (
            <ul className="nl-home-inbox-list">
              {inboxItems.slice(0, 3).map((item) => (
                <li key={item.id} className="nl-home-inbox-row">
                  <button type="button" className={`nl-home-inbox-item ${nlToneClass(item.severity === "critical" ? "risk" : item.severity === "warning" ? "warn" : "accent")}`} onClick={onOpenInbox}>
                    <span className="nl-home-inbox-dot" aria-hidden="true" />
                    <span className="sr-only">{item.severity === "critical" ? "kritisch" : item.severity === "warning" ? "Warnung" : "Info"}: </span>
                    <span className="nl-home-inbox-copy">
                      <strong>{item.title}</strong>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </span>
                  </button>
                  {onCompleteInboxItem ? (
                    <button
                      type="button"
                      className="nl-home-inbox-checkoff"
                      data-testid={`home-v2-inbox-checkoff-${item.id}`}
                      aria-label={`${item.title} erledigt`}
                      title="Als erledigt abhaken"
                      onClick={() => onCompleteInboxItem(item.id)}
                    >
                      <svg {...NL_ICON_SVG_PROPS} width={14} height={14}>
                        <path d="m4.5 12.5 5 5L19.5 7" />
                      </svg>
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="nl-home-empty-note">Alles erledigt — keine offenen Entscheidungen.</p>
          )}
        </NlCard>

        {/* --- Infrastruktur: reale Facility-Level -------------------- */}
        {facilities.length > 0 ? (
          <NlCard
            className="nl-home-facility-card nl-bento-item nl-bento-span-12"
            eyebrow={<span className="nl-home-card-eyebrow-icon"><IconBuilding /> Gebäude</span>}
            title="Infrastruktur"
            onClick={onOpenFacilities}
          >
            <StatChipRow aria-label="Facility-Level">
              {facilities.map((facility) => (
                <StatChip
                  key={facility.facilityId}
                  label={facility.label.split(" ")[0]}
                  value={`Lv ${facility.level}`}
                  sub={`max ${facility.maxLevel}`}
                  title={`${facility.label} — Level ${facility.level} von ${facility.maxLevel}`}
                />
              ))}
            </StatChipRow>
          </NlCard>
        ) : null}
      </div>
    </div>
  );
}
