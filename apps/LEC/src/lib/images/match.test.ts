import { describe, expect, it } from "vitest";
import { matchListingsToArticles } from "./match";

const art = (id: string, nameNormalized: string, packQty = 1) => ({ id, nameNormalized, packQty });
const lst = (itemId: string, title: string) => ({ itemId, title, imageGuid: `g${itemId}`, price: null });

describe("matchListingsToArticles", () => {
  it("ordnet ueber den normalisierten Namen zu (1:1 wie Billbee)", () => {
    const r = matchListingsToArticles(
      [lst("1", "Yu-Gi-Oh!  RA02-DE048 Mystischer Raum-Taifun Ultra Rare")],
      [art("a", "yu-gi-oh! ra02-de048 mystischer raum-taifun ultra rare")],
      new Map()
    );
    expect(r.assignments).toEqual([{ articleId: "a", listing: lst("1", "Yu-Gi-Oh!  RA02-DE048 Mystischer Raum-Taifun Ultra Rare"), matchedBy: "name" }]);
    expect(r.unmatched).toEqual([]);
  });

  it("die eBay-Artikelnummer schlaegt den Namen", () => {
    const r = matchListingsToArticles(
      [lst("99", "Ganz anderer Titel")],
      [art("a", "irgendwas")],
      new Map([["99", "a"]])
    );
    expect(r.assignments[0]).toMatchObject({ articleId: "a", matchedBy: "item_id" });
  });

  it("nutzt gelernte Aliasse", () => {
    const r = matchListingsToArticles([lst("1", "Alter Titel")], [art("a", "neuer titel")], new Map(), new Map([["alter titel", "neuer titel"]]));
    expect(r.assignments[0]).toMatchObject({ articleId: "a", matchedBy: "alias" });
  });

  it("bei Einzelkarte und 3er-Pack gewinnt die passende Pack-Menge", () => {
    const listings = [lst("1", "Wiedergeburt UR"), lst("3", "3x Wiedergeburt UR")];
    const pack = matchListingsToArticles(listings, [art("a", "wiedergeburt ur", 3)], new Map());
    expect(pack.assignments).toHaveLength(1);
    expect(pack.assignments[0].listing.itemId).toBe("3");
    const single = matchListingsToArticles(listings, [art("a", "wiedergeburt ur", 1)], new Map());
    expect(single.assignments[0].listing.itemId).toBe("1");
  });

  it("meldet Angebote ohne Artikel als ungematcht", () => {
    const r = matchListingsToArticles([lst("1", "Unbekannt")], [art("a", "x")], new Map());
    expect(r.assignments).toEqual([]);
    expect(r.unmatched.map((l) => l.itemId)).toEqual(["1"]);
  });
});
