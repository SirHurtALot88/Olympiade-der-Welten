"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import FoundationActivityStrip from "@/app/foundation/shell/FoundationActivityStrip";
import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";
import { LEERER_TAKT_PLAN, type TaktPlan, type TaktSchritt } from "@/lib/foundation/foundation-takt-plan";
import { setzeTaktRegistrierung } from "@/lib/foundation/takt-klick-store";
import { abonniereTaktAblauf, getTaktAblaufOffen, setTaktAblaufOffen } from "@/lib/foundation/takt-ablauf-store";

export type FoundationTaktgeberProps = {
  /** Beschriftung des nächsten Schritts („Einsatzliste setzen“). */
  label: string;
  title?: string;
  /** `is-ready` | `is-warning` | `is-blocked` | … aus `deriveGlobalNextUi`. */
  statusClass: string;
  onClick: () => void;
  /** Sofort-Rückmeldung beim Klick: Knopf gesperrt, Beschriftung „speichert…“, Zustand „läuft“. */
  busy?: boolean;
  activities: FoundationActivityItem[];
  /**
   * Ist der Knopf WIRKLICH gesperrt (globaler Flow: Schritt wird angewendet, Cockpit beschäftigt, Saisonwechsel)? Nur dann zeigt der
   * Taktgeber „Aktion läuft“. Ohne Angabe (Draft, Einsatzliste) sperren laufende Hintergrund-Aktivitäten nie — der Knopf ist dort
   * immer bedienbar (21.11., Chris: der Button muss IMMER weiterbringen).
   */
  gesperrt?: boolean;
  /** Nur der globale Flow: bleibt nach dem Klick/der Leertaste alles beim Alten, erklärt der Ablauf, was hier noch zu tun ist. */
  istGlobal?: boolean;
  /** Pflichtschritte mit Haken/Rot/Gelb und kritische Punkte (lib/foundation/foundation-takt-plan.ts). */
  plan?: TaktPlan;
};

const SCHRITT_ZEICHEN: Record<TaktSchritt["status"], string> = { erledigt: "✓", jetzt: "●", offen: "○", rot: "!", gelb: "i" };

export type TaktgeberZustand = "bereit" | "weiter" | "zu" | "laeuft";

/**
 * Drei Zustände des Taktgebers (Mockup app-rahmen-modern-18-11): `laeuft` sobald eine Aktivität läuft,
 * `zu` wenn der nächste Schritt noch blockiert ist (Klick springt trotzdem zum offenen Schritt),
 * `weiter` wenn alles bereit ist (pulsiert), sonst `bereit`.
 */
export function bestimmeTaktgeberZustand(
  statusClass: string,
  activities: FoundationActivityItem[],
  gesperrt?: boolean,
): TaktgeberZustand {
  // `gesperrt` ausdrücklich false: Hintergrund-Aktivitäten (Live-Sync, KI-Vorschau, Liga-Aufbau) sperren den Knopf nicht.
  if (gesperrt !== false && (gesperrt === true || activities.some((activity) => activity.tone === "running"))) return "laeuft";
  if (statusClass.includes("is-blocked")) return "zu";
  if (statusClass.includes("is-ready")) return "weiter";
  return "bereit";
}

