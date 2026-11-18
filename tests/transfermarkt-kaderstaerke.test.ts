import { describe, expect, it } from "vitest";

import {
  baueLigaStaerken,
  berechneStaerke,
  bereiteTeamVor,
  hebtInDisziplinen,
  rangGegenLiga,
  stammInDisziplinen,
  wirkungMitKandidat,
  wirkungOhneSpieler,
  type StaerkeSpieler,
} from "@/lib/market/transfermarkt-kaderstaerke";

function kader(teamId: string, werte: number[], disziplin = "hockey"): StaerkeSpieler[] {
  return werte.map((wert, index) => ({ playerId: `${teamId}-${index}`, teamId, ratings: { [disziplin]: wert } }));
}

describe("Kaderstärke und Liga-Rang", () => {
  const spieler = [
    ...kader("A", [80, 80, 80, 80, 80, 80, 40]),
    ...kader("B", [70, 70, 70, 70, 70, 70]),
    ...kader("C", [60, 60, 60, 60, 60, 60]),
  ];
  const staerken = baueLigaStaerken({ spieler, teamIds: ["A", "B", "C"], disziplinIds: ["hockey"] });

  it("Ø der besten sechs, fehlende Plätze zählen mit 20", () => {
    expect(berechneStaerke([90, 80, 70, 60, 50, 40, 10])).toBe(65);
    expect(berechneStaerke([60, 60, 60])).toBe((180 + 60) / 6);
  });

  it("Rang = 1 + Zahl stärkerer Teams der Liga", () => {
    expect(rangGegenLiga(staerken, "A", "hockey", staerken.A.hockey)).toBe(1);
    expect(rangGegenLiga(staerken, "C", "hockey", staerken.C.hockey)).toBe(3);
  });

  it("Zugang hebt den Rang (als Spanne bei unscharfer Eignung)", () => {
    const vorbereitung = bereiteTeamVor({ spieler, staerken, teamId: "C", disziplinIds: ["hockey"] });
    const exakt = wirkungMitKandidat(vorbereitung, "hockey", { von: 100, mitte: 100, bis: 100 });
    expect(exakt.vorher).toBe(3);
    expect(exakt.nachherBest).toBe(exakt.nachherSchlecht);
    const unscharf = wirkungMitKandidat(vorbereitung, "hockey", { von: 20, mitte: 90, bis: 100 });
    expect(unscharf.nachherBest).toBeLessThanOrEqual(unscharf.nachherSchlecht);
    expect(hebtInDisziplinen([unscharf])).toBe(unscharf.nachherBest < unscharf.vorher ? 1 : 0);
    const keinKandidat = wirkungMitKandidat(vorbereitung, "hockey", null);
    expect(keinKandidat.nachherBest).toBe(keinKandidat.vorher);
  });

  it("Abgang des besten Spielers kostet Rang; Verletzte zählen nicht", () => {
    const ohne = wirkungOhneSpieler({ spieler, staerken, teamId: "A", disziplinId: "hockey", playerId: "A-0" });
    expect(ohne.nachherBest).toBeGreaterThanOrEqual(ohne.vorher);
    expect(
      stammInDisziplinen({ spieler, staerken, teamId: "A", disziplinIds: ["hockey"], playerId: "A-0" }),
    ).toBeLessThanOrEqual(1);
    const verletzt = baueLigaStaerken({ spieler, teamIds: ["A"], disziplinIds: ["hockey"], ausgeschlossen: new Set(["A-0", "A-1"]) });
    expect(verletzt.A.hockey).toBeLessThan(staerken.A.hockey);
  });
});
