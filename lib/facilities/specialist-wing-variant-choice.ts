import type { GameState } from "@/lib/data/olyDataTypes";
import { SPECIALIST_WING_VARIANTS, type SpecialistWingVariant } from "@/lib/facilities/facility-catalog";
import { normalizeProgressionClassName } from "@/lib/training/class-progression-config";
import type { TrainingFocusAxis } from "@/lib/training/development-route-bonus";
import { classNameToDevelopmentRoute } from "@/lib/training/organic-season-progression";

/**
 * Feste Reihenfolge für den Gleichstand-Fall — nur damit die Wahl deterministisch und in Tests
 * nachvollziehbar ist, ohne inhaltliche Bedeutung.
 */
const AXIS_TIE_BREAK_ORDER: TrainingFocusAxis[] = ["pow", "spe", "men", "soc"];

const VARIANT_BY_AXIS = Object.fromEntries(
  (Object.entries(SPECIALIST_WING_VARIANTS) as [SpecialistWingVariant, { focusAxis: TrainingFocusAxis }][]).map(
    ([variant, entry]) => [entry.focusAxis, variant],
  ),
) as Record<TrainingFocusAxis, SpecialistWingVariant>;

const AXIS_BY_TRAINING_FOCUS: Record<string, TrainingFocusAxis> = {
  POW: "pow",
  SPE: "spe",
  MEN: "men",
  SOC: "soc",
};

/**
 * Zählt die Entwicklungsrouten im Kader eines Teams (BALANCED/RECOVERY zählen nicht mit, weil sie
 * keiner Achse entsprechen). Grundlage ist dieselbe Zuordnung, die auch die Progression benutzt:
 * `classNameToDevelopmentRoute` auf der real trainierten Klasse (`trainingClass`, ersatzweise
 * `className`).
 */
export function countTeamRosterFocusAxes(gameState: GameState, teamId: string): Record<TrainingFocusAxis, number> {
  const counts: Record<TrainingFocusAxis, number> = { pow: 0, spe: 0, men: 0, soc: 0 };
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  for (const rosterEntry of gameState.rosters) {
    if (rosterEntry.teamId !== teamId) continue;
    const player = playerById.get(rosterEntry.playerId);
    if (!player) continue;
    const className =
      normalizeProgressionClassName(player.trainingClass) ?? normalizeProgressionClassName(player.className);
    if (!className) continue;
    const route = classNameToDevelopmentRoute(className);
    if (route === "BALANCED" || route === "RECOVERY") continue;
    const axis = AXIS_BY_TRAINING_FOCUS[route];
    if (axis) counts[axis] += 1;
  }
  return counts;
}

/**
 * Echte KI-Variantenwahl für den Specialist Wing.
 *
 * Vorher stand hier hart `"mind_lab"` (ai-manager-apply-service.ts) — folgenlos, solange die Variante
 * nichts tat. Mit S1 ist die Variante die Fokusachse des Teams, und eine Hartverdrahtung würde
 * praktisch der ganzen Liga einen MEN-Fokus verpassen, den niemand gewählt hat.
 *
 * Die Wahl leitet sich stattdessen aus der Kaderzusammensetzung ab: die häufigste Entwicklungsroute
 * im Kader gewinnt. Das ist die Entscheidung, die ein Manager auch treffen würde — der Flügel
 * verstärkt die Spieler, die man ohnehin hat.
 *
 * Gleichstand: (1) die bereits gesetzte Trainings-Fokusachse des Teams, falls sie unter den
 * Spitzenreitern ist — dann bleibt der KI-Fokus konsistent; sonst (2) feste Achsenreihenfolge.
 * Leerer/unbrauchbarer Kader: `power_gym`, derselbe Default wie in `normalizeSpecialistVariant`.
 */
export function chooseSpecialistWingVariantForTeam(gameState: GameState, teamId: string): SpecialistWingVariant {
  const counts = countTeamRosterFocusAxes(gameState, teamId);
  const maxCount = Math.max(...AXIS_TIE_BREAK_ORDER.map((axis) => counts[axis]));
  if (maxCount <= 0) {
    return "power_gym";
  }
  const leaders = AXIS_TIE_BREAK_ORDER.filter((axis) => counts[axis] === maxCount);
  if (leaders.length > 1) {
    const configuredFocus = gameState.seasonState.aiManagerTrainingSettings?.[teamId]?.trainingFocus;
    const configuredAxis = configuredFocus ? AXIS_BY_TRAINING_FOCUS[configuredFocus] : undefined;
    if (configuredAxis && leaders.includes(configuredAxis)) {
      return VARIANT_BY_AXIS[configuredAxis];
    }
  }
  return VARIANT_BY_AXIS[leaders[0]];
}
