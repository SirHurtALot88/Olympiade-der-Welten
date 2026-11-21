import { describe, expect, it } from "vitest";

import { baueVorraumTeams } from "@/lib/foundation/battle-arena/arena-vorraum";
import type { GameState } from "@/lib/data/olyDataTypes";
import { berechneGegnerRaenge } from "@/lib/lineups/einsatzliste-diszi-rang";
import { berechneVerteilung, leereSlots } from "@/lib/lineups/einsatzliste-modern-logik";

/**
 * Welle 3 (21.11.): Einsatzliste und Arena-Vorstellung. Geprueft wird die Logik hinter der Anzeige:
 * Leeren je Disziplin, Auffuellen nur fuer die aktive Disziplin, Gegner-Rang (Rang 1 = bester, je Liga)
 * und die Rangzeile der Arena-Vorstellung samt Vierergruppe.
 */
const slots = [
  { key: "d1-0", side: "d1" as const },
  { key: "d1-1", side: "d1" as const },
  { key: "d2-0", side: "d2" as const },
  { key: "d2-1", side: "d2" as const },
];
const werte = ["a", "b", "c", "d", "e"].map((id, i) => [id, slots.map((s) => ({ slotKey: s.key, projectedScore: 90 - i * 5 }))] as const);

describe("Leeren: eine Disziplin oder beide", () => {
  const belegt = { "d1-0": "a", "d1-1": "b", "d2-0": "c", "d2-1": "d" };
  it("leert nur die gewaehlte Seite und laesst die andere stehen", () => {
    const { neu, geleert } = leereSlots(slots, belegt, "d1");
    expect(neu).toEqual({ "d1-0": "", "d1-1": "", "d2-0": "c", "d2-1": "d" });
    expect(geleert).toBe(2);
    expect(leereSlots(slots, belegt, "d2").neu).toEqual({ "d1-0": "a", "d1-1": "b", "d2-0": "", "d2-1": "" });
  });
  it("leert mit `alle` beide Seiten", () => {
    const { neu, geleert } = leereSlots(slots, belegt, "alle");
    expect(Object.values(neu).every((v) => v === "")).toBe(true);
    expect(geleert).toBe(4);
  });
  it("zaehlt nur wirklich besetzte Plaetze als geleert", () => {
    expect(leereSlots(slots, { "d1-0": "a" }, "d2").geleert).toBe(0);
    expect(leereSlots(slots, {}, "alle").geleert).toBe(0);
  });
});

describe("Auffuellen nur fuer die aktive Disziplin", () => {
  it("fuellt bei nurSeite d2 ausschliesslich d2 und nimmt keine bereits gesetzten Spieler", () => {
    const v = berechneVerteilung({ modus: "auffuellen", slots, selections: { "d1-0": "a" }, werte, nurSeite: "d2" });
    expect(v.neu["d1-0"]).toBe("a");
    expect(v.neu["d1-1"] ?? "").toBe("");
    expect(v.neu["d2-0"]).toBeTruthy();
    expect(v.neu["d2-1"]).toBeTruthy();
    expect(v.neu["d2-0"]).not.toBe("a");
    expect(v.wechsel.map((w) => w.slotKey).sort()).toEqual(["d2-0", "d2-1"]);
  });
  it("ohne nurSeite fuellt es wie bisher beide Seiten", () => {
    const v = berechneVerteilung({ modus: "auffuellen", slots, selections: {}, werte });
    expect(v.wechsel).toHaveLength(4);
  });
  it("Optimieren bleibt ueber beide Seiten, auch wenn nurSeite gesetzt waere", () => {
    const v = berechneVerteilung({ modus: "optimieren", slots, selections: {}, werte, nurSeite: "d1" });
    expect(v.wechsel).toHaveLength(4);
  });
});

/** Zwei Ligen zu je vier Teams; Saisonpunkte in `basketball` aus einem gewerteten Spieltag. */
function bauSpielstand(punkte: Record<string, number>, liga: Record<string, "liga1" | "liga2">): GameState {
  const ids = Object.keys(punkte);
  return {
    teams: ids.map((id) => ({ teamId: id, name: `Team ${id}`, shortCode: id.toUpperCase().padEnd(3, "X").slice(0, 3) })),
    rosters: [],
    players: [],
    disciplines: [],
    season: { id: "s1" },
    seasonState: {
      leagueByTeamId: liga,
      standings: {},
      matchdayResults: [{ id: "r1", seasonId: "s1", status: "preview_applied" }],
      disciplineResults: ids.map((id) => ({ disciplineId: "basketball", matchdayResultId: "r1", resolutionSource: "arena", teamId: id, teamPoints: punkte[id] })),
    },
  } as unknown as GameState;
}

describe("Gegner-Rang: Rang 1 ist der beste, je Liga", () => {
  const liga = { a: "liga1", b: "liga1", c: "liga1", d: "liga1", e: "liga2", f: "liga2" } as const;
  const gs = bauSpielstand({ a: 10, b: 8, c: 6, d: 2, e: 9, f: 1 }, { ...liga });
  it("liefert je Gegner den Liga-Rang und klein den Rang unter allen", () => {
    const zeilen = berechneGegnerRaenge(gs, ["b", "e"], "basketball");
    const b = zeilen.find((z) => z.teamId === "b")!;
    const e = zeilen.find((z) => z.teamId === "e")!;
    expect(b).toMatchObject({ liga: 2, ligaName: "Liga 1", gesamt: 3, gesamtVon: 6, quelle: "saison" });
    expect(e).toMatchObject({ liga: 1, ligaName: "Liga 2", gesamt: 2 });
  });
  it("Vierergruppe: alle drei Gegner in der Reihenfolge des Plans, mit Kuerzel", () => {
    const zeilen = berechneGegnerRaenge(gs, ["c", "d", "f"], "basketball");
    expect(zeilen.map((z) => z.teamId)).toEqual(["c", "d", "f"]);
    expect(zeilen.map((z) => z.liga)).toEqual([3, 4, 2]);
    expect(zeilen[0]!.kuerzel).toBe("CXX");
  });
  it("ohne Daten kein Rang statt einer erfundenen Zahl", () => {
    const leer = berechneGegnerRaenge({ ...gs, seasonState: { ...gs.seasonState, disciplineResults: [] } } as GameState, ["b"], "basketball");
    expect(leer[0]!.liga ?? null).toBeNull();
  });
});

describe("Arena-Vorstellung: Disziplin-Rang je Team (Liga zuerst)", () => {
  const gs = bauSpielstand({ a: 10, b: 8, c: 6, d: 2, e: 9, f: 1 }, { a: "liga1", b: "liga1", c: "liga1", d: "liga1", e: "liga2", f: "liga2" });
  it("tragen alle vier Teams der Gruppe einen Rang, das eigene Team steht zuerst", () => {
    const teams = baueVorraumTeams({ gameState: gs, teamIds: ["b", "c", "d", "a"], ownTeamId: "a", disciplineId: "basketball" });
    expect(teams.map((t) => t.teamId)).toEqual(["a", "b", "c", "d"]);
    expect(teams.map((t) => t.diszRang?.liga)).toEqual([1, 2, 3, 4]);
    expect(teams[0]!.diszRang).toMatchObject({ ligaName: "Liga 1", gesamt: 1, gesamtVon: 6, quelle: "saison" });
  });
});
