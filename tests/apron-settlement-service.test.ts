/**
 * APRON-SETTLEMENT-SERVICE — Einfrieren der Linien und Anwenden der Abrechnung auf `team.cash`.
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { computeApronLines } from "@/lib/season/apron-service";
import {
  applyApronSettlement,
  ensureSeasonApronLinesFrozen,
  previewApronSettlement,
} from "@/lib/season/apron-settlement-service";

describe("Apron-Settlement — Einfrieren", () => {
  it("friert die Linien fuer die aktuelle Saison genau einmal ein", () => {
    const gs = structuredClone(createSingleplayerGameState());
    expect(gs.seasonState.apronLinesSnapshot).toBeUndefined();
    const frozen = ensureSeasonApronLinesFrozen(gs);
    expect(frozen.seasonState.apronLinesSnapshot?.seasonId).toBe(gs.season.id);
    const expected = computeApronLines(gs);
    expect(frozen.seasonState.apronLinesSnapshot?.line1).toBeCloseTo(expected.line1, 9);
    expect(frozen.seasonState.apronLinesSnapshot?.line2).toBeCloseTo(expected.line2, 9);
  });

  it("ist idempotent: ein zweiter Aufruf überschreibt den Snapshot nicht", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const frozenOnce = ensureSeasonApronLinesFrozen(gs);
    const snapshotOnce = frozenOnce.seasonState.apronLinesSnapshot;
    // Gehälter würden sich ändern (simuliert durch leere Rosters) — die eingefrorene Linie darf sich
    // NICHT mehr bewegen, genau das ist der Punkt des Einfrierens.
    const changed = { ...frozenOnce, rosters: [] };
    const frozenTwice = ensureSeasonApronLinesFrozen(changed);
    expect(frozenTwice.seasonState.apronLinesSnapshot).toEqual(snapshotOnce);
  });
});

describe("Apron-Settlement — Vorschau/Anwendung", () => {
  it("ohne eingefrorenen Snapshot ist keine Abrechnung möglich (kein Ad-hoc-Berechnen am Saisonende)", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const preview = previewApronSettlement(gs);
    expect(preview.canApply).toBe(false);
    expect(preview.blockingReasons).toContain("apron_lines_not_frozen");
  });

  it("apply ist idempotent: ein zweiter Lauf verändert das Cash nicht erneut", () => {
    const gs = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const first = applyApronSettlement({ gameState: gs, saveId: "test-save", execute: true });
    const second = applyApronSettlement({ gameState: first.gameState, saveId: "test-save", execute: true });
    expect(second.applied).toBe(false);
    expect(second.gameState).toBe(first.gameState);
  });

  it("Cash-Erhaltung: die Summe aller Cash-Deltas aus der Abrechnung ist 0", () => {
    const gs = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
    const before = new Map(gs.teams.map((team) => [team.teamId, team.cash] as const));
    const result = applyApronSettlement({ gameState: gs, saveId: "test-save", execute: true });
    const totalDelta = result.gameState.teams.reduce(
      (sum, team) => sum + (team.cash - (before.get(team.teamId) ?? team.cash)),
      0,
    );
    expect(totalDelta).toBeCloseTo(0, 6);
  });
});
