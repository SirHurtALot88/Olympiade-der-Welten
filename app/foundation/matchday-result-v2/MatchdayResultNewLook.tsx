"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlDeltaChip,
  NlMedalBadge,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
} from "@/components/foundation/new-look";
import type { FoundationMatchdayResultShellHostProps } from "@/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost";
import type { MatchdaySummaryHighlight, MatchdaySummaryTeamRow } from "@/lib/foundation/matchday-summary";
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

/** Zähler-Animation, die `prefers-reduced-motion` respektiert. */
function useCountUp(target: number | null, durationMs = 900): number | null {
  const [display, setDisplay] = useState<number | null>(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) {
      setDisplay(target ?? null);
      return;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };
    setDisplay(0);
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, durationMs]);

  return display;
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

/** Schlichtes, emoji-freies Glyphen-Badge pro Highlight-Kategorie. */
function getHighlightGlyph(highlight: MatchdaySummaryHighlight): string {
  const label = highlight.label.toLowerCase();
  if (label.includes("mvp") || label.includes("spieler") || label.includes("player")) {
    return "MVP";
  }
  if (label.includes("team") || label.includes("sieger") || label.includes("winner")) {
    return "TOP";
  }
  if (label.includes("d1")) {
    return "D1";
  }
  if (label.includes("d2")) {
    return "D2";
  }
  return highlight.label.slice(0, 2).toUpperCase() || "•";
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
  } = props;

  const [mode, setMode] = useState<NlResultMode>("board");

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
  const championRow = matchdaySummary.topTeams[0] ?? boardRows[0] ?? null;

  function renderBoardRow(row: MatchdaySummaryTeamRow) {
    const isActive = row.teamId === activeManagerTeamId;
    const medalKind =
      row.matchdayRank === 1 ? "gold" : row.matchdayRank === 2 ? "silver" : row.matchdayRank === 3 ? "bronze" : null;
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
          <span className={`nl-result-scorebar ${nlToneClass("pow")}`} title={`${matchdaySummary.d1.disciplineName ?? "D1"}: ${formatNlNumber(row.d1Score, 1)}`}>
            <span className="nl-result-scorebar-fill" style={{ width: `${getBarPercent(row.d1Score, maxD1)}%` }} />
            <span className="nl-result-scorebar-value nl-tnum">{formatNlNumber(row.d1Score, 1)}</span>
          </span>
          <span className={`nl-result-scorebar ${nlToneClass("men")}`} title={`${matchdaySummary.d2.disciplineName ?? "D2"}: ${formatNlNumber(row.d2Score, 1)}`}>
            <span className="nl-result-scorebar-fill" style={{ width: `${getBarPercent(row.d2Score, maxD2)}%` }} />
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
              <th>Team</th>
              <th>Tagesrang</th>
              <th>Punkte</th>
              <th>{matchdaySummary.d1.disciplineName ?? "D1"}</th>
              <th>{matchdaySummary.d2.disciplineName ?? "D2"}</th>
              <th>vorher</th>
              <th>nachher</th>
              <th>Δ</th>
              <th>Kumuliert</th>
            </tr>
          </thead>
          <tbody>
            {boardRows.map((row) => (
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
        eyebrow={`${sourceBadgeLabel} · ${matchdaySummary.seasonId} · Spieltag ${matchdaySummary.matchdayNumber ?? "—"}`}
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
                <span className="nl-result-hero-ranklabel">Tagesrang</span>
                <strong className="nl-result-hero-rank nl-tnum">
                  {heroRow?.matchdayRank != null ? `#${heroRow.matchdayRank}` : "—"}
                </strong>
                {heroRow?.matchdayRank != null && heroRow.matchdayRank <= 3 ? (
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
              tone="pow"
              sub={heroRow?.d1Score != null ? `${formatNlNumber(heroRow.d1Score, 1)} Score` : undefined}
            />
            <StatChip
              label="D2"
              value={matchdaySummary.d2.disciplineName ?? "—"}
              tone="men"
              sub={heroRow?.d2Score != null ? `${formatNlNumber(heroRow.d2Score, 1)} Score` : undefined}
            />
            {championRow ? (
              <StatChip
                label="Tagessieger"
                value={championRow.teamName}
                tone="accent"
                sub={championRow.matchdayPoints != null ? `${formatNlNumber(championRow.matchdayPoints, 1)} Punkte` : undefined}
                onClick={() => openTeamProfileById(championRow.teamId)}
                title={`${championRow.teamName} öffnen`}
              />
            ) : null}
          </StatChipRow>
        </div>
      </NlCard>

      <NlCard
        className="nl-result-board-card"
        title="Tageswertung"
        eyebrow={`${boardRows.length} Teams`}
        actions={
          <NlSubTabs
            items={NL_RESULT_MODE_ITEMS}
            activeId={mode}
            onSelect={(id) => setMode(id as NlResultMode)}
            aria-label="Ergebnis-Ansicht"
          />
        }
      >
        {boardRows.length === 0 ? (
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
        className="nl-result-highlight-card"
        title="Highlights"
        actions={
          <button className="nl-result-button is-primary" type="button" onClick={() => setFoundationView("cockpit", setActiveView)}>
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

      {matchdaySummary.warnings.length ? (
        <details className="nl-result-diagnose">
          <summary>Details &amp; Diagnose ({matchdaySummary.warnings.length})</summary>
          <ul className="nl-result-diagnose-list">
            {matchdaySummary.warnings.map((warning, index) => (
              <li key={`nl-result-warning-${index}`}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