export default function FoundationTaktgeber({ label, title, statusClass, onClick, busy = false, activities, gesperrt = false, istGlobal = false, plan = LEERER_TAKT_PLAN }: FoundationTaktgeberProps) {
  const ablauf = useSyncExternalStore(abonniereTaktAblauf, getTaktAblaufOffen, () => false);
  const setAblauf = (wert: boolean | ((alt: boolean) => boolean)) =>
    setTaktAblaufOffen(typeof wert === "function" ? wert(getTaktAblaufOffen()) : wert);
  const kritisch = plan.kritisch.length;
  const wurzel = useRef<HTMLDivElement | null>(null);
  const zustand = busy ? "laeuft" : bestimmeTaktgeberZustand(kritisch > 0 ? "is-blocked" : statusClass, activities, gesperrt);
  const laufend = activities.find((activity) => activity.tone === "running") ?? null;
  const pct =
    laufend?.progressPct != null && Number.isFinite(laufend.progressPct)
      ? Math.max(0, Math.min(100, Math.round(laufend.progressPct)))
      : null;

  const klickRef = useRef(onClick);
  klickRef.current = onClick;
  const zustandRef = useRef(zustand);
  zustandRef.current = zustand;
  const planRef = useRef(plan);
  planRef.current = plan;
  /**
   * EINE Auslösung für Klick UND Leertaste. Bleibt nach dem Auslösen alles gleich (Adresse unverändert, nichts offen), tat der
   * Knopf für den Spieler „nichts“ — dann zeigt der Taktgeber den Ablauf mit dem, was hier noch zu erledigen ist. Im Zustand „zu“
   * ohne kritische Punkte (z. B. Draft „Spieler wählen“) erklärt er per Ablauf-Text, warum es noch nicht weitergeht.
   */
  const ausloesenRef = useRef(() => {});
  ausloesenRef.current = () => {
    const vorher = typeof window !== "undefined" ? window.location.href : "";
    klickRef.current();
    if (zustandRef.current === "zu" && planRef.current.kritisch.length === 0) {
      setTaktAblaufOffen(true);
      return;
    }
    if (istGlobal && typeof window !== "undefined") {
      window.setTimeout(() => {
        if (window.location.href === vorher && !getTaktAblaufOffen() && zustandRef.current !== "laeuft") setTaktAblaufOffen(true);
      }, 600);
    }
  };
  useEffect(() => {
    setzeTaktRegistrierung({
      ausloesen: () => ausloesenRef.current(),
      kritisch: plan.kritisch.length,
      springeZumKritischen: plan.kritisch[0]?.sprung ?? null,
      gesperrt: zustand === "laeuft",
    });
  });
  useEffect(() => () => setzeTaktRegistrierung(null), []);

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
      ? `Aktion läuft · ${busy ? label : laufend?.currentLabel ?? laufend?.label ?? ""}`.replace(/ · $/, "")
      : zustand === "zu"
        ? `Hält auf · ${kritisch > 0 ? `${kritisch} kritisch` : "offener Schritt"} · Leertaste zeigt es`
        : zustand === "weiter"
          ? "Bereit zum Weiter · Leertaste"
          : "Bereit · Leertaste";

  return (
    <div className={`foundation-takt is-${zustand}`} data-testid="foundation-takt" data-takt-state={zustand} ref={wurzel}>
      <button
        type="button"
        className={`foundation-takt-knopf foundation-global-next-button ${statusClass}`}
        data-testid="foundation-global-next-button"
        onClick={() => ausloesenRef.current()}
        title={title}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {zustand === "laeuft" && pct != null ? (
          <i className="foundation-takt-fuell" style={{ width: `${pct}%` }} aria-hidden="true" />
        ) : null}
        <span>{zustand === "laeuft" ? "Aktion läuft" : "Weiter"}</span>
        {busy ? <strong>{label}</strong> : zustand === "laeuft" ? pct != null ? <strong>{pct} %</strong> : null : <strong>{label}</strong>}
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
        {plan.schritte.length > 0 ? (
          <>
            {/* Erledigtes kostet keine Zeilen: eine Zeile „n Schritte erledigt“, aufklappbar. So passt der Ablauf in den Bildschirm. */}
            {plan.schritte.filter((x) => x.status === "erledigt").length > 0 ? (
              <details className="foundation-takt-erledigt" data-testid="foundation-takt-erledigt">
                <summary>
                  <span className="foundation-takt-haken" aria-hidden="true">{SCHRITT_ZEICHEN.erledigt}</span>
                  {plan.schritte.filter((x) => x.status === "erledigt").length} Schritte erledigt
                </summary>
                <ol className="foundation-takt-schritte">
                  {plan.schritte.filter((x) => x.status === "erledigt").map((schritt) => (
                    <li key={schritt.id} className="foundation-takt-schritt is-erledigt">
                      <span className="foundation-takt-haken" aria-hidden="true">{SCHRITT_ZEICHEN[schritt.status]}</span>
                      <span className="foundation-takt-schritt-text"><b>{schritt.label}</b></span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            <ol className="foundation-takt-schritte" data-testid="foundation-takt-schritte">
              {plan.schritte.filter((x) => x.status !== "erledigt").map((schritt) => (
                <li key={schritt.id} className={`foundation-takt-schritt is-${schritt.status}`}>
                  <span className="foundation-takt-haken" aria-hidden="true">{SCHRITT_ZEICHEN[schritt.status]}</span>
                  <span className="foundation-takt-schritt-text">
                    <b>{schritt.label}</b>
                    {schritt.detail ? <small>{schritt.detail}</small> : null}
                    {schritt.warum ? <small className="foundation-takt-warum">{schritt.warum}</small> : null}
                  </span>
                  {schritt.sprung ? (
                    <button
                      type="button"
                      className="foundation-takt-sprung"
                      onClick={() => {
                        setAblauf(false);
                        schritt.sprung?.();
                      }}
                    >
                      {schritt.status === "rot" ? "beheben ›" : "öffnen ›"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="foundation-takt-ablauf-leer">{title ?? "Keine laufenden Aktionen."}</p>
        )}
        <p className="foundation-takt-ablauf-hinweis">
          {kritisch > 0 ? "Rot hält den Spieltag auf: Leertaste noch einmal springt zum ersten roten Punkt." : "Gelb hält nicht auf. Leertaste geht zum nächsten Schritt."}
        </p>
        {activities.some((a) => a.tone !== "success" && a.tone !== "info") ? <FoundationActivityStrip activities={activities} /> : null}
      </div>
    </div>
  );
}
