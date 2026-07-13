"use client";

import type { ReactNode } from "react";

import { nlToneClass, type NlTone } from "@/components/foundation/new-look/nl-tones";
import { getGameTermTooltip } from "@/lib/ui/game-encyclopedia";

export type StatChipProps = {
  /** Kleines Uppercase-Label, z. B. "OVR", "PPs", "MW". */
  label: string;
  /** Prominenter Wert (tabular). */
  value: string | number;
  tone?: NlTone;
  /** Optionale Zusatzzeile unter dem Wert, z. B. "#3 Liga". */
  sub?: string;
  /** Macht den Chip zum Portal (Button mit Hover-Lift + Pfeil). */
  onClick?: () => void;
  title?: string;
  className?: string;
  /** Expliziter Accessible-Name — sonst liest AT nur Label+Wert vor. */
  ariaLabel?: string;
};

/**
 * Wiederkehrendes Stat-Vokabular des neuen Looks: kompakter Chip mit
 * Label oben, tabularem Wert darunter. Mit `onClick` wird jeder Stat
 * zum Portal in die passende Detailansicht.
 */
export function StatChip({ label, value, tone = "neutral", sub, onClick, title, className, ariaLabel }: StatChipProps) {
  const classes = ["nl-stat-chip", nlToneClass(tone), onClick ? "is-interactive" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  // Ohne expliziten `title` das Lexikon-Kurztooltip des Labels aufloesen
  // (OVR/PPs/MVS/MW/GuV/Fit/Value/Bedarf/CA/PO …). Zentral hier, damit jede
  // StatChip in der App automatisch die Erklaerung im Hover traegt.
  const termTooltip = title ? null : getGameTermTooltip(label);
  const resolvedTitle = title ?? termTooltip ?? undefined;

  const body = (
    <>
      <span className="nl-stat-chip-label">
        {label}
        {termTooltip ? (
          <span className="nl-stat-chip-help" aria-hidden="true">
            ?
          </span>
        ) : null}
      </span>
      <span className="nl-stat-chip-value nl-tnum">{value}</span>
      {sub ? <span className="nl-stat-chip-sub">{sub}</span> : null}
      {onClick ? (
        <span className="nl-stat-chip-arrow" aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} title={resolvedTitle} aria-label={ariaLabel}>
        {body}
      </button>
    );
  }

  return (
    <span className={classes} title={resolvedTitle}>
      {body}
    </span>
  );
}

export type StatChipRowProps = {
  children: ReactNode;
  /** Optionales Zeilen-Label vor den Chips, z. B. "Saison". */
  label?: string;
  className?: string;
  "aria-label"?: string;
};

/** Layout-Zeile für OVR/PPs/MVS/MW-Chips. */
export function StatChipRow({ children, label, className, "aria-label": ariaLabel }: StatChipRowProps) {
  return (
    <div className={["nl-stat-chip-row", className ?? ""].filter(Boolean).join(" ")} role="group" aria-label={ariaLabel}>
      {label ? <span className="nl-stat-chip-row-label">{label}</span> : null}
      {children}
    </div>
  );
}
