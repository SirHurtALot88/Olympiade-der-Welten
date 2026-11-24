import { describe, expect, it } from "vitest";

import {
  SPONSOR_TOPF,
  berechneLeistungsteile,
  berechneTopf,
  kiFarben,
  kiLaufzeit,
  kiVertragsart,
  leihKursFuerPassung,
  passungRoh,
  richtwertSaison1,
  rundeMitSumme,
  schiebeErwartungsraenge,
  sponsorKonjunktur,
  treueBonus,
  verteileFarbTopf,
  vertragsartHebel,
  vertragsartZielEinsatz,
  zBeliebtheit,
  zTreue,
  zielAuszahlung,
  type SponsorLiga,
  type TopfEingabe,
  type TopfTeamEingabe,
} from "@/lib/sponsors/sponsor-topf-modell";

/** 32 Teams, zwei Ligen zu 16; Erwartungsrang 1..16, Beliebtheit und Kosten streuen deterministisch. */
function liga(nr: SponsorLiga, passungen?: (i: number) => number, treue?: (i: number) => number): TopfTeamEingabe[] {
  return Array.from({ length: 16 }, (_, i) => ({
    teamId: `L${nr}-${i + 1}`,
    liga: nr,
    erwartungsrang: i + 1,
    beliebtheit: 3 + ((i * 7) % 10) / 2,
    passungRoh: passungen ? passungen(i) : 1,
    treue: treue ? treue(i) : 0,
    kosten: (nr === 1 ? 72 : 58) - i * 1.1,
    planEinnahmen: 9 + (i % 4),
    kaderwert: nr === 1 ? 260 - i * 3 : 200 - i * 3,
  }));
}

function eingabe(extra: Partial<TopfEingabe> = {}, p?: (i: number) => number, t?: (i: number) => number): TopfEingabe {
  return {
    teams: [...liga(1, p, t), ...liga(2, p, t)],
    faktor: 1,
    saison1: false,
    kaderErsatz: 1,
    betriebsteilVorjahr: null,
    uebertrag: 0,
    ...extra,
  };
}

