import type { GameState } from "@/lib/data/olyDataTypes";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";

/**
 * Inhaltsunterschrift fuer den Autosave: aendert sie sich, gab es eine Aenderung, die geschrieben
 * werden muss. Sie ignoriert deshalb alles, was der Client NICHT selbst schreibt.
 *
 * `saveVersion` — reine Buchhaltung des Servers.
 *
 * `persistedSeasonDerivations` — serverseitig materialisiert, nie vom Client verfasst.
 *
 * `seasonSnapshots` — NACHGETRAGEN, und der Grund ist ein Schaden, den die Schreib-Sicherheits-
 * pruefung im Smoke-Lauf aufgedeckt hat („Destructive signature unchanged" schlug fehl, obwohl der
 * Lauf nur gelesen hat). Seit die Saison-Archiv-Nachladung wirklich feuert, holt sie die
 * Schnappschuesse ueber `/api/season/snapshots` und legt sie in den React-Zustand. Damit aenderte
 * sich diese Unterschrift — und der Autosave schrieb den Spielstand, WEIL DER SPIELER EINE ANSICHT
 * GEOEFFNET HAT. Blosses Blaettern hat den Stand angefasst.
 *
 * Der Client verfasst Schnappschuesse nie: sie entstehen beim Saisonwechsel auf dem Server, und der
 * Schreibpfad hat gegen versehentliches Ueberschreiben ohnehin einen eigenen Archivschutz. Sie aus
 * der Aenderungserkennung zu nehmen kann also keine echte Aenderung verschlucken — beim
 * Saisonwechsel aendern sich Tabelle, Kasse und Saison-Id gleich mit und loesen den Schreibvorgang
 * aus.
 */
export function buildAutoPersistContentSignature(gameState: GameState) {
  return JSON.stringify({
    ...gameState,
    saveVersion: undefined,
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations: undefined,
      seasonSnapshots: undefined,
    },
  });
}

export type FoundationPersistPutBody = {
  saveId: string;
  gameState: GameState;
  expectedSaveVersion: number;
  compactPut?: boolean;
  skipMaterializeIfUnchanged?: boolean;
  materializeSeasonDerivations?: boolean;
};

export function buildFoundationPersistPutBody(input: {
  saveId: string;
  gameState: GameState;
  compactPut?: boolean;
  materializeSeasonDerivations?: boolean;
}): FoundationPersistPutBody {
  return {
    saveId: input.saveId,
    gameState: input.compactPut
      ? compactFoundationInitialGameState(input.gameState)
      : input.gameState,
    expectedSaveVersion: input.gameState.saveVersion ?? 0,
    compactPut: input.compactPut ?? false,
    skipMaterializeIfUnchanged: true,
    ...(input.materializeSeasonDerivations ? { materializeSeasonDerivations: true } : {}),
  };
}

import type { FoundationFetchRetryOptions } from "@/lib/foundation/foundation-fetch-with-retry";
import { foundationFetchWithRetryResponse } from "@/lib/foundation/foundation-fetch-with-retry";

export async function putFoundationGameState(
  body: FoundationPersistPutBody,
  options?: FoundationFetchRetryOptions,
): Promise<Response> {
  const result = await foundationFetchWithRetryResponse(
    "/api/singleplayer-state",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options,
  );
  if (!result.ok) {
    if (result.response) {
      return result.response;
    }
    throw result.cause instanceof Error ? result.cause : new Error("Save konnte nicht gespeichert werden.");
  }
  return result.response;
}
