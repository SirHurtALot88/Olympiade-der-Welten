/**
 * GEMELDET VON CHRIS: „beim letzten spieltag könnte es cool sein die top teams die noch chance auf
 * die meisterschaft haben etwas hervorzuheben damit man den meisterschaftskampf im blick hat"
 *
 * Die Obergrenze stammt ebenfalls von ihm, weil sie im Code nirgends stand: „ca 3,3 punkte pro
 * teilnehmendem spieler und 4 spieler sind minimum und 12 das maximum an einem spieltag."
 */
import { describe, expect, it } from "vitest";

import {
  MAX_POINTS_PER_MATCHDAY,
  buildTitleRace,
} from "@/lib/season/title-race";

describe("Meisterschaftskampf am letzten Spieltag", () => {
  it("nimmt Chris' Obergrenze: 12 Spieler mal 3,3 Punkte", () => {
    expect(MAX_POINTS_PER_MATCHDAY).toBeCloseTo(39.6, 5);
  });

  it("haelt jeden im Rennen, der den Rueckstand an einem Spieltag noch aufholen kann", () => {
    const race = buildTitleRace([
      { teamId: "fuehrend", points: 144.3 },
      { teamId: "knapp", points: 133.7 }, // 10,6 zurueck — locker drin
      { teamId: "grenzfall", points: 144.3 - 39.6 }, // exakt die Obergrenze — noch drin
      { teamId: "raus", points: 144.3 - 39.7 }, // ein Zehntel zu weit
    ]);

    expect(race.leaderId).toBe("fuehrend");
    expect([...race.contenderIds].sort()).toEqual(["fuehrend", "grenzfall", "knapp"]);
    expect(race.contenderIds.has("raus")).toBe(false);
  });

  it("rechnet konservativ: der Verfolger bekommt das Maximum, der Fuehrende null", () => {
    // Ein Team, das GENAU die Obergrenze zurueckliegt, bleibt drin. Wuerde man dem Fuehrenden auch
    // nur einen Punkt zugestehen, fiele es raus — und damit ein echter Titelkandidat unter den
    // Tisch. Lieber eines zu viel hervorheben als eines zu wenig.
    const race = buildTitleRace([
      { teamId: "A", points: 100 },
      { teamId: "B", points: 100 - MAX_POINTS_PER_MATCHDAY },
    ]);
    expect(race.contenderIds.has("B")).toBe(true);
  });

  it("zaehlt den Fuehrenden selbst mit", () => {
    // Sonst waere die Hervorhebung „alle ausser dem Meister" — genau verkehrt herum.
    const race = buildTitleRace([{ teamId: "A", points: 50 }, { teamId: "B", points: 10 }]);
    expect(race.contenderIds.has("A")).toBe(true);
  });

  it("liefert den Rueckstand fuer die Kopfzeile", () => {
    const race = buildTitleRace([
      { teamId: "A", points: 144.3 },
      { teamId: "B", points: 133.7 },
    ]);
    expect(race.gapByTeamId.get("A")).toBeCloseTo(0, 5);
    expect(race.gapByTeamId.get("B")).toBeCloseTo(10.6, 5);
  });

  it("behandelt einen fehlenden Punktestand nicht als Null", () => {
    // Ein Team ohne Wert waere mit 0 Punkten scheinbar abgeschlagen — das ist eine Aussage, die die
    // Daten nicht hergeben. Es faellt heraus, statt falsch einsortiert zu werden.
    const race = buildTitleRace([
      { teamId: "hat", points: 40 },
      { teamId: "fehlt", points: null },
    ]);
    expect(race.contenderIds.has("fehlt")).toBe(false);
    expect(race.gapByTeamId.has("fehlt")).toBe(false);
    expect(race.leaderId).toBe("hat");
  });

  it("kommt mit einer leeren Liga klar, statt zu raten", () => {
    const race = buildTitleRace([]);
    expect(race.leaderId).toBeNull();
    expect(race.contenderIds.size).toBe(0);
  });
});
