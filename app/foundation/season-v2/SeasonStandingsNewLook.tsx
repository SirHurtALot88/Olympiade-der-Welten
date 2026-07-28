"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import "@/app/foundation/season-v2/season-standings-new-look.css";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { RivalTag } from "@/components/foundation/RivalTag";
import {
  NlBarChart,
  NlCard,
  NlCountUpValue,
  NlDeltaChip,
  NlEmptyState,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  NlRankingDrawer,
  NlSkeleton,
  NlSparkline,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  formatNlMoney,
  nlToneClass,
  useCountUp,
  type NlBarChartBar,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import {
  getSeasonV2TeamTagStyle,
  type SeasonStandingsV2ClientProps,
  type SeasonV2StandingsRow,
} from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import { getPoolHeatClass } from "@/lib/foundation/player-league-heat";
import type { SeasonStandingsTopPlayerEntry } from "@/lib/foundation/season-standings-top-players";
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
 * - keine Auf-/Abstiegszonen (kein Zonen-Konzept im Datenmodell).
 *
 * Rang-Movement pro Spieltag (Wave D · D4): `row.fieldRaceRankDelta` trägt
 * jetzt die Δ-Rang-Bewegung gegenüber dem LETZTEN Spieltag aus dem bereits
 * gebauten Feld-Rennen-Ledger (`build-field-race-ledger.ts`,
 * `rankDeltaVsPrev`). Das ist die eigentliche "wer bewegt sich"-Kennzahl des
 * Feldrennens — der Board-Zeilen-Chip liest dieses Feld (▲ Plätze gut / ▼ ab /
 * — am ersten Spieltag). Der Rang-Cell-Chip `row.rankDiff` bleibt die
 * saisonübergreifende Bewegung (aus `historicalPointsBySeason`) und ist davon
 * bewusst getrennt.
 */

type NlStandingsMode = "board" | "daten" | "vereine";

/**
 * Reihenfolge = Angebotsreihenfolge: „Daten" ist der Standard-Einstieg, „Board"
 * die erste Alternative daneben. Welche Ansicht zuletzt aktiv war, merkt sich
 * die App pro Team (s. `readStoredStandingsMode`) — so behält jeder Manager
 * seine eigene Präferenz, ohne dass der Standard für neue Spieler kippt.
 */
const NL_STANDINGS_MODE_ITEMS: Array<{ id: NlStandingsMode; label: string }> = [
  { id: "daten", label: "Daten" },
  { id: "board", label: "Board" },
  { id: "vereine", label: "Vereine" },
];

const NL_STANDINGS_DEFAULT_MODE: NlStandingsMode = "daten";

/**
 * Merkzettel für die zuletzt genutzte Saisonstand-Ansicht. Der Schlüssel hängt
 * am eigenen Team, damit bei mehreren menschlichen Managern auf demselben
 * Rechner (Solo-4 / Online) nicht einer die Präferenz des anderen überschreibt.
 */
function getStandingsModeStorageKey(teamId: string | null | undefined): string {
  const scope = teamId != null && teamId.trim() !== "" ? teamId.trim() : "default";
  return `oly.season-standings.mode:${scope}`;
}

function isStandingsMode(value: unknown): value is NlStandingsMode {
  return value === "board" || value === "daten" || value === "vereine";
}

function readStoredStandingsMode(teamId: string | null | undefined): NlStandingsMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getStandingsModeStorageKey(teamId));
    return isStandingsMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredStandingsMode(teamId: string | null | undefined, mode: NlStandingsMode): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStandingsModeStorageKey(teamId), mode);
  } catch {
    // Private-Mode / vollem Storage: Präferenz ist Komfort, kein Muss.
  }
}

/** Board-Sortierung: nach Rang oder nach einem der vier Bereiche. */
type NlBoardSortKey = "rank" | SeasonDisciplineAreaId;

const NL_BOARD_SORT_ITEMS: Array<{ id: NlBoardSortKey; label: string }> = [
  { id: "rank", label: "Rang" },
  ...SEASON_DISCIPLINE_AREA_GROUPS.map((group) => ({ id: group.id, label: group.label })),
];

/** Spalten der Daten-Tabelle, die per Klick sortierbar sind. */
type NlTableSortKey =
  | "rank"
  | "team"
  | "points"
  | "bonus"
  | SeasonDisciplineAreaId
  | "mw"
  | "cash"
  | "sponsor"
  | "salary"
  | "buildingCost"
  | "transfers"
  | "guv";

