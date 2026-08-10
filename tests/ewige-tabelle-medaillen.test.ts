/**
 * GEMELDET: „1 Season ist rum aber kein team hat seine medallien bekommen bitte fixen" — zur
 * Ewigen Tabelle, Ansicht „Medaillen", nach abgeschlossener Saison 1.
 *
 * BEFUND, am Live-Spielstand nachgezaehlt: die Daten sind vollstaendig. Der Saison-1-Schnappschuss
 * traegt 32 Teams mit 32 verschiedenen Raengen — Gold Z-H, Silber M-M, Bronze L-R. Kaputt war der
 * Weg in den Browser: `buildAllTimeTableModel` liest die Medaillen aus
 * `gameState.seasonState.seasonSnapshots`, und die streicht `compactFoundationInitialGameState`
 * aus der Anfangsladung. Ueber eine leere Liste gezaehlt ergibt jede Medaille null.
 *
 * Derselbe Zustellweg wie bei der Saison-Verlauf-Karte, aber ein anderer Verbraucher: die
 * Kurzfassung fuhr laengst mit, die Ewige Tabelle sah sie nur nicht an.
 */
import { describe, expect, it } from "vitest";

import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { alsSchnappschussErsatz } from "@/lib/persistence/foundation-season-history-projection";

/** Drei Teams auf den Podestplaetzen, eines daneben — wie im echten Spielstand ein Rang je Platz. */
const PODEST = [
  { teamId: "Z-H", teamCode: "Z-H", teamName: "Zauberhut", rank: 1, points: 144.3 },
  { teamId: "M-M", teamCode: "M-M", teamName: "Miez Mafia", rank: 2, points: 130.1 },
  { teamId: "L-R", teamCode: "L-R", teamName: "Lederrunde", rank: 3, points: 128.7 },
  { teamId: "S-C", teamCode: "S-C", teamName: "Stronghold Crusaders", rank: 19, points: 86.3 },
];

function baueSchnappschuss() {
  return {
    snapshotId: "snap-season-1",
    seasonId: "season-1",
    seasonName: "Season 1",
    status: "completed",
    archivedAt: "2026-08-01T00:00:00.000Z",
    entryRosterPatchedAt: "2026-08-08T06:08:41.229Z",
    entryRosterPatchedFromSeasonId: "season-2",
    finalStandings: PODEST.map((team) => ({
      ...team,
      disciplinePoints: team.points + 4,
      disciplinePointsByArea: { pow: 1, spe: 2, men: 3, soc: 4 },
      // Am Live-Spielstand weichen diese beiden bei 30 von 32 Teams voneinander ab.
      cashEntry: 56.8,
      cashEnd: 91.32,
      cashTotal: 12.8,
      marketValueTotalEnd: 174.41,
      marketValueEnd: 174.41,
      salaryTotalEnd: 46.34,
      guv: 7.5,
    })),
    // Das Schwergewicht, wegen dem ueberhaupt gestrichen wird:
    playerPerformances: Array.from({ length: 400 }, (_, index) => ({ playerId: `p-${index}` })),
    matchdayResults: Array.from({ length: 10 }, (_, index) => ({ id: `md-${index}` })),
  };
}

