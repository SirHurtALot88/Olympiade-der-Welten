import { describe, expect, it } from "vitest";

import {
  buildMatchdayResolveSignature,
  buildMatchdaySideSignature,
  buildMatchdaySideSignatures,
  readMatchdayResolveSnapshot,
} from "@/lib/foundation/matchday-resolve-snapshot";
import {
  chooseDisciplineStageTeams,
  disciplineStagePreviewMatchesBooked,
} from "@/lib/foundation/discipline-stage/discipline-stage-from-booked-result";
import type { StagePreviewTeam } from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";

/**
 * NACH EINEM RELOAD ZEIGTE DIE ARENA ZAHLEN, DIE NIE GEBUCHT WURDEN.
 *
 * GEMESSEN am Live-Abbild vom 11.08.2026, Spielstand `new-game-1785823388048-1hf25q`
 * (Saison 2, Spieltag 10):
 *   - gespeicherte Snapshot-Signatur `fb9cc9e4…`, live gerechnet `045be77f…` — VERSCHIEDEN.
 *   - `readMatchdayResolveSnapshot` lieferte den Snapshot trotzdem, weil fuer den Spieltag
 *     ein `matchdayResult` existierte (die alte Klammer schaltete die Signaturpruefung ab).
 *   - Folge: 20 von 32 d1-Team-Zeilen zeigten einen anderen Score als gebucht (max 0,70),
 *     d2 stimmte exakt (0 von 32). Die Raenge stimmten zufaellig noch — bei Gleichstand
 *     kippt einer, und mit ihm die Punkte.
 *
 * Diese Suite prueft WERTE, nicht Quelltext-Strings.
 */

const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1" } as const;

type SnapshotShape = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  signature: string;
  sideSignatures?: Record<"d1" | "d2", string>;
  payload: unknown;
};

function draftEntry(playerId: string, slotIndex: number, side: "d1" | "d2") {
  return { playerId, slotIndex, disciplineId: side === "d1" ? "spurt" : "i-spy", disciplineSide: side };
}

function buildGameState(input: {
  d1Players?: string[];
  d2Players?: string[];
  fatigueByPlayerId?: Record<string, number>;
  bookedSides?: Array<"d1" | "d2">;
  snapshot?: SnapshotShape | null;
  draftStatus?: string;
}) {
  const d1Players = input.d1Players ?? ["p1", "p2"];
  const d2Players = input.d2Players ?? ["p3", "p4"];
  const bookedSides = input.bookedSides ?? [];
  const matchdayResults =
    bookedSides.length > 0
      ? [{ id: "res-1", saveId: scope.saveId, seasonId: scope.seasonId, matchdayId: scope.matchdayId, status: "preview_applied" }]
      : [];
  return {
    seasonState: {
      lineupDrafts: [
        {
          teamId: "A-A",
          seasonId: scope.seasonId,
          matchdayId: scope.matchdayId,
          status: input.draftStatus ?? "saved",
          entries: [
            ...d1Players.map((playerId, index) => draftEntry(playerId, index, "d1")),
            ...d2Players.map((playerId, index) => draftEntry(playerId, index, "d2")),
          ],
          modifiers: null,
        },
      ],
      playerAvailabilityState: Object.fromEntries(
        Object.entries(input.fatigueByPlayerId ?? {}).map(([playerId, fatigue]) => [playerId, { fatigue }]),
      ),
      matchdayResults,
      disciplineResults: bookedSides.map((side) => ({
        id: `dr-${side}`,
        matchdayResultId: "res-1",
        teamId: "A-A",
        disciplineId: side === "d1" ? "spurt" : "i-spy",
        disciplineSide: side,
        rank: 1,
        baseScore: 100,
        totalScore: 100,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-08-10T17:44:43.488Z",
      })),
      matchdayResolveSnapshots: input.snapshot ? [input.snapshot] : [],
    },
    teams: [{ teamId: "A-A", name: "Alpha" }],
  } as never;
}

const payload = { preview: { status: "ready", disciplinePreviews: [] } };

