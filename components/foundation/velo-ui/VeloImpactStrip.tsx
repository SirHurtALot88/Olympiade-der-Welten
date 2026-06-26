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
  trainingSetpoints: number;
  performanceSetpoints: number;
  netSetpoints: number;
  recoveryBefore: number;
  recoveryAfter: number;
  recoveryDeltaPct: number;
  regressionRisk: string | null;
  legacyXpPreview?: number | null;
}): VeloImpactItem[] {
  const performanceLabel =
    input.performanceSetpoints > 0
      ? `+${formatVeloNumber(input.performanceSetpoints, 1)} Performance`
      : "keine Performance-Setpoints";
  const legacyDetail =
    input.legacyXpPreview != null && Math.abs(input.legacyXpPreview - input.netSetpoints) >= 1
      ? `XP-Track Preview ${formatVeloNumber(input.legacyXpPreview, 0)}`
      : undefined;
  return [
    {
      key: "xp",
      label: "Setpoints",
      value: formatVeloSignedNumber(input.netSetpoints, 1),
      detail: `+${formatVeloNumber(input.trainingSetpoints, 1)} Training · ${performanceLabel}${legacyDetail ? ` · ${legacyDetail}` : ""}`,
      tone: input.netSetpoints >= 0 ? "positive" : "negative",
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
      label: "Saison-Forecast",
      value: formatVeloSignedNumber(input.netSetpoints, 1),
      detail: `Netto nach Training + Matchday · Risiko ${input.regressionRisk ?? "—"}`,
      tone: input.netSetpoints >= 0 ? "positive" : "negative",
    },
  ];
}
