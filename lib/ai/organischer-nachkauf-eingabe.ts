/**
 * Der Aufruf, mit dem ein laufender Spielstand sein Kauffenster NACHTRAEGLICH organisch faehrt
 * (`scripts/organischen-nachkauf-fahren.ts`).
 *
 * WARUM DAS EIN EIGENES MODUL IST: die beiden Fehler, die hier drinsteckten, waren beide am Aufruf
 * und nicht an der Logik — und ein Skript mit `void main()` am Dateiende laesst sich nicht
 * importieren, ohne es auszufuehren. Damit war der Aufruf ungeprueft. Jetzt ist er eine Funktion
 * mit Rueckgabetyp `TransferWindowSessionInput`, also pruefen ihn Compiler UND Test.
 *
 * FEHLER 1 — `teamIds` gibt es nicht. Das Feld heisst `targetTeamIds`; `teamIds` wurde per
 * `as never` am Compiler vorbeigeschmuggelt und still verworfen. Dass der Probelauf trotzdem
 * richtig aussah, lag NICHT an diesem Argument, sondern am zentralen Schutz in der Sitzung selbst
 * (`scopeTeam` gegen `manualTeamIds`) — Chris' eigenes Team war also zufaellig geschuetzt, nicht
 * absichtlich.
 *
 * FEHLER 2 — `skipIfExistingMarketTransfers` steht per Vorgabe auf AN. In der Phase `preseason`
 * bricht die Sitzung dann sofort ab, sobald die Saison schon Markttransfers kennt. Genau das ist
 * der Fall, fuer den dieses Werkzeug gebaut wurde: die Fueller fliegen raus, die guten organischen
 * Zugaenge bleiben stehen (auf Chris' Spielstand 33 `ai_preseason_market_buy`). Der Lauf waere mit
 * `skipped: true` zurueckgekommen und haette keinen einzigen Spieler gekauft. Im Probelauf fiel es
 * nicht auf, weil dort ALLE Saison-2-Kaeufe zurueckgesetzt waren und die Historie leer war.
 */
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";

import type { TransferWindowSessionInput } from "@/lib/ai/ai-transfer-window-session-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

/**
 * Die KI-gesteuerten Teams — dieselbe Regel wie `manualTeamIds` in der Sitzung, Rueckfall
 * eingeschlossen: fehlt die Einstellung, entscheidet `humanControlled`. Weicht diese Liste ab,
 * nennt der Bericht Teams als angefasst, die die Sitzung gar nicht anfasst.
 */
export function ermittleKiTeamIds(gameState: GameState): string[] {
  return gameState.teams
    .filter(
      (team) =>
        (getTeamControlSettings(gameState, team.teamId)?.controlMode ??
          (team.humanControlled ? "manual" : "ai")) === "ai",
    )
    .map((team) => team.teamId);
}

export function baueNachkaufSitzung(input: {
  saveId: string;
  seasonId: string;
  persistence: PersistenceService;
  kiTeamIds: string[];
}): TransferWindowSessionInput {
  return {
    saveId: input.saveId,
    seasonId: input.seasonId,
    persistence: input.persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    // Wie im Saisonuebergang: `teamScope` bleibt "all", die Auswahl macht `targetTeamIds`.
    teamScope: "all",
    targetTeamIds: input.kiTeamIds,
    // Siehe Fehler 2 im Kopf dieser Datei. Ohne dieses `false` tut das Werkzeug nichts.
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  };
}
