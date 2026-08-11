/**
 * Die Rechenschicht der Gebäude-Leihe. Geprueft werden die Eigenschaften, auf die das ganze
 * Sponsoren-Modell steht — nicht einzelne Zufallszahlen.
 *
 * Die Fixpunkte stammen aus `docs/SPONSOREN_BAUVORLAGE.md` und dem Gebäudekatalog.
 */
import { describe, expect, it } from "vitest";

import {
  baueLeihAngebot,
  baueLeihStufenreihe,
  berechneCashVerzicht,
  berechneKatalogkosten,
  berechneLeihwert,
  berechneUebernahmepreis,
  SPONSOR_LEIH_KURSE,
} from "@/lib/sponsor/sponsor-leihe";

describe("Leihwert", () => {
  it("nimmt bei Einnahmegebaeuden den echten Katalog-Ertrag statt der Formel", () => {
    // Fan Shop Stufe 3 traegt laut Katalog 11,7 Cash je Saison. Die Formel kaeme auf 11,8 — nah
    // dran (das ist die Eichprobe), aber der echte Wert ist verfuegbar und schlaegt die Naeherung.
    expect(berechneLeihwert("fan_shop", 3)).toBe(11.7);
    expect(berechneLeihwert("fan_shop", 5)).toBe(25);
  });

  it("naehert Wirkungsgebaeude ueber Baukosten und Unterhalt", () => {
    // Trainingszentrum Stufe 2: kumuliert 8 + 15 = 23 Baukosten, Unterhalt 1,4.
    // 23 / 5 + 1,4 = 6,0.
    expect(berechneKatalogkosten("training_center", 2)).toBe(23);
    expect(berechneLeihwert("training_center", 2)).toBe(6);
  });

  it("liefert 0 fuer eine Stufe, die es nicht gibt", () => {
    expect(berechneLeihwert("training_center", 0)).toBe(0);
    expect(berechneLeihwert("training_center", 99)).toBe(0);
    expect(berechneKatalogkosten("training_center", 0)).toBe(0);
  });
});

describe("Cash-Verzicht", () => {
  it("wird durch den Kurs der Raritaet geteilt — seltener heisst guenstiger", () => {
    const stufe = 3;
    const verzichte = (["gewoehnlich", "magisch", "selten", "legendaer"] as const).map((raritaet) =>
      berechneCashVerzicht({ facilityId: "training_center", stufe, raritaet }),
    );

    // Streng fallend: dieselbe Stufe kostet bei besserem Kurs weniger Cash.
    for (let index = 1; index < verzichte.length; index += 1) {
      expect(verzichte[index]!).toBeLessThan(verzichte[index - 1]!);
    }
    // Und die Rechnung ist genau Leihwert / Kurs.
    expect(verzichte[0]).toBeCloseTo(berechneLeihwert("training_center", stufe) / SPONSOR_LEIH_KURSE.gewoehnlich, 1);
  });

  it("haelt die von Chris gesetzten Enden ein", () => {
    expect(SPONSOR_LEIH_KURSE.gewoehnlich).toBe(1.4);
    expect(SPONSOR_LEIH_KURSE.legendaer).toBe(3.0);
    // Die Zwischenstufen liegen dazwischen und sind aufsteigend.
    expect(SPONSOR_LEIH_KURSE.magisch).toBeGreaterThan(SPONSOR_LEIH_KURSE.gewoehnlich);
    expect(SPONSOR_LEIH_KURSE.selten).toBeGreaterThan(SPONSOR_LEIH_KURSE.magisch);
    expect(SPONSOR_LEIH_KURSE.legendaer).toBeGreaterThan(SPONSOR_LEIH_KURSE.selten);
  });
});

