import { describe, expect, it } from "vitest";

import {
  SPIELTAGS_TOPSPIELER_LIMIT,
  summiereSpieltagsTopSpieler,
  type SpieltagsTopSpielerZeile,
} from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";

/**
 * TOP-SPIELER: 24 STATT 12, IN ZWEI SPALTEN — Ticket #42.
 *
 * CHRIS: „die Top Player Liste könnte man noch ausweiten, dass man nicht nur die top 12 sondern
 * Top 24 hier sieht ohne dass man die Tabelle in der höhe größer macht, sondern nebeneinander."
 *
 * WAS HIER GEPRUEFT WIRD und was nicht: dass die QUELLE 24 Zeilen liefert und sie richtig
 * sortiert. Die Zweispaltigkeit selbst loest die Anzeige ueber `grid-auto-flow: column` — sie
 * schneidet die Liste also gar nicht, sondern laesst das Raster spaltenweise fuellen. Damit bleibt
 * der Index jeder Zeile der Index in der ungeteilten Liste, und `playerIdByRow` kann nicht
 * verrutschen. Genau deshalb ist diese Loesung der urspruenglich hier geplanten Aufteilung in
 * JS vorzuziehen — und deshalb pruefen die Tests dazu nichts mehr: es gibt nichts zu verrutschen.
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

  it("bleibt nach Punkten sortiert — die Ausweitung darf die Reihenfolge nicht anfassen", () => {
    const summiert = summiereSpieltagsTopSpieler(VIELE, new Set(["gewichtheben"]));
    const punkte = summiert.map((eintrag) => eintrag.points ?? 0);
    expect(punkte).toEqual([...punkte].sort((links, rechts) => rechts - links));
    expect(summiert[0]?.playerId).toBe("p0");
    expect(summiert[23]?.playerId).toBe("p23");
  });

  it("liefert weniger als das Limit, wenn es weniger Spieler gibt", () => {
    // Die Anzeige legt erst ab 12 Zeilen zwei Spalten an (`DisciplineStageTopPlayers`); darunter
    // bleibt es die einspaltige Liste von vorher. Hier zaehlt nur, dass die Quelle nicht
    // auffuellt.
    const wenige = summiereSpieltagsTopSpieler(VIELE.slice(0, 5), new Set(["gewichtheben"]));
    expect(wenige).toHaveLength(5);
  });
});