function baueSpielstand(snapshots: unknown[]) {
  return {
    saveVersion: 1,
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: [] },
    teams: PODEST.map((team) => ({
      teamId: team.teamId,
      shortCode: team.teamCode,
      name: team.teamName,
      humanControlled: team.teamId === "S-C",
    })),
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

function medaillenNach(teamId: string, model: ReturnType<typeof buildAllTimeTableModel>) {
  return model.rows.find((row) => row.teamId === teamId)?.medals ?? null;
}

describe("Ewige Tabelle: die Medaillen der abgeschlossenen Saison", () => {
  it("zaehlt Gold, Silber und Bronze auch dann, wenn die Anfangsladung die Schnappschuesse streicht", () => {
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss()]));
    // Das ist der Zustand im Browser — genau hier zaehlte die Tabelle vorher ueber eine leere Liste.
    expect(kompakt.seasonState.seasonSnapshots).toBeUndefined();

    const model = buildAllTimeTableModel({ gameState: kompakt, selectedTeamId: "S-C" });

    expect(medaillenNach("Z-H", model)).toMatchObject({ gold: 1, silver: 0, bronze: 0 });
    expect(medaillenNach("M-M", model)).toMatchObject({ gold: 0, silver: 1, bronze: 0 });
    expect(medaillenNach("L-R", model)).toMatchObject({ gold: 0, silver: 0, bronze: 1 });
    // Rang 19 bekommt nichts — auch nicht Top-5 oder Top-10.
    expect(medaillenNach("S-C", model)).toEqual({ gold: 0, silver: 0, bronze: 0, top5: 0, top10: 0 });
  });

  it("traegt die abgeschlossene Saison als Archiv, nicht als 'wird noch geladen'", () => {
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss()]));
    const model = buildAllTimeTableModel({ gameState: kompakt, selectedTeamId: "S-C" });

    // `hasArchive: false` blendet in der Ansicht den Hinweis ein, die erste Saison sei noch nicht
    // abgeschlossen — sie IST abgeschlossen.
    expect(model.hasArchive).toBe(true);
    expect(model.hasHistory).toBe(true);
    expect(model.archivedSeasonCount).toBe(1);
    expect(model.mostTitles?.teamId).toBe("Z-H");
  });

  it("uebernimmt Rang, Punkte und Titel der Vorsaison in die Zeile", () => {
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss()]));
    const model = buildAllTimeTableModel({ gameState: kompakt, selectedTeamId: "S-C" });

    const zeile = model.rows.find((row) => row.teamId === "S-C");
    expect(zeile?.seasons).toHaveLength(1);
    expect(zeile?.seasons[0]).toMatchObject({ seasonId: "season-1", isLive: false, rank: 19, points: 86.3 });
    expect(zeile?.cumulativePoints).toBe(86.3);
    expect(zeile?.bestRank).toBe(19);
    expect(model.rows.find((row) => row.teamId === "Z-H")?.titles).toBe(1);
  });

  /**
   * DER GRUND, WARUM DIE KURZFASSUNG DIE ROHWERTE TRAEGT UND NICHTS VORAB ZUSAMMENFASST.
   *
   * Die Historienzeile zeigt den SAISONABSCHLUSS (`cashEnd`), die Ewige Tabelle den
   * EINTRITTSSTAND der Folgesaison (`cashEntry`) — Chris' Vorgabe. Am Live-Spielstand liegen die
   * beiden bei 30 von 32 Teams auseinander. Haette die Projektion hier schon eine Zahl gewaehlt,
   * waere eine der beiden Ansichten zwangslaeufig falsch.
   */
  it("waehlt Cash nach der Regel der Ewigen Tabelle — Eintrittsstand, nicht Saisonende", () => {
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss()]));
    const model = buildAllTimeTableModel({ gameState: kompakt, selectedTeamId: "S-C" });

    const saison = model.rows.find((row) => row.teamId === "S-C")?.seasons[0];
    expect(saison?.cash).toBe(56.8);
    expect(saison?.cash).not.toBe(91.32);
    expect(saison?.marketValue).toBe(174.41);
  });

  it("liefert dasselbe wie der ungekuerzte Spielstand", () => {
    const voll = baueSpielstand([baueSchnappschuss()]);
    const kompakt = compactFoundationInitialGameState(baueSpielstand([baueSchnappschuss()]));

    const ausVoll = buildAllTimeTableModel({ gameState: voll, selectedTeamId: "S-C" });
    const ausKompakt = buildAllTimeTableModel({ gameState: kompakt, selectedTeamId: "S-C" });

    for (const teamId of ["Z-H", "M-M", "L-R", "S-C"]) {
      expect(medaillenNach(teamId, ausKompakt)).toEqual(medaillenNach(teamId, ausVoll));
    }
    expect(ausKompakt.rows.map((row) => row.teamId)).toEqual(ausVoll.rows.map((row) => row.teamId));
    expect(ausKompakt.rows.map((row) => row.cumulativePoints)).toEqual(ausVoll.rows.map((row) => row.cumulativePoints));
  });

  it("die vollen Schnappschuesse behalten den Vorrang vor der Kurzfassung", () => {
    const voll = baueSpielstand([baueSchnappschuss()]) as {
      seasonState: { seasonSnapshots: unknown[]; foundationSeasonHistory?: unknown[] };
    };
    // Eine Kurzfassung, die etwas anderes behauptet: Rang 1 fuer S-C. Sie darf nicht gewinnen.
    voll.seasonState.foundationSeasonHistory = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        status: "completed",
        entryRosterPatchedAt: null,
        teams: [
          {
            teamId: "S-C",
            teamCode: "S-C",
            teamName: "Stronghold Crusaders",
            rank: 1,
            points: 999,
            disciplinePoints: null,
            disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
            cashEnd: null,
            cashTotal: null,
            cashEntry: null,
            salaryEnd: null,
            salaryTotalEnd: null,
            marketValueEnd: null,
            marketValueSeasonEnd: null,
            marketValueTotalEnd: null,
            guv: null,
          },
        ],
        transfers: [],
      },
    ];

    const model = buildAllTimeTableModel({ gameState: voll as never, selectedTeamId: "S-C" });
    expect(medaillenNach("S-C", model)).toMatchObject({ gold: 0 });
    expect(medaillenNach("Z-H", model)).toMatchObject({ gold: 1 });
  });
});

