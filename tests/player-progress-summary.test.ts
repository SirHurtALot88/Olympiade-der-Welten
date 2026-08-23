/**
 * DIE ENTWICKLUNGSBILANZ VERGLEICHT PUNKTE JE EINSATZ — NICHT SAISONSUMMEN.
 *
 * GEMELDET VON CHRIS (`diwdvh`, „Team · Spieler", Spielstand `hwz8fk`): „bei PP Entwicklung und
 * Attributentwicklung fehlt der Startwert! so sieht man nicht ob die Spieler sich in S1 schon
 * verbessert haben" — gesehen an Saison 2, SPIELTAG 1.
 *
 * WAS DORT WIRKLICH SCHIEFLAG: `pow`…`soc` sind `powPoints`…`socPoints` aus dem Saison-
 * Schnappschuss, also GESAMMELTE Punkte einer Saison. Die Bilanz rechnete letzte minus erste
 * Saison — am ersten Spieltag verglich sie also eine volle Saison mit einer, die noch gar nicht
 * stattgefunden hatte.
 *
 * AM ABBILD `89rv3s` NACHGEMESSEN (Saison 2, Spieltag 1, Chris' Kader C-C, 12 Spieler):
 *
 *   Spieler   S1 Achsen-PP / Einsätze     S2      Bilanz alt
 *   1579           11,6 / 8                0 / 0     −11,6
 *   1288            9,6 / 8                0 / 0      −9,6
 *   2869            8,6 / 8                0 / 0      −8,6
 *   0598            7,4 / 7                0 / 0      −7,4
 *
 * ZWÖLF VON ZWÖLF im tiefen Minus, ohne dass ein einziger schlechter geworden wäre.
 *
 * CHRIS' ENTSCHEIDUNG (Weg b): Punkte je Einsatz. Das leistet zweierlei — eine angefangene Saison
 * wird mit einer vollen vergleichbar, und am Spieltag 0 gibt es gar keinen Wert statt eines
 * falschen. OVR bleibt ein Niveau und wird NICHT geteilt.
 */
import { describe, expect, it } from "vitest";

import {
  buildPlayerProgressSummary,
  formatProgressDelta,
  type PlayerProgressHistoryRow,
} from "@/lib/foundation/player-progress-summary";

function saison(input: Partial<PlayerProgressHistoryRow> & { seasonId: string }): PlayerProgressHistoryRow {
  return {
    seasonName: input.seasonId.replace("season-", "Season "),
    isActiveSeason: false,
    ovr: null,
    pow: null,
    spe: null,
    men: null,
    soc: null,
    appearances: null,
    ...input,
  };
}

