"use client";

import { useMemo, useState, type CSSProperties } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlCountUpValue,
  NlDeltaChip,
  NlMedalBadge,
  NlProgressBar,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  useCountUp,
} from "@/components/foundation/new-look";
import { VeloPendingRanking } from "@/components/foundation/velo-ui";
import type { FoundationMatchdayResultShellHostProps } from "@/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost";
import type {
  MatchdaySummaryHighlight,
  MatchdaySummaryTeamRow,
  MatchdaySummaryTopPlayer,
} from "@/lib/foundation/matchday-summary";
import { getTeamLogoBrowserUrl, getTeamLogoModel } from "@/lib/data/mediaAssets";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";

/**
 * "Neuer Look" Spieltagsergebnis — Ergebnis-Bühne + Board (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationMatchdayResultShellHost` fällt ohne Flag unverändert auf das
 * bestehende Layout zurück. Nutzt ausschließlich die Daten, die der Host
 * ohnehin baut (`matchdaySummary`, `activeTeamMatchdaySummaryRow`, …) —
 * nichts wird neu berechnet.
 *
 * Bewusst verschoben statt gezeigt:
 * - Das Highlight-Feld `source` (Datenquelle) wandert in den Tooltip.
 * - Rohe Warn-Strings (`matchdaySummary.warnings`) wandern in den
 *   ausklappbaren Diagnose-Abschnitt statt in die Hero-Zeile.
 */

type NlResultMode = "board" | "daten";

const NL_RESULT_MODE_ITEMS: Array<{ id: NlResultMode; label: string }> = [
  { id: "board", label: "Board" },
  { id: "daten", label: "Daten" },
];

type NlResultSortKey = "team" | "rank" | "points" | "d1" | "d2" | "before" | "after" | "delta" | "cumulative";
type NlResultSortDir = "asc" | "desc";

function getNlResultSortValue(row: MatchdaySummaryTeamRow, key: NlResultSortKey): number | string {
  switch (key) {
    case "team":
      return row.teamName;
    case "rank":
      return row.matchdayRank ?? Number.POSITIVE_INFINITY;
    case "points":
      return row.matchdayPoints ?? Number.NEGATIVE_INFINITY;
    case "d1":
      return row.d1Score ?? Number.NEGATIVE_INFINITY;
    case "d2":
      return row.d2Score ?? Number.NEGATIVE_INFINITY;
    case "before":
      return row.seasonRankBeforeMatchday ?? Number.POSITIVE_INFINITY;
    case "after":
      return row.seasonRankAfterMatchday ?? Number.POSITIVE_INFINITY;
    case "delta":
      return row.rankDelta ?? Number.NEGATIVE_INFINITY;
    case "cumulative":
      return row.cumulativePoints ?? Number.NEGATIVE_INFINITY;
    default:
      return "";
  }
}

function getBarPercent(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || max <= 0) {
    return 0;
  }
  return Math.max(4, Math.min(100, (value / max) * 100));
}

