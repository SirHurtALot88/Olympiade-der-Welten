import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import { listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import { buildPlayerFromBrief, syncImportedCharacterPersistence } from "@/lib/player-import/character-import-service";
import { getDatabase } from "@/lib/persistence/sqlite";

const vipWalBrief = {
  name: "VIP Wal",
  id: "player-2984-vip-wal",
  className: "Bard",
  race: "Fish",
  alignment: "C-G",
  gender: "m",
  subclasses: ["Aquatic", "Trickster", "Lord", "Pirate"],
  traitsPositive: ["Cool", "Flexible", "Eloquent"],
  traitsNegative: ["Gambler", "Egomaniac", "Scandalous"],
  attributes: {
    power: 72,
    health: 78,
    stamina: 74,
    intelligence: 74,
    awareness: 58,
    determination: 58,
    speed: 44,
    dexterity: 38,
    charisma: 91,
    will: 94,
    spirit: 62,
    torment: 55,
  },
  flavorDe: "Casino-Wal aus den Tiefen von Lunira.",
  portraitPath:
    "/Users/chrisfalk/Library/CloudStorage/Dropbox/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/VIP Wal.jpg",
  cost: 68,
  upkeepBase: 5,
} as const;

describe("sync catalog player to transfermarkt", () => {
  it(
    "refreshes VIP Wal in sqlite catalog and exposes him on the transfermarkt",
    () => {
      const result = buildPlayerFromBrief(vipWalBrief);
      syncImportedCharacterPersistence(result);
      const { player, economy } = result;

      const row = getDatabase()
        .prepare("SELECT payload_json FROM player_catalog WHERE player_id = ?")
        .get("player-2984-vip-wal") as { payload_json: string } | undefined;

      expect(row).toBeTruthy();
      const stored = JSON.parse(row!.payload_json) as {
        className: string;
        race: string;
        marketValue: number;
        traitsNegative: string[];
      };

      expect(stored.className).toBe("Bard");
      expect(stored.race).toBe("Fish");
      expect(stored.marketValue).toBe(economy.marketValue);
      expect(stored.traitsNegative).toContain("Gambler");

      const statsPath = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");
      const catalogPlayer = (JSON.parse(readFileSync(statsPath, "utf8")) as Player[]).find(
        (entry) => entry.id === "player-2984-vip-wal",
      );
      expect(catalogPlayer?.marketValue).toBe(economy.marketValue);

      const marketResult = listLocalTransfermarktFreeAgents({ search: "VIP Wal", limit: 250 });
      const item = marketResult.items.find((entry) => entry.playerId === "player-2984-vip-wal");

      expect(item).toMatchObject({
        name: "VIP Wal",
        className: "Bard",
        race: "Fish",
        marketValue: economy.marketValue,
      });
      expect((item?.hiddenNegativeTraitCount ?? 0) + (item?.traitsNegative?.length ?? 0)).toBeGreaterThan(0);
    },
    20_000,
  );
});