describe("player progress summary", () => {
  it("returns null when no history rows exist", () => {
    expect(buildPlayerProgressSummary([])).toBeNull();
  });

  it("die Achsen werden je Einsatz verglichen, OVR als Niveau", () => {
    // S1: 8 PP aus 8 Einsätzen = 1,00 je Einsatz. S2: 6 PP aus 4 Einsätzen = 1,50 je Einsatz.
    // Absolut wäre das ein Minus von 2 — je Einsatz ist es ein Plus von 0,50. Genau der Fall.
    const summary = buildPlayerProgressSummary([
      saison({ seasonId: "season-1", ovr: 80, pow: 8, spe: 8, men: 8, soc: 8, appearances: 8 }),
      saison({ seasonId: "season-2", ovr: 82, pow: 6, spe: 6, men: 6, soc: 6, appearances: 4, isActiveSeason: true }),
    ]);

    expect(summary?.metrics.find((m) => m.id === "pow")?.delta).toBe(0.5);
    expect(summary?.metrics.find((m) => m.id === "pow")?.tone).toBe("positive");
    expect(summary?.axisSumDelta).toBe(2);

    // OVR bleibt unberührt: 82 − 80 = 2, NICHT 82/4 − 80/8.
    const ovr = summary?.metrics.find((m) => m.id === "ovr");
    expect(ovr?.delta).toBe(2);
    expect(ovr?.perAppearance).toBe(false);
    expect(summary?.metrics.filter((m) => m.perAppearance).map((m) => m.id)).toEqual(["pow", "spe", "men", "soc"]);
  });

  it("DER GEMELDETE FALL: am Spieltag 0 steht kein Wert, nicht ein tiefes Minus", () => {
    const summary = buildPlayerProgressSummary([
      saison({ seasonId: "season-1", ovr: 70, pow: 2.9, spe: 2.9, men: 2.9, soc: 2.9, appearances: 8 }),
      saison({ seasonId: "season-2", ovr: 70, pow: 0, spe: 0, men: 0, soc: 0, appearances: 0, isActiveSeason: true }),
    ]);

    for (const id of ["pow", "spe", "men", "soc"] as const) {
      expect(summary?.metrics.find((m) => m.id === id)?.delta).toBeNull();
      expect(summary?.metrics.find((m) => m.id === id)?.tone).toBe("neutral");
    }
    expect(summary?.axisSumDelta).toBeNull();
    // Der Beleg, dass die alte Rechnung hier ein Minus gezeigt hätte:
    expect(summary?.metrics.find((m) => m.id === "pow")?.lastValue).toBeNull();
    expect(summary?.metrics.find((m) => m.id === "pow")?.firstValue).toBeCloseTo(0.36, 2);
  });

  it("gleich viele Punkte bei doppelt so vielen Einsätzen sind ein RÜCKSCHRITT", () => {
    // Die Gegenrichtung — sonst hätte die Umstellung nur Minuszeichen versteckt.
    const summary = buildPlayerProgressSummary([
      saison({ seasonId: "season-1", ovr: 70, pow: 8, spe: 8, men: 8, soc: 8, appearances: 4 }),
      saison({ seasonId: "season-2", ovr: 70, pow: 8, spe: 8, men: 8, soc: 8, appearances: 8 }),
    ]);
    expect(summary?.metrics.find((m) => m.id === "pow")?.delta).toBe(-1);
    expect(summary?.axisSumDelta).toBe(-4);
  });

  it("fehlende Einsatzzahl heisst keine Aussage — nicht null Punkte", () => {
    // Alt-Schnappschüsse können das Feld nicht führen. Unbekannt ist nicht dasselbe wie 0.
    const summary = buildPlayerProgressSummary([
      saison({ seasonId: "season-1", ovr: 70, pow: 8, spe: 8, men: 8, soc: 8, appearances: null }),
      saison({ seasonId: "season-2", ovr: 72, pow: 8, spe: 8, men: 8, soc: 8, appearances: 8 }),
    ]);
    expect(summary?.metrics.find((m) => m.id === "pow")?.delta).toBeNull();
    expect(summary?.axisSumDelta).toBeNull();
    // OVR haengt nicht an den Einsaetzen und bleibt aussagefaehig.
    expect(summary?.metrics.find((m) => m.id === "ovr")?.delta).toBe(2);
  });

  it("marks missing axis values as neutral axis sum", () => {
    const summary = buildPlayerProgressSummary([
      saison({ seasonId: "season-1", ovr: 80, pow: 1, spe: null, men: 2, soc: 3, appearances: 1 }),
      saison({ seasonId: "season-2", ovr: 82, pow: 2, spe: 4, men: 2, soc: 3, appearances: 1, isActiveSeason: true }),
    ]);

    expect(summary?.axisSumDelta).toBeNull();
    expect(summary?.metrics.find((metric) => metric.id === "ovr")?.delta).toBe(2);
  });

  it("erste und letzte Saison bleiben die Enden der Reihe", () => {
    const summary = buildPlayerProgressSummary([
      saison({ seasonId: "season-1", ovr: 88.1, pow: 8, spe: 8, men: 8, soc: 8, appearances: 8 }),
      saison({ seasonId: "season-2", ovr: 85.4, pow: 8, spe: 8, men: 8, soc: 8, appearances: 8 }),
      saison({ seasonId: "season-3", ovr: 76.7, pow: 4, spe: 4, men: 4, soc: 4, appearances: 8, isActiveSeason: true }),
    ]);

    expect(summary?.firstSeasonName).toBe("Season 1");
    expect(summary?.lastSeasonName).toBe("Season 3");
    expect(summary?.lastSeasonIsLive).toBe(true);
    expect(summary?.metrics.find((metric) => metric.id === "ovr")?.delta).toBe(-11.4);
    expect(summary?.metrics.find((metric) => metric.id === "ovr")?.tone).toBe("negative");
    expect(summary?.axisSumDelta).toBe(-2);
    expect(summary?.axisSumTone).toBe("negative");
  });

  it("formats signed deltas in de-DE", () => {
    expect(formatProgressDelta(-11.4)).toBe("-11,4");
    expect(formatProgressDelta(2)).toBe("+2");
    expect(formatProgressDelta(null)).toBe("—");
    // Zwei Stellen fuer die Werte je Einsatz — sonst wuerde +0,15 auf +0,2 aufgerundet.
    expect(formatProgressDelta(0.15, 2)).toBe("+0,15");
  });
});
