import type { HTMLAttributes, ReactNode } from "react";

import "./broadcast.css";

/**
 * TAFEL: Karte mit Kopfzeile (Hausschrift) und „mehr ›" rechts. Der Körper scrollt in sich, wenn der
 * Elternteil eine Höhe vorgibt; ohne Höhe wächst die Tafel mit ihrem Inhalt.
 */
export function BcPanel({
  titel,
  aktionen,
  kopfInhalt,
  children,
  className,
  bodyClassName,
  ...rest
}: {
  titel?: ReactNode;
  /** Rechts in der Kopfzeile (Knöpfe, „mehr ›"). */
  aktionen?: ReactNode;
  /** Eigener Inhalt zwischen Titel und Aktionen (z. B. ein Suchfeld). */
  kopfInhalt?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={`bc-pan${className ? ` ${className}` : ""}`} {...rest}>
      {titel || aktionen || kopfInhalt ? (
        <header className="bc-pan__kopf">
          {titel ? <h2 className="bc-pan__titel">{titel}</h2> : null}
          {kopfInhalt}
          {aktionen ? <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>{aktionen}</div> : null}
        </header>
      ) : null}
      <div className={`bc-pan__koerper${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </section>
  );
}
