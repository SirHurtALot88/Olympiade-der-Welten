/**
 * HISTORIE (Mockup 18.11.), Entscheidungen von Chris:
 *   3. Nur Platz 1 der Liga 1 ist „Meister". Der Erste der Liga 2 heisst „Meister Liga 2" und zaehlt als Aufstieg.
 *   4. „Ø Platz" und „Bester Platz" rechnen ueber beide Ligen (Liga 2 ab Platz 17); die Rangfolge bleibt nach Punkten.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";
import { baueHistorieSaisons, baueTeamVerlauf, rekordmeister, tabellenRegel } from "@/lib/foundation/historie-modern";
import type {
  FoundationSeasonHistoryEntry,
  FoundationSeasonHistoryTeamEntry,
} from "@/lib/persistence/foundation-season-history-projection";

function teamEintrag(teamId: string, rank: number, points: number, tier: string | null, extra: Partial<FoundationSeasonHistoryTeamEntry> = {}): FoundationSeasonHistoryTeamEntry {
  return {
    teamId,
    teamCode: teamId.toUpperCase(),
    teamName: `Team ${teamId}`,
    rank,
    points,
    disciplinePoints: null,
    disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
    cashEnd: null,
    cashTotal: null,
    cashEntry: null,
    cashCarryOver: null,
    salaryEnd: null,
    salaryTotalEnd: null,
    marketValueEnd: null,
    marketValueSeasonEnd: null,
    cashSeasonEnd: null,
    salarySeasonEnd: null,
    rosterSeasonEnd: null,
    marketValueTotalEnd: null,
    guv: null,
    startplatz: null,
    rankDiff: null,
    transferNet: null,
    leagueTier: tier,
    ...extra,
  };
}

function saison(seasonId: string, teams: FoundationSeasonHistoryTeamEntry[]): FoundationSeasonHistoryEntry {
  return {
    seasonId,
    seasonName: seasonId.replace("season-", "Season "),
    status: "completed",
    archivedAt: "2026-01-01T00:00:00Z",
    entryRosterPatchedAt: null,
    teams,
    teamDisciplineRanks: [],
    players: [],
    transfers: [],
  };
}

/** Liga 1: a (Platz 1), b (Platz 15). Liga 2: c (Platz 1), d (Platz 2), e (Platz 4). */
const SAISON_1 = saison("season-1", [
  teamEintrag("a", 1, 100, "liga1"),
  teamEintrag("b", 15, 40, "liga1"),
  teamEintrag("c", 1, 90, "liga2"),
  teamEintrag("d", 2, 80, "liga2"),
  teamEintrag("e", 4, 60, "liga2"),
]);
/** Folgesaison: c und d sind aufgestiegen, b ist abgestiegen; e bleibt. */
const SAISON_2 = saison("season-2", [
  teamEintrag("a", 3, 95, "liga1"),
  teamEintrag("c", 1, 99, "liga1"),
  teamEintrag("d", 12, 50, "liga1"),
  teamEintrag("b", 1, 91, "liga2"),
  teamEintrag("e", 5, 55, "liga2"),
]);

