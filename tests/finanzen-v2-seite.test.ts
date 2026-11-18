/**
 * Finanzseite (Finanzkonzept V2): Gebaeude und Verlaengerungen gegen die Freigabe, Umschichten, Lockerung,
 * Ruecklage anzapfen, „Alles auf eine Karte“, KI-Entscheidung, Kontoauszug-Verlauf der Seite.
 * Gebaut auf einem kleinen Spielstand ohne Datenbank; die harte Sperre laeuft ueber dieselben Funktionen wie im Spiel.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildFinanzSeiteModell } from "@/lib/finance/finanzseite-modell";
import {
  beantrageAlleAufEineKarte,
  entscheideKiVorstandMassnahmen,
  kiCharakter,
  setzeUmschichtung,
  vorstandFordertAlleAufEineKarte,
  zapfeRuecklageAn,
} from "@/lib/finance/vorstand-budget-aktionen";
import {
  ALLES_PUFFER_ANTEIL,
  berechneVorstandBudgetStand,
  pruefeGebaeudeGegenVorstandFreigabe,
  pruefeKaufGegenVorstandFreigabe,
  pruefeVerlaengerungGegenVorstandFreigabe,
} from "@/lib/finance/vorstand-budgetfreigabe";

afterEach(() => {
  delete process.env.OLY_VORSTAND_BUDGET;
});

type Optionen = {
  cash?: number;
  vertrauen?: number;
  saison?: string;
  phase?: string;
  gehaelter?: number[];
  history?: unknown[];
  facilityEvents?: unknown[];
  risiko?: number;
  ambition?: number;
  zustand?: unknown;
  kaderMarktwerte?: Record<string, number>;
};

/** Team A (Mensch oder KI), dazu vier Mitbewerber mit gestaffelten Kader-Marktwerten fuer den Erwartungsrang. */
function spielstand(o: Optionen = {}): GameState {
  const gehaelter = o.gehaelter ?? [8, 8, 8, 8, 8, 8, 8, 8, 8];
  const rosters = gehaelter.map((g, i) => ({ id: `r${i}`, teamId: "A", playerId: `pA${i}`, salary: g }));
  const players = gehaelter.map((_, i) => ({ id: `pA${i}`, marketValue: (o.kaderMarktwerte?.A ?? 10) / gehaelter.length }));
  for (const [id, wert] of Object.entries(o.kaderMarktwerte ?? {})) {
    if (id === "A") continue;
    rosters.push({ id: `r-${id}`, teamId: id, playerId: `p-${id}`, salary: 5 });
    players.push({ id: `p-${id}`, marketValue: wert });
  }
  const teamIds = ["A", ...Object.keys(o.kaderMarktwerte ?? {}).filter((k) => k !== "A")];
  return {
    season: { id: o.saison ?? "season-2", currentMatchday: 1, matchdayIds: [], totalMatchdays: 20 },
    gamePhase: o.phase ?? "season_active",
    matchdayState: { status: "open" },
    teams: teamIds.map((id) => ({ teamId: id, name: id, cash: id === "A" ? (o.cash ?? 100) : 50 })),
    teamIdentities: teamIds.map((id) => ({ teamId: id, finances: 5, ambition: id === "A" ? (o.ambition ?? 5) : 5, playerOpt: 11 })),
    rosters,
    players,
    transferHistory: o.history ?? [],
    seasonState: {
      boardConfidence: { A: { teamId: "A", value: o.vertrauen ?? 3, pressure: 5, warnings: [] } },
      facilityEvents: o.facilityEvents ?? [],
      teamStrategyProfiles: { A: { bias: { riskTolerance: o.risiko ?? 5 } } },
      vorstandBudget: o.zustand ? { A: o.zustand } : undefined,
    },
  } as unknown as GameState;
}

const buy = (fee: number) => ({ id: "b", seasonId: "season-2", transferType: "buy", toTeamId: "A", fromTeamId: null, fee, salary: 5 });
const sell = (fee: number) => ({ id: "s", seasonId: "season-2", transferType: "sell", fromTeamId: "A", toTeamId: null, fee, salary: 5 });
const bau = (cost: number) => ({ eventId: "e", seasonId: "season-2", teamId: "A", facilityId: "arena", previousLevel: 0, nextLevel: 1, cost, source: "manual_facility_upgrade" });

