/**
 * SPIELSTAND-SÄUBERUNG: WAS NICHTS TRÄGT, KOMMT NICHT MIT.
 *
 * GEMELDET VON CHRIS: „kannst du mal schauen ob wir den spielstand kleiner bekommen … ohne
 * natürlich wichtige daten zu eliminieren"
 *
 * Der Nachsatz ist der eigentliche Vertrag, und genau darauf zielt diese Suite. Sie prüft nicht,
 * dass etwas weg ist — sie prüft, dass NICHTS VERLOREN GEHT, und pinnt damit die Eigenschaft,
 * nicht die Liste der gestrichenen Felder.
 *
 * ZWEI BEFUNDE, am Live-Spielstand nachgemessen (2026-08):
 *
 * 1. `injuryEvents`: 5032 Würfe, davon 4988 mit Ergebnis „healthy". Auf jeder dieser gesunden
 *    Zeilen standen `unavailableUntil`, `injuryRecovery`, `fatigueAfterRecovery` auf `null` und
 *    `unavailableForMatchdays` auf `1` — und gelesen werden sie ausschließlich über
 *    `injuryEventToPlayerHistoryRecord`, das jede Zeile ohne `result === "injured"` sofort
 *    verwirft. 763 KB ohne Auskunft.
 *
 *    WICHTIG, und der Grund für die Vorsicht: die gesunden Zeilen selbst dürfen NICHT weg.
 *    `computePlayerSeasonAverageMatchdayFatigue` liest `fatigueBefore` OHNE nach `result` zu
 *    filtern — sie sind die einzige Quelle der Spieltags-Belastung. Ein früherer Verdacht,
 *    „4479 gesunde Würfe liest ohnehin niemand", war damit falsch.
 *
 * 2. `playerPerformanceSnapshots`: byte-identischer Zwilling von `playerPerformances`, im
 *    Saison-1-Schnappschuss 333 Einträge und 647 KB doppelt, im Schreiber sogar aus DERSELBEN
 *    Variablen belegt.
 *
 * Zusammen 1,38 MB von 33,16 MB, bei null Abweichung in jedem Leser.
 */
import { describe, expect, it } from "vitest";