/** " is-pos"/" is-neg"-Suffix für Geldwerte, die positiv oder negativ sein können. */
function nlMoneySignClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "";
  return value > 0 ? " is-pos" : " is-neg";
}

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
    case "cash":
      return row.cash != null && Number.isFinite(row.cash) ? row.cash : Number.NEGATIVE_INFINITY;
    case "sponsor":
      return row.sponsorTotal != null && Number.isFinite(row.sponsorTotal) ? row.sponsorTotal : Number.NEGATIVE_INFINITY;
    case "salary":
      return row.salaryTotal != null && Number.isFinite(row.salaryTotal) ? row.salaryTotal : Number.NEGATIVE_INFINITY;
    case "buildingCost":
      return row.buildingCost != null && Number.isFinite(row.buildingCost) ? row.buildingCost : Number.NEGATIVE_INFINITY;
    case "transfers":
      return row.transferNet != null && Number.isFinite(row.transferNet) ? row.transferNet : Number.NEGATIVE_INFINITY;
    case "guv":
      return row.guv != null && Number.isFinite(row.guv) ? row.guv : Number.NEGATIVE_INFINITY;
    default: {
      const value = getAreaValue(row, key);
      return value != null && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
    }
  }
}

/** Zeilentypen für den "Vereine"-Modus — von den Client-Props abgeleitet (#T-098),
 * damit hier keine zweite Typdefinition entsteht. */
type SeasonV2GmRow = SeasonStandingsV2ClientProps["gmRows"][number];
type SeasonV2ArchiveRow = SeasonStandingsV2ClientProps["archiveRows"][number];
type SeasonV2DisciplineLeaderRow = SeasonStandingsV2ClientProps["disciplineLeaders"][number];

function formatArchivedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("de-DE");
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

type StandingsTopPlayersHoverProps = {
  panelId: string;
  /** Spaltenname fürs Panel ("POW", "GEW", …). */
  columnLabel: string;
  teamName: string;
  entries: SeasonStandingsTopPlayerEntry[] | null | undefined;
  /** Der eigentliche Zellenwert — bleibt unverändert gerendert. */
  children: ReactNode;
};

/**
 * Hover-/Fokus-Panel "Top-3-Spieler des Teams in dieser Spalte" — dasselbe
 * Hover-Portal-Vokabular wie `TeamsKpiHoverPortal` in `FoundationTeamsNewLook`
 * (`.nl-teams-rank-portal`/`.nl-teams-rank-preview`, Sichtbarkeit über das
 * `hidden`-Attribut aus React-State statt CSS-`:hover`), damit kein zweites
 * Popover-System entsteht und die bestehenden globals.css-Regeln greifen.
 * Ohne Einträge (z. B. vor dem ersten gewerteten Spieltag oder in einer
 * Archiv-Saison, wo Live-Werte gelogen wären) wird NUR der Wert gerendert —
 * kein leerer Dialog im Accessibility-Tree, keine erfundene Rangfolge.
 */
function StandingsTopPlayersHover({ panelId, columnLabel, teamName, entries, children }: StandingsTopPlayersHoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!entries || entries.length === 0) {
    return <>{children}</>;
  }

  function cancelClose() {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openNow() {
    cancelClose();
    setOpen(true);
  }

  function closeSoon() {
    cancelClose();
    // kleine Verzögerung, damit der Zeiger die Lücke zum Panel überbrücken kann
    closeTimer.current = setTimeout(() => setOpen(false), 90);
  }

  return (
    <span
      className="nl-teams-rank-portal"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={() => {
        cancelClose();
        setOpen(false);
      }}
    >
      {children}
      <div
        id={panelId}
        role="dialog"
        aria-label={`Top-3-Spieler ${teamName} — ${columnLabel}`}
        className="nl-teams-rank-preview"
        hidden={!open}
      >
        <span className="nl-teams-rank-preview-title">
          Top 3 · {columnLabel} — {teamName}
        </span>
        <ol className="nl-teams-rank-preview-list">
          {entries.map((entry, index) => (
            <li key={entry.playerId} className="nl-teams-rank-preview-row">
              <span className="nl-teams-rank-preview-rank nl-tnum">#{index + 1}</span>
              <span className="nl-teams-rank-preview-team">{entry.playerName}</span>
              <span className="nl-teams-rank-preview-points nl-tnum">{formatNlNumber(entry.value, 1)} PPs</span>
            </li>
          ))}
        </ol>
      </div>
    </span>
  );
}

