"use client";

import { formatVeloNumber, formatVeloSignedNumber, formatVeloSignedPercent } from "@/components/foundation/velo-ui/formatters";

export type VeloImpactItem = {
  key: string;
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative" | "neutral" | "warning";
};

type VeloImpactStripProps = {
  items: VeloImpactItem[];
  className?: string;
  flashKey?: string | null;
};

export function VeloImpactStrip({ items, className = "", flashKey = null }: VeloImpactStripProps) {
  return (
    <div className={`velo-impact-strip training-v2-impact-strip${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <div
          className={`velo-impact-card training-v2-impact-card is-${item.tone ?? "neutral"}${flashKey === item.key ? " is-flash" : ""}`}
          key={item.key}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function buildTrainingImpactItems(input: {
  trainingXp: number;
  performanceXp: number;
  recoveryBefore: number;
  recoveryAfter: number;
  recoveryDeltaPct: number;
  netDevelopmentXp: number;
  regressionPressure: number;
  regressionRisk: string | null;
}): VeloImpactItem[] {
  const performanceLabel = input.performanceXp > 0 ? `+${formatVeloNumber(input.performanceXp, 0)} Leistung` : "keine Leistungs-XP";
  return [
    {
      key: "xp",
      label: "XP Vorschau",
      value: formatVeloNumber(input.trainingXp + input.performanceXp, 0),
      detail: `+${formatVeloNumber(input.trainingXp, 0)} Training · ${performanceLabel}`,
      tone: "neutral",
    },
    {
      key: "recovery",
      label: "Regeneration",
      value: `${formatVeloNumber(input.recoveryBefore, 1)} → ${formatVeloNumber(input.recoveryAfter, 1)}`,
      detail: input.recoveryDeltaPct === 0 ? "normale Erholung" : `${formatVeloSignedPercent(input.recoveryDeltaPct)} Reg`,
      tone: input.recoveryDeltaPct >= 0 ? "positive" : "warning",
    },
    {
      key: "dev",
      label: "Entwicklung",
      value: formatVeloSignedNumber(input.netDevelopmentXp, 0),
      detail: `Rueckschritt ${formatVeloNumber(input.regressionPressure, 0)} · Risiko ${input.regressionRisk ?? "—"}`,
      tone: input.netDevelopmentXp >= 0 ? "positive" : "negative",
    },
  ];
}
