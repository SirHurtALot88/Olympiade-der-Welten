"use client";

import AusruestungModern, { type AusruestungAktionFn } from "@/app/foundation/ausruestung/AusruestungModern";
import type { GameState } from "@/lib/data/olyDataTypes";

export type FoundationAusruestungHostProps = {
  gameState: GameState;
  /** Aktives Team des Managers (`activeManagerTeamId`) — nie ein fremdes. */
  teamId: string | null;
  /** Schreibweg (laeuft serverseitig durch den Raum-Schutz). Fehlt er, ist die Seite nur lesbar. */
  onAktion?: AusruestungAktionFn;
  kannVerwalten?: boolean;
};

/** Host/View-Trennung wie `FoundationFinancesHost`: die Seite bekommt den Spielstand und das aktive Team, sonst nichts. */
export default function FoundationAusruestungHost({ gameState, teamId, onAktion, kannVerwalten }: FoundationAusruestungHostProps) {
  return <AusruestungModern gameState={gameState} teamId={teamId} onAktion={onAktion} kannVerwalten={kannVerwalten} />;
}
