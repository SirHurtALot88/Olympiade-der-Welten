"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import {
  buildDisciplineStageModel,
  type DisciplineStageSlot,
} from "@/lib/foundation/discipline-stage/discipline-stage-data";
import {
  buildDisciplineStageTeamsFromPreview,
  type StageTeamMeta,
} from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import DisciplineStageEndScreen from "@/app/foundation/discipline-stage/DisciplineStageEndScreen";
import DisciplineStageStandingsDelta from "@/app/foundation/discipline-stage/DisciplineStageStandingsDelta";
import DisciplineStageHighlights from "@/app/foundation/discipline-stage/DisciplineStageHighlights";
import DisciplineStageTopPlayers, { type DisciplineStageTopPlayer } from "@/app/foundation/discipline-stage/DisciplineStageTopPlayers";
import DisciplineStageNativeArena, { type StagePrimitive } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

// Disziplinen mit fertigem nativem Renderer (löst schrittweise das iframe ab).
// Nativer Renderer je Disziplin. Engine, FX, Sounds, Ticker, Podest, Detail-
// Tabelle und Top-10 sind für alle 20 gleich; nur das Feld-Primitive unterscheidet
// die Optik: track (Oval, Position = Punkte), lanes (Bahnen, Fortschritt = Punkte),
// towers (Türme, Höhe = Punkte).
const NATIVE_PRIMITIVE: Record<string, StagePrimitive> = {
  // track — Fortschritt auf einer Bahn
  staffel: "track",
  spurt: "track",
  "takeshis-castle": "track",
  hockey: "track",
  wettessen: "track",
  football: "track",
  battlefield: "track",
  "mini-dm": "track",
  "i-spy": "track",
  tdm: "track",
  // lanes — parallele Bahnen bis zum Ziel
  "time-trial": "lanes",
  "speed-schach": "lanes",
  fechten: "lanes",
  tennis: "lanes",
  breaking: "lanes",
  // towers — vertikale Höhe = Punkte
  basketball: "towers",
  gewichtheben: "towers",
  climbing: "towers",
  eiskunstlauf: "towers",
  showcase: "towers",
};

export type DisciplineStageArenaProps = {
  gameState: GameState;
  selectedTeamId: string;
  activeManagerTeamId: string | null;
  saveId?: string | null;
  seasonId?: string | null;
  matchdayId?: string | null;
  onAdvanceMatchday?: (() => void | Promise<void>) | null;
  onOpenPlayer?: ((playerId: string) => void) | null;
};

