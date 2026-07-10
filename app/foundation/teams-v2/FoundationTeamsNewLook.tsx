"use client";

import { useMemo, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import {
  NlCard,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  type NlAxisKey,
} from "@/components/foundation/new-look";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import { getClassColorClassName } from "@/app/foundation/classVisuals";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { formatContractShapeShortLabel } from "@/lib/foundation/player-economy-contract";
import { formatPlayerIdentitySubMeta } from "@/lib/foundation/player-identity-meta";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { getTeamAxisRankTooltip } from "@/lib/foundation/tabs/teams-ui-helpers";
import type { TeamsViewRow } from "@/lib/foundation/tabs/teams-view-derivations";
import type {
  TeamRosterFocusMode,
  TeamRosterRoleFilter,
} from "@/lib/foundation/tabs/use-teams-roster-table-derivations";

/**
 * "Neuer Look" Teams-Ansicht (flag-gated, additiv).
 *
 * Wird ausschließlich aus `FoundationTeamsViewHost` gerendert, wenn der
 * Runtime-Flag (`useNewLook`) aktiv ist UND der Team-Sub-Tab "roster" oder
 * "portraits" gewählt ist — Verträge/Transfer sowie Flag-aus laufen
 * unverändert über `FoundationTeamsDetailPanel`. Konsumiert nur Daten, die
 * der Host ohnehin schon ableitet (TeamsViewRows inkl. Bereichs-Ränge,
 * gefilterte Kaderzeilen, Economy-Helper, Open-Handler).
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - keine Formkurve/kein Trend pro Spieltag (existiert nicht im Modell),
 * - keine erfundenen Team-Gesamtwerte — Bereichs-RÄNGE (`currentPowRank` …)
 *   und Bereichs-PUNKTE (`ppsPow` …) sind die einzigen echten Achsen-Werte.
 */

type NlTeamsRosterMode = "kader" | "tabelle";

export type NlTeamsRosterRow = {
  entry: {
    id: string;
    roleTag?: string | null;
    contractLength: number;
    contractShape?: "balanced" | "front_loaded" | "back_loaded" | null;
    salary?: number | null;
  };
  player: {
    id: string;
    name: string;
    className: string;
    race?: string | null;
    subclasses?: string[] | null;
    coreStats: { pow: number | null; spe: number | null; men: number | null; soc: number | null };
  };
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsRank?: number | null;
};

export type NlTeamsFilterOption<TId extends string> = {
  id: TId;
  label: string;
  count: number;
};

type NlTeamsPortraitModel = {
  src: string | null;
  thumbSrc?: string | null;
  previewSrc?: string | null;
  initials: string;
};

export type FoundationTeamsNewLookProps = {
  selectedTeam: Team;
  gameState: GameState;
  sortedTeamsViewRows: TeamsViewRow[];
  filteredSelectedRosterTableRows: NlTeamsRosterRow[];
  teamRosterRoleFilter: TeamRosterRoleFilter;
  setTeamRosterRoleFilter: (value: TeamRosterRoleFilter) => void;
  teamRosterRoleFilterOptions: Array<NlTeamsFilterOption<TeamRosterRoleFilter>>;
  teamRosterFocusMode: TeamRosterFocusMode;
  setTeamRosterFocusMode: (value: TeamRosterFocusMode) => void;
  teamRosterFocusOptions: Array<NlTeamsFilterOption<TeamRosterFocusMode>>;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  openTeamProfileById: (teamId: string) => void;
  openPlayerDrawerById: (playerId: string, activePlayerId?: string) => void | Promise<void>;
  scheduleActiveManagerTeam: (teamId: string, reason: string) => void;
  getPlayerPortraitModel: (player: NlTeamsRosterRow["player"]) => NlTeamsPortraitModel;
  getRosterEntryDisplayMarketValue: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
  ) => number | null;
  getRosterEntryDisplaySalary: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
  ) => number | null;
  getRosterEntryCurrentSeasonSalary: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
  ) => number | null;
  getPlayerDisplayMarketValueDelta: (
    player: NlTeamsRosterRow["player"],
    entry: NlTeamsRosterRow["entry"],
    gameState: GameState,
  ) => number | null;
  getRosterEntrySalaryDelta: (
    entry: NlTeamsRosterRow["entry"],
    player: NlTeamsRosterRow["player"],
    gameState: GameState,
  ) => number | null;
  formatMoney: (value: number) => string;
  formatDisplayMoney: (value: number | null | undefined) => string;
  selectedTeamRosterActionsAvailable: boolean;
  selectedTeamRosterActionHint: string | null;
  marketSellBusy: boolean;
  contractRenewalBusy: string | null;
  openMarketSellModal: (
    payload: {
      activePlayerId: string;
      playerId: string;
      playerName: string;
      className: string;
      race: string;
      portraitUrl: string | null;
    },
    teamId?: string,
  ) => void | Promise<unknown>;
  openContractRenewalNegotiation: (payload: {
    teamId: string;
    playerId: string;
    playerName: string;
    contractLength: number;
  }) => void | Promise<unknown>;
};

