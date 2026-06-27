import rawPlayerStats from "@/data/generated/oly-player-stats.json";
import type { Player } from "@/lib/data/olyDataTypes";

type FlavorCatalogEntry = Pick<Player, "id" | "flavorDe">;

let flavorDeByPlayerId: Map<string, string> | null = null;

function getFlavorCatalog() {
  if (!flavorDeByPlayerId) {
    flavorDeByPlayerId = new Map(
      (rawPlayerStats as FlavorCatalogEntry[])
        .filter((entry) => entry.flavorDe?.trim())
        .map((entry) => [entry.id, entry.flavorDe.trim()] as const),
    );
  }
  return flavorDeByPlayerId;
}

export function resolvePlayerFlavorDe(player: Pick<Player, "id" | "flavorDe">): string | null {
  const fromPlayer = player.flavorDe?.trim();
  if (fromPlayer) {
    return fromPlayer;
  }
  return getFlavorCatalog().get(player.id) ?? null;
}
