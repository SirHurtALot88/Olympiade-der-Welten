import { computeSeasonEndContractTick, hasSeasonEndContractTickApplied } from "@/lib/contracts/contract-renewal-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * DIE ALTERUNG NACHHOLEN — fuer Spielstaende, die schon in der Phase stehen.
 *
 * GEMELDET VON CHRIS: „zum zeitpunkt der verlängerung müsste wenn da vertrag läuft aus die
 * vertragslänge von allen doch schon um 1 reduziert sein oder nicht?"
 *
 * Ja. Ab sofort erledigt das der Uebergangsschritt `player_development`, der auf
 * `season_end_management` schaltet (`season-transition-service.ts`). Ein Spielstand, der diesen
 * Hop schon HINTER sich hat, sieht ihn aber nie wieder — und steht damit dauerhaft mit
 * ungealterten Vertraegen in der Phase, in der ueber sie entschieden wird. Genau dort steckte der
 * gemeldete Spielstand fest: 288 von 339 Vertraegen auf Laufzeit 1, kein einziger auf 0.
 *
 * Deshalb dieser Nachzieher an der Vertragsroute. Er ist KEINE zweite Wahrheit — er ruft denselben
 * Tick — und er ist ein Nichtstun, sobald die Alterung fuer die Saison gelaufen ist
 * (`hasSeasonEndContractTickApplied`, in `computeSeasonEndContractTick` noch einmal geprueft).
 *
 * WARUM AUCH BEI EINER VORSCHAU GESCHRIEBEN WIRD. Der Nachzieher ist nicht Teil der angefragten
 * Aktion, sondern eine Reparatur des Spielstands: er stellt den Zustand her, den die Phase laengst
 * haben muesste. Liefe er nur bei der produktiven Buchung, zeigte die Vorschau davor noch die
 * ungealterten Laufzeiten — der Nutzer entschiede also auf Zahlen, die im selben Moment falsch
 * werden. Der Client holt ohnehin unmittelbar vor dem Schreiben eine frische Vorschau; laeuft die
 * Reparatur bei der ersten der beiden Anfragen, sehen beide denselben Stand.
 *
 * AUSSERHALB DES SAISONENDE-FENSTERS passiert nichts: mitten in der Saison duerfen Vertraege nicht
 * altern, und `isSeasonEndPhase` ist die eine Stelle, die entscheidet, was „Saisonende" heisst.
 */
export function zieheVertragsalterungNach(input: {
  save: PersistedSaveGame;
  persistence: PersistenceService;
}): { save: PersistedSaveGame; nachgezogen: boolean; warnungen: string[] } {
  const { save, persistence } = input;

  if (!isSeasonEndPhase(save.gameState.gamePhase)) {
    return { save, nachgezogen: false, warnungen: [] };
  }
  if (hasSeasonEndContractTickApplied(save.gameState)) {
    return { save, nachgezogen: false, warnungen: [] };
  }

  try {
    const alterung = computeSeasonEndContractTick(save);
    if (!alterung.applied) {
      return { save, nachgezogen: false, warnungen: [] };
    }
    const gealtert: PersistedSaveGame = { ...save, gameState: alterung.gameState };
    persistence.saveSingleplayerState(save.saveId, gealtert.gameState);
    return {
      save: gealtert,
      nachgezogen: true,
      warnungen: [
        `season_end_contract_tick_nachgezogen:${alterung.releasedPlayers}_freigegeben:${alterung.renewedPlayers}_verlaengert`,
      ],
    };
  } catch (error) {
    /**
     * Scheitert die Reparatur, blockiert sie die Anfrage NICHT. Ein Spielstand, der ohne Alterung
     * weiterlaeuft, ist unschoen; einer, der die Vertragsansicht gar nicht mehr oeffnen kann, ist
     * schlimmer — und der Saisonstart holt den Tick ohnehin nach.
     */
    return {
      save,
      nachgezogen: false,
      warnungen: [`season_end_contract_tick_nachziehen_fehlgeschlagen:${error instanceof Error ? error.message : "unknown"}`],
    };
  }
}
