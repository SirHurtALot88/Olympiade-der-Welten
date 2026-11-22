import { describe, expect, it } from "vitest";
import data from "./cardmarketDirekt.json";
import { cardmarketDirektPfad, cardmarketNameSlug, cardmarketRaritySlug } from "./cardmarketDirekt";
import { cardmarketDirektLink } from "../dashboard/board";

describe("cardmarketNameSlug", () => {
  it("Apostroph und & entfallen, Leerzeichen werden Bindestriche (Chris' Beispiele)", () => {
    expect(cardmarketNameSlug("Ghost Ogre & Snow Rabbit")).toBe("Ghost-Ogre-Snow-Rabbit");
    expect(cardmarketNameSlug("Barian's Seventh Untopia")).toBe("Barians-Seventh-Untopia");
    expect(cardmarketNameSlug("Blue-Eyes White Dragon")).toBe("Blue-Eyes-White-Dragon");
  });
  it("andere Sonderzeichen: kein Direktlink", () => {
    expect(cardmarketNameSlug("Number 39: Utopia")).toBeNull();
    expect(cardmarketNameSlug("Evil★Twin")).toBeNull();
  });
});

describe("cardmarketRaritySlug", () => {
  it("setzt Woerter gross und verbindet sie", () => {
    expect(cardmarketRaritySlug("ultra rare")).toBe("Ultra-Rare");
    expect(cardmarketRaritySlug("prismatic collectors rare")).toBe("Prismatic-Collectors-Rare");
  });
});

describe("cardmarketDirektPfad", () => {
  it("reproduziert Chris' beiden Adressen (RA02, Ghost Ogre & Snow Rabbit)", () => {
    expect(cardmarketDirektPfad("RA02-DE009", "Super Rare")).toBe("25th-Anniversary-Rarity-Collection-II/Ghost-Ogre-Snow-Rabbit-V1-Super-Rare");
    expect(cardmarketDirektPfad("RA02-DE009", "Ultra Rare")).toBe("25th-Anniversary-Rarity-Collection-II/Ghost-Ogre-Snow-Rabbit-V2-Ultra-Rare");
  });
  it("Ultimate Rare im Titel fuehrt auf die prismatische Version", () => {
    expect(cardmarketDirektPfad("RA02-DE009", "Ultimate Rare")).toMatch(/-V7-Prismatic-Ultimate-Rare$/);
  });
  it("andere Sets, fehlende Seltenheit oder Nummer: null", () => {
    expect(cardmarketDirektPfad("MAMA-DE047", "Ultra Rare")).toBeNull();
    expect(cardmarketDirektPfad("RA02-DE009", null)).toBeNull();
    expect(cardmarketDirektPfad("RA02-DE999", "Ultra Rare")).toBeNull();
  });
  it("jede Karte hat je Seltenheit eine eigene, fortlaufend nummerierte Version", () => {
    const links = (data as unknown as { links: Record<string, Record<string, string>> }).links;
    for (const [card, rarities] of Object.entries(links)) {
      const nums = Object.values(rarities).map((p) => Number(p.match(/-V(\d+)-/)![1]));
      expect(new Set(nums).size, card).toBe(nums.length);
    }
  });
});

describe("cardmarketDirektLink", () => {
  it("haengt Sprache, Land, Zustand und Menge an", () => {
    const row = { setCode: "RA02-DE009", nameRaw: "Yu-Gi-Oh! RA02-DE009 Geist-Oger & Schneehase Ultra Rare NM", codeName: null } as never;
    expect(cardmarketDirektLink(row, "25th-Anniversary-Rarity-Collection-II/Ghost-Ogre-Snow-Rabbit-V2-Ultra-Rare", 1)).toBe(
      "https://www.cardmarket.com/de/YuGiOh/Products/Singles/25th-Anniversary-Rarity-Collection-II/Ghost-Ogre-Snow-Rabbit-V2-Ultra-Rare?sellerCountry=7&language=3&minCondition=2&amount=1"
    );
  });
});
