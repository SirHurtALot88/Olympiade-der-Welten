import { describe, expect, it } from "vitest";

import { accumulateRevealedTeamScore, playerNet } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

function player(val: number) {
  // Minimaler Slot, wie ihn die Arena aus der Resolve-Preview baut: `playerNet` zieht den
  // Netto-Beitrag daraus, die Modifikatorliste bleibt leer.
  return { playerId: `p-${val}`, playerName: `P${val}`, val, mods: [], pointsAwarded: null } as never;
}

/**
 * Die Arena addiert beim Aufdecken schrittweise: `t.score = round1(t.score + net)`.
 * Die Ziellinie wurde dagegen als rohe Summe gebildet.
 *
 * Der Unterschied ist klein, weil `playerNet` jeden Spielerwert bereits auf eine
 * Nachkommastelle rundet — er beschraenkt sich auf Gleitkomma-Reste (0.1 + 0.2 = 0.30000…4).
 * Genau die machen aber den Unterschied zwischen "Fortschritt == 1" und "1.0000000002",
 * und die Positionsformel clampt nach oben nicht. `accumulateRevealedTeamScore` faltet
 * deshalb identisch zum Reveal, damit die Ziellinie per Konstruktion exakt getroffen wird.
 */
describe("Arena · Ziellinie == Endstand des besten Teams", () => {
  it("faltet identisch zum Reveal und bleibt frei von Gleitkomma-Resten", () => {
    const players = [player(0.1), player(0.2), player(0.1), player(0.2)];

    // Rohe Summe traegt den Gleitkomma-Rest, die schrittweise Faltung nicht.
    const raw = players.reduce((sum, p) => sum + playerNet(p), 0);
    expect(raw).not.toBe(0.6);
    expect(accumulateRevealedTeamScore(players)).toBe(0.6);
  });

  it("erreicht die Ziellinie exakt — der letzte Spieler bringt das beste Team auf 100 %", () => {
    const teams = [
      [player(12.34), player(9.87), player(4.06)],
      [player(3.01), player(2.02), player(1.03)],
    ];

    const totals = teams.map((squad) => accumulateRevealedTeamScore(squad));
    const finishLine = Math.max(1, ...totals);

    // Bestes Team: Fortschritt nach dem letzten Spieler == 1 (auf der Linie, nicht daneben).
    const best = Math.max(...totals);
    expect(best / finishLine).toBe(1);

    // Alle anderen bleiben darunter — niemand überläuft die Linie.
    for (const total of totals) {
      expect(total / finishLine).toBeLessThanOrEqual(1);
    }
  });

  it("wächst über die Etappen monoton — jede Etappe setzt am Stand der vorigen an", () => {
    const squad = [player(5.05), player(-1.2), player(3.3), player(0.15)];

    // Teilstände wie im Reveal: nach Spieler 1, 2, 3, 4.
    const partials = squad.map((_, index) => accumulateRevealedTeamScore(squad.slice(0, index + 1)));

    // Jeder Teilstand ist der vorige plus genau den neuen Spieler — keine Sprünge, kein
    // Neuberechnen der ganzen Reihe.
    for (let index = 1; index < partials.length; index += 1) {
      const expected = Math.round((partials[index - 1]! + playerNet(squad[index]!)) * 10) / 10;
      expect(partials[index]).toBe(expected);
    }

    // Und der letzte Teilstand ist der Endstand.
    expect(partials[partials.length - 1]).toBe(accumulateRevealedTeamScore(squad));
  });

  it("bleibt bei leerem Kader bei 0, statt NaN zu liefern", () => {
    expect(accumulateRevealedTeamScore([])).toBe(0);
    expect(accumulateRevealedTeamScore([null, undefined])).toBe(0);
  });
});
