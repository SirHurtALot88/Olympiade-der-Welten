/**
 * GEMELDET: „S1 steht hier noch nicht welchen rank sie hatten, und da könnte man gut noch die
 * punkte ergänzen" — die Saison-Verlauf-Karte zeigte fuer Saison 1 nur „—", dazu „Kein
 * Rang-Verlauf vorhanden" und „Best #25 · Ø #25", also nur den einen Live-Wert.
 *
 * BEFUND, am Live-Spielstand nachgesehen: es fehlten keine Daten. Der Saison-1-Schnappschuss ist
 * vollstaendig, alle 32 Teams mit Rang und Punkten (S-C: Rang 19, 86.3 Punkte, 0 Teams ohne Rang).
 * Er kommt nur nie im Browser an — `compactFoundationInitialGameState` streicht `seasonSnapshots`
 * aus der Anfangsladung, weil daran Spielerleistungen und Spieltagsergebnisse haengen. Ohne
 * Schnappschuss faellt die Historie auf eine Platzhalterzeile mit `rank: null` zurueck, und genau
 * die zeigt die Karte als „—".
 *
 * Statt der vollen Schnappschuesse faehrt jetzt eine schlanke Projektion mit.
 */
import { describe, expect, it } from "vitest";

import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";
import { projiziereSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";

/** Ein Schnappschuss im Zuschnitt des echten Spielstands — inklusive der schweren Anhaenge. */
function baueSchnappschuss(seasonId: string) {
  return {
    snapshotId: `snap-${seasonId}`,
    seasonId,
    seasonName: `Season ${seasonId.slice(-1)}`,
    status: "completed",
    teamSnapshots: [
      {
        teamId: "S-C",
        teamCode: "S-C",
        teamName: "Stronghold Crusaders",
        rank: 19,
        points: 86.3,
        disciplinePoints: 90.2,
        disciplinePointsByArea: { pow: 45.4, spe: 10.6, men: 12.7, soc: 21.5 },
        cashEnd: 91.32,
        salaryTotalEnd: 46.34,
        marketValueTotalEnd: 174.41,
        guv: 7.5,
      },
    ],
    transferSnapshots: [
      { type: "sell", playerId: "p-1", playerName: "Gralakar", fromTeamId: "S-C", toTeamId: null, amount: 25.68 },
    ],
    // Das Schwergewicht, wegen dem gestrichen wird:
    playerPerformances: Array.from({ length: 400 }, (_, index) => ({ playerId: `p-${index}` })),
    matchdayResults: Array.from({ length: 10 }, (_, index) => ({ id: `md-${index}` })),
  };
}

function baueSpielstand(snapshots: unknown[]) {
  return {
    saveVersion: 1,
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: [] },
    teams: [{ teamId: "S-C", humanControlled: true }],
    rosters: [],
    players: [],
    transferHistory: [],
    logs: [],
    matchdayState: { matchdayId: "season-2-matchday-1" },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      seasonSnapshots: snapshots,
      standingsApplyLogs: [],
      matchdayResults: [],
      disciplineResults: [],
      lineupDrafts: [],
    },
  } as never;
}

describe("Saison-Verlauf: die abgeschlossenen Saisons erreichen den Browser", () => {
  it("die Anfangsladung traegt Rang und Punkte der Vorsaison", () => {
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss("season-1")]));
    const historie = kompakt.seasonState.foundationSeasonHistory ?? [];
    expect(historie).toHaveLength(1);
    const team = historie[0]!.teams.find((entry) => entry.teamId === "S-C");
    // Genau die zwei Werte aus der Meldung.
    expect(team?.rank).toBe(19);
    expect(team?.points).toBe(86.3);

    /**
     * Cash und Marktwert liegen als ROHWERTE bei, nicht vorab zusammengefasst: die Ewige Tabelle
     * waehlt hier anders als die Historienzeile (Eintrittsstand statt Saisonabschluss), und am
     * Live-Spielstand weichen die zwei Regeln bei 30 von 32 Teams voneinander ab. Der Schnappschuss
     * dieses Falls traegt seinen Marktwert unter `marketValueTotalEnd`.
     */
    expect(team?.cashEnd).toBe(91.32);
    expect(team?.marketValueTotalEnd).toBe(174.41);
    expect(team?.marketValueEnd).toBeNull();
    // Die Regel der Historienzeile, wie der Verbraucher sie anwendet — unveraendert 174.41.
    expect(team?.marketValueSeasonEnd ?? team?.marketValueTotalEnd ?? team?.marketValueEnd).toBe(174.41);
  });

  it("die vollen Schnappschuesse bleiben gestrichen — sonst waere nichts gewonnen", () => {
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss("season-1")]));
    expect(kompakt.seasonState.seasonSnapshots).toBeUndefined();
    // Die Projektion darf die schweren Anhaenge nicht mitschleppen.
    const roh = JSON.stringify(kompakt.seasonState.foundationSeasonHistory);
    expect(roh).not.toContain("playerPerformances");
    expect(roh).not.toContain("matchdayResults");
  });

  /**
   * DIE FALLE, WEGEN DER DIE PROJEKTION EIN EIGENES FELD HAT.
   *
   * `preserveAppendOnlyArchive` entscheidet allein nach der ANZAHL der Eintraege. Haette die
   * Kurzfassung unter `seasonSnapshots` gestanden, waere sie gleich lang gewesen, haette den
   * Schutz passiert und beim naechsten Speichern die vollen Schnappschuesse dauerhaft ersetzt.
   */
  it("das Zurueckschreiben laesst die vollen Schnappschuesse unangetastet", () => {
    const bestand = baueSpielstand([baueSchnappschuss("season-1")]);
    const kompakt = compactFoundationInitialGameState(bestand);
    const zurueck = rehydrateGameStateAfterCompactPut(bestand, kompakt as never);

    const snapshots = zurueck.seasonState.seasonSnapshots as unknown[] | undefined;
    expect(snapshots).toHaveLength(1);
    expect((snapshots?.[0] as { playerPerformances?: unknown[] }).playerPerformances).toHaveLength(400);
  });

  it("die Kurzfassung wird beim Zurueckschreiben verworfen und nicht mitgespeichert", () => {
    const bestand = baueSpielstand([baueSchnappschuss("season-1")]);
    const kompakt = compactFoundationInitialGameState(bestand);
    const zurueck = rehydrateGameStateAfterCompactPut(bestand, kompakt as never);
    // Abgeleitete Anzeigefracht hat im Spielstand nichts zu suchen — sie wuerde still veralten.
    expect(zurueck.seasonState.foundationSeasonHistory).toBeUndefined();
  });
});

describe("Die Projektion selbst", () => {
  it("uebernimmt fehlende Werte als null statt sie zu erfinden", () => {
    const [eintrag] = projiziereSaisonHistorie([
      { snapshotId: "s", seasonId: "season-1", teamSnapshots: [{ teamId: "T-1" }] },
    ] as never);
    const team = eintrag!.teams[0]!;
    expect(team.rank).toBeNull();
    expect(team.points).toBeNull();
    expect(team.disciplinePointsByArea).toEqual({ pow: null, spe: null, men: null, soc: null });
  });

  it("faellt auf finalStandings zurueck, wenn teamSnapshots fehlen", () => {
    const [eintrag] = projiziereSaisonHistorie([
      { snapshotId: "s", seasonId: "season-1", finalStandings: [{ teamId: "T-1", rank: 3, points: 42 }] },
    ] as never);
    expect(eintrag!.teams[0]).toMatchObject({ teamId: "T-1", rank: 3, points: 42 });
  });
});
