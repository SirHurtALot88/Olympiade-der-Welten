/**
 * DRAFT BEENDET (21.11.): die Datenaufbereitung der Ergebnis-Ansicht. Reine Funktion, keine Datenbank.
 * Geprüft: Rang in der EIGENEN Liga (nicht unter allen Teams), Achsen gegen den Liga-Schnitt, Bedarf/Abdeckung, Verträge,
 * Liga-Übersicht mit offenen Werten, Budget aus der Vorstandsrechnung.
 */
import { describe, expect, it } from "vitest";

import { baueDraftErgebnis, besteSechs } from "@/app/foundation/draft-modern/draft-ergebnis";

const D = ["hockey", "basketball"];

function spieler(id: string, hockey: number, basketball: number, pow = 50) {
  return {
    id,
    name: `S-${id}`,
    className: "Charger",
    race: "Dragon",
    rating: 50,
    ovr: 60,
    coreStats: { pow, spe: 40, men: 30, soc: 20 },
    disciplineRatings: { hockey, basketball },
    marketValue: 10,
    salaryDemand: 2,
  };
}

function fixture() {
  const players = [spieler("a", 80, 40, 70), spieler("b", 60, 70, 60), spieler("c", 30, 30), spieler("d", 90, 90, 90), spieler("e", 50, 50)];
  const teams = [
    { teamId: "T1", shortCode: "T1", name: "Eins", cash: 12, budget: 100 },
    { teamId: "T2", shortCode: "T2", name: "Zwei", cash: 30, budget: 100 },
    { teamId: "T3", shortCode: "T3", name: "Drei (Liga 1)", cash: 5, budget: 300 },
  ];
  const rosters = [
    { teamId: "T1", playerId: "a", contractLength: 2, contractEndSeasonNumber: 2, salary: 3 },
    { teamId: "T1", playerId: "b", contractLength: 1, contractEndSeasonNumber: 1, salary: 2 },
    { teamId: "T2", playerId: "c", contractLength: 1, contractEndSeasonNumber: 1, salary: 1 },
    { teamId: "T3", playerId: "d", contractLength: 1, contractEndSeasonNumber: 1, salary: 4 },
    { teamId: "T3", playerId: "e", contractLength: 1, contractEndSeasonNumber: 1, salary: 1 },
  ];
  const gameState = {
    season: { id: "season-1", name: "Saison 1" },
    seasonState: { leagueByTeamId: { T1: "liga2", T2: "liga2", T3: "liga1" } },
    players,
    rosters,
    teams,
  } as never;
  const verlauf = [
    { nr: 1, art: "pick", teamId: "T1", playerId: "a", runde: 1, pickNr: 5, quelle: "mensch", abloese: 10, gehalt: 3 },
    { nr: 2, art: "pick", teamId: "T1", playerId: "b", runde: 2, pickNr: 40, quelle: "mensch", abloese: 6, gehalt: 2 },
    { nr: 3, art: "pick", teamId: "T2", playerId: "c", runde: 1, pickNr: 6, quelle: "ki", abloese: 4, gehalt: 1 },
    { nr: 4, art: "pick", teamId: "T3", playerId: "d", runde: 1, pickNr: 1, quelle: "ki", abloese: 50, gehalt: 4 },
    { nr: 5, art: "pick", teamId: "T3", playerId: "e", runde: 2, pickNr: 33, quelle: "ki", abloese: 8, gehalt: 1 },
  ];
  const t = (teamId: string, name: string, kaderStaerke: number, abl: number, geh: number, kasse: number, kader: number, picks: number) => ({
    teamId,
    name,
    kuerzel: teamId,
    kaderStaerke,
    abloeseSumme: abl,
    gehaltSumme: geh,
    kasse,
    kader,
    picks,
  });
  const ansicht = {
    regeln: { minKader: 2, maxPicksJeTeam: 4 },
    verlauf,
    spieler: {},
    teams: [t("T1", "Eins", 40, 16, 5, 12, 2, 2), t("T2", "Zwei", 30, 4, 1, 30, 1, 1), t("T3", "Drei (Liga 1)", 80, 58, 5, 5, 2, 2)],
    mein: { teamId: "T1", kasse: 12, kader: 2 },
  } as never;
  const budget = () =>
    ({
      wirksamerAnteil: 0.9,
      gedeckelt: true,
      grund: "Vorstandsvertrauen 5.0",
      herleitung: { ruecklageZiel: 2, gehaltspuffer: 1 },
      investition: { frei: 7.5 },
      gehalt: { gesamt: 10, frei: 5 },
    }) as never;
  return { gameState, ansicht, budget };
}

