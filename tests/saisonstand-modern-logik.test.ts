import { describe, expect, it } from "vitest";

import {
  baueVerlaufsLinien,
  bestimmeZone,
  bewegungText,
  formAusVerlauf,
  istDuellVerlauf,
  lagesatz,
  matrixAnteil,
  matrixStufe,
  rangStufe,
  stehtAufDemSpiel,
  teileNachLiga,
  type SaisonstandZeile,
} from "@/lib/season/saisonstand-modern-logik";
import { baueMatchwinnerListe } from "@/lib/season/saisonstand-matchwinner";

const zeile = (teamId: string, rank: number, points: number | null, leagueTier: "liga1" | "liga2" = "liga2", isSelected = false): SaisonstandZeile => ({
  teamId, teamName: teamId, rank, points, leagueTier, isSelected,
});
const liga2 = [zeile("a", 1, 20, "liga2"), zeile("b", 2, 18), zeile("c", 3, 17), zeile("d", 4, 16), zeile("e", 5, 10)];

describe("Saisonstand modern: Zonen", () => {
  it("Titel nur Liga 1 Platz 1, Abstieg Liga 1 Plätze 14-16, Aufstieg Liga 2 Plätze 1-3", () => {
    expect(bestimmeZone("liga1", 1)).toBe("titel");
    expect(bestimmeZone("liga1", 2)).toBeNull();
    expect(bestimmeZone("liga1", 13)).toBeNull();
    expect(bestimmeZone("liga1", 14)).toBe("abstieg");
    expect(bestimmeZone("liga1", 16)).toBe("abstieg");
    expect(bestimmeZone("liga2", 3)).toBe("aufstieg");
    expect(bestimmeZone("liga2", 4)).toBeNull();
    expect(bestimmeZone(null, 1)).toBeNull();
    expect(bestimmeZone("liga2", null)).toBeNull();
  });
  it("teilt nach Liga und sortiert nach Rang", () => {
    const t = teileNachLiga([zeile("x", 2, 1, "liga1"), zeile("y", 1, 1, "liga1"), zeile("z", 1, 1, "liga2")]);
    expect(t.liga1.map((z) => z.teamId)).toEqual(["y", "x"]);
    expect(t.liga2).toHaveLength(1);
  });
});

describe("Saisonstand modern: Lagesatz", () => {
  it("Liga 2: hinter dem Aufstiegsplatz", () => {
    expect(lagesatz(liga2[3], liga2)).toBe("1 Pkt hinter Aufstiegsplatz 3");
  });
  it("Liga 2: Polster auf Platz 4", () => {
    expect(lagesatz(liga2[2], liga2)).toBe("1 Pkt vor Platz 4");
  });
  it("ohne Wertung nur der Startplatz", () => {
    expect(lagesatz(zeile("q", 7, null), liga2)).toBe("Startplatz 7");
  });
  it("Liga 1: Führender und Abstiegszone", () => {
    const l1 = Array.from({ length: 16 }, (_, i) => zeile(`t${i + 1}`, i + 1, 40 - i * 2, "liga1"));
    expect(lagesatz(l1[0], l1)).toBe("2 Pkt vor Platz 2");
    expect(lagesatz(l1[13], l1)).toBe("2 Pkt hinter Rettungsplatz 13");
    expect(lagesatz(l1[5], l1)).toBe("16 Pkt vor der Abstiegszone");
  });
  it("Was auf dem Spiel steht: Abstand zur Linie und Restpunkte", () => {
    const s = stehtAufDemSpiel(liga2[3], liga2, 5);
    expect(s.find((x) => x.id === "aufstieg")?.wert).toBe("−1 Pkt");
    expect(s.find((x) => x.id === "rest")?.wert).toBe("bis 20 Pkt");
    expect(stehtAufDemSpiel(zeile("n", 1, null), liga2, 5)).toEqual([]);
  });
});

