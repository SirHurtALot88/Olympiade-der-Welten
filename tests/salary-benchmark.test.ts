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
  buildBracketSalaryBenchmark,
  buildBracketSalaryBenchmarks,
  buildSalaryBenchmark,
  leistungJeVollemPensum,
  ordneGehaltEin,
  SALARY_BENCHMARK_MIN_STICHPROBE,
  type SalaryBenchmarkGroupedSample,
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

describe("Die Laufzeit-Falle — lange Vertraege sind oft besser dotiert", () => {
  /**
   * Eine Liga, in der BEIDES das Gehalt erklaert: Leistung und Bindungsdauer.
   * Gehalt = 6 + 0,4 × Leistung + 1,5 × Vertragsjahre.
   */
  const LIGA = Array.from({ length: 24 }, (_, index) => {
    const leistung = 2 + (index % 8) * 2;
    const laufzeit = 1 + Math.floor(index / 8) * 2; // 1, 3, 5
    return { salary: Number((6 + 0.4 * leistung + 1.5 * laufzeit).toFixed(2)), leistung, laufzeit };
  });

  it("liest den Laufzeit-Aufschlag als eigene Groesse aus", () => {
    const modell = buildSalaryBenchmark(LIGA)!;
    expect(modell.jeLeistungspunkt).toBeCloseTo(0.4, 2);
    expect(modell.jeVertragsjahr).toBeCloseTo(1.5, 2);
  });

  it("erklaert einen langfristig gebundenen Spieler NICHT fuer ueberbezahlt", () => {
    // Genau die Verwischung, um die es geht: derselbe Spieler, einmal mit kurzem und einmal mit
    // langem Vertrag, jeweils exakt zum ueblichen Satz bezahlt. Beide muessen bei ~0 landen.
    const modell = buildSalaryBenchmark(LIGA)!;
    const kurz = bewerteGehalt(modell, { salary: 6 + 0.4 * 10 + 1.5 * 1, leistung: 10, laufzeit: 1 })!;
    const lang = bewerteGehalt(modell, { salary: 6 + 0.4 * 10 + 1.5 * 5, leistung: 10, laufzeit: 5 })!;
    expect(kurz.abweichung).toBeCloseTo(0, 1);
    expect(lang.abweichung).toBeCloseTo(0, 1);
    expect(ordneGehaltEin(lang)).toBe("ueblich");
  });

  it("ohne die Laufzeit-Spalte kippt genau dieser Spieler faelschlich auf 'teuer'", () => {
    // Der Beleg, warum die zweite Spalte noetig ist: dasselbe Modell ohne Laufzeit schiebt deren
    // Aufschlag der Leistung zu — der lang gebundene Spieler sieht dann ueberbezahlt aus.
    const ohneLaufzeit = buildSalaryBenchmark(LIGA.map(({ salary, leistung }) => ({ salary, leistung })))!;
    expect(ohneLaufzeit.jeVertragsjahr).toBe(0);
    const langBlind = bewerteGehalt(ohneLaufzeit, { salary: 6 + 0.4 * 10 + 1.5 * 5, leistung: 10 })!;
    expect(langBlind.abweichung).toBeGreaterThan(0);
    expect(ordneGehaltEin(langBlind)).toBe("teuer");
  });

  it("faellt auf eine Dimension zurueck, wenn alle gleich lang gebunden sind", () => {
    // Dann laesst sich der Laufzeit-Anteil nicht trennen — lieber gar keine zweite Zahl als eine,
    // die nur die erste doppelt erklaert.
    const gleichLang = LIGA.map((eintrag) => ({ ...eintrag, laufzeit: 3 }));
    const modell = buildSalaryBenchmark(gleichLang)!;
    expect(modell.jeVertragsjahr).toBe(0);
    expect(modell.jeLeistungspunkt).toBeGreaterThan(0);
  });

  it("kommt ohne Laufzeit-Angabe weiter zurecht", () => {
    const modell = buildSalaryBenchmark(KADER)!;
    expect(modell.jeVertragsjahr).toBe(0);
    // Auch beim einzelnen Spieler faellt nur der Laufzeit-Anteil weg, nicht die ganze Aussage.
    expect(bewerteGehalt(modell, { salary: 15, leistung: 4.5 })).not.toBeNull();
  });
});

