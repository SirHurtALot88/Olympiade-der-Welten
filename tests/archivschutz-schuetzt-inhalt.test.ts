/**
 * DER ARCHIVSCHUTZ MUSS DEN INHALT SCHUETZEN, NICHT DIE ANZAHL.
 *
 * DER BEFUND (am Live-Abbild gemessen, Save `new-game-1785823388048-1hf25q`, Saison 2):
 * `preserveAppendOnlyArchive` in `foundation-initial-compact-state` verglich nur LAENGEN —
 *
 *     return incomingLength >= existingLength ? incoming : existing;
 *
 * — und liess damit eine gleich lange, inhaltlich ausgeraeumte Schnappschuss-Liste anstandslos
 * durch: `finalStandings` 32 -> 0 Zeilen, das Archiv 3.546.497 B -> 3.249.724 B. Danach waeren
 * Ewige Tabelle, Vorsaison-Podium, Spielerhistorie und Saison-Verlauf dauerhaft leer gewesen, ohne
 * dass irgendetwas gemeldet haette. Heute schreibt kein Weg eine solche Liste; der Code verliess
 * sich aber darauf, dass das so bleibt.
 *
 * DIE REGEL, DIE JETZT GILT: ueber die PUT-Rundreise kann das Archiv nur WACHSEN. Jeder vorhandene
 * Eintrag bleibt Zeichen fuer Zeichen erhalten, neue kommen hinzu. Das ist genau die Zusage, die
 * der Client ohnehin gibt — er verfasst Schnappschuesse nie (siehe
 * `buildAutoPersistContentSignature`), sie entstehen ausschliesslich serverseitig.
 *
 * DIESER TEST PRUEFT WERTE, KEINE QUELLTEXT-ZEILEN: er faehrt den echten Weg
 * (voll -> compact -> Sentinel -> PUT-Merge) und schaut in die Schnappschuesse hinein.
 *
 * GEGENPROBE (ausgefuehrt): `preserveAppendOnlyArchive` auf die alte Laengen-Fassung
 * zurueckgesetzt -> „ausgeraeumte Liste" und „ausgeduennter Eintrag" werden rot, die uebrigen
 * Faelle bleiben gruen.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { withCompactSeasonArchiveSentinel } from "@/lib/foundation/apply-compact-season-archive-sentinel";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";

function schnappschuss(seasonId: string, teamCount: number): SeasonSnapshotRecord {
  return {
    snapshotId: `season-snapshot__${seasonId}`,
    seasonId,
    seasonName: seasonId,
    createdAt: "2026-01-01T00:00:00.000Z",
    archivedAt: "2026-01-01T00:00:00.000Z",
    source: "local",
    status: "completed",
    sourceStatus: "mapped",
    finalStandings: Array.from({ length: teamCount }, (_, index) => ({
      teamId: `team-${index}`,
      teamCode: `T${index}`,
      teamName: `Team ${index}`,
      rank: index + 1,
      points: 200 - index,
    })),
    teamSnapshots: [],
    matchdayResults: [],
    disciplineResults: [],
    playerDisciplinePerformances: [],
    disciplineHighlights: [],
    playerPerformances: [{ playerId: "p1", playerName: "Spieler 1", totalPoints: 42 }],
    playerPerformanceSnapshots: [],
    transferSnapshots: [],
    warnings: [],
  } as unknown as SeasonSnapshotRecord;
}

function mitArchiv(): GameState {
  const basis = createSingleplayerGameState();
  return {
    ...basis,
    seasonState: {
      ...basis.seasonState,
      seasonSnapshots: [schnappschuss("season-1", 32)],
      standingsApplyLogs: [
        { id: "log-1", seasonId: "season-1", matchdayId: "md-1", payload: { appliedTeams: 32 } },
        { id: "log-2", seasonId: "season-1", matchdayId: "md-2", payload: { appliedTeams: 32 } },
      ] as never,
    },
  };
}

/** Genau der Weg des Browsers: kompakter Payload plus Sentinel. */
function wieDerBrowserZurueckschickt(voll: GameState): GameState {
  return withCompactSeasonArchiveSentinel(
    JSON.parse(JSON.stringify(compactFoundationInitialGameState(voll))) as GameState,
  );
}

