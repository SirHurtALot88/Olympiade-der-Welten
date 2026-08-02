/**
 * DIE KENNZAHL DARF SCHWACHE SPIELER NICHT BESTRAFEN.
 *
 * Der Vorgaenger-Ansatz war ein Quotient (Gehalt geteilt durch Leistung). Der misst in einem
 * echten Kader keine Wirtschaftlichkeit, sondern fast nur Leistung — weil die Gehaelter eng
 * beieinander liegen und die Leistungswerte weit auseinander. Wer darauf eine Verkaufsempfehlung
 * baut, gibt Spieler ab, weil sie schwach sind, und nennt es eine wirtschaftliche Entscheidung.
 *
 * Der erste Test unten haelt genau das fest: er rechnet beide Verfahren auf denselben Daten und
 * verlangt, dass das neue die billigen Schwachen NICHT unten einsortiert. Faellt er, ist der
 * Bias zurueck.
 */
import { describe, expect, it } from "vitest";

import {
  bewerteGehalt,
  buildSalaryBenchmark,
  leistungJeVollemPensum,
  ordneGehaltEin,
  SALARY_BENCHMARK_MIN_STICHPROBE,
  type SalaryBenchmarkSample,
} from "@/lib/contracts/salary-benchmark";

/** Der Kader aus dem Design-Vorschlag: Gehaelter 11–16, Leistung 1,0–20,9. */
const KADER: Array<SalaryBenchmarkSample & { name: string }> = [
  { name: "Umbros", salary: 16, leistung: 20.9 },
  { name: "Pooka", salary: 13, leistung: 11.5 },
  { name: "Kargath", salary: 14, leistung: 9 },
  { name: "Zed", salary: 14, leistung: 7.5 },
  { name: "Umbrafond", salary: 11, leistung: 6.1 },
  { name: "Pandora", salary: 12, leistung: 6 },
  { name: "Badmona", salary: 15, leistung: 4.5 },
  { name: "Wartusk", salary: 14, leistung: 1 },
];

describe("Der Bias, gegen den die Kennzahl gebaut ist", () => {
  it("der Quotient rankt praktisch nur die Leistung — deshalb taugt er nicht", () => {
    // Beleg fuer die Begruendung im Modul: nach Gehalt/Leistung sortiert kommt fast dieselbe
    // Reihenfolge heraus wie nach Leistung allein. Der Quotient behauptet Preis-Leistung und
    // liefert Leistung.
    const nachQuotient = [...KADER]
      .sort((links, rechts) => links.salary / links.leistung - rechts.salary / rechts.leistung)
      .map((e) => e.name);
    const nachLeistung = [...KADER].sort((links, rechts) => rechts.leistung - links.leistung).map((e) => e.name);

    const gleichePlaetze = nachQuotient.filter((name, index) => name === nachLeistung[index]).length;
    expect(gleichePlaetze).toBeGreaterThanOrEqual(6); // 6 von 8 identisch
  });

  it("bestraft einen billigen schwachen Spieler nicht — der Quotient tut es", () => {
    const modell = buildSalaryBenchmark(KADER);
    // Ein bewusst schwacher, aber auch bewusst billiger Spieler.
    const billigUndSchwach = { salary: 6, leistung: 1.5 };

    // Quotient: 6 / 1,5 = 4,0 — schlechter als JEDER im Kader, obwohl er am wenigsten kostet.
    const quotient = billigUndSchwach.salary / billigUndSchwach.leistung;
    const schlechtesterImKader = Math.max(...KADER.map((e) => e.salary / e.leistung));
    expect(quotient).toBeLessThan(schlechtesterImKader); // nur Wartusk ist noch schlechter …
    expect(quotient).toBeGreaterThan(KADER.filter((e) => e.name !== "Wartusk").reduce((max, e) => Math.max(max, e.salary / e.leistung), 0));
    // … d. h. er landet auf dem vorletzten Platz, allein wegen seiner Schwaeche.

    // Abweichung: er verdient WENIGER als fuer diese Leistung ueblich → guenstig, nicht auffaellig.
    const bewertung = bewerteGehalt(modell, billigUndSchwach);
    expect(bewertung).not.toBeNull();
    expect(bewertung!.abweichung).toBeLessThan(0);
    expect(ordneGehaltEin(bewertung)).toBe("guenstig");
  });

  it("faellt der teure Schwache auf und nicht der teure Starke", () => {
    const modell = buildSalaryBenchmark(KADER);
    const werte = KADER.map((eintrag) => ({
      name: eintrag.name,
      bewertung: bewerteGehalt(modell, eintrag)!,
    }));
    const teuerster = [...werte].sort((links, rechts) => rechts.bewertung.abweichung - links.bewertung.abweichung)[0];
    // Badmona: wenig Leistung bei hohem Gehalt. NICHT Umbros, der am meisten verdient.
    expect(teuerster.name).toBe("Badmona");

    const umbros = werte.find((e) => e.name === "Umbros")!;
    expect(ordneGehaltEin(umbros.bewertung)).toBe("ueblich");

    // Und der guenstigste Vertrag ist der, den die alte Tabelle gar nicht zeigte.
    const guenstigster = [...werte].sort((links, rechts) => links.bewertung.abweichung - rechts.bewertung.abweichung)[0];
    expect(guenstigster.name).toBe("Umbrafond");
    expect(ordneGehaltEin(guenstigster.bewertung)).toBe("guenstig");
  });
});

