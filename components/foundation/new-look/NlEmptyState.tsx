"use client";

import type { ReactNode } from "react";

import { nlToneClass, type NlTone } from "@/components/foundation/new-look/nl-tones";

export type NlEmptyStateAction = {
  label: string;
  onClick: () => void;
};

export type NlEmptyStateProps = {
  /** Optionaler Icon-Slot — Emoji oder eigenes SVG-Node. */
  icon?: ReactNode;
  title: string;
  /** Kurze Zusatzzeile unter dem Titel. */
  message?: ReactNode;
  /** Optionale Aktion (z. B. "Filter zurücksetzen"). */
  action?: NlEmptyStateAction;
  tone?: NlTone;
  className?: string;
  "data-testid"?: string;
};

/**
 * Token-korrekter Leerzustand des neuen Looks — ersetzt die bislang wild
 * gestreuten bespoke Leerzustände (bare `<p class="…-empty muted">`-Zeilen)
 * durch EIN gemeinsames `--nl-*`-Vokabular. Kompakt gehalten (Icon optional,
 * Message optional, Aktion optional) — für aufwendig illustrierte
 * Leerzustände (z. B. der Kredit-Tresor) bleibt die bespoke Lösung sinnvoll
 * und wird hier bewusst NICHT ersetzt.
 */
export function NlEmptyState({
  icon,
  title,
  message,
  action,
  tone = "neutral",
  className,
  "data-testid": dataTestId,
}: NlEmptyStateProps) {
  const classes = ["nl-empty-state", nlToneClass(tone), className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={classes} role="status" data-testid={dataTestId}>
      {icon ? (
        <span className="nl-empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="nl-empty-state-copy">
        <strong className="nl-empty-state-title">{title}</strong>
        {message ? <p className="nl-empty-state-message">{message}</p> : null}
      </div>
      {action ? (
        <button type="button" className="nl-empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export default NlEmptyState;
