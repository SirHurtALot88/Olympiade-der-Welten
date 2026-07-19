"use client";

// DEV-HARNESS (Verifikation des Feld-Registry-Refactors). Rendert die ECHTE
// DisciplineStageNativeArena mit Mock-Teams und einem Primitive-Dropdown, damit sich
// alle Disziplinen ohne den vollen Game-Save-Flow durchklicken lassen. Kein Teil des
// Spiels; nur für Screenshots/Playwright.

import { useMemo, useState } from "react";
import DisciplineStageNativeArena, {
  type StagePrimitive,
  type StageEnv,
  type NativeStageTeam,
} from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

const PRIMS: StagePrimitive[] = [
  "track", "lanes", "towers", "stage", "platter", "lamps", "spybar", "kda", "duelhp",
  "barbell", "sparkbar", "thermometer", "peloton", "parcours", "bump", "mountain",
  "court", "rink", "klassen", "territory",
];

const ENV_TRACK: StageEnv = {
  sky: ["hsl(28 38% 20%)", "hsl(28 42% 9%)"],
  stands: "hsl(28 36% 22%)",
  surface: ["hsl(20 74% 46%)", "hsl(12 68% 34%)", "hsl(7 70% 17%)"],
  line: "hsl(38 50% 88%)",
  infield: ["hsl(140 45% 32%)", "hsl(148 50% 20%)"],
};

const CODES = [
  "GG", "SC", "MM", "ZH", "BP", "CS", "HR", "RC", "PS", "TC", "LR", "WW", "BB", "DL", "AA", "VD",
  "SS", "TT", "RR", "NN", "CC", "PC", "UA", "VW", "MS", "RL", "WL", "TG", "DP", "NW", "VV", "LK",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function buildTeams(): NativeStageTeam[] {
  return CODES.map((code, i) => {
    const players = Array.from({ length: 4 }, (_, s) => {
      const base = 30 + hash(code + "p" + s) * 55;
      return {
        playerId: `${code}-${s}`,
        val: Math.round(base * 10) / 10,
        name: `${code} ${["Falk", "Berg", "Ono", "Diaz"][s]}`,
        portraitUrl: null,
        mods: [] as { k: string; sign: 1 | -1; amt: number }[],
        pointsAwarded: null,
      };
    });
    const rel = i === 8 || i === 4 ? "mine" : i === 5 || i === 22 ? "ally" : i === 19 || i === 27 ? "rival" : null;
    return {
      code,
      name: `Team ${code}`,
      logoUrl: null,
      isOwn: i === 8,
      players,
      seasonRank: i + 1,
      teamId: `team-${code}`,
      rel: rel as NativeStageTeam["rel"],
    };
  });
}

export default function DevArenaPage() {
  const [prim, setPrim] = useState<StagePrimitive>("track");
  const teams = useMemo(buildTeams, []);
  const slots = ["Etappe 1", "Etappe 2", "Etappe 3", "Etappe 4"];
  return (
    <div style={{ padding: 16, background: "var(--nl-bg, #0a0e15)", color: "var(--nl-ink, #eef4fb)", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <strong>DEV Arena Harness</strong>
        <label>
          Disziplin:{" "}
          <select
            data-testid="prim-select"
            value={prim}
            onChange={(e) => setPrim(e.target.value as StagePrimitive)}
            style={{ padding: "4px 8px", fontFamily: "monospace" }}
          >
            {PRIMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <span data-testid="active-prim">{prim}</span>
      </div>
      <DisciplineStageNativeArena
        key={prim}
        teams={teams}
        slots={slots}
        primitive={prim}
        disciplineName={prim.toUpperCase()}
        accent="hsl(199 74% 60%)"
        env={prim === "track" ? ENV_TRACK : undefined}
      />
    </div>
  );
}
