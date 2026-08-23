/**
 * CHRIS AM 23.08.2026: „eigentlich gibts aktuell keine team power die darf auch nicht im
 * scoring vorkommen."
 *
 * Der Schalter `TEAM_POWERS_ENABLED` steht auf `false`, und `tests/team-powers-disabled.test.ts`
 * haelt das fest. Diese Messung beantwortet die andere Haelfte: liegt in den ECHTEN Spielstaenden
 * noch Team-Power-Zustand, der wieder wirken wuerde, sobald jemand den Schalter umlegt?
 *
 * Gemessen wird, was gespeichert ist — nicht, was gerechnet wird. Eine Null aus einer leeren
 * Menge ist kein Beleg, deshalb steht ueberall daneben, wie gross die durchsuchte Menge war.
 *
 * Aufruf: OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/messe-team-power-im-scoring.ts
 */
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { TEAM_POWERS_ENABLED, getTeamPowerOptions } from "@/lib/lineups/team-powers";

import type { GameState } from "@/lib/data/olyDataTypes";

console.log(`Schalter TEAM_POWERS_ENABLED = ${TEAM_POWERS_ENABLED}\n`);

const repository = createSaveRepository();
let saveCount = 0;
let gesamtDrafts = 0;
let gesamtDraftsMitPower = 0;
let gesamtGespeichertePowers = 0;
let gesamtAngeboteneOptionen = 0;

for (const kopf of repository.listSaves()) {
  const gameState = repository.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gameState) continue;
  saveCount += 1;

  const seasonState = gameState.seasonState as unknown as {
    teamPowers?: Array<{ teamId?: string; selectedForSeason?: boolean }>;
    lineupDrafts?: Array<{ teamId?: string; modifiers?: Record<string, { teamPowerId?: string | null }> }>;
  };

  const gespeichertePowers = seasonState.teamPowers ?? [];
  const drafts = seasonState.lineupDrafts ?? [];

  // Ein Draft „traegt eine Power", wenn irgendeine Disziplinseite eine teamPowerId gespeichert hat.
  const draftsMitPower = drafts.filter((draft) =>
    Object.values(draft.modifiers ?? {}).some((seite) => seite?.teamPowerId != null),
  );

  // Und das Entscheidende: bietet das Spiel dem Team ueberhaupt noch eine Power an? Genau diese
  // Liste speist die Auswahl im Aufstellungsdialog UND den Score-Beitrag.
  const angebotene = gameState.teams.reduce((summe, team) => {
    const optionen = getTeamPowerOptions({
      gameState,
      seasonId: gameState.season.id,
      teamId: team.teamId,
    });
    return summe + optionen.length;
  }, 0);

  gesamtDrafts += drafts.length;
  gesamtDraftsMitPower += draftsMitPower.length;
  gesamtGespeichertePowers += gespeichertePowers.length;
  gesamtAngeboteneOptionen += angebotene;

  console.log(
    `${kopf.saveId}\n` +
      `  Teams ${gameState.teams.length} · gespeicherte teamPowers ${gespeichertePowers.length}` +
      ` · Aufstellungs-Entwuerfe ${drafts.length}, davon mit teamPowerId ${draftsMitPower.length}\n` +
      `  angebotene Power-Optionen ueber alle Teams: ${angebotene}`,
  );
}

console.log(
  `\n=== ${saveCount} Spielstaende · ${gesamtGespeichertePowers} gespeicherte teamPowers` +
    ` · ${gesamtDraftsMitPower} von ${gesamtDrafts} Entwuerfen tragen eine teamPowerId` +
    ` · ${gesamtAngeboteneOptionen} angebotene Optionen`,
);
console.log(
  gesamtAngeboteneOptionen === 0
    ? "Kein Team bekommt eine Power angeboten — der Schalter greift auf allen Spielstaenden."
    : "ACHTUNG: es werden Powers angeboten, obwohl der Schalter aus steht.",
);
