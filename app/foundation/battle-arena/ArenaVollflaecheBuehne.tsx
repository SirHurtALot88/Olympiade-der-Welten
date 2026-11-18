"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * ARENA-VOLLFLAECHE (Chris 18.11.: „Bau alle Screens so, dass sie möglichst viel vom Bildschirm
 * nutzen, und vor allem die Battle Arena … die braucht ja wirklich jeden cm Breite und Höhe" —
 * Hauptziel 4K-Monitor in 16:9, s. CLAUDE.md „Zielbildschirme").
 *
 * Hülle um den eingebetteten Motor (FoundationBattleArenaHost). Solange der Arena-Reiter (#p2) offen
 * ist, legt sie die Arena als feste Bühne über das ganze Fenster — links bis an die Navigation
 * (Seitenleiste oder Icon-Schiene, hier gemessen), oben bis an den Rand. App-Kopfzeilen, Breadcrumbs
 * und Statuskarten liegen darunter; eine 40-px-Leiste trägt Titel, Paarung, Zusatzknöpfe des Hosts und
 * den Schalter zurück in die Seite. Die Gestaltung steht in public/mockups/battle-mode.css
 * („ARENA-VOLLFLAECHE"), hier nur Messung und Zustand:
 *   --arena-links        linker Rand der Bühne (rechte Kante der Navigation)
 *   --arena-rechts-frei  Platz rechts oben für Anmelde-Badge und Fehler-Flagge des Hosts
 *   --arena-leiste-breite Breite der Leiste, damit die Reiterzeile des Motors nicht darunter läuft
 *   --arena-cv-breite    Breite der Leinwand: volle Bühnenbreite, außer die Höhe reicht nicht
 *
 * Reine Darstellung: Motor-Koordinaten, IDs und DOM-Reihenfolge des Motors bleiben unverändert; die
 * Leinwand zeichnet der Motor selbst scharf nach (leinwandScharf() in battle-mode.engine.js).
 */

/** Seitenverhältnis der Motor-Leinwand (#cv width="1240" height="470" in battle-mode.html). */
const LEINWAND_VERHAELTNIS = 1240 / 470;
/** Mindesthöhe für Ticker + Wertung unter dem Feld, bevor die Leinwand schmaler wird. */
const UNTEN_MIN_PX = 130;
/** Unter dieser Fenstergröße (Handy, sehr kleines Fenster) bleibt die Arena im Seitenfluss. */
const VOLLFLAECHE_MEDIA = "(min-width: 900px) and (min-height: 560px)";

/** Rechte Kante der App-Navigation, wenn sie links senkrecht steht; sonst 0. */
export function messeNavigationsKante(doc: Document = document): number | null {
  const leiste = doc.querySelector<HTMLElement>(".foundation-sidebar");
  if (!leiste) return 0;
  // Ausgefahrene Icon-Schiene (Hover) liegt nur kurz als Überlagerung darüber — nicht nachziehen.
  if (leiste.getAttribute("data-rail") === "open") return null;
  const r = leiste.getBoundingClientRect();
  if (r.width <= 0 || r.height < 200 || r.width > 640) return 0;
  return Math.max(0, Math.round(r.right));
}

/** Breite, die Anmelde-Badge und Fehler-Flagge oben rechts belegen (beide position:fixed). */
export function messeRechtsFrei(doc: Document = document, fensterBreite = window.innerWidth): number {
  let links = fensterBreite;
  for (const sel of [".oly-auth-status-badge", ".oly-bug-report-flag"]) {
    const el = doc.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.top < 40) links = Math.min(links, r.left);
  }
  return links < fensterBreite ? Math.ceil(fensterBreite - links + 8) : 0;
}

/**
 * Breite der Leinwand in der Bühne: volle Breite von .arenaHaupt, außer die Höhe reicht nicht —
 * dann so breit, dass Feld + übrige Zeilen + Mindesthöhe für Ticker/Wertung in den Rahmen passen.
 */
export function berechneLeinwandBreite(args: {
  hauptBreite: number;
  rahmenHoehe: number;
  andereZeilenHoehe: number;
  untenMin?: number;
}): number {
  const untenMin = args.untenMin ?? UNTEN_MIN_PX;
  const verfuegbar = args.rahmenHoehe - args.andereZeilenHoehe - untenMin;
  const ausHoehe = verfuegbar * LEINWAND_VERHAELTNIS;
  return Math.floor(Math.max(320, Math.min(args.hauptBreite, ausHoehe)));
}

export default function ArenaVollflaecheBuehne({
  titel,
  paarung,
  istSpieltag = false,
  zusatz,
  seiteHervorheben = false,
  children,
}: {
  titel: ReactNode;
  paarung?: ReactNode;
  istSpieltag?: boolean;
  /** Zusatzknöpfe des Hosts in der Leiste (z. B. Quick-Sim der Spieltags-Ansicht). */
  zusatz?: ReactNode;
  /** Spiel zu Ende: der Weg zurück in die Seite (Wertung, nächste Disziplin) wird zum Hauptknopf. */
  seiteHervorheben?: boolean;
  children: ReactNode;
}) {
  const buehneRef = useRef<HTMLDivElement | null>(null);
  const leisteRef = useRef<HTMLDivElement | null>(null);
  // Bewusst NICHT gespeichert: die Arena oeffnet immer als Vollflaeche (Chris' Ziel); „Seite" gilt nur,
  // solange diese Ansicht offen ist — etwa um nach dem Spiel an Spieltagsauswahl und Wertung zu kommen.
  const [vorliebe, setVorliebe] = useState(true);
  const [grossGenug, setGrossGenug] = useState(false);
  const [arenaReiter, setArenaReiter] = useState(false);
  const voll = vorliebe && grossGenug && arenaReiter;

  useEffect(() => {
    const mq = window.matchMedia(VOLLFLAECHE_MEDIA);
    const pruefe = () => setGrossGenug(mq.matches);
    pruefe();
    mq.addEventListener("change", pruefe);
    return () => mq.removeEventListener("change", pruefe);
  }, []);

  // Welcher Motor-Reiter offen ist, entscheidet der Motor selbst (hidden an #p1/#p2/#p3) — beobachten
  // statt nachbauen. Auch der Neuaufbau des Motors (Team-Wechsel) kommt hier als childList an.
  useEffect(() => {
    const buehne = buehneRef.current;
    if (!buehne) return;
    const lies = () => {
      const p2 = buehne.querySelector<HTMLElement>(".oly-battle-arena #p2");
      setArenaReiter(!!p2 && !p2.hidden);
    };
    lies();
    const beobachter = new MutationObserver(lies);
    beobachter.observe(buehne, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
    return () => beobachter.disconnect();
  }, []);

  const messen = useCallback(() => {
    const buehne = buehneRef.current;
    if (!buehne) return;
    const wurzel = buehne.querySelector<HTMLElement>(".oly-battle-arena");
    if (!voll) {
      wurzel?.style.removeProperty("--arena-cv-breite");
      return;
    }
    const kante = messeNavigationsKante();
    if (kante != null) buehne.style.setProperty("--arena-links", `${kante > 0 ? kante + 8 : 0}px`);
    const rechtsFrei = messeRechtsFrei();
    buehne.style.setProperty("--arena-rechts-frei", `${rechtsFrei}px`);
    const leiste = leisteRef.current;
    if (leiste) buehne.style.setProperty("--arena-leiste-breite", `${Math.ceil(leiste.offsetWidth + rechtsFrei + 12)}px`);
    const rahmen = wurzel?.querySelector<HTMLElement>("#p2 .frame");
    const haupt = rahmen?.querySelector<HTMLElement>(":scope > .arenaHaupt");
    const raum = haupt?.querySelector<HTMLElement>(":scope > .arenaraum");
    if (!wurzel || !rahmen || !haupt || !raum || raum.offsetHeight === 0) return;
    const unten = rahmen.querySelector<HTMLElement>(":scope > .untenraum");
    const breite = berechneLeinwandBreite({
      hauptBreite: haupt.clientWidth,
      rahmenHoehe: rahmen.clientHeight,
      andereZeilenHoehe: haupt.offsetHeight - raum.offsetHeight,
      untenMin: unten && unten.offsetParent !== null ? UNTEN_MIN_PX : 0,
    });
    const alt = wurzel.style.getPropertyValue("--arena-cv-breite");
    if (alt !== `${breite}px`) wurzel.style.setProperty("--arena-cv-breite", `${breite}px`);
  }, [voll]);

  // Nachmessen bei jeder Größenänderung von Fenster, Navigation, Rahmen und Kopf-/Fußzeilen der Arena
  // (Zeilen wie Zeitfahr-Fokus oder HUD-Dock erscheinen je Disziplin). In einem Bild gebündelt.
  useLayoutEffect(() => {
    let bild = 0;
    const planen = () => {
      if (bild) return;
      bild = window.requestAnimationFrame(() => {
        bild = 0;
        messen();
      });
    };
    messen();
    if (!voll) return;
    const buehne = buehneRef.current;
    const groesse = new ResizeObserver(planen);
    const beobachteZiele = () => {
      groesse.disconnect();
      const ziele = [
        buehne,
        document.querySelector(".foundation-sidebar"),
        buehne?.querySelector("#p2 .frame"),
        buehne?.querySelector("#p2 .arenaHaupt"),
        leisteRef.current,
      ];
      for (const ziel of ziele) if (ziel) groesse.observe(ziel);
    };
    beobachteZiele();
    const aufbau = new MutationObserver(() => {
      beobachteZiele();
      planen();
    });
    if (buehne) aufbau.observe(buehne, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    const leiste = document.querySelector(".foundation-sidebar");
    const schiene = new MutationObserver(planen);
    if (leiste) schiene.observe(leiste, { attributes: true, attributeFilter: ["data-rail"] });
    window.addEventListener("resize", planen);
    // Die Seite dahinter soll nicht unter der Bühne mitscrollen.
    const html = document.documentElement;
    const vorher = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      if (bild) window.cancelAnimationFrame(bild);
      groesse.disconnect();
      aufbau.disconnect();
      schiene.disconnect();
      window.removeEventListener("resize", planen);
      html.style.overflow = vorher;
    };
  }, [voll, messen]);

  const umschalten = (an: boolean) => setVorliebe(an);

  return (
    <div
      ref={buehneRef}
      className="oly-arena-buehne"
      data-voll={voll ? "1" : "0"}
      data-arena-reiter={arenaReiter ? "1" : "0"}
      data-spieltag={istSpieltag ? "1" : "0"}
      data-testid="oly-arena-buehne"
    >
      <div ref={leisteRef} className="oly-arena-buehne-leiste" role="toolbar" aria-label="Arena-Leiste" hidden={!voll}>
        <span className="oly-arena-buehne-titel">{titel}</span>
        {paarung ? <span className="oly-arena-buehne-paarung">{paarung}</span> : null}
        {istSpieltag ? <span className="oly-arena-buehne-luecke" /> : null}
        {zusatz}
        <button
          type="button"
          className={seiteHervorheben ? "ist-akzent" : undefined}
          data-testid="oly-arena-vollflaeche-aus"
          onClick={() => umschalten(false)}
          title="Arena zurück in die Seite legen (App-Kopf, Spieltagsauswahl und Hinweise wieder sichtbar)"
        >
          {seiteHervorheben ? "⤓ Zur Seite (Wertung)" : "⤓ Seite"}
        </button>
      </div>
      {grossGenug && !vorliebe ? (
        <div className="oly-arena-buehne-zurueck">
          <button
            type="button"
            data-testid="oly-arena-vollflaeche-an"
            onClick={() => umschalten(true)}
            title="Arena über das ganze Fenster legen"
          >
            ⤢ Vollfläche
          </button>
        </div>
      ) : null}
      <div className="oly-arena-buehne-koerper">{children}</div>
    </div>
  );
}
