import { describe, expect, it } from "vitest";
import type { SortimentMarket, SortimentRow } from "./viewModel";
import { boardGap, boardVk, cleanTitle, sortBoard } from "./board";

function market(over: Partial<SortimentMarket> = {}): SortimentMarket {
  return {
    value: 2, range: null, targetMin: 7.12, targetOpt: 8.68, margin: 0.29, status: "im_korridor", rated: true,
    quality: "eindeutig", how: "seltenheit", ekAboveMarket: false, fetchedAt: "2026-10-12T00:00:00.000Z", ...over,
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
