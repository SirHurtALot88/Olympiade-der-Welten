/**
 * GEMELDET: „buyout soll nicht zu 100% weg fallen sondern nur anteilig je nachdem was der spieler
 * noch für forderungen stellt. sonst wäre das ja OP. so bekommt man ggf. positiven MW + kein
 * Buyout! dann macht man sogar noch gewinn beim verkauf."
 *
 * Und die Rückfrage dazu: „müsste es bei manchen Spielern nicht sogar anders laufen? Also dass
 * Moral sinkt und sie den Vertrag dann aussitzen oder auf weniger buyout verzichten als normal?"
 *
 * Beides steckt in `resolveDissolutionWaiverShare`:
 *
 *  - MORAL treibt den Verzicht: an der Schwelle 30 %, bei Moral 0 sind es 60 %.
 *  - CHARAKTER dreht dagegen: ein geld-/egogetriebener Spieler will sein Geld und sitzt den
 *    Vertrag notfalls ab, ein loyaler geht sauber und günstig. Das Wesen kommt aus derselben
 *    Quelle wie die Nachverhandlungs-Forderung (`derivePlayerNatureDemandSignals`) — nicht aus
 *    einer zweiten Tabelle.
 *  - Die ZWEITE ANFRAGE nach einer Ablehnung läuft je nach Wesen in verschiedene Richtungen.
 *    Sonst wäre Ablehnen ein sicherer Weg, den Verzicht hochzufarmen — „so soll das ja nicht sein".
 */
import type { Player } from "@/lib/data/olyDataTypes";
import {
  DISSOLUTION_MORALE_THRESHOLD,
  DISSOLUTION_WAIVER_MAX,
  DISSOLUTION_WAIVER_MIN,
  resolveDissolutionWaiverShare,
} from "@/lib/morale/contract-dissolution-service";
import { describe, expect, it } from "vitest";

const spieler = (positiv: string[] = [], negativ: string[] = []): Player =>
  ({
    id: "p",
    name: "Test",
    traitsPositive: positiv,
    traitsNegative: negativ,
    subclasses: [],
    alignment: "NEUTRAL",
  }) as unknown as Player;

const neutral = spieler();
const bescheiden = spieler(["loyal", "humble"]);
const geldgetrieben = spieler([], ["mercenary", "egomaniac"]);

const anteil = (player: Player, morale: number, previouslyDeclined = false) =>
  resolveDissolutionWaiverShare({ player, morale, previouslyDeclined });

describe("Verzicht nach Moral", () => {
  it("gibt an der Schwelle am wenigsten auf", () => {
    expect(anteil(neutral, DISSOLUTION_MORALE_THRESHOLD)).toBeCloseTo(0.3, 3);
  });

  it("gibt bei Moral 0 am meisten auf", () => {
    expect(anteil(neutral, 0)).toBeCloseTo(0.6, 3);
  });

  it("steigt monoton, je unglücklicher der Spieler ist", () => {
    const werte = [34, 29, 24, 15, 5, 0].map((morale) => anteil(neutral, morale));
    for (let index = 1; index < werte.length; index += 1) {
      expect(werte[index]).toBeGreaterThan(werte[index - 1]);
    }
  });

  it("verlässt die Spanne nie — weder geschenkt noch wirkungslos", () => {
    for (const player of [neutral, bescheiden, geldgetrieben]) {
      for (const morale of [-10, 0, 17, 34, 99]) {
        for (const declined of [false, true]) {
          const wert = anteil(player, morale, declined);
          expect(wert).toBeGreaterThanOrEqual(DISSOLUTION_WAIVER_MIN);
          expect(wert).toBeLessThanOrEqual(DISSOLUTION_WAIVER_MAX);
        }
      }
    }
  });
});

describe("Verzicht nach Charakter", () => {
  it("lässt einen geldgetriebenen Spieler WENIGER aufgeben als einen bescheidenen", () => {
    // Genau der Fall aus der Rückfrage: der eine sitzt den Vertrag ab, der andere geht sauber.
    expect(anteil(geldgetrieben, 24)).toBeLessThan(anteil(neutral, 24));
    expect(anteil(bescheiden, 24)).toBeGreaterThan(anteil(neutral, 24));
  });

  it("lässt die Moral trotzdem der Haupttreiber bleiben", () => {
    // Ein sehr unglücklicher Geldgetriebener gibt mehr auf als ein kaum unzufriedener Bescheidener.
    expect(anteil(geldgetrieben, 0)).toBeGreaterThan(anteil(bescheiden, DISSOLUTION_MORALE_THRESHOLD));
  });

  it("kommt ohne gepflegte Trait-Listen zurecht", () => {
    // Ältere Spielstände und Fixtures haben die Listen nicht — dann gilt ein neutrales Wesen,
    // statt dass die Rechnung wirft.
    const ohneTraits = { id: "p", name: "Alt", subclasses: [], alignment: null } as unknown as Player;
    expect(anteil(ohneTraits, 24)).toBeCloseTo(anteil(neutral, 24), 3);
  });
});

describe("Die zweite Anfrage nach einer Ablehnung", () => {
  it("lässt einen bescheidenen Spieler mehr aufgeben", () => {
    expect(anteil(bescheiden, 24, true)).toBeGreaterThan(anteil(bescheiden, 24, false));
  });

  it("lässt einen geldgetriebenen Spieler WENIGER aufgeben — er nimmt es persönlich", () => {
    // Das ist der Riegel gegen „ablehnen und nächste Saison billiger abgeben": bei diesen
    // Spielern kostet das Aussitzen den Manager, statt ihm etwas zu bringen.
    expect(anteil(geldgetrieben, 24, true)).toBeLessThan(anteil(geldgetrieben, 24, false));
  });

  it("spreizt die beiden Naturen deutlich auseinander", () => {
    // Vor der Entscheidung liegen sie nah beieinander, danach sind es Welten — genau deshalb
    // ist Ablehnen keine sichere Bank mehr.
    const vorher = Math.abs(anteil(bescheiden, 24) - anteil(geldgetrieben, 24));
    const nachher = Math.abs(anteil(bescheiden, 24, true) - anteil(geldgetrieben, 24, true));
    expect(nachher).toBeGreaterThan(vorher * 2);
  });
});
