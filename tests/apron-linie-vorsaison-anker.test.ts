/**
 * DER VORSAISON-ANKER — die Apron-Linien dürfen im Kaufmoment nicht ins Gehalts-Tal fallen.
 *
 * CHRIS: „die apron linie ist sonst ja nur in S1 korrekt und danach immer falsch das ist ein
 * grundproblem — fixe das sonst können wir nix messen".
 *
 * Er hat recht, und es ist nachgemessen (docs/BEFUND-APRON-BREMSE-KAUFMOMENT.md): im Augenblick,
 * in dem die KI kauft, sind die Verträge gerade ausgelaufen. In Saison 4 einer Simulation stand der
 * Median vor den Käufen bei 39,7 (Linien 49,6/63,5) und danach bei 55,2 (Linien 69,1/88,4) — die
 * KI entschied gegen eine Grenze, die 28 % zu tief lag.
 *
 * Der Anker liest den Snapshot der abgerechneten Vorsaison, der den Saisonübergang ohnehin
 * überlebt. Verankert wird der MEDIAN, nicht die fertige Linie: ein alter Snapshot trägt die
 * Faktoren von damals, und die Regel gilt immer in ihrer heutigen Fassung.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  APRON_LINE_1_MEDIAN_FACTOR,
  APRON_LINE_2_MEDIAN_FACTOR,
  computeApronLines,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";

/** Frischer Stand mit offenem Kauffenster und einem Snapshot aus der VORSAISON. */
function mitVorsaisonSnapshot(overrides: Partial<{ medianSalary: number; usedReferenceSalary: boolean; seasonId: string }>) {
  const gs = structuredClone(createSingleplayerGameState()) as GameState;
  gs.seasonState.apronLinesSnapshot = {
    seasonId: overrides.seasonId ?? "season-vorher",
    frozenAtMatchdayId: "matchday-10",
    createdAt: "2026-01-01T00:00:00.000Z",
    frozenAtEvent: "transfers_finalized",
    medianSalary: overrides.medianSalary ?? 55.2,
    line1: (overrides.medianSalary ?? 55.2) * 1.1,
    line2: (overrides.medianSalary ?? 55.2) * 1.25,
    usedReferenceSalary: overrides.usedReferenceSalary ?? false,
  } as never;
  return gs;
}

describe("Apron-Linien — Anker aus der Vorsaison", () => {
  it("der Anker hebt die Linien, wenn der Live-Median im Tal steht", () => {
    const gs = mitVorsaisonSnapshot({ medianSalary: 999 });
    const live = computeApronLines(gs);
    const gilt = resolveSeasonApronLines(gs);
    expect(live.medianSalary).toBeLessThan(999);
    expect(gilt.medianSalary).toBe(999);
    expect(gilt.line1).toBeCloseTo(999 * APRON_LINE_1_MEDIAN_FACTOR, 0);
    expect(gilt.line2).toBeCloseTo(999 * APRON_LINE_2_MEDIAN_FACTOR, 0);
  });

  it("die Linien tragen die HEUTIGEN Faktoren, nicht die des alten Snapshots", () => {
    // Der Snapshot wurde mit 1,1 / 1,25 eingefroren (so stand es auf Chris' Spielstand).
    const gs = mitVorsaisonSnapshot({ medianSalary: 999 });
    const gilt = resolveSeasonApronLines(gs);
    expect(gilt.line1).not.toBeCloseTo(999 * 1.1, 0);
    expect(gilt.line2).not.toBeCloseTo(999 * 1.25, 0);
  });

  it("ruestet die Liga ueber das Vorjahr hinaus, gewinnt der Live-Median", () => {
    const gs = mitVorsaisonSnapshot({ medianSalary: 1 });
    const live = computeApronLines(gs);
    expect(resolveSeasonApronLines(gs)).toEqual(live);
  });

  it("ein Snapshot der LAUFENDEN Saison ankert nicht — dort greift das Einfrieren", () => {
    const gs = mitVorsaisonSnapshot({ medianSalary: 999, seasonId: "season-1" });
    expect(gs.season.id).toBe("season-1");
    expect(resolveSeasonApronLines(gs)).toEqual(computeApronLines(gs));
  });

  it("ein Referenz-Notbehelf ankert nicht — er misst keine gespielte Liga", () => {
    const gs = mitVorsaisonSnapshot({ medianSalary: 999, usedReferenceSalary: true });
    expect(resolveSeasonApronLines(gs)).toEqual(computeApronLines(gs));
  });

  it("ohne Vorsaison-Snapshot bleibt alles wie bisher (Saison 1, frischer Stand)", () => {
    const gs = structuredClone(createSingleplayerGameState()) as GameState;
    delete (gs.seasonState as { apronLinesSnapshot?: unknown }).apronLinesSnapshot;
    expect(resolveSeasonApronLines(gs)).toEqual(computeApronLines(gs));
  });
});