describe("buildSalaryBenchmark — die Schaetzung selbst", () => {
  it("findet eine saubere Gerade wieder", () => {
    // Gehalt = 10 + 0,5 × Leistung, exakt.
    const stichprobe = [2, 4, 6, 8, 10, 12].map((leistung) => ({ salary: 10 + 0.5 * leistung, leistung }));
    const modell = buildSalaryBenchmark(stichprobe);
    expect(modell).not.toBeNull();
    expect(modell!.sockel).toBeCloseTo(10, 4);
    expect(modell!.jeLeistungspunkt).toBeCloseTo(0.5, 4);
    expect(modell!.stichprobe).toBe(6);
  });

  it("liefert null unterhalb der Mindest-Stichprobe statt einer geratenen Geraden", () => {
    const zuWenig = Array.from({ length: SALARY_BENCHMARK_MIN_STICHPROBE - 1 }, (_, index) => ({
      salary: 10 + index,
      leistung: index,
    }));
    expect(buildSalaryBenchmark(zuWenig)).toBeNull();
    expect(bewerteGehalt(null, { salary: 12, leistung: 5 })).toBeNull();
    expect(ordneGehaltEin(null)).toBeNull();
  });

  it("schneidet eine negative Steigung bei null ab", () => {
    // Hier verdienen die Schwachen am meisten. Uebernaehme man die negative Steigung, gaelte
    // "mehr Leistung gehoert sich billiger" — und jeder starke Spieler waere ueberbezahlt.
    const verdreht = [
      { salary: 20, leistung: 1 },
      { salary: 18, leistung: 3 },
      { salary: 16, leistung: 5 },
      { salary: 14, leistung: 7 },
      { salary: 12, leistung: 9 },
      { salary: 10, leistung: 11 },
    ];
    const modell = buildSalaryBenchmark(verdreht);
    expect(modell!.jeLeistungspunkt).toBe(0);
    // Flache Gerade = Mittelwert; der Bestverdiener faellt als teuer auf, nicht der Beste.
    expect(modell!.sockel).toBeCloseTo(15, 4);
    expect(bewerteGehalt(modell, { salary: 20, leistung: 1 })!.abweichung).toBeCloseTo(5, 4);
  });

  it("kommt mit lauter gleich starken Spielern zurecht", () => {
    const gleich = Array.from({ length: 8 }, (_, index) => ({ salary: 10 + index, leistung: 5 }));
    const modell = buildSalaryBenchmark(gleich);
    expect(modell!.jeLeistungspunkt).toBe(0);
    expect(modell!.sockel).toBeCloseTo(13.5, 4);
  });

  it("wirft unbrauchbare Zeilen heraus, statt am NaN zu ersticken", () => {
    const mitMuell = [
      ...KADER,
      { salary: Number.NaN, leistung: 5 },
      { salary: 12, leistung: Number.NaN },
      { salary: 0, leistung: 4 },
    ];
    const modell = buildSalaryBenchmark(mitMuell);
    expect(modell!.stichprobe).toBe(KADER.length);
    expect(Number.isFinite(modell!.sockel)).toBe(true);
  });

  it("nennt nie ein negatives uebliches Gehalt", () => {
    const steil = [
      { salary: 1, leistung: 10 },
      { salary: 2, leistung: 12 },
      { salary: 3, leistung: 14 },
      { salary: 40, leistung: 40 },
      { salary: 44, leistung: 42 },
      { salary: 48, leistung: 44 },
    ];
    const modell = buildSalaryBenchmark(steil);
    const beiNull = bewerteGehalt(modell, { salary: 5, leistung: 0 })!;
    expect(beiNull.ueblich).toBeGreaterThanOrEqual(0);
  });
});

describe("leistungJeVollemPensum — die Einsatzzeit-Falle", () => {
  it("rechnet einen Teilzeit-Spieler auf ein volles Pensum hoch", () => {
    // 4 Punkte aus 5 Einsaetzen sind bei 10 Spieltagen keine 4-Punkte-Saison, sondern eine mit 8.
    expect(leistungJeVollemPensum({ leistung: 4, einsaetze: 5, pensum: 10 })).toBe(8);
  });

  it("laesst einen vollen Kader unangetastet", () => {
    expect(leistungJeVollemPensum({ leistung: 9.1, einsaetze: 10, pensum: 10 })).toBe(9.1);
    // Mehr Einsaetze als Pensum (Nachholspiele) wird nicht heruntergerechnet.
    expect(leistungJeVollemPensum({ leistung: 9.1, einsaetze: 12, pensum: 10 })).toBe(9.1);
  });

  it("raet nicht aus zu wenigen Einsaetzen, sondern sagt nichts", () => {
    expect(leistungJeVollemPensum({ leistung: 2, einsaetze: 2, pensum: 10 })).toBeNull();
    expect(leistungJeVollemPensum({ leistung: 2, einsaetze: null, pensum: 10 })).toBeNull();
    expect(leistungJeVollemPensum({ leistung: 2, einsaetze: 5, pensum: 0 })).toBeNull();
  });

  it("verhindert genau den Fehlschluss, um den es geht", () => {
    // Zwei gleich gute Spieler, einer war verletzt. Ohne Hochrechnung sieht der Verletzte aus
    // wie ein Minderleister — und die Kennzahl empfaehle, ihn abzugeben.
    const dauerhaft = { leistung: 9, einsaetze: 10, pensum: 10 };
    const verletzt = { leistung: 3.6, einsaetze: 4, pensum: 10 };
    expect(verletzt.leistung).toBeLessThan(dauerhaft.leistung); // roh: klar schlechter
    expect(leistungJeVollemPensum(verletzt)).toBe(leistungJeVollemPensum(dauerhaft)); // bereinigt: gleich
  });
});
