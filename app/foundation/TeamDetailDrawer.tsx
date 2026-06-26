"use client";

import { useEffect, useMemo } from "react";

import { getGameTermTooltip } from "@/components/ui/GameTerm";
import type { PlayerPotentialBand, TeamStrategyBias } from "@/lib/data/olyDataTypes";

import ClassColorChip, { getClassColorClassName } from "./ClassColorChip";
import OptimizedMediaImage from "./OptimizedMediaImage";

export type TeamDetailDrawerPlayerCard = {
  playerId: string;
  activePlayerId: string;
  name: string;
  portraitUrl: string | null;
  portraitInitials: string;
  roleTag: string | null;
  promisedRole: string | null;
  className: string | null;
  race: string | null;
  ovr: number | null;
  ovrRank: number | null;
  mvs: number | null;
  mvsRank: number | null;
  pps: number | null;
  ppsRank: number | null;
  marketValue: number | null;
  marketValueDelta: number | null;
  salary: number | null;
  salaryDelta: number | null;
  contractLength: number | null;
  d1Label: string;
  d1Score: number | null;
  d2Label: string;
  d2Score: number | null;
  coreStats: {
    pow: number | null;
    powRank: number | null;
    spe: number | null;
    speRank: number | null;
    men: number | null;
    menRank: number | null;
    soc: number | null;
    socRank: number | null;
  };
  issueTags: string[];
  demands: Array<{
    demandId: string;
    label: string;
    detail: string;
    status: "open" | "fulfilled" | "at_risk" | "failed";
    priority: "low" | "medium" | "high";
    targetDisciplineId?: string | null;
    moraleReward: number;
    moralePenalty: number;
  }>;
  topDisciplines: Array<{ label: string; value: number | null }>;
  potential?: number | null;
  potentialBand?: PlayerPotentialBand | null;
};

export type TeamDetailDrawerHistoryRow = {
  seasonId: string;
  seasonName: string;
  isLive: boolean;
  rank: number | null;
  points: number | null;
  pps: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  cash: number | null;
  salaryTotal: number | null;
  marketValue: number | null;
  guv: number | null;
  topBuyPlayer: string | null;
  topBuyAmount: number | null;
  topSellPlayer: string | null;
  topSellAmount: number | null;
};

