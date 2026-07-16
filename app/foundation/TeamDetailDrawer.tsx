"use client";

import { useEffect, useMemo, useState } from "react";

import { getGameTermTooltip } from "@/components/ui/GameTerm";
import TeamDrawerHistoryTable from "@/components/foundation/team-drawer/TeamDrawerHistoryTable";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { createEmptyLeaguePlayerHeatPools, type LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { compareTeamRosterPlayersByOvrOrMarketValue } from "@/lib/foundation/team-roster-player-sort";
import { groupObjectivesByCategory } from "@/lib/foundation/team-board-objectives";
import { isSeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";
import type { PlayerPotentialBand, TeamStrategyBias } from "@/lib/data/olyDataTypes";

import WerdegangPanel from "@/components/foundation/werdegang/WerdegangPanel";
import { buildTeamCareerSeries } from "@/lib/foundation/career-series";
import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";

import { getClassColorClassName } from "./ClassColorChip";
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
  /** "Neuer Look" CA/PO-Sterne (Tier-3 Rosterkarten) — fog-korrekt, siehe `buildRosterCaPoStarFields`. */
  known?: boolean;
  caStars?: number | null;
  poStarRange?: { min: number; max: number } | null;
  caScore?: number | null;
  poScoreRange?: { min: number; max: number } | null;
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
  topBuyPlayerId: string | null;
  topBuyAmount: number | null;
  topSellPlayer: string | null;
  topSellPlayerId: string | null;
  topSellAmount: number | null;
  topSellProfit: number | null;
  injuriesCount: number | null;
  averageFatigue: number | null;
  disciplineValues: Partial<Record<string, number | null>>;
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
    return <p className="team-drawer-relations-empty">{emptyLabel}</p>;
  }

  return (
    <div className="team-drawer-relationship-list">
      {rows.slice(0, 4).map((row) => (
        <div
          key={row.teamId}
          className={`team-drawer-relationship-row${row.changed ? " has-change" : ""}`}
          title={row.reasons.length ? row.reasons.map(formatRelationshipReason).join(" · ") : undefined}
        >
          <strong>{row.shortCode}</strong>
          <span>{formatNumber(row.value, 1)}</span>
          {row.changeLabel ? <em>{row.changeLabel}</em> : null}
          {row.changed && row.reasons[0] ? <small>{formatRelationshipReason(row.reasons[0])}</small> : null}
        </div>
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
    // "Prospect" ist ein auto-abgeleiteter Rausch-Rollen-Tag und wird nicht
    // mehr als sichtbare Rolle gezeigt (Daten/Typ bleiben erhalten).
    return "";
  }
  return roleTag ?? "—";
}

function comparePlayersByOvr(left: TeamDetailDrawerPlayerCard, right: TeamDetailDrawerPlayerCard) {
  return compareTeamRosterPlayersByOvrOrMarketValue({
    left: {
      ovr: left.ovr,
      marketValue: left.marketValue,
      mvs: left.mvs,
      pps: left.pps,
      name: left.name,
    },
    right: {
      ovr: right.ovr,
      marketValue: right.marketValue,
      mvs: right.mvs,
      pps: right.pps,
      name: right.name,
    },
  });
}

export default function TeamDetailDrawer({
  data,
  onClose,
  onOpenPlayer,
  onOpenContracts,
  layerClassName = "",
  variant = "drawer",
  leagueHeatPools,
}: {
  data: TeamDetailDrawerData | null;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
  onOpenContracts?: () => void;
  layerClassName?: string;
  variant?: "drawer" | "page";
  leagueHeatPools?: LeaguePlayerHeatPools;
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
  const resolvedHeatPools = leagueHeatPools ?? createEmptyLeaguePlayerHeatPools();
  const [drawerTab, setDrawerTab] = useState<"overview" | "roster" | "transfers">("overview");

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

  const groupedObjectives = useMemo(
    () => groupObjectivesByCategory(data?.objectives ?? []),
    [data?.objectives],
  );

  // "Neuer Look" (flag-gated, additive): season-over-season career series for
  // the Werdegang panel. With the flag OFF this stays null and nothing changes.
  const foundationState = useFoundationStateOptional();
  const werdegangGameState = foundationState?.gameState ?? null;
  const werdegangTeamId = data?.teamId ?? null;
  const werdegangSeries = useMemo(
    () =>
      werdegangGameState && werdegangTeamId
        ? buildTeamCareerSeries(werdegangGameState, werdegangTeamId)
        : null,
    [werdegangGameState, werdegangTeamId],
  );

  if (!data) {
    return null;
  }

  const profileBody = (
        <div className={`player-drawer-body team-drawer-body${variant === "page" ? " team-profile-body" : ""}`}>
          <div className="team-drawer-tab-row" data-testid="team-drawer-tabs" role="tablist" aria-label="Teamdrawer Bereiche">
            {[
              { id: "overview" as const, label: "Überblick" },
              { id: "roster" as const, label: "Kader" },
              { id: "transfers" as const, label: "Transfers" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={drawerTab === tab.id}
                className={`secondary-button inline-button${drawerTab === tab.id ? " is-active" : ""}`}
                onClick={() => setDrawerTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {drawerTab === "overview" ? (
          <>
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
              {data.relationships.rivals[0] ? (
                <article className="team-drawer-duel-card" data-testid="team-drawer-duel-card">
                  <span className="eyebrow">Duell</span>
                  <strong>
                    {data.shortCode} vs {data.relationships.rivals[0].shortCode}
                  </strong>
                  <small className="muted">
                    Rivalität {formatNumber(data.relationships.rivals[0].value, 1)}
                    {data.relationships.rivals[0].changeLabel ? ` · ${data.relationships.rivals[0].changeLabel}` : ""}
                  </small>
                </article>
              ) : null}
            </div>
          </section>

          <section className="player-drawer-section player-drawer-panel team-drawer-objective-section team-drawer-board-velo">
            <div className="team-drawer-section-head">
              <div>
                <h3>Board & Führung</h3>
                <p className="muted">Ziele, Rivalitätsdruck und Teamkapitän.</p>
              </div>
            </div>
            <div className="team-drawer-lead-summary">
              {data.boardConfidence ? (
                <article
                  className={`team-drawer-lead-chip${data.boardConfidence.pressure >= 8 ? " is-blocked" : data.boardConfidence.value >= 7 ? " is-ready" : ""}`}
                >
                  <span>Board</span>
                  <strong>{formatNumber(data.boardConfidence.value, 1)}/10</strong>
                  <small>
                    Druck {formatNumber(data.boardConfidence.pressure, 1)} · {data.boardConfidence.warnings.length} Warnungen
                  </small>
                </article>
              ) : null}
              {data.teamCaptain ? (
                <article className="team-drawer-lead-chip is-ready">
                  <span>Team Captain</span>
                  <strong>{data.teamCaptain.playerName}</strong>
                  <small>
                    {data.teamCaptain.style} · Lead {formatNumber(data.teamCaptain.leadershipScore, 1)} · Druck -
                    {formatNumber(data.teamCaptain.effects.rivalryPressureReductionPct, 1)}%
                  </small>
                </article>
              ) : null}
            </div>
            {data.generalManager ? (
              <article className="team-drawer-lead-card is-gm is-info">
                <div className="team-drawer-lead-card-head">
                  <span>General Manager</span>
                  <strong>{data.generalManager.name}</strong>
                  <small>
                    {data.generalManager.title} · Einfluss {formatNumber(data.generalManager.influencePct)}%
                  </small>
                </div>
                <div className="team-drawer-gm-axis-row is-compact" aria-label="GM Achsen">
                  <span className="is-pow">POW {formatNumber(data.generalManager.pow, 1)}</span>
                  <span className="is-spe">SPE {formatNumber(data.generalManager.spe, 1)}</span>
                  <span className="is-men">MEN {formatNumber(data.generalManager.men, 1)}</span>
                  <span className="is-soc">SOC {formatNumber(data.generalManager.soc, 1)}</span>
                </div>
                <details className="team-drawer-gm-details">
                  <summary>Gewichtungen & Fokus</summary>
                  <small className="team-drawer-gm-doctrine">
                    {data.generalManager.marketDoctrine} · {data.generalManager.lineupDoctrine}
                  </small>
                  {data.generalManager.facilityPriorities.length ? (
                    <small className="team-drawer-gm-doctrine">
                      Fokus: {data.generalManager.facilityPriorities.slice(0, 3).join(" · ")}
                    </small>
                  ) : null}
                  <div className="team-drawer-gm-bias-grid is-compact" aria-label="GM Gewichtungen">
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
                </details>
              </article>
            ) : null}
            <div className="team-drawer-relations-panel" aria-label="Teambeziehungen">
              <article className="team-drawer-relations-column is-ready">
                <header>
                  <span>Ally</span>
                  <strong>{data.relationships.allies.length}</strong>
                </header>
                {formatRelationshipList(data.relationships.allies, "Keine Ally-Beziehung ab 4+")}
              </article>
              <article className="team-drawer-relations-column is-blocked">
                <header>
                  <span>Rival</span>
                  <strong>{data.relationships.rivals.length}</strong>
                </header>
                {formatRelationshipList(data.relationships.rivals, "Keine Rivalität ab -4")}
              </article>
            </div>
            {groupedObjectives.length ? (
              <div className="team-drawer-objective-board" aria-label="Board-Ziele">
                {groupedObjectives.map(({ category, objectives }) => (
                  <section key={category} className="team-drawer-objective-category">
                    <h4>{category}</h4>
                    {objectives.map((objective) => (
                      <article
                        key={objective.objectiveId}
                        className={`team-drawer-objective-row${getObjectiveTone(objective.status)}`}
                      >
                        <div className="team-drawer-objective-row-main">
                          <span className={`transfer-status-pill${getObjectiveTone(objective.status) || " is-info"}`}>
                            {formatObjectiveStatus(objective.status)}
                          </span>
                          <div className="team-drawer-objective-copy">
                            <strong>{objective.label}</strong>
                            <span className="team-drawer-objective-progress">
                              {String(objective.currentValue ?? "—")} / {String(objective.targetValue ?? "—")}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            ) : null}
          </section>
          {werdegangSeries ? (
            <section className="player-drawer-section player-drawer-panel" id="team-drawer-werdegang">
              <WerdegangPanel variant="team" entityName={data.teamName} series={werdegangSeries} />
            </section>
          ) : null}
          </>
          ) : null}

          {drawerTab === "roster" ? (
          <section className="player-drawer-section team-drawer-roster-section">
            <div className="team-drawer-card-grid team-portraits-grid">
              {visiblePlayers.map((player) => (
                <FoundationPlayerPortraitCard
                  key={player.activePlayerId}
                  playerId={player.playerId}
                  name={player.name}
                  portraitUrl={player.portraitUrl}
                  portraitInitials={player.portraitInitials}
                  playerOvr={player.ovr}
                  playerMvs={player.mvs}
                  playerPps={player.pps}
                  pow={player.coreStats.pow}
                  spe={player.coreStats.spe}
                  men={player.coreStats.men}
                  soc={player.coreStats.soc}
                  leagueHeatPools={resolvedHeatPools}
                  variant="team"
                  className={getClassColorClassName(player.className, "team-drawer-player-class-frame")}
                  subMeta={[
                    getRoleLabel(player.roleTag),
                    player.className ?? "—",
                    player.race ?? "—",
                  ]
                    .filter((part) => part.trim().length > 0)
                    .join(" · ")}
                  ovrRank={player.ovrRank}
                  mvsRank={player.mvsRank}
                  ppsRank={player.ppsRank}
                  onOpen={() => onOpenPlayer(player.playerId, player.activePlayerId)}
                  title={`${player.name} öffnen`}
                  economyStats={[
                    {
                      label: "MW",
                      value: formatNumber(player.marketValue, 2),
                      delta: player.marketValueDelta != null ? formatSignedNumber(player.marketValueDelta, 2) : null,
                      deltaClass: getMoneyDeltaClass(player.marketValueDelta, "higher"),
                      title: getGameTermTooltip("MW") ?? undefined,
                    },
                    {
                      label: "Gehalt",
                      value: formatNumber(player.salary, 2),
                      delta: player.salaryDelta != null ? formatSignedNumber(player.salaryDelta, 2) : null,
                      deltaClass: getMoneyDeltaClass(player.salaryDelta, "lower"),
                    },
                    {
                      label: "LZ",
                      value: formatNumber(player.contractLength),
                      title: getGameTermTooltip("LZ") ?? undefined,
                    },
                  ]}
                  footerSlot={
                    player.demands.length ? (
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
                    ) : null
                  }
                />
              ))}
              {visiblePlayers.length === 0 ? <p className="muted">Keine Spieler im Kader.</p> : null}
            </div>
          </section>
          ) : null}

          {drawerTab === "transfers" ? (
          <>
          {(() => {
            const liveHistory = data.history.find((row) => row.isLive) ?? data.history[0] ?? null;
            return liveHistory ? (
              <section className="player-drawer-section team-drawer-transfer-section" data-testid="team-drawer-transfer-tab">
                <div className="team-drawer-transfer-cards">
                  <article className="team-drawer-transfer-card">
                    <span>Top-Kauf</span>
                    <strong>{liveHistory.topBuyPlayer ?? "—"}</strong>
                    <small>{liveHistory.topBuyAmount != null ? formatNumber(liveHistory.topBuyAmount, 1) : "—"}</small>
                  </article>
                  <article className="team-drawer-transfer-card">
                    <span>Top-Verkauf</span>
                    <strong>{liveHistory.topSellPlayer ?? "—"}</strong>
                    <small>{liveHistory.topSellAmount != null ? formatNumber(liveHistory.topSellAmount, 1) : "—"}</small>
                  </article>
                </div>
              </section>
            ) : null;
          })()}
          <section className="player-drawer-section player-drawer-panel team-drawer-history-section">
            <div className="team-drawer-section-head">
              <div>
                <h3>Historie</h3>
                <p className="muted">Team-Snapshots: Finanzen, PPs, Bereichsleistung und Transfers.</p>
              </div>
              <span className="team-drawer-section-count">{data.history.length}</span>
            </div>
            {data.history.length > 0 ? (
              <TeamDrawerHistoryTable
                tableClassName="team-drawer-history-table"
                shellClassName="team-drawer-history-table-shell"
                axisToneVariant="drawer"
                rows={data.history}
                renderCell={(columnId, row) => {
                  if (columnId === "season") {
                    return (
                      <>
                        <strong>{row.seasonName}</strong>
                        {row.isLive ? <span className="player-drawer-history-tag">Live</span> : null}
                      </>
                    );
                  }
                  if (columnId === "rank") return `#${formatNumber(row.rank)}`;
                  if (columnId === "points") return formatNumber(row.points, 1);
                  if (columnId === "pps") return formatNumber(row.pps, 1);
                  if (columnId === "pow") return formatNumber(row.ppPow, 1);
                  if (columnId === "spe") return formatNumber(row.ppSpe, 1);
                  if (columnId === "men") return formatNumber(row.ppMen, 1);
                  if (columnId === "soc") return formatNumber(row.ppSoc, 1);
                  if (isSeasonDisciplineKey(columnId)) {
                    return formatNumber(row.disciplineValues[columnId], 1);
                  }
                  if (columnId === "cash") return formatNumber(row.cash, 1);
                  if (columnId === "salary") return formatNumber(row.salaryTotal, 2);
                  if (columnId === "mw") return formatNumber(row.marketValue, 2);
                  if (columnId === "guv") {
                    return <span className={getMoneyDeltaClass(row.guv, "higher")}>{formatSignedNumber(row.guv, 1)}</span>;
                  }
                  if (columnId === "injuriesCount") {
                    return row.injuriesCount != null ? row.injuriesCount : "—";
                  }
                  if (columnId === "averageFatigue") {
                    return row.averageFatigue != null ? formatNumber(row.averageFatigue, 1) : "—";
                  }
                  if (columnId === "topBuy") {
                    return row.topBuyPlayer ? (
                      <button
                        type="button"
                        className="team-drawer-history-transfer text-negative is-link"
                        onClick={() => row.topBuyPlayerId && onOpenPlayer(row.topBuyPlayerId, row.topBuyPlayerId)}
                      >
                        {row.topBuyPlayer} · {formatNumber(row.topBuyAmount, 2)}
                      </button>
                    ) : (
                      "—"
                    );
                  }
                  if (columnId === "topSell") {
                    return row.topSellPlayer ? (
                      <button
                        type="button"
                        className={`team-drawer-history-transfer is-link ${row.topSellProfit != null && row.topSellProfit >= 0 ? "text-positive" : row.topSellProfit != null ? "text-negative" : "text-positive"}`}
                        onClick={() => row.topSellPlayerId && onOpenPlayer(row.topSellPlayerId, row.topSellPlayerId)}
                        title={
                          row.topSellProfit != null
                            ? row.topSellProfit >= 0
                              ? `Verkaufsgewinn: ${formatSignedNumber(row.topSellProfit, 2)}`
                              : `Verlust: ${formatSignedNumber(row.topSellProfit, 2)}`
                            : undefined
                        }
                      >
                        {row.topSellPlayer} · {formatNumber(row.topSellAmount, 2)}
                        {row.topSellProfit != null ? ` (${formatSignedNumber(row.topSellProfit, 2)})` : ""}
                      </button>
                    ) : (
                      "—"
                    );
                  }
                  return "—";
                }}
              />
            ) : (
              <p className="muted">Noch keine archivierten Team-Saisons vorhanden.</p>
            )}
          </section>
          </>
          ) : null}
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
              <span className="eyebrow">{formatControlModeLabel(data.controlMode)}</span>
              <h1>{data.teamName}</h1>
            </div>
          </div>
          <div className="team-profile-header-actions">
            {onOpenContracts ? (
              <button className="primary-button inline-button" type="button" onClick={onOpenContracts}>
                Verträge
              </button>
            ) : null}
            <button className="secondary-button inline-button" type="button" onClick={onClose}>
              Zurück
            </button>
          </div>
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
            Schließen
          </button>
        </div>
        {profileBody}
      </aside>
    </div>
  );
}
