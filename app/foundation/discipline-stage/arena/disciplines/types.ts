// =====================================================================================
// DisciplineFieldProps — der EINE Contract, den jede Disziplin-Feld-Komponente erfüllt.
// =====================================================================================
//
// Bauplan für die Fan-out-Agents:
//
//   Der Host (DisciplineStageNativeArena.tsx) bleibt die WAHRHEIT und behält die
//   komplette Engine: Score=Wahrheit, Reveal-Cascade (advance/doOne), Ranking,
//   Ladder, Ticker, Podium, Kopf-Strip, MyTracker, Spotlight, HTML-Overlays
//   (Score-Pops/Flash/Splitter), Detail-Ergebnistabelle.
//
//   Eine Feld-Komponente ist REIN VISUELL. Sie rendert die KINDER des <svg>-Elements
//   (Feldkunst + Token-Layout/Bewegung + disziplin-spezifische On-Feld-FX). Der Host
//   umschließt sie mit <svg viewBox …>{Field(props)}</svg> und legt alle HTML-Overlays
//   (Pops, Flash, Hovercard, Podest, Banner) DARÜBER — die berechnet der Host aus dem
//   State und aus `tokenPos`.
//
//   Jede Feld-Komponente:  const XField: React.FC<DisciplineFieldProps> = (props) => …
//   Registriert in registry.ts unter ihrem StagePrimitive-Schlüssel.
//
//   Bewegung: statische Primitive positionieren Tokens über `tokenPos(t, score)`
//   (CSS-Transition). Die Staffel (`track`) rebuildet die Bewegung mit einem eigenen
//   rAF-Glide entlang des Ovals (siehe track.tsx) — sie bekommt denselben Contract.
//
// =====================================================================================

import type { RefObject } from "react";
import type {
  RT,
  StagePrimitive,
  StageEnv,
  StageMotif,
  NativeStagePlayer,
} from "../DisciplineStageNativeArena";

export type Vec2 = { x: number; y: number };

// viewBox-Geometrie + Token-Radien je Primitive (aus PRIM_GEO).
export type FieldGeo = { w: number; h: number; r: number; rOwn: number };

// Gewichtheben · Kraft-Turm — vorab berechnete Latten-/kg-Infos (nur `barbell`).
export type BarbellInfo = {
  endKg: number[];
  kgMax: number;
  kgMin: number;
  axTop: number;
  totals: number[];
} | null;

export type DisciplineFieldProps = {
  // ---- Identität / Skin -------------------------------------------------------------
  primitive: StagePrimitive; // welche Disziplin (eine Komponente kann eine Familie bedienen)
  disciplineName?: string; // Feld-Wasserzeichen
  accent?: string;
  skinAccent: string; // aufgelöste Akzentfarbe (Feldlinien/Wasserzeichen)
  motif?: StageMotif; // dezentes Hintergrund-Motiv (wenn kein env)
  env?: StageEnv; // atmosphärische Umgebung (Stadion o.ä.)
  reducedMotion: boolean; // prefers-reduced-motion → keine Animation
  paused: boolean; // Leertaste-Pause (manuell) — rAF-getriebene Felder frieren die Bewegung ein

  // Staffelstab-Übergabe (nur track): true im ~600ms-Fenster nach einem Etappen-Glide-Start.
  // Der Host berechnet es (now < handoffTs + 600); das Track-Feld zeigt dann den Stab-Funken.
  handoffActive?: boolean;

  // ---- Viewport / Geometrie ---------------------------------------------------------
  W: number; // viewBox-Breite
  H: number; // viewBox-Höhe
  N: number; // Anzahl Teams
  geo: FieldGeo; // Token-Radien
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: any; // primitive-spezifisches Layout (Bahnen/Türme/Szenen-Wegpunkte …)
  finalMax: number; // Normierungsbasis (größte erreichbare Team-Summe) → Position 0…1

  // Oval-Helfer (nur track relevant): Pfad-Generator + Mess-Pfad-Ref.
  makeOval: (m: number) => string;
  ovalPath: string;
  OVAL_M: number;
  OVAL_BAND: number;
  pathRef: RefObject<SVGPathElement | null>; // track: Mess-Pfad (Host liest getPointAtLength für Pops/Hovercard)
  pathLen: number;

  // Position eines Tokens auf dem Feld für einen gegebenen (kumulierten) Score.
  tokenPos: (t: RT, score: number) => Vec2;

  // ---- Teams / Live-Zustand ---------------------------------------------------------
  rt: RT[]; // ALLE Teams in idx-Reihenfolge (mutable Runtime-Kopie; enthält
  //            score/displayScore/thrownSlot/rank/roundMedal/glowUntil/rankHistory …)
  sorted: RT[]; // Teams in Rang-Reihenfolge (Ladder-Ordnung)
  barbellSorted: RT[]; // Gewichtheben-Reihenfolge (Verbliebene zuerst) — sonst == sorted
  round: number; // aktuelle Runde/Etappe (0-basiert)
  slotCount: number; // Anzahl Slots/Etappen
  slots: string[]; // Slot-Labels
  done: boolean; // alle Runden aufgedeckt
  now: number; // Date.now() dieses Renders (für glowUntil-Vergleiche)

  // Abgeleitete Normierung (KDA/HP): n = (score − min)/(max − min), clamped.
  fieldNorm: (score: number) => number;

  // ---- Gewichtheben (nur `barbell`) -------------------------------------------------
  barbellInfo: BarbellInfo;
  barbellY: (kg: number) => number;
  barbellKgOf: (idx: number) => number;
  barbellEliminated: (idx: number) => boolean;
  barbellRankMap: Record<string, number>;
  demandKg: number | null;

  // ---- Basketball (nur `court`) -----------------------------------------------------
  courtMedian: number;
  courtMax: number;
  courtHotFloor: number;

  // ---- FX / Callback-Hooks ----------------------------------------------------------
  // Engine-getriebene FX (der Host ruft sie normalerweise selbst in doOne auf; hier
  // exponiert, damit bespoke Felder — z.B. eine rebuildete Bewegung — sie auslösen können).
  addPop: (net: number, mine: boolean, pos: Vec2) => void;
  fireFlash: (color: string) => void;
  doShake: (soft: boolean) => void;
  glow: (t: RT) => void;

  // Interaktion (Host-Hovercard + Drawer-Öffner).
  openHover: (idx: number) => void; // Token-Hover öffnet die Host-Hovercard
  scheduleHoverClose: () => void;
  hoverIdx: number | null; // aktuell gehovertes Token (Bewegung einfrieren)
  onOpenTeam?: ((teamId: string) => void) | null;
  onOpenPlayer?: ((playerId: string) => void) | null;
  onHoverTeam?: ((teamId: string | null) => void) | null;
};

export type DisciplineField = React.FC<DisciplineFieldProps>;

// Re-Exports, damit Feld-Komponenten alles aus EINER Datei ziehen können.
export type { RT, StagePrimitive, StageEnv, StageMotif, NativeStagePlayer };