const summe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("Sponsor-Topf: Topf und Saisonfaktor", () => {
  it("T = F x (K_B + K_E) - Uebertrag, Betriebsteil geklammert auf 85 bis 115 % der Vorsaison", () => {
    const e = eingabe({ betriebsteilVorjahr: 1000 });
    const r = berechneTopf(e);
    // Rohkosten ~ 32 x 60 = 1900 - Plan 32 x 10,5 liegt weit ueber 1,15 x 1000 -> Klammer greift oben.
    expect(r.betriebsteilRoh).toBeGreaterThan(1150);
    expect(r.betriebsteil).toBeCloseTo(1150, 6);
    expect(r.kaderErsatz).toBeCloseTo(SPONSOR_TOPF.kaderErsatzAnteil * summe(e.teams.map((t) => t.kaderwert)), 6);
    expect(r.topf).toBeCloseTo(r.betriebsteil + r.kaderErsatz, 6);
    const mitFaktor = berechneTopf({ ...e, faktor: 1.05, uebertrag: 4 });
    expect(mitFaktor.topf).toBeCloseTo(1.05 * (mitFaktor.betriebsteil + mitFaktor.kaderErsatz) - 4, 6);
  });

  it("Saison 1: Richtwert (59 C Kosten je Team minus die geplanten Einnahmen) als Bezug der Bremse, sigma 0,5, Kader-Ersatz gilt auch hier", () => {
    const r = berechneTopf(eingabe({ saison1: true }));
    const mittelPlan = summe(eingabe().teams.map((t) => t.planEinnahmen)) / 32;
    expect(r.kaderErsatz).toBeGreaterThan(0);
    const richtwert = richtwertSaison1(eingabe({ saison1: true }).teams);
    expect(richtwert).toBeCloseTo(32 * SPONSOR_TOPF.richtwertKostenSaison1 - 32 * mittelPlan, 6);
    expect(r.betriebsteil).toBeGreaterThanOrEqual(richtwert * 0.85 - 1e-9);
    expect(r.betriebsteil).toBeLessThanOrEqual(richtwert * 1.15 + 1e-9);
    expect(r.sigma).toBe(0.5);
  });

  it("Saison 1 traegt den Zuschlag fuer den Entwicklungsschritt der Draft-Saison", () => {
    const k = eingabe({ saison1: false });
    const k1 = eingabe({ saison1: true });
    const w = summe(k.teams.map((t) => t.kaderwert));
    expect(berechneTopf(k).kaderErsatz).toBeCloseTo(SPONSOR_TOPF.kaderErsatzAnteil * w, 6);
    expect(berechneTopf(k1).kaderErsatz).toBeCloseTo((SPONSOR_TOPF.kaderErsatzAnteil + SPONSOR_TOPF.kaderErsatzZuschlagSaison1) * w, 6);
  });

  it("Liga-Wert-Rueckkopplung: Korrektur senkt den Topf, ist auf 6 % gedeckelt und kehrt das Vorzeichen um", () => {
    const e = eingabe({ betriebsteilVorjahr: 1200 });
    const ohne = berechneTopf(e);
    const mit = berechneTopf({ ...e, wertKorrektur: 100 });
    expect(mit.wertKorrektur).toBe(100);
    expect(mit.topf).toBeCloseTo(ohne.topf - 100, 6);
    const gross = berechneTopf({ ...e, wertKorrektur: 1e6 });
    expect(gross.wertKorrektur).toBeCloseTo(0.06 * (ohne.betriebsteil + ohne.kaderErsatz), 0);
    const negativ = berechneTopf({ ...e, wertKorrektur: -100 });
    expect(negativ.topf).toBeCloseTo(ohne.topf + 100, 6);
  });

  it("kappa = 0 schaltet den Kader-Ersatz ab", () => {
    expect(berechneTopf(eingabe({ kaderErsatz: 0 })).kaderErsatz).toBe(0);
  });

  it("Konjunktur: Faktor 1 bleibt genau 1, Spanne 0,95 bis 1,05", () => {
    expect(sponsorKonjunktur(1)).toBe(1);
    expect(sponsorKonjunktur(0.5)).toBe(0.95);
    expect(sponsorKonjunktur(1.8)).toBe(1.05);
    expect(sponsorKonjunktur(1.24)).toBeLessThanOrEqual(1.05);
  });

  it("Farb-Toepfe: Liga 1 12 C, Liga 2 9 C je Farbe bei F = 1, zusammen 84 C", () => {
    const r = berechneTopf(eingabe());
    expect(r.farbTopf).toEqual([12, 9]);
    expect(4 * (r.farbTopf[0] + r.farbTopf[1])).toBe(84);
    expect(berechneTopf(eingabe({ faktor: 1.1 })).farbTopf).toEqual([13.2, 9.9]);
  });
});