describe("Uebernahmepreis", () => {
  it("rechnet den bereitgestellten Leihwert an, nicht den gezahlten Verzicht", () => {
    // Reha Stufe 4 kostet im Selbstbau 7+13+22+35 = 77. Ueber drei Saisons geliehen (Stufen 2, 3, 4)
    // hat der Sponsor 5,2 + 10,5 + 18,7 = 34,4 bereitgestellt. Im Neuzustand bleiben 42,6.
    expect(berechneKatalogkosten("recovery_center", 4)).toBe(77);
    expect(
      berechneUebernahmepreis({
        facilityId: "recovery_center",
        stufe: 4,
        gehalteneStufen: [2, 3, 4],
        zustandPct: 100,
      }),
    ).toBe(42.6);
  });

  it("ist raritaetsunabhaengig — die bessere Karte wird am Ende nicht teurer", () => {
    // Das ist der eigentliche Grund fuer die Anrechnungsbasis. Wuerde der gezahlte Verzicht
    // angerechnet, zahlte die legendaere Karte (weniger Verzicht) am Ende MEHR als die gewoehnliche.
    const basis = { facilityId: "recovery_center" as const, stufe: 4, gehalteneStufen: [2, 3, 4], zustandPct: 100 };
    const preis = berechneUebernahmepreis(basis);
    for (const raritaet of ["gewoehnlich", "magisch", "selten", "legendaer"] as const) {
      // Der Preis haengt gar nicht an der Raritaet — die Funktion nimmt sie nicht einmal entgegen.
      expect(berechneUebernahmepreis(basis)).toBe(preis);
      expect(berechneCashVerzicht({ facilityId: "recovery_center", stufe: 4, raritaet })).toBeGreaterThan(0);
    }
  });

  it("zieht den Zustand als Reparaturlast ab, nicht als Prozentrabatt", () => {
    // Der erste Entwurf multiplizierte den Restpreis mit dem Zustand: Stufe 4 waere bei Zustand 50
    // fuer 21,3 zu haben gewesen, bei einem Selbstbau von 77. Zu billig — und im Widerspruch zur
    // Regel, dass die Aufstiegsstufen immer gleich viel kosten. Abgezogen wird jetzt genau die
    // Reparatur, die der Kaeufer erbt.
    const basis = { facilityId: "recovery_center" as const, stufe: 4, gehalteneStufen: [2, 3, 4] };
    const neu = berechneUebernahmepreis({ ...basis, zustandPct: 100 });
    const gebraucht = berechneUebernahmepreis({ ...basis, zustandPct: 50 });
    const kaputt = berechneUebernahmepreis({ ...basis, zustandPct: 0 });

    // Der Zustand macht guenstiger, aber nicht dramatisch.
    expect(gebraucht).toBeLessThan(neu);
    expect(gebraucht).toBeGreaterThan(neu * 0.8);
    // Und selbst ein ruinierter Bau kostet noch den Grossteil — man kauft die Stufen, nicht den Lack.
    expect(kaputt).toBeGreaterThan(neu * 0.7);
    // Die Groessenordnung, die Chris gesetzt hat: ein Stufe-4-Gebaeude ist nie fuer ein Viertel
    // seiner Bausumme zu haben.
    expect(gebraucht).toBeGreaterThan(berechneKatalogkosten("recovery_center", 4) * 0.4);
  });

  it("faellt nie unter null, auch wenn lange geliehen wurde", () => {
    expect(
      berechneUebernahmepreis({
        facilityId: "fan_shop",
        stufe: 2,
        gehalteneStufen: [2, 2, 2, 2, 2],
        zustandPct: 100,
      }),
    ).toBe(0);
  });
});

describe("Stufenreihe", () => {
  it("steigt je gehaltener Saison um eine Stufe", () => {
    expect(baueLeihStufenreihe({ startStufe: 2, laufzeit: 3 })).toEqual([2, 3, 4]);
  });

  it("pausiert bei gerissener Bedingung, faellt aber nie zurueck", () => {
    // Zweite Saison gerissen: die dritte startet auf derselben Stufe wie die zweite.
    expect(baueLeihStufenreihe({ startStufe: 2, laufzeit: 3, gehalten: [true, false, true] })).toEqual([2, 3, 3]);
  });

  it("stoppt an der Hoechststufe", () => {
    expect(baueLeihStufenreihe({ startStufe: 4, laufzeit: 4 })).toEqual([4, 5, 5, 5]);
  });
});

describe("Das ganze Angebot", () => {
  it("traegt Stufen, Verzicht und Leihwert je Saison zusammen", () => {
    const angebot = baueLeihAngebot({
      facilityId: "training_center",
      raritaet: "magisch",
      startStufe: 2,
      laufzeit: 3,
    });

    expect(angebot.stufenreihe).toEqual([2, 3, 4]);
    expect(angebot.kurs).toBe(1.8);
    expect(angebot.verzichtJeSaison).toHaveLength(3);
    // Der Verzicht waechst mit der Stufe — die Leihe wird ueber die Jahre wertvoller UND teurer.
    expect(angebot.verzichtJeSaison[2]!).toBeGreaterThan(angebot.verzichtJeSaison[0]!);
    // Jede Saison passt Verzicht zu Leihwert ueber denselben Kurs.
    angebot.verzichtJeSaison.forEach((verzicht, index) => {
      expect(verzicht).toBeCloseTo(angebot.leihwertJeSaison[index]! / angebot.kurs, 1);
    });
    expect(angebot.katalogkostenEndstufe).toBe(berechneKatalogkosten("training_center", 4));
  });

  it("macht die Leihe insgesamt guenstiger als den Selbstbau — sonst waere die Karte sinnlos", () => {
    const angebot = baueLeihAngebot({
      facilityId: "recovery_center",
      raritaet: "magisch",
      startStufe: 2,
      laufzeit: 3,
    });
    const gezahlt = angebot.verzichtJeSaison.reduce((summe, wert) => summe + wert, 0);
    const uebernahme = berechneUebernahmepreis({
      facilityId: "recovery_center",
      stufe: 4,
      gehalteneStufen: angebot.stufenreihe,
      zustandPct: 100,
    });

    // Leihweg (Verzicht ueber drei Saisons + Uebernahme) gegen Selbstbau — und obendrauf hatte man
    // das Gebaeude drei Saisons lang benutzt.
    expect(gezahlt + uebernahme).toBeLessThan(angebot.katalogkostenEndstufe);
  });
});
