import { describe, expect, it } from "vitest";

import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import {
  SPURT_STATIONSDUELL_PPS_JE_SIEG,
  SPURT_STATIONSDUELL_PPS_MAX,
  computeArenaTeamPointsFromFixtureResults,
  computeIndividualBoxscorePpsFromFixtureResults,
  ppsAusStationsduellen,
} from "@/lib/resolve/battle-mode-arena-team-points";

/**
 * STATIONSDUELL-BONUS (Spurt, Chris 10.11., docs/design/spurt-stationsduell-sichtbar-10-11.md):
 * "Gewonnene duelle koennen fuer die Spieler auch in die PPs mit beitragen, bringen dem team aber
 * keine zusaetzlichen punkte fuers scoring". Geprueft: der Bonus landet beim Spieler, ist klein und
 * gedeckelt, gilt nur fuer Spurt -- und die Team-Punkte haengen ausschliesslich an `seiten`.
 */
const fixture = (duelleHeim: number | undefined, duelleGast: number | undefined): ArenaFixtureResult => ({
  homeTeamId: "heim",
  awayTeamId: "gast",
  seiten: [21, 34],
  boxscore: [
    { name: "A", wert: 6, playerId: "p-a", side: "home", ...(duelleHeim === undefined ? {} : { duelle: duelleHeim }) },
    { name: "B", wert: 6, playerId: "p-b", side: "away", ...(duelleGast === undefined ? {} : { duelle: duelleGast }) },
  ],
});

describe("Spurt-Stationsduell: reine Spieler-PP-Nebenspur", () => {
  it("je Sieg JE_SIEG PPs, gedeckelt bei MAX, nur fuer Spurt", () => {
    expect(ppsAusStationsduellen("spurt", 0)).toBe(0);
    expect(ppsAusStationsduellen("spurt", undefined)).toBe(0);
    expect(ppsAusStationsduellen("spurt", 3)).toBeCloseTo(3 * SPURT_STATIONSDUELL_PPS_JE_SIEG, 10);
    expect(ppsAusStationsduellen("spurt", 99)).toBe(SPURT_STATIONSDUELL_PPS_MAX);
    expect(ppsAusStationsduellen("staffel", 5)).toBe(0);
    expect(SPURT_STATIONSDUELL_PPS_MAX).toBeLessThanOrEqual(0.5);
  });

  it("gleicher Rennwert, mehr gewonnene Duelle -> mehr Spieler-PPs, um genau den Bonus", () => {
    const pps = computeIndividualBoxscorePpsFromFixtureResults([fixture(4, 0)], 6, "spurt");
    const a = pps.get("p-a")!;
    const b = pps.get("p-b")!;
    expect(a - b).toBeCloseTo(4 * SPURT_STATIONSDUELL_PPS_JE_SIEG, 2);
  });

  it("ohne `duelle`-Feld sind die PPs identisch zum Fall mit 0 Siegen (Vorher-Verhalten)", () => {
    const ohne = computeIndividualBoxscorePpsFromFixtureResults([fixture(undefined, undefined)], 6, "spurt");
    const null0 = computeIndividualBoxscorePpsFromFixtureResults([fixture(0, 0)], 6, "spurt");
    expect([...null0.entries()]).toEqual([...ohne.entries()]);
  });

  it("Team-Punkte sind von den Duellen unberuehrt (nur `seiten` zaehlt)", () => {
    const seeds = new Map([["heim::gast", "s"]]);
    const ohne = computeArenaTeamPointsFromFixtureResults([fixture(undefined, undefined)], seeds);
    const mit = computeArenaTeamPointsFromFixtureResults([fixture(6, 0)], seeds);
    expect([...mit.entries()]).toEqual([...ohne.entries()]);
    expect(mit.get("gast")?.teamPoints).toBeGreaterThan(mit.get("heim")?.teamPoints ?? 0);
  });
});
