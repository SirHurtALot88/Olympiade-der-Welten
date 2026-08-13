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

    const teamScore = round1(teamErgebnis.totalScore ?? 0);
    const players = eigene.map((eintrag) => ({
      playerId: eintrag.playerId ?? null,
      val: round1(eintrag.finalPlayerScore ?? 0),
      name: namensregister.get(eintrag.playerId) ?? eintrag.playerId,
      portraitUrl: portraitById.get(eintrag.playerId) ?? null,
      mods: [] as StagePreviewTeam["players"][number]["mods"],
      pointsAwarded: null,
    }));

    /**
     * REST-ABGLEICH — ohne ihn zeigte die Bühne eine Rechnung, die nicht aufgeht.
     *
     * Die gebuchten Spieler-Scores tragen NICHT die Team-Effekte (Intensität, Team-Power,
     * Team-PPs); die stecken nur im Team-Score. Auf Chris' Spielstand summieren sich Spineshard
     * (29,3) und Myrth (9,9) auf 39,2, während das Team mit 47,8 gewertet wurde — der Kopf hätte
     * 47,8 gemeldet und die Bahnen darunter 39,2. Genau so einen stillen Widerspruch soll diese
     * Anzeige nicht mehr produzieren.
     *
     * Der Unterschied landet deshalb beschriftet auf dem letzten Slot, wie es der Vorschau-Weg in
     * `discipline-stage-from-preview.ts` schon tut. „Team" ist dabei ehrlich: es IST ein
     * Team-Effekt, nur ohne die feinere Aufschlüsselung, die nur die Vorschau kennt.
     */
    const spielerSumme = round1(players.reduce((summe, spieler) => summe + spieler.val, 0));
    const rest = round1(teamScore - spielerSumme);
    if (Math.abs(rest) >= 0.05 && players.length > 0) {
      const letzter = players[players.length - 1]!;
      letzter.mods.push({ k: "Team", sign: rest < 0 ? -1 : 1, amt: Math.abs(rest) });
    }

    return {
      teamId: teamErgebnis.teamId,
      code: meta?.code ?? teamErgebnis.teamId,
      name: meta?.name ?? teamErgebnis.teamId,
      logoUrl: meta?.logoUrl ?? null,
      rank: teamErgebnis.rank ?? 0,
      score: teamScore,
      teamPoints: null,
      // Kein Eintrag trotz gebuchtem Team-Ergebnis heisst: keine Aufstellung eingereicht. Dieselbe
      // Aussage, die die Vorschau über ihr `missingLineup`-Flag trifft.
      missingLineup: eigene.length === 0,
      captainPlayerId: null,
      captainName: null,
      players,
    };
  });
}

/**
 * WELCHE BAHNEN GELTEN — Vorschau oder gebuchtes Ergebnis?
 *
 * Die Vorschau ist die reichere Anzeige (Fatigue, Captain, Mutator, Form je Spieler); das
 * gebuchte Ergebnis ist die WAHRE. Solange beide dieselben Zahlen tragen, ist die reichere
 * die bessere Wahl. Weichen sie ab, gewinnt das Gebuchte — auch wenn es karger aussieht.
 *
 * GEMESSEN am Spielstand `new-game-1785823388048-1hf25q` (Saison 2, Spieltag 10, Abbild vom
 * 11.08.2026): die Arena zog ihre Vorschau aus einem laengst verfallenen Resolve-Snapshot und
 * zeigte in 20 von 32 d1-Team-Zeilen einen anderen Score als gebucht (max 0,70). Die Raenge
 * stimmten dort noch zufaellig ueberein — bei einem Gleichstand kippt einer, und die Bühne
 * zeigt dann einen Rang und damit Punkte, die nie gebucht wurden.
 *
 * Toleranz: 0,05 auf den Score (dieselbe Schwelle, mit der die Bühne ihre Mod-Zeilen
 * unterdrückt) und Rang-Gleichheit exakt.
 */
export const DISCIPLINE_STAGE_SCORE_TOLERANCE = 0.05;

export function disciplineStagePreviewMatchesBooked(
  previewTeams: StagePreviewTeam[],
  bookedTeams: StagePreviewTeam[],
): boolean {
  if (previewTeams.length !== bookedTeams.length) return false;
  const bookedByTeamId = new Map(bookedTeams.map((team) => [team.teamId, team] as const));
  return previewTeams.every((previewTeam) => {
    const booked = bookedByTeamId.get(previewTeam.teamId);
    if (!booked) return false;
    if (previewTeam.rank !== booked.rank) return false;
    return Math.abs(previewTeam.score - booked.score) < DISCIPLINE_STAGE_SCORE_TOLERANCE;
  });
}

/**
 * Die Entscheidung selbst: gibt es kein gebuchtes Ergebnis, gilt die Vorschau (die Disziplin
 * laeuft gerade). Gibt es eines, gilt die Vorschau nur, wenn sie es TRIFFT.
 */
export function chooseDisciplineStageTeams(input: {
  previewTeams: StagePreviewTeam[] | null;
  bookedTeams: StagePreviewTeam[] | null;
}): { teams: StagePreviewTeam[] | null; source: "preview" | "booked" | "none" } {
  const { previewTeams, bookedTeams } = input;
  if (!bookedTeams || bookedTeams.length === 0) {
    return previewTeams && previewTeams.length > 0
      ? { teams: previewTeams, source: "preview" }
      : { teams: null, source: "none" };
  }
  if (previewTeams && previewTeams.length > 0 && disciplineStagePreviewMatchesBooked(previewTeams, bookedTeams)) {
    return { teams: previewTeams, source: "preview" };
  }
  return { teams: bookedTeams, source: "booked" };
}
