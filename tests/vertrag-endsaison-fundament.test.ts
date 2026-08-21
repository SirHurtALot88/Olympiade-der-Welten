/**
 * ENTSCHIEDEN VON CHRIS, nach einer Fehlerserie an einem Tag: „Oder gibts ne bessere methode? der
 * buyout hängt ja auch noch dran."
 *
 * `contractLength` zählt die Saisons einschließlich der laufenden und wird beim Saisonwechsel
 * gesenkt. Dieselbe Zahl bedeutet damit zwei Dinge, je nachdem ob die Alterung gelaufen ist:
 *
 *     Laufzeit 1 VOR der Alterung  = letzte Saison, jetzt entscheiden
 *     Laufzeit 1 NACH der Alterung = noch eine volle Saison
 *
 * An Chris' Spielstand standen nach der Alterung 128 Spieler auf „auslaufend", die alle noch eine
 * ganze Saison hatten. Die Endsaison macht daraus eine Tatsache statt einer Restzahl.
 */
import { describe, expect, it } from "vitest";

import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import {
  endSaisonFuerNeuenVertrag,
  endSaisonNummer,
  laeuftMitDieserSaisonAus,
  restjahreNachDieserSaison,
  restlaufzeit,
} from "@/lib/contracts/vertragslaufzeit";

const saison = (nummer: number) => ({ season: { id: `season-${nummer}`, name: `Season ${nummer}` } }) as unknown as GameState;
const vertrag = (teil: Partial<RosterEntry>) => teil as RosterEntry;

describe("Die Endsaison wird aus dem Countdown abgeleitet, solange sie fehlt", () => {
  it("Laufzeit 1 heißt: diese Saison ist die letzte", () => {
    expect(endSaisonNummer(vertrag({ contractLength: 1 }), saison(3))).toBe(3);
    expect(laeuftMitDieserSaisonAus(vertrag({ contractLength: 1 }), saison(3))).toBe(true);
  });

  it("Laufzeit 3 in Saison 3 endet nach Saison 5", () => {
    expect(endSaisonNummer(vertrag({ contractLength: 3 }), saison(3))).toBe(5);
    expect(laeuftMitDieserSaisonAus(vertrag({ contractLength: 3 }), saison(3))).toBe(false);
  });

  it("Laufzeit 0 heißt: schon abgelaufen", () => {
    expect(endSaisonNummer(vertrag({ contractLength: 0 }), saison(3))).toBe(2);
    expect(restlaufzeit(vertrag({ contractLength: 0 }), saison(3))).toBe(0);
    expect(laeuftMitDieserSaisonAus(vertrag({ contractLength: 0 }), saison(3))).toBe(true);
  });

  it("eine gesetzte Endsaison schlägt den Countdown", () => {
    // Genau der Fall, um den es geht: der gespeicherte Countdown ist veraltet, die Endsaison nicht.
    const eintrag = vertrag({ contractLength: 1, contractEndSeasonNumber: 6 });
    expect(endSaisonNummer(eintrag, saison(3))).toBe(6);
    expect(restlaufzeit(eintrag, saison(3))).toBe(4);
    expect(laeuftMitDieserSaisonAus(eintrag, saison(3))).toBe(false);
  });
});

