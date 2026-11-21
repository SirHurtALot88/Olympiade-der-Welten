import { describe, expect, it } from "vitest";

import { bestimmeTaktgeberZustand } from "@/app/foundation/shell/FoundationTaktgeber";
import { getCachedPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import type { GameState } from "@/lib/data/olyDataTypes";

function minimalerStand(): GameState {
  return {
    season: { id: "season-1" },
    disciplines: [],
    players: [],
    rosters: [],
    teams: [],
    teamIdentities: [],
    seasonState: { matchdayResults: [], disciplineResults: [], playerDisciplinePerformances: [] },
  } as unknown as GameState;
}

describe("Spieltag-Tempo 21.11.: Zwischenspeicher der Leistungskarte", () => {
  it("dieselben Listen liefern dieselbe Karte, auch in einer neuen Huelle", () => {
    const stand = minimalerStand();
    const huelle = { ...stand, seasonState: { ...stand.seasonState } } as GameState;
    expect(getCachedPlayerSeasonPerformanceMap(huelle)).toBe(getCachedPlayerSeasonPerformanceMap(stand));
  });

  it("Fortschreiben der Ergebnisliste an Ort und Stelle erzeugt eine frische Karte", () => {
    const stand = minimalerStand();
    const vorher = getCachedPlayerSeasonPerformanceMap(stand);
    (stand.seasonState.matchdayResults as unknown[]).push({ id: "md-1" });
    expect(getCachedPlayerSeasonPerformanceMap(stand)).not.toBe(vorher);
  });
});

describe("Spieltag-Tempo 21.11.: Abgabe-Knopf", () => {
  it("ein laufender Speichervorgang zaehlt als laeuft (Zustand des Taktgebers bleibt sonst unveraendert)", () => {
    expect(bestimmeTaktgeberZustand("is-ready", [])).toBe("weiter");
  });
});
