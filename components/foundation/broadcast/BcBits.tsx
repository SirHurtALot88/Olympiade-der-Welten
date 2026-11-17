import type { CSSProperties, ReactNode } from "react";

import "./broadcast.css";

/** Kleine Marke (Kürzel, Zustand). `ton` färbt sie; `farbe` setzt die Positionsfarbe (`--pc`). */
export function BcMarke({
  children,
  ton,
  farbe,
  titel,
}: {
  children: ReactNode;
  ton?: "rot" | "gelb" | "leer";
  farbe?: string;
  titel?: string;
}) {
  return (
    <span
      className={`bc-marke${ton ? ` is-${ton}` : ""}`}
      style={farbe ? ({ "--pc": farbe } as CSSProperties) : undefined}
      title={titel}
    >
      {children}
    </span>
  );
}

/** Filter-Chip (Umschalter). */
export function BcChip({
  children,
  gedrueckt,
  onClick,
}: {
  children: ReactNode;
  gedrueckt?: boolean;
  onClick?: () => void;
}) {
  if (!onClick) return <span className="bc-chip">{children}</span>;
  return (
    <button type="button" className="bc-chip" aria-pressed={gedrueckt} onClick={onClick}>
      {children}
    </button>
  );
}

/** Balken für eine Last/Auslastung: 0–100, Farbe nach Schwelle (gut < mittel ≤ hoch). */
export function BcLast({ wert, mittel = 40, hoch = 65, titel }: { wert: number; mittel?: number; hoch?: number; titel?: string }) {
  const w = Math.max(0, Math.min(100, Number.isFinite(wert) ? wert : 0));
  const stufe = w >= hoch ? " is-h" : w >= mittel ? " is-m" : "";
  return (
    <div className={`bc-last${stufe}`} title={titel} role="img" aria-label={titel ?? `Last ${Math.round(w)} von 100`}>
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

/** Mehrfach-Schalter („Schonen · Normal · Vollgas"). */
export function BcSeg<T extends string>({
  optionen,
  wert,
  onWahl,
  gesperrt,
  ariaLabel,
}: {
  optionen: ReadonlyArray<{ id: T; label: ReactNode; heiss?: boolean; titel?: string }>;
  wert: T | null;
  onWahl: (id: T) => void;
  gesperrt?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="bc-seg" role="group" aria-label={ariaLabel}>
      {optionen.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.heiss ? "is-heiss" : undefined}
          aria-pressed={wert === option.id}
          disabled={gesperrt}
          title={option.titel}
          onClick={() => onWahl(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