function snapshotFor(gameState: unknown): SnapshotShape {
  return {
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    signature: buildMatchdayResolveSignature(gameState as never, scope),
    sideSignatures: buildMatchdaySideSignatures(gameState as never, scope),
    payload,
  };
}

describe("Seitenweise Signatur", () => {
  it("die d2-Signatur bleibt gleich, wenn sich nur die Fatigue der d1-Spieler bewegt", () => {
    const vorher = buildGameState({ fatigueByPlayerId: { p1: 10, p2: 10, p3: 10, p4: 10 } });
    const nachD1 = buildGameState({ fatigueByPlayerId: { p1: 45, p2: 47, p3: 10, p4: 10 } });

    // Die VOLLE Signatur aendert sich — genau daran scheiterte die alte Pruefung.
    expect(buildMatchdayResolveSignature(nachD1, scope)).not.toBe(buildMatchdayResolveSignature(vorher, scope));
    // Die d2-Seite ist davon unberuehrt, die d1-Seite nicht.
    expect(buildMatchdaySideSignature(nachD1, scope, "d2")).toBe(buildMatchdaySideSignature(vorher, scope, "d2"));
    expect(buildMatchdaySideSignature(nachD1, scope, "d1")).not.toBe(buildMatchdaySideSignature(vorher, scope, "d1"));
  });

  it("eine geaenderte d2-Aufstellung schlaegt sehr wohl auf die d2-Signatur durch", () => {
    const vorher = buildGameState({});
    const umgestellt = buildGameState({ d2Players: ["p3", "p9"] });
    expect(buildMatchdaySideSignature(umgestellt, scope, "d2")).not.toBe(
      buildMatchdaySideSignature(vorher, scope, "d2"),
    );
    expect(buildMatchdaySideSignature(umgestellt, scope, "d1")).toBe(buildMatchdaySideSignature(vorher, scope, "d1"));
  });
});

describe("readMatchdayResolveSnapshot", () => {
  it("liefert den Snapshot, solange nichts gebucht ist und die Signatur passt", () => {
    const basis = buildGameState({});
    const state = buildGameState({ snapshot: snapshotFor(basis) });
    expect(readMatchdayResolveSnapshot(state, scope)).not.toBeNull();
  });

  it("verwirft ihn, sobald die Signatur nicht mehr passt (nichts gebucht)", () => {
    const basis = buildGameState({ fatigueByPlayerId: { p1: 10 } });
    const state = buildGameState({ fatigueByPlayerId: { p1: 44 }, snapshot: snapshotFor(basis) });
    expect(readMatchdayResolveSnapshot(state, scope)).toBeNull();
  });

  it("haelt ihn zwischen D1 und D2 am Leben — die D1-Fatigue darf ihn nicht kippen", () => {
    const vorD1 = buildGameState({ fatigueByPlayerId: { p1: 10, p2: 10, p3: 10, p4: 10 } });
    const nachD1 = buildGameState({
      fatigueByPlayerId: { p1: 45, p2: 47, p3: 10, p4: 10 },
      bookedSides: ["d1"],
      snapshot: snapshotFor(vorD1),
    });
    expect(readMatchdayResolveSnapshot(nachD1, scope)).not.toBeNull();
  });

  it("verwirft ihn zwischen D1 und D2, wenn sich die NOCH OFFENE Seite geaendert hat", () => {
    const vorD1 = buildGameState({});
    const nachD1 = buildGameState({
      d2Players: ["p3", "p9"],
      bookedSides: ["d1"],
      snapshot: snapshotFor(vorD1),
    });
    expect(readMatchdayResolveSnapshot(nachD1, scope)).toBeNull();
  });

  it("verwirft ihn, sobald der Spieltag durch ist — dann gilt das gebuchte Ergebnis", () => {
    const basis = buildGameState({});
    const durch = buildGameState({ bookedSides: ["d1", "d2"], snapshot: snapshotFor(basis) });
    // Selbst der bis auf das letzte Bit passende Snapshot darf hier nichts mehr ueberstimmen.
    expect(readMatchdayResolveSnapshot(durch, scope)).toBeNull();
  });

  it("verwirft einen Alt-Snapshot ohne seitenweise Signatur (nicht mehr pruefbar)", () => {
    const vorD1 = buildGameState({});
    const alt = snapshotFor(vorD1);
    delete alt.sideSignatures;
    const nachD1 = buildGameState({ bookedSides: ["d1"], snapshot: alt });
    expect(readMatchdayResolveSnapshot(nachD1, scope)).toBeNull();
  });
});

