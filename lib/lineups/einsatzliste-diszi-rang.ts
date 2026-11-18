/**
 * RANG DES EIGENEN TEAMS IN EINER DISZIPLIN (Einsatzliste, Kopf, 18.11.). Reine Rechnung, nur Anzeige.
 *
 * Bisher stand dort „RANG 19“ ohne Bezug: es war der KADERSTÄRKE-Rang (Summe der sechs besten
 * Disziplin-Eignungen im Kader, `team-discipline-rank-engine.ts`) über ALLE Teams. Jetzt:
 *  - Vor der ersten Wertung dieser Disziplin: Rang nach Kaderstärke, beschriftet als „Kaderstärke“.
 *  - Sobald die Disziplin in dieser Saison gewertet wurde: echter Disziplin-Saisonrang nach Teampunkten
 *    (`disciplineResults.teamPoints`, nur gewertete Spiele wie die Bilanz), beschriftet als „Saison“.
 *  - Groß der Rang in der eigenen Liga, klein der Rang unter allen Teams.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSharedRankMap } from "@/lib/foundation/season-stand-rank-helpers";
import { buildTeamDisciplineRankRowsFromGameState } from "@/lib/foundation/team-discipline-rank-engine";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";

export type DisziRang = {
  quelle: "kader" | "saison";
  /** Rang in der eigenen Liga; null ohne aktiven Liga-Split. */
  liga: number | null;
  ligaName: string | null;
  ligaGroesse: number | null;
  gesamt: number;
  gesamtVon: number;
  /** Nur Saison: Teampunkte bis zum Vordermann der eigenen Liga (null auf Rang 1 oder ohne Daten). */
  abstandVordermann: number | null;
};

const GEWERTET = new Set(["arena", "pps_duell", "mini_dm_pod"]);

function rangIn(werte: Array<{ teamId: string; value: number }>, teamId: string): number | null {
  return buildSharedRankMap(werte).get(teamId) ?? null;
}

export function berechneDisziRang(gs: GameState, teamId: string, disciplineId: string): DisziRang | null {
  const teams = gs.teams.map((t) => t.teamId);
  if (!teams.includes(teamId)) return null;
  const split = isLeagueSplitActive(gs);
  const eigene = split ? getLeagueOf(gs, teamId) : null;
  const ligaTeams = split && eigene ? teams.filter((id) => getLeagueOf(gs, id) === eigene) : null;
  const ligaName = eigene === "liga1" ? "Liga 1" : eigene === "liga2" ? "Liga 2" : null;

  // Saisonrang: Teampunkte dieser Disziplin aus gewerteten Spieltagen der laufenden Saison.
  const seasonId = gs.season?.id;
  const gewertete = new Set(
    (gs.seasonState?.matchdayResults ?? [])
      .filter((r) => r.seasonId === seasonId && r.status === "preview_applied")
      .map((r) => r.id),
  );
  const punkte = new Map<string, number>();
  let gefunden = false;
  for (const row of gs.seasonState?.disciplineResults ?? []) {
    if (row.disciplineId !== disciplineId || !gewertete.has(row.matchdayResultId)) continue;
    if (!GEWERTET.has(String(row.resolutionSource)) || typeof row.teamPoints !== "number") continue;
    punkte.set(row.teamId, (punkte.get(row.teamId) ?? 0) + row.teamPoints);
    gefunden = true;
  }
  if (gefunden) {
    const werte = teams.map((id) => ({ teamId: id, value: punkte.get(id) ?? 0 }));
    const gesamt = rangIn(werte, teamId);
    if (gesamt != null) {
      const inLiga = ligaTeams ? werte.filter((w) => ligaTeams.includes(w.teamId)) : null;
      const liga = inLiga ? rangIn(inLiga, teamId) : null;
      const feld = inLiga ?? werte;
      const eigenPunkte = punkte.get(teamId) ?? 0;
      const ueber = feld.map((w) => w.value).filter((v) => v > eigenPunkte + 0.0001);
      return {
        quelle: "saison",
        liga,
        ligaName,
        ligaGroesse: ligaTeams?.length ?? null,
        gesamt,
        gesamtVon: teams.length,
        abstandVordermann: ueber.length > 0 ? Math.round((Math.min(...ueber) - eigenPunkte) * 10) / 10 : null,
      };
    }
  }

  // Kaderstärke: beide Räume aus derselben Engine (Liga-Raum und alle Teams).
  try {
    const kombi = buildTeamDisciplineRankRowsFromGameState(gs, gs.disciplines, "combined").find((z) => z.teamId === teamId);
    const gesamt = kombi?.disciplineRanks[disciplineId];
    if (!gesamt) return null;
    const liga = split
      ? (buildTeamDisciplineRankRowsFromGameState(gs, gs.disciplines, "scoped").find((z) => z.teamId === teamId)?.disciplineRanks[disciplineId] ?? null)
      : null;
    return { quelle: "kader", liga: liga || null, ligaName, ligaGroesse: ligaTeams?.length ?? null, gesamt, gesamtVon: teams.length, abstandVordermann: null };
  } catch {
    return null;
  }
}
