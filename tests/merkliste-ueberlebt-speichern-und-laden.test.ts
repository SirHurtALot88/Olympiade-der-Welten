/**
 * DIE MERKLISTE MUSS EINEN KALT-LOAD ÜBERLEBEN — nicht nur die laufende Sitzung.
 *
 * GEMELDET (Chris, per Screenshot der Merkliste-Seite: "0 Einträge", "Noch nichts gemerkt."):
 * „die seite bringt nichts!" — er hatte einen Stern gesetzt, die Seite zeigte trotzdem leer.
 *
 * ROOT CAUSE, gemessen statt vermutet: `lib/persistence/save-repository.ts` zerlegt den
 * Spielstand beim Schreiben in einzelne Tabellen plus ein `game_metadata`-Objekt mit einer
 * FEST AUSGEZÄHLTEN Feldliste (`GameMetadata`) — und `merkliste` stand auf keiner dieser
 * Listen, weder beim Schreiben (`replaceSingleton("game_metadata", ...)`) noch beim
 * Zusammenbauen nach dem Laden (`materializePersistedSave`). Innerhalb EINER Browser-Sitzung
 * fiel das nie auf: React hielt den Stern im lokalen `gameState`, und `merkliste-service.ts`
 * las genau dieses Objekt. Jeder Kalt-Load (Reload, neue Sitzung, Serverneustart, ein
 * ausgelaufener Session-Cache) baute den Spielstand dagegen OHNE das Feld neu auf — die Liste
 * war leer, ohne dass irgendwer sie geleert hätte.
 *
 * Dieser Test geht deshalb bewusst NICHT über `merkliste-service.ts` allein (das deckt
 * `merkliste-service.test.ts` schon lückenlos ab), sondern über den ECHTEN Pfad: Stern setzen
 * → über das echte Repository speichern → Session-Cache verwerfen → kalt aus SQLite laden →
 * derselbe Eintrag muss wieder da sein. Genau der Pfad, den `merkliste-service.test.ts` nicht
 * sieht, weil er nie ein Repository anfasst.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { leseMerkliste, merke } from "@/lib/merkliste/merkliste-service";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { invalidateSaveSessionCache } from "@/lib/persistence/save-session-cache";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";

const SAVE_ID = "merkliste-rundreise";
const OWNER = "owner-chris";
const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-merkliste-rundreise-"));
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

describe("Merkliste überlebt die Runde durch SQLite", () => {
  it("ein gemerktes Team UND ein gemerkter Spieler sind nach dem kalten Laden noch da", () => {
    const frisch = createSingleplayerGameState();
    const teamId = frisch.teams[0]?.teamId;
    const playerId = frisch.players[0]?.id;
    expect(teamId, "braucht mindestens ein Team, um etwas merken zu können").toBeTruthy();
    expect(playerId, "braucht mindestens einen Spieler, um etwas merken zu können").toBeTruthy();

    let vorher: GameState = merke({ gameState: frisch, ownerId: OWNER, art: "team", id: teamId! });
    vorher = merke({ gameState: vorher, ownerId: OWNER, art: "spieler", id: playerId! });

    // Die Voraussetzung, gemessen statt behauptet: der Stern steht VOR dem Speichern.
    expect(leseMerkliste(vorher, OWNER)).toHaveLength(2);

    const repository = createSaveRepository();
    repository.saveGameState({ saveId: SAVE_ID, gameState: vorher });
    // Ohne diesen Schritt würde der Test den im Speicher gebliebenen `persistedSave` aus
    // `writeSaveSessionCache` lesen — denselben, der das Problem nie gezeigt hätte.
    invalidateSaveSessionCache(SAVE_ID);

    const geladen = repository.getSaveById(SAVE_ID);
    expect(geladen, "der Spielstand muss sich kalt laden lassen").not.toBeNull();
    const nachher = geladen!.gameState;

    const eintraegeNachher = leseMerkliste(nachher, OWNER);
    expect(eintraegeNachher, "beide Sterne (Team + Spieler) müssen den Kalt-Load überleben").toHaveLength(2);
    expect(eintraegeNachher.some((eintrag) => eintrag.art === "team" && eintrag.id === teamId)).toBe(true);
    expect(eintraegeNachher.some((eintrag) => eintrag.art === "spieler" && eintrag.id === playerId)).toBe(true);
  }, 60_000);

  it("ein Spielstand ohne Merkliste lädt weiterhin eine leere Liste, keinen Fehler", () => {
    const frisch = createSingleplayerGameState();
    const repository = createSaveRepository();
    repository.saveGameState({ saveId: SAVE_ID, gameState: frisch });
    invalidateSaveSessionCache(SAVE_ID);

    const nachher = repository.getSaveById(SAVE_ID)!.gameState;
    expect(leseMerkliste(nachher, OWNER)).toEqual([]);
  }, 60_000);
});
