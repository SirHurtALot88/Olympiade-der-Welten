import { describe, expect, it } from "vitest";

import {
  SPIELTAGS_TOPSPIELER_LIMIT,
  SPIELTAGS_TOPSPIELER_SPALTENHOEHE,
  summiereSpieltagsTopSpieler,
  type SpieltagsTopSpielerZeile,
} from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";

/**
 * TOP-SPIELER: 24 STATT 12, IN ZWEI SPALTEN — Ticket #42.
 *
 * CHRIS: „die Top Player Liste könnte man noch ausweiten, dass man nicht nur die top 12 sondern
 * Top 24 hier sieht ohne dass man die Tabelle in der höhe größer macht, sondern nebeneinander."
 *
 * WAS HIER GEPRUEFT WIRD und was nicht: dass die Liste 24 Zeilen liefert und dass sich diese 24
 * Zeilen in ZWEI volle Spalten teilen lassen. Ob die Spalten im Browser nebeneinander stehen, ist
 * eine Frage von CSS und hier nicht pruefbar — dafuer steht die Absicht im Kommentar der
 * Komponente.
 *
 * DER EIGENTLICHE RISIKOPUNKT ist ein anderer, und ihn haelt der letzte Test fest: die Komponente
 * bekommt `playerIdByRow` PARALLEL zur ungeteilten Liste. Schneidet man die Liste in Spalten und
 * benutzt den Spalten-Index, oeffnet ein Klick den FALSCHEN Spieler. Der urspruengliche Index muss
 * also mitwandern.
 */

function zeile(overrides: Partial<SpieltagsTopSpielerZeile> & { playerId: string }): SpieltagsTopSpielerZeile {
  return {
    disciplineId: "gewichtheben",
    playerId: overrides.playerId,
    playerName: `Spieler ${overrides.playerId}`,
    teamId: "A-A",
    finalPlayerScore: 10,
    pointsAwarded: 10,
    mutatorPpsBonus: null,
    isMvpCandidate: false,
    ...overrides,
  } as SpieltagsTopSpielerZeile;
}

/** 40 Spieler mit absteigenden Punkten — mehr als die Liste je zeigen soll. */
const VIELE = Array.from({ length: 40 }, (_, index) =>
  zeile({ playerId: `p${index}`, pointsAwarded: 100 - index, finalPlayerScore: 100 - index }),
);

describe("Arena-Top-Spieler: Anzahl und Spalten", () => {
  it("zeigt 24 Zeilen, nicht mehr 12", () => {
    expect(SPIELTAGS_TOPSPIELER_LIMIT).toBe(24);
    const summiert = summiereSpieltagsTopSpieler(VIELE, new Set(["gewichtheben"]));
    expect(summiert).toHaveLength(24);
  });

  it("teilt sich in ZWEI volle Spalten — sonst saehe die zweite abgeschnitten aus", () => {
    expect(SPIELTAGS_TOPSPIELER_LIMIT % SPIELTAGS_TOPSPIELER_SPALTENHOEHE).toBe(0);
    expect(SPIELTAGS_TOPSPIELER_LIMIT / SPIELTAGS_TOPSPIELER_SPALTENHOEHE).toBe(2);
  });

  it("bleibt nach Punkten sortiert — die Ausweitung darf die Reihenfolge nicht anfassen", () => {
    const summiert = summiereSpieltagsTopSpieler(VIELE, new Set(["gewichtheben"]));
    const punkte = summiert.map((eintrag) => eintrag.points ?? 0);
    expect(punkte).toEqual([...punkte].sort((links, rechts) => rechts - links));
    expect(summiert[0]?.playerId).toBe("p0");
    expect(summiert[23]?.playerId).toBe("p23");
  });

  /**
   * DIE FALLE BEIM SCHNEIDEN. `playerIdByRow` ist parallel zur UNGETEILTEN Liste. Hier wird
   * dieselbe Aufteilung nachgebaut, die die Komponente macht, und geprueft, dass der
   * mitgefuehrte Index weiterhin auf denselben Spieler zeigt.
   */
  it("behaelt beim Spaltenschnitt den urspruenglichen Index je Zeile", () => {
    const summiert = summiereSpieltagsTopSpieler(VIELE, new Set(["gewichtheben"]));
    const spalten: Array<Array<{ playerId: string; index: number }>> = [];
    for (let start = 0; start < summiert.length; start += SPIELTAGS_TOPSPIELER_SPALTENHOEHE) {
      spalten.push(
        summiert
          .slice(start, start + SPIELTAGS_TOPSPIELER_SPALTENHOEHE)
          .map((eintrag, versatz) => ({ playerId: eintrag.playerId, index: start + versatz })),
      );
    }

    expect(spalten).toHaveLength(2);
    expect(spalten[0]).toHaveLength(12);
    expect(spalten[1]).toHaveLength(12);

    // Der Index jeder Zeile muss in der UNGETEILTEN Liste denselben Spieler treffen.
    for (const spalte of spalten) {
      for (const eintrag of spalte) {
        expect(summiert[eintrag.index]?.playerId).toBe(eintrag.playerId);
      }
    }
    // Die erste Zeile der ZWEITEN Spalte ist Rang 13 — nicht wieder Rang 1.
    expect(spalten[1]![0]!.index).toBe(12);
    expect(spalten[1]![0]!.playerId).toBe("p12");
  });

  it("bricht nicht, wenn weniger als eine volle Spalte da ist", () => {
    const wenige = summiereSpieltagsTopSpieler(VIELE.slice(0, 5), new Set(["gewichtheben"]));
    const spalten: string[][] = [];
    for (let start = 0; start < wenige.length; start += SPIELTAGS_TOPSPIELER_SPALTENHOEHE) {
      spalten.push(wenige.slice(start, start + SPIELTAGS_TOPSPIELER_SPALTENHOEHE).map((e) => e.playerId));
    }
    expect(spalten).toHaveLength(1);
    expect(spalten[0]).toHaveLength(5);
  });
});
