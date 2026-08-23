import type { GameState } from "@/lib/data/olyDataTypes";
import { leseMerkliste } from "@/lib/merkliste/merkliste-service";

/**
 * DAS MODELL DER MERKLISTEN-ANSICHT — „sich die dann noch mal angucken kann" (Chris).
 *
 * Reine Ableitung aus dem Spielstand, damit sie ohne React pruefbar ist. Die Ansicht daneben
 * zeichnet nur noch.
 *
 * DREI ENTSCHEIDUNGEN, die hier im Modell fallen und nicht in der Optik:
 *
 * 1. NEUESTE ZUERST. Die Merkliste ist ein Stapel Lesezeichen, kein Ranking. Nach Saisonrang zu
 *    sortieren waere eine zweite, konkurrierende Lesart derselben Liste — und die Reihenfolge, in
 *    der man etwas hineingelegt hat, ist die einzige, die man selbst gemacht hat.
 *
 * 2. EIN VERSCHWUNDENER EINTRAG WIRD GEZEIGT, NICHT VERSCHLUCKT. Ein gemerkter Spieler kann aus
 *    dem Spielstand fallen (Karriereende). Ihn still zu entfernen ist genau der Fehler, den die
 *    Scouting-Beobachtungsliste macht — dort verschwindet ein Spieler, sobald er in einem Kader
 *    steht, und niemand sieht warum. Hier bleibt die Zeile stehen und sagt, dass es den Spieler
 *    nicht mehr gibt; wegnehmen kann man sie mit demselben Stern wie alles andere.
 *
 * 3. KEIN OVR, KEIN MARKTWERT. Beide haben im Spiel genau eine kanonische Quelle (den
 *    Spieler-Slice), und die liegt nicht im Spielstand. Eine hier nachgerechnete Zahl waere eine
 *    zweite Wahrheit — lieber nichts zeigen als etwas, das eine Stelle weiter anders lautet.
 */

export type MerklisteTeamZeile = {
  teamId: string;
  name: string;
  code: string;
  /** Saisonrang aus derselben Quelle wie die Saisontabelle. `null`, solange nichts gewertet ist. */
  rank: number | null;
  points: number | null;
  angelegtAm: string;
  /** Das Team steht nicht mehr im Spielstand — kommt praktisch nie vor, wird aber nicht verschwiegen. */
  fehlt: boolean;
};

export type MerklisteSpielerZeile = {
  playerId: string;
  name: string;
  /** Aktuelles Team laut Kaderliste. `null` = vertragslos oder nicht mehr vorhanden. */
  teamId: string | null;
  teamName: string | null;
  className: string | null;
  angelegtAm: string;
  fehlt: boolean;
};

export type MerklistenAnsicht = {
  teams: MerklisteTeamZeile[];
  spieler: MerklisteSpielerZeile[];
  /** Beides zusammen — die Zahl, die ueber der Ansicht steht. */
  gesamt: number;
};

export function baueMerklistenAnsicht(input: {
  gameState: GameState;
  ownerId: string | null;
}): MerklistenAnsicht {
  const { gameState } = input;
  const eintraege = leseMerkliste(gameState, input.ownerId);

  const teamById = new Map((gameState.teams ?? []).map((team) => [team.teamId, team] as const));
  const playerById = new Map((gameState.players ?? []).map((player) => [player.id, player] as const));
  const teamIdByPlayerId = new Map((gameState.rosters ?? []).map((entry) => [entry.playerId, entry.teamId] as const));
  const standings = (gameState.seasonState?.standings ?? {}) as Record<
    string,
    { rank?: number | null; points?: number | null } | undefined
  >;

  const teams: MerklisteTeamZeile[] = [];
  const spieler: MerklisteSpielerZeile[] = [];

  for (const eintrag of eintraege) {
    if (eintrag.art === "team") {
      const team = teamById.get(eintrag.id);
      const stand = standings[eintrag.id];
      teams.push({
        teamId: eintrag.id,
        name: team?.name ?? eintrag.id,
        code: team?.shortCode ?? "—",
        rank: typeof stand?.rank === "number" && Number.isFinite(stand.rank) ? stand.rank : null,
        points: typeof stand?.points === "number" && Number.isFinite(stand.points) ? stand.points : null,
        angelegtAm: eintrag.angelegtAm,
        fehlt: !team,
      });
      continue;
    }

    const player = playerById.get(eintrag.id);
    const teamId = teamIdByPlayerId.get(eintrag.id) ?? null;
    spieler.push({
      playerId: eintrag.id,
      name: player?.name ?? eintrag.id,
      teamId,
      teamName: teamId ? teamById.get(teamId)?.name ?? null : null,
      className: player?.className ?? null,
      angelegtAm: eintrag.angelegtAm,
      fehlt: !player,
    });
  }

  return { teams, spieler, gesamt: teams.length + spieler.length };
}
