"use client";

import type { TrainingModeOption } from "@/app/foundation/training-facilities-v2/training-view-types";

type TrainingModeComparePanelProps = {
  options: TrainingModeOption[];
  activeMode?: string | null;
};

const MODE_RISK_LABEL: Record<string, string> = {
  light: "Sicher · wenig Belastung",
  normal: "Balanced · Standard",
  hard: "Aggressiv · höheres Rückschritt-Risiko",
};

export default function TrainingModeComparePanel({ options, activeMode }: TrainingModeComparePanelProps) {
  if (options.length === 0) {
    return null;
  }

  return (
    <section className="modern-game-training-compare" aria-label="Trainingsmodus Vergleich" data-testid="training-mode-compare">
      <div className="modern-game-training-compare-head">
        <span>Trainingsintensität</span>
        <small>Wähle pro Spieler — hier der Modus-Vergleich</small>
      </div>
      <div className="modern-game-training-compare-grid">
        {options.map((option) => {
          const isActive = activeMode === option.value;
          return (
            <article
              key={option.value}
              className={`modern-game-training-compare-card${isActive ? " is-active" : ""}`}
            >
              <span className="modern-game-training-compare-label">{option.label}</span>
              <strong>+{option.trainingSetpoints}</strong>
              <small>{MODE_RISK_LABEL[option.value] ?? option.note}</small>
              <em className={`modern-game-training-risk is-${option.fatigueRisk}`}>Risiko {option.fatigueRisk}</em>
            </article>
          );
        })}
      </div>
    </section>
  );
}
