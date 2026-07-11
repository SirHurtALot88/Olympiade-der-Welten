"use client";

import { useMemo } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlDeltaChip,
  NlProgressBar,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  type NlTone,
} from "@/components/foundation/new-look";
import type { FoundationSeasonPreviewShellHostProps } from "@/app/foundation/season-preview-v2/FoundationSeasonPreviewShellHost";
import type { FoundationStandingsPreviewItem } from "@/lib/foundation/tabs/foundation-page-types";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";

/**
 * "Neuer Look" Saison-Preview — Projektions-Board (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationSeasonPreviewShellHost` fällt ohne Flag unverändert auf das
 * bestehende Layout zurück. Konsumiert exakt dieselben Props/Daten.
 *
 * Übersetzungen statt Debug-Leaks:
 * - `teamId` erscheint nicht mehr roh im Board; Teams werden über Name,
 *   Kürzel und Wappen (Logo-Modell aus `gameState.teams`) dargestellt.
 * - `readinessStatus`/`resultStatus` (Enum-Strings) werden in deutsche
 *   Spieler-Labels übersetzt; die technischen Codes bleiben im Tooltip.
 * - `currentPoints == null` zeigt "—" mit Hinweis statt dem Literal "BLOCKED".
 * - `blockedRules` (Regel-Codes) werden zu EINEM Klartext-Hinweis verdichtet;
 *   die Rule-IDs stehen nur im Tooltip und im Diagnose-Abschnitt.
 * - Scope-Rohdaten (Save-/Season-/Matchday-IDs) und Quellen-Flags wandern in
 *   den ausklappbaren Diagnose-Abschnitt.
 */

const READINESS_LABELS: Record<string, { label: string; tone: NlTone }> = {
  ready: { label: "Bereit", tone: "good" },
  underfilled_roster: { label: "Kader unterbesetzt", tone: "warn" },
  missing_lineup: { label: "Aufstellung fehlt", tone: "risk" },
  invalid_lineup: { label: "Aufstellung ungültig", tone: "risk" },
  missing_score_coverage: { label: "Wertung unvollständig", tone: "warn" },
  missing_result: { label: "Ergebnis fehlt", tone: "risk" },
  unknown: { label: "Status offen", tone: "neutral" },
};

const RESULT_STATUS_LABELS: Record<FoundationStandingsPreviewItem["resultStatus"], { label: string; tone: NlTone }> = {
  ready: { label: "Ergebnis gespeichert", tone: "good" },
  missing_result: { label: "Ergebnis fehlt", tone: "risk" },
  incomplete_result: { label: "Ergebnis unvollständig", tone: "warn" },
  tie_warning: { label: "Gleichstand", tone: "warn" },
};

/** Klartext pro bekannter Blocker-Rule; Reihenfolge = Anzeige-Priorität. */
const BLOCKED_RULE_HINTS: Array<{ rule: string; hint: string }> = [
  {
    rule: "global_score_tie_breaker_missing",
    hint: "Gleichstand erkannt — ohne festgelegte Tie-Breaker-Regel bleibt die Übernahme der Projektion pausiert.",
  },
  {
    rule: "rank_to_points_mapping_missing",
    hint: "Die Punkte-Zuordnung (Rang → Punkte) ist noch nicht vollständig — projizierte Punkte können fehlen.",
  },
  {
    rule: "points_table_missing",
    hint: "Die Punkte-Tabelle ist noch nicht hinterlegt — projizierte Punkte können fehlen.",
  },
  {
    rule: "season_standings_sheet_mapping_missing",
    hint: "Der Saisonstand ist noch nicht mit der Standings-Quelle verknüpft — aktuelle Punkte können fehlen.",
  },
  {
    rule: "standings_before_after_snapshots_missing",
    hint: "Vorher/Nachher-Stände liegen für diesen Spieltag noch nicht vor.",
  },
];

