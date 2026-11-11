import { describe, expect, it } from "vitest";
import type { SortimentMarket, SortimentRow } from "./viewModel";
import { boardGap, boardVk, cleanTitle, sortBoard, cardmarketCode, cardmarketLink, ebayLinks, formatQty } from "./board";

function market(over: Partial<SortimentMarket> = {}): SortimentMarket {
  return {
    value: 2, range: null, targetMin: 7.12, targetOpt: 8.68, capped: false, marginReachable: true, margin: 0.29, status: "im_korridor", rated: true,
    quality: "eindeutig", how: "seltenheit", ekAboveMarket: false, lastEk: null, marginLastEk: null, provenByDemand: false, soldAt: null, fetchedAt: "2026-10-12T00:00:00.000Z", ...over,
  };
}
function row(name: string, vk: number | null, m: SortimentMarket | null): SortimentRow {
  return { nameRaw: name, listingVk: vk, avgVkRealized: 0, market: m } as unknown as SortimentRow;
}

describe("boardGap", () => {
  it("unter dem Minimum negativ (Ziel = Minimum), ueber dem Optimum positiv (Ziel = Optimum), dazwischen 0", () => {
    expect(boardGap(row("a", 4.99, market()))).toMatchObject({ euro: expect.closeTo(-2.13, 2), target: 7.12 });
    expect(boardGap(row("b", 11, market()))).toMatchObject({ euro: expect.closeTo(2.32, 2), target: 8.68 });
    expect(boardGap(row("c", 8, market()))).toEqual({ euro: 0, percent: 0, target: null });
  });
  it("ohne Zielspanne oder VK keine Abweichung", () => {
    expect(boardGap(row("a", 5, null))).toBeNull();
    expect(boardGap(row("b", 5, market({ targetMin: null, targetOpt: null })))).toBeNull();
    expect(boardGap(row("c", null, market()))).toBeNull();
  });
  it("Fallback auf den realisierten Ø-VK, wenn kein Listen-VK da ist", () => {
    expect(boardVk({ listingVk: null, avgVkRealized: 6.5 } as unknown as SortimentRow)).toBe(6.5);
  });
});

describe("sortBoard", () => {
  const cheapSmall = row("Billig klein", 4.99, market({ status: "zu_guenstig" }));
  const cheapBig = row("Billig gross", 60, market({ targetMin: 116, targetOpt: 141, status: "zu_guenstig" }));
  const dear = row("Teuer", 17.49, market({ status: "zu_teuer" }));
  const ok = row("Passt", 8, market());
  const open = row("Ohne Urteil", 9.99, market({ rated: false }));
  const none = row("Kein Marktwert", 9.99, null);

  it("Groesste Abweichung: erst Abweichler nach |€|, dann im Rahmen, zuletzt ohne Urteil", () => {
    const names = sortBoard([none, ok, cheapSmall, open, dear, cheapBig], "abweichung").map((r) => r.nameRaw);
    expect(names).toEqual(["Billig gross", "Teuer", "Billig klein", "Passt", "Kein Marktwert", "Ohne Urteil"]);
  });
  it("Marktwert und VK absteigend, Marge aufsteigend (schlechteste zuerst), Name alphabetisch", () => {
    expect(sortBoard([ok, cheapBig], "vk").map((r) => r.nameRaw)).toEqual(["Billig gross", "Passt"]);
    expect(sortBoard([row("a", 5, market({ margin: 0.3 })), row("b", 5, market({ margin: -0.1 }))], "marge").map((r) => r.nameRaw)).toEqual(["b", "a"]);
    expect(sortBoard([ok, cheapBig, dear], "name").map((r) => r.nameRaw)).toEqual(["Billig gross", "Passt", "Teuer"]);
  });
  it("veraendert die Eingabe nicht", () => {
    const input = [ok, cheapBig];
    sortBoard(input, "name");
    expect(input.map((r) => r.nameRaw)).toEqual(["Passt", "Billig gross"]);
  });
});

