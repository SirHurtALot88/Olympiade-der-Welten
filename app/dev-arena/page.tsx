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

// Disziplin-zentrisch (id → primitive), damit sich auch Disziplinen durchklicken lassen,
// die sich ein Primitive teilen (parcours: takeshi+football, klassen: schach+tennis,
// stage: eiskunst+showcase). Spiegelt NATIVE_PRIMITIVE aus DisciplineStageArena.tsx.
type DevDisc = { id: string; prim: StagePrimitive; name: string };
const DISCIPLINES: DevDisc[] = [
  { id: "staffel", prim: "track", name: "Staffel" },
  { id: "spurt", prim: "bump", name: "Spurt" },
  { id: "takeshis-castle", prim: "parcours", name: "Takeshi's Castle" },
  { id: "mini-dm", prim: "duelhp", name: "Mini DM" },
  { id: "battlefield", prim: "territory", name: "Battlefield" },
  { id: "time-trial", prim: "peloton", name: "Time Trial" },
  { id: "speed-schach", prim: "klassen", name: "Speed-Schach" },
  { id: "fechten", prim: "lamps", name: "Fechten" },
  { id: "tennis", prim: "klassen", name: "Tennis" },
  { id: "wettessen", prim: "platter", name: "Wettessen" },
  { id: "i-spy", prim: "spybar", name: "I-Spy" },
  { id: "basketball", prim: "court", name: "Basketball" },
  { id: "gewichtheben", prim: "barbell", name: "Gewichtheben" },
  { id: "climbing", prim: "mountain", name: "Climbing" },
  { id: "eiskunstlauf", prim: "stage", name: "Eiskunstlauf" },
  { id: "showcase", prim: "stage", name: "Showcase" },
  { id: "football", prim: "parcours", name: "Football" },
  { id: "hockey", prim: "rink", name: "Hockey" },
  { id: "breaking", prim: "thermometer", name: "Breaking" },
  { id: "tdm", prim: "kda", name: "TDM" },
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
  const [discId, setDiscId] = useState<string>("staffel");
  const teams = useMemo(buildTeams, []);
  const slots = ["Etappe 1", "Etappe 2", "Etappe 3", "Etappe 4"];
  const disc = DISCIPLINES.find((d) => d.id === discId) ?? DISCIPLINES[0]!;
  return (
    <div style={{ padding: 16, background: "var(--nl-bg, #0a0e15)", color: "var(--nl-ink, #eef4fb)", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <strong>DEV Arena Harness</strong>
        <label>
          Disziplin:{" "}
          <select
            data-testid="prim-select"
            value={discId}
            onChange={(e) => setDiscId(e.target.value)}
            style={{ padding: "4px 8px", fontFamily: "monospace" }}
          >
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.prim}
              </option>
            ))}
          </select>
        </label>
        <span data-testid="active-prim">{disc.prim}</span>
      </div>
      <DisciplineStageNativeArena
        key={disc.id}
        teams={teams}
        slots={slots}
        primitive={disc.prim}
        disciplineId={disc.id}
        disciplineName={disc.name}
        accent="hsl(199 74% 60%)"
        env={disc.prim === "track" ? ENV_TRACK : undefined}
      />
    </div>
  );
}
