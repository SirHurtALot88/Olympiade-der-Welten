"use client";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import RaceIcon from "@/app/foundation/RaceIcon";
import FoundationSubNav from "@/app/foundation/shell/FoundationSubNav";
import { VeloImpactStrip, VeloScoutMetric, VeloStatOrbitRow } from "@/components/foundation/velo-ui";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { buildProjectedClassPreview } from "@/lib/foundation/projected-class-preview";
import {
  PLAYER_PROFILE_TABS,
  type PlayerProfileTabId,
} from "@/lib/foundation/player-profile-service";
import {
  formatDevelopmentRouteLabel,
  getDevelopmentRouteBonusMultiplier,
} from "@/lib/training/development-route-bonus";

type PlayerProfileClientProps = {
  data: PlayerDetailDrawerData;
  activeTab: PlayerProfileTabId;
  onTabChange: (tab: PlayerProfileTabId) => void;
  onClose?: () => void;
  onOpenQuickPeek?: () => void;
  onOpenTraining?: () => void;
  onOpenContractOffer?: () => void;
};

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function PlayerProfileClient({
  data,
  activeTab,
  onTabChange,
  onClose,
  onOpenQuickPeek,
  onOpenTraining,
  onOpenContractOffer,
}: PlayerProfileClientProps) {
  const attributeMap = Object.fromEntries(
    data.attributeStats.filter((entry) => entry.value != null).map((entry) => [entry.key, entry.value as number]),
  ) as Record<string, number>;

  const projectedClasses = buildProjectedClassPreview(
    {
      power: attributeMap.power ?? data.pow ?? 0,
      health: attributeMap.health ?? 0,
      stamina: attributeMap.stamina ?? 0,
      intelligence: attributeMap.intelligence ?? 0,
      awareness: attributeMap.awareness ?? 0,
      determination: attributeMap.determination ?? 0,
      speed: attributeMap.speed ?? data.spe ?? 0,
      dexterity: attributeMap.dexterity ?? 0,
      charisma: attributeMap.charisma ?? data.soc ?? 0,
      will: attributeMap.will ?? 0,
      spirit: attributeMap.spirit ?? 0,
      torment: attributeMap.torment ?? 0,
    },
    data.className,
  );

  const route = data.developmentInsight?.developmentRoute ?? "BALANCED";
  const routeBonus = getDevelopmentRouteBonusMultiplier(route, "pow");

  return (
    <div className="player-profile-shell" data-testid="foundation-player-profile">
      <header className="player-profile-header">
        <div className="player-profile-identity">
          {data.portraitUrl ? (
            <OptimizedMediaImage className="player-profile-portrait" src={data.portraitUrl} alt={data.name} width={96} height={96} />
          ) : (
            <span className="player-profile-portrait is-placeholder">—</span>
          )}
          <div>
            <span className="eyebrow">{data.teamName ?? "Freier Markt"} · {data.sourceLabel}</span>
            <h2>{data.name}</h2>
            <div className="player-profile-meta">
              {data.className ? <ClassColorChip className={data.className} /> : null}
              {data.race ? <RaceIcon race={data.race} showLabel /> : null}
              <span className="pill">Scout L{data.effectiveScoutingLevel ?? data.scoutingLevel ?? 0}</span>
            </div>
          </div>
        </div>
        <div className="player-profile-header-actions">
          {onOpenQuickPeek ? (
            <button type="button" className="secondary-button inline-button" onClick={onOpenQuickPeek}>
              Quick-Peek
            </button>
          ) : null}
          {onOpenTraining ? (
            <button type="button" className="secondary-button inline-button" onClick={onOpenTraining}>
              Training
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="secondary-button inline-button" onClick={onClose}>
              Schließen
            </button>
          ) : null}
        </div>
      </header>

      <FoundationSubNav
        items={PLAYER_PROFILE_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeId={activeTab}
        onSelect={(id) => onTabChange(id as PlayerProfileTabId)}
        className="player-profile-subnav"
      />

      {activeTab === "overview" ? (
        <section className="player-profile-panel">
          <VeloStatOrbitRow
            ariaLabel={`${data.name} Achsen`}
            stats={{ pow: data.pow ?? 0, spe: data.spe ?? 0, men: data.men ?? 0, soc: data.soc ?? 0 }}
          />
          <VeloImpactStrip
            items={[
              { key: "ovr", label: "OVR", value: formatNumber(data.ovr), tone: "neutral" },
              { key: "pps", label: "PPS", value: formatNumber(data.pps), tone: "positive" },
              { key: "mvs", label: "MVS", value: formatNumber(data.mvs), tone: "neutral" },
              {
                key: "potential",
                label: "Potential",
                value: data.scoutPotential?.potentialRange
                  ? `${data.scoutPotential.potentialRange.min}-${data.scoutPotential.potentialRange.max}`
                  : data.potentialStarsDisplay ?? "—",
                tone: "warning",
              },
            ]}
          />
          <div className="player-profile-top-disciplines">
            {(data.seasonPerformance?.topDisciplineRows ?? []).slice(0, 3).map((row) => (
              <article key={row.disciplineId} className="player-profile-discipline-card">
                <DisciplineIcon disciplineId={row.disciplineId} label={row.disciplineName} showLabel />
                <VeloScoutMetric
                  rangeLabel={formatNumber(row.averageFinalScore)}
                  tier={row.averageFinalScore != null && row.averageFinalScore >= 76 ? "A" : "B"}
                  exactValue={row.averageFinalScore}
                  scoutingLevel={data.effectiveScoutingLevel ?? data.scoutingLevel}
                  confidence={data.scoutPotential?.confidence ?? null}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "details" ? (
        <section className="player-profile-panel">
          <div className="player-profile-attribute-grid">
            {data.attributeStats.map((entry) => (
              <article key={entry.key} className="player-profile-attribute-card">
                <span>{entry.label}</span>
                <VeloScoutMetric
                  rangeLabel={entry.rangeLabel ?? (entry.value != null ? String(entry.value) : "?")}
                  tier={entry.ratingLabel}
                  exactValue={entry.value}
                  scoutingLevel={entry.revealLevel}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "contract" ? (
        <section className="player-profile-panel">
          <VeloImpactStrip
            items={[
              { key: "salary", label: "Gehalt", value: formatNumber(data.salary, 2), tone: "neutral" },
              { key: "length", label: "Laufzeit", value: data.contractLength != null ? `${data.contractLength} S` : "—", tone: "neutral" },
              { key: "mw", label: "Marktwert", value: formatNumber(data.marketValue, 2), tone: "positive" },
            ]}
          />
          {onOpenContractOffer ? (
            <button type="button" className="primary-button" onClick={onOpenContractOffer}>
              Vertragsangebot
            </button>
          ) : null}
        </section>
      ) : null}

      {activeTab === "training" ? (
        <section className="player-profile-panel">
          {data.developmentInsight ? (
            <>
              <p>
                Entwicklungsrichtung: <strong>{formatDevelopmentRouteLabel(data.developmentInsight.developmentRoute)}</strong>
                {routeBonus > 1 ? ` · Route-Bonus +${Math.round((routeBonus - 1) * 100)}%` : ""}
              </p>
              <VeloImpactStrip
                items={[
                  {
                    key: "speed",
                    label: "Training Speed",
                    value: `${Math.round((data.scoutPotential?.trainingSpeedMultiplier ?? 1) * 100)}%`,
                    tone: "positive",
                  },
                  {
                    key: "outlook",
                    label: "Outlook",
                    value: data.developmentInsight.growthOutlook,
                    tone: "neutral",
                  },
                  {
                    key: "form",
                    label: "Form",
                    value: data.developmentInsight.trainingForm,
                    tone: "warning",
                  },
                ]}
              />
              <p className="muted">{data.developmentInsight.recommendation}</p>
            </>
          ) : (
            <p className="muted">Keine Entwicklungsdaten verfügbar.</p>
          )}
        </section>
      ) : null}

      {activeTab === "report" ? (
        <section className="player-profile-panel">
          <div className="player-profile-report-classes" data-testid="player-profile-top-classes">
            {projectedClasses.projectedTop3.map((entry, index) => (
              <article key={entry.className} className="player-profile-class-card">
                <span>#{index + 1}</span>
                <ClassIcon className={entry.className} />
                <strong>{entry.className}</strong>
                <small>{formatNumber(entry.score, 1)}</small>
              </article>
            ))}
          </div>
          {projectedClasses.reclassRecommended ? (
            <p className="player-profile-reclass-hint">
              Umschulung empfohlen: aktuell {projectedClasses.currentClassName} → projiziert {projectedClasses.projectedPrimaryClass} (Season-End)
            </p>
          ) : (
            <p className="muted">Aktuelle Klasse passt zur Projektion.</p>
          )}
          {data.scoutPotential ? (
            <VeloScoutMetric
              rangeLabel={
                data.scoutPotential.potentialRange
                  ? `${data.scoutPotential.potentialRange.min}-${data.scoutPotential.potentialRange.max}`
                  : "?"
              }
              tier={data.scoutPotential.starRating}
              scoutingLevel={data.scoutPotential.scoutingLevel}
              confidence={data.scoutPotential.confidence}
            />
          ) : null}
        </section>
      ) : null}

      {activeTab === "career" ? (
        <section className="player-profile-panel">
          <div className="player-profile-history">
            {data.historyRows.map((row) => (
              <article key={`${row.seasonId}-${row.teamName}`} className="player-profile-history-row">
                <strong>{row.seasonName}</strong>
                <span>{row.teamName ?? "—"}</span>
                <span>{row.appearances ?? 0} Eins.</span>
                <span>{formatNumber(row.totalContribution, 1)} PPs</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