describe("cleanTitle", () => {
  it.each([
    ["Yu-Gi-Oh! RA04-DE094 Mitsurugi Magatama Super Rare NM 1st", { name: "Mitsurugi Magatama", pack: 1, edition: "1st" }],
    ["3x Yu-Gi-Oh! RA03-DE052 Wiedergeburt Ultra Rare NM 1st", { name: "Wiedergeburt", pack: 3, edition: "1st" }],
    ["Yu-Gi-Oh! RA04-DE278 Aleister der Beschwörer 25th QCSR NM 1st", { name: "Aleister der Beschwörer", pack: 1, edition: "1st" }],
    ["Yu-Gi-Oh! RA03-DE115 Magischer Zylinder Platinum SecR NM 1st", { name: "Magischer Zylinder", pack: 1, edition: "1st" }],
    ["Yu-Gi-Oh! RA03-DE050 Prometheische Prinzessin Verteilerin der Flammen Ultimate Rare NM 1st Ed", { name: "Prometheische Prinzessin Verteilerin der Flammen", pack: 1, edition: "1st" }],
    ["Yu-Gi-Oh! SDMM-EN030 Solidarity Common NM 1st", { name: "Solidarity", pack: 1, edition: "1st" }],
    ["Yu-Gi-Oh! STOR-DE083 Karakuri-Muso Nr. 818 „Haipa“ 1st NM", { name: "Karakuri-Muso Nr. 818 „Haipa“", pack: 1, edition: "1st" }],
  ])("%s", (title, expected) => {
    expect(cleanTitle(title)).toEqual(expected);
  });
  it("laesst Kartennamen mit Seltenheits-Woertern in der Mitte unberuehrt", () => {
    expect(cleanTitle("Yu-Gi-Oh! XXXX-DE001 Super Polymerisation Super Rare NM 1st").name).toBe("Super Polymerisation");
  });
});

describe("cardmarketCode", () => {
  it("entfernt das Sprachkuerzel", () => {
    expect(cardmarketCode("MAMA-DE047")).toBe("MAMA-047");
    expect(cardmarketCode("ra04-en094")).toBe("RA04-094");
    expect(cardmarketCode("CORI-DE022")).toBe("CORI-022");
  });
  it("laesst Unbekanntes stehen", () => {
    expect(cardmarketCode("MAMA-047")).toBe("MAMA-047");
    expect(cardmarketCode(" XYZ ")).toBe("XYZ");
  });
});

describe("ebayLinks", () => {
  it("verlinkt direkt zum Angebot, wenn die Artikelnummer bekannt ist", () => {
    const l = ebayLinks({ ebayItemId: "227444381442", setCode: "OP27-DE010", nameRaw: "x" });
    expect(l.view).toBe("https://www.ebay.de/itm/227444381442");
    expect(l.revise).toBe("https://www.ebay.de/lstng?mode=ReviseItem&itemId=227444381442");
  });
  it("faellt auf die Shop-Suche mit dem Code aus dem Titel zurueck (MIT DE)", () => {
    const l = ebayLinks({ ebayItemId: null, setCode: "MAMA-DE047", nameRaw: "x" });
    expect(l.view).toBeNull();
    expect(l.revise).toBeNull();
    expect(l.search).toBe("https://www.ebay.de/str/lordenterichcards?_nkw=MAMA-DE047");
  });
  it("ignoriert unplausible Nummern und nutzt ohne Set-Code den Namen", () => {
    const l = ebayLinks({ ebayItemId: "abc", setCode: null, nameRaw: "Karte & Co" });
    expect(l.view).toBeNull();
    expect(l.search).toBe("https://www.ebay.de/str/lordenterichcards?_nkw=Karte%20%26%20Co");
  });
});

