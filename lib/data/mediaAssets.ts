import playerPortraitMap from "@/data/generated/player-portrait-map.json";
import portraitFileIndex from "@/data/generated/portrait-files.json";
import teamLogoFileIndex from "@/data/generated/team-logo-files.json";
import teamLogoMap from "@/data/generated/team-logo-map.json";
import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { hydratePlayersWithAttributeSheet } from "@/lib/data/playerAttributeSheetData";
import { repairImportedPlayerData } from "@/lib/data/playerImportRepairs";
import {
  appendMediaImageVariant,
  type MediaImageVariant,
} from "@/lib/media/mediaThumbnailConfig";

export type { MediaImageVariant };
export { appendMediaImageVariant };

const teamLogoPathByTeamId = teamLogoMap as Record<string, string>;
const portraitPathByPlayerId: Record<string, string> = {
  ...(playerPortraitMap as Record<string, string>),
  "player-0154-riley-le-rouge":
    "/Users/chrisfalk/.cursor/projects/Users-chrisfalk-Documents-Codex-Olympiade-der-Welten/assets/Riley_Le_Rogue-bef87d06-48fe-4eca-b665-cb9db53399e5.png",
  "player-2969-lakshmi-ekelemann":
    "/Users/chrisfalk/Library/CloudStorage/Dropbox/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/Lakshmi Ekelmann.jpg",
  "player-2968-toothkrix":
    "/Users/chrisfalk/.cursor/projects/Users-chrisfalk-Documents-Codex-Olympiade-der-Welten/assets/Toothkrix-e3306eb2-a689-4084-ba94-5708dd7a9a17.png",
  "player-2676-peacock":
    "/Users/chrisfalk/.cursor/projects/Users-chrisfalk-Documents-Codex-Olympiade-der-Welten/assets/Peacock.png",
};

export function getPlayerPortraitPathById(playerId: string) {
  return portraitPathByPlayerId[playerId] ?? null;
}

// Repo-relative portraits. Drop image files into public/portraits/ and run
// `npm run portraits:index` (see public/portraits/README.md) to regenerate
// data/generated/portrait-files.json. Files here always take priority over
// the legacy absolute-path map below, and with no files present this is a
// no-op (falls through to the existing map / initials fallback).
const PORTRAIT_STATIC_DIR = "/portraits";
const portraitFileBasenames = portraitFileIndex as string[];
const portraitFileByKey = new Map<string, string>();
for (const filename of portraitFileBasenames) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) {
    continue;
  }
  const key = filename.slice(0, dot).toLowerCase();
  if (!portraitFileByKey.has(key)) {
    portraitFileByKey.set(key, filename);
  }
}

function getStaticPortraitUrl(playerId: string): string | null {
  if (portraitFileByKey.size === 0) {
    return null;
  }

  const idKey = playerId.toLowerCase();
  const byId = portraitFileByKey.get(idKey);
  if (byId) {
    return `${PORTRAIT_STATIC_DIR}/${byId}`;
  }

  // Player ids look like "player-0001-umbros" — the part after the 4-digit
  // number is a name slug, so a file named "umbros.jpg" also matches.
  const slugMatch = idKey.match(/^player-\d+-(.+)$/);
  if (slugMatch) {
    const bySlug = portraitFileByKey.get(slugMatch[1]);
    if (bySlug) {
      return `${PORTRAIT_STATIC_DIR}/${bySlug}`;
    }
  }

  return null;
}

export function getTeamLogoPathById(teamId: string) {
  return teamLogoPathByTeamId[teamId] ?? null;
}