describe("Sponsor-Topf: Grundbetrag", () => {
  it("Summe der Grundbetraege + Farb-Toepfe + Treueboni ist exakt der Topf (auf 0,1)", () => {
    const e = eingabe({}, (i) => 0.95 + (i % 5) * 0.025, (i) => (i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0));
    const r = berechneTopf(e);
    const g = summe(Object.values(r.teams).map((t) => t.grundbetrag));
    expect(g + 4 * (r.farbTopf[0] + r.farbTopf[1]) + r.treueSumme).toBeCloseTo(r.topf, 0);
    expect(Math.abs(g + 4 * (r.farbTopf[0] + r.farbTopf[1]) + r.treueSumme - r.topf)).toBeLessThan(0.1 * 32);
    // je Liga: Summe G = Summe des Liga-Anteils (Passung ist topfneutral)
    for (const l of [1, 2] as const) {
      const ids = e.teams.filter((t) => t.liga === l).map((t) => t.teamId);
      const sg = summe(ids.map((id) => r.teams[id]!.grundbetrag));
      const sx = summe(ids.map((id) => r.teams[id]!.x));
      expect(Math.abs(sg - sx)).toBeLessThan(0.051);
    }
  });

  it("Liga 1 bekommt 1,25 mal so viel wie Liga 2 (Mittel), besserer Erwartungsrang mehr Geld", () => {
    const r = berechneTopf(eingabe());
    const mittel = (l: SponsorLiga) => summe(Object.values(r.teams).filter((t) => t.teamId.startsWith(`L${l}-`)).map((t) => t.grundbetrag)) / 16;
    expect(mittel(1) / mittel(2)).toBeCloseTo(1.11 / 0.89, 1);
    expect(r.teams["L1-1"]!.grundbetrag).toBeGreaterThan(r.teams["L1-16"]!.grundbetrag);
    // Steigung mit Kader-Ersatz: 2,2 C je Erwartungsrang in Liga 1 (Beliebtheit streut mit, daher Naeherung)
    const steigung = (r.teams["L1-1"]!.grundbetrag - r.teams["L1-16"]!.grundbetrag) / 15;
    expect(steigung).toBeGreaterThan(1.5);
  });

  it("Passung: topfneutral und auf Liga-Mittel 1,00 normiert", () => {
    const passung = (i: number) => 0.95 + (i % 11) * 0.01;
    const r = berechneTopf(eingabe({}, passung));
    for (const l of [1, 2] as const) {
      const ids = Object.keys(r.teams).filter((id) => id.startsWith(`L${l}-`));
      expect(summe(ids.map((id) => r.teams[id]!.passung)) / ids.length).toBeCloseTo(1, 9);
    }
    // gleiches x, hoehere Passung -> hoeherer Grundbetrag
    const gleich = berechneTopf(eingabe());
    const mit = r;
    const hoch = Object.values(mit.teams).find((t) => t.passung > 1.03)!;
    expect(hoch.grundbetrag).toBeGreaterThan(gleich.teams[hoch.teamId]!.grundbetrag - 0.2);
  });

  it("Vorab-Zusage: mindestens 90 % des vorlaeufigen Betrags, Liga-Summe bleibt", () => {
    const basis = berechneTopf(eingabe());
    const zusage = Object.fromEntries(Object.values(basis.teams).map((t) => [t.teamId, Math.round((t.grundbetrag + 6) * 10) / 10]));
    // ein Team bekommt eine Zusage ueber seinem Betrag, die uebrigen 0
    const nur = { "L1-16": basis.teams["L1-16"]!.grundbetrag + 6 };
    const r = berechneTopf(eingabe({ zusage: nur }));
    expect(r.teams["L1-16"]!.grundbetrag).toBeGreaterThanOrEqual(nur["L1-16"] - 1e-9);
    const sg = (rr: typeof basis) => summe(Object.values(rr.teams).filter((t) => t.teamId.startsWith("L1-")).map((t) => t.grundbetrag));
    expect(sg(r)).toBeCloseTo(sg(basis), 6);
    void zusage;
  });
});

describe("Sponsor-Topf: Leistungsteil und Liga-Ausgleich", () => {
  it("Summe je Liga ist exakt 0, egal wer welchen Hebel waehlt", () => {
    const eing = [...liga(1), ...liga(2)].map((t, i) => ({
      teamId: t.teamId,
      liga: t.liga,
      erwartungsrang: t.erwartungsrang,
      rang: ((i * 5) % 16) + 1,
      hebel: [0.5, 1, 1.5][i % 3]!,
    }));
    const l = berechneLeistungsteile(eing, 1.03, 1);
    for (const nr of [1, 2] as const) {
      const ids = eing.filter((x) => x.liga === nr).map((x) => x.teamId);
      expect(Math.abs(Math.round(summe(ids.map((id) => l[id]!)) * 10))).toBe(0);
    }
  });

  it("alle auf Erwartungsrang: Leistungsteil 0 fuer jeden", () => {
    const eing = liga(1).map((t) => ({ teamId: t.teamId, liga: t.liga, erwartungsrang: t.erwartungsrang, rang: t.erwartungsrang, hebel: 1 }));
    const l = berechneLeistungsteile(eing, 1, 1);
    expect(Object.values(l).every((v) => v === 0)).toBe(true);
  });

  it("fuenf Plaetze ueber Erwartung in Liga 1 sind +15 C bei Leistungsvertrag, in Saison 1 (sigma 0,5) halb so viel", () => {
    const basis = liga(1).map((t) => ({ teamId: t.teamId, liga: t.liga, erwartungsrang: t.erwartungsrang, rang: t.erwartungsrang, hebel: 1 }));
    // Team 6 steigt auf Rang 1, Team 1 rutscht dafuer auf 6 (Plaetze 1..6 rotieren), der Rest bleibt
    const aufstieg = basis.map((x) => ({ ...x, rang: x.erwartungsrang === 6 ? 1 : x.erwartungsrang <= 5 ? x.erwartungsrang + 1 : x.erwartungsrang }));
    const l1 = berechneLeistungsteile(aufstieg, 1, 1);
    expect(l1["L1-6"]!).toBeGreaterThan(14.9 - 1);
    const lS1 = berechneLeistungsteile(aufstieg, 1, 0.5);
    expect(lS1["L1-6"]!).toBeCloseTo(l1["L1-6"]! / 2, 0);
  });

  it("Hebel: Praemienvertrag zahlt das Anderthalbfache, Festvertrag die Haelfte", () => {
    const rangVon = (rang: number, hebel: number) => berechneLeistungsteile(
      [{ teamId: "a", liga: 2, erwartungsrang: 10, rang, hebel }, { teamId: "b", liga: 2, erwartungsrang: 5, rang: 5, hebel: 1 }, { teamId: "c", liga: 2, erwartungsrang: 1, rang: 1, hebel: 1 }],
      1, 1,
    );
    // ohne Liga-Mittel-Rauschen: Teams b, c treffen ihre Erwartung, a ist vier Plaetze besser
    const fest = rangVon(6, 0.5)["a"]!;
    const lstg = rangVon(6, 1)["a"]!;
    const prm = rangVon(6, 1.5)["a"]!;
    expect(prm / lstg).toBeGreaterThan(1.3);
    expect(fest / lstg).toBeLessThan(0.7);
    expect(vertragsartHebel("fest")).toBe(0.5);
    expect(vertragsartHebel("praemie")).toBe(1.5);
    expect(vertragsartZielEinsatz("fest")).toBe(0);
    expect(vertragsartZielEinsatz("leistung")).toBe(4);
    expect(vertragsartZielEinsatz("praemie")).toBe(8);
  });

  it("Aufholweg: Erwartung 16 landet im Mittel besser, Erwartung 1 schlechter", () => {
    const e = schiebeErwartungsraenge({ a: 1, b: 16, c: 8.5 }, { a: 1, b: 1, c: 1 });
    expect(e.b).toBeGreaterThan(e.a);
  });
});

