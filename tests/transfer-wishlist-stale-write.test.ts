/**
 * GEMELDET AUS DEM SPIEL (Franky, Transfermarkt, Saison 1 / Spieltag 1):
 * „,wishlist & scouting' füllt sich immer wieder mit spielern die ich schon entfernt habe"
 *
 * Es füllt nichts nach. Repo-weit schreibt genau EINE Stelle in `seasonState.transferWishlist`
 * (`saveTransferWishlist`); die KI-Dienste lesen die Liste nur als Schutzliste. Der Spieler kam über
 * einen klassischen Last-Write-Wins zurück:
 *
 *   const currentEntries = gameState.seasonState.transferWishlist ?? [];   // ← Render-Closure
 *   saveTransferWishlist(currentEntries.filter(...));                      // ← Array, absolut gesetzt
 *   … setGameState((current) => ({ …, transferWishlist: nextEntries }))    // ← `current` ungelesen
 *
 * Zwei Entfern-Klicks, bevor der (sehr grosse) Shell neu gerendert hat, rechnen beide auf demselben
 * alten Stand. Der zweite Schreibvorgang enthält den vom ersten entfernten Spieler wieder.
 *
 * Dieselbe Falle traf den Spiegel in die Beobachtungsliste: `syncWishlistToScoutingWatchlist` leitet
 * seine Mirror-Einträge aus der Wishlist ab — lief er auf dem veralteten Stand, kam der Spieler dort
 * ebenfalls zurück.
 *
 * WAS DIESE DATEI PRÜFT UND WAS NICHT: `saveTransferWishlist` liegt in einem ~11 000 Zeilen langen
 * React-Hook und ist nicht isoliert aufrufbar; ein echter Render-Test dafür bräuchte den halben
 * Shell. Geprüft wird deshalb die Form am Quelltext — dieselbe Bauart, die dieses Repo auch für
 * andere Verdrahtungen benutzt. Das belegt NICHT, dass die Oberfläche sich richtig verhält; es
 * verhindert, dass genau dieses Muster unbemerkt zurückkommt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SCOPE = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
  "utf8",
);

/** Nur der Wishlist-Block — sonst greifen die Zusicherungen in fremden Code. */
const BLOCK = SCOPE.slice(
  SCOPE.indexOf("function saveTransferWishlist("),
  SCOPE.indexOf("function reorderTransferWishlist("),
);

describe("Wunschliste — entfernte Spieler bleiben entfernt", () => {
  /** DER KERN: die neue Liste entsteht aus `current`, nicht aus der Render-Closure. */
  it("leitet die neue Liste aus dem aktuellen State ab", () => {
    expect(BLOCK).toContain("const currentEntries = current.seasonState.transferWishlist ?? [];");
    expect(BLOCK).toContain(
      'const nextEntries = typeof update === "function" ? update(currentEntries) : update;',
    );
  });

  /**
   * Die Gegenprobe zur Ursache: kein Aufrufer darf die Liste mehr aus `gameState` berechnen und als
   * fertiges Array durchreichen. Genau diese Form war der Bug.
   */
  it("kein Aufrufer rechnet mehr auf der Render-Closure", () => {
    expect(BLOCK).not.toContain("saveTransferWishlist(currentEntries");
    expect(BLOCK).not.toMatch(/saveTransferWishlist\(\s*\(gameState\.seasonState\.transferWishlist/);
    expect(BLOCK).not.toMatch(/saveTransferWishlist\(\[buildWishlistEntry\(item\), \.\.\.currentEntries\]\)/);
  });

  it("Entfernen und Umsortieren laufen funktional", () => {
    const tail = SCOPE.slice(SCOPE.indexOf("function removeTransferWishlistEntry("));
    expect(tail).toContain(
      "saveTransferWishlist((entries) => entries.filter((entry) => entry.playerId !== playerId));",
    );
    expect(tail).toContain(
      "saveTransferWishlist((entries) => reorderTeamTransferWishlist(entries, teamId, playerId, targetIndex));",
    );
  });

  /**
   * Der umgekehrte Fall derselben Ursache: zwei Klicks auf denselben Spieler vor dem Rerender hätten
   * ihn doppelt in die Liste gelegt. Das Symptom wäre dasselbe gewesen — eine Liste, die sich
   * scheinbar von selbst füllt.
   */
  it("Hinzufuegen legt denselben Spieler nicht doppelt ab", () => {
    expect(BLOCK).toContain("entries.some((entry) => entry.playerId === item.playerId) ? entries :");
  });
});
