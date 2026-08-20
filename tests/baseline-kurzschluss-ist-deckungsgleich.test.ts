/**
 * DER KURZSCHLUSS DARF NICHTS ÄNDERN — und das ist hier bewiesen, nicht behauptet.
 *
 * CHRIS' ENTSCHEIDUNG (20.08.2026, Frage 1): „1a" — die Baseline-Buchhaltung beim Speichern
 * kurzschließen. Meine Bedingung dazu war ausdrücklich: vorher nachweisen, dass ein Spielstand mit
 * übersprungener Buchhaltung Byte für Byte derselbe ist wie einer mit voller. Genau das prüft
 * dieser Test — er ist die Bedingung, unter der der Eingriff überhaupt gebaut werden durfte.
 *
 * WAS DER KURZSCHLUSS BEHAUPTET: tragen vorherige und neue Spieler-Baselines dieselben Spieler mit
 * derselben Prüfsumme und derselben Version, dann liefert `guardPlayerBaselineWrite` exakt
 * `previous` zurück und kein einziges Ereignis. Dann — und nur dann — darf man sie überspringen.
 *
 * WARUM ES ÜBERHAUPT LOHNT, gemessen an `hwz8fk` (2984 Spieler, fünf Speichervorgänge in Folge):
 * die Wache kostete ~420 ms von ~1140 ms je Speichern. Mit dem Kurzschluss sind es ~2 ms, das
 * ganze Speichern fällt von 1138 ms auf 726 ms.
 */
import { describe, expect, it } from "vitest";

import type { PlayerBaselineRecord } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  createPlayerBaselinesForPlayers,
  guardPlayerBaselineWrite,
  normalizePlayerBaselineRecord,
} from "@/lib/players/player-baseline-service";
import { baselinesSindDeckungsgleich } from "@/lib/persistence/save-repository";

/** Echte Baselines aus echten Spielern — synthetische Datensätze hätten keine echten Prüfsummen. */
function baueBaselines(anzahl: number): PlayerBaselineRecord[] {
  const gameState = createSingleplayerGameState();
  const spieler = gameState.players.slice(0, anzahl);
  expect(spieler.length).toBe(anzahl);
  return createPlayerBaselinesForPlayers(spieler, { createdAt: "2026-08-20T00:00:00.000Z" }).map((baseline) =>
    normalizePlayerBaselineRecord(baseline),
  );
}

describe("Der Kurzschluss liefert dasselbe wie die volle Wache", () => {
  it("Byte für Byte identisch — beide Wege am selben Datenbestand gefahren", () => {
    const baselines = baueBaselines(120);
    // Der neue Stand ist eine eigene Kopie, nicht dieselbe Referenz: sonst prüfte der Test die
    // Objektgleichheit statt der Prüfsummen-Aussage.
    const neu = JSON.parse(JSON.stringify(baselines)) as PlayerBaselineRecord[];

    expect(baselinesSindDeckungsgleich(baselines, neu)).toBe(true);

    const volleWache = guardPlayerBaselineWrite({
      previous: baselines,
      next: neu,
      attemptedSource: "save_repository",
      timestamp: "2026-08-20T12:00:00.000Z",
    });

    // DAS IST DIE ZUSICHERUNG: was der Kurzschluss einsetzt (`previous`), ist das, was die Wache
    // ausgerechnet hätte — und sie hätte kein Ereignis gemeldet.
    expect(JSON.stringify(volleWache.baselines)).toBe(JSON.stringify(baselines));
    expect(volleWache.events).toEqual([]);
  });

  it("gilt auch für einen einzelnen Datensatz und für viele", () => {
    for (const anzahl of [1, 5, 250]) {
      const baselines = baueBaselines(anzahl);
      const neu = JSON.parse(JSON.stringify(baselines)) as PlayerBaselineRecord[];
      expect(baselinesSindDeckungsgleich(baselines, neu), `n=${anzahl}`).toBe(true);
      const volleWache = guardPlayerBaselineWrite({
        previous: baselines,
        next: neu,
        attemptedSource: "save_repository",
      });
      expect(JSON.stringify(volleWache.baselines), `n=${anzahl}`).toBe(JSON.stringify(baselines));
      expect(volleWache.events, `n=${anzahl}`).toEqual([]);
    }
  });
});