describe("Meister, Meister Liga 2, Aufstieg, Abstieg", () => {
  const saisons = baueHistorieSaisons([SAISON_1, SAISON_2]);
  const s1 = saisons[0]!;

  it("Meister ist nur Platz 1 der Liga 1; der Erste der Liga 2 ist Meister Liga 2", () => {
    expect(s1.meister?.teamId).toBe("a");
    expect(s1.meisterLiga2?.teamId).toBe("c");
    const c = s1.ligen.find((liga) => liga.liga === 2)!.zeilen.find((zeile) => zeile.teamId === "c")!;
    expect(c.meister).toBe(false);
    expect(c.meisterLiga2).toBe(true);
  });

  it("Meister Liga 2 zaehlt als Aufstieg, nicht als Titel", () => {
    expect(s1.aufsteiger.map((zeile) => zeile.teamId)).toEqual(["c", "d"]);
    const verlauf = baueTeamVerlauf(saisons, "c")!;
    expect(verlauf.titel).toBe(1); // Saison 2: Platz 1 der Liga 1
    expect(verlauf.titelLiga2).toBe(1); // Saison 1: Platz 1 der Liga 2
    expect(verlauf.aufstiege).toBe(1);
  });

  it("der Ligawechsel in der Folgesaison entscheidet; ohne Folgesaison gilt die Tabellenregel", () => {
    const s2 = saisons[1]!;
    // b: Liga 1 → Liga 2 (Abstieg laut Wechsel). Das Team ist in Saison 2 Liga-2-Erster, steigt dann aber ohne Folgesaison per Regel auf.
    expect(s1.absteiger.map((zeile) => zeile.teamId)).toEqual(["b"]);
    expect(s2.aufsteiger.map((zeile) => zeile.teamId)).toEqual(["b"]);
    // d: Platz 12 der Liga 1 → kein Abstieg nach Regel (Platz 14 bis 16).
    expect(s2.absteiger).toEqual([]);
  });

  it("Tabellenregel: Liga 1 Platz 14 bis 16 steigen ab, Liga 2 Platz 1 bis 3 steigen auf", () => {
    expect(tabellenRegel(1, 13)).toEqual({ aufstieg: false, abstieg: false });
    expect(tabellenRegel(1, 14)).toEqual({ aufstieg: false, abstieg: true });
    expect(tabellenRegel(2, 3)).toEqual({ aufstieg: true, abstieg: false });
    expect(tabellenRegel(2, 4)).toEqual({ aufstieg: false, abstieg: false });
    expect(tabellenRegel(null, 1)).toEqual({ aufstieg: false, abstieg: false });
  });

  it("ohne Liga-Trennung ist Platz 1 der Meister", () => {
    const ohne = baueHistorieSaisons([saison("season-1", [teamEintrag("x", 1, 10, null), teamEintrag("y", 2, 5, null)])]);
    expect(ohne[0]!.meister?.teamId).toBe("x");
    expect(ohne[0]!.meisterLiga2).toBeNull();
  });

  it("Rekordmeister zaehlt nur Liga-1-Titel", () => {
    // a (Saison 1) und c (Saison 2) haben je einen Liga-1-Titel; der Liga-2-Titel von b und c zaehlt nicht mit.
    const rekord = rekordmeister(saisons)!;
    expect(rekord.titel).toBe(1);
    expect(["a", "c"]).toContain(rekord.teamId);
  });
});

describe("Ewige Tabelle ueber beide Ligen", () => {
  function modell() {
    const snapshots = [SAISON_1, SAISON_2].map((eintrag) => ({
      seasonId: eintrag.seasonId,
      seasonName: eintrag.seasonName,
      finalStandings: eintrag.teams.map((team) => ({ ...team, disciplinePointsByArea: {} })),
      playerPerformances: [],
    }));
    const gameState = {
      season: { id: "season-3", name: "Season 3" },
      seasonState: { seasonSnapshots: snapshots },
      teams: ["a", "b", "c", "d", "e"].map((id) => ({ teamId: id, shortCode: id.toUpperCase(), name: `Team ${id}` })),
    } as unknown as GameState;
    return buildAllTimeTableModel({ gameState });
  }

  it("Rangfolge bleibt nach kumulierten Punkten", () => {
    const model = modell();
    const punkte = model.rows.map((row) => row.cumulativePoints);
    expect([...punkte].sort((a, b) => b - a)).toEqual(punkte);
  });

  it("Ø Platz und Bester Platz rechnen Liga 2 ab Platz 17", () => {
    const b = modell().rows.find((row) => row.teamId === "b")!;
    // Saison 1: Liga 1 Platz 15 → 15; Saison 2: Liga 2 Platz 1 → 17. Ø = 16, Bester = 15.
    expect(b.avgRank).toBe(16);
    expect(b.bestRank).toBe(15);
    const c = modell().rows.find((row) => row.teamId === "c")!;
    // Saison 1: Liga 2 Platz 1 → 17; Saison 2: Liga 1 Platz 1 → 1.
    expect(c.bestRank).toBe(1);
    expect(c.avgRank).toBe(9);
  });

  it("Titel zaehlt nur Liga 1; Meister Liga 2 und Auf-/Abstiege stehen eigen", () => {
    const model = modell();
    const c = model.rows.find((row) => row.teamId === "c")!;
    expect(c.titles).toBe(1);
    expect(c.medals.gold).toBe(1);
    expect(c.titlesLiga2).toBe(1);
    expect(c.promotions).toBe(1);
    const b = model.rows.find((row) => row.teamId === "b")!;
    expect(b.titles).toBe(0);
    expect(b.titlesLiga2).toBe(1);
    expect(b.relegations).toBe(1);
    // Der Erste der Liga 2 ist kein Zweiter: Platz 2 der Liga 2 ist Position 18.
    const d = model.rows.find((row) => row.teamId === "d")!;
    expect(d.medals.silver).toBe(0);
  });
});
