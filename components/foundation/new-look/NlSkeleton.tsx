"use client";

import type { CSSProperties } from "react";

export type NlSkeletonVariant = "text" | "line" | "block" | "circle" | "card";

export type NlSkeletonProps = {
  /**
   * Form des Platzhalters:
   * - `text`   — kurze Textzeile(n) (nutzt `lines`)
   * - `line`   — eine einzelne, dünne Zeile (z. B. Label/Wert)
   * - `block`  — rechteckiger Füll-Block (Chart-/Panel-Fläche)
   * - `circle` — runder Platzhalter (Avatar/Icon)
   * - `card`   — größere Karten-Fläche mit Radius
   */
  variant?: NlSkeletonVariant;
  /** Breite (px-Zahl → px, sonst roher CSS-Wert wie "60%"). */
  width?: number | string;
  /** Höhe (px-Zahl → px, sonst roher CSS-Wert). */
  height?: number | string;
  /** Nur für `variant="text"`: Anzahl gestapelter Zeilen (Default 1). */
  lines?: number;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
};

function toCssSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Gemeinsames Skeleton-Primitive des neuen Looks — ersetzt die bislang
 * verstreuten Ad-hoc-Skeletons (arena/season/panel) durch EIN token-korrektes
 * (`--nl-*`) Vokabular mit einem geteilten Shimmer (`@keyframes
 * nl-skeleton-shimmer`), der `prefers-reduced-motion` respektiert (statische,
 * gedämpfte Füllung ohne Bewegung).
 *
 * Rein dekorativ: das Element ist standardmäßig `aria-hidden`. Wo zuvor ein
 * Spinner/„lädt“ den Ladezustand für Screenreader ankündigte, gehört der
 * Skeleton in einen `role="status"`-Wrapper mit SR-only-Label (siehe
 * Aufruf-Sites) — der Skeleton selbst bleibt still.
 */
export function NlSkeleton({
  variant = "line",
  width,
  height,
  lines = 1,
  className,
  style,
  "data-testid": dataTestId,
}: NlSkeletonProps) {
  const baseClass = `nl-skeleton nl-skeleton--${variant}`;

  if (variant === "text" && lines > 1) {
    return (
      <span
        className={["nl-skeleton-lines", className ?? ""].filter(Boolean).join(" ")}
        aria-hidden="true"
        data-testid={dataTestId}
        style={{ width: toCssSize(width) }}
      >
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={`nl-skeleton-line-${index}`}
            className={baseClass}
            // Letzte Zeile bewusst kürzer für natürlicheren Textfluss.
            style={index === lines - 1 ? { width: "70%" } : undefined}
          />
        ))}
      </span>
    );
  }

  const mergedStyle: CSSProperties = {
    ...(width !== undefined ? { width: toCssSize(width) } : null),
    ...(height !== undefined ? { height: toCssSize(height) } : null),
    ...style,
  };

  return (
    <span
      className={[baseClass, className ?? ""].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-testid={dataTestId}
      style={mergedStyle}
    />
  );
}

export type NlSkeletonTableProps = {
  rows?: number;
  cols?: number;
  className?: string;
  "data-testid"?: string;
};

/**
 * Tabellen-Skeleton (Kopfzeile + `rows`×`cols` Zellen) für tabellenlastige
 * Ladezustände (Standings/Spieler-Tabellen). Dekorativ (`aria-hidden`).
 */
export function NlSkeletonTable({ rows = 6, cols = 4, className, "data-testid": dataTestId }: NlSkeletonTableProps) {
  return (
    <div
      className={["nl-skeleton-table", className ?? ""].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-testid={dataTestId}
      style={{ ["--nl-skeleton-cols" as string]: String(cols) } as CSSProperties}
    >
      <div className="nl-skeleton-table-row nl-skeleton-table-row--head">
        {Array.from({ length: cols }, (_, colIndex) => (
          <NlSkeleton key={`nl-skeleton-head-${colIndex}`} variant="line" height={12} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={`nl-skeleton-row-${rowIndex}`} className="nl-skeleton-table-row">
          {Array.from({ length: cols }, (_, colIndex) => (
            <NlSkeleton key={`nl-skeleton-cell-${rowIndex}-${colIndex}`} variant="line" height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export type NlSkeletonCardProps = {
  /** Anzahl der Textzeilen im Karten-Body (Default 3). */
  lines?: number;
  /** Runden Avatar-Platzhalter in der Kopfzeile zeigen. */
  withAvatar?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Karten-Skeleton (Eyebrow/Titel + Textzeilen, optional Avatar) für
 * panel-/karten-lastige Ladezustände. Dekorativ (`aria-hidden`).
 */
export function NlSkeletonCard({ lines = 3, withAvatar = false, className, "data-testid": dataTestId }: NlSkeletonCardProps) {
  return (
    <div
      className={["nl-skeleton-card", className ?? ""].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-testid={dataTestId}
    >
      <div className="nl-skeleton-card-head">
        {withAvatar ? <NlSkeleton variant="circle" width={36} height={36} /> : null}
        <div className="nl-skeleton-card-head-copy">
          <NlSkeleton variant="line" width="40%" height={10} />
          <NlSkeleton variant="line" width="70%" height={16} />
        </div>
      </div>
      <NlSkeleton variant="text" lines={lines} />
    </div>
  );
}

export default NlSkeleton;
