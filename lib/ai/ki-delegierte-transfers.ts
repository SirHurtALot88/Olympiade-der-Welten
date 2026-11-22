import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";

/**
 * Review 22.11. Befund 10: „Voll KI“ (Bereich `transfers` an die KI delegiert) bekam ab Saison 2 weder Kauf- noch Verkaufsrunde, weil
 * `getAiTeamIds` nur `controlMode === "ai"` kennt. Diese Teams nehmen jetzt am Kauffenster teil — mit denselben Regeln und Funktionen
 * wie KI-Teams (Vorstandsquote, Rahmen, Kassensturz); gesetzt ist, was der Mensch selbst gesetzt hat, bleibt unberuehrt (die
 * Kaufplaner fuellen nur Luecken). Teams mit `transfers: "selbst"` (Franky, Ramona in der Halbautomatik) bleiben geschuetzt.
 */
export function ermittleDelegierteTransferTeamIds(gameState: GameState, callerWritableTeamIds: Set<string> | null): string[] {
  const einstellungen = gameState.seasonState.teamControlSettings ?? {};
  return gameState.teams
    .filter((team) => {
      const e = einstellungen[team.teamId];
      return e != null && e.controlMode === "manual" && isBereichDelegiert(e, "transfers") && (!callerWritableTeamIds || callerWritableTeamIds.has(team.teamId));
    })
    .map((team) => team.teamId);
}

/**
 * Fuehrt `arbeit` aus, waehrend die delegierten Teams im Spielstand als "ai" stehen (die Kaufdienste lesen alle `controlMode`
 * aus `teamControlSettings`), und stellt ihren Modus danach aus dem frischen Stand wieder her.
 */
export async function mitDelegiertenAlsKi<T>(
  persistence: PersistenceService,
  saveId: string,
  teamIds: string[],
  arbeit: () => Promise<T>,
): Promise<T> {
  if (teamIds.length === 0) return arbeit();
  const setze = (modusVon: "manual" | "ai", modusNach: "manual" | "ai") => {
    const save = persistence.getSaveById(saveId);
    if (!save) return;
    const settings = { ...(save.gameState.seasonState.teamControlSettings ?? {}) };
    let geaendert = false;
    for (const teamId of teamIds) {
      const e = settings[teamId];
      if (e && e.controlMode === modusVon) {
        settings[teamId] = { ...e, controlMode: modusNach };
        geaendert = true;
      }
    }
    if (!geaendert) return;
    persistence.saveSingleplayerState(saveId, { ...save.gameState, seasonState: { ...save.gameState.seasonState, teamControlSettings: settings } }, { status: save.status });
  };
  setze("manual", "ai");
  try {
    return await arbeit();
  } finally {
    setze("ai", "manual");
  }
}
