"use client";

import { useMemo, useState } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlCard,
  NlMedalBadge,
  NlProgressBar,
  NlRadar,
  StatChip,
  formatNlNumber,
  nlToneClass,
  NL_AXIS_LABELS,
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
            const radarAxes = (["pow", "spe", "men", "soc"] as const).map((areaId) => ({
              key: areaId,
              value: row.pps[areaId],
            }));

            return (
              <li key={row.team.teamId}>
                <div
                  className={`nl-ranks-row${medalKind ? " is-podium" : ""}${isExpanded ? " is-expanded" : ""}`}
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
                      <span className="nl-ranks-teamcode">{row.team.shortCode}</span>
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
    </section>
  );
}
