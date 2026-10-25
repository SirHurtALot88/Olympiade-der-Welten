import { describe, expect, it } from "vitest";
import { ebayImageUrl, parseStorePage, parseTotalListings, storePageUrl } from "./ebayStore";

// Nachgebaut nach dem echten Aufbau der eBay-Shopseite (Stand 13.10.2026):
// Merkliste-Button mit eigenem aria-label VOR dem Angebotslink.
function tile(itemId: string, title: string, guid: string): string {
  return `<article data-testid=ig-${itemId} class="str-item-card StoreFrontItemCard">
<button aria-label="beobachten ${title}" class=str-item-card__watch--icon></button>
<a href=https://www.ebay.de/itm/${itemId}?itmmeta=X&hash=item:g:${guid} aria-label="${title}" class=str-item-card__link>
<img data-testid=str-img _type=Image imageId=${guid} imageIdType=ZOOM_GUID src=https://i.ebayimg.com/images/g/${guid}/s-l300.jpg alt>
<span class=str-item-card__property-displayPrice>EUR 4,19</span><span>EUR 5,99</span>
</a></article>`;
}

describe("parseStorePage", () => {
  it("liest Artikelnummer, Titel und Bild-GUID je Kachel", () => {
    const html =
      "<html>" +
      tile("226616295629", "Yu-Gi-Oh! SDP-G001 Aufgegeben Ultra Rare NM 1st Ed", "i3gAAOSwbMtieQla") +
      tile("226617703309", "3x Yu-Gi-Oh! RA03-DE052 Wiedergeburt Ultra Rare NM 1st", "zGAAAOSwwhRntvqj") +
      "</html>";
    expect(parseStorePage(html)).toEqual([
      { itemId: "226616295629", title: "Yu-Gi-Oh! SDP-G001 Aufgegeben Ultra Rare NM 1st Ed", imageGuid: "i3gAAOSwbMtieQla", price: 4.19 },
      { itemId: "226617703309", title: "3x Yu-Gi-Oh! RA03-DE052 Wiedergeburt Ultra Rare NM 1st", imageGuid: "zGAAAOSwwhRntvqj", price: 4.19 },
    ]);
  });

  it("nimmt den Titel vom Angebotslink, nicht vom Merken-Button", () => {
    const [l] = parseStorePage(tile("226616295759", "Nummer IC1000", "-MwAAOSwM71mRg7-"));
    expect(l.title).toBe("Nummer IC1000");
    expect(l.imageGuid).toBe("-MwAAOSwM71mRg7-");
  });

  it("dekodiert HTML-Entities und ueberspringt Doppelte", () => {
    const html = tile("1234567", "Kewl-Empfang &amp; Knistern &quot;1st&quot;", "UEYAAeSw5spqETqF") + tile("1234567", "x", "UEYAAeSw5spqETqF");
    const out = parseStorePage(html);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Kewl-Empfang & Knistern "1st"');
  });

  it("ignoriert Kacheln ohne Bild", () => {
    expect(parseStorePage(`<article data-testid=ig-1234567><a href=/itm/1234567 aria-label="X"></a></article>`)).toEqual([]);
  });
});

describe("URLs", () => {
  it("baut Seiten- und Bild-URLs", () => {
    expect(storePageUrl(1)).toBe("https://www.ebay.de/str/lordenterichcards?_sop=10&_pgn=1");
    expect(storePageUrl(3)).toBe("https://www.ebay.de/str/lordenterichcards?_sop=10&_pgn=3");
    expect(ebayImageUrl("abc12345")).toBe("https://i.ebayimg.com/images/g/abc12345/s-l500.jpg");
  });
});

describe("parseTotalListings", () => {
  it("liest die Gesamtzahl mit Tausenderpunkt", () => {
    expect(parseTotalListings("<span>1.672 Angebote</span>")).toBe(1672);
    expect(parseTotalListings("<span>48 Angebote</span>")).toBe(48);
    expect(parseTotalListings("nichts")).toBeNull();
  });
});
