/**
 * DER FLOW HAENGT BEI „TRAINING PRUEFEN" — ZUM DRITTEN MAL.
 *
 * Chris am 23.08.2026: „und der training prüfen button hängt immernoch bitte fixen."
 *
 * Vorher schon zweimal gemeldet und zweimal „behoben":
 *   `j53iox` — der Saisonwechsel setzt den Vorgabewert jetzt auch.
 *   `hnbng4` — der Direktkauf setzt ihn jetzt auch.
 *
 * BEIDE FIXES STIMMEN, UND BEIDE HELFEN CHRIS NICHT. Sie setzen den Wert bei NEUEN Vorgaengen.
 * Wer schon ohne Trainingsmodus im Kader steht, steht dort weiter — und ein einziger solcher
 * Spieler haelt den ganzen Flow auf.
 *
 * AM LIVE-ABBILD VOM 23.08. NACHGEMESSEN, mit `findPlayersWithoutTrainingMode` je Menschen-Team:
 *
 *   swnjlk  V-W  fehlt 1 — Johanna
 *   h0z7cl  T-G  fehlen 8 — Fungor, Exsukkator, Rootheart, Spineshard, Mokra, …
 *   n90y4m  C-C  fehlen 2 — Gary the Keeper, King Arlen Morgolor
 *
 * Alle elf kamen ueber `manual_transfermarkt_buy` — also genau den Weg, den `hnbng4` geschlossen
 * hat, nur eben VOR dem Fix. Kein Weg im Spiel setzt den Wert danach noch nach: die Sperre bleibt
 * fuer immer, weil sie an einem Datensatz haengt, den niemand mehr anfasst.
 *
 * DIE HEILUNG SITZT DESHALB AUF DEM LADEWEG — dort stehen bereits vier idempotente Nachzuege
 * derselben Bauart (`ensurePlayerBaselines`, `ensurePlayerInjuryHistoryForGameState`,
 * `ensurePlayerPotentialForGameState`, `ensureNulaOnProjectSuicide`), dieser ist der fuenfte —
 * UND auf dem Schreibweg, weil `saveGameState` seinen Rueckgabewert in den Sitzungs-Cache legt.
 *
 * WAS DIESE DATEI BELEGT UND WAS NICHT: sie prueft den Schreibweg. Die Ladeweg-Heilung ist am
 * LIVE-ABBILD gemessen (`scripts/pruefe-trainingsmodus-luecken.ts`) — ohne sie meldet der Lauf
 * elf Spieler in drei Spielstaenden, mit ihr keinen einzigen. Ein Testfall dafuer stand hier und
 * ist wieder raus: er blieb in der Gegenprobe gruen und belegte damit nichts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { findPlayersWithoutTrainingMode } from "@/lib/foundation/team-training-status";

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-training-heal-test-"));
  process.env.OLY_APP_SQLITE_PATH = path.join(tempDirectory, "data", "oly-app.sqlite");
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

/** Ein Spielstand mit genau Chris' Lage: ein Kaderspieler ohne Trainingsmodus. */
function spielstandMitLuecke(): { gameState: GameState; teamId: string; playerId: string } {
  const basis = createSingleplayerGameState() as unknown as GameState;
  const teamId = basis.rosters[0]?.teamId;
  const playerId = basis.rosters.find((eintrag) => eintrag.teamId === teamId)?.playerId;
  expect(teamId, "Testspielstand ohne Kader").toBeTruthy();
  expect(playerId, "Testspielstand ohne Kaderspieler").toBeTruthy();
  return {
    teamId: teamId!,
    playerId: playerId!,
    gameState: {
      ...basis,
      players: basis.players.map((spieler): Player =>
        spieler.id === playerId ? { ...spieler, trainingMode: undefined } : spieler,
      ),
    },
  };
}

describe("Trainingsmodus heilt beim Laden", () => {
  it("setzt den fehlenden Trainingsmodus eines Kaderspielers beim Laden nach", () => {
    const { gameState, teamId, playerId } = spielstandMitLuecke();
    const repository = createSaveRepository();
    const saveId = "save-training-luecke";
    repository.saveGameState({ saveId, name: saveId, gameState });

    // Vor dem Laden ist die Luecke echt — sonst prueft der Fall nichts.
    expect(findPlayersWithoutTrainingMode(gameState, teamId).status).toBe("incomplete");

    const geladen = repository.getSaveById(saveId)?.gameState as GameState | undefined;
    expect(geladen, "Spielstand nicht ladbar").toBeDefined();
    expect(geladen!.players.find((spieler) => spieler.id === playerId)?.trainingMode).toBeTruthy();
    expect(findPlayersWithoutTrainingMode(geladen!, teamId).status).toBe("complete");
  });

  it("laesst einen vorhandenen Trainingsmodus in Ruhe — geheilt wird nur, was fehlt", () => {
    const { gameState, teamId, playerId } = spielstandMitLuecke();
    const mitHart: GameState = {
      ...gameState,
      players: gameState.players.map((spieler): Player =>
        spieler.id === playerId ? { ...spieler, trainingMode: "hart" } : spieler,
      ),
    };
    const repository = createSaveRepository();
    const saveId = "save-training-hart";
    repository.saveGameState({ saveId, name: saveId, gameState: mitHart });

    const geladen = repository.getSaveById(saveId)?.gameState as GameState | undefined;
    expect(geladen!.players.find((spieler) => spieler.id === playerId)?.trainingMode).toBe("hart");
    expect(findPlayersWithoutTrainingMode(geladen!, teamId).status).toBe("complete");
  });

  /*
   * HIER STAND EIN FALL „heilt auch den kalten Ladeweg" — UND ER HAT NICHTS GEPRUEFT.
   *
   * Er schrieb den Spielstand, loeschte `trainingMode` von Hand aus der `players`-Zeile, verwarf
   * den Sitzungs-Cache und las neu. Gegenprobe gefahren: der Fall blieb GRUEN, auch als die
   * Ladeweg-Heilung entfernt war. Der Lesepfad baut die Spielerliste offenbar nicht allein aus
   * dieser Zeile — der Fall erreichte `materializePersistedSave` also gar nicht.
   *
   * Ein Test, dessen Scheitern man nie gesehen hat, ist keiner. Er ist deshalb entfernt statt
   * umgeschrieben, und der Beleg fuer die Ladeweg-Heilung steht dort, wo er wirklich gemessen
   * wurde: am Live-Abbild, mit `scripts/pruefe-trainingsmodus-luecken.ts`. Ohne die Heilung
   * meldet es elf Spieler in drei Spielstaenden, mit ihr keinen einzigen.
   */

  it("ruehrt Spieler ohne Kaderplatz nicht an — freie Spieler trainieren bei niemandem", () => {
    const { gameState } = spielstandMitLuecke();
    const imKader = new Set(gameState.rosters.map((eintrag) => eintrag.playerId));
    const freier = gameState.players.find((spieler) => !imKader.has(spieler.id));
    expect(freier, "Testspielstand ohne vereinslosen Spieler").toBeDefined();
    const ohneModus: GameState = {
      ...gameState,
      players: gameState.players.map((spieler): Player =>
        spieler.id === freier!.id ? { ...spieler, trainingMode: undefined } : spieler,
      ),
    };
    const repository = createSaveRepository();
    const saveId = "save-training-frei";
    repository.saveGameState({ saveId, name: saveId, gameState: ohneModus });

    const geladen = repository.getSaveById(saveId)?.gameState as GameState | undefined;
    expect(geladen!.players.find((spieler) => spieler.id === freier!.id)?.trainingMode).toBeUndefined();
  });
});
