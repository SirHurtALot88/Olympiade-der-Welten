/**
 * DIE GEGENPROBE ZUR APRON-BREMSE — Messpfad, keine Spielregel.
 *
 * CHRIS: „Können wir das messen wie sehr der bremsfaktor sich real auswirkt?"
 *
 * Um das zu messen, braucht es zu jeder Rücklage die Zahl, die DIESELBE Rechnung ohne Bremse
 * ergäbe. Die naheliegende Abkürzung — `ohne = mit × faktor` — ist falsch, sobald der Zweig unter
 * der Bremse greift, der die Rücklage bei unterbesetztem Kader zusammenstreicht (`max(5, min(
 * reserve × 0.45, reserve − 10))`). Genau dieser Zweig greift in der Vorsaison, also im Kaufmoment.
 *
 * Deshalb liefert `resolveTeamCashRunwayReserve` die Gegenrechnung selbst (`apronBremseAus`).
 * Dieser Test hält fest, dass die Option genau das tut und nichts anderes: sie muss dieselbe Zahl
 * liefern wie ein Stand, in dem das Team gar nicht über seiner Decke steht.
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";
import { resolveApronTighteningMultiplier } from "@/lib/ai/ai-cash-salary-target-service";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";

const TEAM = "M-M";

/**
 * Frischer Stand mit FESTGESETZTEN Linien. Zwei Schritte sind dafür nötig, weil die Linien nur
 * dann aus dem Snapshot kommen, wenn das Kauffenster zu ist (`areSeasonApronLinesFrozen`): erst
 * eine Tabellenbuchung eintragen (schliesst das Fenster), dann den Snapshot setzen. Beide Stände
 * dieses Tests bekommen dieselbe Buchung — sie kann also nichts verschieben, was verglichen wird.
 */
function mitLinien(line1: number, line2: number) {
  const gs = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
  gs.seasonState.standingsApplyLogs = [
    ...(gs.seasonState.standingsApplyLogs ?? []),
    { seasonId: gs.season.id, matchday: 1, appliedAt: "2026-01-01T00:00:00.000Z" } as never,
  ];
  const snapshot = gs.seasonState.apronLinesSnapshot!;
  gs.seasonState.apronLinesSnapshot = { ...snapshot, line1, line2 };
  return gs;
}

describe("Apron-Bremse — die Gegenrechnung kommt aus derselben Rechenstelle", () => {
  it("ueber der Decke bremst die Ruecklage nach oben", () => {
    const gs = mitLinien(1, 2);
    expect(resolveApronTighteningMultiplier(gs, TEAM)).toBeLessThan(1);
    const mit = resolveTeamCashRunwayReserve(gs, TEAM);
    const ohne = resolveTeamCashRunwayReserve(gs, TEAM, { apronBremseAus: true });
    expect(mit).toBeGreaterThan(ohne);
  });

  it("`apronBremseAus` liefert exakt die Ruecklage eines Teams unter seiner Decke", () => {
    const eng = mitLinien(1, 2);
    const weit = mitLinien(9999, 99999);
    expect(resolveApronTighteningMultiplier(eng, TEAM)).toBeLessThan(1);
    expect(resolveApronTighteningMultiplier(weit, TEAM)).toBe(1);
    // Nur die Linien unterscheiden die beiden Staende — alles andere (Kader, Cash, Gebaeude,
    // Hortungsfaktoren) ist identisch. Also muss die entbremste Rechnung dieselbe Zahl liefern.
    expect(resolveTeamCashRunwayReserve(eng, TEAM, { apronBremseAus: true })).toBe(
      resolveTeamCashRunwayReserve(weit, TEAM),
    );
  });

  it("unter der Decke aendert die Option nichts", () => {
    const gs = mitLinien(9999, 99999);
    expect(resolveTeamCashRunwayReserve(gs, TEAM, { apronBremseAus: true })).toBe(
      resolveTeamCashRunwayReserve(gs, TEAM),
    );
  });
});
