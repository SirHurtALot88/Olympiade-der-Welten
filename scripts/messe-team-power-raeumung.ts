/**
 * MISST DIE RAEUMUNG DER ALTEN TEAM-POWER-DATEN AM ECHTEN SPIELSTAND.
 *
 * CHRIS AM 23.08.2026: „die alten teamPowers können raus."
 *
 * Geprueft wird beides, was eine Raeumung falsch machen kann:
 *   1. Sie greift nicht — die Records liegen nach dem Lauf noch da.
 *   2. Sie greift zu oft — jeder Ladevorgang meldet wieder Arbeit, und weil die Aufrufer aus einer
 *      neuen Referenz auf „geaendert" schliessen, kostet das jedes Mal einen vollen Schreibvorgang
 *      (am Live-Save rund 1,2 s).
 *
 * Deshalb steht hier neben dem Vorher/Nachher auch der zweite Lauf: er MUSS dieselbe Referenz
 * zurueckgeben.
 *
 * Aufruf: OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/messe-team-power-raeumung.ts
 */
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { raeumeAbgeschalteteTeamPowers } from "@/lib/lineups/team-powers";

import type { GameState } from "@/lib/data/olyDataTypes";

type Bestand = { powers: number; draftsMitPower: number; drafts: number };

function zaehle(gameState: GameState): Bestand {
  const seasonState = gameState.seasonState as unknown as {
    teamPowers?: unknown[];
    lineupDrafts?: Array<{ modifiers?: Record<string, { teamPowerId?: string | null }> }>;
  };
  const drafts = seasonState.lineupDrafts ?? [];
  return {
    powers: (seasonState.teamPowers ?? []).length,
    drafts: drafts.length,
    draftsMitPower: drafts.filter((draft) =>
      Object.values(draft.modifiers ?? {}).some((seite) => seite?.teamPowerId != null),
    ).length,
  };
}

const repository = createSaveRepository();
let summeVorherPowers = 0;
let summeVorherDrafts = 0;
let summeNachherPowers = 0;
let summeNachherDrafts = 0;
let zweiterLaufStabil = 0;
let saves = 0;

for (const kopf of repository.listSaves()) {
  // ACHTUNG: `getSaveById` faehrt den Ladeweg — und der raeumt inzwischen selbst. Was hier als
  // „vorher" steht, ist deshalb der Stand NACH dem Ladeweg. Genau das ist die Zahl, die zaehlt:
  // sie sagt, was im Spiel noch ankommt.
  const gameState = repository.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gameState) continue;
  saves += 1;

  const nachLadeweg = zaehle(gameState);
  const geraeumt = raeumeAbgeschalteteTeamPowers(gameState);
  const nachher = zaehle(geraeumt);
  // Der entscheidende Teil: nichts mehr zu tun heisst DIESELBE Referenz, nicht nur dieselben
  // Zahlen. Eine neue Referenz mit gleichem Inhalt loest bei den Aufrufern trotzdem ein
  // Vollspeichern aus.
  const zweiter = raeumeAbgeschalteteTeamPowers(geraeumt);
  const stabil = zweiter === geraeumt;
  if (stabil) zweiterLaufStabil += 1;

  summeVorherPowers += nachLadeweg.powers;
  summeVorherDrafts += nachLadeweg.draftsMitPower;
  summeNachherPowers += nachher.powers;
  summeNachherDrafts += nachher.draftsMitPower;

  console.log(
    `${kopf.saveId}\n` +
      `  nach dem Ladeweg: teamPowers ${nachLadeweg.powers} · Entwuerfe mit teamPowerId ` +
      `${nachLadeweg.draftsMitPower} von ${nachLadeweg.drafts}\n` +
      `  nach Raeumung:    teamPowers ${nachher.powers} · Entwuerfe mit teamPowerId ${nachher.draftsMitPower}` +
      ` · zweiter Lauf stabil: ${stabil ? "ja" : "NEIN"}`,
  );
}

console.log(
  `\n=== ${saves} Spielstaende` +
    ` · teamPowers ${summeVorherPowers} -> ${summeNachherPowers}` +
    ` · Entwuerfe mit teamPowerId ${summeVorherDrafts} -> ${summeNachherDrafts}` +
    ` · zweiter Lauf stabil in ${zweiterLaufStabil}/${saves}`,
);
