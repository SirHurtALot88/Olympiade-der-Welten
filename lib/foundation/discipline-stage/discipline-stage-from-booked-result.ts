/**
 * DIE BÜHNE AUS DEM GEBUCHTEN ERGEBNIS — der Rückfall, den es vorher nicht gab.
 *
 * GEMELDET VON CHRIS: „ich hab hier platz 28 … bin aber hier letzter?" — die Arena zeigte für
 * Stronghold Crusaders in der Staffel Tahra (+40,7) und Chad Thunderjaw (+40,2), Rang 28 mit
 * 80,9 Pkt. Gebucht war etwas völlig anderes: aufgestellt waren Spineshard (29,3) und Myrth (9,9),
 * Team-Rang 31 mit 47,8. Dasselbe bei V-D: die Bühne stellte Queen Butterfly an die Spitze, während
 * das Team tatsächlich Vierter wurde.
 *
 * URSACHE: `DisciplineStageArena` nahm die Bahnen aus der Resolve-Vorschau — und fiel, wenn die für
 * diese Disziplin nichts hergab, STILL auf `buildDisciplineStageModel` zurück. Dieses Modell liest
 * die Aufstellung überhaupt nicht: es sucht sich pro Team selbst die besten Spieler nach
 * Rating − Fatigue + Form (mit Jitter). Am gemeldeten Spielstand nachgerechnet wählt es für S-C in
 * der Staffel exakt Tahra (41,7) und Chad (41,2) — genau die falschen Namen auf dem Bildschirm.
 * Als Vorschau ist das Modell richtig; als Ergebnis-Anzeige erfindet es Tatsachen.
 *
 * DIESE DATEI schließt die Lücke: ist die Disziplin bereits gewertet, kommen die Bahnen aus dem, was
 * WIRKLICH gebucht wurde — `seasonState.disciplineResults` (Rang + Team-Score) und
 * `seasonState.playerDisciplinePerformances` (Spieler, Slot, Score). Damit braucht die Arena das
 * erfundene Modell im Echt-Modus nie mehr.
 *
 * BEWUSST OHNE Mod-Zerlegung: Fatigue-, Captain-, Mutator- und Form-Anteile stehen nur in der
 * Resolve-Vorschau, nicht im gebuchten Ergebnis. Statt sie zu schätzen, trägt jeder Spieler hier
 * seinen vollen Score als Basiswert und KEINE Mods — lieber eine karge, wahre Zerlegung als eine
 * hübsche, erfundene. Die Vorschau bleibt der bevorzugte Weg, dieser hier ist der Rückfall.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type {
  StagePreviewTeam,
  StageTeamMeta,
} from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";

function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** Das jüngste Spieltag-Ergebnis der laufenden Saison — die Bühne zeigt immer den aktuellen. */
function findCurrentMatchdayResultId(gameState: GameState): string | null {
  const seasonId = gameState.season?.id;
  const matchdayId = gameState.matchdayState?.matchdayId;
  const treffer = (gameState.seasonState?.matchdayResults ?? []).find(
    (result) => result.seasonId === seasonId && result.matchdayId === matchdayId,
  );
  return treffer?.id ?? null;
}

/**
 * Baut die Bühnen-Teams einer bereits gewerteten Disziplin aus dem gebuchten Ergebnis.
 * Liefert `null`, wenn für diese Disziplin nichts gebucht ist — dann ist die Disziplin schlicht
 * noch nicht gelaufen, und der Aufrufer darf NICHT auf ein Modell ausweichen, sondern muss das
 * sagen.
 */
export function buildDisciplineStageTeamsFromBookedResult(
  gameState: GameState,
  disciplineId: string,
  teamMetaById: Map<string, StageTeamMeta>,
  portraitById: Map<string, string | null>,
): StagePreviewTeam[] | null {
  const matchdayResultId = findCurrentMatchdayResultId(gameState);
  if (!matchdayResultId) return null;

  const teamErgebnisse = (gameState.seasonState?.disciplineResults ?? []).filter(
    (row) => row.matchdayResultId === matchdayResultId && row.disciplineId === disciplineId,
  );
  if (teamErgebnisse.length === 0) return null;

  const leistungen = (gameState.seasonState?.playerDisciplinePerformances ?? []).filter(
    (row) => row.matchdayResultId === matchdayResultId && row.disciplineId === disciplineId,
  );
  const proTeam = new Map<string, typeof leistungen>();
  for (const eintrag of leistungen) {
    const liste = proTeam.get(eintrag.teamId) ?? [];
    liste.push(eintrag);
    proTeam.set(eintrag.teamId, liste);
  }

  const namensregister = new Map((gameState.players ?? []).map((player) => [player.id, player.name]));

  return teamErgebnisse.map((teamErgebnis) => {
    const meta = teamMetaById.get(teamErgebnis.teamId);
    // Slot-Reihenfolge ist die AUFSTELLUNG, nicht die Leistung: die Bahnen sollen zeigen, wen das
    // Team auf welche Etappe gestellt hat.
    const eigene = [...(proTeam.get(teamErgebnis.teamId) ?? [])].sort(
      (links, rechts) => (links.slotIndex ?? 0) - (rechts.slotIndex ?? 0),
    );

    return {
      teamId: teamErgebnis.teamId,
      code: meta?.code ?? teamErgebnis.teamId,
      name: meta?.name ?? teamErgebnis.teamId,
      logoUrl: meta?.logoUrl ?? null,
      rank: teamErgebnis.rank ?? 0,
      score: round1(teamErgebnis.totalScore ?? 0),
      teamPoints: null,
      // Kein Eintrag trotz gebuchtem Team-Ergebnis heisst: keine Aufstellung eingereicht. Dieselbe
      // Aussage, die die Vorschau über ihr `missingLineup`-Flag trifft.
      missingLineup: eigene.length === 0,
      captainPlayerId: null,
      captainName: null,
      players: eigene.map((eintrag) => ({
        playerId: eintrag.playerId ?? null,
        val: round1(eintrag.finalPlayerScore ?? 0),
        name: namensregister.get(eintrag.playerId) ?? eintrag.playerId,
        portraitUrl: portraitById.get(eintrag.playerId) ?? null,
        mods: [],
        pointsAwarded: null,
      })),
    };
  });
}
