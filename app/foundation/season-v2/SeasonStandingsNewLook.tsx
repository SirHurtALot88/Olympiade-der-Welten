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
import PlayerStarFrame from "@/components/foundation/player-portrait-card/PlayerStarFrame";
import { buildGuvBreakdown } from "@/lib/finance/guv-breakdown";
import { getPlayerStarTier } from "@/lib/foundation/player-star-tier";
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
  type NlBarChartBar,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import { VeloPendingRanking } from "@/components/foundation/velo-ui";
import {
  getSeasonV2TeamTagStyle,
  type SeasonStandingsV2ClientProps,
  type SeasonV2StandingsRow,
} from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import type { SeasonStandingsTopPlayerEntry } from "@/lib/foundation/season-standings-top-players";
import type { SeasonFormCardBonusEntry } from "@/lib/foundation/season-form-card-bonus";
import { buildValueRanks as buildTeamValueRanks } from "@/lib/season/season-value-ranks";
import {
  resolveSeasonDisciplineAreaTotal,
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER,
  SEASON_DISCIPLINE_LABELS,
  type SeasonDisciplineAreaId,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";
import {
  MAX_PLAYERS_PER_MATCHDAY,
  MAX_POINTS_PER_MATCHDAY,
  POINTS_PER_PARTICIPATING_PLAYER,
} from "@/lib/season/title-race";

/**
 * "Neuer Look" Saisonstand — Liga-Board (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `SeasonStandingsV2Client` fällt ohne Flag unverändert auf das bestehende
 * Layout zurück. Konsumiert exakt dieselben Props/Daten wie der alte Client.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten gibt:
 * - keine Auf-/Abstiegszonen (kein Zonen-Konzept im Datenmodell).
 *
 * Meisterschaftskampf (Chris' Wunsch, `lib/season/title-race.ts`): NUR am letzten Spieltag,
 * solange er noch läuft — der Host rechnet das Zeitfenster fertig vor und reicht das Ergebnis
 * über `titleRace` durch (`null` = kein Fenster, auch im Archiv). Diese Komponente bekommt nur
 * das fertige Ergebnis, kein `gameState`.
 *
 * Rang-Movement pro Spieltag (Wave D · D4): `row.fieldRaceRankDelta` trägt
 * jetzt die Δ-Rang-Bewegung gegenüber dem LETZTEN Spieltag aus dem bereits
 * gebauten Feld-Rennen-Ledger (`build-field-race-ledger.ts`,
 * `rankDeltaVsPrev`). Das ist die eigentliche "wer bewegt sich"-Kennzahl des
 * Feldrennens — der Board-Zeilen-Chip liest dieses Feld (▲ Plätze gut / ▼ ab /
 * — am ersten Spieltag).
 *
 * Die Rang-Spalte der Daten-Tabelle liest jetzt dieselbe Größe
 * (`renderRankMovementChip`). Vorher hing sie allein an `row.rankDiff`, der
 * saisonübergreifenden Bewegung — die wird aber erst beim Saisonabschluss
 * geschrieben und stand deshalb die ganze laufende Saison über auf 0/leer.
 * `rankDiff` bleibt als Rückfallebene erhalten (eigener Tooltip), damit die
 * beiden Größen unterscheidbar bleiben.
 */

export type NlStandingsMode = "board" | "daten" | "vereine";

/**
 * Reihenfolge = Angebotsreihenfolge: „Daten" ist der Standard-Einstieg, „Board"
 * die erste Alternative daneben. Welche Ansicht zuletzt aktiv war, merkt sich
 * die App pro Team (s. `readStoredStandingsMode`) — so behält jeder Manager
 * seine eigene Präferenz, ohne dass der Standard für neue Spieler kippt.
 *
 * EXPORTIERT, damit die Zusicherung „der Saisonstand öffnet in der Datenansicht,
 * es gibt ein Board, es gibt KEINE Karten-Ansicht" über WERTE prüfbar ist statt
 * über eine Zeichenkette im Quelltext. Die alte Prüfung suchte nach dem Wortlaut
 * `SEASON_V2_DEFAULT_MODE … "table"` und zerbrach an der reinen Umbenennung, ohne
 * je etwas über die Ansicht selbst gesagt zu haben (vgl. tests/
 * season-standings-v2-ui-contract.test.ts).
 */
export const NL_STANDINGS_MODE_ITEMS: Array<{ id: NlStandingsMode; label: string }> = [
  { id: "daten", label: "Daten" },
  { id: "board", label: "Board" },
  { id: "vereine", label: "Vereine" },
];

export const NL_STANDINGS_DEFAULT_MODE: NlStandingsMode = "daten";

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
  | "formCards"
  | "formCardsLeft"
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

function getTableSortValue(
  row: SeasonV2StandingsRow,
  key: NlTableSortKey,
  formCardTotalByTeamId?: Map<string, number> | null,
  formCardLeftByTeamId?: Map<string, number> | null,
): number | string {
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
    case "formCards": {
      // Teams ohne Formkarten sortieren ans Ende der Absteigend-Sicht (kein stiller
      // 0-Wert, der einen leeren Tank vortäuschen würde, den es gar nicht gibt).
      const total = formCardTotalByTeamId?.get(row.teamId);
      return total != null && Number.isFinite(total) ? total : Number.NEGATIVE_INFINITY;
    }
    case "formCardsLeft": {
      const left = formCardLeftByTeamId?.get(row.teamId);
      return left != null && Number.isFinite(left) ? left : Number.NEGATIVE_INFINITY;
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

/**
 * Tooltip für eine Top-Spieler-Kachel (Daten-Modus + Board-Streifen). Chris'
 * Regel „bei 0 wird erklärt, nicht versteckt": das „—" bei PPs ist vor
 * Spieltag 1 der Normalfall (noch keine Punkte vergeben), nicht `null` als
 * Datenfehler — der Tooltip sagt das, statt den Strich unkommentiert stehen
 * zu lassen.
 */
function buildTopPlayerTitle(player: { name: string; pps: number | null }): string {
  return player.pps == null ? `${player.name} öffnen — PPs füllen sich ab Spieltag 1` : `${player.name} öffnen`;
}

/**
 * Rang-Bänder der Bereichsspalten im Saisonstand: Top 3 grün, 4–6 gelb, 7–10 rot,
 * ab 11 keine Hinterlegung. Bewusst absolute Ränge statt Perzentilen — so sieht man
 * auf einen Blick, wer in einer Achse wirklich vorne bzw. hinten dran ist, unabhängig
 * davon wie eng die Liga beieinander liegt. Die Schriftfarbe bleibt die Achsenfarbe.
 */
function getAreaRankBandClass(rank: number | undefined): string {
  if (!rank || !Number.isFinite(rank)) {
    return "";
  }
  if (rank <= 3) {
    return "nl-rankband-good";
  }
  if (rank <= 6) {
    return "nl-rankband-warn";
  }
  if (rank <= 10) {
    return "nl-rankband-risk";
  }
  return "";
}

/**
 * Liga-Rang je Team für eine Kennzahl, immer über ALLE Zeilen (nicht über die
 * gerade sichtbare Sortierung) — größter Wert = #1.
 *
 * Bei Gleichstand bekommt die ganze Gruppe den SCHLECHTESTEN Rang (1,3,3,4 …)
 * statt des besten. Grund: zu Saisonbeginn stehen ganze Spalten auf 0; mit
 * "bester Rang für alle" würde eine komplett unbespielte Spalte lauter #1
 * ausweisen, obwohl niemand etwas geholt hat.
 */
/**
 * Duenne Huelle um `buildValueRanks` aus `lib/season/season-value-ranks` — die Rechnung selbst
 * liegt dort, weil die Sponsoren-Ziele denselben Rang lesen muessen wie diese Tabelle. Liefe die
 * Zielpruefung auf einer eigenen Rechnung, koennte sie einem Spieler eine Zielmarke verweigern,
 * die seine eigene Tabelle bestaetigt.
 */
function buildValueRanks(
  rows: SeasonV2StandingsRow[],
  getValue: (row: SeasonV2StandingsRow) => number | null | undefined,
): Map<string, number> {
  return buildTeamValueRanks(rows, (row) => row.teamId, getValue);
}

/**
 * „#3" hinter einer PP-Zahl — der Liga-Rang, den dieser Wert bedeutet.
 *
 * GEMELDET VON CHRIS: „5 PPs geholt was rang 3 entspricht — finde das ist eine Info, die überall
 * sein sollte, wo man PPs sieht."
 *
 * Bewusst dieselbe Klasse (`nl-standings-rank-suffix`, inkl. Gold für #1) wie der Rang hinter
 * Marktwert und Gehältern eine Tabelle weiter — dort steht schon exakt dieselbe Aussage in
 * derselben Form. Zwei Schreibweisen für „Rang hinter einem Wert" wären eine Sprache zu viel.
 *
 * Kein Rang OHNE Punkte: bei 0 (oder fehlendem Wert) stünden reihum alle auf demselben Rang, und
 * ein „#28" neben einer 0 liest sich wie eine Wertung, wo schlicht nichts passiert ist.
 */
function renderLeagueRankSuffix(
  rank: number | undefined,
  label: string,
  value: number | null | undefined,
) {
  if (rank == null || !Number.isFinite(rank) || value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return (
    <span
      className={`nl-standings-rank-suffix nl-tnum${rank === 1 ? " is-top" : ""}`}
      title={`${label}: Liga-Rang ${rank} nach geholten PPs`}
    >
      #{rank}
    </span>
  );
}

/**
 * DER BONUS STAND ZWEIMAL IN DERSELBEN ZEILE.
 *
 * `disciplineValues.bonuspunkte` ist der Mutator-Aufschlag der Saison
 * (`season-points-ledger.ts`: `teamSummary.mutatorPpsBonus`). Derselbe Aufschlag steckt aber
 * bereits in JEDER Disziplin-Spalte: der Ledger bucht je Spieler-Zeile
 * `points = Anteil + mutatorPpsBonus` (`resolveAwardedPlayerPoints`) und summiert genau
 * dieses `points` nach `pointsByDiscipline` — und daraus baut `mergeSeasonDisciplineValues`
 * die 20 Disziplin-Spalten und die vier Bereichs-Spalten.
 *
 * Am Live-Abbild vom 11.08. nachgerechnet, beide aktiven Staende, alle 32 Teams:
 * `Σ Disziplin-Spalten − Punkte-Spalte == Bonus-Spalte`, 32 von 32, Abweichung 0,0.
 * Beispiel aus dem aktiven Save `new-game-1786465783606-0kalpx` (Saison 1, Spieltag 2):
 * Pirate Crew — Punkte 20,5 · Bonus 0,3 · Σ Disziplinen 20,8. Betroffen 25 von 32 Teams
 * (0,3–1,2); am Messkoerper `new-game-1785823388048-1hf25q` (Saison 2, Spieltag 10) 32 von 32
 * mit bis zu 6,3 (B-B).
 *
 * Die Tabelle widersprach sich damit selbst: "Punkte + Bonus" ergibt die Disziplin-Summe und
 * ist richtig — "Σ Disziplinen + Bonus" zaehlt den Aufschlag ein zweites Mal.
 *
 * Die BUCHUNG ist nachgemessen korrekt und bleibt unangetastet (0 von 32 Abweichung ueber
 * zehn Spieltage). Geaendert ist allein die Beschriftung: "dav. Bonus" ist die uebliche
 * Schreibweise fuer einen Posten, der in der Summe daneben schon enthalten ist — sie
 * verbietet das Addieren, ohne eine Zahl anzufassen.
 */
const BONUS_DAVON_TITLE =
  "Mutator-Aufschlag der Saison. DAVON-Posten: er steckt bereits in den Disziplin- und " +
  "Bereichs-Spalten dieser Zeile und darf nicht noch einmal addiert werden. " +
  "Es gilt: Punkte + Bonus = Summe der Disziplin-Spalten.";

function getAreaValue(row: SeasonV2StandingsRow, areaId: SeasonDisciplineAreaId): number | null {
  const ledgerValue = areaId === "pow" ? row.pow : areaId === "spe" ? row.spe : areaId === "men" ? row.men : row.soc;
  return resolveSeasonDisciplineAreaTotal(row.disciplineValues, areaId, ledgerValue);
}

/**
 * S5/S4 (Audit Spieltag): `row.points` ist vor dem ersten gewerteten Spieltag
 * `null` (bewusst — "noch keine Wertung") und die Tabelle zeigt dafür „—".
 * `getAreaValue` (POW/SPE/MEN/SOC) liefert in genau derselben Situation aber
 * eine echte `0`, weil die Bereichs-Summe leerer Disziplinwerte technisch 0
 * ist — die Spalte zeigte also für alle 32 Teams farbige Nullen, während die
 * Punkte-Spalte daneben ehrlich „—" sagte. Zwei Antworten auf dieselbe Frage
 * ("gibt es diese Saison schon eine Wertung?"). `row.points` bleibt die EINE
 * Quelle für "diese Zeile hat noch keine Saison-Wertung" — bei `null` zeigen
 * auch die Achsen-Spalten „—" statt einer erfundenen Null.
 */
function formatSeasonAreaValue(row: SeasonV2StandingsRow, value: number | null, digits: number): string {
  if (row.points == null) {
    return "—";
  }
  return formatNlNumber(value, digits);
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
  /**
   * Wrapper-Element. Standard `span` (sitzt inline um den Zellwert). Mit `"li"`
   * wird die GANZE Listenzeile zur Hoverfläche — so genutzt bei den Disziplinen
   * im Aufklapp-Detail, wo man über Name/Balken/Wert gleichermaßen hovern
   * können soll und nicht nur über die schmale Zahl.
   */
  as?: "span" | "li";
  className?: string;
  /** Überschrift des Panels — "Top 3" (Achsen) bzw. "Teilnehmer" (Disziplinen). */
  headline?: string;
  title?: string;
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
function StandingsTopPlayersHover({
  panelId,
  columnLabel,
  teamName,
  entries,
  children,
  as = "span",
  className,
  headline = "Top 3",
  title,
}: StandingsTopPlayersHoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Wrapper = as;

  if (!entries || entries.length === 0) {
    // Ohne Einträge kein Panel — der Wrapper bleibt trotzdem stehen, sobald er
    // (wie bei der Disziplin-Zeile) das tragende Layout-Element ist. Der reine
    // Tooltip bleibt erhalten, damit die Zeile nicht stumm wird.
    return as === "span" && !className ? (
      <>{children}</>
    ) : (
      <Wrapper className={className} title={title}>
        {children}
      </Wrapper>
    );
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
    <Wrapper
      className={className ? `${className} nl-teams-rank-portal` : "nl-teams-rank-portal"}
      title={title}
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
        aria-label={`${headline} ${teamName} — ${columnLabel}`}
        className="nl-teams-rank-preview"
        hidden={!open}
      >
        <span className="nl-teams-rank-preview-title">
          {headline} · {columnLabel} — {teamName}
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
    </Wrapper>
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
  titleRace,
  teamTopPlayersByColumn,
  teamFormCardBonusByTeamId,
  onChangeSeason,
  onOpenTeam,
  onOpenPlayer,
  onOpenRanks,
  onOpenPrize,
  isLoading = false,
}: SeasonStandingsV2ClientProps) {
  const isRivalTeam = (teamId: string) => rivalTeamIds?.has(teamId) ?? false;
  /**
   * Zeilen-Hervorhebung NUR, wenn der Titel noch offen ist. Ist die Meisterschaft rechnerisch
   * entschieden (`contenderIds.size <= 1` — nur noch der Führende selbst „im Rennen"), läse eine
   * einzelne golden leuchtende Zeile absurd; dafür gibt es stattdessen die Kopfzeilen-Notiz mit
   * dem anderen Text (`renderTitleRaceNote`).
   */
  const isTitleContender = (teamId: string) =>
    titleRace != null && titleRace.leaderId != null && titleRace.contenderIds.size > 1 && titleRace.contenderIds.has(teamId);
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

  /**
   * Durchklick-Test (G2): Gibt es in dieser Saison schon IRGENDEINE Wertung?
   * Vor Spieltag 1 ist `row.points` überall `null` — die Ränge 1–32 sind dann
   * der ENDSTAND DER VORSAISON (deckungsgleich mit der Ewigen Tabelle), also
   * die Startplätze der neuen Saison. Das ist eine legitime Reihenfolge, sie
   * muss nur gesagt werden (die Arena macht es vor: „die Reihenfolge sind die
   * Startplätze aus dem Endstand der Vorsaison"). Was dagegen NICHT geht:
   * Gold/Silber/Bronze für 0 Punkte — Medaillen-Optik gibt es erst, wenn
   * mindestens ein Team eine echte Saison-Wertung trägt.
   */
  const hasSeasonScoring = useMemo(
    () => boardRows.some((row) => row.points != null && Number.isFinite(row.points)),
    [boardRows],
  );

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

  /**
   * Formkarten-Tank je Team: was die Saison an positivem Nennwert hergibt, und was davon
   * noch ungespielt ist. Muss VOR `sortedTableRows` stehen — die Sortierung nach beiden
   * Formkarten-Spalten liest diese Karten bereits im Render.
   *
   * Chris: „in der formkarten spalte soll generell immer die summe stehen die AM ANFANG der
   * saison den teams zur verfuegung stand ... dann weiss man wie viel luft noch im tank ist".
   * Vorher stand hier `entry.total`, die Summe der GESPIELTEN Nennwerte — eine Zahl, die
   * bauartbedingt fast immer ≤ 0 ist (die Karten kommen als gespiegeltes Paar +x/−x, und die
   * negativen wirft man zuerst ab, weil ungespielte negative Karten am Saisonende Punkte
   * kosten). Am Live-Save galt das fuer alle 32 Teams.
   */
  const formCardTotalByTeamId = useMemo(() => {
    const totals = new Map<string, number>();
    if (!teamFormCardBonusByTeamId) {
      return totals;
    }
    for (const [teamId, entry] of teamFormCardBonusByTeamId) {
      totals.set(teamId, entry.poolPositive);
    }
    return totals;
  }, [teamFormCardBonusByTeamId]);

  const formCardLeftByTeamId = useMemo(() => {
    const left = new Map<string, number>();
    if (!teamFormCardBonusByTeamId) {
      return left;
    }
    for (const [teamId, entry] of teamFormCardBonusByTeamId) {
      left.set(teamId, entry.remainingPositive);
    }
    return left;
  }, [teamFormCardBonusByTeamId]);

  const sortedTableRows = useMemo(() => {
    const direction = tableSort.dir === "asc" ? 1 : -1;
    return [...boardRows].sort((left, right) => {
      const leftValue = getTableSortValue(left, tableSort.key, formCardTotalByTeamId, formCardLeftByTeamId);
      const rightValue = getTableSortValue(right, tableSort.key, formCardTotalByTeamId, formCardLeftByTeamId);
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

  /**
   * „Top-Spieler der Saison" mit zehn Zeilen voller „—" ist keine Rangliste,
   * sondern eine Behauptung. Stehen ALLE Kandidaten ohne PPs da (vor dem
   * ersten gewerteten Spieltag), rendert stattdessen das geteilte
   * Leerzustand-Primitive `VeloPendingRanking` — dasselbe, das Arena, Ranks,
   * Ergebnisseite und Leaders für exakt diese Situation benutzen.
   */
  const topPlayersPending = useMemo(
    () => topPlayersStrip.length > 0 && topPlayersStrip.every((player) => player.pps == null),
    [topPlayersStrip],
  );

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
  const ownGapToLeaderLabel =
    ownGapToLeader == null ? "—" : ownGapToLeader <= 0 ? "Spitze" : formatNlNumber(ownGapToLeader, 1);

  // BUGFIX (Durchklick, „Saisonstand-Kacheln zählen durch negative Zwischenwerte hoch"):
  // die drei „Dein Team"-Chips liefen vorher über `useCountUp`. Beim Seitenaufbau stand
  // dadurch sekundenlang „Rang #−2" / „MW −15,7 Mio" auf dem Schirm (rAF-Zeitstempel vor
  // dem Animationsstart → negativer Fortschritt; unter Last fror genau dieser Frame ein —
  // Klammer inzwischen in `useCountUp` selbst). Ein Rang ist außerdem eine Ordnungszahl:
  // jeder Zwischenstand („#0", „#11" auf dem Weg zu „#23") ist ein Zustand, den es nicht
  // gibt. Gleiches Vorgehen wie Markt-Audit F1 auf der Finanzen-Seite („Geldzahlen stehen
  // ab dem ersten Frame fest"): keine Zähler-Animation auf Rang/Punkten/Marktwert.
  const animatedOwnRank = selectedTeamSummary?.rank ?? null;
  const animatedOwnPoints = selectedTeamSummary?.points ?? null;
  const animatedOwnMarketValue = selectedTeamSummary?.marketValueTotal ?? null;

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
   * Liga-Rang je Bereichsspalte (POW/SPE/MEN/SOC) für die Einfärbung der Tabellenzellen.
   * Gerankt wird immer gegen ALLE Teams der Tabelle, nicht gegen die gerade sichtbare
   * Sortierung — die Farbe eines Wertes darf sich nicht ändern, nur weil anders sortiert
   * wird.
   *
   * Bei Gleichstand bekommt die ganze Gruppe den SCHLECHTESTEN Rang der Gruppe (1,3,3,4 …).
   * Grund: zu Saisonbeginn stehen ganze Achsen noch auf 0. Mit dem üblichen "bester Rang für
   * alle" (1,2,2,4) würde eine komplett unbespielte Spalte grün leuchten, obwohl niemand
   * etwas geholt hat. Mit dem schlechtesten Rang rutscht so eine Gruppe automatisch aus den
   * Bändern heraus und die Spalte bleibt neutral.
   */
  const areaRanksByTeam = useMemo(() => {
    const ranks = {} as Record<SeasonDisciplineAreaId, Map<string, number>>;
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
      ranks[group.id] = buildValueRanks(standingsRows, (row) => getAreaValue(row, group.id));
    }
    return ranks;
  }, [standingsRows]);

  /**
   * Liga-Rang je EINZELNER Disziplin — für das Aufklapp-Panel „Disziplinen nach Bereich".
   *
   * GEMELDET VON CHRIS: „Können wir wenn wir die Punkte ausklappen, neben den geholten Punkten in
   * den Diszis auch den Rank schreiben? Also zb MIN (2) 5 #3 — also 5 PPs geholt was rang 3
   * entspricht. Finde das ist eine Info, die überall sein sollte, wo man PPs sieht."
   *
   * Dieselbe Rechnung wie bei den Bereichsspalten (`buildValueRanks`, gegen ALLE Teams der Tabelle,
   * nicht gegen die aktive Sortierung) — nur eine Ebene tiefer. Auch der Gleichstand wird gleich
   * behandelt: die ganze Gruppe bekommt den SCHLECHTESTEN Rang. Zu Saisonbeginn stehen ganze
   * Disziplinen auf 0; mit „bester Rang für alle" stünde dort bei jedem Team #1, obwohl niemand
   * etwas geholt hat.
   */
  const disciplineRanksByTeam = useMemo(() => {
    const ranks = new Map<SeasonDisciplineKey, Map<string, number>>();
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
      for (const key of group.keys) {
        ranks.set(key, buildValueRanks(standingsRows, (row) => row.disciplineValues[key]));
      }
    }
    return ranks;
  }, [standingsRows]);

  /**
   * Liga-Rang für Marktwert und Gehaltssumme — als kompaktes „#N" direkt hinter
   * dem Geldwert in DERSELBEN Spalte. Beide Male absteigend gerankt: der höchste
   * Marktwert ist #1, ebenso die höchste Gehaltssumme (teuerster Kader). Gerankt
   * wird gegen alle Teams, nicht gegen die aktive Sortierung — der Rang darf sich
   * nicht ändern, nur weil die Tabelle anders sortiert wird.
   */
  const marketValueRanks = useMemo(() => buildValueRanks(standingsRows, (row) => row.marketValueTotal), [standingsRows]);
  const salaryRanks = useMemo(() => buildValueRanks(standingsRows, (row) => row.salaryTotal), [standingsRows]);

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

  function renderTableSortHeader(key: NlTableSortKey, label: string, title?: string) {
    return (
      <button
        type="button"
        className={`nl-standings-sort-th${tableSort.key === key ? " is-active" : ""}`}
        onClick={() => toggleTableSort(key)}
        aria-label={`Nach ${label} sortieren`}
        title={title}
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

  /**
   * Rang-Bewegung in der Rang-Spalte der Daten-Tabelle.
   *
   * Vorher hing hier ausschliesslich `row.rankDiff` — und das ist die Bewegung
   * seit SAISONSTART. Die wird erst beim Saisonabschluss geschrieben
   * (`cash-prize-apply-service`), in der laufenden Saison steht sie auf 0 bzw.
   * fehlt. Ergebnis: die Spalte blieb ueber die komplette Saison leer, obwohl
   * genau hier "wer hat sich seit dem letzten Spieltag bewegt?" hingehoert.
   *
   * Jetzt fuehrt das Spieltags-Delta aus dem Feld-Rennen-Ledger
   * (`fieldRaceRankDelta`, dieselbe Quelle wie der Board-Chip). Nur wenn es das
   * nicht gibt (erster Spieltag, Archiv-Snapshot) faellt die Zelle auf die
   * Saisonstart-Bewegung zurueck — mit eigenem Tooltip, damit die beiden
   * Groessen nie verwechselt werden.
   */
  function renderRankMovementChip(row: SeasonV2StandingsRow) {
    const matchdayDelta = row.fieldRaceRankDelta;
    if (matchdayDelta != null && Number.isFinite(matchdayDelta)) {
      return (
        <NlDeltaChip
          value={matchdayDelta}
          format={(n) => (n === 0 ? "±0" : `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`)}
          title="Rang-Bewegung gegenüber dem letzten Spieltag"
        />
      );
    }
    if (row.rankDiff != null && Number.isFinite(row.rankDiff) && row.rankDiff !== 0) {
      return (
        <NlDeltaChip
          value={row.rankDiff}
          format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`}
          title="Rang-Bewegung seit Saisonstart"
        />
      );
    }
    return null;
  }

  function renderAreaMiniBars(row: SeasonV2StandingsRow) {
    return (
      <div className="nl-standings-areas" role="group" aria-label={`Bereichspunkte ${row.teamName}`}>
        {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => {
          const value = getAreaValue(row, group.id);
          // S5/S4: dieselbe „—" statt farbiger Null wie in der Daten-Tabelle —
          // eine Quelle (row.points), zwei Ansichten.
          const displayValue = formatSeasonAreaValue(row, value, 0);
          const areaTitle =
            row.points == null
              ? `${group.label}: noch keine Wertung — füllt sich ab Spieltag 1`
              : `${group.label}: ${formatNlNumber(value, 1)} Bereichspunkte`;
          return (
            <span
              key={group.id}
              className={`nl-standings-area ${nlToneClass(group.id)}`}
              title={areaTitle}
              aria-label={areaTitle}
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
                <span className="nl-standings-area-value nl-tnum">{displayValue}</span>
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
  /**
   * Disziplin-Reihenfolge der Aufklapp-Gruppen: KANONISCH (TDM · Mini DM ·
   * Gewichtheben · …), nicht nach Kadergroesse. `SEASON_DISCIPLINE_AREA_GROUPS`
   * sortiert nach Spielerzahl — das war eine Anforderung an die RANG-Tabelle und
   * ist ueber den gemeinsamen Export hier mitgelaufen, wo man die uebliche
   * Reihenfolge erwartet.
   */
  const standardOrderKeysByArea = useMemo(
    () => new Map(SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER.map((group) => [group.id, group.keys])),
    [],
  );

  function renderDisciplineGroups(row: SeasonV2StandingsRow) {
    return (
      <div className="nl-standings-groups">
        {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => {
          const areaValue = getAreaValue(row, group.id);
          return (
            <div key={group.id} className={`nl-standings-group ${nlToneClass(group.id)}`}>
              <div className="nl-standings-group-head">
                <span className="nl-standings-group-label">{group.label}</span>
                {/* Rang des Bereichs — dieselbe Auskunft wie eine Zeile tiefer je Disziplin. */}
                <span className="nl-standings-group-total nl-tnum">
                  {formatSeasonAreaValue(row, areaValue, 1)}
                  {renderLeagueRankSuffix(areaRanksByTeam[group.id]?.get(row.teamId), group.label, areaValue)}
                </span>
              </div>
              <ul className="nl-standings-disc-list">
                {standardOrderKeysByArea.get(group.id)?.map((key) => {
                  const value = row.disciplineValues[key];
                  const participants = teamTopPlayersByColumn?.get(row.teamId)?.[key];
                  // Teilnehmerzahl dieses TEAMS in dieser Disziplin über die Saison.
                  // Quelle ist der Saison-Ledger (wer hier PPs geholt hat) — dieselbe
                  // Liste, die der Hover zeigt, nur als Zahl davor.
                  const participantCount = participants?.length ?? 0;
                  return (
                    /* Hover auf die GANZE Disziplin-Zeile (Kürzel · Balken · Wert):
                       zeigt die Spieler, die in dieser Disziplin für das Team PPs
                       geholt haben, mit ihren PPs. Ohne Teilnehmer bleibt es beim
                       reinen Tooltip — kein leeres Panel. */
                    <StandingsTopPlayersHover
                      key={key}
                      as="li"
                      className="nl-standings-disc"
                      panelId={`nl-standings-players-disc-${row.teamId}-${key}`}
                      columnLabel={SEASON_DISCIPLINE_LABELS[key]}
                      teamName={row.teamName}
                      headline="Teilnehmer"
                      entries={participants}
                      title={
                        participantCount > 0
                          ? `${SEASON_DISCIPLINE_LABELS[key]}: ${formatNlNumber(value, 1)} — ${participantCount} Spieler dieses Teams waren diese Saison hier im Einsatz (Hover zeigt sie)`
                          : `${SEASON_DISCIPLINE_LABELS[key]}: ${formatNlNumber(value, 1)} — noch kein Einsatz dieses Teams`
                      }
                    >
                      <span className="nl-standings-disc-label">
                        {SEASON_DISCIPLINE_LABELS[key]}
                        {/* Teilnehmerzahl direkt am Kürzel: beantwortet „auf wie vielen
                            Schultern steht dieser Wert?" ohne Hover. */}
                        <small className="nl-standings-disc-count nl-tnum">({participantCount})</small>
                      </span>
                      <NlProgressBar
                        className="nl-standings-disc-bar"
                        value={getBarPercent(value, disciplineMaxByKey.get(key) ?? 0)}
                        max={100}
                        tone={group.id}
                        showValue={false}
                      />
                      <span className="nl-standings-disc-value nl-tnum">
                        {formatNlNumber(value, 1)}
                        {renderLeagueRankSuffix(
                          disciplineRanksByTeam.get(key)?.get(row.teamId),
                          SEASON_DISCIPLINE_LABELS[key],
                          value,
                        )}
                      </span>
                    </StandingsTopPlayersHover>
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
              <StatChip label="dav. Bonus" value={formatNlNumber(bonusValue, 1)} tone="accent" title={BONUS_DAVON_TITLE} />
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
    // G2: Medaillen und Podium-Glow nur, wenn es überhaupt eine Saison-Wertung
    // gibt. Vor Spieltag 1 ist Rang 1–3 nur der Startplatz aus der Vorsaison —
    // Gold für 0 Punkte wäre eine erfundene Auszeichnung.
    const isPodium = hasSeasonScoring && row.rank != null && row.rank >= 1 && row.rank <= 3;
    const medalKind = !hasSeasonScoring
      ? null
      : row.rank === 1 ? "gold" : row.rank === 2 ? "silver" : row.rank === 3 ? "bronze" : null;

    return (
      <li
        key={row.teamId}
        className={`nl-standings-row nl-reveal${row.isSelected ? " is-selected" : ""}${isRivalTeam(row.teamId) ? " is-rival" : ""}${isPodium ? " is-podium" : ""}${isExpanded ? " is-expanded" : ""}${isTitleContender(row.teamId) ? " is-title-contender" : ""}`}
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
              // S5/S6 (Audit Spieltag): NlMedalBadge zeigt ohne `count` nur den
              // reinen Farbpunkt — Gold/Silber/Bronze sind ohne Zahl nicht sicher
              // zu unterscheiden (und für Farbfehlsichtige gar nicht). `count` wäre
              // hier semantisch falsch (das ist "Anzahl Medaillen", nicht der
              // Rang) — die Rangzahl steht deshalb als eigenes Element daneben,
              // exakt dieselbe Klasse wie bei Rang 4 aufwärts.
              <>
                <NlMedalBadge kind={medalKind} title={`Rang ${row.rank}`} />
                <span className="nl-standings-ranknum nl-tnum">{row.rank}</span>
              </>
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
                {isTitleContender(row.teamId) ? (
                  <span className="nl-standings-titlerace-tag" title="Kann den Titel am letzten Spieltag noch holen">
                    Titelchance
                  </span>
                ) : null}
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
    if (topPlayersPending) {
      return renderTopPlayersPendingCard();
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
                title={buildTopPlayerTitle(player)}
              >
                <span className="nl-standings-player-rank nl-tnum">#{player.rank}</span>
                {/* `player.rank` ist der ligaweite PPs-Rang dieser Liste (sortiert
                    nach PPs) — für den Star-Rahmen zählt aber ausschliesslich der
                    OVR-Rang (`player.ovrRank`, separat durchgereicht), NICHT dieser
                    Listen-Rang. Siehe `lib/foundation/player-star-tier.ts`. */}
                <PlayerStarFrame tier={getPlayerStarTier(player.ovrRank)} shape="circle" size="sm">
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
                </PlayerStarFrame>
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
        {/* S5/S3 (Audit Spieltag): `.nl-standings-daten-chartrow` reserviert per
            CSS zwei Spalten (Chart minmax(300px,0.58fr) + Spieler-Raster 1fr) —
            fehlt der Chart (vor Spieltag 1 gibt es noch keine Punkte,
            `datenChartHasData` false), bleibt die Chart-Spalte leer, ABER das
            Grid reserviert ihre ~300px trotzdem. Das Spieler-Raster bekam dadurch
            nur noch ~400px für fünf feste Spalten (gemessen: 76px/Spalte) — zu
            wenig für Name+Team, die Kopie-Spalte kollabierte auf 0px. Ergebnis:
            zehn Kacheln mit nur Rang + Initialen-Kreis + rotem „—", kein Name,
            kein Wert lesbar — genau der „kryptische" Befund. Ohne Chart bekommt
            die Zeile jetzt eine einzige volle Spalte (`.is-chart-empty`). */}
        <div className={`nl-standings-daten-chartrow${datenChartHasData ? "" : " is-chart-empty"}`}>
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
              <th>{renderTableSortHeader("bonus", "dav. Bonus", BONUS_DAVON_TITLE)}</th>
              <th className="nl-standings-th-formcards">{renderTableSortHeader("formCards", "Formkarten")}</th>
              <th className="nl-standings-th-formcards">{renderTableSortHeader("formCardsLeft", "Rest")}</th>
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

  /**
   * Kompakter Liga-Rang direkt hinter einem Geldwert, in DERSELBEN Spalte
   * (kein eigener Tabellenplatz). Ohne Rang (kein Wert vorhanden) bleibt die
   * Zelle unverändert — lieber nichts als ein erfundenes "#—".
   */
  function renderRankSuffix(rank: number | undefined, metricLabel: string, teamName: string) {
    if (rank == null || !Number.isFinite(rank)) {
      return null;
    }
    return (
      <span
        className={`nl-standings-rank-suffix nl-tnum${rank === 1 ? " is-top" : ""}`}
        title={`${metricLabel}: Rang ${rank} von ${standingsRows.length} — ${teamName}`}
      >
        #{rank}
      </span>
    );
  }

  /**
   * Der gemeinsame Erklaertext beider Formkarten-Spalten. Bewusst EIN Text: die zwei Zahlen
   * gehoeren zusammen (voller Tank / davon noch drin), und wer die eine antippt, will meist
   * die andere gleich mitlesen.
   */
  function buildFormCardTitle(row: SeasonV2StandingsRow, entry: SeasonFormCardBonusEntry) {
    const teile = [
      `${row.teamName}: Formkarten-Tank ${formatNlNumber(entry.poolPositive, 0)}`,
      `davon noch ungespielt ${formatNlNumber(entry.remainingPositive, 0)}`,
      `gespielt ${entry.cards} von ${entry.poolCards} Karten`,
    ];
    if (entry.remainingNegative < 0) {
      // Ungespielte negative Karten kosten am Saisonende Punkte
      // (`applyFormCardPenaltyWithRerank`) — das gehoert sichtbar an die Zahl.
      teile.push(`offene Minuskarten ${formatNlNumber(entry.remainingNegative, 0)} (kosten am Saisonende Punkte)`);
    }
    return teile.join(" · ");
  }

  /**
   * Spalte „Formkarten": der volle Tank der Saison — die Summe der POSITIVEN Nennwerte aller
   * Karten des Teams, gespielt wie ungespielt.
   *
   * Vorher stand hier die Summe der bereits gespielten Nennwerte. Die war als Kennzahl
   * unbrauchbar: Karten kommen je Spieler als gespiegeltes Paar (+x und −x), und die negativen
   * wirft man zuerst ab, weil ungespielte Minuskarten am Saisonende Punkte kosten. Die Summe
   * lag deshalb bei allen 32 Teams des Live-Saves bei ≤ 0 und sagte nur, wie viel Negatives
   * schon abgeraeumt war — nicht, wie stark ein Team in Form gehen konnte.
   *
   * Teams ganz ohne Karten zeigen „—" statt einer 0: kein Tank ≠ leerer Tank.
   */
  function renderFormCardCell(row: SeasonV2StandingsRow) {
    const entry = teamFormCardBonusByTeamId?.get(row.teamId) ?? null;
    if (!entry || entry.poolCards === 0) {
      return (
        <td className="nl-standings-td-formcards" title={`Keine Formkarten in dieser Saison — ${row.teamName}`}>
          —
        </td>
      );
    }
    return (
      <td className="nl-standings-td-formcards" title={buildFormCardTitle(row, entry)}>
        {formatNlNumber(entry.poolPositive, 0)}
      </td>
    );
  }

  /**
   * Spalte „Rest": wie viel vom Tank noch ungespielt ist — „wie viel Luft noch drin ist".
   * Ein leerer Tank zeigt bewusst „0" und nicht „—": das Team HAT Karten gehabt und sie
   * ausgegeben, das ist eine Aussage. „—" bleibt den Teams ohne Karten vorbehalten.
   */
  function renderFormCardLeftCell(row: SeasonV2StandingsRow) {
    const entry = teamFormCardBonusByTeamId?.get(row.teamId) ?? null;
    if (!entry || entry.poolCards === 0) {
      return (
        <td className="nl-standings-td-formcards" title={`Keine Formkarten in dieser Saison — ${row.teamName}`}>
          —
        </td>
      );
    }
    const anteil = entry.poolPositive > 0 ? entry.remainingPositive / entry.poolPositive : 0;
    const tank = anteil >= 0.5 ? " is-pos" : anteil > 0 ? "" : " is-neg";
    return (
      <td className={`nl-standings-td-formcards${tank}`} title={buildFormCardTitle(row, entry)}>
        {formatNlNumber(entry.remainingPositive, 0)}
      </td>
    );
  }

  function renderTableRow(row: SeasonV2StandingsRow) {
    const isExpanded = expandedTeamId === row.teamId;
    return (
      <Fragment key={row.teamId}>
        <tr
          className={`nl-standings-table-row${row.isSelected ? " is-selected" : ""}${isRivalTeam(row.teamId) ? " is-rival" : ""}${isExpanded ? " is-expanded" : ""}${isTitleContender(row.teamId) ? " is-title-contender" : ""}`}
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
            {renderRankMovementChip(row)}
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
                {isTitleContender(row.teamId) ? (
                  <span className="nl-standings-titlerace-tag" title="Kann den Titel am letzten Spieltag noch holen">
                    Titelchance
                  </span>
                ) : null}
              </span>
              <span className="nl-standings-teamcode">{row.teamCode}</span>
            </button>
          </td>
          <td className="nl-standings-td-points">{formatNlNumber(row.points, 1)}</td>
          <td className="nl-standings-td-bonus">{formatNlNumber(row.disciplineValues.bonuspunkte, 1)}</td>
          {renderFormCardCell(row)}
          {renderFormCardLeftCell(row)}
          {SEASON_DISCIPLINE_AREA_GROUPS.map((group) => {
            const areaValue = getAreaValue(row, group.id);
            // Liga-Rang der Bereichsspalte: Top 3 grün, 4–6 gelb, 7–10 rot, Rest neutral.
            // Nur eine Hinterlegung — die Zahl behält ihre Achsenfarbe (POW rot, SPE grün …).
            // S5/S4: ohne Saison-Wertung (row.points null) ist JEDES Team auf dem
            // schlechtesten gemeinsamen Rang (buildValueRanks-Kommentar) — keine
            // Hinterlegung ohne echten Unterschied.
            const bandClass = row.points == null ? "" : getAreaRankBandClass(areaRanksByTeam[group.id]?.get(row.teamId));
            return (
              <td
                key={group.id}
                className={`nl-standings-td-areacol ${nlToneClass(group.id)}${bandClass ? ` ${bandClass}` : ""}`}
              >
                {/* Hover auf die Bereichsspalte: Top-3-Spieler des Teams nach PPs in dieser Achse. */}
                <StandingsTopPlayersHover
                  panelId={`nl-standings-top3-table-${row.teamId}-${group.id}`}
                  columnLabel={group.label}
                  teamName={row.teamName}
                  entries={teamTopPlayersByColumn?.get(row.teamId)?.[group.id]}
                >
                  {formatSeasonAreaValue(row, areaValue, 1)}
                </StandingsTopPlayersHover>
              </td>
            );
          })}
          <td className="nl-standings-td-mw">
            {formatNlMoney(row.marketValueTotal)}
            {renderRankSuffix(marketValueRanks.get(row.teamId), "Marktwert", row.teamName)}
          </td>
          <td className="nl-standings-td-fin">{formatNlMoney(row.cash)}</td>
          <td className={`nl-standings-td-fin${row.sponsorTotal ? " is-pos" : ""}`}>{formatNlMoney(row.sponsorTotal)}</td>
          <td className="nl-standings-td-fin">
            {formatNlMoney(row.salaryTotal)}
            {renderRankSuffix(salaryRanks.get(row.teamId), "Gehaltssumme", row.teamName)}
          </td>
          <td className="nl-standings-td-fin">{formatNlMoney(row.buildingCost)}</td>
          <td className={`nl-standings-td-fin${nlMoneySignClass(row.transferNet)}`}>{formatNlMoney(row.transferNet)}</td>
          <td
            className={`nl-standings-td-fin${nlMoneySignClass(row.guv)}`}
            // Chris: „am besten ein Hover auf dem GuV-Posten, der noch mal aufzeigt, wie die Zahl
            // sich zusammensetzt". Die Herleitung liegt in lib/finance/guv-breakdown.ts, damit
            // Saisonstand und Finanzen-Reiter dieselbe Erklaerung zeigen. Der Apron steht darin
            // als Hochrechnung beim aktuellen Rang — gerechnet in `apron-projection.ts` und je
            // Zeile mitgeliefert, weil Topf und Ausschuettung an der ganzen Liga haengen.
            title={
              buildGuvBreakdown({
                // Die Posten der EINEN GuV kommen fertig aus dem Feed — jeder davon, auch die mit 0.
                posten: row.guvPosten ?? null,
                sponsorTotal: row.sponsorTotal,
                salaryTotal: row.salaryTotal,
                guv: row.guv,
                transferNet: row.transferNet,
                apron: row.apronProjection ?? null,
              }).hoverText
            }
          >
            {formatNlMoney(row.guv)}
          </td>
        </tr>
        {isExpanded ? (
          <tr className="nl-standings-table-detailrow">
            <td className="nl-standings-table-detailcell" colSpan={18} id={`nl-standings-tdetails-${row.teamId}`}>
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
                  {/* S5/S6: derselbe Farbpunkt-ohne-Zahl-Befund wie in der Liste
                      darunter — Platz 1/2/3 stehen explizit, nicht nur als Farbe. */}
                  <span className="nl-standings-podium-ranknum nl-tnum">#{index + 1}</span>
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

  /**
   * Leerzustand für „Top-Spieler der Saison": alle Kandidaten stehen bei „—"
   * (keine PPs vor dem ersten gewerteten Spieltag) — statt zehn leerer Zeilen
   * mit #1–#10 das geteilte `VeloPendingRanking` (wie Arena/Ranks/Leaders).
   */
  function renderTopPlayersPendingCard() {
    return (
      <VeloPendingRanking
        className="nl-standings-players-pending"
        eyebrow="Spieler-Highlights"
        title="Top-Spieler — noch zu vergeben"
        note="Die Top-Spieler der Saison entstehen aus PPs gespielter Wettbewerbe — die erste Wertung gibt es an Spieltag 1. Bis dahin steht hier bewusst keine Reihenfolge."
        slots={[
          { key: "gold", ring: "1.", label: "Noch zu vergeben" },
          { key: "silver", ring: "2.", label: "Noch zu vergeben" },
          { key: "bronze", ring: "3.", label: "Noch zu vergeben" },
        ]}
        meta={`${formatNlNumber(standingsRows.length, 0)} Teams gemeldet · alle Spieler starten bei 0 PPs`}
        data-testid="nl-standings-top-players-pending"
      />
    );
  }

  function renderTopPlayersStrip() {
    if (topPlayersStrip.length === 0) {
      return null;
    }
    if (topPlayersPending) {
      return renderTopPlayersPendingCard();
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
                title={buildTopPlayerTitle(player)}
              >
                <span className="nl-standings-player-rank nl-tnum">#{player.rank}</span>
                {/* `player.rank` ist der ligaweite PPs-Rang dieser Liste (sortiert
                    nach PPs) — für den Star-Rahmen zählt aber ausschliesslich der
                    OVR-Rang (`player.ovrRank`, separat durchgereicht), NICHT dieser
                    Listen-Rang. Siehe `lib/foundation/player-star-tier.ts`. */}
                <PlayerStarFrame tier={getPlayerStarTier(player.ovrRank)} shape="circle" size="sm">
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
                </PlayerStarFrame>
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
   * Kopfzeile über der Tabelle für den Meisterschaftskampf am letzten Spieltag
   * (Chris' Wunsch, `lib/season/title-race.ts`). `titleRace` ist nur in diesem einen
   * Zeitfenster gesetzt — außerhalb (und im Archiv) rendert diese Funktion `null`,
   * genau wie die Preseason-Note nie außerhalb ihres eigenen Fensters erscheint.
   * Beide Notizen können nie gleichzeitig auftauchen (vor Spieltag 1 läuft nie
   * gleichzeitig schon der letzte Spieltag).
   *
   * `leaderId == null` (keine gewertete Mannschaft im übergebenen Stand) wird wie
   * "kein Fenster" behandelt — ohne Führenden gibt es nichts zu zeigen.
   */
  function renderTitleRaceNote() {
    if (!titleRace || titleRace.leaderId == null) {
      return null;
    }

    const leaderRow = boardRows.find((row) => row.teamId === titleRace.leaderId) ?? null;
    const contenderCount = titleRace.contenderIds.size;

    // Titel rechnerisch entschieden (nur noch der Führende selbst "im Rennen"): eine einzelne
    // "Titelchance"-Zeile läse sich absurd — hier gibt es nur die Kopfzeile, mit anderem Text,
    // und KEINE Zeilen-Hervorhebung (siehe `isTitleContender`).
    if (contenderCount <= 1) {
      return (
        <p className="nl-standings-titlerace-note" data-testid="nl-standings-titlerace-note">
          Letzter Spieltag — die Meisterschaft ist entschieden: {leaderRow?.teamName ?? "Der Spitzenreiter"} ist
          rechnerisch nicht mehr einzuholen.
        </p>
      );
    }

    const contenderRows = boardRows
      .filter((row) => titleRace.contenderIds.has(row.teamId))
      .map((row) => ({ row, gap: titleRace.gapByTeamId.get(row.teamId) ?? 0 }))
      .sort((left, right) => left.gap - right.gap);

    // Die Konstanten hinter der Obergrenze (Spieleranzahl × Punkte je Spieler) sind bewusst KEINE
    // eigenen Zahlen im sichtbaren Text — nur die fertige Obergrenze selbst steht in der
    // Kopfzeile. Die Herleitung ("12 Spieler × 3,3") steht NUR im Tooltip der Chips als
    // Begründung, sonst würde die Zeile mit Zwischenwerten überladen.
    const maxPointsLabel = formatNlNumber(MAX_POINTS_PER_MATCHDAY, 1);
    const maxPointsTooltip = `maximal ${maxPointsLabel} Punkte sind am letzten Spieltag noch zu holen (${formatNlNumber(MAX_PLAYERS_PER_MATCHDAY, 0)} Spieler × ${formatNlNumber(POINTS_PER_PARTICIPATING_PLAYER, 1)})`;

    return (
      <>
        <p className="nl-standings-titlerace-note" data-testid="nl-standings-titlerace-note">
          Letzter Spieltag — Meisterschaftskampf: {contenderCount} Teams können noch Meister werden (maximal{" "}
          {maxPointsLabel} Punkte sind noch zu holen).
        </p>
        <StatChipRow className="nl-standings-titlerace-chips" aria-label="Teams im Meisterschaftskampf">
          {contenderRows.map(({ row, gap }) => (
            <StatChip
              key={row.teamId}
              label={row.teamCode}
              value={gap <= 0 ? "Spitze" : `−${formatNlNumber(gap, 1)}`}
              tone={gap <= 0 ? "good" : "accent"}
              onClick={() => onOpenTeam(row.teamId)}
              title={`${row.teamName} — ${maxPointsTooltip}`}
            />
          ))}
        </StatChipRow>
      </>
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
        eyebrow={
          /* Durchklick-Test (G5): „SPIELSTAND: AKTIV · LIVE · AKTIVE SEASON ·
             LOKALE RESULTS" war eine halbenglische Status-Flag-Reihe als erste
             Zeile der Seite. Der Spieler bekommt Klartext; die technische
             Quelle bleibt als Tooltip erreichbar. */
          <span title={`${sourceBadgeLabel} · ${sourceLabel}`}>
            {isArchived ? "Liga-Wertung · Archiv" : "Liga-Wertung · Saison läuft"}
          </span>
        }
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
          {/* S5/S2 (Audit Spieltag): „Dein Team" stand hier UND nochmal 80px
              darunter als eigene Kachel-Zeile (`renderDatenKpis`, nur im
              Daten-Modus) — dieselben Zahlen (Rang/Punkte/MW), doppelte
              Fläche. Eine Zeile, ein Ort: die einzige echte Zusatzgröße aus
              der zweiten Zeile ("Rückstand auf #1") zieht hierher, der Rest
              entfällt. */}
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
                label="Rückstand auf #1"
                value={ownGapToLeaderLabel}
                tone={ownGapToLeader != null && ownGapToLeader <= 0 ? "good" : "neutral"}
                title="Punkte-Rückstand auf den aktuellen Spitzenreiter"
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
        {/* G2 „beschriften statt löschen": vor der ersten Wertung ist die
            Reihenfolge der Tabelle der Endstand der Vorsaison (= Startplätze).
            Das steht hier EINMAL, sichtbar in allen drei Ansichten — dieselbe
            Erklärung, die die Arena für ihr Umfeld bereits mitliefert. */}
        {!hasSeasonScoring && !isArchived && boardRows.length > 0 ? (
          <p className="nl-standings-preseason-note" data-testid="nl-standings-preseason-note">
            Noch kein Spieltag gewertet — die Reihenfolge ist der Endstand der Vorsaison
            (deine Startplätze). Punkte, Achsenwerte und Medaillen füllen sich ab Spieltag 1.
          </p>
        ) : null}
        {/* Meisterschaftskampf-Kopfzeile: kann nie gleichzeitig mit der Preseason-Note oben
            erscheinen (die eine braucht "noch keine Wertung", die andere "letzter Spieltag,
            noch nicht durchgespielt" — beide Fenster schließen sich gegenseitig aus). */}
        {renderTitleRaceNote()}
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

