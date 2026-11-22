/**
 * LEADERS MODERN (22.11.) — Medaillen-Hochrechnung, Spieltagsfilter, Pod-Wertung, Rang 1 = bester.
 * Das Modell wird direkt gebaut (`LeadersModell`), nicht aus einem Spielstand: die Regeln sind reine Funktionen darüber.
 */
import { describe, expect, it } from "vitest";

import {
  baueMedaillen,
  baueSpielerZeilen,
  baueTeamZeilen,
  ligaFilter,
  vergibRaenge,
  wertungText,
  type LeadersEinsatz,
  type LeadersModell,
} from "@/lib/foundation/leaders-modern";

const team = (id: string, liga: 1 | 2) => ({ teamId: id, name: `Team ${id}`, kuerzel: id, logoSrc: null, initials: id, liga, mensch: false });
const sp = (id: string, teamId: string) => ({ id, name: id, teamId, klasse: "Bard", klasseAchse: "soc" as const, portraitSrc: null, initials: id, verletzt: false });
const e = (spieltag: number, teamId: string, disziplinId: string, punkte: number, eigene: number | null, gegnerZahl: number | null, pod = false, vh = 0): LeadersEinsatz => ({
  spieltag, teamId, disziplinId, punkte, eigene, gegnerZahl, gegner: ["X"], platz: pod ? 1 : null,
  verhaeltnis: pod ? vh : (eigene ?? 0) - (gegnerZahl ?? 0), wertung: pod ? vh : (eigene ?? punkte),
});

function modell(): LeadersModell {
  return {
    gebuchteSpieltage: 2, spieltageGesamt: 20, gespielteSpieltage: [1, 2], tagesanker: { 1: false, 2: true }, ownTeamId: "A",
    disziplinen: [
      { id: "hockey", name: "Hockey", achse: "pow", spielerJeTeam: 5, pod: false },
      { id: "tdm", name: "TDM", achse: "pow", spielerJeTeam: 3, pod: true },
    ],
    disziplinenJeSpieltag: { 1: ["hockey"], 2: ["tdm"] },
    teams: [team("A", 1), team("B", 1), team("C", 1), team("D", 1), team("E", 2)],
    spieler: [sp("s1", "A"), sp("s2", "B"), sp("s3", "E")],
    buchungen: [
      { spieltag: 1, playerId: "s1", disziplinId: "hockey", pp: 4.5, platz: 1, mvp: true },
      { spieltag: 2, playerId: "s1", disziplinId: "tdm", pp: 3, platz: 12, mvp: false },
      { spieltag: 1, playerId: "s2", disziplinId: "hockey", pp: 5, platz: 1, mvp: false },
    ],
    einsaetze: [
      e(1, "A", "hockey", 2, 8, 2), e(1, "B", "hockey", 0, 2, 8), e(1, "C", "hockey", 2, 6, 4), e(1, "D", "hockey", 0, 4, 6),
      // Pod: nur das Verhältnis zählt
      e(2, "A", "tdm", 2, null, null, true, 3), e(2, "B", "tdm", 1, null, null, true, 1.5), e(2, "C", "tdm", 0, null, null, true, -1), e(2, "D", "tdm", 0, null, null, true, -3.5),
    ],
  };
}

describe("Leaders: Rang und Filter", () => {
  it("Rang 1 ist der beste, Gleiche teilen", () => {
    const r = vergibRaenge([{ id: "a", wert: 5 }, { id: "b", wert: 5 }, { id: "c", wert: 7 }, { id: "d", wert: null }]);
    expect([r.get("c"), r.get("a"), r.get("b")]).toEqual([1, 2, 2]);
    expect(r.has("d")).toBe(false);
  });
  it("Liga-Filter folgt der eigenen Liga des aktiven Managers", () => {
    expect(ligaFilter("eigene", 1)(1)).toBe(true);
    expect(ligaFilter("eigene", 1)(2)).toBe(false);
    expect(ligaFilter("andere", 1)(2)).toBe(true);
    expect(ligaFilter("alle", 2)(1)).toBe(true);
  });
});

describe("Leaders: Spieltagsfilter und PP aus den Buchungen", () => {
  it("Saison summiert alle Buchungen, ein Spieltag nur seine", () => {
    const m = modell();
    const saison = baueSpielerZeilen(m, 0).find((z) => z.spieler.id === "s1")!;
    expect(saison.pp).toBe(7.5);
    expect(saison.einsaetze).toBe(2);
    expect(saison.mvp).toBe(1);
    const tag2 = baueSpielerZeilen(m, 2);
    expect(tag2.map((z) => z.spieler.id)).toEqual(["s1"]);
    expect(tag2[0]!.pp).toBe(3);
    expect(baueSpielerZeilen(m, 1).find((z) => z.spieler.id === "s1")!.best).toEqual({ pp: 4.5, disziplinId: "hockey" });
  });
  it("Teamzeilen: Punkte, S-U-N, Verhältnis und Team-PP kommen aus den gebuchten Zeilen", () => {
    const m = modell();
    const z = baueTeamZeilen(m, 0, baueSpielerZeilen(m, 0)).find((t) => t.team.teamId === "A")!;
    expect(z.punkte).toBe(4);
    expect([z.s, z.u, z.n]).toEqual([2, 0, 0]);
    expect(z.verhaeltnis).toBe(9);
    expect(z.pp).toBe(7.5);
  });
});

describe("Leaders: Medaillen-Hochrechnung", () => {
  it("je Liga und Disziplin Gold, Silber, Bronze nach Ergebnispunkten; Pods nach dem Verhältnis", () => {
    const m = modell();
    const med = baueMedaillen(m);
    expect(med.podien.get("1:hockey")!.map((p) => p.teamId)).toEqual(["A", "C", "D"]);
    expect(med.podien.get("1:tdm")!.map((p) => p.teamId)).toEqual(["A", "B", "C"]);
    const a = med.jeTeam.get("A")!;
    expect([a.gold, a.silber, a.bronze]).toEqual([2, 0, 0]);
    expect(a.praemie).toBeCloseTo(1.0, 5);
    expect(med.jeTeam.get("E")!.gold).toBe(0);
    expect(med.gespielt).toEqual({ hockey: 1, tdm: 1 });
  });
  it("Pod-Zahlen mit Vorzeichen, Duell-Zahlen ohne", () => {
    const m = modell();
    expect(wertungText(m, "tdm", 3)).toBe("+3");
    expect(wertungText(m, "tdm", -3.5)).toBe("−3,5");
    expect(wertungText(m, "hockey", 8)).toBe("8");
  });
});
