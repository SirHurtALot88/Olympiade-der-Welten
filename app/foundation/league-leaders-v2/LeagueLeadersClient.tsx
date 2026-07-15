"use client";

import LeagueLeadersNewLook from "@/app/foundation/league-leaders-v2/LeagueLeadersNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { LeagueLeaderCategory } from "@/lib/foundation/league-leaders-service";

export interface LeagueLeadersClientProps {
  categories: LeagueLeaderCategory[];
  selectedTeamId: string | null;
  seasonLabel: string;
  /**
   * Voller GameState für die "Neuer Look" Rekord-/Erfolge-Sektionen (Season-
   * Bestwerte, Meilensteine). Optional/nullbar, damit der Legacy-Pfad und
   * Isolation ohne State weiter funktionieren.
   */
  gameState?: GameState | null;
  returnContext?: { playerId: string; playerName: string } | null;
  onReturnToPlayer?: () => void;
  onOpenPlayer: (playerId: string) => void;
}

export default function LeagueLeadersClient(props: LeagueLeadersClientProps) {
  return <LeagueLeadersNewLook {...props} />;
}
