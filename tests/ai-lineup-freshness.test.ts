import { describe, expect, it } from "vitest";

import { findStaleAiLineupEntries, isAiLineupDraftStale } from "@/lib/ai/ai-lineup-freshness";
import { FATIGUE_REST_FLOOR, resolveFatigueRestFloor } from "@/lib/fatigue/fatigue-rest-propensity";

/**
 * Hintergrund (Meldung 32k3rk): Im Save `new-game-1785476771457-e4yvyl` blockierten zwei KI-Teams
 * den gesamten Spieltag, weil je ein VERLETZTER Spieler in ihrer bereits abgegebenen Aufstellung
 * stand. Die KI plant vorab und prueft danach nicht mehr nach — der Plan wusste von der Verletzung
 * nichts.
 *
 * Die Tests halten beide Richtungen fest: Ein veralteter Entwurf muss erkannt werden (sonst kehrt
 * der Fehler zurueck), ein gueltiger darf NICHT als veraltet gelten (sonst wird bei jedem Speichern
 * fuer 32 Teams neu gerechnet — die Ersparnis, wegen der der Uebersprung ueberhaupt existiert,
 * waere weg).
 */
type TestPlayer = {
  id: string;
  fatigue?: number | null;
  injuryStatus?: "healthy" | "injured" | "recovering" | null;
  availabilityBlocker?: "player_injured_unavailable" | null;
};

const HEALTHY: TestPlayer = { id: "p-healthy", fatigue: 10, injuryStatus: "healthy" };

function roster(...players: TestPlayer[]): TestPlayer[] {
  return players.map((player) => ({ fatigue: 0, injuryStatus: "healthy", ...player }));
}

describe("Frischepruefung vorgeplanter KI-Aufstellungen", () => {
  it("erkennt den gemeldeten Fall: ein verletzter Spieler steht in der abgegebenen Aufstellung", () => {
    const findings = findStaleAiLineupEntries({
      entryPlayerIds: ["p-healthy", "player-2891-hellraiser"],
      rosterPlayers: roster(HEALTHY, { id: "player-2891-hellraiser", injuryStatus: "injured", fatigue: 20 }),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ playerId: "player-2891-hellraiser", reason: "player_unavailable" });
  });

  it("erkennt den Verletzten auch, wenn nur der Verfuegbarkeits-Riegel gesetzt ist", () => {
    // Zwei Felder tragen dieselbe Aussage. Haengt die Pruefung nur an einem, faellt der Fall durch,
    // sobald die andere Quelle greift.
    const findings = findStaleAiLineupEntries({
      entryPlayerIds: ["p-blocked"],
      rosterPlayers: roster({ id: "p-blocked", availabilityBlocker: "player_injured_unavailable" }),
    });

    expect(findings.map((f) => f.reason)).toEqual(["player_unavailable"]);
  });

  it("laesst eine gueltige Aufstellung unangetastet", () => {
    const stale = isAiLineupDraftStale({
      entryPlayerIds: ["p-healthy", "p-second"],
      rosterPlayers: roster(HEALTHY, { id: "p-second", fatigue: 5 }),
    });

    expect(stale).toBe(false);
  });

  it("meldet einen Spieler ueber der Schoner-Schwelle — Fatigue aendert die Werte", () => {
    // Tiefer Kader: es gilt der volle Basis-Boden.
    const deepRoster = roster(
      { id: "p-tired", fatigue: FATIGUE_REST_FLOOR + 1 },
      ...Array.from({ length: 12 }, (_, i) => ({ id: `p-${i}`, fatigue: 0 })),
    );

    const findings = findStaleAiLineupEntries({ entryPlayerIds: ["p-tired"], rosterPlayers: deepRoster });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ reason: "player_over_rest_floor", fatigue: FATIGUE_REST_FLOOR + 1 });
  });

  it("schont bei duennem Kader frueher als bei tiefem — die Schwelle haengt am Kader", () => {
    // Dieselbe Fatigue, zwei Kadergroessen: Der duenne Kader muss frueher anschlagen. Waere die
    // Schwelle eine feste Zahl, waeren beide Ergebnisse gleich — genau das soll dieser Test
    // ausschliessen.
    const thinFloor = resolveFatigueRestFloor({ rosterSize: 7 });
    const deepFloor = resolveFatigueRestFloor({ rosterSize: 20 });
    expect(thinFloor).toBeLessThan(deepFloor);

    const fatigue = Math.ceil(thinFloor) + 1;
    expect(fatigue).toBeLessThan(deepFloor);

    const thin = findStaleAiLineupEntries({
      entryPlayerIds: ["p-tired"],
      rosterPlayers: roster({ id: "p-tired", fatigue }),
      rosterSize: 7,
    });
    const deep = findStaleAiLineupEntries({
      entryPlayerIds: ["p-tired"],
      rosterPlayers: roster({ id: "p-tired", fatigue }),
      rosterSize: 20,
    });

    expect(thin.map((f) => f.reason)).toEqual(["player_over_rest_floor"]);
    expect(deep).toHaveLength(0);
  });

  it("behandelt einen nicht mehr im Kader stehenden Spieler wie einen ausgefallenen", () => {
    // Verkauft oder Vertrag ausgelaufen: reisst beim Aufloesen dasselbe Loch wie eine Verletzung.
    const findings = findStaleAiLineupEntries({
      entryPlayerIds: ["p-gone"],
      rosterPlayers: roster(HEALTHY),
    });

    expect(findings.map((f) => f.reason)).toEqual(["player_unavailable"]);
  });

  it("zaehlt `recovering` nicht als Ausfall", () => {
    // Wer zurueck ist, darf spielen. Ihn zu tauschen waere eine Leistungsentscheidung, keine
    // Verfuegbarkeitsfrage — und wuerde jede Genesung zu einer Neuberechnung machen.
    const findings = findStaleAiLineupEntries({
      entryPlayerIds: ["p-back"],
      rosterPlayers: roster({ id: "p-back", injuryStatus: "recovering", fatigue: 0 }),
    });

    expect(findings).toHaveLength(0);
  });

  it("meldet jeden Spieler nur einmal, auch bei Mehrfachaufstellung", () => {
    // Ein Spieler kann in beiden Disziplinen stehen. Doppelte Meldungen wuerden die Protokolle
    // aufblaehen, ohne etwas hinzuzufuegen.
    const findings = findStaleAiLineupEntries({
      entryPlayerIds: ["p-hurt", "p-hurt"],
      rosterPlayers: roster({ id: "p-hurt", injuryStatus: "injured" }),
    });

    expect(findings).toHaveLength(1);
  });

  it("gilt eine leere Aufstellung nicht als veraltet", () => {
    expect(isAiLineupDraftStale({ entryPlayerIds: [], rosterPlayers: roster(HEALTHY) })).toBe(false);
  });
});
