"use client";

import MarketingModern from "@/app/foundation/marketing/MarketingModern";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { MarketingAktionFn } from "@/lib/marketing/marketing-aktion-typen";

export type FoundationMarketingHostProps = {
  gameState: GameState;
  /** Das aktive Team des Managers (`activeManagerTeamId`); fremde Teams zeigt die Seite nie. */
  teamId: string | null;
  /** Schreibweg fuer das Aushaengeschild (`POST /api/marketing`). */
  onAktion?: MarketingAktionFn;
  /** Darf der Aufrufer fuer das aktive Team schreiben? Sonst nur lesen. */
  kannSchreiben?: boolean;
};

/** Host der Marketing-Seite: liest den Spielstand; geschrieben wird nur das Aushaengeschild, und nur ueber den Server (`onAktion`). */
export default function FoundationMarketingHost({ gameState, teamId, onAktion, kannSchreiben = false }: FoundationMarketingHostProps) {
  return <MarketingModern gameState={gameState} teamId={teamId} onAktion={onAktion} kannSchreiben={kannSchreiben} />;
}