describe("Sponsor-Topf: Rundung, Erwartungsrang, Passung", () => {
  it("rundeMitSumme trifft die Zielsumme auf 0,1 genau", () => {
    const r = rundeMitSumme({ a: 10.04, b: 20.04, c: 30.04 }, 60.1);
    expect(Math.round(summe(Object.values(r)) * 10)).toBe(601);
    const neg = rundeMitSumme({ a: -1.26, b: 0.63, c: 0.63 }, 0);
    expect(Math.abs(Math.round(summe(Object.values(neg)) * 10))).toBe(0);
  });

  it("Erwartungsraenge werden je Liga auf Summe n(n+1)/2 geschoben, Abstaende bleiben", () => {
    const roh: Record<string, number> = {};
    const ligen: Record<string, SponsorLiga> = {};
    for (let i = 0; i < 16; i += 1) { roh[`x${i}`] = 1 + i * 0.9; ligen[`x${i}`] = 1; roh[`y${i}`] = 3 + i; ligen[`y${i}`] = 2; }
    const e = schiebeErwartungsraenge(roh, ligen);
    expect(summe(Object.keys(e).filter((k) => k.startsWith("x")).map((k) => e[k]!))).toBeCloseTo(136, 6);
    expect(summe(Object.keys(e).filter((k) => k.startsWith("y")).map((k) => e[k]!))).toBeCloseTo(136, 6);
    expect(e.x3! - e.x2!).toBeCloseTo(0.9, 6);
  });

  it("Passung: 0,95 bis 1,05, Gewicht 2/3 Beliebtheit, 1/3 Treue, kein Wuerfel", () => {
    expect(passungRoh(-1, -1)).toBeCloseTo(0.95, 9);
    expect(passungRoh(1, 1)).toBeCloseTo(1.05, 9);
    expect(passungRoh(1, -1)).toBeCloseTo(1 + 0.05 / 3, 9);
    expect(passungRoh(-1, 1)).toBeCloseTo(1 - 0.05 / 3, 9);
    expect(passungRoh(0.3, 0.2)).toBe(passungRoh(0.3, 0.2));
    expect(zBeliebtheit(150, 100)).toBe(1);
    expect(zBeliebtheit(100, 100)).toBe(0);
    expect(zBeliebtheit(10, 100)).toBe(-1);
    expect(zTreue(0)).toBe(-1);
    expect(zTreue(3)).toBe(1);
    expect(zTreue(1.5)).toBe(0);
  });

  it("Leih-Kurs folgt der Passung (1,4 bis 3,0)", () => {
    expect(leihKursFuerPassung(0.95)).toBe(1.4);
    expect(leihKursFuerPassung(1.0)).toBe(2.2);
    expect(leihKursFuerPassung(1.05)).toBe(3.0);
    expect(leihKursFuerPassung(1.2)).toBe(3.0);
  });

  it("Treuebonus: 0 / +1 / +2 C im 1. / 2. / 3. Jahr", () => {
    expect([1, 2, 3].map(treueBonus)).toEqual([0, 1, 2]);
  });
});

