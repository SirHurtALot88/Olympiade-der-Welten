// =====================================================================================
// takeshi (Takeshi's Castle) — Hindernnis-Parcours · Serpentinen-Kurs
//
// Bewegung: pro Runde ein durchgehendes, weiches rAF-Gleiten ENTLANG des Serpentinen-
// Pfads (Arc-Length, folgt der Kurve). Score bleibt Wahrheit. Dynamisches Easing pro
// Token. Hover friert ein. reduced-motion instant.
//
// Rendering (Mockup-Niveau, Ziel 3 Abschnitt 6.5, 10.09.): FUENF echte Gelaendezonen
// statt drei generischer Etiketten — dieselben fuenf wie `BAHN_ART["takeshis-castle"]
// .zonen` im Mockup-Motor (public/mockups/battle-mode.engine.js, `bodenTakeshiRoute()`):
// Sammelplatz auf Wiese, Holzbauten im Wald auf Kies, der See mit Steg/Schlammufern, der
// trockene Hang, der gepflasterte Burghof. Dazu ZEHN Fallenbilder aus `BAHN_ART[
// "takeshis-castle"].fallenBild` (labyrinth/eis/steine/walzen/tuer/seilwand/brueckenball/
// schlamm/raeder/spitzen) als eigene SVG-Symbole an festen Streckenpositionen — reines
// SVG, keine PNGs (`.tsx` rendert kein Canvas). Eine Falle bekommt einen kurzen Gluehen-
// Impuls, sobald der aktuelle Fuehrende sie passiert (`sorted[0]`, dieselbe Groesse, die
// auch die Rangliste ordnet — kein zweiter Rechenweg), analog zu `fallenAusgang()` im
// Mockup. Die Laeufer faechern breiter quer zur Route (`lane`), damit sie bei aehnlichem
// Fortschritt nicht mehr aufeinander stapeln.
// =====================================================================================
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DisciplineFieldProps, RT, Vec2 } from "./types";
import { useTokenGlide, tokenRef, GhostLayer, TokenChrome, tokenRadius } from "./benchmark";

// Deterministischer Hash fuer prozedurale Deko (Zuschauer/Wimpel/Boeden) — EINE Quelle
// statt der frueher doppelten Inline-Kopie in crowd()/bunting().
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// DIE FUENF GELAENDEZONEN, 1:1 aus BAHN_ART["takeshis-castle"].zonen im Mockup-Motor
// uebernommen (Bogenlaengen-Bruchteile `bis`, `boden` = Untergrund, `um` = Umgebungsname
// fuers Etikett). Schlamm kommt damit an den Seeufern vor, nicht als eigene sechste Zone —
// exakt wie im Motor ("Schlamm gibt es an drei Stellen, ... also dort, wo er in
// Midoriyama war").
const ZONEN: { bis: number; boden: "pfad" | "kies" | "planken" | "pflaster"; label: string }[] = [
  { bis: 0.12, boden: "pfad", label: "SAMMELPLATZ · WIESE" },
  { bis: 0.36, boden: "kies", label: "HOLZBAUTEN · WALD" },
  { bis: 0.6, boden: "planken", label: "DER SEE · SCHLAMMUFER" },
  { bis: 0.86, boden: "pfad", label: "DER HANG" },
  { bis: 1.0, boden: "pflaster", label: "BURGHOF" },
];
const ZONE_FARBE: Record<(typeof ZONEN)[number]["boden"], { fuellung: string; rand: string }> = {
  pfad: { fuellung: "#6a8f3c", rand: "#4d6b2a" },
  kies: { fuellung: "#2f4a2e", rand: "#1c301b" },
  planken: { fuellung: "#2d6d8a", rand: "#1f4d63" },
  pflaster: { fuellung: "#8a7a5c", rand: "#5c4f38" },
};

