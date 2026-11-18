import { describe, expect, it } from "vitest";

import {
  baueVerlaufsLinien,
  bestimmeZone,
  bewegungText,
  formAusVerlauf,
  formPlaetze,
  einsatzZeile,
  rangBand,
  wertRaenge,
  sparklinePunkte,
  abstandZumFuehrer,
  kaderStaerkeAnteil,
  waehleShowdownPaarungen,
  istDuellVerlauf,
  lagesatz,
  matrixAnteil,
  anteilStufe,
  duellPunkteJeDisziplin,
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

  it("Matrix im Duell-Save: ganzzahlige Duellpunkte je Disziplin, keine PPs", () => {
    const d = (disciplineId: string, h: number | null, g: number | null) => ({ disciplineId, gespielt: h != null, punkteHeim: h, punkteGast: g });
    const u1 = {
      paarungen: [
        { homeTeamId: "A", awayTeamId: "B", disziplinen: [d("climbing", 2, 0), d("wettessen", 1, 1)] },
      ],
      miniDmPods: [{ disciplineId: "mini-dm", mitglieder: [{ teamId: "A", teamPoints: 2 }, { teamId: "B", teamPoints: 0 }, { teamId: "C", teamPoints: null }] }],
    };
    const u2 = { paarungen: [{ homeTeamId: "B", awayTeamId: "A", disziplinen: [d("climbing", 2, 0), d("tdm", null, null)] }], miniDmPods: [] };
    const m = duellPunkteJeDisziplin([u1, u2, null] as never);
    expect(m.get("A")?.get("climbing")).toMatchObject({ punkte: 2, moeglich: 4 });
    expect(m.get("B")?.get("climbing")).toMatchObject({ punkte: 2, moeglich: 4 });
    expect(m.get("A")?.get("wettessen")).toMatchObject({ punkte: 1, moeglich: 2 });
    expect(m.get("A")?.get("mini-dm")).toMatchObject({ punkte: 2, moeglich: 2 });
    expect(m.get("A")?.has("tdm")).toBe(false);
    expect(m.has("C")).toBe(false);
    for (const jeD of m.values()) for (const z of jeD.values()) expect(Number.isInteger(z.punkte)).toBe(true);
    expect(anteilStufe({ punkte: 0, moeglich: 2, einsaetze: [] })).toBe(0);
    expect(anteilStufe({ punkte: 1, moeglich: 4, einsaetze: [] })).toBe(1);
    expect(anteilStufe({ punkte: 1, moeglich: 2, einsaetze: [] })).toBe(2);
    expect(anteilStufe({ punkte: 3, moeglich: 4, einsaetze: [] })).toBe(3);
    expect(anteilStufe({ punkte: 4, moeglich: 4, einsaetze: [] })).toBe(4);
    expect(anteilStufe(null)).toBeNull();
  });

  it("Vierergruppen-Disziplin wird nicht doppelt gebucht (Paarung und Pod)", () => {
    const u = {
      paarungen: [{ homeTeamId: "A", awayTeamId: "B", disziplinen: [{ disciplineId: "mini-dm", gespielt: true, punkteHeim: 2, punkteGast: 1, miniDmPodIdHeim: "p1", miniDmPodIdGast: "p1" }] }],
      miniDmPods: [{ disciplineId: "mini-dm", mitglieder: [{ teamId: "A", teamPoints: 2 }, { teamId: "B", teamPoints: 1 }] }],
    };
    const m = duellPunkteJeDisziplin([u] as never);
    expect(m.get("A")?.get("mini-dm")).toMatchObject({ punkte: 2, moeglich: 2 });
    expect(m.get("B")?.get("mini-dm")).toMatchObject({ punkte: 1, moeglich: 2 });
  });
});

