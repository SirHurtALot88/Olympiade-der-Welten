"use client";

import type { Team } from "@/lib/data/olyDataTypes";
import type { TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";

type TeamsV2FocusCard = {
  label: string;
  value: string;
  note: string;
  detail: string;
  tone: "salary" | "value" | "training" | "contract";
};

type TeamsV2ClientProps = {
  teams: Team[];
  selectedTeam: Team;
  selectedTeamControlMode?: string | null;
  teamData: TeamDetailDrawerData;
  focusCards: TeamsV2FocusCard[];
  onSelectTeam: (teamId: string) => void;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenClassicTeams?: (() => void) | null;
  onOpenTraining?: (() => void) | null;
  onOpenMarket?: (() => void) | null;
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatNumber(value, 2);
}

function getFocusToneClass(tone: TeamsV2FocusCard["tone"]) {
  if (tone === "salary") return "is-warning";
  if (tone === "value") return "is-positive";
  if (tone === "training") return "is-neutral";
  return "is-ready";
}

export default function TeamsV2Client({
  teams,
  selectedTeam,
  selectedTeamControlMode,
  teamData,
  focusCards,
  onSelectTeam,
  onOpenPlayerDetails,
  onOpenClassicTeams,
  onOpenTraining,
  onOpenMarket,
}: TeamsV2ClientProps) {
  return (
    <div className="teams-v2-shell">
      <header className="teams-v2-header">
        <div className="teams-v2-title">
          {teamData.logoUrl ? <img src={teamData.logoUrl} alt={teamData.teamName} /> : <span>{teamData.logoInitials}</span>}
          <div>
            <small>{teamData.shortCode} · {selectedTeamControlMode ?? teamData.controlMode}</small>
            <h2>{teamData.teamName}</h2>
          </div>
        </div>
        <div className="teams-v2-actions">
          {onOpenClassicTeams ? <button type="button" className="secondary-button" onClick={onOpenClassicTeams}>Teams</button> : null}
          {onOpenTraining ? <button type="button" className="secondary-button" onClick={onOpenTraining}>Training</button> : null}
          {onOpenMarket ? <button type="button" className="secondary-button" onClick={onOpenMarket}>Markt</button> : null}
        </div>
      </header>

      <div className="teams-v2-team-switcher" aria-label="Team wechseln">
        {teams.map((team) => (
          <button
            key={team.teamId}
            type="button"
            className={team.teamId === selectedTeam.teamId ? "is-active" : ""}
            onClick={() => onSelectTeam(team.teamId)}
            title={team.name}
          >
            {team.shortCode ?? team.teamId}
          </button>
        ))}
      </div>

      <section className="teams-v2-focus-grid">
        {focusCards.map((card) => (
          <article key={`${card.label}-${card.note}`} className={`teams-v2-focus-card ${getFocusToneClass(card.tone)}`} title={card.detail}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </section>

      <section className="teams-v2-overview-grid">
        <article>
          <span>Kader</span>
          <strong>{teamData.rosterSize}</strong>
          <small>MW {formatMoney(teamData.marketValueTotal)} · Gehalt {formatMoney(teamData.salaryTotal)}</small>
        </article>
        <article>
          <span>Board</span>
          <strong>{teamData.boardConfidence ? `${teamData.boardConfidence.value}%` : "-"}</strong>
          <small>{teamData.boardConfidence ? `${teamData.boardConfidence.warnings.length} Hinweise` : "kein Signal"}</small>
        </article>
        <article>
          <span>GM</span>
          <strong>{teamData.generalManager?.name ?? "-"}</strong>
          <small>{teamData.generalManager?.lineupDoctrine ?? "keine Doktrin"}</small>
        </article>
        <article>
          <span>Captain</span>
          <strong>{teamData.teamCaptain?.playerName ?? "-"}</strong>
          <small>{teamData.teamCaptain ? `${formatNumber(teamData.teamCaptain.leadershipScore)} Leadership` : "offen"}</small>
        </article>
      </section>

      <section className="teams-v2-relationship-grid">
        <article>
          <h3>Ally</h3>
          {teamData.relationships.allies.length > 0 ? (
            teamData.relationships.allies.map((team) => (
              <span key={team.teamId} title={team.reasons.join(" · ")}>
                {team.shortCode} {team.value}{team.changed ? ` (${team.changeLabel ?? "neu"})` : ""}
              </span>
            ))
          ) : (
            <small>-</small>
          )}
        </article>
        <article>
          <h3>Rival</h3>
          {teamData.relationships.rivals.length > 0 ? (
            teamData.relationships.rivals.map((team) => (
              <span key={team.teamId} title={team.reasons.join(" · ")}>
                {team.shortCode} {team.value}{team.changed ? ` (${team.changeLabel ?? "neu"})` : ""}
              </span>
            ))
          ) : (
            <small>-</small>
          )}
        </article>
      </section>

      <section className="teams-v2-player-grid">
        {teamData.players.map((player) => (
          <button
            key={player.activePlayerId}
            type="button"
            onClick={() => onOpenPlayerDetails?.({ playerId: player.playerId, activePlayerId: player.activePlayerId })}
            title={`${player.name} · PPS ${formatNumber(player.pps, 1)}`}
          >
            <strong>{player.name}</strong>
            <span>{player.className ?? "-"} · PPS {formatNumber(player.pps, 1)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