export type TeamDetailDrawerData = {
  teamId: string;
  teamName: string;
  shortCode: string;
  logoUrl: string | null;
  logoInitials: string;
  controlMode: "manual" | "ai" | "passive";
  generalManager: {
    name: string;
    title: string;
    description: string;
    pow: number;
    spe: number;
    men: number;
    soc: number;
    influencePct: number;
    playerOptDelta: number;
    marketDoctrine: string;
    lineupDoctrine: string;
    facilityPriorities: string[];
    bias: Partial<TeamStrategyBias>;
  } | null;
  rosterSize: number;
  cash: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  powRank: number | null;
  speRank: number | null;
  menRank: number | null;
  socRank: number | null;
  contractSummaries: Array<{ label: string; salary: number | null }>;
  boardConfidence: {
    value: number;
    pressure: number;
    warnings: string[];
  } | null;
  relationships: {
    allies: Array<{
      teamId: string;
      teamName: string;
      shortCode: string;
      value: number;
      baseValue: number;
      delta: number;
      changed: boolean;
      changeLabel: string | null;
      reasons: string[];
    }>;
    rivals: Array<{
      teamId: string;
      teamName: string;
      shortCode: string;
      value: number;
      baseValue: number;
      delta: number;
      changed: boolean;
      changeLabel: string | null;
      reasons: string[];
    }>;
  };
  objectives: Array<{
    objectiveId: string;
    label: string;
    detail?: string | null;
    actionHint?: string | null;
    category: string;
    targetValue: number | string | boolean | null;
    currentValue: number | string | boolean | null;
    status: "open" | "completed" | "failed" | "at_risk";
  }>;
  teamCaptain: {
    playerId: string;
    playerName: string;
    leadershipScore: number;
    style: string;
    effects: {
      moraleBuffer: number;
      rivalryPressureReductionPct: number;
      teamPowerModifierPct: number;
      conflictSoftenChancePct: number;
    };
    traitSignals: string[];
  } | null;
  history: TeamDetailDrawerHistoryRow[];
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

function getGmAxisShareLabels(gm: NonNullable<TeamDetailDrawerData["generalManager"]>) {
  const axisSum = Math.max(1, gm.pow + gm.spe + gm.men + gm.soc);
  return {
    pow: Math.round((gm.pow / axisSum) * 100),
    spe: Math.round((gm.spe / axisSum) * 100),
    men: Math.round((gm.men / axisSum) * 100),
    soc: Math.round((gm.soc / axisSum) * 100),
  };
}

const GM_BIAS_LABELS: Array<{ key: keyof TeamStrategyBias; label: string }> = [
  { key: "cashPriority", label: "Cash" },
  { key: "valuePriority", label: "Value" },
  { key: "starPriority", label: "Stars" },
  { key: "riskTolerance", label: "Risiko" },
  { key: "wageSensitivity", label: "Gehalt" },
  { key: "sellForProfitAggression", label: "Verkaufen" },
  { key: "shortContractPreference", label: "Kurzvertrag" },
  { key: "longContractPreference", label: "Langvertrag" },
  { key: "loyaltyBias", label: "Loyalitaet" },
  { key: "harmonyStrictness", label: "Harmonie" },
  { key: "rosterDepthPreference", label: "Tiefe" },
  { key: "eliteSmallRosterPreference", label: "Elite" },
];

function getVisibleGeneralManagerBiases(bias: Partial<TeamStrategyBias>) {
  return GM_BIAS_LABELS.map((entry) => ({
    ...entry,
    value: bias[entry.key] ?? 5,
  }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "de"))
    .slice(0, 8);
}

function formatSignedNumber(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function getMoneyDeltaClass(value: number | null | undefined, positiveDirection: "higher" | "lower") {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return "";
  }
  const isPositive = positiveDirection === "higher" ? value > 0 : value < 0;
  return isPositive ? " text-positive" : " text-negative";
}

function average(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (validValues.length === 0) {
    return null;
  }
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

const TEAM_DRAWER_AREA_RANK_CARDS = [
  { label: "POW", key: "powRank", tone: "is-power" },
  { label: "SPE", key: "speRank", tone: "is-speed" },
  { label: "MEN", key: "menRank", tone: "is-mental" },
  { label: "SOC", key: "socRank", tone: "is-social" },
] as const;

function getObjectiveTone(status: "open" | "completed" | "failed" | "at_risk") {
  if (status === "completed") return " is-ready";
  if (status === "failed") return " is-blocked";
  if (status === "at_risk") return " is-warning";
  return "";
}

function formatObjectiveStatus(status: "open" | "completed" | "failed" | "at_risk") {
  if (status === "completed") return "erfüllt";
  if (status === "failed") return "verfehlt";
  if (status === "at_risk") return "gefährdet";
  return "offen";
}

function formatRelationshipReason(reason: string) {
  if (reason === "rivalry_win") return "Rivalen geschlagen";
  if (reason === "rivalry_loss") return "Rivalenduell verloren";
  if (reason === "rivalry_close_finish") return "knappes Rivalenfenster";
  if (reason === "ally_shared_success") return "gemeinsamer Erfolg";
  return reason.replaceAll("_", " ");
}

function formatRelationshipList(
  rows: TeamDetailDrawerData["relationships"]["allies"],
  emptyLabel: string,
) {
  if (rows.length === 0) {
    return <small className="muted">{emptyLabel}</small>;
  }

  return (
    <div className="team-drawer-relationship-list">
      {rows.slice(0, 4).map((row) => (
        <span
          key={row.teamId}
          className={`team-drawer-relationship-chip${row.changed ? " has-change" : ""}`}
          title={row.reasons.length ? row.reasons.map(formatRelationshipReason).join(" · ") : undefined}
        >
          <strong>{row.shortCode} {formatNumber(row.value, 1)}</strong>
          {row.changeLabel ? <em>{row.changeLabel}</em> : null}
          {row.changed && row.reasons[0] ? <small>{formatRelationshipReason(row.reasons[0])}</small> : null}
        </span>
      ))}
    </div>
  );
}

function getDemandTone(status: "open" | "fulfilled" | "at_risk" | "failed") {
  if (status === "fulfilled") return " is-ready";
  if (status === "failed") return " is-blocked";
  if (status === "at_risk") return " is-warning";
  return " is-info";
}

function formatControlModeLabel(value: TeamDetailDrawerData["controlMode"]) {
  if (value === "manual") {
    return "Team geführt";
  }
  if (value === "ai") {
    return "Automatisch";
  }
  return "Beobachtet";
}

function getRoleLabel(roleTag: string | null | undefined) {
  if (roleTag === "starter") {
    return "Starter";
  }
  if (roleTag === "bench") {
    return "Bank";
  }
  if (roleTag === "rotation") {
    return "Rotation";
  }
  if (roleTag === "prospect") {
    return "Prospect";
  }
  return roleTag ?? "—";
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
  layerClassName = "",
  variant = "drawer",
}: {
  data: TeamDetailDrawerData | null;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
  layerClassName?: string;
  variant?: "drawer" | "page";
}) {
  useEffect(() => {
    if (!data || variant === "page") {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [data, onClose, variant]);

  const visiblePlayers = useMemo(
    () => [...(data?.players ?? [])].sort(comparePlayersByOvr),
    [data?.players],
  );
  const gmAxisShares = useMemo(
    () => (data?.generalManager ? getGmAxisShareLabels(data.generalManager) : null),
    [data?.generalManager],
  );

  const teamSummary = useMemo(() => {
    const players = data?.players ?? [];
    const issueCount = players.filter((player) => player.issueTags.length > 0).length;
    const expiringCount = players.filter((player) => (player.contractLength ?? 0) <= 1).length;
    return {
      avgOvr: average(players.map((player) => player.ovr)),
      avgSalary: average(players.map((player) => player.salary)),
      issueCount,
      expiringCount,
    };
  }, [data?.players]);

  if (!data) {
    return null;
  }

  const profileBody = (
        <div className={`player-drawer-body team-drawer-body${variant === "page" ? " team-profile-body" : ""}`}>
          <section className="player-drawer-section player-drawer-hero-surface team-drawer-dashboard">
            <div className="team-drawer-dashboard-grid">
              <article className="team-drawer-identity-card">
                <span className="player-drawer-overline">Kaderprofil</span>
                <h3>{data.shortCode}</h3>
                <p>{data.rosterSize} Spieler · Ø OVR {formatNumber(teamSummary.avgOvr, 1)}</p>
                <div className="player-drawer-mini-facts">
                  <span>Ø Gehalt {formatNumber(teamSummary.avgSalary, 2)}</span>
                  <span>{teamSummary.expiringCount} laufen aus</span>
                  <span>{teamSummary.issueCount} Hinweise</span>
                </div>
              </article>
              <div className="team-drawer-rank-grid">
                {TEAM_DRAWER_AREA_RANK_CARDS.map(({ label, key, tone }) => (
                  <article key={label} className={`team-drawer-rank-card ${tone}`}>
                    <span>{label}</span>
                    <strong>#{formatNumber(data[key])}</strong>
                  </article>
                ))}
              </div>
              <div className="team-drawer-finance-grid">
                <article className="metric-card">
                  <span>Cash</span>
                  <strong>{formatNumber(data.cash, 1)}</strong>
                </article>
                <article className="metric-card">
                  <span>Gehalt</span>
                  <strong>{formatNumber(data.salaryTotal, 2)}</strong>
                </article>
                <article className="metric-card">
                  <span>Marktwert</span>
                  <strong>{formatNumber(data.marketValueTotal, 2)}</strong>
                </article>
              </div>
            </div>
          </section>

          <section className="player-drawer-section player-drawer-panel team-drawer-objective-section">
            <div className="team-drawer-section-head">
              <div>
                <h3>Board & Führung</h3>
                <p className="muted">Ziele, Rivalitätsdruck und Teamkapitän.</p>
              </div>
            </div>
            <div className="team-drawer-objective-grid">
              {data.boardConfidence ? (
                <article className={`metric-card team-drawer-objective-card${data.boardConfidence.pressure >= 8 ? " is-blocked" : data.boardConfidence.value >= 7 ? " is-ready" : ""}`}>
                  <span>Board Confidence</span>
                  <strong>{formatNumber(data.boardConfidence.value, 1)}/10</strong>
                  <small>Druck {formatNumber(data.boardConfidence.pressure, 1)} · {data.boardConfidence.warnings.length} Warnungen</small>
                </article>
              ) : null}
              {data.generalManager ? (
                <article className="metric-card team-drawer-objective-card team-drawer-objective-card-gm is-info">
                  <span>General Manager</span>
                  <strong>{data.generalManager.name}</strong>
                  <small>{data.generalManager.title} · Einfluss {formatNumber(data.generalManager.influencePct)}%</small>
                  <small>{data.generalManager.marketDoctrine} · {data.generalManager.lineupDoctrine}</small>
                  {data.generalManager.facilityPriorities.length ? (
                    <small>Fokus: {data.generalManager.facilityPriorities.slice(0, 3).join(" · ")}</small>
                  ) : null}
                  <div className="team-drawer-gm-axis-row" aria-label="GM Achsen">
                    <span className="is-pow">POW {formatNumber(data.generalManager.pow, 1)} · {gmAxisShares?.pow ?? 0}%</span>
                    <span className="is-spe">SPE {formatNumber(data.generalManager.spe, 1)} · {gmAxisShares?.spe ?? 0}%</span>
                    <span className="is-men">MEN {formatNumber(data.generalManager.men, 1)} · {gmAxisShares?.men ?? 0}%</span>
                    <span className="is-soc">SOC {formatNumber(data.generalManager.soc, 1)} · {gmAxisShares?.soc ?? 0}%</span>
                  </div>
                  <div className="team-drawer-gm-bias-grid" aria-label="GM Gewichtungen">
                    {getVisibleGeneralManagerBiases(data.generalManager.bias).map((bias) => (
                      <div key={bias.key} className="team-drawer-gm-bias-row">
                        <span>{bias.label}</span>
                        <div className="team-drawer-gm-bias-track" aria-hidden="true">
                          <i style={{ width: `${Math.max(10, Math.min(100, bias.value * 10))}%` }} />
                        </div>
                        <strong>{formatNumber(bias.value)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
              {data.teamCaptain ? (
                <article className="metric-card team-drawer-objective-card is-ready">
                  <span>Team Captain</span>
                  <strong>{data.teamCaptain.playerName}</strong>
                  <small>
                    {data.teamCaptain.style} · Lead {formatNumber(data.teamCaptain.leadershipScore, 1)} · Druck -
                    {formatNumber(data.teamCaptain.effects.rivalryPressureReductionPct, 1)}%
                  </small>
                </article>
              ) : null}
              <div className="team-drawer-relationship-stack">
                <article className="metric-card team-drawer-objective-card is-ready">
                  <span>Ally</span>
                  <strong>{data.relationships.allies.length}</strong>
                  {formatRelationshipList(data.relationships.allies, "Keine Ally-Beziehung ab 4+")}
                </article>
                <article className="metric-card team-drawer-objective-card is-blocked">
                  <span>Rival</span>
                  <strong>{data.relationships.rivals.length}</strong>
                  {formatRelationshipList(data.relationships.rivals, "Keine Rivalität ab -4")}
                </article>
              </div>
              {data.objectives.map((objective) => (
                <article key={objective.objectiveId} className={`metric-card team-drawer-objective-card${getObjectiveTone(objective.status)}`}>
                  <span>{objective.category}</span>
                  <strong>{objective.label}</strong>
                  <small>
                    {formatObjectiveStatus(objective.status)} · {String(objective.currentValue ?? "—")} / {String(objective.targetValue ?? "—")}
                  </small>
                  {objective.detail ? <small className="muted">{objective.detail}</small> : null}
                  {objective.actionHint ? <small className="muted">{objective.actionHint}</small> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="player-drawer-section team-drawer-roster-section">
            <div className="team-drawer-card-grid">
              {visiblePlayers.map((player) => (
                <article
                  key={player.activePlayerId}
                  className={`team-drawer-player-card ${getClassColorClassName(player.className, "team-drawer-player-class-frame")}`}
                  onClick={() => onOpenPlayer(player.playerId, player.activePlayerId)}
                >
                  <div className="team-drawer-player-head">
                    {player.portraitUrl ? (
                      <OptimizedMediaImage
                        className="team-drawer-player-portrait"
                        src={player.portraitUrl}
                        alt={player.name}
                        width={86}
                        height={86}
                        fallback={<div className="team-drawer-player-portrait team-drawer-player-portrait-placeholder">{player.portraitInitials}</div>}
                      />
                    ) : (
                      <div className="team-drawer-player-portrait team-drawer-player-portrait-placeholder">{player.portraitInitials}</div>
                    )}
                    <div className="team-drawer-player-title">
                      <strong>{player.name}</strong>
                      <span>
                        {getRoleLabel(player.roleTag)}
                        {player.promisedRole ? ` · versprochen ${getRoleLabel(player.promisedRole)}` : ""} · <ClassColorChip className={player.className} /> · {player.race ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="team-drawer-player-spotlight">
                    <div title={getGameTermTooltip("OVR") ?? undefined}>
                      <small>{player.ovrRank != null ? `#${formatNumber(player.ovrRank)}` : "#—"}</small>
                      <span>OVR</span>
                      <strong>{formatNumber(player.ovr)}</strong>
                    </div>
                    <div title={getGameTermTooltip("PPs") ?? undefined}>
                      <small>{player.ppsRank != null ? `#${formatNumber(player.ppsRank)}` : "#—"}</small>
                      <span>PPs</span>
                      <strong>{formatNumber(player.pps, 1)}</strong>
                    </div>
                    <div title={getGameTermTooltip("MVS") ?? undefined}>
                      <small>{player.mvsRank != null ? `#${formatNumber(player.mvsRank)}` : "#—"}</small>
                      <span>MVS</span>
                      <strong>{formatNumber(player.mvs, 1)}</strong>
                    </div>
                  </div>
                  <div className="team-drawer-economy-strip">
                    <span title={getGameTermTooltip("MW") ?? undefined}>
                      <em>MW</em>
                      <strong>{formatNumber(player.marketValue, 2)}</strong>
                      {player.marketValueDelta != null ? (
                        <small className={`team-drawer-money-delta${getMoneyDeltaClass(player.marketValueDelta, "higher")}`}>
                          {formatSignedNumber(player.marketValueDelta, 2)}
                        </small>
                      ) : null}
                    </span>
                    <span>
                      <em>Gehalt</em>
                      <strong>{formatNumber(player.salary, 2)}</strong>
                      {player.salaryDelta != null ? (
                        <small className={`team-drawer-money-delta${getMoneyDeltaClass(player.salaryDelta, "lower")}`}>
                          {formatSignedNumber(player.salaryDelta, 2)}
                        </small>
                      ) : null}
                    </span>
                    <span title={getGameTermTooltip("LZ") ?? undefined}>
                      <em>LZ</em>
                      <strong>{formatNumber(player.contractLength)}</strong>
                    </span>
                  </div>
                  <div className="team-drawer-player-core-stats" title="Bereichswerte des Spielers: Power, Speed, Mental und Social.">
                    <span className="is-power">
                      <em>
                        POW <small>{player.coreStats.powRank != null ? `#${formatNumber(player.coreStats.powRank)}` : "#—"}</small>
                      </em>
                      <strong>{formatNumber(player.coreStats.pow, 0)}</strong>
                    </span>
                    <span className="is-speed">
                      <em>
                        SPE <small>{player.coreStats.speRank != null ? `#${formatNumber(player.coreStats.speRank)}` : "#—"}</small>
                      </em>
                      <strong>{formatNumber(player.coreStats.spe, 0)}</strong>
                    </span>
                    <span className="is-mental">
                      <em>
                        MEN <small>{player.coreStats.menRank != null ? `#${formatNumber(player.coreStats.menRank)}` : "#—"}</small>
                      </em>
                      <strong>{formatNumber(player.coreStats.men, 0)}</strong>
                    </span>
                    <span className="is-social">
                      <em>
                        SOC <small>{player.coreStats.socRank != null ? `#${formatNumber(player.coreStats.socRank)}` : "#—"}</small>
                      </em>
                      <strong>{formatNumber(player.coreStats.soc, 0)}</strong>
                    </span>
                  </div>
                  {player.demands.length ? (
                    <div className="team-drawer-player-demand-row">
                      {player.demands.slice(0, 2).map((demand) => (
                        <span
                          key={demand.demandId}
                          className={`legacy-lineup-missing-chip${getDemandTone(demand.status)}`}
                          title={`${demand.detail} · Erfüllen ${demand.moraleReward >= 0 ? "+" : ""}${demand.moraleReward} Moral · Ignorieren ${demand.moralePenalty}`}
                        >
                          <strong>{demand.label}</strong>
                          <small>{demand.priority}</small>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              {visiblePlayers.length === 0 ? <p className="muted">Keine Spieler im Kader.</p> : null}
            </div>
          </section>

          <section className="player-drawer-section player-drawer-panel team-drawer-history-section">
            <div className="team-drawer-section-head">
              <div>
                <h3>Historie</h3>
                <p className="muted">Team-Snapshots: Finanzen, PPs, Bereichsleistung und Transfers.</p>
              </div>
              <span className="team-drawer-section-count">{data.history.length}</span>
            </div>
            {data.history.length > 0 ? (
              <div className="team-drawer-history-table-shell">
                <table className="team-drawer-history-table">
                  <thead>
                    <tr>
                      <th>Saison</th>
                      <th>Platz</th>
                      <th>Punkte</th>
                      <th>PPs</th>
                      <th>POW</th>
                      <th>SPE</th>
                      <th>MEN</th>
                      <th>SOC</th>
                      <th>Cash</th>
                      <th>Gehalt</th>
                      <th>MW</th>
                      <th>GuV</th>
                      <th>Top Einkauf</th>
                      <th>Top Verkauf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((row) => (
                      <tr key={`${row.seasonId}-${row.isLive ? "live" : "archive"}`}>
                        <td>
                          <strong>{row.seasonName}</strong>
                          {row.isLive ? <span className="player-drawer-history-tag">Live</span> : null}
                        </td>
                        <td>#{formatNumber(row.rank)}</td>
                        <td>{formatNumber(row.points, 1)}</td>
                        <td>{formatNumber(row.pps, 1)}</td>
                        <td className="team-drawer-history-area is-power">{formatNumber(row.ppPow, 1)}</td>
                        <td className="team-drawer-history-area is-speed">{formatNumber(row.ppSpe, 1)}</td>
                        <td className="team-drawer-history-area is-mental">{formatNumber(row.ppMen, 1)}</td>
                        <td className="team-drawer-history-area is-social">{formatNumber(row.ppSoc, 1)}</td>
                        <td>{formatNumber(row.cash, 1)}</td>
                        <td>{formatNumber(row.salaryTotal, 2)}</td>
                        <td>{formatNumber(row.marketValue, 2)}</td>
                        <td className={getMoneyDeltaClass(row.guv, "higher")}>{formatSignedNumber(row.guv, 1)}</td>
                        <td>
                          {row.topBuyPlayer ? (
                            <span className="team-drawer-history-transfer text-negative">
                              {row.topBuyPlayer} · {formatNumber(row.topBuyAmount, 2)}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          {row.topSellPlayer ? (
                            <span className="team-drawer-history-transfer text-positive">
                              {row.topSellPlayer} · {formatNumber(row.topSellAmount, 2)}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Noch keine archivierten Team-Saisons vorhanden.</p>
            )}
          </section>
        </div>
  );

  if (variant === "page") {
    return (
      <div className="team-profile-shell" data-testid="foundation-team-profile">
        <header className="team-profile-header">
          <div className="team-profile-identity">
            {data.logoUrl ? (
              <OptimizedMediaImage
                className="team-profile-logo"
                src={data.logoUrl}
                alt={`${data.teamName} Logo`}
                width={96}
                height={96}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <span className="team-profile-logo is-placeholder">{data.logoInitials}</span>
            )}
            <div>
              <span className="eyebrow">{data.shortCode} · {formatControlModeLabel(data.controlMode)}</span>
              <h1>{data.teamName}</h1>
            </div>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Zurück
          </button>
        </header>
        {profileBody}
      </div>
    );
  }

  return (
    <div
      className={`player-drawer-backdrop${layerClassName ? ` ${layerClassName}` : ""}`}
      role="presentation"
      onClick={onClose}
    >
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
              <OptimizedMediaImage
                className="player-drawer-portrait player-drawer-portrait-large team-drawer-logo"
                src={data.logoUrl}
                alt={`${data.teamName} Logo`}
                width={160}
                height={160}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="player-drawer-portrait player-drawer-portrait-large player-drawer-portrait-placeholder team-drawer-logo">
                {data.logoInitials}
              </div>
            )}
            <div className="player-drawer-headline player-drawer-headline-rich">
              <div className="player-drawer-meta-line">
                <span className="transfer-status-pill is-info">{formatControlModeLabel(data.controlMode)}</span>
              </div>
              <h2>{data.teamName}</h2>
            </div>
          </div>
          <button className="secondary-button inline-button" type="button" onClick={onClose}>
            Schliessen
          </button>
        </div>
        {profileBody}
      </aside>
    </div>
  );
}
