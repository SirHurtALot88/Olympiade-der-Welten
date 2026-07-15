"use client";

import { useMemo, type CSSProperties } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  useCountUp,
  type NlMedalKind,
  type NlRadarAxisDef,
  type NlRadarSeries,
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

/**
 * Vergleichbare Achsen für das Stärkeprofil-Radar: D1/D2/Tagesscore sind
 * dieselbe Einheit (Tagesscore = D1 + D2), `totalScore` ist auf dieser
 * Vorschau-Ebene identisch mit dem Tagesscore und daher bewusst ausgelassen
 * (keine zweite Achse mit identischem Wert).
 */
const SPREVIEW_RADAR_AXES: NlRadarAxisDef[] = [
  { key: "d1", label: "D1" },
  { key: "d2", label: "D2" },
  { key: "matchday", label: "Tag" },
];

function getMedalKindForRank(rank: number | null): NlMedalKind | null {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
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
  const maxMatchday = rows.reduce(
    (max, row) => (row.matchdayScore != null && row.matchdayScore > max ? row.matchdayScore : max),
    0,
  );

  const blockedRules = standingsPreviewFeed?.blockedRules ?? [];
  const blockedHint = buildBlockedRulesHint(blockedRules);
  const tieGroups = standingsPreviewFeed?.tieGroups ?? [];

  const summary = standingsPreviewFeed?.summary ?? null;

  // Eigenes Team: `team.humanControlled`-Marker aus `gameState.teams`
  // (dieselbe Quelle, die auch die Ranks-/Prize-Seiten als "Dein Team" nutzen).
  const ownTeamId = useMemo(
    () => gameState.teams.find((team) => team.humanControlled)?.teamId ?? null,
    [gameState.teams],
  );
  const ownRow = useMemo(
    () => (ownTeamId != null ? rows.find((row) => row.teamId === ownTeamId) ?? null : null),
    [ownTeamId, rows],
  );

  // Hero-/KPI-Zähler (#Wave2): nur die Headline-Zahlen zählen hoch — das
  // Projektions-Board (viele Zeilen) bleibt unverändert. Respektiert
  // prefers-reduced-motion via `useCountUp`.
  const animatedReadyTeams = useCountUp(summary?.readyTeams ?? null);
  const animatedBlockedRulesCount = useCountUp(blockedRules.length);
  const animatedOwnCurrentRank = useCountUp(ownRow?.currentRank ?? null);
  const animatedOwnProjectedRank = useCountUp(ownRow?.projectedRank ?? null);
  const animatedOwnPointsDelta = useCountUp(ownRow?.pointsDelta ?? null);
  const animatedOwnMatchdayRank = useCountUp(ownRow?.matchdayRank ?? null);

  // Hero-Kennzahlen: projizierter (oder ersatzweise aktueller) Rang deines
  // Teams + Rang-Delta — Grundlage für die Karten-Headline und den
  // Medaillen-/Delta-Chip im Kopf der Forecast-Karte (#Season-Preview-Deepen).
  const ownDisplayRank = ownRow?.projectedRank ?? ownRow?.currentRank ?? null;
  const ownRankDelta =
    ownRow?.currentRank != null && ownRow?.projectedRank != null
      ? ownRow.currentRank - ownRow.projectedRank
      : null;
  const ownMedalKind = getMedalKindForRank(ownDisplayRank);
  const animatedOwnDisplayRank = useCountUp(ownDisplayRank);

  // Stärkeprofil-Radar: dein Team gegen den Liga-Schnitt über D1/D2/Tagesscore
  // (dieselbe Einheit, siehe `SPREVIEW_RADAR_AXES`). Nur wenn dein Team und
  // mindestens ein weiteres Team gespeicherte Tagesscores tragen.
  const radarSeries = useMemo<NlRadarSeries[] | null>(() => {
    if (ownRow?.d1Score == null || ownRow?.d2Score == null || ownRow?.matchdayScore == null) {
      return null;
    }
    const valid = rows.filter((row) => row.d1Score != null && row.d2Score != null && row.matchdayScore != null);
    if (valid.length === 0) {
      return null;
    }
    const average = {
      d1: valid.reduce((sum, row) => sum + (row.d1Score as number), 0) / valid.length,
      d2: valid.reduce((sum, row) => sum + (row.d2Score as number), 0) / valid.length,
      matchday: valid.reduce((sum, row) => sum + (row.matchdayScore as number), 0) / valid.length,
    };
    return [
      {
        id: "own",
        label: ownRow.teamName,
        tone: "accent",
        values: { d1: ownRow.d1Score, d2: ownRow.d2Score, matchday: ownRow.matchdayScore },
      },
      {
        id: "avg",
        label: "Liga-Schnitt",
        tone: "neutral",
        dashed: true,
        values: average,
      },
    ];
  }, [ownRow, rows]);
  const radarMax = Math.max(maxD1, maxD2, maxMatchday, 1);

  // Punkte-Delta je Team aus diesem Spieltag — existiert nur, wenn die Engine
  // wirklich projizierte Punkte liefert (`hasProjectedPoints`); sonst leer.
  const pointsDeltaBars = useMemo(() => {
    if (!hasProjectedPoints) {
      return [];
    }
    return rows
      .filter((row) => row.pointsDelta != null)
      .map((row) => {
        const team = teamById.get(row.teamId);
        const delta = row.pointsDelta as number;
        return {
          label: team?.shortCode ?? row.teamName.slice(0, 3).toUpperCase(),
          value: delta,
          tone: row.teamId === ownTeamId ? ("accent" as const) : delta >= 0 ? ("good" as const) : ("risk" as const),
        };
      })
      .sort((left, right) => right.value - left.value);
  }, [hasProjectedPoints, rows, teamById, ownTeamId]);

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

  function renderRow(row: FoundationStandingsPreviewItem, revealIndex: number) {
    const team = teamById.get(row.teamId) ?? null;
    const logo = team ? getTeamLogoModel(team, { variant: "thumb" }) : null;
    const readiness = getReadinessBadge(row.readinessStatus);
    const resultStatus = RESULT_STATUS_LABELS[row.resultStatus] ?? {
      label: row.resultStatus,
      tone: "neutral" as NlTone,
    };
    const displayRank = row.projectedRank ?? row.currentRank;
    const rowMedalKind = getMedalKindForRank(displayRank ?? null);
    const revealStyle = {
      ...(team ? getSeasonV2TeamTagStyle(team.shortCode) : undefined),
      "--nl-reveal-i": Math.min(revealIndex, 14),
    } as CSSProperties;

    return (
      <li key={row.teamId} className="nl-spreview-row nl-reveal" style={revealStyle}>
        <span className="nl-spreview-rank nl-tnum" title={hasProjection ? "Projizierter Rang" : "Aktueller Rang"}>
          {rowMedalKind ? (
            <NlMedalBadge kind={rowMedalKind} count={displayRank ?? undefined} title={`Rang ${displayRank}`} />
          ) : (
            displayRank ?? "—"
          )}
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
                value={`${formatNlNumber(animatedReadyTeams ?? summary.readyTeams, 0)}/${summary.totalTeams}`}
                tone={summary.readyTeams >= summary.totalTeams && summary.totalTeams > 0 ? "good" : "warn"}
                title="Teams mit vollständiger Wertung"
              />
              <StatChip
                label="Blocker"
                value={formatNlNumber(animatedBlockedRulesCount ?? blockedRules.length, 0)}
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

      {hasProjectedPoints && ownRow ? (
        <NlCard
          className="nl-spreview-own-card nl-spreview-hero-card"
          eyebrow={`Dein Team · ${ownRow.teamName}`}
          title={ownDisplayRank != null ? `Platz ${formatNlNumber(animatedOwnDisplayRank ?? ownDisplayRank, 0)}` : "Rang- und Punkte-Forecast"}
          actions={
            ownMedalKind || (ownRankDelta != null && ownRankDelta !== 0) ? (
              <>
                {ownMedalKind ? (
                  <NlMedalBadge kind={ownMedalKind} title={`Projizierter Rang ${ownDisplayRank}`} />
                ) : null}
                {ownRankDelta != null && ownRankDelta !== 0 ? (
                  <NlDeltaChip
                    value={ownRankDelta}
                    format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 0)} Plätze`}
                    title={
                      ownRankDelta > 0 ? `Klettert ${ownRankDelta} Plätze` : `Fällt ${Math.abs(ownRankDelta)} Plätze`
                    }
                  />
                ) : null}
              </>
            ) : null
          }
        >
          <StatChipRow aria-label="Forecast-Eckwerte deines Teams">
            <StatChip
              label="Rang vorher"
              value={ownRow.currentRank != null ? formatNlNumber(animatedOwnCurrentRank ?? ownRow.currentRank, 0) : "—"}
              tone="neutral"
            />
            <StatChip
              label="Rang projiziert"
              value={
                ownRow.projectedRank != null ? formatNlNumber(animatedOwnProjectedRank ?? ownRow.projectedRank, 0) : "—"
              }
              tone="accent"
              sub={
                ownRankDelta != null && ownRankDelta !== 0
                  ? ownRankDelta > 0
                    ? `klettert ${ownRankDelta}`
                    : `fällt ${Math.abs(ownRankDelta)}`
                  : undefined
              }
            />
            <StatChip
              label="Punkte-Delta"
              value={
                ownRow.pointsDelta != null
                  ? `${ownRow.pointsDelta > 0 ? "+" : ""}${formatNlNumber(animatedOwnPointsDelta ?? ownRow.pointsDelta, 1)}`
                  : "—"
              }
              tone={ownRow.pointsDelta == null ? "neutral" : ownRow.pointsDelta >= 0 ? "good" : "risk"}
              title="Punkte-Delta aus diesem Spieltag"
            />
            <StatChip
              label="Tagesrang"
              value={
                ownRow.matchdayRank != null ? `#${formatNlNumber(animatedOwnMatchdayRank ?? ownRow.matchdayRank, 0)}` : "—"
              }
              tone="neutral"
            />
          </StatChipRow>
          {pointsDeltaBars.length > 0 ? (
            <div className="nl-spreview-delta-chart-scroll">
              <NlBarChart
                bars={pointsDeltaBars}
                format={(value) => `${value > 0 ? "+" : ""}${formatNlNumber(value, 1)}`}
                aria-label="Punkte-Delta je Team aus diesem Spieltag (Dein Team hervorgehoben)"
                className="nl-spreview-delta-chart"
              />
            </div>
          ) : null}
        </NlCard>
      ) : null}

      {radarSeries ? (
        <NlCard
          className="nl-spreview-radar-card"
          eyebrow="Stärkeprofil"
          title="Dein Team im Liga-Vergleich"
        >
          <p className="nl-spreview-intro">
            D1, D2 und Tagesscore dieses Spieltags gegen den Schnitt aller Teams mit gespeichertem Ergebnis.
          </p>
          <div className="nl-spreview-delta-chart-scroll">
            <NlRadar
              axisDefs={SPREVIEW_RADAR_AXES}
              series={radarSeries}
              max={radarMax}
              aria-label={`Stärkeprofil ${ownRow?.teamName ?? "Dein Team"} gegen Liga-Schnitt über D1, D2 und Tagesscore`}
            />
          </div>
        </NlCard>
      ) : null}

      {rows.length === 0 ? (
        <NlCard className="nl-spreview-empty-card">
          <p className="nl-spreview-empty-text">
            Für diesen Spieltag liegt noch kein gespeichertes Ergebnis vor — sobald die Arena durchgelaufen ist,
            erscheint hier die Projektion.
          </p>
        </NlCard>
      ) : (
        <ol className="nl-spreview-board" aria-label="Projektions-Board">
          {rows.map((row, index) => renderRow(row, index))}
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
