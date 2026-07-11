"use client";

import { useMemo, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlBarChart,
  NlCard,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  NlRankingDrawer,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  NL_AXIS_LABELS,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import { getSeasonV2TeamTagStyle } from "@/app/foundation/season-v2/SeasonStandingsV2Client";
import type { FoundationRanksPanelProps } from "@/app/foundation/ranks-v2/FoundationRanksPanel";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";

/**
 * "Neuer Look" Ranks — PPs pro Bereich als Leaderboard (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationRanksPanel` fällt ohne Flag unverändert auf die bestehende
 * Tabelle zurück. Konsumiert exakt dieselben Props/Daten wie die alte Tabelle.
 *
 * Liga-Überblick im Kopf (Ø/Spannweite/eigenes Team/Abstand zu #1) ist rein
 * aus den vorhandenen `sortedPpAreaRows` berechnet; "eigenes Team" nutzt den
 * `team.humanControlled`-Marker, der auch im Foundation-Shell die
 * Team-Auflösung als Fallback bestimmt.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten in den Props gibt:
 * - keine Rang-Bewegung (die `sortedPpAreaRows` tragen keinen Vor-Rang /
 *   kein `rankDiff` — Bewegung existiert nur in der Disziplin-Rang-Tabelle
 *   des Shell-Routers, nicht in diesem Panel),
 * - kein Verlauf pro Spieltag (existiert nicht in den Props).
 */

type NlRanksMetric = "total" | "pow" | "spe" | "men" | "soc";

const NL_RANKS_METRICS: Array<{ id: NlRanksMetric; label: string; tone: NlTone }> = [
  { id: "total", label: "Gesamt", tone: "accent" },
  { id: "pow", label: NL_AXIS_LABELS.pow, tone: "pow" },
  { id: "spe", label: NL_AXIS_LABELS.spe, tone: "spe" },
  { id: "men", label: NL_AXIS_LABELS.men, tone: "men" },
  { id: "soc", label: NL_AXIS_LABELS.soc, tone: "soc" },
];

type NlRanksRow = FoundationRanksPanelProps["sortedPpAreaRows"][number];

function getMetricValue(row: NlRanksRow, metric: NlRanksMetric): number {
  return row.pps[metric];
}

function getMetricFormBonus(row: NlRanksRow, metric: NlRanksMetric): number {
  return row.formBonus[metric];
}

export default function FoundationRanksNewLook({
  sortedPpAreaRows,
  openTeamProfileById,
}: FoundationRanksPanelProps) {
  const [metric, setMetric] = useState<NlRanksMetric>("total");
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  // "Neuer Look" (#37, flag-gated, additiv): KPI-Ranking-Drawer statt voller
  // Team-Profil-Navigation beim Klick auf die "Liga Ø"/"Dein Team"-Chips —
  // Zeilen kommen aus `rankedRows` (bereits für die aktive Metrik sortiert).
  const [rankingDrawerOpen, setRankingDrawerOpen] = useState(false);
  const [rankingDrawerHighlightId, setRankingDrawerHighlightId] = useState<string | null>(null);

  const activeMetric = NL_RANKS_METRICS.find((entry) => entry.id === metric) ?? NL_RANKS_METRICS[0];

  const areaRadarMax = useMemo(() => {
    let max = 1;
    for (const row of sortedPpAreaRows) {
      for (const areaId of ["pow", "spe", "men", "soc"] as const) {
        const value = row.pps[areaId];
        if (Number.isFinite(value) && value > max) {
          max = value;
        }
      }
    }
    return max;
  }, [sortedPpAreaRows]);

  const rankedRows = useMemo(() => {
    const rows = [...sortedPpAreaRows].sort((left, right) => {
      const delta = getMetricValue(right, metric) - getMetricValue(left, metric);
      if (delta !== 0) {
        return delta;
      }
      return left.team.name.localeCompare(right.team.name, "de-DE");
    });
    return rows.map((row, index) => ({ row, displayRank: index + 1 }));
  }, [metric, sortedPpAreaRows]);

  const topValue = useMemo(
    () =>
      rankedRows.reduce((max, entry) => {
        const value = getMetricValue(entry.row, metric);
        return Number.isFinite(value) && value > max ? value : max;
      }, 0),
    [metric, rankedRows],
  );

  // Liga-Ø und Spannweite für die aktive Metrik — direkt aus denselben Zeilen.
  const metricStats = useMemo(() => {
    const values = sortedPpAreaRows
      .map((row) => getMetricValue(row, metric))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return null;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { mean, min, max, count: values.length };
  }, [metric, sortedPpAreaRows]);

  // Eigenes Team: bester (rang-höchster) Eintrag mit `humanControlled`-Marker.
  const ownEntry = useMemo(
    () => rankedRows.find((entry) => entry.row.team.humanControlled) ?? null,
    [rankedRows],
  );
  const ownValue = ownEntry ? getMetricValue(ownEntry.row, metric) : null;
  const gapToTop = ownValue != null ? topValue - ownValue : null;

  // Ein Balken je Team für die aktive Metrik, bereits nach `rankedRows`
  // (rang-)sortiert; eigenes Team über `humanControlled` hervorgehoben.
  // Kein Verlauf/History hier — die Props liefern keine Vor-Werte.
  const metricBars = useMemo(
    () =>
      rankedRows.map(({ row }) => ({
        label: row.team.shortCode,
        value: getMetricValue(row, metric),
        tone: row.team.humanControlled ? ("accent" as const) : ("neutral" as const),
      })),
    [rankedRows, metric],
  );

  const rankingDrawerRows = useMemo<NlRankingDrawerRow[]>(
    () =>
      rankedRows.map(({ row, displayRank }) => ({
        id: row.team.teamId,
        rank: displayRank,
        name: row.team.name,
        sub: row.team.shortCode,
        value: getMetricValue(row, metric),
        tone: activeMetric.tone,
        isOwn: row.team.humanControlled,
      })),
    [rankedRows, metric, activeMetric.tone],
  );

  function openRankingDrawer(highlightTeamId?: string | null) {
    setRankingDrawerOpen(true);
    setRankingDrawerHighlightId(highlightTeamId ?? null);
  }

  function closeRankingDrawer() {
    setRankingDrawerOpen(false);
    setRankingDrawerHighlightId(null);
  }

  return (
    <section className="nl-ranks" data-testid="foundation-ranks" id="foundation-ranks" data-new-look="true">
      <NlCard
        className="nl-ranks-card"
        eyebrow="Saison-Ranking"
        title="PPs pro Bereich"
        actions={
          <div className="nl-ranks-filterbar" role="group" aria-label="Bereich wählen">
            {NL_RANKS_METRICS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`nl-ranks-filter ${nlToneClass(entry.tone)}${metric === entry.id ? " is-active" : ""}`}
                onClick={() => setMetric(entry.id)}
                aria-pressed={metric === entry.id}
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
      >
        {metricStats ? (
          <StatChipRow className="nl-ranks-statrow" aria-label={`Liga-Überblick ${activeMetric.label}`}>
            <StatChip
              label={`Liga Ø · ${activeMetric.label}`}
              value={formatNlNumber(metricStats.mean, 1)}
              tone={activeMetric.tone}
              onClick={() => openRankingDrawer()}
              title={`Rangliste ${activeMetric.label} — Durchschnitt über ${formatNlNumber(metricStats.count, 0)} Teams`}
            />
            <StatChip
              label="Spannweite"
              value={formatNlNumber(metricStats.max - metricStats.min, 1)}
              sub={`${formatNlNumber(metricStats.min, 1)} – ${formatNlNumber(metricStats.max, 1)}`}
              title={`Abstand zwischen stärkstem und schwächstem Team (${activeMetric.label})`}
            />
            {ownEntry && ownValue != null ? (
              <StatChip
                label={`Dein Team · ${ownEntry.row.team.shortCode}`}
                value={formatNlNumber(ownValue, 1)}
                sub={`Rang ${formatNlNumber(ownEntry.displayRank, 0)} von ${formatNlNumber(rankedRows.length, 0)}`}
                tone="accent"
                onClick={() => openRankingDrawer(ownEntry.row.team.teamId)}
                title={`Rangliste ${activeMetric.label} — ${ownEntry.row.team.name}`}
              />
            ) : null}
            {ownEntry && gapToTop != null ? (
              ownEntry.displayRank === 1 ? (
                <StatChip
                  label="Abstand zu #1"
                  value="Spitze"
                  sub="Dein Team führt"
                  tone="good"
                  title={`Dein Team ist Rang 1 in ${activeMetric.label}`}
                />
              ) : (
                <StatChip
                  label="Abstand zu #1"
                  value={gapToTop === 0 ? "gleichauf" : `−${formatNlNumber(gapToTop, 1)}`}
                  sub={`auf ${rankedRows[0]?.row.team.shortCode ?? "#1"}`}
                  tone="warn"
                  title={`Rückstand deines Teams auf Rang 1 (${activeMetric.label})`}
                />
              )
            ) : null}
          </StatChipRow>
        ) : null}
        {metricBars.length > 0 ? (
          <div className="nl-ranks-metric-chart-scroll">
            <NlBarChart
              bars={metricBars}
              format={(value) => formatNlNumber(value, 1)}
              aria-label={`PPs ${activeMetric.label} je Team, sortiert (Dein Team hervorgehoben)`}
              className="nl-ranks-metric-chart"
            />
          </div>
        ) : null}
        <p className="nl-ranks-hint">
          Summe aus POW, SPE, MEN und SOC je Team. Formkartenbonus (z.&nbsp;B. +8) ist bereits in den Punkten enthalten.
          Klick auf ein Team öffnet das Teamprofil.
        </p>
        <ol className={`nl-ranks-board ${nlToneClass(activeMetric.tone)}`} aria-label={`Ranking ${activeMetric.label}`}>
          {rankedRows.map(({ row, displayRank }) => {
            const logo = getTeamLogoModel(row.team);
            const value = getMetricValue(row, metric);
            const formBonus = getMetricFormBonus(row, metric);
            const medalKind =
              displayRank === 1 ? "gold" : displayRank === 2 ? "silver" : displayRank === 3 ? "bronze" : null;

            const isExpanded = expandedTeamId === row.team.teamId;
            const isOwnTeam = row.team.humanControlled;
            const radarAxes = (["pow", "spe", "men", "soc"] as const).map((areaId) => ({
              key: areaId,
              value: row.pps[areaId],
            }));

            return (
              <li key={row.team.teamId}>
                <div
                  className={`nl-ranks-row${medalKind ? " is-podium" : ""}${isExpanded ? " is-expanded" : ""}${isOwnTeam ? " is-own-team" : ""}`}
                  style={getSeasonV2TeamTagStyle(row.team.shortCode)}
                >
                  <span className="nl-ranks-rank">
                    {medalKind ? (
                      <NlMedalBadge kind={medalKind} title={`Rang ${displayRank}`} />
                    ) : (
                      <span className="nl-ranks-ranknum nl-tnum">{displayRank}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="nl-ranks-team"
                    onClick={() => openTeamProfileById(row.team.teamId)}
                    title={`${row.team.name} öffnen`}
                  >
                    <BudgetedMediaImage
                      src={logo.src}
                      alt={`${row.team.name} Logo`}
                      className="nl-ranks-crest"
                      width={30}
                      height={30}
                      loading="lazy"
                      fallback={<span className="nl-ranks-crest nl-ranks-crest-fallback">{logo.initials}</span>}
                    />
                    <span className="nl-ranks-team-copy">
                      <span className="nl-ranks-teamname">{row.team.name}</span>
                      <span className="nl-ranks-teamcode">
                        {row.team.shortCode}
                        {isOwnTeam ? <span className="nl-ranks-own-tag">Dein Team</span> : null}
                      </span>
                    </span>
                  </button>
                  <span className="nl-ranks-value">
                    <span className="nl-ranks-value-number nl-tnum">
                      {formatNlNumber(value, 1)}
                      {formBonus !== 0 ? (
                        <small
                          className="nl-ranks-formbonus"
                          title={`Formkartenbonus ${activeMetric.label}: ${formBonus > 0 ? "+" : ""}${formatNlNumber(formBonus, 1)}`}
                        >
                          ({formBonus > 0 ? "+" : ""}
                          {formatNlNumber(formBonus, 1)})
                        </small>
                      ) : null}
                    </span>
                    <NlProgressBar
                      value={value}
                      max={topValue > 0 ? topValue : 1}
                      tone={activeMetric.tone}
                      showValue={false}
                      className="nl-ranks-value-bar"
                      title={`${activeMetric.label}: ${formatNlNumber(value, 1)} von ${formatNlNumber(topValue, 1)} (Spitze)`}
                    />
                  </span>
                  <span className="nl-ranks-areas" aria-label={`Bereichspunkte ${row.team.name}`}>
                    {(["pow", "spe", "men", "soc"] as const).map((areaId) => (
                      <StatChip
                        key={areaId}
                        label={NL_AXIS_LABELS[areaId]}
                        value={formatNlNumber(row.pps[areaId], 0)}
                        tone={areaId}
                        onClick={() => setMetric(areaId)}
                        className={`nl-ranks-area-chip${metric === areaId ? " is-active" : ""}`}
                        title={`Nach ${NL_AXIS_LABELS[areaId]} sortieren · ${formatNlNumber(row.pps[areaId], 1)} PPs`}
                      />
                    ))}
                  </span>
                  <button
                    type="button"
                    className="nl-ranks-expand-toggle"
                    aria-expanded={isExpanded}
                    aria-controls={`nl-ranks-details-${row.team.teamId}`}
                    onClick={() =>
                      setExpandedTeamId((current) => (current === row.team.teamId ? null : row.team.teamId))
                    }
                    title={isExpanded ? "Stärkeprofil schließen" : "Stärkeprofil zeigen"}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                </div>
                {isExpanded ? (
                  <div className="nl-ranks-expand" id={`nl-ranks-details-${row.team.teamId}`}>
                    <span className="nl-ranks-expand-label">Stärkeprofil (POW · SPE · MEN · SOC)</span>
                    <NlRadar
                      axes={radarAxes}
                      max={areaRadarMax}
                      showValues
                      aria-label={`Stärkeprofil ${row.team.name}: ${radarAxes
                        .map((axis) => `${NL_AXIS_LABELS[axis.key]} ${formatNlNumber(axis.value, 0)}`)
                        .join(", ")}`}
                      className="nl-ranks-radar"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {rankedRows.length === 0 ? <p className="nl-ranks-empty">Noch keine PP-Daten für diese Saison.</p> : null}
      </NlCard>

      <NlRankingDrawer
        open={rankingDrawerOpen}
        onClose={closeRankingDrawer}
        metricLabel={activeMetric.label}
        metricKey={metric}
        subtitle="PPs pro Bereich"
        rows={rankingDrawerRows}
        highlightId={rankingDrawerHighlightId}
        onSelectRow={(row) => openTeamProfileById(row.id)}
      />
    </section>
  );
}
