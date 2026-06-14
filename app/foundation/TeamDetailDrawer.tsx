"use client";

import { useEffect, useMemo, useState } from "react";

import ClassColorChip, { getClassColorClassName } from "./ClassColorChip";

type TeamDrawerFilter = "all" | "starter" | "bench" | "d1" | "d2" | "contracts" | "issues";

export type TeamDetailDrawerPlayerCard = {
  playerId: string;
  activePlayerId: string;
  name: string;
  portraitUrl: string | null;
  portraitInitials: string;
  roleTag: string | null;
  className: string | null;
  race: string | null;
  ovr: number | null;
  ovrRank: number | null;
  mvs: number | null;
  mvsRank: number | null;
  pps: number | null;
  ppsRank: number | null;
  marketValue: number | null;
  salary: number | null;
  contractLength: number | null;
  d1Label: string;
  d1Score: number | null;
  d2Label: string;
  d2Score: number | null;
  issueTags: string[];
  topDisciplines: Array<{ label: string; value: number | null }>;
};

export type TeamDetailDrawerData = {
  teamId: string;
  teamName: string;
  shortCode: string;
  logoUrl: string | null;
  logoInitials: string;
  controlMode: "manual" | "ai" | "passive";
  rosterSize: number;
  cash: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  powRank: number | null;
  speRank: number | null;
  menRank: number | null;
  socRank: number | null;
  contractSummaries: Array<{ label: string; salary: number | null }>;
  players: TeamDetailDrawerPlayerCard[];
};

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function getRoleBucket(roleTag: string | null | undefined) {
  if (roleTag === "starter") {
    return "core";
  }
  if (roleTag === "bench") {
    return "rotation";
  }
  return "fringe";
}

function getRoleLabel(roleTag: string | null | undefined) {
  if (roleTag === "starter") {
    return "Starter";
  }
  if (roleTag === "bench") {
    return "Bank";
  }
  if (roleTag === "prospect") {
    return "Prospect";
  }
  return roleTag ?? "—";
}

function filterPlayers(players: TeamDetailDrawerPlayerCard[], filter: TeamDrawerFilter) {
  switch (filter) {
    case "starter":
      return players.filter((player) => player.roleTag === "starter");
    case "bench":
      return players.filter((player) => player.roleTag === "bench");
    case "d1":
      return [...players].sort((left, right) => (right.d1Score ?? -Infinity) - (left.d1Score ?? -Infinity));
    case "d2":
      return [...players].sort((left, right) => (right.d2Score ?? -Infinity) - (left.d2Score ?? -Infinity));
    case "contracts":
      return [...players].sort((left, right) => (left.contractLength ?? Infinity) - (right.contractLength ?? Infinity));
    case "issues":
      return players.filter((player) => player.issueTags.length > 0);
    default:
      return players;
  }
}

function comparePlayersByOvr(left: TeamDetailDrawerPlayerCard, right: TeamDetailDrawerPlayerCard) {
  const ovrDelta = (right.ovr ?? Number.NEGATIVE_INFINITY) - (left.ovr ?? Number.NEGATIVE_INFINITY);
  if (ovrDelta !== 0) {
    return ovrDelta;
  }

  const mvsDelta = (right.mvs ?? Number.NEGATIVE_INFINITY) - (left.mvs ?? Number.NEGATIVE_INFINITY);
  if (mvsDelta !== 0) {
    return mvsDelta;
  }

  const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
  if (ppsDelta !== 0) {
    return ppsDelta;
  }

  return left.name.localeCompare(right.name, "de");
}

