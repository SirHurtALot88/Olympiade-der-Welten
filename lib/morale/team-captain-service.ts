import type { GameState, Player, TeamCaptainRecord } from "@/lib/data/olyDataTypes";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildTeamPlayerDemandMap } from "@/lib/morale/player-demands-service";

const CAPTAIN_POSITIVE_TRAITS = new Set(["eloquent", "motivated", "ambitious", "disciplined", "resourceful", "loyal"]);

function normalizeTrait(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getTraits(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeTrait).filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function getTeamCaptainEffectsTooltip() {
  return "Der Saison-Kapitän puffert Moral, reduziert Rivalitäts-Druck, stärkt Team-Power leicht und kann Konflikte abfedern.";
}

export function buildCaptainRecordForPlayer(gameState: GameState, teamId: string, player: Player): TeamCaptainRecord {
  const ratings = buildPlayerRatingContractMap(gameState);
  const traits = getTraits(player);
  const stats = player.attributeSheetStats;
  const traitBonus = traits.reduce(
    (sum, trait) => sum + (CAPTAIN_POSITIVE_TRAITS.has(trait) ? 4 : trait === "renegade" || trait === "scandalous" ? 1.5 : 0),
    0,
  );
  const leadershipScore = round(
    (stats?.charisma ?? player.coreStats.soc ?? 0) * 0.32 +
      (stats?.will ?? player.coreStats.men ?? 0) * 0.2 +
      (stats?.determination ?? player.coreStats.pow ?? 0) * 0.18 +
      (stats?.awareness ?? player.coreStats.men ?? 0) * 0.16 +
      (ratings.get(player.id)?.mvs ?? player.ovr ?? 0) * 0.08 +
      traitBonus,
    1,
  );
  const style =
    traits.includes("eloquent") || (stats?.charisma ?? 0) >= 70
      ? "inspirer"
      : traits.includes("renegade") || traits.includes("scandalous") || (stats?.torment ?? 0) >= 65
        ? "enforcer"
        : (stats?.awareness ?? 0) >= 70 || (stats?.intelligence ?? 0) >= 70
          ? "operator"
          : traits.includes("gambler")
            ? "wildcard"
            : "leader";

  return {
    seasonId: gameState.season.id,
    teamId,
    playerId: player.id,
    playerName: player.name,
    leadershipScore,
    style,
    effects: {
      moraleBuffer: round(clamp(leadershipScore / 18, 1, 6), 1),
      rivalryPressureReductionPct: round(clamp(leadershipScore / 3.5, 4, 24), 1),
      teamPowerModifierPct: round(clamp(leadershipScore / 9, 1, 8), 1),
      conflictSoftenChancePct: round(clamp(leadershipScore / 2.5, 6, 32), 1),
    },
    traitSignals: traits
      .filter((trait) => CAPTAIN_POSITIVE_TRAITS.has(trait) || ["renegade", "scandalous", "gambler"].includes(trait))
      .slice(0, 4),
    source: "manual_assignment",
  };
}

export type TeamCaptainCandidateProfile = TeamCaptainRecord & {
  hasCaptaincyDemand: boolean;
  demandLabel: string | null;
};

export function buildCaptainCandidateProfiles(gameState: GameState, teamId: string): TeamCaptainCandidateProfile[] {
  const rosterIds = new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  const players = gameState.players.filter((player) => rosterIds.has(player.id));
  const demandMap = buildTeamPlayerDemandMap(gameState, teamId);

  return players
    .map((player) => {
      const record = buildCaptainRecordForPlayer(gameState, teamId, player);
      const captaincyDemand = (demandMap.get(player.id) ?? []).find((demand) => demand.type === "captaincy") ?? null;
      return {
        ...record,
        hasCaptaincyDemand: Boolean(captaincyDemand),
        demandLabel: captaincyDemand?.label ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.leadershipScore - left.leadershipScore ||
        Number(right.hasCaptaincyDemand) - Number(left.hasCaptaincyDemand) ||
        left.playerName.localeCompare(right.playerName, "de"),
    );
}

export function hasPersistedTeamCaptain(gameState: GameState, teamId: string) {
  return (gameState.teamCaptains ?? []).some(
    (entry) => entry.seasonId === gameState.season.id && entry.teamId === teamId,
  );
}

export function setTeamCaptain(gameState: GameState, teamId: string, playerId: string): GameState {
  const player = gameState.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error("Spieler für Kapitänswahl nicht gefunden.");
  }
  const onRoster = gameState.rosters.some((entry) => entry.teamId === teamId && entry.playerId === playerId);
  if (!onRoster) {
    throw new Error("Nur Kader-Spieler können Kapitän werden.");
  }

  const captain = buildCaptainRecordForPlayer(gameState, teamId, player);
  const existing = (gameState.teamCaptains ?? []).filter(
    (entry) => !(entry.seasonId === gameState.season.id && entry.teamId === teamId),
  );
  return {
    ...gameState,
    teamCaptains: [...existing, captain],
  };
}