// ZEHN FALLENBILDER, 1:1 aus BAHN_ART["takeshis-castle"].fallenBild — je Sub-Skill zwei
// Fassungen. Reihenfolge hier nur fuer die feste Platzierung entlang der Route, nicht die
// tatsaechliche Kursreihenfolge (die wuerfelt der Motor je Saat aus drei Kursen, s. dort;
// eine .tsx-Uebersicht zeigt alle zehn Bilder einmal, keine 14-Fallen-Sequenz).
const FALLEN: { typ: string; label: string }[] = [
  { typ: "labyrinth", label: "Honeycomb Maze" },
  { typ: "steine", label: "Skipping Stones" },
  { typ: "tuer", label: "Knock Knock" },
  { typ: "brueckenball", label: "Bridge Ball" },
  { typ: "eis", label: "Slip Way" },
  { typ: "walzen", label: "Roller Game" },
  { typ: "seilwand", label: "Border Wall" },
  { typ: "schlamm", label: "Dragon God Lake" },
  { typ: "raeder", label: "High Rollers" },
  { typ: "spitzen", label: "Final Fall" },
];

type PfadPunkt = Vec2 & { nx: number; ny: number };

export default function TakeshiField(props: DisciplineFieldProps): ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    reducedMotion,
    W,
    H,
    geo,
    finalMax,
    rt,
    sorted,
    now,
    hoverIdx,
    highlightIdxs,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  const trioSet = new Set(highlightIdxs ?? []);

  // Band-Path (der GEZEICHNETE Burg-Parcours) — die Token laufen GENAU hier entlang.
  const bandD = "M 70 545 H 760 A 85 85 0 0 0 760 375 H 140 A 85 85 0 0 1 140 205 H 800";
  // Lokaler tokenPos: Fortschritt ENTLANG des gezeichneten Bandes (Bogenlänge) = Score.
  // Der Host-parcours-tokenPos nutzt einen anderen Wegpunkt-Pfad → Läufer verließen die
  // gezeichnete Strecke. Ein unsichtbarer Mess-Pfad (pathRef) liefert getPointAtLength.
  const pathRef = useRef<SVGPathElement | null>(null);
  const normVonScore = (score: number): number => (finalMax > 0 ? Math.max(0, Math.min(1, score / finalMax)) : 0);
  const localTokenPos = (t: RT, score: number): Vec2 => {
    const path = pathRef.current;
    if (!path) return { x: 70, y: 545 };
    const PER = path.getTotalLength();
    const norm = normVonScore(score);
    const L = (0.02 + norm * 0.96) * PER;
    const pt = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(PER, L + 2));
    let tx = p2.x - pt.x;
    let ty = p2.y - pt.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    // AUFFAECHERUNG (Ziel 3, sicht-qa-10-09-takeshis-castle.png: die Laeufer klumpen).
    // Vorher `(t.laneIdx % 5) - 2` (5 Bahnen, ±18 px) — bei 32 Teams liegen damit im
    // Schnitt sechs bis sieben Laeufer auf DERSELBEN Bahn. Neun Bahnen bei groesserem
    // Quer-Versatz (±44 px statt ±18 px) verteilen dieselben 32 Teams sichtbar auf drei
    // statt sechs Uebereinanderlieger, ohne die Score-Position selbst zu veraendern.
    const lane = (t.laneIdx % 9) - 4; // -4…4
    return { x: pt.x + -ty * lane * 11, y: pt.y + tx * lane * 11 };
  };
  // Benchmark-Bewegung + Ghost: Token folgen animScore ENTLANG des Bandes (Hover/Pause friert ein).
  const { gRefs, ghostRefs } = useTokenGlide({ ...props, tokenPos: localTokenPos });

  // ---- Geometrie der fuenf Gelaendezonen + zehn Fallenpositionen ---------------------
  // `getPointAtLength` gibt es erst, sobald der Mess-Pfad im DOM sitzt — deshalb per
  // Effekt einmal nach dem Mount berechnet, nicht waehrend des Renders. Bis dahin bleibt
  // die Karte ohne die zusaetzlichen Zonenbaender/Fallen sichtbar (das Band selbst steht
  // schon), kein Layout-Sprung.
  const [zoneBaender, setZoneBaender] = useState<{ d: string; boden: (typeof ZONEN)[number]["boden"]; label: string; labelPos: Vec2 }[]>([]);
  const [fallenPunkte, setFallenPunkte] = useState<(Vec2 & { angle: number })[]>([]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const PER = path.getTotalLength();
    const abtasten = (a: number, b: number, schritte: number): PfadPunkt[] => {
      const out: PfadPunkt[] = [];
      for (let k = 0; k <= schritte; k++) {
        const L = Math.max(0, Math.min(PER, (a + (b - a) * (k / schritte)) * PER));
        const p = path.getPointAtLength(L);
        const p2 = path.getPointAtLength(Math.min(PER, L + 1.5));
        let tx = p2.x - p.x;
        let ty = p2.y - p.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        out.push({ x: p.x, y: p.y, nx: -ty, ny: tx });
      }
      return out;
    };
    // Ein Band je Zone: die Route-Mittellinie, einmal um `rand` nach der einen
    // Normalen versetzt (Hinweg) und auf dem Rueckweg nach der anderen (Rueckweg) —
    // dieselbe Huellen-Idee wie `huellePfad()` im Mockup, nur ohne dessen `um`-
    // Gruppierung (hier reicht die Route selbst als Achse).
    const rand = 46; // etwas breiter als die 46 px helle Lauffläche
    let von = 0;
    const baender = ZONEN.map((z) => {
      const pts = abtasten(von, z.bis, 20);
      von = z.bis;
      const links = pts.map((p) => ({ x: p.x + p.nx * rand, y: p.y + p.ny * rand }));
      const rechts = pts.map((p) => ({ x: p.x - p.nx * rand, y: p.y - p.ny * rand }));
      const d =
        `M ${links[0].x.toFixed(1)} ${links[0].y.toFixed(1)} ` +
        links.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
        " " +
        [...rechts].reverse().map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
        " Z";
      const mitte = pts[Math.floor(pts.length / 2)];
      return { d, boden: z.boden, label: z.label, labelPos: { x: mitte.x, y: mitte.y } };
    });
    setZoneBaender(baender);

    // Zehn Fallenpositionen, gleichmaessig ueber die Route verteilt (5 %…95 % Laenge,
    // damit keine auf Start/Ziel selbst faellt).
    const fallen = FALLEN.map((_, i) => {
      const frac = 0.05 + (i / (FALLEN.length - 1)) * 0.9;
      const L = frac * PER;
      const p = path.getPointAtLength(L);
      const p2 = path.getPointAtLength(Math.min(PER, L + 2));
      const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
      return { x: p.x, y: p.y, angle };
    });
    setFallenPunkte(fallen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WELCHE FALLE GERADE "GLUEHT" (Fallen-Reaktion, Ziel 3 Abschnitt 6.5): die Falle, die
  // der aktuelle FUEHRENDE (`sorted[0]`, dieselbe Rang-Groesse wie die Host-Rangliste,
  // kein zweiter Rechenweg) zuletzt passiert hat — analog zu `fallenAusgang()` im Mockup,
  // das ebenfalls read-only auf den Fortschritt schaut, ohne je in die Wertung zu
  // schreiben. `null`, solange die Fallen-Geometrie noch nicht berechnet ist.
  const fuehrenderFrac = sorted[0] ? normVonScore(sorted[0].animScore) : 0;
  let gluehIdx = -1;
  if (fallenPunkte.length) {
    for (let i = 0; i < FALLEN.length; i++) {
      const frac = 0.05 + (i / (FALLEN.length - 1)) * 0.9;
      if (frac <= fuehrenderFrac + 0.015) gluehIdx = i;
    }
  }

  // Hilfsfunktionen für Course-Artwork
  const crowd = (): string => {
    const cols = ["#e0b23c", "#d16a4a", "#4a76c8", "#7ab86a", "#c47ab8", "#f0ece0"];
    let s = "";
    for (let i = 0; i < 180; i++) {
      const x = 14 + ((i * 89) % (W - 28)) + (hash("cx" + i) - 0.5) * 9;
      const y = 64 + hash("cy" + i) * 34;
      const c = cols[Math.floor(hash("cc" + i) * cols.length)];
      const o = 0.4 + hash("co" + i) * 0.4;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 + hash("cr" + i) * 1.2).toFixed(1)}" fill="${c}" opacity="${o.toFixed(2)}"/>`;
    }
    return s;
  };

  const bunting = (y: number): string => {
    const cols = ["#e03c30", "#f6c750", "#4a76c8", "#f0ece0"];
    let s = `<path d="M 12 ${y} H ${W - 12}" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>`;
    for (let x = 18; x < W - 14; x += 24) {
      const c = cols[Math.floor(hash("b" + x) * cols.length)];
      s += `<path d="M ${x} ${y} l 6 9 l 6 -9 Z" fill="${c}" opacity=".75"/>`;
    }
    return s;
  };

  const logs = (): string => {
    let s = "";
    const xs = [540, 610];
    xs.forEach((x, i) => {
      const rot = i ? -8 : 7;
      s += `<g transform="rotate(${rot} ${x} 375)">`;
      s += `<rect x="${x - 8}" y="343" width="16" height="64" rx="8" fill="#8a5a30" stroke="#5e3c1c" stroke-width="1.5"/>`;
      s += `<path d="M ${x - 8} 355 h 16 M ${x - 8} 369 h 16 M ${x - 8} 383 h 16" stroke="#5e3c1c" stroke-width="1" opacity=".6"/>`;
      s += `<circle cx="${x}" cy="343" r="8" fill="#c89a5e" stroke="#5e3c1c" stroke-width="1.5"/>`;
      s += `</g>`;
    });
    return s;
  };

  const castle = (): string => {
    let s = "";
    s += `<rect x="806" y="152" width="86" height="100" rx="4" fill="#9aa3ad" stroke="#5c6674" stroke-width="1.5"/>`;
    for (let x = 808; x < 890; x += 12)
      s += `<rect x="${x}" y="146" width="8" height="10" fill="#9aa3ad" stroke="#5c6674" stroke-width="1"/>`;
    s += `<rect x="812" y="120" width="20" height="42" fill="#8a939e" stroke="#5c6674" stroke-width="1.5"/>`;
    s += `<path d="M 806 122 L 822 100 L 838 122 Z" fill="#c0392b" stroke="#7c1810" stroke-width="1.5"/>`;
    s += `<rect x="866" y="120" width="20" height="42" fill="#8a939e" stroke="#5c6674" stroke-width="1.5"/>`;
    s += `<path d="M 860 122 L 876 100 L 892 122 Z" fill="#c0392b" stroke="#7c1810" stroke-width="1.5"/>`;
    s += `<path d="M 800 154 L 849 128 L 898 154 Z" fill="#c0392b" stroke="#7c1810" stroke-width="1.5"/>`;
    s += `<path d="M 834 252 V 214 A 15 15 0 0 1 864 214 V 252 Z" fill="#2a2027" stroke="#5c6674" stroke-width="1.5"/>`;
    s += `<text x="849" y="176" text-anchor="middle" font-size="14">🏯</text>`;
    s += `<text x="849" y="266" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="8.5" font-weight="800" letter-spacing="1.5" fill="#3c2f14">TAKESHIS BURG</text>`;
    return s;
  };

  // ---- Die zehn Fallenbilder als reines SVG (kein PNG) -------------------------------
  // Im Stil von logs()/castle() darüber: kleine String-Baufunktionen je Typ, an ihrer
  // berechneten Streckenposition gerendert. `gluehend` triggert den kurzen Impuls
  // (grünes Nachleuchten), wenn der Fuehrende die Falle gerade passiert hat.
  const falleSvg = (typ: string, gluehend: boolean, seed: number): string => {
    const glow = gluehend
      ? `<circle r="26" fill="none" stroke="#7ee089" stroke-width="2.5" opacity="0.85"><animate attributeName="r" values="18;28;18" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.1s" repeatCount="indefinite"/></circle>`
      : "";
    switch (typ) {
      case "labyrinth": {
        const luecke = seed % 3;
        const teile = [-16, 0, 16];
        let s = glow;
        teile.forEach((tx, k) => {
          if (k === luecke) return;
          s += `<rect x="${tx - 6}" y="-16" width="12" height="32" rx="2" fill="#9aa3ad" stroke="#5c6674" stroke-width="1.2"><animateTransform attributeName="transform" type="translate" values="0 0; 0 -1; 0 0" dur="${2 + k * 0.4}s" repeatCount="indefinite"/></rect>`;
        });
        s += `<rect x="${teile[luecke] - 7}" y="-18" width="14" height="36" rx="2" fill="none" stroke="#7ee089" stroke-width="1.4" opacity="0.7"/>`;
        return s;
      }
      case "steine": {
        let s = `<ellipse cx="0" cy="10" rx="20" ry="7" fill="#2d6d8a" opacity="0.55"/>${glow}`;
        [-14, 0, 14].forEach((dx, k) => {
          s += `<ellipse cx="${dx}" cy="${4 + (k % 2)}" rx="7" ry="4.5" fill="#9a9486" stroke="#5c5648" stroke-width="1"><animateTransform attributeName="transform" type="translate" values="0 0; 0 -1.4; 0 0" dur="${1.6 + k * 0.3}s" repeatCount="indefinite"/></ellipse>`;
        });
        return s;
      }
      case "tuer": {
        return (
          glow +
          `<rect x="-10" y="-24" width="20" height="40" fill="#8a5a30" stroke="#5e3c1c" stroke-width="1.4"/>` +
          `<rect x="-10" y="-24" width="20" height="40" fill="none" stroke="#3c2812" stroke-width="1"><animateTransform attributeName="transform" type="rotate" values="0 -10 -4; -6 -10 -4; 0 -10 -4" dur="2.4s" repeatCount="indefinite"/></rect>`
        );
      }
      case "brueckenball": {
        return (
          glow +
          `<path d="M -18 -30 H 18" stroke="#d9c9a0" stroke-width="3"/>` +
          `<g><animateTransform attributeName="transform" type="rotate" values="-24 0 -30; 24 0 -30; -24 0 -30" dur="2.6s" repeatCount="indefinite"/>` +
          `<line x1="0" y1="-30" x2="0" y2="-2" stroke="#d9c9a0" stroke-width="1.4"/>` +
          `<circle cx="0" cy="0" r="7" fill="#c0504a" stroke="#5a1f1c" stroke-width="1.2"/></g>`
        );
      }
      case "eis": {
        return (
          glow +
          `<rect x="-22" y="-8" width="44" height="18" rx="3" fill="#bfe9ff" opacity="0.9"/>` +
          `<path d="M -14 -4 L -4 8 M 0 -6 L 10 6 M 8 -8 L 16 2" stroke="#fff" stroke-width="1.3" opacity="0.8"/>`
        );
      }
      case "walzen": {
        let s = glow;
        [-11, 11].forEach((dx, k) => {
          s += `<circle cx="${dx}" cy="0" r="10" fill="#a97c46" stroke="#5e3c1c" stroke-width="1.4"><animateTransform attributeName="transform" type="translate" values="0 -5; 0 5; 0 -5" dur="${1.3 + k * 0.5}s" repeatCount="indefinite"/></circle>`;
        });
        return s;
      }
      case "seilwand": {
        return (
          glow +
          `<rect x="-16" y="-30" width="32" height="34" fill="#8a5a30" stroke="#5e3c1c" stroke-width="1.4"/>` +
          `<g><animateTransform attributeName="transform" type="rotate" values="-4 0 -30; 4 0 -30; -4 0 -30" dur="2.1s" repeatCount="indefinite"/>` +
          `<path d="M -6 -30 L -6 6 M 6 -30 L 6 6 M -6 -20 L 6 -20 M -6 -8 L 6 -8" stroke="#c89a5e" stroke-width="1.6"/></g>`
        );
      }
      case "schlamm": {
        let s = `<rect x="-22" y="-12" width="44" height="22" rx="3" fill="#4a3a28"/>${glow}`;
        [0, 1, 2].forEach((k) => {
          s += `<circle cx="${-12 + k * 12}" cy="-2" r="2.4" fill="rgba(255,255,255,.4)"><animate attributeName="cy" values="4;-10;4" dur="${1.4 + k * 0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="${1.4 + k * 0.3}s" repeatCount="indefinite"/></circle>`;
        });
        return s;
      }
      case "raeder": {
        return (
          glow +
          `<g><animateTransform attributeName="transform" type="translate" values="-14 0; 14 0; -14 0" dur="3s" repeatCount="indefinite"/>` +
          `<g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="1.4s" repeatCount="indefinite"/>` +
          `<circle r="12" fill="none" stroke="#c89a5e" stroke-width="3"/><path d="M -12 0 H 12 M 0 -12 V 12" stroke="#c89a5e" stroke-width="2"/></g></g>`
        );
      }
      case "spitzen": {
        return (
          glow +
          `<path d="M -18 8 L -12 -14 L -6 8 L 0 -16 L 6 8 L 12 -14 L 18 8 Z" fill="#9a9486" stroke="#5c5648" stroke-width="1.2"/>`
        );
      }
      default:
        return glow + `<rect x="-14" y="-3" width="28" height="6" fill="#e6e0d2"/>`;
    }
  };

  return (
    <>
      {/* Background: sky, grass, atmosphere */}
      <defs>
        {rt.map((t) =>
          t.logoUrl ? (
            <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
              <circle cx={0} cy={0} r={tokenRadius(t, geo)} />
            </clipPath>
          ) : null,
        )}
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f9fd8" />
          <stop offset="100%" stopColor="#a8dcf5" />
        </linearGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5aa050" />
          <stop offset="100%" stopColor="#437e3e" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x={0} y={0} width={W} height={118} fill="url(#sky)" />
      <circle cx={88} cy={34} r={16} fill="#ffe9a0" opacity={0.9} />
      <ellipse cx={300} cy={36} rx={34} ry={10} fill="rgba(255,255,255,.75)" />
      <ellipse cx={560} cy={26} rx={26} ry={8} fill="rgba(255,255,255,.65)" />
      <text x={W / 2} y={30} textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontWeight={800} fontSize={17} letterSpacing={5} fill="#14324a" opacity={0.55}>
        TAKESHI'S CASTLE · STURM AUF DIE BURG
      </text>
      <g dangerouslySetInnerHTML={{ __html: bunting(44) }} />
      <g dangerouslySetInnerHTML={{ __html: crowd() }} />

      {/* Grass field */}
      <rect x={0} y={118} width={W} height={H - 118} fill="url(#grass)" />

      {/* Ganzen Parcours (Strecke + Hindernisse + Burg) ~24px höher schieben — die untere
          START-Reihe war knapp abgeschnitten. Mess-Pfad + Token sitzen im selben Group,
          also bleibt die Bewegung deckungsgleich. */}
      <g transform="translate(0 -24)">
      {/* Mess-Pfad (unsichtbar) — localTokenPos liest getPointAtLength für die Bewegung. */}
      <path ref={pathRef} d={bandD} fill="none" stroke="none" />

      {/* FUENF GELAENDEZONEN (Ziel 3, 10.09.) — als breite Baender UNTER dem Streckenband,
          damit der jeweilige Untergrund links/rechts des Pfads sichtbar wird, genau wie
          `bodenTakeshiRoute()`s Huellen-Flaechen im Mockup. Erst nach dem Mount berechnet
          (getPointAtLength braucht den echten Mess-Pfad im DOM). */}
      {zoneBaender.map((z, i) => (
        <path key={`zone-${i}`} d={z.d} fill={ZONE_FARBE[z.boden].fuellung} stroke={ZONE_FARBE[z.boden].rand} strokeWidth={1} opacity={0.9} />
      ))}

      {/* Serpentinen-Band: Erdweg mit heller Lauffläche + gestrichelter Mittellinie */}
      <path d={bandD} fill="none" stroke="#a97c46" strokeWidth={58} strokeLinecap="round" />
      <path d={bandD} fill="none" stroke="#d8b078" strokeWidth={46} strokeLinecap="round" />
      <path d={bandD} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth={2} strokeDasharray="10 14" />

      {/* Zonen-Etiketten — an ihrer Streckenmitte, klein und dezent (Kollision mit den
          Fallenbildern durch geringe Groesse/Opazitaet vermieden). */}
      {zoneBaender.map((z, i) => (
        <text
          key={`zonelabel-${i}`}
          x={z.labelPos.x}
          y={z.labelPos.y - 46}
          textAnchor="middle"
          fontFamily="ui-monospace,Menlo,monospace"
          fontSize={8}
          fontWeight={800}
          letterSpacing={1.5}
          fill="rgba(255,255,255,.85)"
          stroke="rgba(20,20,20,.55)"
          strokeWidth={2.4}
          paintOrder="stroke"
        >
          {z.label}
        </text>
      ))}

      {/* Rollende Stämme (dekoratives Landmark im Wald-Abschnitt) */}
      <g dangerouslySetInnerHTML={{ __html: logs() }} />

      {/* ZEHN FALLENBILDER (Ziel 3, 10.09.): eigene SVG-Symbole an ihrer Streckenposition,
          aus BAHN_ART["takeshis-castle"].fallenBild — die Falle, die der Fuehrende zuletzt
          passiert hat, gluecht kurz gruen nach (dieselbe Reaktions-Idee wie
          `fallenAusgang()` im Mockup). */}
      {fallenPunkte.map((p, i) => (
        <g key={`falle-${i}`} transform={`translate(${p.x} ${p.y})`}>
          <g dangerouslySetInnerHTML={{ __html: falleSvg(FALLEN[i].typ, i === gluehIdx && !reducedMotion, i) }} />
          <text y={22} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={6.5} fontWeight={700} fill="rgba(255,255,255,.8)" stroke="rgba(20,20,20,.6)" strokeWidth={2} paintOrder="stroke">
            {FALLEN[i].label}
          </text>
        </g>
      ))}

      {/* Sturmangriff-Zone: Warnstreifen */}
      {[0, 1].map((group) => {
        const gx = group ? 648 : 410;
        return (
          <g key={`warn-${group}`}>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={gx + i * 8} y={175} width={4} height={60} fill={i % 2 ? "#f0ece0" : "#e03c30"} transform={`rotate(12 ${gx} 205)`} />
            ))}
          </g>
        );
      })}
      <text x={530} y={172} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9} fontWeight={800} letterSpacing={2} fill="#7c1810">
        ⚠ STURMANGRIFF · ROLLENDE KUGELN
      </text>

      {/* Start: kariertes Band + rote Fahne */}
      <rect x={64} y={517} width={12} height={56} fill="#f0ece0" />
      <rect x={64} y={517} width={12} height={14} fill="#181a20" />
      <rect x={64} y={545} width={12} height={14} fill="#181a20" />
      <circle cx={70} cy={506} r={4} fill="#e03c30" />
      <path d="M 70 506 V 486 l 14 5 l -14 5" fill="#e03c30" stroke="#7c1810" strokeWidth={1} />
      <text x={70} y={552} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize={9.5} fontWeight={800} letterSpacing={2} fill="#3c2f14">
        START
      </text>

      {/* Takeshis Burg */}
      <g dangerouslySetInnerHTML={{ __html: castle() }} />
      </g>

      {/* Disziplin-Wasserzeichen (bleibt oben, nicht mitverschoben) */}
      {disciplineName ? (
        <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={skinAccent} opacity={0.95} style={{ textTransform: "uppercase" }}>
          {disciplineName}
        </text>
      ) : null}

      {/* Ghost + Läufer im selben −24-Versatz wie die Strecke (sonst laufen sie neben dem Band). */}
      <g transform="translate(0 -24)">
      {/* Ghost der Vorrunde (Benchmark) — VOR den Läufern. */}
      <GhostLayer sorted={sorted} geo={geo} ghostRefs={ghostRefs} />

      {/* Tokens: 32 Läufer auf dem Pfad — Position via rAF (animScore, Benchmark-Sync).
          Requisiten: keine Kosmetikwaffen — TokenChrome (benchmark.tsx) zeichnet nur Logo/
          Rahmen/Ringe/Rang-Badge, keine Waffenebene; dieses Feld fuegt selbst keine hinzu. */}
      {sorted
        .slice()
        .reverse()
        .map((t) => {
          const r = tokenRadius(t, geo);
          const glowing = t.glowUntil > now;
          return (
            <g
              key={t.code}
              data-token-code={t.code}
              ref={tokenRef(gRefs, t, localTokenPos)}
              style={{ cursor: onOpenTeam && t.teamId ? "pointer" : "default" }}
              onMouseEnter={() => openHover(t.idx)}
              onMouseLeave={scheduleHoverClose}
              onClick={() => {
                if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
              }}
            >
              {/* Führungs-/Glow-Puls (bespoke FX) */}
              {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
              {/* Benchmark-Chrome: Trio/Anker/Relation/Medaille/Logo/Team-Rahmen/Rang-Badge + 🏆.
                  Etikett (Rang-Badge) zeigt TokenChrome bereits nur fuer eigenes Team/Top-3/
                  Hover — bei 32 Laeufern also fuer die wenigsten, keine zusaetzliche Aenderung
                  hier noetig (s. Kommentar `showBadge` in benchmark.tsx). */}
              <TokenChrome t={t} prim={prim} geo={geo} trioSet={trioSet} hoverIdx={hoverIdx} reducedMotion={reducedMotion} />
            </g>
          );
        })}
      </g>
    </>
  );
}
