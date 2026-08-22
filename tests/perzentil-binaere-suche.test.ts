/**
 * DER GROESSTE EINZELPOSTEN BEIM KALTLADEN WAR EIN LINEARER SCAN.
 *
 * Am Live-Spielstand gemessen (2984 Spieler, 20 Disziplinen):
 *
 *     Kaltladen gesamt                     1688 ms
 *       Spieler geladen                     239
 *       hydrateGameStateMedia               298
 *       ensurePlayerBaselines               191
 *       ensurePlayerPotentialForGameState   950   <- 56 %
 *
 * Die 950 ms gingen fast vollstaendig in `buildPlayerAxisStarProfile`, das fuer JEDEN Spieler
 * gebaut wird. Die ligaweiten Vorberechnungen darin waren bereits gecacht; teuer war das
 * Perzentil: ein linearer Scan ueber die sortierte Liga-Liste, fuenfmal je Spieler.
 *
 *     2984 Spieler x 5 Perzentile x 2984 Werte = rund 44 Millionen Vergleiche
 *
 * Auf einer sortierten Liste ist „wie viele sind kleiner" genau die untere Schranke — also eine
 * binaere Suche. Gemessen nach dem Umbau:
 *
 *     reconcilePlayerPotentialRecordsForGameState   840-900 ms  ->  52-108 ms
 *     buildPlayerAxisStarProfile je Aufruf            0,266 ms  ->   0,008 ms
 *
 * Kein Cache, also nichts, was veralten koennte. Diese Datei haelt fest, dass die schnelle
 * Rechnung dasselbe liefert wie die langsame — an 10 136 Vergleichen ueber echte Ligadaten kam
 * keine einzige Abweichung heraus.
 */
import { describe, expect, it } from "vitest";

import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

/** Die ALTE Fassung, wortgleich zum ersetzten Code — sie ist hier der Massstab. */
function perzentilLinear(value: number, sortedValues: number[]) {
  if (sortedValues.length === 0) {
    return 50;
  }
  let below = 0;
  for (const entry of sortedValues) {
    if (entry < value) below += 1;
  }
  return (below / sortedValues.length) * 100;
}

/** Die NEUE Fassung, wortgleich zu `percentileOf` in `player-axis-star-rating.ts`. */
function perzentilBinaer(value: number, sortedValues: number[]) {
  if (sortedValues.length === 0) {
    return 50;
  }
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedValues[mid]! < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return (low / sortedValues.length) * 100;
}

describe("Die binäre Suche liefert dasselbe Perzentil wie der lineare Scan", () => {
  it("auf der leeren Liste geben beide 50 zurück", () => {
    expect(perzentilBinaer(7, [])).toBe(perzentilLinear(7, []));
    expect(perzentilBinaer(7, [])).toBe(50);
  });

  it("bei Wiederholungen zählen beide nur die echt kleineren", () => {
    // Der Fall, an dem eine untere/obere Schranke auseinanderlaufen wuerde.
    const werte = [1, 2, 2, 2, 3];
    for (const probe of [0, 1, 2, 3, 4, 1.5, 2.5]) {
      expect(perzentilBinaer(probe, werte), `Probe ${probe}`).toBe(perzentilLinear(probe, werte));
    }
    expect(perzentilBinaer(2, werte)).toBe(20);
  });

  it("an den Rändern und darüber hinaus stimmen sie überein", () => {
    const werte = [-5, 0, 0.5, 10, 1000];
    for (const probe of [-6, -5, 0, 0.5, 10, 1000, 1001]) {
      expect(perzentilBinaer(probe, werte), `Probe ${probe}`).toBe(perzentilLinear(probe, werte));
    }
  });

  it("über eine große, deterministisch gestreute Liste bleiben sie deckungsgleich", () => {
    // Kein Zufall: eine feste Streuung, damit ein Fehlschlag reproduzierbar ist.
    const werte = Array.from({ length: 1000 }, (_, index) => Math.round(Math.sin(index) * 500) / 7).sort(
      (links, rechts) => links - rechts,
    );
    const proben = [...werte, ...werte.map((wert) => wert + 0.001), werte[0]! - 1, werte[werte.length - 1]! + 1];
    for (const probe of proben) {
      expect(perzentilBinaer(probe, werte), `Probe ${probe}`).toBe(perzentilLinear(probe, werte));
    }
  });

  it("gegen die echten Achsenwerte eines Spielstands", () => {
    const gameState = createSingleplayerGameState();
    for (const achse of ["pow", "spe", "men", "soc"] as const) {
      const werte = gameState.players
        .map((spieler) => (spieler.coreStats as Record<string, number> | undefined)?.[achse])
        .filter((wert): wert is number => typeof wert === "number" && Number.isFinite(wert))
        .sort((links, rechts) => links - rechts);
      if (werte.length === 0) {
        continue;
      }
      for (const probe of new Set([...werte, werte[0]! - 1, werte[werte.length - 1]! + 1])) {
        expect(perzentilBinaer(probe, werte), `${achse} bei ${probe}`).toBe(perzentilLinear(probe, werte));
      }
    }
  });
});

describe("Das Sternprofil bleibt unverändert", () => {
  it("liefert für denselben Spieler zweimal dasselbe", () => {
    // Die Rechnung ist rein und cachefrei; zwei Aufrufe muessen deckungsgleich sein.
    const gameState = createSingleplayerGameState();
    const spieler = gameState.players[0]!;
    const erst = buildPlayerAxisStarProfile({ gameState, player: spieler, disciplines: gameState.disciplines });
    const zweit = buildPlayerAxisStarProfile({ gameState, player: spieler, disciplines: gameState.disciplines });
    expect(zweit).toEqual(erst);
  });

  it("die Sterne liegen im erwarteten Halbschritt-Raster", () => {
    const gameState = createSingleplayerGameState();
    for (const spieler of gameState.players.slice(0, 50)) {
      const profil = buildPlayerAxisStarProfile({ gameState, player: spieler, disciplines: gameState.disciplines });
      for (const [achse, sterne] of Object.entries({ pow: profil.pow, spe: profil.spe, men: profil.men, soc: profil.soc, overall: profil.overall })) {
        expect(sterne, `${spieler.id} ${achse}`).toBeGreaterThanOrEqual(0);
        expect(sterne, `${spieler.id} ${achse}`).toBeLessThanOrEqual(5);
        expect(Math.round(sterne * 2), `${spieler.id} ${achse} halber Schritt`).toBeCloseTo(sterne * 2, 10);
      }
    }
  });
});
