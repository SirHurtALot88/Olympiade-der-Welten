/**
 * GEMELDET (zwei Symptome, eine Ursache):
 *   „bitte prüfe dass die S1 snapshots mit den punkten usw in den historien verfügbar ist"
 *   „in den kacheln steht kein verlauf obwohl jasper in season 1 auch dabei war"
 *
 * BEFUND: es fehlten keine Daten. Der Saison-1-Schnappschuss trug 333 vollstaendige Leistungszeilen.
 * Aber `compactFoundationInitialGameState` streicht `seasonSnapshots` fuer den Browser, und die
 * Ersatzfracht `foundationSeasonHistory` war rein team-bezogen — `playerPerformances` stand fest
 * auf `[]`. Damit fiel die Sportliche Historie auf eine Platzhalterzeile zurueck (jede Spalte „—"),
 * und weil das Delta der OVR/PPS/MVS-Kacheln gegen genau diese Zeile rechnet, stand dort
 * „Kein Verlauf".
 *
 * Am Live-Spielstand nachgemessen (Vega, S-C): voll pps 10,7 / ovr 70,8 / mvs 13 — kompaktiert
 * ueberall null. Nach dem Fix sind beide Sichten deckungsgleich.
 *
 * Dieser Test faehrt denselben Weg auf einer kleinen Fixture: projizieren, zurueckbauen, pruefen.
 */
import { describe, expect, it } from "vitest";

import {
  alsSchnappschussErsatz,
  projiziereSaisonHistorie,
  type FoundationSeasonHistoryEntry,
} from "@/lib/persistence/foundation-season-history-projection";

function schnappschussMitSpieler() {
  return {
    snapshotId: "snap-s1",
    seasonId: "season-1",
    seasonName: "Season 1",
    archivedAt: "2026-08-01T00:00:00.000Z",
    status: "completed",
    finalStandings: [
      { teamId: "S-C", teamCode: "S-C", teamName: "Stronghold Crusaders", rank: 19, points: 86.3 },
    ],
    playerPerformances: [
      {
        playerId: "player-0270-vega",
        playerName: "Vega",
        teamId: "S-C",
        teamCode: "S-C",
        teamName: "Stronghold Crusaders",
        seasonId: "season-1",
        appearances: 9,
        totalPoints: 10.7,
        powPoints: 7.4,
        spePoints: 0.6,
        menPoints: 1.2,
        socPoints: 1.5,
        ovr: 70.8,
        ovrRank: 12,
        pps: 10.7,
        ppsRank: 53,
        mvs: 13,
        mvsRank: 47,
        // Der schwere Anhang — er darf die Projektion NICHT ueberleben.
        disciplineBreakdown: [
          { disciplineId: "climbing", points: 4.2, appearances: 3 },
          { disciplineId: "sprint", points: 3.2, appearances: 2 },
        ],
      },
    ],
    transferSnapshots: [],
  } as never;
}

describe("Spielerhistorie ueberlebt die Anfangsladung", () => {
  it("projiziert die Spielerzeilen mit — sonst bleibt die Historie im Browser leer", () => {
    const [eintrag] = projiziereSaisonHistorie([schnappschussMitSpieler()]);

    expect(eintrag.players).toHaveLength(1);
    const vega = eintrag.players[0];
    expect(vega.playerId).toBe("player-0270-vega");
    expect(vega.pps).toBe(10.7);
    expect(vega.ovr).toBe(70.8);
    expect(vega.mvs).toBe(13);
    expect(vega.ppsRank).toBe(53);
    expect(vega.powPoints).toBe(7.4);
    expect(vega.socPoints).toBe(1.5);
  });

  it("laesst die Aufschluesselung je Disziplin bewusst zurueck", () => {
    const [eintrag] = projiziereSaisonHistorie([schnappschussMitSpieler()]);

    // 647 KiB gegen 88 KiB je Saison — der Grund, warum die Anfangsladung ueberhaupt streicht.
    expect(eintrag.players[0]).not.toHaveProperty("disciplineBreakdown");
  });

  it("baut aus der Kurzfassung wieder schnappschussfoermige Zeilen", () => {
    const historie: FoundationSeasonHistoryEntry[] = projiziereSaisonHistorie([schnappschussMitSpieler()]);
    const [ersatz] = alsSchnappschussErsatz(historie, [
      { teamId: "S-C", shortCode: "S-C", name: "Stronghold Crusaders" },
    ]);

    expect(ersatz.playerPerformances).toHaveLength(1);
    const zeile = ersatz.playerPerformances?.[0] as unknown as Record<string, unknown>;
    expect(zeile.playerId).toBe("player-0270-vega");
    expect(zeile.pps).toBe(10.7);
    expect(zeile.ovr).toBe(70.8);
    expect(zeile.seasonId).toBe("season-1");
    // Leer, nicht fehlend: `resolveSnapshotPlayerPerformanceRow` erkennt die Zeile ueber ihre
    // Achsenpunkte als vollwertig und faellt nicht in die Neuherleitung.
    expect(zeile.disciplineBreakdown).toEqual([]);
  });

  it("erfindet keine Historie, wo keine ist", () => {
    expect(projiziereSaisonHistorie(undefined)).toEqual([]);
    const [leer] = projiziereSaisonHistorie([
      { ...(schnappschussMitSpieler() as never as Record<string, unknown>), playerPerformances: [] } as never,
    ]);
    expect(leer.players).toEqual([]);
  });
});