describe("Der Schnappschuss-Ersatz selbst", () => {
  it("faellt fuer ein aus der Liga genommenes Team auf Kuerzel und Namen der Kurzfassung zurueck", () => {
    const [ersatz] = alsSchnappschussErsatz(
      [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          status: "completed",
          entryRosterPatchedAt: null,
          teams: [
            {
              teamId: "W-E",
              teamCode: "W-E",
              teamName: "Weggefallen",
              rank: 7,
              points: 100,
              disciplinePoints: null,
              disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
              cashEnd: null,
              cashTotal: null,
              cashEntry: null,
              salaryEnd: null,
              salaryTotalEnd: null,
              marketValueEnd: null,
              marketValueSeasonEnd: null,
              marketValueTotalEnd: null,
              guv: null,
            },
          ],
          transfers: [],
        },
      ],
      [],
    );

    expect(ersatz?.finalStandings[0]).toMatchObject({ teamId: "W-E", teamCode: "W-E", teamName: "Weggefallen" });
  });

  it("schleppt die schweren Anhaenge nicht mit — sie sind der Grund fuers Streichen", () => {
    const [ersatz] = alsSchnappschussErsatz(
      [
        {
          seasonId: "season-1",
          seasonName: "S1",
          status: null,
          entryRosterPatchedAt: null,
          teams: [],
          players: [],
          transfers: [],
        },
      ],
      [],
    );
    expect(ersatz?.playerPerformances).toEqual([]);
    expect(ersatz?.matchdayResults).toBeUndefined();
  });

  /**
   * `playerPerformances` stand hier bis 2026-08-10 fest auf `[]` — und genau daran blieb die
   * Spielerhistorie haengen: die Sportliche Historie zeigte fuer Season 1 in jeder Spalte „—" und
   * die OVR/PPS/MVS-Kacheln „Kein Verlauf", obwohl der Schnappschuss 333 vollstaendige Zeilen trug.
   *
   * Die Spielerzeilen fahren jetzt mit. Was weiterhin NICHT mitfaehrt, ist die Aufschluesselung je
   * Disziplin — sie macht den Grossteil der Groesse aus (gemessen 647 KiB gegen 88 KiB je Saison).
   */
  it("nimmt die Spielerzeilen mit, aber ohne die Aufschluesselung je Disziplin", () => {
    const [ersatz] = alsSchnappschussErsatz(
      [
        {
          seasonId: "season-1",
          seasonName: "S1",
          status: null,
          entryRosterPatchedAt: null,
          teams: [],
          players: [
            {
              playerId: "player-1",
              playerName: "Vega",
              teamId: "S-C",
              teamCode: "S-C",
              teamName: "Stronghold Crusaders",
              appearances: 9,
              totalContribution: null,
              totalPoints: 10.7,
              averageContribution: null,
              averageFinalScore: null,
              powPoints: 7.4,
              spePoints: 0.6,
              menPoints: null,
              socPoints: null,
              ovr: 70.8,
              ovrRank: 12,
              pps: 10.7,
              ppsRank: 53,
              mvs: 13,
              mvsRank: 47,
              marketValue: null,
              purchasePrice: null,
              salary: null,
              contractLength: null,
              bestDisciplineLabel: null,
            },
          ],
          transfers: [],
        },
      ],
      [],
    );

    expect(ersatz?.playerPerformances).toHaveLength(1);
    const zeile = ersatz?.playerPerformances?.[0] as unknown as Record<string, unknown>;
    expect(zeile.playerId).toBe("player-1");
    expect(zeile.pps).toBe(10.7);
    expect(zeile.ovr).toBe(70.8);
    expect(zeile.mvs).toBe(13);
    expect(zeile.powPoints).toBe(7.4);
    // Ohne die Achsenpunkte wuerde `resolveSnapshotPlayerPerformanceRow` die Zeile fuer
    // metrik-arm halten und in die Neuherleitung fallen, die hier mangels Rohdaten scheitert.
    expect(zeile.disciplineBreakdown).toEqual([]);
  });

  it("aus keiner Historie wird kein Archiv erfunden", () => {
    expect(alsSchnappschussErsatz(undefined, [])).toEqual([]);
    expect(alsSchnappschussErsatz([], [])).toEqual([]);
  });
});
