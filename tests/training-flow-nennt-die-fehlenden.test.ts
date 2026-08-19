/**
 * DER SCHRITT „TRAINING PRUEFEN" SAGT, AN WEM ES HAENGT — und neue Kaderspieler blockieren ihn
 * nicht mehr stillschweigend.
 *
 * GEMELDET VON CHRIS (`j53iox`): „der Flow hängt bei Training prüfen fest - weiß nicht warum dabei
 * müsste er auf die Einsatzliste verweisen, training ist erledigt."
 *
 * ZWEI DEFEKTE STECKEN DARIN, und der zweite ist der, den er beschreibt:
 *
 *  1. DATEN: `isTeamTrainingComplete` verlangt einen `trainingMode` je Kaderspieler. Gesetzt wurde
 *     der nur auf dem MARKT-Weg (`transfermarkt-local-service.ts`). Wer ueber Draft, KI-Picks oder
 *     den Saisonwechsel in einen Kader kam, hatte keinen. NACHGEMESSEN an den fuenf
 *     Live-Spielstaenden: T-G steht mit 8 von 8 Kaderspielern ohne Trainingsmodus da, C-C mit
 *     2 von 9 — beide mit Vertragsstatus `active`, also keine Karteileichen.
 *
 *  2. DIAGNOSE: die Regel war ein blankes Ja/Nein. Ein einziger Spieler ohne Modus setzte den
 *     Schritt auf „offen", und keine Oberflaeche konnte sagen, welcher. Man sieht dreissig
 *     gesetzte Zeilen und sucht die eine fehlende.
 *
 * WAS ABSICHTLICH NICHT GEBAUT WURDE: der Backfill haengt NICHT im allgemeinen Schreibweg. Am
 * echten Spielstand gemessen kostet er 611 µs je Aufruf (2984 Spieler) und ist kein Nichtstun — er
 * fuellt zusaetzlich `trainingClass` und lieferte selbst auf einem Stand mit vollstaendigem
 * Training einen neuen Zustand zurueck. In `saveSingleplayerState` waere das eine Datenreparatur
 * bei jedem Klick.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findPlayersWithoutTrainingMode, isTeamTrainingComplete } from "@/lib/foundation/team-training-status";

type MinimalState = Parameters<typeof findPlayersWithoutTrainingMode>[0];

function spielstand(modi: Array<string | null>): MinimalState {
  return {
    rosters: modi.map((_, index) => ({ teamId: "A-A", playerId: `p${index}` })),
    players: modi.map((mode, index) => ({ id: `p${index}`, name: `Spieler ${index}`, trainingMode: mode })),
  } as unknown as MinimalState;
}

describe("Wer genau fehlt", () => {
  it("nennt den einen Spieler ohne Trainingsmodus beim Namen", () => {
    const gap = findPlayersWithoutTrainingMode(spielstand(["mittel", null, "hart"]), "A-A");
    expect(gap.status).toBe("incomplete");
    expect(gap.missingCount).toBe(1);
    expect(gap.missingPlayerNames).toEqual(["Spieler 1"]);
  });

  it("meldet `complete`, wenn alle einen Modus haben", () => {
    const gap = findPlayersWithoutTrainingMode(spielstand(["mittel", "leicht"]), "A-A");
    expect(gap.status).toBe("complete");
    expect(gap.missingPlayerNames).toEqual([]);
  });

  it("deckelt die Namensliste — eine Warnung mit dreissig Namen ist so unlesbar wie keine", () => {
    const gap = findPlayersWithoutTrainingMode(spielstand(new Array(12).fill(null)), "A-A");
    expect(gap.missingCount).toBe(12);
    expect(gap.missingPlayerNames).toHaveLength(5);
  });

  it("ein Kadereintrag ohne Spieler verschwindet nicht namenlos", () => {
    // Sonst suchte man wieder im Dunkeln — nur dass diesmal gar kein Name existiert.
    const state = {
      rosters: [{ teamId: "A-A", playerId: "geist" }],
      players: [],
    } as unknown as MinimalState;
    const gap = findPlayersWithoutTrainingMode(state, "A-A");
    expect(gap.status).toBe("incomplete");
    expect(gap.missingPlayerNames[0]).toContain("geist");
  });

  it("`isTeamTrainingComplete` bleibt die eine Ja/Nein-Antwort darauf", () => {
    // Zwei getrennte Ableitungen waeren zwei Wahrheiten ueber denselben Kader.
    expect(isTeamTrainingComplete(spielstand(["mittel"]), "A-A")).toBe(true);
    expect(isTeamTrainingComplete(spielstand([null]), "A-A")).toBe(false);
    expect(isTeamTrainingComplete(spielstand([]), "A-A")).toBe(false);
    expect(isTeamTrainingComplete(spielstand(["mittel"]), null)).toBe(false);
  });
});

describe("Der Flow-Schritt traegt den Grund", () => {
  const FLOW = readFileSync(join(process.cwd(), "lib/foundation/game-flow-controller.ts"), "utf8");
  const TRANSITION = readFileSync(join(process.cwd(), "lib/season/season-transition-service.ts"), "utf8");

  it("`check_training` warnt mit Anzahl und Namen", () => {
    expect(FLOW).toContain("training_mode_missing:");
    expect(FLOW).toContain("trainingGap.missingPlayerNames.join");
  });

  it("Status und Namen kommen aus EINER Ableitung", () => {
    expect(FLOW).toContain("const trainingGap = findPlayersWithoutTrainingMode(gameState, activeTeamId);");
    expect(FLOW).toContain('const trainingComplete = trainingGap.status === "complete";');
  });

  it("der Saisonwechsel setzt die Trainingsfelder fuer neue Kaderspieler", () => {
    // Der Weg, ueber den Chris' Spieler ohne Modus ins Team kamen.
    expect(TRANSITION).toContain("applyDefaultTrainingFieldsToRosteredPlayers({");
  });
});
