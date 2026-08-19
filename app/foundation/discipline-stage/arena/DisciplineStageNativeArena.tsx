"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { teamPrimaryColor, floorTeamAccent } from "@/lib/foundation/team-colors";
import { round1ByMathRound as round1 } from "@/lib/foundation/foundation-number-utils";
import type { ArenaResetAnlass } from "@/lib/foundation/discipline-stage/discipline-stage-replay-gate";
import {
  ARENA_LADDER_PAD_Y,
  resolveArenaLadderRowHeight,
} from "@/lib/matchday-arena/arena-ladder-metrics";
import { useStageAudio } from "./useStageAudio";
import DisciplineStageResultTable, { type ResultTableRow } from "./DisciplineStageResultTable";
import DisciplineStageTopPlayersRow from "../DisciplineStageTopPlayersRow";
import DisciplineStageInjuryRow, { type DisciplineStageInjuredPlayer } from "../DisciplineStageInjuryRow";
import PlayerMark, { markMedalColor, numericMedalOf } from "./PlayerMark";
import TeamMark from "./TeamMark";
import type { DisciplineStageTopPlayer } from "../DisciplineStageTopPlayers";
import { fmt1, ampel } from "../stage-format";
import type { TeamRelationshipKind } from "@/lib/foundation/team-relationship";
import { getDisciplineField } from "./disciplines/registry";
import type { DisciplineFieldProps } from "./disciplines/types";
import { getPlayerStarTier } from "@/lib/foundation/player-star-tier";
import {
  ARENA_STEP_DURATION_MS,
  estimateServerNowMs,
  resolveArenaCatchUpMode,
  resolveArenaEffectivePause,
  type ArenaStepSnapshot,
} from "@/lib/foundation/discipline-stage/arena-timeline";

// Freund/Feind-Rahmenfarbe (mine=blau, ally=grün, rival=rot) über die globalen
// --nl-* Tokens (Light/Dark ziehen automatisch mit). Marker = Rahmen, nie Füllung.
export function relColor(rel: TeamRelationshipKind | null | undefined): string | null {
  if (!rel) return null;
  return `var(--nl-${rel})`;
}
const REL_GLYPH: Record<TeamRelationshipKind, string> = { mine: "★", ally: "🤝", rival: "⚔", human: "👤" };

// Wiederverwendbarer Kopf-Strip 50/50 (Spec 02): links die „Dein"-Karte
// (Läufer/Heber/Kämpfer), rechts das Live-Meldungsfeld. Beide teilen sich den Platz
// hälftig; auf schmalen Viewports untereinander. Breaking & Co. können ihn erben.
function ArenaKopfStrip({ left, right }: { left: React.ReactNode; right: React.ReactNode }): React.ReactNode {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 10 }}>
      {left}
      <div style={{ display: "flex", alignItems: "stretch" }}>{right}</div>
    </div>
  );
}

// Nativer Track-Nachbau der Staffel-Arena — voller Feature-Stand der iframe-Szene:
// SVG/viewBox (pixelscharf), Bewegungsanimation (Token gleitet, eigenes Team Slow-Mo),
// Sounds (WebAudio), Highlights (Flash/Shake/Spotlight/Glow/Score-Pop/Splitter),
// Runden-Medaillen, Ticker, Hovercard, Podest + Detail-Ergebnistabelle.
// Position auf dem Oval = kumulierte Punkte. Reveal Slot für Slot, worst-first.

export type NativeStageMod = { k: string; sign: 1 | -1; amt: number; injury?: boolean };
export type NativeStagePlayer = {
  playerId: string | null;
  val: number;
  name: string;
  portraitUrl: string | null;
  mods: NativeStageMod[];
  pointsAwarded: number | null;
  /** Ligaweiter OVR-Rang — einzige Grundlage des Star-Tier-Rings am `PlayerMark` (siehe `player-star-tier.ts`). */
  ovrRank?: number | null;
};
// Live-Ergebnis eines bereits AUFGEDECKTEN Spielers (für den Team-Drawer: „was hat
// der Spieler in dieser Disziplin geholt + Boni/Abzüge"). Nur enthüllte Slots.
export type StageLivePlayerResult = {
  playerId: string;
  slot: number;
  base: number;
  net: number;
  mods: NativeStageMod[];
  pointsAwarded: number | null;
};
export type StageLiveResultsByTeam = Record<string, StageLivePlayerResult[]>;
export type NativeStageTeam = {
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  /**
   * Positionsgetreu: der Index IST die Etappe, `null` heisst „unbesetzt" (Ticket #35). Ein Team
   * mit Spielern auf Slot 5 und 6 hat hier vier fuehrende `null`-Eintraege — vorher rutschten die
   * beiden auf Etappe 1 und 2, unter fremde Rollen-Labels.
   */
  players: Array<NativeStagePlayer | null>;
  seasonRank?: number; // echter Season-Tabellenrang → Bahn-/Turm-Reihenfolge
  teamId?: string; // für Team-Drawer
  rel?: TeamRelationshipKind | null; // Freund/Feind (mine/ally/rival) → Rahmen-Marker
  // A2: Team hat keine Aufstellung für diese Disziplin eingereicht — die Engine liefert
  // trotzdem ein (0-)Ergebnis. Muss sichtbar von einem echten 0-Punkte-Resultat
  // unterschieden werden (Ladder + Detail-Ergebnistabelle).
  missingLineup?: boolean;
  /**
   * Name des in der Einsatzliste gesetzten Kapitäns (oder null/undefined, wenn das
   * Team keinen benannt hat) → kleiner Stern am Wappen (`TokenChrome`).
   */
  captainName?: string | null;
};
export type StagePrimitive =
  | "track"
  | "lanes"
  | "towers"
  | "stage"
  // Row-Familie (eine Reihe je Team, x = Fortschritt, eigenes Reihen-Motiv):
  | "platter" // Wettessen — leergegessene Teller + 🍴
  | "lamps" // Fechten — Treffer-Lampen (rot/grün)
  | "spybar" // I Spy — Späh-/Sichtfeld-Balken, 🔍 an der Scan-Kante
  | "kda" // TDM — K/D/A-Scoreboard (aus Score abgeleitet) + KDA-Balken
  | "duelhp" // Mini-DM — Arena-Schlacht (RPG-Battle im Pit, dmg-Zahlen, Rang = Score)
  // Turm-Familie (Säule je Team, Höhe = Punkte):
  | "barbell" // Gewichtheben — Hantel-Säulen mit Scheiben
  | "sparkbar" // universeller Fallback — schlanke Spark-Säulen
  | "thermometer" // Breaking — Schmerz-Thermometer (grün → glühend rot)
  // Szenen (atmosphärisches Feld, Score = Position):
  | "peloton" // Zeitfahren — Straße mit Ausreißer/Feld
  | "parcours" // Takeshi — Schlangen-Parcours
  | "bump" // Spurt — Slalom/Bump: Rang-über-Etappen-Linien (nutzt rankHistory)
  | "mountain" // Climbing — Gipfelsturm (Berg-Serpentine)
  | "court" // Basketball — Wurfkarte (Halbfeld)
  | "rink" // Hockey — Eisrink von oben
  // Voll-Feld-Sonderlayouts (kein Token-auf-Feld, aus ALLEN Scores berechnet):
  | "klassen" // Schach/Tennis — Liga-Klassen-Bänder nach Punkt-Lücken
  | "territory"; // Battlefield — Squarified Treemap, Fläche ∝ Score, %-Label + 🚩

// Familien mit geteilter Geometrie: Row-Familie rechnet wie "lanes",
// Turm-Familie wie "towers". Nur der Hintergrund/Overlay unterscheidet sie.
export const ROW_FAMILY = new Set<StagePrimitive>(["lanes", "platter", "lamps", "spybar", "kda"]);
export const TOWER_FAMILY = new Set<StagePrimitive>(["towers", "barbell", "sparkbar", "thermometer"]);
// Szenen-Primitive: eigenes atmosphärisches Feld (Straße/Berg/Court/Rink/Parcours).
export const SCENE_PRIMS = new Set<StagePrimitive>(["peloton", "mountain", "court", "rink", "parcours", "bump"]);
// Voll-Feld-Sonderlayouts: eigener Render-Zweig aus ALLEN Scores (kein gleitendes
// Token, keine Bahn/Turm/Szene-Geometrie). deco/glow + Token-Schleife entfallen.
export const FIELD_CUSTOM = new Set<StagePrimitive>(["klassen", "territory", "duelhp"]);
export type DisciplineStageNativeArenaProps = {
  teams: NativeStageTeam[];
  slots: string[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  onOpenTeam?: ((teamId: string) => void) | null; // Token/Ladder-Klick → Team-Drawer
  onHoverTeam?: ((teamId: string | null) => void) | null; // Ladder-Hover → Team-Vorschau
  onPreviewPlayer?: ((playerId: string | null) => void) | null; // Top-Player-Hover → Vorschau
  onEnded?: (() => void) | null; // feuert einmal, sobald das Podest/Endstand erreicht ist (Spoiler-Gate)
  // Meldet JEDES Zuruecksetzen der Buehne samt Anlass. Was der Anlass bedeutet, entscheidet der
  // Host (`replayNachArenaReset`) — ein Mount ist kein Nachspielen, ein „↻ Neu" schon.
  onReset?: ((anlass: ArenaResetAnlass) => void) | null;
  onResults?: ((byTeam: StageLiveResultsByTeam) => void) | null; // meldet die Live-Ergebnisse aufgedeckter Spieler an den Host (Team-Drawer)
  topPlayers?: { rows: DisciplineStageTopPlayer[]; ids: (string | null)[] } | null;
  primitive?: StagePrimitive;
  disciplineId?: string; // Disziplin-Identität für die Feld-Registry (mehrere Diszis teilen sich ein Primitive)
  progressLabel?: string; // z.B. "Position auf dem Oval = kumulierte Punkte"
  disciplineName?: string; // Feld-Wasserzeichen (Identität je Disziplin)
  accent?: string; // Akzentfarbe der Disziplin (Wasserzeichen + Feldlinien)
  motif?: StageMotif; // dezentes Hintergrund-Motiv
  env?: StageEnv; // atmosphärische Umgebung (Stadion o.ä.) — überschreibt die schlichte Optik
  roomSync?: NativeArenaRoomSync | null; // Co-op-Lockstep (Multiplayer) — solo: null/inert
  /**
   * DIE DISZIPLIN IST IM SPIELSTAND SCHON GEWERTET — Befund B2 aus
   * `docs/AUDIT-INGAME-2026-08-19.md`.
   *
   * Der Host wusste das laengst (`activeSideScoredInSave`), die Buehne fing trotzdem bei Runde 0
   * an: der Knopf lud mit „▶ Start · Etappe 1 / 4" dazu ein, etwas zu starten, das bereits
   * gelaufen ist. GEMESSEN am echten Spielstand — die Arena meldete `data-active-side-scored=true`
   * und der Knopf war trotzdem aktiv.
   *
   * KEIN DATENRISIKO: `commitFinishedDiscipline` bucht eine bereits gewertete Seite nicht noch
   * einmal (`DisciplineStageArena.tsx:2058`). Nachgemessen: die Spielstand-Datei ist nach einem
   * vollen Quick-Sim md5-identisch. Der Schaden ist trotzdem echt — der Spieler laesst etwas
   * laufen, das folgenlos bleibt, und muss selbst darauf kommen, warum.
   *
   * WARUM NICHT EINFACH `round` AUF FERTIG SETZEN: dann zeigte die Buehne „gewertet" ueber
   * einem Rundenstand aus lauter Nullen — nichts ist ja gelaufen. Eine falsche Zahl ist
   * schlimmer als eine fehlende. Der Knopf sagt stattdessen, was er WIRKLICH tut: nachspielen.
   */
  alreadyScored?: boolean;
};

// Co-op-Lockstep-Steuerung aus dem Room (DisciplineStageArena verdrahtet den Hook).
// Nur der Host advanced; der Guest zieht `round` auf `syncedRound` nach. Die Pause des
// Hosts (Hover/Space) propagiert implizit — er sendet dann keinen weiteren Schritt.
export type NativeArenaRoomSync = {
  active: boolean; // Reveal-Sync im Room aktiv (mind. 2 Teilnehmer / Sync läuft)
  isHost: boolean; // dieser Client ist der Host (Rolle A)
  canControl: boolean; // darf lokal starten/advancen (Host, oder solo-im-Room)
  waitingForHost: boolean; // reiner UI-Hinweis: Guest, und der Host hat den Reveal noch nicht gestartet
  // Steuerflag: dieser Client advanced nie selbst, sondern zieht `round` auf `syncedRound` nach.
  // Bewusst NICHT `waitingForHost` — das ist nur bis zum Host-Start true und damit genau dann
  // falsch, wenn die Host-Schritte tatsaechlich eintreffen.
  followsHost: boolean;
  syncedRound: number; // vom Host getriebener Ziel-Reveal-Index (slotRevealIndex)
  onHostAdvanced: () => void; // Host: bei jedem eigenen Schritt an den Room melden
  coopGate: {
    active: boolean; // „beide bereit"-Gate aktiv → Reveal blockiert bis alle ready
    isSelfReady: boolean; // eigener Ready-Status
    waitingNames: string[]; // Namen der noch nicht bereiten Teilnehmer
    onToggleReady: () => void; // eigenen Ready-Status umschalten
    /**
     * DER BENANNTE NOTAUSGANG (Entscheidung von Chris, 18.08.).
     *
     * Ein getrennter Mitspieler haelt das Bereit-Tor jetzt auf — sonst zoege der Host an jemandem
     * vorbei, der rausgeflogen ist, ohne je bereit gewesen zu sein. Damit die Enthuellung dabei
     * nicht haengen bleiben kann, darf der Host GENAU DIESE Leute ausdruecklich uebergehen. Nur
     * gesetzt, wenn ausschliesslich Getrennte blockieren; der Server prueft es noch einmal nach.
     */
    canSkipDisconnected?: boolean;
    disconnectedBlockerNames?: string[];
    onSkipDisconnected?: () => void;
  };
  /**
   * Audit-Punkt 5 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): Namen der Mitspieler, die gerade
   * GETRENNT sind ("Franky ist getrennt"). Bewusst getrennt von `coopGate.waitingNames` — ein
   * Getrennter HAELT das Bereit-Tor inzwischen auf (siehe `getRoomArenaRequiredParticipantIds`,
   * `arena-sync-state.ts`) — umso wichtiger, dass er sichtbar ist: sonst sucht der Host den Grund
   * fuer den Stillstand bei sich. Leer/undefiniert ⇒ kein Hinweis (Solo/alle verbunden).
   */
  disconnectedNames?: string[];
  /**
   * GEMEINSAME ZEITBASIS (Befund B4, Stufe 3.2/3.3/3.4/3.6, `lib/foundation/discipline-stage/
   * arena-timeline.ts`). ALLE Felder hier sind optional und wirkungslos, solange der Aufrufer
   * (`DisciplineStageArena.tsx`) sie nicht befuellt — ohne sie verhaelt sich diese Komponente
   * exakt wie vorher (reine `syncedRound`-Kaskade, rein lokale Pause). Das ist bewusst: Punkt 5
   * der Aufgabe verlangt, dass Solo (kein `roomSync`) sich in NICHTS aendert, und ein
   * unbefuellter Aufrufer ist fuer den Guest-Pfad aequivalent zu "noch kein neues Feld da".
   */
  stepIndex?: number; // RoomArenaState.stepIndex — der EINE monotone Schrittzaehler (Stufe 3.2)
  stepStartedAtMs?: number; // Server-Zeitpunkt (ms), zu dem der aktuelle Schritt begann
  stepDurationMs?: number; // geplante Dauer des aktuellen Schritts
  clockOffsetMs?: number; // Server-minus-Client-Uhrdifferenz dieses Clients
  hostPaused?: boolean; // Pause/Weiter (3.6): vom Host gesetzt, gilt fuer den Guest ebenso
  // Wer die Raum-Pause ausgeloest hat (`RoomArenaState.pausedBy`). `null` = "von keinem Menschen",
  // der Fall nach einem Server-Neustart mitten im Reveal — eine solche Pause bindet auch den HOST
  // (Befund F8, siehe `resolveArenaEffectivePause` in `arena-timeline.ts`). `undefined` = Aufrufer
  // liefert das Feld nicht → unveraendertes Verhalten.
  hostPausedBy?: string | null;
  onHostPauseToggle?: (() => void) | null; // Host: eigene Pause/Weiter an den Raum melden
  onHostReset?: (() => void) | null; // Host: „↻ Neu" an den Raum melden
  onHostQuickSim?: (() => void) | null; // Host: Quick-Sim an den Raum melden
};

export type StageMotif = "chevrons" | "combat" | "board" | "court" | "weights" | "grid" | "ice" | "stage" | "plates" | "skyline" | "none";

// Atmosphärische Umgebung je Primitive (Fable-Konzept): Farbschichten +
// Lichtstimmung + 0-2 Deko-Layer. Alle Werte hsl()/rgb() (kein Hex → Lint).
export type StageEnv = {
  sky: [string, string]; // Hintergrund-Verlauf (oben, unten) — alle Primitive
  stands: string; // Rückwand: track=Tribünenring, lanes/towers=Horizontband
  surface: [string, string, string]; // track=Bahnring; lanes=Bahnfläche; towers=Boden
  line: string; // Markierungen / Ziel / Grundlinie
  infield?: [string, string]; // nur track (Rasen)
  glow?: { color: string; kind: "spot" | "finish" | "floor" | "flood" };
  deco?: StageDeco[]; // hinter den Tokens
};

export type StageDeco =
  | { kind: "skyline"; back: string; front: string; windows: string }
  | { kind: "spotlights"; color: string; count: number }
  | { kind: "lanterns"; color: string; halo: string }
  | { kind: "banners"; cloth: string; trim: string }
  | { kind: "checker"; light: string; dark: string }
  | { kind: "grid"; color: string }
  | { kind: "holds"; colors: string[] }
  | { kind: "sheen"; color: string }
  | { kind: "silhouette"; color: string };

// Dezentes Feld-Motiv je Disziplin (Skin). Bewusst leise (niedrige Deckkraft),
// die Akzentfarbe kommt aus der Disziplin. Kein DOM-Overhead: wenige SVG-Formen.
export function renderMotif(motif: StageMotif | undefined, W: number, H: number, accent: string): React.ReactNode {
  if (!motif || motif === "none") return null;
  const c = accent;
  const op = 0.5;
  if (motif === "chevrons") {
    return (
      <g opacity={op} fill="none" stroke={c} strokeWidth={3}>
        {Array.from({ length: 6 }).map((_, i) => {
          const x = W * (0.12 + i * 0.13);
          return <polyline key={i} points={`${x},${H * 0.3} ${x + 26},${H * 0.5} ${x},${H * 0.7}`} />;
        })}
      </g>
    );
  }
  if (motif === "combat") {
    return (
      <g opacity={op} stroke={c} strokeWidth={2.5}>
        {Array.from({ length: 8 }).map((_, i) => {
          const x = W * (0.1 + i * 0.11);
          return (
            <g key={i}>
              <line x1={x} y1={H * 0.34} x2={x + 40} y2={H * 0.66} />
              <line x1={x + 40} y1={H * 0.34} x2={x} y2={H * 0.66} />
            </g>
          );
        })}
      </g>
    );
  }
  if (motif === "board") {
    return (
      <g opacity={op * 0.7} fill={c}>
        {Array.from({ length: 8 }).map((_, r) =>
          Array.from({ length: 8 }).map((_, col) =>
            (r + col) % 2 === 0 ? <rect key={`${r}-${col}`} x={W - 220 + col * 26} y={H / 2 - 104 + r * 26} width={26} height={26} /> : null,
          ),
        )}
      </g>
    );
  }
  if (motif === "court") {
    return (
      <g opacity={op} fill="none" stroke={c} strokeWidth={2.5}>
        <line x1={W / 2} y1={H * 0.12} x2={W / 2} y2={H * 0.88} />
        <circle cx={W / 2} cy={H / 2} r={70} />
      </g>
    );
  }
  if (motif === "weights") {
    return (
      <g opacity={op} fill={c}>
        <rect x={W / 2 - 130} y={H / 2 - 6} width={260} height={12} rx={6} />
        {[-150, -120, 120, 150].map((dx, i) => (
          <rect key={i} x={W / 2 + dx - 6} y={H / 2 - 44} width={12} height={88} rx={4} />
        ))}
      </g>
    );
  }
  if (motif === "grid") {
    return (
      <g opacity={op * 0.8} fill={c}>
        {Array.from({ length: 7 }).map((_, r) =>
          Array.from({ length: 12 }).map((_, col) => <circle key={`${r}-${col}`} cx={W * (0.1 + col * 0.072)} cy={H * (0.16 + r * 0.11)} r={4} />),
        )}
      </g>
    );
  }
  if (motif === "ice") {
    return (
      <g opacity={op} stroke={c} strokeWidth={2}>
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={i} x1={W * 0.08} y1={H * (0.2 + i * 0.1)} x2={W * 0.92} y2={H * (0.2 + i * 0.1)} strokeDasharray="30 22" />
        ))}
      </g>
    );
  }
  if (motif === "stage") {
    return (
      <g opacity={op * 0.8} fill={c}>
        <polygon points={`${W * 0.28},0 ${W * 0.4},0 ${W * 0.5},${H} ${W * 0.34},${H}`} />
        <polygon points={`${W * 0.62},0 ${W * 0.74},0 ${W * 0.66},${H} ${W * 0.5},${H}`} />
      </g>
    );
  }
  if (motif === "plates") {
    return (
      <g opacity={op} fill="none" stroke={c} strokeWidth={2.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <circle key={i} cx={W * (0.18 + i * 0.16)} cy={H / 2} r={44} />
        ))}
      </g>
    );
  }
  // skyline
  return (
    <g opacity={op} fill={c}>
      {Array.from({ length: 14 }).map((_, i) => {
        const bw = W / 16;
        const bh = H * (0.18 + ((i * 37) % 40) / 100);
        return <rect key={i} x={W * 0.06 + i * bw} y={H - bh - 4} width={bw - 6} height={bh} />;
      })}
    </g>
  );
}

// Lichtstimmung (ein Layer, per kind positioniert). groundY = Boden/Grundlinie.
export function envGlow(glow: NonNullable<StageEnv["glow"]>, W: number, H: number, groundY: number, finishX: number): React.ReactNode {
  const c = glow.color;
  if (glow.kind === "spot") {
    return <ellipse cx={W / 2} cy={groundY - 90} rx={210} ry={72} fill={c} opacity={0.16} />;
  }
  if (glow.kind === "floor") {
    return <rect x={0} y={groundY - 26} width={W} height={30} fill={c} opacity={0.13} />;
  }
  if (glow.kind === "finish") {
    return (
      <g>
        <rect x={finishX - 16} y={0} width={32} height={H} fill={c} opacity={0.12} />
        <rect x={finishX - 2} y={0} width={4} height={H} fill={c} opacity={0.55} />
      </g>
    );
  }
  // flood — zwei Lichtkegel von oben
  return (
    <g fill={c} opacity={0.1}>
      <polygon points={`${W * 0.3},0 ${W * 0.42},0 ${W * 0.52},${H} ${W * 0.36},${H}`} />
      <polygon points={`${W * 0.58},0 ${W * 0.7},0 ${W * 0.64},${H} ${W * 0.48},${H}`} />
    </g>
  );
}

// Deko-Layer (Daten → SVG). groundY = Boden für skyline/silhouette.
export function envDeco(deco: StageDeco, W: number, H: number, groundY: number, key: number): React.ReactNode {
  if (deco.kind === "skyline") {
    return (
      <g key={key}>
        <g fill={deco.back} opacity={0.9}>
          {Array.from({ length: 11 }).map((_, i) => {
            const bw = W / 11;
            const bh = H * (0.16 + ((i * 53) % 34) / 100);
            return <rect key={i} x={i * bw} y={groundY - bh} width={bw + 1} height={bh} />;
          })}
        </g>
        <g fill={deco.front}>
          {Array.from({ length: 8 }).map((_, i) => {
            const bw = W / 8;
            const bh = H * (0.1 + ((i * 71) % 26) / 100);
            return <rect key={i} x={i * bw + 12} y={groundY - bh} width={bw - 24} height={bh} />;
          })}
        </g>
        <g fill={deco.windows} opacity={0.85}>
          {Array.from({ length: 8 }).flatMap((_, i) =>
            Array.from({ length: 4 }).map((__, r) => {
              const on = (i * 7 + r * 13) % 3 === 0;
              return on ? <rect key={`${i}-${r}`} x={i * (W / 8) + 24 + (r % 2) * 14} y={groundY - 34 - r * 16} width={5} height={7} /> : null;
            }),
          )}
        </g>
      </g>
    );
  }
  if (deco.kind === "spotlights") {
    return (
      <g key={key} fill={deco.color} opacity={0.16}>
        {Array.from({ length: deco.count }).map((_, i) => {
          const cx = W * (0.5 + (i - (deco.count - 1) / 2) * 0.22);
          return <polygon key={i} points={`${cx - 12},0 ${cx + 12},0 ${cx + 90},${H} ${cx - 90},${H}`} />;
        })}
      </g>
    );
  }
  if (deco.kind === "lanterns") {
    return (
      <g key={key}>
        {Array.from({ length: 6 }).map((_, i) => {
          const cx = W * (0.12 + i * 0.152);
          return (
            <g key={i}>
              <circle cx={cx} cy={44} r={16} fill={deco.halo} opacity={0.3} />
              <circle cx={cx} cy={44} r={7} fill={deco.color} />
            </g>
          );
        })}
      </g>
    );
  }
  if (deco.kind === "banners") {
    return (
      <g key={key}>
        {Array.from({ length: 3 }).map((_, i) => {
          const cx = W * (0.24 + i * 0.26);
          return (
            <g key={i}>
              <rect x={cx - 16} y={40} width={32} height={72} fill={deco.cloth} opacity={0.85} />
              <polygon points={`${cx - 16},112 ${cx + 16},112 ${cx},130`} fill={deco.cloth} opacity={0.85} />
              <rect x={cx - 16} y={40} width={32} height={6} fill={deco.trim} />
            </g>
          );
        })}
      </g>
    );
  }
  if (deco.kind === "checker") {
    return (
      <g key={key} opacity={0.1}>
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 16 }).map((__, col) =>
            (r + col) % 2 === 0 ? <rect key={`${r}-${col}`} x={col * (W / 16)} y={H * 0.4 + r * 24} width={W / 16} height={24} fill={deco.light} /> : <rect key={`${r}-${col}`} x={col * (W / 16)} y={H * 0.4 + r * 24} width={W / 16} height={24} fill={deco.dark} />,
          ),
        )}
      </g>
    );
  }
  if (deco.kind === "grid") {
    return (
      <g key={key} stroke={deco.color} strokeWidth={1.4} opacity={0.15} fill="none">
        {[0.55, 0.68, 0.8, 0.92].map((f, i) => (
          <line key={i} x1={0} y1={H * f} x2={W} y2={H * f} />
        ))}
        {Array.from({ length: 13 }).map((_, i) => {
          const x = (i / 12) * W;
          return <line key={i} x1={x} y1={H * 0.55} x2={W / 2 + (x - W / 2) * 2.2} y2={H} />;
        })}
      </g>
    );
  }
  if (deco.kind === "holds") {
    return (
      <g key={key} opacity={0.5}>
        {Array.from({ length: 26 }).map((_, i) => {
          const x = ((i * 137.5) % 96) / 100;
          const y = ((i * 71) % 80) / 100;
          const col = deco.colors[i % deco.colors.length];
          return <circle key={i} cx={W * (0.03 + x * 0.94)} cy={H * (0.08 + y)} r={i % 3 === 0 ? 7 : 5} fill={col} />;
        })}
      </g>
    );
  }
  if (deco.kind === "sheen") {
    return <polygon key={key} points={`${W * 0.1},0 ${W * 0.28},0 ${W * 0.6},${H} ${W * 0.42},${H}`} fill={deco.color} opacity={0.12} />;
  }
  // silhouette — gezackter Horizont (Palisade/Bäume)
  const pts: string[] = [`0,${groundY}`];
  const n = 20;
  for (let i = 0; i <= n; i += 1) {
    const x = (i / n) * W;
    const h = groundY - 26 - ((i * 47) % 34);
    pts.push(`${x},${h}`, `${x + W / n / 2},${groundY - 14}`);
  }
  pts.push(`${W},${groundY}`);
  return <polygon key={key} points={pts.join(" ")} fill={deco.color} opacity={0.9} />;
}

// Wegpunkt-Pfad als SVG-d (für Serpentine/Parcours-Route).
function wpPath(wp: [number, number][]): string {
  return wp.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
}

