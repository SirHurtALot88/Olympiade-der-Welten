"use client";

import { Fragment, useMemo, useState, type KeyboardEvent } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  NlRankingDrawer,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  formatNlMoney,
  nlToneClass,
  type NlBarChartBar,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import {
  getSeasonV2TeamTagStyle,
  type SeasonStandingsV2ClientProps,
  type SeasonV2StandingsRow,
} from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import {
  resolveSeasonDisciplineAreaTotal,
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_LABELS,
  type SeasonDisciplineAreaId,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";

/**
 * "Neuer Look" Saisonstand — Liga-Board (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `SeasonStandingsV2Client` fällt ohne Flag unverändert auf das bestehende
 * Layout zurück. Konsumiert exakt dieselben Props/Daten wie der alte Client.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - kein "Titelrennen"-Hero,
 * - keine Auf-/Abstiegszonen (kein Zonen-Konzept im Datenmodell),
 * - kein Rang-Verlauf pro Spieltag (existiert nicht) — Rang-Entwicklung
 *   gibt es nur saisonübergreifend aus `historicalPointsBySeason`.
 *
 * Momentum/Formtrend im Board: `SeasonV2StandingsRow` (und damit diese
 * Props) enthält keine Pro-Spieltag-Punktereihe — der Season-Points-Ledger
 * (`lib/foundation/season-points-ledger.ts`) liefert Punkte nur pro
 * *Spieler*-Performance, nicht als team-aggregierte Serie über Spieltage,
 * und wird hier ohnehin nicht durchgereicht. Statt einer erfundenen
 * Sparkline nutzt der Momentum-Chip pro Zeile deshalb `row.rankDiff`
 * (Rang-Bewegung seit Saisonstart) — dasselbe Feld, das `momentumTeam` in
 * `use-season-v2-panel-model.ts` bereits als "Momentum" behandelt.
 */

type NlStandingsMode = "board" | "daten";

const NL_STANDINGS_MODE_ITEMS: Array<{ id: NlStandingsMode; label: string }> = [
  { id: "board", label: "Board" },
  { id: "daten", label: "Daten" },
];

/** Board-Sortierung: nach Rang oder nach einem der vier Bereiche. */
type NlBoardSortKey = "rank" | SeasonDisciplineAreaId;

const NL_BOARD_SORT_ITEMS: Array<{ id: NlBoardSortKey; label: string }> = [
  { id: "rank", label: "Rang" },
  ...SEASON_DISCIPLINE_AREA_GROUPS.map((group) => ({ id: group.id, label: group.label })),
];

/** Spalten der Daten-Tabelle, die per Klick sortierbar sind. */
type NlTableSortKey = "rank" | "team" | "points" | "bonus" | SeasonDisciplineAreaId | "mw";

function getTableSortValue(row: SeasonV2StandingsRow, key: NlTableSortKey): number | string {
  switch (key) {
    case "rank":
      return row.rank != null && Number.isFinite(row.rank) ? row.rank : Number.POSITIVE_INFINITY;
    case "team":
      return row.teamName;
    case "points":
      return row.points != null && Number.isFinite(row.points) ? row.points : Number.NEGATIVE_INFINITY;
    case "bonus": {
      const bonus = row.disciplineValues.bonuspunkte;
      return bonus != null && Number.isFinite(bonus) ? bonus : Number.NEGATIVE_INFINITY;
    }
    case "mw":
      return row.marketValueTotal != null && Number.isFinite(row.marketValueTotal)
        ? row.marketValueTotal
        : Number.NEGATIVE_INFINITY;
    default: {
      const value = getAreaValue(row, key);
      return value != null && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
    }
  }
}

function getAreaValue(row: SeasonV2StandingsRow, areaId: SeasonDisciplineAreaId): number | null {
  const ledgerValue = areaId === "pow" ? row.pow : areaId === "spe" ? row.spe : areaId === "men" ? row.men : row.soc;
  return resolveSeasonDisciplineAreaTotal(row.disciplineValues, areaId, ledgerValue);
}

function getBarPercent(value: number | null | undefined, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || max <= 0) {
    return 0;
  }
  return Math.max(3, Math.min(100, (value / max) * 100));
}