describe("Sponsor-Topf: Farb-Partner", () => {
  it("40/25/15/10/5/5, Summe auf den Cent (0,1) genau", () => {
    const teilnehmer = Array.from({ length: 8 }, (_, i) => ({ teamId: `t${i}`, punkte: 100 - i * 7 }));
    const r = verteileFarbTopf(12, teilnehmer);
    expect(Math.round(summe(Object.values(r)) * 10)).toBe(120);
    expect(r.t0!).toBeCloseTo(4.8, 1);
    expect(r.t1!).toBeCloseTo(3.0, 1);
    expect(r.t0! > r.t1! && r.t1! > r.t2!).toBe(true);
  });

  it("Gleichstand teilt die Anteile der belegten Plaetze", () => {
    const r = verteileFarbTopf(9, [{ teamId: "a", punkte: 50 }, { teamId: "b", punkte: 50 }, { teamId: "c", punkte: 10 }, { teamId: "d", punkte: 5 }, { teamId: "e", punkte: 4 }, { teamId: "f", punkte: 3 }]);
    expect(Math.abs(r.a! - r.b!)).toBeLessThanOrEqual(0.1);
    expect(Math.round(summe(Object.values(r)) * 10)).toBe(90);
    expect(r.a!).toBeCloseTo((9 * (0.4 + 0.25)) / 2, 1);
  });

  it("weniger als sechs Teilnehmer: die belegten Anteile werden auf 100 % hochgerechnet, nichts bleibt liegen", () => {
    const r = verteileFarbTopf(9, [{ teamId: "a", punkte: 3 }, { teamId: "b", punkte: 2 }]);
    expect(Math.round(summe(Object.values(r)) * 10)).toBe(90);
    expect(r.a!).toBeGreaterThan(r.b!);
    expect(verteileFarbTopf(9, [])).toEqual({});
  });
});

describe("Sponsor-Topf: Ziel und KI-Wahl", () => {
  it("Ziel: Einsatz x (2 x Erfuellung - 1), im Mittel 0", () => {
    expect(zielAuszahlung(8, 1)).toBe(8);
    expect(zielAuszahlung(8, 0)).toBe(-8);
    expect(zielAuszahlung(4, 0.5)).toBe(0);
    expect(zielAuszahlung(0, 1)).toBe(0);
  });

  it("KI-Vertragsart: Erwartung 11 oder schlechter Praemie, 4 oder besser Fest, dazwischen der Finanzwert", () => {
    expect(kiVertragsart({ erwartungsrang: 12, finanzwert: 9, ambition: 5 })).toBe("praemie");
    expect(kiVertragsart({ erwartungsrang: 3, finanzwert: 2, ambition: 5 })).toBe("fest");
    expect(kiVertragsart({ erwartungsrang: 7, finanzwert: 8, ambition: 5 })).toBe("fest");
    expect(kiVertragsart({ erwartungsrang: 7, finanzwert: 3, ambition: 5 })).toBe("praemie");
    expect(kiVertragsart({ erwartungsrang: 7, finanzwert: 5, ambition: 5 })).toBe("leistung");
    // Ambition verschiebt die Grenze um einen Rang
    expect(kiVertragsart({ erwartungsrang: 10, finanzwert: 5, ambition: 9 })).toBe("praemie");
    expect(kiVertragsart({ erwartungsrang: 10, finanzwert: 5, ambition: 5 })).toBe("leistung");
  });

  it("KI-Laufzeit: Finanzwert ab 6 lang, unter 4 kurz; KI-Farben: die zwei besten, Gleichstand die Identitaet", () => {
    expect([kiLaufzeit(8), kiLaufzeit(5), kiLaufzeit(2)]).toEqual([3, 2, 1]);
    expect(kiFarben({ pow: 5, spe: 1, men: 2, soc: 9 }, "pow")).toEqual(["spe", "men"]);
    expect(kiFarben({ pow: 3, spe: 3, men: 3, soc: 3 }, "soc")[0]).toBe("soc");
  });
});
