/**
 * EINE LEISTUNG OHNE SPIELTAGSERGEBNIS GEHOERT NICHT IN DIE LAUFENDE SAISON.
 *
 * GEMELDET VON CHRIS (`ru28ai`): „in der Spieler Liste haben Spieler teils schon über 10 Einsätze
 * und mehr All Time Punkte obwohl wir erst in MD1 von S2 sind. Das kann also gar nicht sein!"
 *
 * DIE STELLE: `buildPlayerSeasonPerformanceMap` filterte mit
 * `(result?.seasonId ?? gameState.season.id) !== gameState.season.id`. Fehlt das Ergebnis, war der
 * Rueckfall die LAUFENDE Saison — die Bedingung damit immer erfuellt und der Eintrag NICHT
 * uebersprungen, sondern mitgezaehlt.
 *
 * WANN DAS ENTSTEHT: am Saisonwechsel werden die Spieltagsergebnisse der alten Saison geraeumt,
 * waehrend die Leistungen kurz weiterleben. Ein Spieler mit zehn Einsaetzen aus Saison 1 stand
 * damit am ersten Spieltag von Saison 2 mit zehn Einsaetzen da — genau Chris' Beobachtung.
 *
 * WAS ICH NICHT BELEGEN KANN: dass es GENAU dieser Weg war. Kein aktueller Live-Spielstand traegt
 * verwaiste Leistungen — die Invariante „Einsaetze <= 2 x gewertete Spieltage" haelt in allen
 * sieben Spielstaenden, und `89rv3s` steht sogar exakt auf dem gemeldeten Stand (Saison 2,
 * Spieltag 1) mit null Einsaetzen. Der Fehler ist als DEFEKT bewiesen, nicht als Ursache dieser
 * einen Meldung.
 *
 * Der Unterschied zwischen „gehoert zu dieser Saison" und „Saison unbekannt" ist der ganze Punkt:
 * unbekannt ist nicht dasselbe wie aktuell.
 */
import { describe, expect, it } from "vitest";

import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

/**
 * Leerer Punkte-Ledger. Er wird nur fuer `pointEntriesByPerformanceId` gebraucht (die normierte
 * Punktzahl je Leistung); ohne ihn baut die Funktion ihn selbst und braucht dafuer den vollen
 * Spielstand. Hier geht es um den SAISONFILTER, nicht um Punkte.
 */
const LEERER_LEDGER = { pointEntriesByPerformanceId: new Map() } as unknown as SeasonPointsLedger;

type MinimalState = Parameters<typeof buildPlayerSeasonPerformanceMap>[0];

function spielstand(input: {
  seasonId: string;
  matchdayResults: Array<{ id: string; seasonId: string | null; matchdayId: string; status: string }>;
  performances: Array<{ playerId: string; matchdayResultId: string }>;
}): MinimalState {
  return {
    season: { id: input.seasonId },
    disciplines: [{ id: "d1", name: "Disziplin 1", category: "power" }],
    players: [{ id: "p1", name: "Spieler 1" }],
    rosters: [{ playerId: "p1", teamId: "A-A" }],
    seasonState: {
      matchdayResults: input.matchdayResults,
      playerDisciplinePerformances: input.performances.map((p, index) => ({
        id: `perf-${index}`,
        playerId: p.playerId,
        teamId: "A-A",
        matchdayResultId: p.matchdayResultId,
        disciplineId: "d1",
        disciplineSide: "d1",
        baseValue: 10,
        finalPlayerScore: 10,
        scoreContribution: 10,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: false,
        isMvpCandidate: false,
      })),
    },
  } as unknown as MinimalState;
}

describe("Einsätze zählen nur die laufende Saison", () => {
  it("eine Leistung OHNE Spieltagsergebnis wird NICHT mitgezählt", () => {
    // Der gemeldete Fall: die Ergebnisse der alten Saison sind geräumt, die Leistungen leben kurz
    // weiter. Vorher zählten sie als Einsätze der neuen Saison.
    const state = spielstand({
      seasonId: "season-2",
      matchdayResults: [],
      performances: Array.from({ length: 10 }, () => ({ playerId: "p1", matchdayResultId: "verwaist" })),
    });
    expect(buildPlayerSeasonPerformanceMap(state, LEERER_LEDGER).get("p1")?.appearances ?? 0).toBe(0);
  });

  it("eine Leistung mit Ergebnis der VORSAISON zählt ebenfalls nicht", () => {
    const state = spielstand({
      seasonId: "season-2",
      matchdayResults: [{ id: "r1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" }],
      performances: [{ playerId: "p1", matchdayResultId: "r1" }],
    });
    expect(buildPlayerSeasonPerformanceMap(state, LEERER_LEDGER).get("p1")?.appearances ?? 0).toBe(0);
  });

  it("ein Ergebnis OHNE Saison-Angabe wird nicht der laufenden zugeschlagen", () => {
    // `seasonId: null` ist genauso „unbekannt" wie ein fehlendes Ergebnis — auch hier wird nicht
    // geraten.
    const state = spielstand({
      seasonId: "season-2",
      matchdayResults: [{ id: "r1", seasonId: null, matchdayId: "matchday-1", status: "preview_applied" }],
      performances: [{ playerId: "p1", matchdayResultId: "r1" }],
    });
    expect(buildPlayerSeasonPerformanceMap(state, LEERER_LEDGER).get("p1")?.appearances ?? 0).toBe(0);
  });

  it("Leistungen der LAUFENDEN Saison zählen unverändert", () => {
    // Die Gegenrichtung: der Fix darf nichts wegnehmen, was dazugehört.
    const state = spielstand({
      seasonId: "season-2",
      matchdayResults: [
        { id: "r1", seasonId: "season-2", matchdayId: "matchday-1", status: "preview_applied" },
        { id: "r2", seasonId: "season-2", matchdayId: "matchday-2", status: "preview_applied" },
      ],
      performances: [
        { playerId: "p1", matchdayResultId: "r1" },
        { playerId: "p1", matchdayResultId: "r2" },
      ],
    });
    expect(buildPlayerSeasonPerformanceMap(state, LEERER_LEDGER).get("p1")?.appearances).toBe(2);
  });
});
