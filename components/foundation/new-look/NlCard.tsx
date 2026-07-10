"use client";

import type { ReactNode } from "react";

export type NlCardProps = {
  children?: ReactNode;
  /** Karten-Titel (Display-Serif). */
  title?: ReactNode;
  /** Kleine Kicker-Zeile über dem Titel. */
  eyebrow?: ReactNode;
  /** Aktions-Slot rechts im Kopfbereich. */
  actions?: ReactNode;
  /** Hover-Lift-Variante für klickbare/fokussierte Karten. */
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
};

/**
 * Standard-Oberfläche des neuen Looks: Panel-Fläche, feine Linie,
 * mittlerer Radius, weiche Elevation. Kopfbereich nur wenn
 * title/eyebrow/actions gesetzt sind.
 */
export function NlCard({
  children,
  title,
  eyebrow,
  actions,
  interactive = false,
  onClick,
  className,
  "data-testid": dataTestId,
}: NlCardProps) {
  const hasHeader = title != null || eyebrow != null || actions != null;
  const classes = ["nl-card", interactive || onClick ? "is-interactive" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} onClick={onClick} data-testid={dataTestId}>
      {hasHeader ? (
        <header className="nl-card-head">
          <div className="nl-card-head-copy">
            {eyebrow ? <span className="nl-card-eyebrow">{eyebrow}</span> : null}
            {title ? <h3 className="nl-card-title">{title}</h3> : null}
          </div>
          {actions ? <div className="nl-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children != null ? <div className="nl-card-body">{children}</div> : null}
    </section>
  );
}

export default NlCard;
