import type { GameState } from "@/lib/data/olyDataTypes";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { arenaAusfallGrundLabel, findeDisziplinErgebnis } from "@/lib/foundation/season-matchday-fixtures-overview";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { isViererPodDiscipline } from "@/lib/season/season-discipline-schedule";

/**
 * ARENA-HOST-HINWEIS ("gewertet per PPS-Duell, Arena nur Vorschau") — Task #159 Punkt 3, eigener
 * kleiner Posten (s. PR #1276s Beschreibung, "Noch offen"). `FoundationBattleArenaHost.tsx` zeigt
 * schon einen pauschalen Hinweis ("noch keine offizielle Wertung … fließt nirgends in die
 * Tabelle ein") — der gilt für JEDE Disziplin, zu JEDER Zeit. Dieser Helfer ist präziser: er sagt
 * für die an EINEM bestimmten Spieltag gebuchten Disziplinen, ob die ECHTE Wertung (die in die
 * Tabelle fließt) überhaupt über die Arena läuft, oder über die PPS-Duell-Brücke
 * (`lib/resolve/battle-mode-pps-duell.ts`).
 *
 * Zwei Fälle, beide ohne zu vermuten:
 *  1) Die Disziplin ist gar nicht in `ARENA_RESOLVED_DISCIPLINE_IDS` — sie wird in dieser Saison
 *     NIE per Arena gewertet, unabhängig vom Spielstand. Das steht fest, kein Nachsehen im
 *     `gameState` nötig.
 *  2) Die Disziplin IST arena-fähig, aber die bereits gebuchte Zeile für dieses Team an diesem
 *     Spieltag trägt `resolutionSource: "pps_duell"` (K1-Arena-Vorlauf lief nicht/ist noch nicht
 *     verdrahtet, oder der Lauf fiel aus — `arenaAusfall`, PR #1269). Ohne bereits gebuchte Zeile
 *     (Spieltag noch nicht gewertet) wird NICHTS behauptet — kein Raten, ob der kommende Lauf
 *     klappt.
 *
 * BATTLE-MODE-GATE (Opus-Review zu PR #1282, 17.10. — echter Fehler, kein Stilpunkt): der Arena-
 * Host ist ein GLOBALER Tab, erscheint also auch in Manager-Saves (z. B. Chris' laufender
 * Spielstand). Dort wertet die Rangtabelle, es gibt weder Duell noch Brücke — Fall 1 hätte dort
 * fälschlich "wird per PPS-Duell gewertet" behauptet, obwohl in Manager-Saves schlicht gar keine
 * Brücke existiert. Darum ganz vorne `isBattleModeSave`-Gate: Manager-Saves bekommen grundsätzlich
 * keine Hinweise aus diesem Builder.
 *
 * Nutzt dieselben reinen Helfer wie der "Spieltage"-Modus (season-matchday-fixtures-overview.ts,
 * Task #159 Punkt 2) — keine zweite Beschriftung für `arenaAusfall` im Projekt.
 */
export type ArenaHostSpielquelleHinweis = {
  disciplineId: string;
  disciplineName: string;
  text: string;
};

export function buildArenaHostSpielquelleHinweise(
  gameState: Pick<GameState, "scenarioMeta" | "matchdayState" | "seasonState">,
  heimTeamId: string,
): ArenaHostSpielquelleHinweis[] {
  if (!isBattleModeSave(gameState)) {
    return [];
  }
  const matchdayId = gameState.matchdayState?.matchdayId;
  if (!matchdayId || !heimTeamId) {
    return [];
  }
  const spieltag = gameState.seasonState?.disciplineSchedule?.find((eintrag) => eintrag.matchdayId === matchdayId);
  if (!spieltag) {
    return [];
  }

  const hinweise: ArenaHostSpielquelleHinweis[] = [];
  for (const slot of [spieltag.discipline1, spieltag.discipline2]) {
    if (!slot) {
      continue;
    }
    if (!ARENA_RESOLVED_DISCIPLINE_IDS.has(slot.disciplineId)) {
      // MINI-DM-POD-RESOLVE (19.10.), seit 01.11. fuer JEDE Vierer-Pod-Disziplin (Mini-DM,
      // Battlefield): sie wird NICHT per PPS-Duell gewertet, sondern als echte Vierergruppe (Pod) --
      // s. mini-dm-pod-resolve.ts und `VIERER_POD_DISCIPLINE_IDS`.
      hinweise.push({
        disciplineId: slot.disciplineId,
        disciplineName: slot.displayName,
        text:
          isViererPodDiscipline(slot.disciplineId)
            ? "wird in dieser Saison als 4-Team-Gruppe (Pod) gewertet, nicht per Arena"
            : "wird in dieser Saison per PPS-Duell gewertet, nicht per Arena",
      });
      continue;
    }
    const zeile = findeDisziplinErgebnis(gameState, matchdayId, heimTeamId, slot.disciplineId);
    if (!zeile || zeile.teamPoints == null || zeile.resolutionSource !== "pps_duell") {
      continue;
    }
    const text = zeile.arenaAusfall
      ? `Arena-Lauf fiel aus (${arenaAusfallGrundLabel(zeile.arenaAusfall.grund)}) — an diesem Spieltag per PPS-Duell gewertet`
      : "wurde an diesem Spieltag per PPS-Duell gewertet";
    hinweise.push({ disciplineId: slot.disciplineId, disciplineName: slot.displayName, text });
  }
  return hinweise;
}
