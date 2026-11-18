import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DISCIPLINE_SCENES } from "@/lib/foundation/discipline-scenes";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";

const OEFFENTLICH = path.join(process.cwd(), "public");

describe("Einsatzliste: Kopf-Kulisse je Disziplin", () => {
  const ids = Object.keys(DISCIPLINE_SCENES);

  it("kennt alle zwanzig Disziplinen", () => {
    expect(ids).toHaveLength(20);
  });

  it.each(ids.filter((id) => id !== "takeshis-castle"))("%s liefert ein vorhandenes Bild", (id) => {
    const bild = einsatzlisteKulisseBild(id);
    expect(bild).toMatch(/^\/sprites\/kulissen\//);
    expect(existsSync(path.join(OEFFENTLICH, bild as string))).toBe(true);
  });

  it("Takeshi's Castle hat keine Kulisse (Farbverlauf bleibt)", () => {
    expect(einsatzlisteKulisseBild("takeshis-castle")).toBeNull();
  });

  it("nimmt die gewaehlte Variante, sonst die erste", () => {
    expect(einsatzlisteKulisseBild("hockey", "bergsee")).toBe("/sprites/kulissen/hockey/bergsee.jpg");
    expect(einsatzlisteKulisseBild("hockey", "gibt-es-nicht")).toBe("/sprites/kulissen/hockey/eis.jpg");
    expect(einsatzlisteKulisseBild(null)).toBeNull();
    expect(einsatzlisteKulisseBild("unbekannt")).toBeNull();
  });
});