function compareBoardRows(left: SeasonV2StandingsRow, right: SeasonV2StandingsRow): number {
  const leftRank = left.rank != null && Number.isFinite(left.rank) ? left.rank : Number.POSITIVE_INFINITY;
  const rightRank = right.rank != null && Number.isFinite(right.rank) ? right.rank : Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const pointsDelta = (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
  if (pointsDelta !== 0) {
    return pointsDelta;
  }
  return left.teamName.localeCompare(right.teamName, "de-DE");
}

export default function SeasonStandingsNewLook({
  selectedSeasonId,
  selectedSeasonLabel,
  sourceLabel,
  sourceBadgeLabel,
  isArchived,
  seasonOptions,
  selectedTeamSummary,
  standingsRows,
  topPlayers,
  onChangeSeason,
  onOpenTeam,
  onOpenPlayer,
  isLoading = false,
}: SeasonStandingsV2ClientProps) {
  const [mode, setMode] = useState<NlStandingsMode>("board");
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [boardSort, setBoardSort] = useState<NlBoardSortKey>("rank");
  const [tableSort, setTableSort] = useState<{ key: NlTableSortKey; dir: "asc" | "desc" }>({
    key: "rank",
    dir: "asc",
  });
  // "Neuer Look" (#37, flag-gated, additiv): KPI-Ranking-Drawer statt voller
  // Navigation beim Klick auf Punkte-/MW-Chips — Zeilen kommen aus `boardRows`,
  // das hier schon existiert, es wird nichts neu berechnet.
  const [rankingDrawerMetric, setRankingDrawerMetric] = useState<"points" | "mw" | null>(null);
  const [rankingDrawerHighlightId, setRankingDrawerHighlightId] = useState<string | null>(null);

  const boardRows = useMemo(() => [...standingsRows].sort(compareBoardRows), [standingsRows]);

  const displayBoardRows = useMemo(() => {
    if (boardSort === "rank") {
      return boardRows;
    }
    return [...boardRows].sort((left, right) => {
      const leftValue = getAreaValue(left, boardSort);
      const rightValue = getAreaValue(right, boardSort);
      const delta =
        (rightValue != null && Number.isFinite(rightValue) ? rightValue : Number.NEGATIVE_INFINITY) -
        (leftValue != null && Number.isFinite(leftValue) ? leftValue : Number.NEGATIVE_INFINITY);
      if (delta !== 0) {
        return delta;
      }
      return left.teamName.localeCompare(right.teamName, "de-DE");
    });
  }, [boardRows, boardSort]);

  const sortedTableRows = useMemo(() => {
    const direction = tableSort.dir === "asc" ? 1 : -1;
    return [...boardRows].sort((left, right) => {
      const leftValue = getTableSortValue(left, tableSort.key);
      const rightValue = getTableSortValue(right, tableSort.key);
      let result =
        typeof leftValue === "string" || typeof rightValue === "string"
          ? String(leftValue).localeCompare(String(rightValue), "de-DE")
          : leftValue - rightValue;
      if (result === 0) {
        result = (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY);
      }
      return result * direction;
    });
  }, [boardRows, tableSort]);

  // B3: Das Podium folgt exakt den ANGEZEIGTEN Punkten (nicht dem gespeicherten
  // `rank`, falls beide in den Rohdaten auseinanderlaufen). Reihenfolge, Medaille,
  // "Spitze" und Rückstands-Label stützen sich damit auf dieselbe Kennzahl — der
  // Platz 1 ist garantiert das Team mit den meisten Punkten. Gleichstände lösen
  // wir über den Standings-Rang und dann den Teamnamen auf.
  const podiumRows = useMemo(
    () =>
      [...boardRows]
        .filter((row) => row.points != null && Number.isFinite(row.points))
        .sort((left, right) => {
          const pointsDelta = (right.points as number) - (left.points as number);
          if (pointsDelta !== 0) {
            return pointsDelta;
          }
          const leftRank = left.rank != null && Number.isFinite(left.rank) ? left.rank : Number.POSITIVE_INFINITY;
          const rightRank = right.rank != null && Number.isFinite(right.rank) ? right.rank : Number.POSITIVE_INFINITY;
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
          return left.teamName.localeCompare(right.teamName, "de-DE");
        })
        .slice(0, 3),
    [boardRows],
  );

  const topPlayersStrip = useMemo(() => topPlayers.slice(0, 10), [topPlayers]);

  const leaderPoints = useMemo(
    () =>
      boardRows.reduce(
        (max, row) => (row.points != null && Number.isFinite(row.points) && row.points > max ? row.points : max),
        0,
      ),
    [boardRows],
  );

  const areaMaxById = useMemo(() => {
    const result: Record<SeasonDisciplineAreaId, number> = { pow: 0, spe: 0, men: 0, soc: 0 };
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
      for (const row of boardRows) {
        const value = getAreaValue(row, group.id);
        if (value != null && Number.isFinite(value) && value > result[group.id]) {
          result[group.id] = value;
        }
      }
    }
    return result;
  }, [boardRows]);

  const areaRadarMax = useMemo(() => Math.max(1, ...Object.values(areaMaxById)), [areaMaxById]);

  const disciplineMaxByKey = useMemo(() => {
    const result = new Map<SeasonDisciplineKey, number>();
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
      for (const key of group.keys) {
        let max = 0;
        for (const row of boardRows) {
          const value = row.disciplineValues[key];
          if (value != null && Number.isFinite(value) && value > max) {
            max = value;
          }
        }
        result.set(key, max);
      }
    }
    return result;
  }, [boardRows]);

  /** Rückstand des eigenen Teams auf den Spitzenreiter (Punkte). */
  const ownGapToLeader = useMemo(() => {
    if (!selectedTeamSummary || selectedTeamSummary.points == null || !Number.isFinite(selectedTeamSummary.points)) {
      return null;
    }
    return leaderPoints - selectedTeamSummary.points;
  }, [selectedTeamSummary, leaderPoints]);

  /**
   * Daten-Modus-Balkenchart: folgt standardmäßig `points`, schwenkt aber
   * auf die Bereichspunkte (POW/SPE/MEN/SOC) um, sobald über die
   * Tabellen-Sortierung eine dieser Spalten aktiv ist ("Chart folgt Sort").
   */
  const datenChartMetric = useMemo(() => {
    const activeArea = SEASON_DISCIPLINE_AREA_GROUPS.find((group) => group.id === tableSort.key);
    if (!activeArea) {
      return null;
    }
    return { areaId: activeArea.id, label: activeArea.label, tone: activeArea.id as NlTone };
  }, [tableSort.key]);

  const datenChartBars = useMemo<NlBarChartBar[]>(
    () =>
      sortedTableRows.map((row) => {
        const isPodium = row.rank != null && row.rank >= 1 && row.rank <= 3;
        const value = datenChartMetric ? getAreaValue(row, datenChartMetric.areaId) : row.points;
        const tone: NlTone = row.isSelected ? "accent" : datenChartMetric ? datenChartMetric.tone : isPodium ? "good" : "neutral";
        return { label: row.teamCode, value: value ?? 0, tone };
      }),
    [sortedTableRows, datenChartMetric],
  );

  const datenChartAriaLabel = datenChartMetric
    ? `Bereichspunkte ${datenChartMetric.label} je Team, folgt der aktiven Tabellensortierung (dein Team hervorgehoben)`
    : "Punkte je Team, in der Reihenfolge der Tabelle darunter (dein Team hervorgehoben)";

  function toggleExpanded(teamId: string) {
    setExpandedTeamId((current) => (current === teamId ? null : teamId));
  }

  /**
   * Rangliste für den KPI-Ranking-Drawer (#37): "points" folgt derselben
   * Reihenfolge wie das Board (`boardRows`, bereits nach Rang sortiert),
   * "mw" sortiert dieselben Zeilen nach Marktwert neu. Keine neue
   * Datenquelle — nur eine andere Ansicht auf `boardRows`.
   */
  const rankingDrawerRows = useMemo<NlRankingDrawerRow[]>(() => {
    if (rankingDrawerMetric === "points") {
      return boardRows.map((row) => ({
        id: row.teamId,
        rank: row.rank ?? 0,
        name: row.teamName,
        sub: row.teamCode,
        value: row.points,
        tone: "accent",
        isOwn: row.isSelected,
      }));
    }
    if (rankingDrawerMetric === "mw") {
      return [...boardRows]
        .sort(
          (left, right) =>
            (right.marketValueTotal ?? Number.NEGATIVE_INFINITY) - (left.marketValueTotal ?? Number.NEGATIVE_INFINITY),
        )
        .map((row, index) => ({
          id: row.teamId,
          rank: index + 1,
          name: row.teamName,
          sub: row.teamCode,
          value: row.marketValueTotal,
          tone: "neutral",
          isOwn: row.isSelected,
        }));
    }
    return [];
  }, [rankingDrawerMetric, boardRows]);

  function openRankingDrawer(metric: "points" | "mw", highlightTeamId: string) {
    setRankingDrawerMetric(metric);
    setRankingDrawerHighlightId(highlightTeamId);
  }

  function closeRankingDrawer() {
    setRankingDrawerMetric(null);
    setRankingDrawerHighlightId(null);
  }

  function toggleTableSort(key: NlTableSortKey) {
    setTableSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "rank" || key === "team" ? "asc" : "desc" },
    );
  }

  function tableSortArrow(key: NlTableSortKey) {
    if (tableSort.key !== key) {
      return "↕";
    }
    return tableSort.dir === "asc" ? "↑" : "↓";
  }

  function renderTableSortHeader(key: NlTableSortKey, label: string) {
    return (
      <button
        type="button"
        className={`nl-standings-sort-th${tableSort.key === key ? " is-active" : ""}`}
        onClick={() => toggleTableSort(key)}
        aria-label={`Nach ${label} sortieren`}
      >
        <span>{label}</span>
        <b aria-hidden="true">{tableSortArrow(key)}</b>
      </button>
    );
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>, teamId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded(teamId);
    }
  }

  /**
   * Momentum-Chip (Board-Zeile): mangels Pro-Spieltag-Punktereihe die
   * ehrliche leichte Alternative zur Sparkline — `row.rankDiff` (Rang seit
   * Saisonstart) mit Richtung/Ton, wie auch `momentumTeam` andernorts in
   * dieser Session dieses Feld als "Momentum" liest.
   */
  function renderMomentumChip(row: SeasonV2StandingsRow) {
    const hasMomentum = row.rankDiff != null && Number.isFinite(row.rankDiff);
    return (
      <span
        className="nl-standings-momentum-chip"
        title="Formtrend: Rang-Bewegung seit Saisonstart (keine Punkte-Serie pro Spieltag verfügbar)"
      >
        <span className="nl-standings-momentum-chip-label">Form</span>
        {hasMomentum ? (
          <NlDeltaChip
            value={row.rankDiff as number}
            format={(n) => (n === 0 ? "±0" : `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`)}
            title="Rang-Bewegung seit Saisonstart"
            className="nl-standings-momentum-delta"
          />
        ) : (
          <span className="nl-standings-momentum-delta is-flat nl-tnum">—</span>
        )}
      </span>
    );
  }

  function renderAreaMiniBars(row: SeasonV2StandingsRow) {
    return (
      <div className="nl-standings-areas" role="group" aria-label={`Bereichspunkte ${row.teamName}`}>
        {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => {
          const value = getAreaValue(row, group.id);
          return (
            <span
              key={group.id}
              className={`nl-standings-area ${nlToneClass(group.id)}`}
              title={`${group.label}: ${formatNlNumber(value, 1)} Bereichspunkte`}
            >
              <span className="nl-standings-area-label">{group.label}</span>
              <NlProgressBar
                className="nl-standings-area-bar"
                value={getBarPercent(value, areaMaxById[group.id])}
                max={100}
                tone={group.id}
                showValue={false}
              />
              <span className="nl-standings-area-value nl-tnum">{formatNlNumber(value, 0)}</span>
            </span>
          );
        })}
      </div>
    );
  }

  /**
   * Disziplinen nach Bereich gruppiert (POW/SPE/MEN/SOC), je Disziplin
   * Name + Punkte aus `row.disciplineValues` mit dünnem Balken relativ zu
   * `disciplineMaxByKey`. Geteilt zwischen Board-Expand und Daten-Tabelle.
   */
  function renderDisciplineGroups(row: SeasonV2StandingsRow) {
    return (
      <div className="nl-standings-groups">
        {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => {
          const areaValue = getAreaValue(row, group.id);
          return (
            <div key={group.id} className={`nl-standings-group ${nlToneClass(group.id)}`}>
              <div className="nl-standings-group-head">
                <span className="nl-standings-group-label">{group.label}</span>
                <span className="nl-standings-group-total nl-tnum">{formatNlNumber(areaValue, 1)}</span>
              </div>
              <ul className="nl-standings-disc-list">
                {group.keys.map((key) => {
                  const value = row.disciplineValues[key];
                  return (
                    <li key={key} className="nl-standings-disc" title={`${SEASON_DISCIPLINE_LABELS[key]}: ${formatNlNumber(value, 1)}`}>
                      <span className="nl-standings-disc-label">{SEASON_DISCIPLINE_LABELS[key]}</span>
                      <NlProgressBar
                        className="nl-standings-disc-bar"
                        value={getBarPercent(value, disciplineMaxByKey.get(key) ?? 0)}
                        max={100}
                        tone={group.id}
                        showValue={false}
                      />
                      <span className="nl-standings-disc-value nl-tnum">{formatNlNumber(value, 1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  function renderExpandedDetails(row: SeasonV2StandingsRow) {
    const history = row.historicalPointsBySeason ?? [];
    const historyRanks = history
      .filter((entry) => entry.rank != null && Number.isFinite(entry.rank))
      .map((entry) => entry.rank as number);
    const historyPoints = history
      .filter((entry) => entry.points != null && Number.isFinite(entry.points))
      .map((entry) => entry.points as number);
    const bonusValue = row.disciplineValues.bonuspunkte;
    const radarAxes = SEASON_DISCIPLINE_AREA_GROUPS.map((group) => ({
      key: group.id,
      value: getAreaValue(row, group.id) ?? 0,
    }));

    return (
      <div className="nl-standings-expand" id={`nl-standings-details-${row.teamId}`}>
        <div className="nl-standings-expand-head">
          <span className="nl-standings-expand-title">Disziplinen nach Bereich</span>
          <div className="nl-standings-expand-meta">
            {bonusValue != null && Number.isFinite(bonusValue) ? (
              <StatChip label="Bonus" value={formatNlNumber(bonusValue, 1)} tone="accent" title="Bonuspunkte der Saison" />
            ) : null}
            <StatChip
              label="Team"
              value="Profil"
              tone="neutral"
              onClick={() => onOpenTeam(row.teamId)}
              title={`${row.teamName} öffnen`}
            />
          </div>
        </div>
        <div className="nl-standings-expand-body">
        <div className="nl-standings-radar-wrap">
          <span className="nl-standings-radar-label">Stärkeprofil (POW · SPE · MEN · SOC)</span>
          <NlRadar
            axes={radarAxes}
            max={areaRadarMax}
            showValues
            aria-label={`Stärkeprofil ${row.teamName}: ${radarAxes
              .map((axis) => `${axis.key.toUpperCase()} ${formatNlNumber(axis.value, 0)}`)
              .join(", ")}`}
            className="nl-standings-radar"
          />
        </div>
        {renderDisciplineGroups(row)}
        </div>
        {historyRanks.length >= 2 ? (
          <div className="nl-standings-history">
            <span className="nl-standings-history-label">
              Rang über {historyRanks.length} archivierte Saisons (oben = besser)
            </span>
            <NlSparkline
              points={historyRanks.map((rank) => -rank)}
              tone="accent"
              aria-label={`Rang-Verlauf von ${row.teamName} über ${historyRanks.length} Saisons`}
              className="nl-standings-history-spark"
            />
            <span className="nl-standings-history-values nl-tnum">
              {historyRanks.map((rank) => `#${rank}`).join(" · ")}
            </span>
          </div>
        ) : null}
        {historyPoints.length >= 2 ? (
          <div className="nl-standings-history">
            <span className="nl-standings-history-label">
              Punkte über {historyPoints.length} archivierte Saisons
            </span>
            <NlSparkline
              points={historyPoints}
              tone="good"
              aria-label={`Punkte-Verlauf von ${row.teamName} über ${historyPoints.length} Saisons`}
              className="nl-standings-history-spark"
            />
            <span className="nl-standings-history-values nl-tnum">
              {historyPoints.map((points) => formatNlNumber(points, 0)).join(" · ")}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  function renderBoardRow(row: SeasonV2StandingsRow) {
    const isExpanded = expandedTeamId === row.teamId;
    const isPodium = row.rank != null && row.rank >= 1 && row.rank <= 3;
    const medalKind = row.rank === 1 ? "gold" : row.rank === 2 ? "silver" : row.rank === 3 ? "bronze" : null;

    return (
      <li
        key={row.teamId}
        className={`nl-standings-row${row.isSelected ? " is-selected" : ""}${isPodium ? " is-podium" : ""}${isExpanded ? " is-expanded" : ""}`}
        style={getSeasonV2TeamTagStyle(row.teamCode)}
      >
        <div
          className="nl-standings-rowmain"
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-controls={`nl-standings-details-${row.teamId}`}
          onClick={() => toggleExpanded(row.teamId)}
          onKeyDown={(event) => handleRowKeyDown(event, row.teamId)}
        >
          <span className="nl-standings-rank">
            {medalKind ? (
              <NlMedalBadge kind={medalKind} title={`Rang ${row.rank}`} />
            ) : (
              <span className="nl-standings-ranknum nl-tnum">{row.rank ?? "—"}</span>
            )}
            {row.rankDiff != null && Number.isFinite(row.rankDiff) ? (
              <NlDeltaChip
                value={row.rankDiff}
                format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`}
                title="Rang-Bewegung seit Saisonstart"
                className="nl-standings-rankdiff"
              />
            ) : null}
          </span>

          <button
            type="button"
            className="nl-standings-team"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTeam(row.teamId);
            }}
            title={`${row.teamName} öffnen`}
          >
            <BudgetedMediaImage
              src={row.logoUrl}
              alt={`${row.teamName} Logo`}
              className="nl-standings-crest"
              width={32}
              height={32}
              loading="lazy"
              fallback={<span className="nl-standings-crest nl-standings-crest-fallback">{row.logoInitials}</span>}
            />
            <span className="nl-standings-team-copy">
              <span className="nl-standings-teamname">{row.teamName}</span>
              <span className="nl-standings-teamcode">{row.teamCode}</span>
            </span>
          </button>

          <span className="nl-standings-points">
            <span className="nl-standings-points-value nl-tnum">{formatNlNumber(row.points, 1)}</span>
            <NlProgressBar
              value={row.points ?? 0}
              max={leaderPoints > 0 ? leaderPoints : 1}
              tone="accent"
              showValue={false}
              className="nl-standings-points-bar"
              title={`Punkte relativ zum Spitzenreiter (${formatNlNumber(leaderPoints, 1)})`}
            />
          </span>

          {renderAreaMiniBars(row)}

          <StatChipRow className="nl-standings-chips" aria-label={`Kennzahlen ${row.teamName}`}>
            <StatChip
              label="Punkte"
              value={formatNlNumber(row.points, 1)}
              tone="accent"
              onClick={() => openRankingDrawer("points", row.teamId)}
              title={`Punkte-Rangliste — ${row.teamName}`}
            />
            <StatChip
              label="MW"
              value={formatNlMoney(row.marketValueTotal)}
              onClick={() => openRankingDrawer("mw", row.teamId)}
              title={`Marktwert-Rangliste — ${row.teamName}`}
            />
            {renderMomentumChip(row)}
          </StatChipRow>

          <span className="nl-standings-caret" aria-hidden="true">
            {isExpanded ? "▾" : "▸"}
          </span>
        </div>
        {isExpanded ? renderExpandedDetails(row) : null}
      </li>
    );
  }

  /**
   * KPI-Kacheln über der Daten-Tabelle: Rang/Punkte/Rückstand/MW des
   * eigenen Teams — nur wenn ein eigenes Team in dieser Saison existiert.
   */
  function renderDatenKpis() {
    if (!selectedTeamSummary) {
      return null;
    }
    const gapLabel =
      ownGapToLeader == null ? "—" : ownGapToLeader <= 0 ? "Spitze" : formatNlNumber(ownGapToLeader, 1);
    return (
      <StatChipRow className="nl-standings-daten-kpis" label="Dein Team" aria-label="Deine Kennzahlen im Datenmodus">
        <StatChip
          label="Dein Rang"
          value={selectedTeamSummary.rank != null ? `#${selectedTeamSummary.rank}` : "—"}
          tone="accent"
          onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
          title="Punkte-Rangliste"
        />
        <StatChip
          label="Punkte"
          value={formatNlNumber(selectedTeamSummary.points, 1)}
          onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
          title="Punkte-Rangliste"
        />
        <StatChip
          label="Rückstand auf #1"
          value={gapLabel}
          tone={ownGapToLeader != null && ownGapToLeader <= 0 ? "good" : "neutral"}
          title="Punkte-Rückstand auf den aktuellen Spitzenreiter"
        />
        <StatChip
          label="MW"
          value={formatNlMoney(selectedTeamSummary.marketValueTotal)}
          onClick={() => openRankingDrawer("mw", selectedTeamSummary.teamId)}
          title="Marktwert-Rangliste"
        />
      </StatChipRow>
    );
  }

  /**
   * Balkenchart über der Daten-Tabelle: `points` je Team, schwenkt bei
   * aktiver POW/SPE/MEN/SOC-Spaltensortierung auf die Bereichspunkte
   * dieser Spalte um (`datenChartMetric`/`datenChartBars`, s.o.).
   */
  function renderDatenChart() {
    return (
      <div className="nl-standings-daten-chart-scroll">
        <NlBarChart
          bars={datenChartBars}
          format={(value) => formatNlNumber(value, 1)}
          aria-label={datenChartAriaLabel}
          className="nl-standings-daten-chart"
        />
      </div>
    );
  }

  function renderDatenMode() {
    return (
      <>
        {renderDatenKpis()}
        {renderDatenChart()}
        {renderDatenTable()}
      </>
    );
  }

  function renderDatenTable() {
    return (
      <div className="nl-standings-table-shell">
        <table className="nl-standings-table is-compact nl-tnum">
          <thead>
            <tr>
              <th className="nl-standings-th-caret" aria-hidden="true" />
              <th className="nl-standings-th-rank">{renderTableSortHeader("rank", "Rang")}</th>
              <th className="nl-standings-th-team">{renderTableSortHeader("team", "Team")}</th>
              <th>{renderTableSortHeader("points", "Punkte")}</th>
              <th>{renderTableSortHeader("bonus", "Bonus")}</th>
              {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => (
                <th key={group.id} className={`nl-standings-th-areacol ${nlToneClass(group.id)}`}>
                  {renderTableSortHeader(group.id, group.label)}
                </th>
              ))}
              <th>{renderTableSortHeader("mw", "MW")}</th>
            </tr>
          </thead>
          <tbody>{sortedTableRows.map((row) => renderTableRow(row))}</tbody>
        </table>
      </div>
    );
  }

  function renderTableRow(row: SeasonV2StandingsRow) {
    const isExpanded = expandedTeamId === row.teamId;
    return (
      <Fragment key={row.teamId}>
        <tr
          className={`nl-standings-table-row${row.isSelected ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}`}
          onClick={() => toggleExpanded(row.teamId)}
        >
          <td className="nl-standings-td-caret">
            <button
              type="button"
              className="nl-standings-table-caret"
              aria-expanded={isExpanded}
              aria-controls={`nl-standings-tdetails-${row.teamId}`}
              aria-label={isExpanded ? `Disziplinen von ${row.teamName} einklappen` : `Disziplinen von ${row.teamName} ausklappen`}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(row.teamId);
              }}
            >
              <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
            </button>
          </td>
          <td className="nl-standings-td-rank">
            <span className="nl-tnum">{row.rank ?? "—"}</span>
            {row.rankDiff != null && Number.isFinite(row.rankDiff) && row.rankDiff !== 0 ? (
              <NlDeltaChip
                value={row.rankDiff}
                format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`}
                title="Rang-Bewegung seit Saisonstart"
              />
            ) : null}
          </td>
          <td className="nl-standings-td-team">
            <button
              type="button"
              className="nl-standings-table-teamlink"
              onClick={(event) => {
                event.stopPropagation();
                onOpenTeam(row.teamId);
              }}
              title={`${row.teamName} öffnen`}
            >
              <span className="nl-standings-teamname">{row.teamName}</span>
              <span className="nl-standings-teamcode">{row.teamCode}</span>
            </button>
          </td>
          <td className="nl-standings-td-points">{formatNlNumber(row.points, 1)}</td>
          <td className="nl-standings-td-bonus">{formatNlNumber(row.disciplineValues.bonuspunkte, 1)}</td>
          {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => (
            <td key={group.id} className={`nl-standings-td-areacol ${nlToneClass(group.id)}`}>
              {formatNlNumber(getAreaValue(row, group.id), 1)}
            </td>
          ))}
          <td className="nl-standings-td-mw">{formatNlMoney(row.marketValueTotal)}</td>
        </tr>
        {isExpanded ? (
          <tr className="nl-standings-table-detailrow">
            <td className="nl-standings-table-detailcell" colSpan={10} id={`nl-standings-tdetails-${row.teamId}`}>
              <span className="nl-standings-table-detailtitle">Disziplinen nach Bereich</span>
              {renderDisciplineGroups(row)}
            </td>
          </tr>
        ) : null}
      </Fragment>
    );
  }

  function renderPodium() {
    if (podiumRows.length === 0) {
      return null;
    }
    // Spitzenreiter = Team mit den meisten Punkten (erste Zeile, s.o.). Alle
    // Rückstände beziehen sich auf genau diesen Wert, damit Platz 1 immer "Spitze"
    // (Abstand 0) zeigt und kein tiefer platziertes Team fälschlich führt.
    const podiumLeaderPoints = podiumRows[0].points;
    return (
      <ol className="nl-standings-podium" aria-label="Podium — Top 3 nach Punkten">
        {podiumRows.map((row, index) => {
          const medalKind = index === 0 ? "gold" : index === 1 ? "silver" : "bronze";
          const gap =
            row.points != null && Number.isFinite(row.points) && podiumLeaderPoints != null
              ? row.points - podiumLeaderPoints
              : null;
          return (
            <li key={row.teamId} className={`nl-standings-podium-card is-${medalKind}`} style={getSeasonV2TeamTagStyle(row.teamCode)}>
              <button
                type="button"
                className="nl-standings-podium-btn"
                onClick={() => onOpenTeam(row.teamId)}
                title={`${row.teamName} öffnen`}
              >
                <span className="nl-standings-podium-medal">
                  <NlMedalBadge kind={medalKind} title={`Platz ${index + 1} nach Punkten`} />
                </span>
                <span className="nl-standings-podium-copy">
                  <span className="nl-standings-podium-name">{row.teamName}</span>
                  <span className="nl-standings-podium-points nl-tnum">{formatNlNumber(row.points, 1)} Pkt</span>
                </span>
                <span className="nl-standings-podium-gap nl-tnum">
                  {gap == null || gap >= 0 ? "Spitze" : `${formatNlNumber(gap, 1)} zum 1.`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  }

  function renderTopPlayersStrip() {
    if (topPlayersStrip.length === 0) {
      return null;
    }
    return (
      <NlCard className="nl-standings-players-card" eyebrow="Spieler-Highlights" title="Top-Spieler der Saison">
        <ol className="nl-standings-players" aria-label="Top-Spieler der Saison">
          {topPlayersStrip.map((player) => (
            <li key={player.playerId}>
              <button
                type="button"
                className="nl-standings-player"
                onClick={() => onOpenPlayer(player.playerId)}
                title={`${player.name} öffnen`}
              >
                <span className="nl-standings-player-rank nl-tnum">#{player.rank}</span>
                <span className="nl-standings-player-copy">
                  <span className="nl-standings-player-name">{player.name}</span>
                  <span className="nl-standings-player-team">{player.teamCode ?? player.teamName ?? "—"}</span>
                </span>
                <span className="nl-standings-player-pps nl-tnum">{formatNlNumber(player.pps, 1)}</span>
              </button>
            </li>
          ))}
        </ol>
      </NlCard>
    );
  }

  function renderBoardSortBar() {
    return (
      <div className="nl-standings-sortbar" role="group" aria-label="Board sortieren">
        <span className="nl-standings-sortbar-label">Sortieren</span>
        {NL_BOARD_SORT_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nl-standings-sortchip ${nlToneClass(item.id === "rank" ? "accent" : item.id)}${
              boardSort === item.id ? " is-active" : ""
            }`}
            onClick={() => setBoardSort(item.id)}
            aria-pressed={boardSort === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="nl-standings" data-testid="nl-season-standings" data-new-look="true">
      <NlCard
        className="nl-standings-header-card"
        eyebrow={`${sourceBadgeLabel} · ${isArchived ? "Archiv" : "Live"} · ${sourceLabel}`}
        title={`Saisonstand — ${selectedSeasonLabel}`}
        actions={
          <label className="nl-standings-season-select">
            <span>Saison</span>
            <select value={selectedSeasonId} onChange={(event) => onChangeSeason(event.target.value)}>
              {seasonOptions.map((option) => (
                <option key={option.seasonId} value={option.seasonId}>
                  {option.seasonName} {option.status === "active" ? "(aktiv)" : "(Archiv)"}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="nl-standings-header-row">
          <NlSubTabs
            items={NL_STANDINGS_MODE_ITEMS}
            activeId={mode}
            onSelect={(id) => setMode(id as NlStandingsMode)}
            aria-label="Saisonstand Ansicht"
            className="nl-standings-subtabs"
          />
          {selectedTeamSummary ? (
            <StatChipRow label="Dein Team" className="nl-standings-own-chips" aria-label="Dein Team im Saisonstand">
              <StatChip
                label="Rang"
                value={selectedTeamSummary.rank != null ? `#${selectedTeamSummary.rank}` : "—"}
                tone="accent"
                onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
                title="Punkte-Rangliste"
              />
              <StatChip
                label="Punkte"
                value={formatNlNumber(selectedTeamSummary.points, 1)}
                onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
                title="Punkte-Rangliste"
              />
              <StatChip
                label="MW"
                value={formatNlMoney(selectedTeamSummary.marketValueTotal)}
                onClick={() => openRankingDrawer("mw", selectedTeamSummary.teamId)}
                title="Marktwert-Rangliste"
              />
            </StatChipRow>
          ) : null}
        </div>
      </NlCard>

      {isLoading && boardRows.length === 0 ? (
        <div className="nl-standings-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={`nl-standings-skeleton-${index}`} className="nl-standings-skeleton-row" />
          ))}
        </div>
      ) : boardRows.length === 0 ? (
        <NlCard className="nl-standings-empty-card">
          <p className="nl-standings-empty-text">Für diese Saison liegen noch keine Tabellendaten vor.</p>
        </NlCard>
      ) : mode === "board" ? (
        <>
          {renderPodium()}
          {renderTopPlayersStrip()}
          {renderBoardSortBar()}
          <ol className="nl-standings-board" aria-label="Liga-Board">
            {displayBoardRows.map((row) => renderBoardRow(row))}
          </ol>
        </>
      ) : (
        renderDatenMode()
      )}

      <NlRankingDrawer
        open={rankingDrawerMetric != null}
        onClose={closeRankingDrawer}
        metricLabel={rankingDrawerMetric === "mw" ? "MW" : "Punkte"}
        metricKey={rankingDrawerMetric ?? undefined}
        subtitle={`Saisonstand — ${selectedSeasonLabel}`}
        rows={rankingDrawerRows}
        highlightId={rankingDrawerHighlightId}
        onSelectRow={(row) => onOpenTeam(row.id)}
      />
    </div>
  );
}