describe("Vergleichsgruppe: Bracket statt ganzer Liga", () => {
  /**
   * Eine Liga, in der die Bezahlung nach oben STEILER wird — genau der Fall, an dem eine einzige
   * Gerade scheitert: sie unterschaetzt das uebliche Gehalt der Besten und laesst sie
   * ueberbezahlt aussehen.
   */
  const GESTAFFELT: SalaryBenchmarkGroupedSample[] = [
    // Bracket 0 (Spitze): Gehalt ~ 4 × Leistung
    ...[20, 22, 24, 26, 28, 30].map((leistung) => ({ salary: leistung * 4, leistung, bracketIndex: 0 })),
    // Bracket 1 (Mittelfeld): Gehalt ~ 1,5 × Leistung
    ...[8, 9, 10, 11, 12, 13].map((leistung) => ({ salary: leistung * 1.5, leistung, bracketIndex: 1 })),
    // Bracket 2 (unten): Gehalt ~ 1 × Leistung
    ...[2, 3, 4, 5, 6, 7].map((leistung) => ({ salary: leistung * 1, leistung, bracketIndex: 2 })),
  ];

  it("bewertet jeden, der genau seinen Bracket-Satz verdient, als unauffaellig", () => {
    // Drei Spieler, jeder exakt zum ueblichen Satz SEINER Klasse bezahlt. Alle drei muessen bei
    // null landen — das ist der ganze Anspruch der Kennzahl.
    const faelle = [
      { spieler: { salary: 25 * 4, leistung: 25 }, bracketIndex: 0 },
      { spieler: { salary: 10 * 1.5, leistung: 10 }, bracketIndex: 1 },
      { spieler: { salary: 4 * 1, leistung: 4 }, bracketIndex: 2 },
    ];
    for (const fall of faelle) {
      const modell = buildBracketSalaryBenchmark(GESTAFFELT, fall.bracketIndex)!.modell;
      const bewertung = bewerteGehalt(modell, fall.spieler)!;
      expect(bewertung.abweichung).toBeCloseTo(0, 1);
      expect(ordneGehaltEin(bewertung)).toBe("ueblich");
    }
  });

  it("die Gesamtgerade verrechnet sich dabei — und zwar in der Mitte", () => {
    // Eine Gerade durch alle drei Staffeln legt sich an die steil bezahlte Spitze an und bekommt
    // dadurch einen negativen Sockel. Der Mittelfeldspieler, der exakt seinen Satz verdient,
    // sieht danach aus wie ein Schnaeppchen — er ist keins.
    const ueberAlle = buildSalaryBenchmark(GESTAFFELT)!;
    expect(ueberAlle.sockel).toBeLessThan(0);

    const mittelfeld = { salary: 10 * 1.5, leistung: 10 };
    const blind = bewerteGehalt(ueberAlle, mittelfeld)!;
    const imBracket = bewerteGehalt(buildBracketSalaryBenchmark(GESTAFFELT, 1)!.modell, mittelfeld)!;

    expect(ordneGehaltEin(blind)).toBe("guenstig");
    expect(ordneGehaltEin(imBracket)).toBe("ueblich");
    expect(Math.abs(imBracket.abweichung)).toBeLessThan(Math.abs(blind.abweichung));
  });

  it("nimmt bei duennem Bracket die Nachbarn dazu, statt nichts zu sagen", () => {
    // Nur drei Spieler im Spitzen-Bracket — allein zu wenig fuer eine Schaetzung.
    const duenn: SalaryBenchmarkGroupedSample[] = [
      ...GESTAFFELT.filter((eintrag) => eintrag.bracketIndex !== 0),
      ...[20, 24, 28].map((leistung) => ({ salary: leistung * 4, leistung, bracketIndex: 0 })),
    ];
    expect(buildSalaryBenchmark(duenn.filter((e) => e.bracketIndex === 0))).toBeNull();

    const gruppe = buildBracketSalaryBenchmark(duenn, 0)!;
    expect(gruppe.ausweitung).toBe(1); // ein Bracket nach unten dazugenommen
    expect(gruppe.modell.stichprobe).toBe(9);
  });

  it("bleibt beim eigenen Bracket, wenn es traegt", () => {
    const gruppe = buildBracketSalaryBenchmark(GESTAFFELT, 1)!;
    expect(gruppe.ausweitung).toBe(0);
    expect(gruppe.modell.stichprobe).toBe(6);
  });

  it("liefert fuer jedes belegte Bracket eine eigene Kurve", () => {
    const alle = buildBracketSalaryBenchmarks(GESTAFFELT);
    expect([...alle.keys()].sort()).toEqual([0, 1, 2]);
    // Die Spitze wird steiler bezahlt als die Breite — genau deshalb der getrennte Vergleich.
    expect(alle.get(0)!.modell.jeLeistungspunkt).toBeGreaterThan(alle.get(2)!.modell.jeLeistungspunkt);
  });

  it("sagt nichts, wenn selbst die ganze Liga zu klein ist", () => {
    const winzig: SalaryBenchmarkGroupedSample[] = [
      { salary: 10, leistung: 5, bracketIndex: 0 },
      { salary: 12, leistung: 6, bracketIndex: 1 },
    ];
    expect(buildBracketSalaryBenchmark(winzig, 0)).toBeNull();
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