// Repo-relative team logos. Drop image files into public/team-logos/ and run
// `npm run team-logos:index` (see public/team-logos/README.md) to regenerate
// data/generated/team-logo-files.json. Files here always take priority over
// the legacy absolute-path map below, and with no files present this is a
// no-op (falls through to the existing map / initials fallback).
//
// Team ids in this game are already short codes (e.g. "A-A"), so unlike
// portraits there is no separate "name slug" to also match against — the
// file is simply named "<teamId>.<ext>" (case-insensitive).
const TEAM_LOGO_STATIC_DIR = "/team-logos";
const teamLogoFileBasenames = teamLogoFileIndex as string[];
const teamLogoFileByKey = new Map<string, string>();
for (const filename of teamLogoFileBasenames) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) {
    continue;
  }
  const key = filename.slice(0, dot).toLowerCase();
  if (!teamLogoFileByKey.has(key)) {
    teamLogoFileByKey.set(key, filename);
  }
}

function getStaticTeamLogoUrl(teamId: string): string | null {
  if (teamLogoFileByKey.size === 0) {
    return null;
  }

  const byId = teamLogoFileByKey.get(teamId.toLowerCase());
  if (byId) {
    return `${TEAM_LOGO_STATIC_DIR}/${byId}`;
  }

  return null;
}

export type MediaBrowserUrlOptions = {
  variant?: MediaImageVariant;
};

export function getPlayerPortraitBrowserUrl(
  playerId: string,
  portraitUrl?: string | null,
  portraitPath?: string | null,
  options?: MediaBrowserUrlOptions,
) {
  const variant = options?.variant ?? "default";

  if (portraitUrl?.startsWith("http://") || portraitUrl?.startsWith("https://") || (portraitUrl?.startsWith("/") && !portraitUrl.startsWith("/Users/"))) {
    return appendMediaImageVariant(portraitUrl, variant);
  }

  if (portraitPath?.startsWith("/") && !portraitPath.startsWith("/Users/")) {
    return appendMediaImageVariant(portraitPath, variant);
  }

  const staticPortraitUrl = getStaticPortraitUrl(playerId);
  if (staticPortraitUrl) {
    return staticPortraitUrl;
  }

  if (portraitPathByPlayerId[playerId] || portraitPath?.startsWith("/Users/")) {
    return appendMediaImageVariant(`/api/media/player-portrait/${encodeURIComponent(playerId)}`, variant);
  }

  return null;
}

export function getTeamLogoBrowserUrl(teamId: string, logoPath?: string | null, options?: MediaBrowserUrlOptions) {
  const variant = options?.variant ?? "default";

  if (logoPath?.startsWith("/") && !logoPath.startsWith("/Users/")) {
    return appendMediaImageVariant(logoPath, variant);
  }

  const staticTeamLogoUrl = getStaticTeamLogoUrl(teamId);
  if (staticTeamLogoUrl) {
    return staticTeamLogoUrl;
  }

  if (teamLogoPathByTeamId[teamId] || logoPath?.startsWith("/Users/")) {
    return appendMediaImageVariant(`/api/media/team-logo/${encodeURIComponent(teamId)}`, variant);
  }

  return null;
}

export function getTeamLogoModel(
  team: Pick<Team, "teamId" | "name" | "logoPath">,
  options?: MediaBrowserUrlOptions,
) {
  const src = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null, options);
  const initials =
    team.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return { src, initials };
}

export function getPlayerPortraitMediaModel(player: Pick<Player, "id" | "name" | "portraitUrl" | "portraitPath">) {
  const src = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath);
  const initials =
    player.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return {
    src,
    thumbSrc: appendMediaImageVariant(src, "thumb"),
    previewSrc: appendMediaImageVariant(src, "preview"),
    initials,
  };
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
    players: repairImportedPlayerData(hydratePlayersWithAttributeSheet(gameState.players)).map(attachPlayerPortraitPath),
  };
}

export function getMediaMappingSummary() {
  return {
    mappedTeamLogos: Object.keys(teamLogoPathByTeamId).length,
    mappedPlayerPortraits: Object.keys(portraitPathByPlayerId).length,
    staticPortraitFiles: portraitFileByKey.size,
    staticTeamLogoFiles: teamLogoFileByKey.size,
  };
}
