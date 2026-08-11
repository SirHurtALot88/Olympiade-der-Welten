/**
 * GEMELDET (Nachmessung, Live-Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10):
 * zwei der fuenfzehn erweiterten Meilensteine zeigten einen zu kleinen Fortschritt —
 * „Breit aufgestellt" meldete „0 von 4 Bereichen" statt 2, „Lauf" meldete „Laengste Serie:
 * 0 von 3" statt 2.
 *
 * BEFUND: derselbe wie beim Rekordbuch nebenan. `buildExtendedLeagueAchievements` laeuft im
 * Browser auf dem kompakten Payload, und der beschneidet `disciplineResults` auf den aktiven
 * Spieltag (`compactFoundationInitialGameState`). Alles, was ueber MEHRERE Spieltage misst,
 * sieht deshalb nur einen. Dass die uebrigen Disziplin-Meilensteine gerade stimmten, war Zufall
 * der Datenlage: das gemessene Team hat in Saison 2 keine Disziplin gewonnen, also stand ueberall
 * 0 — bei einem Team mit Siegen waeren sie genauso falsch.
 *
 * Nach dem Muster der Geschwister (`foundation-field-race-projection`,
 * `foundation-form-card-projection`): die fertige, kleine Bilanz faehrt mit, serverseitig auf dem
 * VOLLEN Save gerechnet. Bewusst FUER ALLE TEAMS und nicht nur fuers Managerteam — der Reiter
 * misst gegen `activeManagerTeamId`, und das kann ohne neue Auslieferung wechseln; eine auf ein
 * Team eingefrorene Antwort waere dann schlimmer als der Fehler, den sie behebt.
 *
 * Reine Anzeigefracht: wird beim Compact-PUT-Roundtrip verworfen und bei jeder Auslieferung
 * frisch gebaut. Es gibt keine zweite Wahrheit.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildSeasonDisciplineTallyByTeamId,
  zaehleBelegteSpieltage,
  type SeasonDisciplineTallyByTeamId,
  type SeasonDisciplineTallyEntry,
} from "@/lib/foundation/season-discipline-tally";

export type FoundationDisciplineTallyProjection = {
  seasonId: string;
  /** Wie viele Spieltage der Bilanz zugrunde liegen — zugleich das Vorrangmass. */
  matchdaysPlayed: number;
  byTeamId: Record<string, SeasonDisciplineTallyEntry>;
};

export function projiziereDisziplinBilanz(gameState: GameState): FoundationDisciplineTallyProjection | undefined {
  try {
    const bilanz = buildSeasonDisciplineTallyByTeamId(gameState);
    if (bilanz.size === 0) {
      return undefined;
    }
    return {
      seasonId: gameState.season.id,
      matchdaysPlayed: zaehleBelegteSpieltage(gameState),
      byTeamId: Object.fromEntries(bilanz),
    };
  } catch {
    // Defensiv wie die Geschwister-Projektionen: eine kaputte Projektion darf die
    // Compact-Auslieferung nie zu Fall bringen — dann eben clientseitiger Fallback.
    return undefined;
  }
}

/**
 * Die Disziplin-Bilanz der bereits geladenen Ansicht: selbst gerechnet, wenn der Stand die
 * Spieltage wirklich traegt (Server), sonst die mitgefahrene Projektion (Browser).
 *
 * DER VORRANG HAENGT AN DER ABDECKUNG, NICHT AN `??`. Eine leere `Map` ist nicht nullish, und
 * genau daran waere ein `??` gescheitert (siehe `leseSaisonSchnappschuesse`). Verglichen werden
 * die BELEGTEN Spieltage: traegt der Stand mindestens so viele wie die Projektion, ist er der
 * vollstaendigere und gewinnt.
 */
export function leseDisziplinBilanz(gameState: GameState): SeasonDisciplineTallyByTeamId {
  const projektion = gameState.seasonState.foundationDisciplineTally;
  if (
    projektion &&
    projektion.seasonId === gameState.season.id &&
    projektion.matchdaysPlayed > zaehleBelegteSpieltage(gameState)
  ) {
    return new Map(Object.entries(projektion.byTeamId));
  }
  return buildSeasonDisciplineTallyByTeamId(gameState);
}