function stageTeam(teamId: string, rank: number, score: number): StagePreviewTeam {
  return {
    teamId,
    code: teamId,
    name: teamId,
    logoUrl: null,
    rank,
    score,
    teamPoints: null,
    players: [],
    missingLineup: false,
    captainPlayerId: null,
    captainName: null,
  };
}

describe("Buehne: Vorschau nur, wenn sie das Gebuchte trifft", () => {
  it("nimmt die Vorschau, solange Score und Rang uebereinstimmen", () => {
    const vorschau = [stageTeam("A-A", 1, 351.6), stageTeam("B-B", 2, 236.2)];
    const gebucht = [stageTeam("A-A", 1, 351.6), stageTeam("B-B", 2, 236.2)];
    expect(disciplineStagePreviewMatchesBooked(vorschau, gebucht)).toBe(true);
    expect(chooseDisciplineStageTeams({ previewTeams: vorschau, bookedTeams: gebucht }).source).toBe("preview");
  });

  it("nimmt das Gebuchte, sobald ein Score abweicht — der gemessene 0,5-Fall", () => {
    // L-R am Messkoerper: Vorschau 351,1 · gebucht 351,6.
    const vorschau = [stageTeam("L-R", 1, 351.1)];
    const gebucht = [stageTeam("L-R", 1, 351.6)];
    expect(disciplineStagePreviewMatchesBooked(vorschau, gebucht)).toBe(false);
    const entschieden = chooseDisciplineStageTeams({ previewTeams: vorschau, bookedTeams: gebucht });
    expect(entschieden.source).toBe("booked");
    expect(entschieden.teams?.[0]?.score).toBe(351.6);
  });

  it("nimmt das Gebuchte, sobald ein Rang abweicht — auch bei gleichem Score", () => {
    const vorschau = [stageTeam("S-C", 28, 80.9)];
    const gebucht = [stageTeam("S-C", 31, 80.9)];
    const entschieden = chooseDisciplineStageTeams({ previewTeams: vorschau, bookedTeams: gebucht });
    expect(entschieden.source).toBe("booked");
    expect(entschieden.teams?.[0]?.rank).toBe(31);
  });

  it("laesst Rundungsrauschen unter 0,05 durchgehen", () => {
    const vorschau = [stageTeam("A-A", 1, 100.04)];
    const gebucht = [stageTeam("A-A", 1, 100)];
    expect(chooseDisciplineStageTeams({ previewTeams: vorschau, bookedTeams: gebucht }).source).toBe("preview");
  });

  it("nimmt die Vorschau, wenn noch nichts gebucht ist (die Disziplin laeuft gerade)", () => {
    const vorschau = [stageTeam("A-A", 1, 100)];
    expect(chooseDisciplineStageTeams({ previewTeams: vorschau, bookedTeams: null }).source).toBe("preview");
  });

  it("erfindet nichts, wenn beide Quellen fehlen", () => {
    const entschieden = chooseDisciplineStageTeams({ previewTeams: null, bookedTeams: null });
    expect(entschieden.teams).toBeNull();
    expect(entschieden.source).toBe("none");
  });

  it("meldet Abweichung, wenn ein Team in der Vorschau ganz fehlt", () => {
    const vorschau = [stageTeam("A-A", 1, 100)];
    const gebucht = [stageTeam("A-A", 1, 100), stageTeam("B-B", 2, 90)];
    expect(disciplineStagePreviewMatchesBooked(vorschau, gebucht)).toBe(false);
  });
});
