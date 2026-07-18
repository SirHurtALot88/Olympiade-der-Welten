"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildDisciplineStageModel,
  type DisciplineStageSlot,
} from "@/lib/foundation/discipline-stage/discipline-stage-data";

export type DisciplineStageArenaProps = {
  gameState: GameState;
  selectedTeamId: string;
  activeManagerTeamId: string | null;
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

function slotLabel(disciplineId: string, index: number, total: number): string {
  if (disciplineId === "staffel") {
    const legs = ["Start-Läufer", "Tempo-Läufer", "Kurven-Läufer", "Schluss-Läufer", "Anker"];
    return legs[index] ?? `Läufer ${index + 1}`;
  }
  return total <= 1 ? "Einzel" : `Platz ${index + 1}`;
}

export default function DisciplineStageArena({
  gameState,
  selectedTeamId,
  activeManagerTeamId,
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

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const scene = SCENE_BY_DISCIPLINE[disciplineId];

  const model = useMemo(
    () => buildDisciplineStageModel(gameState, disciplineId, ownTeamId),
    [gameState, disciplineId, ownTeamId],
  );

  // Random-Test: 2 Mutator-Traits werden für die Disziplin bestimmt.
  const mutatorTraits = useMemo(
    () => (mode === "random" ? pickMutatorTraits(seed + hashStr(disciplineId)) : []),
    [mode, seed, disciplineId],
  );

  const payload = useMemo(() => {
    const mineCode = model.teams.find((t) => t.isOwn)?.shortCode ?? null;
    return {
      type: "olyStageData" as const,
      mode,
      seed,
      slots: Array.from({ length: model.slotCount }, (_, i) => slotLabel(disciplineId, i, model.slotCount)),
      mineCode,
      mutatorTraits,
      teams: model.teams.map((t) => ({
        code: t.shortCode,
        name: t.name,
        logoUrl: t.logoUrl,
        players: t.slots.map((s) => ({
          val: s.base,
          name: s.playerName,
          portraitUrl: s.portraitUrl,
          traits: s.traits,
          mods: mode === "real" ? realMods(s) : [],
          // Trait-Mutatoren (+6 je passendem Trait) — nur im Random-Test angewandt.
          traitMods: mode === "random" ? traitMutatorMods(s.traits, mutatorTraits) : [],
        })),
      })),
    };
  }, [model, mode, seed, disciplineId, mutatorTraits]);

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
      iframeRef.current.contentWindow.postMessage(payload, "*");
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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 20, color: "inherit" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7, fontWeight: 800 }}>
            Disziplin-Bühne · Test-Modus · echte Save-Werte
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800 }}>{model.disciplineName}</h1>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4, maxWidth: 720 }}>
            Alle {model.teams.length} Teams mit ihren echten Top-{model.slotCount}-Spielern aus dem Save.
            Netto = Grundwert − Fatigue + Form. „🎲 Random" verteilt zusätzlich zufällig Fatigue/Pushes und
            2 Disziplin-Mutatoren, damit sichtbar wird, ob das additive Modell korrekt rechnet (Position = Punkte).
          </div>
        </div>
        <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ opacity: 0.7, fontWeight: 700 }}>Disziplin</span>
          <select
            value={disciplineId}
            onChange={(event) => setDisciplineId(event.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: 14, fontWeight: 700 }}
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
        <div style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
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
        {mode === "random" ? (
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            style={{ padding: "8px 12px", fontWeight: 700, fontSize: 13, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", borderRadius: 10, cursor: "pointer" }}
          >
            ↻ Neu würfeln
          </button>
        ) : null}
        {mode === "random" && mutatorTraits.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, flexWrap: "wrap" }}>
            <span style={{ opacity: 0.65, fontWeight: 700 }}>Mutator-Traits (+{MUTATOR_TRAIT_BONUS}):</span>
            {mutatorTraits.map((trait) => (
              <span
                key={trait}
                style={{
                  padding: "3px 9px",
                  borderRadius: 99,
                  fontWeight: 800,
                  fontSize: 12,
                  color: "var(--nl-ink)",
                  background: POSITIVE_TRAIT_SET.has(trait.toLowerCase()) ? "var(--nl-good)" : "var(--nl-risk)",
                }}
              >
                {trait}
              </span>
            ))}
            <span style={{ opacity: 0.7 }}>
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

      {scene ? (
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "var(--nl-bg)" }}>
          <iframe
            ref={iframeRef}
            key={scene}
            src={`/discipline-scenes/${scene}.html`}
            title={`Arena — ${model.disciplineName}`}
            style={{ width: "100%", height: 960, border: 0, display: "block" }}
          />
        </div>
      ) : (
        <div style={{ padding: 40, textAlign: "center", opacity: 0.7, border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 14 }}>
          Für <b>{model.disciplineName}</b> ist die Arena-Szene noch nicht hinterlegt.
        </div>
      )}

      {ownTeam ? (
        <div style={{ marginTop: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", opacity: 0.7, fontWeight: 800, marginBottom: 8 }}>
            Modell-Check · {ownTeam.shortCode} · {ownTeam.name} — echte Save-Werte (Grundwert − Fatigue + Form = Netto)
          </div>
          {ownTeam.slots.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.7, fontStyle: "italic" }}>Keine aufstellbaren Spieler für diese Disziplin.</div>
          ) : (
            <>
              {ownTeam.slots.map((slot) => (
                <div
                  key={slot.playerId}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontVariantNumeric: "tabular-nums", fontSize: 13 }}
                >
                  <span style={{ width: 20, fontWeight: 800, opacity: 0.7 }}>{slot.slotIndex + 1}</span>
                  <span style={{ fontWeight: 700, flex: "0 0 150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{slot.playerName}</span>
                  <span style={{ opacity: 0.9 }}>
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
                <span style={{ opacity: 0.7 }}>Team-Summe (echt):</span>
                <span style={{ color: "var(--nl-accent)" }}>{fmt1(ownTeam.total)}</span>
              </div>
            </>
          )}
          <div style={{ marginTop: 8, fontSize: 11.5, opacity: 0.6 }}>
            Im Random-Test rechnet die Arena mit denselben Grundwerten, aber gewürfelten Mods — die Netto-Werte
            dort weichen daher bewusst von dieser echten Referenz ab.
          </div>
        </div>
      ) : null}
    </div>
  );
}
