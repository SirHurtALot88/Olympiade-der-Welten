import { describe, expect, it } from "vitest";

import {
  ATTRIBUTE_SHEET_ALIASES,
  fetchPlayerAttributeSheetRows,
  normalizeAttributeSheetName,
  summarizeMissingAttributeRows,
} from "@/lib/data/playerAttributeSheet";

describe("playerAttributeSheet", () => {
  it("parses the attribute sheet csv headers and values", async () => {
    const response = {
      ok: true,
      status: 200,
      text: async () =>
        [
          "Name,Power,Health,Stamina,Intelligence,Awareness,Determination,Speed,Dexterity,Charisma,Will,Spirit,Torment,Power Rating,Health Rating,Stamina Rating,Intelligence Rating,Awareness Rating,Determination Rating,Speed Rating,Dexterity Rating,Charisma Rating,Will Rating,Spirit Rating,Torment Rating",
          "Tyrael,64,68,71,68,66,98,72,52,97,81,83,46,B,A,A,A,A,S+,A,C,S+,S,S,C",
        ].join("\n"),
    } satisfies Pick<Response, "ok" | "status" | "text">;

    const rows = await fetchPlayerAttributeSheetRows(async () => response as Response);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Tyrael",
      power: 64,
      health: 68,
      torment: 46,
      powerRating: "B",
      determinationRating: "S+",
      tormentRating: "C",
    });
  });

  it("normalizes the known Riley alias", () => {
    expect(ATTRIBUTE_SHEET_ALIASES["Riley Le Rogue"]).toBe("Riley Le Rouge");
    expect(normalizeAttributeSheetName("Riley Le Rogue")).toBe("Riley Le Rouge");
  });

  it("reports players still missing in the attribute sheet", () => {
    const missing = summarizeMissingAttributeRows(
      ["Tyrael", "VIP Wal"],
      [
        {
          name: "Tyrael",
          power: 64,
          health: 68,
          stamina: 71,
          intelligence: 68,
          awareness: 66,
          determination: 98,
          speed: 72,
          dexterity: 52,
          charisma: 97,
          will: 81,
          spirit: 83,
          torment: 46,
          powerRating: "B",
          healthRating: "A",
          staminaRating: "A",
          intelligenceRating: "A",
          awarenessRating: "A",
          determinationRating: "S+",
          speedRating: "A",
          dexterityRating: "C",
          charismaRating: "S+",
          willRating: "S",
          spiritRating: "S",
          tormentRating: "C",
        },
      ],
    );

    expect(missing).toEqual(["VIP Wal"]);
  });
});