describe("Runde 2: Form, Bänder, Sparkline, Abstand, Kaderstärke", () => {
  it("Form hat immer sechs Plätze, vorn leer, ältester zuerst", () => {
    const eintraege = [4, 2, 0, 3].map((p, i) => ({ played: true, tagespunkte: p, cumulativePoints: i }));
    const form = formAusVerlauf(eintraege);
    expect(form.map((f) => f.ton)).toEqual(["s", "u", "n", "s"]);
    const plaetze = formPlaetze(form);
    expect(plaetze).toHaveLength(6);
    expect(plaetze.map((f) => f.ton)).toEqual(["o", "o", "s", "u", "n", "s"]);
    const lang = formAusVerlauf(Array.from({ length: 9 }, (_, i) => ({ played: true, tagespunkte: i % 5, cumulativePoints: i })));
    expect(lang).toHaveLength(6);
  });
  it("Rang-Bänder: 1–3 gut, 4–6 warn, 7–10 risk, ab 11 keins", () => {
    expect([1, 3, 4, 6, 7, 10, 11, 16].map(rangBand)).toEqual(["gut", "gut", "warn", "warn", "risk", "risk", null, null]);
    expect(rangBand(null)).toBeNull();
    expect(rangBand(0)).toBeNull();
  });
  it("wertRaenge: höher = besser, Gleichstand teilt den schlechteren Rang, ohne Wert kein Rang", () => {
    const r = wertRaenge([{ id: "a", w: 10 }, { id: "b", w: 8 }, { id: "c", w: 8 }, { id: "d", w: 1 }, { id: "e", w: null }], (t) => t.id, (t) => t.w);
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBe(3);
    expect(r.get("c")).toBe(3);
    expect(r.get("d")).toBe(4);
    expect(r.has("e")).toBe(false);
    const alleNull = wertRaenge([{ id: "a", w: 0 }, { id: "b", w: 0 }], (t) => t.id, (t) => t.w);
    expect(alleNull.get("a")).toBe(2);
  });
  it("Sparkline: Platz 1 oben, Endpunkt auf dem letzten Wert, unter zwei Punkten keine Linie", () => {
    expect(sparklinePunkte([3], 16)).toBeNull();
    const s = sparklinePunkte([1, 16], 16)!;
    expect(s.punkte).toBe("3.0,3.0 79.0,19.0");
    expect(s.ende).toEqual({ x: 79, y: 19 });
    const luecke = sparklinePunkte([2, null, 2], 16)!;
    expect(luecke.punkte.split(" ")).toHaveLength(2);
  });
  it("Abstand zum Führer: Führer und ohne Wertung ohne Zahl", () => {
    expect(abstandZumFuehrer(liga2[0]!, liga2)).toBeNull();
    expect(abstandZumFuehrer(liga2[3]!, liga2)).toBe(4);
    expect(abstandZumFuehrer(zeile("x", 1, null), [zeile("x", 1, null)])).toBeNull();
  });
  it("Kaderstärke-Anteil ist ein Verhältnis, keine Siegchance: A/(A+B)", () => {
    expect(kaderStaerkeAnteil(30, 10)).toBe(75);
    expect(kaderStaerkeAnteil(10, 10)).toBe(50);
    expect(kaderStaerkeAnteil(0, 0)).toBeNull();
    expect(kaderStaerkeAnteil(undefined, 5)).toBeNull();
  });
  it("Showdown-Auswahl: eigenes Spiel, Spitzenspiel (kleinste Rangsumme), Kellerduell (größte), ohne Doppelte", () => {
    const k = [
      { id: "p1", rangHeim: 1, rangGast: 2, eigen: false },
      { id: "p2", rangHeim: 5, rangGast: 9, eigen: true },
      { id: "p3", rangHeim: 15, rangGast: 16, eigen: false },
      { id: "p4", rangHeim: 7, rangGast: 8, eigen: false },
    ];
    expect(waehleShowdownPaarungen(k)).toEqual([
      { id: "p2", tag: "Dein Spiel" }, { id: "p1", tag: "Spitzenspiel" }, { id: "p3", tag: "Kellerduell" },
    ]);
    expect(waehleShowdownPaarungen([k[0]!])).toEqual([{ id: "p1", tag: "Spitzenspiel" }]);
  });
});

