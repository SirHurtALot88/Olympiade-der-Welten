import { describe, expect, it } from "vitest";

import { RETOOL_DISCIPLINE_AXIS } from "@/lib/ai/golden-master/discipline-recipes";
import { achseDerDisziplin, DISZIPLINEN_GEORDNET } from "@/lib/market/disziplin-reihenfolge";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";

// Matrix-ID -> Retool-Schlüssel (andere Schreibweise)
const RETOOL_ID: Record<string, keyof typeof RETOOL_DISCIPLINE_AXIS> = {
  "mini-dm": "mini_dm",
  "time-trial": "time_trial",
  "speed-schach": "schach",
  "takeshis-castle": "takeshi",
  "i-spy": "i_spy",
  eiskunstlauf: "eiskunst",
};

describe("geordnete Disziplinliste (POW, SPE, MEN, SOC)", () => {
  it("hat 20 eindeutige IDs und deckt die Matrix ab", () => {
    expect(DISZIPLINEN_GEORDNET).toHaveLength(20);
    expect(new Set(DISZIPLINEN_GEORDNET).size).toBe(20);
    expect([...DISZIPLINEN_GEORDNET].sort()).toEqual([...officialDisciplineWeightOrder].sort());
  });

  it("Gruppen stimmen mit RETOOL_DISCIPLINE_AXIS überein, Reihenfolge ist POW, SPE, MEN, SOC", () => {
    for (const id of DISZIPLINEN_GEORDNET) {
      expect(achseDerDisziplin(id)).toBe(RETOOL_DISCIPLINE_AXIS[RETOOL_ID[id] ?? (id as keyof typeof RETOOL_DISCIPLINE_AXIS)]);
    }
    expect(DISZIPLINEN_GEORDNET.map((d) => achseDerDisziplin(d))).toEqual([
      ...Array(5).fill("pow"),
      ...Array(5).fill("spe"),
      ...Array(5).fill("men"),
      ...Array(5).fill("soc"),
    ]);
  });
});