// Atmosphärisches Feld für die Szenen-Primitive. Alle Layer HINTER den Tokens,
// Farben aus env (hsl/rgba/CSS-Token, kein Hex → Design-Token-Lint bleibt sauber).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderSceneEnvBg(prim: StagePrimitive, env: StageEnv, layout: any, W: number, H: number): React.ReactNode {
  if (prim === "peloton") {
    const { roadY, padL, padR } = layout;
    return (
      <>
        <rect x={0} y={roadY + 46} width={W} height={H - roadY - 46} fill={env.surface[2]} opacity={0.5} />
        <line x1={padL} y1={roadY} x2={W - padR} y2={roadY} stroke={env.stands} strokeWidth={78} strokeLinecap="round" />
        <line x1={padL} y1={roadY} x2={W - padR} y2={roadY} stroke="url(#envSurface)" strokeWidth={64} strokeLinecap="round" />
        <line x1={padL} y1={roadY} x2={W - padR} y2={roadY} stroke={env.line} strokeWidth={2} strokeDasharray="6 24" opacity={0.5} />
        <rect x={W - padR - 10} y={roadY - 40} width={5} height={80} fill={env.line} opacity={0.85} />
        <text x={W - padR - 18} y={roadY - 48} textAnchor="end" fontSize={16} fontWeight={800} fill={env.line} opacity={0.9}>🏁 Ziel</text>
      </>
    );
  }
  if (prim === "mountain") {
    const wp: [number, number][] = layout.wp;
    return (
      <>
        <circle cx={W * 0.5} cy={H * 0.1} r={W * 0.11} fill={env.glow?.color ?? env.line} opacity={0.22} />
        {/* Bergprofil */}
        <polygon
          points={`0,${H} ${W * 0.2},${H * 0.62} ${W * 0.37},${H * 0.74} ${W * 0.5},${H * 0.12} ${W * 0.63},${H * 0.46} ${W * 0.83},${H * 0.27} ${W},${H * 0.56} ${W},${H}`}
          fill={env.surface[2]}
          stroke={env.stands}
          strokeWidth={1.5}
        />
        {/* Schneegipfel */}
        <polygon points={`${W * 0.46},${H * 0.2} ${W * 0.5},${H * 0.12} ${W * 0.54},${H * 0.22} ${W * 0.51},${H * 0.24} ${W * 0.5},${H * 0.2} ${W * 0.485},${H * 0.24}`} fill={env.line} opacity={0.85} />
        {/* Serpentinen-Route */}
        <path d={wpPath(wp)} fill="none" stroke={env.stands} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
        <path d={wpPath(wp)} fill="none" stroke={env.line} strokeWidth={2} strokeDasharray="3 12" opacity={0.55} />
        <text x={W * 0.5} y={H * 0.09} textAnchor="middle" fontSize={20}>🚩</text>
      </>
    );
  }
  if (prim === "parcours") {
    const wp: [number, number][] = layout.wp;
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill="url(#envSurface)" opacity={0.35} />
        <path d={wpPath(wp)} fill="none" stroke={env.stands} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <path d={wpPath(wp)} fill="none" stroke={env.surface[0]} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
        <path d={wpPath(wp)} fill="none" stroke={env.line} strokeWidth={2} strokeDasharray="2 12" opacity={0.5} />
        <circle cx={wp[0]![0]} cy={wp[0]![1]} r={9} fill="none" stroke={env.line} strokeWidth={2.5} />
        <text x={wp[0]![0]} y={wp[0]![1] - 14} textAnchor="middle" fontSize={12} fontWeight={800} fill={env.line}>START</text>
        <text x={wp[wp.length - 1]![0]} y={wp[wp.length - 1]![1] + 22} textAnchor="middle" fontSize={16}>🏁</text>
      </>
    );
  }
  if (prim === "bump") {
    const { pL, pR, top, bot } = layout;
    const stages: number = Math.max(1, layout.stagesTotal ?? 1);
    const innerW = W - pL - pR;
    const rows = 6;
    return (
      <>
        <rect x={pL - 20} y={top - 20} width={innerW + 40} height={bot - top + 44} rx={12} fill="url(#envSurface)" opacity={0.35} />
        {/* Rang-Führungslinien (oben = Spitze) */}
        {Array.from({ length: rows }).map((_, i) => {
          const y = top + (i / (rows - 1)) * (bot - top);
          return <line key={i} x1={pL} y1={y} x2={W - pR} y2={y} stroke={env.line} strokeWidth={1} strokeDasharray="2 10" opacity={0.22} />;
        })}
        {/* Etappen-Spalten + Labels */}
        {Array.from({ length: stages }).map((_, s) => {
          const x = pL + (stages > 1 ? s / (stages - 1) : 0.5) * innerW;
          return (
            <g key={s}>
              <line x1={x} y1={top} x2={x} y2={bot} stroke={env.stands} strokeWidth={1.4} opacity={0.5} />
              <text x={x} y={bot + 22} textAnchor="middle" fontSize={12} fontWeight={700} fill={env.line} opacity={0.75}>
                {`E${s + 1}`}
              </text>
            </g>
          );
        })}
        <text x={pL - 24} y={top + 4} textAnchor="end" fontSize={11} fontWeight={800} fill={env.line} opacity={0.8}>🏁</text>
        <text x={pL - 6} y={top - 6} textAnchor="start" fontSize={11} fontWeight={800} fill={env.line} opacity={0.7} style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Spitze</text>
      </>
    );
  }
  if (prim === "kda") {
    // TDM — taktisches Deathmatch-HUD als Overlay über die Bahn-Reihen (Board):
    // Neon-rote Scoreboard-Kante, CRT-Scanlines, Fadenkreuz-Wasserzeichen (⌖),
    // angedeutete Spaltenkanten. Kein 3D-Feld, alles hsl()/rgba().
    const { top, xStart, xEnd } = layout;
    const red = "hsl(2 78% 60%)";
    const lines = Math.floor(H / 3);
    return (
      <>
        {/* neon-rote Trennkante unter dem Scoreboard-Kopf */}
        <rect x={0} y={top - 2} width={W} height={2} fill={red} opacity={0.5} />
        {/* CRT-Scanlines übers ganze HUD (statisch) */}
        <g style={{ pointerEvents: "none" }}>
          {Array.from({ length: lines }).map((_, i) => (
            <line key={i} x1={0} y1={i * 3} x2={W} y2={i * 3} stroke={red} strokeWidth={1} opacity={0.035} />
          ))}
        </g>
        {/* Fadenkreuz-Wasserzeichen (⌖) — HUD-Identität */}
        <text x={W / 2} y={H / 2 + 8} textAnchor="middle" dominantBaseline="central" fontSize={H * 0.62} fill={red} opacity={0.05} style={{ pointerEvents: "none" }}>
          ⌖
        </text>
        {/* angedeutete Board-Spaltenkanten links/rechts */}
        <line x1={xStart - 8} y1={top} x2={xStart - 8} y2={H - top + 8} stroke={red} strokeWidth={1} opacity={0.22} />
        <line x1={xEnd + 8} y1={top} x2={xEnd + 8} y2={H - top + 8} stroke={red} strokeWidth={1} opacity={0.22} />
      </>
    );
  }
  if (prim === "court") {
    const { cx, hoopY, baseY, baseHalf } = layout;
    const keyW = baseHalf * 0.42;
    const keyH = (baseY - hoopY) * 0.5;
    const courtL = cx - baseHalf;
    const courtT = hoopY - 20;
    const courtBot = baseY + 20;
    const courtH = courtBot - courtT;
    const midY = (hoopY + baseY) / 2 + 26;
    const floodC = env.glow?.color ?? env.line;
    // Hallen-Bowl: dunkler Rand + Zuschauer-Ränge (Punkt-Reihen) rund um den Court.
    const seatFill = (i: number) => (i % 4 === 0 ? "hsl(28 48% 42%)" : env.stands);
    const crowd: React.ReactNode[] = [];
    for (let row = 0; row < 3; row += 1) {
      const y = 12 + row * 15;
      for (let i = 0; i < 42; i += 1) {
        const x = 22 + i * ((W - 44) / 41);
        crowd.push(<circle key={`ct${row}-${i}`} cx={x} cy={y} r={2.3} fill={seatFill(i + row)} opacity={0.5} />);
      }
    }
    for (let col = 0; col < 2; col += 1) {
      for (let i = 0; i < 18; i += 1) {
        const y = 96 + i * ((baseY - 70) / 17);
        crowd.push(<circle key={`csl${col}-${i}`} cx={14 + col * 15} cy={y} r={2.3} fill={seatFill(i + col)} opacity={0.45} />);
        crowd.push(<circle key={`csr${col}-${i}`} cx={W - 14 - col * 15} cy={y} r={2.3} fill={seatFill(i + col + 1)} opacity={0.45} />);
      }
    }
    return (
      <>
        {/* dunkler Arena-Rand (Bowl) */}
        <rect x={0} y={0} width={W} height={H} fill={env.sky[1]} opacity={0.55} />
        {crowd}
        {/* Parkett-Boden */}
        <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtH} rx={12} fill="url(#envSurface)" stroke={env.stands} strokeWidth={6} />
        {/* Parkett-Maserung (Dielen) */}
        <g stroke="hsl(26 46% 26%)" strokeWidth={1.2} opacity={0.32}>
          {Array.from({ length: 20 }).map((_, i) => {
            const x = courtL + 14 + i * ((baseHalf * 2 - 28) / 19);
            return <line key={i} x1={x} y1={courtT + 5} x2={x} y2={courtBot - 5} />;
          })}
        </g>
        {/* Flutlicht — radialer Aufheller von oben */}
        <defs>
          <radialGradient id="courtFlood" cx="50%" cy="0%" r="64%">
            <stop offset="0%" stopColor={floodC} stopOpacity={0.26} />
            <stop offset="100%" stopColor={floodC} stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={courtL} y={courtT} width={baseHalf * 2} height={courtH} rx={12} fill="url(#courtFlood)" />
        {/* Center-Court-Logo */}
        <circle cx={cx} cy={midY} r={keyW * 0.78} fill="none" stroke={env.line} strokeWidth={2} opacity={0.34} />
        <circle cx={cx} cy={midY} r={keyW * 0.5} fill="none" stroke={env.line} strokeWidth={1.4} opacity={0.26} />
        <text x={cx} y={midY + 15} textAnchor="middle" fontSize={42} opacity={0.15}>🏀</text>
        {/* Zonen-Schlüssel */}
        <rect x={cx - keyW} y={hoopY} width={keyW * 2} height={keyH} fill="none" stroke={env.line} strokeWidth={2.5} opacity={0.7} />
        <circle cx={cx} cy={hoopY + keyH} r={keyW} fill="none" stroke={env.line} strokeWidth={2.5} opacity={0.7} />
        {/* Drei-Punkte-Bogen */}
        <path d={`M ${cx - baseHalf * 0.9} ${hoopY} A ${baseHalf * 0.9} ${baseY - hoopY} 0 0 0 ${cx + baseHalf * 0.9} ${hoopY}`} fill="none" stroke={env.line} strokeWidth={2.5} opacity={0.6} />
        {/* Backboard + Korb + Netz */}
        <rect x={cx - 34} y={hoopY - 32} width={68} height={22} rx={2} fill={env.stands} stroke={env.line} strokeWidth={2} opacity={0.92} />
        <rect x={cx - 13} y={hoopY - 28} width={26} height={13} fill="none" stroke={env.line} strokeWidth={1.6} opacity={0.7} />
        <line x1={cx - 22} y1={hoopY - 8} x2={cx + 22} y2={hoopY - 8} stroke={floodC} strokeWidth={4} />
        <circle cx={cx} cy={hoopY} r={9} fill="none" stroke={floodC} strokeWidth={3} />
        <g stroke={env.line} strokeWidth={1} opacity={0.55} fill="none">
          {[-8, -4, 0, 4, 8].map((dx, i) => (
            <line key={i} x1={cx + dx} y1={hoopY + 2} x2={cx + dx * 0.55} y2={hoopY + 20} />
          ))}
          <line x1={cx - 8.5} y1={hoopY + 9} x2={cx + 8.5} y2={hoopY + 9} />
          <line x1={cx - 6} y1={hoopY + 16} x2={cx + 6} y2={hoopY + 16} />
        </g>
      </>
    );
  }
  // rink
  const { x0, y0, w, hh } = layout;
  const midX = x0 + w / 2;
  return (
    <>
      <rect x={x0} y={y0} width={w} height={hh} rx={44} fill="url(#envSurface)" stroke={env.stands} strokeWidth={4} />
      <ellipse cx={midX} cy={y0 + hh * 0.3} rx={w * 0.42} ry={hh * 0.18} fill={env.glow?.color ?? env.line} opacity={0.12} />
      {/* Blaue Linien (vertikal) + rote Mittellinie */}
      <line x1={x0 + w * 0.32} y1={y0} x2={x0 + w * 0.32} y2={y0 + hh} stroke={env.line} strokeWidth={3} opacity={0.7} />
      <line x1={x0 + w * 0.68} y1={y0} x2={x0 + w * 0.68} y2={y0 + hh} stroke={env.line} strokeWidth={3} opacity={0.7} />
      <line x1={midX} y1={y0} x2={midX} y2={y0 + hh} stroke="hsl(2 70% 55%)" strokeWidth={2.5} opacity={0.8} />
      <circle cx={midX} cy={y0 + hh / 2} r={hh * 0.14} fill="none" stroke={env.line} strokeWidth={1.6} opacity={0.5} />
      {/* Tore: rechts = Angriff */}
      <rect x={x0 + w - 8} y={y0 + hh / 2 - 26} width={12} height={52} rx={3} fill="hsl(41 80% 55%)" opacity={0.85} />
      <rect x={x0 - 4} y={y0 + hh / 2 - 26} width={12} height={52} rx={3} fill={env.stands} opacity={0.85} />
      <text x={x0 + w - 20} y={y0 + 22} textAnchor="end" fontSize={14} fill={env.line} opacity={0.8}>🥅 Angriff →</text>
      <text x={midX} y={y0 + hh / 2 + 8} textAnchor="middle" fontSize={40} opacity={0.14}>🏒</text>
    </>
  );
}

// Liga-Klassen-Bänder (Schach/Tennis): Teams per Score-Lücken in Klassen gruppiert
// (adaptiver Schwellwert ≈ 2.2× mittlere Lücke → splittet an echten Clustern), je
// Band ein Chip-Feld mit Code + Score, Beziehungs-Rahmen, Podest-Medaillen. Voll-
// flächig aus ALLEN aktuellen Scores berechnet (kein Token-auf-Feld). Alle Farben
// hsl()/CSS-Token → Design-Token-Lint bleibt sauber.
const KLASSEN_NAMES = ["Meister", "Anwärter", "Oberhaus", "Mittelfeld", "Abstieg", "Keller"];
const KLASSEN_MEDALS = ["🥇", "🥈", "🥉"];
export function renderKlassenBands(
  sorted: RT[],
  W: number,
  H: number,
  env: StageEnv,
  onOpenTeam?: ((teamId: string) => void) | null,
  onHoverTeam?: ((teamId: string | null) => void) | null,
  // Anzeige-Punkte (Host: shownScore) — dieselbe Groesse, aus der auch Rangliste und
  // Rang-Badges rechnen. Ohne sie liefen Baender/Chips dem animierten Feld voraus.
  scoreOf: (t: RT) => number = (t) => t.score,
): React.ReactNode {
  const n = sorted.length;
  if (n === 0) return null;
  const max = scoreOf(sorted[0]!);
  const min = scoreOf(sorted[n - 1]!);
  const avgGap = n > 1 ? (max - min) / (n - 1) : 0;
  const th = Math.max(0.5, avgGap * 2.2);
  const groups: RT[][] = [[sorted[0]!]];
  for (let i = 1; i < n; i += 1) {
    if (scoreOf(sorted[i - 1]!) - scoreOf(sorted[i]!) > th) groups.push([sorted[i]!]);
    else groups[groups.length - 1]!.push(sorted[i]!);
  }
  const padX = 40;
  const padTop = 46;
  const padBot = 20;
  const innerW = W - padX * 2;
  const chipW = 92;
  const gapX = 8;
  const gapY = 7;
  const headH = 22;
  const bandPadTop = 6;
  const bandGap = 12;
  const perRow = Math.max(1, Math.floor((innerW + gapX) / (chipW + gapX)));
  const bandRows = groups.map((g) => Math.ceil(g.length / perRow));
  const rowsTotal = bandRows.reduce((s, r) => s + r, 0);
  const headerBlock = headH + bandPadTop + 8;
  const availH = H - padTop - padBot;
  const availForRows = availH - groups.length * headerBlock - bandGap * (groups.length - 1);
  const rowUnit = Math.max(16, Math.min(26 + gapY, availForRows / Math.max(1, rowsTotal)));
  const chipH = Math.max(14, rowUnit - gapY);
  let y = padTop;
  const nodes: React.ReactNode[] = [];
  groups.forEach((g, gi) => {
    const rows = bandRows[gi]!;
    const bandH = headH + bandPadTop + rows * chipH + (rows - 1) * gapY + 8;
    const hi = Math.max(...g.map((t) => scoreOf(t)));
    const lo = Math.min(...g.map((t) => scoreOf(t)));
    const youBand = g.some((t) => t.isOwn);
    nodes.push(
      <g key={`band-${gi}`}>
        <rect x={padX - 12} y={y} width={innerW + 24} height={bandH} rx={12} fill={env.stands} opacity={0.3} stroke={youBand ? "var(--nl-accent)" : env.line} strokeWidth={youBand ? 2 : 1} strokeOpacity={youBand ? 0.9 : 0.22} />
        <text x={padX} y={y + 15} fontSize={13} fontWeight={800} fill={env.line} style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {KLASSEN_NAMES[gi] ?? `Klasse ${gi + 1}`}
        </text>
        <text x={padX + innerW} y={y + 15} textAnchor="end" fontSize={11} fontWeight={700} fill={env.line} opacity={0.7}>
          {`${g.length} · ${fmt1(lo)}–${fmt1(hi)}`}
        </text>
        {g.map((t, ci) => {
          const rr = Math.floor(ci / perRow);
          const cc = ci % perRow;
          const cx = padX + cc * (chipW + gapX);
          const cy = y + headH + bandPadTop + rr * (chipH + gapY);
          const rc = relColor(t.rel);
          const med = t.rank <= 3 ? KLASSEN_MEDALS[t.rank - 1] : "";
          // Konsistent zu Token/Ladder/Territory/Duelhp: Chip hovern → Team-Vorschau
          // am Cursor, Klick → Team-Drawer. (Zuvor hatte klassen/Schach+Tennis keine
          // Feld-Interaktion — Team-Karte war nur über Ladder/Tabelle erreichbar.)
          const teamClickable = Boolean(onOpenTeam && t.teamId);
          return (
            <g
              key={t.code}
              style={{ cursor: teamClickable ? "pointer" : "default" }}
              onMouseEnter={onHoverTeam && t.teamId ? () => onHoverTeam(t.teamId!) : undefined}
              onMouseLeave={onHoverTeam ? () => onHoverTeam(null) : undefined}
              onClick={teamClickable ? () => onOpenTeam!(t.teamId!) : undefined}
            >
              <rect x={cx} y={cy} width={chipW} height={chipH} rx={7} fill={t.isOwn ? "color-mix(in srgb, var(--nl-accent) 22%, transparent)" : "var(--nl-panel)"} stroke={rc ?? (t.isOwn ? "var(--nl-accent)" : env.line)} strokeWidth={rc || t.isOwn ? 2 : 1} strokeOpacity={rc || t.isOwn ? 0.95 : 0.3} />
              <text x={cx + 8} y={cy + chipH / 2 + 4} fontSize={11.5} fontWeight={800} fill={t.isOwn ? "var(--nl-accent)" : env.line}>
                {med}
                {t.code}
              </text>
              <text x={cx + chipW - 8} y={cy + chipH / 2 + 4} textAnchor="end" fontSize={10.5} fontWeight={700} fill={env.line} opacity={0.78}>
                {fmt1(scoreOf(t))}
              </text>
            </g>
          );
        })}
      </g>,
    );
    y += bandH + bandGap;
  });
  return <>{nodes}</>;
}