// Disziplin-ID → fertige Arena-Szene unter /public/discipline-scenes.
// Die Szenen sind die abgesegneten Optiken; wir füttern sie mit echten Save-Daten.
const SCENE_BY_DISCIPLINE: Record<string, string> = {
  tennis: "tennis-v2",
  "mini-dm": "minidm-v2",
  showcase: "showcase-v2",
  "time-trial": "timetrial-v2",
  spurt: "spurt-v2",
  basketball: "basketball-skyline-v2",
  tdm: "tdm-etagen-v2",
  battlefield: "battlefield-v2",
  staffel: "staffel-oval",
  football: "football-v2",
  wettessen: "wettessen-tafel",
  gewichtheben: "gewichtheben-v2",
  "speed-schach": "schach-v2",
  "takeshis-castle": "takeshi-v2",
  hockey: "hockey-v2",
  eiskunstlauf: "eiskunstlauf-v2",
  climbing: "climbing-v2",
  fechten: "fechten-v2",
  "i-spy": "ispy-v2",
  breaking: "breakingpoint-v2",
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

// Skill-Punkte mit max. 1 Nachkommastelle anzeigen (nachlaufende .0 weglassen).
function fmt1(x: number): string {
  const v = Math.round(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Disziplin-eigenes Vokabular für die Slot-Labels (Etappen-Button, Ticker,
// Spotlight, Detail-Tabelle). Fällt sonst auf einen generischen Startplatz zurück.
const SLOT_VOCAB: Record<string, string[]> = {
  staffel: ["Start-Läufer", "Tempo-Läufer", "Kurven-Läufer", "Schluss-Läufer", "Anker"],
  spurt: ["Sprinter 1", "Sprinter 2", "Sprinter 3", "Sprinter 4", "Sprinter 5"],
  "time-trial": ["Fahrer 1", "Fahrer 2", "Fahrer 3", "Fahrer 4", "Fahrer 5"],
  hockey: ["Sturm", "Mittelfeld", "Abwehr", "Verteidiger", "Torwart"],
  football: ["Angriff", "Mittelfeld", "Abwehr", "Verteidiger", "Torwart"],
  basketball: ["Center", "Forward", "Guard", "Flügel", "Aufbau"],
  wettessen: ["Gang 1", "Gang 2", "Gang 3", "Gang 4", "Gang 5"],
  gewichtheben: ["Reißen", "Stoßen", "Zusatzheben", "Finalheben", "Anker"],
  climbing: ["Route 1", "Route 2", "Route 3", "Route 4", "Route 5"],
  eiskunstlauf: ["Kür 1", "Kür 2", "Kür 3", "Kür 4", "Kür 5"],
  showcase: ["Auftritt 1", "Auftritt 2", "Auftritt 3", "Auftritt 4", "Auftritt 5"],
  "speed-schach": ["Brett 1", "Brett 2", "Brett 3", "Brett 4", "Brett 5"],
  fechten: ["Gefecht 1", "Gefecht 2", "Gefecht 3", "Gefecht 4", "Gefecht 5"],
  tennis: ["Match 1", "Match 2", "Match 3", "Doppel", "Anker"],
  breaking: ["Battle 1", "Battle 2", "Battle 3", "Battle 4", "Battle 5"],
  "takeshis-castle": ["Lauf 1", "Lauf 2", "Lauf 3", "Lauf 4", "Lauf 5"],
  battlefield: ["Welle 1", "Welle 2", "Welle 3", "Welle 4", "Welle 5"],
  "mini-dm": ["Runde 1", "Runde 2", "Runde 3", "Runde 4", "Runde 5"],
  "i-spy": ["Fund 1", "Fund 2", "Fund 3", "Fund 4", "Fund 5"],
  tdm: ["Runde 1", "Runde 2", "Runde 3", "Runde 4", "Runde 5"],
};

function slotLabel(disciplineId: string, index: number, total: number): string {
  const vocab = SLOT_VOCAB[disciplineId];
  if (vocab) {
    return vocab[index] ?? `${vocab[0]?.replace(/\s*\d+$/, "") ?? "Slot"} ${index + 1}`;
  }
  return total <= 1 ? "Einzel" : `Platz ${index + 1}`;
}

export default function DisciplineStageArena({
  gameState,
  selectedTeamId,
  activeManagerTeamId,
  saveId,
  seasonId,
  matchdayId,
  onAdvanceMatchday,
  onOpenPlayer,
}: DisciplineStageArenaProps) {
  const ownTeamId = activeManagerTeamId ?? selectedTeamId ?? null;

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
    return disciplines.find((d) => SCENE_BY_DISCIPLINE[d.id])?.id ?? disciplines[0]?.id ?? "staffel";
  }, [disciplines]);

  const [disciplineId, setDisciplineId] = useState<string>(defaultDisciplineId);
  const [mode, setMode] = useState<"real" | "random">("real");
  const [seed, setSeed] = useState<number>(1);
  const [ready, setReady] = useState<boolean>(false);
  const [nativeBeta, setNativeBeta] = useState<boolean>(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const scene = SCENE_BY_DISCIPLINE[disciplineId];
  const hasNative = Boolean(NATIVE_PRIMITIVE[disciplineId]);
  const showNative = hasNative && nativeBeta;

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

  // Echte Resolve-Preview der Arena laden (nur wenn Matchday-Kontext vorhanden).
  const [preview, setPreview] = useState<LegacyMatchdayResolvePreview | null>(null);
  const [briefingItems, setBriefingItems] = useState<
    { teamId: string; currentRank: number | null; projectedRank: number | null }[]
  >([]);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    if (!saveId || !seasonId || !matchdayId) {
      setPreviewState("unavailable");
      return;
    }
    const controller = new AbortController();
    setPreviewState("loading");
    const query = new URLSearchParams({ saveId, seasonId, matchdayId, teamId: ownTeamId ?? "", source: "sqlite", includeDetails: "1" });
    fetch(`/api/matchday/arena-base?${query.toString()}`, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((payloadJson) => {
        const enginePreview = payloadJson?.resolvePreview?.preview ?? null;
        setPreview(enginePreview);
        setBriefingItems(Array.isArray(payloadJson?.briefingStandings?.items) ? payloadJson.briefingStandings.items : []);
        setPreviewState(enginePreview ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreview(null);
          setBriefingItems([]);
          setPreviewState("unavailable");
        }
      });
    return () => controller.abort();
  }, [saveId, seasonId, matchdayId, ownTeamId]);

  const engineDiscipline = useMemo(
    () => preview?.disciplinePreviews.find((d) => d.disciplineId === disciplineId) ?? null,
    [preview, disciplineId],
  );

  // Engine-Teams für die gewählte Disziplin (nur wenn sie an diesem Spieltag läuft).
  const engineTeams = useMemo(() => {
    const disc = preview?.disciplinePreviews.find((d) => d.disciplineId === disciplineId);
    if (!disc || disc.teamResults.length === 0) {
      return null;
    }
    return buildDisciplineStageTeamsFromPreview(disc, teamMetaById, portraitById);
  }, [preview, disciplineId, teamMetaById, portraitById]);

  // Echt-Modus nutzt die Engine, wenn Daten für diese Disziplin vorliegen.
  const useEngine = mode === "real" && engineTeams !== null;

  // Random-Test: 2 Mutator-Traits werden für die Disziplin bestimmt.
  const mutatorTraits = useMemo(
    () => (mode === "random" ? pickMutatorTraits(seed + hashStr(disciplineId)) : []),
    [mode, seed, disciplineId],
  );

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
            points: pp.pointsAwarded,
            isMvp: Boolean(pp.isMvpCandidate),
            isOwn: pp.teamId === ownTeamId,
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
              isMvp: s.base >= 80,
              isOwn: t.isOwn,
            },
          });
        });
      });
    }
    entries.sort((a, b) => (b.row.points ?? -1) - (a.row.points ?? -1) || b.row.score - a.row.score);
    const top = entries.slice(0, 12);
    top.forEach((e, i) => {
      e.row.rank = i + 1;
    });
    return { rows: top.map((e) => e.row), ids: top.map((e) => e.id) };
  }, [useEngine, engineDiscipline, model, teamMetaById, portraitById, ownTeamId]);

  const ownShortCode = useMemo(() => {
    const own = (gameState?.teams ?? []).find((t) => t.teamId === ownTeamId);
    return own?.shortCode ?? model.teams.find((t) => t.isOwn)?.shortCode ?? null;
  }, [gameState?.teams, ownTeamId, model.teams]);

  const payload = useMemo(() => {
    const slotCount = useEngine
      ? engineTeams!.reduce((max, t) => Math.max(max, t.players.length), 0) || model.slotCount
      : model.slotCount;
    const teams = useEngine
      ? engineTeams!.map((t) => ({
          code: t.code,
          name: t.name,
          logoUrl: t.logoUrl,
          // Engine-Modus: Netto = val + Σmods trägt bereits die volle Engine-Zerlegung.
          players: t.players.map((p) => ({
            playerId: p.playerId,
            val: p.val,
            name: p.name,
            portraitUrl: p.portraitUrl,
            traits: [] as string[],
            mods: p.mods,
            traitMods: [] as { k: string; sign: 1 | -1; amt: number }[],
            pointsAwarded: p.pointsAwarded,
          })),
        }))
      : model.teams.map((t) => ({
          code: t.shortCode,
          name: t.name,
          logoUrl: t.logoUrl,
          players: t.slots.map((s) => ({
            playerId: s.playerId,
            val: s.base,
            name: s.playerName,
            portraitUrl: s.portraitUrl,
            traits: s.traits,
            mods: mode === "real" ? realMods(s) : [],
            // Trait-Mutatoren (+6 je passendem Trait) — nur im Random-Test angewandt.
            traitMods: mode === "random" ? traitMutatorMods(s.traits, mutatorTraits) : [],
            pointsAwarded: null as number | null,
          })),
        }));
    return {
      type: "olyStageData" as const,
      mode,
      seed,
      slots: Array.from({ length: slotCount }, (_, i) => slotLabel(disciplineId, i, slotCount)),
      mineCode: ownShortCode,
      mutatorTraits,
      teams,
    };
  }, [useEngine, engineTeams, model, mode, seed, disciplineId, mutatorTraits, ownShortCode]);

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

  // Szenenwechsel → iframe lädt neu → Ready-Status zurücksetzen.
  useEffect(() => {
    setReady(false);
  }, [scene]);

  // Auf das Ready-Signal der Szene hören.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string } | null;
      if (data?.type === "olyStageReady" && event.source === iframeRef.current?.contentWindow) {
        setReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Sobald bereit (oder Payload sich ändert): echte Daten in die Szene posten.
  useEffect(() => {
    if (ready && iframeRef.current?.contentWindow) {
      // Same-origin-Asset — Ziel-Origin explizit statt "*".
      iframeRef.current.contentWindow.postMessage(payload, window.location.origin);
    }
  }, [ready, payload]);

  const ownTeam = model.teams.find((t) => t.isOwn);
  const ownRank = ownTeam ? model.teams.indexOf(ownTeam) + 1 : null;

  if (disciplines.length === 0) {
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 40, textAlign: "center", opacity: 0.75 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Disziplin-Bühne</div>
        <div style={{ fontSize: 14 }}>
          Daten werden geladen … Falls dieser Hinweis bleibt, ist noch keine Saison mit Disziplinen aktiv.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", margin: "0 auto", padding: "20px 24px", color: "inherit" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>
            Disziplin-Bühne · Test-Modus · echte Save-Werte
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800 }}>{model.disciplineName}</h1>
          <div style={{ fontSize: 13, color: "var(--nl-mut)", marginTop: 4, maxWidth: 720 }}>
            Alle {model.teams.length} Teams mit ihren echten Top-{model.slotCount}-Spielern aus dem Save.
            Netto = Grundwert − Fatigue + Form. „🎲 Random" verteilt zusätzlich zufällig Fatigue/Pushes und
            die 2 Mutator-Traits, damit sichtbar wird, ob das additive Modell korrekt rechnet (Position = Punkte).
          </div>
        </div>
        <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "var(--nl-mut)", fontWeight: 700 }}>Disziplin</span>
          <select
            value={disciplineId}
            onChange={(event) => setDisciplineId(event.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--nl-line)", background: "var(--nl-panel)", color: "inherit", fontSize: 14, fontWeight: 700 }}
          >
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id} disabled={!SCENE_BY_DISCIPLINE[discipline.id]}>
                {discipline.name}
                {SCENE_BY_DISCIPLINE[discipline.id] ? "" : " (Szene folgt)"}
              </option>
            ))}
          </select>
        </label>
      </div>

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
        {!showNative ? (
          <button
            type="button"
            onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: "olyStageQuickSim" }, window.location.origin)}
            title="Disziplin sofort komplett durchrechnen (ohne Animation) — Endstand + Podium"
            style={{ padding: "8px 14px", fontWeight: 800, fontSize: 13, border: "1px solid var(--nl-line)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}
          >
            ⏩ Quick-Sim
          </button>
        ) : null}
        {hasNative ? (
          <button
            type="button"
            onClick={() => setNativeBeta((v) => !v)}
            title="Nativer Renderer (scharf, integriert) vs. eingebettete iframe-Arena"
            style={{ padding: "8px 14px", fontWeight: 800, fontSize: 13, border: `1px solid ${showNative ? "var(--nl-good)" : "var(--nl-line)"}`, background: showNative ? "color-mix(in srgb, var(--nl-good) 14%, transparent)" : "transparent", color: showNative ? "var(--nl-good)" : "inherit", borderRadius: 10, cursor: "pointer" }}
          >
            {showNative ? "✓ Nativ (Beta)" : "Nativ (Beta)"}
          </button>
        ) : null}
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
                : "Vereinfacht (kein Lineup)"}
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

      {showNative ? (
        <DisciplineStageNativeArena
          key={`${disciplineId}-${mode}-${seed}`}
          slots={payload.slots}
          teams={payload.teams.map((t) => ({
            code: t.code,
            name: t.name,
            logoUrl: t.logoUrl,
            isOwn: t.code === payload.mineCode,
            players: t.players.map((p) => ({
              playerId: p.playerId,
              val: p.val,
              name: p.name,
              portraitUrl: p.portraitUrl,
              mods: p.mods,
              pointsAwarded: p.pointsAwarded,
            })),
          }))}
          onOpenPlayer={onOpenPlayer}
          topPlayers={topPlayers}
          primitive={NATIVE_PRIMITIVE[disciplineId] ?? "track"}
        />
      ) : scene ? (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 340px", minWidth: 280, maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            <DisciplineStageTopPlayers players={topPlayers.rows} playerIdByRow={topPlayers.ids} onOpenPlayer={onOpenPlayer} />
          </div>
          <div style={{ flex: "1 1 640px", minWidth: 0, maxWidth: 1240, borderRadius: 14, overflow: "hidden", border: "1px solid var(--nl-line)", background: "var(--nl-bg)" }}>
            <iframe
              ref={iframeRef}
              key={scene}
              src={`/discipline-scenes/${scene}.html`}
              title={`Arena — ${model.disciplineName}`}
              style={{ width: "100%", height: "calc(100vh - 180px)", maxHeight: 860, minHeight: 500, border: 0, display: "block" }}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: 40, textAlign: "center", color: "var(--nl-mut)", border: "1px dashed var(--nl-line)", borderRadius: 14 }}>
          Für <b>{model.disciplineName}</b> ist die Arena-Szene noch nicht hinterlegt.
        </div>
      )}

      {ownTeam ? (
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
                  onClick={onOpenPlayer ? () => onOpenPlayer(slot.playerId) : undefined}
                  title={onOpenPlayer ? "Spieler-Karte öffnen" : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--nl-line)", fontVariantNumeric: "tabular-nums", fontSize: 13, cursor: onOpenPlayer ? "pointer" : "default", borderRadius: 6 }}
                >
                  <span style={{ width: 20, fontWeight: 800, color: "var(--nl-mut)" }}>{slot.slotIndex + 1}</span>
                  {slot.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slot.portraitUrl}
                      alt=""
                      width={22}
                      height={22}
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

      {mode === "real" && engineDiscipline ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <DisciplineStageEndScreen
            disciplineName={engineDiscipline.disciplineName}
            teamResults={engineDiscipline.teamResults}
            topPlayers={engineDiscipline.topPlayers}
            matchdayTeams={preview?.teamResults ?? null}
            teamMetaById={teamMetaById}
            ownTeamId={ownTeamId}
          />
          <DisciplineStageHighlights
            candidates={engineDiscipline.highlightCandidates}
            teamMetaById={teamMetaById}
            playerNameById={playerNameById}
            ownTeamId={ownTeamId}
          />
          {briefingItems.length > 0 ? (
            <DisciplineStageStandingsDelta items={briefingItems} teamMetaById={teamMetaById} ownTeamId={ownTeamId} />
          ) : null}
          {onAdvanceMatchday ? (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--nl-mut)" }}>
                Auswertung identisch zur Arena — schließt den Spieltag ab und schaltet weiter.
              </span>
              <button
                type="button"
                onClick={() => void onAdvanceMatchday()}
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
                Spieltag auswerten &amp; weiter →
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
