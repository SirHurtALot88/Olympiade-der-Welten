import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  ACHSEN,
  attributWerteAusDaten,
  baueRangZeilen,
  berechneSpielerRaenge,
  bestimmeExperte,
  bestimmeVerletzung,
  bestimmeWeg,
  gehaltJeSpieltag,
  grobBereich,
  grobeRangStufe,
  hatNebel,
  nebelBreite,
  mittelBeste6,
} from "@/lib/foundation/spielerprofil-modell";

function spieler(id: string, wert: number): Player {
  return {
    id,
    name: id,
    currentDisciplineValues: { basketball: wert, hockey: 50 },
    disciplineRatings: { basketball: wert, hockey: 50 },
  } as unknown as Player;
}

function zustand(): GameState {
  const players = [
    spieler("a1", 90),
    spieler("a2", 80),
    spieler("a3", 70),
    spieler("a4", 60),
    spieler("a5", 55),
    spieler("a6", 50),
    spieler("a7", 40),
    spieler("b1", 95),
    spieler("b2", 65),
    spieler("c1", 99),
    spieler("frei", 100),
  ];
  const teamOf: Record<string, string> = {
    a1: "t1", a2: "t1", a3: "t1", a4: "t1", a5: "t1", a6: "t1", a7: "t1",
    b1: "t2", b2: "t2",
    c1: "t3",
  };
  return {
    season: {
      id: "season-1",
      name: "S1",
      currentMatchday: 5,
      matchdayIds: ["matchday-1", "matchday-2", "matchday-3", "matchday-4", "matchday-5", "matchday-6", "matchday-7"],
    },
    seasonState: {
      seasonId: "season-1",
      leagueByTeamId: { t1: "liga1", t2: "liga1", t3: "liga2" },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      seasonSnapshots: [],
    },
    matchdayState: { matchdayId: "matchday-5", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    disciplines: [
      { id: "basketball", name: "Basketball", category: "mental" },
      { id: "hockey", name: "Hockey", category: "power" },
    ],
    players,
    teams: [],
    rosters: Object.entries(teamOf).map(([playerId, teamId]) => ({ id: `r-${playerId}`, playerId, teamId })),
  } as unknown as GameState;
}

describe("Spielerprofil-Modell: Ränge", () => {
  it("rechnet Liga-, Aktiv- und Kaderrang getrennt und lässt Vertragslose außen vor", () => {
    const raenge = berechneSpielerRaenge(zustand(), "a2", ["basketball"]);
    const bb = raenge.disziplinen.get("basketball")!;
    // Liga 1: a1..a7 + b1 + b2 = 9 Spieler; vor a2 (80) stehen b1 (95) und a1 (90) -> Rang 3
    expect(bb.ligaRang).toBe(3);
    expect(bb.ligaVon).toBe(9);
    // alle Aktiven (ohne den vertragslosen Spieler mit 100): c1 99, b1 95, a1 90 stehen davor -> Rang 4 von 10
    expect(bb.aktivRang).toBe(4);
    expect(bb.aktivVon).toBe(10);
    expect(bb.kaderRang).toBe(2);
    expect(bb.kaderVon).toBe(7);
    expect(bb.inBesten6).toBe(true);
    expect(raenge.ligaAktiv).toBe(true);
  });

  it("der siebte im Kader zählt nicht zu den besten 6", () => {
    const bb = berechneSpielerRaenge(zustand(), "a7", ["basketball"]).disziplinen.get("basketball")!;
    expect(bb.kaderRang).toBe(7);
    expect(bb.inBesten6).toBe(false);
  });

  it("Kaderstärke ist das Mittel der besten 6", () => {
    const raenge = berechneSpielerRaenge(zustand(), "a1", ["basketball"]);
    expect(raenge.kaderStaerkeBeste6.get("basketball")).toBeCloseTo((90 + 80 + 70 + 60 + 55 + 50) / 6, 5);
    expect(mittelBeste6([10, 20, 30, 40, 50, 60, 70, 5])).toBeCloseTo((70 + 60 + 50 + 40 + 30 + 20) / 6, 5);
    expect(mittelBeste6([])).toBeNull();
  });

  it("ohne Liga-Split zählt die ganze Aktivenschaft als Liga", () => {
    const state = zustand();
    state.seasonState.leagueByTeamId = undefined;
    const bb = berechneSpielerRaenge(state, "a2", ["basketball"]).disziplinen.get("basketball")!;
    expect(bb.ligaVon).toBe(bb.aktivVon);
    expect(bb.ligaRang).toBe(bb.aktivRang);
  });
});

describe("Spielerprofil-Modell: Verletzung", () => {
  const basis = {
    isUnavailable: true,
    injuryStatus: "injured" as const,
    injuryUntilMatchday: "matchday-6",
  };

  it("zeigt „verletzt · nicht einsetzbar · noch N Spieltage“ ab dem nächsten ungespielten Spieltag", () => {
    const anzeige = bestimmeVerletzung(
      {
        availability: basis,
        injuryHistoryRows: [{ disciplines: [{ disciplineId: "hockey", name: "Hockey", playerCount: 6 }] }],
      } as never,
      zustand(),
    );
    expect(anzeige.verletzt).toBe(true);
    expect(anzeige.nochSpieltage).toBe(2);
    expect(anzeige.text).toBe("verletzt · nicht einsetzbar · noch 2 Spieltage");
    expect(anzeige.halbeDisziplinen).toEqual([{ disziplinId: "hockey", name: "Hockey" }]);
  });

  it("zählt nach gespieltem Spieltag vom folgenden", () => {
    const state = zustand();
    state.matchdayState.status = "resolved";
    const anzeige = bestimmeVerletzung({ availability: basis, injuryHistoryRows: [] } as never, state);
    expect(anzeige.nochSpieltage).toBe(1);
    expect(anzeige.text).toBe("verletzt · nicht einsetzbar · noch 1 Spieltag");
  });

  it("ein gesunder Spieler hat keinen Text, ein Genesener ist nicht verletzt", () => {
    const gesund = bestimmeVerletzung(
      { availability: { isUnavailable: false, injuryStatus: "healthy", injuryUntilMatchday: null }, injuryHistoryRows: [] } as never,
      zustand(),
    );
    expect(gesund.verletzt).toBe(false);
    expect(gesund.text).toBeNull();
    const genesend = bestimmeVerletzung(
      { availability: { isUnavailable: false, injuryStatus: "recovering", injuryUntilMatchday: null }, injuryHistoryRows: [] } as never,
      zustand(),
    );
    expect(genesend.verletzt).toBe(false);
    expect(genesend.genesend).toBe(true);
  });
});

describe("Spielerprofil-Modell: Scouting-Nebel", () => {
  it("Nebel genau dann, wenn der Spieler nur gescoutet sichtbar ist", () => {
    expect(hatNebel({ attributeVisibility: "scouted" })).toBe(true);
    expect(hatNebel({ attributeVisibility: "exact" })).toBe(false);
  });

  it("Nebelstufen: unbekannt 10er, beobachtet 5er, gescoutet exakt", () => {
    expect(nebelBreite({ attributeVisibility: "scouted", revealConfidencePct: 10 })).toBe(10);
    expect(nebelBreite({ attributeVisibility: "scouted", revealConfidencePct: 55 })).toBe(5);
    expect(nebelBreite({ attributeVisibility: "scouted", revealConfidencePct: 100 })).toBe(0);
    expect(nebelBreite({ attributeVisibility: "exact" })).toBe(0);
    expect(grobBereich(73, 5)).toBe("70–74");
    expect(grobBereich(73, 0)).toBe("73");
  });

  it("zeigt Zehnerbereiche und grobe Ränge statt exakter Werte", () => {
    expect(grobBereich(73)).toBe("70–79");
    expect(grobBereich(null)).toBeNull();
    expect(grobeRangStufe(3, 100)).toBe("Spitze (Top 10 %)");
    expect(grobeRangStufe(40, 100)).toBe("obere Hälfte");
    expect(grobeRangStufe(90, 100)).toBe("hintere Gruppe");
    expect(grobeRangStufe(null, 100)).toBeNull();
  });

  it("verrät im Nebel keine Experten-Disziplinen", () => {
    const experte = bestimmeExperte({
      attributeVisibility: "scouted",
      attributeStats: [],
      disciplineValues: [{ id: "tennis", label: "Tennis", category: "mental", value: 80 }],
    } as never);
    expect(experte).toEqual([]);
  });
});

describe("Spielerprofil-Modell: Primär- und Nebenweg", () => {
  const stats = (werte: Record<string, number>) =>
    ({ attributeStats: Object.entries(werte).map(([key, value]) => ({ key, value })) }) as never;

  it("Primärweg: das Attribut mit dem höchsten Matrixgewicht trägt auch den Spieler", () => {
    const weg = bestimmeWeg("gewichtheben", attributWerteAusDaten(stats({ power: 95, health: 40, determination: 40 })));
    expect(weg.primaerAttribut).toBe("power");
    expect(weg.istPrimaer).toBe(true);
  });

  it("Nebenweg: ein anderes Attribut trägt die Eignung", () => {
    const weg = bestimmeWeg(
      "gewichtheben",
      attributWerteAusDaten(stats({ power: 10, health: 95, determination: 95, stamina: 95 })),
    );
    expect(weg.primaerAttribut).toBe("power");
    expect(weg.tragendesAttribut).not.toBe("power");
    expect(weg.istPrimaer).toBe(false);
  });

  it("vier Achsen mit je drei Attributen decken alle zwölf ab", () => {
    expect(ACHSEN.flatMap((achse) => achse.attribute)).toHaveLength(12);
    expect(new Set(ACHSEN.flatMap((achse) => achse.attribute)).size).toBe(12);
  });
});

describe("Spielerprofil-Modell: Gehalt", () => {
  it("Gehalt je Spieltag ist das Jahresgehalt durch 20", () => {
    expect(gehaltJeSpieltag(40)).toBe(2);
    expect(gehaltJeSpieltag(null)).toBeNull();
  });
});

describe("Spielerprofil-Modell: Rangzeilen der Experten-Karten", () => {
  const ids = ["basketball"];

  it("Spieler im Kader: Rang im Team und Rang in der Liga", () => {
    const raenge = berechneSpielerRaenge(zustand(), "a2", ids, "t1");
    const zeilen = baueRangZeilen(raenge.disziplinen.get("basketball"), raenge, false);
    expect(zeilen).toEqual([
      { wort: "im Kader", wert: "#2", gross: true },
      { wort: "Liga", wert: "#3", gross: false },
    ]);
  });

  it("Vertragsloser Spieler: „bei dir“ im Kader des Betrachters und „Alle“ unter allen Aktiven", () => {
    const raenge = berechneSpielerRaenge(zustand(), "frei", ids, "t1");
    expect(raenge.vertragslos).toBe(true);
    const bb = raenge.disziplinen.get("basketball")!;
    // 100 schlägt alle: Rang 1 im eigenen Kader (7 Spieler + er) und Rang 1 unter allen Aktiven.
    expect(bb.beiDirRang).toBe(1);
    expect(bb.beiDirVon).toBe(8);
    expect(bb.freiAktivRang).toBe(1);
    expect(baueRangZeilen(bb, raenge, false)).toEqual([
      { wort: "bei dir", wert: "#1", gross: true },
      { wort: "Alle", wert: "#1", gross: false },
    ]);
  });

  it("Vertragsloser Spieler mitten im Feld: Rang zählt nur die Besseren", () => {
    const state = zustand();
    state.players.find((p) => p.id === "frei")!.currentDisciplineValues = { basketball: 72, hockey: 50 };
    const bb = berechneSpielerRaenge(state, "frei", ids, "t1").disziplinen.get("basketball")!;
    // Besser als 72: c1 99, b1 95, a1 90, a2 80 -> Rang 5 unter allen; im Kader t1 stehen a1 90, a2 80 davor -> Rang 3.
    expect(bb.freiAktivRang).toBe(5);
    expect(bb.beiDirRang).toBe(3);
  });

  it("ohne Betrachter-Team entfällt „bei dir“, ohne Wert entfällt alles (kein „#–“)", () => {
    const raenge = berechneSpielerRaenge(zustand(), "frei", ids, null);
    expect(baueRangZeilen(raenge.disziplinen.get("basketball"), raenge, false)).toEqual([{ wort: "Alle", wert: "#1", gross: false }]);
    const state = zustand();
    state.players.find((p) => p.id === "frei")!.currentDisciplineValues = {};
    state.players.find((p) => p.id === "frei")!.disciplineRatings = {};
    const leer = berechneSpielerRaenge(state, "frei", ids, "t1");
    expect(baueRangZeilen(leer.disziplinen.get("basketball"), leer, false)).toEqual([]);
    expect(baueRangZeilen(undefined, leer, false)).toEqual([]);
  });

  it("Nebel verrät keinen exakten Rang: Kader weg, Liga nur als Stufe", () => {
    const raenge = berechneSpielerRaenge(zustand(), "a2", ids, "t1");
    const zeilen = baueRangZeilen(raenge.disziplinen.get("basketball"), raenge, true);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]!.wort).toBe("Liga");
    expect(zeilen[0]!.wert).not.toMatch(/#/);
    const frei = berechneSpielerRaenge(zustand(), "frei", ids, "t1");
    const freiZeilen = baueRangZeilen(frei.disziplinen.get("basketball"), frei, true);
    expect(freiZeilen.every((zeile) => !zeile.wert.includes("#"))).toBe(true);
  });
});
