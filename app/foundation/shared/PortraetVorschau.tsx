"use client";

/**
 * Hover-Vorschau aufs Porträt (Chris 19.11.): großes Bild als schwebende Karte neben der Zeile, dazu Name, Klasse, Rasse
 * und POW/SPE/MEN/SOC genau so, wie die Zeile sie zeigt (Scouting-Nebel: Zweier-Gruppen und "?" bleiben, nichts Exaktes
 * für Ungescoutete). Keine PP. Verzögerung ~250 ms, `pointer-events:none` (kein Flackern, ändert die Auswahl nicht).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import KlassenFarbTag from "@/app/foundation/KlassenFarbTag";
import "./portraet-vorschau.css";

export type VorschauAchse = { label: string; anzeige: string | null; exakt: boolean; stufe?: "h" | "m" | "" };
export type VorschauDaten = {
  bild: string | null;
  name: string;
  klasse: string | null | undefined;
  rasse: string | null | undefined;
  achsen: VorschauAchse[];
};

export const VORSCHAU_VERZOEGERUNG_MS = 250;

export type Offen = { daten: VorschauDaten; anker: DOMRect };

export function usePortraetVorschau(): { zeige: (el: Element, daten: VorschauDaten) => void; verstecke: () => void; karte: ReactNode } {
  const [offen, setOffen] = useState<Offen | null>(null);
  const timer = useRef<number | null>(null);
  const loesche = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const zeige = useCallback((el: Element, daten: VorschauDaten) => {
    loesche();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (el.isConnected) setOffen({ daten, anker: el.getBoundingClientRect() });
    }, VORSCHAU_VERZOEGERUNG_MS);
  }, []);
  const verstecke = useCallback(() => {
    loesche();
    setOffen(null);
  }, []);
  useEffect(() => {
    const zu = () => {
      loesche();
      setOffen(null);
    };
    window.addEventListener("scroll", zu, true);
    window.addEventListener("blur", zu);
    return () => {
      window.removeEventListener("scroll", zu, true);
      window.removeEventListener("blur", zu);
      loesche();
    };
  }, []);
  const karte = offen && typeof document !== "undefined" ? createPortal(<VorschauKarte offen={offen} />, document.body) : null;
  return { zeige, verstecke, karte };
}

export function VorschauKarte({ offen }: { offen: Offen }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const { daten, anker } = offen;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = el.offsetWidth;
    const h = el.offsetHeight;
    const rand = 8;
    const abstand = 12;
    let left = anker.right + abstand;
    if (left + b > window.innerWidth - rand) left = Math.max(rand, anker.left - abstand - b);
    let top = anker.top + anker.height / 2 - h / 2;
    top = Math.max(rand, Math.min(top, window.innerHeight - h - rand));
    setPos({ left, top });
  }, [anker, daten]);
  return (
    <div ref={ref} className="pv-karte" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }} data-testid="portraet-vorschau" role="tooltip">
      {daten.bild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pv-bild" src={daten.bild} alt="" data-testid="portraet-vorschau-bild" />
      ) : (
        <div className="pv-bild pv-leer" />
      )}
      <div className="pv-text">
        <b className="pv-name">{daten.name}</b>
        <span className="pv-sub">
          <KlassenFarbTag className={daten.klasse} />
          {daten.rasse ? <em>{daten.rasse}</em> : null}
        </span>
        <div className="pv-ax" data-testid="portraet-vorschau-achsen">
          {daten.achsen.map((a) => (
            <div key={a.label} className={`pv-a${a.exakt ? "" : " nb"}${a.stufe ? ` ${a.stufe}` : ""}`}>
              <small>{a.label}</small>
              <b>{a.anzeige ?? "?"}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