function renderRankMovement(row: MatchdaySummaryTeamRow) {
  if (row.rankDelta == null) {
    return <span className="nl-result-movement is-empty">—</span>;
  }
  return (
    <span
      className="nl-result-movement"
      title={`Saisonrang: ${row.seasonRankBeforeMatchday ?? "—"} → ${row.seasonRankAfterMatchday ?? "—"}`}
    >
      <NlDeltaChip value={row.rankDelta} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`} />
      <span className="nl-result-movement-ranks nl-tnum">
        {row.seasonRankBeforeMatchday ?? "—"} → {row.seasonRankAfterMatchday ?? "—"}
      </span>
    </span>
  );
}

/**
 * Schlichtes, emoji-freies Glyphen-Badge pro Highlight-Kategorie. Die Glyphe
 * kommt aus derselben deutschen Typ-Map wie Label und Satz
 * (`lib/foundation/matchday-highlight-labels.ts`) — vorher riet hier eine
 * Heuristik über den rohen Enum-Namen.
 */
function getHighlightGlyph(highlight: MatchdaySummaryHighlight): string {
  return highlight.glyph || "★";
}

export default function MatchdayResultNewLook(props: FoundationMatchdayResultShellHostProps) {
  const {
    sourceBadgeLabel,
    matchdaySummary,
    activeMatchdaySummaryId,
    matchdaySummaryOptions,
    activeTeamMatchdaySummaryRow,
    activeManagerTeamId,
    selectedTeam,
    setSelectedMatchdaySummaryId,
    setActiveView,
    openTeamProfileById,
    triggerGlobalNext,
  } = props;

  const [mode, setMode] = useState<NlResultMode>("board");
  const [sortKey, setSortKey] = useState<NlResultSortKey | null>(null);
  const [sortDir, setSortDir] = useState<NlResultSortDir>("asc");
  // Tagessieger-Reveal (D3): kurzer, überspringbarer Moment über dem Detail.
  const [tagessiegerDismissed, setTagessiegerDismissed] = useState(false);

  const boardRows = useMemo(
    () =>
      [...matchdaySummary.teamRows].sort((left, right) => {
        const leftRank = left.matchdayRank ?? Number.POSITIVE_INFINITY;
        const rightRank = right.matchdayRank ?? Number.POSITIVE_INFINITY;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.teamName.localeCompare(right.teamName, "de");
      }),
    [matchdaySummary.teamRows],
  );

  const datenRows = useMemo(() => {
    if (!sortKey) {
      return boardRows;
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...boardRows].sort((left, right) => {
      const leftValue = getNlResultSortValue(left, sortKey);
      const rightValue = getNlResultSortValue(right, sortKey);
      if (typeof leftValue === "string" || typeof rightValue === "string") {
        return dir * String(leftValue).localeCompare(String(rightValue), "de");
      }
      return dir * (leftValue - rightValue);
    });
  }, [boardRows, sortKey, sortDir]);

  function handleDatenSort(key: NlResultSortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function renderSortableTh(key: NlResultSortKey, label: string) {
    const isActive = sortKey === key;
    return (
      <th aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className="nl-result-th-sort" onClick={() => handleDatenSort(key)}>
          {label}
          {isActive ? <span className="nl-result-th-sort-arrow">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
        </button>
      </th>
    );
  }

  const maxD1 = boardRows.reduce((max, row) => (row.d1Score != null && row.d1Score > max ? row.d1Score : max), 0);
  const maxD2 = boardRows.reduce((max, row) => (row.d2Score != null && row.d2Score > max ? row.d2Score : max), 0);

  const heroRow = activeTeamMatchdaySummaryRow;
  const heroTeam = selectedTeam ?? null;
  const heroLogo = heroTeam
    ? getTeamLogoModel(heroTeam, { variant: "thumb" })
    : heroRow
      ? { src: getTeamLogoBrowserUrl(heroRow.teamId, null, { variant: "thumb" }), initials: heroRow.teamShortCode }
      : null;
  const heroPoints = useCountUp(heroRow?.matchdayPoints ?? null);
  // S4/A5 (Audit Spieltag): `hasResult` ist die EINE Quelle dafür, ob für diesen
  // Spieltag überhaupt schon gewertet wurde. Vorher fiel `championRow` ohne Ergebnis
  // auf `boardRows[0]` zurück — und weil `teamRows` dann alphabetisch (nicht nach
  // Rang) steht, bekam praktisch immer dasselbe Team ("Armageddon Aftermath")
  // einen erfundenen "Tagessieger"-Kranz samt Gold-Reveal. Dieselbe Zustandsfrage
  // wie in der Arena (S3 `showPreMatchday`), hier beantwortet aus dem Summary-Flag.
  const hasResult = matchdaySummary.hasResult;
  const championRow = hasResult ? (matchdaySummary.topTeams[0] ?? boardRows[0] ?? null) : null;
  /**
   * Dritter Zustand des Spieltags: TEILWEISE gewertet (z. B. nur D1 gebucht, D2
   * steht aus). `completion` kommt aus `getMatchdayScoringProgress` — derselben
   * Quelle, mit der Spielplan („läuft") und Spieltagswechsel rechnen. Vorher
   * kannte diese Seite nur fertig/leer und verkaufte den halben Spieltag als
   * Endergebnis: Tagessieger-Reveal, Tages-Podium mit Medaillen, nirgends
   * „vorläufig". Jetzt gilt: Zwischenstände werden GEZEIGT (die D1-Punkte sind
   * echt), aber als solche benannt — und die Finale-Inszenierung (Gold-Reveal,
   * Medaillen-Podium) wartet, bis der Tag wirklich entschieden ist.
   */
  const isPartial = matchdaySummary.completion === "partial";
  const d1Name = matchdaySummary.d1.disciplineName ?? "Disziplin 1";
  const d2Name = matchdaySummary.d2.disciplineName ?? "Disziplin 2";
  const topPlayers = matchdaySummary.topPlayers.slice(0, 5);
  const diagnoseWarnings = useMemo(
    () => matchdaySummary.warnings.filter((warning) => warning !== "missing_matchday_result"),
    [matchdaySummary.warnings],
  );

  // Tages-Podium: die echten Rang-1-bis-3-Zeilen des gespeicherten Ergebnisses.
  const podiumRows = useMemo(
    () => boardRows.filter((row) => row.matchdayRank != null && row.matchdayRank <= 3).slice(0, 3),
    [boardRows],
  );
  const mvpPlayer = topPlayers[0] ?? null;

  function renderPodiumStep(row: MatchdaySummaryTeamRow, revealIndex: number) {
    const rank = row.matchdayRank ?? 0;
    const medalKind = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
    const isActive = row.teamId === activeManagerTeamId;
    const logoSrc = getTeamLogoBrowserUrl(row.teamId, null, { variant: "thumb" });
    // Podium-Reveal-Reihenfolge: gestaffelt nach Tagesrang (1 zuerst), nicht
    // nach der visuellen Silber-Gold-Bronze-Anordnung.
    return (
      <div
        key={row.teamId}
        role="listitem"
        className={`nl-result-podium-step nl-reveal is-rank-${rank}${isActive ? " is-active-team" : ""}`}
        style={{ ...getSeasonV2TeamTagStyle(row.teamShortCode), "--nl-reveal-i": revealIndex } as CSSProperties}
      >
        <NlMedalBadge kind={medalKind} title={`Tagesrang ${rank}`} className="nl-result-podium-medal" />
        {/* Explizites Rang-Label: die 2·1·3-Anordnung darf nicht als "wir haben
            gewonnen" fehlgelesen werden — die Platzierung bleibt eindeutig (#6). */}
        <span className="nl-result-podium-rank-label">Tagesrang {rank}</span>
        <BudgetedMediaImage
          src={logoSrc}
          alt={`${row.teamName} Logo`}
          className="nl-result-podium-crest"
          width={52}
          height={52}
          loading="lazy"
          fallback={<span className="nl-result-podium-crest nl-result-podium-crest-fallback">{row.teamShortCode}</span>}
        />
        <button
          type="button"
          className="nl-result-podium-team"
          onClick={() => openTeamProfileById(row.teamId)}
          title={`${row.teamName} öffnen`}
        >
          {row.teamName}
        </button>
        <strong className="nl-result-podium-points nl-tnum">
          <NlCountUpValue value={row.matchdayPoints} format={(value) => formatNlNumber(value, 1)} />
          <small>Punkte</small>
        </strong>
        <span className="nl-result-podium-scores nl-tnum" title={`${matchdaySummary.d1.disciplineName ?? "D1"} · ${matchdaySummary.d2.disciplineName ?? "D2"}`}>
          {formatNlNumber(row.d1Score, 1)} · {formatNlNumber(row.d2Score, 1)}
        </span>
        <span className="nl-result-podium-block" aria-hidden="true">
          <span className="nl-result-podium-blockrank nl-tnum">{rank}</span>
        </span>
      </div>
    );
  }

  function renderTopPlayerRow(player: MatchdaySummaryTopPlayer, index: number) {
    const medalKind = index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : null;
    return (
      <li key={`${player.playerId}-${player.disciplineId}`} className="nl-result-mvp-row">
        <span className="nl-result-rank">
          {medalKind ? (
            <NlMedalBadge kind={medalKind} title={`MVP-Platz ${index + 1}`} />
          ) : (
            <span className="nl-result-ranknum nl-tnum">{index + 1}</span>
          )}
        </span>
        <span className="nl-result-mvp-copy">
          <span className="nl-result-mvp-player">{player.playerName}</span>
          <button
            type="button"
            className="nl-result-mvp-team"
            onClick={() => openTeamProfileById(player.teamId)}
            title={`${player.teamName} öffnen`}
          >
            {player.teamShortCode} · {player.teamName}
          </button>
        </span>
        <span
          className={`nl-result-mvp-discipline ${nlToneClass(player.disciplineSide === "d1" ? "accent" : "neutral")}`}
          title={player.disciplineName}
        >
          {player.disciplineSide === "d1" ? "D1" : "D2"}
        </span>
        <span className="nl-result-mvp-stats nl-tnum">
          <strong>{formatNlNumber(player.finalPlayerScore, 1)}</strong>
          <small>{player.points != null ? `${formatNlNumber(player.points, 1)} PPs` : "—"}</small>
        </span>
      </li>
    );
  }

  function renderBoardRow(row: MatchdaySummaryTeamRow) {
    const isActive = row.teamId === activeManagerTeamId;
    // Medaillen-Optik nur für den entschiedenen Tag — im Zwischenstand sind die
    // ersten drei Zeilen eine Momentaufnahme, keine Vergabe.
    const medalKind = isPartial
      ? null
      : row.matchdayRank === 1 ? "gold" : row.matchdayRank === 2 ? "silver" : row.matchdayRank === 3 ? "bronze" : null;
    const logoSrc = getTeamLogoBrowserUrl(row.teamId, null, { variant: "thumb" });

    return (
      <li
        key={row.teamId}
        className={`nl-result-row${isActive ? " is-active-team" : ""}`}
        style={getSeasonV2TeamTagStyle(row.teamShortCode)}
      >
        <span className="nl-result-rank">
          {medalKind ? (
            <NlMedalBadge kind={medalKind} title={`Tagesrang ${row.matchdayRank}`} />
          ) : (
            <span className="nl-result-ranknum nl-tnum">{row.matchdayRank ?? "—"}</span>
          )}
        </span>
        <button
          type="button"
          className="nl-result-team"
          onClick={() => openTeamProfileById(row.teamId)}
          title={`${row.teamName} öffnen`}
        >
          <BudgetedMediaImage
            src={logoSrc}
            alt={`${row.teamName} Logo`}
            className="nl-result-crest"
            width={28}
            height={28}
            loading="lazy"
            fallback={<span className="nl-result-crest nl-result-crest-fallback">{row.teamShortCode}</span>}
          />
          <span className="nl-result-team-copy">
            <span className="nl-result-teamname">{row.teamName}</span>
            <span className="nl-result-teamcode">{row.teamShortCode}</span>
          </span>
        </button>
        <span className="nl-result-points nl-tnum" title="Tagespunkte dieses Spieltags">
          {row.matchdayPoints != null ? formatNlNumber(row.matchdayPoints, 1) : "—"}
        </span>
        <span className="nl-result-scores" aria-hidden="true">
          <span className="nl-result-scorebar" title={`${matchdaySummary.d1.disciplineName ?? "D1"}: ${formatNlNumber(row.d1Score, 1)}`}>
            <NlProgressBar
              className="nl-result-scorebar-progress"
              value={getBarPercent(row.d1Score, maxD1)}
              max={100}
              tone="accent"
              showValue={false}
            />
            <span className="nl-result-scorebar-value nl-tnum">{formatNlNumber(row.d1Score, 1)}</span>
          </span>
          <span className="nl-result-scorebar" title={`${matchdaySummary.d2.disciplineName ?? "D2"}: ${formatNlNumber(row.d2Score, 1)}`}>
            <NlProgressBar
              className="nl-result-scorebar-progress"
              value={getBarPercent(row.d2Score, maxD2)}
              max={100}
              tone="neutral"
              showValue={false}
            />
            <span className="nl-result-scorebar-value nl-tnum">{formatNlNumber(row.d2Score, 1)}</span>
          </span>
        </span>
        {renderRankMovement(row)}
        <span className="nl-result-cumulative nl-tnum" title="Kumulierte Saisonpunkte nach diesem Spieltag">
          Σ {row.cumulativePoints != null ? formatNlNumber(row.cumulativePoints, 1) : "—"}
        </span>
      </li>
    );
  }

  function renderDatenTable() {
    return (
      <div className="nl-result-table-shell">
        <table className="nl-result-table nl-tnum">
          <thead>
            <tr>
              {renderSortableTh("team", "Team")}
              {renderSortableTh("rank", "Tagesrang")}
              {renderSortableTh("points", "Punkte")}
              {renderSortableTh("d1", matchdaySummary.d1.disciplineName ?? "D1")}
              {renderSortableTh("d2", matchdaySummary.d2.disciplineName ?? "D2")}
              {renderSortableTh("before", "vorher")}
              {renderSortableTh("after", "nachher")}
              {renderSortableTh("delta", "Δ")}
              {renderSortableTh("cumulative", "Kumuliert")}
            </tr>
          </thead>
          <tbody>
            {datenRows.map((row) => (
              <tr
                key={row.teamId}
                className={row.teamId === activeManagerTeamId ? "is-active-team" : undefined}
                onClick={() => openTeamProfileById(row.teamId)}
                title={`${row.teamName} öffnen`}
              >
                <td className="nl-result-td-team">
                  <strong>{row.teamShortCode}</strong> · {row.teamName}
                </td>
                <td>{row.matchdayRank ?? "—"}</td>
                <td>{row.matchdayPoints != null ? formatNlNumber(row.matchdayPoints, 1) : "—"}</td>
                <td>{formatNlNumber(row.d1Score, 1)}</td>
                <td>{formatNlNumber(row.d2Score, 1)}</td>
                <td>{row.seasonRankBeforeMatchday ?? "—"}</td>
                <td>{row.seasonRankAfterMatchday ?? "—"}</td>
                <td>
                  {row.rankDelta != null ? (
                    <NlDeltaChip value={row.rankDelta} format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>{row.cumulativePoints != null ? formatNlNumber(row.cumulativePoints, 1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section
      className="nl-result"
      id="foundation-matchday-result"
      data-testid="foundation-matchday-result"
      data-new-look="true"
    >
      <NlCard
        className="nl-result-header-card"
        eyebrow={`${sourceBadgeLabel} · ${matchdaySummary.seasonId} · Spieltag ${matchdaySummary.matchdayNumber ?? "—"}${isPartial ? " · läuft" : ""}`}
        title="Spieltagsergebnis"
        actions={
          <div className="nl-result-actions">
            <label className="nl-result-select">
              <span>Spieltag</span>
              <select value={activeMatchdaySummaryId} onChange={(event) => setSelectedMatchdaySummaryId(event.target.value)}>
                {matchdaySummaryOptions.length ? (
                  matchdaySummaryOptions.map((option) => (
                    <option key={option.matchdayId} value={option.matchdayId}>
                      Spieltag {option.matchdayNumber ?? "—"}
                    </option>
                  ))
                ) : (
                  <option value={activeMatchdaySummaryId}>Keine gespeicherten Ergebnisse</option>
                )}
              </select>
            </label>
            <button
              className="nl-result-button"
              type="button"
              onClick={() => setFoundationView("matchdayArena", setActiveView)}
            >
              Zur Arena
            </button>
            <button
              className="nl-result-button is-primary"
              type="button"
              onClick={() => setFoundationView("seasonV2", setActiveView)}
            >
              Saisonstand
            </button>
          </div>
        }
      >
        {hasResult && isPartial ? (
          // Der Zwischenstands-Hinweis ist die EINE Aussage, die alle Zahlen dieser
          // Seite einordnet — dieselbe Erzählung wie „Spieltag 4 · läuft" im
          // Spielplan und „Etappe 1/2 gewertet" in der Arena.
          <p className="nl-result-partial-note" data-testid="nl-result-partial-note" role="status">
            <strong>Zwischenstand:</strong> {d1Name} ist gewertet, {d2Name} steht noch aus. Tagesränge
            und Führung sind vorläufig — der Tagessieger wird erst nach beiden Disziplinen gekürt.
          </p>
        ) : null}
        {hasResult ? (
          <div className="nl-result-hero">
            <div className="nl-result-hero-stage">
              {heroLogo ? (
                <BudgetedMediaImage
                  src={heroLogo.src}
                  alt={`${heroRow?.teamName ?? selectedTeam?.name ?? "Team"} Logo`}
                  className="nl-result-hero-crest"
                  width={72}
                  height={72}
                  fallback={<span className="nl-result-hero-crest nl-result-hero-crest-fallback">{heroLogo.initials}</span>}
                />
              ) : (
                <span className="nl-result-hero-crest nl-result-hero-crest-fallback">—</span>
              )}
              <div className="nl-result-hero-copy">
                <span className="nl-result-hero-teamname">
                  {heroRow?.teamName ?? selectedTeam?.name ?? "Kein aktives Team"}
                </span>
                <span className="nl-result-hero-rankline">
                  {/* Auf halber Strecke heißt der Rang beim wahren Namen: Zwischenrang. */}
                  <span className="nl-result-hero-ranklabel">{isPartial ? "Zwischenrang" : "Tagesrang"}</span>
                  <strong className="nl-result-hero-rank nl-tnum">
                    {heroRow?.matchdayRank != null ? `#${heroRow.matchdayRank}` : "—"}
                  </strong>
                  {!isPartial && heroRow?.matchdayRank != null && heroRow.matchdayRank <= 3 ? (
                    <NlMedalBadge
                      kind={heroRow.matchdayRank === 1 ? "gold" : heroRow.matchdayRank === 2 ? "silver" : "bronze"}
                      title={`Tagesrang ${heroRow.matchdayRank}`}
                    />
                  ) : null}
                </span>
                <span className="nl-result-hero-points">
                  <strong className="nl-result-hero-points-value nl-tnum">
                    {heroPoints != null ? formatNlNumber(heroPoints, 1) : "—"}
                  </strong>
                  <span className="nl-result-hero-points-label">Tagespunkte</span>
                </span>
                {heroRow ? renderRankMovement(heroRow) : null}
              </div>
            </div>
            <StatChipRow className="nl-result-hero-chips" aria-label="Spieltag-Kontext">
              <StatChip
                label="D1"
                value={matchdaySummary.d1.disciplineName ?? "—"}
                tone="accent"
                sub={heroRow?.d1Score != null ? `${formatNlNumber(heroRow.d1Score, 1)} Score` : undefined}
              />
              <StatChip
                label="D2"
                value={matchdaySummary.d2.disciplineName ?? "—"}
                tone="neutral"
                sub={
                  heroRow?.d2Score != null
                    ? `${formatNlNumber(heroRow.d2Score, 1)} Score`
                    : isPartial
                      ? "steht noch aus"
                      : undefined
                }
              />
              {championRow ? (
                <StatChip
                  // Halbzeit-Führung ist kein Sieg: das Label sagt, was die Zahl ist.
                  label={isPartial ? "Zwischenführung" : "Tagessieger"}
                  value={championRow.teamName}
                  tone="accent"
                  sub={
                    championRow.matchdayPoints != null
                      ? `${formatNlNumber(championRow.matchdayPoints, 1)} Punkte${isPartial ? " · vorläufig" : ""}`
                      : undefined
                  }
                  onClick={() => openTeamProfileById(championRow.teamId)}
                  title={`${championRow.teamName} öffnen`}
                />
              ) : null}
            </StatChipRow>
          </div>
        ) : (
          // A5 (Audit Spieltag): vorher standen hier dieselben Kacheln mit lauter
          // "—" (Tagesrang, Tagespunkte, D1/D2 leer) — Nullwerte ohne Erklärung,
          // wo in Wahrheit noch gar kein Ergebnis existiert. Chris' Regel „bei 0
          // wird erklärt, nicht versteckt" gilt genauso fürs „noch nie": ein Satz
          // statt eines Gerüsts aus Gedankenstrichen.
          <p className="nl-result-pending-note" data-testid="nl-result-pending-note">
            Für {heroRow?.teamName ?? selectedTeam?.name ?? "dein Team"} liegt für Spieltag{" "}
            {matchdaySummary.matchdayNumber ?? "—"} noch kein Ergebnis vor. Die Wertung erscheint hier,
            sobald beide Disziplinen in der Arena gewertet sind.
          </p>
        )}
      </NlCard>

      {/* Der Gold-Reveal ist die Kür des FERTIGEN Spieltags — auf halber Strecke
          gibt es keinen Tagessieger, also auch keinen Reveal (die Zwischenführung
          steht als beschrifteter Chip im Kopf). */}
      {championRow && !isPartial && !tagessiegerDismissed ? (
        <section
          className="nl-result-reveal"
          data-testid="nl-result-tagessieger-reveal"
          aria-label="Tagessieger-Reveal"
        >
          <div className="nl-result-reveal-inner">
            <span
              className="nl-result-reveal-eyebrow nl-reveal"
              style={{ "--nl-reveal-i": 0 } as CSSProperties}
            >
              Spieltag {matchdaySummary.matchdayNumber ?? "—"} · Tagessieger
            </span>
            <div
              className="nl-result-reveal-champion nl-reveal"
              style={{ "--nl-reveal-i": 1 } as CSSProperties}
            >
              <NlMedalBadge kind="gold" title="Tagessieger" className="nl-result-reveal-medal" />
              <BudgetedMediaImage
                src={getTeamLogoBrowserUrl(championRow.teamId, null, { variant: "thumb" })}
                alt={`${championRow.teamName} Logo`}
                className="nl-result-reveal-crest"
                width={64}
                height={64}
                fallback={
                  <span className="nl-result-reveal-crest nl-result-reveal-crest-fallback">
                    {championRow.teamShortCode}
                  </span>
                }
              />
              <div className="nl-result-reveal-copy">
                <button
                  type="button"
                  className="nl-result-reveal-team"
                  onClick={() => openTeamProfileById(championRow.teamId)}
                  title={`${championRow.teamName} öffnen`}
                >
                  {championRow.teamName}
                </button>
                <span className="nl-result-reveal-points nl-tnum">
                  <strong>
                    <NlCountUpValue
                      value={championRow.matchdayPoints}
                      format={(value) => formatNlNumber(value, 1)}
                    />
                  </strong>
                  <small>Tagespunkte</small>
                </span>
              </div>
            </div>
            {heroRow ? (
              <p
                className="nl-result-reveal-you nl-reveal nl-tnum"
                style={{ "--nl-reveal-i": 2 } as CSSProperties}
              >
                Du: <strong>{heroRow.matchdayRank != null ? `#${heroRow.matchdayRank}` : "—"}</strong>{" "}
                von {boardRows.length}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="nl-result-reveal-skip"
            onClick={() => setTagessiegerDismissed(true)}
            aria-label="Tagessieger-Reveal überspringen"
          >
            Überspringen
          </button>
        </section>
      ) : null}

      {/* Medaillen-Podium erst, wenn der Tag entschieden ist — ein halber Spieltag
          vergibt keine Tages-Medaillen (der Zwischenstand steht in der Tageswertung). */}
      {podiumRows.length > 0 && !isPartial ? (
        <NlCard
          className="nl-result-podium-card"
          title="Tages-Podium"
          eyebrow="Die drei besten Teams dieses Spieltags"
        >
          <div className="nl-result-podium" role="list" aria-label="Tages-Podium">
            {[
              podiumRows.find((row) => row.matchdayRank === 2),
              podiumRows.find((row) => row.matchdayRank === 1),
              podiumRows.find((row) => row.matchdayRank === 3),
            ]
              .filter((row): row is MatchdaySummaryTeamRow => row != null)
              .map((row) => renderPodiumStep(row, (row.matchdayRank ?? 4) - 1))}
          </div>
        </NlCard>
      ) : null}

      <NlCard
        className="nl-result-board-card"
        title={isPartial ? "Tageswertung · Zwischenstand" : "Tageswertung"}
        eyebrow={
          hasResult
            ? isPartial
              ? `Nach ${d1Name} · ${d2Name} steht noch aus · ${boardRows.length} Teams`
              : `${boardRows.length} Teams`
            : "Noch keine Wertung"
        }
        actions={
          hasResult ? (
            <NlSubTabs
              items={NL_RESULT_MODE_ITEMS}
              activeId={mode}
              onSelect={(id) => setMode(id as NlResultMode)}
              aria-label="Ergebnis-Ansicht"
            />
          ) : null
        }
      >
        {/* A5 (Audit Spieltag): vorher rendierte diese Karte alle 32 Teams mit
            lauter "—"-Zellen — ein Ergebnis-Skelett ohne Ergebnis (Muster 3, wie
            die Arena vor S3). `VeloPendingRanking` ist dasselbe geteilte
            Primitive wie dort: keine Zeilen, keine Ränge, keine Medaillen-Optik,
            solange es nichts zu werten gibt. */}
        {!hasResult ? (
          <VeloPendingRanking
            eyebrow="Spieltags-Wertung"
            title="Wertung folgt"
            note={`Sobald dieser Spieltag in der Arena gewertet ist, erscheint hier die Tageswertung aller ${boardRows.length} Teams. Bis dahin steht hier bewusst keine Reihenfolge.`}
            slots={[
              { key: "gold", ring: "1.", label: "Noch zu vergeben" },
              { key: "silver", ring: "2.", label: "Noch zu vergeben" },
              { key: "bronze", ring: "3.", label: "Noch zu vergeben" },
            ]}
            meta={`${boardRows.length} Teams gemeldet`}
            data-testid="nl-result-pending-ranking"
          />
        ) : boardRows.length === 0 ? (
          <p className="nl-result-empty-text">Für diesen Spieltag liegt noch kein gespeichertes Ergebnis vor.</p>
        ) : mode === "board" ? (
          <ol className="nl-result-board" aria-label="Tageswertung">
            {boardRows.map((row) => renderBoardRow(row))}
          </ol>
        ) : (
          renderDatenTable()
        )}
      </NlCard>

      <NlCard
        className="nl-result-mvp-card"
        title="Tages-MVPs"
        eyebrow={
          isPartial
            ? `Beste Einzelleistungen — vorläufig, ${d2Name} steht noch aus`
            : "Beste Einzelleistungen dieses Spieltags"
        }
      >
        {topPlayers.length === 0 ? (
          <p className="nl-result-empty-text">
            {hasResult
              ? "Für diesen Spieltag liegen noch keine Spieler-Wertungen vor."
              : "Erscheint, sobald dieser Spieltag gewertet ist."}
          </p>
        ) : (
          <>
            {mvpPlayer ? (
              <div className="nl-result-mvp-hero" data-testid="nl-result-mvp-hero">
                <span className="nl-result-mvp-hero-eyebrow">Tages-MVP</span>
                <div className="nl-result-mvp-hero-main">
                  <NlMedalBadge kind="gold" title="Tages-MVP" className="nl-result-mvp-hero-medal" />
                  <div className="nl-result-mvp-hero-copy">
                    <strong className="nl-result-mvp-hero-name">{mvpPlayer.playerName}</strong>
                    <button
                      type="button"
                      className="nl-result-mvp-hero-team"
                      onClick={() => openTeamProfileById(mvpPlayer.teamId)}
                      title={`${mvpPlayer.teamName} öffnen`}
                    >
                      {mvpPlayer.teamShortCode} · {mvpPlayer.teamName}
                    </button>
                  </div>
                  <span
                    className={`nl-result-mvp-discipline ${nlToneClass(mvpPlayer.disciplineSide === "d1" ? "accent" : "neutral")}`}
                    title={mvpPlayer.disciplineName}
                  >
                    {mvpPlayer.disciplineName}
                  </span>
                </div>
                <div className="nl-result-mvp-hero-stats nl-tnum">
                  <span className="nl-result-mvp-hero-stat">
                    <strong><NlCountUpValue value={mvpPlayer.finalPlayerScore} format={(value) => formatNlNumber(value, 1)} /></strong>
                    <small>Score</small>
                  </span>
                  <span className="nl-result-mvp-hero-stat">
                    <strong><NlCountUpValue value={mvpPlayer.points} format={(value) => formatNlNumber(value, 1)} /></strong>
                    <small>PPs</small>
                  </span>
                  {mvpPlayer.totalBonus != null && mvpPlayer.totalBonus !== 0 ? (
                    <span className="nl-result-mvp-hero-stat">
                      <strong>{`${mvpPlayer.totalBonus > 0 ? "+" : ""}${formatNlNumber(mvpPlayer.totalBonus, 1)}`}</strong>
                      <small>Bonus</small>
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {topPlayers.length > 1 ? (
              <ol className="nl-result-mvp-list" aria-label="Weitere Tages-MVPs" start={2}>
                {topPlayers.slice(1).map((player, index) => renderTopPlayerRow(player, index + 1))}
              </ol>
            ) : null}
          </>
        )}
      </NlCard>

      <NlCard
        className="nl-result-highlight-card"
        title="Highlights"
        eyebrow={isPartial ? `Aus ${d1Name} — ${d2Name} steht noch aus` : undefined}
        actions={
          <button className="nl-result-button is-primary" type="button" onClick={() => void triggerGlobalNext()}>
            Weiter zum nächsten Schritt
          </button>
        }
      >
        {matchdaySummary.highlights.length ? (
          <div className="nl-result-highlight-grid">
            {matchdaySummary.highlights.map((highlight) => (
              <article
                key={highlight.id}
                className="nl-result-highlight"
                title={`Quelle: ${highlight.source}`}
              >
                <span className="nl-result-highlight-glyph" aria-hidden="true">
                  {getHighlightGlyph(highlight)}
                </span>
                <span className="nl-result-highlight-copy">
                  <span className="nl-result-highlight-label">{highlight.label}</span>
                  <strong className="nl-result-highlight-value">{highlight.value}</strong>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="nl-result-empty-text">Keine Highlight-Karten ohne gespeicherte Highlight-Quelle.</p>
        )}
      </NlCard>

      {/* "missing_matchday_result" ist jetzt die primäre Aussage der ganzen Seite
          (s.o.) statt eine Zeile im technischen Diagnose-Aufklapper — hier würde
          sie nur denselben Sachverhalt ein zweites Mal, roh, wiederholen. */}
      {diagnoseWarnings.length ? (
        <details className="nl-result-diagnose">
          <summary>Details &amp; Diagnose ({diagnoseWarnings.length})</summary>
          <ul className="nl-result-diagnose-list">
            {diagnoseWarnings.map((warning, index) => (
              <li key={`nl-result-warning-${index}`}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
