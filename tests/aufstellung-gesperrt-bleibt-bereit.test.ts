/**
 * EINE GESPERRTE AUFSTELLUNG BLEIBT BEREIT — AUCH WENN SPÄTER JEMAND GENEST.
 *
 * GEMELDET VON CHRIS: „hier sagt er P-C nicht ready obwohl ich ready bin und auch auf platz 3
 * gescored habe … bitte mal prüfen woran das liegt ob die verletzungen schuld sind und das
 * scoring blocken weil ich nur 2 spieler in D1 drin hatte oder so?"
 *
 * BEFUND, am Live-Spielstand nachgemessen (Save `…-0kalpx`, Spieltag 6, Pirate Crew):
 *
 *   Kader 8 Spieler · Aufstellung `locked` mit 7 Einträgen · gefordert 11 Slots (6 + 5)
 *
 * Mit 8 Spielern sind 11 Slots nie zu füllen — `isTeamMatchdayLineupComplete` konnte nie greifen.
 * Getragen hat die Bereitschaft der dritte Weg: „alle EINSATZBEREITEN Spieler sind aufgestellt".
 * Beim Abgeben stimmte das. Danach wechselte Lexa von `injured` auf `recovering` und zählte
 * seither als einsatzbereit — aufgestellt war sie nicht, und in einer gesperrten Liste konnte sie
 * es auch nicht mehr werden.
 *
 * Ein Spieler, der GENESEN ist, hat das Team also rücklaufend „nicht bereit" gemacht — für einen
 * Spieltag, den es bereits gespielt hatte. Die Verletzungen waren schuld, aber in der Richtung,
 * die man nicht erwartet: nicht das Fehlen, sondern die Rückkehr.
 *
 * Dieselbe Familie wie die anderen Funde: zum falschen Zeitpunkt gemessen. Die Prüfung fragt die
 * Verfügbarkeit von JETZT, die Aufstellung stammt von VORHER — und ist unänderbar.
 *
 * Gepinnt wird die EIGENSCHAFT: solange die Liste änderbar ist, bleibt die Live-Prüfung scharf;
 * ab `locked` ist die abgegebene Liste die Antwort.
 */
import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import {
  isTeamMatchdayLineupOperationallyReady,
  isTeamMatchdayLineupSealed,
} from "@/lib/foundation/matchday-lineup-readiness";

const TEAM = "P-C";
const MATCHDAY = "matchday-6";
const SEASON = "season-1";

/**
 * Kader von vier Spielern, von denen einer als `recovering` gilt — also wieder einsatzbereit.
 * Aufgestellt sind nur die anderen drei: genau Chris' Lage.
 */
function zustand(): GameState {
  return {
    season: { id: SEASON },
    matchdayState: { matchdayId: MATCHDAY },
    teams: [{ teamId: TEAM, name: "Pirate Crew", shortCode: TEAM }],
    players: ["p-1", "p-2", "p-3", "p-genesen"].map((id) => ({ id, name: id, teamId: TEAM })),
    rosters: [{ teamId: TEAM, playerIds: ["p-1", "p-2", "p-3", "p-genesen"] }],
    disciplines: [],
    seasonState: {
      // Gefordert sind 6 + 5 Slots — bei vier Kaderspielern nie erfuellbar. Genau Chris' Lage:
      // die Vollstaendigkeits-Pruefung konnte nie greifen, getragen hat der Verfuegbarkeits-Weg.
      disciplineSchedule: [
        {
          seasonId: SEASON,
          matchdayId: MATCHDAY,
          discipline1: { disciplineId: "d-1", playerCount: 6 },
          discipline2: { disciplineId: "d-2", playerCount: 5 },
        },
      ],
      lineupDrafts: [],
      playerAvailabilityState: [
        // Wieder frei — aber eben erst, NACHDEM die Liste abgegeben war.
        { playerId: "p-genesen", teamId: TEAM, injuryStatus: "recovering", injuryUntilMatchday: MATCHDAY },
      ],
      matchdayResults: [{ seasonId: SEASON, matchdayId: MATCHDAY }],
    },
  } as unknown as GameState;
}

function aufstellung(status: LineupDraft["status"]): LineupDraft {
  return {
    seasonId: SEASON,
    matchdayId: MATCHDAY,
    teamId: TEAM,
    status,
    entries: ["p-1", "p-2", "p-3"].map((playerId, slotIndex) => ({ playerId, slotIndex })),
  } as unknown as LineupDraft;
}

describe("Aufstellung · gesperrt heisst entschieden", () => {
  it("bleibt bereit, wenn nach dem Sperren jemand genest", () => {
    // Der gemeldete Fall. Vorher: false → „Noch nicht startklar — es fehlt noch: Pirate Crew".
    expect(isTeamMatchdayLineupOperationallyReady(zustand(), TEAM, aufstellung("locked"))).toBe(true);
  });

  it("gilt genauso für eine bereits aufgeloeste Aufstellung", () => {
    expect(isTeamMatchdayLineupOperationallyReady(zustand(), TEAM, aufstellung("resolved"))).toBe(true);
  });

  /**
   * DIE GEGENPROBE, und der eigentliche Grund für die Unterscheidung: solange die Liste noch
   * änderbar ist, IST der Hinweis nützlich — der Spieler kann den Genesenen nachtragen. Würde
   * hier ebenfalls „bereit" stehen, ginge die Warnung verloren, die es geben soll.
   */
  it("bleibt streng, solange die Aufstellung noch geaendert werden kann", () => {
    expect(isTeamMatchdayLineupOperationallyReady(zustand(), TEAM, aufstellung("submitted"))).toBe(false);
    expect(isTeamMatchdayLineupOperationallyReady(zustand(), TEAM, aufstellung("draft"))).toBe(false);
  });

  it("macht aus einer LEEREN Aufstellung auch gesperrt keine bereite", () => {
    // Ohne einen einzigen Eintrag gibt es nichts, was „entschieden" waere.
    const leer = { ...aufstellung("locked"), entries: [] } as unknown as LineupDraft;
    expect(isTeamMatchdayLineupOperationallyReady(zustand(), TEAM, leer)).toBe(false);
  });

  it("unterscheidet gesperrt von bloss abgeschickt", () => {
    expect(isTeamMatchdayLineupSealed(aufstellung("locked"))).toBe(true);
    expect(isTeamMatchdayLineupSealed(aufstellung("resolved"))).toBe(true);
    expect(isTeamMatchdayLineupSealed(aufstellung("submitted"))).toBe(false);
    expect(isTeamMatchdayLineupSealed(null)).toBe(false);
  });
});

describe("Wertung · ein abgelehnter Commit darf nicht wie ein gebuchter aussehen", () => {
  const scope = "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx";
  const arena = "app/foundation/discipline-stage/DisciplineStageArena.tsx";

  it("wirft bei abgelehnter Buchung, statt normal zurueckzugeben", async () => {
    // Die Buehne wertet nur aus, OB der Aufruf durchging. Ein `return` bei NICHT gebucht landete
    // im `then` — sie meldete „Gewertet", obwohl nichts gebucht war.
    const fs = await import("node:fs");
    const quelle = fs.readFileSync(scope, "utf8");
    expect(quelle).toContain("throw new DisciplineCommitBlockedError(detail)");
  });

  it("zeigt den Grund an, statt ihn zu verschlucken", async () => {
    const fs = await import("node:fs");
    const quelle = fs.readFileSync(arena, "utf8");
    expect(quelle).toContain("commitFailureReason");
    expect(quelle).toContain("Die Punkte wurden nicht gebucht — ");
  });
});
