"use client";

import { memo, useState } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import ClassColorChip from "@/app/foundation/ClassColorChip";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import FoundationSubNav from "@/app/foundation/shell/FoundationSubNav";
import type { Team } from "@/lib/data/olyDataTypes";
import type { TeamDetailDrawerData, TeamDetailDrawerPlayerCard } from "@/app/foundation/TeamDetailDrawer";
import { VeloImpactStrip, VeloScoutMetric, VeloStatOrbitRow, formatVeloNumber } from "@/components/foundation/velo-ui";

type TeamsV2FocusCard = {
  label: string;
  value: string;
  note: string;
  detail: string;
  tone: "salary" | "value" | "training" | "contract";
};

type TeamsV2TabId = "overview" | "roster" | "contracts" | "stats";

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
  if (tone === "salary") return "is-salary";
  if (tone === "value") return "is-value";
  if (tone === "training") return "is-training";
  return "is-contract";
}

function formatRelationshipReason(reason: string) {
  if (reason === "rivalry_win") return "Rivalen geschlagen";
  if (reason === "rivalry_loss") return "Rivalenduell verloren";
  if (reason === "rivalry_close_finish") return "knappes Rivalenfenster";
  if (reason === "ally_shared_success") return "gemeinsamer Erfolg";
  return reason.replaceAll("_", " ");
}

const TeamsV2PlayerCard = memo(function TeamsV2PlayerCard({
  player,
  onOpenPlayerDetails,
  showContract = false,
}: {
  player: TeamDetailDrawerPlayerCard;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  showContract?: boolean;
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
          <div className="teams-v2-player-disciplines">
            <DisciplineIcon disciplineId={player.className?.toLowerCase()} label={player.className ?? "POW"} />
            <VeloScoutMetric rangeLabel={formatVeloNumber(player.ovr, 0)} tier={player.ovr != null && player.ovr >= 82 ? "S" : "B"} />
          </div>
          {showContract ? (
            <small>
              Gehalt {formatMoney(player.salary)} · LZ {player.contractLength ?? "—"}
            </small>
          ) : null}
        </div>
      </div>
    </button>
  );
});

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
  const [activeTab, setActiveTab] = useState<TeamsV2TabId>("overview");

  return (
    <div className="teams-v2-shell" data-testid="foundation-teams-v2">
      <header className="teams-v2-hero">
        <div className="teams-v2-hero-main">
          {teamData.logoUrl ? (
            <OptimizedMediaImage
              src={teamData.logoUrl}
              alt={teamData.teamName}
              width={96}
              height={96}
              className="teams-v2-logo"
            />
          ) : (
            <span className="teams-v2-logo teams-v2-logo-fallback">{teamData.logoInitials}</span>
          )}
          <div className="teams-v2-copy">
            <span className="teams-v2-kicker">
              {teamData.shortCode} · {selectedTeamControlMode ?? teamData.controlMode}
            </span>
            <h2>{teamData.teamName}</h2>
          </div>
        </div>
        <div className="teams-v2-actions">
          <div className="teams-v2-button-row">
            {onOpenClassicTeams ? (
              <button type="button" className="secondary-button inline-button" onClick={onOpenClassicTeams}>
                Vergleichstabelle (Legacy)
              </button>
            ) : null}
            {onOpenTraining ? (
              <button type="button" className="secondary-button inline-button" onClick={onOpenTraining}>
                Training
              </button>
            ) : null}
            {onOpenMarket ? (
              <button type="button" className="secondary-button inline-button" onClick={onOpenMarket}>
                Markt
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <FoundationSubNav
        className="teams-v2-subnav"
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as TeamsV2TabId)}
        items={[
          { id: "overview", label: "Overview" },
          { id: "roster", label: "Roster" },
          { id: "contracts", label: "Verträge" },
          { id: "stats", label: "Statistik" },
        ]}
      />

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

      {activeTab === "overview" || activeTab === "stats" ? (
        <>
          <section className="teams-v2-focus-grid">
            <VeloImpactStrip
              className="teams-v2-focus-summary-strip"
              items={focusCards.map((card) => ({
                key: card.label,
                label: card.label,
                value: card.value,
                tone: "neutral" as const,
              }))}
            />
            {focusCards.map((card) => (
              <article key={`${card.label}-${card.note}`} className={`teams-v2-focus-card ${getFocusToneClass(card.tone)}`} title={card.detail}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
              </article>
            ))}
          </section>

          <section className="teams-v2-summary-grid">
            <article className="teams-v2-summary-card is-rank">
              <span>Kader</span>
              <strong>{teamData.rosterSize}</strong>
              <small>
                MW {formatMoney(teamData.marketValueTotal)} · Gehalt {formatMoney(teamData.salaryTotal)}
              </small>
            </article>
            <article className="teams-v2-summary-card is-board">
              <span>Board</span>
              <strong>{teamData.boardConfidence ? `${teamData.boardConfidence.value}%` : "-"}</strong>
              <small>{teamData.boardConfidence ? `${teamData.boardConfidence.warnings.length} Hinweise` : "kein Signal"}</small>
            </article>
            <article className="teams-v2-summary-card">
              <span>GM</span>
              <strong>{teamData.generalManager?.name ?? "-"}</strong>
              <small>{teamData.generalManager?.lineupDoctrine ?? "keine Doktrin"}</small>
            </article>
            <article className="teams-v2-summary-card">
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
                  </span>
                ))
              ) : (
                <small>-</small>
              )}
            </article>
          </section>
        </>
      ) : null}

      {activeTab === "roster" || activeTab === "overview" ? (
        <section className="teams-v2-roster-grid">
          {teamData.players.map((player) => (
            <TeamsV2PlayerCard key={player.activePlayerId} player={player} onOpenPlayerDetails={onOpenPlayerDetails} />
          ))}
        </section>
      ) : null}

      {activeTab === "contracts" ? (
        <section className="teams-v2-contracts-grid" data-testid="teams-v2-contracts-panel">
          {teamData.players.map((player) => (
            <TeamsV2PlayerCard
              key={`contract-${player.activePlayerId}`}
              player={player}
              showContract
              onOpenPlayerDetails={onOpenPlayerDetails}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
