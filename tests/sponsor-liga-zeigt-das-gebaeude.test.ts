import { describe, expect, it } from "vitest";

import { buildLeihPresentationForContract } from "@/lib/sponsor/sponsor-leih-presenter";
import type { TeamSponsorContract } from "@/lib/data/olyDataTypes";

/**
 * DIE LIGA-SPONSORENUEBERSICHT ZEIGTE NUR CASH — und wurde dadurch irrefuehrend.
 *
 * GEMELDET VON CHRIS an Last Ride: „39 mio ... das passt gar nicht so ein starkes team und der
 * sponsor steht hier so schlecht". Nachgemessen war die Karte kein Fehlgriff, sondern ein TAUSCH:
 * weniger Cash gegen ein Gebaeude, das im Selbstbau ein Vielfaches kosten wuerde. Auf dem frischen
 * Spielstand trugen 128 von 160 Angeboten (80 %) eine Leihe, und die sechs Teams mit dem
 * schwaechsten Cash hielten AUSNAHMSLOS ein Gebaeude auf Stufe 5.
 *
 * Eine reine Cash-Spalte kann so eine Karte gar nicht anders darstellen als schlecht.
 *
 * DIESER TEST HAELT DIE RECHENSTELLE FEST, aus der die Spalte liest. Er prueft NICHT, ob eine
 * Zeichenkette im Quelltext steht — sondern dass `buildLeihPresentationForContract` fuer einen
 * laufenden Vertrag die Groessen liefert, welche die Spalte braucht, und dass sie den ZUSTAND des
 * Spielstands beruecksichtigt statt den Anfangszustand der Karte zu wiederholen.
 */

const BASIS_LEIHE = {
  facilityId: "academy",
  stufenreihe: [5],
  startZustandPct: 85,
  verzichtJeSaison: [12.4],
  leihwertJeSaison: [30.2],
  rangmarke: 8,
  rangmarkenHaerte: "mild" as const,
  // Der Selbstbauwert kommt FERTIG vom Angebot (`sponsorLeihe.katalogkostenEndstufe`) und wird im
  // Presenter nur durchgereicht. 132 ist der real gemessene Wert einer Academy auf Stufe 5 aus dem
  // frischen Spielstand — kein ausgedachter Betrag.
  katalogkostenEndstufe: 132,
};

function vertrag(overrides: Partial<TeamSponsorContract> = {}): TeamSponsorContract {
  return {
    offerId: "season-1:L-R:security:gewöhnlich:2",
    seasonId: "season-1",
    teamId: "L-R",
    name: "Lufthansa Sky Partner",
    archetype: "security",
    components: [],
    payouts: {},
    termSeasons: 1,
    seasonsRemaining: 1,
    sponsorLeihe: BASIS_LEIHE,
    ...overrides,
  } as never;
}

describe("Liga-Sponsorenübersicht: die Gebäude-Spalte", () => {
  it("liefert Name, Stufe und Selbstbaukosten — die drei Zahlen der Spalte", () => {
    const leihe = buildLeihPresentationForContract({ contract: vertrag(), leihgaben: [], aktuellerRang: 5 });
    expect(leihe).not.toBeNull();
    // Nie die rohe ID in der Anzeige.
    expect(leihe!.facilityName).not.toBe("academy");
    expect(leihe!.facilityName.length).toBeGreaterThan(3);
    expect(leihe!.stufe).toBe(5);
    // Der Selbstbauwert ist der Vergleichsanker, der die Spalte ueberhaupt aussagekraeftig macht.
    expect(leihe!.katalogkostenEndstufe).toBeGreaterThan(0);
  });

  it("ohne Leihe gibt es nichts zu zeigen — und das ist eine Aussage, keine Lücke", () => {
    const leihe = buildLeihPresentationForContract({
      contract: vertrag({ sponsorLeihe: undefined } as never),
      leihgaben: [],
      aktuellerRang: 5,
    });
    // Genau dann zeigt die Spalte „—“: diese Karte zahlt dafuer vollen Cash.
    expect(leihe).toBeNull();
  });

  /**
   * DER GRUND, WARUM DIE SPALTE DEN SPIELSTAND LESEN MUSS UND NICHT NUR DEN VERTRAG.
   *
   * Eine Leihe kann RUHEN — faellt das Team unter die Rangmarke, wirkt das Gebaeude nicht mehr,
   * der Cash-Verzicht laeuft aber weiter. Wuerde die Spalte das ignorieren, wiese sie vollen
   * Gegenwert fuer ein Gebaeude aus, das gerade nichts tut. Das waere schlimmer als die reine
   * Cash-Spalte vorher, denn es sieht nach Information aus.
   */
  it("erkennt eine ruhende Leihe, statt sie als vollen Gegenwert auszuweisen", () => {
    const leihgabe = {
      facilityId: "academy",
      stufe: 5,
      zustandPct: 85,
      seasonId: "season-1",
      offerId: "season-1:L-R:security:gewöhnlich:2",
    };
    const ueberDerMarke = buildLeihPresentationForContract({
      contract: vertrag(),
      leihgaben: [leihgabe] as never,
      aktuellerRang: 5,
    });
    const unterDerMarke = buildLeihPresentationForContract({
      contract: vertrag(),
      leihgaben: [leihgabe] as never,
      aktuellerRang: 20,
    });
    expect(ueberDerMarke!.ruht).toBe(false);
    expect(unterDerMarke!.ruht).toBe(true);
    // Der Verzicht laeuft in beiden Faellen weiter — genau das macht das Ruhen teuer.
    expect(unterDerMarke!.verzichtDieseSaison).toBeCloseTo(ueberDerMarke!.verzichtDieseSaison, 4);
  });

  it("nimmt den gelebten Zustand aus dem Spielstand, nicht den Anfangszustand der Karte", () => {
    const frisch = buildLeihPresentationForContract({ contract: vertrag(), leihgaben: [], aktuellerRang: 5 });
    const verschlissen = buildLeihPresentationForContract({
      contract: vertrag(),
      leihgaben: [
        { facilityId: "academy", stufe: 5, zustandPct: 40, seasonId: "season-1", offerId: vertrag().offerId },
      ] as never,
      aktuellerRang: 5,
    });
    expect(frisch!.zustandPct).toBe(85);
    expect(verschlissen!.zustandPct).toBe(40);
    // Unter der Wirkschwelle faellt der Wirkungsgrad — sonst behauptete die Spalte eine Wirkung,
    // die das Gebaeude nicht mehr hat.
    expect(verschlissen!.wirkungsgradPct).toBeLessThan(frisch!.wirkungsgradPct);
    expect(verschlissen!.unterWirkschwelle).toBe(true);
  });
});