describe("Saisonstand modern: Form, Verlauf, Heatmap", () => {
  const e = (tagespunkte: number | null, played = true, cumulativePoints = 0) => ({ played, tagespunkte, cumulativePoints });
  it("Form: letzte gespielte Spieltage, älteste zuerst, Schwellen 3/2", () => {
    const f = formAusVerlauf([e(4), e(2), e(1), e(3), e(0), e(0, false), e(null, false)], 3);
    expect(f.map((x) => x.ton)).toEqual(["n", "s", "n"]);
    expect(formAusVerlauf(undefined)).toEqual([]);
  });
  it("Form nur bei Duell-Wertung (Tagespunkte höchstens 4), nicht bei PPs-Summen", () => {
    const sp = [{ nummer: 1, played: true }];
    expect(istDuellVerlauf({ spieltage: sp, byTeamId: { a: [e(4)] } })).toBe(true);
    expect(istDuellVerlauf({ spieltage: sp, byTeamId: { a: [e(4)], b: [e(31.5)] } })).toBe(false);
    expect(istDuellVerlauf({ spieltage: sp, byTeamId: { a: [e(null, false)] } })).toBe(false);
    expect(istDuellVerlauf(null)).toBe(false);
  });
  it("Verlauf zählt den Rang INNERHALB der Liga, Gleichstand nach Tabellenrang", () => {
    const zeilen = [zeile("a", 1, 4, "liga1"), zeile("b", 2, 4, "liga1"), zeile("c", 1, 8, "liga2")];
    const verlauf = {
      spieltage: [{ nummer: 1, played: true }, { nummer: 2, played: false }],
      byTeamId: { a: [e(2, true, 4)], b: [e(2, true, 4)], c: [e(4, true, 8)] },
    };
    const { tage, linien } = baueVerlaufsLinien(verlauf, zeilen);
    expect(tage).toEqual([1]);
    expect(linien.find((l) => l.teamId === "a")?.raenge).toEqual([1]);
    expect(linien.find((l) => l.teamId === "b")?.raenge).toEqual([2]);
    expect(linien.find((l) => l.teamId === "c")?.raenge).toEqual([1]);
  });
  it("Heatmap-Anteil relativ zur Spalte", () => {
    expect(matrixAnteil(2, 4)).toBe(0.5);
    expect(matrixAnteil(null, 4)).toBeNull();
    expect(matrixAnteil(3, 0)).toBe(0);
    expect(matrixAnteil(9, 4)).toBe(1);
  });
  it("Bewegung", () => {
    expect(bewegungText(2)).toMatchObject({ zeichen: "▲", zahl: 2, ton: "plus" });
    expect(bewegungText(-3)).toMatchObject({ zeichen: "▼", zahl: 3, ton: "minus" });
    expect(bewegungText(null).ton).toBe("null");
  });
});

describe("Saisonstand modern: Matchwinner", () => {
  const stand = {
    players: [{ id: "p1", name: "Eins" }, { id: "p2", name: "Zwei" }],
    seasonState: {
      matchdayResults: [{ id: "m1", seasonId: "s1", status: "preview_applied" }, { id: "m2", seasonId: "s1", status: "draft" }],
      disciplineResults: [
        { matchdayResultId: "m1", teamId: "t1", disciplineId: "hockey", teamPoints: 2 },
        { matchdayResultId: "m1", teamId: "t2", disciplineId: "hockey", teamPoints: 0 },
        { matchdayResultId: "m2", teamId: "t1", disciplineId: "tdm", teamPoints: 2 },
      ],
      playerDisciplinePerformances: [
        { matchdayResultId: "m1", teamId: "t1", playerId: "p1", disciplineId: "hockey", rankInTeam: 1 },
        { matchdayResultId: "m1", teamId: "t2", playerId: "p2", disciplineId: "hockey", rankInTeam: 1 },
        { matchdayResultId: "m2", teamId: "t1", playerId: "p1", disciplineId: "tdm", rankInTeam: 1 },
      ],
    },
  } as never;
  it("zählt nur gewonnene, gewertete Einsätze als Bester des Teams", () => {
    const liste = baueMatchwinnerListe(stand, "s1");
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ playerId: "p1", matchwinner: 1, einsaetze: 1 });
  });
  it("leer ohne gewertete Spieltage", () => {
    expect(baueMatchwinnerListe(stand, "andere")).toEqual([]);
  });

  it("Matrix-Stufen: fünf klar getrennte Stufen nach Platz in der Spalte", () => {
    const stufen = Array.from({ length: 16 }, (_, i) => rangStufe(i + 1, 16));
    expect(stufen).toEqual([4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0]);
    expect(rangStufe(null, 16)).toBeNull();
    expect(rangStufe(1, 1)).toBe(2);
    const spalte = [16.7, 18.9, 8.9, 7.7, 3.7, 2.5, 14.9, 18.3, 10.8, 2.9, 4.4, null];
    expect(matrixStufe(18.9, spalte)).toBe(4);
    expect(matrixStufe(2.5, spalte)).toBe(0);
    expect(matrixStufe(null, spalte)).toBeNull();
    expect(matrixStufe(5, [5, 5, 5])).toBe(4);
  });
});
