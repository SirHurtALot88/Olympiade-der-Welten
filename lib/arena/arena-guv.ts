/**
 * ARENA IN GUV, PROGNOSE UND SEITE (22.11.): Ticket-Einnahmen der Saison (gebucht plus Erwartung der offenen Heimspiele) und die
 * erwartete Buchung je Spieltag. Die Rechnung ist dieselbe Heimspiel-Formel wie in der Buchung (`rechneHeimspiel`), nur ohne
 * Ereignis und ohne Rundung; gebucht wird in `bereiteArenaBuchung`.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import { rechneHeimspiel, runde2 } from "@/lib/arena/arena-modell";
import { heimSpieltage, holeArenaStand, istLiga1, ligaTabellenAnteil, sponsorStufen } from "@/lib/arena/arena-stand";

/** Erwartete Tageskasse EINES Heimspiels beim Stand von heute (neutrales Ereignis). */
export function erwartungJeHeimspiel(gameState: GameState, teamId: string): number {
  const stand = holeArenaStand(gameState, teamId);
  const r = rechneHeimspiel({
    plaetze: stand.plaetze,
    fanbasis: stand.fanbasis,
    stimmung: stand.stimmung,
    liga1: istLiga1(gameState, teamId),
    sponsorStufe: sponsorStufen(gameState).get(teamId) ?? 0.5,
    tabellenAnteil: ligaTabellenAnteil(gameState, teamId),
    dauer: stand.dauerkarten?.seasonId === stand.seasonId ? stand.dauerkarten.plaetze : undefined,
  });
  return r.tickets;
}

/** Ticket-Einnahmen der Saison: Tageskasse gebucht plus die Erwartung der offenen Heimspiele; Dauerkarten-Geld dazu. 0 ohne Arena-Regel. */
export function ticketsSaisonbetrag(gameState: GameState, teamId: string): number {
  if (!arenaAktiv(gameState)) return 0;
  const gebucht = summeSpieltagBuchungen(gameState, teamId);
  const stand = holeArenaStand(gameState, teamId);
  const offen = heimSpieltage(gameState, teamId).filter((i) => i > stand.stand).length;
  const dauer = stand.dauerkarten?.seasonId === stand.seasonId ? stand.dauerkarten : null;
  // Dauerkarten-Geld: gebucht (Spieltag 1) oder sofort gutgeschrieben; sonst (vor Spieltag 1) das Geld der Standard-Wahl, das der Abschluss bucht.
  const dauerGeld = dauer?.sofort ? dauer.geld : gebucht.dauerkarten;
  return runde2(gebucht.tickets + dauerGeld + offen * erwartungJeHeimspiel(gameState, teamId));
}

/** Erwartete Tageskasse je Spieltag (Mittel ueber die Saison), fuer die erwartete Buchung der Finanzseite. */
export function ticketsErwartungJeSpieltag(gameState: GameState, teamId: string): number {
  if (!arenaAktiv(gameState)) return 0;
  const n = gameState.season?.matchdayIds?.length ?? 0;
  const heim = heimSpieltage(gameState, teamId).length;
  return n > 0 ? (erwartungJeHeimspiel(gameState, teamId) * heim) / n : 0;
}