export default function TeamDetailDrawer({
  data,
  onClose,
  onOpenPlayer,
}: {
  data: TeamDetailDrawerData | null;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
}) {
  const [filter, setFilter] = useState<TeamDrawerFilter>("all");

  useEffect(() => {
    if (!data) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [data, onClose]);

  useEffect(() => {
    setFilter("all");
  }, [data?.teamId]);

  const visiblePlayers = useMemo(
    () => [...filterPlayers(data?.players ?? [], filter)].sort(comparePlayersByOvr),
    [data?.players, filter],
  );

  const groupedPlayers = useMemo(() => {
    const buckets = {
      core: [] as TeamDetailDrawerPlayerCard[],
      rotation: [] as TeamDetailDrawerPlayerCard[],
      fringe: [] as TeamDetailDrawerPlayerCard[],
    };

    for (const player of visiblePlayers) {
      buckets[getRoleBucket(player.roleTag)].push(player);
    }

    buckets.core.sort(comparePlayersByOvr);
    buckets.rotation.sort(comparePlayersByOvr);
    buckets.fringe.sort(comparePlayersByOvr);

    return buckets;
  }, [visiblePlayers]);

  if (!data) {
    return null;
  }

  return (
    <div className="player-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="player-drawer team-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${data.teamName} Squad Sheet`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="player-drawer-header">
          <div className="player-drawer-hero">
            {data.logoUrl ? (
              <img className="player-drawer-portrait player-drawer-portrait-large team-drawer-logo" src={data.logoUrl} alt={`${data.teamName} Logo`} />
            ) : (
              <div className="player-drawer-portrait player-drawer-portrait-large player-drawer-portrait-placeholder team-drawer-logo">
                {data.logoInitials}
              </div>
            )}
            <div className="player-drawer-headline player-drawer-headline-rich">
              <div className="player-drawer-meta-line">
                <span className="transfer-status-pill is-info">{data.controlMode}</span>
                <span className="player-drawer-source-chip">{data.shortCode}</span>
              </div>
              <h2>{data.teamName}</h2>
              <p className="player-drawer-subline">
                Kader {data.rosterSize} · Cash {formatNumber(data.cash, 1)} · Gehalt {formatNumber(data.salaryTotal, 2)}
              </p>
              <div className="player-drawer-chip-row">
                <span className="player-drawer-chip">POW #{formatNumber(data.powRank)}</span>
                <span className="player-drawer-chip">SPE #{formatNumber(data.speRank)}</span>
                <span className="player-drawer-chip">MEN #{formatNumber(data.menRank)}</span>
                <span className="player-drawer-chip">SOC #{formatNumber(data.socRank)}</span>
                <span className="player-drawer-chip">MW {formatNumber(data.marketValueTotal, 2)}</span>
              </div>
            </div>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Schliessen
          </button>
        </div>

        <div className="player-drawer-body team-drawer-body">
          <section className="player-drawer-section">
            <div className="team-drawer-filter-row">
              {[
                ["all", "Alle"],
                ["starter", "Starter"],
                ["bench", "Bank"],
                ["d1", "D1 Fit"],
                ["d2", "D2 Fit"],
                ["contracts", "Verträge"],
                ["issues", "Probleme"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`secondary-button inline-button${filter === key ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setFilter(key as TeamDrawerFilter)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {(["core", "rotation", "fringe"] as const).map((bucket) => (
            <section className="player-drawer-section" key={bucket}>
              <h3>{bucket === "core" ? "Core" : bucket === "rotation" ? "Rotation" : "Fringe"}</h3>
              <div className="team-drawer-card-grid">
                {groupedPlayers[bucket].map((player) => (
                  <article
                    key={player.activePlayerId}
                    className={`team-drawer-player-card ${getClassColorClassName(player.className, "team-drawer-player-class-frame")}`}
                    onDoubleClick={() => onOpenPlayer(player.playerId, player.activePlayerId)}
                  >
                    <div className="team-drawer-player-head">
                      {player.portraitUrl ? (
                        <img
                          className="team-drawer-player-portrait"
                          src={player.portraitUrl}
                          alt={player.name}
                          width={56}
                          height={56}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="team-drawer-player-portrait team-drawer-player-portrait-placeholder">{player.portraitInitials}</div>
                      )}
                      <div className="team-drawer-player-title">
                        <strong>{player.name}</strong>
                        <span>
                          {getRoleLabel(player.roleTag)} · <ClassColorChip className={player.className} /> · {player.race ?? "—"}
                        </span>
                      </div>
                    </div>
                    <div className="team-drawer-kpi-row">
                      <span>OVR {formatNumber(player.ovr)} · #{formatNumber(player.ovrRank)}</span>
                      <span>MVS {formatNumber(player.mvs, 1)} · #{formatNumber(player.mvsRank)}</span>
                      <span>PPs {formatNumber(player.pps, 1)} · #{formatNumber(player.ppsRank)}</span>
                      <span>LZ {formatNumber(player.contractLength)}</span>
                    </div>
                    <div className="team-drawer-kpi-row">
                      <span>MW {formatNumber(player.marketValue, 2)}</span>
                      <span>Gehalt {formatNumber(player.salary, 2)}</span>
                    </div>
                    <div className="team-drawer-kpi-row">
                      {player.topDisciplines.map((discipline) => (
                        <span key={`${player.activePlayerId}-${discipline.label}`}>
                          {discipline.label} {formatNumber(discipline.value)}
                        </span>
                      ))}
                    </div>
                    {player.issueTags.length > 0 ? (
                      <div className="player-drawer-chip-row">
                        {player.issueTags.map((tag) => (
                          <span key={`${player.activePlayerId}-${tag}`} className="player-drawer-chip is-negative">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
                {groupedPlayers[bucket].length === 0 ? <p className="muted">Keine Spieler in diesem Bereich.</p> : null}
              </div>
            </section>
          ))}

          <section className="player-drawer-section">
            <h3>Verträge</h3>
            <div className="team-drawer-contract-grid">
              {data.contractSummaries.map((entry) => (
                <article key={entry.label} className="metric-card">
                  <span>{entry.label}</span>
                  <strong>{formatNumber(entry.salary, 2)}</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
