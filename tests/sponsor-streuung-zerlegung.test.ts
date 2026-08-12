/**
 * WORAN HAENGT DIE STREUUNG DER SPONSORKARTEN — und woran NICHT.
 *
 * Anlass: nach dem Ligaleiter-Umbau (#360) und dem Gebaeude-Rework (#501) streuen die Karten eines
 * frischen Spiels deutlich breiter als unter der alten Preisgeld-Benchmark (gemessen am Live-Abbild:
 * Leiterwert bei Tabellenplatz 1 frueher 96,3 … 104,0 ueber alle 32 Teams, heute 41,4 … 117,9). Die
 * Frage war, ob das Absicht ist oder ein stiller Fehler. Gemessen ist es Absicht — aber die Zusage
 * dahinter ist eng, und genau die haelt diese Datei fest:
 *
 *   DER ERWARTUNGSWERT EINER KARTE IST VOLLSTAENDIG DURCH DREI TERME ERKLAERT, es gibt keinen vierten:
 *
 *       EV = A(Startrang, Gehaltsfaktor) * Raritaets-Wertfaktor  −  Gebaeude-Verzicht
 *
 * Bricht diese Identitaet, ist ein Regler dazugekommen, den niemand benannt hat — und genau das war
 * der Fehler, den das ganze V3-Modell ausschliessen soll ("welchen Vertrag du zufaellig
 * unterschrieben hast, zaehlt mehr als deine Leistung").
 *
 * Die Zahlen unten sind an echten Spielstaenden nachgemessen (frisches Spiel vom 12.08.2026, 160
 * Angebote / 31 Vertraege), nicht aus den Konstanten abgeschrieben.
 */
import { describe, expect, it } from "vitest";

import { SPONSOR_CURVE_SHAPE_KEYS } from "@/lib/sponsor/sponsor-curve-shapes";
import { sponsorKurvenLeiter, SPONSOR_BODEN } from "@/lib/sponsor/sponsor-liga-leiter";
import {
  SPONSOR_V3_CARDS,
  buildSponsorV3TermsCore,
  sponsorV3Anchor,
  sponsorV3AnchorWeights,
  sponsorV3ExpectedPayout,
  sponsorV3LadderValue,
} from "@/lib/sponsor/sponsor-v3-model";
import { sponsorV3WertFaktorFuerKarte } from "@/lib/sponsor/sponsor-v3-offer-service";

const BASIS_KARTE = SPONSOR_V3_CARDS.find((karte) => karte.key === "basis")!;

/** Der Anspruch A dieses Teams: die NEUTRALE Ligaleiter, gewichtet mit seiner Endrang-Erwartung. */
function anspruch(startRank: number, salaryFactor: number): number {
  // "stetig" ist eine der 11 Formen; alle sind auf denselben Anker normiert, die Wahl ist beliebig.
  const leiter = sponsorKurvenLeiter({ shape: "stetig", startRank, salaryFactor });
  return sponsorV3Anchor(leiter, sponsorV3AnchorWeights(startRank));
}

/** Eine Karte so bauen, wie der Live-Pfad sie baut (buildSponsorV3Terms), aber ohne GameState. */
function baueKarte(input: {
  startRank: number;
  salaryFactor: number;
  rarity: string;
  shape: (typeof SPONSOR_CURVE_SHAPE_KEYS)[number];
  leihVerzicht?: number;
}) {
  const wertFaktor = sponsorV3WertFaktorFuerKarte({ rarity: input.rarity, leihVerzicht: input.leihVerzicht });
  const baseLadder = sponsorKurvenLeiter({
    shape: input.shape,
    startRank: input.startRank,
    salaryFactor: input.salaryFactor,
  }).map((wert) => wert * wertFaktor);
  return buildSponsorV3TermsCore({
    baseLadder,
    startRank: input.startRank,
    rarity: input.rarity,
    card: BASIS_KARTE,
    goalKey: null,
    salaryFactor: input.salaryFactor,
    floor: Math.max(0, SPONSOR_BODEN * wertFaktor - Math.max(0, input.leihVerzicht ?? 0)),
    curveShape: input.shape,
    leihVerzicht: input.leihVerzicht,
  });
}

