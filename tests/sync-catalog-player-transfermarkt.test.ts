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

      // listLocalTransfermarktFreeAgents() resolves marketValue via
      // resolvePlayerEconomyContract(), which re-derives the value by reversing
      // the stored final market value back to a base value
      // (deriveBaseMarketValueFromFinal) and reapplying bonuses
      // (calculateMarketValueBonuses) — see
      // lib/foundation/player-economy-contract.ts. That round-trip through an
      // intermediate "base" value is not guaranteed to be byte-identical to
      // calculateImportedPlayerEconomy()'s original value at the cent level
      // (0.01 rounding drift), so compare marketValue with a tolerance instead
      // of exact equality.
      expect(item).toMatchObject({
        name: "VIP Wal",
        className: "Bard",
        race: "Fish",
      });
      expect(item?.marketValue).toBeCloseTo(economy.marketValue, 1);
      // KNOWN REGRESSION (left red intentionally, do not weaken): the default
      // (compact-list) path resolves to buildCompactFreeAgentItem() with a
      // browseEntry built by buildFreeAgentBrowseIndex(), which computes its
      // traitsPositive/traitsNegative via getScoutedTraitView({ ...,
      // scoutingLevel: 0 }) — i.e. fully filtered/hidden. buildCompactFreeAgentItem
      // then reuses that already-empty browseEntry.traitsNegative as-is AND
      // reports a hardcoded `hiddenNegativeTraitCount: 0` / level-5 disclosure on
      // top of it (lib/market/transfermarkt-local-service.ts ~lines 1328-1339,
      // comment: "Browse mode shows every trait, so report full (level-5)
      // scouting disclosure"). The comment's intent (full trait visibility in
      // browse mode) contradicts the scoutingLevel:0 data it is actually built
      // from, so both the trait list AND the hidden-count end up empty — a
      // player's negative traits silently disappear from the free-agent list
      // with no "N hidden" signal either. Reproduced directly via this test;
      // not something a test fixture can route around since even
      // `mode: "full"` uses the same scoutingLevel:0 call.
      expect((item?.hiddenNegativeTraitCount ?? 0) + (item?.traitsNegative?.length ?? 0)).toBeGreaterThan(0);
    },
    20_000,
  );
});
