"use client";

import MatchdayArenaNewLook from "@/app/foundation/matchday-arena-v2/MatchdayArenaNewLook";
import type { Player, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

export type MatchdayArenaV2ClientProps = {
  initialSource?: "sqlite" | "prisma";
  defaultSaveId: string;
  defaultSeasonId: string;
  defaultMatchdayId: string;
  defaultTeamId?: string | null;
  playerCatalog: Player[];
  teams: Team[];
  teamControlSettingsMap: Record<string, TeamControlSettings>;
  roomContext?: FoundationRoomContext | null;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenTeam?: (teamId: string) => void;
  onBackToLineup?: (() => void) | null;
  onOpenMatchdayResult?: (() => void) | null;
  onOpenSeason?: (() => void) | null;
  onOpenTraining?: (() => void) | null;
  /** Schließt den Loop: startet den nächsten Spieltag (kanonische "Weiter"-Aktion). */
  onAdvanceMatchday?: (() => void) | null;
};

export default function MatchdayArenaV2Client(props: MatchdayArenaV2ClientProps) {
  return <MatchdayArenaNewLook {...props} />;
}
