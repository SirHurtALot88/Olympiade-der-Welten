"use client";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import ScoutingKnowledgeLadder from "@/app/foundation/scouting-center-v2/ScoutingKnowledgeLadder";
import { appendMediaImageVariant, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { formatScoutedImpactDelta } from "@/lib/market/transfermarkt-scouting";
import type { ScoutingReportData } from "@/lib/scouting/scouting-report-service";
import { NlAbilityStars, VeloPotentialStars, VeloScoutMetric, VeloStarRating, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import { NlEmptyState, StatChip, StatChipRow } from "@/components/foundation/new-look";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";

type ScoutingReportPanelProps = {
  report: ScoutingReportData | null;
  onOpenPlayer: (playerId: string) => void;
  onPromoteToFocus?: (playerId: string) => void;
  onRemove?: (playerId: string) => void;
  canPromoteToFocus?: boolean;
  /** Neuer Look: unifiziertes CA/PO-Sterne-Rendering (NlAbilityStars) statt getrennter Velo-Sterne. */
  newLook?: boolean;
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
  return formatNlNumber(value, digits);
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
  newLook = false,
}: ScoutingReportPanelProps) {
  if (!report) {
    if (newLook) {
      return (
        <NlEmptyState
          icon="📋"
          title="Kein Scouting-Ziel gewählt"
          message="Sobald ein Spieler auf der Wishlist steht, erscheint hier sein Scouting Report."
          data-testid="scouting-report-empty"
        />
      );
    }
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
              src={src}
              placeholderSrc={previewSrc}
              alt=""
              className=""
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

      {newLook ? <ScoutingKnowledgeLadder report={report} /> : null}

      <section className="scouting-report-grid">
        <article className="scouting-report-card">
          <span className="eyebrow">Fähigkeiten</span>
          <div className="scouting-report-stars">
            {newLook ? (
              <NlAbilityStars
                caScore={report.caRating}
                caStars={report.caDisplay}
                poStarRange={
                  report.poStarMin != null && report.poStarMax != null
                    ? { min: report.poStarMin, max: report.poStarMax }
                    : null
                }
                poScoreRange={
                  report.poStarMin != null && report.poStarMax != null
                    ? { min: report.poStarMin * 20, max: report.poStarMax * 20 }
                    : null
                }
                poStars={report.poPotentialRating != null ? report.poPotentialRating / 20 : null}
                known={report.isFullyScouted}
                label="Fähigkeiten"
              />
            ) : (
              <>
                <VeloStarRating value={report.caDisplay} label="CA" />
                {report.poPotentialRating != null ? (
                  <VeloPotentialStars rating={report.poPotentialRating} />
                ) : (
                  <span className="scouting-report-po">PO {report.poDisplay ?? "—"}</span>
                )}
              </>
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
            <strong>{report.axisImpactComposite.before != null ? formatNlNumber(report.axisImpactComposite.before, 1) : "—"}</strong>
            {" → "}
            <strong className={getDeltaTone(report.axisImpactComposite.delta)}>
              {report.axisImpactComposite.after != null ? formatNlNumber(report.axisImpactComposite.after, 1) : "—"} (
              {formatImpactDelta(report.axisImpactComposite.delta)})
            </strong>
          </p>
          {!report.impactIsExact ? (
            <span
              className="scouting-report-impact-badge"
              title="Schätzwerte auf Basis des Scouting-Standes — genaue Teamwirkung erst nach mehr Intel."
            >
              ≈ geschätzt
            </span>
          ) : null}
          <div className="scouting-report-axis-impact-row">
            {report.axisImpact.map((row) => (
              <span key={row.axis} className={`scouting-report-axis-pill ${getDeltaTone(row.delta)}`}>
                <b>{AXIS_LABELS[row.axis]}</b>
                <small>
                  {row.before != null ? formatNlNumber(row.before, 1) : "—"} → {row.after != null ? formatNlNumber(row.after, 1) : "—"} (
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
          {newLook ? (
            <StatChipRow aria-label="Markt">
              <StatChip label="Marktwert" value={formatTransfermarktCurrency(report.marketValue)} tone="accent" />
              <StatChip label="Gehalt" value={formatTransfermarktCurrency(report.salary)} tone="neutral" />
            </StatChipRow>
          ) : (
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
          )}
        </article>
      </section>
    </div>
  );
}
