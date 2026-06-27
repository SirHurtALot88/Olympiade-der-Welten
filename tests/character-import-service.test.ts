import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import { listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import {
  buildPlayerFromBrief,
  syncImportedCharacterPersistence,
  validateCharacterBrief,
} from "@/lib/player-import/character-import-service";
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

describe("character-import-service", () => {
  it("validates VIP Wal brief cleanly", () => {
    expect(validateCharacterBrief(vipWalBrief)).toEqual([]);
  });

  it("builds VIP Wal with 20 discipline ratings and official economy", () => {
    const result = buildPlayerFromBrief(vipWalBrief);

    expect(result.validationIssues).toEqual([]);
    expect(result.player.className).toBe("Bard");
    expect(result.player.race).toBe("Fish");
    expect(Object.keys(result.player.disciplineRatings)).toHaveLength(foundationSeedDisciplines.length);
    expect(result.player.coreStats).toMatchObject({
      pow: 74.7,
      spe: 46.7,
      men: 71,
      soc: 69.3,
    });
    expect(result.economy.marketValue).toBeGreaterThan(50);
    expect(result.economy.salaryDemand).toBeGreaterThan(10);
    expect(result.player.attributeSheetRatings?.charismaRating).toBe("S+");
  });

  it(
    "imports VIP Wal into catalog and transfermarkt",
    () => {
      const result = buildPlayerFromBrief(vipWalBrief);
      syncImportedCharacterPersistence(result);

      const statsPath = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");
      const reloaded = (JSON.parse(readFileSync(statsPath, "utf8")) as Player[]).find(
        (player) => player.id === "player-2984-vip-wal",
      );
      expect(reloaded?.marketValue).toBe(result.economy.marketValue);
      expect(reloaded?.salaryDemand).toBe(result.economy.salaryDemand);
      expect(reloaded?.coreStats).toMatchObject({
        pow: 74.7,
        spe: 46.7,
        men: 71,
        soc: 69.3,
      });
      expect(Object.keys(reloaded?.disciplineRatings ?? {})).toHaveLength(foundationSeedDisciplines.length);

      const baselineRow = getDatabase()
        .prepare("SELECT payload_json FROM player_baseline_catalog WHERE player_id = ?")
        .get("player-2984-vip-wal") as { payload_json: string } | undefined;
      expect(baselineRow).toBeTruthy();
      const baseline = JSON.parse(baselineRow!.payload_json) as { className: string; race: string; marketValue: number };
      expect(baseline.className).toBe("Bard");
      expect(baseline.race).toBe("Fish");
      expect(baseline.marketValue).toBe(result.economy.marketValue);

      const item = listLocalTransfermarktFreeAgents({ search: "VIP Wal", limit: 250 }).items[0];
      expect(item).toMatchObject({
        playerId: "player-2984-vip-wal",
        name: "VIP Wal",
        className: "Bard",
        race: "Fish",
        marketValue: result.economy.marketValue,
      });
    },
    20_000,
  );
});
