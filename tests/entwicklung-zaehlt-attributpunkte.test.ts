/**
 * ENTWICKLUNG WIRD AM ATTRIBUT-ZUWACHS GEMESSEN — nicht am Marktwert.
 *
 * CHRIS' ENTSCHEIDUNG (Meldung `u3wlh4`, Weg 1), nachdem sein Einwand den Befund aufdeckte: „neee
 * das kann nicht sein, die spieler verbessern sich ja nur um ein paar statpoints! Das kann nicht
 * 23 mio MW unterschied ausmachen OHNE mw faktor!!!"
 *
 * WAS VORHER WAR — derselbe Fehler an ZWEI Stellen: die Sponsor-Achse `entwicklung` und das
 * Sonderziel `golden_talent_forge` rechneten beide
 * `after.marketValuePreview − before.marketValue >= Schwelle`. An 1017 Ereignissen aus drei
 * Live-Spielstaenden ist `before.marketValue` in ALLEN Faellen 0 — die Differenz war der absolute
 * Marktwert. Beide zaehlten „Spieler mit Marktwert ueber X", also praktisch den ganzen Kader.
 *
 * VORHER/NACHHER, an denselben Spielstaenden gerechnet:
 *
 *   Spielstand          Ø alt   Ø neu   Spanne alt   Spanne neu
 *   hwz8fk / 89rv3s      52 %    57 %        8–13         1–11
 *   1hf25q               53 %    38 %        7–15          0–7
 *
 * Beide im dokumentierten Korridor 35–65 %. Der eigentliche Gewinn ist die SPANNWEITE: vorher lagen
 * alle 32 Teams in einem schmalen Band, weil die Schwelle nichts aussiebte. Jetzt trennt die Achse
 * die Teams wieder.
 */
import { describe, expect, it } from "vitest";

import {
  ENTWICKLUNG_ATTRIBUT_PUNKTE,
  attributZuwachsEinesEreignisses,
  zaehleEntwickelteSpieler,
} from "@/lib/progression/spieler-entwicklung-zaehler";
import { DEFAULT_ROSTER_MAX } from "@/lib/foundation/roster-limits";

type MinimalState = Parameters<typeof zaehleEntwickelteSpieler>[0];

function ereignis(playerId: string, teamId: string, vorher: Record<string, number>, nachher: Record<string, number>) {
  return {
    playerId,
    teamId,
    seasonId: "season-1",
    progressionSnapshotBefore: { attributes: vorher },
    progressionSnapshotAfter: { attributes: nachher },
  };
}

function spielstand(events: ReturnType<typeof ereignis>[], kader: Array<[string, string]> = []): MinimalState {
  return {
    season: { id: "season-1" },
    rosters: kader.map(([playerId, teamId]) => ({ playerId, teamId })),
    playerProgressionEvents: events,
  } as unknown as MinimalState;
}

describe("Der Attribut-Zuwachs eines Ereignisses", () => {
  it("summiert ueber ALLE Attribute", () => {
    const z = attributZuwachsEinesEreignisses(ereignis("p1", "A-A", { power: 10, speed: 20 }, { power: 12, speed: 21.5 }));
    expect(z).toBe(3.5);
  });

  it("zieht Rueckschritte ab — wer verliert, hat sich nicht entwickelt", () => {
    // 285 von 1017 gemessenen Spielern entwickeln sich zurueck. Ein Ziel, das das ignoriert,
    // waere geschoent.
    const z = attributZuwachsEinesEreignisses(ereignis("p1", "A-A", { power: 10, speed: 20 }, { power: 13, speed: 16 }));
    expect(z).toBe(-1);
  });

  it("liefert `null`, wenn ein Snapshot fehlt — NICHT 0", () => {
    // Genau diese Verwechslung war der urspruengliche Fehler: ein fehlender Ausgangswert wurde
    // wie „kein Zuwachs" behandelt und die Differenz damit zum absoluten Wert.
    expect(attributZuwachsEinesEreignisses({ progressionSnapshotAfter: { attributes: { power: 5 } } })).toBeNull();
    expect(attributZuwachsEinesEreignisses({ progressionSnapshotBefore: { attributes: { power: 5 } } })).toBeNull();
  });

  it("ignoriert Felder, die nicht auf beiden Seiten Zahlen sind", () => {
    const z = attributZuwachsEinesEreignisses(
      ereignis("p1", "A-A", { power: 10, speed: 20 }, { power: 12, speed: Number.NaN as unknown as number }),
    );
    expect(z).toBe(2);
  });
});

