import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const DRAWER = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageDrawer.tsx"), "utf8");

/**
 * Die Spieler-Karte der Arena zeigte auf einem echten Stand quer durch alle Kopfzahlen und
 * Kernwerte ein „#1" — bei einem Spieler, der weder ligaweit erster im OVR war noch die
 * meisten PPs hatte (andere lagen über 15). Zwei Ursachen stecken dahinter, beide hier
 * festgehalten:
 *
 *  1. In den Kernwerten stand der ATTRIBUTWERT (POW 65,9) neben dem Rang der in
 *     POW-Disziplinen gesammelten Saison-PPs. Zahl und Rang beschrieben verschiedene
 *     Größen — der Rang gehörte nicht zu der Zahl, vor der er stand.
 *  2. Alle Ränge kommen aus einem Pool, der die Spieler auf allen Kadern der Liga umfasst.
 *     Ist dieser Pool degeneriert (fast leere Kader), ist jeder automatisch Erster. Statt
 *     „#1" zu erfinden, wird der Rang dann weggelassen.
 */
describe("Arena-Spielerkarte: Ränge im Ligavergleich", () => {
  it("stellt den Kernwerten den Attribut-Rang zur Seite, nicht den PP-Rang", () => {
    // `valueRank` gehört zum angezeigten Attributwert, `seasonPointsRank` zu den Saison-PPs.
    expect(DRAWER).toContain("const rank = card?.valueRank ?? null;");
    expect(DRAWER).not.toContain("const rank = card?.seasonPointsRank ?? null;");
  });

  it("rankt gegen alle Kader der Liga, nicht gegen Team oder Disziplin-Teilnehmer", () => {
    expect(DRAWER).toContain("function getLeagueRankPoolSize(gameState: GameState): number");
    expect(DRAWER).toContain('new Set((gameState.rosters ?? []).map((entry) => entry.playerId).filter(Boolean)).size');
  });

  it("lässt den Rang weg, statt bei zu kleinem Pool ein #1 zu erfinden", () => {
    expect(DRAWER).toMatch(/const MIN_LEAGUE_RANK_POOL = \d+;/);
    expect(DRAWER).toContain("getLeagueRankPoolSize(gameState) >= MIN_LEAGUE_RANK_POOL");
    expect(DRAWER).toContain("leagueRankUsable ? rankLabel(rank) : null");
  });

  it("gated auch die OVR-Ränge in der Team-Ansicht", () => {
    // Dieselbe Karte listet unter „Team" die Spielerzeilen mit „OVR #N".
    expect(DRAWER).toContain("const rankUsable = isLeagueRankUsable(gameState);");
    expect(DRAWER).toContain("ovrRank.set(pid, rankUsable ? r?.ovrRank ?? null : null);");
  });

  it("führt jede sichtbare Rangzahl der Karte über dieses Gate", () => {
    // OVR / PP / MVS
    expect(DRAWER).toContain("rank={leagueRankLabel(ovrRank)}");
    expect(DRAWER).toContain("rank={leagueRankLabel(ppsRank)}");
    expect(DRAWER).toContain("leagueRankLabel(mvsRank)");
    // Aktuelle Disziplin + beste Disziplinen
    expect(DRAWER).toContain("leagueRankLabel(currentDiscRank)");
    expect(DRAWER).toContain("leagueRankLabel(d.rank)");
    // Kernwerte-Achsen
    expect(DRAWER).toContain("rankText={leagueRankLabel(rank)}");
  });

  it("zeigt als PP die Saison-Summe, nicht den Wert der laufenden Disziplin", () => {
    expect(DRAWER).toContain("const pps = data?.pps ?? null;");
    expect(DRAWER).toMatch(/Saison-PP \(verdient\)/);
  });
});
