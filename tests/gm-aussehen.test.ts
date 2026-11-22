import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import gmAussehenDaten from "@/data/gm-aussehen.json";
import { getGmAussehen, gmPortraetPfad, listGmIdsMitPortraet } from "@/lib/foundation/gm-aussehen";
import { TEAM_GENERAL_MANAGER_PROFILES } from "@/lib/foundation/team-general-managers";

describe("GM-Aussehen", () => {
  it("gibt jedem der 100 GM-Profile ein Aussehen mit passendem Namen", () => {
    expect(Object.keys(gmAussehenDaten.gms).sort()).toEqual(TEAM_GENERAL_MANAGER_PROFILES.map((p) => p.gmId).sort());
    for (const profil of TEAM_GENERAL_MANAGER_PROFILES) {
      const aussehen = getGmAussehen(profil.gmId);
      expect(aussehen?.name).toBe(profil.name);
      expect(aussehen?.archetyp).toBe(profil.archetype);
    }
  });

  it("streut über alle 18 Rassen und hält Menschen bei höchstens 15 %", () => {
    const zaehler = new Map<string, number>();
    for (const a of Object.values(gmAussehenDaten.gms)) zaehler.set(a.rasse, (zaehler.get(a.rasse) ?? 0) + 1);
    expect(zaehler.size).toBe(18);
    expect(zaehler.get("Human") ?? 0).toBeLessThanOrEqual(15);
  });

  it("nennt ein Porträt genau dann, wenn die Datei lokal liegt", () => {
    for (const gmId of Object.keys(gmAussehenDaten.gms)) {
      const liegt = existsSync(join(process.cwd(), "public", "portraits", "gm", `${gmId}.png`));
      expect(gmPortraetPfad(gmId) !== null, gmId).toBe(liegt);
    }
    expect(listGmIdsMitPortraet().length).toBeGreaterThan(0);
  });
});