const NL_TEAMS_ROSTER_MODE_ITEMS: Array<{ id: NlTeamsRosterMode; label: string }> = [
  { id: "kader", label: "Kader" },
  { id: "tabelle", label: "Tabelle" },
];

const NL_TEAMS_AXES: Array<{ key: NlAxisKey; label: "POW" | "SPE" | "MEN" | "SOC" }> = [
  { key: "pow", label: "POW" },
  { key: "spe", label: "SPE" },
  { key: "men", label: "MEN" },
  { key: "soc", label: "SOC" },
];

function getAxisRank(row: TeamsViewRow | null, key: NlAxisKey): number | null {
  if (!row) {
    return null;
  }
  if (key === "pow") return row.currentPowRank;
  if (key === "spe") return row.currentSpeRank;
  if (key === "men") return row.currentMenRank;
  return row.currentSocRank;
}

function getAxisPoints(row: TeamsViewRow | null, key: NlAxisKey): number | null {
  if (!row) {
    return null;
  }
  if (key === "pow") return row.ppsPow;
  if (key === "spe") return row.ppsSpe;
  if (key === "men") return row.ppsMen;
  return row.ppsSoc;
}

function getBoardRank(row: TeamsViewRow): number | null {
  return row.overallRank ?? row.rank;
}

