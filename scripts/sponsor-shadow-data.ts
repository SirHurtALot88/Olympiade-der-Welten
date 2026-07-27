/**
 * SCHATTENTEST — Datenzugriff (read-only, kein Produktionscode).
 *
 * Laedt einen Save aus einer (isolierten) SQLite-Datei und stellt die Groessen bereit, die der
 * Schattentest braucht: Endraenge je Saison, EX-ANTE-Erwartungsraenge je Saison, Gehaelter,
 * Preisgeld und die saison-getaggten Ledger, aus denen die Klausel-Metriken kommen.
 *
 * ZWEI EHRLICHKEITSHINWEISE, die fuer die Auswertung entscheidend sind:
 *
 *  A) ERWARTUNGSRANG IST REKONSTRUIERT, NICHT PROTOKOLLIERT.
 *     Der Save haelt `teamQualityRankAtSign` nur auf dem AKTUELLEN Sponsorvertrag — also fuer die
 *     letzte Saison. Fuer die frueheren Saisons wird der Erwartungsrang aus den Saison-Snapshots
 *     nachgebaut: dieselbe pure Funktion `buildLeagueTeamQualityRanks` bekommt Zeilen, die nur
 *     Information VOR der jeweiligen Saison enthalten (Tabellenplatz und Marktwert der Vorsaison,
 *     Rang-Historie der Saisons davor). Das ist derselbe Rechenweg wie in der Engine, aber mit
 *     rekonstruierten Eingaben. `validateReconstruction()` prueft die Rekonstruktion der LETZTEN
 *     Saison gegen den echten `teamQualityRankAtSign` des Vertrags.
 *
 *  B) SPIELERZUSTAND EXISTIERT NUR FUER DIE LAUFENDE SAISON.
 *     Fatigue, `seasonTrainingAccumulator`, `trainingMode`, Moral, `trainingClass` werden jede
 *     Preseason zurueckgesetzt (lib/season/preseason-workflow-service.ts). Aus einem Save am Ende
 *     von Saison 5 sind sie fuer die Saisons 1-4 NICHT rekonstruierbar. Saison-getaggte Ledger
 *     (injuryEvents, transferHistory, loanOriginationLogs, classHistory, playerProgressionEvents,
 *     playerRelationshipEvents, facilityEvents, beliebtheitHistory, seasonSnapshots) ueberleben
 *     dagegen und sind fuer alle Saisons auswertbar. Welche Klausel in welche Gruppe faellt, steht
 *     in scripts/sponsor-shadow-measure.ts.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import type { GameState, SeasonSnapshotRecord, SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamSeasonOverviewRows, type TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { buildLeagueTeamQualityRanks } from "@/lib/sponsor/sponsor-team-quality-rank";

export function openSave(input: { sqlitePath?: string; saveId?: string }): { gameState: GameState; saveId: string } {
  if (input.sqlitePath) process.env.OLY_APP_SQLITE_PATH = input.sqlitePath;
  const persistence = createPersistenceService();
  const saves = persistence.listSaves();
  if (saves.length === 0) throw new Error("Keine Saves in der angegebenen Datenbank.");
  const chosen = input.saveId
    ? saves.find((s) => s.saveId === input.saveId)
    : [...saves].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0];
  if (!chosen) throw new Error(`Save ${input.saveId ?? "(neuester)"} nicht gefunden. Vorhanden: ${saves.map((s) => s.saveId).join(", ")}`);
  const save = persistence.getSaveById(chosen.saveId);
  if (!save) throw new Error(`Save ${chosen.saveId} liess sich nicht laden.`);
  return { gameState: save.gameState, saveId: chosen.saveId };
}

export function listSaveIds(sqlitePath: string): Array<{ saveId: string; name: string; updatedAt: string | null }> {
  process.env.OLY_APP_SQLITE_PATH = sqlitePath;
  return createPersistenceService().listSaves().map((s) => ({
    saveId: s.saveId, name: String(s.name ?? ""), updatedAt: (s.updatedAt as string | undefined) ?? null,
  }));
}

/** Alle abgeschlossenen Saison-Snapshots, chronologisch. */
export function completedSnapshots(gameState: GameState): SeasonSnapshotRecord[] {
  const all = (gameState.seasonState.seasonSnapshots ?? []).filter((s) => (s.finalStandings ?? []).length > 0);
  const num = (id: string) => {
    const m = /(\d+)/.exec(id);
    return m ? Number(m[1]) : 0;
  };
  return [...all].sort((a, b) => num(a.seasonId) - num(b.seasonId));
}

/**
 * Snapshot-Felder existieren in zwei Generationen (`salaryEnd`/`marketValueEnd` gegen
 * `salaryTotalEnd`/`marketValueTotalEnd`). Beide werden gelesen, damit aeltere und neuere Saves
 * dieselbe Auswertung durchlaufen.
 */
const snapshotSalary = (row: SeasonSnapshotTeamRecord): number | null => {
  const wide = row as unknown as Record<string, unknown>;
  const total = wide["salaryTotalEnd"];
  if (typeof total === "number") return total;
  return typeof row.salaryEnd === "number" ? row.salaryEnd : null;
};
const snapshotMarketValue = (row: SeasonSnapshotTeamRecord): number | null => {
  const wide = row as unknown as Record<string, unknown>;
  const total = wide["marketValueTotalEnd"];
  if (typeof total === "number") return total;
  return typeof row.marketValueEnd === "number" ? row.marketValueEnd : null;
};

export type SeasonTeamObservation = {
  seasonIndex: number;
  seasonId: string;
  teamId: string;
  teamCode: string;
  finalRank: number;
  /** EX-ANTE-Erwartungsrang: nur Information von VOR dieser Saison. */
  expectedRank: number;
  /** Gehaltssumme am Saisonende (aus dem Snapshot). */
  salaryEnd: number | null;
  cashEnd: number | null;
  marketValueEnd: number | null;
  transferCount: number | null;
};

