/**
 * ZEIGT DER MARKTWERT-HOVER AM ECHTEN SPIELSTAND WIRKLICH ETWAS?
 *
 * CHRIS AM 24.08.2026: „kannst du 6 nochmal prüfen ob der hover wirklich angezeigt wird."
 *
 * Berechtigte Frage: bei den Saisonstand-Hovers hing die Ableitung schon einmal am nirgends
 * gerenderten Modell, und JEDER Test war gruen. Ein Quelltext-Waechter belegt, dass die Zuweisung
 * dasteht — nicht, dass am Ende Daten ankommen.
 *
 * Dieser Lauf faehrt deshalb GENAU den Weg, den die Seite faehrt:
 *   buildPlayerDirectorySlice (Server, voller Save)
 *     -> maskPlayerDirectorySliceForRequestingTeam (Fog of War, wie in der API-Route)
 *        -> und zaehlt, fuer wie viele der ANGEZEIGTEN Zeilen eine Zerlegung uebrig bleibt.
 *
 * Die Zahl, auf die es ankommt, ist die letzte: ein Hover, der nur bei einem Zehntel der Zeilen
 * aufgeht, ist im Spiel ein kaputter Hover, auch wenn jede Ableitung fuer sich stimmt.
 *
 * Aufruf: OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/pruefe-marktwert-hover-am-abbild.ts
 */
import { createSaveRepository } from "@/lib/persistence/save-repository";
import {
  buildPlayerDirectorySlice,
  maskPlayerDirectorySliceForRequestingTeam,
} from "@/lib/foundation/player-directory-slice";
import { DEBUG_FORCE_PLAYER_VISIBILITY } from "@/lib/foundation/debug-player-visibility";

import type { GameState } from "@/lib/data/olyDataTypes";

console.log(`DEBUG_FORCE_PLAYER_VISIBILITY = ${DEBUG_FORCE_PLAYER_VISIBILITY}\n`);

const repository = createSaveRepository();

for (const kopf of repository.listSaves()) {
  const gameState = repository.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gameState) continue;

  // Das Team, aus dessen Sicht die Seite gebaut wird — dasselbe, was der Client als `teamId` an
  // die Route haengt.
  const meinTeam = gameState.teams.find((team) => team.humanControlled !== false)?.teamId ?? null;

  const roh = buildPlayerDirectorySlice({
    gameState,
    saveId: kopf.saveId,
    seasonId: gameState.season.id,
    contentSignature: null,
  });
  const maskiert = maskPlayerDirectorySliceForRequestingTeam({
    payload: roh,
    gameState,
    requestingTeamId: meinTeam,
  });

  const imKader = new Set(gameState.rosters.map((eintrag) => eintrag.playerId));
  const eigeneKaderIds = gameState.rosters
    .filter((eintrag) => eintrag.teamId === meinTeam)
    .map((eintrag) => eintrag.playerId);

  const vorMaske = Object.keys(roh.marketValueBreakdownByPlayerId ?? {});
  const nachMaske = new Set(Object.keys(maskiert.marketValueBreakdownByPlayerId ?? {}));

  // „Aktive Spieler" ist der Standard-Zuschnitt der Spielerliste: alle Spieler MIT Kaderplatz,
  // nicht nur die eigenen. Genau diese Zeilen sieht Chris beim Oeffnen.
  const zeilenAktiv = gameState.players.filter((spieler) => imKader.has(spieler.id));
  const zeilenMitHover = zeilenAktiv.filter((spieler) => nachMaske.has(spieler.id)).length;
  const eigeneMitHover = eigeneKaderIds.filter((id) => nachMaske.has(id)).length;

  // Und stichprobenartig: ergibt die gezeigte Rechnung wirklich die gezeigte Summe?
  let zeilenGehenAuf = 0;
  let zeilenGeprueft = 0;
  for (const id of eigeneKaderIds) {
    const h = maskiert.marketValueBreakdownByPlayerId?.[id];
    if (!h) continue;
    zeilenGeprueft += 1;
    const sichtbar = Number(
      (h.zeilen.reduce((summe, zeile) => summe + zeile.amount, 0) + h.restSumme).toFixed(2),
    );
    if (sichtbar === h.summeRaenge) zeilenGehenAuf += 1;
  }

  console.log(
    `${kopf.saveId}  (mein Team ${meinTeam ?? "—"})\n` +
      `  Zerlegungen im Slice: ${vorMaske.length} · nach Fog-of-War: ${nachMaske.size}\n` +
      `  Spielerliste „Aktive": ${zeilenAktiv.length} Zeilen, davon mit Hover ${zeilenMitHover}` +
      ` (${((zeilenMitHover / Math.max(1, zeilenAktiv.length)) * 100).toFixed(0)} %)\n` +
      `  eigener Kader: ${eigeneKaderIds.length}, davon mit Hover ${eigeneMitHover}\n` +
      `  Rechnung geht auf: ${zeilenGehenAuf}/${zeilenGeprueft}`,
  );
}