// Squarified Treemap (Battlefield-Gebietseroberung): ganzes Feld = 100 %, Zellen-
// Fläche ∝ Score. Port des klassischen Squarify-Algorithmus (Bruls et al.). Teams
// ohne Punkte haben noch kein Gebiet erobert und erscheinen nicht. %-Label je Zone,
// 🚩 auf die größte, Beziehungs-Rahmen. Alle Farben hsl()/rgb()/Token → Lint-sauber.
type TreemapCell = { t: RT; x: number; y: number; w: number; h: number };
function squarifyTreemap(items: { v: number; t: RT }[], W: number, H: number): TreemapCell[] {
  let total = 0;
  for (const it of items) total += it.v;
  if (total <= 0) return [];
  const scale = (W * H) / total;
  const vals = items.map((it) => ({ it, a: it.v * scale }));
  const out: TreemapCell[] = [];
  let x = 0;
  let y = 0;
  let w = W;
  let h = H;
  let i0 = 0;
  const worst = (row: { a: number }[], side: number): number => {
    let s = 0;
    let mx = -Infinity;
    let mn = Infinity;
    for (const rr of row) {
      s += rr.a;
      if (rr.a > mx) mx = rr.a;
      if (rr.a < mn) mn = rr.a;
    }
    if (s <= 0) return Infinity;
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (i0 < vals.length) {
    const side = Math.min(w, h);
    const row = [vals[i0]!];
    let j = i0 + 1;
    while (j < vals.length) {
      const cur = worst(row, side);
      row.push(vals[j]!);
      const nx = worst(row, side);
      if (nx > cur) {
        row.pop();
        break;
      }
      j += 1;
    }
    let s = 0;
    for (const rr of row) s += rr.a;
    if (w >= h) {
      const rw = s / h;
      let cy = y;
      for (const rr of row) {
        const rh = rr.a / rw;
        out.push({ t: rr.it.t, x, y: cy, w: rw, h: rh });
        cy += rh;
      }
      x += rw;
      w -= rw;
    } else {
      const rh2 = s / w;
      let cx = x;
      for (const rr of row) {
        const rw2 = rr.a / rh2;
        out.push({ t: rr.it.t, x: cx, y, w: rw2, h: rh2 });
        cx += rw2;
      }
      y += rh2;
      h -= rh2;
    }
    i0 = j;
  }
  return out;
}
export function renderTerritory(sorted: RT[], W: number, H: number, env: StageEnv): React.ReactNode {
  const items = sorted.filter((t) => t.score > 0).map((t) => ({ v: t.score, t }));
  if (items.length === 0) {
    return (
      <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={18} fontWeight={800} fill={env.line} opacity={0.6}>
        Gebiet noch unerobert — erste Wertung startet gleich
      </text>
    );
  }
  const total = items.reduce((s, it) => s + it.v, 0);
  const cells = squarifyTreemap(items, W, H);
  const max = sorted[0]!.score;
  const min = sorted[sorted.length - 1]!.score;
  const span = max - min;
  const topCode = sorted[0]!.code;
  const INK = "hsl(210 30% 96%)";
  return (
    <>
      {cells.map((c) => {
        const t = c.t;
        const nm = span > 0 ? Math.max(0, Math.min(1, (t.score - min) / span)) : 1;
        const rc = relColor(t.rel);
        const med = t.rank === 1 ? "var(--nl-gold)" : t.rank === 2 ? "var(--nl-silver)" : t.rank === 3 ? "var(--nl-bronze)" : null;
        // Beziehungsfarbe (rc) ist NUR Rahmen, nie Füllung (zell-übergreifender Kontrakt):
        // die Zellfläche bleibt Medaillen-/Teamfarbe, rc kommt unten als stroke dazu (FIX B).
        const fill = med ?? "hsl(80 40% 42%)";
        const pv = (t.score / total) * 100;
        const x = c.x + 1;
        const y = c.y + 1;
        const w = Math.max(0, c.w - 2);
        const h = Math.max(0, c.h - 2);
        const big = w > 54 && h > 40;
        const mid = w > 34 && h > 18;
        return (
          <g key={t.code}>
            <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} fillOpacity={0.4 + nm * 0.5} stroke={rc ?? "rgba(0,0,0,0.55)"} strokeWidth={rc ? 2.4 : 1} />
            {big ? (
              <>
                <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontSize={w > 90 ? 14 : 11} fontWeight={800} fill={INK}>
                  {t.code}
                </text>
                <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fontSize={10} fill={INK} opacity={0.85}>
                  {/* Formatfix (Durchklick): Hauskomma statt toFixed-Punkt („95,5%" statt „95.5%"). */}
                  {fmt1(pv)}%
                </text>
              </>
            ) : mid ? (
              <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={INK}>
                {t.code}
              </text>
            ) : null}
            {t.code === topCode && w > 24 && h > 20 ? (
              <text x={x + w - 4} y={y + 16} textAnchor="end" fontSize={15}>
                🚩
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

export const STAR_MIN = 80;
// Staffel/track: eine Reveal-Runde dauert ~5 s (langsam, folgbar). Innerhalb einer
// Runde peilen ALLE Token gleichzeitig ihre Runden-Endposition an und gleiten
// simultan dorthin (dur = ROUND_MS). Score bleibt Wahrheit; nur die Token-POSITION
// wird pro Runde gemeinsam animiert. Mini-DM (duelhp) läuft über das geteilte
// Chrome + die Registry-Feld-Komponente (arena/disciplines/duelhp.tsx).
// EINE Quelle statt zweier zufaellig gleicher Zahlen (Stufe 3.3): der Wert steht jetzt in
// `arena-timeline.ts` (`ARENA_STEP_DURATION_MS`), weil die gemeinsame Zeitbasis im Raum-Zustand
// dieselbe Schrittdauer braucht wie diese Komponente ihre lokale Reveal-Kaskade. Re-exportiert
// unter dem alten Namen, damit `disciplines/*.tsx` (barbell.tsx, shared.tsx, …) unveraendert bleiben.
export const TRACK_ROUND_MS = ARENA_STEP_DURATION_MS;
// viewBox + Token-Radien je Primitive. Der Rest (Engine/FX/Ticker/Podest/Tabelle)
// ist geometrieunabhängig; nur Feld-Layout + tokenPos unterscheiden sich.
//
// LESBARKEIT DER WAPPEN (Owner-Wunsch): die Logo-Radien sind gegenüber der
// Erstfassung durchgehend ~20 % größer — dafür sitzt der normale Team-Rahmen in
// `TokenChrome` jetzt DÜNNER und ENGER am Logo. Netto bleibt das Token damit fast
// gleich groß (Feld-Layouts/Bahnabstände kippen nicht), aber die Fläche, die auf
// das Wappen entfällt, wächst spürbar — genau das, was man erkennen will.
const PRIM_GEO: Record<StagePrimitive, { w: number; h: number; r: number; rOwn: number }> = {
  track: { w: 1180, h: 620, r: 15.5, rOwn: 23 },
  // Kompakt: 32 Bahnen passen in einen normalen Viewport (~640px hoch bei voller Breite).
  lanes: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  towers: { w: 1180, h: 600, r: 12, rOwn: 16.5 },
  // stage — Showcase-Bühne mit Tiefe: perspektivische Ruhm-Treppe zum Podest.
  stage: { w: 1180, h: 640, r: 12, rOwn: 18 },
  // Row-Familie (wie lanes)
  platter: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  lamps: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  spybar: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  kda: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  duelhp: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  // Turm-Familie (wie towers)
  barbell: { w: 1180, h: 600, r: 12, rOwn: 16.5 },
  sparkbar: { w: 1180, h: 600, r: 10.5, rOwn: 15.5 },
  thermometer: { w: 1180, h: 600, r: 10.5, rOwn: 15.5 },
  // Szenen
  // peloton (Zeitfahren) war mit h:460 die mit Abstand flachste Szene aller Primitives
  // (naechstniedrigster Wert: 560) — die Strasse blieb dadurch klar kuerzer als die
  // Teams-Tabelle daneben, die sich per ladderMaxH an der Hoehe der Hauptspalte
  // ausrichtet (siehe unten `ladderMaxH`/`mainColRef`). Gemeldet von Chris (Meldung
  // bug-2026-08-04T18-19-57-891Z-64iu51): "aktuell ist sie sehr schmal". Angehoben auf
  // 620 (= track/mountain/court) — die Strassen-Geometrie in peloton.tsx skaliert
  // proportional zu H (roadY = H * 0.54), Rand-Elemente wie Bahnbreite bleiben in
  // Pixeln fix, wachsen also nicht mit — die Szene bekommt dadurch nur mehr Himmel/
  // Wiese oben und unten, keine verzerrte Strasse.
  peloton: { w: 1180, h: 620, r: 13, rOwn: 19 },
  parcours: { w: 1180, h: 560, r: 14, rOwn: 20 },
  bump: { w: 1180, h: 560, r: 8.5, rOwn: 12 },
  mountain: { w: 1180, h: 620, r: 13, rOwn: 19 },
  court: { w: 1180, h: 620, r: 13, rOwn: 19 },
  rink: { w: 1180, h: 560, r: 13, rOwn: 18 },
  klassen: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
  territory: { w: 1180, h: 640, r: 9.5, rOwn: 13 },
};

/**
 * Team-Endsumme GENAU SO aufaddieren, wie der Reveal es tut.
 *
 * `applyReveal` schreibt pro aufgedecktem Spieler `t.score = round1(t.score + net)` — also
 * schrittweise gerundet. Die Ziellinie wurde dagegen als rohe Summe aller `playerNet`
 * gebildet. Beide Wege driften auseinander (bis ~0,05 je Spieler), weshalb das beste Team
 * mit seinem letzten Spieler NEBEN der Linie landete statt darauf.
 *
 * Deshalb hier dieselbe Faltung. Die Ziellinie ist damit per Konstruktion der Endstand des
 * besten Teams — sie verschiebt sich mit den Ergebnissen, wird aber immer exakt erreicht.
 */
/**
 * Startwert der Glide-Rampe einer neuen Etappe.
 *
 * Ist die vorige Etappe ausgeglitten, sind `animScore` und `score` identisch — dann ist die
 * Wahl egal. Wurde dagegen weitergeschaltet, waehrend das Token noch lief (manuelles
 * Weiterklicken, Host-Takt im Co-op, oder weil die virtuelle Etappen-Uhr durch Zeitlupe/
 * Hover hinter der Reveal-Cascade zurueckliegt), steht `score` bereits auf dem vollen
 * Etappen-Endstand, das Token aber noch davor. Dann ist die SICHTBARE Position der richtige
 * Start — sonst springt das Token beim Etappenwechsel vorwaerts.
 *
 * `Math.min` schuetzt gegen einen `animScore`, der (durch Rundung) minimal ueber dem
 * Endstand liegt: rueckwaerts darf eine Etappe nie starten.
 */
export function resolveStageGlideStart(input: { animScore: number; score: number; glideWasRunning: boolean }): number {
  return input.glideWasRunning ? Math.min(input.animScore, input.score) : input.score;
}

export function accumulateRevealedTeamScore(players: Array<NativeStagePlayer | null | undefined>): number {
  let total = 0;
  for (const player of players) total = round1(total + playerNet(player));
  return total;
}

/**
 * Gewichtheben · Kraft-Turm: Endgewicht je Team, MONOTON im Endscore.
 *
 * Die Hantel ist die Inszenierung, der Score die Wertung — damit beide dasselbe erzaehlen, ist
 * das Endgewicht eine rein lineare Abbildung der Team-Summe auf 150…400 kg. Wer mehr Punkte hat,
 * stemmt mehr; die Reihenfolge nach kg IST die Reihenfolge nach Score.
 *
 * DER SCHLUESSEL IST DAS TEAM-KUERZEL, NICHT DIE ARRAY-POSITION — und das ist der Kern des von
 * Chris gemeldeten Fehlers („Anzeige und score passen jetzt nicht mehr zusammen"). Vorher war das
 * Ergebnis ein Array ueber die Position in `teams`, ausgelesen mit `t.idx` aus dem Renderzustand.
 * Der Renderzustand wird aber nur BEIM MOUNT gebaut, waehrend diese Ableitung bei jeder neuen
 * `teams`-Identitaet neu rechnet — und `teams` wird nach dem Werten von Disziplin 1 nach dem
 * aktualisierten Saisonstand UMSORTIERT. Ab da zeigten beide Seiten auf verschiedene
 * Reihenfolgen, und jedes Team bekam das Kilogramm eines anderen.
 *
 * Ein Kuerzel bedeutet in jeder Reihenfolge dasselbe Team. Eine Umsortierung kann daran nichts
 * mehr verschieben — die Eigenschaft haelt per Konstruktion, nicht per Sorgfalt.
 *
 * Als reine Funktion exportiert, damit genau das ohne Arena-Mount pruefbar ist.
 */
export function buildBarbellInfo(
  teams: Array<{ code: string; players: Array<NativeStagePlayer | null | undefined> }>,
) {
  const totalByCode = new Map<string, number>();
  for (const team of teams) {
    totalByCode.set(team.code, accumulateRevealedTeamScore(team.players));
  }
  let maxTot = 0;
  let minTot = Infinity;
  for (const total of totalByCode.values()) {
    if (total > maxTot) maxTot = total;
    if (total < minTot) minTot = total;
  }
  if (!Number.isFinite(minTot)) minTot = 0;
  const span = maxTot - minTot || 1;
  // kg-Skala 150…400 kg (schoene Hantel-Zahlen), monoton im Endscore.
  const endKgByCode = new Map<string, number>();
  for (const [code, total] of totalByCode) {
    endKgByCode.set(code, Math.round(150 + ((total - minTot) / span) * 250));
  }
  let kgMax = 0;
  let kgMin = Infinity;
  for (const kg of endKgByCode.values()) {
    if (kg > kgMax) kgMax = kg;
    if (kg < kgMin) kgMin = kg;
  }
  if (!Number.isFinite(kgMin)) kgMin = 0;
  return { endKgByCode, kgMax, kgMin, axTop: Math.max(0, kgMin - 25), totalByCode };
}

/**
 * Vergleichsrang für die Spalte "Rang Δ" der Ladder: der Stand VOR der gerade
 * gezeigten Etappe.
 *
 * `rankHistory` bekommt am Ende JEDER gewerteten Etappe einen Eintrag mit dem
 * dann gültigen Rang. Solange eine Etappe läuft, ist der letzte Eintrag also
 * der Rang nach der vorigen Etappe — genau der gesuchte Vergleichswert.
 * Im ENDSTAND ist der letzte Eintrag dagegen bereits der Endrang selbst; ein
 * Vergleich damit ergibt immer 0, weshalb dort ausnahmslos "—" stand. Dann
 * zählt der vorletzte Eintrag: der Rang vor der letzten Etappe.
 *
 * `null` heißt "kein Vergleich möglich" (noch keine abgeschlossene Vor-Etappe)
 * — die Zelle zeigt dann bewusst nichts statt einer erfundenen 0.
 */
export function resolveLadderPrevRank(rankHistory: number[], done: boolean): number | null {
  const index = rankHistory.length - (done ? 2 : 1);
  return index >= 0 ? rankHistory[index] ?? null : null;
}
// Piecewise-lineare Interpolation entlang eines Wegpunkt-Pfads (Serpentine/
// Parcours): f ∈ 0…1 → {x,y}. Für mountain/parcours (Token folgt dem Weg).
function interpAlong(wp: [number, number][], f: number): { x: number; y: number } {
  if (wp.length === 0) return { x: 0, y: 0 };
  if (wp.length === 1) return { x: wp[0]![0], y: wp[0]![1] };
  let total = 0;
  const acc: number[] = [0];
  for (let i = 1; i < wp.length; i += 1) {
    total += Math.hypot(wp[i]![0] - wp[i - 1]![0], wp[i]![1] - wp[i - 1]![1]);
    acc.push(total);
  }
  const d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < wp.length; i += 1) {
    if (d <= acc[i]! || i === wp.length - 1) {
      const segLen = acc[i]! - acc[i - 1]!;
      const tt = segLen > 0 ? (d - acc[i - 1]!) / segLen : 0;
      return {
        x: wp[i - 1]![0] + (wp[i]![0] - wp[i - 1]![0]) * tt,
        y: wp[i - 1]![1] + (wp[i]![1] - wp[i - 1]![1]) * tt,
      };
    }
  }
  return { x: wp[wp.length - 1]![0], y: wp[wp.length - 1]![1] };
}
function modSum(mods: NativeStageMod[]): number {
  return mods.reduce((s, m) => s + m.sign * m.amt, 0);
}
// Verletzungs-Erkennung an einem Slot-Mod: bevorzugt der typisierte `injury`-Flag
// (siehe discipline-stage-from-preview.ts), Regex bleibt als Fallback für Datenpfade
// ohne ihn (Random-/Modell-Modus). EINE Quelle — vorher stand dieselbe Regex an vier
// Stellen (noteReveal, Etappen-Vorablauf, Läufer-Karte, Verletzten-Zeile).
export function isInjuryMod(m: NativeStageMod): boolean {
  return m.injury === true || /verletz|injury/i.test(m.k);
}
export function playerNet(p: NativeStagePlayer | null | undefined): number {
  if (!p) return 0;
  // UNGECLAMPT: kann bei schwachem/verletztem Slot + negativen Team-Debuffs auch
  // < 0 sein. So bleibt Σ(net) == engine-score exakt (kein Aufrunden auf 0, das den
  // Team-Total nach oben verzerren würde). Token-Position clampt separat (tokenPos).
  return round1(p.val + modSum(p.mods));
}
// ---- Etappen-Kür (Owner-Wunsch: Highlights = Verletzungen + bester Spieler) ---------
// Minimaler Team-Ausschnitt, den die Kür braucht — bewusst strukturell (kein RT),
// damit die Helfer pur und ohne Arena-Mount testbar bleiben.
export type StageSlotTeam = {
  idx: number;
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  seasonRank: number;
  /**
   * Positionsgetreu: der Index IST die Etappe, `null` heisst „unbesetzt" (Ticket #35). Ein Team
   * mit Spielern auf Slot 5 und 6 hat hier vier fuehrende `null`-Eintraege — vorher rutschten die
   * beiden auf Etappe 1 und 2, unter fremde Rollen-Labels.
   */
  players: Array<NativeStagePlayer | null>;
};
// Reihenfolge einer Etappe: alle Teams nach Netto ihres Slot-Spielers absteigend,
// Tiebreak Season-Rang. DIE eine Quelle für Runden-Slot-Ränge, Etappensieger-Netto
// UND die Kür der Etappen-Top-3 — advance() leitet alle drei hieraus ab.
export function computeSlotOrder<T extends Pick<StageSlotTeam, "seasonRank" | "players">>(
  teams: T[],
  slot: number,
): { t: T; net: number; has: boolean }[] {
  return teams
    .map((t) => ({ t, net: playerNet(t.players[slot]), has: !!t.players[slot] }))
    .sort((a, b) => b.net - a.net || a.t.seasonRank - b.t.seasonRank);
}
// Ein Kür-Kandidat: Spielerkarte + Team-Kontext eines Etappen-Podest-Platzes.
export type StageCrownEntry = {
  idx: number; // Team-Index (RT.idx) — Träger des Kür-Rahmens am Token
  medal: 1 | 2 | 3;
  playerId: string | null;
  name: string;
  portraitUrl: string | null;
  ovrRank: number | null;
  injured: boolean;
  teamCode: string;
  teamName: string;
  logoUrl: string | null;
  isOwn: boolean;
  net: number;
};
// Etappen-Kür: die (bis zu) 3 besten ECHTEN Auftritte der Etappe. Teams ohne Spieler
// in diesem Slot (has=false) werden nicht gekürt — sonst stünde eine leere Karte mit
// einer erfundenen 0 auf dem Podest (Regel: fehlender Wert ≠ 0).
export function computeStageCrown<T extends StageSlotTeam>(
  order: { t: T; net: number; has: boolean }[],
  slot: number,
): StageCrownEntry[] {
  return order
    .filter((o) => o.has)
    .slice(0, 3)
    .map((o, i) => {
      const p = o.t.players[slot]!;
      return {
        idx: o.t.idx,
        medal: (i + 1) as 1 | 2 | 3,
        playerId: p.playerId,
        name: p.name,
        portraitUrl: p.portraitUrl,
        ovrRank: p.ovrRank ?? null,
        injured: p.mods.some(isInjuryMod),
        teamCode: o.t.code,
        teamName: o.t.name,
        logoUrl: o.t.logoUrl,
        isOwn: o.t.isOwn,
        net: o.net,
      };
    });
}
// Anlass-Entscheid des Highlight-Moments einer Etappe (Owner-Wunsch v2):
//   1. VERLETZUNG in dieser Etappe → Zoom/Puls auf die betroffenen Teams; die
//      Kür-Karten treten zurück (das Spotlight-Banner trägt den Verletzungs-Moment,
//      zwei konkurrierende Overlays wären Lärm).
//   2. Sonst ETAPPEN-KÜR: die Top 3 pulsieren in ihren Medaillenfarben, der Zoom
//      fährt NUR auf den besten Spieler der Etappe, dazu die drei Spielerkarten.
// Früher gab es statt (2) den „berührt das Podest der Gesamtwertung"-Anlass — der
// Owner will den Moment jetzt in JEDER Etappe, als Kür ihrer Top 3.
export function resolveStageHighlight(args: { injuredIdxs: number[]; crown: StageCrownEntry[] }): {
  cause: "injury" | "kuer" | null;
  trioIdxs: number[];
  zoomIdxs: number[];
  showCards: boolean;
} {
  if (args.injuredIdxs.length > 0) {
    const idxs = args.injuredIdxs.slice(0, 3);
    return { cause: "injury", trioIdxs: idxs, zoomIdxs: idxs, showCards: false };
  }
  if (args.crown.length > 0) {
    return { cause: "kuer", trioIdxs: args.crown.map((c) => c.idx), zoomIdxs: [args.crown[0]!.idx], showCards: true };
  }
  return { cause: null, trioIdxs: [], zoomIdxs: [], showCards: false };
}
// Wie lange die Kür-Karten im Bild bleiben — länger als die 1,5-s-Zeitlupe, damit
// man nach dem Rauszoomen noch lesen kann, wer gekürt wurde.
export const STAGE_CROWN_MS = 2600;

// Golden-Angle-Farbverteilung nach fester Team-Position → maximale Spreizung,
// keine Hash-Kollisionen (früher hueFor über den Code → viele fast gleiche Grüns).
export function hueForIdx(idx: number): number {
  return Math.round((idx * 137.508) % 360);
}
export function calcString(p: NativeStagePlayer): string {
  let s = `${fmt1(p.val)}`;
  p.mods.forEach((m) => {
    s += m.sign < 0 ? ` − ${fmt1(m.amt)} ${m.k}` : ` + ${fmt1(m.amt)} ${m.k}`;
  });
  return `${s} = ${fmt1(playerNet(p))}`;
}
// Sauberer vertikaler Breakdown-Stack für die Hovercard: Grundwert oben, je eine
// Zeile pro echtem Mod aus p.mods (Zahl rechtsbündig, Vorzeichen-farbig), dünner
// Trenner, dann die fett hervorgehobene Netto-Summe.
export function renderBreakdown(p: NativeStagePlayer): ReactNode {
  const row = (label: ReactNode, num: string, color: string, opts?: { bold?: boolean }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontVariantNumeric: "tabular-nums", lineHeight: 1.45 }}>
      <span style={{ flex: "none", minWidth: 52, textAlign: "right", fontWeight: opts?.bold ? 800 : 700, color }}>{num}</span>
      <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: opts?.bold ? 800 : 500, color: opts?.bold ? color : "var(--nl-mut)" }}>{label}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {row("Grundwert", fmt1(p.val), "var(--nl-mut)")}
      {p.mods.map((m, i) =>
        <Fragment key={i}>
          {row(m.k, `${m.sign > 0 ? "+" : "−"}${fmt1(m.amt)}`, m.sign > 0 ? "var(--nl-good)" : "var(--nl-risk)")}
        </Fragment>,
      )}
      <div style={{ borderTop: "1px solid var(--nl-line)", margin: "3px 0 2px" }} />
      {row("Total", fmt1(playerNet(p)), "var(--nl-ink)", { bold: true })}
    </div>
  );
}

const FLASH_COLOR: Record<string, string> = {
  gold: "255,214,110",
  red: "217,80,63",
  violet: "160,110,232",
  cyan: "80,200,210",
};

export type RT = {
  idx: number;
  code: string;
  name: string;
  logoUrl: string | null;
  isOwn: boolean;
  teamId: string | null; // für Team-Drawer
  rel: TeamRelationshipKind | null; // Freund/Feind → Rahmen-Marker
  missingLineup: boolean; // A2: keine Aufstellung eingereicht — 0 ist kein echtes Ergebnis
  captainName: string | null; // in der Einsatzliste gesetzter Kapitän → Stern am Wappen
  /**
   * Positionsgetreu: der Index IST die Etappe, `null` heisst „unbesetzt" (Ticket #35). Ein Team
   * mit Spielern auf Slot 5 und 6 hat hier vier fuehrende `null`-Eintraege — vorher rutschten die
   * beiden auf Etappe 1 und 2, unter fremde Rollen-Labels.
   */
  players: Array<NativeStagePlayer | null>;
  seasonRank: number;
  laneIdx: number; // dichte 0…N-1 Bahn-/Turm-Reihenfolge nach seasonRank (keine Lücken)
  score: number;
  displayScore: number; // track: Runden-Ziel für die Token-Position (alle Teams gemeinsam gesetzt → simultanes Gleiten). Sonst = score.
  roundStartScore: number; // Score zu Rundenbeginn — Basis der 5s-Rang-Interpolation (Feld↔Tabelle-Sync)
  animScore: number; // laufend interpolierter Anzeige-Score (ramped roundStartScore→displayScore über 5s)
  thrownSlot: number;
  // ANZEIGE-RANG (die EINE Wahrheit für ALLES, was der Zuschauer sieht: Feld-Badges,
  // Hovercard, Rangliste, Klassen-Bänder, „Dein Team"-Karte). Wird pro Render aus dem
  // geteilten animScore-Zeitstrahl abgeleitet — dadurch laufen
  // FELD und TABELLE zu jedem Zeitpunkt exakt synchron, statt dass die Tabelle der
  // Icon-Bewegung vorauseilt (Cascade-Sprünge). Für Logik/Historie NICHT verwenden.
  rank: number;
  // WAHRHEITS-RANG (aus dem sequenziellen `score`, ohne Animation). Ausschließlich für
  // Logik/Choreografie: Reveal-Reihenfolge, rankHistory, Detail-Ergebnistabelle.
  trueRank: number;
  rankHistory: number[]; // Rang nach jeder gewerteten Etappe (für Bump/Verlauf)
  roundStartRank: number;
  roundRankAfter: number;
  roundDelta: number;
  roundMedal: 0 | 1 | 2 | 3;
  roundSlotRank: number; // vorab bestimmter Rang im aktuellen Slot (1…N) — kein Spoiler
  // ETAPPEN-KÜR (bewusst getrennt von roundMedal = finale Gesamt-Top-3): Gold/Silber/
  // Bronze der Top 3 der LAUFENDEN Etappe. Gesetzt im Highlight-Moment (~Mitte des
  // Glides), bleibt als Rahmen am Token, bis die nächste Etappe neu kürt — „die Top 3
  // bewegen sich mit dem passenden Rahmen voran" (Owner-Wunsch).
  stageMedal: 0 | 1 | 2 | 3;
  // Verletzung im Slot der laufenden Etappe (vorab aus den Mods gelesen): Anlass des
  // Highlight-Zooms und Farbgeber des Puls-Rings (rot statt Medaillenfarbe).
  stageInjured: boolean;
  glowUntil: number;
};

type Impact = { tier: 0 | 1 | 2; cause: string; color: string; text: string; delta: number };
type Pop = { id: number; xPct: number; yPct: number; net: number; mine: boolean };
type Frag = { id: number; xPct: number; yPct: number; text: string; sign: 1 | -1 };
type TickerReveal = {
  kind: "reveal";
  id: string;
  code: string;
  idx: number;
  isOwn: boolean;
  logoUrl: string | null;
  star: boolean;
  playerName: string;
  slotLbl: string;
  slotRank: number;
  badge: [string, string] | null;
  calc: string;
  net: number;
  rankAfter: number;
  delta: number;
  slot: number;
};
type TickerSummary = { kind: "summary"; id: string; text: string };
type TickerHeader = { kind: "header"; id: string; text: string };
type TickerData = TickerReveal | TickerSummary | TickerHeader;

const TICKER_MAX = 40;
type Spot = {
  crest: NativeStageTeam;
  idx: number;
  kick: string;
  name: string;
  sub: string;
  net: number;
  chipText: string;
  chipColor: string;
  mine: boolean;
  portraitUrl: string | null;
  injury?: boolean;
  /** Ligaweiter OVR-Rang — Grundlage des Star-Tier-Rings am Spotlight-Portrait. */
  ovrRank?: number | null;
} | null;
type PodCol = { place: number; code: string; name: string; pts: number; logoUrl: string | null; isOwn: boolean; idx: number; delayMs: number; loud: boolean };

// Team-Hovercard als PORTAL (document.body) mit position:fixed + Viewport-Clamping.
// Löst die Karte aus dem Feld-Container (overflow:hidden für die gezoomte SVG +
// Shake-transform) heraus, damit sie NIE mehr am oberen/seitlichen Feldrand
// abgeschnitten wird und IMMER vorne liegt. Anker = Viewport-Mitte des Tokens;
// horizontal neben das Token gekippt, vertikal auf Tokenhöhe zentriert und voll in
// den sichtbaren Bereich geklemmt.
function HoverTeamCardPortal({
  anchorX,
  anchorY,
  accent,
  clickable,
  onEnter,
  onLeave,
  onClick,
  children,
}: {
  anchorX: number;
  anchorY: number;
  accent: string;
  clickable: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
  children: ReactNode;
}): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof document === "undefined") return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const w = r.width || 300;
    const h = r.height || 0;
    let left = anchorX + 16; // rechts neben das Token
    if (left + w > vw - 8) left = anchorX - w - 16; // nahe rechtem Rand nach links kippen
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = anchorY - h / 2; // vertikal auf Tokenhöhe zentrieren
    top = Math.max(8, Math.min(top, vh - h - 8)); // voll in den Viewport klemmen (kein Clip oben/unten)
    setPos({ left, top });
  }, [anchorX, anchorY]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      // `is-new-look` MUSS hier stehen: die --nl-*-Tokens sind in globals.css nur unter
      // dieser Klasse definiert (sie sitzt auf <main>), das Portal hängt aber an <body>.
      // Ohne sie wäre `background: var(--nl-panel)` ungültig → die Karte bliebe durch-
      // sichtig und Feld/Rangliste würden durchscheinen.
      className="is-new-look"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        position: "fixed",
        left: pos ? pos.left : anchorX + 16,
        top: pos ? pos.top : 8,
        width: 300,
        maxWidth: "92vw",
        zIndex: 1000,
        background: "var(--nl-panel)",
        color: "var(--nl-ink)",
        border: `1.5px solid ${accent}`,
        borderTop: `3px solid ${accent}`,
        borderRadius: 12,
        padding: 10,
        // Sehr hohe Karte (viele Etappen, kleines Fenster) nie über die Fensterkanten
        // hinaus — auf Viewport-Höhe deckeln und intern scrollen statt unten rauslaufen.
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        boxShadow: "0 18px 50px -18px rgba(0,0,0,.8)",
        pointerEvents: "auto",
        cursor: clickable ? "pointer" : "default",
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default function DisciplineStageNativeArena({ teams, slots, onOpenPlayer, onOpenTeam, onHoverTeam, onPreviewPlayer, onEnded, onReset, onResults, topPlayers, primitive = "track", disciplineId, progressLabel, disciplineName, accent, motif, env, roomSync, alreadyScored = false }: DisciplineStageNativeArenaProps) {
  const skinAccent = accent ?? "var(--nl-line-2, var(--nl-line))";
  const slotCount = Math.max(1, slots.length);
  const prim = primitive;
  const geo = PRIM_GEO[prim];
  const W = geo.w;
  const H = geo.h;
  const N = Math.max(1, teams.length);
  const audio = useStageAudio();
  const [, force] = useReducer((x: number) => x + 1, 0);

  const reduced = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches;
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ---- Laufzeit-Teams (mutabel im Cascade, Re-Render via force()) ----
  const rtRef = useRef<RT[]>([]);
  const buildRT = useCallback((): RT[] => {
    const rt = teams.map((t, idx) => ({
      idx,
      code: t.code,
      name: t.name,
      logoUrl: t.logoUrl,
      isOwn: t.isOwn,
      teamId: t.teamId ?? null,
      rel: t.rel ?? null,
      missingLineup: t.missingLineup ?? false,
      captainName: t.captainName ?? null,
      players: t.players,
      seasonRank: t.seasonRank ?? idx + 1,
      laneIdx: idx,
      score: 0,
      displayScore: 0,
      roundStartScore: 0,
      animScore: 0,
      thrownSlot: -1,
      rank: idx + 1,
      trueRank: idx + 1,
      rankHistory: [],
      roundStartRank: idx + 1,
      roundRankAfter: idx + 1,
      roundDelta: 0,
      roundMedal: 0 as 0 | 1 | 2 | 3,
      roundSlotRank: 0,
      stageMedal: 0 as 0 | 1 | 2 | 3,
      stageInjured: false,
      glowUntil: 0,
    }));
    // Bahn-/Turm-Reihenfolge nach echtem Season-Rang, aber DICHT durchnummeriert
    // (Season-Ränge können Lücken haben → niemals seasonRank-1 als Array-Index).
    [...rt]
      .sort((a, b) => a.seasonRank - b.seasonRank || a.idx - b.idx)
      .forEach((t, i) => {
        t.laneIdx = i;
      });
    recomputeRanks(rt);
    return rt;
  }, [teams]);

  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  // Start-Gate: die Disziplin läuft NICHT von allein los — erst der erste ▶-Etappe-Klick
  // (oder Quick-Sim) startet sie; danach läuft sie automatisch durch (bis Pause/Ende).
  // Bei Remount (Disziplin/Modus/Seed → neuer key) ist started wieder false → wartet.
  const [started, setStarted] = useState(false);
  const [spotlight, setSpotlight] = useState<Spot>(null);
  const [flash, setFlash] = useState<{ color: string; id: number } | null>(null);
  const [shake, setShake] = useState<"none" | "hard" | "soft">("none");
  /**
   * BEFUND, bewusst NICHT weggeraeumt (Dead-Code-Durchgang 2026-08-09):
   *
   * `pops` und `frags` werden vollstaendig befuellt — Position mit Streuung, Netto-Wert,
   * eigener/fremder Treffer, Aufraeum-Timer nach 950/900 ms — aber im gesamten Repo liest sie
   * KEINE Stelle. Die Partikel entstehen und verfallen, ohne je gezeichnet zu werden.
   *
   * Das ist kein ungenutzter Code, sondern eine verlorene Anzeige: der Zustand ist da, die
   * Renderstelle fehlt. Loeschen wuerde den Beleg dafuer beseitigen, deshalb bleibt beides
   * stehen, bis entschieden ist, ob der Effekt zurueckkommt.
   */
  const [pops, setPops] = useState<Pop[]>([]);
  const [frags, setFrags] = useState<Frag[]>([]);
  // Geteilter 5s-Zeitstrahl (Feld↔Tabelle-Sync): animScore rampt roundStartScore→
  // displayScore, treibt Feldposition UND Ranglisten-Sortierung. + Highlight-Zoom.
  const [zoom, setZoom] = useState<{ ox: number; oy: number; scale: number } | null>(null);
  const roundAnimStartRef = useRef<number>(0);
  const zoomFiredRef = useRef<boolean>(false);
  /**
   * Etappen-Kür: die vorab bestimmten Top 3 der laufenden Etappe (Karten- und
   * Rahmen-Daten). Beim Rundenstart in `advance` eingefroren, weil die rAF-Schleife
   * zum Feuer-Zeitpunkt weder den Slot-Index noch die Slot-Reihenfolge kennt.
   */
  const stageCrownRef = useRef<{ list: StageCrownEntry[]; stage: number; label: string | null }>({ list: [], stage: 0, label: null });
  // Kür-Overlay (die 3 Spielerkarten mit Team-Logo) — gesetzt im Highlight-Moment,
  // blendet nach STAGE_CROWN_MS wieder aus.
  const [stageCrown, setStageCrown] = useState<{ list: StageCrownEntry[]; stage: number; label: string | null } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null); // für korrekte Zoom-Origin (getScreenCTM)
  // Highlight-Slow-Motion: die 3 größten Aufsteiger einer Etappe werden kurz
  // hervorgehoben (Ring am Token) und der geteilte Zeitstrahl läuft für ~1,5 s in
  // Zeitlupe, damit man ihre Aufholjagd beobachten kann — statt eines harten Stopps.
  const [highlightTrio, setHighlightTrio] = useState<number[]>([]);
  const highlightTrioRef = useRef<number[]>([]); // Spiegel für den rAF (ohne Re-Mount)
  highlightTrioRef.current = highlightTrio;
  const highlightHoldRef = useRef<number>(0); // Date.now()-Ziel, bis wann Zeitlupe läuft
  const animClockRef = useRef<number>(0); // virtuelle (zeitlupen-fähige) Etappen-Uhr in ms
  const lastTsRef = useRef<number>(0); // letzter rAF-Zeitstempel (für dt)
  const prevStartRef = useRef<number>(0); // erkennt Etappenwechsel → Uhr zurücksetzen
  const [ticker, setTicker] = useState<TickerData[]>([]);
  const [podium, setPodium] = useState<PodCol[] | null>(null);
  const [hover, setHover] = useState<{ idx: number } | null>(null);
  // Staffelstab-Übergabe (nur track): kurzer Funke, der bei jedem Etappen-Glide-Start
  // auf jedem Token nach vorn gereicht wird. handoffTs = Zeitstempel des letzten Wechsels.
  const [handoffTs, setHandoffTs] = useState(0);
  // Fotofinish (nur track): enges Rennen um Gold → Zeitlupen-Zoom auf den Zieleinlauf,
  // bevor das eigentliche Podest erscheint.
  const [photoFinish, setPhotoFinish] = useState(false);
  // Feld-Höhe wird auf die Höhe der Rangtabelle daneben gedeckelt, damit unter dem Feld
  // Läufer-Karte + Ticker immer sichtbar bleiben (Feld nie höher als die 32er-Rangliste).
  // Gilt für alle Primitives — geteilte Layout-Regel.
  const ladderRef = useRef<HTMLDivElement | null>(null);
  // Rangliste (rechts) soll auf GLEICHER HÖHE enden wie die Arena-Hauptspalte (links):
  // wir messen die Hauptspalte und kappen die Ladder darauf (intern scrollbar). Früher
  // war es umgekehrt (Arena an Ladder gekappt) → die Ladder ragte über die Arena hinaus.
  const mainColRef = useRef<HTMLDivElement | null>(null);
  const [ladderMaxH, setLadderMaxH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = mainColRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setLadderMaxH(Math.round(el.getBoundingClientRect().height) || null);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Kopfbereich der Ladder (Titelzeile + Spaltenkoepfe) — wird gemessen, weil die
  // Zeilenhoehe aus dem Rest der Hoehe folgt. Ohne diese Messung muesste man den
  // Kopf hart schaetzen und die Liste endete je nach Disziplin zu frueh oder zu spaet.
  const ladderHeadRef = useRef<HTMLDivElement | null>(null);
  const [ladderHeadH, setLadderHeadH] = useState(0);
  useLayoutEffect(() => {
    const el = ladderHeadRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setLadderHeadH(Math.round(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Gewichtheben · Kraft-Turm (barbell): die geforderte Last (goldene Latte) steigt
  // je Runde. demandKg = aktuelle Last (null = Wettkampf noch nicht gestartet). Alle
  // noch nicht gerissenen Heber sitzen auf der Latte; wer sie nicht mehr packt (endKg
  // < Last) reißt und fällt auf sein Endgewicht (= Score-Rang). Endstand = Score.
  const [demandKg, setDemandKg] = useState<number | null>(null);
  const [barbellMsg, setBarbellMsg] = useState<{ text: string; kind: "kg" | "red" | "end" } | null>(null);
  // Renn-Highlight-Banner (nur track): kurzer Pop über dem Oval bei Etappensieger,
  // neuer Gesamtführung oder Etappen-Wechsel. Ein Slot, neuester Anlass gewinnt.
  const [banner, setBanner] = useState<{ text: string; kind: "gold" | "cyan"; id: number } | null>(null);
  const bannerId = useRef(0);
  const hoverCloseTimer = useRef<number | null>(null);
  const ladderHoverTimer = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const fxId = useRef(1);
  const roundTopNet = useRef(0); // Netto des Etappensiegers der laufenden Runde (vorab bestimmt)
  const tier2Budget = useRef(2);
  const tier1Budget = useRef(4);
  const busyRef = useRef(false);
  const pauseRef = useRef(false); // Hover-Pause: friert die Reveal-Cascade ein (doOne re-polled, ohne zu konsumieren)
  const manualPauseRef = useRef(false); // Leertaste-Pause (manuell): friert die laufende Sim ein, bis erneut Space
  const endedFiredRef = useRef(false); // onEnded feuert genau einmal je Lauf (Spoiler-Gate)
  // Barbell: aktuelle Last als Ref (tokenPos/Feld lesen sie beim Render frisch, ohne
  // Callback-Deps). Und die Barbell-Rangfolge der Vorrunde für die Rang-Pfeile ▲/▼.
  const barbellDemandRef = useRef<number | null>(null);
  const barbellPrevDemandRef = useRef<number | null>(null);
  const barbellPrevRankRef = useRef<Record<string, number>>({});

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, reduced.current ? 0 : ms);
    timers.current.push(id);
    return id;
  }, []);

  // Hover-Pause der Reveal-Cascade: solange pauseRef gesetzt ist, re-polled doOne
  // sich selbst (ohne ein order-Item zu konsumieren) → Reihenfolge bleibt erhalten.
  // Reduced-Motion pausiert nie (later feuert dort mit 0ms → sonst 0ms-Spin).
  const pauseCascade = useCallback(() => {
    if (!reduced.current) pauseRef.current = true;
  }, []);
  const resumeCascade = useCallback(() => {
    pauseRef.current = false;
  }, []);

  // Token-Hovercard: eigener Schließ-Timer (unabhängig von der Reveal-Cascade),
  // damit die Karte beim Rüberfahren nicht flackert.
  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimer.current != null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);
  const openHover = useCallback(
    (idx: number) => {
      cancelHoverClose();
      pauseCascade();
      setHover({ idx });
    },
    [cancelHoverClose, pauseCascade],
  );
  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimer.current = window.setTimeout(() => {
      setHover(null);
      resumeCascade();
    }, 120);
  }, [cancelHoverClose, resumeCascade]);
  // Ladder-Hover → Team-Vorschau im Host (300ms Verzögerung wie die Top-Player-Row).
  const clearLadderHoverTimer = useCallback(() => {
    if (ladderHoverTimer.current != null) {
      window.clearTimeout(ladderHoverTimer.current);
      ladderHoverTimer.current = null;
    }
  }, []);

  /**
   * DER MOUNT IST KEIN „↻ NEU" — DIESE UNTERSCHEIDUNG WAR DER STILLE ANZEIGE-VERLUST.
   *
   * GEMELDET VON CHRIS: „top spieler ... warum ist das immernoch nicht da".
   *
   * NACHGEMESSEN im Browser (Save `fresh-season-1-1786550453715`, Saison 2, Spieltag 4, beide
   * Disziplinen gebucht): die Arena meldete `activeSideScoredInSave=true`, aber
   * `disciplineEnded=false` — und damit fehlte der GANZE Endscreen: Top-Spieler-Liste,
   * Highlights und der Weiter-Block.
   *
   * URSACHE: dieser Reset lief auch beim MOUNT und rief dabei `onReset` mit. Im Host setzt
   * `onReset` `replayingDisciplineId = disciplineId` — die Zusage „der Nutzer laesst die
   * Disziplin gerade nochmal laufen, verrate das Ergebnis nicht". Genau diese Zusage hebt
   * `disciplineEnded` wieder auf:
   *   disciplineEnded = ... || (activeSideScoredInSave && replayingDisciplineId !== disciplineId)
   * Wer die Arena zu einer laengst gewerteten Disziplin oeffnet, galt damit als „spielt gerade
   * nach" — obwohl er nur die Seite geladen hat. Der Save wusste es besser, die Anzeige nicht.
   *
   * Deshalb sagt der Aufrufer jetzt, WARUM zurueckgesetzt wird. Nur der Knopf meldet es dem Host;
   * der Mount setzt bloss die Buehne auf Runde 0.
   */
  const reset = useCallback((anlass: ArenaResetAnlass) => {
    clearTimers();
    rtRef.current = buildRT();
    setRound(0);
    // Start-Gate zurücksetzen: sonst feuert der Auto-Continue-Effekt (started noch true)
    // nach „↻ Neu" sofort advance() → die Disziplin läuft ohne ▶-Klick von selbst wieder los.
    setStarted(false);
    setBusy(false);
    busyRef.current = false;
    setEnded(false);
    pauseRef.current = false;
    setSpotlight(null);
    setFlash(null);
    setShake("none");
    setPops([]);
    setFrags([]);
    setTicker([]);
    setPodium(null);
    setHover(null);
    setBanner(null);
    setHandoffTs(0);
    setPhotoFinish(false);
    setStageCrown(null);
    stageCrownRef.current = { list: [], stage: 0, label: null };
    setDemandKg(null);
    setBarbellMsg(null);
    barbellDemandRef.current = null;
    barbellPrevDemandRef.current = null;
    barbellPrevRankRef.current = {};
    endedFiredRef.current = false;
    roundTopNet.current = 0;
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    manualPauseRef.current = false;
    setPaused(false);
    // Host-seitiges Spoiler-Gate (arenaEnded) wieder aufheben, damit der Real-Modus-Endscreen +
    // „Spieltag auswerten"-Button beim Replay verschwinden (FIX A). Der ANLASS faehrt mit: was er
    // bedeutet, entscheidet der Host an einer Stelle (`replayNachArenaReset`) — dieser hier meldet
    // nur, was passiert ist.
    onReset?.(anlass);
    // „↻ Neu" als Raum-Aktion (Stufe 3.6): NUR der bewusste Knopf-Klick geht an den Raum, NICHT
    // der Mount-Reset (`anlass === "mount"`) — sonst wuerfe schon das blosse Oeffnen/Wechseln der
    // Seite den Mitspieler zurueck (B1-artiger Fehlschluss, siehe Kommentar oben am Mount-Effekt).
    // `onHostReset` ist optional/no-op, solange der Aufrufer sie nicht befuellt.
    if (anlass === "knopf" && roomSync?.active && roomSync.isHost) {
      roomSync.onHostReset?.();
    }
    force();
  }, [buildRT, clearTimers, onReset, roomSync]);

  // Nur beim Mount zurücksetzen: der Host remountet die Arena bereits vollständig
  // via key={`${disciplineId}-${mode}-${seed}`}. Ein Reset bei jeder teams-Identität
  // würde die laufende Sim bei unbeteiligtem Parent-Render (Drawer/Hover) auf Runde 0
  // zurückwerfen (B1). reset ist ein useCallback — Mount-only ist gewollt.
  useEffect(() => {
    reset("mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      clearTimers();
      cancelHoverClose();
      clearLadderHoverTimer();
    },
    [clearTimers, cancelHoverClose, clearLadderHoverTimer],
  );

  const done = round >= slotCount;

  // Live-Ergebnisse der bereits AUFGEDECKTEN Spieler an den Host melden — der
  // Team-Drawer zeigt damit sofort „was hat der Spieler in dieser Disziplin
  // geholt + Boni/Abzüge". Nach jeder Runde / bei Ende / Reset neu (round/done/
  // podium decken die Reveal-Übergänge ab). Nur enthüllte Slots (kein Spoiler).
  useEffect(() => {
    if (!onResults) return;
    const byTeam: StageLiveResultsByTeam = {};
    for (const t of rtRef.current) {
      if (!t.teamId) continue;
      const arr: StageLivePlayerResult[] = [];
      for (let s = 0; s <= t.thrownSlot; s += 1) {
        const p = t.players[s];
        if (!p?.playerId) continue;
        arr.push({ playerId: p.playerId, slot: s, base: p.val, net: playerNet(p), mods: p.mods, pointsAwarded: p.pointsAwarded });
      }
      if (arr.length > 0) byTeam[t.teamId] = arr;
    }
    onResults(byTeam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, done, podium, onResults]);

  // Leertaste pausiert/setzt die laufende Arena fort (native Primitive UND Mini-DM).
  // CAPTURE-Phase-Fenster-Listener: fängt Space VOR dem Shell-Space-Handler ab
  // (der in use-foundation-shell-router-body-scope als BUBBLE-Phase-Fenster-Listener
  // registriert ist → "Weiter"). Wir intercepten nur, solange ein Match läuft
  // (!done && !reduced) — sonst fällt Space durch zur Shell-Bedeutung. Diese
  // Interception setzt VORAUS, dass der Shell-Space-Handler Bubble-Phase bleibt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable || t?.closest("[contenteditable='true']")) return;
      if (done || reduced.current) return;
      if (document.querySelector("[role='dialog']")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      manualPauseRef.current = !manualPauseRef.current;
      setPaused(manualPauseRef.current);
      // Pause als Raum-Zustand (Stufe 3.6): NUR der Host meldet seine Pause an den Raum — der
      // Guest hat gar keine eigene Pause-Autoritaet (`resolveArenaEffectivePause` in
      // `arena-timeline.ts`), sein Leertaste-Druck bleibt rein kosmetisch fuer die eigene
      // Ansicht. `onHostPauseToggle` ist optional/no-op, solange der Aufrufer sie nicht befuellt.
      if (roomSync?.active && roomSync.isHost) {
        roomSync.onHostPauseToggle?.();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [done, roomSync]);

  // ---- Feld-Geometrie ----
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  useLayoutEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [prim]);
  // Stadion-Oval bei beliebigem Rand-Margin (für Bahn-Mittellinie, Bahnlinien
  // und Innenfeld-Kante). Kleinerer Margin = größeres Oval.
  const makeOval = useCallback(
    (m: number): string => {
      const x0 = m;
      const y0 = m;
      const x1 = W - m;
      const y1 = H - m;
      const r = (y1 - y0) / 2;
      return `M ${x0 + r} ${y0} L ${x1 - r} ${y0} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} L ${x0 + r} ${y1} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;
    },
    [W, H],
  );
  const OVAL_M = 70;
  const OVAL_BAND = 54;
  const ovalPath = useMemo(() => makeOval(OVAL_M), [makeOval]);

  // Layout-Koordinaten je Primitive
  const layout = useMemo(() => {
    if (ROW_FAMILY.has(prim)) {
      const top = 18;
      const laneH = (H - top * 2) / N;
      // Row-Motive brauchen etwas mehr Platz links (Kürzel) und rechts (Wert).
      return { top, laneH, xStart: 96, xEnd: W - 150 };
    }
    if (TOWER_FAMILY.has(prim)) {
      const lPad = 40;
      const rPad = 24;
      const colW = (W - lPad - rPad) / N;
      return { lPad, rPad, colW, baseY: H - 52, topY: 44 };
    }
    if (prim === "peloton") {
      return { roadY: H * 0.54, padL: W * 0.045, padR: W * 0.045, fan: 15 };
    }
    if (prim === "mountain") {
      const wp: [number, number][] = [
        [W * 0.11, H * 0.92],
        [W * 0.86, H * 0.83],
        [W * 0.2, H * 0.66],
        [W * 0.84, H * 0.5],
        [W * 0.28, H * 0.37],
        [W * 0.73, H * 0.25],
        [W * 0.5, H * 0.12],
      ];
      return { wp };
    }
    if (prim === "parcours") {
      const rows = 4;
      const padX = W * 0.05;
      const padY = H * 0.14;
      const rowH = (H - 2 * padY) / (rows - 1);
      const wp: [number, number][] = [];
      for (let r = 0; r < rows; r += 1) {
        const y = padY + r * rowH;
        const leftFirst = r % 2 === 0;
        wp.push([leftFirst ? padX : W - padX, y]);
        wp.push([leftFirst ? W - padX : padX, y]);
      }
      return { wp };
    }
    if (prim === "bump") {
      // Slalom/Bump-Diagramm: x = Etappe, y = Rang (oben = Spitze). stagesTotal
      // aus der Slot-Zahl; die Linien liest der Renderer aus RT.rankHistory.
      return { pL: 88, pR: 66, top: 42, bot: H - 46, stagesTotal: slotCount };
    }
    if (prim === "court") {
      return { cx: W / 2, hoopY: H * 0.15, baseY: H * 0.9, baseHalf: W * 0.4 };
    }
    if (prim === "rink") {
      const x0 = W * 0.03;
      const y0 = H * 0.07;
      const w = W * 0.94;
      const hh = H * 0.8;
      return { x0, y0, w, hh, margin: 44 };
    }
    if (prim === "stage") {
      // Perspektivische Ruhm-Treppe (Port von showcase-v2 drawStageBG, auf viewBox
      // skaliert): Score 0 steht am Boden, das Ruhm-Podest oben ist das Ziel; die
      // Treppe verjüngt sich zum Podest → Teilnehmer laufen in die Tiefe zusammen.
      return {
        floorY: H - 84,
        podiumY: 118,
        centerX: W / 2,
        baseHalf: W / 2 - 46,
        topHalf: 86,
        stairBands: 16,
      };
    }
    return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [prim, N, W, H, slotCount]) as any;

  // Normierungsbasis = größte erreichbare Team-Summe (statisch, aus den Slot-Werten).
  // So endet das beste Team exakt auf der Ziellinie und Tokens rutschen beim Reveal
  // NICHT kollektiv nach — nur das gerade aufgedeckte Team bewegt sich.
  const finalMax = useMemo(() => {
    let mx = 0;
    for (const t of teams) {
      // Identische Faltung wie im Reveal (accumulateRevealedTeamScore) — sonst landet der
      // Fuehrende wegen der schrittweisen Rundung neben der Ziellinie statt darauf.
      const s = accumulateRevealedTeamScore(t.players);
      if (s > mx) mx = s;
    }
    return Math.max(1, mx);
  }, [teams]);

  // Feld-Minimum der End-Summen — Normierungs-Untergrenze für abgeleitete Stats
  // (KDA / Duell-HP): n = (score − min) / (max − min), clamped. So klettern die
  // Werte während des Reveals von der Feld-Untergrenze bis zum Endwert.
  const finalMin = useMemo(() => {
    let mn = Infinity;
    for (const t of teams) {
      const s = accumulateRevealedTeamScore(t.players);
      if (s < mn) mn = s;
    }
    return Number.isFinite(mn) ? mn : 0;
  }, [teams]);
  const fieldNorm = useCallback(
    (score: number): number => {
      const span = finalMax - finalMin;
      if (span <= 0) return score > 0 ? 1 : 0;
      return Math.max(0, Math.min(1, (score - finalMin) / span));
    },
    [finalMax, finalMin],
  );

  /**
   * Gewichtheben · Kraft-Turm: Endgewicht je Team, MONOTON im Endscore → Ranking nach kg ==
   * Ranking nach Score (= Wahrheit). Die Achse startet knapp unter der schwaechsten Kraft;
   * kgMax ist das Maximum (der spaetere Champion). Deterministisch aus den Slot-Werten →
   * SSR-stabil, kein Spoiler. Nur fuer `prim === "barbell"` berechnet.
   *
   * GEMELDET VON CHRIS: „Anzeige und score passen jetzt nicht mehr zusammen" — mit einem
   * Endstand, in dem P-S mit 400 kg oben stand (Score 297,6) und V-V mit 150 kg unten
   * (Score 532,1). Die Zeilen selbst waren richtig zugeordnet (Kuerzel und Heber-Name passten
   * zum Team), nur die Kilogramm gehoerten jemand anderem.
   *
   * HIER LAG ES, UND ES IST WIEDER EIN INDEX-PROBLEM: `endKg` war ein ARRAY ueber die
   * Array-Position von `teams`, gelesen als `endKg[t.idx]`. `t.idx` stammt aber aus `buildRT()`,
   * und das laeuft NUR BEIM MOUNT (der Reset-Effekt ist bewusst mount-only, sonst wuerfe jeder
   * Eltern-Render die laufende Simulation auf Runde 0 zurueck, siehe B1). Dieser `useMemo`
   * dagegen haengt an `[prim, teams]` und rechnet bei JEDER neuen `teams`-Identitaet neu — und
   * `payload.teams` wird durch `orderStageTeamsBySeasonRank` UMSORTIERT, sobald Disziplin 1
   * gewertet ist (der Saisonstand aendert sich, `matchdayPanel` faellt neu an).
   *
   * Ab diesem Moment zeigten die beiden Seiten auf verschiedene Reihenfolgen: `rtRef` hielt die
   * alte, `endKg` trug die neue — und `endKg[t.idx]` griff das Kilogramm des falschen Teams.
   * Genau deshalb stimmte es waehrend der Disziplin und erst danach nicht mehr.
   *
   * Der Schluessel ist jetzt das TEAM-KUERZEL statt der Array-Position. Ein Kuerzel bedeutet in
   * beiden Reihenfolgen dasselbe Team; eine Umsortierung kann daran nichts mehr verschieben.
   */
  const barbellInfo = useMemo(
    () => (prim === "barbell" ? buildBarbellInfo(teams) : null),
    [prim, teams],
  );
  // aktuelle Last für tokenPos/Feld ohne Callback-Dep-Churn (Ref im Render aktuell halten)
  barbellDemandRef.current = demandKg;
  // Barbell: kg → y auf der Turm-Achse (baseY…topY). Latte + Heber teilen sich diese Skala.
  const barbellY = useCallback(
    (kg: number): number => {
      if (!barbellInfo) return layout.baseY ?? H;
      const f = (kg - barbellInfo.axTop) / Math.max(1, barbellInfo.kgMax - barbellInfo.axTop);
      return (layout.baseY ?? H) - Math.max(0, Math.min(1, f)) * ((layout.baseY ?? H) - (layout.topY ?? 0));
    },
    [barbellInfo, layout, H],
  );
  /** Endgewicht eines Teams — nachgeschlagen ueber das Kuerzel, nicht ueber die Array-Position. */
  const barbellEndKgOf = useCallback(
    (code: string): number => barbellInfo?.endKgByCode.get(code) ?? barbellInfo?.axTop ?? 0,
    [barbellInfo],
  );
  // aktuelles kg eines Teams: sitzt auf der Latte (min) oder auf seinem Endgewicht (gerissen).
  const barbellKgOf = useCallback(
    (code: string): number => {
      if (!barbellInfo) return 0;
      const ek = barbellEndKgOf(code);
      return demandKg == null ? barbellInfo.axTop : Math.min(demandKg, ek);
    },
    [barbellInfo, barbellEndKgOf, demandKg],
  );
  const barbellEliminated = useCallback(
    (code: string): boolean => {
      if (!barbellInfo || demandKg == null) return false;
      return demandKg > (barbellInfo.endKgByCode.get(code) ?? Infinity);
    },
    [barbellInfo, demandKg],
  );
  // Barbell-Rangfolge: Verbliebene (auf der Latte) zuerst, stabil nach laneIdx
  // (Anti-Spoiler — ihre wahre Kraft bleibt verborgen); Gerissene danach nach
  // Endgewicht absteigend (= Score). Am Ende sitzen alle auf endKg → Score-Reihenfolge.
  const barbellOrder = useCallback((): RT[] => {
    const rt = rtRef.current;
    if (!barbellInfo) return [...rt];
    return [...rt].sort((a, b) => {
      const ea = barbellEliminated(a.code) ? 1 : 0;
      const eb = barbellEliminated(b.code) ? 1 : 0;
      if (ea !== eb) return ea - eb;
      if (ea) {
        const ka = barbellEndKgOf(a.code);
        const kb = barbellEndKgOf(b.code);
        if (kb !== ka) return kb - ka;
        return a.seasonRank - b.seasonRank;
      }
      return a.laneIdx - b.laneIdx;
    });
  }, [barbellInfo, barbellEliminated]);

  // Normierungsbasis der Token-Positionen. Wird im Render-Body gesetzt (s. `posMax`) und
  // ist der FESTE Endstand des besten Teams — nicht der Live-Fuehrende. Dadurch steht die
  // Skala die ganze Disziplin ueber still: jede Etappe setzt dort an, wo die vorige endete,
  // und nichts rutscht beim Rundenwechsel kollektiv nach. Eine Normierung gegen den
  // Live-Fuehrenden faechert das Feld zwar frueher auf, laesst aber die Skala je Runde
  // springen — das wurde als Zurueckrutschen wahrgenommen.
  const posMaxRef = useRef<number>(1);

  const tokenPos = useCallback(
    (t: RT, score: number): { x: number; y: number } => {
      const posMax = posMaxRef.current > 0 ? posMaxRef.current : 1;
      const norm = Math.max(0, score / posMax); // 0…1, nach unten auf 0 geklemmt (playerNet ungeclampt → score kann negativ sein)
      // Voll-Feld-Sonderlayouts haben kein gleitendes Token — Score-Pops landen
      // mittig (die Feld-Optik rechnet selbst aus allen Scores).
      if (FIELD_CUSTOM.has(prim)) return { x: W / 2, y: H / 2 };
      if (ROW_FAMILY.has(prim)) {
        const y = layout.top + t.laneIdx * layout.laneH + layout.laneH / 2;
        return { x: layout.xStart + norm * (layout.xEnd - layout.xStart), y };
      }
      if (prim === "barbell") {
        // Kraft-Turm: x = feste Heber-Lane, y = aktuelles kg (auf der Latte bzw. auf
        // dem Endgewicht). Ignoriert den score-Parameter — das kg leitet sich aus der
        // geforderten Last (Ref, im Render aktuell) + monotonem Endgewicht ab.
        const x = layout.lPad + t.laneIdx * layout.colW + layout.colW / 2;
        if (!barbellInfo) return { x, y: layout.baseY };
        const ek = barbellEndKgOf(t.code);
        const dk = barbellDemandRef.current;
        const kg = dk == null ? barbellInfo.axTop : Math.min(dk, ek);
        return { x, y: barbellY(kg) };
      }
      if (TOWER_FAMILY.has(prim)) {
        const x = layout.lPad + t.laneIdx * layout.colW + layout.colW / 2;
        return { x, y: layout.baseY - norm * (layout.baseY - layout.topY) };
      }
      if (prim === "peloton") {
        // Straße: x = Fortschritt, Feld fächert vertikal um die Mittellinie auf.
        const x = layout.padL + norm * (W - layout.padL - layout.padR);
        const lane = (t.laneIdx % 7) - 3; // -3…3
        return { x, y: layout.roadY - lane * layout.fan };
      }
      if (prim === "mountain") {
        return interpAlong(layout.wp, norm);
      }
      if (prim === "parcours") {
        return interpAlong(layout.wp, norm);
      }
      if (prim === "bump") {
        // Token = aktueller Rang an der laufenden Etappe. rankHistory hält die
        // Ränge nach jeder gewerteten Etappe; die Live-Etappe ist hist.length.
        const stages: number = Math.max(1, layout.stagesTotal ?? 1);
        const hist = t.rankHistory;
        const s = Math.min(stages - 1, hist.length);
        const x = layout.pL + (stages > 1 ? s / (stages - 1) : 0.5) * (W - layout.pL - layout.pR);
        const y = layout.top + (N > 1 ? (t.rank - 1) / (N - 1) : 0.5) * (layout.bot - layout.top);
        return { x, y };
      }
      if (prim === "court") {
        // Wurfkarte: höherer Score → näher an den Korb (oben, Mitte). Das Feld
        // verjüngt sich zur Zone, Teams fächern nach fester Position auf.
        const f = Math.max(0, Math.min(1, norm));
        const y = layout.baseY - f * (layout.baseY - layout.hoopY);
        const spread = layout.baseHalf * (1 - f * 0.62);
        const x = layout.cx + ((t.laneIdx - (N - 1) / 2) / Math.max(1, N)) * spread * 2;
        return { x, y };
      }
      if (prim === "rink") {
        // Eisrink von oben: x = Vorstoß in die Angriffszone (rechts = Tor),
        // y = feste Zeile je Team, damit sich das Feld nicht überlappt.
        const x = layout.x0 + layout.margin + norm * (layout.w - 2 * layout.margin);
        const y = layout.y0 + layout.margin + (N > 1 ? t.laneIdx / (N - 1) : 0.5) * (layout.hh - 2 * layout.margin);
        return { x, y };
      }
      if (prim === "stage") {
        // Port von stairPos mit finalMax-Normierung: bester Score endet exakt am
        // Ruhm-Podest, die Treppe verjüngt sich (halfW), die Bahnen laufen zur
        // Mitte zusammen — so klettern die Teilnehmer perspektivisch in die Tiefe.
        const f = Math.max(0, Math.min(1, norm));
        const y = layout.floorY - f * (layout.floorY - layout.podiumY);
        const halfW = layout.baseHalf + (layout.topHalf - layout.baseHalf) * f;
        const x = layout.centerX + (t.laneIdx - (N - 1) / 2) * ((halfW * 2) / N);
        return { x, y };
      }
      // track (Oval, im Uhrzeigersinn) — monoton wachsende frac ⇒ nie rückwärts;
      // Sieger landet nach einer Runde wieder exakt an der ZIEL-Linie. Stabiler
      // Quer-Versatz nach fester Team-Position, damit sich das Feld auffächert.
      if (!pathRef.current || pathLen === 0) return { x: W / 2, y: 70 };
      const frac = 0.015 + norm * 0.985;
      const L = frac * pathLen;
      const pt = pathRef.current.getPointAtLength(L);
      const p2 = pathRef.current.getPointAtLength(Math.min(pathLen, L + 2));
      let tx = p2.x - pt.x;
      let ty = p2.y - pt.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const lane = (t.laneIdx % 6) - 2.5; // -2.5 … 2.5
      const off = lane * 8.5;
      return { x: pt.x + -ty * off, y: pt.y + tx * off };
    },
    [prim, layout, pathLen, finalMax, W, N, barbellInfo, barbellY],
  );

  // Frischer tokenPos-Spiegel für den (mount-once) Anim-rAF, ohne ihn neu zu starten.
  const tokenPosRef = useRef(tokenPos);
  tokenPosRef.current = tokenPos;

  // ---- Geteilter 5s-Zeitstrahl (Feld↔Tabelle-Sync + Highlight-Zoom) ----
  // Eine rAF-Schleife rampt animScore = lerp(roundStartScore → displayScore) über
  // TRACK_ROUND_MS. Das FELD (track liest animScore) und die RANGLISTE (sortiert nach
  // animScore) laufen so exakt auf demselben Zeitstrahl → Ränge ändern sich langsam &
  // synchron zur Bewegung statt nachzutrudeln. Bei ~55 % feuert ein nicht-blockierender
  // Zoom-Slowmo auf den größten Aufsteiger (Highlight ohne Fluss-Stopp).
  useEffect(() => {
    let raf = 0;
    let lastForce = 0;
    const tick = () => {
      const rt = rtRef.current;
      const start = roundAnimStartRef.current;
      const now = Date.now();
      // Etappenwechsel erkannt → virtuelle Uhr + Highlight-Hold zurücksetzen.
      if (start !== prevStartRef.current) {
        prevStartRef.current = start;
        animClockRef.current = 0;
        lastTsRef.current = now;
        highlightHoldRef.current = 0;
        if (highlightTrioRef.current.length) setHighlightTrio([]);
      }
      // Virtuelle Etappen-Uhr: läuft normal mit 1×, während eines Highlights nur mit
      // 0,2× (Zeitlupe). Bei Hover- ODER Leertaste-Pause STOPPT sie komplett (Speed 0) →
      // weil Feld UND Rangliste denselben animScore lesen, bleibt beim Pausieren ALLES
      // exakt zu diesem Zeitpunkt stehen (Icons, Tabelle, Ränge). So gleiten sie sonst in
      // der Aufholjagd-Phase langsam weiter (beobachtbar), ohne den Fluss ganz zu stoppen.
      const dtReal = lastTsRef.current ? now - lastTsRef.current : 0;
      lastTsRef.current = now;
      const frozen = pauseRef.current || manualPauseRef.current;
      const inHold = highlightHoldRef.current > now;
      const speed = frozen ? 0 : inHold ? 0.2 : 1;
      if (start) animClockRef.current = Math.min(TRACK_ROUND_MS, animClockRef.current + dtReal * speed);
      const elapsed = start ? animClockRef.current : Infinity;
      const tRaw = reduced.current || elapsed >= TRACK_ROUND_MS ? 1 : elapsed / TRACK_ROUND_MS;
      const done1 = tRaw >= 1;
      let changed = false;
      for (const t of rt) {
        const from = t.roundStartScore;
        const target = t.displayScore;
        // Per-Token-Dynamik: jedes Token hat eine eigene Easing-Kurve (gamma) → mal
        // besserer Start (gamma<1: früh vorn, dann gehalten), mal besseres Ende (gamma>1:
        // spät aufholend, Sprint-Finish). Start & Ende bleiben identisch → das ERGEBNIS
        // ändert sich nicht, nur die DARSTELLUNG der Bewegung. gamma deterministisch aus
        // idx + Runden-Start (stabil in der Etappe, variiert je Runde) → lebendiges Feld.
        const gamma = 0.55 + (((t.idx * 73 + Math.floor(start / 997)) % 100) / 100) * 1.25; // 0.55…1.80
        const te = done1 ? 1 : Math.pow(tRaw, gamma);
        const v = done1 ? target : round1(from + (target - from) * te);
        if (v !== t.animScore) {
          t.animScore = v;
          changed = true;
        }
      }
      // Highlight-Zeitlupe (nicht blockierend). Einmalig pro Etappe: Ring an den
      // hervorgehobenen Token + geteilter Zeitstrahl ~1,5 s in Zeitlupe (0,2×) +
      // enger Zoom. Origin über die echt gerenderte Token-Lage (sonst landet der
      // Zoom daneben, weil die SVG skaliert/geletterboxed ist).
      //
      // ANLASS (Owner-Wunsch v2): Highlights sind Verletzungen UND der beste Spieler
      // jeder Etappe. Die frühere Bedingung „Bewegung berührt das Podest der kommenden
      // Runde" ist ersetzt durch die ETAPPEN-KÜR: die Top 3 der Etappe werden mit
      // Gold/Silber/Bronze gekürt (Rahmen bleibt bis zur nächsten Kür am Token), der
      // Zoom fährt auf den Etappenbesten, dazu die drei Spielerkarten als Overlay.
      // Verletzungen behalten Vorrang: dann zeigt der Zoom die betroffenen Teams und
      // die Karten treten zurück (das Verletzungs-Spotlight trägt diesen Moment).
      if (start && !zoomFiredRef.current && tRaw > 0.42 && tRaw < 0.72 && !reduced.current) {
        zoomFiredRef.current = true;
        const crownData = stageCrownRef.current;
        const focus = resolveStageHighlight({
          injuredIdxs: rt.filter((t) => t.stageInjured).map((t) => t.idx),
          crown: crownData.list,
        });
        // Kür-Rahmen IMMER neu setzen (auch in Verletzungs-Etappen): erst alle
        // löschen, dann die aktuellen Top 3 — so wandert der Rahmen jede Etappe
        // zum neuen Podest statt zu verwaisen.
        for (const t of rt) t.stageMedal = 0;
        for (const c of crownData.list) {
          const ct = rt.find((t) => t.idx === c.idx);
          if (ct) ct.stageMedal = c.medal;
        }
        if (focus.trioIdxs.length) {
          setHighlightTrio(focus.trioIdxs);
          const HOLD_MS = 1500;
          highlightHoldRef.current = now + HOLD_MS;
          // Zoom-Zentrum = Schwerpunkt der ECHT gerenderten Zoom-Ziel-Token (bei der
          // Kür genau EIN Token: der Etappenbeste). Wir lesen die Bildschirmposition
          // direkt aus dem DOM (data-token-code → getBoundingClientRect), nicht aus
          // host.tokenPos — denn die Felder platzieren die Token selbst (Oval,
          // Streuung …); host.tokenPos traf die reale Position nicht und der Zoom
          // landete daneben (z.B. unten rechts).
          const svg = svgRef.current;
          let origin = { ox: 50, oy: 50, scale: 1.65 };
          if (svg) {
            const rect = svg.getBoundingClientRect();
            const centers: { x: number; y: number }[] = [];
            for (const zi of focus.zoomIdxs) {
              const zt = rt.find((t) => t.idx === zi);
              if (!zt) continue;
              const el = svg.querySelector(`[data-token-code="${zt.code}"]`) as SVGGraphicsElement | null;
              if (el) {
                const b = el.getBoundingClientRect();
                if (b.width > 0 || b.height > 0) centers.push({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
              }
            }
            if (centers.length && rect.width > 0 && rect.height > 0) {
              const mx = centers.reduce((s, p) => s + p.x, 0) / centers.length;
              const my = centers.reduce((s, p) => s + p.y, 0) / centers.length;
              origin = {
                ox: Math.max(6, Math.min(94, ((mx - rect.left) / rect.width) * 100)),
                oy: Math.max(6, Math.min(94, ((my - rect.top) / rect.height) * 100)),
                scale: 1.65,
              };
            }
          }
          setZoom(origin);
          if (focus.showCards) {
            setStageCrown(crownData);
            window.setTimeout(() => setStageCrown((cur) => (cur === crownData ? null : cur)), STAGE_CROWN_MS + 250);
          }
          window.setTimeout(() => {
            setZoom(null);
            setHighlightTrio([]);
          }, HOLD_MS);
        }
      }
      // Rangliste gedrosselt neu rendern (~13 fps) solange die Runde rampt.
      if (changed && tRaw < 1 && Date.now() - lastForce > 75) {
        lastForce = Date.now();
        force();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Rang-/Slot-Mathematik (Port der Szene) ----
  // Finale End-Summe eines Teams (ALLE Slots, deterministisch) — der Spoiler-Wert.
  function finalTotal(t: RT): number {
    let s = 0;
    for (const p of t.players ?? []) if (p) s += playerNet(p);
    return s;
  }
  function recomputeRanks(rt: RT[]): void {
    const order = [...rt].sort((a, b) => b.score - a.score || a.seasonRank - b.seasonRank);
    order.forEach((t, i) => {
      // trueRank = Wahrheit (Logik/Historie). `rank` (Anzeige) wird gleich mitgesetzt und
      // im Render-Body aus dem animScore-Zeitstrahl überschrieben, solange eine Etappe
      // rampt — am Etappenende sind beide wieder identisch.
      t.trueRank = i + 1;
      t.rank = i + 1;
    });
    // Medaille = FINALE Top-3 (bewusster Vorab-Spoiler, vom Nutzer gewünscht): welche 3 Teams
    // am Ende die höchsten End-Summen haben, tragen VON RUNDE 1 AN dauerhaft Gold/Silber/Bronze
    // — so kann man die späteren Sieger von Beginn an beobachten. Stabil (wandert nicht mit dem
    // Live-Rang). 1=Gold, 2=Silber, 3=Bronze.
    const finals = rt
      .map((t) => ({ t, s: finalTotal(t) }))
      .sort((a, b) => b.s - a.s || a.t.seasonRank - b.t.seasonRank);
    for (const t of rt) t.roundMedal = 0;
    finals.slice(0, 3).forEach((x, i) => {
      x.t.roundMedal = (i + 1) as 1 | 2 | 3;
    });
  }
  function slotRankOf(slot: number, team: RT, rt: RT[]): number {
    const my = playerNet(team.players[slot]);
    let better = 0;
    rt.forEach((o) => {
      const p = o.players[slot];
      if (p && playerNet(p) > my) better += 1;
    });
    return better + 1;
  }
  function computeRoundStandings(rnd: number, rt: RT[]): void {
    const after = rt.map((t) => {
      let s = 0;
      for (let k = 0; k <= rnd; k += 1) {
        const p = t.players[k];
        if (p) s += playerNet(p);
      }
      return { t, after: s };
    });
    after
      .slice()
      .sort((a, b) => b.after - a.after || a.t.seasonRank - b.t.seasonRank)
      .forEach((o, i) => (o.t.roundRankAfter = i + 1));
    rt.forEach((t) => {
      t.roundDelta = t.roundStartRank - t.roundRankAfter;
    });
  }
  function applyReveal(t: RT, slot: number, rt: RT[]): { player: NativeStagePlayer | null; net: number } {
    const p = t.players[slot] ?? null;
    const net = playerNet(p);
    t.score = round1(t.score + net);
    t.thrownSlot = slot;
    recomputeRanks(rt); // setzt Rang + Gesamt-Top-3-Medaille (Gold/Silber/Bronze, stabil)
    return { player: p, net };
  }
  function noteReveal(t: RT, slot: number, res: { player: NativeStagePlayer | null; net: number }, isMine: boolean, rt: RT[]): Impact {
    if (!res.player) return { tier: 0, cause: "tick", color: "gold", text: "", delta: t.roundDelta };
    const net = res.net;
    const p = res.player;
    const bonSum = p.mods.filter((m) => m.sign > 0).reduce((s, m) => s + m.amt, 0);
    const injury = p.mods.some(isInjuryMod);
    const delta = t.roundDelta;
    const topNet = roundTopNet.current; // vorab bestimmter Etappensieger-Wert (kein prevBest)
    const slotRank = t.roundSlotRank; // vorab bestimmter Rang in dieser Etappe (1…N)
    const leaderBefore = rt.find((x) => x.roundStartRank === 1);
    const leaderChange = t.roundRankAfter === 1 && !!leaderBefore && leaderBefore.code !== t.code;
    const top3jump = t.roundStartRank >= 6 && t.roundRankAfter <= 3;

    let cause = "tick";
    let tier: 0 | 1 | 2 = 0;
    let color = "gold";
    let text = "";
    const malSum = p.mods.filter((m) => m.sign < 0).reduce((s, m) => s + m.amt, 0);
    if (injury) {
      cause = "injury";
      tier = 2;
      color = "red";
      text = `−${fmt1(malSum)} Verletzung`;
    } else if (p.val >= STAR_MIN) {
      cause = "star";
      tier = 2;
      color = "gold";
      text = `⭐ Star · Wert ${fmt1(p.val)}`;
    } else if (leaderChange) {
      cause = "leader";
      tier = 2;
      color = "gold";
      text = "neue Spitze · #1";
    } else if (top3jump) {
      cause = "top3";
      tier = 2;
      color = "violet";
      text = `P${t.roundStartRank} → P${t.roundRankAfter}`;
    } else if (slotRank === 1) {
      // echter Etappensieger (vorab bestimmt): Tier 2, umgeht Drosselung
      cause = "best";
      tier = 2;
      color = "gold";
      text = `Etappensieger · ${fmt1(net)}`;
    } else if (slotRank === 2 || slotRank === 3) {
      // echte Runden-Silber/Bronze: mind. Tier 1 (Ping + Glow) + Medaillenring
      cause = slotRank === 2 ? "silver" : "bronze";
      tier = 1;
      color = "gold";
      text = slotRank === 2 ? "Runden-Silber" : "Runden-Bronze";
    } else if (bonSum >= 13 && net > p.val) {
      cause = "push";
      tier = 1;
      color = "cyan";
      text = `+${fmt1(bonSum)} Push`;
    } else if (delta >= 3) {
      cause = "climb";
      tier = 1;
      color = "violet";
      text = `▲${delta} Plätze`;
    } else if (topNet > 0 && net >= topNet * 0.9) {
      cause = "strong";
      tier = 1;
      color = "gold";
      text = `stark · ${fmt1(net)}`;
    }
    // Budgets drosseln nur die Zusatz-Causes fremder Teams (leader/top3jump/push/
    // climb/strong). Die echten Top-3 (best/silver/bronze) sowie injury/star sind
    // ausgenommen und erscheinen immer in voller Tier-Stärke.
    const exemptFromBudget = cause === "injury" || cause === "star" || cause === "best" || cause === "silver" || cause === "bronze";
    if (!isMine && !exemptFromBudget) {
      if (tier === 2) {
        if (tier2Budget.current > 0) tier2Budget.current -= 1;
        else tier = 1;
      }
      if (tier === 1) {
        if (tier1Budget.current > 0) tier1Budget.current -= 1;
        else tier = 0;
      }
    }
    return { tier, cause, color, text, delta };
  }

  // ---- FX ----
  const fireFlash = useCallback(
    (color: string) => {
      if (reduced.current) return;
      const id = fxId.current++;
      setFlash({ color, id });
      later(() => setFlash((f) => (f && f.id === id ? null : f)), 520);
    },
    [later],
  );
  const doShake = useCallback(
    (soft: boolean) => {
      if (reduced.current) return;
      setShake(soft ? "soft" : "hard");
      later(() => setShake("none"), soft ? 320 : 440);
    },
    [later],
  );
  // FX-Position in Feld-% — BEVORZUGT aus der echt gerenderten Token-DOM-Lage (jedes Feld
  // platzt Token selbst; die Overlays Hovercard/Zoom lesen längst so). Der Host-tokenPos
  // ist die Row/Serpentine-Geometrie und weicht bei bespoke Feldern ab → Pops landen sonst
  // daneben. Fallback: host.tokenPos in %.
  const fxPct = useCallback(
    (code: string, fallback: { x: number; y: number }): { xPct: number; yPct: number } => {
      const svgEl = svgRef.current;
      const tokEl = svgEl?.querySelector(`[data-token-code="${code}"]`) as SVGGraphicsElement | null;
      const svgRect = svgEl?.getBoundingClientRect();
      const tokRect = tokEl?.getBoundingClientRect();
      if (svgRect && tokRect && svgRect.width > 0 && svgRect.height > 0 && (tokRect.width > 0 || tokRect.height > 0)) {
        return {
          xPct: ((tokRect.left + tokRect.width / 2 - svgRect.left) / svgRect.width) * 100,
          yPct: ((tokRect.top + tokRect.height / 2 - svgRect.top) / svgRect.height) * 100,
        };
      }
      return { xPct: (fallback.x / W) * 100, yPct: (fallback.y / H) * 100 };
    },
    [W, H],
  );
  const addPop = useCallback(
    (net: number, mine: boolean, pos: { x: number; y: number }, code?: string) => {
      if (reduced.current) return;
      const id = fxId.current++;
      const p = code ? fxPct(code, pos) : { xPct: (pos.x / W) * 100, yPct: (pos.y / H) * 100 };
      setPops((ps) => [...ps, { id, xPct: p.xPct + (Math.random() * 3 - 1.5), yPct: p.yPct - (Math.random() * 3 + 1), net, mine }]);
      later(() => setPops((ps) => ps.filter((p2) => p2.id !== id)), 950);
    },
    [later, W, H, fxPct],
  );
  const addFrags = useCallback(
    (p: NativeStagePlayer, pos: { x: number; y: number }, code?: string) => {
      if (reduced.current) return;
      const items = p.mods.filter((m) => Math.abs(m.amt) >= 0.05).slice(0, 4);
      const at = code ? fxPct(code, pos) : { xPct: (pos.x / W) * 100, yPct: (pos.y / H) * 100 };
      const created: Frag[] = items.map((m) => ({
        id: fxId.current++,
        xPct: at.xPct + (Math.random() * 4 - 2),
        yPct: at.yPct - 2,
        text: `${m.sign < 0 ? "−" : "+"}${fmt1(m.amt)} ${m.k}`,
        sign: m.sign,
      }));
      if (created.length === 0) return;
      setFrags((fs) => [...fs, ...created]);
      const ids = new Set(created.map((c) => c.id));
      later(() => setFrags((fs) => fs.filter((f) => !ids.has(f.id))), 900);
    },
    [later, W, H, fxPct],
  );
  const glow = useCallback(
    (t: RT) => {
      t.glowUntil = Date.now() + 1500;
      // Re-Render nach Ablauf, sonst pulsieren die letzten Ringe einer Runde
      // ewig weiter (nichts rendert mehr nach dem letzten Reveal).
      later(() => force(), 1550);
    },
    [later],
  );

  const showSpotlight = useCallback(
    (o: NonNullable<Spot>, holdMs = 1500) => {
      setSpotlight(o);
      later(() => setSpotlight((s) => (s === o ? null : s)), holdMs);
    },
    [later],
  );

  // Highlight-Banner setzen (nur track): ersetzt den laufenden Pop, blendet nach
  // ~2,6 s wieder aus. Bei reduced-motion bleibt er ohne Dauer-Animation stehen.
  const popBanner = useCallback(
    (text: string, kind: "gold" | "cyan" = "cyan") => {
      if (prim !== "track") return;
      const id = (bannerId.current += 1);
      setBanner({ text, kind, id });
      later(() => setBanner((b) => (b && b.id === id ? null : b)), 2600);
    },
    [prim, later],
  );

  const pushTicker = useCallback((t: RT, slot: number, res: { player: NativeStagePlayer; net: number }, impact: Impact, _rt: RT[]) => {
    const p = res.player;
    // Ticker-Slot-Rang MUSS mit dem Medaillen-Rang übereinstimmen: beide lesen den
    // vorab bestimmten roundSlotRank (Ties → eindeutig via seasonRank), nicht slotRankOf
    // (Ties → gleicher Rang) — sonst weichen Ticker-Zahl und Medaillenring bei Gleichstand
    // um eins ab (FIX C).
    const sr = t.roundSlotRank;
    const delta = t.roundDelta;
    const badgeMap: Record<string, [string, string]> = {
      star: ["var(--nl-warn)", "⭐ Star"],
      injury: ["var(--nl-risk)", "Verletzung"],
      leader: ["var(--nl-good)", "Neue Spitze"],
      top3: ["var(--nl-good)", "Sprung Top 3"],
      best: ["var(--nl-good)", "Etappensieger"],
      silver: ["var(--nl-silver)", "Runden-Silber"],
      bronze: ["var(--nl-bronze)", "Runden-Bronze"],
      push: ["var(--nl-accent)", "Hart gepusht"],
      climb: ["var(--nl-accent)", "Aufholjagd"],
      strong: ["var(--nl-good)", "Stark"],
    };
    const badge = badgeMap[impact.cause] ?? null;
    const row: TickerReveal = {
      kind: "reveal",
      id: `${slot}-${t.code}-${fxId.current++}`,
      code: t.code,
      idx: t.idx,
      isOwn: t.isOwn,
      logoUrl: t.logoUrl,
      star: p.val >= STAR_MIN,
      playerName: p.name,
      slotLbl: slots[slot] ?? `Etappe ${slot + 1}`,
      slotRank: sr,
      badge,
      calc: calcString(p),
      net: res.net,
      rankAfter: t.roundRankAfter,
      delta,
      slot,
    };
    setTicker((rows) => [row, ...rows].slice(0, TICKER_MAX));
  }, [slots]);

  const roundSummary = useCallback((rnd: number, rt: RT[]) => {
    const jumps = rt
      .map((t) => ({ t, d: t.roundStartRank - t.rank }))
      .filter((x) => x.d > 0)
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    const parts = jumps.map(({ t, d }) => {
      const p = t.players[rnd];
      return `${t.code} ▲${d} · ${p?.name ?? ""} ${p ? fmt1(playerNet(p)) : ""}`;
    });
    const row: TickerSummary = {
      kind: "summary",
      id: `sum-${rnd}-${fxId.current++}`,
      text: jumps.length ? `Runde ${rnd + 1} — Größte Sprünge: ${parts.join(" · ")}` : `Runde ${rnd + 1} — keine Rangsprünge`,
    };
    setTicker((rows) => [row, ...rows].slice(0, TICKER_MAX));
    jumps.forEach(({ t }) => glow(t));
  }, [glow]);

  // Runden-Kopfzeile (einmal je Runde) — ersetzt das wiederholte Slot-Label in jeder Reveal-Zeile.
  const pushRoundHeader = useCallback((rnd: number) => {
    const row: TickerHeader = {
      kind: "header",
      id: `hdr-${rnd}-${fxId.current++}`,
      text: `Runde ${rnd + 1} · ${slots[rnd] ?? `Etappe ${rnd + 1}`}`,
    };
    setTicker((rows) => [row, ...rows].slice(0, TICKER_MAX));
  }, [slots]);

  // ---- Podest ----
  const showPodium = useCallback(() => {
    const rt = rtRef.current;
    const top3 = [...rt].sort((a, b) => b.score - a.score || a.seasonRank - b.seasonRank).slice(0, 3);
    if (top3.length === 0) {
      // A4: keine Teams in dieser Disziplin — kein Podest zu zeigen, aber der
      // Lauf muss trotzdem als beendet gemeldet werden (setEnded/onEnded), sonst
      // bleibt der Spieler ohne "Weiter"-Button/"Spieltag auswerten"-Button hängen.
      setEnded(true);
      if (!endedFiredRef.current) {
        endedFiredRef.current = true;
        onEnded?.();
      }
      return;
    }
    // Eigentliche Podest-Enthüllung — als innere Funktion gehalten, damit ein
    // Fotofinish (enges Rennen) sie um ~1,2 s verzögern kann (FEATURE 2). onEnded
    // feuert ausschließlich hier drin (endedFiredRef-Guard) → genau einmal je Lauf.
    const revealPodium = () => {
      // visuelle Reihenfolge [P2, P1, P3]; Aufstieg P3→P2→P1
      const visual: (RT | undefined)[] = [top3[1], top3[0], top3[2]];
      const place = [2, 1, 3];
      const delayByVisual = [740, 1180, 300];
      const cols: PodCol[] = [];
      visual.forEach((t, i) => {
        if (!t) return;
        cols.push({ place: place[i], code: t.code, name: t.name, pts: t.score, logoUrl: t.logoUrl, isOwn: t.isOwn, idx: t.idx, delayMs: delayByVisual[i], loud: place[i] === 1 });
      });
      setPodium(cols);
      fireFlash("gold");
      cols.forEach((c) => later(() => { audio.wumms(c.loud ? 1.15 : 0.7); if (c.loud) doShake(false); }, c.delayMs));
      later(() => {
        setEnded(true);
        // Endstand erreicht → Host darf den Real-Modus-Endscreen zeigen (Spoiler-Gate A1).
        if (!endedFiredRef.current) {
          endedFiredRef.current = true;
          onEnded?.();
        }
      }, 2400);
    };
    // Fotofinish (nur track): Gold-Abstand winzig → Zeitlupen-Zoom auf den Zieleinlauf,
    // dann erst das Podest. Reduced-Motion: direkt enthüllen (kein Zoom, keine Verzögerung).
    // Fotofinish NUR bei Staffel (track): der scale(1.6)-Zoom + das harte Origin „26% 11%"
    // sind auf den Oval-Zieleinlauf getunt — bei jeder anderen Geometrie zoomt er auf eine
    // bedeutungslose Ecke und das erklärende Banner erscheint gar nicht.
    const close = prim === "track" && top3.length >= 2 && (top3[0]!.score - top3[1]!.score) <= Math.max(2.5, finalMax * 0.015);
    if (close && !reduced.current) {
      popBanner("📸 Fotofinish · Zieleinlauf", "gold");
      setPhotoFinish(true);
      audio.riser();
      later(() => {
        setPhotoFinish(false);
        audio.star();
        revealPodium();
      }, 1200);
    } else {
      revealPodium();
    }
  }, [audio, fireFlash, doShake, later, onEnded, finalMax, popBanner, prim]);

  // ---- Reveal-Cascade ----
  const advance = useCallback(() => {
    if (busyRef.current || round >= slotCount) return;
    busyRef.current = true;
    setBusy(true);
    const r = round;
    const rt = rtRef.current;
    // Lief die vorige Etappe noch (Glide nicht durch, z. B. weil manuell weitergeklickt oder
    // vom Host getaktet wurde), ist `t.score` bereits der volle Etappen-Endstand, das Token
    // steht aber noch davor. Dann startet die neue Rampe an der SICHTBAREN Position
    // (`animScore`) statt am Endstand — sonst springt das Token beim Etappenwechsel vorwaerts.
    // Der Zielwert bleibt unberuehrt (`displayScore` kommt aus `t.score`), das ERGEBNIS
    // aendert sich also nicht: das Token holt den Rueckstand innerhalb der neuen Etappe auf.
    const glideWasRunning = prim !== "barbell" && roundAnimStartRef.current !== 0;
    rt.forEach((t) => {
      t.roundStartRank = t.rank;
      // Basis der 5s-animScore-Rampe (Feld↔Tabelle-Sync).
      t.roundStartScore = resolveStageGlideStart({ animScore: t.animScore, score: t.score, glideWasRunning });
      // roundMedal NICHT mehr zurücksetzen: die Gesamt-Top-3-Medaille bleibt stabil und
      // wird in recomputeRanks bei jedem Reveal frisch gesetzt (kein Blinken am Etappenstart).
      // Verletzungen dieser Etappe vorab am Team markieren (gleiche Erkennung wie in
      // `noteReveal`): sie sind der Anlass, der den Highlight-Zoom von der Kür wegzieht,
      // und färben den Puls-Ring am Token rot.
      t.stageInjured = (t.players[r]?.mods ?? []).some(isInjuryMod);
    });
    // Runden-Slot-Ränge VORAB bestimmen (kein Spoiler: nur gespeichert, erscheint
    // erst mit dem Auftritt): alle Teams nach playerNet(players[r]) absteigend,
    // Tiebreak seasonRank. Liefert echte Top-Performer für Medaillen/Highlights.
    const slotOrder = computeSlotOrder(rt, r);
    slotOrder.forEach((o, i) => {
      o.t.roundSlotRank = i + 1;
    });
    // Etappensieger-Netto = bester Wert eines Teams, das in diesem Slot antritt.
    roundTopNet.current = slotOrder.find((o) => o.has)?.net ?? 0;
    // Etappen-Kür vorbereiten (Karten + Rahmen der Etappen-Top-3): hier eingefroren,
    // weil die rAF-Schleife zum Feuer-Zeitpunkt weder `r` noch die Slot-Reihenfolge kennt.
    stageCrownRef.current = { list: computeStageCrown(slotOrder, r), stage: r + 1, label: slots[r] ?? null };
    tier2Budget.current = 2;
    tier1Budget.current = 4;
    if (r === 0) audio.gun(0.6);
    pushRoundHeader(r);
    // Etappen-Wechsel-Banner (track): neue Staffel-Etappe startet.
    popBanner(`◇ Etappe ${r + 1} / ${slotCount} · Wechsel${slots[r] ? " · " + slots[r] : ""}`, "cyan");
    computeRoundStandings(r, rt);
    // ALLE Disziplinen (nicht nur track): sämtliche Token peilen ihre Runden-
    // Endposition GEMEINSAM an und gleiten simultan über TRACK_ROUND_MS (5s) dorthin.
    // displayScore = kumulierter Score NACH diesem Slot; für alle Teams im DEMSELBEN
    // Render gesetzt → gemeinsamer, gleichmäßiger Start des Gleitens (kein „Batch-
    // Sprung" am Ende). Der echte score (Wahrheit) zählt weiter Slot für Slot in der
    // Cascade hoch (Ladder/Ticker/Medaillen bleiben sequenziell). Felder positionieren
    // ihre Token über displayScore (siehe types.ts / shared.tsx posScore).
    rt.forEach((t) => {
      t.displayScore = round1(t.score + playerNet(t.players[r]));
    });
    // Geteilten 5s-Zeitstrahl starten: animScore rampt jetzt roundStartScore→displayScore
    // (Feld ↔ Rangliste synchron). Zoom-Highlight für diese Runde neu scharf schalten.
    roundAnimStartRef.current = Date.now();
    zoomFiredRef.current = false;
    if (prim === "track") {
      // Staffelstab-Übergabe (FEATURE 1): bei jedem Etappenwechsel (ab Etappe 2 — Etappe 1
      // hat keinen abgebenden Läufer) reicht jedes Token seinen Stab nach vorn. Ein einziger
      // leiser globaler Cue (nicht pro Token). Reduced-Motion: komplett übersprungen.
      if (r >= 1 && !reduced.current) {
        setHandoffTs(Date.now());
        audio.risingPing(4);
        later(() => force(), 650);
      }
    }
    // Gewichtheben · Kraft-Turm: die geforderte Last (goldene Latte) steigt eine Stufe.
    // Alle Heber + die Latte gleiten simultan (dur = TRACK_ROUND_MS). Wer die neue Last
    // nicht mehr packt (endKg < Last), reißt und fällt auf sein Endgewicht (= Score).
    // Score bleibt Wahrheit: endKg ist monoton im Endscore → Endstand = Score-Rang.
    if (prim === "barbell" && barbellInfo) {
      // Barbell-Rangfolge der Vorrunde merken (für die ▲/▼-Pfeile).
      const prevRankMap: Record<string, number> = {};
      barbellOrder().forEach((t, i) => {
        prevRankMap[t.code] = i + 1;
      });
      barbellPrevRankRef.current = prevRankMap;
      const prevBar = barbellDemandRef.current ?? barbellInfo.axTop;
      barbellPrevDemandRef.current = prevBar;
      const isLast = r + 1 >= slotCount;
      // Letzte Runde: die Latte erreicht kgMax (nur der Champion hält) → Sieg-Hebung.
      const nextBar = isLast ? barbellInfo.kgMax : Math.round(barbellInfo.axTop + (barbellInfo.kgMax - barbellInfo.axTop) * ((r + 1) / slotCount));
      const newlyOut = rt.filter((t) => {
        const ek = (barbellInfo.endKgByCode.get(t.code) ?? Infinity);
        return prevBar <= ek && nextBar > ek;
      });
      barbellDemandRef.current = nextBar;
      setDemandKg(nextBar);
      if (isLast) {
        const champ = [...rt].sort((a, b) => (barbellEndKgOf(b.code)) - (barbellEndKgOf(a.code)) || a.seasonRank - b.seasonRank)[0];
        setBarbellMsg({ text: champ ? `🏆 Sieg-Hebung · ${champ.code} stemmt ${barbellEndKgOf(champ.code)} kg` : "🏆 Endstand", kind: "end" });
      } else if (newlyOut.length) {
        const first = newlyOut[0]!;
        setBarbellMsg({ text: newlyOut.length > 1 ? `🔴 ${first.code} +${newlyOut.length - 1} reißen bei ${nextBar} kg` : `🔴 ${first.code} reißt bei ${nextBar} kg`, kind: "red" });
      } else {
        setBarbellMsg({ text: `🏋 Geforderte Last steigt auf ${nextBar} kg`, kind: "kg" });
      }
    }
    const order = [...rt].sort((a, b) => b.trueRank - a.trueRank); // schlechteste zuerst
    let i = 0;
    const doOne = () => {
      // Hover-Pause: re-pollen ohne order[i] zu konsumieren (genau ein Timer,
      // busyRef bleibt true → Reihenfolge/Choreografie unverändert). Gleiches gilt für
      // die Highlight-Zeitlupe: während der ~1,5 s hält die Reveal-Cascade an (nur der
      // geteilte Zeitstrahl gleitet in Zeitlupe weiter) → Feld & Tabelle bleiben synchron.
      if (pauseRef.current || manualPauseRef.current || highlightHoldRef.current > Date.now()) {
        later(doOne, 120);
        return;
      }
      if (i >= order.length) {
        // Rundenende
        roundSummary(r, rt);
        rt.forEach((t) => t.rankHistory.push(t.trueRank)); // Rang-Verlauf je Etappe
        const nextRound = r + 1;
        setRound(nextRound);
        later(() => {
          busyRef.current = false;
          setBusy(false);
        }, 200);
        if (nextRound >= slotCount) later(showPodium, 900);
        force();
        return;
      }
      const t = order[i++];
      const isMine = t.isOwn;
      const res = applyReveal(t, r, rt);
      const impact = noteReveal(t, r, res, isMine, rt);
      const pos = tokenPos(t, t.score);
      // Bewegung: Token gleitet (CSS-Transition); eigenes Team langsamer (Slow-Mo).
      force();
      // Leerer Slot (Team mit weniger Spielern): nur weiterrücken, keine FX.
      if (!res.player) {
        later(doOne, 90);
        return;
      }
      addPop(res.net, isMine, pos, t.code);
      addFrags(res.player, pos, t.code);
      pushTicker(t, r, { player: res.player, net: res.net }, impact, rt);
      // Highlight-Banner (track): neue Gesamtführung schlägt Etappensieger.
      if (impact.cause === "leader") popBanner(`🏆 Neue Führung · ${res.player.name} (${t.code})`, "gold");
      else if (impact.cause === "best") popBanner(`🥇 Etappensieger · ${res.player.name} (${t.code})`, "gold");
      // Sounds/Highlights nach Tier
      if (impact.tier === 2) {
        showSpotlight(
          {
            crest: { code: t.code, name: t.name, logoUrl: t.logoUrl, isOwn: t.isOwn, players: t.players },
            idx: t.idx,
            kick: causeKick(impact.cause, isMine),
            name: (isMine ? "★ " : "") + res.player.name,
            sub: `${t.code} · ${t.name}${slots[r] ? " · " + slots[r] : ""}`,
            net: res.net,
            chipText: impact.text,
            chipColor: impact.color,
            mine: isMine,
            portraitUrl: res.player.portraitUrl,
            injury: impact.cause === "injury",
            ovrRank: res.player.ovrRank ?? null,
          },
          // Verletzung bleibt länger im Bild als andere Tier-2-Highlights (1500ms) —
          // sichtbares, nicht-flüchtiges Feedback statt eines Blinzelns.
          impact.cause === "injury" ? 2400 : 1500,
        );
        fireFlash(impact.color);
        doShake(impact.cause === "injury" ? true : !isMine);
        if (impact.cause === "injury") audio.stumbleThud(isMine ? 0.5 : 0.4);
        else if (impact.cause === "star") {
          audio.star();
          later(() => audio.wumms(isMine ? 1.25 : 1.1), 300);
        } else {
          audio.riser();
          later(() => audio.wumms(isMine ? 1.1 : 0.92), 260);
        }
        glow(t);
      } else if (impact.tier === 1) {
        audio.risingPing(res.net);
        glow(t);
      } else if (!isMine) {
        audio.crowdSwell(0.14, 0.28);
      }
      if (isMine && impact.tier < 2) {
        showSpotlight(
          {
            crest: { code: t.code, name: t.name, logoUrl: t.logoUrl, isOwn: true, players: t.players },
            idx: t.idx,
            kick: "DEIN LÄUFER",
            name: "★ " + res.player.name,
            sub: `${t.code} · ${t.name}${slots[r] ? " · " + slots[r] : ""}`,
            net: res.net,
            chipText: `+${fmt1(res.net)}`,
            chipColor: "gold",
            mine: true,
            portraitUrl: res.player.portraitUrl,
            ovrRank: res.player.ovrRank ?? null,
          },
          900,
        );
        glow(t);
      }
      // Gleichmäßiger Takt statt variabler Highlight-Pausen: die Reveals verteilen sich
      // exakt über das 5s-Glide-Fenster (TRACK_ROUND_MS / Teamzahl), damit die Rangliste
      // SYNCHRON zur Feldbewegung hochläuft und nicht lange nachtrudelt. Highlights
      // (Spotlight/Zoom) feuern weiter, unterbrechen den Fluss aber NICHT mehr (kein
      // 1550ms-Stopp). Cinematic Slow-Mo/Zoom kommt als eigene, nicht-blockierende Schicht.
      const delay = Math.max(70, Math.round(TRACK_ROUND_MS / Math.max(1, order.length)));
      later(doOne, delay);
    };
    doOne();
  }, [round, slotCount, audio, tokenPos, addPop, addFrags, pushTicker, pushRoundHeader, showSpotlight, fireFlash, doShake, glow, roundSummary, showPodium, later, slots, popBanner, barbellInfo, barbellOrder]);

  // Auto-Continue (ALLE Disziplinen): die Disziplin läuft ab Start von selbst durch —
  // Etappe für Etappe im TRACK_ROUND_MS-Takt, ohne Klick — bis der Endstand steht.
  // Pausiert man (Leertaste), stoppt es; Hover friert die laufende Etappe ein. Der
  // ▶-Button bleibt für manuelles Weiterklicken erhalten (busyRef schützt vor Doppel).
  useEffect(() => {
    // Start-Gate: NICHT von allein loslaufen — erst nach dem ersten ▶-Klick (started).
    // Danach automatisch Etappe für Etappe weiter, bis Pause/Ende.
    if (!started || done || busy || paused) return;
    // Co-op: der GUEST advanced nie von allein — er folgt nur den Host-Schritten
    // (Effekt unten). Und solange der „beide bereit"-Gate aktiv ist, läuft nichts.
    if (roomSync?.followsHost || roomSync?.coopGate.active) return;
    // Die Etappe hat ZWEI voneinander unabhaengige Uhren:
    //   1. die Reveal-Cascade (echte Timer, ~TRACK_ROUND_MS / Teamzahl je Team) — sie gibt
    //      `busy` frei und loest diesen Effekt aus;
    //   2. die VIRTUELLE Etappen-Uhr `animClockRef`, an der die Token-Bewegung haengt. Die
    //      laeuft bei Hover/Leertaste mit Speed 0 und waehrend der Highlight-Zeitlupe mit
    //      0,2× — sie braucht also real laenger als TRACK_ROUND_MS.
    //
    // Wechselte die Etappe allein nach (1), stand die Bewegung noch mitten im Gleiten. Der
    // naechste `advance()` setzt `roundStartScore = t.score` (der VOLLE Etappen-Endstand)
    // und startet die Uhr neu — das Token sprang damit vorwaerts auf das Etappenende,
    // statt dort weiterzulaufen, wo es gerade war. Genau das war als „die Folgeetappe
    // faengt nicht dort an, wo die vorherige aufhoert" sichtbar, und nur „teils", weil es
    // davon abhing, ob Zeitlupe oder Hover die virtuelle Uhr zurueckgeworfen hatten.
    //
    // Deshalb wird jetzt zusaetzlich auf (2) gewartet: erst wenn die virtuelle Uhr das
    // Etappenende erreicht hat, laeuft der Puffer und die naechste Etappe beginnt — dort,
    // wo die vorige tatsaechlich geendet hat.
    if (reduced.current) {
      const id = window.setTimeout(() => advance(), 0);
      return () => window.clearTimeout(id);
    }
    let id = 0;
    const waitForGlide = () => {
      const glideDone = roundAnimStartRef.current === 0 || animClockRef.current >= TRACK_ROUND_MS;
      if (!glideDone) {
        id = window.setTimeout(waitForGlide, 80);
        return;
      }
      id = window.setTimeout(() => advance(), 600);
    };
    waitForGlide();
    return () => window.clearTimeout(id);
  }, [prim, round, busy, done, demandKg, advance, paused, started, roomSync?.followsHost, roomSync?.coopGate.active]);

  // Direktes Ueberspringen ohne Kaskade (Stufe 3.4 — "Nachholen durch Ueberspringen, nicht durch
  // Nachspielen", die Antwort auf Befund-Punkt 4 "kein Rueckwaerts, kein Sprung"). Baut den
  // Zustand bis EINSCHLIESSLICH `targetRound - 1` direkt auf, ohne jede Zwischenetappe der
  // Reveal-Kaskade abzuspielen — modelliert nach `quickSim` weiter unten (dieselbe Rechnung),
  // nur mit einem BELIEBIGEN Ziel statt `slotCount`. Das macht sie auch fuer RUECKWAERTS-Spruenge
  // tauglich (ein Host-Reset ist `targetRound < round`) — `quickSim` selbst kennt das nicht, weil
  // sie nur je in eine Richtung (ans Ende) laeuft.
  //
  // Nur fuer den Guest-Pfad gedacht: der Host bleibt bei der echten Kaskade (Sounds/Highlights/
  // Gleiten), damit ihm nichts von seiner eigenen Inszenierung genommen wird.
  const jumpToRound = useCallback(
    (targetRound: number) => {
      clearTimers();
      const clamped = Math.max(0, Math.min(slotCount, targetRound));
      rtRef.current = buildRT();
      const rt = rtRef.current;
      for (let r = 0; r < clamped; r += 1) {
        rt.forEach((t) => {
          const p = t.players[r];
          if (p) {
            t.score = round1(t.score + playerNet(p));
            t.thrownSlot = r;
          }
        });
        recomputeRanks(rt);
        rt.forEach((t) => t.rankHistory.push(t.trueRank));
      }
      rt.forEach((t) => {
        t.displayScore = t.score;
        t.animScore = t.score;
      });
      roundAnimStartRef.current = 0; // kein Gleiten — der Sprung landet direkt auf dem Zielwert
      setRound(clamped);
      setBusy(false);
      busyRef.current = false;
      setSpotlight(null);
      setPops([]);
      setFrags([]);
      setTicker([]);
      setBanner(null);
      setHandoffTs(0);
      setPhotoFinish(false);
      setStageCrown(null);
      // A2 (Befund, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): vorher fehlten hier genau die Felder, die
      // `reset()` (Knopf/Mount) laengst raeumt — podium/flash/shake/hover/stageCrownRef/demandKg/
      // die Barbell-Refs. Ein Host-Reset ("↻ Neu") laesst `round` per Raum-Sync auf 0 zurueckfallen,
      // der Gast landet ueber `jumpToRound(0)` HIER (delta<0 ⇒ "jump", siehe
      // `resolveArenaCatchUpMode`) — vorher blieb dabei das alte Podest sichtbar UEBER dem frisch
      // gestarteten Feld (Etappe 0), Flash/Shake der letzten Etappe standen nach, die Kür-Rahmen der
      // alten Kür klebten weiter am Token, und bei Gewichtheben zeigte die Latte noch die zuletzt
      // geforderte Last. Dieselben Felder wie in `reset()`, NICHT `onReset(...)` selbst — ein
      // Nachholsprung ist kein "der Nutzer hat neu gestartet"-Ereignis (der Host meldet das schon
      // separat über `onHostReset`), nur ein Bild, das den Zielzustand ohne Kaskade zeigen muss.
      setPodium(null);
      setFlash(null);
      setShake("none");
      setHover(null);
      stageCrownRef.current = { list: [], stage: 0, label: null };
      setDemandKg(null);
      setBarbellMsg(null);
      barbellDemandRef.current = null;
      barbellPrevDemandRef.current = null;
      barbellPrevRankRef.current = {};
      // Start-Gate mit hochziehen: ein Guest, der auf Etappe 7 springt, gehoert sichtbar zu "laeuft
      // bereits" (Feld-Startaufstellung waere sonst weiter zu sehen, siehe `started` in `fieldCtx`).
      setStarted(true);
      force();
      if (clamped >= slotCount) {
        later(showPodium, 200);
      } else {
        setEnded(false);
        endedFiredRef.current = false;
      }
    },
    [slotCount, clearTimers, buildRT, later, showPodium],
  );

  // Co-op GUEST: zieht `round` auf den vom Host getriebenen `syncedRound`-Schritt nach.
  //
  // "advance-one" (Ziel genau einen Schritt weiter): spielt dieselbe Reveal-Kaskade wie der Host,
  // nur host-getaktet — der normale Fall, waehrend beide live mitschauen. Pausiert der Host,
  // bewegt sich `syncedRound` nicht → der Guest bleibt automatisch stehen (`resolveArenaCatchUpMode`
  // liefert dann "in-sync", nichts zu tun).
  //
  // "jump" (alles andere: >1 Schritt Rueckstand, Spaet-Einstieg BEI round=0, oder ein
  // RUECKWAERTS-Ziel nach einem Host-Reset): baut den Zielzustand direkt auf, statt jede
  // Zwischenetappe nachzuspielen — vorher war das gar nicht vorgesehen: `syncedRound > round`
  // (die alte Bedingung) kannte nur "vorwaerts, ein Schritt", ein Reset des Hosts (kleineres Ziel)
  // bewegte den Guest ueberhaupt nicht.
  //
  // Gate ist `followsHost` (Guest im Room), NICHT `waitingForHost` (Guest VOR dem Host-Start):
  // Letzteres kippt beim Start des Hosts auf false und haette diesen Effekt genau dann
  // abgeschaltet, wenn die Host-Schritte eintreffen. Da der Guest zugleich den ▶-Button nicht
  // klicken kann (`canControl` false → `started` bleibt false → Auto-Continue greift nie), gab es
  // danach keinen Pfad mehr, der `round` bewegt: der Guest stand ohne Reveal und ohne Hinweis da.
  useEffect(() => {
    if (!roomSync?.followsHost) return;
    // A1 (Befund, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): die gemeinsame Zeitbasis TATSAECHLICH
    // benutzt, statt nur transportiert. `roomSync.stepStartedAtMs`/`stepDurationMs`/`clockOffsetMs`
    // kamen bis hierher als Props an und wurden nirgends gelesen — `resolveArenaDisplayState`/
    // `estimateServerNowMs` hatten null Aufrufer im Produktivcode. Das war die Kernzusage des
    // Pakets, die NICHT eingeloest war: zwei Browser zeigten dieselbe Reihenfolge, aber nicht
    // denselben Moment.
    //
    // WAS HIER TATSAECHLICH BEHOBEN WIRD (der kleinstmoegliche Schritt, der die Zusage einloest):
    // ohne Uhr entschied allein die Schrittdifferenz, ob der Gast eine volle, ~10s lange lokale
    // Reveal-Kaskade abspielt ("advance-one") — auch dann, wenn die Host-Meldung so spaet ankam
    // (gedrosselter Hintergrund-Tab, Reconnect, hohe Latenz), dass der gemeldete Schritt laut
    // Server-Uhr laengst eingeschwungen war. Eine frische Kaskade haette den Gast dann nicht
    // aufholen lassen, sondern IMMER WEITER zurueckfallen (jede Kaskade braucht selbst wieder die
    // volle Schrittdauer). `resolveArenaCatchUpMode` bekommt deshalb jetzt die Uhr mit
    // (`targetStepClock`) und liefert in genau diesem Fall "jump" statt "advance-one" — der
    // Zielzustand wird direkt aufgebaut, keine stale Kaskade.
    //
    // WAS BEWUSST LOKAL BLEIBT (ehrlich benannt, kein zweiter unbenutzter Verkabelungs-Anspruch):
    // die Kaskade SELBST (Sounds/Highlights/Token-Gleiten, `animClockRef`/`roundAnimStartRef` in
    // `advance()`) laeuft weiterhin auf der lokalen `Date.now()`-Uhr des Gasts, sobald sie einmal
    // gestartet ist — ein voller Umbau dieses Animationsmotors auf die Server-Uhr (jede Teilnahme-
    // Choreografie einzeln aus `serverNowMs` ableiten) ist eine eigene, groessere Aufgabe (Stufe
    // 3.4 vollstaendig). Innerhalb einer normal getakteten "advance-one"-Kaskade bleibt der
    // Versatz zum Host auf Netzwerklatenz begrenzt (typ. << 1s) — der hier behobene Fall ist der
    // GROSSE, sichtbare Rueckstand, nicht die letzte Millisekunde Choreografie-Feinschliff.
    const targetStepClock =
      roomSync.stepStartedAtMs != null && roomSync.stepDurationMs != null
        ? {
            step: {
              stepIndex: roomSync.stepIndex ?? 0,
              stepStartedAt: new Date(roomSync.stepStartedAtMs).toISOString(),
              stepDurationMs: roomSync.stepDurationMs,
              paused: roomSync.hostPaused ?? false,
            } satisfies ArenaStepSnapshot,
            serverNowMs: estimateServerNowMs(Date.now(), roomSync.clockOffsetMs ?? 0),
          }
        : undefined;
    const mode = resolveArenaCatchUpMode({
      localStepIndex: round,
      targetStepIndex: roomSync.syncedRound,
      localCascadeRunning: busy,
      targetStepClock,
    });
    if (mode === "advance-one") {
      advance();
    } else if (mode === "jump") {
      jumpToRound(roomSync.syncedRound);
    }
  }, [
    roomSync?.followsHost,
    roomSync?.syncedRound,
    roomSync?.stepIndex,
    roomSync?.stepStartedAtMs,
    roomSync?.stepDurationMs,
    roomSync?.clockOffsetMs,
    roomSync?.hostPaused,
    round,
    busy,
    advance,
    jumpToRound,
  ]);

  // Pause als geteilter Zustand (Stufe 3.6): der Guest hat keine eigene Pause-Autoritaet — er
  // spiegelt IMMER `roomSync.hostPaused` (ueber `resolveArenaEffectivePause`), nie den eigenen
  // Tastendruck. Ohne befuellten `hostPaused` (Aufrufer liefert das Feld noch nicht) ist der Wert
  // `undefined` → `resolveArenaEffectivePause` behandelt das wie "nicht pausiert", der Guest
  // verhaelt sich also unveraendert, solange die Raum-Anbindung dieses Feld noch nicht sendet.
  //
  // BEFUND F8 (Aufgabe #45): dieser Effekt lief bisher NUR beim Gast (`followsHost`). Fuer den Host
  // war das richtig, SOLANGE die Raum-Pause immer seine eigene war. Nach einem Server-Neustart
  // mitten im Reveal stimmt das nicht mehr: `resumeRoomArenaAfterRestart` haelt die Enthuellung an,
  // ohne dass jemand etwas gedrueckt hat. Der Host haette dann die Vorgabe `localPauseIntent: false`
  // und liefe weiter, waehrend der Gast dem Raum-Feld folgt und einfriert — beide Seiten auf
  // verschiedenen Etappen. Der Effekt laeuft deshalb jetzt fuer BEIDE Rollen; die Entscheidung
  // selbst trifft weiterhin allein `resolveArenaEffectivePause`, das dem Host seine eigene Absicht
  // laesst, AUSSER bei einer Pause ohne Urheber (`hostPausedBy === null`).
  //
  // Fuer den Host ist das im Normalbetrieb ein Nichts-Tun: `resolveArenaEffectivePause` gibt ihm
  // dann exakt `manualPauseRef.current` zurueck, also den Wert, der ohnehin schon gesetzt ist.
  // Sein Leertaste-Handler dreht `manualPauseRef` selbst um — ein vom Neustart erzwungenes `true`
  // wird durch den ersten Druck also zu "weiter", genau wie gewuenscht.
  useEffect(() => {
    if (!roomSync?.active) return;
    const effectivePause = resolveArenaEffectivePause({
      roomActive: roomSync.active,
      isHost: Boolean(roomSync.isHost),
      roomPaused: roomSync.hostPaused ?? false,
      roomPausedBy: roomSync.hostPausedBy,
      localPauseIntent: manualPauseRef.current,
    });
    manualPauseRef.current = effectivePause;
    setPaused(effectivePause);
  }, [roomSync?.active, roomSync?.isHost, roomSync?.hostPaused, roomSync?.hostPausedBy]);

  // Co-op HOST: meldet jeden eigenen Reveal-Schritt an den Room (nur bei Increment,
  // nicht beim initialen round=0 und nicht nach „↻ Neu"-Reset).
  const prevSyncRoundRef = useRef(0);
  useEffect(() => {
    if (!roomSync?.active || !roomSync.isHost) {
      prevSyncRoundRef.current = round;
      return;
    }
    if (round > prevSyncRoundRef.current) {
      roomSync.onHostAdvanced();
    }
    prevSyncRoundRef.current = round;
  }, [round, roomSync]);

  const quickSim = useCallback(() => {
    if (busyRef.current) return; // Busy-Guard: keine Doppel-Auslösung während einer Cascade.
    clearTimers();
    // Frischer Aufbau: NICHT auf bestehende Scores addieren (sonst Doppel-Zählung
    // nach manuellen Etappen oder erneutem Quick-Sim → z.B. 420 statt 210). (B2)
    rtRef.current = buildRT();
    const rt = rtRef.current;
    for (let r = 0; r < slotCount; r += 1) {
      rt.forEach((t) => {
        const p = t.players[r];
        if (p) {
          t.score = round1(t.score + playerNet(p));
          t.thrownSlot = r;
        }
      });
      // Rang nach JEDER Etappe festhalten — exakt wie im sequenziellen Pfad
      // (`rt.forEach((t) => t.rankHistory.push(t.trueRank))` am Rundenende).
      // Vorher wurde nur EINMAL am Schluss gerechnet und die Historie dann mit
      // `slotCount` Kopien des Endrangs gefüllt: damit gab es nach einem
      // Quick-Sim gar keinen Verlauf mehr — die Rang-Δ-Spalte zeigte überall
      // "—" und die Bump-/Slalom-Linien liefen schnurgerade. Die Kosten sind
      // `slotCount` Sortierungen über die Teamliste, also vernachlässigbar.
      recomputeRanks(rt);
      rt.forEach((t) => t.rankHistory.push(t.trueRank));
    }
    rt.forEach((t) => {
      t.displayScore = t.score; // Token-Position sofort auf Endstand (kein Nach-Gleiten)
      t.animScore = t.score; // Sync-Rampe direkt auf Endstand (Quick-Sim: kein Ramp)
    });
    roundAnimStartRef.current = 0; // Anim-Rampe aus (Endstand steht sofort)
    setRound(slotCount);
    setBusy(false);
    busyRef.current = false;
    setSpotlight(null);
    setPops([]);
    setFrags([]);
    setTicker([]);
    setBanner(null);
    setHandoffTs(0);
    setPhotoFinish(false);
    setStageCrown(null);
    force();
    later(showPodium, 200);
    // Quick-Sim als Raum-Aktion (Stufe 3.6): der Guest muss denselben Sprung ans Ende sehen —
    // sonst stuende er auf einer Etappe, die es beim Host nicht mehr gibt. `onHostQuickSim` ist
    // optional/no-op, solange der Aufrufer sie nicht befuellt.
    if (roomSync?.active && roomSync.isHost) {
      roomSync.onHostQuickSim?.();
    }
  }, [slotCount, clearTimers, buildRT, later, showPodium, roomSync]);

  function causeKick(cause: string, mine: boolean): string {
    const own = mine ? "DEIN LÄUFER · " : "";
    switch (cause) {
      case "leader":
        return own + "Neue Spitze";
      case "top3":
        return own + "Sprung in die Top 3";
      case "best":
        return own + "Bestwert der Etappe";
      case "injury":
        return own + "Verletzung";
      case "star":
        return (mine ? "DEIN STAR · " : "⭐ ") + "Star-Moment";
      default:
        return own + "Standout";
    }
  }

  // ---- Detail-Ergebnis (nach Podest) ----
  const resultRows = useMemo<ResultTableRow[]>(() => {
    if (!ended) return [];
    const rt = rtRef.current;
    // Slot-Bestwerte je Spalte
    const bestNet: number[] = [];
    for (let s = 0; s < slotCount; s += 1) {
      bestNet[s] = Math.max(0, ...rt.map((t) => (t.players[s] ? playerNet(t.players[s]) : 0)));
    }
    return [...rt]
      .sort((a, b) => a.trueRank - b.trueRank)
      .map((t) => ({
        rank: t.trueRank,
        code: t.code,
        name: t.name,
        logoUrl: t.logoUrl,
        isOwn: t.isOwn,
        teamId: t.teamId ?? null,
        total: t.score,
        missingLineup: t.missingLineup,
        slots: Array.from({ length: slotCount }, (_, s) => {
          const p = t.players[s];
          const net = p ? playerNet(p) : 0;
          return {
            playerName: p?.name ?? "—",
            playerId: p?.playerId ?? null,
            net,
            slotRank: p ? slotRankOf(s, t, rt) : rt.length,
            boniMali: p ? modSum(p.mods) : 0,
            isBest: p ? Math.abs(net - bestNet[s]) < 0.05 && net > 0 : false,
            calc: p ? calcString(p) : "—",
          };
        }),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, slotCount, round]);

  // ---- EINE Anzeige-Wahrheit für Rang UND Punkte (Feld ↔ Tabelle) ----
  // Disziplinen, deren FELD den geteilten animScore-Zeitstrahl liest (Benchmark): für sie
  // läuft die Rangliste live & exakt synchron zur Feldbewegung (statt Cascade-Sprüngen),
  // Hover/Pause friert Feld UND Tabelle gemeinsam ein. Ausnahme: barbell (Gewichtheben)
  // behält seine eigene kg-Glide-Bewegung + Eliminations-Rangliste (barbellSorted).
  const animField = prim !== "barbell";
  // Live-Rang aus animScore (geteilter 5s-Zeitstrahl). Das Ergebnis wird DIREKT auf
  // `t.rank` zurückgeschrieben, damit ALLE Anzeigen (Feld-Badges in shared.tsx & den
  // Disziplin-Feldern, Klassen-Bänder, „Dein Team"-Karte, Hovercard, Ladder) exakt
  // dieselbe Zahl lesen. Vorher zog das FELD `t.rank` (sequenzieller Cascade-Rang, in
  // Schüben) und die TABELLE einen animierten Live-Rang → Feld #5 vs. Tabelle #1.
  // Die Wahrheit für Logik/Historie bleibt unangetastet in `t.trueRank`.
  if (animField) {
    [...rtRef.current]
      .sort((a, b) => b.animScore - a.animScore || a.seasonRank - b.seasonRank)
      .forEach((t, i) => {
        t.rank = i + 1;
      });
  } else {
    for (const t of rtRef.current) t.rank = t.trueRank;
  }
  // Anzeige-PUNKTE — dieselbe Regel wie beim Anzeige-Rang: solange eine Etappe rampt,
  // zeigen Feld UND Tabelle den interpolierten animScore (kein Vorauseilen). Beide
  // Größen konvergieren am Etappenende auf score/trueRank.
  const shownScore = (t: RT): number => (animField ? t.animScore : t.score);

  // ---- Live-Ladder ----
  // Bewusst NICHT memoisiert: jeder Reveal mutiert rtRef + force() re-rendert; die
  // Rangfolge muss dann live neu sortiert werden (32 Einträge, günstig).
  const sorted = [...rtRef.current].sort((a, b) => a.rank - b.rank);
  const me = rtRef.current.find((t) => t.isOwn) ?? null;
  const leader = sorted[0] ?? null;
  const now = Date.now();

  // Normierungsbasis = FESTER Endwert des besten Teams (finalMax) → dieser höchste Wert
  // bildet die ZIEL-Linie für ALLE Disziplinen. Die Skala steht damit die ganze Disziplin
  // über still (kein Verschieben je Runde), die Token bewegen sich nur VORWÄRTS Richtung
  // Ziel, und der Führende landet am Ende exakt auf der Linie. (Früher gegen den Live-
  // Führenden normiert — das entstauchte zwar, ließ aber Skala + Feld bei jedem Runden-
  // wechsel neu springen, was als „Zurückrutschen" wahrgenommen wurde.)
  const posMax = finalMax;
  posMaxRef.current = posMax;

  /**
   * Etappen-Label fuer den Chip kuerzen: mit Spielername + Wert + Rang in derselben Zeile
   * waere "Runde 1" zu breit. "Runde 3" -> "R3", "Etappe 2" -> "E2"; alles andere bleibt wie
   * es ist (Diszis mit sprechenden Etappennamen sollen die behalten), notfalls gekuerzt.
   */
  const shortSlotLabel = (label: string, index: number): string => {
    const numbered = /^(Runde|Etappe|Versuch|Durchgang)\s+(\d+)$/i.exec(label.trim());
    if (numbered) {
      return `${numbered[1]![0]!.toUpperCase()}${numbered[2]}`;
    }
    return label.length > 10 ? `${label.slice(0, 9)}…` : label || `E${index + 1}`;
  };

  // ---- Konsolidierte „Dein Team"-Karte (nur track) (FEATURE 3) ----
  // Ersetzt den früheren MyTracker-Streifen UND die separate „Dein Läufer"-Karte durch
  // eine kompakte 2-Zeilen-Karte: Kopf (Wappen · Name · Rang · Punkte · Δ zur Spitze ·
  // aktueller Läufer-Mini mit Medaillenring + Spieler-Drawer-Klick) und ein Split-Strip
  // mit einem Chip je Etappe. Als lokale Render-Funktion (wiederverwendbar, nicht nur inline).
  const renderMyTeamCard = () => {
    if (!me) return null;
    const stageIdx = me.thrownSlot >= 0 ? me.thrownSlot : Math.min(round, slotCount - 1);
    const runner = me.players[stageIdx] ?? null;
    const revealed = me.thrownSlot >= 0;
    const runnerSlotRank = revealed ? slotRankOf(me.thrownSlot, me, rtRef.current) : null;
    const runnerMedal: "gold" | "silver" | "bronze" | null = runnerSlotRank === 1 ? "gold" : runnerSlotRank === 2 ? "silver" : runnerSlotRank === 3 ? "bronze" : null;
    // Der AKTIVE Spieler (dran, egal ob schon aufgedeckt oder noch bevorstehend
    // diese Runde) ist verletzt → starkes, dauerhaftes optisches Feedback statt
    // nur der einmaligen Ticker-/Flug-Zeile (siehe PlayerMark `injury`-Prop).
    const runnerInjured = Boolean(runner && runner.mods.some(isInjuryMod));
    const clickable = Boolean(onOpenPlayer && runner?.playerId);
    // Rang UND Punkte aus derselben Anzeige-Wahrheit wie Feld + Rangliste (shownScore /
    // me.rank), sonst zeigte diese Karte den Cascade-Sprungwert und lief der Icon-
    // Bewegung voraus.
    const myShown = shownScore(me);
    const deltaToLeader = me.rank === 1 ? "Führung" : "−" + fmt1((leader ? shownScore(leader) : myShown) - myShown);
    return (
      <div
        style={{
          marginBottom: 10,
          borderRadius: 12,
          border: runnerInjured ? "1.5px solid var(--nl-risk)" : "1px solid var(--nl-accent)",
          background: runnerInjured ? "color-mix(in srgb, var(--nl-risk) 12%, transparent)" : "color-mix(in srgb, var(--nl-accent) 10%, transparent)",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Kopfzeile: Wappen · Name · Rang · Punkte · Δ · Läufer-Mini (rechts) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", overflow: "hidden", background: me.logoUrl ? "transparent" : `hsl(${hueForIdx(me.idx)} 60% 52%)`, display: "grid", placeItems: "center" }}>
            {me.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.logoUrl} alt="" width={22} height={22} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 22, height: 22, objectFit: "cover" }} />
            ) : null}
          </span>
          <span style={{ fontWeight: 800, color: "var(--nl-accent)" }}>★ {me.name} ({me.code})</span>
          <span style={{ fontWeight: 800, color: ampel(me.rank) }}>Rang {me.rank}</span>
          <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt1(myShown)} Pkt</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: me.rank === 1 ? "var(--nl-good)" : "var(--nl-mut)" }}>{deltaToLeader}</span>
          <div
            onClick={clickable ? () => onOpenPlayer!(runner!.playerId!) : undefined}
            onMouseEnter={onPreviewPlayer && runner?.playerId ? () => onPreviewPlayer!(runner.playerId) : undefined}
            onMouseLeave={onPreviewPlayer ? () => onPreviewPlayer!(null) : undefined}
            title={clickable ? "Spieler-Karte öffnen" : undefined}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, cursor: clickable ? "pointer" : "default" }}
          >
            <PlayerMark src={runner?.portraitUrl ?? null} alt={runner?.name ?? ""} size={26} isOwn medal={runnerMedal} injury={runnerInjured} starTier={getPlayerStarTier(runner?.ovrRank)} />
            <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: runnerInjured ? "var(--nl-risk)" : undefined }}>
              {runnerInjured ? "🤕" : "🏃"} {runner?.name ?? "—"}
            </span>
            {runnerInjured ? (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: 99,
                  color: "var(--nl-bg)",
                  background: "var(--nl-risk)",
                  whiteSpace: "nowrap",
                  flex: "none",
                }}
              >
                Verletzt
              </span>
            ) : null}
          </div>
        </div>
        {/* Split-Strip: ein Chip je Etappe — "R1 · Name +49 #3". Der Rang ist die Platzierung
            DES SPIELERS in dieser Etappe (slotRankOf), nicht der Teamrang; der Teamrang nach der
            Etappe steckt weiter im Punkt darunter. Wert + Rang erst nach dem Auftritt; der
            Name darf vorher stehen, es ist der eigene Kader (kein Spoiler). */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
          {Array.from({ length: slotCount }, (_, s) => {
            const thrown = me.thrownSlot >= 0 && s <= me.thrownSlot;
            const slotRank = thrown ? slotRankOf(s, me, rtRef.current) : null;
            const best = slotRank === 1;
            const histRank = me.rankHistory[s];
            const slotPlayer = me.players[s] ?? null;
            const slotLabel = shortSlotLabel(slots[s] ?? "E" + (s + 1), s);
            const valueLabel = thrown ? "+" + fmt1(playerNet(slotPlayer)) : "—";
            const title = [
              slots[s] ?? "Etappe " + (s + 1),
              slotPlayer?.name ?? null,
              thrown ? `${valueLabel} Punkte` : "noch nicht dran",
              slotRank != null ? `Etappen-Rang #${slotRank}` : null,
              histRank != null ? `Teamrang danach #${histRank}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={s} title={title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 32, maxWidth: 190, opacity: thrown ? 1 : 0.45 }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, maxWidth: "100%", padding: "2px 6px", borderRadius: 6, fontWeight: 800, whiteSpace: "nowrap", border: `1px solid ${best ? "var(--nl-warn)" : "var(--nl-line)"}`, color: best ? "var(--nl-warn)" : "inherit", background: best ? "color-mix(in srgb, var(--nl-warn) 14%, transparent)" : "transparent" }}>
                  <span style={{ flex: "none" }}>{best ? "🥇 " : ""}{slotLabel}</span>
                  {slotPlayer?.name ? (
                    <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: best ? undefined : "var(--nl-mut)" }}>
                      {slotPlayer.name}
                    </span>
                  ) : null}
                  <span style={{ flex: "none" }}>{valueLabel}</span>
                  {slotRank != null ? (
                    <span style={{ flex: "none", fontWeight: 800, color: best ? "var(--nl-warn)" : ampel(slotRank) }}>#{slotRank}</span>
                  ) : null}
                </span>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: histRank != null ? ampel(histRank) : "var(--nl-line)" }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- Gewichtheben · Kraft-Turm: abgeleitete Render-Werte (Rangfolge nach kg) ----
  const barbellSorted = prim === "barbell" ? barbellOrder() : sorted;
  const barbellRankMap: Record<string, number> = {};
  if (prim === "barbell") barbellSorted.forEach((t, i) => (barbellRankMap[t.code] = i + 1));
  const barbellLive = prim === "barbell" && barbellInfo ? rtRef.current.filter((t) => !barbellEliminated(t.code)).length : 0;
  // aktueller Versuch (Kader durchgeschaltet) — 0…slots-1, folgt der Runde.
  const barbellTry = Math.min(slotCount - 1, Math.max(0, done ? slotCount - 1 : round));
  const ladderList = prim === "barbell" ? barbellSorted : sorted;
  // Staffel-Ladder gleitet (wie im Mockup): Zeilen in STABILER Reihenfolge gerendert
  // (Key/DOM bleibt fix) und per transform:translateY(Rang) mit CSS-Transition an ihre
  // Platzierung geschoben → kontinuierliches Mitlaufen statt Reflow-Sprünge.
  const trackLadder = animField;
  /**
   * Zeilenhoehe der Ladder — abgeleitet aus der Hoehe der Arena-Hauptspalte, damit
   * die Tabelle rechts in JEDER Disziplin exakt so hoch ist wie die Arena links:
   * gleicher Anfang, gleiches Ende, alle Teams sichtbar, kein Innen-Scroll.
   *
   * Vorher war die Hoehe fix 25px. Damit endete die Liste je nach Disziplin
   * deutlich vor der Arena (kurze Liste, Loch darunter) oder lief darueber hinaus
   * und musste scrollen — beides sah aus wie ein Layoutfehler.
   *
   * Die Grenzen sind bewusst gesetzt: unter ~17px werden Teamkuerzel und Punkte
   * unlesbar, ueber ~34px zerfaellt die Liste optisch. Passt die Zeilenzahl auch
   * bei Minimalhoehe nicht, bleibt der Innen-Scroll als ehrlicher Notnagel.
   */
  // Die Rechnung selbst liegt in `lib/matchday-arena/arena-ladder-metrics.ts` — dort ist sie
  // ueber WERTE pruefbar (vitest faehrt ohne jsdom; ein Flex-Layout gibt es im Test nicht).
  const LADDER_PAD_Y = ARENA_LADDER_PAD_Y;
  const LADDER_ROW_H = useMemo(
    () => resolveArenaLadderRowHeight({ ladderMaxH, ladderHeadH, rowCount: N }),
    [ladderMaxH, ladderHeadH, N],
  );
  const ladderRows = trackLadder ? [...rtRef.current].sort((a, b) => a.seasonRank - b.seasonRank) : ladderList;

  // Basketball-Court: Treffer/Fehlwurf-Schwelle = Feld-Median der bereits geworfenen
  // Scores; Hot-Hand = deutlich über dem Median. Nur für prim === "court" berechnet.
  const courtThrown = prim === "court" ? rtRef.current.filter((t) => t.thrownSlot >= 0).map((t) => t.score).sort((a, b) => a - b) : [];
  const courtMedian = courtThrown.length ? courtThrown[Math.floor((courtThrown.length - 1) / 2)]! : 0;
  const courtMax = courtThrown.length ? courtThrown[courtThrown.length - 1]! : 0;
  const courtHotFloor = courtMedian + (courtMax - courtMedian) * 0.5;

  // TDM — Kill-Feed mit ECHTEN Spielernamen: je Team der Top-Fragger (bereits
  // aufgedeckter Spieler mit höchstem Netto-Beitrag), starke Teams fraggen
  // schwächere (Rang oben ⚔ Rang unten). Namen aus dem Kader, keine Fakes.
  const kdaTopFrag = (t: RT): NativeStagePlayer | null => {
    let top: NativeStagePlayer | null = null;
    for (let s = 0; s <= t.thrownSlot; s += 1) {
      const p = t.players[s];
      if (p && (!top || playerNet(p) > playerNet(top))) top = p;
    }
    return top;
  };
  const kdaFeed =
    prim === "kda"
      ? (() => {
          const live = sorted.filter((t) => t.thrownSlot >= 0);
          const out: { killer: string; victim: string }[] = [];
          for (let i = 0; i < Math.min(live.length, 6); i += 1) {
            const killer = live[i]!;
            const victim = live[live.length - 1 - i];
            if (!victim || victim.code === killer.code) continue;
            const kp = kdaTopFrag(killer);
            const vp = kdaTopFrag(victim);
            if (!kp || !vp) continue;
            out.push({ killer: kp.name, victim: vp.name });
          }
          return out;
        })()
      : [];

  // Top-Spieler-Zeile: NUR bereits aufgedeckte Spieler (kein Spoiler). Set aller
  // playerIds bis einschließlich thrownSlot je Team; die statische Host-Liste wird
  // darauf gefiltert (Reihenfolge bleibt, Ränge neu 1…k). Vor dem ersten Reveal leer.
  const revealedPlayerIds = new Set<string>();
  for (const t of rtRef.current) {
    for (let s = 0; s <= t.thrownSlot; s += 1) {
      const pid = t.players[s]?.playerId;
      if (pid) revealedPlayerIds.add(pid);
    }
  }
  // Verletzte unter den bereits aufgedeckten Spielern — Quelle sind dieselben Slots
  // wie oben, damit die Zeile keinen Reveal vorwegnimmt. Erkennung wie im Ticker
  // (`isInjuryMod`). Der Malus ist die Summe der Verletzungs-Mods, NICHT aller
  // negativen Mods — sonst stuende Fatigue und Intensitaet mit in der Zahl.
  const revealedInjuredPlayers: DisciplineStageInjuredPlayer[] = [];
  for (const t of rtRef.current) {
    for (let s = 0; s <= t.thrownSlot; s += 1) {
      const p = t.players[s];
      if (!p) continue;
      const injuryMods = p.mods.filter(isInjuryMod);
      if (injuryMods.length === 0) continue;
      revealedInjuredPlayers.push({
        playerId: p.playerId,
        name: p.name,
        teamCode: t.code,
        logoUrl: t.logoUrl,
        portraitUrl: p.portraitUrl,
        isOwn: t.isOwn,
        malus: round1(injuryMods.filter((m) => m.sign < 0).reduce((sum, m) => sum + m.amt, 0)),
        ovrRank: p.ovrRank ?? null,
      });
    }
  }
  // Eigenes Team zuerst, danach der groesste Abzug — die zwei Fragen, die man an
  // dieser Zeile stellt ("bin ich betroffen?" / "wen hat es hart erwischt?").
  revealedInjuredPlayers.sort(
    (left, right) => Number(right.isOwn) - Number(left.isOwn) || right.malus - left.malus || left.name.localeCompare(right.name, "de"),
  );

  const revealedTopPlayers = topPlayers
    ? (() => {
        const rows: DisciplineStageTopPlayer[] = [];
        const ids: (string | null)[] = [];
        topPlayers.rows.forEach((row, i) => {
          const id = topPlayers.ids[i];
          if (id && revealedPlayerIds.has(id)) {
            rows.push({ ...row, rank: rows.length + 1 });
            ids.push(id);
          }
        });
        return { rows, ids };
      })()
    : null;

  // ---- Feld-Delegation: Chrome bleibt im Host, die Feld-Darstellung kommt aus der
  // Disziplin-Registry (arena/disciplines/<primitive>.tsx). Der Host baut den vollen
  // DisciplineFieldProps-Kontext (Engine = Wahrheit) und rendert die Feld-Komponente
  // als Kinder des <svg>. ----
  const FieldComp = getDisciplineField(prim, disciplineId);
  const fieldCtx: DisciplineFieldProps = {
    primitive: prim,
    disciplineName,
    accent,
    skinAccent,
    motif,
    env,
    reducedMotion: reduced.current,
    paused, // Leertaste-Pause → rAF-Felder frieren ein
    // Staffelstab-Übergabe (FEATURE 1): aktiv im 600ms-Fenster nach einem Etappen-Glide-Start.
    handoffActive: !reduced.current && now < handoffTs + 600,
    // Highlight-Trio (die 3 Aufsteiger der Etappe) → Feld setzt einen Puls-Ring an ihre Token.
    highlightIdxs: highlightTrio,
    // Start-Gate → Felder zeigen vor dem ersten ▶ eine Startaufstellung.
    started,
    W,
    H,
    N,
    geo,
    layout,
    // Entstauch: Felder bekommen posMax (Live-Führender) als Normierungsbasis statt des
    // theoretischen Voll-Spiel-Max → Team-Feld fächert sich in jeder Runde über den Platz.
    finalMax: posMax,
    makeOval,
    ovalPath,
    OVAL_M,
    OVAL_BAND,
    pathRef,
    pathLen,
    tokenPos,
    rt: rtRef.current,
    sorted,
    barbellSorted,
    // Anzeige-Punkte (animScore solange eine Etappe rampt) — dieselbe Groesse, aus der
    // auch t.rank und die Rangliste abgeleitet werden. Felder, die Punkte ausgeben oder
    // nach Punkten gruppieren, MUESSEN sie benutzen, sonst laufen sie der Bewegung voraus.
    shownScore,
    round,
    slotCount,
    slots,
    done,
    now,
    fieldNorm,
    barbellInfo,
    barbellY,
    barbellKgOf,
    barbellEliminated,
    barbellRankMap,
    demandKg,
    courtMedian,
    courtMax,
    courtHotFloor,
    addPop,
    fireFlash,
    doShake,
    glow,
    openHover,
    scheduleHoverClose,
    hoverIdx: hover?.idx ?? null,
    onOpenTeam,
    onOpenPlayer,
    onHoverTeam,
  };

  return (
    /**
     * GEMELDET VON CHRIS: „climbing bitte gleiche höhe wie die tabelle rechts daneben -
     * das gilt für alle disziplinen das soll auf einer linie sein"
     *
     * Hier stand `alignItems: "stretch"` mit der Absicht, die Ladder auf die Hoehe der
     * Arena zu bringen. Genau das hat die Messung aber zirkulaer gemacht:
     *
     *   Ladder-Hoehe  ←  gemessene Hoehe der Hauptspalte
     *   Hauptspalte    ←  (stretch) Hoehe der Zeile
     *   Zeile          ←  die HOEHERE von beiden
     *
     * Beim ersten Bild ist `ladderMaxH` noch null, die Ladder also so hoch wie ihr
     * Inhalt (Kopf + N Zeilen a 25px Rueckfallwert, s. LADDER_ROW_H). Ist sie damit
     * hoeher als die Arena, zieht `stretch` die HAUPTSPALTE auf dieses Mass — und der
     * ResizeObserver misst anschliessend nicht mehr die Arena, sondern die aufgeblasene
     * Spalte. Der Zustand rastet ein: beide Kaesten sind gleich hoch, aber die Arena hat
     * unten tote Flaeche, weil ihr Inhalt dort laengst zu Ende ist. Sichtbar wird das
     * als „das Feld steht nicht auf einer Linie mit der Tabelle".
     *
     * `flex-start` bricht den Kreis: die Hauptspalte ist wieder so hoch wie ihr Inhalt,
     * und genau das misst der Observer. Die Ladder bekommt ihre Hoehe ohnehin explizit
     * ueber `height: ladderMaxH` — dafuer war `stretch` nie noetig, es hat nur die
     * Messgrundlage verdorben.
     */
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <style>{`
        @keyframes olyFlash{0%{opacity:0}18%{opacity:1}100%{opacity:0}}
        @keyframes olyShakeHard{0%,100%{transform:translate(0,0)}15%{transform:translate(-5px,3px)}30%{transform:translate(4px,-4px)}45%{transform:translate(-4px,2px)}60%{transform:translate(3px,-2px)}80%{transform:translate(-2px,1px)}}
        @keyframes olyShakeSoft{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,1px)}}
        @keyframes olyPop{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-150%) scale(1.3)}}
        @keyframes olyFrag{from{opacity:1;transform:translate(-50%,-50%)}to{opacity:0;transform:translate(-50%,-260%)}}
        @keyframes olySpot{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}10%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}88%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
        @keyframes olyPodRise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes olyGlowPulse{0%,100%{opacity:.35}50%{opacity:.9}}
        @keyframes olyBanner{0%{opacity:0;transform:translate(-50%,-14px) scale(.92)}12%{opacity:1;transform:translate(-50%,0) scale(1)}85%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-8px) scale(1)}}
        @keyframes olyHandoff{0%{opacity:0}22%{opacity:1}100%{opacity:0}}
        @keyframes olyScan{from{top:0}to{top:100%}}
        @keyframes olyCrownIn{0%{opacity:0;transform:translateY(26px) scale(.7)}12%{opacity:1;transform:translateY(-3px) scale(1.05)}18%{transform:translateY(0) scale(1)}88%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-8px) scale(.96)}}
        @keyframes olyCrownShine{0%{transform:translateX(-160%) skewX(-18deg)}100%{transform:translateX(320%) skewX(-18deg)}}
        @media (prefers-reduced-motion: reduce){.oly-anim{animation:none!important;opacity:1!important}}
      `}</style>

      {/* Hauptspalte: Controls · MyTracker · Oval · Ticker */}
      <div ref={mainColRef} style={{ flex: "1 1 620px", minWidth: 0, order: 1 }}>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          {/* Co-op-Status/Ready-Gate (nur im Multiplayer-Room). */}
          {roomSync?.active ? (
            <div data-testid="arena-coop-status" style={{ display: "flex", alignItems: "center", gap: 10, flexBasis: "100%", flexWrap: "wrap", padding: "6px 10px", borderRadius: 10, border: "1px solid var(--nl-line)", background: "var(--nl-bg)" }}>
              {roomSync.coopGate.active ? (
                <>
                  <button type="button" data-testid="arena-coop-ready" onClick={roomSync.coopGate.onToggleReady} style={{ padding: "8px 16px", fontWeight: 800, fontSize: 13, border: 0, borderRadius: 9, cursor: "pointer", color: "var(--nl-ink)", background: roomSync.coopGate.isSelfReady ? "var(--nl-line)" : "var(--nl-accent)" }}>
                    {roomSync.coopGate.isSelfReady ? "✔ Bereit" : "Bereit"}
                  </button>
                  <span style={{ fontSize: 12, color: "var(--nl-mut)" }}>
                    {roomSync.coopGate.waitingNames.length > 0 ? `Warte auf: ${roomSync.coopGate.waitingNames.join(", ")}` : "Alle bereit — Host kann starten."}
                  </span>
                </>
              ) : roomSync.followsHost ? (
                /* `followsHost`, nicht `waitingForHost`: letzteres kippt beim Host-Start auf false,
                   wodurch der Guest ab da in den Host-Zweig fiel und faelschlich "Du bist Host" las. */
                <span data-testid="arena-coop-follow" style={{ fontSize: 12, color: "var(--nl-mut)", fontWeight: 700 }}>
                  {roomSync.waitingForHost
                    ? "👥 Co-op · Warte auf den Host — er startet den Reveal."
                    : "👥 Co-op · Der Host steuert den Reveal — du siehst live mit."}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "var(--nl-accent)", fontWeight: 700 }}>👥 Co-op · Du bist Host — dein Reveal läuft synchron bei allen.</span>
              )}
              {/* Audit-Punkt 5, zweite Haelfte: ein Getrennter blockiert das Bereit-Tor nicht mehr
                  (siehe `getRoomArenaRequiredParticipantIds`), war bisher aber auch NIRGENDS
                  sichtbar — der Host sah nur, dass es plötzlich weiterging, ohne Grund. */}
              {roomSync.disconnectedNames && roomSync.disconnectedNames.length > 0 ? (
                <span
                  className="nl-arena-coop-note"
                  data-testid="arena-coop-disconnected"
                  style={{ flexBasis: "100%", color: "var(--nl-warn)" }}
                >
                  ⚠ Getrennt: {roomSync.disconnectedNames.join(", ")}
                  {roomSync.coopGate.canSkipDisconnected ? " — hält das Bereit-Tor auf." : "."}
                </span>
              ) : null}
              {/* Der Notausgang steht bewusst NEBEN dem Hinweis und nicht am ▶-Knopf: den ▶ drueckt
                  man nebenbei, diesen hier soll man bewusst waehlen. Er nennt die Namen, damit dem
                  Host klar ist, wen er gerade uebergeht. */}
              {roomSync.coopGate.canSkipDisconnected && roomSync.coopGate.onSkipDisconnected ? (
                <button
                  type="button"
                  className="nl-arena-coop-skip"
                  data-testid="arena-coop-skip-disconnected"
                  onClick={roomSync.coopGate.onSkipDisconnected}
                  style={{ flexBasis: "100%", fontSize: 12, fontWeight: 700 }}
                >
                  {(roomSync.coopGate.disconnectedBlockerNames ?? roomSync.disconnectedNames ?? []).join(", ")} ist
                  offline und nicht bereit — trotzdem fortfahren
                </button>
              ) : null}
            </div>
          ) : null}
          {(() => {
            // Audit-Punkt 3: der ▶-Knopf war zwar `disabled`, sah beim Gast aber weiter voll
            // klickbar aus (Akzentfarbe + Zeigefinger-Cursor) — die Nachbarknöpfe (Quick-Sim,
            // Reset) machten das schon richtig. Zusätzlich: Beschriftung sagt jetzt selbst, WARUM
            // er nicht reagiert, statt einfach nichts zu tun.
            const roomBlocksControl = Boolean(roomSync?.active && !roomSync.canControl);
            const primaryDisabled = done || busy || roomBlocksControl || Boolean(roomSync?.coopGate.active);
            return (
              <button
                type="button"
                data-testid="arena-primary-step"
                onClick={() => { setStarted(true); advance(); }}
                disabled={primaryDisabled}
                style={{
                  padding: "9px 18px",
                  fontWeight: 800,
                  fontSize: 13,
                  border: 0,
                  borderRadius: 10,
                  cursor: done || busy ? "default" : roomBlocksControl ? "default" : "pointer",
                  color: "var(--nl-ink)",
                  background: done ? "var(--nl-line)" : "var(--nl-accent)",
                  opacity: busy && !done ? 0.7 : roomBlocksControl ? 0.5 : 1,
                }}
              >
                {done
                  ? "✔ Disziplin gewertet"
                  : roomBlocksControl
                    ? "▶ Der Host steuert"
                    : !started
                      ? /* B2: „Start" war eine Einladung zu etwas, das schon gelaufen ist. Der
                           Zweig steht NACH `roomBlocksControl`, weil „wer darf" die dringendere
                           Auskunft ist als „was passiert dann". */
                        alreadyScored
                        ? `▶ Nachspielen · Etappe 1 / ${slotCount}`
                        : `▶ Start · Etappe 1 / ${slotCount}`
                      : `▶ Etappe ${round + 1} / ${slotCount} — ${slots[round] ?? ""}`}
              </button>
            );
          })()}
          <button type="button" onClick={quickSim} disabled={Boolean(roomSync?.active && !roomSync.canControl)} style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: roomSync?.active && !roomSync.canControl ? "default" : "pointer", opacity: roomSync?.active && !roomSync.canControl ? 0.5 : 1 }}>
            ⏩ Quick-Sim
          </button>
          {/* B2: Die Buehne wusste laengst, dass die Seite gewertet ist (`activeSideScoredInSave`)
              — gesagt hat sie es nicht. Ein Durchlauf bleibt folgenlos, weil
              `commitFinishedDiscipline` eine gebuchte Seite nicht erneut bucht; ohne diesen Satz
              muss der Spieler selbst darauf kommen, warum sich nichts geaendert hat. */}
          {alreadyScored && !done ? (
            <span
              data-testid="arena-already-scored-hint"
              style={{ fontSize: 12, color: "var(--nl-mut)", fontWeight: 700 }}
            >
              Bereits gewertet — ein Durchlauf ändert die Wertung nicht.
            </span>
          ) : null}
          <button type="button" data-testid="arena-reset" onClick={() => reset("knopf")} disabled={Boolean(roomSync?.active && !roomSync.canControl)} style={{ padding: "9px 14px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: roomSync?.active && !roomSync.canControl ? "default" : "pointer", opacity: roomSync?.active && !roomSync.canControl ? 0.5 : 1 }}>
            ↻ Neu
          </button>
          <button type="button" onClick={audio.toggleMute} title="Sound an/aus" style={{ padding: "9px 12px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}>
            {audio.muted ? "🔇 Stumm" : "🔊 Sound"}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audio.volume}
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            title="Lautstärke"
            aria-label="Lautstärke"
            style={{ width: 90, accentColor: "var(--nl-accent)", cursor: "pointer" }}
          />
          {/* Audit-Punkt 6: der Chip behauptete dem Gast "· Leertaste", obwohl seine Leertaste
              nichts bewirkt — er spiegelt immer nur `roomSync.hostPaused` (siehe Effekt oben, der
              JEDEN lokalen Tastendruck des Gasts sofort wieder ueberschreibt). */}
          {paused ? (
            <span style={{ padding: "4px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12, background: "var(--nl-warn)", color: "var(--nl-ink)" }}>
              {roomSync?.followsHost ? "⏸ Host hat pausiert" : "⏸ Pausiert · Leertaste"}
            </span>
          ) : null}
          {/* Feld-Legende nur noch als dezentes ⓘ-Hover (früher permanente „Manual"-Zeile je
              Disziplin) — die Felder labeln sich inzwischen selbst (START/ZIEL/Netz/Elo…). */}
          <span
            aria-label="Feld-Legende"
            title={
              progressLabel ??
              (prim === "kda"
                ? "K/D/A aus der Feld-Wertung abgeleitet · KDA = (K+A)/D"
                : prim === "duelhp"
                ? "Arena-Schlacht — Schaden aus kumulierten Punkten, Rang = Score"
                : prim === "bump"
                ? "Linien = Rang nach jeder Etappe (oben = Spitze)"
                : prim === "klassen"
                ? "Liga-Klassen nach Punkt-Lücken (Meister → Keller)"
                : prim === "territory"
                ? "Fläche = eroberter Gebietsanteil (Score als % des Feldes)"
                : prim === "stage"
                ? "Aufstieg zur Ruhm-Treppe = kumulierte Punkte"
                : prim === "mountain"
                  ? "Höhe am Berg = kumulierte Punkte"
                  : prim === "court"
                    ? "Nähe zum Korb = kumulierte Punkte"
                    : prim === "rink"
                      ? "Vorstoß in die Angriffszone = kumulierte Punkte"
                      : prim === "peloton" || prim === "parcours"
                        ? "Position auf der Strecke = kumulierte Punkte"
                        : prim === "barbell"
                          ? "Geforderte Last steigt — wer reißt, fällt auf sein Endgewicht (= Score)"
                        : TOWER_FAMILY.has(prim)
                          ? "Höhe = kumulierte Punkte"
                          : ROW_FAMILY.has(prim)
                            ? "Fortschritt = kumulierte Punkte"
                            : "Position auf dem Oval = kumulierte Punkte")
            }
            style={{ fontSize: 13, color: "var(--nl-mut)", cursor: "help", opacity: 0.7 }}
          >
            ⓘ
          </span>
        </div>

        {/* Gewichtheben · Kopf-Strip 50/50: links Dein-Heber-Karte, rechts Live-Meldung.
            Auf dem Feld selbst liegt nichts (freies Spielfeld). Ersetzt für barbell den
            generischen MyTracker (die Dein-Heber-Karte IST der MyTracker). */}
        {prim === "barbell" ? (
          <ArenaKopfStrip
            left={
              me
                ? (() => {
                    const lifter = me.players[barbellTry] ?? null;
                    const out = barbellEliminated(me.code);
                    const myRank = barbellRankMap[me.code] ?? me.rank;
                    const clickable = Boolean(onOpenPlayer && lifter?.playerId);
                    return (
                      <div
                        onClick={clickable ? () => onOpenPlayer!(lifter!.playerId!) : undefined}
                        onMouseEnter={onPreviewPlayer && lifter?.playerId ? () => onPreviewPlayer!(lifter.playerId) : undefined}
                        onMouseLeave={onPreviewPlayer ? () => onPreviewPlayer!(null) : undefined}
                        title={clickable ? "Spieler-Karte öffnen" : undefined}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 8px 8px", borderRadius: 12, border: "1px solid var(--nl-accent)", background: "color-mix(in srgb, var(--nl-bg) 84%, var(--nl-accent))", cursor: clickable ? "pointer" : "default" }}
                      >
                        <PlayerMark src={lifter?.portraitUrl ?? null} alt={lifter?.name ?? ""} size={46} isOwn medal={null} starTier={getPlayerStarTier(lifter?.ovrRank)} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: "var(--nl-accent)" }}>🏋 Dein Heber · {me.code}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lifter?.name ?? "—"}</div>
                          <div style={{ fontSize: 11.5, color: "var(--nl-mut)", fontVariantNumeric: "tabular-nums" }}>
                            Versuch {barbellTry + 1} / {slotCount} · Platz {myRank}
                            {" · "}
                            {out ? (
                              <span style={{ color: "var(--nl-risk)", fontWeight: 800 }}>🔴 raus · {Math.round(barbellKgOf(me.code))} kg</span>
                            ) : (
                              <span style={{ color: "var(--nl-good)", fontWeight: 800 }}>hebt {Math.round(barbellKgOf(me.code))} kg</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                : <div />
            }
            right={
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 15px",
                  borderRadius: 11,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  border: `1px solid ${barbellMsg?.kind === "red" ? "var(--nl-risk)" : barbellMsg?.kind === "end" ? "var(--nl-warn)" : "var(--nl-line-2)"}`,
                  color: barbellMsg?.kind === "red" ? "var(--nl-risk)" : barbellMsg ? "var(--nl-warn)" : "var(--nl-mut)",
                  background: barbellMsg?.kind === "end" ? "color-mix(in srgb, var(--nl-warn) 12%, transparent)" : "color-mix(in srgb, var(--nl-panel) 60%, transparent)",
                }}
              >
                {barbellMsg?.text ?? "⚔ Der Wettkampf beginnt — die geforderte Last steigt Runde für Runde."}
              </div>
            }
          />
        ) : null}

        {/* „Dein Team"-Karte: EINE konsolidierte Karte (Live-Rang · Δ zur Vorrunde · Punkte ·
            aktueller Spieler mit Profil-Klick) für JEDE Disziplin — animField deckt alle außer
            Gewichtheben ab, das oben seine eigene „Dein Heber"-Karte hat. (Der frühere schlanke
            MyTracker-Fallback war toter Code: animField ≡ prim !== "barbell".) */}
        {me && animField ? renderMyTeamCard() : null}

        {/* Spotlight-Banner — bei Verletzung erzwingt der Risk-Ton Rahmen/Kicker/Score,
            unabhängig von mine/warn, damit der verletzte Spieler nie als normaler
            Highlight-Moment durchgeht. */}
        {spotlight ? (
          <div
            className="oly-anim"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              marginBottom: 10,
              borderRadius: 12,
              border: `1.5px solid ${spotlight.injury ? "var(--nl-risk)" : spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)"}`,
              background: `color-mix(in srgb, ${spotlight.injury ? "var(--nl-risk)" : spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)"} 12%, transparent)`,
            }}
          >
            <PlayerMark src={spotlight.portraitUrl} alt={spotlight.name} size={38} spotlight={!spotlight.mine} isOwn={spotlight.mine} injury={spotlight.injury} starTier={getPlayerStarTier(spotlight.ovrRank)} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: spotlight.injury ? "var(--nl-risk)" : spotlight.mine ? "var(--nl-accent)" : "var(--nl-warn)" }}>
                {spotlight.injury ? "🤕 " : ""}
                {spotlight.kick}
              </div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{spotlight.name}</div>
              <div style={{ fontSize: 12, color: "var(--nl-mut)" }}>{spotlight.sub}</div>
            </div>
            {spotlight.chipText ? (
              <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-bg)", background: spotlight.injury ? "var(--nl-risk)" : `rgb(${FLASH_COLOR[spotlight.chipColor] ?? FLASH_COLOR.gold})` }}>{spotlight.chipText}</span>
            ) : null}
            <div style={{ fontWeight: 800, fontSize: 30, color: spotlight.injury ? "var(--nl-risk)" : "var(--nl-warn)", flex: "none" }}>+{fmt1(spotlight.net)}</div>
          </div>
        ) : null}

        {/* Jumbotron (nur Court/Basketball): Führender + dein Team + Etappen-Uhr */}
        {prim === "court" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", marginBottom: 10, borderRadius: 12, border: "1px solid var(--nl-line)", background: "linear-gradient(90deg, color-mix(in srgb, var(--nl-panel) 88%, transparent), var(--nl-panel))", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.02em" }}>🏀 {disciplineName ?? "Basketball"}</span>
            {round > 0 && leader ? (
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-warn)", border: "1px solid var(--nl-warn)" }}>
                🏆 Führt: {leader.code} · {fmt1(leader.score)}
              </span>
            ) : null}
            {me ? (
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-accent)", border: "1px solid var(--nl-accent)" }}>
                Dein Team: {me.code} · Platz {me.rank}
              </span>
            ) : null}
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12.5, fontWeight: 700, color: "var(--nl-warn)", background: "var(--nl-bg)", border: "1px solid var(--nl-line)", borderRadius: 7, padding: "3px 10px" }}>
              ⏱ Etappe {Math.min(round, slotCount)}/{slotCount}
            </span>
          </div>
        ) : null}

        {/* Jumbotron (nur TDM): ACE-Banner + dein Team + Kill-Feed-Ticker (echte Namen) */}
        {prim === "kda" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 10, borderRadius: 12, border: "1px solid color-mix(in srgb, var(--nl-accent) 40%, var(--nl-line))", background: "linear-gradient(90deg, color-mix(in srgb, var(--nl-accent) 12%, var(--nl-panel)), var(--nl-panel))", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.03em" }}>🎯 {disciplineName ?? "TDM"}</span>
            {round > 0 && leader ? (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 6, color: "var(--nl-bg)", background: "var(--nl-accent)", letterSpacing: "0.06em" }}>
                ⚡ ACE: {leader.code}
              </span>
            ) : null}
            {me ? (
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, color: "var(--nl-mine)", border: "1px solid var(--nl-mine)" }}>
                Dein Team: {me.code} · Platz {me.rank}
              </span>
            ) : null}
            {kdaFeed.length ? (
              <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--nl-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
                <span style={{ color: "var(--nl-accent)", fontWeight: 800 }}>LIVE </span>
                {kdaFeed.slice(0, 3).map((f, i) => (
                  <span key={i}>
                    {i ? "   ·   " : ""}
                    <b style={{ color: "var(--nl-ink)" }}>{f.killer}</b> ⚔ {f.victim}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Oval-Track + Overlays */}
        <div className={shake !== "none" ? "oly-anim" : undefined} style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--nl-line)", background: "var(--nl-bg)", animation: shake === "hard" ? "olyShakeHard .44s ease" : shake === "soft" ? "olyShakeSoft .3s ease" : undefined }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "auto", maxHeight: "calc(100vh - 220px)", display: "block", margin: "0 auto", transform: photoFinish ? "scale(1.6)" : zoom ? `scale(${zoom.scale})` : undefined, transformOrigin: photoFinish ? "26% 11%" : zoom ? `${zoom.ox}% ${zoom.oy}%` : "26% 11%", transition: reduced.current ? undefined : "transform .6s cubic-bezier(.3,0,.2,1)" }}>
            <FieldComp {...fieldCtx} />
          </svg>

          {/* Score-Pops (Nr. 207): die großen hochzählenden +N-Zahlen irritieren und bügeln
              über das Feld — entfernt. Der Wert steht live in der Rangliste, den Zugewinn
              zeigt der Ghost der Vorrunde direkt am Token. Highlights kommen als
              Zoom-Slowdown (Nr. 208), nicht als Popup. */}
          {/* Splitter (Boni/Mali „−8 Form" etc.) (Nr. 207): entfernt — poppten überall auf und
              störten. Form/Details stehen im Ticker / in der Hovercard, nicht als Feld-Pop. */}
          {/* Flash */}
          {flash ? (
            <div key={flash.id} style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(circle at 50% 46%, rgba(${FLASH_COLOR[flash.color] ?? FLASH_COLOR.gold},.5), transparent 62%)`, animation: reduced.current ? "none" : "olyFlash .5s ease" }} />
          ) : null}

          {/* Fotofinish-Overlay (FEATURE 2, nur track, enges Rennen): abdunkelnde/entsättigende
              Vignette lässt den Zieleinlauf (oben links, 26%/11%) hell, plus eine Scan-Linie,
              die von oben nach unten wandert. Nur während photoFinish. overflow:hidden des
              Shake-Containers beschneidet das gezoomte SVG. */}
          {photoFinish ? (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 26% 11%, transparent 0%, transparent 18%, color-mix(in srgb, var(--nl-bg) 60%, transparent) 46%, color-mix(in srgb, var(--nl-bg) 88%, transparent) 100%)" }} />
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "var(--nl-warn)", boxShadow: "0 0 10px var(--nl-warn)", animation: "olyScan 1.1s linear" }} />
            </div>
          ) : null}

          {/* ETAPPEN-KÜR (Owner-Wunsch): während des Highlight-Zooms werden nicht nur die
              Team-Token markiert, sondern die Top 3 der Etappe als SPIELERKARTEN gekürt —
              Portrait + Team-Logo + Netto, gerahmt in Gold/Silber/Bronze, Podest-Anordnung
              (Silber · Gold erhöht · Bronze), gestaffelter Einflug, Glanz-Sweep auf Gold.
              pointerEvents:none → Token-Hover/Klick unterm Overlay bleiben bedienbar. */}
          {stageCrown ? (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, padding: "0 12px 16px" }}>
              <div className="oly-anim" style={{ position: "absolute", top: 10, left: 0, right: 0, display: "flex", justifyContent: "center", animation: reduced.current ? "none" : `olyCrownIn ${STAGE_CROWN_MS}ms cubic-bezier(.22,.9,.32,1) both` }}>
                <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 900, color: "var(--nl-gold)", background: "color-mix(in srgb, var(--nl-bg) 82%, var(--nl-gold))", border: "1px solid var(--nl-gold)", borderRadius: 999, padding: "5px 14px", boxShadow: "0 8px 24px -10px rgba(0,0,0,.8)" }}>
                  ⭐ Kür der Etappe {stageCrown.stage}
                  {stageCrown.label ? ` · ${stageCrown.label}` : ""}
                </span>
              </div>
              {[2, 1, 3]
                .map((m) => stageCrown.list.find((c) => c.medal === m))
                .filter((c): c is StageCrownEntry => Boolean(c))
                .map((c, orderIdx) => {
                  const gold = c.medal === 1;
                  const tone = markMedalColor(numericMedalOf(c.medal)) ?? "var(--nl-gold)";
                  return (
                    <div
                      key={c.medal}
                      className="oly-anim"
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        width: gold ? 188 : 160,
                        marginBottom: gold ? 24 : 0,
                        padding: "9px 12px 11px",
                        borderRadius: 14,
                        border: `2px solid ${tone}`,
                        background: `linear-gradient(180deg, color-mix(in srgb, ${tone} 22%, var(--nl-panel)) 0%, var(--nl-panel) 64%)`,
                        boxShadow: `0 16px 36px -14px rgba(0,0,0,.85), 0 0 ${gold ? 26 : 16}px color-mix(in srgb, ${tone} ${gold ? 45 : 28}%, transparent)`,
                        textAlign: "center",
                        animation: reduced.current ? "none" : `olyCrownIn ${STAGE_CROWN_MS}ms cubic-bezier(.22,.9,.32,1) both`,
                        // Gold zuletzt (Steigerung): Silber → Bronze → Gold.
                        animationDelay: `${gold ? 260 : orderIdx * 110}ms`,
                      }}
                    >
                      {/* Glanz-Sweep — nur auf der Gold-Karte, einmalig. */}
                      {gold && !reduced.current ? (
                        <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "38%", background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--nl-gold) 35%, transparent), transparent)", animation: "olyCrownShine 1.4s ease-out .55s both" }} />
                      ) : null}
                      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 900, color: tone, marginBottom: 6 }}>
                        {KLASSEN_MEDALS[c.medal - 1]} {c.medal === 1 ? "Etappen-Gold" : c.medal === 2 ? "Etappen-Silber" : "Etappen-Bronze"}
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <PlayerMark src={c.portraitUrl} alt={c.name} size={gold ? 62 : 52} isOwn={c.isOwn} medal={numericMedalOf(c.medal)} injury={c.injured} starTier={getPlayerStarTier(c.ovrRank)} />
                      </div>
                      <div style={{ marginTop: 7, fontWeight: 800, fontSize: gold ? 14.5 : 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: c.isOwn ? "var(--nl-accent)" : "var(--nl-ink)" }}>
                        {c.isOwn ? "★ " : ""}
                        {c.name}
                      </div>
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "var(--nl-mut)", fontWeight: 700, minWidth: 0 }}>
                        <TeamMark src={c.logoUrl} alt={c.teamName} size={17} radius={5} isOwn={c.isOwn} placeholderColor={teamPrimaryColor(c.teamCode)} placeholderLabel={c.teamCode} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.teamCode} · {c.teamName}</span>
                      </div>
                      <div style={{ marginTop: 5, fontWeight: 900, fontSize: gold ? 24 : 19, lineHeight: 1, color: tone, fontVariantNumeric: "tabular-nums" }}>
                        {c.net < 0 ? fmt1(c.net) : `+${fmt1(c.net)}`}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : null}

          {/* Team-Hovercard — via Portal (document.body) + position:fixed, damit sie den
              overflow:hidden-/Shake-transform-Feldcontainer VERLÄSST und nie mehr am
              Feldrand abgeschnitten wird bzw. hinter der Rangliste verschwindet. Anker =
              echte Viewport-Mitte des Tokens (getBoundingClientRect). */}
          {hover && !podium
            ? (() => {
                const t = rtRef.current[hover.idx];
                if (!t) return null;
                // Anker bevorzugt aus der ECHT gerenderten Token-DOM-Lage (Felder platzieren
                // Token selbst — Oval, Streuung …); Fallback host.tokenPos → in Viewport-Px
                // über die SVG-Bounding-Box. Ohne beides: nicht rendern (sehr selten).
                const svgEl = svgRef.current;
                const tokEl = svgEl?.querySelector(`[data-token-code="${t.code}"]`) as SVGGraphicsElement | null;
                const svgRect = svgEl?.getBoundingClientRect();
                const tokRect = tokEl?.getBoundingClientRect();
                let anchorX: number;
                let anchorY: number;
                if (tokRect && (tokRect.width > 0 || tokRect.height > 0)) {
                  anchorX = tokRect.left + tokRect.width / 2;
                  anchorY = tokRect.top + tokRect.height / 2;
                } else if (svgRect && svgRect.width > 0 && svgRect.height > 0) {
                  const pos = tokenPos(t, animField ? t.displayScore : t.score);
                  anchorX = svgRect.left + (pos.x / W) * svgRect.width;
                  anchorY = svgRect.top + (pos.y / H) * svgRect.height;
                } else {
                  return null;
                }
                const teamClickable = Boolean(onOpenTeam && t.teamId);
                return (
                  <HoverTeamCardPortal
                    anchorX={anchorX}
                    anchorY={anchorY}
                    accent={floorTeamAccent(teamPrimaryColor(t.code))}
                    clickable={teamClickable}
                    onEnter={() => { cancelHoverClose(); pauseCascade(); }}
                    onLeave={scheduleHoverClose}
                    onClick={teamClickable ? () => onOpenTeam!(t.teamId!) : undefined}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {t.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logoUrl} alt="" width={26} height={26} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", background: `hsl(${hueForIdx(t.idx)} 60% 52%)`, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{t.code.slice(0, 3)}</span>
                      )}
                      <span style={{ fontWeight: 800 }}>{t.code}</span>
                      <span style={{ fontSize: 12, color: "var(--nl-mut)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                      {/* Rang EXAKT wie in der Rangliste rechts UND auf dem Feld: barbell →
                          Eliminations-Rang, sonst t.rank (= der oben aus animScore abgeleitete
                          Anzeige-Rang, EINE gemeinsame Quelle für alle drei Ansichten). */}
                      {(() => {
                        const cardRank = prim === "barbell" ? barbellRankMap[t.code] ?? t.rank : t.rank;
                        return <span style={{ fontWeight: 800, color: ampel(cardRank) }}>#{cardRank}</span>;
                      })()}
                    </div>
                    {/* Gewichtheben · Steckbrief: aktuelles kg, Status (im Wettkampf /
                        gerissen bei X kg), aktueller Heber. Anti-Spoiler — die wahre Kraft
                        Verbliebener bleibt verborgen, bis die Latte sie testet. */}
                    {prim === "barbell" && barbellInfo
                      ? (() => {
                          const out = barbellEliminated(t.code);
                          const kg = Math.round(barbellKgOf(t.code));
                          const lifter = t.players[barbellTry] ?? null;
                          return (
                            <div style={{ margin: "0 0 7px", padding: "6px 9px", borderRadius: 9, background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ color: "var(--nl-warn)" }}>{kg} kg</span>
                                <span style={{ color: "var(--nl-mut)" }}> · </span>
                                {out ? <span style={{ color: "var(--nl-risk)" }}>🔴 gerissen</span> : <span style={{ color: "var(--nl-good)" }}>hebt · an der Latte</span>}
                              </div>
                              {lifter ? (
                                <div style={{ fontSize: 11.5, color: "var(--nl-mut)", marginTop: 2 }}>
                                  🏋 Heber: <b style={{ color: "var(--nl-ink)" }}>{lifter.name}</b> · Versuch {barbellTry + 1}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
                    {/* TDM: abgeleiteter K/D/A-Steckbrief (K·D·A·KDA·HS%·PTS) + echter
                        Top-Fragger aus dem Kader. Score bleibt Wahrheit/Rang, Zahlen Flavor. */}
                    {prim === "kda" && t.thrownSlot >= 0
                      ? (() => {
                          const n = fieldNorm(t.score);
                          const kc = 6 + n * 26;
                          const ac = 4 + n * 16;
                          const k = Math.round(kc);
                          const d = Math.round(4 + (1 - n) * 16);
                          const a = Math.round(ac);
                          // Formatfix (Durchklick): fmt1 (Hauskomma) statt toFixed-Punkt.
                          const kda = fmt1((k + a) / Math.max(1, d));
                          const hs = Math.round(28 + n * 42);
                          const pts = fmt1(kc + ac * 0.5);
                          const top = kdaTopFrag(t);
                          return (
                            <div style={{ margin: "0 0 7px", padding: "6px 9px", borderRadius: 9, background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }}>
                              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 3 }}>
                                K/D/A · abgeleitet{t.rank === 1 ? " · 👑 MVP" : ""}
                              </div>
                              <div style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                                <span style={{ color: "hsl(140 62% 56%)" }}>K {k}</span>
                                <span style={{ color: "var(--nl-mut)" }}> · </span>
                                <span style={{ color: "hsl(2 78% 62%)" }}>D {d}</span>
                                <span style={{ color: "var(--nl-mut)" }}> · </span>
                                <span style={{ color: "hsl(210 82% 64%)" }}>A {a}</span>
                              </div>
                              <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", marginTop: 1 }}>
                                KDA {kda}<span style={{ color: "var(--nl-mut)" }}> · </span>HS {hs}%<span style={{ color: "var(--nl-mut)" }}> · </span>
                                <b style={{ color: "var(--nl-accent)" }}>PTS {pts}</b>
                              </div>
                              {top ? (
                                <div style={{ fontSize: 11.5, color: "var(--nl-mut)", marginTop: 2 }}>
                                  Top-Fragger: <b style={{ color: "var(--nl-ink)" }}>{top.name}</b> · {fmt1(playerNet(top))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
                    {(() => {
                      // Schon ab der LAUFENDEN Etappe (auch Etappe 1 / round 0) den
                      // GERADE antretenden Spieler (nextSlot == laufende Etappe, in
                      // dieser Etappe noch nicht enthüllt) zeigen — sein Token gleitet
                      // ja bereits sichtbar über die Bahn, „noch nicht angetreten" wäre
                      // dort schlicht falsch. Nur Identität (Porträt/Name), NICHT die
                      // Wertung (Anti-Spoiler bleibt für Score/Rang).
                      const nextSlot = t.thrownSlot + 1;
                      const upcoming =
                        round >= 0 && !podium && nextSlot < slotCount && nextSlot <= round
                          ? t.players[nextSlot] ?? null
                          : null;
                      if (t.thrownSlot < 0 && !upcoming) {
                        return <div style={{ fontSize: 12, color: "var(--nl-mut)", fontStyle: "italic" }}>noch nicht angetreten</div>;
                      }
                      return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {Array.from({ length: Math.max(0, t.thrownSlot + 1) }, (_, s) => {
                          const p = t.players[s];
                          if (!p) return null;
                          // Reihenfolge in der Disziplin = Slot s (1-basiert); erzielter
                          // Rang dieses Spielers in seinem Slot (1…N, ligaweit).
                          const sr = slotRankOf(s, t, rtRef.current);
                          const medalC = sr === 1 ? "var(--nl-gold)" : sr === 2 ? "var(--nl-silver)" : sr === 3 ? "var(--nl-bronze)" : "var(--nl-mut-2)";
                          const teamAccent = floorTeamAccent(teamPrimaryColor(t.code));
                          // Grafische Mini-Spielerkarte: Porträtbild links (Fallback: Initialen
                          // auf Team-Farbe), rechts Name/Slot + Breakdown. „locker Platz für
                          // die Player Cards als Bilder" — konsistent zum Feld-Token.
                          const initials = p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                          // Spieler-Zeile klickbar → Spieler-Karte (alle Disziplinen). stopPropagation,
                          // damit der Klick NICHT zusätzlich die Team-Karte öffnet. Die Reveal-Cascade
                          // ist beim Hover ohnehin pausiert (onEnter der Hovercard) → genug Zeit zum Klick.
                          const playerClickable = Boolean(onOpenPlayer && p.playerId);
                          return (
                            <div
                              key={s}
                              onClick={playerClickable ? (e) => { e.stopPropagation(); onOpenPlayer!(p.playerId!); } : undefined}
                              title={playerClickable ? "Spieler-Karte öffnen" : undefined}
                              style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: 6, borderRadius: 9, background: "var(--nl-bg)", border: "1px solid var(--nl-line)", cursor: playerClickable ? "pointer" : "default" }}
                            >
                              <div style={{ position: "relative", flex: "none" }}>
                                {p.portraitUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.portraitUrl}
                                    alt=""
                                    width={48}
                                    height={62}
                                    onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; const sib = el.nextElementSibling as HTMLElement | null; if (sib) sib.style.display = "grid"; }}
                                    style={{ width: 48, height: 62, borderRadius: 7, objectFit: "cover", objectPosition: "center top", display: "block", border: `1.5px solid ${teamAccent}` }}
                                  />
                                ) : null}
                                <span
                                  aria-hidden
                                  style={{ width: 48, height: 62, borderRadius: 7, border: `1.5px solid ${teamAccent}`, display: p.portraitUrl ? "none" : "grid", placeItems: "center", fontSize: 15, fontWeight: 800, color: "var(--nl-ink)", background: `color-mix(in srgb, ${teamPrimaryColor(t.code)} 34%, var(--nl-panel))` }}
                                >
                                  {initials}
                                </span>
                                <span aria-hidden style={{ position: "absolute", left: -4, top: -4, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "var(--nl-mut-2)", fontVariantNumeric: "tabular-nums" }}>{s + 1}</span>
                              </div>
                              <div style={{ minWidth: 0, flex: 1, fontVariantNumeric: "tabular-nums" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                  <span style={{ minWidth: 0, flex: 1, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {p.val >= STAR_MIN ? "⭐ " : ""}
                                    {p.name} <span style={{ color: "var(--nl-mut)", fontWeight: 600 }}>· {slots[s]}</span>
                                  </span>
                                  <span title={`Rang in ${slots[s]}`} style={{ flex: "none", fontSize: 10.5, fontWeight: 800, color: medalC }}>#{sr}</span>
                                </div>
                                <div style={{ marginTop: 2 }}>{renderBreakdown(p)}</div>
                              </div>
                            </div>
                          );
                        })}
                        {upcoming ? (() => {
                          const teamAccent = floorTeamAccent(teamPrimaryColor(t.code));
                          const initials = upcoming.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                          const upClickable = Boolean(onOpenPlayer && upcoming.playerId);
                          return (
                            <div
                              key="upcoming"
                              onClick={upClickable ? (e) => { e.stopPropagation(); onOpenPlayer!(upcoming.playerId!); } : undefined}
                              title={upClickable ? "Spieler-Karte öffnen" : undefined}
                              style={{ display: "flex", gap: 9, alignItems: "center", padding: 6, borderRadius: 9, background: "color-mix(in srgb, var(--nl-accent) 8%, var(--nl-bg))", border: "1px dashed var(--nl-accent)", cursor: upClickable ? "pointer" : "default" }}
                            >
                              <div style={{ position: "relative", flex: "none" }}>
                                {upcoming.portraitUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={upcoming.portraitUrl} alt="" width={48} height={62} onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; const sib = el.nextElementSibling as HTMLElement | null; if (sib) sib.style.display = "grid"; }} style={{ width: 48, height: 62, borderRadius: 7, objectFit: "cover", objectPosition: "center top", display: "block", border: `1.5px solid ${teamAccent}` }} />
                                ) : null}
                                <span aria-hidden style={{ width: 48, height: 62, borderRadius: 7, border: `1.5px solid ${teamAccent}`, display: upcoming.portraitUrl ? "none" : "grid", placeItems: "center", fontSize: 15, fontWeight: 800, color: "var(--nl-ink)", background: `color-mix(in srgb, ${teamPrimaryColor(t.code)} 34%, var(--nl-panel))` }}>{initials}</span>
                                <span aria-hidden style={{ position: "absolute", left: -4, top: -4, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "var(--nl-mut-2)", fontVariantNumeric: "tabular-nums" }}>{nextSlot + 1}</span>
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {upcoming.name} <span style={{ color: "var(--nl-mut)", fontWeight: 600 }}>· {slots[nextSlot]}</span>
                                </div>
                                <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 800, color: "var(--nl-accent)", letterSpacing: "0.04em" }}>tritt gerade an …</div>
                              </div>
                            </div>
                          );
                        })() : null}
                      </div>
                      );
                    })()}
                    {teamClickable ? (
                      <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--nl-mut)", fontWeight: 700 }}>Klicken für Team-Karte</div>
                    ) : null}
                  </HoverTeamCardPortal>
                );
              })()
            : null}

          {/* Podest */}
          {podium ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 24, background: "color-mix(in srgb, var(--nl-bg) 72%, transparent)", backdropFilter: "blur(3px)", zIndex: 5 }}>
              <button type="button" onClick={() => setPodium(null)} title="Podest ausblenden" style={{ position: "absolute", top: 10, right: 12, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--nl-line)", background: "var(--nl-panel)", color: "var(--nl-mut)", cursor: "pointer", fontWeight: 800 }}>×</button>
              <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 14 }}>Endstand · Podest</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                {podium.map((c) => {
                  const h = c.place === 1 ? 132 : c.place === 2 ? 100 : 76;
                  const grad = c.place === 1 ? "linear-gradient(180deg, color-mix(in srgb, var(--nl-gold) 85%, white), var(--nl-gold))" : c.place === 2 ? "linear-gradient(180deg, color-mix(in srgb, var(--nl-silver) 70%, white), var(--nl-silver))" : "linear-gradient(180deg, color-mix(in srgb, var(--nl-bronze) 70%, white), var(--nl-bronze))";
                  return (
                    <div key={c.code} className="oly-anim" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: reduced.current ? "none" : `olyPodRise .6s cubic-bezier(.2,1.1,.3,1) ${c.delayMs}ms both` }}>
                      {c.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logoUrl} alt="" width={60} height={60} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--nl-line)", boxShadow: "0 6px 18px -6px rgba(0,0,0,.7)" }} />
                      ) : (
                        <span aria-hidden style={{ width: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", background: `hsl(${hueForIdx(c.idx)} 60% 52%)`, fontWeight: 800, boxShadow: "0 6px 18px -6px rgba(0,0,0,.7)" }}>{c.code.slice(0, 3)}</span>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 800, textAlign: "center", maxWidth: 120, lineHeight: 1.15, color: c.isOwn ? "var(--nl-accent)" : "inherit" }}>{c.isOwn ? "★ " : ""}{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--nl-mut)", fontVariantNumeric: "tabular-nums" }}>{fmt1(c.pts)} Punkte</div>
                      <div style={{ width: 104, height: h, borderRadius: "10px 10px 0 0", background: grad, display: "grid", placeItems: "start center", paddingTop: 8, outline: c.isOwn ? "2px solid var(--nl-accent)" : undefined, outlineOffset: 2 }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: "var(--nl-bg)" }}>{c.place}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {me && me.rank > 3 ? (
                <div style={{ marginTop: 16, fontSize: 13.5, fontWeight: 800, color: "var(--nl-accent)" }}>
                  Dein Team {me.code}: Rang {me.rank} / {N} · {fmt1(shownScore(me))} Punkte
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Highlight-Banner (Benchmark-Felder): kurzer Pop oben über dem Feld */}
          {animField && banner && !podium ? (
            <div
              key={banner.id}
              className="oly-anim"
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 6,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                padding: "6px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.03em",
                color: "var(--nl-ink)",
                background: `color-mix(in srgb, ${banner.kind === "gold" ? "var(--nl-warn)" : "var(--nl-accent)"} 22%, var(--nl-bg))`,
                border: `1px solid ${banner.kind === "gold" ? "var(--nl-warn)" : "var(--nl-accent)"}`,
                boxShadow: "0 6px 20px rgba(0,0,0,.45)",
                animation: reduced.current ? "none" : "olyBanner 2.6s ease-out forwards",
              }}
            >
              {banner.text}
            </div>
          ) : null}

        </div>

        {/* („Dein Läufer"-Karte entfernt — in die konsolidierte „Dein Team"-Karte oben
            über dem Oval integriert: Läufer-Mini + Medaillenring + Spieler-Drawer-Klick. */}
      </div>

      {/* Top-Spieler + Ticker: volle Breite UNTER Arena + Rangliste (bündig). order:3 sorgt
          dafür, dass dieser Block im Flex-Wrap unter die erste Reihe (Arena|Rangliste) rutscht. */}
      <div style={{ flex: "1 1 100%", minWidth: 0, order: 3 }}>

        {/* Top-Spieler-Zeile (nur bereits aufgedeckte Spieler) */}
        {revealedTopPlayers && revealedTopPlayers.rows.length > 0 ? (
          <DisciplineStageTopPlayersRow
            players={revealedTopPlayers.rows}
            playerIdByRow={revealedTopPlayers.ids}
            onOpenPlayer={onOpenPlayer}
            onPreviewPlayer={onPreviewPlayer}
            limit={10}
          />
        ) : null}

        {/* Verletzungs-Zeile: nur wenn es Verletzte unter den aufgedeckten Spielern gibt.
            Rendert sich selbst weg, wenn die Liste leer ist. */}
        <DisciplineStageInjuryRow
          players={revealedInjuredPlayers}
          onOpenPlayer={onOpenPlayer}
          onPreviewPlayer={onPreviewPlayer}
        />

        {/* Ticker */}
        <div style={{ marginTop: 12, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 6 }}>Ticker</div>
          {ticker.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Läuft, sobald die erste Etappe startet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto", overscrollBehaviorY: "contain" }}>
              {ticker.map((row) =>
                row.kind === "header" ? (
                  <div key={row.id} style={{ padding: "5px 9px", borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-ink)", background: "color-mix(in srgb, var(--nl-accent) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--nl-accent) 45%, transparent)" }}>
                    {row.text}
                  </div>
                ) : row.kind === "summary" ? (
                  <div key={row.id} style={{ padding: "6px 9px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "var(--nl-warn)", background: "color-mix(in srgb, var(--nl-warn) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--nl-warn) 40%, transparent)" }}>
                    {row.text}
                  </div>
                ) : (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, background: row.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "transparent", fontVariantNumeric: "tabular-nums" }}>
                    <span aria-hidden style={{ width: 20, height: 20, borderRadius: "50%", flex: "none", overflow: "hidden", background: row.logoUrl ? "transparent" : `hsl(${hueForIdx(row.idx)} 60% 52%)`, display: "grid", placeItems: "center" }}>
                      {row.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.logoUrl} alt="" width={20} height={20} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 20, height: 20, objectFit: "cover" }} />
                      ) : null}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.isOwn ? "★ " : ""}
                        {row.star ? "⭐ " : ""}
                        {row.playerName}
                        <span style={{ color: "var(--nl-mut)", fontWeight: 600 }}>
                          {" "}
                          · {row.code} · Slot-Rang <b style={{ color: ampel(row.slotRank) }}>#{row.slotRank}</b>
                        </span>
                        {row.badge ? (
                          <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 99, color: row.badge[0], border: `1px solid ${row.badge[0]}`, background: `color-mix(in srgb, ${row.badge[0]} 14%, transparent)` }}>{row.badge[1]}</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--nl-mut)" }} title={row.calc}>
                        {row.calc}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div style={{ fontWeight: 800, color: "var(--nl-accent)", fontSize: 13 }}>+{fmt1(row.net)}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: row.delta > 0 ? "var(--nl-good)" : row.delta < 0 ? "var(--nl-risk)" : "var(--nl-mut)" }}>
                        <span style={{ color: ampel(row.rankAfter) }}>#{row.rankAfter}</span>
                        {row.slot > 0 && row.delta !== 0 ? ` (${row.delta > 0 ? "▲" : "▼"}${Math.abs(row.delta)})` : ""}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

      </div>

      {/* Live-Ladder rechts */}
      {/* `height` statt `maxHeight` und kein `sticky` mehr: die Tabelle soll exakt
          mit der Arena anfangen und aufhoeren. Sticky liess sie beim Scrollen
          gegenueber der Arena wandern, `maxHeight` deckelte nur nach oben und liess
          kurze Listen ein Loch darunter. `overflowY: auto` bleibt als Notnagel fuer
          den Fall, dass selbst die Minimal-Zeilenhoehe nicht reicht. */}
      {/* `boxSizing: "border-box"` ist hier KEIN Beiwerk, sondern die zweite Haelfte des Fixes.
          Im Browser nachgemessen (drei Varianten gegeneinander): Mit dem Standard `content-box`
          meint `height: ladderMaxH` nur den INHALT — Polster (2x10px) und Rahmen (2x1px) kommen
          obendrauf. Die Tabelle war damit 22px hoeher als die Arena, obwohl sie exakt deren
          gemessene Hoehe zugewiesen bekam. Mit `border-box` zaehlt beides in die Hoehe hinein,
          und die Aussenkanten liegen wirklich auf einer Linie — gemessen 420 gegen 420, bei
          langer Liste (scrollt innen) wie bei kurzer (fuellt auf). */}
      <div ref={ladderRef} data-testid="arena-ladder" style={{ flex: "0 0 340px", minWidth: 300, boxSizing: "border-box", height: ladderMaxH ?? undefined, overflowY: "auto", overscrollBehavior: "contain", background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: LADDER_PAD_Y, order: 2, display: "flex", flexDirection: "column" }}>
        {/* Kopfblock (Titel + Spaltenkoepfe) in einem gemessenen Wrapper: aus seiner
            Hoehe folgt, wie viel Platz den Zeilen bleibt (siehe LADDER_ROW_H). */}
        <div ref={ladderHeadRef} style={{ flex: "none" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{prim === "barbell" ? (done ? "Endstand" : "Rangliste · live") : done ? "Endstand" : "Rundenstand — live"}</span>
          {prim === "barbell" && !done ? <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9, color: "var(--nl-mut)", fontWeight: 700 }}>{barbellLive} im Wettkampf</span> : null}
        </div>
        {/* Spaltenköpfe — sonst rät man, was die Zahlen bedeuten. */}
        {animField ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 6px 5px", marginLeft: 40, fontSize: 8.5, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--nl-mut-2)", fontWeight: 800 }}>
            <span style={{ flex: 1 }} />
            <span style={{ width: 42, textAlign: "right" }}>Rang Δ</span>
            <span style={{ minWidth: 34, textAlign: "right" }}>Punkte</span>
            <span style={{ width: 30, textAlign: "left" }}>Spieler</span>
          </div>
        ) : prim === "barbell" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 6px 5px", marginLeft: 40, fontSize: 8.5, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--nl-mut-2)", fontWeight: 800 }}>
            <span style={{ flex: 1 }} />
            <span style={{ width: 34, textAlign: "right" }}>Zugew.</span>
            <span style={{ minWidth: 34, textAlign: "right" }}>kg</span>
            {/* Der Gesamtscore erst im Endstand — live wäre er ein Spoiler, weil die
                Kraft-Turm-Darstellung die wahre Stärke bewusst erst enthüllt, wenn die
                Latte sie testet. */}
            {done ? <span style={{ minWidth: 44, textAlign: "right" }}>Score</span> : null}
          </div>
        ) : null}
        </div>
        {/* Zeilenliste fuellt den Rest exakt aus — bei animiertem Feld absolut
            positioniert (fuer die Rang-Wechsel-Animation), sonst im Fluss. */}
        <div
          style={
            trackLadder
              ? { position: "relative", height: N * LADDER_ROW_H, flex: "none" }
              : // Ohne animiertes Feld (z. B. Gewichtheben) stehen die Zeilen im Fluss.
                // Damit die Liste die gestreckte Hoehe trotzdem buendig ausfuellt, werden
                // sie ueber die verbleibende Hoehe verteilt, statt oben zu kleben und
                // darunter ein Loch zu lassen.
                { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }
          }
        >
        {ladderRows.map((t) => {
          const teamClickable = Boolean(onOpenTeam && t.teamId);
          const teamHoverable = Boolean(onHoverTeam && t.teamId);
          const rc = relColor(t.rel);
          // Staffel-Ladder-Politur (nur track): Rang-Änderung ggü. der letzten
          // gewerteten Etappe (rankHistory), „+N" des aktuellen Läufers (letzter
          // aufgedeckter Slot) und Rückstand absolut auf Platz 1.
          // Vergleichsrang = Stand VOR der gerade gezeigten Etappe.
          // Während eine Etappe läuft, ist das der letzte Historien-Eintrag (der
          // Rang nach der vorigen Etappe). Im ENDSTAND ist dieser letzte Eintrag
          // aber schon der Endrang selbst — der Vergleich mit sich selbst ergab
          // Delta 0, weshalb in der Spalte "Rang Δ" dort ausnahmslos "—" stand.
          // Im Endstand zählt daher der vorletzte Eintrag: der Rang vor der
          // letzten Etappe.
          const prevRank = resolveLadderPrevRank(t.rankHistory, done);
          // track: Live-Rang/-Score aus dem geteilten 5s-Zeitstrahl (animScore) → Zeile
          // wandert synchron zur Feldbewegung. Sonst der sequenzielle rank/score.
          // Feld ↔ Tabelle: BEIDE lesen jetzt exakt dieselben Groessen (t.rank ist der
          // oben aus animScore abgeleitete Anzeige-Rang, shownScore der zugehoerige Punktwert).
          const dispRank = t.rank;
          const dispScore = shownScore(t);
          const rankDelta = prevRank != null ? prevRank - dispRank : 0;
          const lastGain = t.thrownSlot >= 0 ? playerNet(t.players[t.thrownSlot]) : null;
          const behind = leader ? shownScore(leader) - dispScore : 0;
          // Gewichtheben · Kraft-Turm: Rang/kg/Zugewinn aus dem Latten-Modell (Anti-
          // Spoiler zählt live hoch), Rang-Pfeil aus der Barbell-Vorrunde, aktueller Heber.
          const bRank = prim === "barbell" ? barbellRankMap[t.code] ?? t.rank : t.rank;
          const bOut = prim === "barbell" && barbellEliminated(t.code);
          const bChamp = prim === "barbell" && done && bRank === 1;
          const bKg = prim === "barbell" ? Math.round(barbellKgOf(t.code)) : 0;
          const bPrevRank = prim === "barbell" ? barbellPrevRankRef.current[t.code] : undefined;
          const bArrow = bPrevRank != null ? bPrevRank - bRank : 0;
          const bPrevKg = prim === "barbell" && barbellInfo ? (barbellPrevDemandRef.current == null ? barbellInfo.axTop : Math.min(barbellPrevDemandRef.current, barbellEndKgOf(t.code))) : 0;
          const bGain = prim === "barbell" && !bOut ? Math.max(0, bKg - Math.round(bPrevKg)) : 0;
          const bLifter = prim === "barbell" ? t.players[barbellTry]?.name ?? "" : "";
          return (
          <div
            key={t.code}
            data-testid="arena-ladder-row"
            onClick={teamClickable ? () => onOpenTeam!(t.teamId!) : undefined}
            onMouseEnter={() => {
              pauseCascade();
              if (teamHoverable) {
                clearLadderHoverTimer();
                ladderHoverTimer.current = window.setTimeout(() => onHoverTeam!(t.teamId), 300);
              }
            }}
            onMouseLeave={() => {
              resumeCascade();
              if (teamHoverable) {
                clearLadderHoverTimer();
                onHoverTeam!(null);
              }
            }}
            title={teamClickable ? "Team-Karte öffnen" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "1.5px 6px", borderRadius: 8, fontVariantNumeric: "tabular-nums", cursor: teamClickable ? "pointer" : "default", opacity: bOut ? 0.55 : 1, background: t.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : bChamp ? "color-mix(in srgb, var(--nl-warn) 16%, transparent)" : rc ? `color-mix(in srgb, ${rc} 9%, transparent)` : "transparent", boxShadow: rc ? `inset 3px 0 0 ${rc}` : undefined, ...(trackLadder ? { position: "absolute" as const, left: 0, right: 0, height: LADDER_ROW_H, overflow: "hidden" as const, transform: `translateY(${(dispRank - 1) * LADDER_ROW_H}px)`, transition: reduced.current ? "none" : "transform .35s cubic-bezier(.45,0,.2,1)" } : null) }}>
            <span style={{ width: 26, textAlign: "right", fontWeight: 800, color: prim === "barbell" ? (bChamp ? "var(--nl-warn)" : ampel(bRank)) : ampel(dispRank), fontSize: 12.5 }}>{bChamp ? "🏆" : `#${prim === "barbell" ? bRank : dispRank}`}</span>
            {prim === "barbell" ? (
              <span aria-hidden title="Rang-Änderung seit letzter Runde" style={{ width: 14, fontSize: 10, fontWeight: 800, textAlign: "left", color: bArrow > 0 ? "var(--nl-good)" : bArrow < 0 ? "var(--nl-risk)" : "var(--nl-mut)" }}>
                {bArrow > 0 ? "▲" : bArrow < 0 ? "▼" : ""}
              </span>
            ) : null}
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" width={16} height={16} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flex: "none" }} />
            ) : (
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, flex: "none", background: `hsl(${hueForIdx(t.idx)} 60% 52%)` }} />
            )}
            {prim === "barbell" ? (
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
                <span style={{ fontWeight: 800, fontSize: 11.5, color: t.isOwn ? "var(--nl-accent)" : rc ?? "inherit", display: "flex", alignItems: "center", gap: 3 }}>
                  {t.code}
                  {bOut ? <span style={{ fontSize: 8 }}>🔴</span> : null}
                  {t.rel && !t.isOwn ? <span aria-hidden style={{ fontSize: 9, color: rc ?? undefined }}>{REL_GLYPH[t.rel]}</span> : null}
                </span>
                <span style={{ fontSize: 8.5, color: "var(--nl-mut-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bLifter}</span>
              </span>
            ) : (
              <>
                <span style={{ width: 44, fontWeight: 800, color: t.isOwn ? "var(--nl-accent)" : "inherit", fontSize: 12.5 }}>{t.code}</span>
                {t.rel && !t.isOwn ? (
                  <span
                    title={
                      t.rel === "ally"
                        ? "Verbündet"
                        : t.rel === "rival"
                          ? "Rivale"
                          : t.rel === "human"
                            ? "Mitspieler"
                            : "Dein Team"
                    }
                    aria-hidden
                    style={{ fontSize: 11, flex: "none", color: rc ?? undefined }}
                  >
                    {REL_GLYPH[t.rel]}
                  </span>
                ) : null}
                <span style={{ flex: 1, fontSize: 11.5, color: "var(--nl-mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
              </>
            )}
            {/* A2: keine Aufstellung eingereicht — 0 Punkte ist KEIN echtes Ergebnis,
                muss sich sichtbar von einem regulären Last-Place-Ergebnis abheben. */}
            {t.missingLineup ? (
              <span
                title="Team hat für diese Disziplin keine Aufstellung eingereicht — 0 ist kein echtes Ergebnis"
                style={{ flex: "none", fontSize: 9.5, fontWeight: 800, color: "var(--nl-risk)", background: "color-mix(in srgb, var(--nl-risk) 16%, transparent)", border: "1px solid var(--nl-risk)", borderRadius: 6, padding: "1px 5px", whiteSpace: "nowrap" }}
              >
                keine Aufstellung
              </span>
            ) : null}
            {animField ? (
              <span title={`Rang-Änderung diese Etappe${behind > 0 ? ` · ${fmt1(behind)} hinter Platz 1` : ""}`} style={{ width: 42, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: rankDelta > 0 ? "var(--nl-good)" : rankDelta < 0 ? "var(--nl-risk)" : "var(--nl-mut)", fontVariantNumeric: "tabular-nums" }}>
                {rankDelta > 0 ? `▲${rankDelta}` : rankDelta < 0 ? `▼${Math.abs(rankDelta)}` : "—"}
              </span>
            ) : null}
            {prim === "barbell" ? (
              <span title="Zugewinn diese Runde" style={{ width: 34, textAlign: "right", fontSize: 9.5, fontWeight: 800, color: bOut ? "var(--nl-mut-2)" : "var(--nl-good)", fontVariantNumeric: "tabular-nums" }}>
                {bOut ? "raus" : bGain > 0 ? `+${bGain}` : "—"}
              </span>
            ) : null}
            <span style={{ fontWeight: 800, fontSize: 12.5, fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right", color: prim === "barbell" ? (bOut ? "var(--nl-mut)" : "var(--nl-warn)") : "inherit" }}>{prim === "barbell" ? bKg : fmt1(dispScore)}</span>
            {/* Gewichtheben: der kg-Wert ist die Inszenierung, der Gesamtscore die Wertung.
                Im Endstand stehen beide nebeneinander — vorher blieb der Score unsichtbar. */}
            {prim === "barbell" && done ? (
              <span
                title="Gesamtscore des Teams in dieser Disziplin (Summe aller eingesetzten Spieler)"
                style={{ minWidth: 44, textAlign: "right", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: bOut ? "var(--nl-mut)" : "var(--nl-ink)" }}
              >
                {fmt1(dispScore)}
              </span>
            ) : null}
            {animField ? (
              <span title="Beitrag des aktuellen Spielers" style={{ width: 30, fontSize: 11, fontWeight: 800, textAlign: "left", fontVariantNumeric: "tabular-nums", color: lastGain != null ? "var(--nl-good)" : "transparent" }}>
                {lastGain != null ? `+${fmt1(lastGain)}` : ""}
              </span>
            ) : null}
          </div>
          );
        })}
        </div>
      </div>

      {/* Detail-Ergebnistabelle (volle Breite unter der Arena, nach dem Podest) */}
      {ended ? (
        <div style={{ flex: "1 1 100%", minWidth: 0, order: 4 }}>
          <DisciplineStageResultTable rows={resultRows} slotLabels={slots} onOpenPlayer={onOpenPlayer} onPreviewPlayer={onPreviewPlayer} onHoverTeam={onHoverTeam} onOpenTeam={onOpenTeam} />

        </div>
      ) : null}
    </div>
  );
}
