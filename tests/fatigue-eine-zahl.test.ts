/**
 * EINE ERSCHÖPFUNGSZAHL — Match-Fatigue plus Trainingsschicht, überall dieselbe.
 *
 * GEMELDET VON CHRIS: „die haben immer so hohe fatigue". Beim Nachmessen an seinem Spielstand
 * standen zwei Quellen nebeneinander, die dasselbe zu meinen vorgaben:
 *
 *     player.fatigue                   = Match-Fatigue + Trainingsschicht
 *     playerAvailabilityState.fatigue  = Match-Fatigue allein
 *
 * Sie lagen bei 328 Spielern um median 9,4 Punkte auseinander (Maximum 21,0) und entschieden bei
 * 33 von ihnen die 65er-Marke UNTERSCHIEDLICH — also genau die Schwelle, an der „übermüdet", die
 * KI-Reaktion und das Verletzungsrisiko hängen. Der Training-Reiter zeigte die eine Zahl, der
 * Spieler-Drawer die andere.
 *
 * ENTSCHIEDEN VON CHRIS: „Gesamt, überall." Trainingslast soll wirklich wirken, nicht nur
 * angezeigt werden.
 *
 * DIE TRENNUNG, DIE BLEIBEN MUSS. Das KONTO (`playerAvailabilityState`) wird je Spieltag
 * fortgeschrieben — Last drauf, Erholung ab. Trüge es die Trainingsschicht mit, summierte sie
 * sich über die Spieltage auf. Genau dieser Fehler ist in `matchday-training-accumulator.ts`
 * beschrieben und gemessen (eine Schicht zuviel, 2,2 Punkte bei Modus „hart" auf zehn Spieltage,
 * und über die Fallback-Kette wanderte er in den Verletzungswurf).
 *
 * Deshalb: Konto bleibt reine Match-Fatigue, die Schicht kommt beim LESEN dazu. Der letzte Test
 * hier ist der Wächter dagegen, dass jemand das wieder zusammenlegt.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  applyFatigueAndInjuryAfterMatchday,
  getPlayerAvailabilityView,
  getPlayerGesamtFatigue,
  getPlayerTrainingFatigueShare,
} from "@/lib/fatigue/fatigue-injury-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

function spielstandMitSchicht(schicht: number, seasonId?: string) {
  const gameState = structuredClone(createSingleplayerGameState()) as GameState;
  const roster = gameState.rosters[0]!;
  const player = gameState.players.find((entry) => entry.id === roster.playerId)!;
  player.seasonTrainingAccumulator = {
    seasonId: seasonId ?? gameState.season.id,
    matchdaysCounted: 3,
    modeByMatchday: {},
    accumulatedTrainingFatigue: schicht,
    updatedAt: new Date(0).toISOString(),
  };
  gameState.seasonState.playerAvailabilityState = [
    { playerId: roster.playerId, teamId: roster.teamId, fatigue: 40, injuryStatus: "healthy" },
  ] as GameState["seasonState"]["playerAvailabilityState"];
  return { gameState, roster, player };
}

describe("Die Trainingsschicht", () => {
  it("zählt nur für die laufende Saison", () => {
    const { gameState, player } = spielstandMitSchicht(12);
    expect(getPlayerTrainingFatigueShare(player, gameState.season.id)).toBe(12);
    // Ein Akkumulator aus einer anderen Saison ist kein Rest, sondern Geschichte.
    expect(getPlayerTrainingFatigueShare(player, "season-99")).toBe(0);
  });

  it("ist ohne Akkumulator schlicht 0, nicht undefined", () => {
    const gameState = structuredClone(createSingleplayerGameState()) as GameState;
    const player = gameState.players[0]!;
    delete (player as { seasonTrainingAccumulator?: unknown }).seasonTrainingAccumulator;
    expect(getPlayerTrainingFatigueShare(player, gameState.season.id)).toBe(0);
  });
});

describe("Die Sicht liefert die Gesamtzahl", () => {
  it("Konto plus Schicht — und nicht mehr nur das Konto", () => {
    const { gameState, roster } = spielstandMitSchicht(12);
    const sicht = getPlayerAvailabilityView(gameState, roster.playerId, roster.teamId, "md-1");
    expect(sicht.fatigue).toBe(52);
  });

  it("ohne Trainingsschicht bleibt es beim Konto-Stand", () => {
    const { gameState, roster } = spielstandMitSchicht(0);
    expect(getPlayerAvailabilityView(gameState, roster.playerId, roster.teamId, "md-1").fatigue).toBe(40);
  });

  it("`getPlayerGesamtFatigue` sagt dasselbe wie die Sicht", () => {
    // Zwei Wege, eine Zahl — sonst waere die Zusammenfuehrung nur verschoben.
    const { gameState, roster, player } = spielstandMitSchicht(12);
    expect(getPlayerGesamtFatigue(gameState, player, roster.teamId)).toBe(
      getPlayerAvailabilityView(gameState, roster.playerId, roster.teamId, "md-1").fatigue,
    );
  });

  it("bleibt bei 100 stehen, statt darüber hinauszuschiessen", () => {
    const { gameState, roster } = spielstandMitSchicht(80);
    expect(getPlayerAvailabilityView(gameState, roster.playerId, roster.teamId, "md-1").fatigue).toBe(100);
  });
});

describe("Das Konto bleibt reine Match-Fatigue", () => {
  /**
   * DER WÄCHTER. Würde die Buchung die Gesamtzahl zurückschreiben, käme die Trainingsschicht beim
   * nächsten Spieltag ein zweites Mal obendrauf — und über die Spieltage immer weiter.
   */
  it("nach einer Spieltagsbuchung steht im Konto kein Trainingsanteil", () => {
    const { gameState, roster } = spielstandMitSchicht(12);
    const ergebnis = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: gameState.season.id,
      matchdayId: gameState.season.matchdayIds?.[0] ?? "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    const konto = (ergebnis.gameState.seasonState.playerAvailabilityState ?? []).find(
      (entry) => entry.playerId === roster.playerId,
    );
    expect(konto).toBeDefined();
    // Der Spieler steht in keiner Aufstellung dieses Fixtures: er erholt sich, das Konto sinkt.
    // Entscheidend ist, dass es NICHT bei oder ueber 52 (= 40 + Schicht) landet.
    expect(konto!.fatigue).toBeLessThanOrEqual(40);
  });

  it("zweimal buchen türmt die Schicht nicht auf", () => {
    const { gameState, roster } = spielstandMitSchicht(12);
    const eingabe = {
      saveId: "save-1",
      seasonId: gameState.season.id,
      matchdayId: gameState.season.matchdayIds?.[0] ?? "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    };
    const erst = applyFatigueAndInjuryAfterMatchday({ ...eingabe, gameState });
    const zweit = applyFatigueAndInjuryAfterMatchday({ ...eingabe, gameState: erst.gameState });

    const kontoErst = (erst.gameState.seasonState.playerAvailabilityState ?? []).find((e) => e.playerId === roster.playerId)!;
    const kontoZweit = (zweit.gameState.seasonState.playerAvailabilityState ?? []).find((e) => e.playerId === roster.playerId)!;
    expect(kontoZweit.fatigue).toBeLessThanOrEqual(kontoErst.fatigue);
  });
});