describe("Matrix-Hover: Einzeleinsätze", () => {
  const dz = (id: string, name: string, h: number, g: number, norm: [number, number] | null, seiten: [number, number] | null) => ({
    disciplineId: id, disciplineName: name, gespielt: true, punkteHeim: h, punkteGast: g, ergebnisNormiert: norm, seiten, miniDmPodIdHeim: null, miniDmPodIdGast: null,
  });
  it("Duell: Gegner, normierte Zahl aus der Sicht der Seite, Ausgang, Spieltag-Nummer", () => {
    const u = { matchdayIndex: 2, paarungen: [{ homeTeamId: "A", awayTeamId: "B", disziplinen: [dz("climbing", "Climbing", 2, 0, [8, 4], [70, 15])] }], miniDmPods: [] };
    const m = duellPunkteJeDisziplin([u] as never);
    const a = m.get("A")!.get("climbing")!.einsaetze[0]!;
    const b = m.get("B")!.get("climbing")!.einsaetze[0]!;
    expect(a).toMatchObject({ spieltag: 3, gegner: ["B"], eigene: 8, gegnerZahl: 4, punkte: 2, ausgang: "sieg", platz: null });
    expect(b).toMatchObject({ eigene: 4, gegnerZahl: 8, punkte: 0, ausgang: "niederlage" });
    const namen: Record<string, string> = { A: "Alpha", B: "Royal Court" };
    expect(einsatzZeile(a, (id) => namen[id]!)).toBe("2 Pkt · Sieg 8–4 gegen Royal Court (Spieltag 3)");
  });
  it("ohne Normierung: gerundete Rohwerte; ohne beides: keine Zahlen", () => {
    const u = { matchdayIndex: 0, paarungen: [{ homeTeamId: "A", awayTeamId: "B", disziplinen: [dz("x", "X", 1, 1, null, [70.4, 69.6]), dz("y", "Y", 1, 1, null, null)] }], miniDmPods: [] };
    const m = duellPunkteJeDisziplin([u] as never);
    expect(m.get("A")!.get("x")!.einsaetze[0]).toMatchObject({ eigene: 70, gegnerZahl: 70, ausgang: "remis" });
    expect(einsatzZeile(m.get("A")!.get("y")!.einsaetze[0]!, (id) => id)).toBe("1 Pkt · Unentschieden gegen B (Spieltag 1)");
  });
  it("zweimal in der Saison: zwei Zeilen; Vierergruppe: Platz und drei Gegner", () => {
    const u1 = { matchdayIndex: 0, paarungen: [{ homeTeamId: "A", awayTeamId: "B", disziplinen: [dz("c", "C", 2, 0, [9, 1], null)] }], miniDmPods: [] };
    const u2 = { matchdayIndex: 5, paarungen: [{ homeTeamId: "C", awayTeamId: "A", disziplinen: [dz("c", "C", 0, 2, [3, 7], null)] }], miniDmPods: [] };
    const z = duellPunkteJeDisziplin([u1, u2] as never).get("A")!.get("c")!;
    expect(z.einsaetze.map((e) => e.spieltag)).toEqual([1, 6]);
    expect(z.punkte).toBe(4);
    const pod = { matchdayIndex: 1, paarungen: [], miniDmPods: [{ disciplineId: "mini-dm", mitglieder: [
      { teamId: "A", teamPoints: 2, platz: 1 }, { teamId: "B", teamPoints: 1, platz: 2 }, { teamId: "C", teamPoints: 0, platz: 3 }, { teamId: "D", teamPoints: 0, platz: 4 }] }] };
    const e = duellPunkteJeDisziplin([pod] as never).get("A")!.get("mini-dm")!.einsaetze[0]!;
    expect(e.gegner).toEqual(["B", "C", "D"]);
    expect(einsatzZeile(e, (id) => id)).toBe("2 Pkt · Platz 1 von 4 · gegen B, C, D (Spieltag 2)");
  });
});
