import { describe, expect, it } from "vitest";

import {
  buildDisciplineStageTeamsFromPreview,
  stageTeamNetTotal,
  type StageTeamMeta,
} from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";
import type {
  DisciplineResolvePreview,
  DisciplineTeamResolvePreview,
} from "@/lib/resolve/legacy-matchday-resolve-types";

// VORGEHEN (Weg 2 aus der Aufgabenstellung): Statt die echte Resolve-Engine
// aufzuziehen, konstruieren wir von Hand mehrere GÜLTIGE DisciplineResolvePreview-
// Objekte. Das Mapping liest ohnehin nur teamResults[].{teamId,teamName,rank,
// score,teamPoints,entries[]} und pro Entry {playerId,playerName,baseValue,
// fatigueAdjustedValue,captainBonus,mutatorBonus,finalPlayerScore,pointsAwarded}.
// Wir provozieren gezielt Team-Level-Deltas (score != Σ finalPlayerScore) und
// krumme Kommazahlen, um die Reconciliation / Rundungsdrift zu prüfen. Der
// beweisführende Invariant ist: stageTeamNetTotal(team) == teamResult.score.

type EntryInput = {
  playerId: string;
  playerName: string;
  baseValue: number | null;
  fatigueAdjustedValue?: number | null;
  captainBonus?: number | null;
  mutatorBonus?: number | null;
  finalPlayerScore?: number | null;
  pointsAwarded?: number | null;
};

function makeEntry(input: EntryInput): DisciplineTeamResolvePreview["entries"][number] {
  return {
    playerId: input.playerId,
    activePlayerId: `active-${input.playerId}`,
    playerName: input.playerName,
    slotIndex: 0,
    baseValue: input.baseValue,
    fatigueAdjustedValue: input.fatigueAdjustedValue ?? null,
    captainBonus: input.captainBonus ?? null,
    mutatorBonus: input.mutatorBonus ?? null,
    finalPlayerScore: input.finalPlayerScore ?? null,
    pointsAwarded: input.pointsAwarded ?? null,
    isCaptain: false,
    warnings: [],
  };
}

function makeTeam(input: {
  teamId: string;
  teamName: string;
  rank: number;
  score: number;
  teamPoints: number | null;
  entries: EntryInput[];
}): DisciplineTeamResolvePreview {
  return {
    teamId: input.teamId,
    teamName: input.teamName,
    disciplineId: "mini-dm",
    disciplineSide: "d1",
    status: "ready",
    baseScore: input.score,
    fatigueModifier: null,
    fatigueStatus: "mapped",
    intensity: "normal",
    intensityModifier: null,
    captainStatus: "mapped",
    captainBonus: null,
    formCardStatus: "ready",
    formCardLabel: null,
    formModifier: null,
    mutatorMode: "legacy_selected_traits",
    mutatorModifier: null,
    mutatorSlots: [],
    teamPpsModifier: null,
    teamPpsStatus: "ready",
    finalPreviewScore: input.score,
    score: input.score,
    rank: input.rank,
    teamPoints: input.teamPoints,
    pointSource: "computed",
    warnings: [],
    missingLineup: false,
    missingPlayers: 0,
    isComplete: true,
    missingScores: [],
    entries: input.entries.map(makeEntry),
  };
}