export default function SeasonStandingsNewLook({
  selectedSeasonId,
  selectedSeasonLabel,
  sourceLabel,
  sourceBadgeLabel,
  isArchived,
  seasonOptions,
  selectedTeamSummary,
  leaderTeam,
  momentumTeam,
  pressureTeam,
  standingsRows,
  topPlayers,
  gmRows,
  archiveRows,
  disciplineLeaders,
  rivalTeamIds,
  teamTopPlayersByColumn,
  onChangeSeason,
  onOpenTeam,
  onOpenPlayer,
  onOpenRanks,
  onOpenPrize,
  isLoading = false,
}: SeasonStandingsV2ClientProps) {
  const isRivalTeam = (teamId: string) => rivalTeamIds?.has(teamId) ?? false;
  // Start bewusst deterministisch mit dem Standard (SSR/Client identisch, keine
  // Hydration-Warnung); die gespeicherte Präferenz zieht direkt nach dem Mount nach.
  const [mode, setMode] = useState<NlStandingsMode>(NL_STANDINGS_DEFAULT_MODE);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [boardSort, setBoardSort] = useState<NlBoardSortKey>("rank");
  const [tableSort, setTableSort] = useState<{ key: NlTableSortKey; dir: "asc" | "desc" }>({
    key: "rank",
    dir: "asc",
  });
  // T-101: "Zu meinem Team springen" — scrollt die `.is-selected`-Zeile im
  // Board/in der Tabelle in den sichtbaren Bereich. Root-Ref statt globalem
  // `document.querySelector`, damit nur innerhalb dieser Komponente gesucht wird.
  const rootRef = useRef<HTMLDivElement | null>(null);
  // T-085: Fokus-Ziel für die Pfeiltasten-Navigation der Sortier-Radiogroup.
  const sortBarButtonRefs = useRef<Partial<Record<NlBoardSortKey, HTMLButtonElement | null>>>({});
  // "Neuer Look" (#37, flag-gated, additiv): KPI-Ranking-Drawer statt voller
  // Navigation beim Klick auf Punkte-/MW-Chips — Zeilen kommen aus `boardRows`,
  // das hier schon existiert, es wird nichts neu berechnet.
  const [rankingDrawerMetric, setRankingDrawerMetric] = useState<"points" | "mw" | null>(null);
  const [rankingDrawerHighlightId, setRankingDrawerHighlightId] = useState<string | null>(null);

  // Präferenz-Scope: das eigene Team. Wechselt der Manager (Solo-4/Online) das
  // Team, zieht dessen eigene zuletzt genutzte Ansicht nach.
  const modeScopeTeamId = selectedTeamSummary?.teamId ?? null;

  useEffect(() => {
    const stored = readStoredStandingsMode(modeScopeTeamId);
    setMode(stored ?? NL_STANDINGS_DEFAULT_MODE);
  }, [modeScopeTeamId]);

  const handleModeChange = useCallback(
    (next: NlStandingsMode) => {
      setMode(next);
      writeStoredStandingsMode(modeScopeTeamId, next);
    },
    [modeScopeTeamId],
  );

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

  // Hero-/KPI-Zähler (#Wave2): nur die eigenen Team-Kennzahlen zählen hoch —
  // Board, Podium-Zeilen und Tabelle bleiben unverändert (viele Zeilen, kein
  // Zähler pro Zeile). Respektiert prefers-reduced-motion via `useCountUp`.
  const animatedOwnRank = useCountUp(selectedTeamSummary?.rank ?? null);
  const animatedOwnPoints = useCountUp(selectedTeamSummary?.points ?? null);
  const animatedOwnMarketValue = useCountUp(selectedTeamSummary?.marketValueTotal ?? null);

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

  /**
   * Trägt das Balkenchart überhaupt eine Aussage? Vor dem ersten gewerteten Spieltag steht
   * jedes Team bei 0 — dann bleibt vom Chart nur eine Reihe Nullen über den Teamkürzeln
   * übrig, die eine volle Bildschirmhöhe kostet, ohne etwas zu zeigen. In dem Fall wird es
   * ausgeblendet; sobald irgendein Team einen Wert hat, erscheint es wieder.
   */
  const datenChartHasData = useMemo(
    () => datenChartBars.some((bar) => Number.isFinite(bar.value) && bar.value !== 0),
    [datenChartBars],
  );

  /**
   * Liga-Vergleichspool je Bereichsspalte (POW/SPE/MEN/SOC) für die Heat-Einfärbung der
   * Tabellenzellen. Verglichen wird immer gegen ALLE Teams der Tabelle, nicht gegen die
   * gerade sichtbare Sortierung — die Farbe eines Wertes darf sich nicht ändern, nur weil
   * anders sortiert wird. `getPoolHeatClass` liefert daraus `heat-band-1..8` (rot → grün),
   * dieselbe Skala wie in den Spieler-Tabellen.
   */
  const areaHeatPools = useMemo(() => {
    const pools = {} as Record<SeasonDisciplineAreaId, number[]>;
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
      pools[group.id] = standingsRows
        .map((row) => getAreaValue(row, group.id))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    }
    return pools;
  }, [standingsRows]);

  function toggleExpanded(teamId: string) {
    setExpandedTeamId((current) => (current === teamId ? null : teamId));
  }

  /**
   * T-101 "Zu meinem Team springen": scrollt die aktuell sichtbare
   * `.is-selected`-Zeile (Board-Zeile ODER Tabellenzeile, je nach Modus) in
   * den sichtbaren Bereich. Kein neuer State — reine DOM-Navigation, respektiert
   * `prefers-reduced-motion` (kein Smooth-Scroll bei reduzierter Bewegung).
   */
  function scrollToOwnTeam() {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const target = root.querySelector<HTMLElement>(".is-selected");
    if (!target) {
      return;
    }
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
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
   * Rang-Movement-Chip (Board-Zeile, Wave D · D4): Δ Gesamtrang gegenüber dem
   * LETZTEN Spieltag aus dem Feld-Rennen-Ledger (`fieldRaceRankDelta`). Das ist
   * die eigentliche Pro-Spieltag-Bewegung des Feldrennens (▲ Plätze gut / ▼ ab).
   * Am ersten Spieltag (kein Vorwert) bewusst "—" statt eines erfundenen Deltas.
   */
  function renderMomentumChip(row: SeasonV2StandingsRow) {
    const delta = row.fieldRaceRankDelta;
    const hasDelta = delta != null && Number.isFinite(delta);
    return (
      <span
        className="nl-standings-momentum-chip"
        title="Rang-Movement: Δ Gesamtrang gegenüber dem letzten Spieltag"
      >
        <span className="nl-standings-momentum-chip-label">Spieltag</span>
        {hasDelta ? (
          <NlDeltaChip
            value={delta as number}
            format={(n) => (n === 0 ? "±0" : `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`)}
            title="Rang-Bewegung gegenüber dem letzten Spieltag"
            className="nl-standings-momentum-delta"
          />
        ) : (
          <span className="nl-standings-momentum-delta is-flat nl-tnum" title="Erster Spieltag — noch keine Bewegung">
            —
          </span>
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
              aria-label={`${group.label}: ${formatNlNumber(value, 1)} Bereichspunkte`}
            >
              <span className="nl-standings-area-label">{group.label}</span>
              <NlProgressBar
                className="nl-standings-area-bar"
                value={getBarPercent(value, areaMaxById[group.id])}
                max={100}
                tone={group.id}
                showValue={false}
              />
              {/* Hover auf den Bereichswert: Top-3-Spieler des Teams nach PPs in genau dieser Achse. */}
              <StandingsTopPlayersHover
                panelId={`nl-standings-top3-board-${row.teamId}-${group.id}`}
                columnLabel={group.label}
                teamName={row.teamName}
                entries={teamTopPlayersByColumn?.get(row.teamId)?.[group.id]}
              >
                <span className="nl-standings-area-value nl-tnum">{formatNlNumber(value, 0)}</span>
              </StandingsTopPlayersHover>
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
                    <li
                      key={key}
                      className="nl-standings-disc"
                      title={`${SEASON_DISCIPLINE_LABELS[key]}: ${formatNlNumber(value, 1)}`}
                      aria-label={`${SEASON_DISCIPLINE_LABELS[key]}: ${formatNlNumber(value, 1)}`}
                    >
                      <span className="nl-standings-disc-label">{SEASON_DISCIPLINE_LABELS[key]}</span>
                      <NlProgressBar
                        className="nl-standings-disc-bar"
                        value={getBarPercent(value, disciplineMaxByKey.get(key) ?? 0)}
                        max={100}
                        tone={group.id}
                        showValue={false}
                      />
                      {/* Hover auf den Disziplinwert: Top-3-Spieler des Teams nach PPs in genau dieser Disziplin. */}
                      <StandingsTopPlayersHover
                        panelId={`nl-standings-top3-disc-${row.teamId}-${key}`}
                        columnLabel={SEASON_DISCIPLINE_LABELS[key]}
                        teamName={row.teamName}
                        entries={teamTopPlayersByColumn?.get(row.teamId)?.[key]}
                      >
                        <span className="nl-standings-disc-value nl-tnum">{formatNlNumber(value, 1)}</span>
                      </StandingsTopPlayersHover>
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

  function renderBoardRow(row: SeasonV2StandingsRow, revealIndex: number) {
    const isExpanded = expandedTeamId === row.teamId;
    const isPodium = row.rank != null && row.rank >= 1 && row.rank <= 3;
    const medalKind = row.rank === 1 ? "gold" : row.rank === 2 ? "silver" : row.rank === 3 ? "bronze" : null;

    return (
      <li
        key={row.teamId}
        className={`nl-standings-row nl-reveal${row.isSelected ? " is-selected" : ""}${isRivalTeam(row.teamId) ? " is-rival" : ""}${isPodium ? " is-podium" : ""}${isExpanded ? " is-expanded" : ""}`}
        style={{ ...getSeasonV2TeamTagStyle(row.teamCode), "--nl-reveal-i": Math.min(revealIndex, 14) } as CSSProperties}
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
              <span className="nl-standings-teamname">
                {row.teamName}
                {isRivalTeam(row.teamId) ? <RivalTag /> : null}
              </span>
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
          value={
            selectedTeamSummary.rank != null ? `#${formatNlNumber(animatedOwnRank ?? selectedTeamSummary.rank, 0)}` : "—"
          }
          tone="accent"
          onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
          title="Punkte-Rangliste"
        />
        <StatChip
          label="Punkte"
          value={formatNlNumber(animatedOwnPoints ?? selectedTeamSummary.points, 1)}
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
          value={formatNlMoney(animatedOwnMarketValue ?? selectedTeamSummary.marketValueTotal)}
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
    // Ohne Werte kein Chart — sonst steht nur eine Nullen-Reihe über den Teamkürzeln.
    if (!datenChartHasData) {
      return null;
    }
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

  /**
   * Top-10-Spieler direkt neben dem Balkenchart: der Chart deckt nur die linke
   * Hälfte der Zeile ab, rechts blieb bisher eine große leere Fläche. Gleiche
   * Kacheln wie im Board (`.nl-standings-player`), hier aber als Raster —
   * bei genug Breite zwei Reihen à fünf Spieler statt eines Scroll-Streifens.
   */
  function renderDatenTopPlayers() {
    if (topPlayersStrip.length === 0) {
      return null;
    }
    return (
      <div className="nl-standings-daten-players">
        <p className="nl-standings-daten-players-eyebrow">Top-Spieler der Saison</p>
        <ol className="nl-standings-daten-players-grid" aria-label="Top-Spieler der Saison">
          {topPlayersStrip.map((player, index) => (
            <li key={player.playerId} className="nl-reveal" style={{ "--nl-reveal-i": index } as CSSProperties}>
              <button
                type="button"
                className="nl-standings-player"
                onClick={() => onOpenPlayer(player.playerId)}
                title={`${player.name} öffnen`}
              >
                <span className="nl-standings-player-rank nl-tnum">#{player.rank}</span>
                <BudgetedMediaImage
                  src={player.portraitUrl}
                  alt={`${player.name} Portrait`}
                  className="nl-standings-player-portrait"
                  width={30}
                  height={30}
                  loading="lazy"
                  fallback={
                    <span className="nl-standings-player-portrait nl-standings-player-portrait-fallback" aria-hidden="true">
                      {player.portraitInitials}
                    </span>
                  }
                />
                <span className="nl-standings-player-copy">
                  <span className="nl-standings-player-name">{player.name}</span>
                  <span className="nl-standings-player-team">{player.teamCode ?? player.teamName ?? "—"}</span>
                </span>
                <span className="nl-standings-player-pps nl-tnum">{formatNlNumber(player.pps, 1)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  function renderDatenMode() {
    return (
      <>
        {renderDatenKpis()}
        <div className="nl-standings-daten-chartrow">
          {renderDatenChart()}
          {renderDatenTopPlayers()}
        </div>
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
              <th className="nl-standings-th-fin">{renderTableSortHeader("cash", "Cash")}</th>
              <th className="nl-standings-th-fin">{renderTableSortHeader("sponsor", "Sponsoren")}</th>
              <th className="nl-standings-th-fin">{renderTableSortHeader("salary", "Gehälter")}</th>
              <th className="nl-standings-th-fin">{renderTableSortHeader("buildingCost", "Gebäude")}</th>
              <th className="nl-standings-th-fin">{renderTableSortHeader("transfers", "Transfers")}</th>
              <th className="nl-standings-th-fin">{renderTableSortHeader("guv", "GuV")}</th>
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
          className={`nl-standings-table-row${row.isSelected ? " is-selected" : ""}${isRivalTeam(row.teamId) ? " is-rival" : ""}${isExpanded ? " is-expanded" : ""}`}
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
              <span className="nl-standings-teamname">
                {row.teamName}
                {isRivalTeam(row.teamId) ? <RivalTag /> : null}
              </span>
              <span className="nl-standings-teamcode">{row.teamCode}</span>
            </button>
          </td>
          <td className="nl-standings-td-points">{formatNlNumber(row.points, 1)}</td>
          <td className="nl-standings-td-bonus">{formatNlNumber(row.disciplineValues.bonuspunkte, 1)}</td>
          {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => {
            const areaValue = getAreaValue(row, group.id);
            // Liga-Heat der Bereichsspalte: rot (schwach) → gelb (Mittelfeld) → grün (stark),
            // dieselben Bänder wie in den Spieler-Tabellen. Die Zell-CSS zieht daraus nur eine
            // dezente Hinterlegung, damit die Bereichsfarbe der Zahl lesbar bleibt.
            const heatClass = getPoolHeatClass(areaValue, areaHeatPools[group.id]);
            return (
              <td key={group.id} className={`nl-standings-td-areacol ${nlToneClass(group.id)}${heatClass ? ` ${heatClass}` : ""}`}>
                {/* Hover auf die Bereichsspalte: Top-3-Spieler des Teams nach PPs in dieser Achse. */}
                <StandingsTopPlayersHover
                  panelId={`nl-standings-top3-table-${row.teamId}-${group.id}`}
                  columnLabel={group.label}
                  teamName={row.teamName}
                  entries={teamTopPlayersByColumn?.get(row.teamId)?.[group.id]}
                >
                  {formatNlNumber(areaValue, 1)}
                </StandingsTopPlayersHover>
              </td>
            );
          })}
          <td className="nl-standings-td-mw">{formatNlMoney(row.marketValueTotal)}</td>
          <td className="nl-standings-td-fin">{formatNlMoney(row.cash)}</td>
          <td className={`nl-standings-td-fin${row.sponsorTotal ? " is-pos" : ""}`}>{formatNlMoney(row.sponsorTotal)}</td>
          <td className="nl-standings-td-fin">{formatNlMoney(row.salaryTotal)}</td>
          <td className="nl-standings-td-fin">{formatNlMoney(row.buildingCost)}</td>
          <td className={`nl-standings-td-fin${nlMoneySignClass(row.transferNet)}`}>{formatNlMoney(row.transferNet)}</td>
          <td className={`nl-standings-td-fin${nlMoneySignClass(row.guv)}`}>{formatNlMoney(row.guv)}</td>
        </tr>
        {isExpanded ? (
          <tr className="nl-standings-table-detailrow">
            <td className="nl-standings-table-detailcell" colSpan={16} id={`nl-standings-tdetails-${row.teamId}`}>
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
            <li
              key={row.teamId}
              className={`nl-standings-podium-card is-${medalKind} nl-reveal`}
              style={{ ...getSeasonV2TeamTagStyle(row.teamCode), "--nl-reveal-i": index } as CSSProperties}
            >
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
                  <span className="nl-standings-podium-points nl-tnum">
                    <NlCountUpValue value={row.points} format={(value) => formatNlNumber(value, 1)} /> Pkt
                  </span>
                </span>
                <span className="nl-standings-podium-gap nl-tnum">
                  {gap == null || gap >= 0
                    ? index === 0
                      ? "Spitze"
                      : "Gleichauf"
                    : `${formatNlNumber(gap, 1)} zum 1.`}
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
          {topPlayersStrip.map((player, index) => (
            <li key={player.playerId} className="nl-reveal" style={{ "--nl-reveal-i": index } as CSSProperties}>
              <button
                type="button"
                className="nl-standings-player"
                onClick={() => onOpenPlayer(player.playerId)}
                title={`${player.name} öffnen`}
              >
                <span className="nl-standings-player-rank nl-tnum">#{player.rank}</span>
                <BudgetedMediaImage
                  src={player.portraitUrl}
                  alt={`${player.name} Portrait`}
                  className="nl-standings-player-portrait"
                  width={30}
                  height={30}
                  loading="lazy"
                  fallback={
                    <span className="nl-standings-player-portrait nl-standings-player-portrait-fallback" aria-hidden="true">
                      {player.portraitInitials}
                    </span>
                  }
                />
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

  /**
   * T-098: "Im Fokus"-Chips für Spitzenreiter/Momentum/Druck-Team — dieselben
   * Zeilen, die `useSeasonV2PanelModel` schon berechnet (`leaderTeam`,
   * `momentumTeam`, `pressureTeam`), bislang aber nirgends im "Neuer Look"
   * gerendert wurden.
   */
  function renderVereineHighlights() {
    const items: Array<{ key: string; label: string; row: SeasonV2StandingsRow | null; tone: NlTone }> = [
      { key: "leader", label: "Spitzenreiter", row: leaderTeam, tone: "good" },
      { key: "momentum", label: "Bestes Momentum", row: momentumTeam, tone: "accent" },
      { key: "pressure", label: "Unter Druck", row: pressureTeam, tone: "risk" },
    ];
    const visible = items.filter(
      (item): item is { key: string; label: string; row: SeasonV2StandingsRow; tone: NlTone } => item.row != null,
    );
    if (visible.length === 0) {
      return null;
    }
    return (
      <StatChipRow label="Im Fokus" className="nl-standings-vereine-focus" aria-label="Teams im Fokus dieser Saison">
        {visible.map((item) => (
          <StatChip
            key={item.key}
            label={item.label}
            value={item.row.teamCode}
            sub={item.row.teamName}
            tone={item.tone}
            onClick={() => onOpenTeam(item.row.teamId)}
            title={`${item.row.teamName} öffnen`}
          />
        ))}
      </StatChipRow>
    );
  }

  /**
   * T-098: GM-Büro — ein Team-Steckbrief je Verein (Name, GM, Board-Vertrauen)
   * statt der bisherigen Roh-Tabellen-Optik. Reicht dieselbe
   * `nl-standings-player`-Pillen-Optik wie der Top-Spieler-Streifen weiter,
   * damit keine neuen CSS-Regeln nötig sind.
   */
  function renderGmSection() {
    if (gmRows.length === 0) {
      return (
        <NlCard className="nl-standings-players-card" eyebrow="Verwaltungsrat" title="GM-Büro je Verein">
          <NlEmptyState
            title="Kein GM-Büro besetzt"
            message="Für diese Saison sind noch keine General Manager hinterlegt."
          />
        </NlCard>
      );
    }
    return (
      <NlCard className="nl-standings-players-card" eyebrow="Verwaltungsrat" title="GM-Büro je Verein">
        <ol className="nl-standings-players nl-standings-gm-list nl-standings-gm-grid" aria-label="General Manager je Verein">
          {gmRows.map((row: SeasonV2GmRow, index: number) => {
            const confidenceLabel =
              row.boardConfidenceValue != null && Number.isFinite(row.boardConfidenceValue)
                ? `${formatNlNumber(row.boardConfidenceValue, 1)}/10`
                : "—";
            return (
              <li key={row.teamId} className="nl-reveal" style={{ "--nl-reveal-i": Math.min(index, 14) } as CSSProperties}>
                <button
                  type="button"
                  className="nl-standings-player"
                  onClick={() => onOpenTeam(row.teamId)}
                  title={`${row.teamName} öffnen`}
                >
                  <BudgetedMediaImage
                    src={row.logoUrl}
                    alt={`${row.teamName} Logo`}
                    className="nl-standings-player-portrait"
                    width={30}
                    height={30}
                    loading="lazy"
                    fallback={
                      <span className="nl-standings-player-portrait nl-standings-player-portrait-fallback" aria-hidden="true">
                        {row.logoInitials}
                      </span>
                    }
                  />
                  <span className="nl-standings-player-copy">
                    <span className="nl-standings-player-name">{row.gmName ?? "Kein GM berufen"}</span>
                    <span className="nl-standings-player-team">
                      {row.teamCode}
                      {row.gmTitle ? ` · ${row.gmTitle}` : ""}
                    </span>
                  </span>
                  <span className="nl-standings-player-pps nl-tnum" title="Board-Vertrauen (0–10)">
                    {confidenceLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </NlCard>
    );
  }

  /**
   * T-098: Disziplin-Rekordhalter (`disciplineLeaders`) — führt zum
   * bestehenden `onOpenPlayer`-Handler, keine neue Navigation nötig.
   */
  function renderDisciplineLeadersSection() {
    if (disciplineLeaders.length === 0) {
      return (
        <NlCard className="nl-standings-players-card" eyebrow="Rekorde" title="Disziplin-Rekordhalter">
          <NlEmptyState
            title="Noch keine Rekordhalter"
            message="Noch keine Disziplin-Rekorde in dieser Saison."
          />
        </NlCard>
      );
    }
    return (
      <NlCard className="nl-standings-players-card" eyebrow="Rekorde" title="Disziplin-Rekordhalter">
        <ol className="nl-standings-players nl-standings-discleader-list" aria-label="Disziplin-Rekordhalter der Saison">
          {disciplineLeaders.map((leader: SeasonV2DisciplineLeaderRow, index: number) => (
            <li key={leader.disciplineId} className="nl-reveal" style={{ "--nl-reveal-i": index } as CSSProperties}>
              <button
                type="button"
                className="nl-standings-player"
                onClick={() => onOpenPlayer(leader.playerId)}
                title={`${leader.playerName} öffnen`}
              >
                <span className="nl-standings-player-portrait nl-standings-player-portrait-fallback" aria-hidden="true">
                  {leader.teamCode ?? "—"}
                </span>
                <span className="nl-standings-player-copy">
                  <span className="nl-standings-player-name">{leader.playerName}</span>
                  <span className="nl-standings-player-team">
                    {leader.disciplineName} · {leader.appearances}×
                  </span>
                </span>
                <span className="nl-standings-player-pps nl-tnum">
                  {leader.totalContribution != null ? formatNlNumber(leader.totalContribution, 1) : "—"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </NlCard>
    );
  }

  /**
   * T-098: Saison-Archiv — Klick springt über den bereits vorhandenen
   * `onChangeSeason`-Handler direkt in die archivierte Saison (keine neue
   * Navigation, nur eine weitere Ansicht auf `seasonOptions`/`onChangeSeason`).
   */
  function renderArchiveSection() {
    if (archiveRows.length === 0) {
      return (
        <NlCard className="nl-standings-players-card" eyebrow="Historie" title="Archivierte Saisons">
          <NlEmptyState title="Kein Saison-Archiv" message="Kein Saison-Archiv vorhanden." />
        </NlCard>
      );
    }
    return (
      <NlCard className="nl-standings-players-card" eyebrow="Historie" title="Archivierte Saisons">
        <ol className="nl-standings-players nl-standings-archive-list" aria-label="Archivierte Saisons">
          {archiveRows.map((row: SeasonV2ArchiveRow, index: number) => {
            const archivedLabel = formatArchivedAt(row.archivedAt);
            return (
              <li key={row.seasonId} className="nl-reveal" style={{ "--nl-reveal-i": index } as CSSProperties}>
                <button
                  type="button"
                  className="nl-standings-player"
                  onClick={() => onChangeSeason(row.seasonId)}
                  title={`${row.seasonName} öffnen`}
                >
                  <span className="nl-standings-player-portrait nl-standings-player-portrait-fallback" aria-hidden="true">
                    {row.seasonName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="nl-standings-player-copy">
                    <span className="nl-standings-player-name">{row.seasonName}</span>
                    <span className="nl-standings-player-team">
                      {archivedLabel ? `Archiviert ${archivedLabel}` : "Archiviert"} · {row.teamCount} Teams
                    </span>
                  </span>
                  <span className="nl-standings-player-pps nl-tnum" title="Spieler in dieser Saison">
                    {formatNlNumber(row.playerCount, 0)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </NlCard>
    );
  }

  function renderVereineMode() {
    // T-098: Alle vier Vereine-Blöcke rendern immer — GM-Büro, Disziplin-
    // Rekordhalter und Archiv zeigen bei fehlenden Daten einen eigenen
    // `NlEmptyState` (Header + Hinweis) statt still zu verschwinden.
    return (
      <>
        {renderVereineHighlights()}
        {renderGmSection()}
        {renderDisciplineLeadersSection()}
        {renderArchiveSection()}
      </>
    );
  }

  /**
   * T-085: die Sortier-Leiste ist eine exklusive Auswahl (genau ein aktiver
   * Sort-Key), also `role="radiogroup"` mit `role="radio"`-Items statt
   * `aria-pressed`-Buttons ohne Tastatur-Navigation. Pfeil-/Home-/End-Tasten
   * bewegen Auswahl UND Fokus gemeinsam (Roving-Tabindex-Muster).
   */
  function handleBoardSortKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = NL_BOARD_SORT_ITEMS.findIndex((item) => item.id === boardSort);
    if (currentIndex === -1) {
      return;
    }
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % NL_BOARD_SORT_ITEMS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + NL_BOARD_SORT_ITEMS.length) % NL_BOARD_SORT_ITEMS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = NL_BOARD_SORT_ITEMS.length - 1;
    }
    if (nextIndex == null) {
      return;
    }
    event.preventDefault();
    const nextItem = NL_BOARD_SORT_ITEMS[nextIndex];
    setBoardSort(nextItem.id);
    sortBarButtonRefs.current[nextItem.id]?.focus();
  }

  function renderBoardSortBar() {
    return (
      <div
        className="nl-standings-sortbar"
        role="radiogroup"
        aria-label="Board sortieren"
        onKeyDown={handleBoardSortKeyDown}
      >
        <span className="nl-standings-sortbar-label">Sortieren</span>
        {NL_BOARD_SORT_ITEMS.map((item) => {
          const isActive = boardSort === item.id;
          return (
            <button
              key={item.id}
              type="button"
              ref={(el) => {
                sortBarButtonRefs.current[item.id] = el;
              }}
              className={`nl-standings-sortchip ${nlToneClass(item.id === "rank" ? "accent" : item.id)}${
                isActive ? " is-active" : ""
              }`}
              onClick={() => setBoardSort(item.id)}
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="nl-standings" data-testid="nl-season-standings" data-new-look="true" ref={rootRef}>
      <NlCard
        className="nl-standings-header-card"
        eyebrow={`${sourceBadgeLabel} · ${isArchived ? "Archiv" : "Live"} · ${sourceLabel}`}
        title={`Saisonstand — ${selectedSeasonLabel}`}
        actions={
          <>
            {onOpenRanks || onOpenPrize ? (
              <StatChipRow className="nl-standings-quicklinks" aria-label="Weitere Übersichten">
                {onOpenRanks ? (
                  <StatChip label="Ränge" value="Öffnen" onClick={onOpenRanks} title="Zur Rangliste wechseln" />
                ) : null}
                {onOpenPrize ? (
                  <StatChip label="Sponsoren" value="Öffnen" onClick={onOpenPrize} title="Sponsoren-Übersicht öffnen" />
                ) : null}
              </StatChipRow>
            ) : null}
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
          </>
        }
      >
        <div className="nl-standings-header-row">
          <NlSubTabs
            items={NL_STANDINGS_MODE_ITEMS}
            activeId={mode}
            onSelect={(id) => handleModeChange(id as NlStandingsMode)}
            aria-label="Saisonstand Ansicht"
            className="nl-standings-subtabs"
          />
          {selectedTeamSummary ? (
            <StatChipRow label="Dein Team" className="nl-standings-own-chips" aria-label="Dein Team im Saisonstand">
              <StatChip
                label="Rang"
                value={
                  selectedTeamSummary.rank != null
                    ? `#${formatNlNumber(animatedOwnRank ?? selectedTeamSummary.rank, 0)}`
                    : "—"
                }
                tone="accent"
                onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
                title="Punkte-Rangliste"
              />
              <StatChip
                label="Punkte"
                value={formatNlNumber(animatedOwnPoints ?? selectedTeamSummary.points, 1)}
                onClick={() => openRankingDrawer("points", selectedTeamSummary.teamId)}
                title="Punkte-Rangliste"
              />
              <StatChip
                label="MW"
                value={formatNlMoney(animatedOwnMarketValue ?? selectedTeamSummary.marketValueTotal)}
                onClick={() => openRankingDrawer("mw", selectedTeamSummary.teamId)}
                title="Marktwert-Rangliste"
              />
              {mode !== "vereine" ? (
                <StatChip
                  label="Team"
                  value="Springen"
                  onClick={scrollToOwnTeam}
                  title="Zu deinem Team im Board springen"
                />
              ) : null}
            </StatChipRow>
          ) : null}
        </div>
      </NlCard>

      {isLoading && boardRows.length === 0 ? (
        <div className="nl-standings-skeleton" role="status" aria-busy="true">
          <span className="sr-only">Tabellendaten werden geladen …</span>
          {Array.from({ length: 6 }, (_, index) => (
            <NlSkeleton key={`nl-standings-skeleton-${index}`} variant="block" height={54} />
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
            {displayBoardRows.map((row, index) => renderBoardRow(row, index))}
          </ol>
        </>
      ) : mode === "vereine" ? (
        renderVereineMode()
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

