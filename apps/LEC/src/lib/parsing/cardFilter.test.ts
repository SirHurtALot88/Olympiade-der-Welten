import { describe, expect, it } from "vitest";
import { isCardArticleName } from "./cardFilter";

describe("isCardArticleName", () => {
  it("erkennt Yu-Gi-Oh-Singles ueber den Set-Code", () => {
    expect(isCardArticleName("Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos Ultra Rare NM 1st")).toBe(
      true
    );
  });

  it("erkennt Bundles ohne Set-Code ueber den Yu-Gi-Oh-Marker", () => {
    expect(
      isCardArticleName("250 YuGiOh! Karten Sammlung Deutsch 30 Holos Ultra Secret Ghost Rare")
    ).toBe(true);
    expect(isCardArticleName("100 YuGiOh Karten Sammlung 15 Seltene")).toBe(true);
  });

  it("erkennt Pokemon (mit und ohne Akzent), sonst keine anderen Spiele", () => {
    expect(isCardArticleName("Pokémon Glurak EX 199/165 Deutsch NM")).toBe(true);
    expect(isCardArticleName("Pokemon Booster Display 36er")).toBe(true);
    expect(isCardArticleName("Magic the Gathering Commander Deck")).toBe(false);
    expect(isCardArticleName("Dragon Ball Super Card Game Booster")).toBe(false);
  });

  it("filtert Privatverkaeufe (Schmuck/Elektronik) heraus", () => {
    expect(
      isCardArticleName("Schmuck Konvolut Pandora 925 Silber, CEM Ring 925, Konplott Statement Ring")
    ).toBe(false);
    expect(isCardArticleName("Apple iPhone Ladekabel original 1m")).toBe(false);
    expect(isCardArticleName("2 Euro Muenze Gedenkmuenze Sammlermuenze")).toBe(false);
  });
});