function buildBlockedRulesHint(blockedRules: string[]): string | null {
  if (!blockedRules.length) {
    return null;
  }
  const known = BLOCKED_RULE_HINTS.find((entry) => blockedRules.includes(entry.rule));
  const base = known?.hint ?? "Die Projektion ist noch blockiert — Details im Diagnose-Abschnitt.";
  const remaining = blockedRules.length - (known ? 1 : 0);
  return remaining > 0 ? `${base} (${remaining} weitere${remaining === 1 ? "r" : ""} Blocker)` : base;
}

function getReadinessBadge(status: string) {
  return READINESS_LABELS[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" as NlTone };
}

function getBarPercent(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || max <= 0) {
    return 0;
  }
  return Math.max(4, Math.min(100, (value / max) * 100));
}

function compareProjectionRows(left: FoundationStandingsPreviewItem, right: FoundationStandingsPreviewItem) {
  const leftRank = left.projectedRank ?? left.currentRank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.projectedRank ?? right.currentRank ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return left.teamName.localeCompare(right.teamName, "de");
}

export default function SeasonPreviewNewLook(props: FoundationSeasonPreviewShellHostProps) {
  const { gameState, standingsPreviewFeed, openTeamProfileById } = props;

  const teamById = useMemo(
    () => new Map(gameState.teams.map((team) => [team.teamId, team] as const)),
    [gameState.teams],
  );

  const rows = useMemo(
    () => [...(standingsPreviewFeed?.items ?? [])].sort(compareProjectionRows),
    [standingsPreviewFeed?.items],
  );

  // Echte Projektion nur zeigen, wenn die Engine sie wirklich liefert.
  const hasProjection = rows.some((row) => row.projectedRank != null);
  const hasProjectedPoints = rows.some((row) => row.projectedPoints != null);
  const maxD1 = rows.reduce((max, row) => (row.d1Score != null && row.d1Score > max ? row.d1Score : max), 0);
  const maxD2 = rows.reduce((max, row) => (row.d2Score != null && row.d2Score > max ? row.d2Score : max), 0);

  const blockedRules = standingsPreviewFeed?.blockedRules ?? [];
  const blockedHint = buildBlockedRulesHint(blockedRules);
  const tieGroups = standingsPreviewFeed?.tieGroups ?? [];

  const summary = standingsPreviewFeed?.summary ?? null;

  function renderProjectionCell(row: FoundationStandingsPreviewItem) {
    if (!hasProjection || (row.currentRank == null && row.projectedRank == null)) {
      return <span className="nl-spreview-projection is-empty">—</span>;
    }
    const delta =
      row.currentRank != null && row.projectedRank != null ? row.currentRank - row.projectedRank : null;
    return (
      <span className="nl-spreview-projection" title="Aktueller Rang → projizierter Rang nach diesem Spieltag">
        <span className="nl-spreview-projection-rank nl-tnum">{row.currentRank ?? "—"}</span>
        <span className="nl-spreview-projection-arrow" aria-hidden="true">
          →
        </span>
        <strong className="nl-spreview-projection-rank is-projected nl-tnum">{row.projectedRank ?? "—"}</strong>
        {delta != null && delta !== 0 ? (
          <NlDeltaChip
            value={delta}
            format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)}`}
            title={delta > 0 ? `Klettert ${delta} Plätze` : `Fällt ${Math.abs(delta)} Plätze`}
          />
        ) : null}
      </span>
    );
  }

  function renderPointsCell(row: FoundationStandingsPreviewItem) {
    return (
      <span className="nl-spreview-points">
        <span
          className="nl-spreview-points-current nl-tnum"
          title={
            row.currentPoints == null
              ? "Aktueller Punktestand blockiert — Punkte-Zuordnung fehlt (Details im Diagnose-Abschnitt)."
              : "Aktuelle Saisonpunkte"
          }
        >
          {row.currentPoints != null ? formatNlNumber(row.currentPoints, 1) : "—"}
        </span>
        {hasProjectedPoints ? (
          <>
            <span className="nl-spreview-projection-arrow" aria-hidden="true">
              →
            </span>
            <strong className="nl-spreview-points-projected nl-tnum" title="Projizierte Saisonpunkte nach diesem Spieltag">
              {row.projectedPoints != null ? formatNlNumber(row.projectedPoints, 1) : "—"}
            </strong>
            {row.pointsDelta != null && row.pointsDelta !== 0 ? (
              <NlDeltaChip value={row.pointsDelta} title="Punkte-Delta aus diesem Spieltag" />
            ) : null}
          </>
        ) : null}
      </span>
    );
  }

  function renderRow(row: FoundationStandingsPreviewItem) {
    const team = teamById.get(row.teamId) ?? null;
    const logo = team ? getTeamLogoModel(team, { variant: "thumb" }) : null;
    const readiness = getReadinessBadge(row.readinessStatus);
    const resultStatus = RESULT_STATUS_LABELS[row.resultStatus] ?? {
      label: row.resultStatus,
      tone: "neutral" as NlTone,
    };
    const displayRank = row.projectedRank ?? row.currentRank;

    return (
      <li
        key={row.teamId}
        className="nl-spreview-row"
        style={team ? getSeasonV2TeamTagStyle(team.shortCode) : undefined}
      >
        <span className="nl-spreview-rank nl-tnum" title={hasProjection ? "Projizierter Rang" : "Aktueller Rang"}>
          {displayRank ?? "—"}
        </span>
        <button
          type="button"
          className="nl-spreview-team"
          onClick={() => openTeamProfileById(row.teamId)}
          title={`${row.teamName} öffnen`}
        >
          <BudgetedMediaImage
            src={logo?.src ?? null}
            alt={`${row.teamName} Logo`}
            className="nl-spreview-crest"
            width={28}
            height={28}
            loading="lazy"
            fallback={
              <span className="nl-spreview-crest nl-spreview-crest-fallback">
                {logo?.initials ?? row.teamName.slice(0, 2).toUpperCase()}
              </span>
            }
          />
          <span className="nl-spreview-team-copy">
            <span className="nl-spreview-teamname">{row.teamName}</span>
            {team ? <span className="nl-spreview-teamcode">{team.shortCode}</span> : null}
          </span>
        </button>
        {renderProjectionCell(row)}
        {renderPointsCell(row)}
        <span className="nl-spreview-matchday" title="Tagesrang und Tages-Score dieses Spieltags">
          <span className="nl-spreview-matchday-rank nl-tnum">
            {row.matchdayRank != null ? `Tag #${row.matchdayRank}` : "Tag —"}
          </span>
          <span className="nl-spreview-scorebars" aria-hidden="true">
            <NlProgressBar
              className="nl-spreview-scorebar"
              value={getBarPercent(row.d1Score, maxD1)}
              max={100}
              tone="pow"
              showValue={false}
              title={`D1: ${formatNlNumber(row.d1Score, 1)}`}
            />
            <NlProgressBar
              className="nl-spreview-scorebar"
              value={getBarPercent(row.d2Score, maxD2)}
              max={100}
              tone="men"
              showValue={false}
              title={`D2: ${formatNlNumber(row.d2Score, 1)}`}
            />
          </span>
          <span className="nl-spreview-matchday-score nl-tnum">
            {row.matchdayScore != null ? formatNlNumber(row.matchdayScore, 1) : "—"}
          </span>
        </span>
        <span className="nl-spreview-status">
          <span
            className={`nl-spreview-badge ${nlToneClass(readiness.tone)}`}
            title={`Technischer Status: ${row.readinessStatus}`}
          >
            {readiness.label}
          </span>
          <span
            className={`nl-spreview-badge ${nlToneClass(resultStatus.tone)}`}
            title={`Technischer Status: ${row.resultStatus}${row.warnings.length ? ` · Warnungen: ${row.warnings.join(", ")}` : ""}`}
          >
            {resultStatus.label}
          </span>
        </span>
      </li>
    );
  }

  return (
    <section className="nl-spreview" id="standings-preview" data-testid="nl-season-preview" data-new-look="true">
      <NlCard
        className="nl-spreview-header-card"
        eyebrow="Projektion aus gespeicherten Spieltagsergebnissen · Nur-Lesen"
        title="Saison-Preview"
        actions={
          summary ? (
            <StatChipRow aria-label="Preview-Status">
              <StatChip
                label="Ergebnis"
                value={summary.matchdayResultFound ? "gefunden" : "fehlt"}
                tone={summary.matchdayResultFound ? "good" : "risk"}
                title="Gibt es ein gespeichertes Spieltagsergebnis für diese Projektion?"
              />
              <StatChip
                label="Bereit"
                value={`${summary.readyTeams}/${summary.totalTeams}`}
                tone={summary.readyTeams >= summary.totalTeams && summary.totalTeams > 0 ? "good" : "warn"}
                title="Teams mit vollständiger Wertung"
              />
              <StatChip
                label="Blocker"
                value={blockedRules.length}
                tone={blockedRules.length > 0 ? "warn" : "good"}
                title={blockedRules.length ? `Technische Rule-IDs: ${blockedRules.join(", ")}` : "Keine offenen Blocker"}
              />
            </StatChipRow>
          ) : null
        }
      >
        <p className="nl-spreview-intro">
          Diese Vorschau kombiniert das gespeicherte Spieltagsergebnis mit dem aktuellen Punktestand und zeigt, wohin
          sich jedes Team bewegen würde. Sie schreibt nichts zurück.
        </p>
        {blockedHint ? (
          <p
            className="nl-spreview-blocked-hint"
            title={`Technische Rule-IDs: ${blockedRules.join(", ")}`}
            data-testid="nl-spreview-blocked-hint"
          >
            {blockedHint}
          </p>
        ) : null}
        {tieGroups.length > 0 ? (
          <p className="nl-spreview-tie-hint">
            Punktgleich:{" "}
            {tieGroups
              .map((group) => group.affectedTeams.map((team) => team.teamName).join(", "))
              .join(" · ")}
          </p>
        ) : null}
      </NlCard>

      {rows.length === 0 ? (
        <NlCard className="nl-spreview-empty-card">
          <p className="nl-spreview-empty-text">
            Für diesen Spieltag liegt noch kein gespeichertes Ergebnis vor — sobald die Arena durchgelaufen ist,
            erscheint hier die Projektion.
          </p>
        </NlCard>
      ) : (
        <ol className="nl-spreview-board" aria-label="Projektions-Board">
          {rows.map((row) => renderRow(row))}
        </ol>
      )}

      <details className="nl-spreview-diagnose">
        <summary>Details &amp; Diagnose</summary>
        <div className="nl-spreview-diagnose-body">
          <p className="nl-spreview-diagnose-line">
            Scope: {standingsPreviewFeed?.scope?.saveId ?? props.activeSaveId} /{" "}
            {standingsPreviewFeed?.scope?.seasonId ?? gameState.season.id} /{" "}
            {standingsPreviewFeed?.scope?.matchdayId ?? gameState.matchdayState.matchdayId}
          </p>
          {standingsPreviewFeed?.source ? (
            <p className="nl-spreview-diagnose-line">
              Quelle: {standingsPreviewFeed.source.mode} · Result {standingsPreviewFeed.source.matchdayResult} · Punkte{" "}
              {standingsPreviewFeed.source.currentPoints} · Fixtures {standingsPreviewFeed.source.fixtureCoverage}
            </p>
          ) : null}
          {blockedRules.length > 0 ? (
            <ul className="nl-spreview-diagnose-list">
              {blockedRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          ) : (
            <p className="nl-spreview-diagnose-line">Keine offenen Blocker-Rules.</p>
          )}
          {rows.some((row) => row.warnings.length > 0) ? (
            <ul className="nl-spreview-diagnose-list">
              {rows
                .filter((row) => row.warnings.length > 0)
                .slice(0, 12)
                .map((row) => (
                  <li key={`warn-${row.teamId}`}>
                    {row.teamName}: {row.warnings.join(", ")}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </details>
    </section>
  );
}
