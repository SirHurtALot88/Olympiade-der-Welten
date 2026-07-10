"use client";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { formatScoutedImpactDelta } from "@/lib/market/transfermarkt-scouting";
import type { ScoutingReportData } from "@/lib/scouting/scouting-report-service";
import { VeloPotentialStars, VeloScoutMetric, VeloStarRating, VeloStatOrbitRow } from "@/components/foundation/velo-ui";

type ScoutingReportPanelProps = {
  report: ScoutingReportData | null;
  onOpenPlayer: (playerId: string) => void;
  onPromoteToFocus?: (playerId: string) => void;
  onRemove?: (playerId: string) => void;
  canPromoteToFocus?: boolean;
};

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatCompactNumber(value: number, digits = 1) {
  return value.toFixed(digits);
}

function getDeltaTone(delta: number | null) {
  if (delta == null) return "";
  if (delta >= 1) return "is-positive";
  if (delta <= -1) return "is-negative";
  return "is-neutral";
}

const AXIS_LABELS: Record<string, string> = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" };
const AXIS_KEYS = ["pow", "spe", "men", "soc"] as const;

export default function ScoutingReportPanel({
  report,
  onOpenPlayer,
  onPromoteToFocus,
  onRemove,
  canPromoteToFocus = false,
}: ScoutingReportPanelProps) {
  if (!report) {
    return (
      <div className="scouting-report-empty" data-testid="scouting-report-empty">
        <p className="muted">
          Noch kein Scouting-Ziel ausgewählt — sobald ein Spieler auf der Wishlist steht, erscheint hier sein
          Scouting Report.
        </p>
      </div>
    );
  }

  const src = getPlayerPortraitBrowserUrl(report.playerId, null, null);
  const previewSrc = appendMediaImageVariant(src, "preview") ?? src;
  const formatImpactDelta = (delta: number | null) =>
    formatScoutedImpactDelta(delta, report.certainty, formatCompactNumber);

  return (
    <div className="scouting-report-panel" data-testid="scouting-report-panel">
      <header className="scouting-report-header">
        <button type="button" className="scouting-report-portrait" onClick={() => onOpenPlayer(report.playerId)}>
          {previewSrc ? (
            <BudgetedMediaImage
              className=""
              src={src}
              placeholderSrc={previewSrc}
              alt=""
              width={72}
              height={72}
              loading="eager"
              fetchPriority="high"
              eager
            />
          ) : (
            <span className="scouting-report-portrait-fallback">{getInitials(report.playerName)}</span>
          )}
        </button>
        <div className="scouting-report-header-info">
          <span className="eyebrow">
            {report.className} · {report.race}
            {report.ageLabel ? ` · ${report.ageLabel}` : ""}
          </span>
          <h3>{report.playerName}</h3>
          {report.disciplineSpecialties.length > 0 ? (
            <p className="scouting-report-specialties muted">{report.disciplineSpecialties.join(" · ")}</p>
          ) : null}
          <div className="scouting-report-meta-row">
            <span className={`scouting-status-pill${report.isFullyScouted ? " is-ready" : " is-progress"}`}>
              {report.isFullyScouted ? "Vollständig gescoutet" : `${report.certainty}% Intel`}
            </span>
            <span className="muted">Scouting L{report.effectiveScoutingLevel}</span>
            {!report.isFullyScouted ? (
              <span className="muted">
                {report.isFocusTarget && report.etaMatchdays != null
                  ? `Fokus-Ziel · noch ${report.etaMatchdays} Spieltag${report.etaMatchdays === 1 ? "" : "e"}`
                  : report.milestone}
              </span>
            ) : null}
          </div>
        </div>
        <div className="scouting-report-actions">
          {!report.isFocusTarget && !report.isFullyScouted && canPromoteToFocus && onPromoteToFocus ? (
            <button type="button" className="secondary-button inline-button" onClick={() => onPromoteToFocus(report.playerId)}>
              Auf Platz 1 priorisieren
            </button>
          ) : null}
          <button type="button" className="ghost-button inline-button" onClick={() => onOpenPlayer(report.playerId)}>
            Spielerprofil öffnen
          </button>
          {onRemove ? (
            <button type="button" className="ghost-button inline-button is-danger" onClick={() => onRemove(report.playerId)}>
              Von Wishlist entfernen
            </button>
          ) : null}
        </div>
      </header>

      <section className="scouting-report-grid">
        <article className="scouting-report-card">
          <span className="eyebrow">Fähigkeiten</span>
          <div className="scouting-report-stars">
            <VeloStarRating value={report.caDisplay} label="CA" />
            {report.poPotentialRating != null ? (
              <VeloPotentialStars rating={report.poPotentialRating} />
            ) : (
              <span className="scouting-report-po">PO {report.poDisplay ?? "—"}</span>
            )}
            {report.potentialBand ? <span className="scouting-report-potential-band">{report.potentialBand}</span> : null}
          </div>
          {report.showAxisOrbit && report.axisOrbitStats ? (
            <VeloStatOrbitRow stats={report.axisOrbitStats} ariaLabel="POW SPE MEN SOC" showGrade />
          ) : report.showAxisStars ? (
            <div className="scouting-report-axis-stars" aria-label="POW SPE MEN SOC">
              {AXIS_KEYS.map((axis) => (
                <VeloStarRating
                  key={axis}
                  value={report.axisStars[axis]}
                  label={AXIS_LABELS[axis]}
                  compact
                />
              ))}
            </div>
          ) : (
            <p className="muted scouting-report-axis-placeholder">{report.axisDisplayLabel}</p>
          )}
        </article>

        <article className="scouting-report-card" data-testid="scouting-report-top6-impact">
          <span className="eyebrow">Top-6 Impact (dein Team)</span>
          <p className="scouting-report-impact-summary">
            Top-6 Achsen-Schnitt{" "}
            <strong>{report.axisImpactComposite.before != null ? report.axisImpactComposite.before.toFixed(1) : "—"}</strong>
            {" → "}
            <strong className={getDeltaTone(report.axisImpactComposite.delta)}>
              {report.axisImpactComposite.after != null ? report.axisImpactComposite.after.toFixed(1) : "—"} (
              {formatImpactDelta(report.axisImpactComposite.delta)})
            </strong>
          </p>
          {!report.impactIsExact ? (
            <small className="scouting-report-impact-note muted">
              Schätzwerte auf Basis des Scouting-Standes — genaue Teamwirkung erst nach mehr Intel.
            </small>
          ) : null}
          <div className="scouting-report-axis-impact-row">
            {report.axisImpact.map((row) => (
              <span key={row.axis} className={`scouting-report-axis-pill ${getDeltaTone(row.delta)}`}>
                <b>{AXIS_LABELS[row.axis]}</b>
                <small>
                  {row.before != null ? row.before.toFixed(1) : "—"} → {row.after != null ? row.after.toFixed(1) : "—"} (
                  {formatImpactDelta(row.delta)})
                </small>
              </span>
            ))}
          </div>
          {report.disciplineImpact.length > 0 ? (
            <ul className="scouting-report-discipline-impact">
              {report.disciplineImpact.map((row) => (
                <li key={row.disciplineId}>
                  <span>{row.disciplineName}</span>
                  <span className={getDeltaTone(row.delta)}>{formatImpactDelta(row.delta)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        {report.disciplineTiers.length > 0 ? (
          <article className="scouting-report-card" data-testid="scouting-report-disciplines">
            <span className="eyebrow">Disziplinen</span>
            <div className="scouting-report-discipline-grid">
              {report.disciplineTiers.map((tier) => (
                <article key={tier.disciplineId} className="scouting-report-discipline-card">
                  <DisciplineIcon disciplineId={tier.disciplineId} label={tier.disciplineName} showLabel />
                  <VeloScoutMetric
                    rangeLabel={String(tier.displayedScore)}
                    tier={tier.scoreTier}
                    exactValue={tier.displayedScore}
                    scoutingLevel={report.effectiveScoutingLevel}
                    confidence={report.certainty}
                  />
                </article>
              ))}
            </div>
          </article>
        ) : null}

        <article className="scouting-report-card">
          <span className="eyebrow">Traits</span>
          <div className="scouting-report-traits">
            {report.traits.visiblePositive.map((trait) => (
              <span key={trait} className="pill market-v2-trait-pill is-positive">
                + {trait}
              </span>
            ))}
            {report.traits.visibleNegative.map((trait) => (
              <span key={trait} className="pill market-v2-trait-pill is-negative">
                − {trait}
              </span>
            ))}
            {report.traits.hiddenPositiveCount > 0 ? (
              <span className="pill market-v2-trait-pill is-neutral">+{report.traits.hiddenPositiveCount} verdeckt</span>
            ) : null}
            {report.traits.hiddenNegativeCount > 0 ? (
              <span className="pill market-v2-trait-pill is-neutral">
                {report.traits.hiddenNegativeCount} Risiko verdeckt
              </span>
            ) : null}
            {report.traits.visiblePositive.length === 0 &&
            report.traits.visibleNegative.length === 0 &&
            report.traits.hiddenPositiveCount === 0 &&
            report.traits.hiddenNegativeCount === 0 ? (
              <span className="muted">Keine Traits</span>
            ) : null}
          </div>
        </article>

        <article className="scouting-report-card">
          <span className="eyebrow">Markt</span>
          <div className="scouting-report-market-row">
            <div>
              <span>Marktwert</span>
              <strong>{formatTransfermarktCurrency(report.marketValue)}</strong>
            </div>
            <div>
              <span>Gehaltsforderung</span>
              <strong>{formatTransfermarktCurrency(report.salary)}</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
