import type { ReactNode } from "react";

import "./broadcast.css";

/**
 * HERO-KOPF: Wappen, Dachzeile, Titel, Untertitel links; Reiter oder Kennzahl-Kacheln in der Mitte;
 * eine Hauptaktion rechts. Dahinter eine unscharfe Kulisse (Bild) oder, ohne Bild, ein Farbverlauf in
 * der Teamfarbe (`--nl-accent` der Shell, Rückfall Bernstein).
 */
export function BcHero({
  wappen,
  wappenAlt,
  dachzeile,
  titel,
  untertitel,
  kulisseUrl,
  mitte,
  rechts,
  className,
}: {
  wappen?: string | null;
  wappenAlt?: string;
  dachzeile?: ReactNode;
  titel: ReactNode;
  untertitel?: ReactNode;
  kulisseUrl?: string | null;
  mitte?: ReactNode;
  rechts?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`bc-hero${className ? ` ${className}` : ""}`}>
      {kulisseUrl ? (
        <div className="bc-hero__kul" style={{ backgroundImage: `url("${kulisseUrl}")` }} aria-hidden="true" />
      ) : (
        <div className="bc-hero__kul is-farbe" aria-hidden="true" />
      )}
      <div className="bc-hero__kopf">
        <div className="bc-hero__crest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {wappen ? <img src={wappen} alt={wappenAlt ?? ""} /> : null}
        </div>
        <div style={{ minWidth: 0 }}>
          {dachzeile ? <div className="bc-hero__dach">{dachzeile}</div> : null}
          <h2 className="bc-hero__titel">{titel}</h2>
          {untertitel ? <div className="bc-hero__sub">{untertitel}</div> : null}
        </div>
      </div>
      <div className="bc-hero__mitte" role="tablist">
        {mitte}
      </div>
      <div className="bc-hero__rechts">{rechts}</div>
    </header>
  );
}

/** Ein schräger Reiter im Kopf (Disziplin, Bereich) mit Strichleiste und großer Zahl. */
export function BcReiter({
  aktiv,
  onClick,
  eyebrow,
  titel,
  symbol,
  strich,
  wert,
  wertNote,
  titelAttr,
}: {
  aktiv: boolean;
  onClick: () => void;
  eyebrow: ReactNode;
  titel: ReactNode;
  symbol?: ReactNode;
  /** Füllstand als Striche: "an" besetzt, "fe" Fehler, "leer" offen. */
  strich?: ReadonlyArray<"an" | "fe" | "leer">;
  wert?: ReactNode;
  wertNote?: ReactNode;
  titelAttr?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktiv}
      title={titelAttr}
      className={`bc-reiter${aktiv ? " is-an" : ""}`}
      onClick={onClick}
    >
      <span className="bc-reiter__ic">{symbol}</span>
      <span style={{ minWidth: 0 }}>
        <span className="bc-reiter__ey">{eyebrow}</span>
        <span className="bc-reiter__ti">{titel}</span>
        {strich && strich.length > 0 ? (
          <span className="bc-reiter__strich" aria-hidden="true">
            {strich.map((art, index) => (
              <i key={index} className={art === "an" ? "is-an" : art === "fe" ? "is-fe" : undefined} />
            ))}
          </span>
        ) : null}
      </span>
      <span className="bc-reiter__wert">
        {wert != null ? <strong className="bc-t">{wert}</strong> : null}
        {wertNote ? <span>{wertNote}</span> : null}
      </span>
    </button>
  );
}