describe("Links fuer Sonderfaelle (echte Titel)", () => {
  const e = (nameRaw: string, setCode: string | null = null) => new URL(ebayLinks({ ebayItemId: null, setCode, nameRaw }).search).searchParams.get("_nkw");
  const c = (nameRaw: string, setCode: string | null = null) => new URL(cardmarketLink({ setCode, nameRaw, codeName: null })!);
  it("eBay: Sonder-Codes ohne erkannten Set-Code kommen aus dem Titel", () => {
    expect(e("Yu-Gi-Oh! SHVI-DESE3 Robe des Magiers Super Rare NM 1st Ed")).toBe("SHVI-DESE3");
    expect(e("Yu-Gi-Oh! MRD-G090 Schatten Leichenfledderer Rare NM")).toBe("MRD-G090");
  });
  it("eBay: Pokemon sucht mit Nummer und Kartenname", () => {
    expect(e("Pokemon 078/162 Flutter Mane Holo Promo Trick or Trade NM EN")).toBe("078/162 Flutter Mane");
    expect(e("Pokemon 011/159 Hutsassa ex Holo Rare Reisegefährten NM DE")).toBe("011/159 Hutsassa ex");
  });
  it("Cardmarket: Pokemon geht in die Pokemon-Sektion, nicht zu Yu-Gi-Oh", () => {
    const u = c("Pokemon 080/162 Eisenkrieger Holo Gewalten der Zeit NM DE");
    expect(u.pathname).toBe("/de/Pokemon/Products/Search");
    expect(u.searchParams.get("searchString")).toBe("Eisenkrieger");
    expect(u.searchParams.get("language")).toBe("3");
  });
  it("Cardmarket: englische Karten mit Sprachfilter Englisch", () => {
    expect(c("Yu-Gi-Oh! LC01-EN004 Blue Eyes White Dragon Ultra Rare, NM, EN Limited", "LC01-EN004").searchParams.get("language")).toBe("1");
    expect(c("Pokemon 078/162 Flutter Mane Holo Promo Trick or Trade NM EN").searchParams.get("language")).toBe("1");
    expect(c("Yu-Gi-Oh! RA03-DE169 Überlastfusion Platinum SecR NM 1st", "RA03-DE169").searchParams.get("language")).toBe("3");
  });
  it("Cardmarket: Sammlungen und Titel mit mehreren Codes bekommen keinen Link", () => {
    expect(cardmarketLink({ setCode: null, nameRaw: "250 YuGiOh! Karten Sammlung Deutsch 30 Holos", codeName: null })).toBeNull();
    expect(cardmarketLink({ setCode: "RA01-DE001", nameRaw: "Yu-Gi-Oh! RA01-DE001 und RA01-DE002 Set", codeName: null })).toBeNull();
  });
  it("Sonder-Codes mit 25TH behalten das Set-Praefix", () => {
    expect(e("Yu-Gi-Oh! MRD-25TH-000 Torwächter Secret Rare NM")).toBe("MRD-25TH-000");
  });
  it("Cardmarket: Sonder-Code aus dem Titel, wenn kein Set-Code erkannt wurde", () => {
    expect(c("Yu-Gi-Oh! SHVI-DESE3 Robe des Magiers Super Rare NM 1st Ed").searchParams.get("searchString")).toBe("SHVI-DESE3");
  });
});

describe("cardmarketLink", () => {
  const cm = (o: object) => cardmarketLink({ setCode: null, nameRaw: "x", codeName: null, ...o } as Parameters<typeof cardmarketLink>[0]);
  it("sucht mit dem Cardmarket-Code ohne DE/EN, deutsch und ab NM", () => {
    const url = new URL(cm({ setCode: "CT09-DE023" })!);
    expect(url.origin + url.pathname).toBe("https://www.cardmarket.com/de/YuGiOh/Products/Search");
    expect(url.searchParams.get("searchString")).toBe("CT09-023");
    expect(url.searchParams.get("language")).toBe("3");
    expect(url.searchParams.get("minCondition")).toBe("2");
  });
  it("nimmt bei Name/Code-Konflikt den Code, der zum Namen passt", () => {
    const url = new URL(cm({ setCode: "AAAA-DE001", codeName: { usedCode: "BBBB-DE002" } })!);
    expect(url.searchParams.get("searchString")).toBe("BBBB-002");
  });
  it("faellt ohne Set-Code auf den Kartennamen zurueck", () => {
    const url = new URL(cm({ nameRaw: "3x Yu-Gi-Oh! Mystischer Raum-Taifun Ultra Rare NM" })!);
    expect(url.searchParams.get("searchString")).toContain("Taifun");
  });
});

describe("Verkaeufe, Bestand, Mengen", () => {
  const r = (name: string, qty365: number, stock: number) =>
    ({ nameRaw: name, stock, windows: { "365": { qty: qty365 } }, listingVk: 1, avgVkRealized: 0, market: null }) as unknown as SortimentRow;
  it("sortiert nach Verkaeufen (365 T) und nach Bestand absteigend, bei Gleichstand nach Name", () => {
    const rows = [r("B", 5, 1), r("A", 51, 0), r("C", 5, 9)];
    expect(sortBoard(rows, "verkaeufe").map((x) => x.nameRaw)).toEqual(["A", "B", "C"]);
    expect(sortBoard(rows, "bestand").map((x) => x.nameRaw)).toEqual(["C", "B", "A"]);
  });
  it("formatQty zeigt ganze Mengen ohne, krumme mit zwei Nachkommastellen", () => {
    expect(formatQty(51)).toBe("51");
    expect(formatQty(2762.67)).toBe("2762,67");
  });
});
