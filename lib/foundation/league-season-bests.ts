import type { GameState } from "@/lib/data/olyDataTypes";
import type { LeagueLeaderCategory } from "@/lib/foundation/league-leaders-service";
import { getPlayerDisplayMarketValue } from "@/lib/foundation/player-display-market-value";
import { formatNlNumber, type NlTone } from "@/components/foundation/new-look/nl-tones";

/**
 * "Saison-Bestwerte (laufend)" + Own-Team-Leaderboard-Footprint.
 *
 * D7 — In-Season-Bestwerte: seedet die Rekord-/Hall-of-Fame-Sektion mit den
 * aktuellen Saison-Bestwerten, damit sie ab S1/MD1 lebt (statt bis zur ersten
 * archivierten Saison "Noch keine Rekorde" zu zeigen). Alles hier ist rein aus
 * öffentlichen/laufenden Daten abgeleitet:
 * - Kategorie-Leader (PPs/OVR/MVS) kommen 1:1 aus den bereits berechneten
 *   `LeagueLeaderCategory.entries` (Top N ligaweit, fog-safe).
 * - Höchster Kaderwert (laufend) = Summe der öffentlichen Display-Marktwerte je
 *   Team (`getPlayerDisplayMarketValue`), niemals verstecktes Potenzial.
 *
 * D11 — Own-Team-Footprint: zählt Top-5-Slots des Manager-Teams über alle
 * Kategorien und die beste Platzierung — ebenfalls nur aus `entries`
 * (öffentliche Ranglisten). Kein Zugriff auf fremdes verstecktes Potenzial.
 */

export type LeagueSeasonBestEntry = {
  key: string;
  label: string;
  holderName: string;
  holderSub: string | null;
  displayValue: string;
  tone: NlTone;
  /** Nur gesetzt, wenn der Bestwert an einen Spieler gebunden ist (Profil öffnen). */
  playerId: string | null;
  isOwn: boolean;
};

export type LeagueSeasonBests = {
  seasonLabel: string;
  entries: LeagueSeasonBestEntry[];
};

export type OwnTeamLeaderboardFootprint = {
  hasTeam: boolean;
  /** Anzahl Kategorien, die überhaupt Einträge tragen. */
  trackedCategories: number;
  /** Summe der Top-5-Slots (gelistete Einträge) des eigenen Teams über alle Kategorien. */
  top5SlotCount: number;
  /** Kategorien, in denen mindestens ein eigener Spieler gelistet ist. */
  categoriesWithTop5: number;
  /** Kategorien, in denen ein eigener Spieler Rang 1 (Leader) ist. */
  leaderCount: number;
  bestPlacement: {
    rank: number;
    categoryId: string;
    categoryLabel: string;
    playerName: string;
    playerId: string;
    displayValue: string;
  } | null;
};

/** Kategorie → Bestwert-Anzeigekonfiguration (nur die als "Rekord" sinnvollen Kategorien). */
const SEASON_BEST_CATEGORY_CONFIG: Array<{ id: string; label: string; tone: NlTone }> = [
  { id: "pps", label: "Bester PPs-Wert", tone: "good" },
  { id: "ovr", label: "Bestes OVR", tone: "accent" },
  { id: "mvs", label: "Bester MVS", tone: "warn" },
];

export type TeamSquadMarketValueRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  total: number;
};

export function buildTeamSquadMarketValues(gameState: GameState): TeamSquadMarketValueRow[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const totalByTeamId = new Map<string, number>();

  for (const roster of gameState.rosters) {
    const player = playerById.get(roster.playerId);
    if (!player) {
      continue;
    }
    const marketValue = getPlayerDisplayMarketValue(player);
    if (marketValue == null || !Number.isFinite(marketValue) || marketValue <= 0) {
      continue;
    }
    totalByTeamId.set(roster.teamId, (totalByTeamId.get(roster.teamId) ?? 0) + marketValue);
  }

  return [...totalByTeamId.entries()]
    .map(([teamId, total]) => {
      const team = teamById.get(teamId) ?? null;
      return {
        teamId,
        teamName: team?.name ?? teamId,
        teamCode: team?.shortCode ?? teamId,
        total: Number(total.toFixed(2)),
      };
    })
    .sort((left, right) => right.total - left.total);
}

export function buildLeagueSeasonBests(input: {
  categories: LeagueLeaderCategory[];
  gameState: GameState | null;
  selectedTeamId: string | null;
  seasonLabel: string;
}): LeagueSeasonBests {
  const { categories, gameState, selectedTeamId, seasonLabel } = input;
  const entries: LeagueSeasonBestEntry[] = [];

  for (const config of SEASON_BEST_CATEGORY_CONFIG) {
    const category = categories.find((candidate) => candidate.id === config.id);
    const leader = category?.entries[0] ?? null;
    if (!leader) {
      continue;
    }
    entries.push({
      key: `category:${config.id}`,
      label: config.label,
      holderName: leader.name,
      holderSub: leader.teamCode ?? leader.teamName,
      displayValue: leader.displayValue,
      tone: config.tone,
      playerId: leader.playerId,
      isOwn: leader.teamId != null && leader.teamId === selectedTeamId,
    });
  }

  if (gameState) {
    const [peakSquad] = buildTeamSquadMarketValues(gameState);
    if (peakSquad) {
      entries.push({
        key: "squad:peak-market-value",
        label: "Höchster Kaderwert",
        holderName: peakSquad.teamName,
        holderSub: peakSquad.teamCode,
        displayValue: formatNlNumber(peakSquad.total, 0),
        tone: "accent",
        playerId: null,
        isOwn: peakSquad.teamId === selectedTeamId,
      });
    }
  }

  return { seasonLabel, entries };
}

export function buildOwnTeamLeaderboardFootprint(input: {
  categories: LeagueLeaderCategory[];
  selectedTeamId: string | null;
}): OwnTeamLeaderboardFootprint {
  const { categories, selectedTeamId } = input;
  const trackedCategories = categories.filter((category) => category.entries.length > 0).length;

  if (selectedTeamId == null) {
    return {
      hasTeam: false,
      trackedCategories,
      top5SlotCount: 0,
      categoriesWithTop5: 0,
      leaderCount: 0,
      bestPlacement: null,
    };
  }

  let top5SlotCount = 0;
  let categoriesWithTop5 = 0;
  let leaderCount = 0;
  let bestPlacement: OwnTeamLeaderboardFootprint["bestPlacement"] = null;

  for (const category of categories) {
    const ownEntries = category.entries.filter(
      (entry) => entry.teamId != null && entry.teamId === selectedTeamId,
    );
    if (ownEntries.length === 0) {
      continue;
    }
    top5SlotCount += ownEntries.length;
    categoriesWithTop5 += 1;

    const bestInCategory = ownEntries.reduce((best, entry) => (entry.rank < best.rank ? entry : best));
    if (bestInCategory.rank === 1) {
      leaderCount += 1;
    }
    if (bestPlacement == null || bestInCategory.rank < bestPlacement.rank) {
      bestPlacement = {
        rank: bestInCategory.rank,
        categoryId: category.id,
        categoryLabel: category.label,
        playerName: bestInCategory.name,
        playerId: bestInCategory.playerId,
        displayValue: bestInCategory.displayValue,
      };
    }
  }

  return {
    hasTeam: true,
    trackedCategories,
    top5SlotCount,
    categoriesWithTop5,
    leaderCount,
    bestPlacement,
  };
}
