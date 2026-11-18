/**
 * MATCHWINNER (Bestenliste des Saisonstands, 18.11.): wie oft war ein Spieler der BESTE SEINES TEAMS in
 * einem GEWONNENEN Einsatz. Entscheidung PM 18.11. (Frage 3 des Entwurfs): Matchwinner statt Summe der PPs.
 *
 * Gewonnen = das Team hat in diesem Einsatz 2 Teampunkte geholt (2/1/0, Vierer-Pods 2/1/0/0).
 * Bester des Teams = `rankInTeam === 1` der Einsatz-Zeile des Spielers. Gezählt werden nur Spieltage mit
 * Status `preview_applied` der gewählten Saison. Reine Projektion aus `seasonState`, keine neue Persistenz.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

export type MatchwinnerEintrag = {
  playerId: string;
  name: string;
  teamId: string;
  /** Einsätze als bester des Teams in einem gewonnenen Einsatz. */
  matchwinner: number;
  /** Alle gewerteten Einsätze dieses Spielers in der Saison. */
  einsaetze: number;
};

export function baueMatchwinnerListe(
  gameState: Pick<GameState, "seasonState" | "players">,
  seasonId: string,
  limit = 12,
): MatchwinnerEintrag[] {
  const gewertet = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((r) => r.seasonId === seasonId && r.status === "preview_applied")
      .map((r) => r.id),
  );
  if (gewertet.size === 0) return [];
  const gewonnen = new Set<string>();
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    if (!gewertet.has(row.matchdayResultId)) continue;
    if (typeof row.teamPoints === "number" && row.teamPoints >= 2) {
      gewonnen.add(`${row.matchdayResultId}|${row.teamId}|${row.disciplineId}`);
    }
  }
  const nameVon = new Map(gameState.players.map((p) => [p.id, p.name] as const));
  const zaehler = new Map<string, MatchwinnerEintrag>();
  for (const p of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (!gewertet.has(p.matchdayResultId)) continue;
    const eintrag = zaehler.get(p.playerId) ?? {
      playerId: p.playerId,
      name: nameVon.get(p.playerId) ?? p.playerId,
      teamId: p.teamId,
      matchwinner: 0,
      einsaetze: 0,
    };
    eintrag.einsaetze += 1;
    eintrag.teamId = p.teamId;
    if (p.rankInTeam === 1 && gewonnen.has(`${p.matchdayResultId}|${p.teamId}|${p.disciplineId}`)) eintrag.matchwinner += 1;
    zaehler.set(p.playerId, eintrag);
  }
  return [...zaehler.values()]
    .filter((e) => e.matchwinner > 0)
    .sort((a, b) => b.matchwinner - a.matchwinner || a.einsaetze - b.einsaetze || a.name.localeCompare(b.name, "de"))
    .slice(0, limit);
}
