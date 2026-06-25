"use client";

import { formatTrainingAttributeWeight } from "@/components/foundation/velo-ui/formatters";

export type VeloAttributeFocusEntry = {
  attribute: string;
  weight: number;
};

type VeloAttributeFocusTagsProps = {
  primary: VeloAttributeFocusEntry[];
  risks: VeloAttributeFocusEntry[];
  className?: string;
};

export function VeloAttributeFocusTags({ primary, risks, className = "" }: VeloAttributeFocusTagsProps) {
  if (primary.length === 0 && risks.length === 0) {
    return null;
  }

  return (
    <div className={`velo-class-focus training-v2-class-focus${className ? ` ${className}` : ""}`}>
      {primary.length > 0 ? (
        <div className="velo-class-focus-row is-primary">
          <span>Trainiert</span>
          <div className="velo-class-focus-tags">
            {primary.map((entry) => (
              <span className="velo-class-focus-tag is-gain" key={`primary-${entry.attribute}`} title={`Gewicht ${formatTrainingAttributeWeight(entry.weight)}`}>
                {entry.attribute} {formatTrainingAttributeWeight(entry.weight)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {risks.length > 0 ? (
        <div className="velo-class-focus-row is-risk">
          <span>Risiko</span>
          <div className="velo-class-focus-tags">
            {risks.map((entry) => (
              <span className="velo-class-focus-tag is-loss" key={`risk-${entry.attribute}`} title={`Gewicht ${formatTrainingAttributeWeight(entry.weight)}`}>
                {entry.attribute} {formatTrainingAttributeWeight(entry.weight)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
