"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { useArenaRoomSync } from "@/lib/room/use-arena-room-sync";
import type { RoomArenaState } from "@/types/game";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import {
  buildDisciplineStageModel,
  type DisciplineStageSlot,
} from "@/lib/foundation/discipline-stage/discipline-stage-data";
import {
  buildDisciplineStageTeamsFromPreview,
  type StageTeamMeta,
} from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";
import {
  buildDisciplineStageTeamsFromBookedResult,
  chooseDisciplineStageTeams,
} from "@/lib/foundation/discipline-stage/discipline-stage-from-booked-result";
import { orderStageTeamsBySeasonRank } from "@/lib/foundation/discipline-stage/discipline-stage-team-order";
import {
  spieltagsTopSpielerAusBuchung,
  spieltagsTopSpielerAusVorschau,
  summiereSpieltagsTopSpieler,
  waehleSpieltagsTopSpielerZeilen,
} from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";
import { buildMatchdayInjuryMarks } from "@/lib/foundation/discipline-stage/discipline-stage-matchday-injuries";
import { replayNachArenaReset } from "@/lib/foundation/discipline-stage/discipline-stage-replay-gate";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import { resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";
import DisciplineStageHighlights from "@/app/foundation/discipline-stage/DisciplineStageHighlights";
import { SPIELTAGS_TOPSPIELER_LIMIT } from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";
import DisciplineStageTopPlayers, { type DisciplineStageTopPlayer } from "@/app/foundation/discipline-stage/DisciplineStageTopPlayers";
import { getRankToPointsValue, resolveDisciplinePlayerCount } from "@/lib/resolve/rank-to-points";
import DisciplineStageNativeArena, { type StagePrimitive, type StageMotif, type StageEnv, type StageLiveResultsByTeam } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";
import type { DisciplineStageDrawerTarget } from "@/app/foundation/discipline-stage/DisciplineStageDrawer";
// PERF: Der Drawer (~1.300 Zeilen) zeigt bis zum ersten Team-/Spieler-Klick nichts an
// (er rendert `null`, solange `target` leer ist — siehe DisciplineStageDrawer.tsx) und
// gehört daher nicht ins Erstlade-Bundle der Arena. Er bleibt als Geschwister-Element
// GENAUSO wie vorher immer in der Baumstruktur (siehe Render unten, „Geschwister NACH
// der Arena" — Grund: Arena darf bei einem Drawer-Klick nicht remounten), nur die
// Komponente selbst kommt jetzt über next/dynamic. Dadurch beginnt der Chunk-Download
// bereits beim Arena-Mount im Hintergrund (kein Suspense-Fallback nötig, der Drawer
// zeigt ja ohnehin nichts vor dem ersten Klick) — bis der Spieler tatsächlich klickt,
// ist der Chunk in aller Regel längst da, kein Ladeframe beim Öffnen.
const DisciplineStageDrawer = dynamic(() => import("@/app/foundation/discipline-stage/DisciplineStageDrawer"), {
  ssr: false,
});
// PERF-GEGENPROBE: DisciplineStageMatchdayPanel (~1.187 Zeilen) bleibt bewusst STATISCH.
// Anders als der Drawer ist es NICHT dauerhaft im Baum (siehe `{mode === "real" && preview
// && matchdayPanel ? … : null}` weiter unten) — es erscheint, sobald die Resolve-Preview
// steht, und die kommt oft aus dem Session-Cache (siehe `getMatchdayArenaBaseBundle` im
// Preview-Effekt), der SYNCHRON im ersten Effekt-Durchlauf treffen kann. Ein next/dynamic
// an dieser Stelle würde den Chunk-Import erst in genau dem Moment anstoßen, in dem das
// Panel ohnehin sofort erscheinen soll — im Cache-Treffer-Fall bekäme der Spieler einen
// echten Ladeframe direkt unter der Bühne zu sehen, den es vorher nicht gab. Das wäre ein
// sichtbarer Rückschritt, deshalb bleibt dieser Import unverändert.
import DisciplineStageMatchdayPanel, {
  type MatchdayPanelPlayerRow,
  type MatchdayPanelStandingRow,
  type MatchdayPanelTeamResult,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";
import { buildMatchdayTeamModifiers } from "@/lib/foundation/matchday-team-modifiers";
import { buildStandingsMatchdayRankPair } from "@/lib/foundation/season-standings-matchday-rank-delta";
import { getMatchdayScoringProgress, getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";
import {
  buildMatchdayArenaBaseSessionKey,
  buildMatchdayLineupRevision,
  getMatchdayArenaBaseBundle,
  setMatchdayArenaBaseBundle,
} from "@/lib/foundation/matchday-arena-session-cache";
import DisciplineStageHoverPreview, { type DisciplineStageHoverTarget } from "@/app/foundation/discipline-stage/DisciplineStageHoverPreview";
import { fmt1 } from "@/app/foundation/discipline-stage/stage-format";
import { buildTeamRelationshipMap } from "@/lib/foundation/team-relationship";
import { buildPlayerRatingContractMap, type PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import {
  getMatchdayArenaReadiness,
  getMatchdayLeagueLineupReadiness,
  hasCurrentMatchdayResult,
} from "@/lib/foundation/matchday-arena-readiness";
import {
  getLineupDraftSideCounts,
  getTeamMatchdayLineupDraft,
  getTeamRosterPlayerIds,
} from "@/lib/foundation/matchday-lineup-readiness";
import { VeloPendingRanking } from "@/components/foundation/velo-ui";
import { preloadDisciplineField } from "@/app/foundation/discipline-stage/arena/disciplines/registry";
import { prefetchDisciplineStageMedia } from "@/lib/foundation/foundation-panel-prefetch";

// Disziplinen mit fertigem nativem Renderer (löst schrittweise das iframe ab).
// Nativer Renderer je Disziplin. Engine, FX, Sounds, Ticker, Podest, Detail-
// Tabelle und Top-10 sind für alle 20 gleich; nur das Feld-Primitive unterscheidet
// die Optik: track (Oval, Position = Punkte), lanes (Bahnen, Fortschritt = Punkte),
// towers (Türme, Höhe = Punkte).
const NATIVE_PRIMITIVE: Record<string, StagePrimitive> = {
  // track — Renn-/Parcours-Logik auf einer Bahn
  staffel: "track",
  spurt: "bump", // Slalom/Bump: Rang-über-Etappen-Linien (nutzt rankHistory)
  "takeshis-castle": "parcours", // Schlangen-Parcours (Serpentine)
  "mini-dm": "duelhp", // 1v1-Lebensbalken (Fighting-Game-HP)
  battlefield: "territory", // Squarified Treemap (Gebietseroberung, Fläche ∝ Score)
  // lanes / Row-Familie — parallele Reihen bis zum Ziel
  "time-trial": "peloton", // Straße: Ausreißer/Hauptfeld
  "speed-schach": "klassen", // Liga-Klassen-Bänder (Elo-Klassen)
  fechten: "lamps", // Treffer-Lampen (rot/grün)
  tennis: "klassen", // Liga-Klassen-Bänder (Setzköpfe)
  wettessen: "platter", // leergegessene Teller + 🍴
  "i-spy": "spybar", // Späh-/Sichtfeld-Balken, 🔍 + Funde
  // Turm-Familie — Höhe/Wertung = Punkte
  basketball: "court", // Wurfkarte (Halbfeld)
  gewichtheben: "barbell", // Hantel-Säulen mit Scheiben
  climbing: "mountain", // Gipfelsturm (Berg-Serpentine)
  eiskunstlauf: "stage", // Kür auf der Ruhm-Treppe wie Showcase
  showcase: "stage", // Showcase-Bühne mit Tiefe (Ruhm-Treppe → Podest)
  football: "parcours", // Raumgewinn-Parcours (Serpentine) auf dem Flutlicht-Rasen
  hockey: "rink", // Eisrink von oben
  breaking: "thermometer", // Schmerz-Thermometer (grün → glühend rot)
  tdm: "kda", // K/D/A-Scoreboard aus dem Score abgeleitet
};

export type DisciplineStageArenaProps = {
  gameState: GameState;
  selectedTeamId: string;
  activeManagerTeamId: string | null;
  saveId?: string | null;
  seasonId?: string | null;
  matchdayId?: string | null;
  onAdvanceMatchday?: (() => void | Promise<void>) | null;
  /**
   * Bucht die gerade zu Ende gespielte Disziplin. Wird direkt beim Zieleinlauf gerufen —
   * die Platzierungspunkte stehen damit im Saisonstand, sobald der Endscreen erscheint.
   * `"d1"` schreibt einen halben Spieltag, `"d2"` schliesst ihn ab. Ohne diesen Callback
   * bleibt die Buehne reine Vorschau (z. B. `dev-arena`).
   */
  onCommitDiscipline?:
    | ((side: "d1" | "d2", shownPreview: LegacyMatchdayResolvePreview | null) => Promise<unknown>)
    | null;
  onOpenPlayer?: ((playerId: string) => void) | null;
  onOpenTeam?: ((teamId: string) => void) | null;
  /**
   * Öffnet die Einsatzliste (S3): der Pre-Matchday-Zustand macht „deine Einsatzliste
   * fehlt" zum Helden mit echtem CTA — ohne Handler (z. B. `dev-arena`) bleibt der
   * Zustand rein informativ.
   */
  onOpenLineup?: (() => void) | null;
  /** Multiplayer-Room-Kontext — aktiviert Co-op-Ready-Gate + host-getriebenen Lockstep-Reveal. */
  roomContext?: FoundationRoomContext | null;
  /**
   * Kanonische, ligaweite OVR/Rang-Karte (Server-Slice auf dem VOLLEN Save) — dieselbe
   * Quelle wie Kader/Spielerprofil/Ranglisten. Bevorzugt gegenüber der lokalen
   * `buildPlayerRatingContractMap(gameState)`-Berechnung, die auf dem kompakten
   * Client-Payload eine PLAUSIBLE FALSCHE Zahl liefert (disciplineResults/matchdayResults
   * sind dort bis auf den aktiven Spieltag gestrichen — siehe
   * docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md). Fehlt/leer (z. B. dev-arena ohne Shell-
   * Kontext): lokaler Fallback, wie bisher.
   */
  canonicalRatingByPlayerId?: Map<string, PlayerRatingContractRow> | null;
};

// Mutator-Traits = echte Spielregel (lib/lineups/legacy-lineup-modifiers.ts):
// 2 Traits werden pro Disziplin bestimmt; jeder eingesetzte Spieler mit
// passendem Trait bekommt +6 Score pro Treffer (max +12) und +0,3 Player-Points.
const MUTATOR_TRAIT_BONUS = 6;
const MUTATOR_PP_BONUS = 0.3;
const POSITIVE_MUTATOR_TRAITS = [
  "Altruistic", "Ambitious", "Caring", "Cool", "Diligent", "Disciplined", "Eloquent", "Fair",
  "FanFavorite", "Fearless", "FiredUp", "Flexible", "Healthy", "Loyal", "Motivated", "Relaxed",
  "Resourceful", "Sexy",
];
const NEGATIVE_MUTATOR_TRAITS = [
  "Timid", "Cheater", "ColdBlooded", "Cruel", "Devious", "Diva", "Egomaniac", "FaintHearted",
  "Feisty", "Gambler", "Lazy", "Manipulative", "Mercenary", "Obsessive", "Paranoid", "Renegade",
  "Scandalous", "Vindictive",
];
const ALL_MUTATOR_TRAITS = [...POSITIVE_MUTATOR_TRAITS, ...NEGATIVE_MUTATOR_TRAITS];
const POSITIVE_TRAIT_SET = new Set(POSITIVE_MUTATOR_TRAITS.map((t) => t.toLowerCase()));

// 2 Traits deterministisch aus dem Pool wählen (seed = Wurf).
/**
 * Zurueck an den Anfang der Buehne.
 *
 * Der "Weiter zu Disziplin 2"-Knopf sitzt UNTER der Arena. Ohne diesen Sprung stand man
 * nach dem Wechsel mitten in der Spieltags-Wertung und musste die neue Disziplin erst
 * wieder hochsuchen. Ziel ist der Arena-Container aus dem Shell (`foundation-matchday-arena`);
 * fehlt er, wird auf den Seitenanfang zurueckgefallen.
 */
function scrollArenaIntoView() {
  if (typeof document === "undefined") return;
  const container = document.getElementById("foundation-matchday-arena");
  if (container) {
    container.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function pickMutatorTraits(seed: number): string[] {
  const rng = mulberry32(seed);
  const pool = [...ALL_MUTATOR_TRAITS];
  const out: string[] = [];
  for (let i = 0; i < 2 && pool.length > 0; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

// +6-Mods für die Traits, die dieser Spieler tatsächlich hat (case-insensitiv).
function traitMutatorMods(playerTraits: string[], chosenTraits: string[]): StageMod[] {
  const owned = new Set(playerTraits.map((t) => t.toLowerCase()));
  const mods: StageMod[] = [];
  for (const trait of chosenTraits) {
    if (owned.has(trait.toLowerCase())) {
      mods.push({ k: trait, sign: 1, amt: MUTATOR_TRAIT_BONUS });
    }
  }
  return mods;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type StageMod = { k: string; sign: 1 | -1; amt: number; injury?: boolean };

// Echte Save-Werte als additive Mods, damit val + Σmods = net (die Modellrechnung).
function realMods(slot: DisciplineStageSlot): StageMod[] {
  const mods: StageMod[] = [];
  if (slot.fatiguePenalty > 0) {
    mods.push({ k: "Fatigue", sign: -1, amt: slot.fatiguePenalty });
  }
  if (slot.formSwing !== 0) {
    mods.push({
      k: slot.formSwing > 0 ? "Form" : "Formtief",
      sign: slot.formSwing > 0 ? 1 : -1,
      amt: Math.abs(slot.formSwing),
    });
  }
  return mods;
}

// Disziplin-eigene Slot-Labels — die ECHTEN Namen aus den Disziplin-Szenen
// (Etappen-Button, Ticker, Spotlight, Detail-Tabelle). Hardcodiert übernommen,
// damit sie den iframe-Abriss überleben. Für 3 Szenen ohne definierte Namen
// (mini-dm, battlefield, i-spy) ein thematischer Fallback.
const SLOT_VOCAB: Record<string, string[]> = {
  staffel: ["Start Runner", "Tempo Link", "Baton Tech", "Curve Runner", "Anchor"],
  spurt: ["Block Start", "Acceleration", "Top Speed", "Drive Phase", "Photo Finish"],
  "time-trial": ["Pacer", "Line Reader", "Aero Drive", "Split Control", "Finish Kick"],
  hockey: ["Power Forward", "Defensive Wall", "Playmaker", "Slot Finisher", "Captain Line"],
  football: ["Line Power", "Route Burst", "Field Read", "Red Zone", "Locker Leader"],
  basketball: ["Tip-Off", "Fast Break", "Downtown", "And-One", "Buzzer Beater", "Overtime"],
  wettessen: ["Amuse-Bouche", "Suppe", "Hauptgang", "Wildbret", "Dessert"],
  // 6 Einträge: gewichtheben/climbing/i-spy haben playerCount 6 (siehe lib/data/dataAdapter.ts) — mit nur
  // 5 Vokabeln fiel der letzte Slot auf das generische „Etappe 6" zurück.
  gewichtheben: ["Power Opener", "Safe Lift", "Pressure Lift", "Technical Lift", "Grip Anchor", "Maximalversuch"],
  climbing: ["Route Reader", "Grip Specialist", "Pace Climber", "Endurance Wall", "Summit Push", "Top-Out"],
  eiskunstlauf: ["Edge Control", "Jump Setup", "Spin Grace", "Crowd Moment", "Final Pose"],
  showcase: ["Stage Lead", "Crowd Hook", "Style Tech", "Big Moment", "Finale"],
  "speed-schach": ["Opening Prep", "Pattern Read", "Clock Pressure", "Calculation Core", "Endgame Anchor"],
  fechten: ["Duelist", "Aggressor", "Defender", "Technician", "Final Touch"],
  tennis: ["Serve", "Return", "Rally Control", "Net Pressure", "Tiebreak Clutch"],
  breaking: ["First Blood", "Pain Threshold", "Stone Face", "Mind Fortress", "Unbroken"],
  "takeshis-castle": ["Gate Crash", "Balance Run", "Trap Reader", "Chaos Dodge", "Final Wall"],
  tdm: ["Opener", "Trader", "Anchor", "Lurker", "Closer"],
  // Szenen ohne definierte SLOTS — thematischer Fallback:
  battlefield: ["Ansturm", "Flanke", "Verteidigung", "Belagerung", "Sturm-Finale"],
  "mini-dm": ["Runde 1", "Runde 2", "Runde 3", "Runde 4", "Runde 5"],
  "i-spy": ["Erster Fund", "Zweiter Fund", "Dritter Fund", "Vierter Fund", "Fünfter Fund", "Letzter Fund"],
};

// Skin je Disziplin: Akzentfarbe (Feldlinien + Wasserzeichen) + Hintergrund-
// Motiv. Farben als hsl() (kein Hex → Design-Token-Lint bleibt sauber).
// Athletik-Stadion (Aschenbahn + Rasen-Innenfeld + Ränge) — die volle Stimmung
// der Original-Staffel-Arena, Farben als hsl().
const STADIUM_ATHLETICS: StageEnv = {
  sky: ["hsl(28 38% 20%)", "hsl(28 42% 9%)"],
  stands: "hsl(28 36% 22%)",
  surface: ["hsl(20 74% 46%)", "hsl(12 68% 34%)", "hsl(7 70% 17%)"],
  line: "hsl(38 50% 88%)",
  infield: ["hsl(140 45% 32%)", "hsl(148 50% 20%)"],
};

// Weitere atmosphärische Umgebungen (Fable-Konzept) — Abnahme-Slice.
const ENV_ICE_RINK: StageEnv = {
  sky: ["hsl(214 78% 5%)", "hsl(210 55% 10%)"],
  stands: "hsl(210 45% 16%)",
  surface: ["hsl(200 50% 78%)", "hsl(202 44% 64%)", "hsl(203 42% 40%)"],
  line: "hsl(199 74% 60%)",
  glow: { color: "hsl(196 100% 87%)", kind: "spot" },
  deco: [{ kind: "sheen", color: "hsl(196 100% 90%)" }],
};
const ENV_VELODROME: StageEnv = {
  sky: ["hsl(216 45% 4%)", "hsl(214 40% 9%)"],
  stands: "hsl(214 35% 14%)",
  surface: ["hsl(213 35% 15%)", "hsl(212 32% 18%)", "hsl(214 40% 10%)"],
  line: "hsl(207 48% 80%)",
  glow: { color: "hsl(215 64% 53%)", kind: "finish" },
  deco: [{ kind: "spotlights", color: "hsl(48 30% 88%)", count: 2 }],
};
const ENV_JUNGLE: StageEnv = {
  sky: ["hsl(87 31% 6%)", "hsl(80 25% 10%)"],
  stands: "hsl(90 20% 9%)",
  surface: ["hsl(43 39% 67%)", "hsl(43 30% 55%)", "hsl(43 26% 42%)"],
  line: "hsl(45 45% 82%)",
  infield: ["hsl(96 30% 22%)", "hsl(100 32% 14%)"],
  deco: [
    { kind: "silhouette", color: "hsl(90 22% 7%)" },
    { kind: "lanterns", color: "hsl(28 90% 55%)", halo: "hsl(20 85% 45%)" },
  ],
};

// Showcase-Bühne mit Tiefe (Violett-Bühne) — stage-Primitive: die stage-Layer
// (Treppe/Podest/Spotlight) werden im Renderer selbst gezeichnet; env.line = Gold.
const ENV_SHOWSTAGE: StageEnv = {
  sky: ["hsl(268 30% 6%)", "hsl(268 35% 14%)"],
  stands: "hsl(268 40% 10%)",
  surface: ["hsl(268 40% 12%)", "hsl(268 45% 8%)", "hsl(268 50% 5%)"],
  line: "hsl(41 100% 77%)",
  deco: [
    { kind: "spotlights", color: "hsl(43 100% 85%)", count: 3 },
    { kind: "silhouette", color: "hsl(268 30% 4%)" },
  ],
};

// --- Restliche atmosphärische Umgebungen (Fable-Atmosphären-Vorlage, hsl) ---
const ENV_BATTLEFIELD: StageEnv = {
  sky: ["hsl(255 12% 4%)", "hsl(260 12% 9%)"],
  stands: "hsl(258 12% 12%)",
  surface: ["hsl(30 15% 30%)", "hsl(28 14% 22%)", "hsl(26 14% 15%)"],
  line: "hsl(38 48% 62%)",
  infield: ["hsl(90 12% 14%)", "hsl(95 12% 9%)"],
  deco: [
    { kind: "silhouette", color: "hsl(258 12% 7%)" },
    { kind: "lanterns", color: "hsl(20 90% 55%)", halo: "hsl(10 80% 40%)" },
  ],
};
const ENV_CHESS_HALL: StageEnv = {
  sky: ["hsl(30 30% 5%)", "hsl(28 32% 9%)"],
  stands: "hsl(30 28% 14%)",
  surface: ["hsl(36 30% 17%)", "hsl(34 28% 13%)", "hsl(30 26% 9%)"],
  line: "hsl(43 63% 62%)",
  deco: [{ kind: "checker", light: "hsl(42 40% 70%)", dark: "hsl(25 30% 18%)" }],
};
const ENV_FENCING_HALL: StageEnv = {
  sky: ["hsl(204 20% 5%)", "hsl(205 18% 9%)"],
  stands: "hsl(205 16% 14%)",
  surface: ["hsl(206 14% 20%)", "hsl(205 12% 16%)", "hsl(205 12% 11%)"],
  line: "hsl(200 17% 84%)",
  glow: { color: "hsl(48 30% 88%)", kind: "flood" },
  deco: [{ kind: "sheen", color: "hsl(200 20% 80%)" }],
};
const ENV_TENNIS_NIGHT: StageEnv = {
  sky: ["hsl(40 27% 5%)", "hsl(45 20% 8%)"],
  stands: "hsl(130 25% 12%)",
  surface: ["hsl(130 40% 16%)", "hsl(131 38% 12%)", "hsl(131 36% 9%)"],
  line: "hsl(45 36% 86%)",
  glow: { color: "hsl(48 30% 88%)", kind: "flood" },
};
const ENV_BANQUET: StageEnv = {
  sky: ["hsl(25 50% 5%)", "hsl(24 45% 9%)"],
  stands: "hsl(24 40% 14%)",
  surface: ["hsl(33 45% 25%)", "hsl(31 40% 19%)", "hsl(30 38% 13%)"],
  line: "hsl(38 41% 76%)",
  deco: [
    { kind: "lanterns", color: "hsl(41 79% 57%)", halo: "hsl(28 70% 40%)" },
    { kind: "banners", cloth: "hsl(12 55% 34%)", trim: "hsl(41 65% 55%)" },
  ],
};
const ENV_POWER_STAGE: StageEnv = {
  sky: ["hsl(135 15% 4%)", "hsl(130 12% 8%)"],
  stands: "hsl(130 12% 12%)",
  surface: ["hsl(24 40% 24%)", "hsl(24 40% 18%)", "hsl(24 38% 12%)"],
  line: "hsl(30 35% 68%)",
  glow: { color: "hsl(43 90% 80%)", kind: "spot" },
  deco: [{ kind: "spotlights", color: "hsl(43 90% 82%)", count: 2 }],
};
const ENV_FLOODLIT_STADIUM: StageEnv = {
  sky: ["hsl(135 15% 4%)", "hsl(139 18% 8%)"],
  stands: "hsl(139 16% 12%)",
  surface: ["hsl(139 45% 17%)", "hsl(140 42% 12%)", "hsl(140 40% 8%)"],
  line: "hsl(38 27% 80%)",
  glow: { color: "hsl(48 30% 88%)", kind: "flood" },
  deco: [{ kind: "grid", color: "hsl(140 30% 55%)" }],
};
const ENV_ICE_STADIUM: StageEnv = {
  sky: ["hsl(210 58% 5%)", "hsl(208 50% 9%)"],
  stands: "hsl(208 40% 14%)",
  surface: ["hsl(200 45% 74%)", "hsl(202 42% 58%)", "hsl(203 40% 36%)"],
  line: "hsl(197 78% 88%)",
  glow: { color: "hsl(197 90% 85%)", kind: "spot" },
  deco: [{ kind: "sheen", color: "hsl(197 90% 88%)" }],
};
const ENV_BATTLE_STAGE: StageEnv = {
  sky: ["hsl(15 40% 3%)", "hsl(8 45% 7%)"],
  stands: "hsl(8 30% 12%)",
  surface: ["hsl(10 40% 11%)", "hsl(8 42% 8%)", "hsl(8 42% 5%)"],
  line: "hsl(30 35% 82%)",
  deco: [
    { kind: "grid", color: "hsl(1 72% 48%)" },
    { kind: "spotlights", color: "hsl(44 80% 60%)", count: 2 },
  ],
};
const ENV_NEON_SEARCH: StageEnv = {
  sky: ["hsl(267 44% 5%)", "hsl(270 40% 9%)"],
  stands: "hsl(268 35% 13%)",
  surface: ["hsl(268 35% 12%)", "hsl(268 38% 9%)", "hsl(268 38% 6%)"],
  line: "hsl(271 61% 80%)",
  deco: [
    { kind: "grid", color: "hsl(272 70% 60%)" },
    { kind: "sheen", color: "hsl(271 60% 70%)" },
  ],
};
// Taktisches Deathmatch-HUD für TDM: kaltes Schwarz mit Neon-Rot-Anflug, rote
// Rasterlinien statt Skyline — Scoreboard/Kill-Feed statt 3D-Feld. Farben als hsl().
const ENV_TDM_HUD: StageEnv = {
  sky: ["hsl(222 28% 4%)", "hsl(2 34% 7%)"],
  stands: "hsl(2 24% 11%)",
  surface: ["hsl(222 20% 10%)", "hsl(222 22% 6%)", "hsl(2 26% 5%)"],
  line: "hsl(2 76% 64%)",
  deco: [{ kind: "grid", color: "hsl(2 70% 46%)" }],
};

// Berg-Panorama für den Gipfelsturm (Climbing): dämmriger Himmel → warmer Horizont,
// Fels-Oberfläche, Schnee-Linien, Sonne als Spot-Glow. Farben als hsl().
const ENV_MOUNTAIN: StageEnv = {
  sky: ["hsl(214 55% 20%)", "hsl(28 46% 40%)"],
  stands: "hsl(220 18% 26%)",
  surface: ["hsl(220 16% 24%)", "hsl(220 16% 17%)", "hsl(222 18% 12%)"],
  line: "hsl(200 30% 90%)",
  glow: { color: "hsl(38 90% 78%)", kind: "spot" },
};
// Parkett-Court für die Basketball-Wurfkarte: warmes Holz, cremefarbene Linien,
// Hallen-Spot. Farben als hsl().
const ENV_COURT: StageEnv = {
  sky: ["hsl(24 30% 8%)", "hsl(24 30% 12%)"],
  stands: "hsl(24 30% 14%)",
  surface: ["hsl(30 55% 55%)", "hsl(28 52% 45%)", "hsl(26 50% 34%)"],
  line: "hsl(40 60% 90%)",
  glow: { color: "hsl(45 90% 82%)", kind: "spot" },
};

// Warme Nahkampf-Dojo-Arena für Mini-DM (Auto-Battler-Pit): warmes Rot/Gold statt
// TDMs kaltem Schwarz-Rot-HUD. Der native duelhp-Zweig zeichnet den Pit selbst
// (eigene warme Radial-Stimmung + Gold-Ränder); dieses env hält die Identität für
// etwaige Nicht-Native-Fallbacks konsistent. Farben als hsl().
const ENV_ARENA_PIT: StageEnv = {
  sky: ["hsl(340 30% 12%)", "hsl(20 24% 7%)"],
  stands: "hsl(20 24% 13%)",
  surface: ["hsl(35 34% 34%)", "hsl(30 30% 24%)", "hsl(24 26% 15%)"],
  line: "hsl(45 82% 62%)",
  glow: { color: "hsl(45 88% 64%)", kind: "spot" },
  deco: [{ kind: "banners", cloth: "hsl(356 55% 30%)", trim: "hsl(45 65% 55%)" }],
};

const DISCIPLINE_SKIN: Record<string, { accent: string; motif: StageMotif; env?: StageEnv }> = {
  staffel: { accent: "hsl(14 80% 58%)", motif: "chevrons", env: STADIUM_ATHLETICS },
  spurt: { accent: "hsl(38 90% 58%)", motif: "chevrons", env: STADIUM_ATHLETICS },
  "takeshis-castle": { accent: "hsl(160 55% 50%)", motif: "grid", env: ENV_JUNGLE },
  "mini-dm": { accent: "hsl(45 82% 60%)", motif: "combat", env: ENV_ARENA_PIT },
  battlefield: { accent: "hsl(80 45% 52%)", motif: "combat", env: ENV_BATTLEFIELD },
  "time-trial": { accent: "hsl(190 75% 56%)", motif: "chevrons", env: ENV_VELODROME },
  "speed-schach": { accent: "hsl(215 28% 64%)", motif: "board", env: ENV_CHESS_HALL },
  fechten: { accent: "hsl(210 62% 66%)", motif: "combat", env: ENV_FENCING_HALL },
  tennis: { accent: "hsl(90 62% 55%)", motif: "court", env: ENV_TENNIS_NIGHT },
  wettessen: { accent: "hsl(32 78% 60%)", motif: "plates", env: ENV_BANQUET },
  basketball: { accent: "hsl(24 85% 57%)", motif: "court", env: ENV_COURT },
  gewichtheben: { accent: "hsl(210 14% 64%)", motif: "weights", env: ENV_POWER_STAGE },
  climbing: { accent: "hsl(16 62% 56%)", motif: "grid", env: ENV_MOUNTAIN },
  eiskunstlauf: { accent: "hsl(195 70% 72%)", motif: "ice", env: ENV_ICE_RINK },
  showcase: { accent: "hsl(310 62% 63%)", motif: "stage", env: ENV_SHOWSTAGE },
  football: { accent: "hsl(140 55% 50%)", motif: "court", env: ENV_FLOODLIT_STADIUM },
  hockey: { accent: "hsl(205 72% 63%)", motif: "court", env: ENV_ICE_STADIUM },
  breaking: { accent: "hsl(275 60% 65%)", motif: "stage", env: ENV_BATTLE_STAGE },
  "i-spy": { accent: "hsl(260 58% 65%)", motif: "grid", env: ENV_NEON_SEARCH },
  tdm: { accent: "hsl(2 78% 62%)", motif: "combat", env: ENV_TDM_HUD },
};

function slotLabel(disciplineId: string, index: number, total: number): string {
  const vocab = SLOT_VOCAB[disciplineId];
  if (vocab && vocab[index]) return vocab[index];
  if (total <= 1) return "Einzel";
  return `Etappe ${index + 1}`;
}

export default function DisciplineStageArena({
  gameState,
  selectedTeamId,
  activeManagerTeamId,
  saveId,
  seasonId,
  matchdayId,
  onAdvanceMatchday,
  onCommitDiscipline,
  onOpenPlayer,
  onOpenTeam,
  onOpenLineup,
  roomContext,
  canonicalRatingByPlayerId,
}: DisciplineStageArenaProps) {
  const ownTeamId = activeManagerTeamId ?? selectedTeamId ?? null;

  // Drawer-Overlay über der laufenden Arena. WICHTIG: drawerTarget fließt NICHT in
  // den Arena-key oder das teams-Memo ein — sonst würde ein Klick die Arena
  // remounten und zurücksetzen (genau der Bug, den der Drawer ersetzt).
  const [drawerTarget, setDrawerTarget] = useState<DisciplineStageDrawerTarget>(null);
  // Hover zeigt eine kompakte, am MAUS-CURSOR verankerte Vorschau (NICHT den vollen
  // rechten Drawer). Der volle Drawer öffnet ausschließlich per KLICK (gepinnt).
  const [hoverPreview, setHoverPreview] = useState<DisciplineStageHoverTarget>(null);
  // Letzte Cursor-Position (window-weit). Die Hover-Handler der Arena tragen keine
  // Koordinaten, daher lesen wir hier die aktuelle Position beim Hover-Eintritt aus.
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (event: MouseEvent) => {
      cursorRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const openDrawerPinned = (target: NonNullable<DisciplineStageDrawerTarget>) => {
    setHoverPreview(null); // Klick pinnt den vollen Drawer → Hovercard schließen
    setDrawerTarget(target);
  };
  const previewPlayer = (id: string | null) => {
    if (id != null) {
      const { x, y } = cursorRef.current;
      setHoverPreview({ kind: "player", id, x, y });
    } else {
      setHoverPreview(null);
    }
  };
  const previewTeam = (teamId: string | null) => {
    if (teamId != null) {
      const { x, y } = cursorRef.current;
      setHoverPreview({ kind: "team", id: teamId, x, y });
    } else {
      setHoverPreview(null);
    }
  };

  const disciplines = useMemo(
    () =>
      [...(gameState?.disciplines ?? [])].sort(
        (a, b) => (a.displayOrder ?? a.originalOrder ?? 0) - (b.displayOrder ?? b.originalOrder ?? 0),
      ),
    [gameState?.disciplines],
  );

  const defaultDisciplineId = useMemo(() => {
    if (disciplines.some((d) => d.id === "staffel")) {
      return "staffel";
    }
    return disciplines.find((d) => NATIVE_PRIMITIVE[d.id])?.id ?? disciplines[0]?.id ?? "staffel";
  }, [disciplines]);

  const [disciplineId, setDisciplineId] = useState<string>(defaultDisciplineId);
  const [mode, setMode] = useState<"real" | "random">("real");
  const [seed, setSeed] = useState<number>(1);

  // Dev-/Test-Chrome (Modus-Umschalter, Modell-Check, Lesehilfe) ist standardmäßig
  // versteckt: die Bühne wirkt wie ein Spiel, nicht wie ein Dev-Tool. Nur mit ?dev
  // in der URL oder localStorage-Flag erscheint die Test-Oberfläche wieder. Lesen im
  // Effect (nicht beim ersten Render) verhindert SSR-Hydration-Mismatch.
  const [devMode, setDevMode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasQuery = new URLSearchParams(window.location.search).has("dev");
    const hasFlag = window.localStorage.getItem("oly-stage-dev") === "1";
    if (hasQuery || hasFlag) setDevMode(true);
  }, []);

  const model = useMemo(
    () => buildDisciplineStageModel(gameState, disciplineId, ownTeamId),
    [gameState, disciplineId, ownTeamId],
  );

  // Lookups (Kürzel/Logo je Team, Portrait je Spieler) für das Engine-Mapping.
  const teamMetaById = useMemo(() => {
    const map = new Map<string, StageTeamMeta>();
    for (const team of gameState?.teams ?? []) {
      map.set(team.teamId, {
        code: team.shortCode,
        name: team.name,
        logoUrl: getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null),
      });
    }
    return map;
  }, [gameState?.teams]);

  const portraitById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const player of gameState?.players ?? []) {
      map.set(player.id, getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null));
    }
    return map;
  }, [gameState?.players]);

  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of gameState?.players ?? []) {
      map.set(player.id, player.name);
    }
    return map;
  }, [gameState?.players]);

  // Kanonische Ratings (OVR/Rang/PP/MVS) je Spieler für Drawer, Hover-Vorschau, Chips
  // und Star-Rahmen — EINMAL je gameState memoisiert.
  //
  // Quelle bevorzugt `canonicalRatingByPlayerId` (Server-Slice auf dem vollen Save,
  // dieselbe wie Kader/Spielerprofil/Ranglisten). Der lokale Fallback
  // `buildPlayerRatingContractMap(gameState)` rechnet aus dem KOMPAKTEN Client-Payload
  // nach — `disciplineResults`/`matchdayResults` sind darin bis auf den aktiven Spieltag
  // gestrichen, und der daraus gebaute Saison-Punkte-Ledger ist entsprechend falsch. Das
  // ergab in der Buehne eine plausible, aber FALSCHE OVR (gemessen an einem Spielstand
  // mit 5 abgeschlossenen Spieltagen: kanonisch 58,87, lokal 81,61 fuer denselben
  // Spieler) statt der ligaweiten OVR "aus allen Spieltagen", die ueberall sonst steht
  // — siehe docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md. Der Fallback bleibt nur fuer
  // Kontexte ohne Shell (z. B. `dev-arena`-Vorschau), die keine kanonische Karte liefern.
  const ratingByPlayerId = useMemo<Map<string, PlayerRatingContractRow>>(() => {
    if (canonicalRatingByPlayerId && canonicalRatingByPlayerId.size > 0) {
      return canonicalRatingByPlayerId;
    }
    try {
      return buildPlayerRatingContractMap(gameState);
    } catch {
      return new Map<string, PlayerRatingContractRow>();
    }
  }, [gameState, canonicalRatingByPlayerId]);

  // Echte Resolve-Preview der Arena laden (nur wenn Matchday-Kontext vorhanden).
  const [preview, setPreview] = useState<LegacyMatchdayResolvePreview | null>(null);
  const [briefingItems, setBriefingItems] = useState<
    { teamId: string; currentRank: number | null; projectedRank: number | null }[]
  >([]);
  // Saison-Standings-Vorschau (Rang/Punkte VOR und projiziert NACH dem Spieltag) für das
  // Team-Matchday-PP-Panel unten — die Briefing-Items tragen nur currentRank, hier stecken
  // projectedRank/projectedPoints/pointsDelta drin.
  const [standingsItems, setStandingsItems] = useState<MatchdayPanelStandingRow[]>([]);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  // Erlaubt manuelles Neuladen der Engine-Preview (Retry-Button), falls der erste Versuch
  // fehlschlägt/hängt — ohne den Retry säßen normale Spieler bei „unavailable" still fest.
  const [previewReloadNonce, setPreviewReloadNonce] = useState(0);
  /**
   * „Tafel gelesen, ab auf die Bühne." Bewusst NUR im Komponentenzustand und nicht im Spielstand:
   * die Tafel soll vor JEDEM Spieltag einmal kommen (das war Chris' Anliegen), aber wer sie
   * weggeklickt hat, soll beim Hin- und Herwechseln nicht wieder darauf landen. Ein neuer Spieltag
   * mountet die Arena neu, damit steht der Merker wieder auf `false`.
   */
  const [preMatchdayDismissed, setPreMatchdayDismissed] = useState(false);

  /**
   * Stand der Aufstellungen dieses Spieltags. Teil des Cache-Schluessels UND Ausloeser des Effekts
   * darunter: ziehen die KI-Aufstellungen nach, waehrend die Buehne offen steht, muss die Preview
   * neu geholt werden. Vorher blieb die alte stehen — und gebucht wurde spaeter etwas anderes,
   * als ueber den Schirm gelaufen war.
   */
  const lineupRevision = useMemo(
    () =>
      buildMatchdayLineupRevision(gameState?.seasonState?.lineupDrafts, {
        seasonId: seasonId ?? "",
        matchdayId: matchdayId ?? "",
      }),
    [gameState?.seasonState?.lineupDrafts, seasonId, matchdayId],
  );

  useEffect(() => {
    if (!saveId || !seasonId || !matchdayId) {
      setPreviewState("unavailable");
      return;
    }
    const controller = new AbortController();

    // Session-Cache zuerst: Der Lineup→Arena-Übergang füllt ihn während der Übergabe-Animation
    // vor (prefetchMatchdayArenaBase mit includeDetails), und beim Zurückwechseln in die Arena
    // liegt das Bundle ohnehin noch. Vorher lud die Arena bei JEDEM Mount neu — der teuerste
    // Teil des Öffnens (Resolve-Preview für 32 Teams, ~1 s Serverzeit) lief also immer wieder.
    // Der Schlüssel trägt `includeDetails`, ein Light-Prefetch kann hier also nicht treffen.
    const sessionKey = buildMatchdayArenaBaseSessionKey({
      saveId,
      seasonId,
      matchdayId,
      teamId: ownTeamId ?? "",
      source: "sqlite",
      includeDetails: true,
      lineupRevision,
    });
    // Beim manuellen Retry (previewReloadNonce > 0) den Cache bewusst ÜBERSPRINGEN: Wer auf
    // „Engine erneut laden" drückt, will einen echten neuen Versuch — ein Cache-Treffer würde
    // sonst immer dasselbe (womöglich leere) Ergebnis zurückgeben und der Button wäre wirkungslos.
    const cached =
      previewReloadNonce > 0
        ? null
        : getMatchdayArenaBaseBundle<{
            resolvePreview?: { preview?: unknown } | null;
            briefingStandings?: { items?: unknown } | null;
            standingsPreview?: { items?: unknown } | null;
          }>(sessionKey);
    if (cached) {
      const cachedPreview = (cached.resolvePreview?.preview ?? null) as typeof preview;
      setPreview(cachedPreview);
      setBriefingItems(Array.isArray(cached.briefingStandings?.items) ? (cached.briefingStandings.items as MatchdayPanelStandingRow[]) : []);
      setStandingsItems(Array.isArray(cached.standingsPreview?.items) ? (cached.standingsPreview.items as MatchdayPanelStandingRow[]) : []);
      setPreviewState(cachedPreview ? "ready" : "unavailable");
      return;
    }

    setPreviewState("loading");
    const query = new URLSearchParams({ saveId, seasonId, matchdayId, teamId: ownTeamId ?? "", source: "sqlite", includeDetails: "1" });
    fetch(`/api/matchday/arena-base?${query.toString()}`, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((payloadJson) => {
        // Genau wie im catch-Zweig: eine Antwort, die schon eingereiht war, als der Effekt
        // aufgeräumt wurde (Spieltags-/Team-Wechsel), darf den State nicht mehr beschreiben —
        // sonst blitzt die Vorschau des alten Spieltags auf, bis der neue Request antwortet.
        if (controller.signal.aborted) return;
        // Für den nächsten Besuch (Tab-Wechsel, Rückkehr aus dem Spielerprofil) mitschreiben —
        // dieselbe Ablage, aus der der Lineup→Arena-Übergang vorbefüllt.
        if (payloadJson?.context) {
          setMatchdayArenaBaseBundle(sessionKey, payloadJson);
        }
        const enginePreview = payloadJson?.resolvePreview?.preview ?? null;
        setPreview(enginePreview);
        setBriefingItems(Array.isArray(payloadJson?.briefingStandings?.items) ? payloadJson.briefingStandings.items : []);
        setStandingsItems(Array.isArray(payloadJson?.standingsPreview?.items) ? payloadJson.standingsPreview.items : []);
        setPreviewState(enginePreview ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreview(null);
          setBriefingItems([]);
          setStandingsItems([]);
          setPreviewState("unavailable");
        }
      });
    return () => controller.abort();
  }, [saveId, seasonId, matchdayId, ownTeamId, previewReloadNonce, lineupRevision]);

  const engineDiscipline = useMemo(
    () => preview?.disciplinePreviews.find((d) => d.disciplineId === disciplineId) ?? null,
    [preview, disciplineId],
  );

  // Team-Matchday-PP-Panel (unten): alles aus der Resolve-Preview ableiten (die IMMER
  // vorliegt, wenn die Engine-Arena läuft) — so erscheint das Panel zuverlässig, statt an
  // fehlender Standings-/Spielplan-Nebenquelle zu scheitern. d1/d2 kommen kanonisch aus den
  // teamResults (d1DisciplineId/d2DisciplineId), Namen aus den disciplinePreviews (Fallback:
  // Spielplan). Rang vor/nach: Standings-Preview (projectedRank), Briefing als Vorher-Fallback.
  const matchdayPanel = useMemo(() => {
    if (!preview) return null;
    const results = preview.teamResults ?? [];
    if (results.length === 0) return null;
    const d1Id = results.find((r) => r.d1DisciplineId)?.d1DisciplineId ?? null;
    const d2Id = results.find((r) => r.d2DisciplineId)?.d2DisciplineId ?? null;
    const nameById = new Map(preview.disciplinePreviews.map((d) => [d.disciplineId, d.disciplineName] as const));
    let schedule: { d1?: { disciplineId: string; displayName: string } | null; d2?: { disciplineId: string; displayName: string } | null } | null = null;
    if (matchdayId) {
      try {
        const entry = getSeasonDisciplineScheduleEntry(gameState, matchdayId);
        if (entry) {
          schedule = {
            d1: entry.discipline1?.disciplineId ? { disciplineId: entry.discipline1.disciplineId, displayName: entry.discipline1.displayName } : null,
            d2: entry.discipline2?.disciplineId ? { disciplineId: entry.discipline2.disciplineId, displayName: entry.discipline2.displayName } : null,
          };
        }
      } catch {
        schedule = null;
      }
    }
    const nameOf = (id: string | null): string =>
      id ? nameById.get(id) ?? (schedule?.d1?.disciplineId === id ? schedule.d1.displayName : schedule?.d2?.disciplineId === id ? schedule?.d2?.displayName ?? id : id) : id ?? "";
    const d1 = d1Id ? { disciplineId: d1Id, displayName: nameOf(d1Id) } : schedule?.d1 ?? null;
    const d2 = d2Id ? { disciplineId: d2Id, displayName: nameOf(d2Id) } : schedule?.d2 ?? null;
    // Rang-Quelle je Team zusammenführen: Standings (Rang vor+nach) > Briefing (nur vorher).
    const rankByTeam = new Map<string, MatchdayPanelStandingRow>();
    for (const b of briefingItems) {
      rankByTeam.set(b.teamId, { teamId: b.teamId, currentRank: b.currentRank, projectedRank: b.projectedRank ?? null, currentPoints: null, projectedPoints: null, pointsDelta: null });
    }
    for (const s of standingsItems) rankByTeam.set(s.teamId, s);
    /**
     * A1 (Audit Spieltag): der Saison-Rang VOR dem Spieltag kommt kanonisch aus
     * `seasonState.standings` — derselben Quelle wie Home-KPI, Saisonstand und die
     * Bahn-Reihenfolge der Bühne. Die Standings-/Briefing-Preview nummerierte bei
     * 0 Punkten schlicht alphabetisch durch: dasselbe Team stand als „Rang 19" im
     * Kopf und als Zeile 22 in der Wertung, und die ersten drei Teams des Alphabets
     * bekamen Medaillen-Optik. Preview-Werte bleiben nur Rückfall, falls der lokale
     * Spielstand (z. B. dev-arena ohne volles Save) keinen Rang trägt.
     */
    const canonicalStandings = gameState.seasonState?.standings ?? {};
    const canonicalRankOf = (teamId: string): number | null => {
      const rank = canonicalStandings[teamId]?.rank;
      return typeof rank === "number" && Number.isFinite(rank) ? rank : null;
    };
    /**
     * GEMELDET VON CHRIS (Spieltag 4): „auch nach D1 müsste es ja eine Rangänderung geben …
     * ausgangsrang ist z. B. der von MD3" — und nach der Buchung von D2 stand in der S-Rang-Spalte
     * bei allen 32 Teams „7 → 7", „22 → 22" usw.
     *
     * Ursache: Sobald der Spieltag GEBUCHT ist, trägt `standings[team].rank` bereits den Stand NACH
     * diesem Spieltag — als „vorher" gelesen war das Paar zwangsläufig entartet (vorher == nachher).
     * Der echte Ausgangsrang steckt in `matchdayBaselinePoints` (Punktestand VOR der Wertung,
     * geschrieben von standings-apply für genau diesen Spieltag). Die Rangliste daraus baut
     * `buildStandingsMatchdayRankPair` — DIESELBE Rechnung, aus der auch der Saisonstand seine
     * Rang-Bewegung bezieht (eine Quelle pro Größe, sonst widersprechen sich zwei Seiten).
     *
     * Vor der Buchung (auch beim halb gewerteten Spieltag) bleibt `standings.rank` der Stand nach
     * dem VORIGEN Spieltag und ist damit selbst der richtige „vorher"-Wert.
     */
    const bookedForThisMatchday =
      matchdayId != null &&
      results.some((r) => canonicalStandings[r.teamId]?.matchdayBaselineId === matchdayId);
    const baselineRankPairByTeam = bookedForThisMatchday
      ? buildStandingsMatchdayRankPair(
          (gameState.teams ?? []).map((team) => ({ teamId: team.teamId, teamName: team.name })),
          canonicalStandings,
        )
      : null;
    const standings: MatchdayPanelStandingRow[] = results.map((r) => {
      const s = rankByTeam.get(r.teamId);
      const pair = baselineRankPairByTeam?.get(r.teamId) ?? null;
      return {
        teamId: r.teamId,
        currentRank: pair != null ? pair.previousRank : canonicalRankOf(r.teamId) ?? s?.currentRank ?? null,
        projectedRank: pair != null ? canonicalRankOf(r.teamId) ?? pair.currentRank : s?.projectedRank ?? null,
        currentPoints: s?.currentPoints ?? null,
        projectedPoints: s?.projectedPoints ?? null,
        pointsDelta: s?.pointsDelta ?? null,
      };
    });
    // Mutator-PP (die „0,3er") pro Team, spielergenau + getrennt nach d1/d2. Direkt aus der
    // Resolve-Preview: jeder Entry trägt mutatorPpsBonus (1:1 dem Spieler gutgeschrieben, kein
    // Team-Split). So kann das Panel den Mutator-Anteil separat vom Team-PP ausweisen.
    const mutatorByTeam = new Map<string, { d1Pp: number; d2Pp: number; d1Players: { name: string; pp: number }[]; d2Players: { name: string; pp: number }[] }>();
    for (const dp of preview.disciplinePreviews ?? []) {
      const side = dp.disciplineId === d1?.disciplineId ? "d1" : dp.disciplineId === d2?.disciplineId ? "d2" : null;
      if (!side) continue;
      for (const tr of dp.teamResults ?? []) {
        const cur = mutatorByTeam.get(tr.teamId) ?? { d1Pp: 0, d2Pp: 0, d1Players: [], d2Players: [] };
        for (const e of tr.entries ?? []) {
          const pp = e.mutatorPpsBonus ?? 0;
          if (pp > 0.0001) {
            if (side === "d1") {
              cur.d1Pp += pp;
              cur.d1Players.push({ name: e.playerName, pp });
            } else {
              cur.d2Pp += pp;
              cur.d2Players.push({ name: e.playerName, pp });
            }
          }
        }
        mutatorByTeam.set(tr.teamId, cur);
      }
    }
    /**
     * ROHDATEN FÜR „Δ MODIFIKATOREN" — je Team und Disziplin-Seite die BASIS-Summe (Leistung vor
     * allen Modifikatoren, `entry.baseValue`) und der ENDSTAND (`teamResult.score`).
     *
     * Bewusst nur die Summen und NICHT die fertigen Ränge: welche Seite aufgedeckt ist, weiß allein
     * das Panel (`d1Revealed`/`d2Revealed`), und die Aufdeck-Regel liegt dort für Punkte, Form,
     * Captain und Mutator schon zentral. Zwei Stellen, die dieselbe Regel je selbst auslegen,
     * laufen früher oder später auseinander — genau daran krankte die Bühne zuletzt.
     *
     * Wozu das gut ist: das alte „Daten-Ansicht"-Scoreboard zeigte, was Fatigue, Captain,
     * Formkarten und Mutatoren an PLÄTZEN gebracht haben. Auf Wunsch von Chris zurückgeholt —
     * hier aus den Rohsummen der Resolve-Vorschau, nicht aus einer zweiten Rangrechnung. Die gab
     * es einmal (`lib/season/matchday-arena-presenter.ts`, `baseRank`/`rankDelta`); sie hatte
     * keinen Aufrufer, sortierte bei Gleichstand nach Teamname statt wie die Engine nach
     * `rankDescendingSharedTies` und ist am 11.08.2026 gelöscht worden.
     */
    const modifierBaseByTeam = new Map<string, { d1Base: number; d1Score: number; d2Base: number; d2Score: number }>();
    for (const dp of preview.disciplinePreviews ?? []) {
      const seite = dp.disciplineId === d1?.disciplineId ? "d1" : dp.disciplineId === d2?.disciplineId ? "d2" : null;
      if (!seite) continue;
      for (const tr of dp.teamResults ?? []) {
        const cur = modifierBaseByTeam.get(tr.teamId) ?? { d1Base: 0, d1Score: 0, d2Base: 0, d2Score: 0 };
        const basisSumme = (tr.entries ?? []).reduce((summe, e) => summe + (e.baseValue ?? 0), 0);
        if (seite === "d1") {
          cur.d1Base += basisSumme;
          cur.d1Score += tr.score ?? 0;
        } else {
          cur.d2Base += basisSumme;
          cur.d2Score += tr.score ?? 0;
        }
        modifierBaseByTeam.set(tr.teamId, cur);
      }
    }

    // Spieler je Team und Disziplin-Seite für die ausklappbaren Spalten der Spieltags-
    // Wertung. Quelle sind dieselben Resolve-Entries wie oben — kein zweiter Rechenweg.
    // `pp` ist der dem Spieler gutgeschriebene Player-Point-Anteil, `score` sein
    // Beitrag zum Team-Score (die Zahl, nach der die Arena animiert).
    const playersByTeam = new Map<string, { d1: MatchdayPanelPlayerRow[]; d2: MatchdayPanelPlayerRow[] }>();
    for (const dp of preview.disciplinePreviews ?? []) {
      const side = dp.disciplineId === d1?.disciplineId ? "d1" : dp.disciplineId === d2?.disciplineId ? "d2" : null;
      if (!side) continue;
      for (const tr of dp.teamResults ?? []) {
        const cur = playersByTeam.get(tr.teamId) ?? { d1: [], d2: [] };
        for (const e of tr.entries ?? []) {
          if (!e.playerId) continue;
          // PP INKLUSIVE Mutator-Bonus — dieselbe Definition wie im Saison-Ledger
          // (`points = basePoints + mutatorPpsBonus`, season-points-ledger.ts).
          // `pointsAwarded` ist nur der verteilte Basis-Anteil, `mutatorPpsBonus`
          // liegt in der Resolve-Engine als eigenes Feld daneben. Vorher stand hier
          // allein `pointsAwarded`: die Summe der Spieler-Chips ergab damit die
          // Basis-PP des Teams statt des Gesamtwerts, obwohl der Chip-Tooltip
          // "davon ◆ X Mutator" behauptete, der Bonus stecke schon drin.
          const basePp = e.pointsAwarded ?? null;
          const mutatorPp = e.mutatorPpsBonus ?? null;
          cur[side].push({
            playerId: e.playerId,
            name: e.playerName ?? e.playerId,
            // Ueber den geteilten Helfer statt inline: dieselbe Summe zieht auch der
            // Ledger, der Team-Hover und die Top-Spieler-Zeile. Zwei Stellen, die
            // "Anteil + Mutator" jeweils selbst ausrechnen, laufen frueher oder
            // spaeter auseinander — genau so ist dieser Fehler entstanden.
            pp: resolveAwardedPlayerPoints({ pointsAwarded: basePp, mutatorPpsBonus: mutatorPp }),
            score: e.finalPlayerScore ?? null,
            mutatorPp,
            // Ligaweiter OVR-Rang fuer den Star-Tier-Rahmen des Chips. Quelle ist die
            // bereits vorhandene `ratingByPlayerId` — `buildPlayerRatingContractMap`
            // OHNE `playerIds`, sonst schrumpfte der Normalisierungs-/Rang-Pool auf die
            // eingesetzten Spieler und die Raenge waeren falsch (Top 50 der Liga, nicht
            // Top 50 dieses Spieltags).
            ovrRank: ratingByPlayerId.get(e.playerId)?.ovrRank ?? null,
          });
        }
        playersByTeam.set(tr.teamId, cur);
      }
    }
    // Höchste PP zuerst — die Reihenfolge ist die Aussage der Aufklappung.
    for (const sides of playersByTeam.values()) {
      for (const key of ["d1", "d2"] as const) {
        sides[key].sort((left, right) => (right.pp ?? -1) - (left.pp ?? -1) || (right.score ?? 0) - (left.score ?? 0));
      }
    }
    // Punkte je RANG (nicht flach). Bug zuvor: der Roll-up gab bei gleich-/null-
    // bewerteten Teams jedem Rang 1 → alle bekamen den Platz-1-Wert (z. B. 6,6 in der
    // Zweierdisziplin). Hier je Disziplin die Teams NACH ihrem echten Disziplin-Score
    // platzieren (dieselbe Zahl, nach der die Arena animiert) und den Platz über die
    // kanonische rank→points-Tabelle (getRankToPointsValue) in Punkte übersetzen.
    // Teams ohne echten (positiven) Score bekommen 0 statt fälschlich den Platz-1-Wert.
    const placementPointsForSide = (
      discipline: { disciplineId: string; displayName: string } | null,
      side: "d1" | "d2",
    ): Map<string, number> => {
      const map = new Map<string, number>();
      if (!discipline) return map;
      const dp = (preview.disciplinePreviews ?? []).find((entry) => entry.disciplineId === discipline.disciplineId);
      if (!dp) return map;
      const playerCount = resolveDisciplinePlayerCount(gameState, {
        matchdayId: matchdayId ?? null,
        disciplineId: discipline.disciplineId,
        disciplineSide: side,
      });
      // Fallback je Team auf den bereits von der Engine berechneten teamPoints-Wert,
      // falls die Spieleranzahl (und damit die rank→points-Suche) mal nicht auflösbar ist —
      // besser der Engine-Wert als alles auf 0.
      const engineTeamPoints = new Map(
        (dp.teamResults ?? []).map((tr) => [tr.teamId, Number.isFinite(tr.teamPoints ?? NaN) ? (tr.teamPoints as number) : null] as const),
      );
      const scoring = (dp.teamResults ?? [])
        .map((tr) => ({ teamId: tr.teamId, score: Number.isFinite(tr.score) ? tr.score : 0 }))
        .filter((tr) => tr.score > 0)
        .sort((left, right) => right.score - left.score);
      // Standard Competition Ranking (1, 2, 2, 4) — Gleichstand teilt den besseren Rang.
      let previousScore: number | null = null;
      let sharedRank = 0;
      scoring.forEach((tr, index) => {
        const rounded = Math.round(tr.score * 10) / 10;
        if (previousScore === null || rounded !== previousScore) {
          sharedRank = index + 1;
          previousScore = rounded;
        }
        map.set(tr.teamId, getRankToPointsValue(playerCount, sharedRank) ?? engineTeamPoints.get(tr.teamId) ?? 0);
      });
      // Teams ohne echten Score: keine Platzierungs-Punkte (nicht der Platz-1-Wert).
      for (const tr of dp.teamResults ?? []) {
        if (!map.has(tr.teamId)) map.set(tr.teamId, 0);
      }
      return map;
    };
    const d1PointsByTeam = placementPointsForSide(d1, "d1");
    const d2PointsByTeam = placementPointsForSide(d2, "d2");
    const teamResults: MatchdayPanelTeamResult[] = results.map((r) => {
      // `?? null` statt `?? 0`: liefert die Disziplin ueberhaupt kein Team-Ergebnis
      // (kein `disciplinePreview` zu dieser Disziplin — z. B. weil d1/d2 nur aus dem
      // Spielplan stammen), ist der Wert UNBEKANNT und nicht "null Punkte". Die 0 war
      // hier doppelt schaedlich: die Spieltags-Wertung zeigte eine erfundene 0, und die
      // Aufdeck-Regel der Arena (`teamResults.some((row) => row.d1Points != null)`)
      // konnte nie greifen, weil `d1Points` damit NIE null war. Teams, die in der
      // Disziplin gewertet wurden, aber keinen Score haben, stehen weiterhin auf 0 —
      // die setzt `placementPointsForSide` selbst.
      const d1Points = d1 ? d1PointsByTeam.get(r.teamId) ?? null : null;
      const d2Points = d2 ? d2PointsByTeam.get(r.teamId) ?? null : null;
      return {
        teamId: r.teamId,
        d1DisciplineId: d1?.disciplineId ?? null,
        d1Points,
        d2DisciplineId: d2?.disciplineId ?? null,
        d2Points,
        totalPoints: (d1Points ?? 0) + (d2Points ?? 0),
        missingLineup: r.missingLineup,
      };
    });
    // Captain-/Formkarten-Einsatz je Team — 1:1 aus derselben Preview, damit die
    // Wertung zeigt, WOMIT ein Team in den Spieltag gegangen ist (kein Recompute).
    const modifiersByTeam = buildMatchdayTeamModifiers({
      disciplinePreviews: preview.disciplinePreviews ?? [],
      d1DisciplineId: d1?.disciplineId ?? null,
      d2DisciplineId: d2?.disciplineId ?? null,
    });
    return { d1, d2, standings, mutatorByTeam, modifierBaseByTeam, playersByTeam, modifiersByTeam, teamResults };
  }, [preview, gameState, matchdayId, briefingItems, standingsItems, ratingByPlayerId]);

  /**
   * Buchungszustand des Spieltags aus dem SAVE (nicht aus Session-State): welche
   * Disziplin-Seite ist bereits gewertet? Das ist die Antwort auf den Reload
   * mitten im Spieltag — `endedDisciplineIds` (Session) ist dann leer, aber die
   * D1-Buchung steht längst im Spielstand. Dieselbe Quelle benutzen Spielplan
   * („läuft") und Spieltagsergebnis („Zwischenstand"); ohne sie erzählte die
   * Arena nach dem Reload „nichts gestartet", während D1 gebucht war.
   */
  const scoringProgress = useMemo(
    () => (matchdayId ? getMatchdayScoringProgress(gameState, matchdayId) : null),
    [gameState, matchdayId],
  );

  // Bühne muss mit einer Disziplin DES aktuellen Spieltags starten, nicht mit dem
  // hart kodierten Default ("staffel"). Sonst zeigt die Arena eine Disziplin ohne
  // Preview-Daten → vereinfachtes Modell statt der bestätigten Einsatzliste, und es
  // wirkt wie der falsche Spieltag. Einmal pro Spieltag ausrichten (respektiert
  // manuelle Dropdown-Auswahl); beim Spieltagswechsel richtet es neu aus.
  //
  // Halber Spieltag: ist D1 laut Save schon gebucht und D2 offen, richtet die
  // Bühne auf D2 aus — der Spieler soll nach einem Reload dort weitermachen, wo
  // der Spieltag wirklich steht, nicht vor der bereits gewerteten Staffel.
  const alignedMatchdayRef = useRef<string | null | undefined>(null);
  useEffect(() => {
    const d1Id = matchdayPanel?.d1?.disciplineId ?? null;
    const d2Id = matchdayPanel?.d2?.disciplineId ?? null;
    if (!d1Id && !d2Id) return;
    if (alignedMatchdayRef.current === matchdayId) return;
    // Bevorzugte Start-Disziplin: die erste noch UNGEWERTETE Seite des Spieltags.
    const preferred =
      scoringProgress?.d1.scored && !scoringProgress?.d2.scored && d2Id ? d2Id : d1Id ?? d2Id;
    if (preferred && disciplineId !== preferred && disciplineId !== d2Id) {
      setDisciplineId(preferred);
    }
    alignedMatchdayRef.current = matchdayId;
  }, [matchdayId, matchdayPanel?.d1?.disciplineId, matchdayPanel?.d2?.disciplineId, disciplineId, scoringProgress]);

  // Spieltags-Disziplinen (d1/d2) DIREKT aus dem Saison-Spielplan — unabhängig von der Engine-Preview.
  // `matchdayPanel` liefert dieselbe Info, ist aber an `preview` gekoppelt (frühes `if (!preview) return null`).
  // Fällt die Preview aus (Netzfehler/leeres Ergebnis), wusste die Bühne vorher NICHT mehr, welche zwei
  // Disziplinen anstehen → Dropdown zeigte alle ~20 Disziplinen und der geführte „Weiter zu Disziplin 2"-
  // Schritt verschwand. Der Spielplan steht aber lokal im gameState und braucht die Engine gar nicht.
  const scheduleSides = useMemo(() => {
    if (!matchdayId) return null;
    try {
      const entry = getSeasonDisciplineScheduleEntry(gameState, matchdayId);
      if (!entry) return null;
      return {
        d1: entry.discipline1?.disciplineId
          ? { disciplineId: entry.discipline1.disciplineId, displayName: entry.discipline1.displayName }
          : null,
        d2: entry.discipline2?.disciplineId
          ? { disciplineId: entry.discipline2.disciplineId, displayName: entry.discipline2.displayName }
          : null,
      };
    } catch {
      return null;
    }
  }, [gameState, matchdayId]);

  // Engine-Panel bevorzugt (es kennt die real aufgelösten Disziplinen), Spielplan als Rückfallebene.
  const matchdaySides = useMemo(
    () => ({
      d1: matchdayPanel?.d1 ?? scheduleSides?.d1 ?? null,
      d2: matchdayPanel?.d2 ?? scheduleSides?.d2 ?? null,
    }),
    [matchdayPanel, scheduleSides],
  );

  /**
   * PERF: Feld-Chunk der NICHT aktiven Spieltags-Disziplin still im Hintergrund vorladen
   * (registry.ts lädt seit #Arena-Erstlade-Gewicht jede Disziplin einzeln nach). Ohne
   * diesen Vorgriff bekäme genau der "Weiter zu Disziplin 2"-Wechsel den Ladeframe zu
   * sehen, den wir eigentlich vermeiden wollen — die zweite Disziplin steht ja schon
   * fest, bevor sie drankommt (Spielplan), es gibt also keinen Grund, mit dem Laden bis
   * zum Wechsel selbst zu warten. Rein additiv/best effort, kein Einfluss auf die
   * aktuell gezeigte Disziplin.
   */
  useEffect(() => {
    const otherId = matchdaySides.d1?.disciplineId === disciplineId ? matchdaySides.d2?.disciplineId : matchdaySides.d1?.disciplineId;
    if (!otherId || otherId === disciplineId) return;
    const primitive = NATIVE_PRIMITIVE[otherId];
    if (!primitive) return;
    preloadDisciplineField(primitive, otherId);
  }, [matchdaySides, disciplineId]);

  // Auswählbar sind für normale Spieler NUR die zwei Disziplinen des aktuellen Spieltags (Diszi 1
  // vor Diszi 2), keine anderen — freies Einwählen in beliebige Disziplinen bleibt Admin-/Dev-Modus.
  const matchdayDisciplineOptions = useMemo<Array<{ id: string; name: string }>>(() => {
    const pairs = [matchdaySides.d1, matchdaySides.d2].filter(
      (entry): entry is { disciplineId: string; displayName: string } => Boolean(entry?.disciplineId),
    );
    const nameById = new Map(disciplines.map((d) => [d.id, d.name] as const));
    return pairs.map((entry) => ({ id: entry.disciplineId, name: nameById.get(entry.disciplineId) ?? entry.displayName }));
  }, [matchdaySides, disciplines]);
  const disciplineSelectOptions = useMemo<Array<{ id: string; name: string }>>(
    () => (devMode || matchdayDisciplineOptions.length === 0 ? disciplines : matchdayDisciplineOptions),
    [devMode, matchdayDisciplineOptions, disciplines],
  );

  // Die 2 aktiven Mutatoren dieser Disziplin (disziplin-weit gleich) — für die
  // Anzeige „welche beiden es sind". Aus den mutatorSlots eines beliebigen Teams.
  const disciplineMutators = useMemo<string[]>(() => {
    const slots = engineDiscipline?.teamResults?.[0]?.mutatorSlots ?? [];
    return slots.map((s) => s.label).filter((l): l is string => Boolean(l && l.trim()));
  }, [engineDiscipline]);

  // ---- Co-op-Room-Sync (Multiplayer): host-getriebener Lockstep-Reveal ----
  // Die Bühne ist eine Ein-Disziplin-Ansicht → wir tragen die aktuell gezeigte
  // Disziplin als „active phase" und den Reveal-Schritt (round) als slotRevealIndex.
  // Nur der Host advanced; der Guest folgt via onApplyRevealSync. Die Hover-/Space-
  // Pause des Hosts propagiert automatisch (Host sendet dann keinen nächsten Schritt).
  const [syncedRound, setSyncedRound] = useState(0);
  // Welche Spieltags-Seite die aktuell gewählte Disziplin ist (für den Room-State).
  const activeDisciplineSide: "d1" | "d2" | "overall" =
    matchdaySides.d1?.disciplineId === disciplineId ? "d1" : matchdaySides.d2?.disciplineId === disciplineId ? "d2" : "overall";
  const roomArenaSync = useArenaRoomSync({
    roomContext,
    saveId,
    seasonId,
    matchdayId,
    onApplyRevealSync: (normalized: RoomArenaState) => {
      // Diszi-Sync: die vom Host gewählte Seite auf die lokale Disziplin mappen.
      const phase = normalized.activeDisciplinePhase;
      const targetDiscId =
        phase === "d1" ? matchdayPanel?.d1?.disciplineId ?? null : phase === "d2" ? matchdayPanel?.d2?.disciplineId ?? null : null;
      if (targetDiscId && targetDiscId !== disciplineId) {
        setDisciplineId(targetDiscId);
      }
      // Reveal-Schritt: Host-slotRevealIndex → lokaler Zielround (Guest zieht nach).
      setSyncedRound(normalized.slotRevealIndex);
    },
  });
  /**
   * Start-Gate: In die Arena darf der Host jederzeit wechseln — losgehen darf es aber erst,
   * wenn JEDES Team der Liga bereit ist (Aufstellung gespeichert + Formkarten geklärt).
   * KI-Teams erfüllen das automatisch, sobald ihre Aufstellung generiert ist; es braucht
   * dafür keinen Sonderweg, `getMatchdayLeagueLineupReadiness` prüft alle Teams gleich.
   */
  const leagueLineupReadiness = useMemo(() => getMatchdayLeagueLineupReadiness(gameState), [gameState]);
  const arenaStartBlockedByLineups = !leagueLineupReadiness.allReady;

  // Host meldet den Sync einmalig an, sobald die Preview steht (idle → running).
  useEffect(() => {
    if (!roomContext || !roomArenaSync.isRoomHost || !preview) return;
    if ((roomArenaSync.roomArenaSyncState?.status ?? "idle") !== "idle") return;
    // Solange noch Teams offen sind, wird der Reveal NICHT gestartet. Der Effekt läuft
    // erneut, sobald ein Team fertig meldet (gameState → leagueLineupReadiness ändert sich).
    if (arenaStartBlockedByLineups) return;
    roomArenaSync.emitStartRoomArena({
      seasonId: seasonId ?? null,
      matchdayId: matchdayId ?? null,
      disciplineSide: activeDisciplineSide,
      maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 },
    });
  }, [roomContext, roomArenaSync, preview, seasonId, matchdayId, activeDisciplineSide, arenaStartBlockedByLineups]);
  // Prop-Bündel für die NativeArena (nur im Room aktiv; solo bleibt alles inert).
  const nativeRoomSync = roomContext
    ? {
        active: roomArenaSync.isRoomRevealSyncActive,
        isHost: roomArenaSync.isRoomHost,
        canControl: roomArenaSync.canControlArenaReveal,
        waitingForHost: roomArenaSync.roomRevealWaitingForHost,
        followsHost: roomArenaSync.roomRevealFollowsHost,
        syncedRound,
        onHostAdvanced: () => roomArenaSync.emitHostRoomArenaAdvance({ d1: 0, d2: 0 }),
        coopGate: {
          active: roomArenaSync.arenaCoopReadyGateActive,
          isSelfReady: roomArenaSync.isSelfArenaReady,
          waitingNames: roomArenaSync.arenaCoopWaitingNames,
          onToggleReady: roomArenaSync.emitArenaCoopReadyToggle,
        },
      }
    : null;

  // Engine-Teams für die gewählte Disziplin (nur wenn sie an diesem Spieltag läuft).
  /**
   * Bahnen aus ECHTEN Daten — Vorschau bevorzugt, sonst das gebuchte Ergebnis.
   *
   * GEMELDET VON CHRIS: Die Bühne zeigte für S-C in der Staffel Tahra (+40,7) und Chad (+40,2),
   * Rang 28 mit 80,9 Pkt. Gebucht waren Spineshard (29,3) und Myrth (9,9), Rang 31 mit 47,8 —
   * Tahra stand an dem Spieltag nicht einmal in der Aufstellung, Chad lief in Takeshi. Dasselbe
   * bei V-D, wo die Bühne Queen Butterfly an die Spitze stellte und das Team in Wahrheit Vierter
   * wurde.
   *
   * Ursache war der stille Rückfall auf `buildDisciplineStageModel`: das Modell liest die
   * Aufstellung nicht, es sucht sich pro Team selbst die stärksten Spieler. Am gemeldeten
   * Spielstand nachgerechnet wählt es für S-C in der Staffel genau Tahra (41,7) und Chad (41,2).
   * Als Vorschau ist das richtig — als Ergebnis-Anzeige erfindet es Tatsachen.
   *
   * Deshalb gibt es jetzt eine zweite echte Quelle: ist die Disziplin gewertet, kommen die Bahnen
   * aus `disciplineResults` + `playerDisciplinePerformances`. Das Modell bleibt dem Test-/
   * Random-Modus vorbehalten.
   *
   * NACHTRAG (gemessen, nicht vermutet): „Vorschau bevorzugt" war zu weit gefasst. Die Vorschau
   * kann aus einem verfallenen Resolve-Snapshot stammen — am Spielstand
   * `new-game-1785823388048-1hf25q` (S2, Spieltag 10) zeigte sie in 20 von 32 d1-Zeilen einen
   * anderen Score als gebucht (max 0,70). Deshalb entscheidet jetzt
   * `chooseDisciplineStageTeams`: die Vorschau gilt, solange sie das gebuchte Ergebnis TRIFFT
   * (Score < 0,05, Rang exakt) — sonst gewinnt das Gebuchte. Lieber die karge Wahrheit als eine
   * huebschere Zahl, die nie im Saisonstand stand.
   */
  const engineTeams = useMemo(() => {
    const disc = preview?.disciplinePreviews.find((d) => d.disciplineId === disciplineId);
    const previewTeams =
      disc && disc.teamResults.length > 0
        ? buildDisciplineStageTeamsFromPreview(disc, teamMetaById, portraitById)
        : null;
    const bookedTeams = buildDisciplineStageTeamsFromBookedResult(
      gameState,
      disciplineId,
      teamMetaById,
      portraitById,
    );
    return chooseDisciplineStageTeams({ previewTeams, bookedTeams }).teams;
  }, [preview, disciplineId, teamMetaById, portraitById, gameState]);

  // Echt-Modus nutzt IMMER echte Daten. Fehlen sie, wird nichts erfunden — siehe
  // `realDataMissing` unten, das statt der Bühne eine ehrliche Meldung zeigt.
  const useEngine = mode === "real" && engineTeams !== null;
  /**
   * Echt-Modus ohne echte Daten. Vorher lief die Bühne hier mit dem Modell weiter und sah aus wie
   * ein Ergebnis; jetzt ist der Zustand benannt und wird angezeigt statt kaschiert.
   */
  const realDataMissing = mode === "real" && engineTeams === null;

  // Random-Test: 2 Mutator-Traits werden für die Disziplin bestimmt.
  const mutatorTraits = useMemo(
    () => (mode === "random" ? pickMutatorTraits(seed + hashStr(disciplineId)) : []),
    [mode, seed, disciplineId],
  );

  // Anzuzeigende 2 Mutatoren dieser Disziplin: primär aus der echten Engine-
  // Preview, sonst die Test-/Random-Traits — damit die Mutatoren in JEDER
  // Disziplin sichtbar sind und nicht fehlen.
  const shownMutators = disciplineMutators.length > 0 ? disciplineMutators : mutatorTraits;

  // Top-Spieler (links): aus der Engine-Preview oder — im Test/Modell-Modus —
  // die besten Netto-Werte über alle Teams.
  const topPlayers = useMemo(() => {
    // Gebaut als (Zeile + playerId)-Paare, damit die IDs beim Umsortieren
    // ausgerichtet bleiben. Sortierung: erhaltene Player-Points (PP) absteigend,
    // Tiebreak beigetragener Score absteigend (Wunsch: "sortiert nach den PPs …
    // in Klammern dahinter ihr Score").
    const entries: { row: DisciplineStageTopPlayer; id: string | null }[] = [];
    if (useEngine && engineDiscipline) {
      engineDiscipline.topPlayers.forEach((pp) => {
        const meta = teamMetaById.get(pp.teamId);
        entries.push({
          id: pp.playerId,
          row: {
            rank: 0,
            name: pp.playerName,
            teamCode: meta?.code ?? pp.teamId,
            logoUrl: meta?.logoUrl ?? null,
            portraitUrl: portraitById.get(pp.playerId) ?? null,
            score: pp.finalPlayerScore,
            // Gutgeschriebene PP = Team-Anteil + Mutator-Aufschlag (die Zahl, die der
            // Saison-Ledger bucht). `pointsAwarded` allein unterschlaegt den Aufschlag.
            points: resolveAwardedPlayerPoints({
              pointsAwarded: pp.pointsAwarded,
              mutatorPpsBonus: pp.mutatorPpsBonus,
            }),
            mutatorPoints: pp.mutatorPpsBonus ?? null,
            isMvp: Boolean(pp.isMvpCandidate),
            isOwn: pp.teamId === ownTeamId,
            ovrRank: ratingByPlayerId.get(pp.playerId)?.ovrRank ?? null,
          },
        });
      });
    } else {
      model.teams.forEach((t) => {
        t.slots.forEach((s) => {
          entries.push({
            id: s.playerId,
            row: {
              rank: 0,
              name: s.playerName,
              teamCode: t.shortCode,
              logoUrl: t.logoUrl,
              portraitUrl: s.portraitUrl,
              score: s.net,
              points: null,
              mutatorPoints: null,
              isMvp: s.base >= 80,
              isOwn: t.isOwn,
              ovrRank: s.playerId ? ratingByPlayerId.get(s.playerId)?.ovrRank ?? null : null,
            },
          });
        });
      });
    }
    entries.sort((a, b) => (b.row.points ?? -1) - (a.row.points ?? -1) || b.row.score - a.row.score);
    // Dieselbe Zahl wie die summierte Spieltags-Liste — sonst zeigte die eine Ansicht mehr
    // Spieler als die andere. Chris: „nicht nur die top 12 sondern Top 24".
    const top = entries.slice(0, SPIELTAGS_TOPSPIELER_LIMIT);
    top.forEach((e, i) => {
      e.row.rank = i + 1;
    });
    return { rows: top.map((e) => e.row), ids: top.map((e) => e.id) };
  }, [useEngine, engineDiscipline, model, teamMetaById, portraitById, ownTeamId, ratingByPlayerId]);

  // Player-Points je Spieler für die Hover-Karte. Bewusst aus der VOLLEN Engine-Liste
  // (nicht aus der auf 12 gekürzten Top-Spieler-Tabelle), damit der Hover auch für
  // Spieler außerhalb der Top-12 die PP zeigt — im Hover steht sonst nur der Score,
  // und die eigentliche Währung der Disziplin (PP) fehlte genau dort.
  const ppByPlayerId = useMemo(() => {
    // `mutatorPp` kommt mit: ohne ihn steht in der Karte eine PP-Zahl, deren Zustandekommen
    // niemand nachvollziehen kann — zwei Spieler mit aehnlichem Score koennen sehr
    // unterschiedliche PP haben, wenn einer die Disziplin-Mutatoren traf und der andere nicht.
    const map = new Map<string, { pp: number | null; score: number; mutatorPp: number | null }>();
    if (!useEngine || !engineDiscipline) return map;
    for (const entry of engineDiscipline.topPlayers) {
      if (!entry.playerId) continue;
      map.set(entry.playerId, {
        pp: entry.pointsAwarded ?? null,
        score: entry.finalPlayerScore,
        mutatorPp: entry.mutatorPpsBonus ?? null,
      });
    }
    return map;
  }, [useEngine, engineDiscipline]);

  const ownShortCode = useMemo(() => {
    const own = (gameState?.teams ?? []).find((t) => t.teamId === ownTeamId);
    return own?.shortCode ?? model.teams.find((t) => t.isOwn)?.shortCode ?? null;
  }, [gameState?.teams, ownTeamId, model.teams]);

  // Freund/Feind-Kodierung (mine/ally/rival) — einmal memoisiert, O(1)-Lookup je
  // Team-Token/Ladder-Zeile in der nativen Arena. Rein presentational (Rahmenfarbe).
  const teamRelationshipMap = useMemo(
    () =>
      buildTeamRelationshipMap(
        { teams: gameState?.teams ?? [], teamControlSettings: gameState.seasonState?.teamControlSettings ?? {} },
        ownTeamId,
      ),
    [gameState?.teams, gameState.seasonState?.teamControlSettings, ownTeamId],
  );

  // A3: welche Disziplinen dieses Spieltags bereits einmal zu Ende gelaufen sind —
  // ANDERS als `arenaEnded` (das bei jedem Disziplin-Wechsel zurückgesetzt wird)
  // bleibt dieser Satz beim Hin- und Herwechseln zwischen Disziplinen erhalten, damit
  // eine bereits abgeschlossene Disziplin nicht wieder hinter dem 🔒 verschwindet.
  // Nur ein Spieltagswechsel setzt ihn zurück.
  const [endedDisciplineIds, setEndedDisciplineIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setEndedDisciplineIds(new Set());
  }, [matchdayId]);

  /**
   * Aufdeck-Stand der Spieltags-Wertung — als benannte Konstanten, weil daran jetzt
   * auch hängt, OB die Wertung überhaupt als Tabelle rendert (S3/Muster 3): vor dem
   * ersten gewerteten Ergebnis gibt es keine Zeilen, keine Rangzahlen und keine
   * Medaillen-Optik, sondern den erklärenden Platzhalter (VeloPendingRanking).
   */
  // Eine im SAVE gebuchte Seite ist aufgedeckt — unabhängig vom Session-Zustand.
  // Das ist kein Spoiler: die Wertung steht bereits im Saisonstand. Ohne diese
  // Klausel zeigte die Arena nach einem Reload mitten im Spieltag („D1 gebucht,
  // D2 offen") wieder „Wertung folgt", als wäre nichts gelaufen.
  const panelD1Revealed = Boolean(
    matchdayPanel &&
      (scoringProgress?.d1.scored ||
        Boolean(matchdayPanel.d1?.disciplineId && endedDisciplineIds.has(matchdayPanel.d1.disciplineId)) ||
        (matchdayPanel.d2?.disciplineId === disciplineId &&
          matchdayPanel.teamResults.some((row) => row.d1Points != null))),
  );
  /**
   * D2 SPIEGELT D1 — die Zusatzbedingung `d2.disciplineId === disciplineId` ist WEG.
   *
   * Sie machte den Aufdeck-Stand davon abhängig, welche Disziplin gerade im Dropdown steht: wer
   * D2 zu Ende gespielt und danach zu D1 zurückgeschaltet hat, sah D2 wieder verdeckt — und die
   * Topspieler-Liste darunter fiel damit auf die EINE Disziplin zurück, genau das von Chris
   * gemeldete Bild. Ein Spoiler war die Klausel nie: `endedDisciplineIds` enthält D2 erst,
   * NACHDEM D2 in dieser Sitzung durchgelaufen ist. Was gelaufen ist, bleibt gelaufen — dieselbe
   * Zusage, die `panelD1Revealed` schon immer gab.
   */
  const panelD2Revealed = Boolean(
    matchdayPanel &&
      (scoringProgress?.d2.scored ||
        Boolean(matchdayPanel.d2?.disciplineId && endedDisciplineIds.has(matchdayPanel.d2.disciplineId))),
  );

  /**
   * TOP-SPIELER DES GANZEN SPIELTAGS — beide Disziplinen zusammengerechnet.
   *
   * GEMELDET VON CHRIS: „die top player unten unter der spieltagstabelle sollen die für den gesamten
   * spieltag sein! also beides zusammen."
   *
   * URSACHE: `topPlayers` weiter oben liest `engineDiscipline.topPlayers` — und `engineDiscipline`
   * ist die EINE gerade laufende Disziplin (`preview.disciplinePreviews.find(d => d.disciplineId ===
   * disciplineId)`). Unter der Spieltags-Wertung, die beide Disziplinen zusammenfasst, stand damit
   * eine Spielerliste aus nur einer Hälfte. Wer in D1 überragend war und in D2 nicht mitmachte,
   * verschwand nach dem Wechsel spurlos.
   *
   * AUFGEDECKT WIRD NUR, WAS AUFGEDECKT IST: die Liste zieht ausschliesslich die Disziplinen heran,
   * die `panelD1Revealed`/`panelD2Revealed` freigeben — dieselbe Regel, gegen die auch die
   * Spieltags-Wertung darüber rechnet. Während D1 läuft, stehen hier nur D1-Spieler; D2 kommt dazu,
   * sobald D2 gewertet ist. Eine Liste, die D2 vorwegnimmt, wäre ein Spoiler.
   *
   * SUMMIERT, nicht aneinandergehängt: ein Spieler, der in beiden Disziplinen antrat, steht EINMAL
   * da, mit der Summe seiner Player-Points und Scores. Der Mutator-Aufschlag summiert sich mit.
   *
   * GERECHNET WIRD NICHT HIER, sondern in `discipline-stage-matchday-top-players.ts` — und zwar
   * an EINER Stelle für beide Quellen. Das ist der Unterschied zu vorher: die Liste hing an der
   * Resolve-Vorschau, und die wird für einen fertig gebuchten Spieltag NEU gerechnet (der
   * Snapshot gilt dann bewusst nicht mehr, `readMatchdayResolveSnapshot`). Am Live-Abbild
   * gemessen (Saison 2, Spieltag 10) wichen dadurch 285 von 286 Spieler-Scores und 227 von 286
   * Player-Points vom Gebuchten ab, und 4 der 12 angezeigten Namen standen dort zu Unrecht.
   * Jetzt gilt je Disziplin das Gebuchte, sobald es gebucht ist; die laufende Disziplin kommt
   * weiterhin aus der Vorschau.
   */
  /**
   * Der Saison-Ledger — die Stelle, die die gebuchten Player-Points ableitet. Eigenes Memo, weil
   * er sonst bei jedem Aufdeck-Wechsel neu über alle Leistungszeilen der Saison liefe.
   */
  const seasonPointsLedger = useMemo(() => {
    if (!seasonId) return null;
    try {
      return buildSeasonPointsLedger(gameState, seasonId);
    } catch {
      // Lässt sich zu einer Leistungszeile kein Punktwert ableiten, wirft der Ledger. Dann bleibt
      // es bei der Vorschau — eine kargere Liste ist besser als eine leere Bühne.
      return null;
    }
  }, [gameState, seasonId]);

  /**
   * VERLETZUNGS-MARKEN DER SPIELTAGS-WERTUNG (Wunsch von Chris).
   *
   * Kein Spoiler und deshalb NICHT an `panelD1Revealed`/`panelD2Revealed` gehängt: die Marke sagt
   * nichts über Punkte oder Reihenfolge, sondern nur, dass es dieses Team an diesem Spieltag
   * erwischt hat. Die Buchung dazu steht ohnehin schon im Spielstand.
   */
  const matchdayInjuryMarks = useMemo(
    () => (seasonId && matchdayId ? buildMatchdayInjuryMarks(gameState, { seasonId, matchdayId }) : null),
    [gameState, seasonId, matchdayId],
  );

  const matchdayTopPlayers = useMemo(() => {
    if (!useEngine) return null;
    const revealedIds = new Set<string>();
    // Die NAMEN der aufgedeckten Seiten wandern mit — sie stehen in der Ueberschrift der Liste,
    // damit der summierten PP-Zahl anzusehen ist, worueber summiert wurde.
    const revealedNames: string[] = [];
    if (panelD1Revealed && matchdayPanel?.d1?.disciplineId) {
      revealedIds.add(matchdayPanel.d1.disciplineId);
      revealedNames.push(matchdayPanel.d1.displayName || matchdayPanel.d1.disciplineId);
    }
    if (panelD2Revealed && matchdayPanel?.d2?.disciplineId) {
      revealedIds.add(matchdayPanel.d2.disciplineId);
      revealedNames.push(matchdayPanel.d2.displayName || matchdayPanel.d2.disciplineId);
    }
    if (revealedIds.size === 0) return null;

    const buchungsZeilen =
      seasonId && matchdayId
        ? spieltagsTopSpielerAusBuchung({ gameState, seasonId, matchdayId, ledger: seasonPointsLedger })
        : [];
    const { zeilen } = waehleSpieltagsTopSpielerZeilen({
      vorschauZeilen: spieltagsTopSpielerAusVorschau(preview?.disciplinePreviews),
      buchungsZeilen,
    });
    if (zeilen.length === 0) return null;

    const summiert = summiereSpieltagsTopSpieler(zeilen, revealedIds);
    if (summiert.length === 0) return null;

    return {
      rows: summiert.map((eintrag, index): DisciplineStageTopPlayer => {
        const meta = teamMetaById.get(eintrag.teamId);
        return {
          rank: index + 1,
          name: eintrag.playerName,
          teamCode: meta?.code ?? eintrag.teamId,
          logoUrl: meta?.logoUrl ?? null,
          portraitUrl: portraitById.get(eintrag.playerId) ?? null,
          score: eintrag.score,
          points: eintrag.points,
          mutatorPoints: eintrag.mutatorPoints,
          isMvp: eintrag.isMvp,
          isOwn: eintrag.teamId === ownTeamId,
          ovrRank: ratingByPlayerId.get(eintrag.playerId)?.ovrRank ?? null,
        };
      }),
      ids: summiert.map((eintrag) => eintrag.playerId as string | null),
      disciplineNames: revealedNames,
    };
  }, [
    useEngine,
    preview,
    panelD1Revealed,
    panelD2Revealed,
    matchdayPanel,
    teamMetaById,
    portraitById,
    ownTeamId,
    ratingByPlayerId,
    gameState,
    seasonId,
    matchdayId,
    seasonPointsLedger,
  ]);

  /**
   * S3 · Expliziter Pre-Matchday-Zustand („vor dem Anpfiff").
   *
   * Erkennung aus ECHTEN Daten, nicht aus UI-Zustand geraten:
   * - `arenaStartBlockedByLineups`: mindestens ein Team der Liga ist nicht bereit
   *   (Aufstellung fehlt/unvollständig/nicht abgeschickt oder Formkarten offen) —
   *   die Bühne DARF also noch gar nicht loslaufen.
   * - `hasCurrentMatchdayResult`: für diesen Spieltag ist noch nichts gebucht
   *   (auch kein halber Spieltag nach Disziplin 1).
   * - `endedDisciplineIds` leer: in dieser Sitzung ist noch keine Disziplin gelaufen.
   *
   * Nur wenn ALLE drei zutreffen, ersetzt der Pre-Matchday-Screen die Bühne. Der
   * Dev-/Test-Modus behält die rohe Bühne (Admin will die Disziplinen frei sehen).
   */
  const matchdayHasBookedResult = useMemo(() => hasCurrentMatchdayResult(gameState), [gameState]);
  /**
   * GEMELDET VON CHRIS: „diese infotafel vor dem spieltag kommt glaub ich nur beim ersten spieltag
   * danach nie wieder gesehen."
   *
   * Stimmte. In der Bedingung stand `arenaStartBlockedByLineups` — also „mindestens ein Team der
   * Liga ist noch nicht bereit". Damit war die Tafel kein Vorspiel-Bildschirm, sondern ein
   * BLOCKADE-Bildschirm: sie erschien nur, solange jemand trödelte. Am ersten Spieltag fehlten
   * noch Aufstellungen, ab dem zweiten hatten alle 32 Teams ihre fertig — und die Tafel war weg,
   * obwohl ihre Überschrift „Vor dem Anpfiff" lautet und der Kommentar sie als „expliziten
   * Pre-Matchday-Zustand" beschreibt. Bedingung und Absicht liefen auseinander.
   *
   * Jetzt zählt nur noch, ob der Spieltag WIRKLICH noch nicht begonnen hat: nichts gebucht, keine
   * Disziplin gelaufen. Weil die Tafel damit auch dann kommt, wenn alle bereit sind, hat sie einen
   * Weg nach vorn bekommen (`onStartStage` unten) — vorher war sie eine Sackgasse mit dem einzigen
   * Ausgang „Einsatzliste öffnen", was genügte, solange sie nur bei Blockaden erschien.
   */
  const preMatchdayReady = !arenaStartBlockedByLineups;
  const showPreMatchday =
    mode === "real" &&
    !devMode &&
    !preMatchdayDismissed &&
    !matchdayHasBookedResult &&
    endedDisciplineIds.size === 0;

  // Eigene Startbereitschaft (nur fürs eigene Team — Fog of War bleibt gewahrt,
  // von fremden Teams ist nur der Bereit-Status sichtbar, keine Aufstellung).
  const ownArenaReadiness = useMemo(
    () => (ownTeamId ? getMatchdayArenaReadiness(gameState, ownTeamId) : null),
    [gameState, ownTeamId],
  );
  const ownLineupSideCounts = useMemo(
    () => getLineupDraftSideCounts(ownTeamId ? getTeamMatchdayLineupDraft(gameState, ownTeamId)?.entries ?? [] : []),
    [gameState, ownTeamId],
  );
  const ownRosterCount = useMemo(
    () => (ownTeamId ? getTeamRosterPlayerIds(gameState, ownTeamId).length : 0),
    [gameState, ownTeamId],
  );

  // „Dein Umfeld": Saisonrang + Punkte aus der EINEN kanonischen Quelle
  // (seasonState.standings — dieselbe wie Home-KPI, Saisonstand und Bahn-Reihenfolge).
  // Vor dem ersten gewerteten Spieltag sind die Ränge die Startplätze der Vorsaison —
  // das steht als Erklärung dran, statt eine frische Wertung zu suggerieren.
  const preMatchContext = useMemo(() => {
    const standings = gameState.seasonState?.standings ?? {};
    const anyPoints = Object.values(standings).some((row) => ((row as { points?: number | null })?.points ?? 0) > 0);
    const rows = (gameState.teams ?? [])
      .filter((team) => {
        const relation = teamRelationshipMap.get(team.teamId);
        return team.teamId === ownTeamId || relation === "rival" || relation === "ally";
      })
      .map((team) => {
        const entry = standings[team.teamId] as { rank?: number | null; points?: number | null } | undefined;
        return {
          teamId: team.teamId,
          name: team.name,
          code: team.shortCode,
          rank: typeof entry?.rank === "number" && Number.isFinite(entry.rank) ? entry.rank : null,
          points: entry?.points ?? null,
          relation: team.teamId === ownTeamId ? ("mine" as const) : teamRelationshipMap.get(team.teamId) ?? null,
        };
      })
      .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999) || left.name.localeCompare(right.name, "de-DE"));
    return { anyPoints, rows };
  }, [gameState.seasonState?.standings, gameState.teams, teamRelationshipMap, ownTeamId]);

  // Mutatoren je Spieltags-Seite (aus der Resolve-Preview; fehlt sie, bleibt die
  // Zeile weg — keine erfundenen Chips).
  const preMatchMutatorsBySide = useMemo(() => {
    const mutatorsFor = (disciplineIdForSide: string | null | undefined): string[] => {
      if (!disciplineIdForSide || !preview) return [];
      const dp = preview.disciplinePreviews.find((entry) => entry.disciplineId === disciplineIdForSide);
      const slots = dp?.teamResults?.[0]?.mutatorSlots ?? [];
      return slots.map((slot) => slot.label).filter((label): label is string => Boolean(label && label.trim()));
    };
    return {
      d1: mutatorsFor(matchdaySides.d1?.disciplineId),
      d2: mutatorsFor(matchdaySides.d2?.disciplineId),
    };
  }, [preview, matchdaySides]);

  // Spieltags-Label ohne rohe IDs (F5): „Spieltag N" aus der Saisonzählung,
  // notfalls aus der Slug-Nummer — nie der nackte Bezeichner.
  const matchdayNumberLabel = useMemo(() => {
    const current = (gameState.season as { currentMatchday?: number | null } | undefined)?.currentMatchday;
    if (typeof current === "number" && Number.isFinite(current)) return `Spieltag ${current}`;
    const slug = String(matchdayId ?? gameState.matchdayState?.matchdayId ?? "").match(/(\d+)\s*$/);
    return slug ? `Spieltag ${slug[1]}` : "Spieltag";
  }, [gameState.season, gameState.matchdayState?.matchdayId, matchdayId]);

  const payload = useMemo(() => {
    // Echter Season-Tabellenrang je Team → Bahn-/Turm-Reihenfolge in der Arena
    // (bester Saisonstand = Slot 1 oben, schlechtester = Slot 32 unten).
    // ROBUST: StandingRecord.rank ist optional (kann null sein, während points steht).
    // War rank null, fiel seasonRank auf undefined → die Arena nutzte dann die Team-
    // Array-Reihenfolge (nach Stärke/Ergebnis) → perfekte Diagonale („Sieger immer oben").
    // Deshalb den Rang notfalls aus den points ableiten, damit die Bahn IMMER dem
    // Saisonstand folgt (und das Disziplin-Ergebnis quer über die Bahnen streut).
    const standings = gameState.seasonState?.standings;
    const seasonRankByTeam = new Map<string, number>();
    if (standings) {
      const rows = Object.entries(standings);
      const missingRank = rows.some(([, r]) => r.rank == null);
      if (missingRank) {
        rows
          .slice()
          .sort((a, b) => (b[1].points ?? 0) - (a[1].points ?? 0) || a[0].localeCompare(b[0]))
          .forEach(([tid], i) => seasonRankByTeam.set(tid, i + 1));
      } else {
        rows.forEach(([tid, r]) => seasonRankByTeam.set(tid, r.rank as number));
      }
    }
    // Nach Disziplin 1 startet Disziplin 2 in der AKTUALISIERTEN Reihenfolge: Bahn 1
    // gehört dem Team, das an diesem Spieltag bisher am meisten geholt hat. Der
    // Saisonstand allein reicht dafür nicht — Punkte landen erst beim Spieltags-
    // abschluss in `standings`, an Spieltag 1 stünden also alle auf 0 und Disziplin 2
    // liefe in derselben Reihenfolge wie Disziplin 1. Die bereits gelaufenen d1-Punkte
    // stehen in der Preview (`matchdayPanel.teamResults`) und werden hier auf den
    // Saisonstand addiert. Greift nur, wenn d1 wirklich durchgelaufen ist (sonst wäre
    // es ein Spoiler) und die offene Disziplin nicht mehr d1 selbst ist.
    const d1Id = matchdayPanel?.d1?.disciplineId ?? null;
    const d1Done = Boolean(d1Id && endedDisciplineIds.has(d1Id) && disciplineId !== d1Id);
    if (d1Done && matchdayPanel) {
      const livePoints = new Map<string, number>();
      for (const row of matchdayPanel.teamResults) {
        const seasonPoints = standings?.[row.teamId]?.points ?? 0;
        livePoints.set(row.teamId, seasonPoints + (row.d1Points ?? 0));
      }
      if (livePoints.size > 0) {
        [...livePoints.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .forEach(([teamId], index) => seasonRankByTeam.set(teamId, index + 1));
      }
    }
    const seasonRankOf = (teamId?: string | null): number | undefined =>
      teamId != null ? seasonRankByTeam.get(teamId) : undefined;
    const teams = useEngine
      ? engineTeams!.map((t) => ({
          code: t.code,
          name: t.name,
          logoUrl: t.logoUrl,
          teamId: t.teamId,
          seasonRank: seasonRankOf(t.teamId),
          // A2: Engine-Flag „keine Aufstellung eingereicht" 1:1 durchreichen, sonst
          // erscheint das Team als normales 0-Punkte-Ergebnis (falscher Eindruck).
          missingLineup: t.missingLineup,
          // Kapitän dieser Einsatzliste (falls gesetzt) → Stern am Wappen in der Arena.
          captainName: t.captainName,
          // Engine-Modus: Netto = val + Σmods trägt bereits die volle Engine-Zerlegung.
          players: t.players.map((p) => ({
            playerId: p.playerId,
            val: p.val,
            name: p.name,
            portraitUrl: p.portraitUrl,
            traits: [] as string[],
            mods: p.mods,
            pointsAwarded: p.pointsAwarded,
            ovrRank: p.playerId ? ratingByPlayerId.get(p.playerId)?.ovrRank ?? null : null,
          })),
        }))
      : model.teams.map((t) => ({
          code: t.shortCode,
          name: t.name,
          logoUrl: t.logoUrl,
          teamId: t.teamId,
          seasonRank: seasonRankOf(t.teamId),
          // Modell-/Random-Modus rechnet ohne Engine-Preview → kein missingLineup-Konzept.
          missingLineup: false,
          // Ohne Engine-Preview gibt es auch keine Einsatzliste → kein Kapitän.
          captainName: null as string | null,
          players: t.slots.map((s) => ({
            playerId: s.playerId,
            val: s.base,
            name: s.playerName,
            portraitUrl: s.portraitUrl,
            traits: s.traits,
            // Real-Modus: echte Fatigue/Form-Mods. Random-Test: dieselben echten
            // Mods PLUS die Trait-Mutatoren (+6 je passendem Trait), damit
            // Fatigue/Form + Mutatoren als sichtbare Deltas im Feld landen —
            // nativeTeams liest ausschließlich p.mods (SHOULD-1, Variante a).
            mods: mode === "real" ? realMods(s) : [...realMods(s), ...traitMutatorMods(s.traits, mutatorTraits)],
            pointsAwarded: null as number | null,
            ovrRank: s.playerId ? ratingByPlayerId.get(s.playerId)?.ovrRank ?? null : null,
          })),
        }));
    /**
     * Etappenzahl = die tatsaechlich aufgestellte Spielerzahl (Maximum ueber die
     * Teams), NICHT die von der Disziplin geforderte.
     *
     * Vorher stand hier im Modell-Modus schlicht `model.slotCount`, und das ist
     * `discipline.playerCount` — also die ANFORDERUNG. Stellt ein Spieltag in
     * dieser Disziplin weniger Spieler als gefordert (kommt bei Staffel und
     * Takeshi vor), liefen trotzdem so viele Etappen wie gefordert: in den
     * ueberzaehligen Etappen ist `players[r]` schlicht `undefined`, es wird
     * nichts addiert und im Feld bewegt sich nichts. Gleichzeitig ist die
     * Ziellinie der Endstand des besten Teams ueber DESSEN Spieler — der war
     * nach der letzten echten Etappe erreicht. Ergebnis: "Ziel nach 3 von 5
     * Etappen erreicht, danach passiert nichts mehr".
     *
     * Das Maximum (statt Minimum) ist richtig, weil Teams unterschiedlich viele
     * Spieler haben duerfen — ein Team mit mehr Spielern muss seine auch alle
     * zeigen duerfen. Der Fallback greift nur, wenn gar keine Spieler vorliegen.
     */
    const slotCount = Math.max(
      1,
      teams.reduce((max, team) => Math.max(max, team.players.length), 0) || model.slotCount,
    );
    return {
      slots: Array.from({ length: slotCount }, (_, i) => slotLabel(disciplineId, i, slotCount)),
      mineCode: ownShortCode,
      // ANTI-SPOILER: beide Quellen oben liefern nach ERGEBNIS sortiert (Engine:
      // rankDescendingSharedTies nach score, Modell: b.total - a.total). Ohne diese
      // Umsortierung stünde der Sieger oben, bevor die erste Etappe läuft — Begründung
      // und Randfälle stehen im Helfer.
      teams: orderStageTeamsBySeasonRank(teams),
    };
  }, [
    useEngine,
    engineTeams,
    model,
    mode,
    disciplineId,
    mutatorTraits,
    ownShortCode,
    gameState.seasonState?.standings,
    // Neuordnung der Bahnen nach Disziplin 1 — ohne diese Deps bliebe die
    // Reihenfolge auf dem Stand von vor dem d1-Abschluss stehen.
    matchdayPanel,
    endedDisciplineIds,
    ratingByPlayerId,
  ]);

  // Betroffene Spieler (≥1 Trait-Treffer) für die Player-Points-Anzeige (+0,3 PP je).
  const mutatorImpact = useMemo(() => {
    if (mode !== "random" || mutatorTraits.length === 0) {
      return { affected: 0, entries: [] as { name: string; code: string; hits: number }[] };
    }
    const entries: { name: string; code: string; hits: number }[] = [];
    for (const t of model.teams) {
      for (const s of t.slots) {
        const hits = traitMutatorMods(s.traits, mutatorTraits).length;
        if (hits > 0) {
          entries.push({ name: s.playerName, code: t.shortCode, hits });
        }
      }
    }
    return { affected: entries.length, entries };
  }, [model, mode, mutatorTraits]);

  // Stabile teams-Identität für die native Arena. WICHTIG (B1): früher wurde das
  // Array inline im JSX gemappt → bei jedem Parent-Render (Drawer/Hover) eine neue
  // Identität → der `[teams]`-Reset-Effekt der Arena feuerte und warf die laufende
  // Sim auf Runde 0 zurück. payload ist memoisiert, also ändert sich nativeTeams nur,
  // wenn sich die echten Daten ändern (Disziplin/Modus/Seed) — nicht bei UI-State.
  const nativeTeams = useMemo(
    () =>
      payload.teams.map((t) => ({
        code: t.code,
        name: t.name,
        logoUrl: t.logoUrl,
        isOwn: t.code === payload.mineCode,
        teamId: t.teamId,
        rel: t.teamId ? teamRelationshipMap.get(t.teamId) ?? null : null,
        seasonRank: t.seasonRank,
        missingLineup: t.missingLineup,
        captainName: t.captainName,
        players: t.players.map((p) => ({
          playerId: p.playerId,
          val: p.val,
          name: p.name,
          portraitUrl: p.portraitUrl,
          mods: p.mods,
          pointsAwarded: p.pointsAwarded,
        })),
      })),
    [payload, teamRelationshipMap],
  );

  // Bug bug-2026-08-04T15-59-37-826Z-2tlf67: "Bilder in Hovers/Team-Karte sollen
  // schon geladen sein, waehrend die Diszi laeuft, damit der Drawer beim Oeffnen
  // nicht nachlaedt". nativeTeams traegt exakt die Portraits/Logos der Teams, die
  // in DIESER Disziplin antreten (≤32 Teams × Disziplin-Slotzahl) — dieselben URLs,
  // die Drawer/Hover ohnehin ueber getPlayerPortraitBrowserUrl/getTeamLogoBrowserUrl
  // anfordern wuerden. Kein zusaetzliches Datenvolumen, nur ein frueherer Zeitpunkt
  // (Idle-Slot statt Klick-Zeitpunkt) — siehe prefetchDisciplineStageMedia.
  useEffect(() => {
    if (!saveId || !seasonId || !matchdayId || nativeTeams.length === 0) {
      return;
    }
    const urls: (string | null | undefined)[] = [];
    for (const team of nativeTeams) {
      urls.push(team.logoUrl);
      for (const player of team.players) {
        urls.push(player.portraitUrl);
      }
    }
    prefetchDisciplineStageMedia({
      sessionKey: `${saveId}:${matchdayId}:${disciplineId}`,
      urls,
    });
  }, [saveId, seasonId, matchdayId, disciplineId, nativeTeams]);

  // Gefeldete Spieler je Team (aus dem Arena-Payload) — treibt im Drawer die
  // Team-Sektion „In dieser Disziplin", auch im Test/Vorschau-Modus, wo keine
  // lineupDrafts existieren. teamId kann null sein → überspringen.
  const fieldedByTeam = useMemo(
    () =>
      Object.fromEntries(
        payload.teams
          .filter((t) => Boolean(t.teamId))
          .map((t) => [
            t.teamId as string,
            t.players.map((p) => p.playerId).filter((id): id is string => Boolean(id)),
          ]),
      ),
    [payload],
  );

  /**
   * Gefeldete Spieler „kleben" bis zum Disziplinwechsel.
   *
   * Am Ende einer Disziplin lief die Quelle oben leer (der Spieltags-Draft wird beim
   * Anwenden des Ergebnisses konsumiert, und die Preview liefert für die abgeschlossene
   * Disziplin keine Aufstellung mehr). Ergebnis: die Team-Karte zeigte die gerade
   * angetretenen Spieler NICHT mehr unter „In dieser Disziplin", sondern warf den
   * kompletten Kader auf die Ersatzbank — genau in dem Moment, in dem man nachschauen
   * will, wer da eigentlich gelaufen ist.
   *
   * Deshalb merken wir uns je Disziplin die zuletzt bekannte, nicht-leere Besetzung und
   * liefern sie weiter aus. Der Cache wird beim Wechsel auf eine andere Disziplin
   * verworfen, sodass nie die Aufstellung der Vor-Disziplin durchschlägt.
   */
  const stickyFieldedRef = useRef<{ disciplineId: string; byTeam: Record<string, string[]> }>({
    disciplineId,
    byTeam: {},
  });
  const stickyFieldedByTeam = useMemo(() => {
    const previous = stickyFieldedRef.current.disciplineId === disciplineId ? stickyFieldedRef.current.byTeam : {};
    const merged: Record<string, string[]> = { ...previous };
    for (const [entryTeamId, ids] of Object.entries(fieldedByTeam)) {
      // Nur nicht-leere Besetzungen überschreiben den Merkzettel — eine leer gewordene
      // Quelle darf den gemerkten Stand nicht loeschen.
      if (ids.length > 0) {
        merged[entryTeamId] = ids;
      }
    }
    stickyFieldedRef.current = { disciplineId, byTeam: merged };
    return merged;
  }, [fieldedByTeam, disciplineId]);

  // Spoiler-Gate (A1): der Real-Modus-Endscreen darf erst erscheinen, wenn die
  // native Arena das Podest erreicht hat. Bei Remount (Disziplin/Modus/Seed) zurück.
  const [arenaEnded, setArenaEnded] = useState(false);
  // Live-Ergebnisse aufgedeckter Spieler (aus der Arena gemeldet) → Team-Drawer
  // zeigt „geholt + Boni/Abzüge" für Spieler, die schon dran waren.
  const [liveResultsByTeam, setLiveResultsByTeam] = useState<StageLiveResultsByTeam>({});
  // Ein laufendes Replay blendet den erinnerten Endscreen aus, bis der Lauf erneut
  // endet — sonst stuende das Ergebnis schon waehrend der Wiederholung da.
  const [replayingDisciplineId, setReplayingDisciplineId] = useState<string | null>(null);
  useEffect(() => {
    setArenaEnded(false);
    setReplayingDisciplineId(null);
  }, [disciplineId, mode, seed]);

  // Eine laut SAVE bereits gebuchte Seite gilt auch ohne Session-Commit als gebucht — nach einem
  // Reload mitten im Spieltag zeigt der Status sonst nichts, und ein Replay der Disziplin wuerde
  // erneut buchen wollen. Steht bewusst VOR `disciplineEnded`, das diese Quelle jetzt braucht.
  // Dieselbe Quelle wie die Buchung unten (`matchdaySides`, also Panel mit Spielplan-Rueckfall).
  // Mit `matchdayPanel` allein galt bei ausgefallener Preview jede Seite als UNgewertet — der
  // Endscreen verschwand, und ein Replay haette erneut buchen wollen.
  const activeSideScoredInSave =
    matchdaySides.d1?.disciplineId === disciplineId
      ? scoringProgress?.d1.scored ?? false
      : matchdaySides.d2?.disciplineId === disciplineId
        ? scoringProgress?.d2.scored ?? false
        : false;

  /**
   * Endscreen-Sichtbarkeit. `arenaEnded` allein reichte nicht: es wird bei JEDEM
   * Disziplin-Wechsel zurueckgesetzt, also verschwanden Topspieler, Highlights und
   * der Weiter-Block, sobald man zu einer bereits gelaufenen Disziplin zurueckkam.
   * `endedDisciplineIds` haelt den Abschluss ueber den Wechsel hinweg (dieselbe
   * Quelle, aus der das Spieltags-Panel seine Reveals speist) — damit bleibt eine
   * abgeschlossene Disziplin abgeschlossen.
   *
   * GEMELDET VON CHRIS: „der spieltag abschliessen button in der arena ist weg, jetzt kann man
   * wieder den 2. diszi nicht abschliessen."
   *
   * Beide bisherigen Quellen sind SITZUNGSZUSTAND: `arenaEnded` und `endedDisciplineIds` starten
   * nach jedem Neuladen leer. Wer den Spieltag verlaesst und zurueckkommt — auf Chris' Save mit
   * gewerteter Staffel und offenem Takeshi —, sah die Buehne auf einer laengst gewerteten Disziplin
   * („Disziplin gewertet"), aber der Block darunter fehlte komplett. In dem Block stecken BEIDE
   * Auswege: „Weiter zu Disziplin 2 →" und „Spieltag abschliessen". Ohne ihn gibt es keinen
   * gefuehrten Weg zur zweiten Disziplin, und der Spieltag haengt.
   *
   * Der Spielstand weiss es die ganze Zeit besser: `scoringProgress` sagt je Seite, ob gewertet
   * wurde. Diese Quelle ueberlebt den Reload — deshalb zaehlt sie jetzt mit.
   */
  const disciplineEnded =
    arenaEnded ||
    (endedDisciplineIds.has(disciplineId) && replayingDisciplineId !== disciplineId) ||
    (activeSideScoredInSave && replayingDisciplineId !== disciplineId);

  /**
   * Buchungszustand je Disziplin. Der Zieleinlauf loest die Wertung aus; bis sie durch
   * ist, steht im Endscreen „wird gewertet", danach „im Saisonstand". Ein Replay derselben
   * Disziplin bucht NICHT erneut — gebucht wird der erste, verbindliche Durchlauf.
   */
  const [commitStateByDiscipline, setCommitStateByDiscipline] = useState<
    Record<string, "pending" | "booked" | "failed">
  >({});
  /** Warum die Buchung abgelehnt wurde — je Disziplin. `null`, solange es keinen Grund gibt. */
  const [commitFailureReason, setCommitFailureReason] = useState<Record<string, string | null>>({});
  const commitInFlightRef = useRef<Set<string>>(new Set());
  const commitState = commitStateByDiscipline[disciplineId] ?? (activeSideScoredInSave ? "booked" : null);

  const commitFinishedDiscipline = useCallback(
    (finishedDisciplineId: string) => {
      if (!onCommitDiscipline) return;
      /**
       * SEITE AUS `matchdaySides`, NICHT AUS `matchdayPanel` — DAS WAR DER STILLE BUCHUNGSVERLUST.
       *
       * GEMELDET VON CHRIS: „MD4 hat nicht gescored und blocked auch so dass ich nicht weiter komme."
       * Am Spielstand (Saison 1, Spieltag 4): Mini-DM gelaufen, aber NULL Ergebniszeilen, waehrend
       * alle 32 Aufstellungen dafuer vorlagen.
       *
       * `matchdayPanel` haengt an der Engine-Preview (`if (!preview) return null`). Faellt die aus —
       * Netzfehler, leeres Ergebnis, Timeout —, war `side` hier `null`, und die Buchung kehrte
       * KOMMENTARLOS zurueck: Disziplin laeuft durch, nichts landet im Save, keine Fehlermeldung,
       * nicht einmal ein `failed`-Zustand. Der Spieltag haengt danach an einer Sperre, deren Grund
       * nirgends steht.
       *
       * Fuer die ANZEIGE gibt es den Rueckfall auf den Spielplan laengst (`matchdaySides` =
       * Panel, sonst `scheduleSides`) — er wurde damals eingefuehrt, weil bei ausgefallener Preview
       * der gefuehrte Weg zur zweiten Disziplin verschwand. Die BUCHUNG blieb auf der alten,
       * preview-gebundenen Quelle stehen. Sie zieht jetzt dieselbe: der Spielplan steht lokal im
       * gameState und braucht die Engine gar nicht.
       */
      const side =
        matchdaySides.d1?.disciplineId === finishedDisciplineId
          ? "d1"
          : matchdaySides.d2?.disciplineId === finishedDisciplineId
            ? "d2"
            : null;
      // Nur die beiden Spieltags-Disziplinen werden gewertet. Ein freies Nachspielen
      // ausserhalb des Spieltags-Paars bleibt folgenlos.
      //
      // Laesst sich die Seite AUCH ueber den Spielplan nicht bestimmen, ist das kein freies
      // Nachspielen mehr, sondern ein echter Ausfall — er wird als `failed` vermerkt, damit die
      // Arena ihn zeigen kann, statt still nichts zu tun.
      if (!side) {
        if (matchdaySides.d1 == null && matchdaySides.d2 == null) {
          setCommitStateByDiscipline((prev) => ({ ...prev, [finishedDisciplineId]: "failed" }));
        }
        return;
      }
      // Bereits im Save gebucht (z. B. D1 nach einem Reload erneut abgespielt):
      // NICHT noch einmal buchen — gebucht wird der erste, verbindliche Durchlauf.
      if (scoringProgress && scoringProgress[side].scored) return;
      if (commitInFlightRef.current.has(finishedDisciplineId)) return;
      if (commitStateByDiscipline[finishedDisciplineId] === "booked") return;
      commitInFlightRef.current.add(finishedDisciplineId);
      setCommitStateByDiscipline((prev) => ({ ...prev, [finishedDisciplineId]: "pending" }));
      // Die gerade abgespielte Preview geht MIT — sie wird gebucht, statt dass der Server ein
      // zweites Mal aufloest. Ohne sie rechnete der Commit ueber den Zustand, den er im Moment des
      // Buchens vorfindet; bewegte sich dazwischen etwas an den Aufstellungen, landete im
      // Saisonstand etwas anderes als das, was ueber den Schirm gelaufen war.
      void onCommitDiscipline(side, preview)
        .then((ergebnis) => {
          /**
           * „NICHT GEWORFEN" HEISST NICHT „GEBUCHT".
           *
           * Zwei Wege fuehren hier vorbei, und beide muessen zu. `commitArenaDiscipline` WIRFT
           * inzwischen bei einer blockierten Wertung und traegt den Grund im Fehler mit (siehe
           * `DisciplineCommitBlockedError`) — aber es gibt Faelle ohne Wurf: im Lesemodus und
           * ohne Lauf-Handler gibt es schlicht `null` zurueck. Landete das im `then`, wurde es
           * als „booked" vermerkt: der Endscreen sagte „im Saisonstand", im Save stand nichts.
           *
           * Gewertet wird deshalb das ERGEBNIS, nicht das Ausbleiben eines Fehlers.
           */
          const gebucht =
            ergebnis != null &&
            (ergebnis as { summary?: { standingsApplyAllowed?: boolean } }).summary?.standingsApplyAllowed === true;
          setCommitStateByDiscipline((prev) => ({
            ...prev,
            [finishedDisciplineId]: gebucht ? "booked" : "failed",
          }));
          setCommitFailureReason((prev) => ({ ...prev, [finishedDisciplineId]: null }));
        })
        .catch((error: unknown) => {
          // Der Grund wurde hier bislang verschluckt: „Die Wertung ist fehlgeschlagen" stand
          // ohne jede Angabe da, und niemand — auch nicht der Entwickler — konnte sehen, WARUM.
          const reason = error instanceof Error && error.message ? error.message : null;
          setCommitStateByDiscipline((prev) => ({ ...prev, [finishedDisciplineId]: "failed" }));
          setCommitFailureReason((prev) => ({ ...prev, [finishedDisciplineId]: reason }));
          console.error("[Arena] Buchung der Disziplin fehlgeschlagen", finishedDisciplineId, error);
        })
        .finally(() => {
          commitInFlightRef.current.delete(finishedDisciplineId);
        });
    },
    [commitStateByDiscipline, matchdaySides, onCommitDiscipline, preview, scoringProgress],
  );

  // S2: Doppel-Klick-Schutz für „Spieltag auswerten & weiter".
  // Der State allein reicht dafür nicht: zwei Klicks im selben React-Batch lesen beide das
  // `advancing` aus derselben Render-Closure (also `false`), und `disabled` wirkt erst nach dem
  // Re-Render — der Spieltag würde doppelt ausgewertet. Das Ref sperrt synchron beim ersten Klick;
  // der State steuert weiterhin nur die Optik (gleiches Muster wie `busyRef` in der NativeArena).
  const [advancing, setAdvancing] = useState(false);
  const advancingRef = useRef(false);

  const ownTeam = model.teams.find((t) => t.isOwn);
  const ownRank = ownTeam ? model.teams.indexOf(ownTeam) + 1 : null;

  if (disciplines.length === 0) {
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 40, textAlign: "center", opacity: 0.75 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Arena</div>
        <div style={{ fontSize: 14 }}>
          Daten werden geladen … Falls dieser Hinweis bleibt, ist noch keine Saison mit Disziplinen aktiv.
        </div>
      </div>
    );
  }

  /**
   * S3 · Vor dem Anpfiff: eigener Zustand statt leer durchlaufendem Live-Gerüst.
   *
   * Kein 32-Zeilen-Rundenstand, keine 32 Schloss-Zeilen, keine 32× „keine
   * Aufstellung" — und vor allem: keine Rangliste, wo es noch nichts zu reihen
   * gibt. Der Held ist die einzig handlungsrelevante Information (deine
   * Einsatzliste), daneben der Gegner-/Disziplin-Kontext und „Dein Umfeld" aus
   * dem kanonischen Saisonstand. `data-testid="arena-stage"` bleibt am Container:
   * die Browser-Smokes warten darauf, dass die Arena gerendert hat — das gilt
   * auch für ihren Pre-Matchday-Zustand.
   */
  if (showPreMatchday) {
    const sideRequirements = ownArenaReadiness?.sideRequirements ?? null;
    const totalRequired = sideRequirements?.totalRequired ?? 0;
    const filledTotal = Math.min(ownLineupSideCounts.total, totalRequired > 0 ? totalRequired : ownLineupSideCounts.total);
    const ownLineupComplete = Boolean(ownArenaReadiness?.isReady);
    const missingRosterSlots = totalRequired > 0 ? Math.max(totalRequired - ownRosterCount, 0) : 0;
    const pendingTeams = leagueLineupReadiness.pendingTeams;
    const d1Meta = matchdaySides.d1;
    const d2Meta = matchdaySides.d2;
    const disciplineSubtitle = [d1Meta?.displayName, d2Meta?.displayName].filter(Boolean).join(" & ");
    const slotCells = totalRequired > 0
      ? Array.from({ length: totalRequired }, (_, index) => {
          if (index < filledTotal) return "is-filled";
          if (index >= ownRosterCount) return "is-void";
          return "";
        })
      : [];
    const formCardsBlocked =
      ownArenaReadiness?.blocker === "missing_formcard_pool" ||
      (ownArenaReadiness?.formCardsRequired === true && ownArenaReadiness?.isReady === false && ownArenaReadiness?.lineupSubmitted === true);
    return (
      <div className="arena-prematch" data-testid="arena-stage" data-arena-prematch="true">
        <div>
          <span className="arena-prematch-eyebrow">Arena · {matchdayNumberLabel}</span>
          <h1 className="arena-prematch-title">Vor dem Anpfiff</h1>
          {disciplineSubtitle ? <p className="arena-prematch-sub">{disciplineSubtitle}</p> : null}
        </div>

        <div className="arena-prematch-hero">
          <div className="arena-prematch-hero-state">
            <span className={`arena-prematch-statuspill${ownLineupComplete ? " is-ready" : ""}`}>
              <span className="arena-prematch-statusdot" aria-hidden="true" />
              {ownLineupComplete ? "Deine Einsatzliste steht" : "Noch nicht startklar"}
            </span>
            <h2 className="nl-tnum">
              {ownLineupComplete
                ? `Warten auf die Liga — ${leagueLineupReadiness.readyCount} von ${leagueLineupReadiness.totalCount} Teams bereit`
                : totalRequired > 0
                  ? `Deine Einsatzliste: ${filledTotal} von ${totalRequired} Plätzen besetzt`
                  : "Deine Einsatzliste ist noch offen"}
            </h2>
            <p>
              Der Spieltag startet, sobald alle {leagueLineupReadiness.totalCount} Teams ihre Einsatzliste
              gespeichert und die Formkarten geklärt haben.
              {missingRosterSlots > 0
                ? ` Dein Kader hat ${ownRosterCount} Spieler für ${totalRequired} Plätze — ${missingRosterSlots === 1 ? "ein Platz bleibt" : `${missingRosterSlots} Plätze bleiben`} leer und ${missingRosterSlots === 1 ? "bringt" : "bringen"} keine Punkte.`
                : ""}
              {formCardsBlocked ? " Deine Formkarten sind noch offen — sie werden im Einsatzlisten-Editor geklärt." : ""}
            </p>
            {slotCells.length > 0 ? (
              <div
                className="arena-prematch-slotbar"
                role="img"
                aria-label={`${filledTotal} von ${totalRequired} Plätzen besetzt`}
              >
                {slotCells.map((cellClass, index) => (
                  <span key={index} className={`arena-prematch-slot ${cellClass}`.trim()} />
                ))}
              </div>
            ) : null}
            <span className="arena-prematch-slotlegend nl-tnum">
              {d1Meta ? `${d1Meta.displayName} ${Math.min(ownLineupSideCounts.d1, sideRequirements?.d1Required ?? ownLineupSideCounts.d1)}/${sideRequirements?.d1Required ?? "?"}` : null}
              {d1Meta && d2Meta ? " · " : ""}
              {d2Meta ? `${d2Meta.displayName} ${Math.min(ownLineupSideCounts.d2, sideRequirements?.d2Required ?? ownLineupSideCounts.d2)}/${sideRequirements?.d2Required ?? "?"}` : null}
              {` · Liga ${leagueLineupReadiness.readyCount}/${leagueLineupReadiness.totalCount} bereit`}
            </span>
          </div>
          <div className="arena-prematch-hero-actions">
            {onOpenLineup ? (
              ownLineupComplete ? (
                <button type="button" className="arena-prematch-ghost" onClick={() => onOpenLineup()}>
                  Einsatzliste prüfen
                </button>
              ) : (
                <button type="button" className="arena-prematch-cta" onClick={() => onOpenLineup()} data-testid="arena-prematch-lineup-cta">
                  Einsatzliste öffnen →
                  {totalRequired > 0 ? <small className="nl-tnum">{totalRequired - filledTotal} von {totalRequired} Plätzen offen</small> : null}
                </button>
              )
            ) : null}
            {/* Der Weg nach vorn. Ohne ihn wäre die Tafel eine Sackgasse — was hinnehmbar war,
                solange sie nur bei Blockaden erschien, aber nicht mehr, seit sie vor jedem
                Spieltag kommt. Erscheint erst, wenn die ganze Liga bereit ist: vorher DARF die
                Bühne nicht loslaufen, und ein Knopf, der dann nichts tut, wäre eine Lüge. */}
            {preMatchdayReady ? (
              <button
                type="button"
                className="arena-prematch-cta"
                onClick={() => setPreMatchdayDismissed(true)}
                data-testid="arena-prematch-start-cta"
              >
                Zur Bühne →
                <small className="nl-tnum">Liga vollzählig bereit</small>
              </button>
            ) : null}
          </div>
        </div>

        <div className="arena-prematch-disc-grid">
          {([
            { side: "d1" as const, meta: d1Meta, required: sideRequirements?.d1Required ?? null },
            { side: "d2" as const, meta: d2Meta, required: sideRequirements?.d2Required ?? null },
          ]).map(({ side, meta, required }) =>
            meta ? (
              <section key={side} className="arena-prematch-disc">
                <div className="arena-prematch-disc-head">
                  <h3>
                    Disziplin {side === "d1" ? 1 : 2} · {meta.displayName}
                  </h3>
                  {required != null && required > 0 ? (
                    <span className="arena-prematch-disc-badge nl-tnum">{required} Plätze</span>
                  ) : null}
                </div>
                {preMatchMutatorsBySide[side].length > 0 ? (
                  <div className="arena-prematch-mutrow">
                    <span className="arena-prematch-mutlabel">Mutatoren</span>
                    {preMatchMutatorsBySide[side].map((mutator) => (
                      <span key={mutator} className="arena-prematch-mutchip">
                        {mutator}
                      </span>
                    ))}
                    <span className="arena-prematch-mutnote">
                      ◆ Spieler mit passendem Trait bekommen Bonus-Score und Bonus-PP gutgeschrieben
                    </span>
                  </div>
                ) : null}
                {side === "d2" ? (
                  <div className="arena-prematch-locknote">
                    <span aria-hidden="true">🔒</span>
                    <span>Ergebnis bleibt verdeckt, bis Disziplin 1 komplett gewertet ist — kein Spoiler.</span>
                  </div>
                ) : null}
              </section>
            ) : null,
          )}
        </div>

        <VeloPendingRanking
          eyebrow="Spieltags-Wertung"
          title="Wertung folgt"
          note={`Sobald die erste Etappe läuft, erscheint hier die Wertung aller ${leagueLineupReadiness.totalCount} Teams — beide Disziplinen gemeinsam. Bis dahin steht hier bewusst keine Reihenfolge: ohne Ergebnis gibt es keine Ränge und keine Medaillen.`}
          slots={[
            { key: "gold", ring: "1.", label: "Noch zu vergeben" },
            { key: "silver", ring: "2.", label: "Noch zu vergeben" },
            { key: "bronze", ring: "3.", label: "Noch zu vergeben" },
          ]}
          meta={
            <>
              {leagueLineupReadiness.totalCount} Teams gemeldet · {leagueLineupReadiness.readyCount} Einsatzlisten bereit
              {pendingTeams.length > 0 && pendingTeams.length <= 6
                ? ` · es fehlen: ${pendingTeams.map((team) => team.teamName).join(" · ")}`
                : ""}
            </>
          }
          data-testid="arena-prematch-pending-ranking"
        />

        {preMatchContext.rows.length > 0 ? (
          <section className="arena-prematch-ctx">
            <h3>Dein Umfeld vor dem Spieltag</h3>
            <p className="arena-prematch-ctx-note">
              {preMatchContext.anyPoints
                ? "Saisonstand vor diesem Spieltag — dieselbe Quelle wie die Saisontabelle."
                : "Noch kein Spieltag gewertet — die Reihenfolge sind die Startplätze aus dem Endstand der Vorsaison."}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="nl-tnum">
                <thead>
                  <tr>
                    <th className="is-num">Saisonrang</th>
                    <th>Team</th>
                    <th className="is-num">Punkte</th>
                    <th aria-label="Beziehung" />
                  </tr>
                </thead>
                <tbody>
                  {preMatchContext.rows.map((row) => (
                    <tr
                      key={row.teamId}
                      className={row.relation === "mine" ? "is-own" : undefined}
                      onClick={onOpenTeam ? () => onOpenTeam(row.teamId) : undefined}
                      style={onOpenTeam ? { cursor: "pointer" } : undefined}
                      title={onOpenTeam ? `${row.name} öffnen` : undefined}
                    >
                      <td className="is-num">{row.rank != null ? row.rank : "—"}</td>
                      <td>
                        {row.relation === "mine" ? "★ " : ""}
                        {row.name} · {row.code}
                      </td>
                      <td className="is-num">{fmt1(row.points ?? 0)}</td>
                      <td>
                        {row.relation === "rival" ? (
                          <span className="arena-prematch-rival-tag">✕ Rivale</span>
                        ) : row.relation === "ally" ? (
                          <span className="arena-prematch-ally-tag">Verbündet</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <>
    {/* Stabiler Anker fuer die Browser-Smokes: belegt, dass die Buehne wirklich gerendert
        hat. Vorher zeigten die Smokes auf die "Spieltagsergebnis"-Sektion, die es nicht mehr
        gibt. Der Abschluss-Knopf taugt NICHT als Ersatz — er erscheint erst bei fertigem
        Spieltag, im Smoke also nie. */}
    <div data-testid="arena-stage" style={{ width: "100%", margin: "0 auto", padding: "20px 24px", color: "inherit" }}>
      {/*
        Warte-Banner des Start-Gates. In der Arena zu stehen ist erlaubt, losgehen erst,
        wenn alle Teams ihre Einsatzliste gespeichert haben. Das Banner nennt die offenen
        Teams namentlich, damit sofort klar ist, auf wen gewartet wird.
      */}
      {arenaStartBlockedByLineups ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 12,
            background: "color-mix(in srgb, var(--nl-warn) 12%, var(--nl-panel))",
            border: "1px solid color-mix(in srgb, var(--nl-warn) 45%, var(--nl-line))",
          }}
        >
          <strong style={{ fontSize: 13, fontWeight: 800, color: "var(--nl-warn)" }}>
            Noch nicht startklar — {leagueLineupReadiness.readyCount}/{leagueLineupReadiness.totalCount} Teams bereit
          </strong>
          <span style={{ fontSize: 12, color: "var(--nl-mut)" }}>
            Es fehlt noch:{" "}
            {leagueLineupReadiness.pendingTeams
              .slice(0, 6)
              .map((team) => team.teamName)
              .join(" · ")}
            {leagueLineupReadiness.pendingTeams.length > 6
              ? ` · +${leagueLineupReadiness.pendingTeams.length - 6} weitere`
              : ""}
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>
            {devMode ? "Arena · Test-Modus · echte Save-Werte" : "Arena"}
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800 }}>{model.disciplineName}</h1>
          {/* Die 2 aktiven Mutatoren dieser Disziplin — sichtbar direkt an der
              Disziplin, in JEDER Disziplin (darf nicht fehlen). */}
          {shownMutators.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>Mutatoren</span>
              {shownMutators.map((m, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--nl-accent)",
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--nl-accent) 12%, var(--nl-panel))",
                    border: "1px solid color-mix(in srgb, var(--nl-accent) 45%, var(--nl-line))",
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          ) : null}
          {devMode ? (
            <div style={{ fontSize: 13, color: "var(--nl-mut)", marginTop: 4, maxWidth: 720 }}>
              Alle {model.teams.length} Teams mit ihren echten Top-{model.slotCount}-Spielern aus dem Save.
              Netto = Grundwert − Fatigue + Form. „🎲 Random" verteilt zusätzlich zufällig Fatigue/Pushes und
              die 2 Mutator-Traits, damit sichtbar wird, ob das additive Modell korrekt rechnet (Position = Punkte).
            </div>
          ) : null}
        </div>
        <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "var(--nl-mut)", fontWeight: 700 }}>
            {devMode ? "Disziplin (Admin: frei)" : "Disziplin (Spieltag)"}
          </span>
          <select
            value={disciplineId}
            onChange={(event) => setDisciplineId(event.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--nl-line)", background: "var(--nl-panel)", color: "inherit", fontSize: 14, fontWeight: 700 }}
          >
            {disciplineSelectOptions.map((discipline, index) => {
              // Buchungszustand aus dem Save direkt am Auswahl-Eintrag: nach einem
              // Reload mitten im Spieltag sieht man so sofort, dass Disziplin 1
              // bereits gewertet ist und nur Disziplin 2 noch aussteht.
              const scored =
                scoringProgress?.d1.disciplineId === discipline.id
                  ? scoringProgress.d1.scored
                  : scoringProgress?.d2.disciplineId === discipline.id
                    ? scoringProgress.d2.scored
                    : false;
              const scoredSuffix = scored ? " · ✓ gewertet" : "";
              return (
                <option key={discipline.id} value={discipline.id}>
                  {devMode || matchdayDisciplineOptions.length === 0
                    ? `${discipline.name}${scoredSuffix}`
                    : `${index + 1}. ${discipline.name}${scoredSuffix}`}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {/* P1-17: Engine-Status auch AUSSERHALB des Dev-Modus sichtbar. Ohne diese Zeile bekamen
          normale Spieler bei „loading"/„unavailable" keinerlei Rückmeldung und saßen still fest.
          Nur eingeblendet, solange NICHT engine-echt gerendert wird (sonst wäre es Rauschen). */}
      {!devMode && mode === "real" && !useEngine ? (
        <div
          role="status"
          aria-live="polite"
          style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, fontSize: 12.5 }}
        >
          <span
            style={{
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 99,
              color: "var(--nl-mut)",
              border: "1px solid var(--nl-line)",
            }}
          >
            {/* Der frühere Text „Vereinfachte Ansicht (keine Engine-Aufstellung)" verschwieg das
                Entscheidende: die gezeigten Spieler sind dann NICHT die aufgestellten, sondern eine
                Schätzung des Modells. Chris las die Bühne deshalb als Ergebnis — mit Namen, die gar
                nicht gespielt hatten. Jetzt steht dran, was es ist. */}
            {previewState === "loading"
              ? "Engine lädt …"
              : realDataMissing
                ? "Vorschau mit GESCHÄTZTER Aufstellung — nicht das Ergebnis"
                : "Vereinfachte Ansicht (keine Engine-Aufstellung)"}
          </span>
          {previewState === "unavailable" ? (
            <button
              type="button"
              onClick={() => setPreviewReloadNonce((nonce) => nonce + 1)}
              style={{
                padding: "5px 12px",
                fontWeight: 700,
                fontSize: 12.5,
                border: "1px solid var(--nl-line)",
                background: "transparent",
                color: "inherit",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Engine erneut laden
            </button>
          ) : null}
        </div>
      ) : null}

      {devMode && (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--nl-line)" }}>
          <button
            type="button"
            onClick={() => setMode("real")}
            style={{ padding: "8px 14px", fontWeight: 800, fontSize: 13, border: 0, cursor: "pointer", color: "var(--nl-ink)", background: mode === "real" ? "var(--nl-accent)" : "transparent" }}
          >
            Echte Werte
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("random");
              setSeed((s) => s + 1);
            }}
            style={{ padding: "8px 14px", fontWeight: 800, fontSize: 13, border: 0, cursor: "pointer", color: "var(--nl-ink)", background: mode === "random" ? "var(--nl-warn)" : "transparent" }}
          >
            🎲 Random-Test
          </button>
        </div>
        {mode === "real" ? (
          <span
            title={useEngine ? "Werte kommen 1:1 aus der Matchday-Resolve-Engine (arena-identisch)" : "Vereinfachte Ansicht: für diese Disziplin/diesen Spieltag liegt keine Engine-Aufstellung vor"}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 99,
              color: useEngine ? "var(--nl-good)" : "var(--nl-mut)",
              background: useEngine ? "color-mix(in srgb, var(--nl-good) 15%, transparent)" : "transparent",
              border: `1px solid ${useEngine ? "var(--nl-good)" : "var(--nl-line)"}`,
            }}
          >
            {useEngine
              ? "✓ Engine-echt"
              : previewState === "loading"
                ? "Engine lädt …"
                : "Vereinfacht (keine Einsatzliste)"}
          </span>
        ) : null}
        {mode === "random" ? (
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            style={{ padding: "8px 12px", fontWeight: 700, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}
          >
            ↻ Neu würfeln
          </button>
        ) : null}
        {mode === "random" && mutatorTraits.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, flexWrap: "wrap" }}>
            <span style={{ opacity: 0.65, fontWeight: 700 }}>Mutator-Traits (+{MUTATOR_TRAIT_BONUS}):</span>
            {mutatorTraits.map((trait) => {
              const tone = POSITIVE_TRAIT_SET.has(trait.toLowerCase()) ? "var(--nl-good)" : "var(--nl-risk)";
              return (
                <span
                  key={trait}
                  title={`+${MUTATOR_TRAIT_BONUS} Score je Spieler mit diesem Trait`}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 99,
                    fontWeight: 800,
                    fontSize: 12,
                    color: tone,
                    background: `color-mix(in srgb, ${tone} 16%, transparent)`,
                    border: `1px solid ${tone}`,
                  }}
                >
                  {trait}
                </span>
              );
            })}
            <span style={{ color: "var(--nl-mut)" }}>
              · {mutatorImpact.affected} Spieler betroffen (+{fmt1(MUTATOR_PP_BONUS)} PP je)
            </span>
          </div>
        ) : null}
        {ownRank ? (
          <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800 }}>
            Dein Team: <span style={{ color: "var(--nl-accent)" }}>Rang {ownRank}</span> / {model.teams.length}
          </div>
        ) : null}
      </div>
      )}

      <div
        data-oly-debug="arena"
        data-mode={mode}
        data-discipline-id={disciplineId}
        data-discipline-ended={String(disciplineEnded)}
        data-engine-discipline={String(Boolean(engineDiscipline))}
        data-active-side-scored={String(activeSideScoredInSave)}
        data-sides={`${matchdaySides.d1?.disciplineId ?? "-"}|${matchdaySides.d2?.disciplineId ?? "-"}`}
        data-progress={`${scoringProgress?.d1.disciplineId ?? "-"}:${String(scoringProgress?.d1.scored)}|${scoringProgress?.d2.disciplineId ?? "-"}:${String(scoringProgress?.d2.scored)}`}
        data-panel-reveal={`${String(panelD1Revealed)}|${String(panelD2Revealed)}`}
        data-md-top={String(Boolean(matchdayTopPlayers))}
        hidden
      />
      <DisciplineStageNativeArena
        key={`${disciplineId}-${mode}-${seed}`}
        slots={payload.slots}
        teams={nativeTeams}
        onOpenPlayer={(pid) => openDrawerPinned({ kind: "player", playerId: pid })}
        onOpenTeam={(teamId) => openDrawerPinned({ kind: "team", teamId })}
        onHoverTeam={previewTeam}
        onPreviewPlayer={previewPlayer}
        onEnded={() => {
          setArenaEnded(true);
          setReplayingDisciplineId(null);
          // A3: Disziplin dauerhaft als „schon gelaufen" merken (siehe endedDisciplineIds oben).
          setEndedDisciplineIds((prev) => (prev.has(disciplineId) ? prev : new Set(prev).add(disciplineId)));
          // Zieleinlauf = Wertung. Was die Buehne gezeigt hat, wandert jetzt in den
          // Saisonstand; nach D2 wird der Spieltag zusaetzlich abgeschlossen.
          commitFinishedDiscipline(disciplineId);
        }}
        onReset={(anlass) => {
          setArenaEnded(false);
          // NUR „↻ Neu" ist ein Nachspielen. Vorher galt auch der Mount als Replay — und weil
          // `disciplineEnded` ein Replay bewusst nicht als abgeschlossen zaehlt, blieb der ganze
          // Endscreen (Top-Spieler, Highlights, Weiter-Block) beim Oeffnen einer bereits
          // gewerteten Disziplin unsichtbar. Siehe `discipline-stage-replay-gate.ts`.
          setReplayingDisciplineId(replayNachArenaReset(anlass, disciplineId));
        }}
        onResults={setLiveResultsByTeam}
        topPlayers={topPlayers}
        primitive={NATIVE_PRIMITIVE[disciplineId] ?? "track"}
        disciplineId={disciplineId}
        disciplineName={model.disciplineName}
        accent={DISCIPLINE_SKIN[disciplineId]?.accent}
        motif={DISCIPLINE_SKIN[disciplineId]?.motif}
        env={DISCIPLINE_SKIN[disciplineId]?.env}
        roomSync={nativeRoomSync}
      />

      {/* Team-Matchday-PP-Panel (Ticket 205 · Pflicht-Feature Ticket 219): unter der Arena, IMMER
          sichtbar sobald echte Spieltags-Daten vorliegen — in JEDER Disziplin, nicht nur den
          zwei geplanten. Ist die offene Disziplin eine der beiden Spieltags-Disziplinen, wird
          schrittweise enthüllt (d1 nach Disziplin-1-Ende, d2 + finaler Saison-Rang nach
          Disziplin-2-Ende); sonst zeigt es den Spieltags-Fahrplan + Saisonstand (PP gesperrt,
          kein Spoiler). Beide Disziplinen des Spieltags werden zusammengefasst. */}
      {/* Wertungsstatus der gerade beendeten Disziplin. Ersetzt den frueheren Abschluss-Knopf:
          der Spieler klickt nichts mehr, er sieht nur, dass die Punkte stehen. */}
      {mode === "real" && disciplineEnded && commitState ? (
        <div
          role="status"
          data-testid="arena-discipline-commit-status"
          data-commit-state={commitState}
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            padding: "9px 12px",
            borderRadius: 12,
            border: `1px solid ${commitState === "failed" ? "var(--nl-risk)" : "var(--nl-line)"}`,
            color: commitState === "failed" ? "var(--nl-risk)" : "var(--nl-good)",
            background: "var(--nl-panel)",
          }}
        >
          {commitState === "pending"
            ? "Wertung läuft — die Platzierungspunkte werden gebucht …"
            : commitState === "booked"
              ? matchdayPanel?.d2?.disciplineId === disciplineId
                ? "Spieltag gewertet — beide Disziplinen stehen im Saisonstand."
                : "Gewertet — die Platzierungspunkte stehen im Saisonstand."
              : commitFailureReason[disciplineId]
                ? `Die Punkte wurden nicht gebucht — ${commitFailureReason[disciplineId]}`
                : "Die Wertung ist fehlgeschlagen. Die Punkte wurden nicht gebucht."}
        </div>
      ) : null}

      {/* Spieltags-Wertung NUR, wenn mindestens eine Disziplin aufgedeckt ist (S3/
          Muster 3). Vorher rannte das Panel auch VOR dem Start leer durch: 32
          Schloss-Zeilen plus ein „S-Rang", der bei 0 Punkten alphabetisch
          durchnummeriert war und den ersten drei Teams des Alphabets Medaillen-
          Optik gab. Ohne Wertung steht hier jetzt der erklärende Platzhalter —
          eine leere Rangliste behauptet keine Reihenfolge.
          Die Aufdeck-Logik selbst ist unverändert (panelD1Revealed/panelD2Revealed,
          siehe Definition bei endedDisciplineIds). */}
      {mode === "real" && preview && matchdayPanel && (panelD1Revealed || panelD2Revealed) ? (
        <div style={{ marginTop: 14 }}>
          <DisciplineStageMatchdayPanel
            teamResults={matchdayPanel.teamResults}
            standings={matchdayPanel.standings}
            d1={matchdayPanel.d1}
            d2={matchdayPanel.d2}
            d1Revealed={panelD1Revealed}
            d2Revealed={panelD2Revealed}
            teamMetaById={teamMetaById}
            ownTeamId={ownTeamId}
            onOpenTeam={(teamId) => openDrawerPinned({ kind: "team", teamId })}
            onHoverTeam={previewTeam}
            mutatorByTeam={matchdayPanel.mutatorByTeam}
            modifierBaseByTeam={matchdayPanel.modifierBaseByTeam}
            playersByTeam={matchdayPanel.playersByTeam}
            modifiersByTeam={matchdayPanel.modifiersByTeam}
            injuryMarksByTeam={matchdayInjuryMarks}
          />
        </div>
      ) : mode === "real" ? (
        <div style={{ marginTop: 14 }}>
          <VeloPendingRanking
            eyebrow="Spieltags-Wertung"
            title="Wertung folgt"
            note="Die Wertung aller Teams erscheint mit dem ersten gewerteten Ergebnis — beide Disziplinen gemeinsam, Rang vor → nach dem Spieltag. Bis dahin steht hier bewusst keine Reihenfolge."
            meta={`${leagueLineupReadiness.totalCount} Teams gemeldet · ${leagueLineupReadiness.readyCount} Einsatzlisten bereit`}
            data-testid="arena-stage-pending-ranking"
          />
        </div>
      ) : null}

      {devMode ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--nl-mut)", lineHeight: 1.5 }}>
          Lesehilfe: <b>Sortierung</b> = Saison-Rang (MD1 links) · <b>Farbe/Bewegung</b> = aktueller Rundenstand · <b>Podest</b> = Endrang der Disziplin.
        </div>
      ) : null}

      {devMode && ownTeam ? (
        <div style={{ marginTop: 14, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}>
            Modell-Check · {ownTeam.shortCode} · {ownTeam.name} — echte Save-Werte (Grundwert − Fatigue + Form = Netto)
          </div>
          {ownTeam.slots.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--nl-mut)", fontStyle: "italic" }}>Keine aufstellbaren Spieler für diese Disziplin.</div>
          ) : (
            <>
              {ownTeam.slots.map((slot) => (
                <div
                  key={slot.playerId}
                  onClick={() => openDrawerPinned({ kind: "player", playerId: slot.playerId })}
                  onMouseEnter={() => previewPlayer(slot.playerId)}
                  onMouseLeave={() => previewPlayer(null)}
                  title="Spieler-Karte öffnen"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--nl-line)", fontVariantNumeric: "tabular-nums", fontSize: 13, cursor: "pointer", borderRadius: 6 }}
                >
                  <span style={{ width: 20, fontWeight: 800, color: "var(--nl-mut)" }}>{slot.slotIndex + 1}</span>
                  {slot.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slot.portraitUrl}
                      alt=""
                      width={22}
                      height={22}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }}
                    />
                  ) : (
                    <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }} />
                  )}
                  <span style={{ fontWeight: 700, flex: "0 0 140px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{slot.playerName}</span>
                  <span style={{ color: "var(--nl-ink)" }}>
                    <b>{fmt1(slot.base)}</b>
                    {slot.fatiguePenalty > 0 ? <span style={{ color: "var(--nl-risk)" }}> − {fmt1(slot.fatiguePenalty)} Fatigue</span> : null}
                    {slot.formSwing !== 0 ? (
                      <span style={{ color: slot.formSwing > 0 ? "var(--nl-good)" : "var(--nl-risk)" }}>
                        {" "}
                        {slot.formSwing > 0 ? "+" : "−"} {fmt1(Math.abs(slot.formSwing))} Form
                      </span>
                    ) : null}
                    {" = "}
                    <b style={{ color: "var(--nl-accent)" }}>+{fmt1(slot.net)}</b>
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, fontWeight: 800 }}>
                <span style={{ color: "var(--nl-mut)" }}>Team-Summe (echt):</span>
                <span style={{ color: "var(--nl-accent)" }}>{fmt1(ownTeam.total)}</span>
              </div>
            </>
          )}
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--nl-mut)" }}>
            Im Random-Test rechnet die Arena mit denselben Grundwerten, aber gewürfelten Mods — die Netto-Werte
            dort weichen daher bewusst von dieser echten Referenz ab.
          </div>
        </div>
      ) : null}

      {mode === "real" && engineDiscipline && disciplineEnded ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Konsolidiert: die Team-Wertung steht komplett in der Spieltags-Wertung oben
              (Rang vor→nach inkl. Δ, D1/D2, Mutator, Gesamt). Statt der früheren vier
              Einzeltabellen (Disziplin-Ergebnis, Spieltag-Gesamt, Standings-Delta) bleibt
              hier nur die Topspieler-Tabelle + die Highlights. */}
          {/* Unter der Spieltags-Wertung gehoert die Liste des GANZEN Spieltags hin (beide
              Disziplinen zusammen) — siehe `matchdayTopPlayers`. `topPlayers` (nur die laufende
              Disziplin) bleibt der Rueckfall, solange die Engine noch keine aufgedeckte Seite
              liefert. */}
          <DisciplineStageTopPlayers
            players={(matchdayTopPlayers ?? topPlayers).rows}
            playerIdByRow={(matchdayTopPlayers ?? topPlayers).ids}
            // Ohne Spieltags-Liste steht nur die laufende Disziplin drin — dann sagt die
            // Ueberschrift auch genau die, statt eine Summe zu behaupten.
            disciplineNames={matchdayTopPlayers?.disciplineNames ?? (model.disciplineName ? [model.disciplineName] : null)}
            onOpenPlayer={(pid) => openDrawerPinned({ kind: "player", playerId: pid })}
          />
          <DisciplineStageHighlights
            candidates={engineDiscipline.highlightCandidates}
            teamMetaById={teamMetaById}
            playerNameById={playerNameById}
            ownTeamId={ownTeamId}
          />
        </div>
      ) : null}

      {/* Weiterführung NICHT an `engineDiscipline` koppeln: Topspieler/Highlights brauchen die
          Engine-Preview, der nächste Schritt nicht. Vorher verschwand bei ausgefallener Preview der
          komplette Block — der Spieler stand nach dem Disziplin-Ende ohne jeden Hinweis da und hätte
          über den separaten Abschluss-Button unbeabsichtigt Disziplin 2 übersprungen. */}
      {mode === "real" && disciplineEnded ? (
        <div style={{ marginTop: 16 }}>
          {(() => {
            // P1-16: Nach Disziplin 1 den Spieler AKTIV zur zweiten Disziplin des Spieltags führen,
            // statt ihn den Spieltag vorzeitig auswerten zu lassen oder das Dropdown selbst umstellen
            // zu müssen. `setDisciplineId` setzt `arenaEnded` (Effect auf [disciplineId]) automatisch
            // zurück → Diszi 2 startet frisch. Der Matchday-Advance erscheint erst auf der letzten
            // Disziplin (d2 bzw. Ein-Disziplin-Spieltag / Dev-Modus).
            const secondDisciplineId = matchdaySides.d2?.disciplineId ?? null;

            /**
             * GEMELDET VON CHRIS: „aber MD4 hat nicht gescored und blocked auch so dass ich nicht
             * weiter komme und abschliessen kann das ist mein problem, nicht dass dort keine punkte
             * sind."
             *
             * BEFUND am Spielstand (Saison 1, Spieltag 4): D1 (Wettessen) mit 32 Ergebniszeilen
             * gebucht, D2 (Mini-DM) mit NULL — obwohl alle 32 Aufstellungen fuer D2 vorlagen
             * (64 Eintraege). Die Arena war fuer D2 gelaufen (`arenaEnded`), die BUCHUNG aber nicht
             * durchgekommen.
             *
             * DIE ALTE BEDINGUNG FRAGTE NUR, WELCHE SEITE ANGEZEIGT WIRD (`activeDisciplineSide ===
             * "d1"`), nie ob sie GEWERTET ist. Stand man auf D2 und war D2 ungewertet, fiel die
             * Ansicht deshalb in den Zweig darunter und behauptete „Beide Disziplinen sind gewertet"
             * samt Abschluss-Knopf — der dann blockte, weil der Save es besser wusste. Genau die
             * Sackgasse, die Chris beschreibt: die Arena sagt fertig, der Spieltagswechsel sagt nein,
             * und einen Weg zurueck zur Wertung bot die Seite nicht an.
             *
             * MASSGEBLICH IST JETZT DER SAVE (`scoringProgress`), nicht die angezeigte Seite:
             *   - die eigene Seite ist ungewertet  → sagen, dass die Buchung fehlt (kein Abschluss)
             *   - die ANDERE Seite ist ungewertet  → dorthin fuehren, egal auf welcher man steht
             *   - beide gewertet                   → erst dann der Abschluss-Knopf
             */
            const eigeneSeiteGewertet = activeSideScoredInSave;
            const andereSeiteGewertet =
              activeDisciplineSide === "d1" ? (scoringProgress?.d2.scored ?? false) : (scoringProgress?.d1.scored ?? false);
            const andereSeiteGeplant =
              activeDisciplineSide === "d1" ? (scoringProgress?.d2.required ?? false) : (scoringProgress?.d1.required ?? false);

            // Die eigene Seite ist durchgelaufen, aber NICHT im Save gelandet. Das ist der Fall, in
            // dem die Seite bisher „beide gewertet" behauptete. Statt eines Knopfes, der blockt,
            // steht hier, was wirklich fehlt.
            if (!devMode && !eigeneSeiteGewertet) {
              return (
                <div
                  role="alert"
                  data-testid="arena-side-not-booked"
                  style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                  <span style={{ fontSize: 12, color: "var(--nl-warn, var(--nl-mut))" }}>
                    Diese Disziplin ist gelaufen, aber noch <strong>nicht gewertet</strong> — der Spieltag lässt sich
                    deshalb nicht abschliessen. Disziplin neu starten, um die Wertung nachzuholen.
                  </span>
                </div>
              );
            }

            const guideToSecondDiscipline =
              !devMode &&
              secondDisciplineId != null &&
              secondDisciplineId !== disciplineId &&
              andereSeiteGeplant &&
              !andereSeiteGewertet;
            if (guideToSecondDiscipline) {
              const secondName =
                matchdayDisciplineOptions.find((option) => option.id === secondDisciplineId)?.name ?? "Disziplin 2";
              return (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--nl-mut)" }}>
                    Disziplin 1 abgeschlossen — weiter zur zweiten Disziplin dieses Spieltags.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDisciplineId(secondDisciplineId);
                      // Nach oben scrollen: der Knopf sitzt UNTER der Buehne, nach dem
                      // Wechsel stand man also mitten in der Spieltags-Wertung und musste
                      // sich die neue Disziplin erst wieder hochsuchen.
                      scrollArenaIntoView();
                    }}
                    style={{
                      padding: "11px 22px",
                      fontWeight: 800,
                      fontSize: 14,
                      border: 0,
                      borderRadius: 10,
                      cursor: "pointer",
                      color: "var(--nl-ink)",
                      background: "var(--nl-accent)",
                    }}
                  >
                    Weiter zu Disziplin 2: {secondName} →
                  </button>
                </div>
              );
            }
            return onAdvanceMatchday ? (
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--nl-mut)" }}>
                  Beide Disziplinen sind gewertet — schaltet auf den nächsten Spieltag weiter.
                </span>
                <button
                  type="button"
                  // Anker fuer Tests und die Browser-Smokes. Lag vorher am Knopf in der
                  // entfernten "Spieltagsergebnis"-Sektion und wandert mit ihm hierher.
                  data-testid="arena-finish-matchday"
                  disabled={advancing}
                  onClick={async () => {
                    if (advancingRef.current) return;
                    advancingRef.current = true;
                    setAdvancing(true);
                    try {
                      await onAdvanceMatchday();
                    } finally {
                      advancingRef.current = false;
                      setAdvancing(false);
                    }
                  }}
                  style={{
                    padding: "11px 22px",
                    fontWeight: 800,
                    fontSize: 14,
                    border: 0,
                    borderRadius: 10,
                    cursor: advancing ? "default" : "pointer",
                    color: "var(--nl-ink)",
                    background: "var(--nl-accent)",
                    opacity: advancing ? 0.6 : 1,
                  }}
                >
                  {advancing ? "schaltet weiter…" : "Spieltag abschließen"}
                </button>
              </div>
            ) : null;
          })()}
        </div>
      ) : null}
    </div>

    {/* Drawer-Overlay — Geschwister NACH der Arena, damit die Arena gemountet bleibt
        und weiterläuft (kein Remount/Reset durch drawerTarget). */}
    <DisciplineStageDrawer
      target={drawerTarget}
      gameState={gameState}
      disciplineId={disciplineId}
      fieldedPlayerIdsByTeam={stickyFieldedByTeam}
      liveResultsByTeam={liveResultsByTeam}
      disciplineMutators={shownMutators}
      ratingByPlayerId={ratingByPlayerId}
      onClose={() => {
        setDrawerTarget(null);
      }}
      onOpenFull={(target) => {
        if (target.kind === "player") onOpenPlayer?.(target.playerId);
        else onOpenTeam?.(target.teamId);
      }}
      onSelectPlayer={(pid) => openDrawerPinned({ kind: "player", playerId: pid })}
    />

    {/* Hover-Vorschau — am Cursor verankert, geklammert, pointer-events:none. Als
        Geschwister NACH der Arena (kein Remount/Reset der laufenden Sim). Öffnet
        NIE den vollen Drawer; der öffnet nur per Klick. */}
    <DisciplineStageHoverPreview
      target={hoverPreview}
      gameState={gameState}
      ratingByPlayerId={ratingByPlayerId}
      fieldedPlayerIdsByTeam={stickyFieldedByTeam}
      // Anti-Spoiler: dieselbe Reveal-Quelle wie der Team-Drawer — die Hovercard darf
      // nur Werte von Spielern zeigen, die die Arena schon aufgedeckt hat.
      liveResultsByTeam={liveResultsByTeam}
      // PP zusätzlich erst nach Abschluss der Disziplin — vorher wäre die Vergabe ein Spoiler.
      ppByPlayerId={arenaEnded ? ppByPlayerId : null}
    />
    </>
  );
}