describe("Die Zaehlung je Team", () => {
  it("zaehlt nur Spieler ueber der Schwelle", () => {
    const state = spielstand([
      ereignis("stark", "A-A", { power: 10 }, { power: 13 }),
      ereignis("schwach", "A-A", { power: 10 }, { power: 10.5 }),
    ]);
    expect(zaehleEntwickelteSpieler(state, "A-A")).toBe(1);
  });

  it("zaehlt einen Spieler EINMAL, auch bei mehreren Ereignissen", () => {
    const state = spielstand([
      ereignis("p1", "A-A", { power: 10 }, { power: 13 }),
      ereignis("p1", "A-A", { speed: 10 }, { speed: 14 }),
    ]);
    expect(zaehleEntwickelteSpieler(state, "A-A")).toBe(1);
  });

  it("nimmt Spieler mit, die inzwischen im Kader stehen — auch mit altem Team am Ereignis", () => {
    const state = spielstand([ereignis("p1", "B-B", { power: 10 }, { power: 13 })], [["p1", "A-A"]]);
    expect(zaehleEntwickelteSpieler(state, "A-A")).toBe(1);
  });

  it("zaehlt nur die LAUFENDE Saison", () => {
    const state = spielstand([{ ...ereignis("p1", "A-A", { power: 10 }, { power: 13 }), seasonId: "season-0" }]);
    expect(zaehleEntwickelteSpieler(state, "A-A")).toBe(0);
  });
});

describe("Die Kalibrierung", () => {
  it("die Schwelle liegt zwischen Median und p75 der gemessenen Zuwaechse", () => {
    // Gemessen ueber 1017 Spieler: median 1,3 / p75 2,8. Darunter siebt die Schwelle nichts aus,
    // darueber trifft sie nur Ausreisser.
    expect(ENTWICKLUNG_ATTRIBUT_PUNKTE).toBeGreaterThan(1.3);
    expect(ENTWICKLUNG_ATTRIBUT_PUNKTE).toBeLessThanOrEqual(2.8);
  });

  it("das Ziel bleibt unter der Kadergrenze", () => {
    // Der zweite Fehler aus derselben Meldung: 20 lag ueber DEFAULT_ROSTER_MAX = 14 und war damit
    // auch dann nicht voll erfuellbar, wenn jeder Spieler springt.
    const achsen = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "lib/sponsor/sponsor-v4-axes.ts"),
      "utf8",
    ) as string;
    const block = achsen.slice(achsen.indexOf("  entwicklung: {"), achsen.indexOf("\n  kaderpflege: {"));
    const ziel = Number(block.match(/scale:\s*(\d+)/)![1]);
    expect(ziel).toBeLessThanOrEqual(DEFAULT_ROSTER_MAX);
    // Und in Reichweite des hoechsten gemessenen Werts (11).
    expect(ziel).toBeLessThanOrEqual(11);
  });

  it("die alte Marktwert-Rechnung ist an BEIDEN Stellen weg", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    for (const datei of ["lib/sponsor/sponsor-v4-axes.ts", "lib/sponsor/sponsor-objective-evaluator.ts"]) {
      const inhalt = fs.readFileSync(path.join(process.cwd(), datei), "utf8");
      expect(inhalt).not.toContain("mvAfter - mvBefore >=");
      expect(inhalt).toContain("zaehleEntwickelteSpieler");
    }
  });
});