describe("Sponsor-Streuung: der Erwartungswert hat genau drei Terme", () => {
  it("EV = A(Startrang, Faktor) * Wertfaktor − Verzicht — exakt, ueber Raritaeten, Formen und Verzichte", () => {
    for (const startRank of [1, 5, 16, 24, 32]) {
      for (const salaryFactor of [0.82, 1.0, 1.24]) {
        for (const rarity of ["gewöhnlich", "magisch", "selten", "legendär"]) {
          for (const shape of ["stetig", "titeljaeger", "konsolidierung"] as const) {
            for (const leihVerzicht of [0, 5, 15]) {
              const terms = baueKarte({ startRank, salaryFactor, rarity, shape, leihVerzicht });
              const wertFaktor = sponsorV3WertFaktorFuerKarte({ rarity, leihVerzicht });
              const erwartet = anspruch(startRank, salaryFactor) * wertFaktor - leihVerzicht;
              expect(
                sponsorV3ExpectedPayout(terms),
                `Rang ${startRank} f=${salaryFactor} ${rarity} ${shape} Verzicht ${leihVerzicht}`,
              ).toBeCloseTo(erwartet, 6);
            }
          }
        }
      }
    }
  });

  it("die KURVENFORM verschiebt nur, WO das Geld liegt — sie traegt zum Erwartungswert exakt nichts bei", () => {
    // Genau das ist der Grund, warum der Leiterwert BEI PLATZ 1 so viel breiter streut als der
    // Erwartungswert: die Form entscheidet ueber die Spitze, nicht ueber die Summe.
    const evs = SPONSOR_CURVE_SHAPE_KEYS.map((shape) =>
      sponsorV3ExpectedPayout(baueKarte({ startRank: 5, salaryFactor: 1.24, rarity: "magisch", shape })),
    );
    for (const ev of evs) expect(ev).toBeCloseTo(evs[0]!, 6);
    // …waehrend die Sprosse bei Platz 1 zwischen den Formen weit auseinanderliegt. Am staerksten im
    // Mittelfeld, wo eine Titeljaeger-Form am weitesten von der eigenen Erwartung wegzieht; an den
    // Tabellenenden faellt der Unterschied klein aus, weil dort kaum Wertungstopf oberhalb des
    // Sockels liegt. Genau diese Spreizung erklaert, warum der Leiterwert bei Platz 1 heute weit
    // streut, obwohl der Erwartungswert es nicht tut.
    const formSpanne = (startRank: number) => {
      const spitzen = SPONSOR_CURVE_SHAPE_KEYS.map((shape) =>
        sponsorV3LadderValue(baueKarte({ startRank, salaryFactor: 1.24, rarity: "magisch", shape }), 1),
      );
      return Math.max(...spitzen) - Math.min(...spitzen);
    };
    expect(formSpanne(15)).toBeCloseTo(31.1, 0);
    expect(formSpanne(5)).toBeCloseTo(18.8, 0);
    expect(formSpanne(32)).toBeCloseTo(4.8, 0);
  });
});

