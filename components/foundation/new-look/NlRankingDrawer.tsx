"use client";

import { useEffect, useMemo, useRef } from "react";

import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import { NlMedalBadge, type NlMedalKind } from "@/components/foundation/new-look/NlMedalBadge";
import { formatNlNumber, nlToneClass, type NlTone } from "@/components/foundation/new-look/nl-tones";

/**
 * "Neuer Look" Ranking-Drawer (#37, flag-gated, additiv).
 *
 * Wenn auf einen KPI-Chip (OVR/PPs/MVS/Punkte/MW/…) geklickt wird, soll die
 * Rangliste dieser Kennzahl nicht mehr über eine volle Seiten-Navigation
 * erreicht werden, sondern als leichtes seitliches Panel aufklappen — mit
 * der geklickten Zeile hervorgehoben/ins Bild gescrollt. Overlay + ESC +
 * "Schließen" spiegeln `PlayerDetailDrawer`
 * (`app/foundation/PlayerDetailDrawer.tsx`, Backdrop/`role="dialog"`/
 * `useFocusTrap`), aber ohne Portal — der Drawer wird lokal in der
 * jeweiligen Oberfläche (Home/Season/Ranks/League-Leaders) gemountet und
 * bekommt seine Zeilen aus der dort bereits vorhandenen Rangliste; es wird
 * hier nichts neu berechnet oder erfunden.
 */
export type NlRankingDrawerRow = {
  /** Stabiler Key (z. B. teamId/playerId). */
  id: string;
  rank: number;
  name: string;
  /** Zusatzzeile unter dem Namen, z. B. Team-Kürzel. */
  sub?: string | null;
  value: number | null;
  /** Fertig formatierter Wert; ohne Angabe wird `value` mit `formatNlNumber` formatiert. */
  displayValue?: string;
  tone?: NlTone;
  /** Optionales Delta (z. B. Rang-/Wert-Bewegung) mit ▲/▼. */
  delta?: number | null;
  /** Hebt die Zeile dauerhaft als "dein Team"/"dein Spieler" hervor. */
  isOwn?: boolean;
};

export type NlRankingDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Anzeigename der Kennzahl, z. B. "OVR", "PPs", "MVS", "Punkte", "MW". */
  metricLabel: string;
  /** Interner Kennzahl-Schlüssel, nur als `data-metric-key` fürs Debugging/Tests. */
  metricKey?: string;
  /** Zusatzzeile im Kopf, z. B. Saison-/Ligakontext. */
  subtitle?: string;
  rows: NlRankingDrawerRow[];
  /** Zeile, die beim Öffnen hervorgehoben und ins Bild gescrollt wird. Ohne Angabe die erste `isOwn`-Zeile. */
  highlightId?: string | null;
  emptyLabel?: string;
  /**
   * Sekundärer Navigationspfad: macht Zeilen klickbar (z. B. Team-/
   * Spielerprofil öffnen) und schließt danach den Drawer. Ohne diese Prop
   * bleibt der Drawer die primäre (nicht-navigierende) Ansicht.
   */
  onSelectRow?: (row: NlRankingDrawerRow) => void;
  className?: string;
};

function resolveMedalKind(rank: number): NlMedalKind | null {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}

export function NlRankingDrawer({
  open,
  onClose,
  metricLabel,
  metricKey,
  subtitle,
  rows,
  highlightId,
  emptyLabel = "Keine Rangliste verfügbar.",
  onSelectRow,
  className,
}: NlRankingDrawerProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  const resolvedHighlightId = useMemo(() => {
    if (highlightId) {
      return highlightId;
    }
    return rows.find((row) => row.isOwn)?.id ?? null;
  }, [highlightId, rows]);

  // ESC schließt, wie beim PlayerDetailDrawer (nur aktiv, solange offen).
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useFocusTrap(open, dialogRef);

  // Geklickte/eigene Zeile beim Öffnen ins Bild scrollen — respektiert
  // prefers-reduced-motion (kein "smooth" Scroll bei reduzierter Bewegung).
  useEffect(() => {
    if (!open || !resolvedHighlightId || !listRef.current) {
      return;
    }
    const node = Array.from(listRef.current.querySelectorAll<HTMLElement>("[data-row-id]")).find(
      (element) => element.dataset.rowId === resolvedHighlightId,
    );
    if (!node) {
      return;
    }
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [open, resolvedHighlightId, rows]);

  if (!open) {
    return null;
  }

  function handleRowSelect(row: NlRankingDrawerRow) {
    onSelectRow?.(row);
    onClose();
  }

  return (
    <div className="nl-rankdrawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className={["nl-rankdrawer", className ?? ""].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={`${metricLabel} Rangliste`}
        data-metric-key={metricKey}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="nl-rankdrawer-head">
          <div className="nl-rankdrawer-head-copy">
            <span className="nl-rankdrawer-eyebrow">Rangliste</span>
            <h3 className="nl-rankdrawer-title">{metricLabel}</h3>
            {subtitle ? <p className="nl-rankdrawer-subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="nl-rankdrawer-close" onClick={onClose}>
            Schließen
          </button>
        </header>
        <div className="nl-rankdrawer-body">
          {rows.length === 0 ? (
            <p className="nl-rankdrawer-empty">{emptyLabel}</p>
          ) : (
            <ol className="nl-rankdrawer-list" ref={listRef}>
              {rows.map((row) => {
                const medalKind = resolveMedalKind(row.rank);
                const isHighlighted = row.id === resolvedHighlightId;
                const displayValue = row.displayValue ?? formatNlNumber(row.value, 1);
                const rowClasses = [
                  "nl-rankdrawer-row",
                  row.isOwn ? "is-own" : "",
                  isHighlighted ? "is-highlighted" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const inner = (
                  <>
                    <span className="nl-rankdrawer-rank">
                      {medalKind ? (
                        <NlMedalBadge kind={medalKind} title={`Rang ${row.rank}`} />
                      ) : (
                        <span className="nl-rankdrawer-rank-num nl-tnum">#{row.rank}</span>
                      )}
                    </span>
                    <span className="nl-rankdrawer-name">
                      <span className="nl-rankdrawer-name-text">{row.name}</span>
                      {row.sub ? <span className="nl-rankdrawer-sub">{row.sub}</span> : null}
                    </span>
                    <span className={["nl-rankdrawer-value", "nl-tnum", row.tone ? nlToneClass(row.tone) : ""].filter(Boolean).join(" ")}>
                      {displayValue}
                    </span>
                    {row.delta != null && Number.isFinite(row.delta) && row.delta !== 0 ? (
                      <span className={`nl-rankdrawer-delta ${row.delta > 0 ? "is-positive" : "is-negative"}`}>
                        {row.delta > 0 ? "▲" : "▼"}
                        {formatNlNumber(Math.abs(row.delta), 1)}
                      </span>
                    ) : (
                      <span className="nl-rankdrawer-delta is-empty" aria-hidden="true" />
                    )}
                  </>
                );
                return (
                  <li key={row.id} data-row-id={row.id} className={rowClasses}>
                    {onSelectRow ? (
                      <button
                        type="button"
                        className="nl-rankdrawer-rowinner nl-rankdrawer-rowbtn"
                        onClick={() => handleRowSelect(row)}
                        title={`${row.name} öffnen`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className="nl-rankdrawer-rowinner">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

export default NlRankingDrawer;
