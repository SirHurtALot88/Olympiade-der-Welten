import playerPortraitMap from "@/data/generated/player-portrait-map.json";
import teamLogoMap from "@/data/generated/team-logo-map.json";
import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { hydratePlayersWithAttributeSheet } from "@/lib/data/playerAttributeSheetData";

const teamLogoPathByTeamId = teamLogoMap as Record<string, string>;
const portraitPathByPlayerId: Record<string, string> = {
  ...(playerPortraitMap as Record<string, string>),
  "player-0154-riley-le-rouge":
    "/Users/chrisfalk/Library/CloudStorage/Dropbox/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/Riley Le Rogue.jpg",
  "player-2969-lakshmi-ekelemann":
    "/Users/chrisfalk/Library/CloudStorage/Dropbox/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/Lakshmi Ekelmann.jpg",
};

export function getPlayerPortraitPathById(playerId: string) {
  return portraitPathByPlayerId[playerId] ?? null;
}

export function getTeamLogoPathById(teamId: string) {
  return teamLogoPathByTeamId[teamId] ?? null;
}

export function getPlayerPortraitBrowserUrl(playerId: string, portraitUrl?: string | null, portraitPath?: string | null) {
  if (portraitUrl?.startsWith("http://") || portraitUrl?.startsWith("https://") || (portraitUrl?.startsWith("/") && !portraitUrl.startsWith("/Users/"))) {
    return portraitUrl;
  }

  if (portraitPath?.startsWith("/") && !portraitPath.startsWith("/Users/")) {
    return portraitPath;
  }

  if (portraitPathByPlayerId[playerId] || portraitPath?.startsWith("/Users/")) {
    return `/api/media/player-portrait/${encodeURIComponent(playerId)}`;
  }

  return null;
}

export function getTeamLogoBrowserUrl(teamId: string, logoPath?: string | null) {
  if (logoPath?.startsWith("/") && !logoPath.startsWith("/Users/")) {
    return logoPath;
  }

  if (teamLogoPathByTeamId[teamId] || logoPath?.startsWith("/Users/")) {
    return `/api/media/team-logo/${encodeURIComponent(teamId)}`;
  }

  return null;
}

export function attachTeamLogoPath(team: Team): Team {
  return {
    ...team,
    logoPath: team.logoPath ?? teamLogoPathByTeamId[team.teamId] ?? null,
  };
}

export function attachPlayerPortraitPath(player: Player): Player {
  return {
    ...player,
    portraitPath: player.portraitPath ?? portraitPathByPlayerId[player.id] ?? null,
    portraitUrl: getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath ?? portraitPathByPlayerId[player.id] ?? null),
  };
}

export function hydrateGameStateMedia(gameState: GameState): GameState {
  return {
    ...gameState,
    teams: gameState.teams.map(attachTeamLogoPath),
    players: hydratePlayersWithAttributeSheet(gameState.players).map(attachPlayerPortraitPath),
  };
}

export function getMediaMappingSummary() {
  return {
    mappedTeamLogos: Object.keys(teamLogoPathByTeamId).length,
    mappedPlayerPortraits: Object.keys(portraitPathByPlayerId).length,
  };
}
