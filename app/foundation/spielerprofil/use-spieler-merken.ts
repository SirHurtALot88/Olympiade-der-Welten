"use client";

import { useCallback, useMemo } from "react";

import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";
import { istGemerkt, normalisiereMerklistenBesitzer, schalteMerkliste } from "@/lib/merkliste/merkliste-service";

/** „Merken“ ohne Netzaufruf: wie in der Teamansicht, der Autosave nimmt die Merkliste im Spielstand mit. */
export function useSpielerMerken(playerId: string, ownerId: string | null | undefined) {
  const kontext = useFoundationStateOptional();
  const besitzer = normalisiereMerklistenBesitzer(ownerId);
  const gameState = kontext?.gameState ?? null;
  const setGameState = kontext?.setGameState ?? null;
  const gemerkt = useMemo(
    () => (gameState ? istGemerkt(gameState, { ownerId: besitzer, art: "spieler", id: playerId }) : false),
    [gameState, besitzer, playerId],
  );
  const umschalten = useCallback(() => {
    setGameState?.((aktuell) => schalteMerkliste({ gameState: aktuell, ownerId: besitzer, art: "spieler", id: playerId }).gameState);
  }, [setGameState, besitzer, playerId]);
  return { gemerkt, umschalten, verfuegbar: setGameState != null };
}
