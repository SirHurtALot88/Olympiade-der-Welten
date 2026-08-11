/**
 * DIE LEIHE WIRKT DURCH DEN GANZEN MOTOR, ohne dass der Motor von ihr weiss.
 *
 * `getTeamFacilityState` ist die eine Stelle, ueber die jede Wirkungsrechnung ihre Gebäudestufe
 * liest — Training, Erholung, Einnahmen, Scouting. Wird die Leihe dort eingerechnet, muss keine
 * dieser Rechnungen angefasst werden. Diese Suite prueft genau das an zwei echten Verbrauchern
 * statt an der Overlay-Funktion selbst (die hat ihre eigene Suite).
 *
 * Und sie haelt die wichtigste Grenze fest: die Leihe darf NIEMALS im eigenen Bestand landen.
 * Stuende sie dort, waere der Rueckfall am Vertragsende ein Loeschvorgang — und ein vergessener
 * Loeschvorgang verschenkt ein Gebäude auf Dauer.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  applyRecoveryFacilityModifiers,
  applyTrainingXpFacilityModifiers,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";

function baueSpielstand(input: {
  eigeneStufe?: number;
  leihgabe?: { facilityId: string; stufe: number; zustandPct: number; ruht?: boolean };
}): GameState {
  return {
    season: { id: "season-1" },
    seasonState: {
      teamFacilities:
        input.eigeneStufe == null
          ? {}
          : {
              "T-1": {
                facilities: {
                  training_center: { level: input.eigeneStufe, enabled: true, conditionPct: 100 },
                  recovery_center: { level: input.eigeneStufe, enabled: true, conditionPct: 100 },
                },
              },
            },
      sponsorLeihgabenByTeamId: input.leihgabe
        ? { "T-1": [{ ...input.leihgabe, seasonId: "season-1" }] }
        : undefined,
    },
  } as unknown as GameState;
}

describe("Leihgabe im Spielstand", () => {
  it("hebt das Trainingszentrum an, obwohl das Team selbst nichts gebaut hat", () => {
    const ohne = getTeamFacilityState(baueSpielstand({ eigeneStufe: 0 }), "T-1");
    const mit = getTeamFacilityState(
      baueSpielstand({ eigeneStufe: 0, leihgabe: { facilityId: "training_center", stufe: 3, zustandPct: 100 } }),
      "T-1",
    );

    // Der Verbraucher rechnet wie immer — er sieht nur eine hoehere Stufe.
    expect(applyTrainingXpFacilityModifiers(100, ohne).modifierPct).toBe(0);
    expect(applyTrainingXpFacilityModifiers(100, mit).modifierPct).toBe(42);
  });

  it("traegt den Zustand der Leihgabe bis in die Wirkung", () => {
    // Dieselbe Stufe, einmal neu und einmal abgenutzt — das ist die Vertragsvariable.
    const neu = getTeamFacilityState(
      baueSpielstand({ eigeneStufe: 0, leihgabe: { facilityId: "training_center", stufe: 3, zustandPct: 100 } }),
      "T-1",
    );
    const gebraucht = getTeamFacilityState(
      baueSpielstand({ eigeneStufe: 0, leihgabe: { facilityId: "training_center", stufe: 3, zustandPct: 40 } }),
      "T-1",
    );

    expect(applyTrainingXpFacilityModifiers(100, neu).modifierPct).toBe(42);
    expect(applyTrainingXpFacilityModifiers(100, gebraucht).modifierPct).toBeLessThan(42);
    expect(applyTrainingXpFacilityModifiers(100, gebraucht).modifierPct).toBeGreaterThan(0);
  });

  it("wirkt auch auf die Erholung — kein Sonderpfad je Gebaeudeart", () => {
    const mit = getTeamFacilityState(
      baueSpielstand({ eigeneStufe: 0, leihgabe: { facilityId: "recovery_center", stufe: 3, zustandPct: 100 } }),
      "T-1",
    );
    expect(applyRecoveryFacilityModifiers(20, mit).flatBonus).toBe(6);
  });

  it("laesst den eigenen Bestand stehen, wenn er besser ist", () => {
    const zustand = getTeamFacilityState(
      baueSpielstand({ eigeneStufe: 5, leihgabe: { facilityId: "training_center", stufe: 2, zustandPct: 100 } }),
      "T-1",
    );
    expect(zustand.facilities.training_center?.level).toBe(5);
  });

  it("zaehlt eine ruhende Leihe gar nicht", () => {
    const zustand = getTeamFacilityState(
      baueSpielstand({ eigeneStufe: 0, leihgabe: { facilityId: "training_center", stufe: 4, zustandPct: 100, ruht: true } }),
      "T-1",
    );
    expect(zustand.facilities.training_center?.level).toBe(0);
  });

  it("schreibt die Leihe NICHT in den eigenen Bestand", () => {
    // Die Grenze, an der der Rueckfall am Vertragsende haengt.
    const spielstand = baueSpielstand({
      eigeneStufe: 1,
      leihgabe: { facilityId: "training_center", stufe: 4, zustandPct: 100 },
    });
    const gelesen = getTeamFacilityState(spielstand, "T-1");

    expect(gelesen.facilities.training_center?.level).toBe(4);
    // Der gespeicherte Stand bleibt bei 1 — die Leihe existiert nur im Lesen.
    expect(spielstand.seasonState.teamFacilities?.["T-1"]?.facilities.training_center?.level).toBe(1);
  });

  it("aendert nichts an Spielstaenden ohne Leihgaben", () => {
    const ohne = getTeamFacilityState(baueSpielstand({ eigeneStufe: 2 }), "T-1");
    expect(ohne.facilities.training_center?.level).toBe(2);
    expect(ohne.facilities.training_center?.conditionPct).toBe(100);
  });
});
