"use client";

import { formatNlNumber, formatNlSignedNumber, formatNlSignedPercent } from "@/components/foundation/new-look/nl-tones";

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
  trainingSetpoints: number;
  performanceSetpoints: number;
  netSetpoints: number;
  recoveryBefore: number;
  recoveryAfter: number;
  recoveryDeltaPct: number;
  regressionRisk: string | null;
}): VeloImpactItem[] {
  const performanceLabel =
    input.performanceSetpoints > 0
      ? `+${formatNlNumber(input.performanceSetpoints, 1)} Performance-Anteil`
      : "kein Performance-Anteil aus Matchdays";
  return [
    {
      key: "xp",
      label: "Netto-Statwachstum",
      value: formatNlSignedNumber(input.netSetpoints, 1),
      detail: `+${formatNlNumber(input.trainingSetpoints, 1)} Trainingsbudget · ${performanceLabel}`,
      tone: input.netSetpoints >= 0 ? "positive" : "negative",
    },
    {
      key: "recovery",
      label: "Regeneration",
      value: `${formatNlNumber(input.recoveryBefore, 1)} → ${formatNlNumber(input.recoveryAfter, 1)}`,
      detail: input.recoveryDeltaPct === 0 ? "normale Erholung" : `${formatNlSignedPercent(input.recoveryDeltaPct)} Reg`,
      tone: input.recoveryDeltaPct >= 0 ? "positive" : "warning",
    },
    {
      key: "dev",
      label: "Saison-Risiko",
      value: formatNlSignedNumber(input.netSetpoints, 1),
      detail: `Gleicher Netto-Wert, diesmal mit Regressionsrisiko: ${input.regressionRisk ?? "—"}`,
      tone: input.netSetpoints >= 0 ? "positive" : "negative",
    },
  ];
}
