"use client";

import { NlGauge } from "@/components/foundation/new-look/NlGauge";
import type { NlTone } from "@/components/foundation/new-look/nl-tones";

export type MatchdayIntensityStage = "conserve" | "normal" | "push";

/** Kanonische Anzeige-Labels + Ton je Intensitaetsstufe (eine Quelle). */
const INTENSITY_META: Record<MatchdayIntensityStage, { label: string; short: string; tone: NlTone; step: number }> = {
  conserve: { label: "Schonen", short: "Schon", tone: "good", step: 1 },
  normal: { label: "Normal", short: "Norm", tone: "accent", step: 2 },
  push: { label: "Vollgas", short: "Push", tone: "risk", step: 3 },
};

export function intensityStageLabel(stage: MatchdayIntensityStage | null | undefined): string {
  return stage ? INTENSITY_META[stage].label : "—";
}

export type NlIntensityGaugeProps = {
  /** Intensitaetsstufe der Disziplinseite (conserve/normal/push). */
  stage: MatchdayIntensityStage | null | undefined;
  /** Kleines Label unter dem Wert, z. B. "D1" / "D2". */
  label?: string;
  title?: string;
  className?: string;
};

/**
 * Intensitaet als Bogen-Gauge: Schonen (1/3) → Normal (2/3) → Vollgas (3/3).
 * Der Ton wandert good → accent → risk mit steigendem Fatigue-Risiko.
 * Wrappt das geteilte NlGauge, damit die Darstellung ueberall identisch ist.
 */
export function NlIntensityGauge({ stage, label, title, className }: NlIntensityGaugeProps) {
  const meta = stage ? INTENSITY_META[stage] : null;
  const step = meta?.step ?? 0;
  return (
    <NlGauge
      value={step}
      max={3}
      tone={meta?.tone ?? "neutral"}
      label={label}
      format={() => meta?.short ?? "—"}
      title={title ?? `Intensitaet: ${meta?.label ?? "nicht gesetzt"}`}
      className={["nl-intensity-gauge", className ?? ""].filter(Boolean).join(" ")}
    />
  );
}

export default NlIntensityGauge;
