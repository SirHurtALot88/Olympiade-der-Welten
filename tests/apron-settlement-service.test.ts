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

  /** Markiert die Saison als GESPIELT — ab dem ersten abgerechneten Spieltag rasten die Linien ein. */
  function mitGespieltemSpieltag<T extends ReturnType<typeof createSingleplayerGameState>>(gs: T): T {
    return {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        matchdayResults: [
          ...(gs.seasonState.matchdayResults ?? []),
          { id: "md-1-result", seasonId: gs.season.id, matchdayId: gs.matchdayState.matchdayId },
        ],
      },
    } as T;
  }

  /**
   * FRÜHER hiess dieser Fall „ein zweiter Aufruf überschreibt den Snapshot nicht" — ohne Bedingung.
   * Das war zu früh gedacht: der erste Aufruf fällt in den Saisonübergang, also VOR den Kaderbau
   * der neuen Saison. Auf Chris' Spielstand kamen danach alle 106 Zugänge (Median 45,0 → 69,8), und
   * die eingefrorene 2. Linie bei 56,2 liess 28 von 32 Teams darüber stehen.
   *
   * Die Absicht des Einfrierens bleibt und wird unten geprüft — sie gilt nur ab dem ersten
   * abgerechneten Spieltag, nicht schon davor.
   */
  it("führt die Linien nach, solange kein Spieltag abgerechnet ist", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const frozenOnce = ensureSeasonApronLinesFrozen(gs);
    const snapshotOnce = frozenOnce.seasonState.apronLinesSnapshot;
    // Gehälter ändern sich (simuliert durch leere Rosters) — in der Aufbauphase MUSS die Linie folgen.
    const changed = { ...frozenOnce, rosters: [] };
    const frozenTwice = ensureSeasonApronLinesFrozen(changed);
    expect(frozenTwice.seasonState.apronLinesSnapshot).not.toEqual(snapshotOnce);
    expect(frozenTwice.seasonState.apronLinesSnapshot?.line2).toBeCloseTo(
      computeApronLines(changed).line2,
      9,
    );
  });

  it("ist idempotent, sobald der erste Spieltag abgerechnet ist", () => {
    const gs = mitGespieltemSpieltag(structuredClone(createSingleplayerGameState()));
    const frozenOnce = ensureSeasonApronLinesFrozen(gs);
    const snapshotOnce = frozenOnce.seasonState.apronLinesSnapshot;
    // Ab hier darf sich die Linie NICHT mehr bewegen — niemand soll die Grenze mit sich ziehen.
    const changed = mitGespieltemSpieltag({ ...frozenOnce, rosters: [] });
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
