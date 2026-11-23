"use client";

import MarketingModern from "@/app/foundation/marketing/MarketingModern";
import type { GameState } from "@/lib/data/olyDataTypes";

export type FoundationMarketingHostProps = {
  gameState: GameState;
  /** Das aktive Team des Managers (`activeManagerTeamId`); fremde Teams zeigt die Seite nie. */
  teamId: string | null;
};

/** Host der Marketing-Seite: reiner Lesesicht-Aufruf, schreibt nichts (Schreibwege sind Folgeauftrag: Aushaengeschild und Werbeklausel). */
export default function FoundationMarketingHost({ gameState, teamId }: FoundationMarketingHostProps) {
  return <MarketingModern gameState={gameState} teamId={teamId} />;
}
