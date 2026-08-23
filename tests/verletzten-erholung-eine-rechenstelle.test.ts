import { describe, expect, it } from "vitest";

import type { GameState, InjuryEventRecord } from "@/lib/data/olyDataTypes";
import {
  calculatePlayerRecovery,
  calculateTeamRecovery,
  INJURY_RECOVERY_FACTOR,
  INJURY_RECOVERY_PCT,
} from "@/lib/fatigue/fatigue-injury-service";
import { injuryEventToPlayerHistoryRecord } from "@/lib/foundation/player-injury-history";

/**
 * DIE VERLETZTEN-ERHOLUNG STAND AN VIER STELLEN — und Chris' Entscheidung erreichte nur eine.
 *
 * CHRIS: „die verletzten erholung auf 1,0 gesetzt werden!"
 *
 * Umgesetzt war das in `calculatePlayerRecovery` (was das Spiel rechnet). Danebendran lagen drei
 * eingetippte Halbierungen:
 *
 *  1. `calculateTeamRecovery` rechnete weiter `normalRecovery * 0.5` — und genau diese Funktion
 *     benutzen `export-fatigue-injury-audit.ts` und `export-injury-balance-audit.ts`. Die beiden
 *     Werkzeuge, mit denen die Balance BEWERTET wird, haetten also ein anderes Spiel vermessen
 *     als das, das laeuft. Das ist die teuerste Sorte Fehler: eine Messung, der man glaubt.
 *  2. Der Spieler-Drawer schrieb „Regeneration 50%" — direkt neben den vollen Wert.
 *  3. Die Verletzungshistorie fiel auf 50 zurueck, wenn ein Ereignis keine Werte mitfuehrt.
 *
 * WAS DIESER TEST FESTHAELT ist nicht die Zahl 1,0 — die darf Chris jederzeit wieder aendern.
 * Festgehalten wird, dass alle Stellen DERSELBEN Zahl folgen. Gegenprobe: schreibt man in
 * `calculateTeamRecovery` wieder `* 0.5`, wird der erste Fall rot, ohne dass irgendeine
 * Erwartung eine konkrete Zahl nennt.
 */

function spielstand(): GameState {
  return {
    season: { id: "season-1", name: "Season 1" },
    seasonState: {},
    teams: [{ teamId: "A-A", name: "Alpha", cash: 100 }],
    players: [],
    rosters: [],
  } as never;
}

describe("Verletzten-Erholung: eine Zahl, nicht vier", () => {
  it("Team- und Spieler-Rechnung ziehen denselben Faktor", () => {
    const gs = spielstand();
    const team = calculateTeamRecovery(gs, "A-A");
    // „mittel" ist der Trainingsmodus ohne Auf- oder Abschlag; damit sind beide Wege vergleichbar.
    const spieler = calculatePlayerRecovery(gs, "A-A", "mittel");
    expect(spieler.normalRecovery).toBeCloseTo(team.normalRecovery, 2);
    expect(team.injuryRecovery).toBeCloseTo(spieler.injuryRecovery, 2);
    expect(team.injuryRecovery).toBeCloseTo(team.normalRecovery * INJURY_RECOVERY_FACTOR, 2);
  });

  it("die Prozentangabe der Anzeige ist der Faktor, keine getippte Zahl", () => {
    expect(INJURY_RECOVERY_PCT).toBe(Math.round(INJURY_RECOVERY_FACTOR * 100));
  });
});

describe("Verletzungshistorie: gespeicherte Vergangenheit schlaegt den heutigen Faktor", () => {
  function ereignis(overrides: Partial<InjuryEventRecord>): InjuryEventRecord {
    return {
      eventId: "e1",
      saveId: "s1",
      seasonId: "season-1",
      matchdayId: "md-1",
      teamId: "A-A",
      playerId: "p1",
      fatigueBefore: 88,
      riskPercent: 25,
      roll: 3,
      result: "injured",
      timestamp: "2026-01-01T00:00:00.000Z",
      ...overrides,
    } as InjuryEventRecord;
  }

  it("rechnet den Prozentsatz aus dem Ereignis — ein alter 0,5-Eintrag bleibt 50 %", () => {
    // Geschichte muss stimmen, nicht der Regel folgen: dieser Ausfall PASSIERTE mit halber
    // Erholung. Ihn nachtraeglich auf 100 % zu heben waere eine Faelschung.
    const record = injuryEventToPlayerHistoryRecord(
      ereignis({ normalRecovery: 28, injuryRecovery: 14 }),
      spielstand(),
    );
    expect(record?.injuryRecoveryPct).toBe(50);
  });

  it("faellt ohne gespeicherte Werte auf den HEUTIGEN Faktor zurueck, nicht auf 50", () => {
    // Schlanke Bestandszeilen tragen die Erholung nicht mit (`save-payload-slimming`). Hier stand
    // eine getippte 50 — die haette nach der Umstellung eine Halbierung behauptet, die es im
    // Spiel nicht mehr gibt.
    const record = injuryEventToPlayerHistoryRecord(ereignis({}), spielstand());
    expect(record?.injuryRecoveryPct).toBe(INJURY_RECOVERY_PCT);
  });
});
