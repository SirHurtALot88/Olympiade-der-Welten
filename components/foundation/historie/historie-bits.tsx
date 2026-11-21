"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { HistorieTeamSaison } from "@/lib/foundation/historie-modern";

import "./historie-modern.css";

/** Zahl mit Komma, `null` → „—". */
export function fmtZahl(wert: number | null | undefined, stellen = 1): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  return wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

/** Geld in C ohne Einheit. */
export function fmtC(wert: number | null | undefined, stellen = 1): string {
  return fmtZahl(wert, stellen);
}

/** Vorzeichen-Zahl: „+2,0", „−0,7"; Null als „0,0". */
export function fmtVz(wert: number | null | undefined, stellen = 1): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  const text = Math.abs(wert).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  return `${wert > 0 ? "+" : wert < 0 ? "−" : ""}${text}`;
}

/** Vorzeichen-Geld mit Farbe (grün/rot), Einheit C. */
export function Cv({ wert, einheit = true }: { wert: number | null | undefined; einheit?: boolean }) {
  if (wert == null || !Number.isFinite(wert)) return <span className="null" style={{ color: "var(--stumm)" }}>—</span>;
  const farbe = wert > 0 ? "var(--gut)" : wert < 0 ? "var(--warn)" : undefined;
  return (
    <span style={farbe ? { color: farbe } : undefined}>
      {fmtVz(wert)}
      {einheit ? " C" : ""}
    </span>
  );
}

export function Wappen({ teamId, name, klein = true }: { teamId: string; name: string; klein?: boolean }) {
  return (
    <OptimizedMediaImage
      src={getTeamLogoBrowserUrl(teamId, null)}
      alt={`${name} Wappen`}
      className={klein ? "lg k" : "lg"}
      loading="lazy"
      fallbackLabel={name.slice(0, 2).toUpperCase()}
    />
  );
}

/** Umschalter mit einer aktiven Option. */
export function Seg<T extends string>({
  optionen,
  wert,
  onWahl,
  ariaLabel,
}: {
  optionen: ReadonlyArray<{ id: T; label: ReactNode }>;
  wert: T;
  onWahl: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {optionen.map((option) => (
        <button
          key={option.id}
          type="button"
          className={wert === option.id ? "an" : undefined}
          aria-pressed={wert === option.id}
          onClick={() => onWahl(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Tabellenkopf; Eintraege mit `onKlick` sind sortierbar. */
export function ThZeile({
  spalten,
  raster,
}: {
  spalten: ReadonlyArray<{ text: ReactNode; links?: boolean; onKlick?: () => void; aktiv?: boolean; /** Aufsteigend sortiert (Pfeil nach oben). */ auf?: boolean }>;
  raster: string;
}) {
  return (
    <div className="th" style={{ gridTemplateColumns: raster }} role="row">
      {spalten.map((spalte, index) => (
        <span key={index} className={spalte.links ? "li" : undefined} role="columnheader">
          {spalte.onKlick ? (
            <button
              type="button"
              className={spalte.aktiv ? "an" : undefined}
              onClick={spalte.onKlick}
              title="Klick sortiert, nochmal klicken dreht die Richtung"
            >
              {spalte.text}
              {spalte.aktiv ? (spalte.auf ? " ▴" : " ▾") : ""}
            </button>
          ) : (
            spalte.text
          )}
        </span>
      ))}
    </div>
  );
}

export function LigaMarke({ liga }: { liga: number | null }) {
  if (liga == null) return null;
  return <span className={`tg ${liga === 1 ? "l1" : "l2"}`}>Liga {liga}</span>;
}

/** Marken einer Team-Saison: Meister / Meister Liga 2 / Aufstieg / Abstieg. */
export function ZeilenMarke({ zeile, mitText = true }: { zeile: HistorieTeamSaison; mitText?: boolean }) {
  if (zeile.meister) return <span className="tg voll2">{mitText ? "Meister" : "★"}</span>;
  if (zeile.meisterLiga2) return <span className="tg g">▲ {mitText ? "Meister Liga 2" : "M2"}</span>;
  if (zeile.aufstieg) return <span className="tg g">▲ {mitText ? "Aufstieg" : "auf"}</span>;
  if (zeile.abstieg) return <span className="tg w">▼ {mitText ? "Abstieg" : "ab"}</span>;
  return null;
}

export const leerStil: CSSProperties = { color: "var(--stumm)" };

/** Platz über beide Ligen als Text: 17 → „L2 · 1.", sonst „11.". */
export function positionText(position: number | null): string {
  if (position == null) return "—";
  return position > 16 ? `L2 · ${position - 16}.` : `L1 · ${position}.`;
}

/** Gesamtstaerke fuer Teams ohne Daten: nichts erfinden, Strich zeigen. */
export function Strich() {
  return <span style={leerStil}>—</span>;
}

export type BandKpi = { label: string; wert: ReactNode; klein?: ReactNode; ton?: "plus" | "minus" };

/** Kennzahlen im Seiten-Slot des Regiebands (Mockup: Kennzahlen im Band statt eigenem Seitenkopf). */
export function HistorieBandKpis({ items }: { items: readonly BandKpi[] }) {
  return (
    <FoundationBandSlot>
      <div className="hi-bandkpis" data-testid="historie-bandkpis">
        {items.map((item) => (
          <div key={item.label} className="hi-bk">
            <span className="hi-gk">{item.label}</span>
            <strong className={item.ton ? `hi-${item.ton}` : undefined}>
              {item.wert}
              {item.klein ? <small>{item.klein}</small> : null}
            </strong>
          </div>
        ))}
      </div>
    </FoundationBandSlot>
  );
}

const ENTWURF_BREITE_REM = 116;
const ENTWURF_HOEHE_REM = 67.5;

/**
 * Seitenwurzel der Historie: fuellt die Flaeche, die die Shell uebrig laesst, und skaliert die Wurzelgroesse mit
 * (Entwurfsmass 120 x 67,5 rem = 1920 x 1080 bei 16 px, abzueglich 4 rem Schiene) wie die Startseite
 * (useVolleFlaeche in HomeModern). Nichts scrollt auf Seitenebene; Listen scrollen in ihrer Karte.
 */
export function HistorieSeite({ className, testId, children }: { className: string; testId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messe = () => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        el.style.removeProperty("--hi-u");
        el.style.removeProperty("--hi-h");
        return;
      }
      const breite = el.parentElement?.clientWidth ?? window.innerWidth;
      const oben = el.getBoundingClientRect().top;
      const hoehe = Math.max(480, window.innerHeight - oben - 4);
      const u = Math.min(34, Math.max(12.5, Math.min(breite / ENTWURF_BREITE_REM, hoehe / ENTWURF_HOEHE_REM)));
      el.style.setProperty("--hi-u", `${u.toFixed(2)}px`);
      el.style.setProperty("--hi-h", `${Math.floor(hoehe)}px`);
      const ueber = document.documentElement.scrollHeight - window.innerHeight;
      if (ueber > 0) el.style.setProperty("--hi-h", `${Math.max(480, Math.floor(hoehe - ueber))}px`);
    };
    messe();
    const beobachter = new ResizeObserver(messe);
    if (el.parentElement) beobachter.observe(el.parentElement);
    window.addEventListener("resize", messe);
    return () => {
      beobachter.disconnect();
      window.removeEventListener("resize", messe);
    };
  }, []);
  return (
    <div ref={ref} className={`hist ${className}`} data-testid={testId}>
      {children}
    </div>
  );
}
