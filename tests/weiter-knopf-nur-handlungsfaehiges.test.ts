import { describe, expect, it } from "vitest";

import { isPrimaryInboxCandidate } from "@/lib/foundation/game-inbox-service";
import type { GameInboxItem } from "@/lib/data/olyDataTypes";

/**
 * DER WEITER-KNOPF HING AN EINER BEOBACHTUNG — Chris' Meldung vom 19.08.
 *
 *   „der Flow haengt bei Training pruefen fest - weiss nicht warum dabei muesste er auf die
 *    Einsatzliste verweisen, training ist erledigt"
 *
 * NACHGEMESSEN an seinem Spielstand: `isTeamTrainingComplete` war TRUE und der Flow-Schritt
 * `check_training` stand auf `completed`. „Training pruefen" kam gar nicht vom Flow, sondern war
 * der Handlungstext des Eintrags `player_health_fatigue_risk` — hoechste Quellen-Prioritaet, bei
 * Fatigue >= 80 dazu `critical`.
 *
 * Erhoehte Ermuedung mitten im Spieltag aendert sich durch Draufdruecken nicht: der Knopf schickt
 * einen ins Training, dort steht dasselbe, und danach belegt er den Knopf wieder. Dieselbe Lehre
 * gab es hier schon einmal bei „Board-Ziel verfehlt".
 *
 * MESSUNG vorher/nachher am selben Spielstand: 12 waehlbare Eintraege -> 3, und auf dem Knopf
 * steht statt „Training pruefen" (Ziel Training) nun „Lineup pruefen" (Ziel Einsatzliste) —
 * genau das, was Chris erwartet hat.
 */

function eintrag(overrides: Partial<GameInboxItem>): GameInboxItem {
  return {
    itemId: "x",
    saveId: "s",
    seasonId: "season-1",
    category: "training",
    severity: "warning",
    title: "T",
    description: "D",
    targetView: "trainingCompact",
    targetParams: {},
    status: "open",
    createdAt: "2026-08-19T00:00:00.000Z",
    source: "player_health_fatigue_risk",
    ...overrides,
  } as GameInboxItem;
}

describe("Weiter-Knopf: Beobachtungen führen den Spielfluss nicht", () => {
  it("Ermüdung, Trainingslast und Schonung kommen nicht auf den Knopf", () => {
    for (const source of ["player_health_fatigue_risk", "player_health_training_load", "player_health_lineup_rest"]) {
      expect({ source, kandidat: isPrimaryInboxCandidate(eintrag({ source })) }).toEqual({ source, kandidat: false });
    }
  });

  it("auch dann nicht, wenn sie als kritisch gemeldet sind", () => {
    /*
     * Der Fall, der Chris getroffen hat: ab Fatigue 80 wird der Eintrag `critical` und schlaegt
     * damit JEDE Prioritaet. Eine Dringlichkeit macht eine Beobachtung aber nicht handlungsfaehig.
     */
    expect(isPrimaryInboxCandidate(eintrag({ source: "player_health_fatigue_risk", severity: "critical" }))).toBe(
      false,
    );
  });

  it("handlungsfähige Gesundheits-Einträge bleiben vorn", () => {
    // Ein verletzter Spieler in der Aufstellung WILL ersetzt werden — das ist eine Handlung.
    expect(
      isPrimaryInboxCandidate(
        eintrag({ source: "player_health_injury", category: "task", targetView: "lineup", severity: "critical" }),
      ),
    ).toBe(true);
  });

  it("der übrige Postfach-Betrieb bleibt unverändert", () => {
    expect(isPrimaryInboxCandidate(eintrag({ source: "lineup_drafts", category: "task" }))).toBe(true);
    expect(isPrimaryInboxCandidate(eintrag({ source: "game_flow_controller", category: "task" }))).toBe(true);
    // Geschlossenes bleibt geschlossen.
    expect(isPrimaryInboxCandidate(eintrag({ source: "lineup_drafts", category: "task", status: "done" }))).toBe(false);
    // Reine Nachrichten ohne Dringlichkeit waren nie Kandidaten.
    expect(isPrimaryInboxCandidate(eintrag({ source: "season_snapshots", category: "news", severity: "info" }))).toBe(
      false,
    );
  });

  it("die Einträge verschwinden nicht — sie führen nur nicht mehr", () => {
    /*
     * Wichtig fuer die Bewertung dieser Aenderung: die Warnung bleibt im Postfach sichtbar, mit
     * Dringlichkeit und Begruendung. Genommen wird ihr nur der Spielfluss.
     */
    const quelle = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "lib/foundation/game-inbox-service.ts"),
      "utf8",
    ) as string;
    expect(quelle).toContain('ctaLabel: "Training prüfen"');
    expect(quelle).toContain('source: "player_health_fatigue_risk"');
  });
});
