"use client";

import { useEffect, useRef, useState } from "react";

import FoundationActivityStrip from "@/app/foundation/shell/FoundationActivityStrip";
import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";

export type FoundationTaktgeberProps = {
  /** Beschriftung des nächsten Schritts („Einsatzliste setzen“). */
  label: string;
  title?: string;
  /** `is-ready` | `is-warning` | `is-blocked` | … aus `deriveGlobalNextUi`. */
  statusClass: string;
  onClick: () => void;
  activities: FoundationActivityItem[];
};

export type TaktgeberZustand = "bereit" | "weiter" | "zu" | "laeuft";

/**
 * Drei Zustände des Taktgebers (Mockup app-rahmen-modern-18-11): `laeuft` sobald eine Aktivität läuft,
 * `zu` wenn der nächste Schritt noch blockiert ist (Klick springt trotzdem zum offenen Schritt),
 * `weiter` wenn alles bereit ist (pulsiert), sonst `bereit`.
 */
export function bestimmeTaktgeberZustand(statusClass: string, activities: FoundationActivityItem[]): TaktgeberZustand {
  if (activities.some((activity) => activity.tone === "running")) return "laeuft";
  if (statusClass.includes("is-blocked")) return "zu";
  if (statusClass.includes("is-ready")) return "weiter";
  return "bereit";
}

export default function FoundationTaktgeber({ label, title, statusClass, onClick, activities }: FoundationTaktgeberProps) {
  const [ablauf, setAblauf] = useState(false);
  const wurzel = useRef<HTMLDivElement | null>(null);
  const zustand = bestimmeTaktgeberZustand(statusClass, activities);
  const laufend = activities.find((activity) => activity.tone === "running") ?? null;
  const pct =
    laufend?.progressPct != null && Number.isFinite(laufend.progressPct)
      ? Math.max(0, Math.min(100, Math.round(laufend.progressPct)))
      : null;

  useEffect(() => {
    if (!ablauf) return;
    const schliesse = (event: Event) => {
      if (event.type === "keydown") {
        if ((event as KeyboardEvent).key === "Escape") setAblauf(false);
        return;
      }
      if (wurzel.current && !wurzel.current.contains(event.target as Node)) setAblauf(false);
    };
    document.addEventListener("mousedown", schliesse);
    document.addEventListener("keydown", schliesse);
    return () => {
      document.removeEventListener("mousedown", schliesse);
      document.removeEventListener("keydown", schliesse);
    };
  }, [ablauf]);

  const statusText =
    zustand === "laeuft"
      ? `Aktion läuft · ${laufend?.currentLabel ?? laufend?.label ?? ""}`.replace(/ · $/, "")
      : zustand === "zu"
        ? "Hält auf · Klick springt zum offenen Schritt"
        : zustand === "weiter"
          ? "Bereit zum Weiter · Leertaste"
          : "Bereit · Leertaste";

  return (
    <div className={`foundation-takt is-${zustand}`} data-testid="foundation-takt" data-takt-state={zustand} ref={wurzel}>
      <button
        type="button"
        className={`foundation-takt-knopf foundation-global-next-button ${statusClass}`}
        data-testid="foundation-global-next-button"
        onClick={onClick}
        title={title}
      >
        {zustand === "laeuft" && pct != null ? (
          <i className="foundation-takt-fuell" style={{ width: `${pct}%` }} aria-hidden="true" />
        ) : null}
        <span>{zustand === "laeuft" ? "Aktion läuft" : "Weiter"}</span>
        {zustand === "laeuft" ? pct != null ? <strong>{pct} %</strong> : null : <strong>{label}</strong>}
        <small>Leertaste</small>
      </button>
      <button
        type="button"
        className="foundation-takt-status"
        data-testid="foundation-takt-status"
        aria-expanded={ablauf}
        onClick={() => setAblauf((offen) => !offen)}
        title="Ablauf anzeigen"
      >
        <i aria-hidden="true" />
        <span>{statusText}</span>
        <b aria-hidden="true">{ablauf ? "▴" : "▾"}</b>
      </button>
      {zustand === "laeuft" ? <span className="foundation-takt-linie" aria-hidden="true" /> : null}
      <div className={`foundation-takt-ablauf${ablauf ? " is-offen" : ""}`} data-testid="foundation-takt-ablauf">
        <strong className="foundation-takt-ablauf-titel">Ablauf</strong>
        {activities.length === 0 ? <p className="foundation-takt-ablauf-leer">{title ?? "Keine laufenden Aktionen."}</p> : null}
        <FoundationActivityStrip activities={activities} />
      </div>
    </div>
  );
}
