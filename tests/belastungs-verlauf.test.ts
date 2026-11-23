import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { baueBelastungsVerlauf } from "@/lib/foundation/belastungs-verlauf";

const ereignis = (matchdayId: string, playerId: string, fatigueBefore: number, seasonId = "s1") => ({
  eventId: `${matchdayId}-${playerId}`,
  seasonId,
  matchdayId,
  teamId: "t1",
  playerId,
  fatigueBefore,
  riskPercent: 1,
  roll: 50,
  result: "healthy" as const,
  timestamp: "2026-01-01T00:00:00Z",
});

describe("Belastungsverlauf je Spieltag", () => {
  const gs = {
    season: { id: "s1", matchdayIds: ["m1", "m2", "m3"] },
    seasonState: {
      injuryEvents: [ereignis("m3", "p", 55), ereignis("m1", "p", 10), ereignis("m2", "q", 99), ereignis("m1", "p", 12, "alt")],
    },
  } as unknown as GameState;

  it("liest nur den Spieler und die laufende Saison, sortiert nach Spieltag", () => {
    expect(baueBelastungsVerlauf(gs, "p")).toEqual([
      { matchdayId: "m1", spieltag: 1, wert: 10 },
      { matchdayId: "m3", spieltag: 3, wert: 55 },
    ]);
  });

  it("ohne Einsatz bleibt der Verlauf leer", () => {
    expect(baueBelastungsVerlauf(gs, "x")).toEqual([]);
  });
});