describe("Archivschutz der PUT-Rundreise", () => {
  it("der leere Sentinel des Browsers laesst das Archiv unangetastet", () => {
    const voll = mitArchiv();
    const vomBrowser = wieDerBrowserZurueckschickt(voll);
    // Vorbedingung: es ist wirklich der Sentinel, nicht `undefined`.
    expect(vomBrowser.seasonState.seasonSnapshots).toEqual([]);
    expect(vomBrowser.seasonState.standingsApplyLogs).toBeUndefined();

    const zurueck = rehydrateGameStateAfterCompactPut(voll, vomBrowser);
    expect(zurueck.seasonState.seasonSnapshots).toEqual(voll.seasonState.seasonSnapshots);
    expect(zurueck.seasonState.standingsApplyLogs).toEqual(voll.seasonState.standingsApplyLogs);
  });

  it("eine gleich lange, inhaltlich ausgeraeumte Liste kommt NICHT durch", () => {
    const voll = mitArchiv();
    const ausgeraeumt: GameState = {
      ...voll,
      seasonState: {
        ...voll.seasonState,
        seasonSnapshots: [{ ...schnappschuss("season-1", 32), finalStandings: [], playerPerformances: [] } as never],
      },
    };
    // Genau die Falle der alten Wache: gleich viele Eintraege, nur ohne Inhalt.
    expect(ausgeraeumt.seasonState.seasonSnapshots).toHaveLength(voll.seasonState.seasonSnapshots!.length);

    const zurueck = rehydrateGameStateAfterCompactPut(voll, ausgeraeumt);
    expect(zurueck.seasonState.seasonSnapshots?.[0]?.finalStandings).toHaveLength(32);
    expect(zurueck.seasonState.seasonSnapshots?.[0]?.playerPerformances).toHaveLength(1);
    expect(zurueck.seasonState.seasonSnapshots).toEqual(voll.seasonState.seasonSnapshots);
  });

  it("ein einzelner ausgeduennter Eintrag kommt ebenfalls nicht durch", () => {
    const voll = mitArchiv();
    voll.seasonState.seasonSnapshots = [schnappschuss("season-1", 32), schnappschuss("season-2", 32)];
    const halbLeer: GameState = {
      ...voll,
      seasonState: {
        ...voll.seasonState,
        seasonSnapshots: [
          voll.seasonState.seasonSnapshots[0]!,
          { ...voll.seasonState.seasonSnapshots[1]!, finalStandings: [] } as never,
        ],
      },
    };

    const zurueck = rehydrateGameStateAfterCompactPut(voll, halbLeer);
    expect(zurueck.seasonState.seasonSnapshots?.map((entry) => entry.finalStandings?.length)).toEqual([32, 32]);
  });

  it("eine NEUE Saison darf hinzukommen — legitimes Wachstum wird nicht blockiert", () => {
    const voll = mitArchiv();
    const gewachsen: GameState = {
      ...voll,
      seasonState: {
        ...voll.seasonState,
        seasonSnapshots: [...voll.seasonState.seasonSnapshots!, schnappschuss("season-2", 32)],
      },
    };

    const zurueck = rehydrateGameStateAfterCompactPut(voll, gewachsen);
    expect(zurueck.seasonState.seasonSnapshots?.map((entry) => entry.seasonId)).toEqual(["season-1", "season-2"]);
    expect(zurueck.seasonState.seasonSnapshots?.[1]?.finalStandings).toHaveLength(32);
  });

  it("dieselbe Regel gilt fuer die Standings-Buchungen", () => {
    const voll = mitArchiv();
    const ausgeraeumt: GameState = {
      ...voll,
      seasonState: {
        ...voll.seasonState,
        standingsApplyLogs: [
          { id: "log-1", seasonId: "season-1", matchdayId: "md-1" },
          { id: "log-2", seasonId: "season-1", matchdayId: "md-2" },
          { id: "log-3", seasonId: "season-1", matchdayId: "md-3", payload: { appliedTeams: 32 } },
        ] as never,
      },
    };

    const zurueck = rehydrateGameStateAfterCompactPut(voll, ausgeraeumt);
    // Die beiden bestehenden behalten ihren `payload`, der dritte kommt dazu.
    expect(zurueck.seasonState.standingsApplyLogs?.map((log) => (log as { payload?: unknown }).payload)).toEqual([
      { appliedTeams: 32 },
      { appliedTeams: 32 },
      { appliedTeams: 32 },
    ]);
  });

  it("ein leeres Archiv nimmt den ersten Schnappschuss an", () => {
    const basis = createSingleplayerGameState();
    const leer: GameState = { ...basis, seasonState: { ...basis.seasonState, seasonSnapshots: [] } };
    const erster: GameState = {
      ...leer,
      seasonState: { ...leer.seasonState, seasonSnapshots: [schnappschuss("season-1", 32)] },
    };

    const zurueck = rehydrateGameStateAfterCompactPut(leer, erster);
    expect(zurueck.seasonState.seasonSnapshots?.[0]?.finalStandings).toHaveLength(32);
  });
});