function makePreview(teams: DisciplineTeamResolvePreview[]): DisciplineResolvePreview {
  return {
    disciplineId: "mini-dm",
    disciplineName: "Mini-DM",
    disciplineSide: "d1",
    teamResults: teams,
    topPlayers: [],
    highlightCandidates: [],
  };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// Deckt ab: sauberer Fall, Fatigue-/Captain-/Mutator-Deltas, Team-Level-Delta
// (score != Σ finalPlayerScore), krumme Kommazahlen mit Rundungsdrift, einzelner
// Slot, und (weiter unten) leere/null-Felder.
const preview = makePreview([
  // Team 1: sauber, keine Deltas, score == Σ base.
  makeTeam({
    teamId: "t1",
    teamName: "Alpha",
    rank: 1,
    score: 30,
    teamPoints: 10,
    entries: [
      { playerId: "t1-p0", playerName: "A0", baseValue: 10, finalPlayerScore: 10, pointsAwarded: 5 },
      { playerId: "t1-p1", playerName: "A1", baseValue: 12, finalPlayerScore: 12, pointsAwarded: 4 },
      { playerId: "t1-p2", playerName: "A2", baseValue: 8, finalPlayerScore: 8, pointsAwarded: 3 },
    ],
  }),
  // Team 2: Fatigue-Delta (negativ), Captain, Mutator + Team-Level-Delta.
  makeTeam({
    teamId: "t2",
    teamName: "Beta",
    rank: 2,
    score: 41.4,
    teamPoints: 8,
    entries: [
      { playerId: "t2-p0", playerName: "B0", baseValue: 15, fatigueAdjustedValue: 13.5, finalPlayerScore: 13.5 },
      { playerId: "t2-p1", playerName: "B1", baseValue: 10, captainBonus: 3, finalPlayerScore: 13 },
      { playerId: "t2-p2", playerName: "B2", baseValue: 9, mutatorBonus: -1.5, finalPlayerScore: 7.5 },
    ],
  }),
  // Team 3: krumme Kommazahlen, score deutlich != Σ base -> Team-Delta verteilt.
  makeTeam({
    teamId: "t3",
    teamName: "Gamma",
    rank: 3,
    score: 27.3,
    teamPoints: 6,
    entries: [
      { playerId: "t3-p0", playerName: "C0", baseValue: 7.13, fatigueAdjustedValue: 6.66 },
      { playerId: "t3-p1", playerName: "C1", baseValue: 8.47, captainBonus: 1.24 },
      { playerId: "t3-p2", playerName: "C2", baseValue: 5.91, mutatorBonus: 2.08 },
      { playerId: "t3-p3", playerName: "C3", baseValue: 4.29 },
    ],
  }),
  // Team 4: einzelner Slot, Team-Level-Delta (Remainder-Pfad des letzten Slots).
  makeTeam({
    teamId: "t4",
    teamName: "Delta",
    rank: 4,
    score: 22.6,
    teamPoints: 4,
    entries: [{ playerId: "t4-p0", playerName: "D0", baseValue: 20, finalPlayerScore: 20 }],
  }),
]);

const teamMetaById = new Map<string, StageTeamMeta>([
  ["t1", { code: "ALP", name: "Alpha FC", logoUrl: "logo-alpha.png" }],
  ["t2", { code: "BET", name: "Beta FC", logoUrl: null }],
  // t3, t4 fehlen bewusst -> Fallback auf teamId/teamName.
]);

const portraitById = new Map<string, string | null>([
  ["t1-p0", "portrait-a0.png"],
  ["t2-p1", null],
]);

describe("buildDisciplineStageTeamsFromPreview", () => {
  const teams = buildDisciplineStageTeamsFromPreview(preview, teamMetaById, portraitById);

  it("mappt jedes Team", () => {
    expect(teams).toHaveLength(4);
    expect(teams.map((t) => t.teamId)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("ZENTRALER INVARIANT: stageTeamNetTotal(team) == teamResult.score (auf 0,1 genau) fuer JEDES Team", () => {
    for (const team of teams) {
      const source = preview.teamResults.find((t) => t.teamId === team.teamId)!;
      expect(stageTeamNetTotal(team)).toBeCloseTo(source.score, 1);
      expect(team.score).toBe(source.score);
    }
  });

  it("val == round1(baseValue) fuer jeden Spieler", () => {
    for (const team of teams) {
      const source = preview.teamResults.find((t) => t.teamId === team.teamId)!;
      team.players.forEach((player, index) => {
        expect(player.val).toBe(round1(source.entries[index].baseValue ?? 0));
      });
    }
  });

  it("nutzt Meta wenn vorhanden, sonst Fallback auf teamId/teamName", () => {
    expect(teams[0].code).toBe("ALP");
    expect(teams[0].name).toBe("Alpha FC");
    expect(teams[0].logoUrl).toBe("logo-alpha.png");
    // t3 ohne Meta -> Fallback.
    expect(teams[2].code).toBe("t3");
    expect(teams[2].name).toBe("Gamma");
    expect(teams[2].logoUrl).toBeNull();
  });

  it("uebernimmt Portraits, Rank, teamPoints und pointsAwarded", () => {
    expect(teams[0].players[0].portraitUrl).toBe("portrait-a0.png");
    expect(teams[0].players[0].pointsAwarded).toBe(5);
    // fehlendes Portrait -> null.
    expect(teams[0].players[1].portraitUrl).toBeNull();
    expect(teams[0].rank).toBe(1);
    expect(teams[0].teamPoints).toBe(10);
    // fehlendes pointsAwarded -> null.
    expect(teams[1].players[0].pointsAwarded).toBeNull();
  });

  it("erzeugt Fatigue-Mod bei nicht-null Fatigue-Delta", () => {
    const b0 = teams[1].players[0];
    const fatigue = b0.mods.find((m) => m.k === "Fatigue");
    expect(fatigue).toBeDefined();
    expect(fatigue!.sign).toBe(-1);
    expect(fatigue!.amt).toBeCloseTo(1.5, 1);
  });

  it("erzeugt Captain-Mod bei nicht-null captainBonus", () => {
    const captain = teams[1].players[1].mods.find((m) => m.k === "Captain");
    expect(captain).toBeDefined();
    expect(captain!.sign).toBe(1);
    expect(captain!.amt).toBeCloseTo(3, 1);
  });

  it("erzeugt Mutator-Mod (negativ) bei nicht-null mutatorBonus", () => {
    const mutator = teams[1].players[2].mods.find((m) => m.k === "Mutator");
    expect(mutator).toBeDefined();
    expect(mutator!.sign).toBe(-1);
    expect(mutator!.amt).toBeCloseTo(1.5, 1);
  });

  it("erzeugt keine Fatigue-/Captain-/Mutator-Mods, wenn die Werte null/0 sind", () => {
    // Alpha hat keinerlei Deltas.
    for (const player of teams[0].players) {
      expect(player.mods.some((m) => ["Fatigue", "Captain", "Mutator"].includes(m.k))).toBe(false);
    }
  });

  it("verteilt Team-Level-Delta so, dass die Netto-Summe exakt den Score trifft", () => {
    // Gamma: score 27.3 weicht klar von Σ base ab -> Team-Mods muessen auftauchen.
    const teamMods = teams[2].players.flatMap((p) => p.mods.filter((m) => m.k === "Team"));
    expect(teamMods.length).toBeGreaterThan(0);
    expect(stageTeamNetTotal(teams[2])).toBeCloseTo(27.3, 1);
  });
});

describe("Robustheit gegen leere / null-Felder", () => {
  it("crasht nicht bei leeren entries und liefert Netto == score (0)", () => {
    const emptyPreview = makePreview([
      makeTeam({ teamId: "empty", teamName: "Leer", rank: 1, score: 0, teamPoints: null, entries: [] }),
    ]);
    const [team] = buildDisciplineStageTeamsFromPreview(emptyPreview, new Map(), new Map());
    expect(team.players).toHaveLength(0);
    expect(team.teamPoints).toBeNull();
    expect(stageTeamNetTotal(team)).toBe(0);
  });

  it("crasht nicht bei null baseValue / fehlenden Bonus-Feldern", () => {
    const nullPreview = makePreview([
      makeTeam({
        teamId: "nulls",
        teamName: "Nullwerte",
        rank: 1,
        score: 5,
        teamPoints: null,
        entries: [
          { playerId: "n0", playerName: "N0", baseValue: null },
          { playerId: "n1", playerName: "N1", baseValue: null, fatigueAdjustedValue: null, captainBonus: null, mutatorBonus: null },
        ],
      }),
    ]);
    const [team] = buildDisciplineStageTeamsFromPreview(nullPreview, new Map(), new Map());
    expect(team.players[0].val).toBe(0);
    // Invariant haelt auch bei null-Basiswerten: Team-Delta gleicht auf score ab.
    expect(stageTeamNetTotal(team)).toBeCloseTo(5, 1);
  });
});