function compareBoardRows(left: TeamsViewRow, right: TeamsViewRow): number {
  const leftRank = getBoardRank(left) ?? Number.POSITIVE_INFINITY;
  const rightRank = getBoardRank(right) ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const pointsDelta = (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
  if (pointsDelta !== 0) {
    return pointsDelta;
  }
  return left.teamName.localeCompare(right.teamName, "de-DE");
}

export default function FoundationTeamsNewLook({
  selectedTeam,
  gameState,
  sortedTeamsViewRows,
  filteredSelectedRosterTableRows,
  teamRosterRoleFilter,
  setTeamRosterRoleFilter,
  teamRosterRoleFilterOptions,
  teamRosterFocusMode,
  setTeamRosterFocusMode,
  teamRosterFocusOptions,
  leaguePlayerHeatPools,
  openTeamProfileById,
  openPlayerDrawerById,
  scheduleActiveManagerTeam,
  getPlayerPortraitModel,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntryCurrentSeasonSalary,
  getPlayerDisplayMarketValueDelta,
  getRosterEntrySalaryDelta,
  formatMoney,
  formatDisplayMoney,
  selectedTeamRosterActionsAvailable,
  selectedTeamRosterActionHint,
  marketSellBusy,
  contractRenewalBusy,
  openMarketSellModal,
  openContractRenewalNegotiation,
}: FoundationTeamsNewLookProps) {
  const [rosterMode, setRosterMode] = useState<NlTeamsRosterMode>("kader");

  const teamCount = gameState.teams.length;
  const heroRow = useMemo(
    () => sortedTeamsViewRows.find((row) => row.team.teamId === selectedTeam.teamId) ?? null,
    [selectedTeam.teamId, sortedTeamsViewRows],
  );

  const boardRows = useMemo(() => [...sortedTeamsViewRows].sort(compareBoardRows), [sortedTeamsViewRows]);

  const leaderPoints = useMemo(
    () =>
      boardRows.reduce(
        (max, row) => (row.points != null && Number.isFinite(row.points) && row.points > max ? row.points : max),
        0,
      ),
    [boardRows],
  );

  const heroRadarAxes = useMemo(() => {
    if (teamCount <= 0) {
      return [];
    }
    return NL_TEAMS_AXES.flatMap(({ key }) => {
      const rank = getAxisRank(heroRow, key);
      if (rank == null || !Number.isFinite(rank)) {
        return [];
      }
      // Rang 1 = beste Achse → nach außen zeichnen (teamCount - Rang + 1).
      return [{ key, value: Math.max(0, teamCount - rank + 1) }];
    });
  }, [heroRow, teamCount]);

  const heroLogo = getTeamLogoModel(selectedTeam, { variant: "thumb" });

  function renderAxisRankBadges(row: TeamsViewRow | null, teamName: string, compact: boolean) {
    return (
      <div
        className={`nl-teams-axes${compact ? " is-compact" : ""}`}
        role="group"
        aria-label={`Bereichs-Ränge ${teamName}`}
      >
        {NL_TEAMS_AXES.map(({ key, label }) => {
          const rank = getAxisRank(row, key);
          const points = getAxisPoints(row, key);
          const title =
            rank != null
              ? `${getTeamAxisRankTooltip(label)}${points != null ? ` · ${formatNlNumber(points, 1)} Bereichspunkte` : ""}`
              : getTeamAxisRankTooltip(label);
          return (
            <span key={key} className={`nl-teams-axis ${nlToneClass(key)}`} title={title}>
              <span className="nl-teams-axis-label">{label}</span>
              <span className="nl-teams-axis-rank nl-tnum">{rank != null ? `#${formatNlNumber(rank, 0)}` : "—"}</span>
              {!compact && points != null ? (
                <span className="nl-teams-axis-points nl-tnum">{formatNlNumber(points, 1)} PP</span>
              ) : null}
            </span>
          );
        })}
      </div>
    );
  }

  function renderRosterFilterBar() {
    return (
      <div className="nl-teams-filters">
        <div className="nl-teams-filterbar" role="group" aria-label="Kaderrollen filtern">
          {teamRosterRoleFilterOptions.map((option) => (
            <button
              key={`nl-teams-role-${option.id}`}
              type="button"
              className={`nl-teams-filter${teamRosterRoleFilter === option.id ? " is-active" : ""}`}
              onClick={() => setTeamRosterRoleFilter(option.id)}
            >
              {option.label}
              <span className="nl-teams-filter-count nl-tnum">{option.count}</span>
            </button>
          ))}
        </div>
        <div className="nl-teams-filterbar" role="group" aria-label="Kaderfokus wählen">
          {teamRosterFocusOptions.map((option) => (
            <button
              key={`nl-teams-focus-${option.id}`}
              type="button"
              className={`nl-teams-filter${teamRosterFocusMode === option.id ? " is-active" : ""}`}
              onClick={() => setTeamRosterFocusMode(option.id)}
            >
              {option.label}
              <span className="nl-teams-filter-count nl-tnum">{option.count}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderRosterGrid() {
    if (filteredSelectedRosterTableRows.length === 0) {
      return <p className="nl-teams-empty">Keine Spieler für den aktuellen Filter.</p>;
    }
    return (
      <div className="nl-teams-portrait-grid" data-testid="nl-teams-portrait-grid">
        {filteredSelectedRosterTableRows.map((row) => {
          const { entry, player } = row;
          const portrait = getPlayerPortraitModel(player);
          const marketValue = getRosterEntryDisplayMarketValue(entry, player);
          const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
          const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
          const currentSeasonSalary = getRosterEntryCurrentSeasonSalary(entry, player);
          const shapeShort = formatContractShapeShortLabel(entry.contractShape);
          const subMeta = formatPlayerIdentitySubMeta(player);
          return (
            <FoundationPlayerPortraitCard
              key={entry.id}
              playerId={player.id}
              name={player.name}
              portraitUrl={portrait.src}
              portraitPlaceholderUrl={portrait.previewSrc ?? portrait.thumbSrc}
              portraitInitials={portrait.initials}
              playerOvr={row.playerOvr}
              playerMvs={row.playerMvs}
              playerPps={row.playerPps}
              ovrRank={row.ovrRank ?? null}
              mvsRank={row.mvsRank ?? null}
              ppsRank={row.ppsRank ?? null}
              pow={player.coreStats.pow}
              spe={player.coreStats.spe}
              men={player.coreStats.men}
              soc={player.coreStats.soc}
              leagueHeatPools={leaguePlayerHeatPools}
              variant="team"
              roleTag={entry.roleTag}
              playerClassName={player.className}
              className={getClassColorClassName(player.className, "player-card-class-frame")}
              subMeta={subMeta || null}
              onOpen={() => void openPlayerDrawerById(player.id, entry.id)}
              title={`${player.name} öffnen`}
              economyStats={[
                {
                  label: "MW",
                  value: formatNlNumber(marketValue, 2),
                  delta:
                    marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01
                      ? `${marketValueDelta > 0 ? "+" : ""}${formatNlNumber(marketValueDelta, 2)}`
                      : null,
                  deltaClass:
                    marketValueDelta != null && marketValueDelta > 0
                      ? "text-positive"
                      : marketValueDelta != null && marketValueDelta < 0
                        ? "text-negative"
                        : "",
                },
                {
                  label: "Gehalt",
                  value: formatDisplayMoney(currentSeasonSalary),
                  delta:
                    salaryDelta != null && Math.abs(salaryDelta) >= 0.01
                      ? `${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`
                      : null,
                  deltaClass:
                    salaryDelta != null && salaryDelta < 0
                      ? "text-positive"
                      : salaryDelta != null && salaryDelta > 0
                        ? "text-negative"
                        : "",
                },
                {
                  label: "LZ",
                  value: `${entry.contractLength ?? "—"}${shapeShort ? ` · ${shapeShort}` : ""}`,
                },
              ]}
            />
          );
        })}
      </div>
    );
  }

  function renderRosterTable() {
    const showActions = selectedTeamRosterActionsAvailable;
    return (
      <div className="nl-teams-table-shell">
        <table className="nl-teams-table nl-tnum">
          <thead>
            <tr>
              <th className="nl-teams-th-player">Spieler</th>
              <th className="nl-teams-th-role">Rolle</th>
              <th>OVR</th>
              <th>MVS</th>
              <th>PPs</th>
              <th>MW</th>
              <th>Gehalt</th>
              <th>LZ</th>
              {showActions ? <th className="nl-teams-th-actions">Aktionen</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredSelectedRosterTableRows.map((row) => {
              const { entry, player } = row;
              const marketValue = getRosterEntryDisplayMarketValue(entry, player);
              const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, gameState);
              const annualSalary = getRosterEntryDisplaySalary(entry, player);
              const salaryDelta = getRosterEntrySalaryDelta(entry, player, gameState);
              const shapeShort = formatContractShapeShortLabel(entry.contractShape);
              const isContractExpiring = entry.contractLength <= 1;
              return (
                <tr
                  key={entry.id}
                  className={`nl-teams-table-row${isContractExpiring ? " is-contract-expiring" : ""}`}
                  onClick={() => void openPlayerDrawerById(player.id, entry.id)}
                  title={`${player.name} öffnen`}
                >
                  <td className="nl-teams-td-player">
                    <button
                      type="button"
                      className="nl-teams-playerlink"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openPlayerDrawerById(player.id, entry.id);
                      }}
                    >
                      <span className="nl-teams-playername">{player.name}</span>
                      <span className="nl-teams-playermeta">{formatPlayerIdentitySubMeta(player) || "—"}</span>
                    </button>
                  </td>
                  <td className="nl-teams-td-role">{entry.roleTag ?? "Kader"}</td>
                  <td>{formatNlNumber(row.playerOvr, 0)}</td>
                  <td>{formatNlNumber(row.playerMvs, 1)}</td>
                  <td>{formatNlNumber(row.playerPps, 1)}</td>
                  <td>
                    <span className="nl-teams-money-stack">
                      <span>{formatNlNumber(marketValue, 2)}</span>
                      {marketValueDelta != null && Math.abs(marketValueDelta) >= 0.01 ? (
                        <small className={marketValueDelta >= 0 ? "text-positive" : "text-negative"}>
                          {`${marketValueDelta > 0 ? "+" : ""}${formatNlNumber(marketValueDelta, 2)}`}
                        </small>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <span className="nl-teams-money-stack">
                      <span>{formatDisplayMoney(annualSalary)}</span>
                      {salaryDelta != null && Math.abs(salaryDelta) >= 0.01 ? (
                        <small className={salaryDelta <= 0 ? "text-positive" : "text-negative"}>
                          {`${salaryDelta > 0 ? "+" : ""}${formatDisplayMoney(salaryDelta)}`}
                        </small>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    {entry.contractLength}
                    {shapeShort ? <small className="nl-teams-shape"> · {shapeShort}</small> : null}
                  </td>
                  {showActions ? (
                    <td className="nl-teams-td-actions" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="nl-teams-action"
                        disabled={marketSellBusy}
                        title="Verkaufen"
                        aria-label={`${player.name} verkaufen`}
                        onClick={() =>
                          void openMarketSellModal(
                            {
                              activePlayerId: entry.id,
                              playerId: player.id,
                              playerName: player.name,
                              className: player.className,
                              race: player.race ?? "—",
                              portraitUrl:
                                getPlayerPortraitModel(player).previewSrc ?? getPlayerPortraitModel(player).src,
                            },
                            selectedTeam.teamId,
                          )
                        }
                      >
                        Verkaufen
                      </button>
                      {isContractExpiring ? (
                        <button
                          type="button"
                          className="nl-teams-action"
                          disabled={contractRenewalBusy != null}
                          title="Verlängern"
                          aria-label={`${player.name} verlängern`}
                          onClick={() =>
                            void openContractRenewalNegotiation({
                              teamId: selectedTeam.teamId,
                              playerId: player.id,
                              playerName: player.name,
                              contractLength: 2,
                            })
                          }
                        >
                          Verlängern
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {filteredSelectedRosterTableRows.length === 0 ? (
              <tr>
                <td colSpan={showActions ? 9 : 8} className="nl-teams-empty">
                  Keine Spieler für den aktuellen Filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  function renderBoardRow(row: TeamsViewRow) {
    const isSelected = row.team.teamId === selectedTeam.teamId;
    const boardRank = getBoardRank(row);
    const medalKind = boardRank === 1 ? "gold" : boardRank === 2 ? "silver" : boardRank === 3 ? "bronze" : null;
    const logo = getTeamLogoModel(row.team, { variant: "thumb" });
    return (
      <li
        key={row.team.teamId}
        className={`nl-teams-boardrow${isSelected ? " is-selected" : ""}${medalKind ? " is-podium" : ""}`}
        style={getSeasonV2TeamTagStyle(row.teamCode)}
      >
        <button
          type="button"
          className="nl-teams-boardrow-main"
          onClick={() => scheduleActiveManagerTeam(row.team.teamId, "manual_select")}
          title={`${row.teamName} auswählen`}
        >
          <span className="nl-teams-board-rank">
            {medalKind ? (
              <NlMedalBadge kind={medalKind} title={`Rang ${boardRank}`} />
            ) : (
              <span className="nl-teams-board-ranknum nl-tnum">{boardRank != null ? boardRank : "—"}</span>
            )}
          </span>
          <span className="nl-teams-board-team">
            <BudgetedMediaImage
              src={logo.src}
              alt={`${row.teamName} Logo`}
              className="nl-teams-board-crest"
              width={30}
              height={30}
              loading="lazy"
              fallback={<span className="nl-teams-board-crest nl-teams-board-crest-fallback">{logo.initials}</span>}
            />
            <span className="nl-teams-board-team-copy">
              <span className="nl-teams-board-teamname">{row.teamName}</span>
              <span className="nl-teams-board-teamcode">{row.teamCode}</span>
            </span>
          </span>
          <span className="nl-teams-board-points">
            <span className="nl-teams-board-points-value nl-tnum">{formatNlNumber(row.points, 1)}</span>
            <NlProgressBar
              value={row.points ?? 0}
              max={leaderPoints > 0 ? leaderPoints : 1}
              tone="accent"
              showValue={false}
              className="nl-teams-board-points-bar"
              title={`Punkte relativ zum Spitzenreiter (${formatNlNumber(leaderPoints, 1)})`}
            />
          </span>
          {renderAxisRankBadges(row, row.teamName, true)}
          <span className="nl-teams-board-meta">
            {row.goldCount > 0 ? <NlMedalBadge kind="gold" count={row.goldCount} /> : null}
            {row.silverCount > 0 ? <NlMedalBadge kind="silver" count={row.silverCount} /> : null}
            {row.bronzeCount > 0 ? <NlMedalBadge kind="bronze" count={row.bronzeCount} /> : null}
            <span className="nl-teams-board-cash nl-tnum" title="Cash">
              {row.cash != null ? formatMoney(row.cash) : "—"}
            </span>
          </span>
        </button>
        <button
          type="button"
          className="nl-teams-board-profile"
          onClick={() => openTeamProfileById(row.team.teamId)}
          title={`${row.teamName} Profil öffnen`}
        >
          Profil
        </button>
      </li>
    );
  }

  return (
    <div className="nl-teams foundation-teams-view-panel" data-testid="nl-teams-view" data-new-look="true">
      <NlCard className="nl-teams-hero-card" data-testid="nl-teams-hero">
        <div className="nl-teams-hero" style={getSeasonV2TeamTagStyle(heroRow?.teamCode ?? null)}>
          <div className="nl-teams-hero-identity">
            <BudgetedMediaImage
              src={heroLogo.src}
              alt={`${selectedTeam.name} Logo`}
              className="nl-teams-hero-crest"
              width={64}
              height={64}
              loading="eager"
              fetchPriority="high"
              fallback={<span className="nl-teams-hero-crest nl-teams-hero-crest-fallback">{heroLogo.initials}</span>}
            />
            <div className="nl-teams-hero-copy">
              <span className="nl-teams-hero-eyebrow">Team Fokus</span>
              <h2 className="nl-teams-hero-name">{selectedTeam.name}</h2>
              <StatChipRow className="nl-teams-hero-chips" aria-label={`Kennzahlen ${selectedTeam.name}`}>
                <StatChip
                  label="Rang"
                  value={heroRow?.rank != null ? `#${heroRow.rank}` : "—"}
                  tone="accent"
                  onClick={() => openTeamProfileById(selectedTeam.teamId)}
                  title={`${selectedTeam.name} Profil öffnen`}
                />
                <StatChip label="Punkte" value={formatNlNumber(heroRow?.points, 1)} />
                <StatChip label="Kader" value={heroRow != null ? formatNlNumber(heroRow.rosterCount, 0) : "—"} />
                <StatChip
                  label="Cash"
                  value={heroRow?.cash != null ? formatMoney(heroRow.cash) : "—"}
                  tone={heroRow?.cash != null && heroRow.cash < 0 ? "risk" : "neutral"}
                />
                <StatChip label="MW" value={formatNlNumber(heroRow?.marketValueTotal, 2)} title="Marktwert gesamt" />
                <StatChip
                  label="Gehalt"
                  value={heroRow != null ? formatNlNumber(heroRow.salaryTotal, 2) : "—"}
                  title="Gehaltsblock des aktiven Kaders"
                />
                {heroRow?.needScore != null ? (
                  <StatChip
                    label="Transferbedarf"
                    value={formatNlNumber(heroRow.needScore, 2)}
                    tone="warn"
                    title="Need Score des Teams — je höher, desto größer der Transferbedarf"
                  />
                ) : null}
              </StatChipRow>
            </div>
          </div>
          <div className="nl-teams-hero-axes">
            {renderAxisRankBadges(heroRow, selectedTeam.name, false)}
            {heroRadarAxes.length > 0 ? (
              <NlRadar
                axes={heroRadarAxes}
                max={teamCount}
                className="nl-teams-hero-radar"
                aria-label={`Bereichs-Ränge von ${selectedTeam.name} (außen = besser)`}
              />
            ) : null}
          </div>
        </div>
      </NlCard>

      <NlCard
        className="nl-teams-roster-card"
        eyebrow="Kaderprofil"
        title="Kader"
        actions={
          <NlSubTabs
            items={NL_TEAMS_ROSTER_MODE_ITEMS.map((item) => ({
              ...item,
              count: item.id === "kader" ? filteredSelectedRosterTableRows.length : undefined,
            }))}
            activeId={rosterMode}
            onSelect={(id) => setRosterMode(id as NlTeamsRosterMode)}
            aria-label="Kader-Ansicht wählen"
            className="nl-teams-roster-subtabs"
          />
        }
      >
        {renderRosterFilterBar()}
        {selectedTeamRosterActionHint ? (
          <p className={`nl-teams-action-hint${selectedTeamRosterActionsAvailable ? " is-ready" : " is-locked"}`}>
            <strong>{selectedTeamRosterActionsAvailable ? "Aktionen aktiv" : "Nur Ansicht"}</strong>
            <span>{selectedTeamRosterActionHint}</span>
          </p>
        ) : null}
        {rosterMode === "kader" ? renderRosterGrid() : renderRosterTable()}
      </NlCard>

      <NlCard className="nl-teams-league-card" eyebrow="Teams · Liga" title="Teamtabelle">
        {boardRows.length > 0 ? (
          <ol className="nl-teams-board" aria-label="Teamtabelle">
            {boardRows.map((row) => renderBoardRow(row))}
          </ol>
        ) : (
          <p className="nl-teams-empty">Noch keine Teamdaten für diese Saison.</p>
        )}
      </NlCard>
    </div>
  );
}
