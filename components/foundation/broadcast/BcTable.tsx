import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";

import "./broadcast.css";

export type BcTableColumn<T> = {
  key: string;
  /** Kopfzelle; leer = keine Beschriftung. */
  kopf?: ReactNode;
  /** Spaltenbreite als CSS-Grid-Wert, z. B. "40px" oder "minmax(0,1fr)". */
  breite: string;
  rechts?: boolean;
  render: (zeile: T, index: number) => ReactNode;
  /** Kopf klickbar (Sortierung); `aktiv` färbt ihn gold. */
  onKopf?: () => void;
  aktiv?: boolean;
};

/**
 * TABELLE im Broadcast-Stil: Zahlen rechts mit fester Ziffernbreite, eigene Zeile hinterlegt
 * (Klasse `is-eigene`), nicht wählbare Zeilen gedimmt (`is-aus`). Zeilen sind Knöpfe, sobald
 * `onZeile` gesetzt ist. Spalten sind Daten, nicht JSX, damit Seiten dieselbe Tabelle mit eigenen
 * Zellen füllen.
 */
export function BcTable<T>({
  spalten,
  zeilen,
  zeilenKey,
  onZeile,
  zeilenKlasse,
  zeilenProps,
  leer,
  className,
}: {
  spalten: ReadonlyArray<BcTableColumn<T>>;
  zeilen: ReadonlyArray<T>;
  zeilenKey: (zeile: T, index: number) => string;
  onZeile?: (zeile: T) => void;
  zeilenKlasse?: (zeile: T) => string;
  zeilenProps?: (zeile: T) => HTMLAttributes<HTMLElement> & { disabled?: boolean; draggable?: boolean };
  leer?: ReactNode;
  className?: string;
}) {
  const raster: CSSProperties = { gridTemplateColumns: spalten.map((spalte) => spalte.breite).join(" ") };
  return (
    <div className={`bc-tbl${className ? ` ${className}` : ""}`} role="table">
      <div className="bc-tbl__kopf" style={raster} role="row">
        {spalten.map((spalte) =>
          spalte.onKopf ? (
            <button
              key={spalte.key}
              type="button"
              className={`${spalte.aktiv ? "is-an" : ""}${spalte.rechts ? " bc-r" : ""}`}
              style={{ textAlign: spalte.rechts ? "right" : "left" }}
              onClick={spalte.onKopf}
            >
              {spalte.kopf}
            </button>
          ) : (
            <span key={spalte.key} className={spalte.rechts ? "bc-r" : undefined} role="columnheader">
              {spalte.kopf}
            </span>
          ),
        )}
      </div>
      <div className="bc-tbl__koerper">
        {zeilen.length === 0 ? (leer ?? null) : null}
        {zeilen.map((zeile, index) => {
          const extra = zeilenProps?.(zeile) ?? {};
          const klasse = `bc-tbl__zeile${zeilenKlasse ? ` ${zeilenKlasse(zeile)}` : ""}`;
          const inhalt = spalten.map((spalte) => (
            <span key={spalte.key} className={spalte.rechts ? "bc-r" : undefined} style={{ minWidth: 0 }}>
              {spalte.render(zeile, index)}
            </span>
          ));
          return onZeile ? (
            <button
              key={zeilenKey(zeile, index)}
              type="button"
              className={klasse}
              style={raster}
              onClick={() => onZeile(zeile)}
              {...(extra as ButtonHTMLAttributes<HTMLButtonElement>)}
            >
              {inhalt}
            </button>
          ) : (
            <div key={zeilenKey(zeile, index)} className={klasse} style={raster} role="row" {...extra}>
              {inhalt}
            </div>
          );
        })}
      </div>
    </div>
  );
}