describe("Gebaeude zahlen aus dem Investitionstopf (hart)", () => {
  it("Bau ueber dem freien Betrag ist gesperrt, darunter erlaubt; Mensch und KI gleich (eine Funktion)", () => {
    const gs = spielstand({ vertrauen: 3 });
    const frei = berechneVorstandBudgetStand(gs, "A").investition.frei;
    expect(pruefeGebaeudeGegenVorstandFreigabe(gs, "A", frei - 1).ok).toBe(true);
    const zuTeuer = pruefeGebaeudeGegenVorstandFreigabe(gs, "A", frei + 1);
    expect(zuTeuer.ok).toBe(false);
    expect(zuTeuer.reason).toBe("vorstand_transferbudget_nicht_freigegeben");
  });

  it("ein gebautes Gebaeude zaehlt als ausgegeben und mindert den Rest; die Kasse bleibt Anfangskasse", () => {
    const ohne = berechneVorstandBudgetStand(spielstand({ vertrauen: 7, cash: 100 }), "A");
    const mit = berechneVorstandBudgetStand(spielstand({ vertrauen: 7, cash: 80, facilityEvents: [bau(20)] }), "A");
    expect(mit.herleitung.anfangskasse).toBeCloseTo(ohne.herleitung.anfangskasse, 2);
    expect(mit.gebaeudeAusgegeben).toBe(20);
    expect(mit.ausgegeben).toBe(20);
    expect(mit.investition.frei).toBeCloseTo(ohne.investition.frei - 20, 1);
  });

  it("Gebaeude und Kaeufe teilen sich denselben Topf", () => {
    const gs = spielstand({ vertrauen: 7, cash: 60, history: [buy(20)], facilityEvents: [bau(20)] });
    const st = berechneVorstandBudgetStand(gs, "A");
    expect(st.ausgegeben).toBe(40);
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: st.investition.frei + 1, salary: 1, rosterBefore: 10, playerMin: 8 }).ok).toBe(false);
  });

  it("Sparauflage: keine Gebaeude, ausser mit „Alles auf eine Karte“", () => {
    const gs = spielstand({ vertrauen: 1.5 });
    const r = pruefeGebaeudeGegenVorstandFreigabe(gs, "A", 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("vorstand_gebaeude_sparauflage");
    const karte = beantrageAlleAufEineKarte(gs, "A", "ki", "Test");
    expect(karte.ok).toBe(true);
    expect(pruefeGebaeudeGegenVorstandFreigabe(karte.gameState, "A", 1).ok).toBe(true);
  });

  it("Saison 1 ist frei: nichts wird gesperrt", () => {
    const gs = spielstand({ saison: "season-1", vertrauen: 1 });
    expect(pruefeGebaeudeGegenVorstandFreigabe(gs, "A", 9999).ok).toBe(true);
  });
});

describe("Gehaltserhoehungen bei Verlaengerungen zaehlen gegen den Gehaltstopf (hart)", () => {
  it("nur die Erhoehung zaehlt; gleiches oder niedrigeres Gehalt geht immer", () => {
    const gs = spielstand({ vertrauen: 3 });
    const st = berechneVorstandBudgetStand(gs, "A");
    expect(pruefeVerlaengerungGegenVorstandFreigabe(gs, "A", { altesGehalt: 8, neuesGehalt: 8 + st.gehalt.frei - 0.5 }).ok).toBe(true);
    const zuViel = pruefeVerlaengerungGegenVorstandFreigabe(gs, "A", { altesGehalt: 8, neuesGehalt: 8 + st.gehalt.frei + 0.5 });
    expect(zuViel.ok).toBe(false);
    expect(zuViel.reason).toBe("vorstand_gehaltsbudget_nicht_freigegeben");
    expect(pruefeVerlaengerungGegenVorstandFreigabe(gs, "A", { altesGehalt: 8, neuesGehalt: 5 }).ok).toBe(true);
  });

  it("ueber dem Gehaltsbudget: Erhoehung gesperrt, gleiches Gehalt erlaubt, kein Zwangsverkauf", () => {
    const gs = spielstand({ vertrauen: 3, gehaelter: new Array(14).fill(9) });
    const st = berechneVorstandBudgetStand(gs, "A");
    expect(st.gehalt.frei).toBe(0);
    expect(pruefeVerlaengerungGegenVorstandFreigabe(gs, "A", { altesGehalt: 9, neuesGehalt: 9.5 }).ok).toBe(false);
    expect(pruefeVerlaengerungGegenVorstandFreigabe(gs, "A", { altesGehalt: 9, neuesGehalt: 9 }).ok).toBe(true);
  });

  it("Saison 1 ist frei", () => {
    expect(pruefeVerlaengerungGegenVorstandFreigabe(spielstand({ saison: "season-1" }), "A", { altesGehalt: 1, neuesGehalt: 99 }).ok).toBe(true);
  });
});