describe("Draft-Ergebnis: Daten", () => {
  const { gameState, ansicht, budget } = fixture();
  const d = baueDraftErgebnis({ gameState, ansicht, disziplinIds: D, budget })!;

  it("Rang der Kaderstärke zählt nur die eigene Liga (Liga 1 stört nicht)", () => {
    expect(d.ligaName).toBe("Liga 2");
    expect(d.ligaGroesse).toBe(2);
    expect(d.staerke.rang).toBe(1);
    expect(d.staerke.rangleiste.map((t) => t.teamId)).toEqual(["T1", "T2"]);
    expect(d.staerke.schnitt).toBe(35);
    // Hockey: T1 hat a=80,b=60 gegen T2 mit c=30 -> Rang 1 in Liga 2 (T3 mit 90 zählt nicht)
    expect(d.disziplinen.find((x) => x.disziplinId === "hockey")!.rang).toBe(1);
  });

  it("eigener Kader: Pick, Vertrag, Top-Disziplinen, Zahlen ohne Noten", () => {
    expect(d.spieler.map((s) => s.playerId).sort()).toEqual(["a", "b"]);
    const a = d.spieler.find((s) => s.playerId === "a")!;
    expect(a).toMatchObject({ runde: 1, pickNr: 5, pow: 70, gehalt: 3, abloese: 10, vertragLauf: 2, vertragEndeSaison: 2 });
    expect(a.top[0]).toEqual({ disziplinId: "hockey", wert: 80 });
    expect(d.vertraege).toEqual([
      { endeSaison: 1, spieler: 1, gehalt: 2 },
      { endeSaison: 2, spieler: 1, gehalt: 3 },
    ]);
  });

  it("Achsen: eigener Schnitt gegen alle Spieler der eigenen Liga", () => {
    const pow = d.achsen.find((x) => x.id === "pow")!;
    expect(pow.wert).toBe(65);
    // Liga 2 = a(70), b(60), c(50) -> 60; d(90) aus Liga 1 zählt nicht
    expect(pow.liga).toBe(60);
  });

  it("Bedarf: schwächste Disziplinen zuerst, Abdeckung ab Eignung 45", () => {
    const basket = d.disziplinen.find((x) => x.disziplinId === "basketball")!;
    expect(basket.abdeckung).toBe(1);
    expect(d.bedarf[0]!.disziplinId).toBe("basketball");
  });

  it("Liga-Übersicht trägt Gehalt/Kasse aller Teams, teuersten Pick und Liga", () => {
    const t3 = d.teams.find((t) => t.teamId === "T3")!;
    expect(t3).toMatchObject({ liga: 1, kasse: 5, gehalt: 5, abloese: 58 });
    expect(t3.teuersterPick).toEqual({ abloese: 50, name: "S-d" });
    expect(d.teams.find((t) => t.ich)!.teamId).toBe("T1");
  });

  it("Kasse kommt aus der Vorstandsrechnung; Vergleich rangiert in der eigenen Liga", () => {
    expect(d.kasse).toMatchObject({ kasse: 12, abloesen: 16, gehaltSumme: 5, gehaltTopf: 10, gehaltFrei: 5, ruecklage: 2, gehaltspuffer: 1, freigabeAnteil: 0.9, restbudget: 7.5, pflichtMin: 2, kaderMax: 4 });
    expect(d.kasse.gehaltAnteil).toBe(0.5);
    const kasse = d.vergleich.find((v) => v.id === "kasse")!;
    expect(kasse).toMatchObject({ rang: 2, von: 2 });
    expect(d.vergleich.find((v) => v.id === "abloese")!.schnitt).toBe(10);
  });

  it("beste Sechs: nach Eignung sortiert, Stärke wie die Kaderstärke (fehlende Plätze zählen 20)", () => {
    const b = besteSechs(d.eignungen, "hockey");
    expect(b.liste.map((x) => x.playerId)).toEqual(["a", "b"]);
    expect(b.staerke).toBeCloseTo((80 + 60 + 4 * 20) / 6, 5);
  });

  it("ohne eigenes Team keine Ergebnis-Daten", () => {
    const f = fixture();
    expect(baueDraftErgebnis({ gameState: f.gameState, ansicht: { ...(f.ansicht as object), mein: null } as never, disziplinIds: D, budget: f.budget })).toBeNull();
  });
});
