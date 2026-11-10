"use client";

/**
 * EINSATZLISTE EBENE A + B — Mini-Feld und Rollenkarte.
 *
 * Bauplan: `docs/design/einsatzliste-gesamtkonzept-visuell-08-11.md` (Fable), Abschnitte 2, 3, 7, 9.
 * Datenquelle: `lib/lineups/formation/` (Formations-Geometrie, Drift-Wächter gegen den Motor).
 *
 * Reine Darstellung. Alle Handlungen laufen über die Handler, die `LineupNewLook.tsx` ohnehin hat
 * (`onActiveSlotChange`, Drag & Drop, `onAssignPlayer`) — kein neuer Schreibpfad, kein Rückweg in
 * Resolve oder Arena. Der Renderer kennt keine Disziplin: er zeichnet den Hintergrund nach
 * `feld` und setzt Marken an `x/y`. Das Aussehen der Marke hängt an `verbindlichkeit`.
 */
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, ReactNode } from "react";

import type { Glyphe } from "@/lib/lineups/einsatzliste-anzeige";
import { attributKuerzel, glyphenTon, slotFarbe } from "@/lib/lineups/einsatzliste-anzeige";
import type { FeldArt, GelegteFormation, GelegterPlatz, Verbindlichkeit } from "@/lib/lineups/formation/formation-registry";

export type MiniFeldMarke = {
  slotKey: string;
  slotIndex: number;
  kuerzel: string;
  rollenLabel: string;
  spielerId: string | null;
  spielerName: string | null;
  wert: number | null;
  glyphe: Glyphe | null;
  gold: "voll" | "verschenkt" | null;
  goldTitel: string | null;
  vorschlag: { name: string; wert: number | null } | null;
  kapitaen: boolean;
  warnung: string | null;
  aktiv: boolean;
  naechster: boolean;
};

export type MiniFeldGeist = { slotIndex: number; name: string | null; spanne: { min: number; max: number } | null };

const VERBINDLICHKEIT_TEXT: Record<Verbindlichkeit, string> = {
  motor: "Der Motor hält diesen Platz.",
  start: "Startort — danach entscheidet der Motor, wohin er läuft.",
  darstellung: "Darstellung — der Motor liest hier keinen Platz.",
};

const fmt = (wert: number | null | undefined, stellen = 1) =>
  wert == null || !Number.isFinite(wert) ? "—" : wert.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

/** Feld-Koordinate (0..1) → Prozent im Rahmen, mit Innenabstand, damit Randmarken nicht abgeschnitten werden. */
const px = (x: number) => 5 + x * 90;
const py = (y: number) => 9 + y * 82;

function GlyphenChip({ glyphe }: { glyphe: Glyphe }) {
  return <span className={`nl-feld-glyphe is-${glyphenTon(glyphe)}`}>{glyphe}</span>;
}

/** Seite, auf der die Bubble gegenüber dem Auslöser aufgeht. */
type NlTipRichtung = "unten" | "oben" | "rechts" | "links";

/**
 * ERKLÄR-TOOLTIP (Paket F4, Chris 08.11.: „beim Hovern die Erklärungen"; Korrektur 1a: „bevorzugt
 * unten oder neben dem Auslöser, nicht über ihm" — im Screenshot verdeckte die above-Bubble die
 * Überschrift „Attribute in dieser Rolle" und wirkte dem Auslöser nicht zugeordnet). Ersetzt
 * natives `title=` an Stellen, die auf den ersten Blick dicht bleiben sollen (±-Attribute,
 * Verbindlichkeits-Badges, Besetzt-Zeile). Natives title kommt verzögert, bricht nicht um und
 * wirkt im dunklen Theme wie ein Systemdialog statt wie ein Teil der Oberfläche.
 *
 * - Hover UND Tastaturfokus öffnen (kein `:hover`-only CSS) — die sichtbare Fläche ist selbst der
 *   Trigger (`tabIndex=0`), die Erklärung hängt per `aria-describedby` daran, nicht an `title`.
 * - Clamping statt Positionierungs-Bibliothek: nach dem Öffnen wird die Bubble gemessen.
 *   Primäre Richtung ist UNTEN (passt fast immer und verdeckt nie etwas, das über dem Auslöser
 *   steht). Passt unten nicht in den Viewport, weicht sie seitlich aus (rechts, sonst links —
 *   verdeckt dabei nie den Auslöser selbst). Erst wenn auch seitlich kein Platz ist, geht sie
 *   OBEN auf (letzter Ausweg, nicht die Vorgabe). Quer zur gewählten Richtung bleibt das alte
 *   Zurückschieben in den Viewport erhalten. Ein reiner CSS-Pfeil (Dreieck via `border`) zeigt
 *   von der Bubble auf den Auslöser, in jeder der vier Richtungen.
 */
