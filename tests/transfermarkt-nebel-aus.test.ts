import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import { baueSpielerSicht, sortiereNachSicht } from "@/lib/market/transfermarkt-sicht";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

function eintrag(over: Record<string, unknown> & { playerId: string; name: string }): TransfermarktFreeAgentItem {
  const tier = "B";
  return {
    scoutingLevel: 0,
    topDisciplineScores: [],
    disciplineEstimates: {},
    powTier: tier,
    speTier: tier,
    menTier: tier,
    socTier: tier,
    powerRating: tier,
    healthRating: tier,
    staminaRating: tier,
    speedRating: tier,
    dexterityRating: tier,
    intelligenceRating: tier,
    awarenessRating: tier,
    determinationRating: tier,
    charismaRating: tier,
    willRating: tier,
    spiritRating: tier,
    tormentRating: tier,
    ...over,
  } as unknown as TransfermarktFreeAgentItem;
}

const hockeyKey = (z: { sicht: ReturnType<typeof baueSpielerSicht> }) => z.sicht.disziplinen.hockey?.schaetzung ?? null;

describe("Fog of War abschaltbar (Einstellung scenarioMeta.scoutingNebelAus)", () => {
  const zora = eintrag({ playerId: "z", name: "Zora", disciplineEstimates: { hockey: 99 }, powTier: "S" });
  const anton = eintrag({ playerId: "a", name: "Anton", disciplineEstimates: { hockey: 90 }, powTier: "C" });

  it("Standard AN: 99 und 90 sind ungescoutet nicht zu unterscheiden, Reihenfolge alphabetisch", () => {
    const zeilen = [zora, anton].map((item) => ({ item, sicht: baueSpielerSicht(item) }));
    expect(zeilen[0].sicht.disziplinen.hockey.text).toBe("90–99");
    expect(sortiereNachSicht(zeilen, hockeyKey).map((z) => z.item.name)).toEqual(["Anton", "Zora"]);
  });

  it("AUS: exakte Werte, Sortierung nach ihnen, Achsen als Note, Attribute aufgedeckt", () => {
    const zeilen = [anton, zora].map((item) => ({ item, sicht: baueSpielerSicht(item, { nebelAus: true }) }));
    expect(zeilen[1].sicht.disziplinen.hockey).toMatchObject({ text: "99", exakt: true });
    expect(sortiereNachSicht(zeilen, hockeyKey).map((z) => z.item.name)).toEqual(["Zora", "Anton"]);
    expect(zeilen[1].sicht.achsen.pow.anzeige).toBe("S");
    expect(Object.values(zeilen[0].sicht.attribute).every((a) => a.aufgedeckt)).toBe(true);
  });

  it("die Einstellung wird gelesen: fehlt sie, ist der Nebel an", () => {
    expect(isScoutingNebelAus({ scenarioMeta: undefined })).toBe(false);
    expect(isScoutingNebelAus({ scenarioMeta: { scoutingNebelAus: false } as never })).toBe(false);
    expect(isScoutingNebelAus({ scenarioMeta: { scoutingNebelAus: true } as never })).toBe(true);
    expect(isScoutingNebelAus(null)).toBe(false);
  });

  it("der Lesedienst rechnet bei ausgeschaltetem Nebel mit Stufe 5, der Host reicht die Einstellung durch", () => {
    const dienst = readFileSync(join(process.cwd(), "lib/market/transfermarkt-local-service.ts"), "utf8");
    expect(dienst).toContain("isScoutingNebelAus(gameState) ? 5 : getEffectiveScoutingLevel(");
    const host = readFileSync(join(process.cwd(), "app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost.tsx"), "utf8");
    expect(host).toContain("nebelAus: isScoutingNebelAus(gameState)");
  });
});
