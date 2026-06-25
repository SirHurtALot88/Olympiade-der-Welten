"use client";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import ClassColorChip from "@/app/foundation/ClassColorChip";
import type { Team } from "@/lib/data/olyDataTypes";
import type { TeamDetailDrawerData, TeamDetailDrawerPlayerCard } from "@/app/foundation/TeamDetailDrawer";
import { VeloStatOrbitRow, formatVeloNumber } from "@/components/foundation/velo-ui";

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

function formatMoney(value: number | null | undefined) {
  return formatVeloNumber(value, 2);
}

function getFocusToneClass(tone: TeamsV2FocusCard["tone"]) {
  if (tone === "salary") return "is-warning";
  if (tone === "value") return "is-positive";
  if (tone === "training") return "is-neutral";
  return "is-ready";
}

function formatRelationshipReason(reason: string) {
  if (reason === "rivalry_win") return "Rivalen geschlagen";
  if (reason === "rivalry_loss") return "Rivalenduell verloren";
  if (reason === "rivalry_close_finish") return "knappes Rivalenfenster";
  if (reason === "ally_shared_success") return "gemeinsamer Erfolg";
  return reason.replaceAll("_", " ");
}

function TeamsV2PlayerCard({
  player,
  onOpenPlayerDetails,
}: {
  player: TeamDetailDrawerPlayerCard;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
}) {
  return (
    <button
      className="teams-v2-player-card velo-rider-mini-card"
      type="button"
      onClick={() => onOpenPlayerDetails?.({ playerId: player.playerId, activePlayerId: player.activePlayerId })}
      title={`${player.name} · PPS ${formatVeloNumber(player.pps, 1)}`}
    >
      <VeloStatOrbitRow
        ariaLabel={`${player.name} Achsenwerte`}
        stats={{
          pow: player.coreStats.pow ?? 0,
          spe: player.coreStats.spe ?? 0,
          men: player.coreStats.men ?? 0,
          soc: player.coreStats.soc ?? 0,
        }}
      />
      <div className="teams-v2-player-card-body">
        {player.portraitUrl ? (
          <OptimizedMediaImage src={player.portraitUrl} alt={player.name} width={72} height={72} className="teams-v2-player-portrait" />
        ) : (
          <span className="teams-v2-player-portrait is-placeholder">{player.portraitInitials}</span>
        )}
        <div className="teams-v2-player-copy">
          <strong>{player.name}</strong>
          <small>
            {player.className ? <ClassColorChip className={player.className} /> : "—"} · PPS {formatVeloNumber(player.pps, 1)}
          </small>
          <small>
            OVR {formatVeloNumber(player.ovr, 1)} · MVS {formatVeloNumber(player.mvs, 1)}
          </small>
        </div>
      </div>
    </button>
  );
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
    <div className="teams-v2-shell" data-testid="foundation-teams-v2">
      <header className="teams-v2-header">
        <div className="teams-v2-title">
          {teamData.logoUrl ? <img src={teamData.logoUrl} alt={teamData.teamName} /> : <span>{teamData.logoInitials}</span>}
          <div>
            <small>
              {teamData.shortCode} · {selectedTeamControlMode ?? teamData.controlMode}
            </small>
            <h2>{teamData.teamName}</h2>
          </div>
        </div>
        <div className="teams-v2-actions">
          {onOpenClassicTeams ? (
            <button type="button" className="secondary-button" onClick={onOpenClassicTeams}>
              Vergleichstabelle
            </button>
          ) : null}
          {onOpenTraining ? (
            <button type="button" className="secondary-button" onClick={onOpenTraining}>
              Training
            </button>
          ) : null}
          {onOpenMarket ? (
            <button type="button" className="secondary-button" onClick={onOpenMarket}>
              Markt
            </button>
          ) : null}
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
          <small>
            MW {formatMoney(teamData.marketValueTotal)} · Gehalt {formatMoney(teamData.salaryTotal)}
          </small>
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
          <small>{teamData.teamCaptain ? `${formatVeloNumber(teamData.teamCaptain.leadershipScore)} Leadership` : "offen"}</small>
        </article>
      </section>

      <section className="teams-v2-relationship-grid">
        <article>
          <h3>Ally</h3>
          {teamData.relationships.allies.length > 0 ? (
            teamData.relationships.allies.map((team) => (
              <span key={team.teamId} className={team.changed ? "has-change" : ""} title={team.reasons.map(formatRelationshipReason).join(" · ")}>
                <strong>
                  {team.shortCode} {formatVeloNumber(team.value, 1)}
                </strong>
                {team.changed ? <em>{team.changeLabel ?? "neu"}</em> : null}
                {team.changed && team.reasons[0] ? <small>{formatRelationshipReason(team.reasons[0])}</small> : null}
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
              <span key={team.teamId} className={team.changed ? "has-change" : ""} title={team.reasons.map(formatRelationshipReason).join(" · ")}>
                <strong>
                  {team.shortCode} {formatVeloNumber(team.value, 1)}
                </strong>
                {team.changed ? <em>{team.changeLabel ?? "neu"}</em> : null}
                {team.changed && team.reasons[0] ? <small>{formatRelationshipReason(team.reasons[0])}</small> : null}
              </span>
            ))
          ) : (
            <small>-</small>
          )}
        </article>
      </section>

      <section className="teams-v2-roster-grid">
        {teamData.players.map((player) => (
          <TeamsV2PlayerCard key={player.activePlayerId} player={player} onOpenPlayerDetails={onOpenPlayerDetails} />
        ))}
      </section>
    </div>
  );
}
