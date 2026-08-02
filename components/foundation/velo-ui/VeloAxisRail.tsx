"use client";

import Image from "next/image";

import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import { getCoreStatGrade } from "@/lib/matchday-arena/arena-stat-visuals";

import type { VeloAxisKey } from "@/components/foundation/velo-ui/VeloStatOrbitChip";

const AXIS_META: Record<VeloAxisKey, { label: string; icon: string; name: string }> = {
  pow: { label: "POW", icon: "/discipline-icons/POW.svg", name: "Power" },
  spe: { label: "SPE", icon: "/discipline-icons/SPE.svg", name: "Speed" },
  men: { label: "MEN", icon: "/discipline-icons/MEN.svg", name: "Mental" },
  soc: { label: "SOC", icon: "/discipline-icons/SOC.svg", name: "Social" },
};

export type VeloAxisRailEntry = {
  axis: VeloAxisKey;
  value: number;
  /** Vergleichswert derselben Achse, z. B. der Kader-Schnitt. Zeichnet eine Marke im Meter. */
  reference?: number | null;
};

export type VeloAxisRailProps = {
  entries: VeloAxisRailEntry[];
  /** Obergrenze des Meters. Achswerte sind Disziplin-Mittel, keine 0–100-Rohskala. */
  max?: number;
  /** Beschriftung der Referenzmarke im Tooltip, z. B. "Team Top-6 Ø". */
  referenceLabel?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Vier Achsen als Meter-Zeilen statt flacher Pillen: Disziplin-Icon in Achsfarbe, Wert tabular,
 * Note als Tier-Badge, und — wenn vorhanden — eine Marke fuer den Vergleichswert.
 *
 * Die Note kommt aus `getCoreStatGrade` und ist an die GEMESSENE Achsverteilung verankert
 * (Median ~42,5); die Fuellbreite dagegen an `max`, damit die Zeilen untereinander vergleichbar
 * bleiben. Beides bewusst getrennt: die Farbe sagt „wie gut", die Laenge „wie viel".
 */
export function VeloAxisRail({
  entries,
  max = 100,
  referenceLabel = "Vergleich",
  className = "",
  "aria-label": ariaLabel,
}: VeloAxisRailProps) {
  if (entries.length === 0) {
    return null;
  }
  const span = Math.max(1, max);
  return (
    <div className={`velo-axis-rail${className ? ` ${className}` : ""}`} role="list" aria-label={ariaLabel}>
      {entries.map((entry) => {
        const meta = AXIS_META[entry.axis];
        const grade = getCoreStatGrade(entry.value);
        // Auf zwei Nachkommastellen: sonst landet `55` als `55.00000000000001%` im Markup.
        const prozent = (wert: number) => Math.round(Math.min(100, Math.max(0, (wert / span) * 100)) * 100) / 100;
        const fill = prozent(entry.value);
        const reference = entry.reference != null && Number.isFinite(entry.reference) ? prozent(entry.reference) : null;
        const delta = entry.reference != null && Number.isFinite(entry.reference) ? entry.value - entry.reference : null;
        const title =
          delta == null
            ? `${meta.name} ${formatNlNumber(entry.value, 0)} (${grade})`
            : `${meta.name} ${formatNlNumber(entry.value, 0)} (${grade}) — ${referenceLabel} ${formatNlNumber(
                entry.reference ?? 0,
                0,
              )}, ${delta >= 0 ? "+" : "−"}${formatNlNumber(Math.abs(delta), 0)}`;
        return (
          <div
            key={`velo-axis-rail-${entry.axis}`}
            className={`velo-axis-rail-row is-${entry.axis} is-grade-${grade.toLowerCase()}`}
            role="listitem"
            title={title}
            aria-label={title}
          >
            <span className="velo-axis-rail-badge" aria-hidden="true">
              <Image src={meta.icon} alt="" width={14} height={14} className="velo-axis-rail-icon" />
            </span>
            <span className="velo-axis-rail-label">{meta.label}</span>
            <span className="velo-axis-rail-meter" aria-hidden="true">
              <span className="velo-axis-rail-fill" style={{ width: `${fill}%` }} />
              {reference != null ? (
                <span className="velo-axis-rail-mark" style={{ left: `${reference}%` }} />
              ) : null}
            </span>
            <span className="velo-axis-rail-value nl-tnum">{formatNlNumber(entry.value, 0)}</span>
            <span className="velo-axis-rail-grade">{grade}</span>
          </div>
        );
      })}
    </div>
  );
}