describe("Umschichten (1 C Transfer = 1 C Jahresgehalt)", () => {
  it("schiebt genau den Betrag zwischen den Toepfen und haelt die Grenze am Gehaltstopf", () => {
    const gs = spielstand({ vertrauen: 7, cash: 120 });
    const vor = berechneVorstandBudgetStand(gs, "A");
    expect(vor.umschichten.grenzeAnteil).toBe(0.25);
    const r = setzeUmschichtung(gs, "A", 4);
    expect(r.ok).toBe(true);
    const nach = r.stand!;
    expect(nach.gehalt.gesamt - vor.gehalt.gesamt).toBeCloseTo(4, 2);
    expect(vor.investition.gesamt - nach.investition.gesamt).toBeCloseTo(4, 2);
    // Zurücknehmen
    expect(berechneVorstandBudgetStand(setzeUmschichtung(r.gameState, "A", 0).gameState, "A").gehalt.gesamt).toBeCloseTo(vor.gehalt.gesamt, 2);
  });

  it("lehnt Betraege ueber der Grenze ab und kennt Quote 85 / 70 / 50 -> 20 / 15 / 10 %", () => {
    expect(berechneVorstandBudgetStand(spielstand({ vertrauen: 5 }), "A").umschichten.grenzeAnteil).toBe(0.2);
    expect(berechneVorstandBudgetStand(spielstand({ vertrauen: 3 }), "A").umschichten.grenzeAnteil).toBe(0.15);
    expect(berechneVorstandBudgetStand(spielstand({ vertrauen: 1 }), "A").umschichten.grenzeAnteil).toBe(0.1);
    const gs = spielstand({ vertrauen: 7, cash: 400 });
    const grenze = berechneVorstandBudgetStand(gs, "A").umschichten.grenze;
    const r = setzeUmschichtung(gs, "A", grenze + 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ueber_der_grenze");
  });

  it("Gehalt -> Transfer geht nur im Fenster, Transfer -> Gehalt jederzeit", () => {
    const imSpiel = spielstand({ vertrauen: 7, cash: 120, phase: "season_active" });
    imSpiel.season.currentMatchday = 6;
    (imSpiel as unknown as { matchdayState: { status: string } }).matchdayState.status = "resolved";
    expect(setzeUmschichtung(imSpiel, "A", -1).reason).toBe("nur_im_fenster");
    expect(setzeUmschichtung(imSpiel, "A", 1).ok).toBe(true);
  });

  it("Saison 1: nicht aktiv", () => {
    expect(setzeUmschichtung(spielstand({ saison: "season-1" }), "A", 1).reason).toBe("nicht_aktiv");
  });
});

describe("Lockerung nach Verkaeufen", () => {
  it("greift erst ab der Schwelle (einbehaltener Anteil >= Puffer), eine Stufe, nie mehr als verkauft", () => {
    const basis = berechneVorstandBudgetStand(spielstand({ vertrauen: 3, cash: 100 }), "A");
    expect(basis.lockerung.aktiv).toBe(false);
    expect(basis.lockerung.vonAnteil).toBe(0.7);
    expect(basis.lockerung.nachAnteil).toBe(0.85);
    const schwelle = basis.lockerung.schwelle;
    expect(schwelle).toBeGreaterThan(0);
    // knapp darunter
    const darunter = berechneVorstandBudgetStand(spielstand({ vertrauen: 3, cash: 100 + schwelle - 2, history: [sell(schwelle - 2)] }), "A");
    expect(darunter.lockerung.aktiv).toBe(false);
    expect(darunter.lockerung.fehlt).toBeGreaterThan(0);
    // ab der Schwelle
    const darueber = berechneVorstandBudgetStand(spielstand({ vertrauen: 3, cash: 100 + schwelle + 1, history: [sell(schwelle + 1)] }), "A");
    expect(darueber.lockerung.aktiv).toBe(true);
    expect(darueber.wirksamerAnteil).toBe(0.85);
    const ohneLockerung = 0.7 * (darueber.herleitung.verfuegbar + (schwelle + 1));
    expect(darueber.investition.gesamt).toBeGreaterThan(ohneLockerung);
    expect(darueber.investition.gesamt - ohneLockerung).toBeLessThanOrEqual(schwelle + 1 + 0.01);
    // Boden: die Kasse bleibt ueber Ruecklage + Puffer + X
    expect(darueber.investition.frei).toBeLessThanOrEqual(Math.max(0, 100 + schwelle + 1 - darueber.lockerung.boden) + 0.01);
  });

  it("keine Lockerung bei Quote 100 %, bei Kasse im Minus und in Saison 1", () => {
    expect(berechneVorstandBudgetStand(spielstand({ vertrauen: 7 }), "A").lockerung.gesperrtGrund).toContain("voll freigegeben");
    expect(berechneVorstandBudgetStand(spielstand({ vertrauen: 3, cash: -5, history: [sell(80)] }), "A").lockerung.aktiv).toBe(false);
    expect(berechneVorstandBudgetStand(spielstand({ vertrauen: 3, saison: "season-1" }), "A").lockerung.aktiv).toBe(false);
  });
});

describe("Ruecklage anzapfen", () => {
  it("holt bis 50 % des Ziels in den Topf (zur Quote) und kostet 0,25 Vertrauen je angefangenem Viertel", () => {
    const gs = spielstand({ vertrauen: 3, cash: 120 });
    const vor = berechneVorstandBudgetStand(gs, "A");
    const ziel = vor.herleitung.ruecklageZiel;
    expect(vor.ruecklageAnzapfen.moeglich).toBeCloseTo(ziel * 0.5, 1);
    const r = zapfeRuecklageAn(gs, "A", 100);
    expect(r.ok).toBe(true);
    const nach = r.stand!;
    expect(nach.herleitung.angezapft).toBeCloseTo(ziel * 0.5, 1);
    expect(nach.investition.gesamt - vor.investition.gesamt).toBeCloseTo(0.7 * ziel * 0.5, 1);
    // 50 % des Ziels = zwei Viertel = 0,5 Vertrauen
    expect(nach.ruecklageAnzapfen.vertrauenskosten).toBeCloseTo(0.5, 2);
    expect(zapfeRuecklageAn(gs, "A", ziel * 0.1).stand!.ruecklageAnzapfen.vertrauenskosten).toBeCloseTo(0.25, 2);
  });

  it("die Kosten wirken erst bei der naechsten Festlegung: die Quote dieser Saison bleibt", () => {
    const gs = spielstand({ vertrauen: 4.1, cash: 120 });
    const r = zapfeRuecklageAn(gs, "A", 100);
    expect(r.stand!.anteil).toBe(0.85);
    // Das Vertrauensziel traegt den Abzug in die Abrechnung
    expect(r.gameState.seasonState.vorstandBudget?.A?.vertrauensKosten).toBeCloseTo(0.5, 2);
  });

  it("nur im Fenster und nicht in Saison 1", () => {
    expect(zapfeRuecklageAn(spielstand({ saison: "season-1" }), "A", 5).reason).toBe("nicht_aktiv");
    const imSpiel = spielstand({ phase: "season_active" });
    imSpiel.season.currentMatchday = 6;
    (imSpiel as unknown as { matchdayState: { status: string } }).matchdayState.status = "resolved";
    expect(zapfeRuecklageAn(imSpiel, "A", 5).reason).toBe("nur_im_fenster");
  });
});

describe("Alles auf eine Karte", () => {
  it("gibt alles bis auf 5 % Puffer frei, Quote 100 %, Rücklage und Puffer entfallen", () => {
    const gs = spielstand({ vertrauen: 5, cash: 100 });
    const vor = berechneVorstandBudgetStand(gs, "A");
    const r = beantrageAlleAufEineKarte(gs, "A", "mensch");
    expect(r.ok).toBe(true);
    const nach = r.stand!;
    expect(nach.alleAufEineKarte.aktiv).toBe(true);
    expect(nach.wirksamerAnteil).toBe(1);
    expect(nach.investition.frei).toBeCloseTo(100 * (1 - ALLES_PUFFER_ANTEIL), 1);
    expect(nach.investition.frei).toBeGreaterThan(vor.investition.frei);
    expect(nach.gehalt.quote).toBe(1);
    // ein Kauf, der vorher gesperrt war, geht jetzt durch
    const teuer = vor.investition.frei + 5;
    expect(pruefeKaufGegenVorstandFreigabe(gs, "A", { fee: teuer, salary: 1, rosterBefore: 10, playerMin: 8 }).ok).toBe(false);
    expect(pruefeKaufGegenVorstandFreigabe(r.gameState, "A", { fee: teuer, salary: 1, rosterBefore: 10, playerMin: 8 }).ok).toBe(true);
  });

  it("der Vorstand lehnt einen Antrag unter Vertrauen 4 ab, mit Begruendung, ohne Geldstrafe", () => {
    const gs = spielstand({ vertrauen: 3 });
    const r = beantrageAlleAufEineKarte(gs, "A", "mensch");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("vorstand_lehnt_ab");
    expect(r.meldung).toContain("lehnt ab");
    expect(berechneVorstandBudgetStand(r.gameState, "A").alleAufEineKarte.aktiv).toBe(false);
    expect(r.gameState.teams.find((t) => t.teamId === "A")!.cash).toBe(100);
  });

  it("nur einmal je Saison, nur im Fenster, nicht in Saison 1", () => {
    const gs = spielstand({ vertrauen: 5 });
    const eins = beantrageAlleAufEineKarte(gs, "A", "mensch");
    expect(beantrageAlleAufEineKarte(eins.gameState, "A", "mensch").reason).toBe("schon_aktiv");
    expect(beantrageAlleAufEineKarte(spielstand({ saison: "season-1" }), "A", "mensch").reason).toBe("nicht_aktiv");
    // In der naechsten Saison ist der Zustand weg: der Vorstand rechnet neu
    const naechste = { ...eins.gameState, season: { ...eins.gameState.season, id: "season-3" } } as GameState;
    expect(berechneVorstandBudgetStand(naechste, "A").alleAufEineKarte.aktiv).toBe(false);
  });

  it("friert das Ziel ein: Endrang um zwei Plaetze besser als die Kader-Erwartung", () => {
    const gs = spielstand({ vertrauen: 7, kaderMarktwerte: { A: 10, B: 30, C: 40, D: 50, E: 60 } });
    const r = beantrageAlleAufEineKarte(gs, "A", "mensch");
    const karte = r.stand!.alleAufEineKarte.zustand!;
    expect(karte.erwartungsRang).toBe(5);
    expect(karte.zielRang).toBe(3);
    expect(karte.quelle).toBe("mensch");
  });

  it("der Vorstand fordert es von Top-Teams mit sehr hohem Vertrauen und das Team nimmt an", () => {
    const top = spielstand({ vertrauen: 9, kaderMarktwerte: { A: 90, B: 30, C: 40, D: 50 } });
    expect(vorstandFordertAlleAufEineKarte(top, "A")).toBe(true);
    expect(beantrageAlleAufEineKarte(top, "A", "vorstand").ok).toBe(true);
    const schwach = spielstand({ vertrauen: 9, kaderMarktwerte: { A: 5, B: 30, C: 40, D: 50 } });
    expect(vorstandFordertAlleAufEineKarte(schwach, "A")).toBe(false);
    expect(beantrageAlleAufEineKarte(schwach, "A", "vorstand").reason).toBe("vorstand_fordert_nicht");
    expect(vorstandFordertAlleAufEineKarte(spielstand({ vertrauen: 6, kaderMarktwerte: { A: 90, B: 30 } }), "A")).toBe(false);
  });
});

describe("KI-Entscheidung (dieselben Regeln wie der Mensch)", () => {
  it("Charakter aus der Risikobereitschaft", () => {
    expect(kiCharakter(spielstand({ risiko: 2 }), "A")).toBe("vorsichtig");
    expect(kiCharakter(spielstand({ risiko: 5 }), "A")).toBe("normal");
    expect(kiCharakter(spielstand({ risiko: 9 }), "A")).toBe("aggressiv");
  });

  it("vorsichtige KI schichtet nie um und wettet nie", () => {
    const gs = spielstand({ risiko: 2, vertrauen: 7, cash: 300, gehaelter: new Array(14).fill(9), kaderMarktwerte: { A: 90, B: 30 } });
    const r = entscheideKiVorstandMassnahmen(gs, "A");
    expect(r.massnahmen).toHaveLength(0);
  });

  it("aggressives Top-Team mit hoher Ambition wettet, begruendet und genau einmal", () => {
    const gs = spielstand({ risiko: 9, ambition: 9, vertrauen: 7, cash: 150, kaderMarktwerte: { A: 90, B: 30, C: 40 } });
    const r = entscheideKiVorstandMassnahmen(gs, "A");
    expect(r.massnahmen.map((m) => m.art)).toEqual(["alles_auf_eine_karte"]);
    const karte = berechneVorstandBudgetStand(r.gameState, "A").alleAufEineKarte.zustand!;
    expect(["ki", "vorstand"]).toContain(karte.quelle);
    expect(karte.grund.length).toBeGreaterThan(10);
    // ein zweites Mal in derselben Saison: nichts mehr
    expect(entscheideKiVorstandMassnahmen(r.gameState, "A").massnahmen).toHaveLength(0);
  });

  it("ein schwaches oder ruhiges Team wettet nicht (selten und begruendet)", () => {
    const schwach = spielstand({ risiko: 9, ambition: 9, vertrauen: 7, kaderMarktwerte: { A: 5, B: 30, C: 40, D: 50, E: 60 } });
    expect(entscheideKiVorstandMassnahmen(schwach, "A").massnahmen.map((m) => m.art)).not.toContain("alles_auf_eine_karte");
    const ruhig = spielstand({ risiko: 5, ambition: 5, vertrauen: 7, kaderMarktwerte: { A: 90, B: 30 } });
    expect(entscheideKiVorstandMassnahmen(ruhig, "A").massnahmen.map((m) => m.art)).not.toContain("alles_auf_eine_karte");
  });

  it("in Saison 1 und ausserhalb des Fensters tut die KI nichts", () => {
    expect(entscheideKiVorstandMassnahmen(spielstand({ saison: "season-1", risiko: 9 }), "A").massnahmen).toHaveLength(0);
    const imSpiel = spielstand({ risiko: 9, ambition: 9, vertrauen: 9, phase: "season_active", kaderMarktwerte: { A: 90, B: 30 } });
    imSpiel.season.currentMatchday = 6;
    (imSpiel as unknown as { matchdayState: { status: string } }).matchdayState.status = "resolved";
    expect(entscheideKiVorstandMassnahmen(imSpiel, "A").massnahmen).toHaveLength(0);
  });
});

describe("Seitenmodell", () => {
  it("Verlauf: Start, Spieltage, Ende; die Kasse am Ende ist die Prognose, Gehaelter je Saison und je Spieltag", () => {
    const gs = spielstand({ vertrauen: 7, cash: 90, history: [{ ...buy(10), matchdayId: null, netCashImpact: 10, happenedAt: "2026-01-01T00:00:00Z", playerId: "x" }] });
    const m = buildFinanzSeiteModell(gs, "A", { status: "not_ready" });
    expect(m.verlauf[0]!.art).toBe("start");
    expect(m.verlauf[m.verlauf.length - 1]!.art).toBe("ende");
    expect(m.verlauf).toHaveLength(22);
    expect(m.gehaltSaison).toBe(72);
    expect(m.gehaltJeSpieltag).toBeCloseTo(3.6, 2);
    expect(m.verlauf[0]!.kasse).toBeCloseTo(90, 1);
    expect(m.stand.teamId).toBe("A");
    expect(m.lage.titel).toBeTruthy();
  });

  it("OLY_VORSTAND_BUDGET=0 schaltet alles aus (nichts wird gesperrt)", () => {
    process.env.OLY_VORSTAND_BUDGET = "0";
    const gs = spielstand({ vertrauen: 1 });
    expect(berechneVorstandBudgetStand(gs, "A").gedeckelt).toBe(false);
    expect(pruefeGebaeudeGegenVorstandFreigabe(gs, "A", 999).ok).toBe(true);
  });
});
