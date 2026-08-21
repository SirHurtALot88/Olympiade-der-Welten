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
import { FIXED_ROSTER_MIN } from "@/lib/foundation/roster-limits";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";

/**
 * BEWUSST EIN TEAM MIT VOLLEM MINIMUM. `M-M` stand im frischen Stand bei 3 von 8 Plaetzen und ist
 * damit von der Bremse ausgenommen (siehe `resolveApronTighteningMultiplier`: wer nicht spielfaehig
 * ist, wird nicht gebremst). Ein Test, der dort misst, prueft die Ausnahme statt der Bremse — und
 * war genau deshalb kurz gruen aus dem falschen Grund.
 */
const TEAM = "D-L";

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
  it("Vorbedingung: das Messteam erfuellt das Kader-Minimum, sonst greift die Ausnahme", () => {
    const gs = mitLinien(1, 2);
    expect(gs.rosters.filter((entry) => entry.teamId === TEAM).length).toBeGreaterThanOrEqual(FIXED_ROSTER_MIN);
  });

  it("wer unter dem Kader-Minimum steht, wird NICHT gebremst — Spielfaehigkeit geht vor", () => {
    const gs = mitLinien(1, 2);
    const duenn = {
      ...gs,
      rosters: gs.rosters.filter((entry) => entry.teamId !== TEAM || gs.rosters.indexOf(entry) % 3 === 0),
    };
    expect(duenn.rosters.filter((entry) => entry.teamId === TEAM).length).toBeLessThan(FIXED_ROSTER_MIN);
    expect(resolveApronTighteningMultiplier(duenn, TEAM)).toBe(1);
  });

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