describe("Der Kurzschluss greift NICHT, sobald etwas anders ist", () => {
  const basis = () => baueBaselines(20);

  it("bei geänderter Prüfsumme", () => {
    const previous = basis();
    const next = JSON.parse(JSON.stringify(previous)) as PlayerBaselineRecord[];
    next[3] = { ...next[3]!, checksum: "anders" };
    expect(baselinesSindDeckungsgleich(previous, next)).toBe(false);
  });

  it("bei geänderter Baseline-Version", () => {
    const previous = basis();
    const next = JSON.parse(JSON.stringify(previous)) as PlayerBaselineRecord[];
    next[0] = { ...next[0]!, baselineVersion: "player-baseline-v99" };
    expect(baselinesSindDeckungsgleich(previous, next)).toBe(false);
  });

  it("bei FEHLENDER Prüfsumme — dann ist keine Aussage möglich, also volle Wache", () => {
    const previous = basis();
    const next = JSON.parse(JSON.stringify(previous)) as PlayerBaselineRecord[];
    next[7] = { ...next[7]!, checksum: undefined };
    expect(baselinesSindDeckungsgleich(previous, next)).toBe(false);
    // Auch andersherum: fehlt sie auf der ALTEN Seite, wird ebenfalls voll geprüft.
    const previousOhne = basis();
    previousOhne[7] = { ...previousOhne[7]!, checksum: undefined };
    expect(baselinesSindDeckungsgleich(previousOhne, basis())).toBe(false);
  });

  it("bei anderer Anzahl, bei einem anderen Spieler, bei leerer oder fehlender Seite", () => {
    const previous = basis();
    expect(baselinesSindDeckungsgleich(previous, previous.slice(0, 19))).toBe(false);
    const getauscht = JSON.parse(JSON.stringify(previous)) as PlayerBaselineRecord[];
    getauscht[2] = { ...getauscht[2]!, playerId: "gibt-es-nicht" };
    expect(baselinesSindDeckungsgleich(previous, getauscht)).toBe(false);
    expect(baselinesSindDeckungsgleich([], [])).toBe(false);
    expect(baselinesSindDeckungsgleich(undefined, previous)).toBe(false);
    expect(baselinesSindDeckungsgleich(previous, undefined)).toBe(false);
  });

  it("und in genau diesen Fällen tut die volle Wache auch wirklich etwas anderes", () => {
    // Gegenprobe zur Gegenprobe: ein geänderter Datensatz muss die Wache zum Blockieren bringen —
    // sonst wäre „greift nicht" folgenlos und der Test sagte nichts über den Schaden aus.
    const previous = basis();
    const next = JSON.parse(JSON.stringify(previous)) as PlayerBaselineRecord[];
    // Der Name steht in der Prüfsumme; ein frei erfundenes Attribut täte es NICHT — die
    // Baseline-Attribute sind auf feste Schlüssel normalisiert, und ein unbekannter fällt beim
    // Normalisieren weg. Genau deshalb ist der Kurzschluss so streng wie die Wache: beide hängen
    // an derselben Prüfsumme, keiner von beiden sieht etwas, das der andere sähe.
    next[3] = { ...next[3]!, name: "Ein anderer Name", checksum: undefined };
    const volleWache = guardPlayerBaselineWrite({
      previous,
      next,
      attemptedSource: "save_repository",
      timestamp: "2026-08-20T12:00:00.000Z",
    });
    expect(volleWache.events.length).toBeGreaterThan(0);
    expect(volleWache.events[0]!.reason).toBe("player_baseline_write_blocked");
  });
});