describe("Der Countdown geht nicht mehr aus dem Tritt", () => {
  /**
   * DIE EIGENTLICHE ZUSAGE. Beim Countdown musste jeder Saisonwechsel die Zahl senken — genau
   * dort entstanden Doppelalterung, Ausnahmen und die Frage „ist der Tick schon gelaufen?".
   * Aus einer festen Endsaison fällt die Restlaufzeit jeder Saison von selbst richtig heraus.
   */
  it("zählt über vier Saisons korrekt herunter, ohne dass jemand etwas fortschreibt", () => {
    const eintrag = vertrag({ contractLength: 99, contractEndSeasonNumber: 6 });
    expect([3, 4, 5, 6, 7].map((nummer) => restlaufzeit(eintrag, saison(nummer)))).toEqual([4, 3, 2, 1, 0]);
  });

  it("meldet „läuft aus“ genau in der Endsaison, nicht davor", () => {
    const eintrag = vertrag({ contractLength: 99, contractEndSeasonNumber: 6 });
    expect([4, 5, 6, 7].map((nummer) => laeuftMitDieserSaisonAus(eintrag, saison(nummer)))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});

describe("Die Restjahre, an denen der Buyout hängt", () => {
  it("zählen die laufende Saison nicht mit — sie ist gespielt", () => {
    const eintrag = vertrag({ contractLength: 99, contractEndSeasonNumber: 6 });
    expect([3, 4, 5, 6, 7].map((nummer) => restjahreNachDieserSaison(eintrag, saison(nummer)))).toEqual([3, 2, 1, 0, 0]);
  });

  it("sind bei einem auslaufenden Vertrag null — es gibt nichts wegzukaufen", () => {
    expect(restjahreNachDieserSaison(vertrag({ contractLength: 1 }), saison(3))).toBe(0);
    expect(restjahreNachDieserSaison(vertrag({ contractLength: 0 }), saison(3))).toBe(0);
  });
});

describe("Eine neue Unterschrift", () => {
  it("bindet die laufende Saison mit", () => {
    expect(endSaisonFuerNeuenVertrag(saison(3), 1)).toBe(3);
    expect(endSaisonFuerNeuenVertrag(saison(3), 2)).toBe(4);
    expect(endSaisonFuerNeuenVertrag(saison(3), 5)).toBe(7);
  });

  it("ist nie kürzer als eine Saison", () => {
    expect(endSaisonFuerNeuenVertrag(saison(3), 0)).toBe(3);
    expect(endSaisonFuerNeuenVertrag(saison(3), -4)).toBe(3);
  });
});

describe("Ohne erkennbare Saisonnummer bleibt der gespeicherte Countdown die Auskunft", () => {
  it("fällt nicht auf null zurück", () => {
    const ohneSaison = { season: { id: "irgendwas", name: "" } } as unknown as GameState;
    expect(restlaufzeit(vertrag({ contractLength: 3 }), ohneSaison)).toBe(3);
    expect(endSaisonNummer(vertrag({ contractLength: 3 }), ohneSaison)).toBeNull();
  });
});

/**
 * DER VERSATZ — ohne ihn verliert jeder Vertrag eine Saison.
 *
 * Die Alterung läuft am ENDE einer Saison, während diese noch die laufende ist. Ein Spielstand in
 * der Saisonende-Phase trägt danach Laufzeiten, die sich auf die KOMMENDE Saison beziehen, während
 * die Saisonnummer noch die alte ist. Countdown und Saisonnummer passen dann nicht zusammen.
 *
 * An Chris' Spielstand nachgerechnet (Saison 1, Alterung gelaufen) — die rechte Spalte ist der
 * Wert, den der Spieler VOR der Alterung trug, also die Wahrheit:
 *
 *     Jorund       3 -> 2   richtige Endsaison 3
 *     Xelara       1 -> 0   richtige Endsaison 1
 *     Lulu         4 -> 3   richtige Endsaison 4
 *     King Arlen   4 -> 3   richtige Endsaison 4
 */
describe("Ist die Alterung schon gelaufen, verschiebt sich die Ableitung um eine Saison", () => {
  const gealtert = { alterungBereitsGelaufen: true };

  it("trifft die Endsaison, die der Vertrag vor der Alterung hatte", () => {
    // Laufzeiten NACH der Alterung, Erwartung = Endsaison aus den Werten davor.
    const faelle: Array<[number, number]> = [
      [2, 3],
      [0, 1],
      [3, 4],
    ];
    for (const [laufzeitDanach, erwarteteEndsaison] of faelle) {
      expect(endSaisonNummer(vertrag({ contractLength: laufzeitDanach }), saison(1), gealtert)).toBe(
        erwarteteEndsaison,
      );
    }
  });

  it("ohne den Versatz käme jeder Vertrag eine Saison zu kurz heraus", () => {
    expect(endSaisonNummer(vertrag({ contractLength: 2 }), saison(1))).toBe(2);
    expect(endSaisonNummer(vertrag({ contractLength: 2 }), saison(1), gealtert)).toBe(3);
  });

  it("lässt eine bereits gespeicherte Endsaison unangetastet", () => {
    // Der Versatz ist eine Ableitungshilfe für Altstände, keine Korrektur echter Werte.
    const eintrag = vertrag({ contractLength: 2, contractEndSeasonNumber: 9 });
    expect(endSaisonNummer(eintrag, saison(1), gealtert)).toBe(9);
  });
});
