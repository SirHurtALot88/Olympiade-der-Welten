/**
 * VERSCHLEISS UND WIRKSCHWELLE DER GEBAEUDE.
 *
 * Chris, zwei Vorgaben: „der verfall der gebäude ist mir auch zu schwach, da sollten über 3
 * seasons schon eher 50% fallen mal mehr mal weniger" und „mach mal volle gebäudeleistung bis
 * 80% darunter fällt es ab".
 *
 * Vorher: feste 8 Punkte je Saison, volle Wirkung bis 70. Ein Neubau stand nach drei Jahren bei
 * 76 und hatte nie an Wirkung verloren — die Warnschwelle wurde in der Praxis nie erreicht,
 * Reparatur war eine Vokabel ohne Anlass. Diese Suite haelt beide Groessen fest, und zwar an den
 * Eigenschaften (Band, Mittelwert, Streuung, Determinismus), nicht an einzelnen Zufallszahlen.
 */
import { describe, expect, it } from "vitest";

import {
  clampFacilityCondition,
  degradeFacilityCondition,
  FACILITY_CONDITION_FULL,
  FACILITY_CONDITION_WARNING,
  FACILITY_SEASON_DECAY_PAID,
  FACILITY_SEASON_DECAY_SPREAD_PAID,
  FACILITY_SEASON_DECAY_UNPAID,
  getFacilityEfficiencyPct,
  resolveFacilitySeasonDecay,
} from "@/lib/facilities/facility-condition";

describe("Wirkschwelle", () => {
  it("volle Wirkung bis 80, darunter linear fallend", () => {
    expect(FACILITY_CONDITION_WARNING).toBe(80);
    expect(getFacilityEfficiencyPct(FACILITY_CONDITION_FULL)).toBe(100);
    expect(getFacilityEfficiencyPct(80)).toBe(100);
    // Einen Punkt unter der Schwelle greift die Skalierung bereits.
    expect(getFacilityEfficiencyPct(79)).toBeLessThan(100);
    // Auf halber Strecke zur Schwelle wirkt das Gebaeude zur Haelfte.
    expect(getFacilityEfficiencyPct(40)).toBe(50);
    expect(getFacilityEfficiencyPct(0)).toBe(0);
  });
});

describe("Verschleiss je Saison", () => {
  it("faellt ueber drei Saisons um rund die Haelfte", () => {
    // Chris' Zielgroesse. Geprueft ueber viele Gebaeude, weil der Einzelfall streut.
    const verlaeufe = Array.from({ length: 400 }, (_, index) => {
      let zustand = FACILITY_CONDITION_FULL;
      for (let saison = 1; saison <= 3; saison += 1) {
        zustand = degradeFacilityCondition(zustand, true, `season-${saison}:team-${index}:training_center`);
      }
      return FACILITY_CONDITION_FULL - zustand;
    });
    const mittel = verlaeufe.reduce((summe, wert) => summe + wert, 0) / verlaeufe.length;

    expect(mittel).toBeGreaterThan(45);
    expect(mittel).toBeLessThan(56);
    // „mal mehr mal weniger" — es darf nicht bei allen gleich ausfallen.
    expect(new Set(verlaeufe).size).toBeGreaterThan(5);
  });

  it("ein Neubau rutscht in der zweiten Saison unter die Wirkschwelle", () => {
    // Das ist der eigentliche Zweck der Aenderung: vorher (8 je Saison) wurde die Schwelle nie
    // erreicht, Reparatur hatte nie einen Anlass.
    const nachEiner = FACILITY_CONDITION_FULL - (FACILITY_SEASON_DECAY_PAID + FACILITY_SEASON_DECAY_SPREAD_PAID);
    const nachZweien = FACILITY_CONDITION_FULL - 2 * (FACILITY_SEASON_DECAY_PAID - FACILITY_SEASON_DECAY_SPREAD_PAID);
    expect(nachEiner).toBeGreaterThanOrEqual(FACILITY_CONDITION_WARNING - 2);
    expect(nachZweien).toBeLessThan(FACILITY_CONDITION_WARNING);
  });

  it("streut um den Mittelwert und bleibt im Band", () => {
    const werte = Array.from({ length: 200 }, (_, index) => resolveFacilitySeasonDecay(true, `saat-${index}`));
    for (const wert of werte) {
      expect(wert).toBeGreaterThanOrEqual(FACILITY_SEASON_DECAY_PAID - FACILITY_SEASON_DECAY_SPREAD_PAID);
      expect(wert).toBeLessThanOrEqual(FACILITY_SEASON_DECAY_PAID + FACILITY_SEASON_DECAY_SPREAD_PAID);
    }
    const mittel = werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
    expect(Math.abs(mittel - FACILITY_SEASON_DECAY_PAID)).toBeLessThan(1.5);
  });

  it("wuerfelt deterministisch — derselbe Spielstand ergibt zweimal dasselbe", () => {
    const saat = "season-3:M-M:recovery_center";
    expect(resolveFacilitySeasonDecay(true, saat)).toBe(resolveFacilitySeasonDecay(true, saat));
    // Und zwei Gebaeude desselben Teams unterscheiden sich — ohne den Lawinenschritt waeren die
    // Saatworte zu aehnlich und kollidierten (derselbe Fehler wie einst bei den Formkarten).
    const proGebaeude = ["training_center", "recovery_center", "fan_shop", "analytics_room", "academy"].map(
      (id) => resolveFacilitySeasonDecay(true, `season-3:M-M:${id}`),
    );
    expect(new Set(proGebaeude).size).toBeGreaterThan(1);
  });

  it("ohne Saatwort faellt genau der Mittelwert an", () => {
    // Vorschau-Rechnungen und Erklaertexte haben keine Saison-/Team-Kennung — die duerfen nicht
    // heimlich einen Wurf machen, sonst zeigt die Vorschau etwas anderes als die Buchung.
    expect(resolveFacilitySeasonDecay(true)).toBe(FACILITY_SEASON_DECAY_PAID);
    expect(resolveFacilitySeasonDecay(false)).toBe(FACILITY_SEASON_DECAY_UNPAID);
  });

  it("unbezahlter Unterhalt kostet doppelt", () => {
    expect(FACILITY_SEASON_DECAY_UNPAID).toBe(FACILITY_SEASON_DECAY_PAID * 2);
    // Wer nie zahlt, verliert das Gebaeude in rund drei Saisons.
    expect(FACILITY_CONDITION_FULL - 3 * FACILITY_SEASON_DECAY_UNPAID).toBeLessThanOrEqual(0);
  });

  it("faellt nie unter null", () => {
    expect(degradeFacilityCondition(5, false, "saat")).toBe(0);
    expect(clampFacilityCondition(-20)).toBe(0);
  });
});