function NlTooltip({ label, children, block }: { label: ReactNode; children: ReactNode; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const bubbleId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ dx: number; dy: number; richtung: NlTipRichtung }>({ dx: 0, dy: 0, richtung: "unten" });

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;
    const wrap = wrapRef.current;
    const bubble = bubbleRef.current;
    if (!wrap || !bubble) return;
    const rand = 8;
    const wrapRect = wrap.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    const platzUnten = window.innerHeight - wrapRect.bottom - rand;
    const platzOben = wrapRect.top - rand;
    const platzRechts = window.innerWidth - wrapRect.right - rand;
    const platzLinks = wrapRect.left - rand;

    let richtung: NlTipRichtung;
    if (bubbleRect.height + rand <= platzUnten) richtung = "unten";
    else if (bubbleRect.width + rand <= platzRechts) richtung = "rechts";
    else if (bubbleRect.width + rand <= platzLinks) richtung = "links";
    else if (platzOben > platzUnten) richtung = "oben";
    else richtung = "unten";

    let dx = 0;
    let dy = 0;
    if (richtung === "unten" || richtung === "oben") {
      const linksRoh = wrapRect.left + wrapRect.width / 2 - bubbleRect.width / 2;
      const rechtsRoh = linksRoh + bubbleRect.width;
      if (linksRoh < rand) dx = rand - linksRoh;
      else if (rechtsRoh > window.innerWidth - rand) dx = window.innerWidth - rand - rechtsRoh;
    } else {
      const obenRoh = wrapRect.top + wrapRect.height / 2 - bubbleRect.height / 2;
      const untenRoh = obenRoh + bubbleRect.height;
      if (obenRoh < rand) dy = rand - obenRoh;
      else if (untenRoh > window.innerHeight - rand) dy = window.innerHeight - rand - untenRoh;
    }

    setPos((prev) => (prev.dx === dx && prev.dy === dy && prev.richtung === richtung ? prev : { dx, dy, richtung }));
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`nl-tip${block ? " is-block" : ""}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? bubbleId : undefined}
    >
      {children}
      {open ? (
        <span
          ref={bubbleRef}
          id={bubbleId}
          role="tooltip"
          className={`nl-tip-bubble is-${pos.richtung}`}
          style={{ "--nl-tip-dx": `${pos.dx}px`, "--nl-tip-dy": `${pos.dy}px` } as CSSProperties}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

/** Hintergrund je Feldart. Ein kleines SVG, kein Bild — die Vignetten aus den Kulissen sind Paket 0 (offen). */
function FeldHintergrund({ formation, hoehe }: { formation: GelegteFormation; hoehe: number }): ReactNode {
  const W = 1000;
  const H = hoehe;
  const X = (x: number) => (px(x) / 100) * W;
  const Y = (y: number) => (py(y) / 100) * H;
  const def = formation.definition;
  const linie = "var(--nl-feld-linie)";
  const linieStark = "var(--nl-feld-linie-stark)";
  const feld: FeldArt = def.feld;
  const teile: ReactNode[] = [];
  switch (feld) {
    case "reihen": {
      teile.push(<line key="mitte" x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={linieStark} strokeWidth={3} strokeDasharray="10 8" />);
      for (const etikett of formation.etiketten) {
        teile.push(<rect key={`band-${etikett.label}-${etikett.gespiegelt}`} x={X(etikett.x) - 48} y={Y(-0.05)} width={96} height={Y(1.05) - Y(-0.05)} rx={14} fill="var(--nl-feld-band)" />);
      }
      break;
    }
    case "domination": {
      for (const y of [0.2, 0.5, 0.8]) {
        teile.push(<circle key={`kp-${y}`} cx={X(0.5)} cy={Y(y)} r={H * 0.11} fill="var(--nl-feld-band)" stroke={linieStark} strokeWidth={2} />);
      }
      teile.push(<line key="weg" x1={X(0.5)} y1={Y(0.2)} x2={X(0.5)} y2={Y(0.8)} stroke={linie} strokeWidth={2} strokeDasharray="6 8" />);
      break;
    }
    case "halbfeld": {
      const korb = def.ziel ?? { x: 0.07, y: 0.5 };
      teile.push(<rect key="zone" x={X(korb.x) - 4} y={Y(0.33)} width={X(0.36) - X(korb.x)} height={Y(0.67) - Y(0.33)} fill="var(--nl-feld-band)" stroke={linie} strokeWidth={2} />);
      teile.push(<ellipse key="frei" cx={X(0.36)} cy={Y(0.5)} rx={H * 0.12} ry={H * 0.12} fill="none" stroke={linie} strokeWidth={2} />);
      teile.push(<path key="dreier" d={`M ${X(korb.x)} ${Y(0.035)} L ${X(0.2)} ${Y(0.035)} A ${X(0.56) - X(0.2)} ${(Y(0.965) - Y(0.035)) / 2} 0 0 1 ${X(0.2)} ${Y(0.965)} L ${X(korb.x)} ${Y(0.965)}`} fill="none" stroke={linieStark} strokeWidth={2.5} />);
      teile.push(<circle key="korb" cx={X(korb.x)} cy={Y(korb.y)} r={9} fill="none" stroke="var(--nl-warn)" strokeWidth={3} />);
      teile.push(<line key="mittellinie" x1={X(1.03)} y1={0} x2={X(1.03)} y2={H} stroke={linieStark} strokeWidth={3} />);
      break;
    }
    case "eis": {
      const tor = def.ziel ?? { x: 0.055, y: 0.5 };
      teile.push(<path key="torraum" d={`M ${X(tor.x)} ${Y(0.38)} A ${H * 0.13} ${H * 0.13} 0 0 1 ${X(tor.x)} ${Y(0.62)}`} fill="var(--nl-feld-band)" stroke={linie} strokeWidth={2} />);
      teile.push(<rect key="tor" x={X(tor.x) - 12} y={Y(0.45)} width={12} height={Y(0.55) - Y(0.45)} fill="none" stroke="var(--nl-risk)" strokeWidth={3} />);
      teile.push(<line key="blau" x1={X(0.79)} y1={0} x2={X(0.79)} y2={H} stroke="var(--nl-feld-blau)" strokeWidth={6} />);
      teile.push(<line key="rot" x1={X(1.03)} y1={0} x2={X(1.03)} y2={H} stroke="var(--nl-risk)" strokeWidth={4} opacity={0.7} />);
      for (const y of [0.22, 0.78]) teile.push(<circle key={`bully-${y}`} cx={X(0.2)} cy={Y(y)} r={H * 0.09} fill="none" stroke={linie} strokeWidth={2} />);
      break;
    }
    case "football": {
      for (let i = 0; i <= 10; i += 1) teile.push(<line key={`yard-${i}`} x1={(W * i) / 10} y1={0} x2={(W * i) / 10} y2={H} stroke={linie} strokeWidth={i % 5 === 0 ? 2.5 : 1.2} />);
      teile.push(<line key="scrimmage" x1={X(0.66)} y1={0} x2={X(0.66)} y2={H} stroke="var(--nl-feld-blau)" strokeWidth={5} />);
      teile.push(<rect key="seite" x={X(0.02)} y={Y(0.02)} width={X(0.24) - X(0.02)} height={Y(0.34) - Y(0.02)} rx={10} fill="var(--nl-feld-band)" stroke={linie} strokeDasharray="6 6" />);
      break;
    }
    case "strecke": {
      teile.push(<rect key="bahn" x={0} y={Y(0.02)} width={W} height={Y(0.98) - Y(0.02)} fill="var(--nl-feld-band)" />);
      teile.push(<line key="trenn" x1={0} y1={H / 2 + 2} x2={W} y2={H / 2 + 2} stroke={linieStark} strokeWidth={2} strokeDasharray="12 10" />);
      teile.push(<rect key="start" x={X(0.0) - 8} y={Y(0.02)} width={12} height={Y(0.98) - Y(0.02)} fill="var(--nl-warn)" opacity={0.65} />);
      teile.push(<rect key="ziel" x={X(1.0) - 4} y={Y(0.02)} width={12} height={Y(0.98) - Y(0.02)} fill="var(--nl-risk)" opacity={0.65} />);
      break;
    }
    case "wand": {
      teile.push(<rect key="wand" x={X(0.04)} y={Y(-0.06)} width={X(0.96) - X(0.04)} height={Y(1.02) - Y(-0.06)} rx={10} fill="var(--nl-feld-band)" />);
      teile.push(<line key="trenn" x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={linieStark} strokeWidth={2} strokeDasharray="10 8" />);
      teile.push(<line key="top" x1={X(0.04)} y1={Y(-0.04)} x2={X(0.96)} y2={Y(-0.04)} stroke="var(--nl-gold)" strokeWidth={3} />);
      for (let i = 0; i < 26; i += 1) {
        const x = 0.08 + ((i * 37) % 84) / 100;
        const y = 0.05 + ((i * 53) % 90) / 100;
        teile.push(<circle key={`griff-${i}`} cx={X(x)} cy={Y(y)} r={5} fill={linie} />);
      }
      break;
    }
    case "staffel": {
      teile.push(<rect key="bahn" x={0} y={Y(0.04)} width={W} height={Y(0.96) - Y(0.04)} rx={H * 0.2} fill="var(--nl-feld-band)" />);
      teile.push(<line key="trenn" x1={0} y1={H / 2 + 2} x2={W} y2={H / 2 + 2} stroke={linieStark} strokeWidth={2} strokeDasharray="12 10" />);
      const eigene = formation.plaetze;
      for (let i = 1; i < eigene.length; i += 1) {
        const a = eigene[i - 1]!;
        const b = eigene[i]!;
        const mx = (X(a.x) + X(b.x)) / 2;
        teile.push(<path key={`stab-${i}`} d={`M ${mx - 14} ${Y(a.y) - 4} L ${mx + 10} ${Y(a.y) - 4} L ${mx + 4} ${Y(a.y) - 12} M ${mx + 10} ${Y(a.y) - 4} L ${mx + 4} ${Y(a.y) + 4}`} fill="none" stroke="var(--nl-gold)" strokeWidth={3} strokeLinecap="round" />);
      }
      break;
    }
    case "leiste": {
      teile.push(<rect key="buehne" x={X(0.02)} y={Y(def.gegner === "keiner" ? 0.12 : 0.04)} width={X(0.98) - X(0.02)} height={(def.gegner === "keiner" ? Y(0.88) - Y(0.12) : Y(0.56) - Y(0.04))} rx={12} fill="var(--nl-feld-band)" />);
      if (def.gegner !== "keiner") teile.push(<line key="trenn" x1={X(0.02)} y1={H / 2 + 2} x2={X(0.98)} y2={H / 2 + 2} stroke={linieStark} strokeWidth={2} strokeDasharray="12 10" />);
      break;
    }
    case "bogen": {
      teile.push(<ellipse key="eis" cx={W / 2} cy={H / 2} rx={W * 0.47} ry={H * 0.46} fill="var(--nl-feld-band)" stroke={linie} strokeWidth={2} />);
      const p = formation.plaetze;
      if (p.length > 1) teile.push(<polyline key="bogen" points={p.map((q) => `${X(q.x)},${Y(q.y)}`).join(" ")} fill="none" stroke={linieStark} strokeWidth={2} strokeDasharray="4 8" />);
      break;
    }
    case "tafel": {
      teile.push(<rect key="tisch" x={X(0.02)} y={Y(0.3)} width={X(0.98) - X(0.02)} height={Y(0.7) - Y(0.3)} rx={18} fill="var(--nl-feld-band)" stroke={linie} strokeWidth={2} />);
      break;
    }
    case "ring": {
      const ring = def.ring ?? { x: 0.36, y: 0.5 };
      for (const x of [ring.x, 1 - ring.x]) teile.push(<circle key={`ring-${x}`} cx={X(x)} cy={Y(ring.y)} r={H * 0.3} fill="var(--nl-feld-band)" stroke="var(--nl-warn)" strokeWidth={2} opacity={0.9} />);
      teile.push(<line key="mitte" x1={W / 2} y1={Y(0.1)} x2={W / 2} y2={Y(0.9)} stroke={linieStark} strokeWidth={2} strokeDasharray="10 8" />);
      break;
    }
  }
  return (
    <svg className="nl-feld-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {teile}
    </svg>
  );
}

/** Wo das Etikett einer Gruppe steht — so, dass es nicht unter den Marken verschwindet. */
function etikettPosition(feld: FeldArt, etikett: GelegteFormation["etiketten"][number]): { x: number; y: number } | null {
  switch (feld) {
    case "reihen":
      return { x: etikett.x, y: -0.07 };
    case "strecke":
      return { x: etikett.x, y: etikett.gespiegelt ? 1.06 : -0.06 };
    case "domination":
      return { x: etikett.x - 0.33, y: etikett.y };
    case "wand":
      return etikett.gespiegelt ? null : { x: 0.5, y: etikett.y };
    case "halbfeld":
    case "eis":
    case "football":
      return null;
    default:
      return null;
  }
}

export function EinsatzlisteMiniFeld({
  seite,
  disziplinName,
  formation,
  marken,
  geister,
  geisterHinweis,
  besetzt,
  dnd,
  onSelect,
}: {
  seite: "d1" | "d2";
  disziplinName: string;
  formation: GelegteFormation;
  marken: MiniFeldMarke[];
  /** null = Gegner steht hier nicht auf dem Feld (Feldart ohne Gegenseite oder Schätzung unbekannt). */
  geister: MiniFeldGeist[] | null;
  /** Kurztext, wenn keine Einzel-Geister gezeigt werden können („Zu wenig gespäht“). */
  geisterHinweis: string | null;
  besetzt: number;
  dnd: {
    enabled: boolean;
    dragOverSlotKey: string | null;
    dragSourceSlotKey: string | null;
    onDragStart: (event: ReactDragEvent<HTMLElement>, slotKey: string, playerId: string) => void;
    onDragOver: (event: ReactDragEvent<HTMLElement>, slotKey: string) => void;
    onDragLeave: (slotKey: string) => void;
    onDrop: (event: ReactDragEvent<HTMLElement>, slotKey: string) => void;
    onDragEnd: () => void;
  };
  onSelect: (slotKey: string) => void;
}) {
  const def = formation.definition;
  const platzJeIndex = new Map<number, GelegterPlatz>(formation.plaetze.map((p) => [p.slotIndex, p]));
  const bedingungOffen = def.bedingung?.art === "alle-besetzt" && besetzt < marken.length;
  const hoehe = Math.round(1000 / def.seitenverhaeltnis);
  const hatGegnerseite = formation.plaetze.some((p) => p.gegner != null);
  const geisterPlaetze = formation.plaetze.filter((p) => p.gegner != null);
  const geisterMitte =
    geisterPlaetze.length > 0
      ? {
          x: geisterPlaetze.reduce((s, p) => s + p.gegner!.x, 0) / geisterPlaetze.length,
          y: geisterPlaetze.reduce((s, p) => s + p.gegner!.y, 0) / geisterPlaetze.length,
        }
      : null;
  const zaehlung = { motor: 0, start: 0, darstellung: 0 };
  for (const p of formation.plaetze) zaehlung[p.verbindlichkeit] += 1;

  return (
    <div className={`nl-feld is-feld-${def.feld}`} data-testid={`nl-lineup-minifeld-${seite}`} data-feld={def.feld} data-formation={def.disziplin}>
      <div className="nl-feld-kopf">
        <span className="nl-feld-kopfzeile">{def.kopfzeile}</span>
        <span className="nl-feld-legende" aria-label="Legende">
          {zaehlung.motor > 0 ? (
            <NlTooltip label={VERBINDLICHKEIT_TEXT.motor}>
              <i className="nl-feld-legende-punkt is-motor" aria-hidden="true" />Motor hält
            </NlTooltip>
          ) : null}
          {zaehlung.start > 0 ? (
            <NlTooltip label={VERBINDLICHKEIT_TEXT.start}>
              <i className="nl-feld-legende-punkt is-start" aria-hidden="true" />Startort
            </NlTooltip>
          ) : null}
          {zaehlung.darstellung > 0 ? (
            <NlTooltip label={VERBINDLICHKEIT_TEXT.darstellung}>
              <i className="nl-feld-legende-punkt is-darstellung" aria-hidden="true" />Darstellung
            </NlTooltip>
          ) : null}
          {hatGegnerseite && geister ? (
            <NlTooltip label="Gegner-Schätzung, nie exakt (Scouting-Stufe)">
              <i className="nl-feld-legende-punkt is-geist" aria-hidden="true" />Gegner (geschätzt)
            </NlTooltip>
          ) : null}
        </span>
      </div>
      {bedingungOffen ? (
        <p className="nl-feld-bedingung" role="note">
          {def.bedingung!.text} ({besetzt}/{marken.length} besetzt)
        </p>
      ) : null}
      <div
        className="nl-feld-flaeche"
        role="group"
        aria-label={`Mini-Feld ${seite.toUpperCase()} ${disziplinName}`}
        style={{ "--nl-feld-ratio": String(def.seitenverhaeltnis) } as CSSProperties}
      >
        <FeldHintergrund formation={formation} hoehe={hoehe} />
        {formation.etiketten.map((etikett, index) => {
          const pos = etikettPosition(def.feld, etikett);
          if (!pos) return null;
          return (
            <span key={`etikett-${index}`} className={`nl-feld-etikett${etikett.gespiegelt ? " is-gegner" : ""}`} style={{ left: `${px(pos.x)}%`, top: `${py(pos.y)}%` }}>
              {etikett.label}
            </span>
          );
        })}

        {geister
          ? geister.map((geist) => {
              const platz = platzJeIndex.get(geist.slotIndex);
              if (!platz?.gegner) return null;
              const farbe = slotFarbe(geist.slotIndex);
              return (
                <span
                  key={`geist-${geist.slotIndex}`}
                  className="nl-feld-geist"
                  style={{ left: `${px(platz.gegner.x)}%`, top: `${py(platz.gegner.y)}%`, "--nl-pos-farbe": farbe } as CSSProperties}
                  title={`Gegner (Schätzung) auf Position ${geist.slotIndex + 1}: ${geist.name ?? "unbekannt"}${geist.spanne ? ` · ${geist.spanne.min}–${geist.spanne.max} (rohe Eignung, nie exakt)` : ""}`}
                >
                  <span className="nl-feld-geist-name">{geist.name ?? "?"}</span>
                  {geist.spanne ? <span className="nl-tnum nl-feld-geist-spanne">{geist.spanne.min}–{geist.spanne.max}</span> : null}
                </span>
              );
            })
          : null}
        {!geister && geisterHinweis && hatGegnerseite && geisterMitte ? (
          <span className="nl-feld-geist is-wolke" style={{ left: `${px(geisterMitte.x)}%`, top: `${py(geisterMitte.y)}%` }} title={geisterHinweis}>
            <span className="nl-feld-geist-name">{geisterHinweis}</span>
          </span>
        ) : null}

        {marken.map((marke) => {
          const platz = platzJeIndex.get(marke.slotIndex);
          if (!platz) return null;
          const farbe = slotFarbe(marke.slotIndex);
          const leer = !marke.spielerName;
          const verbindlichkeit = bedingungOffen ? "darstellung" : platz.verbindlichkeit;
          const klassen = [
            "nl-feld-marke",
            `is-${verbindlichkeit}`,
            leer ? "is-leer" : "is-besetzt",
            marke.aktiv ? "is-aktiv" : "",
            marke.naechster ? "is-naechster" : "",
            marke.gold === "voll" ? "is-gold" : "",
            marke.gold === "verschenkt" ? "is-gold-verschenkt" : "",
            dnd.enabled && dnd.dragOverSlotKey === marke.slotKey ? "is-drag-over" : "",
            dnd.dragSourceSlotKey === marke.slotKey ? "is-dragging" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const titel = [
            `${seite.toUpperCase()}-${marke.slotIndex + 1} ${marke.rollenLabel}${platz.gruppenLabel ? ` · ${platz.gruppenLabel}` : ""}`,
            marke.spielerName ? `${marke.spielerName} · Slotwert ${fmt(marke.wert)}${marke.glyphe ? ` (${marke.glyphe})` : ""}` : marke.vorschlag ? `Frei — Vorschlag: ${marke.vorschlag.name} ${fmt(marke.vorschlag.wert)}` : "Frei",
            bedingungOffen ? def.bedingung!.text : VERBINDLICHKEIT_TEXT[platz.verbindlichkeit],
            marke.goldTitel,
            marke.warnung,
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <button
              key={marke.slotKey}
              type="button"
              className={klassen}
              style={{ left: `${px(platz.x)}%`, top: `${py(platz.y)}%`, "--nl-pos-farbe": farbe } as CSSProperties}
              title={titel}
              aria-label={titel.replace(/\n/g, ". ")}
              aria-pressed={marke.aktiv}
              data-slot-key={marke.slotKey}
              data-verbindlichkeit={verbindlichkeit}
              onClick={() => onSelect(marke.slotKey)}
              draggable={!leer && dnd.enabled && marke.spielerId ? true : undefined}
              onDragStart={!leer && marke.spielerId ? (event) => dnd.onDragStart(event, marke.slotKey, marke.spielerId!) : undefined}
              onDragEnd={!leer ? dnd.onDragEnd : undefined}
              onDragOver={(event) => dnd.onDragOver(event, marke.slotKey)}
              onDragLeave={() => dnd.onDragLeave(marke.slotKey)}
              onDrop={(event) => dnd.onDrop(event, marke.slotKey)}
            >
              <span className="nl-feld-marke-kopf">
                <span className="nl-feld-kuerzel">{marke.kuerzel}</span>
                <span className="nl-feld-marke-name">{marke.spielerName ?? "frei"}</span>
                {marke.kapitaen ? <span className="nl-feld-kapitaen">C</span> : null}
              </span>
              <span className="nl-feld-marke-fuss">
                {leer ? (
                  marke.vorschlag ? (
                    <span className="nl-feld-vorschlag">
                      → {marke.vorschlag.name} <span className="nl-tnum">{fmt(marke.vorschlag.wert)}</span>
                    </span>
                  ) : (
                    <span className="nl-feld-vorschlag">{marke.rollenLabel}</span>
                  )
                ) : (
                  <>
                    <span className="nl-tnum nl-feld-wert">{fmt(marke.wert)}</span>
                    {marke.glyphe ? <GlyphenChip glyphe={marke.glyphe} /> : null}
                    {marke.gold === "voll" ? <span className="nl-feld-raute" aria-hidden="true">◆</span> : null}
                  </>
                )}
              </span>
              {verbindlichkeit === "start" ? <span className="nl-feld-start" aria-hidden="true">↻</span> : null}
              {marke.warnung ? <span className="nl-feld-warnpunkt" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================================================
// EBENE B — ROLLENKARTE (rechts in der Fokus-Rail, Fable Abschnitt 7)
// ================================================================================================

export type RollenkarteAttribut = { key: string; label: string; delta: number; gewicht: number; glyphe: Glyphe; spielerWert: number | null };

export type RollenkarteDaten = {
  slotLabel: string;
  slotIndex: number;
  kuerzel: string;
  rollenLabel: string;
  beschreibung: string | null;
  platz: GelegterPlatz | null;
  attribute: RollenkarteAttribut[];
  besetzt: {
    name: string;
    wert: number | null;
    rollenAufschlag: number | null;
    glyphe: Glyphe | null;
    goldTitel: string | null;
    goldVerschenktTitel: string | null;
  } | null;
  alternativen: Array<{ id: string; name: string; wert: number | null; aktuell: boolean }>;
  /** Nur TDM / Mini-DM / Battlefield (Arena-Chassis mit Reglern), sonst null. */
  feinjustierung: { zeilen: string[] } | null;
};

export function EinsatzlisteRollenkarte({
  daten,
  readOnly,
  onUebernehmen,
  onNavigateArena,
}: {
  daten: RollenkarteDaten;
  readOnly: boolean;
  onUebernehmen: (activePlayerId: string) => void;
  onNavigateArena?: () => void;
}) {
  const farbe = slotFarbe(daten.slotIndex);
  const positiv = daten.attribute.filter((a) => a.glyphe === "++" || a.glyphe === "+");
  const negativ = daten.attribute.filter((a) => a.glyphe === "−" || a.glyphe === "−−");
  return (
    <section className="nl-rollenkarte" data-testid="nl-lineup-rollenkarte" style={{ "--nl-pos-farbe": farbe } as CSSProperties}>
      <header className="nl-rollenkarte-kopf">
        <span className="nl-feld-kuerzel">{daten.kuerzel}</span>
        <div>
          <strong>{daten.rollenLabel}</strong>
          <small>
            {daten.slotLabel}
            {daten.platz?.gruppenLabel ? ` · ${daten.platz.gruppenLabel}` : ""}
          </small>
        </div>
        {daten.platz ? (
          <NlTooltip label={`${VERBINDLICHKEIT_TEXT[daten.platz.verbindlichkeit]} Beleg: ${daten.platz.beleg}`}>
            <span className={`nl-rollenkarte-verbindlich is-${daten.platz.verbindlichkeit}`}>
              {daten.platz.verbindlichkeit === "motor" ? "Motor" : daten.platz.verbindlichkeit === "start" ? "Startort" : "Darstellung"}
            </span>
          </NlTooltip>
        ) : null}
      </header>
      {daten.beschreibung ? <p className="nl-rollenkarte-text">{daten.beschreibung}</p> : null}
      {daten.platz?.zeile ? (
        <p className="nl-rollenkarte-zeile">
          <span className="nl-rollenkarte-label">Platz</span> {daten.platz.zeile}
        </p>
      ) : null}

      {daten.attribute.length > 0 ? (
        <div className="nl-rollenkarte-block">
          <NlTooltip
            block
            label="Slot-Gewicht gegen Disziplin-Basis: ++ ≥ +3 Pp, + ≥ +1, · dazwischen, − ≤ −1, −− ≤ −3. In Klammern: Wert des Gesetzten."
          >
            <span className="nl-rollenkarte-label">Attribute in dieser Rolle</span>
          </NlTooltip>
          <ul className="nl-rollenkarte-attribute">
            {[...positiv, ...negativ].map((a) => (
              <li key={a.key}>
                <NlTooltip label={`${a.label}: Gewicht ${fmt(a.gewicht)} % (${a.delta >= 0 ? "+" : ""}${fmt(a.delta)} Pp gegen Basis)`}>
                  <span className="nl-rollenkarte-attr-kuerzel">{attributKuerzel(a.key)}</span>
                  <GlyphenChip glyphe={a.glyphe} />
                </NlTooltip>
                {a.spielerWert != null ? <span className="nl-tnum nl-rollenkarte-spielerwert">{Math.round(a.spielerWert)}</span> : null}
              </li>
            ))}
          </ul>
          {positiv.length + negativ.length === 0 ? <p className="nl-rollenkarte-text">Diese Rolle gewichtet wie die Disziplin selbst.</p> : null}
        </div>
      ) : null}

      <div className="nl-rollenkarte-block">
        <span className="nl-rollenkarte-label">Besetzt</span>
        {daten.besetzt ? (
          <p className="nl-rollenkarte-besetzt">
            <strong>{daten.besetzt.name}</strong>
            <span className="nl-tnum">{fmt(daten.besetzt.wert)}</span>
            {daten.besetzt.glyphe ? <GlyphenChip glyphe={daten.besetzt.glyphe} /> : null}
            {daten.besetzt.rollenAufschlag != null ? (
              <NlTooltip label="Rollen-Aufschlag dieses Spielers in diesem Slot (Teil der Slot-Projektion).">
                <span className="nl-tnum nl-rollenkarte-aufschlag">
                  R {daten.besetzt.rollenAufschlag >= 0 ? "+" : ""}
                  {fmt(daten.besetzt.rollenAufschlag)}
                </span>
              </NlTooltip>
            ) : null}
            {daten.besetzt.goldTitel ? (
              <NlTooltip label={daten.besetzt.goldTitel}>
                <span className="nl-feld-raute">◆ optimal</span>
              </NlTooltip>
            ) : null}
            {daten.besetzt.goldVerschenktTitel ? (
              <NlTooltip label={daten.besetzt.goldVerschenktTitel}>
                <span className="nl-rollenkarte-verschenkt">◇ nicht optimal</span>
              </NlTooltip>
            ) : null}
          </p>
        ) : (
          <p className="nl-rollenkarte-text">Noch frei.</p>
        )}
        {daten.besetzt?.goldVerschenktTitel ? <p className="nl-rollenkarte-hinweis">{daten.besetzt.goldVerschenktTitel}</p> : null}
      </div>

      {daten.alternativen.length > 0 ? (
        <div className="nl-rollenkarte-block">
          <span className="nl-rollenkarte-label">Beste Kandidaten für diesen Slot</span>
          <ol className="nl-rollenkarte-alternativen">
            {daten.alternativen.map((alt) => (
              <li key={alt.id} className={alt.aktuell ? "is-aktuell" : undefined}>
                <span>{alt.name}</span>
                <span className="nl-tnum">{fmt(alt.wert)}</span>
                {!alt.aktuell && !readOnly ? (
                  <button type="button" className="nl-lineup-btn is-ghost is-small" onClick={() => onUebernehmen(alt.id)}>
                    Setzen
                  </button>
                ) : alt.aktuell ? (
                  <em>gesetzt</em>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {daten.feinjustierung ? (
        <details className="nl-rollenkarte-fein" data-testid="nl-lineup-feinjustierung">
          <summary>Feinjustierung (Battle Arena)</summary>
          <p className="nl-rollenkarte-text">Gilt im Entwurfskampf der Arena. Am Spieltag zählt nur der Slot.</p>
          <ul>
            {daten.feinjustierung.zeilen.map((zeile) => (
              <li key={zeile}>{zeile}</li>
            ))}
          </ul>
          {onNavigateArena ? (
            <button type="button" className="nl-lineup-btn is-ghost is-small" onClick={onNavigateArena}>
              Befehl &amp; Haltung in der Arena einstellen
            </button>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