describe("Sponsor-Streuung: die Groesse der drei Regler", () => {
  it("Startrang ist der groesste Regler und wird mit der Konjunktur steiler — der Sockel skaliert nicht mit", () => {
    // Gemessen: bei f = 1,0 spannt der Startrang 35,7 C auf, bei f = 1,24 (Obergrenze des
    // Konjunkturfensters [0,82; 1,24]) schon 52,2 C. Rund die HAELFTE der heute sichtbaren
    // Verbreiterung gegenueber den aelteren Spielstaenden ist also nicht das Modell, sondern der
    // Wuerfel der Saisonkonjunktur — die aelteren Spiele liefen auf f = 1,0 und 1,12.
    const spanne = (f: number) => anspruch(1, f) - anspruch(32, f);
    expect(spanne(1.0)).toBeCloseTo(35.7, 1);
    expect(spanne(1.12)).toBeCloseTo(43.9, 1);
    expect(spanne(1.24)).toBeCloseTo(52.2, 1);
    // Der Sockel haengt NUR am Startrang: am unteren Tabellenende bewegt die Konjunktur fast nichts.
    expect(anspruch(32, 1.24) - anspruch(32, 0.82)).toBeLessThan(3);
  });

  it("die Raritaet wirkt genau EINMAL: als Hoehe auf der Cash-Karte, als Kurs auf der Gebaeude-Karte", () => {
    const ev = (rarity: string, leihVerzicht = 0) =>
      sponsorV3ExpectedPayout(baueKarte({ startRank: 10, salaryFactor: 1.24, rarity, shape: "stetig", leihVerzicht }));
    // Cash-Karte: die Raritaet hebt die ganze Leiter, ±11 % um die magische Mitte.
    expect(ev("gewöhnlich") / ev("magisch")).toBeCloseTo(0.89, 6);
    expect(ev("selten") / ev("magisch")).toBeCloseTo(1.05, 6);
    expect(ev("legendär") / ev("magisch")).toBeCloseTo(1.11, 6);
    // Gebaeude-Karte: JEDE Raritaet steht auf demselben untersten Wertfaktor — ihr Vorteil steckt im
    // Umwandlungskurs (sponsor-leihe.ts), nicht noch einmal in der Leiter. Ohne diese Regel bekaeme
    // eine legendaere Gebaeude-Karte mehr Cash UND das groessere Gebaeude.
    const mitLeihe = ["gewöhnlich", "magisch", "selten", "legendär"].map((rarity) => ev(rarity, 10));
    for (const wert of mitLeihe) expect(wert).toBeCloseTo(mitLeihe[0]!, 6);
    expect(mitLeihe[0]!).toBeCloseTo(ev("gewöhnlich") - 10, 6);
  });

  it("der Gebaeude-Verzicht ist der GROESSTE Einzelregler — und genau deshalb gedeckelt", () => {
    // Gemessen an 160 Angeboten eines frischen Spiels: Verzicht 0,8 … 25,4 C, waehrend die Raritaet
    // bei denselben Leitern nur 6 bis 12 C bewegt. Der Deckel (VERZICHT_ANTEIL_DER_LEITER = 0,5 der
    // niedrigsten Sprosse) hielt in allen 160 Angeboten: hoechster gemessener Anteil 45,2 %.
    for (const startRank of [1, 16, 32]) {
      const rohLeiter = sponsorKurvenLeiter({ shape: "stetig", startRank, salaryFactor: 1.24 });
      const deckel = Math.min(...rohLeiter) * 0.5;
      const terms = baueKarte({ startRank, salaryFactor: 1.24, rarity: "gewöhnlich", shape: "stetig", leihVerzicht: deckel });
      // Auch die teuerste noch erlaubte Karte bleibt eine Karte: positiv auf jedem Endrang und
      // monoton (ein besserer Rang zahlt nie weniger).
      const leiter = Array.from({ length: 32 }, (_, index) => sponsorV3LadderValue(terms, index + 1));
      expect(Math.min(...leiter)).toBeGreaterThan(0);
      for (let index = 1; index < leiter.length; index += 1) {
        expect(leiter[index]!, `Rang ${index + 1} bei Startrang ${startRank}`).toBeLessThanOrEqual(leiter[index - 1]! + 1e-9);
      }
      // …und sie kostet mehr als der gesamte Raritaets-Hebel derselben Leiter hergibt.
      const raritaetsHebel =
        sponsorV3ExpectedPayout(baueKarte({ startRank, salaryFactor: 1.24, rarity: "legendär", shape: "stetig" }))
        - sponsorV3ExpectedPayout(baueKarte({ startRank, salaryFactor: 1.24, rarity: "gewöhnlich", shape: "stetig" }));
      expect(deckel).toBeGreaterThan(raritaetsHebel);
    }
  });
});