/**
 * Baut fuer JEDE abgeschlossene Saison den ex-ante-Erwartungsrang, indem
 * `buildLeagueTeamQualityRanks` mit Zeilen aufgerufen wird, die ausschliesslich
 * Vor-Saison-Information tragen.
 *
 * Bewusst NICHT gemacht: die Endtabelle der zu bewertenden Saison in die Zeilen legen. Genau das
 * macht die Engine live (`current`-Komponente = laufender Tabellenplatz), es waere fuer eine
 * Ex-ante-Messung aber ein Blick in die Zukunft.
 */
export function buildSeasonObservations(gameState: GameState): SeasonTeamObservation[] {
  const snaps = completedSnapshots(gameState);
  const out: SeasonTeamObservation[] = [];
  const teamNameById = new Map(gameState.teams.map((t) => [t.teamId, t.name] as const));
  const budgetById = new Map(gameState.teams.map((t) => [t.teamId, t.budget] as const));

  for (let i = 0; i < snaps.length; i += 1) {
    const snap = snaps[i]!;
    const prior = snaps.slice(0, i); // nur echte Vergangenheit
    const rows: TeamManagementSnapshotRow[] = snap.finalStandings.map((row) => {
      const prevSeasons = [...prior].reverse(); // juengste zuerst — getHistoricalSeasonRanks dreht nochmal
      const history = prevSeasons
        .map((p) => p.finalStandings.find((e) => e.teamId === row.teamId))
        .filter((e): e is SeasonSnapshotTeamRecord => e != null)
        .map((e, idx) => ({ seasonId: prevSeasons[idx]!.seasonId, points: e.points ?? 0, rank: e.rank }));
      const lastSeason = prior.at(-1)?.finalStandings.find((e) => e.teamId === row.teamId) ?? null;
      // Tabellenplatz VOR der Saison = Startplatz des Snapshots (bei S1 der gesetzte Startplatz),
      // Marktwert VOR der Saison = Marktwert am Ende der Vorsaison.
      return {
        teamId: row.teamId,
        teamName: teamNameById.get(row.teamId) ?? row.teamName ?? row.teamId,
        budget: budgetById.get(row.teamId) ?? null,
        cash: lastSeason?.cashEnd ?? null,
        marketValueTotal: lastSeason ? snapshotMarketValue(lastSeason) : null,
        startplatz: row.startplatz ?? lastSeason?.rank ?? null,
        rank: row.startplatz ?? lastSeason?.rank ?? null,
        historicalPointsBySeason: history,
      } as unknown as TeamManagementSnapshotRow;
    });
    // buildLeagueTeamQualityRanks liefert einen gewichteten, gebrochenen Rang. Fuer die
    // sigma-Messung wird die LIGA-POSITION dieses Rangs benutzt (1..32), nicht der Rohwert:
    // nur sie ist mit dem Endrang auf derselben Skala.
    const quality = buildLeagueTeamQualityRanks(rows);
    for (const row of snap.finalStandings) {
      const q = quality.get(row.teamId);
      if (!q || row.rank == null) continue;
      out.push({
        seasonIndex: i + 1,
        seasonId: snap.seasonId,
        teamId: row.teamId,
        teamCode: row.teamCode ?? row.teamId,
        finalRank: row.rank,
        expectedRank: q.leaguePosition,
        salaryEnd: snapshotSalary(row),
        cashEnd: row.cashEnd ?? null,
        marketValueEnd: snapshotMarketValue(row),
        transferCount: row.transferCount ?? null,
      });
    }
  }
  return out;
}

/**
 * Kontrolle der Rekonstruktion: der echte, beim Unterschreiben eingefrorene qualityRank des
 * AKTUELLEN Vertrags gegen den rekonstruierten Erwartungsrang derselben Saison.
 */
export function validateReconstruction(gameState: GameState, obs: SeasonTeamObservation[]): Array<{
  teamId: string; seasonId: string; engineQualityRank: number; reconstructedPosition: number;
}> {
  const contracts = gameState.seasonState.sponsorContractsByTeamId ?? {};
  const out: Array<{ teamId: string; seasonId: string; engineQualityRank: number; reconstructedPosition: number }> = [];
  for (const [teamId, contract] of Object.entries(contracts)) {
    if (contract?.teamQualityRankAtSign == null) continue;
    const match = obs.find((o) => o.teamId === teamId && o.seasonId === contract.seasonId);
    if (!match) continue;
    out.push({
      teamId, seasonId: contract.seasonId,
      engineQualityRank: contract.teamQualityRankAtSign,
      reconstructedPosition: match.expectedRank,
    });
  }
  return out;
}

/** Live-Erwartungsraenge des aktuellen Zustands (fuer die Angebotsliste des Fallen-Tests). */
export function liveQualityPositions(gameState: GameState): Map<string, number> {
  const ranks = buildLeagueTeamQualityRanks(
    buildTeamSeasonOverviewRows({ gameState }),
    gameState.seasonState.beliebtheitByTeamId,
  );
  return new Map([...ranks.entries()].map(([teamId, q]) => [teamId, q.leaguePosition] as const));
}

/** Salary-Faktor je Saison, wie ihn die Engine gefuehrt hat. */
export function salaryFactorsBySeason(gameState: GameState): Map<string, number> {
  const out = new Map<string, number>();
  for (const entry of gameState.seasonState.seasonEconomyFactors ?? []) {
    if (entry?.seasonId) out.set(entry.seasonId, entry.factor ?? 1);
  }
  return out;
}
