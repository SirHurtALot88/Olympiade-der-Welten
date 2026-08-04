import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";

/** Die vier Trainings-Fokusachsen des Teams. Deckt sich 1:1 mit den vier Specialist-Wing-Varianten. */
export type TrainingFocusAxis = "pow" | "spe" | "men" | "soc";

const ROUTE_AXIS_MAP: Record<Exclude<PlayerDevelopmentRouteSuggestion, "BALANCED" | "RECOVERY">, TrainingFocusAxis> = {
  POW: "pow",
  SPE: "spe",
  MEN: "men",
  SOC: "soc",
};

/**
 * Basis-Routenbonus OHNE Specialist Wing: +8 % auf das organische Trainingsbudget, wenn die
 * Entwicklungsroute des Spielers zur Team-Fokusachse passt. Das ist der historische Wert (früher hart
 * als `1.08` an dieser Stelle) und bleibt der Maßstab für alles, was der Flügel obendrauf legt.
 */
export const DEVELOPMENT_ROUTE_BONUS_BASE_PCT = 8;

/**
 * HARTE OBERGRENZE für den Routenbonus (S1, Specialist Wing als Fokusachse).
 *
 * Warum so klein? Der Routenbonus multipliziert in `buildOrganicSeasonProgression` in DIESELBE Formel
 * wie vier weitere Faktoren (organic-season-progression.ts, `trainingSetpoints`):
 *   Basisbudget × Trait-Signal × Potential-Beschleuniger × ROUTENBONUS × (1 + Trainingszentrum-%)
 *                × (1 + Academy-%)
 * Trainingszentrum L5 = +70 %, Academy L5 = +30 % für F/E/D. Fünf multiplikative Faktoren stapeln sich,
 * ein linearer Aufschlag am Routenbonus wirkt am Ende also überproportional. Das Konzept
 * (docs/GEBAEUDE_REWORK_KONZEPT.md, S1) schreibt deshalb ausdrücklich: „die vorhandenen 1.08 sind der
 * Maßstab, nicht der Startpunkt."
 *
 * Gewählt: 13 % auf Stufe 5 — der Aufschlag ÜBER der Basis wächst also von 0 auf 5 Prozentpunkte und
 * bleibt mit 13 % deutlich unter dem verdoppelten Basisbonus (2 × 8 % = 16 %). Praktischer Effekt im
 * Vollausbau: 1.13 × 1.70 × 1.30 = 2.50 statt 1.08 × 1.70 × 1.30 = 2.39, also rund +4,6 % Endbudget
 * gegenüber heute — spürbar über eine Saison, aber weit davon entfernt, der Liga davonzulaufen.
 *
 * Die Grenze ist eine echte Klammer, kein Kommentar: `getSpecialistWingFocusBonusPct`
 * (facility-effects.ts) klemmt den Katalogwert daran fest, damit eine spätere Katalog-Änderung nicht
 * still darüber hinausläuft.
 */
export const DEVELOPMENT_ROUTE_BONUS_MAX_PCT = 13;

/**
 * Trainingsbudget-Faktor für die Entwicklungsroute eines Spielers.
 *
 * `focusBonusPct` ist der Bonus in Prozent, wenn Route und Fokusachse zusammenfallen. Default ist die
 * Basis (+8 %) — Aufrufer ohne Gebäudekontext (UI-Schätzungen, Alt-Tests) verhalten sich damit exakt
 * wie vorher. Die reale Progression übergibt hier den Wert aus `getSpecialistWingFocusBonusPct`.
 */
export function getDevelopmentRouteBonusMultiplier(
  route: PlayerDevelopmentRouteSuggestion,
  trainingFocusAxis?: TrainingFocusAxis | null,
  focusBonusPct: number = DEVELOPMENT_ROUTE_BONUS_BASE_PCT,
): number {
  if (!trainingFocusAxis || route === "BALANCED" || route === "RECOVERY") {
    return 1;
  }
  const routeAxis = ROUTE_AXIS_MAP[route as keyof typeof ROUTE_AXIS_MAP];
  if (!routeAxis) return 1;
  if (routeAxis !== trainingFocusAxis) return 1;
  const bonusPct = Number.isFinite(focusBonusPct)
    ? Math.min(Math.max(focusBonusPct, 0), DEVELOPMENT_ROUTE_BONUS_MAX_PCT)
    : DEVELOPMENT_ROUTE_BONUS_BASE_PCT;
  return 1 + bonusPct / 100;
}

export function formatDevelopmentRouteLabel(route: PlayerDevelopmentRouteSuggestion) {
  if (route === "BALANCED") return "Ausgewogen";
  if (route === "RECOVERY") return "Recovery";
  return route;
}
