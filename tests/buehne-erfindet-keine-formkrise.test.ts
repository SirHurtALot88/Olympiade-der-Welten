/**
 * DIE BÜHNE ERFINDET KEINE FORMKRISE.
 *
 * GEMELDET VON CHRIS (`qwbnic`, Ansicht `matchdayArena`, Spielstand `hwz8fk`):
 * „Hier wurde anscheinend eine falsche Form berechnet? bitte checken! S-C soll +18,4 gehabt haben —
 * hat in realität aber bei jedem Spieler eine negative Form gehabt! bitte prüfen dass nicht wieder
 * die slots vertauscht wurden"
 *
 * ZWEI ZAHLEN, ZWEI QUELLEN. Die „+18,4" ist die Formkarten-Summe aus der Resolve-Vorschau
 * (`lib/foundation/matchday-team-modifiers.ts` → `formModifier`). Die ist in Ordnung: am
 * Live-Abbild gemessen folgen ihre Pro-Spieler-Anteile dem Vorzeichen der Karte — `swnjlk` Karte
 * R+8×2 → alle Anteile positiv, `n90y4m` Karte B−8 → alle negativ. Vertauschte Slots (der Verdacht
 * aus der Meldung) waren es also nicht.
 *
 * DIE NEGATIVEN WERTE kamen aus der zweiten Quelle: der geschätzten Aufstellung
 * (`buildDisciplineStageModel`), die die Arena zeigt, solange für eine Disziplin keine
 * Engine-Vorschau vorliegt — beschriftet mit „Vorschau mit GESCHÄTZTER Aufstellung". Sie leitete
 * den Form-Anteil aus `player.form` ab.
 *
 * `player.form` WIRD NIRGENDS GESCHRIEBEN. Generator und Import setzen 0, die Saat trägt 0 in allen
 * 2984 Spielern, und in allen sieben Live-Spielständen steht das Feld bei 2304 von 2304
 * Kaderspielern auf exakt 0 — keiner daneben, keiner fehlend. Der neutrale Rückfall `?? 50` konnte
 * deshalb nie greifen: das Feld IST da, es ist nur leer. Gerechnet wurde `((0 − 50) / 50) × 8 = −8`
 * für jeden. Am Abbild `hwz8fk` nachgemessen: 192 von 192 Spielern in Basketball und 160 von 160 in
 * Battlefield mit negativem Anteil, kein einziger positiver, in keinem der 32 Teams. Genau Chris'
 * „bei jedem Spieler".
 *
 * DIE REGEL, die hier festgehalten wird: ein unbeschriebenes Feld ist keine Aussage. 0 heißt „keine
 * Form erfasst" und ergibt keinen Ausschlag — nicht den denkbar schlechtesten.
 * `lib/training/player-progression-forecast.ts:377,515` hält diese Regel längst
 * (`isFiniteNumber(player.form) && player.form > 0`); auf der Bühne fehlte sie.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildDisciplineStageModel } from "@/lib/foundation/discipline-stage/discipline-stage-data";
import { distributePerPlayerFormShares } from "@/lib/lineups/legacy-lineup-modifiers";

const DISZIPLIN = "staffel";

function spielstand(input: { form: number | null; fatigue?: number }): GameState {
  const teams = ["A-A", "B-B", "C-C", "D-D"];
  const players = teams.flatMap((teamId, teamIndex) =>
    Array.from({ length: 6 }, (_, index) => ({
      id: `${teamId}-p${index}`,
      name: `${teamId} Spieler ${index}`,
      form: input.form,
      fatigue: input.fatigue ?? 0,
      // Gestaffelte Grundwerte, damit die Auswahl etwas zu sortieren hat.
      disciplineRatings: { [DISZIPLIN]: 60 - teamIndex * 3 - index },
      traitsPositive: [],
      traitsNegative: [],
    })),
  );
  return {
    disciplines: [{ id: DISZIPLIN, name: "Staffel", playerCount: 5 }],
    teams: teams.map((teamId) => ({ teamId, shortCode: teamId, name: `Team ${teamId}` })),
    players,
    rosters: players.map((player) => ({ playerId: player.id, teamId: player.id.slice(0, 3) })),
  } as unknown as GameState;
}

function alleAnteile(gameState: GameState): number[] {
  return buildDisciplineStageModel(gameState, DISZIPLIN, "A-A").teams.flatMap((team) =>
    team.slots.map((slot) => slot.formSwing),
  );
}

describe("Die Bühne erfindet keine Formkrise", () => {
  it("ohne erfassten Formwert bekommt KEIN Spieler einen negativen Anteil", () => {
    // Der gemeldete Fall, 1:1: `player.form` = 0 bei allen. Vorher: jeder Anteil negativ.
    const anteile = alleAnteile(spielstand({ form: 0 }));
    expect(anteile.length).toBe(20);
    expect(anteile.filter((wert) => wert < 0)).toEqual([]);
  });

  it("… und auch keinen positiven — es wird gar kein Ausschlag erfunden", () => {
    // Der Riegel gegen die naheliegende Fehlreparatur „Neutral = 50 einsetzen": dann liefe der
    // Jitter (±4) weiter und jeder Spieler trüge einen zufälligen Form-/Formtief-Zettel, der auf
    // nichts beruht.
    expect(alleAnteile(spielstand({ form: 0 })).every((wert) => wert === 0)).toBe(true);
  });

  it("ein fehlendes Feld zählt genauso wenig wie eine 0", () => {
    // Alt-Spielstände können das Feld gar nicht führen. „Unbekannt" ist nicht „schlecht".
    expect(alleAnteile(spielstand({ form: null })).every((wert) => wert === 0)).toBe(true);
  });

  it("das Netto ist dann exakt Grundwert minus Fatigue — keine dritte Zahl dazwischen", () => {
    const modell = buildDisciplineStageModel(spielstand({ form: 0, fatigue: 40 }), DISZIPLIN, "A-A");
    for (const team of modell.teams) {
      for (const slot of team.slots) {
        expect(slot.fatiguePenalty).toBeGreaterThan(0);
        expect(slot.net).toBeCloseTo(Number((slot.base - slot.fatiguePenalty).toFixed(1)), 6);
      }
    }
  });

  it("GEGENRICHTUNG: ein ECHTER Formwert wirkt weiterhin — der Fix nimmt nichts weg", () => {
    // Sobald das Feld je gefüllt wird, muss die Bühne es wieder zeigen. Sonst hätte der Fix den
    // Formkanal stillgelegt statt ihn zu bereinigen.
    const hoch = alleAnteile(spielstand({ form: 100 }));
    expect(hoch.every((wert) => wert > 0)).toBe(true);

    const tief = alleAnteile(spielstand({ form: 10 }));
    expect(tief.every((wert) => wert < 0)).toBe(true);
  });

  it("die Verteilfunktion selbst hält den Riegel: flacher Wert 0 → alle Anteile 0", () => {
    // Darauf ruht der zweite Test oben. Ohne diesen Riegel in
    // `distributePerPlayerFormShares` würde ein Kartenwert von 0 trotzdem Jitter streuen.
    expect(distributePerPlayerFormShares({ formPerPlayer: 0, seeds: ["a", "b", "c"] })).toEqual([0, 0, 0]);
    expect(distributePerPlayerFormShares({ formModifier: 0, seeds: ["a", "b", "c"] })).toEqual([0, 0, 0]);
  });
});