import type { GameState, InjuryEventRecord, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { injuryEventToPlayerHistoryRecord } from "@/lib/foundation/player-injury-history";
import { getSnapshotPlayerPerformances } from "@/lib/foundation/snapshot-player-performance";
import {
  INJURY_EVENT_DEFAULT_SOURCE,
  resolveInjuryEventSource,
  slimGameStateForWrite,
  slimInjuryEvent,
  slimSeasonSnapshot,
} from "@/lib/persistence/save-payload-slimming";

function wurf(overrides: Partial<InjuryEventRecord> = {}): InjuryEventRecord {
  return {
    eventId: "injury-event__save__season-1__matchday-1__T-1__p-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "T-1",
    playerId: "p-1",
    fatigueBefore: 42,
    riskPercent: 1.67,
    roll: 27.89,
    result: "healthy",
    unavailableForMatchdays: 1,
    unavailableUntil: null,
    normalRecovery: 15,
    injuryRecovery: null,
    fatigueAfterRecovery: null,
    source: INJURY_EVENT_DEFAULT_SOURCE,
    timestamp: "2026-08-04T11:38:08.365Z",
    ...overrides,
  };
}

describe("Säuberung · der gesunde Wurf ist eine Belastungsmessung", () => {
  it("behält alles, was irgendein Leser zieht", () => {
    const schlank = slimInjuryEvent(wurf());
    // `fatigueBefore` ist der Grund, warum gesunde Würfe überhaupt aufbewahrt werden.
    expect(schlank.fatigueBefore).toBe(42);
    // Ohne diese vier findet kein Leser die Zeile wieder.
    expect(schlank.playerId).toBe("p-1");
    expect(schlank.seasonId).toBe("season-1");
    expect(schlank.matchdayId).toBe("matchday-1");
    expect(schlank.teamId).toBe("T-1");
    // Risiko gegen Wurf ist das Kalibrierungs-Material des Fatigue-Audits.
    expect(schlank.riskPercent).toBe(1.67);
    expect(schlank.roll).toBe(27.89);
    expect(schlank.result).toBe("healthy");
    expect(schlank.timestamp).toBe("2026-08-04T11:38:08.365Z");
  });

  it("lässt die Verletzungs-Nachwehen weg, die es nicht gab", () => {
    const schlank = slimInjuryEvent(wurf());
    expect(schlank).not.toHaveProperty("unavailableUntil");
    expect(schlank).not.toHaveProperty("injuryRecovery");
    expect(schlank).not.toHaveProperty("normalRecovery");
    expect(schlank).not.toHaveProperty("unavailableForMatchdays");
    expect(schlank).not.toHaveProperty("fatigueAfterRecovery");
  });

  it("fasst den verletzten Wurf nicht an", () => {
    const verletzt = wurf({
      result: "injured",
      unavailableUntil: "matchday-2",
      injuryRecovery: 9,
      normalRecovery: 15,
    });
    const schlank = slimInjuryEvent(verletzt);
    expect(schlank.unavailableUntil).toBe("matchday-2");
    expect(schlank.injuryRecovery).toBe(9);
    expect(schlank.normalRecovery).toBe(15);
    expect(schlank.unavailableForMatchdays).toBe(1);
  });

  it("liefert für den verletzten Wurf dieselbe Historien-Zeile wie vorher", () => {
    // Die eigentliche Zusage: die Säuberung ist an der Anzeige nicht zu bemerken.
    const gameState = { season: { id: "season-1" }, seasonState: {} } as unknown as GameState;
    const verletzt = wurf({ result: "injured", unavailableUntil: "matchday-2", injuryRecovery: 9 });
    expect(injuryEventToPlayerHistoryRecord(slimInjuryEvent(verletzt), gameState)).toEqual(
      injuryEventToPlayerHistoryRecord(verletzt, gameState),
    );
  });

  it("behält die Herkunft, wenn sie NICHT der Standard ist", () => {
    // Proben-Würfe von echten zu unterscheiden ist eine Auskunft — die bleibt.
    const probe = slimInjuryEvent(wurf({ source: "fatigue_injury_rehearsal_v1" }));
    expect(probe.source).toBe("fatigue_injury_rehearsal_v1");
    expect(resolveInjuryEventSource(probe)).toBe("fatigue_injury_rehearsal_v1");
  });

  it("gibt für den weggelassenen Standard denselben Wert zurück wie vorher", () => {
    const schlank = slimInjuryEvent(wurf());
    expect(schlank).not.toHaveProperty("source");
    expect(resolveInjuryEventSource(schlank)).toBe(INJURY_EVENT_DEFAULT_SOURCE);
  });

  it("ist idempotent und gibt bei nichts zu tun dasselbe Objekt zurück", () => {
    const einmal = slimInjuryEvent(wurf());
    const zweimal = slimInjuryEvent(einmal);
    expect(zweimal).toEqual(einmal);
    // Kein neues Objekt: sonst arbeitete jede Speicherung erneut am schon Gesäuberten.
    expect(zweimal).toBe(einmal);
  });
});

function snapshot(overrides: Partial<SeasonSnapshotRecord> = {}): SeasonSnapshotRecord {
  const reihen = [{ playerId: "p-1", pps: 12 }, { playerId: "p-2", pps: 8 }];
  return {
    snapshotId: "snap-1",
    seasonId: "season-1",
    playerPerformances: reihen,
    playerPerformanceSnapshots: structuredClone(reihen),
    ...overrides,
  } as unknown as SeasonSnapshotRecord;
}

describe("Säuberung · der doppelte Spielerwerte-Zwilling", () => {
  it("wirft den Zwilling weg, wenn er inhaltsgleich ist", () => {
    expect(slimSeasonSnapshot(snapshot())).not.toHaveProperty("playerPerformanceSnapshots");
  });

  it("liefert danach exakt dieselben Spielerwerte", () => {
    const voll = snapshot();
    expect(getSnapshotPlayerPerformances(slimSeasonSnapshot(voll))).toEqual(
      getSnapshotPlayerPerformances(voll),
    );
  });

  /**
   * DIE WICHTIGSTE ZUSAGE HIER. Ältere Schnappschüsse haben nur das Altfeld gefüllt; dort ist es
   * die EINZIGE Kopie. Wegwerfen hieße Datenverlust, nicht Aufräumen.
   */
  it("rührt den Zwilling nicht an, wenn er die einzige Kopie ist", () => {
    const nurAlt = snapshot({ playerPerformances: [] });
    const schlank = slimSeasonSnapshot(nurAlt);
    expect(schlank.playerPerformanceSnapshots).toHaveLength(2);
    expect(getSnapshotPlayerPerformances(schlank)).toHaveLength(2);
  });

  it("rührt ihn auch nicht an, wenn er zusätzliche Spieler trägt", () => {
    const abweichend = snapshot({
      playerPerformanceSnapshots: [{ playerId: "p-3", pps: 4 }] as never,
    });
    expect(slimSeasonSnapshot(abweichend).playerPerformanceSnapshots).toHaveLength(1);
    expect(getSnapshotPlayerPerformances(slimSeasonSnapshot(abweichend))).toHaveLength(3);
  });
});

describe("Säuberung · der Sammelgriff vor dem Schreiben", () => {
  function zustand(): GameState {
    return {
      season: { id: "season-1" },
      players: [],
      seasonState: {
        injuryEvents: [wurf(), wurf({ result: "injured", eventId: "e-2" })],
        seasonSnapshots: [snapshot()],
      },
    } as unknown as GameState;
  }

  it("säubert Würfe und Schnappschüsse in einem Durchgang", () => {
    const schlank = slimGameStateForWrite(zustand());
    expect(schlank.seasonState.injuryEvents?.[0]).not.toHaveProperty("normalRecovery");
    expect(schlank.seasonState.seasonSnapshots?.[0]).not.toHaveProperty("playerPerformanceSnapshots");
  });

  it("verliert dabei keinen einzigen Wurf", () => {
    // Zeilen streichen wäre eine ganz andere Entscheidung als Felder streichen — sie fällt hier
    // ausdrücklich NICHT, weil die gesunden Würfe die Spieltags-Belastung tragen.
    const vorher = zustand();
    const schlank = slimGameStateForWrite(vorher);
    expect(schlank.seasonState.injuryEvents).toHaveLength(vorher.seasonState.injuryEvents!.length);
  });

  it("gibt bei einem bereits gesäuberten Zustand denselben Zustand zurück", () => {
    const einmal = slimGameStateForWrite(zustand());
    expect(slimGameStateForWrite(einmal)).toBe(einmal);
  });
});
