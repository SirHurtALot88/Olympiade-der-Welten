"use client";

import { NlGauge } from "@/components/foundation/new-look/NlGauge";
import type { NlTone } from "@/components/foundation/new-look/nl-tones";

/**
 * Kanonische Fatigue-Schwellen fuer die gesamte Oberflaeche.
 *
 * Dieselben Werte wie die Heat-Badges in der Einsatzliste
 * (FATIGUE_UI_MEDIUM / FATIGUE_UI_HIGH). Aenderungen hier wirken auf
 * jedes Fatigue-Gauge im Spiel — bewusst eine einzige Quelle.
 */
export const FATIGUE_MEDIUM = 40;
export const FATIGUE_HIGH = 65;

/** Ton fuer einen Fatigue-Wert: frisch = good, mittel = warn, ausgelaugt = risk. */
export function fatigueTone(value: number): NlTone {
  if (!Number.isFinite(value)) return "neutral";
  if (value >= FATIGUE_HIGH) return "risk";
  if (value >= FATIGUE_MEDIUM) return "warn";
  return "good";
}

export type NlFatigueGaugeProps = {
  /** Fatigue-Wert 0–100 (leerer Bogen = frisch, voller Bogen = ausgelaugt). */
  value: number;
  label?: string;
  title?: string;
  className?: string;
};

/**
 * Fatigue als Bogen-Gauge. Der Bogen fuellt sich mit der Erschoepfung
 * (0 = frisch, 100 = ausgelaugt), der Ton wandert good → warn → risk.
 * Nutzt das geteilte NlGauge, damit Form und Verhalten ueberall gleich sind.
 */
export function NlFatigueGauge({ value, label = "Fatigue", title, className }: NlFatigueGaugeProps) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <NlGauge
      value={safe}
      max={100}
      tone={fatigueTone(safe)}
      label={label}
      format={(current) => String(Math.round(current))}
      title={title ?? `Fatigue ${Math.round(safe)}/100`}
      className={["nl-fatigue-gauge", className ?? ""].filter(Boolean).join(" ")}
    />
  );
}

export default NlFatigueGauge;
